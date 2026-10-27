/* Shared paywall: Gumroad buy link + licence-key unlock, all in the browser.
 *
 * Config (per tool, in js/config.js, object passed to PAYWALL.create):
 *   PAYWALL_ENABLED      false = the paid feature is free for everyone (launch mode, shows a "free during launch" note)
 *   ALLOW_DEV_QUERY      true only while developing: ?dev=1 / localhost unlock. MUST be false on the public site.
 *   PRICE_LABEL          e.g. '99 kr' (display only; the real price is whatever the Gumroad product costs)
 *   GUMROAD_PRODUCT_URL  e.g. 'https://<user>.gumroad.com/l/<permalink>' – the "Köp" button is a plain link (no Gumroad script loaded)
 *   GUMROAD_PRODUCT_ID   the product_id shown on the Gumroad product page (Content → licence key module). Needed for verification.
 *   STORAGE_KEY          localStorage key for the unlock
 *
 * Licence check: POST https://api.gumroad.com/v2/licenses/verify (product_id, license_key, increment_uses_count=false).
 * That endpoint answers CORS requests with Access-Control-Allow-Origin: *, so no server/proxy is needed.
 * The page CSP must allow it: connect-src 'self' https://api.gumroad.com
 * Honest limitation: a static site cannot stop someone from editing localStorage; the check stops casual sharing only.
 */
(function (root) {
  'use strict';
  var VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
  var TXT = {
    sv: { buy: 'Köp på Gumroad', have: 'Har du redan köpt? Klistra in licensnyckeln från kvittot:', key: 'Licensnyckel', activate: 'Aktivera', close: 'Stäng',
      checking: 'Kontrollerar nyckeln…', ok: 'Klart! Funktionen är upplåst på den här enheten.', bad: 'Nyckeln hittades inte för den här produkten. Kontrollera att du kopierat hela nyckeln.',
      refunded: 'Köpet är återbetalt eller bestridet – nyckeln gäller inte längre.', net: 'Kunde inte nå Gumroad. Kontrollera internetanslutningen och försök igen.',
      empty: 'Klistra in din licensnyckel.', off: 'Betalning är inte aktiverad ännu.', launch: 'Gratis under lanseringen.', how: 'Efter köpet får du en licensnyckel på kvittot och i e-posten från Gumroad. Betalningen hanteras av Gumroad; filerna lämnar aldrig din webbläsare.' },
    en: { buy: 'Buy on Gumroad', have: 'Already bought? Paste the licence key from your receipt:', key: 'Licence key', activate: 'Activate', close: 'Close',
      checking: 'Checking the key…', ok: 'Done! The feature is unlocked on this device.', bad: 'Key not found for this product. Make sure you copied the whole key.',
      refunded: 'The purchase was refunded or disputed – the key is no longer valid.', net: 'Could not reach Gumroad. Check your connection and try again.',
      empty: 'Paste your licence key.', off: 'Payment is not enabled yet.', launch: 'Free during launch.', how: 'After buying you get a licence key on the receipt and by email from Gumroad. Payment is handled by Gumroad; your files never leave your browser.' }
  };
  function lang() { return (document.documentElement.lang || 'sv').slice(0, 2) === 'en' ? 'en' : 'sv'; }
  function t(k) { return TXT[lang()][k]; }

  function create(cfg) {
    var pw = {
      cfg: cfg,
      isDevMode: function () {
        if (!cfg.ALLOW_DEV_QUERY) return false;          // public site: dev mode can never trigger
        if (/[?&]dev=0\b/.test(location.search)) return false;
        var h = location.hostname;
        return /[?&]dev=1\b/.test(location.search) || h === 'localhost' || h === '127.0.0.1';
      },
      isConfigured: function () { return !!(cfg.GUMROAD_PRODUCT_ID && cfg.GUMROAD_PRODUCT_URL); },
      isUnlocked: function () {
        if (!cfg.PAYWALL_ENABLED || pw.isDevMode()) return true;
        try { var v = JSON.parse(localStorage.getItem(cfg.STORAGE_KEY) || 'null'); return !!(v && v.product === cfg.GUMROAD_PRODUCT_ID && v.key); } catch (e) { return false; }
      },
      /* resolves {ok:boolean, code:'ok'|'bad'|'refunded'|'net'|'empty'|'off'} */
      verify: function (key) {
        key = String(key || '').trim();
        if (!key) return Promise.resolve({ ok: false, code: 'empty' });
        if (!cfg.GUMROAD_PRODUCT_ID) return Promise.resolve({ ok: false, code: 'off' });
        var body = 'product_id=' + encodeURIComponent(cfg.GUMROAD_PRODUCT_ID) + '&license_key=' + encodeURIComponent(key) + '&increment_uses_count=false';
        return fetch(VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'omit', referrerPolicy: 'no-referrer' })
          .then(function (r) { return r.json().catch(function () { return { success: false }; }); }, function () { return null; })
          .then(function (j) {
            if (!j) return { ok: false, code: 'net' };
            if (!j.success) return { ok: false, code: 'bad' };
            var p = j.purchase || {};
            if (p.refunded || p.chargebacked || p.disputed || p.subscription_cancelled_at || p.subscription_failed_at) return { ok: false, code: 'refunded' };
            try { localStorage.setItem(cfg.STORAGE_KEY, JSON.stringify({ product: cfg.GUMROAD_PRODUCT_ID, key: key, at: new Date().toISOString() })); } catch (e) {}
            return { ok: true, code: 'ok' };
          });
      },
      lock: function () { try { localStorage.removeItem(cfg.STORAGE_KEY); } catch (e) {} },
      /* back-compat with the old stub API */
      unlock: function () { return Promise.resolve(pw.isUnlocked()); }
    };
    return pw;
  }

  /* Fill <dialog id="paywall"> (which already has h2 + p[data-i18n="pw-p"]) with buy link + key form.
     opts: {onUnlocked(), launchAfter: element after which the "free during launch" note goes} */
  function mount(dlg, pw, opts) {
    var cfg = pw.cfg, box = dlg.querySelector('.pw-body') || document.createElement('div');
    box.className = 'pw-body'; if (!box.parentNode) dlg.appendChild(box);
    function render() {
      var url = /^https:\/\/[\w.-]*gumroad\.com\//.test(cfg.GUMROAD_PRODUCT_URL || '') ? cfg.GUMROAD_PRODUCT_URL : '';
      box.innerHTML = '';
      var el = function (tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
      if (!pw.isConfigured()) {
        box.appendChild(el('p', 'muted small pw-msg', t('off')));
      } else {
        var buy = el('a', 'btn pw-buy', t('buy') + ' – ' + cfg.PRICE_LABEL); buy.href = url; buy.target = '_blank'; buy.rel = 'noopener noreferrer'; buy.id = 'pw-buy-link';
        var r1 = el('div', 'row'); r1.appendChild(buy); box.appendChild(r1);
        box.appendChild(el('p', 'muted small', t('how')));
        var lab = el('label', 'small', t('have')); lab.setAttribute('for', 'pw-key'); box.appendChild(lab);
        var r2 = el('div', 'row pw-keyrow'), inp = el('input'); inp.id = 'pw-key'; inp.type = 'text'; inp.autocomplete = 'off'; inp.spellcheck = false; inp.placeholder = 'XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX'; inp.setAttribute('aria-label', t('key'));
        var act = el('button', 'btn ghost', t('activate')); act.type = 'button'; act.id = 'pw-activate';
        r2.appendChild(inp); r2.appendChild(act); box.appendChild(r2);
        var msg = el('p', 'small pw-msg'); msg.id = 'pw-msg'; msg.setAttribute('role', 'status'); box.appendChild(msg);
        act.addEventListener('click', function () {
          act.disabled = true; msg.className = 'small pw-msg'; msg.textContent = t('checking');
          pw.verify(inp.value).then(function (r) {
            act.disabled = false; msg.textContent = t(r.code); msg.className = 'small pw-msg ' + (r.ok ? 'ok' : 'err');
            if (r.ok) setTimeout(function () { dlg.close(); if (opts.onUnlocked) opts.onUnlocked(); }, 700);
          });
        });
      }
      var r3 = el('div', 'row end'), cl = el('button', 'btn ghost', t('close')); cl.type = 'button'; cl.id = 'pw-close';
      cl.addEventListener('click', function () { dlg.close(); }); r3.appendChild(cl); box.appendChild(r3);
    }
    render();
    var show = dlg.showModal.bind(dlg);
    dlg.showModal = function () { render(); show(); };
    if (!cfg.PAYWALL_ENABLED && opts.launchAfter && !document.getElementById('launch-note')) {
      var n = document.createElement('p'); n.id = 'launch-note'; n.className = 'muted small launch-note'; n.textContent = '🎉 ' + t('launch');
      opts.launchAfter.parentNode.insertBefore(n, opts.launchAfter.nextSibling);
      new MutationObserver(function () { n.textContent = '🎉 ' + t('launch'); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
  }
  root.PAYWALL = { create: create, mount: mount, VERIFY_URL: VERIFY_URL };
})(typeof self !== 'undefined' ? self : this);
