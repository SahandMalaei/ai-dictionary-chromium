(() => {
  if (window.__quickDefine) return; // singleton

  const DEFAULT_API_BASE = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-5-nano";

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
    .qd-field {
      display: flex;
      flex-direction: column;
      gap: 6px;
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
  promptForm.appendChild(promptTitle);

  const promptDescription = document.createElement('p');
  promptForm.appendChild(promptDescription);

  const promptFields = {};
  function createField(key, id, labelText, type, placeholder) {
    const wrap = document.createElement('div');
    wrap.className = 'qd-field';
    const label = document.createElement('label');
    label.setAttribute('for', id);
    label.textContent = labelText;
    const input = document.createElement('input');
    input.id = id;
    input.name = key;
    input.type = type;
    input.placeholder = placeholder;
    input.autocomplete = 'off';
    input.spellcheck = false;
    wrap.appendChild(label);
    wrap.appendChild(input);
    promptForm.appendChild(wrap);
    promptFields[key] = { wrap, label, input };
    return promptFields[key];
  }

  const fieldApiKey = createField('apiKey', 'quick-define-api-key', 'API key', 'password', 'API Key...');
  const fieldApiBase = createField('apiBase', 'quick-define-api-base', 'API endpoint', 'text', 'https://api.openai.com/v1');
  const fieldDictionaryModel = createField('dictionaryModel', 'quick-define-dictionary-model', 'Dictionary model', 'text', 'gpt-5-nano');
  const fieldSummarizeModel = createField('summarizeModel', 'quick-define-summarize-model', 'Summarize model', 'text', 'gpt-5-nano');

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
  promptSave.textContent = 'Save';
  promptActions.appendChild(promptSave);

  promptBackdrop.appendChild(promptForm);
  shadow.appendChild(promptBackdrop);

  const PROMPT_MODE_API_KEY = 'api-key';
  const PROMPT_MODE_API_OPTIONS = 'api-options';

  const promptCopy = {
    [PROMPT_MODE_API_KEY]: {
      title: 'Enter OpenAI-Compatible API key',
      description: 'Enter your OpenAI (or OpenRouter/other OpenAI-compatible) API key so lookups can run.',
      fields: ['apiKey']
    },
    [PROMPT_MODE_API_OPTIONS]: {
      title: 'Advanced API Options',
      description: 'Set the API endpoint and per-feature models (OpenAI-compatible).',
      fields: ['apiBase', 'dictionaryModel', 'summarizeModel']
    }
  };

  let promptMode = PROMPT_MODE_API_KEY;

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

  const SAVE_BUTTON_DEFAULT = 'Save';
  const SAVE_BUTTON_BUSY = 'Saving...';
  let promptState = null;

  function isPromptVisible() {
    return !promptBackdrop.classList.contains('qd-hide');
  }

  function showFields(fieldsToShow = []) {
    const visible = new Set(fieldsToShow);
    Object.entries(promptFields).forEach(([key, field]) => {
      if (visible.has(key)) {
        field.wrap.classList.remove('qd-hide');
      } else {
        field.wrap.classList.add('qd-hide');
      }
    });
  }

  function applyPromptCopy(mode) {
    promptMode = mode;
    const copy = promptCopy[mode] || promptCopy[PROMPT_MODE_API_KEY];
    promptTitle.textContent = copy.title;
    promptDescription.textContent = copy.description;
    showFields(copy.fields || []);
  }

  function setPromptBusy(busy) {
    Object.values(promptFields).forEach(({ input }) => {
      input.disabled = busy;
    });
    promptSave.disabled = busy;
    promptCancel.disabled = busy;
    promptSave.textContent = busy ? SAVE_BUTTON_BUSY : SAVE_BUTTON_DEFAULT;
  }

  function resetPromptForm(mode = promptMode) {
    applyPromptCopy(mode);
    setPromptBusy(false);
    promptError.textContent = "";
    Object.values(promptFields).forEach(({ input }) => {
      input.value = "";
    });
    promptForm.reset();
  }

  function cancelPrompt(reason) {
    if (!isPromptVisible() && !promptState) return;
    const state = promptState;
    promptState = null;
    resetPromptForm();
    promptBackdrop.classList.add('qd-hide');
    if (state && state.reject) {
      state.reject(reason || new Error("Entry cancelled"));
    }
  }

  function finishPrompt(value) {
    const state = promptState;
    promptState = null;
    resetPromptForm();
    promptBackdrop.classList.add('qd-hide');
    if (window.__quickDefineConfig) {
      if (promptMode === PROMPT_MODE_API_OPTIONS && value && typeof value === "object") {
        window.__quickDefineConfig.apiBase = value.apiBase;
        window.__quickDefineConfig.dictionaryModel = value.dictionaryModel;
        window.__quickDefineConfig.summarizeModel = value.summarizeModel;
      } else {
        window.__quickDefineConfig.apiKey = value;
      }
    }
    if (state && state.resolve) state.resolve(value);
  }

  function handlePromptSubmit() {
    promptError.textContent = "";
    setPromptBusy(true);

    if (promptMode === PROMPT_MODE_API_OPTIONS) {
      const apiBase = promptFields.apiBase.input.value.trim();
      const dictionaryModel = promptFields.dictionaryModel.input.value.trim();
      const summarizeModel = promptFields.summarizeModel.input.value.trim();

      if (!apiBase) {
        promptError.textContent = "Enter an HTTPS endpoint, e.g. https://api.openai.com/v1";
        setPromptBusy(false);
        promptFields.apiBase.input.focus();
        return;
      }
      if (!/^https?:\/\//i.test(apiBase)) {
        promptError.textContent = "Endpoint must start with http(s)://";
        setPromptBusy(false);
        promptFields.apiBase.input.focus();
        return;
      }
      if (!dictionaryModel) {
        promptError.textContent = "Enter a model for dictionary lookups.";
        setPromptBusy(false);
        promptFields.dictionaryModel.input.focus();
        return;
      }
      if (!summarizeModel) {
        promptError.textContent = "Enter a model for summaries.";
        setPromptBusy(false);
        promptFields.summarizeModel.input.focus();
        return;
      }

      const normalizedBase = apiBase.replace(/\/+$/, "");
      const payload = {
        apiBase: normalizedBase,
        dictionaryModel,
        summarizeModel
      };
      const applyOptions = () => finishPrompt(payload);
      if (chrome?.storage?.local) {
        chrome.storage.local.set(payload, () => {
          if (chrome.runtime?.lastError) {
            promptError.textContent = chrome.runtime.lastError.message || "Unable to save API options.";
            setPromptBusy(false);
            return;
          }
          applyOptions();
        });
      } else {
        applyOptions();
      }
      return;
    }

    const key = promptFields.apiKey.input.value.trim();
    if (!key) {
      promptError.textContent = "Please enter a valid API key.";
      setPromptBusy(false);
      promptFields.apiKey.input.focus();
      return;
    }

    const applyKey = () => finishPrompt(key);
    if (chrome?.storage?.local) {
      const toStore = { apiKey: key, openRouterApiKey: key };
      chrome.storage.local.set(toStore, () => {
        if (chrome.runtime?.lastError) {
          promptError.textContent = chrome.runtime.lastError.message || "Unable to save API key.";
          setPromptBusy(false);
          return;
        }
        // clean up any legacy keys when possible
        chrome.storage.local.remove(["geminiApiKey"], () => applyKey());
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
    resetPromptForm(PROMPT_MODE_API_KEY);
    promptBackdrop.classList.remove('qd-hide');

    const existingKey = window.__quickDefineConfig?.apiKey || "";
    if (existingKey) {
      promptFields.apiKey.input.value = existingKey;
    }

    const state = {};
    state.promise = new Promise((resolve, reject) => {
      state.resolve = resolve;
      state.reject = reject;
    });
    promptState = state;

    requestAnimationFrame(() => {
      promptFields.apiKey.input.focus();
      if (promptFields.apiKey.input.value) {
        promptFields.apiKey.input.select();
      }
    });

    return state.promise;
  }

  function promptForApiOptions() {
    if (promptState && promptState.promise) {
      return promptState.promise;
    }

    hide();
    resetPromptForm(PROMPT_MODE_API_OPTIONS);
    promptBackdrop.classList.remove('qd-hide');

    const cfg = window.__quickDefineConfig || {};
    promptFields.apiBase.input.value = cfg.apiBase || DEFAULT_API_BASE;
    promptFields.dictionaryModel.input.value =
      cfg.dictionaryModel || cfg.model || DEFAULT_MODEL;
    promptFields.summarizeModel.input.value =
      cfg.summarizeModel || cfg.model || DEFAULT_MODEL;

    const state = {};
    state.promise = new Promise((resolve, reject) => {
      state.resolve = resolve;
      state.reject = reject;
    });
    promptState = state;

    requestAnimationFrame(() => {
      promptFields.apiBase.input.focus();
      if (promptFields.apiBase.input.value) {
        promptFields.apiBase.input.select();
      }
    });

    return state.promise;
  }

  promptForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handlePromptSubmit();
  });
  promptCancel.addEventListener('click', () => cancelPrompt(new Error("Entry cancelled")));
  promptBackdrop.addEventListener('mousedown', (e) => {
    if (e.target === promptBackdrop) cancelPrompt(new Error("Entry cancelled"));
  });

  // Dismiss on Esc or outside click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (isPromptVisible()) {
        cancelPrompt(new Error("Entry cancelled"));
      } else {
        hide();
      }
    }
  }, true);
  document.addEventListener('mousedown', (e) => {
    // if click is outside host/shadow, hide
    if (!rootHost.contains(e.target)) {
      if (isPromptVisible()) {
        cancelPrompt(new Error("Entry cancelled"));
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
    promptForApiOptions,
    lastMouse: null,
    apiLookup: null // set by api.js
  };
})();
