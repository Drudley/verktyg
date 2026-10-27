/* SIE 1–4 parser. Runs in browser and Node. Amounts kept as integer öre. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SIE = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var CP437_HI = "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0";

  function decodeCP437(bytes) {
    var out = [], chunk = '';
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      chunk += b < 128 ? String.fromCharCode(b) : CP437_HI[b - 128];
      if (chunk.length > 8192) { out.push(chunk); chunk = ''; }
    }
    out.push(chunk);
    return out.join('');
  }

  function isValidUtf8(bytes) {
    var i = 0, n = bytes.length, nonAscii = false;
    while (i < n) {
      var b = bytes[i];
      if (b < 0x80) { i++; continue; }
      nonAscii = true;
      var need = b >= 0xF0 && b <= 0xF4 ? 3 : b >= 0xE0 ? 2 : b >= 0xC2 && b < 0xE0 ? 1 : -1;
      if (need < 0 || b > 0xF4) return false;
      for (var k = 1; k <= need; k++) if (i + k >= n || (bytes[i + k] & 0xC0) !== 0x80) return false;
      i += need + 1;
    }
    return nonAscii ? true : null; // null = pure ASCII
  }

  /** Detect encoding: 'utf-8' | 'cp437' | 'windows-1252' (some exporters wrongly write ANSI). */
  function detectEncoding(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return 'utf-8';
    var u = isValidUtf8(bytes);
    if (u === true) return 'utf-8';
    if (u === null) return 'cp437';
    var pc8 = 0, ansi = 0;
    for (var i = 0; i < bytes.length; i++) {
      var b = bytes[i];
      if (b === 0x86 || b === 0x84 || b === 0x94 || b === 0x8F || b === 0x8E || b === 0x99 || b === 0x82 || b === 0x81 || b === 0x9A) pc8++;
      else if (b === 0xE5 || b === 0xE4 || b === 0xF6 || b === 0xC5 || b === 0xC4 || b === 0xD6 || b === 0xE9 || b === 0xFC || b === 0xDC) ansi++;
    }
    return ansi > pc8 ? 'windows-1252' : 'cp437';
  }

  function decode(input, forced) {
    if (typeof input === 'string') return { text: input, encoding: 'text' };
    var bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    var enc = forced || detectEncoding(bytes);
    var text;
    if (enc === 'cp437') text = decodeCP437(bytes);
    else text = new TextDecoder(enc).decode(bytes);
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    return { text: text, encoding: enc };
  }

  /** Tokenize one SIE line: words, "quoted strings" (\" escapes), {object lists}. */
  function tokenize(line) {
    var toks = [], i = 0, n = line.length;
    while (i < n) {
      var c = line[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '"') {
        var s = ''; i++;
        while (i < n) {
          var d = line[i];
          if (d === '\\' && i + 1 < n && (line[i + 1] === '"' || line[i + 1] === '\\')) { s += line[i + 1]; i += 2; continue; }
          if (d === '"') { i++; break; }
          s += d; i++;
        }
        toks.push(s);
      } else if (c === '{') {
        var j = line.indexOf('}', i);
        if (j < 0) j = n;
        var inner = tokenize(line.slice(i + 1, j));
        var pairs = [];
        for (var k = 0; k + 1 < inner.length; k += 2) pairs.push({ dim: String(inner[k]), obj: String(inner[k + 1]) });
        toks.push({ objects: pairs });
        i = j + 1;
      } else if (c === '}') {
        toks.push('}'); i++;
      } else {
        var w = '';
        while (i < n && line[i] !== ' ' && line[i] !== '\t' && line[i] !== '"' && line[i] !== '{') { w += line[i]; i++; }
        toks.push(w);
      }
    }
    return toks;
  }

  function toOre(s) {
    if (s === undefined || s === null || s === '') return 0;
    if (typeof s !== 'string') return 0;
    var v = parseFloat(s.replace(',', '.'));
    return isFinite(v) ? Math.round(v * 100) : 0;
  }
  function str(t) { return t === undefined || t === null || typeof t === 'object' ? '' : String(t); }
  function isObjList(t) { return t && typeof t === 'object' && t.objects; }

  function parse(input, opts) {
    opts = opts || {};
    var dec = decode(input, opts.encoding);
    var lines = dec.text.split(/\r\n|\n|\r/);
    var doc = {
      encoding: dec.encoding, flagga: null, format: '', sieTyp: null, program: '', gen: '',
      fnamn: '', orgnr: '', fnr: '', adress: null, ftyp: '', valuta: 'SEK', kptyp: '', omfattn: '', taxar: '',
      rar: {}, accounts: {}, dims: {}, objects: {}, ib: {}, ub: {}, res: {}, psaldo: [], oib: [], oub: [],
      vouchers: [], warnings: [], unknownTags: {}
    };
    function acct(no) {
      if (!doc.accounts[no]) doc.accounts[no] = { no: no, name: '', type: '', sru: '', unit: '' };
      return doc.accounts[no];
    }
    function yearMap(map, y) { return map[y] || (map[y] = {}); }

    var cur = null, inBlock = false, skipNextTrans = false;
    for (var li = 0; li < lines.length; li++) {
      var raw = lines[li];
      var line = raw.trim();
      if (!line) continue;
      if (line === '{') { if (cur) inBlock = true; continue; }
      if (line === '}') { if (cur) { finishVoucher(cur); } cur = null; inBlock = false; continue; }
      if (line[0] !== '#') { continue; }
      var t = tokenize(line);
      var tag = String(t[0]).toUpperCase();
      try {
        switch (tag) {
          case '#FLAGGA': doc.flagga = str(t[1]); break;
          case '#FORMAT': doc.format = str(t[1]); break;
          case '#SIETYP': doc.sieTyp = parseInt(str(t[1]), 10) || null; break;
          case '#PROGRAM': doc.program = [str(t[1]), str(t[2])].join(' ').trim(); break;
          case '#GEN': doc.gen = str(t[1]); break;
          case '#FNAMN': doc.fnamn = str(t[1]); break;
          case '#FNR': doc.fnr = str(t[1]); break;
          case '#ORGNR': doc.orgnr = str(t[1]); break;
          case '#FTYP': doc.ftyp = str(t[1]); break;
          case '#VALUTA': doc.valuta = str(t[1]) || 'SEK'; break;
          case '#KPTYP': doc.kptyp = str(t[1]); break;
          case '#OMFATTN': doc.omfattn = str(t[1]); break;
          case '#TAXAR': doc.taxar = str(t[1]); break;
          case '#ADRESS': doc.adress = { kontakt: str(t[1]), utdelningsadr: str(t[2]), postadr: str(t[3]), tel: str(t[4]) }; break;
          case '#RAR': doc.rar[str(t[1])] = { start: str(t[2]), end: str(t[3]) }; break;
          case '#KONTO': acct(str(t[1])).name = str(t[2]); break;
          case '#KTYP': acct(str(t[1])).type = str(t[2]).toUpperCase(); break;
          case '#SRU': acct(str(t[1])).sru = str(t[2]); break;
          case '#ENHET': acct(str(t[1])).unit = str(t[2]); break;
          case '#DIM': doc.dims[str(t[1])] = str(t[2]); break;
          case '#UNDERDIM': doc.dims[str(t[1])] = str(t[2]); break;
          case '#OBJEKT': doc.objects[str(t[1]) + ':' + str(t[2])] = { dim: str(t[1]), obj: str(t[2]), name: str(t[3]) }; break;
          case '#IB': yearMap(doc.ib, str(t[1]))[str(t[2])] = toOre(str(t[3])); acct(str(t[2])); break;
          case '#UB': yearMap(doc.ub, str(t[1]))[str(t[2])] = toOre(str(t[3])); acct(str(t[2])); break;
          case '#RES': yearMap(doc.res, str(t[1]))[str(t[2])] = toOre(str(t[3])); acct(str(t[2])); break;
          case '#OIB': case '#OUB':
            (tag === '#OIB' ? doc.oib : doc.oub).push({ year: str(t[1]), konto: str(t[2]), objects: isObjList(t[3]) ? t[3].objects : [], amount: toOre(str(t[4])) }); break;
          case '#PSALDO': case '#PBUDGET':
            if (tag === '#PBUDGET') break;
            doc.psaldo.push({ year: str(t[1]), period: str(t[2]), konto: str(t[3]), objects: isObjList(t[4]) ? t[4].objects : [], amount: toOre(str(t[5])) });
            acct(str(t[3])); break;
          case '#VER':
            if (cur) finishVoucher(cur);
            cur = { serie: str(t[1]), nr: str(t[2]), date: str(t[3]), text: str(t[4]), regdate: str(t[5]), sign: str(t[6]), trans: [], line: li + 1 };
            doc.vouchers.push(cur);
            if (line.indexOf('{') > 0 && line.trim().slice(-1) === '{') inBlock = true;
            skipNextTrans = false;
            break;
          case '#TRANS': case '#RTRANS': case '#BTRANS':
            if (!cur) { doc.warnings.push('Rad ' + (li + 1) + ': ' + tag + ' utanför #VER'); break; }
            if (tag === '#TRANS' && skipNextTrans) { skipNextTrans = false; break; }
            skipNextTrans = tag === '#RTRANS';
            var ti = 2, objs = [];
            if (isObjList(t[2])) { objs = t[2].objects; ti = 3; }
            var tr = { konto: str(t[1]), objects: objs, amount: toOre(str(t[ti])), date: str(t[ti + 1]), text: str(t[ti + 2]),
              qty: str(t[ti + 3]), sign: str(t[ti + 4]), kind: tag.slice(1) };
            if (tag === '#BTRANS') tr.removed = true;
            cur.trans.push(tr);
            acct(tr.konto);
            break;
          default:
            doc.unknownTags[tag] = (doc.unknownTags[tag] || 0) + 1;
        }
      } catch (e) {
        doc.warnings.push('Rad ' + (li + 1) + ': kunde inte tolkas (' + e.message + ')');
      }
    }
    if (cur) finishVoucher(cur);

    function finishVoucher(v) {
      var sum = 0;
      for (var i = 0; i < v.trans.length; i++) if (!v.trans[i].removed) sum += v.trans[i].amount;
      v.sum = sum;
      if (sum !== 0 && !v._warned) { v._warned = true; doc.warnings.push('Verifikation ' + v.serie + ' ' + v.nr + ' balanserar inte (diff ' + (sum / 100).toFixed(2) + ')'); }
    }
    if (!doc.sieTyp) doc.sieTyp = doc.vouchers.length ? 4 : (doc.psaldo.length ? 2 : 1);
    // Account type fallback from BAS numbering
    Object.keys(doc.accounts).forEach(function (k) {
      var a = doc.accounts[k];
      if (!a.type) { var d = k[0]; a.type = d === '1' ? 'T' : d === '2' ? 'S' : d === '3' ? 'I' : (d >= '4' && d <= '8') ? 'K' : ''; a.typeGuessed = true; }
    });
    return doc;
  }

  function isResultAccount(doc, no) {
    var a = doc.accounts[no];
    if (a && (a.type === 'I' || a.type === 'K')) return true;
    if (a && (a.type === 'T' || a.type === 'S')) return false;
    return no[0] >= '3' && no[0] <= '8';
  }

  function sortedAccounts(doc) {
    return Object.keys(doc.accounts).sort(function (a, b) { return a.localeCompare(b, 'sv', { numeric: true }); });
  }

  /** Trial balance for year index (default '0'). Movement from vouchers if present, else from UB-IB / RES. */
  function trialBalance(doc, year) {
    year = year === undefined ? '0' : String(year);
    var ib = doc.ib[year] || {}, ub = doc.ub[year] || {}, res = doc.res[year] || {};
    var mov = {}, hasVer = false;
    if (year === '0' && doc.vouchers.length) {
      hasVer = true;
      doc.vouchers.forEach(function (v) { v.trans.forEach(function (t) { if (!t.removed) mov[t.konto] = (mov[t.konto] || 0) + t.amount; }); });
    }
    var rows = [];
    sortedAccounts(doc).forEach(function (no) {
      var result = isResultAccount(doc, no);
      var i = result ? 0 : (ib[no] || 0);
      var m, fileEnd = result ? (no in res ? res[no] : null) : (no in ub ? ub[no] : null);
      if (hasVer) m = mov[no] || 0;
      else m = fileEnd === null ? 0 : fileEnd - i;
      var end = i + m;
      if (!i && !m && fileEnd === null) return;
      rows.push({ konto: no, namn: doc.accounts[no].name, typ: doc.accounts[no].type, result: result, ib: i, period: m, ub: end,
        fileUb: fileEnd, diff: fileEnd === null ? null : end - fileEnd });
    });
    return rows;
  }

  /** Monthly result: {months:['2025-01',...], rows:[{konto,namn,values:{month:ore},total}]} for year index. */
  function monthlyResult(doc, year) {
    year = year === undefined ? '0' : String(year);
    var data = {}, months = {};
    if (year === '0' && doc.vouchers.length) {
      doc.vouchers.forEach(function (v) {
        v.trans.forEach(function (t) {
          if (t.removed || !isResultAccount(doc, t.konto)) return;
          var d = t.date || v.date; var m = d.slice(0, 4) + '-' + d.slice(4, 6);
          months[m] = 1; var r = data[t.konto] || (data[t.konto] = {}); r[m] = (r[m] || 0) + t.amount;
        });
      });
    } else {
      doc.psaldo.forEach(function (p) {
        if (p.year !== year || p.objects.length || !isResultAccount(doc, p.konto)) return;
        var m = p.period.slice(0, 4) + '-' + p.period.slice(4, 6);
        months[m] = 1; var r = data[p.konto] || (data[p.konto] = {}); r[m] = (r[m] || 0) + p.amount;
      });
    }
    // fill gaps between first and last month within räkenskapsår
    var rar = doc.rar[year];
    var ms = Object.keys(months).sort();
    if (rar && rar.start && rar.end) {
      ms = []; var y = +rar.start.slice(0, 4), mo = +rar.start.slice(4, 6), ey = +rar.end.slice(0, 4), em = +rar.end.slice(4, 6), guard = 0;
      while ((y < ey || (y === ey && mo <= em)) && guard++ < 36) { ms.push(y + '-' + (mo < 10 ? '0' : '') + mo); mo++; if (mo > 12) { mo = 1; y++; } }
      Object.keys(months).forEach(function (m) { if (ms.indexOf(m) < 0) ms.push(m); });
      ms.sort();
    }
    var rows = Object.keys(data).sort(function (a, b) { return a.localeCompare(b, 'sv', { numeric: true }); }).map(function (k) {
      var tot = 0; Object.keys(data[k]).forEach(function (m) { tot += data[k][m]; });
      return { konto: k, namn: (doc.accounts[k] || {}).name || '', values: data[k], total: tot };
    });
    return { months: ms, rows: rows };
  }

  function summary(doc) {
    var nTrans = 0; doc.vouchers.forEach(function (v) { nTrans += v.trans.length; });
    var unbalanced = doc.vouchers.filter(function (v) { return v.sum !== 0; }).length;
    return { accounts: Object.keys(doc.accounts).length, vouchers: doc.vouchers.length, transactions: nTrans, unbalanced: unbalanced,
      years: Object.keys(doc.rar).sort(function (a, b) { return b - a; }) };
  }

  function fmtDate(d) { return d && d.length === 8 ? d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8) : (d || ''); }

  return { parse: parse, decode: decode, detectEncoding: detectEncoding, tokenize: tokenize, trialBalance: trialBalance,
    monthlyResult: monthlyResult, summary: summary, isResultAccount: isResultAccount, sortedAccounts: sortedAccounts, fmtDate: fmtDate };
});
