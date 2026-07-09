const PROVIDERS = [
  {
    id: 'groq',
    name: 'Groq',
    key: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile'
  },
  {
    id: 'flatkey',
    name: 'FlatKey',
    key: 'FLATKEY_API_KEY',
    model: 'gpt-4o-mini'
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    key: 'SAMBANOVA_API_KEY',
    model: 'Meta-Llama-3.3-70B-Instruct'
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    key: 'NVIDIA_API_KEY',
    model: 'openai/gpt-oss-120b'
  },
  {
    id: 'kilo',
    name: 'Kilo Gateway',
    key: 'KILO_API_KEY',
    model: 'anthropic/claude-sonnet-4.6'
  }
]

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  return res.status(200).json({
    providers: PROVIDERS.map(provider => ({
      id: provider.id,
      name: provider.name,
      model: provider.model,
      configured: Boolean(process.env[provider.key])
    })),
    timestamp: new Date().toISOString()
  })
}
