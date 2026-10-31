/* Minimal XLSX reader (UMD, no library): ZIP central directory → entries, deflate via DecompressionStream('deflate-raw'),
 * xl/workbook.xml + rels → sheet names in order, sharedStrings + sheet XML → rows (arrays of string | number).
 * Also reads CSV/TSV (a sheet saved as CSV) as a single unnamed sheet. Strict-CSP friendly: no eval, no workers.
 *   XLSXR.read(Uint8Array) → Promise<{kind:'xlsx'|'csv', sheets:[{name, rows}]}>
 * Numbers stay numbers (dates saved as real Excel dates arrive as serial numbers – the caller converts them). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./csv.js'));
  else root.XLSXR = factory(root.CSV);
})(typeof self !== 'undefined' ? self : this, function (CSV) {
  'use strict';
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function isZip(b) { return b && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 3 && b[3] === 4; }
  function inflateRaw(data) {
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('no-inflate'));
    var ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
    w.write(data).catch(function () {}); w.close().catch(function () {});
    return new Response(ds.readable).arrayBuffer().then(function (ab) { return new Uint8Array(ab); }, function () { throw new Error('bad-zip'); });
  }
  /* Only the entries we need are inflated (want(name) → bool). Sizes come from the central directory, so archives written
     with data descriptors (bit 3, zero sizes in the local header) work too. */
  function unzip(bytes, want) {
    var e = -1;
    for (var i = bytes.length - 22; i >= Math.max(0, bytes.length - 66000); i--) if (u32(bytes, i) === 0x06054b50) { e = i; break; }
    if (e < 0) return Promise.reject(new Error('not-zip'));
    var cnt = u16(bytes, e + 10), off = u32(bytes, e + 16), files = {}, jobs = [], dec = new TextDecoder('utf-8');
    for (var k = 0; k < cnt; k++) {
      if (off + 46 > bytes.length || u32(bytes, off) !== 0x02014b50) return Promise.reject(new Error('bad-zip'));
      var flags = u16(bytes, off + 8), method = u16(bytes, off + 10), csize = u32(bytes, off + 20), nlen = u16(bytes, off + 28), xlen = u16(bytes, off + 30), clen = u16(bytes, off + 32), loff = u32(bytes, off + 42);
      var name = dec.decode(bytes.subarray(off + 46, off + 46 + nlen));
      off += 46 + nlen + xlen + clen;
      if (want && !want(name)) continue;
      if (flags & 1) return Promise.reject(new Error('encrypted'));
      if (u32(bytes, loff) !== 0x04034b50) return Promise.reject(new Error('bad-zip'));
      var ds = loff + 30 + u16(bytes, loff + 26) + u16(bytes, loff + 28), data = bytes.subarray(ds, ds + csize);
      if (method !== 0 && method !== 8) return Promise.reject(new Error('bad-zip'));
      (function (name, p) { jobs.push(p.then(function (b) { files[name] = dec.decode(b); })); })(name, method === 0 ? Promise.resolve(data) : inflateRaw(data));
    }
    return Promise.all(jobs).then(function () { return files; });
  }
  function xmlText(s) {
    return String(s).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (m, c) { return String.fromCodePoint(parseInt(c, 16)); }).replace(/&#(\d+);/g, function (m, c) { return String.fromCodePoint(+c); }).replace(/&amp;/g, '&');
  }
  function attr(s, a) { var m = new RegExp('\\b' + a + '="([^"]*)"').exec(s); return m ? xmlText(m[1]) : null; }
  function colIdx(ref) { var m = /^([A-Z]+)/.exec(ref), n = 0; for (var i = 0; i < m[1].length; i++) n = n * 26 + m[1].charCodeAt(i) - 64; return n - 1; }
  function sharedStrings(xml) {
    var out = [], re = /<si>([\s\S]*?)<\/si>|<si\/>/g, m;
    while ((m = re.exec(xml || ''))) out.push(xmlText((m[1] || '').replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')));
    return out;
  }
  function sheetRows(xml, shared) {
    var rows = [], rre = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, rm, autoRow = 0;
    while ((rm = rre.exec(xml))) {
      var rn = attr(rm[1], 'r'), ri = rn ? +rn - 1 : autoRow; autoRow = ri + 1;
      var row = [], cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, cm, auto = 0, body = rm[2] || '';
      while ((cm = cre.exec(body))) {
        var a = cm[1], inner = cm[2] || '', r = attr(a, 'r'), t = attr(a, 't'), ci = r ? colIdx(r) : auto; auto = ci + 1;
        var v = /<v>([\s\S]*?)<\/v>/.exec(inner), val = '';
        if (t === 's') val = v ? shared[+v[1]] || '' : '';
        else if (t === 'inlineStr') val = xmlText((/<is>([\s\S]*?)<\/is>/.exec(inner) || ['', ''])[1].replace(/<rPh\b[\s\S]*?<\/rPh>/g, ''));
        else if (t === 'str' || t === 'b' || t === 'd' || t === 'e') val = v ? xmlText(v[1]) : '';
        else val = v ? (v[1].trim() !== '' && isFinite(+v[1]) ? +v[1] : xmlText(v[1])) : '';
        row[ci] = val;
      }
      for (var i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = '';
      rows[ri] = row;
    }
    for (var j = 0; j < rows.length; j++) if (!rows[j]) rows[j] = [];
    return rows;
  }
  function resolve(target) { var t = target.replace(/^\/?xl\//, '').replace(/^\//, ''); return 'xl/' + t; }
  function readXLSX(bytes) {
    return unzip(bytes, function (n) { return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n); }).then(function (f) {
      var wb = f['xl/workbook.xml'];
      if (!wb) throw new Error('not-xlsx');
      var rels = {}, rre = /<Relationship\b([^>]*)\/?>/g, m;
      while ((m = rre.exec(f['xl/_rels/workbook.xml.rels'] || ''))) rels[attr(m[1], 'Id')] = attr(m[1], 'Target');
      var shared = sharedStrings(f['xl/sharedStrings.xml']), sheets = [], sre = /<sheet\b([^>]*?)\/?>/g, n = 0;
      while ((m = sre.exec(wb))) {
        n++;
        var name = attr(m[1], 'name') || 'Sheet' + n, id = attr(m[1], 'r:id'), path = id && rels[id] ? resolve(rels[id]) : 'xl/worksheets/sheet' + n + '.xml';
        if (f[path] != null) sheets.push({ name: name, rows: sheetRows(f[path], shared) });
      }
      if (!sheets.length) throw new Error('no-sheet');
      return { kind: 'xlsx', sheets: sheets };
    });
  }
  /* Delimiter from the first lines that contain one – a title row such as "Closed Positions" above the header must not decide it. */
  function detectDelim(text) {
    var lines = text.split(/\r?\n/).slice(0, 20), best = ',', bestN = 0;
    [';', ',', '\t'].forEach(function (d) {
      var n = 0; lines.forEach(function (l) { n += l.replace(/"[^"]*"/g, '').split(d).length - 1; });
      if (n > bestN) { best = d; bestN = n; }
    });
    return best;
  }
  function readCSV(bytes) {
    var text = CSV.decode(bytes).text, delim = detectDelim(text), pr = CSV.parse(text, delim);
    return { kind: 'csv', delimiter: delim, sheets: [{ name: '', rows: [pr.header].concat(pr.rows) }] };
  }
  function read(bytes) {
    if (isZip(bytes)) return readXLSX(bytes);
    if (bytes && bytes[0] === 0xD0 && bytes[1] === 0xCF) return Promise.reject(new Error('xls-legacy'));
    try { return Promise.resolve(readCSV(bytes)); } catch (e) { return Promise.reject(e); }
  }
  return { read: read, readXLSX: readXLSX, readCSV: readCSV, unzip: unzip, sheetRows: sheetRows, sharedStrings: sharedStrings, isZip: isZip, xmlText: xmlText };
});
