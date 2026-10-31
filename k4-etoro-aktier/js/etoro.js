/* eToro account statement parser + K4 assembly (UMD). Depends on XLSXR (xlsx-read.js) and K4 (k4.js).
 *
 * Input: the eToro "Account statement" workbook (.xlsx, sheets "Account Summary", "Closed Positions", "Account Activity",
 * "Dividends", "Financial Summary") or any of those sheets saved as CSV. Header variants handled (column names per year,
 * see research/sources/etoro_edavki_reference.py): Units vs Units / Contracts, Overnight vs Rollover Fees and Dividends,
 * with/without Long / Short, FX rate at open/close, ISIN, Profit / Profit(USD); dates dd/mm/yyyy hh:mm:ss, dd.mm.yyyy
 * hh:mm:ss, ISO or Excel serials; numbers with decimal point or decimal comma.
 *
 * Tax treatment (Skatteverket, checked 2026-10-30; uncertain points are flagged, never silently decided):
 *  - real positions (Type Stocks/ETF/Crypto, leverage 1, long): genomsnittsmetoden per instrument over every buy and sale in
 *    the file(s), SEK at the Riksbank rate of the open/close date → K4 A (stocks/ETF) or D (crypto). Cost = Amount (USD
 *    invested), sale price = Amount + Profit(USD).
 *  - CFD / leveraged / short: per closed position, result = Profit(USD) + Overnight fees and dividends (Skatteverket: interest
 *    and dividends paid/received are part of the CFD result), SEK at the Riksbank rate of the close date. Section by
 *    underlying: currency → C; commodity, crypto → D; shares/index → D by default (eToro CFDs are OTC and Skatteverket has
 *    no statement that they are "marknadsnoterade") or A when the user says they are.
 *  - dividends: gross = net + withholding, listed separately (inkomstdeklaration ruta 7.2 / avräkning) – not K4.
 * parseFile(bytes) → Promise<parsed>;  compute([{p: parsed}], {rates, cfdStockSection}) → K4.compute-style result. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xlsx-read.js'), require('./k4.js'));
  else root.ETORO = factory(root.XLSXR, root.K4);
})(typeof self !== 'undefined' ? self : this, function (XLSXR, K4) {
  'use strict';
  var EPS = 1e-7;
  function norm(h) { return String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ---------- numbers & dates ---------- */
  function num(v, decimalComma) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim();
    if (!s || /^[-–—]$/.test(s) || /^n\/?a$/i.test(s)) return NaN;
    var neg = /^\(.*\)$/.test(s) || /^[^\d]*[-–−]/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    var c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c >= 0 && d >= 0) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c >= 0) s = !decimalComma && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,(?=.*,)/g, '').replace(',', '.');
    else if (d >= 0 && (decimalComma && /^\d{1,3}(\.\d{3})+$/.test(s) || /^\d{1,3}(\.\d{3}){2,}$/.test(s))) s = s.replace(/\./g, '');
    if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return NaN;
    var x = parseFloat(s);
    return neg ? -x : x;
  }
  /* → {date:'YYYY-MM-DD', ts:'YYYY-MM-DDTHH:MM:SS'} or null. eToro writes day first (dd/mm/yyyy, dd.mm.yyyy). */
  function date(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
      var dt = new Date(Math.round((v - 25569) * 86400) * 1000);
      return { date: dt.getUTCFullYear() + '-' + pad(dt.getUTCMonth() + 1) + '-' + pad(dt.getUTCDate()), ts: dt.toISOString().slice(0, 19) };
    }
    var s = String(v == null ? '' : v).trim(), m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (m) return mk(+m[1], +m[2], +m[3], m[4], m[5], m[6]);
    m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[ ,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (m) return mk(+m[3], +m[2], +m[1], m[4], m[5], m[6]);
    return null;
  }
  function mk(y, mo, d, h, mi, se) {
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, d)); if (dt.getUTCDate() !== d) return null;
    var iso = y + '-' + pad(mo) + '-' + pad(d);
    return { date: iso, ts: iso + 'T' + pad(+(h || 0)) + ':' + (mi || '00') + ':' + (se || '00') };
  }

  /* ---------- sheet detection ---------- */
  var COLS = {
    closed: { id: ['positionid'], action: ['action'], ls: ['longshort'], amount: ['amount', 'amountusd', 'invested', 'investedusd'], units: ['unitscontracts', 'units', 'contracts'],
      open: ['opendate'], close: ['closedate'], lev: ['leverage'], profit: ['profitusd', 'profit', 'netprofitusd'], over: ['overnightfeesanddividends', 'rolloverfeesanddividends', 'overnightfeesanddividendsusd', 'rolloverfeesanddividendsusd'],
      type: ['type'], isin: ['isin'], copied: ['copiedfrom'], openRate: ['openrate'], closeRate: ['closerate'], spread: ['spreadfeesusd', 'spread'], notes: ['notes'] },
    activity: { date: ['date'], type: ['type'], details: ['details'], amount: ['amount'], units: ['unitscontracts', 'units'], id: ['positionid'], asset: ['assettype'], rec: ['realizedequitychange'] },
    dividends: { date: ['dateofpayment'], name: ['instrumentname'], net: ['netdividendreceivedusd', 'netdividendreceived'], rate: ['withholdingtaxrate'], wht: ['withholdingtaxamountusd', 'withholdingtaxamount'], id: ['positionid'], type: ['type'], isin: ['isin'] }
  };
  var REQ = { closed: ['id', 'action', 'amount', 'units', 'open', 'close', 'profit'], activity: ['date', 'type', 'details', 'amount'], dividends: ['date', 'net'] };
  var MARK = { closed: ['opendate', 'closedate'], dividends: ['dateofpayment'], activity: ['details', 'realizedequitychange'] };
  function mapHeader(row, kind) {
    var n = row.map(norm), idx = {}, C = COLS[kind];
    Object.keys(C).forEach(function (k) { for (var i = 0; i < C[k].length; i++) { var j = n.indexOf(C[k][i]); if (j >= 0) { idx[k] = j; return; } } });
    return idx;
  }
  /* finds the header row (first 15 rows) and the sheet kind → {kind, at, idx, missing} or null */
  function detect(rows) {
    for (var r = 0; r < Math.min(15, rows.length); r++) {
      var n = (rows[r] || []).map(norm);
      var kinds = ['closed', 'dividends', 'activity'];
      for (var k = 0; k < kinds.length; k++) {
        var kind = kinds[k];
        if (!MARK[kind].some(function (h) { return n.indexOf(h) >= 0; })) continue;
        if (kind === 'activity' && n.indexOf('date') < 0) continue;
        var idx = mapHeader(rows[r], kind), missing = REQ[kind].filter(function (c) { return idx[c] == null; });
        return { kind: kind, at: r, idx: idx, missing: missing, header: rows[r] };
      }
    }
    return null;
  }
  function variantOf(kind, idx, header) {
    var n = header.map(norm), v = [];
    if (kind === 'closed') {
      v.push(n.indexOf('unitscontracts') >= 0 ? 'Units / Contracts' : 'Units');
      if (idx.over != null) v.push(/^rollover/.test(n[idx.over]) ? 'Rollover fees' : 'Overnight fees');
      if (idx.ls != null) v.push('Long / Short');
      if (n.indexOf('fxrateatopenusd') >= 0) v.push('FX rate');
      if (idx.isin != null) v.push('ISIN');
    } else if (kind === 'activity') { if (idx.units != null) v.push(n[idx.units] === 'unitscontracts' ? 'Units / Contracts' : 'Units'); if (idx.asset != null) v.push('Asset type'); }
    return v.join(', ');
  }

  /* Account Summary: "Start Date"/"End Date" (or "Date range: dd/mm/yyyy - dd/mm/yyyy") anywhere in the sheet */
  function summaryPeriod(rows) {
    var start = null, end = null;
    rows.slice(0, 80).forEach(function (r) {
      for (var i = 0; i < r.length; i++) {
        var lab = norm(r[i]); if (!lab) continue;
        var nxt = r.slice(i + 1).filter(function (x) { return String(x).trim() !== ''; })[0];
        if (/^(startdate|from|fromdate|periodstart)$/.test(lab) && date(nxt)) start = date(nxt).date;
        if (/^(enddate|to|todate|periodend)$/.test(lab) && date(nxt)) end = date(nxt).date;
        var m = /(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2})\s*[-–]\s*(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2})/.exec(String(r[i]));
        if (m && date(m[1]) && date(m[2])) { start = start || date(m[1]).date; end = end || date(m[2]).date; }
      }
    });
    return start || end ? { start: start, end: end } : null;
  }

  function cell(row, idx, k) { return idx[k] == null ? '' : row[idx[k]] == null ? '' : row[idx[k]]; }
  function str(row, idx, k) { return String(cell(row, idx, k)).trim(); }
  function sheetDecimalComma(rows, d) {
    var dotDates = 0, commaNums = 0;
    rows.slice(d.at + 1, d.at + 60).forEach(function (r) { r.forEach(function (c) { if (typeof c === 'string') { if (/^\d{1,2}\.\d{1,2}\.\d{4}/.test(c)) dotDates++; else if (/^-?\d+,\d+$/.test(c.trim())) commaNums++; } }); });
    return dotDates > 0 && commaNums > 0 || commaNums > 3;
  }

  function readClosed(rows, d, out, sheet) {
    var dc = sheetDecimalComma(rows, d);
    for (var r = d.at + 1; r < rows.length; r++) {
      var row = rows[r] || [], id = str(row, d.idx, 'id');
      if (!id || !/\d/.test(id)) continue;
      var action = str(row, d.idx, 'action'), ls = str(row, d.idx, 'ls').toLowerCase(), o = date(cell(row, d.idx, 'open')), c = date(cell(row, d.idx, 'close'));
      var am = /^(buy|sell)\s+(.*)$/i.exec(action), lev = num(cell(row, d.idx, 'lev'), dc);
      var long = ls ? !/short|sell/.test(ls) : !(am && /^sell$/i.test(am[1]));
      var rec = { sheet: sheet, line: r + 1, id: id.replace(/\.0+$/, ''), action: action, name: am ? am[2].trim() : action, long: long, amount: Math.abs(num(cell(row, d.idx, 'amount'), dc)), units: Math.abs(num(cell(row, d.idx, 'units'), dc)),
        open: o, close: c, lev: isFinite(lev) && lev > 0 ? lev : 1, levMissing: d.idx.lev == null, profit: num(cell(row, d.idx, 'profit'), dc), over: num(cell(row, d.idx, 'over'), dc), type: str(row, d.idx, 'type'), typeMissing: d.idx.type == null,
        isin: str(row, d.idx, 'isin').toUpperCase(), copied: str(row, d.idx, 'copied'), openRate: num(cell(row, d.idx, 'openRate'), dc), closeRate: num(cell(row, d.idx, 'closeRate'), dc) };
      if (!/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(rec.isin)) rec.isin = '';
      if (!o || !c) { out.errors.push({ code: 'bad-date', line: r + 1, sheet: sheet }); continue; }
      out.closed.push(rec);
    }
  }
  function readActivity(rows, d, out, sheet) {
    var dc = sheetDecimalComma(rows, d);
    for (var r = d.at + 1; r < rows.length; r++) {
      var row = rows[r] || [], dt = date(cell(row, d.idx, 'date')), type = str(row, d.idx, 'type');
      if (!dt || !type) continue;
      out.activity.push({ sheet: sheet, line: r + 1, date: dt.date, ts: dt.ts, type: type, details: str(row, d.idx, 'details'), amount: num(cell(row, d.idx, 'amount'), dc), units: d.idx.units == null ? NaN : Math.abs(num(cell(row, d.idx, 'units'), dc)),
        id: str(row, d.idx, 'id').replace(/\.0+$/, ''), asset: str(row, d.idx, 'asset'), hasUnits: d.idx.units != null, hasAsset: d.idx.asset != null });
    }
  }
  function readDividends(rows, d, out, sheet) {
    var dc = sheetDecimalComma(rows, d);
    for (var r = d.at + 1; r < rows.length; r++) {
      var row = rows[r] || [], dt = date(cell(row, d.idx, 'date')), net = num(cell(row, d.idx, 'net'), dc);
      if (!dt || !isFinite(net)) continue;
      var rate = num(cell(row, d.idx, 'rate'), dc), wht = num(cell(row, d.idx, 'wht'), dc);
      if (isFinite(rate) && rate > 0 && rate <= 1 && !/%/.test(String(cell(row, d.idx, 'rate')))) rate *= 100;
      out.dividends.push({ sheet: sheet, line: r + 1, date: dt.date, ts: dt.ts, name: str(row, d.idx, 'name'), net: net, rate: rate, wht: isFinite(wht) ? Math.abs(wht) : NaN, id: str(row, d.idx, 'id').replace(/\.0+$/, ''), type: str(row, d.idx, 'type'), isin: str(row, d.idx, 'isin').toUpperCase() });
    }
  }

  /* sheets: [{name, rows}] → parsed file */
  function parseSheets(sheets, kind) {
    var out = { closed: [], activity: [], dividends: [], period: null, errors: [], found: [], variants: {}, rows: 0, kind: kind || 'xlsx' };
    sheets.forEach(function (sh) {
      var d = detect(sh.rows);
      if (!d) { if (/summary|sammanfattning/i.test(sh.name) || !out.period) { var p = summaryPeriod(sh.rows); if (p) out.period = p; } return; }
      if (d.missing.length) { out.errors.push({ code: 'missing-columns', cols: d.missing, sheet: sh.name, kind: d.kind }); return; }
      out.found.push(d.kind); out.variants[d.kind] = variantOf(d.kind, d.idx, d.header);
      var before = out[d.kind].length;
      (d.kind === 'closed' ? readClosed : d.kind === 'activity' ? readActivity : readDividends)(sh.rows, d, out, sh.name);
      out.rows += out[d.kind].length - before;
    });
    if (!out.found.length && !out.errors.length) out.errors.push({ code: 'no-header' });
    out.format = 'etoro-' + (out.found.length > 1 ? 'statement' : out.found[0] || 'unknown') + '-' + out.kind;
    return out;
  }
  function parseFile(bytes) {
    return XLSXR.read(bytes).then(function (wb) { return parseSheets(wb.sheets, wb.kind); });
  }

  /* ---------- classification ---------- */
  var FIAT = 'USD EUR GBP JPY CHF CAD AUD NZD SEK NOK DKK PLN CZK HUF RON TRY ZAR MXN SGD HKD CNH CNY ILS RUB INR BRL'.split(' ');
  var COMMOD = /\b(gold|silver|platinum|palladium|copper|oil|crude|brent|wti|natgas|natural ?gas|gasoline|heating ?oil|wheat|corn|soybeans?|sugar|coffee|cocoa|cotton|aluminium|aluminum|zinc|nickel|lead|cattle|hogs|xau|xag|xpt|xpd|usoil|ukoil)\b/i;
  var CRYPTO = /\b(bitcoin|btc|ethereum|eth|ripple|xrp|litecoin|ltc|cardano|solana|dogecoin|doge|polkadot|tron|stellar|xlm|zcash|tezos|chainlink|uniswap|polygon|matic|avalanche|avax|shiba ?inu|shib|binance ?coin|bnb|algorand|cosmos|decentraland|bitcoin ?cash|bch|ethereum ?classic)\b/i;
  var INDEX = /^(spx500|spx|us500|nsdq100|nasdaq100|nas100|ndx|dj30|us30|dow|ger30|ger40|dax|de40|uk100|ftse|fra40|cac40|jpn225|nikkei|hkg50|hk50|aus200|esp35|eustx50|euro ?stoxx ?50|stoxx50|china50|chinaa50|us2000|russell ?2000|vix|swi20|ned25|it40|omxs30)$/i;
  function fiatPair(s) {
    var m = /^([A-Z]{3})\s*\/?\s*([A-Z]{3})$/.exec(String(s || '').trim().toUpperCase());
    return !!m && FIAT.indexOf(m[1]) >= 0 && FIAT.indexOf(m[2]) >= 0;
  }
  function underlyingOf(name, ticker, type, isin) {
    var t = (type || '').toLowerCase(), s = (ticker || name || '').trim();
    if (/crypto/.test(t)) return { asset: 'crypto' };
    if (/^(stocks?|etfs?)$/.test(t)) return { asset: 'stock' };
    if (/^(currenc(y|ies)|forex|fx)$/.test(t)) return { asset: 'currency' };
    if (/^commodit(y|ies)$/.test(t)) return { asset: 'commodity' };
    if (/^ind(ex|ices)$/.test(t)) return { asset: 'index' };
    if (fiatPair(name) || fiatPair(ticker)) return { asset: 'currency' };
    if (isin) return { asset: 'stock' };
    if (COMMOD.test(name) || COMMOD.test(ticker || '')) return { asset: 'commodity' };
    if ((CRYPTO.test(name) || CRYPTO.test(ticker || '')) && !/\b(trust|etf|etp|inc|corp|mining|holdings|plc)\b/i.test(name)) return { asset: 'crypto' };
    if (INDEX.test(s.replace(/\s/g, '')) || INDEX.test((name || '').replace(/\s/g, ''))) return { asset: 'index' };
    return { asset: 'stock', guessed: true };
  }
  /* real (owned) asset vs CFD */
  function classify(rec, ticker) {
    var t = rec.type.toLowerCase().trim(), realType = /^(stocks?|etfs?|crypto(currenc(y|ies))?)$/.test(t) || rec.typeMissing;
    if (realType && rec.lev <= 1 + EPS && rec.long) return { real: true, asset: /crypto/.test(t) ? 'crypto' : 'stock', typeGuessed: rec.typeMissing };
    var u = underlyingOf(rec.name, ticker, rec.typeMissing ? '' : rec.type, rec.isin);
    return { real: false, asset: u.asset, guessed: !!u.guessed };
  }

  /* ---------- assembly ---------- */
  function tickerFromDetails(s) {
    s = String(s || '').trim();
    if (fiatPair(s)) return s.toUpperCase().replace(/\s/g, '');
    var m = /^([^/]+)\//.exec(s); return m ? m[1].trim().toUpperCase() : '';
  }
  function isOpenRow(type) { return /open/i.test(type) && /position/i.test(type) || /^(buy|köp)$/i.test(type); }
  function realAssetType(a) { return /^(stocks?|etfs?|crypto)$/i.test(String(a || '').trim()); }

  function compute(files, opts) {
    opts = opts || {};
    var cfdStock = opts.cfdStockSection === 'A' ? 'A' : 'D', lookup = K4.makeRateLookup(opts.rates);
    var closed = [], activity = [], divs = [], issues = [], notes = {}, ignored = {}, seen = {}, periods = [];
    files.forEach(function (f, fi) {
      var p = f.p || f;
      p.closed.forEach(function (c) {
        var k = c.id + '|' + c.close.ts;
        if (seen[k]) { seen[k].dup++; return; }
        seen[k] = { dup: 0 }; closed.push(Object.assign({ file: fi }, c));
      });
      p.activity.forEach(function (a) { activity.push(Object.assign({ file: fi }, a)); });
      p.dividends.forEach(function (d) { divs.push(Object.assign({ file: fi }, d)); });
      if (p.period) periods.push(p.period);
      (p.errors || []).forEach(function (e) { if (e.code === 'bad-date') issues.push({ level: 'error', code: 'bad-date', line: e.line, file: fi, rawType: e.sheet }); });
    });
    var dups = Object.keys(seen).reduce(function (s, k) { return s + seen[k].dup; }, 0);
    if (dups) issues.push({ level: 'warn', code: 'duplicate-position', extra: { n: dups } });
    // position id → ticker / asset type / opening units (Account Activity)
    var idTicker = {}, idAsset = {}, openAct = {}, nameT = {}, isinT = {};
    activity.forEach(function (a) {
      var tk = tickerFromDetails(a.details);
      if (a.id && tk) idTicker[a.id] = tk;
      if (a.id && a.asset) idAsset[a.id] = a.asset;
      if (a.id && isOpenRow(a.type)) (openAct[a.id] = openAct[a.id] || []).push(a);
    });
    closed.forEach(function (c) { var tk = idTicker[c.id]; if (tk) { if (!nameT[c.name]) nameT[c.name] = tk; if (c.isin && !isinT[c.isin]) isinT[c.isin] = tk; } });
    function keyOf(c) { return idTicker[c.id] || nameT[c.name] || (c.isin && isinT[c.isin]) || c.name || c.isin || ('#' + c.id); }
    // statement start: Account Summary, else the earliest Account Activity row
    var start = null;
    periods.forEach(function (p) { if (p.start && (!start || p.start < start)) start = p.start; });
    if (!start && activity.length) start = activity.map(function (a) { return a.date; }).sort()[0];

    var events = [], cfd = [], realKeys = {}, gaps = {};
    closed.forEach(function (c) {
      var key = keyOf(c), cl = classify(c, idTicker[c.id]);
      if (cl.real) {
        realKeys[key] = cl.asset;
        if (cl.typeGuessed) notes['u-type-missing'] = 1;
        var base = { file: c.file, rawType: (c.type || 'Stocks') + (c.copied ? ' · copy ' + c.copied : ''), ticker: key, asset: cl.asset, currency: 'USD', positionId: c.id, sheet: c.sheet };
        events.push(Object.assign({}, base, { line: c.line, date: c.open.date, ts: c.open.ts, kind: 'BUY', qty: c.units, total: c.amount, rawType: base.rawType + ' – öppnad' }));
        events.push(Object.assign({}, base, { line: c.line, date: c.close.date, ts: c.close.ts, kind: 'SELL', qty: c.units, total: c.amount + (isFinite(c.profit) ? c.profit : NaN), rawType: base.rawType + ' – stängd' }));
        if (start && c.open.date < start && !gaps[key]) gaps[key] = { level: 'warn', code: 'history-gap', ticker: key, line: c.line, file: c.file, date: c.open.date, extra: { start: start } };
      } else cfd.push({ c: c, key: key, cl: cl });
    });
    // still-open real positions (opened in the statement period): buys from Account Activity
    var closedUnits = {}; closed.forEach(function (c) { closedUnits[c.id] = (closedUnits[c.id] || 0) + c.units; });
    var actNoUnits = false;
    Object.keys(openAct).forEach(function (id) {
      openAct[id].forEach(function (a) {
        if (!a.hasUnits || !a.hasAsset) { actNoUnits = true; return; }
        if (!realAssetType(a.asset)) return;
        var have = closedUnits[id] || 0, rest = a.units - have;
        if (!(rest > EPS) || !(Math.abs(a.amount) > 0) || !(a.units > 0)) return;
        var tk = idTicker[id] || tickerFromDetails(a.details) || a.details;
        events.push({ file: a.file, line: a.line, sheet: a.sheet, date: a.date, ts: a.ts, kind: 'BUY', ticker: tk, asset: /crypto/i.test(a.asset) ? 'crypto' : 'stock', qty: rest, total: Math.abs(a.amount) * rest / a.units, currency: 'USD', rawType: a.asset + ' – öppen position (Account Activity)', positionId: id });
      });
    });
    if (actNoUnits) notes['u-activity-old'] = 1;
    // other Account Activity rows: interest / staking income; everything else is ignored (deposits, fees, open/close bookkeeping)
    var haveDivSheet = files.some(function (f) { return (f.p || f).found.indexOf('dividends') >= 0; }), actDivs = [], extraIncome = [];
    activity.forEach(function (a) {
      var t = a.type.toLowerCase();
      if (isOpenRow(a.type)) return;
      if (/dividend/.test(t) || /dividend/i.test(a.details) && /adjustment|payment/.test(t)) { if (!haveDivSheet) actDivs.push(a); else ignored['DIVIDEND (finns på fliken Dividends)'] = (ignored['DIVIDEND (finns på fliken Dividends)'] || 0) + 1; return; }
      if (/interest/.test(t) && !/overnight/.test(t)) { extraIncome.push({ type: 'interest', a: a }); return; }
      if (/staking/.test(t)) { extraIncome.push({ type: 'reward', a: a }); return; }
      var k = a.type.toUpperCase(); ignored[k] = (ignored[k] || 0) + 1;
    });

    var res = K4.compute(events, { rates: opts.rates, fxMode: 'riksbank' });
    Object.keys(gaps).forEach(function (k) { res.issues.push(gaps[k]); });
    res.issues = issues.concat(res.issues);
    Object.keys(ignored).forEach(function (k) { res.ignored[k] = (res.ignored[k] || 0) + ignored[k]; });
    if (Object.keys(realKeys).length) notes['u-history'] = 1;
    if (Object.keys(realKeys).some(function (k) { return realKeys[k] === 'crypto'; })) notes['u-crypto'] = 1;

    function usd(dateIso) { return K4.rateFor(lookup, 'USD', dateIso, NaN, 'riksbank'); }
    // CFD / leveraged / short: one result per closed position
    var SEC = { currency: 'C', commodity: 'D', crypto: 'D', stock: cfdStock, index: cfdStock };
    cfd.forEach(function (x) {
      var c = x.c, fx = usd(c.close.date), over = isFinite(c.over) ? c.over : 0;
      notes['u-cfd'] = 1;
      if (x.cl.asset === 'stock' || x.cl.asset === 'index') notes['u-cfd-otc'] = 1;
      if (x.cl.guessed) notes['u-cfd-guess'] = 1;
      if (!c.long) notes['u-short'] = 1;
      var label = x.key + ' CFD' + (c.long ? '' : ' short');
      if (!isFinite(c.profit)) { res.issues.push({ level: 'error', code: 'bad-amount', ticker: label, line: c.line, file: c.file, date: c.close.date }); return; }
      if (fx.error) { res.issues.push({ level: 'error', code: fx.error, ticker: label, line: c.line, file: c.file, date: c.close.date, extra: 'USD' }); return; }
      var r = c.profit + over, sek = r * fx.rate;
      res.fxUsage.riksbank++;
      res.sales.push({ line: c.line, file: c.file, date: c.close.date, ts: c.close.ts, kind: 'SELL', cfd: true, positionId: c.id, rawType: 'CFD ' + (c.long ? 'long' : 'short') + ' ×' + c.lev + (c.type ? ' · ' + c.type : ''),
        ticker: label, asset: x.cl.asset, underlying: x.cl.asset, section: SEC[x.cl.asset] || 'D', guessed: x.cl.guessed, qty: c.units, price: NaN, total: r, profitUsd: c.profit, overUsd: over, lev: c.lev, long: c.long, openDate: c.open.date,
        currency: 'USD', fx: fx.rate, fxSrc: 'riksbank', rbDate: fx.rbDate, fee: NaN, proceeds: sek > 0 ? sek : 0, omk: sek < 0 ? -sek : 0, result: sek, gav: NaN });
    });
    res.sales.sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0; });
    // dividends (Dividends sheet; else Account Activity dividend rows, net only)
    var dseen = {};
    divs.forEach(function (d) {
      var k = d.id + '|' + d.date + '|' + d.net; if (dseen[k]) return; dseen[k] = 1;
      var wht = isFinite(d.wht) ? d.wht : isFinite(d.rate) && d.rate > 0 && d.rate < 100 ? d.net * d.rate / (100 - d.rate) : 0, gross = d.net + wht, fx = usd(d.date);
      res.income.push({ type: 'dividend', ticker: idTicker[d.id] || (d.isin && isinT[d.isin]) || nameT[d.name] || d.name || d.isin, name: d.name, isin: d.isin, date: d.date, line: d.line, file: d.file, currency: 'USD', amount: gross, net: d.net, wht: wht, rate: d.rate, sek: fx.error ? null : gross * fx.rate, whtSek: fx.error ? null : wht * fx.rate, fx: fx.rate, rawType: 'Dividends' });
    });
    actDivs.forEach(function (a) {
      var fx = usd(a.date), net = Math.abs(a.amount);
      notes['u-div-net'] = 1;
      res.income.push({ type: 'dividend', ticker: idTicker[a.id] || a.details, date: a.date, line: a.line, file: a.file, currency: 'USD', amount: net, net: net, wht: NaN, sek: fx.error ? null : net * fx.rate, whtSek: null, fx: fx.rate, rawType: a.type + ' (Account Activity, netto)' });
    });
    extraIncome.forEach(function (x) {
      var a = x.a, fx = usd(a.date), amt = Math.abs(a.amount);
      if (!isFinite(amt)) return;
      notes[x.type === 'reward' ? 'u-reward' : 'u-interest'] = 1;
      res.income.push({ type: x.type, ticker: tickerFromDetails(a.details) || a.details, date: a.date, line: a.line, file: a.file, currency: 'USD', amount: amt, sek: fx.error ? null : amt * fx.rate, fx: fx.rate, rawType: a.type });
    });
    if (res.income.some(function (i) { return i.type === 'dividend'; })) notes['u-dividend'] = 1;
    if (closed.length || activity.length) notes['u-usd-cash'] = 1;
    res.notes = Object.keys(notes).concat(res.notes.filter(function (n) { return !notes[n]; }));
    var years = {}; res.sales.forEach(function (s) { years[s.date.slice(0, 4)] = 1; }); res.income.forEach(function (s) { years[s.date.slice(0, 4)] = 1; });
    res.years = Object.keys(years).sort();
    res.cfd = res.sales.filter(function (s) { return s.cfd; });
    res.start = start; res.cfdStockSection = cfdStock;
    res.counts = { closed: closed.length, real: closed.length - cfd.length, cfd: cfd.length, activity: activity.length, dividends: divs.length, copied: closed.filter(function (c) { return c.copied; }).length };
    return res;
  }

  return { parseFile: parseFile, parseSheets: parseSheets, detect: detect, compute: compute, classify: classify, underlyingOf: underlyingOf, num: num, date: date, summaryPeriod: summaryPeriod, COLS: COLS };
});
