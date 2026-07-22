# Chrome Web Store Listing — Voyarr Lens

> Last Updated: 2026-07-22

## Store Listing

**Extension Name**: Voyarr Lens

**Short Description**: Companion browser extension for Voyarr media automation, live stream extraction, and visual element selector mapping.

**Detailed Description**:
Voyarr Lens is the official browser companion extension for your Voyarr Media Server. It enables seamless media discovery, live stream extraction, and visual scraper recipe building directly from any website.

Key Features:
- Direct Stream Extraction: Extract and stream live webcams, video feeds, and content directly into your Voyarr media server.
- Visual Map Mode: Interactively map CSS selectors and scraper rules for unsupported video platforms without writing code.
- Multi-Provider Support: Configure default payment gateways (CCBill, Epoch, Verotel, etc.) and auto-fill provider credentials.
- Instant Authentication: Pair seamlessly with your Voyarr server via one-click pairing or API key token.

How to Use:
1. Open the Voyarr Lens popup and connect your Voyarr server URL and API key.
2. Navigate to any video or live stream page.
3. Click "Extract Live Stream" or activate "Voyarr Map Mode" (Ctrl+Shift+M) to map element selectors.
4. Send streams and content directly to your Voyarr library and download queues.

Privacy & Security:
Voyarr Lens only communicates with your self-hosted or designated Voyarr media server instance. No user data, browser history, or telemetry is ever sold or collected by third parties.

**Category**: Developer Tools / Search Tools

**Single Purpose**: Connects browser content, live stream URLs, and CSS selectors directly to a Voyarr media server instance.

**Primary Language**: English

---

## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon | 128×128 PNG | ✅ Ready | `extension/icon-128.png` |
| Small Icon | 48×48 PNG | ✅ Ready | `extension/icon-48.png` |
| Mini Icon | 16×16 PNG | ✅ Ready | `extension/icon-16.png` |
| Package ZIP | Compressed ZIP | ✅ Ready | `voyarr-extension.zip` |

---

## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Required to inspect active tab DOM elements when the user triggers Map Mode or auto-detects site details. |
| `storage` | permissions | Required to persist the user's Voyarr server URL, API key, and pending pairing tokens locally in Chrome storage. |
| `scripting` | permissions | Required to inject the visual element highlight overlay (`content.js`) when Map Mode is activated. |
| `contextMenus` | permissions | Required to add "Start Voyarr Map Mode" and "Extract Live Stream" options to the browser context menu. |
| `tabs` | permissions | Required to detect tab URL and page titles for stream extraction and automatic provider branding lookups. |
| `http://*/*`, `https://*/*` | host_permissions | Required to send authenticated API requests to self-hosted or custom Voyarr backend server endpoints. |

---

## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** No (Data remains strictly local or sent to user's self-hosted Voyarr server).

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | N/A | No |
| Health / Financial info | No | No | N/A | No |
| Authentication info | Yes | Only to user's Voyarr server | Local storage & server API auth | No |
| Web history / Activity | No | No | N/A | No |
| Website content | Yes | Only when requested by user | Sending selected media URL / CSS selectors | No |

### Data Use Certification
- [x] Data is NOT sold to third parties.
- [x] Data is NOT used for purposes unrelated to the extension's core functionality.
- [x] Data is NOT used for creditworthiness or lending purposes.

---

## Step-by-Step Instructions to Deploy / Upload to Chrome Web Store

1. **Access Developer Console**:
   - Go to [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole/).
   - Sign in with your Google account (a one-time $5 developer registration fee applies if not registered).

2. **Upload Package**:
   - Click **"New Item"** (top right).
   - Drag and drop or upload `voyarr-extension.zip` from your project root:
     `file:///Users/morenicano/coding/projects/bots/voyarr/voyarr-extension.zip`

3. **Fill Store Listing Details**:
   - Copy-paste the **Title**, **Short Description**, and **Detailed Description** from above.
   - Category: **Developer Tools**.
   - Language: **English**.

4. **Upload Store Icons & Screenshots**:
   - Store Icon: Upload `extension/icon-128.png`.
   - Screenshots: Take 1-2 screenshots of the Voyarr Lens popup window (1280×800 or 640×400) and upload.

5. **Complete Privacy Tab**:
   - Single Purpose: *"Connects browser content, live stream URLs, and CSS selectors directly to a Voyarr media server instance."*
   - Copy justifications from the **Permissions Justification** table above into each corresponding justification box.
   - Check all three Data Use Certification checkboxes.

6. **Submit for Review**:
   - Click **"Submit for Review"**.
   - Chrome Web Store reviews typically take 24–48 hours for new versions or initial submissions.

---

## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| `v1.68.2` | 2026-07-22 | Initial Chrome Web Store package build with default payment biller dropdown, live stream extraction support, and host permissions. | Ready to Submit |
