// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 10 (ADRs 021-024): prepare Oscar GC bundled runtime under
// ui/desktop/src/resources/ before electron-forge make. Idempotent: cached
// tarballs in .oscar-bundle-cache/ skip on re-runs. Run via the
// `bundle:oscar-linux` npm script.

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

// --- Pinned versions ----------------------------------------------------

// python-build-standalone release. Bump RELEASE_DATE + PYTHON_VERSION when
// upgrading; verify the URL resolves before merging.
const PBS_RELEASE_DATE = '20240814';
const PYTHON_VERSION = '3.12.5';
const PYTHON_TARBALL = `cpython-${PYTHON_VERSION}+${PBS_RELEASE_DATE}-x86_64-unknown-linux-gnu-install_only.tar.gz`;
const PYTHON_TARBALL_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_RELEASE_DATE}/${PYTHON_TARBALL}`;

const NODE_VERSION = '24.10.0';
const NODE_TARBALL = `node-v${NODE_VERSION}-linux-x64.tar.xz`;
const NODE_TARBALL_URL = `https://nodejs.org/dist/v${NODE_VERSION}/${NODE_TARBALL}`;

const ADEU_VERSION = '1.6.9';

// In-tree MCP sources. Each is bundled with esbuild from src/index.ts using
// the MCP's own node_modules for module resolution. After Sprint-26
// consolidation these all live under oscar/mcps/<name>/ in this repo.
// The 6 Sprint-22 MCPs (Sprint 22 ADR-075) are lifted/adapted from Lavern
// (github.com/AnttiHero/lavern, Apache-2.0, commit 7c2efe61); the 2 net-new
// ones (onboarding, memory) predate them.
const OSCAR_MCPS_ROOT = path.resolve(__dirname, '..', '..', '..', 'oscar', 'mcps');
const SIBLING_MCPS = {
  'oscar-onboarding': path.join(OSCAR_MCPS_ROOT, 'onboarding'),
  'oscar-memory': path.join(OSCAR_MCPS_ROOT, 'memory'),
  'oscar-knowledge-base': path.join(OSCAR_MCPS_ROOT, 'knowledge-base'),
  'oscar-document-reader': path.join(OSCAR_MCPS_ROOT, 'document-reader'),
  'oscar-risk-pricing': path.join(OSCAR_MCPS_ROOT, 'risk-pricing'),
  'oscar-baselines': path.join(OSCAR_MCPS_ROOT, 'baselines'),
  'oscar-grounding-verifier': path.join(OSCAR_MCPS_ROOT, 'grounding-verifier'),
  'oscar-document-checks': path.join(OSCAR_MCPS_ROOT, 'document-checks'),
  // Sprint 35 (ADR-111): Tabular Review MCP. Bundled dir name is "tabular"
  // (not "oscar-tabular") to match resolveTabularBundle() in buildPracticeAreaRecipe.ts.
  tabular: path.join(OSCAR_MCPS_ROOT, 'tabular'),
};

// Sprint 12 (ADR-040): npm-vendored MCPs. Each is bundled with esbuild from
// the package's published entry point. Pinned exactly in package.json.
const VENDORED_MCPS = {
  'oscar-fs': {
    pkg: '@modelcontextprotocol/server-filesystem',
    entry: 'dist/index.js',
  },
};

// Sprint 12 (ADR-042): build-time network audit patterns. Bundled MCP source
// is scanned for outbound-call shapes. Expect zero unwaived matches; matches
// become a P0 to investigate.
const NETWORK_AUDIT_PATTERNS = [
  { name: 'fetch_call', regex: /\bfetch\s*\(/g },
  { name: 'axios', regex: /\baxios\b/g },
  { name: 'https_request', regex: /\bhttps?\.request\s*\(/g },
  { name: 'XMLHttpRequest', regex: /\bXMLHttpRequest\b/g },
  { name: 'node_fetch', regex: /['"]node-fetch['"]/g },
];

// Sprint 12 (ADR-042): GOOSE_ALLOWLIST file content. Empty extensions list —
// no MCP install commands are permitted via the Extensions UI. Our 4 bundled
// MCPs register via recipes, not via the install flow, so the empty list
// does not affect them. Sprint 15+ structural revisit per ADR-042 if/when
// community-tier MCPs land.
const ALLOWLIST_YAML = `# Sprint 12 (ADR-042): Oscar GC's GOOSE_ALLOWLIST. Empty extensions list —
# no MCP install commands are permitted via the Extensions UI. Bundled MCPs
# (oscar-fs, oscar-memory, oscar-onboarding, redline) register via recipes,
# not via the install flow — unaffected by this list.
extensions: []
`;

// --- Paths --------------------------------------------------------------

const UI_DESKTOP = path.resolve(__dirname, '..');
const RESOURCES = path.join(UI_DESKTOP, 'src', 'resources');
const PY_DIR = path.join(RESOURCES, 'python');
const PY_CPYTHON_DIR = path.join(PY_DIR, 'cpython');
const PY_WHEELS_DIR = path.join(PY_DIR, 'wheels');
const NODE_DIR = path.join(RESOURCES, 'node');
const NODE_BIN = path.join(NODE_DIR, 'bin', 'node');
const MCPS_DIR = path.join(RESOURCES, 'mcps');
// Sprint 22 (ADR-075): sub-recipes are checked-in source under ui/desktop/sub-recipes/.
// prepareSubRecipes() copies them to RESOURCES/sub-recipes/ for the bundle.
const SUB_RECIPES_SOURCE = path.join(UI_DESKTOP, 'sub-recipes');
const SUB_RECIPES_DIR = path.join(RESOURCES, 'sub-recipes');
// Sprint 35 (ADR-111): top-level recipes (the tabular-cell-extractor Summon
// delegates to) live at <repo>/oscar/recipes and are copied to RESOURCES/recipes/;
// ensureBundledRecipes() in main.ts copies them onward into ~/.config/goose/recipes/.
const RECIPES_SOURCE = path.join(OSCAR_MCPS_ROOT, '..', 'recipes');
const RECIPES_DIR = path.join(RESOURCES, 'recipes');
const SKILLS_DIR = path.join(RESOURCES, 'skills');
// Sprint 11 (ADR-031, ADR-035): the curated in-house legal skill library
// vendored from Anthropic's claude-for-legal lives at this repo path.
const SKILLS_SOURCE = path.resolve(__dirname, '..', '..', '..', 'skills', 'in-house-legal');
const CACHE_DIR = path.join(UI_DESKTOP, '.oscar-bundle-cache');

// --- Helpers ------------------------------------------------------------

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')} (status ${r.status})`);
  }
}

function downloadTo(url, dest, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    if (redirectsLeft < 0) {
      reject(new Error(`Too many redirects for ${url}`));
      return;
    }
    const tmp = `${dest}.partial`;
    https
      .get(url, (res) => {
        if (
          (res.statusCode === 301 ||
            res.statusCode === 302 ||
            res.statusCode === 307 ||
            res.statusCode === 308) &&
          res.headers.location
        ) {
          res.resume();
          downloadTo(res.headers.location, dest, redirectsLeft - 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const file = fs.createWriteStream(tmp);
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => {
            fs.renameSync(tmp, dest);
            resolve(dest);
          });
        });
        file.on('error', reject);
      })
      .on('error', reject);
  });
}

async function fetchCached(url, filename) {
  ensureDir(CACHE_DIR);
  const dest = path.join(CACHE_DIR, filename);
  if (fs.existsSync(dest)) {
    console.log(`[cache] hit ${filename}`);
    return dest;
  }
  console.log(`[cache] miss; downloading ${url}`);
  return downloadTo(url, dest);
}

// --- Steps --------------------------------------------------------------

async function preparePython() {
  console.log('--- preparePython ---');
  ensureDir(PY_DIR);

  const tarball = await fetchCached(PYTHON_TARBALL_URL, PYTHON_TARBALL);

  // Sprint 31 (ADR-103): always wipe + re-extract bundled CPython on each
  // run so the adeu install + ADR-045 patch start from a clean tree.
  // Otherwise a re-run hits "patch already applied" and aborts the build.
  // Tarball is in CACHE_DIR; extraction is ~10s.
  fs.rmSync(PY_CPYTHON_DIR, { recursive: true, force: true });
  ensureDir(PY_CPYTHON_DIR);
  console.log(`[python] extracting → ${PY_CPYTHON_DIR}`);
  // Tarball top-level is 'python/'; strip it so bin/, lib/, include/ land directly.
  run('tar', ['-xzf', tarball, '-C', PY_CPYTHON_DIR, '--strip-components=1']);

  // Always refresh wheels (small + cheap; ensures pin matches).
  fs.rmSync(PY_WHEELS_DIR, { recursive: true, force: true });
  ensureDir(PY_WHEELS_DIR);
  const pyBin = path.join(PY_CPYTHON_DIR, 'bin', 'python3');
  console.log(`[python] downloading adeu==${ADEU_VERSION} wheels via ${pyBin}`);
  run(pyBin, [
    '-m',
    'pip',
    'download',
    `adeu==${ADEU_VERSION}`,
    '--dest',
    PY_WHEELS_DIR,
    '--only-binary=:all:',
  ]);

  // Sprint 31 (ADR-103, supersedes ADR-022): install adeu directly into
  // bundled CPython's site-packages at bundle time — no venv. The .deb's
  // postinst used to create the venv at install-time so shebangs were
  // correct, but the zip build has no postinst, leaving redline broken
  // (Sprint 30 dogfood Test 1). python-build-standalone is fully
  // relocatable, so installing into its site-packages produces a tree
  // that travels with the bundle to both .deb and zip targets.
  console.log(`[python] installing adeu==${ADEU_VERSION} into bundled CPython`);
  run(pyBin, [
    '-m',
    'pip',
    'install',
    '--no-index',
    '--find-links',
    PY_WHEELS_DIR,
    `adeu==${ADEU_VERSION}`,
  ]);

  // ADR-045 (Sprint 13): apply the adeu batch-path word-diff vendor patch
  // directly to the bundled site-packages. Deletion criterion: upstream
  // adeu releases this fix and we repin — at which point remove this
  // patch invocation.
  const repoRoot = path.resolve(UI_DESKTOP, '..', '..');
  const patchSrc = path.join(repoRoot, 'docs', 'redline', `adeu-${ADEU_VERSION}-batch-path-word-diff.patch`);
  if (!fs.existsSync(patchSrc)) {
    throw new Error(`[python] ADR-045 patch missing at ${patchSrc}`);
  }
  const pyMinor = PYTHON_VERSION.split('.').slice(0, 2).join('.');
  const sitePackagesDir = path.join(PY_CPYTHON_DIR, 'lib', `python${pyMinor}`, 'site-packages');
  console.log(`[python] applying ADR-045 patch to ${sitePackagesDir}`);
  run('patch', ['-d', sitePackagesDir, '-p1', '-i', patchSrc]);

  // Sprint 31 (ADR-103): smoke-import the installed adeu module against
  // bundled CPython. Catches missing deps + path-resolution issues at
  // bundle time rather than at first user redline call.
  console.log(`[python] smoke: import adeu.server via bundled CPython`);
  run(pyBin, ['-c', 'import adeu.server; print(adeu.__version__)']);

  // Wheels and patch staging are consumed at bundle time; remove to slim
  // the shipped bundle (~95 MB saved). postinst.sh no longer needs them
  // (Sprint 31 ADR-103 drops the venv-create block).
  fs.rmSync(PY_WHEELS_DIR, { recursive: true, force: true });
  console.log(`[python] removed wheels staging dir (consumed at bundle time)`);
}

async function prepareNode() {
  console.log('--- prepareNode ---');
  ensureDir(NODE_DIR);

  const tarball = await fetchCached(NODE_TARBALL_URL, NODE_TARBALL);

  if (!fs.existsSync(NODE_BIN)) {
    fs.rmSync(NODE_DIR, { recursive: true, force: true });
    ensureDir(NODE_DIR);
    console.log(`[node] extracting → ${NODE_DIR}`);
    run('tar', ['-xJf', tarball, '-C', NODE_DIR, '--strip-components=1']);
  } else {
    console.log(`[node] binary already present at ${NODE_BIN}`);
  }
}

async function prepareMcps() {
  console.log('--- prepareMcps ---');
  const esbuild = require('esbuild');
  ensureDir(MCPS_DIR);
  for (const [name, repoPath] of Object.entries(SIBLING_MCPS)) {
    if (!fs.existsSync(repoPath)) {
      throw new Error(`Sibling MCP repo not found at ${repoPath}`);
    }
    if (!fs.existsSync(path.join(repoPath, 'node_modules'))) {
      console.log(`[mcps] pnpm install for ${name}`);
      run('pnpm', ['install', '--frozen-lockfile'], { cwd: repoPath });
    }
    const entry = path.join(repoPath, 'src', 'index.ts');
    if (!fs.existsSync(entry)) {
      throw new Error(`Sibling MCP entry not found at ${entry}`);
    }
    const destDir = path.join(MCPS_DIR, name);
    fs.rmSync(destDir, { recursive: true, force: true });
    ensureDir(destDir);
    const outfile = path.join(destDir, 'index.js');
    console.log(`[mcps] esbuild ${entry} → ${outfile}`);
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: 'node24',
      format: 'cjs',
      outfile,
      logLevel: 'warning',
      absWorkingDir: repoPath,
    });
    // Stat for visibility into bundle size.
    const sz = fs.statSync(outfile).size;
    console.log(`[mcps] ${name} bundle size: ${(sz / 1024).toFixed(1)} KB`);
  }
}

async function prepareVendoredMcps() {
  console.log('--- prepareVendoredMcps ---');
  const esbuild = require('esbuild');
  ensureDir(MCPS_DIR);
  for (const [name, { pkg, entry: entryRel }] of Object.entries(VENDORED_MCPS)) {
    // pnpm hoists workspace-root deps to ui/node_modules, not ui/desktop/node_modules.
    // require.resolve walks upward through node_modules — matches whichever layout
    // pnpm chose without needing to know the hoist policy.
    let pkgRoot;
    try {
      const pkgJson = require.resolve(`${pkg}/package.json`, { paths: [UI_DESKTOP] });
      pkgRoot = path.dirname(pkgJson);
    } catch {
      throw new Error(
        `Vendored MCP package not installed: ${pkg}. Run pnpm install in ui/ first.`,
      );
    }
    const entry = path.join(pkgRoot, entryRel);
    if (!fs.existsSync(entry)) {
      throw new Error(`Vendored MCP entry not found at ${entry}`);
    }
    const destDir = path.join(MCPS_DIR, name);
    fs.rmSync(destDir, { recursive: true, force: true });
    ensureDir(destDir);
    const outfile = path.join(destDir, 'index.js');
    // Vendored MCPs ship as ESM (top-level await is increasingly common —
    // @modelcontextprotocol/server-filesystem@2026.1.14 onwards). Emit ESM
    // and drop a sibling package.json so Node loads the .js file as ESM
    // without changing the recipe paths.
    // No shebang banner here: ESM preserves the source's own shebang (CJS
    // strips it), so a banner would produce a duplicate and Node rejects
    // the file with SyntaxError on line 2.
    console.log(`[mcps] esbuild ${entry} → ${outfile}`);
    await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'node',
      target: 'node24',
      format: 'esm',
      outfile,
      logLevel: 'warning',
      absWorkingDir: UI_DESKTOP,
    });
    fs.writeFileSync(path.join(destDir, 'package.json'), '{"type":"module"}\n');
    const sz = fs.statSync(outfile).size;
    console.log(`[mcps] ${name} bundle size: ${(sz / 1024).toFixed(1)} KB`);
  }
}

function auditMcpNetworkSurface() {
  console.log('--- auditMcpNetworkSurface (ADR-042) ---');
  const allMcps = [
    ...Object.keys(SIBLING_MCPS),
    ...Object.keys(VENDORED_MCPS),
  ];
  const report = { summary: { matches: 0, mcps: allMcps.length }, by_mcp: {} };
  for (const name of allMcps) {
    const bundle = path.join(MCPS_DIR, name, 'index.js');
    if (!fs.existsSync(bundle)) {
      report.by_mcp[name] = { error: 'bundle not found' };
      continue;
    }
    const src = fs.readFileSync(bundle, 'utf8');
    const matches = [];
    for (const { name: pat, regex } of NETWORK_AUDIT_PATTERNS) {
      const found = src.match(regex);
      if (found && found.length > 0) {
        matches.push({ pattern: pat, count: found.length });
      }
    }
    report.by_mcp[name] = { matches };
    report.summary.matches += matches.reduce((a, m) => a + m.count, 0);
    if (matches.length === 0) {
      console.log(`[audit] ${name}: clean`);
    } else {
      console.log(
        `[audit] ${name}: ${matches.length} pattern(s) matched — review BUNDLE.json#network_audit`,
      );
    }
  }
  return report;
}

// Sprint 14 (ADR-049): spawn-boot smoke test for bundled MCPs. After bundling,
// spawn each MCP under the bundled Node and wait for its ready-line on stderr.
// Fails the build if any MCP can't reach handshake within the timeout — catches
// the class of regression that produced Sprint 13's duplicate-shebang P0-A.
async function smokeTestBundledMcps() {
  console.log('--- smokeTestBundledMcps (ADR-049) ---');
  const sandbox = path.join(CACHE_DIR, 'smoke-sandbox');
  ensureDir(sandbox);
  const TIMEOUT_MS = 3000;
  const checks = [
    {
      name: 'oscar-fs',
      bundle: path.join(MCPS_DIR, 'oscar-fs', 'index.js'),
      args: [sandbox],
      readyRe: /Secure MCP Filesystem Server running on stdio/,
    },
    {
      name: 'oscar-memory',
      bundle: path.join(MCPS_DIR, 'oscar-memory', 'index.js'),
      args: [],
      readyRe: /oscar-memory-mcp ready/,
    },
    {
      name: 'oscar-onboarding',
      bundle: path.join(MCPS_DIR, 'oscar-onboarding', 'index.js'),
      args: [],
      readyRe: /oscar-onboarding-mcp ready/,
    },
    // Sprint 22 (ADR-075): Tier-A Lavern lifts
    {
      name: 'oscar-knowledge-base',
      bundle: path.join(MCPS_DIR, 'oscar-knowledge-base', 'index.js'),
      args: [],
      readyRe: /oscar-knowledge-base-mcp ready/,
    },
    {
      name: 'oscar-document-reader',
      bundle: path.join(MCPS_DIR, 'oscar-document-reader', 'index.js'),
      args: [],
      readyRe: /oscar-document-reader-mcp ready/,
    },
    {
      name: 'oscar-risk-pricing',
      bundle: path.join(MCPS_DIR, 'oscar-risk-pricing', 'index.js'),
      args: [],
      readyRe: /oscar-risk-pricing-mcp ready/,
    },
    {
      name: 'oscar-baselines',
      bundle: path.join(MCPS_DIR, 'oscar-baselines', 'index.js'),
      args: [],
      readyRe: /oscar-baselines-mcp ready/,
    },
    {
      name: 'oscar-grounding-verifier',
      bundle: path.join(MCPS_DIR, 'oscar-grounding-verifier', 'index.js'),
      args: [],
      readyRe: /oscar-grounding-verifier-mcp ready/,
    },
    {
      name: 'oscar-document-checks',
      bundle: path.join(MCPS_DIR, 'oscar-document-checks', 'index.js'),
      args: [],
      readyRe: /oscar-document-checks-mcp ready/,
    },
    {
      // Sprint 35 (ADR-111): the tabular MCP resolves its matter dir from
      // OSCAR_MATTER_DIR at boot, so the spawn-smoke must supply one.
      name: 'tabular',
      bundle: path.join(MCPS_DIR, 'tabular', 'index.js'),
      args: [],
      env: { OSCAR_MATTER_DIR: sandbox },
      readyRe: /oscar-tabular-mcp ready/,
    },
  ];

  if (process.env.SKIP_SMOKE_TEST === '1') {
    console.warn(
      '[smoke] SKIPPED (SKIP_SMOKE_TEST=1) — do not ship a build with this flag set',
    );
    return { skipped: true, results: {} };
  }

  const results = {};
  for (const check of checks) {
    if (!fs.existsSync(check.bundle)) {
      results[check.name] = { status: 'fail', reason: 'bundle missing' };
      console.error(`[smoke] ${check.name}: FAIL — bundle missing at ${check.bundle}`);
      continue;
    }
    results[check.name] = await spawnAndAwaitReady(check, NODE_BIN, TIMEOUT_MS);
    const r = results[check.name];
    if (r.status === 'pass') {
      console.log(`[smoke] ${check.name}: pass (${r.ms}ms)`);
    } else {
      console.error(`[smoke] ${check.name}: FAIL — ${r.reason}`);
      if (r.stderr_tail) console.error(`        stderr_tail: ${r.stderr_tail}`);
    }
  }

  const allOk = Object.values(results).every((r) => r.status === 'pass');
  if (!allOk) {
    throw new Error('smokeTestBundledMcps: one or more bundled MCPs failed to spawn-boot');
  }
  return { skipped: false, timeout_ms: TIMEOUT_MS, results };
}

function spawnAndAwaitReady(check, nodeBin, timeoutMs) {
  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(nodeBin, [check.bundle, ...check.args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, NODE_NO_WARNINGS: '1', ...(check.env ?? {}) },
    });
    let stderr = '';
    let resolved = false;
    const finish = (status, reason, extra = {}) => {
      if (resolved) return;
      resolved = true;
      try {
        child.kill('SIGTERM');
      } catch {
        // child may already have exited
      }
      setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          // child may already have exited
        }
      }, 500).unref();
      resolve({
        status,
        reason,
        ms: Date.now() - started,
        stderr_tail: stderr.slice(-512),
        ...extra,
      });
    };
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (check.readyRe.test(stderr)) finish('pass');
    });
    child.on('exit', (code, signal) => {
      if (!resolved) {
        finish('fail', `process exited before ready line (code=${code}, signal=${signal})`);
      }
    });
    child.on('error', (err) => finish('fail', `spawn error: ${err.message}`));
    setTimeout(
      () => finish('fail', `timeout after ${timeoutMs}ms — no ready line on stderr`),
      timeoutMs,
    ).unref();
  });
}

// Sprint 22 (ADR-075): copy the checked-in sub-recipe YAMLs from
// ui/desktop/sub-recipes/ (source) into RESOURCES/sub-recipes/ (bundle output).
// Mirrors the prepareSkills() shape — source-of-truth lives outside resources/.
async function prepareSubRecipes() {
  console.log('--- prepareSubRecipes ---');
  if (!fs.existsSync(SUB_RECIPES_SOURCE)) {
    throw new Error(`Sub-recipes source missing: ${SUB_RECIPES_SOURCE}`);
  }
  fs.rmSync(SUB_RECIPES_DIR, { recursive: true, force: true });
  ensureDir(SUB_RECIPES_DIR);
  const files = fs
    .readdirSync(SUB_RECIPES_SOURCE)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  if (files.length === 0) {
    throw new Error(`No sub-recipe YAMLs found in ${SUB_RECIPES_SOURCE}`);
  }
  for (const f of files) {
    const srcPath = path.join(SUB_RECIPES_SOURCE, f);
    const dstPath = path.join(SUB_RECIPES_DIR, f);
    fs.copyFileSync(srcPath, dstPath);
    const sz = fs.statSync(dstPath).size;
    console.log(`[sub-recipes] ${f} (${sz} bytes)`);
  }
  return { count: files.length, files };
}

// Sprint 35 (ADR-111): copy the top-level recipe YAMLs from <repo>/oscar/recipes
// into RESOURCES/recipes/. Mirrors prepareSubRecipes(); the app then copies them
// to Summon's discovery path at launch via ensureBundledRecipes().
async function prepareRecipes() {
  console.log('--- prepareRecipes ---');
  if (!fs.existsSync(RECIPES_SOURCE)) {
    throw new Error(`Recipes source missing: ${RECIPES_SOURCE}`);
  }
  fs.rmSync(RECIPES_DIR, { recursive: true, force: true });
  ensureDir(RECIPES_DIR);
  const files = fs
    .readdirSync(RECIPES_SOURCE)
    .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
  if (files.length === 0) {
    throw new Error(`No recipe YAMLs found in ${RECIPES_SOURCE}`);
  }
  for (const f of files) {
    const dstPath = path.join(RECIPES_DIR, f);
    fs.copyFileSync(path.join(RECIPES_SOURCE, f), dstPath);
    console.log(`[recipes] ${f} (${fs.statSync(dstPath).size} bytes)`);
  }
  return { count: files.length, files };
}

async function prepareSkills() {
  console.log('--- prepareSkills ---');
  if (!fs.existsSync(SKILLS_SOURCE)) {
    throw new Error(`Bundled-skills source not found at ${SKILLS_SOURCE}`);
  }
  ensureDir(SKILLS_DIR);
  const destLegal = path.join(SKILLS_DIR, 'in-house-legal');
  fs.rmSync(destLegal, { recursive: true, force: true });
  fs.cpSync(SKILLS_SOURCE, destLegal, { recursive: true });
  // Count for provenance + visibility.
  const skillCount = countSkillMd(destLegal);
  console.log(`[skills] copied in-house-legal → ${destLegal} (SKILL.md count: ${skillCount})`);
  return { destLegal, skillCount };
}

function countSkillMd(dir) {
  let n = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) n += countSkillMd(p);
    else if (entry.isFile() && entry.name === 'SKILL.md') n += 1;
  }
  return n;
}

// --- Main ---------------------------------------------------------------

async function main() {
  console.log(`Preparing Oscar GC bundle at ${RESOURCES}`);
  ensureDir(RESOURCES);
  await preparePython();
  await prepareNode();
  await prepareMcps();
  await prepareVendoredMcps();
  const smokeTest = await smokeTestBundledMcps();
  const subRecipes = await prepareSubRecipes();
  const recipes = await prepareRecipes();
  const skills = await prepareSkills();
  const networkAudit = auditMcpNetworkSurface();
  console.log('Oscar GC bundle prep complete.');
  // Hash summary for build provenance.
  const summary = {
    python: { release: PBS_RELEASE_DATE, version: PYTHON_VERSION },
    node: { version: NODE_VERSION },
    adeu: { version: ADEU_VERSION },
    mcps: [...Object.keys(SIBLING_MCPS), ...Object.keys(VENDORED_MCPS)],
    sub_recipes: { count: subRecipes.count, files: subRecipes.files },
    recipes: { count: recipes.count, files: recipes.files },
    skills: { 'in-house-legal': { skill_md_count: skills.skillCount } },
    network_audit: networkAudit,
    // Sprint 15 (ADR-052): hosted MCP extensions wired by Oscar code,
    // not bundled. Egress only occurs when the user has configured the
    // relevant credential. Declared here for audit-trail completeness;
    // see goosed's runtime egress posture amending ADR-042.
    runtime_egress_optional: [
      {
        extension: 'tavily',
        type: 'sse',
        host: 'mcp.tavily.com',
        purpose: 'Web-search hypothesis-confirm during intake P2.5c (ADR-050 rule 4); also available to practice-area agents mid-matter.',
        credential_handling: 'user-provided runtime key; never bundled. Env TAVILY_API_KEY > ~/.config/oscar/secrets/tavily.json > omitted.',
        fallback_on_absence: 'Tavily extension omitted from recipe; intake degrades to LLM-only hypothesis silently.',
      },
    ],
    smoke_test: smokeTest,
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(RESOURCES, 'BUNDLE.json'), JSON.stringify(summary, null, 2));
  console.log(`Wrote ${path.join(RESOURCES, 'BUNDLE.json')}`);
  // Sprint 12 (ADR-042): allowlist.yaml at the resources root for
  // GOOSE_ALLOWLIST consumption.
  fs.writeFileSync(path.join(RESOURCES, 'allowlist.yaml'), ALLOWLIST_YAML);
  console.log(`Wrote ${path.join(RESOURCES, 'allowlist.yaml')}`);
}

main().catch((err) => {
  console.error(`prepare-oscar-bundle: ${err.message}`);
  process.exit(1);
});
