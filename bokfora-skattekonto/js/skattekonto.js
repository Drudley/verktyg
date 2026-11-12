/* Skattekontot → bokföring. Reads Skatteverket's transaction export (CSV with ; and quotes, the older .skv, an Excel file
   or rows pasted from the e-tjänst), classifies each row and builds one voucher per row: skattekontot (1630) against the
   counter-account. Sign rule: an amount that raises the skattekonto balance is debit 1630. Amounts in öre. UMD, no network. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./csv.js'));
  else root.SKATTEKONTO = factory(root.CSV);
})(typeof self !== 'undefined' ? self : this, function (CSV) {
  'use strict';
  var ACCOUNTS = {
    '1630': 'Avräkning för skatter och avgifter (skattekonto)', '1930': 'Företagskonto/checkkonto/affärskonto',
    '2013': 'Övriga egna uttag', '2018': 'Övriga egna insättningar', '2510': 'Skatteskulder', '2514': 'Beräknad särskild löneskatt på pensionskostnader',
    '2518': 'Betald F-skatt', '2650': 'Redovisningskonto för moms', '2710': 'Personalskatt', '2731': 'Avräkning lagstadgade sociala avgifter',
    '6992': 'Övriga externa kostnader, ej avdragsgilla', '8314': 'Skattefria ränteintäkter', '8423': 'Räntekostnader för skatter och avgifter'
  };
  /* order matters: interest and fees before the words they contain (e.g. "Förseningsavgift moms") */
  var RULES = [
    { key: 'intr', re: /int[äa]ktsr[äa]nta/i },
    { key: 'kostr', re: /kostnadsr[äa]nta/i },
    { key: 'avgift', re: /f[öo]rseningsavgift|skattetill[äa]gg|kontrollavgift|uppb[öo]rdsavgift|dr[öo]jsm[åa]lsavgift/i },
    { key: 'fskatt', re: /preliminärskatt|prelimin[äa]r skatt|f-skatt|debiterad prel/i },
    { key: 'slp', re: /s[äa]rskild l[öo]neskatt/i },
    { key: 'slutlig', re: /slutlig skatt|kvarskatt|[öo]verskjutande skatt|tillgodof[öo]rd skatt|fyllnadsinbetalning|fyllnadsbetalning/i },
    { key: 'ag', re: /arbetsgivaravgift/i },
    { key: 'personal', re: /avdragen skatt|personalskatt|skatteavdrag/i },
    { key: 'moms', re: /\bmoms\b|mervärdesskatt/i },
    { key: 'in', re: /inbetalning/i },
    { key: 'ut', re: /utbetalning|[åa]terbetalning/i }
  ];
  function classify(text) { for (var i = 0; i < RULES.length; i++) if (RULES[i].re.test(text)) return RULES[i].key; return ''; }
  function kontoFor(key, opt, amount) {
    var ef = opt.type === 'EF';
    switch (key) {
      case 'in': case 'ut': return opt.bank || '1930';
      case 'fskatt': return ef ? '2013' : '2518';
      case 'slutlig': return ef ? (amount < 0 ? '2013' : '2018') : '2510';
      case 'ag': return '2731';
      case 'personal': return '2710';
      case 'moms': return '2650';
      case 'slp': return '2514';
      case 'intr': return '8314';
      case 'kostr': return '8423';
      case 'avgift': return '6992';
    }
    return '';
  }
  function isoDate(v) {
    if (typeof v === 'number' && v > 30000 && v < 80000) { var d = new Date(Math.round((v - 25569) * 864e5)); return d.toISOString().slice(0, 10); }
    var s = String(v == null ? '' : v).trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s))) return s;
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = /^(\d{2})(\d{2})(\d{2})$/.exec(s))) return '20' + m[1] + '-' + m[2] + '-' + m[3];
    return '';
  }
  function validDate(s) { var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  function amt(v) {
    if (typeof v === 'number') return Math.round(v * 100);
    var s = String(v == null ? '' : v).trim(); if (!s || !/\d/.test(s) || /[a-zåäö]/i.test(s)) return NaN;
    return CSV.toMinor(s.replace(/\u2212/g, '-').replace(/kr$/i, ''), true);
  }
  /* rows: array of arrays (strings or numbers) → { company, orgnr, opening, closing, rows:[{date,text,amount,saldo}], skipped } */
  function parseRows(rows) {
    var out = { company: '', orgnr: '', opening: null, closing: null, openingDate: '', closingDate: '', rows: [], skipped: 0 };
    rows.forEach(function (r, ri) {
      var cells = r.map(function (c) { return typeof c === 'number' ? c : String(c == null ? '' : c).trim(); });
      var di = -1;
      for (var i = 0; i < cells.length; i++) if (isoDate(cells[i]) && (typeof cells[i] !== 'number' || i === 0)) { di = i; break; }
      var texts = cells.filter(function (c) { return typeof c === 'string' && c && isNaN(amt(c)) && !isoDate(c); });
      if (di < 0) {
        var line = texts.join(' ');
        var nums = cells.filter(function (c) { return c !== '' && !isNaN(amt(c)) && !/^\d{6}-\d{4}$/.test(c); });
        var dm = /(\d{4}-\d{2}-\d{2})/.exec(line);
        if (/ing[åa]ende saldo/i.test(line) && nums.length) { out.opening = amt(nums[nums.length - 1]); out.openingDate = dm ? dm[1] : ''; return; }
        if (/utg[åa]ende saldo/i.test(line) && nums.length) { out.closing = amt(nums[nums.length - 1]); out.closingDate = dm ? dm[1] : ''; return; }
        var org = cells.filter(function (c) { return /^\d{6}-\d{4}$/.test(c); })[0];
        if (org && !out.orgnr) { out.orgnr = org; out.company = texts[0] || ''; return; }
        if (cells.some(function (c) { return c !== ''; })) out.skipped++;
        return;
      }
      var date = isoDate(cells[di]), text = '', vals = [];
      for (var j = di + 1; j < cells.length; j++) {
        var c = cells[j]; if (c === '') continue;
        if (!text && typeof c === 'string' && isNaN(amt(c))) { text = c; continue; }
        var a = amt(c); if (!isNaN(a)) vals.push(a); else if (!text) text = String(c); else text += ' ' + c;
      }
      if (!vals.length || !validDate(date)) { out.skipped++; return; }
      out.rows.push({ date: date, text: text, amount: vals[0], saldo: vals.length > 1 ? vals[1] : null });
    });
    out.rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }
  function lineRow(l) {
    if (/\t/.test(l)) return l.split('\t');
    var parts = l.trim().split(/\s{2,}/);
    if (parts.length >= 3 && isoDate(parts[0])) return parts;
    var N = '([-\u2212+]?\\d{1,3}(?:[ \u00a0]\\d{3})*(?:,\\d+)?)';
    var m = new RegExp('^\\s*(\\d{4}-\\d{2}-\\d{2})\\s+(.*?)\\s+' + N + '(?:\\s+' + N + ')?\\s*$').exec(l);
    return m ? [m[1], m[2], m[3], m[4] || ''] : [l];
  }
  function parseText(text) {
    text = text.replace(/^\uFEFF/, '');
    if (/;/.test(text.split(/\r?\n/).slice(0, 8).join(''))) { var p = CSV.parse(text, ';'); return parseRows([p.header].concat(p.rows)); }
    // tab separated or pasted from the web page: "2026-07-12  Arbetsgivaravgift juni 2026  -15 710"
    return parseRows(text.split(/\r?\n/).map(lineRow));
  }
  /* opt: {type:'AB'|'EF', sk:'1630', bank:'1930', serie:'A', nr:1, overrides:{index: konto}} */
  function build(parsed, opt) {
    opt = opt || {};
    var sk = /^\d{4}$/.test(opt.sk || '') ? opt.sk : '1630', serie = String(opt.serie || 'A').trim() || 'A', nr = Math.max(1, parseInt(opt.nr, 10) || 1);
    var ov = opt.overrides || {}, sum = 0, unknown = 0, per = {}, inSum = 0, outSum = 0;
    var rows = parsed.rows.map(function (r, i) {
      var key = classify(r.text), auto = kontoFor(key, opt, r.amount), konto = ov[i] != null && ov[i] !== '' ? String(ov[i]) : auto;
      if (!/^\d{4}$/.test(konto)) { konto = ''; unknown++; }
      sum += r.amount; if (r.amount > 0) inSum += r.amount; else outSum += r.amount;
      if (konto) { per[konto] = per[konto] || { konto: konto, debit: 0, credit: 0, n: 0 }; if (r.amount < 0) per[konto].debit += -r.amount; else per[konto].credit += r.amount; per[konto].n++; }
      return { i: i, date: r.date, text: r.text, amount: r.amount, saldo: r.saldo, key: key, konto: konto, auto: auto, changed: konto !== auto };
    });
    var check = 'none', diff = 0;
    if (parsed.opening != null && parsed.closing != null) { diff = parsed.opening + sum - parsed.closing; check = diff === 0 ? 'ok' : 'diff'; }
    else if (rows.length && rows[rows.length - 1].saldo != null && rows[0].saldo != null) {
      diff = rows[0].saldo - rows[0].amount + sum - rows[rows.length - 1].saldo; check = diff === 0 ? 'ok' : 'diff';
    }
    var vouchers = rows.filter(function (r) { return r.konto && r.amount; }).map(function (r, k) {
      return { serie: serie, nr: nr + k, date: r.date, text: ('Skattekonto: ' + r.text).slice(0, 100), trans: [{ konto: sk, amount: r.amount }, { konto: r.konto, amount: -r.amount }] };
    });
    var accounts = {}; accounts[sk] = ACCOUNTS[sk] || 'Skattekonto';
    rows.forEach(function (r) { if (r.konto) accounts[r.konto] = ACCOUNTS[r.konto] || ('Konto ' + r.konto); });
    var perList = Object.keys(per).sort().map(function (k) { var p = per[k]; p.name = accounts[k]; p.net = p.debit - p.credit; return p; });
    return { ok: rows.length > 0, rows: rows, n: rows.length, unknown: unknown, sum: sum, inSum: inSum, outSum: outSum, check: check, diff: diff,
      opening: parsed.opening, closing: parsed.closing, from: rows.length ? rows[0].date : '', to: rows.length ? rows[rows.length - 1].date : '',
      per: perList, vouchers: vouchers, accounts: accounts, sk: sk, ready: rows.length > 0 && unknown === 0 };
  }
  var CHOICES = ['1930', '2518', '2510', '2013', '2018', '2731', '2710', '2650', '2514', '8314', '8423', '6992'];
  /* synthetic example in the format of Skatteverket's CSV export (UTF-8 BOM, ; separated, all quoted, CRLF) */
  function sampleCsv() {
    var L = [['Exempelbolaget Skatt AB (syntetiskt)', '559999-0002', ''], [], ['', 'Ingående saldo 2026-07-01', '1 250'],
      ['2026-07-03', 'Inbetalning bokförd 260702', '42 000'], ['2026-07-12', 'Debiterad preliminärskatt', '-9 600'], ['2026-07-12', 'Arbetsgivaravgift juni 2026', '-15 710'],
      ['2026-07-12', 'Avdragen skatt juni 2026', '-14 400'], ['2026-07-12', 'Moms april 2026 - juni 2026', '-11 850'], ['2026-08-01', 'Intäktsränta', '12'],
      ['2026-08-04', 'Inbetalning bokförd 260803', '40 000'], ['2026-08-12', 'Debiterad preliminärskatt', '-9 600'], ['2026-08-12', 'Arbetsgivaravgift juli 2026', '-15 710'],
      ['2026-08-12', 'Avdragen skatt juli 2026', '-14 400'], ['2026-08-14', 'Förseningsavgift moms', '-625'], ['2026-09-01', 'Kostnadsränta', '-18'],
      ['2026-09-04', 'Inbetalning bokförd 260903', '61 000'], ['2026-09-12', 'Debiterad preliminärskatt', '-9 600'], ['2026-09-12', 'Arbetsgivaravgift augusti 2026', '-15 710'],
      ['2026-09-12', 'Avdragen skatt augusti 2026', '-14 400'], ['2026-09-21', 'Utbetalning', '-2 000'], ['', 'Utgående saldo 2026-09-30', '10 639']];
    return '\uFEFF' + L.map(function (r) { return r.map(function (c) { return '"' + c + '"'; }).join(';'); }).join('\r\n') + '\r\n';
  }
  return { ACCOUNTS: ACCOUNTS, CHOICES: CHOICES, RULES: RULES, classify: classify, kontoFor: kontoFor, isoDate: isoDate, amt: amt, parseRows: parseRows, parseText: parseText, build: build, sampleCsv: sampleCsv };
});
