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
 *
 * BUNDLE ("Verktyg för byråer", yearly Gumroad membership): every tool also accepts a key for the bundle product.
 *   THE ONE PLACE for the bundle product id is BUNDLE.PRODUCT_ID below (shared/paywall.js → shared/sync.sh copies it into
 *   every tool; site/build.py refuses to build if a tool's copy differs and shows the byrå links only when it is set).
 *   Empty PRODUCT_ID = the bundle path is skipped entirely (single-tool behaviour exactly as before).
 *   Order: the tool's own product first, then the bundle. A bundle unlock is stored once under BUNDLE.STORAGE_KEY
 *   (same origin → it opens every tool in that browser). It is re-verified about every 30 days (increment_uses_count=false):
 *   locked again when the key no longer verifies, the purchase is refunded/charged back/disputed, or
 *   subscription_cancelled_at / subscription_ended_at / subscription_failed_at is set to a time in the past.
 *   Network errors keep it unlocked (checked again on the next page load). Single-tool unlocks are never re-checked.
 *   A tool can opt out with NO_BUNDLE: true in its config (not used by any tool).
 */
(function (root) {
  'use strict';
  var VERIFY_URL = 'https://api.gumroad.com/v2/licenses/verify';
  var BUNDLE = {
    PRODUCT_ID: 'TVm-AvF8S2MnI-Fkahp2ug==',            // ← Gumroad product_id of "Verktyg för byråer" (permalink byra)
    URL: 'https://drudley.gumroad.com/l/byra',
    STORAGE_KEY: 'verktyg_bundle_v1',
    RECHECK_MS: 30 * 24 * 60 * 60 * 1000
  };
  var TXT = {
    sv: { buy: 'Köp på Gumroad', have: 'Har du redan köpt? Klistra in licensnyckeln från kvittot:', key: 'Licensnyckel', activate: 'Aktivera', close: 'Stäng',
      checking: 'Kontrollerar nyckeln…', ok: 'Klart! Funktionen är upplåst på den här enheten.', bad: 'Nyckeln hittades inte för den här produkten. Kontrollera att du kopierat hela nyckeln.',
      refunded: 'Köpet är återbetalt eller bestridet – nyckeln gäller inte längre.', net: 'Kunde inte nå Gumroad. Kontrollera internetanslutningen och försök igen.',
      empty: 'Klistra in din licensnyckel.', off: 'Betalning är inte aktiverad ännu.', launch: 'Gratis under lanseringen.', how: 'Efter köpet får du en licensnyckel på kvittot och i e-posten från Gumroad. Betalningen hanteras av Gumroad; filerna lämnar aldrig din webbläsare.' },
    da: { buy: 'Køb på Gumroad', have: 'Har du allerede købt? Indsæt licensnøglen fra kvitteringen:', key: 'Licensnøgle', activate: 'Aktivér', close: 'Luk',
      checking: 'Kontrollerer nøglen…', ok: 'Færdig! Funktionen er låst op på denne enhed.', bad: 'Nøglen blev ikke fundet for dette produkt. Kontrollér, at du har kopieret hele nøglen.',
      refunded: 'Købet er refunderet eller bestridt – nøglen gælder ikke længere.', net: 'Kunne ikke kontakte Gumroad. Kontrollér internetforbindelsen, og prøv igen.',
      empty: 'Indsæt din licensnøgle.', off: 'Betaling er ikke aktiveret endnu.', launch: 'Gratis under lanceringen.', how: 'Efter købet får du en licensnøgle på kvitteringen og i e-mailen fra Gumroad. Betalingen håndteres af Gumroad; dine filer forlader aldrig din browser.' },
    en: { buy: 'Buy on Gumroad', have: 'Already bought? Paste the licence key from your receipt:', key: 'Licence key', activate: 'Activate', close: 'Close',
      checking: 'Checking the key…', ok: 'Done! The feature is unlocked on this device.', bad: 'Key not found for this product. Make sure you copied the whole key.',
      refunded: 'The purchase was refunded or disputed – the key is no longer valid.', net: 'Could not reach Gumroad. Check your connection and try again.',
      empty: 'Paste your licence key.', off: 'Payment is not enabled yet.', launch: 'Free during launch.', how: 'After buying you get a licence key on the receipt and by email from Gumroad. Payment is handled by Gumroad; your files never leave your browser.' }
  };
  /* 'da' added for Udbytteskat tilbage (backward compatible: sv pages behave exactly as before) */
  function lang() { var l = (document.documentElement.lang || 'sv').slice(0, 2); return l === 'en' ? 'en' : l === 'da' ? 'da' : 'sv'; }
  function t(k) { return TXT[lang()][k]; }

  function create(cfg, env) {
    env = env || {};
    var store = env.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    var doFetch = env.fetch || (typeof fetch !== 'undefined' ? fetch.bind(root) : null);
    var now = env.now || function () { return Date.now(); };
    var bundleId = cfg.NO_BUNDLE ? '' : (cfg.BUNDLE_PRODUCT_ID != null ? cfg.BUNDLE_PRODUCT_ID : BUNDLE.PRODUCT_ID);
    function get(k) { try { return JSON.parse(store.getItem(k) || 'null'); } catch (e) { return null; } }
    function set(k, v) { try { store.setItem(k, JSON.stringify(v)); } catch (e) {} }
    function del(k) { try { store.removeItem(k); } catch (e) {} }
    /* POST to Gumroad; resolves the JSON, {success:false} on a non-JSON answer, or null on a network error */
    function post(productId, key) {
      var body = 'product_id=' + encodeURIComponent(productId) + '&license_key=' + encodeURIComponent(key) + '&increment_uses_count=false';
      return doFetch(VERIFY_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body, credentials: 'omit', referrerPolicy: 'no-referrer' })
        .then(function (r) { return r.json().catch(function () { return { success: false }; }); }, function () { return null; });
    }
    function past(v) { if (!v) return false; var t = Date.parse(v); return isNaN(t) || t <= now(); }
    /* bundle membership: 'ok' | 'bad' | 'refunded' | 'net' */
    function judgeBundle(j) {
      if (!j) return 'net';
      if (!j.success) return 'bad';
      var p = j.purchase || {};
      if (p.refunded || p.chargebacked || p.disputed || past(p.subscription_cancelled_at) || past(p.subscription_ended_at) || past(p.subscription_failed_at)) return 'refunded';
      return 'ok';
    }
    function bundleEntry() { var v = bundleId ? get(BUNDLE.STORAGE_KEY) : null; return v && v.product === bundleId && v.key ? v : null; }
    var pw = {
      cfg: cfg,
      bundleId: bundleId,
      isDevMode: function () {
        if (!cfg.ALLOW_DEV_QUERY) return false;          // public site: dev mode can never trigger
        if (/[?&]dev=0\b/.test(location.search)) return false;
        var h = location.hostname;
        return /[?&]dev=1\b/.test(location.search) || h === 'localhost' || h === '127.0.0.1';
      },
      isConfigured: function () { return !!(cfg.GUMROAD_PRODUCT_ID && cfg.GUMROAD_PRODUCT_URL); },
      ownUnlocked: function () { var v = get(cfg.STORAGE_KEY); return !!(v && v.product === cfg.GUMROAD_PRODUCT_ID && v.key); },
      bundleUnlocked: function () { return !!bundleEntry(); },
      isUnlocked: function () {
        if (!cfg.PAYWALL_ENABLED || pw.isDevMode()) return true;
        return pw.ownUnlocked() || pw.bundleUnlocked();
      },
      /* resolves {ok:boolean, code:'ok'|'bad'|'refunded'|'net'|'empty'|'off', via?:'own'|'bundle'} */
      verify: function (key) {
        key = String(key || '').trim();
        if (!key) return Promise.resolve({ ok: false, code: 'empty' });
        if (!cfg.GUMROAD_PRODUCT_ID) return Promise.resolve({ ok: false, code: 'off' });
        return post(cfg.GUMROAD_PRODUCT_ID, key).then(function (j) {
          if (j && j.success) {                          // a key for this tool – behaves exactly as before
            var p = j.purchase || {};
            if (p.refunded || p.chargebacked || p.disputed || p.subscription_cancelled_at || p.subscription_failed_at) return { ok: false, code: 'refunded' };
            set(cfg.STORAGE_KEY, { product: cfg.GUMROAD_PRODUCT_ID, key: key, at: new Date(now()).toISOString() });
            return { ok: true, code: 'ok', via: 'own' };
          }
          if (!bundleId) return { ok: false, code: j ? 'bad' : 'net' };
          return post(bundleId, key).then(function (b) {
            var c = judgeBundle(b);
            if (c === 'ok') { set(BUNDLE.STORAGE_KEY, { product: bundleId, key: key, at: new Date(now()).toISOString(), checked: now() }); return { ok: true, code: 'ok', via: 'bundle' }; }
            if (c === 'net' && j) return { ok: false, code: 'bad' };   // own product answered "not found", bundle unreachable
            return { ok: false, code: c };
          });
        });
      },
      /* re-verify a stored bundle unlock when it is RECHECK_MS old. Resolves 'none'|'not-due'|'ok'|'kept'|'locked'. */
      recheck: function () {
        var v = bundleEntry();
        if (!v) return Promise.resolve('none');
        if (now() - (+v.checked || 0) < BUNDLE.RECHECK_MS) return Promise.resolve('not-due');
        return post(bundleId, v.key).then(function (j) {
          var c = judgeBundle(j);
          if (c === 'net') return 'kept';
          if (c === 'ok') { v.checked = now(); set(BUNDLE.STORAGE_KEY, v); return 'ok'; }
          del(BUNDLE.STORAGE_KEY); return 'locked';
        });
      },
      lock: function () { del(cfg.STORAGE_KEY); },
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
    if (cfg.PAYWALL_ENABLED && pw.recheck && !pw.isDevMode()) pw.recheck().then(function (r) {
      if (r !== 'locked' || pw.isUnlocked()) return;
      var out = document.getElementById('paid-out'), btn = document.getElementById('paid-open');
      if (out) out.hidden = true; if (btn) btn.classList.add('locked');
      if (opts.onLocked) opts.onLocked();
    });
    var show = dlg.showModal.bind(dlg);
    dlg.showModal = function () { render(); show(); };
    if (!cfg.PAYWALL_ENABLED && opts.launchAfter && !document.getElementById('launch-note')) {
      var n = document.createElement('p'); n.id = 'launch-note'; n.className = 'muted small launch-note'; n.textContent = '🎉 ' + t('launch');
      opts.launchAfter.parentNode.insertBefore(n, opts.launchAfter.nextSibling);
      new MutationObserver(function () { n.textContent = '🎉 ' + t('launch'); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }
  }
  root.PAYWALL = { create: create, mount: mount, VERIFY_URL: VERIFY_URL, BUNDLE: BUNDLE };
})(typeof self !== 'undefined' ? self : this);
