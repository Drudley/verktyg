/* Debiteringslängd för samfällighetsföreningar – UI. All processing happens in the browser; nothing is uploaded.
 * Free: import/paste, verksamhetsgrenar + belopp, allocation by andelstal with exact öresjustering, preview.
 * Paid (behind js/paywall.js): debiteringslängd + avier (print), avprickning/restlista (localStorage), Excel, register to next year.
 * Printed documents and the Excel file are always in Swedish (they are the association's documents). */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, D = window.DEBL, X = window.DEXPORT, lang = 'sv';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var SAMPLE = 'exempel-medlemsregister-syntetiskt.csv';
  var st = { members: null, cols: [], map: {}, warnings: [], file: '', grenar: [], settings: {}, payments: {}, res: null, nextKey: 1 };

  var EN = {
    h1: 'Debiteringslängd and payment notices for a Swedish joint property association (samfällighetsförening)',
    lead: 'Drop in the member list with property, owner and <strong>andelstal</strong> (share numbers – several columns are fine, e.g. running costs and maintenance, or GA:1 and GA:2), enter what is to be charged, and the amount is split per property with <strong>rounding that adds up exactly</strong>. Then you get a debiteringslängd per § 42 of the Swedish Act on joint property management and payment notices with OCR and Swish. <strong>Everything happens in your browser – the register never leaves your computer.</strong>',
    drop: 'Drop the member list (Excel or CSV) here or <u>choose a file</u>', dropsub: 'Columns: property, owner, address and one or more andelstal columns · the header row is found automatically',
    sample: 'Try a synthetic example', 'paste-h': '…or paste from Excel / Google Sheets', 'paste-go': 'Read',
    'f-l': 'Association', 'y-l': 'Year', 'u-l': 'Round to', 'u-ore': 'öre', 'u-kr': 'whole kronor',
    'g-h': 'Cost centres (verksamhetsgrenar) and amounts to charge', 'g-p': 'Each andelstal column becomes a cost centre. Enter the amount to charge – one total or several budget lines from the approved budget. “Equal per property” splits a fee equally.', 'g-add': 'Add cost centre',
    'p-h': 'Preview – amount per property',
    'paid-h': 'Debiteringslängd, notices with OCR and Swish, payment tracking',
    'paid-p': 'A <strong>print-ready debiteringslängd</strong> with what § 42 requires – total charged, amount per property and cost centre, due date and payment method, the meeting decision and presentation. <strong>One payment notice per member</strong> with bankgiro/plusgiro, OCR number and Swish QR. <strong>Payment tracking and arrears list</strong> saved in the browser, an Excel file and the register saved for next year. The documents are in Swedish.',
    open: 'Create debiteringslängd and notices', 'set-h': 'Details for the debiteringslängd and notices',
    's-orgnr': 'Organisation number', 's-due': 'Due date', 's-stamma': 'General meeting (date)', 's-paragraf': 'Section in the minutes', 's-upprattad': 'Prepared by the board (date)',
    's-bankgiro': 'Bankgiro', 's-plusgiro': 'Plusgiro', 's-swish': 'Swish number', 's-kontakt': 'Contact on the notice (treasurer, e-mail/phone)', 's-ocr': 'OCR numbers on the notices', 's-len': 'With length digit (variable length check)',
    's-prefix': 'OCR starts with (e.g. the year)', 's-usenr': 'Use member number in OCR (otherwise row order)',
    'ocr-hint': 'OCR number = start + member number + length digit + check digit (mod 10). Hard OCR checking on a bankgiro requires an agreement with the bank – otherwise it works as a reference. Check with your bank which check your bankgiro uses.',
    'dl-h': 'Debiteringslängd', 'print-dl': 'Print / save as PDF', 'avi-h': 'Payment notices', 'print-avi': 'Print all notices', 'rest-h': 'Payment tracking and arrears list', 'print-rest': 'Print arrears list',
    'rest-p': 'Enter the amount received and the date, or press “Paid”. Tracking is saved in this browser.', 'rest-open': 'Show unpaid only',
    'c-fast': 'Property', 'c-agare': 'Owner', 'c-ref': 'OCR', 'c-att': 'To pay', 'c-paid': 'Paid', 'c-date': 'Date', 'c-left': 'Left', 'c-st': 'Status',
    'dl-xlsx': 'Download Excel file (.xlsx)', 'reg-save': 'Save register in browser', 'reg-export': 'Save register as file (.json)', 'reg-import': 'Load register file', 'reg-next': 'Copy register to next year',
    'rev-h': 'Check before the general meeting',
    'rev-1': 'The tool helps the board <strong>prepare</strong> the debiteringslängd. It must be <strong>presented at the general meeting</strong> (§ 42 of the Act (1973:1150) on joint property management) and be based on the budget the meeting approved (§ 41). The meeting and your statutes decide the charge – the statutes may prescribe another procedure.',
    'rev-2': 'Check the <strong>andelstal against Lantmäteriet’s facility decision</strong> or the association’s register, and that the right andelstal is used for each cost centre. If a property has changed owner, the new owner should be on the notice.',
    'rev-3': 'A member who thinks the charge is wrong can bring an action for correction at the Land and Environment Court <strong>within four weeks</strong> from the meeting where it was presented. Charged and overdue amounts can then be enforced by Kronofogden (§ 46) – so the list must be correct and presented.',
    'rev-4': 'The tool is not legal advice. You are responsible for the debiteringslängd, the amounts and the notices.',
    'pw-h': 'Debiteringslängd, notices and payment tracking', 'pw-p': 'Unlock the print-ready debiteringslängd, notices with OCR and Swish QR, payment tracking and arrears list, the Excel file and saving the register for next year. Reading, allocation and the preview are always free.'
  };
  var T = {
    sv: { reading: 'Läser…', err: 'Kunde inte läsa: ', 'no-header': 'Hittade ingen rubrikrad med fastighet och andelstal.', 'no-shares': 'Hittade ingen kolumn med andelstal. Döp kolumnen till t.ex. ”Andelstal”.', 'no-rows': 'Hittade inga fastigheter under rubrikraden.', empty: 'Filen är tom.', pdf: 'PDF kan inte läsas – spara medlemslistan som Excel eller CSV.',
      'not-register': 'Filen är inte en sparad registerfil från verktyget.',
      loaded: function (n, c, f) { return n + ' fastigheter, ' + c + ' kolumn' + (c === 1 ? '' : 'er') + ' med andelstal' + (f ? ' · ' + f : ''); },
      warn: { 'no-fastighet': function (w) { return 'Rad ' + w.line + ' saknar fastighet och hoppades över.'; }, 'bad-share': function (w) { return 'Rad ' + w.line + ' (' + w.fastighet + '): andelstalet i ' + w.cols.join(', ') + ' kunde inte läsas och räknas som 0.'; }, duplicate: function (w) { return 'Fastigheten ' + w.fastighet + ' finns flera gånger (rad ' + w.line + ') – kontrollera.'; }, 'missing-cols': function (w) { return 'Saknar kolumn för ' + w.cols.join(', ') + '.'; } },
      flag: { 'no-weights': function (f) { return f.gren + ': summan av andelstalen är 0 – beloppet kan inte fördelas.'; }, negative: function (f) { return f.gren + ': negativt belopp (återbetalning?).'; }, 'odd-ore': function (f) { return f.gren + ': beloppet går inte jämnt upp i hela kronor – ' + f.ore + ' öre läggs på en fastighet.'; }, 'sum-mismatch': function (f) { return f.gren + ': summan stämmer inte.'; }, 'zero-member': function (f) { return f.fastighet + ' får 0 kr – kontrollera andelstalen.'; } },
      gren: 'Verksamhetsgren', src: 'Fördelas efter', lika: 'Lika per fastighet', line: 'Post', amount: 'Belopp (kr)', addLine: '+ post', rmGren: 'Ta bort gren', rmLine: 'Ta bort', defLine: 'Att uttaxera',
      exact: function (t) { return 'Summan av alla rader är exakt ' + t + ' kr – öresjusteringen stämmer.'; }, notExact: 'Summan av raderna avviker – kontrollera.', noAmount: 'Skriv in belopp att uttaxera för att se fördelningen.',
      stat: { total: 'Att uttaxera', n: 'Fastigheter', grenar: 'Verksamhetsgrenar', avg: 'Snitt per fastighet' },
      total: 'Summa', perShare: 'kr/andel', perProp: 'fastigheter', share: 'andelstal', sumShares: 'summa andelstal', toPay: 'Att betala', kr: 'kr',
      info: function (r) { return 'Avrundning till ' + (r.unit === 100 ? 'hela kronor' : 'öre') + ' med största rest-metoden: alla får beloppet avrundat nedåt, och fastigheterna med störst rest får ' + (r.unit === 100 ? 'en krona' : 'ett öre') + ' extra tills summan stämmer.'; },
      locked: '🔒 Lås upp', aviMeta: function (n, z) { return n + ' avier' + (z ? ' (' + z + ' fastigheter med 0 kr får ingen avi)' : '') + '. Avierna och debiteringslängden är på svenska.'; },
      payBad: { bankgiro: 'Bankgironumret ser inte rätt ut (kontrollsiffran stämmer inte).', plusgiro: 'Plusgironumret ser inte rätt ut (kontrollsiffran stämmer inte).', swish: 'Swishnumret ska vara 123 xxx xx xx (eller ett mobilnummer) – ingen QR-kod ritas.', none: 'Ange bankgiro, plusgiro eller Swish så att medlemmarna vet hur de ska betala.', due: 'Ange förfallodag – den ska stå i debiteringslängden (42 §).', dupOcr: 'Två fastigheter får samma OCR-nummer – kontrollera medlemsnumren.' },
      st: { paid: 'Betald', part: 'Delvis', open: 'Obetald', overdue: 'Förfallen', over: 'Överbetald' }, payFull: 'Betald',
      restSum: function (r) { return [['Inbetalt', D.kr(r.paid) + ' kr'], ['Kvar att få in', D.kr(r.left) + ' kr'], ['Obetalda', r.nOpen + ' av ' + r.rows.length]]; },
      saved: 'Registret och avprickningen är sparade i webbläsaren.', xlsxOk: 'Excel-filen är nedladdad.', regLoaded: function (f, y) { return 'Registret ' + f + ' ' + y + ' är inläst.'; },
      nextOk: function (y) { return 'Registret är kopierat till ' + y + ': samma fastigheter, andelstal och belopp, datum ett år fram, avprickningen nollställd. Ändra beloppen efter årets budget.'; },
      loadSaved: function (f, y) { return 'Fortsätt med sparat register: ' + f + ' ' + y; }, regFile: function (y) { return 'debiteringslangd-register-' + y + '.json'; }, xlsxFile: function (y) { return 'debiteringslangd-' + y + '.xlsx'; } },
    en: { reading: 'Reading…', err: 'Could not read: ', 'no-header': 'Found no header row with property and andelstal.', 'no-shares': 'Found no andelstal column. Name the column e.g. “Andelstal”.', 'no-rows': 'Found no properties below the header row.', empty: 'The file is empty.', pdf: 'PDF cannot be read – save the member list as Excel or CSV.',
      'not-register': 'The file is not a register file saved by this tool.',
      loaded: function (n, c, f) { return n + ' properties, ' + c + ' andelstal column' + (c === 1 ? '' : 's') + (f ? ' · ' + f : ''); },
      warn: { 'no-fastighet': function (w) { return 'Row ' + w.line + ' has no property and was skipped.'; }, 'bad-share': function (w) { return 'Row ' + w.line + ' (' + w.fastighet + '): the andelstal in ' + w.cols.join(', ') + ' could not be read and counts as 0.'; }, duplicate: function (w) { return 'Property ' + w.fastighet + ' appears more than once (row ' + w.line + ') – check.'; }, 'missing-cols': function (w) { return 'Missing column for ' + w.cols.join(', ') + '.'; } },
      flag: { 'no-weights': function (f) { return f.gren + ': the andelstal sum is 0 – the amount cannot be split.'; }, negative: function (f) { return f.gren + ': negative amount (refund?).'; }, 'odd-ore': function (f) { return f.gren + ': the amount is not whole kronor – ' + f.ore + ' öre go to one property.'; }, 'sum-mismatch': function (f) { return f.gren + ': the sum does not match.'; }, 'zero-member': function (f) { return f.fastighet + ' gets 0 kr – check the andelstal.'; } },
      gren: 'Cost centre', src: 'Split by', lika: 'Equal per property', line: 'Line', amount: 'Amount (SEK)', addLine: '+ line', rmGren: 'Remove', rmLine: 'Remove', defLine: 'Att uttaxera',
      exact: function (t) { return 'The rows add up to exactly SEK ' + t + ' – rounding checks out.'; }, notExact: 'The rows do not add up – check.', noAmount: 'Enter amounts to charge to see the split.',
      stat: { total: 'To charge', n: 'Properties', grenar: 'Cost centres', avg: 'Average per property' },
      total: 'Total', perShare: 'SEK/share', perProp: 'properties', share: 'andelstal', sumShares: 'sum of andelstal', toPay: 'To pay', kr: 'SEK',
      info: function (r) { return 'Rounding to ' + (r.unit === 100 ? 'whole kronor' : 'öre') + ' with the largest remainder method: everyone gets the amount rounded down, and the properties with the largest remainder get ' + (r.unit === 100 ? 'one krona' : 'one öre') + ' extra until the total matches.'; },
      locked: '🔒 Unlock', aviMeta: function (n, z) { return n + ' notices' + (z ? ' (' + z + ' properties with 0 kr get none)' : '') + '. The notices and the debiteringslängd are in Swedish.'; },
      payBad: { bankgiro: 'The bankgiro number looks wrong (check digit).', plusgiro: 'The plusgiro number looks wrong (check digit).', swish: 'The Swish number should be 123 xxx xx xx (or a mobile number) – no QR code is drawn.', none: 'Enter bankgiro, plusgiro or Swish so members know how to pay.', due: 'Enter a due date – it must be in the debiteringslängd (§ 42).', dupOcr: 'Two properties get the same OCR number – check the member numbers.' },
      st: { paid: 'Paid', part: 'Partly', open: 'Unpaid', overdue: 'Overdue', over: 'Overpaid' }, payFull: 'Paid',
      restSum: function (r) { return [['Received', 'SEK ' + D.kr(r.paid)], ['Outstanding', 'SEK ' + D.kr(r.left)], ['Unpaid', r.nOpen + ' of ' + r.rows.length]]; },
      saved: 'Register and payment tracking saved in the browser.', xlsxOk: 'Excel file downloaded.', regLoaded: function (f, y) { return 'Register ' + f + ' ' + y + ' loaded.'; },
      nextOk: function (y) { return 'Register copied to ' + y + ': same properties, andelstal and amounts, dates one year later, payments cleared. Adjust the amounts to this year’s budget.'; },
      loadSaved: function (f, y) { return 'Continue with saved register: ' + f + ' ' + y; }, regFile: function (y) { return 'debiteringslangd-register-' + y + '.json'; }, xlsxFile: function (y) { return 'debiteringslangd-' + y + '.xlsx'; } }
  };
  function t(k) { return T[lang][k]; }
  var today = function () { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function svDate(d) { if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return ''; var m = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december']; return (+d.slice(8)) + ' ' + m[+d.slice(5, 7) - 1] + ' ' + d.slice(0, 4); }

  // ---------- i18n ----------
  var SV = {};
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var Dd = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (Dd[el.dataset.i18n]) el.innerHTML = Dd[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    savedRow();
    if (st.members) render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- input ----------
  var drop = $('#drop'), input = $('#file');
  function status(m, err) { var s = $('#status'); s.textContent = m || ''; s.className = 'status' + (err ? ' err' : ''); }
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) readFile(e.dataTransfer.files[0]); });
  input.addEventListener('change', function () { if (input.files.length) readFile(input.files[0]); input.value = ''; });
  function readBuf(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok(r.result); }; r.onerror = function () { no(new Error(f.name)); }; r.readAsArrayBuffer(f); }); }
  function errText(er) { var m = t(er.message); return typeof m === 'string' ? m : t('err') + er.message; }
  function readFile(f) { status(t('reading')); readBuf(f).then(function (b) { return D.parseFile(new Uint8Array(b), f.name); }).then(function (p) { loaded(p, f.name, null); }, function (er) { status(errText(er), true); }); }
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch(SAMPLE).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(function (b) { return D.parseFile(new Uint8Array(b), SAMPLE); }).then(function (p) { loaded(p, SAMPLE, 'sample'); }, function (er) { status(errText(er), true); });
  });
  $('#paste-go').addEventListener('click', function () {
    var v = $('#paste').value; if (!v.trim()) return;
    try { loaded(D.parseText(v), '', null); } catch (er) { status(errText(er), true); }
  });

  function colLabel(c) { return String(c).replace(/^\s*andelstal\s*(för\s*)?[:\-–]?\s*/i, '').trim() || c; }
  function newGren(label, source, lines) { return { key: 'g' + (st.nextKey++), label: label, source: source, lines: lines || [{ text: T.sv.defLine, amount: 0 }] }; }
  function defaultSettings() { var y = String(new Date().getFullYear()); return { forening: '', year: y, unit: 1, orgnr: '', due: '', stamma: '', paragraf: '', upprattad: '', bankgiro: '', plusgiro: '', swish: '', kontakt: '', ocrOn: true, lengthDigit: true, prefix: y.slice(2), useNr: true }; }
  function loaded(p, file, kind) {
    st.members = p.members; st.cols = p.cols; st.map = p.map; st.warnings = p.warnings; st.file = file; st.payments = {};
    st.settings = defaultSettings(); st.grenar = p.cols.map(function (c) { return newGren(colLabel(c), c); });
    if (kind === 'sample') sampleSetup();
    status(t('loaded')(p.members.length, p.cols.length, file));
    $('#result').hidden = false; fillSettings(); render();
  }
  /* SYNTHETIC example association (fictional) */
  function sampleSetup() {
    var s = st.settings, y = s.year;
    s.forening = 'Ekbackens samfällighetsförening (SYNTETISKT EXEMPEL)'; s.orgnr = '717900-0000'; s.due = y + '-04-30'; s.stamma = y + '-03-21'; s.paragraf = '9'; s.upprattad = y + '-02-20';
    s.bankgiro = '5050-1055'; s.swish = '123 118 11 89'; s.kontakt = 'Kassören, kassor@ekbacken.exempel';
    var L = [[['Snöröjning och sandning', 2850000], ['Gatubelysning, el', 900000], ['Försäkring och administration', 1100000]], [['Avsättning till underhållsfond', 3000000]], [['Gräsklippning och skötsel', 1234567]]];
    st.grenar.forEach(function (g, i) { if (L[i]) g.lines = L[i].map(function (l) { return { text: l[0], amount: l[1] }; }); });
    st.grenar.push(newGren('Medlemsavgift', '=lika', [{ text: 'Medlemsavgift (lika per fastighet)', amount: 480000 }]));
  }

  // ---------- settings ----------
  var SETS = ['forening', 'year', 'orgnr', 'due', 'stamma', 'paragraf', 'upprattad', 'bankgiro', 'plusgiro', 'swish', 'kontakt', 'prefix'];
  function fillSettings() {
    var s = st.settings;
    SETS.forEach(function (k) { $('#s-' + k).value = s[k] || ''; });
    $('#s-unit').value = String(s.unit === 100 ? 100 : 1); $('#s-ocr').checked = s.ocrOn !== false; $('#s-len').checked = s.lengthDigit !== false; $('#s-usenr').checked = s.useNr !== false;
  }
  SETS.forEach(function (k) {
    $('#s-' + k).addEventListener('input', function () {
      var old = st.settings.year; st.settings[k] = $('#s-' + k).value.trim();
      if (k === 'year' && /^\d{4}$/.test(st.settings.year) && st.settings.prefix === String(old).slice(2)) { st.settings.prefix = st.settings.year.slice(2); $('#s-prefix').value = st.settings.prefix; }
      render(k === 'forening' || k === 'year' ? null : 'paid');
    });
  });
  $('#s-unit').addEventListener('change', function () { st.settings.unit = +$('#s-unit').value; render(); });
  [['ocr', 'ocrOn'], ['len', 'lengthDigit'], ['usenr', 'useNr']].forEach(function (p) { $('#s-' + p[0]).addEventListener('change', function () { st.settings[p[1]] = $('#s-' + p[0]).checked; render('paid'); }); });

  // ---------- grenar editor ----------
  function renderGrenar() {
    var Tl = T[lang];
    $('#grenar').innerHTML = st.grenar.map(function (g, gi) {
      var opts = st.cols.map(function (c) { return '<option value="' + esc(c) + '"' + (g.source === c ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value="=lika"' + (g.source === '=lika' ? ' selected' : '') + '>' + esc(Tl.lika) + '</option>';
      var lines = g.lines.map(function (l, li) {
        return '<div class="gline"><input type="text" class="l-text" data-g="' + gi + '" data-l="' + li + '" value="' + esc(l.text) + '" aria-label="' + esc(Tl.line) + '">' +
          '<input type="text" inputmode="decimal" class="l-amt num" data-g="' + gi + '" data-l="' + li + '" value="' + (l.amount ? esc(D.kr(l.amount)) : '') + '" placeholder="0,00" aria-label="' + esc(Tl.amount) + '">' +
          (g.lines.length > 1 ? '<button type="button" class="link small l-rm" data-g="' + gi + '" data-l="' + li + '" aria-label="' + esc(Tl.rmLine) + '">×</button>' : '<span class="l-sp"></span>') + '</div>';
      }).join('');
      return '<div class="gren card" data-g="' + gi + '"><div class="ghead"><label><span class="small muted">' + esc(Tl.gren) + '</span><input type="text" class="g-label" data-g="' + gi + '" value="' + esc(g.label) + '"></label>' +
        '<label><span class="small muted">' + esc(Tl.src) + '</span><select class="g-src" data-g="' + gi + '">' + opts + '</select></label>' +
        '<button type="button" class="link small g-rm" data-g="' + gi + '">' + esc(Tl.rmGren) + '</button></div>' + lines +
        '<div class="gfoot"><button type="button" class="link small l-add" data-g="' + gi + '">' + esc(Tl.addLine) + '</button><span class="g-sum num" id="gsum-' + gi + '"></span></div></div>';
    }).join('');
  }
  var G = $('#grenar');
  G.addEventListener('input', function (e) {
    var el = e.target, g = st.grenar[+el.dataset.g]; if (!g) return;
    if (el.classList.contains('g-label')) g.label = el.value;
    else if (el.classList.contains('l-text')) g.lines[+el.dataset.l].text = el.value;
    else if (el.classList.contains('l-amt')) { var o = D.parseKr(el.value); el.classList.toggle('bad', isNaN(o)); g.lines[+el.dataset.l].amount = isNaN(o) ? 0 : o; }
    else return;
    render('nogren');
  });
  G.addEventListener('change', function (e) {
    var el = e.target; if (el.classList.contains('g-src')) { st.grenar[+el.dataset.g].source = el.value; render(); }
    else if (el.classList.contains('l-amt') && !el.classList.contains('bad')) { var o = D.parseKr(el.value); el.value = o ? D.kr(o) : ''; }
  });
  G.addEventListener('click', function (e) {
    var el = e.target, gi = +el.dataset.g, g = st.grenar[gi]; if (!g) return;
    if (el.classList.contains('l-add')) g.lines.push({ text: '', amount: 0 });
    else if (el.classList.contains('l-rm')) g.lines.splice(+el.dataset.l, 1);
    else if (el.classList.contains('g-rm')) st.grenar.splice(gi, 1);
    else return;
    render();
  });
  $('#gren-add').addEventListener('click', function () { st.grenar.push(newGren(T[lang].lika, '=lika')); render(); });

  // ---------- compute + render ----------
  function compute() { st.res = D.compute(st.members, st.grenar.map(function (g) { return { key: g.key, label: g.label || '–', source: g.source, lines: g.lines }; }), { unit: st.settings.unit }); }
  function refs() {
    var s = st.settings, out = {}; if (s.ocrOn === false || !st.res) return out;
    var pad = Math.max(3, st.members.reduce(function (m, x) { return Math.max(m, (s.useNr !== false && x.nr ? D.digits(x.nr) : String(st.members.length)).length); }, 0));
    st.members.forEach(function (m, i) { try { out[m.id] = D.ocr(D.ocrBase({ nr: D.digits(m.nr) }, i, { prefix: s.prefix, pad: pad, useNr: s.useNr }), { lengthDigit: s.lengthDigit !== false }); } catch (e) { out[m.id] = ''; } });
    return out;
  }
  function render(part) {
    if (!st.members) return;
    compute(); var r = st.res, Tl = T[lang], s = st.settings;
    $('#r-title').textContent = s.forening || (lang === 'en' ? 'Member list' : 'Medlemslista');
    $('#r-meta').textContent = Tl.loaded(st.members.length, st.cols.length, st.file);
    if (part !== 'nogren' && part !== 'paid') renderGrenar();
    r.grenar.forEach(function (g, i) { var e = $('#gsum-' + i); if (e) e.textContent = Tl.total + ' ' + D.kr(g.total) + ' ' + Tl.kr + (!g.sumW ? '' : g.source === '=lika' ? ' · ' + g.n + ' ' + Tl.perProp : ' · ' + Tl.sumShares + ' ' + D.shareToString(g.sumW) + ' · ' + D.kr(Math.round(g.perShare)) + ' ' + Tl.perShare); });
    var ck = $('#check');
    if (!r.total) { ck.className = 'check muted'; ck.textContent = Tl.noAmount; }
    else { ck.className = 'check ' + (r.exact ? 'ok' : 'err'); ck.textContent = r.exact ? '✓ ' + Tl.exact(D.kr(r.total)) : Tl.notExact; }
    var n = st.members.length;
    $('#stats').innerHTML = [[Tl.stat.total, D.kr(r.total) + ' ' + Tl.kr], [Tl.stat.n, n], [Tl.stat.grenar, r.grenar.length], [Tl.stat.avg, n ? D.kr(Math.round(r.total / n)) + ' ' + Tl.kr : '–']].map(function (x) { return '<div class="stat"><span>' + esc(x[0]) + '</span><strong>' + esc(x[1]) + '</strong></div>'; }).join('');
    var fl = st.warnings.map(function (w) { var f = Tl.warn[w.code]; return f ? f(w) : w.code; }).concat(r.flags.map(function (f) { var g = Tl.flag[f.code]; return g ? g(f) : f.code; }));
    var zs = fl.filter(function (x, i) { return fl.indexOf(x) === i; });
    $('#flags').hidden = !zs.length; $('#flags').innerHTML = zs.slice(0, 12).map(function (x) { return '<p>⚠ ' + esc(x) + '</p>'; }).join('') + (zs.length > 12 ? '<p>… +' + (zs.length - 12) + '</p>' : '');
    $('#info').hidden = !r.total; $('#info').textContent = Tl.info(r);
    renderPreview();
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (!$('#paid-out').hidden) renderPaid();
  }
  function renderPreview() {
    var r = st.res, Tl = T[lang], gs = r.grenar;
    $('#prev-t thead').innerHTML = '<tr><th>' + esc(lang === 'en' ? 'Property' : 'Fastighet') + '</th><th>' + esc(lang === 'en' ? 'Owner' : 'Ägare') + '</th>' + gs.map(function (g) { return '<th class="num">' + esc(g.label) + '<br><span class="muted small">' + esc(g.source === '=lika' ? Tl.lika : Tl.share) + '</span></th>'; }).join('') + '<th class="num">' + esc(Tl.toPay) + '</th></tr>';
    $('#prev-t tbody').innerHTML = r.rows.map(function (x) {
      return '<tr><td>' + esc(x.member.fastighet) + '</td><td>' + esc(x.member.agare) + '</td>' + gs.map(function (g) { return '<td class="num">' + esc(D.kr(x.parts[g.key])) + (g.source === '=lika' ? '' : '<br><span class="muted small">' + esc(D.shareToString(x.shares[g.key])) + '</span>') + '</td>'; }).join('') + '<td class="num"><strong>' + esc(D.kr(x.total)) + '</strong></td></tr>';
    }).join('');
    $('#prev-t tfoot').innerHTML = '<tr><td>' + esc(Tl.total) + '</td><td></td>' + gs.map(function (g) { return '<td class="num">' + esc(D.kr(g.sum)) + '</td>'; }).join('') + '<td class="num"><strong>' + esc(D.kr(r.sumRows)) + '</strong></td></tr>';
  }

  // ---------- paid: documents ----------
  function payLines(s) {
    var p = [];
    if (s.bankgiro) p.push('Bankgiro ' + (D.validBankgiro(s.bankgiro) ? D.fmtBankgiro(s.bankgiro) : s.bankgiro));
    if (s.plusgiro) p.push('Plusgiro ' + (D.validPlusgiro(s.plusgiro) ? D.fmtPlusgiro(s.plusgiro) : s.plusgiro));
    if (s.swish) p.push('Swish ' + s.swish);
    return p;
  }
  var blank = function (v, w) { return v ? esc(v) : '<span class="blank">' + '\u00a0'.repeat(w || 14) + '</span>'; };
  function docDl(R) {
    var r = st.res, s = st.settings, gs = r.grenar, pl = payLines(s);
    var h = '<div class="doc doc-dl"><h1>Debiteringslängd ' + esc(s.year) + '</h1><p class="doc-sub">' + esc(s.forening || 'Samfällighetsföreningen') + (s.orgnr ? ' · org.nr ' + esc(s.orgnr) : '') + '</p>';
    h += '<table class="kv"><tbody>' +
      '<tr><th>Uttaxerat belopp</th><td><strong>' + esc(D.kr(r.total)) + ' kr</strong></td></tr>' +
      '<tr><th>Förfallodag</th><td>' + blank(svDate(s.due)) + '</td></tr>' +
      '<tr><th>Betalningssätt</th><td>' + (pl.length ? esc(pl.join(' · ')) : blank('', 30)) + (s.ocrOn !== false ? ' – ange OCR-numret enligt längden/avin' : '') + '</td></tr>' +
      '<tr><th>Grund</th><td>Utgifts- och inkomststat godkänd och uttaxering beslutad på föreningsstämma ' + blank(svDate(s.stamma)) + (s.paragraf ? ', § ' + esc(String(s.paragraf).replace(/^§\s*/, '')) : ', § ' + blank('', 4)) + '</td></tr>' +
      '</tbody></table>';
    h += '<h2>Verksamhetsgrenar</h2><table class="t"><thead><tr><th>Verksamhetsgren</th><th>Fördelning</th><th class="num">Summa andelstal</th><th class="num">Kr per andel</th><th class="num">Uttaxeras</th></tr></thead><tbody>' +
      gs.map(function (g) { return '<tr><td>' + esc(g.label) + (g.lines.length > 1 || (g.lines[0] && g.lines[0].text && g.lines[0].text !== T.sv.defLine) ? '<br><span class="small">' + esc(g.lines.filter(function (l) { return l.amount; }).map(function (l) { return (l.text || 'Post') + ' ' + D.kr(l.amount) + ' kr'; }).join(' · ')) + '</span>' : '') + '</td><td>' + (g.source === '=lika' ? 'Lika per fastighet' : /^\s*andelstal/i.test(g.source) ? esc(g.source) : 'Andelstal (' + esc(g.source) + ')') + '</td><td class="num">' + esc(g.source === '=lika' ? String(g.n) + ' fast.' : D.shareToString(g.sumW)) + '</td><td class="num">' + esc(g.sumW ? D.kr(Math.round(g.perShare)) : '–') + '</td><td class="num">' + esc(D.kr(g.total)) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="4">Summa uttaxerat</td><td class="num">' + esc(D.kr(r.total)) + '</td></tr></tfoot></table>';
    h += '<h2>Belopp per fastighet</h2><table class="t per"><thead><tr><th>Fastighet</th><th>Ägare</th>' + gs.map(function (g) { return '<th class="num">' + esc(g.label) + (g.source === '=lika' ? '' : '<br><span class="small">andelstal · kr</span>') + '</th>'; }).join('') + '<th class="num">Att betala</th>' + (s.ocrOn !== false ? '<th>OCR</th>' : '') + '</tr></thead><tbody>' +
      r.rows.map(function (x) { return '<tr><td>' + esc(x.member.fastighet) + '</td><td>' + esc(x.member.agare) + '</td>' + gs.map(function (g) { return '<td class="num">' + (g.source === '=lika' ? '' : esc(D.shareToString(x.shares[g.key])) + ' · ') + esc(D.kr(x.parts[g.key])) + '</td>'; }).join('') + '<td class="num"><strong>' + esc(D.kr(x.total)) + '</strong></td>' + (s.ocrOn !== false ? '<td class="mono">' + esc(R[x.member.id] || '') + '</td>' : '') + '</tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="2">Summa (' + r.rows.length + ' fastigheter)</td>' + gs.map(function (g) { return '<td class="num">' + (g.source === '=lika' ? '' : esc(D.shareToString(g.sumW)) + ' · ') + esc(D.kr(g.sum)) + '</td>'; }).join('') + '<td class="num"><strong>' + esc(D.kr(r.sumRows)) + '</strong></td>' + (s.ocrOn !== false ? '<td></td>' : '') + '</tr></tfoot></table>';
    h += '<p class="legal">Debiteringslängden har upprättats av styrelsen ' + blank(svDate(s.upprattad)) + ' och framlagts på föreningsstämma den ' + blank(svDate(s.stamma)) + ' enligt 42 § lagen (1973:1150) om förvaltning av samfälligheter' + (gs.length > 1 ? '. Varje verksamhetsgren redovisas för sig' : '') + '. Beloppen har fördelats efter andelstal' + (gs.some(function (g) { return g.source === '=lika'; }) ? ' respektive lika per fastighet' : '') + ' och avrundats till ' + (r.unit === 100 ? 'hela kronor' : 'öre') + ' så att summan stämmer exakt.</p>';
    h += '<p class="legal">Medlem som anser att uttaxeringen inte överensstämmer med lag, stadgar eller stämmobeslut kan väcka talan om rättelse vid mark- och miljödomstolen inom fyra veckor från den dag då debiteringslängden framlades på stämman (46 § första stycket). Debiterat och förfallet belopp får tas ut enligt utsökningsbalken (46 § andra stycket).</p>';
    h += '<div class="sign"><div><span class="line"></span>Ort och datum</div><div><span class="line"></span>För styrelsen</div></div></div>';
    return h;
  }
  function qrSvg(payload) { try { return window.QR.svg(payload, { quiet: 4 }); } catch (e) { return ''; } }
  function docAvi(R) {
    var r = st.res, s = st.settings, gs = r.grenar, swishOk = s.swish && D.validSwish(s.swish), out = [], zero = 0;
    r.rows.forEach(function (x) {
      if (x.total <= 0) { zero++; return; }
      var m = x.member, ref = s.ocrOn !== false ? R[m.id] : '', msgTxt = ref || m.fastighet, qr = '';
      if (swishOk) { try { qr = qrSvg(D.swishPayload({ payee: s.swish, amount: x.total, message: msgTxt, mask: 0 })); } catch (e) { qr = ''; } }
      var spec = gs.filter(function (g) { return x.parts[g.key]; }).map(function (g) { return '<tr><td>' + esc(g.label) + (g.source === '=lika' ? '' : ' <span class="small">(andelstal ' + esc(D.shareToString(x.shares[g.key])) + ' av ' + esc(D.shareToString(g.sumW)) + ')</span>') + '</td><td class="num">' + esc(D.kr(x.parts[g.key])) + ' kr</td></tr>'; }).join('');
      var pay = [];
      if (s.bankgiro) pay.push('<div><span>Bankgiro</span><strong>' + esc(D.validBankgiro(s.bankgiro) ? D.fmtBankgiro(s.bankgiro) : s.bankgiro) + '</strong></div>');
      if (s.plusgiro) pay.push('<div><span>Plusgiro</span><strong>' + esc(D.validPlusgiro(s.plusgiro) ? D.fmtPlusgiro(s.plusgiro) : s.plusgiro) + '</strong></div>');
      if (ref) pay.push('<div><span>OCR-nummer</span><strong class="mono">' + esc(ref) + '</strong></div>');
      out.push('<article class="avi" data-id="' + esc(m.id) + '"><header class="avi-h"><div><strong>' + esc(s.forening || 'Samfällighetsföreningen') + '</strong>' + (s.orgnr ? '<br><span class="small">Org.nr ' + esc(s.orgnr) + '</span>' : '') + '</div><div class="avi-t">Avi – uttaxering ' + esc(s.year) + '</div></header>' +
        '<div class="avi-addr">' + esc(m.agare) + '<br>' + esc(m.adress) + (m.postadress ? '<br>' + esc(m.postadress) : '') + '</div>' +
        '<p>Fastighet: <strong>' + esc(m.fastighet) + '</strong></p>' +
        '<table class="t spec"><tbody>' + spec + '</tbody><tfoot><tr><td>Att betala</td><td class="num">' + esc(D.kr(x.total)) + ' kr</td></tr></tfoot></table>' +
        '<div class="avi-pay"><div class="avi-fields"><div><span>Att betala</span><strong>' + esc(D.kr(x.total)) + ' kr</strong></div><div><span>Senast</span><strong>' + (s.due ? esc(svDate(s.due)) : blank('', 12)) + '</strong></div>' + pay.join('') + '</div>' +
        (qr ? '<div class="avi-qr">' + qr + '<span class="small">Swish ' + esc(s.swish) + '<br>Skanna i Swish-appen</span></div>' : '') + '</div>' +
        '<p class="small">Uttaxeringen bygger på debiteringslängden som framlagts på föreningsstämma' + (s.stamma ? ' den ' + esc(svDate(s.stamma)) : '') + ' (42 § lagen om förvaltning av samfälligheter). ' + (ref ? 'Ange OCR-numret vid betalning. ' : 'Ange fastighetsbeteckningen vid betalning. ') + 'Detta är en avi från föreningen, inte ett inbetalningskort från Bankgirot.' + (s.kontakt ? ' Frågor: ' + esc(s.kontakt) + '.' : '') + '</p></article>');
    });
    return { html: out.join(''), n: out.length, zero: zero };
  }
  function docRest(rl, R) {
    var s = st.settings, open = rl.rows.filter(function (x) { return x.left > 0; });
    return '<div class="doc doc-dl"><h1>Restlista ' + esc(s.year) + '</h1><p class="doc-sub">' + esc(s.forening || '') + ' · per ' + esc(svDate(today())) + (s.due ? ' · förfallodag ' + esc(svDate(s.due)) : '') + '</p>' +
      '<table class="t"><thead><tr><th>Fastighet</th><th>Ägare</th><th>Adress</th><th>OCR</th><th class="num">Att betala</th><th class="num">Betalt</th><th class="num">Kvar</th></tr></thead><tbody>' +
      open.map(function (x) { return '<tr><td>' + esc(x.member.fastighet) + '</td><td>' + esc(x.member.agare) + '</td><td>' + esc([x.member.adress, x.member.postadress].filter(Boolean).join(', ')) + '</td><td class="mono">' + esc(R[x.member.id] || '') + '</td><td class="num">' + esc(D.kr(x.total)) + '</td><td class="num">' + esc(D.kr(x.paid)) + '</td><td class="num"><strong>' + esc(D.kr(x.left)) + '</strong></td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="6">Summa kvar (' + open.length + ' fastigheter)</td><td class="num"><strong>' + esc(D.kr(rl.left)) + '</strong></td></tr></tfoot></table></div>';
  }
  function payMsgs(R) {
    var s = st.settings, b = T[lang].payBad, m = [];
    if (!s.due) m.push(b.due);
    if (s.bankgiro && !D.validBankgiro(s.bankgiro)) m.push(b.bankgiro);
    if (s.plusgiro && !D.validPlusgiro(s.plusgiro)) m.push(b.plusgiro);
    if (s.swish && !D.validSwish(s.swish)) m.push(b.swish);
    if (!s.bankgiro && !s.plusgiro && !s.swish) m.push(b.none);
    var v = Object.keys(R).map(function (k) { return R[k]; }).filter(Boolean); if (v.some(function (x, i) { return v.indexOf(x) !== i; })) m.push(b.dupOcr);
    return m;
  }
  var cache = {};
  function renderPaid() {
    if (!PW.isUnlocked() || !st.res) return;
    var R = refs(), Tl = T[lang], m = payMsgs(R);
    cache.R = R;
    $('#pay-msg').hidden = !m.length; $('#pay-msg').innerHTML = m.map(function (x) { return '<p>⚠ ' + esc(x) + '</p>'; }).join('');
    $('#doc-dl').innerHTML = docDl(R);
    var a = docAvi(R); $('#doc-avi').innerHTML = a.html; $('#avi-meta').textContent = Tl.aviMeta(a.n, a.zero);
    renderRest();
  }
  function restData() { return D.restlista(st.res, st.payments, st.settings.due, today()); }
  function renderRest() {
    var rl = restData(), Tl = T[lang], R = cache.R || {}, only = $('#rest-open').checked;
    $('#rest-sum').innerHTML = Tl.restSum(rl).map(function (x) { return '<div class="stat"><span>' + esc(x[0]) + '</span><strong>' + esc(x[1]) + '</strong></div>'; }).join('');
    $('#rest-t tbody').innerHTML = rl.rows.filter(function (x) { return !only || x.left > 0; }).map(function (x) {
      var id = esc(x.member.id);
      return '<tr class="st-' + x.status + '"><td>' + esc(x.member.fastighet) + '</td><td>' + esc(x.member.agare) + '</td><td class="mono">' + esc(R[x.member.id] || '') + '</td><td class="num">' + esc(D.kr(x.total)) + '</td>' +
        '<td class="num"><input type="text" inputmode="decimal" class="p-amt num" data-id="' + id + '" value="' + (x.paid ? esc(D.kr(x.paid)) : '') + '" aria-label="' + esc(Tl.st.paid) + '"></td>' +
        '<td><input type="date" class="p-date" data-id="' + id + '" value="' + esc(x.date) + '"></td><td class="num">' + esc(D.kr(x.left)) + '</td>' +
        '<td><span class="tag ' + x.status + '">' + esc(Tl.st[x.status]) + '</span>' + (x.left > 0 ? ' <button type="button" class="link small p-full" data-id="' + id + '">' + esc(Tl.payFull) + '</button>' : '') + '</td></tr>';
    }).join('');
  }
  function totalOf(id) { var r = st.res.rows.filter(function (x) { return x.member.id === id; })[0]; return r ? r.total : 0; }
  function autosave() { if (!PW.isUnlocked()) return; try { localStorage.setItem(CFG.REGISTER_KEY, D.registerToJson(register())); } catch (e) {} }
  $('#rest-t').addEventListener('change', function (e) {
    var el = e.target, id = el.dataset.id; if (!id) return; var p = st.payments[id] || (st.payments[id] = { paid: 0, date: '' });
    if (el.classList.contains('p-amt')) { var o = D.parseKr(el.value); if (isNaN(o)) { el.classList.add('bad'); return; } p.paid = o; if (o && !p.date) p.date = today(); }
    else if (el.classList.contains('p-date')) p.date = el.value;
    autosave(); renderRest();
  });
  $('#rest-t').addEventListener('click', function (e) {
    var el = e.target; if (!el.classList.contains('p-full')) return; var id = el.dataset.id;
    st.payments[id] = { paid: totalOf(id), date: (st.payments[id] && st.payments[id].date) || today() }; autosave(); renderRest();
  });
  $('#rest-open').addEventListener('change', renderRest);

  function openPaid() { $('#paid-out').hidden = false; render('paid'); savedRow(); }
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: openPaid });

  // ---------- print ----------
  function printDoc(html) {
    if (!PW.isUnlocked() || !st.res) return;
    $('#print-root').innerHTML = html; document.body.classList.add('printing'); window.print();
    setTimeout(function () { document.body.classList.remove('printing'); }, 500);
  }
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing'); });
  $('#print-dl').addEventListener('click', function () { printDoc(docDl(refs())); });
  $('#print-avi').addEventListener('click', function () { printDoc(docAvi(refs()).html); });
  $('#print-rest').addEventListener('click', function () { printDoc(docRest(restData(), refs())); });

  // ---------- downloads / register ----------
  function save(bytes, name, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function msg(s, err) { var m = $('#dl-msg'); m.textContent = s; m.className = 'small ' + (err ? 'pw-msg err' : 'pw-msg ok'); }
  function register() { return { settings: st.settings, grenar: st.grenar, members: st.members, cols: st.cols, payments: st.payments }; }
  function applyRegister(r) {
    st.members = r.members; st.cols = r.cols || []; st.map = {}; st.warnings = []; st.file = ''; st.payments = r.payments || {};
    st.settings = Object.assign(defaultSettings(), r.settings || {}); st.grenar = (r.grenar || []).map(function (g) { return newGren(g.label, g.source, g.lines); });
    $('#result').hidden = false; fillSettings(); render();
  }
  $('#dl-xlsx').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.res) return;
    var R = refs();
    window.XLSXW.build(X.sheets(st.res, Object.assign({}, st.settings, { bankgiro: st.settings.bankgiro && D.validBankgiro(st.settings.bankgiro) ? D.fmtBankgiro(st.settings.bankgiro) : st.settings.bankgiro }), R, restData()), { title: 'Debiteringslängd ' + st.settings.year, creator: 'Debiteringslängd för samfällighetsföreningar' })
      .then(function (b) { save(b, t('xlsxFile')(st.settings.year), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg(t('xlsxOk')); })
      .catch(function (er) { msg(t('err') + er.message, true); });
  });
  $('#reg-save').addEventListener('click', function () { if (!PW.isUnlocked() || !st.members) return; try { localStorage.setItem(CFG.REGISTER_KEY, D.registerToJson(register())); msg(t('saved')); } catch (e) { msg(t('err') + e.message, true); } });
  $('#reg-export').addEventListener('click', function () { if (!PW.isUnlocked() || !st.members) return; save(new TextEncoder().encode(D.registerToJson(register())), t('regFile')(st.settings.year), 'application/json'); });
  $('#reg-import').addEventListener('click', function () { if (PW.isUnlocked()) $('#reg-file').click(); });
  $('#reg-file').addEventListener('change', function () {
    var f = $('#reg-file').files[0]; if (!f) return;
    readBuf(f).then(function (b) {
      try { var r = D.registerFromJson(new TextDecoder().decode(b)); applyRegister(r); msg(t('regLoaded')(st.settings.forening, st.settings.year)); } catch (e) { msg(t('not-register'), true); }
      $('#reg-file').value = '';
    });
  });
  $('#reg-next').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.members) return;
    applyRegister(D.nextYear(register())); autosave(); msg(t('nextOk')(st.settings.year));
  });
  function savedReg() { try { var s = localStorage.getItem(CFG.REGISTER_KEY); return s ? D.registerFromJson(s) : null; } catch (e) { return null; } }
  function savedRow() {
    var r = PW.isUnlocked() && !st.members ? savedReg() : null;
    $('#saved-row').hidden = !r; if (r) $('#reg-load').textContent = t('loadSaved')(r.settings.forening || '', r.settings.year || '');
  }
  $('#reg-load').addEventListener('click', function () { var r = savedReg(); if (!r) return; applyRegister(r); status(t('regLoaded')(st.settings.forening, st.settings.year)); savedRow(); });
  savedRow();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
