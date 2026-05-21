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
  const selectorPreview = document.getElementById('selectorPreview');
  const selectorVal = document.getElementById('selectorVal');
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
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });

  // Load Settings from storage
  chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret'], (config) => {
    if (config.voyarrApiUrl) apiUrlInput.value = config.voyarrApiUrl;
    if (config.voyarrSecret) apiKeyInput.value = config.voyarrSecret;
    
    if (config.voyarrApiUrl && config.voyarrSecret) {
      testConnection(config.voyarrApiUrl, config.voyarrSecret);
    } else {
      updateStatus(false, "Configure settings");
    }
  });

  // Save & Test Settings
  saveSettingsBtn.addEventListener('click', () => {
    const url = apiUrlInput.value.trim().replace(/\/$/, '');
    const key = apiKeyInput.value.trim();

    if (!url || !key) {
      showToast(settingsToast, "Please enter both fields", false);
      return;
    }

    saveSettingsBtn.disabled = true;
    saveSettingsBtn.innerText = "Testing Connection...";
    
    testConnection(url, key, (success, data) => {
      saveSettingsBtn.disabled = false;
      saveSettingsBtn.innerText = "Save & Test Connection";

      if (success) {
        chrome.storage.local.set({ voyarrApiUrl: url, voyarrSecret: key }, () => {
          showToast(settingsToast, "Settings saved and connected!", true);
          populateProviders(data);
        });
      } else {
        showToast(settingsToast, "Connection failed. Check URL/Key.", false);
      }
    });
  });

  // Test Connection helper
  function testConnection(url, key, callback) {
    updateStatus(false, "Testing...");
    
    fetch(`${url}/providers`, {
      method: 'GET',
      headers: {
        'X-Voyarr-Api-Key': key,
        'Accept': 'application/json'
      }
    })
    .then(res => {
      if (!res.ok) throw new Error("Unauthorized or server error");
      return res.json();
    })
    .then(providers => {
      updateStatus(true, "Connected");
      if (callback) callback(true, providers);
      else populateProviders(providers);
    })
    .catch(err => {
      updateStatus(false, "Disconnected");
      if (callback) callback(false, null);
    });
  }

  // Populate Providers Dropdown
  function populateProviders(providers) {
    if (!providers || providers.length === 0) return;
    
    providerSelect.innerHTML = "";
    providers.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      providerSelect.appendChild(opt);
    });
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
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0] && tabs[0].url) {
      try {
        const parsedUrl = new URL(tabs[0].url);
        activeTabHost = parsedUrl.hostname;
      } catch (e) {
        activeTabHost = "";
      }
    }
  });

  // Enable visual map selection mode
  toggleBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    chrome.tabs.sendMessage(tab.id, { action: "toggleMapMode", enabled: true });
    toggleBtn.innerText = "Mapping Active... Click an element";
  });

  // Listen for message from Content Script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "elementSelected") {
      currentSelector = request.selector;
      selectorVal.textContent = currentSelector;
      selectorPreview.style.display = "block";
      saveBtn.style.display = "block";
      toggleBtn.innerText = "Enable Map Mode";
    }
    if (request.action === "disableMapMode") {
      toggleBtn.innerText = "Enable Map Mode";
    }
  });

  // Save Mapping to Voyarr
  saveBtn.addEventListener('click', () => {
    if (!currentSelector || !activeTabHost) {
      showToast(mapToast, "No selector or hostname to map", false);
      return;
    }

    const payload = {
      host: activeTabHost,
      property: fieldSelect.value,
      selector: currentSelector
    };

    saveBtn.disabled = true;
    saveBtn.innerText = "Saving...";

    chrome.runtime.sendMessage({ action: "SAVE_RECIPE_MAPPING", payload }, (response) => {
      saveBtn.disabled = false;
      saveBtn.innerText = "Save to Voyarr";

      if (response && response.success) {
        showToast(mapToast, "Successfully saved to recipe!", true);
        saveBtn.style.display = "none";
        selectorPreview.style.display = "none";
        currentSelector = "";
      } else {
        const errMsg = response && response.error ? response.error : "Unknown connection error";
        showToast(mapToast, `Failed to save: ${errMsg}`, false);
      }
    });
  });
});