// Human Hands worker app — client library (hh-app.js).
// ---------------------------------------------------------------------------
// Loaded on the HH app pages (board, work, alerts). It:
//   * registers the /human-hands/ service worker (scope /human-hands/ —
//     the root J-Dawgs PWA keeps the rest of the site),
//   * captures beforeinstallprompt so the "Install the app" buttons can
//     offer the real install where the browser supports it, and shows
//     plain Add-to-Home-Screen instructions where it doesn't (iPhone),
//   * runs the push-alerts state machine against the HH backend:
//       enable  -> Notification permission -> pushManager.subscribe ->
//                  POST {HH_API_BASE}/api/push/subscribe { email, sub }
//       disable -> POST /api/push/unsubscribe + subscription.unsubscribe()
//       test    -> POST /api/push/test { endpoint }
//   * injects the app bottom nav (Board · Post a Job · Alerts),
//   * exposes HHApp.afterSignup(email) — work.html calls it the moment a
//     signup lands (either door) so the install step in the confirmation
//     knows whose alerts to tie to this device.
//
// The worker's signup email is remembered on this device only
// (localStorage 'hhWorkerEmail') — it ties the push subscription to the
// roster record. The VAPID public key is public by design (hh-config.js);
// no secret ever touches this file.
(function () {
  'use strict';

  var apiBase = (window.HH_API_BASE || 'https://human-hands-ai-inbox-joshuajdawg0350-1282.vercel.app').replace(/\/+$/, '');
  var vapidPublicKey = (window.HH_VAPID_PUBLIC_KEY || '').trim();
  var EMAIL_KEY = 'hhWorkerEmail';
  var BOARD_URL = 'https://jdawgsindustries.com/human-hands/board.html';

  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredInstallPrompt = e;
    refreshUI();
  });
  window.addEventListener('appinstalled', function () {
    deferredInstallPrompt = null;
    refreshUI();
  });

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      window.navigator.standalone === true;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
  }
  function pushSupported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }
  function savedEmail() {
    try { return localStorage.getItem(EMAIL_KEY) || ''; } catch (e) { return ''; }
  }
  function saveEmail(email) {
    try { if (email) localStorage.setItem(EMAIL_KEY, email); } catch (e) { /* storage off */ }
  }

  function urlB64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = window.atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function hhRegistration() {
    // The HH app's own registration — never the root site's. Waits
    // (briefly) for its worker to be ACTIVE: pushManager.subscribe
    // throws "no active Service Worker" if tapped in the gap between
    // registration and activation on a first visit.
    if (!('serviceWorker' in navigator)) return Promise.reject(new Error('no_sw'));
    return navigator.serviceWorker.getRegistration('/human-hands/')
      .then(function (reg) {
        if (!reg) return navigator.serviceWorker.ready;
        if (reg.active) return reg;
        var deadline = Date.now() + 10000;
        return new Promise(function (resolve) {
          (function poll() {
            if (reg.active || Date.now() > deadline) return resolve(reg);
            setTimeout(poll, 200);
          })();
        });
      });
  }

  function currentSubscription() {
    if (!pushSupported()) return Promise.resolve(null);
    return hhRegistration()
      .then(function (reg) { return reg.pushManager.getSubscription(); })
      .catch(function () { return null; });
  }

  function post(path, body, headers) {
    return fetch(apiBase + path, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  var HHApp = {
    isStandalone: isStandalone,
    pushSupported: pushSupported,
    installAvailable: function () { return Boolean(deferredInstallPrompt); },

    install: function () {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        return deferredInstallPrompt.userChoice.then(function () {
          deferredInstallPrompt = null;
          refreshUI();
        });
      }
      // No native prompt (iPhone, or already installed): the pages carry
      // printed Add-to-Home-Screen steps — reveal them.
      var helps = document.querySelectorAll('[data-hh-ios-help]');
      for (var i = 0; i < helps.length; i++) helps[i].hidden = false;
      return Promise.resolve();
    },

    afterSignup: function (email) {
      if (email) saveEmail(email);
      refreshUI();
    },

    getState: function () {
      return currentSubscription().then(function (sub) {
        return {
          supported: pushSupported(),
          standalone: isStandalone(),
          permission: ('Notification' in window) ? Notification.permission : 'unsupported',
          subscribed: Boolean(sub),
          email: savedEmail()
        };
      });
    },

    enableAlerts: function (email) {
      email = (email || savedEmail() || '').trim();
      if (!email) return Promise.resolve({ ok: false, error: 'email_required' });
      if (!pushSupported()) return Promise.resolve({ ok: false, error: 'unsupported' });
      if (!vapidPublicKey) return Promise.resolve({ ok: false, error: 'not_configured' });
      saveEmail(email);
      return Notification.requestPermission().then(function (permission) {
        if (permission !== 'granted') return { ok: false, error: 'permission_' + permission };
        return hhRegistration().then(function (reg) {
          return reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlB64ToUint8Array(vapidPublicKey)
          });
        }).then(function (sub) {
          return post('/api/push/subscribe', {
            email: email,
            subscription: sub.toJSON(),
            ua: navigator.userAgent || ''
          }).then(function (r) {
            if (r.ok) return { ok: true };
            return { ok: false, error: (r.data && r.data.error) || 'subscribe_failed' };
          });
        });
      }).catch(function (err) {
        return { ok: false, error: (err && err.name) || 'failed' };
      });
    },

    disableAlerts: function () {
      return currentSubscription().then(function (sub) {
        if (!sub) return { ok: true, wasSubscribed: false };
        var endpoint = sub.endpoint;
        return post('/api/push/unsubscribe', { endpoint: endpoint })
          .catch(function () { return { ok: false }; })
          .then(function () { return sub.unsubscribe(); })
          .then(function () { return { ok: true, wasSubscribed: true }; });
      }).catch(function () { return { ok: false, error: 'failed' }; });
    },

    testAlert: function () {
      return currentSubscription().then(function (sub) {
        if (!sub) return { ok: false, error: 'not_subscribed' };
        return post('/api/push/test', { endpoint: sub.endpoint }).then(function (r) {
          if (r.ok) return { ok: true };
          return { ok: false, error: (r.data && r.data.error) || 'test_failed' };
        });
      }).catch(function () { return { ok: false, error: 'failed' }; });
    }
  };
  window.HHApp = HHApp;

  /* ---------------- service worker ---------------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/human-hands/sw.js').catch(function () {});
    });
  }

  /* ---------------- bottom app nav ---------------- */
  function injectNav() {
    if (document.querySelector('.hh-appnav')) return;
    var path = window.location.pathname;
    var items = [
      { href: 'board.html', label: 'Board', ico: '▦', match: /board\.html/ },
      { href: 'board.html#post', label: 'Post a Job', ico: '＋', match: /$^/ },
      { href: 'alerts.html', label: 'Alerts', ico: '♪', match: /alerts\.html/ }
    ];
    var nav = document.createElement('nav');
    nav.className = 'hh-appnav';
    nav.setAttribute('aria-label', 'Human Hands app');
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = it.href;
      if (it.match.test(path)) a.setAttribute('aria-current', 'page');
      var ico = document.createElement('span');
      ico.className = 'hh-appnav-ico';
      ico.textContent = it.ico;
      a.appendChild(ico);
      a.appendChild(document.createTextNode(it.label));
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    document.body.classList.add('hh-has-appnav');
  }

  /* ---------------- shared UI wiring ---------------- */
  function setStatus(text) {
    var nodes = document.querySelectorAll('[data-hh-app-status]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text || '';
  }

  function refreshUI() {
    HHApp.getState().then(function (st) {
      var installBtns = document.querySelectorAll('[data-hh-install-btn]');
      for (var i = 0; i < installBtns.length; i++) {
        installBtns[i].hidden = st.standalone;
      }
      var helps = document.querySelectorAll('[data-hh-ios-help]');
      for (var j = 0; j < helps.length; j++) {
        // iPhone gets the printed steps up front — there is no prompt.
        if (isIOS() && !st.standalone) helps[j].hidden = false;
      }
      var toggles = document.querySelectorAll('[data-hh-alerts-toggle]');
      for (var k = 0; k < toggles.length; k++) {
        toggles[k].textContent = st.subscribed ? 'Turn alerts off' : 'Enable notifications';
        toggles[k].disabled = !st.supported;
      }
      var tests = document.querySelectorAll('[data-hh-test-btn]');
      for (var m = 0; m < tests.length; m++) tests[m].disabled = !st.subscribed;
      var emails = document.querySelectorAll('[data-hh-email]');
      for (var n = 0; n < emails.length; n++) {
        if (!emails[n].value && st.email) emails[n].value = st.email;
      }
      var stateLines = document.querySelectorAll('[data-hh-alerts-state]');
      for (var q = 0; q < stateLines.length; q++) {
        stateLines[q].textContent = !st.supported
          ? 'This browser cannot do live alerts. On an iPhone, install the app first (Share → Add to Home Screen), then open it and turn alerts on here.'
          : st.subscribed
            ? 'Alerts are ON for this device' + (st.email ? ' — tied to ' + st.email + '.' : '.')
            : 'Alerts are off on this device.';
      }
    });
  }

  function wireUI() {
    injectNav();
    var installBtns = document.querySelectorAll('[data-hh-install-btn]');
    for (var i = 0; i < installBtns.length; i++) {
      installBtns[i].addEventListener('click', function () { HHApp.install(); });
    }
    var toggles = document.querySelectorAll('[data-hh-alerts-toggle]');
    for (var j = 0; j < toggles.length; j++) {
      toggles[j].addEventListener('click', function () {
        var emailEl = document.querySelector('[data-hh-email]');
        var email = emailEl ? emailEl.value : savedEmail();
        HHApp.getState().then(function (st) {
          if (st.subscribed) {
            setStatus('Turning alerts off…');
            return HHApp.disableAlerts().then(function (r) {
              setStatus(r.ok ? 'Alerts are off. You can turn them back on any time.' : 'That did not go through — try once more.');
              refreshUI();
            });
          }
          setStatus('Turning alerts on…');
          return HHApp.enableAlerts(email).then(function (r) {
            if (r.ok) {
              setStatus('Alerts are on — when a job posts, it lands on this phone. Send yourself a test alert to see it work.');
            } else if (r.error === 'email_required') {
              setStatus('Enter the email you signed up with first, so alerts tie to your roster record.');
            } else if (r.error === 'permission_denied') {
              setStatus('Notifications are blocked for this site in your browser settings. Allow notifications for jdawgsindustries.com, then tap Enable again.');
            } else if (r.error === 'unsupported') {
              setStatus('This browser cannot do live alerts. On an iPhone, install the app first (Share → Add to Home Screen), then turn alerts on inside it.');
            } else {
              setStatus('That did not go through — try once more. If it keeps failing, email joshuajdawg0350@gmail.com.');
            }
            refreshUI();
          });
        });
      });
    }
    var tests = document.querySelectorAll('[data-hh-test-btn]');
    for (var k = 0; k < tests.length; k++) {
      tests[k].addEventListener('click', function () {
        setStatus('Sending a test alert…');
        HHApp.testAlert().then(function (r) {
          setStatus(r.ok ? 'Test alert sent — check your notifications.' : 'The test alert did not go through — try once more.');
        });
      });
    }
    refreshUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', wireUI);
  } else {
    wireUI();
  }
})();
