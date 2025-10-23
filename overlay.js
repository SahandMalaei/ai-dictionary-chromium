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
    .qd-hide { display: none; }
    .qd-footer {
      margin-top: 12px; opacity: .6; font-size: 12px;
    }
  `;
  shadow.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'qd-wrap qd-hide';
  shadow.appendChild(wrap);

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
    wrap.textContent = "Looking it up…";
    wrap.classList.remove('qd-hide');
    requestAnimationFrame(() => placeAtRect(rect));
  }

  function hide() { wrap.classList.add('qd-hide'); }

  function showToast(msg) {
    show(msg, {left: window.innerWidth/2 - 80, right: 0, top: 24, bottom: 24, width: 160, height: 1});
    setTimeout(hide, 1200);
  }

  // Dismiss on Esc or outside click
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide();
  }, true);
  document.addEventListener('mousedown', (e) => {
    // if click is outside host/shadow, hide
    if (!rootHost.contains(e.target)) hide();
  }, true);

  window.__quickDefine = {
    showResult: show,
    showLoading,
    showToast,
    lastMouse: null,
    apiLookup: null // set by api.js
  };
})();
