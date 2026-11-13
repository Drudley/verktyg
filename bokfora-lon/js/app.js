/* UI for Bokföra lön – lönelista till SIE och arbetsgivardeklaration. Everything is computed in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, S = window.LON, fmt = K.fmt, esc = K.esc;
  var lang = 'sv';
  var EN = {
    'bundle-p': '<a href="https://drudley.gumroad.com/l/byra" target="_blank" rel="noopener noreferrer">All tools for accounting firms – 990 SEK/year + VAT</a>. One licence key unlocks every tool, including the Danish ones and new tools as they are added.',
    'rel-h': 'Related tools', 'rel-all': 'All tools',
    h1: 'Book payroll – from a pay list to SIE and the employer declaration',
    lead: 'Paste the pay list (pay date, name, birth year or personal ID number, gross pay, benefits and tax withheld). You get <strong>employer contributions at the right rate per person</strong> – including the temporary <strong>20.81 % for ages 19–23</strong> and 10.21 % for 67+ – the <strong>amounts for the employer declaration (AGI)</strong> with deadlines, and the <strong>journal entries as a SIE file</strong>.',
    'calc-h': 'The pay list', sample: 'Show example', clear: 'Clear', 'l-rows': 'Paste from Excel or load a CSV file (one row per payment)',
    'rows-p': 'Columns: Pay date (2026-04-25 or 2026-04) · Name · Birth year or personal ID number · Type (salaried, collective, director or a BAS account) · Gross pay · Benefits · Tax withheld. A header row is optional.',
    file: 'Load CSV file', 'l-co': 'Company name (for the SIE file)', 'l-orgnr': 'Company registration number', 'l-day': 'Pay day when only the month is given', 'l-lon': 'Default salary account', 'l-bank': 'Bank account', 'l-tax': 'Personnel tax', 'l-fee': 'Employer contributions (cost)', 'l-feedebt': 'Employer contributions (liability)', 'l-skvon': 'Book the tax account debit on the due date', 'o-yes': 'Yes', 'o-no': 'No', 'l-skv': 'Tax account', 'l-serie': 'Voucher series', 'l-nr': 'First voucher number',
    saved: 'The pay list is read only in this browser. Nothing is sent away – not even personal ID numbers.',
    'm-h': 'Per pay month', 'paid-h': 'Journal entries, SIE file, AGI amounts and Excel',
    'paid-p': 'Get the <strong>journal entries</strong> (salary on the pay date, contributions at month end, the tax account debit on the due date) as a SIE file for Fortnox, Visma, Bokio and others, the <strong>amounts for the employer declaration</strong> per month – boxes 487 and 497, fields 011, 012, 013 and 001 per employee, and Skatteverket\'s calculation per rate (420/430, 7001/9001, 422/432) to check against – and an <strong>Excel pack</strong>.',
    open: 'Show entries and files', 'ver-h': 'Journal entries', 'agi-h': 'For the employer declaration (AGI)', sie: 'Download SIE file', xlsx: 'Download Excel', print: 'Print',
    'cta-h': 'More for the year-end:', 'cta-p': '<a href="../semesterloneskuld/">Holiday pay liability</a> computes the accrual for the accounts, and <a href="../bokfora-skattekonto/">Book the tax account</a> posts the Skatteverket statement row by row.',
    'pw-h': 'SIE file, AGI amounts and Excel', 'pw-p': 'Unlock the journal entries, the SIE file, the employer declaration amounts per month and employee, and the Excel pack. The monthly summary is always free.'
  };
  var T = {
    sv: { result: 'Lönelista', month: 'Månad', people: 'Anställda', gross: 'Bruttolön', ben: 'Förmåner', tax: 'Skatteavdrag', fee: 'Arbetsgivaravgifter', cost: 'Lönekostnad', due: 'Deklarera och betala senast', sum: 'Summa', konto: 'Konto', name: 'Benämning', debit: 'Debet', kredit: 'Kredit', ver: 'Ver', emp: 'Anställd', born: 'Född', cat: 'Avgift',
      sM: 'Lönemånader', sGross: 'Bruttolön', sTax: 'Skatteavdrag', sFee: 'Arbetsgivaravgifter', sCost: 'Total lönekostnad',
      meta: function (b) { return 'Löner utbetalda ' + b.from + ' – ' + b.to + ' · ' + b.rows.length + ' rader · högst ' + b.totals.people + ' anställda per månad'; },
      ok: function (b) { return 'Arbetsgivaravgifter ' + kr0(b.totals.fee) + ' kr på bruttolön ' + kr0(b.totals.b) + ' kr' + (b.totals.f + b.totals.c ? ' och förmåner ' + kr0(b.totals.f + b.totals.c) + ' kr' : '') + ', skatteavdrag ' + kr0(b.totals.s) + ' kr – räknat per avgiftssats och utan ören, som i arbetsgivardeklarationen.'; },
      flag: { year: function (w) { return w.year + ' rader med utbetalning före 2026 eller efter september 2027 lämnas utanför – avgiftsreglerna för dem finns inte i verktyget.'; }, noBirth: function (w) { return 'Födelseår saknas för ' + w.noBirth.join(', ') + ' – full avgift 31,42 % används.'; }, negNet: function (w) { return 'Skatteavdraget är större än bruttolönen den ' + w.negNet.join(', ') + ' – kontrollera förmåner och skatt.'; }, ore: function (w) { return w.ore + ' rader har ören. Arbetsgivardeklarationen redovisas i hela kronor, så ören har tagits bort i AGI-beloppen.'; }, guessedDue: function (w) { return 'Sista dag för ' + w.guessedDue.join(', ') + ' är räknad som den 12:e (17:e i januari och augusti), flyttad till vardag – kontrollera mot Skatteverkets kalender.'; }, skipped: function (w) { return w.skipped + ' rader kunde inte läsas (datum eller belopp saknas).'; }, youth: function () { return 'Unga 19–23 år: 20,81 % på upp till 25 000 kr per månad, full avgift på resten (lön utbetald 1 april 2026–30 september 2027).'; } },
      statusOk: function (n, f) { return n + (n === 1 ? ' rad inläst' : ' rader inlästa') + (f ? ' från ' + f : '') + '.'; }, statusErr: 'Hittade inga lönerader. Varje rad behöver minst utbetalningsdag och bruttolön.', reading: 'Läser filen…',
      verLead: function (n) { return n + (n === 1 ? ' verifikation' : ' verifikationer') + ': lönen på utbetalningsdagen, avgifterna sista dagen i månaden och dragningen från skattekontot på deklarationsdagen.'; },
      agiLead: 'Belopp i hela kronor per utbetalningsmånad. Du fyller i ruta 487 och 497 och individuppgifterna. Underlag och avgift per avgiftssats (420/430, 7001/9001 …) räknar Skatteverket själv fram ur individuppgifterna – tabellen visar samma uträkning så att du kan stämma av ruta 487. Individuppgift: fält 011 kontant bruttolön, 012 övriga förmåner, 013 bilförmån och 001 avdragen skatt.',
      head: 'Skatteverkets uträkning per avgiftssats', under: 'Underlag', avg: 'Avgift', r487: 'Ruta 487 – summa arbetsgivaravgifter', r497: 'Ruta 497 – summa skatteavdrag', over: function (n) { return ' (varav ' + fmt(n, 0) + ' kr över 25 000 kr med full avgift)'; },
      xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte lönerådgivning. Skatteavdraget räknas inte ut här – ta det från skattetabellen eller skattebeskedet.' },
    en: { result: 'Pay list', month: 'Month', people: 'Employees', gross: 'Gross pay', ben: 'Benefits', tax: 'Tax withheld', fee: 'Employer contributions', cost: 'Payroll cost', due: 'File and pay by', sum: 'Total', konto: 'Account', name: 'Name', debit: 'Debit', kredit: 'Credit', ver: 'No', emp: 'Employee', born: 'Born', cat: 'Rate',
      sM: 'Pay months', sGross: 'Gross pay', sTax: 'Tax withheld', sFee: 'Employer contributions', sCost: 'Total payroll cost',
      meta: function (b) { return 'Salaries paid ' + b.from + ' – ' + b.to + ' · ' + b.rows.length + ' rows · up to ' + b.totals.people + ' employees per month'; },
      ok: function (b) { return 'Employer contributions ' + kr0(b.totals.fee) + ' kr on gross pay ' + kr0(b.totals.b) + ' kr' + (b.totals.f + b.totals.c ? ' and benefits ' + kr0(b.totals.f + b.totals.c) + ' kr' : '') + ', tax withheld ' + kr0(b.totals.s) + ' kr – computed per rate without öre, as in the employer declaration.'; },
      flag: { year: function (w) { return w.year + ' rows paid before 2026 or after September 2027 are left out – the tool has no rates for them.'; }, noBirth: function (w) { return 'Birth year missing for ' + w.noBirth.join(', ') + ' – the full 31.42 % is used.'; }, negNet: function (w) { return 'Tax withheld exceeds gross pay on ' + w.negNet.join(', ') + ' – check benefits and tax.'; }, ore: function (w) { return w.ore + ' rows have öre. The declaration is in whole kronor, so öre were dropped in the AGI amounts.'; }, guessedDue: function (w) { return 'The deadline for ' + w.guessedDue.join(', ') + ' is computed as the 12th (17th in January and August), moved to a weekday – check Skatteverket\'s calendar.'; }, skipped: function (w) { return w.skipped + ' rows could not be read (date or amount missing).'; }, youth: function () { return 'Ages 19–23: 20.81 % on up to 25,000 kr a month, full rate on the rest (pay from 1 April 2026 to 30 September 2027).'; } },
      statusOk: function (n, f) { return n + ' row' + (n === 1 ? '' : 's') + ' read' + (f ? ' from ' + f : '') + '.'; }, statusErr: 'No pay rows found. Each row needs at least a pay date and gross pay.', reading: 'Reading the file…',
      verLead: function (n) { return n + ' journal entr' + (n === 1 ? 'y' : 'ies') + ': salary on the pay date, contributions on the last day of the month and the tax account debit on the due date.'; },
      agiLead: 'Whole kronor per pay month. You enter boxes 487 and 497 and the per-employee fields. The base and contribution per rate (420/430, 7001/9001 …) are computed by Skatteverket from the per-employee data – the table shows the same calculation so you can check box 487. Per employee: field 011 cash gross pay, 012 other benefits, 013 car benefit and 001 tax withheld.',
      head: "Skatteverket's calculation per rate", under: 'Base', avg: 'Contribution', r487: 'Box 487 – total employer contributions', r497: 'Box 497 – total tax withheld', over: function (n) { return ' (of which ' + fmt(n, 0) + ' kr above 25,000 kr at the full rate)'; },
      xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not payroll advice. Tax withheld is not computed here – take it from the tax table or the employee\'s tax decision.' }
  };
  function L() { return T[lang]; }
  function kr(o) { return fmt(o / 100, 2); }
  function kr0(n) { return fmt(n, 0); }
  var KEYS = ['co', 'orgnr', 'day', 'lon', 'bank', 'tax', 'fee', 'feedebt', 'skvon', 'skv', 'serie', 'nr'];
  var DEF = { day: '25', lon: '7210', bank: '1930', tax: '2710', fee: '7510', feedebt: '2731', skvon: '1', skv: '1630', serie: 'A', nr: '1' };
  var st = { opt: Object.assign({}, DEF), text: '', file: '' };
  function collect() { KEYS.forEach(function (k) { st.opt[k] = $('#f-' + k).value.trim(); }); st.text = $('#rows').value; }
  function fill() { KEYS.forEach(function (k) { $('#f-' + k).value = st.opt[k] != null && st.opt[k] !== '' ? st.opt[k] : (DEF[k] || ''); }); $('#rows').value = st.text || ''; }
  function current() { collect(); var o = st.opt; var p = S.parseText(st.text, { day: o.day }); return { p: p, b: p.ok ? S.build(p, { lon: o.lon, bank: o.bank, tax: o.tax, fee: o.fee, feeDebt: o.feedebt, skvOn: o.skvon, skv: o.skv, serie: o.serie, nr: o.nr }) : null }; }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + v + '</strong></div>'; }
  function catName(c) { return S.CAT[c][lang]; }
  function render() {
    var t = L(), res = $('#result'), status = $('#status'), c = current(), b = c.b;
    persist();
    if (!st.text.trim()) { res.hidden = true; status.textContent = ''; return; }
    if (!b || !b.ok) { res.hidden = true; status.textContent = t.statusErr + (b && b.warn.year ? ' ' + t.flag.year(b.warn) : ''); status.className = 'status err'; return; }
    res.hidden = false; status.textContent = t.statusOk(c.p.rows.length, st.file); status.className = 'status';
    $('#r-title').textContent = st.opt.co || t.result;
    $('#r-meta').textContent = (st.opt.orgnr ? st.opt.orgnr + ' · ' : '') + t.meta(b);
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(b);
    $('#stats').innerHTML = stat(t.sM, String(b.months.length)) + stat(t.sGross, kr0(b.totals.b) + ' kr') + stat(t.sTax, kr0(b.totals.s) + ' kr') + stat(t.sFee, kr0(b.totals.fee) + ' kr') + stat(t.sCost, fmt(b.totals.cost, 0) + ' kr');
    var w = b.warn, fl = [];
    if (w.skipped) fl.push(t.flag.skipped(w)); if (w.year) fl.push(t.flag.year(w)); if (w.noBirth.length) fl.push(t.flag.noBirth(w)); if (w.negNet.length) fl.push(t.flag.negNet(w)); if (w.ore) fl.push(t.flag.ore(w)); if (w.guessedDue.length) fl.push(t.flag.guessedDue(w));
    if (b.months.some(function (m) { return m.lines.some(function (l) { return l.cat === 'youth'; }); })) fl.push(t.flag.youth());
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    $('#m-t thead').innerHTML = '<tr><th>' + t.month + '</th><th class="num">' + t.people + '</th><th class="num">' + t.gross + '</th><th class="num">' + t.ben + '</th><th class="num">' + t.tax + '</th><th class="num">' + t.fee + '</th><th class="num">' + t.cost + '</th><th>' + t.due + '</th></tr>';
    $('#m-t tbody').innerHTML = b.months.map(function (m) { return '<tr><td>' + m.month + '</td><td class="num">' + m.people + '</td><td class="num">' + kr0(m.b) + '</td><td class="num">' + kr0(m.f + m.c) + '</td><td class="num">' + kr0(m.s) + '</td><td class="num">' + kr0(m.fee) + '</td><td class="num">' + fmt(m.cost, 0) + '</td><td>' + m.due + (m.dueTable ? '' : ' *') + '</td></tr>'; }).join('');
    var X = b.totals;
    $('#m-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td class="num">' + kr0(X.b) + '</td><td class="num">' + kr0(X.f + X.c) + '</td><td class="num">' + kr0(X.s) + '</td><td class="num">' + kr0(X.fee) + '</td><td class="num">' + fmt(X.cost, 0) + '</td><td></td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    renderTeaser(b);
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(b);
  }
  // Free preview of the first journal entry + one buy CTA (shown only while locked; the licence-key flow stays in #paywall).
  var TZ = { sv: { h: 'Gratis förhandsvisning – första verifikationen', more: function (n) { return n > 0 ? 'Den fullständiga versionen innehåller ' + n + (n === 1 ? ' verifikation till.' : ' verifikationer till.') : ''; }, lead: 'Lås upp alla verifikationer som SIE-fil, beloppen till arbetsgivardeklarationen (ruta 487, 497 och fälten per anställd), Excel-underlaget och utskrift.', buy: 'Köp för ', note: 'Engångsköp via Gumroad. Licensnyckeln kommer på e-post – klistra in den via knappen nedan.' },
    en: { h: 'Free preview – the first journal entry', more: function (n) { return n > 0 ? 'The full version has ' + n + (n === 1 ? ' more entry.' : ' more entries.') : ''; }, lead: 'Unlock every journal entry as a SIE file, the employer declaration amounts (boxes 487, 497 and the per-employee fields), the Excel pack and print.', buy: 'Buy for ', note: 'One-off purchase via Gumroad. The licence key arrives by e-mail – paste it via the button below.' } };
  function renderTeaser(r) {
    var box = $('#teaser'); if (!box) return;
    var show = !PW.isUnlocked() && !!(r && r.vouchers && r.vouchers.length); box.hidden = !show; $('#paid-open').classList.toggle('ghost', show);
    if (!show) { box.innerHTML = ''; return; }
    var z = TZ[lang] || TZ.sv, t = L(), v = r.vouchers[0], url = /^https:\/\/[\w.-]*gumroad\.com\//.test(CFG.GUMROAD_PRODUCT_URL || '') ? CFG.GUMROAD_PRODUCT_URL : '';
    box.innerHTML = '<h3>' + z.h + '</h3><div class="tbl"><table id="tz-t"><thead><tr><th>' + t.konto + '</th><th></th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody><tr class="vh"><td colspan="4"><strong>' + esc(v.serie + v.nr) + '</strong> ' + v.date + ' – ' + esc(v.text || '') + '</td></tr>' +
      v.trans.map(function (x) { return '<tr><td>' + x.konto + '</td><td>' + esc(accName(r, x.konto)) + '</td><td class="num">' + (x.amount > 0 ? kr(x.amount) : '') + '</td><td class="num">' + (x.amount < 0 ? kr(-x.amount) : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted small">' + z.more(r.vouchers.length - 1) + '</p><p class="tz-lead"><strong>' + z.lead + '</strong></p>' +
      (url ? '<p><a class="btn" id="tz-buy" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + z.buy + esc(CFG.PRICE_LABEL) + '</a></p>' : '') + '<p class="muted small">' + z.note + '</p>';
  }
  function accName(b, k) { return b.accounts[k] || S.ACCOUNTS[k] || ''; }
  function verHtml(b) {
    var t = L();
    return '<p>' + t.verLead(b.vouchers.length) + '</p><div class="tbl"><table id="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.konto + '</th><th>' + t.name + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      b.vouchers.map(function (v) { return '<tr class="vh"><td colspan="5"><strong>' + esc(v.serie + v.nr) + '</strong> ' + v.date + ' – ' + esc(v.text) + '</td></tr>' + v.trans.map(function (x) { return '<tr><td></td><td>' + x.konto + '</td><td>' + esc(accName(b, x.konto)) + '</td><td class="num">' + (x.amount > 0 ? kr(x.amount) : '') + '</td><td class="num">' + (x.amount < 0 ? kr(-x.amount) : '') + '</td></tr>'; }).join(''); }).join('') +
      '</tbody></table></div><p class="hint">' + t.help + '</p>';
  }
  function agiHtml(b) {
    var t = L();
    return '<p class="small">' + t.agiLead + '</p>' + b.months.map(function (m) {
      return '<div class="agi-m"><h4>' + m.month + ' · ' + t.due + ' ' + m.due + '</h4><div class="tbl"><table class="agi-h"><thead><tr><th>' + t.head + '</th><th class="num">' + t.under + '</th><th class="num">' + t.avg + '</th></tr></thead><tbody>' +
        m.lines.map(function (l) { return '<tr><td>' + esc(catName(l.cat)) + ' (' + l.u + ' / ' + l.a + ')</td><td class="num">' + kr0(l.base) + '</td><td class="num">' + kr0(l.fee) + '</td></tr>'; }).join('') +
        '<tr><td><strong>' + t.r487 + '</strong></td><td></td><td class="num"><strong>' + kr0(m.r487) + '</strong></td></tr><tr><td><strong>' + t.r497 + '</strong></td><td></td><td class="num"><strong>' + kr0(m.r497) + '</strong></td></tr></tbody></table></div>' +
        '<div class="tbl"><table class="agi-i"><thead><tr><th>' + t.emp + '</th><th>' + t.born + '</th><th class="num">011</th><th class="num">012</th><th class="num">013</th><th class="num">001</th><th>' + t.cat + '</th></tr></thead><tbody>' +
        m.ind.map(function (i) { return '<tr><td>' + esc(i.name) + '</td><td>' + esc(i.born) + '</td><td class="num">' + kr0(i.f011) + '</td><td class="num">' + kr0(i.f012) + '</td><td class="num">' + kr0(i.f013) + '</td><td class="num">' + kr0(i.f001) + '</td><td>' + esc(catName(i.cat)) + (i.over ? esc(t.over(i.over)) : '') + '</td></tr>'; }).join('') + '</tbody></table></div></div>';
    }).join('');
  }
  function renderPaid(b) { b = b || current().b; if (!b || !b.ok) return; $('#ver').innerHTML = verHtml(b); $('#agi').innerHTML = agiHtml(b); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function ready() { if (!PW.isUnlocked()) return null; var b = current().b; return b && b.ok ? b : null; }
  function base(b) { return 'lon-' + b.from + '_' + b.to; }
  function downloadSie() {
    var b = ready(), t = L(); if (!b) return;
    var y = b.from.slice(0, 4);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.opt.co || 'Företaget', orgnr: st.opt.orgnr, program: 'Bokföra lön (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10), rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: b.accounts, vouchers: b.vouchers }), base(b) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    var b = ready(), t = T.sv; if (!b) return;
    var X = b.totals;
    var sum = [[bold('Lön – bokföringsunderlag och arbetsgivardeklaration')], ['Företag', st.opt.co || ''], ['Organisationsnummer', st.opt.orgnr || ''], ['Utbetalningsmånader', b.from + ' – ' + b.to], [],
      ['Kontant bruttolön, kr', money(X.b)], ['Förmåner, kr', money(X.f + X.c)], ['Skatteavdrag, kr', money(X.s)], ['Arbetsgivaravgifter, kr', money(X.fee)], [bold('Total lönekostnad, kr'), money(X.cost)], [], [t.help]];
    var mo = [[bold('Månad'), bold('Anställda'), bold('Bruttolön'), bold('Förmåner'), bold('Skatteavdrag'), bold('Arbetsgivaravgifter'), bold('Lönekostnad'), bold('Deklarera och betala senast')]];
    b.months.forEach(function (m) { mo.push([m.month, m.people, money(m.b), money(m.f + m.c), money(m.s), money(m.fee), money(m.cost), m.due]); });
    var hu = [[bold('Månad'), bold('Avgiftssats'), bold('Kod underlag (Skatteverket)'), bold('Underlag'), bold('Kod avgift'), bold('Avgift')]];
    b.months.forEach(function (m) { m.lines.forEach(function (l) { hu.push([m.month, S.CAT[l.cat].sv, l.u, money(l.base), l.a, money(l.fee)]); }); hu.push([m.month, 'Ruta 487 summa arbetsgivaravgifter', '', '', '487', money(m.r487)]); hu.push([m.month, 'Ruta 497 summa skatteavdrag', '', '', '497', money(m.r497)]); });
    var iu = [[bold('Månad'), bold('Anställd'), bold('Född / personnummer'), bold('011 Kontant bruttolön'), bold('012 Övriga förmåner'), bold('013 Bilförmån'), bold('001 Avdragen skatt'), bold('Avgiftssats')]];
    b.months.forEach(function (m) { m.ind.forEach(function (i) { iu.push([m.month, i.name, i.born, money(i.f011), money(i.f012), money(i.f013), money(i.f001), S.CAT[i.cat].sv]); }); });
    var ver = [[bold('Ver'), bold('Datum'), bold('Text'), bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit')]];
    b.vouchers.forEach(function (v) { v.trans.forEach(function (x) { ver.push([v.serie + v.nr, v.date, v.text, x.konto, accName(b, x.konto), x.amount > 0 ? money(x.amount / 100) : '', x.amount < 0 ? money(-x.amount / 100) : '']); }); });
    var src = [[bold('Källor')], ['Skatteverket: Teknisk beskrivning 1.1.18.2, avsnitt 12.6.1, och bilagan Summering och beräkningsregler (IK7001 upp till 25 000 kr, resten i 420)'], ['https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration/tekniskbeskrivningochtesttjanst/tekniskbeskrivning11182.4.7eada0316ed67d7282a791.html'], ['Skatteverket: Arbetsgivaravgifter (avgiftssatser 2026 och nedsättning för 19–23 år)'], ['https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html'], ['Skatteverket: Arbetsgivardeklaration Huvuduppgift (SKV 4786) – ruta 487 och 497, heltal, ören tas bort per avgiftssats'], ['https://www.skatteverket.se/foretag/etjansterochblanketter/blanketterbroschyrer/blanketter/info/4786.4.2cf1b5cd163796a5c8bc704.html'], ['Skatteverket: När ska jag lämna arbetsgivardeklarationen'], ['https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration/narskajaglamnaarbetsgivardeklaration.4.361dc8c15312eff6fd13c11.html'], ['BAS kontoplan 2026']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [36, 30] }, { name: 'Per månad', rows: mo, widths: [10, 10, 14, 14, 14, 18, 14, 22] }, { name: 'Avgift per sats', rows: hu, widths: [10, 38, 12, 14, 10, 14] }, { name: 'Individuppgifter', rows: iu, widths: [10, 24, 18, 18, 18, 14, 16, 34] }, { name: 'Verifikationer', rows: ver, widths: [7, 12, 52, 8, 40, 14, 14] }, { name: 'Källor', rows: src, widths: [110] }], { title: 'Lön' });
      K.download(buf, base(b) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = L().xlsxOk;
    } catch (e) { $('#dl-msg').textContent = L().fail; }
  }
  function printPack() {
    var b = ready(); if (!b) return;
    $('#print-root').innerHTML = '<article class="card"><h1>' + esc((st.opt.co ? st.opt.co + ' – ' : '') + 'Lön ' + b.from + ' – ' + b.to) + '</h1><p><strong>' + esc($('#check').textContent) + '</strong></p>' + $('#m-t').outerHTML + agiHtml(b) + verHtml(b) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, { opt: st.opt }); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.opt) st.opt = Object.assign({}, DEF, d.opt); }
  function load(text, name) { st.file = name || ''; $('#rows').value = text; $('#paid-out').hidden = true; $('#dl-msg').textContent = ''; render(); }
  function readFile(f) {
    if (!f) return; $('#status').textContent = L().reading; $('#status').className = 'status';
    f.arrayBuffer().then(function (ab) { load(window.CSV.decode(new Uint8Array(ab)).text, f.name); }, function () { $('#status').textContent = L().statusErr; $('#status').className = 'status err'; });
  }
  var setLang = K.i18n(EN, function (l) { lang = l; render(); });
  var fileIn = $('#file');
  $('#file-btn').addEventListener('click', function () { fileIn.click(); });
  fileIn.addEventListener('change', function () { readFile(fileIn.files[0]); fileIn.value = ''; });
  var ta = $('#rows');
  ['dragenter', 'dragover'].forEach(function (ev) { ta.addEventListener(ev, function (e) { e.preventDefault(); ta.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { ta.addEventListener(ev, function (e) { e.preventDefault(); ta.classList.remove('over'); }); });
  ta.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); });
  ta.addEventListener('input', function () { st.file = ''; render(); });
  $('#sample').addEventListener('click', function () { load(S.sampleCsv(), ''); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { opt: Object.assign({}, DEF), text: '', file: '' }; fill(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
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
