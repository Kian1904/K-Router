'use strict';

// ─── Global State Store ───────────────────────────────────────────────────────
// Single source of truth for all app state.
// UI must never mutate _state directly — always use setState().
// Every mutation must include { caller: 'module.functionName' } metadata.

(function () {

  var _state = {
    token:          null,
    activeProvider: 'auto',
    chatHistory:    [],
    isLoading:      false,
    errorCounts:    {},   // { providerId: number } — for circuit breaker
    lastActivity:   null  // ISO timestamp of last successful response
  };

  var _subscribers = [];

  // ─── Identity Debugger Scanner ──────────────────────────────────────────────
  // Every setState call is traced: who called it, what changed, and when.
  // Visible in console when localStorage.KR_DEBUG === '1'.

  var _mutationLog = [];
  var DEBUG = localStorage.getItem('KR_DEBUG') === '1';

  function _trace(caller, partial, prev) {
    var entry = {
      ts:     new Date().toISOString(),
      caller: caller || 'UNKNOWN — missing meta.caller',
      keys:   Object.keys(partial),
      prev:   JSON.parse(JSON.stringify(prev)),
      next:   JSON.parse(JSON.stringify(_state))
    };
    _mutationLog.push(entry);
    if (_mutationLog.length > 100) _mutationLog.shift(); // ring buffer
    if (DEBUG) {
      console.log('[STATE]', entry.caller, entry.keys, entry);
    }
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  function getState() {
    return JSON.parse(JSON.stringify(_state)); // immutable copy
  }

  function setState(partial, meta) {
    if (!meta || typeof meta.caller !== 'string') {
      console.warn('[STATE] Missing meta.caller — mutation not traced properly.');
    }

    var prev = JSON.parse(JSON.stringify(_state));
    var key;
    for (key in partial) {
      if (Object.prototype.hasOwnProperty.call(partial, key)) {
        _state[key] = partial[key];
      }
    }

    _trace(meta ? meta.caller : null, partial, prev);

    // Notify all subscribers (called by batch engine)
    for (var i = 0; i < _subscribers.length; i++) {
      try {
        _subscribers[i](_state, prev);
      } catch (e) {
        console.error('[STATE] Subscriber error:', e);
      }
    }
  }

  function subscribe(fn) {
    _subscribers.push(fn);
    return function unsubscribe() {
      var idx = _subscribers.indexOf(fn);
      if (idx > -1) _subscribers.splice(idx, 1);
    };
  }

  function getMutationLog() {
    return _mutationLog.slice();
  }

  window.KRState = { getState: getState, setState: setState, subscribe: subscribe, getMutationLog: getMutationLog };

}());
