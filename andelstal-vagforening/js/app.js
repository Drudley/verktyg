/* Andelstal för vägförening – UI. Everything runs in the browser; nothing is uploaded. Free page (no paywall).
 * State (rows, own categories/tonnage, options) is autosaved in localStorage (APP_CONFIG.STORAGE_KEY). */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG, A = window.ANDEL, SAMPLE = window.ANDEL_SAMPLE, lang = 'sv';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var stdCats = function () { return A.CATEGORIES.map(function (c) { return Object.assign({}, c); }); };
  var st = { rows: [], cats: stdCats(), title: '', nextCat: 1, res: null };

  var EN = {
    h1: 'Road association share numbers (andelstal) – the ton-kilometre method',
    lead: 'Enter the properties along the road – type (permanent home, holiday home, forest …), number and <strong>road length</strong> – and get <strong>andelstal in ton-kilometres</strong> using Lantmäteriet’s 2025 standard values, plus each property’s share in percent, adding up to exactly 100. Everything is calculated in your browser.',
    free: 'Free – no account, no upload, no tracking.',
    'cta-h': 'Going to charge the fee by andelstal?', 'cta-p': 'Load the list into <a href="../debiteringslangd-samfallighet/">Debiteringslängd and payment notices for joint property associations</a> – the charge is split per property with exact rounding, and you get the debiteringslängd and notices with OCR and Swish.',
    'calc-h': 'Properties along the road', sample: 'Try a synthetic example', clear: 'Clear list',
    'calc-p': 'One row per type of traffic. If a property has both a home and forest, add two rows with the same property designation – they are added together. <em>Number</em> is households, flats or berths – or hectares for forest, arable land and pasture. <em>Road length</em> is the distance in km on the association’s road from the property’s connection to where the road ends (usually at a public road). <em>Factor</em> is optional (e.g. 0.5 for a direct exit).',
    'c-fast': 'Property', 'c-agare': 'Owner (optional)', 'c-typ': 'Type', 'c-antal': 'Number', 'c-km': 'Road length (km)', 'c-faktor': 'Factor', 'c-del': 'Remove',
    add: 'Add row', saved: 'The list is saved automatically in this browser.',
    'paste-h': 'Paste from Excel / Google Sheets', 'paste-p': 'Columns: Property, Owner, Type, Number, Road length, Factor (header row optional). Type can be e.g. “permanent”, “fritidshus”, “obebyggd”, “skog 5” or the name in the list.', 'paste-go': 'Add the rows',
    'opt-h': 'Settings', 'o-minkm': 'Minimum road length', 'o-nodist': 'Ignore road length (tons per year only)', 'o-minandel': 'Minimum andelstal per property (optional)', 'o-dec': 'Decimals in andelstal', 'o-amount': 'Amount to split, SEK (optional)',
    'cats-h': 'Standard values (tons per year) – edit or add your own type', 'cats-p': 'Prefilled with Lantmäteriet’s recommendations in PM 2025. Change a value if your förrättning used another one, or add your own type.',
    'k-typ': 'Type', 'k-ton': 'Tons per year', 'k-unit': 'Per', 'k-src': 'Source', 'cat-add': 'Add own type', 'cat-reset': 'Reset standard values',
    'r-h': 'Andelstal per property', 'dl-csv': 'Download for Debiteringslängd (.csv)', 'dl-xlsx': 'Download Excel file (.xlsx)', copy: 'Copy table',
    'cta2-h': 'Next step: debiteringslängd and payment notices', 'cta2-p': 'The CSV file above has the columns <em>Fastighet</em>, <em>Ägare</em> and <em>Andelstal väg</em> – exactly what <strong>Debiteringslängd and payment notices for joint property associations</strong> reads. There you split the amount the annual meeting decided to charge, with rounding that adds up exactly, and get a debiteringslängd (§ 42) and notices with OCR and Swish QR. Add addresses to the file first and they end up on the notices.', 'cta2-go': 'Open Debiteringslängd →'
  };
  var T = {
    sv: { grp: { bo: 'Bostäder och tomter', ov: 'Övriga fastigheter', mark: 'Mark, per hektar', egen: 'Egna typer' }, pick: '– välj typ –', st: 'st', ha: 'ha', perSt: 'per st', perHa: 'per hektar', own: 'Egen typ', ownSrc: 'Egen', newCat: 'Egen typ', del: 'Ta bort',
      ok: function (n, t, u) { return 'Andelarna summerar till exakt 100,00 % · ' + n + ' fastigheter · summa andelstal ' + t + ' ' + u; },
      sFast: 'Fastigheter', sSum: 'Summa andelstal', sMax: 'Största andel', sPer: 'Kr per ', sRows: 'Rader',
      hFast: 'Fastighet', hAgare: 'Ägare', hBas: 'Underlag', hAndel: 'Andelstal', hPct: 'Andel %', hKr: 'Belopp (kr)', sum: 'Summa',
      raised: 'höjt till lägsta', minkm: 'min. väglängd',
      w: { 'no-fastighet': function (x) { return 'Rad ' + x.row + ': fastighetsbeteckning saknas – raden räknas inte.'; },
        'no-cat': function (x) { return 'Rad ' + x.row + ' (' + x.fastighet + '): välj typ – raden räknas inte.'; },
        'bad-number': function (x) { return 'Rad ' + x.row + ' (' + x.fastighet + '): antal, väglängd eller faktor går inte att läsa som tal – raden räknas inte.'; },
        'no-km': function (x) { return 'Rad ' + x.row + ' (' + x.fastighet + '): väglängd saknas – räknas som 0 km.'; },
        'min-km': function (x) { return x.fastighet + ': väglängd ' + A.fmt(x.km, 2, true) + ' km är kortare än minsta väglängd – räknas med minsta väglängd (PM 2025 avsnitt 3.1.3).'; },
        'skog-lt-1ha': function (x) { return x.fastighet + ': mindre än 1 hektar skog – enligt PM 2025 (3.8.2) sätts normalt inget tontal för skogsbruk då.'; },
        'fri-mixed': function () { return 'Listan blandar användningskategorier för fritidsbostäder. Enligt PM 2025 (3.3.2) ska normalt samma kategori gälla i hela båtnadsområdet.'; },
        zero: function (x) { return x.fastighet + ': andelstalet blir 0.'; } },
      flagsH: 'Att kontrollera', empty: 'Fyll i minst en fastighet med typ för att se andelstalen.',
      pasted: function (n, u) { return n + ' rader tillagda' + (u ? ' – ' + u + ' rader saknar typ (välj i listan)' : '') + '.'; }, pasteErr: 'Hittade inga rader med fastighet. Klistra in med rubrikraden Fastighet, Ägare, Typ, Antal, Väglängd, Faktor.',
      csvOk: 'CSV-filen är nedladdad. Läs in den i Debiteringslängd-verktyget.', xlsxOk: 'Excel-filen är nedladdad.', copied: 'Tabellen är kopierad – klistra in i Excel eller Google Kalkylark.', copyErr: 'Kunde inte kopiera automatiskt.',
      cleared: 'Listan är tömd.', sampleOk: 'Syntetiskt exempel inläst (påhittade fastigheter och ägare).', confirmClear: 'Töm hela listan?' },
    en: { grp: { bo: 'Homes and plots', ov: 'Other properties', mark: 'Land, per hectare', egen: 'Own types' }, pick: '– choose type –', st: 'pcs', ha: 'ha', perSt: 'each', perHa: 'per hectare', own: 'Own type', ownSrc: 'Own', newCat: 'Own type', del: 'Remove',
      ok: function (n, t, u) { return 'Shares add up to exactly 100.00 % · ' + n + ' properties · total andelstal ' + t + ' ' + u; },
      sFast: 'Properties', sSum: 'Total andelstal', sMax: 'Largest share', sPer: 'SEK per ', sRows: 'Rows',
      hFast: 'Property', hAgare: 'Owner', hBas: 'Basis', hAndel: 'Andelstal', hPct: 'Share %', hKr: 'Amount (SEK)', sum: 'Total',
      raised: 'raised to minimum', minkm: 'min. road length',
      w: { 'no-fastighet': function (x) { return 'Row ' + x.row + ': property designation missing – row not counted.'; },
        'no-cat': function (x) { return 'Row ' + x.row + ' (' + x.fastighet + '): choose a type – row not counted.'; },
        'bad-number': function (x) { return 'Row ' + x.row + ' (' + x.fastighet + '): number, road length or factor is not a number – row not counted.'; },
        'no-km': function (x) { return 'Row ' + x.row + ' (' + x.fastighet + '): road length missing – counted as 0 km.'; },
        'min-km': function (x) { return x.fastighet + ': road length ' + A.fmt(x.km, 2, true) + ' km is below the minimum – the minimum is used (PM 2025 section 3.1.3).'; },
        'skog-lt-1ha': function (x) { return x.fastighet + ': less than 1 hectare of forest – PM 2025 (3.8.2) normally sets no forestry tonnage then.'; },
        'fri-mixed': function () { return 'The list mixes usage categories for holiday homes. PM 2025 (3.3.2) says the same category should normally apply to the whole area.'; },
        zero: function (x) { return x.fastighet + ': andelstal is 0.'; } },
      flagsH: 'Please check', empty: 'Enter at least one property with a type to see the andelstal.',
      pasted: function (n, u) { return n + ' rows added' + (u ? ' – ' + u + ' rows have no type (choose one)' : '') + '.'; }, pasteErr: 'No rows with a property found. Paste with the header row Fastighet, Ägare, Typ, Antal, Väglängd, Faktor.',
      csvOk: 'CSV downloaded. Load it into the Debiteringslängd tool.', xlsxOk: 'Excel file downloaded.', copied: 'Table copied – paste into Excel or Google Sheets.', copyErr: 'Could not copy automatically.',
      cleared: 'List cleared.', sampleOk: 'Synthetic example loaded (invented properties and owners).', confirmClear: 'Clear the whole list?' }
  };
  function t(k) { return T[lang][k]; }
  function status(m, err) { var s = $('#status'); s.textContent = m || ''; s.className = 'status' + (err ? ' err' : ''); }
  function catName(c) { return c.std ? (lang === 'en' ? c.en : c.sv) : (c.sv || t('own')); }

  // ---------- persistence ----------
  function save() {
    try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify({ v: 1, rows: st.rows, title: st.title, nextCat: st.nextCat, opts: readOpts(true),
      cats: st.cats.map(function (c) { return c.std ? { key: c.key, ton: c.ton } : { key: c.key, sv: c.sv, ton: c.ton, unit: c.unit }; }) })); } catch (e) { /* storage full or disabled: ignore */ }
  }
  function load() {
    var d; try { d = JSON.parse(localStorage.getItem(CFG.STORAGE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || d.v !== 1) return false;
    st.rows = Array.isArray(d.rows) ? d.rows : []; st.title = d.title || ''; st.nextCat = d.nextCat || 1;
    var std = stdCats(), by = {}; std.forEach(function (c) { by[c.key] = c; });
    (d.cats || []).forEach(function (c) { if (by[c.key]) { if (typeof c.ton === 'number' && c.ton >= 0) by[c.key].ton = c.ton; } else if (/^c\d+$/.test(c.key)) std.push({ key: c.key, group: 'egen', sv: String(c.sv || ''), en: String(c.sv || ''), ton: +c.ton || 0, unit: c.unit === 'ha' ? 'ha' : 'st', ref: '', std: false }); });
    st.cats = std;
    if (d.opts) writeOpts(d.opts);
    return true;
  }

  // ---------- options ----------
  function readOpts(raw) {
    var o = { minKmOn: $('#o-minkm-on').checked, minKm: A.num($('#o-minkm').value), noDistance: $('#o-nodist').checked,
      minAndel: A.num($('#o-minandel').value), dec: +$('#o-dec').value || 0, amount: A.num($('#o-amount').value) };
    if (raw) return { minKmOn: o.minKmOn, minKm: $('#o-minkm').value, noDistance: o.noDistance, minAndel: $('#o-minandel').value, dec: o.dec, amount: $('#o-amount').value };
    $('#o-minkm').classList.toggle('bad', isNaN(o.minKm)); $('#o-minandel').classList.toggle('bad', isNaN(o.minAndel)); $('#o-amount').classList.toggle('bad', isNaN(o.amount));
    if (o.minKm === null || isNaN(o.minKm)) o.minKm = 0;
    if (o.minAndel === null || isNaN(o.minAndel)) o.minAndel = 0;
    if (o.amount === null || isNaN(o.amount)) o.amount = 0;
    return o;
  }
  function writeOpts(o) {
    $('#o-minkm-on').checked = o.minKmOn !== false; $('#o-minkm').value = o.minKm != null ? o.minKm : '0,3'; $('#o-nodist').checked = !!o.noDistance;
    $('#o-minandel').value = o.minAndel || ''; $('#o-dec').value = String(o.dec || 0); $('#o-amount').value = o.amount || '';
  }

  // ---------- input table ----------
  function catOptions(sel) {
    var groups = ['bo', 'ov', 'mark', 'egen'], h = '<option value="">' + esc(t('pick')) + '</option>';
    groups.forEach(function (g) {
      var cs = st.cats.filter(function (c) { return c.group === g; }); if (!cs.length) return;
      h += '<optgroup label="' + esc(t('grp')[g]) + '">' + cs.map(function (c) { return '<option value="' + esc(c.key) + '"' + (c.key === sel ? ' selected' : '') + '>' + esc(catName(c)) + ' – ' + esc(A.fmt(c.ton, 2, true)) + ' t' + (c.unit === 'ha' ? '/ha' : '') + '</option>'; }).join('') + '</optgroup>';
    });
    return h;
  }
  function L(k) { return esc((lang === 'en' ? EN : SV)[k] || ''); }
  function renderRows() {
    var tb = $('#in-t tbody');
    tb.innerHTML = st.rows.map(function (r, i) {
      return '<tr data-i="' + i + '"><td data-l="' + L('c-fast') + '"><input class="i-f" type="text" data-k="fastighet" value="' + esc(r.fastighet) + '" placeholder="Ekbacka 1:1" autocomplete="off"></td>' +
        '<td data-l="' + L('c-agare') + '"><input class="i-a" type="text" data-k="agare" value="' + esc(r.agare) + '" autocomplete="off"></td>' +
        '<td data-l="' + L('c-typ') + '"><select data-k="cat">' + catOptions(r.cat) + '</select></td>' +
        '<td data-l="' + L('c-antal') + '"><input class="i-n" type="text" inputmode="decimal" data-k="antal" value="' + esc(r.antal) + '" placeholder="1"></td>' +
        '<td data-l="' + L('c-km') + '"><input class="i-k" type="text" inputmode="decimal" data-k="km" value="' + esc(r.km) + '" placeholder="0,0"></td>' +
        '<td data-l="' + L('c-faktor') + '"><input class="i-x" type="text" inputmode="decimal" data-k="faktor" value="' + esc(r.faktor) + '" placeholder="1"></td>' +
        '<td class="num val" data-l="' + esc(unitLabel()) + '"></td><td class="dc"><button class="del" type="button" data-del="' + i + '" aria-label="' + esc(t('del')) + '" title="' + esc(t('del')) + '">×</button></td></tr>';
    }).join('');
    update();
  }
  function unitLabel() { return $('#o-nodist').checked ? (lang === 'en' ? 'Tons' : 'Ton') : 'Tonkm'; }
  $('#in-t tbody').addEventListener('input', function (e) {
    var tr = e.target.closest('tr'), k = e.target.dataset.k; if (!tr || !k) return;
    st.rows[+tr.dataset.i][k] = e.target.value; update();
  });
  $('#in-t tbody').addEventListener('change', function (e) { if (e.target.tagName === 'SELECT') { st.rows[+e.target.closest('tr').dataset.i].cat = e.target.value; update(); } });
  $('#in-t tbody').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; st.rows.splice(+b.dataset.del, 1); if (!st.rows.length) st.rows.push(blank()); renderRows(); });
  function blank() { return { fastighet: '', agare: '', cat: '', antal: '', km: '', faktor: '' }; }
  $('#add-row').addEventListener('click', function () { var last = st.rows[st.rows.length - 1]; st.rows.push(Object.assign(blank(), last ? { cat: last.cat } : {})); renderRows(); var ins = document.querySelectorAll('#in-t .i-f'); if (ins.length) ins[ins.length - 1].focus(); });
  $('#sample').addEventListener('click', function () {
    st.rows = SAMPLE.rows.map(function (r) { return Object.assign({}, r); }); st.title = SAMPLE.title; st.cats = stdCats().concat(st.cats.filter(function (c) { return !c.std; }));
    writeOpts({ minKmOn: true, minKm: '0,3', noDistance: false, minAndel: '', dec: 0, amount: SAMPLE.amount });
    renderCats(); renderRows(); status(t('sampleOk'));
    $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#clear').addEventListener('click', function () { if (st.rows.some(function (r) { return r.fastighet; }) && !window.confirm(t('confirmClear'))) return; st.rows = [blank()]; st.title = ''; renderRows(); status(t('cleared')); });
  $('#paste-go').addEventListener('click', function () {
    try {
      var p = A.parseText($('#paste').value, st.cats);
      st.rows = st.rows.filter(function (r) { return r.fastighet || r.cat || r.antal || r.km; }).concat(p.rows);
      $('#paste').value = ''; renderRows(); status(t('pasted')(p.rows.length, p.unknown.length));
    } catch (e) { status(t('pasteErr'), true); }
  });
  ['#o-minkm-on', '#o-nodist', '#o-dec'].forEach(function (s) { $(s).addEventListener('change', function () { renderRows(); }); });
  ['#o-minkm', '#o-minandel', '#o-amount'].forEach(function (s) { $(s).addEventListener('input', update); });

  // ---------- categories ----------
  function renderCats() {
    $('#cat-t tbody').innerHTML = st.cats.map(function (c, i) {
      return '<tr data-c="' + i + '"><td>' + (c.std ? esc(catName(c)) : '<input class="c-nm" type="text" data-ck="sv" value="' + esc(c.sv) + '" placeholder="' + esc(t('newCat')) + '">') + '</td>' +
        '<td class="num"><input class="c-ton" type="text" inputmode="decimal" data-ck="ton" value="' + esc(A.fmt(c.ton, 2, true).replace(/\u00a0/g, ' ')) + '"></td>' +
        '<td>' + (c.std ? esc(c.unit === 'ha' ? t('perHa') : t('perSt')) : '<select data-ck="unit"><option value="st"' + (c.unit === 'st' ? ' selected' : '') + '>' + esc(t('perSt')) + '</option><option value="ha"' + (c.unit === 'ha' ? ' selected' : '') + '>' + esc(t('perHa')) + '</option></select>') + '</td>' +
        '<td class="muted">' + esc(c.std ? c.ref : t('ownSrc')) + '</td></tr>';
    }).join('');
  }
  $('#cat-t tbody').addEventListener('input', function (e) {
    var tr = e.target.closest('tr'), k = e.target.dataset.ck; if (!tr || !k) return; var c = st.cats[+tr.dataset.c];
    if (k === 'ton') { var v = A.num(e.target.value); e.target.classList.toggle('bad', v === null || isNaN(v)); if (v !== null && !isNaN(v)) c.ton = v; }
    else if (k === 'sv') { c.sv = c.en = e.target.value; }
    refreshSelects(); update();
  });
  $('#cat-t tbody').addEventListener('change', function (e) { if (e.target.dataset.ck === 'unit') { st.cats[+e.target.closest('tr').dataset.c].unit = e.target.value; refreshSelects(); update(); } });
  $('#cat-add').addEventListener('click', function () { st.cats.push({ key: 'c' + (st.nextCat++), group: 'egen', sv: t('newCat') + ' ' + (st.nextCat - 1), en: '', ton: 0, unit: 'st', ref: '', std: false }); renderCats(); refreshSelects(); save(); var x = document.querySelectorAll('#cat-t .c-nm'); if (x.length) x[x.length - 1].focus(); });
  $('#cat-reset').addEventListener('click', function () { var own = st.cats.filter(function (c) { return !c.std; }); st.cats = stdCats().concat(own); renderCats(); refreshSelects(); update(); });
  function refreshSelects() { document.querySelectorAll('#in-t select[data-k="cat"]').forEach(function (s) { s.innerHTML = catOptions(s.value); }); }

  // ---------- result ----------
  function basis(d, o) {
    var u = d.cat.unit === 'ha' ? ' ha' : '';
    return esc(catName(d.cat)) + ': ' + A.fmt(d.antal, 2, true) + u + ' × ' + A.fmt(d.cat.ton, 2, true) + ' t' + (o.noDistance ? '' : ' × ' + A.fmt(d.usedKm, 3, true) + ' km' + (d.usedKm !== d.km ? ' <span class="tag">' + esc(t('minkm')) + '</span>' : '')) + (d.faktor !== 1 ? ' × ' + A.fmt(d.faktor, 3, true) : '') + ' = ' + A.fmt(d.value, 1, true);
  }
  function update() {
    var o = readOpts(), res = A.compute(st.rows, st.cats, o); st.res = res;
    $('#c-val').textContent = unitLabel();
    var M = {}; res.rows.forEach(function (d) { M[d.row] = d; });
    document.querySelectorAll('#in-t tbody tr').forEach(function (tr, i) {
      var d = M[i + 1], c = tr.querySelector('td.val'); c.textContent = d ? A.fmt(d.value, 1, true) : ''; c.dataset.l = unitLabel();
      ['antal', 'km', 'faktor'].forEach(function (k) { var inp = tr.querySelector('[data-k="' + k + '"]'), v = A.num(inp.value); inp.classList.toggle('bad', v !== null && isNaN(v)); });
    });
    save();
    var R = $('#result');
    if (!res.props.length) { R.hidden = true; return; }
    R.hidden = false;
    var Tl = T[lang], u = res.unitLabel, dec = res.dec;
    $('#r-title').textContent = (st.title ? st.title + ' – ' : '') + (lang === 'en' ? 'andelstal per property' : 'andelstal per fastighet');
    var ok = Math.abs(res.sumPct - 100) < 1e-9 && res.total > 0;
    $('#check').className = 'check ' + (ok ? 'ok' : 'err');
    $('#check').textContent = ok ? Tl.ok(res.props.length, A.fmt(res.total, dec), u) : (lang === 'en' ? 'Total andelstal is 0 – nothing to split.' : 'Summan av andelstalen är 0 – inget att fördela.');
    var max = res.props.reduce(function (m, p) { return p.pct > m.pct ? p : m; }, res.props[0]);
    $('#stats').innerHTML = '<div class="stat"><strong>' + res.props.length + '</strong>' + esc(Tl.sFast) + '</div><div class="stat"><strong>' + A.fmt(res.total, dec) + '</strong>' + esc(Tl.sSum) + ' (' + u + ')</div>' +
      '<div class="stat"><strong>' + A.fmt(max.pct, 2) + ' %</strong>' + esc(Tl.sMax) + ' · ' + esc(max.fastighet) + '</div>' +
      (res.amountOre && res.total > 0 ? '<div class="stat"><strong>' + A.fmt(res.amountOre / 100 / res.total, 4, true) + '</strong>' + esc(Tl.sPer + u) + '</div>' : '');
    var fl = res.warnings.map(function (w) { return Tl.w[w.code] ? Tl.w[w.code](w) : w.code; });
    $('#flags').hidden = !fl.length; $('#flags').innerHTML = fl.length ? '<strong>' + esc(Tl.flagsH) + '</strong><ul>' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' : '';
    var kr = !!res.amountOre;
    $('#res-t thead').innerHTML = '<tr><th>' + esc(Tl.hFast) + '</th><th>' + esc(Tl.hAgare) + '</th><th class="f">' + esc(Tl.hBas) + '</th><th class="num">' + esc(Tl.hAndel) + ' (' + u + ')</th><th class="num">' + esc(Tl.hPct) + '</th>' + (kr ? '<th class="num">' + esc(Tl.hKr) + '</th>' : '') + '</tr>';
    $('#res-t tbody').innerHTML = res.props.map(function (p) {
      return '<tr><td>' + esc(p.fastighet) + '</td><td>' + esc(p.agare) + '</td><td class="f">' + p.rows.map(function (d) { return basis(d, res.opts); }).join('<br>') + (p.raised ? ' <span class="tag">' + esc(Tl.raised) + '</span>' : '') + '</td>' +
        '<td class="num">' + A.fmt(p.andelstal, dec) + '</td><td class="num">' + A.fmt(p.pct, 2) + '</td>' + (kr ? '<td class="num">' + A.fmt(p.ore / 100, 2) + '</td>' : '') + '</tr>';
    }).join('');
    $('#res-t tfoot').innerHTML = '<tr><td>' + esc(Tl.sum) + '</td><td></td><td class="f"></td><td class="num">' + A.fmt(res.total, dec) + '</td><td class="num">' + A.fmt(res.sumPct, 2) + '</td>' + (kr ? '<td class="num">' + A.fmt(res.amountOre / 100, 2) + '</td>' : '') + '</tr>';
  }

  // ---------- export ----------
  function download(bytes, name, type) {
    var a = document.createElement('a'), url = URL.createObjectURL(new Blob([bytes], { type: type || 'application/octet-stream' }));
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var msg = function (m) { $('#dl-msg').textContent = m; };
  $('#dl-csv').addEventListener('click', function () { if (!st.res || !st.res.props.length) return; download('\uFEFF' + A.toCsv(st.res), 'andelstal-vagforening.csv', 'text/csv;charset=utf-8'); msg(t('csvOk')); });
  $('#dl-xlsx').addEventListener('click', function () {
    if (!st.res || !st.res.props.length) return;
    window.XLSXW.build(A.sheets(st.res, st.cats, { title: (st.title || 'Andelstal') + ' – andelstal (tonkilometermetoden)' }), { title: 'Andelstal', creator: 'Andelstal för vägförening' })
      .then(function (b) { download(b, 'andelstal-vagforening.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); msg(t('xlsxOk')); })
      .catch(function (e) { msg(String(e && e.message || e)); });
  });
  $('#copy').addEventListener('click', function () {
    if (!st.res || !st.res.props.length) return; var txt = A.toTsv(st.res);
    var fallback = function () { var ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove(); msg(ok ? t('copied') : t('copyErr')); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(function () { msg(t('copied')); }, fallback); else fallback();
  });

  // ---------- i18n ----------
  var SV = {}; document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  function setLang(l) {
    lang = l; var D = l === 'en' ? EN : SV; document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n]) el.innerHTML = D[el.dataset.i18n]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English';
    renderCats(); renderRows();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });

  // ---------- start ----------
  if (!load() || !st.rows.length) st.rows = [blank()];
  renderCats(); renderRows();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
})();
