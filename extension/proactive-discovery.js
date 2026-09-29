// Voyarr Lens: Proactive Tab Discovery & Auto-Pairing
// Scans all tabs for Voyarr servers and automatically initiates pairing

import { isRFC1918URL, requestHostPermission } from './rfc1918.js';

let discoveryInterval = null;
const DISCOVERY_INTERVAL_MS = 30000; // 30 seconds
const PAIRING_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes cooldown per origin

// Track recently paired/dismissed origins to avoid spam
const pairingCooldowns = new Map(); // origin -> timestamp

export async function startProactiveDiscovery() {
    if (discoveryInterval) {
        clearInterval(discoveryInterval);
    }
    
    // Run immediately on startup
    await scanAllTabsForVoyarr();
    
    // Then run periodically
    discoveryInterval = setInterval(scanAllTabsForVoyarr, DISCOVERY_INTERVAL_MS);
    console.log('[Voyarr Lens] Proactive discovery started');
}

export async function scanAllTabsForVoyarr() {
    try {
        const tabs = await chrome.tabs.query({});
        
        for (const tab of tabs) {
            if (!tab.url || !tab.id) continue;
            
            // Skip chrome://, edge://, about:, file:, extension: URLs
            if (tab.url.startsWith('chrome://') || 
                tab.url.startsWith('edge://') || 
                tab.url.startsWith('about:') ||
                tab.url.startsWith('file:') ||
                tab.url.startsWith('moz-extension:') ||
                tab.url.startsWith('chrome-extension:')) {
                continue;
            }
            
            try {
                const url = new URL(tab.url);
                if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
                
                const origin = url.origin;
                
                // Check cooldown
                const lastAttempt = pairingCooldowns.get(origin);
                if (lastAttempt && Date.now() - lastAttempt < PAIRING_COOLDOWN_MS) {
                    continue;
                }
                
                // Check if already paired with this origin
                const isAlreadyPaired = await checkIfAlreadyPaired(origin);
                if (isAlreadyPaired) {
                    continue;
                }
                
                // Check if this tab is a Voyarr server
                const isVoyarr = await detectVoyarrServer(tab.id, origin);
                if (isVoyarr) {
                    console.log('[Voyarr Lens] Voyarr server detected at:', origin);
                    await initiateAutoPairing(tab.id, origin);
                }
            } catch (e) {
                // Invalid URL, skip
                continue;
            }
        }
    } catch (err) {
        console.error('[Voyarr Lens] Proactive discovery error:', err);
    }
}

async function detectVoyarrServer(tabId, origin) {
    // Strategy 1: Check for meta tag (fastest, no network request)
    try {
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => !!document.querySelector('meta[name="voyarr-server"]')
        });
        if (result) return true;
    } catch (e) {
        // Script execution failed (e.g., restricted page), try network check
    }
    
    // Strategy 2: Ping /api/health endpoint
    try {
        const hasPermission = await requestHostPermission(origin);
        if (!hasPermission) {
            console.warn('[Voyarr Lens] No host permission for:', origin);
            return false;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch(`${origin}/api/health`, { 
            signal: controller.signal,
            credentials: 'omit' // Don't send cookies
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data && data.status === 'healthy') {
                return true;
            }
        }
    } catch (e) {
        // Network check failed
    }
    
    // Strategy 3: Fallback to /health
    try {
        const hasPermission = await requestHostPermission(origin);
        if (!hasPermission) {
            console.warn('[Voyarr Lens] No host permission for:', origin);
            return false;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        const res = await fetch(`${origin}/health`, { 
            signal: controller.signal,
            credentials: 'omit'
        });
        clearTimeout(timeoutId);
        
        if (res.ok) {
            const data = await res.json().catch(() => ({}));
            if (data && data.status === 'healthy') {
                return true;
            }
        }
    } catch (e) {
        // Fallback failed
    }
    
    return false;
}

async function checkIfAlreadyPaired(origin) {
    try {
        const config = await chrome.storage.local.get(['voyarrServers']);
        const servers = config.voyarrServers || [];
        
        for (const server of servers) {
            try {
                const serverUrl = new URL(server.url);
                if (serverUrl.origin === origin) {
                    return true;
                }
            } catch (e) {
                // If URL parsing fails, do string comparison
                if (server.url.includes(origin) || origin.includes(server.url)) {
                    return true;
                }
            }
        }
    } catch (e) {
        console.error('[Voyarr Lens] Failed to check paired servers:', e);
    }
    return false;
}

async function initiateAutoPairing(tabId, origin) {
    try {
        // Get the active server config (we need an API key to call the pairing endpoint)
        // But the pairing initiation endpoint doesn't require auth - it creates a pairing code
        // that the extension can use to pair itself
        
        // First, we need to get the Voyarr server URL to call the pairing endpoint
        // Since we don't have an API key yet, we'll call the public pairing initiation endpoint
        
        const hasPermission = await requestHostPermission(origin);
        if (!hasPermission) {
            console.warn('[Voyarr Lens] No host permission for pairing:', origin);
            return;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const res = await fetch(`${origin}/api/auth/pair/initiate`, {
            method: 'POST',
            signal: controller.signal,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        clearTimeout(timeoutId);
        
        if (!res.ok) {
            throw new Error(`Pairing initiation failed: ${res.status}`);
        }
        
        const data = await res.json();
        const { pairing_code: pairingCode, expires_in: expiresIn } = data;
        
        if (!pairingCode) {
            throw new Error('No pairing code returned');
        }
        
        // Store the pending pairing
        await chrome.storage.local.set({
            pendingPairing: {
                url: origin,
                pairingCode,
                timestamp: Date.now(),
                autoInitiated: true
            }
        });
        
        // Also store in sessionStorage of the tab for fallback
        try {
            await chrome.scripting.executeScript({
                target: { tabId },
                func: (url, code) => {
                    sessionStorage.setItem('voyarr_pending_pairing', JSON.stringify({
                        url,
                        pairingCode: code,
                        timestamp: Date.now(),
                        autoInitiated: true
                    }));
                },
                args: [origin, pairingCode]
            });
        } catch (e) {
            // Tab might be restricted, ignore
        }
        
        // Set cooldown
        pairingCooldowns.set(origin, Date.now());
        
        // Show notification/badge to user
        await showPairingNotification(origin, pairingCode);
        
        // Update extension badge to indicate pairing available
        await chrome.action.setBadgeText({ text: '🔗' });
        await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
        await chrome.action.setBadgeTextColor({ color: '#ffffff' });
        
        console.log('[Voyarr Lens] Auto-pairing initiated for:', origin, 'Code:', pairingCode);
        
    } catch (err) {
        console.error('[Voyarr Lens] Auto-pairing failed:', err);
        // Set cooldown even on failure to avoid retry spam
        pairingCooldowns.set(origin, Date.now());
    }
}

async function showPairingNotification(origin, pairingCode) {
    try {
        // Use chrome.notifications API to show a system notification
        await chrome.notifications.create('voyarr-pairing-' + Date.now(), {
            type: 'basic',
            iconUrl: 'icon-128.png',
            title: 'Voyarr Lens: Pairing Available',
            message: `Voyarr server detected at ${origin}. Click to pair automatically.`,
            priority: 1,
            buttons: [
                { title: 'Pair Now' },
                { title: 'Dismiss' }
            ],
            requireInteraction: true
        });
    } catch (e) {
        console.warn('[Voyarr Lens] Could not show notification:', e);
        // Fallback: just update badge
    }
}

// Listen for notification button clicks
chrome.notifications.onButtonClicked.addListener(async (notificationId, buttonIndex) => {
    if (!notificationId.startsWith('voyarr-pairing-')) return;
    
    if (buttonIndex === 0) {
        // User clicked "Pair Now" - open the extension popup to complete pairing
        // We can't programmatically open popup in MV3, but we can open the extension's
        // action popup via a temporary tab with the popup URL, or focus the action
        try {
            // Create a temporary tab with the popup URL to simulate opening the popup
            const popupUrl = chrome.runtime.getURL('popup.html');
            const tabs = await chrome.tabs.query({ url: popupUrl });
            if (tabs.length > 0) {
                await chrome.tabs.update(tabs[0].id, { active: true });
                await chrome.windows.update(tabs[0].windowId, { focused: true });
            } else {
                await chrome.tabs.create({ url: popupUrl, active: true });
            }
        } catch (e) {
            console.warn('[Voyarr Lens] Could not open popup for pairing:', e);
            // Fallback: at least update badge to indicate pairing is ready
            await chrome.action.setBadgeText({ text: '🔗' });
            await chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
            await chrome.action.setBadgeTextColor({ color: '#ffffff' });
        }
        console.log('[Voyarr Lens] User clicked Pair Now from notification');
    } else if (buttonIndex === 1) {
        // User clicked "Dismiss" - clear pending pairing
        await chrome.storage.local.remove(['pendingPairing']);
        await chrome.action.setBadgeText({ text: '' });
        console.log('[Voyarr Lens] User dismissed pairing notification');
    }
});

// Listen for notification closed
chrome.notifications.onClosed.addListener(async (notificationId, byUser) => {
    if (!notificationId.startsWith('voyarr-pairing-')) return;
    
    if (byUser) {
        // User explicitly dismissed
        await chrome.storage.local.remove(['pendingPairing']);
        await chrome.action.setBadgeText({ text: '' });
    }
});

// Clear badge when pairing is completed (listens for storage changes)
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.pendingPairing) {
        if (!changes.pendingPairing.newValue) {
            // Pairing was removed (completed or dismissed)
            chrome.action.setBadgeText({ text: '' });
        }
    }
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPairingStatus') {
        // Return current pending pairing if any
        chrome.storage.local.get(['pendingPairing']).then(stored => {
            sendResponse({ pendingPairing: stored.pendingPairing || null });
        });
        return true;
    }
    
    if (request.action === 'dismissPairing') {
        chrome.storage.local.remove(['pendingPairing']);
        chrome.action.setBadgeText({ text: '' });
        sendResponse({ success: true });
    }
    
    if (request.action === 'triggerDiscovery') {
        scanAllTabsForVoyarr().then(() => sendResponse({ success: true }));
        return true;
    }
});