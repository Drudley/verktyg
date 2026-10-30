/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: K4-rader (avsnitt A), SRU-filer (INFO.SRU + BLANKETTER.SRU) och granskningsfil (.xlsx).
 *   Förhandsvisningen (summor och vinst/förlust per värdepapper) är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script). Product created 2026-10-30, 149 kr.
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '149 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/rnjrl',
  GUMROAD_PRODUCT_ID: 'cYV1femhTFVE1fZJuRGngQ==',
  STORAGE_KEY: 'k4_revolut_unlock_v1',
  SETTINGS_KEY: 'k4_revolut_settings_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
