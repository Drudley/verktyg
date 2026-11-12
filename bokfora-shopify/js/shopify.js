/* Shopify Payments → SIE – parsing and booking core (no DOM). UMD: window.SHOPIFY / require('./shopify.js').
   Input: the Shopify Payments transactions export (Finance > Payouts > Export; columns per help.shopify.com
   "Viewing and exporting your Shopify Payments payout details": Transaction Date, Type, Order, Card Brand, Card Source,
   Payout Status, Payout Date, Available On, Amount, Fee, Net; real exports add Checkout, Payment Method Name,
   Presentment Amount, Presentment Currency, Currency and (2026) Payout ID). Net = Amount − Fee.
   Booking (gross method, one voucher per payout): every row → clearing 1686 +net; sales −gross split into net sales and
   output VAT; fee +fee (6040); refunds reverse sales/VAT; disputes → 1680; reserves → 1689; other types → 1689 + warning;
   bank D / clearing C = Σ net of the payout. Fees: Shopify Payments fees for EU stores outside Ireland carry 0 % VAT with
   reverse charge (help.shopify.com "Viewing your Shopify Payments payout fees") → optional D 2645 / C 2614, 25 %.
   Requires window.CSV (csv.js) in the browser or require('./csv.js') in node. All amounts in öre (integers). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./csv.js')); else root.SHOPIFY = f(root.CSV); })(this, function (CSV) {
  'use strict';
  var ACCOUNTS = { '1686': 'Fordringar för kontokort och kuponger', '1680': 'Andra kortfristiga fordringar', '1689': 'Övriga kortfristiga fordringar', '1930': 'Företagskonto', '3001': 'Försäljning inom Sverige, 25 % moms', '3002': 'Försäljning inom Sverige, 12 % moms', '3003': 'Försäljning inom Sverige, 6 % moms', '3004': 'Försäljning inom Sverige, momsfri',
    '2611': 'Utgående moms på försäljning inom Sverige, 25 %', '2621': 'Utgående moms på försäljning inom Sverige, 12 %', '2631': 'Utgående moms på försäljning inom Sverige, 6 %', '6040': 'Kontokortsavgifter', '2614': 'Utgående moms omvänd betalningsskyldighet, 25 %', '2645': 'Beräknad ingående moms på förvärv från utlandet' };
  var VATACC = { 25: '2611', 12: '2621', 6: '2631', 0: '' }, SALESACC = { 25: '3001', 12: '3002', 6: '3003', 0: '3004' };
  // Type names: official REST balance-transaction types (shopify.dev admin-rest Transactions: charge, refund, dispute,
  // reserve, adjustment, credit, debit, payout, payout_failure, payout_cancellation; examples also capture, advance) and
  // the GraphQL ShopifyPaymentsTransactionType enum (CHARGE, REFUND, DISPUTE_WITHDRAWAL, RESERVED_FUNDS, TRANSFER, …),
  // matched case-insensitively. sale / chargeback / chargeback_won are harmless third-party aliases.
  // Anything not listed (adjustment, credit, debit, lending, Shop Cash, Collective, Markets, …) → 'other' = 1689 + warning.
  var KIND = { charge: 'sale', capture: 'sale', sale: 'sale',
    refund: 'refund', refund_failure: 'refund', refund_adjustment: 'refund',
    dispute: 'dispute', dispute_withdrawal: 'dispute', chargeback: 'dispute', chargeback_hold: 'dispute',
    dispute_reversal: 'dispreverse', chargeback_hold_release: 'dispreverse', chargeback_won: 'dispreverse',
    chargeback_fee: 'feeitem', chargeback_fee_refund: 'feeitem', application_fee_refund: 'feeitem',
    reserve: 'reserve', reserved_funds: 'reserve', reserved_funds_withdrawal: 'reserve', reserved_funds_reversal: 'reserve',
    risk_withdrawal: 'reserve', risk_reversal: 'reserve', advance: 'reserve', advance_funding: 'reserve',
    payout: 'payout', transfer: 'payout',
    payout_failure: 'other', payout_cancellation: 'other', transfer_failure: 'other', transfer_cancel: 'other', transfer_refund: 'other',
    adjustment: 'other', credit: 'other', debit: 'other' };
  function normType(t) { return String(t || '').trim().toLowerCase().replace(/[\s-]+/g, '_'); }
  // Payout Status: help.shopify.com lists Scheduled / Deposited / Failed / Withdrawn (+ Pending for transactions);
  // REST payout_status uses paid / scheduled / pending; GraphQL ShopifyPaymentsPayoutStatus adds FAILED, CANCELED, IN_TRANSIT.
  var PAIDST = { paid: 1, deposited: 1, withdrawn: 1 }, FAILST = { failed: 1, canceled: 1, cancelled: 1 };
  var COLS = { date: ['transaction date', 'date'], type: ['type'], order: ['order'], status: ['payout status'], pdate: ['payout date'], pid: ['payout id'], amount: ['amount'], fee: ['fee'], net: ['net'], currency: ['currency'], vat: ['vat', 'tax'] };
  function iso(s) { var m = /(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? m[1] + '-' + m[2] + '-' + m[3] : ''; }
  function parseText(text) {
    var delim = CSV.detectDelimiter(text), p = CSV.parse(text, delim), H = p.header.map(function (h) { return h.toLowerCase().replace(/^\ufeff/, '').trim(); });
    var idx = {}; Object.keys(COLS).forEach(function (k) { idx[k] = -1; COLS[k].some(function (n) { var i = H.indexOf(n); if (i >= 0) { idx[k] = i; return true; } return false; }); });
    var missing = ['date', 'type', 'amount', 'fee'].filter(function (k) { return idx[k] < 0; });
    if (missing.length) return { ok: false, missing: missing, rows: [], skipped: 0 };
    var dc = delim === ';', rows = [], skipped = 0;
    p.rows.forEach(function (r) {
      if (!r.length || r.every(function (c) { return !String(c).trim(); })) return;
      var g = function (k) { return idx[k] >= 0 ? String(r[idx[k]] == null ? '' : r[idx[k]]).trim() : ''; };
      var date = iso(g('date')), a = CSV.toMinor(g('amount'), dc), fee = CSV.toMinor(g('fee'), dc), net = idx.net >= 0 ? CSV.toMinor(g('net'), dc) : NaN;
      if (!date || isNaN(a) || isNaN(fee)) { skipped++; return; }
      rows.push({ date: date, type: normType(g('type')), order: g('order'), status: g('status').trim().toLowerCase(), pdate: iso(g('pdate')), pid: g('pid'), amount: a, fee: fee, net: isNaN(net) ? a - fee : net, currency: (g('currency') || 'SEK').toUpperCase(), vat: idx.vat >= 0 ? CSV.toMinor(g('vat'), dc) || 0 : 0 });
    });
    return { ok: rows.length > 0, missing: [], rows: rows, skipped: skipped };
  }
  function vatOf(gross, rate) { if (!rate) return 0; var v = gross * rate / (100 + rate); return v < 0 ? -Math.round(-v) : Math.round(v); }
  function acc(s, d) { s = String(s == null ? '' : s).trim(); return /^\d{4}$/.test(s) ? s : d; }
  function build(parsed, opt) {
    opt = opt || {};
    var rate = [25, 12, 6, 0].indexOf(+opt.rate) >= 0 ? +opt.rate : 25;
    var A = { bank: acc(opt.bank, '1930'), clr: acc(opt.clr, '1686'), sales: acc(opt.sales, SALESACC[rate]), vat: acc(opt.vat, VATACC[rate]), refund: acc(opt.refund, ''), fee: acc(opt.fee, '6040'), disp: acc(opt.disp, '1680'), other: acc(opt.other, '1689'), rcOut: '2614', rcIn: '2645' };
    if (rate && !A.vat) A.vat = VATACC[rate];
    var rc = opt.rc !== '' && opt.rc !== '0' && opt.rc !== false, onlyPaid = opt.onlyPaid !== '' && opt.onlyPaid !== '0' && opt.onlyPaid !== false;
    var serie = String(opt.serie || 'A').trim() || 'A', nr0 = parseInt(opt.nr, 10); if (!(nr0 > 0)) nr0 = 1;
    var warn = { currency: {}, netDiff: 0, payoutRows: 0, other: 0, pending: 0, pendingSum: 0, failed: 0, failedSum: 0, dispute: 0, noPayout: 0, feeVat: 0, zero: rate === 0 };
    var groups = {}, order = [];
    (parsed.rows || []).forEach(function (r, i) {
      if (r.currency !== 'SEK') { warn.currency[r.currency] = (warn.currency[r.currency] || 0) + 1; return; }
      var kind = KIND[r.type] || 'other';
      if (kind === 'payout') { warn.payoutRows++; return; }
      if (r.net !== r.amount - r.fee) warn.netDiff++;
      if (r.vat) warn.feeVat++;
      var st = r.status;
      if (st && FAILST[st]) { warn.failed++; warn.failedSum += r.amount - r.fee; return; }
      if (onlyPaid && st && !PAIDST[st]) { warn.pending++; warn.pendingSum += r.amount - r.fee; return; }
      if (!r.pdate) { warn.noPayout++; }
      var key = (r.pid || '') + '|' + (r.pdate || r.date);
      if (!groups[key]) { groups[key] = { key: key, pid: r.pid, date: r.pdate || r.date, rows: [] }; order.push(key); }
      groups[key].rows.push(Object.assign({ kind: kind, i: i }, r));
    });
    order.sort(function (a, b) { return groups[a].date < groups[b].date ? -1 : groups[a].date > groups[b].date ? 1 : 0; });
    var vouchers = [], payouts = [], used = {};
    order.forEach(function (key, n) {
      var g = groups[key], L = {}, s = { n: g.rows.length, sales: 0, refunds: 0, gross: 0, fee: 0, net: 0, vat: 0, salesNet: 0, disputes: 0, reserves: 0, other: 0, rcBase: 0, counts: {} };
      function add(k, v) { if (!v) return; L[k] = (L[k] || 0) + v; used[k] = 1; }
      g.rows.forEach(function (r) {
        var net = r.amount - r.fee; s.counts[r.kind] = (s.counts[r.kind] || 0) + 1;
        add(A.clr, net); add(A.fee, r.fee); s.fee += r.fee; s.rcBase += r.fee; s.net += net; s.gross += r.amount;
        if (r.kind === 'sale' || r.kind === 'refund') {
          var v = vatOf(r.amount, rate); add(r.kind === 'refund' && A.refund ? A.refund : A.sales, -(r.amount - v)); if (v) add(A.vat, -v);
          s.vat += v; s.salesNet += r.amount - v; if (r.kind === 'sale') s.sales += r.amount; else s.refunds += r.amount;
        } else if (r.kind === 'dispute' || r.kind === 'dispreverse') { add(A.disp, -r.amount); s.disputes += r.amount; if (r.kind === 'dispute') warn.dispute++; }
        else if (r.kind === 'feeitem') { add(A.fee, -r.amount); s.fee -= r.amount; }
        else if (r.kind === 'reserve') { add(A.other, -r.amount); s.reserves += r.amount; }
        else { add(A.other, -r.amount); s.other += r.amount; warn.other++; }
      });
      add(A.bank, s.net); add(A.clr, -s.net);
      var rcv = rc ? (s.rcBase < 0 ? -Math.round(-s.rcBase * 0.25) : Math.round(s.rcBase * 0.25)) : 0; if (rcv) { add(A.rcIn, rcv); add(A.rcOut, -rcv); }
      s.rc = rcv;
      var trans = Object.keys(L).filter(function (k) { return L[k] !== 0; }).sort().map(function (k) { return { konto: k, amount: L[k] }; });
      var desc = 'Shopify utbetalning ' + g.date + (g.pid ? ' ' + g.pid : '');
      vouchers.push({ serie: serie, nr: nr0 + n, date: g.date, text: desc, trans: trans });
      payouts.push(Object.assign({ date: g.date, pid: g.pid, nr: serie + (nr0 + n) }, s));
    });
    var tot = payouts.reduce(function (a, p) { ['n', 'sales', 'refunds', 'fee', 'net', 'vat', 'salesNet', 'disputes', 'reserves', 'other', 'rc'].forEach(function (k) { a[k] += p[k]; }); return a; }, { n: 0, sales: 0, refunds: 0, fee: 0, net: 0, vat: 0, salesNet: 0, disputes: 0, reserves: 0, other: 0, rc: 0 });
    var months = {};
    payouts.forEach(function (p) { var m = p.date.slice(0, 7), o = months[m] || (months[m] = { month: m, r05: 0, rVat: 0, r21: 0, r30: 0, r48: 0 }); o.r05 += rate ? p.salesNet : 0; o.rVat += p.vat; o.r21 += rc ? p.rcBase : 0; o.r30 += p.rc; o.r48 += p.rc; });
    var accounts = {}; Object.keys(used).forEach(function (k) { accounts[k] = ACCOUNTS[k] || ('Konto ' + k); });
    if (A.sales !== SALESACC[rate] && !ACCOUNTS[A.sales]) accounts[A.sales] = 'Försäljning';
    return { ok: vouchers.length > 0, rate: rate, A: A, rc: rc, vouchers: vouchers, payouts: payouts, totals: tot, months: Object.keys(months).sort().map(function (k) { return months[k]; }), accounts: accounts, warn: warn,
      from: payouts.length ? payouts[0].date : '', to: payouts.length ? payouts[payouts.length - 1].date : '', vatBox: { 25: '10', 12: '11', 6: '12' }[rate] || '' };
  }
  function sampleCsv() {
    var H = 'Transaction Date,Type,Order,Card Brand,Card Source,Payout Status,Payout Date,Available On,Amount,Fee,Net,Checkout,Payment Method Name,Presentment Amount,Presentment Currency,Currency,Payout ID';
    var R = [
      ['2026-10-01 10:12:40 +0200', 'charge', '#1001', 'visa', 'online', 'paid', '2026-10-06', '2026-10-06', '1250.00', '35.13', '1214.87', '', 'Shopify Payments', '1250.00', 'SEK', 'SEK', '98001'],
      ['2026-10-01 18:40:02 +0200', 'charge', '#1002', 'mastercard', 'online', 'paid', '2026-10-06', '2026-10-06', '499.00', '14.97', '484.03', '', 'Shop Pay', '499.00', 'SEK', 'SEK', '98001'],
      ['2026-10-02 09:05:11 +0200', 'charge', '#1003', 'visa', 'online', 'paid', '2026-10-06', '2026-10-06', '2340.00', '64.62', '2275.38', '', 'Shopify Payments', '204.10', 'EUR', 'SEK', '98001'],
      ['2026-10-02 15:22:30 +0200', 'refund', '#0987', '', '', 'paid', '2026-10-06', '2026-10-06', '-499.00', '0.00', '-499.00', '', 'Shopify Payments', '-499.00', 'SEK', 'SEK', '98001'],
      ['2026-10-05 11:30:00 +0200', 'charge', '#1004', 'amex', 'online', 'paid', '2026-10-09', '2026-10-09', '3100.00', '86.70', '3013.30', '', 'Shopify Payments', '3100.00', 'SEK', 'SEK', '98002'],
      ['2026-10-06 08:14:55 +0200', 'charge', '#1005', 'visa', 'online', 'paid', '2026-10-09', '2026-10-09', '780.00', '22.11', '757.89', '', 'Shop Pay', '780.00', 'SEK', 'SEK', '98002'],
      ['2026-10-06 13:01:09 +0200', 'dispute', '#0950', 'visa', 'online', 'paid', '2026-10-09', '2026-10-09', '-650.00', '150.00', '-800.00', '', 'Shopify Payments', '-650.00', 'SEK', 'SEK', '98002'],
      ['2026-10-09 20:45:00 +0200', 'charge', '#1006', 'visa', 'online', 'pending', '2026-10-13', '2026-10-13', '1500.00', '41.25', '1458.75', '', 'Shopify Payments', '1500.00', 'SEK', 'SEK', '']];
    return [H].concat(R.map(function (r) { return r.join(','); })).join('\n') + '\n';
  }
  return { ACCOUNTS: ACCOUNTS, KIND: KIND, normType: normType, PAIDST: PAIDST, parseText: parseText, build: build, vatOf: vatOf, sampleCsv: sampleCsv };
});
