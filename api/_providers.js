// api/_providers.js

const PROVIDERS = {
  cohere_north: {
    name: 'Cohere · North Mini Code',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: 'OPENROUTER_API_KEY',
    model: 'cohere/north-mini-code:free',
    type: 'openai',
    isRedflag: false
  },
  nvidia_phi4: {
    name: 'NVIDIA NIM (Phi-4 Mini)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: 'NVIDIA_API_KEY',
    model: 'microsoft/phi-4-mini-instruct',
    type: 'openai',
    isRedflag: false
  },
  nvidia_minimax: {
    name: 'NVIDIA NIM (MiniMax M2.7)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: 'NVIDIA_API_KEY',
    model: 'minimax/m2.7-chat',
    type: 'openai',
    isRedflag: false
  },
  nvidia_deepseek_flash: {
    name: 'NVIDIA NIM (DeepSeek V4 Flash)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: 'NVIDIA_API_KEY',
    model: 'deepseek-ai/deepseek-v4-flash',
    type: 'openai',
    isRedflag: false
  },
  laguna_xs: {
    name: 'Poolside · Laguna XS 2.1',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: 'OPENROUTER_API_KEY',
    model: 'poolside/laguna-xs-2.1:free',
    type: 'openai',
    isRedflag: true,
    redflagReason: 'Volatile infrastructure / Nvidia NIM scale risk'
  },
  laguna_m1: {
    name: 'Poolside · Laguna M.1',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: 'OPENROUTER_API_KEY',
    model: 'poolside/laguna-m.1:free',
    type: 'openai',
    isRedflag: true,
    redflagReason: 'Unstable response / Volatile free tier session'
  },
  groq: {
    name: 'Groq (Llama)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    type: 'openai'
  },
  nvidia_deepseek: {
    name: 'NVIDIA NIM (DeepSeek V4 Pro)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: 'NVIDIA_API_KEY',
    model: 'deepseek-ai/deepseek-v4-pro',
    type: 'openai',
    isRedflag: false
  },
  github_gpt: {
    name: 'GitHub (GPT)',
    url: 'https://models.github.ai/inference/chat/completions',
    key: 'GITHUB_TOKEN',
    model: 'openai/gpt-4o-mini',
    type: 'openai'
  },
  nvidia_z_ai: {
    name: 'NVIDIA NIM (GLM)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: 'NVIDIA_API_KEY',
    model: 'z-ai/glm-5.2',
    type: 'openai'
  },
  kilo: {
    name: 'Kilo Gateway (Claude)',
    url: 'https://api.kilo.ai/api/gateway/chat/completions',
    key: 'KILO_API_KEY',
    model: 'anthropic/claude-haiku-4.5',
    type: 'openai'
  },
  cerebras: {
    name: 'Cerebras (Gemma)',
    url: 'https://api.cerebras.ai/v1/chat/completions',
    key: 'CEREBRAS_API_KEY',
    model: 'google/gemma-4-31B-it',
    type: 'openai'
  },
  github_mistral: {
    name: 'GitHub Models (Mistral)',
    url: 'https://models.github.ai/inference/chat/completions',
    key: 'GITHUB_TOKEN',
    model: 'mistral-ai/mistral-small-2503',
    type: 'openai'
  },
  google_gemini: {
    name: 'Google · Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    key: 'GEMINI_API_KEY',
    model: 'gemini-2.5-flash',
    type: 'google'
  }
};

const CASCADE = Object.keys(PROVIDERS);

module.exports = { PROVIDERS, CASCADE };
