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

  var SECNAME = { A: 'A – aktier, fonder', C: 'C – obligationer, valuta', D: 'D – krypto, råvaror m.m.' };
  var SRUF = { A: [3100, 3300, '3300/3301/3304/3305'], C: [3310, 3400, '3400/3401/3403/3404'], D: [3410, 3500, '3500/3501/3503/3504'] };
  var ASSET = { stock: 'Aktie/ETF', fund: 'Fond', bond: 'Obligation', currency: 'Valuta', crypto: 'Krypto', commodity: 'Råvara' };
  var INC = { interest: 'Ränta', 'fund-distribution': 'Fondränta (penningmarknadsfond)', coupon: 'Kupongränta', reward: 'Kryptobelöning (staking m.m.)' };

  function sheets(res, k4, meta) {
    meta = meta || {};
    var out = [], used = ['A', 'C', 'D'].filter(function (k) { return k4.bySec && k4.bySec[k].length; });
    var info = [[H('Revolut till K4 – granskningsunderlag')], [],
      ['Inkomstår', k4.year], ['Blankett', 'K4-' + k4.year + 'P4' + (used.length ? ', avsnitt ' + used.join(', ') : '')], ['Källfil', meta.fileName || ''], ['Skapad', meta.created || ''],
      ['Metod', 'Genomsnittsmetoden per innehav (ticker/valuta) över filernas hela historik. Avgifter ingår i omkostnadsbelopp och försäljningspris.'],
      ['Avsnitt', 'A: aktier, ETF:er och fonder. C: obligationer och utländsk valuta. D: krypto, ädelmetaller/råvaror och övrigt.'],
      ['Valuta', 'Kurs ur Revolut-filen om den stämmer (±5 %) med Riksbankens dagskurs, annars Riksbankens mittkurs för affärsdagen (närmast föregående bankdag).'],
      ['Kurstabell', 'Riksbanken ' + (meta.ratesFrom || '') + '–' + (meta.ratesTo || '')],
      ['Avrundning', 'Belopp avrundade till hela kronor per K4-rad. Antal avrundat till heltal i SRU-filen (formatet tillåter bara heltal); i avsnitt C och D utelämnas antal under 1.'], [],
      [H('GRANSKA INNAN DU LÄMNAR IN')],
      ['Kontrollera mot Revolut-underlaget att alla köp finns med (även från tidigare år och andra konton) och att inget värdepapper har split, avknoppning eller namnbyte.'],
      ['Utdelningar, utländsk källskatt och ränteinkomster är inte K4 – räntor och belöningar listas på fliken Inkomster.'],
      ['Du ansvarar själv för uppgifterna i din deklaration.'], []];
    if (res.notes && res.notes.length) { info.push([H('OSÄKER SKATTEMÄSSIG BEHANDLING – KONTROLLERA')]); res.notes.forEach(function (c) { info.push([MSG.note(c, 'sv')]); }); info.push([]); }
    info.push([H('Summa'), H('Försäljningspris'), H('Omkostnadsbelopp'), H('Vinst'), H('Förlust')]);
    used.forEach(function (k) { var x = k4.secSums[k]; info.push(['Avsnitt ' + k, I(x.pris), I(x.omk), I(x.vinst), I(x.forlust)]); });
    info.push(['Alla K4-sidor', I(k4.sums.pris), I(k4.sums.omk), I(k4.sums.vinst), I(k4.sums.forlust)]);
    out.push({ name: 'Info', rows: info, widths: [22, 18, 18, 14, 14] });

    var kr = [[H('K4-sida'), H('Avsnitt'), H('Rad'), H('Antal (SRU)'), H('Antal exakt'), H('Beteckning'), H('Försäljningspris'), H('Omkostnadsbelopp'), H('Vinst'), H('Förlust'), H('SRU-fält')]];
    k4.pages.forEach(function (p) {
      var secs = p.sec || { A: { rows: p.rows, sums: p.sums } };
      ['A', 'C', 'D'].forEach(function (k) {
        var S = secs[k]; if (!S || !S.rows.length) return; var f = SRUF[k];
        S.rows.forEach(function (r, i) { kr.push([I(p.n), k, I(i + 1), r.antal == null ? '' : I(r.antal), N(r.antalExact, 8), r.beteckning, I(r.pris), I(r.omk), r.vinst ? I(r.vinst) : '', r.forlust ? I(r.forlust) : '', (f[0] + 10 * i) + '–' + (f[0] + 5 + 10 * i)]); });
        kr.push(['Summa sida ' + p.n + ' avsnitt ' + k, k, '', '', '', '', { v: S.sums.pris, t: 'int', b: true }, { v: S.sums.omk, t: 'int', b: true }, I(S.sums.vinst), I(S.sums.forlust), f[2]]);
      });
    });
    out.push({ name: 'K4 rader', rows: kr, widths: [10, 8, 6, 11, 14, 22, 16, 18, 12, 12, 18], freeze: 1 });

    var sr = [[H('Datum'), H('Avsnitt'), H('Ticker'), H('Slag'), H('Typ'), H('Antal'), H('Pris'), H('Valuta'), H('Belopp (valuta)'), H('Avgift'), H('Kurs SEK'), H('Kurskälla'), H('Ersättning SEK'), H('GAV före (SEK/st)'), H('Omkostnadsbelopp SEK'), H('Resultat SEK'), H('Fil'), H('Rad i fil')]];
    k4.sales.forEach(function (x) { sr.push([D(x.date), x.section || 'A', x.ticker, ASSET[x.asset] || '', x.rawType, N(x.qty, 8), M(x.price), x.currency, M(x.total), M(x.fee), N(x.fx, 6), SRC[x.fxSrc] + (x.rbDate ? ' ' + x.rbDate : ''), M(x.proceeds), M(x.gav), M(x.omk), M(x.result), fileName(meta, x.file), I(x.line)]); });
    out.push({ name: 'Försäljningar ' + k4.year, rows: sr, widths: [11, 8, 9, 11, 14, 12, 11, 7, 14, 10, 10, 22, 15, 16, 18, 14, 20, 8], freeze: 1 });

    var lg = [[H('Ticker'), H('Avsnitt'), H('Datum'), H('Typ'), H('Antal'), H('Valuta'), H('Belopp (valuta)'), H('Kurs SEK'), H('Belopp SEK'), H('Omkostnadsbelopp SEK (ut)'), H('Innehav efter'), H('Total omkostnad efter SEK'), H('GAV efter SEK'), H('Fil'), H('Rad i fil')]];
    Object.keys(res.tickers).sort().forEach(function (k) {
      var s = res.tickers[k], out_ = function (e) { return e.kind === 'SELL' || e.kind === 'XFER_OUT'; };
      s.ledger.forEach(function (e) { lg.push([k, s.section || 'A', D(e.date), e.rawType + (e.kind === 'XFER_OUT' ? ' (överföring ut, ingen försäljning)' : e.kind === 'REWARD' ? ' (belöning)' : ''), N(out_(e) ? -e.qty : e.qty, 8), e.currency, M(e.total), N(e.fx, 6), M(e.sek), out_(e) ? M(e.omk) : '', N(e.qtyAfter, 8), M(e.costAfter), M(e.gavAfter), fileName(meta, e.file), I(e.line)]); });
      if (s.blocked) lg.push([k, s.section || 'A', D(s.blocked.date), 'STOPP: ' + (s.blocked.rawType || s.blocked.code), '', '', '', '', '', '', '', '', '', fileName(meta, s.blocked.file), I(s.blocked.line)]);
    });
    out.push({ name: 'Genomsnitt per innehav', rows: lg, widths: [9, 8, 11, 22, 12, 7, 14, 10, 14, 20, 13, 20, 14, 20, 8], freeze: 1 });

    var inc = [[H('Datum'), H('Slag'), H('Innehav'), H('Typ i filen'), H('Valuta'), H('Belopp (valuta)'), H('Belopp SEK'), H('Fil'), H('Rad i fil')]], tot = 0;
    (k4.income || []).forEach(function (x) { if (isFinite(x.sek)) tot += x.sek; inc.push([D(x.date), INC[x.type] || x.type, x.ticker || '', x.rawType || '', x.currency || '', M(x.amount), x.sek == null ? 'kurs saknas' : M(x.sek), fileName(meta, x.file), I(x.line)]); });
    inc.push([H('Summa (inte K4 – inkomst av kapital, kontrollera)'), '', '', '', '', '', M(tot)]);
    out.push({ name: 'Inkomster ' + k4.year, rows: inc, widths: [11, 30, 14, 26, 7, 14, 14, 20, 8], freeze: 1 });

    var fl = [[H('Nivå'), H('Ticker'), H('Datum'), H('Fil'), H('Rad i fil'), H('Beskrivning')]];
    (res.notes || []).forEach(function (c) { fl.push(['Kontrollera', '', '', '', '', MSG.note(c, 'sv')]); });
    res.issues.forEach(function (i) { fl.push([i.level === 'error' ? 'Undantaget' : 'Varning', i.ticker || '', D(i.date), fileName(meta, i.file), i.line ? I(i.line) : '', MSG.text(i, 'sv', res.rateTo)]); });
    Object.keys(res.ignored).forEach(function (k) { fl.push(['Ignorerad', '', '', '', '', res.ignored[k] + ' rad(er) av typen ' + k + ' (påverkar inte K4)']); });
    out.push({ name: 'Flaggat', rows: fl, widths: [11, 9, 11, 20, 9, 110], freeze: 1 });
    return out;
  }
  function fileName(meta, i) { return meta.files && i != null && meta.files[i] ? meta.files[i] : ''; }
  function build(res, k4, meta) { return XLSXW.build(sheets(res, k4, meta), { title: 'K4 ' + k4.year + ' – Revolut', creator: 'Revolut till K4' }); }
  return { sheets: sheets, build: build };
});
