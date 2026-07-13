// api/chat.js
const { createClient } = require('@supabase/supabase-js');
// Import data Master Terpusat
const { PROVIDERS, CASCADE } = require('./_providers');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const EFFORT_MAP = {
  low:    { temperature: 0.3, max_tokens: 1024 },
  medium: { temperature: 0.7, max_tokens: 2048 },
  high:   { temperature: 1.0, max_tokens: 4096 }
};

async function logUsage({ provider, model, effort, thinking, tokensIn, tokensOut, latencyMs, success, errorMsg }) {
  try {
    const { error } = await supabase.from('usage_logs').insert([{
      provider, model, effort, thinking,
      tokens_in: tokensIn, tokens_out: tokensOut,
      latency_ms: latencyMs, success, error_msg: errorMsg
    }]);
    if (error) console.error('Supabase Error:', error.message);
  } catch (err) {
    console.error('Log Failed:', err.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: "Method not allowed" });

  const { provider, messages, input } = req.body || {};
  const userToken = req.headers.authorization;

  // Validasi token internal aplikasi lo
  if (!userToken || userToken === "Bearer null" || userToken.trim() === "") {
    return res.status(401).json({ error: "Akses ditolak." });
  }

  const userPrompt = input || messages[messages.length - 1]?.content || "";

  // ========================================================
  // RUTE 1: JALUR KHUSUS PABRIK QWEN (ALIBABA DASHSCOPE)
  // ========================================================
  if (provider === 'qwen3.7-plus' || provider === 'qwen3.7-max') {
    try {
      const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`
        },
        body: JSON.stringify({
          model: provider,
          messages: [{ role: "user", content: userPrompt }],
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error(`DashScope gagal: ${response.status}`);
      const data = await response.json();
      
      return res.status(200).json({
        _provider: provider,
        choices: [{ message: { role: "assistant", content: data.choices[0].message.content } }]
      });
    } catch (err) {
      return res.status(500).json({ error: `Pabrik Qwen Error: ${err.message}` });
    }
  }

  // ========================================================
  // RUTE 2: JALUR KHUSUS PABRIK DEEPSEEK RESMI
  // ========================================================
  if (provider === 'deepseek-chat' || provider === 'deepseek-reasoning') {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}` // Kunci rahasia dari platform DeepSeek lo
        },
        body: JSON.stringify({
          model: provider, // 'deepseek-chat' (V3) atau 'deepseek-reasoning' (R1)
          messages: [{ role: "user", content: userPrompt }],
          temperature: provider === 'deepseek-reasoning' ? 0.6 : 0.7 // R1 butuh temp sedikit lebih rendah biar stabil
        })
      });

      if (!response.ok) throw new Error(`DeepSeek gagal: ${response.status}`);
      const data = await response.json();
      
      // Ambil teks chat reguler dan simpan teks reasoning (berpikir) jika ada (khusus R1)
      const replyContent = data.choices[0].message.content;
      const reasoningContent = data.choices[0].message.reasoning_content || "";

      return res.status(200).json({
        _provider: provider,
        choices: [{ 
          message: { 
            role: "assistant", 
            content: replyContent,
            reasoning_content: reasoningContent // Langsung dioper ke UI balok <think> lo
          } 
        }]
      });
    } catch (err) {
      return res.status(500).json({ error: `Pabrik DeepSeek Error: ${err.message}` });
    }
  }

  // ========================================================
  // JALUR LAMA LO: (Auto Router / Nvidia / GitHub GPT, dll)
  // ========================================================
  // ... Tempel sisa kode penanganan lama lo di sini ...
                                   }

function convertToGoogleFormat(messages) {
  return messages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  }));
}

function convertGoogleResponse(googleResponse) {
  const text = googleResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
  const meta = googleResponse.usageMetadata || {};
  return {
    choices: [{ message: { role: 'assistant', content: text } }],
    usage: {
      prompt_tokens:     meta.promptTokenCount     || null,
      completion_tokens: meta.candidatesTokenCount || null
    }
  };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers.authorization;
  if (auth !== 'Bearer ' + process.env.BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messages = [], provider, effort = 'medium', thinking = false, ...rest } = req.body;
  let selected = provider;
  const lastUserMessage = messages[messages.length - 1]?.content || '';

  // Smart Auto Routing Engine
  if (selected === 'auto_router' || !selected) {
    const isCodingTask = lastUserMessage.includes('.js') || lastUserMessage.includes('.html') || lastUserMessage.includes('```') || /\b(function|const|let|class)\b/i.test(lastUserMessage);
    const isWritingTask = /\b(outline|dokumen|cerita|artikel|naskah|resume)\b/i.test(lastUserMessage);

    if (isCodingTask) selected = 'nvidia_deepseek';
    else if (isWritingTask) selected = 'google_gemini';
    else selected = 'groq';
  }

  const targets = selected && PROVIDERS[selected] ? [selected] : CASCADE;
  const effortParams = EFFORT_MAP[effort] || EFFORT_MAP.medium;

  for (const id of targets) {
    const p = PROVIDERS[id];
    if (!p) continue;
    
    // Ambil nilai token env secara dinamis dari file master
    const apiKey = process.env[p.key];
    if (!apiKey) {
      console.warn(`[${p.name}] API key (${p.key}) blm di-set di env.`);
      continue;
    }

    const startTime = Date.now();

    try {
      let fetchBody, fetchHeaders, fetchUrl;

      if (p.type === 'google') {
        fetchUrl = p.url + '?key=' + apiKey;
        fetchHeaders = { 'Content-Type': 'application/json' };
        fetchBody = {
          contents: convertToGoogleFormat(messages),
          generationConfig: {
            temperature:     effortParams.temperature,
            maxOutputTokens: effortParams.max_tokens,
            ...(rest.temperature !== undefined ? { temperature: rest.temperature } : {}),
            ...(rest.max_tokens !== undefined ? { maxOutputTokens: rest.max_tokens } : {})
          }
        };
      } else {
        fetchUrl = p.url;
        fetchHeaders = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey };
        fetchBody = {
          model: p.model, messages, stream: false,
          temperature: effortParams.temperature, max_tokens: effortParams.max_tokens,
          ...rest
        };

        // Kilo (Claude) Reasoning budget token integration
        if (thinking && id === 'kilo') {
          fetchBody.thinking = { type: 'enabled', budget_tokens: 5000 };
          fetchBody.temperature = 1;
          fetchBody.max_tokens = Math.max(fetchBody.max_tokens, 8000);
        }
      }

      const response = await fetch(fetchUrl, { method: 'POST', headers: fetchHeaders, body: JSON.stringify(fetchBody) });
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text();
        await logUsage({ provider: p.name, model: p.model, effort, thinking, latencyMs, success: false, errorMsg: `HTTP ${response.status}` });
        continue;
      }

      let data = await response.json();
      if (p.type === 'google') data = convertGoogleResponse(data);

      const tokensIn  = data.usage?.prompt_tokens || null;
      const tokensOut = data.usage?.completion_tokens || null;

      await logUsage({ provider: p.name, model: p.model, effort, thinking, tokensIn, tokensOut, latencyMs, success: true });

      data._provider  = p.name;
      data._model     = p.model;
      data._latencyMs = latencyMs;
      data._effort    = effort;
      data._thinking  = thinking;

      return res.status(200).json(data);
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      await logUsage({ provider: p.name, model: p.model, effort, thinking, latencyMs, success: false, errorMsg: err.message });
    }
  }

  return res.status(503).json({ error: 'All providers failed' });
};
