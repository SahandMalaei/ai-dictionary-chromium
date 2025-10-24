(() => {
  const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
  const GEMINI_MODEL = "gemini-2.5-flash-lite";
  const GEMINI_ENDPOINT = `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent`;

  function readStoredApiKey() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve("");
        return;
      }
      chrome.storage.local.get(["geminiApiKey"], (result) => {
        if (chrome.runtime?.lastError) {
          console.warn("quick-define: storage.get error", chrome.runtime.lastError);
          resolve("");
          return;
        }
        const key = result && typeof result.geminiApiKey === "string" ? result.geminiApiKey.trim() : "";
        resolve(key);
      });
    });
  }

  async function ensureApiKey(config) {
    if (config?.geminiApiKey) return config.geminiApiKey;

    const stored = await readStoredApiKey();
    if (stored) {
      config.geminiApiKey = stored;
      return stored;
    }

    if (window.__quickDefine?.promptForApiKey) {
      try {
        const key = await window.__quickDefine.promptForApiKey();
        if (config) config.geminiApiKey = key;
        return key;
      } catch (err) {
        throw new Error("Lookup cancelled: Gemini API key required.");
      }
    }

    throw new Error("Gemini API key missing. Open the popup to add one.");
  }

  async function apiLookup(focus, context, pageTitle) {
    const config = window.__quickDefineConfig || {};
    const targetLanguage = config?.targetLanguage || "English - United States";
    const geminiApiKey = await ensureApiKey(config);

    const payload = {
      contents: [
        {
          parts: [
            {
              text: [
                `I'm an advanced language learner. I'm reading a webpage titled ${pageTitle}.`,
                `My selected text: \n'${focus}'\n`,
                `This is the context where it appears: '...${context}...'\n`,
                `Please respond in ${targetLanguage}.`,
                `ONLY for the selected text, give me an informative dictionary-style answer in this format (in ${targetLanguage}) ONCE and add nothing more:\n`,
                "/[THE ONE most standard and accurate US English pronunciation in phonetic alphabet (IPA)]/\n\n",
                "Definition: [Definition in under 20 words]\n\n",
                "Synonyms: [Up to 3 synonyms, if any exists. If there are no synonyms skip this section]\n\n",
                //"Example: [One example using the selected word in the exact same meaning]\n\n",
                "Etymology: [Helpful etymology in under 20 words]"
              ].join(" ")
            }
          ]
        }
      ]
    };

    const resp = await fetch(`${GEMINI_ENDPOINT}?key=${geminiApiKey}`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`HTTP ${resp.status} ${t || ""}`);
    }
    const body = await resp.json();
    const candidate = body?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!candidate) {
      throw new Error("Gemini response missing text content");
    }
    return focus + " " + candidate.trim();
  }

  window.__quickDefine.apiLookup = apiLookup;
})();
