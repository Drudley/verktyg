/* Review workbook (paid). Depends on XLSXW + K4MSG. sheets(res, k4, meta) → [{name, rows, widths, freeze}] */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./xlsx-writer.js'), require('./messages.js'));
  else root.K4Export = factory(root.XLSXW, root.K4MSG);
})(typeof self !== 'undefined' ? self : this, function (XLSXW, MSG) {
  'use strict';
  function H(s) { return { v: s, b: true }; }
  function M(n) { return isFinite(n) ? { v: Math.round(n * 100) / 100, t: 'money' } : ''; }
  function I(n) { return { v: n, t: 'int' }; }
  function D(iso) { return iso ? { v: iso.replace(/-/g, ''), t: 'date' } : ''; }
  function N(n, d) { return isFinite(n) ? Math.round(n * Math.pow(10, d)) / Math.pow(10, d) : ''; }
  var SRC = { file: 'Revolut-filen', 'file-inverted': 'Revolut-filen (inverterad)', riksbank: 'Riksbanken', sek: 'SEK' };

  function sheets(res, k4, meta) {
    meta = meta || {};
    var out = [];
    var info = [[H('Revolut till K4 – granskningsunderlag')], [],
      ['Inkomstår', k4.year], ['Blankett', 'K4-' + k4.year + 'P4, avsnitt A'], ['Källfil', meta.fileName || ''], ['Skapad', meta.created || ''],
      ['Metod', 'Genomsnittsmetoden per ticker över hela filens historik. Avgifter ingår (Revolut Total Amount).'],
      ['Valuta', 'Kurs ur Revolut-filen om den stämmer (±5 %) med Riksbankens dagskurs, annars Riksbankens mittkurs för affärsdagen (närmast föregående bankdag).'],
      ['Kurstabell', 'Riksbanken ' + (meta.ratesFrom || '') + '–' + (meta.ratesTo || '')],
      ['Avrundning', 'Belopp avrundade till hela kronor per K4-rad. Antal avrundat till heltal i SRU-filen (formatet tillåter bara heltal).'], [],
      [H('GRANSKA INNAN DU LÄMNAR IN')],
      ['Kontrollera mot Revolut-underlaget att alla köp finns med (även från tidigare år och andra konton) och att inget värdepapper har split, avknoppning eller namnbyte.'],
      ['Valutavinster/-förluster på USD-/EUR-saldo hos Revolut ingår inte (redovisas i avsnitt C/D). Utdelningar och utländsk källskatt redovisas separat.'],
      ['Du ansvarar själv för uppgifterna i din deklaration.'], [],
      [H('Summa'), H('Försäljningspris'), H('Omkostnadsbelopp'), H('Vinst'), H('Förlust')],
      ['Alla K4-sidor', I(k4.sums.pris), I(k4.sums.omk), I(k4.sums.vinst), I(k4.sums.forlust)]];
    out.push({ name: 'Info', rows: info, widths: [22, 18, 18, 14, 14] });

    var kr = [[H('K4-sida'), H('Rad'), H('Antal (SRU)'), H('Antal exakt'), H('Beteckning'), H('Försäljningspris'), H('Omkostnadsbelopp'), H('Vinst'), H('Förlust'), H('SRU-fält')]];
    k4.pages.forEach(function (p) {
      p.rows.forEach(function (r, i) { kr.push([I(p.n), I(i + 1), I(r.antal), N(r.antalExact, 8), r.beteckning, I(r.pris), I(r.omk), r.vinst ? I(r.vinst) : '', r.forlust ? I(r.forlust) : '', (3100 + 10 * i) + '–' + (3105 + 10 * i)]); });
      kr.push(['Summa sida ' + p.n, '', '', '', '', { v: p.sums.pris, t: 'int', b: true }, { v: p.sums.omk, t: 'int', b: true }, I(p.sums.vinst), I(p.sums.forlust), '3300/3301/3304/3305']);
    });
    out.push({ name: 'K4 rader', rows: kr, widths: [10, 6, 11, 14, 22, 16, 18, 12, 12, 18], freeze: 1 });

    var sr = [[H('Datum'), H('Ticker'), H('Typ'), H('Antal'), H('Pris/aktie'), H('Valuta'), H('Belopp (valuta)'), H('Avgift i belopp'), H('Kurs SEK'), H('Kurskälla'), H('Ersättning SEK'), H('GAV före (SEK/aktie)'), H('Omkostnadsbelopp SEK'), H('Resultat SEK'), H('Rad i fil')]];
    k4.sales.forEach(function (x) { sr.push([D(x.date), x.ticker, x.rawType, N(x.qty, 8), M(x.price), x.currency, M(x.total), M(x.fee), N(x.fx, 6), SRC[x.fxSrc] + (x.rbDate ? ' ' + x.rbDate : ''), M(x.proceeds), M(x.gav), M(x.omk), M(x.result), I(x.line)]); });
    out.push({ name: 'Försäljningar ' + k4.year, rows: sr, widths: [11, 9, 14, 12, 11, 7, 14, 12, 10, 22, 15, 16, 18, 14, 8], freeze: 1 });

    var lg = [[H('Ticker'), H('Datum'), H('Typ'), H('Antal'), H('Valuta'), H('Belopp (valuta)'), H('Kurs SEK'), H('Belopp SEK'), H('Omkostnadsbelopp SEK (sälj)'), H('Innehav efter'), H('Total omkostnad efter SEK'), H('GAV efter SEK'), H('Rad i fil')]];
    Object.keys(res.tickers).sort().forEach(function (k) {
      var s = res.tickers[k];
      s.ledger.forEach(function (e) { lg.push([k, D(e.date), e.rawType, N(e.kind === 'SELL' ? -e.qty : e.qty, 8), e.currency, M(e.total), N(e.fx, 6), M(e.sek), e.kind === 'SELL' ? M(e.omk) : '', N(e.qtyAfter, 8), M(e.costAfter), M(e.gavAfter), I(e.line)]); });
      if (s.blocked) lg.push([k, D(s.blocked.date), 'STOPP: ' + (s.blocked.rawType || s.blocked.code), '', '', '', '', '', '', '', '', '', I(s.blocked.line)]);
    });
    out.push({ name: 'Genomsnitt per ticker', rows: lg, widths: [9, 11, 16, 12, 7, 14, 10, 14, 20, 13, 20, 14, 8], freeze: 1 });

    var fl = [[H('Nivå'), H('Ticker'), H('Datum'), H('Rad i fil'), H('Beskrivning')]];
    res.issues.forEach(function (i) { fl.push([i.level === 'error' ? 'Undantaget' : 'Varning', i.ticker || '', D(i.date), i.line ? I(i.line) : '', MSG.text(i, 'sv', res.rateTo)]); });
    Object.keys(res.ignored).forEach(function (k) { fl.push(['Ignorerad', '', '', '', res.ignored[k] + ' rad(er) av typen ' + k + ' (påverkar inte K4 avsnitt A)']); });
    out.push({ name: 'Flaggat', rows: fl, widths: [11, 9, 11, 9, 110], freeze: 1 });
    return out;
  }
  function build(res, k4, meta) { return XLSXW.build(sheets(res, k4, meta), { title: 'K4 ' + k4.year + ' – Revolut', creator: 'Revolut till K4' }); }
  return { sheets: sheets, build: build };
});
