/* 3:12 / K10 calculations for income year 2026 (inkomstår 2026, deklaration 2027) – new rules (prop. 2025/26:1 avsnitt 13.8, SFS 2025:1361).
 * Pure functions, no DOM. All amounts in whole kronor. Sources (see README):
 *  - Skatteverket "Ändrade regler för delägare i fåmansföretag inför inkomstdeklarationen 2027"
 *  - Skatteverket "Belopp och procentsatser (blankett K10)"
 *  - Skatteverket "Räkna ut skatten på din utdelning" (20 % inom gränsbelopp, tjänst över, takbelopp 90 IBB, 30 % över tak)
 *  - Skatteverket SKV 433 utgåva 36 (2026): grundavdrag, jobbskatteavdrag, statlig skatt, pensionsavgift, public service-avgift
 *  - Skatteverket "Belopp och procentsatser för inkomståret 2026" (arbetsgivaravgifter, PBB, IBB, SLR)
 */
(function (root) {
  'use strict';
  var Y = {
    year: 2026,
    IBB_PREV: 80600,          // inkomstbasbelopp 2025 – used for grundbelopp and the 8 IBB salary deduction for inkomstår 2026
    IBB: 83400,               // inkomstbasbelopp 2026 – takbelopp (90 IBB), pension fee cap, public service fee
    PBB: 59200,               // prisbasbelopp 2026 – grundavdrag, jobbskatteavdrag
    GRUND_IBB: 4, LON_AVDRAG_IBB: 8, LON_ANDEL: 0.5, LON_CAP_X: 50,
    SLR: 0.0255, RANTA_TILLAGG: 0.09, OMK_FRIBELOPP: 100000,
    KAP_SKATT: 0.30, KVOT: 2 / 3, TAK_IBB: 90,
    SKIKT: 643000, STATLIG: 0.20,
    AG_FULL: 0.3142, AG_1938_1958: 0.1021,
    BOLAGSSKATT: 0.206,
    KOMMUNAL_SNITT: 0.3238,   // genomsnittlig kommunal- + regionskatt 2026 (SCB) – default only
    BEGRAVNING: 0.00292,      // begravningsavgift 2026 utanför Stockholm/Tranås – default only
    PENS_AVG: 0.07, PENS_CAP_IBB: 8.07, PENS_MIN_PBB: 0.423,
    PS_RATE: 0.01, PS_CAP_IBB: 1.42,
    NEXT: { year: 2027, IBB_PREV: 83400 }   // inkomstår 2027 uses IBB 2026: grundbelopp 333 600, löneavdrag 667 200
  };
  Y.GRUNDBELOPP = Y.GRUND_IBB * Y.IBB_PREV;                 // 322 400
  Y.LON_AVDRAG = Y.LON_AVDRAG_IBB * Y.IBB_PREV;             // 644 800
  Y.RANTA = Math.round((Y.SLR + Y.RANTA_TILLAGG) * 10000) / 10000; // 0.1155
  Y.TAKBELOPP = Y.TAK_IBB * Y.IBB;                          // 7 506 000
  Y.NEXT.GRUNDBELOPP = Y.GRUND_IBB * Y.NEXT.IBB_PREV;       // 333 600
  Y.NEXT.LON_AVDRAG = Y.LON_AVDRAG_IBB * Y.NEXT.IBB_PREV;   // 667 200

  function num(v) { var n = typeof v === 'number' ? v : parseFloat(String(v == null ? '' : v).replace(/\s|\u00a0/g, '').replace(',', '.')); return isFinite(n) ? n : 0; }
  function pos(v) { return Math.max(0, num(v)); }
  function pct(v) { return Math.min(100, pos(v)) / 100; }
  var floor100 = function (x) { return Math.floor(x / 100) * 100; }, ceil100 = function (x) { return Math.ceil(Math.round(x * 100) / 100 / 100) * 100; };

  /* ---------- gränsbelopp ---------- */
  /* in: {ownedAtStart, share%, otherShares% (sum of your % in other fåmansföretag), wages (löneunderlag året före),
          ownSalary (högsta kontanta lön året före till dig eller närstående), spouse:bool, spouseShare%, cost (omkostnadsbelopp), saved (sparat utdelningsutrymme)} */
  function gransbelopp(i, Yr) {
    Yr = Yr || Y;
    var share = pct(i.share), other = pos(i.otherShares) / 100, owned = i.ownedAtStart !== false;
    var r = { share: share, owned: owned, notes: [] };
    var saved = Math.round(pos(i.saved));
    if (!owned) {
      r.grund = r.lbu = r.lbuRaw = r.ranta = 0; r.saved = saved; r.arets = 0; r.total = saved;
      r.notes.push('not-owned'); return r;
    }
    // grundbelopp: 4 IBB spread over all shares; max one grundbelopp per person across all fåmansföretag (57:11 a)
    var tot = share + other;
    r.grundFull = Math.round(Yr.GRUNDBELOPP * share);
    r.grund = tot > 1 ? Math.round(Yr.GRUNDBELOPP * share / tot) : r.grundFull;
    if (tot > 1) r.notes.push('grund-capped');
    // lönebaserat utrymme: (löneunderlag × andel − 8 IBB) × 50 %, spouses compute jointly and split by shares; cap 50 × own/närstående salary
    var wages = pos(i.wages), sp = i.spouse ? pct(i.spouseShare) : 0, joint = share + sp;
    var base = Math.max(0, wages * joint - Yr.LON_AVDRAG) * Yr.LON_ANDEL;
    r.lbuRaw = Math.round(joint > 0 ? base * share / joint : 0);
    r.lbuCap = Math.round(Yr.LON_CAP_X * pos(i.ownSalary));
    r.lbu = Math.min(r.lbuRaw, r.lbuCap);
    if (r.lbuRaw > r.lbuCap) r.notes.push('lbu-capped');
    if (wages > 0 && wages * joint <= Yr.LON_AVDRAG) r.notes.push('lbu-below-deduction');
    if (wages > 0 && pos(i.ownSalary) === 0) r.notes.push('lbu-no-own-salary');
    r.wageShare = Math.round(wages * joint);
    // ränta på omkostnadsbelopp över 100 000 kr
    r.cost = pos(i.cost); r.rantaBase = Math.max(0, r.cost - Yr.OMK_FRIBELOPP);
    r.ranta = Math.round(r.rantaBase * Yr.RANTA);
    r.saved = saved;
    r.arets = r.grund + r.lbu + r.ranta;
    r.total = r.arets + r.saved;
    return r;
  }

  /* ---------- personal income tax on förvärvsinkomst (SKV 433, 2026) ---------- */
  function grundavdrag(ffi, age66, Yr) {
    Yr = Yr || Y; var P = Yr.PBB, g;
    if (ffi <= 0.99 * P) g = 0.423 * P;
    else if (ffi <= 2.72 * P) g = 0.423 * P + (ffi - 0.99 * P) * 0.20;
    else if (ffi <= 3.11 * P) g = 0.77 * P;
    else if (ffi <= 7.88 * P) g = 0.77 * P - (ffi - 3.11 * P) * 0.10;
    else g = 0.293 * P;
    if (age66) g += forhojt(ffi, P);
    return Math.min(ceil100(g), Math.max(0, ffi));
  }
  function forhojt(f, P) {
    if (f <= 0.91 * P) return 0.687 * P;
    if (f <= 1.11 * P) return 0.885 * P - f * 0.2;
    if (f <= 1.965 * P) return 0.600 * P + f * 0.057;
    if (f <= 2.72 * P) return 0.333 * P + f * 0.1949;
    if (f <= 3.11 * P) return f * 0.3949 - 0.212 * P;
    if (f <= 3.24 * P) return f * 0.4949 - 0.523 * P;
    if (f <= 5.00 * P) return f * 0.356 - 0.073 * P;
    if (f <= 7.88 * P) return 0.017 * P + f * 0.338;
    if (f <= 8.08 * P) return 0.703 * P + f * 0.251;
    if (f <= 11.16 * P) return 2.732 * P;
    if (f <= 12.84 * P) return 9.651 * P - f * 0.62;
    return 1.691 * P;
  }
  /* skattereduktion för arbetsinkomst; ki = kommunal skattesats (decimal, excl. begravnings-/kyrkoavgift) */
  function jobbskatteavdrag(ai, ga, ki, age66, Yr) {
    Yr = Yr || Y; var P = Yr.PBB, r; ai = floor100(Math.max(0, ai));
    if (ai <= 0) return 0;
    if (age66) {
      if (ai <= 1.75 * P) r = ai * 0.22; else if (ai <= 5.24 * P) r = 0.2635 * P + ai * 0.07; else r = 0.6293 * P;
      return Math.max(0, Math.floor(r));
    }
    if (ai <= 0.91 * P) r = ai - ga;
    else if (ai <= 3.24 * P) r = 0.91 * P + 0.3874 * (ai - 0.91 * P) - ga;
    else if (ai <= 8.08 * P) r = 1.813 * P + 0.251 * (ai - 3.24 * P) - ga;
    else r = 3.027 * P - ga;
    return Math.max(0, Math.floor(r * ki));
  }
  /* full annual tax on förvärvsinkomst. p: {ffi, ai (arbetsinkomst, pensionsgrundande), kommunal (decimal), avgift (begravning+kyrka, decimal), birthYear} */
  function personTax(p, Yr) {
    Yr = Yr || Y;
    var by = p.birthYear || 1985, age66 = by <= Yr.year - 67; // fyllt 66 vid årets ingång ⇔ född senast (år − 67), t.ex. 1959 för 2026
    var ffi = floor100(Math.max(0, p.ffi)), ai = Math.min(ffi, Math.max(0, p.ai == null ? ffi : p.ai));
    var ga = grundavdrag(ffi, age66, Yr), bfi = Math.max(0, ffi - ga), ki = p.kommunal == null ? Yr.KOMMUNAL_SNITT : p.kommunal, av = p.avgift == null ? 0 : p.avgift;
    var o = { ffi: ffi, ai: ai, age66: age66, ga: ga, bfi: bfi };
    o.kommunal = Math.floor(bfi * ki); o.avgifter = Math.floor(bfi * av);
    o.statlig = Math.floor(Math.max(0, bfi - Yr.SKIKT) * Yr.STATLIG);
    o.ps = Math.floor(Math.min(bfi, Yr.PS_CAP_IBB * Yr.IBB) * Yr.PS_RATE);
    // allmän pensionsavgift 7 % (born 1938+) on pensionsgrundande inkomst, rounded to 100 (50 → down); fully offset by skattereduktion as far as tax allows
    var pf = 0; if (by >= 1938 && ai >= Yr.PENS_MIN_PBB * Yr.PBB) { var x = Math.min(ai, Yr.PENS_CAP_IBB * Yr.IBB) * Yr.PENS_AVG; pf = Math.floor(x / 100) * 100 + (x % 100 > 50 ? 100 : 0); }
    o.pensionsavgift = pf;
    var room = o.kommunal + o.statlig;                // order: pensionsavgift (kommunal + statlig) → arbetsinkomst → förvärvsinkomst (kommunal only)
    o.redPension = Math.min(pf, room);
    var kLeft = Math.max(0, o.kommunal - o.redPension);
    o.jsa = Math.min(jobbskatteavdrag(ai, ga, ki, age66, Yr), kLeft); kLeft -= o.jsa;
    var fir = bfi <= 40000 ? 0 : bfi <= 240000 ? Math.floor((bfi - 40000) * 0.0075) : 1500;
    o.redForv = Math.min(fir, kLeft);
    o.total = o.kommunal + o.avgifter + o.statlig + o.ps + pf - o.redPension - o.jsa - o.redForv;
    return o;
  }

  /* ---------- tax on a dividend from qualified shares ---------- */
  /* ctx: {otherIncome (förvärvsinkomst 2026 excl. this dividend), otherIsWork (bool, default true), kommunal, avgift, birthYear} */
  function dividendTax(div, gb, ctx, Yr) {
    Yr = Yr || Y; div = Math.round(pos(div)); gb = Math.round(pos(gb)); ctx = ctx || {};
    var o = { dividend: div, gb: gb };
    o.kapital = Math.min(div, gb);
    o.tjanst = Math.min(div - o.kapital, Yr.TAKBELOPP);
    o.overTak = div - o.kapital - o.tjanst;
    o.taxKapital = Math.round(o.kapital * Yr.KVOT * Yr.KAP_SKATT);
    o.taxOverTak = Math.round(o.overTak * Yr.KAP_SKATT);
    var other = pos(ctx.otherIncome), ai = ctx.otherIsWork === false ? 0 : other;
    var base = { kommunal: ctx.kommunal == null ? Yr.KOMMUNAL_SNITT : ctx.kommunal, avgift: ctx.avgift == null ? Yr.BEGRAVNING : ctx.avgift, birthYear: ctx.birthYear };
    if (o.tjanst > 0) {
      var t0 = personTax(Object.assign({ ffi: other, ai: ai }, base), Yr), t1 = personTax(Object.assign({ ffi: other + o.tjanst, ai: ai }, base), Yr);
      o.taxTjanst = t1.total - t0.total; o.tjanstMarginal = o.taxTjanst / o.tjanst;
    } else o.taxTjanst = 0;
    o.total = o.taxKapital + o.taxTjanst + o.taxOverTak;
    o.net = div - o.total;
    o.savedNext = Math.max(0, gb - div);           // sparat utdelningsutrymme till nästa år – ingen uppräkning från 2026
    o.effective = div ? o.total / div : 0;
    return o;
  }

  function agRate(birthYear, Yr) { Yr = Yr || Y; var b = birthYear || 1985; return b >= 1959 ? Yr.AG_FULL : b >= 1938 ? Yr.AG_1938_1958 : 0; }

  /* ---------- lön eller utdelning: one-year split of a pool (paid feature) ----------
   * in: {pool (kr available before your salary, employer fees and corporate tax), gb (your gränsbelopp 2026),
   *      kommunal, avgift, birthYear, otherIncome (non-company income 2026), share (for next-year LBU), otherWages (other cash wages in the company 2026), step}
   * Model: salary S costs S × (1 + arbetsgivaravgift); the rest is taxed 20.6 % in the company and paid out to you as dividend the same year
   * (sole owner of the payout). Returns every grid point and the best one. */
  function optimize(i, Yr) {
    Yr = Yr || Y;
    var pool = pos(i.pool), ag = agRate(i.birthYear, Yr), step = i.step || 1000, gb = pos(i.gb), other = pos(i.otherIncome);
    var ctx = { kommunal: i.kommunal == null ? Yr.KOMMUNAL_SNITT : i.kommunal, avgift: i.avgift == null ? Yr.BEGRAVNING : i.avgift, birthYear: i.birthYear };
    var share = i.share == null ? 1 : pct(i.share), ow = pos(i.otherWages);
    var maxS = Math.floor(pool / (1 + ag) / step) * step, rows = [];
    function at(S) {
      var cost = Math.round(S * (1 + ag)), profit = Math.max(0, pool - cost), ctax = Math.round(profit * Yr.BOLAGSSKATT), div = profit - ctax;
      var pt0 = personTax(Object.assign({ ffi: other, ai: other }, ctx), Yr), pt = personTax(Object.assign({ ffi: other + S, ai: other + S }, ctx), Yr);
      var salTax = pt.total - pt0.total;
      var dt = dividendTax(div, gb, Object.assign({ otherIncome: other + S }, ctx), Yr);
      var net = S - salTax + dt.net;
      var nextLbu = Math.min(Math.max(0, (S + ow) * share - Yr.NEXT.LON_AVDRAG) * Yr.LON_ANDEL, Yr.LON_CAP_X * S);
      return { salary: S, monthly: Math.round(S / 12), employerFee: cost - S, corpTax: ctax, dividend: div, salaryTax: salTax, dividendTax: dt.total, divTjanst: dt.tjanst,
        net: Math.round(net), totalTax: Math.round(pool - net), wedge: pool ? (pool - net) / pool : 0, savedNext: dt.savedNext, nextLbu: Math.round(nextLbu), pgi: Math.min(S, Yr.PENS_CAP_IBB * Yr.IBB) };
    }
    for (var S = 0; S <= maxS; S += step) rows.push(at(S));
    var best = rows.reduce(function (a, b) { return b.net > a.net ? b : a; }, rows[0]);
    // refine around the best point to the krona-hundred
    var lo = Math.max(0, best.salary - step), hi = Math.min(Math.floor(pool / (1 + ag)), best.salary + step);
    for (var s2 = lo; s2 <= hi; s2 += 100) { var r2 = at(s2); if (r2.net > best.net) best = r2; }
    return { rows: rows, best: best, agRate: ag, maxSalary: Math.floor(pool / (1 + ag)), nextGrund: Math.round(Yr.NEXT.GRUNDBELOPP * share), at: at };
  }

  var API = { Y: Y, gransbelopp: gransbelopp, grundavdrag: grundavdrag, jobbskatteavdrag: jobbskatteavdrag, personTax: personTax, dividendTax: dividendTax, optimize: optimize, agRate: agRate, num: num };
  root.K10 = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
