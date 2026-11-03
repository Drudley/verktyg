/* Styrelsearvode i förening – UI. Everything runs in the browser; nothing is uploaded. Free page (no paywall).
 * Inputs are autosaved in localStorage (APP_CONFIG.STORAGE_KEY). */
(function () {
  'use strict';
  var CFG = window.APP_CONFIG, S = window.STYRELSE, lang = 'sv', last = null, rows = [];
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MAX = 40;
  var blank = function (role) { role = role || 'ledamot'; return { name: '', role: role, birthYear: '', w: String(S.ROLES[role].w).replace('.', ','), arvode: '', earlier: '', mainIncome: false, tableTax: '' }; };
  var SAMPLE = { date: '2026-05-29', type: 'brf', registered: true, total: '', pbb: '1', basis: 'arvode', people: [
    { name: 'Anna', role: 'ordf', birthYear: '1971' }, { name: 'Bengt', role: 'kassor', birthYear: '1955' }, { name: 'Cecilia', role: 'sekr', birthYear: '1988' },
    { name: 'David', role: 'ledamot', birthYear: '2005' }, { name: 'Eva', role: 'ledamot', birthYear: '1980' }, { name: 'Fredrik', role: 'suppl', birthYear: '1990', w: '0,1' }] };

  var EN = {
    h1: 'Board fees in a Swedish association – tax, employer contributions and the employer declaration',
    lead: 'For the treasurer of a <strong>non-profit association, sports club, housing co-op (BRF) or joint property association</strong>: split the fee the annual meeting decided, and see per person whether the <strong>SEK 1,000 threshold</strong> is passed, how much <strong>tax</strong> to withhold, which <strong>employer contribution</strong> the association pays and what goes into <strong>fields 011, 131, 001 and 023</strong> – plus the payment deadline.',
    free: 'Free – no account, no upload, no tracking.',
    'cta-h': 'Treasurer of a samfällighetsförening?', 'cta-p': 'Do this year’s levy in <a href="../debiteringslangd-samfallighet/">Debiteringslängd & invoices</a> – shares per activity, exact rounding and invoices with OCR and Swish QR. The board fee and contributions go into the budget as a cost.',
    'calc-h': 'The payment', sample: 'Show example', clear: 'Clear', 'l-date': 'Payment date', 'l-type': 'Type of association',
    't-ideell': 'Non-profit association (ideell förening)', 't-idrott': 'Sports club (idrottsförening)', 't-brf': 'Housing co-op (BRF)', 't-samf': 'Joint property / road association', 't-ek': 'Other economic association',
    'l-registered': 'The association is registered as an employer', 'split-h': 'Split a total (optional)', 'l-total': 'Total, SEK', 'l-pbb': '… or number of price base amounts',
    'b-arvode': 'the amount is the fee', 'b-budget': 'the amount is the budget incl. employer contributions', distribute: 'Split by weight',
    'split-hint': 'Fills the “Fee now” column by weight – the sum is exactly the total. Default weights: chair 3, treasurer 2, secretary 1.5, member 1, deputy 0.5.',
    'c-name': 'Name', 'c-role': 'Role', 'c-born': 'Born (year)', 'c-w': 'Weight', 'c-arvode': 'Fee now, SEK', 'c-earlier': 'Earlier this year, SEK', 'c-main': 'Main income', 'c-tax': 'Tax per table, SEK', add: '+ Add person',
    hint: '“Earlier this year” = fees or other pay for work the association already paid the person this calendar year (for the SEK 1,000 threshold). Tick “Main income” only if the fee is the person’s main income – then tax is withheld per the tax table instead of 30 %. Do not enter personal ID numbers here.',
    saved: 'Your inputs are saved automatically in this browser.',
    'cta2-h': 'Next step for the samfällighet: the levy', 'cta2-p': 'The fee and the contributions are a cost in the budget the annual meeting adopts – and are levied on the members by share. <strong>Debiteringslängd & invoices</strong> splits the levy per activity with exact rounding and writes the debiteringslängd (§ 42) and invoices with OCR and Swish QR.',
    'cta2-go': 'Open Debiteringslängd →', 'cta2-and': 'Road association shares (free)', foot: 'Free tool. Your data stays in your browser. Nothing here is tax advice.'
  };
  var T = {
    sv: { title: 'Resultat', must: function (d) { return 'Redovisa i arbetsgivardeklarationen och betala senast ' + d; }, mustReg: 'Föreningen är inte registrerad som arbetsgivare – registrera den (SKV 4620) innan utbetalningen.',
      none: 'Ingen skatt och ingen arbetsgivaravgift för den här utbetalningen.', noneAgi: function (d) { return 'Ingen skatt och ingen avgift – lämna ändå uppgifterna i arbetsgivardeklarationen (fält 131) senast ' + d; },
      sArv: 'Arvoden', sSkatt: 'Avdragen skatt', sAvg: 'Arbetsgivaravgifter', sSkv: 'Till skattekontot', sNet: 'Netto till mottagarna', sCost: 'Föreningens kostnad', sDl: 'Sista dag', moved: function (n) { return 'flyttad från ' + n; },
      resH: 'Per person', h: ['Namn', 'Uppdrag', 'Arvode', 'Skatt', 'Netto', 'Avgift', 'Kostnad', '011', '131', '010', '001', '023'], sum: 'Summa',
      mode: { free: 'avgiftsfri', normal: 'skatt + avgift', cross: 'gränsen passeras' }, rate: { full: '31,42 %', old: '10,21 %', youth: '20,81 %', none: '0 %' },
      fieldsP: 'Fälten i individuppgiften för varje mottagare i e-tjänsten Arbetsgivardeklaration (eller SKV 4788): 011 Kontant bruttolön, 131 Kontant ersättning (inte underlag för avgifter), 010 Avräkning från avgiftsfri ersättning, 001 Avdragen preliminärskatt, 023 Del av ersättningen som är styrelsearvode.',
      huvudH: 'Arbetsgivaravgifter (huvuduppgift)', huvudP: 'E-tjänsten räknar avgiften på summan per procentsats, så den kan skilja en krona från summan per person.',
      hu: { full: function (b) { return 'Underlag ' + b + ' × 31,42 %'; }, old: function (b) { return 'Underlag ' + b + ' × 10,21 % (ålderspensionsavgift)'; }, youth: function (b) { return 'Underlag ' + b + ' × 20,81 % (19–23 år, högst 25 000 kr/mån)'; },
        avg: 'Summa arbetsgivaravgifter', skatt: 'Summa avdragen skatt (fält 001)', tot: 'Att betala till föreningens skattekonto' },
      kuH: 'Alternativ: kontrolluppgift KU10', kuP: function (y) { return 'Ingen ska ha skatt eller avgift. Är föreningen inte registrerad som arbetsgivare lämnar ni i stället KU10 per mottagare med årets belopp – senast 31 januari ' + (y + 1) + '. Fält 031 Ersättningar som inte är underlag för socialavgifter, 023 Styrelsearvode.'; },
      bH: 'Utbetalningsbesked – arvode', bFrom: 'Utbetalare', bTo: 'Mottagare', bDate: 'Utbetalningsdag', bRole: 'Uppdrag', bArv: 'Arvode', bSkatt: 'Avdragen preliminärskatt', bNet: 'Utbetalt', bAvg: 'Arbetsgivaravgift som föreningen betalar', bAssoc: 'Föreningen',
      proto: function (n) { return 'Arvode ' + n.year + ', utbetalning ' + n.date + ': totalt ' + n.arv + ' kr' + (n.pbb ? ' (' + n.pbb + ' prisbasbelopp à ' + n.pbbKr + ' kr)' : '') + '\nFördelning:\n' + n.list + '\nArbetsgivaravgifter: ' + n.avg + ' kr\nFöreningens totala kostnad: ' + n.cost + ' kr\nAvdragen skatt som föreningen betalar in för mottagarna: ' + n.skatt + ' kr' + (n.dl ? '\nArbetsgivardeklaration och betalning senast ' + n.dl + '.' : ''); },
      w: { register: 'Föreningen ska dra skatt eller betala avgift men är inte markerad som registrerad arbetsgivare. Registrera den hos Skatteverket (SKV 4620) innan första utbetalningen.',
        'ku-option': 'Ingen passerar gränsen. Uppgifterna lämnas antingen i arbetsgivardeklarationen (fält 131) eller på KU10 i januari – inte i båda.',
        prelim: function (x) { return x.year + ': procentsatser och födelseår är preliminära (2026 års regler flyttade ett år). Prisbasbeloppet 59 600 kr är fastställt.'; },
        ore: function (x) { return who(x) + 'ören stryks – arbetsgivardeklarationen fylls i med hela kronor.'; },
        'idrott-styrelse': function (x) { return who(x) + 'styrelseuppdrag omfattas inte av idrottsersättningen – 1 000-kronorsgränsen gäller.'; },
        cross: function (x) { return who(x) + 'året passerar ' + S.fmt(x.limit) + ' kr. Tidigare ' + S.fmt(x.earlier) + ' kr ingår nu i fält 011 och dras av i fält 010. Skatt kan bara dras på det som betalas ut nu – den tidigare delen kommer med i mottagarens deklaration. Du kan i stället rätta de tidigare månaderna.'; },
        'table-missing': function (x) { return who(x) + 'huvudinkomst – skriv in skatten enligt mottagarens skattetabell (eller jämkningsbeslut).'; },
        below: function (x) { return who(x) + 'under 1 000 kr i år – ingen skatt och ingen avgift, men uppgiften ska lämnas (fält 131 eller KU10 031). Mottagaren deklarerar själv.'; },
        'idrott-free': function (x) { return who(x) + 'idrottsersättning under ' + S.fmt(x.limit) + ' kr (ett halvt prisbasbelopp) – ingen skatt och ingen avgift. Uppgiften lämnas i fält 131 eller på KU10 031.'; },
        'below-100': function (x) { return who(x) + 'under 100 kr i år – behöver inte redovisas.'; } },
      err: { date: 'Fyll i utbetalningsdagen.', year: function (x) { return 'Kalkylatorn har regler för 2025–2027, inte ' + x.year + '.'; }, birth: function (x) { return 'Rad ' + (x.row + 1) + ': fyll i födelseår med fyra siffror.'; },
        num: function (x) { return 'Rad ' + (x.row + 1) + ': beloppet går inte att läsa som ett tal.'; }, empty: 'Lägg till minst en person.' },
      flagsH: 'Att tänka på', empty: 'Fyll i utbetalningsdag, födelseår och arvode för att se resultatet.', distErr: 'Fyll i ett totalbelopp eller antal prisbasbelopp och en utbetalningsdag 2025–2027.', distOk: function (n) { return 'Fördelat: ' + n + ' kr.'; },
      copied: 'Kopierat – klistra in där du vill.', copyErr: 'Kunde inte kopiera automatiskt.', sampleOk: 'Exempel inläst: en BRF betalar ut ett prisbasbelopp (59 200 kr) till sex personer i maj 2026 – syntetiska namn.', cleared: 'Uppgifterna är rensade.', full: 'Högst ' + MAX + ' personer.',
      del: 'Ta bort', row: 'Rad', mon: ['januari', 'februari', 'mars', 'april', 'maj', 'juni', 'juli', 'augusti', 'september', 'oktober', 'november', 'december'] },
    en: { title: 'Result', must: function (d) { return 'Report in the employer declaration and pay by ' + d; }, mustReg: 'The association is not registered as an employer – register it (SKV 4620) before paying.',
      none: 'No tax and no employer contributions for this payment.', noneAgi: function (d) { return 'No tax and no contributions – still report the amounts in the employer declaration (field 131) by ' + d; },
      sArv: 'Fees', sSkatt: 'Tax withheld', sAvg: 'Employer contributions', sSkv: 'To the tax account', sNet: 'Net to recipients', sCost: 'Cost for the association', sDl: 'Deadline', moved: function (n) { return 'moved from ' + n; },
      resH: 'Per person', h: ['Name', 'Role', 'Fee', 'Tax', 'Net', 'Contrib.', 'Cost', '011', '131', '010', '001', '023'], sum: 'Total',
      mode: { free: 'contribution-free', normal: 'tax + contributions', cross: 'threshold passed' }, rate: { full: '31.42 %', old: '10.21 %', youth: '20.81 %', none: '0 %' },
      fieldsP: 'Fields in each recipient’s individual return in the Arbetsgivardeklaration e-service (or SKV 4788): 011 cash gross pay, 131 cash pay (not basis for contributions), 010 offset of contribution-free pay, 001 preliminary tax withheld, 023 part of pay that is a board fee.',
      huvudH: 'Employer contributions (main return)', huvudP: 'The e-service computes contributions on the total per rate, so it may differ by one krona from the per-person sum.',
      hu: { full: function (b) { return 'Basis ' + b + ' × 31.42 %'; }, old: function (b) { return 'Basis ' + b + ' × 10.21 % (old-age pension contribution)'; }, youth: function (b) { return 'Basis ' + b + ' × 20.81 % (age 19–23, max SEK 25,000/month)'; },
        avg: 'Total employer contributions', skatt: 'Total tax withheld (field 001)', tot: 'To pay to the association’s tax account' },
      kuH: 'Alternative: income statement KU10', kuP: function (y) { return 'Nobody has tax or contributions. If the association is not a registered employer, file KU10 per recipient with the year’s amount instead – by 31 January ' + (y + 1) + '. Field 031 pay not subject to social fees, 023 board fee.'; },
      bH: 'Payment statement – fee', bFrom: 'Payer', bTo: 'Recipient', bDate: 'Payment date', bRole: 'Role', bArv: 'Fee', bSkatt: 'Preliminary tax withheld', bNet: 'Paid out', bAvg: 'Employer contributions paid by the association', bAssoc: 'The association',
      proto: function (n) { return 'Fees ' + n.year + ', paid ' + n.date + ': total SEK ' + n.arv + (n.pbb ? ' (' + n.pbb + ' price base amounts of SEK ' + n.pbbKr + ')' : '') + '\nSplit:\n' + n.list + '\nEmployer contributions: SEK ' + n.avg + '\nTotal cost for the association: SEK ' + n.cost + '\nTax withheld and paid in for the recipients: SEK ' + n.skatt + (n.dl ? '\nEmployer declaration and payment by ' + n.dl + '.' : ''); },
      w: { register: 'The association must withhold tax or pay contributions but is not marked as a registered employer. Register with Skatteverket (SKV 4620) before the first payment.',
        'ku-option': 'Nobody passes the threshold. Report either in the employer declaration (field 131) or on KU10 in January – not both.',
        prelim: function (x) { return x.year + ': rates and birth years are preliminary (2026 rules shifted one year). The price base amount SEK 59,600 is set.'; },
        ore: function (x) { return who(x) + 'öre are dropped – the declaration uses whole kronor.'; },
        'idrott-styrelse': function (x) { return who(x) + 'board roles are not covered by the sports allowance – the SEK 1,000 threshold applies.'; },
        cross: function (x) { return who(x) + 'the year passes SEK ' + S.fmt(x.limit) + '. The earlier SEK ' + S.fmt(x.earlier) + ' is now included in field 011 and offset in field 010. Tax can only be withheld on what is paid now. You may instead correct the earlier months.'; },
        'table-missing': function (x) { return who(x) + 'main income – enter the tax per the recipient’s tax table (or adjustment decision).'; },
        below: function (x) { return who(x) + 'below SEK 1,000 this year – no tax and no contributions, but report it (field 131 or KU10 031). The recipient declares it.'; },
        'idrott-free': function (x) { return who(x) + 'sports allowance below SEK ' + S.fmt(x.limit) + ' (half a price base amount) – no tax, no contributions. Report in field 131 or KU10 031.'; },
        'below-100': function (x) { return who(x) + 'below SEK 100 this year – no need to report.'; } },
      err: { date: 'Enter the payment date.', year: function (x) { return 'The calculator has rules for 2025–2027, not ' + x.year + '.'; }, birth: function (x) { return 'Row ' + (x.row + 1) + ': enter the year of birth (four digits).'; },
        num: function (x) { return 'Row ' + (x.row + 1) + ': the amount is not a number.'; }, empty: 'Add at least one person.' },
      flagsH: 'Please note', empty: 'Enter payment date, year of birth and fee to see the result.', distErr: 'Enter a total or a number of price base amounts and a payment date in 2025–2027.', distOk: function (n) { return 'Split: SEK ' + n + '.'; },
      copied: 'Copied – paste wherever you need it.', copyErr: 'Could not copy automatically.', sampleOk: 'Example loaded: a BRF pays one price base amount (SEK 59,200) to six people in May 2026 – synthetic names.', cleared: 'Inputs cleared.', full: 'At most ' + MAX + ' people.',
      del: 'Remove', row: 'Row', mon: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] }
  };
  var shown = [];
  function who(x) { var r = shown[x.row]; return r ? (r.name || (t('row') + ' ' + (x.row + 1))) + ': ' : ''; }
  function t(k) { return T[lang][k]; }
  function status(m, err) { var s = $('#status'); s.textContent = m || ''; s.className = 'status' + (err ? ' err' : ''); }
  function fmtDate(iso) { var p = iso.split('-'); return (+p[2]) + ' ' + t('mon')[+p[1] - 1] + ' ' + p[0]; }
  function roleName(k) { return S.ROLES[k][lang]; }

  /* ---------- people table (inputs) ---------- */
  var COLS = [['name', 'text', 'w-name'], ['role', 'select', 'w-role'], ['birthYear', 'text', 'w-y'], ['w', 'text', 'w-s'], ['arvode', 'text', 'w-n'], ['earlier', 'text', 'w-n'], ['mainIncome', 'chk', ''], ['tableTax', 'text', 'w-n']];
  function drawRows() {
    var H = EN, lab = lang === 'en' ? [H['c-name'], H['c-role'], H['c-born'], H['c-w'], H['c-arvode'], H['c-earlier'], H['c-main'], H['c-tax']] : ['Namn', 'Uppdrag', 'Född (år)', 'Vikt', 'Arvode nu, kr', 'Tidigare i år, kr', 'Huvudinkomst', 'Skatt enl. tabell, kr'];
    $('#people tbody').innerHTML = rows.map(function (r, i) {
      return '<tr data-i="' + i + '">' + COLS.map(function (c, j) {
        var k = c[0], cell;
        if (c[1] === 'select') cell = '<select data-k="role" aria-label="' + esc(lab[j]) + '">' + Object.keys(S.ROLES).map(function (rk) { return '<option value="' + rk + '"' + (r.role === rk ? ' selected' : '') + '>' + esc(roleName(rk)) + '</option>'; }).join('') + '</select>';
        else if (c[1] === 'chk') cell = '<input type="checkbox" data-k="mainIncome" aria-label="' + esc(lab[j]) + '"' + (r.mainIncome ? ' checked' : '') + '>';
        else cell = '<input type="text" class="' + c[2] + '" data-k="' + k + '" aria-label="' + esc(lab[j]) + '" value="' + esc(r[k]) + '"' + (k === 'name' ? '' : ' inputmode="decimal"') + (k === 'tableTax' && !r.mainIncome ? ' disabled' : '') + '>';
        return '<td data-l="' + esc(lab[j]) + '"' + (c[1] === 'chk' ? ' class="c"' : '') + '>' + cell + '</td>';
      }).join('') + '<td><button class="del" type="button" data-del="' + i + '" aria-label="' + esc(t('del')) + '" title="' + esc(t('del')) + '">×</button></td></tr>';
    }).join('');
  }
  $('#people').addEventListener('input', function (e) { var tr = e.target.closest('tr[data-i]'); if (!tr || !e.target.dataset.k) return; var r = rows[+tr.dataset.i], k = e.target.dataset.k;
    if (k === 'mainIncome') { r.mainIncome = e.target.checked; tr.querySelector('[data-k=tableTax]').disabled = !r.mainIncome; }
    else if (k === 'role') { r.role = e.target.value; r.w = String(S.ROLES[r.role].w).replace('.', ','); tr.querySelector('[data-k=w]').value = r.w; }
    else r[k] = e.target.value; });
  $('#people').addEventListener('click', function (e) { var b = e.target.closest('[data-del]'); if (!b) return; rows.splice(+b.dataset.del, 1); if (!rows.length) rows.push(blank()); drawRows(); save(); render(); });
  $('#add').addEventListener('click', function () { if (rows.length >= MAX) return status(t('full'), true); rows.push(blank()); drawRows(); save(); render(); var ins = document.querySelectorAll('#people tbody tr:last-child input'); if (ins[0]) ins[0].focus(); });

  /* ---------- state ---------- */
  function readG() { return { date: $('#f-date').value, type: $('#f-type').value, registered: $('#f-registered').checked, total: $('#f-total').value, pbb: $('#f-pbb').value, basis: (document.querySelector('input[name=basis]:checked') || {}).value || 'arvode' }; }
  function writeG(v) { $('#f-date').value = v.date || ''; $('#f-type').value = S.TYPES.indexOf(v.type) >= 0 ? v.type : 'ideell'; $('#f-registered').checked = !!v.registered; $('#f-total').value = v.total || ''; $('#f-pbb').value = v.pbb || '';
    document.querySelectorAll('input[name=basis]').forEach(function (r) { r.checked = r.value === (v.basis || 'arvode'); }); }
  function save() { try { localStorage.setItem(CFG.STORAGE_KEY, JSON.stringify({ v: 1, g: readG(), rows: rows })); } catch (e) { /* ignore */ } }
  function load() { var d; try { d = JSON.parse(localStorage.getItem(CFG.STORAGE_KEY) || 'null'); } catch (e) { d = null; }
    if (d && d.v === 1 && d.g && Array.isArray(d.rows) && d.rows.length) { writeG(d.g); rows = d.rows.slice(0, MAX).map(function (r) { var b = blank(S.ROLES[r.role] ? r.role : 'ledamot'); Object.keys(b).forEach(function (k) { if (r[k] != null) b[k] = r[k]; }); return b; }); return true; } return false; }

  function distribute() {
    var g = readG(), y = +String(g.date).slice(0, 4), total = S.num(g.total), pbb = S.num(g.pbb);
    if (!(total > 0) && pbb > 0 && S.PBB[y]) total = Math.round(pbb * S.PBB[y]);
    if (!(total > 0) || !S.PBB[y]) { status(t('distErr'), true); return false; }
    var ws = rows.map(function (r) { var w = S.num(r.w); return w > 0 ? w : 0; });
    var a = g.basis === 'budget' ? S.fromBudget(total, ws, rows.map(function (r) { return r.birthYear; }), g.date) : S.distribute(total, ws);
    rows.forEach(function (r, i) { r.arvode = ws[i] > 0 ? String(a[i]) : r.arvode; });
    drawRows(); save(); render(); status(t('distOk')(S.fmt(total))); return true;
  }

  /* ---------- results ---------- */
  function compute() {
    var g = readG(); shown = rows.filter(function (r) { return String(r.arvode).trim() !== '' || String(r.name).trim() !== '' || String(r.birthYear).trim() !== ''; });
    return S.compute({ payDate: g.date, type: g.type, registered: g.registered, people: shown });
  }
  function msg(m, x) { return typeof m === 'function' ? m(x) : m; }
  function render() {
    var g = readG(), Tl = T[lang];
    document.querySelectorAll('#people input').forEach(function (e) { e.classList.remove('bad'); });
    var any = rows.some(function (r) { return String(r.arvode).trim() !== ''; });
    if (!g.date || !any) { $('#result').hidden = true; last = null; status(g.date || any ? Tl.empty : ''); return; }
    var r = compute(); last = r;
    if (!r.ok) {
      $('#result').hidden = true;
      r.errors.forEach(function (e) { if (e.row == null) return; var idx = rows.indexOf(shown[e.row]), tr = document.querySelector('#people tr[data-i="' + idx + '"]'); if (!tr) return;
        var el = tr.querySelector('[data-k="' + (e.code === 'birth' ? 'birthYear' : e.field) + '"]'); if (el) el.classList.add('bad'); });
      status(r.errors.map(function (e) { return msg(Tl.err[e.code], e); }).join(' '), true); return;
    }
    if ($('#status').classList.contains('err')) status('');
    $('#result').hidden = false;
    var dl = fmtDate(r.deadline.date) + (r.deadline.moved ? ' (' + Tl.moved(fmtDate(r.deadline.nominal)) + ')' : '');
    $('#r-title').textContent = Tl.title + ' – ' + t('mon')[r.month - 1] + ' ' + r.year;
    var chk = $('#check');
    if (r.anyTaxed) { chk.textContent = Tl.must(dl) + (g.registered ? '' : ' · ' + Tl.mustReg); chk.className = 'check deadline ' + (g.registered ? 'ok' : 'err'); }
    else if (r.mustFileAgi) { chk.textContent = Tl.noneAgi(dl); chk.className = 'check ok'; }
    else { chk.textContent = Tl.none; chk.className = 'check ok'; }
    var T0 = r.totals, st = [[Tl.sArv, T0.arvode], [Tl.sSkatt, T0.skatt], [Tl.sAvg, T0.avgift], [Tl.sSkv, T0.toSkatteverket], [Tl.sNet, T0.net], [Tl.sCost, T0.cost]];
    $('#stats').innerHTML = st.map(function (s, i) { return '<div class="stat" data-s="' + i + '"><span class="muted small">' + esc(s[0]) + '</span><strong>' + S.fmt(s[1]) + ' kr</strong></div>'; }).join('') +
      (r.mustFileAgi ? '<div class="stat"><span class="muted small">' + esc(Tl.sDl) + '</span><strong id="s-dl">' + esc(fmtDate(r.deadline.date)) + '</strong></div>' : '');
    var fl = $('#flags');
    if (r.warnings.length) { fl.hidden = false; fl.innerHTML = '<strong>' + esc(Tl.flagsH) + '</strong><ul>' + r.warnings.map(function (w) { return '<li data-w="' + esc(w.code) + '">' + esc(msg(Tl.w[w.code], w)) + '</li>'; }).join('') + '</ul>'; }
    else { fl.hidden = true; fl.innerHTML = ''; }
    // per person
    $('#res-h').textContent = Tl.resH;
    var H = Tl.h, F = function (n) { return n ? S.fmt(n) : '–'; };
    $('#res-t thead').innerHTML = '<tr>' + H.map(function (h, i) { return '<th' + (i > 1 ? ' class="num"' : '') + '>' + esc(h) + '</th>'; }).join('') + '</tr>';
    $('#res-t tbody').innerHTML = r.people.map(function (p) {
      return '<tr class="' + p.mode + '" data-p="' + p.idx + '"><td>' + esc(p.name || '–') + '</td><td>' + esc(roleName(p.role)) + ' <span class="mode ' + p.mode + '">' + esc(Tl.mode[p.mode]) + '</span></td>' +
        [p.arvode, p.skatt, p.net].map(function (v) { return '<td class="f">' + S.fmt(v) + '</td>'; }).join('') +
        '<td class="f">' + S.fmt(p.avgift) + ' <span class="muted small">(' + (p.mode === 'free' ? '0 %' : Tl.rate[p.category]) + ')</span></td><td class="f">' + S.fmt(p.cost) + '</td>' +
        ['011', '131', '010', '001', '023'].map(function (k) { return '<td class="f" data-f="' + k + '">' + F(p.agi[k]) + '</td>'; }).join('') + '</tr>';
    }).join('');
    var sumF = function (k) { return r.people.reduce(function (a, p) { return a + p.agi[k]; }, 0); };
    $('#res-t tfoot').innerHTML = '<tr><td colspan="2">' + esc(Tl.sum) + '</td><td class="f">' + S.fmt(T0.arvode) + '</td><td class="f">' + S.fmt(T0.skatt) + '</td><td class="f">' + S.fmt(T0.net) + '</td><td class="f">' + S.fmt(T0.avgiftPerPerson) + '</td><td class="f">' + S.fmt(T0.arvode + T0.avgiftPerPerson) + '</td>' +
      ['011', '131', '010', '001', '023'].map(function (k) { return '<td class="f">' + F(sumF(k)) + '</td>'; }).join('') + '</tr><tr><td colspan="12" class="small muted fn">' + esc(Tl.fieldsP) + '</td></tr>';
    // huvuduppgift
    $('#huvud-h').textContent = Tl.huvudH; $('#huvud-p').textContent = Tl.huvudP;
    var U = T0.underlag, A = T0.avgHuvud, hl = [];
    ['full', 'old', 'youth'].forEach(function (k) { if (U[k]) hl.push([Tl.hu[k](S.fmt(U[k]) + ' kr'), A[k], k]); });
    hl.push([Tl.hu.avg, T0.avgift, 'avg', 1], [Tl.hu.skatt, T0.skatt, 'skatt'], [Tl.hu.tot, T0.toSkatteverket, 'tot', 1]);
    $('#huvud-t tbody').innerHTML = hl.map(function (l) { return '<tr data-h="' + l[2] + '"><td>' + (l[3] ? '<strong>' + esc(l[0]) + '</strong>' : esc(l[0])) + '</td><td class="num">' + (l[3] ? '<strong>' + S.fmt(l[1]) + ' kr</strong>' : S.fmt(l[1]) + ' kr') + '</td></tr>'; }).join('');
    // KU alternative
    var showKu = !r.anyTaxed && !g.registered && r.people.some(function (p) { return p.report && p.arvode > 0; });
    $('#ku').hidden = !showKu;
    if (showKu) { $('#ku-h').textContent = Tl.kuH; $('#ku-p').textContent = Tl.kuP(r.year);
      $('#ku-t tbody').innerHTML = '<tr><th>' + esc(H[0]) + '</th><th class="num">031</th><th class="num">023</th></tr>' + r.people.filter(function (p) { return p.report; }).map(function (p) { return '<tr><td>' + esc(p.name || roleName(p.role)) + '</td><td class="num">' + S.fmt(p.ku['031']) + '</td><td class="num">' + F(p.ku['023']) + '</td></tr>'; }).join(''); }
    // beskeds (print only)
    $('#beskeds').innerHTML = r.people.filter(function (p) { return p.arvode > 0; }).map(function (p) {
      return '<div class="besked printonly"><h3>' + esc(Tl.bH) + '</h3><p class="small">' + esc(Tl.bFrom) + ': <strong>' + esc(Tl.bAssoc) + '</strong> · ' + esc(Tl.bTo) + ': <strong>' + esc(p.name || '……………………') + '</strong> · ' + esc(Tl.bRole) + ': ' + esc(roleName(p.role)) + ' · ' + esc(Tl.bDate) + ': <strong>' + esc(r.payDate) + '</strong></p>' +
        '<table><tbody><tr><td>' + esc(Tl.bArv) + '</td><td class="num">' + S.fmt(p.arvode) + ' kr</td></tr><tr><td>' + esc(Tl.bSkatt) + '</td><td class="num">' + (p.skatt ? '−' : '') + S.fmt(p.skatt) + ' kr</td></tr><tr><td><strong>' + esc(Tl.bNet) + '</strong></td><td class="num"><strong>' + S.fmt(p.net) + ' kr</strong></td></tr></tbody></table>' +
        '<p class="small muted">' + esc(Tl.bAvg) + ': ' + S.fmt(p.avgift) + ' kr.</p></div>';
    }).join('');
    // protocol text
    var y = r.year, pbbN = S.num(g.pbb), totalIn = S.num(g.total);
    $('#proto-h').textContent = lang === 'en' ? 'Text for the budget or meeting minutes' : 'Text till budget eller stämmoprotokoll';
    $('#proto').textContent = Tl.proto({ year: y, date: r.payDate, arv: S.fmt(T0.arvode), pbb: (!(totalIn > 0) && pbbN > 0 && g.basis === 'arvode' && Math.round(pbbN * S.PBB[y]) === T0.arvode) ? String(g.pbb).trim() : '', pbbKr: S.fmt(S.PBB[y] || 0),
      list: r.people.map(function (p) { return '  ' + roleName(p.role) + (p.name ? ' ' + p.name : '') + ': ' + S.fmt(p.arvode) + (lang === 'en' ? ' SEK' : ' kr'); }).join('\n'),
      avg: S.fmt(T0.avgift), cost: S.fmt(T0.cost), skatt: S.fmt(T0.skatt), dl: r.mustFileAgi ? fmtDate(r.deadline.date) : '' });
  }
  function copy(text) {
    var ok = function () { $('#dl-msg').textContent = t('copied'); }, bad = function () { $('#dl-msg').textContent = t('copyErr'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, bad); else bad();
  }
  function tableTsv() { var out = [t('h').join('\t')];
    document.querySelectorAll('#res-t tbody tr').forEach(function (tr) { var c = tr.querySelectorAll('td'); var a = []; c.forEach(function (td, i) { var s = i === 1 ? td.firstChild.textContent.trim() : td.textContent; if (i > 1) s = s.replace(/\(.*\)/, '').replace(/[\s\u00a0]/g, '').replace('–', '0'); a.push(s.trim()); }); out.push(a.join('\t')); });
    return out.join('\n'); }

  var SV = {}; document.querySelectorAll('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
  var BTN = { sv: { print: 'Skriv ut underlag', copy: 'Kopiera tabellen', 'copy-proto': 'Kopiera texten' }, en: { print: 'Print statements', copy: 'Copy the table', 'copy-proto': 'Copy the text' } };
  function setLang(l) {
    lang = l; var Dd = l === 'en' ? EN : SV; document.documentElement.lang = l;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { if (Dd[el.dataset.i18n]) el.innerHTML = Dd[el.dataset.i18n]; });
    Object.keys(BTN[l]).forEach(function (id) { $('#' + id).textContent = BTN[l][id]; });
    $('#lang').textContent = l === 'en' ? 'Svenska' : 'English'; drawRows(); render();
  }
  $('#lang').addEventListener('click', function () { setLang(lang === 'en' ? 'sv' : 'en'); });
  $('#calc').addEventListener('input', function (e) { if (e.target.closest('.split')) { save(); return; } save(); render(); });
  $('#calc').addEventListener('change', function (e) { if (e.target.closest('.split')) { save(); return; } save(); render(); });
  $('#distribute').addEventListener('click', distribute);
  $('#sample').addEventListener('click', function () {
    writeG(SAMPLE); rows = SAMPLE.people.map(function (p) { var b = blank(p.role); Object.keys(p).forEach(function (k) { b[k] = p[k]; }); return b; });
    drawRows(); distribute(); status(t('sampleOk')); $('#result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  $('#clear').addEventListener('click', function () { writeG({}); rows = [blank('ordf'), blank('kassor'), blank('ledamot')]; drawRows(); try { localStorage.removeItem(CFG.STORAGE_KEY); } catch (e) { /* ignore */ } render(); status(t('cleared')); });
  $('#print').addEventListener('click', function () { window.print(); });
  $('#copy').addEventListener('click', function () { copy(tableTsv()); });
  $('#copy-proto').addEventListener('click', function () { copy($('#proto').textContent); });
  if (!load()) rows = [blank('ordf'), blank('kassor'), blank('ledamot')];
  drawRows(); render();
  if (/[?&]lang=en\b/.test(location.search)) setLang('en');
  window.STYRELSE_APP = { compute: function () { return last; }, rows: function () { return rows; } };
})();
