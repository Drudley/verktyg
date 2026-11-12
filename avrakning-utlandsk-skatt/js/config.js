/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: kontering per utdelning (SIE), text till begäran om avräkning + INK2S-justering, Excel-specifikation, utskrift.
 *   Avräkningsbar skatt per utdelning, spärrbelopp, årets avräkning och sparad skatt är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 *
 * LIVE 2026-11-12: real Gumroad product (permalink avrakning, licence keys on).
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '99 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/avrakning',
  GUMROAD_PRODUCT_ID: 'k6AVC_C98z8RgEk5DSk61Q==',
  STORAGE_KEY: 'avrakning_unlock_v1',
  SAVE_KEY: 'avrakning_inputs_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
