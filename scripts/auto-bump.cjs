#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

try {
  // 1. Get staged changes
  const diff = execSync('git diff --cached').toString();
  const status = execSync('git status --porcelain').toString();

  // If package.json is the only modified thing, do not recursive-bump
  const lines = status.split('\n').map(l => l.trim()).filter(Boolean);
  const onlyPkg = lines.length === 1 && lines[0].includes('package.json');

  if (onlyPkg || !diff.trim()) {
    process.exit(0);
  }

  // 2. Read package.json
  const pkgPath = path.join(__dirname, '../package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version;
  const [major, minor, patch] = currentVersion.split('.').map(Number);

  // 3. Determine if minor or patch based on staged status and diff contents
  const hasAddedFiles = lines.some(line => line.startsWith('A') || line.startsWith('M  frontend/src/'));
  const hasFeatureKeywords = /feat|feature|add\s|new\s|scheduler/i.test(diff);
  const isMinor = hasAddedFiles || hasFeatureKeywords;

  let newVersion;
  if (isMinor) {
    newVersion = `${major}.${minor + 1}.0`;
  } else {
    newVersion = `${major}.${minor}.${patch + 1}`;
  }

  console.log(`[Auto-Bump] Staged changes detected. Bumping version: ${currentVersion} -> ${newVersion} (${isMinor ? 'minor' : 'patch'})`);

  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  // 4. Re-stage package.json
  execSync('git add package.json');
} catch (err) {
  console.error('[Auto-Bump] Failed to automatically bump version:', err);
  process.exit(1);
}
