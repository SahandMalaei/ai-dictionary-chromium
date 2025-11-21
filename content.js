// Message entrypoint
chrome.runtime.onMessage.addListener((msg, _sender, _sendResponse) => {
  if (!msg || !msg.type) return;
  const isTop = window === window.top;
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
    case "SUMMARIZE_PAGE":
      if (isTop) {
        handleSummarizePage();
      }
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

let isSummarizing = false;

async function handleSummarizePage() {
  if (isSummarizing) return;
  isSummarizing = true;
  const summarize = window.__quickDefine?.summarizePage;
  const toast = window.__quickDefine?.showToast;
  if (typeof summarize !== "function") {
    if (typeof toast === "function") toast("Summaries unavailable on this page.");
    isSummarizing = false;
    return;
  }

  const pageText = getPageContent();
  if (!pageText) {
    if (typeof toast === "function") toast("No readable content found.");
    isSummarizing = false;
    return;
  }

  if (typeof toast === "function") {
    toast("Summarizing page...");
  }

  try {
    const title = document.title || "";
    const url = window.location?.href || "";
    const summaryHtml = await summarize(pageText, title, url);
    openSummaryTab(summaryHtml, title, url);
  } catch (err) {
    if (typeof toast === "function") {
      const msg = err?.message || "Unable to summarize.";
      toast(msg);
    }
  } finally {
    isSummarizing = false;
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

function getPageContent() {
  const pick = (selector) => {
    const el = document.querySelector(selector);
    return el?.innerText || "";
  };

  const candidates = [
    pick("article"),
    pick("main"),
    document.body?.innerText || ""
  ];

  const content = candidates.find((text) => text && text.trim().length > 300) || candidates[0] || "";
  const cleaned = content.replace(/\s+/g, " ").trim();
  const maxChars = 16000;
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) : cleaned;
}

function escapeHtml(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildSummaryDocument(summaryHtml, pageTitle, pageUrl) {
  const safeTitle = escapeHtml(pageTitle || "Summary");
  const safeUrl = escapeHtml(pageUrl || "");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Summary - ${safeTitle}</title>
  <style>
    :root {
      color-scheme: light dark;
    }
    body {
      margin: 0 auto;
      padding: 32px 22px 48px;
      max-width: 860px;
      font-family: "SF Pro Text", "Segoe UI", -apple-system, system-ui, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.6;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #0b1220; color: #e2e8f0; }
      a { color: #7cc4ff; }
    }
    h1 {
      margin: 0;
      font-size: 26px;
      letter-spacing: -0.4px;
    }
    .meta {
      margin: 6px 0 20px;
      color: #475569;
      font-size: 14px;
    }
    section { margin-bottom: 18px; }
    h2 { margin: 16px 0 8px; font-size: 20px; }
    ul, ol { padding-left: 20px; margin: 6px 0 12px; }
    blockquote {
      margin: 10px 0;
      padding: 12px 14px;
      border-left: 4px solid #2563eb;
      background: rgba(37, 99, 235, 0.08);
      border-radius: 6px;
    }
    em { color: inherit; opacity: 0.85; }
  </style>
</head>
<body>
  <h1>Summary</h1>
  <div class="meta">${safeTitle}${safeUrl ? ` - <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open original</a>` : ""}</div>
  <article class="qd-summary">${summaryHtml}</article>
</body>
</html>`;
}

function openSummaryTab(summaryHtml, pageTitle, pageUrl) {
  const doc = buildSummaryDocument(summaryHtml, pageTitle, pageUrl);
  chrome.runtime.sendMessage({ type: "OPEN_SUMMARY_TAB", html: doc }, (resp) => {
    if (chrome.runtime.lastError || resp?.ok === false) {
      const url = URL.createObjectURL(new Blob([doc], { type: "text/html" }));
      const fallback = window.open(url, "_blank", "noopener");
      if (!fallback && typeof window.__quickDefine?.showToast === "function") {
        window.__quickDefine.showToast("Allow popups to view the summary.");
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    }
  });
}

