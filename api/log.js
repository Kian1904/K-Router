const { createClient } = require('@supabase/supabase-js')

let supabase = null
const supabaseUrl = process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_KEY

if (supabaseUrl && supabaseKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey)
  } catch (e) {
    console.warn('[Supabase logs] Gagal init client:', e.message)
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (auth !== 'Bearer ' + process.env.BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!supabase) {
    return res.status(503).json({ error: 'Supabase not configured' })
  }

  try {
   const { range = '24h', limit = 50 } = req.query
   const hours = range === '7d' ? 168 : range === '30d' ? 720 : 24
   const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
  
   const { data, error } = await supabase
    .from('usage_logs')
    .select('provider, model, success, latency_ms, tokens_in, tokens_out, created_at, effort') // Tambahin effort di sini biar trackable
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    // Global stats
    const total      = data.length
    const succeeded  = data.filter(r => r.success).length
    const latencies  = data.map(r => r.latency_ms).filter(Boolean)
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null
    const activeProviders = [...new Set(data.filter(r => r.success).map(r => r.provider))]

    // Token aggregation per provider
    const providerMap = {}
    data.forEach(r => {
      const key = r.provider
      if (!providerMap[key]) {
        providerMap[key] = {
          provider: r.provider,
          model: r.model,
          requests: 0,
          success: 0,
          tokensIn: 0,
          tokensOut: 0,
          totalTokens: 0,
          latencies: []
        }
      }
      const p = providerMap[key]
      p.requests++
      if (r.success) p.success++
      p.tokensIn   += r.tokens_in  || 0
      p.tokensOut  += r.tokens_out || 0
      p.totalTokens += (r.tokens_in || 0) + (r.tokens_out || 0)
      if (r.latency_ms) p.latencies.push(r.latency_ms)
    })

    const byProvider = Object.values(providerMap).map(p => ({
      provider:    p.provider,
      model:       p.model,
      requests:    p.requests,
      success:     p.success,
      successRate: p.requests ? Math.round((p.success / p.requests) * 100) : 0,
      tokensIn:    p.tokensIn,
      tokensOut:   p.tokensOut,
      totalTokens: p.totalTokens,
      avgLatency:  p.latencies.length
        ? Math.round(p.latencies.reduce((a, b) => a + b, 0) / p.latencies.length)
        : null
    })).sort((a, b) => b.totalTokens - a.totalTokens)

    // Recent rows
    const { data: recent, error: recentError } = await supabase
      .from('usage_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(Number(limit))

    if (recentError) throw new Error(recentError.message)

    return res.status(200).json({
      range,
      stats: {
        total,
        succeeded,
        failed: total - succeeded,
        successRate: total ? Math.round((succeeded / total) * 100) : 0,
        avgLatency,
        activeProviders,
        totalTokensIn:  data.reduce((a, r) => a + (r.tokens_in  || 0), 0),
        totalTokensOut: data.reduce((a, r) => a + (r.tokens_out || 0), 0)
      },
      byProvider,
      recent
    })
  } catch (err) {
    console.error('[api/logs]', err.message)
    return res.status(500).json({ error: err.message })
  }
        }
