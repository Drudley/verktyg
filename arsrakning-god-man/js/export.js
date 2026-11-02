/* Excel workbook for Årsräkning från kontoutdrag (paid part). Pure function of the computed result → sheets for xlsx-writer.js.
 * Sheets: Sammanställning (blankett order A, B, A+B, C, D, C+D, kontroll) · Per kategori · Övriga utgifter · Alla transaktioner */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./arsrakning.js'));
  else root.AEXPORT = factory(root.ARSR);
})(typeof self !== 'undefined' ? self : this, function (A) {
  'use strict';
  var L = {
    sv: { sum: 'Sammanställning', per: 'Per kategori', ovr: 'Övriga utgifter', all: 'Alla transaktioner', title: 'Årsräkning – sammanställning från kontoutdrag', period: 'Period',
      note: 'Underlag – inte en officiell blankett. För över beloppen till den blankett eller e-tjänst som din överförmyndare använder och kontrollera deras kategorier.',
      A: 'A  Tillgångar på bankkonton vid periodens början', B: 'B  Inkomster under perioden', C: 'C  Utgifter under perioden', D: 'D  Tillgångar på bankkonton vid periodens slut',
      sA: 'Summa A', sB: 'Summa inkomster (B)', sAB: 'Summa A + B', sC: 'Summa utgifter (C)', sD: 'Summa D', sCD: 'Summa C + D', check: 'Kontroll: (A + B) − (C + D)', ok: 'Stämmer', diff: 'Skillnad – kontrollera',
      src: { saldo: 'från saldo i filen', manual: 'inmatat', missing: 'saknas – fyll i' }, adjP: 'varav skatt dragen före utbetalning (från kontrolluppgift)', adjR: 'varav skatt på ränta (från årsbesked)',
      excl: 'Ej medräknat: överföringar mellan egna konton, netto', kr: 'Kronor',
      h: ['Datum', 'Konto', 'Text', 'Belopp', 'Saldo', 'Kategori', 'Ändrad av dig', 'Fil', 'Rad'], ph: ['Datum', 'Konto', 'Text', 'Belopp'], total: 'Summa', yes: 'ja',
      oh: ['Mottagare / text', 'Antal', 'Summa'], odetail: 'Alla rader', made: 'Skapad' },
    en: { sum: 'Summary', per: 'Per category', ovr: 'Other expenses', all: 'All transactions', title: 'Annual account – summary from bank statements', period: 'Period',
      note: 'Working paper – not an official form. Copy the amounts to the form or e-service your guardianship authority (överförmyndare) uses and check their categories.',
      A: 'A  Bank balances at the start of the period', B: 'B  Income during the period', C: 'C  Expenses during the period', D: 'D  Bank balances at the end of the period',
      sA: 'Total A', sB: 'Total income (B)', sAB: 'Total A + B', sC: 'Total expenses (C)', sD: 'Total D', sCD: 'Total C + D', check: 'Check: (A + B) − (C + D)', ok: 'Balances', diff: 'Difference – check',
      src: { saldo: 'from balance in file', manual: 'entered', missing: 'missing – enter it' }, adjP: 'of which tax withheld before payment (from the income statement)', adjR: 'of which tax on interest (from the annual statement)',
      excl: 'Not counted: transfers between own accounts, net', kr: 'SEK',
      h: ['Date', 'Account', 'Text', 'Amount', 'Balance', 'Category', 'Changed by you', 'File', 'Line'], ph: ['Date', 'Account', 'Text', 'Amount'], total: 'Total', yes: 'yes',
      oh: ['Payee / text', 'Count', 'Total'], odetail: 'All rows', made: 'Created' }
  };
  function M(o) { return { v: Math.round(o) / 100, t: 'money' }; }
  function MB(o) { return { v: Math.round(o) / 100, t: 'money', b: true }; }
  function B(s) { return { v: s, b: true }; }
  function catName(id, lang) { return A.CAT[id][lang === 'en' ? 'en' : 'sv']; }
  /* övriga utgifter grouped by similar text (normKey), largest first */
  function groupOther(res) {
    var g = {}, order = [];
    res.tx.filter(function (t) { return t.cat === 'out_ovr'; }).forEach(function (t) {
      var k = t.key || A.normText(t.text); if (!g[k]) { g[k] = { label: t.text, n: 0, sum: 0, rows: [] }; order.push(k); }
      g[k].n++; g[k].sum += -t.amount; g[k].rows.push(t);
    });
    return order.map(function (k) { return g[k]; }).sort(function (a, b) { return b.sum - a.sum; });
  }
  function sheets(res, lang, meta) {
    var T = L[lang === 'en' ? 'en' : 'sv'], inc = res.accounts.filter(function (a) { return a.include; }), out = [], s = [];
    s.push([B(T.title)]); s.push([T.period, res.from + ' – ' + res.to]); s.push([T.note]); if (meta && meta.created) s.push([T.made, meta.created]); s.push([]);
    s.push([B(T.A), B(T.kr)]);
    inc.forEach(function (a) { s.push([a.name, a.opening === null ? '' : M(a.opening), T.src[a.openingSrc]]); });
    s.push([B(T.sA), MB(res.A)]); s.push([]);
    s.push([B(T.B), B(T.kr)]);
    A.CATS.filter(function (c) { return c.g === 'in'; }).forEach(function (c) {
      s.push([catName(c.id, lang), M(res.cats[c.id])]);
      if (c.id === 'in_pension' && res.adj.pensionTax) s.push(['   ' + T.adjP, M(res.adj.pensionTax)]);
      if (c.id === 'in_ranta' && res.adj.interestTax) s.push(['   ' + T.adjR, M(res.adj.interestTax)]);
    });
    s.push([B(T.sB), MB(res.B)]); s.push([B(T.sAB), MB(res.AB)]); s.push([]);
    s.push([B(T.C), B(T.kr)]);
    A.CATS.filter(function (c) { return c.g === 'out'; }).forEach(function (c) { s.push([catName(c.id, lang), M(res.cats[c.id])]); });
    s.push([B(T.sC), MB(res.C)]); s.push([]);
    s.push([B(T.D), B(T.kr)]);
    inc.forEach(function (a) { s.push([a.name, a.closing === null ? '' : M(a.closing), T.src[a.closingSrc]]); });
    s.push([B(T.sD), MB(res.D)]); s.push([B(T.sCD), MB(res.CD)]); s.push([]);
    s.push([B(T.check), MB(res.diff), res.balanced ? T.ok : T.diff]);
    if (res.cats.x_egna) s.push([T.excl, M(res.cats.x_egna)]);
    out.push({ name: T.sum, rows: s, widths: [58, 16, 26] });
    /* per category */
    var p = [T.ph.map(B)];
    A.CATS.forEach(function (c) {
      var rows = res.tx.filter(function (t) { return t.cat === c.id; }); if (!rows.length) return;
      p.push([]); p.push([B(catName(c.id, lang))]);
      rows.forEach(function (t) { p.push([{ v: t.date.replace(/-/g, ''), t: 'date' }, t.account, t.text, M(t.amount)]); });
      p.push([B(T.total), '', '', MB(rows.reduce(function (x, t) { return x + t.amount; }, 0))]);
    });
    out.push({ name: T.per, rows: p, widths: [12, 26, 52, 16], freeze: 1 });
    /* övriga utgifter */
    var og = groupOther(res), o = [T.oh.map(B)];
    og.forEach(function (g) { o.push([g.label, { v: g.n, t: 'int' }, M(g.sum)]); });
    o.push([B(T.total), { v: og.reduce(function (x, g) { return x + g.n; }, 0), t: 'int' }, MB(res.cats.out_ovr)]); o.push([]); o.push([B(T.odetail)]);
    og.forEach(function (g) { g.rows.forEach(function (t) { o.push([t.text, { v: t.date.replace(/-/g, ''), t: 'date' }, M(-t.amount), t.account]); }); });
    out.push({ name: T.ovr, rows: o, widths: [52, 12, 16, 26], freeze: 1 });
    /* all transactions */
    var all = [T.h.map(B)];
    res.tx.forEach(function (t) { all.push([{ v: t.date.replace(/-/g, ''), t: 'date' }, t.account, t.text, M(t.amount), t.balance === null ? '' : M(t.balance), catName(t.cat, lang), t.cat !== t.auto ? T.yes : '', t.file, { v: t.line, t: 'int' }]); });
    out.push({ name: T.all, rows: all, widths: [12, 26, 52, 14, 14, 36, 10, 30, 7], freeze: 1, autoFilter: 1 });
    return out;
  }
  return { sheets: sheets, groupOther: groupOther, L: L };
});
