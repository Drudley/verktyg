/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: Excel-exporten (.xlsx).
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.SIE_CONFIG = {
  PAYWALL_ENABLED: false,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '99 kr',
  GUMROAD_PRODUCT_URL: '',
  GUMROAD_PRODUCT_ID: '',
  STORAGE_KEY: 'sie2xlsx_unlock_v1'
};
window.SIE_PAYWALL = window.PAYWALL.create(window.SIE_CONFIG);
