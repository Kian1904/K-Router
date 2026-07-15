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

  if (!trimInput.startsWith('/')) {
    printLine(`Error: Perintah harus diawali tanda '/'. Contoh: /help`, 'error-msg');
    return;
  }

  // Panggil parser CLI sakti kita di sini
  const cli = parseCLIInput(rawInput);

  if (['/dashboard', '/analytics', '/models', '/chat', '/search'].includes(cli.command) && !token) {
    printLine("Error: Akses ditolak. Jalankan perintah: /auth [TOKEN_LO]", "error-msg");
    return;
  }

  switch(cli.command) {
    case '/clear':
      outputEl.innerHTML = '';
      break;

    case '/help':
      printLine('===================== K-ROUTER CLI ADVANCED MANUAL =====================');
      printLine('  /help                           Tampilkan panduan ini');
      printLine('  /clear                          Bersihkan layar');
      printLine('  /auth [Token]                   Input token keamanan');
      printLine('  /models                         List semua model terkelompok');
      printLine('  /use [model_id]                 Kunci chat ke model tertentu');
      printLine('  /effort [low/medium/high]       Ubah default effort global');
      printLine('  /search [query]                 Cari info real-time via Tavily');
      printLine('  /chat [opsi] [pesan]            Kirim pesan ke AI');
      printLine('     Opsi Tersedia:');
      printLine('       -e, --effort [level]       Override effort khusus untuk chat ini');
      printLine('       -m, --model [id]           Override model khusus untuk chat ini');
      printLine('       -f, --force                Paksa kirim payload besar (>5000 karakter)');
      printLine('========================================================================');
      break;

    case '/auth':
      if (!cli.payload) {
        printLine('Error: Token wajib diisi. Contoh: /auth token_123', 'error-msg');
      } else {
        token = cli.payload;
        localStorage.setItem('kr_token', token);
        printLine('Success: Token berhasil diverifikasi!', 'sys-greet');
      }
      break;

    case '/chat':
      if (!cli.payload) {
        printLine('Error: Isi prompt chat lo. Contoh: /chat halo AI', 'error-msg');
        return;
      }

      // Evaluasi flag proteksi --force atau -f
      if (cli.payload.length > 5000 && !cli.flags.force) {
        printLine('[Warning]: Ukuran teks terlalu besar! Risiko memicu limit token 429.', 'warn-msg');
        printLine('Gunakan flag -f atau --force untuk memaksa. Contoh: /chat -f [isi_file]', 'warn-msg');
        return;
      }

      // Tentukan param secara dinamis berdasarkan flag runtime atau state default
      const activeModel = cli.flags.model || selectedModelId;
      const activeEffort = cli.flags.effort || currentEffort;

      printLine(`Executing via branch [${activeModel}] with effort [${activeEffort.toUpperCase()}]...`);
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({
            messages: [{ role: 'user', content: cli.payload }],
            provider: activeModel,
            effort: activeEffort
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

    case '/search':
      if (!cli.payload) {
        printLine('Error: Masukkan kata kunci. Contoh: /search cuaca Jakarta', 'error-msg');
        return;
      }
      printLine(`Tavily Engine: Menelusuri web untuk "${cli.payload}"...`);
      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ query: cli.payload })
        });
        if (!res.ok) throw new Error(`Server failure ${res.status}`);
        const data = await res.json();
        
        printLine(`\n[=== HASIL PENCARIAN TAVILY ===]`, 'sys-greet');
        if (data.answer) printLine(`💡 Ringkasan AI: ${data.answer}\n`, 'info-msg');
        if (data.results && data.results.length > 0) {
          data.results.forEach((r, i) => {
            printLine(`${i + 1}. ${r.title}`);
            printLine(`   ${r.url}`, 'cmd-line');
            printLine(`   ${r.content.substring(0, 120)}...\n`);
          });
        }
        printLine('[========================================================]\n');
      } catch (err) {
        printLine(`Search crash: ${err.message}`, 'error-msg');
      }
      break;

    // ... case /models, /use, /dashboard, /analytics tinggal panggil cli.payload jika butuh argumen tambahan
    // Tetap pertahankan kodingan fetch log/status lo yang kemarin di sini ya!
    default:
      printLine(`Command not found: '${cli.command}'. Ketik '/help' untuk daftar fungsi.`, 'error-msg');
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
