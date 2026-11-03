/* Styrelsearvode och andra arvoden i förening – skatteavdrag, arbetsgivaravgift, AGI-fält och fördelning.
 * Pure functions, no DOM. Sources (checked 2026-11-03, saved in research/sources/styrelsearvode/): Skatteverket "Betala ut ersättning i en ideell förening",
 * "Skatteavdrag med 30 procent", "Arbetsgivaravgifter" (2026 rates, youth reduction 2026-04-01..2027-09-30), Skatteverket/SvPF "Idrottsföreningen betalar ut
 * ersättning" (AGI examples incl. fält 010 avräkning), SFS 2026:1779 (prisbasbelopp 2027). Whole kronor; öre dropped (floor). */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.STYRELSE = factory(); })(this, function () {
  'use strict';
  var TAX = 0.30, FULL = 0.3142, OLD = 0.1021, YOUTH = 0.2081, YOUTH_CAP = 25000;
  var LIMIT = 1000, REPORT_MIN = 100;                 // skatteavdrag/avgift från 1 000 kr per person och år; uppgiftsskyldighet från 100 kr
  var PBB = { 2025: 58800, 2026: 59200, 2027: 59600 }; // prisbasbelopp (2027: SFS 2026:1779)
  var YEARS = [2025, 2026, 2027], PRELIM_YEARS = { 2027: true };
  var YOUTH_FROM = '2026-04-01', YOUTH_TO = '2027-09-30';
  /* Roles. styrelse: KU/AGI fält 023 (del av ersättningen som är styrelsearvode). idrott: kan vara idrottsersättning i en idrottsförening. */
  var ROLES = {
    ordf: { sv: 'Ordförande', en: 'Chair', styrelse: true, w: 3 }, vice: { sv: 'Vice ordförande', en: 'Vice chair', styrelse: true, w: 1.5 },
    kassor: { sv: 'Kassör', en: 'Treasurer', styrelse: true, w: 2 }, sekr: { sv: 'Sekreterare', en: 'Secretary', styrelse: true, w: 1.5 },
    ledamot: { sv: 'Ledamot', en: 'Board member', styrelse: true, w: 1 }, suppl: { sv: 'Suppleant', en: 'Deputy', styrelse: true, w: 0.5 },
    revisor: { sv: 'Revisor (ej auktoriserad)', en: 'Auditor (lay)', styrelse: false, w: 0.5 }, valb: { sv: 'Valberedning', en: 'Nomination committee', styrelse: false, w: 0.25 },
    tranare: { sv: 'Tränare / ledare', en: 'Coach / leader', styrelse: false, idrott: true, w: 1 }, domare: { sv: 'Domare / funktionär', en: 'Referee / official', styrelse: false, idrott: true, w: 1 },
    annan: { sv: 'Annat uppdrag', en: 'Other assignment', styrelse: false, w: 1 }
  };
  var TYPES = ['ideell', 'idrott', 'brf', 'samf', 'ek'];

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[\s\u00a0\u202f]/g, '').replace(/kr$/i, '').replace(',', '.');
    if (s === '') return 0; return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }
  var kr = function (x) { return Math.floor(x + 1e-9); };
  var pct = function (base, rate) { return Math.floor(base * rate + 1e-9); };
  function halfPbb(y) { return PBB[y] ? PBB[y] / 2 : null; }

  function category(by, d) {
    var y = +d.slice(0, 4);
    if (by <= 1937) return 'none';
    if (by <= y - 68) return 'old';
    if (d >= YOUTH_FROM && d <= YOUTH_TO && by >= y - 23 && by <= y - 19) return 'youth';
    return 'full';
  }
  function birthRange(cat, y) { return { full: (y - 67) + ' eller senare', old: '1938–' + (y - 68), youth: (y - 23) + '–' + (y - 19), none: '1937 eller tidigare' }[cat]; }

  /* ---------- dates / deadline (AGI: den 12 månaden efter, i januari och augusti den 17) ---------- */
  function iso(dt) { return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); }
  function D(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return D(y, mo, da);
  }
  function nonBanking(y) {
    var e = easter(y), add = function (n) { return iso(new Date(e.getTime() + n * 864e5)); }, s = {};
    var midsAfton = null; for (var d = 19; d <= 25; d++) if (D(y, 6, d).getUTCDay() === 5) midsAfton = iso(D(y, 6, d));
    [y + '-01-01', y + '-01-06', add(-2), add(1), y + '-05-01', add(39), y + '-06-06', midsAfton, y + '-12-24', y + '-12-25', y + '-12-26', y + '-12-31'].forEach(function (x) { s[x] = true; });
    return s;
  }
  function isBankDay(dt) { var w = dt.getUTCDay(); return w !== 0 && w !== 6 && !nonBanking(dt.getUTCFullYear())[iso(dt)]; }
  function deadline(payIso) {
    var y = +payIso.slice(0, 4), m = +payIso.slice(5, 7);
    var ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1, day = (m === 7 || m === 12) ? 17 : 12;
    var dt = D(ny, nm, day), nominal = iso(dt);
    while (!isBankDay(dt)) dt = new Date(dt.getTime() + 864e5);
    return { nominal: nominal, date: iso(dt), moved: iso(dt) !== nominal };
  }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false; var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && iso(d) === s; }

  /* ---------- fördelning: largest remainder, sums exactly to the total ---------- */
  function distribute(total, weights) {
    total = kr(total); var W = weights.reduce(function (a, b) { return a + (b > 0 ? b : 0); }, 0);
    if (!(W > 0) || !(total > 0)) return weights.map(function () { return 0; });
    var raw = weights.map(function (w) { return w > 0 ? total * w / W : 0; }), base = raw.map(function (x) { return Math.floor(x + 1e-9); });
    var left = total - base.reduce(function (a, b) { return a + b; }, 0);
    var order = raw.map(function (x, i) { return { i: i, f: x - base[i] }; }).filter(function (o) { return weights[o.i] > 0; }).sort(function (a, b) { return b.f - a.f || a.i - b.i; });
    for (var k = 0; k < left; k++) base[order[k % order.length].i]++;
    return base;
  }
  /* Budget incl. arbetsgivaravgift → arvode per person: share_i / (1 + rate_i), floor. Rate by birth year at the payment date (full rate if unknown). */
  function fromBudget(budget, weights, births, payDate) {
    var shares = distribute(budget, weights);
    return shares.map(function (s, i) {
      var by = num(births[i]), cat = (validDate(payDate) && by >= 1900) ? category(by, payDate) : 'full';
      var rate = { full: FULL, old: OLD, youth: YOUTH, none: 0 }[cat];
      if (cat === 'youth' && s / (1 + YOUTH) > YOUTH_CAP) return kr((s + YOUTH_CAP * (FULL - YOUTH)) / (1 + FULL));
      return kr(s / (1 + rate));
    });
  }

  /* ---------- one person ----------
   * p: { name, role, birthYear, arvode (this payment), earlier (paid earlier this year by the förening, same kind), mainIncome:bool, tableTax (kr, used if mainIncome) }
   * ctx: { payDate, type } */
  function person(p, ctx, idx) {
    var w = [], err = [], y = +ctx.payDate.slice(0, 4);
    var role = ROLES[p.role] ? p.role : 'annan', R = ROLES[role];
    var by = num(p.birthYear); if (!(by >= 1900 && by <= 2015 && by === Math.floor(by))) err.push({ code: 'birth', row: idx });
    var f = {}; ['arvode', 'earlier', 'tableTax'].forEach(function (k) { f[k] = num(p[k]); if (isNaN(f[k]) || f[k] < 0) err.push({ code: 'num', field: k, row: idx }); });
    if (err.length) return { ok: false, errors: err };
    if (f.arvode !== Math.floor(f.arvode) || f.earlier !== Math.floor(f.earlier)) w.push({ code: 'ore', row: idx });
    var N = kr(f.arvode), E = kr(f.earlier), tot = N + E;
    var idrott = ctx.type === 'idrott' && !!R.idrott;
    if (ctx.type === 'idrott' && R.styrelse) w.push({ code: 'idrott-styrelse', row: idx });
    var T = idrott ? halfPbb(y) : LIMIT;
    var cat = category(by, ctx.payDate), mode;
    if (tot < T) mode = 'free'; else if (E >= T) mode = 'normal'; else mode = E > 0 ? 'cross' : 'normal';
    var f011 = 0, f131 = 0, f010 = 0, f001 = 0, f023 = 0, under = { full: 0, old: 0, youth: 0, none: 0 };
    if (mode === 'free') { f131 = N; }
    else {
      f011 = mode === 'cross' ? N + E : N; if (mode === 'cross') { f010 = E; w.push({ code: 'cross', row: idx, earlier: E, limit: T }); }
      if (cat === 'youth') { under.youth = Math.min(f011, YOUTH_CAP); under.full = f011 - under.youth; } else under[cat] = f011;
      if (p.mainIncome) { f001 = kr(f.tableTax); if (!f.tableTax) w.push({ code: 'table-missing', row: idx }); }
      else f001 = pct(N, TAX);
    }
    if (R.styrelse) f023 = mode === 'free' ? f131 : N;
    var avgift = pct(under.full, FULL) + pct(under.old, OLD) + pct(under.youth, YOUTH);
    var report = tot >= REPORT_MIN;
    if (mode === 'free' && N > 0) w.push({ code: idrott ? 'idrott-free' : 'below', row: idx, limit: T });
    if (!report && N > 0) w.push({ code: 'below-100', row: idx });
    return { ok: true, warnings: w, idx: idx, name: String(p.name || ''), role: role, styrelse: !!R.styrelse, idrott: idrott, birthYear: by, category: cat,
      rate: { full: FULL, old: OLD, youth: YOUTH, none: 0 }[cat], limit: T, mode: mode, arvode: N, earlier: E, yearTotal: tot,
      skatt: f001, avgift: avgift, net: N - f001, cost: N + avgift, report: report, under: under,
      agi: { '001': f001, '011': f011, '131': f131, '010': f010, '023': f023 }, ku: { '031': tot, '023': R.styrelse ? tot : 0 } };
  }

  /* ---------- the whole payment ----------
   * inp: { payDate, type, registered:bool (föreningen är registrerad som arbetsgivare), people:[...] } */
  function compute(inp) {
    var err = [], w = [], payDate = String(inp.payDate || '');
    if (!validDate(payDate)) err.push({ code: 'date' });
    var y = validDate(payDate) ? +payDate.slice(0, 4) : NaN;
    if (y && YEARS.indexOf(y) < 0) err.push({ code: 'year', year: y });
    var type = TYPES.indexOf(inp.type) >= 0 ? inp.type : 'ideell';
    var rows = (inp.people || []).filter(function (p) { return p && (String(p.arvode || '').trim() !== '' || String(p.name || '').trim() !== '' || String(p.birthYear || '').trim() !== ''); });
    if (!rows.length) err.push({ code: 'empty' });
    if (err.length) return { ok: false, errors: err, warnings: w };
    var ctx = { payDate: payDate, type: type }, res = [];
    rows.forEach(function (p, i) { var r = person(p, ctx, i); if (!r.ok) err = err.concat(r.errors); else res.push(r); });
    if (err.length) return { ok: false, errors: err, warnings: w };
    var sum = function (k) { return res.reduce(function (a, r) { return a + r[k]; }, 0); };
    var U = { full: 0, old: 0, youth: 0 }; res.forEach(function (r) { U.full += r.under.full; U.old += r.under.old; U.youth += r.under.youth; });
    // Skatteverket's e-tjänst computes the avgift on the summed underlag per rate (huvuduppgift) – may differ by a krona from the per-person sum.
    var avgHuvud = { full: pct(U.full, FULL), old: pct(U.old, OLD), youth: pct(U.youth, YOUTH) };
    var avgift = avgHuvud.full + avgHuvud.old + avgHuvud.youth, skatt = sum('skatt');
    var anyTaxed = res.some(function (r) { return r.mode !== 'free'; }), anyReport = res.some(function (r) { return r.report && r.arvode > 0; });
    if (anyTaxed && !inp.registered) w.push({ code: 'register' });
    if (!anyTaxed && anyReport) w.push({ code: 'ku-option' });
    if (PRELIM_YEARS[y]) w.push({ code: 'prelim', year: y });
    res.forEach(function (r) { w = w.concat(r.warnings); });
    return { ok: true, warnings: w, payDate: payDate, year: y, month: +payDate.slice(5, 7), type: type, people: res,
      totals: { arvode: sum('arvode'), skatt: skatt, avgift: avgift, avgiftPerPerson: sum('avgift'), net: sum('net'), toSkatteverket: skatt + avgift, cost: sum('arvode') + avgift, underlag: U, avgHuvud: avgHuvud },
      anyTaxed: anyTaxed, mustFileAgi: anyTaxed || (anyReport && !!inp.registered), deadline: deadline(payDate), halfPbb: halfPbb(y), pbb: PBB[y] };
  }
  function fmt(n) { var s = String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); return (n < 0 ? '−' : '') + s; }
  return { compute: compute, person: person, distribute: distribute, fromBudget: fromBudget, category: category, birthRange: birthRange, deadline: deadline, easter: easter,
    isBankDay: isBankDay, num: num, fmt: fmt, ROLES: ROLES, TYPES: TYPES, PBB: PBB, YEARS: YEARS, halfPbb: halfPbb,
    RATES: { TAX: TAX, FULL: FULL, OLD: OLD, YOUTH: YOUTH, YOUTH_CAP: YOUTH_CAP, LIMIT: LIMIT, REPORT_MIN: REPORT_MIN } };
});
