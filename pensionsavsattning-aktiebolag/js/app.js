/* UI for pensionsavsättning i aktiebolag. All data stays in the browser. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, P = window.PENSION;
  var lang = 'sv';
  var SV = {};
  var EN = {
    h1: 'Pension contribution in a Swedish limited company – deduction room and special payroll tax',
    lead: 'Enter salaries for yourself and any employees – the tool calculates the <strong>deduction room under the main rule</strong> (35&nbsp;% of salary, at most 10 price base amounts), <strong>special payroll tax of 24.26&nbsp;%</strong> and what you can still contribute before year-end. Compare with extra salary or leaving the money in the company, and download a basis for the books and the corporate tax return.',
    'calc-h': 'The company and the contribution',
    sample: 'Skatteverket’s example',
    clear: 'Clear',
    'l-year': 'Income year',
    'l-co': 'Company name (optional)',
    'l-org': 'Corporate ID (optional)',
    'h-year': 'The 10 price-base-amount cap follows the income year you are calculating for, even if you use last year’s salary as the base.',
    'pe-h': 'Employees (including an owner who takes a salary)',
    add: 'Add a person',
    'h-salary': 'Salary means pensionable pay under the pension agreement. A company car is included only if the agreement says so. Dividends do not count.',
    saved: 'The figures are stored only in this browser. Nothing is sent away.',
    'paid-h': 'Comparison, bookkeeping and Excel pack',
    'paid-p': 'Compare the planned extra premium (the part that fits in the deduction room) with the same amount as salary or as profit left in the company. Get a <strong>bookkeeping suggestion</strong> with accounts, a basis for <strong>special payroll tax on INK2</strong> and an <strong>Excel file</strong> to keep with the annual accounts.',
    open: 'Show comparison and pack',
    'cmp-h': 'Comparison for the planned extra premium',
    'cmp-note': 'Company cost and the 20.6&nbsp;% corporate-tax effect. Salary is taxed as employment income for the recipient this year; the pension is taxed when it is paid out. The value of public pension rights, SGI and the 3:12 dividend room is not included – work out dividends in <a href="../gransbelopp-utdelning/">Gränsbelopp 3:12</a>.',
    'bok-h': 'Bookkeeping suggestion and INK2',
    print: 'Print pack',
    xlsx: 'Download Excel',
    'cta-h': 'Also thinking about salary or dividends?',
    'cta-p': 'When the contribution is settled you can work out the dividend allowance and the tax on dividends in <a href="../gransbelopp-utdelning/">Gränsbelopp 2026 – the 3:12 calculator</a>. Before closing the books: <a href="../kontrollbalansrakning/">Kontrollbalansräkning from a SIE file</a> shows whether half the share capital has been used up.<span data-needs="semesterloneskuld"> If the company has employees, <a href="../semesterloneskuld/">Holiday pay liability at year-end</a> works out the liability and employer contributions with a ready journal entry.</span>',
    'pw-h': 'Comparison, bookkeeping and Excel pack',
    'pw-p': 'Unlock the comparison of pension, salary and profit left in the company, the bookkeeping suggestion, the INK2 basis and the Excel file. Deduction room and special payroll tax per person are always free.',
    'ph-name': 'Name (optional)',
    'l-sy': 'Salary this year, SEK',
    'l-sp': 'Salary last year, SEK',
    'l-paid': 'Premiums already paid this year, SEK',
    'l-plan': 'Planned extra premium, SEK',
    remove: 'Remove'
  };

  function emptyPerson() { return { name: '', salaryYear: '', salaryPrev: '', paid: '', planned: '' }; }
  var st = { year: 2026, company: '', orgnr: '', people: [emptyPerson()] };

  function L() {
    var t = {
      sv: {
        result: 'Resultat',
        person: 'Person',
        salary: 'Vald lön',
        room: 'Avdragsutrymme',
        paid: 'Redan betalt',
        plan: 'Planerat extra',
        rem: 'Kvar att sätta av',
        slp: 'Särskild löneskatt',
        cost: 'Bolagets kostnad',
        cap: 'Tak 10 prisbasbelopp',
        pbb: 'Prisbasbelopp',
        ok: function (c) { return 'Avdragsutrymme ' + P.fmt(c.room) + ' kr. Kvar att sätta av ' + P.fmt(c.remaining) + ' kr.'; },
        warn: function (c) { return 'Avdragsutrymme ' + P.fmt(c.room) + ' kr, men ' + P.fmt(c.excess) + ' kr av premien ryms inte och ger inget avdrag.'; },
        err: 'Kontrollera beloppen – negativa tal och ogiltiga år kan inte räknas.',
        flag: {
          'no-salary': 'Utan pensionsgrundande lön finns inget avdragsutrymme. Utdelning räknas inte.',
          'pbb-cap': '35 % av lönen kapades av taket på 10 prisbasbelopp.',
          'used-prev': 'Föregående års lön ger ett större utrymme och används som underlag.',
          'paid-over': 'Redan betalda premier överstiger avdragsutrymmet för minst en person.',
          'excess': 'En del av premien överstiger utrymmet. Särskild löneskatt tas ändå ut på hela premien, men den överskjutande delen är inte avdragsgill.'
        },
        usedYear: 'årets lön',
        usedPrev: 'föregående års lön',
        unnamed: 'Person',
        cmpIntro: function (n) { return 'Jämförelsen gäller ' + P.fmt(n) + ' kr – den del av den planerade extra premien som ryms i avdragsutrymmet.'; },
        cmpNone: 'Ingen planerad extra premie ryms i utrymmet, så det finns inget att jämföra.',
        colAlt: 'Alternativ',
        colOut: 'Utbetalning / avsättning',
        colExtra: 'Avgift eller skatt utöver beloppet',
        colCost: 'Bolagets kostnad',
        colSave: 'Minskad bolagsskatt (20,6 %)',
        colNet: 'Netto för bolaget efter bolagsskatt',
        altP: 'Tjänstepension',
        altS: 'Samma belopp som lön',
        altV: 'Kvar som vinst i bolaget',
        slpOn: 'Särskild löneskatt 24,26 %',
        agOn: 'Arbetsgivaravgift 31,42 %',
        corpOn: 'Bolagsskatt 20,6 %',
        leftIn: function (n) { return P.fmt(n) + ' kr lämnas i bolaget'; },
        bokLead: 'Exempel på kontering. Anpassa kontona efter bolagets kontoplan. Särskild löneskatt redovisas som underlag på sidan 1 i INK2 och debiteras på slutskattebeskedet.',
        konto: 'Konto',
        debit: 'Debet',
        kredit: 'Kredit',
        text: 'Text',
        prem: 'Pensionspremier, tjänstepension',
        slpAcc: 'Särskild löneskatt på pensionskostnader',
        bank: 'Bank eller försäkringsskuld',
        slpSkuld: 'Skuld särskild löneskatt',
        ink2: function (u, s) { return 'Underlag till INK2, sidan 1: särskild löneskatt på pensionskostnader, underlag ' + P.fmt(u) + ' kr, skatt ' + P.fmt(s) + ' kr.'; },
        help: 'Hjälpmedel, inte skatterådgivning.',
        xlsxOk: 'Excel-filen är nedladdad.',
        xlsxFail: 'Kunde inte skapa Excel-filen.',
        printTitle: 'Pensionsavsättning – underlag',
        statusOk: function (n) { return n + (n === 1 ? ' person räknad.' : ' personer räknade.'); },
        statusErr: 'Ett eller flera belopp kunde inte tolkas.'
      },
      en: {
        result: 'Result',
        person: 'Person',
        salary: 'Salary used',
        room: 'Deduction room',
        paid: 'Already paid',
        plan: 'Planned extra',
        rem: 'Room left',
        slp: 'Special payroll tax',
        cost: 'Company cost',
        cap: 'Cap of 10 price base amounts',
        pbb: 'Price base amount',
        ok: function (c) { return 'Deduction room ' + P.fmt(c.room) + ' kr. Room left ' + P.fmt(c.remaining) + ' kr.'; },
        warn: function (c) { return 'Deduction room ' + P.fmt(c.room) + ' kr, but ' + P.fmt(c.excess) + ' kr of the premium does not fit and is not deductible.'; },
        err: 'Check the amounts – negative numbers and unknown years cannot be calculated.',
        flag: {
          'no-salary': 'With no pensionable salary there is no deduction room. Dividends do not count.',
          'pbb-cap': '35 % of salary was capped at 10 price base amounts.',
          'used-prev': 'Last year’s salary gives a larger room and is used as the base.',
          'paid-over': 'Premiums already paid exceed the deduction room for at least one person.',
          'excess': 'Part of the premium exceeds the room. Special payroll tax is still charged on the whole premium, but the excess is not deductible.'
        },
        usedYear: 'this year’s salary',
        usedPrev: 'last year’s salary',
        unnamed: 'Person',
        cmpIntro: function (n) { return 'The comparison uses ' + P.fmt(n) + ' kr – the part of the planned extra premium that fits in the deduction room.'; },
        cmpNone: 'No planned extra premium fits in the room, so there is nothing to compare.',
        colAlt: 'Option',
        colOut: 'Payment / contribution',
        colExtra: 'Charge on top of the amount',
        colCost: 'Company cost',
        colSave: 'Corporate tax saved (20.6 %)',
        colNet: 'Net company cash after corporate tax',
        altP: 'Occupational pension',
        altS: 'The same amount as salary',
        altV: 'Left as profit in the company',
        slpOn: 'Special payroll tax 24.26 %',
        agOn: 'Employer contributions 31.42 %',
        corpOn: 'Corporate tax 20.6 %',
        leftIn: function (n) { return P.fmt(n) + ' kr is left in the company'; },
        bokLead: 'Example postings. Adjust the accounts to the company’s chart of accounts. Special payroll tax is reported as a base on page 1 of INK2 and charged on the final tax statement.',
        konto: 'Account',
        debit: 'Debit',
        kredit: 'Credit',
        text: 'Text',
        prem: 'Pension premiums, occupational pension',
        slpAcc: 'Special payroll tax on pension costs',
        bank: 'Bank or insurance liability',
        slpSkuld: 'Special payroll tax payable',
        ink2: function (u, s) { return 'INK2, page 1: special payroll tax on pension costs, base ' + P.fmt(u) + ' kr, tax ' + P.fmt(s) + ' kr.'; },
        help: 'A helper, not tax advice.',
        xlsxOk: 'The Excel file has been downloaded.',
        xlsxFail: 'Could not create the Excel file.',
        printTitle: 'Pension contribution – pack',
        statusOk: function (n) { return n + (n === 1 ? ' person calculated.' : ' people calculated.'); },
        statusErr: 'One or more amounts could not be parsed.'
      }
    };
    return t[lang] || t.sv;
  }

  function collect() {
    st.year = +$('#f-year').value;
    st.company = $('#f-co').value.trim();
    st.orgnr = $('#f-org').value.trim();
    st.people = $$('#people .person').map(function (row) {
      return {
        name: $('[data-k=name]', row).value,
        salaryYear: $('[data-k=salaryYear]', row).value,
        salaryPrev: $('[data-k=salaryPrev]', row).value,
        paid: $('[data-k=paid]', row).value,
        planned: $('[data-k=planned]', row).value
      };
    });
    if (!st.people.length) st.people = [emptyPerson()];
  }

  function personRow(p, i) {
    var E = lang === 'en' ? EN : {};
    var lab = function (k, fallback) { return E[k] || fallback; };
    var el = document.createElement('div');
    el.className = 'person';
    el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + lab('ph-name', 'Namn (valfritt)') + '</span>' +
      '<input type="text" data-k="name" placeholder="' + lab('ph-name', 'Namn (valfritt)') + '" autocomplete="name"></label>' +
      '<button class="del" type="button" title="' + lab('remove', 'Ta bort') + '" aria-label="' + lab('remove', 'Ta bort') + '">×</button></div>' +
      '<div class="grid">' +
      '<label><span>' + lab('l-sy', 'Lön i år, kr') + '</span><input type="text" data-k="salaryYear" inputmode="decimal" placeholder="0"></label>' +
      '<label><span>' + lab('l-sp', 'Lön föregående år, kr') + '</span><input type="text" data-k="salaryPrev" inputmode="decimal" placeholder="0"></label>' +
      '<label><span>' + lab('l-paid', 'Redan betald premie i år, kr') + '</span><input type="text" data-k="paid" inputmode="decimal" placeholder="0"></label>' +
      '<label><span>' + lab('l-plan', 'Planerad extra premie, kr') + '</span><input type="text" data-k="planned" inputmode="decimal" placeholder="0"></label>' +
      '</div>';
    $('[data-k=name]', el).value = p.name || '';
    $('[data-k=salaryYear]', el).value = p.salaryYear || '';
    $('[data-k=salaryPrev]', el).value = p.salaryPrev || '';
    $('[data-k=paid]', el).value = p.paid || '';
    $('[data-k=planned]', el).value = p.planned || '';
    $('.del', el).addEventListener('click', function () {
      collect();
      st.people.splice(+el.dataset.i, 1);
      if (!st.people.length) st.people = [emptyPerson()];
      paintPeople(); render();
    });
    $$('input', el).forEach(function (inp) { inp.addEventListener('input', function () { render(); }); });
    return el;
  }

  function paintPeople() {
    var box = $('#people');
    box.innerHTML = '';
    st.people.forEach(function (p, i) { box.appendChild(personRow(p, i)); });
  }

  function current() {
    collect();
    return P.company(st.people, st.year, { company: st.company, orgnr: st.orgnr });
  }

  function uniqueFlags(list) {
    var seen = {}, out = [];
    (list || []).forEach(function (k) { if (!seen[k]) { seen[k] = 1; out.push(k); } });
    return out;
  }

  function stat(label, value) {
    return '<div class="stat"><span>' + label + '</span><strong>' + P.fmt(value) + ' kr</strong></div>';
  }

  function render() {
    var c = current(), t = L(), unlocked = PW.isUnlocked();
    var res = $('#result'), check = $('#check'), flags = $('#flags'), status = $('#status');
    $$('#calc input, #calc select').forEach(function (el) { el.classList.remove('bad'); });
    if (!c.ok) {
      res.hidden = true;
      status.textContent = t.statusErr;
      status.className = 'status err';
      $$('#people input[data-k]').forEach(function (el) {
        if (el.dataset.k === 'name') return;
        if (!isFinite(P.kr(el.value || 0)) || P.kr(el.value || 0) < 0 && el.value.trim()) el.classList.add('bad');
      });
      persist();
      return;
    }
    res.hidden = false;
    status.textContent = t.statusOk(c.n);
    status.className = 'status';
    $('#r-title').textContent = st.company || t.result;
    $('#r-meta').textContent = [st.orgnr, String(c.year), t.pbb + ' ' + P.fmt(c.info.pbb) + ' kr', t.cap + ' ' + P.fmt(c.info.cap) + ' kr'].filter(Boolean).join(' · ');
    check.className = 'check ' + (c.excess > 0 ? 'warn' : 'ok');
    check.textContent = c.excess > 0 ? t.warn(c) : t.ok(c);
    $('#stats').innerHTML = stat(t.room, c.room) + stat(t.rem, c.remaining) + stat(t.slp, c.slp) + stat(t.cost, c.companyCost);
    var fl = uniqueFlags(c.warnings);
    if (fl.length) {
      flags.hidden = false;
      flags.innerHTML = '<ul>' + fl.map(function (k) { return '<li>' + (t.flag[k] || k) + '</li>'; }).join('') + '</ul>';
    } else { flags.hidden = true; flags.innerHTML = ''; }

    var th = '<tr><th>' + t.person + '</th><th class="num">' + t.salary + '</th><th class="num">' + t.room + '</th><th class="num">' + t.paid + '</th><th class="num">' + t.plan + '</th><th class="num">' + t.rem + '</th><th class="num">' + t.slp + '</th></tr>';
    $('#per-t thead').innerHTML = th;
    $('#per-t tbody').innerHTML = c.people.map(function (r, i) {
      var nm = r.name || (t.unnamed + ' ' + (i + 1));
      var used = r.used === 'prev' ? t.usedPrev : t.usedYear;
      return '<tr><td>' + escapeHtml(nm) + ' <span class="hint">(' + used + ')</span></td>' +
        '<td class="num">' + P.fmt(r.usedSalary) + '</td>' +
        '<td class="num">' + P.fmt(r.room) + '</td>' +
        '<td class="num">' + P.fmt(r.paid) + '</td>' +
        '<td class="num">' + P.fmt(r.planned) + '</td>' +
        '<td class="num">' + P.fmt(r.remaining) + '</td>' +
        '<td class="num">' + P.fmt(r.slp) + '</td></tr>';
    }).join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + (lang === 'en' ? 'Total' : 'Summa') + '</td>' +
      '<td class="num"></td><td class="num">' + P.fmt(c.room) + '</td><td class="num">' + P.fmt(c.paid) + '</td>' +
      '<td class="num">' + P.fmt(c.planned) + '</td><td class="num">' + P.fmt(c.remaining) + '</td><td class="num">' + P.fmt(c.slp) + '</td></tr>';

    $('#paid-open').classList.toggle('locked', !unlocked);
    if (unlocked && !$('#paid-out').hidden) renderPaid(c);
    persist();
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function renderPaid(c) {
    c = c || current();
    var t = L(), cmp = c.compare, box = $('#cmp-t'), intro = $('#cmp-p');
    if (!cmp || !cmp.ok || cmp.amount <= 0) {
      intro.textContent = t.cmpNone;
      box.querySelector('thead').innerHTML = '';
      box.querySelector('tbody').innerHTML = '';
    } else {
      intro.textContent = t.cmpIntro(cmp.amount);
      box.querySelector('thead').innerHTML = '<tr><th>' + t.colAlt + '</th><th class="num">' + t.colOut + '</th><th>' + t.colExtra + '</th><th class="num">' + t.colCost + '</th><th class="num">' + t.colSave + '</th><th class="num">' + t.colNet + '</th></tr>';
      var row = function (alt, out, extra, cost, save, net) {
        return '<tr><td>' + alt + '</td><td class="num">' + P.fmt(out) + '</td><td>' + extra + '</td><td class="num">' + P.fmt(cost) + '</td><td class="num">' + P.fmt(save) + '</td><td class="num">' + P.fmt(net) + '</td></tr>';
      };
      box.querySelector('tbody').innerHTML =
        row(t.altP, cmp.amount, t.slpOn + ' (' + P.fmt(cmp.pension.slp) + ' kr)', cmp.pension.cost, cmp.pension.taxSave, cmp.pension.net) +
        row(t.altS, cmp.amount, t.agOn + ' (' + P.fmt(cmp.salary.ag) + ' kr)', cmp.salary.cost, cmp.salary.taxSave, cmp.salary.net) +
        row(t.altV, 0, t.corpOn + ' (' + P.fmt(cmp.profit.tax) + ' kr). ' + t.leftIn(cmp.profit.left), cmp.profit.tax, 0, cmp.profit.tax);
    }
    $('#bok').innerHTML = bokHtml(c, t);
  }

  function bokHtml(c, t) {
    var prem = c.totalPremium, slp = c.slp;
    return '<p>' + t.bokLead + '</p>' +
      '<div class="tbl"><table><thead><tr><th>' + t.konto + '</th><th>' + t.text + '</th><th class="num">' + t.debit + '</th><th class="num">' + t.kredit + '</th></tr></thead><tbody>' +
      (prem ? '<tr><td>7410</td><td>' + t.prem + '</td><td class="num">' + P.fmt(prem) + '</td><td class="num"></td></tr>' +
        '<tr><td>1940</td><td>' + t.bank + '</td><td class="num"></td><td class="num">' + P.fmt(prem) + '</td></tr>' : '') +
      (slp ? '<tr><td>7530</td><td>' + t.slpAcc + '</td><td class="num">' + P.fmt(slp) + '</td><td class="num"></td></tr>' +
        '<tr><td>2514</td><td>' + t.slpSkuld + '</td><td class="num"></td><td class="num">' + P.fmt(slp) + '</td></tr>' : '') +
      '</tbody></table></div>' +
      '<p><strong>' + t.ink2(prem, slp) + '</strong></p>' +
      '<p class="hint">' + t.help + '</p>';
  }

  function openPaid() {
    if (!PW.isUnlocked()) return;
    $('#paid-out').hidden = false;
    renderPaid();
  }

  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }

  async function downloadXlsx() {
    if (!PW.isUnlocked()) return;
    var c = current(), t = L();
    if (!c.ok) return;
    var meta = c.meta || {};
    var sumRows = [
      [bold('Pensionsavsättning i aktiebolag – underlag')],
      ['Beskattningsår', c.year],
      ['Bolag', meta.company || ''],
      ['Organisationsnummer', meta.orgnr || ''],
      [],
      [bold('Sammanfattning')],
      ['Avdragsutrymme, kr', money(c.room)],
      ['Redan betalt, kr', money(c.paid)],
      ['Planerat extra, kr', money(c.planned)],
      ['Kvar att sätta av, kr', money(c.remaining)],
      ['Premier totalt, kr', money(c.totalPremium)],
      ['Avdragsgill premie, kr', money(c.deductible)],
      ['Premie över utrymmet, kr', money(c.excess)],
      ['Särskild löneskatt 24,26 %, kr', money(c.slp)],
      ['Bolagets kostnad, kr', money(c.companyCost)],
      ['Minskad bolagsskatt (20,6 % på avdragsgillt), kr', money(c.taxSave)],
      ['Prisbasbelopp, kr', money(c.info.pbb)],
      ['Tak 10 prisbasbelopp, kr', money(c.info.cap)],
      [],
      ['Hjälpmedel, inte skatterådgivning. Allt räknades i webbläsaren.']
    ];
    var perRows = [[bold(t.person), bold(t.salary), bold(t.room), bold(t.paid), bold(t.plan), bold(t.rem), bold(t.slp), bold(lang === 'en' ? 'Base' : 'Underlag')]];
    c.people.forEach(function (r, i) {
      perRows.push([r.name || (t.unnamed + ' ' + (i + 1)), money(r.usedSalary), money(r.room), money(r.paid), money(r.planned), money(r.remaining), money(r.slp), r.used === 'prev' ? t.usedPrev : t.usedYear]);
    });
    perRows.push([bold(lang === 'en' ? 'Total' : 'Summa'), '', money(c.room), money(c.paid), money(c.planned), money(c.remaining), money(c.slp), '']);
    var cmp = c.compare, cmpRows = [[bold(t.colAlt), bold(t.colOut), bold(t.colExtra), bold(t.colCost), bold(t.colSave), bold(t.colNet)]];
    if (cmp && cmp.ok && cmp.amount > 0) {
      cmpRows.push([t.altP, money(cmp.amount), t.slpOn, money(cmp.pension.cost), money(cmp.pension.taxSave), money(cmp.pension.net)]);
      cmpRows.push([t.altS, money(cmp.amount), t.agOn, money(cmp.salary.cost), money(cmp.salary.taxSave), money(cmp.salary.net)]);
      cmpRows.push([t.altV, money(0), t.corpOn, money(cmp.profit.tax), money(0), money(cmp.profit.tax)]);
      cmpRows.push([], [t.cmpIntro(cmp.amount)]);
    } else cmpRows.push([t.cmpNone]);
    var bokRows = [[bold(t.konto), bold(t.text), bold(t.debit), bold(t.kredit)]];
    if (c.totalPremium) {
      bokRows.push(['7410', t.prem, money(c.totalPremium), '']);
      bokRows.push(['1940', t.bank, '', money(c.totalPremium)]);
    }
    if (c.slp) {
      bokRows.push(['7530', t.slpAcc, money(c.slp), '']);
      bokRows.push(['2514', t.slpSkuld, '', money(c.slp)]);
    }
    bokRows.push([], [t.ink2(c.totalPremium, c.slp)], [t.bokLead], [t.help]);
    var srcRows = [
      [bold(lang === 'en' ? 'Sources' : 'Källor')],
      ['Skatteverket: Pensionskostnader för anställda'],
      ['https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/aktiebolag/pensionskostnader.4.6e8a1495181dad54084429.html'],
      ['Skatteverket: Särskild löneskatt'],
      ['https://www.skatteverket.se/foretag/drivaforetag/foretagsformer/aktiebolag/sarskildloneskatt.4.6e8a1495181dad540843a8.html'],
      ['Skatteverket: Belopp och procent, inkomstår 2026'],
      ['https://www.skatteverket.se/foretag/skatterochavdrag/beloppochprocent/2026.106.1522bf3f19aea8075ba3294.html']
    ];
    try {
      var buf = await window.XLSXW.build([
        { name: lang === 'en' ? 'Summary' : 'Sammanfattning', rows: sumRows, widths: [56, 22] },
        { name: lang === 'en' ? 'Per person' : 'Per person', rows: perRows, widths: [28, 14, 16, 14, 16, 16, 16, 22] },
        { name: lang === 'en' ? 'Comparison' : 'Jämförelse', rows: cmpRows, widths: [36, 16, 36, 18, 22, 22] },
        { name: lang === 'en' ? 'Bookkeeping' : 'Bokföring', rows: bokRows, widths: [12, 56, 16, 16] },
        { name: lang === 'en' ? 'Sources' : 'Källor', rows: srcRows, widths: [90] }
      ]);
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pensionsavsattning-' + c.year + '.xlsx';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
      $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) {
      $('#dl-msg').textContent = t.xlsxFail;
    }
  }

  function printPack() {
    if (!PW.isUnlocked()) return;
    var c = current(), t = L();
    if (!c.ok) return;
    var title = (st.company ? escapeHtml(st.company) + ' – ' : '') + t.printTitle + ' ' + c.year;
    var flags = uniqueFlags(c.warnings).map(function (k) { return '<li>' + (t.flag[k] || k) + '</li>'; }).join('');
    $('#print-root').innerHTML = '<article class="card"><h1>' + title + '</h1>' +
      '<p>' + escapeHtml([st.orgnr, t.pbb + ' ' + P.fmt(c.info.pbb) + ' kr', t.cap + ' ' + P.fmt(c.info.cap) + ' kr'].filter(Boolean).join(' · ')) + '</p>' +
      '<p><strong>' + (c.excess > 0 ? t.warn(c) : t.ok(c)) + '</strong></p>' +
      (flags ? '<ul>' + flags + '</ul>' : '') +
      document.getElementById('per-t').outerHTML +
      ($('#cmp-t tbody').innerHTML ? '<h2>' + (lang === 'en' ? 'Comparison' : 'Jämförelse') + '</h2><p>' + escapeHtml($('#cmp-p').textContent) + '</p>' + document.getElementById('cmp-t').outerHTML : '') +
      $('#bok').innerHTML +
      '<p class="hint">' + t.help + '</p></article>';
    // cmp-h is not on t in the same way in EN object for print - use heading from DOM
    document.body.classList.add('printing');
    window.print();
    document.body.classList.remove('printing');
  }

  function persist() {
    try { localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({ year: st.year, company: st.company, orgnr: st.orgnr, people: st.people })); } catch (e) {}
  }
  function restore() {
    try {
      var raw = localStorage.getItem(CFG.SAVE_KEY); if (!raw) return false;
      var d = JSON.parse(raw);
      if (d && Array.isArray(d.people) && d.people.length) {
        st.year = d.year || 2026; st.company = d.company || ''; st.orgnr = d.orgnr || ''; st.people = d.people;
        return true;
      }
    } catch (e) {}
    return false;
  }

  function fillForm() {
    $('#f-year').value = String(st.year);
    $('#f-co').value = st.company;
    $('#f-org').value = st.orgnr;
    paintPeople();
  }

  function setLang(l) {
    lang = l;
    var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    paintPeople();
    render();
  }

  document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });

  $('#add').addEventListener('click', function () { collect(); st.people.push(emptyPerson()); paintPeople(); render(); });
  $('#sample').addEventListener('click', function () {
    var s = P.sampleCompany();
    st.year = s.year; st.company = s.meta.company; st.orgnr = s.meta.orgnr;
    st.people = s.people.map(function (p) {
      return { name: p.name, salaryYear: String(p.salaryYear), salaryPrev: String(p.salaryPrev), paid: String(p.paid), planned: String(p.planned) };
    });
    fillForm(); render();
  });
  $('#clear').addEventListener('click', function () {
    st = { year: 2026, company: '', orgnr: '', people: [emptyPerson()] };
    try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) {}
    fillForm(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = '';
  });
  $('#f-year').addEventListener('change', render);
  $('#f-co').addEventListener('input', render);
  $('#f-org').addEventListener('input', render);
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');

  if (restore()) fillForm(); else paintPeople();
  render();
})();
