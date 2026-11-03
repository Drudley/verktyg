/* Arvode god man – UI. Everything runs in the browser; nothing is uploaded. Free page (no paywall).
 * Inputs are autosaved in localStorage (APP_CONFIG.STORAGE_KEY). */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG, A = window.ARVODE, lang = 'sv', last = null;
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var F = { date: '#f-date', birth: '#f-birth', arvode: '#f-arvode', kost: '#f-kost', mil: '#f-mil', krmil: '#f-krmil', earlier: '#f-earlier', hm: '#f-hm', gm: '#f-gm' };
  var C = { underlag: '#f-underlag', employer: '#f-employer', minor: '#f-minor' };
  var SAMPLE = { date: '2025-08-29', birth: '1959', arvode: '3000', kost: '', mil: '', krmil: '', earlier: '', hm: 'Anders', gm: 'Eva', underlag: false, employer: false, minor: false, payer: 'huvudman' };

  var EN = {
    h1: 'Guardian fee (arvode god man) – tax, employer contributions and the simplified employer declaration',
    lead: 'Enter the fee from the chief guardian’s decision, your year of birth and the payment date – and get the <strong>30 % tax deduction</strong>, the <strong>employer contributions</strong>, your net pay, what goes to the principal’s tax account and <strong>exactly what to write in each box of SKV 4805</strong>. For god man, förvaltare and förmyndare, 2025–2026.',
    free: 'Free – no account, no upload, no tracking.',
    'cta-h': 'Doing the annual account too?', 'cta-p': 'Load the principal’s bank statements into <a href="../arsrakning-god-man/">Annual account from bank statements</a> – income and expenses are sorted into the årsräkning categories, with the fee and the tax on the right line.',
    'calc-h': 'The fee payment', sample: 'Skatteverket’s example', clear: 'Clear',
    'l-date': 'Payment date (when the money leaves the principal’s account)', 'l-birth': 'Your year of birth (the guardian’s)', 'l-arvode': 'Fee according to the decision, SEK (before tax)', 'h-arvode': 'Administration + personal care + legal matters, without expense allowance.',
    'l-kost': 'Expense allowance (kostnadsersättning), SEK', 'h-kost': 'Postage, phone, short trips etc. (not outlays against receipts).', 'l-underlag': 'I have receipts for the expenses',
    'l-mil': 'Car trips, number of Swedish miles (10 km)', 'l-krmil': 'Mileage allowance per mil, SEK', 'h-krmil': 'Up to SEK 25/mil is tax-free and not reported.',
    'l-earlier': 'Fee the principal already paid you this year, SEK', 'h-earlier': 'Only needed for the SEK 1,000 threshold.',
    'l-payer': 'Who pays the fee?', 'p-hm': 'The principal (huvudman)', 'p-km': 'The municipality',
    'l-employer': 'The principal is registered as an employer', 'l-minor': 'The principal is under 18 (guardian of a child)',
    'names-h': 'Names on the statement (optional)', 'l-hm': 'Principal', 'l-gm': 'Guardian / administrator', 'names-p': 'Names only appear on the printout and are saved in this browser. Do not enter personal ID numbers here – fill those in by hand.',
    saved: 'Your inputs are saved automatically in this browser.',
    'cta2-h': 'Next step: the annual account', 'cta2-p': 'In the årsräkning the fee is an expense for the principal – together with the tax and contributions paid to Skatteverket. <strong>Annual account from bank statements</strong> reads the principal’s statements (CSV or Excel from the bank), sorts every line into the årsräkning categories and checks A + B = C + D.', 'cta2-go': 'Open Årsräkning →'
  };
  var T = {
    sv: { title: 'Resultat', must: function (d) { return 'Lämna förenklad arbetsgivardeklaration och betala senast ' + d; }, mustAgi: function (d) { return 'Redovisa i arbetsgivardeklarationen (AGI) och betala senast ' + d; },
      notNeeded: 'Ingen skatt och ingen arbetsgivaravgift – ingen förenklad arbetsgivardeklaration behövs.', kommunOk: 'Kommunen betalar – kommunen drar skatt, betalar avgift och redovisar. Du behöver inte lämna något.',
      sNet: 'Netto till dig', sSkv: 'Till huvudmannens skattekonto', sSkatt: 'Avdragen skatt (30 %)', sAvg: 'Arbetsgivaravgift', sTot: 'Kostnad för huvudmannen', sDl: 'Sista dag', moved: function (n) { return 'flyttad från ' + n; },
      formH: 'Förenklad arbetsgivardeklaration (SKV 4805)', agiH: 'Arbetsgivardeklaration – samma belopp', formP: function (r) { return 'Månad: ' + r.mon + ' (utbetalningsmånaden). Utbetalare: huvudmannen' + (r.minor ? ' – är huvudmannen minderårig står du både som utbetalare och mottagare' : '') + '. Mottagare: du. Skickas till Skatteverket, 205 30 Malmö. Betala till bankgiro 5050-1055 med huvudmannens OCR-nummer.'; },
      agiP: 'Huvudmannen är registrerad som arbetsgivare: redovisa i e-tjänsten Arbetsgivardeklaration (du behöver vara deklarationsombud) eller på SKV 4786/4788. Beloppen nedan är desamma.',
      hR: 'Ruta', hT: 'Text på blanketten', hB: 'Belopp (kr)',
      rows: { '04': function (r) { return 'Bruttolön, mottagare född ' + r.full; }, '07': '× 31,42 % = arbetsgivaravgifter', '11': function (r) { return 'Bruttolön, mottagare född ' + r.old; }, '12': '× 10,21 % = ålderspensionsavgift',
        '18': function (r) { return 'Bruttolön (max 25 000 kr), mottagare född ' + r.youth; }, '24': '× 20,81 % = arbetsgivaravgifter', '06': 'Underlag för skatteavdrag (ej kostnadsersättningar)', '09': 'Avdragen skatt',
        '20': 'Skattepliktiga kostnadsersättningar (inkl. schablonersättningar till god man/förvaltare)', '10': 'Summa att betala (07 + 12 + 24 + 09)' },
      bH: 'Ersättningsbesked – arvode', bHm: 'Utbetalare (huvudman)', bGm: 'Mottagare (god man/förvaltare)', bDate: 'Utbetalningsdag', bArv: 'Arvode', bBilT: 'Skattepliktig del av bilersättning', bKostT: 'Kostnadsersättning utöver schablon (lön)', bBrutto: 'Skattepliktig ersättning',
      bSkatt: 'Avdragen preliminärskatt 30 %', bKost: 'Kostnadsersättning (inget skatteavdrag)', bBil: 'Bilersättning, skattefri del', bNet: 'Utbetalt till mottagaren', bAvg: 'Arbetsgivaravgift som huvudmannen betalar', bNote: 'Spara en kopia av blanketten och detta besked till årsräkningen.',
      ars: function (r, n) { return 'Arvode god man/förvaltare ' + n.date + ': ' + n.total + ' kr\n  varav netto till god man ' + n.net + ' kr\n  varav till Skatteverket ' + n.skv + ' kr (avdragen skatt ' + n.skatt + ' kr, arbetsgivaravgift ' + n.avg + ' kr)' + (n.kost ? '\n  varav kostnadsersättning ' + n.kost + ' kr' : '') + (n.bil ? '\n  varav skattefri bilersättning ' + n.bil + ' kr' : ''); },
      arsNote: 'Skatt och avgift betalas oftast vid ett annat datum än arvodet – på kontoutdraget blir det två rader.',
      w: { ore: 'Ören stryks – blanketten fylls i med hela kronor.', 'bil-excess': function (x) { return 'Bilersättning över 25 kr/mil: ' + A.fmt(x.amount) + ' kr är lön och räknas in i arvodet (skatt och avgift).'; },
        'schablon-excess': function (x) { return 'Kostnadsersättning utan underlag får vara högst ' + A.fmt(x.cap) + ' kr (2 % av prisbasbeloppet). Överskottet ' + A.fmt(x.excess) + ' kr räknas som lön.'; },
        'schablon-unknown': function (x) { return 'Schablonbeloppet för ' + x.year + ' är inte känt ännu – kostnadsersättningen har inte prövats mot taket.'; },
        'below-1000': 'Arvodet under året är mindre än 1 000 kr: ingen skatt och ingen arbetsgivaravgift, ingen deklaration. Du tar själv upp beloppet i din inkomstdeklaration.',
        prelim: function (x) { return x.year + ': procentsatser och födelseår är preliminära (samma regler som 2026 flyttade ett år). Kontrollera mot Skatteverkets blankett för ' + x.year + '.'; },
        kommun: 'Betalar kommunen arvodet ska kommunen göra skatteavdrag, betala arbetsgivaravgift och redovisa. Beräkningen nedan visar bara hur det blir.',
        employer: 'Huvudmannen är registrerad som arbetsgivare – använd arbetsgivardeklarationen (AGI) i stället för SKV 4805.',
        minor: 'Huvudmannen är minderårig: du redovisar och betalar i ditt eget namn och står både som utbetalare och mottagare.' },
      err: { date: 'Fyll i utbetalningsdagen.', year: function (x) { return 'Kalkylatorn har regler för 2025–2027, inte ' + x.year + '.'; }, birth: 'Fyll i ditt födelseår med fyra siffror.', num: function (x) { return 'Beloppet i fältet ”' + x.field + '” går inte att läsa som ett tal.'; } },
      flagsH: 'Att tänka på', empty: 'Fyll i utbetalningsdag, födelseår och arvode för att se resultatet.',
      copied: 'Kopierat – klistra in där du vill.', copyErr: 'Kunde inte kopiera automatiskt.', sampleOk: 'Skatteverkets exempel inläst: Eva (född 1959) är god man åt Anders och får 3 000 kr i arvode i augusti 2025.', cleared: 'Uppgifterna är rensade.',
      mon: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'] },
    en: { title: 'Result', must: function (d) { return 'File the simplified employer declaration and pay by ' + d; }, mustAgi: function (d) { return 'Report in the employer declaration (AGI) and pay by ' + d; },
      notNeeded: 'No tax and no employer contributions – no simplified employer declaration needed.', kommunOk: 'The municipality pays – it deducts tax, pays contributions and reports. You do not have to file anything.',
      sNet: 'Net to you', sSkv: 'To the principal’s tax account', sSkatt: 'Tax deducted (30 %)', sAvg: 'Employer contributions', sTot: 'Cost for the principal', sDl: 'Deadline', moved: function (n) { return 'moved from ' + n; },
      formH: 'Simplified employer declaration (SKV 4805)', agiH: 'Employer declaration – same amounts', formP: function (r) { return 'Month: ' + r.mon + ' (the payment month). Payer: the principal' + (r.minor ? ' – if the principal is a minor you are both payer and recipient' : '') + '. Recipient: you. Send to Skatteverket, 205 30 Malmö. Pay to bankgiro 5050-1055 with the principal’s OCR number.'; },
      agiP: 'The principal is registered as an employer: report in the Arbetsgivardeklaration e-service (you must be a declaration agent) or on SKV 4786/4788. The amounts below are the same.',
      hR: 'Box', hT: 'Text on the form', hB: 'Amount (SEK)',
      rows: { '04': function (r) { return 'Gross pay, recipient born ' + r.full.replace('eller senare', 'or later'); }, '07': '× 31.42 % = employer contributions', '11': function (r) { return 'Gross pay, recipient born ' + r.old; }, '12': '× 10.21 % = old-age pension contribution',
        '18': function (r) { return 'Gross pay (max SEK 25,000), recipient born ' + r.youth; }, '24': '× 20.81 % = employer contributions', '06': 'Basis for tax deduction (excl. expense allowances)', '09': 'Tax deducted',
        '20': 'Taxable expense allowances (incl. flat-rate allowances to guardian) – no tax deducted', '10': 'Total to pay (07 + 12 + 24 + 09)' },
      bH: 'Payment statement – guardian fee', bHm: 'Payer (principal)', bGm: 'Recipient (guardian)', bDate: 'Payment date', bArv: 'Fee', bBilT: 'Taxable part of mileage allowance', bKostT: 'Expense allowance above flat rate (pay)', bBrutto: 'Taxable pay',
      bSkatt: 'Preliminary tax deducted 30 %', bKost: 'Expense allowance (no tax deducted)', bBil: 'Mileage allowance, tax-free part', bNet: 'Paid to the recipient', bAvg: 'Employer contributions paid by the principal', bNote: 'Keep a copy of the form and this statement for the annual account.',
      ars: function (r, n) { return 'Guardian fee ' + n.date + ': SEK ' + n.total + '\n  of which net to guardian SEK ' + n.net + '\n  of which to Skatteverket SEK ' + n.skv + ' (tax deducted ' + n.skatt + ', employer contributions ' + n.avg + ')' + (n.kost ? '\n  of which expense allowance SEK ' + n.kost : '') + (n.bil ? '\n  of which tax-free mileage SEK ' + n.bil : ''); },
      arsNote: 'Tax and contributions are usually paid on a different date than the fee – two lines on the bank statement.',
      w: { ore: 'Öre are dropped – the form uses whole kronor.', 'bil-excess': function (x) { return 'Mileage above SEK 25/mil: SEK ' + A.fmt(x.amount) + ' is pay and is added to the fee (tax and contributions).'; },
        'schablon-excess': function (x) { return 'Without receipts the expense allowance may be at most SEK ' + A.fmt(x.cap) + ' (2 % of the price base amount). The excess SEK ' + A.fmt(x.excess) + ' counts as pay.'; },
        'schablon-unknown': function (x) { return 'The flat-rate cap for ' + x.year + ' is not known yet – the expense allowance was not checked against it.'; },
        'below-1000': 'The fee for the year is below SEK 1,000: no tax, no employer contributions, no declaration. You report the amount in your own tax return.',
        prelim: function (x) { return x.year + ': rates and birth years are preliminary (2026 rules shifted one year). Check against Skatteverket’s form for ' + x.year + '.'; },
        kommun: 'If the municipality pays the fee, it must deduct tax, pay contributions and report. The calculation below only shows the result.',
        employer: 'The principal is registered as an employer – use the employer declaration (AGI) instead of SKV 4805.',
        minor: 'The principal is a minor: you report and pay in your own name, as both payer and recipient.' },
      err: { date: 'Enter the payment date.', year: function (x) { return 'The calculator has rules for 2025–2027, not ' + x.year + '.'; }, birth: 'Enter your year of birth (four digits).', num: function (x) { return 'The amount in “' + x.field + '” is not a number.'; } },
      flagsH: 'Please note', empty: 'Enter payment date, year of birth and fee to see the result.',
      copied: 'Copied – paste wherever you need it.', copyErr: 'Could not copy automatically.', sampleOk: 'Skatteverket’s example loaded: Eva (born 1959) is god man for Anders and receives a SEK 3,000 fee in August 2025.', cleared: 'Inputs cleared.',
      mon: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] }
  };
  function t(k) { return T[lang][k]; }
  function status(m, err) { var s = $('#status'); s.textContent = m || ''; s.className = 'status' + (err ? ' err' : ''); }
  function fmtDate(iso) { var p = iso.split('-'); return lang === 'en' ? (+p[2]) + ' ' + t('mon')[+p[1] - 1] + ' ' + p[0] : (+p[2]) + ' ' + t('mon')[+p[1] - 1] + ' ' + p[0]; }

  function read() {
    var v = {}; Object.keys(F).forEach(function (k) { v[k] = $(F[k]).value; }); Object.keys(C).forEach(function (k) { v[k] = $(C[k]).checked; });
    v.payer = (document.querySelector('input[name=payer]:checked') || {}).value || 'huvudman'; return v;
  }
  function write(v) {
    Object.keys(F).forEach(function (k) { $(F[k]).value = v[k] || ''; }); Object.keys(C).forEach(function (k) { $(C[k]).checked = !!v[k]; });
    document.querySelectorAll('input[name=payer]').forEach(function (r) { r.checked = r.value === (v.payer || 'huvudman'); });
  }
  function save() { try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify({ v: 1, f: read() })); } catch (e) { /* ignore */ } }
  function load() { var d; try { d = JSON.parse(localStorage.getItem(CFG.STORAGE_KEY) || 'null'); } catch (e) { d = null; } if (d && d.v === 1 && d.f) { write(d.f); return true; } return false; }

  function compute() {
    var v = read();
    return A.compute({ payDate: v.date, birthYear: v.birth, arvode: v.arvode, kostnad: v.kost, kostnadUnderlag: v.underlag, mil: v.mil, krPerMil: v.krmil, earlier: v.earlier, payer: v.payer, employer: v.employer, minor: v.minor });
  }
  function render() {
    var v = read(), Tl = T[lang];
    ['#f-birth', '#f-arvode', '#f-kost', '#f-mil', '#f-krmil', '#f-earlier'].forEach(function (s) { $(s).classList.remove('bad'); });
    if (!v.date || !v.birth || !v.arvode) { $('#result').hidden = true; last = null; status(v.date || v.birth || v.arvode ? Tl.empty : ''); return; }
    var r = compute(); last = r;
    if (!r.ok) {
      $('#result').hidden = true;
      var map = { arvode: '#f-arvode', kostnad: '#f-kost', mil: '#f-mil', krPerMil: '#f-krmil', earlier: '#f-earlier' };
      r.errors.forEach(function (e) { if (e.code === 'birth') $('#f-birth').classList.add('bad'); if (e.code === 'num' && map[e.field]) $(map[e.field]).classList.add('bad'); });
      status(r.errors.map(function (e) { var m = Tl.err[e.code]; return typeof m === 'function' ? m(e) : m; }).join(' '), true); return;
    }
    status(''); $('#result').hidden = false;
    var dl = fmtDate(r.deadline.date) + (r.deadline.moved ? ' (' + Tl.moved(fmtDate(r.deadline.nominal)) + ')' : '');
    $('#r-title').textContent = Tl.title + ' – ' + t('mon')[r.month - 1] + ' ' + r.year;
    var chk = $('#check');
    if (v.payer === 'kommun') { chk.textContent = Tl.kommunOk; chk.className = 'check ok'; }
    else if (!r.mustReport) { chk.textContent = Tl.notNeeded; chk.className = 'check ok'; }
    else { chk.textContent = (r.form === 'AGI' ? Tl.mustAgi : Tl.must)(dl); chk.className = 'check ok deadline'; }
    var st = [[Tl.sNet, r.net], [Tl.sSkv, r.toSkatteverket], [Tl.sSkatt, r.skatt], [Tl.sAvg, r.avgift], [Tl.sTot, r.totalCost]];
    $('#stats').innerHTML = st.map(function (s) { return '<div class="stat"><span class="muted small">' + esc(s[0]) + '</span><strong>' + A.fmt(s[1]) + ' kr</strong></div>'; }).join('') +
      (r.mustReport ? '<div class="stat"><span class="muted small">' + esc(Tl.sDl) + '</span><strong id="s-dl">' + esc(fmtDate(r.deadline.date)) + '</strong></div>' : '');
    var fl = $('#flags');
    if (r.warnings.length) { fl.hidden = false; fl.innerHTML = '<strong>' + esc(Tl.flagsH) + '</strong><ul>' + r.warnings.map(function (w) { var m = Tl.w[w.code]; return '<li>' + esc(typeof m === 'function' ? m(w) : m) + '</li>'; }).join('') + '</ul>'; }
    else { fl.hidden = true; fl.innerHTML = ''; }
    // form
    var y = r.year, br = { full: A.birthRange('full', y), old: A.birthRange('old', y), youth: A.birthRange('youth', y) };
    $('#form-h').textContent = r.form === 'AGI' ? Tl.agiH : Tl.formH;
    $('#form-p').textContent = r.form === 'AGI' ? Tl.agiP : Tl.formP({ mon: t('mon')[r.month - 1] + ' ' + y, minor: v.minor });
    var order = ['04', '07', '11', '12', '18', '24', '06', '09', '20', '10'];
    if (!(r.ruta['18'] > 0) && r.category !== 'youth') order = order.filter(function (k) { return k !== '18' && k !== '24'; });
    $('#form-t thead').innerHTML = '<tr><th>' + esc(Tl.hR) + '</th><th>' + esc(Tl.hT) + '</th><th class="num">' + esc(Tl.hB) + '</th></tr>';
    $('#form-t tbody').innerHTML = order.map(function (k) { var tx = Tl.rows[k]; tx = typeof tx === 'function' ? tx(br) : tx; var val = r.ruta[k];
      return '<tr class="' + (val ? '' : 'zero') + '" data-r="' + k + '"><td class="r">' + k + '</td><td>' + esc(tx) + '</td><td class="num">' + (val ? A.fmt(val) : '–') + '</td></tr>'; }).join('');
    // besked
    var lines = [[Tl.bArv, r.arvode]];
    if (r.bilTaxable) lines.push([Tl.bBilT, r.bilTaxable]); if (r.kostExcess) lines.push([Tl.bKostT, r.kostExcess]);
    lines.push([Tl.bBrutto, r.brutto, 1], [Tl.bSkatt, -r.skatt]); if (r.kostOk) lines.push([Tl.bKost, r.kostOk]); if (r.bilFree) lines.push([Tl.bBil, r.bilFree]);
    lines.push([Tl.bNet, r.net, 1]);
    $('#besked').innerHTML = '<h3>' + esc(Tl.bH) + '</h3><p class="small">' + esc(Tl.bHm) + ': <strong>' + esc(v.hm || '……………………') + '</strong> · ' + esc(Tl.bGm) + ': <strong>' + esc(v.gm || '……………………') + '</strong> · ' + esc(Tl.bDate) + ': <strong>' + esc(r.payDate) + '</strong></p>' +
      '<table><tbody>' + lines.map(function (l) { return '<tr' + (l[2] ? ' class="sumrow"' : '') + '><td>' + (l[2] ? '<strong>' + esc(l[0]) + '</strong>' : esc(l[0])) + '</td><td class="num">' + (l[2] ? '<strong>' + A.fmt(l[1]) + ' kr</strong>' : (l[1] < 0 ? '−' + A.fmt(-l[1]) : A.fmt(l[1])) + ' kr') + '</td></tr>'; }).join('') +
      '</tbody></table><p class="small muted">' + esc(Tl.bAvg) + ': ' + A.fmt(r.avgift) + ' kr. ' + esc(Tl.bNote) + '</p>';
    $('#ars').textContent = Tl.ars(r, { date: r.payDate, total: A.fmt(r.totalCost), net: A.fmt(r.net), skv: A.fmt(r.toSkatteverket), skatt: A.fmt(r.skatt), avg: A.fmt(r.avgift), kost: r.kostOk ? A.fmt(r.kostOk) : '', bil: r.bilFree ? A.fmt(r.bilFree) : '' }) + '\n\n' + Tl.arsNote;
  }
  function copy(text) {
    var ok = function () { $('#dl-msg').textContent = t('copied'); }, bad = function () { $('#dl-msg').textContent = t('copyErr'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, bad); else bad();
  }
  function formTsv() { var rows = []; document.querySelectorAll('#form-t tbody tr').forEach(function (tr) { var c = tr.querySelectorAll('td'); rows.push(c[0].textContent + '\t' + c[1].textContent + '\t' + c[2].textContent.replace(/[\s\u00a0]/g, '').replace('–', '0')); }); return [t('hR') + '\t' + t('hT') + '\t' + t('hB')].concat(rows).join('\n'); }

  var SV = {}; document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  var BTN = { sv: { print: 'Skriv ut underlag', copy: 'Kopiera rutorna', 'copy-ars': 'Kopiera text till årsräkningen', 'ars-h': 'Till årsräkningen' }, en: { print: 'Print statement', copy: 'Copy the boxes', 'copy-ars': 'Copy text for the annual account', 'ars-h': 'For the annual account' } };
  function setLang(l) {
    lang = l; var Dd = l === 'en' ? EN : SV; document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (Dd[el.dataset.i18n]) el.innerHTML = Dd[el.dataset.i18n]; });
    Object.keys(BTN[l]).forEach(function (id) { $('#' + id).textContent = BTN[l][id]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English'; render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  $('#calc').addEventListener('input', function () { save(); render(); });
  $('#calc').addEventListener('change', function () { save(); render(); });
  $('#sample').addEventListener('click', function () { write(SAMPLE); save(); render(); status(t('sampleOk')); $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('#clear').addEventListener('click', function () { write({}); try { localStorage.removeItem(CFG.STORAGE_KEY); } catch (e) { /* ignore */ } render(); status(t('cleared')); });
  $('#print').addEventListener('click', function () { window.print(); });
  $('#copy').addEventListener('click', function () { copy(formTsv()); });
  $('#copy-ars').addEventListener('click', function () { copy($('#ars').textContent); });
  load(); render();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
  window.ARVODE_APP = { compute: function () { return last; } };
})();
