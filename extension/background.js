import { startProactiveDiscovery } from './proactive-discovery.js';
import { requestHostPermission } from './rfc1918.js';

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

    startConnectivityChecker();
    startProactiveDiscovery();
});

chrome.runtime.onStartup.addListener(() => {
    startConnectivityChecker();
    startProactiveDiscovery();
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

                const response = await fetch(`${baseUrl}/api/scraper/map-mode`, {
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
        
        // Check host permission before making fetch requests
        const hasPermission = await requestHostPermission(baseUrl);
        if (!hasPermission) {
            await showToastInTab(tab.id, "Error: Host permission not granted for backend URL.", "error");
            return;
        }
        
        await showToastInTab(tab.id, "Connecting to yt-dlp to extract the stream URL...", "info");

        const extractRes = await fetch(`${baseUrl}/api/download/extract-stream`, {
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
        const saveRes = await fetch(`${baseUrl}/api/download/save-stream`, {
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

let connectivityCheckInterval = null;
const CONNECTIVITY_CHECK_INTERVAL_MS = 30000;

async function startConnectivityChecker() {
    if (connectivityCheckInterval) {
        clearInterval(connectivityCheckInterval);
    }
    await checkAndUpdateBadge();
    connectivityCheckInterval = setInterval(checkAndUpdateBadge, CONNECTIVITY_CHECK_INTERVAL_MS);
}

async function checkAndUpdateBadge() {
    try {
        // Check if there's a pending pairing - if so, don't overwrite the pairing badge
        const pairingState = await chrome.storage.local.get(['pendingPairing']);
        if (pairingState.pendingPairing) {
            // Keep the pairing badge (🔗) set by proactive-discovery
            return;
        }
        
        const config = await chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret', 'voyarrServers', 'activeServerId']);
        
        if (!config.voyarrApiUrl || !config.voyarrSecret) {
            await setBadgeUnconfigured();
            return;
        }

        const baseUrl = config.voyarrApiUrl.replace(/\/$/, '');
        
        // Check host permission before making fetch requests
        const hasPermission = await requestHostPermission(baseUrl);
        if (!hasPermission) {
            console.warn('[Voyarr Lens] No host permission for connectivity check:', baseUrl);
            await setBadgeDisconnected();
            return;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(`${baseUrl}/api/health`, {
                signal: controller.signal,
                headers: {
                    'X-Voyarr-Api-Key': config.voyarrSecret
                }
            });
            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                if (data && data.status === "healthy") {
                    await setBadgeConnected();
                    return;
                }
            }
        } catch (err) {
            clearTimeout(timeoutId);
        }

        await setBadgeDisconnected();
    } catch (err) {
        console.error("Connectivity check failed:", err);
        await setBadgeDisconnected();
    }
}

async function setBadgeConnected() {
    await chrome.action.setBadgeText({ text: "ON" });
    await chrome.action.setBadgeBackgroundColor({ color: "#10b981" });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
}

async function setBadgeDisconnected() {
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#ef4444" });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
}

async function setBadgeUnconfigured() {
    await chrome.action.setBadgeText({ text: "OFF" });
    await chrome.action.setBadgeBackgroundColor({ color: "#6b7280" });
    await chrome.action.setBadgeTextColor({ color: "#ffffff" });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "triggerConnectivityCheck") {
        checkAndUpdateBadge().then(() => sendResponse({ success: true }));
        return true;
    }
    
    if (request.action === "clearPairingBadge") {
        checkAndUpdateBadge().then(() => sendResponse({ success: true }));
        return true;
    }
});