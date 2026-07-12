const PROVIDERS = {
  groq: {
    name: 'Groq (Llama)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile',
    type: 'openai'
  },

  github_gpt: {
    name: 'GitHub (GPT)',
    url: 'https://models.github.ai/inference/chat/completions',
    key: process.env.GITHUB_TOKEN,
    model: 'openai/gpt-4o-mini',
    type: 'openai'
  },

  nvidia_qwen: {
    name: 'NVIDIA NIM (Qwen)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: 'qwen/qwen3.5-397b-a17b',
    type: 'openai'
  },

  nvidia_deepseek: {
    name: 'NVIDIA NIM (DeepSeek)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: 'deepseek-ai/deepseek-v4-pro',
    type: 'openai'
  },

  nvidia_z_ai: {
    name: 'NVIDIA NIM (GLM)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: 'z-ai/glm-5.2',
    type: 'openai'
  },

  kilo: {
    name: 'Kilo Gateway (Claude)',
    url: 'https://api.kilo.ai/api/gateway/chat/completions',
    key: process.env.KILO_API_KEY,
    model: 'anthropic/claude-haiku-4.5',
    type: 'openai'
  },

  cerebras: {
    name: 'Cerebras (Gemma)',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: process.env.CEREBRAS_API_KEY,
    model: 'gemma-4-31b',
    type: 'openai'
  },

  github_mistral: {
    name: 'GitHub (Mistral)',
    url: 'https://models.github.ai/inference/chat/completions',
    key: process.env.GITHUB_TOKEN,
    model: 'mistral-ai/mistral-small-2503',
    type: 'openai'
  },

  google_gemini: {
    name: 'Google · Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    key: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
    type: 'google'
  }
}

const CASCADE = [
  'groq',
  'github_gpt',
  'nvidia_qwen',
  'nvidia_deepseek',
  'nvidia_z_ai',
  'kilo',
  'cerebras',
  'github_mistral',
  'google_gemini'
]

// Effort → temperature + max_tokens
const EFFORT_MAP = {
  low:    { temperature: 0.3, max_tokens: 1024 },
  medium: { temperature: 0.7, max_tokens: 2048 },
  high:   { temperature: 1.0, max_tokens: 4096 }
}

// ── Supabase logger (fire-and-forget, gak block response) ──
async function logUsage({ provider, model, effort, thinking, tokensIn, tokensOut, latencyMs, success, errorMsg }) {
  try {
    const { data, error } = await supabase.from('usage_logs').insert([{
      provider: provider || 'unknown',
      model: model || 'unknown',
      effort: effort || 'medium',
      thinking: Boolean(thinking), // Paksa jadi true/false asli
      tokens_in: tokensIn ? parseInt(tokensIn) : null,
      tokens_out: tokensOut ? parseInt(tokensOut) : null,
      latency_ms: latencyMs ? parseInt(latencyMs) : null,
      success: success === undefined ? true : Boolean(success),
      error_msg: errorMsg || null
    }]);

    if (error) {
      // Ini bakal nampilin eror asli dari Supabase di log Vercel lo!
      console.error('Supabase Database Error:', error.message, error.details);
    }
  } catch (err) {
    console.error('Supabase log exception:', err.message);
  }
}

{
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return // skip kalau env belum diset

  try {
    await fetch(`${url}/rest/v1/usage_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        provider,
        model,
        effort: effort || 'medium',
        thinking: !!thinking,
        tokens_in:  tokensIn  || null,
        tokens_out: tokensOut || null,
        latency_ms: latencyMs || null,
        success,
        error_msg: errorMsg || null
      })
    })
  } catch (err) {
    console.warn('[Supabase logger] Failed to log usage:', err.message)
  }
}

// ── Format converters (Google ↔ OpenAI) ──
function convertToGoogleFormat(messages) {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))
}

function convertGoogleResponse(googleResponse) {
  const text = googleResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
  const meta = googleResponse.usageMetadata || {}
  return {
    choices: [{ message: { role: 'assistant', content: text } }],
    usage: {
      prompt_tokens:     meta.promptTokenCount     || null,
      completion_tokens: meta.candidatesTokenCount || null
    }
  }
}

// ── Main handler ──
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (auth !== 'Bearer ' + process.env.BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { messages = [], provider, effort = 'medium', thinking = false, stream, ...rest } = req.body
  let selected = provider

  const lastUserMessage = messages[messages.length - 1]?.content || ''

  // Auto Smart Router
  if (selected === 'auto_router') {
    const isCodingTask = lastUserMessage.includes('.js') ||
                         lastUserMessage.includes('.html') ||
                         lastUserMessage.includes('```javascript') ||
                         /\b(function|const|let|import|export|class)\b/i.test(lastUserMessage)

    const isWritingTask = /\b(outline|dokumen|cerita|artikel|naskah|resume|susun)\b/i.test(lastUserMessage)

    if (isCodingTask) {
      console.log('[Smart Router] → NVIDIA DeepSeek (coding)')
      selected = 'nvidia_deepseek'
    } else if (isWritingTask) {
      console.log('[Smart Router] → Google Gemini (writing)')
      selected = 'google_gemini'
    } else {
      console.log('[Smart Router] → Groq Llama (general)')
      selected = 'groq'
    }
  }

  const targets = selected && PROVIDERS[selected] ? [selected] : CASCADE
  const effortParams = EFFORT_MAP[effort] || EFFORT_MAP.medium

  for (const id of targets) {
    const p = PROVIDERS[id]
    if (!p || !p.key) {
      console.warn((p ? p.name : id) + ': API key not configured or provider missing')
      continue
    }

    const startTime = Date.now()

    try {
      console.log(`[${p.name}] Attempting — effort: ${effort}, thinking: ${thinking}`)

      let fetchBody, fetchHeaders, fetchUrl

      if (p.type === 'google') {
        fetchUrl = p.url + '?key=' + p.key
        fetchHeaders = { 'Content-Type': 'application/json' }

        fetchBody = {
          contents: convertToGoogleFormat(messages),
          generationConfig: {
            temperature:      effortParams.temperature,
            maxOutputTokens:  effortParams.max_tokens,
            ...(rest.temperature  !== undefined ? { temperature:     rest.temperature  } : {}),
            ...(rest.max_tokens   !== undefined ? { maxOutputTokens: rest.max_tokens   } : {})
          }
        }
      } else {
        fetchUrl = p.url
        fetchHeaders = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + p.key
        }

        fetchBody = {
          model:    p.model,
          messages,
          stream:   false,
          temperature: effortParams.temperature,
          max_tokens:  effortParams.max_tokens,
          ...rest
        }

        // Extended thinking — hanya untuk Kilo (Claude) karena anthropic-compatible
        if (thinking && id === 'kilo') {
          fetchBody.thinking = { type: 'enabled', budget_tokens: 5000 }
          // Thinking butuh temperature 1 dan max_tokens besar
          fetchBody.temperature = 1
          fetchBody.max_tokens  = Math.max(fetchBody.max_tokens, 8000)
        }
      }

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(fetchBody)
      })

      const latencyMs = Date.now() - startTime
      console.log(`[${p.name}] Status: ${response.status} — ${latencyMs}ms`)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error(`[${p.name}] ${response.status}:`, errorBody)

        logUsage({
          provider: p.name, model: p.model,
          effort, thinking, latencyMs,
          success: false, errorMsg: `HTTP ${response.status}`
        })
        continue
      }

      let data = await response.json()

      if (p.type === 'google') {
        data = convertGoogleResponse(data)
      }

      const tokensIn  = data.usage?.prompt_tokens     || null
      const tokensOut = data.usage?.completion_tokens  || null

      // Log ke Supabase (non-blocking)
      logUsage({
        provider: p.name, model: p.model,
        effort, thinking,
        tokensIn, tokensOut, latencyMs,
        success: true
      })

      console.log(`[${p.name}] OK — in: ${tokensIn}, out: ${tokensOut}, ${latencyMs}ms`)

      data._provider  = p.name
      data._model     = p.model
      data._latencyMs = latencyMs
      data._effort    = effort
      data._thinking  = thinking

      return res.status(200).json(data)

    } catch (err) {
      const latencyMs = Date.now() - startTime
      console.error(`[${p.name}]`, err.message)

      logUsage({
        provider: p.name, model: p.model,
        effort, thinking, latencyMs,
        success: false, errorMsg: err.message
      })
    }
  }

  return res.status(503).json({ error: 'All providers failed' })
}
