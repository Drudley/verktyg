/* Kontrollbalansräkning engine (25 kap. 13–17 §§ ABL). Pure functions, runs in browser and Node. Amounts in integer öre.
   Presentation sign: assets positive, eget kapital / reserver / avsättningar / skulder positive (SIE credit sign flipped). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.KBR = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TAX = 0.206; // bolagsskatt 20,6 % – uppskjuten skatt på obeskattade reserver

  // Balance sheet rows by BAS range [from, to] (inclusive, 4-digit account numbers)
  var ROWS = [
    { key: 'immat', side: 'T', from: 1000, to: 1099, sv: 'Immateriella anläggningstillgångar', en: 'Intangible fixed assets' },
    { key: 'byggn', side: 'T', from: 1100, to: 1199, sv: 'Byggnader och mark', en: 'Buildings and land' },
    { key: 'mask', side: 'T', from: 1200, to: 1299, sv: 'Maskiner och inventarier', en: 'Machinery and equipment' },
    { key: 'fin', side: 'T', from: 1300, to: 1399, sv: 'Finansiella anläggningstillgångar', en: 'Financial fixed assets' },
    { key: 'lager', side: 'T', from: 1400, to: 1499, sv: 'Varulager och pågående arbeten', en: 'Inventory and work in progress' },
    { key: 'kund', side: 'T', from: 1500, to: 1599, sv: 'Kundfordringar', en: 'Trade receivables' },
    { key: 'ovfordr', side: 'T', from: 1600, to: 1699, sv: 'Övriga kortfristiga fordringar', en: 'Other current receivables' },
    { key: 'forutb', side: 'T', from: 1700, to: 1799, sv: 'Förutbetalda kostnader och upplupna intäkter', en: 'Prepaid expenses and accrued income' },
    { key: 'plac', side: 'T', from: 1800, to: 1899, sv: 'Kortfristiga placeringar', en: 'Short-term investments' },
    { key: 'kassa', side: 'T', from: 1900, to: 1999, sv: 'Kassa och bank', en: 'Cash and bank' },
    { key: 'ak', side: 'EK', from: 2081, to: 2081, sv: 'Aktiekapital', en: 'Share capital' },
    { key: 'ejreg', side: 'EK', from: 2082, to: 2082, sv: 'Ej registrerat aktiekapital', en: 'Unregistered share capital' },
    { key: 'bundet', side: 'EK', from: 2083, to: 2089, sv: 'Övrigt bundet eget kapital', en: 'Other restricted equity' },
    { key: 'fritt', side: 'EK', from: 2090, to: 2098, sv: 'Fritt eget kapital (balanserat resultat m.m.)', en: 'Unrestricted equity (retained earnings etc.)' },
    { key: 'arsres', side: 'EK', from: 2099, to: 2099, sv: 'Årets resultat (bokfört på 2099)', en: 'Result for the year (booked on 2099)' },
    { key: 'ovek', side: 'EK', from: 2000, to: 2080, sv: 'Övrigt eget kapital', en: 'Other equity' },
    { key: 'period', side: 'EK', from: 3000, to: 8999, sv: 'Periodens resultat (resultatkonton, ej avslutat)', en: 'Result for the period (P&L accounts, not closed)' },
    { key: 'or', side: 'OR', from: 2100, to: 2199, sv: 'Obeskattade reserver', en: 'Untaxed reserves' },
    { key: 'avs', side: 'AVS', from: 2200, to: 2299, sv: 'Avsättningar', en: 'Provisions' },
    { key: 'lang', side: 'SK', from: 2300, to: 2399, sv: 'Långfristiga skulder', en: 'Long-term liabilities' },
    { key: 'kort', side: 'SK', from: 2400, to: 2999, sv: 'Kortfristiga skulder', en: 'Current liabilities' }
  ];
  var ROWMAP = {}; ROWS.forEach(function (r) { ROWMAP[r.key] = r; });

  function rowFor(konto) {
    var n = parseInt(String(konto).slice(0, 4), 10);
    if (!isFinite(n)) return null;
    for (var i = 0; i < ROWS.length; i++) if (n >= ROWS[i].from && n <= ROWS[i].to) return ROWS[i];
    return null;
  }
  function isBalance(konto) { var c = String(konto).charAt(0); return c === '1' || c === '2'; }

  // ---------- dates ----------
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function toIso(d8) { d8 = String(d8 || ''); return d8.length === 8 ? d8.slice(0, 4) + '-' + d8.slice(4, 6) + '-' + d8.slice(6, 8) : d8; }
  function to8(iso) { return String(iso || '').replace(/-/g, ''); }
  function parseIso(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
  function fmtIso(d) { return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function addDays(iso, n) { var d = parseIso(iso); if (!d) return ''; d.setUTCDate(d.getUTCDate() + n); return fmtIso(d); }
  function addMonths(iso, n) {
    var d = parseIso(iso); if (!d) return '';
    var y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return fmtIso(new Date(Date.UTC(y, m, Math.min(day, last))));
  }
  function monthEnd(iso) { var d = parseIso(iso); return fmtIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))); }

  // ---------- SIE → balances ----------
  function transDate(v, t) { return t.date || v.date || ''; }
  function lastVoucherDate(doc) {
    var last = '';
    (doc.vouchers || []).forEach(function (v) { (v.trans || []).forEach(function (t) { if (t.kind && t.kind !== 'TRANS') return; var d = transDate(v, t); if (d > last) last = d; }); });
    return last;
  }
  /** Account balances (SIE sign) at cutoff (YYYYMMDD) for fiscal year '0'. Balance accounts = IB + transactions ≤ cutoff;
      result accounts = transactions ≤ cutoff. Without vouchers: UB + RES of the year (cutoff = year end). */
  function balancesAt(doc, cutoff8) {
    var bal = {}, src = 'ver';
    var hasVer = (doc.vouchers || []).length > 0;
    if (hasVer) {
      var ib = (doc.ib && doc.ib['0']) || {};
      Object.keys(ib).forEach(function (k) { if (isBalance(k)) bal[k] = (bal[k] || 0) + ib[k]; });
      doc.vouchers.forEach(function (v) {
        (v.trans || []).forEach(function (t) {
          if (t.kind && t.kind !== 'TRANS') return;
          var d = transDate(v, t); if (cutoff8 && d > cutoff8) return;
          bal[t.konto] = (bal[t.konto] || 0) + t.amount;
        });
      });
    } else {
      src = 'ub';
      var ub = (doc.ub && doc.ub['0']) || {}, res = (doc.res && doc.res['0']) || {};
      Object.keys(ub).forEach(function (k) { bal[k] = (bal[k] || 0) + ub[k]; });
      Object.keys(res).forEach(function (k) { bal[k] = (bal[k] || 0) + res[k]; });
    }
    return { bal: bal, source: src };
  }

  /** Group SIE balances into presentation rows. Returns position object used by compute(). */
  function position(bal) {
    var book = {}, accounts = {}, unknown = 0;
    ROWS.forEach(function (r) { book[r.key] = 0; accounts[r.key] = []; });
    Object.keys(bal).forEach(function (k) {
      var v = bal[k]; if (!v) return;
      var r = rowFor(k);
      if (!r) { unknown += v; return; }
      var pres = r.side === 'T' ? v : -v;
      book[r.key] += pres;
      accounts[r.key].push({ konto: k, amount: pres });
    });
    Object.keys(accounts).forEach(function (k) { accounts[k].sort(function (a, b) { return a.konto < b.konto ? -1 : 1; }); });
    return { book: book, accounts: accounts, unknown: unknown };
  }
  function sumSide(book, side) { var s = 0; ROWS.forEach(function (r) { if (r.side === side) s += book[r.key] || 0; }); return s; }

  /** Manual figures → position (all in öre, presentation sign). */
  function manualPosition(m) {
    var book = {}; ROWS.forEach(function (r) { book[r.key] = 0; });
    book.ak = m.aktiekapital || 0; book.fritt = m.ovrigtEk || 0; book.or = m.or || 0;
    book.avs = m.avs || 0; book.lang = m.lang || 0; book.kort = m.kort || 0;
    var liab = book.ak + book.fritt + book.or + book.avs + book.lang + book.kort;
    book.kassa = m.tillgangar != null && m.tillgangar !== '' ? m.tillgangar : liab; // assets default: balancing figure
    var accounts = {}; ROWS.forEach(function (r) { accounts[r.key] = []; });
    return { book: book, accounts: accounts, unknown: 0, manual: true };
  }

  /** Core KBR computation.
      opts.registered: registrerat aktiekapital (öre); default = book.ak
      opts.adjustments: [{row, delta (öre, + = row value increases), tax (bool), text, motiv}]
      opts.taxRate: default 0.206 */
  function compute(pos, opts) {
    opts = opts || {};
    var rate = opts.taxRate == null ? TAX : opts.taxRate;
    var b = pos.book;
    var T = sumSide(b, 'T'), EK = sumSide(b, 'EK'), OR = b.or || 0, AVS = sumSide(b, 'AVS'), SK = sumSide(b, 'SK');
    var diff = T - (EK + OR + AVS + SK);
    var registered = opts.registered != null ? opts.registered : (b.ak || 0);
    var orTax = Math.round(OR * rate), orEk = OR - orTax;

    var adj = {}, adjList = [], adjEffect = 0, adjTax = 0;
    ROWS.forEach(function (r) { adj[r.key] = 0; });
    (opts.adjustments || []).forEach(function (a) {
      var r = ROWMAP[a.row]; if (!r || !a.delta) return;
      if (r.side === 'EK' || r.side === 'OR') return; // EK and reserver are not adjusted directly
      var effect = r.side === 'T' ? a.delta : -a.delta;
      var tax = a.tax && effect > 0 ? Math.round(effect * rate) : 0;
      adj[r.key] += a.delta; adjEffect += effect; adjTax += tax;
      adjList.push({ row: r.key, delta: a.delta, effect: effect, tax: tax, text: a.text || '', motiv: a.motiv || '', kind: a.kind || '' });
    });

    var ekBook = EK;                       // bokfört eget kapital inkl. periodens resultat
    var ekJust = ekBook + orEk;            // justerat EK utan KBR-justeringar (skäl-att-anta-testet)
    var ekKbr = ekJust + adjEffect - adjTax; // eget kapital enligt kontrollbalansräkningen
    var half = Math.ceil(registered / 2);
    var kbr = {};
    ROWS.forEach(function (r) { kbr[r.key] = (b[r.key] || 0) + adj[r.key]; });
    kbr.or = 0;
    var defTax = orTax + adjTax; // uppskjuten skatteskuld i KBR (avsättning)
    var kbrT = T + sumAdj('T'), kbrSK = SK + sumAdj('SK'), kbrAVS = AVS + sumAdj('AVS') + defTax;
    function sumAdj(side) { var s = 0; ROWS.forEach(function (r) { if (r.side === side) s += adj[r.key]; }); return s; }
    return {
      totals: { T: T, EK: EK, OR: OR, AVS: AVS, SK: SK, diff: diff, kbrT: kbrT, kbrAVS: kbrAVS, kbrSK: kbrSK, kbrEK: ekKbr, kbrDiff: kbrT - (ekKbr + kbrAVS + kbrSK) },
      registered: registered, ejreg: b.ejreg || 0, half: half, full: registered,
      ekBook: ekBook, orTax: orTax, orEk: orEk, ekJust: ekJust,
      adjustments: adjList, adjEffect: adjEffect, adjTax: adjTax, defTax: defTax, ekKbr: ekKbr,
      adjByRow: adj, kbrRows: kbr,
      trigger: ekJust < half,            // skäl att anta → upprätta KBR (13 §)
      underHalf: ekKbr < half,           // KBR visar brist → första kontrollstämma ska ändå hållas, men 2:a krävs
      fullCovered: ekKbr >= registered,  // krav vid andra kontrollstämman (17 §)
      need1: Math.max(0, half - ekKbr), need2: Math.max(0, registered - ekKbr),
      rate: rate
    };
  }

  /** Month-end series of justerat eget kapital (book + reserver × (1 − skatt)) for year 0. */
  function monthly(doc, opts) {
    opts = opts || {};
    var rar = (doc.rar && doc.rar['0']) || null;
    var last = lastVoucherDate(doc);
    if (!rar || !last) return [];
    var start = toIso(rar.start), end = toIso(rar.end), stop = toIso(last) < end ? toIso(last) : end;
    var out = [], me = monthEnd(start), guard = 0;
    while (guard++ < 40) {
      var cut = me > stop ? stop : me;
      var pos = position(balancesAt(doc, to8(cut)).bal);
      var c = compute(pos, { registered: opts.registered, taxRate: opts.taxRate });
      out.push({ date: cut, ekBook: c.ekBook, orEk: c.orEk, ekJust: c.ekJust, half: c.half, registered: c.registered, under: c.trigger, partial: cut !== me });
      if (me >= stop) break;
      me = monthEnd(addDays(me, 1));
    }
    return out;
  }
  function firstUnder(series) { for (var i = 0; i < series.length; i++) if (series[i].under) return series[i]; return null; }

  /** Deadlines (dates as YYYY-MM-DD). stamma1 optional – default suggestion kbrDate + 21 days. */
  function timeline(kbrDate, stamma1) {
    if (!parseIso(kbrDate)) return null;
    var s1 = parseIso(stamma1) ? stamma1 : addDays(kbrDate, 21);
    var second = addMonths(s1, 8);
    return {
      kbrDate: kbrDate, stamma1: s1, suggested: !parseIso(stamma1),
      kallelseEarliest: addDays(s1, -42), kallelseLatest: addDays(s1, -14),
      handlingarFrom: addDays(s1, -14),
      stamma2Latest: second,
      tingsrattLatest: addDays(second, 14)
    };
  }

  // ---------- formatting / parsing ----------
  function kr(ore, dec) {
    var v = (ore || 0) / 100, neg = v < 0; v = Math.abs(v);
    var s = dec ? v.toFixed(2) : String(Math.round(v));
    var p = s.split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return (neg && (dec ? +s : Math.round(v)) ? '-' : '') + i + (p[1] ? ',' + p[1] : '');
  }
  function parseKr(s) {
    if (typeof s === 'number') return Math.round(s * 100);
    s = String(s == null ? '' : s).replace(/[\s\u00a0\u202f]/g, '').replace(/kr$/i, '').replace('\u2212', '-');
    if (!s) return null;
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '');
    s = s.replace(',', '.');
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return Math.round(parseFloat(s) * 100);
  }

  return {
    TAX: TAX, ROWS: ROWS, ROWMAP: ROWMAP, rowFor: rowFor, balancesAt: balancesAt, position: position, manualPosition: manualPosition,
    compute: compute, monthly: monthly, firstUnder: firstUnder, timeline: timeline, lastVoucherDate: lastVoucherDate,
    toIso: toIso, to8: to8, addDays: addDays, addMonths: addMonths, monthEnd: monthEnd, kr: kr, parseKr: parseKr
  };
});
