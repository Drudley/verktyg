/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: kontering, SIE-fil (en verifikation per tillfälle), Excel-underlag och utskrivbart representationsunderlag.
 *   Avdragsgill moms och kostnad per tillfälle och totalerna är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 * Real Gumroad product (created 2026-11-12): drudley.gumroad.com/l/representation, 79 kr, licence keys on
 *   (editor qysxd, product id LY6xlRPHxY_lKwRmDkcqIw==).
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '79 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/representation',
  GUMROAD_PRODUCT_ID: 'LY6xlRPHxY_lKwRmDkcqIw==',
  STORAGE_KEY: 'representation_unlock_v1',
  SAVE_KEY: 'representation_inputs_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
