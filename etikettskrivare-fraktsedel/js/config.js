/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: att slå ihop många etiketter till en PDF (en etikett åt gången är alltid gratis).
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: false,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '79 kr',
  GUMROAD_PRODUCT_URL: '',
  GUMROAD_PRODUCT_ID: '',
  STORAGE_KEY: 'fraktetikett_unlock_v1',
  SETTINGS_KEY: 'fraktetikett_settings_v1',
  MAX_PAGES_PER_FILE: 40
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
