// Message entrypoint
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (msg?.type === "DEFINE_SELECTION") handleDefine();
});

async function handleDefine() {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) {
    window.__quickDefine.showToast("No selection.");
    return;
  }
  const range = sel.getRangeAt(0);
  const focus = sel.toString().trim();
  if (!focus) {
    window.__quickDefine.showToast("No selection.");
    return;
  }

  // Gather ±N characters of context from surrounding text nodes
  const contextChars = 80;
  const { before, after } = getSurroundingText(range, contextChars);
  const context = `${before}**${focus}**${after}`.trim();

  // Anchor rect for popup (viewport coordinates)
  const rect = getRangeRect(range);

  window.__quickDefine.showLoading(rect);
  try {
    const pageTitle = document.title || "";
    const formatted = await window.__quickDefine.apiLookup(focus, context, pageTitle);
    window.__quickDefine.showResult(formatted, rect);
  } catch (e) {
    window.__quickDefine.showResult(`[Error]\n***Definition:*** ${e.message || e}`, rect);
  }
}

// Returns the selection’s first client rect (fallback to mouse if collapsed)
function getRangeRect(range) {
  const rects = range.getClientRects();
  let r = rects.length ? rects[0] : range.getBoundingClientRect();
  if (!r || (r.width === 0 && r.height === 0)) {
    // fallback to mouse
    const x = window.__quickDefine.lastMouse?.x ?? window.innerWidth / 2;
    const y = window.__quickDefine.lastMouse?.y ?? window.innerHeight / 2;
    r = {left: x, top: y, width: 1, height: 1, right: x+1, bottom: y+1};
  }
  return r;
}

// Track mouse for better fallback placement
window.addEventListener("mousemove", (e) => {
  window.__quickDefine.lastMouse = {x: e.clientX, y: e.clientY};
}, {passive: true});

// Walk text nodes to collect ±N chars around the range
function getSurroundingText(range, N) {
  const startNode = range.startContainer;
  const endNode   = range.endContainer;
  const isText = (n) => n && n.nodeType === Node.TEXT_NODE;

  // Serialize selection to know offsets
  let selected = range.toString();

  // Collect before
  let before = "";
  {
    let node = startNode;
    let offset = range.startOffset;
    // Pull from current text node backwards
    if (isText(node)) {
      before = node.textContent.slice(Math.max(0, offset - N), offset);
    }
    // If still short, walk previous text nodes
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    walker.currentNode = isText(node) ? node : range.commonAncestorContainer;
    // Move back through nodes
    while (before.length < N && walker.previousNode()) {
      const t = walker.currentNode.textContent.trim();
      if (t) before = t.slice(-Math.min(N - before.length, t.length)) + before;
    }
    before = trimWhitespace(before);
  }

  // Collect after
  let after = "";
  {
    let node = endNode;
    let offset = range.endOffset;
    if (isText(node)) {
      after = node.textContent.slice(offset, offset + N);
    }
    let walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    walker.currentNode = isText(node) ? node : range.commonAncestorContainer;
    while (after.length < N && walker.nextNode()) {
      const t = walker.currentNode.textContent.trim();
      if (t) after += t.slice(0, Math.min(N - after.length, t.length));
    }
    after = trimWhitespace(after);
  }

  // Clean up line breaks
  function trimWhitespace(s) { return s.replace(/\s+/g, " ").trimStart(); }
  return { before: before ? before + " " : "", after: after ? " " + after : "" };
}
