# Voyarr Lens - Chrome Web Store Release Notes

## Version 1.198.1

### 🎉 New Features

**Export & Import Complete Setup (Settings Tab → Server Profiles Backup)**
- **Export Configuration** — One-click backup of your entire Voyarr Lens setup:
  - All configured servers (names, URLs, API keys optional for privacy)
  - Custom scraper providers (naming patterns, logos, billers)
  - Selector recipes from Map Mode (CSS, XPath, Regex mappings)
  - Choose what to include with simple checkboxes
- **Import Configuration** — Restore or migrate seamlessly:
  - Merge with existing servers or replace entirely
  - Push providers & recipes directly to your Voyarr server
  - Validates backup files before importing
  - Works with older backups too

**Perfect for:**
- Switching between NAS, VPS, local dev, and staging environments
- Sharing provider configs with your team
- Backing up before browser/profile changes
- Moving between Chrome profiles

---

**Proactive Discovery & Auto-Pairing**
- Voyarr Lens now **automatically detects** Voyarr servers in your open tabs
- **Auto-initiates pairing** — no manual setup needed for new servers
- A badge notification appears when pairing is available
- Works on startup and when navigating to new tabs

**Live Connectivity Badge (Extension Toolbar Icon)**
- See connection status at a glance:
  - 🟢 **ON** (green) — Connected & healthy
  - 🔴 **OFF** (red) — Disconnected or unreachable
  - ⚫ **OFF** (gray) — Not configured yet
- Checks every 30 seconds in the background
- Smart enough to not interfere with auto-pairing notifications

---

### 🔧 Improvements

**Smarter Network Scanning**
- **Multi-port scanning** — Enter comma-separated ports: `8000,8008,8080`
- **Scan All Open Tabs** button — Finds Voyarr servers across all tabs instantly
- Better subnet detection (uses your active tab's network)
- More reliable health checks with multiple fallback endpoints

**Security & Permissions**
- Extension now asks for host permission before connecting to servers
- Better handling of local/self-signed HTTPS certificates
- Built-in SSL troubleshooting guide in Settings

---

### 🌐 Web Dashboard Improvements

**Bulk Recipe Management (Provider List Page)**
- **Export All Recipes** — Download all selector mappings as JSON
- **Import Recipes** — Bulk restore mappings across multiple providers
- Shows recipe count on the export button

**Per-Provider Recipe Import/Export (Recipe Editor)**
- **Export** — Save one provider's selectors (CSS/XPath/Regex/Map Mode)
- **Import** — Restore mappings for a single provider
- **Copy JSON** — Quick copy to clipboard
- Files named with provider name + date

---

### 🐛 Bug Fixes

- Fixed Map Mode saving (corrected API endpoint)
- Fixed Live Stream extraction (corrected API endpoints)
- Fixed background script loading on browser startup
- Fixed pairing invitation hiding the server URL (banner now shows the discovered server address)
- Scan port field now accepts comma-separated values
- Clearer error messages and toast notifications
- Help tab now explains auto-pairing

---

---

## Chrome Web Store Submission Checklist

### Required Fields
- [ ] **Extension Name**: Voyarr Lens
- [ ] **Short Description** (132 chars max): Visual selector mapping & server management for Voyarr media server
- [ ] **Detailed Description**: [See below]
- [ ] **Category**: Developer Tools
- [ ] **Language**: English
- [ ] **Version**: 1.198.1
- [ ] **Release Notes**: [Use the notes above]

### Assets Needed
- [x] **Icon** (128×128 PNG): `extension/icon-128.png`
- [x] **Screenshots** (1280×800 PNG, no alpha, full bleed — up to 5):
  - `store-assets/screenshot-1.png` — Auto pairing banner ("Pair your server in one tap")
  - `store-assets/screenshot-2.png` — Remote Map provider search ("Map page elements visually")
  - `store-assets/screenshot-3.png` — Export/Import options ("Back it all up as JSON")
  - `store-assets/screenshot-4.png` — Providers tab & creator ("Your scraper library, organized")
  - `store-assets/screenshot-5.png` — Lens tab ("Read the page for you")
- [x] **Small Promo Tile** (440×280 PNG): `store-assets/promo-tile-440x280.png`
- [x] **Marquee** (1400×560 PNG, optional for featuring): `store-assets/promo-marquee-1400x560.png`

All assets are composed from real extension captures in `store-assets/raw/` (Chrome Web Store
DPR-2 popups) on the brand background (`#0b0f19` + `#6366f1→#a855f7` glows, Outfit font).
Regenerate with `store-assets/compose.html` served from the repo root (needs a static server)
plus Chrome DevTools viewport emulation at 1280×800 / 440×280 / 1400×560, DPR 1.

### Detailed Description (for store listing)

```
Voyarr Lens is the official browser companion for Voyarr — the self-hosted media intelligence platform.

🔍 MAP MODE — Visual Selector Mapping
Click any element on a page to generate precise CSS/XPath selectors. Save mappings directly to Voyarr for automated metadata scraping. Test selectors in real-time with match counts.

🎯 LENS — Subscription & Stream Intelligence
• Scan any page for subscription/billing details (cost, cycle, trial status)
• Extract live stream URLs via yt-dlp integration
• Save streams and subscriptions to Voyarr with one click

⚙️ PROVIDER MANAGEMENT
Create, edit, and organize custom scraper providers. Configure naming patterns with variables ({title}, {performers}, {tags}, {resolution}, {studio}, {date}, {timestamp}). Upload logos, set default billers, and preview branding.

🖥️ MULTI-SERVER SUPPORT
Manage multiple Voyarr environments (NAS, VPS, Local Dev, Staging) with one extension. Switch instantly via dropdown. Auto-discovers servers in open tabs and initiates pairing automatically.

📦 EXPORT & IMPORT (NEW in 1.198)
Back up your entire setup — servers, providers, and selector recipes — to a JSON file. Restore on any browser or share with your team. Choose to include/exclude API keys for privacy.

🔒 PRIVACY FIRST
• Runs entirely in your browser — no external services
• API keys stored locally in Chrome's encrypted storage
• Optional: export without sensitive credentials
• Host permission requested per-server

🎨 BUILT FOR POWER USERS
Dark theme, responsive UI, keyboard shortcuts (Ctrl+Shift+M for Map Mode), context menu integration, and real-time connection status badge on the toolbar icon.

Requires: A running Voyarr server (self-hosted). Get started at https://github.com/gabrieljustinsider/voyarr
```

### Privacy Policy URL
- https://github.com/gabrieljustinsider/voyarr/blob/73d6538d15f467745415acc40937b5304ef68ca6/PRIVACY_POLICY.md

### Support/Contact
- GitHub Issues: https://github.com/gabrieljustinsider/voyarr/issues
- Email: voyarrlensdev@gabrieljustinsider.com

### Permissions Justification (for review)
| Permission | Reason |
|------------|--------|
| `activeTab` | Map Mode element selection, page scanning |
| `scripting` | Inject content script for visual mapping |
| `storage` | Save server configs, API keys, preferences |
| `host_permissions` | Connect to user-configured Voyarr servers (requested dynamically) |
| `tabs` | Proactive discovery across open tabs |
| `contextMenus` | Right-click "Start Map Mode" / "Extract Stream" |
| `commands` | Keyboard shortcut for Map Mode |
| `notifications` | **Show system notification when a Voyarr server is auto-discovered** — displays "Pair Now"/"Dismiss" buttons for one-click pairing without opening the extension popup. Used in proactive discovery to alert users when a new server is found in any open tab. |

---

## Quick Copy-Paste for "Release Notes" Field (Plain Text)

```
Version 1.198.1

🎉 NEW: Export & Import Complete Setup
• One-click backup of servers, providers & selector recipes (Settings tab)
• Choose to include/exclude API keys for privacy
• Merge or replace on import; push providers/recipes to server
• Works with older backups

🚀 Proactive Discovery & Auto-Pairing
• Automatically detects Voyarr servers in open tabs
• Auto-initiates pairing — no manual setup needed
• Badge notification when pairing available

🔴 Live Connectivity Badge
• Toolbar icon shows ON/OFF status in real-time
• Checks every 30 seconds in background

🔧 Smarter Network Scanning
• Multi-port scanning (8000,8008,8080)
• "Scan All Open Tabs" button
• Better subnet detection & health checks

🌐 Web Dashboard: Bulk & Per-Provider Recipe Import/Export
• Provider List: Export/Import all recipes
• Recipe Editor: Export/Import single provider mappings

🐛 Fixes: Map Mode API, Stream extraction, background loading, pairing banner URL, scan ports, error messages
```