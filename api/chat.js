const PROVIDERS = {
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile'
  },

  flatkey: {
    name: 'FlatKey',
    url: 'https://console.flatkey.ai/v1/chat/completions',
    key: process.env.FLATKEY_API_KEY,
    model: 'gpt-4o-mini'
  },

  sambanova: {
    name: 'SambaNova',
    url: 'https://api.sambanova.ai/v1/chat/completions',
    key: process.env.SAMBANOVA_API_KEY,
    model: 'Meta-Llama-3.3-70B-Instruct'
  },

  nvidia: {
    name: 'NVIDIA NIM',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: 'deepseek-ai/deepseek-v4-flash'
  },

  kilo: {
    name: 'Kilo Gateway',
    url: 'https://api.kilo.ai/api/gateway/chat/completions',
    key: process.env.KILO_API_KEY,
    model: 'anthropic/claude-haiku-4.5'
  },
  
  openrouter: {
    name: 'Open Router',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    model: 'google/gemma-4-31b-it:free'
  }
  
}

const CASCADE = [
  'groq',
  'flatkey',
  'sambanova',
  'nvidia',
  'kilo'
]

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed'
    })
  }

  const auth = req.headers.authorization

  if (auth !== `Bearer ${process.env.BEARER_TOKEN}`) {
    return res.status(401).json({
      error: 'Unauthorized'
    })
  }

  const {
    messages,
    provider: selected,
    ...rest
  } = req.body

  const targets =
    selected && PROVIDERS[selected]
      ? [selected]
      : CASCADE

  for (const id of targets) {

    const p = PROVIDERS[id]

    if (!p.key) {
      console.warn(`${p.name}: API key not configured`)
      continue
    }

    try {

      const response = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${p.key}`
        },
        body: JSON.stringify({
          model: p.model,
          messages,
          ...rest
        })
      })

      if (!response.ok) {

        const errorBody = await response.text()

        console.error(
          `[${p.name}] ${response.status}`
        )

        console.error(errorBody)

        continue
      }

      const data = await response.json()

      data._provider = p.name

      return res.status(200).json(data)

    } catch (err) {

      console.error(
        `[${p.name}]`,
        err
      )

    }

  }

  return res.status(503).json({
    error: 'All providers failed'
  })
}
