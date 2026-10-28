(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var K = window.K10, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, lang = 'sv', lastGb = null, lastOpt = null;
  var nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 });
  var kr = function (n) { return nf.format(Math.round(n)) + ' kr'; };
  var pctf = function (x, d) { return (x * 100).toLocaleString('sv-SE', { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + ' %'; };
  var FIELDS = ['share', 'otherShares', 'wages', 'ownSalary', 'spouseShare', 'cost', 'saved', 'dividend', 'otherIncome', 'kommunal', 'avgift', 'birthYear', 'pool', 'otherWages'];
  var CHECKS = ['ownedAtStart', 'spouse'];
  var DEFAULTS = {};

  var EN = {
    h1: 'Gränsbelopp 2026 – calculate your dividend allowance under the new Swedish 3:12 rules',
    lead: 'Enter a few facts about your closely held company (fåmansföretag) and get the 2026 gränsbelopp, the tax on your dividend and the saved allowance carried to next year – step by step, with the same parts as form K10. <strong>No account, nothing is stored on a server.</strong>',
    pill: 'Updated for income year 2026 (2027 tax return)', sample: 'Try Skatteverket\'s example',
    'f-h': 'Your details', 'l-owned': 'I owned the shares at the start of 2026 (1 January)', 'l-share': 'Your ownership share (%)', 'h-share': 'Share of the company at the start of the year.',
    'l-other': 'Your share in other closely held companies (sum of %)', 'h-other': 'You get at most one grundbelopp in total. 0 if you only have this company.',
    'f-lon': 'Wages 2025 (previous year)', 'l-wages': 'Wage base: cash wages in the company and subsidiaries (SEK)', 'h-wages': 'All employees\' gross cash wages incl. your own. Not benefits or pension.',
    'l-own': 'Highest cash salary to you or a related person (SEK)', 'h-own': 'Cap: wage-based allowance ≤ 50 × this salary.', 'l-spouse': 'My spouse also owns shares in the company', 'l-spshare': 'Spouse\'s ownership share (%)',
    'f-kap': 'Capital and saved allowance', 'l-cost': 'Acquisition cost of your shares (omkostnadsbelopp, SEK)', 'h-cost': 'What you paid for the shares plus unconditional shareholder contributions. Interest only on the part above SEK 100,000.',
    'l-saved': 'Saved allowance from your 2025 K10 (SEK)', 'h-saved': 'Shown on last year\'s K10. No longer indexed with interest.', 'l-div': 'Planned dividend to you in 2026 (SEK)',
    'f-tax': 'Tax on dividends above the allowance (optional)', 'l-income': 'Your other earned income 2026, e.g. salary (SEK)', 'l-kommunal': 'Municipal tax (%)', 'h-kommunal': 'Municipality + region. National average 2026: 32.38 %.',
    'l-avgift': 'Burial fee and church fee (%)', 'h-avgift': 'Burial fee 0.292 % (Stockholm 0.070 %), plus church fee if a member.', 'l-born': 'Year of birth', reset: 'Clear',
    'r-h': 'Your gränsbelopp 2026', 'r-div': 'Tax on the dividend', print: 'Print / save as PDF',
    'o-h': 'Salary or dividend 2026 – find the best split', 'o-p': 'Enter how much money the company has to split between salary to you and dividends. The tool tests every salary level with Skatteverket\'s exact 2026 tax rules (basic allowance, earned income tax credit, state tax, employer contributions, 20.6 % corporate tax) and shows which salary leaves you the most after tax, and how the salary affects next year\'s wage-based allowance.',
    'l-pool': 'Amount to split, before your salary, employer contributions and corporate tax (SEK)', 'l-ow': 'Other employees\' cash wages 2026 (SEK)', 'h-ow': 'Used to show the wage-based allowance for 2027.',
    'o-uses': 'Uses the allowance, municipal tax and year of birth above.', optimize: 'Find the best salary and dividend',
    'c-sal': 'Salary/year (per month)', 'c-ag': 'Employer contrib.', 'c-ctax': 'Corporate tax', 'c-div': 'Dividend', 'c-tax': 'Your tax', 'c-net': 'Net to you', 'c-next': 'Wage-based allowance 2027',
    'o-assume': 'Simplified one-year model: everything that is not salary is paid out as a dividend the same year, you receive the whole dividend and the company has no other costs. The value of pension rights, sickness and parental benefit that salary gives is not included in the net. Salary earns state pension rights; dividends do not.',
    'pw-h': 'Salary or dividend – optimisation', 'pw-p': 'Unlock the optimiser: best salary and dividend for 2026 with exact tax rules, comparison table, chart and effect on next year\'s allowance.'
  };
  var SV = {};
  var T = {
    sv: { grund: 'Grundbelopp', grundF: function (r) { return pctf(r.share, 2) + ' × 322 400' + (r.notes.indexOf('grund-capped') >= 0 ? ', fördelat på alla dina bolag' : ''); },
      lbu: 'Lönebaserat utrymme', lbuF: function (r) { return '(' + nf.format(r.wageShare) + ' − 644 800) × 50 %' + (r.notes.indexOf('lbu-capped') >= 0 ? ', begränsat till 50 × lön' : ''); },
      ranta: 'Ränta på omkostnadsbelopp', rantaF: function (r) { return r.rantaBase ? nf.format(r.rantaBase) + ' × 11,55 %' : 'omkostnadsbelopp under 100 000 kr'; },
      saved: 'Sparat utdelningsutrymme', savedF: 'utan uppräkning', arets: 'Årets gränsbelopp', total: 'Gränsbelopp att använda 2026',
      notes: { 'not-owned': 'Du ägde inte aktierna vid årets ingång, så du får inget årets gränsbelopp för 2026 – bara ditt sparade utdelningsutrymme.',
        'grund-capped': 'Dina ägarandelar i alla fåmansföretag är tillsammans över 100 %, så grundbeloppet fördelas proportionellt (högst ett grundbelopp totalt).',
        'lbu-capped': 'Lönebaserat utrymme är begränsat till 50 gånger din eller en närståendes kontanta lön 2025.',
        'lbu-below-deduction': 'Din andel av löneunderlaget är inte större än 644 800 kr, så det lönebaserade utrymmet blir 0 kr.',
        'lbu-no-own-salary': 'Varken du eller en närstående tog ut kontant lön 2025, så det lönebaserade utrymmet blir 0 kr.' },
      kap: 'Inom gränsbeloppet (20 %)', tj: 'Över gränsbeloppet – beskattas som lön', tak: 'Över takbeloppet 7 506 000 kr (30 %)', sum: 'Total skatt', net: 'Kvar efter skatt', eff: 'Effektiv skatt',
      marg: function (m) { return 'marginalskatt ' + pctf(m); }, noDiv: 'Fyll i en planerad utdelning för att se skatten.',
      savedNext: function (s) { return 'Sparat utdelningsutrymme till 2027: ' + kr(s) + ' (räknas inte upp). Grundbeloppet för inkomstår 2027 blir 333 600 kr och löneavdraget 667 200 kr.'; },
      bestSal: 'Bästa lön', bestDiv: 'Utdelning', bestNet: 'Netto till dig', bestTax: 'Total skatt och avgifter', perMonth: function (m) { return nf.format(m) + ' kr/mån'; },
      vsZero: function (d) { return d > 0 ? kr(d) + ' mer än bara utdelning' : 'Lika bra som bara utdelning'; }, vsMax: function (d) { return d > 0 ? kr(d) + ' mer än bara lön' : 'Lika bra som bara lön'; },
      chartX: 'Lön per år', chartY: 'Netto till dig', noPool: 'Fyll i ett belopp att fördela.', bad: 'Kontrollera fältet' },
    en: { grund: 'Basic amount (grundbelopp)', grundF: function (r) { return pctf(r.share, 2) + ' × 322,400' + (r.notes.indexOf('grund-capped') >= 0 ? ', split over all your companies' : ''); },
      lbu: 'Wage-based allowance', lbuF: function (r) { return '(' + nf.format(r.wageShare) + ' − 644,800) × 50 %' + (r.notes.indexOf('lbu-capped') >= 0 ? ', capped at 50 × salary' : ''); },
      ranta: 'Interest on acquisition cost', rantaF: function (r) { return r.rantaBase ? nf.format(r.rantaBase) + ' × 11.55 %' : 'acquisition cost below SEK 100,000'; },
      saved: 'Saved allowance', savedF: 'not indexed', arets: 'This year\'s allowance', total: 'Allowance to use in 2026',
      notes: { 'not-owned': 'You did not own the shares at the start of the year, so you get no allowance for 2026 – only your saved allowance.',
        'grund-capped': 'Your shares in all closely held companies add up to more than 100 %, so the basic amount is split proportionally (at most one in total).',
        'lbu-capped': 'The wage-based allowance is capped at 50 times your or a related person\'s 2025 cash salary.',
        'lbu-below-deduction': 'Your share of the wage base does not exceed SEK 644,800, so the wage-based allowance is SEK 0.',
        'lbu-no-own-salary': 'Neither you nor a related person took a cash salary in 2025, so the wage-based allowance is SEK 0.' },
      kap: 'Within the allowance (20 %)', tj: 'Above the allowance – taxed as salary', tak: 'Above the ceiling SEK 7,506,000 (30 %)', sum: 'Total tax', net: 'Left after tax', eff: 'Effective tax',
      marg: function (m) { return 'marginal rate ' + pctf(m); }, noDiv: 'Enter a planned dividend to see the tax.',
      savedNext: function (s) { return 'Saved allowance carried to 2027: ' + kr(s) + ' (not indexed). The basic amount for income year 2027 is SEK 333,600 and the wage deduction SEK 667,200.'; },
      bestSal: 'Best salary', bestDiv: 'Dividend', bestNet: 'Net to you', bestTax: 'Total tax and contributions', perMonth: function (m) { return nf.format(m) + ' SEK/month'; },
      vsZero: function (d) { return d > 0 ? kr(d) + ' more than dividend only' : 'Same as dividend only'; }, vsMax: function (d) { return d > 0 ? kr(d) + ' more than salary only' : 'Same as salary only'; },
      chartX: 'Salary per year', chartY: 'Net to you', noPool: 'Enter an amount to split.', bad: 'Check the field' }
  };
  function t(k) { return T[lang][k]; }

  // ---------- inputs ----------
  FIELDS.forEach(function (f) { DEFAULTS[f] = $('#' + f).value; }); CHECKS.forEach(function (f) { DEFAULTS[f] = $('#' + f).checked; });
  function read() {
    var v = {}; FIELDS.forEach(function (f) { v[f] = $('#' + f).value; }); CHECKS.forEach(function (f) { v[f] = $('#' + f).checked; }); return v;
  }
  function write(v) {
    FIELDS.forEach(function (f) { if (v[f] != null) $('#' + f).value = v[f]; }); CHECKS.forEach(function (f) { if (v[f] != null) $('#' + f).checked = !!v[f]; });
    $('#spouseRow').hidden = !$('#spouse').checked;
  }
  function save() { try { localStorage.setItem(CFG.SETTINGS_KEY, JSON.stringify(read())); } catch (e) {} }
  function load() { try { var s = JSON.parse(localStorage.getItem(CFG.SETTINGS_KEY) || 'null'); if (s && typeof s === 'object') write(s); } catch (e) {} }
  function valid(el) {
    var s = el.value.replace(/\s|\u00a0/g, ''); var ok = s === '' || /^-?\d+([.,]\d+)?$/.test(s);
    el.classList.toggle('input-err', !ok); el.title = ok ? '' : t('bad'); return ok;
  }
  var rate = function (s) { return String(s).trim() === '' ? null : K.num(s) / 100; };

  // ---------- render helpers ----------
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function row(tb, label, formula, amount, cls) {
    var tr = el('tr', cls), a = el('td'); a.appendChild(document.createTextNode(label));
    if (formula) { a.appendChild(document.createElement('br')); a.appendChild(el('span', 'hint', formula)); }
    tr.appendChild(a); tr.appendChild(el('td', 'num', amount)); tb.appendChild(tr);
  }

  function calc() {
    var v = read();
    var r = K.gransbelopp({ ownedAtStart: v.ownedAtStart, share: v.share, otherShares: v.otherShares, wages: v.wages, ownSalary: v.ownSalary, spouse: v.spouse, spouseShare: v.spouseShare, cost: v.cost, saved: v.saved });
    lastGb = r;
    $('#r-total').textContent = kr(r.total);
    var tb = $('#r-calc tbody'); tb.textContent = '';
    if (r.owned) {
      row(tb, t('grund'), t('grundF')(r), kr(r.grund));
      row(tb, t('lbu'), t('lbuF')(r), kr(r.lbu));
      row(tb, t('ranta'), t('rantaF')(r), kr(r.ranta));
      row(tb, t('arets'), null, kr(r.arets), 'sum');
    }
    row(tb, t('saved'), t('savedF'), kr(r.saved));
    row(tb, t('total'), null, kr(r.total), 'sum');
    var nl = $('#r-notes'); nl.textContent = ''; r.notes.forEach(function (n) { nl.appendChild(el('li', null, t('notes')[n])); });
    var ctx = { otherIncome: v.otherIncome, kommunal: rate(v.kommunal), avgift: rate(v.avgift), birthYear: K.num(v.birthYear) || 1985 };
    var d = K.dividendTax(v.dividend, r.total, ctx), tt = $('#r-tax tbody'); tt.textContent = '';
    if (d.dividend > 0) {
      row(tt, t('kap'), nf.format(d.kapital) + ' × 2/3 × 30 %', kr(d.taxKapital));
      if (d.tjanst) row(tt, t('tj'), nf.format(d.tjanst) + ' kr · ' + t('marg')(d.tjanstMarginal), kr(d.taxTjanst));
      if (d.overTak) row(tt, t('tak'), nf.format(d.overTak) + ' × 30 %', kr(d.taxOverTak));
      row(tt, t('sum'), t('eff') + ' ' + pctf(d.effective), kr(d.total), 'sum');
      row(tt, t('net'), null, kr(d.net));
    } else row(tt, t('noDiv'), null, '');
    $('#r-saved').textContent = t('savedNext')(d.savedNext);
    var b = $('#optimize'); b.classList.toggle('locked', !PW.isUnlocked());
    if (lastOpt) runOpt();
  }

  // ---------- paid: optimiser ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs, text) { var e = document.createElementNS(SVGNS, tag); for (var k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
  function chart(o) {
    var c = $('#o-chart'); c.textContent = '';
    var W = 720, H = 240, L = 70, R = 12, Tm = 12, B = 34, rows = o.rows;
    if (rows.length < 2) return;
    var xs = rows[rows.length - 1].salary || 1, ys = rows.map(function (r) { return r.net; }), yMin = Math.min.apply(null, ys), yMax = Math.max.apply(null, ys);
    var pad = (yMax - yMin) * 0.08 || 1000; yMin -= pad; yMax += pad;
    var X = function (s) { return L + (W - L - R) * s / xs; }, Yp = function (n) { return Tm + (H - Tm - B) * (1 - (n - yMin) / (yMax - yMin)); };
    c.appendChild(svg('line', { x1: L, y1: H - B, x2: W - R, y2: H - B, stroke: '#94a3b8' }));
    c.appendChild(svg('line', { x1: L, y1: Tm, x2: L, y2: H - B, stroke: '#94a3b8' }));
    for (var i = 0; i <= 4; i++) {
      var yv = yMin + (yMax - yMin) * i / 4, xv = xs * i / 4;
      c.appendChild(svg('text', { x: L - 6, y: Yp(yv) + 4, 'text-anchor': 'end' }, nf.format(Math.round(yv / 1000)) + ' k'));
      c.appendChild(svg('text', { x: X(xv), y: H - B + 16, 'text-anchor': 'middle' }, nf.format(Math.round(xv / 1000)) + ' k'));
    }
    c.appendChild(svg('text', { x: W - R, y: H - 4, 'text-anchor': 'end' }, t('chartX')));
    c.appendChild(svg('polyline', { points: rows.map(function (r) { return X(r.salary).toFixed(1) + ',' + Yp(r.net).toFixed(1); }).join(' '), fill: 'none', stroke: '#b45309', 'stroke-width': 2.5 }));
    c.appendChild(svg('line', { x1: X(o.best.salary), y1: Tm, x2: X(o.best.salary), y2: H - B, stroke: '#15803d', 'stroke-dasharray': '4 3' }));
    c.appendChild(svg('circle', { cx: X(o.best.salary), cy: Yp(o.best.net), r: 5, fill: '#15803d' }));
  }
  function stat(box, label, value, sub) {
    var d = el('div', 'stat'); d.appendChild(el('span', 'muted small', label)); d.appendChild(el('strong', null, value)); if (sub) d.appendChild(el('span', 'small', sub)); box.appendChild(d);
  }
  function runOpt() {
    var v = read(), gb = lastGb ? lastGb.total : 0, pool = K.num(v.pool);
    var out = $('#o-out'); out.hidden = false;
    var box = $('#o-best'); box.textContent = '';
    if (pool <= 0) { box.appendChild(el('p', 'small', t('noPool'))); $('#o-table tbody').textContent = ''; $('#o-chart').textContent = ''; return; }
    var step = pool > 4000000 ? 10000 : pool > 1500000 ? 5000 : 1000;
    var o = K.optimize({ pool: pool, gb: gb, kommunal: rate(v.kommunal), avgift: rate(v.avgift), birthYear: K.num(v.birthYear) || 1985, otherIncome: v.otherIncome, share: v.share, otherWages: v.otherWages, step: step });
    lastOpt = o; var b = o.best, z = o.rows[0], m = o.rows[o.rows.length - 1];
    stat(box, t('bestSal'), kr(b.salary), t('perMonth')(b.monthly));
    stat(box, t('bestDiv'), kr(b.dividend), t('vsZero')(b.net - z.net));
    stat(box, t('bestNet'), kr(b.net), t('vsMax')(b.net - m.net));
    stat(box, t('bestTax'), kr(b.totalTax), pctf(b.wedge));
    chart(o);
    // table: ~12 evenly spaced rows plus the best one
    var tb = $('#o-table tbody'); tb.textContent = '';
    var n = o.rows.length, pick = [], every = Math.max(1, Math.round(n / 12));
    for (var i = 0; i < n; i += every) pick.push(o.rows[i]);
    if (pick[pick.length - 1] !== o.rows[n - 1]) pick.push(o.rows[n - 1]);
    pick = pick.filter(function (r) { return r.salary !== b.salary; }); pick.push(b); pick.sort(function (a, c) { return a.salary - c.salary; });
    pick.forEach(function (r) {
      var tr = el('tr', r === b ? 'hl' : null);
      [kr(r.salary) + ' (' + nf.format(r.monthly) + ')', kr(r.employerFee), kr(r.corpTax), kr(r.dividend), kr(r.salaryTax + r.dividendTax), kr(r.net), kr(r.nextLbu)].forEach(function (s, j) { tr.appendChild(el('td', j ? 'num' : null, s)); });
      tb.appendChild(tr);
    });
  }

  // ---------- i18n ----------
  document.querySelectorAll('[data-i18n]').forEach(function (e) { SV[e.dataset.i18n] = e.innerHTML; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV;
    document.documentElement.lang = l === 'en' ? 'en' : 'sv';
    document.querySelectorAll('[data-i18n]').forEach(function (e) { if (D[e.dataset.i18n]) e.innerHTML = D[e.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    calc();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- events ----------
  $('#form').addEventListener('input', function (e) { if (e.target.type === 'text') valid(e.target); if (e.target.id === 'spouse') $('#spouseRow').hidden = !e.target.checked; save(); calc(); });
  $('#opt').addEventListener('input', function (e) { if (e.target.type === 'text') valid(e.target); save(); if (lastOpt) runOpt(); });
  $('#reset').addEventListener('click', function () { write(DEFAULTS); lastOpt = null; $('#o-out').hidden = true; save(); calc(); });
  $('#sample').addEventListener('click', function () {
    write({ ownedAtStart: true, share: '100', otherShares: '0', wages: '1000000', ownSalary: '600000', spouse: false, spouseShare: '0', cost: '25000', saved: '750000', dividend: '100000' });
    save(); calc(); $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#print').addEventListener('click', function () { window.print(); });

  var dlg = $('#paywall');
  window.PAYWALL.mount(dlg, PW, { launchAfter: $('#optimize').parentNode, onUnlocked: function () { calc(); runOpt(); } });
  $('#optimize').addEventListener('click', function () { if (PW.isUnlocked()) runOpt(); else dlg.showModal(); });

  load();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else calc();
})();
