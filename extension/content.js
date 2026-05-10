/* Voyarr Extension Content Script */
let mapModeActive = false;
let hoveredElement = null;

// The overlay panel
let panel = null;

function createPanel() {
    panel = document.createElement('div');
    panel.id = 'voyarr-map-panel';
    panel.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 10px;">Voyarr Mapping</div>
        <div>Field: <select id="voyarr-field-select">
            <option value="title">Title</option>
            <option value="performers">Performers</option>
            <option value="tags">Tags</option>
            <option value="resolution">Resolution</option>
            <option value="video_url">Video URL</option>
        </select></div>
        <div style="margin-top: 10px;">Selector:</div>
        <input type="text" id="voyarr-selector-input" style="width: 100%; box-sizing: border-box;" />
        <button id="voyarr-save-btn" style="margin-top: 10px; width: 100%;">Save to SiteRecipe</button>
    `;
    document.body.appendChild(panel);

    document.getElementById('voyarr-save-btn').addEventListener('click', () => {
        const field = document.getElementById('voyarr-field-select').value;
        const selector = document.getElementById('voyarr-selector-input').value;
        
        // Send to background to save to Voyarr backend
        chrome.runtime.sendMessage({
            action: "SAVE_RECIPE",
            payload: {
                host: window.location.hostname,
                field: field,
                selector: selector
            }
        }, (response) => {
            alert('Saved to Voyarr: ' + selector);
        });
    });
}

function getCssSelector(el) {
    if (!(el instanceof Element)) return;
    const path = [];
    while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id) {
            selector += '#' + el.id;
            path.unshift(selector);
            break;
        } else {
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() == selector) nth++;
            }
            if (nth != 1) selector += ":nth-of-type(" + nth + ")";
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(" > ");
}

document.addEventListener('mouseover', (e) => {
    if (!mapModeActive) return;
    if (panel && panel.contains(e.target)) return;

    if (hoveredElement) {
        hoveredElement.classList.remove('voyarr-highlight');
    }
    hoveredElement = e.target;
    hoveredElement.classList.add('voyarr-highlight');

    const selector = getCssSelector(hoveredElement);
    if (panel) {
        document.getElementById('voyarr-selector-input').value = selector;
    }
});

document.addEventListener('click', (e) => {
    if (!mapModeActive) return;
    if (panel && panel.contains(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    // Freeze the selection
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "TOGGLE_MAP_MODE") {
        mapModeActive = !mapModeActive;
        if (mapModeActive) {
            document.body.classList.add('voyarr-mapping-active');
            if (!panel) createPanel();
            panel.style.display = 'block';
        } else {
            document.body.classList.remove('voyarr-mapping-active');
            if (hoveredElement) {
                hoveredElement.classList.remove('voyarr-highlight');
            }
            if (panel) panel.style.display = 'none';
        }
        sendResponse({ mapModeActive: mapModeActive });
    }
});
