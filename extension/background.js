chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "voyarr-map-mode",
        title: "Start Voyarr Map Mode",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "voyarr-map-mode") {
        activateMapMode(tab);
    }
});

chrome.commands.onCommand.addListener((command, tab) => {
    if (command === "toggle-map-mode") {
        activateMapMode(tab);
    }
});

async function activateMapMode(tab) {
    if (!tab || !tab.id) return;
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id, allFrames: true },
            files: ['content.js']
        });
        await chrome.tabs.sendMessage(tab.id, { action: "toggleMapMode", enabled: true });
    } catch (err) {
        console.error("Failed to inject script or send message:", err);
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "VOYARR_PAIRING_CODE_DETECTED") {
        chrome.storage.local.set({
            pendingPairing: {
                url: request.url,
                pairingCode: request.pairingCode,
                timestamp: Date.now()
            }
        });
        return;
    }

    if (request.action === "SAVE_RECIPE_MAPPING") {
        (async () => {
            try {
                // Fetch Auth data from Extension Storage
                const config = await chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret']);
                if (!config.voyarrSecret || !config.voyarrApiUrl) {
                    sendResponse({ success: false, error: "Missing configuration" });
                    return;
                }

                // Strip trailing slash if the user added one
                const baseUrl = config.voyarrApiUrl.replace(/\/$/, '');

                const response = await fetch(`${baseUrl}/scraper/map-mode`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Voyarr-Api-Key': config.voyarrSecret
                    },
                    body: JSON.stringify(request.payload)
                });
                
                if (!response.ok) {
                    throw new Error(`Server returned status: ${response.status}`);
                }
                
                const data = await response.json();
                sendResponse({ success: true, data });
            } catch (error) {
                sendResponse({ success: false, error: error.toString() });
            }
        })();
        
        return true; // Keep message channel open for async fetch
    }
});