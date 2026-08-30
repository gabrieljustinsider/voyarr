# Workspace Agent Rules

- **Automatic Version Bumping**: The git pre-commit hook (`scripts/prepare-commit.cjs`) automatically handles version bumping for staged commits. If you manually bump `package.json` (patch for bug fixes/refactors, minor for new features) before staging and committing, the pre-commit hook preserves your manual version without double-bumping.
- **Commit Prefixes**: The commit message must always be prefixed with the newly bumped version from `package.json` in `[vX.Y.Z]` format.

# Fleet-wide Refactoring & Engineering Standards

# Restricted Terminology & Vocabulary Governance (Fleet-Wide Law)

The following internal engineering, infrastructure, and technical terms MUST NEVER be exposed or rendered in user-facing UI screens, modal titles, button labels, descriptions, toast alerts, placeholders, error toasts, or client-side marketing copy. Always use user-centric, brand-aligned terminology instead:

- **'fleet' / 'fleet-wide'**: Use *'Network'*, *'Ecosystem'*, *'Apps'*, *'Services'*, *'Console'*, *'Workspace'*, *'Account'*, or the application's proper brand name.
- **'bots'** (when referring to applications or system services): Use *'Apps'*, *'Services'*, *'Tools'*, or *'Assistants'*.
- **'worker' / 'durable object' / 'do'** (in UI alerts or status badges): Use *'Service'*, *'Sync Engine'*, *'Background Task'*, or *'Processing Engine'*.
- **'neon' / 'postgres' / 'drizzle' / 'sql'** (in end-user notices): Use *'Database'*, *'Cloud Storage'*, or *'Secure Vault'*.
- **'hono' / 'router' / 'api route'**: Use *'Server'*, *'Cloud Service'*, or *'Endpoint'*.
- **'kv' / 'r2' / 'd1'** (in customer error states): Use *'Cloud Storage'*, *'Cache'*, or *'Asset Storage'*.
- **'raw stack traces' / 'unhandled exception errors'**: Must be caught by Error Boundaries and rendered as user-friendly incident reference cards.

- **Opportunistic Abstract Refactoring**: Whenever logic or code is being added or modified, if it can be abstractly refactored to increase code quality, DRY principles, and modularity without introducing sacrifices in performance, readability, or complexity, always opt for abstract refactoring.
- **No Forced Abstractions**: Never force abstract refactoring. If abstraction does not make logical sense, introduces unnecessary layers, complicates debugging, or risks stability in a specific code block, keep the implementation concrete.
- **Engineering Principles**: Always prioritize methods of coding that are highly efficient, secure, stable, and follow best-practices.
