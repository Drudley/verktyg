/* Kontrollbalansräkning från SIE-fil – UI.
 * Free: SIE import or manual figures, justerat eget kapital (14 §: incl. periodens resultat and 79,4 % of obeskattade reserver),
 *   test vs half the registered aktiekapital (13 §), month-end table.
 * Paid (behind js/paywall.js): adjustments (14 § p.1–3) with deferred tax, printable KBR, timeline, kallelse/protokoll text, XLSX, save.
 * Documents stay in Swedish (they are filed / presented in Sweden); the UI has an English toggle. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, K = window.KBR, lang = 'sv';
  var st = { doc: null, mode: null, series: [], dates: [], date: '', registered: null, adjustments: [], manual: null, name: '', org: '' };

  var EN = {
    h1: 'Kontrollbalansräkning – has half the share capital been used up?',
    lead: 'Drop in the <strong>SIE file</strong> from Fortnox, Visma, Bokio, Björn Lundén or any other Swedish accounting program. You instantly see <strong>adjusted equity at every month-end</strong> – including the result for the period and untaxed reserves split into equity and deferred tax – against <strong>half the share capital</strong> (Companies Act ch. 25 § 13). <strong>Everything happens in your browser – the books never leave your computer.</strong>',
    drop: 'Drop the SIE file here or <u>choose file</u>', dropsub: '.se · SIE 4 with vouchers gives equity per month · SIE 1–3 gives the year-end position · PC8/CP437, UTF-8',
    sample: 'Try a synthetic example', 'man-h': '…or enter the figures from the balance sheet report',
    'man-p': 'Amounts in SEK. Equity must include the result so far this year (even if not closed).',
    'm-ak': 'Registered share capital', 'm-ek': 'Other equity incl. result', 'm-or': 'Untaxed reserves', 'm-avs': 'Provisions', 'm-lang': 'Long-term liabilities', 'm-kort': 'Current liabilities', 'm-date': 'As of date', 'man-go': 'Calculate',
    'd-l': 'As of date', 'ak-l': 'Registered share capital', 'c-h': 'How equity is calculated under ch. 25 § 14',
    'mo-h': 'Adjusted equity at each month-end', 'mo-p': 'Booked equity + result for the period + 79.4 % of untaxed reserves, before valuation adjustments. Red = below half the share capital. The first red row is roughly when the board should at the latest have prepared a kontrollbalansräkning.',
    'c-date': 'Date', 'c-ekb': 'Booked equity', 'c-or': '+ Reserves (79.4 %)', 'c-ekj': 'Adjusted equity', 'c-half': 'Half share capital', 'c-st': 'Status',
    'paid-h': 'Kontrollbalansräkning, adjustments, deadlines and meeting texts',
    'paid-p': 'Add <strong>adjustments under ch. 25 § 14</strong> (surplus values, net realisable values, state aid) with reasons and deferred tax. Get a <strong>print-ready kontrollbalansräkning</strong> – booked, adjustment and KBR value per line, adjustments reported separately, the capital test and signatures – plus <strong>deadlines</strong> for the first and second control meeting, <strong>notice and minutes</strong> and an Excel file. Documents are in Swedish.',
    open: 'Make the kontrollbalansräkning', 'adj-h': 'Adjustments under ch. 25 § 14',
    'adj-p': 'Positive amount = the line gets bigger (e.g. +50 000 on a property with a surplus value); negative = smaller (e.g. -10 000 on a state-aid liability that need not be reported). “Tax” deducts 20.6 % deferred tax on upward revaluations – cautious and common, check with the auditor.',
    'adj-add': 'Add adjustment', 'b-h': 'Company, board and dates', 'b-name': 'Company name', 'b-org': 'Org. number', 'b-ort': 'Town', 'b-board': 'Board members (one per line)',
    'b-kbr': 'KBR prepared on', 'b-st1': 'First control meeting', 'b-rev': 'The company has an auditor', 'b-k3': 'The company applies K3 (otherwise K2)',
    'doc-h': 'Kontrollbalansräkning', print: 'Print / save as PDF', 'tl-h': 'Deadlines', 'kal-h': 'Notice of the first control meeting', 'pro-h': 'Minutes of the control meeting (template)', copy: 'Copy',
    xlsx: 'Download Excel (.xlsx)', save: 'Save adjustments in the browser', 'price-note': 'The capital test and the month table are always free.',
    'rev-h': 'Before the board signs',
    'rev-1': 'The kontrollbalansräkning is prepared under the Annual Accounts Act and the company’s normal principles (K2 or K3) – <strong>book the period’s closing entries first</strong>: depreciation, accruals, inventory valuation, accrued costs and tax.',
    'rev-2': 'If the company has an auditor, the auditor must <strong>review</strong> the kontrollbalansräkning and the statement is presented at the meeting. No auditor: ch. 1 § 12 b – the auditor rules only apply to companies that have one.',
    'rev-3': 'A <strong>subordinated loan</strong> or a loan from the owner is not equity. Equity is restored by e.g. a shareholder contribution, a new share issue, reducing the share capital or profit.',
    'rev-4': 'The tool gives no legal advice. The board is responsible for the valuations and for meeting the deadlines.',
    'pw-h': 'Kontrollbalansräkning and control meeting', 'pw-p': 'Unlock adjustments under ch. 25 § 14, the print-ready kontrollbalansräkning, deadlines, notice and minutes and the Excel file. Reading, the capital test and the month table are always free.',
    'sie-link': 'Want the whole ledger in Excel? <a href="../sie-till-excel/">Open the SIE file in SIE to Excel</a>.',
    'pension-link': 'Before you close the books you can also work out how much the company may contribute to occupational pension in <a href="../pensionsavsattning-aktiebolag/">Pension contribution in a limited company</a>.'
  };
  var SV = {};
  var T = {
    sv: {
      reading: 'Läser fil…', err: 'Kunde inte läsa filen: ', notsie: 'Det här ser inte ut som en SIE-fil (inga #-rader hittades).',
      loaded: function (n, e, v) { return 'Klart: ' + n + ' · ' + e + ' · ' + v + ' verifikationer'; }, manual: 'Manuellt inmatade siffror',
      noyear: 'Filen saknar räkenskapsår (#RAR 0).', badnum: 'Kontrollera beloppen – ett fält kunde inte läsas.',
      st: { ak: 'Registrerat aktiekapital', half: 'Hälften', ekb: 'Bokfört EK inkl. resultat', ekj: 'Justerat EK (14 §)', marg: 'Marginal mot gränsen' },
      okv: function (e, h, m) { return '<strong>Över gränsen.</strong> Justerat eget kapital ' + e + ' kr är högre än hälften av aktiekapitalet (' + h + ' kr) med ' + m + ' kr. Ingen kontrollbalansräkning behövs vid detta datum – men håll koll om bolaget går med förlust.'; },
      badv: function (e, h, m) { return '<strong>Under hälften av aktiekapitalet.</strong> Justerat eget kapital ' + e + ' kr är lägre än ' + h + ' kr (saknas ' + m + ' kr). Styrelsen ska <strong>genast</strong> upprätta en kontrollbalansräkning och låta revisorn granska den (25 kap. 13 § ABL) – annars riskerar ledamöterna personligt betalningsansvar (18 §). Värderingsjusteringar enligt 14 § kan ändra bilden.'; },
      near: 'Nära gränsen: marginalen är mindre än 20 % av aktiekapitalet.',
      pv: function (c) { return c.underHalf ? '<strong>Kontrollbalansräkningen visar att eget kapital (' + c.e + ' kr) understiger hälften av aktiekapitalet (' + c.h + ' kr).</strong> Kalla till första kontrollstämma snarast möjligt. För att fortsätta utan likvidation måste eget kapital vid andra kontrollstämman vara minst hela aktiekapitalet – det saknas i dag ' + c.n2 + ' kr.' : (c.full ? '<strong>Kontrollbalansräkningen visar att eget kapital (' + c.e + ' kr) uppgår till minst hela aktiekapitalet.</strong> Kapitalbristen är läkt.' : '<strong>Efter justeringarna är eget kapital (' + c.e + ' kr) minst hälften av aktiekapitalet.</strong> Kontrollstämma krävs inte enligt 15 § – men en andra kontrollbalansräkning måste visa hela aktiekapitalet (' + c.r + ' kr) om stämman redan har hållits; saknas ' + c.n2 + ' kr.'); },
      flags: { diff: function (d) { return 'Balansräkningen går inte ihop: skillnad ' + d + ' kr mellan tillgångar och eget kapital + skulder. Saknas ingående balanser (#IB) eller är föregående års bokslut inte överfört?'; },
        unk: function (d) { return 'Konton utanför 1000–8999 med saldo ' + d + ' kr räknas inte med.'; },
        akdiff: function (b, r) { return 'Konto 2081 visar ' + b + ' kr men du har angett registrerat aktiekapital ' + r + ' kr. Gränsen räknas på det <em>registrerade</em> beloppet hos Bolagsverket.'; },
        noak: 'Konto 2081 (aktiekapital) saknar saldo. Fyll i det registrerade aktiekapitalet.',
        ejreg: function (v) { return 'Konto 2082 (ej registrerat aktiekapital) har ' + v + ' kr. Det räknas in i eget kapital men höjer inte gränsen förrän det är registrerat.'; } },
      infos: { period: 'Periodens resultat bygger på bokföringen fram till valt datum. Gör bokslutsposter (avskrivningar, periodiseringar, upplupna kostnader, skatt) innan siffrorna används i en kontrollbalansräkning.',
        ub: 'Filen saknar verifikationer (SIE 1–3) – läget beräknas vid räkenskapsårets slut från #UB och #RES.',
        first: function (d) { return 'Första månadsskiftet under gränsen: ' + d + '.'; } },
      calc: ['Bokfört eget kapital (konton 20xx)', 'Periodens resultat (resultatkonton t.o.m. datum)', 'Bokfört eget kapital inkl. periodens resultat', 'Obeskattade reserver (21xx)', '− uppskjuten skatt 20,6 % på reserverna', 'Justerat eget kapital', 'Hälften av registrerat aktiekapital', 'Skillnad mot gränsen'],
      under: 'under', ok: 'över', partial: '(senaste verifikation)', first: 'första',
      adjRow: 'Post', adjAmt: 'Belopp (+/−)', adjMot: 'Motivering', adjTax: 'Skatt', del: 'Ta bort',
      copied: 'Kopierat.', saved: 'Justeringarna är sparade i webbläsaren.', xlsxOk: 'Excel-filen är nedladdad.', loadedAdj: 'Sparade justeringar för bolaget har lästs in.',
      tl: { kbr: 'Kontrollbalansräkningen upprättas och lämnas till revisorn för granskning', kalE: 'Tidigast dag för kallelse (sex veckor före)', kalL: 'Senast dag för kallelse – även med post till aktieägare med känd adress', hand: 'Förslag, KBR och revisorns yttrande hålls tillgängliga senast', s1: 'Första kontrollstämma', s1s: 'Första kontrollstämma (förslag – ”snarast möjligt”)', s2: 'Andra kontrollstämma senast (ny granskad KBR som visar hela aktiekapitalet)', tr: 'Senast ansökan om likvidation hos tingsrätten om stämma 2 inte hålls eller kapitalet inte är återställt' }
    },
    en: {
      reading: 'Reading file…', err: 'Could not read the file: ', notsie: 'This does not look like a SIE file (no # lines found).',
      loaded: function (n, e, v) { return 'Done: ' + n + ' · ' + e + ' · ' + v + ' vouchers'; }, manual: 'Manually entered figures',
      noyear: 'The file has no fiscal year (#RAR 0).', badnum: 'Check the amounts – a field could not be read.',
      st: { ak: 'Registered share capital', half: 'Half', ekb: 'Booked equity incl. result', ekj: 'Adjusted equity (§ 14)', marg: 'Margin to the limit' },
      okv: function (e, h, m) { return '<strong>Above the limit.</strong> Adjusted equity SEK ' + e + ' is higher than half the share capital (SEK ' + h + ') by SEK ' + m + '. No kontrollbalansräkning is needed at this date – but keep an eye on it if the company is making a loss.'; },
      badv: function (e, h, m) { return '<strong>Below half the share capital.</strong> Adjusted equity SEK ' + e + ' is lower than SEK ' + h + ' (short by SEK ' + m + '). The board must <strong>immediately</strong> prepare a kontrollbalansräkning and have the auditor review it (Companies Act ch. 25 § 13) – otherwise the members risk personal liability (§ 18). Valuation adjustments under § 14 can change the picture.'; },
      near: 'Close to the limit: the margin is less than 20 % of the share capital.',
      pv: function (c) { return c.underHalf ? '<strong>The kontrollbalansräkning shows equity (SEK ' + c.e + ') below half the share capital (SEK ' + c.h + ').</strong> Call the first control meeting as soon as possible. To continue without liquidation, equity at the second control meeting must be at least the full share capital – SEK ' + c.n2 + ' is missing today.' : (c.full ? '<strong>The kontrollbalansräkning shows equity (SEK ' + c.e + ') of at least the full share capital.</strong> The capital deficit is cured.' : '<strong>After the adjustments equity (SEK ' + c.e + ') is at least half the share capital.</strong> No control meeting is required under § 15 – but a second kontrollbalansräkning must show the full share capital (SEK ' + c.r + ') if the meeting has already been held; SEK ' + c.n2 + ' missing.'); },
      flags: { diff: function (d) { return 'The balance sheet does not balance: difference SEK ' + d + ' between assets and equity + liabilities. Are opening balances (#IB) missing or last year’s closing not carried forward?'; },
        unk: function (d) { return 'Accounts outside 1000–8999 with balance SEK ' + d + ' are ignored.'; },
        akdiff: function (b, r) { return 'Account 2081 shows SEK ' + b + ' but you entered registered share capital SEK ' + r + '. The limit is based on the amount <em>registered</em> with Bolagsverket.'; },
        noak: 'Account 2081 (share capital) has no balance. Enter the registered share capital.',
        ejreg: function (v) { return 'Account 2082 (unregistered share capital) holds SEK ' + v + '. It counts as equity but does not raise the limit until registered.'; } },
      infos: { period: 'The result for the period is based on the books up to the chosen date. Book closing entries (depreciation, accruals, accrued costs, tax) before using the figures in a kontrollbalansräkning.',
        ub: 'The file has no vouchers (SIE 1–3) – the position is calculated at fiscal year end from #UB and #RES.',
        first: function (d) { return 'First month-end below the limit: ' + d + '.'; } },
      calc: ['Booked equity (accounts 20xx)', 'Result for the period (P&L accounts up to the date)', 'Booked equity incl. result for the period', 'Untaxed reserves (21xx)', '− deferred tax 20.6 % on the reserves', 'Adjusted equity', 'Half the registered share capital', 'Difference to the limit'],
      under: 'below', ok: 'above', partial: '(last voucher)', first: 'first',
      adjRow: 'Line', adjAmt: 'Amount (+/−)', adjMot: 'Reason', adjTax: 'Tax', del: 'Remove',
      copied: 'Copied.', saved: 'Adjustments saved in the browser.', xlsxOk: 'Excel file downloaded.', loadedAdj: 'Saved adjustments for this company were loaded.',
      tl: { kbr: 'Kontrollbalansräkning prepared and handed to the auditor for review', kalE: 'Earliest day for the notice (six weeks before)', kalL: 'Last day for the notice – also by post to shareholders with a known address', hand: 'Proposal, KBR and auditor’s statement available no later than', s1: 'First control meeting', s1s: 'First control meeting (suggestion – “as soon as possible”)', s2: 'Second control meeting at the latest (new reviewed KBR showing the full share capital)', tr: 'Last day to apply to the district court for liquidation if meeting 2 is not held or capital not restored' }
    }
  };
  function t(k) { return T[lang][k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function kr(o) { return K.kr(o); }
  function money(o) { return '<span class="' + (o < 0 ? 'neg' : '') + '">' + kr(o) + '</span>'; }
  function status(m, err) { var s = $('#status'); s.textContent = m || ''; s.className = 'status' + (err ? ' err' : ''); }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function svDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); if (!m) return iso || ''; return (+m[3]) + ' ' + ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'][+m[2] - 1] + ' ' + m[1]; }

  // ---------- i18n ----------
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    if (st.mode) render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- input ----------
  var drop = $('#drop'), input = $('#file');
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', function () { if (input.files[0]) readFile(input.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readFile(f); });
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel-kbr-syntetisk.se').then(function (r) { return r.arrayBuffer(); }).then(function (b) { load(b, 'exempel-kbr-syntetisk.se', true); }).catch(function (er) { status(t('err') + er.message, true); });
  });
  function readFile(f) {
    status(t('reading'));
    var r = new FileReader();
    r.onload = function () { load(r.result, f.name); };
    r.onerror = function () { status(t('err') + (r.error && r.error.message), true); };
    r.readAsArrayBuffer(f);
  }
  function load(buf, name, isSample) {
    var d;
    try { d = SIE.parse(buf); } catch (e) { return status(t('err') + e.message, true); }
    if (!d.rar || !d.rar['0']) {
      if (!Object.keys(d.accounts || {}).length && !(d.vouchers || []).length) return status(t('notsie'), true);
      return status(t('noyear'), true);
    }
    st.doc = d; st.mode = 'sie'; st.manual = null;
    st.series = K.monthly(d);
    var end = K.toIso(d.rar['0'].end);
    st.dates = st.series.length ? st.series.map(function (x) { return x.date; }).reverse() : [end];
    st.date = st.dates[0];
    st.name = d.fnamn || ''; st.org = d.orgnr || '';
    var p = K.position(K.balancesAt(d, K.to8(st.date)).bal);
    st.registered = p.book.ak > 0 ? p.book.ak : null;
    st.adjustments = isSample ? [{ row: 'mask', delta: 1500000, tax: true, motiv: 'Inventarier – marknadsvärde enligt värdering (syntetiskt exempel)' }] : [];
    loadSaved();
    $('#b-name').value = st.name; $('#b-org').value = st.org;
    if (!$('#b-kbr').value) $('#b-kbr').value = today();
    status(t('loaded')(name, d.encoding, (d.vouchers || []).length));
    show();
  }
  $('#m-date').value = today();
  $('#man-go').addEventListener('click', function () {
    var f = {}, bad = false;
    ['ak', 'ek', 'or', 'avs', 'lang', 'kort'].forEach(function (k) { var el = $('#m-' + k), v = el.value.trim() === '' ? 0 : K.parseKr(el.value); el.classList.toggle('bad', v === null); if (v === null) bad = true; f[k] = v; });
    if (bad) return status(t('badnum'), true);
    st.mode = 'manual'; st.doc = null; st.series = [];
    st.manual = { aktiekapital: f.ak, ovrigtEk: f.ek, or: f.or, avs: f.avs, lang: f.lang, kort: f.kort };
    st.date = $('#m-date').value || today(); st.dates = [st.date]; st.registered = f.ak; st.adjustments = st.adjustments || [];
    st.name = st.name || ''; if (!$('#b-kbr').value) $('#b-kbr').value = today();
    status(t('manual'));
    show();
  });
  function show() {
    var sel = $('#s-date');
    sel.innerHTML = st.dates.map(function (d) { return '<option value="' + d + '">' + d + '</option>'; }).join('');
    sel.value = st.date;
    $('#s-ak').value = st.registered != null ? kr(st.registered) : '25 000';
    if (st.registered == null) st.registered = 2500000;
    $('#result').hidden = false;
    render();
  }
  $('#s-date').addEventListener('change', function () { st.date = this.value; render(); });
  $('#s-ak').addEventListener('input', function () { var v = K.parseKr(this.value); this.classList.toggle('bad', v === null || v <= 0); if (v && v > 0) { st.registered = v; render(); } });

  function position() {
    if (st.mode === 'manual') return K.manualPosition(st.manual);
    return K.position(K.balancesAt(st.doc, K.to8(st.date)).bal);
  }

  // ---------- render ----------
  function render() {
    var pos = position(), unlocked = PW.isUnlocked();
    var c = K.compute(pos, { registered: st.registered, adjustments: unlocked ? st.adjustments : [] });
    st.pos = pos; st.c = c;
    var L = T[lang];
    $('#r-title').textContent = st.name || (st.mode === 'manual' ? L.manual : 'SIE');
    $('#r-meta').textContent = [st.org, st.mode === 'sie' ? (K.toIso(st.doc.rar['0'].start) + ' – ' + K.toIso(st.doc.rar['0'].end)) : ''].filter(Boolean).join(' · ');
    var marg = c.ekJust - c.half;
    var v = $('#verdict');
    v.className = 'verdict ' + (c.trigger ? 'bad' : 'ok');
    v.innerHTML = c.trigger ? L.badv(kr(c.ekJust), kr(c.half), kr(c.half - c.ekJust)) : L.okv(kr(c.ekJust), kr(c.half), kr(marg)) + (marg < c.registered * 0.2 ? '<br><span class="small">' + L.near + '</span>' : '');
    $('#stats').innerHTML = [[L.st.ak, c.registered], [L.st.half, c.half], [L.st.ekb, c.ekBook], [L.st.ekj, c.ekJust], [L.st.marg, marg]]
      .map(function (x) { return '<div class="stat"><span class="muted small">' + esc(x[0]) + '</span><strong>' + money(x[1]) + ' kr</strong></div>'; }).join('');
    // flags / info
    var fl = [], inf = [];
    if (c.totals.diff) fl.push(L.flags.diff(kr(c.totals.diff)));
    if (pos.unknown) fl.push(L.flags.unk(kr(pos.unknown)));
    if (st.mode === 'sie' && !pos.book.ak) fl.push(L.flags.noak);
    else if (st.mode === 'sie' && pos.book.ak !== c.registered) fl.push(L.flags.akdiff(kr(pos.book.ak), kr(c.registered)));
    if (c.ejreg) fl.push(L.flags.ejreg(kr(c.ejreg)));
    if (st.mode === 'sie' && !(st.doc.vouchers || []).length) inf.push(L.infos.ub);
    var first = firstUnderAt(c.half); if (first) inf.push(L.infos.first(first));
    inf.push(L.infos.period);
    $('#flags').hidden = !fl.length; $('#flags').innerHTML = '<ul>' + fl.map(function (x) { return '<li>' + x + '</li>'; }).join('') + '</ul>';
    $('#info').hidden = !inf.length; $('#info').innerHTML = '<ul>' + inf.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    // calc table
    var periodRes = pos.book.period || 0, cl = L.calc;
    var rows = [[cl[0], c.ekBook - periodRes], [cl[1], periodRes], [cl[2], c.ekBook, 'sum'], [cl[3], c.totals.OR], [cl[4], -c.orTax], [cl[5], c.ekJust, 'sum'], [cl[6], c.half], [cl[7], marg, 'sum']];
    $('#calc-t tbody').innerHTML = rows.map(function (r) { return '<tr' + (r[2] ? ' class="sum"' : '') + '><td>' + esc(r[0]) + '</td><td class="num">' + money(r[1]) + ' kr</td></tr>'; }).join('');
    // month table
    $('#month-sec').hidden = !st.series.length;
    $('#month-t tbody').innerHTML = st.series.map(function (x) {
      var half = c.half, under = x.ekJust < half, cls = under ? (first === x.date ? 'first' : 'under') : '';
      return '<tr class="' + cls + '"><td>' + x.date + (x.partial ? ' <span class="muted small">' + L.partial + '</span>' : '') + '</td><td class="num">' + money(x.ekBook) + '</td><td class="num">' + money(x.orEk) + '</td><td class="num"><b>' + money(x.ekJust) + '</b></td><td class="num">' + kr(half) + '</td><td>' + (under ? '<span class="tag bad">' + L.under + (cls === 'first' ? ' · ' + L.first : '') + '</span>' : '<span class="tag">' + L.ok + '</span>') + '</td></tr>';
    }).join('');
    $('#paid-open').classList.toggle('locked', !unlocked);
    if (unlocked && !$('#paid-out').hidden) renderPaid();
  }
  function firstUnderAt(half) { for (var i = 0; i < st.series.length; i++) if (st.series[i].ekJust < half) return st.series[i].date; return null; }

  // ---------- paid: adjustments ----------
  var ADJ_ROWS = K.ROWS.filter(function (r) { return r.side === 'T' || r.side === 'AVS' || r.side === 'SK'; });
  function renderAdj() {
    var L = T[lang];
    var head = '<div class="adj adj-h"><span>' + L.adjRow + '</span><span class="num">' + L.adjAmt + '</span><span>' + L.adjMot + '</span><span>' + L.adjTax + '</span><span></span></div>';
    $('#adj-list').innerHTML = head + st.adjustments.map(function (a, i) {
      return '<div class="adj" data-i="' + i + '"><select class="a-row">' + ADJ_ROWS.map(function (r) { return '<option value="' + r.key + '"' + (r.key === a.row ? ' selected' : '') + '>' + esc(lang === 'en' ? r.en : r.sv) + '</option>'; }).join('') + '</select>' +
        '<input class="a-amt num" type="text" inputmode="decimal" value="' + (a.delta ? kr(a.delta) : '') + '">' +
        '<input class="a-mot m" type="text" value="' + esc(a.motiv || '') + '">' +
        '<label><input class="a-tax" type="checkbox"' + (a.tax ? ' checked' : '') + '> 20,6 %</label>' +
        '<button class="link a-del" type="button" aria-label="' + L.del + '">✕</button></div>';
    }).join('');
  }
  $('#adj-list').addEventListener('input', function (e) {
    var row = e.target.closest('.adj[data-i]'); if (!row) return; var a = st.adjustments[+row.dataset.i];
    if (e.target.classList.contains('a-amt')) { var v = e.target.value.trim() === '' ? 0 : K.parseKr(e.target.value); e.target.classList.toggle('bad', v === null); if (v === null) return; a.delta = v; }
    else if (e.target.classList.contains('a-mot')) a.motiv = e.target.value;
    else return;
    render();
  });
  $('#adj-list').addEventListener('change', function (e) {
    var row = e.target.closest('.adj[data-i]'); if (!row) return; var a = st.adjustments[+row.dataset.i];
    if (e.target.classList.contains('a-row')) a.row = e.target.value; else if (e.target.classList.contains('a-tax')) a.tax = e.target.checked; else return;
    render();
  });
  $('#adj-list').addEventListener('click', function (e) {
    if (!e.target.classList.contains('a-del')) return; var row = e.target.closest('.adj[data-i]');
    st.adjustments.splice(+row.dataset.i, 1); renderAdj(); render();
  });
  $('#adj-add').addEventListener('click', function () { st.adjustments.push({ row: 'byggn', delta: 0, tax: true, motiv: '' }); renderAdj(); render(); var l = $('#adj-list').querySelectorAll('.a-amt'); if (l.length) l[l.length - 1].focus(); });
  ['#b-name', '#b-org', '#b-ort', '#b-board', '#b-kbr', '#b-st1', '#b-rev', '#b-k3'].forEach(function (s) { $(s).addEventListener(s === '#b-rev' || s === '#b-k3' ? 'change' : 'input', function () { if (!$('#paid-out').hidden) renderPaid(); }); });

  function meta() {
    return { name: $('#b-name').value.trim() || st.name || '[Bolagets namn]', org: $('#b-org').value.trim() || st.org || '[org.nr]', ort: $('#b-ort').value.trim() || '[ort]',
      board: $('#b-board').value.split(/\n/).map(function (s) { return s.trim(); }).filter(Boolean), kbrDate: $('#b-kbr').value || today(), st1: $('#b-st1').value,
      rev: $('#b-rev').checked, k3: $('#b-k3').checked };
  }

  // ---------- paid: documents ----------
  function rowName(k) { return K.ROWMAP[k].sv; }
  function kbrLines(c, pos) {
    var b = pos.book, L = [];
    function line(label, book, adj, cls) { L.push({ label: label, book: book, adj: adj, kbr: book + adj, cls: cls || '' }); }
    function grp(label) { L.push({ label: label, grp: true }); }
    grp('TILLGÅNGAR');
    K.ROWS.forEach(function (r) { if (r.side === 'T' && (b[r.key] || c.adjByRow[r.key])) line(r.sv, b[r.key] || 0, c.adjByRow[r.key]); });
    line('Summa tillgångar', c.totals.T, c.totals.kbrT - c.totals.T, 'sum');
    grp('EGET KAPITAL, AVSÄTTNINGAR OCH SKULDER');
    K.ROWS.forEach(function (r) { if (r.side === 'EK' && (b[r.key] || r.key === 'ak')) line(r.sv, b[r.key] || 0, 0); });
    if (c.totals.OR) line('Eget kapital i obeskattade reserver (79,4 %)', 0, c.orEk);
    if (c.adjustments.length) line('Justeringar enligt 14 § (netto efter skatt)', 0, c.adjEffect - c.adjTax);
    line('Summa eget kapital', c.totals.EK, c.ekKbr - c.totals.EK, 'sum');
    if (c.totals.OR) line('Obeskattade reserver', c.totals.OR, -c.totals.OR);
    if (b.avs || c.adjByRow.avs) line(rowName('avs'), b.avs || 0, c.adjByRow.avs);
    if (c.defTax) line('Uppskjuten skatteskuld (reserver och justeringar)', 0, c.defTax);
    ['lang', 'kort'].forEach(function (k) { if (b[k] || c.adjByRow[k]) line(rowName(k), b[k] || 0, c.adjByRow[k]); });
    var totBook = c.totals.EK + c.totals.OR + c.totals.AVS + c.totals.SK, totK = c.ekKbr + c.totals.kbrAVS + c.totals.kbrSK;
    line('Summa eget kapital, avsättningar och skulder', totBook, totK - totBook, 'sum');
    return L;
  }
  function docKbr(c, pos, m) {
    var lines = kbrLines(c, pos);
    var h = '<div class="doc"><h1>Kontrollbalansräkning</h1><p class="doc-sub">' + esc(m.name) + ' · org.nr ' + esc(m.org) + ' · per <strong>' + esc(st.date) + '</strong></p>';
    h += '<p class="legal">Upprättad enligt 25 kap. 13–14 §§ aktiebolagslagen (2005:551) och årsredovisningslagen, med samma principer som bolagets årsredovisning (' + (m.k3 ? 'K3, BFNAR 2012:1' : 'K2, BFNAR 2016:10') + '). Belopp i kronor. Justeringar enligt 14 § redovisas särskilt nedan.</p>';
    h += '<table class="t"><thead><tr><th>Post</th><th class="num">Bokfört</th><th class="num">Justering</th><th class="num">Kontrollbalansräkning</th></tr></thead><tbody>';
    lines.forEach(function (l) { h += l.grp ? '<tr class="grp"><td colspan="4">' + esc(l.label) + '</td></tr>' : '<tr class="' + l.cls + '"><td>' + esc(l.label) + '</td><td class="num">' + kr(l.book) + '</td><td class="num">' + (l.adj ? kr(l.adj) : '') + '</td><td class="num">' + kr(l.kbr) + '</td></tr>'; });
    h += '</tbody></table>';
    h += '<h2>Justeringar enligt 25 kap. 14 § (redovisas särskilt)</h2>';
    if (c.adjustments.length) {
      h += '<table class="t"><thead><tr><th>Post</th><th class="num">Justering</th><th class="num">Effekt på eget kapital</th><th class="num">Uppskjuten skatt</th><th>Motivering</th></tr></thead><tbody>';
      c.adjustments.forEach(function (a) { h += '<tr><td>' + esc(rowName(a.row)) + '</td><td class="num">' + kr(a.delta) + '</td><td class="num">' + kr(a.effect) + '</td><td class="num">' + (a.tax ? kr(-a.tax) : '–') + '</td><td>' + esc(a.motiv) + '</td></tr>'; });
      h += '<tr class="sum"><td>Summa</td><td></td><td class="num">' + kr(c.adjEffect) + '</td><td class="num">' + kr(-c.adjTax) + '</td><td>Netto ' + kr(c.adjEffect - c.adjTax) + '</td></tr></tbody></table>';
    } else h += '<p class="legal">Inga justeringar har gjorts.</p>';
    h += '<h2>Obeskattade reserver</h2><table class="t kv"><tbody><tr><th>Obeskattade reserver i balansräkningen</th><td class="num">' + kr(c.totals.OR) + '</td></tr><tr><th>Varav eget kapital (79,4 %)</th><td class="num">' + kr(c.orEk) + '</td></tr><tr><th>Varav uppskjuten skatteskuld (20,6 %)</th><td class="num">' + kr(c.orTax) + '</td></tr></tbody></table>';
    h += '<h2>Kapitalprövning</h2><table class="t kv"><tbody><tr><th>Eget kapital enligt kontrollbalansräkningen</th><td class="num"><strong>' + kr(c.ekKbr) + '</strong></td></tr><tr><th>Registrerat aktiekapital</th><td class="num">' + kr(c.registered) + '</td></tr><tr><th>Hälften av registrerat aktiekapital</th><td class="num">' + kr(c.half) + '</td></tr><tr><th>Skillnad mot hälften</th><td class="num">' + kr(c.ekKbr - c.half) + '</td></tr><tr><th>Skillnad mot hela aktiekapitalet</th><td class="num">' + kr(c.ekKbr - c.registered) + '</td></tr></tbody></table>';
    h += '<p><strong>Slutsats:</strong> ' + (c.underHalf ? 'Bolagets eget kapital understiger hälften av det registrerade aktiekapitalet. Styrelsen ska snarast möjligt kalla till första kontrollstämma som ska pröva om bolaget ska gå i likvidation (25 kap. 15 §).' : (c.fullCovered ? 'Bolagets eget kapital uppgår till minst det registrerade aktiekapitalet.' : 'Bolagets eget kapital uppgår till minst hälften men inte till hela det registrerade aktiekapitalet.')) + '</p>';
    h += '<p class="legal">' + (m.rev ? 'Kontrollbalansräkningen ska granskas av bolagets revisor, vars yttrande läggs fram på kontrollstämman (25 kap. 13 och 15 §§).' : 'Bolaget har ingen revisor; reglerna om revisorns granskning tillämpas inte (1 kap. 12 b § aktiebolagslagen).') + '</p>';
    h += '<p class="legal">' + esc(m.ort) + ' den ' + esc(svDate(m.kbrDate)) + '</p><div class="sign">';
    (m.board.length ? m.board : ['', '']).forEach(function (n) { h += '<div><span class="line"></span>' + (n ? esc(n) : 'Namnförtydligande') + '</div>'; });
    h += '</div><p class="legal muted">Underlag framtaget med Kontrollbalansräkning från SIE-fil. Styrelsen ansvarar för värderingar och innehåll.</p></div>';
    return h;
  }
  function timelineRows(m) {
    var tl = K.timeline(m.kbrDate, m.st1), L = T.sv.tl; if (!tl) return [];
    return [[tl.kbrDate, L.kbr, '25 kap. 13 §'], [tl.kallelseEarliest, L.kalE, '7 kap. 20 §'], [tl.kallelseLatest, L.kalL, '7 kap. 20 och 23 §§'], [tl.handlingarFrom, L.hand, '25 kap. 6 och 15 §§'],
      [tl.stamma1, tl.suggested ? L.s1s : L.s1, '25 kap. 15 §'], [tl.stamma2Latest, L.s2, '25 kap. 16 §'], [tl.tingsrattLatest, L.tr, '25 kap. 17 §']];
  }
  function kallelse(c, m) {
    var tl = K.timeline(m.kbrDate, m.st1);
    return 'KALLELSE TILL EXTRA BOLAGSSTÄMMA (FÖRSTA KONTROLLSTÄMMA)\n\n' +
      'Aktieägarna i ' + m.name + ', org.nr ' + m.org + ', kallas härmed till extra bolagsstämma\n' +
      'den ' + svDate(tl.stamma1) + ' kl. [tid] i/på [plats].\n\n' +
      'Styrelsen har upprättat en kontrollbalansräkning per ' + st.date + ' som visar att bolagets eget kapital\n' +
      'understiger hälften av det registrerade aktiekapitalet (25 kap. 13 § aktiebolagslagen).\n' +
      'Eget kapital enligt kontrollbalansräkningen: ' + kr(c.ekKbr) + ' kr. Registrerat aktiekapital: ' + kr(c.registered) + ' kr.\n\n' +
      'Förslag till dagordning\n' +
      '1. Stämmans öppnande\n2. Val av ordförande vid stämman\n3. Upprättande och godkännande av röstlängd\n4. Godkännande av dagordning\n' +
      '5. Val av en eller två justeringspersoner\n6. Prövning av om stämman blivit behörigen sammankallad\n' +
      '7. Framläggande av kontrollbalansräkningen' + (m.rev ? ' och revisorns yttrande över den' : '') + '\n' +
      '8. Beslut om bolaget ska gå i likvidation eller drivas vidare (25 kap. 15 §)\n9. Stämmans avslutande\n\n' +
      'Styrelsens förslag: [att bolaget ska drivas vidare / att bolaget ska träda i likvidation]. [Skäl och eventuella åtgärder för att\n' +
      'återställa aktiekapitalet, t.ex. aktieägartillskott eller nyemission.]\n' +
      'Om stämman ska besluta om likvidation ska förslaget innehålla det som anges i 25 kap. 3 § (skälen, alternativ, från vilken dag,\n' +
      'beräknad tid för skifte och skifteslikvid samt förslag till likvidator).\n\n' +
      'Kontrollbalansräkningen' + (m.rev ? ', revisorns yttrande' : '') + ' och styrelsens förslag hålls tillgängliga hos bolaget från och med den\n' +
      svDate(tl.handlingarFrom) + ' och skickas till aktieägare som begär det.\n\n' +
      'Kallelsen skickas med post till varje aktieägare med känd adress (7 kap. 23 §) [och på det sätt bolagsordningen anger].\n\n' +
      m.ort + ' den [datum]\n' + m.name + '\nStyrelsen\n' + (m.board.length ? m.board.join('\n') + '\n' : '') +
      '\n(Kallelsen ska skickas tidigast ' + svDate(tl.kallelseEarliest) + ' och senast ' + svDate(tl.kallelseLatest) + '. Kontrollera bolagsordningen.)';
  }
  function protokoll(c, m) {
    var tl = K.timeline(m.kbrDate, m.st1);
    return 'PROTOKOLL FÖRT VID EXTRA BOLAGSSTÄMMA (KONTROLLSTÄMMA)\n' + m.name + ', org.nr ' + m.org + '\nDatum: ' + svDate(tl.stamma1) + '   Plats: [plats]\n\n' +
      '§ 1 Stämman öppnades av [namn].\n§ 2 Till ordförande valdes [namn], som utsåg [namn] att föra protokollet.\n' +
      '§ 3 Bifogad förteckning över närvarande aktieägare godkändes som röstlängd (bilaga 1).\n§ 4 Dagordningen godkändes.\n' +
      '§ 5 Att jämte ordföranden justera protokollet valdes [namn].\n§ 6 Stämman konstaterades vara behörigen sammankallad.\n' +
      '§ 7 Kontrollbalansräkningen per ' + st.date + (m.rev ? ' och revisorns yttrande över den' : '') + ' lades fram (bilaga 2' + (m.rev ? ' och 3' : '') + ').\n' +
      '    Eget kapital enligt kontrollbalansräkningen uppgår till ' + kr(c.ekKbr) + ' kr; registrerat aktiekapital är ' + kr(c.registered) + ' kr.\n' +
      '§ 8 Stämman beslutade att bolaget [inte ska gå i likvidation utan drivas vidare / ska träda i likvidation].\n' +
      '    [Vid fortsatt drift:] Stämman noterade att en andra kontrollstämma ska hållas senast den ' + svDate(tl.stamma2Latest) + ',\n' +
      '    och att en ny kontrollbalansräkning' + (m.rev ? ', granskad av revisorn,' : '') + ' då måste visa att eget kapital uppgår till minst\n' +
      '    det registrerade aktiekapitalet (25 kap. 16–17 §§). Styrelsen redovisade följande åtgärder: [aktieägartillskott/nyemission/…].\n' +
      '§ 9 Stämman avslutades.\n\nVid protokollet: ____________________   Justeras: ____________________\n' +
      '                [namn]                              [namn], ordförande';
  }
  function renderPaid() {
    var c = st.c, m = meta(), L = T[lang];
    renderAdjIfNeeded();
    var pv = $('#p-verdict');
    pv.className = 'verdict ' + (c.underHalf || !c.fullCovered ? 'bad' : 'ok');
    pv.innerHTML = L.pv({ underHalf: c.underHalf, full: c.fullCovered, e: kr(c.ekKbr), h: kr(c.half), r: kr(c.registered), n2: kr(c.need2) });
    $('#kbr-doc').innerHTML = docKbr(c, st.pos, m);
    $('#tl-t tbody').innerHTML = timelineRows(m).map(function (r, i) { var lab = lang === 'en' ? T.en.tl[['kbr', 'kalE', 'kalL', 'hand', K.timeline(m.kbrDate, m.st1).suggested ? 's1s' : 's1', 's2', 'tr'][i]] : r[1]; return '<tr><td>' + r[0] + '</td><td>' + esc(lab) + '</td><td class="muted small">' + r[2] + '</td></tr>'; }).join('');
    $('#kal-txt').textContent = kallelse(c, m);
    $('#pro-txt').textContent = protokoll(c, m);
  }
  var adjRendered = false;
  function renderAdjIfNeeded() { if (!adjRendered) { renderAdj(); adjRendered = true; } }
  function openPaid() { $('#paid-out').hidden = false; adjRendered = false; render(); }
  $('#paid-open').addEventListener('click', function () { if (!st.mode) return; if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { if (st.mode) openPaid(); } });

  // ---------- print / copy / xlsx / save ----------
  $('#print-kbr').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.c) return;
    $('#print-root').innerHTML = docKbr(st.c, st.pos, meta()); document.body.classList.add('printing'); window.print();
    setTimeout(function () { document.body.classList.remove('printing'); }, 500);
  });
  window.addEventListener('afterprint', function () { document.body.classList.remove('printing'); });
  function copy(sel) {
    if (!PW.isUnlocked()) return; var txt = $(sel).textContent;
    var done = function () { status(t('copied')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, function () { fallback(); }); else fallback();
    function fallback() { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); done(); } catch (e) {} ta.remove(); }
  }
  $('#copy-kal').addEventListener('click', function () { copy('#kal-txt'); });
  $('#copy-pro').addEventListener('click', function () { copy('#pro-txt'); });
  function saveFile(bytes, name, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function n(o) { return Math.round(o) / 100; }
  function sheets() {
    var c = st.c, m = meta(), pos = st.pos;
    var s1 = [['Kontrollbalansräkning per ' + st.date], [m.name + ' · org.nr ' + m.org], [], ['Post', 'Bokfört', 'Justering', 'Kontrollbalansräkning']];
    kbrLines(c, pos).forEach(function (l) { s1.push(l.grp ? [l.label] : [l.label, n(l.book), n(l.adj), n(l.kbr)]); });
    s1.push([], ['Eget kapital enligt KBR', n(c.ekKbr)], ['Registrerat aktiekapital', n(c.registered)], ['Hälften', n(c.half)], ['Under hälften?', c.underHalf ? 'Ja' : 'Nej'], ['Saknas till hela aktiekapitalet', n(c.need2)]);
    var s2 = [['Post', 'Justering', 'Effekt på EK', 'Uppskjuten skatt', 'Motivering']];
    c.adjustments.forEach(function (a) { s2.push([rowName(a.row), n(a.delta), n(a.effect), n(-a.tax), a.motiv]); });
    var s3 = [['Datum', 'Bokfört EK', 'Reserver 79,4 %', 'Justerat EK', 'Halva AK', 'Under']];
    st.series.forEach(function (x) { s3.push([x.date, n(x.ekBook), n(x.orEk), n(x.ekJust), n(c.half), x.ekJust < c.half ? 'Ja' : 'Nej']); });
    var s4 = [['Konto', 'Namn', 'Post', 'Belopp']];
    Object.keys(pos.accounts).forEach(function (k) { pos.accounts[k].forEach(function (a) { var nm = st.doc && st.doc.accounts[a.konto] ? st.doc.accounts[a.konto].name : ''; s4.push([a.konto, nm, rowName(k), n(a.amount)]); }); });
    var s5 = [['Datum', 'Händelse', 'Lagrum']].concat(timelineRows(m));
    return [{ name: 'Kontrollbalansräkning', rows: s1, widths: [48, 16, 16, 22] }, { name: 'Justeringar', rows: s2, widths: [36, 14, 14, 16, 50] },
      { name: 'Per månad', rows: s3, widths: [14, 14, 16, 14, 12, 8], freeze: 1 }, { name: 'Konton', rows: s4, widths: [8, 36, 40, 14], freeze: 1, autoFilter: true }, { name: 'Tidsfrister', rows: s5, widths: [12, 90, 22] }];
  }
  $('#dl-xlsx').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.c) return;
    XLSXW.build(sheets(), { title: 'Kontrollbalansräkning' }).then(function (u8) {
      saveFile(u8, 'kontrollbalansrakning-' + st.date + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); status(t('xlsxOk'));
    }).catch(function (e) { status(t('err') + e.message, true); });
  });
  function saveKey() { return CFG.SAVE_KEY + ':' + (st.org || st.name || 'manual'); }
  $('#save').addEventListener('click', function () {
    if (!PW.isUnlocked()) return; var m = meta();
    try { localStorage.setItem(saveKey(), JSON.stringify({ adjustments: st.adjustments, ort: $('#b-ort').value, board: $('#b-board').value, rev: m.rev, k3: m.k3 })); status(t('saved')); } catch (e) { status(t('err') + e.message, true); }
  });
  function loadSaved() {
    if (!PW.isUnlocked()) return;
    try {
      var s = JSON.parse(localStorage.getItem(saveKey()) || 'null'); if (!s) return;
      st.adjustments = s.adjustments || []; $('#b-ort').value = s.ort || ''; $('#b-board').value = s.board || ''; $('#b-rev').checked = s.rev !== false; $('#b-k3').checked = !!s.k3;
      setTimeout(function () { status(t('loadedAdj')); }, 0);
    } catch (e) {}
  }

  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
