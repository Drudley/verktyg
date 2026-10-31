/* Issue texts (sv/en) shared by the UI and the review XLSX – eToro edition. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.K4MSG = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var M = {
    sv: {
      'bad-quantity': 'Antal (Units) saknas eller är 0. Försäljningar av innehavet från och med denna rad är undantagna.',
      'bad-amount': 'Belopp eller vinst (Amount/Profit) saknas. Positionen är undantagen – räkna den manuellt.',
      'bad-date': 'Datum kunde inte tolkas. Raden är undantagen.',
      'no-currency': 'Valuta saknas. Försäljningar från och med denna rad är undantagna.',
      'no-rate': 'Växelkurs för %c saknas i Riksbankens tabell. Raden är undantagen.',
      'rate-beyond-table': 'Datumet ligger efter den inbyggda kurstabellen (%r). Raden är undantagen – vänta på uppdaterad kurstabell eller räkna manuellt.',
      oversold: 'Försäljning av %s st men bara %h st i innehav enligt filen. Köp saknas troligen (position öppnad före kontoutdragets startdatum, överföring in). Försäljningar från och med denna rad är undantagna.',
      'history-gap': 'Positionen öppnades före kontoutdragets startdatum (%d). Genomsnittsmetoden kräver alla köp av samma aktie – även sådana som fortfarande var öppna eller stängdes före startdatumet. Ladda ner kontoutdraget från kontots start (eToro: Settings → Account → Account Statement, välj ett tidigt datum) så blir genomsnittet rätt.',
      'duplicate-position': '%n stängd(a) position(er) fanns i flera filer och räknades bara en gång.',
      'multi-file': 'Samma innehav finns i flera filer. Överlappar filerna i tid räknas köpen dubbelt – ladda helst upp ett enda kontoutdrag för hela perioden.'
    },
    en: {
      'bad-quantity': 'Units missing or 0. Sales of the holding from this row onward are excluded.',
      'bad-amount': 'Amount or profit missing. The position is excluded – handle it manually.',
      'bad-date': 'The date could not be read. The row is excluded.',
      'no-currency': 'Currency missing. Sales from this row onward are excluded.',
      'no-rate': 'No exchange rate for %c in the Riksbank table. The row is excluded.',
      'rate-beyond-table': 'The date is after the bundled rate table (%r). The row is excluded – wait for an updated table or calculate manually.',
      oversold: 'Sells %s units but the file only shows %h held. Buys are probably missing (opened before the statement start date, transfer in). Sales from this row onward are excluded.',
      'history-gap': 'The position was opened before the statement start date (%d). The average-cost method needs every purchase of the same share – including ones still open or closed before the start date. Download the statement from the account start (eToro: Settings → Account → Account Statement, pick an early date) to get the average right.',
      'duplicate-position': '%n closed position(s) appeared in more than one file and were counted once.',
      'multi-file': 'The same holding appears in more than one file. If the files overlap in time purchases are counted twice – preferably upload one statement covering the whole period.'
    }
  };

  /* Points where the tax treatment is genuinely uncertain: shown to the user, never silently decided. */
  var NOTES = {
    sv: {
      'u-history': 'Riktiga aktier, ETF:er och krypto räknas med genomsnittsmetoden per instrument (alla köp av samma aktie slås ihop), inte per eToro-position. Resultatet kan därför skilja sig från eToros "Profit" per position, men summan över tid blir densamma. Det kräver att kontoutdraget täcker alla köp – välj kontots startdatum när du laddar ner det.',
      'u-crypto': 'Krypto (avsnitt D): riktiga kryptopositioner (ej hävstång) redovisas i avsnitt D med genomsnittsmetoden. Flyttade du krypto till eToro Money/egen plånbok eller in från annat håll syns det inte i Closed Positions – lägg till sådant manuellt.',
      'u-cfd': 'CFD:er, hävstång och blankning: eToro redovisar dem som CFD-kontrakt. Skatteverket behandlar CFD:er som terminer – resultatet per stängd position (vinst plus/minus overnight-avgifter och utdelningsjusteringar) redovisas, inte genomsnittsmetod. Verktyget tar Profit(USD) + Overnight Fees and Dividends × Riksbankens USD-kurs på stängningsdagen och nettar per instrument: vinst som försäljningspris, förlust som omkostnadsbelopp. Kontrollera.',
      'u-cfd-otc': 'Avsnitt för CFD på aktier/index: marknadsnoterade CFD:er på aktier och aktieindex ska i avsnitt A, men onoterade i avsnitt D. Skatteverket skriver uttryckligen att eToro inte har uttalat sig om dess CFD:er är marknadsnoterade. Verktyget lägger dem därför i avsnitt D (onoterade) som standard – du kan välja avsnitt A i inställningen ovanför resultatet. Valet påverkar kvittningen (A: 70 % av förlusten mot övrigt, D: 70 % utan kvittning mot marknadsnoterade aktier). Kontrollera med Skatteverket.',
      'u-cfd-guess': 'Underliggande tillgång gissad: för minst en CFD framgår det inte av filen om den gäller en aktie, ett index, en valuta eller en råvara. Verktyget har tolkat den som aktie. Kontrollera avsnittet för raderna markerade "gissad".',
      'u-short': 'Blankning (short): eToro öppnar alla korta positioner som CFD. De redovisas som CFD-resultat per position (se ovan). Kontrollera.',
      'u-type-missing': 'Kolumnen Type saknas i ditt kontoutdrag (äldre format). Positioner utan hävstång som är "Buy" tolkas som riktiga aktier/krypto och övriga som CFD. Kontrollera klassningen.',
      'u-activity-old': 'Fliken Account Activity saknar kolumnerna Units/Asset type (äldre format). Positioner som fortfarande är öppna kan då inte läggas in i genomsnittet. Har du köpt samma aktie i en position som fortfarande är öppen och sålt en annan, ladda ner ett nyare kontoutdrag eller kontrollera genomsnittet manuellt.',
      'u-dividend': 'Utdelningar är inte K4. Bruttoutdelningen (netto + innehållen källskatt) i kronor deklareras i ruta 7.2 om den inte är förifylld. Utländsk källskatt kan avräknas – ange den under "Övriga upplysningar"/avräkning av utländsk skatt, högst den skatt som skatteavtalet tillåter (normalt 15 %). Har du fått mer än 15 % innehållet får du begära tillbaka mellanskillnaden i källlandet. Summorna visas nedan.',
      'u-div-net': 'Fliken Dividends saknas, så utdelningarna är tagna från Account Activity – det är nettobelopp efter källskatt. Bruttobelopp och källskatt framgår inte; ladda ner ett nyare kontoutdrag med fliken Dividends.',
      'u-interest': 'Ränta från eToro (t.ex. ränta på saldo) är inkomst av kapital, inte K4. Deklarera den själv som ränteinkomst om den inte är förifylld. Summan visas nedan.',
      'u-reward': 'Staking-belöningar beskattas som inkomst av kapital när de tas emot och deklareras utanför K4 – summan visas nedan. Belöningen blir också omkostnadsbelopp för kryptot, men eToro-filen visar inte det som en köpposition. Kontrollera.',
      'u-usd-cash': 'eToro-kontot är i USD. Att växla kronor till dollar och tillbaka kan i sig ge en valutavinst eller -förlust (avsnitt C). Verktyget räknar inte på USD-saldot – är det stora belopp, räkna separat.'
    },
    en: {
      'u-history': 'Real stocks, ETFs and crypto use the average-cost method per instrument (all purchases of the same share are pooled), not per eToro position. Results can therefore differ from eToro\'s per-position "Profit", although the total over time is the same. The statement must cover every purchase – choose the account start date when downloading it.',
      'u-crypto': 'Crypto (section D): real (non-leveraged) crypto positions go in section D with the average-cost method. Crypto moved to eToro Money/your own wallet or in from elsewhere is not in Closed Positions – add that manually.',
      'u-cfd': 'CFDs, leverage and short selling: eToro books these as CFD contracts. Skatteverket treats CFDs like futures – the result per closed position (profit plus/minus overnight fees and dividend adjustments) is reported, not average cost. The tool uses Profit(USD) + Overnight Fees and Dividends × the Riksbank USD rate on the close date and nets per instrument: gains as sale price, losses as cost basis. Please check.',
      'u-cfd-otc': 'Section for CFDs on shares/indices: market-listed CFDs on shares and share indices belong in section A, unlisted ones in section D. Skatteverket states explicitly that eToro has not said whether its CFDs are market-listed. The tool therefore puts them in section D (unlisted) by default – you can choose section A in the setting above the result. The choice affects loss offsetting. Check with Skatteverket.',
      'u-cfd-guess': 'Underlying guessed: for at least one CFD the file does not say whether it is a share, an index, a currency or a commodity. The tool treated it as a share. Check the section for rows marked "guessed".',
      'u-short': 'Short selling: eToro opens all short positions as CFDs. They are reported as CFD results per position (see above). Please check.',
      'u-type-missing': 'The Type column is missing from your statement (older format). Unleveraged "Buy" positions are treated as real shares/crypto and the rest as CFDs. Check the classification.',
      'u-activity-old': 'The Account Activity sheet lacks the Units/Asset type columns (older format), so positions that are still open cannot be added to the average. If you bought the same share in a still-open position and sold another, download a newer statement or check the average manually.',
      'u-dividend': 'Dividends are not K4. The gross dividend (net + tax withheld) in SEK is declared in box 7.2 if not pre-filled. Foreign withholding tax can be credited – enter it under "Övriga upplysningar"/credit for foreign tax, at most what the tax treaty allows (normally 15%). If more than 15% was withheld you can reclaim the difference in the source country. Totals are shown below.',
      'u-div-net': 'The Dividends sheet is missing, so dividends come from Account Activity – these are net amounts after withholding tax. Gross amounts and tax withheld are unknown; download a newer statement that has the Dividends sheet.',
      'u-interest': 'Interest from eToro (e.g. on cash balance) is capital income, not K4. Declare it yourself as interest income if not pre-filled. The total is shown below.',
      'u-reward': 'Staking rewards are taxed as capital income when received and are declared outside K4 – the total is shown below. The reward also becomes cost basis for the crypto, but the eToro file does not show it as a buy position. Please check.',
      'u-usd-cash': 'The eToro account is in USD. Converting SEK to dollars and back can itself give a currency gain or loss (section C). The tool does not calculate the USD balance – if the amounts are large, calculate it separately.'
    }
  };
  function note(code, lang) { return (NOTES[lang] || NOTES.sv)[code] || code; }
  function fmtQ(n) { return (Math.round(n * 1e8) / 1e8).toString(); }
  function text(issue, lang, rateTo) {
    var s = (M[lang] || M.sv)[issue.code] || issue.code, x = issue.extra;
    return s.replace('%t', issue.rawType || '').replace('%n', x && x.n != null ? x.n : issue.count || 1).replace('%k', issue.ticker || '').replace('%c', typeof x === 'string' ? x : '')
      .replace('%s', x && x.sell != null ? fmtQ(x.sell) : '').replace('%h', x && x.have != null ? fmtQ(x.have) : '').replace('%d', x && x.start ? x.start : '')
      .replace('%r', rateTo ? rateTo.slice(0, 4) + '-' + rateTo.slice(4, 6) + '-' + rateTo.slice(6, 8) : '');
  }
  return { text: text, note: note, M: M, NOTES: NOTES };
});
