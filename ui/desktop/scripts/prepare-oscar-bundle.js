// Sprint 10 (ADRs 021-024): prepare Oscar GC bundled runtime under
// ui/desktop/src/resources/ before electron-forge make. Idempotent: cached
// tarballs in .oscar-bundle-cache/ skip on re-runs. Run via the
// `bundle:oscar-linux` npm script.

const crypto = require('node:crypto');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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

// Sibling MCP repos. Each is bundled with esbuild from src/index.ts using the
// sibling's own node_modules for module resolution.
const SIBLING_MCPS = {
  'oscar-onboarding': '/srv/projects/oscar-onboarding-mcp',
  'oscar-memory': '/srv/projects/oscar-memory-mcp',
};

// --- Paths --------------------------------------------------------------

const UI_DESKTOP = path.resolve(__dirname, '..');
const RESOURCES = path.join(UI_DESKTOP, 'src', 'resources');
const PY_DIR = path.join(RESOURCES, 'python');
const PY_CPYTHON_DIR = path.join(PY_DIR, 'cpython');
const PY_WHEELS_DIR = path.join(PY_DIR, 'wheels');
const NODE_DIR = path.join(RESOURCES, 'node');
const NODE_BIN = path.join(NODE_DIR, 'bin', 'node');
const MCPS_DIR = path.join(RESOURCES, 'mcps');
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

  if (!fs.existsSync(path.join(PY_CPYTHON_DIR, 'bin', 'python3'))) {
    fs.rmSync(PY_CPYTHON_DIR, { recursive: true, force: true });
    ensureDir(PY_CPYTHON_DIR);
    console.log(`[python] extracting → ${PY_CPYTHON_DIR}`);
    // Tarball top-level is 'python/'; strip it so bin/, lib/, include/ land directly.
    run('tar', ['-xzf', tarball, '-C', PY_CPYTHON_DIR, '--strip-components=1']);
  } else {
    console.log(`[python] cpython already present at ${PY_CPYTHON_DIR}`);
  }

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

// --- Main ---------------------------------------------------------------

async function main() {
  console.log(`Preparing Oscar GC bundle at ${RESOURCES}`);
  ensureDir(RESOURCES);
  await preparePython();
  await prepareNode();
  await prepareMcps();
  console.log('Oscar GC bundle prep complete.');
  // Hash summary for build provenance.
  const summary = {
    python: { release: PBS_RELEASE_DATE, version: PYTHON_VERSION },
    node: { version: NODE_VERSION },
    adeu: { version: ADEU_VERSION },
    mcps: Object.keys(SIBLING_MCPS),
    timestamp: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(RESOURCES, 'BUNDLE.json'), JSON.stringify(summary, null, 2));
  console.log(`Wrote ${path.join(RESOURCES, 'BUNDLE.json')}`);
}

main().catch((err) => {
  console.error(`prepare-oscar-bundle: ${err.message}`);
  process.exit(1);
});
