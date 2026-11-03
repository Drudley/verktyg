/* Engine for "Andelstal för vägförening" (free feeder page). Pure functions, no DOM, no network.
 *   CATEGORIES                 Lantmäteriet PM 2025 (LM2025/006319, 2025-05-23) "Schabloner vid tillämpning av tonkilometermetoden"
 *   rowValue(row, cat, opts)   antal × ton/enhet × använd väglängd × faktor  (tonkm)
 *   compute(rows, cats, opts)  rows → per fastighet (rows with the same fastighet are summed), rounded andelstal,
 *                              share in % that sums to exactly 100,00 and an optional amount split in öre (largest remainder)
 *   toCsv(res)                 ;-separated, decimal comma – the format the Debiteringslängd tool's register import reads
 *   sheets(res, cats, opts)    sheets for xlsx-writer.js        parseText(text) pasted rows from Excel/Sheets
 * All of this is an aid. Legally binding andelstal come from the anläggningsbeslut (lantmäteriförrättning) or an
 * agreement approved under 43 § anläggningslagen. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./csv.js'));
  else root.ANDEL = factory(root.CSV);
})(typeof self !== 'undefined' ? self : this, function (CSV) {
  'use strict';
  var SRC = 'Lantmäteriet PM 2025';
  /* key, group, Swedish/English label, ton per unit and year, unit ('st' or 'ha'), section in the PM */
  var CATEGORIES = [
    ['perm', 'bo', 'Permanentbostad (ett hushåll)', 'Permanent home (one household)', 2500, 'st', '3.2.1'],
    ['komp', 'bo', 'Komplementbostad, varaktigt uthyrd', 'Secondary dwelling, let out long-term', 1300, 'st', '3.2.2.2'],
    ['fri_int', 'bo', 'Fritidsbostad, intensiv användning', 'Holiday home, intensive use', 1800, 'st', '3.3.1'],
    ['fri_norm', 'bo', 'Fritidsbostad, normal användning', 'Holiday home, normal use', 900, 'st', '3.3.1'],
    ['fri_lag', 'bo', 'Fritidsbostad, låg användning', 'Holiday home, low use', 450, 'st', '3.3.1'],
    ['lgh', 'bo', 'Flerfamiljshus, per lägenhet', 'Apartment building, per flat', 1500, 'st', '3.4.1'],
    ['komb', 'bo', 'Kombinerad bostadsfastighet 1–2 ha', 'Combined residential property 1–2 ha', 2500, 'st', '2 (tabell 1)'],
    ['obeb', 'bo', 'Obebyggd fastighet', 'Undeveloped property', 100, 'st', '3.6.1'],
    ['bat', 'ov', 'Småbåtshamn, per båtplats', 'Small-boat harbour, per berth', 400, 'st', '3.9.7'],
    ['tek_2v', 'ov', 'Teknisk anläggning, besök 2 ggr/vecka', 'Technical installation, visits twice a week', 1100, 'st', '3.10.1'],
    ['tek_1v', 'ov', 'Teknisk anläggning, besök 1 gång/vecka', 'Technical installation, visits once a week', 800, 'st', '3.10.1'],
    ['tek_14', 'ov', 'Teknisk anläggning, besök varannan vecka', 'Technical installation, visits every other week', 600, 'st', '3.10.1'],
    ['tek_man', 'ov', 'Teknisk anläggning, besök 1 gång/månad', 'Technical installation, visits once a month', 500, 'st', '3.10.1'],
    ['natur', 'ov', 'Naturreservat – skyddad natur', 'Nature reserve – protected nature', 500, 'st', '3.10.4'],
    ['jvg_sig', 'ov', 'Järnvägsfastighet – signalanläggningar', 'Railway property – signalling', 800, 'st', '3.9.1'],
    ['jvg_ovr', 'ov', 'Järnvägsfastighet – övriga anläggningar', 'Railway property – other installations', 600, 'st', '3.9.1'],
    ['skog1', 'mark', 'Skog, tillväxtområde 1 (Jämtland, fjällkommuner i norr)', 'Forest, growth area 1', 15, 'ha', '3.8.1'],
    ['skog2', 'mark', 'Skog, tillväxtområde 2 (Västernorrland, Norrbottens/Västerbottens kust m.fl.)', 'Forest, growth area 2', 18, 'ha', '3.8.1'],
    ['skog3', 'mark', 'Skog, tillväxtområde 3 (Dalarna, Gävle m.fl.)', 'Forest, growth area 3', 24, 'ha', '3.8.1'],
    ['skog4', 'mark', 'Skog, tillväxtområde 4 (Värmland, Örebro, Västmanland, Sörmland, Stockholm, Uppsala)', 'Forest, growth area 4', 30, 'ha', '3.8.1'],
    ['skog5', 'mark', 'Skog, tillväxtområde 5 (Västra Götaland, Jönköping, Kronoberg, Kalmar, Östergötland, Gotland)', 'Forest, growth area 5', 36, 'ha', '3.8.1'],
    ['skog6', 'mark', 'Skog, tillväxtområde 6 (Halland, Skåne, Blekinge)', 'Forest, growth area 6', 42, 'ha', '3.8.1'],
    ['skog_r', 'mark', 'Skogsmark där skogsbruk inte är tillåtet (t.ex. reservat)', 'Forest land where forestry is not allowed', 2, 'ha', '3.8.2.2'],
    ['aker_gss', 'mark', 'Åker, interna jordbrukstransporter – Gss', 'Arable land, internal farm transport – Gss', 195, 'ha', '3.7.1.2'],
    ['aker_gmb', 'mark', 'Åker, interna jordbrukstransporter – Gmb, Gns, Gsk, Ss', 'Arable land, internal farm transport – Gmb, Gns, Gsk, Ss', 145, 'ha', '3.7.1.2'],
    ['aker_ssk', 'mark', 'Åker, interna jordbrukstransporter – Ssk, Nn, Nö', 'Arable land, internal farm transport – Ssk, Nn, Nö', 110, 'ha', '3.7.1.2'],
    ['bete_gss', 'mark', 'Bete, interna jordbrukstransporter – Gss', 'Pasture, internal farm transport – Gss', 60, 'ha', '3.7.1.2'],
    ['bete_gmb', 'mark', 'Bete, interna jordbrukstransporter – Gmb, Gns, Gsk, Ss', 'Pasture, internal farm transport – Gmb, Gns, Gsk, Ss', 45, 'ha', '3.7.1.2'],
    ['bete_ssk', 'mark', 'Bete, interna jordbrukstransporter – Ssk, Nn, Nö', 'Pasture, internal farm transport – Ssk, Nn, Nö', 30, 'ha', '3.7.1.2'],
    ['utf_gss', 'mark', 'Företagsutfart jordbruk, mindre gård (<30 ha åker) – Gss', 'Farm business exit, small farm (<30 ha) – Gss', 125, 'ha', '3.7.1.3'],
    ['utf_gmb', 'mark', 'Företagsutfart jordbruk, mindre gård (<20 ha åker) – Gmb, Gns, Gsk, Ss', 'Farm business exit, small farm (<20 ha) – Gmb, Gns, Gsk, Ss', 100, 'ha', '3.7.1.3'],
    ['utf_ssk', 'mark', 'Företagsutfart jordbruk, mindre gård (<20 ha åker) – Ssk, Nn, Nö', 'Farm business exit, small farm (<20 ha) – Ssk, Nn, Nö', 75, 'ha', '3.7.1.3']
  ].map(function (c) { return { key: c[0], group: c[1], sv: c[2], en: c[3], ton: c[4], unit: c[5], ref: SRC + ' avsnitt ' + c[6], std: true }; });
  var DEFAULTS = { minKmOn: true, minKm: 0.3, noDistance: false, minAndel: 0, dec: 0, amount: 0, colName: 'Andelstal väg' };

  /* ---------- numbers ---------- */
  /** "1 234,5" / "1234.5" / "0,3" → Number; '' → null; garbage → NaN. Negative not allowed. */
  function num(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : NaN;
    var s = String(v).trim().replace(/[\s\u00a0\u202f]/g, '').replace(/(km|ha|st|ton|kr)$/i, '');
    if (s === '' || s === '-' || s === '–') return null;
    if (s.indexOf(',') >= 0 && s.indexOf('.') >= 0) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else s = s.replace(',', '.');
    if (!/^\d*\.?\d*$/.test(s) || s === '.') return NaN;
    return parseFloat(s);
  }
  function round(x, dec) { var f = Math.pow(10, dec); return Math.round(x * f + (x >= 0 ? 1e-9 : -1e-9)) / f; }
  /** Swedish display: 12 345,6 (nbsp thousands), dec fixed decimals (or trimmed when trim=true) */
  function fmt(x, dec, trim) {
    var s = round(x, dec).toFixed(dec); if (trim && s.indexOf('.') >= 0) s = s.replace(/\.?0+$/, '');
    var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); return p.join(',');
  }
  function plain(x, dec) { return round(x, dec).toFixed(dec).replace('.', ','); } // CSV: no thousands separator
  /** largest-remainder (Hamilton) apportionment of an integer total over non-negative integer weights; Σ = total exactly.
   *  Ties → larger weight first, then list order. */
  function allocate(total, weights) {
    var T = BigInt(total), W = weights.map(function (w) { return BigInt(w); }), S = W.reduce(function (a, b) { return a + b; }, 0n);
    if (S === 0n) return weights.map(function () { return 0; });
    var base = W.map(function (w) { return w * T / S; }), rem = W.map(function (w, i) { return { i: i, r: w * T - base[i] * S, w: w }; });
    var left = T - base.reduce(function (a, b) { return a + b; }, 0n);
    rem.sort(function (a, b) { return a.r === b.r ? (a.w === b.w ? a.i - b.i : (b.w > a.w ? 1 : -1)) : (b.r > a.r ? 1 : -1); });
    for (var k = 0; left > 0n; k++, left--) base[rem[k].i] += 1n;
    return base.map(Number);
  }

  /* ---------- calculation ---------- */
  function catMap(cats) { var m = {}; (cats || CATEGORIES).forEach(function (c) { m[c.key] = c; }); return m; }
  /** used road length: real km, raised to minKm when that option is on; 1 when distance is ignored (then the value is in ton) */
  function usedKm(km, o) { if (o.noDistance) return 1; var k = km || 0; return o.minKmOn && k < o.minKm ? o.minKm : k; }
  function rowValue(row, cat, o) {
    o = Object.assign({}, DEFAULTS, o); var a = num(row.antal), km = num(row.km), f = num(row.faktor);
    if (f === null) f = 1; if (a === null) a = cat && cat.unit === 'st' ? 1 : 0;
    if (!cat || isNaN(a) || isNaN(km) || isNaN(f)) return NaN;
    return a * cat.ton * usedKm(km, o) * f;
  }
  function keyOf(f) { return String(f || '').trim().toLowerCase().replace(/\s+/g, ' '); }
  /** rows: [{fastighet, agare, cat, antal, km, faktor}] → {props, rows, total, sumPct, amount, warnings, unitLabel} */
  function compute(rows, cats, opts) {
    var o = Object.assign({}, DEFAULTS, opts), M = catMap(cats), props = [], by = {}, warnings = [], detail = [], fri = {};
    rows.forEach(function (r, i) {
      var f = String(r.fastighet || '').trim(), c = M[r.cat];
      var blank = !f && !String(r.antal || '').trim() && !String(r.km || '').trim();
      if (blank) return;
      if (!f) { warnings.push({ code: 'no-fastighet', row: i + 1 }); return; }
      if (!c) { warnings.push({ code: 'no-cat', row: i + 1, fastighet: f }); return; }
      var v = rowValue(r, c, o);
      if (isNaN(v)) { warnings.push({ code: 'bad-number', row: i + 1, fastighet: f }); return; }
      var km = num(r.km);
      if (km === null && !o.noDistance) warnings.push({ code: 'no-km', row: i + 1, fastighet: f });
      if (!o.noDistance && o.minKmOn && (km || 0) < o.minKm) warnings.push({ code: 'min-km', row: i + 1, fastighet: f, km: km || 0 });
      if (/^skog[1-6]$/.test(c.key) && num(r.antal) !== null && num(r.antal) < 1) warnings.push({ code: 'skog-lt-1ha', row: i + 1, fastighet: f });
      if (/^fri_/.test(c.key)) fri[c.key] = (fri[c.key] || 0) + 1;
      var k = keyOf(f), p = by[k];
      if (!p) { p = by[k] = { fastighet: f, agare: '', value: 0, rows: [] }; props.push(p); }
      if (!p.agare && r.agare) p.agare = String(r.agare).trim();
      var d = { row: i + 1, fastighet: f, agare: String(r.agare || '').trim(), cat: c, antal: num(r.antal) === null ? (c.unit === 'st' ? 1 : 0) : num(r.antal), km: km || 0, usedKm: usedKm(km, o), faktor: num(r.faktor) === null ? 1 : num(r.faktor), value: v };
      p.rows.push(d); detail.push(d); p.value += v;
    });
    if (Object.keys(fri).length > 1) warnings.push({ code: 'fri-mixed' });
    var dec = Math.max(0, Math.min(3, o.dec | 0)), F = Math.pow(10, dec);
    props.forEach(function (p) {
      p.raw = p.value; p.raised = false;
      if (o.minAndel > 0 && p.value < o.minAndel) { p.value = o.minAndel; p.raised = true; }
      p.andelstal = round(p.value, dec);
      if (p.andelstal === 0) warnings.push({ code: 'zero', fastighet: p.fastighet });
    });
    var ints = props.map(function (p) { return Math.round(p.andelstal * F); }), total = ints.reduce(function (a, b) { return a + b; }, 0) / F;
    var bp = allocate(total > 0 ? 10000 : 0, ints); // hundredths of a percent
    props.forEach(function (p, i) { p.pct = bp[i] / 100; p.exactPct = total > 0 ? p.andelstal / total * 100 : 0; });
    var amount = Math.round((o.amount || 0) * 100) || 0;
    if (amount > 0) { var a = allocate(amount, ints); props.forEach(function (p, i) { p.ore = a[i]; }); }
    return { props: props, rows: detail, total: total, sumPct: bp.reduce(function (s, x) { return s + x; }, 0) / 100, amountOre: amount, dec: dec,
      unitLabel: o.noDistance ? 'ton' : 'tonkm', warnings: warnings, opts: o };
  }

  /* ---------- export ---------- */
  function csvCell(s) { s = String(s == null ? '' : s); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  /** CSV for the Debiteringslängd tool: header row "Fastighet;Ägare;<colName>" (the import finds the header and reads
   *  every column whose name contains "andel" as an andelstal column), decimal comma, CRLF; UTF-8 BOM is added by the caller. */
  function toCsv(res, colName) {
    var name = String(colName || res.opts.colName || DEFAULTS.colName).trim() || DEFAULTS.colName;
    if (!/andel/i.test(name)) name = 'Andelstal ' + name;
    var lines = [['Fastighet', 'Ägare', name]].concat(res.props.map(function (p) { return [p.fastighet, p.agare, plain(p.andelstal, res.dec)]; }));
    return lines.map(function (l) { return l.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }
  /** tab-separated for the clipboard (paste into Excel / Google Sheets) */
  function toTsv(res) {
    var h = ['Fastighet', 'Ägare', 'Andelstal (' + res.unitLabel + ')', 'Procent'].concat(res.amountOre ? ['Belopp (kr)'] : []);
    return [h].concat(res.props.map(function (p) { return [p.fastighet, p.agare, plain(p.andelstal, res.dec), plain(p.pct, 2)].concat(res.amountOre ? [plain(p.ore / 100, 2)] : []); }))
      .map(function (l) { return l.map(function (c) { return String(c).replace(/[\t\r\n]+/g, ' '); }).join('\t'); }).join('\n') + '\n';
  }
  function B(s) { return { v: s, b: true }; }
  function sheets(res, cats, meta) {
    meta = meta || {}; var o = res.opts, u = res.unitLabel;
    var s1 = [[meta.title || 'Andelstal'], ['Beräknat med tonkilometermetoden (' + (o.noDistance ? 'utan väglängd – ton per år' : 'ton per år × använd väglängd i km') + '). Hjälpmedel – inte ett lantmäteribeslut.'], [],
      ['Fastighet', 'Ägare', 'Andelstal (' + u + ')', 'Procent'].concat(res.amountOre ? ['Belopp (kr)'] : []).map(B)]
      .concat(res.props.map(function (p) { return [p.fastighet, p.agare, p.andelstal, round(p.pct, 2)].concat(res.amountOre ? [{ v: p.ore / 100, t: 'money' }] : []); }))
      .concat([[B('Summa'), '', { v: res.total, b: true }, { v: res.sumPct, b: true }].concat(res.amountOre ? [{ v: res.amountOre / 100, t: 'money', b: true }] : [])]);
    var s2 = [['Beräkning per rad'], [], ['Fastighet', 'Ägare', 'Typ', 'Antal', 'Enhet', 'Ton per enhet och år', 'Väglängd (km)', 'Använd väglängd (km)', 'Faktor', u, 'Källa'].map(B)]
      .concat(res.rows.map(function (d) { return [d.fastighet, d.agare, d.cat.sv, d.antal, d.cat.unit, d.cat.ton, d.km, o.noDistance ? '–' : d.usedKm, d.faktor, round(d.value, 3), d.cat.std ? d.cat.ref : 'Egen kategori']; }));
    var s3 = [['Schabloner (ton per fastighet/enhet och år)'], [], ['Typ', 'Ton per år', 'Enhet', 'Källa'].map(B)]
      .concat((cats || CATEGORIES).map(function (c) { return [c.sv, c.ton, c.unit === 'ha' ? 'per hektar' : 'per st', c.std ? c.ref : 'Egen kategori']; }));
    var s4 = [['Inställningar och källor'], [],
      ['Minsta väglängd', o.noDistance ? '–' : (o.minKmOn ? String(o.minKm).replace('.', ',') + ' km (PM 2025 avsnitt 3.1.3)' : 'Av')],
      ['Väglängd', o.noDistance ? 'Ingen hänsyn till väglängd (PM 2025 avsnitt 1.7)' : 'Använd väglängd per fastighet'],
      ['Lägsta andelstal', o.minAndel > 0 ? o.minAndel : 'Av'], ['Decimaler', res.dec], [],
      ['Lantmäteriet: PM 2025 – Schabloner vid tillämpning av tonkilometermetoden (LM2025/006319, 2025-05-23)', 'https://www.lantmateriet.se/globalassets/fastigheter/samfalligheter/tonkm.pdf'],
      ['Lantmäteriet: Enskilda vägar', 'https://www.lantmateriet.se/sv/fastighet-och-mark/samfallighet--aga-och-anvanda-gemensamt/enskilda-vagar/'],
      ['Anläggningslagen (1973:1149) 15 §', 'https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/anlaggningslag-19731149_sfs-1973-1149/'], [],
      ['Gällande andelstal i en gemensamhetsanläggning bestäms vid lantmäteriförrättning (anläggningsbeslut) eller genom överenskommelse som godkänts enligt 43 § anläggningslagen.']];
    return [{ name: 'Andelstal', rows: s1, widths: [18, 30, 18, 10, 14], freeze: 4 }, { name: 'Beräkning', rows: s2, widths: [16, 26, 44, 8, 7, 12, 12, 14, 8, 12, 30], freeze: 3 },
      { name: 'Schabloner', rows: s3, widths: [70, 12, 12, 34] }, { name: 'Inställningar och källor', rows: s4, widths: [80, 90] }];
  }

  /* ---------- paste import ---------- */
  var HDR = { fastighet: /^(fastighet(sbeteckning)?|beteckning|delägarfastighet)$/i, agare: /^(ägare|fastighetsägare|namn|delägare|medlem)$/i,
    cat: /^(typ|kategori|slag|fastighetstyp|användning|trafikslag)$/i, antal: /^(antal|areal|ha|st|antal\s*\/\s*areal)/i,
    km: /^(väglängd|vaglangd|km|sträcka|använd väglängd)/i, faktor: /^(faktor|reduktion|reduktionsfaktor|utnyttjandegrad)/i };
  /** guess a category key from a free-text type ("permanent", "fritidshus", "skog 5" …) */
  function guessCat(s, cats) {
    var t = String(s || '').trim().toLowerCase(); if (!t) return null;
    var list = cats || CATEGORIES, hit = list.filter(function (c) { return c.key === t || c.sv.toLowerCase() === t || c.en.toLowerCase() === t; })[0];
    if (hit) return hit.key;
    if (/^perm|helår|villa|radhus|kedjehus/.test(t)) return 'perm';
    if (/komplement/.test(t)) return 'komp';
    if (/fritid|sommar|stuga/.test(t)) return /intensiv|hög/.test(t) ? 'fri_int' : /låg/.test(t) ? 'fri_lag' : 'fri_norm';
    if (/lägenhet|flerfamilj/.test(t)) return 'lgh';
    if (/obebyggd|tomt/.test(t)) return 'obeb';
    if (/båt/.test(t)) return 'bat';
    var m = t.match(/skog\D*([1-6])\b/); if (m) return 'skog' + m[1];
    var part = list.filter(function (c) { return c.sv.toLowerCase().indexOf(t) >= 0; }); return part.length === 1 ? part[0].key : null;
  }
  function parseText(text, cats) {
    var t = String(text || '').replace(/^\uFEFF/, ''); if (!t.trim()) throw new Error('empty');
    var lines = t.split(/\r?\n/).slice(0, 20), delim = ['\t', ';', ','].map(function (d) { return [d, lines.reduce(function (s, l) { return s + l.split(d).length - 1; }, 0)]; }).sort(function (a, b) { return b[1] - a[1]; })[0][0];
    var p = CSV.parse(t, delim), all = [p.header].concat(p.rows), hi = -1, map = {};
    for (var i = 0; i < Math.min(all.length, 15) && hi < 0; i++) if (all[i].some(function (c) { return HDR.fastighet.test(String(c).trim()); })) hi = i;
    if (hi < 0) { map = { fastighet: 0, agare: 1, cat: 2, antal: 3, km: 4, faktor: 5 }; hi = -1; } // no header: fixed order
    else all[hi].forEach(function (h, j) { h = String(h).trim(); Object.keys(HDR).some(function (k) { if (map[k] === undefined && HDR[k].test(h)) { map[k] = j; return true; } return false; }); });
    if (map.fastighet === undefined) throw new Error('no-header');
    var rows = [], unknown = [];
    all.slice(hi + 1).forEach(function (r, ri) {
      var g = function (k) { return map[k] === undefined ? '' : String(r[map[k]] == null ? '' : r[map[k]]).trim(); };
      var f = g('fastighet'); if (!f || /^(summa|totalt)/i.test(f)) return;
      var c = guessCat(g('cat'), cats); if (!c) unknown.push({ line: hi + ri + 2, fastighet: f, typ: g('cat') });
      rows.push({ fastighet: f, agare: g('agare'), cat: c || '', antal: g('antal'), km: g('km'), faktor: g('faktor') });
    });
    if (!rows.length) throw new Error('no-rows');
    return { rows: rows, unknown: unknown };
  }
  return { CATEGORIES: CATEGORIES, DEFAULTS: DEFAULTS, num: num, round: round, fmt: fmt, plain: plain, allocate: allocate, usedKm: usedKm,
    rowValue: rowValue, compute: compute, toCsv: toCsv, toTsv: toTsv, sheets: sheets, guessCat: guessCat, parseText: parseText };
});
