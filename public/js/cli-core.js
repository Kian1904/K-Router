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

// Function untuk membedah input teks menjadi struktur CLI Standar (Command, Args, Flags)
function parseCLIInput(rawInput) {
  const parts = rawInput.trim().split(/\s+/); // Split berdasarkan spasi (multi-space safe)
  const command = parts[0];
  const flags = {};
  const positionalArgs = [];

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    
    // Cek kalau ini adalah Double Hyphen Flag (e.g., --effort high atau --force)
    if (part.startsWith('--')) {
      const flagName = part.slice(2);
      // Cek apakah flag ini butuh value di argumen setelahnya
      if (['effort', 'model', 'provider'].includes(flagName) && i + 1 < parts.length && !parts[i+1].startsWith('-')) {
        flags[flagName] = parts[i+1];
        i++; // Skip indeks berikutnya karena sudah diambil jadi value
      } else {
        flags[flagName] = true; // Flag boolean biasa (e.g., --force)
      }
    } 
    // Cek kalau ini Single Hyphen Flag short-hand (e.g., -e high atau -f)
    else if (part.startsWith('-')) {
      const flagName = part.slice(1);
      if (flagName === 'e' && i + 1 < parts.length) { flags['effort'] = parts[i+1]; i++; }
      else if (flagName === 'm' && i + 1 < parts.length) { flags['model'] = parts[i+1]; i++; }
      else if (flagName === 'f') { flags['force'] = true; }
      else { flags[flagName] = true; }
    } 
    // Jika bukan flag, masukkan ke positional arguments (isi pesan/query utama)
    else {
      positionalArgs.push(part);
    }
  }

  return {
    command: command.toLowerCase(),
    flags,
    payload: positionalArgs.join(' ') // Digabung kembali jadi string teks utuh
  };
}

async function handleCommand(rawInput) {
  const trimInput = rawInput.trim();
  if (!trimInput) return;

  printLine(`${promptLabel.innerText} ${trimInput}`, 'cmd-line');

  if (!trimInput.startsWith('/')) {
    printLine(`Error: Perintah harus diawali tanda '/'. Contoh: /help`, 'error-msg');
    return;
  }

  // Mengambil arguments array untuk pencocokan subcommand manual
  const args = trimInput.split(' ');
  
  // Panggil parser CLI sakti kita di sini
  const cli = parseCLIInput(rawInput);

  // Proteksi Gerbang Token Keamanan untuk Rute API Sensitif
  if (['/dashboard', '/analytics', '/models', '/chat', '/search', '/repo', '/debug'].includes(cli.command) && !token) {
    printLine("Error: Akses ditolak. Jalankan perintah: /auth [TOKEN_LO]", "error-msg");
    return;
  }

  switch(cli.command) {
    case '/clear':
      outputEl.innerHTML = '';
      break;

    case '/help':
      printLine('===================== K-ROUTER CLI ADVANCED MANUAL =====================');
      printLine('  /help                           Tampilkan panduan manual ini');
      printLine('  /clear                          Bersihkan layar monitor terminal');
      printLine('  /auth [Token]                   Input token keamanan gerbang router');
      printLine('  /models                         List semua model terkelompok (ASCII Tree)');
      printLine('  /use [model_id]                 Kunci sesi chat ke model target tertentu');
      printLine('  /effort [low/medium/high]       Ubah status default effort token global');
      printLine('  /search [query]                 Cari info real-time via terowongan Tavily');
      printLine('  /dashboard                      Tarik log performa global router (24 Jam)');
      printLine('  /analytics                      Tampilkan grafik distribusi alokasi token');
      printLine('  /agent status                   Cek status arsitektur Multi-Agent');
      printLine('  /agent run [tugas]              Jalankan pipeline otomatisasi multi-agent');
      printLine('  /repo set [gh_token] [owner] [repo]  Konek integrasi ke GitHub API');
      printLine('  /repo [path_folder]             Intip struktur file dari repository');
      printLine('  /debug [path_file]              Autopilot bug scanner pada target file');
      printLine('  /chat [opsi] [pesan]            Kirim instruksi pesan langsung ke AI');
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
        printLine('Success: Token keamanan berhasil diverifikasi dan disimpan!', 'sys-greet');
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
      printLine(`Success: Level konsumsi token global diubah menjadi [${currentEffort.toUpperCase()}].`, 'sys-greet');
      break;

    case '/use':
      const targetId = args[1];
      if (!targetId) {
        printLine('Error: Masukkan ID model target. Contoh: /use google_gemini', 'error-msg');
        return;
      }
      if (targetId === 'auto_router') {
        selectedModelId = 'auto_router';
        promptLabel.innerText = `krouter_cli[auto_router]:~$`;
        printLine('Success: Jalur dialihkan kembali ke Auto Router default.', 'sys-greet');
        return;
      }
      selectedModelId = targetId;
      promptLabel.innerText = `krouter_cli[${targetId}]:~$`;
      printLine(`Success: Sesi operasional dikunci ke model [${targetId}].`, 'info-msg');
      break;

    case '/models':
      printLine('Fetching and structuralizing models tree layout...');
      try {
        const res = await fetch('/api/status', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (typeof renderModelsTree === 'function') {
          renderModelsTree(data.providers || [], selectedModelId);
        } else {
          printLine('Error: Modul cli-models.js gagal di-load.', 'error-msg');
        }
      } catch(err) {
        printLine(`Failed to cluster models tree: ${err.message}`, 'error-msg');
      }
      break;

    case '/dashboard':
      printLine('Querying performance logs from database core...');
      try {
        const res = await fetch('/api/log?range=24h&limit=5', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Fetch error ${res.status}`);
        const data = await res.json();
        if (typeof renderTextDashboard === 'function') {
          renderTextDashboard(data);
        } else {
          printLine('Error: Modul cli-stats.js gagal di-load.', 'error-msg');
        }
      } catch(err) {
        printLine(`Dashboard log fetch failed: ${err.message}`, 'error-msg');
      }
      break;

    case '/analytics':
      printLine('Entering analytics visualization mode...');
      try {
        const res = await fetch('/api/log?range=7d&limit=10', { headers: { 'Authorization': `Bearer ${token}` } });
        if (!res.ok) throw new Error(`Fetch error ${res.status}`);
        const data = await res.json();
        if (typeof renderTextAnalytics === 'function') {
          renderTextAnalytics(data);
        } else {
          printLine('Error: Modul cli-stats.js gagal di-load.', 'error-msg');
        }
      } catch(err) {
        printLine(`Analytics compilation failed: ${err.message}`, 'error-msg');
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

    case '/chat':
      if (!cli.payload) {
        printLine('Error: Isi prompt chat lo. Contoh: /chat halo AI', 'error-msg');
        return;
      }

      if (cli.payload.length > 5000 && !cli.flags.force) {
        printLine('[Warning]: Ukuran teks terlalu besar! Risiko memicu limit token 429.', 'warn-msg');
        printLine('Gunakan flag -f atau --force untuk memaksa. Contoh: /chat -f [isi_file]', 'warn-msg');
        return;
      }

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

    case '/agent':
      const agentSub = args[1]?.toLowerCase();
      if (agentSub === 'status') {
        if (typeof renderAgentStatus === 'function') {
          renderAgentStatus();
        } else {
          printLine('Error: Modul cli-agents.js belum ter-load.', 'error-msg');
        }
      } else if (agentSub === 'run') {
        const agentTask = args.slice(2).join(' ');
        if (!agentTask) {
          printLine('Error: Masukkan instruksi tugas agen. Contoh: /agent run bikin sistem login', 'error-msg');
          return;
        }
        if (typeof runMultiAgentWorkflow === 'function') {
          runMultiAgentWorkflow(agentTask);
        } else {
          printLine('Error: Modul cli-agents.js belum ter-load.', 'error-msg');
        }
      } else {
        printLine('Panduan Perintah Agen:', 'info-msg');
        printLine('  /agent status        - Cek kesehatan & jenis arsitektur model agen');
        printLine('  /agent run [tugas]   - Jalankan workflow otomatisasi multi-agent');
      }
      break;

    case '/repo':
      if (args[1] === 'set') {
        if (!args[2] || !args[3] || !args[4]) {
          printLine('Error: Format salah. Gunakan: /repo set [TOKEN] [OWNER] [REPO]', 'error-msg');
          return;
        }
        localStorage.setItem('kr_gh_token', args[2]);
        localStorage.setItem('kr_gh_owner', args[3]);
        localStorage.setItem('kr_gh_repo', args[4]);
        
        if (typeof githubToken !== 'undefined') {
          githubToken = args[2]; repoOwner = args[3]; repoName = args[4];
        }
        printLine('Success: Terowongan integrasi GitHub API aktif!', 'sys-greet');
      } else {
        if (typeof listRepositoryFiles === 'function') {
          await listRepositoryFiles(args[1] || '');
        } else {
          printLine('Error: Modul cli-repo.js belum ter-load.', 'error-msg');
        }
      }
      break;

    case '/debug':
      if (!args[1]) {
        printLine('Error: Masukkan file target. Contoh: /debug api/chat.js', 'error-msg');
        return;
      }
      if (typeof debugTargetFile === 'function') {
        await debugTargetFile(args[1]);
      } else {
        printLine('Error: Modul cli-repo.js belum ter-load.', 'error-msg');
      }
      break;

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
else printLine("Warning: Token required. Silakan jalankan perintah '/auth [token_lo]'.", "warn-msg");
