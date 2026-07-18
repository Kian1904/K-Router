'use strict';

const { createClient } = require('@supabase/supabase-js');

// Known columns: id, created_at, provider, model, success, latency_ms, tokens_in, tokens_out, effort

// ─── Supabase ─────────────────────────────────────────────────────────────────

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authenticate(req) {
  const authHeader = (req.headers['authorization'] || '').trim();
  if (!authHeader.toLowerCase().startsWith('bearer ')) return false;
  const token = authHeader.slice(7).trim();
  return token === process.env.BEARER_TOKEN;
}

// ─── CORS ─────────────────────────────────────────────────────────────────────

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ─── POST — tulis satu log entry ─────────────────────────────────────────────

async function handlePost(req, res, supabase) {
  const body = req.body || {};

  const entry = {
    provider:   typeof body.provider   === 'string'  ? body.provider.trim()        : null,
    model:      typeof body.model      === 'string'  ? body.model.trim()           : null,
    success:    typeof body.success    === 'boolean' ? body.success                : null,
    latency_ms: typeof body.latency_ms === 'number'  ? Math.round(body.latency_ms) : null,
    tokens_in:  typeof body.tokens_in  === 'number'  ? Math.round(body.tokens_in)  : null,
    tokens_out: typeof body.tokens_out === 'number'  ? Math.round(body.tokens_out) : null,
    effort:     typeof body.effort     === 'string'  ? body.effort.trim()          : null
  };

  if (!entry.provider || !entry.model || entry.success === null) {
    return res.status(400).json({
      error: 'Bad request: provider, model, and success are required'
    });
  }

  const { error } = await supabase.from('usage_logs').insert(entry);
  if (error) {
    return res.status(502).json({ error: 'Supabase insert failed: ' + error.message });
  }

  return res.status(201).json({ ok: true });
}

// ─── GET — aggregated stats ───────────────────────────────────────────────────
// Query param: ?days=7 (default 7, max 90)

async function handleGet(req, res, supabase) {
  const rawDays = parseInt((req.query || {}).days, 10);
  const days    = rawDays > 0 && rawDays <= 90 ? rawDays : 7;
  const since   = new Date(Date.now() - days * 86400000).toISOString();

  const { data, error } = await supabase
    .from('usage_logs')
    .select('provider, model, success, latency_ms, tokens_in, tokens_out, effort, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false });

  if (error) {
    return res.status(502).json({ error: 'Supabase query failed: ' + error.message });
  }

  const rows         = data || [];
  const total        = rows.length;
  const totalSuccess = rows.filter(function(r) { return r.success; }).length;

  // Per-provider aggregation
  const providerMap = {};
  for (const r of rows) {
    const id = r.provider || 'unknown';
    if (!providerMap[id]) {
      providerMap[id] = {
        requests: 0, successes: 0,
        latency_sum: 0, latency_count: 0,
        tokens_in: 0, tokens_out: 0
      };
    }
    const p = providerMap[id];
    p.requests++;
    if (r.success) p.successes++;
    if (typeof r.latency_ms === 'number') { p.latency_sum += r.latency_ms; p.latency_count++; }
    if (typeof r.tokens_in  === 'number') p.tokens_in  += r.tokens_in;
    if (typeof r.tokens_out === 'number') p.tokens_out += r.tokens_out;
  }

  const providers = Object.keys(providerMap).map(function(id) {
    const p = providerMap[id];
    return {
      provider:       id,
      requests:       p.requests,
      success_rate:   p.requests > 0 ? Math.round(p.successes / p.requests * 100) : 0,
      avg_latency_ms: p.latency_count > 0 ? Math.round(p.latency_sum / p.latency_count) : null,
      tokens_in:      p.tokens_in,
      tokens_out:     p.tokens_out
    };
  });

  return res.status(200).json({
    days:         days,
    total:        total,
    success_rate: total > 0 ? Math.round(totalSuccess / total * 100) : 0,
    providers:    providers,
    recent:       rows.slice(0, 20)
  });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed: expected GET or POST' });
  }

  if (!authenticate(req)) {
    return res.status(401).json({ error: 'Unauthorized: invalid or missing Bearer token' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(503).json({ error: 'Database unavailable: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set' });
  }

  if (req.method === 'POST') return handlePost(req, res, supabase);
  return handleGet(req, res, supabase);
};
