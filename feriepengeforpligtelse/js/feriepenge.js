/* Feriepengeforpligtelse – calculation core (no DOM). UMD: window.FERIE / require().
   Rules: ferieloven (LBK nr. 152 af 20/02/2024) § 4 (ferieår 1/9–31/8), § 5 (2,08 dage pr. måneds ansættelse; 0,07 pr. dag ved
   ansættelse < 1 måned), § 6 (afholdelse til 31/12 året efter), § 7 (ferie på forskud), § 16 (løn under ferie + 1 % ferietillæg;
   12,5 % feriegodtgørelse), § 18 (ferietillæg udbetales med maj- og augustlønnen), § 19 (beregningsgrundlag).
   Skat: Den juridiske vejledning C.C.2.2.2.1.3 – princip 1 (fradrag ved udbetaling) eller princip 2 (fradrag for ændring i
   forpligtelsen i optjeningsåret, konkret opgørelse pr. lønmodtager). All amounts in øre (integers). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(); else root.FERIE = f(); })(this, function () {
  'use strict';
  var DAYS_PER_MONTH = 2.08, DAY_SHORT = 0.07, TILLAEG = 0.01, GODTG = 0.125;
  function blank(v) { return v == null || String(v).trim() === ''; }
  function num(v) { if (blank(v)) return 0; var s = String(v).trim().replace(/\s|\u00a0|kr\.?/gi, ''); if (/,\d{1,2}$/.test(s) || /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(',', '.'); s = s.replace(/^[−–]/, '-'); return /^-?\d+(\.\d+)?$/.test(s) ? +s : NaN; }
  function ore(x) { return Math.round(x * 100); }
  function validDate(s) { if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false; var d = new Date(s + 'T00:00:00Z'); return !isNaN(d) && d.toISOString().slice(0, 10) === s; }
  function D(s) { return new Date(s + 'T00:00:00Z'); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { return iso(new Date(D(s).getTime() + n * 864e5)); }
  /* ferieår (1/9–31/8) containing date s */
  function ferieaar(s) { var y = +s.slice(0, 4), m = +s.slice(5, 7); var y0 = m >= 9 ? y : y - 1; return { start: y0 + '-09-01', end: (y0 + 1) + '-08-31', label: y0 + '/' + String(y0 + 1).slice(2) }; }
  /* add whole months to a date (anniversary; clamps to month end) */
  function addMonths(s, n) { var y = +s.slice(0, 4), m = +s.slice(5, 7) - 1 + n, d = +s.slice(8, 10); y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); return iso(new Date(Date.UTC(y, m, Math.min(d, last)))); }
  /* employment in [from, to] (inclusive) split by calendar month: whole months, and the covered days of each partial month
     (borger.dk: ansat midt i en måned → 0,07 dag for hver dag i måneden) */
  function span(from, to) {
    var out = { months: 0, days: 0, parts: [] }; if (from > to) return out;
    var y = +from.slice(0, 4), m = +from.slice(5, 7) - 1;
    for (;;) {
      var first = iso(new Date(Date.UTC(y, m, 1))), dim = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), last = iso(new Date(Date.UTC(y, m, dim)));
      if (first > to) break;
      var a = from > first ? from : first, b = to < last ? to : last;
      var d = Math.round((D(b) - D(a)) / 864e5) + 1;
      if (d === dim) out.months++; else { out.days += d; out.parts.push({ days: d, dim: dim }); }
      m++; if (m > 11) { m = 0; y++; }
    }
    return out;
  }
  /* § 5: 2,08 dage pr. hel måned; 0,07 pr. dag i en påbegyndt måned, højst 2,08 */
  function earned(sp) { var e = sp.months * DAYS_PER_MONTH; sp.parts.forEach(function (p) { e += Math.min(DAYS_PER_MONTH, p.days * DAY_SHORT); }); return Math.round(e * 100) / 100; }
  function monthsFrac(sp) { var m = sp.months; sp.parts.forEach(function (p) { m += p.days / p.dim; }); return Math.round(m * 100) / 100; }
  function calc(st) {
    var c = st.company || {}, errors = [], warnings = [], bad = [];
    if (!validDate(c.end)) errors.push('end');
    var dpm = blank(c.dpm) ? 21.67 : num(c.dpm); if (!(dpm >= 15 && dpm <= 26)) errors.push('dpm');
    var social = num(c.social); if (isNaN(social) || social < 0 || social > 50) errors.push('social');
    var primo = num(c.primo); if (isNaN(primo) || primo < 0) errors.push('primo');
    var fa = validDate(c.end) ? ferieaar(c.end) : null;
    /* ferietillæg for 1/9–31/5 is paid with the May salary, 1/6–31/8 with the August salary (§ 18) */
    var tStart = fa ? (+c.end.slice(5, 7) >= 6 && +c.end.slice(5, 7) <= 8 ? c.end.slice(0, 4) + '-06-01' : fa.start) : null;
    var rows = (st.people || []).map(function (o, i) {
      var e = [], type = o.type === 'time' ? 'time' : 'fun';
      var r = { i: i, name: String(o.name || '').trim() || ('Medarbejder ' + (i + 1)), type: type, errors: e };
      if (type === 'time') {
        var l = num(o.unpaid); if (isNaN(l) || l < 0 || blank(o.unpaid)) e.push('unpaid');
        if (!e.length) { r.unpaid = ore(l); r.godtg = Math.round(r.unpaid * GODTG); r.total = r.godtg; r.social = 0; }
      } else {
        var lon = num(o.salary), pen = num(o.pension), taken = num(o.taken), prev = num(o.prev), fri = num(o.fri), paidT = num(o.paidT), ov = blank(o.earned) ? null : num(o.earned);
        if (!(lon > 0)) e.push('salary');
        if (isNaN(pen) || pen < 0) e.push('pension');
        if (isNaN(taken) || taken < 0 || taken > 40) e.push('taken');
        if (isNaN(prev) || prev < 0 || prev > 30) e.push('prev');
        if (isNaN(fri) || fri < 0 || fri > 30) e.push('fri');
        if (isNaN(paidT) || paidT < 0) e.push('paidT');
        if (ov != null && (isNaN(ov) || ov < 0 || ov > 25)) e.push('earned');
        if (!blank(o.start) && !validDate(o.start)) e.push('start');
        if (!e.length && fa) {
          var from = !blank(o.start) && o.start > fa.start ? o.start : fa.start;
          if (!blank(o.start) && o.start > c.end) warnings.push({ k: 'future', n: i + 1 });
          var sp = span(from, c.end);
          r.months = sp.months; r.restDays = sp.days;
          r.earnedCalc = earned(sp); r.earned = ov != null ? ov : r.earnedCalc;
          r.prev = prev; r.taken = taken; r.fri = fri;
          r.days = Math.round((r.earned + prev - taken) * 100) / 100;
          r.salary = ore(lon); r.pension = ore(pen);
          r.dayValue = Math.round((r.salary + r.pension) / dpm);
          r.ferieValue = Math.round(Math.max(0, r.days) * r.dayValue);
          r.friValue = Math.round(fri * r.dayValue);
          r.forskud = r.days < 0 ? Math.round(-r.days * r.dayValue) : 0;
          var tFrom = !blank(o.start) && o.start > tStart ? o.start : tStart, tsp = span(tFrom, c.end);
          r.tMonths = monthsFrac(tsp);
          r.tillaegCalc = Math.round(r.salary * r.tMonths * TILLAEG);
          r.paidT = ore(paidT); r.tillaeg = Math.max(0, r.tillaegCalc - r.paidT);
          r.social = Math.round((r.ferieValue + r.friValue) * social / 100);
          r.total = r.ferieValue + r.friValue + r.tillaeg + r.social;
          if (r.days < 0) warnings.push({ k: 'forskud', n: i + 1 });
          if (prev > 5 && +c.end.slice(5, 7) >= 9) warnings.push({ k: 'prev', n: i + 1 });
          if (ov != null && Math.abs(ov - r.earnedCalc) > 0.01) warnings.push({ k: 'override', n: i + 1 });
        }
      }
      if (e.length) bad.push(i);
      return r;
    });
    if (!rows.length) errors.push('people');
    if (errors.length || bad.length) return { ok: false, errors: errors, bad: bad, rows: rows };
    var tot = { fun: 0, time: 0, ferie: 0, fri: 0, tillaeg: 0, social: 0, godtg: 0, forskud: 0, days: 0, total: 0 };
    rows.forEach(function (r) {
      if (r.type === 'time') { tot.time++; tot.godtg += r.godtg; }
      else { tot.fun++; tot.ferie += r.ferieValue; tot.fri += r.friValue; tot.tillaeg += r.tillaeg; tot.social += r.social; tot.forskud += r.forskud; tot.days += Math.max(0, r.days); }
      tot.total += r.total;
    });
    tot.days = Math.round(tot.days * 100) / 100;
    var primoO = ore(primo), change = tot.total - primoO;
    /* posteringsforslag: regulering af skyldige feriepenge (+ forudbetalt ferie som aktiv) */
    var acc = { cost: String(c.kCost || '').trim() || 'Feriepenge', liab: String(c.kLiab || '').trim() || 'Skyldige feriepenge', asset: String(c.kAsset || '').trim() || 'Forudbetalt ferie' };
    var post = [];
    if (change) post.push({ text: 'Regulering af skyldige feriepenge ' + c.end, lines: [{ konto: acc.cost, amount: change }, { konto: acc.liab, amount: -change }] });
    if (tot.forskud) post.push({ text: 'Ferie afholdt på forskud ' + c.end + ' (tilgodehavende)', lines: [{ konto: acc.asset, amount: tot.forskud }, { konto: acc.cost, amount: -tot.forskud }] });
    var principle = c.princip === '1' ? 1 : 2;
    var taxDeduct = principle === 2 ? change : 0;
    if (tot.forskud) warnings.push({ k: 'asset', n: 0 });
    return { ok: true, end: c.end, fa: fa, tStart: tStart, dpm: dpm, socialPct: social, rows: rows, totals: tot, primo: primoO, change: change,
      principle: principle, taxDeduct: taxDeduct, accounts: acc, postings: post, warnings: warnings };
  }
  function sample() {
    return { company: { name: 'Eksempelfirma ApS (syntetisk)', cvr: '12345678', end: '2026-12-31', dpm: '21,67', social: '', primo: '25.000', princip: '2', kCost: '', kLiab: '', kAsset: '' },
      people: [
        { name: 'Anna Andersen', type: 'fun', salary: '42.000', pension: '4.200', start: '', earned: '', prev: '2', taken: '3', fri: '1', paidT: '' },
        { name: 'Bo Berg', type: 'fun', salary: '36.000', pension: '', start: '2026-11-01', earned: '', prev: '', taken: '', fri: '', paidT: '' },
        { name: 'Carla Clausen', type: 'fun', salary: '50.000', pension: '5.000', start: '', earned: '', prev: '', taken: '10', fri: '', paidT: '500' },
        { name: 'Dennis Dahl', type: 'time', unpaid: '18.400' }
      ] };
  }
  return { DAYS_PER_MONTH: DAYS_PER_MONTH, num: num, ferieaar: ferieaar, span: span, earned: earned, addMonths: addMonths, calc: calc, sample: sample };
});
