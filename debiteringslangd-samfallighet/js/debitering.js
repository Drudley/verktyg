/* Engine for Debiteringslängd & avier (samfällighetsföreningar). Pure functions, no DOM, no network. All amounts in integer öre.
 *   parseRows(rows)              member list (array of rows, header somewhere in the first 30) → {members, cols, map, warnings}
 *   parseFile(bytes, name)       CSV/TSV/XLSX → Promise<same>        parseText(text) → same (pasted from Excel/Sheets)
 *   allocate(total, weights, unit) largest-remainder (Hamilton) apportionment: Σ result === total exactly
 *   compute(members, grenar, opts) per verksamhetsgren (42 § 3 st. SFL: each branch shown separately) and per fastighet
 *   luhn / ocr / validOcr        Bankgirot 10-modul check digit, optional length digit (näst sista)
 *   validBankgiro / validPlusgiro / swishPayload / validSwish
 *   restlista, registerToJson / registerFromJson / nextYear */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./csv.js'), require('./xlsx-read.js'));
  else root.DEBL = factory(root.CSV, root.XLSXR);
})(typeof self !== 'undefined' ? self : this, function (CSV, XLSXR) {
  'use strict';
  var SCALE = 1000000; // andelstal are stored as integers × 10^6 (up to 6 decimals, exact)

  /* ---------- numbers ---------- */
  /** andelstal "1", "1,5", "0.333", "2 000", "" → integer × 10^6 (BigInt-safe Number), NaN if not a number, null if empty */
  function parseShare(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? Math.round(v * SCALE) : NaN;
    var s = String(v).trim().replace(/[\s\u00a0\u202f]/g, '');
    if (s === '' || s === '-' || s === '–') return null;
    s = s.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(s) || s === '.') return NaN;
    var p = s.split('.'), whole = p[0] || '0', fr = ((p[1] || '') + '0000000').slice(0, 7);
    var n = parseInt(whole, 10) * SCALE + parseInt(fr.slice(0, 6), 10) + (+fr[6] >= 5 ? 1 : 0);
    return n;
  }
  function shareToString(n) { var s = (n / SCALE).toFixed(6).replace(/\.?0+$/, ''); return s.replace('.', ','); }
  /** kronor input "12 345,67", "12345.67", "12 345 kr" → öre (NaN if bad, 0 if empty) */
  function parseKr(v) {
    if (typeof v === 'number') return Math.round(v * 100);
    var s = String(v == null ? '' : v).replace(/\s*(kr|sek|:-)\s*$/i, '').trim();
    if (s === '') return 0;
    return CSV.toMinor(s, true);
  }
  function kr(ore) { var neg = ore < 0, a = Math.abs(Math.round(ore)), k = String(Math.floor(a / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'), o = String(a % 100).padStart(2, '0'); return (neg ? '−' : '') + k + ',' + o; }
  function digits(s) { return String(s == null ? '' : s).replace(/\D/g, ''); }

  /* ---------- member list ---------- */
  var H = {
    fastighet: /^(fastighet(sbeteckning)?|fastighets?\s*bet\.?|beteckning|registerbeteckning|delägarfastighet|fastighetsnr|fastighet\s*\/\s*tomt)$/i,
    agare: /^(ägare|fastighetsägare|lagfaren\s+ägare|namn|medlem|medlemsnamn|delägare|ägare\s*\d?|ägare\s*\/\s*medlem)$/i,
    adress: /^(adress|utdelningsadress|gatuadress|postadress\s*1|c\/o-?adress|bostadsadress)$/i,
    postnr: /^(post\s*nr|postnr|postnummer)$/i,
    ort: /^(ort|postort|post\s*ort)$/i,
    postadress: /^(postadress|postnr\s*(och|&|\/)\s*ort|postnummer\s*(och|&|\/)\s*ort)$/i,
    nr: /^(medlemsnr|medlemsnummer|medl\.?\s*nr|nr|löpnr|kundnr|id)$/i,
    epost: /^(e-?post|e-?mail|mail)$/i
  };
  var SHARE = /andel|^ga\b|^ga[:\s]|gemensamhetsanl|^tal\b|andelstal|insats|^del\b/i;
  function headerScore(row) {
    var cells = row.map(function (c) { return String(c == null ? '' : c).trim(); }), s = 0, hasF = false;
    cells.forEach(function (c) { if (H.fastighet.test(c)) { s += 3; hasF = true; } else if (SHARE.test(c)) s += 2; else if (Object.keys(H).some(function (k) { return H[k].test(c); })) s += 1; });
    return hasF ? s : 0;
  }
  function parseRows(rows) {
    var hi = -1, best = 0;
    for (var i = 0; i < Math.min(rows.length, 30); i++) { var sc = headerScore(rows[i] || []); if (sc > best) { best = sc; hi = i; } }
    if (hi < 0) throw new Error('no-header');
    var head = rows[hi].map(function (c) { return String(c == null ? '' : c).trim(); }), map = {}, shareCols = [];
    head.forEach(function (h, j) {
      if (!h) return;
      var k = null;
      ['fastighet', 'postadress', 'agare', 'adress', 'postnr', 'ort', 'nr', 'epost'].some(function (key) { if (map[key] === undefined && H[key].test(h)) { k = key; return true; } return false; });
      if (k) map[k] = j; else if (SHARE.test(h)) shareCols.push(j);
    });
    var body = rows.slice(hi + 1).filter(function (r) { return r && r.some(function (c) { return String(c == null ? '' : c).trim() !== ''; }); });
    if (!shareCols.length) { // fallback: numeric columns that are not mapped
      head.forEach(function (h, j) {
        if (!h || Object.keys(map).some(function (k) { return map[k] === j; })) return;
        var vals = body.map(function (r) { return r[j]; }).filter(function (v) { return String(v == null ? '' : v).trim() !== ''; });
        if (vals.length && vals.every(function (v) { var n = parseShare(v); return n !== null && !isNaN(n); })) shareCols.push(j);
      });
    }
    if (!shareCols.length) throw new Error('no-shares');
    var cols = shareCols.map(function (j) { return head[j]; }), warnings = [], members = [], seen = {};
    body.forEach(function (r, ri) {
      var g = function (k) { return map[k] === undefined ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim(); };
      var f = g('fastighet');
      if (!f) { if (/^(summa|totalt|total)/i.test(String(r.find(function (c) { return String(c || '').trim(); }) || '').trim())) return; warnings.push({ code: 'no-fastighet', line: hi + ri + 2 }); return; }
      if (/^(summa|totalt|total)\b/i.test(f)) return;
      var shares = {}, bad = [];
      shareCols.forEach(function (j, ci) { var n = parseShare(r[j]); if (isNaN(n)) { bad.push(cols[ci]); n = 0; } shares[cols[ci]] = n || 0; });
      if (bad.length) warnings.push({ code: 'bad-share', line: hi + ri + 2, fastighet: f, cols: bad });
      var key = f.toLowerCase().replace(/\s+/g, ' ');
      if (seen[key]) { warnings.push({ code: 'duplicate', fastighet: f, line: hi + ri + 2 }); seen[key]++; key += '#' + seen[key]; } else seen[key] = 1;
      var postadr = g('postadress') || [g('postnr'), g('ort')].filter(Boolean).join(' ');
      members.push({ id: key, fastighet: f, agare: g('agare'), adress: g('adress'), postadress: postadr, epost: g('epost'), nr: digits(g('nr')), shares: shares, line: hi + ri + 2 });
    });
    if (!members.length) throw new Error('no-rows');
    var unmapped = ['agare', 'adress'].filter(function (k) { return map[k] === undefined; });
    if (unmapped.length) warnings.push({ code: 'missing-cols', cols: unmapped });
    return { members: members, cols: cols, map: Object.keys(map).reduce(function (o, k) { o[k] = head[map[k]]; return o; }, {}), header: hi + 1, warnings: warnings };
  }
  function parseText(text) {
    var t = String(text || '').replace(/^\uFEFF/, ''); if (!t.trim()) throw new Error('empty');
    var lines = t.split(/\r?\n/).slice(0, 20), delim = ['\t', ';', ','].map(function (d) { return [d, lines.reduce(function (s, l) { return s + l.split(d).length - 1; }, 0)]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var p = CSV.parse(t, delim); return parseRows([p.header].concat(p.rows));
  }
  function parseFile(bytes, name) {
    if (!bytes || !bytes.length) return Promise.reject(new Error('empty'));
    if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return Promise.reject(new Error('pdf'));
    return XLSXR.read(bytes).then(function (wb) {
      var err = null;
      for (var i = 0; i < wb.sheets.length; i++) { try { var r = parseRows(wb.sheets[i].rows); r.sheet = wb.sheets[i].name; r.kind = wb.kind; return r; } catch (e) { err = err || e; } }
      throw err || new Error('no-header');
    });
  }

  /* ---------- apportionment ---------- */
  /** Largest remainder: total öre split by integer weights in steps of `unit` öre (1 = öre, 100 = hela kronor).
   *  Ties → larger weight first, then list order. A total that is not a multiple of unit leaves (total mod unit) öre, which
   *  goes to the row with the largest remainder so the sum stays exact (flagged by compute). */
  function allocate(total, weights, unit) {
    unit = unit || 1; var n = weights.length, W = 0n, i;
    var w = weights.map(function (x) { return BigInt(Math.max(0, Math.round(x || 0))); });
    for (i = 0; i < n; i++) W += w[i];
    if (W === 0n || !n) return null;
    var T = BigInt(Math.round(total)), U = BigInt(unit), units = T / U, left = T - units * U;
    var base = [], rem = [], given = 0n;
    for (i = 0; i < n; i++) { var q = units * w[i]; base.push(q / W); rem.push(q % W); given += q / W; }
    var order = []; for (i = 0; i < n; i++) order.push(i);
    order.sort(function (a, b) { if (rem[a] !== rem[b]) return rem[b] > rem[a] ? 1 : -1; if (w[a] !== w[b]) return w[b] > w[a] ? 1 : -1; return a - b; });
    var extra = Number(units - given), out = base.map(function (b) { return b * U; });
    for (i = 0; i < extra; i++) out[order[i]] += U;
    if (left > 0n) { var tgt = order.filter(function (k) { return w[k] > 0n; })[extra % Math.max(1, order.filter(function (k) { return w[k] > 0n; }).length)] ; out[tgt === undefined ? order[0] : tgt] += left; }
    return out.map(Number);
  }
  /** grenar: [{key, label, source: '<column name>' | '=lika', lines: [{text, amount(öre)}]}]
   *  opts: {unit: 1|100}. Returns {rows:[{member, parts:{key:öre}, shares:{key:int}, total}], grenar:[{…, total, sumW, n}], total, flags} */
  function compute(members, grenar, opts) {
    opts = opts || {}; var unit = opts.unit === 100 ? 100 : 1, flags = [];
    var rows = members.map(function (m) { return { member: m, parts: {}, shares: {}, total: 0 }; });
    var gs = grenar.map(function (g) {
      var total = (g.lines || []).reduce(function (s, l) { return s + (Math.round(l.amount) || 0); }, 0);
      var w = members.map(function (m) { return g.source === '=lika' ? SCALE : (m.shares[g.source] || 0); });
      var sumW = w.reduce(function (s, x) { return s + x; }, 0), n = w.filter(function (x) { return x > 0; }).length;
      var res = total ? allocate(total, w, unit) : members.map(function () { return 0; });
      if (total && !res) { flags.push({ code: 'no-weights', gren: g.label }); res = members.map(function () { return 0; }); }
      if (total < 0) flags.push({ code: 'negative', gren: g.label });
      if (unit === 100 && total % 100) flags.push({ code: 'odd-ore', gren: g.label, ore: ((total % 100) + 100) % 100 });
      rows.forEach(function (r, i) { r.parts[g.key] = res[i]; r.shares[g.key] = w[i]; r.total += res[i]; });
      var sum = res.reduce(function (s, x) { return s + x; }, 0);
      if (sum !== total) flags.push({ code: 'sum-mismatch', gren: g.label }); // never expected
      return { key: g.key, label: g.label, source: g.source, lines: g.lines || [], total: total, sumW: sumW, n: n, perShare: sumW ? total * SCALE / sumW : 0, sum: sum };
    });
    var total = gs.reduce(function (s, g) { return s + g.total; }, 0), sumRows = rows.reduce(function (s, r) { return s + r.total; }, 0);
    rows.forEach(function (r) { if (!r.total && gs.some(function (g) { return g.total; })) flags.push({ code: 'zero-member', fastighet: r.member.fastighet }); });
    return { rows: rows, grenar: gs, total: total, sumRows: sumRows, exact: sumRows === total && gs.every(function (g) { return g.sum === g.total; }), unit: unit, flags: flags };
  }

  /* ---------- OCR / giro / Swish ---------- */
  /** 10-modul (Luhn) check digit for a digit string (the check digit itself not included) */
  function luhn(s) {
    s = digits(s); var sum = 0;
    for (var i = s.length - 1, dbl = true; i >= 0; i--, dbl = !dbl) { var d = +s[i] * (dbl ? 2 : 1); sum += d > 9 ? d - 9 : d; }
    return (10 - sum % 10) % 10;
  }
  function luhnOk(s) { s = digits(s); return s.length >= 2 && luhn(s.slice(0, -1)) === +s.slice(-1); }
  /** OCR reference from base digits: base + [length digit] + check digit. Length digit = total length mod 10 (Bankgirot "variabel längdkontroll"). */
  function ocr(base, opts) {
    base = digits(base); var withLen = !(opts && opts.lengthDigit === false);
    var body = withLen ? base + String((base.length + 2) % 10) : base;
    var ref = body + luhn(body);
    if (ref.length < 2 || ref.length > 25) throw new Error('ocr-length');
    return ref;
  }
  function validOcr(s, opts) {
    var raw = String(s == null ? '' : s).trim(); if (!/^\d{2,25}$/.test(raw)) return false;
    if (!luhnOk(raw)) return false;
    if (opts && opts.lengthDigit) return +raw[raw.length - 2] === raw.length % 10;
    return true;
  }
  /** base digits for a member: prefix + member number (or list position), zero-padded to `pad` digits */
  function ocrBase(member, index, o) {
    o = o || {}; var nr = member.nr && o.useNr !== false ? member.nr : String(index + 1);
    return digits(o.prefix) + nr.padStart(o.pad || 3, '0');
  }
  function validBankgiro(s) { var d = digits(s); return /^\d{3,4}-?\d{4}$/.test(String(s).replace(/\s/g, '')) && (d.length === 7 || d.length === 8) && luhnOk(d); }
  function validPlusgiro(s) { var d = digits(s); return /^[\d\s-]+$/.test(String(s)) && d.length >= 2 && d.length <= 8 && luhnOk(d); }
  function fmtBankgiro(s) { var d = digits(s); return d.slice(0, -4) + '-' + d.slice(-4); }
  function fmtPlusgiro(s) { var d = digits(s); var a = d.slice(0, -1); return a.replace(/\B(?=(\d{2})+(?!\d))/g, ' ') + '-' + d.slice(-1); }
  /** Swish number: Swish Företag/Förening 123 xxx xx xx (10 digits) or a Swedish mobile 07x… / 467x… */
  function validSwish(s) { var d = digits(s); return /^123\d{7}$/.test(d) || /^07\d{8}$/.test(d) || /^467\d{8}$/.test(d); }
  /** Swish QR "C" string (Swish QR code design specification v1.7.2, §6.1): C<payee>;<amount, 2 decimals, comma>;<message URL-encoded>;<lock mask>
   *  lock mask 0 = payee, amount and message fixed. */
  function swishPayload(o) {
    var payee = digits(o.payee); if (!validSwish(payee)) throw new Error('swish-number');
    var amt = o.amount == null ? '' : (Math.round(o.amount) / 100).toFixed(2).replace('.', ',');
    var msg = encodeURIComponent(String(o.message == null ? '' : o.message).slice(0, 50));
    return 'C' + payee + ';' + amt + ';' + msg + ';' + (o.mask == null ? 0 : o.mask);
  }

  /* ---------- avprickning / register ---------- */
  /** payments: {memberId: {paid: öre, date: 'yyyy-mm-dd'}} → rows with remaining, status ('paid'|'part'|'open'|'overdue'|'over') */
  function restlista(res, payments, due, today) {
    payments = payments || {}; var out = res.rows.map(function (r) {
      var p = payments[r.member.id] || {}, paid = Math.round(p.paid || 0), left = r.total - paid;
      var status = left === 0 ? 'paid' : left < 0 ? 'over' : paid > 0 ? 'part' : (due && today && today > due) ? 'overdue' : 'open';
      if (status === 'part' && due && today && today > due) status = 'overdue';
      return { member: r.member, total: r.total, paid: paid, left: left, date: p.date || '', status: status };
    });
    var sum = function (k) { return out.reduce(function (s, x) { return s + x[k]; }, 0); };
    return { rows: out, total: sum('total'), paid: sum('paid'), left: out.reduce(function (s, x) { return s + Math.max(0, x.left); }, 0), nOpen: out.filter(function (x) { return x.left > 0; }).length, nPaid: out.filter(function (x) { return x.left <= 0; }).length };
  }
  var KIND = 'debiteringslangd-register';
  function registerToJson(reg) { return JSON.stringify({ kind: KIND, version: 1, saved: reg.saved || new Date().toISOString().slice(0, 10), register: { settings: reg.settings, grenar: reg.grenar, members: reg.members, cols: reg.cols, payments: reg.payments || {} } }, null, 1); }
  function registerFromJson(s) {
    var j = JSON.parse(s); if (!j || j.kind !== KIND || !j.register || !Array.isArray(j.register.members)) throw new Error('not-register');
    var r = j.register; r.payments = r.payments || {}; r.grenar = r.grenar || []; r.settings = r.settings || {}; return r;
  }
  function shiftYear(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return d || ''; var y = +d.slice(0, 4) + 1, md = d.slice(5); if (md === '02-29') md = '02-28'; return y + '-' + md; }
  /** copy a register to next year: same members, andelstal and grenar (amounts kept as a starting point), dates +1 year, payments cleared, OCR prefix = new year when it was the year */
  function nextYear(reg) {
    var c = JSON.parse(JSON.stringify(reg)), s = c.settings || {}, y = +s.year || new Date().getFullYear();
    s.year = String(y + 1); ['due', 'stamma', 'upprattad'].forEach(function (k) { s[k] = shiftYear(s[k]); });
    if (s.prefix === String(y).slice(2) || s.prefix === String(y)) s.prefix = String(y + 1).slice(-s.prefix.length);
    s.paragraf = ''; c.payments = {}; c.settings = s; return c;
  }
  return { SCALE: SCALE, parseShare: parseShare, shareToString: shareToString, parseKr: parseKr, kr: kr, digits: digits, parseRows: parseRows, parseText: parseText, parseFile: parseFile,
    allocate: allocate, compute: compute, luhn: luhn, luhnOk: luhnOk, ocr: ocr, validOcr: validOcr, ocrBase: ocrBase, validBankgiro: validBankgiro, validPlusgiro: validPlusgiro,
    fmtBankgiro: fmtBankgiro, fmtPlusgiro: fmtPlusgiro, validSwish: validSwish, swishPayload: swishPayload, restlista: restlista, registerToJson: registerToJson, registerFromJson: registerFromJson, nextYear: nextYear, shiftYear: shiftYear };
});
