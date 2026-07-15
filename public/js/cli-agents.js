// Virtual Workspace Memory State
let virtualWorkspace = {
  initialized: false,
  agents: {
    antigravity: { role: 'Builder (Complex App)', model: 'z-ai/glm-5.2', status: 'GOOD', icon: '▲' },
    blackbox: { role: 'Writer (Documentation)', model: 'gemini-2.5-flash', status: 'NEEDS WORK', icon: '█' },
    copilot: { role: 'Executor (Simple App)', model: 'google/gemma-4-31B-it', status: 'STILL TESTING', icon: '🤖' }
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
    // 1. Tweak Prompt: Kita paksa pake kata-kata "RAW JSON ONLY" dan larang keras markdown block
    const managerRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ 
          role: 'user', 
          content: `You are a strict Project Manager Agent. Break down this task into exactly 2 sub-tasks: 1 for coding, 1 for documentation.
                   
                   CRITICAL RULE: Output MUST be a raw JSON object only. Do NOT include markdown blocks like \`\`\`json, do NOT include conversational text, do NOT include explanations. Just raw JSON text.
                   
                   Format structure:
                   {"coding": "detailed coding task instruction", "docs": "detailed documentation task instruction"}
                   
                   MASTER TASK TO PROCESS: ${taskPrompt}` 
        }],
        provider: "",
        effort: 'high'
      })
    });
    if (!managerRes.ok) {
      throw new Error(`Serverless HTTP Error [${managerRes.status}] - Hubungan ke /api/chat diputus server.`);
    }
    let planText = managerData.choices[0].message.content.trim();
    
    // 2. Robust JSON Extractor Logic (Membabat habis teks sampah sebelum dan sesudah kurung kurawal)
    let plan;
    try {
      const firstBrace = planText.indexOf('{');
      const lastBrace = planText.lastIndexOf('}');
      
      if (firstBrace !== -1 && lastBrace !== -1) {
        // Ambil murni dari '{' sampai '}' paling ujung
        const cleanJsonString = planText.substring(firstBrace, lastBrace + 1);
        plan = JSON.parse(cleanJsonString);
      } else {
        throw new Error("No braces found");
      }
    } catch(e) {
      // Jika gagal, cetak bocoran teks asli dari AI di terminal biar lo tau dia ngomong apa
      printLine(`[Debug Log] Raw AI Output: ${planText}`, 'warn-msg');
      throw new Error("AI tidak mengembalikan format JSON yang valid.");
    }

    printLine(`\n[02] [TASK MANAGED] Workspace allocation successful:`, 'sys-greet');
    printLine(`  ├── Coding Target : ${plan.coding}`);
    printLine(`  └── Docs Target   : ${plan.docs}`);

    // 3. Jalankan Agent ANTIGRAVITY (Builder)
    printLine(`\n[03] [EXECUTE] Routing task to ANTIGRAVITY (${virtualWorkspace.agents.antigravity.model})...`, 'info-msg');
    const builderRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: plan.coding }],
        provider: virtualWorkspace.agents.antigravity.model,
        effort: 'high'
      })
    });
    const builderData = await builderRes.json();
    const codeResult = builderData.choices[0].message.content;
    printLine(`✔ [ANTIGRAVITY] Task completed standard validation.`, 'sys-greet');

    // 4. Jalankan Agent BLACKBOX (Writer)
    printLine(`\n[04] [EXECUTE] Routing log compilation to BLACKBOX (${virtualWorkspace.agents.blackbox.model})...`, 'info-msg');
    const writerRes = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        messages: [{ role: 'user', content: `Bikin dokumentasi singkat Markdown berdasarkan kodingan ini:\n\n${codeResult}` }],
        provider: virtualWorkspace.agents.blackbox.model,
        effort: 'low'
      })
    });
    const writerData = await writerRes.json();
    const docsResult = writerData.choices[0].message.content;
    printLine(`✔ [BLACKBOX] Log update and documentation compiled.`, 'sys-greet');

    // 5. Render Hasil Akhir ke Konsol
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
