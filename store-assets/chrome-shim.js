// Chrome API shim for rendering the real Voyarr Lens popup outside the extension context.
// Only provides chrome.* plumbing + seeds local storage; all UI is the real popup code.
(() => {
  const KEY = "__MASTER_KEY__";

  const SERVERS = [
    { id: "srv-nas", name: "Home NAS", url: "http://10.0.0.32:8008", apiKey: KEY },
    { id: "srv-vps", name: "Cloud VPS", url: "https://voyarr.example.com", apiKey: "vp-key-••••" }
  ];

  const STORE = {
    voyarrServers: SERVERS,
    activeServerId: "srv-nas",
    voyarrApiUrl: SERVERS[0].url,
    voyarrSecret: SERVERS[0].apiKey,
    scanPort: "8000,8008,8080"
  };

  if (window.__pairingSeed) {
    STORE.pendingPairing = {
      url: "http://10.0.0.32:8008",
      pairingCode: "482913",
      timestamp: Date.now(),
      autoInitiated: true
    };
  }

  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  window.chrome = {
    runtime: {
      id: "shim-extension-id",
      getManifest: () => ({ name: "Voyarr Lens", version: "1.198.1" }),
      getURL: (p) => location.origin + "/" + p,
      sendMessage: () => Promise.resolve({ ok: true }),
      onMessage: { addListener: () => {} }
    },
    storage: {
      local: {
        get: (keys) => {
          if (keys === null || keys === undefined) {
            const all = {};
            for (const k of Object.keys(STORE)) all[k] = clone(STORE[k]);
            return Promise.resolve(all);
          }
          if (typeof keys === "string") return Promise.resolve({ [keys]: clone(STORE[keys]) });
          if (Array.isArray(keys)) {
            const out = {};
            keys.forEach((k) => { if (k in STORE) out[k] = clone(STORE[k]); });
            return Promise.resolve(out);
          }
          const out = {};
          for (const k of Object.keys(keys)) out[k] = k in STORE ? clone(STORE[k]) : keys[k];
          return Promise.resolve(out);
        },
        set: (items) => { Object.assign(STORE, JSON.parse(JSON.stringify(items))); return Promise.resolve(); },
        remove: (keys) => {
          (Array.isArray(keys) ? keys : [keys]).forEach((k) => delete STORE[k]);
          return Promise.resolve();
        },
        clear: () => { for (const k of Object.keys(STORE)) delete STORE[k]; return Promise.resolve(); }
      },
      onChanged: { addListener: () => {} }
    },
    tabs: {
      query: () => Promise.resolve([{ id: 1, active: true, windowId: 1, url: "http://10.0.0.32:8008/dashboard", title: "Voyarr" }]),
      sendMessage: () => Promise.resolve({ ok: true }),
      create: () => Promise.resolve({}),
      update: () => Promise.resolve({})
    },
    scripting: {
      executeScript: () => Promise.resolve([{ result: null }])
    },
    permissions: {
      contains: () => Promise.resolve(true),
      request: () => Promise.resolve(true)
    },
    action: {
      setBadgeText: () => Promise.resolve(),
      setBadgeBackgroundColor: () => Promise.resolve(),
      setBadgeTextColor: () => Promise.resolve()
    },
    notifications: {
      create: () => Promise.resolve("id"),
      onButtonClicked: { addListener: () => {} },
      onClosed: { addListener: () => {} }
    },
    windows: { update: () => Promise.resolve({}) }
  };
})();
