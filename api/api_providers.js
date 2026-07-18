'use strict';

// ─── Backend Provider Registry ────────────────────────────────────────────────
// Used by api/chat.js and api/status.js.
// DO NOT use window.* here — this runs in Node.js (Vercel serverless).

// ─── Provider definitions ─────────────────────────────────────────────────────

const PROVIDERS = {
  groq: {
    id:       'groq',
    name:     'Groq · Llama 3.3 70B',
    model:    'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    envKey:   'GROQ_API_KEY',
    type:     'openai',
    priority: 1,
    backup:   false
  },
  google_gemini: {
    id:       'google_gemini',
    name:     'Google · Gemini 2.5 Flash',
    model:    'gemini-2.5-flash',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    envKey:   'GEMINI_API_KEY',
    type:     'google',
    priority: 2,
    backup:   false
  },
  nvidia_z_ai: {
    id:       'nvidia_z_ai',
    name:     'NVIDIA NIM · GLM 5.2',
    model:    'z-ai/glm-5.2',
    endpoint: 'https://integrate.api.nvidia.com/v1/chat/completions',
    envKey:   'NVIDIA_API_KEY',
    type:     'openai',
    priority: 3,
    backup:   false
  },
  cerebras: {
    id:       'cerebras',
    name:     'Cerebras · Gemma 4 31B',
    model:    'google/gemma-4-31B-it',
    endpoint: 'https://api.cerebras.ai/v1/chat/completions',
    envKey:   'CEREBRAS_API_KEY',
    type:     'openai',
    priority: 4,
    backup:   false
  },
  cohere_north: {
    id:       'cohere_north',
    name:     'Cohere · North Mini Code',
    model:    'cohere/north-mini-code:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    envKey:   'OPENROUTER_API_KEY',
    type:     'openai',
    priority: 5,
    backup:   false
  },
  mistral: {
    id:       'mistral',
    name:     'Mistral · Codestral',
    model:    'codestral-latest',
    endpoint: 'https://api.mistral.ai/v1/chat/completions',
    envKey:   'MISTRAL_API_KEY',
    type:     'openai',
    priority: 6,
    backup:   false
  },
  laguna_xs: {
    id:       'laguna_xs',
    name:     'Poolside · Laguna XS 2.1',
    model:    'poolside/laguna-xs-2.1:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    envKey:   'OPENROUTER_API_KEY',
    type:     'openai',
    priority: 7,
    backup:   true
  },
  laguna_m1: {
    id:       'laguna_m1',
    name:     'Poolside · Laguna M.1',
    model:    'poolside/laguna-m.1:free',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    envKey:   'OPENROUTER_API_KEY',
    type:     'openai',
    priority: 8,
    backup:   true
  }
};

// ─── Model aliases (for /use command and provider= body param) ────────────────

const MODEL_ALIASES = {
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

// ─── Cascade order ────────────────────────────────────────────────────────────

function getCascadeOrder(includeBackup) {
  return Object.values(PROVIDERS)
    .filter(function (p) { return includeBackup || !p.backup; })
    .sort(function (a, b) { return a.priority - b.priority; });
}

// ─── Intent detection (for auto routing) ─────────────────────────────────────
// Returns the best provider id based on last user message content.

var CODING_KEYWORDS = [
  'code', 'bug', 'error', 'function', 'debug', 'fix', 'syntax',
  'javascript', 'python', 'typescript', 'html', 'css', 'sql',
  'kode', 'perbaiki', 'fungsi', 'variabel', 'loop', 'array',
  'script', 'class', 'import', 'export', 'api', 'endpoint'
];

var WRITING_KEYWORDS = [
  'write', 'essay', 'article', 'summarize', 'explain', 'describe',
  'tulis', 'artikel', 'rangkum', 'jelaskan', 'cerita', 'translate',
  'terjemah', 'email', 'laporan', 'dokumen'
];

function detectIntent(messages) {
  var lastUser = '';
  for (var i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') {
      lastUser = (messages[i].content || '').toLowerCase();
      break;
    }
  }

  for (var c = 0; c < CODING_KEYWORDS.length; c++) {
    if (lastUser.indexOf(CODING_KEYWORDS[c]) !== -1) return 'mistral';
  }
  for (var w = 0; w < WRITING_KEYWORDS.length; w++) {
    if (lastUser.indexOf(WRITING_KEYWORDS[w]) !== -1) return 'google_gemini';
  }

  return 'groq'; // default
}

// ─── Gemini format converters ─────────────────────────────────────────────────
// Google's generateContent API uses a different message format than OpenAI.

function toGeminiContents(messages) {
  var contents = [];
  var systemParts = [];

  for (var i = 0; i < messages.length; i++) {
    var msg = messages[i];
    if (msg.role === 'system') {
      systemParts.push({ text: msg.content || '' });
      continue;
    }
    var role = msg.role === 'assistant' ? 'model' : 'user';
    contents.push({ role: role, parts: [{ text: msg.content || '' }] });
  }

  var body = { contents: contents };
  if (systemParts.length > 0) {
    body.system_instruction = { parts: systemParts };
  }

  return body;
}

function fromGeminiResponse(data, providerId) {
  var text = '';
  try {
    text = data.candidates[0].content.parts[0].text || '';
  } catch (e) {
    text = '';
  }

  var usage = data.usageMetadata || {};

  return {
    choices: [{
      message: { role: 'assistant', content: text },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens:     usage.promptTokenCount     || null,
      completion_tokens: usage.candidatesTokenCount || null,
      total_tokens:      usage.totalTokenCount      || null
    },
    provider: providerId
  };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  PROVIDERS:          PROVIDERS,
  MODEL_ALIASES:      MODEL_ALIASES,
  getCascadeOrder:    getCascadeOrder,
  detectIntent:       detectIntent,
  toGeminiContents:   toGeminiContents,
  fromGeminiResponse: fromGeminiResponse
};
