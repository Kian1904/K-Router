'use strict';

// ─── Client-side Provider Registry ───────────────────────────────────────────
// Mirrors api/_providers.js — kept in sync manually.
// Used by terminal for /models display and /use alias resolution.

(function () {

  var PROVIDERS = {
    groq: {
      id: 'groq', name: 'Groq · Llama 3.3 70B',
      model: 'llama-3.3-70b-versatile', priority: 1, backup: false
    },
    google_gemini: {
      id: 'google_gemini', name: 'Google · Gemini 2.5 Flash',
      model: 'gemini-2.5-flash', priority: 2, backup: false
    },
    nvidia_z_ai: {
      id: 'nvidia_z_ai', name: 'NVIDIA NIM · GLM 5.2',
      model: 'z-ai/glm-5.2', priority: 3, backup: false
    },
    cerebras: {
      id: 'cerebras', name: 'Cerebras · Gemma 4 31B',
      model: 'google/gemma-4-31B-it', priority: 4, backup: false
    },
    cohere_north: {
      id: 'cohere_north', name: 'Cohere · North Mini Code',
      model: 'cohere/north-mini-code:free', priority: 5, backup: false
    },
    mistral: {
      id: 'mistral', name: 'Mistral · Codestral',
      model: 'codestral-latest', priority: 6, backup: false
    },
    laguna_xs: {
      id: 'laguna_xs', name: 'Poolside · Laguna XS 2.1',
      model: 'poolside/laguna-xs-2.1:free', priority: 7, backup: true
    },
    laguna_m1: {
      id: 'laguna_m1', name: 'Poolside · Laguna M.1',
      model: 'poolside/laguna-m.1:free', priority: 8, backup: true
    }
  };

  // ── Aliases for /use command ─────────────────────────────────────────────────
  var MODEL_ALIASES = {
    'auto':       null,
    'groq':       'groq',
    'llama':      'groq',
    'gemini':     'google_gemini',
    'glm':        'nvidia_z_ai',
    'nvidia':     'nvidia_z_ai',
    'gemma':      'cerebras',
    'cerebras':   'cerebras',
    'cohere':     'cohere_north',
    'north':      'cohere_north',
    'codestral':  'mistral',
    'mistral':    'mistral',
    'laguna_xs':  'laguna_xs',
    'laguna_m1':  'laguna_m1'
  };

  // ── Resolve alias input to provider id ──────────────────────────────────────
  // Returns: { id: string, ambiguous: false }
  //        | { ambiguous: true, options: string[] }
  //        | null (not found)

  function resolveAlias(input) {
    var key = input.toLowerCase().trim().replace(/-/g, '_');

    // Exact match
    if (Object.prototype.hasOwnProperty.call(MODEL_ALIASES, key)) {
      return { id: MODEL_ALIASES[key], ambiguous: false };
    }

    // Provider id direct match
    if (PROVIDERS[key]) {
      return { id: key, ambiguous: false };
    }

    // Partial match
    var matches = Object.keys(MODEL_ALIASES).filter(function (alias) {
      return alias.indexOf(key) === 0;
    });

    if (matches.length === 1) return { id: MODEL_ALIASES[matches[0]], ambiguous: false };
    if (matches.length  >  1) return { ambiguous: true, options: matches };

    return null;
  }

  function getCascadeOrder(includeBackup) {
    return Object.values(PROVIDERS)
      .filter(function (p) { return includeBackup || !p.backup; })
      .sort(function (a, b) { return a.priority - b.priority; });
  }

  function getProvider(id) {
    return PROVIDERS[id] || null;
  }

  window.KRProviders = {
    PROVIDERS:       PROVIDERS,
    MODEL_ALIASES:   MODEL_ALIASES,
    resolveAlias:    resolveAlias,
    getCascadeOrder: getCascadeOrder,
    getProvider:     getProvider
  };

}());
