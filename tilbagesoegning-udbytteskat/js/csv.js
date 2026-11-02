/* Small RFC 4180 CSV reader with delimiter + encoding detection and locale-tolerant numbers.
 * Shared source: /workspace/seo-tools/shared/csv.js */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CSV = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  /** bytes (Uint8Array) -> { text, encoding }. UTF-8 (with/without BOM), UTF-16 BOM, else Windows-1252 (Excel "Spara som"). */
  function decode(bytes) {
    if (typeof bytes === 'string') return { text: bytes.replace(/^\uFEFF/, ''), encoding: 'text' };
    if (bytes[0] === 0xFF && bytes[1] === 0xFE) return { text: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
    if (bytes[0] === 0xFE && bytes[1] === 0xFF) return { text: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, ''), encoding: 'utf-8' }; }
    catch (e) { return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' }; }
  }
  /** Pick the delimiter that occurs most often outside quotes in the first line. */
  function detectDelimiter(text) {
    var line = '', inQ = false;
    for (var i = 0; i < text.length && i < 20000; i++) { var c = text[i]; if (c === '"') inQ = !inQ; if (!inQ && (c === '\n' || c === '\r')) break; if (!inQ) line += c; }
    var best = ',', n = -1;
    [',', ';', '\t', '|'].forEach(function (d) { var k = line.split(d).length - 1; if (k > n) { n = k; best = d; } });
    return best;
  }
  function parse(text, delim) {
    delim = delim || detectDelimiter(text);
    var rows = [], row = [], f = '', i = 0, n = text.length, inQ = false;
    while (i < n) {
      var c = text[i];
      if (inQ) {
        if (c === '"') { if (text[i + 1] === '"') { f += '"'; i += 2; continue; } inQ = false; i++; continue; }
        f += c; i++; continue;
      }
      if (c === '"' && f === '') { inQ = true; i++; continue; }
      if (c === delim) { row.push(f); f = ''; i++; continue; }
      if (c === '\r' || c === '\n') { row.push(f); f = ''; rows.push(row); row = []; if (c === '\r' && text[i + 1] === '\n') i++; i++; continue; }
      f += c; i++;
    }
    if (f !== '' || row.length) { row.push(f); rows.push(row); }
    rows = rows.filter(function (r) { return !(r.length === 1 && r[0].trim() === ''); });
    return { delimiter: delim, header: rows.length ? rows[0].map(function (h) { return h.trim(); }) : [], rows: rows.slice(1) };
  }
  /**
   * Locale-tolerant number -> integer minor units (öre/cents). Accepts "1234.5", "1,234.56", "1 234,56", "1.234,56", "-12,3", "(12.00)", "12.00-".
   * decimalComma hint (true when file is ;-separated) decides the ambiguous "1,234" case. Returns NaN when not a number.
   */
  function toMinor(s, decimalComma) {
    if (s == null) return NaN;
    s = String(s).trim().replace(/[\s\u00a0\u202f']/g, '');
    if (s === '') return 0;
    var neg = false;
    if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
    if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
    if (/^[-\u2212]/.test(s)) { neg = !neg; s = s.slice(1); } else if (s[0] === '+') s = s.slice(1);
    var lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
    if (lc >= 0 && ld >= 0) { if (lc > ld) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); }
    else if (lc >= 0) {
      var frac = s.length - lc - 1, multi = s.indexOf(',') !== lc;
      if (multi || (frac === 3 && !decimalComma)) s = s.replace(/,/g, ''); else s = s.replace(',', '.');
    } else if (ld >= 0 && s.indexOf('.') !== ld) s = s.replace(/\./g, '');
    if (!/^\d*\.?\d*$/.test(s) || s === '' || s === '.') return NaN;
    var parts = s.split('.'), whole = parts[0] || '0', fr = ((parts[1] || '') + '000').slice(0, 3);
    var v = parseInt(whole, 10) * 100 + parseInt(fr.slice(0, 2), 10) + (parseInt(fr[2], 10) >= 5 ? 1 : 0);
    return neg ? -v : v;
  }
  return { decode: decode, detectDelimiter: detectDelimiter, parse: parse, toMinor: toMinor };
});
