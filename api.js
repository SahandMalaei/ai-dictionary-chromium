(() => {
  const DEFAULT_API_BASE = "https://openrouter.ai/api/v1";
  const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";

  function readStoredApiKey() {
    return new Promise((resolve) => {
      if (!chrome?.storage?.local) {
        resolve("");
        return;
      }
      chrome.storage.local.get(["apiKey", "openRouterApiKey", "geminiApiKey"], (result) => {
        if (chrome.runtime?.lastError) {
          console.warn("quick-define: storage.get error", chrome.runtime.lastError);
          resolve("");
          return;
        }
        const key = (() => {
          if (typeof result?.apiKey === "string") return result.apiKey;
          if (typeof result?.openRouterApiKey === "string") return result.openRouterApiKey;
          if (typeof result?.geminiApiKey === "string") return result.geminiApiKey;
          return "";
        })();
        resolve(typeof key === "string" ? key.trim() : "");
      });
    });
  }

  async function ensureApiKey(config) {
    if (config?.apiKey) return config.apiKey;

    const stored = await readStoredApiKey();
    if (stored) {
      config.apiKey = stored.trim();
      return stored;
    }

    if (window.__quickDefine?.promptForApiKey) {
      try {
        const key = await window.__quickDefine.promptForApiKey();
        if (config) config.apiKey = key;
        return key;
      } catch (err) {
        throw new Error("Lookup cancelled: API key required.");
      }
    }

    throw new Error("API key missing. Open the popup to add one.");
  }

  function ensureApiBase(config) {
    const base = config?.apiBase || DEFAULT_API_BASE;
    return base.replace(/\/+$/, "");
  }

  function ensureModel(config) {
    return config?.model || DEFAULT_MODEL;
  }

  function buildMessages(focus, context, pageTitle, targetLanguage) {
    const systemContent = [
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
    ].join(" ");

    const userContent = [
      `Page title: ${pageTitle || "Untitled"}`,
      `Selection: '${focus}'`,
      `Context snippet: ${context}`,
      `Respond in ${targetLanguage}.`
    ].join("\n");

    return [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ];
  }

  function extractCompletionText(body) {
    const choice = body?.choices?.[0];
    const message = choice?.message;
    if (!message) return "";

    if (typeof message.content === "string") {
      return message.content;
    }

    if (Array.isArray(message.content)) {
      return message.content
        .map((part) => (typeof part?.text === "string" ? part.text : ""))
        .join("");
    }

    return "";
  }

  function clipText(text, maxChars = 12000) {
    if (typeof text !== "string") return "";
    const trimmed = text.trim();
    if (trimmed.length <= maxChars) return trimmed;
    return trimmed.slice(0, maxChars);
  }

  function buildSummaryMessages(pageText, pageTitle, pageUrl, targetLanguage) {
    const clipped = clipText(pageText);
    const systemContent = [
      "You are an executive briefing assistant for a CEO with limited time.",
      "Write a concise, actionable summary of the page content in HTML. Do not include body/html/head tags.",
      "Structure exactly with these sections when relevant:",
      "<h2>Preface</h2><ul>[Some context for what this is about + Why this is worth reading]</ul>",
      "<h2>Summary</h2><ul>[3 paragraphs]</ul>",
      "<h2>Key quotes</h2><blockquote><p>\"quote\"</p><p><em>Context: ...</em></p></blockquote>",
      "<h2>English learning</h2><ol>Up to 5 English words, expressions, idioms, terms, or structures which might be useful for an advanced English learner trying to achieve full native-like speaking and writing abilities</ol>",
      "Only include the Key quotes section if you have 1-3 impactful quotes; otherwise omit it.",
      "Stay under ~180 words total. Keep sentences tight and avoid fluff.",
      `Respond in ${targetLanguage}.`
    ].join(" ");

    const userContent = [
      `Page title: ${pageTitle || "Untitled"}`,
      `URL: ${pageUrl || ""}`,
      "Page text (may be truncated):",
      clipped
    ].join("\n");

    return [
      { role: "system", content: systemContent },
      { role: "user", content: userContent }
    ];
  }

  async function apiLookup(focus, context, pageTitle) {
    const config = window.__quickDefineConfig || {};
    const targetLanguage = config?.targetLanguage || "English - United States";
    const apiKey = await ensureApiKey(config);
    const apiBase = ensureApiBase(config);
    const model = ensureModel(config);

    const payload = {
      model,
      messages: buildMessages(focus, context, pageTitle, targetLanguage),
      temperature: 0.2
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    };
    if (apiBase.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = window.location?.origin || "https://openrouter.ai";
      headers["X-Title"] = "AI Dictionary";
    }

    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`HTTP ${resp.status} ${t || ""}`);
    }
    const body = await resp.json();
    const text = extractCompletionText(body)?.trim() || "";
    if (!text) {
      throw new Error("Response missing text content");
    }
    return focus + " " + text;
  }

  async function summarizePage(pageText, pageTitle, pageUrl) {
    const config = window.__quickDefineConfig || {};
    const targetLanguage = config?.targetLanguage || "English - United States";
    const apiKey = await ensureApiKey(config);
    const apiBase = ensureApiBase(config);
    const model = ensureModel(config);

    const payload = {
      model,
      messages: buildSummaryMessages(pageText, pageTitle, pageUrl, targetLanguage),
      temperature: 0.35
    };

    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    };
    if (apiBase.includes("openrouter.ai")) {
      headers["HTTP-Referer"] = window.location?.origin || "https://openrouter.ai";
      headers["X-Title"] = "AI Dictionary";
    }

    const resp = await fetch(`${apiBase}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`HTTP ${resp.status} ${t || ""}`);
    }
    const body = await resp.json();
    const text = extractCompletionText(body)?.trim() || "";
    if (!text) {
      throw new Error("Response missing text content");
    }
    return text;
  }

  window.__quickDefine.apiLookup = apiLookup;
  window.__quickDefine.summarizePage = summarizePage;
})();
