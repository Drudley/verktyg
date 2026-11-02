/* ===== Betalväggs-konfiguration (paywall config) — logic lives in js/paywall.js (copied from shared/) =====
 * Paid feature: utskriftsklar debiteringslängd (42 § SFL), avier med OCR + Swish-QR, avprickning/restlista (localStorage),
 *   Excel-fil och register sparat/kopierat till nästa år. Inläsning, fördelning och förhandsvisning är alltid gratis.
 * PAYWALL_ENABLED     false = free for everyone (launch mode; a "Gratis under lanseringen" note is shown).
 *                     Set to true only after GUMROAD_PRODUCT_URL and GUMROAD_PRODUCT_ID are filled in with the REAL product.
 * ALLOW_DEV_QUERY     false on the public site (?dev=1 / localhost unlock is disabled). Only set true locally while developing.
 * GUMROAD_PRODUCT_URL https://<user>.gumroad.com/l/<permalink> — the buy button is a plain link (no Gumroad script).
 * GUMROAD_PRODUCT_ID  product_id from the Gumroad product (licence keys enabled) — used by the licence verify API.
 */
window.APP_CONFIG = {
  PAYWALL_ENABLED: true,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: '149 kr',
  GUMROAD_PRODUCT_URL: 'https://drudley.gumroad.com/l/debiteringslangd',
  GUMROAD_PRODUCT_ID: 'p5sgs2Z8pIz7BbzuRrtVPg==',
  STORAGE_KEY: 'debl_unlock_v1',
  REGISTER_KEY: 'debl_register_v1'
};
window.APP_PAYWALL = window.PAYWALL.create(window.APP_CONFIG);
