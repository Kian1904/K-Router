/**
 * K-Router UI Controller (DOM Penguasa & Store Subscriber)
 */
import { store } from '../core/store.js';

// Elements Cache (Biar gak bolak-balik nembak document.getElementById, hemat CPU!)
let outputEl = null;
let inputEl = null;
let promptLabelEl = null;

export const terminalUI = {
  init() {
    // 1. Ambil & kunci elemen HTML ke memori cache
    outputEl = document.getElementById('terminal-output');
    inputEl = document.getElementById('terminal-input');
    promptLabelEl = document.getElementById('prompt-label');

    if (!outputEl || !inputEl || !promptLabelEl) {
      console.error('[UI ERROR] Terminal HTML elements not found! Check your IDs.');
      return;
    }

    // 2. DAFTARKAN UI SEBAGAI SUBSCRIBER KOTAK PUSAT (Push Pattern)
    store.subscribe((state, batch) => this.render(state, batch));

    // 3. Dengerin input keyboard user (Enter key)
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const rawInput = inputEl.value.trim();
        if (rawInput) {
          this.handleUserInput(rawInput);
          inputEl.value = ''; // Kosongkan input box setelah enter
        }
      }
    });

    // 4. Pemicu Pertama (Initial Hydration) agar layar langsung terisi data awal
    this.render(store.getState(), [{ action: 'INITIAL_BOOT', caller: 'ui/terminal.js' }]);
    
    console.log('[UI SYSTEM] Terminal UI successfully wired up to Global Store.');
  },

  // Logika pembongkar input user sebelum dioper ke folder core
  handleUserInput(input) {
    this.printToScreen(`\n<span class="user-input">> ${input}</span>`);

    // Di sesi berikutnya, bagian ini bakal manggil fungsi dari folder core/commands.js
    // Sementara kita test simulasi mutasi langsung di sini:
    if (input.startsWith('/use ')) {
      const modelName = input.replace('/use ', '');
      store.commit('SET_MODEL', modelName, 'ui/terminal.js');
    } else if (input.startsWith('/auth ')) {
      const token = input.replace('/auth ', '');
      store.commit('SET_TOKEN', token, 'ui/terminal.js');
      store.commit('ADD_LOG', { type: 'success', text: 'Token updated successfully via UI.' }, 'ui/terminal.js');
    } else {
      // Simulasi nge-chat biasa
      this.printToScreen(`<span class="system-msg">[System] Processing function logic in core...</span>`);
    }
  },

  // SATU-SATUNYA FUNGSI UNTUK MENGGAMBAR ULANG LAYAR (Render Engine)
  render(state, batch) {
    // A. Update Tampilan Prompt Label sesuai model yang aktif di Store
    if (promptLabelEl) {
      promptLabelEl.textContent = `k-router(${state.selectedModelId})[${state.currentEffort}]> `;
    }

    // B. Jalankan Pemindai Identitas (Identity Debugger Scanner) di Konsol Browser
    console.group(`%c[UI RENDER] Triggered by ${batch.length} batch mutations`, 'color: #00ff00; font-weight: bold;');
    batch.forEach(mutation => {
      console.log(`%cAction: ${mutation.action} | Caller: ${mutation.caller}`, 'color: #00bcff');
      
      // Jika ada log baru masuk ke store, cetak ke layar terminal
      if (mutation.action === 'ADD_LOG') {
        const latestLog = state.logs[state.logs.length - 1];
        this.printToScreen(`<div class="log-${latestLog.type}">[LOG] ${latestLog.text}</div>`);
      }
    });
    console.groupEnd();
  },

  // Helper murni buat nge-push text HTML ke dalam kotak hitam terminal
  printToScreen(htmlText) {
    if (!outputEl) return;
    outputEl.insertAdjacentHTML('beforeend', htmlText);
    
    // Otomatis scroll layar terminal ke paling bawah biar gak kelelep text baru
    outputEl.scrollTop = outputEl.scrollHeight;
  }
};
