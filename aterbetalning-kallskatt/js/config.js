/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: underlag per utdelning i EUR/NOK/DKK/CHF (för Vero 6164r/6167r, Skatteetaten, Skattestyrelsen 06.030, ESTV Form 80),
 *   checklista per land, utskriftsvänlig bilaga och Excel-fil. Sammanställningen per land och år (belopp + sista dag) är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 *                     Real product: kallskatt / editor oabkoa (99 kr, licence keys on), created 2026-10-31.
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '99 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/kallskatt',
  GUMROAD_PRODUCT_ID: 'DXRPCkaEhypP1aYEtF92ow==',
  STORAGE_KEY: 'kallskatt_unlock_v1',
  SETTINGS_KEY: 'kallskatt_settings_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
