if (typeof window.__voyarrContentScriptInjected === 'undefined') {
  window.__voyarrContentScriptInjected = true;
  window.mapModeEnabled = false;

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleMapMode") {
      window.mapModeEnabled = request.enabled;
      if (window.mapModeEnabled) {
        document.body.style.cursor = "crosshair";
        injectUI();
        document.addEventListener('mouseover', highlightElement);
        document.addEventListener('mouseout', removeHighlight);
        document.addEventListener('mousemove', updateTooltipPosition);
        document.addEventListener('click', selectElement, { capture: true });
        document.addEventListener('keydown', handleKeyDown, { capture: true });
      } else {
        document.body.style.cursor = "default";
        removeUI();
        document.removeEventListener('mouseover', highlightElement);
        document.removeEventListener('mouseout', removeHighlight);
        document.removeEventListener('mousemove', updateTooltipPosition);
        document.removeEventListener('click', selectElement, { capture: true });
        document.removeEventListener('keydown', handleKeyDown, { capture: true });
        removeHighlightFromAll();
      }
    } else if (request.action === "testSelector") {
      let matchCount = 0;
      try {
        const els = document.querySelectorAll(request.selector);
        matchCount = els.length;
        
        els.forEach(el => {
          const origOutline = el.style.outline;
          const origBg = el.style.backgroundColor;
          const origTransition = el.style.transition;
          
          el.style.transition = "outline 0.3s, background-color 0.3s";
          el.style.outline = "2px solid #10b981";
          el.style.backgroundColor = "rgba(16, 185, 129, 0.2)";
          
          setTimeout(() => {
            el.style.outline = origOutline;
            el.style.backgroundColor = origBg;
            setTimeout(() => {
              el.style.transition = origTransition;
            }, 300);
          }, 1500);
        });
      } catch(err) {
        matchCount = 0;
      }
      sendResponse({ matchCount });
    }
  });

  let currentHighlighted = null;
  let originalOutline = "";
  let originalBackground = "";
  let tooltip = null;
  let toolbar = null;

  function injectUI() {
    if (!toolbar) {
      toolbar = document.createElement('div');
      toolbar.id = 'voyarr-map-toolbar';
      toolbar.innerHTML = `<span>🎯 <strong>Voyarr Mapping Mode Active</strong> &bull; Press <kbd style="background:#333;border:1px solid #555;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:11px;">ESC</kbd> to cancel</span>`;
      Object.assign(toolbar.style, {
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1e1e1e',
        color: '#fff',
        padding: '8px 16px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.1)',
        fontFamily: 'sans-serif',
        fontSize: '13px',
        zIndex: '2147483647',
        pointerEvents: 'none'
      });
      document.body.appendChild(toolbar);
    }
    
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'voyarr-map-tooltip';
      Object.assign(tooltip.style, {
        position: 'fixed',
        backgroundColor: '#dc004e',
        color: '#fff',
        padding: '4px 8px',
        borderRadius: '4px',
        fontFamily: 'monospace',
        fontSize: '12px',
        fontWeight: 'bold',
        zIndex: '2147483647',
        pointerEvents: 'none',
        display: 'none',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
      });
      document.body.appendChild(tooltip);
    }
  }

  function removeUI() {
    if (toolbar) {
      toolbar.remove();
      toolbar = null;
    }
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  }

  function updateTooltipPosition(e) {
    if (!tooltip || tooltip.style.display === 'none') return;
    tooltip.style.left = (e.clientX + 15) + 'px';
    tooltip.style.top = (e.clientY + 15) + 'px';
  }

  let highlightAnimationFrameId = null;
  let pendingHighlightTarget = null;

  function highlightElement(e) {
    if (!window.mapModeEnabled) return;
    if (pendingHighlightTarget === e.target) return;

    pendingHighlightTarget = e.target;

    if (highlightAnimationFrameId) {
      cancelAnimationFrame(highlightAnimationFrameId);
    }

    highlightAnimationFrameId = requestAnimationFrame(() => {
      if (!window.mapModeEnabled) return;
      
      // Revert previous highlight
      if (currentHighlighted && currentHighlighted !== pendingHighlightTarget) {
        currentHighlighted.style.outline = originalOutline;
        currentHighlighted.style.backgroundColor = originalBackground;
      }

      if (pendingHighlightTarget) {
        currentHighlighted = pendingHighlightTarget;
        originalOutline = currentHighlighted.style.outline;
        originalBackground = currentHighlighted.style.backgroundColor;

        currentHighlighted.style.outline = "2px dashed #a855f7"; // Theme-matching purple dashed border
        currentHighlighted.style.backgroundColor = "rgba(168, 85, 247, 0.08)";

        if (tooltip) {
          tooltip.textContent = `<${currentHighlighted.tagName.toUpperCase()}>`;
          tooltip.style.display = 'block';
        }
      }
    });
  }

  function removeHighlight(e) {
    if (!window.mapModeEnabled) return;
    if (pendingHighlightTarget === e.target) {
      pendingHighlightTarget = null;
    }
    
    if (currentHighlighted === e.target) {
      if (highlightAnimationFrameId) {
        cancelAnimationFrame(highlightAnimationFrameId);
      }
      
      highlightAnimationFrameId = requestAnimationFrame(() => {
        if (currentHighlighted) {
          currentHighlighted.style.outline = originalOutline;
          currentHighlighted.style.backgroundColor = originalBackground;
          currentHighlighted = null;
        }
        if (tooltip) tooltip.style.display = 'none';
      });
    }
  }

  function removeHighlightFromAll() {
    if (highlightAnimationFrameId) {
      cancelAnimationFrame(highlightAnimationFrameId);
    }
    if (currentHighlighted) {
      currentHighlighted.style.outline = originalOutline;
      currentHighlighted.style.backgroundColor = originalBackground;
      currentHighlighted = null;
    }
    pendingHighlightTarget = null;
    if (tooltip) tooltip.style.display = 'none';
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape' && window.mapModeEnabled) {
      e.preventDefault();
      e.stopPropagation();
      disableMapMode();
    }
  }

  function selectElement(e) {
    if (!window.mapModeEnabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    const selector = generateCSSSelector(e.target);
    let matchCount = 0;
    try {
      matchCount = document.querySelectorAll(selector).length;
    } catch(err) {
      matchCount = 1; // Fallback
    }

    (async () => {
      try {
        await chrome.storage.local.set({ pendingSelector: selector, pendingSelectorCount: matchCount });
      } catch (err) {
        console.error("Failed to set storage:", err);
      }
      chrome.runtime.sendMessage({ action: "elementSelected", selector, text: e.target.innerText, matchCount });
    })();
    
    disableMapMode();
  }

  function disableMapMode() {
    window.mapModeEnabled = false;
    document.body.style.cursor = "default";
    document.removeEventListener('mouseover', highlightElement);
    document.removeEventListener('mouseout', removeHighlight);
    document.removeEventListener('click', selectElement, { capture: true });
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
    removeHighlightFromAll();
    chrome.runtime.sendMessage({ action: "disableMapMode" });
  }

  function isStableId(id) {
    if (!id) return false;
    // Exclude dynamic frameworks/autogenerated/random IDs
    if (/^ember\d+/.test(id)) return false;
    if (/^:r[a-zA-Z0-9]+:/.test(id)) return false; // React 18+ useId() e.g. :r1:
    if (/^__next/.test(id)) return false;
    if (/-\d+$/.test(id)) return false; // ends with dynamic counter e.g. input-123
    if (/^[a-f0-9]{8,}$/.test(id)) return false; // looks like a hex hash
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(id);
  }

  function getStableClasses(el) {
    if (!el.classList || el.classList.length === 0) return [];
    const stable = [];
    for (const cls of el.classList) {
      // Ignore responsive/state modifiers e.g., hover:bg-red-500
      if (cls.includes(':')) continue;
      // Ignore Tailwind-like atomic utilities
      if (/^(p|m|w|h|bg|text|flex|grid|border|rounded|justify|items|opacity|transition|duration|shadow|cursor|outline|overflow|align|z|top|left|right|bottom|max|min|col|row|gap|self)-\w+/.test(cls)) continue;
      if (/^(flex|grid|block|inline|hidden|absolute|relative|fixed|static|truncate|antialiased|select-none|pointer-events-none)$/.test(cls)) continue;
      // Ignore CSS-in-JS dynamic hashed classes (e.g., css-12345, jss123, sc-123, css-abc12)
      if (/^(css|jss|sc|style)-[a-zA-Z0-9]+$/.test(cls)) continue;
      // Ignore auto-generated dynamic hashes in class names (e.g. contains 6+ alphanumeric characters)
      if (/[a-zA-Z0-9]{6,}/.test(cls) && /\d/.test(cls) && /[a-zA-Z]/.test(cls)) continue;
      
      if (/^[a-zA-Z0-9_-]+$/.test(cls)) {
        stable.push(cls);
      }
    }
    return stable;
  }

  function generateCSSSelector(el) {
    if (el.tagName.toLowerCase() === "html") return "html";
    let path = [];
    let current = el;
    
    while (current && current.nodeType === Node.ELEMENT_NODE && current.tagName.toLowerCase() !== "html") {
      let selector = current.tagName.toLowerCase();
      
      // 1. Check stable unique ID
      if (current.id && isStableId(current.id)) {
        selector += '#' + current.id;
        path.unshift(selector);
        break; // Unique ID, stop traversing
      }
      
      // 2. Check semantic data/aria attributes
      let attributeFound = false;
      const stableAttrs = ['data-testid', 'data-qa', 'data-cy', 'data-target', 'name', 'placeholder'];
      for (const attr of stableAttrs) {
        const val = current.getAttribute(attr);
        if (val && /^[a-zA-Z0-9_-]+$/.test(val)) {
          selector += `[${attr}="${val}"]`;
          attributeFound = true;
          break;
        }
      }
      
      if (!attributeFound) {
        const ariaLabel = current.getAttribute('aria-label');
        if (ariaLabel && ariaLabel.trim() && ariaLabel.length < 50) {
          selector += `[aria-label="${ariaLabel.replace(/"/g, '\\"')}"]`;
          attributeFound = true;
        }
      }

      // 3. Append stable semantic classes
      const stableClasses = getStableClasses(current);
      if (stableClasses.length > 0) {
        selector += '.' + stableClasses.join('.');
      }
      
      // If we found a unique semantic attribute or ID, we can stop traversing to keep the selector short and highly stable
      if (attributeFound) {
        path.unshift(selector);
        break;
      }

      // 4. Fallback to child position query
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
}
