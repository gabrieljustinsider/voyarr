document.addEventListener('DOMContentLoaded', () => {
    // Load existing config
    chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret'], (data) => {
        if (data.voyarrApiUrl) document.getElementById('apiUrl').value = data.voyarrApiUrl;
        if (data.voyarrSecret) document.getElementById('secretKey').value = data.voyarrSecret;
    });

    // Save Config
    document.getElementById('saveConfig').addEventListener('click', () => {
        const url = document.getElementById('apiUrl').value;
        const secret = document.getElementById('secretKey').value;
        chrome.storage.local.set({ voyarrApiUrl: url, voyarrSecret: secret }, () => {
            alert('Voyarr Configuration Saved!');
        });
    });

    // Activate Map Mode in active tab
    document.getElementById('activateMapMode').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: "TOGGLE_MAP_MODE" });
            window.close();
        });
    });
});