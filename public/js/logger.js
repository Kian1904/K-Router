'use strict';

// ─── Activity Logger ──────────────────────────────────────────────────────────
// Structured event log for the terminal.
// Levels: INFO, OK, WARN, ERROR
// All entries are also stored in a ring buffer (max 200) for /log command.

(function () {

  var MAX_ENTRIES = 200;
  var _entries    = [];
  var _listeners  = [];

  var LEVELS = {
    INFO:  'INFO',
    OK:    'OK',
    WARN:  'WARN',
    ERROR: 'ERROR'
  };

  function _ts() {
    var d = new Date();
    var h = String(d.getHours()).padStart(2, '0');
    var m = String(d.getMinutes()).padStart(2, '0');
    var s = String(d.getSeconds()).padStart(2, '0');
    return h + ':' + m + ':' + s;
  }

  function _pad(level) {
    return level.padEnd(5);
  }

  function log(level, message, meta) {
    var entry = {
      ts:      _ts(),
      level:   level,
      message: message,
      meta:    meta || null
    };

    _entries.push(entry);
    if (_entries.length > MAX_ENTRIES) _entries.shift();

    // Notify terminal renderer via batch engine
    var formatted = '[' + entry.ts + '] ' + _pad(entry.level) + ' ' + entry.message;
    window.KRBatch.scheduleRender(function () {
      for (var i = 0; i < _listeners.length; i++) {
        try { _listeners[i](entry, formatted); } catch (e) {}
      }
    });
  }

  function info(message, meta)  { log(LEVELS.INFO,  message, meta); }
  function ok(message, meta)    { log(LEVELS.OK,    message, meta); }
  function warn(message, meta)  { log(LEVELS.WARN,  message, meta); }
  function error(message, meta) { log(LEVELS.ERROR, message, meta); }

  function onLog(fn) {
    _listeners.push(fn);
    return function () {
      var idx = _listeners.indexOf(fn);
      if (idx > -1) _listeners.splice(idx, 1);
    };
  }

  function getEntries() {
    return _entries.slice();
  }

  window.KRLogger = {
    log:        log,
    info:       info,
    ok:         ok,
    warn:       warn,
    error:      error,
    onLog:      onLog,
    getEntries: getEntries,
    LEVELS:     LEVELS
  };

}());
