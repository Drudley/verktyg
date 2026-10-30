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
  var CRYPTO = /^(BTC|ETH|XRP|ADA|DOGE|DOT|LTC|BCH|XLM|MATIC|POL|SHIB|AVAX|USDT|USDC|TRX|BNB|ETC|XTZ|EOS|ATOM|ALGO|PEPE)(-?USD|-?EUR)?$/i;

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
    if (/^(BUY|SELL)( ?- ?(MARKET|LIMIT|STOP|STOP LIMIT|STOP-LIMIT))?$/.test(t)) return t.slice(0, t.charAt(0) === 'B' ? 3 : 4);
    if (/^KÖP( ?- ?(MARKNAD|LIMIT|STOPP?))?$/.test(t)) return 'BUY';
    if (/^SÄLJ( ?- ?(MARKNAD|LIMIT|STOPP?))?$/.test(t)) return 'SELL';
    if (/^UTDELNING|^KÄLLSKATT|^INSÄTTNING|^UTTAG$|^RÄNTA|^FÖRVARINGSAVGIFT/.test(t)) return 'IGNORE';
    if (/^STOCK SPLIT|SPLIT$/.test(t)) return 'SPLIT';
    if (/^CASH (TOP-UP|TOPUP|WITHDRAWAL)|^DIVIDEND|^CUSTODY FEE|^TRANSFER FROM REVOLUT|^TRANSFER .*REVOLUT|^INTEREST|^TAX|WITHHOLDING/.test(t)) return 'IGNORE';
    return 'UNKNOWN';
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
    var styles = { ccy: 0, sym: 0, plain: 0 };
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
      if (crypto && ev.kind !== 'IGNORE') ev.kind = 'CRYPTO';
      if (ev.kind !== 'IGNORE' && ev.ticker && (CRYPTO.test(ev.ticker) || /CRYPTO/i.test(rawType))) ev.kind = 'CRYPTO';
      res.events.push(ev);
    }
    res.format = crypto ? 'revolut-crypto' : styles.ccy > styles.sym + styles.plain ? 'revolut-log-ccy' : 'revolut-log-classic';
    if (fileLabel) res.format += '-' + fileLabel;
    return res;
  }

  function parseCSV(text) {
    var delim = CSV.detectDelimiter(text), pr = CSV.parse(text, delim), rows = [pr.header].concat(pr.rows);
    return rowsToEvents(rows, delim === ';' && /\d,\d/.test(text.slice(0, 5000)));
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
      return rowsToEvents(sheetRows(sheet, sharedStrings(f['xl/sharedStrings.xml'])), false, 'xlsx');
    });
  }

  function isZip(bytes) { return bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 3 && bytes[3] === 4; }
  /* bytes: Uint8Array → Promise<result> */
  function parseFile(bytes) {
    if (isZip(bytes)) return parseXLSX(bytes);
    return Promise.resolve(parseCSV(CSV.decode(bytes).text));
  }
  return { demojibake: demojibake, parseCSV: parseCSV, parseXLSX: parseXLSX, parseFile: parseFile, rowsToEvents: rowsToEvents, num: num, date: date, kindOf: kindOf, sheetRows: sheetRows, sharedStrings: sharedStrings, CRYPTO: CRYPTO };
});
