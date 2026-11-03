/* Arvode god man – skatteavdrag, arbetsgivaravgift och förenklad arbetsgivardeklaration (SKV 4805).
 * Pure functions, no DOM. Sources (checked 2026-11-03): Skatteverket "Arvode och ersättning till god man, förvaltare och förmyndare",
 * "Anlita en privatperson" (ruta för ruta), SKV 315 utg. 10, SKV 448 utg. 31, SKV 4882. All amounts in whole kronor; öre are dropped (floor) like Skatteverket's examples. */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.ARVODE = factory(); })(this, function () {
  'use strict';
  var TAX = 0.30;                         // skatteavdrag på arvode (Skatteverket: 30 %)
  var FULL = 0.3142, OLD = 0.1021, YOUTH = 0.2081, YOUTH_CAP = 25000;
  var BIL_FREE = 25;                      // skattefri bilersättning kr/mil (egen bil)
  var SCHABLON = { 2025: 1176, 2026: 1184 };   // 2 % av prisbasbelopp (58 800 / 59 200)
  var PRELIM_YEARS = { 2027: true };     // rates not yet confirmed by Skatteverket for 2027
  var YEARS = [2025, 2026, 2027];
  var YOUTH_FROM = '2026-04-01', YOUTH_TO = '2027-09-30';

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    var s = String(v == null ? '' : v).replace(/[\s\u00a0\u202f]/g, '').replace(/kr$/i, '').replace(',', '.');
    if (s === '') return 0; return /^-?\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
  }
  var kr = function (x) { return Math.floor(x + 1e-9); };   // whole kronor, öre dropped
  var pct = function (base, rate) { return Math.floor(base * rate + 1e-9); };

  /* Which avgift applies for a recipient born `by` and a payment on ISO date `d`. */
  function category(by, d) {
    var y = +d.slice(0, 4);
    if (by <= 1937) return 'none';
    if (by <= y - 68) return 'old';                       // 2025: −1957, 2026: −1958, 2027: −1959 (67 vid årets ingång)
    if (d >= YOUTH_FROM && d <= YOUTH_TO && by >= y - 23 && by <= y - 19) return 'youth'; // 2026: 2003–2007
    return 'full';
  }
  function birthRange(cat, y) {
    return { full: (y - 67) + ' eller senare', old: '1938–' + (y - 68), youth: (y - 23) + '–' + (y - 19), none: '1937 eller tidigare' }[cat];
  }

  /* ---------- dates / deadline ---------- */
  function iso(dt) { return dt.getUTCFullYear() + '-' + String(dt.getUTCMonth() + 1).padStart(2, '0') + '-' + String(dt.getUTCDate()).padStart(2, '0'); }
  function D(y, m, d) { return new Date(Date.UTC(y, m - 1, d)); }
  function easter(y) { // Anonymous Gregorian algorithm
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3),
      h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return D(y, mo, da);
  }
  /* Days that move a deadline (lag 1930:173): Sundays and public holidays, Saturdays, midsommarafton, julafton, nyårsafton. */
  function nonBanking(y) {
    var e = easter(y), add = function (n) { return iso(new Date(e.getTime() + n * 864e5)); }, s = {};
    var midsAfton = null; for (var d = 19; d <= 25; d++) if (D(y, 6, d).getUTCDay() === 5) midsAfton = iso(D(y, 6, d));
    [y + '-01-01', y + '-01-06', add(-2), add(1), y + '-05-01', add(39), y + '-06-06', midsAfton, y + '-12-24', y + '-12-25', y + '-12-26', y + '-12-31']
      .forEach(function (x) { s[x] = true; });
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

  /* ---------- main ----------
   * inp: { payDate:'YYYY-MM-DD', birthYear, arvode, kostnad, kostnadUnderlag:bool, mil, krPerMil, earlier (taxable arvode already paid this year by the same huvudman),
   *        payer:'huvudman'|'kommun', employer:bool (huvudman registrerad som arbetsgivare), minor:bool } */
  function compute(inp) {
    var w = [], err = [];
    var payDate = String(inp.payDate || '');
    if (!validDate(payDate)) err.push({ code: 'date' });
    var y = validDate(payDate) ? +payDate.slice(0, 4) : NaN;
    if (y && YEARS.indexOf(y) < 0) err.push({ code: 'year', year: y });
    var by = num(inp.birthYear); if (!(by >= 1900 && by <= 2015 && by === Math.floor(by))) err.push({ code: 'birth' });
    var f = {}; ['arvode', 'kostnad', 'mil', 'krPerMil', 'earlier'].forEach(function (k) { f[k] = num(inp[k]); if (isNaN(f[k]) || f[k] < 0) err.push({ code: 'num', field: k }); });
    if (inp.krPerMil === '' || inp.krPerMil == null) f.krPerMil = BIL_FREE;
    if (err.length) return { ok: false, errors: err, warnings: w };

    var hasOre = ['arvode', 'kostnad'].some(function (k) { return f[k] !== Math.floor(f[k]); });
    if (hasOre) w.push({ code: 'ore' });
    var arvode = kr(f.arvode), kostnad = kr(f.kostnad), earlier = kr(f.earlier);
    // bilersättning: up to 25 kr/mil tax-free and not reported; the excess is lön
    var bilTotal = kr(f.mil * f.krPerMil), bilFree = Math.min(bilTotal, kr(f.mil * BIL_FREE)), bilTaxable = bilTotal - bilFree;
    if (bilTaxable > 0) w.push({ code: 'bil-excess', amount: bilTaxable });
    // kostnadsersättning: without underlag max 2 % of prisbasbelopp, excess is lön
    var cap = SCHABLON[y], kostOk = kostnad, kostExcess = 0;
    if (!inp.kostnadUnderlag && kostnad > 0) {
      if (cap == null) w.push({ code: 'schablon-unknown', year: y });
      else if (kostnad > cap) { kostOk = cap; kostExcess = kostnad - cap; w.push({ code: 'schablon-excess', cap: cap, excess: kostExcess }); }
    }
    var brutto = arvode + bilTaxable + kostExcess;   // skattepliktig ersättning (ruta 04/11/18 + 06)
    var cat = category(by, payDate);
    var below = brutto + earlier < 1000;
    if (below && brutto > 0) w.push({ code: 'below-1000' });
    if (PRELIM_YEARS[y]) w.push({ code: 'prelim', year: y });
    if (inp.payer === 'kommun') w.push({ code: 'kommun' });
    if (inp.employer) w.push({ code: 'employer' });
    if (inp.minor) w.push({ code: 'minor' });

    var r = { '04': 0, '07': 0, '11': 0, '12': 0, '18': 0, '24': 0, '06': 0, '09': 0, '20': kostOk, '10': 0 };
    var skatt = 0, avgift = 0;
    if (!below) {
      if (cat === 'full') { r['04'] = brutto; r['07'] = pct(brutto, FULL); }
      else if (cat === 'old') { r['11'] = brutto; r['12'] = pct(brutto, OLD); }
      else if (cat === 'youth') { r['18'] = Math.min(brutto, YOUTH_CAP); r['24'] = pct(r['18'], YOUTH); r['04'] = brutto - r['18']; r['07'] = pct(r['04'], FULL); }
      r['06'] = brutto; r['09'] = pct(brutto, TAX);
      skatt = r['09']; avgift = r['07'] + r['12'] + r['24']; r['10'] = avgift + skatt;
    }
    var mustReport = !below && brutto > 0 && inp.payer !== 'kommun';
    var net = brutto - skatt + kostOk + bilFree;            // paid out to the god man
    return { ok: true, warnings: w, year: y, month: +payDate.slice(5, 7), payDate: payDate, category: cat, birthRange: birthRange(cat, y),
      rate: { full: FULL, old: OLD, youth: YOUTH, none: 0 }[cat], below: below, mustReport: mustReport, form: inp.employer ? 'AGI' : 'SKV 4805',
      arvode: arvode, bilTotal: bilTotal, bilFree: bilFree, bilTaxable: bilTaxable, kostnad: kostnad, kostOk: kostOk, kostExcess: kostExcess, schablon: cap,
      brutto: brutto, skatt: skatt, avgift: avgift, ruta: r, toSkatteverket: r['10'], net: net,
      totalCost: net + r['10'],                              // everything leaving the huvudman's account
      deadline: deadline(payDate) };
  }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0'); }
  return { compute: compute, category: category, birthRange: birthRange, deadline: deadline, easter: easter, isBankDay: isBankDay, num: num, fmt: fmt,
    RATES: { TAX: TAX, FULL: FULL, OLD: OLD, YOUTH: YOUTH, YOUTH_CAP: YOUTH_CAP, BIL_FREE: BIL_FREE }, SCHABLON: SCHABLON, YEARS: YEARS };
});
