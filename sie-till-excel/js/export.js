/* Builds the workbook sheets from a parsed SIE doc. Depends on SIE + XLSXW. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sie.js'), require('./xlsx-writer.js'));
  else root.SIEExport = factory(root.SIE, root.XLSXW);
})(typeof self !== 'undefined' ? self : this, function (SIE, XLSXW) {
  'use strict';
  function H(s) { return { v: s, b: true }; }
  function M(ore) { return { v: ore / 100, t: 'money' }; }
  function D(s) { return s ? { v: s, t: 'date' } : ''; }
  var TYPES = { T: 'Tillgång', S: 'Skuld/EK', I: 'Intäkt', K: 'Kostnad' };
  function objStr(objs) { return (objs || []).map(function (o) { return o.dim + ':' + o.obj; }).join(' '); }

  function sheets(doc, year) {
    year = year === undefined ? '0' : String(year);
    var s = SIE.summary(doc), out = [];
    // Info
    var info = [[H('Fält'), H('Värde')],
      ['Företagsnamn', doc.fnamn], ['Organisationsnummer', doc.orgnr], ['SIE-typ', doc.sieTyp], ['Program', doc.program],
      ['Genererad', doc.gen ? SIE.fmtDate(doc.gen) : ''], ['Teckenkodning (tolkad)', doc.encoding], ['Valuta', doc.valuta], ['Kontoplanstyp', doc.kptyp],
      ['Antal konton', s.accounts], ['Antal verifikationer', s.vouchers], ['Antal transaktioner', s.transactions], ['Obalanserade verifikationer', s.unbalanced]];
    if (doc.adress) info.push(['Kontakt', doc.adress.kontakt], ['Adress', [doc.adress.utdelningsadr, doc.adress.postadr].filter(Boolean).join(', ')], ['Telefon', doc.adress.tel]);
    info.push([], [H('Räkenskapsår'), H('Start'), H('Slut')]);
    Object.keys(doc.rar).sort(function (a, b) { return b - a; }).forEach(function (k) { info.push([k === '0' ? 'Innevarande (0)' : 'År ' + k, D(doc.rar[k].start), D(doc.rar[k].end)]); });
    if (doc.warnings.length) { info.push([], [H('Varningar')]); doc.warnings.slice(0, 500).forEach(function (w) { info.push([w]); }); }
    out.push({ name: 'Info', rows: info, widths: [28, 44, 14] });

    // Konton
    var years = Object.keys(doc.rar).length ? Object.keys(doc.rar).sort(function (a, b) { return b - a; }) : ['0'];
    var kh = [H('Konto'), H('Namn'), H('Typ'), H('SRU')];
    years.forEach(function (y) { kh.push(H('IB ' + y), H('UB/RES ' + y)); });
    var kr = [kh];
    SIE.sortedAccounts(doc).forEach(function (no) {
      var a = doc.accounts[no], res = SIE.isResultAccount(doc, no);
      var row = [no, a.name, TYPES[a.type] || a.type, a.sru];
      years.forEach(function (y) {
        var ib = (doc.ib[y] || {})[no], end = res ? (doc.res[y] || {})[no] : (doc.ub[y] || {})[no];
        row.push(ib === undefined ? '' : M(ib), end === undefined ? '' : M(end));
      });
      kr.push(row);
    });
    out.push({ name: 'Konton', rows: kr, widths: [9, 36, 11, 7].concat(years.map(function () { return 15; }).concat(years.map(function () { return 15; }))), freeze: 1, autoFilter: 1 });

    // Verifikationer
    var vr = [[H('Serie'), H('Nr'), H('Datum'), H('Text'), H('Regdatum'), H('Belopp (debet)'), H('Antal rader'), H('Balanserar')]];
    doc.vouchers.forEach(function (v) {
      var deb = 0; v.trans.forEach(function (t) { if (!t.removed && t.amount > 0) deb += t.amount; });
      vr.push([v.serie, /^\d+$/.test(v.nr) ? { v: +v.nr, t: 'int' } : v.nr, D(v.date), v.text, D(v.regdate), M(deb), { v: v.trans.length, t: 'int' }, v.sum === 0 ? 'Ja' : 'Nej']);
    });
    out.push({ name: 'Verifikationer', rows: vr, widths: [7, 8, 12, 44, 12, 16, 11, 11], freeze: 1, autoFilter: 1 });

    // Transaktioner
    var tr = [[H('Serie'), H('Nr'), H('Verdatum'), H('Vertext'), H('Konto'), H('Kontonamn'), H('Debet'), H('Kredit'), H('Belopp'), H('Transdatum'), H('Transtext'), H('Objekt'), H('Kvantitet'), H('Typ')]];
    doc.vouchers.forEach(function (v) {
      v.trans.forEach(function (t) {
        tr.push([v.serie, /^\d+$/.test(v.nr) ? { v: +v.nr, t: 'int' } : v.nr, D(v.date), v.text, t.konto, (doc.accounts[t.konto] || {}).name || '',
          t.amount > 0 ? M(t.amount) : '', t.amount < 0 ? M(-t.amount) : '', M(t.amount), D(t.date), t.text, objStr(t.objects), t.qty ? +t.qty || t.qty : '',
          t.kind === 'TRANS' ? '' : t.kind]);
      });
    });
    out.push({ name: 'Transaktioner', rows: tr, widths: [7, 8, 12, 34, 8, 30, 14, 14, 14, 12, 26, 14, 10, 8], freeze: 1, autoFilter: 1 });

    // Saldobalans
    var tb = SIE.trialBalance(doc, year);
    var sb = [[H('Konto'), H('Namn'), H('Ingående balans'), H('Period'), H('Utgående balans'), H('Enligt fil (UB/RES)'), H('Differens')]];
    var tIB = 0, tP = 0, tUB = 0;
    tb.forEach(function (r) { tIB += r.ib; tP += r.period; tUB += r.ub;
      sb.push([r.konto, r.namn, M(r.ib), M(r.period), M(r.ub), r.fileUb === null ? '' : M(r.fileUb), r.diff === null ? '' : M(r.diff)]); });
    sb.push(['', { v: 'Summa', b: true }, { v: tIB / 100, t: 'money', b: true }, { v: tP / 100, t: 'money', b: true }, { v: tUB / 100, t: 'money', b: true }]);
    out.push({ name: 'Saldobalans', rows: sb, widths: [9, 36, 16, 16, 16, 18, 12], freeze: 1 });

    // Resultat per månad
    var mr = SIE.monthlyResult(doc, year);
    var rh = [H('Konto'), H('Namn')].concat(mr.months.map(H), [H('Totalt')]);
    var rr = [rh], colTot = {}, grand = 0;
    mr.rows.forEach(function (r) {
      var row = [r.konto, r.namn];
      mr.months.forEach(function (m) { var v = r.values[m] || 0; colTot[m] = (colTot[m] || 0) + v; row.push(v ? M(v) : ''); });
      grand += r.total; row.push(M(r.total)); rr.push(row);
    });
    var tot = ['', { v: 'Resultat (negativt = vinst)', b: true }];
    mr.months.forEach(function (m) { tot.push({ v: (colTot[m] || 0) / 100, t: 'money', b: true }); });
    tot.push({ v: grand / 100, t: 'money', b: true }); rr.push(tot);
    out.push({ name: 'Resultat per månad', rows: rr, widths: [9, 32].concat(mr.months.map(function () { return 13; }), [15]), freeze: 1 });
    return out;
  }

  function build(doc, year) {
    return XLSXW.build(sheets(doc, year), { title: (doc.fnamn || 'SIE') + ' – SIE till Excel', creator: 'SIE till Excel' });
  }
  function fileName(doc) {
    var base = (doc.fnamn || 'sie-export').replace(/[^\wåäöÅÄÖ\- ]+/g, '').trim().replace(/\s+/g, '-');
    var rar = doc.rar['0']; return base + (rar && rar.start ? '-' + rar.start.slice(0, 4) : '') + '.xlsx';
  }
  return { sheets: sheets, build: build, fileName: fileName };
});
