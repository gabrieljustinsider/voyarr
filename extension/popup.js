// Voyarr Companion Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  // Set version badge dynamically from chrome extension manifest
  const extVersionSpan = document.getElementById('extVersion');
  if (extVersionSpan) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getManifest) {
      const manifest = chrome.runtime.getManifest();
      extVersionSpan.textContent = `v${manifest.version}`;
    } else {
      extVersionSpan.textContent = 'v1.15.5'; // Fallback
    }
  }

  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const activeServerSelect = document.getElementById('activeServerSelect');
  const serverListContainer = document.getElementById('serverListContainer');
  const newServerNameInput = document.getElementById('newServerNameInput');
  const newServerUrlInput = document.getElementById('newServerUrlInput');
  const newServerApiKeyInput = document.getElementById('newServerApiKeyInput');
  const usePortToggle = document.getElementById('usePortToggle');
  const newServerPortInput = document.getElementById('newServerPortInput');
  const addServerBtn = document.getElementById('addServerBtn');
  const scanNetworkBtn = document.getElementById('scanNetworkBtn');
  const localScanResultsContainer = document.getElementById('localScanResultsContainer');
  const settingsToast = document.getElementById('settingsToast');
  const sslTroubleCard = document.getElementById('sslTroubleCard');
  
  const detectedServerBanner = document.getElementById('detectedServerBanner');
  const detectedUrlText = document.getElementById('detectedUrlText');
  const detectedIndicators = document.getElementById('detectedIndicators');
  const addDetectedBtn = document.getElementById('addDetectedBtn');
  const dismissDetectedBtn = document.getElementById('dismissDetectedBtn');

  // Pairing Elements
  const pairingBanner = document.getElementById('pairingBanner');
  const pairingUrlText = document.getElementById('pairingUrlText');
  const confirmPairBtn = document.getElementById('confirmPairBtn');
  const dismissPairBtn = document.getElementById('dismissPairBtn');

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
  
  // Lens Tab Elements
  const scanSubscriptionBtn = document.getElementById('scanSubscriptionBtn');
  const scanResultBox = document.getElementById('scanResultBox');
  const scanResultText = document.getElementById('scanResultText');
  const saveSubscriptionBtn = document.getElementById('saveSubscriptionBtn');
  const lensToast = document.getElementById('lensToast');
  let currentScannedSubscription = null;

  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  let currentSelector = "";
  let activeTabHost = "";
  let servers = [];
  let activeServerId = "";

  // Setup port toggle logic
  if (usePortToggle && newServerPortInput) {
    usePortToggle.addEventListener('change', () => {
      newServerPortInput.disabled = !usePortToggle.checked;
    });
  }

  const clearStorageBtn = document.getElementById('clearStorageBtn');
  if (clearStorageBtn) {
    clearStorageBtn.addEventListener('click', () => {
      showConfirmToast("Are you sure you want to clear all settings and reset Voyarr Lens?", async () => {
        await chrome.storage.local.clear();
        window.location.reload();
      });
    });
  }

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
            const connResult = await testConnection(activeServer.url, activeServer.apiKey);
            if (connResult && connResult.adjustedUrl && connResult.adjustedUrl !== activeServer.url) {
              activeServer.url = connResult.adjustedUrl;
              await chrome.storage.local.set({
                voyarrServers: servers,
                voyarrApiUrl: connResult.adjustedUrl
              });
            }
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

      const titleRow = document.createElement('div');
      titleRow.style.display = "flex";
      titleRow.style.alignItems = "center";
      titleRow.style.gap = "6px";
      titleRow.style.minWidth = "0";

      const nameSpan = document.createElement('span');
      nameSpan.style.fontWeight = "600";
      nameSpan.style.color = s.id === activeServerId ? "var(--success)" : "var(--text-main)";
      nameSpan.style.overflow = "hidden";
      nameSpan.style.textOverflow = "ellipsis";
      nameSpan.style.whiteSpace = "nowrap";
      nameSpan.textContent = s.name + (s.id === activeServerId ? " (Active)" : "");

      const editBtn = document.createElement('button');
      editBtn.style.background = "none";
      editBtn.style.border = "none";
      editBtn.style.padding = "0";
      editBtn.style.cursor = "pointer";
      editBtn.style.fontSize = "9px";
      editBtn.style.opacity = "0.7";
      editBtn.style.transition = "opacity 0.2s";
      editBtn.style.display = "inline-flex";
      editBtn.style.alignItems = "center";
      editBtn.title = "Rename Server";
      editBtn.textContent = "✏️";
      
      editBtn.addEventListener('mouseenter', () => editBtn.style.opacity = "1");
      editBtn.addEventListener('mouseleave', () => editBtn.style.opacity = "0.7");
      
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const nameInput = document.createElement('input');
        nameInput.type = "text";
        nameInput.value = s.name;
        nameInput.style.fontSize = "11px";
        nameInput.style.padding = "2px 6px";
        nameInput.style.backgroundColor = "var(--bg-primary)";
        nameInput.style.border = "1px solid rgba(168, 85, 247, 0.5)";
        nameInput.style.borderRadius = "4px";
        nameInput.style.color = "var(--text-main)";
        nameInput.style.width = "110px";
        nameInput.style.height = "16px";
        nameInput.style.outline = "none";
        
        let saved = false;
        const saveEdit = async () => {
          if (saved) return;
          saved = true;
          const newName = nameInput.value.trim();
          if (newName && newName !== s.name) {
            s.name = newName;
            await chrome.storage.local.set({ voyarrServers: servers });
            renderServerList();
            populateActiveServerSelect();
          } else {
            renderServerList();
          }
        };

        nameInput.addEventListener('keydown', (ke) => {
          if (ke.key === 'Enter') {
            saveEdit();
          } else if (ke.key === 'Escape') {
            saved = true;
            renderServerList();
          }
        });

        nameInput.addEventListener('blur', saveEdit);

        titleRow.innerHTML = "";
        titleRow.appendChild(nameInput);
        nameInput.focus();
        nameInput.select();
      });

      titleRow.appendChild(nameSpan);
      titleRow.appendChild(editBtn);

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

      infoDiv.appendChild(titleRow);
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
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showConfirmToast(`Are you sure you want to delete the server "${s.name}"?`, async () => {
          await deleteServer(s.id);
        });
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
        const connResult = await testConnection(activeServer.url, activeServer.apiKey);
        if (connResult && connResult.adjustedUrl && connResult.adjustedUrl !== activeServer.url) {
          activeServer.url = connResult.adjustedUrl;
          await chrome.storage.local.set({
            voyarrServers: servers,
            voyarrApiUrl: connResult.adjustedUrl
          });
        }
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
        const connResult = await testConnection(activeServer.url, activeServer.apiKey);
        if (connResult && connResult.adjustedUrl && connResult.adjustedUrl !== activeServer.url) {
          activeServer.url = connResult.adjustedUrl;
          await chrome.storage.local.set({
            voyarrServers: servers,
            voyarrApiUrl: connResult.adjustedUrl
          });
          renderServerList();
        }
      } catch (e) {
        console.error("Switched active server connection failed:", e);
      }
    }
  });

  // Add Server Form handler
  addServerBtn.addEventListener('click', async () => {
    const name = newServerNameInput.value.trim();
    let url = newServerUrlInput.value.trim().replace(/\/$/, '');
    const key = newServerApiKeyInput.value.trim();

    if (!name || !url || !key) {
      showToast(settingsToast, "Please fill in all fields", false);
      return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'http://' + url;
    }

    if (usePortToggle && usePortToggle.checked && newServerPortInput && newServerPortInput.value) {
      try {
        const u = new URL(url);
        u.port = newServerPortInput.value;
        url = u.origin + u.pathname;
      } catch (e) {
        url = url + ':' + newServerPortInput.value;
      }
    }

    url = url.replace(/\/$/, ''); // Ensure no trailing slash exists

    addServerBtn.disabled = true;
    addServerBtn.innerHTML = '<span class="spinner"></span> Testing...';

    try {
      const { latencyMs, providers, adjustedUrl } = await testConnection(url, key);
      
      const newServer = {
        id: 'server-' + Date.now(),
        name: name,
        url: adjustedUrl,
        apiKey: key,
        latency: latencyMs
      };

      servers.push(newServer);
      activeServerId = newServer.id;

      await chrome.storage.local.set({
        voyarrServers: servers,
        activeServerId: activeServerId,
        voyarrApiUrl: adjustedUrl,
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
      addServerBtn.textContent = "Add & Test Server";
    }
  });

  // Scan Network Button click handler
  scanNetworkBtn.addEventListener('click', async () => {
    await scanLocalNetwork();
  });

  // Local network subnet discovery scan
  async function scanLocalNetwork() {
    scanNetworkBtn.disabled = true;
    scanNetworkBtn.innerHTML = '<span class="spinner"></span> Scanning...';

    const port = 8000;
    
    // Clear and display results container
    localScanResultsContainer.innerHTML = `<div style="font-size: 10px; color: var(--text-muted); text-align: center; padding: 6px 0;">Pinging local IP ranges on port ${port}...</div>`;
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
            const targetUrl = `http://${ip}:${port}`;
            
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
              } catch(err) {
                // Try subdirectory proxy fallback check (e.g. /voyarr/health)
                try {
                  const subDirController = new AbortController();
                  const subDirTimer = setTimeout(() => subDirController.abort(), 400);
                  const res = await fetch(`${targetUrl}/voyarr/health`, { signal: subDirController.signal });
                  clearTimeout(subDirTimer);
                  if (res.ok) {
                    const data = await res.json();
                    if (data && data.status === "healthy") {
                      foundServers.push(`${targetUrl}/voyarr`);
                    }
                  }
                } catch(subErr) {}
              }
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
      // 1. Check for pending pairing requests first
      const stored = await chrome.storage.local.get(['pendingPairing']);
      if (stored.pendingPairing) {
        const { url, pairingCode, timestamp } = stored.pendingPairing;
        // Expire pairing proposal after 5 minutes (300000ms)
        if (Date.now() - timestamp < 300000) {
          showPairingInvitation(url, pairingCode);
          return;
        } else {
          await chrome.storage.local.remove(['pendingPairing']);
        }
      }

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || !tabs[0] || !tabs[0].url) return;

      // Check active tab's sessionStorage as a secure fallback
      try {
        const activeTabId = tabs[0].id;
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          func: () => {
            try {
              const data = sessionStorage.getItem('voyarr_pending_pairing');
              if (data) {
                const parsed = JSON.parse(data);
                if (Date.now() - parsed.timestamp < 300000) {
                  return parsed;
                }
              }
            } catch (e) {}
            return null;
          }
        });

        if (result && result.url && result.pairingCode) {
          showPairingInvitation(result.url, result.pairingCode);
          return;
        }
      } catch (err) {
        console.warn("Could not check active tab sessionStorage for pairing code:", err);
      }

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

      // 2. Perform DOM-based check first (more secure/no noise fetches)
      let hasMetaTag = false;
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: () => !!document.querySelector('meta[name="voyarr-server"]')
        });
        hasMetaTag = result;
      } catch (err) {
        console.warn("DOM discovery failed/blocked (falling back to fetch):", err);
      }

      if (hasMetaTag) {
        showDetectedServer(origin, 0); // Latency 0 for DOM detection
        return;
      }

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

  function showPairingInvitation(url, pairingCode) {
    pairingUrlText.textContent = url;
    pairingBanner.style.display = "flex";

    confirmPairBtn.onclick = async () => {
      confirmPairBtn.disabled = true;
      confirmPairBtn.textContent = "Pairing...";

      try {
        const permissionGranted = await requestHostPermission(url);
        if (!permissionGranted) {
          throw new Error("Host permission not granted");
        }
        const response = await fetch(`${url.replace(/\/$/, '')}/api/auth/pair/confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ pairing_code: pairingCode })
        });

        if (!response.ok) {
          throw new Error("Invalid or expired pairing code");
        }

        const result = await response.json();
        if (result.status === "success" && result.raw_key) {
          // Test connection first to get correct adjustedUrl (e.g. appending /api if needed)
          let latency = 5;
          let finalUrl = url.replace(/\/$/, '');
          try {
            const connResult = await testConnection(finalUrl, result.raw_key);
            if (connResult && connResult.adjustedUrl) {
              finalUrl = connResult.adjustedUrl;
              latency = connResult.latencyMs;
            }
          } catch (connErr) {
            console.error("Pairing connection test failed:", connErr);
          }

          const newServer = {
            id: 'server-' + Date.now(),
            name: "Paired Voyarr Server",
            url: finalUrl,
            apiKey: result.raw_key,
            latency: latency
          };

          servers.push(newServer);
          activeServerId = newServer.id;

          await chrome.storage.local.set({
            voyarrServers: servers,
            activeServerId: activeServerId,
            voyarrApiUrl: newServer.url,
            voyarrSecret: newServer.apiKey
          });

          await chrome.storage.local.remove(['pendingPairing']);
          
          // Clear active tab's sessionStorage as well
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs && tabs[0]) {
              await chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                func: () => {
                  sessionStorage.removeItem('voyarr_pending_pairing');
                }
              });
            }
          } catch (e) {}

          showToast(settingsToast, "Successfully paired and connected!", true);
          pairingBanner.style.display = "none";
          
          populateActiveServerSelect();
          renderServerList();
        } else {
          throw new Error("Pairing failed: no key returned");
        }
      } catch (err) {
        showToast(settingsToast, "Pairing failed: " + err.message, false);
      } finally {
        confirmPairBtn.disabled = false;
        confirmPairBtn.textContent = "Pair Now";
      }
    };

    dismissPairBtn.onclick = async () => {
      await chrome.storage.local.remove(['pendingPairing']);
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs && tabs[0]) {
          await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => {
              sessionStorage.removeItem('voyarr_pending_pairing');
            }
          });
        }
      } catch (e) {}
      pairingBanner.style.display = "none";
    };
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

  // Request dynamic host permission for custom remote domains
  async function requestHostPermission(url) {
    if (url.includes("localhost") || url.includes("127.0.0.1")) {
      return true;
    }
    try {
      const parsed = new URL(url);
      const originPattern = `${parsed.protocol}//${parsed.host}/*`;
      const hasPermission = await chrome.permissions.contains({
        origins: [originPattern]
      });
      if (!hasPermission) {
        return await chrome.permissions.request({
          origins: [originPattern]
        });
      }
      return true;
    } catch (e) {
      console.error("Failed to check/request host permission:", e);
      return false;
    }
  }

  // Test Connection helper (returns promise)
  async function testConnection(url, key) {
    let cleanUrl = url.replace(/\/$/, '');
    updateStatus(false, "Testing...");
    
    // Request permission first (if not localhost)
    const permissionGranted = await requestHostPermission(cleanUrl);
    if (!permissionGranted) {
      throw new Error("Host permission was not granted");
    }

    const startTime = performance.now();
    let providers = null;
    let success = false;
    let errToThrow = null;

    // Try primary URL
    try {
      const res = await fetch(`${cleanUrl}/providers`, {
        method: 'GET',
        headers: {
          'X-Voyarr-Api-Key': key,
          'Accept': 'application/json'
        }
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) {
          providers = await res.json();
          success = true;
        } else {
          throw new Error("Server returned HTML instead of API response.");
        }
      } else {
        throw new Error(`Server returned status: ${res.status}`);
      }
    } catch (err) {
      errToThrow = err;
    }

    // Try fallback to /api if primary failed and URL doesn't already have it
    if (!success && !cleanUrl.endsWith('/api')) {
      const fallbackUrl = `${cleanUrl}/api`;
      try {
        const permissionGrantedFallback = await requestHostPermission(fallbackUrl);
        if (permissionGrantedFallback) {
          const res = await fetch(`${fallbackUrl}/providers`, {
            method: 'GET',
            headers: {
              'X-Voyarr-Api-Key': key,
              'Accept': 'application/json'
            }
          });
          if (res.ok) {
            const contentType = res.headers.get("content-type") || "";
            if (!contentType.includes("text/html")) {
              providers = await res.json();
              cleanUrl = fallbackUrl;
              success = true;
            }
          }
        }
      } catch (fallbackErr) {
        // Fallback failed
      }
    }

    if (!success) {
      updateStatus(false, "Disconnected");
      if (url.startsWith("https://") && sslTroubleCard) {
        sslTroubleCard.style.display = "flex";
      }
      throw errToThrow || new Error("Could not connect to Voyarr API");
    }

    const latencyMs = Math.round(performance.now() - startTime);
    updateStatus(true, `Connected (${latencyMs}ms)`);
    populateProviders(providers);
    
    // Update latency in local object if matching
    const s = servers.find(srv => srv.url === url || srv.url === cleanUrl);
    if (s) {
      s.url = cleanUrl;
      s.latency = latencyMs;
      await chrome.storage.local.set({ voyarrServers: servers });
    }
    
    if (sslTroubleCard) {
      sslTroubleCard.style.display = "none";
    }
    
    return { providers, latencyMs, adjustedUrl: cleanUrl };
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

  // Interactive Confirm Toast helper
  function showConfirmToast(message, onConfirm) {
    const toast = document.getElementById('actionToast');
    const msgEl = document.getElementById('actionToastMessage');
    const btnYes = document.getElementById('actionToastYes');
    const btnNo = document.getElementById('actionToastNo');
    
    msgEl.textContent = message;
    toast.style.display = "flex";
    
    // Clean up old event listeners by cloning
    const newBtnYes = btnYes.cloneNode(true);
    const newBtnNo = btnNo.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);
    
    const closeToast = () => {
      toast.style.animation = "slideDownFade 0.25s ease-in forwards";
      setTimeout(() => {
        toast.style.display = "none";
        toast.style.animation = "slideUpFade 0.3s ease-out forwards"; // Reset for next open
      }, 250);
    };

    newBtnYes.addEventListener('click', () => { closeToast(); onConfirm(); });
    newBtnNo.addEventListener('click', closeToast);
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

  // Help Modal logic
  const helpBtn = document.getElementById('helpBtn');
  const helpModal = document.getElementById('helpModal');
  const closeHelpBtn = document.getElementById('closeHelpBtn');

  if (helpModal) {
    helpModal.style.display = 'none';
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      helpModal.style.display = 'flex';
    });
  }

  if (closeHelpBtn) {
    closeHelpBtn.addEventListener('click', () => {
      helpModal.style.display = 'none';
    });
  }

  // Expandable cards logic
  document.querySelectorAll('.expandable-card .card-header').forEach(header => {
    const body = header.nextElementSibling;
    const indicator = header.querySelector('.indicator');
    
    // Ensure cards are closed by default to prevent layout bleed
    if (body) body.style.display = 'none';

    header.addEventListener('click', () => {
      if (body.style.display === 'none' || body.style.display === '') {
        body.style.display = 'block';
        if (indicator) indicator.textContent = '▲';
      } else {
        body.style.display = 'none';
        if (indicator) indicator.textContent = '▼';
      }
    });
  });

  // Save Mapping to Voyarr
  saveBtn.addEventListener('click', () => {
    const finalSelector = selectorVal.value.trim() || currentSelector;

    if (!finalSelector || !activeTabHost) {
      showToast(mapToast, "No selector or hostname to map", false);
      return;
    }

    showConfirmToast("Are you sure you want to save this recipe mapping to Voyarr?", async () => {
      const payload = {
        host: activeTabHost,
        property: fieldSelect.value,
        selector: finalSelector
      };

      if (providerSelect.value) {
        payload.provider_id = parseInt(providerSelect.value, 10);
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span class="spinner"></span> Saving...';

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
        saveBtn.textContent = "Save to Voyarr";
      }
    });
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

      testSelectorBtn.disabled = true;
      testSelectorBtn.innerHTML = '<span class="spinner" style="width: 10px; height: 10px; border-width: 2px;"></span>';
      
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
      testSelectorBtn.disabled = false;
      testSelectorBtn.textContent = "Test";
    }
  });

  // Track and save dropdown selections
  providerSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ savedProvider: providerSelect.value });
  });

  fieldSelect.addEventListener('change', async () => {
    await chrome.storage.local.set({ savedField: fieldSelect.value });
  });

  // Lens Tab logic
  scanSubscriptionBtn.addEventListener('click', () => {
    showConfirmToast("Allow Voyarr to scan this page for subscription and billing details? This may include sensitive account information on the current page.", async () => {
      scanSubscriptionBtn.innerHTML = '<span class="spinner"></span> Scanning...';
      scanSubscriptionBtn.disabled = true;

      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("No active tab.");

        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => document.body.innerText
        });

        const serverUrl = activeServerSelect.value;
        const activeServer = servers.find(s => s.id === serverUrl);
        if (!activeServer || !activeServer.url) {
          throw new Error("No active Voyarr server configured.");
        }

        const cleanUrl = activeServer.url.replace(/\/$/, '');
        const res = await fetch(`${cleanUrl}/subscriptions/parse-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Voyarr-Api-Key': activeServer.apiKey
          },
          body: JSON.stringify({ email_text: result || "" })
        });

        if (!res.ok) throw new Error("Backend parse failed.");
        
        const data = await res.json();
        currentScannedSubscription = data.parsed_data;
        
        scanResultText.innerText = JSON.stringify(currentScannedSubscription, null, 2);
        scanResultBox.style.display = "block";
        showToast(lensToast, "Scan complete!", true);

      } catch (e) {
        console.error(e);
        showToast(lensToast, `Failed to scan: ${e.message}`, false);
      } finally {
        scanSubscriptionBtn.textContent = "Scan Active Tab";
        scanSubscriptionBtn.disabled = false;
      }
    });
  });

  saveSubscriptionBtn.addEventListener('click', async () => {
    if (!currentScannedSubscription) return;

    saveSubscriptionBtn.innerHTML = '<span class="spinner"></span> Saving...';
    saveSubscriptionBtn.disabled = true;

    try {
      const serverUrl = activeServerSelect.value;
      const activeServer = servers.find(s => s.id === serverUrl);
      
      // Need providerId. We might not have it strictly, default to 1 for now.
      const payload = {
        provider_id: parseInt(providerSelect.value) || 1,
        biller: currentScannedSubscription.biller,
        billing_cycle: currentScannedSubscription.billing_cycle,
        cost: currentScannedSubscription.cost,
        is_trial: currentScannedSubscription.is_trial,
        status: currentScannedSubscription.status
      };

      const cleanUrl = activeServer.url.replace(/\/$/, '');
      const res = await fetch(`${cleanUrl}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Voyarr-Api-Key': activeServer.apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error("Save failed.");
      showToast(lensToast, "Saved successfully!", "success");
    } catch (e) {
      showToast(lensToast, `Save failed: ${e.message}`, "error");
    } finally {
      saveSubscriptionBtn.textContent = "Save to Voyarr";
      saveSubscriptionBtn.disabled = false;
    }
  });

});