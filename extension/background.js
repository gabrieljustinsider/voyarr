chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SAVE_RECIPE_MAPPING") {
        
        // Fetch Auth data from Extension Storage
        chrome.storage.local.get(['voyarrApiUrl', 'voyarrSecret'], (config) => {
            if (!config.voyarrSecret || !config.voyarrApiUrl) {
                sendResponse({ success: false, error: "Missing configuration" });
                return;
            }

            // Strip trailing slash if the user added one
            const baseUrl = config.voyarrApiUrl.replace(/\/$/, '');

            fetch(`${baseUrl}/scraper/map-mode`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Securely authenticate the payload
                    'X-Voyarr-Api-Key': config.voyarrSecret
                },
                body: JSON.stringify(request.payload)
            })
            .then(res => res.json())
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.toString() }));
        });
        
        return true; // Keep message channel open for async fetch
    }
});