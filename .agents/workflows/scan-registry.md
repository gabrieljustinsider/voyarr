---
description: Index and synchronize reusable UI components across the fleet
---

# Scan Registry Workflow

Follow this procedure to rescan and index all frontend UI components across the 8 fleet repositories into Foundation's Component Registry catalog.

## 1. Execute Component Scanner
Run the indexing script from the foundation root directory:
```bash
npx tsx scripts/scan-components.ts
```

For incremental single-project updates:
```bash
npx tsx scripts/scan-components.ts --project <projectId>
```

## 2. Output Verification
Confirm the output file was successfully generated with valid JSON structure:
- Check `public/components-registry.json`.
- Verify total indexed component count and ensure no parsing errors occurred.

## 3. UI Validation
1. Start the Foundation web dashboard or navigate to `/admin/registry`.
2. Verify that categorized components (Forms, Feedback, Security, Layout, etc.) and search filtering render accurately.
