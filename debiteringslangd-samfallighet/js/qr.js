/* Minimal QR Code encoder (byte mode, error correction level M, versions 1–10), no dependencies, no network.
 * Algorithm follows ISO/IEC 18004 as in Project Nayuki's MIT-licensed reference implementation (rewritten compactly here).
 *   QR.encode(text) → { size, modules: boolean[size][size], version, mask }
 *   QR.svg(text, {quiet:4}) → '<svg …>' string (one <path>, no inline styles – strict-CSP friendly) */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.QR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];      // EC codewords per block, level M
  var BLOCKS_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];             // number of EC blocks, level M
  var FORMAT_M = 0;                                               // format bits for level M
  function rawModules(v) { var r = (16 * v + 128) * v + 64; if (v >= 2) { var n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; } return r; }
  function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC_M[v] * BLOCKS_M[v]; }
  function gmul(x, y) { var z = 0; for (var i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg) { var r = []; for (var i = 0; i < deg - 1; i++) r.push(0); r.push(1); var root = 1; for (i = 0; i < deg; i++) { for (var j = 0; j < r.length; j++) { r[j] = gmul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; } root = gmul(root, 2); } return r; }
  function rsRemainder(data, div) { var r = div.map(function () { return 0; }); data.forEach(function (b) { var f = b ^ r.shift(); r.push(0); div.forEach(function (c, i) { r[i] ^= gmul(c, f); }); }); return r; }
  function utf8(s) { return Array.prototype.slice.call(new TextEncoder().encode(String(s))); }
  function alignPos(v) { if (v === 1) return []; var n = Math.floor(v / 7) + 2, size = v * 4 + 17, step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2, r = [6]; for (var p = size - 7; r.length < n; p -= step) r.splice(1, 0, p); return r; }

  function encode(text) {
    var bytes = utf8(text), v;
    for (v = 1; v <= 10; v++) if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(v) * 8) break;
    if (v > 10) throw new Error('qr-too-long');
    // data bits
    var bits = [], push = function (val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    push(4, 4); push(bytes.length, v < 10 ? 8 : 16); bytes.forEach(function (b) { push(b, 8); });
    var cap = dataCodewords(v) * 8; push(0, Math.min(4, cap - bits.length)); push(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
    var data = []; for (var i = 0; i < bits.length; i += 8) { var b = 0; for (var k = 0; k < 8; k++) b = (b << 1) | bits[i + k]; data.push(b); }
    // EC + interleave
    var nb = BLOCKS_M[v], ecl = ECC_M[v], raw = Math.floor(rawModules(v) / 8), nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
    for (i = 0, k = 0; i < nb; i++) { var dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length; var ec = rsRemainder(dat, div); if (i < nShort) dat.push(0); blocks.push(dat.concat(ec)); }
    var cw = []; for (i = 0; i < blocks[0].length; i++) for (var j = 0; j < nb; j++) if (i !== shortLen - ecl || j >= nShort) cw.push(blocks[j][i]);
    // matrix
    var size = v * 4 + 17, M = [], F = [];
    for (i = 0; i < size; i++) { M.push(new Array(size).fill(false)); F.push(new Array(size).fill(false)); }
    var setF = function (x, y, d) { M[y][x] = d; F[y][x] = true; };
    for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
      for (var dy = -4; dy <= 4; dy++) for (var dx = -4; dx <= 4; dx++) { var d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0] + dx, y = c[1] + dy; if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4); }
    });
    var ap = alignPos(v), na = ap.length;
    for (i = 0; i < na; i++) for (j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (var dy2 = -2; dy2 <= 2; dy2++) for (var dx2 = -2; dx2 <= 2; dx2++) setF(ap[i] + dx2, ap[j] + dy2, Math.max(Math.abs(dx2), Math.abs(dy2)) !== 1);
    }
    function drawFormat(mask) {
      var d = (FORMAT_M << 3) | mask, rem = d; for (var q = 0; q < 10; q++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var fb = ((d << 10) | rem) ^ 0x5412, bit = function (n) { return ((fb >>> n) & 1) !== 0; };
      for (q = 0; q <= 5; q++) setF(8, q, bit(q)); setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for (q = 9; q < 15; q++) setF(14 - q, 8, bit(q));
      for (q = 0; q < 8; q++) setF(size - 1 - q, 8, bit(q)); for (q = 8; q < 15; q++) setF(8, size - 15 + q, bit(q));
      setF(8, size - 8, true);
    }
    drawFormat(0);
    if (v >= 7) { var rem = v; for (i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25); var vb = (v << 12) | rem; for (i = 0; i < 18; i++) { var bt = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, bb = Math.floor(i / 3); setF(a, bb, bt); setF(bb, a, bt); } }
    // codewords (zig-zag)
    var bi = 0;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (var vert = 0; vert < size; vert++) for (j = 0; j < 2; j++) {
        var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && bi < cw.length * 8) { M[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++; }
      }
    }
    function maskBit(m, x, y) {
      switch (m) { case 0: return (x + y) % 2 === 0; case 1: return y % 2 === 0; case 2: return x % 3 === 0; case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; case 5: return x * y % 2 + x * y % 3 === 0; case 6: return (x * y % 2 + x * y % 3) % 2 === 0; default: return ((x + y) % 2 + x * y % 3) % 2 === 0; }
    }
    function applyMask(m) { for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!F[y][x] && maskBit(m, x, y)) M[y][x] = !M[y][x]; }
    function penalty() {
      var p = 0, x, y, run, dark = 0;
      var line = function (get) {
        for (var a = 0; a < size; a++) {
          run = 1;
          for (var b = 1; b < size; b++) { if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
          for (b = 0; b + 6 < size; b++) {
            if (get(a, b) && !get(a, b + 1) && get(a, b + 2) && get(a, b + 3) && get(a, b + 4) && !get(a, b + 5) && get(a, b + 6)) {
              var lightBefore = true, lightAfter = true;
              for (var c = 1; c <= 4; c++) { if (b - c >= 0 && get(a, b - c)) lightBefore = false; if (b + 6 + c < size && get(a, b + 6 + c)) lightAfter = false; }
              if (lightBefore || lightAfter) p += 40;
            }
          }
        }
      };
      line(function (a, b) { return M[a][b]; }); line(function (a, b) { return M[b][a]; });
      for (y = 0; y < size - 1; y++) for (x = 0; x < size - 1; x++) { var c0 = M[y][x]; if (c0 === M[y][x + 1] && c0 === M[y + 1][x] && c0 === M[y + 1][x + 1]) p += 3; }
      for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (M[y][x]) dark++;
      var total = size * size, kk = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1; p += Math.max(0, kk) * 10;
      return p;
    }
    var best = 0, bestP = Infinity;
    for (var m = 0; m < 8; m++) { applyMask(m); drawFormat(m); var pp = penalty(); if (pp < bestP) { bestP = pp; best = m; } applyMask(m); }
    applyMask(best); drawFormat(best);
    return { size: size, modules: M, version: v, mask: best };
  }
  function svg(text, opts) {
    opts = opts || {}; var q = opts.quiet == null ? 4 : opts.quiet, qr = encode(text), n = qr.size + 2 * q, d = '';
    for (var y = 0; y < qr.size; y++) for (var x = 0; x < qr.size; x++) if (qr.modules[y][x]) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z';
    return '<svg xmlns="http://www.w3.org/2000/svg" class="qr" viewBox="0 0 ' + n + ' ' + n + '" shape-rendering="crispEdges" role="img" aria-label="QR"><rect width="' + n + '" height="' + n + '" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
  }
  return { encode: encode, svg: svg, _dataCodewords: dataCodewords };
});
