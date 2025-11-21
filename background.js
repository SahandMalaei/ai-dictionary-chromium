const MENU_SELECTION = "quick-define-selection";
const MENU_SET_API_KEY = "quick-define-set-api-key";
const MENU_CLEAR_DATA = "quick-define-clear-data";
const MENU_SUMMARIZE = "quick-define-summarize-page";
const SUMMARY_SCRIPTS = ["config.js", "overlay.js", "api.js", "content.js"];
const SUMMARY_STYLES = ["overlay.css"];

function createMenuItem(options) {
  chrome.contextMenus.create(options, () => {
    if (chrome.runtime.lastError) {
      console.warn("quick-define: contextMenus.create", chrome.runtime.lastError);
    }
  });
}

function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    createMenuItem({
      id: MENU_SELECTION,
      title: "Define Selection",
      contexts: ["selection"]
    });
    createMenuItem({
      id: MENU_SUMMARIZE,
      title: "Summarize",
      contexts: ["action"]
    });
    createMenuItem({
      id: MENU_SET_API_KEY,
      title: "Set API Key",
      contexts: ["action"]
    });
    createMenuItem({
      id: MENU_CLEAR_DATA,
      title: "Clear Data",
      contexts: ["action"]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  registerContextMenus();
});

if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    registerContextMenus();
  });
}

// Fallback for service worker cold starts
registerContextMenus();

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function sendMessageToTab(tabId, message) {
  if (!tabId) return;
  try {
    await chrome.tabs.sendMessage(tabId, message);
  } catch (err) {
    // Ignore missing receivers (e.g., chrome:// pages)
    if (!String(err?.message).includes("Receiving end does not exist")) {
      console.warn("quick-define: sendMessage error", err);
    }
  }
}

async function triggerDefineSelection() {
  const tab = await getActiveTab();
  if (tab?.id) {
    await sendMessageToTab(tab.id, { type: "DEFINE_SELECTION" });
  }
}

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd === "define-selection") {
    await triggerDefineSelection();
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  switch (info.menuItemId) {
    case MENU_SELECTION:
      if (tab?.id) {
        await sendMessageToTab(tab.id, { type: "DEFINE_SELECTION" });
      }
      break;
    case MENU_SUMMARIZE:
      if (tab?.id) {
        await sendMessageToTab(tab.id, { type: "SUMMARIZE_PAGE" });
      }
      break;
    case MENU_SET_API_KEY:
      if (tab?.id) {
        await sendMessageToTab(tab.id, {
          type: "SHOW_API_KEY_PROMPT",
          source: "contextMenu"
        });
      }
      break;
    case MENU_CLEAR_DATA:
      chrome.storage.local.remove(["apiKey", "openRouterApiKey", "geminiApiKey"], () => {
        const success = !chrome.runtime.lastError;
        const payload = {
          type: "CLEAR_STORED_DATA",
          success,
          error: chrome.runtime.lastError?.message || ""
        };
        (async () => {
          try {
            const tabs = await chrome.tabs.query({});
            for (const t of tabs) {
              await sendMessageToTab(t.id, payload);
            }
          } catch (err) {
            console.warn("quick-define: notify tabs failed", err);
          }
        })();
      });
      break;
    default:
      break;
  }
});

async function openSummaryTabFromBackground(html) {
  const tab = await chrome.tabs.create({ url: "about:blank" });
  const target = { tabId: tab.id };

  // Write summary document
  await chrome.scripting.executeScript({
    target,
    world: "MAIN",
    func: (docHtml) => {
      document.open();
      document.write(docHtml);
      document.close();
    },
    args: [html]
  });

  // Inject styles first
  await chrome.scripting.insertCSS({
    target,
    files: SUMMARY_STYLES
  });

  // Inject our content/overlay stack so the dictionary popup works on the summary tab.
  await chrome.scripting.executeScript({
    target,
    files: SUMMARY_SCRIPTS
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "OPEN_SUMMARY_TAB" && typeof message?.html === "string") {
    (async () => {
      try {
        await openSummaryTabFromBackground(message.html);
        sendResponse({ ok: true });
      } catch (err) {
        console.warn("quick-define: failed to open summary tab", err);
        sendResponse({ ok: false, error: err?.message || "Unable to open summary tab." });
      }
    })();
    return true; // async response
  }
  return false;
});
