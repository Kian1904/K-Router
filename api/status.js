const PROVIDERS = [
  {
    name: 'Groq',
    key: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile'
  },
  {
    name: 'FlatKey',
    key: 'FLATKEY_API_KEY',
    model: 'gpt-4o-mini'
  },
  {
    name: 'SambaNova',
    key: 'SAMBANOVA_API_KEY',
    model: 'Meta-Llama-3.3-70B-Instruct'
  },
  {
    name: 'NVIDIA NIM',
    key: 'NVIDIA_API_KEY',
    model: 'openai/gpt-oss-120b'
  },
  {
    name: 'Kilo Gateway',
    key: 'KILO_API_KEY',
    model: 'anthropic/claude-sonnet-4.5'
  }
]

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  const providers = PROVIDERS.map(p => ({
    name: p.name,
    model: p.model,
    configured: !!process.env[p.key]
  }))
  return res.status(200).json({ providers, timestamp: new Date().toISOString() })
}
