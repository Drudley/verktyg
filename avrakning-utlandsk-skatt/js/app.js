/* UI for Avräkning av utländsk skatt i aktiebolag. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, A = window.AVR, fmt = K.fmt, esc = K.esc;
  var lang = 'sv';
  var EN = {
    h1: 'Foreign tax credit in a Swedish limited company',
    lead: 'Has the company received dividends from foreign shares with withholding tax? Enter the dividends and the company\u2019s result. The tool works out the <strong>creditable tax under the tax treaty</strong>, the <strong>limitation amount (spärrbelopp)</strong> at 20.6 % with the tax allocation reserve, <strong>carried-forward tax</strong> from five years back and what to <strong>reclaim in the source country</strong>.',
    'calc-h': 'Company and tax year', sample: 'Show example', clear: 'Clear',
    'l-co': 'Company name', 'l-org': 'Corporate ID', 'l-end': 'Last day of the financial year', 'l-overskott': 'Taxable result, INK2 box 1.1 (loss as minus), SEK',
    'l-pfAvs': 'Allocation to tax allocation reserve this year, SEK', 'l-pfAter': 'Reserve reversed this year, SEK', 'l-costs': 'Costs for the foreign income, SEK', 'l-deducted': 'Foreign tax deducted in the return anyway, SEK',
    'cf-h': 'Foreign tax carried forward from earlier years', 'bk-h': 'Bookkeeping', 'l-divKonto': 'Dividend posted to account', 'l-pay': 'Bank or custody account', 'l-serie': 'Voucher series', 'l-nr': 'First voucher number',
    'r-h': 'Dividends with foreign withholding tax', add: 'Add dividend',
    'h-items': 'Enter the gross dividend and the tax withheld in the dividend currency and the rate on the payment date (or currency SEK and rate 1). The treaty rate is 15 % for portfolio dividends under most Swedish tax treaties, e.g. with the USA, Finland, Norway, Denmark and Switzerland – check the treaty for other countries.',
    saved: 'Your entries are only saved in this browser. Nothing is sent anywhere.',
    'sp-h': 'The limitation amount step by step', 'per-h': 'Per dividend', 'cfo-h': 'Carried-forward tax after this year',
    'paid-h': 'Postings, SIE file, INK2 text and specification',
    'paid-p': 'Get the <strong>postings per dividend</strong> (bank, 6996 creditable withholding tax, 1680 to reclaim, 8212 dividend) as an <strong>SIE file</strong>, the <strong>text for the credit request</strong> in the tax return with the INK2S adjustment, and an <strong>Excel specification</strong> with the limitation amount and carried-forward tax year by year. The texts are in Swedish.',
    open: 'Show postings and INK2 text', 'ink-h': 'Basis for the credit request (form SKV 2706)', 'ver-h': 'Postings', sie: 'Download SIE file', xlsx: 'Download Excel specification', print: 'Print',
    'cta-h': 'Own the shares privately?', 'cta-p': '<a href="../aterbetalning-kallskatt/">Källskatt tillbaka</a> works out what you can reclaim from Finland, Norway, Denmark and Switzerland straight from the Avanza or Nordnet file. If the company is paying out its profit, see <a href="../gransbelopp-utdelning/">Gränsbelopp 2026 – 3:12 calculator</a>.',
    'pw-h': 'Postings, SIE file and INK2 text', 'pw-p': 'Unlock the postings per dividend as an SIE file, the text for the credit request with the INK2S adjustment and the Excel specification. The limitation amount and this year\u2019s credit are always free.'
  };
  var T = {
    sv: { result: 'Avräkning', date: 'Datum', payer: 'Utdelande bolag', country: 'Land (t.ex. US)', cur: 'Valuta', gross: 'Bruttoutdelning (valuta)', withheld: 'Dragen källskatt (valuta)', kurs: 'Kurs, kr per enhet', treaty: 'Avtalets skattesats %', remove: 'Ta bort', year: 'År',
      grossSEK: 'Brutto, kr', wSEK: 'Dragen skatt, kr', avr: 'Avräkningsbar', excess: 'Sök tillbaka', sum: 'Summa',
      sW: 'Dragen källskatt', sAvr: 'Avräkningsbar enligt avtal', sEx: 'Sök tillbaka i källlandet', sSp: 'Spärrbelopp', sCr: 'Avräkning i år', sSave: 'Sparas till kommande år',
      meta: function (r) { return 'Beskattningsår ' + r.year + ' · ' + r.rows.length + ' utdelningar · ' + kr(r.totals.gross) + ' kr brutto'; },
      ok: function (r) { return 'Bolaget kan avräkna ' + kr(r.credit) + ' kr från den statliga inkomstskatten ' + kr(r.actualTax) + ' kr' + (r.cfUsed ? ', varav ' + kr(r.cfUsed) + ' kr sparad skatt från tidigare år' : '') + '.'; },
      none: function (r) { return 'Ingen avräkning i år – bolaget har ingen statlig inkomstskatt att avräkna från. ' + kr(r.saveCurrent) + ' kr sparas till kommande år.'; },
      statusOk: function (n) { return n + (n === 1 ? ' utdelning räknad.' : ' utdelningar räknade.'); }, statusErr: 'Kontrollera de markerade fälten (datum ÅÅÅÅ-MM-DD, belopp, kurs och skattesats; dragen skatt kan inte vara större än utdelningen).',
      sp: { gross: 'Utländska inkomster brutto', costs: '− kostnader för de utländska inkomsterna', net: '= utländsk nettoinkomst', inc: 'Sammanlagd inkomst (fält 1.1)', pf: '± periodiseringsfond och avdragen utländsk skatt (13 §, 9 §)', incAdj: '= inkomst för spärrbeloppet', taxAdj: 'Statlig skatt 20,6 % på den (inkomsten avrundad nedåt till tiotal)', share: 'Andel utländsk inkomst', raw: 'Spärrbelopp före gränser', min: 'Minst 500 kr, högst bolagets statliga skatt', tax: 'Bolagets statliga inkomstskatt', final: 'Spärrbelopp' },
      cfY: 'Beskattningsår', cfA: 'Belopp', cfU: 'Används i år', cfL: 'Kvar', cfUntil: 'Senast år', curYear: 'i år',
      cmp: function (r) { return 'Avdrag i stället för avräkning hade sänkt skatten med cirka ' + kr(r.dedValue) + ' kr (20,6 % av ' + kr(r.totals.avr) + ' kr).'; },
      flag: { reclaim: 'Utdelning %n: mer källskatt än avtalets skattesats – mellanskillnaden kan inte avräknas utan ska sökas tillbaka i källlandet.', after: 'Utdelning %n: datum efter räkenskapsårets slut – kontrollera året.', loss: 'Bolaget har underskott eller ingen skatt – avräkning blir 0 i år. Begär att skatten sparas.', expire: 'Sparad skatt från %y (%a kr) kan bara användas i år – det som inte ryms går förlorat.' },
      konto: 'Konto', text: 'Text', debit: 'Debet', kredit: 'Kredit', ver: 'Ver', verLead: function (n) { return n + ' verifikationer, en per utdelning.'; },
      sieOk: 'SIE-filen är nedladdad.', xlsxOk: 'Excel-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte skatterådgivning. Spara specifikationen och avräkningsnotorna till nästa års deklaration.' },
    en: { result: 'Foreign tax credit', date: 'Date', payer: 'Paying company', country: 'Country (e.g. US)', cur: 'Currency', gross: 'Gross dividend (currency)', withheld: 'Tax withheld (currency)', kurs: 'Rate, SEK per unit', treaty: 'Treaty rate %', remove: 'Remove', year: 'Year',
      grossSEK: 'Gross, SEK', wSEK: 'Tax withheld, SEK', avr: 'Creditable', excess: 'Reclaim', sum: 'Total',
      sW: 'Tax withheld', sAvr: 'Creditable under treaty', sEx: 'Reclaim in source country', sSp: 'Limitation amount', sCr: 'Credit this year', sSave: 'Carried forward',
      meta: function (r) { return 'Tax year ' + r.year + ' · ' + r.rows.length + ' dividends · SEK ' + kr(r.totals.gross) + ' gross'; },
      ok: function (r) { return 'The company can credit SEK ' + kr(r.credit) + ' against the state income tax of SEK ' + kr(r.actualTax) + (r.cfUsed ? ', of which SEK ' + kr(r.cfUsed) + ' carried forward from earlier years' : '') + '.'; },
      none: function (r) { return 'No credit this year – the company has no state income tax to credit against. SEK ' + kr(r.saveCurrent) + ' is carried forward.'; },
      statusOk: function (n) { return n + (n === 1 ? ' dividend calculated.' : ' dividends calculated.'); }, statusErr: 'Check the marked fields (dates YYYY-MM-DD, amounts, rate and treaty rate; tax withheld cannot exceed the dividend).',
      sp: { gross: 'Foreign income, gross', costs: '− costs for the foreign income', net: '= net foreign income', inc: 'Total income (box 1.1)', pf: '± tax allocation reserve and deducted foreign tax (s. 13, s. 9)', incAdj: '= income for the limitation', taxAdj: 'State tax 20.6 % on it (income rounded down to tens)', share: 'Foreign share of income', raw: 'Limitation before caps', min: 'At least SEK 500, at most the company\u2019s state tax', tax: 'Company\u2019s state income tax', final: 'Limitation amount' },
      cfY: 'Tax year', cfA: 'Amount', cfU: 'Used this year', cfL: 'Left', cfUntil: 'Last year', curYear: 'this year',
      cmp: function (r) { return 'Deducting instead of crediting would have lowered the tax by about SEK ' + kr(r.dedValue) + ' (20.6 % of SEK ' + kr(r.totals.avr) + ').'; },
      flag: { reclaim: 'Dividend %n: more withholding than the treaty rate – the difference cannot be credited and should be reclaimed in the source country.', after: 'Dividend %n: date after the end of the financial year – check the year.', loss: 'The company has a loss or no tax – the credit is 0 this year. Ask for the tax to be carried forward.', expire: 'Tax carried forward from %y (SEK %a) can only be used this year – what does not fit is lost.' },
      konto: 'Account', text: 'Text', debit: 'Debit', kredit: 'Credit', ver: 'No', verLead: function (n) { return n + ' journal entries, one per dividend.'; },
      sieOk: 'The SIE file has been downloaded.', xlsxOk: 'The Excel file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not tax advice. Keep the specification and the dividend notes for next year\u2019s return.' }
  };
  function L() { return T[lang]; }
  function kr(o) { return fmt(o / 100, 2); }
  var CKEYS = ['name', 'orgnr', 'end', 'overskott', 'pfAvs', 'pfAter', 'costs', 'deducted', 'cf1', 'cf2', 'cf3', 'cf4', 'cf5', 'divKonto', 'pay', 'serie', 'nr'];
  function emptyR() { return { date: '', payer: '', country: '', cur: '', gross: '', withheld: '', kurs: '', treaty: '15' }; }
  function emptyC() { return { divKonto: '8212', pay: '1930', serie: 'A', nr: '1' }; }
  var st = { company: emptyC(), rows: [emptyR()] };
  function collect() {
    CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) st.company[k] = e.value.trim(); });
    st.rows = $$('#people .person').map(function (row) { var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o; });
    if (!st.rows.length) st.rows = [emptyR()];
  }
  function fillCompany() { var c = st.company, d = emptyC(); CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) e.value = c[k] != null ? c[k] : (d[k] || ''); }); cfLabels(); }
  function cfLabels() { var y = /^\d{4}-/.test($('#f-end').value) ? +$('#f-end').value.slice(0, 4) : 0; for (var k = 1; k <= 5; k++) $('#cf' + k + '-l').textContent = (lang === 'en' ? 'Tax year ' : 'Beskattningsår ') + (y ? y - 6 + k : (lang === 'en' ? 'year ' : 'år ') + (k - 6)) + ', kr'; }
  function inp(k, label, ph, mode) { return '<label><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="' + (mode || 'decimal') + '" placeholder="' + (ph || '') + '" autocomplete="off"></label>'; }
  function rowEl(p, i) {
    var t = L(), el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.payer + '</span><input type="text" data-k="payer" placeholder="' + t.payer + '" autocomplete="off"></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid">' + inp('date', t.date, '2026-03-25', 'numeric') + inp('country', t.country, 'FI', 'text') + inp('cur', t.cur, 'EUR', 'text') + inp('gross', t.gross) + inp('withheld', t.withheld) + inp('kurs', t.kurs, '1') + inp('treaty', t.treaty, '15') + '</div><p class="res"></p>';
    $$('[data-k]', el).forEach(function (f) { f.value = p[f.dataset.k] != null ? p[f.dataset.k] : ''; });
    $('.del', el).addEventListener('click', function () { collect(); st.rows.splice(+el.dataset.i, 1); if (!st.rows.length) st.rows = [emptyR()]; paint(); render(); });
    $$('input', el).forEach(function (f) { f.addEventListener('input', render); });
    return el;
  }
  function paint() { var box = $('#people'); box.innerHTML = ''; st.rows.forEach(function (p, i) { box.appendChild(rowEl(p, i)); }); }
  function current() { collect(); return A.calc(st); }
  function isEmpty() { var c = st.company; return !String(c.end || '').trim() && !String(c.overskott || '').trim() && st.rows.every(function (r) { return ['date', 'gross', 'withheld', 'payer'].every(function (k) { return !String(r[k] || '').trim(); }); }); }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + v + ' kr</strong></div>'; }
  function tr(a, b, strong) { return '<tr' + (strong ? ' class="sum"' : '') + '><td>' + (strong ? '<strong>' + a + '</strong>' : a) + '</td><td class="num">' + (strong ? '<strong>' + b + '</strong>' : b) + '</td></tr>'; }
  function pct(x) { return fmt(x * 100, 2) + ' %'; }
  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    $$('#calc .bad').forEach(function (x) { x.classList.remove('bad'); });
    $$('#people .person').forEach(function (e) { $('.res', e).textContent = ''; });
    persist(); cfLabels();
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    var r = current(), rows = $$('#people .person');
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      r.errors.forEach(function (k) { var f = $('#f-' + k); if (f) f.classList.add('bad'); });
      r.bad.forEach(function (i) { var e = rows[i]; if (!e) return; r.rows[i].errors.forEach(function (k) { var f = $('[data-k=' + k + ']', e); if (f) f.classList.add('bad'); }); });
      return;
    }
    r.rows.forEach(function (x, i) { if (rows[i]) $('.res', rows[i]).textContent = t.grossSEK + ' ' + kr(x.grossSEK) + ' · ' + t.avr + ' ' + kr(x.avr) + ' kr' + (x.excess ? ' · ' + t.excess + ' ' + kr(x.excess) + ' kr' : ''); });
    res.hidden = false; status.textContent = t.statusOk(r.rows.length); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.orgnr ? st.company.orgnr + ' · ' : '') + t.meta(r);
    var none = r.actualTax === 0;
    $('#check').className = 'check ' + (none ? 'warn' : 'ok'); $('#check').textContent = (none ? t.none(r) : t.ok(r)) + ' ' + t.cmp(r);
    var T2 = r.totals;
    $('#stats').innerHTML = stat(t.sW, kr(T2.withheld)) + stat(t.sAvr, kr(T2.avr)) + stat(t.sEx, kr(T2.excess)) + stat(t.sSp, kr(r.sparr)) + stat(t.sCr, kr(r.credit)) + stat(t.sSave, kr(r.carryOut.reduce(function (a, x) { return a + x.amount; }, 0)));
    var fl = r.warnings.map(function (w) { return t.flag[w.k].replace('%n', String(w.n)).replace('%y', String(w.year || '')).replace('%a', w.amount ? kr(w.amount) : ''); });
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    var s = t.sp, adj = r.pfAvs - r.pfAter + r.deducted;
    $('#sp-t tbody').innerHTML = tr(s.gross, kr(T2.gross)) + tr(s.costs, kr(T2.costs)) + tr(s.net, kr(T2.net), true) + tr(s.inc, kr(r.overskott)) + tr(s.pf, (adj < 0 ? '−' : '+') + kr(Math.abs(adj))) + tr(s.incAdj, kr(r.incAdj), true) +
      tr(s.taxAdj, kr(r.taxAdj)) + tr(s.share, pct(r.share)) + tr(s.raw, kr(r.sparrRaw)) + tr(s.tax, kr(r.actualTax)) + tr(s.min, '') + tr(s.final, kr(r.sparr), true);
    $('#per-t thead').innerHTML = '<tr><th>' + t.date + '</th><th>' + t.payer + '</th><th class="num">' + t.grossSEK + '</th><th class="num">' + t.wSEK + '</th><th class="num">%</th><th class="num">' + t.avr + '</th><th class="num">' + t.excess + '</th></tr>';
    $('#per-t tbody').innerHTML = r.rows.map(function (x) { return '<tr><td>' + x.date + '</td><td>' + esc(x.payer) + '<br><span class="muted small">' + esc(x.country) + ' · ' + fmt(x.gross, 2) + ' ' + esc(x.cur) + ' × ' + fmt(x.kurs, 4).replace(/0{1,2}$/, '') + ' · ' + fmt(x.treaty, x.treaty % 1 ? 1 : 0) + ' %</span></td><td class="num">' + kr(x.grossSEK) + '</td><td class="num">' + kr(x.wSEK) + '</td><td class="num">' + fmt(x.wPct, 1) + '</td><td class="num">' + kr(x.avr) + '</td><td class="num">' + kr(x.excess) + '</td></tr>'; }).join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td class="num">' + kr(T2.gross) + '</td><td class="num">' + kr(T2.withheld) + '</td><td></td><td class="num">' + kr(T2.avr) + '</td><td class="num">' + kr(T2.excess) + '</td></tr>';
    var cfRows = r.cf.filter(function (x) { return x.amount > 0; }).map(function (x) { return [String(x.year), x.amount, x.used, x.year > r.year - 5 ? x.amount - x.used : 0, x.year + 5]; });
    cfRows.push([String(r.year) + ' (' + t.curYear + ')', r.avrYear, r.usedCurrent, r.saveCurrent, r.year + 5]);
    $('#cf-t thead').innerHTML = '<tr><th>' + t.cfY + '</th><th class="num">' + t.cfA + '</th><th class="num">' + t.cfU + '</th><th class="num">' + t.cfL + '</th><th class="num">' + t.cfUntil + '</th></tr>';
    $('#cf-t tbody').innerHTML = cfRows.map(function (x) { return '<tr><td>' + x[0] + '</td><td class="num">' + kr(x[1]) + '</td><td class="num">' + kr(x[2]) + '</td><td class="num">' + kr(x[3]) + '</td><td class="num">' + x[4] + '</td></tr>'; }).join('');
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  function verTable(r, list) {
    var t = L();
    return '<div class="tbl"><table class="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.date + '</th><th>' + t.konto + '</th><th>' + t.text + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      list.map(function (v) { return v.trans.map(function (x, j) { var a = x.amount / 100; return '<tr><td>' + (j ? '' : esc(v.serie) + v.nr) + '</td><td>' + (j ? '' : v.date) + '</td><td>' + x.konto + '</td><td>' + esc(r.accounts[x.konto] || '') + '</td><td class="num">' + (a > 0 ? fmt(a, 2) : '') + '</td><td class="num">' + (a < 0 ? fmt(-a, 2) : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>';
  }
  /* Swedish text for the request (always in Swedish – it goes to Skatteverket) */
  function inkText(r) {
    var c = st.company, T2 = r.totals, L2 = [];
    L2.push((c.name || '[bolagets namn]') + ', org.nr ' + (c.orgnr || '[org.nr]') + ' – beskattningsår som slutar ' + c.end + '.');
    L2.push('Bolaget begär avräkning av utländsk skatt enligt lagen (1986:468) om avräkning av utländsk skatt med ' + kr(r.credit) + ' kr' + (r.cfUsed ? ', varav ' + kr(r.cfUsed) + ' kr utländsk skatt som sparats från tidigare år (2 kap. 17 §)' : '') + '.');
    L2.push('Utländska utdelningar brutto ' + kr(T2.gross) + ' kr, hänförliga kostnader ' + kr(T2.costs) + ' kr, utländsk nettoinkomst ' + kr(T2.net) + ' kr. Innehållen utländsk skatt ' + kr(T2.withheld) + ' kr, varav ' + kr(T2.avr) + ' kr enligt skatteavtalens skattesatser. Överskjutande ' + kr(T2.excess) + ' kr söks tillbaka i källstaterna.');
    L2.push('Spärrbelopp ' + kr(r.sparr) + ' kr (beräknat som om avsättning till och återföring av periodiseringsfond inte gjorts, 2 kap. 13 §).');
    var save = r.carryOut.filter(function (x) { return x.year === r.year; })[0];
    if (save) L2.push('Utländsk skatt som inte kan avräknas i år, ' + kr(save.amount) + ' kr, begärs sparad enligt 2 kap. 17 § (senast beskattningsåret ' + save.until + ').');
    L2.push('Begäran lämnas på blankett SKV 2706 (Avräkning av utländsk skatt – Juridiska personer) som bifogas Inkomstdeklaration 2, med kryss i rutan Övriga upplysningar. Specifikation per utdelning bifogas.');
    return L2;
  }
  function renderPaid(r) {
    r = r || current(); if (!r.ok) return;
    $('#ink').innerHTML = inkText(r).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '<p class="hint">INK2S 4.3 c: ' + (lang === 'en' ? 'add back the foreign tax posted on 6996, SEK ' : 'lägg tillbaka den utländska skatten bokförd på 6996, ') + kr(r.addBack) + ' kr' + (lang === 'en' ? ' (non-deductible when credit is claimed).' : ' (ej avdragsgill när avräkning begärs).') + '</p>';
    $('#ver').innerHTML = '<p>' + L().verLead(r.vouchers.length) + '</p>' + verTable(r, r.vouchers) + '<p class="hint">' + L().help + '</p>';
  }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function ready() { if (!PW.isUnlocked()) return null; var r = current(); return r.ok && !isEmpty() ? r : null; }
  function base(r) { return 'avrakning-utlandsk-skatt-' + r.year; }
  function downloadSie() {
    var r = ready(), t = L(); if (!r) return;
    var end = st.company.end, start = (+end.slice(0, 4) - 1) + end.slice(4); start = new Date(Date.parse(start + 'T00:00:00Z') + 864e5).toISOString().slice(0, 10);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.company.name || 'Företaget', orgnr: st.company.orgnr, program: 'Avräkning av utländsk skatt (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10),
        rar: [{ start: start, end: end }], accounts: r.accounts, vouchers: r.vouchers }), base(r) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    var r = ready(), t = L(); if (!r) return;
    var c = st.company, T2 = r.totals, sp = T.sv.sp;
    var sum = [[bold('Avräkning av utländsk skatt')], ['Bolag', c.name || ''], ['Organisationsnummer', c.orgnr || ''], ['Räkenskapsårets slut', c.end], [],
      [sp.gross, money(T2.gross / 100)], [sp.costs, money(T2.costs / 100)], [sp.net, money(T2.net / 100)], [sp.inc, money(r.overskott / 100)], ['Avsättning periodiseringsfond (läggs tillbaka)', money(r.pfAvs / 100)], ['Återförd periodiseringsfond (dras bort)', money(r.pfAter / 100)], ['Avdragen utländsk skatt (läggs tillbaka)', money(r.deducted / 100)],
      [sp.incAdj, money(r.incAdj / 100)], [sp.taxAdj, money(r.taxAdj / 100)], [sp.share, Math.round(r.share * 10000) / 100], [sp.raw, money(r.sparrRaw / 100)], [sp.tax, money(r.actualTax / 100)], [sp.final, money(r.sparr / 100)], [],
      ['Innehållen utländsk skatt', money(T2.withheld / 100)], ['Avräkningsbar enligt skatteavtal', money(T2.avr / 100)], ['Minskning för gjort avdrag (15 §)', money(r.red15 / 100)], ['Att söka tillbaka i källstaterna', money(T2.excess / 100)], ['Sparad skatt som används i år', money(r.cfUsed / 100)], ['Årets skatt som används', money(r.usedCurrent / 100)], [bold('Avräkning i år'), money(r.credit / 100)], ['Årets skatt som sparas', money(r.saveCurrent / 100)], ['INK2S 4.3 c – lägg tillbaka 6996', money(r.addBack / 100)], ['Avdrag i stället (jämförelse), skattesänkning', money(r.dedValue / 100)], [], [T.sv.help]];
    var rows = [[bold('Datum'), bold('Utdelande bolag'), bold('Land'), bold('Valuta'), bold('Brutto (valuta)'), bold('Dragen skatt (valuta)'), bold('Kurs'), bold('Brutto, kr'), bold('Dragen skatt, kr'), bold('Dragen %'), bold('Avtalets %'), bold('Avräkningsbar, kr'), bold('Sök tillbaka, kr')]];
    r.rows.forEach(function (x) { rows.push([x.date, x.payer, x.country, x.cur, x.gross, x.withheld, x.kurs, money(x.grossSEK / 100), money(x.wSEK / 100), Math.round(x.wPct * 100) / 100, x.treaty, money(x.avr / 100), money(x.excess / 100)]); });
    var cf = [[bold('Beskattningsår'), bold('Sparat belopp'), bold('Används i år'), bold('Kvar'), bold('Senast år')]];
    r.cf.forEach(function (x) { cf.push([x.year, money(x.amount / 100), money(x.used / 100), money((x.year > r.year - 5 ? x.amount - x.used : 0) / 100), x.year + 5]); });
    cf.push([r.year, money(r.avrYear / 100), money(r.usedCurrent / 100), money(r.saveCurrent / 100), r.year + 5]);
    var ink = [[bold('Underlag till begäran om avräkning – blankett SKV 2706, bifogas INK2 med kryss i Övriga upplysningar')]].concat(inkText(r).map(function (x) { return [x]; }));
    var ver = [[bold('Ver'), bold('Datum'), bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit'), bold('Text')]];
    r.vouchers.forEach(function (v) { v.trans.forEach(function (x, j) { var a = x.amount / 100; ver.push([j ? '' : v.serie + v.nr, j ? '' : v.date, x.konto, r.accounts[x.konto] || '', a > 0 ? money(a) : '', a < 0 ? money(-a) : '', j ? '' : v.text]); }); });
    var src = [[bold('Källor')], ['Lag (1986:468) om avräkning av utländsk skatt, 1 kap. 6 §, 2 kap. 2, 7–10, 13, 15, 17 §§'], ['https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1986468-om-avrakning-av-utlandsk-skatt_sfs-1986-468/'], ['Inkomstskattelag (1999:1229) 1 kap. 7 §, 16 kap. 18–19 §§, 65 kap. 10 §'], ['Skatteverket: blankett SKV 2706 och SKV 294 (Övriga upplysningar, punkt 4.3 c)'], ['https://www.skatteverket.se/foretag/etjansterochblanketter/blanketterbroschyrer/blanketter/info/2706.4.39f16f103821c58f680006568.html'], ['BAS kontoplan 2026: 6996, 1680, 8212']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [58, 18] }, { name: 'Utdelningar', rows: rows, widths: [12, 28, 6, 7, 14, 14, 9, 14, 14, 9, 9, 14, 14] }, { name: 'Sparad skatt', rows: cf, widths: [14, 16, 16, 16, 10] }, { name: 'INK2-text', rows: ink, widths: [140] }, { name: 'Kontering', rows: ver, widths: [8, 12, 8, 44, 14, 14, 50] }, { name: 'Källor', rows: src, widths: [120] }], { title: 'Avräkning av utländsk skatt' });
      K.download(buf, base(r) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    var r = ready(); if (!r) return;
    $('#print-root').innerHTML = '<article class="card"><h1>Avräkning av utländsk skatt ' + r.year + '</h1>' + inkText(r).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '<h2>' + L().sSp + '</h2>' + $('#sp-t').outerHTML + $('#per-t').outerHTML + $('#cf-t').outerHTML + verTable(r, r.vouchers) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.rows) && d.rows.length) { st = d; return true; } return false; }
  var setLang = K.i18n(EN, function (l) { lang = l; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.rows.push(emptyR()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = A.sample(); fillCompany(); paint(); render(); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { company: emptyC(), rows: [emptyR()] }; fillCompany(); paint(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('#calc input[id^="f-"]').forEach(function (f) { f.addEventListener('input', render); });
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#sie').addEventListener('click', downloadSie);
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  restore(); fillCompany(); paint();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else render();
})();
