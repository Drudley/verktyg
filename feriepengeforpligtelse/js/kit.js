/* Small UI helpers for the m21 tools – Danish-primary variant (pages with <html lang="da">). Copied into each DK tool's js/kit.js.
   Same API as shared/kit.js; differences: Danish number format (dot thousands, comma decimals), primary language read from <html lang>. */
(function (root) {
  'use strict';
  var K = {};
  K.$ = function (s, r) { return (r || document).querySelector(s); };
  K.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  K.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* Danish number format: dot thousands, comma decimals, real minus sign */
  K.fmt = function (n, dec) {
    if (n == null || !isFinite(n)) return '–';
    dec = dec || 0;
    var neg = n < 0, a = Math.abs(n), s = dec ? a.toFixed(dec) : String(Math.round(a));
    var p = s.split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg && +s !== 0 ? '−' : '') + i + (p[1] ? ',' + p[1] : '');
  };
  K.download = function (data, name, type) {
    var blob = new Blob([data], { type: type || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  var NAMES = { da: 'Dansk', sv: 'Svenska', en: 'English' };
  /* i18n: primary texts are read from the page (data-i18n), EN from the dict. Returns setLang(l). */
  K.i18n = function (EN, onChange) {
    var P = {}, PL = (typeof document !== 'undefined' && document.documentElement.lang || 'da').slice(0, 2);
    K.$$('[data-i18n]').forEach(function (el) { P[el.dataset.i18n] = el.innerHTML; });
    return function (l) {
      var D = l === 'en' ? EN : P;
      document.documentElement.lang = l === 'en' ? 'en' : PL;
      K.$$('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n] != null) el.innerHTML = D[el.dataset.i18n]; });
      K.$$('[data-i18n-ph]').forEach(function (el) { var k = el.dataset.i18nPh; if (!el.dataset.pPh) el.dataset.pPh = el.placeholder; el.placeholder = l === 'en' && EN[k] ? EN[k] : el.dataset.pPh; });
      var b = K.$('#lang'); if (b) b.textContent = l === 'en' ? NAMES[PL] || PL : 'English';
      if (onChange) onChange(l);
    };
  };
  K.store = {
    get: function (k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  root.KIT = K;
})(typeof self !== 'undefined' ? self : this);
