(() => {
  const config = {
    geminiApiKey: null,
    targetLanguage: "English - United States"
  };
  window.__quickDefineConfig = config;

  if (chrome?.storage?.local) {
    chrome.storage.local.get(["geminiApiKey"], (result) => {
      const key = result?.geminiApiKey;
      if (typeof key === "string" && key.trim()) {
        config.geminiApiKey = key.trim();
      }
    });
  }
})();
