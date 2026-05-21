let mapModeEnabled = false;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleMapMode") {
    mapModeEnabled = request.enabled;
    if (mapModeEnabled) {
      document.body.style.cursor = "crosshair";
      document.addEventListener('mouseover', highlightElement);
      document.addEventListener('mouseout', removeHighlight);
      document.addEventListener('click', selectElement, { capture: true });
    } else {
      document.body.style.cursor = "default";
      document.removeEventListener('mouseover', highlightElement);
      document.removeEventListener('mouseout', removeHighlight);
      document.removeEventListener('click', selectElement, { capture: true });
      removeHighlightFromAll();
    }
  }
});

function highlightElement(e) {
  if (!mapModeEnabled) return;
  e.target.style.outline = "2px solid red";
  e.target.style.backgroundColor = "rgba(255,0,0,0.1)";
}

function removeHighlight(e) {
  e.target.style.outline = "";
  e.target.style.backgroundColor = "";
}

function removeHighlightFromAll() {
  const els = document.querySelectorAll('*');
  els.forEach(el => { el.style.outline = ""; el.style.backgroundColor = ""; });
}

function selectElement(e) {
  if (!mapModeEnabled) return;
  e.preventDefault();
  e.stopPropagation();
  
  const selector = generateCSSSelector(e.target);
  chrome.runtime.sendMessage({ action: "elementSelected", selector, text: e.target.innerText });
  
  disableMapMode();
}

function disableMapMode() {
  mapModeEnabled = false;
  document.body.style.cursor = "default";
  document.removeEventListener('mouseover', highlightElement);
  document.removeEventListener('mouseout', removeHighlight);
  document.removeEventListener('click', selectElement, { capture: true });
  removeHighlightFromAll();
  chrome.runtime.sendMessage({ action: "disableMapMode" });
}

function generateCSSSelector(el) {
  if (el.tagName.toLowerCase() === "html") return "html";
  if (el.id) return `#${el.id}`;
  if (el.className && typeof el.className === 'string') {
    const classes = el.className.split(' ').filter(c => c).join('.');
    if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
  }
  return el.tagName.toLowerCase();
}