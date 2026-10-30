/* SRU writer for K4 section A (UMD). Format per Skatteverket SKV 269 (SRU-filer) + 2026P4 field table:
 *   INFO.SRU       #DATABESKRIVNING_START … #MEDIELEV_SLUT (ORGNR, NAMN, POSTNR, POSTORT required)
 *   BLANKETTER.SRU one #BLANKETT K4-<year>P4 block per K4 page (max 9 rows in section A), #FIL_SLUT at the end.
 *   Section A row n (1..9): antal 3100+10(n-1), beteckning +1, försäljningspris +2, omkostnadsbelopp +3, vinst +4, förlust +5.
 *   Page sums: 3300 försäljningspris, 3301 omkostnadsbelopp, 3304 vinst, 3305 förlust. 7014 = page number when >1 page.
 *   Numeric fields are whole numbers (Numeriskt_B, 0…999999999999). Files are ISO 8859-1, one record per line (LF). */
(function (root, factory) {
  var m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m; else root.SRU = m;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var NL = '\n', PROGRAM = 'REVOLUTTILLK4 1.0';

  function luhnOk(d10) { var s = 0; for (var i = 0; i < 10; i++) { var n = +d10[i] * (i % 2 ? 1 : 2); s += n > 9 ? n - 9 : n; } return s % 10 === 0; }
  /* "YYYYMMDD-XXXX", "YYYYMMDDXXXX", "YYMMDD-XXXX", "YYMMDD+XXXX" → 12 digits, or null. Accepts samordningsnummer (day+60). */
  function normPersnr(s, now) {
    s = String(s || '').trim().replace(/\s/g, '');
    var m = /^(\d{2})?(\d{2})(\d{2})(\d{2})([-+]?)(\d{4})$/.exec(s);
    if (!m) return null;
    var yy = m[2], cent = m[1], ref = (now || new Date()).getFullYear();
    if (!cent) { var y = 2000 + +yy; if (y > ref) y -= 100; if (m[5] === '+') y -= 100; cent = String(y).slice(0, 2); }
    var year = +(cent + yy), mon = +m[3], day = +m[4]; if (day > 60) day -= 60;
    var dt = new Date(Date.UTC(year, mon - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== mon - 1 || dt.getUTCDate() !== day) return null;
    var d10 = yy + m[3] + m[4] + m[6];
    return luhnOk(d10) ? cent + d10 : null;
  }
  function normPostnr(s) { var d = String(s || '').replace(/\s/g, ''); return /^\d{5}$/.test(d) ? d : null; }
  /* Strings: single line, ISO 8859-1 representable, trimmed to max length. */
  function str(s, max) {
    s = String(s == null ? '' : s).replace(/[\r\n\t]+/g, ' ').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
      .replace(/[^\x20-\x7e\xa0-\xff]/g, '?').replace(/\s+/g, ' ').trim();
    return max ? s.slice(0, max) : s;
  }
  function int(n) { if (!isFinite(n) || n < 0 || n > 999999999999 || Math.round(n) !== n) throw new Error('SRU: ogiltigt heltal ' + n); return String(n); }
  function stamp(d) { var p = function (n) { return (n < 10 ? '0' : '') + n; }; return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + ' ' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()); }

  function validate(who) {
    var e = [], pnr = normPersnr(who.persnr, who.now), pn = normPostnr(who.postnr);
    if (!pnr) e.push('persnr'); if (!str(who.namn)) e.push('namn'); if (!pn) e.push('postnr'); if (!str(who.postort)) e.push('postort');
    return { ok: !e.length, errors: e, persnr: pnr, postnr: pn };
  }

  function info(who) {
    var v = validate(who); if (!v.ok) throw new Error('SRU: saknar/ogiltiga uppgifter: ' + v.errors.join(', '));
    var L = ['#DATABESKRIVNING_START', '#PRODUKT SRU', '#SKAPAD ' + stamp(who.now || new Date()), '#PROGRAM ' + PROGRAM, '#FILNAMN BLANKETTER.SRU', '#DATABESKRIVNING_SLUT',
      '#MEDIELEV_START', '#ORGNR ' + v.persnr, '#NAMN ' + str(who.namn, 250)];
    if (str(who.adress)) L.push('#ADRESS ' + str(who.adress, 250));
    L.push('#POSTNR ' + v.postnr, '#POSTORT ' + str(who.postort, 250));
    if (str(who.email)) L.push('#EMAIL ' + str(who.email, 250));
    L.push('#MEDIELEV_SLUT');
    return L.join(NL) + NL;
  }

  /* k4: result of K4.k4Rows (pages with rows/sums), who: {persnr, namn, ...}, year: income year (e.g. 2026) */
  function blanketter(k4, who) {
    var v = validate(who); if (!v.ok) throw new Error('SRU: saknar/ogiltiga uppgifter: ' + v.errors.join(', '));
    if (!k4.pages.length) throw new Error('SRU: inga försäljningar att redovisa');
    var ts = stamp(who.now || new Date()), multi = k4.pages.length > 1, out = [];
    k4.pages.forEach(function (p) {
      if (p.rows.length > 9) throw new Error('SRU: max 9 rader per K4');
      out.push('#BLANKETT K4-' + k4.year + 'P4', '#IDENTITET ' + v.persnr + ' ' + ts, '#NAMN ' + str(who.namn, 250));
      p.rows.forEach(function (r, i) {
        var b = 3100 + 10 * i;
        out.push('#UPPGIFT ' + b + ' ' + int(r.antal), '#UPPGIFT ' + (b + 1) + ' ' + str(r.beteckning, 80), '#UPPGIFT ' + (b + 2) + ' ' + int(r.pris), '#UPPGIFT ' + (b + 3) + ' ' + int(r.omk));
        if (r.vinst > 0) out.push('#UPPGIFT ' + (b + 4) + ' ' + int(r.vinst));
        if (r.forlust > 0) out.push('#UPPGIFT ' + (b + 5) + ' ' + int(r.forlust));
      });
      out.push('#UPPGIFT 3300 ' + int(p.sums.pris), '#UPPGIFT 3301 ' + int(p.sums.omk), '#UPPGIFT 3304 ' + int(p.sums.vinst), '#UPPGIFT 3305 ' + int(p.sums.forlust));
      if (multi) out.push('#UPPGIFT 7014 ' + int(p.n));
      out.push('#BLANKETTSLUT');
    });
    out.push('#FIL_SLUT');
    return out.join(NL) + NL;
  }

  /* ISO 8859-1 bytes (all characters were restricted to Latin-1 by str()) */
  function latin1(s) { var b = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); b[i] = c < 256 ? c : 63; } return b; }

  return { info: info, blanketter: blanketter, latin1: latin1, normPersnr: normPersnr, normPostnr: normPostnr, validate: validate, str: str, PROGRAM: PROGRAM };
});
