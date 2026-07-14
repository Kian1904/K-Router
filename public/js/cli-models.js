// Aturan filter cerdas pengelompokan berdasarkan vendor asli arsitektur model
function getArchitectureGroup(modelName, id) {
  const name = (modelName || id || '').toLowerCase();
  if (name.includes('gemini') || name.includes('gemma')) return 'google';
  if (name.includes('llama')) return 'meta';
  if (name.includes('phi')) return 'microsoft';
  if (name.includes('glm')) return 'z-ai';
  if (name.includes('mistral')) return 'mistral-ai';
  if (name.includes('claude')) return 'anthropic';
  if (name.includes('north') || name.includes('cohere')) return 'cohere';
  if (name.includes('minimax')) return 'minimax';
  return 'other';
}

// Fungsi pengganti tampilan tabel GUI lama untuk merender teks ASCII pohon model
function renderModelsTree(providers, selectedId) {
  const groups = {};
  providers.forEach(p => {
    const groupName = getArchitectureGroup(p.model, p.id);
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(p);
  });

  printLine('\n◼ MODEL REGISTRY ARCHITECTURE TREE:', 'info-msg');
  Object.keys(groups).sort().forEach(group => {
    printLine(`├── @${group}/`);
    groups[group].forEach(p => {
      const isSelected = p.id === selectedId ? ' *ACTIVE*' : '';
      const statusDot = p.up ? '● ONLINE' : p.up === false ? '○ DOWN' : '◌ UNKNOWN';
      printLine(`│   ├── [${p.id}] ${p.model || '—'}${isSelected}`);
      printLine(`│   │   └── Platform Route: ${p.name} | ${statusDot} | ${p.latencyMs ? p.latencyMs+'ms' : '—'}`);
    });
  });
  printLine('');
}
