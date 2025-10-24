(() => {
  if (window.__quickDefine) return; // singleton

  const rootHost = document.createElement('div');
  rootHost.id = 'quick-define-host';
  rootHost.style.all = 'initial';
  rootHost.style.position = 'fixed';
  rootHost.style.zIndex = '2147483647';
  rootHost.style.inset = '0 0 auto 0'; // will position children absolutely
  document.documentElement.appendChild(rootHost);

  const shadow = rootHost.attachShadow({mode: 'open'});
  const style = document.createElement('style');
  style.textContent = `
    .qd-wrap {
      position: absolute;
      max-width: 520px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
      font-size: 15px;
      line-height: 1.4;
      background: #f9fafb;
      color: #111827;
      border: 1px solid rgba(0,0,0,.15);
      border-radius: 12px;
      box-shadow: 0 12px 28px rgba(0,0,0,.15);
      padding: 15px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .qd-footer {
      margin-top: 12px;
      opacity: .6;
      font-size: 12px;
    }
    .qd-backdrop {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(17, 24, 39, 0.35);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif;
      padding: 24px;
    }
    .qd-prompt {
      background: #f9fafb;
      color: #111827;
      border-radius: 12px;
      box-shadow: 0 20px 45px rgba(15, 23, 42, 0.35);
      padding: 20px;
      width: min(360px, calc(100vw - 48px));
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .qd-prompt h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    .qd-prompt p {
      margin: 0;
      font-size: 13px;
      color: #4b5563;
    }
    .qd-prompt label {
      font-weight: 600;
      font-size: 13px;
    }
    .qd-prompt input {
      width: 100%;
      padding: 8px 10px;
      border: 1px solid rgba(17, 24, 39, 0.15);
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      box-sizing: border-box;
    }
    .qd-prompt input:focus {
      outline: 2px solid rgba(59, 130, 246, 0.35);
      outline-offset: 1px;
    }
    .qd-prompt .qd-error {
      min-height: 16px;
      font-size: 12px;
      color: #b91c1c;
    }
    .qd-prompt .qd-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .qd-prompt button {
      padding: 8px 14px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
    }
    .qd-prompt button[disabled] {
      opacity: 0.6;
      cursor: default;
    }
    .qd-prompt .qd-btn-secondary {
      background: #e5e7eb;
      color: #1f2937;
    }
    .qd-prompt .qd-btn-primary {
      background: #2563eb;
      color: #f9fafb;
    }
    .qd-hide {
      display: none !important;
    }
  `;
  shadow.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'qd-wrap qd-hide';
  shadow.appendChild(wrap);

  const promptBackdrop = document.createElement('div');
  promptBackdrop.className = 'qd-backdrop qd-hide';

  const promptForm = document.createElement('form');
  promptForm.className = 'qd-prompt';

  const promptTitle = document.createElement('h2');
  promptTitle.textContent = 'Enter Gemini API key';
  promptForm.appendChild(promptTitle);

  const promptDescription = document.createElement('p');
  promptDescription.textContent = 'Enter your Google AI Studio API key so lookups can run.';
  promptForm.appendChild(promptDescription);

  const promptLabel = document.createElement('label');
  promptLabel.setAttribute('for', 'quick-define-api-key');
  promptLabel.textContent = 'API key';
  promptForm.appendChild(promptLabel);

  const promptInput = document.createElement('input');
  promptInput.type = 'password';
  promptInput.id = 'quick-define-api-key';
  promptInput.name = 'apiKey';
  promptInput.placeholder = 'API Key...';
  promptInput.autocomplete = 'off';
  promptInput.spellcheck = false;
  promptForm.appendChild(promptInput);

  const promptError = document.createElement('div');
  promptError.className = 'qd-error';
  promptForm.appendChild(promptError);

  const promptActions = document.createElement('div');
  promptActions.className = 'qd-actions';
  promptForm.appendChild(promptActions);

  const promptCancel = document.createElement('button');
  promptCancel.type = 'button';
  promptCancel.className = 'qd-btn-secondary';
  promptCancel.textContent = 'Cancel';
  promptActions.appendChild(promptCancel);

  const promptSave = document.createElement('button');
  promptSave.type = 'submit';
  promptSave.className = 'qd-btn-primary';
  promptSave.textContent = 'Save key';
  promptActions.appendChild(promptSave);

  promptBackdrop.appendChild(promptForm);
  shadow.appendChild(promptBackdrop);

  function placeAtRect(rect) {
    const margin = 8;
    const vw = window.innerWidth, vh = window.innerHeight;
    // default below selection, clamped to viewport
    let left = Math.min(Math.max(rect.left, margin), vw - wrap.offsetWidth - margin);
    let top  = Math.min(rect.bottom + margin, vh - wrap.offsetHeight - margin);
    wrap.style.left = `${left}px`;
    wrap.style.top  = `${top}px`;
  }

  function show(text, rect) {
    wrap.textContent = ""; // clear
    const pre = document.createElement('div');
    pre.textContent = text;
    wrap.appendChild(pre);
    const foot = document.createElement('div');
    foot.className = 'qd-footer';
    foot.textContent = 'Esc / click outside to close';
    wrap.appendChild(foot);

    wrap.classList.remove('qd-hide');
    // need size to place
    requestAnimationFrame(() => placeAtRect(rect));
  }

  function showLoading(rect) {
    wrap.textContent = "Looking it up...";
    wrap.classList.remove('qd-hide');
    requestAnimationFrame(() => placeAtRect(rect));
  }

  function hide() { wrap.classList.add('qd-hide'); }

  function showToast(msg) {
    show(msg, {left: window.innerWidth/2 - 80, right: 0, top: 24, bottom: 24, width: 160, height: 1});
    setTimeout(hide, 1200);
  }

  const SAVE_BUTTON_DEFAULT = 'Save key';
  const SAVE_BUTTON_BUSY = 'Saving...';
  let promptState = null;

  function isPromptVisible() {
    return !promptBackdrop.classList.contains('qd-hide');
  }

  function setPromptBusy(busy) {
    promptInput.disabled = busy;
    promptSave.disabled = busy;
    promptCancel.disabled = busy;
    promptSave.textContent = busy ? SAVE_BUTTON_BUSY : SAVE_BUTTON_DEFAULT;
  }

  function resetPromptForm() {
    setPromptBusy(false);
    promptError.textContent = "";
    promptForm.reset();
    promptInput.value = "";
  }

  function cancelPrompt(reason) {
    if (!isPromptVisible() && !promptState) return;
    const state = promptState;
    promptState = null;
    resetPromptForm();
    promptBackdrop.classList.add('qd-hide');
    if (state && state.reject) {
      state.reject(reason || new Error("API key entry cancelled"));
    }
  }

  function finishPrompt(key) {
    const state = promptState;
    promptState = null;
    resetPromptForm();
    promptBackdrop.classList.add('qd-hide');
    if (window.__quickDefineConfig) {
      window.__quickDefineConfig.geminiApiKey = key;
    }
    if (state && state.resolve) state.resolve(key);
  }

  function handlePromptSubmit() {
    const key = promptInput.value.trim();
    if (!key) {
      promptError.textContent = "Please enter a valid API key.";
      promptInput.focus();
      return;
    }

    promptError.textContent = "";
    setPromptBusy(true);

    const applyKey = () => finishPrompt(key);
    if (chrome?.storage?.local) {
      chrome.storage.local.set({geminiApiKey: key}, () => {
        if (chrome.runtime?.lastError) {
          promptError.textContent = chrome.runtime.lastError.message || "Unable to save API key.";
          setPromptBusy(false);
          return;
        }
        applyKey();
      });
    } else {
      applyKey();
    }
  }

  function promptForApiKey() {
    if (promptState && promptState.promise) {
      return promptState.promise;
    }

    hide();
    resetPromptForm();
    promptBackdrop.classList.remove('qd-hide');

    const existingKey = window.__quickDefineConfig?.geminiApiKey || "";
    if (existingKey) {
      promptInput.value = existingKey;
    }

    const state = {};
    state.promise = new Promise((resolve, reject) => {
      state.resolve = resolve;
      state.reject = reject;
    });
    promptState = state;

    requestAnimationFrame(() => {
      promptInput.focus();
      if (promptInput.value) {
        promptInput.select();
      }
    });

    return state.promise;
  }

  promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handlePromptSubmit();
  });
  promptCancel.addEventListener('click', () => cancelPrompt(new Error("API key entry cancelled")));
  promptBackdrop.addEventListener('mousedown', (e) => {
    if (e.target === promptBackdrop) cancelPrompt(new Error("API key entry cancelled"));
  });

  // Dismiss on Esc or outside click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isPromptVisible()) {
        cancelPrompt(new Error("API key entry cancelled"));
      } else {
        hide();
      }
    }
  }, true);
  document.addEventListener('mousedown', (e) => {
    // if click is outside host/shadow, hide
    if (!rootHost.contains(e.target)) {
      if (isPromptVisible()) {
        cancelPrompt(new Error("API key entry cancelled"));
      } else {
        hide();
      }
    }
  }, true);

  window.__quickDefine = {
    showResult: show,
    showLoading,
    showToast,
    hideResult: hide,
    promptForApiKey,
    lastMouse: null,
    apiLookup: null // set by api.js
  };
})();

