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
  const mediaItems = collectMediaFromPage();
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
    openSummaryTab(summaryHtml, title, url, mediaItems);
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

function getContentRoot() {
  const pick = (selector) => {
    const el = document.querySelector(selector);
    if (el && typeof el.innerText === "string") {
      return el;
    }
    return null;
  };

  const candidates = [pick("article"), pick("main"), document.body || null].filter(Boolean);
  const preferred = candidates.find((el) => el.innerText.trim().length > 300);
  return preferred || candidates[0] || null;
}

function getPageContent() {
  const root = getContentRoot();
  const content = root?.innerText || "";
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

function resolveUrl(url) {
  if (typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const absolute = new URL(trimmed, document.baseURI).href;
    if (!/^https?:|^data:|^blob:/i.test(absolute)) return "";
    return absolute;
  } catch {
    return "";
  }
}

function isLikelyAd(el) {
  const marker = `${el.className || ""} ${el.id || ""}`.toLowerCase();
  return /(\b|_)(ad|ads|advert|sponsor|promo|banner)[\w-]*\b/.test(marker);
}

function isHiddenOrTiny(el) {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") {
    return true;
  }
  const rect = el.getBoundingClientRect();
  return rect.width < 40 || rect.height < 40;
}

function collectMediaFromPage() {
  const root = getContentRoot();
  if (!root) return [];

  const media = [];
  const seen = new Set();
  const MAX_MEDIA_ITEMS = 12;

  const addItem = (item) => {
    if (!item?.src) return;
    if (seen.has(item.src)) return;
    seen.add(item.src);
    media.push(item);
  };

  const images = root.querySelectorAll("img");
  for (const img of images) {
    if (media.length >= MAX_MEDIA_ITEMS) break;
    if (isLikelyAd(img) || isHiddenOrTiny(img)) continue;
    const src =
      resolveUrl(img.currentSrc) ||
      resolveUrl(img.src) ||
      resolveUrl(img.getAttribute("data-src") || img.getAttribute("data-lazy-src") || "");
    if (!src) continue;
    addItem({
      type: "image",
      src,
      alt: (img.alt || "").trim()
    });
  }

  const videos = root.querySelectorAll("video");
  for (const video of videos) {
    if (media.length >= MAX_MEDIA_ITEMS) break;
    if (isLikelyAd(video) || isHiddenOrTiny(video)) continue;
    const src =
      resolveUrl(video.currentSrc) ||
      resolveUrl(video.src) ||
      resolveUrl(video.querySelector("source")?.src || video.getAttribute("data-src") || "");
    if (!src) continue;
    addItem({
      type: "video",
      src,
      poster: resolveUrl(video.poster || "")
    });
  }

  const iframes = root.querySelectorAll("iframe");
  for (const frame of iframes) {
    if (media.length >= MAX_MEDIA_ITEMS) break;
    if (isLikelyAd(frame) || isHiddenOrTiny(frame)) continue;
    const src = resolveUrl(frame.src || frame.getAttribute("data-src") || "");
    if (!src) continue;
    const host = (() => {
      try {
        return new URL(src).hostname || "";
      } catch {
        return "";
      }
    })();
    const isVideoHost = /youtube\.com|youtu\.be|vimeo\.com/.test(host);
    if (!isVideoHost) continue;
    addItem({
      type: "embed",
      src
    });
  }

  return media;
}

function buildMediaSection(mediaItems) {
  if (!Array.isArray(mediaItems) || mediaItems.length === 0) return "";

  const mediaHtml = mediaItems
    .map((item) => {
      const src = escapeHtml(item.src);
      switch (item.type) {
        case "image": {
          const alt = item.alt ? escapeHtml(item.alt) : "Article image";
          return `<figure class="qd-media-item"><img src="${src}" alt="${alt}">${item.alt ? `<figcaption>${alt}</figcaption>` : ""}</figure>`;
        }
        case "video": {
          const poster = item.poster ? ` poster="${escapeHtml(item.poster)}"` : "";
          return `<figure class="qd-media-item"><video controls preload="metadata"${poster} src="${src}"></video></figure>`;
        }
        case "embed": {
          return `<div class="qd-media-item qd-media-embed"><iframe src="${src}" loading="lazy" allowfullscreen></iframe></div>`;
        }
        default:
          return "";
      }
    })
    .filter(Boolean)
    .join("");

  if (!mediaHtml) return "";

  return `<section class="qd-media"><h2>Media</h2><div class="qd-media-list">${mediaHtml}</div></section>`;
}

function buildSummaryDocument(summaryHtml, pageTitle, pageUrl, mediaItems) {
  const safeTitle = escapeHtml(pageTitle || "Summary");
  const safeUrl = escapeHtml(pageUrl || "");
  const mediaSection = buildMediaSection(mediaItems);
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
      background: #EDE4DB;
      color: #000000;
      line-height: 1.6;
    }
    @media (prefers-color-scheme: dark) {
      body { background: #EDE4DB; color: #000000; }
      a { color: #000000; }
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
      border-left: 4px solid #EDE4DB;
      background: #EDE4DB;
      border-radius: 6px;
    }
    em { color: inherit; opacity: 0.85; }
    .qd-media {
      margin-top: 26px;
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
    }
    .qd-media-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .qd-media-item {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 6px 16px rgba(0,0,0,0.06);
    }
    .qd-media-item img,
    .qd-media-item video,
    .qd-media-item iframe {
      display: block;
      width: 100%;
      max-height: 440px;
      object-fit: contain;
      background: #f8fafc;
    }
    .qd-media-item figcaption {
      padding: 8px 10px 10px;
      font-size: 13px;
      color: #475569;
    }
    .qd-media-embed iframe {
      border: 0;
      aspect-ratio: 16 / 9;
    }
  </style>
</head>
<body>
  <h1>Summary</h1>
  <div class="meta">${safeTitle}${safeUrl ? ` - <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open original</a>` : ""}</div>
  <article class="qd-summary">${summaryHtml}${mediaSection}</article>
</body>
</html>`;
}

function openSummaryTab(summaryHtml, pageTitle, pageUrl, mediaItems) {
  const doc = buildSummaryDocument(summaryHtml, pageTitle, pageUrl, mediaItems);
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

