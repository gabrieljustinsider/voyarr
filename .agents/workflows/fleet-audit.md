---
description: Comprehensive security, versioning, and compliance audit across all fleet projects
---

# Fleet Audit Workflow

Follow these steps when running an organization-wide audit across the 8 GameProductions fleet repositories (`foundation`, `food`, `globot`, `groupcord`, `i-am`, `ledger`, `lets-draw-down`, `voyarr`).

## 1. Versioning & Telemetry Parity
For every repository:
- **`APP_VERSION`**: Confirm `packages/shared/constants.ts` (or `@shared/constants`) imports `pkg.version` and exports `APP_VERSION`. Ensure `FLEET_VERSION` alias is not used.
- **`/api/health` Contract**: Verify the project exposes a public, unauthenticated `GET /api/health` returning:
  ```json
  {
    "status": "online" | "maintenance" | "degraded",
    "maintenance": boolean,
    "database": "connected" | "disconnected" | "error",
    "service": "<project-id>",
    "environment": "production" | "development",
    "versions": {
      "production": "X.Y.Z",
      "development": "X.Y.Z-dev"
    },
    "timestamp": 1723900000000
  }
  ```

## 2. Maintenance Mode & Shared KV
- Confirm `wrangler.jsonc` binds the shared `FLEET_SECURITY_CACHE` KV namespace:
  ```jsonc
  {
    "binding": "FLEET_SECURITY_CACHE",
    "id": "3b5176621a954976ba0b6d78a2c9af08"
  }
  ```
- Verify the edge worker middleware checks `global:maintenance` and `project:maintenance:<projectId>`.
- Verify the project has a dedicated, themed `MaintenanceView.tsx` component displaying its official acronym-cased display name (`I AM`, `LEDGER`, `LETS Draw-Down`, `FOOD`).

## 3. Security & Walled Garden
- **SSO Routing**: Confirm OAuth redirects bounce through `https://sso.gpnet.dev/api/proxy/callback/:provider`.
- **Passkeys (WebAuthn)**: Verify biometric step-up is present on administrative routes (`/admin/*`) backed by `VaultService`.
- **Exclusion Whitelist**: Ensure `/discord` and `/interactions` webhooks are excluded from blocking Bearer token middlewares.

## 4. Git & Build Hygiene
- Check `.gitignore` to ensure `build/`, `dist/`, `.wrangler/`, and `.dev.vars` are never tracked in Git.
- Confirm `package.json` contains a `deploy` script executing `npm run build && wrangler deploy`.
- Audit open GitHub issues across all repos.
