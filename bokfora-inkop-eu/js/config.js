/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: kontering per faktura, SIE-fil, Excel-underlag (rutor, fakturor, kontering) och utskrift.
 *   Momsdeklarationens rutor och uträkningen per faktura är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 * Real Gumroad product (created 2026-11-12): drudley.gumroad.com/l/inkoputland, 79 kr, licence keys on
 *   (editor tjyuuc, product id 0VJGl3BBPKHErH9FqHFTaQ==).
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '79 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/inkoputland',
  GUMROAD_PRODUCT_ID: '0VJGl3BBPKHErH9FqHFTaQ==',
  STORAGE_KEY: 'inkoputland_unlock_v1',
  SAVE_KEY: 'inkoputland_inputs_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
