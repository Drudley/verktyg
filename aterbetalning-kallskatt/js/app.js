/* UI for Källskatt tillbaka. Everything runs in the browser; files are never uploaded. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, K = window.KALLSKATT, X = window.KEXPORT, lang = 'sv';
  var st = { files: [], res: null, accounts: {} };
  var EN = {
    h1: 'Reclaim foreign withholding tax – Finland, Norway, Denmark and Switzerland',
    lead: 'Do you hold Nordea, Sampo, Norwegian or Danish shares in an ISK or a regular brokerage account? Then you have probably paid <strong>20–25 % too much withholding tax</strong>. Drop the transaction export from <strong>Avanza or Nordnet</strong> to see how much you can get back per country and year, and the <strong>deadline</strong> for each. <strong>The file never leaves your computer.</strong>',
    drop: 'Drop the Avanza or Nordnet transaction export here or <u>choose a file</u>', dropsub: 'CSV export of transactions, ideally five years back · several files are fine (e.g. several accounts or years)',
    sample: 'Try a synthetic sample file', add: 'Add more files', 'sum-h': 'To reclaim per country and year',
    'c-country': 'Country', 'c-year': 'Year', 'c-n': 'Dividends', 'c-wh': 'Tax withheld', 'c-back': 'To reclaim', 'c-sek': 'approx. SEK', 'c-status': 'Status', 'c-dl': 'Deadline',
    'paid-h': 'Claim specification, checklist and Excel',
    'paid-p': 'Every dividend with shares, dividend per share, gross, tax withheld and the amount to reclaim in <strong>the currency each authority wants</strong> (EUR for Vero 6164r/6167r, NOK for Skatteetaten, DKK for the Danish Tax Agency, CHF for ESTV Form 80), a checklist per country, a printable annex and an Excel file.',
    open: 'Show the per-dividend specification', 'dl-xlsx': 'Download Excel file (.xlsx)', print: 'Print annex / save as PDF',
    'rev-h': 'Check before you send',
    'rev-1': 'Compare every amount with the bank\'s <strong>dividend statement or annual statement</strong>. Authorities want amounts in their own currency – where the file only has kronor they are converted at the Riksbank rate on the payment date and marked.',
    'rev-2': 'The country comes from the ISIN code (FI, NO, DK, CH). The tax rate is checked against the statutory rate and deviations are flagged. If the bank already withheld only 15 % there is nothing to reclaim.',
    'rev-3': 'Endowment insurance (KF) and pension accounts are owned by the insurer – you cannot claim yourself. Such accounts are deselected by default.',
    'rev-4': 'If you already got a credit for the full withholding tax in your Swedish return and then receive a refund, the credit should only cover 15 %. You are responsible for your own claims and tax return.',
    'pw-h': 'Specification, checklist and Excel', 'pw-p': 'Unlock the per-dividend specification in the right currency, the checklist per country, the printable annex and the Excel file. The summary per country and year is always free.'
  };
  var T = {
    sv: { reading: 'Läser filen…', err: 'Kunde inte läsa filen: ', 'unknown-format': 'Känner inte igen filen. Använd transaktionsexporten (CSV) från Avanza eller Nordnet.', 'missing-columns': 'Kolumner saknas i filen: ', xlsx: 'Det här är en Excel-fil. Exportera transaktionerna som CSV i stället.',
      files: function (n) { return n === 1 ? '1 fil' : n + ' filer'; }, title: function (s) { return 'Du kan få tillbaka ca ' + s; }, titleNone: 'Ingen källskatt att söka tillbaka hittades',
      meta: function (f, b, n, ig) { return f + ' · ' + b + ' · ' + n + ' utdelningar med källskatt · ' + ig + ' andra rader ignorerade'; },
      sOpen: 'Att få tillbaka (öppet)', sUrgent: 'Bråttom – sista dag inom 4 mån', sExpired: 'Redan preskriberat', sN: 'Utdelningar granskade', kr: ' kr', incl: 'Ta med konto', excl: '(försäkring/pension – bortvalt)',
      fl: { 'orphan-tax': function (f) { return 'Källskatt utan matchande utdelning: ' + f.date + ' ' + (f.name || '') + ' (' + money(f.amount) + ' kr, rad ' + f.line + ').'; }, 'no-isin': function (f) { return 'Utdelning utan ISIN – landet kan inte avgöras: ' + f.date + ' ' + f.name + ' (rad ' + f.line + ').'; }, duplicates: function (f) { return f.n + ' dubbletter från överlappande filer togs bort.'; } },
      it: function (n, what) { return n + ' utdelning' + (n === 1 ? '' : 'ar') + ': ' + what; },
      belowMin: function (g) { return X.NAMES.sv[g.country] + ' ' + g.year + ': ' + money(g.reclaimOpen, g.cur) + ' är under minsta utbetalning (' + K.COUNTRIES[g.country].minPayout + ' ' + g.cur + ').'; },
      rateInfo: function (d) { return 'Kurser från Riksbanken till och med ' + d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) + '.'; },
      other: function (s) { return 'Andra länder i filen: ' + s + '. De ingår inte i den här beräkningen (USA drar normalt redan 15 %).'; },
      total: 'Summa öppet', nothing: 'Inga utdelningar från Finland, Norge, Danmark eller Schweiz hittades i filen.', perYear: 'Underlag', check: 'Checklista',
      xlsxOk: 'Excel-filen har laddats ner.', file: 'Kallskatt-underlag.xlsx', waitUntil: 'ansök tidigast ', left: function (n) { return n + ' dagar kvar'; } },
    en: { reading: 'Reading the file…', err: 'Could not read the file: ', 'unknown-format': 'File not recognised. Use the transaction export (CSV) from Avanza or Nordnet.', 'missing-columns': 'Columns missing in the file: ', xlsx: 'This is an Excel file. Export the transactions as CSV instead.',
      files: function (n) { return n === 1 ? '1 file' : n + ' files'; }, title: function (s) { return 'You can get back approx. ' + s; }, titleNone: 'No withholding tax to reclaim found',
      meta: function (f, b, n, ig) { return f + ' · ' + b + ' · ' + n + ' dividends with withholding tax · ' + ig + ' other rows ignored'; },
      sOpen: 'To reclaim (open)', sUrgent: 'Urgent – deadline within 4 months', sExpired: 'Already time-barred', sN: 'Dividends checked', kr: ' SEK', incl: 'Include account', excl: '(insurance/pension – deselected)',
      fl: { 'orphan-tax': function (f) { return 'Withholding tax without a matching dividend: ' + f.date + ' ' + (f.name || '') + ' (' + money(f.amount) + ' SEK, line ' + f.line + ').'; }, 'no-isin': function (f) { return 'Dividend without ISIN – country unknown: ' + f.date + ' ' + f.name + ' (line ' + f.line + ').'; }, duplicates: function (f) { return f.n + ' duplicates from overlapping files were removed.'; } },
      it: function (n, what) { return n + ' dividend' + (n === 1 ? '' : 's') + ': ' + what; },
      belowMin: function (g) { return X.NAMES.en[g.country] + ' ' + g.year + ': ' + money(g.reclaimOpen, g.cur) + ' is below the minimum payout (' + K.COUNTRIES[g.country].minPayout + ' ' + g.cur + ').'; },
      rateInfo: function (d) { return 'Riksbank rates up to ' + d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6) + '.'; },
      other: function (s) { return 'Other countries in the file: ' + s + '. They are not part of this calculation (the US normally withholds 15 % already).'; },
      total: 'Total open', nothing: 'No dividends from Finland, Norway, Denmark or Switzerland were found in the file.', perYear: 'Specification', check: 'Checklist',
      xlsxOk: 'The Excel file has been downloaded.', file: 'Withholding-tax-claim.xlsx', waitUntil: 'claim from ', left: function (n) { return n + ' days left'; } }
  };
  function t(k) { return T[lang][k]; }
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var loc = function () { return lang === 'en' ? 'en-GB' : 'sv-SE'; };
  function kr(n) { return Math.round(n).toLocaleString(loc()) + t('kr'); }
  function money(n, cur) { return (Math.round(n * 100) / 100).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (cur ? ' ' + cur : ''); }
  function qty(n) { return (Math.round(n * 1e6) / 1e6).toLocaleString(loc(), { maximumFractionDigits: 6 }); }

  // ---------- i18n ----------
  var SV = {};
  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    if (st.res) render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- file input ----------
  var drop = $('#drop'), input = $('#file'), append = false;
  function status(msg, err) { var s = $('#status'); s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }
  drop.addEventListener('click', function (e) { if (e.target.id !== 'sample') input.click(); });
  drop.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) { if (e.dataTransfer.files.length) readFiles(e.dataTransfer.files, false); });
  input.addEventListener('change', function () { if (input.files.length) readFiles(input.files, append); input.value = ''; append = false; });
  $('#add').addEventListener('click', function () { append = true; input.click(); });
  function readFiles(list, add) {
    status(t('reading'));
    var fs = Array.prototype.slice.call(list);
    Promise.all(fs.map(function (f) { return new Promise(function (ok, no) { var r = new FileReader(); r.onload = function () { ok({ buf: r.result, name: f.name }); }; r.onerror = function () { no(new Error(f.name)); }; r.readAsArrayBuffer(f); }); }))
      .then(function (xs) { load(xs, add); }).catch(function (er) { status(t('err') + er.message, true); });
  }
  $('#sample').addEventListener('click', function (e) {
    e.stopPropagation(); status(t('reading'));
    fetch('exempel-avanza-syntetisk.csv').then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(function (b) { load([{ buf: b, name: 'exempel-avanza-syntetisk.csv' }], false); }).catch(function (er) { status(t('err') + er.message, true); });
  });
  function errText(er) { return (t(er.message) || t('err') + er.message) + (er.cols ? er.cols.join(', ') : ''); }
  function load(xs, add) {
    var ok = [], bad = [];
    xs.forEach(function (x) { try { var p = K.parseFile(new Uint8Array(x.buf)); p.name = x.name; ok.push(p); } catch (er) { bad.push(x.name + ': ' + errText(er)); } });
    if (!ok.length) { status(bad.join(' · '), true); return; }
    st.files = add ? st.files.concat(ok) : ok;
    if (!add) st.accounts = {};
    status(bad.join(' · '), !!bad.length);
    compute(); $('#result').hidden = false; render();
  }
  function compute() { st.res = K.compute(st.files, { rates: window.K4_RATES, accounts: st.accounts }); }

  // ---------- render ----------
  function statusCell(code, it) {
    var cls = code === 'expired' ? 'bad' : code === 'urgent' ? 'mid' : code === 'wait' ? 'mid' : code === 'nothing' ? 'mid' : '';
    return '<span class="tag ' + cls + '">' + esc(X.STATUS[lang][code]) + '</span>';
  }
  function render() {
    var r = st.res, Tl = T[lang], N = X.NAMES[lang];
    var openSek = r.totals.reclaimOpenSek, urgent = r.groups.filter(function (g) { return g.status === 'urgent'; }).reduce(function (s, g) { return s + g.reclaimOpenSek; }, 0);
    $('#r-title').textContent = openSek >= 1 ? Tl.title(kr(openSek)) : Tl.titleNone;
    var brokers = st.files.map(function (f) { return f.broker === 'avanza' ? 'Avanza' : 'Nordnet'; }).filter(function (b, i, a) { return a.indexOf(b) === i; }).join(' + ');
    $('#r-meta').textContent = Tl.meta(st.files.length === 1 ? st.files[0].name : Tl.files(st.files.length), brokers, r.items.length, st.files.reduce(function (s, f) { return s + f.ignored; }, 0));
    $('#accts').innerHTML = Object.keys(r.accounts).map(function (a, i) {
      var A = r.accounts[a];
      return '<label><input type="checkbox" data-acc="' + esc(a) + '"' + (A.included ? ' checked' : '') + '> ' + esc(Tl.incl) + ' <strong>' + esc(a) + '</strong>' + (A.auto ? '' : ' <span class="muted">' + esc(Tl.excl) + '</span>') + '</label>';
    }).join('');
    $('#stats').innerHTML = [[Tl.sOpen, kr(openSek)], [Tl.sUrgent, kr(urgent)], [Tl.sExpired, kr(r.totals.reclaimExpiredSek)], [Tl.sN, String(r.items.length)]]
      .map(function (s) { return '<div class="stat"><span class="muted small">' + esc(s[0]) + '</span><b>' + esc(s[1]) + '</b></div>'; }).join('');
    // flags
    var fl = r.flags.map(function (f) { return Tl.fl[f.code] ? Tl.fl[f.code](f) : f.code; });
    var cnt = {}; r.items.forEach(function (i) { i.flags.forEach(function (f) { if (f !== 'fx-riksbank' && f !== 'no-tax-row') cnt[f] = (cnt[f] || 0) + 1; }); });
    Object.keys(cnt).forEach(function (f) { fl.push(Tl.it(cnt[f], X.FLAG[lang][f] || f)); });
    r.groups.filter(function (g) { return g.belowMin; }).forEach(function (g) { fl.push(Tl.belowMin(g)); });
    $('#flags').hidden = !fl.length; $('#flags').innerHTML = '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    var fx = r.items.filter(function (i) { return i.how === 'riksbank'; }).length;
    var info = [];
    if (fx) info.push(Tl.it(fx, X.HOW[lang].riksbank));
    if (r.totals.rateTo) info.push(Tl.rateInfo(r.totals.rateTo));
    $('#info').hidden = !info.length; $('#info').innerHTML = '<ul>' + info.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    // summary table (free)
    var tb = $('#sum-t tbody');
    tb.innerHTML = r.groups.length ? r.groups.map(function (g) {
      var st_ = g.status === 'urgent' || g.status === 'open' ? statusCell(g.status) + (g.items[0] && g.status === 'urgent' ? ' <span class="small muted">' + esc(Tl.left(Math.min.apply(null, g.items.filter(function (i) { return i.daysLeft != null; }).map(function (i) { return i.daysLeft; })))) + '</span>' : '') : statusCell(g.status);
      if (g.status === 'wait') { var w = g.items.map(function (i) { return i.waitUntil; }).filter(Boolean).sort().pop(); if (w) st_ += ' <span class="small muted">' + esc(Tl.waitUntil + w) + '</span>'; }
      return '<tr class="' + (g.status === 'expired' ? 'muted' : '') + '"><td>' + esc(N[g.country]) + '</td><td>' + g.year + '</td><td class="num">' + g.n + '</td><td class="num">' + money(g.withheld, g.cur) + '</td><td class="num"><strong>' + money(g.reclaim, g.cur) + '</strong></td><td class="num">' + kr(g.status === 'expired' ? 0 : g.reclaimOpenSek) + '</td><td>' + st_ + '</td><td>' + esc(g.deadline) + '</td></tr>';
    }).join('') : '<tr><td colspan="8" class="muted">' + esc(Tl.nothing) + '</td></tr>';
    $('#sum-t tfoot').innerHTML = r.groups.length ? '<tr><td colspan="5">' + esc(Tl.total) + '</td><td class="num">' + kr(openSek) + '</td><td colspan="2"></td></tr>' : '';
    var oth = r.other.filter(function (o) { return o.n; });
    $('#other').hidden = !oth.length;
    $('#other').textContent = oth.length ? Tl.other(oth.map(function (o) { return o.country + ' (' + o.n + ')'; }).join(', ')) : '';
    $('#spec-open').disabled = !r.items.some(function (i) { return i.reclaim > 0; });
    $('#spec-open').classList.toggle('locked', !PW.isUnlocked());
    if (!$('#paid-out').hidden) renderPaid();
  }
  $('#accts').addEventListener('change', function (e) { var a = e.target.dataset.acc; if (a == null) return; st.accounts[a] = e.target.checked; compute(); render(); });

  // ---------- paid: specification ----------
  function renderPaid() {
    var r = st.res, Tl = T[lang], N = X.NAMES[lang], H = X.H[lang];
    $('#paid-out').hidden = false; $('#spec-open').classList.remove('locked');
    var html = '';
    ['FI', 'NO', 'DK', 'CH'].forEach(function (cc) {
      var its = r.items.filter(function (i) { return i.country === cc && i.reclaim > 0 && i.status !== 'expired'; }); if (!its.length) return;
      var cur = its[0].cur, years = its.map(function (i) { return i.year; }).filter(function (y, k, a) { return a.indexOf(y) === k; });
      html += '<div class="k4page country" data-cc="' + cc + '"><h3>' + esc(N[cc]) + ' – ' + esc(K.COUNTRIES[cc].form) + '</h3>';
      years.forEach(function (y) {
        var yi = its.filter(function (i) { return i.year === y; }), cols = X.specColumns(cc, lang, cur);
        var sum = yi.reduce(function (a, i) { a[0] += i.gross; a[1] += i.withheld; a[2] += i.treaty; a[3] += i.reclaim; return a; }, [0, 0, 0, 0]);
        html += '<h4>' + esc(Tl.perYear + ' ' + y) + ' · ' + esc(H.deadline) + ' ' + esc(yi[0].deadline) + '</h4><div class="tbl"><table class="spec"><thead><tr>' +
          cols.map(function (c, k) { return k === 7 || k === 9 ? '' : '<th' + (k >= 3 && k <= 8 ? ' class="num"' : '') + '>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          yi.map(function (i) {
            return '<tr' + (i.flags.length ? ' class="bad"' : '') + '><td>' + esc(i.name) + '</td><td>' + esc(i.isin) + '</td><td>' + esc(i.date) + '</td><td class="num">' + qty(i.qty) + '</td><td class="num">' + (i.how === 'per-share' ? money(i.perShare) : '–') + '</td><td class="num">' + money(i.gross) + '</td><td class="num">' + money(i.withheld) + '</td><td class="num"><strong>' + money(i.reclaim) + '</strong></td><td class="small">' + esc([i.account].concat(i.flags.length ? [X.flagText(i, lang)] : []).join(' · ')) + '</td></tr>';
          }).join('') + '</tbody><tfoot><tr><td colspan="5">' + esc(lang === 'en' ? 'Total' : 'Summa') + '</td><td class="num">' + money(sum[0]) + '</td><td class="num">' + money(sum[1]) + '</td><td class="num">' + money(sum[3], cur) + '</td><td></td></tr></tfoot></table></div>';
      });
      html += '<h4>' + esc(Tl.check) + '</h4><ul class="steps">' + X.CHECK[lang][cc].map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>';
    });
    $('#spec').innerHTML = html;
  }
  $('#spec-open').addEventListener('click', function () { if (PW.isUnlocked()) return renderPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { renderPaid(); } });

  // ---------- downloads ----------
  function save(bytes, name, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  function msg(s, err) { var m = $('#dl-msg'); m.textContent = s; m.className = 'small ' + (err ? 'pw-msg err' : 'pw-msg ok'); }
  $('#dl-xlsx').addEventListener('click', function () {
    if (!PW.isUnlocked() || !st.res) return;
    window.XLSXW.build(X.sheets(st.res, lang), { title: 'Källskatt tillbaka', creator: 'Källskatt tillbaka' })
      .then(function (b) { save(b, t('file'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg(t('xlsxOk')); })
      .catch(function (er) { msg(t('err') + er.message, true); });
  });
  $('#print').addEventListener('click', function () { if (!PW.isUnlocked()) return; document.body.classList.add('printing'); window.print(); setTimeout(function () { document.body.classList.remove('printing'); }, 500); });
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
