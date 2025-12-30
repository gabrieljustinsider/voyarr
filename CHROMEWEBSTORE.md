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
Voyarr is a powerful, self-hosted media aggregator that unifies your disparate content libraries. It serves as your ultimate private media player, allowing you to seamlessly scrape, organize, and stream all of your premium subscription services from one centralized, private platform.

### The Voyarr Lens Extension
Voyarr Lens is the official companion extension designed to help you easily build integration "recipes" for your Voyarr server. Instead of manually inspecting source code to figure out how to scrape a website, Voyarr Lens provides a visual, point-and-click interface to map out metadata fields directly on the page.

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

## **🖼️ Promotional Store Screenshots**

To make submission as frictionless as possible, we have generated **official, high-quality, high-resolution (1280x800)** store screenshots formatted precisely to Chrome Web Store listing specifications.

You can find these images ready to be uploaded in your workspace:
1. **[Popup Interface Screenshot](screenshots/cws-screenshot-popup.png)**: Showcases the beautiful, modern, glassmorphic Voyarr Lens action popup centered on a blurred streaming library background.
2. **[Visual Map Mode Screenshot](screenshots/cws-screenshot-mapmode.png)**: Demonstrates the interactive visual dashed outline mapping elements in real-time on a target provider page.

---

## **📈 Version History**

### **v1.13.0** (Current Release)
* Refactored service workers (`background.js`) and popup interfaces (`popup.js`) to use modern ES6 `async/await` syntax.
* Added the required `tabs` permission to resolve domain hostnames, correcting a silent lookup failure.
* Programmatically resized high-quality PNG icons for 16x16, 48x48, and 128x128 pixel dimensions to comply with Manifest V3.
* Added direct `provider_id` selection mapping from the popup target dropdown to bridge communications with the main app.
