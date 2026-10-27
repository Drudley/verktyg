/* Builds the print-ready PDF with pdf-lib. UMD: window.LABELOUT / module.exports. Needs PDFLib (global or passed in). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./detect.js'), require('./redact.js'));
  else root.LABELOUT = factory(root.LABELDETECT, root.LABELREDACT);
})(typeof self !== 'undefined' ? self : this, function (D, R) {
  'use strict';
  var MM = D.PT_PER_MM;

  /* jobs: [{kind:'vector', srcKey, bytes, pageIndex, box:{left,bottom,right,top}, rot}  (rot = total cw rotation incl. page /Rotate)
            {kind:'raster', png|jpg: Uint8Array, w, h (pt, visual), rot}]
     opts: {format:'100x150'|'4x6'|'a4', marginMm, title, caption}
     Privacy: vector jobs are REDACTED first (js/redact.js) so nothing outside the crop stays in the file.
     hooks (optional but used by the app and tests):
       rasterize(job) -> raster job   used when redaction reports `unsafe` or verification fails
       textItems(bytes) -> [[{x,y,ex,ey}]] per output page (pdf.js text extraction of the result) for verification */
  async function build(PDFLib, jobs, opts, hooks) {
    hooks = hooks || {};
    jobs = jobs.slice();
    for (var pass = 0; pass < 2; pass++) {
      var res = await buildOnce(PDFLib, jobs, opts, hooks);
      if (!hooks.textItems) return res;
      var pages = await hooks.textItems(res.bytes), bad = [];
      pages.forEach(function (items, i) {
        var rects = [res.report[i].rect, res.report[i].captionRect].filter(Boolean), tol = 1.5 * MM;
        var inR = function (p, r) { return p[0] >= r[0] - tol && p[0] <= r[2] + tol && p[1] >= r[1] - tol && p[1] <= r[3] + tol; };
        var out = items.filter(function (t) { return !rects.some(function (r) { return inR([t.x, t.y], r) && inR([t.ex, t.ey], r); }); });
        if (out.length) bad.push(i);
      });
      if (!bad.length) { res.verified = true; return res; }
      if (pass === 1 || !hooks.rasterize) throw new Error('text outside the label remains on page ' + (bad[0] + 1));
      for (var b = 0; b < bad.length; b++) { var j0 = jobs[bad[b]]; jobs[bad[b]] = Object.assign(await hooks.rasterize(j0), { reason: 'verification: text outside crop' }); }
    }
  }
  async function buildOnce(PDFLib, jobs, opts, hooks) {
    opts = opts || {};
    var F = D.FORMATS[opts.format || '100x150'], m = (opts.marginMm == null ? 2 : opts.marginMm) * MM;
    var out = await PDFLib.PDFDocument.create();
    out.setTitle(opts.title || 'Fraktetiketter'); out.setProducer('fraktsedel-etikett'); out.setCreator('fraktsedel-etikett');
    var font = null, report = [];
    for (var i = 0; i < jobs.length; i++) {
      var capRect = null, j = jobs[i], page = out.addPage([F.sheetW * MM, F.sheetH * MM]);
      var target = { x: (F.sheetW - F.w) / 2 * MM, y: (F.sheetH - F.h) / 2 * MM, w: F.w * MM, h: F.h * MM };
      if (F.cutMarks) target.y = (F.sheetH - F.h - 30) * MM; // label in the upper part, caption below
      var pl;
      var red = null;
      if (j.kind === 'vector') {
        // a private copy of the source per job: the page is rewritten in place by the redactor
        var src = await PDFLib.PDFDocument.load(j.bytes, { ignoreEncryption: true, updateMetadata: false });
        red = R.redactPage(PDFLib, src, j.pageIndex, j.box);
        if (red.unsafe) {
          if (!hooks.rasterize) throw new Error('cannot redact safely: ' + red.unsafe);
          j = jobs[i] = Object.assign(await hooks.rasterize(j), { reason: red.unsafe });
        }
      }
      if (j.kind === 'vector') {
        var sp = src.getPage(j.pageIndex);
        var emb = await out.embedPage(sp, j.box);
        pl = D.placement(j.box.right - j.box.left, j.box.top - j.box.bottom, j.rot, target, F.cutMarks ? 0 : m);
        page.drawPage(emb, { x: pl.x, y: pl.y, xScale: pl.scale, yScale: pl.scale, rotate: PDFLib.degrees(pl.rotate) });
      } else {
        var img = j.png ? await out.embedPng(j.png) : await out.embedJpg(j.jpg);
        pl = D.placement(j.w, j.h, j.rot, target, F.cutMarks ? 0 : m);
        page.drawImage(img, { x: pl.x, y: pl.y, width: j.w * pl.scale, height: j.h * pl.scale, rotate: PDFLib.degrees(pl.rotate) });
      }
      if (F.cutMarks) {
        var L = 6 * MM, g = 2 * MM, black = PDFLib.rgb(0, 0, 0), x0 = target.x, y0 = target.y, x1 = x0 + target.w, y1 = y0 + target.h;
        [[x0, y0, -1, -1], [x1, y0, 1, -1], [x0, y1, -1, 1], [x1, y1, 1, 1]].forEach(function (c) {
          page.drawLine({ start: { x: c[0] + c[2] * g, y: c[1] }, end: { x: c[0] + c[2] * (g + L), y: c[1] }, thickness: 0.5, color: black });
          page.drawLine({ start: { x: c[0], y: c[1] + c[3] * g }, end: { x: c[0], y: c[1] + c[3] * (g + L) }, thickness: 0.5, color: black });
        });
        if (!font) font = await out.embedFont(PDFLib.StandardFonts.Helvetica);
        var cap = opts.caption || 'Klipp längs hörnmarkeringarna (100 × 150 mm). Skriv ut i 100 % / faktisk storlek.';
        page.drawText(cap, { x: target.x, y: target.y - 14 * MM, size: 8, font: font, color: PDFLib.rgb(0.35, 0.35, 0.35) });
        var capRect = [target.x, target.y - 14 * MM - 3, target.x + font.widthOfTextAtSize(cap, 8), target.y - 14 * MM + 9];
      }
      var cx = target.x + target.w / 2, cy = target.y + target.h / 2;
      report.push({ scale: pl.scale, outWmm: pl.outW / MM, outHmm: pl.outH / MM, rotate: -pl.rotate, kind: j.kind, reason: j.reason || null, stats: red && red.stats,
        rect: [cx - pl.outW / 2, cy - pl.outH / 2, cx + pl.outW / 2, cy + pl.outH / 2], captionRect: capRect });
    }
    var bytes = await out.save({ useObjectStreams: true });
    return { bytes: bytes, report: report };
  }
  return { build: build };
});
