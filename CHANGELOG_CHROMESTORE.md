# Voyarr Lens - Chrome Web Store Changelog

## Version 1.198.1 (Latest)

### 🎉 New: Export & Import Server Profiles + Selector Recipes
**Extension Settings Tab → Server Profiles Backup**

- **Export Configuration** - One-click backup of your entire Voyarr Lens setup:
  - Server connections (names, URLs, API keys optional)
  - Custom scraper providers (naming patterns, logos, billers)
  - Selector recipes (CSS/XPath/Regex mappings from Map Mode)
  - **Privacy-first**: Option to exclude API keys from export
  - Versioned JSON format (v2.0) with timestamp

- **Import Configuration** - Restore or migrate setups seamlessly:
  - Merge with existing servers or replace entirely
  - Restore providers & recipes directly to your Voyarr server
  - Schema validation prevents corrupt backups
  - Backward compatible with older backup formats (v1.0)

---

### 🔧 Perfect for:
- **Multi-environment workflows** (NAS, VPS, Local Dev, Staging)
- **Team collaboration** - Share provider configs across browsers
- **Backup & disaster recovery** - Never lose your selector mappings
- **Browser profile sync** - Move configs between Chrome profiles

---

### 🚀 Extension Improvements

#### Proactive Discovery & Auto-Pairing
- **Auto-discovers Voyarr servers** across all open tabs on startup/navigation
- **Initiates pairing automatically** - no manual setup needed for new servers
- **Badge notification** appears when pairing is available
- Respects existing pairing requests (doesn't overwrite)

#### Connectivity Status Badge (Extension Icon)
- **Live connection indicator** on extension toolbar icon:
  - 🟢 **ON** (green) - Connected & healthy
  - 🔴 **OFF** (red) - Disconnected/unreachable
  - ⚫ **OFF** (gray) - Not configured
- Checks every 30 seconds in background
- Smart enough to preserve pairing badge during auto-discovery

#### Enhanced Network Scanning
- **Multi-port scanning** - Comma-separated ports (e.g., `8000,8008,8080`)
- **Scan All Open Tabs** button - Proactively discovers Voyarr servers across all tabs
- Improved subnet detection based on active tab
- Better fallback health checks (`/health`, `/voyarr/health`)

#### Security & Permissions
- Host permission checks before all network requests
- Proper CORS handling for local/self-signed certificates
- SSL troubleshooting guide for local HTTPS servers

---

### 🌐 Web UI Improvements (Frontend)

#### Provider List - Bulk Recipe Export/Import
- **Export All Recipes** - Downloads all provider selector mappings as JSON
- **Import Recipes** - Bulk restore selector mappings across multiple providers
- Shows recipe count in export button
- File input with `.json` filter

#### Recipe Editor - Per-Provider Export/Import
- **Export** - Save individual provider's CSS/XPath/Regex/Map Mode data
- **Import** - Restore selector mappings for a single provider
- **Copy JSON** - Quick copy to clipboard
- Filenames include provider name and date

---

### ⚙️ Backend Changes

#### Security Hardening
- **Fixed CORS wildcard vulnerability** - Now defaults to empty origins list
- **API route prefix standardization** - All routes now under `/api/` prefix
- **JWT middleware updated** - Admin routes properly protected with new paths
- **SQL injection prevention** in backup/restore - Table names validated against SQLAlchemy metadata

#### Backup/Restore Reliability
- Improved PostgreSQL sequence reset logic
- Better error handling for missing tables
- Added security linting comments (nosec/nosemgrep)

#### Architecture
- Router inclusion refactored (routes now loaded dynamically)
- Consistent `/api/` prefix across all endpoints:
  - `/api/providers`, `/api/scraper`, `/api/download`, `/api/library`
  - `/api/settings`, `/api/backup`, `/api/auth`, `/api/webhooks`
  - etc.

---

### 🐛 Bug Fixes
- Fixed Map Mode API endpoint path (`/api/scraper/map-mode`)
- Fixed Live Stream extraction endpoints (`/api/download/extract-stream`, `/api/download/save-stream`)
- Fixed background script module imports
- Fixed scan port input (text with comma-separated values)
- Fixed pairing invitation hiding the server URL (banner now shows the discovered server address)
- Improved error messages and toast notifications

---

### 📝 Updated Documentation
- Help tab now includes auto-pairing instructions
- Better tooltips and placeholder text
- Updated version badge from manifest

---

## Version 1.15.x (Previous)
- Proactive server discovery across open tabs
- Auto-pairing with Voyarr servers
- Custom provider management (create/edit/delete)
- Provider logo preview & favicon fallback
- Subscription scanning (Lens tab)
- Live stream extraction via yt-dlp
- Selector mapping via visual Map Mode
- Naming pattern variables for file organization