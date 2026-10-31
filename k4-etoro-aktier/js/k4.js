/* K4 engine (UMD): genomsnittsmetoden (average cost) per holding over the whole history, SEK conversion, K4 rows in
 * section A (shares, funds), C (listed bonds, foreign currency) and D (crypto, precious metals) – Skatteverket's table
 * "Var redovisas vilka värdepapper" (skatteverket.se → Deklarera aktier och övriga värdepapper).
 * compute(events, {rates, fxMode:'auto'|'riksbank'}) → {tickers, sales, issues, ignored, income, notes, years, fxUsage}
 * k4Rows(result, year, grouping:'security'|'sale') → {rows, bySec, pages, sums, secSums, rounded, blocked}
 * All money in SEK as floats until the final K4 rounding to whole kronor (Skatteverket: hela kronor). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.K4 = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var EPS = 1e-7, FX_TOL = 0.05, ROWS_PER_PAGE = 9;
  var SECTION = { stock: 'A', fund: 'A', bond: 'C', currency: 'C', crypto: 'D', commodity: 'D' }, CAP = { A: 9, C: 7, D: 7 }, SECS = ['A', 'C', 'D'];

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

  var KORD = { OPENING: -1, BUY: 0, REWARD: 0, XFER_IN: 0, SPLIT: 1, UNKNOWN: 1, CRYPTO: 1, INCOME: 1, SELL: 2, XFER_OUT: 2, IGNORE: 3 };
  function compute(events, opts) {
    opts = opts || {};
    var lookup = makeRateLookup(opts.rates), mode = opts.fxMode || 'auto';
    var evs = events.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : (KORD[a.kind] - KORD[b.kind]) || ((a.file || 0) - (b.file || 0)) || (a.line - b.line); });
    var T = {}, sales = [], issues = [], ignored = {}, income = [], notes = {}, once = {}, fxUsage = { file: 0, 'file-inverted': 0, riksbank: 0, sek: 0 };
    function tk(t, asset) {
      var key = t;
      return T[key] || (T[key] = { ticker: t, asset: asset || 'stock', section: SECTION[asset] || 'A', qty: 0, cost: 0, blocked: null, ledger: [], currencies: {}, files: {} });
    }
    function block(s, ev, code, extra) {
      s.blocked = { code: code, line: ev.line, date: ev.date, ts: ev.ts, rawType: ev.rawType, extra: extra, file: ev.file };
      issues.push({ level: 'error', code: code, ticker: s.ticker, line: ev.line, date: ev.date, rawType: ev.rawType, extra: extra, file: ev.file });
    }
    function warnOnce(code, ticker, ev, extra) { var k = code + '|' + (ticker || ''); if (once[k]) { once[k].count++; return; } once[k] = { level: 'warn', code: code, ticker: ticker, line: ev.line, date: ev.date, rawType: ev.rawType, extra: extra, count: 1, file: ev.file }; issues.push(once[k]); }
    function toSek(ev, amount) {
      if (!ev.currency) return { error: 'no-currency' };
      var fx = rateFor(lookup, ev.currency, ev.date, ev.fx, ev.marketRate ? 'riksbank' : mode);
      if (fx.error) return fx;
      return { sek: amount * fx.rate, fx: fx };
    }
    evs.forEach(function (ev) {
      if (ev.kind === 'IGNORE') {
        var k = String(ev.rawType || '').toUpperCase().replace(/^TRANSFER .*/, 'TRANSFER (REVOLUT-ENTITET)');
        if (/ROBO/.test(k)) notes['u-robo'] = 1;
        ignored[k] = (ignored[k] || 0) + 1; return;
      }
      if (ev.kind === 'INCOME') {
        var c = toSek(ev, Math.abs(ev.total));
        income.push({ type: ev.income || 'interest', ticker: ev.ticker, date: ev.date, line: ev.line, file: ev.file, currency: ev.currency, amount: Math.abs(ev.total), sek: c.error ? null : c.sek, rawType: ev.rawType });
        notes[ev.income === 'fund-distribution' ? 'u-mmf-income' : ev.income === 'coupon' ? 'u-bond' : 'u-interest'] = 1;
        return;
      }
      if (/ROBO/i.test(ev.rawType || '')) notes['u-robo'] = 1;
      if (!ev.ticker) { issues.push({ level: 'warn', code: 'no-ticker', line: ev.line, rawType: ev.rawType, file: ev.file }); return; }
      var s = tk(ev.ticker, ev.asset);
      if (ev.file != null) s.files[ev.file] = 1;
      if (s.asset === 'currency') notes['u-currency'] = 1;
      if (s.asset === 'commodity') notes['u-commodity'] = 1;
      if (s.asset === 'bond') notes['u-bond'] = 1;
      if (ev.fund === 'mmf') { s.fund = 'mmf'; notes['u-mmf'] = 1; }
      if (s.blocked) return; // everything after the first unsupported event is unreliable
      if (ev.kind === 'OPENING') return block(s, ev, 'opening-balance', { have: ev.qty });
      if (ev.kind === 'CRYPTO') return block(s, ev, 'crypto');
      if (ev.kind === 'SPLIT') return block(s, ev, 'split');
      if (ev.kind === 'UNKNOWN') return block(s, ev, 'unknown-type');
      if (ev.kind === 'XFER_IN') return block(s, ev, 'transfer-in');
      var q = Math.abs(ev.qty);
      if (!(q > 0)) return block(s, ev, 'bad-quantity');
      if (ev.kind === 'XFER_OUT') {
        if (q > s.qty + EPS) return block(s, ev, 'oversold', { have: s.qty, sell: q });
        var part = Math.abs(q - s.qty) <= EPS ? s.cost : s.cost * q / s.qty;
        s.qty -= q; s.cost -= part; if (s.qty <= EPS) { s.qty = 0; s.cost = 0; }
        s.ledger.push({ line: ev.line, file: ev.file, date: ev.date, ts: ev.ts, kind: 'XFER_OUT', rawType: ev.rawType, qty: q, total: NaN, currency: '', omk: part, qtyAfter: s.qty, costAfter: s.cost, gavAfter: s.qty ? s.cost / s.qty : 0 });
        warnOnce('transfer-out', s.ticker, ev);
        return;
      }
      var total = Math.abs(ev.total), priceGross = isFinite(ev.price) ? q * Math.abs(ev.price) : NaN;
      if (!(total > 0)) {
        if (priceGross > 0) { total = priceGross; issues.push({ level: 'warn', code: 'total-from-price', ticker: s.ticker, line: ev.line, file: ev.file }); }
        else return block(s, ev, 'bad-amount');
      }
      if (!ev.currency) return block(s, ev, 'no-currency');
      var fx = rateFor(lookup, ev.currency, ev.date, ev.fx, ev.marketRate ? 'riksbank' : mode);
      if (fx.error) return block(s, ev, fx.error, ev.currency);
      fxUsage[fx.src]++;
      s.currencies[ev.currency] = 1;
      /* Fees: the stock log's Total Amount already includes the fee. If a separate fee column exists and Total == qty*price
         (or the statement says so: crypto statement / Revolut X, ev.feeSep), the total is gross and the fee is added to the
         cost (buy) / deducted from the proceeds (sell). */
      var fee = isFinite(ev.fee) ? Math.abs(ev.fee) : 0, gross = ev.feeSep || priceGross > 0 && Math.abs(total - priceGross) <= Math.max(0.011, total * 5e-4);
      var net = total, feeIncl;
      if (fee > 0 && gross) { net = ev.kind === 'SELL' ? total - fee : total + fee; feeIncl = fee; }
      else feeIncl = ev.feeSep ? 0 : priceGross > 0 ? Math.max(0, ev.kind === 'BUY' ? total - priceGross : priceGross - total) : NaN;
      if (ev.kind === 'REWARD') { net = total; feeIncl = 0; }
      var sek = net * fx.rate;
      var base = { line: ev.line, file: ev.file, date: ev.date, ts: ev.ts, kind: ev.kind, rawType: ev.rawType, qty: q, price: ev.price, total: net, currency: ev.currency, fx: fx.rate, fxSrc: fx.src, rbDate: fx.rbDate, fee: feeIncl, sek: sek };
      if (ev.kind === 'BUY' || ev.kind === 'REWARD') {
        s.qty += q; s.cost += sek;
        base.qtyAfter = s.qty; base.costAfter = s.cost; base.gavAfter = s.cost / s.qty;
        s.ledger.push(base);
        if (ev.kind === 'REWARD') { income.push({ type: 'reward', ticker: s.ticker, date: ev.date, line: ev.line, file: ev.file, currency: ev.currency, amount: net, sek: sek, rawType: ev.rawType }); notes['u-reward'] = 1; }
        return;
      }
      // SELL
      if (q > s.qty + EPS) return block(s, ev, 'oversold', { have: s.qty, sell: q });
      var gav = s.cost / s.qty, omk = gav * q;
      if (Math.abs(q - s.qty) <= EPS) { omk = s.cost; q = s.qty; }
      var sale = Object.assign({}, base, { ticker: s.ticker, asset: s.asset, section: s.section, qty: q, holdingBefore: s.qty, gav: gav, proceeds: sek, omk: omk, result: sek - omk });
      s.qty -= q; s.cost -= omk;
      if (s.qty <= EPS) { s.qty = 0; s.cost = 0; }
      sale.qtyAfter = s.qty; sale.costAfter = s.cost; sale.gavAfter = s.qty ? s.cost / s.qty : 0;
      s.ledger.push(sale); sales.push(sale);
    });
    // the same holding from more than one file: could be double counted if the files overlap
    Object.keys(T).forEach(function (k) { if (Object.keys(T[k].files).length > 1) issues.push({ level: 'warn', code: 'multi-file', ticker: k }); });
    var years = {}; sales.forEach(function (x) { years[x.date.slice(0, 4)] = 1; }); income.forEach(function (x) { years[x.date.slice(0, 4)] = 1; });
    Object.keys(T).forEach(function (k) { var s = T[k]; if (s.blocked) s.blockedYear = s.blocked.date.slice(0, 4); });
    return { tickers: T, sales: sales, issues: issues, ignored: ignored, income: income, notes: Object.keys(notes), years: Object.keys(years).sort(), fxUsage: fxUsage, rateTo: opts.rates && opts.rates.to };
  }

  /* Tickers that make the chosen year's K4 incomplete: blocked on or before the end of that year with holdings or later sales. */
  function blockedFor(res, year) {
    return Object.keys(res.tickers).map(function (k) { return res.tickers[k]; }).filter(function (s) { return s.blocked && s.blocked.date.slice(0, 4) <= year; });
  }

  function k4Rows(res, year, grouping) {
    var list = res.sales.filter(function (x) { return x.date.slice(0, 4) === String(year); }), groups = [];
    function sec(x) { return x.section || 'A'; }
    if (grouping === 'sale') list.forEach(function (x) { groups.push({ ticker: x.ticker, section: sec(x), asset: x.asset, sales: [x] }); });
    else {
      var by = {};
      list.forEach(function (x) { var k = sec(x) + '|' + x.ticker; (by[k] || (by[k] = { ticker: x.ticker, section: sec(x), asset: x.asset, sales: [] })).sales.push(x); });
      groups = Object.keys(by).sort().map(function (k) { return by[k]; });
    }
    var rows = groups.map(function (g) {
      var qty = 0, pr = 0, om = 0;
      g.sales.forEach(function (x) { qty += x.qty; pr += x.proceeds; om += x.omk; });
      var pris = Math.round(pr), omk = Math.round(om), d = pris - omk, q8 = Math.round(qty * 1e8) / 1e8;
      /* Section A: antal is mandatory → at least 1. Sections C/D: "Antal/Belopp i utländsk valuta" is optional → left out when it rounds to 0. */
      var antal = g.section === 'A' ? Math.max(1, Math.round(q8)) : Math.round(q8) >= 1 ? Math.round(q8) : null;
      var bet = g.asset === 'commodity' ? g.ticker + ' (' + ({ XAU: 'guld', XAG: 'silver', XPT: 'platina', XPD: 'palladium' }[g.ticker] || 'råvara') + ')' : g.ticker;
      return { ticker: g.ticker, section: g.section, asset: g.asset, beteckning: bet, antalExact: q8, antal: antal, antalRounded: antal == null || Math.abs(antal - q8) > 1e-9, pris: pris, omk: omk, vinst: d > 0 ? d : 0, forlust: d < 0 ? -d : 0, exactResult: pr - om, sales: g.sales, date: g.sales[0].date };
    });
    function sums(rs) { var s = { pris: 0, omk: 0, vinst: 0, forlust: 0 }; rs.forEach(function (r) { s.pris += r.pris; s.omk += r.omk; s.vinst += r.vinst; s.forlust += r.forlust; }); return s; }
    var bySec = {}; SECS.forEach(function (k) { bySec[k] = rows.filter(function (r) { return r.section === k; }); });
    var n = Math.max.apply(null, SECS.map(function (k) { return Math.ceil(bySec[k].length / CAP[k]); })), pages = [];
    for (var i = 0; i < n; i++) {
      var p = { n: i + 1, sec: {}, rows: [] };
      SECS.forEach(function (k) { var rs = bySec[k].slice(i * CAP[k], (i + 1) * CAP[k]); p.sec[k] = { rows: rs, sums: sums(rs) }; p.rows = p.rows.concat(rs); });
      p.sums = sums(p.rows);
      pages.push(p);
    }
    var secSums = {}; SECS.forEach(function (k) { secSums[k] = sums(bySec[k]); });
    var ordered = [].concat(bySec.A, bySec.C, bySec.D);
    return { year: String(year), rows: ordered, bySec: bySec, pages: pages, sums: sums(ordered), secSums: secSums, rounded: ordered.some(function (r) { return r.antalRounded; }), blocked: blockedFor(res, String(year)), sales: list,
      income: (res.income || []).filter(function (x) { return x.date.slice(0, 4) === String(year); }) };
  }

  return { compute: compute, k4Rows: k4Rows, rateFor: rateFor, makeRateLookup: makeRateLookup, ROWS_PER_PAGE: ROWS_PER_PAGE, SECTION: SECTION, CAP: CAP };
});
