/* Issue texts (sv/en) shared by the UI and the review XLSX. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.K4MSG = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var M = {
    sv: {
      crypto: 'Krypto stöds inte (redovisas i avsnitt D). Värdepappret är undantaget från K4-filen.',
      split: 'Split/aktiesplit stöds inte i v1 – räkna om antal och omkostnadsbelopp manuellt (t.ex. Skatteverkets beräkningshjälp). Försäljningar från och med splitten är undantagna.',
      'unknown-type': 'Okänd transaktionstyp "%t" (t.ex. avknoppning, fusion, inlösen). Försäljningar från och med denna rad är undantagna – hantera manuellt.',
      'bad-quantity': 'Antal saknas eller är 0. Försäljningar från och med denna rad är undantagna.',
      'bad-amount': 'Belopp saknas. Försäljningar från och med denna rad är undantagna.',
      'no-currency': 'Valuta saknas. Försäljningar från och med denna rad är undantagna.',
      'no-rate': 'Växelkurs för %c saknas (inte i filen och inte i Riksbankens tabell). Försäljningar från och med denna rad är undantagna.',
      'rate-beyond-table': 'Datumet ligger efter den inbyggda kurstabellen (%r) och filens kurs kunde inte kontrolleras. Försäljningar från och med denna rad är undantagna.',
      oversold: 'Försäljning av %s st men bara %h st i innehav enligt filen. Köp saknas troligen (äldre konto, överföring in, bytt ticker). Försäljningar från och med denna rad är undantagna.',
      'total-from-price': 'Totalbelopp saknades – beräknat som antal × pris (avgift okänd).',
      'no-ticker': 'Rad av typen "%t" utan ticker ignorerades.'
    },
    en: {
      crypto: 'Crypto is not supported (reported in section D). The security is excluded from the K4 file.',
      split: 'Stock splits are not supported in v1 – recalculate quantity and cost basis manually. Sales from the split onward are excluded.',
      'unknown-type': 'Unknown transaction type "%t" (e.g. spin-off, merger, redemption). Sales from this row onward are excluded – handle manually.',
      'bad-quantity': 'Quantity missing or 0. Sales from this row onward are excluded.',
      'bad-amount': 'Amount missing. Sales from this row onward are excluded.',
      'no-currency': 'Currency missing. Sales from this row onward are excluded.',
      'no-rate': 'No exchange rate for %c (not in the file nor in the Riksbank table). Sales from this row onward are excluded.',
      'rate-beyond-table': 'The date is after the bundled rate table (%r) and the file rate could not be checked. Sales from this row onward are excluded.',
      oversold: 'Sells %s shares but the file only shows %h held. Buys are probably missing (older account, transfer in, ticker change). Sales from this row onward are excluded.',
      'total-from-price': 'Total amount missing – calculated as quantity × price (fee unknown).',
      'no-ticker': 'Row of type "%t" without ticker was ignored.'
    }
  };
  function fmtQ(n) { return (Math.round(n * 1e8) / 1e8).toString(); }
  function text(issue, lang, rateTo) {
    var s = (M[lang] || M.sv)[issue.code] || issue.code, x = issue.extra;
    return s.replace('%t', issue.rawType || '').replace('%c', typeof x === 'string' ? x : '')
      .replace('%s', x && x.sell != null ? fmtQ(x.sell) : '').replace('%h', x && x.have != null ? fmtQ(x.have) : '')
      .replace('%r', rateTo ? rateTo.slice(0, 4) + '-' + rateTo.slice(4, 6) + '-' + rateTo.slice(6, 8) : '');
  }
  return { text: text, M: M };
});
