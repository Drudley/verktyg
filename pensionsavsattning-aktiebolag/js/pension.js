/* Pensionsavsättning i aktiebolag – avdragsutrymme enligt huvudregeln och särskild löneskatt.
 * Pure functions, no DOM. Amounts in whole kronor (Math.round), like Skatteverkets examples.
 * Sources (checked 2026-11-10):
 *   Skatteverket "Pensionskostnader för anställda" (huvudregeln 35 %, tak 10 prisbasbelopp;
 *     exempel 2026: lön 380 000 / föregående 325 000 → högst 133 000).
 *   Skatteverket "Särskild löneskatt" (24,26 %; exempel: premie 200 000 → skatt 48 520).
 *   Prisbasbelopp 2025: 58 800, 2026: 59 200, 2027: 59 600.
 * Kompletteringsregeln, direktpension och kapitalförsäkring beräknas inte här.
 */
(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.PENSION = factory(); })(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var PBB = { 2025: 58800, 2026: 59200, 2027: 59600 };
  var MAIN = 0.35, CAP_N = 10, SLP = 0.2426, CORP = 0.206, AG = 0.3142;
  var YEARS = [2025, 2026, 2027];

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v == null) return NaN;
    var s = String(v).trim().replace(/\u00a0|\u202f|\s/g, '').replace(',', '.');
    if (!s) return 0;
    var n = parseFloat(s);
    return isFinite(n) ? n : NaN;
  }
  function kr(v) {
    var n = num(v);
    if (!isFinite(n) || n < 0) return NaN;
    return Math.round(n);
  }
  function fmt(n) {
    if (!isFinite(n)) return '–';
    var sign = n < 0 ? '−' : '';
    return sign + String(Math.abs(Math.round(n))).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  }
  function yearInfo(year) {
    var y = +year;
    if (!PBB[y]) return { ok: false, year: y, error: 'year' };
    var pbb = PBB[y];
    return { ok: true, year: y, pbb: pbb, cap: pbb * CAP_N, prevYear: y - 1, slp: SLP, corp: CORP, ag: AG, main: MAIN };
  }

  /* One employee, one tax year. salaryYear / salaryPrev / paid / planned in kronor (string or number). */
  function person(p, year) {
    var info = yearInfo(year);
    if (!info.ok) return { ok: false, error: 'year', warnings: [] };
    var salaryYear = kr(p && p.salaryYear), salaryPrev = kr(p && p.salaryPrev), paid = kr(p && p.paid), planned = kr(p && p.planned);
    if ([salaryYear, salaryPrev, paid, planned].some(function (x) { return !isFinite(x); })) {
      return { ok: false, error: 'num', warnings: [] };
    }
    var name = ((p && p.name) || '').trim();
    var warnings = [];
    var best = Math.max(salaryYear, salaryPrev);
    var used = salaryYear >= salaryPrev ? 'year' : 'prev';
    var usedSalary = best;
    var room35 = Math.round(best * MAIN);
    var room = Math.min(room35, info.cap);
    var capped = room35 > info.cap;
    if (best === 0) warnings.push('no-salary');
    if (capped) warnings.push('pbb-cap');
    if (used === 'prev' && salaryPrev > salaryYear) warnings.push('used-prev');
    var remaining = Math.max(0, room - paid);
    if (paid > room) warnings.push('paid-over');
    var totalPremium = paid + planned;
    var deductible = Math.min(totalPremium, room);
    var excess = Math.max(0, totalPremium - room);
    if (excess > 0) warnings.push('excess');
    var slp = Math.round(totalPremium * SLP);
    var companyCost = totalPremium + slp;
    var deductibleTotal = deductible + slp; /* SLP is deductible even on excess premiums */
    var taxSave = Math.round(deductibleTotal * CORP);
    var netCash = companyCost - taxSave;
    return {
      ok: true, name: name, year: info.year, pbb: info.pbb, cap: info.cap,
      salaryYear: salaryYear, salaryPrev: salaryPrev, usedSalary: usedSalary, used: used,
      room35: room35, room: room, capped: capped,
      paid: paid, planned: planned, totalPremium: totalPremium,
      remaining: remaining, deductible: deductible, excess: excess,
      slp: slp, slpRate: SLP, companyCost: companyCost,
      deductibleTotal: deductibleTotal, taxSave: taxSave, netCash: netCash,
      warnings: warnings
    };
  }

  function compare(plannedDeductible, year) {
    var info = yearInfo(year);
    if (!info.ok) return { ok: false };
    var p = Math.max(0, Math.round(plannedDeductible || 0));
    var slp = Math.round(p * SLP);
    var pensionCost = p + slp;
    var pensionSave = Math.round(pensionCost * CORP);
    var pensionNet = pensionCost - pensionSave;
    var ag = Math.round(p * AG);
    var salaryCost = p + ag;
    var salarySave = Math.round(salaryCost * CORP);
    var salaryNet = salaryCost - salarySave;
    var profitTax = Math.round(p * CORP);
    var profitLeft = p - profitTax;
    return {
      ok: true, amount: p,
      pension: { slp: slp, cost: pensionCost, taxSave: pensionSave, net: pensionNet },
      salary: { ag: ag, cost: salaryCost, taxSave: salarySave, net: salaryNet },
      profit: { tax: profitTax, left: profitLeft, net: profitTax }
    };
  }

  function company(people, year, meta) {
    var info = yearInfo(year);
    var rows = (people || []).map(function (p) { return person(p, year); });
    var ok = info.ok && rows.every(function (r) { return r.ok; });
    var sum = function (k) { return rows.reduce(function (a, r) { return a + (r.ok ? r[k] : 0); }, 0); };
    var plannedInRoom = rows.reduce(function (a, r) {
      if (!r.ok) return a;
      return a + Math.min(r.planned, Math.max(0, r.room - r.paid));
    }, 0);
    var cmp = compare(plannedInRoom, year);
    return {
      ok: ok, year: year, info: info, people: rows, meta: meta || {},
      n: rows.length,
      room: sum('room'), paid: sum('paid'), planned: sum('planned'),
      totalPremium: sum('totalPremium'), remaining: sum('remaining'),
      deductible: sum('deductible'), excess: sum('excess'),
      slp: sum('slp'), companyCost: sum('companyCost'),
      taxSave: sum('taxSave'), netCash: sum('netCash'),
      compare: cmp, plannedInRoom: plannedInRoom,
      warnings: rows.reduce(function (a, r) { return a.concat(r.warnings || []); }, [])
    };
  }

  /* Skatteverkets exempel: lön 380 000 (föregående 325 000) → avdrag högst 133 000. */
  function samplePerson() {
    return { name: 'Anna Andersson (exempel)', salaryYear: 380000, salaryPrev: 325000, paid: 0, planned: 133000 };
  }
  function sampleCompany() {
    return { year: 2026, meta: { company: 'Exempelbolaget Gnistan AB (syntetiskt)', orgnr: '559999-0000' }, people: [samplePerson()] };
  }

  return {
    PBB: PBB, YEARS: YEARS, RATES: { MAIN: MAIN, CAP_N: CAP_N, SLP: SLP, CORP: CORP, AG: AG },
    num: num, kr: kr, fmt: fmt, yearInfo: yearInfo, person: person, company: company, compare: compare,
    samplePerson: samplePerson, sampleCompany: sampleCompany
  };
});
