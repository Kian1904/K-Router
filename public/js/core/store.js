/**
 * K-Router Global State Store (Strict Mutation + Observer Pattern + Batching)
 * Single Source of Truth - Do NOT modify state directly!
 */

// 1. Data Terisolasi (Private State)
const _state = {
  token: localStorage.getItem('kr_token') || '',
  selectedModelId: 'auto_router',
  currentEffort: localStorage.getItem('kr_default_effort') || 'medium',
  attachedFiles: [],
  logs: [],
  isAgentRunning: false
};

// 2. Daftar Pendengar UI (Subscribers)
const _subscribers = new Set();

// 3. Penampung Antrean Batching (Buffer)
let _batchQueue = [];
let _batchTimeout = null;

export const store = {
  // Fungsi murni untuk membaca data (Deep Copy agar aman dari manipulasi luar)
  getState() {
    return JSON.parse(JSON.stringify(_state));
  },

  // Fungsi titip absen untuk UI (Subscribe)
  subscribe(callback) {
    _subscribers.add(callback);
    // Kembalikan fungsi untuk unsubscribe demi mencegah Memory Leak
    return () => _subscribers.delete(callback);
  },

  // Pintu Gerbang Tunggal Pengubah Data (Strict Mutation)
  commit(action, payload, callerInfo = 'unknown_source') {
    if (!action) {
      console.error(`[STORE ERROR] Mutation rejected: Action name is required.`);
      return;
    }

    const oldState = this.getState();

    // Validasi Aksi & Eksekusi Perubahan Data
    switch (action) {
      case 'SET_TOKEN':
        _state.token = payload;
        localStorage.setItem('kr_token', payload);
        break;
      case 'SET_MODEL':
        _state.selectedModelId = payload;
        break;
      case 'SET_EFFORT':
        _state.currentEffort = payload;
        localStorage.setItem('kr_default_effort', payload);
        break;
      case 'SET_AGENT_STATUS':
        _state.isAgentRunning = !!payload;
        break;
      case 'ADD_FILE':
        if (!_state.attachedFiles.includes(payload)) _state.attachedFiles.push(payload);
        break;
      case 'CLEAR_FILES':
        _state.attachedFiles = [];
        break;
      case 'ADD_LOG':
        _state.logs.push({ timestamp: Date.now(), ...payload });
        break;
      default:
        console.warn(`[STORE WARN] Unknown mutation action: ${action}`);
        return;
    }

    // Catat KTP pengubah data ke dalam sistem log debug internal browser (Identity Scanner)
    const logMetadata = {
      action,
      caller: callerInfo,
      changedAt: new Date().toLocaleTimeString(),
      diff: { old: oldState[action.replace('SET_', '').toLowerCase()], new: payload }
    };

    // Masukkan mutasi ke dalam antrean Batching
    _batchQueue.push(logMetadata);

    // Aktifkan Katup Penahan Timer (Debounce Teriakan ke UI)
    if (_batchTimeout) clearTimeout(_batchTimeout);
    
    _batchTimeout = setTimeout(() => {
      this._flushNotifications();
    }, 15); // Menggabungkan semua mutasi dalam rentang 15 milidetik
  },

  // Perintah menyiarkan gabungan data ke seluruh komponen UI yang mendengarkan
  _flushNotifications() {
    const currentState = this.getState();
    const frozenBatch = [..._batchQueue];
    _batchQueue = [];
    _batchTimeout = null;

    // Kirimkan state terbaru dan jejak rekam mutasi ke UI
    _subscribers.forEach((triggerUI) => {
      try {
        triggerUI(currentState, frozenBatch);
      } catch (err) {
        console.error(`[STORE CRASH] UI Subscriber failed to render:`, err);
      }
    });
  }
};
