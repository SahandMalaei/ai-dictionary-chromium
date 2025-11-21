(() => {
  const DEFAULT_API_BASE = "https://openrouter.ai/api/v1";
  const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

  const config = {
    apiKey: null,
    apiBase: DEFAULT_API_BASE,
    model: DEFAULT_MODEL,
    targetLanguage: "English - United States"
  };
  window.__quickDefineConfig = config;

  if (chrome?.storage?.local) {
    chrome.storage.local.get(
      ["apiKey", "openRouterApiKey", "geminiApiKey", "apiBase", "model"],
      (result) => {
        const key =
          result?.apiKey ||
          result?.openRouterApiKey ||
          result?.geminiApiKey ||
          "";
        if (typeof key === "string" && key.trim()) {
          config.apiKey = key.trim();
        }
        const base = result?.apiBase;
        if (typeof base === "string" && base.trim()) {
          config.apiBase = base.trim();
        }
        const model = result?.model;
        if (typeof model === "string" && model.trim()) {
          config.model = model.trim();
        }
      }
    );
  }
})();
