// Listen for pairing initiation event from Voyarr Web App
window.addEventListener('VOYARR_INITIATE_PAIRING', (e) => {
  if (e.detail && e.detail.url && e.detail.pairingCode) {
    chrome.runtime.sendMessage({
      action: "VOYARR_PAIRING_CODE_DETECTED",
      url: e.detail.url,
      pairingCode: e.detail.pairingCode
    });
  }
});
