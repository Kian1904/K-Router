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

  openrouter: {
    name: 'OpenRouter (Gemma)',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    model: 'google/gemma-4-31b-it:free',
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
    model: 'gemini-2.5-flash', // Model is specified in URL for this endpoint, but kept for consistency
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
  'openrouter',
  'github_mistral',
  'google_gemini'
]

// Helper: Convert Google response to OpenAI format
function convertGoogleResponse(googleResponse) {
  const aiResponse = googleResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No response'
  return {
    choices: [
      {
        message: {
          role: 'assistant',
          content: aiResponse
        }
      }
    ]
  }
}

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

  // 1. Ambil data req.body secara rapi dari awal tanpa bentrok variabel
  // Filter out `model` and `stream` from `rest` early, as they are handled specifically
  const { messages = [], provider, model, stream, ...rest } = req.body
  let selected = provider

  // Ambil pesan terakhir dari user untuk dianalisis
  const lastUserMessage = messages[messages.length - 1]?.content || ""

  // 2. Logika Pintar (Auto Smart Router)
  if (selected === 'auto_router') {
    let routerDecision = 'GitHub (GPT-4o-mini) (Tugas Umum & Cerdas)'; // Default smart choice
    const lowerCaseMessage = lastUserMessage.toLowerCase();

    // Prioritas routing (dari paling spesifik ke paling umum)

    // Task 1: Coding & Development (DeepSeek is excellent for this)
    const isCodingTask = lowerCaseMessage.includes('.js') || 
                         lowerCaseMessage.includes('.html') || 
                         lowerCaseMessage.includes('.css') ||
                         lowerCaseMessage.includes('.py') ||
                         lowerCaseMessage.includes('.java') ||
                         lowerCaseMessage.includes('