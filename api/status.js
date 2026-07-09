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
    // Verified model identifier: deepseek-ai/deepseek-v4-flash
    // Source: https://build.nvidia.com/deepseek-ai/deepseek-v4-flash/modelcard
    model: 'deepseek-ai/deepseek-v4-pro"'
  },
  {
    id: 'kilo',
    name: 'Kilo Gateway',
    key: 'KILO_API_KEY',
    model: 'anthropic/claude-haiku-4.5'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    key: 'OPENROUTER_API_KEY',
    model: 'google/gemma-4-31b-it:free'
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
