# **Voyarr Remote Companion — Chrome Web Store Listing**

This document serves as the single source of truth for the **Voyarr Remote** companion Chrome extension store listing, containing all descriptive copy, assets mappings, plain-English permissions justifications, and privacy disclosures.

---

## **📝 Store Listing Copy**

### **1. Extension Title**
`Voyarr Remote`

### **2. Short Description (max 150 chars)**
`Voyarr companion extension for visual CSS mapping and remote control.`

### **3. Detailed Description**
```markdown
Empower your self-hosted media management with Voyarr Remote!

Voyarr Remote is the official companion extension for the Voyarr ecosystem. It allows administrators to visually build, edit, and audit CSS scraping recipes for their media providers directly on any target page.

Key Features:
🎯 Visual Map Mode: Click any element (title, performer, tags, or resolution) on a website to automatically extract its CSS selector path.
🔍 Selector Diagnostics: Instantly test and evaluate the selector unique match count inside the browser page before committing.
⚡ Turnkey Synchronization: One-click saving push that securely transmits new site selectors back to your Voyarr server.
🔐 Secure Authorization: Fully hardens all outbound payload mappings using your master Voyarr Server API keys.

Deploy a streamlined visual scraping recipe tool for your home library server in seconds.
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
1. **[Popup Interface Screenshot](screenshots/cws-screenshot-popup.png)**: Showcases the beautiful, modern, glassmorphic Voyarr Remote action popup centered on a blurred streaming library background.
2. **[Visual Map Mode Screenshot](screenshots/cws-screenshot-mapmode.png)**: Demonstrates the interactive visual dashed outline mapping elements in real-time on a target provider page.

---

## **📈 Version History**

### **v1.13.0** (Current Release)
* Refactored service workers (`background.js`) and popup interfaces (`popup.js`) to use modern ES6 `async/await` syntax.
* Added the required `tabs` permission to resolve domain hostnames, correcting a silent lookup failure.
* Programmatically resized high-quality PNG icons for 16x16, 48x48, and 128x128 pixel dimensions to comply with Manifest V3.
* Added direct `provider_id` selection mapping from the popup target dropdown to bridge communications with the main app.
