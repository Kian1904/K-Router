'use strict';

const Sentry = require('./_sentry');

const {
  PROVIDERS,
  MODEL_ALIASES,
  detectIntent,
  getCascadeOrder,
  toGeminiContents,
  fromGeminiResponse
} = require('./_providers');

const TIMEOUT_MS = 20000;

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(req) {
  const authHeader = (req.headers['authorization'] || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token === process.env.BEARER_TOKEN;
}

// ─── fetchWithTimeout ─────────────────────────────────────────────────────────

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Single-provider call ─────────────────────────────────────────────────────

async function callProvider(provider, messages, apiKey) {
  if (provider.type === 'google') {
    // ── Gemini native format ──────────────────────────────────────────────────
    const body = toGeminiContents(messages);
    const url  = provider.endpoint + '?key=' + encodeURIComponent(apiKey);

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, TIMEOUT_MS);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + ' from ' + provider.name + ': ' + text.slice(0, 200));
    }

    const data = await res.json();
    return fromGeminiResponse(data, provider.id);

  } else {
    // ── OpenAI-compatible ─────────────────────────────────────────────────────
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };

    // OpenRouter requires referer + title
    if (provider.endpoint.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://ks-router.vercel.app';
      headers['X-Title'] = "K's Router";
    }

    const body = {
      model: provider.model,
      messages: messages
    };

    const res = await fetchWithTimeout(provider.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    }, TIMEOUT_MS);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error('HTTP ' + res.status + ' from ' + provider.name + ': ' + text.slice(0, 200));
    }

    const data = await res.json();
    data.provider = provider.id;
    return data;
  }
}

// ─── Build cascade list ───────────────────────────────────────────────────────
// Puts the preferred provider first, then the rest in their default priority
// order. Backup providers always tail the list (priority 7+).

function buildCascade(preferredId) {
  const all = getCascadeOrder(true);
  const preferred = all.find(function(p) { return p.id === preferredId; });
  if (!preferred) return all;

  return [preferred].concat(all.filter(function(p) { return p.id !== preferredId; }));
}

// ─── CORS headers ─────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── Fire-and-forget usage log ────────────────────────────────────────────────
// Sends a log entry to /api/log after every successful response.
// Does NOT await — never blocks or affects response time.

function fireLog(entry) {
  const baseUrl = process.env.VERCEL_URL
    ? 'https://' + process.env.VERCEL_URL
    : 'http://localhost:3000';

  fetch(baseUrl + '/api/log', {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': 'Bearer ' + process.env.BEARER_TOKEN
    },
    body: JSON.stringify(entry)
  }).catch(function () {
    // Silent fail — logging must never crash the main response
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: expected POST' });
  }

  if (!authenticate(req)) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
  }

  const body = req.body || {};
  const messages = body.messages;
  const providerPref = body.provider;

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Bad request: messages must be a non-empty array' });
  }

  // ── Resolve starting provider ───────────────────────────────────────────────
  const pref = (typeof providerPref === 'string' ? providerPref : 'auto').toLowerCase().trim();
  var startId;

  if (pref === 'auto') {
    startId = detectIntent(messages);
  } else {
    // MODEL_ALIASES maps 'auto' → null intentionally
    // For any other key: null means alias not found
    if (Object.prototype.hasOwnProperty.call(MODEL_ALIASES, pref)) {
      startId = MODEL_ALIASES[pref];
    } else if (PROVIDERS[pref]) {
      startId = pref;
    } else {
      startId = null;
    }

    if (!startId) {
      return res.status(400).json({ error: 'Bad request: unknown provider or alias "' + pref + '"' });
    }
  }

  // ── Cascade ─────────────────────────────────────────────────────────────────
  const cascade = buildCascade(startId);
  const errors  = [];
  const t0      = Date.now();

  for (var i = 0; i < cascade.length; i++) {
    var provider = cascade[i];
    var apiKey = process.env[provider.envKey];

    if (!apiKey) {
      errors.push(provider.id + ': no API key (' + provider.envKey + ' not set)');
      continue;
    }

    try {
      const result = await callProvider(provider, messages, apiKey);

      result._meta = {
        intended:  startId,
        resolved:  provider.id,
        cascaded:  provider.id !== startId,
        attempted: errors.map(function(e) { return e.split(':')[0].trim(); })
      };

      fireLog({
        provider:    provider.id,
        model:       provider.model,
        success:     true,
        latency_ms:  Date.now() - t0,
        tokens_in:   (result.usage && result.usage.prompt_tokens)     || null,
        tokens_out:  (result.usage && result.usage.completion_tokens)  || null
      });

      return res.status(200).json(result);

    } catch (err) {
      var reason = err.name === 'AbortError'
        ? provider.id + ': timeout after ' + TIMEOUT_MS + 'ms'
        : provider.id + ': ' + err.message;
      errors.push(reason);
    }
  }

  return res.status(503).json({
    error: 'All providers failed — no available AI backend',
    details: errors
  });
};
