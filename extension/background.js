chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "voyarr-parent",
        title: "Voyarr",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "voyarr-map-mode",
        parentId: "voyarr-parent",
        title: "Start Voyarr Map Mode",
        contexts: ["all"]
    });

    chrome.contextMenus.create({
        id: "voyarr-extract-stream",
        parentId: "voyarr-parent",
        title: "Extract Live Stream",
        contexts: ["all"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "voyarr-map-mode") {
        activateMapMode(tab);
    } else if (info.menuItemId === "voyarr-extract-stream") {
        extractLiveStream(tab);
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

async function extractLiveStream(tab) {
    if (!tab || !tab.url) return;
    try {
        const config = await chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret']);
        if (!config.voyarrSecret || !config.voyarrApiUrl) {
            showNotification("Voyarr Error", "Missing backend URL or API key in settings.");
            return;
        }

        const baseUrl = config.voyarrApiUrl.replace(/\/$/, '');
        showNotification("Extracting Stream", "Connecting to yt-dlp to extract the stream URL...");

        const extractRes = await fetch(`${baseUrl}/download/extract-stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Voyarr-Api-Key': config.voyarrSecret
            },
            body: JSON.stringify({ url: tab.url })
        });

        if (!extractRes.ok) {
            const errData = await extractRes.json().catch(() => ({}));
            throw new Error(errData.detail || `Server returned status: ${extractRes.status}`);
        }

        const extractData = await extractRes.json();
        const { stream_url, title } = extractData;

        if (!stream_url) {
            throw new Error("No stream URL returned.");
        }

        // Save it directly!
        const saveRes = await fetch(`${baseUrl}/download/save-stream`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Voyarr-Api-Key': config.voyarrSecret
            },
            body: JSON.stringify({ title: title || tab.title || "Live Stream", url: stream_url })
        });

        if (!saveRes.ok) {
            throw new Error(`Failed to save stream: ${saveRes.statusText}`);
        }

        showNotification("Stream Saved!", `Successfully extracted and saved: ${title || "Live Stream"}`);
    } catch (err) {
        console.error("Failed to extract stream:", err);
        showNotification("Extraction Failed", err.message || err.toString());
    }
}

function showNotification(title, message) {
    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icon-128.png',
        title: title,
        message: message,
        priority: 2
    });
}