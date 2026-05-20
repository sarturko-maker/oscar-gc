#!/usr/bin/env node
/**
 * Sprint M1 visual verification harness. Drives the packaged Oscar GC
 * binary through the seven right-pane states from the M1 brief and writes
 * one PNG per state to --out-dir.
 *
 * Builds on capture.js's spawn + CDP + teardown pattern, adds:
 *   - disk-state pre-seed (profile.json schema v4 with Commercial in
 *     practice_areas; matter created via window.electron.matters.create
 *     IPC after launch)
 *   - sequential per-state actions (navigate / click / drag / quit-relaunch)
 *
 * Usage:
 *   bash scripts/capture-oscar.sh ... node ui/desktop/scripts/capture-m1.js \
 *     --out-dir docs/screenshots/sprint-m1
 *
 * The capture-oscar.sh wrapper provides Xvfb + onboarding-bypass env vars.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('@playwright/test');

const DESKTOP_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(DESKTOP_DIR, '..', '..');
const PACKAGED_BINARY = path.join(
  DESKTOP_DIR,
  'out',
  'Oscar-GC-linux-x64',
  'oscar-gc',
);

const HOME = os.homedir();
const OSCAR_CONFIG = path.join(HOME, '.config', 'oscar');
const OSCAR_PROFILE = path.join(OSCAR_CONFIG, 'profile.json');
const OSCAR_STATE = path.join(OSCAR_CONFIG, 'state');
const OSCAR_TOM = path.join(OSCAR_CONFIG, 'tom-active-matter.md');
const OSCAR_DOCS = path.join(HOME, 'Documents', 'Oscar GC');
const ELECTRON_USERDATA = path.join(HOME, '.config', 'Oscar GC');
const ELECTRON_SETTINGS = path.join(ELECTRON_USERDATA, 'settings.json');

function parseArgs(argv) {
  const args = { outDir: null, debugPort: 9222 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out-dir') args.outDir = argv[++i];
    else if (a === '--debug-port') args.debugPort = Number(argv[++i]);
  }
  if (!args.outDir) throw new Error('--out-dir is required');
  args.outDir = path.resolve(REPO_ROOT, args.outDir);
  return args;
}

function rmRfSafe(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}

function preflightCleanup() {
  rmRfSafe(OSCAR_PROFILE);
  rmRfSafe(OSCAR_STATE);
  rmRfSafe(OSCAR_TOM);
  rmRfSafe(OSCAR_DOCS);
  rmRfSafe(ELECTRON_SETTINGS);
}

function seedProfile() {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'm1-test-harness',
    user: {
      name: 'Test Counsel',
      role: 'general-counsel',
      role_label: 'General Counsel',
    },
    corporate: {
      name: 'TestCo',
      industry: 'Software',
      size_band: '51-200',
    },
    company_context: null,
    practice_areas: [
      {
        id: 'commercial',
        name: 'Commercial',
        body: 'Default Commercial body',
        source: 'default',
      },
    ],
    provider: { kind: 'minimax', model: 'MiniMax-M2.5' },
  };
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(profile, null, 2), {
    mode: 0o600,
  });
}

function collectDescendants(rootPid) {
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
    } catch {
      /* gone */
    }
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
    try {
      process.kill(pid, signal);
    } catch {
      /* gone */
    }
  }
}

async function killProcessGroup(child) {
  if (!child || !child.pid) return;
  const pids = collectDescendants(child.pid);
  signalEach(pids, 'SIGTERM');
  await new Promise((r) => setTimeout(r, 2000));
  signalEach(pids, 'SIGKILL');
  await new Promise((r) => setTimeout(r, 500));
}

async function waitForCdpPage(debugPort) {
  let browser = null;
  for (let attempt = 1; attempt <= 600; attempt++) {
    try {
      browser = await chromium.connectOverCDP(
        `http://127.0.0.1:${debugPort}`,
      );
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!browser) throw new Error('CDP connect timed out');
  let page = null;
  for (let attempt = 1; attempt <= 200; attempt++) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    page = pages[0] || null;
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('no page via CDP after window-wait');
  await page.waitForLoadState('domcontentloaded');
  try {
    await page.waitForLoadState('networkidle', { timeout: 10000 });
  } catch {
    /* fine */
  }
  await page.waitForFunction(
    () =>
      !!document.getElementById('root') &&
      document.getElementById('root').children.length > 0,
    { timeout: 30000 },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    try {
      window.resizeTo(1440, 900);
    } catch {
      /* ignore */
    }
  });
  await page.waitForTimeout(300);
  // Telemetry-consent modal — same dismiss as capture.js
  try {
    const decline = page.getByRole('button', { name: /no thanks/i });
    if (await decline.isVisible({ timeout: 1500 })) {
      await decline.click();
      await page.waitForTimeout(300);
    }
  } catch {
    /* no modal */
  }
  return { browser, page };
}

async function launchApp(debugPort) {
  if (!fs.existsSync(PACKAGED_BINARY)) {
    throw new Error(
      `packaged binary not found at ${PACKAGED_BINARY} — run \`pnpm run make --targets=@electron-forge/maker-zip\` first`,
    );
  }
  // --disable-gpu + --disable-software-rasterizer side-step the recurring
  // "GPU process isn't usable. Goodbye." crash under Xvfb when the matter-
  // open flow lights up a heavier render path (Framer Motion + SSE init).
  // Same trade-off the Chromium docs recommend for headless containers.
  const appProcess = spawn(
    PACKAGED_BINARY,
    ['--no-sandbox', '--disable-gpu', '--disable-software-rasterizer'],
    {
      cwd: DESKTOP_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
      env: {
        ...process.env,
        ENABLE_PLAYWRIGHT: 'true',
        PLAYWRIGHT_DEBUG_PORT: String(debugPort),
        RUST_LOG: process.env.RUST_LOG || 'warn',
      },
    },
  );
  if (process.env.CAPTURE_DEBUG) {
    appProcess.stdout.on('data', (d) => process.stderr.write(`[app] ${d}`));
    appProcess.stderr.on('data', (d) => process.stderr.write(`[app!] ${d}`));
  }
  const { browser, page } = await waitForCdpPage(debugPort);
  return { appProcess, browser, page };
}

async function shot(page, outDir, slug) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  console.log(`[m1] ${slug}.png (${bytes} bytes)`);
}

async function setRoute(page, hash) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page.waitForFunction(
    (h) => window.location.hash === h,
    hash,
    { timeout: 5000 },
  );
  await page.waitForTimeout(500);
}

async function seedCommercialMatter(page) {
  // Use the renderer's matters.create IPC so derived fields (working_dir,
  // timestamps, schema_version, area_id) flow through main.ts validation.
  const slug = 'test-msa-renewal';
  await page.evaluate(async (s) => {
    await window.electron.matters.create('commercial', {
      slug: s,
      name: 'Test MSA Renewal',
      kind: 'agreement',
      subject: { type: 'contract', label: 'Acme Master Services Agreement' },
      counterparty: { role: 'customer', name: 'Acme Corp' },
      stakeholder: null,
      privileged: false,
      key_facts: '',
    });
  }, slug);
  return slug;
}

async function dismissRecipeSecretsIfShown(page) {
  // Sprint 17 (ADR-057) modal fires when an integration's env_key (here:
  // TAVILY_API_KEY) is unset. For the visual harness we mirror the
  // lawyer-without-Tavily-key path: click "Skip all".
  try {
    const skip = page.getByRole('button', { name: /skip all/i });
    if (await skip.isVisible({ timeout: 1500 })) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  } catch {
    /* no modal */
  }
}

async function openCommercialMatter(page) {
  // Navigate to MattersLanding and click the matter row. MattersLanding's
  // MatterRow wraps the matter name in a button; getByRole('button', name)
  // matches the matter title.
  await setRoute(page, '#/practice/commercial');
  await page.waitForTimeout(800);
  const matterButton = page.getByRole('button', { name: /Test MSA Renewal/i });
  await matterButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await matterButton.first().click();
  // Tavily-key modal may pop on first open; skip past it so the session
  // spawn proceeds.
  await page.waitForTimeout(800);
  await dismissRecipeSecretsIfShown(page);
  // Wait for /pair route. If openMatter throws (e.g. createSession HTTP
  // failure), the URL stays on /practice/commercial — surface the in-DOM
  // error text so the harness fails loud.
  try {
    await page.waitForFunction(
      () => window.location.hash.startsWith('#/pair'),
      null,
      { timeout: 20000 },
    );
  } catch (err) {
    const diag = await page.evaluate(() => ({
      hash: window.location.hash,
      bodyText: document.body.innerText.slice(0, 2000),
    }));
    console.error(
      '[m1] openMatter never navigated. diag:',
      JSON.stringify(diag, null, 2),
    );
    throw err;
  }
  // Either the body text appears (expanded) or the toggle button appears
  // (collapsed). Both indicate the pane is mounted.
  await page.waitForSelector('.oscar__right-pane-toggle', { timeout: 10000 });
  await page.waitForTimeout(800);
}

async function dragHandleTo(page, targetWidth) {
  // Compute current pane width + handle position, then push mouse to make
  // the pane reach targetWidth. direction is -1 (LEFT-drag widens).
  const handle = await page.$('[data-testid="oscar-right-pane-handle"]');
  if (!handle) throw new Error('right-pane handle not found');
  const box = await handle.boundingBox();
  if (!box) throw new Error('handle boundingBox unavailable');
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  const paneBox = await (await page.$('.oscar__right-pane')).boundingBox();
  if (!paneBox) throw new Error('pane boundingBox unavailable');
  const currentWidth = paneBox.width;
  // delta_width = startWidth + delta where delta = (clientX - startX) * -1
  // => new clientX = startX - (targetWidth - currentWidth)
  const targetX = startX - (targetWidth - currentWidth);
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Mid-step plus settle for the mousemove handler.
  await page.mouse.move((startX + targetX) / 2, startY, { steps: 5 });
  await page.mouse.move(targetX, startY, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const finalBox = await (await page.$('.oscar__right-pane')).boundingBox();
  console.log(
    `[m1]   drag target=${targetWidth} start=${currentWidth.toFixed(0)} ` +
      `final=${finalBox ? finalBox.width.toFixed(0) : '??'}`,
  );
}

async function clickToggle(page) {
  // The extension-load toast (top-right) sits above the pane header and
  // intercepts both Playwright mouse-events and force:true clicks. Drive
  // the click via DOM .click() directly so overlays don't matter.
  const result = await page.evaluate(() => {
    const btn = document.querySelector('.oscar__right-pane-toggle');
    if (!btn) return { clicked: false, reason: 'no .oscar__right-pane-toggle' };
    btn.click();
    return { clicked: true };
  });
  if (!result.clicked) throw new Error(`toggle click failed: ${result.reason}`);
  await page.waitForTimeout(1000);
}

async function startQuickChat(page) {
  // Sidebar variant has aria-label="Start a quick chat".
  const btn = page.getByRole('button', { name: /start a quick chat/i });
  await btn.first().click();
  await page.waitForFunction(
    () => window.location.hash.startsWith('#/pair'),
    null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(1500);
}

async function shutdown(browser, appProcess) {
  if (browser) {
    try {
      await browser.close();
    } catch {
      /* ignore */
    }
  }
  await killProcessGroup(appProcess);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m1] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m1] launch #1 (fresh state)');
  let { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    // Seed the test matter via renderer IPC.
    console.log('[m1] seed Commercial matter');
    await seedCommercialMatter(page);

    // (a) Hub — no pane (pane is matter-scoped only).
    console.log('[m1] (a) Hub /');
    await setRoute(page, '');
    await shot(page, args.outDir, 'hub-no-pane');

    // (b) Open Commercial matter — pane visible at default 320px.
    console.log('[m1] (b) Open Commercial matter');
    await openCommercialMatter(page);
    await shot(page, args.outDir, 'commercial-pane-default');

    // (c) Drag pane to ~480px — wider.
    console.log('[m1] (c) Drag to 480px');
    await dragHandleTo(page, 480);
    await shot(page, args.outDir, 'commercial-pane-wide');

    // (d) Drag pane to ~240px — narrower.
    console.log('[m1] (d) Drag to 240px');
    await dragHandleTo(page, 240);
    await shot(page, args.outDir, 'commercial-pane-narrow');

    // (g) Quick-chat — pane hidden by default. Run BEFORE the explicit
    // collapse so this proves the route-default-off rule, not the sticky
    // false from step (e) (per plan's risk note).
    console.log('[m1] (g) Quick-chat');
    await startQuickChat(page);
    await shot(page, args.outDir, 'quickchat-no-pane');

    // Navigate back to the Commercial matter so we can collapse it.
    console.log('[m1] navigate back to Commercial matter');
    await openCommercialMatter(page);

    // (e) Click chevron — collapsed.
    console.log('[m1] (e) Collapse via chevron');
    await clickToggle(page);
    await shot(page, args.outDir, 'commercial-pane-collapsed');
  } finally {
    await shutdown(browser, appProcess);
  }

  // (f) Quit + relaunch + reopen matter → state persisted.
  console.log('[m1] launch #2 (preserved settings + matters state)');
  ({ appProcess, browser, page } = await launchApp(args.debugPort));
  try {
    console.log('[m1] (f) Open Commercial matter (persistence)');
    await openCommercialMatter(page);
    await shot(page, args.outDir, 'commercial-pane-persisted');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m1] done — 7 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m1] FAILED:', err);
  process.exit(1);
});
