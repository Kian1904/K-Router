'use strict';

// ─── Token Encryptor + First Boot Protocol ────────────────────────────────────
// Obfuscates the Bearer token before storing in localStorage.
// Not cryptographically secure — prevents plain-text exposure only.
// First Boot: if no token found, prompts for input before app hydrates.

(function () {

  var STORAGE_KEY = 'kr_t';
  var XOR_KEY     = 'KsRouter2026';

  // ── XOR + base64 obfuscation ────────────────────────────────────────────────

  function _obfuscate(str) {
    var out = '';
    for (var i = 0; i < str.length; i++) {
      out += String.fromCharCode(
        str.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length)
      );
    }
    return btoa(out);
  }

  function _deobfuscate(encoded) {
    var str = atob(encoded);
    var out = '';
    for (var i = 0; i < str.length; i++) {
      out += String.fromCharCode(
        str.charCodeAt(i) ^ XOR_KEY.charCodeAt(i % XOR_KEY.length)
      );
    }
    return out;
  }

  // ── Storage ─────────────────────────────────────────────────────────────────

  function loadToken() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return _deobfuscate(raw);
    } catch (e) {
      console.error('[AUTH] Failed to load token:', e);
      return null;
    }
  }

  function saveToken(token) {
    try {
      localStorage.setItem(STORAGE_KEY, _obfuscate(token));
      window.KRState.setState({ token: token }, { caller: 'auth.saveToken' });
    } catch (e) {
      console.error('[AUTH] Failed to save token:', e);
    }
  }

  function clearToken() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      window.KRState.setState({ token: null }, { caller: 'auth.clearToken' });
    } catch (e) {
      console.error('[AUTH] Failed to clear token:', e);
    }
  }

  // ── Verify token against /api/chat ──────────────────────────────────────────

  function verifyToken(token) {
    return fetch('/api/chat', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'ping' }] })
    }).then(function (res) {
      return res.status !== 401;
    }).catch(function () {
      return true; // network error — assume valid, let chat fail naturally
    });
  }

  // ── First Boot ───────────────────────────────────────────────────────────────
  // Hydrates state from localStorage. Returns true if token found, false if not.

  function hydrate() {
    var token = loadToken();
    if (token) {
      window.KRState.setState({ token: token }, { caller: 'auth.hydrate' });
      return true;
    }
    return false;
  }

  window.KRAuth = {
    loadToken:   loadToken,
    saveToken:   saveToken,
    clearToken:  clearToken,
    verifyToken: verifyToken,
    hydrate:     hydrate
  };

}());
