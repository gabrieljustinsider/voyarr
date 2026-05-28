(function () {
  // If already active, toggle off and cleanup
  if (window.__voyarrBookmarkletActive) {
    window.__voyarrBookmarkletCleanup();
    return;
  }

  window.__voyarrBookmarkletActive = true;

  // 1. Create global variables for selector states
  let currentTargetField = null;
  let currentHighlighted = null;
  let originalOutline = "";
  let originalBackground = "";

  // Load configuration from localStorage
  let config = {
    serverUrl: localStorage.getItem('voyarr_server_url') || 'http://localhost:8000',
    secret: localStorage.getItem('voyarr_secret') || '',
    providerId: localStorage.getItem('voyarr_provider_id') || ''
  };

  // Selectors mapped so far
  let selectors = {
    title: '',
    performers: '',
    tags: '',
    video_source: ''
  };

  // 2. Inject Premium Glassmorphic Styles
  const style = document.createElement('style');
  style.id = 'voyarr-bookmarklet-styles';
  style.innerHTML = `
    #voyarr-panel {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 340px;
      background: rgba(30, 30, 30, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 13px;
      z-index: 9999999;
      overflow: hidden;
      transition: opacity 0.3s, transform 0.3s;
    }
    #voyarr-panel.minimized {
      opacity: 0.15;
      transform: scale(0.9) translate(10px, 10px);
      pointer-events: none;
    }
    .voyarr-header {
      padding: 12px 16px;
      background: rgba(220, 0, 78, 0.2);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .voyarr-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: bold;
      color: #ffffff;
    }
    .voyarr-body {
      padding: 16px;
    }
    .voyarr-field-row {
      margin-bottom: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .voyarr-field-label {
      font-weight: 600;
      color: #ccc;
      font-size: 11px;
      text-transform: uppercase;
    }
    .voyarr-input-group {
      display: flex;
      gap: 6px;
    }
    .voyarr-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 6px;
      color: #fff;
      padding: 6px 10px;
      font-size: 12px;
      font-family: monospace;
    }
    .voyarr-input:focus {
      outline: none;
      border-color: #dc004e;
    }
    .voyarr-btn {
      background: #dc004e;
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      transition: background 0.2s;
    }
    .voyarr-btn:hover {
      background: #b0003a;
    }
    .voyarr-btn-secondary {
      background: rgba(255, 255, 255, 0.1);
    }
    .voyarr-btn-secondary:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    .voyarr-btn-success {
      background: #10b981;
    }
    .voyarr-btn-success:hover {
      background: #059669;
    }
    .voyarr-badge {
      background: rgba(255, 255, 255, 0.08);
      border-radius: 4px;
      padding: 2px 6px;
      font-size: 10px;
    }
    .voyarr-tooltip {
      position: fixed;
      background: #dc004e;
      color: #fff;
      padding: 4px 8px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000000;
      pointer-events: none;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    }
  `;
  document.head.appendChild(style);

  // 3. Create Dashboard HTML Panel
  const panel = document.createElement('div');
  panel.id = 'voyarr-panel';
  panel.innerHTML = `
    <div class="voyarr-header">
      <h3>🎯 Voyarr Lens VR</h3>
      <button id="voyarr-close-btn" class="voyarr-btn voyarr-btn-secondary" style="padding: 2px 6px; border-radius: 4px;">&times;</button>
    </div>
    <div class="voyarr-body">
      <div class="voyarr-field-row">
        <label class="voyarr-field-label">Server Config</label>
        <input type="text" id="voyarr-server-input" class="voyarr-input" placeholder="Server URL" value="" />
        <input type="password" id="voyarr-secret-input" class="voyarr-input" placeholder="Extension Secret" value="" style="margin-top:4px;" />
        <input type="text" id="voyarr-provider-input" class="voyarr-input" placeholder="Provider ID (e.g. 1)" value="" style="margin-top:4px;" />
      </div>
      
      <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;"></div>

      <div class="voyarr-field-row">
        <label class="voyarr-field-label">Title Selector</label>
        <div class="voyarr-input-group">
          <input type="text" id="voyarr-title-input" class="voyarr-input" placeholder="Not mapped..." />
          <button class="voyarr-btn voyarr-btn-secondary map-btn" data-field="title">Map</button>
        </div>
      </div>
      
      <div class="voyarr-field-row">
        <label class="voyarr-field-label">Performers Selector</label>
        <div class="voyarr-input-group">
          <input type="text" id="voyarr-performers-input" class="voyarr-input" placeholder="Not mapped..." />
          <button class="voyarr-btn voyarr-btn-secondary map-btn" data-field="performers">Map</button>
        </div>
      </div>

      <div class="voyarr-field-row">
        <label class="voyarr-field-label">Tags Selector</label>
        <div class="voyarr-input-group">
          <input type="text" id="voyarr-tags-input" class="voyarr-input" placeholder="Not mapped..." />
          <button class="voyarr-btn voyarr-btn-secondary map-btn" data-field="tags">Map</button>
        </div>
      </div>

      <div class="voyarr-field-row">
        <label class="voyarr-field-label">Video Source Selector</label>
        <div class="voyarr-input-group">
          <input type="text" id="voyarr-source-input" class="voyarr-input" placeholder="Not mapped..." />
          <button class="voyarr-btn voyarr-btn-secondary map-btn" data-field="video_source">Map</button>
        </div>
      </div>

      <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 12px 0;"></div>

      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button id="voyarr-save-btn" class="voyarr-btn voyarr-btn-success" style="flex: 1;">Save Recipe</button>
        <button id="voyarr-copy-btn" class="voyarr-btn voyarr-btn-secondary" style="padding: 6px 10px;" title="Copy JSON Recipe">📋</button>
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  // 4. Input Configuration Listeners & Safe Value Settings
  const serverInput = document.getElementById('voyarr-server-input');
  const secretInput = document.getElementById('voyarr-secret-input');
  const providerInput = document.getElementById('voyarr-provider-input');

  serverInput.value = config.serverUrl || '';
  secretInput.value = config.secret || '';
  providerInput.value = config.providerId || '';

  // Create active mapping mode label/tooltip
  let tooltip = null;

  const saveConfig = () => {
    config.serverUrl = serverInput.value.trim();
    config.secret = secretInput.value.trim();
    config.providerId = providerInput.value.trim();
    localStorage.setItem('voyarr_server_url', config.serverUrl); // lgtm [js/clear-text-storage-of-sensitive-data]
    localStorage.setItem('voyarr_secret', config.secret); // lgtm [js/clear-text-storage-of-sensitive-data]
    localStorage.setItem('voyarr_provider_id', config.providerId); // lgtm [js/clear-text-storage-of-sensitive-data]
  };

  serverInput.addEventListener('change', saveConfig);
  secretInput.addEventListener('change', saveConfig);
  providerInput.addEventListener('change', saveConfig);

  // 5. Point and Click Mapping Mode Core
  const mapButtons = document.querySelectorAll('.map-btn');
  mapButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      currentTargetField = this.getAttribute('data-field');
      startMappingMode();
    });
  });

  function startMappingMode() {
    panel.classList.add('minimized');
    document.body.style.cursor = 'crosshair';

    // Inject element mapping tooltip
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.className = 'voyarr-tooltip';
      tooltip.style.display = 'none';
      document.body.appendChild(tooltip);
    }

    document.addEventListener('mouseover', highlightElement);
    document.addEventListener('mouseout', removeHighlight);
    document.addEventListener('mousemove', updateTooltipPosition);
    document.addEventListener('click', selectElement, { capture: true });
    document.addEventListener('keydown', handleKeyDown, { capture: true });
  }

  function highlightElement(e) {
    if (!currentTargetField) return;
    if (panel.contains(e.target) || e.target.className === 'voyarr-tooltip') return;
    
    if (currentHighlighted && currentHighlighted !== e.target) {
      currentHighlighted.style.outline = originalOutline;
      currentHighlighted.style.backgroundColor = originalBackground;
    }

    currentHighlighted = e.target;
    originalOutline = e.target.style.outline;
    originalBackground = e.target.style.backgroundColor;

    e.target.style.outline = "2px solid #dc004e";
    e.target.style.backgroundColor = "rgba(220, 0, 78, 0.1)";

    tooltip.textContent = `<${e.target.tagName.toUpperCase()}>`;
    tooltip.style.display = 'block';
  }

  function removeHighlight(e) {
    if (currentHighlighted === e.target) {
      e.target.style.outline = originalOutline;
      e.target.style.backgroundColor = originalBackground;
      currentHighlighted = null;
      tooltip.style.display = 'none';
    }
  }

  function updateTooltipPosition(e) {
    if (!tooltip || tooltip.style.display === 'none') return;
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
  }

  function selectElement(e) {
    if (!currentTargetField) return;
    e.preventDefault();
    e.stopPropagation();

    const selector = generateCSSSelector(e.target);
    selectors[currentTargetField] = selector;

    // Update input display
    const inputId = `voyarr-${currentTargetField === 'video_source' ? 'source' : currentTargetField}-input`;
    document.getElementById(inputId).value = selector;

    stopMappingMode();
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopMappingMode();
    }
  }

  function stopMappingMode() {
    currentTargetField = null;
    document.body.style.cursor = 'default';
    
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mouseout', removeHighlight);
    document.removeEventListener('mousemove', updateTooltipPosition);
    document.removeEventListener('click', selectElement, { capture: true });
    document.removeEventListener('keydown', handleKeyDown, { capture: true });

    if (currentHighlighted) {
      currentHighlighted.style.outline = originalOutline;
      currentHighlighted.style.backgroundColor = originalBackground;
      currentHighlighted = null;
    }

    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }

    panel.classList.remove('minimized');
  }

  function generateCSSSelector(el) {
    if (el.tagName.toLowerCase() === "html") return "html";
    let path = [];
    let current = el;
    
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== "html") {
      let selector = current.tagName.toLowerCase();
      
      if (current.id && /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(current.id)) {
        selector += '#' + current.id;
        path.unshift(selector);
        break;
      }
      
      let sibling = current.parentNode.firstElementChild;
      let nth = 1;
      let hasSameTypeSibling = false;
      
      while (sibling) {
        if (sibling !== current && sibling.tagName === current.tagName) {
          hasSameTypeSibling = true;
        }
        if (sibling === current) {
          let nextSib = sibling.nextElementSibling;
          while (nextSib) {
            if (nextSib.tagName === current.tagName) hasSameTypeSibling = true;
            nextSib = nextSib.nextElementSibling;
          }
          break;
        }
        if (sibling.tagName === current.tagName) {
          nth++;
        }
        sibling = sibling.nextElementSibling;
      }
      
      if (hasSameTypeSibling) {
        selector += `:nth-of-type(${nth})`;
      }
      
      path.unshift(selector);
      current = current.parentNode;
    }
    return path.join(" > ");
  }

  // 6. Action Button Actions
  document.getElementById('voyarr-close-btn').addEventListener('click', cleanup);

  document.getElementById('voyarr-copy-btn').addEventListener('click', () => {
    saveConfig();
    const recipeJSON = JSON.stringify({
      host: window.location.hostname,
      provider_id: config.providerId ? parseInt(config.providerId) : null,
      css_selectors: {
        title: document.getElementById('voyarr-title-input').value.trim(),
        performers: document.getElementById('voyarr-performers-input').value.trim(),
        tags: document.getElementById('voyarr-tags-input').value.trim(),
        video_source: document.getElementById('voyarr-source-input').value.trim()
      }
    }, null, 2);
    
    navigator.clipboard.writeText(recipeJSON).then(() => {
      alert('📋 Recipe JSON copied to clipboard successfully!');
    }).catch(err => {
      alert('Failed to copy: ' + err);
    });
  });

  document.getElementById('voyarr-save-btn').addEventListener('click', async () => {
    saveConfig();
    const saveBtn = document.getElementById('voyarr-save-btn');
    const originalText = saveBtn.textContent;
    
    if (!config.serverUrl) {
      alert('Please configure your Voyarr Server URL!');
      return;
    }

    const payloadFields = ['title', 'performers', 'tags', 'video_source'];
    let successCount = 0;

    saveBtn.textContent = 'Saving...';
    saveBtn.disabled = true;

    for (const field of payloadFields) {
      const inputId = `voyarr-${field === 'video_source' ? 'source' : field}-input`;
      const val = document.getElementById(inputId).value.trim();
      if (!val) continue;

      try {
        const res = await fetch(`${config.serverUrl}/api/scraper/map-mode`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Voyarr-Api-Key': config.secret
          },
          body: JSON.stringify({
            host: window.location.hostname,
            property: field,
            selector: val,
            provider_id: config.providerId ? parseInt(config.providerId) : null
          })
        });

        if (res.ok) {
          successCount++;
        } else {
          const errData = await res.json();
          console.error(`Failed to map ${field}:`, errData);
        }
      } catch (err) {
        console.error(`Error saving ${field}:`, err);
      }
    }

    saveBtn.textContent = originalText;
    saveBtn.disabled = false;

    if (successCount > 0) {
      alert(`✅ Mapped ${successCount} selector(s) directly to your server!`);
    } else {
      alert(`❌ Failed to save selectors. Check CORS/secrets or use the 📋 Copy button to paste manually!`);
    }
  });

  // 7. Cleanup Function
  function cleanup() {
    stopMappingMode();
    if (panel) panel.remove();
    if (style) style.remove();
    delete window.__voyarrBookmarkletActive;
    delete window.__voyarrBookmarkletCleanup;
  }

  window.__voyarrBookmarkletCleanup = cleanup;
})();
