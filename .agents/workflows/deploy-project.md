---
description: Standardized zero-downtime Cloudflare deployment workflow
---

# Deploy Project Workflow

Follow this standard procedure to deploy any GameProductions bot or PWA to Cloudflare Workers / Pages.

## 1. Pre-Deployment Validation
1. **Clean Git Working Tree**: Verify all necessary changes are committed and pushed or staged.
2. **Build Validation**: Always run a clean local build first to catch bundling, typing, and chunking issues:
   ```bash
   npm run build
   ```
3. **Verify Git Hygiene**: Ensure build output directories (`build/`, `dist/`, `.wrangler/`) are NOT tracked in git:
   ```bash
   git status -s
   ```

## 2. Configuration & Version Check
- Verify `package.json` version is up to date (auto-bumped or manually incremented).
- Check `wrangler.jsonc` bindings (`DB`, `FLEET_SECURITY_CACHE`, `STORAGE`, `routes`, `observability`).

## 3. Deployment Execution
Run the project's standardized deploy script:
```bash
npm run deploy
# Which executes: npm run build && wrangler deploy
```

## 4. Post-Deployment Verification
1. **Health Probe**: Curl the project's public health endpoint:
   ```bash
   curl -s "https://<project-domain>/api/health"
   ```
   Confirm `status` is `"online"` and `versions.production` reflects the new deployment version.
2. **Foundation Pulse Check**: Open Foundation App Directory (`https://foundation.gpnet.dev/directory`) or trigger `/admin/pulse` to ensure the new version badge turns green and reports healthy telemetry.
