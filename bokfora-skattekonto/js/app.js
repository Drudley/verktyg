/* UI for Bokföra skattekontot. The file is read in the browser and never leaves it. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, S = window.SKATTEKONTO, fmt = K.fmt;
  var lang = 'sv';
  var EN = {
    h1: 'Book the Swedish tax account – from Skatteverket’s file to SIE',
    lead: 'Load the statement from the tax account (skattekonto). Every row gets its <strong>account</strong> – employer contributions, PAYE tax, VAT, preliminary tax, interest and payments – and the balance is <strong>reconciled</strong> against opening and closing balance. Download it all as a <strong>SIE file with one journal entry per row</strong> and import it into your bookkeeping software.',
    'calc-h': 'The statement', sample: 'Show example', clear: 'Clear',
    drop: 'Drop the file from the tax account here or click to choose', 'drop-p': 'CSV or Excel from the Skattekonto e-service, or the older .skv file.',
    'paste-s': '…or paste rows from the e-service', 'paste-ph': '2026-07-12  Employer contributions June 2026  -15 710', 'paste-go': 'Read the rows',
    'l-type': 'Type of business', 'o-ab': 'Limited company, economic association, partnership', 'o-ef': 'Sole trader', 'l-sk': 'Account for the tax account', 'l-bank': 'Bank account',
    'l-serie': 'Voucher series', 'l-nr': 'First voucher number', saved: 'The file is read only in this browser. Nothing is sent away.',
    'sum-h': 'Per account', 'rows-h': 'Transactions', 'rows-p': 'Change the account on a row if you book it differently. Rows without an account (yellow) need one before the file can be created.',
    'paid-h': 'SIE file, Excel and reconciliation',
    'paid-p': 'Get <strong>one journal entry per row</strong> as a SIE file to import into Fortnox, Visma, Bokio or other software, an <strong>Excel pack</strong> with postings and reconciliation, and a printout to keep with the books.',
    open: 'Show journal entries and files', 'ver-h': 'Journal entries', sie: 'Download SIE file', xlsx: 'Download Excel', print: 'Print reconciliation',
    'cta-h': 'More files for the books:', 'cta-p': '<a href="../stripe-till-sie/">Stripe to SIE</a> does the same with the payout report from Stripe, and <a href="../sie-till-excel/">SIE to Excel</a> shows the whole ledger as a spreadsheet when you want to check that 1630 is right.',
    'pw-h': 'SIE file, Excel and reconciliation', 'pw-p': 'Unlock the journal entries, the SIE file with one entry per row and the Excel pack. Reading, postings and the balance check are always free.'
  };
  var T = {
    sv: { result: 'Skattekontot', rows: 'Rader', inS: 'Insatt', outS: 'Dragit', net: 'Netto', date: 'Datum', text: 'Text', amount: 'Belopp', konto: 'Konto', name: 'Benämning', debit: 'Debet', kredit: 'Kredit', n: 'Antal', pick: '– välj konto –', sum: 'Summa', ver: 'Ver',
      meta: function (b) { return 'Period ' + b.from + ' – ' + b.to + ' · ' + b.n + ' rader'; },
      ok: function (b) { return 'Saldot stämmer: ingående ' + fmt(b.opening / 100, 2) + ' kr + rader ' + fmt(b.sum / 100, 2) + ' kr = utgående ' + fmt(b.closing / 100, 2) + ' kr.'; },
      okRun: 'Saldot stämmer mot det löpande saldot i filen.',
      diff: function (b) { return 'Saldot stämmer inte – skillnad ' + fmt(b.diff / 100, 2) + ' kr. Det saknas troligen rader i början eller slutet av perioden.'; },
      none: 'Filen saknar saldo – stäm av utgående saldo mot kontoutdraget själv.',
      flag: { unknown: function (n) { return n + (n === 1 ? ' rad saknar konto' : ' rader saknar konto') + ' – välj konto i listan nedan.'; }, skipped: function (n) { return n + (n === 1 ? ' rad' : ' rader') + ' i filen kunde inte läsas som transaktion och hoppades över.'; }, years: 'Perioden går över ett årsskifte – läs in en fil per räkenskapsår.' },
      statusOk: function (n, f) { return n + ' transaktioner inlästa' + (f ? ' från ' + f : '') + '.'; }, statusErr: 'Hittade inga transaktioner. Välj filen från e-tjänsten Skattekonto (CSV, Excel eller .skv) eller klistra in raderna.', reading: 'Läser filen…',
      xlsLegacy: 'Det gamla .xls-formatet kan inte läsas – spara som .xlsx eller CSV.', notReady: 'Välj konto för alla rader först.', verLead: function (n) { return n + ' verifikationer, en per rad.'; },
      xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte redovisningsrådgivning. Kontrollera konteringen mot hur ni bokför löner och moms.' },
    en: { result: 'Tax account', rows: 'Rows', inS: 'Paid in', outS: 'Charged', net: 'Net', date: 'Date', text: 'Text', amount: 'Amount', konto: 'Account', name: 'Name', debit: 'Debit', kredit: 'Credit', n: 'Count', pick: '– choose account –', sum: 'Total', ver: 'No',
      meta: function (b) { return 'Period ' + b.from + ' – ' + b.to + ' · ' + b.n + ' rows'; },
      ok: function (b) { return 'The balance matches: opening ' + fmt(b.opening / 100, 2) + ' kr + rows ' + fmt(b.sum / 100, 2) + ' kr = closing ' + fmt(b.closing / 100, 2) + ' kr.'; },
      okRun: 'The balance matches the running balance in the file.',
      diff: function (b) { return 'The balance does not match – difference ' + fmt(b.diff / 100, 2) + ' kr. Rows are probably missing at the start or end of the period.'; },
      none: 'The file has no balance – check the closing balance against the statement yourself.',
      flag: { unknown: function (n) { return n + (n === 1 ? ' row has no account' : ' rows have no account') + ' – choose one in the list below.'; }, skipped: function (n) { return n + (n === 1 ? ' row' : ' rows') + ' in the file could not be read as a transaction and were skipped.'; }, years: 'The period crosses a year-end – load one file per financial year.' },
      statusOk: function (n, f) { return n + ' transactions read' + (f ? ' from ' + f : '') + '.'; }, statusErr: 'No transactions found. Choose the file from the Skattekonto e-service (CSV, Excel or .skv) or paste the rows.', reading: 'Reading the file…',
      xlsLegacy: 'The old .xls format cannot be read – save as .xlsx or CSV.', notReady: 'Choose an account for every row first.', verLead: function (n) { return n + ' journal entries, one per row.'; },
      xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not accounting advice. Check the postings against how you book payroll and VAT.' }
  };
  function L() { return T[lang]; }
  var DEF = { type: 'AB', sk: '1630', bank: '1930', serie: 'A', nr: '1' };
  var st = { opt: Object.assign({}, DEF), parsed: null, file: '', overrides: {} };

  function collect() { var o = st.opt; o.type = $('#f-type').value; o.sk = $('#f-sk').value.trim(); o.bank = $('#f-bank').value.trim(); o.serie = $('#f-serie').value.trim(); o.nr = $('#f-nr').value.trim(); }
  function fill() { var o = st.opt; $('#f-type').value = o.type || 'AB'; $('#f-sk').value = o.sk || '1630'; $('#f-bank').value = o.bank || '1930'; $('#f-serie').value = o.serie || 'A'; $('#f-nr').value = o.nr || '1'; }
  function current() { collect(); return st.parsed ? S.build(st.parsed, Object.assign({}, st.opt, { overrides: st.overrides })) : null; }
  function stat(label, v, dec) { return '<div class="stat"><span>' + label + '</span><strong>' + fmt(v, dec) + (dec != null ? ' kr' : '') + '</strong></div>'; }
  function kr(o) { return fmt(o / 100, 2); }
  function accName(k, b) { return (b && b.accounts[k]) || S.ACCOUNTS[k] || ''; }
  function options(sel) {
    var t = L(), list = S.CHOICES.slice(); if (sel && list.indexOf(sel) < 0) list.unshift(sel);
    return '<option value="">' + t.pick + '</option>' + list.map(function (k) { return '<option value="' + k + '"' + (k === sel ? ' selected' : '') + '>' + k + ' ' + K.esc(S.ACCOUNTS[k] || '') + '</option>'; }).join('');
  }

  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    persist();
    if (!st.parsed) { res.hidden = true; return; }
    var b = current();
    if (!b.ok) { res.hidden = true; status.textContent = t.statusErr; status.className = 'status err'; return; }
    res.hidden = false; status.textContent = t.statusOk(b.n, st.file); status.className = 'status';
    $('#r-title').textContent = st.parsed.company || t.result;
    $('#r-meta').textContent = (st.parsed.orgnr ? st.parsed.orgnr + ' · ' : '') + t.meta(b);
    var ck = $('#check');
    if (b.check === 'ok') { ck.className = 'check ok'; ck.textContent = b.opening != null && b.closing != null ? t.ok(b) : t.okRun; }
    else if (b.check === 'diff') { ck.className = 'check err'; ck.textContent = t.diff(b); }
    else { ck.className = 'check warn'; ck.textContent = t.none; }
    $('#stats').innerHTML = stat(t.rows, b.n) + stat(t.inS, b.inSum / 100, 2) + stat(t.outS, -b.outSum / 100, 2) + stat(t.net, b.sum / 100, 2);
    var fl = [], yrs = b.from.slice(0, 4) !== b.to.slice(0, 4);
    if (b.unknown) fl.push(t.flag.unknown(b.unknown)); if (st.parsed.skipped) fl.push(t.flag.skipped(st.parsed.skipped)); if (yrs) fl.push(t.flag.years);
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>' : '';
    $('#sum-t thead').innerHTML = '<tr><th>' + t.konto + '</th><th>' + t.name + '</th><th class="num">' + t.n + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr>';
    var skRow = '<tr><td>' + b.sk + '</td><td>' + K.esc(accName(b.sk, b)) + '</td><td class="num">' + b.n + '</td><td class="num">' + kr(b.inSum) + '</td><td class="num">' + kr(-b.outSum) + '</td></tr>';
    $('#sum-t tbody').innerHTML = skRow + b.per.map(function (p) { return '<tr><td>' + p.konto + '</td><td>' + K.esc(p.name) + '</td><td class="num">' + p.n + '</td><td class="num">' + (p.debit ? kr(p.debit) : '') + '</td><td class="num">' + (p.credit ? kr(p.credit) : '') + '</td></tr>'; }).join('');
    var dT = b.inSum + b.per.reduce(function (a, p) { return a + p.debit; }, 0), cT = -b.outSum + b.per.reduce(function (a, p) { return a + p.credit; }, 0);
    $('#sum-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td></td><td class="num">' + kr(dT) + '</td><td class="num">' + kr(cT) + '</td></tr>';
    $('#rows-t thead').innerHTML = '<tr><th>' + t.date + '</th><th>' + t.text + '</th><th class="num">' + t.amount + '</th><th>' + t.konto + '</th></tr>';
    $('#rows-t tbody').innerHTML = b.rows.map(function (r) {
      return '<tr class="' + (r.konto ? (r.changed ? 'chg' : '') : 'unk') + '"><td>' + r.date + '</td><td>' + K.esc(r.text) + '</td><td class="num">' + kr(r.amount) + '</td><td><select data-i="' + r.i + '" aria-label="' + t.konto + '">' + options(r.konto) + '</select></td></tr>';
    }).join('');
    $$('#rows-t select').forEach(function (s) { s.addEventListener('change', function () { st.overrides[s.dataset.i] = s.value; render(); }); });
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(b);
  }
  function verHtml(b) {
    var t = L();
    if (!b.ready) return '<p>' + t.notReady + '</p>';
    return '<p>' + t.verLead(b.vouchers.length) + '</p><div class="tbl"><table id="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.date + '</th><th>' + t.text + '</th><th>' + t.debit + '</th><th>' + t.kredit + '</th><th class="num">' + t.amount + '</th></tr></thead><tbody>' +
      b.vouchers.map(function (v) { var a = v.trans[0].amount, d = a > 0 ? v.trans[0].konto : v.trans[1].konto, c = a > 0 ? v.trans[1].konto : v.trans[0].konto; return '<tr><td>' + K.esc(v.serie) + v.nr + '</td><td>' + v.date + '</td><td>' + K.esc(v.text.replace(/^Skattekonto: /, '')) + '</td><td>' + d + '</td><td>' + c + '</td><td class="num">' + kr(Math.abs(a)) + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">' + t.help + '</p>';
  }
  function renderPaid(b) { b = b || current(); if (b && b.ok) $('#ver').innerHTML = verHtml(b); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function ready() { var b = current(), t = L(); if (!b || !b.ok) return null; if (!b.ready) { $('#dl-msg').textContent = t.notReady; return null; } return b; }
  function base(b) { return 'skattekonto-' + b.from + '-' + b.to; }

  function downloadSie() {
    if (!PW.isUnlocked()) return; var b = ready(), t = L(); if (!b) return;
    var y = b.from.slice(0, 4);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.parsed.company || 'Företaget', orgnr: st.parsed.orgnr, program: 'Bokföra skattekontot (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10),
        rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: b.accounts, vouchers: b.vouchers }), base(b) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    if (!PW.isUnlocked()) return; var b = ready(), t = L(); if (!b) return;
    var sum = [[bold('Skattekontot – bokföringsunderlag')], ['Företag', st.parsed.company || ''], ['Organisationsnummer', st.parsed.orgnr || ''], ['Period', b.from + ' – ' + b.to], ['Företagsform', st.opt.type === 'EF' ? 'Enskild firma' : 'Aktiebolag m.fl.'], ['Konto för skattekontot', b.sk], [],
      ['Ingående saldo, kr', b.opening != null ? money(b.opening / 100) : ''], ['Summa rader, kr', money(b.sum / 100)], ['Utgående saldo, kr', b.closing != null ? money(b.closing / 100) : ''], ['Avstämning', b.check === 'ok' ? 'Stämmer' : b.check === 'diff' ? 'Skillnad ' + kr(b.diff) + ' kr' : 'Saldo saknas i filen'], [], [t.help]];
    var tx = [[bold('Ver'), bold('Datum'), bold('Text'), bold('Belopp'), bold('Debet'), bold('Kredit'), bold('Motkonto'), bold('Benämning')]];
    b.vouchers.forEach(function (v) { var a = v.trans[0].amount, mk = v.trans[1].konto; tx.push([v.serie + v.nr, v.date, v.text.replace(/^Skattekonto: /, ''), money(a / 100), a > 0 ? b.sk : mk, a > 0 ? mk : b.sk, mk, accName(mk, b)]); });
    var per = [[bold('Konto'), bold('Benämning'), bold('Rader'), bold('Debet'), bold('Kredit')], [b.sk, accName(b.sk, b), b.n, money(b.inSum / 100), money(-b.outSum / 100)]];
    b.per.forEach(function (p) { per.push([p.konto, p.name, p.n, money(p.debit / 100), money(p.credit / 100)]); });
    var src = [[bold('Källor')], ['Skatteverket: Skattekonto – betala och få tillbaka skatt'], ['https://www.skatteverket.se/foretag/skatterochavdrag/skattekontobetalaochfatillbaka.4.6a6688231259309ff1f800029122.html'], ['Skatteverket: Ränta på skattekontot (intäktsränta skattefri, kostnadsränta ej avdragsgill)'], ['https://www.skatteverket.se/foretag/skatterochavdrag/skattekontobetalaochfatillbaka/ranta.106.233f91f71260075abe8800010888.html'], ['BAS kontoplan 2026']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [32, 40] }, { name: 'Transaktioner', rows: tx, widths: [8, 12, 40, 14, 8, 8, 10, 44] }, { name: 'Per konto', rows: per, widths: [8, 48, 8, 14, 14] }, { name: 'Källor', rows: src, widths: [110] }], { title: 'Skattekontot' });
      K.download(buf, base(b) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    if (!PW.isUnlocked()) return; var b = ready(), t = L(); if (!b) return;
    $('#print-root').innerHTML = '<article class="card"><h1>' + K.esc((st.parsed.company ? st.parsed.company + ' – ' : '') + t.result + ' ' + b.from + ' – ' + b.to) + '</h1><p>' + K.esc($('#r-meta').textContent) + '</p><p><strong>' + K.esc($('#check').textContent) + '</strong></p>' + $('#sum-t').outerHTML + verHtml(b) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, { opt: st.opt }); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.opt) st.opt = Object.assign({}, DEF, d.opt); }
  function load(parsed, name) { st.parsed = parsed; st.file = name || ''; st.overrides = {}; $('#paid-out').hidden = true; $('#dl-msg').textContent = ''; render(); }
  function readFile(f) {
    if (!f) return; var t = L(); $('#status').textContent = t.reading; $('#status').className = 'status';
    f.arrayBuffer().then(function (ab) {
      var bytes = new Uint8Array(ab);
      if (window.XLSXR.isZip(bytes)) return window.XLSXR.readXLSX(bytes).then(function (w) { return S.parseRows((w.sheets[0] || { rows: [] }).rows); });
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF) throw new Error('xls-legacy');
      return S.parseText(window.CSV.decode(bytes).text);
    }).then(function (p) { load(p, f.name); }, function (e) { st.parsed = null; $('#result').hidden = true; $('#status').textContent = e && e.message === 'xls-legacy' ? t.xlsLegacy : t.statusErr; $('#status').className = 'status err'; });
  }

  var setLang = K.i18n(EN, function (l) { lang = l; render(); });
  var drop = $('#drop'), fileIn = $('#file');
  drop.addEventListener('click', function () { fileIn.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { readFile(e.dataTransfer.files[0]); });
  fileIn.addEventListener('change', function () { readFile(fileIn.files[0]); fileIn.value = ''; });
  $('#paste-go').addEventListener('click', function () { var v = $('#paste').value; if (v.trim()) load(S.parseText(v), ''); });
  $('#sample').addEventListener('click', function () { load(S.parseText(S.sampleCsv()), 'exempel.csv'); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { opt: Object.assign({}, DEF), parsed: null, file: '', overrides: {} }; fill(); $('#paste').value = ''; $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('#calc .grid input, #calc .grid select').forEach(function (f) { f.addEventListener('input', render); f.addEventListener('change', render); });
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#sie').addEventListener('click', downloadSie);
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  restore(); fill();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else render();
})();
