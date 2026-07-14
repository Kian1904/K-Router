// Helper membuat bar visual data analitik di terminal
function makeProgressBar(percentage, size = 15) {
  const dots = Math.round((percentage / 100) * size);
  const empty = size - dots;
  return '[' + '█'.repeat(dots) + '░'.repeat(empty) + ']';
}

// Fungsi parser data dashboard dari database logs
function renderTextDashboard(data) {
  printLine('\n================ GLOBAL PERFORMANCE CORE (24H) ================', 'info-msg');
  printLine(`Total Requests : ${data.stats.total} hits`);
  printLine(`Success Rate   : ${data.stats.successRate}% (${data.stats.succeeded} OK / ${data.stats.failed} FAILED)`);
  printLine(`Avg Latency    : ${data.stats.avgLatency || 0} ms`);
  printLine(`Active Track   : ${data.stats.activeProviders.join(', ') || 'None'}`);
  printLine('================================================================');
}

// Fungsi parser data metrik token mingguan
function renderTextAnalytics(data) {
  printLine('\n================ TOKEN DISTRIBUTION METRICS ================', 'info-msg');
  printLine(`Total Input Tokens  : ${data.stats.totalTokensIn.toLocaleString()}`);
  printLine(`Total Output Tokens : ${data.stats.totalTokensOut.toLocaleString()}`);
  printLine('------------------------------------------------------------');
  
  printLine('◼ EFFORT LEVEL ALLOCATION:');
  const totalEfforts = Object.values(data.effortDistribution).reduce((a,b)=>a+b, 0) || 1;
  Object.entries(data.effortDistribution).forEach(([k, v]) => {
    const pct = Math.round((v / totalEfforts) * 100);
    printLine(`  ${k.toUpperCase().padEnd(6)} : ${makeProgressBar(pct)} ${pct}% (${v} hits)`);
  });
  printLine('============================================================');
}
