// Voyarr Companion Popup Logic

document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const apiUrlInput = document.getElementById('apiUrlInput');
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const settingsToast = document.getElementById('settingsToast');
  
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

  // Load Settings from storage
  (async () => {
    try {
      const config = await chrome.storage.local.get([
        'voyarrApiUrl',
        'voyarrSecret',
        'pendingSelector',
        'pendingSelectorCount',
        'savedField'
      ]);

      if (config.voyarrApiUrl) apiUrlInput.value = config.voyarrApiUrl;
      if (config.voyarrSecret) apiKeyInput.value = config.voyarrSecret;
      
      if (config.voyarrApiUrl && config.voyarrSecret) {
        await testConnection(config.voyarrApiUrl, config.voyarrSecret);
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
  })();

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

  // Save & Test Settings
  saveSettingsBtn.addEventListener('click', async () => {
    const url = apiUrlInput.value.trim().replace(/\/$/, '');
    const key = apiKeyInput.value.trim();

    if (!url || !key) {
      showToast(settingsToast, "Please enter both fields", false);
      return;
    }

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.innerText = "Testing Connection...";
    
    try {
      const providers = await testConnection(url, key);
      await chrome.storage.local.set({ voyarrApiUrl: url, voyarrSecret: key });
      showToast(settingsToast, "Settings saved and connected!", true);
      populateProviders(providers);
    } catch (err) {
      showToast(settingsToast, "Connection failed. Check URL/Key.", false);
    } finally {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.innerText = "Save & Test Connection";
    }
  });

  // Test Connection helper (returns promise)
  async function testConnection(url, key) {
    updateStatus(false, "Testing...");
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
      updateStatus(true, "Connected");
      populateProviders(providers);
      return providers;
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