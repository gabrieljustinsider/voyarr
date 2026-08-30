import fs from 'fs';
import path from 'path';

interface Project {
  id: string;
  name: string;
  local: string;
  symbol: string;
  icon: string;
  description: string;
}

interface ComponentInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  subcategory: string;
  project: string;
  projectSymbol: string;
  projectIcon: string;
  path: string;
  relativePath: string;
  externalDeps: string[];
  internalDeps: string[];
  code: string;
}

// ---------------------------------------------------------------------------
// Category inference — ordered from most-specific to least-specific.
// Each rule maps a set of path-segment / filename patterns to a
// { category, subcategory } pair. The first match wins.
// ---------------------------------------------------------------------------
interface CategoryRule {
  /** path segment patterns (case-insensitive) that must appear in the relative path */
  pathPatterns?: string[];
  /** filename patterns (case-insensitive) matched against the basename without ext */
  namePatterns?: string[];
  category: string;
  subcategory: string;
}

const CATEGORY_RULES: CategoryRule[] = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  { pathPatterns: ['auth'],                                                             category: 'Auth',        subcategory: 'Authentication' },
  { namePatterns: ['login', 'signup', 'register', 'forgotpassword', 'resetpassword',
                   'verifyemail', 'twofactor', 'otp', 'pinentry', 'authguard'],        category: 'Auth',        subcategory: 'Authentication' },

  // ── Admin ─────────────────────────────────────────────────────────────────
  { pathPatterns: ['admin'],                                                            category: 'Admin',       subcategory: 'Administration' },
  { namePatterns: ['dashboard', 'usertable', 'adminnav', 'adminlayout',
                   'adminheader', 'adminpanel', 'scanpanel'],                          category: 'Admin',       subcategory: 'Administration' },

  // ── Layout ────────────────────────────────────────────────────────────────
  { pathPatterns: ['layout'],                                                           category: 'Layout',      subcategory: 'Page Structure' },
  { namePatterns: ['header', 'footer', 'nav', 'sidebar', 'drawer', 'shell',
                   'wrapper', 'container', 'page', 'section', 'hero',
                   'glassheader', 'glassfooter', 'mobilenav', 'bottomnav',
                   'floatingheader', 'topbar', 'appbar'],                              category: 'Layout',      subcategory: 'Page Structure' },

  // ── Forms ─────────────────────────────────────────────────────────────────
  { pathPatterns: ['forms', 'form'],                                                   category: 'Forms',       subcategory: 'Form Controls' },
  { namePatterns: ['input', 'select', 'checkbox', 'radio', 'toggle', 'switch',
                   'datepicker', 'datetimeinput', 'timepicker', 'textarea',
                   'fieldset', 'formfield', 'currencyinput', 'searchableselect',
                   'typeableselect', 'multiselect', 'fileupload', 'dropzone',
                   'masked', 'slider', 'rangeslider', 'colorpicker'],                 category: 'Forms',       subcategory: 'Form Controls' },

  // ── Feedback / Notifications ──────────────────────────────────────────────
  { namePatterns: ['toast', 'inlinetoast', 'alert', 'banner', 'notification',
                   'snackbar', 'badge', 'chip', 'tag', 'pill', 'indicator',
                   'statusbadge', 'progressbar', 'spinner', 'skeleton',
                   'loading', 'loader', 'errorboundary', 'empty', 'emptystate'],      category: 'Feedback',    subcategory: 'Notifications & Status' },

  // ── Overlays ─────────────────────────────────────────────────────────────
  { namePatterns: ['modal', 'dialog', 'drawer', 'popover', 'tooltip',
                   'dropdown', 'contextmenu', 'sheet', 'panel', 'flyout'],            category: 'Overlays',    subcategory: 'Modals & Popups' },

  // ── Data Display ─────────────────────────────────────────────────────────
  { pathPatterns: ['charts', 'chart', 'graphs', 'viz'],                               category: 'Data Display', subcategory: 'Charts & Graphs' },
  { namePatterns: ['chart', 'graph', 'barchart', 'linechart', 'piechart',
                   'areachart', 'scatterplot', 'histogram', 'treemap',
                   'heatmap', 'sparkline'],                                            category: 'Data Display', subcategory: 'Charts & Graphs' },
  { namePatterns: ['table', 'datagrid', 'grid', 'list', 'listitem',
                   'datatable', 'row', 'cell', 'column', 'ledger', 'ledgerrow',
                   'expandablevalue',
                   'transactionledger', 'trackedexpenselist'],                         category: 'Data Display', subcategory: 'Tables & Lists' },
  { namePatterns: ['card', 'tile', 'summary', 'statcard', 'infocard',
                   'metriccard', 'featurecard'],                                       category: 'Data Display', subcategory: 'Cards & Tiles' },

  // ── Buttons & Actions ─────────────────────────────────────────────────────
  { namePatterns: ['button', 'btn', 'iconbutton', 'fab', 'actionbutton',
                   'submitbutton', 'link', 'anchor', 'cta'],                          category: 'Actions',     subcategory: 'Buttons & Controls' },

  // ── Navigation ────────────────────────────────────────────────────────────
  { namePatterns: ['breadcrumb', 'tabs', 'tabbar', 'stepper', 'pagination',
                   'accordion', 'collapsible', 'treeview', 'menu', 'menuitem',
                   'guildswitcher', 'householdswitcher', 'subnav',
                   'bottomtabbar', 'commandpalette'],                                 category: 'Navigation',  subcategory: 'Navigation Controls' },

  // ── Media ─────────────────────────────────────────────────────────────────
  { namePatterns: ['avatar', 'image', 'img', 'video', 'carousel', 'gallery',
                   'thumbnail', 'cover', 'icon', 'logo', 'qrcode', 'gifpicker',
                   'seasonalassets'],                                                  category: 'Media',       subcategory: 'Images & Media' },

  // ── Finance ───────────────────────────────────────────────────────────────
  { namePatterns: ['budget', 'budgetprogress', 'ledger', 'transactiontimeline',
                   'spendinghr', 'spendingheatmap', 'billslist', 'installmentslist',
                   'liabilitysplitter', 'sharedbalances', 'savingsbuckets',
                   'paycycletimeline', 'payschedule', 'paydayexception',
                   'subscriptions', 'futureflow', 'goalseek', 'whatifledger',
                   'importreview', 'price', 'animatedcounter',
                   'quickattentionadd'],                                              category: 'Finance',     subcategory: 'Financial Components' },

  // ── Calendar & Scheduling ─────────────────────────────────────────────────
  { namePatterns: ['calendar', 'calendarview', 'calendarentry', 'schedulingpicker',
                   'specialdate', 'remindermanager'],                                 category: 'Scheduling',  subcategory: 'Calendar & Time' },

  // ── Settings & Profile ────────────────────────────────────────────────────
  { namePatterns: ['settings', 'profile', 'usermenu', 'userprofile',
                   'accountsettings', 'accountmodule', 'privacysettings',
                   'privacypolicy', 'termsofservice', 'themeswitcher',
                   'developersettings', 'customizer', 'onboarding',
                   'onboardingchecklist', 'splashscreen', 'guidedtour',
                   'householdregistry'],                                               category: 'Settings',    subcategory: 'User & App Settings' },

  // ── Security & Identity ───────────────────────────────────────────────────
  { namePatterns: ['passkey', 'passkeymanager', 'passkeychallenge', 'passkeymodule',
                   'passwordchecklist', 'sessionmodule', 'securitydashboard',
                   'crossdevicerequests', 'focustrap', 'turnstile'],                 category: 'Security',    subcategory: 'Security & Identity' },

  // ── Social & Community ────────────────────────────────────────────────────
  { namePatterns: ['community', 'communitystats', 'postlist', 'createpost',
                   'sharedpostview', 'pendingpostslist', 'composersection',
                   'bulkmessenger', 'contactmanager', 'contactgroupmanager',
                   'invitemanager', 'presencemanager', 'discordpreview',
                   'livepulse', 'globalmoderationfeed', 'governancemanager',
                   'rafflecard', 'raffledetailmodal', 'riddlemanager',
                   'bibleverseselect', 'bibleverseselector'],                         category: 'Social',      subcategory: 'Community & Messaging' },

  // ── AI & Intelligence ─────────────────────────────────────────────────────
  { namePatterns: ['aicoach', 'smartinsights', 'cloudhub'],                          category: 'AI',          subcategory: 'AI Features' },

  // ── System & Utilities ────────────────────────────────────────────────────
  { namePatterns: ['auditlogtable', 'auditchronicle', 'archivalvault',
                   'logdetailsmodal', 'maintenanceview', 'supportportal',
                   'helpcenter', 'charactercounter'],                                 category: 'System',      subcategory: 'Audit & System Tools' },

  // ── Foundation (shared / cross-fleet infrastructure) ──────────────────────
  { pathPatterns: ['foundation/common', 'core/common', 'common'],                    category: 'Foundation',  subcategory: 'Common Infrastructure' },
  { pathPatterns: ['foundation/help', 'core/help'],                                  category: 'Foundation',  subcategory: 'Help & Documentation' },
  { pathPatterns: ['foundation', 'core'],                                             category: 'Foundation',  subcategory: 'Shared Foundation' },
];

/**
 * Infer a { category, subcategory } for a component given its file path
 * (relative to the project root) and basename without extension.
 */
function inferCategory(relativePath: string, nameWithoutExt: string): { category: string; subcategory: string } {
  const lowerPath = relativePath.toLowerCase().replace(/\\/g, '/');
  const lowerName = nameWithoutExt.toLowerCase();

  for (const rule of CATEGORY_RULES) {
    const pathMatch = rule.pathPatterns?.some(p => lowerPath.includes(p)) ?? true;
    const nameMatch = rule.namePatterns?.some(n => lowerName === n || lowerName.startsWith(n)) ?? true;

    // If both patterns provided, both must match; otherwise just one
    if (rule.pathPatterns && rule.namePatterns) {
      if (pathMatch && nameMatch) return { category: rule.category, subcategory: rule.subcategory };
    } else if (rule.pathPatterns) {
      if (pathMatch) return { category: rule.category, subcategory: rule.subcategory };
    } else if (rule.namePatterns) {
      if (nameMatch) return { category: rule.category, subcategory: rule.subcategory };
    }
  }

  // Fallback — use the immediate parent folder name, title-cased
  const segments = lowerPath.split('/').filter(Boolean);
  const parentDir = segments.length > 1 ? segments[segments.length - 2] : 'ui';
  const folderLabel = parentDir.charAt(0).toUpperCase() + parentDir.slice(1);
  return { category: folderLabel, subcategory: 'General' };
}

function parseComponent(filePath: string, fileContent: string, project: Project, absoluteProjectLocal: string): ComponentInfo {
  const nameWithoutExt = path.basename(filePath, path.extname(filePath));
  const relativePath = path.relative(absoluteProjectLocal, filePath);

  // Defaults derived from path inference
  let name = nameWithoutExt;
  let description = '';
  const inferred = inferCategory(relativePath, nameWithoutExt);
  let category = inferred.category;
  let subcategory = inferred.subcategory;
  let externalDeps: string[] = [];
  let internalDeps: string[] = [];

  // Override with JSDoc if present (author-provided metadata wins)
  const docMatch = fileContent.match(/\/\*\*([\s\S]*?)\*\//);
  if (docMatch) {
    const docText = docMatch[1];

    const nameMatch = docText.match(/@name\s+(.+)/);
    if (nameMatch) name = nameMatch[1].trim();

    const descMatch = docText.match(/@description\s+(.+)/);
    if (descMatch) description = descMatch[1].trim();

    const catMatch = docText.match(/@category\s+(.+)/);
    if (catMatch) category = catMatch[1].trim();

    const subCatMatch = docText.match(/@subcategory\s+(.+)/);
    if (subCatMatch) subcategory = subCatMatch[1].trim();
  }

  // Auto-generate rich description from leading comment block, docstrings, or code analysis
  if (!description) {
    // Try to grab leading multi-line or single-line comment
    const lineComment = fileContent.match(/\/\/\s*(.+)\n(?:export|const|function|interface|type)/);
    if (lineComment && lineComment[1].length > 10) {
      description = lineComment[1].trim();
    } else {
      // Generate intelligent contextual description based on component name, category, and dependencies
      const words = nameWithoutExt.replace(/([A-Z])/g, ' $1').trim();
      const lower = nameWithoutExt.toLowerCase();
      
      if (lower.includes('modal') || lower.includes('dialog')) {
        description = `Interactive overlay modal providing focused view and management controls for ${words.replace(/modal|dialog/gi, '').trim() || 'dialog workflow'}.`;
      } else if (lower.includes('card') || lower.includes('tile')) {
        description = `Visual surface card rendering summary metrics, status indicators, and quick actions for ${words.replace(/card|tile/gi, '').trim() || 'entity'}.`;
      } else if (lower.includes('table') || lower.includes('grid') || lower.includes('list')) {
        description = `Structured data display component rendering sortable rows, actionable columns, and forensic attributes for ${words.replace(/table|grid|list/gi, '').trim() || 'records'}.`;
      } else if (lower.includes('manager') || lower.includes('controller') || lower.includes('module')) {
        description = `Administrative management console providing configuration, live synchronization, and CRUD actions for ${words.replace(/manager|controller|module/gi, '').trim() || 'system services'}.`;
      } else if (lower.includes('chart') || lower.includes('graph') || lower.includes('heatmap') || lower.includes('gauge')) {
        description = `High-performance visual telemetry chart illustrating distribution and analytical trends for ${words.replace(/chart|graph|heatmap|gauge/gi, '').trim() || 'data'}.`;
      } else if (lower.includes('select') || lower.includes('picker') || lower.includes('input') || lower.includes('field')) {
        description = `Form control component providing accessible selection, validated text entry, and custom formatting for ${words.replace(/select|picker|input|field/gi, '').trim() || 'form parameters'}.`;
      } else if (lower.includes('drawer') || lower.includes('sheet') || lower.includes('panel') || lower.includes('flyout')) {
        description = `Contextual slide-out panel delivering deep-dive inspection details and side controls for ${words.replace(/drawer|sheet|panel|flyout/gi, '').trim() || 'contextual items'}.`;
      } else if (lower.includes('header') || lower.includes('nav') || lower.includes('footer') || lower.includes('bar')) {
        description = `Layout navigation component managing breadcrumbs, action triggers, and brand status for ${words.replace(/header|nav|footer|bar/gi, '').trim() || 'pages'}.`;
      } else if (lower.includes('guard') || lower.includes('gate') || lower.includes('trap') || lower.includes('auth')) {
        description = `Security wrapper enforcing role-based access control (RBAC), authentication checks, and barrier protection for ${words.replace(/guard|gate|trap|auth/gi, '').trim() || 'protected routes'}.`;
      } else {
        description = `${words} component providing responsive UI rendering and interactive workflow handlers within ${project.name}.`;
      }
    }
  }

  // Auto-detect dependencies from imports
  const importMatches = fileContent.matchAll(/import\s+[\s\S]*?\s+from\s+['"](.+?)['"]/g);
  const extSet = new Set<string>();
  const intSet = new Set<string>();

  for (const match of importMatches) {
    const importPath = match[1];
    if (importPath.startsWith('.') || importPath.startsWith('/')) {
      intSet.add(importPath);
    } else {
      extSet.add(importPath);
    }
  }

  externalDeps = Array.from(extSet);
  internalDeps = Array.from(intSet);

  return {
    id: `${project.id}-${nameWithoutExt.toLowerCase()}`,
    name,
    description,
    category,
    subcategory,
    project: project.name,
    projectSymbol: project.symbol,
    projectIcon: project.icon,
    path: relativePath,
    relativePath,
    externalDeps,
    internalDeps,
    code: fileContent,
  };
}

const SKIP_NAMES = new Set(['index']);
const SKIP_PATTERNS = ['test', '.spec.', '.test.'];

function scanDir(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!['node_modules', '.git', 'dist', '.next', 'build'].includes(file)) {
        scanDir(filePath, fileList);
      }
    } else {
      const ext = path.extname(filePath);
      if (['.tsx', '.ts', '.jsx', '.js'].includes(ext)) {
        fileList.push(filePath);
      }
    }
  }
  return fileList;
}

function shouldSkip(filePath: string): boolean {
  const basename = path.basename(filePath, path.extname(filePath));
  if (SKIP_NAMES.has(basename.toLowerCase())) return true;
  if (SKIP_PATTERNS.some(p => filePath.toLowerCase().includes(p))) return true;
  return false;
}

function main() {
  const currentDir = process.cwd();
  const registryPath = path.join(currentDir, 'registry.json');

  if (!fs.existsSync(registryPath)) {
    console.error(`registry.json not found in ${currentDir}`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const projectIndex = args.indexOf('--project');
  const targetProjectId = projectIndex !== -1 ? args[projectIndex + 1] : null;

  console.log('Loading projects from registry.json...');
  const registryData = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const projects: Project[] = registryData.projects || [];

  const outputPath = path.join(currentDir, 'public', 'components-registry.json');

  let allComponents: ComponentInfo[] = [];
  let existingRegistry: ComponentInfo[] | null = null;

  if (fs.existsSync(outputPath)) {
    try {
      const fileContent = fs.readFileSync(outputPath, 'utf-8');
      const parsed = JSON.parse(fileContent);
      existingRegistry = Array.isArray(parsed) ? parsed : (parsed.components || null);
    } catch (e) {
      console.warn('Could not read existing registry.');
    }
  }

  // Incremental scan: preserve other projects when scanning a single one
  if (targetProjectId && existingRegistry) {
    allComponents = existingRegistry.filter(c => !c.id.startsWith(`${targetProjectId}-`));
    console.log(`Incremental scan: retained ${allComponents.length} components from other projects.`);
  }

  const projectsToScan = targetProjectId
    ? projects.filter(p => p.id === targetProjectId)
    : projects;

  if (targetProjectId && projectsToScan.length === 0) {
    console.error(`Project "${targetProjectId}" not found in registry.json.`);
    process.exit(1);
  }

  for (const project of projectsToScan) {
    const absoluteProjectLocal = path.isAbsolute(project.local)
      ? project.local
      : path.resolve(currentDir, '..', project.local);

    console.log(`Scanning project: ${project.name} (${absoluteProjectLocal})...`);
    let componentsDir = path.join(absoluteProjectLocal, 'apps', 'web', 'components');
    if (!fs.existsSync(componentsDir)) {
      const altComponentsDir = path.join(absoluteProjectLocal, 'frontend', 'src', 'components');
      if (fs.existsSync(altComponentsDir)) {
        componentsDir = altComponentsDir;
      }
    }

    if (!fs.existsSync(componentsDir)) {
      if (!targetProjectId && existingRegistry) {
        // Full scan, but directory not found (e.g. CI/CD environment).
        // Retain existing components for this project.
        const retained = existingRegistry.filter(c => c.project === project.name);
        if (retained.length > 0) {
          allComponents.push(...retained);
          console.log(`  ⚠ Directory not found. Retained ${retained.length} existing components for ${project.name} from registry.`);
          continue;
        }
      }
      console.log(`  ⚠ No components directory found — skipping.`);
      continue;
    }

    const files = scanDir(componentsDir);
    let count = 0;

    for (const file of files) {
      if (shouldSkip(file)) continue;
      try {
        const content = fs.readFileSync(file, 'utf-8');
        allComponents.push(parseComponent(file, content, project, absoluteProjectLocal));
        count++;
      } catch (err) {
        console.error(`  ✗ Error parsing ${file}:`, err);
      }
    }

    console.log(`  ✓ Indexed ${count} components from ${project.name}`);
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  // Compare component content (ignoring the scannedAt timestamp) so that
  // re-scans with no actual changes do not churn the file or dirty the tree.
  let scannedAt = new Date().toISOString();
  if (existingRegistry) {
    const sorted = (arr: ComponentInfo[]) => [...arr].sort((a, b) => a.id.localeCompare(b.id));
    const prev = JSON.stringify(sorted(existingRegistry));
    const next = JSON.stringify(sorted(allComponents));
    if (prev === next) {
      try {
        const existingRaw = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
        if (existingRaw && existingRaw.scannedAt) scannedAt = existingRaw.scannedAt;
      } catch (e) {
        /* keep fresh timestamp */
      }
    }
  }

  const registryOutput = {
    scannedAt,
    total: allComponents.length,
    components: allComponents,
  };

  fs.writeFileSync(outputPath, JSON.stringify(registryOutput, null, 2), 'utf-8');

  // Summary breakdown
  const byProject: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const c of allComponents) {
    byProject[c.project] = (byProject[c.project] || 0) + 1;
    byCategory[c.category] = (byCategory[c.category] || 0) + 1;
  }

  console.log(`\n✅ Successfully indexed ${allComponents.length} total components → ${outputPath}`);
  console.log('\nBy project:');
  Object.entries(byProject).sort((a, b) => b[1] - a[1]).forEach(([p, n]) => console.log(`  ${p}: ${n}`));
  console.log('\nBy category:');
  Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));
}

main();
