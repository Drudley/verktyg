/* UI for Revolut till K4. Depends on REVOLUT, K4, SRU, K4MSG, K4Export, K4_RATES, PAYWALL, APP_CONFIG. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, lang = 'sv';
  var st = { parsed: null, res: null, k4: null, year: null, fileName: '', settings: { perSale: false, rbOnly: false } };
  try { Object.assign(st.settings, JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || '{}')); } catch (e) {}

  var EN = {
    h1: 'Revolut to K4 – SRU file for your share trades',
    lead: 'Drop in your Revolut statement. You get the cost basis under the Swedish <strong>average cost method</strong> (genomsnittsmetoden), everything converted to SEK, and a K4 <strong>SRU file</strong> to import at Skatteverket. <strong>The file never leaves your computer.</strong>',
    drop: 'Drop the Revolut file here or <u>choose file</u>', dropsub: 'Revolut app → Stocks → ··· → Documents → Account statement · CSV or Excel · full period',
    sample: 'Try a synthetic sample file', year: 'Income year', persale: 'One K4 row per sale', rbonly: 'Always use the Riksbank rate',
    'prev-h': 'Preview per security', 'c-sec': 'Security', 'c-qty': 'Shares sold', 'c-pris': 'Sale price', 'c-omk': 'Cost basis', 'c-res': 'Gain / loss', 'c-status': 'Status',
    'paid-h': 'K4 rows, SRU file and review workbook', 'paid-p': 'K4 section A with at most 9 rows per form, <code>INFO.SRU</code> + <code>BLANKETTER.SRU</code> for Skatteverket\'s file upload and an Excel file with every buy, sale and average-cost step.',
    open: 'Show K4 rows and download SRU', round: 'Quantities are rounded to whole numbers in the SRU file because the format only allows integers (fractional shares). The quantity does not affect the tax; amounts and gain/loss are exact to the krona.',
    'who-h': 'Details for the SRU file', 'who-p': 'Required in INFO.SRU and BLANKETTER.SRU. Not saved – only kept in this tab.',
    'f-pnr': 'Personal identity number (YYYYMMDD-NNNN)', 'f-name': 'Name', 'f-zip': 'Postcode', 'f-city': 'City',
    'dl-sru': 'Download SRU files (INFO.SRU + BLANKETTER.SRU)', 'dl-xlsx': 'Download review workbook (.xlsx)',
    'rev-h': 'Review before you file', 'rev-1': 'Make sure the file contains <strong>every buy since the account was opened</strong> – including earlier years and other Revolut accounts. Missing buys give a wrong cost basis.',
    'rev-2': 'Splits, spin-offs, mergers and ticker changes are not calculated automatically. Such securities are flagged and left out of the SRU file.',
    'rev-3': 'Currency gains on USD/EUR balances at Revolut, dividends and foreign withholding tax are reported separately and are not included here.',
    'rev-4': 'Open the form in the e-service after the import and compare it with the review workbook. You are responsible for the figures in your tax return.',
    'pw-h': 'K4 rows and SRU file', 'pw-p': 'Unlock the K4 rows, the SRU files for Skatteverket\'s file upload and the Excel review workbook. The preview is always free.'
  };
  var T = {
    sv: { reading: 'Läser filen…', err: 'Kunde inte läsa filen: ', 'closed-positions': 'Det här är Revolut-rapporten över stängda positioner (P&L). Den saknar köp av aktier du fortfarande äger, så genomsnittsmetoden går inte att räkna. Ladda ner kontoutdraget (Account statement) för hela perioden i stället.',
      'no-header': 'Hittade inga Revolut-kolumner (Date, Ticker, Type, Quantity …). Är det kontoutdraget för aktiekontot?', 'missing-columns': 'Kolumner saknas: ', 'not-zip': 'Excel-filen kunde inte öppnas.', 'no-inflate': 'Webbläsaren kan inte läsa .xlsx – exportera CSV från Revolut i stället.',
      title: function (n) { return n + ' rader från Revolut'; }, meta: function (f, fmt, d1, d2) { return f + ' · ' + fmt + ' · ' + d1 + ' – ' + d2; },
      fmt: { 'revolut-log-classic': 'Kontoutdrag (CSV)', 'revolut-log-ccy': 'Transaktionslogg (CSV)', 'revolut-log-classic-xlsx': 'Kontoutdrag (Excel)', 'revolut-log-ccy-xlsx': 'Transaktionslogg (Excel)', 'revolut-crypto': 'Kontoutdrag krypto (CSV)', 'revolut-crypto-xlsx': 'Kontoutdrag krypto (Excel)' },
      cryptoFile: 'Det här är Revolut-kontoutdraget för krypto. Krypto redovisas på K4 avsnitt D (övriga tillgångar) och räknas inte av verktyget – inga rader hamnar i SRU-filen för avsnitt A. Aktier och ETF:er: ladda ner kontoutdraget från Revolut-appen under Aktier (Stocks) i stället.',
      qtyFix: function (n) { return 'Antal i ' + n + ' rader saknade decimaltecken (filen har öppnats i ett kalkylprogram med engelska inställningar) och har återställts från värde ÷ pris.'; },
      sales: 'Försäljningar', pris: 'Försäljningspris', omk: 'Omkostnadsbelopp', gain: 'Vinst', loss: 'Förlust', net: 'Netto', kr: ' kr',
      noSales: 'Inga försäljningar i filen – inget att redovisa på K4.', ok: 'Med i K4', blocked: 'Undantaget – hantera manuellt', partial: 'Delvis – se flaggor',
      flagsH: 'Kräver manuell hantering', ignH: 'Ignorerat (påverkar inte K4 avsnitt A)', ignRow: function (n, k) { return n + ' × ' + k; },
      custody: 'Förvaringsavgifter är inte avdragsgilla.', div: 'Utdelningar ingår inte i K4 – de deklareras separat på inkomstdeklarationen (Revolut lämnar ingen kontrolluppgift), och utländsk källskatt kan begäras avräknad.',
      fx: function (u) { return 'Växelkurs: ' + u.file + ' affärer med Revolut-filens kurs' + (u['file-inverted'] ? ' (' + u['file-inverted'] + ' inverterade)' : '') + ', ' + u.riksbank + ' med Riksbankens kurs, ' + u.sek + ' i SEK.'; },
      total: 'Summa', page: function (n, m) { return 'K4-blankett ' + n + ' av ' + m + ' (avsnitt A)'; }, k4cols: ['Rad', 'Antal', 'Beteckning', 'Försäljningspris', 'Omkostnadsbelopp', 'Vinst', 'Förlust'],
      many: 'Mer än 300 försäljningsrader – Skatteverkets filimport kan avvisa så stora filer. Välj en rad per värdepapper.',
      bad: 'Fyll i markerade fält (personnummer med kontrollsiffra, namn, postnummer med 5 siffror, postort).', sruOk: 'INFO.SRU och BLANKETTER.SRU har laddats ner. Byt inte namn på filerna.', xlsxOk: 'Granskningsfilen har laddats ner.',
      blockedNote: function (n) { return n + ' värdepapper är undantagna från SRU-filen – K4 blir ofullständig tills du lägger till dem manuellt.'; }, oldYear: 'SRU-filen gäller blankett K4-%yP4. Skatteverkets filöverföring tar normalt bara emot innevarande deklarationsår.' },
    en: { reading: 'Reading the file…', err: 'Could not read the file: ', 'closed-positions': 'This is Revolut\'s closed-positions (P&L) report. It lacks buys of shares you still hold, so the average cost cannot be calculated. Download the Account statement for the full period instead.',
      'no-header': 'No Revolut columns found (Date, Ticker, Type, Quantity …). Is this the stock account statement?', 'missing-columns': 'Missing columns: ', 'not-zip': 'The Excel file could not be opened.', 'no-inflate': 'This browser cannot read .xlsx – export CSV from Revolut instead.',
      title: function (n) { return n + ' rows from Revolut'; }, meta: function (f, fmt, d1, d2) { return f + ' · ' + fmt + ' · ' + d1 + ' – ' + d2; },
      fmt: { 'revolut-log-classic': 'Account statement (CSV)', 'revolut-log-ccy': 'Transaction log (CSV)', 'revolut-log-classic-xlsx': 'Account statement (Excel)', 'revolut-log-ccy-xlsx': 'Transaction log (Excel)', 'revolut-crypto': 'Crypto statement (CSV)', 'revolut-crypto-xlsx': 'Crypto statement (Excel)' },
      cryptoFile: 'This is Revolut\'s crypto account statement. Crypto is reported in K4 section D (other assets) and is not calculated by this tool – no rows go into the section A SRU file. For shares and ETFs, download the account statement under Stocks in the Revolut app instead.',
      qtyFix: function (n) { return 'Quantities in ' + n + ' rows had lost their decimal separator (the file was opened in a spreadsheet with English settings) and were restored from value ÷ price.'; },
      sales: 'Sales', pris: 'Sale price', omk: 'Cost basis', gain: 'Gain', loss: 'Loss', net: 'Net', kr: ' kr',
      noSales: 'No sales in the file – nothing to report on K4.', ok: 'In K4', blocked: 'Excluded – handle manually', partial: 'Partial – see flags',
      flagsH: 'Needs manual handling', ignH: 'Ignored (does not affect K4 section A)', ignRow: function (n, k) { return n + ' × ' + k; },
      custody: 'Custody fees are not deductible.', div: 'Dividends are not part of K4 – declare them separately on the income tax return (Revolut sends no statement to Skatteverket) and claim credit for foreign withholding tax.',
      fx: function (u) { return 'FX: ' + u.file + ' trades at the Revolut file rate' + (u['file-inverted'] ? ' (' + u['file-inverted'] + ' inverted)' : '') + ', ' + u.riksbank + ' at the Riksbank rate, ' + u.sek + ' in SEK.'; },
      total: 'Total', page: function (n, m) { return 'K4 form ' + n + ' of ' + m + ' (section A)'; }, k4cols: ['Row', 'Qty', 'Security', 'Sale price', 'Cost basis', 'Gain', 'Loss'],
      many: 'More than 300 sale rows – Skatteverket\'s import may reject such large files. Use one row per security.',
      bad: 'Fill in the marked fields (valid personal number, name, 5-digit postcode, city).', sruOk: 'INFO.SRU and BLANKETTER.SRU downloaded. Do not rename the files.', xlsxOk: 'Review workbook downloaded.',
      blockedNote: function (n) { return n + ' securities are excluded from the SRU file – K4 is incomplete until you add them manually.'; }, oldYear: 'The SRU file uses form K4-%yP4. Skatteverket\'s file upload normally only accepts the current filing year.' }
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
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readFile(f); });
  input.addEventListener('change', function () { if (input.files[0]) readFile(input.files[0]); input.value = ''; });
  function readFile(f) { status(t('reading')); var r = new FileReader(); r.onload = function () { load(r.result, f.name); }; r.onerror = function () { status(t('err') + f.name, true); }; r.readAsArrayBuffer(f); }
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel-revolut-syntetisk.csv').then(function (r) { return r.arrayBuffer(); }).then(function (b) { load(b, 'exempel-revolut-syntetisk.csv'); }).catch(function (er) { status(t('err') + er.message, true); });
  });

  function load(buf, name) {
    window.REVOLUT.parseFile(new Uint8Array(buf)).then(function (p) {
      if (p.errors.length && !p.events.length) {
        var e = p.errors[0]; $('#result').hidden = true;
        return status((t(e.code) || t('err') + e.code) + (e.cols ? e.cols.join(', ') : ''), true);
      }
      st.parsed = p; st.fileName = name; st.year = null; status('');
      compute(); $('#result').hidden = false;
    }).catch(function (er) { $('#result').hidden = true; status(t(er.message) || t('err') + er.message, true); });
  }
  function compute() {
    st.res = window.K4.compute(st.parsed.events, { rates: window.K4_RATES, fxMode: st.settings.rbOnly ? 'riksbank' : 'auto' });
    var ys = st.res.years;
    if (!st.year || ys.indexOf(st.year) < 0) st.year = ys.length ? ys[ys.length - 1] : String(new Date().getFullYear());
    render();
  }
  function saveSettings() { try { localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(st.settings)); } catch (e) {} }
  $('#perSale').checked = !!st.settings.perSale; $('#rbOnly').checked = !!st.settings.rbOnly;
  $('#perSale').addEventListener('change', function () { st.settings.perSale = this.checked; saveSettings(); render(); });
  $('#rbOnly').addEventListener('change', function () { st.settings.rbOnly = this.checked; saveSettings(); if (st.parsed) compute(); });
  $('#year').addEventListener('change', function () { st.year = this.value; render(); });

  // ---------- render ----------
  function render() {
    var res = st.res, p = st.parsed, y = st.year;
    var dates = p.events.map(function (e) { return e.date; }).sort();
    $('#r-title').textContent = t('title')(p.rows);
    $('#r-meta').textContent = t('meta')(st.fileName, t('fmt')[p.format] || p.format, dates[0] || '', dates[dates.length - 1] || '');
    var sel = $('#year'), ys = res.years.length ? res.years : [y];
    sel.innerHTML = ys.slice().reverse().map(function (x) { return '<option' + (x === y ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
    var prev = window.K4.k4Rows(res, y, 'security');
    st.k4 = window.K4.k4Rows(res, y, st.settings.perSale ? 'sale' : 'security');
    var S = prev.sums;
    $('#stats').innerHTML = [[t('sales'), String(prev.sales.length)], [t('pris'), kr(S.pris)], [t('omk'), kr(S.omk)], [t('gain'), kr(S.vinst)], [t('loss'), kr(S.forlust)], [t('net'), kr(S.vinst - S.forlust)]]
      .map(function (x) { return '<div class="stat"><span class="muted small">' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
    // flags
    var errs = res.issues.filter(function (i) { return i.level === 'error' && i.date.slice(0, 4) <= y; }), warns = res.issues.filter(function (i) { return i.level !== 'error'; });
    var fl = $('#flags');
    if (errs.length || warns.length) {
      fl.hidden = false;
      fl.innerHTML = '<strong>' + esc(t('flagsH')) + '</strong>' + (errs.length ? ' – ' + esc(t('blockedNote')(errs.length)) : '') + '<ul>' +
        errs.concat(warns).map(function (i) { return '<li>' + (i.ticker ? '<b>' + esc(i.ticker) + '</b> · ' : '') + (i.date ? esc(i.date) + ' · ' : '') + (i.line ? '#' + i.line + ' · ' : '') + esc(window.K4MSG.text(i, lang, res.rateTo)) + '</li>'; }).join('') + '</ul>';
    } else fl.hidden = true;
    // info
    var ig = Object.keys(res.ignored), info = [];
    if (/^revolut-crypto/.test(p.format)) info.push('<p class="notice">' + esc(t('cryptoFile')) + '</p>');
    if (p.qtyRestored) info.push('<p class="small">' + esc(t('qtyFix')(p.qtyRestored)) + '</p>');
    if (ig.length) info.push('<strong>' + esc(t('ignH')) + '</strong><ul>' + ig.map(function (k) { return '<li>' + esc(t('ignRow')(res.ignored[k], k)) + (/CUSTODY/.test(k) ? ' – ' + esc(t('custody')) : /DIVIDEND/.test(k) ? ' – ' + esc(t('div')) : '') + '</li>'; }).join('') + '</ul>');
    info.push('<p class="small">' + esc(t('fx')(res.fxUsage)) + '</p>');
    if (y !== '2026') info.push('<p class="small">' + esc(t('oldYear').replace('%y', y)) + '</p>');
    $('#info').innerHTML = info.join(''); $('#info').hidden = false;
    // preview table
    var blockedT = {}; errs.forEach(function (i) { blockedT[i.ticker] = 1; });
    var body = prev.rows.map(function (r) {
      var d = r.pris - r.omk, part = blockedT[r.ticker];
      return '<tr><td>' + esc(r.beteckning) + '</td><td class="num">' + qty(r.antalExact) + '</td><td class="num">' + kr(r.pris) + '</td><td class="num">' + kr(r.omk) + '</td><td class="num ' + (d < 0 ? 'neg' : 'pos') + '">' + kr(d) + '</td><td><span class="tag' + (part ? ' mid' : '') + '">' + esc(part ? t('partial') : t('ok')) + '</span></td></tr>';
    });
    Object.keys(blockedT).filter(function (k) { return !prev.rows.some(function (r) { return r.ticker === k; }); }).sort().forEach(function (k) {
      body.push('<tr><td>' + esc(k) + '</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td><span class="tag bad">' + esc(t('blocked')) + '</span></td></tr>');
    });
    if (!body.length) body.push('<tr><td colspan="6" class="muted">' + esc(t('noSales')) + '</td></tr>');
    $('#prev-t tbody').innerHTML = body.join('');
    $('#prev-t tfoot').innerHTML = prev.rows.length ? '<tr><td>' + esc(t('total')) + '</td><td></td><td class="num">' + kr(S.pris) + '</td><td class="num">' + kr(S.omk) + '</td><td class="num">' + kr(S.vinst - S.forlust) + '</td><td></td></tr>' : '';
    renderPaid();
  }

  function renderPaid() {
    var open = PW.isUnlocked();
    $('#k4-open').classList.toggle('locked', !open);
    $('#k4-open').parentNode.hidden = open && !!st.res;
    $('#paid-out').hidden = !(open && st.res);
    if (!open || !st.res) return;
    var k = st.k4, C = t('k4cols');
    $('#k4-pages').innerHTML = k.pages.length ? k.pages.map(function (p) {
      return '<div class="k4page"><h3>' + esc(t('page')(p.n, k.pages.length)) + '</h3><div class="tbl"><table class="k4t"><thead><tr>' + C.map(function (c, i) { return '<th' + (i === 1 || i > 2 ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        p.rows.map(function (r, i) { return '<tr><td>' + (i + 1) + '</td><td class="num">' + r.antal + (r.antalRounded ? '*' : '') + '</td><td>' + esc(r.beteckning) + '</td><td class="num">' + kr(r.pris) + '</td><td class="num">' + kr(r.omk) + '</td><td class="num">' + (r.vinst ? kr(r.vinst) : '') + '</td><td class="num">' + (r.forlust ? kr(r.forlust) : '') + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td></td><td></td><td>' + esc(t('total')) + '</td><td class="num">' + kr(p.sums.pris) + '</td><td class="num">' + kr(p.sums.omk) + '</td><td class="num">' + kr(p.sums.vinst) + '</td><td class="num">' + kr(p.sums.forlust) + '</td></tr></tfoot></table></div></div>';
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
    window.K4Export.build(st.res, st.k4, { fileName: st.fileName, created: d.toLocaleString('sv-SE'), ratesFrom: f(R.from), ratesTo: f(R.to) }).then(function (b) {
      window.__lastXLSX = b.length; save(b, 'K4-' + st.k4.year + '-revolut-granskning.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg(t('xlsxOk'));
    });
  });

  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
  renderPaid();
})();
