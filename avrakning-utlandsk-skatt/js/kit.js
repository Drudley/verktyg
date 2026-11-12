/* Small UI helpers for the m21 tools (copied into each tool's js/). No dependencies, no network. */
(function (root) {
  'use strict';
  var K = {};
  K.$ = function (s, r) { return (r || document).querySelector(s); };
  K.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  K.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  /* Swedish number format: non-breaking space thousands, comma decimals, real minus sign */
  K.fmt = function (n, dec) {
    if (n == null || !isFinite(n)) return '–';
    dec = dec || 0;
    var neg = n < 0, a = Math.abs(n), s = dec ? a.toFixed(dec) : String(Math.round(a));
    var p = s.split('.'), i = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return (neg && +s !== 0 ? '−' : '') + i + (p[1] ? ',' + p[1] : '');
  };
  /* download bytes (Uint8Array or string) as a file */
  K.download = function (data, name, type) {
    var blob = new Blob([data], { type: type || 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  };
  /* i18n: SV texts are read from the page (data-i18n), EN from the dict. Returns setLang(l). */
  K.i18n = function (EN, onChange) {
    var SV = {};
    K.$$('[data-i18n]').forEach(function (el) { SV[el.dataset.i18n] = el.innerHTML; });
    return function (l) {
      var D = l === 'en' ? EN : SV;
      document.documentElement.lang = l === 'en' ? 'en' : 'sv';
      K.$$('[data-i18n]').forEach(function (el) { if (D[el.dataset.i18n] != null) el.innerHTML = D[el.dataset.i18n]; });
      K.$$('[data-i18n-ph]').forEach(function (el) { var k = el.dataset.i18nPh; if (!el.dataset.svPh) el.dataset.svPh = el.placeholder; el.placeholder = l === 'en' && EN[k] ? EN[k] : el.dataset.svPh; });
      var b = K.$('#lang'); if (b) b.textContent = l === 'en' ? 'Svenska' : 'English';
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
