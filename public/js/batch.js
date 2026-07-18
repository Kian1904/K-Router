'use strict';

// ─── Batching Engine ──────────────────────────────────────────────────────────
// Debounces DOM re-renders by 15ms.
// If multiple updates fire in rapid succession, the screen is redrawn once.
// Prevents stuttering on mobile and reduces battery drain.

(function () {

  var DEBOUNCE_MS = 15;
  var _timer      = null;
  var _queue      = [];

  function scheduleRender(fn) {
    if (typeof fn !== 'function') return;
    _queue.push(fn);

    if (_timer !== null) return; // already scheduled

    _timer = setTimeout(function () {
      _timer = null;
      var batch = _queue.slice();
      _queue = [];
      for (var i = 0; i < batch.length; i++) {
        try {
          batch[i]();
        } catch (e) {
          console.error('[BATCH] Render error:', e);
        }
      }
    }, DEBOUNCE_MS);
  }

  // Flush immediately (used for critical UI like auth prompts)
  function flushNow() {
    if (_timer !== null) {
      clearTimeout(_timer);
      _timer = null;
    }
    var batch = _queue.slice();
    _queue = [];
    for (var i = 0; i < batch.length; i++) {
      try {
        batch[i]();
      } catch (e) {
        console.error('[BATCH] Flush error:', e);
      }
    }
  }

  window.KRBatch = { scheduleRender: scheduleRender, flushNow: flushNow };

}());
