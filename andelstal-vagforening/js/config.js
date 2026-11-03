/* ===== Konfiguration — gratis verktyg (free feeder page, no paywall, no Gumroad product) =====
 * FREE_TOOL           true = always free; no paywall.js is loaded and no launch note is shown (a permanent "Gratis" note instead).
 * PAYWALL_ENABLED     must stay false (build.py reads it). The other fields exist only because build.py's cfg_of() expects them.
 * ALLOW_DEV_QUERY     false on the public site.
 * PAID_TOOL_URL       the paid Debiteringslängd tool this page feeds (relative, same site).
 */
window.APP_CONFIG = {
  FREE_TOOL: true,
  PAYWALL_ENABLED: false,
  ALLOW_DEV_QUERY: false,
  PRICE_LABEL: 'Gratis',
  GUMROAD_PRODUCT_URL: '',
  GUMROAD_PRODUCT_ID: '',
  PAID_TOOL_URL: '../debiteringslangd-samfallighet/',
  STORAGE_KEY: 'andelstal_v1'
};
