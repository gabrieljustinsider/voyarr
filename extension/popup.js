document.getElementById('toggleBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  chrome.tabs.sendMessage(tab.id, { action: "toggleMapMode", enabled: true });
  document.getElementById('toggleBtn').innerText = "Mapping Active... Click an element";
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "elementSelected") {
    document.getElementById('result').innerHTML = `<strong>Selector:</strong> ${request.selector}<br><br><strong>Text:</strong> ${request.text}`;
    document.getElementById('toggleBtn').innerText = "Enable Map Mode";
  }
  if (request.action === "disableMapMode") {
    document.getElementById('toggleBtn').innerText = "Enable Map Mode";
  }
});