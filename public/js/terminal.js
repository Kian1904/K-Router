'use strict';

// ─── Terminal ─────────────────────────────────────────────────────────────────
// Main CLI interface. Handles:
//   - Command parsing and dispatch
//   - Command history (sessionStorage, arrow up/down)
//   - Terminal output rendering
//   - Auth gate (first boot protocol)

(function () {

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  var outputEl  = null;
  var inputEl   = null;
  var promptEl  = null;

  // ── Session state ────────────────────────────────────────────────────────────
  var _cmdHistory  = [];
  var _historyIdx  = 0;
  var _awaitToken  = false;

  var HISTORY_KEY = 'kr_cmd_history';

  // ── Prompt ───────────────────────────────────────────────────────────────────

  function _updatePrompt() {
    if (!promptEl) return;
    var state    = window.KRState.getState();
    var provider = state.activeProvider || 'auto';
    promptEl.textContent = 'krouter[' + provider + ']:~$';
  }

  // ── Output ───────────────────────────────────────────────────────────────────

  function _line(text, cls) {
    var el = document.createElement('div');
    el.className = 'term-line' + (cls ? ' ' + cls : '');
    el.textContent = text;
    outputEl.appendChild(el);
    outputEl.scrollTop = outputEl.scrollHeight;
    return el;
  }

  function _lineHTML(html, cls) {
    var el = document.createElement('div');
    el.className = 'term-line' + (cls ? ' ' + cls : '');
    el.innerHTML = html;
    outputEl.appendChild(el);
    outputEl.scrollTop = outputEl.scrollHeight;
    return el;
  }

  function _gap() {
    var el = document.createElement('div');
    el.className = 'term-gap';
    outputEl.appendChild(el);
  }

  function _sep() {
    _line('─'.repeat(54), 'term-muted');
  }

  function _echo(input) {
    _lineHTML(
      '<span class="term-muted">' + _esc(promptEl.textContent) + '</span>' +
      ' <span class="term-cmd">'  + _esc(input)               + '</span>'
    );
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Command History ───────────────────────────────────────────────────────────

  function _loadHistory() {
    try {
      var raw = sessionStorage.getItem(HISTORY_KEY);
      _cmdHistory = raw ? JSON.parse(raw) : [];
    } catch (e) {
      _cmdHistory = [];
    }
    _historyIdx = _cmdHistory.length;
  }

  function _saveHistory(cmd) {
    if (_cmdHistory[_cmdHistory.length - 1] === cmd) return;
    _cmdHistory.push(cmd);
    if (_cmdHistory.length > 100) _cmdHistory.shift();
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(_cmdHistory)); } catch (e) {}
    _historyIdx = _cmdHistory.length;
  }

  // ── Commands ─────────────────────────────────────────────────────────────────

  function _cmdHelp() {
    _gap();
    _line('Available commands:', 'term-bright');
    _gap();
    _lineHTML('  <span class="term-green">/help</span>                list commands');
    _lineHTML('  <span class="term-green">/models</span>              provider status (live ping)');
    _lineHTML('  <span class="term-green">/use</span> <span class="term-yellow">[model]</span>          lock a model  e.g. /use gemini');
    _lineHTML('  <span class="term-green">/search</span> <span class="term-yellow">[query]</span>       real-time web search');
    _lineHTML('  <span class="term-green">/dashboard</span>           usage stats  e.g. /dashboard 7');
    _lineHTML('  <span class="term-green">/clear</span>               clear terminal');
    _gap();
    _line('  Typing without a / prefix sends a chat message.', 'term-muted');
    _gap();
  }

  function _cmdModels() {
    _gap();
    var loading = _line('Pinging providers...', 'term-muted');

    window.KRCore.getStatus().then(function (data) {
      loading.remove();

      var pingMap = {};
      (data.providers || []).forEach(function (p) { pingMap[p.id] = p; });

      var providers = window.KRProviders.getCascadeOrder(true);

      _gap();
      _line('PROVIDERS — ' + providers.length + ' total', 'term-bright');
      _sep();

      var online = 0;
      var down   = 0;

      providers.forEach(function (p, i) {
        var ping    = pingMap[p.id] || {};
        var status  = ping.status || 'unknown';
        var lat     = ping.latency_ms ? ping.latency_ms + 'ms' : '---';
        var isLast  = i === providers.length - 1;
        var prefix  = isLast ? '  └── ' : '  ├── ';
        var sCls, sStr;

        if (status === 'ok')       { sStr = '[ONLINE]'; sCls = 'term-green'; online++; }
        else if (status === 'down'){ sStr = '[DOWN]  '; sCls = 'term-red';  down++;   }
        else if (status === 'no_key') { sStr = '[NO KEY]'; sCls = 'term-yellow'; }
        else                       { sStr = '[?????] '; sCls = 'term-muted'; }

        var namePad = p.name.padEnd(32);
        var backupTag = p.backup ? ' <span class="term-yellow">[backup]</span>' : '';

        _lineHTML(
          _esc(prefix) +
          '<span class="term-bright">' + _esc(namePad) + '</span>' +
          '<span class="' + sCls + '">' + sStr + '</span>' +
          '  <span class="term-muted">' + _esc(lat) + '</span>' +
          backupTag
        );
      });

      _gap();
      _sep();
      _lineHTML(
        '<span class="term-green">' + online + ' online</span>  ' +
        '<span class="term-red">'   + down   + ' down</span>  ' +
        '<span class="term-muted">pinged ' + new Date(data.timestamp).toLocaleTimeString() + '</span>'
      );
      _gap();

    }).catch(function (err) {
      loading.remove();
      _line('Error: ' + err.message, 'term-red');
      _gap();
    });
  }

  function _cmdUse(args) {
    if (!args) {
      _line('Usage: /use [model]   e.g. /use gemini  /use codestral', 'term-yellow');
      return;
    }

    var result = window.KRProviders.resolveAlias(args);

    if (!result) {
      _line('Unknown model: ' + args, 'term-red');
      _line('Type /models to see available models.', 'term-muted');
      return;
    }

    if (result.ambiguous) {
      _line('Ambiguous. Did you mean: ' + result.options.join(' or ') + '?', 'term-yellow');
      return;
    }

    var providerId = result.id || 'auto';
    window.KRState.setState(
      { activeProvider: providerId, chatHistory: [] },
      { caller: 'terminal.cmdUse' }
    );
    _updatePrompt();

    if (!result.id) {
      _line('Switched to auto routing. Chat history cleared.', 'term-green');
    } else {
      var p = window.KRProviders.getProvider(result.id);
      _line('Locked to ' + (p ? p.name : result.id) + '. Chat history cleared.', 'term-green');
    }
  }

  function _cmdChat(message) {
    if (!message) {
      _line('Usage: /chat [message]  or just type your message directly.', 'term-yellow');
      return;
    }

    var state    = window.KRState.getState();
    var history  = state.chatHistory.slice();
    var provider = state.activeProvider !== 'auto' ? state.activeProvider : null;

    history.push({ role: 'user', content: message });
    window.KRState.setState({ chatHistory: history, isLoading: true }, { caller: 'terminal.cmdChat' });

    _gap();
    var loading = _line('...', 'term-muted');
    var t0 = Date.now();

    window.KRCore.sendChat(history, provider).then(function (data) {
      loading.remove();

      var reply    = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || 'No response.';
      var resolved = (data._meta && data._meta.resolved) || data.provider || '?';
      var latency  = Date.now() - t0;
      var cascaded = data._meta && data._meta.cascaded;

      var updatedHistory = history.slice();
      updatedHistory.push({ role: 'assistant', content: reply });
      window.KRState.setState(
        { chatHistory: updatedHistory, isLoading: false },
        { caller: 'terminal.cmdChat.response' }
      );

      _sep();
      var meta = resolved + ' · ' + latency + 'ms';
      if (cascaded) meta += ' · cascaded';
      _line(meta, 'term-muted');
      _gap();
      reply.split('\n').forEach(function (l) { _line(l); });
      _gap();
      _sep();
      _gap();

    }).catch(function (err) {
      loading.remove();
      window.KRState.setState({ isLoading: false }, { caller: 'terminal.cmdChat.error' });

      if (err.message === 'UNAUTHORIZED') {
        _line('Session expired. Please re-enter your token.', 'term-red');
        _promptToken();
      } else {
        _line('Error: ' + err.message, 'term-red');
        _gap();
      }
    });
  }

  function _cmdSearch(query) {
    if (!query) {
      _line('Usage: /search [query]', 'term-yellow');
      return;
    }

    _gap();
    var loading = _line('Searching: ' + query + '...', 'term-muted');

    window.KRCore.sendSearch(query).then(function (data) {
      loading.remove();
      _gap();
      _sep();
      _line('SEARCH — ' + query, 'term-bright');
      _sep();
      _gap();

      if (data.answer) {
        _line(data.answer);
        _gap();
      }

      (data.results || []).forEach(function (r, i) {
        _lineHTML('<span class="term-muted">[' + (i+1) + ']</span> <span class="term-blue">' + _esc(r.title) + '</span>');
        _lineHTML('     <span class="term-muted">' + _esc(r.url) + '</span>');
        if (r.content) {
          var snip = r.content.length > 160 ? r.content.slice(0, 160) + '…' : r.content;
          _line('     ' + snip, 'term-muted');
        }
        _gap();
      });

      _sep();
      _gap();

    }).catch(function (err) {
      loading.remove();
      _line('Search failed: ' + err.message, 'term-red');
      _gap();
    });
  }

  function _cmdDashboard(args) {
    var days = parseInt(args, 10) || 7;
    _gap();
    var loading = _line('Fetching stats for last ' + days + ' day(s)...', 'term-muted');

    window.KRCore.getDashboard(days).then(function (data) {
      loading.remove();
      _gap();
      _sep();
      _line("DASHBOARD — last " + data.days + " day(s)", 'term-bright');
      _sep();
      _gap();
      _line('Total requests : ' + data.total, 'term-bright');
      _line('Success rate   : ' + data.success_rate + '%');
      _gap();

      if (data.providers && data.providers.length) {
        _line('Provider breakdown:', 'term-bright');
        _gap();
        var maxReq = Math.max.apply(null, data.providers.map(function(p){ return p.requests || 0; })) || 1;
        data.providers.forEach(function (p) {
          var fill  = Math.round(((p.requests || 0) / maxReq) * 18);
          var bar   = '█'.repeat(fill) + '░'.repeat(18 - fill);
          var label = (p.provider || '?').padEnd(20);
          var req   = String(p.requests || 0).padStart(4);
          var sr    = p.success_rate + '%';
          _lineHTML(
            '  ' + _esc(label) +
            ' <span class="term-green">[' + bar + ']</span>' +
            ' ' + req + ' req  ' +
            '<span class="term-muted">' + sr + '</span>'
          );
        });
        _gap();
      }

      _sep();
      _gap();

    }).catch(function (err) {
      loading.remove();
      _line('Failed: ' + err.message, 'term-red');
      _gap();
    });
  }

  function _cmdClear() {
    outputEl.innerHTML = '';
  }

  // ── Command dispatcher ────────────────────────────────────────────────────────

  function _dispatch(raw) {
    var input = raw.trim();
    if (!input) return;

    if (_awaitToken) {
      _handleTokenInput(input);
      return;
    }

    _echo(input);
    _saveHistory(input);

    var spaceIdx = input.indexOf(' ');
    var cmd      = (spaceIdx === -1 ? input : input.slice(0, spaceIdx)).toLowerCase();
    var args     = spaceIdx === -1 ? '' : input.slice(spaceIdx + 1).trim();

    switch (cmd) {
      case '/help':       _cmdHelp();            break;
      case '/models':     _cmdModels();           break;
      case '/use':        _cmdUse(args);          break;
      case '/chat':       _cmdChat(args);         break;
      case '/search':     _cmdSearch(args);       break;
      case '/dashboard':  _cmdDashboard(args);    break;
      case '/clear':      _cmdClear();            break;
      default:
        if (input.charAt(0) !== '/') {
          _cmdChat(input); // bare text → chat
        } else {
          _line('Unknown command: ' + cmd + '  Type /help for available commands.', 'term-red');
          _gap();
        }
    }
  }

  // ── Auth gate ─────────────────────────────────────────────────────────────────

  function _promptToken() {
    _awaitToken  = true;
    inputEl.type = 'password';
    inputEl.placeholder = 'paste token here…';
    _gap();
    _line('Enter your Bearer token to continue:', 'term-yellow');
  }

  function _handleTokenInput(token) {
    var verifying = _line('Verifying token…', 'term-muted');

    window.KRAuth.verifyToken(token).then(function (valid) {
      verifying.remove();

      if (!valid) {
        _line('Token rejected (401). Try again:', 'term-red');
        return;
      }

      window.KRAuth.saveToken(token);
      _awaitToken         = false;
      inputEl.type        = 'text';
      inputEl.placeholder = 'type /help for commands';
      _gap();
      _line('Token saved. Session started.', 'term-green');
      _line('Type /help for available commands.', 'term-muted');
      _gap();

    }).catch(function () {
      verifying.remove();
      _line('Verification failed (network error). Try again:', 'term-red');
    });
  }

  // ── Logger listener ───────────────────────────────────────────────────────────
  // Activity log entries are NOT printed to terminal by default
  // to avoid noise. They're only visible in /log (future command).

  // ── Boot ─────────────────────────────────────────────────────────────────────

  function _boot() {
    _line('╔══════════════════════════════════════════════╗', 'term-muted');
    _line("║          K's Router  CLI  v1.0              ║", 'term-green');
    _line('╚══════════════════════════════════════════════╝', 'term-muted');
    _gap();
    _line('8 providers · cascade fallback · loop-ready', 'term-muted');
    _gap();

    var hydrated = window.KRAuth.hydrate();
    if (!hydrated) {
      _promptToken();
    } else {
      _line('Session active. Type /help for commands.', 'term-muted');
      _gap();
    }

    _updatePrompt();
  }

  // ── Input events ──────────────────────────────────────────────────────────────

  function _bindInput() {
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var val = inputEl.value;
        inputEl.value = '';
        _dispatch(val);

      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (_historyIdx > 0) {
          _historyIdx--;
          inputEl.value = _cmdHistory[_historyIdx] || '';
        }

      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (_historyIdx < _cmdHistory.length - 1) {
          _historyIdx++;
          inputEl.value = _cmdHistory[_historyIdx] || '';
        } else {
          _historyIdx   = _cmdHistory.length;
          inputEl.value = '';
        }
      }
    });

    // Click anywhere → focus input
    document.addEventListener('click', function () { inputEl.focus(); });
  }

  // ── Init (called from HTML after DOM ready) ───────────────────────────────────

  function init(ids) {
    outputEl = document.getElementById(ids.output);
    inputEl  = document.getElementById(ids.input);
    promptEl = document.getElementById(ids.prompt);

    if (!outputEl || !inputEl || !promptEl) {
      console.error('[TERMINAL] Missing DOM elements:', ids);
      return;
    }

    _loadHistory();
    _bindInput();
    _boot();
    inputEl.focus();
  }

  window.KRTerminal = { init: init };

}());
