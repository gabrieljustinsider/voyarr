// Voyarr Companion Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const activeServerSelect = document.getElementById('activeServerSelect');
  const serverListContainer = document.getElementById('serverListContainer');
  const newServerNameInput = document.getElementById('newServerNameInput');
  const newServerUrlInput = document.getElementById('newServerUrlInput');
  const newServerApiKeyInput = document.getElementById('newServerApiKeyInput');
  const addServerBtn = document.getElementById('addServerBtn');
  const scanNetworkBtn = document.getElementById('scanNetworkBtn');
  const localScanResultsContainer = document.getElementById('localScanResultsContainer');
  const settingsToast = document.getElementById('settingsToast');
  
  const detectedServerBanner = document.getElementById('detectedServerBanner');
  const detectedUrlText = document.getElementById('detectedUrlText');
  const detectedIndicators = document.getElementById('detectedIndicators');
  const addDetectedBtn = document.getElementById('addDetectedBtn');
  const dismissDetectedBtn = document.getElementById('dismissDetectedBtn');

  const providerSelect = document.getElementById('providerSelect');
  const fieldSelect = document.getElementById('fieldSelect');
  const toggleBtn = document.getElementById('toggleBtn');
  const saveBtn = document.getElementById('saveBtn');
  const clearBtn = document.getElementById('clearBtn');
  const selectorPreview = document.getElementById('selectorPreview');
  const selectorVal = document.getElementById('selectorVal');
  const testSelectorBtn = document.getElementById('testSelectorBtn');
  const matchCountBadge = document.getElementById('matchCountBadge');
  const mapToast = document.getElementById('mapToast');
  
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  let currentSelector = "";
  let activeTabHost = "";
  let servers = [];
  let activeServerId = "";

  // Tab Switcher
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const targetContent = document.getElementById(btn.dataset.tab);
      if (targetContent) targetContent.classList.add('active');
    });
  });

  // Dynamic connection indicators analyst
  function analyzeUrl(urlStr) {
    try {
      const url = new URL(urlStr);
      const host = url.hostname.toLowerCase();
      const proto = url.protocol.toLowerCase();

      // 1. Is it secure (HTTPS)?
      const isSecure = proto === "https:";
      const secureBadge = isSecure 
        ? { text: "Secure (HTTPS)", bg: "rgba(16, 185, 129, 0.08)", textCol: "#34d399", border: "rgba(16, 185, 129, 0.15)" }
        : { text: "Insecure (HTTP)", bg: "rgba(245, 158, 11, 0.08)", textCol: "#fbbf24", border: "rgba(245, 158, 11, 0.15)" };

      // 2. Is it local or remote?
      const isLocal = host === "localhost" || 
                      host === "127.0.0.1" || 
                      host.endsWith(".local") || 
                      /^127\./.test(host) || 
                      /^10\./.test(host) || 
                      /^192\.168\./.test(host) || 
                      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

      const locationBadge = isLocal
        ? { text: "Local Server", bg: "rgba(59, 130, 246, 0.08)", textCol: "#60a5fa", border: "rgba(59, 130, 246, 0.15)" }
        : { text: "Remote Server", bg: "rgba(139, 92, 246, 0.08)", textCol: "#a78bfa", border: "rgba(139, 92, 246, 0.15)" };

      return { secureBadge, locationBadge };
    } catch (e) {
      return {
        secureBadge: { text: "Insecure (HTTP)", bg: "rgba(245, 158, 11, 0.08)", textCol: "#fbbf24", border: "rgba(245, 158, 11, 0.15)" },
        locationBadge: { text: "Local Server", bg: "rgba(59, 130, 246, 0.08)", textCol: "#60a5fa", border: "rgba(59, 130, 246, 0.15)" }
      };
    }
  }

  // Create indicator badge element
  function createIndicatorBadge(badgeData) {
    const span = document.createElement('span');
    span.style.padding = "2px 6px";
    span.style.borderRadius = "4px";
    span.style.fontSize = "9px";
    span.style.fontWeight = "600";
    span.style.border = "1px solid " + badgeData.border;
    span.style.backgroundColor = badgeData.bg;
    span.style.color = badgeData.textCol;
    span.style.display = "inline-block";
    span.textContent = badgeData.text;
    return span;
  }

  // Load Settings from storage
  (async () => {
    await loadSettings();
    await probeActiveTab();
  })();

  async function loadSettings() {
    try {
      const config = await chrome.storage.local.get([
        'voyarrServers',
        'activeServerId',
        'voyarrApiUrl',
        'voyarrSecret',
        'pendingSelector',
        'pendingSelectorCount',
        'savedField'
      ]);

      servers = config.voyarrServers || [];
      activeServerId = config.activeServerId || "";

      // Seamless backward compatibility migration
      if (servers.length === 0 && config.voyarrApiUrl) {
        const migratedServer = {
          id: 'migrated-' + Date.now(),
          name: 'Migrated Server',
          url: config.voyarrApiUrl.trim().replace(/\/$/, ''),
          apiKey: config.voyarrSecret ? config.voyarrSecret.trim() : ''
        };
        servers.push(migratedServer);
        activeServerId = migratedServer.id;
        await chrome.storage.local.set({
          voyarrServers: servers,
          activeServerId: activeServerId
        });
      }

      populateActiveServerSelect();
      renderServerList();

      if (activeServerId) {
        const activeServer = servers.find(s => s.id === activeServerId);
        if (activeServer) {
          await chrome.storage.local.set({
            voyarrApiUrl: activeServer.url,
            voyarrSecret: activeServer.apiKey
          });
          try {
            await testConnection(activeServer.url, activeServer.apiKey);
          } catch (e) {
            console.error("Active server connection failed:", e);
          }
        } else {
          updateStatus(false, "Select active server");
        }
      } else {
        updateStatus(false, "Configure settings");
      }

      if (config.savedField) {
        fieldSelect.value = config.savedField;
      }

      if (config.pendingSelector) {
        currentSelector = config.pendingSelector;
        selectorVal.value = currentSelector;
        if (config.pendingSelectorCount !== undefined) {
          updateMatchBadge(config.pendingSelectorCount);
        }
        selectorPreview.style.display = "block";
        saveBtn.style.display = "block";
        if (clearBtn) clearBtn.style.display = "block";
        await chrome.storage.local.remove(['pendingSelector', 'pendingSelectorCount']);
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }

  function populateActiveServerSelect() {
    activeServerSelect.innerHTML = "";
    if (servers.length === 0) {
      const opt = document.createElement('option');
      opt.value = "";
      opt.textContent = "-- No Servers Configured --";
      activeServerSelect.appendChild(opt);
      return;
    }

    servers.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.name;
      if (s.id === activeServerId) {
        opt.selected = true;
      }
      activeServerSelect.appendChild(opt);
    });
  }

  function renderServerList() {
    serverListContainer.innerHTML = "";
    if (servers.length === 0) {
      serverListContainer.innerHTML = `<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 12px 0;">No servers configured. Add one below!</div>`;
      return;
    }

    servers.forEach(s => {
      const card = document.createElement('div');
      card.style.display = "flex";
      card.style.alignItems = "center";
      card.style.justifyContent = "space-between";
      card.style.backgroundColor = "rgba(255, 255, 255, 0.02)";
      card.style.padding = "6px 8px";
      card.style.borderRadius = "6px";
      card.style.border = "1px solid rgba(255, 255, 255, 0.05)";
      card.style.fontSize = "11px";
      card.style.gap = "8px";

      const infoDiv = document.createElement('div');
      infoDiv.style.flex = "1";
      infoDiv.style.minWidth = "0";

      const nameDiv = document.createElement('div');
      nameDiv.style.fontWeight = "600";
      nameDiv.style.color = s.id === activeServerId ? "var(--success)" : "var(--text-main)";
      nameDiv.style.overflow = "hidden";
      nameDiv.style.textOverflow = "ellipsis";
      nameDiv.style.whiteSpace = "nowrap";
      nameDiv.textContent = s.name + (s.id === activeServerId ? " (Active)" : "");

      const urlDiv = document.createElement('div');
      urlDiv.style.color = "var(--text-muted)";
      urlDiv.style.fontSize = "9px";
      urlDiv.style.overflow = "hidden";
      urlDiv.style.textOverflow = "ellipsis";
      urlDiv.style.whiteSpace = "nowrap";
      urlDiv.textContent = s.url;

      const badgesRow = document.createElement('div');
      badgesRow.style.display = "flex";
      badgesRow.style.gap = "4px";
      badgesRow.style.marginTop = "4px";
      badgesRow.style.flexWrap = "wrap";

      const analysis = analyzeUrl(s.url);
      badgesRow.appendChild(createIndicatorBadge(analysis.locationBadge));
      badgesRow.appendChild(createIndicatorBadge(analysis.secureBadge));

      if (s.latency !== undefined) {
        let latBadge;
        if (s.latency < 50) {
          latBadge = { text: `Fast (${s.latency}ms)`, bg: "rgba(16, 185, 129, 0.08)", textCol: "#34d399", border: "rgba(16, 185, 129, 0.15)" };
        } else if (s.latency < 200) {
          latBadge = { text: `Normal (${s.latency}ms)`, bg: "rgba(255, 255, 255, 0.05)", textCol: "var(--text-muted)", border: "rgba(255, 255, 255, 0.1)" };
        } else {
          latBadge = { text: `Slow (${s.latency}ms)`, bg: "rgba(239, 68, 68, 0.08)", textCol: "#f87171", border: "rgba(239, 68, 68, 0.15)" };
        }
        badgesRow.appendChild(createIndicatorBadge(latBadge));
      }

      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(urlDiv);
      infoDiv.appendChild(badgesRow);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = "btn btn-secondary";
      deleteBtn.style.padding = "3px 6px";
      deleteBtn.style.fontSize = "9px";
      deleteBtn.style.borderRadius = "4px";
      deleteBtn.style.boxShadow = "none";
      deleteBtn.style.borderColor = "rgba(239, 68, 68, 0.2)";
      deleteBtn.style.color = "var(--error)";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteServer(s.id);
      });

      card.appendChild(infoDiv);
      card.appendChild(deleteBtn);
      serverListContainer.appendChild(card);
    });
  }

  async function deleteServer(serverId) {
    servers = servers.filter(s => s.id !== serverId);
    let nextActiveId = activeServerId;

    if (activeServerId === serverId) {
      nextActiveId = servers.length > 0 ? servers[0].id : "";
    }

    activeServerId = nextActiveId;
    
    await chrome.storage.local.set({
      voyarrServers: servers,
      activeServerId: activeServerId
    });

    if (activeServerId) {
      const activeServer = servers.find(s => s.id === activeServerId);
      if (activeServer) {
        await chrome.storage.local.set({
          voyarrApiUrl: activeServer.url,
          voyarrSecret: activeServer.apiKey
        });
        await testConnection(activeServer.url, activeServer.apiKey);
      }
    } else {
      await chrome.storage.local.remove(['voyarrApiUrl', 'voyarrSecret']);
      updateStatus(false, "Configure settings");
      providerSelect.innerHTML = '<option value="">-- No Active Server --</option>';
    }

    populateActiveServerSelect();
    renderServerList();
  }

  // Active Server Dropdown change handler
  activeServerSelect.addEventListener('change', async () => {
    const selectedId = activeServerSelect.value;
    if (!selectedId) return;

    activeServerId = selectedId;
    await chrome.storage.local.set({ activeServerId: activeServerId });

    const activeServer = servers.find(s => s.id === activeServerId);
    if (activeServer) {
      await chrome.storage.local.set({
        voyarrApiUrl: activeServer.url,
        voyarrSecret: activeServer.apiKey
      });
      renderServerList();
      try {
        await testConnection(activeServer.url, activeServer.apiKey);
      } catch (e) {
        console.error("Switched active server connection failed:", e);
      }
    }
  });

  // Add Server Form handler
  addServerBtn.addEventListener('click', async () => {
    const name = newServerNameInput.value.trim();
    const url = newServerUrlInput.value.trim().replace(/\/$/, '');
    const key = newServerApiKeyInput.value.trim();

    if (!name || !url || !key) {
      showToast(settingsToast, "Please fill in all fields", false);
      return;
    }

    addServerBtn.disabled = true;
    addServerBtn.innerText = "Testing Server...";

    try {
      const { latencyMs, providers } = await testConnection(url, key);
      
      const newServer = {
        id: 'server-' + Date.now(),
        name: name,
        url: url,
        apiKey: key,
        latency: latencyMs
      };

      servers.push(newServer);
      activeServerId = newServer.id;

      await chrome.storage.local.set({
        voyarrServers: servers,
        activeServerId: activeServerId,
        voyarrApiUrl: url,
        voyarrSecret: key
      });

      showToast(settingsToast, "Server added and connected!", true);
      
      newServerNameInput.value = "";
      newServerUrlInput.value = "";
      newServerApiKeyInput.value = "";

      populateActiveServerSelect();
      renderServerList();
      populateProviders(providers);

    } catch (err) {
      showToast(settingsToast, "Connection failed. Verify URL/Key.", false);
      updateStatus(false, "Disconnected");
    } finally {
      addServerBtn.disabled = false;
      addServerBtn.innerText = "Add & Test Server";
    }
  });

  // Scan Network Button click handler
  scanNetworkBtn.addEventListener('click', async () => {
    await scanLocalNetwork();
  });

  // Local network subnet discovery scan
  async function scanLocalNetwork() {
    scanNetworkBtn.disabled = true;
    scanNetworkBtn.innerText = "Scanning...";
    
    // Clear and display results container
    localScanResultsContainer.innerHTML = `<div style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 6px 0;">Pinging local IP ranges on port 8000...</div>`;
    localScanResultsContainer.style.display = "flex";

    try {
      let baseSubnets = ["192.168.1", "192.168.0", "10.0.0"];
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0] && tabs[0].url) {
        try {
          const tabUrl = new URL(tabs[0].url);
          const parts = tabUrl.hostname.split('.');
          if (parts.length === 4 && !isNaN(parts[0])) {
            const currentSubnet = `${parts[0]}.${parts[1]}.${parts[2]}`;
            if (!baseSubnets.includes(currentSubnet)) {
              baseSubnets.unshift(currentSubnet);
            }
          }
        } catch(e) {}
      }

      let foundServers = [];
      const scanHosts = Array.from({ length: 60 }, (_, i) => i + 1); // 1 to 60 is representative & runs extremely fast!
      
      for (const subnet of baseSubnets) {
        const batchSize = 15;
        for (let b = 0; b < scanHosts.length; b += batchSize) {
          const batch = scanHosts.slice(b, b + batchSize);
          await Promise.all(batch.map(async (host) => {
            const ip = `${subnet}.${host}`;
            const targetUrl = `http://${ip}:8000`;
            
            // Skip scanning if already added
            if (servers.some(s => s.url.includes(ip))) return;

            try {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 400);
              
              const res = await fetch(`${targetUrl}/api/health`, { 
                signal: controller.signal 
              });
              clearTimeout(timer);

              if (res.ok) {
                const data = await res.json();
                if (data && data.status === "healthy") {
                  foundServers.push(targetUrl);
                }
              }
            } catch(e) {
              // Try direct health fallback check
              try {
                const fallbackController = new AbortController();
                const fallbackTimer = setTimeout(() => fallbackController.abort(), 400);
                const res = await fetch(`${targetUrl}/health`, { signal: fallbackController.signal });
                clearTimeout(fallbackTimer);
                if (res.ok) {
                  const data = await res.json();
                  if (data && data.status === "healthy") {
                    foundServers.push(targetUrl);
                  }
                }
              } catch(err) {}
            }
          }));
        }
      }

      // Render scan results list
      localScanResultsContainer.innerHTML = "";
      if (foundServers.length === 0) {
        localScanResultsContainer.innerHTML = `<div style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 6px 0;">No active local nodes detected.</div>`;
      } else {
        foundServers.forEach(srvUrl => {
          const srvDiv = document.createElement('div');
          srvDiv.style.display = "flex";
          srvDiv.style.alignItems = "center";
          srvDiv.style.justifyContent = "space-between";
          srvDiv.style.backgroundColor = "rgba(16, 185, 129, 0.04)";
          srvDiv.style.border = "1px solid rgba(16, 185, 129, 0.15)";
          srvDiv.style.padding = "6px 8px";
          srvDiv.style.borderRadius = "6px";
          srvDiv.style.fontSize = "10px";
          srvDiv.style.gap = "6px";

          const info = document.createElement('span');
          info.style.fontWeight = "600";
          info.style.color = "#34d399";
          info.style.overflow = "hidden";
          info.style.textOverflow = "ellipsis";
          info.style.whiteSpace = "nowrap";
          info.textContent = `📡 Found: ${srvUrl}`;

          const addBtn = document.createElement('button');
          addBtn.className = "btn";
          addBtn.style.padding = "3px 6px";
          addBtn.style.fontSize = "9px";
          addBtn.style.borderRadius = "4px";
          addBtn.style.boxShadow = "none";
          addBtn.style.height = "auto";
          addBtn.style.lineHeight = "1";
          addBtn.textContent = "Connect";
          addBtn.addEventListener('click', () => {
            newServerNameInput.value = "Discovered Server";
            newServerUrlInput.value = srvUrl;
            newServerApiKeyInput.focus();
            localScanResultsContainer.style.display = "none";
            localScanResultsContainer.innerHTML = "";
          });

          srvDiv.appendChild(info);
          srvDiv.appendChild(addBtn);
          localScanResultsContainer.appendChild(srvDiv);
        });
      }
    } catch(err) {
      console.error("Local network scan error:", err);
      localScanResultsContainer.innerHTML = `<div style="font-size: 10px; color: var(--error); text-align: center; padding: 6px 0;">Scan failed: ${err.message}</div>`;
    } finally {
      scanNetworkBtn.disabled = false;
      scanNetworkBtn.innerText = "Scan Local";
    }
  }

  // Probe active tab for Voyarr Server
  async function probeActiveTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs[0] || !tabs[0].url) return;

      const activeUrl = new URL(tabs[0].url);
      if (activeUrl.protocol !== "http:" && activeUrl.protocol !== "https:") return;

      const origin = activeUrl.origin;

      // Check if we already have this server configured
      const isAlreadyConfigured = servers.some(s => {
        try {
          return new URL(s.url).origin === origin;
        } catch(e) {
          return s.url.includes(origin) || origin.includes(s.url);
        }
      });

      if (isAlreadyConfigured) return;

      // Ping /api/health to auto-detect
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);
      const pingStart = performance.now();

      try {
        const res = await fetch(`${origin}/api/health`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (res.ok) {
          const data = await res.json();
          if (data && data.status === "healthy") {
            const latency = Math.round(performance.now() - pingStart);
            showDetectedServer(origin, latency);
          }
        }
      } catch (err) {
        // Fallback check on direct /health
        try {
          const fallbackController = new AbortController();
          const fallbackTimeout = setTimeout(() => fallbackController.abort(), 1500);
          const fallbackStart = performance.now();
          const fallbackRes = await fetch(`${origin}/health`, { signal: fallbackController.signal });
          clearTimeout(fallbackTimeout);

          if (fallbackRes.ok) {
            const data = await fallbackRes.json();
            if (data && data.status === "healthy") {
              const latency = Math.round(performance.now() - fallbackStart);
              showDetectedServer(origin, latency);
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.error("Probing active tab error:", e);
    }
  }

  function showDetectedServer(origin, latencyMs) {
    detectedUrlText.textContent = origin;
    detectedIndicators.innerHTML = "";

    const analysis = analyzeUrl(origin);
    
    // Add location badge
    detectedIndicators.appendChild(createIndicatorBadge(analysis.locationBadge));
    
    // Add security badge
    detectedIndicators.appendChild(createIndicatorBadge(analysis.secureBadge));

    // Add latency badge
    let latencyBadge;
    if (latencyMs < 50) {
      latencyBadge = { text: `Fast (${latencyMs}ms)`, bg: "rgba(16, 185, 129, 0.08)", textCol: "#34d399", border: "rgba(16, 185, 129, 0.15)" };
    } else if (latencyMs < 200) {
      latencyBadge = { text: `Normal (${latencyMs}ms)`, bg: "rgba(255, 255, 255, 0.05)", textCol: "var(--text-muted)", border: "rgba(255, 255, 255, 0.1)" };
    } else {
      latencyBadge = { text: `Slow (${latencyMs}ms)`, bg: "rgba(239, 68, 68, 0.08)", textCol: "#f87171", border: "rgba(239, 68, 68, 0.15)" };
    }
    detectedIndicators.appendChild(createIndicatorBadge(latencyBadge));

    detectedServerBanner.style.display = "flex";

    // Setup action targets
    addDetectedBtn.onclick = async () => {
      // Direct user to Settings tab and pre-fill form
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      const settingsTabBtn = document.querySelector('[data-tab="settings-tab"]');
      const settingsContent = document.getElementById('settings-tab');
      if (settingsTabBtn) settingsTabBtn.classList.add('active');
      if (settingsContent) settingsContent.classList.add('active');

      newServerNameInput.value = "Detected Server";
      newServerUrlInput.value = origin;
      newServerApiKeyInput.focus();

      detectedServerBanner.style.display = "none";
    };

    dismissDetectedBtn.onclick = () => {
      detectedServerBanner.style.display = "none";
    };
  }

  function updateMatchBadge(count) {
    if (!matchCountBadge) return;
    matchCountBadge.style.display = "inline-block";
    if (count === 1) {
      matchCountBadge.textContent = "Matches 1 element (Unique)";
      matchCountBadge.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
      matchCountBadge.style.color = "var(--success)";
    } else {
      matchCountBadge.textContent = `Matches ${count} elements (Not unique)`;
      matchCountBadge.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
      matchCountBadge.style.color = "var(--error)";
    }
  }

  // Test Connection helper (returns promise)
  async function testConnection(url, key) {
    updateStatus(false, "Testing...");
    const startTime = performance.now();
    try {
      const res = await fetch(`${url}/providers`, {
        method: 'GET',
        headers: {
          'X-Voyarr-Api-Key': key,
          'Accept': 'application/json'
        }
      });
      if (!res.ok) throw new Error("Unauthorized or server error");
      const providers = await res.json();
      const latencyMs = Math.round(performance.now() - startTime);
      updateStatus(true, `Connected (${latencyMs}ms)`);
      populateProviders(providers);
      
      // Update latency in local object if matching
      const s = servers.find(srv => srv.url === url);
      if (s) {
        s.latency = latencyMs;
        await chrome.storage.local.set({ voyarrServers: servers });
      }
      
      return { providers, latencyMs };
    } catch (err) {
      updateStatus(false, "Disconnected");
      throw err;
    }
  }

  // Populate Providers Dropdown
  async function populateProviders(providers) {
    if (!providers || providers.length === 0) return;
    
    providerSelect.innerHTML = "";
    providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      providerSelect.appendChild(opt);
    });

    // Restore saved provider if any
    try {
      const res = await chrome.storage.local.get(['savedProvider']);
      if (res.savedProvider) {
        providerSelect.value = res.savedProvider;
      }
    } catch (err) {
      console.error("Failed to load saved provider:", err);
    }
  }

  // Update Status Badge
  function updateStatus(connected, text) {
    statusDot.className = "status-dot " + (connected ? "connected" : "disconnected");
    statusText.textContent = text;
  }

  // Toast alert helper
  function showToast(element, message, isSuccess) {
    element.textContent = message;
    element.className = "toast-msg " + (isSuccess ? "toast-success" : "toast-error");
    element.style.display = "block";
    setTimeout(() => {
      element.style.display = "none";
    }, 4000);
  }

  // Get current active tab hostname
  (async () => {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs && tabs[0] && tabs[0].url) {
        const parsedUrl = new URL(tabs[0].url);
        activeTabHost = parsedUrl.hostname;
      }
    } catch (e) {
      activeTabHost = "";
    }
  })();

  // Enable visual map selection mode
  toggleBtn.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;
      
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
      
      await chrome.tabs.sendMessage(tab.id, { action: "toggleMapMode", enabled: true });
      toggleBtn.innerText = "Mapping Active... Click an element";
    } catch(e) {
      showToast(mapToast, "Cannot map on this page (e.g., chrome:// URLs)", false);
    }
  });

  // Listen for message from Content Script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "elementSelected") {
      currentSelector = request.selector;
      selectorVal.value = currentSelector;
      if (request.matchCount !== undefined) {
        updateMatchBadge(request.matchCount);
      }
      selectorPreview.style.display = "block";
      saveBtn.style.display = "block";
      if (clearBtn) clearBtn.style.display = "block";
      toggleBtn.innerText = "Enable Map Mode";
    }
    if (request.action === "disableMapMode") {
      toggleBtn.innerText = "Enable Map Mode";
    }
  });

  // Save Mapping to Voyarr
  saveBtn.addEventListener('click', async () => {
    const finalSelector = selectorVal.value.trim() || currentSelector;

    if (!finalSelector || !activeTabHost) {
      showToast(mapToast, "No selector or hostname to map", false);
      return;
    }

    const payload = {
      host: activeTabHost,
      property: fieldSelect.value,
      selector: finalSelector
    };

    if (providerSelect.value) {
      payload.provider_id = parseInt(providerSelect.value, 10);
    }

    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    try {
      const response = await chrome.runtime.sendMessage({ action: "SAVE_RECIPE_MAPPING", payload });
      if (response && response.success) {
        showToast(mapToast, "Successfully saved to recipe!", true);
        saveBtn.style.display = "none";
        if (clearBtn) clearBtn.style.display = "none";
        selectorPreview.style.display = "none";
        currentSelector = "";
        selectorVal.value = "";
      } else {
        const errMsg = response && response.error ? response.error : "Unknown connection error";
        showToast(mapToast, `Failed to save: ${errMsg}`, false);
      }
    } catch (err) {
      showToast(mapToast, `Failed to save: ${err.message}`, false);
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerText = "Save to Voyarr";
    }
  });

  // Clear Button
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      selectorPreview.style.display = "none";
      saveBtn.style.display = "none";
      clearBtn.style.display = "none";
      currentSelector = "";
      selectorVal.value = "";
      await chrome.storage.local.remove(['pendingSelector', 'pendingSelectorCount']);
    });
  }

  // Test Selector Button
  testSelectorBtn.addEventListener('click', async () => {
    const selectorToTest = selectorVal.value.trim();
    if (!selectorToTest) return;
    
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) return;

      testSelectorBtn.innerText = "...";
      
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id, allFrames: true },
          files: ['content.js']
        });
      } catch(e) {}

      const response = await chrome.tabs.sendMessage(tab.id, { action: "testSelector", selector: selectorToTest });
      if (response && response.matchCount !== undefined) {
        updateMatchBadge(response.matchCount);
      } else {
        updateMatchBadge(0);
      }
    } catch (err) {
      updateMatchBadge(0);
    } finally {
      testSelectorBtn.innerText = "Test";
    }
  });

  // Track and save dropdown selections
  providerSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ savedProvider: providerSelect.value });
  });

  fieldSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ savedField: fieldSelect.value });
  });
});