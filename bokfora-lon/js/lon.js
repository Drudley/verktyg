/* Bokföra lön – lönelista → verifikationer, arbetsgivaravgifter och AGI-belopp (no DOM). UMD: window.LON / require('./lon.js').
   Rules (Skatteverket "Arbetsgivaravgifter", "Belopp och procent 2026", SKV 4786, "När ska jag lämna arbetsgivardeklarationen"):
   full 31,42 % (420/430); fyllt 67 vid årets ingång (2026: födda 1938–1958) 10,21 % (422/432); födda 1937 eller tidigare 0 % (423/433);
   19–23 år (2026: födda 2003–2007) 20,81 % on up to 25 000 kr per person and calendar month, paid 2026-04-01–2027-09-30 (7001/9001),
   full fee on the excess. AGI amounts are whole kronor; the fee is computed per rate on the summed base and öre are dropped.
   Individuppgift: 011 kontant bruttolön, 012 övriga förmåner, 013 bilförmån, 001 avdragen skatt; huvuduppgift 487 / 497.
   Booking (BAS 2026): pay date D 7210/7010/7220 gross, C 2710 tax, C 1930 net; month end D 7510 C 2731; deadline D 2710 + 2731 C 1630.
   Requires window.CSV (csv.js) or require('./csv.js'). Amounts in öre (integers). */
(function (root, f) { if (typeof module === 'object' && module.exports) module.exports = f(require('./csv.js')); else root.LON = f(root.CSV); })(this, function (CSV) {
  'use strict';
  var ACCOUNTS = { '7010': 'Löner till kollektivanställda', '7210': 'Löner till tjänstemän', '7220': 'Löner till företagsledare', '7510': 'Arbetsgivaravgifter 31,42 %', '2710': 'Personalskatt', '2731': 'Avräkning lagstadgade sociala avgifter', '1630': 'Avräkning för skatter och avgifter (skattekonto)', '1930': 'Företagskonto' };
  var CAT = { full: { rate: 31.42, u: '420', a: '430', sv: 'Full avgift 31,42 %', en: 'Full rate 31.42%' }, youth: { rate: 20.81, u: '7001', a: '9001', sv: 'Unga 19–23 år 20,81 %', en: 'Age 19–23 20.81%' }, old: { rate: 10.21, u: '422', a: '432', sv: 'Endast ålderspensionsavgift 10,21 %', en: 'Old-age pension fee only 10.21%' }, none: { rate: 0, u: '423', a: '433', sv: 'Ingen avgift (född 1937 eller tidigare)', en: 'No fee (born 1937 or earlier)' } };
  var ORDER = ['full', 'youth', 'old', 'none'];
  var YOUTH_CAP = 2500000, YOUTH_FROM = '2026-04-01', YOUTH_TO = '2027-09-30';
  // Skatteverket table for pay months in 2026 (turnover up to 40 mkr)
  var DUE = { '2026-01': '2026-02-12', '2026-02': '2026-03-12', '2026-03': '2026-04-13', '2026-04': '2026-05-12', '2026-05': '2026-06-12', '2026-06': '2026-07-13', '2026-07': '2026-08-17', '2026-08': '2026-09-14', '2026-09': '2026-10-12', '2026-10': '2026-11-12', '2026-11': '2026-12-14', '2026-12': '2027-01-18' };
  var COLS = { date: ['utbetalningsdag', 'utbetalningsdatum', 'datum', 'månad', 'manad', 'date', 'pay date'], name: ['namn', 'anställd', 'anstalld', 'name', 'employee'], born: ['personnummer', 'födelseår', 'fodelsear', 'född', 'fodd', 'pnr', 'born', 'birth year'], typ: ['typ', 'kategori', 'konto', 'type'], brutto: ['bruttolön', 'bruttolon', 'brutto', 'lön', 'lon', 'gross', 'gross pay'], forman: ['förmåner', 'förmån', 'forman', 'formaner', 'benefits'], bil: ['bilförmån', 'bilforman', 'car benefit'], skatt: ['skatteavdrag', 'skatt', 'preliminärskatt', 'tax'] };
  var POS = ['date', 'name', 'born', 'typ', 'brutto', 'forman', 'skatt'];
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function isoDate(s, day) {
    s = String(s || '').trim(); var m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s) || /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (m) return m[1] + '-' + pad(+m[2]) + '-' + pad(+m[3]);
    m = /^(\d{4})-(\d{1,2})$/.exec(s); if (m) { var d = Math.min(+day || 25, new Date(Date.UTC(+m[1], +m[2], 0)).getUTCDate()); return m[1] + '-' + pad(+m[2]) + '-' + pad(d); }
    m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s); if (m) return m[3] + '-' + pad(+m[2]) + '-' + pad(+m[1]);
    return '';
  }
  function birthYear(s, payYear) {
    s = String(s || '').replace(/\s/g, ''); var m;
    if ((m = /^(\d{4})$/.exec(s))) return +m[1];
    if ((m = /^(\d{4})\d{4}[-+]?\d{0,4}$/.exec(s)) && +m[1] > 1880) return +m[1];
    if ((m = /^(\d{2})\d{4}([-+]?)\d{0,4}$/.exec(s))) { var yy = +m[1], c = yy > payYear % 100 ? 1900 : 2000; if (m[2] === '+') c -= 100; return c + yy; }
    return 0;
  }
  function typAcc(s, def) {
    s = String(s || '').trim().toLowerCase(); if (/^\d{4}$/.test(s)) return s;
    if (/^(kol|koll|arb)/.test(s)) return '7010'; if (/^(f[öo]retagsl|fl$|[äa]gare|vd)/.test(s)) return '7220'; if (/^(tj)/.test(s)) return '7210'; return def;
  }
  function parseText(text, opt) {
    opt = opt || {}; text = String(text || '').replace(/^\ufeff/, '');
    if (!text.trim()) return { ok: false, rows: [], skipped: 0, header: false };
    var delim = CSV.detectDelimiter(text), p = CSV.parse(text, delim), H = p.header.map(function (h) { return h.toLowerCase().trim(); });
    var idx = {}, hits = 0; Object.keys(COLS).forEach(function (k) { idx[k] = -1; COLS[k].some(function (n) { var i = H.indexOf(n); if (i >= 0 && Object.keys(idx).every(function (j) { return idx[j] !== i; })) { idx[k] = i; hits++; return true; } return false; }); });
    var body = p.rows, header = hits >= 3;
    if (!header) { idx = {}; Object.keys(COLS).forEach(function (k) { idx[k] = POS.indexOf(k); }); body = [p.header].concat(p.rows); }
    var dc = delim !== ',', rows = [], skipped = 0;
    body.forEach(function (r) {
      if (!r.length || r.every(function (c) { return !String(c).trim(); })) return;
      var g = function (k) { return idx[k] >= 0 && r[idx[k]] != null ? String(r[idx[k]]).trim() : ''; };
      var num = function (k) { var v = g(k); if (!v) return 0; var n = CSV.toMinor(v.replace(/kr$/i, '').trim(), dc); return isNaN(n) ? NaN : n; };
      var date = isoDate(g('date'), opt.day), brutto = num('brutto'), forman = num('forman'), bil = num('bil'), skatt = num('skatt');
      if (!date || [brutto, forman, bil, skatt].some(isNaN)) { skipped++; return; }
      rows.push({ date: date, month: date.slice(0, 7), name: g('name') || 'Anställd', born: g('born'), by: birthYear(g('born'), +date.slice(0, 4)), typRaw: g('typ'), brutto: brutto, forman: forman, bil: bil, skatt: skatt });
    });
    return { ok: rows.length > 0, rows: rows, skipped: skipped, header: header };
  }
  function category(by, date) {
    var Y = +date.slice(0, 4);
    if (!by) return 'full';
    if (by <= 1937) return 'none';
    if (by <= Y - 68) return 'old';
    if (date >= YOUTH_FROM && date <= YOUTH_TO && by >= Y - 23 && by <= Y - 19) return 'youth';
    return 'full';
  }
  function nextWeekday(iso) { var d = new Date(iso + 'T12:00:00Z'); while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
  function dueDate(month) {
    if (DUE[month]) return { date: DUE[month], table: true };
    var y = +month.slice(0, 4), m = +month.slice(5, 7) + 1; if (m > 12) { m = 1; y++; }
    return { date: nextWeekday(y + '-' + pad(m) + '-' + (m === 1 || m === 8 ? '17' : '12')), table: false };
  }
  function lastDay(month) { var y = +month.slice(0, 4), m = +month.slice(5, 7); return month + '-' + pad(new Date(Date.UTC(y, m, 0)).getUTCDate()); }
  function kr(ore) { return ore < 0 ? -Math.floor(-ore / 100) : Math.floor(ore / 100); }
  function acc(s, d) { s = String(s == null ? '' : s).trim(); return /^\d{4}$/.test(s) ? s : d; }
  function build(parsed, opt) {
    opt = opt || {};
    var A = { bank: acc(opt.bank, '1930'), tax: acc(opt.tax, '2710'), fee: acc(opt.fee, '7510'), feeDebt: acc(opt.feeDebt, '2731'), skv: acc(opt.skv, '1630'), def: acc(opt.lon, '7210') };
    var skvOn = opt.skvOn !== '0' && opt.skvOn !== false, serie = String(opt.serie || 'A').trim() || 'A', nr = Math.max(1, parseInt(opt.nr, 10) || 1);
    var warn = { year: 0, noBirth: [], negNet: [], ore: 0, guessedDue: [], skipped: parsed && parsed.skipped || 0 };
    var rows = []; (parsed && parsed.rows || []).forEach(function (r) {
      var Y = +r.date.slice(0, 4); if (Y < 2026 || Y > 2027 || (Y === 2027 && r.date > YOUTH_TO)) { warn.year++; return; }
      if ([r.brutto, r.forman, r.bil, r.skatt].some(function (v) { return v % 100; })) warn.ore++;
      if (!r.by && warn.noBirth.indexOf(r.name) < 0) warn.noBirth.push(r.name);
      rows.push(Object.assign({}, r, { acc: typAcc(r.typRaw, A.def), b: kr(r.brutto), f: kr(r.forman), c: kr(r.bil), s: kr(r.skatt) }));
    });
    if (!rows.length) return { ok: false, warn: warn, months: [], vouchers: [] };
    rows.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    var months = {}, order = [];
    rows.forEach(function (r) {
      var M = months[r.month]; if (!M) { M = months[r.month] = { month: r.month, rows: [], people: {}, pays: {} }; order.push(r.month); }
      M.rows.push(r); var key = (r.born || r.name).toLowerCase() + '|' + r.name.toLowerCase();
      var P = M.people[key]; if (!P) P = M.people[key] = { name: r.name, born: r.born, by: r.by, b: 0, f: 0, c: 0, s: 0, cat: category(r.by, r.date), lastDate: r.date };
      P.b += r.b; P.f += r.f; P.c += r.c; P.s += r.s; if (r.date > P.lastDate) P.lastDate = r.date;
      var D = M.pays[r.date]; if (!D) D = M.pays[r.date] = { date: r.date, gross: {}, tax: 0, n: 0 };
      D.gross[r.acc] = (D.gross[r.acc] || 0) + r.brutto; D.tax += r.skatt; D.n++;
    });
    var vouchers = [], out = [], T = { b: 0, f: 0, c: 0, s: 0, fee: 0, net: 0, cost: 0, people: 0 }, accounts = {};
    function use(k) { accounts[k] = ACCOUNTS[k] || ('Konto ' + k); }
    order.forEach(function (mk) {
      var M = months[mk], base = { full: 0, youth: 0, old: 0, none: 0 }, ind = [];
      Object.keys(M.people).forEach(function (k) {
        var P = M.people[k], u = P.b + P.f + P.c, cat = category(P.by, P.lastDate);
        if (cat === 'youth') { var y = Math.min(u, YOUTH_CAP / 100); base.youth += y; base.full += u - y; } else base[cat] += u;
        ind.push({ name: P.name, born: P.born, f011: P.b, f012: P.f, f013: P.c, f001: P.s, cat: cat, over: cat === 'youth' ? Math.max(0, u - YOUTH_CAP / 100) : 0 });
      });
      var lines = ORDER.filter(function (c) { return base[c]; }).map(function (c) { return { cat: c, rate: CAT[c].rate, u: CAT[c].u, a: CAT[c].a, base: base[c], fee: Math.floor(base[c] * Math.round(CAT[c].rate * 100) / 10000) }; });
      var fee = lines.reduce(function (s, l) { return s + l.fee; }, 0), tax = ind.reduce(function (s, i) { return s + i.f001; }, 0);
      var due = dueDate(mk); if (!due.table) warn.guessedDue.push(mk);
      var sums = { b: 0, f: 0, c: 0 }; ind.forEach(function (i) { sums.b += i.f011; sums.f += i.f012; sums.c += i.f013; });
      // vouchers: one per pay date, then fees at month end, then the tax account debit on the due date
      Object.keys(M.pays).sort().forEach(function (d) {
        var D = M.pays[d], tr = [], gross = 0;
        Object.keys(D.gross).sort().forEach(function (k) { if (D.gross[k]) { tr.push({ konto: k, amount: D.gross[k] }); use(k); gross += D.gross[k]; } });
        if (D.tax) { tr.push({ konto: A.tax, amount: -D.tax }); use(A.tax); }
        var net = gross - D.tax; if (net) { tr.push({ konto: A.bank, amount: -net }); use(A.bank); }
        if (net < 0) warn.negNet.push(d);
        T.net += net;
        if (tr.length) vouchers.push({ date: d, text: 'Lön utbetald ' + d + ' (' + D.n + (D.n === 1 ? ' rad' : ' rader') + ')', trans: tr, kind: 'pay' });
      });
      if (fee) { vouchers.push({ date: lastDay(mk), text: 'Arbetsgivaravgifter ' + mk, trans: [{ konto: A.fee, amount: fee * 100 }, { konto: A.feeDebt, amount: -fee * 100 }], kind: 'fee' }); use(A.fee); use(A.feeDebt); }
      if (skvOn && (fee || tax)) { var t2 = []; if (tax) t2.push({ konto: A.tax, amount: tax * 100 }); if (fee) t2.push({ konto: A.feeDebt, amount: fee * 100 }); t2.push({ konto: A.skv, amount: -(tax + fee) * 100 }); use(A.skv); vouchers.push({ date: due.date, text: 'Arbetsgivardeklaration ' + mk + ' – skatt och avgifter från skattekontot', trans: t2, kind: 'skv' }); }
      var grossOre = M.rows.reduce(function (s, r) { return s + r.brutto; }, 0);
      out.push({ month: mk, due: due.date, dueTable: due.table, people: ind.length, b: sums.b, f: sums.f, c: sums.c, s: tax, lines: lines, r487: fee, r497: tax, fee: fee, cost: grossOre / 100 + fee, ind: ind });
      T.b += sums.b; T.f += sums.f; T.c += sums.c; T.s += tax; T.fee += fee; T.cost += grossOre / 100 + fee; T.people = Math.max(T.people, ind.length);
    });
    vouchers = vouchers.map(function (v, i) { v.i = i; return v; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.i - b.i; });
    vouchers.forEach(function (v, i) { v.serie = serie; v.nr = nr + i; });
    return { ok: true, months: out, vouchers: vouchers, totals: T, accounts: accounts, A: A, skvOn: skvOn, warn: warn, from: out[0].month, to: out[out.length - 1].month, rows: rows };
  }
  function sampleCsv() {
    var L = ['Utbetalningsdag;Namn;Personnummer;Typ;Bruttolön;Förmåner;Skatteavdrag'];
    ['2026-03-25', '2026-04-24', '2026-05-25'].forEach(function (d) {
      L.push(d + ';Anna Ägare;19800412-1234;företagsledare;40000;0;11000');
      L.push(d + ';Erik Ung;20050301-5678;tjänsteman;28000;1000;6200');
      L.push(d + ';Gun Senior;19580715-9012;kollektiv;12000;0;1900');
    });
    return L.join('\n') + '\n';
  }
  return { parseText: parseText, build: build, category: category, birthYear: birthYear, dueDate: dueDate, sampleCsv: sampleCsv, CAT: CAT, ACCOUNTS: ACCOUNTS };
});
