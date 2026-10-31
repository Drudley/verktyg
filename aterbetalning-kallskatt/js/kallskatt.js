/* Källskatt tillbaka – engine (UMD, no dependencies except CSV for parseFile).
 * Reads an Avanza or Nordnet transaction export, pairs every dividend with its foreign withholding-tax row and works out
 * how much can be reclaimed above the 15 % treaty rate (Swedish tax treaties with FI, NO, DK, CH) per country and year.
 *   parse(text) → {broker, rows:[...], ignored, header}
 *   parseFile(bytes) → same (decodes UTF-8 / UTF-16 / Windows-1252 via CSV.decode)
 *   compute([parsed...], {rates, today:'YYYY-MM-DD', accounts:{name:bool}}) → {items, groups, other, accounts, flags, totals}
 * Money: floats until display; local amounts rounded to 2 decimals per dividend (what the forms ask for). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.KALLSKATT = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TREATY = 0.15;
  /* Source-country rules for a Swedish resident individual (checked 2026-10-31, see README for sources). */
  var COUNTRIES = {
    FI: { cur: 'EUR', statutory: [0.35, 0.30], deadlineYears: 3, deadlineFrom: 'yearEnd', minPayout: 10, waitMonths: 0, form: 'Vero 6164r + 6167r' },
    NO: { cur: 'NOK', statutory: [0.25], deadlineYears: 5, deadlineFrom: 'yearEnd', minPayout: 50, waitMonths: 4, form: 'Skatteetaten – refusjon av kildeskatt' },
    DK: { cur: 'DKK', statutory: [0.27], deadlineYears: 5, deadlineFrom: 'payment', minPayout: 0, waitMonths: 0, form: 'Skattestyrelsen 06.030' },
    CH: { cur: 'CHF', statutory: [0.35], deadlineYears: 3, deadlineFrom: 'yearEnd', minPayout: 0, waitMonths: 0, form: 'ESTV Form 80' }
  };
  var EXCLUDE_ACCOUNT = /kapitalf(ö|o)rs(ä|a)kring|\bkf\b|pension|\bips\b|\btjp\b|f(ö|o)rs(ä|a)kring|insurance/i;

  function num(v) {
    if (typeof v === 'number') return v;
    var s = String(v == null ? '' : v).replace(/[\s\u00a0\u202f']/g, '').replace(/\u2212/g, '-');
    if (!s || s === '-') return NaN;
    var neg = /^\(.*\)$/.test(s); if (neg) s = s.slice(1, -1);
    var c = s.lastIndexOf(','), d = s.lastIndexOf('.');
    if (c > -1 && d > -1) s = c > d ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    else if (c > -1) s = (s.split(',').length > 2) ? s.replace(/,/g, '') : s.replace(',', '.');
    var n = Number(s.replace(/[^0-9.eE+-]/g, ''));
    if (!/[0-9]/.test(s)) return NaN;
    return neg ? -n : n;
  }
  function isoDate(v) {
    var s = String(v || '').trim(), m;
    if ((m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(s))) return m[1] + '-' + m[2] + '-' + m[3];
    if ((m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s))) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    return null;
  }
  var r2 = function (n) { return Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100; };
  function norm(h) { return String(h || '').replace(/^\uFEFF/, '').trim().toLowerCase(); }

  /* Column map. Nordnet repeats "Valuta" after several columns: we take the one right after the column it qualifies. */
  function mapColumns(header) {
    var H = header.map(norm), idx = function () { for (var i = 0; i < arguments.length; i++) { var k = H.indexOf(arguments[i]); if (k > -1) return k; } return -1; };
    var after = function (col) { if (col < 0) return -1; for (var i = col + 1; i < H.length && i <= col + 2; i++) if (H[i] === 'valuta') return i; return -1; };
    var c = {
      date: idx('datum', 'bokföringsdag', 'bokforingsdag', 'likviddag', 'affärsdag'),
      account: idx('konto', 'depå', 'depa', 'konto/depå'),
      type: idx('typ av transaktion', 'transaktionstyp', 'typ'),
      name: idx('värdepapper/beskrivning', 'värdepapper', 'instrument', 'beskrivning'),
      isin: idx('isin'), qty: idx('antal'), price: idx('kurs'), amount: idx('belopp'),
      fx: idx('valutakurs', 'växlingskurs', 'vaxlingskurs'), text: idx('transaktionstext'), cancelled: idx('makuleringsdatum')
    };
    if (detect(header) === 'avanza') {
      /* Avanza: Belopp is in Transaktionsvaluta (SEK unless the column says otherwise); Kurs in Instrumentvaluta.
         Legacy layout has a single "Valuta" = instrument currency and Belopp in SEK. A wrong guess is caught by the per-share cross-check. */
      c.amtCur = idx('transaktionsvaluta'); c.priceCur = idx('instrumentvaluta', 'valuta');
    } else { c.amtCur = after(c.amount); c.priceCur = after(c.price); }
    return c;
  }
  function detect(header) {
    var H = header.map(norm);
    if (H.indexOf('typ av transaktion') > -1 && H.indexOf('belopp') > -1) return 'avanza';
    if (H.indexOf('transaktionstyp') > -1 && H.indexOf('belopp') > -1) return 'nordnet';
    return null;
  }
  function classify(type, text) {
    var T = String(type || '').toUpperCase(), X = String(text || '').toUpperCase();
    if (/PRELIMIN/.test(T)) return null; /* Swedish preliminary tax on AF – not foreign */
    if (/K(Ä|A)LLSKATT|KUPSKATT|KUPONGSKATT|WITHHOLDING/.test(T)) return 'tax';
    if (/^(MAK |KORR |MAKULERING )?UTDELNING|^DIVIDEND/.test(T)) return 'div';
    if (/K(Ä|A)LLSKATT|KUPSKATT/.test(X) && !/UTDELNING/.test(T)) return 'tax';
    return null;
  }

  function parse(text) {
    var C = (typeof CSV !== 'undefined') ? CSV : require('./csv.js');
    var p = C.parse(text), header = p.header, broker = detect(header);
    if (!broker) { var e = new Error('unknown-format'); e.header = header; throw e; }
    var c = mapColumns(header), need = ['date', 'type', 'amount'].filter(function (k) { return c[k] < 0; });
    if (need.length) { var e2 = new Error('missing-columns'); e2.cols = need; throw e2; }
    var rows = [], ignored = 0;
    p.rows.forEach(function (r, i) {
      var get = function (k) { return c[k] > -1 ? String(r[c[k]] == null ? '' : r[c[k]]).trim() : ''; };
      var kind = classify(get('type'), get('text') || get('name'));
      if (!kind) { ignored++; return; }
      /* Nordnet: a row with Makuleringsdatum is cancelled by a MAK row with the opposite sign – keep both, the signed sum nets to zero */
      var date = isoDate(get('date')), amount = num(get('amount'));
      if (!date || isNaN(amount)) { ignored++; return; }
      var isin = get('isin').toUpperCase().replace(/\s/g, '');
      rows.push({
        line: i + 2, broker: broker, date: date, account: get('account') || '–', kind: kind, rawType: get('type'),
        name: get('name'), isin: /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin) ? isin : '', qty: Math.abs(num(get('qty'))) || 0,
        price: num(get('price')), priceCur: get('priceCur').toUpperCase(), amount: amount, amtCur: (get('amtCur') || 'SEK').toUpperCase(),
        fx: num(get('fx')), reversal: /^(MAK|KORR|MAKULERING)/i.test(get('type'))
      });
    });
    return { broker: broker, rows: rows, ignored: ignored, header: header, delimiter: p.delimiter };
  }
  function parseFile(bytes) {
    var C = (typeof CSV !== 'undefined') ? CSV : require('./csv.js');
    if (bytes[0] === 0x50 && bytes[1] === 0x4B) throw new Error('xlsx');
    return parse(C.decode(bytes).text);
  }

  /* ---------- rates ---------- */
  function makeRateLookup(R) {
    var idx = null;
    return function (cur, iso) {
      if (cur === 'SEK') return { value: 1, date: iso.replace(/-/g, '') };
      if (!R || !R[cur]) return null;
      if (!idx) { idx = {}; R.dates.forEach(function (d, i) { idx[d] = i; }); }
      var d = iso.replace(/-/g, '');
      if (d > R.to) { for (var j = R.dates.length - 1; j >= 0; j--) if (R[cur][j] != null) return { value: R[cur][j], date: R.dates[j], beyond: true }; return null; }
      if (d < R.from) return null;
      var dt = new Date(Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8)));
      for (var k = 0; k <= 10; k++) {
        var s = dt.toISOString().slice(0, 10).replace(/-/g, '');
        if (idx[s] != null && R[cur][idx[s]] != null) return { value: R[cur][idx[s]], date: s };
        dt.setUTCDate(dt.getUTCDate() - 1);
      }
      return null;
    };
  }

  /* ---------- dates ---------- */
  function addYears(iso, n) { return (+iso.slice(0, 4) + n) + iso.slice(4); }
  function addMonths(iso, n) { var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1 + n, +iso.slice(8, 10))); return d.toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000); }
  function deadlineFor(cc, date) {
    var R = COUNTRIES[cc];
    return R.deadlineFrom === 'payment' ? addYears(date, R.deadlineYears) : (+date.slice(0, 4) + R.deadlineYears) + '-12-31';
  }
  function statusFor(cc, date, today) {
    var dl = deadlineFor(cc, date), R = COUNTRIES[cc];
    if (today > dl) return { code: 'expired', deadline: dl };
    if (R.waitMonths && today < addMonths(date, R.waitMonths)) return { code: 'wait', deadline: dl, from: addMonths(date, R.waitMonths) };
    var left = daysBetween(today, dl);
    return { code: left <= 120 ? 'urgent' : 'open', deadline: dl, daysLeft: left };
  }

  /* ---------- compute ---------- */
  function compute(parsedList, opts) {
    opts = opts || {};
    var today = opts.today || new Date().toISOString().slice(0, 10), rb = makeRateLookup(opts.rates), flags = [], accounts = {};
    var all = [];
    [].concat(parsedList).forEach(function (p, fi) { p.rows.forEach(function (r) { all.push(Object.assign({ file: fi }, r)); }); });
    /* de-duplicate identical rows when the same export is dropped twice (or overlapping periods) */
    var seen = {}, dups = 0;
    all = all.filter(function (r) { var k2 = [r.broker, r.date, r.account, r.kind, r.rawType, r.isin || r.name, r.qty, r.amount].join('|'); if (seen[k2] != null && seen[k2] !== r.file) { dups++; return false; } seen[k2] = r.file; return true; });
    if (dups) flags.push({ code: 'duplicates', n: dups });

    all.forEach(function (r) {
      if (!accounts[r.account]) accounts[r.account] = { name: r.account, auto: !EXCLUDE_ACCOUNT.test(r.account), rows: 0 };
      accounts[r.account].rows++;
    });
    Object.keys(accounts).forEach(function (a) { var o = opts.accounts && opts.accounts[a]; accounts[a].included = (o == null) ? accounts[a].auto : !!o; });

    var secKey = function (r) { return r.account + '|' + (r.isin || r.name.toLowerCase().replace(/\s+/g, ' ')); };
    var events = {}, order = [];
    function ev(r) {
      var k = secKey(r) + '|' + r.date;
      if (!events[k]) { events[k] = { key: k, sec: secKey(r), date: r.date, account: r.account, isin: r.isin, name: r.name, broker: r.broker, div: [], tax: [] }; order.push(k); }
      if (!events[k].isin && r.isin) events[k].isin = r.isin;
      return events[k];
    }
    all.filter(function (r) { return r.kind === 'div'; }).forEach(function (r) { ev(r).div.push(r); });
    /* tax rows: same security & date, else nearest dividend of the same security within ±7 days */
    var orphans = [];
    all.filter(function (r) { return r.kind === 'tax'; }).forEach(function (r) {
      var k = secKey(r) + '|' + r.date;
      if (events[k] && events[k].div.length) { events[k].tax.push(r); return; }
      var best = null, bd = 99;
      order.forEach(function (kk) { var e = events[kk]; if (e.sec === secKey(r) && e.div.length) { var d = Math.abs(daysBetween(e.date, r.date)); if (d < bd) { bd = d; best = e; } } });
      if (!best && !r.isin) { /* Avanza sometimes puts only the name on the tax row: match on name across ISIN-keyed events */
        order.forEach(function (kk) { var e = events[kk]; if (e.account === r.account && e.name.toLowerCase() === r.name.toLowerCase() && e.div.length) { var d = Math.abs(daysBetween(e.date, r.date)); if (d < bd) { bd = d; best = e; } } });
      }
      if (best && bd <= 7) best.tax.push(r); else orphans.push(r);
    });
    orphans.forEach(function (r) { flags.push({ code: 'orphan-tax', line: r.line, file: r.file, date: r.date, name: r.name, amount: r.amount, account: r.account }); });

    var items = [], other = {};
    order.forEach(function (k) {
      var e = events[k];
      if (!e.div.length) return;
      if (!accounts[e.account].included) return;
      var cur = e.div[0].amtCur, mixed = e.div.concat(e.tax).some(function (r) { return r.amtCur !== cur; });
      var grossAmt = e.div.reduce(function (s, r) { return s + r.amount; }, 0), taxAmt = -e.tax.reduce(function (s, r) { return s + r.amount; }, 0);
      if (Math.abs(grossAmt) < 0.005 && Math.abs(taxAmt) < 0.005) return; /* fully reversed */
      var it = { date: e.date, year: +e.date.slice(0, 4), account: e.account, isin: e.isin, name: e.name, broker: e.broker,
        lines: e.div.concat(e.tax).map(function (r) { return r.line; }), file: e.div[0].file, flags: [] };
      if (e.div.some(function (r) { return r.reversal; }) || e.tax.some(function (r) { return r.reversal; })) it.flags.push('reversal');
      if (mixed) it.flags.push('mixed-currency');
      var r0 = e.div.filter(function (r) { return !r.reversal; })[0] || e.div[0];
      it.qty = r0.qty; it.perShare = isNaN(r0.price) ? null : Math.abs(r0.price); it.perShareCur = r0.priceCur || '';
      /* amounts in SEK */
      var toSek = cur === 'SEK' ? { value: 1 } : rb(cur, e.date);
      if (!toSek) { it.flags.push('no-rate'); toSek = { value: NaN }; }
      it.grossSek = grossAmt * toSek.value; it.taxSek = taxAmt * toSek.value; it.amtCur = cur;
      it.rate = grossAmt > 0 ? taxAmt / grossAmt : 0;
      var cc = e.isin ? e.isin.slice(0, 2) : '';
      it.country = cc;
      if (taxAmt < -0.005) it.flags.push('refund-seen');
      if (!COUNTRIES[cc]) {
        var o = other[cc || '??'] || (other[cc || '??'] = { country: cc || '??', n: 0, grossSek: 0, taxSek: 0, excessSek: 0 });
        o.n++; o.grossSek += it.grossSek; o.taxSek += it.taxSek; o.excessSek += Math.max(0, it.taxSek - TREATY * it.grossSek);
        if (!cc) flags.push({ code: 'no-isin', date: e.date, name: e.name, line: it.lines[0], file: it.file });
        return;
      }
      var R = COUNTRIES[cc], L = R.cur;
      /* gross in the authority's currency */
      var local = null, how = '';
      if (cur === L) { local = grossAmt; how = 'file-amount'; }
      else {
        var ref = rb(L, e.date), refSek = ref ? it.grossSek / ref.value : NaN;
        if (it.qty > 0 && it.perShare > 0) {
          var byShare = it.qty * it.perShare;
          if ((it.perShareCur === L || !it.perShareCur) && (!isFinite(refSek) || Math.abs(byShare / refSek - 1) <= 0.06)) { local = byShare; how = 'per-share'; }
        }
        if (local == null && isFinite(refSek)) { local = refSek; how = 'riksbank'; it.rbDate = ref.date; if (ref.beyond) it.flags.push('rate-beyond-table'); }
        if (local == null) { it.flags.push('no-rate'); local = NaN; }
      }
      it.cur = L; it.how = how;
      it.gross = r2(local);
      it.withheld = grossAmt ? r2(local * taxAmt / grossAmt) : 0;
      it.treaty = r2(it.gross * TREATY);
      it.reclaim = Math.max(0, r2(it.withheld - it.treaty));
      it.reclaimSek = grossAmt ? Math.max(0, it.taxSek - TREATY * it.grossSek) : 0;
      if (how === 'riksbank') it.flags.push('fx-riksbank');
      if (e.tax.length === 0) it.flags.push('no-tax-row');
      else if (it.rate > TREATY + 0.005 && R.statutory.every(function (s) { return Math.abs(it.rate - s) > 0.012; })) it.flags.push('odd-rate');
      var s = statusFor(cc, e.date, today); it.status = s.code; it.deadline = s.deadline; it.waitUntil = s.from; it.daysLeft = s.daysLeft;
      items.push(it);
    });
    items.sort(function (a, b) { return a.country < b.country ? -1 : a.country > b.country ? 1 : a.date < b.date ? -1 : a.date > b.date ? 1 : a.name < b.name ? -1 : 1; });

    /* groups: country × year (one application per year for FI 6167r; NO/DK/CH can batch but we keep the same split) */
    var groups = {};
    items.forEach(function (it) {
      var g = groups[it.country + it.year] || (groups[it.country + it.year] = { country: it.country, year: it.year, cur: it.cur, n: 0, gross: 0, withheld: 0, reclaim: 0, reclaimSek: 0, grossSek: 0, taxSek: 0, statuses: {}, deadline: null, items: [] });
      g.n++; g.gross += it.gross; g.withheld += it.withheld; g.reclaim += it.reclaim; g.reclaimSek += it.reclaimSek; g.grossSek += it.grossSek; g.taxSek += it.taxSek;
      g.statuses[it.status] = (g.statuses[it.status] || 0) + (it.reclaim > 0 ? 1 : 0); g.items.push(it);
      if (!g.deadline || it.deadline < g.deadline) g.deadline = it.deadline;
    });
    var glist = Object.keys(groups).map(function (k) {
      var g = groups[k]; g.gross = r2(g.gross); g.withheld = r2(g.withheld); g.reclaim = r2(g.reclaim);
      var open = g.items.filter(function (i) { return i.reclaim > 0 && (i.status === 'open' || i.status === 'urgent' || i.status === 'wait'); });
      g.reclaimOpen = r2(open.reduce(function (s, i) { return s + i.reclaim; }, 0));
      g.reclaimOpenSek = open.reduce(function (s, i) { return s + i.reclaimSek; }, 0);
      g.status = g.reclaim <= 0 ? 'nothing' : g.statuses.urgent ? 'urgent' : g.statuses.open ? 'open' : g.statuses.wait ? 'wait' : 'expired';
      g.belowMin = COUNTRIES[g.country].minPayout > 0 && g.reclaimOpen > 0 && g.reclaimOpen < COUNTRIES[g.country].minPayout;
      return g;
    }).sort(function (a, b) { return a.country < b.country ? -1 : a.country > b.country ? 1 : a.year - b.year; });

    var totals = { reclaimOpenSek: 0, reclaimExpiredSek: 0, n: items.length };
    items.forEach(function (i) { if (i.reclaim > 0) { if (i.status === 'expired') totals.reclaimExpiredSek += i.reclaimSek; else totals.reclaimOpenSek += i.reclaimSek; } });
    if (opts.rates && opts.rates.to) totals.rateTo = opts.rates.to;
    return { items: items, groups: glist, other: Object.keys(other).map(function (k) { return other[k]; }), accounts: accounts, flags: flags, totals: totals, today: today };
  }

  return { compute: compute, parse: parse, parseFile: parseFile, num: num, isoDate: isoDate, COUNTRIES: COUNTRIES, TREATY: TREATY,
    deadlineFor: deadlineFor, statusFor: statusFor, makeRateLookup: makeRateLookup, EXCLUDE_ACCOUNT: EXCLUDE_ACCOUNT, detect: detect };
});
