/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: verifikationer, SIE-fil (en verifikation per rad), Excel-underlag och utskrift.
 *   Inläsning, kontering per rad, summering per konto och saldoavstämning är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 * Real Gumroad product (created 2026-11-12): drudley.gumroad.com/l/skattekonto, 99 kr, licence keys on
 *   (editor jrhvvrk, product id OqoKAeUqAmLoRw0MuLzE2g==).
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '99 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/skattekonto',
  GUMROAD_PRODUCT_ID: 'OqoKAeUqAmLoRw0MuLzE2g==',
  STORAGE_KEY: 'skattekonto_unlock_v1',
  SAVE_KEY: 'skattekonto_inputs_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
