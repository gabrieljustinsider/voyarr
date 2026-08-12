# Workspace Agent Rules

- **Automatic Version Bumping**: The git pre-commit hook (`scripts/prepare-commit.cjs`) automatically handles version bumping for staged commits. If you manually bump `package.json` (patch for bug fixes/refactors, minor for new features) before staging and committing, the pre-commit hook preserves your manual version without double-bumping.
- **Commit Prefixes**: The commit message must always be prefixed with the newly bumped version from `package.json` in `[vX.Y.Z]` format.

# Fleet-wide Refactoring & Engineering Standards

- **Opportunistic Abstract Refactoring**: Whenever logic or code is being added or modified, if it can be abstractly refactored to increase code quality, DRY principles, and modularity without introducing sacrifices in performance, readability, or complexity, always opt for abstract refactoring.
- **No Forced Abstractions**: Never force abstract refactoring. If abstraction does not make logical sense, introduces unnecessary layers, complicates debugging, or risks stability in a specific code block, keep the implementation concrete.
- **Engineering Principles**: Always prioritize methods of coding that are highly efficient, secure, stable, and follow best-practices.
