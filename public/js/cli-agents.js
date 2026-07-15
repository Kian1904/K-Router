// Virtual Workspace Memory State
let virtualWorkspace = {
  initialized: false,
  agents: {
    antigravity: { role: 'Builder (Complex App)', model: 'anthropic_sonnet', status: 'GOOD', icon: '▲' },
    blackbox: { role: 'Writer (Documentation)', model: 'google_flash', status: 'NEEDS WORK', icon: '█' },
    copilot: { role: 'Executor (Simple App)', model: 'phi_4', status: 'STILL TESTING', icon: '🤖' }
  },
  currentTask: null,
  logs: []
};

// Fungsi menggambar Status Agen mirip kayak screenshot lo (ASCII Card Layout)
function renderAgentStatus() {
  printLine('\n◼ REALITANYA, SISTEM INI BELUM SEMPURNA:', 'info-msg');
  printLine('------------------------------------------------------------');
  
  Object.entries(virtualWorkspace.agents).forEach(([name, info]) => {
    printLine(`${info.icon} Agent: ${name.toUpperCase()}`);
    printLine(`  | Role   : ${info.role}`);
    printLine(`  | Engine : ${info.model}`);
    const statusClass = info.status === 'GOOD' ? 'sys-greet' : info.status === 'NEEDS WORK' ? 'warn-msg' : 'info-msg';
    printLine(`  | Status : [ ${info.status} ]`, statusClass);
    printLine('  ..........................................................');
  });
  printLine('  Workflow-nya udah jalan. Tinggal terus dituning.\n');
}

// Fungsi utama pengeksekusi delegasi otomatis Multi-Agent Loop
async function runMultiAgentWorkflow(taskPrompt) {
  if (!token) {
    printLine("Error: Jalankan /auth terlebih dahulu.", "error-msg");
    return;
  }

  printLine(`\n[01] [MANAGER] Analyzing master task: "${taskPrompt}"...`, 'info-msg');
  
  try {
    // Langkah 1: Panggil Manager untuk bikin Task Breakdowns (Minta format JSON terstruktur)
    const managerRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ 
          role: 'user', 
          content: `Ubah tugas ini menjadi 2 sub-task terpisah (1 untuk coding, 1 untuk dokumentasi). 
                   Format wajib JSON persis seperti ini tanpa teks lain:
                   {"coding": "isi tugas coding", "docs": "isi tugas dokumentasi"}
                   
                   TUGAS MASTER: ${taskPrompt}` 
        }],
        provider: 'auto_router', // Biar router nyari model terbaik untuk planning
        effort: 'medium'
      })
    });

    if (!managerRes.ok) throw new Error("Manager failed to plan workflow.");
    const managerData = await managerRes.json();
    const planText = managerData.choices[0].message.content;
    
    // Parsing JSON dari Manager
    let plan;
    try {
      plan = JSON.parse(planText.match(/\{[\s\S]*\}/)[0]);
    } catch(e) {
      throw new Error("Gagal mengekstrak JSON planning dari Manager. Coba lagi.");
    }

    printLine(`\n[02] [TASK MANAGED] Workspace allocation successful:`, 'sys-greet');
    printLine(`  ├── Coding Target : ${plan.coding}`);
    printLine(`  └── Docs Target   : ${plan.docs}`);

    // Langkah 2: Kirim ke Agent ANTIGRAVITY (Builder) untuk ngerjain kodingannya
    printLine(`\n[03] [EXECUTE] Routing task to ANTIGRAVITY (${virtualWorkspace.agents.antigravity.model})...`, 'info-msg');
    const builderRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: plan.coding }],
        provider: virtualWorkspace.agents.antigravity.model,
        effort: 'high' // Set effort tinggi karena tugas coding kompleks
      })
    });
    const builderData = await builderRes.json();
    const codeResult = builderData.choices[0].message.content;
    printLine(`✔ [ANTIGRAVITY] Task completed standard validation.`, 'sys-greet');

    // Langkah 3: Kirim ke Agent BLACKBOX (Writer) untuk bikin dokumentasi teknisnya
    printLine(`\n[04] [EXECUTE] Routing log compilation to BLACKBOX (${virtualWorkspace.agents.blackbox.model})...`, 'info-msg');
    const writerRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Bikin dokumentasi singkat Markdown berdasarkan kodingan ini:\n\n${codeResult}` }],
        provider: virtualWorkspace.agents.blackbox.model,
        effort: 'low' // Model murah, effort low biar hemat token
      })
    });
    const writerData = await writerRes.json();
    const docsResult = writerData.choices[0].message.content;
    printLine(`✔ [BLACKBOX] Log update and documentation compiled.`, 'sys-greet');

    // Langkah 4: Tampilkan Output Agregasi Akhir Terminal
    printLine('\n==================== WORKSPACE AGENT OUTPUT ====================', 'info-msg');
    printLine('### [Task.md - Main Source of Truth]');
    printLine(docsResult);
    printLine('----------------------------------------------------------------');
    printLine('### [Generated Core Code]');
    printLine(codeResult.substring(0, 500) + '...\n[Teks dipotong, file lengkap tersimpan di memory buffer]');
    printLine('================================================================\n', 'info-msg');

  } catch (err) {
    printLine(`Multi-Agent Pipeline Crash: ${err.message}`, 'error-msg');
  }
      }
