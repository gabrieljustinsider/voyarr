---
description: Github commit rules
---

Always follow this structure when generating commit messages:

1. **Prefix**: Start with the current version from `package.json` in `[vx.y.z]` format.
2. **Title**: A concise, one-line summary of the primary change.
3. **Details**: A bulleted list of all significant changes, ordered by importance.
4. **Context**: Mention any specific components or modules modified.

Example:
`[v3.9.0] Feature: Scheduled Post Sharing & Stability Fixes`

`- Added share/RCS buttons to scheduled posts in PostList.tsx`
`- Implemented defensive null-checks for all .slice() operations`
`- Patched grammar suggestion crash in CreatePost.tsx`