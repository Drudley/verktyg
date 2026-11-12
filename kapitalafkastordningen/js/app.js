/* UI for Kapitalafkastordningen – kapitalafkastgrundlag og kapitalafkast. All data stays in the browser. */
(function () {
  'use strict';
  var K = window.KIT, $ = K.$, $$ = K.$$, CFG = window.APP_CONFIG, PW = window.APP_PAYWALL, A = window.KAO, fmt = K.fmt, esc = K.esc;
  var lang = 'da';
  var EN = {
    h1: 'Danish capital return scheme (kapitalafkastordningen) – capital base and capital return',
    lead: 'Enter the business assets at the start of the year and the year\u2019s income. The tool works out the <strong>capital return base asset by asset</strong> under the Business Taxation Act s. 22 a, the <strong>capital return</strong> at the year\u2019s rate, applies the <strong>cap</strong> from personal income and negative net capital income and shows how much is <strong>moved from personal income to capital income</strong>.',
    'calc-h': 'Business and income year', sample: 'Show example', clear: 'Clear',
    'l-co': 'Business name', 'l-cvr': 'CVR number', 'l-year': 'Income year', 'l-rate': 'Other rate, % (blank = the year\u2019s rate)', 'l-months': 'Whole months in business this year',
    'l-pni': 'Personal net income from the business, DKK', 'l-nki': 'Net capital income before capital return, DKK (negative with minus)', 'l-kred': 'Trade creditors at the start of the year, DKK',
    'l-married': 'Married and living together at year end', 'o-no': 'No', 'o-yes': 'Yes',
    'l-spA': 'Spouse\u2019s business assets (base), DKK', 'l-spP': 'Spouse\u2019s personal net income from a business, DKK', 'l-spN': 'Spouse\u2019s net capital income, DKK', 'l-spOwn': 'Does the spouse run their own business with these assets?',
    'a-h': 'Assets at the start of the income year', add: 'Add asset',
    'h-assets': 'Real property: cash acquisition price plus improvements. Operating equipment: the tax pool balance at the start of the year (partly private: the undepreciated part and the business share in %). Goodwill and other assets: cost less tax depreciation. Debt is not deducted.',
    saved: 'Your entries are only saved in this browser. Nothing is sent anywhere.',
    'per-h': 'Capital return base asset by asset', 'paid-h': 'Statement for your tax file, CSV and Excel',
    'paid-p': 'Get a <strong>written statement of the capital return base and capital return</strong> with legal references to keep with the accounts, the asset list as a <strong>CSV file</strong> and an <strong>Excel sheet</strong> with base, cap and rates for your accountant. The statement is in Danish.',
    open: 'Show the statement', 'note-h': 'Capital return statement', csv: 'Download asset list (CSV)', xlsx: 'Download Excel statement', print: 'Print',
    'cta-h': 'Own shares with foreign dividend tax?', 'cta-p': '<a href="../tilbagesoegning-udbytteskat/">Udbytteskat tilbage</a> shows how much you can reclaim from Norway, Germany, Switzerland, Finland and Sweden straight from the Nordnet file.',
    'pw-h': 'Statement, CSV and Excel', 'pw-p': 'Unlock the written capital return statement, the asset list as CSV and the Excel statement. The capital return calculation itself is always free.'
  };
  var TY = {
    da: { ejendom: 'Fast ejendom (erhverv/udlejning)', familie: 'Bolig til familie (forældrekøb)', drift: 'Driftsmidler (saldoværdi)', lager: 'Varelager', debitor: 'Varedebitorer', igang: 'Igangværende arbejde (netto)', immat: 'Goodwill/immaterielle', andet: 'Andet erhvervsaktiv', finans: 'Kontanter, fordringer, aktier' },
    en: { ejendom: 'Real property (business/letting)', familie: 'Home for family (parent purchase)', drift: 'Operating equipment (pool value)', lager: 'Inventory', debitor: 'Trade debtors', igang: 'Work in progress (net)', immat: 'Goodwill/intangibles', andet: 'Other business asset', finans: 'Cash, receivables, shares' }
  };
  var T = {
    da: { result: 'Kapitalafkast', name: 'Aktiv', type: 'Type', value: 'Værdi primo, kr.', pct: 'Erhvervsandel, %', remove: 'Fjern', incl: 'Medregnes', sum: 'Kapitalafkastgrundlag',
      notes: { familie: 'indgår ikke (§ 22 a, stk. 8)', finans: 'indgår ikke (§ 22 a, stk. 7)', pool: 'modregnes varekreditorer' }, poolRow: 'Varekreditorer modregnet', spRow: 'Ægtefællens aktiver',
      sKa: 'Kapitalafkast', sGr: 'Kapitalafkastgrundlag', sRate: 'Sats', sRaw: 'Beregnet før loft', sCap: 'Loft (stk. 3)', sPi: 'Personlig indkomst efter',
      meta: function (r) { return 'Indkomstår ' + r.year + ' · sats ' + fmt(r.rate, 2) + ' % · ' + r.months + ' hele måneder'; },
      ok: function (r) { return 'Kapitalafkast ' + kr(r.ka) + ' kr. (' + kr(r.total) + ' kr. × ' + fmt(r.rate, 2) + ' %' + (r.months !== 12 ? ' × ' + r.months + '/12' : '') + (r.binding ? ', begrænset af loftet' : '') + '). Beløbet trækkes fra den personlige indkomst og lægges til kapitalindkomsten' + (r.spouse ? ' – heraf ' + kr(r.spouse) + ' kr. hos ægtefællen' : '') + '.'; },
      statusOk: function (n) { return n + (n === 1 ? ' aktiv beregnet.' : ' aktiver beregnet.'); }, statusErr: 'Kontrollér de markerede felter (beløb, procent og måneder).',
      flag: { familie: '%n er en bolig til nærtstående og indgår ikke i grundlaget (§ 22 a, stk. 8).', negsaldo: '%n: negativ saldo kan ikke fradrages – sat til 0.', blandet: '%n bruges delvis privat – kontrollér, at aktivet kan indgå i virksomhedsordningen (§ 22 a, stk. 6, jf. § 1, stk. 3).', pool: 'Varekreditorerne er større end varelager, varedebitorer og igangværende arbejde – de indgår med 0.', capP: 'Kapitalafkastet er begrænset til den personlige nettoindkomst fra virksomheden.', capN: 'Kapitalafkastet er begrænset til den negative nettokapitalindkomst.', useN: 'Loftet efter den negative nettokapitalindkomst er højere end overskuddet og bruges.', months: 'Forholdsmæssigt afkast efter hele måneder (§ 22 a, stk. 2).', rateOverride: 'Satsen er rettet manuelt.', noRate: 'Ingen kendt sats for året – skriv satsen.', zero: 'Satsen er 0 % – der er intet kapitalafkast.', spouse: 'Ægtefæller: grundlag og loft er opgjort samlet (§ 22 a, stk. 4) – kontrollér fordelingen med revisor.' },
      csvOk: 'CSV-filen er hentet.', xlsxOk: 'Excel-filen er hentet.', fail: 'Kunne ikke lave filen.', help: 'Hjælpemiddel, ikke rådgivning. Kontrollér med revisor, hvilke aktiver der er erhvervsmæssige.' },
    en: { result: 'Capital return', name: 'Asset', type: 'Type', value: 'Value at start, DKK', pct: 'Business share, %', remove: 'Remove', incl: 'Included', sum: 'Capital return base',
      notes: { familie: 'excluded (s. 22 a(8))', finans: 'excluded (s. 22 a(7))', pool: 'netted against trade creditors' }, poolRow: 'Trade creditors netted', spRow: 'Spouse\u2019s assets',
      sKa: 'Capital return', sGr: 'Capital return base', sRate: 'Rate', sRaw: 'Calculated before cap', sCap: 'Cap (subs. 3)', sPi: 'Personal income after',
      meta: function (r) { return 'Income year ' + r.year + ' · rate ' + fmt(r.rate, 2) + ' % · ' + r.months + ' whole months'; },
      ok: function (r) { return 'Capital return DKK ' + kr(r.ka) + ' (DKK ' + kr(r.total) + ' × ' + fmt(r.rate, 2) + ' %' + (r.months !== 12 ? ' × ' + r.months + '/12' : '') + (r.binding ? ', limited by the cap' : '') + '). It is deducted from personal income and added to capital income' + (r.spouse ? ' – DKK ' + kr(r.spouse) + ' of it for the spouse' : '') + '.'; },
      statusOk: function (n) { return n + (n === 1 ? ' asset calculated.' : ' assets calculated.'); }, statusErr: 'Check the marked fields (amounts, percentages and months).',
      flag: { familie: '%n is a home for close family and is excluded from the base (s. 22 a(8)).', negsaldo: '%n: a negative pool balance cannot be deducted – set to 0.', blandet: '%n is partly private – check that it can be included in the business scheme (s. 22 a(6)).', pool: 'Trade creditors exceed inventory, trade debtors and work in progress – they count as 0.', capP: 'The capital return is capped at personal net income from the business.', capN: 'The capital return is capped at the negative net capital income.', useN: 'The cap from negative net capital income is higher than the profit and is used.', months: 'Pro-rated by whole months (s. 22 a(2)).', rateOverride: 'The rate was changed manually.', noRate: 'No known rate for the year – enter the rate.', zero: 'The rate is 0 % – there is no capital return.', spouse: 'Spouses: base and cap are combined (s. 22 a(4)) – check the split with your accountant.' },
      csvOk: 'The CSV file has been downloaded.', xlsxOk: 'The Excel file has been downloaded.', fail: 'Could not create the file.', help: 'A helper, not advice. Check with your accountant which assets are business assets.' }
  };
  function L() { return T[lang]; }
  function kr(o) { return fmt(o / 100, 0); }
  var CKEYS = ['name', 'cvr', 'year', 'rate', 'months', 'pni', 'nki', 'kred', 'married', 'spA', 'spP', 'spN', 'spOwn'];
  function emptyA() { return { name: '', type: 'ejendom', value: '', pct: '100' }; }
  function emptyC() { return { year: '2026', months: '12' }; }
  var st = { company: emptyC(), assets: [emptyA()] };
  function collect() {
    CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) st.company[k] = e.value.trim(); });
    st.assets = $$('#assets .person').map(function (row) { var o = {}; $$('[data-k]', row).forEach(function (el) { o[el.dataset.k] = el.value; }); return o; });
    if (!st.assets.length) st.assets = [emptyA()];
  }
  function fillCompany() { var c = st.company, d = emptyC(); CKEYS.forEach(function (k) { var e = $('#f-' + k); if (e) e.value = c[k] != null && c[k] !== '' ? c[k] : (d[k] || ''); }); $('#spouse').hidden = $('#f-married').value !== '1'; }
  function inp(k, label, ph) { return '<label data-for="' + k + '"><span>' + label + '</span><input type="text" data-k="' + k + '" inputmode="decimal" placeholder="' + (ph || '') + '" autocomplete="off"></label>'; }
  function rowEl(a, i) {
    var t = L(), el = document.createElement('div'); el.className = 'person'; el.dataset.i = String(i);
    el.innerHTML = '<div class="row"><label class="grow"><span class="sr">' + t.name + '</span><input type="text" data-k="name" placeholder="' + t.name + '" autocomplete="off"></label>' +
      '<label><span class="sr">' + t.type + '</span><select data-k="type">' + A.TYPES.map(function (k) { return '<option value="' + k + '">' + TY[lang][k] + '</option>'; }).join('') + '</select></label>' +
      '<button class="del" type="button" title="' + t.remove + '" aria-label="' + t.remove + '">×</button></div>' +
      '<div class="grid">' + inp('value', t.value, '1.000.000') + inp('pct', t.pct, '100') + '</div><p class="res"></p>';
    $$('[data-k]', el).forEach(function (f) { var v = a[f.dataset.k]; f.value = v != null && v !== '' ? v : (f.dataset.k === 'type' ? 'ejendom' : f.dataset.k === 'pct' ? '100' : ''); });
    $('[data-k=type]', el).addEventListener('change', render);
    $('.del', el).addEventListener('click', function () { collect(); st.assets.splice(+el.dataset.i, 1); if (!st.assets.length) st.assets = [emptyA()]; paint(); render(); });
    $$('input', el).forEach(function (f) { f.addEventListener('input', render); });
    return el;
  }
  function paint() { var box = $('#assets'); box.innerHTML = ''; st.assets.forEach(function (a, i) { box.appendChild(rowEl(a, i)); }); }
  function current() { collect(); return A.calc(st); }
  function isEmpty() { return !String(st.company.pni || '').trim() && st.assets.every(function (a) { return !String(a.value || '').trim() && !String(a.name || '').trim(); }); }
  function stat(label, v, unit) { return '<div class="stat"><span>' + label + '</span><strong>' + v + (unit == null ? ' kr.' : unit) + '</strong></div>'; }
  function render() {
    var t = L(), res = $('#result'), status = $('#status');
    $$('#calc .bad').forEach(function (x) { x.classList.remove('bad'); });
    $$('#assets .person').forEach(function (e) { $('.res', e).textContent = ''; });
    $('#spouse').hidden = $('#f-married').value !== '1';
    persist();
    if (isEmpty()) { res.hidden = true; status.textContent = ''; status.className = 'status'; return; }
    var r = current(), rows = $$('#assets .person');
    if (!r.ok) {
      res.hidden = true; status.textContent = t.statusErr; status.className = 'status err';
      r.errors.forEach(function (k) { var f = $('#f-' + k); if (f) f.classList.add('bad'); });
      r.bad.forEach(function (i) { var e = rows[i]; if (!e) return; r.rows[i].errors.forEach(function (k) { var f = $('[data-k=' + k + ']', e); if (f) f.classList.add('bad'); }); });
      return;
    }
    r.rows.forEach(function (x, i) { if (rows[i]) $('.res', rows[i]).textContent = t.incl + ': ' + kr(x.included) + ' kr.' + (x.note ? ' – ' + t.notes[x.note] : ''); });
    res.hidden = false; status.textContent = t.statusOk(r.rows.length); status.className = 'status';
    $('#r-title').textContent = st.company.name || t.result;
    $('#r-meta').textContent = (st.company.cvr ? 'CVR ' + st.company.cvr + ' · ' : '') + t.meta(r);
    $('#check').className = 'check ok'; $('#check').textContent = t.ok(r);
    $('#stats').innerHTML = stat(t.sKa, kr(r.ka)) + stat(t.sGr, kr(r.total)) + stat(t.sRate, fmt(r.rate, 2), ' %') + stat(t.sRaw, kr(r.raw)) + stat(t.sCap, kr(r.cap)) + stat(t.sPi, kr(r.piAfter));
    var fl = r.warnings.map(function (w) { return t.flag[w.k].replace('%n', String(w.n || '')); });
    var fe = $('#flags'); fe.hidden = !fl.length; fe.innerHTML = fl.length ? '<ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    $('#per-t thead').innerHTML = '<tr><th>' + t.name + '</th><th>' + t.type + '</th><th class="num">' + t.value + '</th><th class="num">%</th><th class="num">' + t.incl + '</th></tr>';
    var body = r.rows.map(function (x) { return '<tr><td>' + esc(x.name) + (x.note ? '<br><span class="muted small">' + t.notes[x.note] + '</span>' : '') + '</td><td>' + TY[lang][x.type] + '</td><td class="num">' + kr(x.value) + '</td><td class="num">' + fmt(x.pct, 0) + '</td><td class="num">' + kr(x.included) + '</td></tr>'; });
    if (r.pool) body.push('<tr><td>' + t.poolRow + '</td><td></td><td class="num"></td><td></td><td class="num">−' + kr(r.pool - r.poolNet) + '</td></tr>');
    if (r.spA) body.push('<tr><td>' + t.spRow + '</td><td></td><td class="num"></td><td></td><td class="num">' + kr(r.spA) + '</td></tr>');
    $('#per-t tbody').innerHTML = body.join('');
    $('#per-t tfoot').innerHTML = '<tr><td>' + t.sum + '</td><td></td><td></td><td></td><td class="num">' + kr(r.total) + '</td></tr>';
    $('#paid-open').classList.toggle('locked', !PW.isUnlocked());
    if (PW.isUnlocked() && !$('#paid-out').hidden) renderPaid(r);
  }
  /* Danish statement (always Danish – it goes into the tax file) */
  function noteText(r) {
    var c = st.company, out = [];
    out.push('Opgørelse af kapitalafkast efter virksomhedsskatteloven § 22 a for indkomståret ' + r.year + (c.name ? ' – ' + c.name : '') + (c.cvr ? ' (CVR ' + c.cvr + ')' : '') + '.');
    out.push('Kapitalafkastgrundlaget er opgjort ved indkomstårets begyndelse som værdien af de udelukkende erhvervsmæssige aktiver (stk. 5), med fast ejendom til kontant anskaffelsessum og driftsmidler til saldoværdi (§ 8, stk. 2, og § 3, stk. 4), blandede aktiver med den erhvervsmæssige andel (stk. 6) og uden fradrag af gæld. Varelager, varedebitorer og igangværende arbejde på ' + kr(r.pool) + ' kr. er modregnet varekreditorer på ' + kr(r.kred) + ' kr. og indgår med ' + kr(r.poolNet) + ' kr. (stk. 7).' + (r.excluded ? ' Kontanter, fordringer, aktier og boliger stillet til rådighed for nærtstående på i alt ' + kr(r.excluded) + ' kr. indgår ikke (stk. 7 og 8).' : ''));
    out.push('Kapitalafkastgrundlag ' + kr(r.grundlag) + ' kr.' + (r.spA ? ' plus ægtefællens ' + kr(r.spA) + ' kr. = ' + kr(r.total) + ' kr. (stk. 4)' : '') + ' × kapitalafkastsats ' + fmt(r.rate, 2) + ' %' + (r.months !== 12 ? ' × ' + r.months + '/12 måneder' : '') + ' = ' + kr(r.raw) + ' kr. (stk. 2 og § 9).');
    out.push('Loft (stk. 3): den største af positiv personlig nettoindkomst fra virksomheden ' + kr(r.capP) + ' kr. og negativ nettokapitalindkomst ' + kr(r.capN) + ' kr. = ' + kr(r.cap) + ' kr. Kapitalafkastet udgør herefter ' + kr(r.ka) + ' kr.' + (r.spouse ? ', heraf ' + kr(r.mine) + ' kr. hos den skattepligtige og ' + kr(r.spouse) + ' kr. hos ægtefællen.' : '.'));
    out.push('Beløbet fragår i den personlige indkomst (' + kr(r.pni) + ' kr. → ' + kr(r.piAfter) + ' kr.) og lægges til kapitalindkomsten (' + kr(r.nki) + ' kr. → ' + kr(r.kiAfter) + ' kr.), jf. § 22 a, stk. 1. Valget af kapitalafkastordningen tilkendegives ved afgivelse af oplysninger for indkomståret og kan ændres til og med 30. juni i det andet kalenderår efter indkomstårets udløb (§ 2, stk. 2).');
    return out;
  }
  function renderPaid(r) { r = r || current(); if (!r.ok) return; $('#note').innerHTML = noteText(r).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + '<p class="hint">' + L().help + '</p>'; }
  function openPaid() { if (!PW.isUnlocked()) return; $('#paid-out').hidden = false; renderPaid(); }
  function ready() { if (!PW.isUnlocked()) return null; var r = current(); return r.ok && !isEmpty() ? r : null; }
  function base(r) { return 'kapitalafkast-' + r.year; }
  function csvAmount(o) { return (o < 0 ? '-' : '') + fmt(Math.abs(o) / 100, 2).replace(/\./g, ''); }
  function downloadCsv() {
    var r = ready(), t = L(); if (!r) return;
    var lines = ['Aktiv;Type;Værdi primo;Erhvervsandel %;Medregnet;Bemærkning'];
    r.rows.forEach(function (x) { lines.push([x.name.replace(/;/g, ','), TY.da[x.type], csvAmount(x.value), String(x.pct).replace('.', ','), csvAmount(x.included), x.note ? T.da.notes[x.note] : ''].join(';')); });
    if (r.pool) lines.push(['Varekreditorer', 'Modregning', csvAmount(-r.kred), '', csvAmount(r.poolNet - r.pool), 'stk. 7']. join(';'));
    if (r.spA) lines.push(['Ægtefællens aktiver', 'Ægtefælle', csvAmount(r.spA), '', csvAmount(r.spA), 'stk. 4'].join(';'));
    lines.push(['Kapitalafkastgrundlag', '', '', '', csvAmount(r.total), ''].join(';'));
    lines.push(['Kapitalafkast', fmt(r.rate, 2) + ' %', '', '', csvAmount(r.ka), r.binding ? 'begrænset af loft' : ''].join(';'));
    try { K.download('\ufeff' + lines.join('\r\n') + '\r\n', base(r) + '-aktiver.csv', 'text/csv;charset=utf-8'); $('#dl-msg').textContent = t.csvOk; } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function money(v) { return { v: v, t: 'money' }; }
  function bold(s) { return { v: s, b: true }; }
  async function downloadXlsx() {
    var r = ready(), t = L(); if (!r) return;
    var c = st.company;
    var sum = [[bold('Kapitalafkastordningen – opgørelse')], ['Virksomhed', c.name || ''], ['CVR', c.cvr || ''], ['Indkomstår', r.year], ['Kapitalafkastsats, %', r.rate], ['Hele måneder', r.months], [],
      ['Aktiver uden varepulje', money(r.own / 100)], ['Varelager, varedebitorer, igangværende arbejde', money(r.pool / 100)], ['Varekreditorer', money(-r.kred / 100)], ['Varepulje medregnet', money(r.poolNet / 100)], ['Ægtefællens aktiver', money(r.spA / 100)], [bold('Kapitalafkastgrundlag'), money(r.total / 100)],
      ['Beregnet kapitalafkast før loft', money(r.raw / 100)], ['Personlig nettoindkomst fra virksomhed (samlet)', money(r.pniTot / 100)], ['Nettokapitalindkomst (samlet)', money(r.nkiTot / 100)], ['Loft', money(r.cap / 100)], [bold('Kapitalafkast'), money(r.ka / 100)], ['Heraf ægtefælle', money(r.spouse / 100)],
      ['Personlig indkomst efter', money(r.piAfter / 100)], ['Kapitalindkomst efter', money(r.kiAfter / 100)], [], [T.da.help]];
    var rows = [[bold('Aktiv'), bold('Type'), bold('Værdi primo'), bold('Erhvervsandel %'), bold('Medregnet'), bold('Bemærkning')]];
    r.rows.forEach(function (x) { rows.push([x.name, TY.da[x.type], money(x.value / 100), x.pct, money(x.included / 100), x.note ? T.da.notes[x.note] : '']); });
    var rates = [[bold('Indkomstår'), bold('Kapitalafkastsats %')]].concat(Object.keys(A.RATES).sort().reverse().map(function (y) { return [y, A.RATES[y]]; }));
    var note = [[bold('Opgørelse')]].concat(noteText(r).map(function (x) { return [x]; }));
    var src = [[bold('Kilder')], ['Virksomhedsskatteloven, LBK nr. 1836 af 16/09/2021, §§ 2, 3, 8, 9, 22 a'], ['https://www.retsinformation.dk/eli/lta/2021/1836'], ['Den juridiske vejledning C.C.5.3.1.2.3 og C.C.5.3.1.2.4'], ['https://info.skat.dk/data.aspx?oid=1948936'], ['https://info.skat.dk/data.aspx?oid=1948937'], ['SKM2026.414.SKTST – kapitalafkastsatsen for 2026']];
    try {
      var buf = await window.XLSXW.build([{ name: 'Sammenfatning', rows: sum, widths: [52, 22] }, { name: 'Aktiver', rows: rows, widths: [40, 34, 16, 14, 16, 30] }, { name: 'Satser', rows: rates, widths: [14, 20] }, { name: 'Opgørelse', rows: note, widths: [140] }, { name: 'Kilder', rows: src, widths: [100] }], { title: 'Kapitalafkast' });
      K.download(buf, base(r) + '.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); $('#dl-msg').textContent = t.xlsxOk;
    } catch (e) { $('#dl-msg').textContent = t.fail; }
  }
  function printPack() {
    var r = ready(); if (!r) return;
    $('#print-root').innerHTML = '<article class="card"><h1>Kapitalafkast ' + r.year + '</h1>' + noteText(r).map(function (x) { return '<p>' + esc(x) + '</p>'; }).join('') + $('#per-t').outerHTML + '</article>';
    document.body.classList.add('printing'); window.print(); document.body.classList.remove('printing');
  }
  function persist() { K.store.set(CFG.SAVE_KEY, st); }
  function restore() { var d = K.store.get(CFG.SAVE_KEY); if (d && d.company && Array.isArray(d.assets) && d.assets.length) { st = d; return true; } return false; }
  var setLang = K.i18n(EN, function (l) { lang = l === 'en' ? 'en' : 'da'; collect(); paint(); render(); });
  $('#add').addEventListener('click', function () { collect(); st.assets.push(emptyA()); paint(); render(); });
  $('#sample').addEventListener('click', function () { st = A.sample(); fillCompany(); paint(); render(); });
  $('#clear').addEventListener('click', function () { K.store.del(CFG.SAVE_KEY); st = { company: emptyC(), assets: [emptyA()] }; fillCompany(); paint(); $('#result').hidden = true; $('#paid-out').hidden = true; $('#status').textContent = ''; });
  $$('#calc input[id^="f-"]').forEach(function (f) { f.addEventListener('input', render); });
  $$('#calc select[id^="f-"]').forEach(function (f) { f.addEventListener('change', render); });
  $('#paid-open').addEventListener('click', function () { if (PW.isUnlocked()) return openPaid(); $('#paywall').showModal(); });
  window.PAYWALL.mount($('#paywall'), PW, { launchAfter: $('#paid > p.small'), onUnlocked: function () { openPaid(); render(); } });
  $('#csv').addEventListener('click', downloadCsv);
  $('#xlsx').addEventListener('click', function () { downloadXlsx(); });
  $('#print').addEventListener('click', printPack);
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'da' : 'en'); });
  restore(); fillCompany(); paint();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en'); else render();
})();
