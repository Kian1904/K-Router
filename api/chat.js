const PROVIDERS = [
  {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile'
  },
  {
    name: 'Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    key: process.env.GEMINI_API_KEY,
    model: 'gemini-2.0-flash'
  }
]

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const auth = req.headers.authorization
  if (!auth || auth !== `Bearer ${process.env.BEARER_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { messages, ...rest } = req.body

  for (const provider of PROVIDERS) {
    if (!provider.key) continue

    try {
      const response = await fetch(provider.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${provider.key}`
        },
        body: JSON.stringify({ model: provider.model, messages, ...rest })
      })

      if (!response.ok) {
        console.error(`${provider.name} failed:`, response.status)
        continue
      }

      const data = await response.json()
      data._provider = provider.name
      return res.status(200).json(data)

    } catch (err) {
      console.error(`${provider.name} error:`, err.message)
      continue
    }
  }

  return res.status(503).json({ error: 'All providers failed' })
                    }
