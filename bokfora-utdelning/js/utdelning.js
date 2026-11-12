/* Utdelning i aktiebolag (kupongbolag) – fördelning, kupongskatt, frister och bokföring. UMD, no network. Amounts in öre.
   Sources: Skatteverket "För dig som lämnat utdelning från ditt aktiebolag (kupongbolag)", KU31 examples, kupongskattelagen (1970:624) 4–5 §§,
   aktiebolagslagen 17 kap. 3 §, 18 kap. 2–7 §§, SKV 294. BAS 2026: 2091, 2098, 2099, 2898, 2899, 1930.
   Rules: kupongbolag withholds no preliminary tax for Swedish residents; withholds kupongskatt (30 %, lower treaty rate only with
   hemvistintyg = direktnedsättning; never for Switzerland) for begränsat skattskyldiga. SKV 3700 (+18a/18b) per utdelningstillfälle
   within 4 months, but at the latest 15 January if the utdelningstillfälle is after 15 September; kupongskatt paid the same day.
   KU31 by 31 January the year after, for physical persons (resident and non-resident) and resident estates. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UTD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ACCOUNTS = { '2091': 'Balanserad vinst eller förlust', '2098': 'Vinst eller förlust från föregående år', '2099': 'Årets resultat', '2898': 'Outtagen vinstutdelning', '2899': 'Övriga kortfristiga skulder (innehållen kupongskatt)', '1930': 'Företagskonto/checkkonto/affärskonto' };
  var TYPES = ['se-person', 'se-dodsbo', 'se-ab', 'fo-person', 'fo-ab'];
  /* which forms each recipient type needs (Skatteverket, kupongbolag) */
  var FORMS = { 'se-person': ['KU31'], 'se-dodsbo': ['KU31'], 'se-ab': ['18a'], 'fo-person': ['18b', 'KU31'], 'fo-ab': ['18b'] };
  var KUPONG = 30;
  function num(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).trim().replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(',', '.'); if (s === '') return 0; return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN; }
  function blank(v) { return String(v == null ? '' : v).trim() === ''; }
  function ore(x) { return Math.round(x * 100); }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  function iso(d) { return d.toISOString().slice(0, 10); }
  /* date + n months; day clamped to the month's last day */
  function addMonths(s, n) {
    var y = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + n, d = +s.slice(8, 10);
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return iso(new Date(Date.UTC(y, m, Math.min(d, last))));
  }
  /* SKV 3700 (and kupongskatt payment) deadline for an utdelningstillfälle */
  function skv3700Deadline(s) {
    var md = s.slice(5);
    if (md > '09-15') return (+s.slice(0, 4) + 1) + '-01-15';
    return addMonths(s, 4);
  }
  function ku31Deadline(s) { return (+s.slice(0, 4) + 1) + '-01-31'; }
  /* split total öre over shares with the largest-remainder method so the parts add up exactly */
  function split(total, shares) {
    var sum = shares.reduce(function (a, b) { return a + b; }, 0), base = [], rest = 0;
    var parts = shares.map(function (s, i) { var exact = total * s / sum, f = Math.floor(exact); base.push(f); rest += f; return { i: i, r: exact - f }; });
    var left = total - rest; parts.sort(function (a, b) { return b.r - a.r || a.i - b.i; });
    for (var k = 0; k < left; k++) base[parts[k].i]++;
    return base;
  }
  function merge(trans) {
    var m = {}, order = [];
    trans.forEach(function (t) { if (!(t.konto in m)) { m[t.konto] = 0; order.push(t.konto); } m[t.konto] += t.amount; });
    return order.map(function (k) { return { konto: k, amount: m[k] }; }).filter(function (t) { return t.amount !== 0; });
  }
  /* st: { company:{ name, orgnr, stamma:'ars'|'extra', date, payDate, balansdag, fritt, tidigare, arsres, ek, bo, mode:'per'|'total', per, total,
                    from, pay, serie, nr, ksDate, place, chair, secretary, adjuster, board, auditor },
          holders:[{ name, id, type, shares, fam:'1'|'', rate }] } */
  function calc(st) {
    var c = st.company || {}, errors = [], warnings = [], hErr = [];
    var stamma = c.stamma === 'extra' ? 'extra' : 'ars';
    if (!validDate(c.date)) errors.push('date');
    var payDate = blank(c.payDate) ? c.date : c.payDate;
    if (!blank(c.payDate) && (!validDate(c.payDate) || (validDate(c.date) && c.payDate < c.date))) errors.push('payDate');
    if (!blank(c.balansdag) && !validDate(c.balansdag)) errors.push('balansdag');
    var fritt = num(c.fritt), tidigare = num(c.tidigare), arsres = num(c.arsres), ek = num(c.ek), bo = num(c.bo);
    if (isNaN(fritt) || blank(c.fritt)) errors.push('fritt');
    if (isNaN(tidigare) || tidigare < 0) errors.push('tidigare');
    if (isNaN(arsres)) errors.push('arsres');
    if (isNaN(ek)) errors.push('ek'); if (isNaN(bo) || bo < 0) errors.push('bo');
    var mode = c.mode === 'total' ? 'total' : 'per', per = num(c.per), totalIn = num(c.total);
    if (mode === 'per' && (isNaN(per) || !(per > 0))) errors.push('per');
    if (mode === 'total' && (isNaN(totalIn) || !(totalIn > 0))) errors.push('total');
    var holders = (st.holders || []).map(function (h, i) {
      var e = [], shares = num(h.shares), type = TYPES.indexOf(h.type) >= 0 ? h.type : 'se-person', foreign = type.slice(0, 2) === 'fo';
      if (!(shares >= 1) || Math.round(shares) !== shares) e.push('shares');
      if (blank(h.name)) e.push('name');
      var rate = foreign ? (blank(h.rate) ? KUPONG : num(h.rate)) : 0;
      if (foreign && (isNaN(rate) || rate < 0 || rate > 30)) e.push('rate');
      if (e.length) hErr.push(i);
      return { i: i, name: String(h.name || '').trim(), id: String(h.id || '').trim(), type: type, foreign: foreign, shares: shares, fam: !!h.fam && h.fam !== '0' && (type === 'se-person' || type === 'fo-person'), rate: rate, errors: e, forms: FORMS[type] };
    });
    if (!holders.length) errors.push('holders');
    if (errors.length || hErr.length) return { ok: false, errors: errors, bad: hErr, holders: holders };
    var shares = holders.map(function (h) { return h.shares; }), totShares = shares.reduce(function (a, b) { return a + b; }, 0), amounts, total, perShare;
    if (mode === 'per') { amounts = shares.map(function (s) { return Math.round(s * per * 100); }); total = amounts.reduce(function (a, b) { return a + b; }, 0); perShare = per; }
    else { total = ore(totalIn); amounts = split(total, shares); perShare = totalIn / totShares; }
    var T = { total: total, kupong: 0, net: 0, ku31: 0, a18: 0, b18: 0, se: 0, fo: 0, nKU31: 0, n18a: 0, n18b: 0, shares: totShares };
    holders.forEach(function (h, i) {
      h.amount = amounts[i]; h.kupong = h.foreign ? Math.round(h.amount * h.rate / 100) : 0; h.net = h.amount - h.kupong; h.pct = h.shares / totShares;
      T.kupong += h.kupong; T.net += h.net;
      if (h.forms.indexOf('KU31') >= 0) { T.ku31 += h.amount; T.nKU31++; }
      if (h.forms.indexOf('18a') >= 0) { T.a18 += h.amount; T.n18a++; }
      if (h.forms.indexOf('18b') >= 0) { T.b18 += h.amount; T.n18b++; }
      if (h.foreign) T.fo += h.amount; else T.se += h.amount;
      if (h.foreign && h.rate < KUPONG) warnings.push({ k: h.type === 'fo-ab' && h.rate === 0 ? 'exempt' : 'treaty', n: i + 1 });
      if (h.type === 'se-person' && !h.fam) warnings.push({ k: 'fam', n: i + 1 });
    });
    var disp = ore(fritt) - ore(tidigare), left = disp - total, overLimit = left < 0;
    var tillfalle = payDate, dl3700 = skv3700Deadline(tillfalle), dlKU31 = ku31Deadline(tillfalle);
    var sol = null;
    if (ek > 0 && bo > 0) { var E = ore(ek), B = ore(bo); sol = { before: E / B, after: B - total > 0 ? (E - total) / (B - total) : 0 }; if (E - total < 0) warnings.push({ k: 'ek', n: 0 }); }
    if (stamma === 'extra' && !blank(c.arsres) && arsres !== 0) warnings.push({ k: 'arsres-extra', n: 0 });
    /* vouchers */
    var from = /^\d{4}$/.test(c.from || '') ? c.from : '2091', pay = /^\d{4}$/.test(c.pay || '') ? c.pay : '1930';
    var serie = String(c.serie || 'A').trim() || 'A', nr = Math.max(1, parseInt(c.nr, 10) || 1), vouchers = [];
    var t1 = [];
    if (stamma === 'ars' && arsres) { t1.push({ konto: '2099', amount: ore(arsres) }); t1.push({ konto: '2091', amount: -ore(arsres) }); }
    t1.push({ konto: from, amount: total }); t1.push({ konto: '2898', amount: -total });
    vouchers.push({ serie: serie, nr: nr, date: c.date, text: (stamma === 'ars' ? 'Resultatdisposition och utdelning enligt årsstämma ' : 'Vinstutdelning enligt extra bolagsstämma ') + c.date, trans: merge(t1) });
    var t2 = [{ konto: '2898', amount: total }, { konto: pay, amount: -T.net }];
    if (T.kupong) t2.push({ konto: '2899', amount: -T.kupong });
    vouchers.push({ serie: serie, nr: nr + 1, date: payDate, text: 'Utbetalning av utdelning ' + payDate, trans: t2 });
    var ksDate = validDate(c.ksDate) ? c.ksDate : payDate;
    if (T.kupong) vouchers.push({ serie: serie, nr: nr + 2, date: ksDate, text: 'Kupongskatt till Skatteverket bg 5926-1545', trans: [{ konto: '2899', amount: T.kupong }, { konto: pay, amount: -T.kupong }] });
    var accounts = {}; vouchers.forEach(function (v) { v.trans.forEach(function (t) { accounts[t.konto] = ACCOUNTS[t.konto] || ('Konto ' + t.konto); }); });
    return { ok: true, stamma: stamma, holders: holders, totals: T, perShare: perShare, mode: mode, disp: disp, left: left, overLimit: overLimit, fritt: ore(fritt), tidigare: ore(tidigare), arsres: ore(arsres),
      tillfalle: tillfalle, payDate: payDate, dl3700: dl3700, dlKU31: dlKU31, sol: sol, warnings: warnings, vouchers: vouchers, accounts: accounts, from: from, pay: pay };
  }
  /* KU31 rows (one per physical person / resident estate) – field codes from Skatteverket's KU31 examples */
  function ku31Rows(r, c) {
    var out = [], spec = 0;
    r.holders.forEach(function (h) {
      if (h.forms.indexOf('KU31') < 0) return; spec++;
      out.push({ f570: spec, f201: c.orgnr || '', f215: h.foreign ? '' : h.id, f222: h.foreign ? h.id : '', name: h.name, f574: Math.round(h.amount / 100), f571: c.name || '', f061: h.fam ? 'X' : '', f001: '', foreign: h.foreign });
    });
    return out;
  }
  function sample() {
    return { company: { name: 'Exempelbolaget Konsult AB (syntetiskt)', orgnr: '559999-0005', stamma: 'ars', date: '2026-05-20', payDate: '2026-05-27', balansdag: '2025-12-31',
      fritt: '612 400', tidigare: '0', arsres: '386 500', ek: '737 400', bo: '1 420 000', mode: 'per', per: '200', total: '', from: '2091', pay: '1930', serie: 'A', nr: '1', ksDate: '',
      place: 'Göteborg', chair: 'Anna Ek', secretary: 'Anna Ek', adjuster: 'Per Ek', board: 'Anna Ek, Per Ek', auditor: '' },
      holders: [
        { name: 'Anna Ek', id: '19800101-0000', type: 'se-person', shares: '600', fam: '1', rate: '' },
        { name: 'Per Ek', id: '19820202-0000', type: 'se-person', shares: '200', fam: '1', rate: '' },
        { name: 'Ek Holding AB', id: '559999-0006', type: 'se-ab', shares: '150', fam: '', rate: '' },
        { name: 'Lars Ek (bosatt i Tyskland)', id: '19500303-001', type: 'fo-person', shares: '50', fam: '1', rate: '30' }
      ] };
  }
  return { ACCOUNTS: ACCOUNTS, TYPES: TYPES, FORMS: FORMS, KUPONG: KUPONG, num: num, validDate: validDate, addMonths: addMonths, skv3700Deadline: skv3700Deadline, ku31Deadline: ku31Deadline, split: split, calc: calc, ku31Rows: ku31Rows, sample: sample };
});
