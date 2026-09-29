// Shared RFC1918 private IP detection utility
// Used to bypass host permission prompts for private network addresses

export function isRFC1918Hostname(hostname) {
    const host = hostname.toLowerCase();
    
    // localhost and loopback
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local") || /^127\./.test(host)) {
        return true;
    }
    
    // RFC1918 private IP ranges
    // 10.0.0.0/8
    if (/^10\./.test(host)) return true;
    // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)) return true;
    // 192.168.0.0/16
    if (/^192\.168\./.test(host)) return true;
    
    return false;
}

export function isRFC1918URL(url) {
    try {
        const parsed = new URL(url);
        return isRFC1918Hostname(parsed.hostname);
    } catch (e) {
        return false;
    }
}

export function getOriginPattern(url) {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.host}/*`;
    } catch (e) {
        return null;
    }
}

// Check if we have host permission for a URL (for RFC1918, always true since they're in manifest host_permissions)
export async function hasHostPermission(url) {
    if (isRFC1918URL(url)) {
        return true;
    }
    const pattern = getOriginPattern(url);
    if (!pattern) return false;
    try {
        return await chrome.permissions.contains({ origins: [pattern] });
    } catch (e) {
        return false;
    }
}

// Request host permission for a URL (for RFC1918, auto-grant since they're in manifest)
export async function requestHostPermission(url) {
    if (isRFC1918URL(url)) {
        return true;
    }
    const pattern = getOriginPattern(url);
    if (!pattern) return false;
    try {
        const hasPermission = await chrome.permissions.contains({ origins: [pattern] });
        if (!hasPermission) {
            return await chrome.permissions.request({ origins: [pattern] });
        }
        return true;
    } catch (e) {
        console.error("Failed to check/request host permission:", e);
        return false;
    }
}