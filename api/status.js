const PROVIDERS = [
  { id: 'groq', name: 'Groq', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  { id: 'flatkey', name: 'FlatKey', key: 'FLATKEY_API_KEY', model: 'gpt-4o-mini' },
  { id: 'nvidia_qwen', name: 'NVIDIA NIM (Qwen)', key: 'NVIDIA_API_KEY', model: 'qwen/qwen3.5-397b-a17b' },
  { id: 'nvidia_deepseek', name: 'NVIDIA NIM (DeepSeek)', key: 'NVIDIA_API_KEY', model: 'deepseek-ai/deepseek-v4-pro' },
  { id: 'nvidia_z_ai', name: 'NVIDIA NIM (Z.ai)', key: 'NVIDIA_API_KEY', model: 'z-ai/glm-5.2' },
  { id: 'kilo', name: 'Kilo Gateway', key: 'KILO_API_KEY', model: 'anthropic/claude-haiku-4.5' },
  { id: 'openrouter', name: 'OpenRouter', key: 'OPENROUTER_API_KEY', model: 'google/gemma-4-31b-it:free' }
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
