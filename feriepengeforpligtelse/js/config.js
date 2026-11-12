/* ===== Betalingsmur-konfiguration (paywall config) — logic lives in js/paywall.js (copy of udbytteskat-tilbage, with Danish texts) =====
 * Paid feature: posteringsforslag (CSV), tekst til anvendt regnskabspraksis/skat, Excel-opgørelse pr. medarbejder, udskrift.
 *   Opgørelsen pr. medarbejder, samlet forpligtelse og regulering er altid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanceringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 *
 * LIVE 2026-11-12: real Gumroad product (permalink feriepenge, licence keys on).
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '€9',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/feriepenge',
  GUMROAD_PRODUCT_ID: 'vQFA2WqX5RpWQhaetcXCOA==',
  STORAGE_KEY: 'feriepenge_unlock_v1',
  SAVE_KEY: 'feriepenge_inputs_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
