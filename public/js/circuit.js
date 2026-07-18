'use strict';

// ─── Circuit Breaker ──────────────────────────────────────────────────────────
// Tracks consecutive failures per provider at the frontend level.
// After 5 consecutive errors, the provider is flagged as tripped.
// Auto-resets after 60 seconds, or manually via reset().

(function () {

  var MAX_FAILURES  = 5;
  var RESET_MS      = 60000; // 60 seconds

  var _counts  = {}; // { providerId: number }
  var _tripped = {}; // { providerId: true }
  var _timers  = {}; // { providerId: timeoutId }

  function recordSuccess(providerId) {
    _counts[providerId]  = 0;
    _tripped[providerId] = false;
    if (_timers[providerId]) {
      clearTimeout(_timers[providerId]);
      delete _timers[providerId];
    }
    // Sync errorCounts to state
    var counts = Object.assign({}, _counts);
    window.KRState.setState({ errorCounts: counts }, { caller: 'circuit.recordSuccess' });
  }

  function recordFailure(providerId) {
    _counts[providerId] = (_counts[providerId] || 0) + 1;

    if (_counts[providerId] >= MAX_FAILURES && !_tripped[providerId]) {
      _tripped[providerId] = true;
      window.KRLogger.warn(
        'Circuit tripped for ' + providerId +
        ' after ' + MAX_FAILURES + ' failures. Auto-reset in 60s.'
      );

      // Auto-reset after 60s
      if (_timers[providerId]) clearTimeout(_timers[providerId]);
      _timers[providerId] = setTimeout(function () {
        reset(providerId);
        window.KRLogger.info('Circuit auto-reset for ' + providerId);
      }, RESET_MS);
    }

    var counts = Object.assign({}, _counts);
    window.KRState.setState({ errorCounts: counts }, { caller: 'circuit.recordFailure' });
  }

  function isTripped(providerId) {
    return _tripped[providerId] === true;
  }

  function reset(providerId) {
    _counts[providerId]  = 0;
    _tripped[providerId] = false;
    if (_timers[providerId]) {
      clearTimeout(_timers[providerId]);
      delete _timers[providerId];
    }
    var counts = Object.assign({}, _counts);
    window.KRState.setState({ errorCounts: counts }, { caller: 'circuit.reset' });
  }

  function getStatus() {
    var result = {};
    var ids    = Object.keys(_counts);
    for (var i = 0; i < ids.length; i++) {
      result[ids[i]] = {
        failures: _counts[ids[i]] || 0,
        tripped:  _tripped[ids[i]] === true
      };
    }
    return result;
  }

  window.KRCircuit = {
    recordSuccess: recordSuccess,
    recordFailure: recordFailure,
    isTripped:     isTripped,
    reset:         reset,
    getStatus:     getStatus
  };

}());
