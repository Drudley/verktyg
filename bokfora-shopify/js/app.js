/* UI for Bokföra Shopify – Shopify Payments to SIE. The file is read in the browser and never leaves it. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, S = window.SHOPIFY, fmt = K.fmt, esc = K.esc;
  var lang = 'sv';
  var EN = {
    h1: 'Book Shopify in Sweden – from the payout file to SIE',
    lead: 'Load the transactions file from Shopify Payments. Every payout becomes a <strong>journal entry</strong> with sales booked <strong>gross</strong>, output VAT, refunds, <strong>fees with reverse-charge VAT</strong>, disputes and the bank deposit – and the clearing account <strong>nets to zero</strong>. Download it all as a <strong>SIE file</strong> and import it into your bookkeeping software.',
    'calc-h': 'The transactions file from Shopify', sample: 'Show example', clear: 'Clear',
    drop: 'Drop the CSV file from Shopify Payments here or click to choose', 'drop-p': 'Finance &gt; Payouts &gt; export the transactions for one payout or a date range.',
    'l-co': 'Company name (for the SIE file)', 'l-orgnr': 'Company registration number', 'l-rate': 'VAT on sales', 'o-0': '0 % / exempt', 'l-rc': 'Reverse charge on the fees', 'o-yes': 'Yes (Shopify invoices from Ireland)', 'o-no': 'No',
    'l-paid': 'Which transactions', 'o-paid': 'Paid out only (paid / deposited)', 'o-all': 'All, including pending', 'l-clr': 'Shopify clearing account', 'l-bank': 'Bank account', 'l-sales': 'Sales account (blank = by VAT rate)', 'l-refund': 'Refunds account (blank = sales account)', 'l-fee': 'Account for Shopify fees',
    'l-serie': 'Voucher series', 'l-nr': 'First voucher number', saved: 'The file is read only in this browser. Nothing is sent away.',
    'po-h': 'Per payout', 'paid-h': 'Journal entries, SIE file, VAT boxes and Excel',
    'paid-p': 'Get <strong>one journal entry per payout</strong> as a SIE file to import into Fortnox, Visma, Bokio or other software, the <strong>amounts for the VAT return per month</strong> (boxes 05, 10, 21, 30 and 48) and an <strong>Excel pack</strong> with every transaction and posting to keep with the books.',
    open: 'Show journal entries and files', 'ver-h': 'Journal entries', 'moms-h': 'For the VAT return', sie: 'Download SIE file', xlsx: 'Download Excel', print: 'Print',
    'cta-h': 'More files for the books:', 'cta-p': '<a href="../stripe-till-sie/">Stripe to SIE</a> does the same with the Stripe payout report, and <a href="../bokfora-skattekonto/">Book the tax account</a> posts the Skatteverket statement row by row.',
    'pw-h': 'SIE file, VAT boxes and Excel', 'pw-p': 'Unlock the journal entries, the SIE file with one entry per payout, the VAT return amounts and the Excel pack. Reading and the per-payout summary are always free.'
  };
  var T = {
    sv: { result: 'Shopify Payments', date: 'Utbetalning', pid: 'Id', rows: 'Rader', sales: 'Försäljning', refunds: 'Returer', fee: 'Avgifter', vat: 'Utg. moms', other: 'Tvist/övrigt', net: 'Till bank', sum: 'Summa', konto: 'Konto', name: 'Benämning', debit: 'Debet', kredit: 'Kredit', ver: 'Ver', text: 'Text', month: 'Månad',
      sPo: 'Utbetalningar', sSales: 'Försäljning brutto', sFee: 'Shopify-avgifter', sVat: 'Utgående moms', sNet: 'Till banken',
      meta: function (b) { return 'Utbetalningar ' + b.from + ' – ' + b.to + ' · ' + b.totals.n + ' transaktioner · moms ' + b.rate + ' %'; },
      ok: function (b) { return 'Avräkningskontot ' + b.A.clr + ' går jämnt ut i alla ' + b.vouchers.length + ' verifikationer: försäljning ' + kr(b.totals.sales + b.totals.refunds) + ' kr − avgifter ' + kr(b.totals.fee) + ' kr' + (b.totals.disputes || b.totals.reserves || b.totals.other ? ' ± tvister/övrigt ' + kr(b.totals.disputes + b.totals.reserves + b.totals.other) + ' kr' : '') + ' = ' + kr(b.totals.net) + ' kr till banken.'; },
      flag: { failed: function (w) { return w.failed + (w.failed === 1 ? ' rad hör' : ' rader hör') + ' till en misslyckad eller avbruten utbetalning (' + kr(w.failedSum) + ' kr netto) och lämnas utanför – pengarna kommer med i en senare utbetalning.'; }, pending: function (w) { return w.pending + (w.pending === 1 ? ' transaktion är inte utbetald' : ' transaktioner är inte utbetalda') + ' ännu (' + kr(w.pendingSum) + ' kr netto) och lämnas utanför – de kommer med i nästa fil.'; }, currency: function (w) { return 'Rader i annan valuta än SEK lämnas utanför: ' + Object.keys(w.currency).map(function (c) { return c + ' ' + w.currency[c]; }).join(', ') + '.'; }, netDiff: function (w) { return w.netDiff + ' rader där Net inte är Amount − Fee – filen kan ha sparats om. Beloppet räknas som Amount − Fee.'; }, payoutRows: function (w) { return w.payoutRows + ' utbetalningsrader i filen används inte – utbetalningen räknas som summan av nettobeloppen.'; }, other: function (w) { return w.other + ' rader av annan typ (t.ex. adjustment, credit, debit eller payout_failure) har bokförts på 1689 – kontrollera dem.'; }, dispute: function (w) { return w.dispute + ' tvist(er): beloppet ligger som fordran på 1680. Förlorar du tvisten skriver du bort fordran och kan rätta momsen.'; }, feeVat: function () { return 'Filen har en momskolumn med belopp – kontrollera att avgifterna verkligen är utan moms.'; }, zero: function () { return 'Momssats 0 %: kontrollera försäljningskontot (t.ex. 3004, 3105 eller 3108).'; }, noPayout: function (w) { return w.noPayout + ' rader saknar utbetalningsdatum och har daterats på transaktionsdagen.'; } },
      statusOk: function (n, f) { return n + ' transaktioner inlästa' + (f ? ' från ' + f : '') + '.'; }, statusErr: 'Hittade inga transaktioner. Välj CSV-filen från Shopify Payments (Finance > Payouts > Export).', missing: function (m) { return 'Filen saknar kolumnerna ' + m.join(', ') + ' – är det transaktionsfilen från Shopify Payments?'; }, reading: 'Läser filen…',
      verLead: function (n) { return n + (n === 1 ? ' verifikation' : ' verifikationer') + ', en per utbetalning.'; }, mLead: 'Belopp i kronor per månad (utbetalningsdatum). Kontrollera mot din momsdeklaration – försäljning från andra betalsätt kommer till.',
      r05: 'Ruta 05 – momspliktig försäljning', rVat: function (b) { return 'Ruta ' + b.vatBox + ' – utgående moms ' + b.rate + ' %'; }, r21: 'Ruta 21 – inköp av tjänster från EU (avgifterna)', r30: 'Ruta 30 – utgående moms omvänd, 25 %', r48: 'Ruta 48 – ingående moms att dra av',
      xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte redovisningsrådgivning. Stäm av 1686 och bankkontot efter inläsningen.' },
    en: { result: 'Shopify Payments', date: 'Payout', pid: 'Id', rows: 'Rows', sales: 'Sales', refunds: 'Refunds', fee: 'Fees', vat: 'Output VAT', other: 'Disputes/other', net: 'To bank', sum: 'Total', konto: 'Account', name: 'Name', debit: 'Debit', kredit: 'Credit', ver: 'No', text: 'Text', month: 'Month',
      sPo: 'Payouts', sSales: 'Gross sales', sFee: 'Shopify fees', sVat: 'Output VAT', sNet: 'To the bank',
      meta: function (b) { return 'Payouts ' + b.from + ' – ' + b.to + ' · ' + b.totals.n + ' transactions · VAT ' + b.rate + ' %'; },
      ok: function (b) { return 'The clearing account ' + b.A.clr + ' nets to zero in all ' + b.vouchers.length + ' entries: sales ' + kr(b.totals.sales + b.totals.refunds) + ' kr − fees ' + kr(b.totals.fee) + ' kr' + (b.totals.disputes || b.totals.reserves || b.totals.other ? ' ± disputes/other ' + kr(b.totals.disputes + b.totals.reserves + b.totals.other) + ' kr' : '') + ' = ' + kr(b.totals.net) + ' kr to the bank.'; },
      flag: { failed: function (w) { return w.failed + ' row(s) belong to a failed or cancelled payout (' + kr(w.failedSum) + ' kr net) and are left out – the money comes with a later payout.'; }, pending: function (w) { return w.pending + ' transaction(s) are not paid out yet (' + kr(w.pendingSum) + ' kr net) and are left out – they come with the next file.'; }, currency: function (w) { return 'Rows in currencies other than SEK are left out: ' + Object.keys(w.currency).map(function (c) { return c + ' ' + w.currency[c]; }).join(', ') + '.'; }, netDiff: function (w) { return w.netDiff + ' rows where Net is not Amount − Fee – the file may have been re-saved. Amount − Fee is used.'; }, payoutRows: function (w) { return w.payoutRows + ' payout rows in the file are not used – the payout is the sum of the net amounts.'; }, other: function (w) { return w.other + ' rows of another type (e.g. adjustment, credit, debit or payout_failure) were posted to 1689 – check them.'; }, dispute: function (w) { return w.dispute + ' dispute(s): the amount is held as a receivable on 1680. If you lose, write it off and correct the VAT.'; }, feeVat: function () { return 'The file has a VAT column with amounts – check that the fees really carry no VAT.'; }, zero: function () { return 'VAT rate 0 %: check the sales account (e.g. 3004, 3105 or 3108).'; }, noPayout: function (w) { return w.noPayout + ' rows have no payout date and were dated on the transaction date.'; } },
      statusOk: function (n, f) { return n + ' transactions read' + (f ? ' from ' + f : '') + '.'; }, statusErr: 'No transactions found. Choose the CSV file from Shopify Payments (Finance > Payouts > Export).', missing: function (m) { return 'The file lacks the columns ' + m.join(', ') + ' – is it the Shopify Payments transactions file?'; }, reading: 'Reading the file…',
      verLead: function (n) { return n + ' journal entr' + (n === 1 ? 'y' : 'ies') + ', one per payout.'; }, mLead: 'Amounts in kronor per month (payout date). Check against your VAT return – sales from other payment methods come on top.',
      r05: 'Box 05 – taxable sales', rVat: function (b) { return 'Box ' + b.vatBox + ' – output VAT ' + b.rate + ' %'; }, r21: 'Box 21 – services bought from the EU (the fees)', r30: 'Box 30 – reverse-charge output VAT, 25 %', r48: 'Box 48 – input VAT to deduct',
      xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not accounting advice. Reconcile 1686 and the bank account after importing.' }
  };
  function L() { return T[lang]; }
  function kr(o) { return fmt(o / 100, 2); }
  var KEYS = ['co', 'orgnr', 'rate', 'rc', 'paid', 'clr', 'bank', 'sales', 'refund', 'fee', 'serie', 'nr'];
  var DEF = { rate: '25', rc: '1', paid: '1', clr: '1686', bank: '1930', fee: '6040', serie: 'A', nr: '1' };
  var st = { opt: Object.assign({}, DEF), parsed: null, file: '' };
  function collect() { KEYS.forEach(function (k) { st.opt[k] = $('#f-' + k).value.trim(); }); }
  function fill() { KEYS.forEach(function (k) { $('#f-' + k).value = st.opt[k] != null && st.opt[k] !== '' ? st.opt[k] : (DEF[k] || ''); }); }
  function current() { collect(); var o = st.opt; return st.parsed && st.parsed.ok ? S.build(st.parsed, { rate: o.rate, rc: o.rc, onlyPaid: o.paid, clr: o.clr, bank: o.bank, sales: o.sales, refund: o.refund, fee: o.fee, serie: o.serie, nr: o.nr }) : null; }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + v + '</strong></div>'; }
  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    persist();
    if (!st.parsed) { res.hidden = true; return; }
    if (!st.parsed.ok) { res.hidden = true; status.textContent = st.parsed.missing && st.parsed.missing.length ? t.missing(st.parsed.missing) : t.statusErr; status.className = 'status err'; return; }
    var b = current();
    if (!b.ok) { res.hidden = true; status.textContent = t.statusErr; status.className = 'status err'; return; }
    res.hidden = false; status.textContent = t.statusOk(st.parsed.rows.length, st.file); status.className = 'status';
    $('#r-title').textContent = st.opt.co || t.result;
    $('#r-meta').textContent = (st.opt.orgnr ? st.opt.orgnr + ' · ' : '') + t.meta(b);
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(b);
    $('#stats').innerHTML = stat(t.sPo, String(b.vouchers.length)) + stat(t.sSales, kr(b.totals.sales + b.totals.refunds) + ' kr') + stat(t.sFee, kr(b.totals.fee) + ' kr') + stat(t.sVat, kr(b.totals.vat) + ' kr') + stat(t.sNet, kr(b.totals.net) + ' kr');
    var w = b.warn, fl = [];
    ['pending', 'failed', 'dispute', 'other', 'netDiff', 'payoutRows', 'noPayout'].forEach(function (k) { if (w[k]) fl.push(t.flag[k](w)); });
    if (Object.keys(w.currency).length) fl.push(t.flag.currency(w)); if (w.feeVat) fl.push(t.flag.feeVat()); if (w.zero) fl.push(t.flag.zero());
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    $('#po-t thead').innerHTML = '<tr><th>' + t.date + '</th><th>' + t.pid + '</th><th class="num">' + t.rows + '</th><th class="num">' + t.sales + '</th><th class="num">' + t.refunds + '</th><th class="num">' + t.fee + '</th><th class="num">' + t.other + '</th><th class="num">' + t.vat + '</th><th class="num">' + t.net + '</th></tr>';
    $('#po-t tbody').innerHTML = b.payouts.map(function (p) { return '<tr><td>' + p.date + '</td><td>' + esc(p.pid || '') + '</td><td class="num">' + p.n + '</td><td class="num">' + kr(p.sales) + '</td><td class="num">' + kr(p.refunds) + '</td><td class="num">' + kr(p.fee) + '</td><td class="num">' + kr(p.disputes + p.reserves + p.other) + '</td><td class="num">' + kr(p.vat) + '</td><td class="num">' + kr(p.net) + '</td></tr>'; }).join('');
    var X = b.totals;
    $('#po-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td class="num">' + X.n + '</td><td class="num">' + kr(X.sales) + '</td><td class="num">' + kr(X.refunds) + '</td><td class="num">' + kr(X.fee) + '</td><td class="num">' + kr(X.disputes + X.reserves + X.other) + '</td><td class="num">' + kr(X.vat) + '</td><td class="num">' + kr(X.net) + '</td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(b);
  }
  function accName(b, k) { return b.accounts[k] || S.ACCOUNTS[k] || ''; }
  function verHtml(b) {
    var t = L();
    return '<p>' + t.verLead(b.vouchers.length) + '</p><div class="tbl"><table id="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.konto + '</th><th>' + t.name + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      b.vouchers.map(function (v) { return '<tr class="vh"><td colspan="5"><strong>' + esc(v.serie + v.nr) + '</strong> ' + v.date + ' – ' + esc(v.text) + '</td></tr>' + v.trans.map(function (x) { return '<tr><td></td><td>' + x.konto + '</td><td>' + esc(accName(b, x.konto)) + '</td><td class="num">' + (x.amount > 0 ? kr(x.amount) : '') + '</td><td class="num">' + (x.amount < 0 ? kr(-x.amount) : '') + '</td></tr>'; }).join(''); }).join('') +
      '</tbody></table></div><p class="hint">' + t.help + '</p>';
  }
  function momsHtml(b) {
    var t = L(), rows = [[t.r05, 'r05'], [t.rVat(b), 'rVat']]; if (b.rc) rows.push([t.r21, 'r21'], [t.r30, 'r30'], [t.r48, 'r48']);
    if (!b.rate) rows = rows.slice(2);
    return '<p class="small">' + t.mLead + '</p><div class="tbl"><table id="moms-t"><thead><tr><th></th>' + b.months.map(function (m) { return '<th class="num">' + m.month + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + esc(r[0]) + '</td>' + b.months.map(function (m) { return '<td class="num">' + fmt(Math.round(m[r[1]] / 100), 0) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
  }
  function renderPaid(b) { b = b || current(); if (!b || !b.ok) return; $('#ver').innerHTML = verHtml(b); $('#moms').innerHTML = momsHtml(b); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function ready() { if (!PW.isUnlocked()) return null; var b = current(); return b && b.ok ? b : null; }
  function base(b) { return 'shopify-' + b.from + '_' + b.to; }
  function downloadSie() {
    var b = ready(), t = L(); if (!b) return;
    var y = b.from.slice(0, 4);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.opt.co || 'Företaget', orgnr: st.opt.orgnr, program: 'Bokföra Shopify (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10), rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: b.accounts, vouchers: b.vouchers }), base(b) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    var b = ready(), t = T.sv; if (!b) return;
    var X = b.totals;
    var sum = [[bold('Shopify Payments – bokföringsunderlag')], ['Företag', st.opt.co || ''], ['Organisationsnummer', st.opt.orgnr || ''], ['Utbetalningar', b.from + ' – ' + b.to], ['Fil', st.file || ''], ['Momssats försäljning', b.rate + ' %'], ['Omvänd skattskyldighet på avgifter', b.rc ? 'Ja' : 'Nej'], [],
      ['Försäljning brutto, kr', money(X.sales / 100)], ['Returer, kr', money(X.refunds / 100)], ['Utgående moms, kr', money(X.vat / 100)], ['Shopify-avgifter, kr', money(X.fee / 100)], ['Tvister, kr', money(X.disputes / 100)], ['Reserver, kr', money(X.reserves / 100)], ['Övrigt, kr', money(X.other / 100)], [bold('Till banken, kr'), money(X.net / 100)], [], [t.help]];
    var po = [[bold('Ver'), bold('Utbetalning'), bold('Id'), bold('Rader'), bold('Försäljning'), bold('Returer'), bold('Avgifter'), bold('Tvist/övrigt'), bold('Utg. moms'), bold('Till bank')]];
    b.payouts.forEach(function (p) { po.push([p.nr, p.date, p.pid || '', p.n, money(p.sales / 100), money(p.refunds / 100), money(p.fee / 100), money((p.disputes + p.reserves + p.other) / 100), money(p.vat / 100), money(p.net / 100)]); });
    var tx = [[bold('Transaktionsdatum'), bold('Typ'), bold('Order'), bold('Status'), bold('Utbetalning'), bold('Id'), bold('Amount'), bold('Fee'), bold('Net'), bold('Valuta')]];
    st.parsed.rows.forEach(function (r) { tx.push([r.date, r.type, r.order, r.status, r.pdate, r.pid, money(r.amount / 100), money(r.fee / 100), money(r.net / 100), r.currency]); });
    var ver = [[bold('Ver'), bold('Datum'), bold('Text'), bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit')]];
    b.vouchers.forEach(function (v) { v.trans.forEach(function (x) { ver.push([v.serie + v.nr, v.date, v.text, x.konto, accName(b, x.konto), x.amount > 0 ? money(x.amount / 100) : '', x.amount < 0 ? money(-x.amount / 100) : '']); }); });
    var mo = [[bold('Månad'), bold('Ruta 05'), bold('Ruta ' + (b.vatBox || '–')), bold('Ruta 21'), bold('Ruta 30'), bold('Ruta 48')]];
    b.months.forEach(function (m) { mo.push([m.month, money(m.r05 / 100), money(m.rVat / 100), money(m.r21 / 100), money(m.r30 / 100), money(m.r48 / 100)]); });
    var src = [[bold('Källor')], ['Shopify Help Center: Viewing and exporting your Shopify Payments payout details'], ['https://help.shopify.com/en/manual/payments/shopify-payments/payouts/view-details'], ['Shopify Help Center: Viewing your Shopify Payments payout fees (omvänd skattskyldighet i EU utom Irland)'], ['https://help.shopify.com/en/manual/payments/shopify-payments/payouts/pay-periods-and-fees'], ['Skatteverket: Omvänd betalningsskyldighet'], ['https://www.skatteverket.se/foretag/moms/sarskildamomsregler/omvandbetalningsskyldighet.4.47eb30f51122b1aaad28000258292.html'], ['BAS kontoplan 2026']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [36, 30] }, { name: 'Utbetalningar', rows: po, widths: [7, 12, 12, 7, 14, 14, 14, 14, 14, 14] }, { name: 'Transaktioner', rows: tx, widths: [12, 16, 10, 10, 12, 12, 12, 12, 12, 8] }, { name: 'Verifikationer', rows: ver, widths: [7, 12, 36, 8, 44, 14, 14] }, { name: 'Momsrutor', rows: mo, widths: [10, 14, 14, 14, 14, 14] }, { name: 'Källor', rows: src, widths: [110] }], { title: 'Shopify Payments' });
      K.download(buf, base(b) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = L().xlsxOk;
    } catch (e) { $('#dl-msg').textContent = L().fail; }
  }
  function printPack() {
    var b = ready(), t = L(); if (!b) return;
    $('#print-root').innerHTML = '<article class="card"><h1>' + esc((st.opt.co ? st.opt.co + ' – ' : '') + 'Shopify ' + b.from + ' – ' + b.to) + '</h1><p><strong>' + esc($('#check').textContent) + '</strong></p>' + $('#po-t').outerHTML + verHtml(b) + momsHtml(b) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, { opt: st.opt }); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.opt) st.opt = Object.assign({}, DEF, d.opt); }
  function load(parsed, name) { st.parsed = parsed; st.file = name || ''; $('#paid-out').hidden = true; $('#dl-msg').textContent = ''; render(); }
  function readFile(f) {
    if (!f) return; var t = L(); $('#status').textContent = t.reading; $('#status').className = 'status';
    f.arrayBuffer().then(function (ab) { return S.parseText(window.CSV.decode(new Uint8Array(ab)).text); })
      .then(function (p) { load(p, f.name); }, function () { st.parsed = null; $('#result').hidden = true; $('#status').textContent = t.statusErr; $('#status').className = 'status err'; });
  }
  var setLang = K.i18n(EN, function (l) { lang = l; render(); });
  var drop = $('#drop'), fileIn = $('#file');
  drop.addEventListener('click', function () { fileIn.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileIn.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { readFile(e.dataTransfer.files[0]); });
  fileIn.addEventListener('change', function () { readFile(fileIn.files[0]); fileIn.value = ''; });
  $('#sample').addEventListener('click', function () { load(S.parseText(S.sampleCsv()), 'exempel-shopify.csv'); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { opt: Object.assign({}, DEF), parsed: null, file: '' }; fill(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
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
