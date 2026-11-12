/* Bokföra inköp från EU och utlandet – omvänd moms (reverse charge) and import VAT for Swedish VAT returns. UMD, no network.
   Per invoice: type → momsdeklaration box for the basis (20 EU goods, 21 EU services, 22 non-EU services, 23/24 domestic reverse
   charge goods/services, 50 import of goods), output VAT box (30/31/32, or 60/61/62 for import) and box 48 input VAT.
   Postings (BAS 2026): cost 45xx/44xx (or own cost account) against 2440/1930, input VAT 2645 (2647 domestic) against
   2614/2624/2634 (2615/2625/2635 import). Amounts in öre. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.OMVAND = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RATES = { '25': 0.25, '12': 0.12, '6': 0.06 };
  var TYPES = {
    eu_goods: { box: 20, out: 'rc', inp: '2645', cost: { '25': '4515', '12': '4516', '6': '4517' } },
    eu_service: { box: 21, out: 'rc', inp: '2645', cost: { '25': '4535', '12': '4536', '6': '4537' } },
    noneu_service: { box: 22, out: 'rc', inp: '2645', cost: { '25': '4531', '12': '4532', '6': '4533' } },
    se_rc_goods: { box: 23, out: 'rc', inp: '2647', cost: { '25': '4415', '12': '4416', '6': '4417' } },
    se_rc_service: { box: 24, out: 'rc', inp: '2647', cost: { '25': '4425', '12': '4426', '6': '4427' } },
    import_goods: { box: 50, out: 'imp', inp: '2645', cost: { '25': '4545', '12': '4546', '6': '4547' } }
  };
  var OUT = { rc: { '25': '2614', '12': '2624', '6': '2634' }, imp: { '25': '2615', '12': '2625', '6': '2635' } };
  var OUTBOX = { rc: { '25': 30, '12': 31, '6': 32 }, imp: { '25': 60, '12': 61, '6': 62 } };
  var ACCOUNTS = {
    '4415': 'Inköpta varor i Sverige, omvänd betalningsskyldighet, 25 % moms', '4416': 'Inköpta varor i Sverige, omvänd betalningsskyldighet, 12 % moms', '4417': 'Inköpta varor i Sverige, omvänd betalningsskyldighet, 6 % moms',
    '4425': 'Inköpta tjänster i Sverige, omvänd betalningsskyldighet, 25 % moms', '4426': 'Inköpta tjänster i Sverige, omvänd betalningsskyldighet, 12 % moms', '4427': 'Inköpta tjänster i Sverige, omvänd betalningsskyldighet, 6 % moms',
    '4515': 'Inköp av varor från annat EU-land, 25 %', '4516': 'Inköp av varor från annat EU-land, 12 %', '4517': 'Inköp av varor från annat EU-land, 6 %',
    '4531': 'Inköp av tjänster från ett land utanför EU, 25 % moms', '4532': 'Inköp av tjänster från ett land utanför EU, 12 % moms', '4533': 'Inköp av tjänster från ett land utanför EU, 6 % moms',
    '4535': 'Inköp av tjänster från annat EU-land, 25 %', '4536': 'Inköp av tjänster från annat EU-land, 12 %', '4537': 'Inköp av tjänster från annat EU-land, 6 %',
    '4545': 'Import av varor, 25 % moms', '4546': 'Import av varor, 12 % moms', '4547': 'Import av varor, 6 % moms',
    '2614': 'Utgående moms omvänd betalningsskyldighet, 25 %', '2624': 'Utgående moms omvänd betalningsskyldighet, 12 %', '2634': 'Utgående moms omvänd betalningsskyldighet, 6 %',
    '2615': 'Utgående moms import av varor, 25 %', '2625': 'Utgående moms import av varor, 12 %', '2635': 'Utgående moms import av varor, 6 %',
    '2645': 'Beräknad ingående moms på förvärv från utlandet', '2647': 'Ingående moms omvänd betalningsskyldighet varor och tjänster i Sverige',
    '2440': 'Leverantörsskulder', '1930': 'Företagskonto/checkkonto/affärskonto', '5420': 'Programvaror', '6540': 'IT-tjänster', '5410': 'Förbrukningsinventarier', '4010': 'Inköp av varor och material'
  };
  function num(v) { if (typeof v === 'number') return v; var s = String(v == null ? '' : v).trim().replace(/[\s\u00a0]/g, '').replace(/\u2212/g, '-').replace(',', '.'); if (s === '') return 0; return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN; }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  /* r: {date, supplier, text, type, rate:'25'|'12'|'6', amount, cur, fx, extra (import: tull/frakt in the basis), konto (own cost account), pay:'2440'|'1930'}
     opt: {ded: 0–100 (% deduction right)} */
  function invoice(r, opt) {
    opt = opt || {};
    var errors = [], warnings = [], ty = TYPES[r.type] ? r.type : 'eu_service', T = TYPES[ty], rate = RATES[r.rate] ? String(r.rate) : '25';
    var amount = num(r.amount), cur = String(r.cur || 'SEK').toUpperCase().trim() || 'SEK', fx = cur === 'SEK' ? 1 : num(r.fx), extra = ty === 'import_goods' ? num(r.extra) : 0, ded = opt.ded == null || opt.ded === '' ? 100 : num(opt.ded);
    if (!validDate(r.date)) errors.push('date');
    if (isNaN(amount) || amount <= 0) errors.push('amount');
    if (cur !== 'SEK' && (isNaN(fx) || fx <= 0)) errors.push('fx');
    if (isNaN(extra) || extra < 0) errors.push('extra');
    if (r.konto && !/^\d{4}$/.test(String(r.konto).trim())) errors.push('konto');
    if (isNaN(ded) || ded < 0 || ded > 100) errors.push('ded');
    if (errors.length) return { ok: false, errors: errors };
    var sek = Math.round(amount * fx * 100), basis = sek + Math.round(extra * 100), vat = Math.round(basis * RATES[rate]);
    var dedVat = Math.round(vat * ded / 100), nonDed = vat - dedVat;
    var cost = String(r.konto || '').trim() || T.cost[rate], out = OUT[T.out][rate], pay = r.pay === '1930' ? '1930' : '2440';
    var trans = [{ konto: cost, amount: sek }, { konto: pay, amount: -sek }];
    if (dedVat) trans.push({ konto: T.inp, amount: dedVat });
    if (nonDed) trans.push({ konto: cost, amount: nonDed });
    trans.push({ konto: out, amount: -vat });
    if (extra && ty === 'import_goods') warnings.push('extra-later');
    return { ok: true, errors: [], warnings: warnings, date: r.date, supplier: r.supplier || '', text: r.text || '', type: ty, rate: rate, amount: amount, cur: cur, fx: fx, sek: sek, extra: Math.round(extra * 100), basis: basis, vat: vat, dedVat: dedVat, nonDed: nonDed,
      box: T.box, outBox: OUTBOX[T.out][rate], cost: cost, out: out, inp: T.inp, pay: pay, trans: trans };
  }
  function batch(st) {
    var c = st.company || {}, opt = { ded: c.ded }, serie = String(c.serie || 'A').trim() || 'A', nr = Math.max(1, parseInt(c.nr, 10) || 1);
    var rows = (st.items || []).map(function (r) { return invoice(r, opt); });
    var bad = rows.map(function (r, i) { return r.ok ? -1 : i; }).filter(function (i) { return i >= 0; });
    if (bad.length) return { ok: false, bad: bad, rows: rows };
    var boxes = {}; [20, 21, 22, 23, 24, 30, 31, 32, 48, 50, 60, 61, 62].forEach(function (b) { boxes[b] = 0; });
    var T = { sek: 0, vat: 0, dedVat: 0, nonDed: 0, n: rows.length };
    rows.forEach(function (r) { boxes[r.box] += r.basis; boxes[r.outBox] += r.vat; boxes[48] += r.dedVat; T.sek += r.sek; T.vat += r.vat; T.dedVat += r.dedVat; T.nonDed += r.nonDed; });
    var net = boxes[30] + boxes[31] + boxes[32] + boxes[60] + boxes[61] + boxes[62] - boxes[48];
    var vouchers = rows.map(function (r, i) { return { serie: serie, nr: nr + i, date: r.date, text: (r.supplier ? r.supplier + ': ' : '') + (r.text || ('ruta ' + r.box)), trans: r.trans }; });
    vouchers.forEach(function (v) { v.text = v.text.slice(0, 100); });
    var accounts = {}; vouchers.forEach(function (v) { v.trans.forEach(function (t) { accounts[t.konto] = ACCOUNTS[t.konto] || ('Konto ' + t.konto); }); });
    return { ok: true, rows: rows, boxes: boxes, net: net, totals: T, vouchers: vouchers, accounts: accounts };
  }
  function sample() {
    return { company: { name: 'Exempelbolaget Handel AB (syntetiskt)', orgnr: '559999-0004', period: '2026-10', ded: '100', serie: 'A', nr: '1' }, items: [
      { date: '2026-10-03', supplier: 'Annonsplattform Ireland Ltd (syntetiskt)', text: 'Annonser september', type: 'eu_service', rate: '25', amount: '4200', cur: 'SEK', fx: '', extra: '', konto: '', pay: '1930' },
      { date: '2026-10-07', supplier: 'Werkzeug Großhandel GmbH (DE, syntetiskt)', text: 'Verktyg för vidareförsäljning', type: 'eu_goods', rate: '25', amount: '1250', cur: 'EUR', fx: '11,10', extra: '', konto: '', pay: '2440' },
      { date: '2026-10-12', supplier: 'Kirjakustannus Oy (FI, syntetiskt)', text: 'Facklitteratur', type: 'eu_goods', rate: '6', amount: '380', cur: 'EUR', fx: '11,10', extra: '', konto: '', pay: '2440' },
      { date: '2026-10-15', supplier: 'Codetools Inc (US, syntetiskt)', text: 'Programlicens oktober', type: 'noneu_service', rate: '25', amount: '49', cur: 'USD', fx: '10,40', extra: '', konto: '5420', pay: '1930' },
      { date: '2026-10-20', supplier: 'Shenzhen Parts Ltd (CN, syntetiskt)', text: 'Komponenter, import', type: 'import_goods', rate: '25', amount: '900', cur: 'USD', fx: '10,40', extra: '640', konto: '', pay: '2440' },
      { date: '2026-10-28', supplier: 'Byggfirma Exempel AB (syntetiskt)', text: 'Ombyggnad lager, omvänd moms bygg', type: 'se_rc_service', rate: '25', amount: '20000', cur: 'SEK', fx: '', extra: '', konto: '', pay: '2440' }
    ] };
  }
  return { RATES: RATES, TYPES: TYPES, OUT: OUT, OUTBOX: OUTBOX, ACCOUNTS: ACCOUNTS, num: num, invoice: invoice, batch: batch, sample: sample };
});
