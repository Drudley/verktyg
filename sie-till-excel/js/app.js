(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var doc = null, year = '0', verList = [], verShown = 0, PAGE = 100, lang = 'sv';
  var nf = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var EN = {
    h1: 'SIE file to Excel', lead: 'Open a Swedish SIE accounting file in your browser and get vouchers, chart of accounts, trial balance and monthly P&L – ready for Excel. <strong>The file never leaves your computer.</strong>',
    drop: 'Drop your SIE file here or <u>choose file</u>', dropsub: '.se, .si, .sie · SIE 1–4 · PC8/CP437, UTF-8', sample: 'Try a sample file',
    year: 'Fiscal year', export: 'Download Excel (.xlsx)', 't-ver': 'Vouchers', 't-sb': 'Trial balance', 't-acc': 'Accounts', 't-info': 'Company',
    search: 'Search text, account, amount, number…', searcha: 'Search account…', 'c-ver': 'Voucher', 'c-date': 'Date', 'c-text': 'Text', 'c-amt': 'Amount',
    'c-acc': 'Account', 'c-name': 'Name', 'c-per': 'Period', 'c-type': 'Type', more: 'Show more', 'pw-h': 'Excel export',
    'pw-p': 'The export gives you an .xlsx with the sheets Info, Konton, Verifikationer, Transaktioner, Saldobalans and Resultat per månad.', close: 'Close',
    'ex-h': 'How SIE file to Excel works',
    'ex-1': 'SIE is an open Swedish file format for accounting data. Excel cannot open it directly. This tool reads <strong>SIE types 1, 2, 3 and 4</strong> entirely in the browser: drop the file (<code>.se</code>, <code>.si</code> or <code>.sie</code>) and you see vouchers, the chart of accounts, the trial balance and company details at once. Nothing is sent to any server – you can go offline once the page has loaded.',
    'ex-2': 'The preview is free. The Excel export gives you an <code>.xlsx</code> with six sheets you can filter and sum in Excel: <strong>Info</strong> (company name, organisation number, SIE type, program, detected encoding, currency, chart of accounts type, fiscal years and any warnings), <strong>Konton</strong> (number, name, type, SRU code and opening and closing balance or result per year), <strong>Verifikationer</strong> (series, number, date, text, registration date, debit total, line count and whether the voucher balances), <strong>Transaktioner</strong> (account, debit, credit, amount, objects, quantity and type), <strong>Saldobalans</strong> and <strong>Resultat per månad</strong>.',
    'ex-3': 'The trial balance is calculated from opening balances (<code>#IB</code>) and the period movement. If the file has vouchers for the current year (typically a SIE 4 file) the transactions are summed; otherwise the file\'s closing balances (<code>#UB</code>) and results (<code>#RES</code>) are used. A mismatch against the file\'s own <code>#UB</code>/<code>#RES</code> is marked next to the closing balance on screen, and the Differens column in the Excel file shows the amount. Monthly P&amp;L uses income and expense accounts (type income or expense, or BAS accounts 3–8 if the type is missing), either from the vouchers or from period balances (<code>#PSALDO</code>) when there are no vouchers.',
    'faq-h': 'Open a SIE file in Excel – common questions',
    'faq1-s': 'How do I open a SIE file in Excel?',
    'faq1-p': 'Excel cannot read the SIE format directly. Drop the file on the box above and the contents are shown at once. The Excel export gives you an .xlsx with the sheets <em>Info, Konton, Verifikationer, Transaktioner, Saldobalans</em> and <em>Resultat per månad</em> – with real dates and amounts you can sum and filter.',
    'faq2-s': 'What is the difference between SIE types 1, 2, 3 and 4?',
    'faq2-p': '<li><strong>SIE 1 – annual balances:</strong> opening and closing balances and the year\'s result per account.</li><li><strong>SIE 2 – period balances:</strong> type 1 plus balances per month.</li><li><strong>SIE 3 – object balances:</strong> type 2 plus balances per cost centre, project and similar.</li><li><strong>SIE 4 – transactions:</strong> all of the above plus every voucher. The most common export from Fortnox, Visma, Bokio, Björn Lundén and others.</li>',
    'faq3-s': 'How do I export a SIE file from Fortnox or Visma?',
    'faq3-p': 'Most Swedish accounting programs can export a SIE 4 file, including Fortnox, Visma, Bokio and Björn Lundén. In the program, look for export or SIE and choose <strong>SIE 4</strong> so that the vouchers are included (SIE 1–3 contain balances only). The file is usually named <code>.se</code> or <code>.sie</code>. Drop it on the box above. The tool reads the SIE format in the file; it is not connected to Fortnox, Visma or any other program and does not sign in anywhere.',
    'faq4-s': 'What if the file is SIE 1, 2 or 3?',
    'faq4-p': 'Then there are no vouchers to show. The Vouchers tab says so, and you look at the trial balance and chart of accounts instead. In Excel the Verifikationer and Transaktioner sheets are empty except for the headers. Period balances in a SIE 2 file are used for monthly P&amp;L.',
    'faq5-s': 'How is the trial balance calculated?',
    'faq5-p': 'Opening balances come from <code>#IB</code> (income-statement accounts start at zero). Period movement is the sum of the transactions when the file has vouchers for the current year, otherwise the difference between the file\'s closing balance and the opening balance. Closing balance is opening plus movement. If the file also has <code>#UB</code> or <code>#RES</code> they are compared: a mismatch is marked with a warning triangle next to the closing balance on screen, and the Differens column in the Excel file shows the amount.',
    'faq6-s': 'Is my file uploaded anywhere?',
    'faq6-p': 'No. The file is read and converted entirely in your browser. Nothing is sent to any server, and the page uses neither cookies nor tracking. You can even go offline once the page has loaded.',
    'faq7-s': 'Why do å, ä and ö look wrong when I open the file in Notepad?',
    'faq7-p': 'SIE files are normally saved with the PC8 (IBM CP437) encoding. The tool detects the encoding automatically and also handles UTF-8 and Windows-1252 files.',
    'faq8-s': 'Which file extensions work?',
    'faq8-p': 'Export files are usually named <code>.se</code> or <code>.sie</code> and import files (SIE 4I) <code>.si</code>. The tool reads all of them. The SIE standard primarily uses PC8, but UTF-8 (including with a BOM) and Windows-1252 also appear in exports and are recognised.',
    'faq9-s': 'Can I choose the fiscal year?',
    'faq9-p': 'Yes. If the file contains several years (<code>#RAR</code>) they appear in the Fiscal year menu. Vouchers in a SIE 4 file belong to the current year (year 0). Vouchers that do not balance are listed among the warnings and get Nej in the Balanserar column in the Excel file.',
    'faq10-s': 'What does the tool not do?',
    'faq10-p': 'It does not write a SIE file back, change the books or send anything to Skatteverket or the accounting program. Period budgets (<code>#PBUDGET</code>) are skipped. Object balances per cost centre or project (<code>#OIB</code>, <code>#OUB</code> and <code>#PSALDO</code> with objects) are read, but the Excel file has no separate object report – objects appear as a column on the transaction rows.'

  };
  var SV = {};
  var T = {
    sv: { reading: 'Läser fil…', loaded: function (n, e) { return 'Klart: ' + n + ' · teckenkodning ' + e; }, err: 'Kunde inte läsa filen: ', notsie: 'Det här ser inte ut som en SIE-fil (inga #-rader hittades).',
      acc: 'Konton', ver: 'Verifikationer', trans: 'Transaktioner', type: 'SIE-typ', unbal: 'obalanserade', warns: 'Varningar', building: 'Skapar Excel-fil…', done: 'Excel-filen är nedladdad.',
      cur: 'Innevarande år', yr: 'År', none: 'Inga träffar.', novouchers: 'Filen innehåller inga verifikationer (SIE 1–3). Se Saldobalans.', sum: 'Summa',
      fields: ['Företagsnamn', 'Org.nr', 'Program', 'Genererad', 'SIE-typ', 'Teckenkodning', 'Valuta', 'Kontoplan', 'Adress'], showing: function (a, b) { return 'Visar ' + a + ' av ' + b; } },
    en: { reading: 'Reading file…', loaded: function (n, e) { return 'Done: ' + n + ' · encoding ' + e; }, err: 'Could not read the file: ', notsie: 'This does not look like a SIE file (no # lines found).',
      acc: 'Accounts', ver: 'Vouchers', trans: 'Transactions', type: 'SIE type', unbal: 'unbalanced', warns: 'Warnings', building: 'Building Excel file…', done: 'Excel file downloaded.',
      cur: 'Current year', yr: 'Year', none: 'No matches.', novouchers: 'This file has no vouchers (SIE 1–3). See Trial balance.', sum: 'Total',
      fields: ['Company', 'Org. no.', 'Program', 'Generated', 'SIE type', 'Encoding', 'Currency', 'Chart of accounts', 'Address'], showing: function (a, b) { return 'Showing ' + a + ' of ' + b; } }
  };
  function t(k) { return T[lang][k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(ore) { return '<span class="' + (ore < 0 ? 'neg' : '') + '">' + nf.format(ore / 100) + '</span>'; }
  function status(msg, err) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }

  // ---------- i18n ----------
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { SV[el.dataset.i18nPh] = el.placeholder; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { if (D[el.dataset.i18nPh]) el.placeholder = D[el.dataset.i18nPh]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    if (doc) render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- file input ----------
  var drop = $('#drop'), input = $('#file');
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', function () { if (input.files[0]) readFile(input.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readFile(f); });
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel.se').then(function (r) { return r.arrayBuffer(); }).then(function (b) { load(b, 'exempel.se'); }).catch(function (er) { status(t('err') + er.message, true); });
  });

  function readFile(f) {
    status(t('reading'));
    var r = new FileReader();
    r.onload = function () { load(r.result, f.name); };
    r.onerror = function () { status(t('err') + (r.error && r.error.message), true); };
    r.readAsArrayBuffer(f);
  }
  function load(buf, name) {
    try {
      var d = SIE.parse(buf);
      if (!Object.keys(d.accounts).length && !d.vouchers.length && !d.fnamn) { status(t('notsie'), true); return; }
      doc = d; year = '0';
      status(t('loaded')(name, d.encoding));
      $('#result').hidden = false;
      render();
      $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { status(t('err') + e.message, true); }
  }

  // ---------- rendering ----------
  function render() {
    var s = SIE.summary(doc);
    $('#c-name').textContent = doc.fnamn || '(namnlöst företag)';
    var rar = doc.rar[year];
    $('#c-meta').textContent = [doc.orgnr, rar ? SIE.fmtDate(rar.start) + ' – ' + SIE.fmtDate(rar.end) : '', doc.program].filter(Boolean).join(' · ');
    var ys = s.years.length ? s.years : ['0'];
    $('#year').innerHTML = ys.map(function (y) {
      var r = doc.rar[y]; var lbl = (y === '0' ? t('cur') : t('yr') + ' ' + y) + (r ? ' (' + r.start.slice(0, 4) + (r.end.slice(0, 4) !== r.start.slice(0, 4) ? '/' + r.end.slice(2, 4) : '') + ')' : '');
      return '<option value="' + esc(y) + '"' + (y === year ? ' selected' : '') + '>' + esc(lbl) + '</option>';
    }).join('');
    $('#stats').innerHTML = [[t('type'), doc.sieTyp], [t('acc'), s.accounts], [t('ver'), s.vouchers + (s.unbalanced ? ' (' + s.unbalanced + ' ' + t('unbal') + ')' : '')], [t('trans'), s.transactions]]
      .map(function (x) { return '<div class="stat"><span class="muted small">' + esc(x[0]) + '</span><b>' + esc(x[1]) + '</b></div>'; }).join('');
    var w = $('#warn');
    if (doc.warnings.length) { w.hidden = false; w.innerHTML = '<b>' + t('warns') + ' (' + doc.warnings.length + ')</b><br>' + doc.warnings.slice(0, 50).map(esc).join('<br>'); } else w.hidden = true;
    updateExportBtn();
    filterVer(); renderSB(); renderAcc(); renderInfo();
  }

  function verMatches(v, q) {
    if (!q) return true;
    if ((v.serie + ' ' + v.nr + ' ' + v.serie + v.nr + ' ' + v.text + ' ' + v.date + ' ' + SIE.fmtDate(v.date)).toLowerCase().indexOf(q) >= 0) return true;
    for (var i = 0; i < v.trans.length; i++) {
      var tr = v.trans[i];
      if (tr.konto === q || (tr.text && tr.text.toLowerCase().indexOf(q) >= 0)) return true;
      var a = (Math.abs(tr.amount) / 100).toFixed(2);
      if (a === q.replace(',', '.') || a.replace('.', ',') === q || a.split('.')[0] === q) return true;
    }
    return false;
  }
  function filterVer() {
    var q = $('#q').value.trim().toLowerCase();
    verList = doc.vouchers.filter(function (v) { return verMatches(v, q); });
    verShown = 0; $('#ver-t tbody').innerHTML = '';
    if (!doc.vouchers.length) { $('#ver-t tbody').innerHTML = '<tr><td colspan="4" class="muted">' + t('novouchers') + '</td></tr>'; $('#more').hidden = true; return; }
    if (!verList.length) { $('#ver-t tbody').innerHTML = '<tr><td colspan="4" class="muted">' + t('none') + '</td></tr>'; $('#more').hidden = true; return; }
    moreVer();
  }
  function moreVer() {
    var html = [], end = Math.min(verShown + PAGE, verList.length);
    for (var i = verShown; i < end; i++) {
      var v = verList[i], deb = 0;
      v.trans.forEach(function (x) { if (!x.removed && x.amount > 0) deb += x.amount; });
      html.push('<tr class="v' + (v.sum ? ' bad' : '') + '" data-i="' + doc.vouchers.indexOf(v) + '"><td>' + esc(v.serie + ' ' + v.nr) + '</td><td>' + esc(SIE.fmtDate(v.date)) + '</td><td>' + esc(v.text) + '</td><td class="num">' + money(deb) + '</td></tr>');
    }
    $('#ver-t tbody').insertAdjacentHTML('beforeend', html.join(''));
    verShown = end;
    var m = $('#more'); m.hidden = verShown >= verList.length;
    m.textContent = (lang === 'en' ? EN.more : SV.more) + ' (' + t('showing')(verShown, verList.length) + ')';
  }
  $('#more').addEventListener('click', moreVer);
  var qt; $('#q').addEventListener('input', function () { clearTimeout(qt); qt = setTimeout(filterVer, 150); });
  $('#ver-t tbody').addEventListener('click', function (e) {
    var row = e.target.closest('tr.v'); if (!row) return;
    var next = row.nextElementSibling;
    if (next && next.classList.contains('tr')) { while (next && next.classList.contains('tr')) { var n2 = next.nextElementSibling; next.remove(); next = n2; } return; }
    var v = doc.vouchers[+row.dataset.i];
    row.insertAdjacentHTML('afterend', v.trans.map(function (x) {
      var nm = (doc.accounts[x.konto] || {}).name || '';
      var extra = [x.text, x.objects.map(function (o) { return o.dim + ':' + o.obj; }).join(' '), x.kind !== 'TRANS' ? x.kind : ''].filter(Boolean).join(' · ');
      return '<tr class="tr"><td>' + esc(x.konto) + '</td><td>' + esc(SIE.fmtDate(x.date)) + '</td><td>' + esc(nm) + (extra ? ' <span class="muted">(' + esc(extra) + ')</span>' : '') + (x.removed ? ' <s>' + '</s>' : '') + '</td><td class="num">' + money(x.amount) + '</td></tr>';
    }).join(''));
  });

  function renderSB() {
    var rows = SIE.trialBalance(doc, year), ti = 0, tp = 0, tu = 0;
    $('#sb-t tbody').innerHTML = rows.map(function (r) { ti += r.ib; tp += r.period; tu += r.ub;
      return '<tr><td>' + esc(r.konto) + '</td><td>' + esc(r.namn) + '</td><td class="num">' + money(r.ib) + '</td><td class="num">' + money(r.period) + '</td><td class="num">' + money(r.ub) + (r.diff ? ' ⚠' : '') + '</td></tr>'; }).join('');
    $('#sb-t tfoot').innerHTML = '<tr><td></td><td>' + t('sum') + '</td><td class="num">' + money(ti) + '</td><td class="num">' + money(tp) + '</td><td class="num">' + money(tu) + '</td></tr>';
  }
  function renderAcc() {
    var q = $('#qa').value.trim().toLowerCase();
    var TY = { T: lang === 'en' ? 'Asset' : 'Tillgång', S: lang === 'en' ? 'Liability/Equity' : 'Skuld/EK', I: lang === 'en' ? 'Income' : 'Intäkt', K: lang === 'en' ? 'Expense' : 'Kostnad' };
    $('#acc-t tbody').innerHTML = SIE.sortedAccounts(doc).filter(function (k) { return !q || (k + ' ' + doc.accounts[k].name).toLowerCase().indexOf(q) >= 0; })
      .map(function (k) { var a = doc.accounts[k]; return '<tr><td>' + esc(k) + '</td><td>' + esc(a.name) + '</td><td>' + esc(TY[a.type] || a.type) + '</td><td>' + esc(a.sru) + '</td></tr>'; }).join('');
  }
  $('#qa').addEventListener('input', renderAcc);
  function renderInfo() {
    var f = t('fields'), a = doc.adress;
    var items = [[f[0], doc.fnamn], [f[1], doc.orgnr], [f[2], doc.program], [f[3], SIE.fmtDate(doc.gen)], [f[4], doc.sieTyp], [f[5], doc.encoding], [f[6], doc.valuta], [f[7], doc.kptyp],
      [f[8], a ? [a.kontakt, a.utdelningsadr, a.postadr, a.tel].filter(Boolean).join(', ') : '']];
    Object.keys(doc.rar).sort(function (x, y) { return y - x; }).forEach(function (k) { items.push([(k === '0' ? t('cur') : t('yr') + ' ' + k), SIE.fmtDate(doc.rar[k].start) + ' – ' + SIE.fmtDate(doc.rar[k].end)]); });
    $('#info-dl').innerHTML = items.filter(function (x) { return x[1] !== '' && x[1] != null; }).map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('');
  }
  $('#year').addEventListener('change', function () { year = this.value; render(); });

  // tabs
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(function (x) { x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.hidden = p.id !== 'p-' + b.dataset.tab; });
    });
  });

  // ---------- export / paywall ----------
  function updateExportBtn() { $('#export').classList.toggle('locked', !window.SIE_PAYWALL.isUnlocked()); }
  $('#export').addEventListener('click', function () {
    if (!doc) return;
    if (window.SIE_PAYWALL.isUnlocked()) return doExport();
    $('#paywall').showModal();
  });
  window.PAYWALL.mount($('#paywall'), window.SIE_PAYWALL, { launchAfter: $('#export').parentNode, onUnlocked: function () { updateExportBtn(); doExport(); } });
  function doExport() {
    status(t('building'));
    SIEExport.build(doc, year).then(function (bytes) {
      var blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = SIEExport.fileName(doc);
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      status(t('done'));
    }).catch(function (e) { status(t('err') + e.message, true); });
  }
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
