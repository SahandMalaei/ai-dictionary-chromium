(() => {
  const DEFAULT_API_BASE = "https://api.openai.com/v1";
  const DEFAULT_MODEL = "gpt-5-nano";

  const config = {
    apiKey: null,
    apiBase: DEFAULT_API_BASE,
    dictionaryModel: DEFAULT_MODEL,
    summarizeModel: DEFAULT_MODEL,
    targetLanguage: "English - United States"
  };
  window.__quickDefineConfig = config;

  if (chrome?.storage?.local) {
    chrome.storage.local.get(
      [
        "apiKey",
        "openRouterApiKey",
        "geminiApiKey",
        "apiBase",
        "model",
        "dictionaryModel",
        "summarizeModel"
      ],
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
        const model = typeof result?.model === "string" ? result.model.trim() : "";

        const dictionaryModel =
          (typeof result?.dictionaryModel === "string" && result.dictionaryModel.trim()) ||
          model;
        if (dictionaryModel) {
          config.dictionaryModel = dictionaryModel;
        }

        const summarizeModel =
          (typeof result?.summarizeModel === "string" && result.summarizeModel.trim()) ||
          model;
        if (summarizeModel) {
          config.summarizeModel = summarizeModel;
        }
      }
    );
  }
})();
