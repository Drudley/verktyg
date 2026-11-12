/* UI for Semesterlöneskuld i bokslutet. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, S = window.SEMESTER, fmt = K.fmt;
  var lang = 'sv';
  var EN = {
    h1: 'Holiday pay liability at year-end – calculate it and book it (Sweden)',
    lead: 'Enter monthly salary and holiday days for each employee. The tool calculates the <strong>holiday pay liability per person</strong> – saved, untaken and accrued days under the <strong>same-salary rule</strong> or the <strong>12&nbsp;% percentage rule</strong> – plus <strong>employer contributions</strong>, and compares with last year’s balance. Download the journal entry as a SIE file and an Excel pack for the auditor.',
    'calc-h': 'The company and the closing', sample: 'Show example', clear: 'Clear',
    'l-co': 'Company name (optional)', 'l-org': 'Corporate ID (optional)', 'l-closing': 'Closing date', 'l-start': 'The earning year starts',
    'o-apr': '1 April (Holiday Act)', 'o-jan': '1 January (calendar year)', 'l-per': 'Paid holiday days per year',
    'day-h': 'Value of one holiday day (same-salary rule)', 'p-lag': 'Holiday Act: 4.6 % + 0.43 %', 'p-avtal': 'White-collar agreement: 4.6 % + 0.8 %', 'p-d21': 'Monthly salary / 21 + 0.43 %',
    'l-day': 'Daily pay, % of monthly salary', 'l-add': 'Holiday supplement per day, % of monthly salary', 'l-ibs': 'Booked liability 2920 before closing, SEK', 'l-iba': 'Booked contributions 2940 before closing, SEK',
    'pe-h': 'Employees', add: 'Add employee',
    'h-people': 'Leave “accrued days” empty and they are worked out from the closing date. The percentage rule is for hourly and variable pay: enter holiday-qualifying pay for last earning year and so far this year.',
    saved: 'The figures are stored only in this browser. Nothing is sent away.',
    'paid-h': 'Journal entry, SIE file and Excel pack',
    'paid-p': 'Get the <strong>closing journal entry</strong> for the change against the booked liability (7290/2920 and 7519/2940), a <strong>SIE file</strong> to import into Fortnox, Visma, Bokio or other software and an <strong>Excel pack per employee</strong> to keep with the annual accounts.',
    open: 'Show journal entry and pack', 'ver-h': 'Closing journal entry', sie: 'Download SIE file', xlsx: 'Download Excel', print: 'Print closing appendix',
    'cta-h': 'More for the closing:', 'cta-p': '<a href="../pensionsavsattning-aktiebolag/">Pension contribution in a limited company</a> works out the deduction room and special payroll tax before year-end, and <a href="../kontrollbalansrakning/">Kontrollbalansräkning from a SIE file</a> shows whether half the share capital has been used up.',
    'pw-h': 'Journal entry, SIE file and Excel pack', 'pw-p': 'Unlock the closing journal entry, the SIE file and the Excel pack per employee. The liability per person and the employer contributions are always free.'
  };
  var T = {
    sv: { result: 'Semesterlöneskuld', person: 'Anställd', method: 'Regel', samma: 'Sammalöneregeln', procent: 'Procentregeln 12 %', days: 'Dagar', dv: 'Värde/dag', skuld: 'Skuld', avg: 'Arbetsgivaravgift', total: 'Totalt', sum: 'Summa',
      name: 'Namn', monthly: 'Månadslön, kr', saved: 'Sparade dagar', left: 'Outtagna betalda dagar', earned: 'Intjänade dagar i år', earnedPh: 'räknas fram', earnPrev: 'Semestergrundande lön förra intjänandeåret, kr', earnCur: 'Semestergrundande lön hittills i år, kr', ag: 'Arbetsgivaravgift',
      agStd: '31,42 % (född 1959–2002, 2008–)', agYouth: '20,81 % (född 2003–2007, lön ≤ 25 000)', agOld: '10,21 % (född 1938–1958)', agNone: '0 % (född 1937 eller tidigare)', remove: 'Ta bort',
      meta: function (c, m) { return ['Bokslut ' + c.closing, m + ' av 12 månader intjänade i år'].join(' · '); },
      ok: function (r) { return 'Semesterlöneskuld ' + fmt(r.skuld) + ' kr + arbetsgivaravgifter ' + fmt(r.avg) + ' kr = ' + fmt(r.total) + ' kr.'; },
      chg: 'Förändring mot bokfört', statusOk: function (n) { return n + (n === 1 ? ' anställd räknad.' : ' anställda räknade.'); }, statusErr: 'Kontrollera beloppen och datumet (ÅÅÅÅ-MM-DD) – negativa tal kan inte räknas.',
      flag: { 'no-salary': 'Minst en anställd saknar lön – skulden blir 0 kr.', 'youth-cap': 'Sänkt avgift 20,81 % gäller bara lön upp till 25 000 kr/mån – över det betalas 31,42 %.', 'saved-many': 'Många sparade dagar – sparade dagar ska tas ut inom fem år.' },
      konto: 'Konto', text: 'Text', debit: 'Debet', kredit: 'Kredit', verLead: function (d) { return 'Verifikation per ' + d + '. Justerar 2920 och 2940 till beräknad skuld.'; }, verNone: 'Bokförd skuld stämmer redan – ingen justering behövs.',
      xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte lönerådgivning. Stäm av mot lönesystem och avtal.' },
    en: { result: 'Holiday pay liability', person: 'Employee', method: 'Rule', samma: 'Same-salary rule', procent: 'Percentage rule 12 %', days: 'Days', dv: 'Value/day', skuld: 'Liability', avg: 'Employer contributions', total: 'Total', sum: 'Total',
      name: 'Name', monthly: 'Monthly salary, SEK', saved: 'Saved days', left: 'Untaken paid days', earned: 'Days accrued this year', earnedPh: 'worked out', earnPrev: 'Holiday-qualifying pay last earning year, SEK', earnCur: 'Holiday-qualifying pay so far this year, SEK', ag: 'Employer contributions',
      agStd: '31.42 % (born 1959–2002, 2008–)', agYouth: '20.81 % (born 2003–2007, pay ≤ 25,000)', agOld: '10.21 % (born 1938–1958)', agNone: '0 % (born 1937 or earlier)', remove: 'Remove',
      meta: function (c, m) { return ['Closing ' + c.closing, m + ' of 12 months accrued this year'].join(' · '); },
      ok: function (r) { return 'Holiday pay liability ' + fmt(r.skuld) + ' kr + employer contributions ' + fmt(r.avg) + ' kr = ' + fmt(r.total) + ' kr.'; },
      chg: 'Change vs booked', statusOk: function (n) { return n + (n === 1 ? ' employee calculated.' : ' employees calculated.'); }, statusErr: 'Check the amounts and the date (YYYY-MM-DD) – negative numbers cannot be calculated.',
      flag: { 'no-salary': 'At least one employee has no salary – the liability is 0.', 'youth-cap': 'The reduced 20.81 % rate only applies to pay up to SEK 25,000 a month – above that 31.42 % applies.', 'saved-many': 'Many saved days – saved days must be taken within five years.' },
      konto: 'Account', text: 'Text', debit: 'Debit', kredit: 'Credit', verLead: function (d) { return 'Journal entry as of ' + d + '. Adjusts 2920 and 2940 to the calculated liability.'; }, verNone: 'The booked liability already matches – no adjustment needed.',
      xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not payroll advice. Check against your payroll system and agreements.' }
  };
  function L() { return T[lang]; }
  function emptyP() { return { name: '', method: 'samma', monthly: '', saved: '', left: '', earned: '', earnPrev: '', earnCur: '', ag: 'std' }; }
  var st = { company: { name: '', orgnr: '', closing: '2026-12-31', start: 'apr', dayPct: '4,6', addPct: '0,43', daysPerYear: '25', ibSkuld: '', ibAvg: '' }, people: [emptyP()] };

  function collect() {
    var c = st.company;
    c.name = $('#f-co').value.trim(); c.orgnr = $('#f-org').value.trim(); c.closing = $('#f-closing').value.trim(); c.start = $('#f-start').value;
    c.daysPerYear = $('#f-per').value; c.dayPct = $('#f-day').value; c.addPct = $('#f-add').value; c.ibSkuld = $('#f-ibs').value; c.ibAvg = $('#f-iba').value;
    st.people = $$('#people .person').map(function (row) {
      var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o;
    });
    if (!st.people.length) st.people = [emptyP()];
  }
  function fillCompany() {
    var c = st.company;
    $('#f-co').value = c.name || ''; $('#f-org').value = c.orgnr || ''; $('#f-closing').value = c.closing || ''; $('#f-start').value = c.start || 'apr';
    $('#f-per').value = c.daysPerYear || '25'; $('#f-day').value = c.dayPct || ''; $('#f-add').value = c.addPct || ''; $('#f-ibs').value = c.ibSkuld || ''; $('#f-iba').value = c.ibAvg || '';
  }
  function personRow(p, i) {
    var t = L(), el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    var inp = function (k, label, ph) { return '<label><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="decimal" placeholder="' + (ph || '0') + '"></label>'; };
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.name + '</span><input type="text" data-k="name" placeholder="' + t.name + '" autocomplete="off"></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid"><label><span>' + t.method + '</span><select data-k="method"><option value="samma">' + t.samma + '</option><option value="procent">' + t.procent + '</option></select></label>' +
      '<label><span>' + t.ag + '</span><select data-k="ag"><option value="std">' + t.agStd + '</option><option value="youth">' + t.agYouth + '</option><option value="old">' + t.agOld + '</option><option value="none">' + t.agNone + '</option></select></label>' +
      inp('monthly', t.monthly) + inp('saved', t.saved) + inp('left', t.left) + inp('earned', t.earned, t.earnedPh) + inp('earnPrev', t.earnPrev) + inp('earnCur', t.earnCur) + '</div>';
    $$('[data-k]', el).forEach(function (f) { f.value = p[f.dataset.k] != null ? p[f.dataset.k] : ''; if (f.tagName === 'SELECT' && !f.value) f.selectedIndex = 0; });
    var sync = function () { var pr = $('[data-k=method]', el).value === 'procent'; ['earnPrev', 'earnCur'].forEach(function (k) { $('[data-k=' + k + ']', el).closest('label').hidden = !pr; }); ['monthly', 'earned'].forEach(function (k) { $('[data-k=' + k + ']', el).closest('label').hidden = pr; }); };
    sync();
    $('.del', el).addEventListener('click', function () { collect(); st.people.splice(+el.dataset.i, 1); if (!st.people.length) st.people = [emptyP()]; paint(); render(); });
    $$('input,select', el).forEach(function (f) { f.addEventListener('input', function () { sync(); render(); }); f.addEventListener('change', function () { sync(); render(); }); });
    return el;
  }
  function paint() { var box = $('#people'); box.innerHTML = ''; st.people.forEach(function (p, i) { box.appendChild(personRow(p, i)); }); }
  function current() { collect(); return S.company({ company: st.company, people: st.people }); }
  function isEmpty() { return st.people.every(function (p) { return ['monthly', 'saved', 'left', 'earned', 'earnPrev', 'earnCur'].every(function (k) { return !String(p[k] || '').trim(); }); }); }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + fmt(v) + ' kr</strong></div>'; }

  function render() {
    var r = current(), t = L(), res = $('#result'), status = $('#status');
    $$('#calc input').forEach(function (e) { e.classList.remove('bad'); });
    persist();
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      if (r.errors.indexOf('closing') >= 0) $('#f-closing').classList.add('bad');
      if (r.errors.indexOf('dayPct') >= 0) $('#f-day').classList.add('bad');
      if (r.errors.indexOf('addPct') >= 0) $('#f-add').classList.add('bad');
      return;
    }
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    res.hidden = false; status.textContent = t.statusOk(r.n); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.orgnr ? st.company.orgnr + ' · ' : '') + t.meta(st.company, fmt(r.months, r.months % 1 ? 2 : 0));
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(r);
    $('#stats').innerHTML = stat(t.skuld, r.skuld) + stat(t.avg, r.avg) + stat(t.total, r.total) + stat(t.chg, r.chSkuld + r.chAvg);
    var fl = $('#flags');
    if (r.warnings.length) { fl.hidden = false; fl.innerHTML = '<ul>' + r.warnings.map(function (k) { return '<li>' + (t.flag[k] || k) + '</li>'; }).join('') + '</ul>'; } else { fl.hidden = true; fl.innerHTML = ''; }
    $('#per-t thead').innerHTML = '<tr><th>' + t.person + '</th><th>' + t.method + '</th><th class="num">' + t.days + '</th><th class="num">' + t.dv + '</th><th class="num">' + t.skuld + '</th><th class="num">' + t.avg + '</th><th class="num">' + t.total + '</th></tr>';
    $('#per-t tbody').innerHTML = r.rows.map(function (p, i) {
      return '<tr><td>' + K.esc(p.name || (t.person + ' ' + (i + 1))) + '</td><td>' + (p.method === 'procent' ? t.procent : t.samma) + '</td><td class="num">' + fmt(p.days, 2) + '</td><td class="num">' + fmt(p.dayValue, 2) + '</td><td class="num">' + fmt(p.skuld) + '</td><td class="num">' + fmt(p.avg) + '</td><td class="num">' + fmt(p.total) + '</td></tr>';
    }).join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td class="num">' + fmt(r.days, 2) + '</td><td></td><td class="num">' + fmt(r.skuld) + '</td><td class="num">' + fmt(r.avg) + '</td><td class="num">' + fmt(r.total) + '</td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  function verHtml(r) {
    var t = L(), v = r.voucher;
    if (!v.trans.length) return '<p>' + t.verNone + '</p>';
    return '<p>' + t.verLead(v.date) + '</p><div class="tbl"><table id="ver-t"><thead><tr><th>' + t.konto + '</th><th>' + t.text + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      v.trans.map(function (x) { var a = x.amount / 100; return '<tr><td>' + x.konto + '</td><td>' + S.ACCOUNTS[x.konto] + '</td><td class="num">' + (a > 0 ? fmt(a) : '') + '</td><td class="num">' + (a < 0 ? fmt(-a) : '') + '</td></tr>'; }).join('') +
      '</tbody></table></div><p class="hint">' + t.help + '</p>';
  }
  function renderPaid(r) { r = r || current(); if (r.ok) $('#ver').innerHTML = verHtml(r); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }

  function sieBytes(r) {
    var y = st.company.closing.slice(0, 4), accounts = {};
    r.voucher.trans.forEach(function (x) { accounts[x.konto] = S.ACCOUNTS[x.konto]; });
    return window.SIEW.toBytes({ fnamn: st.company.name || 'Företaget', orgnr: st.company.orgnr, program: 'Semesterlöneskuld (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10),
      rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: accounts, vouchers: r.voucher.trans.length ? [r.voucher] : [] });
  }
  function downloadSie() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok) return;
    try { K.download(sieBytes(r), 'semesterloneskuld-' + st.company.closing + '.se', 'text/plain'); $('#dl-msg').textContent = t.sieOk; } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok) return;
    var c = st.company;
    var sum = [[bold('Semesterlöneskuld – bokslutsunderlag')], ['Bolag', c.name || ''], ['Organisationsnummer', c.orgnr || ''], ['Bokslutsdag', c.closing], ['Intjänandeår börjar', c.start === 'jan' ? '1 januari' : '1 april'],
      ['Dagslön, % av månadslön', K.fmt(S.num(c.dayPct), 4)], ['Semestertillägg, % av månadslön', K.fmt(S.num(c.addPct), 2)], [],
      ['Semesterlöneskuld, kr', money(r.skuld)], ['Arbetsgivaravgifter, kr', money(r.avg)], ['Totalt, kr', money(r.total)],
      ['Bokfört på 2920 före bokslut, kr', money(r.ibSkuld)], ['Bokfört på 2940 före bokslut, kr', money(r.ibAvg)], ['Förändring skuld (7290/2920), kr', money(r.chSkuld)], ['Förändring avgifter (7519/2940), kr', money(r.chAvg)], [], [t.help]];
    var per = [[bold('Anställd'), bold('Regel'), bold('Månadslön'), bold('Sparade'), bold('Outtagna'), bold('Intjänade i år'), bold('Lön förra intj.år'), bold('Lön hittills i år'), bold('Värde/dag'), bold('Dagar'), bold('Skuld'), bold('Avgift %'), bold('Avgift'), bold('Totalt')]];
    r.rows.forEach(function (p, i) { per.push([p.name || ('Anställd ' + (i + 1)), p.method === 'procent' ? 'Procentregeln 12 %' : 'Sammalöneregeln', money(p.monthly), p.saved, p.left, p.method === 'procent' ? '' : p.earned, money(p.earnPrev), money(p.earnCur), money(p.dayValue), p.days, money(p.skuld), K.fmt(p.rate * 100, 2), money(p.avg), money(p.total)]); });
    per.push([bold('Summa'), '', '', '', '', '', '', '', '', r.days, money(r.skuld), '', money(r.avg), money(r.total)]);
    var ver = [[bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit')]];
    r.voucher.trans.forEach(function (x) { var a = x.amount / 100; ver.push([x.konto, S.ACCOUNTS[x.konto], a > 0 ? money(a) : '', a < 0 ? money(-a) : '']); });
    if (!r.voucher.trans.length) ver.push([t.verNone]);
    var src = [[bold('Källor')], ['Semesterlag (1977:480) 3, 4, 16 a, 16 b, 18 §§'], ['https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/semesterlag-1977480_sfs-1977-480/'], ['Skatteverket: Arbetsgivaravgifter 2026'], ['https://www.skatteverket.se/foretag/arbetsgivare/arbetsgivaravgifterochskatteavdrag/arbetsgivaravgifter.4.233f91f71260075abe8800020817.html'], ['BAS kontoplan 2026: 2920, 2940, 7290, 7519']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [40, 22] }, { name: 'Anställda', rows: per, widths: [26, 20, 12, 10, 10, 14, 16, 16, 12, 10, 14, 10, 14, 14] }, { name: 'Verifikation', rows: ver, widths: [10, 50, 16, 16] }, { name: 'Källor', rows: src, widths: [100] }], { title: 'Semesterlöneskuld' });
      K.download(buf, 'semesterloneskuld-' + c.closing + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok) return;
    $('#print-root').innerHTML = '<article class="card"><h1>' + K.esc((st.company.name ? st.company.name + ' – ' : '') + t.result + ' ' + st.company.closing) + '</h1><p>' + K.esc($('#r-meta').textContent) + '</p><p><strong>' + t.ok(r) + '</strong></p>' + $('#per-t').outerHTML + verHtml(r) + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.people) && d.people.length) { st = d; return true; } return false; }

  var setLang = K.i18n(EN, function (l) { lang = l; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.people.push(emptyP()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = S.sample(); fillCompany(); paint(); render(); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { company: { name: '', orgnr: '', closing: '2026-12-31', start: 'apr', dayPct: '4,6', addPct: '0,43', daysPerYear: '25', ibSkuld: '', ibAvg: '' }, people: [emptyP()] }; fillCompany(); paint(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('.preset [data-preset]').forEach(function (b) { b.addEventListener('click', function () { var p = S.PRESETS[b.dataset.preset]; $('#f-day').value = K.fmt(p.dayPct, b.dataset.preset === 'd21' ? 4 : 1); $('#f-add').value = K.fmt(p.addPct, 2); render(); }); });
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
