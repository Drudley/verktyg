/* K4 engine (UMD): genomsnittsmetoden (average cost) per ticker over the whole history, SEK conversion, K4 section A rows.
 * compute(events, {rates, fxMode:'auto'|'riksbank'}) → {tickers, sales, issues, ignored, years, fxUsage}
 * k4Rows(result, year, grouping:'security'|'sale') → {rows, pages, sums, rounded, excluded}
 * All money in SEK as floats until the final K4 rounding to whole kronor (Skatteverket: hela kronor). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.K4 = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var EPS = 1e-7, FX_TOL = 0.05, ROWS_PER_PAGE = 9;

  /* Riksbank lookup: rate on the date or the closest earlier banking day (max 10 days back). */
  function makeRateLookup(R) {
    var idx = null;
    function build() { idx = {}; R.dates.forEach(function (d, i) { idx[d] = i; }); }
    return function (cur, isoDate) {
      if (!R || !R[cur]) return null;
      if (!idx) build();
      var d = isoDate.replace(/-/g, '');
      if (d > R.to) return { beyond: true, last: lastOf(R, cur) };
      if (d < R.from) return null;
      var dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
      for (var k = 0; k <= 10; k++) {
        var s = dt.toISOString().slice(0, 10).replace(/-/g, '');
        if (idx[s] != null && R[cur][idx[s]] != null) return { value: R[cur][idx[s]], date: s };
        dt.setUTCDate(dt.getUTCDate() - 1);
      }
      return null;
    };
  }
  function lastOf(R, cur) { for (var i = R.dates.length - 1; i >= 0; i--) if (R[cur][i] != null) return { value: R[cur][i], date: R.dates[i] }; return null; }
  function daysBetween(a, b) { return Math.abs(Date.UTC(+a.slice(0, 4), +a.slice(4, 6) - 1, +a.slice(6, 8)) - Date.UTC(+b.slice(0, 4), +b.slice(4, 6) - 1, +b.slice(6, 8))) / 86400000; }

  /* → {rate, src:'sek'|'file'|'file-inverted'|'riksbank', rbDate} or {error} */
  function rateFor(lookup, cur, date, fileFx, mode) {
    if (cur === 'SEK') return { rate: 1, src: 'sek' };
    var rb = lookup(cur, date), f = isFinite(fileFx) && fileFx > 0 ? fileFx : null, ref = null;
    if (rb && rb.value) ref = rb;
    else if (rb && rb.beyond && rb.last && daysBetween(rb.last.date, date.replace(/-/g, '')) <= 60) ref = { value: rb.last.value, date: rb.last.date, stale: true };
    if (mode !== 'riksbank' && f && ref) {
      if (Math.abs(f / ref.value - 1) <= FX_TOL) return { rate: f, src: 'file' };
      if (Math.abs(1 / f / ref.value - 1) <= FX_TOL) return { rate: 1 / f, src: 'file-inverted' };
    }
    if (ref && !ref.stale) return { rate: ref.value, src: 'riksbank', rbDate: ref.date };
    return { error: rb && rb.beyond ? 'rate-beyond-table' : 'no-rate' };
  }

  var KORD = { BUY: 0, SPLIT: 1, UNKNOWN: 1, CRYPTO: 1, SELL: 2, IGNORE: 3 };
  function compute(events, opts) {
    opts = opts || {};
    var lookup = makeRateLookup(opts.rates), mode = opts.fxMode || 'auto';
    var evs = events.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : (KORD[a.kind] - KORD[b.kind]) || (a.line - b.line); });
    var T = {}, sales = [], issues = [], ignored = {}, fxUsage = { file: 0, 'file-inverted': 0, riksbank: 0, sek: 0 };
    function tk(t) { return T[t] || (T[t] = { ticker: t, qty: 0, cost: 0, blocked: null, ledger: [], currencies: {} }); }
    function block(s, ev, code, extra) {
      s.blocked = { code: code, line: ev.line, date: ev.date, ts: ev.ts, rawType: ev.rawType, extra: extra };
      issues.push({ level: 'error', code: code, ticker: s.ticker, line: ev.line, date: ev.date, rawType: ev.rawType, extra: extra });
    }
    evs.forEach(function (ev) {
      if (ev.kind === 'IGNORE') { var k = ev.rawType.toUpperCase().replace(/^TRANSFER .*/, 'TRANSFER (REVOLUT-ENTITET)'); ignored[k] = (ignored[k] || 0) + 1; return; }
      if (!ev.ticker) { issues.push({ level: 'warn', code: 'no-ticker', line: ev.line, rawType: ev.rawType }); return; }
      var s = tk(ev.ticker);
      if (s.blocked) return; // everything after the first unsupported event is unreliable
      if (ev.kind === 'CRYPTO') return block(s, ev, 'crypto');
      if (ev.kind === 'SPLIT') return block(s, ev, 'split');
      if (ev.kind === 'UNKNOWN') return block(s, ev, 'unknown-type');
      var q = Math.abs(ev.qty);
      if (!(q > 0)) return block(s, ev, 'bad-quantity');
      var total = Math.abs(ev.total), priceGross = isFinite(ev.price) ? q * Math.abs(ev.price) : NaN;
      if (!(total > 0)) {
        if (priceGross > 0) { total = priceGross; issues.push({ level: 'warn', code: 'total-from-price', ticker: s.ticker, line: ev.line }); }
        else return block(s, ev, 'bad-amount');
      }
      if (!ev.currency) return block(s, ev, 'no-currency');
      var fx = rateFor(lookup, ev.currency, ev.date, ev.fx, mode);
      if (fx.error) return block(s, ev, fx.error, ev.currency);
      fxUsage[fx.src]++;
      s.currencies[ev.currency] = 1;
      /* Fees: Revolut's Total Amount already includes the fee. If a separate fee column exists and Total == qty*price,
         the total is gross and the fee is added to cost (buy) / deducted from proceeds (sell). */
      var fee = isFinite(ev.fee) ? Math.abs(ev.fee) : 0, gross = priceGross > 0 && Math.abs(total - priceGross) <= Math.max(0.011, total * 5e-4);
      var net = total, feeIncl;
      if (fee > 0 && gross) { net = ev.kind === 'BUY' ? total + fee : total - fee; feeIncl = fee; }
      else feeIncl = priceGross > 0 ? Math.max(0, ev.kind === 'BUY' ? total - priceGross : priceGross - total) : NaN;
      var sek = net * fx.rate;
      var base = { line: ev.line, date: ev.date, ts: ev.ts, kind: ev.kind, rawType: ev.rawType, qty: q, price: ev.price, total: net, currency: ev.currency, fx: fx.rate, fxSrc: fx.src, rbDate: fx.rbDate, fee: feeIncl, sek: sek };
      if (ev.kind === 'BUY') {
        s.qty += q; s.cost += sek;
        base.qtyAfter = s.qty; base.costAfter = s.cost; base.gavAfter = s.cost / s.qty;
        s.ledger.push(base);
        return;
      }
      // SELL
      if (q > s.qty + EPS) return block(s, ev, 'oversold', { have: s.qty, sell: q });
      var gav = s.cost / s.qty, omk = gav * q;
      if (Math.abs(q - s.qty) <= EPS) { omk = s.cost; q = s.qty; }
      var sale = Object.assign({}, base, { ticker: s.ticker, qty: q, holdingBefore: s.qty, gav: gav, proceeds: sek, omk: omk, result: sek - omk });
      s.qty -= q; s.cost -= omk;
      if (s.qty <= EPS) { s.qty = 0; s.cost = 0; }
      sale.qtyAfter = s.qty; sale.costAfter = s.cost; sale.gavAfter = s.qty ? s.cost / s.qty : 0;
      s.ledger.push(sale); sales.push(sale);
    });
    var years = {}; sales.forEach(function (x) { years[x.date.slice(0, 4)] = 1; });
    // blocked tickers: which years are affected (sales on/after the block may be missing)
    Object.keys(T).forEach(function (k) { var s = T[k]; if (s.blocked) s.blockedYear = s.blocked.date.slice(0, 4); });
    return { tickers: T, sales: sales, issues: issues, ignored: ignored, years: Object.keys(years).sort(), fxUsage: fxUsage, rateTo: opts.rates && opts.rates.to };
  }

  /* Tickers that make the chosen year's K4 incomplete: blocked on or before the end of that year with holdings or later sales. */
  function blockedFor(res, year) {
    return Object.keys(res.tickers).map(function (k) { return res.tickers[k]; }).filter(function (s) { return s.blocked && s.blocked.date.slice(0, 4) <= year; });
  }

  function k4Rows(res, year, grouping) {
    var list = res.sales.filter(function (x) { return x.date.slice(0, 4) === String(year); }), groups = [];
    if (grouping === 'sale') list.forEach(function (x) { groups.push({ ticker: x.ticker, sales: [x] }); });
    else {
      var by = {};
      list.forEach(function (x) { (by[x.ticker] || (by[x.ticker] = { ticker: x.ticker, sales: [] })).sales.push(x); });
      groups = Object.keys(by).sort().map(function (k) { return by[k]; });
    }
    var rows = groups.map(function (g) {
      var qty = 0, pr = 0, om = 0;
      g.sales.forEach(function (x) { qty += x.qty; pr += x.proceeds; om += x.omk; });
      var pris = Math.round(pr), omk = Math.round(om), d = pris - omk, q8 = Math.round(qty * 1e8) / 1e8;
      var antal = Math.max(1, Math.round(q8));
      return { ticker: g.ticker, beteckning: g.ticker, antalExact: q8, antal: antal, antalRounded: Math.abs(antal - q8) > 1e-9, pris: pris, omk: omk, vinst: d > 0 ? d : 0, forlust: d < 0 ? -d : 0, exactResult: pr - om, sales: g.sales, date: g.sales[0].date };
    });
    var pages = [];
    for (var i = 0; i < rows.length; i += ROWS_PER_PAGE) {
      var pr = rows.slice(i, i + ROWS_PER_PAGE), s = { pris: 0, omk: 0, vinst: 0, forlust: 0 };
      pr.forEach(function (r) { s.pris += r.pris; s.omk += r.omk; s.vinst += r.vinst; s.forlust += r.forlust; });
      pages.push({ n: pages.length + 1, rows: pr, sums: s });
    }
    var sums = { pris: 0, omk: 0, vinst: 0, forlust: 0 };
    pages.forEach(function (p) { Object.keys(sums).forEach(function (k) { sums[k] += p.sums[k]; }); });
    return { year: String(year), rows: rows, pages: pages, sums: sums, rounded: rows.some(function (r) { return r.antalRounded; }), blocked: blockedFor(res, String(year)), sales: list };
  }

  return { compute: compute, k4Rows: k4Rows, rateFor: rateFor, makeRateLookup: makeRateLookup, ROWS_PER_PAGE: ROWS_PER_PAGE };
});
