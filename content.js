// Message entrypoint
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (!msg || !msg.type) return;
  switch (msg.type) {
    case "DEFINE_SELECTION":
      handleDefine();
      break;
    case "SHOW_API_KEY_PROMPT":
      handleApiKeyPromptRequest();
      break;
    case "CLEAR_STORED_DATA":
      handleClearStoredData(msg);
      break;
    default:
      break;
  }
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

  // Gather a limited number of words from the same text nodes for context
  const contextWordCount = 12;
  const { before, after } = getSurroundingText(range, contextWordCount);
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

async function handleApiKeyPromptRequest() {
  const prompt = window.__quickDefine?.promptForApiKey;
  const toast = window.__quickDefine?.showToast;

  if (typeof prompt !== "function") {
    if (typeof toast === "function") {
      toast("API key prompt unavailable on this page.");
    }
    return;
  }

  try {
    const key = await prompt();
    if (key && typeof toast === "function") {
      toast("API key saved.");
    }
  } catch (err) {
    if (err && /cancelled/i.test(String(err.message ?? ""))) {
      // User cancelled: no toast.
      return;
    }
    if (typeof toast === "function") {
      toast(err?.message || "Unable to save API key.");
    }
  }
}

function handleClearStoredData(msg) {
  if (window.__quickDefineConfig) {
    window.__quickDefineConfig.apiKey = null;
  }
  const toast = window.__quickDefine?.showToast;
  if (typeof window.__quickDefine?.hideResult === "function") {
    window.__quickDefine.hideResult();
  }
  if (typeof toast === "function") {
    if (msg?.success) {
      toast("Saved data cleared.");
    } else {
      toast(msg?.error || "Unable to clear saved data.");
    }
  }
}

// Returns the selection's first client rect (fallback to mouse if collapsed)
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

// Collect a limited number of words on each side within the same text nodes
function getSurroundingText(range, wordCount) {
  const startNode = range.startContainer;
  const endNode = range.endContainer;
  const isText = (node) => node && node.nodeType === Node.TEXT_NODE;

  const takeTrailingWords = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    return words.slice(Math.max(0, words.length - wordCount)).join(" ");
  };

  const takeLeadingWords = (text) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return "";
    return words.slice(0, wordCount).join(" ");
  };

  const before = (() => {
    if (!isText(startNode)) return "";
    const textBefore = startNode.textContent.slice(0, range.startOffset);
    return takeTrailingWords(textBefore);
  })();

  const after = (() => {
    if (!isText(endNode)) return "";
    const textAfter = endNode.textContent.slice(range.endOffset);
    return takeLeadingWords(textAfter);
  })();

  return {
    before: before ? `${before} ` : "",
    after: after ? ` ${after}` : ""
  };
}

