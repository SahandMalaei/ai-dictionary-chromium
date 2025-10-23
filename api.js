(() => {
  const ENDPOINT = "http://127.0.0.1:5050/define"; // your local formatter

  async function apiLookup(focus, context) {
    // Expecting the service to return your exact formatted string:
    // [Word(s)] (part) [IPA] (pron)
    // ***Definition:*** ...
    // ***Synonyms:*** ...
    // ***Etymology:*** ...
    return focus + ", " + context;
    const resp = await fetch(ENDPOINT, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({ q: focus, context })
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`HTTP ${resp.status} ${t || ""}`);
    }
    return (await resp.text()).trim();
  }

  window.__quickDefine.apiLookup = apiLookup;
})();
