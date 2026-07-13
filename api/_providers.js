// api/_providers.js

const PROVIDERS = {
  groq: {
    name: 'Groq (Llama)',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    key: 'GROQ_API_KEY',
    model: 'llama-3.3-70b-versatile',
    type: 'openai'
  },
  github_gpt: {
    name: 'GitHub (GPT)',
    url: 'https://models.github.ai/inference/chat/completions',
    key: 'GITHUB_TOKEN',
    model: 'openai/gpt-4o-mini',
    type: 'openai'
  },
  qwen_plus: {
    name: 'Qwen 3.7 (Plus)',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    key: 'DASHSCOPE_API_KEY',
    model: 'qwen3.7-plus',
    type: 'alibaba'
  },
  qwen_max: {
    name: 'Qwen 3.7 (Max)',
    url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions',
    key: 'DASHSCOPE_API_KEY',
    model: 'qwen3.7-max',
    type: 'alibaba'
  },
  nvidia_deepseek: {
    name: 'NVIDIA NIM (DeepSeek)',
    url: 'https://integrate.api.nvidia.com/v1/chat/completions',
    key: 'NVIDIA_API_KEY',
    model: 'deepseek-ai/deepseek-v4-pro',
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

// Menghasilkan array otomatis berisi semua key di atas untuk fallback system
const CASCADE = Object.keys(PROVIDERS);

module.exports = { PROVIDERS, CASCADE };
