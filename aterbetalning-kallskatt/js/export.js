/* Shared texts (sv/en) for the per-country specification and checklist + the XLSX workbook layout (UMD).
   sheets(result, lang) → [{name, rows, widths, freeze}] for XLSXW.build. specColumns(cc, lang) / specRow(item) for the on-screen tables. */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.KEXPORT = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NAMES = { sv: { FI: 'Finland', NO: 'Norge', DK: 'Danmark', CH: 'Schweiz' }, en: { FI: 'Finland', NO: 'Norway', DK: 'Denmark', CH: 'Switzerland' } };
  var STATUS = {
    sv: { open: 'Öppen', urgent: 'Bråttom – deadline snart', wait: 'Vänta – för tidigt att ansöka', expired: 'Preskriberad', nothing: 'Inget att hämta' },
    en: { open: 'Open', urgent: 'Urgent – deadline soon', wait: 'Wait – too early to claim', expired: 'Time-barred', nothing: 'Nothing to reclaim' }
  };
  var HOW = {
    sv: { 'per-share': 'antal × utdelning/aktie från filen', 'file-amount': 'belopp i filen', riksbank: 'SEK-belopp omräknat med Riksbankens kurs – jämför med bankens utdelningsavi' },
    en: { 'per-share': 'shares × dividend per share from the file', 'file-amount': 'amount in the file', riksbank: 'SEK amount converted at the Riksbank rate – compare with the bank\'s dividend statement' }
  };
  /* Checklist per country. Facts checked 2026-10-31 against vero.fi, skatteetaten.no, skat.dk and estv.admin.ch (see README). */
  var CHECK = {
    sv: {
      FI: ['Blankett 6164r (ansökan om återbäring av finsk källskatt på dividender) + bilaga 6167r – en bilaga per år. Fyll i beloppen i euro med två decimaler.',
           'Bifoga hemvistintyg från Skatteverket och bankens utdelningsavi/årsbesked som visar brutto och innehållen skatt.',
           'Skicka per post till adressen på blanketten. Återbetalning under 10 euro betalas inte ut.',
           'Sista dag: tre år efter utgången av utdelningsåret (utdelning 2023 → senast 31 december 2026).'],
      NO: ['Ansök hos Skatteetaten: webbformuläret "refund of withholding tax" eller pappersblanketten "Application for refund of Norwegian withholding tax under a Double Taxation Treaty" (Skatteetaten, Postboks 9200 Grønland, 0134 Oslo).',
           'Du behöver: ISIN, utbetalningsdag, antal aktier, utdelning per aktie och bruttobelopp i NOK, innehållen skatt i NOK, bankens förvaltarkonto i VPS (fråga banken), IBAN/BIC och hemvistintyg från Skatteverket.',
           'Vänta cirka fyra månader efter utbetalningen innan du ansöker. Belopp under 50 NOK betalas inte ut.',
           'Sista dag: fem år efter utgången av utdelningsåret.'],
      DK: ['Ansök hos Skattestyrelsen med blankett 06.030 (claim for refund of Danish dividend tax) – digitalt via skat.dk.',
           'Bifoga hemvistintyg/intyg från Skatteverket enligt blanketten och bankens utdelningsavi.',
           'Sista dag: fem år från det att skatten drogs (ändrat från tre år efter en dom i danska Högsta domstolen 2026).'],
      CH: ['Ansök hos ESTV med Form 80 (för personer bosatta i Sverige), digitalt via ESTV:s formulärtjänst.',
           'Bifoga bankens utdelningsavi. Kontrollera på blanketten om Skatteverkets intyg krävs.',
           'Sista dag: tre år efter utgången av utdelningsåret.']
    },
    en: {
      FI: ['Form 6164r (application for refund of Finnish withholding tax on dividends) + appendix 6167r – one appendix per year. Enter amounts in euro with two decimals.',
           'Attach a certificate of residence from Skatteverket and the bank\'s dividend statement showing gross and tax withheld.',
           'Post it to the address on the form. Refunds under 10 euro are not paid.',
           'Deadline: three years after the end of the dividend year (2023 dividends → by 31 December 2026).'],
      NO: ['Apply to Skatteetaten: the online "refund of withholding tax" form or the paper form "Application for refund of Norwegian withholding tax under a Double Taxation Treaty" (Skatteetaten, Postboks 9200 Grønland, 0134 Oslo).',
           'You need: ISIN, payment date, number of shares, dividend per share and gross amount in NOK, tax withheld in NOK, your bank\'s nominee account in VPS (ask the bank), IBAN/BIC and a certificate of residence from Skatteverket.',
           'Wait about four months after the payment before claiming. Amounts under NOK 50 are not paid.',
           'Deadline: five years after the end of the dividend year.'],
      DK: ['Claim from the Danish Tax Agency with form 06.030 (claim for refund of Danish dividend tax) – online via skat.dk.',
           'Attach the certificate from Skatteverket required by the form and the bank\'s dividend statement.',
           'Deadline: five years from when the tax was withheld (changed from three years after a 2026 Danish Supreme Court ruling).'],
      CH: ['Claim from the ESTV with Form 80 (for residents of Sweden), online via the ESTV forms service.',
           'Attach the bank\'s dividend statement. Check on the form whether a Skatteverket certificate is required.',
           'Deadline: three years after the end of the dividend year.']
    }
  };
  var H = {
    sv: { name: 'Bolag', isin: 'ISIN', date: 'Utbetalningsdag', qty: 'Antal aktier', ps: 'Utdelning/aktie', gross: 'Bruttoutdelning', wh: 'Innehållen skatt', treaty: 'Skatt enligt avtal 15 %', reclaim: 'Att återfå', acc: 'Konto', basis: 'Underlag', status: 'Status', deadline: 'Sista dag', country: 'Land', year: 'År', n: 'Utdelningar', sek: 'ca SEK', rate: 'Skattesats', grossSek: 'Brutto SEK', taxSek: 'Källskatt SEK', line: 'Rad i filen', note: 'Att kontrollera', open: 'Att återfå (öppet)', cur: 'Valuta' },
    en: { name: 'Company', isin: 'ISIN', date: 'Payment date', qty: 'Shares', ps: 'Dividend/share', gross: 'Gross dividend', wh: 'Tax withheld', treaty: 'Treaty tax 15 %', reclaim: 'To reclaim', acc: 'Account', basis: 'Basis', status: 'Status', deadline: 'Deadline', country: 'Country', year: 'Year', n: 'Dividends', sek: 'approx. SEK', rate: 'Tax rate', grossSek: 'Gross SEK', taxSek: 'Withheld SEK', line: 'Line in file', note: 'To check', open: 'To reclaim (open)', cur: 'Currency' }
  };
  var FLAG = {
    sv: { 'fx-riksbank': 'Omräknat med Riksbankens kurs', 'no-tax-row': 'Ingen källskatt dragen', 'odd-rate': 'Ovanlig skattesats', reversal: 'Makulerad/rättad i filen', 'refund-seen': 'Återbetalning redan bokad', 'mixed-currency': 'Blandade valutor', 'no-rate': 'Valutakurs saknas', 'rate-beyond-table': 'Senaste kända kurs använd' },
    en: { 'fx-riksbank': 'Converted at the Riksbank rate', 'no-tax-row': 'No withholding tax', 'odd-rate': 'Unusual tax rate', reversal: 'Cancelled/corrected in the file', 'refund-seen': 'Refund already booked', 'mixed-currency': 'Mixed currencies', 'no-rate': 'Exchange rate missing', 'rate-beyond-table': 'Latest known rate used' }
  };
  function specColumns(cc, lang, cur) { var h = H[lang]; return [h.name, h.isin, h.date, h.qty, h.ps + ' (' + cur + ')', h.gross + ' (' + cur + ')', h.wh + ' (' + cur + ')', h.treaty + ' (' + cur + ')', h.reclaim + ' (' + cur + ')', h.acc, h.note]; }
  function flagText(it, lang) { return it.flags.map(function (f) { return FLAG[lang][f] || f; }).join('; '); }
  function sheets(res, lang) {
    lang = lang === 'en' ? 'en' : 'sv';
    var h = H[lang], N = NAMES[lang], S = STATUS[lang], M = function (v) { return { v: Math.round(v * 100) / 100, t: 'money' }; };
    var sum = [[lang === 'en' ? 'Foreign withholding tax to reclaim – summary' : 'Källskatt att återfå – sammanställning'],
      [lang === 'en' ? 'Calculated ' + res.today + '. Check every amount against the bank\'s dividend statement before you send anything.' : 'Beräknat ' + res.today + '. Kontrollera alla belopp mot bankens utdelningsavi innan du skickar något.'], [],
      [h.country, h.year, h.cur, h.n, h.gross, h.wh, h.reclaim, h.open, h.sek, h.status, h.deadline].map(function (x) { return { v: x, b: true }; })];
    res.groups.forEach(function (g) { sum.push([N[g.country], g.year, g.cur, g.n, M(g.gross), M(g.withheld), M(g.reclaim), M(g.reclaimOpen), { v: Math.round(g.reclaimOpenSek), t: 'int' }, S[g.status], g.deadline]); });
    var out = [{ name: lang === 'en' ? 'Summary' : 'Sammanställning', rows: sum, widths: [14, 8, 8, 12, 16, 16, 16, 18, 12, 30, 14] }];
    ['FI', 'NO', 'DK', 'CH'].forEach(function (cc) {
      var its = res.items.filter(function (i) { return i.country === cc; }); if (!its.length) return;
      var cur = its[0].cur, rows = [], years = [];
      its.forEach(function (i) { if (years.indexOf(i.year) < 0) years.push(i.year); });
      years.forEach(function (y) {
        var yi = its.filter(function (i) { return i.year === y; });
        rows.push([{ v: N[cc] + ' ' + y, b: true }]);
        rows.push(specColumns(cc, lang, cur).map(function (x) { return { v: x, b: true }; }));
        yi.forEach(function (i) { rows.push([i.name, i.isin, i.date, i.qty, i.perShareCur === cur || (i.how === 'per-share') ? { v: i.perShare, t: 'money' } : '', M(i.gross), M(i.withheld), M(i.treaty), M(i.reclaim), i.account, flagText(i, lang)]); });
        var tg = yi.reduce(function (a, i) { a[0] += i.gross; a[1] += i.withheld; a[2] += i.treaty; a[3] += i.reclaim; return a; }, [0, 0, 0, 0]);
        rows.push([{ v: lang === 'en' ? 'Total' : 'Summa', b: true }, '', '', '', '', { v: Math.round(tg[0] * 100) / 100, t: 'money', b: true }, { v: Math.round(tg[1] * 100) / 100, t: 'money', b: true }, { v: Math.round(tg[2] * 100) / 100, t: 'money', b: true }, { v: Math.round(tg[3] * 100) / 100, t: 'money', b: true }]);
        rows.push([]);
      });
      rows.push([{ v: lang === 'en' ? 'Checklist' : 'Checklista', b: true }]);
      CHECK[lang][cc].forEach(function (c) { rows.push(['• ' + c]); });
      out.push({ name: N[cc], rows: rows, widths: [32, 15, 13, 11, 15, 16, 16, 18, 16, 16, 40] });
    });
    var all = [[h.date, h.acc, h.name, h.isin, h.country, h.qty, h.grossSek, h.taxSek, h.rate, h.basis, h.line, h.note].map(function (x) { return { v: x, b: true }; })];
    res.items.forEach(function (i) { all.push([i.date, i.account, i.name, i.isin, i.country, i.qty, M(i.grossSek), M(i.taxSek), (Math.round(i.rate * 1000) / 10) + ' %', HOW[lang][i.how] || '', i.lines.join(', '), flagText(i, lang)]); });
    out.push({ name: lang === 'en' ? 'All dividends' : 'Alla utdelningar', rows: all, widths: [12, 18, 32, 15, 8, 10, 14, 14, 10, 40, 12, 36], freeze: 1 });
    return out;
  }
  return { sheets: sheets, specColumns: specColumns, flagText: flagText, NAMES: NAMES, STATUS: STATUS, HOW: HOW, CHECK: CHECK, H: H, FLAG: FLAG };
});
