/* Texts (da/en) for the per-country specification and checklist + the XLSX workbook layout (UMD), for a resident of Denmark.
   sheets(result, lang) → [{name, rows, widths, freeze}] for XLSXW.build. specColumns(cc, lang, cur) for the on-screen tables. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.KEXPORT = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var ORDER = ['NO', 'DE', 'CH', 'FI', 'SE'];
  var NAMES = {
    da: { NO: 'Norge', DE: 'Tyskland', CH: 'Schweiz', FI: 'Finland', SE: 'Sverige', FR: 'Frankrig', US: 'USA', DK: 'Danmark', GB: 'Storbritannien', NL: 'Holland', IE: 'Irland', CA: 'Canada' },
    en: { NO: 'Norway', DE: 'Germany', CH: 'Switzerland', FI: 'Finland', SE: 'Sweden', FR: 'France', US: 'USA', DK: 'Denmark', GB: 'United Kingdom', NL: 'Netherlands', IE: 'Ireland', CA: 'Canada' }
  };
  var STATUS = {
    da: { open: 'Åben', urgent: 'Haster – fristen er tæt på', wait: 'Vent – for tidligt at søge', expired: 'Forældet', nothing: 'Intet at hente' },
    en: { open: 'Open', urgent: 'Urgent – deadline soon', wait: 'Wait – too early to claim', expired: 'Time-barred', nothing: 'Nothing to reclaim' }
  };
  var HOW = {
    da: { 'per-share': 'antal × udbytte pr. aktie fra filen', 'file-amount': 'beløb i filen', nationalbanken: 'DKK-beløb omregnet med Nationalbankens kurs – sammenlign med bankens udbyttenota' },
    en: { 'per-share': 'shares × dividend per share from the file', 'file-amount': 'amount in the file', nationalbanken: 'DKK amount converted at the Danmarks Nationalbank rate – compare with the bank\'s dividend note' }
  };
  /* Checklist per country for a person resident in Denmark. Facts checked 2026-11-01 against skatteetaten.no, bzst.de,
     estv.admin.ch, vero.fi, skatteverket.se and skat.dk (see README – items marked "kontrollér" are not fully confirmed). */
  var ATTEST = { da: 'Skattepligtsattest fra Skattestyrelsen: bestil den i TastSelv Borger (Kontakt → Skriv til os → Skattepligtsattest) – blanket 02.034A til lande med dobbeltbeskatningsoverenskomst.',
    en: 'Certificate of tax residence from the Danish Tax Agency (Skattestyrelsen): order it in TastSelv Borger (Kontakt → Skriv til os → Skattepligtsattest) – form 02.034A for treaty countries.' };
  var CHECK = {
    da: {
      NO: ['Søg hos Skatteetaten: den digitale ansøgning om refusion af kildeskat for personlige aksjonærer på skatteetaten.no, eller papirblanketten "Refusjon etter skatteavtale for personlige aksjonærer" (Skatteetaten, Postboks 9200 Grønland, 0134 Oslo).',
           'Du skal bruge: ISIN, udbetalingsdag, antal aktier, udbytte pr. aktie og bruttobeløb i NOK, tilbageholdt skat i NOK, dit danske skatte-ID (TIN), Nordnets forvalterkonto (NOM-konto) i VPS – spørg Nordnet – og dine bankoplysninger (IBAN/BIC).',
           ATTEST.da,
           'Vent ca. fire måneder efter udbetalingen. Beløb under 50 NOK udbetales ikke. Sagsbehandlingen kan tage lang tid.',
           'Frist: fem år efter udgangen af udbytteåret.'],
      DE: ['Ansøgningen skal indsendes elektronisk i BZSt-Online-Portal (BOP) hos Bundeszentralamt für Steuern (Erstattung der Kapitalertragsteuer, § 50c EStG). Du skal først registrere dig i portalen – det tager tid, fordi aktiveringsdata sendes med brev.',
           'Upload bankens udbyttenota/skattebevis, der viser bruttoudbytte og tilbageholdt tysk skat (26,375 %), og en bopælsbekræftelse fra Skattestyrelsen (BZSt har en formular, som Skattestyrelsen skal bekræfte – kontrollér i portalen).',
           'Du får 11,375 % af bruttoudbyttet tilbage (26,375 % − 15 %).',
           'Frist: fire år efter udgangen af det år, udbyttet blev udbetalt (udbytte 2022 → senest 31. december 2026).'],
      CH: ['Udfyld ESTV formular 89 (for personer bosat i Danmark) – i to eksemplarer. Flere udbytter fra samme år kan stå på samme formular.',
           'Skattestyrelsen skal bekræfte din bopæl i Danmark på formularen; ifølge den schweizisk-danske ordning indsendes kravet via de danske skattemyndigheder. Kontrollér den aktuelle fremgangsmåde på formularen.',
           'Vedlæg bankens udbyttenota. Du får 20 % af bruttoudbyttet tilbage (35 % − 15 %), i CHF.',
           'Frist: tre år efter udgangen af udbytteåret (udbytte 2023 → senest 31. december 2026).'],
      FI: ['Finske Skatteforvaltning (Vero): blanket 6164e (ansøgning om tilbagebetaling af finsk kildeskat på udbytte) – og bilag 6167e, når du søger for mere end ét udbytte. Beløb i euro med to decimaler.',
           'Vedlæg skattepligtsattest (eller få den påført blanketten) og bankens udbyttenota, der viser brutto og tilbageholdt skat.',
           'Send blanketten til adressen på blanketten. Beløb under 10 euro udbetales ikke.',
           'Frist: tre år efter udgangen af udbytteåret (udbytte 2023 → senest 31. december 2026).'],
      SE: ['Skatteverket: blanket SKV 3740 (Ansökan om återbetalning av svensk skatt på utdelning). Send den underskrevet med e-mail (elektronisk signatur, emne "kupongskatt") eller med post til Skatteverket, Box 6037, 171 06 Solna.',
           'Vedlæg bankens udbyttenota, der viser udbytte og svensk kupongskat, og en bopælsbekræftelse (hemvistintyg) fra Skattestyrelsen – den kan også påføres blanketten.',
           'Vent mindst fire måneder efter udbetalingen. Sagsbehandlingen tager ofte et til to år.',
           'Frist: Skatteverket skal have ansøgningen senest 31. december i det femte år efter udbytteåret.']
    },
    en: {
      NO: ['Apply to Skatteetaten: the online application for refund of withholding tax for individual shareholders on skatteetaten.no, or the paper form "Refusjon etter skatteavtale for personlige aksjonærer" (Skatteetaten, Postboks 9200 Grønland, 0134 Oslo).',
           'You need: ISIN, payment date, number of shares, dividend per share and gross amount in NOK, tax withheld in NOK, your Danish tax ID (TIN), Nordnet\'s nominee account (NOM account) in VPS – ask Nordnet – and your bank details (IBAN/BIC).',
           ATTEST.en,
           'Wait about four months after the payment. Amounts under NOK 50 are not paid. Processing can take a long time.',
           'Deadline: five years after the end of the dividend year.'],
      DE: ['The claim must be filed electronically in the BZSt-Online-Portal (BOP) of the Bundeszentralamt für Steuern (refund of Kapitalertragsteuer, § 50c EStG). Register in the portal first – this takes time because activation data is sent by post.',
           'Upload the bank\'s dividend note/tax certificate showing the gross dividend and German tax withheld (26.375 %), and a residence confirmation from the Danish Tax Agency (BZSt provides a form for Skattestyrelsen to confirm – check in the portal).',
           'You get back 11.375 % of the gross dividend (26.375 % − 15 %).',
           'Deadline: four years after the end of the year the dividend was paid (2022 dividends → by 31 December 2026).'],
      CH: ['Fill in ESTV form 89 (for residents of Denmark) – in duplicate. Several dividends from the same year can go on one form.',
           'The Danish Tax Agency must confirm your residence on the form; under the Swiss–Danish arrangement the claim is submitted via the Danish tax authorities. Check the current procedure on the form.',
           'Attach the bank\'s dividend note. You get back 20 % of the gross dividend (35 % − 15 %), in CHF.',
           'Deadline: three years after the end of the dividend year (2023 dividends → by 31 December 2026).'],
      FI: ['Finnish Tax Administration (Vero): form 6164e (application for refund of Finnish withholding tax on dividends) – plus appendix 6167e when you claim for more than one dividend. Amounts in euro with two decimals.',
           'Attach the certificate of residence (or have it stamped on the form) and the bank\'s dividend note showing gross and tax withheld.',
           'Send it to the address on the form. Refunds under 10 euro are not paid.',
           'Deadline: three years after the end of the dividend year (2023 dividends → by 31 December 2026).'],
      SE: ['Skatteverket: form SKV 3740 (application for refund of Swedish tax on dividends). Send it signed by e-mail (electronic signature, subject "kupongskatt") or by post to Skatteverket, Box 6037, 171 06 Solna, Sweden.',
           'Attach the bank\'s dividend note showing the dividend and Swedish withholding tax, and a certificate of residence from the Danish Tax Agency – it can also be stamped on the form.',
           'Wait at least four months after the payment. Processing often takes one to two years.',
           'Deadline: Skatteverket must receive the claim by 31 December of the fifth year after the dividend year.']
    }
  };
  var H = {
    da: { name: 'Selskab', isin: 'ISIN', date: 'Udbetalingsdag', qty: 'Antal aktier', ps: 'Udbytte/aktie', gross: 'Bruttoudbytte', wh: 'Tilbageholdt skat', treaty: 'Skat efter aftale 15 %', reclaim: 'Til tilbagebetaling', acc: 'Depot', basis: 'Grundlag', status: 'Status', deadline: 'Frist', country: 'Land', year: 'År', n: 'Udbytter', sek: 'ca. DKK', rate: 'Skattesats', grossSek: 'Brutto DKK', taxSek: 'Kildeskat DKK', line: 'Linje i filen', note: 'Kontrollér', open: 'Til tilbagebetaling (åben)', cur: 'Valuta' },
    en: { name: 'Company', isin: 'ISIN', date: 'Payment date', qty: 'Shares', ps: 'Dividend/share', gross: 'Gross dividend', wh: 'Tax withheld', treaty: 'Treaty tax 15 %', reclaim: 'To reclaim', acc: 'Account', basis: 'Basis', status: 'Status', deadline: 'Deadline', country: 'Country', year: 'Year', n: 'Dividends', sek: 'approx. DKK', rate: 'Tax rate', grossSek: 'Gross DKK', taxSek: 'Withheld DKK', line: 'Line in file', note: 'To check', open: 'To reclaim (open)', cur: 'Currency' }
  };
  var FLAG = {
    da: { 'fx-nationalbanken': 'Omregnet med Nationalbankens kurs', 'no-tax-row': 'Ingen kildeskat tilbageholdt', 'odd-rate': 'Usædvanlig skattesats', reversal: 'Annulleret/rettet i filen', 'refund-seen': 'Tilbagebetaling allerede bogført', 'mixed-currency': 'Blandede valutaer', 'no-rate': 'Valutakurs mangler', 'rate-beyond-table': 'Seneste kendte kurs brugt' },
    en: { 'fx-nationalbanken': 'Converted at the Nationalbank rate', 'no-tax-row': 'No withholding tax', 'odd-rate': 'Unusual tax rate', reversal: 'Cancelled/corrected in the file', 'refund-seen': 'Refund already booked', 'mixed-currency': 'Mixed currencies', 'no-rate': 'Exchange rate missing', 'rate-beyond-table': 'Latest known rate used' }
  };
  var L = function (lang) { return lang === 'en' ? 'en' : 'da'; };
  function specColumns(cc, lang, cur) { var h = H[L(lang)]; return [h.name, h.isin, h.date, h.qty, h.ps + ' (' + cur + ')', h.gross + ' (' + cur + ')', h.wh + ' (' + cur + ')', h.treaty + ' (' + cur + ')', h.reclaim + ' (' + cur + ')', h.acc, h.note]; }
  function flagText(it, lang) { return it.flags.map(function (f) { return FLAG[L(lang)][f] || f; }).join('; '); }
  function sheets(res, lang) {
    lang = L(lang);
    var h = H[lang], N = NAMES[lang], S = STATUS[lang], M = function (v) { return { v: Math.round(v * 100) / 100, t: 'money' }; };
    var sum = [[lang === 'en' ? 'Foreign dividend tax to reclaim – summary (resident of Denmark)' : 'Udenlandsk udbytteskat til tilbagesøgning – oversigt'],
      [lang === 'en' ? 'Calculated ' + res.today + '. Check every amount against the bank\'s dividend note before you send anything.' : 'Beregnet ' + res.today + '. Kontrollér alle beløb mod bankens udbyttenota, før du sender noget.'], [],
      [h.country, h.year, h.cur, h.n, h.gross, h.wh, h.reclaim, h.open, h.sek, h.status, h.deadline].map(function (x) { return { v: x, b: true }; })];
    res.groups.forEach(function (g) { sum.push([N[g.country], g.year, g.cur, g.n, M(g.gross), M(g.withheld), M(g.reclaim), M(g.reclaimOpen), { v: Math.round(g.reclaimOpenSek), t: 'int' }, S[g.status], g.deadline]); });
    var out = [{ name: lang === 'en' ? 'Summary' : 'Oversigt', rows: sum, widths: [14, 8, 8, 12, 16, 16, 16, 18, 12, 30, 14] }];
    ORDER.forEach(function (cc) {
      var its = res.items.filter(function (i) { return i.country === cc; }); if (!its.length) return;
      var cur = its[0].cur, rows = [], years = [];
      its.forEach(function (i) { if (years.indexOf(i.year) < 0) years.push(i.year); });
      years.forEach(function (y) {
        var yi = its.filter(function (i) { return i.year === y; });
        rows.push([{ v: N[cc] + ' ' + y, b: true }]);
        rows.push(specColumns(cc, lang, cur).map(function (x) { return { v: x, b: true }; }));
        yi.forEach(function (i) { rows.push([i.name, i.isin, i.date, i.qty, i.how === 'per-share' ? { v: i.perShare, t: 'money' } : '', M(i.gross), M(i.withheld), M(i.treaty), M(i.reclaim), i.account, flagText(i, lang)]); });
        var tg = yi.reduce(function (a, i) { a[0] += i.gross; a[1] += i.withheld; a[2] += i.treaty; a[3] += i.reclaim; return a; }, [0, 0, 0, 0]);
        rows.push([{ v: lang === 'en' ? 'Total' : 'I alt', b: true }, '', '', '', '', { v: Math.round(tg[0] * 100) / 100, t: 'money', b: true }, { v: Math.round(tg[1] * 100) / 100, t: 'money', b: true }, { v: Math.round(tg[2] * 100) / 100, t: 'money', b: true }, { v: Math.round(tg[3] * 100) / 100, t: 'money', b: true }]);
        rows.push([]);
      });
      rows.push([{ v: lang === 'en' ? 'Checklist' : 'Tjekliste', b: true }]);
      CHECK[lang][cc].forEach(function (c) { rows.push(['• ' + c]); });
      out.push({ name: N[cc], rows: rows, widths: [32, 15, 13, 11, 15, 16, 16, 18, 16, 16, 40] });
    });
    var all = [[h.date, h.acc, h.name, h.isin, h.country, h.qty, h.grossSek, h.taxSek, h.rate, h.basis, h.line, h.note].map(function (x) { return { v: x, b: true }; })];
    res.items.forEach(function (i) { all.push([i.date, i.account, i.name, i.isin, i.country, i.qty, M(i.grossSek), M(i.taxSek), (Math.round(i.rate * 1000) / 10) + ' %', HOW[lang][i.how] || '', i.lines.join(', '), flagText(i, lang)]); });
    out.push({ name: lang === 'en' ? 'All dividends' : 'Alle udbytter', rows: all, widths: [12, 18, 32, 15, 8, 10, 14, 14, 10, 40, 12, 36], freeze: 1 });
    return out;
  }
  return { sheets: sheets, specColumns: specColumns, flagText: flagText, NAMES: NAMES, STATUS: STATUS, HOW: HOW, CHECK: CHECK, H: H, FLAG: FLAG, ORDER: ORDER };
});
