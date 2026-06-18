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
    if (!tab || !tab.url || !tab.id) return;
    try {
        const config = await chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret']);
        if (!config.voyarrSecret || !config.voyarrApiUrl) {
            await showToastInTab(tab.id, "Error: Missing backend URL or API key in settings.", "error");
            return;
        }

        const baseUrl = config.voyarrApiUrl.replace(/\/$/, '');
        await showToastInTab(tab.id, "Connecting to yt-dlp to extract the stream URL...", "info");

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

        await showToastInTab(tab.id, `Successfully extracted and saved: ${title || "Live Stream"}`, "success");
    } catch (err) {
        console.error("Failed to extract stream:", err);
        await showToastInTab(tab.id, `Extraction Failed: ${err.message || err.toString()}`, "error");
    }
}

async function showToastInTab(tabId, message, type = 'info') {
    try {
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (msg, toastType) => {
                const existing = document.getElementById('voyarr-injected-toast');
                if (existing) existing.remove();

                const toast = document.createElement('div');
                toast.id = 'voyarr-injected-toast';
                
                let bg = '#312e81'; // dark blue
                let border = '#4338ca';
                if (toastType === 'success') {
                    bg = '#064e3b'; // dark green
                    border = '#047857';
                } else if (toastType === 'error') {
                    bg = '#7f1d1d'; // dark red
                    border = '#b91c1c';
                }

                Object.assign(toast.style, {
                    position: 'fixed',
                    bottom: '20px',
                    right: '20px',
                    backgroundColor: bg,
                    color: '#f9fafb',
                    padding: '12px 18px',
                    borderRadius: '8px',
                    border: `1px solid ${border}`,
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
                    fontSize: '13px',
                    fontWeight: '500',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                    zIndex: '9999999',
                    opacity: '0',
                    transform: 'translateY(20px)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                });

                toast.innerText = msg;
                document.body.appendChild(toast);

                toast.offsetHeight; // force layout reflow

                toast.style.opacity = '1';
                toast.style.transform = 'translateY(0)';

                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateY(-20px)';
                    setTimeout(() => toast.remove(), 300);
                }, 4000);
            },
            args: [message, type]
        });
    } catch (e) {
        console.error("Failed to inject toast:", e);
    }
}