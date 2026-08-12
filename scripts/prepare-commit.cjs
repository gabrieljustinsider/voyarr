const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const mode = process.argv[2]; // 'pre-commit', or the commit message file path

if (mode === 'pre-commit') {
  // --- PRE-COMMIT HOOK ---
  // Responsible for version bumping, syncing documentation files, and staging them.
  try {
    const diff = execSync('git diff --cached', { maxBuffer: 10 * 1024 * 1024 }).toString();
    const status = execSync('git status --porcelain', { maxBuffer: 10 * 1024 * 1024 }).toString();

    const lines = status.split('\n').map(l => l.trim()).filter(Boolean);
    const onlyPkg = lines.length === 1 && lines[0].includes('package.json');

    if (onlyPkg || !diff.trim()) {
      process.exit(0);
    }

    const pkgPath = path.join(__dirname, '../package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const currentVersion = pkg.version;

    // 1. Prevent double-bumping: If package.json version was ALREADY manually or explicitly bumped relative to HEAD, preserve it
    let pkgAlreadyBumped = false;
    try {
      const headPkgJson = execSync('git show HEAD:package.json', { maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] }).toString();
      const headPkg = JSON.parse(headPkgJson);
      if (headPkg.version !== currentVersion) {
        pkgAlreadyBumped = true;
      }
    } catch (e) {
      // Ignore if HEAD:package.json is missing or unparseable
    }

    if (pkgAlreadyBumped) {
      console.log(`[Auto-Bump/Sync] package.json version (${currentVersion}) already manually bumped. Skipping additional version bump.`);
      process.exit(0);
    }

    const [major, minor, patch] = currentVersion.split('.').map(Number);

    // Exclude migrations, scripts, tests, and documentation from triggering a minor bump
    const nonFeatureFilePatterns = [
      /^db\/migrations\//,
      /^db\/scripts\//,
      /^scripts\//,
      /\.sql$/,
      /\.md$/,
      /\.test\.[jt]sx?$/,
      /\.spec\.[jt]sx?$/
    ];

    const newFiles = lines
      .filter(line => line.startsWith('A'))
      .map(line => line.replace(/^A\s+/, '').trim());

    const hasNewFeatureFiles = newFiles.some(file =>
      !nonFeatureFilePatterns.some(pattern => pattern.test(file))
    );

    const addedLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++'));
    const hasFeatureKeywords = /\b(feat|feature)\b/i.test(addedLines.join('\n'));
    const isMinor = hasNewFeatureFiles || hasFeatureKeywords;

    let newVersion;
    if (isMinor) {
      newVersion = `${major}.${minor + 1}.0`;
    } else {
      newVersion = `${major}.${minor}.${patch + 1}`;
    }

    console.log(`[Auto-Bump/Sync] Staged changes detected. Bumping version: ${currentVersion} -> ${newVersion} (${isMinor ? 'minor' : 'patch'})`);

    // Update package.json
    pkg.version = newVersion;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    execSync('git add package.json');

    // 4. Dynamically sync all other references in markdown documentation files in root
    const rootDir = path.join(__dirname, '..');
    const filesInRoot = fs.readdirSync(rootDir);
    const mdFiles = filesInRoot.filter(file => file.endsWith('.md'));

    mdFiles.forEach(file => {
      const filePath = path.join(rootDir, file);
      if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        const versionRegex = new RegExp(`v?${escapeRegExp(currentVersion)}`, 'g');
        let updated = false;

        if (versionRegex.test(content)) {
          content = content.replace(versionRegex, (match) => match.startsWith('v') ? `v${newVersion}` : newVersion);
          updated = true;
        }

        const fallbackRegex = /v[0-9]+\.[0-9]+\.[0-9]+/g;
        if (fallbackRegex.test(content)) {
          content = content.replace(fallbackRegex, (match) => {
            if (match !== `v${newVersion}`) {
              updated = true;
              return `v${newVersion}`;
            }
            return match;
          });
        }

        if (updated) {
          fs.writeFileSync(filePath, content, 'utf8');
          execSync(`git add "${filePath}"`);
          console.log(`[Auto-Bump/Sync] Synced version to ${file}`);
        }
      }
    });

  } catch (err) {
    console.error('[Auto-Bump/Sync] Pre-commit hook failed:', err);
    process.exit(1);
  }
} else {
  // --- PREPARE-COMMIT-MSG HOOK ---
  // Responsible for prefixing the commit message.
  const commitMsgFile = process.argv[2];
  const commitSource = process.argv[3];

  if (commitSource && commitSource !== 'message') {
    process.exit(0);
  }

  try {
    if (commitMsgFile) {
      const pkgPath = path.join(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const activeVersion = pkg.version;

      const prefix = `[v${activeVersion}]`;
      const currentMsg = fs.readFileSync(commitMsgFile, 'utf8');

      if (!/^\[v[0-9]+\.[0-9]+\.[0-9]+\]/.test(currentMsg)) {
        fs.writeFileSync(commitMsgFile, `${prefix} ${currentMsg}`);
      }
    }
  } catch (err) {
    console.error('[Auto-Bump/Sync] Prepare-commit-msg hook failed:', err);
    process.exit(1);
  }
}
