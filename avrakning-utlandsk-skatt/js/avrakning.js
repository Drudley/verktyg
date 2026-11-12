/* Avräkning av utländsk skatt i aktiebolag – spärrbelopp, avräkning, sparad skatt (carry forward). UMD, no network. Amounts in öre.
   Law: lag (1986:468) om avräkning av utländsk skatt 2 kap. 7–10, 13, 15, 17 §§; inkomstskattelagen 1 kap. 7 § (avrundning nedåt till helt
   tiotal kronor), 65 kap. 10 § (20,6 % statlig inkomstskatt för juridiska personer), 16 kap. 18–19 §§ (avdrag i stället för avräkning).
   - Avräkningsbar skatt per utdelning = dragen skatt, högst avtalets skattesats × bruttoutdelning (överskjutande del söks tillbaka i källlandet).
   - Spärrbelopp = statlig skatt × utländsk nettoinkomst / sammanlagd inkomst, beräknat som om periodiseringsfondsavsättning/återföring (13 §)
     och avdrag för utländsk skatt (9 § andra st.) inte gjorts; minst 500 kr, högst bolagets statliga inkomstskatt (9 §).
   - Avräkningsbar skatt minskas med skattesänkningen av ett gjort avdrag (15 §).
   - Sparad skatt från de fem föregående åren avräknas först, äldst först; årets överskjutande skatt sparas till och med år + 5 (17 §). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AVR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RATE = 0.206, MIN_SPARR = 50000;
  var ACCOUNTS = { '8212': 'Utdelningar, andra företag', '8210': 'Utdelningar på andelar i andra företag', '8340': 'Utdelningar på kortfristiga placeringar', '6996': 'Betald utländsk inkomstskatt', '1680': 'Andra kortfristiga fordringar (källskatt att återsöka)', '1930': 'Företagskonto/checkkonto/affärskonto' };
  function num(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).trim().replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(',', '.'); if (s === '') return 0; return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN; }
  function blank(v) { return String(v == null ? '' : v).trim() === ''; }
  function ore(x) { return Math.round(x * 100); }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  /* statlig inkomstskatt in öre on an income in öre: income rounded down to whole tens of kronor (IL 1:7, legal persons), × 20,6 % */
  function tax(incOre) { if (incOre <= 0) return 0; var base = Math.floor(incOre / 1000) * 10; return Math.round(base * RATE * 100); }
  /* st: { company:{ name, orgnr, end (YYYY-MM-DD, räkenskapsårets slut), overskott, pfAvs, pfAter, costs, deducted, cf1..cf5, divKonto, pay, serie, nr },
           rows:[{ date, payer, country, cur, gross, withheld, kurs, treaty }] } */
  function calc(st) {
    var c = st.company || {}, errors = [], warnings = [], bad = [];
    if (!validDate(c.end)) errors.push('end');
    var year = validDate(c.end) ? +c.end.slice(0, 4) : 0;
    var nums = {};
    ['overskott', 'pfAvs', 'pfAter', 'costs', 'deducted', 'cf1', 'cf2', 'cf3', 'cf4', 'cf5'].forEach(function (k) { var v = num(c[k]); if (isNaN(v) || (k !== 'overskott' && v < 0)) errors.push(k); nums[k] = isNaN(v) ? 0 : ore(v); });
    if (blank(c.overskott)) errors.push('overskott');
    var rows = (st.rows || []).map(function (o, i) {
      var e = [], gross = num(o.gross), w = num(o.withheld), kurs = blank(o.kurs) ? 1 : num(o.kurs), treaty = blank(o.treaty) ? 15 : num(o.treaty);
      if (!validDate(o.date)) e.push('date');
      if (!(gross > 0)) e.push('gross');
      if (isNaN(w) || w < 0 || w > gross) e.push('withheld');
      if (!(kurs > 0)) e.push('kurs');
      if (isNaN(treaty) || treaty < 0 || treaty > 100) e.push('treaty');
      if (e.length) bad.push(i);
      var r = { i: i, date: o.date, payer: String(o.payer || '').trim(), country: String(o.country || '').trim().toUpperCase(), cur: String(o.cur || 'SEK').trim().toUpperCase() || 'SEK', gross: gross, withheld: w, kurs: kurs, treaty: treaty, errors: e };
      if (!e.length) {
        r.grossSEK = ore(gross * kurs); r.wSEK = ore(w * kurs); r.cap = Math.round(r.grossSEK * treaty / 100);
        r.avr = Math.min(r.wSEK, r.cap); r.excess = r.wSEK - r.avr; r.wPct = gross ? w / gross * 100 : 0;
        if (r.excess > 0) warnings.push({ k: 'reclaim', n: i + 1 });
        if (year && +o.date.slice(0, 4) > year) warnings.push({ k: 'after', n: i + 1 });
      }
      return r;
    });
    if (!rows.length) errors.push('rows');
    if (errors.length || bad.length) return { ok: false, errors: errors, bad: bad, rows: rows };
    var gross = 0, w = 0, avr = 0, excess = 0;
    rows.forEach(function (r) { gross += r.grossSEK; w += r.wSEK; avr += r.avr; excess += r.excess; });
    var net = Math.max(0, gross - nums.costs);
    var actualTax = tax(nums.overskott);
    var incAdj = nums.overskott + nums.pfAvs - nums.pfAter + nums.deducted, taxAdj = tax(incAdj);
    var share = incAdj > 0 ? Math.min(1, net / incAdj) : 0;
    var sparrRaw = Math.round(taxAdj * share), sparr = Math.min(Math.max(MIN_SPARR, sparrRaw), actualTax);
    var red15 = Math.round(nums.deducted * RATE), avrYear = Math.max(0, avr - red15);
    /* carry forward: cf1 = year−5 (oldest) … cf5 = year−1 */
    var cf = [1, 2, 3, 4, 5].map(function (k) { return { year: year - 6 + k, amount: nums['cf' + k], used: 0 }; });
    var room = sparr;
    cf.forEach(function (x) { x.used = Math.min(x.amount, room); room -= x.used; });
    var usedCurrent = Math.min(avrYear, room); room -= usedCurrent;
    var cfUsed = cf.reduce(function (a, x) { return a + x.used; }, 0), credit = cfUsed + usedCurrent;
    var saveCurrent = avrYear - usedCurrent;
    var carryOut = cf.filter(function (x) { return x.amount - x.used > 0 && x.year > year - 5; }).map(function (x) { return { year: x.year, amount: x.amount - x.used, until: x.year + 5 }; });
    var expiring = cf[0].amount - cf[0].used; /* year−5: last year it may be used */
    if (saveCurrent > 0) carryOut.push({ year: year, amount: saveCurrent, until: year + 5 });
    if (actualTax === 0) warnings.push({ k: 'loss', n: 0 });
    if (expiring > 0) warnings.push({ k: 'expire', n: 0, amount: expiring, year: cf[0].year });
    var dedValue = Math.round(avr * RATE);
    /* vouchers: one per dividend */
    var divKonto = /^\d{4}$/.test(c.divKonto || '') ? c.divKonto : '8212', pay = /^\d{4}$/.test(c.pay || '') ? c.pay : '1930';
    var serie = String(c.serie || 'A').trim() || 'A', nr = Math.max(1, parseInt(c.nr, 10) || 1);
    var vouchers = rows.map(function (r, i) {
      var t = [{ konto: pay, amount: r.grossSEK - r.wSEK }];
      if (r.avr) t.push({ konto: '6996', amount: r.avr });
      if (r.excess) t.push({ konto: '1680', amount: r.excess });
      t.push({ konto: divKonto, amount: -r.grossSEK });
      return { serie: serie, nr: nr + i, date: r.date, text: ('Utdelning ' + (r.payer || '') + (r.country ? ' (' + r.country + ')' : '') + ' med källskatt').replace(/\s+/g, ' ').slice(0, 100), trans: t.filter(function (x) { return x.amount !== 0; }) };
    });
    var accounts = {}; vouchers.forEach(function (v) { v.trans.forEach(function (t) { accounts[t.konto] = ACCOUNTS[t.konto] || ('Konto ' + t.konto); }); });
    return { ok: true, year: year, rows: rows, totals: { gross: gross, withheld: w, avr: avr, excess: excess, costs: nums.costs, net: net },
      overskott: nums.overskott, pfAvs: nums.pfAvs, pfAter: nums.pfAter, deducted: nums.deducted, actualTax: actualTax, incAdj: incAdj, taxAdj: taxAdj, share: share, sparrRaw: sparrRaw, sparr: sparr,
      red15: red15, avrYear: avrYear, cf: cf, cfUsed: cfUsed, usedCurrent: usedCurrent, credit: credit, saveCurrent: saveCurrent, carryOut: carryOut, dedValue: dedValue, addBack: avr,
      warnings: warnings, vouchers: vouchers, accounts: accounts };
  }
  function sample() {
    return { company: { name: 'Exempelbolaget Invest AB (syntetiskt)', orgnr: '559999-0007', end: '2026-12-31', overskott: '40 000', pfAvs: '10 000', pfAter: '0', costs: '2 400', deducted: '0', cf1: '', cf2: '', cf3: '1 200', cf4: '', cf5: '', divKonto: '8212', pay: '1930', serie: 'A', nr: '1' },
      rows: [
        { date: '2026-02-15', payer: 'Microsoft Corp', country: 'US', cur: 'USD', gross: '1 200', withheld: '180', kurs: '10,50', treaty: '15' },
        { date: '2026-03-25', payer: 'Nordea Bank Abp', country: 'FI', cur: 'EUR', gross: '2 000', withheld: '700', kurs: '11,20', treaty: '15' },
        { date: '2026-04-20', payer: 'Nestlé SA', country: 'CH', cur: 'CHF', gross: '600', withheld: '210', kurs: '12,00', treaty: '15' },
        { date: '2026-05-10', payer: 'Equinor ASA', country: 'NO', cur: 'NOK', gross: '8 000', withheld: '2 000', kurs: '0,98', treaty: '15' },
        { date: '2026-06-02', payer: 'Novo Nordisk A/S', country: 'DK', cur: 'DKK', gross: '5 000', withheld: '1 350', kurs: '1,50', treaty: '15' }
      ] };
  }
  return { RATE: RATE, MIN_SPARR: MIN_SPARR, ACCOUNTS: ACCOUNTS, num: num, tax: tax, calc: calc, sample: sample };
});
