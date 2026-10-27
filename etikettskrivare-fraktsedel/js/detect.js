/* Label detection + geometry helpers. Pure JS, no DOM. UMD: window.LABELDETECT / module.exports */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LABELDETECT = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PT_PER_MM = 72 / 25.4;
  var VERSION = '1.0.0';

  /* Output formats (mm) */
  var FORMATS = {
    '100x150': { w: 100, h: 150, sheetW: 100, sheetH: 150 },
    '4x6': { w: 101.6, h: 152.4, sheetW: 101.6, sheetH: 152.4 },
    'a4': { w: 100, h: 150, sheetW: 210, sheetH: 297, cutMarks: true }
  };

  /* Pages that already are a label (mm, portrait w<=h). Sources in README. */
  var LABEL_PAGES = [
    { w: 100, h: 150, name: '100 × 150 mm' }, { w: 101.6, h: 152.4, name: '4 × 6 in' },
    { w: 105, h: 148, name: 'A6' }, { w: 105, h: 190, name: 'PostNord standard 105 × 190' },
    { w: 75, h: 105, name: 'PostNord liten 75 × 105' }, { w: 103, h: 199, name: 'DHL 103 × 199' },
    { w: 103, h: 150, name: 'DHL 103 × 150' }, { w: 101.6, h: 203.2, name: '4 × 8 in' },
    { w: 74, h: 105, name: 'A7' }, { w: 102, h: 192, name: 'Bring 102 × 192' }, { w: 104, h: 159, name: 'DYMO 4XL' }
  ];
  function pageIsLabel(wmm, hmm) {
    var a = Math.min(wmm, hmm), b = Math.max(wmm, hmm);
    for (var i = 0; i < LABEL_PAGES.length; i++) {
      var p = LABEL_PAGES[i];
      if (Math.abs(p.w - a) <= 3 && Math.abs(p.h - b) <= 4) return p;
    }
    return null;
  }

  /* Carrier / platform from page text */
  var CARRIERS = [
    ['postnord', /post\s?nord/i, 'PostNord'], ['dhl', /\bDHL\b/, 'DHL'], ['budbee', /budbee/i, 'Budbee'],
    ['instabox', /insta(box|bee)/i, 'Instabox'], ['bring', /\bBring\b/, 'Bring'], ['schenker', /schenker/i, 'DB Schenker'],
    ['earlybird', /early\s?bird/i, 'Early Bird'], ['ups', /\bUPS\b/, 'UPS'], ['dbs', /\bGLS\b/, 'GLS']
  ];
  var PLATFORMS = [['vinted', /vinted/i, 'Vinted'], ['tradera', /tradera/i, 'Tradera'], ['blocket', /blocket/i, 'Blocket']];
  function count(re, s) { var m = s.match(new RegExp(re.source, re.flags.indexOf('g') >= 0 ? re.flags : re.flags + 'g')); return m ? m.length : 0; }
  function detectCarrier(text) {
    text = text || '';
    var best = null, bn = 0, plat = null;
    CARRIERS.forEach(function (c) { var n = count(c[1], text); if (n > bn) { bn = n; best = c; } });
    PLATFORMS.forEach(function (p) { if (!plat && p[1].test(text)) plat = p; });
    return { carrier: best ? best[0] : null, carrierName: best ? best[2] : null, platform: plat ? plat[0] : null, platformName: plat ? plat[2] : null };
  }

  /* Known layouts. box = fractions of the *visual* page (x0,y0,x1,y1 from top-left). */
  var PRESETS = [
    { id: 'tradera-dhl-a4', name: 'Tradera / DHL Service Point (A4)', platform: 'tradera', carrier: 'dhl', page: [210, 297],
      // traderacrop.py: cropbox upper_left (13,708), lower_right (285,201) on an A4 page (595.28 x 841.89 pt)
      box: [13 / 595.28, (841.89 - 708) / 841.89, 285 / 595.28, (841.89 - 201) / 841.89],
      source: 'https://github.com/jonasbjork/traderacrop (traderacrop.py, 2024)', verified: 'kryssreferens mot publicerad exempelbild, ej mot egen fraktsedel' }
  ];
  function findPreset(info, wmm, hmm) {
    for (var i = 0; i < PRESETS.length; i++) {
      var p = PRESETS[i];
      if (p.platform && p.platform !== info.platform) continue;
      if (p.carrier && p.carrier !== info.carrier) continue;
      if (Math.abs(p.page[0] - wmm) > 4 || Math.abs(p.page[1] - hmm) > 4) continue;
      return p;
    }
    return null;
  }

  /* ---------- raster detection ---------- */
  // gray: Uint8Array/Uint8ClampedArray luminance (0 black..255 white), w x h, ppm = pixels per mm
  function removeGuideLines(ink, w, h, ppm) {
    var gap = Math.max(2, Math.round(3 * ppm)), minLen = 60 * ppm, d = Math.max(2, Math.round(1.2 * ppm)), removed = 0;
    function pass(horizontal) {
      var L = horizontal ? w : h, M = horizontal ? h : w, pageLen = L;
      var at = horizontal ? function (m, l) { return ink[m * w + l]; } : function (m, l) { return ink[l * w + m]; };
      var clr = horizontal ? function (m, l) { ink[m * w + l] = 0; } : function (m, l) { ink[l * w + m] = 0; };
      var segs = [];
      for (var m = d; m < M - d; m++) {
        var l = 0;
        while (l < L) {
          if (!at(m, l)) { l++; continue; }
          var s = l, last = l, n = 0;
          while (l < L && l - last <= gap) { if (at(m, l)) { last = l; n++; } l++; }
          var len = last - s + 1;
          if (len >= minLen) {
            var cov = n / len;
            if (cov < 0.92 || len >= 0.96 * pageLen) {
              // isolation: rows/cols at +-d must be (nearly) empty along the span
              var a = 0, b = 0;
              for (var k = s; k <= last; k++) { a += at(m - d, k); b += at(m + d, k); }
              if (a / len < 0.08 && b / len < 0.08) segs.push([m, s, last]);
            }
          }
          l = last + 1;
        }
      }
      segs.forEach(function (sg) { for (var k = sg[1]; k <= sg[2]; k++) { if (at(sg[0], k)) { clr(sg[0], k); removed++; } } });
      return segs.length;
    }
    var hs = pass(true), vs = pass(false);
    return { h: hs, v: vs, px: removed };
  }

  function barcodeScore(ink, w, x0, y0, x1, y1, ppm) {
    // number of columns having a vertical run >= 9 mm, grouped into bars; also horizontal (rotated barcodes)
    var need = Math.round(9 * ppm), cols = 0, rows = 0, x, y, run;
    for (x = x0; x <= x1; x++) { run = 0; for (y = y0; y <= y1; y++) { if (ink[y * w + x]) { if (++run >= need) { cols++; break; } } else run = 0; } }
    for (y = y0; y <= y1; y++) { run = 0; for (x = x0; x <= x1; x++) { if (ink[y * w + x]) { if (++run >= need) { rows++; break; } } else run = 0; } }
    // transitions along the best line through the candidate columns approximate bar count
    return Math.max(cols, rows) / ppm; // in mm of "bar-covered" width
  }

  function detectLabels(gray, w, h, ppm, opts) {
    opts = opts || {};
    var N = w * h, ink = new Uint8Array(N), total = 0, thr = opts.threshold || 170, i, x, y;
    for (i = 0; i < N; i++) if (gray[i] < thr) { ink[i] = 1; total++; }
    if (total < N * 0.0005) return { labels: [], blank: true };
    var guides = removeGuideLines(ink, w, h, ppm);
    var cs = Math.max(2, Math.round(2 * ppm)), gw = Math.ceil(w / cs), gh = Math.ceil(h / cs), G = gw * gh;
    var cnt = new Uint32Array(G);
    for (y = 0; y < h; y++) { var row = (y / cs | 0) * gw, o = y * w; for (x = 0; x < w; x++) if (ink[o + x]) cnt[row + (x / cs | 0)]++; }
    var occ = new Uint8Array(G), noise = Math.max(2, cs * cs * 0.01);
    for (i = 0; i < G; i++) occ[i] = cnt[i] >= noise ? 1 : 0;
    var r = opts.dilate == null ? 1 : opts.dilate, dil = new Uint8Array(G), tmp = new Uint8Array(G);
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) { var v = 0; for (var k = -r; k <= r && !v; k++) { var xx = x + k; if (xx >= 0 && xx < gw && occ[y * gw + xx]) v = 1; } tmp[y * gw + x] = v; }
    for (y = 0; y < gh; y++) for (x = 0; x < gw; x++) { var v2 = 0; for (var k2 = -r; k2 <= r && !v2; k2++) { var yy = y + k2; if (yy >= 0 && yy < gh && tmp[yy * gw + x]) v2 = 1; } dil[y * gw + x] = v2; }
    var lab = new Int32Array(G).fill(-1), comps = [], stack = [];
    for (i = 0; i < G; i++) {
      if (!dil[i] || lab[i] >= 0) continue;
      var c = { id: comps.length, x0: 1e9, y0: 1e9, x1: -1, y1: -1, ink: 0 };
      lab[i] = c.id; stack.push(i);
      while (stack.length) {
        var p = stack.pop(), px = p % gw, py = (p / gw) | 0;
        if (occ[p]) { c.ink += cnt[p]; if (px < c.x0) c.x0 = px; if (px > c.x1) c.x1 = px; if (py < c.y0) c.y0 = py; if (py > c.y1) c.y1 = py; }
        if (px > 0 && dil[p - 1] && lab[p - 1] < 0) { lab[p - 1] = c.id; stack.push(p - 1); }
        if (px < gw - 1 && dil[p + 1] && lab[p + 1] < 0) { lab[p + 1] = c.id; stack.push(p + 1); }
        if (py > 0 && dil[p - gw] && lab[p - gw] < 0) { lab[p - gw] = c.id; stack.push(p - gw); }
        if (py < gh - 1 && dil[p + gw] && lab[p + gw] < 0) { lab[p + gw] = c.id; stack.push(p + gw); }
      }
      if (c.x1 >= 0) comps.push(c);
    }
    comps.forEach(function (c) {
      c.px = { x0: c.x0 * cs, y0: c.y0 * cs, x1: Math.min(w - 1, (c.x1 + 1) * cs - 1), y1: Math.min(h - 1, (c.y1 + 1) * cs - 1) };
      c.wmm = (c.px.x1 - c.px.x0 + 1) / ppm; c.hmm = (c.px.y1 - c.px.y0 + 1) / ppm;
    });
    var big = comps.filter(function (c) { return c.wmm >= 30 && c.hmm >= 30; });
    if (!big.length) big = comps.slice().sort(function (a, b) { return b.ink - a.ink; }).slice(0, 1);
    big.forEach(function (c) { c.bar = barcodeScore(ink, w, c.px.x0, c.px.y0, c.px.x1, c.px.y1, ppm); });
    var withBar = big.filter(function (c) { return c.bar >= 12; });
    var pool = withBar.length ? withBar : big;
    var maxInk = Math.max.apply(null, pool.map(function (c) { return c.ink; }));
    var sel = pool.filter(function (c) { return c.ink >= 0.3 * maxInk; });
    // drop candidates nested inside another candidate (e.g. a barcode inside a framed label)
    var inside = function (a, b) { return a !== b && a.px.x0 >= b.px.x0 && a.px.y0 >= b.px.y0 && a.px.x1 <= b.px.x1 && a.px.y1 <= b.px.y1; };
    sel = sel.filter(function (a) { return !sel.some(function (b) { return inside(a, b); }); });
    // merge candidates that are parts of one unframed label: stacked (or side by side) and aligned, with the union still label-sized
    var merged = true;
    while (merged) {
      merged = false;
      for (var a1 = 0; a1 < sel.length && !merged; a1++) for (var b1 = a1 + 1; b1 < sel.length && !merged; b1++) {
        var A = sel[a1].px, B = sel[b1].px;
        var ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0);
        var colAligned = ox >= 0.6 * Math.min(A.x1 - A.x0, B.x1 - B.x0), rowAligned = oy >= 0.6 * Math.min(A.y1 - A.y0, B.y1 - B.y0);
        if (!colAligned && !rowAligned) continue;
        var U = { x0: Math.min(A.x0, B.x0), y0: Math.min(A.y0, B.y0), x1: Math.max(A.x1, B.x1), y1: Math.max(A.y1, B.y1) };
        var uw = (U.x1 - U.x0 + 1) / ppm, uh = (U.y1 - U.y0 + 1) / ppm;
        if (Math.min(uw, uh) > 115 || Math.max(uw, uh) > 205) continue;
        // nothing else (another candidate) may sit inside the union
        var blocked = comps.some(function (c) { return c !== sel[a1] && c !== sel[b1] && c.ink > 0.05 * maxInk && c.px.x0 < U.x1 && c.px.x1 > U.x0 && c.px.y0 < U.y1 && c.px.y1 > U.y0 && !(c.px.x0 >= U.x0 && c.px.x1 <= U.x1 && c.px.y0 >= U.y0 && c.px.y1 <= U.y1); });
        if (blocked) continue;
        sel[a1] = { px: U, ink: sel[a1].ink + sel[b1].ink, bar: Math.max(sel[a1].bar, sel[b1].bar), wmm: uw, hmm: uh, parts: [sel[a1], sel[b1]] };
        sel.splice(b1, 1); merged = true;
      }
    }
    // absorb small nearby fragments (e.g. a footer line of an unframed label)
    var gapPx = 5 * ppm;
    comps.forEach(function (c) {
      if (sel.indexOf(c) >= 0 || sel.some(function (s) { return s.parts && (s.parts.indexOf(c) >= 0 || s.parts.some(function (q) { return q.parts && q.parts.indexOf(c) >= 0; })); })) return;
      var tol = 2 * ppm;
      var best = null, bd = 1e9;
      sel.forEach(function (s) {
        var dx = Math.max(0, s.px.x0 - c.px.x1, c.px.x0 - s.px.x1), dy = Math.max(0, s.px.y0 - c.px.y1, c.px.y0 - s.px.y1), dd = Math.max(dx, dy);
        // only fragments lying within the label's column or row band (never widen the label sideways into other content)
        var inCol = c.px.x0 >= s.px.x0 - tol && c.px.x1 <= s.px.x1 + tol, inRow = c.px.y0 >= s.px.y0 - tol && c.px.y1 <= s.px.y1 + tol;
        if (dd < bd && (inCol || inRow) && c.wmm * c.hmm < 0.5 * s.wmm * s.hmm) { bd = dd; best = s; }
      });
      if (best && bd <= gapPx) { best.px = { x0: Math.min(best.px.x0, c.px.x0), y0: Math.min(best.px.y0, c.px.y0), x1: Math.max(best.px.x1, c.px.x1), y1: Math.max(best.px.y1, c.px.y1) }; }
    });
    var pad = Math.round(1 * ppm);
    var labels = sel.map(function (c) {
      // tight ink bbox inside the cell box
      var bx0 = w, by0 = h, bx1 = -1, by1 = -1;
      for (var yy = c.px.y0; yy <= c.px.y1; yy++) for (var xx = c.px.x0; xx <= c.px.x1; xx++) if (ink[yy * w + xx]) { if (xx < bx0) bx0 = xx; if (xx > bx1) bx1 = xx; if (yy < by0) by0 = yy; if (yy > by1) by1 = yy; }
      if (bx1 < 0) { bx0 = c.px.x0; by0 = c.px.y0; bx1 = c.px.x1; by1 = c.px.y1; }
      bx0 = Math.max(0, bx0 - pad); by0 = Math.max(0, by0 - pad); bx1 = Math.min(w - 1, bx1 + pad); by1 = Math.min(h - 1, by1 + pad);
      return { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1, ink: c.ink, barcode: c.bar >= 12, barMm: Math.round(c.bar) };
    });
    // reading order: rows (top first), then left to right
    labels.sort(function (a, b) { var tol = 20 * ppm; return Math.abs(a.y - b.y) > tol ? a.y - b.y : a.x - b.x; });
    return { labels: labels, blank: false, guides: guides, components: comps.length };
  }

  /* ---------- geometry ---------- */
  // pdf.js viewport mapping (view = [x0,y0,x1,y1] in PDF user space, rotate cw in 0/90/180/270, scale px per pt)
  function pdfToPx(pt, vp) {
    var v = vp.view, s = vp.scale, x = pt[0], y = pt[1];
    switch (((vp.rotate % 360) + 360) % 360) {
      case 90: return [(y - v[1]) * s, (x - v[0]) * s];
      case 180: return [(v[2] - x) * s, (y - v[1]) * s];
      case 270: return [(v[3] - y) * s, (v[2] - x) * s];
      default: return [(x - v[0]) * s, (v[3] - y) * s];
    }
  }
  function pxToPdf(p, vp) {
    var v = vp.view, s = vp.scale, a = p[0] / s, b = p[1] / s;
    switch (((vp.rotate % 360) + 360) % 360) {
      case 90: return [b + v[0], a + v[1]];
      case 180: return [v[2] - a, b + v[1]];
      case 270: return [v[2] - b, v[3] - a];
      default: return [a + v[0], v[3] - b];
    }
  }
  function pxBoxToPdf(box, vp) {
    var p1 = pxToPdf([box.x, box.y], vp), p2 = pxToPdf([box.x + box.w, box.y + box.h], vp);
    return { left: Math.min(p1[0], p2[0]), right: Math.max(p1[0], p2[0]), bottom: Math.min(p1[1], p2[1]), top: Math.max(p1[1], p2[1]) };
  }
  function norm(a) { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; }
  // items: [{angle (deg, ccw, user space), weight, x, y}] ; returns visual angle snapped to 0/90/180/-90 or null
  function dominantAngle(items, pageRotate, inBox) {
    var acc = { 0: 0, 90: 0, 180: 0, 270: 0 }, tot = 0;
    (items || []).forEach(function (it) {
      if (inBox && !inBox(it)) return;
      var a = norm(it.angle - (pageRotate || 0)), snap = ((Math.round(a / 90) * 90) % 360 + 360) % 360;
      acc[snap] += it.weight; tot += it.weight;
    });
    if (tot < 3) return null;
    var best = 0; [90, 180, 270].forEach(function (k) { if (acc[k] > acc[best]) best = k; });
    return acc[best] / tot >= 0.5 ? best : null;
  }
  // visual box (w,h), text angle (visual ccw: 0,90,180,270 or null) -> cw rotation to apply
  function chooseRotation(vw, vh, textAngle) {
    var cands = vw > vh * 1.05 ? [90, 270] : [0, 180];
    if (textAngle == null) return cands[0];
    var best = cands[0], bs = 1e9;
    cands.forEach(function (r) { var f = Math.abs(norm(textAngle - r)); if (f < bs - 1e-6) { bs = f; best = r; } });
    return best;
  }
  // place content (w x h, in pt, unrotated) rotated cw by rot, centered and fitted into target {x,y,w,h} (pt) with margin m
  function placement(w, h, rot, target, m) {
    rot = ((rot % 360) + 360) % 360; m = m || 0;
    var sw = rot % 180 ? h : w, sh = rot % 180 ? w : h;
    var s = Math.min((target.w - 2 * m) / sw, (target.h - 2 * m) / sh);
    var th = -rot * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th), a = s * w / 2, b = s * h / 2;
    var cx = target.x + target.w / 2, cy = target.y + target.h / 2;
    return { x: cx - (cos * a - sin * b), y: cy - (sin * a + cos * b), scale: s, rotate: -rot, outW: sw * s, outH: sh * s };
  }
  function iou(a, b) {
    var x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y), x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
    var inter = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
    return inter / (a.w * a.h + b.w * b.h - inter);
  }
  function contains(a, b, tol) { tol = tol || 0; return b.x >= a.x - tol && b.y >= a.y - tol && b.x + b.w <= a.x + a.w + tol && b.y + b.h <= a.y + a.h + tol; }

  /* Combine auto detection with a preset for one page. Returns [{box(px), method}] */
  function decide(det, preset, wpx, hpx, ppm) {
    var autos = det.labels.map(function (b) { return { box: b, method: 'auto', barcode: b.barcode }; });
    if (!preset) return autos;
    var pb = { x: preset.box[0] * wpx, y: preset.box[1] * hpx, w: (preset.box[2] - preset.box[0]) * wpx, h: (preset.box[3] - preset.box[1]) * hpx };
    if (!autos.length) return [{ box: pb, method: 'preset', preset: preset.id, barcode: false }];
    // auto box that swallowed the preset area plus a lot more -> preset is better; otherwise trust the tight auto box
    var best = autos[0], bi = -1;
    autos.forEach(function (a) { var v = iou(a.box, pb); if (v > bi) { bi = v; best = a; } });
    if (contains(best.box, pb, 3 * ppm) && best.box.w * best.box.h > 1.4 * pb.w * pb.h) return [{ box: pb, method: 'preset', preset: preset.id, barcode: best.barcode }];
    if (bi >= 0.6) { best.method = 'auto+preset'; best.preset = preset.id; }
    return autos;
  }

  /* Full plan for one page. pg = {gray,w,h,ppm, view:[x0,y0,x1,y1], rotate, items:[{angle,weight,x,y}], text} */
  function planPage(pg) {
    var info = detectCarrier(pg.text), ppm = pg.ppm, wmm = pg.w / ppm, hmm = pg.h / ppm;
    var det = detectLabels(pg.gray, pg.w, pg.h, ppm);
    if (det.blank) return { info: info, blank: true, labels: [], wmm: wmm, hmm: hmm };
    var lp = pageIsLabel(wmm, hmm), preset = null, cands;
    if (lp) cands = [{ box: { x: 0, y: 0, w: pg.w, h: pg.h }, method: 'page', pageName: lp.name, barcode: true }];
    else { preset = findPreset(info, wmm, hmm); cands = decide(det, preset, pg.w, pg.h, ppm); }
    var vp = { view: pg.view, rotate: pg.rotate || 0, scale: ppm / PT_PER_MM };
    var labels = cands.map(function (c) {
      var pdfBox = pxBoxToPdf(c.box, vp);
      var inBox = function (it) { return it.x >= pdfBox.left - 2 && it.x <= pdfBox.right + 2 && it.y >= pdfBox.bottom - 2 && it.y <= pdfBox.top + 2; };
      var ang = dominantAngle(pg.items, pg.rotate || 0, inBox);
      if (ang == null) ang = dominantAngle(pg.items, pg.rotate || 0, null);
      var r = chooseRotation(c.box.w, c.box.h, ang);
      return { box: c.box, pdfBox: pdfBox, method: c.method, preset: c.preset || null, pageName: c.pageName || null, barcode: c.barcode !== false,
        textAngle: ang, rot: r, totalRot: ((pg.rotate || 0) + r) % 360, wmm: c.box.w / ppm, hmm: c.box.h / ppm };
    });
    return { info: info, blank: false, labels: labels, wmm: wmm, hmm: hmm, preset: preset ? preset.id : null };
  }

  return { VERSION: VERSION, planPage: planPage, PT_PER_MM: PT_PER_MM, FORMATS: FORMATS, LABEL_PAGES: LABEL_PAGES, PRESETS: PRESETS, pageIsLabel: pageIsLabel,
    detectCarrier: detectCarrier, findPreset: findPreset, detectLabels: detectLabels, removeGuideLines: removeGuideLines,
    pdfToPx: pdfToPx, pxToPdf: pxToPdf, pxBoxToPdf: pxBoxToPdf, dominantAngle: dominantAngle, chooseRotation: chooseRotation,
    placement: placement, iou: iou, contains: contains, decide: decide };
});
