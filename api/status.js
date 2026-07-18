'use strict';

const { getCascadeOrder } = require('./_providers');

const PING_TIMEOUT_MS = 5000;

// ─── Auth ──────────────────────────────────────────────────────────────────────

function authenticate(req) {
  const authHeader = (req.headers['authorization'] || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token === process.env.BEARER_TOKEN;
}

// ─── CORS ──────────────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── Ping ──────────────────────────────────────────────────────────────────────
// HEAD request ke base URL — any HTTP response = reachable.
// Timeouts and network errors = down.

async function pingBase(baseUrl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = Date.now();
  try {
    await fetch(baseUrl, { method: 'HEAD', signal: controller.signal });
    return { ok: true, latency_ms: Date.now() - start };
  } catch (err) {
    return {
      ok: false,
      latency_ms: Date.now() - start,
      reason: err.name === 'AbortError' ? 'timeout' : 'unreachable'
    };
  } finally {
    clearTimeout(timer);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed: expected GET' });
  }

  if (!authenticate(req)) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
  }

  const providers = getCascadeOrder(true);

  // Deduplicate base URLs — multiple providers may share a host (e.g. openrouter.ai)
  const uniqueBases = [...new Set(providers.map(function(p) {
    return new URL(p.endpoint).origin;
  }))];

  // Ping all unique hosts in parallel
  const pingResults = {};
  await Promise.all(
    uniqueBases.map(async function(base) {
      pingResults[base] = await pingBase(base);
    })
  );

  // Build per-provider status
  const providerStatuses = providers.map(function(p) {
    const base   = new URL(p.endpoint).origin;
    const ping   = pingResults[base] || { ok: false, latency_ms: 0 };
    const hasKey = Boolean(process.env[p.envKey]);

    var status;
    if (!hasKey)       status = 'no_key';
    else if (!ping.ok) status = 'down';
    else               status = 'ok';

    const entry = {
      id:     p.id,
      name:   p.name,
      model:  p.model,
      status: status,
      backup: p.backup
    };

    if (ping.ok) entry.latency_ms = ping.latency_ms;

    return entry;
  });

  return res.status(200).json({
    providers: providerStatuses,
    timestamp: new Date().toISOString()
  });
};
