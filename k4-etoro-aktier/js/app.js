/* UI for eToro till K4. Depends on ETORO, XLSXR, K4, SRU, K4MSG, K4Export, K4_RATES, PAYWALL, APP_CONFIG. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, lang = 'sv';
  var st = { files: [], res: null, k4: null, year: null, fileName: '', settings: { perSale: false, cfdA: false } };
  try { Object.assign(st.settings, JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || '{}')); } catch (e) {}

  var EN = {
    h1: 'eToro to K4 – SRU file for shares, crypto and CFDs',
    lead: 'Drop in your eToro account statement. Real shares and ETFs use the Swedish <strong>average cost method</strong> (genomsnittsmetoden) in SEK, crypto goes to section D, CFDs and short positions are reported per position and dividends are shown with withholding tax. You get a K4 <strong>SRU file</strong> to import at Skatteverket. <strong>The file never leaves your computer.</strong>',
    drop: 'Drop the eToro account statement here or <u>choose a file</u>', dropsub: 'Account Statement (.xlsx) from the account start · or the Closed Positions, Account Activity and Dividends sheets saved as CSV',
    sample: 'Try a synthetic sample file', year: 'Income year', persale: 'One K4 row per sale', cfda: 'CFDs on shares/indices in section A (as market-listed)',
    add: 'Add more files', 'prev-h': 'Preview per instrument', 'c-avs': 'Section', 'c-sec': 'Instrument', 'c-qty': 'Quantity sold', 'c-pris': 'Sale price', 'c-omk': 'Cost basis', 'c-res': 'Gain / loss', 'c-status': 'Status',
    'div-h': 'Dividends and withholding tax (not K4)', 'd-sec': 'Holding', 'd-n': 'Payments', 'd-gross': 'Gross (box 7.2)', 'd-wht': 'Withholding tax (credit)', 'd-net': 'Net',
    'paid-h': 'K4 rows, SRU file and review workbook', 'paid-p': 'K4 sections A, C and D (9, 7 and 7 rows per form), <code>INFO.SRU</code> + <code>BLANKETTER.SRU</code> for Skatteverket\'s file upload and an Excel file with every buy, sale, average-cost step, CFD position and dividend.',
    open: 'Show K4 rows and download SRU', round: 'Quantities are rounded to whole numbers in the SRU file because the format only allows integers (fractional shares). The quantity does not affect the tax; amounts and gain/loss are exact to the krona.',
    'who-h': 'Details for the SRU file', 'who-p': 'Required in INFO.SRU and BLANKETTER.SRU. Not saved – only kept in this tab.',
    'f-pnr': 'Personal identity number (YYYYMMDD-NNNN)', 'f-name': 'Name', 'f-zip': 'Postcode', 'f-city': 'City',
    'dl-sru': 'Download SRU files (INFO.SRU + BLANKETTER.SRU)', 'dl-xlsx': 'Download review workbook (.xlsx)',
    'rev-h': 'Review before you file', 'rev-1': 'Make sure the statement starts <strong>at the account start</strong>. The average cost method needs every purchase of the same share, including positions still open or closed in earlier years.',
    'rev-2': 'CFDs, leverage and short positions are reported per closed position. Whether eToro\'s CFDs on shares and indices count as market-listed (section A) or not (section D) is unclear – the tool uses D by default. Please check.',
    'rev-3': 'Dividends, withholding tax and interest are not K4. They are shown separately and go in box 7.2 and the foreign tax credit. Currency effects on the USD balance are not calculated. Where the tax treatment is uncertain the tool says so: check those points.',
    'rev-4': 'Open the form in the e-service after the import and compare it with the review workbook. You are responsible for the figures in your tax return.',
    'pw-h': 'K4 rows and SRU file', 'pw-p': 'Unlock the K4 rows, the SRU files for Skatteverket\'s file upload and the Excel review workbook. The preview is always free.'
  };
  var T = {
    sv: { reading: 'Läser filen…', err: 'Kunde inte läsa filen: ', 'no-header': 'Hittade inga kända eToro-kolumner. Använd kontoutdraget (Account Statement) som Excel-fil – inte PDF-versionen eller Tax Report.',
      fileErr: function (f, m) { return f + ': ' + m; }, 'missing-columns': 'Kolumner saknas: ', 'not-zip': 'Excel-filen kunde inte öppnas.', 'no-inflate': 'Webbläsaren kan inte packa upp .xlsx – spara flikarna som CSV i stället.', 'xls-legacy': 'Det här är en gammal .xls-fil. Öppna den och spara som .xlsx eller CSV.', encrypted: 'Excel-filen är lösenordsskyddad. Spara en kopia utan lösenord.', 'bad-zip': 'Excel-filen är skadad eller ofullständig.', 'no-sheet': 'Excel-filen innehåller inga blad.', 'not-xlsx': 'Filen är inte en Excel-arbetsbok (.xlsx).',
      title: function (n) { return n + ' positioner från eToro'; },
      fmt: { 'etoro-statement': 'Account Statement', 'etoro-closed': 'Closed Positions', 'etoro-activity': 'Account Activity', 'etoro-dividends': 'Dividends', 'etoro-unknown': 'okänt format' },
      counts: function (c) { return c.real + ' riktiga, ' + c.cfd + ' CFD' + (c.copied ? ' · ' + c.copied + ' via CopyTrader' : ''); },
      sales: 'Försäljningar', pris: 'Försäljningspris', omk: 'Omkostnadsbelopp', gain: 'Vinst', loss: 'Förlust', net: 'Netto', kr: ' kr',
      noSales: 'Inga stängda positioner det här året – inget att redovisa på K4.', ok: 'Med i K4', blocked: 'Undantaget – hantera manuellt', partial: 'Delvis – se flaggor', cfd: 'CFD', guessed: 'gissad',
      flagsH: 'Kräver kontroll', ignH: 'Ignorerat (påverkar inte K4)', notesH: 'Osäker skattemässig behandling – kontrollera', incH: function (y) { return 'Övriga inkomster ' + y + ' som inte hör till K4 (inkomst av kapital)'; }, inc: { interest: 'Ränta', reward: 'Staking-belöningar' }, noRate: 'kurs saknas', ignRow: function (n, k) { return n + ' × ' + k; },
      fx: function (u) { return 'Växelkurs: ' + u.riksbank + ' belopp omräknade med Riksbankens USD-kurs för affärsdagen.'; }, start: function (d) { return 'Kontoutdraget börjar ' + d + '.'; },
      total: 'Summa', page: function (n, m) { return 'K4-blankett ' + n + ' av ' + m; }, sec: { A: 'Avsnitt A – marknadsnoterade aktier, ETF:er m.m.', C: 'Avsnitt C – valuta m.m.', D: 'Avsnitt D – övriga tillgångar (krypto, råvaror, onoterade CFD:er)' }, k4cols: ['Rad', 'Antal', 'Beteckning', 'Försäljningspris', 'Omkostnadsbelopp', 'Vinst', 'Förlust'], k4colsC: ['Rad', 'Antal/belopp i valuta', 'Beteckning/valutakod', 'Försäljningspris', 'Omkostnadsbelopp', 'Vinst', 'Förlust'],
      many: 'Mer än 300 försäljningsrader – Skatteverkets filimport kan avvisa så stora filer. Välj en rad per instrument.', divUnknown: 'okänd',
      bad: 'Fyll i markerade fält (personnummer med kontrollsiffra, namn, postnummer med 5 siffror, postort).', sruOk: 'INFO.SRU och BLANKETTER.SRU har laddats ner. Byt inte namn på filerna.', xlsxOk: 'Granskningsfilen har laddats ner.',
      blockedNote: function (n) { return n + ' rad(er) är undantagna från SRU-filen – K4 blir ofullständig tills du lägger till dem manuellt.'; }, oldYear: 'SRU-filen gäller blankett K4-%yP4. Skatteverkets filöverföring tar normalt bara emot innevarande deklarationsår.' },
    en: { reading: 'Reading the file…', err: 'Could not read the file: ', 'no-header': 'No known eToro columns found. Use the Account Statement as an Excel file – not the PDF version or the Tax Report.',
      fileErr: function (f, m) { return f + ': ' + m; }, 'missing-columns': 'Missing columns: ', 'not-zip': 'The Excel file could not be opened.', 'no-inflate': 'This browser cannot unpack .xlsx – save the sheets as CSV instead.', 'xls-legacy': 'This is an old .xls file. Open it and save as .xlsx or CSV.', encrypted: 'The Excel file is password protected. Save a copy without a password.', 'bad-zip': 'The Excel file is damaged or incomplete.', 'no-sheet': 'The Excel file contains no sheets.', 'not-xlsx': 'The file is not an Excel workbook (.xlsx).',
      title: function (n) { return n + ' positions from eToro'; },
      fmt: { 'etoro-statement': 'Account Statement', 'etoro-closed': 'Closed Positions', 'etoro-activity': 'Account Activity', 'etoro-dividends': 'Dividends', 'etoro-unknown': 'unknown format' },
      counts: function (c) { return c.real + ' real, ' + c.cfd + ' CFD' + (c.copied ? ' · ' + c.copied + ' via CopyTrader' : ''); },
      sales: 'Sales', pris: 'Sale price', omk: 'Cost basis', gain: 'Gain', loss: 'Loss', net: 'Net', kr: ' kr',
      noSales: 'No closed positions this year – nothing to report on K4.', ok: 'In K4', blocked: 'Excluded – handle manually', partial: 'Partial – see flags', cfd: 'CFD', guessed: 'guessed',
      flagsH: 'Needs checking', ignH: 'Ignored (does not affect K4)', notesH: 'Uncertain tax treatment – please check', incH: function (y) { return 'Other income ' + y + ' that is not K4 (capital income)'; }, inc: { interest: 'Interest', reward: 'Staking rewards' }, noRate: 'no rate', ignRow: function (n, k) { return n + ' × ' + k; },
      fx: function (u) { return 'Exchange rate: ' + u.riksbank + ' amounts converted with the Riksbank USD rate for the trade date.'; }, start: function (d) { return 'The statement starts ' + d + '.'; },
      total: 'Total', page: function (n, m) { return 'K4 form ' + n + ' of ' + m; }, sec: { A: 'Section A – listed shares, ETFs etc.', C: 'Section C – currency etc.', D: 'Section D – other assets (crypto, commodities, unlisted CFDs)' }, k4cols: ['Row', 'Quantity', 'Description', 'Sale price', 'Cost basis', 'Gain', 'Loss'], k4colsC: ['Row', 'Quantity/foreign amount', 'Description/currency', 'Sale price', 'Cost basis', 'Gain', 'Loss'],
      many: 'More than 300 sale rows – Skatteverket\'s file import may reject files that large. Use one row per instrument.', divUnknown: 'unknown',
      bad: 'Fill in the highlighted fields (personal number with check digit, name, 5-digit postcode, city).', sruOk: 'INFO.SRU and BLANKETTER.SRU have been downloaded. Do not rename the files.', xlsxOk: 'The review workbook has been downloaded.',
      blockedNote: function (n) { return n + ' row(s) are excluded from the SRU file – K4 is incomplete until you add them manually.'; }, oldYear: 'The SRU file is for form K4-%yP4. Skatteverket\'s file upload normally only accepts the current filing year.' }
  };
  function t(k) { return T[lang][k]; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function kr(n) { return Math.round(n).toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE') + t('kr'); }
  function qty(n) { return (Math.round(n * 1e8) / 1e8).toLocaleString(lang === 'en' ? 'en-GB' : 'sv-SE', { maximumFractionDigits: 8 }); }

  // ---------- i18n ----------
  var SV = {};
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    if (st.res) render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- file input ----------
  var drop = $('#drop'), input = $('#file');
  function status(msg, err) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  var append = false;
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files, false); });
  input.addEventListener('change', function () { if (input.files.length) readFiles(input.files, append); input.value = ''; append = false; });
  $('#add').addEventListener('click', function () { append = true; input.click(); });
  function readFiles(list, add) {
    status(t('reading'));
    var fs = Array.prototype.slice.call(list);
    Promise.all(fs.map(function (f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok({ buf: r.result, name: f.name }); }; r.onerror = function () { no(new Error(f.name)); }; r.readAsArrayBuffer(f); }); }))
      .then(function (xs) { load(xs, add); }).catch(function (er) { status(t('err') + er.message, true); });
  }
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel-etoro-syntetisk.xlsx').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (b) { load([{ buf: b, name: 'exempel-etoro-syntetisk.xlsx' }], false); }).catch(function (er) { status(t('err') + er.message, true); });
  });

  function errText(code, cols) { return (t(code) || t('err') + code) + (cols ? cols.join(', ') : ''); }
  function useful(p) { return p.closed.length || p.dividends.length || p.activity.length; }
  /* xs: [{buf, name}]. add = append to the files already loaded (e.g. sheets saved as separate CSV files). */
  function load(xs, add) {
    Promise.all(xs.map(function (x) {
      return window.ETORO.parseFile(new Uint8Array(x.buf)).then(function (p) { return { name: x.name, p: p }; }, function (er) { return { name: x.name, err: er.message }; });
    })).then(function (rs) {
      var bad = [], files = add ? st.files.slice() : [];
      rs.forEach(function (r) {
        if (r.err) return bad.push(t('fileErr')(r.name, t(r.err) || t('err') + r.err));
        if (!useful(r.p)) { var e = r.p.errors[0] || { code: 'no-header' }; return bad.push(t('fileErr')(r.name, errText(e.code, e.cols))); }
        files = files.filter(function (f) { return f.name !== r.name; }); files.push({ name: r.name, p: r.p });
      });
      if (!files.length) { $('#result').hidden = true; st.files = []; return status(bad.join(' · '), true); }
      st.files = files; st.year = null; st.fileName = files.map(function (f) { return f.name; }).join(', '); status(bad.join(' · '), !!bad.length);
      compute(); $('#result').hidden = false;
    });
  }
  function fmtName(f) { var x = /-xlsx$/.test(f), b = f.replace(/-(xlsx|csv)$/, ''); return (t('fmt')[b] || b) + (x ? ' (Excel)' : ' (CSV)'); }
  function compute() {
    st.res = window.ETORO.compute(st.files, { rates: window.K4_RATES, cfdStockSection: st.settings.cfdA ? 'A' : 'D' });
    var ys = st.res.years;
    if (!st.year || ys.indexOf(st.year) < 0) st.year = ys.length ? ys[ys.length - 1] : String(new Date().getFullYear());
    render();
  }
  function saveSettings() { try { localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(st.settings)); } catch (e) {} }
  $('#perSale').checked = !!st.settings.perSale; $('#cfdA').checked = !!st.settings.cfdA;
  $('#perSale').addEventListener('change', function () { st.settings.perSale = this.checked; saveSettings(); render(); });
  $('#cfdA').addEventListener('change', function () { st.settings.cfdA = this.checked; saveSettings(); if (st.files.length) compute(); });
  $('#year').addEventListener('change', function () { st.year = this.value; render(); });

  // ---------- render ----------
  function render() {
    var res = st.res, y = st.year, c = res.counts;
    var dates = []; st.files.forEach(function (f) { f.p.closed.forEach(function (x) { dates.push(x.open.date, x.close.date); }); f.p.activity.forEach(function (x) { dates.push(x.date); }); f.p.dividends.forEach(function (x) { dates.push(x.date); }); });
    dates.sort();
    $('#r-title').textContent = t('title')(c.closed);
    $('#r-meta').textContent = st.files.map(function (f) { return f.name + ' · ' + fmtName(f.p.format); }).join(' | ') + ' · ' + (dates[0] || '') + ' – ' + (dates[dates.length - 1] || '') + ' · ' + t('counts')(c);
    var sel = $('#year'), ys = res.years.length ? res.years : [y];
    sel.innerHTML = ys.slice().reverse().map(function (x) { return '<option' + (x === y ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
    var prev = window.K4.k4Rows(res, y, 'security');
    st.k4 = window.K4.k4Rows(res, y, st.settings.perSale ? 'sale' : 'security');
    var S = prev.sums;
    $('#stats').innerHTML = [[t('sales'), String(prev.sales.length)], [t('pris'), kr(S.pris)], [t('omk'), kr(S.omk)], [t('gain'), kr(S.vinst)], [t('loss'), kr(S.forlust)], [t('net'), kr(S.vinst - S.forlust)]]
      .map(function (x) { return '<div class="stat"><span class="muted small">' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
    // flags
    var errs = res.issues.filter(function (i) { return i.level === 'error' && (!i.date || i.date.slice(0, 4) <= y); }), warns = res.issues.filter(function (i) { return i.level !== 'error'; });
    var fl = $('#flags');
    if (errs.length || warns.length) {
      fl.hidden = false;
      fl.innerHTML = '<strong>' + esc(t('flagsH')) + '</strong>' + (errs.length ? ' – ' + esc(t('blockedNote')(errs.length)) : '') + '<ul>' +
        errs.concat(warns).map(function (i) { return '<li>' + (i.ticker ? '<b>' + esc(i.ticker) + '</b> · ' : '') + (i.date ? esc(i.date) + ' · ' : '') + (i.line ? '#' + i.line + ' · ' : '') + esc(window.K4MSG.text(i, lang, res.rateTo)) + '</li>'; }).join('') + '</ul>';
    } else fl.hidden = true;
    // info
    var ig = Object.keys(res.ignored), info = [];
    if (res.notes.length) info.push('<div class="notice" id="notes"><strong>' + esc(t('notesH')) + '</strong><ul>' + res.notes.map(function (c) { return '<li data-note="' + esc(c) + '">' + esc(window.K4MSG.note(c, lang)) + '</li>'; }).join('') + '</ul></div>');
    var other = prev.income.filter(function (x) { return x.type !== 'dividend'; });
    if (other.length) {
      var byT = {}; other.forEach(function (x) { var b = byT[x.type] || (byT[x.type] = { sek: 0, n: 0, miss: 0 }); b.n++; if (x.sek == null) b.miss++; else b.sek += x.sek; });
      info.push('<div id="income"><strong>' + esc(t('incH')(y)) + '</strong><ul>' + Object.keys(byT).map(function (k) { var b = byT[k]; return '<li>' + esc(t('inc')[k] || k) + ': ' + esc(kr(b.sek)) + ' (' + b.n + ')' + (b.miss ? ' – ' + b.miss + ' ' + esc(t('noRate')) : '') + '</li>'; }).join('') + '</ul></div>');
    }
    if (ig.length) info.push('<strong>' + esc(t('ignH')) + '</strong><ul>' + ig.map(function (k) { return '<li>' + esc(t('ignRow')(res.ignored[k], k)) + '</li>'; }).join('') + '</ul>');
    info.push('<p class="small">' + esc(t('fx')(res.fxUsage)) + (res.start ? ' ' + esc(t('start')(res.start)) : '') + '</p>');
    if (y !== '2026') info.push('<p class="small">' + esc(t('oldYear').replace('%y', y)) + '</p>');
    $('#info').innerHTML = info.join(''); $('#info').hidden = false;
    // preview table
    var blockedT = {}; errs.forEach(function (i) { blockedT[i.ticker] = 1; });
    var body = prev.rows.map(function (r) {
      var d = r.pris - r.omk, part = blockedT[r.ticker], cf = r.sales.some(function (s) { return s.cfd; }), g = r.sales.some(function (s) { return s.guessed; });
      return '<tr><td>' + esc(r.section) + '</td><td>' + esc(r.beteckning) + (cf ? ' <span class="tag mid">' + esc(t('cfd')) + (g ? ' · ' + esc(t('guessed')) : '') + '</span>' : '') + '</td><td class="num">' + qty(r.antalExact) + '</td><td class="num">' + kr(r.pris) + '</td><td class="num">' + kr(r.omk) + '</td><td class="num ' + (d < 0 ? 'neg' : 'pos') + '">' + kr(d) + '</td><td><span class="tag' + (part ? ' mid' : '') + '">' + esc(part ? t('partial') : t('ok')) + '</span></td></tr>';
    });
    Object.keys(blockedT).filter(function (k) { return !prev.rows.some(function (r) { return r.ticker === k; }); }).sort().forEach(function (k) {
      body.push('<tr><td>' + esc(res.tickers[k] ? res.tickers[k].section : '') + '</td><td>' + esc(k) + '</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td><span class="tag bad">' + esc(t('blocked')) + '</span></td></tr>');
    });
    if (!body.length) body.push('<tr><td colspan="7" class="muted">' + esc(t('noSales')) + '</td></tr>');
    $('#prev-t tbody').innerHTML = body.join('');
    $('#prev-t tfoot').innerHTML = prev.rows.length ? '<tr><td></td><td>' + esc(t('total')) + '</td><td class="num"></td><td class="num">' + kr(S.pris) + '</td><td class="num">' + kr(S.omk) + '</td><td class="num">' + kr(S.vinst - S.forlust) + '</td><td></td></tr>' : '';
    // dividends
    var dv = prev.income.filter(function (x) { return x.type === 'dividend'; }), byD = {}, G = 0, W = 0, N = 0, wUnknown = false;
    dv.forEach(function (x) { var b = byD[x.ticker] || (byD[x.ticker] = { n: 0, g: 0, w: 0, net: 0, wu: false }); b.n++; var f = x.fx || 0; b.g += x.sek || 0; b.net += (x.net || 0) * f; if (x.whtSek == null) b.wu = wUnknown = true; else b.w += x.whtSek; });
    Object.keys(byD).forEach(function (k) { G += byD[k].g; W += byD[k].w; N += byD[k].net; });
    $('#div-box').hidden = !dv.length;
    $('#div-t tbody').innerHTML = Object.keys(byD).sort().map(function (k) { var b = byD[k]; return '<tr><td>' + esc(k) + '</td><td class="num">' + b.n + '</td><td class="num">' + kr(b.g) + '</td><td class="num">' + (b.wu ? esc(t('divUnknown')) : kr(b.w)) + '</td><td class="num">' + kr(b.net) + '</td></tr>'; }).join('');
    $('#div-t tfoot').innerHTML = dv.length ? '<tr><td>' + esc(t('total')) + '</td><td class="num">' + dv.length + '</td><td class="num">' + kr(G) + '</td><td class="num">' + (wUnknown && !W ? esc(t('divUnknown')) : kr(W)) + '</td><td class="num">' + kr(N) + '</td></tr>' : '';
    renderPaid();
  }

  function renderPaid() {
    var open = PW.isUnlocked();
    $('#k4-open').classList.toggle('locked', !open);
    $('#k4-open').parentNode.hidden = open && !!st.res;
    $('#paid-out').hidden = !(open && st.res);
    if (!open || !st.res) return;
    var k = st.k4, C = t('k4cols');
    function table(k_, S) {
      var cols = k_ === 'A' ? C : t('k4colsC');
      return '<h4>' + esc(t('sec')[k_]) + '</h4><div class="tbl"><table class="k4t" data-sec="' + k_ + '"><thead><tr>' + cols.map(function (c, i) { return '<th' + (i === 1 || i > 2 ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        S.rows.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td class="num">' + (r.antal == null ? '' : r.antal + (r.antalRounded ? '*' : '')) + '</td><td>' + esc(r.beteckning) + '</td><td class="num">' + kr(r.pris) + '</td><td class="num">' + kr(r.omk) + '</td><td class="num">' + (r.vinst ? kr(r.vinst) : '') + '</td><td class="num">' + (r.forlust ? kr(r.forlust) : '') + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td></td><td></td><td>' + esc(t('total')) + '</td><td class="num">' + kr(S.sums.pris) + '</td><td class="num">' + kr(S.sums.omk) + '</td><td class="num">' + kr(S.sums.vinst) + '</td><td class="num">' + kr(S.sums.forlust) + '</td></tr></tfoot></table></div>';
    }
    $('#k4-pages').innerHTML = k.pages.length ? k.pages.map(function (p) {
      return '<div class="k4page"><h3>' + esc(t('page')(p.n, k.pages.length)) + '</h3>' + ['A', 'C', 'D'].filter(function (x) { return p.sec[x].rows.length; }).map(function (x) { return table(x, p.sec[x]); }).join('') + '</div>';
    }).join('') + (k.rows.length > 300 ? '<p class="notice">' + esc(t('many')) + '</p>' : '') : '<p class="muted">' + esc(t('noSales')) + '</p>';
    $('#k4-round').hidden = !k.rounded;
    $('#dl-sru').disabled = $('#dl-xlsx').disabled = !k.rows.length;
  }
  $('#k4-open').addEventListener('click', function () { if (PW.isUnlocked()) return renderPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { renderPaid(); } });

  // ---------- downloads ----------
  function save(bytes, name, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function msg(s, err) { var m = $('#dl-msg'); m.textContent = s; m.className = 'small ' + (err ? 'pw-msg err' : 'pw-msg ok'); }
  $('#dl-sru').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.k4) return;
    var who = { persnr: $('#f-pnr').value, namn: $('#f-name').value, postnr: $('#f-zip').value, postort: $('#f-city').value, now: new Date() }, v = window.SRU.validate(who);
    [['persnr', '#f-pnr'], ['namn', '#f-name'], ['postnr', '#f-zip'], ['postort', '#f-city']].forEach(function (x) { $(x[1]).classList.toggle('bad', v.errors.indexOf(x[0]) >= 0); });
    if (!v.ok) return msg(t('bad'), true);
    var info = window.SRU.info(who), bl = window.SRU.blanketter(st.k4, who);
    window.__lastSRU = { info: info, blanketter: bl }; // for the automated test
    save(window.SRU.latin1(info), 'INFO.SRU'); setTimeout(function () { save(window.SRU.latin1(bl), 'BLANKETTER.SRU'); }, 400);
    msg(t('sruOk'));
  });
  $('#dl-xlsx').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.k4) return;
    var R = window.K4_RATES, d = new Date(), f = function (s) { return s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6, 8); };
    window.K4Export.build(st.res, st.k4, { fileName: st.fileName, files: st.files.map(function (f) { return f.name; }), created: d.toLocaleString('sv-SE'), ratesFrom: f(R.from), ratesTo: f(R.to) }).then(function (b) {
      window.__lastXLSX = b.length; save(b, 'K4-' + st.k4.year + '-etoro-granskning.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg(t('xlsxOk'));
    });
  });

  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
  renderPaid();
})();
