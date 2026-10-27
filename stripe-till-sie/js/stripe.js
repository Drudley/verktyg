/* Stripe CSV -> balanced bookkeeping vouchers (BAS) -> SIE 4. Runs in browser and Node. Amounts in integer öre.
 * Depends on CSV (csv.js) and SIEW (sie-writer.js). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./csv.js'), require('./sie-writer.js'));
  else root.STRIPE2SIE = factory(root.CSV, root.SIEW);
})(typeof self !== 'undefined' ? self : this, function (CSV, SIEW) {
  'use strict';

  var VERSION = '1.0';
  var DEFAULTS = {
    company: '', orgnr: '',
    grouping: 'payout',          // 'payout' | 'day'
    series: 'A', startNo: 1,
    vatRate: 25,                 // sales VAT %: 25 | 12 | 6 | 0
    reverseCharge: false,        // book reverse-charge VAT (25 %) on Stripe fees (Stripe Payments Europe Ltd, Ireland)
    convertTz: true,             // convert "(UTC)" timestamps to Swedish date (Europe/Stockholm)
    fyStartMonth: 1,             // first month of fiscal year
    acc: {
      clearing: '1580', bank: '1930', sales: '3001', refunds: '', vat: '2611',
      fees: '6570', rcIn: '2645', rcOut: '2614', disputes: '1680', other: '1689'
    },
    names: {
      clearing: 'Fordran Stripe (clearing)', bank: 'Företagskonto', sales: 'Försäljning inom Sverige, 25 % moms', refunds: 'Återbetalningar Stripe',
      vat: 'Utgående moms 25 %', fees: 'Bankkostnader (Stripe-avgifter)', rcIn: 'Beräknad ingående moms, förvärv från utlandet',
      rcOut: 'Utgående moms omvänd skattskyldighet 25 %', disputes: 'Omtvistade kortbetalningar (Stripe)', other: 'Övriga fordringar – Stripe, att utreda'
    }
  };
  var VAT_ACC = { 25: ['2611', 'Utgående moms 25 %'], 12: ['2621', 'Utgående moms 12 %'], 6: ['2631', 'Utgående moms 6 %'], 0: ['2611', 'Utgående moms 25 %'] };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function mergeSettings(s) {
    var d = clone(DEFAULTS); s = s || {};
    Object.keys(d).forEach(function (k) { if (k !== 'acc' && k !== 'names' && s[k] !== undefined && s[k] !== null && s[k] !== '') d[k] = s[k]; });
    ['acc', 'names'].forEach(function (g) { if (s[g]) Object.keys(d[g]).forEach(function (k) { if (s[g][k] !== undefined && s[g][k] !== null) d[g][k] = String(s[g][k]).trim(); }); });
    d.vatRate = Number(d.vatRate); d.startNo = parseInt(d.startNo, 10) || 1; d.fyStartMonth = Math.min(12, Math.max(1, parseInt(d.fyStartMonth, 10) || 1));
    d.reverseCharge = d.reverseCharge === true || d.reverseCharge === 'true'; d.convertTz = !(d.convertTz === false || d.convertTz === 'false');
    return d;
  }
  function validateSettings(s) {
    var errs = [];
    Object.keys(s.acc).forEach(function (k) { var v = s.acc[k]; if (k === 'refunds' && v === '') return; if (!/^\d{4}$/.test(v)) errs.push(k); });
    return errs;
  }

  // ---------- Format detection ----------
  function norm(h) { return String(h).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''); }
  var ALIASES = {
    id: ['balance_transaction_id', 'id', 'balance_transaction'],
    gross: ['gross', 'amount'],
    fee: ['fee', 'fees'],
    net: ['net'],
    currency: ['currency'],
    category: ['reporting_category'],
    type: ['type'],
    created: ['created_utc', 'created_date_utc', 'created', 'created_date'],
    availableOn: ['available_on_utc', 'available_on'],
    payoutId: ['automatic_payout_id', 'payout_id', 'transfer', 'payout'],
    payoutDate: ['automatic_payout_effective_at_utc', 'automatic_payout_effective_at', 'transfer_date_utc', 'payout_date_utc', 'payout_date'],
    description: ['description'],
    source: ['source_id', 'source'],
    cfCurrency: ['customer_facing_currency']
  };
  function detect(header) {
    var nh = header.map(norm), map = {}, utc = {};
    Object.keys(ALIASES).forEach(function (k) {
      for (var i = 0; i < ALIASES[k].length; i++) { var j = nh.indexOf(ALIASES[k][i]); if (j >= 0) { map[k] = j; utc[k] = /utc/.test(ALIASES[k][i]); break; } }
    });
    if (nh.indexOf('count') >= 0 && map.id === undefined) return { error: 'summary' };
    var missing = ['gross', 'net', 'created'].filter(function (k) { return map[k] === undefined; });
    if (map.category === undefined && map.type === undefined) missing.push('reporting_category/Type');
    if (missing.length) return { error: 'columns', missing: missing };
    var format = map.category !== undefined && nh[map.gross] === 'gross' ? 'report' : 'dashboard';
    var label = format === 'report'
      ? (map.payoutId !== undefined && nh[map.payoutId] === 'automatic_payout_id' ? 'Stripe-rapport (Payout reconciliation / Balance change, itemized)' : 'Stripe-rapport (Balance change from activity, itemized)')
      : 'Stripe Dashboard-export (Balance transactions / All activity)';
    return { format: format, label: label, map: map, utc: utc };
  }

  // ---------- Dates ----------
  var tzFmt = null;
  function stockholmDate(ms) {
    if (!tzFmt) tzFmt = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit' });
    var p = {}; tzFmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  /** Returns ISO date (YYYY-MM-DD) or '' if unparseable. isUtc: column is known to be UTC. */
  function toDate(s, isUtc, convert) {
    s = String(s || '').trim();
    if (!s) return '';
    if (/^\d{9,10}$/.test(s)) return convert ? stockholmDate(+s * 1000) : new Date(+s * 1000).toISOString().slice(0, 10);
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(Z|UTC|[+-]\d{2}:?\d{2})?)?$/i);
    if (!m) { m = s.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/); if (!m) return ''; }
    var date = m[1] + '-' + m[2] + '-' + m[3];
    if (!m[4] || !convert) return date;
    var explicitZone = m[7] && !/^(Z|UTC)$/i.test(m[7]);
    if (!isUtc && !m[7]) return date;           // unknown zone: keep as written
    var ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    if (explicitZone) { var z = m[7].replace(':', ''); ms -= (z[0] === '-' ? -1 : 1) * (parseInt(z.slice(1, 3), 10) * 60 + parseInt(z.slice(3, 5), 10)) * 60000; }
    return stockholmDate(ms);
  }

  // ---------- Categories ----------
  var TYPE_TO_CAT = {
    charge: 'charge', payment: 'charge', refund: 'refund', payment_refund: 'refund', refund_failure: 'refund_failure',
    payment_failure_refund: 'refund', payment_reversal: 'refund', stripe_fee: 'fee', stripe_fx_fee: 'fee', tax_fee: 'tax',
    payout: 'payout', payout_cancel: 'payout_reversal', payout_failure: 'payout_reversal', topup: 'topup', topup_reversal: 'topup_reversal',
    application_fee: 'platform_earning', application_fee_refund: 'platform_earning_refund', transfer: 'transfer', reserved_funds: 'risk_reserved_funds'
  };
  function categoryFor(cat, type, gross, source, desc) {
    if (cat) return cat.toLowerCase();
    var t = String(type || '').toLowerCase().replace(/\s+/g, '_');
    if (t === 'adjustment') {
      if (/^du_|^dp_/.test(source) || /dispute|chargeback|tvist/i.test(desc)) return gross < 0 ? 'dispute' : 'dispute_reversal';
      if (/refund/i.test(desc)) return 'refund_failure';
      if (/fee|avgift/i.test(desc)) return 'fee';
      return 'other_adjustment';
    }
    return TYPE_TO_CAT[t] || t || 'other_adjustment';
  }
  /** Booking role for a reporting category. */
  function roleFor(cat) {
    switch (cat) {
      case 'charge': return 'sales';
      case 'refund': case 'partial_capture_reversal': case 'refund_failure': return 'refunds';
      case 'fee': case 'network_cost': case 'tax': return 'fees';
      case 'payout': case 'payout_reversal': case 'topup': case 'topup_reversal': return 'bank';
      case 'dispute': case 'dispute_reversal': return 'disputes';
      default: return 'other';
    }
  }
  var CAT_SV = {
    charge: 'Försäljning', refund: 'Återbetalning', partial_capture_reversal: 'Delvis återförd reservation', refund_failure: 'Misslyckad återbetalning',
    fee: 'Stripe-avgift', network_cost: 'Nätverksavgift', tax: 'Skatt på avgift', payout: 'Utbetalning', payout_reversal: 'Återförd utbetalning',
    topup: 'Insättning', topup_reversal: 'Återförd insättning', dispute: 'Tvist (chargeback)', dispute_reversal: 'Vunnen tvist', other_adjustment: 'Övrig justering'
  };

  // ---------- Parse ----------
  /** bytes|string -> { ok, error?, format, label, delimiter, encoding, txns[], excluded[], warnings[], currencies{} } */
  function parse(input, settings) {
    var s = mergeSettings(settings);
    var dec = CSV.decode(input), csv = CSV.parse(dec.text);
    var res = { ok: false, encoding: dec.encoding, delimiter: csv.delimiter, txns: [], excluded: [], warnings: [], currencies: {}, foreignCustomer: 0, rows: csv.rows.length };
    if (!csv.header.length) { res.error = 'empty'; return res; }
    var d = detect(csv.header);
    if (d.error) { res.error = d.error; res.missing = d.missing; res.header = csv.header; return res; }
    res.format = d.format; res.label = d.label;
    var m = d.map, decimalComma = csv.delimiter === ';';
    function col(r, k) { return m[k] === undefined ? '' : (r[m[k]] || '').trim(); }
    var feeMismatch = 0, badDate = 0, badNum = 0;
    csv.rows.forEach(function (r, i) {
      if (r.every(function (c) { return !String(c).trim(); })) return;
      var gross = CSV.toMinor(col(r, 'gross'), decimalComma), net = CSV.toMinor(col(r, 'net'), decimalComma), feeGiven = m.fee === undefined ? 0 : CSV.toMinor(col(r, 'fee'), decimalComma);
      if (isNaN(gross) || isNaN(net) || isNaN(feeGiven)) { badNum++; res.excluded.push({ line: i + 2, reason: 'bad-number', raw: r.join(' | ') }); return; }
      var cur = (col(r, 'currency') || 'sek').toLowerCase();
      var source = col(r, 'source'), desc = col(r, 'description');
      var cat = categoryFor(col(r, 'category'), col(r, 'type'), gross, source, desc);
      var created = toDate(col(r, 'created'), d.utc.created, s.convertTz);
      if (!created) { badDate++; res.excluded.push({ line: i + 2, reason: 'bad-date', raw: r.join(' | ') }); return; }
      var fee = gross - net;
      if (fee !== feeGiven && fee !== -feeGiven) feeMismatch++;
      var t = {
        line: i + 2, id: col(r, 'id'), cat: cat, role: roleFor(cat), gross: gross, fee: fee, net: net, currency: cur, created: created,
        availableOn: toDate(col(r, 'availableOn'), d.utc.availableOn, s.convertTz), payoutId: col(r, 'payoutId'),
        payoutDate: toDate(col(r, 'payoutDate'), d.utc.payoutDate, s.convertTz), description: desc, source: source
      };
      if (cat === 'payout' && !t.payoutId) t.payoutId = /^po_/.test(source) ? source : (t.id || source);
      res.currencies[cur] = (res.currencies[cur] || 0) + 1;
      var cfc = col(r, 'cfCurrency').toLowerCase();
      if (cfc && cfc !== cur) res.foreignCustomer++;
      if (cur !== 'sek') { res.excluded.push({ line: t.line, reason: 'currency', currency: cur, net: net, t: t }); return; }
      res.txns.push(t);
    });
    if (feeMismatch) res.warnings.push({ code: 'fee-mismatch', n: feeMismatch });
    if (badDate) res.warnings.push({ code: 'bad-date', n: badDate });
    if (badNum) res.warnings.push({ code: 'bad-number', n: badNum });
    var foreign = Object.keys(res.currencies).filter(function (c) { return c !== 'sek'; });
    if (foreign.length) res.warnings.push({ code: 'currency', currencies: foreign, n: res.excluded.filter(function (x) { return x.reason === 'currency'; }).length });
    if (res.foreignCustomer) res.warnings.push({ code: 'customer-currency', n: res.foreignCustomer });
    // Reports such as Payout reconciliation list the transactions *in* each payout but not the payout itself: synthesize it.
    var hasPayoutRows = res.txns.some(function (t) { return t.cat === 'payout'; });
    if (!hasPayoutRows) {
      var groups = {};
      res.txns.forEach(function (t) { if (t.payoutId) (groups[t.payoutId] = groups[t.payoutId] || []).push(t); });
      Object.keys(groups).forEach(function (pid) {
        var g = groups[pid], sum = 0, date = '';
        g.forEach(function (t) { sum += t.net; var dd = t.payoutDate || t.availableOn || t.created; if (dd > date) date = dd; });
        if (sum === 0) return;
        res.txns.push({ line: 0, id: pid, cat: 'payout', role: 'bank', gross: -sum, fee: 0, net: -sum, currency: 'sek', created: date, availableOn: date, payoutId: pid, payoutDate: date, description: 'STRIPE PAYOUT (beräknad från rapporten)', source: pid, synthetic: true });
      });
      if (Object.keys(groups).length) res.warnings.push({ code: 'payout-synth', n: Object.keys(groups).length });
      else if (res.txns.length) res.warnings.push({ code: 'no-payouts' });
    }
    if (!res.txns.length && !res.error) res.error = foreign.length ? 'only-foreign' : 'no-rows';
    res.ok = !res.error;
    return res;
  }

  // ---------- Bookkeeping ----------
  function roundHalfAway(x) { return x < 0 ? -Math.round(-x) : Math.round(x); }
  function vatOf(grossOre, rate) { return rate ? roundHalfAway(grossOre * rate / (100 + rate)) : 0; }

  /** parsed (from parse) + settings -> { vouchers[], warnings[], pending[], accounts{}, totals{}, rar[] } */
  function build(parsed, settings) {
    var s = mergeSettings(settings), A = s.acc, out = { vouchers: [], warnings: [], pending: [], accounts: {}, totals: {} };
    var refundAcc = A.refunds || A.sales;
    var groups = {}, order = [];
    function key(t) {
      if (s.grouping === 'day') return t.created;
      if (!t.payoutId) return null;
      return t.payoutId;
    }
    parsed.txns.forEach(function (t) {
      var k = key(t);
      if (k === null) { out.pending.push(t); return; }
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(t);
    });
    if (out.pending.length) {
      var pn = 0; out.pending.forEach(function (t) { pn += t.net; });
      out.warnings.push({ code: 'pending', n: out.pending.length, net: pn });
    }
    var totals = { sales: 0, refunds: 0, vat: 0, fees: 0, payouts: 0, disputes: 0, other: 0, rc: 0, n: 0 };
    var otherRows = 0, incomplete = 0;
    var vouchers = order.map(function (k) {
      var g = groups[k], lines = {}, info = {}, date = '';
      function add(acc, ore, label) { if (!ore) return; lines[acc] = (lines[acc] || 0) + ore; if (label) info[acc] = label; }
      var feeTotal = 0, cnt = {};
      g.forEach(function (t) {
        cnt[t.cat] = (cnt[t.cat] || 0) + 1;
        add(A.clearing, t.net, 'Stripe-saldo');
        if (t.fee) { add(A.fees, t.fee, 'Stripe-avgifter'); feeTotal += t.fee; }
        var c = -t.gross;   // counter entry for the gross amount
        if (t.role === 'sales' || t.role === 'refunds') {
          var v = vatOf(c, s.vatRate), acc = t.role === 'sales' ? A.sales : refundAcc;
          add(acc, c - v, t.role === 'sales' ? 'Försäljning via Stripe' : 'Återbetalningar via Stripe'); add(A.vat, v, 'Utgående moms');
          if (t.role === 'sales') totals.sales -= c; else totals.refunds -= c; totals.vat -= v;
        } else if (t.role === 'fees') { add(A.fees, c, 'Stripe-avgifter'); feeTotal += c; }
        else if (t.role === 'bank') { add(A.bank, c, t.cat === 'payout' ? 'Utbetalning till bank' : CAT_SV[t.cat] || t.cat); if (t.cat === 'payout') totals.payouts += c; }
        else if (t.role === 'disputes') { add(A.disputes, c, 'Tvister/chargebacks'); totals.disputes += c; }
        else { add(A.other, c, 'Övrigt från Stripe – kontrollera'); totals.other += c; otherRows++; }
        var dd = s.grouping === 'payout' ? (t.cat === 'payout' ? (t.payoutDate || t.availableOn || t.created) : '') : t.created;
        if (dd > date) date = dd;
      });
      if (!date) g.forEach(function (t) { var dd = t.payoutDate || t.availableOn || t.created; if (dd > date) date = dd; });
      totals.fees += feeTotal;
      if (s.reverseCharge && feeTotal) { var rc = roundHalfAway(feeTotal * 0.25); add(A.rcIn, rc, 'Beräknad ingående moms (omvänd skattskyldighet)'); add(A.rcOut, -rc, 'Utgående moms omvänd skattskyldighet'); totals.rc += rc; }
      var trans = Object.keys(lines).filter(function (a) { return lines[a] !== 0; }).sort(function (a, b) {
        var da = lines[a] > 0 ? 0 : 1, db = lines[b] > 0 ? 0 : 1; return da - db || (a < b ? -1 : 1);
      }).map(function (a) { return { konto: a, amount: lines[a], text: info[a] || '' }; });
      var clearingLeft = lines[A.clearing] || 0;
      if (s.grouping === 'payout' && clearingLeft !== 0 && A.clearing !== A.bank) incomplete++;
      var desc = Object.keys(cnt).map(function (c) { return cnt[c] + ' ' + (CAT_SV[c] || c).toLowerCase(); }).join(', ');
      var text = s.grouping === 'payout' ? 'Stripe utbetalning ' + k : 'Stripe ' + k;
      return { key: k, date: date, text: text, desc: desc, txns: g, trans: trans, clearingLeft: s.grouping === 'payout' ? clearingLeft : null };
    });
    vouchers.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : (a.key < b.key ? -1 : 1); });
    vouchers.forEach(function (v, i) { v.serie = s.series || 'A'; v.nr = s.startNo + i; totals.n++; });
    out.vouchers = vouchers; out.totals = totals;
    if (otherRows) out.warnings.push({ code: 'other', n: otherRows, account: A.other });
    if (incomplete) out.warnings.push({ code: 'incomplete-payout', n: incomplete });
    if (s.vatRate === 0) out.warnings.push({ code: 'vat0' });
    // Accounts used
    var roleOf = {};
    Object.keys(A).forEach(function (r) { if (A[r] && roleOf[A[r]] === undefined) roleOf[A[r]] = r; });
    vouchers.forEach(function (v) { v.trans.forEach(function (t) { var r = roleOf[t.konto]; out.accounts[t.konto] = r ? s.names[r] : t.text || 'Konto ' + t.konto; }); });
    if (A.vat && out.accounts[A.vat] && (s.names.vat === DEFAULTS.names.vat) && VAT_ACC[s.vatRate]) out.accounts[A.vat] = VAT_ACC[s.vatRate][1];
    // Fiscal years
    out.rar = fiscalYears(vouchers.map(function (v) { return v.date; }), s.fyStartMonth);
    if (out.rar.length > 1) out.warnings.push({ code: 'multi-year', n: out.rar.length });
    return out;
  }
  function fiscalYears(dates, startMonth) {
    var set = {};
    dates.forEach(function (d) {
      if (!d) return; var y = +d.slice(0, 4), mo = +d.slice(5, 7); var sy = mo >= startMonth ? y : y - 1;
      var start = sy + '-' + ('0' + startMonth).slice(-2) + '-01';
      var em = startMonth === 1 ? 12 : startMonth - 1, ey = startMonth === 1 ? sy : sy + 1;
      var last = new Date(Date.UTC(ey, em, 0)).getUTCDate();
      set[start] = { start: start, end: ey + '-' + ('0' + em).slice(-2) + '-' + last };
    });
    return Object.keys(set).sort().reverse().map(function (k) { return set[k]; });
  }

  function toSIE(built, settings, gen) {
    var s = mergeSettings(settings);
    return SIEW.build({
      program: 'Stripe till SIE', version: VERSION, gen: gen, fnamn: s.company || 'Mitt företag', orgnr: s.orgnr, rar: built.rar, accounts: built.accounts,
      vouchers: built.vouchers.map(function (v) { return { serie: v.serie, nr: v.nr, date: v.date, text: v.text, trans: v.trans }; })
    });
  }
  function toSIEBytes(built, settings, gen) { return SIEW.encodeCP437(toSIE(built, settings, gen)); }

  return { VERSION: VERSION, DEFAULTS: DEFAULTS, VAT_ACC: VAT_ACC, CAT_SV: CAT_SV, mergeSettings: mergeSettings, validateSettings: validateSettings,
    detect: detect, toDate: toDate, categoryFor: categoryFor, roleFor: roleFor, parse: parse, build: build, fiscalYears: fiscalYears,
    toSIE: toSIE, toSIEBytes: toSIEBytes, vatOf: vatOf };
});
