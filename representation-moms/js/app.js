/* UI for Representation – moms och avdrag. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, R = window.REPR, fmt = K.fmt;
  var lang = 'sv';
  var EN = {
    h1: 'Business entertainment in Sweden – deductible VAT and bookkeeping',
    lead: 'Add the receipts from business dinners, coffee meetings, golf, staff parties and client gifts. The tool works out <strong>deductible VAT</strong> (the SEK 300 cap, proportioning or the 46/33 kr standard amount) and <strong>deductible cost</strong> per occasion under the 2026 rules, and posts to <strong>6071/6072, 7631/7632 and 2641</strong>.',
    'calc-h': 'The company', sample: 'Show example', clear: 'Clear',
    'l-co': 'Company name (optional)', 'l-org': 'Corporate ID (optional)', 'l-moms': 'VAT-registered business', 'o-ja': 'Yes – may deduct VAT', 'o-nej': 'No – no VAT deduction',
    'l-pay': 'Paid from account', 'l-serie': 'Voucher series', 'l-nr': 'First voucher number', 'it-h': 'Entertainment occasions', add: 'Add occasion',
    'h-items': 'Enter the amounts <strong>excluding VAT</strong> per VAT rate as on the receipt. Restaurant food is 12&nbsp;%, groceries and food without service 6&nbsp;% from 1 April 2026, alcohol and most other things 25&nbsp;%, green fees and theatre 6&nbsp;%.',
    saved: 'The figures are stored only in this browser. Nothing is sent away.',
    'paid-h': 'Postings, SIE file and entertainment record',
    'paid-p': 'Get the <strong>postings per occasion</strong> (6071/6072, 7631/7632, 2641), a <strong>SIE file</strong> to import into Fortnox, Visma, Bokio or other software, an <strong>Excel pack</strong> and a printable <strong>entertainment record</strong> with purpose, participants and calculation to keep with the receipt.',
    open: 'Show postings and record', 'ver-h': 'Postings', sie: 'Download SIE file', xlsx: 'Download Excel', print: 'Print entertainment record',
    'cta-h': 'More VAT and bookkeeping:', 'cta-p': '<a href="../sie-till-excel/">SIE to Excel</a> shows the whole ledger as a spreadsheet – handy when you want to see what is on 6072 and 7632 before the tax return.<span data-needs="bokfora-inkop-eu"> Buying from abroad? <a href="../bokfora-inkop-eu/">Book purchases from the EU and abroad</a> works out reverse-charge VAT and the VAT return boxes.</span>',
    'pw-h': 'Postings, SIE file and entertainment record', 'pw-p': 'Unlock the postings, the SIE file, the Excel pack and the entertainment record to keep with the receipts. The deductible VAT and cost are always free.'
  };
  var T = {
    sv: { result: 'Representation', date: 'Datum', purpose: 'Syfte', people: 'Deltagare (namn och företag)', n: 'Antal personer', kind: 'Slag', extern: 'Extern (kunder, leverantörer)', intern: 'Intern (personal)', type: 'Typ',
      meal: 'Lunch, middag, mingel', simple: 'Enklare förtäring (fika)', activity: 'Teater, golf, kringkostnad fest', gift: 'Representationsgåva', r25: 'Exkl. moms 25 % (alkohol, övrigt), kr', r12: 'Exkl. moms 12 % (restaurang), kr', r6: 'Exkl. moms 6 % (livsmedel, golf, teater), kr',
      method: 'Momsberäkning', mAuto: 'Bästa tillåtna', mProp: 'Proportionering', mSch: 'Schablon 46/33 kr', remove: 'Ta bort',
      ex: 'Exkl. moms', vat: 'Moms', dedVat: 'Avdragsgill moms', dedCost: 'Avdragsgill kostnad', nonDed: 'Ej avdragsgill', total: 'Betalt', sum: 'Summa', persons: 'Pers.',
      how: { full: 'hela momsen', prop: 'proportionering', schablon: 'schablon', none: 'ingen momsavdragsrätt' },
      meta: function (r) { return r.totals.n + ' tillfällen · ' + fmt(r.totals.total / 100, 2) + ' kr betalt'; },
      ok: function (r) { return 'Avdragsgill moms ' + fmt(r.totals.dedVat / 100, 2) + ' kr (fält 48) · avdragsgill kostnad ' + fmt(r.totals.dedCost / 100, 2) + ' kr · ej avdragsgill ' + fmt(r.totals.nonDed / 100, 2) + ' kr.'; },
      statusOk: function (n) { return n + (n === 1 ? ' tillfälle räknat.' : ' tillfällen räknade.'); }, statusErr: 'Kontrollera datum (ÅÅÅÅ-MM-DD), antal personer och beloppen på de markerade tillfällena.',
      flag: { 'no-schablon': 'Schablon går inte på tillfälle %n – den kräver alkohol, minst 300 kr per person och minst så mycket moms. Proportionering används.', 'simple-over': 'Tillfälle %n: enklare förtäring över 60 kr per person – inget avdrag i deklarationen.', 'simple-alcohol': 'Tillfälle %n: alkohol räknas inte som enklare förtäring – inget avdrag i deklarationen.', 'gift-intern': 'Tillfälle %n: gåvor till anställda är inte representation – kontrollera reglerna för personalgåvor.', 'party-two': 'Tillfälle %n: personalfest – skattefri för de anställda om den är öppen för alla och högst två per år.' },
      konto: 'Konto', text: 'Text', debit: 'Debet', kredit: 'Kredit', ver: 'Ver', verLead: function (n) { return n + ' verifikationer, en per tillfälle.'; },
      xlsxOk: 'Excel-filen är nedladdad.', sieOk: 'SIE-filen är nedladdad.', fail: 'Kunde inte skapa filen.', help: 'Hjälpmedel, inte skatterådgivning. Spara kvittot tillsammans med syfte och deltagare.',
      recH: 'Representationsunderlag', recCalc: 'Uträkning' },
    en: { result: 'Entertainment', date: 'Date', purpose: 'Purpose', people: 'Participants (names and companies)', n: 'Number of people', kind: 'Kind', extern: 'External (clients, suppliers)', intern: 'Internal (staff)', type: 'Type',
      meal: 'Lunch, dinner, reception', simple: 'Light refreshments (coffee)', activity: 'Theatre, golf, party extras', gift: 'Business gift', r25: 'Excl. VAT 25 % (alcohol, other), SEK', r12: 'Excl. VAT 12 % (restaurant), SEK', r6: 'Excl. VAT 6 % (groceries, golf, theatre), SEK',
      method: 'VAT calculation', mAuto: 'Best allowed', mProp: 'Proportioning', mSch: 'Standard 46/33 kr', remove: 'Remove',
      ex: 'Excl. VAT', vat: 'VAT', dedVat: 'Deductible VAT', dedCost: 'Deductible cost', nonDed: 'Non-deductible', total: 'Paid', sum: 'Total', persons: 'Ppl',
      how: { full: 'all VAT', prop: 'proportioning', schablon: 'standard amount', none: 'no VAT deduction' },
      meta: function (r) { return r.totals.n + ' occasions · ' + fmt(r.totals.total / 100, 2) + ' kr paid'; },
      ok: function (r) { return 'Deductible VAT ' + fmt(r.totals.dedVat / 100, 2) + ' kr (box 48) · deductible cost ' + fmt(r.totals.dedCost / 100, 2) + ' kr · non-deductible ' + fmt(r.totals.nonDed / 100, 2) + ' kr.'; },
      statusOk: function (n) { return n + (n === 1 ? ' occasion calculated.' : ' occasions calculated.'); }, statusErr: 'Check the date (YYYY-MM-DD), the number of people and the amounts on the marked occasions.',
      flag: { 'no-schablon': 'The standard amount cannot be used on occasion %n – it needs alcohol, at least SEK 300 per person and at least that much VAT. Proportioning is used.', 'simple-over': 'Occasion %n: light refreshments over SEK 60 per person – no income-tax deduction.', 'simple-alcohol': 'Occasion %n: alcohol is not light refreshments – no income-tax deduction.', 'gift-intern': 'Occasion %n: gifts to employees are not entertainment – check the rules for staff gifts.', 'party-two': 'Occasion %n: staff party – tax-free for employees if open to all and at most two a year.' },
      konto: 'Account', text: 'Text', debit: 'Debit', kredit: 'Credit', ver: 'No', verLead: function (n) { return n + ' journal entries, one per occasion.'; },
      xlsxOk: 'The Excel file has been downloaded.', sieOk: 'The SIE file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not tax advice. Keep the receipt with the purpose and participants.',
      recH: 'Entertainment record', recCalc: 'Calculation' }
  };
  function L() { return T[lang]; }
  function emptyI() { return { date: '', kind: 'extern', type: 'meal', purpose: '', people: '', n: '', r25: '', r12: '', r6: '', method: 'auto' }; }
  function emptyC() { return { name: '', orgnr: '', pay: '1930', moms: 'ja', serie: 'A', nr: '1' }; }
  var st = { company: emptyC(), items: [emptyI()] };

  function collect() {
    var c = st.company; c.name = $('#f-co').value.trim(); c.orgnr = $('#f-org').value.trim(); c.moms = $('#f-moms').value; c.pay = $('#f-pay').value.trim(); c.serie = $('#f-serie').value.trim(); c.nr = $('#f-nr').value.trim();
    st.items = $$('#people .person').map(function (row) { var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o; });
    if (!st.items.length) st.items = [emptyI()];
  }
  function fillCompany() { var c = st.company; $('#f-co').value = c.name || ''; $('#f-org').value = c.orgnr || ''; $('#f-moms').value = c.moms || 'ja'; $('#f-pay').value = c.pay || '1930'; $('#f-serie').value = c.serie || 'A'; $('#f-nr').value = c.nr || '1'; }
  function sel(k, label, opts) { return '<label><span>' + label + '</span><select data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select></label>'; }
  function inp(k, label, ph, mode) { return '<label><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="' + (mode || 'decimal') + '" placeholder="' + (ph || '0') + '" autocomplete="off"></label>'; }
  function itemRow(p, i) {
    var t = L(), el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.purpose + '</span><input type="text" data-k="purpose" placeholder="' + t.purpose + '" autocomplete="off"></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid">' + inp('date', t.date, '2026-09-15', 'numeric') + sel('kind', t.kind, [['extern', t.extern], ['intern', t.intern]]) +
      sel('type', t.type, [['meal', t.meal], ['simple', t.simple], ['activity', t.activity], ['gift', t.gift]]) + inp('n', t.n, '1', 'numeric') + '</div>' +
      '<div class="grid wide"><label><span>' + t.people + '</span><input type="text" data-k="people" autocomplete="off"></label></div>' +
      '<div class="grid">' + inp('r12', t.r12) + inp('r6', t.r6) + inp('r25', t.r25) + sel('method', t.method, [['auto', t.mAuto], ['prop', t.mProp], ['schablon', t.mSch]]) + '</div><p class="res"></p>';
    $$('[data-k]', el).forEach(function (f) { f.value = p[f.dataset.k] != null ? p[f.dataset.k] : ''; if (f.tagName === 'SELECT' && !f.value) f.selectedIndex = 0; });
    $('.del', el).addEventListener('click', function () { collect(); st.items.splice(+el.dataset.i, 1); if (!st.items.length) st.items = [emptyI()]; paint(); render(); });
    $$('input,select', el).forEach(function (f) { f.addEventListener('input', render); f.addEventListener('change', render); });
    return el;
  }
  function paint() { var box = $('#people'); box.innerHTML = ''; st.items.forEach(function (p, i) { box.appendChild(itemRow(p, i)); }); }
  function current() { collect(); return R.batch(st); }
  function isEmpty() { return st.items.every(function (p) { return ['date', 'n', 'r25', 'r12', 'r6', 'purpose'].every(function (k) { return !String(p[k] || '').trim(); }); }); }
  function stat(label, v) { return '<div class="stat"><span>' + label + '</span><strong>' + fmt(v / 100, 2) + ' kr</strong></div>'; }
  function kr(o) { return fmt(o / 100, 2); }
  function typeName(r) { return L()[r.type]; }

  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    $$('#people .person').forEach(function (e) { e.classList.remove('bad'); $$('input', e).forEach(function (x) { x.classList.remove('bad'); }); $('.res', e).textContent = ''; });
    persist();
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    var r = current(), rows = $$('#people .person');
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      r.bad.forEach(function (i) { var e = rows[i]; if (!e) return; r.rows[i].errors.forEach(function (k) { var f = $('[data-k=' + k + ']', e); if (f) f.classList.add('bad'); }); });
      return;
    }
    r.rows.forEach(function (x, i) { if (rows[i]) $('.res', rows[i]).textContent = t.dedVat + ' ' + kr(x.dedVat) + ' kr (' + t.how[x.method] + ') · ' + t.dedCost + ' ' + kr(x.dedCost) + ' kr'; });
    res.hidden = false; status.textContent = t.statusOk(r.totals.n); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.orgnr ? st.company.orgnr + ' · ' : '') + t.meta(r);
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(r);
    $('#stats').innerHTML = stat(t.dedVat, r.totals.dedVat) + stat(t.dedCost, r.totals.dedCost) + stat(t.nonDed, r.totals.nonDed) + stat(t.total, r.totals.total);
    var fl = []; r.rows.forEach(function (x, i) { x.warnings.forEach(function (w) { fl.push(t.flag[w].replace('%n', String(i + 1))); }); });
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + K.esc(x) + '</li>'; }).join('') + '</ul>' : '';
    $('#per-t thead').innerHTML = '<tr><th>' + t.date + '</th><th>' + t.purpose + '</th><th class="num">' + t.persons + '</th><th class="num">' + t.ex + '</th><th class="num">' + t.vat + '</th><th class="num">' + t.dedVat + '</th><th class="num">' + t.dedCost + '</th><th class="num">' + t.nonDed + '</th></tr>';
    $('#per-t tbody').innerHTML = r.rows.map(function (x) {
      return '<tr><td>' + x.date + '</td><td>' + K.esc(x.purpose || typeName(x)) + '<br><span class="muted small">' + typeName(x) + ' · ' + (x.kind === 'intern' ? t.intern : t.extern) + ' · ' + t.how[x.method] + '</span></td><td class="num">' + x.n + '</td><td class="num">' + kr(x.ex) + '</td><td class="num">' + kr(x.vat) + '</td><td class="num">' + kr(x.dedVat) + '</td><td class="num">' + kr(x.dedCost) + '</td><td class="num">' + kr(x.nonDed) + '</td></tr>';
    }).join('');
    var T2 = r.totals;
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td></td><td class="num">' + kr(T2.ex) + '</td><td class="num">' + kr(T2.vat) + '</td><td class="num">' + kr(T2.dedVat) + '</td><td class="num">' + kr(T2.dedCost) + '</td><td class="num">' + kr(T2.nonDed) + '</td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  function verTable(r, list) {
    var t = L();
    return '<div class="tbl"><table class="ver-t"><thead><tr><th>' + t.ver + '</th><th>' + t.date + '</th><th>' + t.konto + '</th><th>' + t.text + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      list.map(function (v) { return v.trans.map(function (x, j) { var a = x.amount / 100; return '<tr><td>' + (j ? '' : K.esc(v.serie) + v.nr) + '</td><td>' + (j ? '' : v.date) + '</td><td>' + x.konto + '</td><td>' + K.esc(r.accounts[x.konto] || '') + '</td><td class="num">' + (a > 0 ? fmt(a, 2) : '') + '</td><td class="num">' + (a < 0 ? fmt(-a, 2) : '') + '</td></tr>'; }).join(''); }).join('') + '</tbody></table></div>';
  }
  function verHtml(r) { var t = L(); return '<p>' + t.verLead(r.vouchers.length) + '</p>' + verTable(r, r.vouchers) + '<p class="hint">' + t.help + '</p>'; }
  function renderPaid(r) { r = r || current(); if (r.ok) $('#ver').innerHTML = verHtml(r); }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function span(r) { var d = r.rows.map(function (x) { return x.date; }).sort(); return { from: d[0], to: d[d.length - 1] }; }
  function base(r) { var s = span(r); return 'representation-' + s.from + '-' + s.to; }

  function downloadSie() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok || isEmpty()) return;
    var y = span(r).from.slice(0, 4);
    try {
      K.download(window.SIEW.toBytes({ fnamn: st.company.name || 'Företaget', orgnr: st.company.orgnr, program: 'Representation – moms och avdrag (drudley.github.io/verktyg)', gen: new Date().toISOString().slice(0, 10),
        rar: [{ start: y + '-01-01', end: y + '-12-31' }], accounts: r.accounts, vouchers: r.vouchers }), base(r) + '.se', 'text/plain');
      $('#dl-msg').textContent = t.sieOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  var TYPE_SV = { meal: 'Måltid', simple: 'Enklare förtäring', activity: 'Teater, golf, kringkostnad', gift: 'Representationsgåva' }, HOW_SV = { full: 'Hela momsen (under gränsen)', prop: 'Proportionering', schablon: 'Schablon', none: 'Ingen momsavdragsrätt' };
  async function downloadXlsx() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok || isEmpty()) return;
    var T2 = r.totals, s = span(r);
    var sum = [[bold('Representation – moms och avdrag')], ['Företag', st.company.name || ''], ['Organisationsnummer', st.company.orgnr || ''], ['Period', s.from + ' – ' + s.to], ['Antal tillfällen', T2.n], [],
      ['Kostnad exkl. moms, kr', money(T2.ex / 100)], ['Moms, kr', money(T2.vat / 100)], ['Betalt, kr', money(T2.total / 100)], ['Avdragsgill moms (fält 48), kr', money(T2.dedVat / 100)], ['Avdragsgill kostnad, kr', money(T2.dedCost / 100)], ['Ej avdragsgill kostnad inkl. moms, kr', money(T2.nonDed / 100)], [], [t.help]];
    var occ = [[bold('Datum'), bold('Syfte'), bold('Deltagare'), bold('Slag'), bold('Typ'), bold('Personer'), bold('Exkl. moms 25 %'), bold('Exkl. moms 12 %'), bold('Exkl. moms 6 %'), bold('Moms'), bold('Momsberäkning'), bold('Avdragsgill moms'), bold('Avdragsgill kostnad'), bold('Ej avdragsgill'), bold('Betalt')]];
    r.rows.forEach(function (x, i) { var o = st.items[i]; occ.push([x.date, x.purpose, x.people, x.kind === 'intern' ? 'Intern' : 'Extern', TYPE_SV[x.type], x.n, money(R.num(o.r25)), money(R.num(o.r12)), money(R.num(o.r6)), money(x.vat / 100), HOW_SV[x.method], money(x.dedVat / 100), money(x.dedCost / 100), money(x.nonDed / 100), money(x.total / 100)]); });
    var ver = [[bold('Ver'), bold('Datum'), bold('Konto'), bold('Benämning'), bold('Debet'), bold('Kredit')]];
    r.vouchers.forEach(function (v) { v.trans.forEach(function (x, j) { var a = x.amount / 100; ver.push([j ? '' : v.serie + v.nr, j ? '' : v.date, x.konto, r.accounts[x.konto] || '', a > 0 ? money(a) : '', a < 0 ? money(-a) : '']); }); });
    var src = [[bold('Källor')], ['Skatteverket: Avdrag för moms vid representation'], ['https://www.skatteverket.se/foretagochorganisationer/moms/kopavarorochtjanster/representation.4.15532c7b1442f256baec84b.html'], ['Skatteverkets ställningstagande dnr 8-125142-2026 (proportionering, schablon 46 kr och 33 kr)'], ['13 kap. 24–25 §§ ML (2023:200), 16 kap. 2 § IL (1999:1229)'], ['BAS kontoplan 2026: 6071, 6072, 7631, 7632, 2641']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammanfattning', rows: sum, widths: [36, 40] }, { name: 'Tillfällen', rows: occ, widths: [12, 36, 40, 8, 22, 9, 14, 14, 14, 12, 24, 14, 14, 14, 12] }, { name: 'Kontering', rows: ver, widths: [8, 12, 8, 40, 14, 14] }, { name: 'Källor', rows: src, widths: [110] }], { title: 'Representation' });
      K.download(buf, base(r) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    if (!PW.isUnlocked()) return; var r = current(), t = L(); if (!r.ok || isEmpty()) return;
    $('#print-root').innerHTML = r.rows.map(function (x, i) {
      var v = r.vouchers[i];
      return '<article class="card"><h1>' + t.recH + ' – ' + x.date + '</h1><p>' + K.esc(st.company.name || '') + (st.company.orgnr ? ' · ' + K.esc(st.company.orgnr) : '') + '</p>' +
        '<p><strong>' + t.purpose + ':</strong> ' + K.esc(x.purpose) + '<br><strong>' + t.people + ':</strong> ' + K.esc(x.people) + '<br><strong>' + t.n + ':</strong> ' + x.n + '<br><strong>' + t.type + ':</strong> ' + typeName(x) + ', ' + (x.kind === 'intern' ? t.intern : t.extern) + '</p>' +
        '<p><strong>' + t.recCalc + ':</strong> ' + t.ex + ' ' + kr(x.ex) + ' kr, ' + t.vat + ' ' + kr(x.vat) + ' kr. ' + t.dedVat + ' ' + kr(x.dedVat) + ' kr (' + t.how[x.method] + '). ' + t.dedCost + ' ' + kr(x.dedCost) + ' kr. ' + t.nonDed + ' ' + kr(x.nonDed) + ' kr.</p>' + verTable(r, [v]) + '</article>';
    }).join('');
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.items) && d.items.length) { st = d; return true; } return false; }

  var setLang = K.i18n(EN, function (l) { lang = l; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.items.push(emptyI()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = R.sample(); fillCompany(); paint(); render(); });
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
