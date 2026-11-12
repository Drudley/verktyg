/* Kapitalafkastordningen – calculation core (no DOM). UMD: window.KAO / require().
   Rules: virksomhedsskatteloven (LBK nr. 1836 af 16/09/2021 med senere ændringer) § 22 a:
   stk. 1 (kapitalafkast fragår i personlig indkomst, lægges til kapitalindkomst; valg som § 2, stk. 2, 1.–3. pkt.),
   stk. 2 (grundlag × sats efter § 9; forholdsmæssigt efter hele måneder), stk. 3 (loft: største af positiv personlig
   nettoindkomst fra virksomheden og negativ nettokapitalindkomst), stk. 4 (ægtefæller), stk. 5 (grundlag primo af
   udelukkende erhvervsmæssige aktiver; § 8, stk. 2, 1.–3. pkt. og § 3, stk. 4: fast ejendom til kontant anskaffelsessum,
   driftsmidler til saldoværdi, negativ saldo fradrages ikke), stk. 6 (blandede aktiver forholdsmæssigt), stk. 7 (ikke
   kontanter, fordringer, aktier; varelager + varedebitorer + igangværende arbejde kun ud over varekreditorer),
   stk. 8 (ikke fast ejendom stillet til rådighed som bolig for forældre, bedsteforældre, børn, børnebørn – forældrekøb).
   Gæld fragår IKKE. Satser: § 9; Den juridiske vejledning C.C.5.3.1.2.4 (2023–2025), SKM2026.414.SKTST (2026).
   All amounts in øre (integers). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.KAO = f(); })(this, function () {
  'use strict';
  var RATES = { 2023: 3, 2024: 4, 2025: 2, 2026: 2 };
  var TYPES = ['ejendom', 'familie', 'drift', 'lager', 'debitor', 'igang', 'immat', 'andet', 'finans'];
  var POOL = { lager: 1, debitor: 1, igang: 1 };
  function num(s) {
    if (s == null) return NaN; s = String(s).replace(/[\s\u00a0kr.]*$/i, '').replace(/^\s*kr\.?\s*/i, '').replace(/[\s\u00a0]/g, '');
    if (s === '') return NaN;
    if (/^[-+]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^[-+]?\d+,\d+$/.test(s)) s = s.replace(',', '.');
    else if (!/^[-+]?\d+(\.\d+)?$/.test(s)) return NaN;
    return Number(s);
  }
  function blank(s) { return s == null || String(s).trim() === ''; }
  function ore(s) { var n = num(s); return isNaN(n) ? NaN : Math.round(n * 100); }
  function opt(s, def) { return blank(s) ? def : ore(s); }
  function calc(input) {
    var c = input.company || {}, assets = input.assets || [], errors = [], warnings = [];
    var year = parseInt(c.year, 10), rate = blank(c.rate) ? RATES[year] : num(c.rate);
    if (rate == null || isNaN(rate) || rate < 0 || rate > 20) errors.push('rate');
    var months = blank(c.months) ? 12 : num(c.months);
    if (isNaN(months) || months < 1 || months > 24 || Math.floor(months) !== months) errors.push('months');
    var pni = opt(c.pni, NaN), nki = opt(c.nki, 0), kred = opt(c.kred, 0);
    if (isNaN(pni)) errors.push('pni'); if (isNaN(nki)) errors.push('nki'); if (isNaN(kred) || kred < 0) errors.push('kred');
    var married = c.married === '1' || c.married === true;
    var spA = married ? opt(c.spA, 0) : 0, spP = married ? opt(c.spP, 0) : 0, spN = married ? opt(c.spN, 0) : 0;
    if (married) { if (isNaN(spA) || spA < 0) errors.push('spA'); if (isNaN(spP)) errors.push('spP'); if (isNaN(spN)) errors.push('spN'); }
    var rows = [], bad = [], pool = 0, own = 0;
    assets.forEach(function (a, i) {
      var e = [], type = TYPES.indexOf(a.type) >= 0 ? a.type : 'andet', v = ore(a.value), pct = blank(a.pct) ? 100 : num(a.pct);
      if (isNaN(v)) e.push('value'); if (isNaN(pct) || pct < 0 || pct > 100) e.push('pct');
      var r = { name: a.name || ('Aktiv ' + (i + 1)), type: type, value: v, pct: pct, included: 0, note: '', errors: e };
      if (!e.length) {
        if (type === 'familie') { r.note = 'familie'; warnings.push({ k: 'familie', n: r.name }); }
        else if (type === 'finans') r.note = 'finans';
        else {
          var base = v; if (type === 'drift' && base < 0) { base = 0; warnings.push({ k: 'negsaldo', n: r.name }); }
          r.included = Math.round(base * pct / 100);
          if (pct < 100) warnings.push({ k: 'blandet', n: r.name });
          if (POOL[type]) { pool += r.included; r.note = 'pool'; } else own += r.included;
        }
      } else bad.push(i);
      rows.push(r);
    });
    if (!rows.length) errors.push('assets');
    if (errors.length || bad.length) return { ok: false, errors: errors, bad: bad, rows: rows };
    var poolNet = Math.max(0, pool - kred);
    if (pool && kred >= pool) warnings.push({ k: 'pool' });
    var grundlag = own + poolNet, total = grundlag + spA;
    var raw = Math.round(total * rate / 100 * months / 12 / 100) * 100;
    var pniTot = pni + spP, nkiTot = nki + spN;
    var capP = Math.max(0, pniTot), capN = Math.max(0, -nkiTot), cap = Math.max(capP, capN);
    var ka = Math.max(0, Math.min(raw, cap));
    var binding = raw > cap ? (capN > capP ? 'nki' : 'pni') : null;
    if (binding) warnings.push({ k: binding === 'nki' ? 'capN' : 'capP' });
    if (capN > capP && !binding && raw > capP) warnings.push({ k: 'useN' });
    if (months !== 12) warnings.push({ k: 'months' });
    if (!blank(c.rate) && RATES[year] != null && num(c.rate) !== RATES[year]) warnings.push({ k: 'rateOverride' });
    if (blank(c.rate) && RATES[year] == null) warnings.push({ k: 'noRate' });
    if (rate === 0) warnings.push({ k: 'zero' });
    var mine = ka, spouse = 0;
    if (married && c.spOwn === '1' && total > 0 && spA > 0) { spouse = Math.round(ka * spA / total / 100) * 100; mine = ka - spouse; }
    if (married) warnings.push({ k: 'spouse' });
    return { ok: true, errors: [], bad: [], rows: rows, warnings: warnings, year: year, rate: rate, months: months,
      own: own, pool: pool, kred: kred, poolNet: poolNet, grundlag: grundlag, spA: spA, total: total, raw: raw,
      pni: pni, nki: nki, pniTot: pniTot, nkiTot: nkiTot, cap: cap, capP: capP, capN: capN, binding: binding, ka: ka, mine: mine, spouse: spouse,
      piAfter: pni - mine, kiAfter: nki + mine, married: married, excluded: rows.filter(function (r) { return r.note === 'familie' || r.note === 'finans'; }).reduce(function (a, r) { return a + r.value; }, 0) };
  }
  function sample() {
    return { company: { name: 'Tømrer Jensen v/ Jens Jensen', cvr: '12345678', year: '2026', rate: '', months: '12', pni: '620.000', nki: '-18.000', kred: '110.000', married: '', spA: '', spP: '', spN: '', spOwn: '' },
      assets: [
        { name: 'Værkstedsbygning', type: 'ejendom', value: '1.850.000', pct: '100' },
        { name: 'Lejlighed udlejet til datter', type: 'familie', value: '2.400.000', pct: '100' },
        { name: 'Driftsmidler (saldo primo)', type: 'drift', value: '310.000', pct: '100' },
        { name: 'Varebil, delvis privat (uafskrevet del)', type: 'drift', value: '200.000', pct: '80' },
        { name: 'Varelager', type: 'lager', value: '90.000', pct: '100' },
        { name: 'Varedebitorer', type: 'debitor', value: '140.000', pct: '100' },
        { name: 'Igangværende arbejde (netto)', type: 'igang', value: '60.000', pct: '100' },
        { name: 'Goodwill (købt, efter afskrivninger)', type: 'immat', value: '250.000', pct: '100' },
        { name: 'Bankindestående', type: 'finans', value: '300.000', pct: '100' }] };
  }
  return { RATES: RATES, TYPES: TYPES, num: num, calc: calc, sample: sample };
});
