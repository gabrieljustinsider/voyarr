document.getElementById('toggleMapMode').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { action: "TOGGLE_MAP_MODE" }, (response) => {
        const status = document.getElementById('status');
        if (response && response.mapModeActive) {
            status.textContent = "Map mode is ACTIVE.";
        } else {
            status.textContent = "Map mode is OFF.";
        }
    });
});

document.getElementById('scrapePage').addEventListener('click', async () => {
    // Send message to background script to trigger Voyarr backend
    document.getElementById('status').textContent = "Scrape triggered...";
});
