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
  url:'https://integrate.api.nvidia.com/v1/chat/completions',
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
    url : 'https://models.github.ai/inference/chat/completions',
    key: process.env.GITHUB_TOKEN,
    model: 'mistral-ai/mistral-small-2503',
    type: 'openai'
  },

  google_gemini: {
    name: 'Google · Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    key: process.env.GEMINI_API_KEY,
    model: 'gemini-2.5-flash',
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

// Helper: Convert OpenAI format to Google format
function convertToGoogleFormat(messages) {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }))
}

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

  // 1. Tangkap input dari frontend
 let selected = req.body.provider; // Pilihan manual user dari dropdown
 const messages = req.body.messages || [];

 // Ambil pesan terakhir dari user untuk dianalisis
 const lastUserMessage = messages[messages.length - 1]?.content || "";

 // 2. JIKA USER MEMILIH "AUTO", BARULAH LOGIKA PINTAR JALAN
 if (selected === 'auto_router') {
  
  // Deteksi jika user melampirkan file kode (.js, .html, .css, atau ada blok kode ```)
  const isCodingTask = lastUserMessage.includes('.js') || 
                       lastUserMessage.includes('.html') || 
                       lastUserMessage.includes('```javascript') ||
                       /\b(function|const|let|import|export|class)\b/i.test(lastUserMessage);
                       
  // Deteksi jika tugasnya nulis/dokumen/outline/cerita
  const isWritingTask = /\b(outline|dokumen|cerita|artikel|naskah|resume|susun)\b/i.test(lastUserMessage);

  if (isCodingTask) {
    console.log("[Smart Router] Mengarahkan ke Spesialis Coding: NVIDIA NIM DeepSeek/Qwen");
    selected = 'nvidia_deepseek'; // Otomatis lempar ke DeepSeek
  } else if (isWritingTask) {
    console.log("[Smart Router] Mengarahkan ke Spesialis Struktur Dokumen: NVIDIA NIM Nemotron");
    selected = 'nvidia_nemotron'; // Otomatis lempar ke Nemotron
  } else {
    console.log("[Smart Router] Mengarahkan ke Tugas Umum: Groq Llama");
    selected = 'groq'; // Sisanya lempar ke Groq yang super cepat
  }
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
      
      let fetchBody, fetchHeaders, fetchUrl
      
      if (p.type === 'google') {
        // Google Gemini format
        fetchUrl = p.url + '?key=' + p.key
        fetchHeaders = {
          'Content-Type': 'application/json'
        }
        fetchBody = {
          contents: convertToGoogleFormat(messages),
          ...rest
        }
      } else {
        // OpenAI format (default)
        fetchUrl = p.url
        fetchHeaders = {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + p.key
        }
        fetchBody = { model: p.model, messages, ...rest }
      }

      const response = await fetch(fetchUrl, {
        method: 'POST',
        headers: fetchHeaders,
        body: JSON.stringify(fetchBody)
      })

      console.log(`[${p.name}] Response status: ${response.status}`)

      if (!response.ok) {
        const errorBody = await response.text()
        console.error('[' + p.name + '] ' + response.status)
        console.error(errorBody)
        continue
      }

      let data = await response.json()
      
      // Convert Google response to OpenAI format if needed
      if (p.type === 'google') {
        data = convertGoogleResponse(data)
      }
      
      console.log(`[${p.name}] Success! Response keys:`, Object.keys(data))
      data._provider = p.name
      return res.status(200).json(data)

    } catch (err) {
      console.error('[' + p.name + ']', err.message)
    }
  }

  return res.status(503).json({ error: 'All providers failed' })
        }
