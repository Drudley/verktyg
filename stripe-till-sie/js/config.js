/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: nedladdningen av SIE-filen.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '199 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/qmhwbf',
  GUMROAD_PRODUCT_ID: 'u2-DFHMGUrMmcrK-u2FB8w==',
  STORAGE_KEY: 'stripe2sie_unlock_v1',
  SETTINGS_KEY: 'stripe2sie_settings_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
