'use strict';

// ─── Init ─────────────────────────────────────────────────────────────────────
// Wires KRTerminal to the DOM after all scripts are loaded.
// This is the only place that references element IDs directly.

(function () {
  window.KRTerminal.init({
    output: 'output',
    input:  'input',
    prompt: 'prompt'
  });
}());
