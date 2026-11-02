/* UI for Årsräkning från kontoutdrag. Everything runs in the browser; files are never uploaded. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, A = window.ARSR, X = window.AEXPORT, lang = 'sv';
  var st = { files: [], accounts: {}, overrides: {}, userRules: [], adj: {}, mode: 'year', year: null, from: null, to: null, res: null, rulesLoaded: 0 };
  var MAXROWS = 600;
  var EN = {
    h1: 'Annual account for Swedish guardians (god man) – from bank statement to finished totals',
    lead: 'Drop the bank export for the person you represent. Every transaction is sorted into the <strong>income and expense categories of the årsräkning</strong> – pension, housing supplement, rent, care fees, electricity, insurance, pocket money, guardian fee – and you get the totals in the form\'s order with the check <strong>A + B = C + D</strong>. <strong>Everything runs in your browser – the statement never leaves your computer.</strong>',
    drop: 'Drop the bank export (CSV or Excel) here or <u>choose a file</u>', dropsub: 'Swedbank/Sparbanken, SEB, Handelsbanken, Nordea, ICA Banken, Länsförsäkringar, Danske Bank and more · several accounts and files are fine',
    sample: 'Try a synthetic example', add: 'Add more accounts/files', 'per-l': 'Period', 'from-l': 'From', 'to-l': 'To',
    'acc-h': 'Accounts and balances', 'c-inc': 'Incl.', 'c-acc': 'Account', 'c-bank': 'Bank', 'c-rows': 'Rows', 'c-open': 'Opening balance (A)', 'c-close': 'Closing balance (D)',
    'acc-p': 'Balances come from the balance column in the file. If there is none, or to change it, type the amount from the bank\'s annual statement. Give two files the same account name to merge them (e.g. two half-years).',
    'adj-h': 'Tax withheld before payment (gross reporting)',
    'adj-p': 'Pension, salary and sickness compensation must be reported <strong>before tax</strong>, but the statement only shows the net amount. Enter the tax withheld from the income statement (kontrolluppgift) and tax on interest from the bank\'s annual statement – it is added both to income and to tax under expenses, so the balance is unaffected.',
    'adj-pl': 'Tax withheld on pension/salary/sickness comp.', 'adj-rl': 'Tax withheld on interest',
    'sum-h': 'Summary in the order of the årsräkning', 'tx-h': 'Transactions – check the categories',
    'tx-p': 'Change the category of a row in the list. If more rows have the same text you can change them all at once with the button next to it. Transfers between two accounts that are both in the account are set to “Transfer between own accounts” and are not counted.',
    'c-date': 'Date', 'c-acc2': 'Account', 'c-text': 'Text', 'c-amt': 'Amount', 'c-cat': 'Category',
    'paid-h': 'Excel, print and saved rules',
    'paid-p': 'An Excel file with <strong>the summary in the form\'s order</strong>, a specification per category, a list of other expenses and all transactions – to attach or keep. A print-friendly summary, and <strong>your own rules saved for next year</strong> (in the browser or as a file).',
    open: 'Show specification, Excel and rules', 'dl-xlsx': 'Download Excel file (.xlsx)', print: 'Print / save as PDF',
    'rules-h': 'My rules', 'rules-p': 'Rules take precedence over the built-in keywords. “All similar” creates a rule automatically. Save the rules and next year\'s statement is categorised straight away.',
    'rule-kw': 'If the text contains', 'rule-cat': '→ category', 'rule-add': 'Add rule', 'rules-save': 'Save rules in this browser', 'rules-export': 'Save rules as a file (.json)', 'rules-import': 'Load rules file',
    'rev-h': 'Check before you submit',
    'rev-1': 'This is a <strong>working paper, not an official form</strong>. Every överförmyndare has its own form or e-service with slightly different lines – copy the totals there and <strong>check the categories against your överförmyndare\'s form and instructions</strong>.',
    'rev-2': 'Taxable income is reported <strong>before tax</strong>. Enter the withheld tax from the income statements above and attach the statements, housing-supplement decisions etc. as your överförmyndare asks.',
    'rev-3': 'Opening and closing balances must match the bank\'s annual statement. If A + B and C + D do not match, rows are usually missing (the file does not cover the whole year) or a transfer goes to an account that is not included.',
    'rev-4': 'Categories are suggestions based on the statement text. Review “Other income” and “Other expenses” in particular – everything unrecognised ends up there. You are responsible for the account.',
    'pw-h': 'Excel, print and saved rules', 'pw-p': 'Unlock the Excel file with summary and specifications, the print view and saving your rules for next year. Reading, categorising and the on-screen totals are always free.'
  };
  var T = {
    sv: { reading: 'Läser filen…', err: 'Kunde inte läsa filen: ', 'unknown-format': 'Känner inte igen filen. Använd bankens export av transaktioner som CSV eller Excel (.xlsx) – den behöver kolumner för datum, text och belopp.',
      'xls-legacy': 'Det här är en gammal Excel-fil (.xls). Öppna den i Excel och spara som .xlsx eller CSV.', pdf: 'PDF-kontoutdrag går inte att läsa. Välj export till CSV eller Excel i internetbanken.',
      'no-rows': 'Inga transaktioner hittades i filen.', empty: 'Filen är tom.', 'bad-zip': 'Excel-filen är skadad.', 'not-xlsx': 'Excel-filen kunde inte läsas.', 'no-sheet': 'Excel-filen har inget blad.', encrypted: 'Excel-filen är lösenordsskyddad.', 'no-inflate': 'Webbläsaren kan inte packa upp Excel-filer – spara som CSV.',
      files: function (n) { return n === 1 ? '1 fil' : n + ' filer'; }, year: function (y) { return 'Kalenderår ' + y; }, custom: 'Eget datumintervall',
      title: function (r) { return r.from.slice(5) === '01-01' && r.to.slice(5) === '12-31' && r.from.slice(0, 4) === r.to.slice(0, 4) ? 'Årsräkning ' + r.from.slice(0, 4) : 'Redovisning ' + r.from + ' – ' + r.to; },
      meta: function (f, b, n, ig) { return f + ' · ' + b + ' · ' + n + ' transaktioner i perioden' + (ig ? ' · ' + ig + ' rader ignorerade (t.ex. reserverade)' : ''); },
      generic: 'okänd bank (kolumner hittade automatiskt)', sB: 'Inkomster (B)', sC: 'Utgifter (C)', sO: 'Övriga utgifter att granska', sN: 'Transaktioner i perioden', kr: ' kr',
      src: { saldo: 'från filen', manual: 'inmatat', missing: 'saknas' },
      sec: { A: 'A  Tillgångar på bankkonton vid periodens början', B: 'B  Inkomster under perioden', C: 'C  Utgifter under perioden', D: 'D  Tillgångar på bankkonton vid periodens slut' },
      sA: 'Summa A', sBt: 'Summa inkomster (B)', sAB: 'Summa A + B', sCt: 'Summa utgifter (C)', sD: 'Summa D', sCD: 'Summa C + D',
      adjP: 'varav avdragen skatt (inmatad)', adjR: 'varav skatt på ränta (inmatad)',
      ok: function (v) { return '✓ Balanserar: A + B = C + D = ' + v; }, bad: function (v) { return '✗ A + B och C + D skiljer ' + v + '. Kontrollera saldon, saknade rader och överföringar.'; },
      miss: function (a) { return 'Saldo saknas för ' + a + ' – fyll i ingående och utgående saldo från bankens årsbesked för att få kontrollen A + B = C + D.'; },
      fl: { duplicates: function (f) { return f.n + ' dubbletter från överlappande filer togs bort.'; }, chain: function (f) { return f.account + ': saldot går inte ihop på ' + f.n + ' ställen – saknas rader i filen?'; },
        'late-start': function (f) { return f.account + ': filen börjar först ' + f.date + '. Ta med transaktioner från periodens början eller fyll i ingående saldo.'; },
        'early-end': function (f) { return f.account + ': filen slutar redan ' + f.date + '. Ta med transaktioner till periodens slut eller fyll i utgående saldo.'; },
        'no-balance': function (f) { return f.account + ': filen har ingen saldokolumn – fyll i ingående och utgående saldo.'; },
        negative: function (f) { return A.CAT[f.cat].sv + ' blir negativ (' + money(f.amount) + ' kr) – kontrollera kategorierna.'; },
        transfers: function (f) { return 'Överföringar mellan egna konton går inte jämnt ut (netto ' + money(f.amount) + ' kr). Är båda kontona med? Annars är det en inkomst eller utgift (t.ex. fickpengar).'; } },
      cols: function (f) { return f.name + ': datum «' + f.columns.date + '», text «' + f.columns.text.join(' + ') + '», belopp «' + f.columns.amount + '»' + (f.columns.balance ? ', saldo «' + f.columns.balance + '»' : ', inget saldo'); },
      allCats: 'Alla kategorier', similar: function (n) { return '→ alla liknande (' + n + ')'; }, more: function (n, m) { return 'Visar ' + n + ' av ' + m + ' rader – sök eller filtrera för att se fler.'; }, none: 'Inga rader matchar.',
      xlsxOk: 'Excel-filen har laddats ner.', file: function (r) { return 'Arsrakning-' + (r.from.slice(0, 4) === r.to.slice(0, 4) ? r.from.slice(0, 4) : r.from + '_' + r.to) + '.xlsx'; },
      rulesSaved: function (n) { return n + ' regler sparade i webbläsaren.'; }, rulesLoaded: function (n) { return n + ' regler inlästa.'; }, rulesBad: 'Filen är ingen regelfil från verktyget.', rulesFile: 'arsrakning-regler.json',
      rulesNone: 'Inga egna regler ännu.', ruleSame: 'text som', ruleContains: 'text innehåller', remove: 'Ta bort', savedRulesInfo: function (n) { return n + ' sparade regler från tidigare används.'; },
      total: 'Summa', otherH: 'Övriga utgifter per mottagare', count: 'antal', printH: function (r) { return 'Årsräkning – sammanställning ' + r.from + ' – ' + r.to + '. Underlag, inte en officiell blankett.'; } },
    en: { reading: 'Reading the file…', err: 'Could not read the file: ', 'unknown-format': 'File not recognised. Use the bank\'s transaction export as CSV or Excel (.xlsx) – it needs columns for date, text and amount.',
      'xls-legacy': 'This is an old Excel file (.xls). Open it in Excel and save as .xlsx or CSV.', pdf: 'PDF statements cannot be read. Choose export to CSV or Excel in the online bank.',
      'no-rows': 'No transactions found in the file.', empty: 'The file is empty.', 'bad-zip': 'The Excel file is damaged.', 'not-xlsx': 'The Excel file could not be read.', 'no-sheet': 'The Excel file has no sheet.', encrypted: 'The Excel file is password protected.', 'no-inflate': 'This browser cannot unpack Excel files – save as CSV.',
      files: function (n) { return n === 1 ? '1 file' : n + ' files'; }, year: function (y) { return 'Calendar year ' + y; }, custom: 'Custom date range',
      title: function (r) { return r.from.slice(5) === '01-01' && r.to.slice(5) === '12-31' && r.from.slice(0, 4) === r.to.slice(0, 4) ? 'Annual account ' + r.from.slice(0, 4) : 'Account ' + r.from + ' – ' + r.to; },
      meta: function (f, b, n, ig) { return f + ' · ' + b + ' · ' + n + ' transactions in the period' + (ig ? ' · ' + ig + ' rows ignored (e.g. pending)' : ''); },
      generic: 'unknown bank (columns found automatically)', sB: 'Income (B)', sC: 'Expenses (C)', sO: 'Other expenses to review', sN: 'Transactions in the period', kr: ' SEK',
      src: { saldo: 'from file', manual: 'entered', missing: 'missing' },
      sec: { A: 'A  Bank balances at the start of the period', B: 'B  Income during the period', C: 'C  Expenses during the period', D: 'D  Bank balances at the end of the period' },
      sA: 'Total A', sBt: 'Total income (B)', sAB: 'Total A + B', sCt: 'Total expenses (C)', sD: 'Total D', sCD: 'Total C + D',
      adjP: 'of which tax withheld (entered)', adjR: 'of which tax on interest (entered)',
      ok: function (v) { return '✓ Balances: A + B = C + D = ' + v; }, bad: function (v) { return '✗ A + B and C + D differ by ' + v + '. Check balances, missing rows and transfers.'; },
      miss: function (a) { return 'Balance missing for ' + a + ' – enter the opening and closing balance from the bank\'s annual statement to get the A + B = C + D check.'; },
      fl: { duplicates: function (f) { return f.n + ' duplicates from overlapping files were removed.'; }, chain: function (f) { return f.account + ': the balance does not add up in ' + f.n + ' places – rows missing from the file?'; },
        'late-start': function (f) { return f.account + ': the file only starts on ' + f.date + '. Include transactions from the start of the period or enter the opening balance.'; },
        'early-end': function (f) { return f.account + ': the file already ends on ' + f.date + '. Include transactions to the end of the period or enter the closing balance.'; },
        'no-balance': function (f) { return f.account + ': the file has no balance column – enter the opening and closing balances.'; },
        negative: function (f) { return A.CAT[f.cat].en + ' is negative (' + money(f.amount) + ' SEK) – check the categories.'; },
        transfers: function (f) { return 'Transfers between own accounts do not net to zero (net ' + money(f.amount) + ' SEK). Are both accounts included? Otherwise it is income or an expense (e.g. pocket money).'; } },
      cols: function (f) { return f.name + ': date «' + f.columns.date + '», text «' + f.columns.text.join(' + ') + '», amount «' + f.columns.amount + '»' + (f.columns.balance ? ', balance «' + f.columns.balance + '»' : ', no balance'); },
      allCats: 'All categories', similar: function (n) { return '→ all similar (' + n + ')'; }, more: function (n, m) { return 'Showing ' + n + ' of ' + m + ' rows – search or filter to see more.'; }, none: 'No rows match.',
      xlsxOk: 'The Excel file has been downloaded.', file: function (r) { return 'Annual-account-' + (r.from.slice(0, 4) === r.to.slice(0, 4) ? r.from.slice(0, 4) : r.from + '_' + r.to) + '.xlsx'; },
      rulesSaved: function (n) { return n + ' rules saved in this browser.'; }, rulesLoaded: function (n) { return n + ' rules loaded.'; }, rulesBad: 'This is not a rules file from the tool.', rulesFile: 'annual-account-rules.json',
      rulesNone: 'No rules of your own yet.', ruleSame: 'text is', ruleContains: 'text contains', remove: 'Remove', savedRulesInfo: function (n) { return n + ' saved rules from before are applied.'; },
      total: 'Total', otherH: 'Other expenses per payee', count: 'count', printH: function (r) { return 'Annual account – summary ' + r.from + ' – ' + r.to + '. Working paper, not an official form.'; } }
  };
  function t(k) { return T[lang][k]; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var loc = function () { return lang === 'en' ? 'en-GB' : 'sv-SE'; };
  function money(o) { return (Math.round(o) / 100).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function kr(o) { return money(o) + t('kr'); }
  function cname(id) { return A.CAT[id][lang === 'en' ? 'en' : 'sv']; }
  function parseInput(v) { v = String(v || '').trim(); if (!v) return null; var o = A.parseAmount(v, lang !== 'en' || /,\d{1,2}$/.test(v)); return isNaN(o) ? NaN : o; }

  // ---------- i18n ----------
  var SV = {};
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  var SVPH = { 'q-ph': $('#q').placeholder };
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#q').placeholder = l === 'en' ? 'Search text or amount' : SVPH['q-ph'];
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    fillCatSelects();
    if (st.res) { periodOptions(); render(); }
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  function catOptions(sel) { return A.CATS.map(function (c) { return '<option value="' + c.id + '"' + (c.id === sel ? ' selected' : '') + '>' + esc(cname(c.id)) + '</option>'; }).join(''); }
  function fillCatSelects() {
    var f = $('#fcat').value; $('#fcat').innerHTML = '<option value="">' + esc(t('allCats')) + '</option>' + catOptions(f); $('#fcat').value = f;
    var r = $('#rule-cat').value; $('#rule-cat').innerHTML = catOptions(r || 'out_ovr');
  }

  // ---------- file input ----------
  var drop = $('#drop'), input = $('#file'), append = false;
  function status(msg, err) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files, false); });
  input.addEventListener('change', function () { if (input.files.length) readFiles(input.files, append); input.value = ''; append = false; });
  $('#add').addEventListener('click', function () { append = true; input.click(); });
  function readBuf(f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok({ buf: r.result, name: f.name }); }; r.onerror = function () { no(new Error(f.name)); }; r.readAsArrayBuffer(f); }); }
  function readFiles(list, add) {
    status(t('reading'));
    Promise.all(Array.prototype.slice.call(list).map(readBuf)).then(function (xs) { load(xs, add); }).catch(function (er) { status(t('err') + er.message, true); });
  }
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel-swedbank-syntetisk.csv').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (b) { load([{ buf: b, name: 'exempel-swedbank-syntetisk.csv' }], false); }).catch(function (er) { status(t('err') + er.message, true); });
  });
  function errText(er) { return t(er.message) || t('err') + er.message; }
  function load(xs, add) {
    Promise.all(xs.map(function (x) { return A.parseFile(new Uint8Array(x.buf), x.name).then(function (p) { return { ok: p }; }, function (er) { return { bad: x.name + ': ' + errText(er) }; }); })).then(function (rs) {
      var ok = rs.filter(function (r) { return r.ok; }).map(function (r) { return r.ok; }), bad = rs.filter(function (r) { return r.bad; }).map(function (r) { return r.bad; });
      if (!ok.length) { status(bad.join(' · '), true); return; }
      if (add) { var names = st.files.map(function (f) { return f.name; }); ok = ok.filter(function (f) { return names.indexOf(f.name) < 0; }); st.files = st.files.concat(ok); }
      else { st.files = ok; st.accounts = {}; st.overrides = {}; st.mode = 'year'; st.year = null; }
      status(bad.join(' · '), !!bad.length);
      periodOptions(); compute(); $('#result').hidden = false; render();
    });
  }

  // ---------- period ----------
  function periodOptions() {
    var ys = A.years(st.files); if (st.year === null || ys.list.indexOf(st.year) < 0) st.year = ys.best;
    $('#year').innerHTML = ys.list.slice().reverse().map(function (y) { return '<option value="' + y + '">' + esc(T[lang].year(y)) + '</option>'; }).join('') + '<option value="custom">' + esc(t('custom')) + '</option>';
    $('#year').value = st.mode === 'custom' ? 'custom' : String(st.year);
    $('#custom').hidden = st.mode !== 'custom';
    if (st.mode !== 'custom') { st.from = st.year + '-01-01'; st.to = st.year + '-12-31'; }
    $('#from').value = st.from; $('#to').value = st.to;
  }
  $('#year').addEventListener('change', function () {
    var v = $('#year').value;
    if (v === 'custom') { st.mode = 'custom'; } else { st.mode = 'year'; st.year = +v; }
    periodOptions(); compute(); render();
  });
  ['#from', '#to'].forEach(function (s) { $(s).addEventListener('change', function () { var f = $('#from').value, to = $('#to').value; if (f && to && f <= to) { st.from = f; st.to = to; compute(); render(); } }); });

  // ---------- compute ----------
  function compute() {
    st.res = A.compute(st.files, { from: st.from, to: st.to, accounts: st.accounts, overrides: st.overrides, userRules: st.userRules, adj: st.adj });
  }
  function recalc() { compute(); render(); }

  // ---------- render ----------
  function render() {
    var r = st.res, Tl = T[lang];
    $('#r-title').textContent = Tl.title(r);
    var banks = st.files.map(function (f) { return f.bankName || Tl.generic; }).filter(function (b, i, a) { return a.indexOf(b) === i; }).join(' + ');
    $('#r-meta').textContent = Tl.meta(st.files.length === 1 ? st.files[0].name : Tl.files(st.files.length), banks, r.tx.length, st.files.reduce(function (s, f) { return s + f.ignored; }, 0));
    // accounts
    $('#acc-t tbody').innerHTML = r.accounts.map(function (a, i) {
      var inp = function (k, v, src) { return '<input class="amt' + (src === 'missing' && a.include ? ' bad' : '') + '" data-i="' + i + '" data-k="' + k + '" inputmode="decimal" value="' + (v === null ? '' : esc(money(v))) + '" aria-label="' + esc(k) + '"><span class="src small muted">' + esc(Tl.src[src]) + '</span>'; };
      return '<tr' + (a.include ? '' : ' class="muted"') + '><td><input type="checkbox" data-i="' + i + '" data-k="include"' + (a.include ? ' checked' : '') + ' aria-label="include"></td><td><input class="accname" data-i="' + i + '" data-k="name" value="' + esc(a.name) + '" aria-label="name"></td><td class="small">' + esc(a.banks.join(', ') || Tl.generic) + '</td><td class="num">' + a.nPeriod + '</td><td class="num">' + inp('opening', a.opening, a.openingSrc) + '</td><td class="num">' + inp('closing', a.closing, a.closingSrc) + '</td></tr>';
    }).join('');
    // stats
    $('#stats').innerHTML = [[Tl.sB, kr(r.B)], [Tl.sC, kr(r.C)], [Tl.sO, kr(r.cats.out_ovr) + ' · ' + r.counts.out_ovr], [Tl.sN, String(r.tx.length)]]
      .map(function (s) { return '<div class="stat"><span class="muted small">' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></div>'; }).join('');
    // flags + info
    var fl = r.flags.map(function (f) { return Tl.fl[f.code] ? Tl.fl[f.code](f) : f.code; });
    $('#flags').hidden = !fl.length; $('#flags').innerHTML = '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    var info = st.files.map(function (f) { return Tl.cols(f); });
    if (st.rulesLoaded) info.push(Tl.savedRulesInfo(st.rulesLoaded));
    $('#info').hidden = !info.length; $('#info').innerHTML = '<ul>' + info.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    // balance check
    var ck = $('#check');
    if (r.missing.length) { ck.className = 'check bad'; ck.textContent = Tl.miss(r.missing.join(', ')); }
    else if (r.diff === 0) { ck.className = 'check ok'; ck.textContent = Tl.ok(kr(r.AB)); }
    else { ck.className = 'check bad'; ck.textContent = Tl.bad(kr(Math.abs(r.diff))); }
    $('#sum-t tbody').innerHTML = summaryRows(r);
    renderTx();
    $('#spec-open').classList.toggle('locked', !PW.isUnlocked());
    if (!$('#paid-out').hidden) renderPaid();
  }
  function summaryRows(r) {
    var Tl = T[lang], h = '', inc = r.accounts.filter(function (a) { return a.include; });
    var row = function (label, v, cls, cat) { return '<tr class="' + (cls || '') + '"><td>' + (cat ? '<button type="button" class="link small catlink" data-cat="' + cat + '">' + esc(label) + '</button>' + (r.counts[cat] ? ' <span class="muted small">(' + r.counts[cat] + ')</span>' : '') : esc(label)) + '</td><td class="num">' + (v === null ? '–' : esc(money(v))) + '</td></tr>'; };
    h += row(Tl.sec.A, null, 'sec').replace('<td class="num">–</td>', '<td class="num">' + esc(lang === 'en' ? 'SEK' : 'Kronor') + '</td>');
    inc.forEach(function (a) { h += row(a.name, a.opening); });
    h += row(Tl.sA, r.A, 'tot');
    h += row(Tl.sec.B, null, 'sec').replace('<td class="num">–</td>', '<td></td>');
    A.CATS.filter(function (c) { return c.g === 'in'; }).forEach(function (c) {
      h += row(cname(c.id), r.cats[c.id], r.cats[c.id] ? '' : 'zero', c.id);
      if (c.id === 'in_pension' && r.adj.pensionTax) h += row('   ' + Tl.adjP, r.adj.pensionTax, 'sub');
      if (c.id === 'in_ranta' && r.adj.interestTax) h += row('   ' + Tl.adjR, r.adj.interestTax, 'sub');
    });
    h += row(Tl.sBt, r.B, 'tot') + row(Tl.sAB, r.AB, 'tot big2');
    h += row(Tl.sec.C, null, 'sec').replace('<td class="num">–</td>', '<td></td>');
    A.CATS.filter(function (c) { return c.g === 'out'; }).forEach(function (c) { h += row(cname(c.id), r.cats[c.id], r.cats[c.id] ? '' : 'zero', c.id); });
    h += row(Tl.sCt, r.C, 'tot');
    h += row(Tl.sec.D, null, 'sec').replace('<td class="num">–</td>', '<td></td>');
    inc.forEach(function (a) { h += row(a.name, a.closing); });
    h += row(Tl.sD, r.D, 'tot') + row(Tl.sCD, r.CD, 'tot big2');
    if (r.counts.x_egna) h += row(cname('x_egna'), r.cats.x_egna, 'zero', 'x_egna');
    return h;
  }
  function filteredTx() {
    var q = $('#q').value.trim().toLowerCase(), fc = $('#fcat').value;
    return st.res.tx.filter(function (x) {
      if (fc && x.cat !== fc) return false;
      if (!q) return true;
      return x.text.toLowerCase().indexOf(q) >= 0 || money(x.amount).indexOf(q) >= 0 || x.date.indexOf(q) >= 0 || x.account.toLowerCase().indexOf(q) >= 0;
    });
  }
  function renderTx() {
    var r = st.res, Tl = T[lang], rows = filteredTx(), show = rows.slice(0, MAXROWS);
    var keyCats = {}; r.tx.forEach(function (x) { (keyCats[x.key] = keyCats[x.key] || {})[x.cat] = 1; });
    $('#tx-t tbody').innerHTML = show.length ? show.map(function (x) {
      var n = r.similar[x.key] || 0, mixed = x.key && n > 1 && Object.keys(keyCats[x.key]).length > 1;
      return '<tr data-id="' + esc(x.id) + '"' + (x.cat !== x.auto ? ' class="changed"' : '') + '><td class="nowrap">' + esc(x.date) + '</td><td class="small">' + esc(x.account) + '</td><td>' + esc(x.text) + '</td><td class="num' + (x.amount < 0 ? ' neg' : ' pos') + '">' + esc(money(x.amount)) + '</td><td><select class="cat" aria-label="category">' + catOptions(x.cat) + '</select>' +
        (mixed ? ' <button type="button" class="link small sim">' + esc(Tl.similar(n)) + '</button>' : '') + '</td></tr>';
    }).join('') : '<tr><td colspan="5" class="muted">' + esc(Tl.none) + '</td></tr>';
    $('#tx-more').textContent = rows.length > show.length ? Tl.more(show.length, rows.length) : '';
  }
  function txById(id) { return st.res.tx.filter(function (x) { return x.id === id; })[0]; }
  $('#tx-t').addEventListener('change', function (e) {
    if (!e.target.classList.contains('cat')) return;
    var id = e.target.closest('tr').dataset.id, x = txById(id); if (!x) return;
    if (e.target.value === x.auto) delete st.overrides[id]; else st.overrides[id] = e.target.value;
    recalc();
  });
  $('#tx-t').addEventListener('click', function (e) {
    if (!e.target.classList.contains('sim')) return;
    var x = txById(e.target.closest('tr').dataset.id); if (!x || !x.key) return;
    applySimilar(x.key, x.cat);
  });
  function applySimilar(key, cat) {
    st.userRules = A.cleanRules([{ kw: key, cat: cat, mode: 'same' }].concat(st.userRules.filter(function (u) { return !(u.mode === 'same' && u.kw === key); })));
    st.res.tx.forEach(function (x) { if (x.key === key) delete st.overrides[x.id]; });
    recalc();
  }
  $('#q').addEventListener('input', renderTx);
  $('#fcat').addEventListener('change', renderTx);
  $('#sum-t').addEventListener('click', function (e) {
    var b = e.target.closest('.catlink'); if (!b) return;
    $('#fcat').value = b.dataset.cat; $('#q').value = ''; renderTx(); $('#tx-t').scrollIntoView({ block: 'start' });
  });
  $('#acc-t').addEventListener('change', function (e) {
    var el = e.target, a = st.res.accounts[+el.dataset.i], k = el.dataset.k; if (!a) return;
    a.keys.forEach(function (key) {
      var c = st.accounts[key] = st.accounts[key] || {};
      if (k === 'include') c.include = el.checked;
      else if (k === 'name') c.name = el.value.trim();
      else { var v = parseInput(el.value); if (v === null) delete c[k]; else if (!isNaN(v)) c[k] = v; }
    });
    recalc();
  });
  ['#adj-p', '#adj-r'].forEach(function (s, i) {
    $(s).addEventListener('change', function () { var v = parseInput($(s).value); st.adj[i ? 'interestTax' : 'pensionTax'] = v && !isNaN(v) ? Math.abs(v) : 0; $(s).classList.toggle('bad', isNaN(v)); if (st.res) recalc(); });
  });

  // ---------- paid: specification, rules ----------
  function renderPaid() {
    var r = st.res, Tl = T[lang], html = '';
    $('#paid-out').hidden = false; $('#spec-open').classList.remove('locked');
    $('#print-head').innerHTML = '<h2>' + esc(Tl.title(r)) + '</h2><p class="small">' + esc(Tl.printH(r)) + '</p>';
    A.CATS.forEach(function (c) {
      var rows = r.tx.filter(function (x) { return x.cat === c.id; }); if (!rows.length) return;
      var sum = rows.reduce(function (s, x) { return s + x.amount; }, 0);
      html += '<div class="catspec" data-cat="' + c.id + '"><h3>' + esc(cname(c.id)) + ' <span class="muted small">' + rows.length + '</span></h3><div class="tbl"><table class="spec"><tbody>' +
        rows.map(function (x) { return '<tr><td class="nowrap">' + esc(x.date) + '</td><td class="small">' + esc(x.account) + '</td><td>' + esc(x.text) + '</td><td class="num">' + esc(money(x.amount)) + '</td></tr>'; }).join('') +
        '</tbody><tfoot><tr><td colspan="3">' + esc(Tl.total) + '</td><td class="num">' + esc(money(sum)) + '</td></tr></tfoot></table></div></div>';
    });
    var og = X.groupOther(r);
    if (og.length) html += '<div class="catspec other"><h3>' + esc(Tl.otherH) + '</h3><div class="tbl"><table class="spec"><tbody>' + og.map(function (g) { return '<tr><td>' + esc(g.label) + '</td><td class="num">' + g.n + ' ' + esc(Tl.count) + '</td><td class="num">' + esc(money(g.sum)) + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    $('#spec').innerHTML = html;
    renderRules();
  }
  function renderRules() {
    var Tl = T[lang];
    $('#rules-list').innerHTML = st.userRules.length ? st.userRules.map(function (u, i) {
      return '<li><span class="muted small">' + esc(u.mode === 'same' ? Tl.ruleSame : Tl.ruleContains) + '</span> «' + esc(u.kw) + '» → <strong>' + esc(cname(u.cat)) + '</strong> <button type="button" class="link small rm" data-i="' + i + '">' + esc(Tl.remove) + '</button></li>';
    }).join('') : '<li class="muted small">' + esc(Tl.rulesNone) + '</li>';
  }
  function openPaid() { loadSavedRules(true); $('#paid-out').hidden = false; if (st.res) render(); }
  $('#spec-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: openPaid });
  $('#rules-list').addEventListener('click', function (e) { if (!e.target.classList.contains('rm')) return; st.userRules.splice(+e.target.dataset.i, 1); recalc(); });
  $('#rule-add').addEventListener('click', function () {
    if (!PW.isUnlocked()) return; var kw = $('#rule-kw').value.trim(); if (!kw) return;
    st.userRules = A.cleanRules([{ kw: kw, cat: $('#rule-cat').value, mode: 'contains' }].concat(st.userRules)); $('#rule-kw').value = ''; recalc();
  });

  // ---------- downloads ----------
  function save(bytes, name, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function msg(s, err) { var m = $('#dl-msg'); m.textContent = s; m.className = 'small ' + (err ? 'pw-msg err' : 'pw-msg ok'); }
  $('#dl-xlsx').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.res) return;
    window.XLSXW.build(X.sheets(st.res, lang, { created: new Date().toISOString().slice(0, 10) }), { title: 'Årsräkning från kontoutdrag', creator: 'Årsräkning från kontoutdrag' })
      .then(function (b) { save(b, T[lang].file(st.res), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg(t('xlsxOk')); })
      .catch(function (er) { msg(t('err') + er.message, true); });
  });
  $('#print').addEventListener('click', function () { if (!PW.isUnlocked()) return; document.body.classList.add('printing'); window.print(); setTimeout(function () { document.body.classList.remove('printing'); }, 500); });
  $('#rules-save').addEventListener('click', function () {
    if (!PW.isUnlocked()) return;
    try { localStorage.setItem(CFG.RULES_KEY, A.rulesToJson(st.userRules)); msg(T[lang].rulesSaved(st.userRules.length)); } catch (e) { msg(t('err') + e.message, true); }
  });
  $('#rules-export').addEventListener('click', function () { if (!PW.isUnlocked()) return; save(new TextEncoder().encode(A.rulesToJson(st.userRules)), t('rulesFile'), 'application/json'); });
  $('#rules-import').addEventListener('click', function () { if (PW.isUnlocked()) $('#rules-file').click(); });
  $('#rules-file').addEventListener('change', function () {
    var f = $('#rules-file').files[0]; if (!f) return;
    readBuf(f).then(function (x) {
      try { var rs = A.rulesFromJson(new TextDecoder().decode(x.buf)); st.userRules = A.cleanRules(rs.concat(st.userRules)); msg(T[lang].rulesLoaded(rs.length)); recalc(); }
      catch (e) { msg(t('rulesBad'), true); }
      $('#rules-file').value = '';
    });
  });
  /* saved rules (paid) are applied automatically when the feature is unlocked */
  function loadSavedRules(silent) {
    if (!PW.isUnlocked() || st.rulesLoaded) return;
    try { var s = localStorage.getItem(CFG.RULES_KEY); if (!s) return; var rs = A.rulesFromJson(s); if (!rs.length) return; st.userRules = A.cleanRules(st.userRules.concat(rs)); st.rulesLoaded = rs.length; if (st.res) { compute(); if (!silent) render(); } } catch (e) {}
  }
  loadSavedRules(false);
  fillCatSelects();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
