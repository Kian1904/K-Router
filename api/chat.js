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

// MENGGUNAKAN SATU EXPORT HANDLER UTAMA AGAR TIDAK TABRAKAN
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // 1. Validasi Token Gerbang Keamanan K's Router
  const auth = req.headers.authorization;
  if (!auth || auth !== 'Bearer ' + process.env.BEARER_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messages = [], provider, effort = 'medium', thinking = false, input, ...rest } = req.body;
  const lastUserMessage = input || messages[messages.length - 1]?.content || '';
  const effortParams = EFFORT_MAP[effort] || EFFORT_MAP.medium;
  const startTime = Date.now();

// ========================================================
  // JALUR KHUSUS 1: LANGSUNG KE PABRIK QWEN ALIBABA
  // ========================================================
  if (provider === 'qwen_max' || provider === 'qwen_plus' || provider === 'qwen3.7-max' || provider === 'qwen3.7-plus') {
    try {
      let targetModel = provider;
      if (provider === 'qwen_max') targetModel = 'qwen3.7-max';
      if (provider === 'qwen_plus') targetModel = 'qwen3.7-plus';

      // TAKTIK AMAN: Pastikan array messages tidak kosong. Jika kosong, buatkan fallback.
      const formattedMessages = messages && messages.length > 0 
        ? messages 
        : [{ role: "user", content: lastUserMessage || "Hi" }];

      const response = await fetch("https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`
        },
        body: JSON.stringify({
          model: targetModel,
          messages: formattedMessages, // 🌟 Mengirim seluruh riwayat chat yang valid
          temperature: effortParams.temperature,
          max_tokens: effortParams.max_tokens
        })
      });

      const latencyMs = Date.now() - startTime;
      
      // Jika server pabrik ngasih eror, tangkap detail teks erornya buat debugging
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`DashScope HTTP ${response.status}: ${errText}`);
      }

      const data = await response.json();
      const reply = data.choices[0].message.content;

      await logUsage({ provider: 'Qwen Factory', model: targetModel, effort, thinking, latencyMs, success: true });

      return res.status(200).json({
        _provider: 'Qwen Factory',
        _model: targetModel,
        _latencyMs: latencyMs,
        choices: [{ message: { role: "assistant", content: reply } }]
      });
    } catch (err) {
      console.error("Detail Eror Pabrik Qwen:", err.message);
      const latencyMs = Date.now() - startTime;
      await logUsage({ provider: 'Qwen Factory', model: provider, effort, thinking, latencyMs, success: false, errorMsg: err.message });
      // Jika gagal, biarkan merosot ke engine cascade di bawah
    }
  }

  // ========================================================
  // JALUR KHUSUS 2: LANGSUNG KE PABRIK DEEPSEEK RESMI
  // ========================================================
  if (provider === 'deepseek-chat' || provider === 'deepseek-reasoning') {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: provider,
          messages: [{ role: "user", content: lastUserMessage }],
          temperature: provider === 'deepseek-reasoning' ? 0.6 : effortParams.temperature
        })
      });

      const latencyMs = Date.now() - startTime;
      if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status}`);

      const data = await response.json();
      const reply = data.choices[0].message.content;
      const reasoning = data.choices[0].message.reasoning_content || "";

      await logUsage({ provider: 'DeepSeek Factory', model: provider, effort, thinking, latencyMs, success: true });

      return res.status(200).json({
        _provider: 'DeepSeek Factory',
        _model: provider,
        _latencyMs: latencyMs,
        choices: [{ 
          message: { 
            role: "assistant", 
            content: reply,
            reasoning_content: reasoning 
          } 
        }]
      });
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      await logUsage({ provider: 'DeepSeek Factory', model: provider, effort, thinking, latencyMs, success: false, errorMsg: err.message });
      // Jika pabrik eror, biarkan dia lolos ke sistem cascade di bawahnya
    }
  }

  // ========================================================
  // ENGINE UTAMA: AUTO ROUTING & FALLBACK SYSTEM (CASCADE)
  // ========================================================
  let selected = provider;
  if (selected === 'auto_router' || !selected) {
    const isCodingTask = lastUserMessage.includes('.js') || lastUserMessage.includes('.html') || lastUserMessage.includes('```') || /\b(function|const|let|class)\b/i.test(lastUserMessage);
    const isWritingTask = /\b(outline|dokumen|cerita|artikel|naskah|resume)\b/i.test(lastUserMessage);

    if (isCodingTask) selected = 'nvidia_deepseek';
    else if (isWritingTask) selected = 'google_gemini';
    else selected = 'groq';
  }

  const targets = selected && PROVIDERS[selected] ? [selected] : CASCADE;

  for (const id of targets) {
    const p = PROVIDERS[id];
    if (!p) continue;
    
    const apiKey = process.env[p.key];
    if (!apiKey) {
      console.warn(`[${p.name}] API key (${p.key}) blm di-set di env.`);
      continue;
    }

    const startLoopTime = Date.now();

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

        if (thinking && id === 'kilo') {
          fetchBody.thinking = { type: 'enabled', budget_tokens: 5000 };
          fetchBody.temperature = 1;
          fetchBody.max_tokens = Math.max(fetchBody.max_tokens, 8000);
        }
      }

      const response = await fetch(fetchUrl, { method: 'POST', headers: fetchHeaders, body: JSON.stringify(fetchBody) });
      const latencyMs = Date.now() - startLoopTime;

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
      const latencyMs = Date.now() - startLoopTime;
      await logUsage({ provider: p.name, model: p.model, effort, thinking, latencyMs, success: false, errorMsg: err.message });
    }
  }

  return res.status(503).json({ error: 'All providers failed' });
};
