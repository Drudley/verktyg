/* Semesterlöneskuld i bokslutet – pure functions, no DOM. Amounts in kronor, rounded to whole kronor per person.
 * Sources (checked 2026-11-12):
 *   Semesterlag (1977:480): 3 § semesterår/intjänandeår 1 april–31 mars, 4 § 25 dagar, 16 a § sammalöneregeln
 *     (semestertillägg 0,43 % av månadslönen per betald semesterdag), 16 b § procentregeln (12 %), 18 § sparade dagar.
 *   Skatteverket, arbetsgivaravgifter 2026: 31,42 %; endast ålderspensionsavgift 10,21 % för den som fyllt 67 vid årets ingång
 *     (2026: född 1938–1958); ingen avgift för född 1937 eller tidigare; 20,81 % för 19–23 år (2026: född 2003–2007)
 *     på lön upp till 25 000 kr/mån från 1 april 2026.
 *   BAS 2026: 2920 Upplupna semesterlöner, 2940 Upplupna lagstadgade sociala och andra avgifter,
 *     7290 Förändring av semesterlöneskuld, 7519 Sociala avgifter för semester- och löneskulder.
 * The day value under sammalöneregeln uses a configurable daily-pay share (default 4,6 % of the monthly salary, the
 * common convention for one day's pay) plus the semestertillägg (0,43 % by law, often 0,8 % under collective agreements).
 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.SEMESTER = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var AG = { std: 0.3142, youth: 0.2081, old: 0.1021, none: 0 };
  var PRESETS = { lag: { dayPct: 4.6, addPct: 0.43 }, avtal: { dayPct: 4.6, addPct: 0.8 }, d21: { dayPct: 100 / 21, addPct: 0.43 } };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v == null) return 0;
    var s = String(v).trim().replace(/[\u00a0\u202f\s]/g, '').replace(/kr$/i, '').replace(',', '.');
    if (!s) return 0;
    if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
    return parseFloat(s);
  }
  function r2(x) { return Math.round(x * 100) / 100; }
  function isoOk(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(Date.parse(d + 'T00:00:00Z')); }

  /* months of the running intjänandeår that have passed at the closing date (fraction for a mid-month date).
     start: 'apr' (semesterlagen: 1 april–31 mars) or 'jan' (förskjutet/kalenderår). */
  function monthsEarned(closing, start) {
    if (!isoOk(closing)) return NaN;
    var y = +closing.slice(0, 4), m = +closing.slice(5, 7), d = +closing.slice(8, 10);
    var sm = start === 'jan' ? 1 : 4;
    var full = (m - sm + 12) % 12;                // whole months before the closing month
    var dim = new Date(Date.UTC(y, m, 0)).getUTCDate();
    var part = d >= dim ? 1 : d / dim;
    var months = full + part;
    return Math.min(12, months);
  }

  function company(input) {
    var co = input.company || {}, people = input.people || [];
    var dayPct = num(co.dayPct), addPct = num(co.addPct), perYear = num(co.daysPerYear || 25);
    var mo = monthsEarned(co.closing, co.start);
    var err = [];
    if (!isFinite(dayPct) || dayPct <= 0 || dayPct > 20) err.push('dayPct');
    if (!isFinite(addPct) || addPct < 0 || addPct > 5) err.push('addPct');
    if (!isFinite(perYear) || perYear < 0 || perYear > 60) err.push('daysPerYear');
    if (!isFinite(mo)) err.push('closing');
    var rows = [], warnings = [];
    people.forEach(function (p, i) {
      var r = person(p, { dayPct: dayPct, addPct: addPct, perYear: perYear, months: mo });
      r.i = i; rows.push(r);
      if (!r.ok) err.push('p' + i);
      (r.warnings || []).forEach(function (w) { if (warnings.indexOf(w) < 0) warnings.push(w); });
    });
    if (err.length) return { ok: false, errors: err, rows: rows };
    var sum = function (k) { return rows.reduce(function (a, r) { return a + (r[k] || 0); }, 0); };
    var skuld = sum('skuld'), avg = sum('avg');
    var ibS = num(co.ibSkuld), ibA = num(co.ibAvg);
    if (!isFinite(ibS)) ibS = 0; if (!isFinite(ibA)) ibA = 0;
    var res = {
      ok: true, months: r2(mo), rows: rows, n: rows.length,
      days: r2(sum('days')), skuld: skuld, avg: avg, total: skuld + avg,
      ibSkuld: ibS, ibAvg: ibA, chSkuld: skuld - ibS, chAvg: avg - ibA,
      warnings: warnings
    };
    res.voucher = voucher(res, co);
    return res;
  }

  function person(p, c) {
    var method = p.method === 'procent' ? 'procent' : 'samma';
    var monthly = num(p.monthly), sparade = num(p.saved), kvar = num(p.left), intjIn = p.earned, earnPrev = num(p.earnPrev), earnCur = num(p.earnCur);
    var rate = AG.hasOwnProperty(p.ag) ? AG[p.ag] : (isFinite(num(p.ag)) && String(p.ag).trim() !== '' ? num(p.ag) / 100 : AG.std);
    var auto = intjIn == null || String(intjIn).trim() === '';
    var intj = auto ? r2(c.perYear * c.months / 12) : num(intjIn);
    var bad = [monthly, sparade, kvar, intj, earnPrev, earnCur].some(function (x) { return !isFinite(x) || x < 0; });
    if (bad) return { ok: false, name: p.name || '' };
    var w = [];
    if (sparade > 0 && sparade > 5 * 5) w.push('saved-many');   // more than five years' worth of 5 saved days
    var dv, skuld, days;
    if (method === 'samma') {
      dv = r2(monthly * (c.dayPct + c.addPct) / 100);   // value per day rounded to öre
      days = sparade + kvar + intj;
      skuld = Math.round(days * dv);
      if (!monthly) w.push('no-salary');
    } else {
      dv = c.perYear ? r2(earnPrev * 0.12 / c.perYear) : 0;  // value of a day earned last intjänandeår
      days = sparade + kvar;
      skuld = Math.round(days * dv + earnCur * 0.12);       // + 12 % of pay earned so far in the running intjänandeår
      if (!earnPrev && !earnCur) w.push('no-salary');
    }
    if (p.ag === 'youth' && method === 'samma' && monthly > 25000) w.push('youth-cap');
    var avg = Math.round(skuld * rate);
    return { ok: true, name: p.name || '', method: method, monthly: monthly, saved: sparade, left: kvar, earned: intj, earnedAuto: auto,
      earnPrev: earnPrev, earnCur: earnCur, dayValue: r2(dv), days: r2(days), skuld: skuld, rate: rate, avg: avg, total: skuld + avg, warnings: w };
  }

  /* bokslutsverifikation: change against the opening balance (IB) on 2920/2940 */
  function voucher(res, co) {
    var tr = [];
    if (res.chSkuld) { tr.push({ konto: '7290', amount: res.chSkuld * 100 }); tr.push({ konto: '2920', amount: -res.chSkuld * 100 }); }
    if (res.chAvg) { tr.push({ konto: '7519', amount: res.chAvg * 100 }); tr.push({ konto: '2940', amount: -res.chAvg * 100 }); }
    return { serie: 'A', nr: '1', date: co.closing, text: 'Semesterlöneskuld ' + co.closing, trans: tr };
  }

  var ACCOUNTS = { '2920': 'Upplupna semesterlöner', '2940': 'Upplupna lagstadgade sociala och andra avgifter', '7290': 'Förändring av semesterlöneskuld', '7519': 'Sociala avgifter för semester- och löneskulder' };

  function sample() {
    return {
      company: { name: 'Exempelbolaget Semester AB (syntetiskt)', orgnr: '559999-0001', closing: '2026-12-31', start: 'apr', preset: 'lag', dayPct: '4,6', addPct: '0,43', daysPerYear: '25', ibSkuld: '60000', ibAvg: '18852' },
      people: [
        { name: 'Anna Ek', method: 'samma', monthly: '35000', saved: '5', left: '3', earned: '', earnPrev: '', earnCur: '', ag: 'std' },
        { name: 'Bo Lind', method: 'samma', monthly: '24000', saved: '0', left: '2', earned: '', earnPrev: '', earnCur: '', ag: 'youth' },
        { name: 'Cilla Berg (timlön)', method: 'procent', monthly: '', saved: '0', left: '4', earned: '', earnPrev: '240000', earnCur: '180000', ag: 'std' }
      ]
    };
  }

  return { AG: AG, PRESETS: PRESETS, ACCOUNTS: ACCOUNTS, num: num, monthsEarned: monthsEarned, person: person, company: company, sample: sample };
});
