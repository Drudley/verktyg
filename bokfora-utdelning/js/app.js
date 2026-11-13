/* UI for Utdelning i aktiebolag – protokoll, bokföring och KU31. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, U = window.UTD, fmt = K.fmt, esc = K.esc;
  var lang = 'sv';
  var EN = {
    'bundle-p': '<a href="https://drudley.gumroad.com/l/byra" target="_blank" rel="noopener noreferrer">All tools for accounting firms – 990 SEK/year</a> incl. VAT. One licence key unlocks every tool, including the Danish ones and new tools as they are added.',
    'rel-h': 'Related tools', 'rel-all': 'All tools',
    h1: 'Dividends in a Swedish limited company – minutes, bookkeeping and KU31',
    lead: 'Enter the meeting date, the non-restricted equity and the shareholders. The tool splits the dividend per share, checks that it fits within <strong>non-restricted equity</strong>, works out <strong>Swedish dividend withholding tax (kupongskatt)</strong> for shareholders abroad and shows which forms are due and when – <strong>SKV 3700, 18a/18b and KU31</strong>. You get the postings on <strong>2091/2898</strong> and the meeting minutes as files.',
    'calc-h': 'Company and decision', sample: 'Show example', clear: 'Clear',
    'l-co': 'Company name', 'l-org': 'Corporate ID', 'l-stamma': 'Decided at', 'o-ars': 'Annual general meeting (adopts the accounts)', 'o-extra': 'Extraordinary general meeting (later in the year)',
    'l-date': 'Meeting date', 'l-pay-date': 'Payment date (blank = meeting date)', 'l-balansdag': 'Balance sheet date of the last adopted accounts',
    'ek-h': 'Equity and amount', 'l-fritt': 'Non-restricted equity per the balance sheet, SEK', 'l-tidigare': 'Distributions already decided since then, SEK', 'l-arsres': 'Profit for the year still on 2099, SEK (AGM)',
    'l-mode': 'Dividend entered', 'o-per': 'Per share', 'o-total': 'As a total', 'l-per': 'Dividend per share, SEK', 'l-total': 'Total dividend, SEK', 'l-ek': 'Total equity, SEK (optional, for the equity ratio)', 'l-bo': 'Total assets, SEK (optional)',
    'bk-h': 'Bookkeeping and minutes', 'l-from': 'Dividend taken from account', 'l-pay': 'Paid from account', 'l-serie': 'Voucher series', 'l-nr': 'First voucher number', 'l-place': 'Place of the meeting', 'l-chair': 'Chair of the meeting', 'l-secretary': 'Minutes taken by', 'l-adjuster': 'Minutes checked by', 'l-board': 'Board (names, comma separated)', 'l-auditor': 'Auditor (blank if none)',
    'h-h': 'Shareholders', add: 'Add shareholder',
    'h-items': 'Enter every shareholder with the number of shares in the share register. Choose <strong>lives abroad</strong> for non-residents – kupongskatt is then withheld (30 %, or lower under a tax treaty with a certificate of residence). Mark <strong>close-company owner</strong> for owners, managers and relatives (box 061 on KU31).',
    saved: 'Your entries are only saved in this browser. Nothing is sent anywhere.',
    'dl-h': 'Forms and deadlines', 'per-h': 'Per shareholder',
    'paid-h': 'Minutes, postings, SIE file and KU31 pack',
    'paid-p': 'Get the <strong>general meeting minutes</strong> with the dividend resolution and the <strong>board statement</strong> under Chapter 18 Section 4 of the Companies Act (for an EGM also the report under Section 6) as a Word file, the <strong>journal entries</strong> for the resolution, payment and withholding tax as an <strong>SIE file</strong>, and an <strong>Excel pack</strong> with the KU31 fields per person and the summary for SKV 3700. The documents are in Swedish.',
    open: 'Show minutes and postings', 'ver-h': 'Postings', 'ku-h': 'KU31 per person', 'prot-h': 'Meeting minutes (preview, in Swedish)',
    doc: 'Download minutes and statement (Word)', sie: 'Download SIE file', xlsx: 'Download Excel (KU31, SKV 3700)', print: 'Print',
    'cta-h': 'Before you set the amount:', 'cta-p': '<a href="../gransbelopp-utdelning/">Gränsbelopp 2026 – 3:12 calculator</a> shows how much can be taken at 20 % tax and whether salary or dividend pays off. If equity is tight, see <a href="../kontrollbalansrakning/">Kontrollbalansräkning from an SIE file</a>.',
    'pw-h': 'Minutes, postings and KU31 pack', 'pw-p': 'Unlock the minutes and board statement in Word, the journal entries as an SIE file and the Excel pack with KU31 and SKV 3700. The split, withholding tax and deadlines are always free.'
  };
  var TYPE = {
    sv: { 'se-person': 'Person, bor i Sverige', 'se-dodsbo': 'Dödsbo i Sverige', 'se-ab': 'Svenskt aktiebolag / juridisk person', 'fo-person': 'Person, bor utomlands', 'fo-ab': 'Utländskt bolag' },
    en: { 'se-person': 'Individual, Swedish resident', 'se-dodsbo': 'Swedish estate', 'se-ab': 'Swedish company / legal person', 'fo-person': 'Individual, lives abroad', 'fo-ab': 'Foreign company' } };
  var T = {
    sv: { result: 'Utdelning', name: 'Namn', id: 'Person-/org.nr (utländsk: födelsedatum)', type: 'Mottagare', shares: 'Antal aktier', fam: 'Fåmansdelägare (fält 061)', yes: 'Ja', no: 'Nej', rate: 'Kupongskatt %, bor utomlands', remove: 'Ta bort',
      holder: 'Aktieägare', pct: 'Andel', amount: 'Utdelning', kupong: 'Kupongskatt', net: 'Utbetalas', forms: 'Blanketter', sum: 'Summa',
      sTotal: 'Total utdelning', sPer: 'Per aktie', sKupong: 'Kupongskatt att hålla inne', sNet: 'Betalas ut netto', sLeft: 'Kvar av disponibelt belopp', sSol: 'Soliditet före → efter',
      meta: function (r) { return (r.stamma === 'ars' ? 'Årsstämma ' : 'Extra bolagsstämma ') + st.company.date + ' · ' + r.holders.length + ' aktieägare · ' + fmt(r.totals.shares) + ' aktier'; }, verH: 'Bokföring',
      ok: function (r) { return 'Utdelningen ' + kr(r.totals.total) + ' kr ryms i disponibelt belopp ' + kr(r.disp) + ' kr. Kvar efter beslutet: ' + kr(r.left) + ' kr.'; },
      over: function (r) { return 'Utdelningen ' + kr(r.totals.total) + ' kr är ' + kr(-r.left) + ' kr större än disponibelt belopp ' + kr(r.disp) + ' kr (fritt eget kapital minus redan beslutade värdeöverföringar). Den får inte beslutas – sänk beloppet.'; },
      statusOk: function (n) { return n + (n === 1 ? ' aktieägare räknad.' : ' aktieägare räknade.'); }, statusErr: 'Kontrollera de markerade fälten (datum ÅÅÅÅ-MM-DD, belopp, namn och antal aktier).',
      dlForm: 'Blankett', dlWho: 'Gäller', dlWhen: 'Sista dag',
      dl3700: 'Redovisning Utdelning (SKV 3700)', dl3700w: function (r) { return 'Alltid för kupongbolag – en per utdelningstillfälle (' + r.tillfalle + ')'; },
      dl18a: '18a (SKV 2331)', dl18aw: function (n) { return n + ' svensk juridisk person – bifogas SKV 3700'; }, dl18b: '18b (SKV 2332)', dl18bw: function (n) { return n + ' med hemvist utomlands – bifogas SKV 3700, hemvistintyg vid lägre skattesats'; },
      dlKs: 'Betala kupongskatt', dlKsw: function (r) { return kr(r.totals.kupong) + ' kr till Skatteverkets bankgiro 5926-1545'; },
      dlKU: 'KU31 (e-tjänst eller filöverföring)', dlKUw: function (n) { return n + ' fysiska personer / dödsbon'; },
      dlK10: 'K10 / K12 i delägarnas deklaration', dlK10w: 'Delägarna redovisar själva utdelningen och betalar skatten – inget dras av bolaget', dlK10d: 'deklarationen året efter',
      flag: { treaty: 'Aktieägare %n: lägre kupongskatt än 30 % kräver hemvistintyg (direktnedsättning) – och går inte för hemvist i Schweiz.', exempt: 'Aktieägare %n: 0 % kupongskatt för utländskt bolag kräver att ett undantag gäller (t.ex. EU-moderbolag med minst 10 %) – ange undantaget på SKV 3700.', fam: 'Aktieägare %n: inte markerad som fåmansdelägare – kontrollera. Är personen delägare, företagsledare eller närstående i ett fåmansföretag ska fält 061 kryssas.', ek: 'Eget kapital blir negativt efter utdelningen – kontrollera beloppen.', 'arsres-extra': 'Vid extra bolagsstämma bokförs ingen resultatdisposition – årets resultat på 2099 ignoreras.' },
      konto: 'Konto', text: 'Text', debit: 'Debet', kredit: 'Kredit', ver: 'Ver', date: 'Datum', verLead: function (n) { return n + ' verifikationer: beslut, utbetalning' + (n > 2 ? ' och kupongskatt.' : '.'); },
      kuLead: 'Fälten enligt Skatteverkets exempel. Lämnas senast 31 januari i e-tjänsten Lämna kontrolluppgifter.', kuNone: 'Ingen KU31 behövs – inga fysiska personer eller dödsbon har fått utdelning.',
      docOk: 'Word-filen är nedladdad.', xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte juridisk rådgivning eller skatterådgivning. Läs igenom protokollet och yttrandet och justera innan någon skriver under.' },
    en: { result: 'Dividend', name: 'Name', id: 'Personal/corporate ID (abroad: date of birth)', type: 'Recipient', shares: 'Number of shares', fam: 'Close-company owner (box 061)', yes: 'Yes', no: 'No', rate: 'Withholding tax %, lives abroad', remove: 'Remove',
      holder: 'Shareholder', pct: 'Share', amount: 'Dividend', kupong: 'Withholding tax', net: 'Paid out', forms: 'Forms', sum: 'Total',
      sTotal: 'Total dividend', sPer: 'Per share', sKupong: 'Withholding tax to withhold', sNet: 'Paid out net', sLeft: 'Left of distributable amount', sSol: 'Equity ratio before → after',
      verH: 'Postings', meta: function (r) { return (r.stamma === 'ars' ? 'AGM ' : 'EGM ') + st.company.date + ' · ' + r.holders.length + ' shareholders · ' + fmt(r.totals.shares) + ' shares'; },
      ok: function (r) { return 'The dividend of SEK ' + kr(r.totals.total) + ' fits within the distributable amount of SEK ' + kr(r.disp) + '. Left after the decision: SEK ' + kr(r.left) + '.'; },
      over: function (r) { return 'The dividend of SEK ' + kr(r.totals.total) + ' exceeds the distributable amount of SEK ' + kr(r.disp) + ' by SEK ' + kr(-r.left) + ' (non-restricted equity less distributions already decided). It may not be decided – lower the amount.'; },
      statusOk: function (n) { return n + (n === 1 ? ' shareholder calculated.' : ' shareholders calculated.'); }, statusErr: 'Check the marked fields (dates YYYY-MM-DD, amounts, names and number of shares).',
      dlForm: 'Form', dlWho: 'Applies to', dlWhen: 'Deadline',
      dl3700: 'Dividend return (SKV 3700)', dl3700w: function (r) { return 'Always for a non-Euroclear company – one per dividend date (' + r.tillfalle + ')'; },
      dl18a: '18a (SKV 2331)', dl18aw: function (n) { return n + ' Swedish legal person(s) – attached to SKV 3700'; }, dl18b: '18b (SKV 2332)', dl18bw: function (n) { return n + ' resident abroad – attached to SKV 3700, certificate of residence for a lower rate'; },
      dlKs: 'Pay withholding tax', dlKsw: function (r) { return 'SEK ' + kr(r.totals.kupong) + ' to the Tax Agency bankgiro 5926-1545'; },
      dlKU: 'KU31 (e-service or file transfer)', dlKUw: function (n) { return n + ' individuals / estates'; },
      dlK10: 'K10 / K12 in the owners\u2019 tax returns', dlK10w: 'The owners report the dividend and pay the tax themselves – the company withholds nothing', dlK10d: 'tax return the year after',
      flag: { treaty: 'Shareholder %n: withholding below 30 % needs a certificate of residence (relief at source) – and is not possible for residents of Switzerland.', exempt: 'Shareholder %n: 0 % for a foreign company requires an exemption (e.g. EU parent company with at least 10 %) – state it on SKV 3700.', fam: 'Shareholder %n: not marked as a close-company owner – check. Owners, managers and their relatives in a close company need box 061 ticked.', ek: 'Equity turns negative after the dividend – check the amounts.', 'arsres-extra': 'No appropriation of profit is posted at an EGM – the profit on 2099 is ignored.' },
      konto: 'Account', text: 'Text', debit: 'Debit', kredit: 'Credit', ver: 'No', date: 'Date', verLead: function (n) { return n + ' journal entries: resolution, payment' + (n > 2 ? ' and withholding tax.' : '.'); },
      kuLead: 'Fields as in the Tax Agency\u2019s examples. Due by 31 January in the e-service for statements of earnings.', kuNone: 'No KU31 needed – no individuals or estates received a dividend.',
      docOk: 'The Word file has been downloaded.', xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not legal or tax advice. Read the minutes and the statement and adjust them before anyone signs.' }
  };
  function L() { return T[lang]; }
  function kr(o) { return fmt(o / 100, 2); }
  var CKEYS = ['name', 'orgnr', 'stamma', 'date', 'payDate', 'balansdag', 'fritt', 'tidigare', 'arsres', 'mode', 'per', 'total', 'ek', 'bo', 'from', 'pay', 'serie', 'nr', 'place', 'chair', 'secretary', 'adjuster', 'board', 'auditor'];
  function emptyH() { return { name: '', id: '', type: 'se-person', shares: '', fam: '1', rate: '' }; }
  function emptyC() { return { stamma: 'ars', mode: 'per', from: '2091', pay: '1930', serie: 'A', nr: '1' }; }
  var st = { company: emptyC(), holders: [emptyH()] };

  function collect() {
    CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) st.company[k] = e.value.trim(); });
    st.holders = $$('#people .person').map(function (row) { var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o; });
    if (!st.holders.length) st.holders = [emptyH()];
  }
  function fillCompany() { var c = st.company, d = emptyC(); CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) e.value = c[k] != null ? c[k] : (d[k] || ''); }); modeUi(); }
  function modeUi() { var m = $('#f-mode').value; $('#f-per').closest('label').hidden = m !== 'per'; $('#f-total').closest('label').hidden = m !== 'total'; $('#f-arsres').closest('label').hidden = $('#f-stamma').value === 'extra'; }
  function sel(k, label, opts) { return '<label><span>' + label + '</span><select data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>'; }
  function inp(k, label, ph, mode) { return '<label><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="' + (mode || 'decimal') + '" placeholder="' + (ph || '') + '" autocomplete="off"></label>'; }
  function holderRow(p, i) {
    var t = L(), ty = TYPE[lang], el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.name + '</span><input type="text" data-k="name" placeholder="' + t.name + '" autocomplete="off"></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid">' + sel('type', t.type, U.TYPES.map(function (k) { return [k, ty[k]]; })) + inp('id', t.id, '19800101-0000', 'text') + inp('shares', t.shares, '100', 'numeric') +
      sel('fam', t.fam, [['1', t.yes], ['', t.no]]) + inp('rate', t.rate, '30') + '</div><p class="res"></p>';
    $$('[data-k]', el).forEach(function (f) { f.value = p[f.dataset.k] != null ? p[f.dataset.k] : ''; if (f.tagName === 'SELECT' && f.selectedIndex < 0) f.selectedIndex = 0; });
    var rateLabel = $('[data-k=rate]', el).closest('label'), famLabel = $('[data-k=fam]', el).closest('label');
    function typeUi() { var v = $('[data-k=type]', el).value; rateLabel.hidden = v.slice(0, 2) !== 'fo'; famLabel.hidden = !(v === 'se-person' || v === 'fo-person'); }
    typeUi();
    $('.del', el).addEventListener('click', function () { collect(); st.holders.splice(+el.dataset.i, 1); if (!st.holders.length) st.holders = [emptyH()]; paint(); render(); });
    $$('input,select', el).forEach(function (f) { f.addEventListener('input', function () { typeUi(); render(); }); f.addEventListener('change', function () { typeUi(); render(); }); });
    return el;
  }
  function paint() { var box = $('#people'); box.innerHTML = ''; st.holders.forEach(function (p, i) { box.appendChild(holderRow(p, i)); }); }
  function current() { collect(); return U.calc(st); }
  function isEmpty() { var c = st.company; return ['date', 'fritt', 'per', 'total'].every(function (k) { return !String(c[k] || '').trim(); }) && st.holders.every(function (h) { return !String(h.name || '').trim() && !String(h.shares || '').trim(); }); }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + v + '</strong></div>'; }
  function pct(x) { return fmt(x * 100, 1) + ' %'; }
  function perTxt(r) { return fmt(r.perShare, 4).replace(/0{1,2}$/, ''); }
  function formsTxt(h) { return h.forms.join(' + '); }

  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    $$('#calc .bad').forEach(function (x) { x.classList.remove('bad'); });
    $$('#people .person').forEach(function (e) { $('.res', e).textContent = ''; });
    persist(); modeUi();
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    var r = current(), rows = $$('#people .person');
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      r.errors.forEach(function (k) { var f = $('#f-' + k); if (f) f.classList.add('bad'); });
      r.bad.forEach(function (i) { var e = rows[i]; if (!e) return; r.holders[i].errors.forEach(function (k) { var f = $('[data-k=' + k + ']', e); if (f) f.classList.add('bad'); }); });
      return;
    }
    r.holders.forEach(function (h, i) { if (rows[i]) $('.res', rows[i]).textContent = t.amount + ' ' + kr(h.amount) + ' kr' + (h.kupong ? ' · ' + t.kupong + ' ' + kr(h.kupong) + ' kr' : '') + ' · ' + formsTxt(h); });
    res.hidden = false; status.textContent = t.statusOk(r.holders.length); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.orgnr ? st.company.orgnr + ' · ' : '') + t.meta(r);
    $('#check').className = 'check ' + (r.overLimit ? 'err' : 'ok'); $('#check').textContent = r.overLimit ? t.over(r) : t.ok(r);
    var T2 = r.totals;
    $('#stats').innerHTML = stat(t.sTotal, kr(T2.total) + ' kr') + stat(t.sPer, perTxt(r) + ' kr') + stat(t.sKupong, kr(T2.kupong) + ' kr') + stat(t.sNet, kr(T2.net) + ' kr') + stat(t.sLeft, kr(r.left) + ' kr') + (r.sol ? stat(t.sSol, pct(r.sol.before) + ' → ' + pct(r.sol.after)) : '');
    var fl = r.warnings.map(function (w) { return t.flag[w.k].replace('%n', String(w.n)); });
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    var dl = [[t.dl3700, t.dl3700w(r), r.dl3700]];
    if (T2.n18a) dl.push([t.dl18a, t.dl18aw(T2.n18a), r.dl3700]);
    if (T2.n18b) dl.push([t.dl18b, t.dl18bw(T2.n18b), r.dl3700]);
    if (T2.kupong) dl.push([t.dlKs, t.dlKsw(r), r.dl3700]);
    if (T2.nKU31) dl.push([t.dlKU, t.dlKUw(T2.nKU31), r.dlKU31]);
    if (r.holders.some(function (h) { return h.type === 'se-person' || h.type === 'se-dodsbo'; })) dl.push([t.dlK10, t.dlK10w, t.dlK10d]);
    $('#dl-t thead').innerHTML = '<tr><th>' + t.dlForm + '</th><th>' + t.dlWho + '</th><th>' + t.dlWhen + '</th></tr>';
    $('#dl-t tbody').innerHTML = dl.map(function (x) { return '<tr><td><strong>' + esc(x[0]) + '</strong></td><td>' + esc(x[1]) + '</td><td class="num">' + esc(x[2]) + '</td></tr>'; }).join('');
    $('#per-t thead').innerHTML = '<tr><th>' + t.holder + '</th><th class="num">' + t.shares + '</th><th class="num">' + t.pct + '</th><th class="num">' + t.amount + '</th><th class="num">' + t.kupong + '</th><th class="num">' + t.net + '</th><th>' + t.forms + '</th></tr>';
    $('#per-t tbody').innerHTML = r.holders.map(function (h) {
      return '<tr><td>' + esc(h.name) + '<br><span class="muted small">' + TYPE[lang][h.type] + (h.fam ? ' · 061' : '') + (h.foreign ? ' · ' + fmt(h.rate, h.rate % 1 ? 1 : 0) + ' %' : '') + '</span></td><td class="num">' + fmt(h.shares) + '</td><td class="num">' + pct(h.pct) + '</td><td class="num">' + kr(h.amount) + '</td><td class="num">' + kr(h.kupong) + '</td><td class="num">' + kr(h.net) + '</td><td>' + formsTxt(h) + '</td></tr>';
    }).join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td class="num">' + fmt(T2.shares) + '</td><td class="num">100,0 %</td><td class="num">' + kr(T2.total) + '</td><td class="num">' + kr(T2.kupong) + '</td><td class="num">' + kr(T2.net) + '</td><td></td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    renderTeaser(r);
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  // Free preview of the first journal entry + one buy CTA (shown only while locked; the licence-key flow stays in #paywall).
  var TZ = { sv: { h: 'Gratis förhandsvisning – första verifikationen', more: function (n) { return n > 0 ? 'Den fullständiga versionen innehåller ' + n + (n === 1 ? ' verifikation till.' : ' verifikationer till.') : ''; }, lead: 'Lås upp stämmoprotokollet och styrelsens yttrande, all bokföring som SIE-fil, KU31-underlaget per person, Excel och utskrift.', buy: 'Köp för ', note: 'Engångsköp via Gumroad. Licensnyckeln kommer på e-post – klistra in den via knappen nedan.' },
    en: { h: 'Free preview – the first journal entry', more: function (n) { return n > 0 ? 'The full version has ' + n + (n === 1 ? ' more entry.' : ' more entries.') : ''; }, lead: 'Unlock the meeting minutes and the board statement, all postings as a SIE file, the KU31 data per person, Excel and print.', buy: 'Buy for ', note: 'One-off purchase via Gumroad. The licence key arrives by e-mail – paste it via the button below.' } };
  function renderTeaser(r) {
    var box = $('#teaser'); if (!box) return;
    var show = !PW.isUnlocked() && !!(r && r.vouchers && r.vouchers.length); box.hidden = !show; $('#paid-open').classList.toggle('ghost', show);
    if (!show) { box.innerHTML = ''; return; }
    var z = TZ[lang] || TZ.sv, t = L(), v = r.vouchers[0], url = /^https:\/\/[\w.-]*gumroad\.com\//.test(CFG.GUMROAD_PRODUCT_URL || '') ? CFG.GUMROAD_PRODUCT_URL : '';
    box.innerHTML = '<h3>' + z.h + '</h3><div class="tbl"><table id="tz-t"><thead><tr><th>' + t.konto + '</th><th></th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody><tr class="vh"><td colspan="4"><strong>' + esc(v.serie + v.nr) + '</strong> ' + v.date + ' – ' + esc(v.text || '') + '</td></tr>' +
      v.trans.map(function (x) { return '<tr><td>' + x.konto + '</td><td>' + esc((r.accounts[x.konto] || '')) + '</td><td class="num">' + (x.amount > 0 ? fmt(x.amount / 100, 2) : '') + '</td><td class="num">' + (x.amount < 0 ? fmt(-x.amount / 100, 2) : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="muted small">' + z.more(r.vouchers.length - 1) + '</p><p class="tz-lead"><strong>' + z.lead + '</strong></p>' +
      (url ? '<p><a class="btn" id="tz-buy" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + z.buy + esc(CFG.PRICE_LABEL) + '</a></p>' : '') + '<p class="muted small">' + z.note + '</p>';
  }
  function verTable(r, list) {
    var t = L();
    return '<div class="tbl"><table class="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.date + '</th><th>' + t.konto + '</th><th>' + t.text + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      list.map(function (v) { return v.trans.map(function (x, j) { var a = x.amount / 100; return '<tr><td>' + (j ? '' : esc(v.serie) + v.nr) + '</td><td>' + (j ? '' : v.date) + '</td><td>' + x.konto + '</td><td>' + esc(r.accounts[x.konto] || '') + '</td><td class="num">' + (a > 0 ? fmt(a, 2) : '') + '</td><td class="num">' + (a < 0 ? fmt(-a, 2) : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>';
  }
  function kuTable(r) {
    var t = L(), rows = U.ku31Rows(r, st.company);
    if (!rows.length) return '<p>' + t.kuNone + '</p>';
    return '<p class="small">' + t.kuLead + '</p><div class="tbl"><table><thead><tr><th>570</th><th>201</th><th>215 / 222</th><th>' + t.name + '</th><th class="num">574</th><th>571</th><th>061</th></tr></thead><tbody>' +
      rows.map(function (k) { return '<tr><td>' + k.f570 + '</td><td>' + esc(k.f201) + '</td><td>' + esc(k.f215 || k.f222) + '</td><td>' + esc(k.name) + '</td><td class="num">' + fmt(k.f574) + '</td><td>' + esc(k.f571) + '</td><td>' + k.f061 + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }
  /* ---- Swedish legal documents (minutes, board statement, EGM report) ---- */
  function P(s) { return '<p>' + s + '</p>'; }
  function H(s) { return '<h3>' + s + '</h3>'; }
  function v(s, ph) { s = String(s || '').trim(); return s ? esc(s) : '[' + ph + ']'; }
  function sigs(names) { return '<table class="sig"><tr>' + names.map(function (n) { return '<td><br><br>………………………………<br>' + v(n, 'namn') + '</td>'; }).join('') + '</tr></table>'; }
  function docsHtml(r) {
    var c = st.company, ars = r.stamma === 'ars', bd = v(c.balansdag, 'balansdag'), co = v(c.name, 'bolagets namn'), org = v(c.orgnr, 'org.nr'), per = perTxt(r), aud = String(c.auditor || '').trim();
    var board = String(c.board || '').split(',').map(function (x) { return x.trim(); }).filter(Boolean); if (!board.length) board = [''];
    var n = 0, sec = function (title, body) { n++; return H('§ ' + n + ' ' + title) + body; };
    var o = '<h2>Protokoll fört vid ' + (ars ? 'årsstämma' : 'extra bolagsstämma') + ' i ' + co + ', org.nr ' + org + '</h2>' +
      P('Datum: ' + v(c.date, 'datum') + '<br>Plats: ' + v(c.place, 'ort')) +
      '<p><strong>Närvarande aktieägare</strong> (enligt aktieboken, en röst per aktie):</p><table><tr><th>Aktieägare</th><th class="num">Aktier</th><th class="num">Röster</th></tr>' +
      r.holders.map(function (h) { return '<tr><td>' + esc(h.name) + '</td><td class="num">' + fmt(h.shares) + '</td><td class="num">' + fmt(h.shares) + '</td></tr>'; }).join('') +
      '<tr><td><strong>Summa</strong></td><td class="num"><strong>' + fmt(r.totals.shares) + '</strong></td><td class="num"><strong>' + fmt(r.totals.shares) + '</strong></td></tr></table>';
    o += sec('Stämmans öppnande', P('Stämman öppnades av ' + v(c.chair, 'ordförande') + '.'));
    o += sec('Val av ordförande och protokollförare', P(v(c.chair, 'ordförande') + ' valdes till ordförande vid stämman. ' + v(c.secretary, 'protokollförare') + ' utsågs att föra protokollet.'));
    o += sec('Upprättande och godkännande av röstlängd', P('Förteckningen över närvarande aktieägare ovan godkändes som röstlängd.'));
    o += sec('Godkännande av dagordning', P('Den föreslagna dagordningen godkändes.'));
    o += sec('Val av justerare', P(v(c.adjuster, 'justerare') + ' valdes att jämte ordföranden justera protokollet.'));
    o += sec('Prövning av om stämman blivit behörigen sammankallad', P('Samtliga aktieägare var närvarande och stämman förklarades behörigen sammankallad.'));
    if (ars) {
      o += sec('Framläggande av årsredovisning' + (aud ? ' och revisionsberättelse' : ''), P('Årsredovisningen' + (aud ? ' och revisionsberättelsen' : '') + ' för räkenskapsåret som slutade ' + bd + ' lades fram.'));
      o += sec('Fastställelse av resultaträkning och balansräkning', P('Stämman beslutade att fastställa resultaträkningen och balansräkningen per ' + bd + '.'));
      o += sec('Beslut om dispositioner beträffande bolagets vinst enligt den fastställda balansräkningen', P('Stämman beslutade, i enlighet med styrelsens förslag, att av till stämmans förfogande stående medel, ' + kr(r.disp) + ' kr, dela ut ' + kr(r.totals.total) + ' kr (' + per + ' kr per aktie) till aktieägarna och att återstående ' + kr(r.left) + ' kr balanseras i ny räkning. Utbetalning sker den ' + r.payDate + '.'));
      o += sec('Beslut om ansvarsfrihet', P('Stämman beviljade styrelsens ledamöter ansvarsfrihet för förvaltningen under räkenskapsåret.'));
      o += sec('Val av styrelse' + (aud ? ' och revisor' : ''), P('Till styrelseledamöter för tiden intill slutet av nästa årsstämma valdes ' + board.map(function (b) { return v(b, 'namn'); }).join(', ') + '.' + (aud ? ' Till revisor valdes ' + esc(aud) + '.' : '')));
    } else {
      o += sec('Beslut om vinstutdelning', P('Styrelsens förslag till vinstutdelning med yttrande enligt 18 kap. 4 § aktiebolagslagen och handlingar enligt 18 kap. 6 § har hållits tillgängliga för aktieägarna och lades fram på stämman.') +
        P('Stämman beslutade i enlighet med styrelsens förslag om vinstutdelning med ' + kr(r.totals.total) + ' kr (' + per + ' kr per aktie). Utbetalning sker den ' + r.payDate + '. Av det enligt 17 kap. 3 § första stycket aktiebolagslagen disponibla beloppet, ' + kr(r.disp) + ' kr enligt balansräkningen per ' + bd + ', återstår ' + kr(r.left) + ' kr efter beslutet.'));
    }
    o += sec('Stämmans avslutande', P('Ordföranden förklarade stämman avslutad.'));
    o += '<p>Vid protokollet:</p>' + sigs([c.secretary]) + '<p>Justeras:</p>' + sigs([c.chair, c.adjuster]);
    o += '<div class="pb"></div><h2>Styrelsens förslag till vinstutdelning och yttrande enligt 18 kap. 4 § aktiebolagslagen</h2>' +
      P('Styrelsen i ' + co + ', org.nr ' + org + ', föreslår att bolagsstämman beslutar om vinstutdelning med ' + per + ' kr per aktie, totalt ' + kr(r.totals.total) + ' kr, och att utbetalning sker den ' + r.payDate + '.' +
        (ars ? '' : ' Av det enligt 17 kap. 3 § första stycket aktiebolagslagen disponibla beloppet, ' + kr(r.disp) + ' kr, återstår ' + kr(r.left) + ' kr efter den föreslagna utdelningen (18 kap. 5 §).')) +
      '<p><strong>Yttrande</strong></p>' +
      P('Bolagets fria egna kapital enligt balansräkningen per ' + bd + ' uppgår till ' + kr(r.fritt) + ' kr' + (ars && r.arsres ? ', varav årets resultat ' + kr(r.arsres) + ' kr' : '') + '.' + (r.tidigare ? ' Värdeöverföringar om ' + kr(r.tidigare) + ' kr har beslutats efter balansdagen.' : '') +
        ' Efter den föreslagna utdelningen återstår ' + kr(r.left) + ' kr och det finns full täckning för bolagets bundna egna kapital.' + (r.sol ? ' Soliditeten uppgår före utdelningen till ' + pct(r.sol.before) + ' och efter utdelningen till ' + pct(r.sol.after) + '.' : '')) +
      P('Styrelsen anser att den föreslagna utdelningen är försvarlig med hänsyn till de krav som verksamhetens art, omfattning och risker ställer på storleken av det egna kapitalet och bolagets konsolideringsbehov, likviditet och ställning i övrigt (17 kap. 3 § andra och tredje styckena aktiebolagslagen). Bolagets likviditet bedöms vara tillräcklig för att fullgöra dess förpliktelser även efter utdelningen. [Komplettera med styrelsens egen bedömning.]') +
      P('Inga tillgångar eller skulder har värderats till verkligt värde enligt 4 kap. 14 a § årsredovisningslagen. [Ändra om sådan värdering har skett.]') +
      P(v(c.place, 'ort') + ' den ………………') + sigs(board);
    if (!ars) {
      o += '<div class="pb"></div><h2>Redogörelse enligt 18 kap. 6 § 3 aktiebolagslagen</h2>' +
        P('Efter att årsredovisningen för räkenskapsåret som slutade ' + bd + ' lämnades har inga händelser av väsentlig betydelse för bolagets ställning inträffat. [Beskriv annars händelserna, t.ex. större avtal, lån eller förluster.]') +
        P(r.tidigare ? 'Under samma tid har värdeöverföringar om ' + kr(r.tidigare) + ' kr beslutats.' : 'Inga värdeöverföringar har beslutats under samma tid.') +
        P('Bolagets bundna egna kapital har inte förändrats efter balansdagen.') + P(v(c.place, 'ort') + ' den ………………') + sigs(board) +
        '<p><strong>Bilagor till förslaget (18 kap. 6 §)</strong></p><ul><li>Kopia av årsredovisningen med balansräkningen per ' + bd + '</li>' + (aud ? '<li>Kopia av revisionsberättelsen</li><li>Revisorns yttrande över redogörelsen ovan</li>' : '') + '<li>Styrelsens yttrande enligt 18 kap. 4 §</li><li>Denna redogörelse</li></ul>';
    }
    return o;
  }
  function verHtml(r) { var t = L(); return '<p>' + t.verLead(r.vouchers.length) + '</p>' + verTable(r, r.vouchers) + '<p class="hint">' + t.help + '</p>'; }
  function renderPaid(r) { r = r || current(); if (!r.ok) return; $('#ver').innerHTML = verHtml(r); $('#ku').innerHTML = kuTable(r); $('#prot').innerHTML = docsHtml(r); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function base(r) { return 'utdelning-' + (st.company.date || r.tillfalle); }
  function ready() { if (!PW.isUnlocked()) return null; var r = current(); return r.ok && !isEmpty() ? r : null; }

  function downloadDoc() {
    var r = ready(), t = L(); if (!r) return;
    var css = 'body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h2{font-size:14pt}h3{font-size:11pt;margin:12pt 0 2pt}table{border-collapse:collapse}td,th{padding:2pt 8pt 2pt 0;text-align:left;vertical-align:top}.num{text-align:right}.sig td{padding-right:40pt}.pb{page-break-before:always}';
    var html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>Protokoll</title><style>' + css + '</style></head><body>' + docsHtml(r) + '</body></html>';
    try { K.download('\ufeff' + html, base(r) + '-protokoll.doc', 'application/msword'); $('#dl-msg').textContent = t.docOk; } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function downloadSie() {
    var r = ready(), t = L(); if (!r) return;
    var y = r.vouchers[0].date.slice(0, 4);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.company.name || 'Företaget', orgnr: st.company.orgnr, program: 'Utdelning i aktiebolag (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10),
        rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: r.accounts, vouchers: r.vouchers }), base(r) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(x) { return { v: x, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  var TYPE_SV = TYPE.sv;
  async function downloadXlsx() {
    var r = ready(), t = L(); if (!r) return;
    var c = st.company, T2 = r.totals;
    var sum = [[bold('Utdelning i aktiebolag')], ['Bolag', c.name || ''], ['Organisationsnummer', c.orgnr || ''], ['Beslut', r.stamma === 'ars' ? 'Årsstämma' : 'Extra bolagsstämma'], ['Stämmodatum', c.date], ['Utbetalningsdag / utdelningstillfälle', r.payDate], ['Balansdag', c.balansdag || ''], [],
      ['Fritt eget kapital enligt balansräkningen, kr', money(r.fritt / 100)], ['Redan beslutade värdeöverföringar, kr', money(r.tidigare / 100)], ['Disponibelt belopp, kr', money(r.disp / 100)], ['Total utdelning, kr', money(T2.total / 100)], ['Kvar efter beslutet, kr', money(r.left / 100)],
      ['Antal aktier', T2.shares], ['Utdelning per aktie, kr', r.perShare], ['Innehållen kupongskatt, kr', money(T2.kupong / 100)], ['Utbetalas netto, kr', money(T2.net / 100)]];
    if (r.sol) { sum.push(['Soliditet före', fmt(r.sol.before * 100, 1) + ' %']); sum.push(['Soliditet efter', fmt(r.sol.after * 100, 1) + ' %']); }
    sum.push([]); sum.push(['Sista dag SKV 3700 (och 18a/18b, kupongskatt)', r.dl3700]); sum.push(['Sista dag KU31', r.dlKU31]); sum.push([]); sum.push([t.help]);
    var hs = [[bold('Aktieägare'), bold('Person-/org.nr'), bold('Mottagare'), bold('Aktier'), bold('Andel %'), bold('Fåmansdelägare (061)'), bold('Kupongskatt %'), bold('Utdelning'), bold('Kupongskatt'), bold('Utbetalas'), bold('Blanketter')]];
    r.holders.forEach(function (h) { hs.push([h.name, h.id, TYPE_SV[h.type], h.shares, Math.round(h.pct * 10000) / 100, h.fam ? 'X' : '', h.foreign ? h.rate : '', money(h.amount / 100), money(h.kupong / 100), money(h.net / 100), formsTxt(h)]); });
    var ku = [[bold('570 Specifikationsnummer'), bold('201 Org.nr utbetalare'), bold('215 Person-/org.nr'), bold('222 Födelsetid (utländsk)'), bold('Namn'), bold('574 Utdelning, brutto (kr)'), bold('571 Namn på aktien'), bold('061 Fåmansföretag'), bold('001 Avdragen skatt')]];
    U.ku31Rows(r, c).forEach(function (k) { ku.push([k.f570, k.f201, k.f215, k.f222, k.name, k.f574, k.f571, k.f061, k.f001]); });
    ku.push([]); ku.push(['Lämnas senast ' + r.dlKU31 + ' i Skatteverkets e-tjänst Lämna kontrolluppgifter. För personer som bor utomlands: lägg till namn, adress och TIN (fält 216–221, 252, 076); kupongskattefälten lämnas tomma eftersom de redovisas på 18b.']);
    var s37 = [[bold('Underlag till Redovisning Utdelning (SKV 3700)')], ['Utdelande bolag', c.name || ''], ['Organisationsnummer', c.orgnr || ''], ['Utdelningstillfälle', r.tillfalle], ['Utdelning per aktie, kr', r.perShare], ['Antal aktier', T2.shares], ['Total utdelning, kr', money(T2.total / 100)],
      ['varav till fysiska personer och dödsbon i Sverige (KU31), kr', money(r.holders.filter(function (h) { return !h.foreign && h.forms.indexOf('KU31') >= 0; }).reduce(function (a, h) { return a + h.amount; }, 0) / 100)],
      ['varav till svenska juridiska personer (18a), kr', money(T2.a18 / 100)], ['varav till begränsat skattskyldiga (18b), kr', money(T2.b18 / 100)], ['Innehållen kupongskatt, kr', money(T2.kupong / 100)], ['Utbetald utdelning, kr', money(T2.net / 100)], ['Antal blanketter 18a', T2.n18a], ['Antal blanketter 18b', T2.n18b], [],
      ['Sista dag att lämna och betala', r.dl3700], ['Betalning', 'Skatteverkets bankgiro 5926-1545, referens bolagets namn och organisationsnummer'], ['Adress', 'Skatteverket, Kupongskatt, Box 6037, 171 06 Solna'], [], ['Fältnumren på SKV 3700 framgår av blanketten – stäm av beloppen ovan mot den.']];
    var ver = [[bold('Ver'), bold('Datum'), bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit'), bold('Text')]];
    r.vouchers.forEach(function (vv) { vv.trans.forEach(function (x, j) { var a = x.amount / 100; ver.push([j ? '' : vv.serie + vv.nr, j ? '' : vv.date, x.konto, r.accounts[x.konto] || '', a > 0 ? money(a) : '', a < 0 ? money(-a) : '', j ? '' : vv.text]); }); });
    var src = [[bold('Källor')], ['Skatteverket: För dig som lämnat utdelning från ditt aktiebolag (kupongbolag)'], ['https://www.skatteverket.se/foretag/internationellt/kupongskatt/fordigsomlamnatutdelningfrandittaktiebolagkupongbolag.4.6e8a1495181dad540842ee.html'], ['Skatteverket: Exempel på hur du fyller i KU31'], ['https://www.skatteverket.se/foretag/skatterochavdrag/kontrolluppgifter/kontrolluppgiftomutdelningmedmerapadelagarrattku31/exempelpahurdufyllerikontrolluppgiftenomutdelningmmpadelagarratt.4.3810a01c150939e893f289fc.html'], ['Kupongskattelag (1970:624) 4–5 §§'], ['Aktiebolagslag (2005:551) 17 kap. 3 §, 18 kap. 2–7 §§'], ['BAS kontoplan 2026: 2091, 2098, 2099, 2898, 2899, 1930']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [48, 40] }, { name: 'Aktieägare', rows: hs, widths: [30, 16, 30, 9, 9, 12, 12, 14, 14, 14, 14] }, { name: 'KU31', rows: ku, widths: [12, 16, 16, 16, 30, 14, 30, 10, 10] }, { name: 'SKV 3700', rows: s37, widths: [56, 60] }, { name: 'Kontering', rows: ver, widths: [8, 12, 8, 40, 14, 14, 50] }, { name: 'Källor', rows: src, widths: [120] }], { title: 'Utdelning' });
      K.download(buf, base(r) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    var r = ready(); if (!r) return;
    $('#print-root').innerHTML = '<article class="card">' + docsHtml(r) + '</article><article class="card pb"><h2>' + L()['ku-h'] + '</h2>' + kuTable(r) + '<h2>' + L().verH + '</h2>' + verTable(r, r.vouchers) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.holders) && d.holders.length) { st = d; return true; } return false; }

  var setLang = K.i18n(EN, function (l) { lang = l; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.holders.push(emptyH()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = U.sample(); fillCompany(); paint(); render(); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { company: emptyC(), holders: [emptyH()] }; fillCompany(); paint(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('#calc > .grid input, #calc > .grid select').forEach(function (f) { f.addEventListener('input', render); f.addEventListener('change', render); });
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#doc').addEventListener('click', downloadDoc);
  $('#sie').addEventListener('click', downloadSie);
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  restore(); fillCompany();
  paint();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else render();
})();
