/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: Excel-arbetsbok (sammanställning i blankettordning + specifikation per kategori + övriga utgifter + alla transaktioner),
 *   utskriftsvy och egna sparade nyckelordsregler (webbläsaren / JSON-fil). Inläsning, kategorisering och summor på skärmen är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '129 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/arsrakning',
  GUMROAD_PRODUCT_ID: 'oAI802lLIL403_5I0KhqOw==',
  STORAGE_KEY: 'arsrakning_unlock_v1',
  SETTINGS_KEY: 'arsrakning_settings_v1',
  RULES_KEY: 'arsrakning_rules_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
