/* Årsräkning från kontoutdrag – engine (UMD, no dependencies besides csv.js + xlsx-read.js). Runs in the browser and in node tests.
 * 1. readTable(bytes)   CSV / XLSX / HTML-table ".xls" → rows (arrays)
 * 2. parseRows(rows)    finds the header row, sniffs datum/text/belopp/saldo (+ bank presets) → transactions in öre
 * 3. categorize()       keyword rules → årsräkning categories (user rules first, then the built-in list, then by sign)
 * 4. compute()          period filter, accounts merged, ingående/utgående saldo, totals in blankett order, A+B = C+D check
 * All amounts are integer öre. Dates are 'YYYY-MM-DD' strings. Nothing here touches the network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./csv.js'), require('./xlsx-read.js'));
  else root.ARSR = factory(root.CSV, root.XLSXR);
})(typeof self !== 'undefined' ? self : this, function (CSV, XLSXR) {
  'use strict';

  /* ---------- categories, in the order most överförmyndare blanketter use (B inkomster, C utgifter) ---------- */
  var CATS = [
    { id: 'in_pension', g: 'in', sv: 'Pension, lön, sjukersättning', en: 'Pension, salary, sickness compensation' },
    { id: 'in_bostad', g: 'in', sv: 'Bostadstillägg, bostadsbidrag', en: 'Housing supplement / allowance' },
    { id: 'in_fsd', g: 'in', sv: 'Försörjningsstöd, ekonomiskt bistånd', en: 'Social assistance' },
    { id: 'in_ranta', g: 'in', sv: 'Ränta', en: 'Interest' },
    { id: 'in_skatt', g: 'in', sv: 'Återbetald skatt', en: 'Tax refund' },
    { id: 'in_ovr', g: 'in', sv: 'Övriga inkomster', en: 'Other income' },
    { id: 'out_skatt', g: 'out', sv: 'Skatt', en: 'Tax' },
    { id: 'out_hyra', g: 'out', sv: 'Hyra', en: 'Rent' },
    { id: 'out_omv', g: 'out', sv: 'Omvårdnadsavgift, hemtjänst', en: 'Care fee, home care' },
    { id: 'out_el', g: 'out', sv: 'El', en: 'Electricity' },
    { id: 'out_fors', g: 'out', sv: 'Försäkringar', en: 'Insurance' },
    { id: 'out_tele', g: 'out', sv: 'Telefon, TV, internet', en: 'Phone, TV, internet' },
    { id: 'out_sjuk', g: 'out', sv: 'Sjukvård, medicin, apotek', en: 'Healthcare, medicine, pharmacy' },
    { id: 'out_ficka', g: 'out', sv: 'Fickpengar, privata medel', en: 'Pocket money, personal funds' },
    { id: 'out_arvode', g: 'out', sv: 'Arvode god man/förvaltare', en: 'Guardian/administrator fee' },
    { id: 'out_ovr', g: 'out', sv: 'Övriga utgifter', en: 'Other expenses' },
    { id: 'x_egna', g: 'x', sv: 'Överföring mellan egna konton (räknas inte)', en: 'Transfer between own accounts (not counted)' }
  ];
  var CAT = {}; CATS.forEach(function (c) { CAT[c.id] = c; });

  /* Built-in keyword rules, checked in order. sign: +1 only deposits, -1 only withdrawals, 0 both.
     Keywords match at the start of a word in the normalised text ("pension" matches "PENSIONSMYNDIGHETEN", not "garantipension"). */
  var RULES = [
    [['överföring egna', 'överföring eget', 'överföring mellan', 'egen överföring', 'eget konto', 'egna konton', 'mellan egna', 'internöverföring', 'till sparkonto', 'från sparkonto', 'överföring sparkonto', 'överföring buffertkonto'], 'x_egna', 0],
    [['bostadstillägg', 'bostadstillagg', 'bostadsbidrag'], 'in_bostad', 1],
    [['försörjningsstöd', 'forsorjningsstod', 'ekonomiskt bistånd', 'ekonomiskt bistand', 'ek bistånd', 'socialtjänst', 'socialförvaltning', 'socialnämnd'], 'in_fsd', 1],
    [['skatteåterbäring', 'skatteaterbaring', 'återbetalning skatt', 'överskjutande skatt', 'skatteverket'], 'in_skatt', 1],
    [['ränta', 'ranta', 'inlåningsränta', 'kreditränta', 'årsränta'], 'in_ranta', 1],
    [['pensionsmyndigheten', 'pension', 'garantipension', 'inkomstpension', 'tjänstepension', 'premiepension', 'alecta', 'amf', 'kpa', 'spp', 'afa', 'sjukersättning', 'aktivitetsersättning', 'försäkringskassan', 'lön'], 'in_pension', 1],
    [['skatteverket', 'kvarskatt', 'restskatt', 'preliminärskatt', 'preliminar skatt', 'skatt'], 'out_skatt', -1],
    [['arvode', 'god man', 'godman', 'ställföreträdare', 'förvaltare', 'överförmyndar'], 'out_arvode', -1],
    [['hemtjänst', 'hemtjanst', 'omvårdnad', 'omvardnad', 'omsorgsavgift', 'vård och omsorg', 'vård omsorg', 'äldreboende', 'särskilt boende', 'trygghetslarm', 'kommun'], 'out_omv', -1],
    [['hyra', 'hyresavi', 'hyresgäst', 'bostäder', 'bostad ab', 'fastighet', 'hsb', 'riksbyggen', 'heimstaden', 'akelius', 'willhem', 'balder', 'victoriahem', 'rikshem'], 'out_hyra', -1],
    [['vattenfall', 'e.on', 'eon', 'fortum', 'ellevio', 'tibber', 'energi', 'elavtal', 'elnät', 'elhandel', 'greenely', 'kraft'], 'out_el', -1],
    [['försäkring', 'forsakring', 'folksam', 'trygg-hansa', 'trygg hansa', 'if skadeförsäkring', 'länsförsäkringar', 'gjensidige', 'moderna försäkringar', 'dina försäkringar', 'skandia'], 'out_fors', -1],
    [['telia', 'tele2', 'telenor', 'tre', 'hi3g', 'comviq', 'halebop', 'com hem', 'comhem', 'boxer', 'bredband', 'viaplay', 'netflix', 'radiotjänst', 'bahnhof', 'ownit', 'internet', 'mobil'], 'out_tele', -1],
    [['apotek', 'apoteket', 'kronans', 'apotea', 'lloyds', 'vårdcentral', 'tandvård', 'folktandvården', 'sjukhus', 'patientavgift', 'läkare', 'capio', 'praktikertjänst', 'region', 'hjälpmedel', 'vårdavgift', 'sjukvård'], 'out_sjuk', -1],
    [['fickpeng', 'fickpengar', 'privata medel', 'egna medel', 'kontantuttag', 'bankomat', 'uttag automat', 'uttag bankomat', 'kontant'], 'out_ficka', -1]
  ];

  /* ---------- text helpers ---------- */
  function normText(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9åäöéüæø.\-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  /* key used for "apply to all similar": the text without numbers (dates, card numbers, OCR) */
  function normKey(s) { return normText(s).split(' ').filter(function (w) { return w && !/\d/.test(w) && !/^[.\-]+$/.test(w); }).join(' '); }
  /* keyword at the start of a word; short keywords (≤ 4 letters, e.g. "tre", "amf", "lön") must be a whole word */
  function matchesKw(t, kw) { return kw.length <= 4 ? (' ' + t + ' ').indexOf(' ' + kw + ' ') !== -1 : (' ' + t).indexOf(' ' + kw) !== -1; }

  /* user rule: {kw, cat, mode:'same'|'contains'} — 'same' = identical normKey, 'contains' = keyword at word start */
  function categorize(text, amount, userRules) {
    var t = normText(text), k = null;
    for (var i = 0; userRules && i < userRules.length; i++) {
      var u = userRules[i]; if (!u || !CAT[u.cat] || !u.kw) continue;
      if (u.mode === 'same') { if (k === null) k = normKey(text); if (k === u.kw) return u.cat; }
      else if (matchesKw(t, normText(u.kw))) return u.cat;
    }
    var sg = amount > 0 ? 1 : amount < 0 ? -1 : 0;
    for (var j = 0; j < RULES.length; j++) {
      var r = RULES[j]; if (r[2] && r[2] !== sg) continue;
      for (var q = 0; q < r[0].length; q++) if (matchesKw(t, r[0][q])) return r[1];
    }
    return amount >= 0 ? 'in_ovr' : 'out_ovr';
  }

  /* ---------- dates & amounts ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function validYmd(y, m, d) { if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1) return null; var dt = new Date(Date.UTC(y, m - 1, d)); return dt.getUTCDate() === d ? y + '-' + pad(m) + '-' + pad(d) : null; }
  function parseDate(v) {
    if (typeof v === 'number') { if (v > 20000 && v < 80000) { var dt = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000); return dt.toISOString().slice(0, 10); } return null; }
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:$|[ T])/.exec(s))) return validYmd(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return validYmd(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:$|[ T])/.exec(s))) return validYmd(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{2})-(\d{2})-(\d{2})$/.exec(s))) return validYmd(2000 + +m[1], +m[2], +m[3]);
    return null;
  }
  function parseAmount(v, decimalComma) {
    if (typeof v === 'number') return isFinite(v) ? Math.round(v * 100) : NaN;
    var s = String(v == null ? '' : v).replace(/\s*(kr|sek|:-)\.?\s*$/i, '').replace(/^(sek|kr)\s*/i, '').trim();
    if (s === '') return NaN;
    return CSV.toMinor(s, decimalComma);
  }
  function addDays(ymd, n) { var d = new Date(ymd + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }

  /* ---------- reading files ---------- */
  function htmlRows(html) {
    var rows = [], tr = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, m;
    while ((m = tr.exec(html))) {
      var row = [], td = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi, c;
      while ((c = td.exec(m[1]))) row.push(XLSXR.xmlText(c[1].replace(/<br\s*\/?>/gi, ' ').replace(/&nbsp;/g, ' ')).replace(/\s+/g, ' ').trim());
      rows.push(row);
    }
    return rows;
  }
  /* bytes → Promise<{kind, sheets:[{name, rows}]}> */
  function readTable(bytes) {
    if (!bytes || !bytes.length) return Promise.reject(new Error('empty'));
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return Promise.reject(new Error('pdf'));
    if (XLSXR.isZip(bytes)) return XLSXR.readXLSX(bytes);
    if (bytes[0] === 0xD0 && bytes[1] === 0xCF) return Promise.reject(new Error('xls-legacy'));
    var head = CSV.decode(bytes.subarray(0, Math.min(bytes.length, 4096))).text;
    if (/^\s*</.test(head) && /<table|<tr/i.test(CSV.decode(bytes).text)) return Promise.resolve({ kind: 'html', sheets: [{ name: '', rows: htmlRows(CSV.decode(bytes).text) }] });
    try { return Promise.resolve(XLSXR.readCSV(bytes)); } catch (e) { return Promise.reject(e); }
  }

  /* ---------- column sniffing + bank presets ---------- */
  var SYN = {
    date: ['bokföringsdag', 'bokföringsdatum', 'bokförd', 'bokfört', 'bokföringsdag/transaktionsdag', 'reskontradatum', 'transaktionsdag', 'transaktionsdatum', 'datum', 'date', 'dato', 'valutadag', 'valutadatum'],
    text: ['beskrivning', 'text/mottagare', 'text', 'rubrik', 'mottagare/avsändare', 'meddelande', 'namn', 'specifikation', 'händelse', 'transaktionstext', 'transaktion', 'description', 'tekst', 'referens', 'transaktionstyp', 'typ', 'kategori'],
    amount: ['belopp', 'transaktionsbelopp', 'beløb', 'amount', 'summa'],
    inn: ['insättning', 'insättningar', 'inbetalning', 'inbetalningar', 'kredit', 'in'],
    out: ['uttag', 'utbetalning', 'utbetalningar', 'debet', 'ut'],
    balance: ['saldo', 'bokfört saldo', 'behållning', 'balance', 'saldo efter transaktion'],
    account: ['kontonummer', 'konto', 'account'],
    clearing: ['clearingnummer', 'clearing'],
    status: ['status']
  };
  function hnorm(h) { return String(h == null ? '' : h).toLowerCase().replace(/\u00a0/g, ' ').replace(/\s*\((sek|kr)\)\s*$/, '').replace(/\s+(sek|kr)$/, '').replace(/\s+/g, ' ').trim(); }
  /* bank presets: detect(set of normalised header names) → preferred text columns. Layouts are best guesses (see README). */
  var PRESETS = [
    { id: 'swedbank', name: 'Swedbank/Sparbanken', detect: function (h) { return h.radnummer && h.clearingnummer && h['bokföringsdag'] && h.beskrivning; }, text: ['beskrivning', 'referens'] },
    { id: 'seb', name: 'SEB', detect: function (h) { return h['bokföringsdatum'] && h.verifikationsnummer; }, text: ['text/mottagare', 'text'] },
    { id: 'handelsbanken', name: 'Handelsbanken', detect: function (h) { return h.reskontradatum && h.transaktionsdatum; }, text: ['text'] },
    { id: 'nordea', name: 'Nordea', detect: function (h) { return h['bokföringsdag'] && h.rubrik && (h['avsändare'] || h.mottagare); }, text: ['rubrik', 'namn', 'meddelande'], combine: true },
    { id: 'ica', name: 'ICA Banken', detect: function (h) { return h.budgetgrupp || (h.datum && h.text && h.typ && h.saldo && h.belopp && !h.kategori); }, text: ['text'] },
    { id: 'lf', name: 'Länsförsäkringar', detect: function (h) { return (h['bokföringsdag'] || h['bokföringsdatum']) && h.transaktionstyp && h.meddelande; }, text: ['meddelande', 'transaktionstyp'] },
    { id: 'danske', name: 'Danske Bank', detect: function (h) { return h.kategori && h.underkategori && (h['avstämt'] || h.status); }, text: ['text'] }
  ];
  function findCol(hs, list, used) { for (var i = 0; i < list.length; i++) { var k = hs.indexOf(list[i]); if (k >= 0 && (!used || used.indexOf(k) < 0)) return k; } return -1; }
  function sniffHeader(row) {
    var hs = row.map(hnorm), set = {}; hs.forEach(function (h) { if (h) set[h] = true; });
    var date = findCol(hs, SYN.date), amount = findCol(hs, SYN.amount), inn = findCol(hs, SYN.inn), out = findCol(hs, SYN.out);
    if (date < 0 || (amount < 0 && (inn < 0 || out < 0))) return null;
    var preset = null; for (var p = 0; p < PRESETS.length; p++) if (PRESETS[p].detect(set)) { preset = PRESETS[p]; break; }
    var used = [date, amount, inn, out], text = [];
    (preset ? preset.text : SYN.text).forEach(function (n) { var k = hs.indexOf(n); if (k >= 0 && used.indexOf(k) < 0 && text.indexOf(k) < 0) text.push(k); });
    if (!text.length) SYN.text.forEach(function (n) { var k = hs.indexOf(n); if (k >= 0 && used.indexOf(k) < 0 && text.indexOf(k) < 0) text.push(k); });
    if (!text.length) return null;
    return { hs: hs, combine: !!(preset && preset.combine), date: date, amount: amount, inn: amount < 0 ? inn : -1, out: amount < 0 ? out : -1, text: text.slice(0, 2), balance: findCol(hs, SYN.balance),
      account: findCol(hs, SYN.account), clearing: findCol(hs, SYN.clearing), status: findCol(hs, SYN.status), preset: preset };
  }
  /* account number in the lines above the header ("Konto: 1234 12 34567", "Kontonummer 1234-5,678 901 234-5") */
  function preambleAccount(rows) {
    for (var i = 0; i < rows.length; i++) {
      var line = rows[i].join(' ').replace(/\s+/g, ' ');
      var m = /konto(?:nummer|nr)?[:\s]*([\d][\d ,.\-]{5,}\d)/i.exec(line);
      if (m) return m[1].replace(/\s+/g, ' ').trim();
    }
    return null;
  }
  /* rows (arrays) → {bank, bankName, account, tx:[{date,text,amount,balance,line}], ignored, hasBalance, decimalComma} */
  function parseRows(rows, opts) {
    opts = opts || {};
    var hi = -1, H = null;
    for (var i = 0; i < Math.min(rows.length, 40); i++) { if (!rows[i] || rows[i].length < 2) continue; H = sniffHeader(rows[i]); if (H) { hi = i; break; } }
    if (!H) { var e = new Error('unknown-format'); throw e; }
    var dc = opts.delimiter === ';' || opts.delimiter === '\t' || opts.kind === 'html';
    if (opts.delimiter === ',') { /* Swedbank-style "-123.45" vs "1 234,56" in quoted fields: guess from the data */
      var c = 0, p = 0; rows.slice(hi + 1, hi + 60).forEach(function (r) { var v = String(r[H.amount >= 0 ? H.amount : H.out] || ''); if (/,\d{2}$/.test(v)) c++; if (/\.\d{2}$/.test(v)) p++; }); dc = c > p;
    }
    var tx = [], ignored = 0, accSet = {};
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r]; if (!row || !row.join('').trim()) continue;
      var d = parseDate(row[H.date]);
      if (!d) { ignored++; continue; }
      if (H.status >= 0 && /reserv|väntande|pending|kommande|ej bokf/i.test(String(row[H.status] || ''))) { ignored++; continue; }
      var amt;
      if (H.amount >= 0) amt = parseAmount(row[H.amount], dc);
      else { var a = parseAmount(row[H.inn], dc), b = parseAmount(row[H.out], dc); a = isNaN(a) ? 0 : Math.abs(a); b = isNaN(b) ? 0 : Math.abs(b); amt = (String(row[H.inn] || '').trim() === '' && String(row[H.out] || '').trim() === '') ? NaN : a - b; }
      if (isNaN(amt)) { ignored++; continue; }
      /* text: first non-empty text column; Nordea-style exports (payee + message) combine both */
      var parts = []; H.text.forEach(function (k) { var v = String(row[k] == null ? '' : row[k]).replace(/\s+/g, ' ').trim(); if (!v) return; if (parts.length && (!H.combine || !/[a-zåäö]/i.test(v) || parts.some(function (x) { return x.toLowerCase() === v.toLowerCase(); }))) return; parts.push(v); });
      var bal = H.balance >= 0 ? parseAmount(row[H.balance], dc) : NaN;
      if (H.account >= 0 && String(row[H.account] || '').trim()) accSet[(H.clearing >= 0 && String(row[H.clearing] || '').trim() ? String(row[H.clearing]).trim() + '-' : '') + String(row[H.account]).trim()] = true;
      tx.push({ date: d, text: parts.join(' · ') || '(utan text)', amount: amt, balance: isNaN(bal) ? null : bal, line: r + 1 });
    }
    if (!tx.length) throw new Error('no-rows');
    var accs = Object.keys(accSet);
    return { bank: H.preset ? H.preset.id : 'generic', bankName: H.preset ? H.preset.name : null, account: accs.length === 1 ? accs[0] : preambleAccount(rows.slice(0, hi)),
      tx: orient(tx), ignored: ignored, hasBalance: tx.some(function (t) { return t.balance !== null; }), headerLine: hi + 1, columns: { date: H.hs[H.date], amount: H.amount >= 0 ? H.hs[H.amount] : H.hs[H.inn] + '/' + H.hs[H.out], text: H.text.map(function (k) { return H.hs[k]; }), balance: H.balance >= 0 ? H.hs[H.balance] : null } };
  }
  function chainBreaks(tx) { var n = 0; for (var i = 1; i < tx.length; i++) if (tx[i].balance !== null && tx[i - 1].balance !== null && tx[i - 1].balance + tx[i].amount !== tx[i].balance) n++; return n; }
  /* banks export newest first or oldest first; return chronological order (stable within a day, checked against the saldo chain) */
  function orient(tx) {
    var a = tx.slice(), b = tx.slice().reverse();
    if (a[0].date < a[a.length - 1].date) return a;
    if (a[0].date > a[a.length - 1].date) return b;
    return chainBreaks(b) < chainBreaks(a) ? b : a;
  }
  /* bytes + file name → Promise<parsed file> */
  function parseFile(bytes, name) {
    return readTable(bytes).then(function (t) {
      var lastErr = null;
      for (var s = 0; s < t.sheets.length; s++) {
        try { var p = parseRows(t.sheets[s].rows, { delimiter: t.delimiter, kind: t.kind }); p.name = name || 'fil'; p.kind = t.kind; p.sheet = t.sheets[s].name; return p; }
        catch (e) { lastErr = e; }
      }
      throw lastErr || new Error('unknown-format');
    });
  }
  function fileLabel(f) {
    if (f.account) return (f.bankName ? f.bankName + ' ' : '') + f.account;
    return String(f.name || 'fil').replace(/\.(csv|txt|xlsx?|html?)$/i, '');
  }

  /* ---------- years / default period ---------- */
  function years(files) {
    var c = {}; files.forEach(function (f) { f.tx.forEach(function (t) { var y = +t.date.slice(0, 4); c[y] = (c[y] || 0) + 1; }); });
    var ys = Object.keys(c).map(Number).sort();
    var best = ys.reduce(function (b, y) { return b === null || c[y] >= c[b] ? y : b; }, null);
    return { list: ys, counts: c, best: best };
  }

  /* ---------- compute ----------
   opts: { from, to, accounts:{key:{include, name, opening, closing}}, overrides:{txId:cat}, userRules:[...], adj:{pensionTax, interestTax} } (öre) */
  function compute(files, opts) {
    opts = opts || {}; var A = opts.accounts || {}, ov = opts.overrides || {}, adj = opts.adj || {};
    var from = opts.from, to = opts.to, flags = [], dupes = 0;
    var groups = {}, order = [];
    files.forEach(function (f, fi) {
      var key = fileLabel(f), cfg = A[key] || {}, name = (cfg.name || '').trim() || key;
      if (!groups[name]) { groups[name] = { name: name, keys: [], files: [], banks: [], include: true, cfg: {} }; order.push(name); }
      var g = groups[name]; if (g.keys.indexOf(key) < 0) g.keys.push(key); g.files.push({ f: f, fi: fi });
      if (g.banks.indexOf(f.bankName || '') < 0) g.banks.push(f.bankName || '');
      if (cfg.include === false) g.include = false;
    });
    var accounts = order.map(function (name) {
      var g = groups[name], cfg = {}; g.keys.forEach(function (k) { var c = A[k] || {}; ['opening', 'closing'].forEach(function (p) { if (c[p] != null && c[p] !== '' && !isNaN(c[p])) cfg[p] = +c[p]; }); });
      if (A[name] && A[name] !== A[g.keys[0]]) ['opening', 'closing'].forEach(function (p) { var v = A[name][p]; if (v != null && v !== '' && !isNaN(v)) cfg[p] = +v; });
      g.files.sort(function (x, y) { return x.f.tx[0].date < y.f.tx[0].date ? -1 : x.f.tx[0].date > y.f.tx[0].date ? 1 : x.fi - y.fi; });
      var all = [], seen = {};
      g.files.forEach(function (x, k) {
        x.f.tx.forEach(function (t, i) {
          var sig = t.date + '|' + t.amount + '|' + t.balance + '|' + normText(t.text);
          if (seen[sig] != null && seen[sig] !== k) { dupes++; return; }
          if (seen[sig] == null) seen[sig] = k;
          all.push({ id: x.f.name + '#' + t.line, file: x.f.name, line: t.line, date: t.date, text: t.text, amount: t.amount, balance: t.balance, account: name, ord: k * 1e6 + i });
        });
      });
      all.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.ord - y.ord; });
      var hasBal = all.some(function (t) { return t.balance !== null; });
      var before = all.filter(function (t) { return t.date < from; }), inP = all.filter(function (t) { return t.date >= from && t.date <= to; }), upTo = all.filter(function (t) { return t.date <= to; });
      var opening = null, openingSrc = 'missing', closing = null, closingSrc = 'missing';
      if (cfg.opening != null) { opening = cfg.opening; openingSrc = 'manual'; }
      else if (hasBal) {
        var lb = before.length ? before[before.length - 1] : null, fp = inP.length ? inP[0] : all[0];
        if (lb && lb.balance !== null) { opening = lb.balance; openingSrc = 'saldo'; }
        else if (fp && fp.balance !== null) { opening = fp.balance - fp.amount; openingSrc = 'saldo'; }
      }
      if (cfg.closing != null) { closing = cfg.closing; closingSrc = 'manual'; }
      else if (hasBal) {
        var lu = upTo.length ? upTo[upTo.length - 1] : null;
        if (lu && lu.balance !== null) { closing = lu.balance; closingSrc = 'saldo'; }
        else if (!upTo.length && all[0].balance !== null) { closing = all[0].balance - all[0].amount; closingSrc = 'saldo'; }
      }
      var first = all[0].date, last = all[all.length - 1].date;
      return { name: name, keys: g.keys, banks: g.banks.filter(Boolean), files: g.files.map(function (x) { return x.f.name; }), include: g.include, hasBalance: hasBal, n: all.length, nPeriod: inP.length,
        first: first, last: last, breaks: chainBreaks(all), opening: opening, openingSrc: openingSrc, closing: closing, closingSrc: closingSrc,
        lateStart: first > addDays(from, 31) && openingSrc === 'saldo', earlyEnd: last < addDays(to, -31) && closingSrc === 'saldo', tx: inP };
    });
    var tx = [];
    accounts.forEach(function (a) { if (a.include) tx = tx.concat(a.tx); });
    tx.sort(function (x, y) { return x.date < y.date ? -1 : x.date > y.date ? 1 : x.account < y.account ? -1 : x.account > y.account ? 1 : x.ord - y.ord; });
    var cats = {}; CATS.forEach(function (c) { cats[c.id] = 0; });
    var counts = {}; CATS.forEach(function (c) { counts[c.id] = 0; });
    tx.forEach(function (t) {
      t.auto = categorize(t.text, t.amount, opts.userRules); t.cat = ov[t.id] && CAT[ov[t.id]] ? ov[t.id] : t.auto; t.key = normKey(t.text);
      counts[t.cat]++;
      cats[t.cat] += CAT[t.cat].g === 'out' ? -t.amount : t.amount;
    });
    var pt = Math.round(+adj.pensionTax || 0), it = Math.round(+adj.interestTax || 0);
    cats.in_pension += pt; cats.in_ranta += it; cats.out_skatt += pt + it;
    var B = 0, C = 0; CATS.forEach(function (c) { if (c.g === 'in') B += cats[c.id]; else if (c.g === 'out') C += cats[c.id]; });
    var inc = accounts.filter(function (a) { return a.include; });
    var missing = inc.filter(function (a) { return a.opening === null || a.closing === null; }).map(function (a) { return a.name; });
    var Asum = inc.reduce(function (s, a) { return s + (a.opening || 0); }, 0), Dsum = inc.reduce(function (s, a) { return s + (a.closing || 0); }, 0);
    var diff = (Asum + B) - (C + Dsum);
    if (dupes) flags.push({ code: 'duplicates', n: dupes });
    inc.forEach(function (a) {
      if (a.breaks) flags.push({ code: 'chain', account: a.name, n: a.breaks });
      if (a.lateStart) flags.push({ code: 'late-start', account: a.name, date: a.first });
      if (a.earlyEnd) flags.push({ code: 'early-end', account: a.name, date: a.last });
      if (!a.hasBalance) flags.push({ code: 'no-balance', account: a.name });
    });
    CATS.forEach(function (c) { if (c.g !== 'x' && cats[c.id] < 0) flags.push({ code: 'negative', cat: c.id, amount: cats[c.id] }); });
    if (cats.x_egna !== 0) flags.push({ code: 'transfers', amount: cats.x_egna });
    var similar = {}; tx.forEach(function (t) { similar[t.key] = (similar[t.key] || 0) + 1; });
    return { from: from, to: to, accounts: accounts, tx: tx, cats: cats, counts: counts, A: Asum, B: B, C: C, D: Dsum, AB: Asum + B, CD: C + Dsum, diff: diff,
      missing: missing, balanced: !missing.length && diff === 0, flags: flags, similar: similar, adj: { pensionTax: pt, interestTax: it } };
  }

  /* rules file (paid): {app:'arsrakning-god-man', version:1, rules:[{kw, cat, mode}]} */
  function rulesToJson(rules) { return JSON.stringify({ app: 'arsrakning-god-man', version: 1, saved: new Date().toISOString().slice(0, 10), rules: cleanRules(rules) }, null, 2); }
  function cleanRules(rules) {
    var out = [], seen = {};
    (rules || []).forEach(function (r) {
      if (!r || typeof r.kw !== 'string' || !CAT[r.cat]) return; var mode = r.mode === 'same' ? 'same' : 'contains', kw = mode === 'same' ? normKey(r.kw) : normText(r.kw);
      if (!kw || kw.length > 200 || seen[mode + kw]) return; seen[mode + kw] = 1; out.push({ kw: kw, cat: r.cat, mode: mode });
    });
    return out.slice(0, 2000);
  }
  function rulesFromJson(text) {
    var j = JSON.parse(text); var list = Array.isArray(j) ? j : j && j.rules;
    if (!Array.isArray(list)) throw new Error('bad-rules');
    return cleanRules(list);
  }

  return { CATS: CATS, CAT: CAT, RULES: RULES, PRESETS: PRESETS, normText: normText, normKey: normKey, categorize: categorize, parseDate: parseDate, parseAmount: parseAmount,
    readTable: readTable, htmlRows: htmlRows, parseRows: parseRows, parseFile: parseFile, fileLabel: fileLabel, orient: orient, chainBreaks: chainBreaks, years: years, compute: compute,
    rulesToJson: rulesToJson, rulesFromJson: rulesFromJson, cleanRules: cleanRules, addDays: addDays };
});
