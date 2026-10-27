/* SIE 4 writer (import file, "SIE 4I"-style: #VER/#TRANS, no balances). Encodes to PC8/CP437 as the SIE spec requires.
 * Shared source: /workspace/seo-tools/shared/sie-writer.js (copied into each tool by shared/sync.sh). Amounts in integer öre. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SIEW = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var CP437_HI = "\u00c7\u00fc\u00e9\u00e2\u00e4\u00e0\u00e5\u00e7\u00ea\u00eb\u00e8\u00ef\u00ee\u00ec\u00c4\u00c5\u00c9\u00e6\u00c6\u00f4\u00f6\u00f2\u00fb\u00f9\u00ff\u00d6\u00dc\u00a2\u00a3\u00a5\u20a7\u0192\u00e1\u00ed\u00f3\u00fa\u00f1\u00d1\u00aa\u00ba\u00bf\u2310\u00ac\u00bd\u00bc\u00a1\u00ab\u00bb\u2591\u2592\u2593\u2502\u2524\u2561\u2562\u2556\u2555\u2563\u2551\u2557\u255d\u255c\u255b\u2510\u2514\u2534\u252c\u251c\u2500\u253c\u255e\u255f\u255a\u2554\u2569\u2566\u2560\u2550\u256c\u2567\u2568\u2564\u2565\u2559\u2558\u2552\u2553\u256b\u256a\u2518\u250c\u2588\u2584\u258c\u2590\u2580\u03b1\u00df\u0393\u03c0\u03a3\u03c3\u00b5\u03c4\u03a6\u0398\u03a9\u03b4\u221e\u03c6\u03b5\u2229\u2261\u00b1\u2265\u2264\u2320\u2321\u00f7\u2248\u00b0\u2219\u00b7\u221a\u207f\u00b2\u25a0\u00a0";
  var ENC = null;
  // Common characters missing in CP437, mapped to close ASCII equivalents instead of '?'.
  var FALLBACK = { '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2026': '...', '\u20ac': 'EUR', '\u00d8': 'O', '\u00f8': 'o', '\u00c1': 'A', '\u00c0': 'A', '\u00c2': 'A', '\u00c3': 'A', '\u00e3': 'a', '\u00cb': 'E', '\u00c8': 'E', '\u00ca': 'E', '\u00cd': 'I', '\u00d3': 'O', '\u00d2': 'O', '\u00d4': 'O', '\u00d5': 'O', '\u00f5': 'o', '\u00da': 'U', '\u00d9': 'U', '\u00db': 'U', '\u00dd': 'Y', '\u00fd': 'y', '\u0160': 'S', '\u0161': 's', '\u017d': 'Z', '\u017e': 'z', '\u0141': 'L', '\u0142': 'l' };

  function encodeCP437(str) {
    if (!ENC) { ENC = {}; for (var k = 0; k < 128; k++) ENC[CP437_HI[k]] = 128 + k; }
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var ch = str[i], c = str.charCodeAt(i);
      if (c < 128) { out.push(c); continue; }
      if (ENC[ch] !== undefined) { out.push(ENC[ch]); continue; }
      var f = FALLBACK[ch] || (ch.normalize ? ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '?');
      for (var j = 0; j < f.length; j++) { var fc = f.charCodeAt(j); out.push(fc < 128 ? fc : (ENC[f[j]] !== undefined ? ENC[f[j]] : 63)); }
    }
    return new Uint8Array(out);
  }

  /** Quote a SIE string: always quoted, " escaped as \", control chars removed. */
  function q(s) { return '"' + String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/\\/g, '/').replace(/"/g, '\\"') + '"'; }
  /** Field that may be written bare (series, voucher number) when it is a simple token; else quoted. */
  function f(s) { s = String(s == null ? '' : s); return /^[A-Za-z0-9_.-]+$/.test(s) ? s : q(s); }
  function amt(ore) { var neg = ore < 0, a = Math.abs(ore); var s = Math.floor(a / 100) + '.' + ('0' + (a % 100)).slice(-2); return (neg ? '-' : '') + s; }
  function d8(iso) { return String(iso).replace(/-/g, '').slice(0, 8); }

  /**
   * doc = { fnamn, orgnr?, program?, version?, gen? (YYYY-MM-DD), rar: [{start,end}] (index 0 = current),
   *         accounts: {no: name}, vouchers: [{serie, nr, date, text, trans: [{konto, amount (öre), text?}]}] }
   * Returns the SIE text (string). Throws if any voucher does not balance.
   */
  function build(doc) {
    var L = [];
    L.push('#FLAGGA 0');
    L.push('#FORMAT PC8');
    L.push('#SIETYP 4');
    L.push('#PROGRAM ' + q(doc.program || 'seo-tools') + ' ' + q(doc.version || '1.0'));
    L.push('#GEN ' + d8(doc.gen || new Date().toISOString().slice(0, 10)));
    L.push('#FNAMN ' + q(doc.fnamn || 'Företaget'));
    if (doc.orgnr) L.push('#ORGNR ' + String(doc.orgnr).replace(/[^0-9-]/g, ''));
    (doc.rar || []).forEach(function (r, i) { L.push('#RAR ' + (i === 0 ? '0' : '-' + i) + ' ' + d8(r.start) + ' ' + d8(r.end)); });
    L.push('#KPTYP BAS2014');
    Object.keys(doc.accounts || {}).sort().forEach(function (k) { L.push('#KONTO ' + k + ' ' + q(doc.accounts[k])); });
    (doc.vouchers || []).forEach(function (v) {
      var sum = 0;
      v.trans.forEach(function (t) { sum += t.amount; });
      if (sum !== 0) throw new Error('Verifikation ' + v.serie + v.nr + ' balanserar inte (' + amt(sum) + ')');
      L.push('#VER ' + f(v.serie) + ' ' + f(v.nr) + ' ' + d8(v.date) + ' ' + q(v.text) + ' ' + d8(doc.gen || new Date().toISOString().slice(0, 10)));
      L.push('{');
      v.trans.forEach(function (t) {
        if (t.amount === 0) return;
        L.push('   #TRANS ' + t.konto + ' {} ' + amt(t.amount) + (t.text ? ' "" ' + q(t.text) : ''));
      });
      L.push('}');
    });
    return L.join('\r\n') + '\r\n';
  }

  return { build: build, encodeCP437: encodeCP437, amt: amt, quote: q,
    toBytes: function (doc) { return encodeCP437(build(doc)); } };
});
