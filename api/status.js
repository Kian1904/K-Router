const PROVIDERS = [
  { name: 'Groq', key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  { name: 'Gemini', key: 'GEMINI_API_KEY', model: 'gemini-2.0-flash' }
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
