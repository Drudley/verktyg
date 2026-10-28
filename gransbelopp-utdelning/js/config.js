/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: "Lön eller utdelning" – optimering av lön/utdelning 2026 (gränsbeloppsberäkningen och skatten på utdelning är alltid gratis).
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '79 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/acmta',
  GUMROAD_PRODUCT_ID: '7hvZqV-0fau2s9nwds4JHg==',
  STORAGE_KEY: 'k10_312_unlock_v1',
  SETTINGS_KEY: 'k10_312_inputs_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
