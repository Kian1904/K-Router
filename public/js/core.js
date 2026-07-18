'use strict';

// ─── Core API Client ──────────────────────────────────────────────────────────
// All fetch calls to /api/* go through here.
// Reads token from KRState. Logs all activity via KRLogger.
// Updates circuit breaker on success/failure.

(function () {

  function _token() {
    return window.KRState.getState().token || '';
  }

  function _authHeader() {
    return 'Bearer ' + _token();
  }

  // ── POST /api/chat ───────────────────────────────────────────────────────────

  function sendChat(messages, providerId) {
    var body = { messages: messages };
    if (providerId && providerId !== 'auto') body.provider = providerId;

    window.KRLogger.info(
      '→ ' + (providerId || 'auto') + ' · sending ' + messages.length + ' message(s)'
    );

    var t0 = Date.now();

    return fetch('/api/chat', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': _authHeader()
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 401) {
        window.KRAuth.clearToken();
        window.KRLogger.error('Unauthorized — token cleared');
        throw new Error('UNAUTHORIZED');
      }
      if (!res.ok) {
        throw new Error('HTTP ' + res.status);
      }
      return res.json();
    }).then(function (data) {
      var latency  = Date.now() - t0;
      var resolved = (data._meta && data._meta.resolved) || data.provider || '?';
      window.KRCircuit.recordSuccess(resolved);
      window.KRLogger.ok('← ' + resolved + ' · ' + latency + 'ms');
      window.KRState.setState({ lastActivity: new Date().toISOString() }, { caller: 'core.sendChat' });
      return data;
    }).catch(function (err) {
      var latency = Date.now() - t0;
      window.KRCircuit.recordFailure(providerId || 'auto');
      window.KRLogger.error('✗ ' + (providerId || 'auto') + ' · ' + err.message + ' · ' + latency + 'ms');
      throw err;
    });
  }

  // ── GET /api/status ──────────────────────────────────────────────────────────

  function getStatus() {
    window.KRLogger.info('→ /api/status · pinging providers');
    return fetch('/api/status', {
      headers: { 'Authorization': _authHeader() }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      window.KRLogger.ok('← /api/status · ' + data.providers.length + ' providers');
      return data;
    }).catch(function (err) {
      window.KRLogger.error('/api/status failed: ' + err.message);
      throw err;
    });
  }

  // ── POST /api/search ─────────────────────────────────────────────────────────

  function sendSearch(query) {
    window.KRLogger.info('→ /api/search · "' + query + '"');
    return fetch('/api/search', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': _authHeader()
      },
      body: JSON.stringify({ query: query })
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      var count = (data.results || []).length;
      window.KRLogger.ok('← /api/search · ' + count + ' result(s)');
      return data;
    }).catch(function (err) {
      window.KRLogger.error('/api/search failed: ' + err.message);
      throw err;
    });
  }

  // ── GET /api/log ─────────────────────────────────────────────────────────────

  function getDashboard(days) {
    var d = days || 7;
    window.KRLogger.info('→ /api/log · last ' + d + ' day(s)');
    return fetch('/api/log?days=' + d, {
      headers: { 'Authorization': _authHeader() }
    }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      window.KRLogger.ok('← /api/log · ' + data.total + ' total requests');
      return data;
    }).catch(function (err) {
      window.KRLogger.error('/api/log failed: ' + err.message);
      throw err;
    });
  }

  // ── POST /api/log ────────────────────────────────────────────────────────────
  // Fire-and-forget. Does not throw on failure.

  function writeLog(entry) {
    fetch('/api/log', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': _authHeader()
      },
      body: JSON.stringify(entry)
    }).catch(function (err) {
      console.warn('[CORE] writeLog failed silently:', err.message);
    });
  }

  window.KRCore = {
    sendChat:     sendChat,
    getStatus:    getStatus,
    sendSearch:   sendSearch,
    getDashboard: getDashboard,
    writeLog:     writeLog
  };

}());
