#!/usr/bin/env node
/**
 * Headless capture: launches Oscar GC in dev mode, connects via CDP, navigates
 * the named routes, and writes one PNG per route. Mirrors the spawn + CDP +
 * teardown flow of tests/e2e/fixtures.ts but as a one-shot CLI.
 *
 * Requires a display (Xvfb supplies one on `lq-vps`). The shell wrapper at
 * scripts/capture-oscar.sh sets up Xvfb and the onboarding-bypass env vars.
 *
 * Usage:
 *   node ui/desktop/scripts/capture.js \
 *     --out-dir docs/screenshots/sprint-4 \
 *     --routes "/,/#/practice/commercial,/#/practice/commercial-disputes"
 */
const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs');
const execAsync = promisify(exec);
const { chromium } = require('@playwright/test');

const DESKTOP_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(DESKTOP_DIR, '..', '..');
const DEFAULT_ROUTES = '/,/#/practice/commercial,/#/practice/commercial-disputes';
const PACKAGED_BINARY = path.join(DESKTOP_DIR, 'out', 'Oscar-GC-linux-x64', 'oscar-gc');

function parseArgs(argv) {
  const args = { outDir: null, routes: DEFAULT_ROUTES, debugPort: 9222 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--routes') args.routes = argv[++i];
    else if (a === '--debug-port') args.debugPort = Number(argv[++i]);
  }
  if (!args.outDir) throw new Error('--out-dir is required');
  args.outDir = path.resolve(REPO_ROOT, args.outDir);
  args.routeList = args.routes.split(',').map((r) => r.trim()).filter(Boolean);
  return args;
}

function routeToSlug(route) {
  if (route === '/' || route === '') return 'root';
  const hashIdx = route.indexOf('#');
  const after = hashIdx >= 0 ? route.slice(hashIdx + 1) : route;
  return after.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\//g, '-') || 'root';
}

function collectDescendants(rootPid) {
  // /proc walk: enumerate every PID whose ancestor chain reaches rootPid.
  // Electron forks renderer/GPU/network helpers and main.ts spawns goosed —
  // signalling only the immediate child (or its PGID) misses them on Linux.
  const parents = new Map();
  let entries;
  try {
    entries = fs.readdirSync('/proc');
  } catch {
    return [];
  }
  for (const d of entries) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
      const m = stat.match(/\)\s+\S\s+(\d+)/);
      if (m) parents.set(Number(d), Number(m[1]));
    } catch { /* race — proc entry vanished */ }
  }
  const out = [];
  const queue = [rootPid];
  const seen = new Set([rootPid]);
  while (queue.length) {
    const p = queue.shift();
    out.push(p);
    for (const [pid, ppid] of parents) {
      if (ppid === p && !seen.has(pid)) {
        seen.add(pid);
        queue.push(pid);
      }
    }
  }
  return out;
}

function signalEach(pids, signal) {
  for (const pid of pids) {
    try { process.kill(pid, signal); } catch { /* gone */ }
  }
}

async function killProcessGroup(child) {
  if (!child || !child.pid) return;
  const pids = collectDescendants(child.pid);
  signalEach(pids, 'SIGTERM');
  await new Promise((r) => setTimeout(r, 2000));
  signalEach(pids, 'SIGKILL');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  if (!fs.existsSync(PACKAGED_BINARY)) {
    throw new Error(`packaged binary not found at ${PACKAGED_BINARY} — run \`pnpm run make --targets=@electron-forge/maker-zip\` first`);
  }
  console.log(`[capture] launching ${PACKAGED_BINARY} (CDP :${args.debugPort})`);
  // Electron refuses to run as root without --no-sandbox (electron_main_delegate.cc).
  // ENABLE_PLAYWRIGHT triggers the CDP switch in main.ts:352-355 (baked into the bundle).
  const appProcess = spawn(PACKAGED_BINARY, ['--no-sandbox'], {
    cwd: DESKTOP_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    env: {
      ...process.env,
      ENABLE_PLAYWRIGHT: 'true',
      PLAYWRIGHT_DEBUG_PORT: String(args.debugPort),
      RUST_LOG: process.env.RUST_LOG || 'warn',
    },
  });
  if (process.env.CAPTURE_DEBUG) {
    appProcess.stdout.on('data', (d) => process.stderr.write(`[app] ${d}`));
    appProcess.stderr.on('data', (d) => process.stderr.write(`[app!] ${d}`));
  }

  let browser = null;
  try {
    console.log('[capture] waiting for CDP endpoint...');
    const maxRetries = 600;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${args.debugPort}`);
        console.log(`[capture] CDP connected on attempt ${attempt}`);
        break;
      } catch (err) {
        if (attempt === maxRetries) throw new Error(`CDP connect failed after ${maxRetries} attempts: ${err.message}`);
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    let page = null;
    for (let attempt = 1; attempt <= 200; attempt++) {
      const pages = browser.contexts().flatMap((c) => c.pages());
      page = pages[0] || null;
      if (page) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!page) throw new Error('no page found via CDP after window-wait');

    await page.waitForLoadState('domcontentloaded');
    try {
      await page.waitForLoadState('networkidle', { timeout: 10000 });
    } catch {
      console.log('[capture] networkidle timeout — continuing (MCP/goosed chatter)');
    }
    await page.waitForFunction(
      () => !!document.getElementById('root') && document.getElementById('root').children.length > 0,
      { timeout: 30000 }
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => {
      try { window.resizeTo(1440, 900); } catch { /* may be ignored by some BrowserWindow modes */ }
    });
    await page.waitForTimeout(300);

    // First-launch Goose telemetry-consent modal obscures the surface. Click
    // "No thanks" if it's present — we are not opting any pipeline into
    // upstream telemetry from headless captures.
    try {
      const declineBtn = page.getByRole('button', { name: /no thanks/i });
      if (await declineBtn.isVisible({ timeout: 1500 })) {
        await declineBtn.click();
        await page.waitForTimeout(300);
        console.log('[capture] dismissed telemetry-consent modal');
      }
    } catch { /* no modal — fine */ }

    for (const route of args.routeList) {
      const slug = routeToSlug(route);
      const outPath = path.join(args.outDir, `${slug}.png`);

      const hashIdx = route.indexOf('#');
      const targetHash = hashIdx >= 0 ? route.slice(hashIdx) : '';
      const currentHash = await page.evaluate(() => window.location.hash);
      if (currentHash !== targetHash) {
        await page.evaluate((h) => { window.location.hash = h; }, targetHash);
        await page.waitForFunction((h) => window.location.hash === h, targetHash, { timeout: 5000 });
      }
      await page.waitForTimeout(500);
      await page.screenshot({ path: outPath, fullPage: false });
      const bytes = fs.statSync(outPath).size;
      console.log(`[capture] ${route} -> ${outPath} (${bytes} bytes)`);
    }

    console.log('[capture] done');
  } finally {
    if (browser) await browser.close().catch(() => {});
    await killProcessGroup(appProcess);
  }
}

main().catch((err) => {
  console.error('[capture] FAILED:', err);
  process.exit(1);
});
