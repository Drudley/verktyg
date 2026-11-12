/* UI for Feriepengeforpligtelse – beregning til årsregnskabet. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, F = window.FERIE, fmt = K.fmt, esc = K.esc;
  var lang = 'da';
  var EN = {
    h1: 'Holiday pay liability in Denmark – calculation for the annual accounts',
    lead: 'Enter the balance sheet date and the employees. The tool works out <strong>earned and taken holiday days</strong> under concurrent holiday, the <strong>value per holiday day</strong>, the <strong>1 % holiday allowance</strong>, <strong>12.5 % holiday pay</strong> to FerieKonto, <strong>holiday taken in advance</strong> and the <strong>adjustment</strong> to post and deduct for tax.',
    'calc-h': 'Company and balance sheet date', sample: 'Show example', clear: 'Clear',
    'l-co': 'Company name', 'l-cvr': 'CVR number', 'l-end': 'Balance sheet date (last day of the financial year)', 'l-primo': 'Holiday pay owed at the start of the year (last year\u2019s liability), DKK',
    'l-dpm': 'Working days per month (day value = monthly salary ÷ this)', 'l-social': 'Add-on for other payroll costs during holiday, % (optional)', 'l-princip': 'Tax deduction',
    'o-p2': 'Principle 2 – deduct the change in the liability', 'o-p1': 'Principle 1 – deduct when the holiday is paid',
    'bk-h': 'Accounts for the posting proposal (optional – otherwise account names are used)', 'l-kCost': 'Holiday pay account (expense)', 'l-kLiab': 'Holiday pay owed account (liability)', 'l-kAsset': 'Prepaid holiday account (asset)',
    'p-h': 'Employees', add: 'Add employee',
    'h-people': 'Monthly salary is the holiday-qualifying salary including the employee\u2019s own pension contribution. Days earned are counted from 1 September (or the start date) to the balance sheet date – type the figure from the payroll system if it differs. Remaining holiday from the previous holiday year is days that can still be taken or were transferred by agreement.',
    saved: 'Your entries are only saved in this browser. Nothing is sent anywhere.',
    'per-h': 'Per employee', 'paid-h': 'Postings, note text and Excel',
    'paid-p': 'Get the <strong>posting proposal</strong> for the holiday pay adjustment and prepaid holiday as a <strong>CSV file</strong> to import into the bookkeeping system, a <strong>text for the accounting policies and tax treatment</strong> and an <strong>Excel sheet</strong> with the calculation per employee to keep as documentation. The texts are in Danish.',
    open: 'Show postings and note text', 'note-h': 'Text for the annual report', 'ver-h': 'Posting proposal', csv: 'Download postings (CSV)', xlsx: 'Download Excel calculation', print: 'Print',
    'cta-h': 'Own shares with foreign dividend tax?', 'cta-p': '<a href="../tilbagesoegning-udbytteskat/">Udbytteskat tilbage</a> shows how much you can reclaim from Norway, Germany, Switzerland, Finland and Sweden straight from the Nordnet file.',
    'pw-h': 'Postings, note text and Excel', 'pw-p': 'Unlock the posting proposal as CSV, the text for the annual report and the Excel calculation per employee. The holiday pay liability itself is always free.'
  };
  var T = {
    da: { result: 'Feriepengeforpligtelse', name: 'Navn', type: 'Ansættelse', tFun: 'Løn under ferie (funktionær)', tTime: 'Feriegodtgørelse 12,5 % (timeløn)', salary: 'Månedsløn, kr.', pension: 'Arbejdsgiverpension pr. måned, kr.', start: 'Ansat fra (tom = før ferieåret)', earned: 'Optjente dage i år (tom = beregnes)', prev: 'Restferie fra forrige ferieår, dage', taken: 'Afholdt i år, dage', fri: 'Feriefridage/6. ferieuge til gode, dage', paidT: 'Ferietillæg udbetalt i år, kr.', unpaid: 'Løn ikke afregnet til FerieKonto, kr.', remove: 'Fjern',
      days: 'Dage', dayV: 'Dagsværdi', ferie: 'Ferie', tillaeg: 'Ferietillæg', godtg: 'Feriegodtg.', total: 'I alt', sum: 'I alt',
      sTot: 'Skyldige feriepenge', sDays: 'Feriedage til gode', sTil: 'Ferietillæg', sGod: 'Feriegodtgørelse', sChg: 'Regulering i år', sFor: 'Forudbetalt ferie (aktiv)',
      meta: function (r) { return 'Statusdag ' + r.end + ' · ferieår ' + r.fa.label + ' · ' + r.rows.length + ' medarbejdere'; },
      ok: function (r) { return 'Skyldige feriepenge på statusdagen: ' + kr(r.totals.total) + ' kr. Reguleringen i forhold til primo er ' + sg(r.change) + ' kr.' + (r.principle === 2 ? ' Efter princip 2 er det også ' + (r.change >= 0 ? 'det skattemæssige fradrag' : 'den skattepligtige indtægt') + '.' : ' Efter princip 1 er der først fradrag, når ferien betales.'); },
      statusOk: function (n) { return n + (n === 1 ? ' medarbejder beregnet.' : ' medarbejdere beregnet.'); }, statusErr: 'Kontrollér de markerede felter (dato ÅÅÅÅ-MM-DD, beløb og dage).',
      res: function (x) { return x.type === 'time' ? 'Feriegodtgørelse ' + kr(x.godtg) + ' kr.' : fmt(x.days, 2) + ' dage × ' + kr(x.dayValue) + ' kr. + ferietillæg ' + kr(x.tillaeg) + ' kr. = ' + kr(x.total) + ' kr.' + (x.forskud ? ' · forskud ' + kr(x.forskud) + ' kr.' : ''); },
      flag: { forskud: 'Medarbejder %n har holdt mere ferie end optjent – tilgodehavendet vises som et aktiv og modregnes ikke.', prev: 'Medarbejder %n har mere end 5 dages restferie fra forrige ferieår – kontrollér, om den 5. ferieuge er overført efter aftale (§ 21).', override: 'Medarbejder %n: optjente dage er rettet manuelt.', future: 'Medarbejder %n er ansat efter statusdagen.', asset: 'Forudbetalt ferie bogføres som et aktiv. Kontrollér den skattemæssige behandling af ferie holdt på forskud.' },
      konto: 'Konto', text: 'Tekst', debit: 'Debet', kredit: 'Kredit', postLead: function (n) { return n ? n + (n === 1 ? ' postering' : ' posteringer') + ' pr. statusdagen.' : 'Ingen regulering – forpligtelsen er uændret.'; },
      csvOk: 'CSV-filen er hentet.', xlsxOk: 'Excel-filen er hentet.', fail: 'Kunne ikke lave filen.', help: 'Hjælpemiddel, ikke rådgivning. Stem af med lønsystemets feriesaldi.' },
    en: { result: 'Holiday pay liability', name: 'Name', type: 'Employment', tFun: 'Paid holiday (salaried)', tTime: 'Holiday pay 12.5 % (hourly)', salary: 'Monthly salary, DKK', pension: 'Employer pension per month, DKK', start: 'Employed from (blank = before the holiday year)', earned: 'Days earned this year (blank = calculated)', prev: 'Remaining days from previous holiday year', taken: 'Days taken this year', fri: 'Extra holiday days owed (6th week)', paidT: 'Holiday allowance paid this year, DKK', unpaid: 'Salary not yet settled to FerieKonto, DKK', remove: 'Remove',
      days: 'Days', dayV: 'Day value', ferie: 'Holiday', tillaeg: 'Allowance', godtg: 'Holiday pay', total: 'Total', sum: 'Total',
      sTot: 'Holiday pay owed', sDays: 'Holiday days owed', sTil: 'Holiday allowance', sGod: 'Holiday pay (hourly)', sChg: 'Adjustment this year', sFor: 'Prepaid holiday (asset)',
      meta: function (r) { return 'Balance sheet date ' + r.end + ' · holiday year ' + r.fa.label + ' · ' + r.rows.length + ' employees'; },
      ok: function (r) { return 'Holiday pay owed at the balance sheet date: DKK ' + kr(r.totals.total) + '. The adjustment against the opening balance is DKK ' + sg(r.change) + '.' + (r.principle === 2 ? ' Under principle 2 this is also the tax ' + (r.change >= 0 ? 'deduction' : 'income') + '.' : ' Under principle 1 the deduction comes when the holiday is paid.'); },
      statusOk: function (n) { return n + (n === 1 ? ' employee calculated.' : ' employees calculated.'); }, statusErr: 'Check the marked fields (date YYYY-MM-DD, amounts and days).',
      res: function (x) { return x.type === 'time' ? 'Holiday pay DKK ' + kr(x.godtg) : fmt(x.days, 2) + ' days × DKK ' + kr(x.dayValue) + ' + allowance DKK ' + kr(x.tillaeg) + ' = DKK ' + kr(x.total) + (x.forskud ? ' · advance DKK ' + kr(x.forskud) : ''); },
      flag: { forskud: 'Employee %n has taken more holiday than earned – the receivable is shown as an asset and not offset.', prev: 'Employee %n has more than 5 days left from the previous holiday year – check that the 5th week was transferred by agreement (s. 21).', override: 'Employee %n: days earned were entered manually.', future: 'Employee %n starts after the balance sheet date.', asset: 'Prepaid holiday is posted as an asset. Check the tax treatment of holiday taken in advance.' },
      konto: 'Account', text: 'Text', debit: 'Debit', kredit: 'Credit', postLead: function (n) { return n ? n + ' posting(s) at the balance sheet date.' : 'No adjustment – the liability is unchanged.'; },
      csvOk: 'The CSV file has been downloaded.', xlsxOk: 'The Excel file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not advice. Reconcile with the payroll system\u2019s holiday balances.' }
  };
  function L() { return T[lang]; }
  function kr(o) { return fmt(o / 100, 2); }
  function sg(o) { return (o > 0 ? '+' : '') + kr(o); }
  var CKEYS = ['name', 'cvr', 'end', 'primo', 'dpm', 'social', 'princip', 'kCost', 'kLiab', 'kAsset'];
  var PKEYS = ['name', 'type', 'salary', 'pension', 'start', 'earned', 'prev', 'taken', 'fri', 'paidT', 'unpaid'];
  function emptyP() { return { name: '', type: 'fun', salary: '', pension: '', start: '', earned: '', prev: '', taken: '', fri: '', paidT: '', unpaid: '' }; }
  function emptyC() { return { dpm: '21,67', princip: '2' }; }
  var st = { company: emptyC(), people: [emptyP()] };
  function collect() {
    CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) st.company[k] = e.value.trim(); });
    st.people = $$('#people .person').map(function (row) { var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o; });
    if (!st.people.length) st.people = [emptyP()];
  }
  function fillCompany() { var c = st.company, d = emptyC(); CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) e.value = c[k] != null && c[k] !== '' ? c[k] : (d[k] || ''); }); }
  function inp(k, label, ph, mode) { return '<label data-for="' + k + '"><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="' + (mode || 'decimal') + '" placeholder="' + (ph || '') + '" autocomplete="off"></label>'; }
  function rowEl(p, i) {
    var t = L(), el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.name + '</span><input type="text" data-k="name" placeholder="' + t.name + '" autocomplete="off"></label>' +
      '<label><span class="sr">' + t.type + '</span><select data-k="type"><option value="fun">' + t.tFun + '</option><option value="time">' + t.tTime + '</option></select></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid g-fun">' + inp('salary', t.salary, '40.000') + inp('pension', t.pension, '0') + inp('start', t.start, 'ÅÅÅÅ-MM-DD', 'numeric') + inp('earned', t.earned, '') + inp('prev', t.prev, '0') + inp('taken', t.taken, '0') + inp('fri', t.fri, '0') + inp('paidT', t.paidT, '0') + '</div>' +
      '<div class="grid g-time">' + inp('unpaid', t.unpaid, '0') + '</div><p class="res"></p>';
    $$('[data-k]', el).forEach(function (f) { var v = p[f.dataset.k]; f.value = v != null && v !== '' ? v : (f.dataset.k === 'type' ? 'fun' : ''); });
    function vis() { var time = $('[data-k=type]', el).value === 'time'; $('.g-fun', el).hidden = time; $('.g-time', el).hidden = !time; }
    vis();
    $('[data-k=type]', el).addEventListener('change', function () { vis(); render(); });
    $('.del', el).addEventListener('click', function () { collect(); st.people.splice(+el.dataset.i, 1); if (!st.people.length) st.people = [emptyP()]; paint(); render(); });
    $$('input', el).forEach(function (f) { f.addEventListener('input', render); });
    return el;
  }
  function paint() { var box = $('#people'); box.innerHTML = ''; st.people.forEach(function (p, i) { box.appendChild(rowEl(p, i)); }); }
  function current() { collect(); return F.calc(st); }
  function isEmpty() { return !String(st.company.end || '').trim() && st.people.every(function (p) { return ['name', 'salary', 'unpaid', 'taken'].every(function (k) { return !String(p[k] || '').trim(); }); }); }
  function stat(label, v, unit) { return '<div class="stat"><span>' + label + '</span><strong>' + v + (unit == null ? ' kr.' : unit) + '</strong></div>'; }
  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    $$('#calc .bad').forEach(function (x) { x.classList.remove('bad'); });
    $$('#people .person').forEach(function (e) { $('.res', e).textContent = ''; });
    persist();
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    var r = current(), rows = $$('#people .person');
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      r.errors.forEach(function (k) { var f = $('#f-' + k); if (f) f.classList.add('bad'); });
      r.bad.forEach(function (i) { var e = rows[i]; if (!e) return; r.rows[i].errors.forEach(function (k) { var f = $('[data-k=' + k + ']', e); if (f) f.classList.add('bad'); }); });
      return;
    }
    r.rows.forEach(function (x, i) { if (rows[i]) $('.res', rows[i]).textContent = t.res(x); });
    res.hidden = false; status.textContent = t.statusOk(r.rows.length); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.cvr ? 'CVR ' + st.company.cvr + ' · ' : '') + t.meta(r);
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(r);
    var X = r.totals;
    $('#stats').innerHTML = stat(t.sTot, kr(X.total)) + stat(t.sDays, fmt(X.days, 2), '') + stat(t.sTil, kr(X.tillaeg)) + stat(t.sGod, kr(X.godtg)) + stat(t.sChg, sg(r.change)) + stat(t.sFor, kr(X.forskud));
    var fl = r.warnings.map(function (w) { return t.flag[w.k].replace('%n', String(w.n)); });
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    $('#per-t thead').innerHTML = '<tr><th>' + t.name + '</th><th class="num">' + t.days + '</th><th class="num">' + t.dayV + '</th><th class="num">' + t.ferie + '</th><th class="num">' + t.tillaeg + '</th><th class="num">' + t.godtg + '</th><th class="num">' + t.total + '</th></tr>';
    $('#per-t tbody').innerHTML = r.rows.map(function (x) {
      if (x.type === 'time') return '<tr><td>' + esc(x.name) + '<br><span class="muted small">12,5 % × ' + kr(x.unpaid) + '</span></td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">–</td><td class="num">' + kr(x.godtg) + '</td><td class="num">' + kr(x.total) + '</td></tr>';
      return '<tr><td>' + esc(x.name) + '<br><span class="muted small">' + fmt(x.earned, 2) + (x.prev ? ' + ' + fmt(x.prev, 2) : '') + ' − ' + fmt(x.taken, 2) + (x.fri ? ' · fri ' + fmt(x.fri, 2) : '') + '</span></td><td class="num">' + fmt(x.days, 2) + '</td><td class="num">' + kr(x.dayValue) + '</td><td class="num">' + kr(x.ferieValue + x.friValue + x.social) + '</td><td class="num">' + kr(x.tillaeg) + '</td><td class="num">–</td><td class="num">' + kr(x.total) + '</td></tr>';
    }).join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td class="num">' + fmt(X.days, 2) + '</td><td></td><td class="num">' + kr(X.ferie + X.fri + X.social) + '</td><td class="num">' + kr(X.tillaeg) + '</td><td class="num">' + kr(X.godtg) + '</td><td class="num">' + kr(X.total) + '</td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  /* Danish note text (always Danish – it goes into the annual report) */
  function noteText(r) {
    var X = r.totals, out = [];
    out.push('Anvendt regnskabspraksis: Skyldige feriepenge omfatter optjent, ikke afholdt ferie med løn for medarbejdere ansat med løn under ferie, opgjort pr. medarbejder som antal feriedage til gode gange den aktuelle dagsløn inklusive arbejdsgiverbetalt pension, samt optjent, ikke udbetalt ferietillæg på 1 % og feriegodtgørelse på 12,5 % af løn, der endnu ikke er afregnet til FerieKonto. Ferie afholdt på forskud indregnes som et tilgodehavende.');
    out.push('Skyldige feriepenge pr. ' + r.end + ' udgør ' + kr(X.total) + ' kr. (primo ' + kr(r.primo) + ' kr.), heraf ferie ' + kr(X.ferie + X.fri + X.social) + ' kr., ferietillæg ' + kr(X.tillaeg) + ' kr. og feriegodtgørelse ' + kr(X.godtg) + ' kr.' + (X.forskud ? ' Forudbetalt ferie udgør ' + kr(X.forskud) + ' kr.' : ''));
    out.push(r.principle === 2 ? 'Skattemæssig behandling: Virksomheden fradrager ændringen i feriepengeforpligtelsen i optjeningsåret (princip 2, Den juridiske vejledning C.C.2.2.2.1.3). Årets ' + (r.change >= 0 ? 'fradrag' : 'indtægt') + ' udgør ' + kr(Math.abs(r.change)) + ' kr.' : 'Skattemæssig behandling: Virksomheden fradrager feriepenge, når de betales (princip 1, Den juridiske vejledning C.C.2.2.2.1.3). Ændringen i forpligtelsen på ' + sg(r.change) + ' kr. reguleres derfor i den skattepligtige indkomst.');
    return out;
  }
  function postTable(r) {
    var t = L();
    return '<div class="tbl"><table class="ver-t"><thead><tr><th>' + t.text + '</th><th>' + t.konto + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      r.postings.map(function (p) { return p.lines.map(function (x, j) { var a = x.amount / 100; return '<tr><td>' + (j ? '' : esc(p.text)) + '</td><td>' + esc(x.konto) + '</td><td class="num">' + (a > 0 ? fmt(a, 2) : '') + '</td><td class="num">' + (a < 0 ? fmt(-a, 2) : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>';
  }
  function renderPaid(r) {
    r = r || current(); if (!r.ok) return;
    $('#note').innerHTML = noteText(r).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('');
    $('#ver').innerHTML = '<p>' + L().postLead(r.postings.length) + '</p>' + (r.postings.length ? postTable(r) : '') + '<p class="hint">' + L().help + '</p>';
  }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function ready() { if (!PW.isUnlocked()) return null; var r = current(); return r.ok && !isEmpty() ? r : null; }
  function base(r) { return 'feriepengeforpligtelse-' + r.end; }
  function csvAmount(o) { return (o < 0 ? '-' : '') + fmt(Math.abs(o) / 100, 2).replace(/\./g, ''); }
  function downloadCsv() {
    var r = ready(), t = L(); if (!r) return;
    var lines = ['Dato;Bilag;Konto;Tekst;Beløb'];
    r.postings.forEach(function (p, i) { p.lines.forEach(function (x) { lines.push([r.end, 'FP' + (i + 1), x.konto, p.text.replace(/;/g, ','), csvAmount(x.amount)].join(';')); }); });
    try { K.download('\ufeff' + lines.join('\r\n') + '\r\n', base(r) + '-posteringer.csv', 'text/csv;charset=utf-8'); $('#dl-msg').textContent = t.csvOk; } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    var r = ready(), t = L(); if (!r) return;
    var c = st.company, X = r.totals;
    var sum = [[bold('Feriepengeforpligtelse')], ['Virksomhed', c.name || ''], ['CVR', c.cvr || ''], ['Statusdag', r.end], ['Ferieår', r.fa.label + ' (' + r.fa.start + ' – ' + r.fa.end + ')'], ['Arbejdsdage pr. måned', r.dpm], ['Tillæg for øvrige lønomkostninger, %', r.socialPct], [],
      ['Ferie (dage til gode × dagsværdi)', money((X.ferie + X.social) / 100)], ['Feriefridage / 6. ferieuge', money(X.fri / 100)], ['Ferietillæg 1 %', money(X.tillaeg / 100)], ['Feriegodtgørelse 12,5 % (timelønnede)', money(X.godtg / 100)], [bold('Skyldige feriepenge i alt'), money(X.total / 100)],
      ['Skyldige feriepenge primo', money(r.primo / 100)], [bold('Regulering i året'), money(r.change / 100)], ['Forudbetalt ferie (aktiv)', money(X.forskud / 100)], ['Skattemæssigt princip', r.principle], ['Skattemæssigt fradrag (+) / indtægt (−) efter princip 2', money(r.taxDeduct / 100)], [], [T.da.help]];
    var rows = [[bold('Navn'), bold('Type'), bold('Månedsløn'), bold('Arb.pension'), bold('Ansat fra'), bold('Hele måneder'), bold('Optjent'), bold('Restferie'), bold('Afholdt'), bold('Dage til gode'), bold('Dagsværdi'), bold('Ferie'), bold('Feriefridage'), bold('Mdr. ferietillæg'), bold('Ferietillæg'), bold('Ikke afregnet løn'), bold('Feriegodtgørelse'), bold('Forskud'), bold('I alt')]];
    r.rows.forEach(function (x, i) {
      var p = st.people[i] || {};
      if (x.type === 'time') rows.push([x.name, 'Timeløn 12,5 %', '', '', '', '', '', '', '', '', '', '', '', '', '', money(x.unpaid / 100), money(x.godtg / 100), '', money(x.total / 100)]);
      else rows.push([x.name, 'Løn under ferie', money(x.salary / 100), money(x.pension / 100), p.start || '', x.months, x.earned, x.prev, x.taken, x.days, money(x.dayValue / 100), money((x.ferieValue + x.social) / 100), money(x.friValue / 100), x.tMonths, money(x.tillaeg / 100), '', '', money(x.forskud / 100), money(x.total / 100)]);
    });
    var post = [[bold('Bilag'), bold('Dato'), bold('Konto'), bold('Tekst'), bold('Debet'), bold('Kredit')]];
    r.postings.forEach(function (p, i) { p.lines.forEach(function (x) { var a = x.amount / 100; post.push(['FP' + (i + 1), r.end, x.konto, p.text, a > 0 ? money(a) : '', a < 0 ? money(-a) : '']); }); });
    var note = [[bold('Tekst til årsrapporten')]].concat(noteText(r).map(function (x) { return [x]; }));
    var src = [[bold('Kilder')], ['Ferieloven, LBK nr. 152 af 20/02/2024, §§ 4–7, 16–19, 21'], ['https://www.retsinformation.dk/eli/lta/2024/152'], ['Den juridiske vejledning C.C.2.2.2.1.3'], ['https://info.skat.dk/data.aspx?oid=2293197']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammenfatning', rows: sum, widths: [52, 22] }, { name: 'Medarbejdere', rows: rows, widths: [24, 16, 12, 12, 12, 9, 9, 9, 9, 10, 11, 12, 12, 10, 12, 14, 14, 12, 12] }, { name: 'Posteringer', rows: post, widths: [7, 12, 18, 50, 14, 14] }, { name: 'Note', rows: note, widths: [140] }, { name: 'Kilder', rows: src, widths: [100] }], { title: 'Feriepengeforpligtelse' });
      K.download(buf, base(r) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    var r = ready(); if (!r) return;
    $('#print-root').innerHTML = '<article class="card"><h1>Feriepengeforpligtelse ' + r.end + '</h1>' + noteText(r).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + $('#per-t').outerHTML + (r.postings.length ? postTable(r) : '') + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.people) && d.people.length) { st = d; return true; } return false; }
  var setLang = K.i18n(EN, function (l) { lang = l === 'en' ? 'en' : 'da'; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.people.push(emptyP()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = F.sample(); fillCompany(); paint(); render(); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { company: emptyC(), people: [emptyP()] }; fillCompany(); paint(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('#calc input[id^="f-"]').forEach(function (f) { f.addEventListener('input', render); });
  $('#f-princip').addEventListener('change', render);
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#csv').addEventListener('click', downloadCsv);
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'da' : 'en'); });
  restore(); fillCompany(); paint();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else render();
})();
