const PROVIDERS = [
  { id: 'groq', name: 'Groq (Llama)', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  { id: 'flatkey', name: 'FlatKey (GPT-4o Mini)', key: 'FLATKEY_API_KEY', model: 'gpt-4o-mini' },
  { id: 'nvidia_qwen', name: 'NVIDIA NIM (Qwen)', key: 'NVIDIA_API_KEY', model: 'qwen/qwen3.5-397b-a17b' },
  { id: 'nvidia_deepseek', name: 'NVIDIA NIM (DeepSeek)', key: 'NVIDIA_API_KEY', model: 'deepseek-ai/deepseek-v4-pro' },
  { id: 'nvidia_z_ai', name: 'NVIDIA NIM (GLM)', key: 'NVIDIA_API_KEY', model: 'z-ai/glm-5.2' },
  { id: 'kilo', name: 'Kilo Gateway (Claude)', key: 'KILO_API_KEY', model: 'anthropic/claude-haiku-4.5' },
  { id: 'openrouter', name: 'OpenRouter (Gemma)', key: 'OPENROUTER_API_KEY', model: 'google/gemma-4-31b-it:free' },
  { id: 'github_models', name: 'GitHub Models (Mistral)', key: 'GITHUB_TOKEN', model: 'mistral-ai/mistral-small-2503' }
]

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Content-Type', 'application/json')

  return res.status(200).json({
    providers: PROVIDERS.map(p => ({
      id: p.id,
      name: p.name,
      model: p.model,
      configured: Boolean(process.env[p.key])
    })),
    timestamp: new Date().toISOString()
  })
}
