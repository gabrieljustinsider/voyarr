let mapModeActive = false;
let currentHighlighted = null;

// Listen for activation from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_MAP_MODE") {
        mapModeActive = true;
        console.log("Voyarr Map Mode Activated.");
    }
});

// Handle Hover Highlights
document.addEventListener('mouseover', (e) => {
    if (!mapModeActive) return;
    e.stopPropagation();
    currentHighlighted = e.target;
    currentHighlighted.classList.add('voyarr-highlight');
});

document.addEventListener('mouseout', (e) => {
    if (!mapModeActive) return;
    if (currentHighlighted) {
        currentHighlighted.classList.remove('voyarr-highlight');
    }
});

// Handle Click to Select
document.addEventListener('click', (e) => {
    if (!mapModeActive) return;
    e.preventDefault();
    e.stopPropagation();
    
    // Generate simple CSS selector
    let selector = e.target.tagName.toLowerCase();
    if (e.target.id) selector += `#${e.target.id}`;
    if (e.target.className) {
        let classes = e.target.className.split(/\s+/).filter(c => c && c !== 'voyarr-highlight');
        if (classes.length > 0) selector += `.${classes.join('.')}`;
    }

    showOverlay(selector);
    
    if (currentHighlighted) currentHighlighted.classList.remove('voyarr-highlight');
    mapModeActive = false; // Turn off until triggered again
});

function showOverlay(selector) {
    const overlay = document.createElement('div');
    overlay.id = 'voyarr-overlay';
    overlay.innerHTML = `
        <div class="voyarr-header">Voyarr Map Mode</div>
        <div class="voyarr-body">
            <input type="text" id="voyarr-selector" value="${selector}" />
            <select id="voyarr-property">
                <option value="title">Title</option>
                <option value="performers">Performers</option>
                <option value="tags">Tags/Categories</option>
            </select>
            <button id="voyarr-save">Save to Recipe</button>
            <button id="voyarr-cancel">Cancel</button>
        </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('voyarr-save').addEventListener('click', () => {
        const property = document.getElementById('voyarr-property').value;
        const finalSelector = document.getElementById('voyarr-selector').value;
        
        chrome.runtime.sendMessage({
            action: "SAVE_RECIPE_MAPPING",
            payload: { host: window.location.hostname, property, selector: finalSelector }
        }, (response) => {
            if (response && response.success) overlay.remove();
            else alert('Failed to save configuration. Check extension setup.');
        });
    });
    document.getElementById('voyarr-cancel').addEventListener('click', () => overlay.remove());
}