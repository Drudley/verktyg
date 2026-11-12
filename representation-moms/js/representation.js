/* Representation – avdragsgill moms och kostnad per tillfälle (Skatteverket 2026). Amounts in, results in öre. UMD, no network.
   VAT: underlag max 300 kr ex moms per person (meals, enklare förtäring, gifts per gift), 180 kr for theatre/golf and
   kringkostnader vid personalfest. Mixed rates: proportion the cap on actual costs (main rule) or schablon 46 kr (12 + 25 %)
   / 33 kr (6 + 25 %, also three rates) per person when cost ≥ 300 kr ex moms per person and charged VAT ≥ the schablon.
   Income tax: meals 0; enklare förtäring ≤ 60 kr per person (otherwise nothing); activities 180 kr; gifts 300 kr per gift. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.REPR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ACCOUNTS = { '6071': 'Representation, avdragsgill', '6072': 'Representation, ej avdragsgill', '7631': 'Personalrepresentation, avdragsgill', '7632': 'Personalrepresentation, ej avdragsgill', '2641': 'Debiterad ingående moms', '1930': 'Företagskonto/checkkonto/affärskonto', '2890': 'Övriga kortfristiga skulder', '2893': 'Skulder till närstående personer, kortfristig del' };
  var CAP_VAT = { meal: 300, simple: 300, activity: 180, gift: 300 };
  var SIMPLE_MAX = 60, ACT_MAX = 180, GIFT_MAX = 300, SCH12 = 46, SCH6 = 33;
  function num(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).trim().replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(',', '.'); if (s === '') return 0; return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN; }
  function ore(x) { return Math.round(x * 100); }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  /* o: {date, kind:'extern'|'intern', type:'meal'|'simple'|'activity'|'gift', purpose, people, n, r25, r12, r6, method:'auto'|'prop'|'schablon'}
     opt: {moms: true|false} */
  function occasion(o, opt) {
    opt = opt || {};
    var n = Math.round(num(o.n)), r25 = num(o.r25), r12 = num(o.r12), r6 = num(o.r6), errors = [], warnings = [];
    if (!validDate(o.date)) errors.push('date');
    if (!(n >= 1)) errors.push('n');
    [['r25', r25], ['r12', r12], ['r6', r6]].forEach(function (p) { if (isNaN(p[1]) || p[1] < 0) errors.push(p[0]); });
    var type = CAP_VAT[o.type] ? o.type : 'meal', kind = o.kind === 'intern' ? 'intern' : 'extern';
    if (errors.length) return { ok: false, errors: errors };
    var ex25 = ore(r25), ex12 = ore(r12), ex6 = ore(r6), ex = ex25 + ex12 + ex6;
    var v25 = Math.round(ex25 * 0.25), v12 = Math.round(ex12 * 0.12), v6 = Math.round(ex6 * 0.06), vat = v25 + v12 + v6, total = ex + vat;
    var capPer = CAP_VAT[type], cap = capPer * 100 * n, basis = Math.min(ex, cap);
    var prop = ex ? Math.round(basis * (ex25 * 0.25 + ex12 * 0.12 + ex6 * 0.06) / ex) : 0;
    var perPerson = ex / n / 100, schablon = null;
    var isFood = type === 'meal' || type === 'simple';
    if (isFood && ex25 > 0 && (ex12 > 0 || ex6 > 0) && perPerson >= 300) {
      var s = ex6 > 0 ? SCH6 : SCH12;
      if (vat >= s * 100 * n) schablon = { per: s, amount: s * 100 * n };
    }
    var method = 'prop', dedVat = prop;
    if (ex <= cap) method = 'full';
    else if (o.method === 'schablon' && schablon) { method = 'schablon'; dedVat = schablon.amount; }
    else if (o.method !== 'prop' && schablon && schablon.amount > prop) { method = 'schablon'; dedVat = schablon.amount; }
    if (o.method === 'schablon' && !schablon && ex > cap) warnings.push('no-schablon');
    if (opt.moms === false) { dedVat = 0; method = 'none'; }
    dedVat = Math.min(dedVat, vat);
    var dedCost = 0;
    if (type === 'simple') { if (perPerson <= SIMPLE_MAX && !ex25) dedCost = ex; else warnings.push(ex25 ? 'simple-alcohol' : 'simple-over'); }
    else if (type === 'activity') dedCost = Math.min(ex, ACT_MAX * 100 * n);
    else if (type === 'gift') { dedCost = Math.min(ex, GIFT_MAX * 100 * n); if (kind === 'intern') warnings.push('gift-intern'); }
    if (type === 'meal' && kind === 'intern') warnings.push('party-two');
    var nonDed = total - dedCost - dedVat;
    var kD = kind === 'intern' ? '7631' : '6071', kN = kind === 'intern' ? '7632' : '6072';
    return { ok: true, errors: [], warnings: warnings, date: o.date, kind: kind, type: type, purpose: o.purpose || '', people: o.people || '', n: n, ex: ex, vat: vat, total: total,
      basis: basis, prop: prop, schablon: schablon, method: method, dedVat: dedVat, nonDedVat: vat - dedVat, dedCost: dedCost, nonDed: nonDed, perPerson: perPerson, kD: kD, kN: kN };
  }
  /* st: {company:{name, orgnr, pay, moms:'ja'|'nej', serie, nr}, items:[occasion inputs]} */
  function batch(st) {
    var c = st.company || {}, opt = { moms: c.moms !== 'nej' }, pay = /^\d{4}$/.test(c.pay || '') ? c.pay : '1930';
    var serie = String(c.serie || 'A').trim() || 'A', nr = Math.max(1, parseInt(c.nr, 10) || 1);
    var rows = (st.items || []).map(function (o) { return occasion(o, opt); });
    var bad = rows.map(function (r, i) { return r.ok ? -1 : i; }).filter(function (i) { return i >= 0; });
    if (bad.length) return { ok: false, bad: bad, rows: rows };
    var T = { ex: 0, vat: 0, total: 0, dedVat: 0, dedCost: 0, nonDed: 0, n: rows.length };
    rows.forEach(function (r) { ['ex', 'vat', 'total', 'dedVat', 'dedCost', 'nonDed'].forEach(function (k) { T[k] += r[k]; }); });
    var vouchers = rows.map(function (r, i) {
      var tr = [];
      if (r.dedCost) tr.push({ konto: r.kD, amount: r.dedCost });
      if (r.nonDed) tr.push({ konto: r.kN, amount: r.nonDed });
      if (r.dedVat) tr.push({ konto: '2641', amount: r.dedVat });
      tr.push({ konto: pay, amount: -r.total });
      return { serie: serie, nr: nr + i, date: r.date, text: ('Representation: ' + (r.purpose || r.type)).slice(0, 100), trans: tr };
    });
    var accounts = {}; vouchers.forEach(function (v) { v.trans.forEach(function (t) { accounts[t.konto] = ACCOUNTS[t.konto] || ('Konto ' + t.konto); }); });
    return { ok: true, rows: rows, totals: T, vouchers: vouchers, accounts: accounts, pay: pay };
  }
  function sample() {
    return { company: { name: 'Exempelbolaget Konsult AB (syntetiskt)', orgnr: '559999-0003', pay: '1930', moms: 'ja', serie: 'A', nr: '1' }, items: [
      { date: '2026-09-15', kind: 'extern', type: 'meal', purpose: 'Affärsmiddag – förhandling om ramavtal', people: 'Anna Ek (vi), Per Lund och Sara Berg (Kundbolaget AB)', n: '3', r25: '600', r12: '900', r6: '', method: 'auto' },
      { date: '2026-10-02', kind: 'extern', type: 'activity', purpose: 'Greenfee med kund efter avtalsmöte', people: 'Anna Ek (vi), Per Lund, Olle Ström (Kundbolaget AB)', n: '3', r25: '', r12: '', r6: '1950', method: 'auto' },
      { date: '2026-10-20', kind: 'intern', type: 'simple', purpose: 'Fika vid avdelningsmöte', people: 'Hela kontoret, 8 personer', n: '8', r25: '', r12: '', r6: '400', method: 'auto' },
      { date: '2026-11-05', kind: 'extern', type: 'gift', purpose: 'Blommor till kundens 30-årsjubileum', people: 'Kundbolaget AB', n: '1', r25: '650', r12: '', r6: '', method: 'auto' },
      { date: '2026-12-11', kind: 'intern', type: 'meal', purpose: 'Julbord – personalfest', people: 'Alla anställda, 10 personer', n: '10', r25: '1500', r12: '5000', r6: '', method: 'auto' }
    ] };
  }
  return { ACCOUNTS: ACCOUNTS, CAP_VAT: CAP_VAT, SCH12: SCH12, SCH6: SCH6, num: num, occasion: occasion, batch: batch, sample: sample };
});
