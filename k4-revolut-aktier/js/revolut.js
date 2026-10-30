/* Revolut stock-statement parser (UMD). Runs in the browser and in Node tests. No network.
 * Supported input: Revolut "Account statement" / transaction log for stocks & ETFs,
 *   columns: Date, Ticker, Type, Quantity, Price per share, Total Amount, Currency, FX Rate
 *   - classic value style: plain numbers or "$1,234.56", types "BUY"/"SELL"/"BUY - MARKET"
 *   - newer value style: "USD 1,234.56" / "EUR -217.14", types "BUY - LIMIT", "SELL - STOP", µs timestamps
 *   - as .csv (comma or semicolon; decimal comma if re-saved by Swedish Excel) or as .xlsx
 * Also recognised: Revolut *crypto* account statement ("Symbol, Type, Quantity, Price, Value, Fees, Date"; sv types
 *   Köp/Sälj/Skicka/Ta emot, amounts "2 480,50 SEK"), incl. copies re-saved via Google Sheets/Excel (mojibake "KÃ¶p",
 *   decimal comma lost in Quantity → restored from Value/Price). Every row becomes kind CRYPTO (K4 section D, not section A).
 * Detected and refused: Revolut "closed positions"/P&L summary (no full buy history → average cost impossible).
 * Output events: {line, date:'YYYY-MM-DD', ts, ticker, kind, rawType, qty, price, total, currency, fx, fee}
 *   kind: BUY | SELL | SPLIT | IGNORE (cash/dividend/fee/transfer) | UNKNOWN */
(function (root, factory) {
  var m = factory(root.CSV || (typeof require === 'function' ? require('./csv.js') : null));
  if (typeof module === 'object' && module.exports) module.exports = m; else root.REVOLUT = m;
})(typeof self !== 'undefined' ? self : this, function (CSV) {
  'use strict';
  var CRYPTO = /^(BTC|ETH|XRP|ADA|DOGE|DOT|LTC|BCH|XLM|MATIC|POL|SHIB|AVAX|USDT|USDC|TRX|BNB|ETC|XTZ|EOS|ATOM|ALGO|PEPE|SOL|LINK|UNI|AAVE|NEAR|ARB|OP|SUI|APT|TON|BONK|WIF|FLOKI|HBAR|ICP|FIL|GRT|MKR|SAND|MANA|CRV|COMP|SNX|YFI|1INCH|DAI|EURC|PYUSD)(-?USD|-?EUR)?$/i;

  /* UTF-8 text that was decoded as Latin-1/Windows-1252 somewhere on the way ("KÃ¶p", "2Â 480,50") → repaired. */
  var W1252 = { 0x20ac: 0x80, 0x201a: 0x82, 0x192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87, 0x2c6: 0x88, 0x2030: 0x89, 0x160: 0x8a, 0x2039: 0x8b, 0x152: 0x8c, 0x17d: 0x8e, 0x2018: 0x91, 0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2dc: 0x98, 0x2122: 0x99, 0x161: 0x9a, 0x203a: 0x9b, 0x153: 0x9c, 0x17e: 0x9e, 0x178: 0x9f };
  function demojibake(v) {
    if (typeof v !== 'string' || !/[\u00c2-\u00f4][\u0080-\u00bf\u0152-\u2122]/.test(v)) return v;
    var b = [];
    for (var i = 0; i < v.length; i++) { var c = v.charCodeAt(i); if (c > 0xff) c = W1252[c]; if (c == null) return v; b.push(c); }
    try { return new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(b)); } catch (e) { return v; }
  }
  function norm(h) { return String(demojibake(h) || '').replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_]+/g, ' '); }
  var ALIASES = {
    date: ['date', 'datum', 'time', 'date time'], ticker: ['ticker', 'symbol'], type: ['type', 'typ'],
    qty: ['quantity', 'antal', 'qty'], price: ['price per share', 'price', 'pris per aktie', 'pris'],
    total: ['total amount', 'total', 'amount', 'belopp', 'value', 'värde'], currency: ['currency', 'valuta'],
    fx: ['fx rate', 'fx', 'exchange rate', 'växelkurs'], fee: ['fee', 'fees', 'commission', 'avgift', 'avgifter', 'courtage']
  };
  function mapHeader(hdr) {
    var n = hdr.map(norm), idx = {};
    Object.keys(ALIASES).forEach(function (k) { for (var i = 0; i < n.length; i++) if (ALIASES[k].indexOf(n[i]) >= 0) { idx[k] = i; break; } });
    return { idx: idx, n: n };
  }
  function isClosedPositions(n) {
    var s = n.join('|');
    return /date acquired/.test(s) && /date sold/.test(s) || /cost basis/.test(s) && /(gross )?proceeds/.test(s) || /gross pnl|net pnl/.test(s);
  }

  /* number: "$1,234.56", "USD -217.14", "-€5.00", "1 234,56", "0.12345678" → Number (NaN when not a number) */
  function num(v, decimalComma) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).trim();
    if (!s) return NaN;
    var neg = /^\(.*\)$/.test(s) || /^-|^[A-Z]{3}\s*-|^[^\d-]+-/.test(s) || /-$/.test(s);
    s = s.replace(/[A-Za-z$€£¥\s\u00a0()+\-]/g, '');
    if (!s) return NaN;
    if (decimalComma) s = s.replace(/\./g, '').replace(',', '.');
    else if (/,\d{1,2}$/.test(s) && s.indexOf('.') < 0 && !/,\d{3}(,|$)/.test(s)) s = s.replace(',', '.'); // "12,5"
    else s = s.replace(/,/g, '');
    if (!/^\d*\.?\d+$/.test(s) && !/^\d+\.$/.test(s)) return NaN;
    var x = parseFloat(s);
    return neg ? -x : x;
  }
  function curOf(v) { var m = /^\s*-?\s*([A-Z]{3})\b/.exec(String(v || '')) || /\d\s*([A-Z]{3})\s*$/.exec(String(v || '')); if (m) return m[1]; var s = String(v || ''); if (s.indexOf('$') >= 0) return 'USD'; if (s.indexOf('€') >= 0) return 'EUR'; if (s.indexOf('£') >= 0) return 'GBP'; return ''; }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  /* date: ISO with ms/µs "2024-03-01T14:30:12.123456Z", "2024-03-01 14:30:12", "01/03/2024 14:30" (D/M/Y), Excel serial */
  function date(v) {
    if (typeof v === 'number' && v > 20000 && v < 80000) { // Excel serial (1900 system)
      var d = new Date(Math.round((v - 25569) * 86400000));
      return { date: d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()), ts: d.toISOString() };
    }
    var s = String(v || '').trim(), m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d+))?)?)?/.exec(s);
    if (m) return { date: m[1] + '-' + m[2] + '-' + m[3], ts: m[1] + '-' + m[2] + '-' + m[3] + 'T' + (m[4] || '00') + ':' + (m[5] || '00') + ':' + (m[6] || '00') + '.' + ((m[7] || '0') + '000000').slice(0, 6) };
    m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})(?:,?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/.exec(s);
    if (m) return { date: m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]), ts: m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]) + 'T' + pad(+(m[4] || 0)) + ':' + (m[5] || '00') + ':' + (m[6] || '00') + '.000000' };
    m = /^(\d{1,2})\s+([a-zåäö]+)\.?\s+(\d{4}),?\s*(?:(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?)?/i.exec(s) ||
        /^([a-z]+)\.?\s+(\d{1,2}),?\s+(\d{4}),?\s*(?:(\d{1,2})[:.](\d{2})(?:[:.](\d{2}))?\s*(am|pm)?)?/i.exec(s);
    if (m) {
      var dm = /^\d/.test(m[1]) ? +m[1] : +m[2], mo = MONTHS[(/^\d/.test(m[1]) ? m[2] : m[1]).toLowerCase().slice(0, 3)], h = +(m[4] || 0);
      if (!mo || !(dm >= 1 && dm <= 31)) return null;
      if (m[7]) { var pm = /pm/i.test(m[7]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; }
      var iso = m[3] + '-' + pad(mo) + '-' + pad(dm);
      return { date: iso, ts: iso + 'T' + pad(h) + ':' + (m[5] || '00') + ':' + (m[6] || '00') + '.000000' };
    }
    return null;
  }
  var MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, maj: 5, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12 };

  function kindOf(type) {
    var t = String(type || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (/^(BUY|SELL)( ?- ?(MARKET|LIMIT|STOP|STOP LIMIT|STOP-LIMIT|BOND|ROBO|AUTO))?$/.test(t)) return t.slice(0, t.charAt(0) === 'B' ? 3 : 4);
    if (/^KÖP( ?- ?(MARKNAD|LIMIT|STOPP?|OBLIGATION))?$/.test(t)) return 'BUY';
    if (/^SÄLJ( ?- ?(MARKNAD|LIMIT|STOPP?|OBLIGATION))?$/.test(t)) return 'SELL';
    if (/^(COUPON|KUPONG|BOND INTEREST|OBLIGATIONSRÄNTA)/.test(t)) return 'INCOME';
    if (/^UTDELNING|^KÄLLSKATT|^INSÄTTNING|^UTTAG$|^RÄNTA|^FÖRVARINGSAVGIFT|AVGIFT$/.test(t)) return 'IGNORE';
    if (/^STOCK SPLIT|SPLIT$/.test(t)) return 'SPLIT';
    if (/^CASH (TOP-UP|TOPUP|WITHDRAWAL)|^DIVIDEND|^CUSTODY FEE|^TRANSFER FROM REVOLUT|^TRANSFER .*REVOLUT|^INTEREST|^TAX|WITHHOLDING|FEE$|^ROBO.*FEE|MANAGEMENT FEE/.test(t)) return 'IGNORE';
    return 'UNKNOWN';
  }
  /* Crypto statement / Revolut X types (en, sv, pl; Revolut X adds " — Revolut X"). Rewards before stake (Staking reward). */
  function cryptoKind(type) {
    var t = String(type || '').trim().toUpperCase().replace(/\s*[\u2014\u2013-]+\s*REVOLUT X$/, '').replace(/\s+/g, ' ');
    if (/^(BUY|KÖP|KUPNO)\b/.test(t)) return 'BUY';
    if (/^(SELL|SÄLJ|SPRZEDAŻ)\b/.test(t)) return 'SELL';
    if (/REWARD|BELÖNING|AIRDROP|BONUS|LEARN|NAGRODA/.test(t)) return 'REWARD';
    if (/^(UN)?STAKE|^STAKING|^INSATS|^(AVSLUTA|AVBRYT) INSATS/.test(t)) return 'IGNORE';
    if (/^(SEND|SENT|SKICKA|SKICKAT|WYSŁANIE|WITHDRAWAL)\b/.test(t)) return 'XFER_OUT';
    if (/^(RECEIVE|RECEIVED|TA EMOT|MOTTAGET|MOTTAGEN|ODBIÓR|DEPOSIT)\b/.test(t)) return 'XFER_IN';
    if (/^(OTHER|INNE|ÖVRIGT|ANNAT)$/.test(t)) return 'OTHER';
    return 'UNKNOWN';
  }
  var FIAT = {}; 'SEK USD EUR GBP NOK DKK CHF PLN CZK HUF RON BGN JPY CAD AUD NZD SGD HKD ILS TRY MXN ZAR ISK CNY INR THB AED SAR QAR RSD UAH KZT'.split(' ').forEach(function (c) { FIAT[c] = 1; });
  var METALS = { XAU: 'Guld', XAG: 'Silver', XPT: 'Platina', XPD: 'Palladium' };
  var ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/;
  /* asset class → K4 section is decided in k4.js (stock/fund → A, bond/currency → C, crypto/commodity → D) */
  function assetOf(ticker, rawType) {
    if (METALS[ticker]) return 'commodity';
    if (CRYPTO.test(ticker) || /CRYPTO/i.test(rawType || '')) return 'crypto';
    if (ISIN.test(ticker) || /BOND|OBLIGATION/i.test(rawType || '')) return 'bond';
    return 'stock';
  }

  function rowsToEvents(rows, decimalComma, fileLabel) {
    var res = { events: [], errors: [], format: null, rows: 0 };
    var hi = -1;
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var n = rows[i].map(norm);
      if (isClosedPositions(n)) { res.format = 'closed-positions'; res.errors.push({ code: 'closed-positions' }); return res; }
      if ((n.indexOf('type') >= 0 || n.indexOf('typ') >= 0) && (n.indexOf('ticker') >= 0 || n.indexOf('symbol') >= 0) && (n.indexOf('quantity') >= 0 || n.indexOf('antal') >= 0)) { hi = i; break; }
    }
    if (hi < 0) { res.errors.push({ code: 'no-header' }); return res; }
    var H = mapHeader(rows[hi]), x = H.idx;
    /* Revolut crypto statement: Symbol + Value (+ Fees), no Ticker / Total Amount / FX Rate. */
    var crypto = H.n.indexOf('symbol') >= 0 && H.n.indexOf('ticker') < 0 && (H.n.indexOf('value') >= 0 || H.n.indexOf('värde') >= 0) && H.n.indexOf('total amount') < 0 && x.fx == null;
    var miss = ['date', 'ticker', 'type', 'qty', 'total'].filter(function (k) { return x[k] == null; });
    if (x.currency == null && miss.indexOf('total') < 0) { // currency must then be inside the amounts ("USD 12.00", "2 480,50 SEK")
      var hasCur = false;
      for (var q = hi + 1; q < Math.min(rows.length, hi + 30) && !hasCur; q++) if (rows[q] && curOf(demojibake(rows[q][x.total]))) hasCur = true;
      if (!hasCur && rows.length > hi + 1) miss.push('currency');
    } else if (x.currency == null) miss.push('currency');
    if (miss.length) { res.errors.push({ code: 'missing-columns', cols: miss }); return res; }
    /* Swedish number style in text cells ("2 480,50 SEK", "6,40 SEK") → decimal comma for the whole file. */
    if (!decimalComma) {
      var sw = 0, en = 0;
      for (var q2 = hi + 1; q2 < Math.min(rows.length, hi + 200); q2++) {
        var rr = rows[q2] || [];
        [x.total, x.price, x.fee].forEach(function (ci) {
          var c = ci == null ? '' : String(demojibake(rr[ci]) == null ? '' : demojibake(rr[ci]));
          if (/\d,\d{2}\s*[A-Z]{3}$|\d\s\d{3},\d/.test(c)) sw++; else if (/\d\.\d{2}(\s*[A-Z]{3})?$|\d,\d{3}\.\d/.test(c)) en++;
        });
      }
      if (sw > en) decimalComma = true;
    }
    res.qtyRestored = 0;
    var styles = { ccy: 0, sym: 0, plain: 0 }, revx = 0;
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;
      res.rows++;
      var g = function (k) { return x[k] == null ? '' : demojibake(row[x[k]]); };
      var d = date(g('date'));
      var totalRaw = g('total'), rawType = String(g('type') || '').trim();
      if (/^[A-Z]{3}\s/.test(String(totalRaw))) styles.ccy++; else if (/[$€£]/.test(String(totalRaw))) styles.sym++; else styles.plain++;
      var ev = {
        line: r + 1, date: d && d.date, ts: d && d.ts, ticker: String(g('ticker') || '').trim().toUpperCase(),
        rawType: rawType, kind: kindOf(rawType), qty: num(g('qty'), decimalComma), price: num(g('price'), decimalComma),
        total: num(totalRaw, decimalComma), currency: (String(g('currency') || '').trim().toUpperCase() || curOf(totalRaw) || curOf(g('price'))),
        fx: num(g('fx'), decimalComma), fee: x.fee != null ? num(g('fee'), decimalComma) : NaN
      };
      if (!d) { res.errors.push({ code: 'bad-date', line: ev.line, value: String(g('date')) }); continue; }
      /* Quantity stored as a number with its decimal comma lost (e.g. "42,718305" read as 42718305 by a
         spreadsheet in an English locale): restore the power of ten that matches Value / Price. */
      if (isFinite(ev.qty) && ev.qty !== 0 && Math.abs(ev.price) > 0 && Math.abs(ev.total) > 0) {
        var implied = Math.abs(ev.total) / Math.abs(ev.price), aq = Math.abs(ev.qty);
        if (Math.abs(aq / implied - 1) > 0.05 && Math.round(aq) === aq && aq > implied) {
          for (var k = 1; k <= 18; k++) {
            var cand = aq / Math.pow(10, k);
            if (Math.abs(cand / implied - 1) <= 0.03) { ev.qty = (ev.qty < 0 ? -1 : 1) * parseFloat(cand.toPrecision(15)); ev.qtyRestored = true; res.qtyRestored++; break; }
            if (cand < implied) break;
          }
        }
      }
      if (crypto) {
        if (/revolut x/i.test(rawType)) revx++;
        ev.kind = cryptoKind(rawType); ev.feeSep = true; // Value = quantity × price before the fee; Fees is a separate column
        if (FIAT[ev.ticker] || ev.kind === 'OTHER' && !(Math.abs(ev.qty) > 0)) ev.kind = 'IGNORE'; // fiat top-ups/withdrawals in the crypto/X statement
        else if (ev.kind === 'OTHER') ev.kind = 'UNKNOWN';
        ev.asset = METALS[ev.ticker] ? 'commodity' : 'crypto';
      } else {
        ev.asset = assetOf(ev.ticker, rawType);
        if (/ROBO/i.test(rawType)) res.robo = true;
        if (ev.kind === 'INCOME') { ev.income = 'coupon'; ev.asset = null; }
      }
      res.events.push(ev);
    }
    res.format = crypto ? (revx ? 'revolut-x' : 'revolut-crypto') : styles.ccy > styles.sym + styles.plain ? 'revolut-log-ccy' : 'revolut-log-classic';
    if (fileLabel) res.format += '-' + fileLabel;
    return res;
  }

  /* ---------- other Revolut statements ---------- */
  var COLS = {
    type: ['type', 'typ'], product: ['product', 'produkt', 'product name', 'produktnamn'],
    started: ['started date', 'startdatum', 'påbörjat datum', 'påbörjad', 'startad'], completed: ['completed date', 'slutfört datum', 'slutförd', 'genomfört datum', 'slutdatum', 'datum för slutförande'],
    description: ['description', 'beskrivning'], amount: ['amount', 'belopp'], fee: ['fee', 'avgift', 'fees', 'avgifter'], currency: ['currency', 'valuta'],
    state: ['state', 'status'], balance: ['balance', 'saldo'], fiat: ['fiat amount', 'fiatbelopp', 'belopp i fiat'], fiatInc: ['fiat amount (inc. fees)', 'fiatbelopp (inkl. avgifter)', 'belopp i fiat (inkl. avgifter)'],
    base: ['base currency', 'basvaluta'], date: ['date', 'datum'], value: ['value', 'värde'], pps: ['price per share', 'pris per andel', 'pris per aktie', 'price'],
    shares: ['quantity of shares', 'antal andelar', 'quantity', 'antal'], moneyIn: ['money in', 'pengar in', 'insatt', 'in'], moneyOut: ['money out', 'pengar ut', 'uttaget', 'ut']
  };
  function cols(n) { var x = {}; Object.keys(COLS).forEach(function (k) { for (var i = 0; i < n.length; i++) if (COLS[k].indexOf(n[i]) >= 0) { x[k] = i; break; } }); return x; }
  function swedishNumbers(rows, hi, idx) {
    var sw = 0, en = 0;
    for (var q = hi + 1; q < Math.min(rows.length, hi + 300); q++) (idx || []).forEach(function (ci) {
      if (ci == null) return; var c = String(demojibake((rows[q] || [])[ci]) == null ? '' : demojibake(rows[q][ci]));
      if (/\d,\d{1,8}\s*([A-Z]{3}|[$€£])?$/.test(c) && !/\d\.\d{3},/.test(c) && !/,\d{3}(\.|$)/.test(c) || /\d\s\d{3},\d/.test(c)) sw++; else if (/\d\.\d+/.test(c)) en++;
    });
    return sw > en;
  }
  var DONE = /^(COMPLETED|SLUTFÖRD|SLUTFÖRT|GENOMFÖRD|GENOMFÖRT|AVSLUTAD|KLAR)$/;
  /* Revolut account statement (current-account pockets, incl. currency exchange, and the pre-2025 crypto/commodities statement
     with Fiat amount / Base currency). Every non-SEK holding is an asset for Swedish tax: foreign currency (K4 C), crypto and
     precious metals (K4 D). Each inflow is an acquisition and each outflow a disposal (genomsnittsmetoden per currency/coin). */
  function bankEvents(rows, hi, x, dc, res) {
    var legacy = x.fiat != null || x.fiatInc != null, recs = [];
    res.format = legacy ? 'revolut-legacy-crypto' : 'revolut-account';
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;
      res.rows++;
      var g = function (k) { return x[k] == null ? '' : demojibake(row[x[k]]); };
      var d = date(g('completed')) || date(g('started')), st = date(g('started')) || d;
      if (!d) { res.errors.push({ code: 'bad-date', line: r + 1, value: String(g('completed') || g('started')) }); continue; }
      recs.push({ line: r + 1, date: d.date, ts: d.ts, key: st.ts, type: String(g('type') || '').trim().toUpperCase(), desc: String(g('description') || '').trim(), product: String(g('product') || '').trim(),
        cur: String(g('currency') || '').trim().toUpperCase(), amt: num(g('amount'), dc), fee: num(g('fee'), dc) || 0, bal: num(g('balance'), dc), state: String(g('state') || '').trim().toUpperCase(),
        fiat: num(g('fiatInc') !== '' ? g('fiatInc') : g('fiat'), dc), base: String(g('base') || '').trim().toUpperCase() });
    }
    var groups = {};
    recs.forEach(function (c) { (groups[c.key] || (groups[c.key] = [])).push(c); });
    function raw(c) { return c.type + (c.desc ? ' – ' + c.desc : ''); }
    function isInterest(c) { return /^(INTEREST|RÄNTA)/.test(c.type) || /\binterest\b|\bränta\b/i.test(c.desc) && !/^EXCHANGE|^VÄXLING/.test(c.type); }
    function isReward(c) { return /REWARD|BELÖNING|STAKING|AIRDROP|CASHBACK/i.test(c.type + ' ' + c.desc); }
    recs.forEach(function (c) {
      var ev = { line: c.line, date: c.date, ts: c.ts, ticker: c.cur, rawType: raw(c), qty: NaN, price: NaN, total: NaN, currency: '', fx: NaN, fee: NaN };
      var asset = METALS[c.cur] ? 'commodity' : FIAT[c.cur] ? (c.cur === 'SEK' ? null : 'currency') : c.cur ? 'crypto' : null;
      if (c.state && !DONE.test(c.state)) { ev.kind = 'IGNORE'; ev.rawType = 'STATUS ' + c.state; return res.events.push(ev); }
      if (!isFinite(c.amt)) { ev.kind = 'IGNORE'; ev.rawType = 'TOM RAD'; return res.events.push(ev); }
      var net = c.amt - Math.abs(c.fee), grp = groups[c.key] || [];
      // same holding moved between pockets (Current ↔ Savings / vault, balance migration): not a disposal
      var twin = grp.filter(function (o) { return o !== c && o.cur === c.cur && Math.abs(o.amt + c.amt) < 1e-9; });
      if (twin.length && !/^EXCHANGE|^VÄXLING/.test(c.type) || /balance migration|saldoflytt/i.test(c.desc)) { ev.kind = 'IGNORE'; ev.rawType = 'INTERN ÖVERFÖRING'; return res.events.push(ev); }
      if (legacy && FIAT[c.cur]) { ev.kind = 'IGNORE'; ev.rawType = c.cur + '-RADER (' + (c.type || '?') + ')'; ev.quiet = true; return res.events.push(ev); }
      if (!asset) {
        if (c.cur === 'SEK' && isInterest(c) && c.amt > 0) return res.events.push(Object.assign(ev, { kind: 'INCOME', income: 'interest', total: c.amt, currency: 'SEK', asset: null }));
        ev.kind = 'IGNORE'; ev.rawType = c.cur ? c.cur + '-RADER (' + (c.type || '?') + ')' : 'UTAN VALUTA'; ev.quiet = true; return res.events.push(ev);
      }
      ev.asset = asset; ev.product = c.product;
      if (isInterest(c) && c.amt > 0 && asset === 'currency') {
        res.events.push(Object.assign({}, ev, { kind: 'INCOME', income: 'interest', total: c.amt, currency: c.cur, asset: null }));
        return res.events.push(Object.assign(ev, { kind: 'BUY', qty: net, total: net, price: 1, currency: c.cur, rawType: ev.rawType + ' (förvärv till marknadsvärde)' }));
      }
      var q = Math.abs(net);
      if (!(q > 0)) { ev.kind = 'IGNORE'; ev.rawType = 'NOLLBELOPP'; return res.events.push(ev); }
      // value in money: fiat column (legacy), else the other leg of an exchange, else the market rate (currency only)
      var other = grp.filter(function (o) { return o !== c && o.cur !== c.cur && FIAT[o.cur] && isFinite(o.amt) && (o.amt > 0) !== (c.amt > 0); });
      var leg = other.filter(function (o) { return o.cur === 'SEK'; })[0] || (asset !== 'currency' ? other[0] : null);
      if (legacy && isFinite(c.fiat) && c.fiat !== 0 && c.base) { ev.total = Math.abs(c.fiat); ev.currency = c.base; }
      else if (leg && /^EXCHANGE|^VÄXLING|^BUY|^SELL|^KÖP|^SÄLJ/.test(c.type + ' ' + leg.type)) { ev.total = Math.abs(leg.amt - Math.abs(leg.fee)); ev.currency = leg.cur; ev.paired = leg.line; }
      else if (asset === 'currency') { ev.total = q; ev.currency = c.cur; ev.marketRate = true; }
      ev.qty = q; ev.price = isFinite(ev.total) ? ev.total / q : NaN;
      if (asset !== 'currency' && isReward(c) && net > 0) ev.kind = 'REWARD';
      else if (asset !== 'currency' && /^(TRANSFER|SEND|WITHDRAW|RECEIVE|DEPOSIT|ÖVERFÖRING|SKICKA|TA EMOT|UTTAG|INSÄTTNING)/.test(c.type)) ev.kind = net < 0 ? 'XFER_OUT' : 'XFER_IN'; // moved to/from an outside wallet: not a sale
      else if (asset !== 'currency' && !isFinite(ev.total)) ev.kind = net < 0 ? 'XFER_OUT' : 'XFER_IN';
      else ev.kind = net > 0 ? 'BUY' : 'SELL';
      if (asset === 'currency' && ev.kind === 'BUY' && !ev.paired) ev.rawType += ' (förvärv till marknadsvärde)';
      res.events.push(ev);
    });
    // opening balance not explained by the file → acquisition cost unknown
    var seen = {};
    recs.slice().sort(function (a, b) { return a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : a.line - b.line; }).forEach(function (c) {
      if (seen[c.cur] || !c.cur || c.cur === 'SEK' || legacy && FIAT[c.cur] || !isFinite(c.bal) || !isFinite(c.amt) || c.state && !DONE.test(c.state)) return;
      seen[c.cur] = 1;
      var open = c.bal - (c.amt - Math.abs(c.fee));
      if (Math.abs(open) > 1e-6 * Math.max(1, Math.abs(c.bal)) && Math.abs(open) > 1e-8) res.events.push({ line: c.line, date: c.date, ts: c.ts.slice(0, 11) + '00:00:00.000000', ticker: c.cur, kind: 'OPENING', rawType: 'INGÅENDE SALDO', qty: open, asset: METALS[c.cur] ? 'commodity' : FIAT[c.cur] ? 'currency' : 'crypto' });
    });
    return res;
  }
  /* Flexible Cash Funds (money-market fund) statement: Date, Description, Value, Price per share, Quantity of shares. */
  function fundEvents(rows, hi, x, dc, res) {
    res.format = 'revolut-mmf';
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;
      res.rows++;
      var g = function (k) { return x[k] == null ? '' : demojibake(row[x[k]]); };
      var d = date(g('date')), desc = String(g('description') || '').replace(/\s+/g, ' ').trim(), D = desc.toUpperCase();
      if (!d) { res.errors.push({ code: 'bad-date', line: r + 1, value: String(g('date')) }); continue; }
      var isin = /\b([A-Z]{2}[A-Z0-9]{9}\d)\b/.exec(D), val = num(g('value'), dc), cur = curOf(g('value')) || curOf(desc.replace(/^\S+\s+/, '')) || '';
      var ev = { line: r + 1, date: d.date, ts: d.ts, ticker: isin ? isin[1] : desc.slice(0, 40), rawType: desc, qty: Math.abs(num(g('shares'), dc)), price: Math.abs(num(g('pps'), dc)), total: Math.abs(val), currency: cur, fx: NaN, fee: NaN, asset: 'fund', fund: 'mmf' };
      if (/^(BUY|KÖP)\b/.test(D)) ev.kind = 'BUY';
      else if (/^(SELL|SÄLJ)\b/.test(D)) ev.kind = 'SELL';
      else if (/INTEREST PAID|RÄNTA (UTBETALD|BETALD)|UTBETALD RÄNTA|DIVIDEND|UTDELNING/.test(D)) { ev.kind = 'INCOME'; ev.income = 'fund-distribution'; ev.asset = null; }
      else if (/SERVICE FEE|AVGIFT|REINVEST|ÅTERINVEST/.test(D)) { ev.kind = 'IGNORE'; ev.rawType = /REINVEST|ÅTERINVEST/.test(D) ? 'INTEREST REINVESTED (köpet finns som egen rad)' : 'SERVICE FEE (fondavgift)'; }
      else ev.kind = 'UNKNOWN';
      res.events.push(ev);
    }
    return res;
  }
  /* Savings / Instant Access Savings statement: Completed Date, Product name, Description, Interest rate, Money out, Money in, Balance. Interest only. */
  function savingsEvents(rows, hi, x, dc, res) {
    res.format = 'revolut-savings';
    for (var r = hi + 1; r < rows.length; r++) {
      var row = rows[r];
      if (!row || row.every(function (c) { return String(c == null ? '' : c).trim() === ''; })) continue;
      res.rows++;
      var g = function (k) { return x[k] == null ? '' : demojibake(row[x[k]]); };
      var d = date(g('completed')) || date(g('date')), desc = String(g('description') || '').replace(/\s+/g, ' ').trim();
      if (!d) { res.errors.push({ code: 'bad-date', line: r + 1, value: String(g('completed') || g('date')) }); continue; }
      var mi = num(g('moneyIn'), dc), pc = (/\b([A-Z]{3})\b/.exec(String(g('product'))) || [])[1], cur = curOf(g('moneyIn')) || curOf(g('moneyOut')) || curOf(g('balance')) || (FIAT[pc] ? pc : '');
      if (!cur) { cur = 'SEK'; res.curAssumed = true; }
      var ev = { line: r + 1, date: d.date, ts: d.ts, ticker: '', rawType: desc.split(/ earned| on /i)[0] || 'SAVINGS', qty: NaN, price: NaN, total: NaN, currency: cur, fx: NaN, fee: NaN };
      if (/interest|ränta/i.test(desc) && mi > 0) { ev.kind = 'INCOME'; ev.income = 'interest'; ev.total = mi; }
      else { ev.kind = 'IGNORE'; ev.rawType = 'SPARKONTO: ' + (desc.split(' ')[0] || '?').toUpperCase(); }
      res.events.push(ev);
    }
    return res;
  }
  /* Dispatch on the header row. */
  function parseRows(rows, decimalComma, fileLabel) {
    for (var c = 0; c < Math.min(rows.length, 400); c++) {
      var first = norm((rows[c] || [])[0]);
      if (/^(summary for|transactions for|current accounts summar|sammanfattning för|transaktioner för)/.test(first)) { var rc = { events: [], errors: [{ code: 'consolidated' }], format: 'consolidated', rows: 0 }; return rc; }
    }
    for (var i = 0; i < Math.min(rows.length, 15); i++) {
      var n = (rows[i] || []).map(norm), x = cols(n), res = { events: [], errors: [], format: null, rows: 0 }, out = null;
      if (isClosedPositions(n)) break;
      if (x.type != null && (x.started != null || x.completed != null) && x.amount != null && x.currency != null && n.indexOf('ticker') < 0 && n.indexOf('symbol') < 0)
        out = bankEvents(rows, i, x, decimalComma || swedishNumbers(rows, i, [x.amount, x.fee, x.balance, x.fiat, x.fiatInc]), res);
      else if (x.description != null && x.value != null && x.shares != null && x.type == null && n.indexOf('ticker') < 0 && n.indexOf('symbol') < 0)
        out = fundEvents(rows, i, x, decimalComma || swedishNumbers(rows, i, [x.value, x.shares]), res);
      else if (x.moneyIn != null && x.moneyOut != null && x.description != null && n.indexOf('ticker') < 0)
        out = savingsEvents(rows, i, x, decimalComma || swedishNumbers(rows, i, [x.moneyIn, x.moneyOut, x.balance]), res);
      if (out) { if (fileLabel) out.format += '-' + fileLabel; return out; }
    }
    return rowsToEvents(rows, decimalComma, fileLabel);
  }

  function parseCSV(text) {
    var delim = CSV.detectDelimiter(text), pr = CSV.parse(text, delim), rows = [pr.header].concat(pr.rows);
    return parseRows(rows, delim === ';' && /\d,\d/.test(text.slice(0, 5000)));
  }

  /* ---------- minimal XLSX reader (first worksheet; inflate via DecompressionStream) ---------- */
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('no-inflate'));
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter(); w.write(data); w.close();
    return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); });
  }
  function unzip(bytes) {
    var e = -1; for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (u32(bytes, i) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.reject(new Error('not-zip'));
    var cnt = u16(bytes, e + 10), off = u32(bytes, e + 16), files = {}, jobs = [], dec = new TextDecoder('utf-8');
    for (var k = 0; k < cnt; k++) {
      if (u32(bytes, off) !== 0x02014b50) break;
      var method = u16(bytes, off + 10), csize = u32(bytes, off + 20), nlen = u16(bytes, off + 28), xlen = u16(bytes, off + 30), clen = u16(bytes, off + 32), loff = u32(bytes, off + 42);
      var name = dec.decode(bytes.subarray(off + 46, off + 46 + nlen));
      var ds = loff + 30 + u16(bytes, loff + 26) + u16(bytes, loff + 28), data = bytes.subarray(ds, ds + csize);
      (function (name, method, data) {
        jobs.push((method === 0 ? Promise.resolve(data) : inflateRaw(data)).then(function (b) { files[name] = dec.decode(b); }));
      })(name, method, data);
      off += 46 + nlen + xlen + clen;
    }
    return Promise.all(jobs).then(function () { return files; });
  }
  function xmlText(s) { return s.replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, function (m, c) { return String.fromCharCode(+c); }).replace(/&amp;/g, '&'); }
  function colIdx(ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
  function sheetRows(sheetXml, shared) {
    var rows = [], rre = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g, rm;
    while ((rm = rre.exec(sheetXml))) {
      var row = [], cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, auto = 0;
      var body = rm[1] || '';
      while ((cm = cre.exec(body))) {
        var attrs = cm[1], inner = cm[2] || '', r = /\br="([A-Z]+\d+)"/.exec(attrs), t = /\bt="(\w+)"/.exec(attrs);
        var ci = r ? colIdx(r[1]) : auto; auto = ci + 1;
        var v = /<v>([\s\S]*?)<\/v>/.exec(inner), val = '';
        if (t && t[1] === 's') val = shared[+(v && v[1])] || '';
        else if (t && t[1] === 'inlineStr') val = xmlText((/<is>([\s\S]*?)<\/is>/.exec(inner) || ['', ''])[1]);
        else if (t && (t[1] === 'str' || t[1] === 'b')) val = v ? xmlText(v[1]) : '';
        else val = v ? (isFinite(+v[1]) ? +v[1] : xmlText(v[1])) : '';
        row[ci] = val;
      }
      for (var i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      rows.push(row);
    }
    return rows;
  }
  function sharedStrings(xml) { var out = [], re = /<si>([\s\S]*?)<\/si>/g, m; while ((m = re.exec(xml || ''))) out.push(xmlText(m[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''))); return out; }
  function parseXLSX(bytes) {
    return unzip(bytes).then(function (f) {
      var wb = f['xl/workbook.xml'] || '', rels = f['xl/_rels/workbook.xml.rels'] || '';
      var first = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb), target = null;
      if (first) { var rm = new RegExp('<Relationship\\b[^>]*Id="' + first[1] + '"[^>]*Target="([^"]+)"').exec(rels) || new RegExp('<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="' + first[1] + '"').exec(rels); if (rm) target = rm[1].replace(/^\/?xl\//, '').replace(/^\//, ''); }
      var sheet = f['xl/' + (target || 'worksheets/sheet1.xml')] || f['xl/worksheets/sheet1.xml'];
      if (!sheet) throw new Error('no-sheet');
      return parseRows(sheetRows(sheet, sharedStrings(f['xl/sharedStrings.xml'])), false, 'xlsx');
    });
  }

  function isZip(bytes) { return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4; }
  /* bytes: Uint8Array → Promise<result> */
  function parseFile(bytes) {
    if (isZip(bytes)) return parseXLSX(bytes);
    return Promise.resolve(parseCSV(CSV.decode(bytes).text));
  }
  return { demojibake: demojibake, parseRows: parseRows, cryptoKind: cryptoKind, assetOf: assetOf, FIAT: FIAT, METALS: METALS, parseCSV: parseCSV, parseXLSX: parseXLSX, parseFile: parseFile, rowsToEvents: rowsToEvents, num: num, date: date, kindOf: kindOf, sheetRows: sheetRows, sharedStrings: sharedStrings, CRYPTO: CRYPTO };
});
