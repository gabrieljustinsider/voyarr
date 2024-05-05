// background.js for Voyarr Extension

const VOYARR_API = "http://localhost:8000";

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SAVE_RECIPE") {
        const payload = request.payload;
        // In a real scenario we might need to know the provider ID, but for now we send host
        
        fetch(`${VOYARR_API}/settings/site_recipe`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(response => response.json())
        .then(data => {
            console.log("Recipe saved", data);
            sendResponse({ success: true, data: data });
        })
        .catch(error => {
            console.error("Error saving recipe", error);
            sendResponse({ success: false, error: error.toString() });
        });
        
        return true; // Keep the message channel open for async response
    }
});
