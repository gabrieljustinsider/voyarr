---
description: Milestone database migration squashing and baseline generation (Rule 21)
---

# Squash Migrations Workflow (Rule 21)

Use this workflow to periodically consolidate individual Drizzle ORM migrations into a single, clean baseline schema for Neon Postgres.

## 1. Preservation & Archive
1. Create a timestamped archive directory under `archive/migrations/`:
   ```bash
   mkdir -p archive/migrations/history_$(date +%Y%m%d_%H%M%S)
   ```
2. Move all existing migration `.sql` files into the archive folder:
   ```bash
   mv db/migrations/*.sql archive/migrations/history_$(date +%Y%m%d_%H%M%S)/ 2>/dev/null || true
   ```
3. Remove the stale metadata cache:
   ```bash
   rm -rf db/migrations/meta
   ```

## 2. Baseline Schema Generation
Run `drizzle-kit generate` to construct a clean baseline from `db/schema.ts`:
```bash
npx drizzle-kit generate
```

## 3. Standard Baseline Naming
Rename the generated timestamped migration file to the canonical baseline name:
```bash
mv db/migrations/*_*.sql db/migrations/0000_initial_schema.sql
```

## 4. Verification & Testing
1. Test the migration against the target Neon database:
   ```bash
   npx drizzle-kit migrate
   # or
   npx drizzle-kit push
   ```
2. Verify database connectivity and schema integrity via `SELECT 1` or `/api/health`.
