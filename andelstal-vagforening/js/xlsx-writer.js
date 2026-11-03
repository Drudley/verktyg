/* Minimal XLSX writer (no dependencies). Sheets of rows; cells: string | number | {v, t:'date'|'money'|'int', b:bold}. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.XLSXW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var CRC = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ''); }
  function colName(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
  // style ids: 0 default, 1 bold, 2 date, 3 money, 4 bold money, 5 int
  var STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="#,##0.00;\\-#,##0.00"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF6"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
    '<xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  function dateSerial(yyyymmdd) {
    var y = +yyyymmdd.slice(0, 4), m = +yyyymmdd.slice(4, 6), d = +yyyymmdd.slice(6, 8);
    if (!y || !m || !d) return null;
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  function sheetXml(sheet) {
    var rows = sheet.rows, widths = sheet.widths || [], out = [];
    out.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">');
    if (sheet.freeze) out.push('<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + sheet.freeze + '" topLeftCell="A' + (sheet.freeze + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>');
    if (widths.length) { out.push('<cols>'); widths.forEach(function (w, i) { out.push('<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'); }); out.push('</cols>'); }
    out.push('<sheetData>');
    var maxC = 0;
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r]; if (!row) continue;
      var cells = [];
      for (var c = 0; c < row.length; c++) {
        var cell = row[c]; if (cell === null || cell === undefined || cell === '') continue;
        if (c + 1 > maxC) maxC = c + 1;
        var ref = colName(c) + (r + 1);
        var v = cell, t = null, s = 0;
        if (typeof cell === 'object') { v = cell.v; t = cell.t; if (cell.b) s = 1; }
        if (v === null || v === undefined || v === '') continue;
        if (t === 'date') { var ser = dateSerial(String(v)); if (ser === null) { cells.push('<c r="' + ref + '" t="inlineStr"><is><t>' + esc(v) + '</t></is></c>'); continue; } cells.push('<c r="' + ref + '" s="2"><v>' + ser + '</v></c>'); }
        else if (t === 'money') cells.push('<c r="' + ref + '" s="' + (cell.b ? 4 : 3) + '"><v>' + (+v) + '</v></c>');
        else if (t === 'int' || (typeof v === 'number' && !s)) cells.push('<c r="' + ref + '"' + (t === 'int' ? ' s="5"' : '') + '><v>' + v + '</v></c>');
        else cells.push('<c r="' + ref + '" t="inlineStr"' + (s ? ' s="1"' : '') + '><is><t xml:space="preserve">' + esc(v) + '</t></is></c>');
      }
      out.push('<row r="' + (r + 1) + '">' + cells.join('') + '</row>');
    }
    out.push('</sheetData>');
    if (sheet.autoFilter && rows.length > 1 && maxC) out.push('<autoFilter ref="A' + sheet.autoFilter + ':' + colName(maxC - 1) + rows.length + '"/>');
    out.push('</worksheet>');
    return out.join('');
  }

  function u8(s) { return new TextEncoder().encode(s); }

  async function deflateRaw(data) {
    if (typeof CompressionStream === 'undefined') return null;
    try {
      var cs = new CompressionStream('deflate-raw');
      var stream = new Blob([data]).stream().pipeThrough(cs);
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch (e) { return null; }
  }

  async function zip(files) {
    var parts = [], central = [], offset = 0;
    for (var i = 0; i < files.length; i++) {
      var name = u8(files[i].name), data = files[i].data, crc = crc32(data);
      var comp = await deflateRaw(data), method = 8;
      if (!comp || comp.length >= data.length) { comp = data; method = 0; }
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, method, true);
      lh.setUint16(10, 0, true); lh.setUint16(12, 0x21, true); lh.setUint32(14, crc, true); lh.setUint32(18, comp.length, true);
      lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, comp);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, method, true);
      ch.setUint16(12, 0, true); ch.setUint16(14, 0x21, true); ch.setUint32(16, crc, true); ch.setUint32(20, comp.length, true); ch.setUint32(24, data.length, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + comp.length;
    }
    var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    var all = parts.concat(central, [new Uint8Array(end.buffer)]);
    var total = all.reduce(function (a, b) { return a + b.length; }, 0), out = new Uint8Array(total), p = 0;
    all.forEach(function (b) { out.set(b, p); p += b.length; });
    return out;
  }

  function safeSheetName(n) { return n.replace(/[\\\/\?\*\[\]:]/g, ' ').slice(0, 31); }

  /** sheets: [{name, rows, widths?, freeze?, autoFilter?}] -> Promise<Uint8Array> */
  async function build(sheets, meta) {
    meta = meta || {};
    var files = [];
    var ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>';
    sheets.forEach(function (s, i) { ct += '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; });
    ct += '</Types>';
    files.push({ name: '[Content_Types].xml', data: u8(ct) });
    files.push({ name: '_rels/.rels', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>') });
    files.push({ name: 'docProps/core.xml', data: u8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>' + esc(meta.title || '') + '</dc:title><dc:creator>' + esc(meta.creator || '') + '</dc:creator></cp:coreProperties>') });
    var wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    var rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach(function (s, i) {
      wb += '<sheet name="' + esc(safeSheetName(s.name)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
      rels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    });
    var defNames = '';
    sheets.forEach(function (s, i) {
      if (s.autoFilter && s.rows.length > 1) {
        var maxC = s.rows.reduce(function (m, r) { return Math.max(m, r ? r.length : 0); }, 0);
        defNames += '<definedName name="_xlnm._FilterDatabase" localSheetId="' + i + '" hidden="1">\'' + esc(safeSheetName(s.name)).replace(/'/g, "''") + '\'!$A$' + s.autoFilter + ':$' + colName(maxC - 1) + '$' + s.rows.length + '</definedName>';
      }
    });
    wb += '</sheets>' + (defNames ? '<definedNames>' + defNames + '</definedNames>' : '') + '</workbook>';
    rels += '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    files.push({ name: 'xl/workbook.xml', data: u8(wb) });
    files.push({ name: 'xl/_rels/workbook.xml.rels', data: u8(rels) });
    files.push({ name: 'xl/styles.xml', data: u8(STYLES) });
    sheets.forEach(function (s, i) { files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: u8(sheetXml(s)) }); });
    return zip(files);
  }
  return { build: build, dateSerial: dateSerial, crc32: crc32 };
});
