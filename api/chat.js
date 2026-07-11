const PROVIDERS = {
  groq: {
    name: 'Groq (Llama)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: process.env.GROQ_API_KEY,
    model: 'llama-3.3-70b-versatile'
  },

  hugging_face: {
    name: 'Hugging Face (GPT)',
    url: 'https://api-inference.huggingface.co/models/openai/gpt-oss-120b',
    key: process.env.HF_TOKEN,
    model: 'openai/gpt-oss-120b'
  },

  nvidia_qwen: {
    name: 'NVIDIA NIM (Qwen)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: 'qwen/qwen3.5-397b-a17b'
  },

  nvidia_deepseek: {
    name: 'NVIDIA NIM (DeepSeek)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: process.env.NVIDIA_API_KEY,
    model: 'deepseek-ai/deepseek-v4-pro'
  },

  nvidia_z_ai: {
  name: 'NVIDIA NIM (GLM)',
  url:'https://integrate.api.nvidia.com/v1/chat/completions',
  key: process.env.NVIDIA_API_KEY,
  model: 'z-ai/glm-5.2'
 },

  kilo: {
    name: 'Kilo Gateway (Claude)',
    url: 'https://api.kilo.ai/api/gateway/chat/completions',
    key: process.env.KILO_API_KEY,
    model: 'anthropic/claude-haiku-4.5'
  },

  openrouter: {
    name: 'OpenRouter (Gemma)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    model: 'google/gemma-4-31b-it:free'
  },

  github_models: {
    name: 'GitHub Models (Mistral)',
    url : 'https://models.github.ai/inference/chat/completions',
    key: process.env.GITHUB_TOKEN,
    model: 'mistral-ai/mistral-small-2503'
  }
}

const CASCADE = [
  'groq',
  'hugging_face',
  'nvidia_qwen',
  'nvidia_deepseek',
  'nvidia_z_ai',
  'kilo',
  'openrouter',
  'github_models'
]

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = req.headers.authorization
  if (auth !== 'Bearer ' + process.env.BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { messages, provider: selected, ...rest } = req.body
  const targets = selected && PROVIDERS[selected] ? [selected] : CASCADE

  for (const id of targets) {
    const p = PROVIDERS[id]
    if (!p || !p.key) {
      console.warn((p ? p.name : id) + ': API key not configured or provider missing')
      continue
    }

    try {
      console.log(`[${p.name}] Attempting request with model: ${p.model}`)
      const response = await fetch(p.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + p.key
        },
        body: JSON.stringify({ model: p.model, messages, ...rest })
      })

      console.log(`[${p.name}] Response status: ${response.status}`)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[' + p.name + '] ' + response.status)
        console.error(errorBody)
        continue
      }

      const data = await response.json()
      console.log(`[${p.name}] Success! Response keys:`, Object.keys(data))
      data._provider = p.name
      return res.status(200).json(data)

    } catch (err) {
      console.error('[' + p.name + ']', err.message)
    }
  }

  return res.status(503).json({ error: 'All providers failed' })
        }
