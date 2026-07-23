'use strict';

const Sentry = require('./_sentry');

const TAVILY_ENDPOINT  = 'https://api.tavily.com/search';
const SEARCH_TIMEOUT_MS = 10000;

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Search unavailable: TAVILY_API_KEY not set' });
  }

  const body  = req.body || {};
  const query = (typeof body.query === 'string' ? body.query : '').trim();

  if (!query) {
    return res.status(400).json({ error: 'Bad request: query must be a non-empty string' });
  }

  const controller = new AbortController();
  const timer = setTimeout(function() { controller.abort(); }, SEARCH_TIMEOUT_MS);

  try {
    const tavilyRes = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key:        apiKey,
        query:          query,
        search_depth:   'basic',
        include_answer: true,
        max_results:    5
      }),
      signal: controller.signal
    });

    if (!tavilyRes.ok) {
      const text = await tavilyRes.text().catch(function() { return ''; });
      return res.status(502).json({
        error:  'Tavily error: HTTP ' + tavilyRes.status,
        detail: text.slice(0, 200)
      });
    }

    const data = await tavilyRes.json();

    return res.status(200).json({
      query:   query,
      answer:  data.answer || null,
      results: (data.results || []).map(function(r) {
        return {
          title:   r.title   || '',
          url:     r.url     || '',
          content: r.content || '',
          score:   typeof r.score === 'number' ? r.score : 0
        };
      })
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        error: 'Search timeout: Tavily did not respond within ' + SEARCH_TIMEOUT_MS + 'ms'
      });
    }
    return res.status(500).json({ error: 'Search failed: ' + err.message });
  } finally {
    clearTimeout(timer);
  }
};
