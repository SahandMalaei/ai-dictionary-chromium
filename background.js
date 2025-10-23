chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "quick-define",
    title: "Define selection",
    contexts: ["selection"]
  });
});

chrome.commands.onCommand.addListener(async (cmd) => {
  if (cmd === "define-selection") {
    console.error("1");
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (tab?.id) chrome.tabs.sendMessage(tab.id, {type: "DEFINE_SELECTION"});
  }
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "quick-define" && tab?.id) {
    console.error("2");
    chrome.tabs.sendMessage(tab.id, {type: "DEFINE_SELECTION"});
  }
});
