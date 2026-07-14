// api/status.js
const { PROVIDERS } = require('./_providers');

// Base domain unik per provider group
// Satu ping = cover semua provider yang share domain yang sama
const PING_TARGETS = [
  { domain: 'openrouter.ai',                    url: 'https://openrouter.ai/api/v1/models' },
  { domain: 'integrate.api.nvidia.com',         url: 'https://integrate.api.nvidia.com' },
  { domain: 'api.groq.com',                     url: 'https://api.groq.com' },
  { domain: 'models.github.ai',                 url: 'https://models.github.ai' },
  { domain: 'api.kilo.ai',                      url: 'https://api.kilo.ai' },
  { domain: 'api.cerebras.ai',                  url: 'https://api.cerebras.ai' },
  { domain: 'generativelanguage.googleapis.com',url: 'https://generativelanguage.googleapis.com' }
];

async function pingDomain(target, timeoutMs = 6000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    await fetch(target.url, {
      method: 'GET',
      signal: controller.signal,
      // No auth — pure connectivity check
    });
    clearTimeout(timeoutId);
    return { domain: target.domain, up: true, latencyMs: Date.now() - start };
  } catch (err) {
    clearTimeout(timeoutId);
    const isTimeout = err.name === 'AbortError';
    return {
      domain: target.domain,
      up: false,
      latencyMs: isTimeout ? timeoutMs : Date.now() - start,
      reason: isTimeout ? 'timeout' : err.message
    };
  }
}

function getDomain(url) {
  try { return new URL(url).hostname; } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // Ping semua domain paralel
  const pingResults = await Promise.all(PING_TARGETS.map(t => pingDomain(t)));

  // Map jadi { domain: result }
  const pingMap = {};
  for (const r of pingResults) pingMap[r.domain] = r;

  // Attach ping result ke tiap provider
  const providers = Object.entries(PROVIDERS).map(([id, p]) => {
    const domain = getDomain(p.url);
    const ping = pingMap[domain] || { up: null, latencyMs: null };
    return {
      id,
      name: p.name,
      model: p.model,
      configured: Boolean(process.env[p.key]),
      up: ping.up,
      latencyMs: ping.latencyMs,
      isRedflag: p.isRedflag || false,
      redflagReason: p.redflagReason || null
    };
  });

  return res.status(200).json({
    providers,
    pingedAt: new Date().toISOString()
  });
};
