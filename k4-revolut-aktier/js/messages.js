/* Issue texts (sv/en) shared by the UI and the review XLSX. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.K4MSG = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var M = {
    sv: {
      crypto: 'Kryptoraden kunde inte tolkas. Innehavet är undantaget från K4-filen.',
      split: 'Split/aktiesplit stöds inte i v1 – räkna om antal och omkostnadsbelopp manuellt (t.ex. Skatteverkets beräkningshjälp). Försäljningar från och med splitten är undantagna.',
      'unknown-type': 'Okänd transaktionstyp "%t" (t.ex. avknoppning, fusion, inlösen). Försäljningar från och med denna rad är undantagna – hantera manuellt.',
      'bad-quantity': 'Antal saknas eller är 0. Försäljningar från och med denna rad är undantagna.',
      'bad-amount': 'Belopp saknas. Försäljningar från och med denna rad är undantagna.',
      'no-currency': 'Valuta saknas. Försäljningar från och med denna rad är undantagna.',
      'no-rate': 'Växelkurs för %c saknas (inte i filen och inte i Riksbankens tabell). Försäljningar från och med denna rad är undantagna.',
      'rate-beyond-table': 'Datumet ligger efter den inbyggda kurstabellen (%r) och filens kurs kunde inte kontrolleras. Försäljningar från och med denna rad är undantagna.',
      oversold: 'Försäljning av %s st men bara %h st i innehav enligt filen. Köp saknas troligen (äldre konto, överföring in, bytt ticker). Försäljningar från och med denna rad är undantagna.',
      'total-from-price': 'Totalbelopp saknades – beräknat som antal × pris (avgift okänd).',
      'no-ticker': 'Rad av typen "%t" utan ticker ignorerades.',
      'opening-balance': 'Filen börjar med ett saldo på %h %k som inte förklaras av transaktionerna i filen – omkostnadsbeloppet för det är okänt. Ladda ner kontoutdraget från kontots start eller räkna innehavet manuellt. Avyttringar är undantagna.',
      'transfer-in': 'Överföring in ("%t") – omkostnadsbeloppet är okänt (köpt någon annanstans eller flyttat från egen plånbok). Försäljningar från och med denna rad är undantagna – lägg till anskaffningen manuellt.',
      'transfer-out': 'Överföring ut ("%t", %n rad(er)) räknas som flytt till egen plånbok: innehav och omkostnadsbelopp minskar men ingen försäljning redovisas. Var det en betalning eller gåva är det en avyttring – lägg till den manuellt.',
      'multi-file': 'Samma innehav finns i flera filer. Överlappar filerna i tid räknas transaktionerna dubbelt – ladda bara upp en fil per konto och period.'
    },
    en: {
      crypto: 'The crypto row could not be read. The holding is excluded from the K4 file.',
      split: 'Stock splits are not supported in v1 – recalculate quantity and cost basis manually. Sales from the split onward are excluded.',
      'unknown-type': 'Unknown transaction type "%t" (e.g. spin-off, merger, redemption). Sales from this row onward are excluded – handle manually.',
      'bad-quantity': 'Quantity missing or 0. Sales from this row onward are excluded.',
      'bad-amount': 'Amount missing. Sales from this row onward are excluded.',
      'no-currency': 'Currency missing. Sales from this row onward are excluded.',
      'no-rate': 'No exchange rate for %c (not in the file nor in the Riksbank table). Sales from this row onward are excluded.',
      'rate-beyond-table': 'The date is after the bundled rate table (%r) and the file rate could not be checked. Sales from this row onward are excluded.',
      oversold: 'Sells %s shares but the file only shows %h held. Buys are probably missing (older account, transfer in, ticker change). Sales from this row onward are excluded.',
      'total-from-price': 'Total amount missing – calculated as quantity × price (fee unknown).',
      'no-ticker': 'Row of type "%t" without ticker was ignored.',
      'opening-balance': 'The file starts with a balance of %h %k that its transactions do not explain – its cost basis is unknown. Download the statement from the account start or handle this holding manually. Disposals are excluded.',
      'transfer-in': 'Transfer in ("%t") – the cost basis is unknown (bought elsewhere or moved from your own wallet). Sales from this row onward are excluded – add the acquisition manually.',
      'transfer-out': 'Transfer out ("%t", %n row(s)) is treated as a move to your own wallet: holding and cost basis go down but no sale is reported. If it was a payment or gift it is a disposal – add it manually.',
      'multi-file': 'The same holding appears in more than one file. If the files overlap in time the transactions are counted twice – upload one file per account and period.'
    }
  };

  /* Points where the tax treatment is genuinely uncertain: shown to the user, never silently decided. */
  var NOTES = {
    sv: {
      'u-currency': 'Valuta (avsnitt C): utländsk valuta är en tillgång. Varje växling tillbaka, kortköp och överföring ut från ett valutakonto räknas här som en avyttring (genomsnittsmetoden per valuta) och inflöden som förvärv. Det är huvudregeln, men för vardagsköp blir beloppen ofta små och hur noga det ska redovisas är inte entydigt – kontrollera med Skatteverket innan du tar med eller utelämnar valutaraderna.',
      'u-commodity': 'Ädelmetaller (avsnitt D): Revolut-råvaror (XAU, XAG …) redovisas här som övriga tillgångar. Revolut förvarar metallen åt dig och innehavet kan juridiskt vara en fordran snarare än fysisk metall – i så fall kan ett annat avsnitt gälla. Kontrollera.',
      'u-bond': 'Obligationer (avsnitt C, känns igen på att symbolen är ett ISIN): upplupen ränta som betalas vid köp eller fås vid försäljning ska normalt behandlas som ränta och inte ingå i försäljningspris/omkostnadsbelopp. Revolut-filen skiljer inte på dem – kontrollera mot avräkningsnotorna. Kupongränta är inte K4 utan ränteinkomst.',
      'u-mmf': 'Penningmarknadsfond (Flexible Cash Funds): Skatteverket anger avsnitt A eller C för utländska räntefonder. Verktyget lägger den i avsnitt A eftersom fonden inte enbart har fordringar i svenska kronor; vinst/förlust uppstår främst av växelkursen. Kontrollera klassningen.',
      'u-mmf-income': 'Ränta från penningmarknadsfonden ("Interest PAID") är inte K4 utan inkomst av kapital som du deklarerar själv om ingen kontrolluppgift finns. Summan i kronor visas nedan – kontrollera vilken ruta som gäller.',
      'u-interest': 'Ränta på konto/sparkonto är inkomst av kapital, inte K4. Är den inte förifylld i deklarationen deklarerar du den själv som ränteinkomst. Summan visas nedan.',
      'u-reward': 'Staking- och andra kryptobelöningar räknas här som förvärv till marknadsvärdet när de togs emot (det blir omkostnadsbeloppet). Själva belöningen beskattas som inkomst av kapital och deklareras utanför K4 – summan visas nedan. Kontrollera.',
      'u-robo': 'Robo-Advisor: varje ombalansering är en försäljning och räknas här som vanliga köp och försäljningar. Revolut har inte publicerat formatet för Robo-Advisor-utdraget – stäm av summorna mot Revolut.'
    },
    en: {
      'u-currency': 'Currency (section C): foreign currency is an asset. Every exchange back, card payment and transfer out of a currency pocket is treated as a disposal (average cost per currency) and inflows as acquisitions. That is the main rule, but for everyday spending the amounts are often small and how strictly it must be reported is not clear-cut – check with Skatteverket before you include or leave out the currency rows.',
      'u-commodity': 'Precious metals (section D): Revolut commodities (XAU, XAG …) are reported as other assets. Revolut holds the metal for you and the holding may legally be a claim rather than physical metal – another section could then apply. Please check.',
      'u-bond': 'Bonds (section C, recognised by an ISIN as symbol): accrued interest paid on purchase or received on sale is normally interest and not part of the sale price/cost basis. The Revolut file does not separate it – check the trade confirmations. Coupons are interest income, not K4.',
      'u-mmf': 'Money-market fund (Flexible Cash Funds): Skatteverket lists foreign interest funds under section A or C. The tool uses section A because the fund does not hold only SEK claims; gains/losses come mainly from the exchange rate. Please check the classification.',
      'u-mmf-income': 'Interest from the money-market fund ("Interest PAID") is not K4 but capital income you declare yourself if there is no statement to Skatteverket. The SEK total is shown below – check which box applies.',
      'u-interest': 'Interest on accounts/savings is capital income, not K4. If it is not pre-filled, declare it yourself as interest income. The total is shown below.',
      'u-reward': 'Staking and other crypto rewards are treated as acquisitions at market value when received (that becomes the cost basis). The reward itself is taxed as capital income outside K4 – the total is shown below. Please check.',
      'u-robo': 'Robo-Advisor: every rebalancing is a sale and is treated as normal buys and sells. Revolut has not published the Robo-Advisor statement format – reconcile the totals with Revolut.'
    }
  };
  function note(code, lang) { return (NOTES[lang] || NOTES.sv)[code] || code; }
  function fmtQ(n) { return (Math.round(n * 1e8) / 1e8).toString(); }
  function text(issue, lang, rateTo) {
    var s = (M[lang] || M.sv)[issue.code] || issue.code, x = issue.extra;
    return s.replace('%t', issue.rawType || '').replace('%n', issue.count || 1).replace('%k', issue.ticker || '').replace('%c', typeof x === 'string' ? x : '')
      .replace('%s', x && x.sell != null ? fmtQ(x.sell) : '').replace('%h', x && x.have != null ? fmtQ(x.have) : '')
      .replace('%r', rateTo ? rateTo.slice(0, 4) + '-' + rateTo.slice(4, 6) + '-' + rateTo.slice(6, 8) : '');
  }
  return { text: text, note: note, M: M, NOTES: NOTES };
});
