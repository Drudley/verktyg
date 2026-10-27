/* Content-stream redaction: rewrites a PDF page so that it only contains what is drawn inside a crop box.
   Everything whose bounds lie completely outside the crop is REMOVED from the file (not just hidden by clipping):
   text-show operators, path sub-paths, images, inline images, nested form XObjects (rewritten recursively),
   marked-content properties (ActualText/Alt) and unused resources.
   If something straddles the crop in a way that cannot be split safely (image or shading crossing the edge, a soft-mask
   ExtGState, a kept string that directly follows a removed one on the same line, unparsable content) the result is
   flagged `unsafe` and the caller must rasterise the crop instead. The caller also verifies the output text (see output.js).
   UMD: window.LABELREDACT / module.exports. PDFLib is passed in. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LABELREDACT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var WS = { 0: 1, 9: 1, 10: 1, 12: 1, 13: 1, 32: 1 }, DL = { 40: 1, 41: 1, 60: 1, 62: 1, 91: 1, 93: 1, 123: 1, 125: 1, 47: 1, 37: 1 };
  var enc = function (s) { var a = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) a[i] = s.charCodeAt(i) & 255; return a; };

  /* ---------- lexer / parser ---------- */
  function Lexer(b) { this.b = b; this.p = 0; }
  Lexer.prototype.skip = function () {
    var b = this.b;
    for (;;) {
      while (this.p < b.length && WS[b[this.p]]) this.p++;
      if (b[this.p] === 37) { while (this.p < b.length && b[this.p] !== 10 && b[this.p] !== 13) this.p++; continue; }
      return;
    }
  };
  Lexer.prototype.next = function () {
    this.skip();
    var b = this.b, p = this.p, c = b[p];
    if (p >= b.length) return null;
    if (c === 40) { // literal string
      var out = [], depth = 1; p++;
      while (p < b.length) {
        c = b[p++];
        if (c === 92) {
          var e = b[p++];
          if (e === 110) out.push(10); else if (e === 114) out.push(13); else if (e === 116) out.push(9); else if (e === 98) out.push(8); else if (e === 102) out.push(12);
          else if (e === 13) { if (b[p] === 10) p++; } else if (e === 10) { /* line continuation */ }
          else if (e >= 48 && e <= 55) { var o = e - 48; for (var k = 0; k < 2 && b[p] >= 48 && b[p] <= 55; k++) o = o * 8 + b[p++] - 48; out.push(o & 255); }
          else out.push(e);
        } else if (c === 40) { depth++; out.push(c); } else if (c === 41) { if (--depth === 0) break; out.push(c); } else out.push(c);
      }
      this.p = p; return { t: 's', v: out };
    }
    if (c === 60 && b[p + 1] === 60) { this.p = p + 2; return { t: '<<' }; }
    if (c === 62 && b[p + 1] === 62) { this.p = p + 2; return { t: '>>' }; }
    if (c === 60) { var hx = ''; p++; while (p < b.length && b[p] !== 62) { if (!WS[b[p]]) hx += String.fromCharCode(b[p]); p++; } this.p = p + 1; if (hx.length % 2) hx += '0'; var hv = []; for (var i = 0; i < hx.length; i += 2) hv.push(parseInt(hx.substr(i, 2), 16)); return { t: 's', v: hv }; }
    if (c === 91) { this.p = p + 1; return { t: '[' }; }
    if (c === 93) { this.p = p + 1; return { t: ']' }; }
    if (c === 123 || c === 125) { this.p = p + 1; return { t: 'k', v: String.fromCharCode(c) }; }
    if (c === 47) { p++; var s = p; while (p < b.length && !WS[b[p]] && !DL[b[p]]) p++; this.p = p; return { t: 'name', v: decodeName(b, s, p) }; }
    var st = p; while (p < b.length && !WS[b[p]] && !DL[b[p]]) p++;
    if (p === st) { this.p = p + 1; return { t: 'k', v: String.fromCharCode(c) }; } // stray delimiter
    this.p = p;
    var w = ''; for (var j = st; j < p; j++) w += String.fromCharCode(b[j]);
    if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(w)) return { t: 'n', v: parseFloat(w) };
    if (w === 'true' || w === 'false') return { t: 'b', v: w === 'true' };
    if (w === 'null') return { t: 'null' };
    return { t: 'op', v: w };
  };
  function decodeName(b, s, e) { var r = ''; for (var i = s; i < e; i++) { if (b[i] === 35 && i + 2 < e) { r += String.fromCharCode(parseInt(String.fromCharCode(b[i + 1], b[i + 2]), 16)); i += 2; } else r += String.fromCharCode(b[i]); } return r; }
  function readValue(lx, tok) {
    if (tok.t === '[') { var a = []; for (;;) { var x = lx.next(); if (!x) throw new Error('eof in array'); if (x.t === ']') break; a.push(readValue(lx, x)); } return { t: 'a', v: a }; }
    if (tok.t === '<<') { var d = {}; for (;;) { var k = lx.next(); if (!k) throw new Error('eof in dict'); if (k.t === '>>') break; if (k.t !== 'name') throw new Error('bad dict key'); d[k.v] = readValue(lx, lx.next()); } return { t: 'd', v: d }; }
    return tok;
  }
  /* returns [{op, args, s, e}] with raw byte offsets */
  function parse(bytes) {
    var lx = new Lexer(bytes), ops = [], args = [], start = -1;
    for (;;) {
      lx.skip(); var pos = lx.p, tok = lx.next();
      if (!tok) break;
      if (start < 0) start = pos;
      if (tok.t === 'op') {
        if (tok.v === 'BI') { // inline image: dict until ID, then binary data until EI
          var dict = {};
          for (;;) { var k = lx.next(); if (!k) throw new Error('eof in BI'); if (k.t === 'op' && k.v === 'ID') break; dict[k.v] = readValue(lx, lx.next()); }
          var p = lx.p + 1, b = bytes, end = -1;
          for (var q = p; q < b.length - 1; q++) if (b[q] === 69 && b[q + 1] === 73 && WS[b[q - 1]] && (q + 2 >= b.length || WS[b[q + 2]] || DL[b[q + 2]])) { end = q + 2; break; }
          if (end < 0) throw new Error('EI not found');
          lx.p = end; ops.push({ op: 'BI', args: [{ t: 'd', v: dict }], s: start, e: end }); args = []; start = -1; continue;
        }
        ops.push({ op: tok.v, args: args, s: start, e: lx.p }); args = []; start = -1;
      } else args.push(readValue(lx, tok));
    }
    return ops;
  }

  /* ---------- geometry ---------- */
  function mul(m, n) { return [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]; }
  function tp(m, x, y) { return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]; }
  function bboxOf(m, pts) { var x0 = 1e18, y0 = 1e18, x1 = -1e18, y1 = -1e18; for (var i = 0; i < pts.length; i++) { var q = tp(m, pts[i][0], pts[i][1]); if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < y0) y0 = q[1]; if (q[1] > y1) y1 = q[1]; } return [x0, y0, x1, y1]; }
  function hits(b, c, tol) { return b[2] >= c[0] - tol && b[0] <= c[2] + tol && b[3] >= c[1] - tol && b[1] <= c[3] + tol; }
  function within(b, c, tol) { return b[0] >= c[0] - tol && b[1] >= c[1] - tol && b[2] <= c[2] + tol && b[3] <= c[3] + tol; }
  function scaleOf(m) { return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1; }
  var num = function (a) { return a && a.t === 'n' ? a.v : 0; };

  /* ---------- fonts (only for estimating where a string ends) ---------- */
  function fontInfo(L, ctx, fontDict) {
    var info = { bpc: 1, w: function () { return 600; }, scale: 0.001 };
    if (!fontDict) return info;
    var N = L.PDFName.of, look = function (d, k) { try { return d.lookup(N(k)); } catch (e) { return undefined; } };
    var nv = function (o, d) { return o && o.asNumber ? o.asNumber() : d; };
    var st = look(fontDict, 'Subtype'), sub = st ? st.toString() : '';
    if (sub === '/Type0') {
      info.bpc = 2;
      var df = look(fontDict, 'DescendantFonts'), cid = df && df.lookup ? df.lookup(0) : null, dw = 1000, map = {};
      if (cid) {
        dw = nv(look(cid, 'DW'), 1000);
        var W = look(cid, 'W');
        if (W && W.size) for (var i = 0; i < W.size();) {
          var a = nv(W.lookup(i)), nx = W.lookup(i + 1);
          if (nx && nx.size) { for (var j = 0; j < nx.size(); j++) map[a + j] = nv(nx.lookup(j), dw); i += 2; }
          else { var b = nv(nx), w = nv(W.lookup(i + 2), dw); for (var c = a; c <= b && c - a < 65536; c++) map[c] = w; i += 3; }
        }
      }
      info.w = function (code) { return map[code] != null ? map[code] : dw; };
      return info;
    }
    var fc = nv(look(fontDict, 'FirstChar'), 0), ws = look(fontDict, 'Widths'), fd = look(fontDict, 'FontDescriptor'), mw = fd ? nv(look(fd, 'MissingWidth'), 0) : 0;
    if (sub === '/Type3') { var fm = look(fontDict, 'FontMatrix'); info.scale = fm && fm.size ? nv(fm.lookup(0), 0.001) : 0.001; }
    if (ws && ws.size) { var arr = []; for (var k = 0; k < ws.size(); k++) arr.push(nv(ws.lookup(k), 0)); info.w = function (code) { var v = arr[code - fc]; return v != null ? v : (mw || 600); }; }
    return info;
  }

  /* ---------- the filter ---------- */
  function Ctx(L, doc, crop, tol) { this.L = L; this.doc = doc; this.crop = crop; this.tol = tol; this.unsafe = null; this.stats = { textKept: 0, textDropped: 0, pathsDropped: 0, subpathsDropped: 0, imagesDropped: 0, formsRewritten: 0, formsDropped: 0, marked: 0 }; this.depth = 0; this.seq = 0; }
  Ctx.prototype.fail = function (why) { if (!this.unsafe) this.unsafe = why; };

  /* filter one content stream. res = PDFDict of resources, ctm0 = matrix from this stream's space to page space,
     region = [x0,y0,x1,y1] in page space. returns {bytes, res: new PDFDict} */
  function filterStream(C, bytes, res, ctm0, region) {
    var L = C.L, N = L.PDFName.of, ctx = C.doc.context, ops;
    try { ops = parse(bytes); } catch (e) { C.fail('parse: ' + e.message); return { bytes: bytes, res: res }; }
    var out = [], used = { Font: {}, XObject: {}, ExtGState: {}, ColorSpace: {}, Pattern: {}, Shading: {}, Properties: {} }, newX = {};
    var raw = function (o) { out.push(bytes.subarray(o.s, o.e)); out.push(enc('\n')); };
    var gs = { ctm: ctm0, lw: 1, font: null, fs: 0, Tc: 0, Tw: 0, Tz: 100, TL: 0, Ts: 0 }, stack = [];
    var Tm = [1, 0, 0, 1, 0, 0], Tlm = Tm, inText = false, droppedSinceMove = false, fontCache = {};
    var path = null; // {subs:[{chunks:[], pts:[]}], clip:false}
    var resDict = function (cat) { try { return res ? res.lookup(N(cat)) : null; } catch (e) { return null; } };
    var lookupRes = function (cat, name) { var d = resDict(cat); try { return d && d.lookup ? d.lookup(N(name)) : null; } catch (e) { return null; } };
    var getFont = function (name) { if (!fontCache[name]) fontCache[name] = fontInfo(L, ctx, lookupRes('Font', name)); return fontCache[name]; };
    var markUsed = function (cat, a) { if (a && a.t === 'name') used[cat][a.v] = 1; };

    function showBox(strBytes, tj) {
      var f = gs.font ? getFont(gs.font) : { bpc: 1, w: function () { return 600; }, scale: 0.001 }, Th = gs.Tz / 100, tx = 0;
      var adv = function (bs) { for (var i = 0; i + f.bpc <= bs.length; i += f.bpc) { var code = f.bpc === 2 ? (bs[i] << 8) | bs[i + 1] : bs[i]; tx += (f.w(code) * f.scale * gs.fs + gs.Tc + (f.bpc === 1 && code === 32 ? gs.Tw : 0)) * Th; } };
      if (tj) tj.forEach(function (it) { if (it.t === 's') adv(it.v); else if (it.t === 'n') tx -= it.v / 1000 * gs.fs * Th; }); else adv(strBytes);
      var M = mul(Tm, gs.ctm), lo = -0.3 * gs.fs + gs.Ts, hi = 1.05 * gs.fs + gs.Ts;
      var box = bboxOf(M, [[0, lo], [tx, lo], [0, hi], [tx, hi]]);
      Tm = mul([1, 0, 0, 1, tx, 0], Tm);
      return box;
    }
    function textShow(o, strBytes, tj) {
      var box = showBox(strBytes, tj);
      if (hits(box, region, C.tol)) {
        if (droppedSinceMove) C.fail('kept text directly follows removed text on the same line');
        raw(o); C.stats.textKept++;
      } else {
        droppedSinceMove = true; C.stats.textDropped++;
        if (o.op === "'" || o.op === '"') { // keep the line move (and spacing) without the string
          if (o.op === '"') out.push(enc(o.args[0].v + ' Tw ' + o.args[1].v + ' Tc\n'));
          out.push(enc('T*\n'));
        }
      }
    }
    function flushPath(o) {
      var kept = [], clip = path.clip;
      path.subs.forEach(function (s) {
        var b = bboxOf(gs.ctm, s.pts), pad = gs.lw * scaleOf(gs.ctm) + C.tol;
        if (hits(b, region, pad)) kept.push(s); else C.stats.subpathsDropped++;
      });
      if (!kept.length && !clip) { C.stats.pathsDropped++; path = null; return; }
      if (!kept.length) out.push(enc('0 0 m h\n'));
      kept.forEach(function (s) { s.chunks.forEach(function (c) { out.push(c); out.push(enc('\n')); }); });
      if (clip) out.push(enc(clip + '\n'));
      if (!kept.length && o.op !== 'n') out.push(enc('n\n')); else raw(o);
      path = null;
    }
    function boxRelation(b) { return !hits(b, region, C.tol) ? 'out' : within(b, region, 2.83 * 2) ? 'in' : 'straddle'; }

    for (var i = 0; i < ops.length; i++) {
      var o = ops[i], a = o.args, op = o.op;
      // path construction
      if (op === 'm' || op === 're' || op === 'l' || op === 'c' || op === 'v' || op === 'y' || op === 'h') {
        if (!path) path = { subs: [], clip: null };
        if (op === 'm' || op === 're' || !path.subs.length) path.subs.push({ chunks: [], pts: [] });
        var sp = path.subs[path.subs.length - 1]; sp.chunks.push(bytes.subarray(o.s, o.e));
        if (op === 're') { var x = num(a[0]), y = num(a[1]), w = num(a[2]), h = num(a[3]); sp.pts.push([x, y], [x + w, y], [x, y + h], [x + w, y + h]); path.subs.push({ chunks: [], pts: [] }); }
        else for (var k = 0; k + 1 < a.length; k += 2) sp.pts.push([num(a[k]), num(a[k + 1])]);
        if (op === 'h' && sp.pts.length === 0) sp.pts.push([0, 0]);
        continue;
      }
      if (op === 'W' || op === 'W*') { if (path) path.clip = op; else raw(o); continue; }
      if (/^(S|s|f|F|f\*|B|B\*|b|b\*|n)$/.test(op)) {
        if (path) { path.subs = path.subs.filter(function (s) { return s.chunks.length; }); path.subs.forEach(function (s) { if (!s.pts.length) s.pts.push([0, 0]); }); flushPath(o); } else raw(o);
        continue;
      }
      if (path) { // malformed: an operator inside a path. Flush conservatively (keep all)
        path.subs.forEach(function (s) { s.chunks.forEach(function (c) { out.push(c); out.push(enc('\n')); }); }); path = null;
      }
      switch (op) {
        case 'q': stack.push(Object.assign({}, gs)); raw(o); break;
        case 'Q': if (stack.length) gs = stack.pop(); raw(o); break;
        case 'cm': gs.ctm = mul(a.map(num), gs.ctm); raw(o); break;
        case 'w': gs.lw = num(a[0]); raw(o); break;
        case 'gs': {
          markUsed('ExtGState', a[0]); var eg = lookupRes('ExtGState', a[0] && a[0].v);
          try { var sm = eg && eg.lookup ? eg.lookup(N('SMask')) : null; if (sm && sm.toString() !== '/None') C.fail('soft mask'); var lw = eg && eg.lookup ? eg.lookup(N('LW')) : null; if (lw && lw.asNumber) gs.lw = lw.asNumber(); } catch (e) {}
          raw(o); break;
        }
        case 'BT': inText = true; Tm = Tlm = [1, 0, 0, 1, 0, 0]; droppedSinceMove = false; raw(o); break;
        case 'ET': inText = false; raw(o); break;
        case 'Tf': gs.font = a[0] && a[0].v; gs.fs = num(a[1]); markUsed('Font', a[0]); raw(o); break;
        case 'Tc': gs.Tc = num(a[0]); raw(o); break;
        case 'Tw': gs.Tw = num(a[0]); raw(o); break;
        case 'Tz': gs.Tz = num(a[0]); raw(o); break;
        case 'TL': gs.TL = num(a[0]); raw(o); break;
        case 'Ts': gs.Ts = num(a[0]); raw(o); break;
        case 'Td': Tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], Tlm); Tm = Tlm; droppedSinceMove = false; raw(o); break;
        case 'TD': gs.TL = -num(a[1]); Tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], Tlm); Tm = Tlm; droppedSinceMove = false; raw(o); break;
        case 'Tm': Tlm = Tm = a.map(num); droppedSinceMove = false; raw(o); break;
        case 'T*': Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); Tm = Tlm; droppedSinceMove = false; raw(o); break;
        case 'Tj': textShow(o, a[0] ? a[0].v : []); break;
        case 'TJ': textShow(o, null, a[0] ? a[0].v : []); break;
        case "'": Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); Tm = Tlm; droppedSinceMove = false; textShow(o, a[0] ? a[0].v : []); break;
        case '"': gs.Tw = num(a[0]); gs.Tc = num(a[1]); Tlm = mul([1, 0, 0, 1, 0, -gs.TL], Tlm); Tm = Tlm; droppedSinceMove = false; textShow(o, a[2] ? a[2].v : []); break;
        case 'Do': {
          var nm = a[0] && a[0].v, xo = lookupRes('XObject', nm), dict = xo && xo.dict, stype = dict && dict.lookup(N('Subtype'));
          stype = stype ? stype.toString() : '';
          if (stype === '/Image') {
            var rel = boxRelation(bboxOf(gs.ctm, [[0, 0], [1, 0], [0, 1], [1, 1]]));
            if (rel === 'out') { C.stats.imagesDropped++; break; }
            if (rel === 'straddle') C.fail('image crosses the crop edge');
            markUsed('XObject', a[0]); raw(o); break;
          }
          if (stype === '/Form') {
            var mx = dict.lookup(N('Matrix')), M = mx && mx.size ? [0, 1, 2, 3, 4, 5].map(function (j) { return mx.lookup(j).asNumber(); }) : [1, 0, 0, 1, 0, 0];
            var bb = dict.lookup(N('BBox')), BB = bb && bb.size ? [0, 1, 2, 3].map(function (j) { return bb.lookup(j).asNumber(); }) : [-1e9, -1e9, 1e9, 1e9];
            var fm = mul(M, gs.ctm), fb = bboxOf(fm, [[BB[0], BB[1]], [BB[2], BB[1]], [BB[0], BB[3]], [BB[2], BB[3]]]);
            if (!hits(fb, region, C.tol)) { C.stats.formsDropped++; break; }
            if (C.depth > 12) { C.fail('forms nested too deep'); markUsed('XObject', a[0]); raw(o); break; }
            var sub = [Math.max(region[0], fb[0]), Math.max(region[1], fb[1]), Math.min(region[2], fb[2]), Math.min(region[3], fb[3])];
            var fres = dict.lookup(N('Resources')) || res, fbytes;
            try { fbytes = L.decodePDFRawStream(xo).decode(); } catch (e) { C.fail('cannot decode form: ' + e.message); markUsed('XObject', a[0]); raw(o); break; }
            C.depth++; var r = filterStream(C, fbytes, fres, fm, sub); C.depth--;
            var entries = {};
            dict.entries().forEach(function (kv) { var key = kv[0].toString().slice(1); if (!/^(Length|Filter|DecodeParms|Resources|PieceInfo|Metadata|OC|StructParents|Ref)$/.test(key)) entries[key] = kv[1]; });
            entries.Resources = r.res;
            var ref = ctx.register(ctx.flateStream(r.bytes, entries)), nn = 'RX' + (C.seq++);
            newX[nn] = ref; C.stats.formsRewritten++;
            out.push(enc('/' + nn + ' Do\n')); break;
          }
          C.fail('unknown XObject ' + stype); markUsed('XObject', a[0]); raw(o); break;
        }
        case 'BI': {
          var r2 = boxRelation(bboxOf(gs.ctm, [[0, 0], [1, 0], [0, 1], [1, 1]]));
          if (r2 === 'out') { C.stats.imagesDropped++; break; }
          if (r2 === 'straddle') C.fail('inline image crosses the crop edge');
          var cs = a[0].v.CS || a[0].v.ColorSpace; markUsed('ColorSpace', cs); raw(o); break;
        }
        case 'sh': C.fail('shading'); markUsed('Shading', a[0]); raw(o); break;
        case 'cs': case 'CS': markUsed('ColorSpace', a[0]); raw(o); break;
        case 'scn': case 'SCN': markUsed('Pattern', a[a.length - 1]); raw(o); break;
        case 'BDC': C.stats.marked++; out.push(enc('/' + (a[0] && a[0].v || 'Span') + ' BMC\n')); break; // drop properties (ActualText/Alt can carry text)
        case 'DP': case 'MP': break;
        default: raw(o);
      }
    }
    // pruned resources
    var nr = ctx.obj({});
    Object.keys(used).forEach(function (cat) {
      var src = resDict(cat), names = Object.keys(used[cat]), d = null;
      if (src && src.lookup) names.forEach(function (n) { var v = src.get(N(n)); if (v) { if (!d) d = ctx.obj({}); d.set(N(n), v); } });
      if (cat === 'XObject') Object.keys(newX).forEach(function (n) { if (!d) d = ctx.obj({}); d.set(N(n), newX[n]); });
      if (d) nr.set(N(cat), d);
    });
    var ps = res && res.lookup ? res.lookup(N('ProcSet')) : null; if (ps) nr.set(N('ProcSet'), ps);
    var total = 0; out.forEach(function (c) { total += c.length; }); var buf = new Uint8Array(total), pos = 0; out.forEach(function (c) { buf.set(c, pos); pos += c.length; });
    return { bytes: buf, res: nr };
  }

  /* Rewrite page `pageIndex` of `doc` (a pdf-lib PDFDocument the caller owns) to contain only content inside box {left,bottom,right,top}. */
  function redactPage(L, doc, pageIndex, box, opts) {
    opts = opts || {};
    var page = doc.getPage(pageIndex), N = L.PDFName.of, ctx = doc.context, C = new Ctx(L, doc, box, opts.tol == null ? 0.5 : opts.tol);
    var contents = page.node.Contents(), parts = [];
    try {
      if (contents instanceof L.PDFArray) for (var i = 0; i < contents.size(); i++) parts.push(L.decodePDFRawStream(contents.lookup(i)).decode());
      else if (contents) parts.push(L.decodePDFRawStream(contents).decode());
    } catch (e) { return { unsafe: 'cannot decode page content: ' + e.message, stats: C.stats }; }
    var total = 0; parts.forEach(function (p) { total += p.length + 1; }); var all = new Uint8Array(total), pos = 0;
    parts.forEach(function (p) { all.set(p, pos); pos += p.length; all[pos++] = 10; });
    var region = [box.left, box.bottom, box.right, box.top];
    var r = filterStream(C, all, page.node.Resources(), [1, 0, 0, 1, 0, 0], region);
    page.node.set(N('Contents'), ctx.register(ctx.flateStream(r.bytes)));
    page.node.set(N('Resources'), r.res);
    page.node.delete(N('Annots'));
    return { unsafe: C.unsafe, stats: C.stats };
  }
  return { redactPage: redactPage, parse: parse };
});
