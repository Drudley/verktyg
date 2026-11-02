/* ===== Betalingsmur-konfiguration (paywall config) — logic lives in js/paywall.js (copy of shared/, + Danish texts) =====
 * Paid feature: specifikation pr. udbytte i NOK/EUR/CHF/SEK (til Skatteetaten, BZSt, ESTV formular 89, Vero 6164e/6167e, SKV 3740),
 *   tjekliste pr. land, udskriftsvenligt bilag og Excel-fil. Oversigten pr. land og år (beløb + frist) er altid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanceringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink>
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled)
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '€9',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/udbytteskat',
  GUMROAD_PRODUCT_ID: 'WH7b5d-bkAZiUyXFN97iAA==',
  STORAGE_KEY: 'udbytteskat_unlock_v1',
  SETTINGS_KEY: 'udbytteskat_settings_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
