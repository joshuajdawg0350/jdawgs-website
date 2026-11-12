// Human Hands — "Continue with Google" (Google Identity Services, ID-token flow).
// ---------------------------------------------------------------------------
// Behaviour contract:
//  * Feature-flagged by window.HH_GOOGLE_CLIENT_ID (see hh-config.js). No
//    client ID = this script does nothing at all: the sign-in blocks stay
//    hidden and the plain forms work exactly as they always have.
//  * With a client ID, each [data-hh-google-block] on the page is revealed
//    and Google's official button is rendered into its [data-hh-google-btn]
//    mount. The returned ID token is verified by OUR API
//    (POST {HH_API_BASE}/api/auth/google) — never trusted client-side — and
//    the verified { name, email } is handed to page hooks registered with
//    HHGoogle.onVerified(fn). Sign-in is optional on every page.
//  * If Google's script is blocked or slow, the block explains that and the
//    form below carries on untouched — sign-in never gates the form.
(function () {
  'use strict';

  var clientId = (window.HH_GOOGLE_CLIENT_ID || '').trim();
  var apiBase = (window.HH_API_BASE || 'https://human-hands-ai-inbox-joshuajdawg0350-1282.vercel.app').replace(/\/+$/, '');

  var HHGoogle = {
    enabled: !!clientId,
    profile: null,
    _callbacks: [],
    onVerified: function (fn) {
      if (typeof fn !== 'function') return;
      HHGoogle._callbacks.push(fn);
      if (HHGoogle.profile) {
        try { fn(HHGoogle.profile); } catch (e) { /* page hook errors never break sign-in */ }
      }
    }
  };
  window.HHGoogle = HHGoogle;

  if (!clientId) return; // feature off — blocks stay hidden, forms untouched

  function setStatus(text) {
    var nodes = document.querySelectorAll('[data-hh-google-status]');
    for (var i = 0; i < nodes.length; i++) nodes[i].textContent = text || '';
  }

  function gracefulFail() {
    setStatus('Google sign-in is unavailable right now — no problem, the form works exactly the same without it.');
  }

  function onCredential(response) {
    if (!response || !response.credential) { gracefulFail(); return; }
    setStatus('Checking your sign-in with Google…');
    fetch(apiBase + '/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: response.credential })
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, data: data }; });
    }).then(function (r) {
      if (!r.ok || !r.data || r.data.verified !== true || !r.data.email) {
        gracefulFail();
        return;
      }
      HHGoogle.profile = {
        name: r.data.name || '',
        email: r.data.email,
        email_verified: r.data.email_verified === true
      };
      setStatus('Signed in as ' + (HHGoogle.profile.name || HHGoogle.profile.email) +
        ' (' + HHGoogle.profile.email + ') — verified by Google.');
      var cbs = HHGoogle._callbacks.slice();
      for (var i = 0; i < cbs.length; i++) {
        try { cbs[i](HHGoogle.profile); } catch (e) { /* ignore page-hook errors */ }
      }
    }).catch(function () { gracefulFail(); });
  }

  function init() {
    var blocks = document.querySelectorAll('[data-hh-google-block]');
    for (var i = 0; i < blocks.length; i++) blocks[i].hidden = false;

    var loadTimer = window.setTimeout(gracefulFail, 9000);
    var script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = function () {
      window.clearTimeout(loadTimer);
      if (!window.google || !window.google.accounts || !window.google.accounts.id) {
        gracefulFail();
        return;
      }
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: onCredential,
        auto_select: false
      });
      var mounts = document.querySelectorAll('[data-hh-google-btn]');
      for (var j = 0; j < mounts.length; j++) {
        window.google.accounts.id.renderButton(mounts[j], {
          theme: 'filled_blue',
          size: 'large',
          type: 'standard',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: 300
        });
      }
    };
    script.onerror = function () {
      window.clearTimeout(loadTimer);
      gracefulFail();
    };
    document.head.appendChild(script);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
