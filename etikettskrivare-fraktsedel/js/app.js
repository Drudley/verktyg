(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var D = window.LABELDETECT, OUT = window.LABELOUT, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL;
  var PPM = 4;                         // detection/preview raster: 4 px per mm (≈102 dpi)
  var RASTER_DPI = 300;                // crop of an uploaded photo/image
  var PDF_RASTER_DPI = 600;            // privacy/encryption fallback for PDFs: crop rendered at 600 dpi
  var files = [], labels = [], skipped = { blank: 0, nobar: 0 }, lang = 'sv', settings = loadSettings(), seq = 0;
  var pdfjs = null, pdfLibP = null;
  var abs = function (p) { return new URL(p, document.baseURI).href; };

  // ---------- i18n ----------
  var EN = {
    h1: 'Print shipping labels on a label printer', lead: 'Drop the shipping label PDF from Vinted, Tradera, Blocket, PostNord, DHL, Budbee, Instabox or Bring. The tool finds the label on the A4 page, rotates it upright and makes a crisp 100×150 mm PDF. <strong>Your files never leave your computer.</strong>',
    fmt: 'Format', 'f-4x6': '4×6 in', 'f-a4': 'A4 with cut marks', margin: 'Margin',
    drop: 'Drop shipping labels (PDF) here or <u>choose files</u>', dropsub: 'One or more PDFs · also PNG/JPG · A4, Letter or ready-made label pages', sample: 'Try a sample label',
    clear: 'Clear', howto: 'Drag the green box to move it, or its corners to resize. The preview on the right shows the label as it will be printed.',
    notice: '<strong>Always check the print:</strong> the barcode must scan. Some carriers (e.g. DHL) require labels to be printed at original size – a scaled-down label may in rare cases be rejected. Print at 100 % / actual size.',
    'pw-h': 'Merge all labels into one PDF', 'pw-p': 'Print every label at once – one label per page, in order. Single labels are always free to download.', close: 'Close'
  };
  var SV = {};
  var METHOD = { sv: { preset: 'Förinställning', 'auto+preset': 'Automatisk + förinställning', auto: 'Automatisk', page: 'Hel sida', manual: 'Manuell' },
                 en: { preset: 'Preset', 'auto+preset': 'Automatic + preset', auto: 'Automatic', page: 'Whole page', manual: 'Manual' } };
  var T = {
    sv: { reading: function (n) { return 'Läser ' + n + '…'; }, loading: 'Laddar PDF-motorn…', err: 'Kunde inte läsa ', pw: ' – filen är lösenordsskyddad.', notpdf: ' – inte en PDF eller bild.',
      title: function (n) { return n === 1 ? '1 etikett hittad' : n + ' etiketter hittade'; },
      meta: function (f, sel) { return f + (f === 1 ? ' fil' : ' filer') + ' · ' + sel + ' valda för utskrift'; },
      all: function (n) { return n > 1 ? 'Ladda ner alla (' + n + ') i en PDF' : 'Ladda ner etiketten'; },
      skippedBlank: function (n) { return n + (n === 1 ? ' tom sida hoppades över.' : ' tomma sidor hoppades över.'); },
      nobar: function (n) { return n + (n === 1 ? ' sida' : ' sidor') + ' utan streckkod (troligen instruktioner) är avmarkerade.'; },
      none: 'Ingen etikett hittades. Kontrollera att filen är en fraktsedel.', truncated: function (n) { return 'Bara de första ' + n + ' sidorna lästes.'; },
      page: 'Sida', carrier: 'Fraktbolag', platform: 'Från', method: 'Beskärning', size: 'Storlek', scale: 'Skala', rot: 'Vridning', include: 'Ta med', reset: 'Återställ', dl: 'Ladda ner',
      unknown: 'okänt', auto: 'Auto', nobarTag: 'ingen streckkod', raster: 'som bild (300 dpi)',
      small: function (p) { return 'Etiketten skalas till ' + p + ' %. Streckkoden blir mindre – kontrollera att den går att skanna. Vissa fraktbolag kräver originalstorlek.'; },
      big: function (p) { return 'Etiketten förstoras till ' + p + ' %.'; },
      done: function (n) { return n === 1 ? 'PDF med 1 etikett nedladdad.' : 'PDF med ' + n + ' etiketter nedladdad.'; }, building: 'Skapar PDF…', nothing: 'Välj minst en etikett.' },
    en: { reading: function (n) { return 'Reading ' + n + '…'; }, loading: 'Loading the PDF engine…', err: 'Could not read ', pw: ' – the file is password-protected.', notpdf: ' – not a PDF or image.',
      title: function (n) { return n === 1 ? '1 label found' : n + ' labels found'; },
      meta: function (f, sel) { return f + (f === 1 ? ' file' : ' files') + ' · ' + sel + ' selected for printing'; },
      all: function (n) { return n > 1 ? 'Download all (' + n + ') as one PDF' : 'Download the label'; },
      skippedBlank: function (n) { return n + (n === 1 ? ' blank page was skipped.' : ' blank pages were skipped.'); },
      nobar: function (n) { return n + (n === 1 ? ' page' : ' pages') + ' without a barcode (probably instructions) are unticked.'; },
      none: 'No label found. Check that the file is a shipping label.', truncated: function (n) { return 'Only the first ' + n + ' pages were read.'; },
      page: 'Page', carrier: 'Carrier', platform: 'From', method: 'Crop', size: 'Size', scale: 'Scale', rot: 'Rotation', include: 'Include', reset: 'Reset', dl: 'Download',
      unknown: 'unknown', auto: 'Auto', nobarTag: 'no barcode', raster: 'as image (300 dpi)',
      small: function (p) { return 'The label is scaled to ' + p + ' %. The barcode gets smaller – check that it scans. Some carriers require original size.'; },
      big: function (p) { return 'The label is enlarged to ' + p + ' %.'; },
      done: function (n) { return n === 1 ? 'PDF with 1 label downloaded.' : 'PDF with ' + n + ' labels downloaded.'; }, building: 'Building PDF…', nothing: 'Select at least one label.' }
  };
  function t(k) { return T[lang][k]; }
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var Dct = l === 'en' ? EN : SV;
    document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (Dct[el.dataset.i18n]) el.innerHTML = Dct[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    if (labels.length) renderAll();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- settings ----------
  function loadSettings() { var s = { format: '100x150', margin: 2 }; try { var j = JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || '{}'); if (D.FORMATS[j.format]) s.format = j.format; if ([0, 2, 4].indexOf(j.margin) >= 0) s.margin = j.margin; } catch (e) {} return s; }
  function saveSettings() { try { localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(settings)); } catch (e) {} }
  document.querySelectorAll('input[name=format]').forEach(function (r) { r.checked = r.value === settings.format; r.addEventListener('change', function () { settings.format = r.value; saveSettings(); labels.forEach(updateLabel); }); });
  $('#margin').value = String(settings.margin);
  $('#margin').addEventListener('change', function () { settings.margin = +$('#margin').value; saveSettings(); labels.forEach(updateLabel); });

  function status(msg, err) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }

  // ---------- lazy libraries (only after a file is dropped) ----------
  function loadPdfjs() {
    if (pdfjs) return Promise.resolve(pdfjs);
    return import(abs('vendor/pdf.min.mjs')).then(function (m) { m.GlobalWorkerOptions.workerSrc = abs('vendor/pdf.worker.min.mjs'); pdfjs = m; return m; });
  }
  function loadPdfLib() {
    if (window.PDFLib) return Promise.resolve(window.PDFLib);
    return pdfLibP || (pdfLibP = new Promise(function (res, rej) { var s = document.createElement('script'); s.src = 'vendor/pdf-lib.min.js'; s.onload = function () { res(window.PDFLib); }; s.onerror = rej; document.head.appendChild(s); }));
  }

  // ---------- input ----------
  var drop = $('#drop'), input = $('#file');
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { addFiles(e.dataTransfer.files); });
  input.addEventListener('change', function () { addFiles(input.files); input.value = ''; });
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation();
    fetch('exempel-fraktsedel.pdf').then(function (r) { return r.arrayBuffer(); }).then(function (b) { addFiles([new File([b], 'exempel-tradera-dhl.pdf', { type: 'application/pdf' })]); });
  });
  $('#clear').addEventListener('click', function () { files.forEach(function (f) { if (f.doc) f.doc.destroy(); }); files = []; labels = []; skipped = { blank: 0, nobar: 0 }; $('#cards').innerHTML = ''; $('#result').hidden = true; status(''); });

  async function addFiles(list) {
    list = Array.prototype.slice.call(list || []);
    if (!list.length) return;
    var notes = [];
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      status(t('reading')(f.name));
      try {
        var bytes = new Uint8Array(await f.arrayBuffer());
        var isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
        var isImg = /^image\/(png|jpeg)$/.test(f.type) || (bytes[0] === 0x89 && bytes[1] === 0x50) || (bytes[0] === 0xff && bytes[1] === 0xd8);
        if (isPdf) { if (!pdfjs) status(t('loading')); await loadPdfjs(); var n = await addPdf(f.name, bytes); if (n) notes.push(t('truncated')(n)); }
        else if (isImg) await addImage(f.name, f);
        else { notes.push(t('err') + f.name + t('notpdf')); }
      } catch (e) {
        notes.push(t('err') + f.name + (e && e.name === 'PasswordException' ? t('pw') : ': ' + (e && e.message || e)));
      }
    }
    loadPdfLib().catch(function () {});
    renderAll();
    status(notes.join(' '), notes.some(function (n) { return n.indexOf(t('err')) === 0; }));
  }

  function grayOf(ctx, w, h) {
    var d = ctx.getImageData(0, 0, w, h).data, g = new Uint8Array(w * h);
    for (var i = 0, j = 0; j < g.length; i += 4, j++) g[j] = d[i + 3] < 128 ? 255 : (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    return g;
  }

  async function addPdf(name, bytes) {
    var doc = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true, standardFontDataUrl: abs('vendor/standard_fonts/'), verbosity: 0 }).promise;
    var file = { id: 'f' + (seq++), name: name, bytes: bytes, doc: doc, kind: 'pdf', encrypted: null };
    files.push(file);
    var max = Math.min(doc.numPages, CFG.MAX_PAGES_PER_FILE), fileLabels = [];
    for (var p = 1; p <= max; p++) {
      var page = await doc.getPage(p), scale = PPM / D.PT_PER_MM, vp = page.getViewport({ scale: scale });
      var c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      var tc = await page.getTextContent();
      var items = tc.items.filter(function (it) { return it.str && it.str.trim(); }).map(function (it) { return { angle: Math.atan2(it.transform[1], it.transform[0]) * 180 / Math.PI, weight: it.str.length, x: it.transform[4], y: it.transform[5] }; });
      var pg = { gray: grayOf(ctx, c.width, c.height), w: c.width, h: c.height, ppm: PPM, view: page.view, rotate: page.rotate, items: items, text: tc.items.map(function (it) { return it.str; }).join(' ') };
      var plan = D.planPage(pg);
      if (plan.blank) { skipped.blank++; continue; }
      var pageRec = { file: file, index: p - 1, canvas: c, view: page.view, rotate: page.rotate, items: items, info: plan.info, scale: scale };
      plan.labels.forEach(function (l) { fileLabels.push(mkLabel(pageRec, l)); });
    }
    var anyBar = fileLabels.some(function (l) { return l.barcode; });
    fileLabels.forEach(function (l) { if (anyBar && !l.barcode) { l.include = false; skipped.nobar++; } labels.push(l); });
    return doc.numPages > max ? max : 0;
  }

  async function addImage(name, blob) {
    var img = await createImageBitmap(blob), iw = img.width, ih = img.height, asp = Math.max(iw, ih) / Math.min(iw, ih);
    // physical size is unknown: A4 if the aspect matches, otherwise assume the long side is 150 mm (a label photo/scan)
    var longMm = Math.abs(asp - Math.SQRT2) < 0.06 ? 297 : 150, pxPerMmSrc = Math.max(iw, ih) / longMm;
    var w = Math.round(iw / pxPerMmSrc * PPM), h = Math.round(ih / pxPerMmSrc * PPM);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var ctx = c.getContext('2d', { willReadFrequently: true }); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); ctx.drawImage(img, 0, 0, w, h);
    var file = { id: 'f' + (seq++), name: name, kind: 'image', image: img, srcPpm: pxPerMmSrc };
    files.push(file);
    var plan = D.planPage({ gray: grayOf(ctx, w, h), w: w, h: h, ppm: PPM, view: [0, 0, w / PPM * D.PT_PER_MM, h / PPM * D.PT_PER_MM], rotate: 0, items: [], text: name });
    if (plan.blank) { skipped.blank++; return; }
    var pageRec = { file: file, index: 0, canvas: c, view: [0, 0, w / PPM * D.PT_PER_MM, h / PPM * D.PT_PER_MM], rotate: 0, items: [], info: plan.info, scale: PPM / D.PT_PER_MM };
    plan.labels.forEach(function (l) { labels.push(mkLabel(pageRec, l)); });
  }

  function mkLabel(pageRec, l) {
    var box = { x: l.box.x, y: l.box.y, w: l.box.w, h: l.box.h };
    return { id: 'l' + (seq++), page: pageRec, orig: { box: box, method: l.method }, box: Object.assign({}, box), method: l.method, textAngle: l.textAngle,
      rotSel: 'auto', barcode: l.barcode, include: true, el: null };
  }
  function rotOf(l) { return l.rotSel === 'auto' ? D.chooseRotation(l.box.w, l.box.h, l.textAngle) : +l.rotSel; }

  // ---------- rendering ----------
  function renderAll() {
    var cards = $('#cards'); cards.innerHTML = '';
    labels.forEach(function (l) { l.el = card(l); cards.appendChild(l.el); updateLabel(l); });
    $('#result').hidden = !labels.length && !files.length;
    var w = [];
    if (files.length && !labels.length) w.push(t('none'));
    if (skipped.blank) w.push(t('skippedBlank')(skipped.blank));
    if (skipped.nobar) w.push(t('nobar')(skipped.nobar));
    $('#warn').hidden = !w.length; $('#warn').textContent = w.join(' ');
    updateBar();
  }
  function updateBar() {
    var sel = labels.filter(function (l) { return l.include; }).length;
    $('#r-title').textContent = t('title')(labels.length);
    $('#r-meta').textContent = t('meta')(files.length, sel);
    var b = $('#all'); b.textContent = t('all')(sel); b.disabled = !sel;
    b.classList.toggle('locked', sel > 1 && !PW.isUnlocked());
  }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in attrs || {}) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function card(l) {
    var P = l.page, c = el('article', { class: 'lc', 'data-id': l.id });
    var sw = el('div', { class: 'stagewrap' }), st = el('div', { class: 'stage' });
    var disp = document.createElement('canvas'); disp.width = P.canvas.width; disp.height = P.canvas.height; disp.getContext('2d').drawImage(P.canvas, 0, 0);
    st.appendChild(disp);
    var crop = el('div', { class: 'crop', 'aria-label': 'crop' });
    ['nw', 'ne', 'sw', 'se'].forEach(function (k) { crop.appendChild(el('span', { class: 'hd ' + k, 'data-h': k })); });
    st.appendChild(crop); sw.appendChild(st); c.appendChild(sw);
    var pv = el('div', { class: 'pv' }), pc = document.createElement('canvas'); pv.appendChild(pc); c.appendChild(pv);
    var info = P.info, m = el('div', { class: 'meta' });
    m.innerHTML = '<h3>' + esc(P.file.name) + (P.file.kind === 'pdf' ? ' · ' + t('page') + ' ' + (P.index + 1) : '') + '</h3>' +
      '<dl><dt>' + t('carrier') + '</dt><dd>' + esc(info.carrierName || t('unknown')) + '</dd>' +
      (info.platformName ? '<dt>' + t('platform') + '</dt><dd>' + esc(info.platformName) + '</dd>' : '') +
      '<dt>' + t('method') + '</dt><dd class="m-method"></dd><dt>' + t('size') + '</dt><dd class="m-size"></dd><dt>' + t('scale') + '</dt><dd class="m-scale"></dd></dl>' +
      '<div class="ctl"><label>' + t('rot') + ' <select class="rot"><option value="auto">' + t('auto') + '</option><option value="0">0°</option><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>' +
      '<label><input type="checkbox" class="inc"> ' + t('include') + '</label></div>' +
      '<div class="m-warn"></div>' +
      '<div class="ctl"><button class="btn ghost reset" type="button">' + t('reset') + '</button><button class="btn one" type="button">' + t('dl') + '</button></div>';
    c.appendChild(m);
    $('.rot', m).value = String(l.rotSel);
    $('.inc', m).checked = l.include;
    $('.rot', m).addEventListener('change', function (e) { l.rotSel = e.target.value; updateLabel(l); });
    $('.inc', m).addEventListener('change', function (e) { l.include = e.target.checked; updateLabel(l); updateBar(); });
    $('.reset', m).addEventListener('click', function () { l.box = Object.assign({}, l.orig.box); l.method = l.orig.method; l.rotSel = 'auto'; $('.rot', m).value = 'auto'; updateLabel(l); });
    $('.one', m).addEventListener('click', function () { download([l]); });
    dragBox(l, st, crop);
    return c;
  }

  function dragBox(l, st, crop) {
    var start = null;
    crop.addEventListener('pointerdown', function (e) {
      e.preventDefault(); crop.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY, box: Object.assign({}, l.box), h: e.target.dataset.h || 'move', k: l.page.canvas.width / st.getBoundingClientRect().width };
    });
    crop.addEventListener('pointermove', function (e) {
      if (!start) return;
      var W = l.page.canvas.width, H = l.page.canvas.height, dx = (e.clientX - start.x) * start.k, dy = (e.clientY - start.y) * start.k, b = start.box, min = 15 * PPM;
      var x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
      if (start.h === 'move') { dx = Math.max(-x0, Math.min(W - x1, dx)); dy = Math.max(-y0, Math.min(H - y1, dy)); x0 += dx; x1 += dx; y0 += dy; y1 += dy; }
      else {
        if (start.h.indexOf('w') >= 0) x0 = Math.max(0, Math.min(x1 - min, x0 + dx)); else x1 = Math.min(W, Math.max(x0 + min, x1 + dx));
        if (start.h.indexOf('n') >= 0) y0 = Math.max(0, Math.min(y1 - min, y0 + dy)); else y1 = Math.min(H, Math.max(y0 + min, y1 + dy));
      }
      l.box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; l.method = 'manual';
      updateLabel(l);
    });
    var end = function () { start = null; };
    crop.addEventListener('pointerup', end); crop.addEventListener('pointercancel', end);
  }

  function targetFor() { var F = D.FORMATS[settings.format]; return { F: F, m: F.cutMarks ? 0 : settings.margin }; }
  function scaleOf(l) {
    var tf = targetFor(), r = rotOf(l), wmm = l.box.w / PPM, hmm = l.box.h / PPM, sw = r % 180 ? hmm : wmm, sh = r % 180 ? wmm : hmm;
    return Math.min((tf.F.w - 2 * tf.m) / sw, (tf.F.h - 2 * tf.m) / sh);
  }
  function updateLabel(l) {
    if (!l.el) return;
    var P = l.page, W = P.canvas.width, H = P.canvas.height, crop = $('.crop', l.el);
    crop.style.left = (l.box.x / W * 100) + '%'; crop.style.top = (l.box.y / H * 100) + '%';
    crop.style.width = (l.box.w / W * 100) + '%'; crop.style.height = (l.box.h / H * 100) + '%';
    l.el.classList.toggle('off', !l.include);
    var s = scaleOf(l), pct = Math.round(s * 100), r = rotOf(l);
    $('.m-method', l.el).innerHTML = esc(METHOD[lang][l.method] || l.method) + (l.barcode ? '' : ' <span class="tag">' + t('nobarTag') + '</span>') + (P.file.kind === 'image' || P.file.encrypted ? ' <span class="tag">' + t('raster') + '</span>' : '');
    $('.m-size', l.el).textContent = Math.round(l.box.w / PPM) + ' × ' + Math.round(l.box.h / PPM) + ' mm';
    $('.m-scale', l.el).textContent = pct + ' %' + (r ? ' · ' + r + '°' : '');
    var w = $('.m-warn', l.el); w.innerHTML = s < 0.9 ? '<p class="w">' + t('small')(pct) + '</p>' : s > 1.25 ? '<p class="w">' + t('big')(pct) + '</p>' : '';
    preview(l, r, s);
  }
  function preview(l, r, s) {
    var tf = targetFor(), k = 2, pc = $('.pv canvas', l.el), F = tf.F;
    pc.width = F.sheetW * k; pc.height = F.sheetH * k;
    var ctx = pc.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, pc.width, pc.height);
    var tx = (F.sheetW - F.w) / 2 * k, ty = F.cutMarks ? 30 * k : (F.sheetH - F.h) / 2 * k;
    if (F.cutMarks) { ctx.strokeStyle = '#64748b'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]); ctx.strokeRect(tx, ty, F.w * k, F.h * k); ctx.setLineDash([]); }
    var bw = l.box.w / PPM * s * k, bh = l.box.h / PPM * s * k;
    ctx.save(); ctx.translate(tx + F.w * k / 2, ty + F.h * k / 2); ctx.rotate(r * Math.PI / 180);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(l.page.canvas, l.box.x, l.box.y, l.box.w, l.box.h, -bw / 2, -bh / 2, bw, bh);
    ctx.restore();
  }

  // ---------- output ----------
  async function isEncrypted(PDFLib, file) {
    if (file.encrypted != null) return file.encrypted;
    try { await PDFLib.PDFDocument.load(file.bytes, { updateMetadata: false }); file.encrypted = false; }
    catch (e) { file.encrypted = /encrypt/i.test(e && (e.name + e.message)); if (!file.encrypted) throw e; }
    return file.encrypted;
  }
  function canvasPng(c) { return new Promise(function (res) { c.toBlob(function (b) { b.arrayBuffer().then(function (a) { res(new Uint8Array(a)); }); }, 'image/png'); }); }
  async function rasterCrop(l) {
    var P = l.page, f = P.file, k = (f.kind === 'image' ? RASTER_DPI : PDF_RASTER_DPI) / 25.4 / PPM, c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(l.box.w * k)); c.height = Math.max(1, Math.round(l.box.h * k));
    var ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    if (f.kind === 'image') {
      var q = f.srcPpm / PPM; ctx.drawImage(f.image, l.box.x * q, l.box.y * q, l.box.w * q, l.box.h * q, 0, 0, c.width, c.height);
    } else {
      var page = await f.doc.getPage(P.index + 1), vp = page.getViewport({ scale: P.scale * k, offsetX: -l.box.x * k, offsetY: -l.box.y * k });
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
    }
    return { kind: 'raster', png: await canvasPng(c), w: l.box.w / PPM * D.PT_PER_MM, h: l.box.h / PPM * D.PT_PER_MM, rot: rotOf(l), meta: { l: l } };
  }
  async function jobFor(PDFLib, l) {
    var P = l.page;
    if (P.file.kind === 'image' || await isEncrypted(PDFLib, P.file)) return rasterCrop(l);
    var box = D.pxBoxToPdf(l.box, { view: P.view, rotate: P.rotate, scale: P.scale });
    return { kind: 'vector', srcKey: P.file.id, bytes: P.file.bytes, pageIndex: P.index, box: box, rot: ((P.rotate || 0) + rotOf(l)) % 360, meta: { l: l } };
  }
  // privacy hooks for output.js: rasterise a crop that cannot be redacted safely, and read back the text of the result
  var buildHooks = {
    rasterize: function (job) { return rasterCrop(job.meta.l); },
    textItems: async function (bytes) {
      var lib = await loadPdfjs(), doc = await lib.getDocument({ data: bytes.slice(), isEvalSupported: false, disableFontFace: true }).promise, pages = [];
      try {
        for (var i = 1; i <= doc.numPages; i++) {
          var tc = await (await doc.getPage(i)).getTextContent();
          pages.push(tc.items.filter(function (t) { return t.str && t.str.trim(); }).map(function (t) {
            var a = t.transform[0], b = t.transform[1], n = Math.hypot(a, b) || 1;
            return { x: t.transform[4], y: t.transform[5], ex: t.transform[4] + a / n * t.width, ey: t.transform[5] + b / n * t.width };
          }));
        }
      } finally { doc.destroy(); }
      return pages;
    }
  };
  async function download(list) {
    if (!list.length) { status(t('nothing'), true); return; }
    status(t('building'));
    try {
      var PDFLib = await loadPdfLib(), jobs = [];
      for (var i = 0; i < list.length; i++) jobs.push(await jobFor(PDFLib, list[i]));
      var res = await OUT.build(PDFLib, jobs, { format: settings.format, marginMm: settings.margin, title: 'Fraktetiketter',
        caption: lang === 'en' ? 'Cut along the corner marks (100 × 150 mm). Print at 100 % / actual size.' : undefined }, buildHooks);
      var fmt = settings.format === 'a4' ? 'a4' : settings.format;
      var name = list.length === 1 ? 'fraktsedel-' + fmt + '-' + list[0].page.file.name.replace(/\.[^.]+$/, '').replace(/[^\w\-åäöÅÄÖ]+/g, '_').slice(0, 40) + '.pdf' : 'fraktsedlar-' + fmt + '-' + list.length + 'st.pdf';
      var a = document.createElement('a'), url = URL.createObjectURL(new Blob([res.bytes], { type: 'application/pdf' }));
      a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      status(t('done')(list.length));
    } catch (e) { status(t('err') + 'PDF: ' + (e && e.message || e), true); }
  }

  // ---------- batch / paywall ----------
  var dlg = $('#paywall');
  function downloadAll() { download(labels.filter(function (l) { return l.include; })); }
  $('#all').addEventListener('click', function () {
    var n = labels.filter(function (l) { return l.include; }).length;
    if (n > 1 && !PW.isUnlocked()) dlg.showModal(); else downloadAll();
  });

  window.PAYWALL.mount(dlg, PW, { launchAfter: $('#all').parentNode, onUnlocked: function () { updateBar(); downloadAll(); } });
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
