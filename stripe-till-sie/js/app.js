(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var S2 = window.STRIPE2SIE, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL;
  var raw = null, fileName = '', parsed = null, built = null, settings = null, lang = 'sv', shown = 0, PAGE = 50;
  var nf = new Intl.NumberFormat('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var ROLES = ['bank', 'clearing', 'sales', 'vat', 'refunds', 'fees', 'disputes', 'other', 'rcIn', 'rcOut'];
  var ROLE_SV = { bank: 'Bank (utbetalningar, insättningar)', clearing: 'Fordran på Stripe (Stripe-saldo)', sales: 'Försäljning (betalningar)', vat: 'Utgående moms på försäljning',
    refunds: 'Återbetalningar (tomt = samma som försäljning)', fees: 'Stripe-avgifter', disputes: 'Tvister/chargebacks (omtvistat belopp)', other: 'Övrigt/okänt från Stripe (granska)',
    rcIn: 'Omvänd moms – ingående (om påslaget)', rcOut: 'Omvänd moms – utgående (om påslaget)' };
  var ROLE_EN = { bank: 'Bank (payouts, top-ups)', clearing: 'Receivable from Stripe (Stripe balance)', sales: 'Sales (payments)', vat: 'Output VAT on sales',
    refunds: 'Refunds (empty = same as sales)', fees: 'Stripe fees', disputes: 'Disputes/chargebacks (disputed amount)', other: 'Other/unknown from Stripe (review)',
    rcIn: 'Reverse-charge VAT – input (if enabled)', rcOut: 'Reverse-charge VAT – output (if enabled)' };
  var MONTHS = ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'];
  var EN = {
    h1: 'Book Stripe payouts in Swedish accounting', lead: 'Load Stripe\'s CSV export and get a balanced SIE file with sales, VAT and fees for every payout – ready to import into Swedish bookkeeping software. <strong>The file never leaves your computer.</strong>',
    drop: 'Drop your Stripe CSV here or <u>choose file</u>', dropsub: 'Payout reconciliation (itemized) or Balance transactions · comma or semicolon', sample: 'Try a sample file',
    notice: '<strong>Important:</strong> the chart of accounts below is a BAS-based suggestion. Check accounts, VAT rate and the handling of fees, refunds and disputes with your accountant before importing. You are responsible for your bookkeeping.',
    'set-h': 'Settings and chart of accounts', 's-company': 'Company name', 's-orgnr': 'Org. number', 's-grouping': 'One voucher per', 'g-payout': 'payout', 'g-day': 'day',
    's-vat': 'VAT on sales', vat0: '0 % (exempt/export)', 's-series': 'Voucher series', 's-startNo': 'First voucher number', 's-fy': 'Fiscal year starts',
    's-tz': 'Convert Stripe UTC times to Swedish time (dates)', 's-rc': 'Reverse-charge VAT (25 %) on Stripe fees (Stripe Payments Europe, Ireland)',
    'map-h': 'Chart of accounts (BAS) – saved in your browser', 'm-role': 'Used for', 'c-acc': 'Account', 'c-name': 'Name', reset: 'Reset to defaults',
    export: 'Download SIE file', 'c-ver': 'Voucher / account', 'c-date': 'Date / name', 'c-text': 'Text', 'c-deb': 'Debit', 'c-kre': 'Credit', more: 'Show more',
    'pw-h': 'Download SIE file', 'pw-p': 'You get a SIE 4 file (PC8) with all vouchers from the preview, ready to import.', close: 'Close'
  };
  var SV = {};
  var T = {
    sv: { reading: 'Läser fil…', err: 'Kunde inte läsa filen: ', vouchers: 'Verifikationer', sales: 'Försäljning inkl. moms', fees: 'Stripe-avgifter', payouts: 'Utbetalt till bank', refunds: 'Återbetalningar',
      loaded: function (p) { return 'Klart: ' + fileName + ' · ' + p.label + ' · ' + p.rows + ' rader · ' + p.encoding + ' · avgränsare "' + (p.delimiter === '\t' ? 'tab' : p.delimiter) + '"'; },
      title: function (b) { return b.vouchers.length + ' verifikationer' + (b.vouchers.length ? ' · ' + b.vouchers[0].date + ' – ' + b.vouchers[b.vouchers.length - 1].date : ''); },
      meta: function (s) { return (s.grouping === 'payout' ? 'En verifikation per utbetalning' : 'En verifikation per dag') + ' · serie ' + s.series + ' · moms ' + s.vatRate + ' %' + (s.reverseCharge ? ' · omvänd moms på avgifter' : ''); },
      ok: 'balanserar', bad: 'balanserar inte', none: 'Inga verifikationer att visa med nuvarande inställningar.', badacc: 'Ogiltigt kontonummer (4 siffror): ', done: 'SIE-filen är nedladdad.', showing: function (a, b) { return 'Visar ' + a + ' av ' + b; },
      errors: { empty: 'Filen är tom.', summary: 'Det här är en sammanställning (summary). Välj den specificerade rapporten (itemized) i Stripe.', columns: 'Okänt CSV-format. Saknade kolumner: ', 'only-foreign': 'Filen innehåller bara saldon i andra valutor än SEK, vilket inte stöds i version 1.', 'no-rows': 'Hittade inga transaktioner i filen.' },
      w: {
        currency: function (w) { return '<strong>Endast SEK stöds fullt ut i version 1.</strong> ' + w.n + ' rader i ' + w.currencies.join(', ').toUpperCase() + ' har inte tagits med. Bokför dem separat.'; },
        'customer-currency': function (w) { return w.n + ' betalningar gjordes av kunden i annan valuta men växlades av Stripe till SEK – SEK-beloppen används.'; },
        'payout-synth': function (w) { return 'Rapporten saknar egna utbetalningsrader – ' + w.n + ' utbetalningar har räknats fram som summan av nettobeloppen per utbetalnings-id.'; },
        'no-payouts': function () { return 'Filen innehåller inga utbetalnings-id. Välj “per dag” – beloppen blir då kvar på fordran mot Stripe tills utbetalningarna bokförs.'; },
        pending: function (w) { return w.n + ' transaktioner (netto ' + nf.format(w.net / 100) + ' kr) ingår inte i någon utbetalning ännu och har inte tagits med. De kommer med i nästa utbetalning.'; },
        other: function (w) { return w.n + (w.n === 1 ? ' rad' : ' rader') + ' av okänd/övrig typ har bokförts på konto ' + w.account + '. Granska och omboka dem.'; },
        'incomplete-payout': function (w) { return w.n + ' utbetalningar ser ofullständiga ut (fordran på Stripe går inte till noll). Kontrollera att exporten täcker hela perioden.'; },
        'multi-year': function (w) { return 'Verifikationerna spänner över ' + w.n + ' räkenskapsår. Dela upp exporten per räkenskapsår innan import.'; },
        'fee-mismatch': function (w) { return w.n + ' rader där avgift ≠ brutto − netto. Avgiften har räknats som brutto − netto.'; },
        'bad-date': function (w) { return w.n + ' rader med okänt datumformat har hoppats över.'; }, 'bad-number': function (w) { return w.n + ' rader med ogiltiga belopp har hoppats över.'; },
        vat0: function () { return 'Moms 0 %: kontrollera att försäljningskontot passar (t.ex. 3308 för tjänster till annat EU-land, 3305 export).'; }
      } },
    en: { reading: 'Reading file…', err: 'Could not read the file: ', vouchers: 'Vouchers', sales: 'Sales incl. VAT', fees: 'Stripe fees', payouts: 'Paid out to bank', refunds: 'Refunds',
      loaded: function (p) { return 'Done: ' + fileName + ' · ' + p.label + ' · ' + p.rows + ' rows · ' + p.encoding + ' · delimiter "' + (p.delimiter === '\t' ? 'tab' : p.delimiter) + '"'; },
      title: function (b) { return b.vouchers.length + ' vouchers' + (b.vouchers.length ? ' · ' + b.vouchers[0].date + ' – ' + b.vouchers[b.vouchers.length - 1].date : ''); },
      meta: function (s) { return (s.grouping === 'payout' ? 'One voucher per payout' : 'One voucher per day') + ' · series ' + s.series + ' · VAT ' + s.vatRate + ' %' + (s.reverseCharge ? ' · reverse-charge VAT on fees' : ''); },
      ok: 'balanced', bad: 'not balanced', none: 'No vouchers with the current settings.', badacc: 'Invalid account number (4 digits): ', done: 'SIE file downloaded.', showing: function (a, b) { return 'Showing ' + a + ' of ' + b; },
      errors: { empty: 'The file is empty.', summary: 'This is a summary report. Choose the itemized report in Stripe.', columns: 'Unknown CSV format. Missing columns: ', 'only-foreign': 'The file only has non-SEK balances, which v1 does not support.', 'no-rows': 'No transactions found.' },
      w: {
        currency: function (w) { return '<strong>Only SEK is fully supported in v1.</strong> ' + w.n + ' rows in ' + w.currencies.join(', ').toUpperCase() + ' were left out. Book them separately.'; },
        'customer-currency': function (w) { return w.n + ' payments were made in another currency and converted by Stripe to SEK – the SEK amounts are used.'; },
        'payout-synth': function (w) { return 'The report has no payout rows – ' + w.n + ' payouts were derived as the sum of net amounts per payout id.'; },
        'no-payouts': function () { return 'No payout ids in this file. Choose “per day” – amounts then stay on the Stripe receivable until payouts are booked.'; },
        pending: function (w) { return w.n + ' transactions (net ' + nf.format(w.net / 100) + ' SEK) are not in a payout yet and were left out.'; },
        other: function (w) { return w.n + (w.n === 1 ? ' row' : ' rows') + ' of other/unknown type were booked to account ' + w.account + '. Review them.'; },
        'incomplete-payout': function (w) { return w.n + ' payouts look incomplete (Stripe receivable does not net to zero).'; },
        'multi-year': function (w) { return 'Vouchers span ' + w.n + ' fiscal years. Split the export per fiscal year before import.'; },
        'fee-mismatch': function (w) { return w.n + ' rows where fee ≠ gross − net. Fee was taken as gross − net.'; },
        'bad-date': function (w) { return w.n + ' rows with an unknown date format were skipped.'; }, 'bad-number': function (w) { return w.n + ' rows with invalid amounts were skipped.'; },
        vat0: function () { return 'VAT 0 %: check that the sales account fits (e.g. 3308 EU services, 3305 export).'; }
      } }
  };
  function t(k) { return T[lang][k]; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(ore) { return nf.format(ore / 100); }
  function status(msg, err) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }

  // ---------- settings (localStorage) ----------
  function loadSettings() { var s = null; try { s = JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || 'null'); } catch (e) { s = null; } return S2.mergeSettings(s); }
  function saveSettings() { try { localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ } }
  var fySel = $('#s-fyStartMonth');
  MONTHS.forEach(function (m, i) { var o = document.createElement('option'); o.value = i + 1; o.textContent = m; fySel.appendChild(o); });
  function renderSettings() {
    $('#s-company').value = settings.company; $('#s-orgnr').value = settings.orgnr; $('#s-series').value = settings.series; $('#s-startNo').value = settings.startNo;
    $('#s-vatRate').value = String(settings.vatRate); fySel.value = String(settings.fyStartMonth);
    $('#s-convertTz').checked = settings.convertTz; $('#s-reverseCharge').checked = settings.reverseCharge;
    document.querySelectorAll('input[name=grouping]').forEach(function (r) { r.checked = r.value === settings.grouping; });
    var R = lang === 'en' ? ROLE_EN : ROLE_SV;
    $('#map tbody').innerHTML = ROLES.map(function (r) {
      return '<tr><td>' + esc(R[r]) + '</td><td><input class="acc" type="text" inputmode="numeric" maxlength="4" data-role="' + r + '" value="' + esc(settings.acc[r]) + '"></td>' +
        '<td><input class="nm" type="text" data-name="' + r + '" value="' + esc(settings.names[r]) + '"></td></tr>';
    }).join('');
    validate();
  }
  function validate() {
    var bad = S2.validateSettings(settings);
    document.querySelectorAll('#map input.acc').forEach(function (i) { i.classList.toggle('bad', bad.indexOf(i.dataset.role) >= 0); });
    $('#map-err').textContent = bad.length ? t('badacc') + bad.map(function (r) { return settings.acc[r] || '–'; }).join(', ') : '';
    return !bad.length;
  }
  function onSetting(e) {
    var el = e.target, id = el.id ? el.id.replace(/^s-/, '') : '';
    if (el.name === 'grouping') settings.grouping = el.value;
    else if (el.dataset.role) settings.acc[el.dataset.role] = el.value.trim();
    else if (el.dataset.name) settings.names[el.dataset.name] = el.value;
    else if (el.type === 'checkbox') settings[id] = el.checked;
    else if (id === 'vatRate') {
      var old = S2.VAT_ACC[settings.vatRate], nu = S2.VAT_ACC[el.value];
      if (old && settings.acc.vat === old[0] && nu) { settings.acc.vat = nu[0]; settings.names.vat = nu[1]; }
      var sn = /^Försäljning inom Sverige, \d+ % moms$|^Försäljning, momsfri$/;
      if (sn.test(settings.names.sales)) settings.names.sales = Number(el.value) ? 'Försäljning inom Sverige, ' + el.value + ' % moms' : 'Försäljning, momsfri';
      settings.vatRate = Number(el.value); renderSettings();
    } else if (id === 'startNo') settings.startNo = parseInt(el.value, 10) || 1;
    else if (id === 'fyStartMonth') settings.fyStartMonth = parseInt(el.value, 10);
    else if (id) settings[id] = el.value;
    saveSettings();
    if (!validate()) return;
    if (raw && (id === 'convertTz')) reparse(); else if (parsed && parsed.ok) rebuild();
  }
  $('#settings').addEventListener('change', onSetting);
  $('#settings').addEventListener('input', function (e) { if (e.target.type === 'text' || e.target.type === 'number') onSetting(e); });
  $('#reset').addEventListener('click', function () { var keep = { company: settings.company, orgnr: settings.orgnr }; settings = S2.mergeSettings(keep); saveSettings(); renderSettings(); if (parsed && parsed.ok) rebuild(); });

  // ---------- i18n ----------
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    renderSettings();
    if (parsed) showParsed();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- file input ----------
  var drop = $('#drop'), input = $('#file');
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  input.addEventListener('change', function () { if (input.files[0]) readFile(input.files[0]); });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readFile(f); });
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel.csv').then(function (r) { return r.arrayBuffer(); }).then(function (b) { load(b, 'exempel.csv'); }).catch(function (er) { status(t('err') + er.message, true); });
  });
  function readFile(f) {
    status(t('reading'));
    var r = new FileReader();
    r.onload = function () { load(r.result, f.name); };
    r.onerror = function () { status(t('err') + (r.error && r.error.message), true); };
    r.readAsArrayBuffer(f);
  }
  function load(buf, name) { raw = new Uint8Array(buf); fileName = name; reparse(); }
  function reparse() {
    try { parsed = S2.parse(raw, settings); } catch (e) { parsed = null; $('#result').hidden = true; status(t('err') + e.message, true); return; }
    if (!parsed.ok) {
      $('#result').hidden = true;
      var E = t('errors'), msg = E[parsed.error] || parsed.error;
      if (parsed.error === 'columns') msg += parsed.missing.join(', ') + '. (' + (parsed.header || []).slice(0, 8).join(', ') + '…)';
      if (parsed.error === 'only-foreign') msg += ' (' + Object.keys(parsed.currencies).join(', ').toUpperCase() + ')';
      status(msg, true); return;
    }
    rebuild();
  }
  function rebuild() {
    if (!validate()) return;
    built = S2.build(parsed, settings); shown = 0; showParsed();
  }

  // ---------- render ----------
  function showParsed() {
    if (!parsed || !parsed.ok || !built) return;
    status(t('loaded')(parsed));
    $('#result').hidden = false;
    $('#r-title').textContent = t('title')(built);
    $('#r-meta').textContent = t('meta')(settings);
    var tot = built.totals;
    $('#stats').innerHTML = [[t('vouchers'), built.vouchers.length, true], [t('sales'), tot.sales], [t('refunds'), tot.refunds], [t('fees'), tot.fees], [t('payouts'), tot.payouts]]
      .map(function (x) { return '<div class="stat"><span class="small muted">' + esc(x[0]) + '</span><b>' + (x[2] ? x[1] : money(x[1])) + '</b></div>'; }).join('');
    var W = t('w'), ws = parsed.warnings.concat(built.warnings).map(function (w) { return W[w.code] ? W[w.code](w) : esc(w.code); });
    $('#warn').hidden = !ws.length; $('#warn').innerHTML = ws.map(function (w) { return '<div>⚠ ' + w + '</div>'; }).join('');
    var ex = $('#export'); ex.classList.toggle('locked', !PW.isUnlocked()); ex.disabled = !built.vouchers.length;
    $('#ver-t tbody').innerHTML = ''; shown = 0; more();
  }
  function more() {
    var vs = built.vouchers, end = Math.min(vs.length, shown + PAGE), h = [];
    if (!vs.length) { $('#ver-t tbody').innerHTML = '<tr><td colspan="5" class="muted">' + esc(t('none')) + '</td></tr>'; $('#more').hidden = true; return; }
    for (var i = shown; i < end; i++) {
      var v = vs[i], deb = 0, kre = 0;
      v.trans.forEach(function (x) { if (x.amount > 0) deb += x.amount; else kre -= x.amount; });
      h.push('<tr class="vh"><td>' + esc(v.serie + ' ' + v.nr) + '</td><td>' + esc(v.date) + '</td><td>' + esc(v.text) + '<div class="small muted">' + esc(v.desc) + '</div></td><td class="num">' + money(deb) + '</td><td class="num ' + (deb === kre ? 'ok' : 'bad') + '">' + money(kre) + (deb === kre ? ' ✓' : ' ✗') + '</td></tr>');
      v.trans.forEach(function (x) {
        h.push('<tr class="tr"><td>' + esc(x.konto) + '</td><td>' + esc(built.accounts[x.konto] || '') + '</td><td>' + esc(x.text) + '</td><td class="num">' + (x.amount > 0 ? money(x.amount) : '') + '</td><td class="num">' + (x.amount < 0 ? money(-x.amount) : '') + '</td></tr>');
      });
    }
    $('#ver-t tbody').insertAdjacentHTML('beforeend', h.join(''));
    shown = end;
    $('#more').hidden = shown >= vs.length;
    $('#more').title = t('showing')(shown, vs.length);
  }
  $('#more').addEventListener('click', more);

  // ---------- export / paywall ----------
  var dlg = $('#paywall');
  window.PAYWALL.mount(dlg, PW, { launchAfter: $('#export').parentNode, onUnlocked: function () { showParsed(); doExport(); } });
  $('#export').addEventListener('click', function () { if (PW.isUnlocked()) doExport(); else dlg.showModal(); });
  function doExport() {
    if (!built || !built.vouchers.length) return;
    var bytes = S2.toSIEBytes(built, settings);
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    var first = built.vouchers[0].date, last = built.vouchers[built.vouchers.length - 1].date;
    a.href = url; a.download = 'stripe-' + first + '_' + last + '.si';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    status(t('done'));
  }

  settings = loadSettings();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else renderSettings();
})();
