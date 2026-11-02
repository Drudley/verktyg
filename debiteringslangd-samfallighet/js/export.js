/* Excel workbook (paid part): Debiteringslängd · Verksamhetsgrenar · Avprickning. Pure function → sheets for xlsx-writer.js.
 * The workbook is in Swedish (it is the association's document). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./debitering.js'));
  else root.DEXPORT = factory(root.DEBL);
})(typeof self !== 'undefined' ? self : this, function (D) {
  'use strict';
  function M(o) { return { v: Math.round(o) / 100, t: 'money' }; }
  function MB(o) { return { v: Math.round(o) / 100, t: 'money', b: true }; }
  function B(s) { return { v: s, b: true }; }
  function share(n) { return n / D.SCALE; }
  var ST = { paid: 'Betald', part: 'Delvis betald', open: 'Obetald', overdue: 'Förfallen', over: 'Överbetald' };
  /** res = DEBL.compute(...), s = settings, refs = {memberId: ocr}, rest = DEBL.restlista(...) */
  function sheets(res, s, refs, rest) {
    var gs = res.grenar, head = [['Debiteringslängd ' + (s.year || '')], [s.forening || ''], s.orgnr ? ['Org.nr', s.orgnr] : [],
      ['Uttaxerat belopp', MB(res.total)], ['Förfallodag', s.due || ''], ['Betalningssätt', payText(s)],
      ['Utgifts- och inkomststat / uttaxering beslutad på föreningsstämma', (s.stamma || '') + (s.paragraf ? ', § ' + s.paragraf : '')],
      ['Anmärkning', 'Upprättad av styrelsen' + (s.upprattad ? ' ' + s.upprattad : '') + '. Framläggs på föreningsstämma enligt 42 § lagen (1973:1150) om förvaltning av samfälligheter. Talan om rättelse: 46 § (fyra veckor från framläggandet).'], []];
    var h = ['Fastighet', 'Ägare', 'Adress', 'Postadress'];
    gs.forEach(function (g) { h.push('Andelstal ' + g.label, g.label + ' (kr)'); });
    h.push('Att betala (kr)', 'OCR / referens');
    var rows = head.concat([h.map(B)]).concat(res.rows.map(function (r) {
      var row = [r.member.fastighet, r.member.agare, r.member.adress, r.member.postadress];
      gs.forEach(function (g) { row.push(share(r.shares[g.key]), M(r.parts[g.key])); });
      row.push(M(r.total), refs[r.member.id] || ''); return row;
    }));
    var tot = [B('Summa'), '', '', '']; gs.forEach(function (g) { tot.push(share(g.sumW), MB(g.total)); }); tot.push(MB(res.total), '');
    rows.push(tot);
    var g2 = [['Verksamhetsgrenar (redovisas var för sig, 42 § tredje stycket)'], [], ['Verksamhetsgren', 'Fördelning', 'Post', 'Belopp (kr)', 'Summa andelstal', 'Kr per andel', 'Antal fastigheter'].map(B)];
    gs.forEach(function (g) {
      (g.lines.length ? g.lines : [{ text: '', amount: 0 }]).forEach(function (l, i) { g2.push(i ? ['', '', l.text, M(l.amount)] : [g.label, g.source === '=lika' ? 'Lika per fastighet' : 'Andelstal: ' + g.source, l.text, M(l.amount), share(g.sumW), { v: Math.round(g.perShare) / 100, t: 'money' }, g.n]); });
      g2.push([B('Summa ' + g.label), '', '', MB(g.total)]);
    });
    g2.push([], [B('Totalt uttaxerat'), '', '', MB(res.total)], ['Avrundning', res.unit === 100 ? 'Hela kronor (största rest-metoden)' : 'Öre (största rest-metoden)'], ['Kontroll: summan av raderna', MB(res.sumRows), res.exact ? 'Stämmer' : 'Avviker']);
    var out = [{ name: 'Debiteringslängd', rows: rows, widths: [16, 30, 24, 18].concat(gs.reduce(function (a) { return a.concat([11, 14]); }, [])).concat([14, 18]), freeze: head.length + 1 },
      { name: 'Verksamhetsgrenar', rows: g2, widths: [30, 34, 34, 14, 16, 14, 16] }];
    if (rest) {
      var a = [['Avprickning ' + (s.year || '')], ['Förfallodag', s.due || ''], [], ['Fastighet', 'Ägare', 'OCR / referens', 'Att betala', 'Betalt', 'Betaldatum', 'Kvar', 'Status'].map(B)]
        .concat(rest.rows.map(function (x) { return [x.member.fastighet, x.member.agare, refs[x.member.id] || '', M(x.total), M(x.paid), x.date, M(x.left), ST[x.status]]; }))
        .concat([[B('Summa'), '', '', MB(rest.total), MB(rest.paid), '', MB(rest.left), rest.nOpen + ' obetalda']]);
      out.push({ name: 'Avprickning', rows: a, widths: [16, 30, 18, 14, 14, 12, 14, 14], freeze: 4 });
    }
    return out;
  }
  function payText(s) {
    var p = [];
    if (s.bankgiro) p.push('Bankgiro ' + s.bankgiro); if (s.plusgiro) p.push('Plusgiro ' + s.plusgiro); if (s.swish) p.push('Swish ' + s.swish);
    if (s.konto) p.push('Konto ' + s.konto);
    return (p.join(', ') || '—') + (s.ocrOn !== false ? ' – ange OCR-numret' : '');
  }
  return { sheets: sheets, payText: payText, STATUS: ST };
});
