/* UI for Bokföra inköp från EU och utlandet. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, O = window.OMVAND, fmt = K.fmt;
  var lang = 'sv';
  var EN = {
    h1: 'Book purchases from the EU and abroad – reverse-charge VAT (Sweden)',
    lead: 'Add the invoices from foreign suppliers – ads and software from Ireland and the US, goods from Germany, imports from China – and construction services with domestic reverse charge. The tool works out <strong>reverse-charge and import VAT</strong>, posts to the right <strong>BAS accounts</strong> and totals the amounts for <strong>boxes 20–24, 30–32, 50, 60–62 and 48</strong> of the Swedish VAT return.',
    'calc-h': 'The company and the period', sample: 'Show example', clear: 'Clear',
    'l-co': 'Company name (optional)', 'l-org': 'Corporate ID (optional)', 'l-period': 'VAT period (optional)', 'l-ded': 'Right to deduct input VAT, %', 'l-serie': 'Voucher series', 'l-nr': 'First voucher number',
    'it-h': 'Invoices', add: 'Add invoice',
    'h-items': 'Enter the invoice amount <strong>without VAT</strong> in the invoice currency and the rate you use. Leave the cost account empty to use the BAS account for the type (4515, 4535, 4531, 4545 …). For imports: put customs duty and freight to Sweden in “duty and freight” – they are part of the basis but booked when paid.',
    saved: 'The figures are stored only in this browser. Nothing is sent away.',
    'box-h': 'The VAT return', 'inv-h': 'Per invoice',
    'paid-h': 'Postings, SIE file and VAT pack',
    'paid-p': 'Get the <strong>postings per invoice</strong> (cost, supplier payable, 2614/2615 and 2645), a <strong>SIE file</strong> to import into Fortnox, Visma, Bokio or other software and an <strong>Excel pack</strong> with the boxes and invoices to keep with the VAT return.',
    open: 'Show postings and pack', 'ver-h': 'Postings', sie: 'Download SIE file', xlsx: 'Download Excel', print: 'Print VAT pack',
    'cta-h': 'More files for the books:', 'cta-p': '<a href="../stripe-till-sie/">Book Stripe – payout to SIE</a> turns Stripe’s payout report into a SIE file, with optional reverse charge on Stripe’s fees from Ireland.<span data-needs="representation-moms"> VAT on business entertainment is in <a href="../representation-moms/">Entertainment – VAT and deductions</a>.</span>',
    'pw-h': 'Postings, SIE file and VAT pack', 'pw-p': 'Unlock the postings per invoice, the SIE file and the Excel pack for the VAT return. The boxes and the calculation per invoice are always free.'
  };
  var T = {
    sv: { result: 'Inköp från utlandet', date: 'Fakturadatum', supplier: 'Leverantör', text: 'Avser', type: 'Typ', rate: 'Svensk momssats', amount: 'Belopp utan moms', cur: 'Valuta', fx: 'Kurs till SEK', extra: 'Tull och frakt, kr', konto: 'Kostnadskonto (valfritt)', pay: 'Betalas från',
      tEuG: 'Varor från EU-land (ruta 20)', tEuS: 'Tjänster från EU-land (ruta 21)', tNoS: 'Tjänster utanför EU (ruta 22)', tSeG: 'Varor i Sverige, omvänd moms (ruta 23)', tSeS: 'Tjänster i Sverige, omvänd moms, t.ex. bygg (ruta 24)', tImp: 'Import av varor utanför EU (ruta 50)',
      p2440: 'Leverantörsskuld (2440)', p1930: 'Betalt direkt (1930)', remove: 'Ta bort', sek: 'SEK', basis: 'Underlag', vat: 'Moms', box: 'Ruta', sum: 'Summa', val: 'Belopp, kr',
      boxN: { 20: 'Varor från annat EU-land', 21: 'Tjänster från annat EU-land', 22: 'Tjänster från land utanför EU', 23: 'Varor i Sverige, omvänd moms', 24: 'Tjänster i Sverige, omvänd moms', 30: 'Utgående moms 25 % på 20–24', 31: 'Utgående moms 12 % på 20–24', 32: 'Utgående moms 6 % på 20–24', 50: 'Beskattningsunderlag import', 60: 'Utgående moms 25 % import', 61: 'Utgående moms 12 % import', 62: 'Utgående moms 6 % import', 48: 'Ingående moms att dra av' },
      meta: function (c, n) { return (c.period ? 'Period ' + c.period + ' · ' : '') + n + ' fakturor'; },
      ok: function (r) { return 'Utgående moms ' + fmt((r.totals.vat) / 100, 2) + ' kr och avdrag ' + fmt(r.totals.dedVat / 100, 2) + ' kr i ruta 48 – påverkan på ruta 49: ' + fmt(r.net / 100, 2) + ' kr.'; },
      stUt: 'Utgående moms', stIn: 'Ingående moms (48)', stNet: 'Påverkan ruta 49', stSek: 'Inköp, kr',
      statusOk: function (n) { return n + (n === 1 ? ' faktura räknad.' : ' fakturor räknade.'); }, statusErr: 'Kontrollera datum (ÅÅÅÅ-MM-DD), belopp, kurs och konto på de markerade fakturorna.',
      flag: { 'extra-later': 'Faktura %n: tull och frakt ingår i ruta 50 men bokförs när Tullverkets och speditörens fakturor betalas.' },
      kontoH: 'Konto', name: 'Benämning', debit: 'Debet', kredit: 'Kredit', ver: 'Ver', verLead: function (n) { return n + ' verifikationer, en per faktura.'; }, whole: 'Hela kronor i deklarationen – ören stryks.',
      xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte skatterådgivning. Kontrollera att fakturan saknar utländsk moms och har ditt momsregistreringsnummer.' },
    en: { result: 'Purchases from abroad', date: 'Invoice date', supplier: 'Supplier', text: 'For', type: 'Type', rate: 'Swedish VAT rate', amount: 'Amount without VAT', cur: 'Currency', fx: 'Rate to SEK', extra: 'Duty and freight, SEK', konto: 'Cost account (optional)', pay: 'Paid from',
      tEuG: 'Goods from an EU country (box 20)', tEuS: 'Services from an EU country (box 21)', tNoS: 'Services from outside the EU (box 22)', tSeG: 'Goods in Sweden, reverse charge (box 23)', tSeS: 'Services in Sweden, reverse charge, e.g. construction (box 24)', tImp: 'Import of goods from outside the EU (box 50)',
      p2440: 'Supplier payable (2440)', p1930: 'Paid directly (1930)', remove: 'Remove', sek: 'SEK', basis: 'Basis', vat: 'VAT', box: 'Box', sum: 'Total', val: 'Amount, SEK',
      boxN: { 20: 'Goods from another EU country', 21: 'Services from another EU country', 22: 'Services from outside the EU', 23: 'Goods in Sweden, reverse charge', 24: 'Services in Sweden, reverse charge', 30: 'Output VAT 25 % on 20–24', 31: 'Output VAT 12 % on 20–24', 32: 'Output VAT 6 % on 20–24', 50: 'Taxable amount, imports', 60: 'Output VAT 25 % imports', 61: 'Output VAT 12 % imports', 62: 'Output VAT 6 % imports', 48: 'Input VAT to deduct' },
      meta: function (c, n) { return (c.period ? 'Period ' + c.period + ' · ' : '') + n + ' invoices'; },
      ok: function (r) { return 'Output VAT ' + fmt((r.totals.vat) / 100, 2) + ' kr and deduction ' + fmt(r.totals.dedVat / 100, 2) + ' kr in box 48 – effect on box 49: ' + fmt(r.net / 100, 2) + ' kr.'; },
      stUt: 'Output VAT', stIn: 'Input VAT (48)', stNet: 'Effect on box 49', stSek: 'Purchases, SEK',
      statusOk: function (n) { return n + (n === 1 ? ' invoice calculated.' : ' invoices calculated.'); }, statusErr: 'Check the date (YYYY-MM-DD), amount, rate and account on the marked invoices.',
      flag: { 'extra-later': 'Invoice %n: duty and freight are in box 50 but booked when the customs and forwarder invoices are paid.' },
      kontoH: 'Account', name: 'Name', debit: 'Debit', kredit: 'Credit', ver: 'No', verLead: function (n) { return n + ' journal entries, one per invoice.'; }, whole: 'Whole kronor in the return – öre are dropped.',
      xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not tax advice. Check that the invoice has no foreign VAT and shows your VAT number.' }
  };
  function L() { return T[lang]; }
  function emptyI() { return { date: '', supplier: '', text: '', type: 'eu_service', rate: '25', amount: '', cur: 'EUR', fx: '', extra: '', konto: '', pay: '2440' }; }
  function emptyC() { return { name: '', orgnr: '', period: '', ded: '100', serie: 'A', nr: '1' }; }
  var st = { company: emptyC(), items: [emptyI()] };

  function collect() {
    var c = st.company; c.name = $('#f-co').value.trim(); c.orgnr = $('#f-org').value.trim(); c.period = $('#f-period').value.trim(); c.ded = $('#f-ded').value.trim(); c.serie = $('#f-serie').value.trim(); c.nr = $('#f-nr').value.trim();
    st.items = $$('#people .person').map(function (row) { var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o; });
    if (!st.items.length) st.items = [emptyI()];
  }
  function fillCompany() { var c = st.company; $('#f-co').value = c.name || ''; $('#f-org').value = c.orgnr || ''; $('#f-period').value = c.period || ''; $('#f-ded').value = c.ded || '100'; $('#f-serie').value = c.serie || 'A'; $('#f-nr').value = c.nr || '1'; }
  function sel(k, label, opts) { return '<label><span>' + label + '</span><select data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>'; }
  function inp(k, label, ph, mode) { return '<label><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="' + (mode || 'decimal') + '" placeholder="' + (ph || '') + '" autocomplete="off"></label>'; }
  function itemRow(p, i) {
    var t = L(), el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.supplier + '</span><input type="text" data-k="supplier" placeholder="' + t.supplier + '" autocomplete="off"></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid">' + sel('type', t.type, [['eu_service', t.tEuS], ['eu_goods', t.tEuG], ['noneu_service', t.tNoS], ['import_goods', t.tImp], ['se_rc_service', t.tSeS], ['se_rc_goods', t.tSeG]]) +
      inp('date', t.date, '2026-10-03', 'numeric') + inp('text', t.text, '', 'text') + sel('rate', t.rate, [['25', '25 %'], ['12', '12 %'], ['6', '6 %']]) + '</div>' +
      '<div class="grid">' + inp('amount', t.amount, '0') + sel('cur', t.cur, [['EUR', 'EUR'], ['USD', 'USD'], ['SEK', 'SEK'], ['GBP', 'GBP'], ['DKK', 'DKK'], ['NOK', 'NOK'], ['CHF', 'CHF'], ['CNY', 'CNY']]) + inp('fx', t.fx, '11,10') + inp('extra', t.extra, '0') + inp('konto', t.konto, '4535', 'numeric') + sel('pay', t.pay, [['2440', t.p2440], ['1930', t.p1930]]) + '</div><p class="res"></p>';
    $$('[data-k]', el).forEach(function (f) { f.value = p[f.dataset.k] != null ? p[f.dataset.k] : ''; if (f.tagName === 'SELECT' && !f.value) f.selectedIndex = 0; });
    var sync = function () { var ty = $('[data-k=type]', el).value, cur = $('[data-k=cur]', el).value; $('[data-k=extra]', el).closest('label').hidden = ty !== 'import_goods'; $('[data-k=fx]', el).closest('label').hidden = cur === 'SEK'; var k = O.TYPES[ty].cost[$('[data-k=rate]', el).value]; $('[data-k=konto]', el).placeholder = k; };
    sync();
    $('.del', el).addEventListener('click', function () { collect(); st.items.splice(+el.dataset.i, 1); if (!st.items.length) st.items = [emptyI()]; paint(); render(); });
    $$('input,select', el).forEach(function (f) { f.addEventListener('input', function () { sync(); render(); }); f.addEventListener('change', function () { sync(); render(); }); });
    return el;
  }
  function paint() { var box = $('#people'); box.innerHTML = ''; st.items.forEach(function (p, i) { box.appendChild(itemRow(p, i)); }); }
  function current() { collect(); return O.batch(st); }
  function isEmpty() { return st.items.every(function (p) { return ['date', 'amount', 'supplier', 'fx'].every(function (k) { return !String(p[k] || '').trim(); }); }); }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + fmt(v / 100, 2) + ' kr</strong></div>'; }
  function kr(o) { return fmt(o / 100, 2); }
  function whole(o) { return fmt(Math.trunc(o / 100)); }
  var BOX_ORDER = [20, 21, 22, 23, 24, 30, 31, 32, 50, 60, 61, 62, 48];

  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    $$('#people .person').forEach(function (e) { $$('input', e).forEach(function (x) { x.classList.remove('bad'); }); $('.res', e).textContent = ''; });
    persist();
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    var r = current(), rows = $$('#people .person');
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      r.bad.forEach(function (i) { var e = rows[i]; if (!e) return; r.rows[i].errors.forEach(function (k) { var f = $('[data-k=' + k + ']', e); if (f) f.classList.add('bad'); }); });
      if (r.rows.some(function (x) { return !x.ok && x.errors.indexOf('ded') >= 0; })) $('#f-ded').classList.add('bad');
      return;
    }
    $('#f-ded').classList.remove('bad');
    r.rows.forEach(function (x, i) { if (rows[i]) $('.res', rows[i]).textContent = t.box + ' ' + x.box + ': ' + kr(x.basis) + ' kr · ' + t.box + ' ' + x.outBox + ': ' + kr(x.vat) + ' kr · ' + t.box + ' 48: ' + kr(x.dedVat) + ' kr'; });
    res.hidden = false; status.textContent = t.statusOk(r.totals.n); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.orgnr ? st.company.orgnr + ' · ' : '') + t.meta(st.company, r.totals.n);
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(r);
    $('#stats').innerHTML = stat(t.stSek, r.totals.sek) + stat(t.stUt, r.totals.vat) + stat(t.stIn, r.totals.dedVat) + stat(t.stNet, r.net);
    var fl = []; r.rows.forEach(function (x, i) { x.warnings.forEach(function (w) { fl.push(t.flag[w].replace('%n', String(i + 1))); }); });
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + K.esc(x) + '</li>'; }).join('') + '</ul>' : '';
    $('#box-t thead').innerHTML = '<tr><th>' + t.box + '</th><th>' + t.text + '</th><th class="num">' + t.val + '</th></tr>';
    $('#box-t tbody').innerHTML = BOX_ORDER.filter(function (b) { return r.boxes[b]; }).map(function (b) { return '<tr data-box="' + b + '"><td>' + b + '</td><td>' + t.boxN[b] + '</td><td class="num">' + whole(r.boxes[b]) + '</td></tr>'; }).join('') + '<tr><td></td><td class="muted small" colspan="2">' + t.whole + '</td></tr>';
    $('#per-t thead').innerHTML = '<tr><th>' + t.date + '</th><th>' + t.supplier + '</th><th class="num">' + t.sek + '</th><th class="num">' + t.basis + '</th><th class="num">' + t.box + '</th><th class="num">' + t.vat + '</th><th class="num">' + t.box + '</th><th class="num">48</th></tr>';
    $('#per-t tbody').innerHTML = r.rows.map(function (x) {
      return '<tr><td>' + x.date + '</td><td>' + K.esc(x.supplier || '–') + (x.cur !== 'SEK' ? '<br><span class="muted small">' + fmt(x.amount, 2) + ' ' + K.esc(x.cur) + ' × ' + fmt(x.fx, 4) + '</span>' : '') + '</td><td class="num">' + kr(x.sek) + '</td><td class="num">' + kr(x.basis) + '</td><td class="num">' + x.box + '</td><td class="num">' + kr(x.vat) + '</td><td class="num">' + x.outBox + '</td><td class="num">' + kr(x.dedVat) + '</td></tr>';
    }).join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td class="num">' + kr(r.totals.sek) + '</td><td></td><td></td><td class="num">' + kr(r.totals.vat) + '</td><td></td><td class="num">' + kr(r.totals.dedVat) + '</td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  function verTable(r, list) {
    var t = L();
    return '<div class="tbl"><table class="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.date + '</th><th>' + t.kontoH + '</th><th>' + t.name + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      list.map(function (v) { return v.trans.map(function (x, j) { var a = x.amount / 100; return '<tr><td>' + (j ? '' : K.esc(v.serie) + v.nr) + '</td><td>' + (j ? '' : v.date) + '</td><td>' + x.konto + '</td><td>' + K.esc(r.accounts[x.konto] || '') + '</td><td class="num">' + (a > 0 ? fmt(a, 2) : '') + '</td><td class="num">' + (a < 0 ? fmt(-a, 2) : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>';
  }
  function verHtml(r) { var t = L(); return '<p>' + t.verLead(r.vouchers.length) + '</p>' + verTable(r, r.vouchers) + '<p class="hint">' + t.help + '</p>'; }
  function renderPaid(r) { r = r || current(); if (r.ok) $('#ver').innerHTML = verHtml(r); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function base(r) { var d = r.rows.map(function (x) { return x.date; }).sort(); return 'inkop-utland-' + (st.company.period || (d[0] + '-' + d[d.length - 1])); }

  function downloadSie() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok || isEmpty()) return;
    var y = r.rows.map(function (x) { return x.date; }).sort()[0].slice(0, 4);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.company.name || 'Företaget', orgnr: st.company.orgnr, program: 'Bokföra inköp från EU och utlandet (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10),
        rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: r.accounts, vouchers: r.vouchers }), base(r) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    if (!PW.isUnlocked()) return; var r = current(), t = T.sv; if (!r.ok || isEmpty()) return;
    var c = st.company;
    var boxes = [[bold('Momsdeklarationen – inköp från utlandet')], ['Företag', c.name || ''], ['Organisationsnummer', c.orgnr || ''], ['Momsperiod', c.period || ''], ['Avdragsrätt, %', c.ded || '100'], [], [bold('Ruta'), bold('Avser'), bold('Belopp, kr (hela kronor)'), bold('Exakt, kr')]];
    BOX_ORDER.forEach(function (b) { if (r.boxes[b]) boxes.push([b, t.boxN[b], Math.trunc(r.boxes[b] / 100), money(r.boxes[b] / 100)]); });
    boxes.push([], ['Påverkan på ruta 49, kr', '', '', money(r.net / 100)], [], [t.help]);
    var inv = [[bold('Datum'), bold('Leverantör'), bold('Avser'), bold('Typ'), bold('Momssats'), bold('Belopp'), bold('Valuta'), bold('Kurs'), bold('Belopp SEK'), bold('Tull/frakt'), bold('Underlag'), bold('Ruta'), bold('Moms'), bold('Ruta'), bold('Ingående moms (48)'), bold('Kostnadskonto')]];
    var TN = { eu_goods: t.tEuG, eu_service: t.tEuS, noneu_service: t.tNoS, se_rc_goods: t.tSeG, se_rc_service: t.tSeS, import_goods: t.tImp };
    r.rows.forEach(function (x) { inv.push([x.date, x.supplier, x.text, TN[x.type], x.rate + ' %', money(x.amount), x.cur, x.fx, money(x.sek / 100), money(x.extra / 100), money(x.basis / 100), x.box, money(x.vat / 100), x.outBox, money(x.dedVat / 100), x.cost]); });
    var ver = [[bold('Ver'), bold('Datum'), bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit')]];
    r.vouchers.forEach(function (v) { v.trans.forEach(function (x, j) { var a = x.amount / 100; ver.push([j ? '' : v.serie + v.nr, j ? '' : v.date, x.konto, r.accounts[x.konto] || '', a > 0 ? money(a) : '', a < 0 ? money(-a) : '']); }); });
    var src = [[bold('Källor')], ['Skatteverket: Fylla i momsdeklarationen'], ['https://www.skatteverket.se/foretagochorganisationer/moms/deklareramoms/fyllaiblanketterna.4.3a2a542410ab40a421c80004214.html'], ['Mervärdesskattelagen (2023:200)'], ['BAS kontoplan 2026']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Momsrutor', rows: boxes, widths: [26, 40, 22, 16] }, { name: 'Fakturor', rows: inv, widths: [12, 36, 30, 40, 10, 12, 8, 8, 14, 12, 14, 6, 12, 6, 16, 14] }, { name: 'Kontering', rows: ver, widths: [8, 12, 8, 60, 14, 14] }, { name: 'Källor', rows: src, widths: [110] }], { title: 'Inköp från utlandet' });
      K.download(buf, base(r) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = L().xlsxOk;
    } catch (e) { $('#dl-msg').textContent = L().fail; }
  }
  function printPack() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok || isEmpty()) return;
    $('#print-root').innerHTML = '<article class="card"><h1>' + K.esc((st.company.name ? st.company.name + ' – ' : '') + t.result + (st.company.period ? ' ' + st.company.period : '')) + '</h1><p>' + K.esc($('#r-meta').textContent) + '</p><p><strong>' + K.esc($('#check').textContent) + '</strong></p>' + $('#box-t').outerHTML + $('#per-t').outerHTML + verHtml(r) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.items) && d.items.length) { st = d; return true; } return false; }

  var setLang = K.i18n(EN, function (l) { lang = l; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.items.push(emptyI()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = O.sample(); fillCompany(); paint(); render(); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { company: emptyC(), items: [emptyI()] }; fillCompany(); paint(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('#calc > .grid input, #calc > .grid select').forEach(function (f) { f.addEventListener('input', render); f.addEventListener('change', render); });
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#sie').addEventListener('click', downloadSie);
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  if (restore()) fillCompany();
  paint();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else render();
})();
