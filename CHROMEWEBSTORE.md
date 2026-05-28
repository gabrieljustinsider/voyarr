# **Voyarr Lens — Chrome Web Store Listing**

This document serves as the single source of truth for the **Voyarr Lens** companion Chrome extension store listing, containing all descriptive copy, assets mappings, plain-English permissions justifications, and privacy disclosures.

---

## **📝 Store Listing Copy**

### **1. Extension Title**
`Voyarr Lens`

### **2. Short Description (max 150 chars)**
`The official companion tool for Voyarr. Visually map CSS selectors to integrate premium media subscriptions into your self-hosted library.`

### **3. Detailed Description**
```markdown
### Unify Your Premium Media Subscriptions
Voyarr is a powerful, self-hosted media aggregator that unifies your disparate content libraries. It serves as your ultimate private media player, allowing you to seamlessly sync, organize, and stream all of your premium subscription services from one centralized, private platform.

### The Voyarr Lens Extension
Voyarr Lens is the official companion extension designed to help you easily build integration "recipes" for your Voyarr server. Instead of manually inspecting source code to figure out how to extract metadata from a website, Voyarr Lens provides a visual, point-and-click interface to map out metadata fields directly on the page.

Simply browse to one of your premium subscription sites, activate Map Mode, and click on the elements you want Voyarr to capture (like Titles, Performers, Tags, or Video Sources). The extension instantly calculates the exact CSS selector and securely transmits it to your self-hosted backend.

### Key Features
* 🎯 **Point-and-Click Mapping:** Visually click any element on a webpage to instantly generate a mathematically exact, deep-DOM CSS selector.
* ✅ **Match Validation & Testing:** Ensure your selectors are perfect. The extension displays the exact number of matching elements on the page and lets you flash them in bright green to verify your targeting.
* ✏️ **Editable Selectors:** Prefer writing your own CSS? Manually tweak and test your selectors directly within the popup before saving.
* ⚡ **Power-User Shortcuts:** Instantly launch into Map Mode on any website using the `Ctrl+Shift+M` (`Cmd+Shift+M` on Mac) global keyboard shortcut or via the right-click context menu.
* 🛡️ **Privacy First & Least Privilege:** Voyarr Lens respects your privacy. It requires zero global tracking permissions. It only requests connection access to the specific self-hosted Voyarr server URL you provide, and scripts are strictly injected on-demand.

### Requirements
This extension requires a running, self-hosted instance of the Voyarr backend server to function.
```

---

## **🔑 Permissions & Host Justifications**

The Chrome Web Store review team requires explicit, plain-English justifications for all permissions declared in the extension manifest.

| Permission | Declaration | Plain-English Justification for Reviewers |
| :--- | :--- | :--- |
| **`activeTab`** | `"activeTab"` | Grants temporary access to the active tab to execute visual crosshair highlight selection. |
| **`storage`** | `"storage"` | Safely stores your Voyarr Server URL, API Master Keys, and pending selector states locally on the machine. |
| **`scripting`** | `"scripting"` | Injects the map mode content script (`content.js`) onto the active webpage when visual selection is toggled. |
| **`contextMenus`** | `"contextMenus"` | Registers the "Start Voyarr Map Mode" context menu option to trigger mapping directly from any right-click. |
| **`tabs`** | `"tabs"` | Reads the active tab URL to resolve the site hostname, which is required to map selectors to the correct provider. |

---

## **🔒 Privacy & Data Use Disclosures**

* **Data Collection**: This extension **does not** collect, track, or transmit any user data to external third-party servers.
* **Server Communication**: All data exchanges (such as saving site selectors) are transmitted **strictly and directly** to your own self-hosted Voyarr server instance configured in your local settings.
* **Storage Encryption**: Configured server secrets and master keys are stored securely inside the browser's isolated local extension storage.

---

## **📈 Version History**

### **v1.16.5** (Current Release)
* **UI & Defaults**: Updated Stash synchronization integration to use Stash's official logo next to the app name and default Stash connection port to port 9999.

### **v1.16.4**
* **Bug Fix**: Fixed a critical frontend build error by resolving the non-existent `@mui/icons-material/HelpOutline` import to `@mui/icons-material/HelpOutlineOutlined` in `App.jsx`.

### **v1.16.3**
* **Maintenance**: Resolved all Pylance type diagnostics and type checker warnings across the backend.

### **v1.16.2**
* **Bug Fixes**: Minor UI corrections and stability improvements.

### **v1.16.1**
* **Security Update**: Removed the legacy `bcrypt` dependency and migrated to `argon2-cffi` for enhanced password hashing.

### **v1.15.0**
* **Unified Brand Styling**: Restructured the popup user interface with premium glassmorphism, clean grid elements, and integrated the modern Google Font **Outfit** to match the core Voyarr server branding.
* **Dynamic Versioning**: Added an auto-populating version badge chip directly adjacent to the main "VOYARR LENS" title, reading version metadata dynamically from the extension's runtime manifest.
* **Multi-Server & Probing**: Expanded settings to support active multi-server environments with backward-compatible migration, instant server switching, and a visual network card list.
* **Least Privilege Scoping**: Refactored host permission declarations to target standard private subnets, eliminating scary wildcard warnings while allowing full local network subnet scanning and zero-touch API health discovery.

### **v1.14.1** & v1.14.0
* Incorporated security improvements and direct network subnet scanning features.

### **v1.13.0**
* Refactored service workers (`background.js`) and popup interfaces (`popup.js`) to use modern ES6 `async/await` syntax.
* Added the required `tabs` permission to resolve domain hostnames, correcting a silent lookup failure.
* Programmatically resized high-quality PNG icons for 16x16, 48x48, and 128x128 pixel dimensions to comply with Manifest V3.
* Added direct `provider_id` selection mapping from the popup target dropdown to bridge communications with the main app.
