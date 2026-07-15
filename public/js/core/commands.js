/**
 * K-Router Command & Logic Processor (Pure Function Layer)
 * Handles routing logic, chat submission, and fake backend streaming simulation.
 */
import { store } from './store.js';

export const commandProcessor = {
  /**
   * Titik masuk utama untuk memproses semua input teks dari terminal
   */
  process(rawInput) {
    const input = rawInput.trim();
    const callerName = 'core/commands.js';

    // 1. Logika Pemilah Perintah Perintah (Command Router)
    if (input.startsWith('/')) {
      this.handleSystemCommand(input, callerName);
    } else {
      // 2. Logika Pemroses Chat Biasa & Agen Autopilot
      this.handleAgentChat(input, callerName);
    }
  },

  /**
   * Memproses perintah sistem (Slash Commands)
   */
  handleSystemCommand(command, caller) {
    const parts = command.split(' ');
    const action = parts[0];
    const argument = parts.slice(1).join(' ');

    switch (action) {
      case '/use':
        if (!argument) {
          store.commit('ADD_LOG', { type: 'error', text: 'Usage: /use [model_name]' }, caller);
          return;
        }
        store.commit('SET_MODEL', argument, caller);
        store.commit('ADD_LOG', { type: 'success', text: `Switched model to: ${argument}` }, caller);
        break;

      case '/auth':
        if (!argument) {
          store.commit('ADD_LOG', { type: 'error', text: 'Usage: /auth [api_token]' }, caller);
          return;
        }
        store.commit('SET_TOKEN', argument, caller);
        store.commit('ADD_LOG', { type: 'success', text: 'API Token successfully secure-saved.' }, caller);
        break;

      case '/effort':
        if (!['low', 'medium', 'high'].includes(argument)) {
          store.commit('ADD_LOG', { type: 'error', text: 'Usage: /effort [low|medium|high]' }, caller);
          return;
        }
        store.commit('SET_EFFORT', argument, caller);
        store.commit('ADD_LOG', { type: 'success', text: `Default reasoning effort set to: ${argument}` }, caller);
        break;

      case '/clear':
        store.commit('CLEAR_FILES', null, caller);
        store.commit('ADD_LOG', { type: 'info', text: 'Attached files queue cleared.' }, caller);
        break;

      default:
        store.commit('ADD_LOG', { type: 'error', text: `Unknown command: ${action}. Type /use, /auth, or /effort.` }, caller);
    }
  },

  /**
   * Menstimulasi pipa transmisi data async (MOCK SERVERLESS SSE PIPELINE)
   * Ini adalah kontrak pembungkus sebelum kita colok ke Vercel Backend nanti.
   */
  handleAgentChat(message, caller) {
    const state = store.getState();

    // Proteksi: Jangan biarkan user kirim chat kalau token belum ada
    if (!state.token) {
      store.commit('ADD_LOG', { type: 'error', text: 'Access Denied: Please set your token first using /auth [token]' }, caller);
      return;
    }

    // Kunci Status Agen menjadi sedang berjalan (Mencegah double hit / spamming)
    store.commit('SET_AGENT_STATUS', true, caller);
    store.commit('ADD_LOG', { type: 'info', text: 'Agent activated. Initializing environment...' }, caller);

    // --- SIMULASI ALIRAN KONEKSI BACKEND (SSE) ---
    // Kita pakai setTimeout bertingkat untuk meniru delay internet asli
    
    // Milidetik 500: Pemindai Identitas Agen Masuk (Metadata Event)
    setTimeout(() => {
      store.commit('ADD_LOG', { 
        type: 'info', 
        text: `[METADATA] Executing via pipeline. Engine: ${state.selectedModelId} | Mode: ${state.currentEffort}` 
      }, 'backend/mock-sse');
    }, 500);

    // Milidetik 1500: Ceritanya Agen A selesai mikir & ngirim data (Batching Test)
    setTimeout(() => {
      store.commit('ADD_LOG', { 
        type: 'success', 
        text: 'AI Agent Response: Halo Kian! Pipa data terowongan kita sukses berjalan satu arah secara reaktif.' 
      }, 'backend/mock-sse');
    }, 1500);

    // Milidetik 2000: Siklus Refleksi Selesai, Matikan Status Agen (Close Event)
    setTimeout(() => {
      store.commit('SET_AGENT_STATUS', false, 'backend/mock-sse');
      store.commit('ADD_LOG', { type: 'info', text: 'Execution cycle completed cleanly.' }, 'backend/mock-sse');
    }, 2000);
  }
};
