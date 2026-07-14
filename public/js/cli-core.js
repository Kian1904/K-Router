const outputEl = document.getElementById('terminal-output');
const inputEl = document.getElementById('terminal-input');
const promptLabel = document.getElementById('prompt-label');

let token = localStorage.getItem('kr_token') || '';
let selectedModelId = 'auto_router';
let currentEffort = localStorage.getItem('kr_default_effort') || 'medium';

function printLine(text, className = '') {
  const div = document.createElement('div');
  div.className = `line ${className}`;
  div.innerText = text;
  outputEl.appendChild(div);
  outputEl.scrollTop = outputEl.scrollHeight;
}

async function handleCommand(rawInput) {
  const trimInput = rawInput.trim();
  if (!trimInput) return;

  printLine(`${promptLabel.innerText} ${trimInput}`, 'cmd-line');

  // Wajib pakai slash '/' di awal (Slash Command Protocol)
  if (!trimInput.startsWith('/')) {
    printLine(`Error: Perintah harus diawali tanda '/'. Contoh: /help atau /chat halo`, 'error-msg');
    return;
  }

  const args = trimInput.split(' ');
  const command = args[0].toLowerCase(); // Hasilnya jadi: /help, /chat, /search, dll

  if (['/dashboard', '/analytics', '/models', '/chat', '/search'].includes(command) && !token) {
    printLine("Error: Akses ditolak. Jalankan perintah: /auth [TOKEN_LO]", "error-msg");
    return;
  }

  switch(command) {
    case '/clear':
      outputEl.innerHTML = '';
      break;

    case '/help':
      printLine('===================== K-ROUTER COMMAND LIST =====================');
      printLine('  /help                     Tampilkan panduan ini');
      printLine('  /clear                    Bersihkan monitor terminal');
      printLine('  /auth [Token]             Input token keamanan gerbang router');
      printLine('  /models                   List semua model terkelompok');
      printLine('  /use [model_id]           Kunci chat ke model tertentu');
      printLine('  /effort [low/medium/high] Ubah alokasi konsumsi token target');
      printLine('  /chat [prompt]            Kirim pesan ke AI');
      printLine('  /search [query]           Cari info real-time via Tavily');
      printLine('  /dashboard                Tarik data log performa global');
      printLine('  /analytics                Tampilkan distribusi token');
      printLine('=================================================================');
      break;

    case '/auth':
      if (!args[1]) {
        printLine('Error: Token wajib diisi. Contoh: /auth token_123', 'error-msg');
      } else {
        token = args[1];
        localStorage.setItem('kr_token', token);
        printLine('Success: Token berhasil diverifikasi dan disimpan!', 'sys-greet');
      }
      break;

    case '/effort':
      const targetEffort = args[1]?.toLowerCase();
      if (!['low', 'medium', 'high'].includes(targetEffort)) {
        printLine('Error: Pilihan effort tidak valid. Gunakan low, medium, atau high.', 'error-msg');
        return;
      }
      currentEffort = targetEffort;
      localStorage.setItem('kr_default_effort', currentEffort);
      printLine(`Success: Level konsumsi token diubah menjadi [${currentEffort.toUpperCase()}].`, 'sys-greet');
      break;

    case '/models':
      printLine('Fetching and structuralizing models tree layout...');
      try {
        const res = await fetch('/api/status', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        renderModelsTree(data.providers || [], selectedModelId);
      } catch(err) {
        printLine(`Failed to cluster models: ${err.message}`, 'error-msg');
      }
      break;

    case '/use':
      const targetId = args[1];
      if (!targetId) {
        printLine('Error: Masukkan ID model. Contoh: /use google_gemini', 'error-msg');
        return;
      }
      if (targetId === 'auto_router') {
        selectedModelId = 'auto_router';
        promptLabel.innerText = `krouter_cli[auto_router]:~$`;
        printLine('Success: Jalur dikembalikan ke Auto Router default.', 'sys-greet');
        return;
      }
      selectedModelId = targetId;
      promptLabel.innerText = `krouter_cli[${targetId}]:~$`;
      printLine(`Success: Sesi terkunci ke model [${targetId}].`, 'info-msg');
      break;

    case '/search':
      const query = args.slice(1).join(' ');
      if (!query) {
        printLine('Error: Masukkan kata kunci. Contoh: /search harga bitcoin hari ini', 'error-msg');
        return;
      }
      
      printLine(`Tavily Engine: Menelusuri web untuk "${query}"...`);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ query })
        });

        if (!res.ok) throw new Error(`Server failure ${res.status}`);
        const data = await res.json();
        
        printLine(`\n[=== HASIL PENCARIAN TAVILY ===]`, 'sys-greet');
        if (data.answer) {
          printLine(`💡 Ringkasan AI: ${data.answer}`, 'info-msg');
          printLine('--------------------------------------------------------');
        }
        
        if (data.results && data.results.length > 0) {
          data.results.forEach((r, i) => {
            printLine(`${i + 1}. ${r.title}`);
            printLine(`   ${r.url}`, 'cmd-line');
            printLine(`   ${r.content.substring(0, 150)}...\n`);
          });
        } else {
          printLine('Tidak ada hasil yang relevan ditemukan.');
        }
        printLine('[========================================================]\n');
      } catch (err) {
        printLine(`Search crash: ${err.message}`, 'error-msg');
      }
      break;

    case '/chat':
      const prompt = args.slice(1).join(' ');
      if (!prompt) {
        printLine('Error: Isi prompt chat lo. Contoh: /chat halo', 'error-msg');
        return;
      }

      if (prompt.length > 5000 && !rawInput.includes('--force')) {
        printLine('[Warning]: Ukuran teks terlalu besar! Risiko memicu limit token 429 di serverless.', 'warn-msg');
        printLine('Ketik ulang dengan --force jika yakin. Contoh: /chat --force [isi_file_lo]', 'warn-msg');
        return;
      }

      printLine(`Executing prompt via branch [${selectedModelId}] with effort [${currentEffort.toUpperCase()}]...`);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            messages: [{ role: 'user', content: prompt.replace('--force', '').trim() }],
            provider: selectedModelId,
            effort: currentEffort
          })
        });

        if (!res.ok) throw new Error(`Server failure ${res.status}`);
        const data = await res.json();
        
        const reply = data.choices?.[0]?.message?.content || 'No response text.';
        printLine(`\n[=== RESPONSE FROM: ${(data._provider || 'Unknown').toUpperCase()} | ${data._latencyMs || 0}ms ===]`, 'sys-greet');
        printLine(reply);
        printLine('[========================================================]\n');
      } catch (err) {
        printLine(`Chat pipeline crash: ${err.message}`, 'error-msg');
      }
      break;

    case '/dashboard':
      printLine('Querying performance logs from database core...');
      try {
        const res = await fetch('/api/log?range=24h&limit=5', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Fetch error ${res.status}`);
        const data = await res.json();
        renderTextDashboard(data);
      } catch(err) {
        printLine(`Dashboard log fetch failed: ${err.message}`, 'error-msg');
      }
      break;

    case '/analytics':
      printLine('Entering analytics mode...');
      try {
        const res = await fetch('/api/log?range=7d&limit=10', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Fetch error ${res.status}`);
        const data = await res.json();
        renderTextAnalytics(data);
      } catch(err) {
        printLine(`Analytics compilation failed: ${err.message}`, 'error-msg');
      }
      break;

    default:
      printLine(`Command not found: '${command}'. Ketik '/help' untuk daftar fungsi.`, 'error-msg');
  }
}

inputEl.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter') {
    const val = inputEl.value;
    inputEl.value = '';
    inputEl.disabled = true;
    await handleCommand(val);
    inputEl.disabled = false;
    inputEl.focus();
  }
});

document.body.addEventListener('click', () => inputEl.focus());
if(token) printLine(`System: Secure token active. Mode effort [${currentEffort.toUpperCase()}] standby.`, "sys-greet");
else printLine("Warning: Token required. Silakan jalankan perintah 'auth [token_lo]'.", "warn-msg");
