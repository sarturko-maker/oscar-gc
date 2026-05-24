#!/usr/bin/env node
/**
 * Sprint 28 M1 — Edit-strands-pane bug repro + post-fix visual verification.
 *
 * States captured:
 *   (a) matter-open-pane-visible.png       — opens Commercial matter, expects pane
 *   (b) edit-clicked-on-forge.png          — Edit link clicked, lands on Forge route
 *   (c) back-to-matter-pane-visible.png    — returns to same matter, expects pane
 *   (d) restart-then-matter-pane.png       — closes/relaunches/opens matter, expects pane
 *
 * Per-step diagnostics logged to stdout:
 *   - settings.json content (focusing on isRightPaneExpanded)
 *   - DOM presence of <aside class="oscar__right-pane"> + computed width
 *   - data-state attribute (expanded | collapsed)
 *
 * Usage: bash scripts/capture-sprint28-m1.sh --out-dir docs/screenshots/sprint-28-m1
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
const OSCAR_PROFILE_BAK = `${OSCAR_PROFILE}.bak`;
const OSCAR_STATE = path.join(OSCAR_CONFIG, 'state');
const OSCAR_TOM = path.join(OSCAR_CONFIG, 'tom-active-matter.md');
const OSCAR_PLAYBOOKS = path.join(OSCAR_CONFIG, 'playbooks');
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
  try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ }
}

function preflightCleanup() {
  rmRfSafe(OSCAR_PROFILE);
  rmRfSafe(OSCAR_PROFILE_BAK);
  rmRfSafe(OSCAR_STATE);
  rmRfSafe(OSCAR_TOM);
  rmRfSafe(OSCAR_PLAYBOOKS);
  rmRfSafe(OSCAR_DOCS);
  rmRfSafe(ELECTRON_SETTINGS);
}

function seedProfile() {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'sprint28-m1-test-harness',
    user: { name: 'Test Counsel', role: 'general-counsel', role_label: 'General Counsel' },
    corporate: { name: 'TestCo', industry: 'Software', size_band: '51-200' },
    company_context: null,
    practice_areas: [
      { id: 'commercial', name: 'Commercial', body: 'Default Commercial body', source: 'default' },
    ],
    provider: { kind: 'minimax', model: 'MiniMax-M2.5' },
  };
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(profile, null, 2), { mode: 0o600 });
}

function readSettings() {
  try { return JSON.parse(fs.readFileSync(ELECTRON_SETTINGS, 'utf8')); }
  catch { return null; }
}

function settingsSummary() {
  const s = readSettings();
  if (s === null) return 'absent';
  return JSON.stringify({
    isRightPaneExpanded: s.isRightPaneExpanded ?? null,
    rightPaneWidth: s.rightPaneWidth ?? null,
  });
}

function collectDescendants(rootPid) {
  const parents = new Map();
  let entries;
  try { entries = fs.readdirSync('/proc'); } catch { return []; }
  for (const d of entries) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
      const m = stat.match(/\)\s+\S\s+(\d+)/);
      if (m) parents.set(Number(d), Number(m[1]));
    } catch { /* gone */ }
  }
  const out = [];
  const queue = [rootPid];
  const seen = new Set([rootPid]);
  while (queue.length) {
    const p = queue.shift();
    out.push(p);
    for (const [pid, ppid] of parents) {
      if (ppid === p && !seen.has(pid)) { seen.add(pid); queue.push(pid); }
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
  await new Promise((r) => setTimeout(r, 500));
}

async function waitForCdpPage(debugPort) {
  let browser = null;
  for (let attempt = 1; attempt <= 600; attempt++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
      break;
    } catch { await new Promise((r) => setTimeout(r, 200)); }
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
  try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch { /* fine */ }
  await page.waitForFunction(
    () => !!document.getElementById('root') && document.getElementById('root').children.length > 0,
    { timeout: 30000 },
  );
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => { try { window.resizeTo(1440, 900); } catch { /* ignore */ } });
  await page.waitForTimeout(300);
  try {
    const decline = page.getByRole('button', { name: /no thanks/i });
    if (await decline.isVisible({ timeout: 1500 })) {
      await decline.click();
      await page.waitForTimeout(300);
    }
  } catch { /* no modal */ }
  return { browser, page };
}

async function launchApp(debugPort) {
  if (!fs.existsSync(PACKAGED_BINARY)) {
    throw new Error(`packaged binary not found at ${PACKAGED_BINARY}`);
  }
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

async function paneState(page) {
  return await page.evaluate(() => {
    const aside = document.querySelector('aside.oscar__right-pane');
    if (!aside) return { present: false };
    const rect = aside.getBoundingClientRect();
    return {
      present: true,
      dataState: aside.getAttribute('data-state'),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      editLinkPresent: !!aside.querySelector('[data-testid="right-pane-edit-link"]'),
      sectionCount: aside.querySelectorAll('.oscar__panel-section').length,
    };
  });
}

async function shot(page, outDir, slug, extras = {}) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const pane = await paneState(page);
  console.log(
    `[m1] ${slug}.png (${bytes}B) hash=${hash} settings=${settingsSummary()} pane=${JSON.stringify(pane)} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
  );
  return pane;
}

async function setRoute(page, hash) {
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  await page.waitForFunction((h) => window.location.hash === h, hash, { timeout: 5000 });
  await page.waitForTimeout(500);
}

async function createMatter(page, areaId, input) {
  return await page.evaluate(
    async ([a, i]) => window.electron.matters.create(a, i),
    [areaId, input],
  );
}

async function dismissRecipeSecretsIfShown(page) {
  try {
    const skip = page.getByRole('button', { name: /skip all/i });
    if (await skip.isVisible({ timeout: 1500 })) {
      await skip.click();
      await page.waitForTimeout(400);
    }
  } catch { /* none */ }
}

async function openMatter(page, areaId, matterName) {
  await setRoute(page, `#/practice/${areaId}`);
  await page.waitForTimeout(800);
  const matterButton = page.getByRole('button', { name: new RegExp(matterName, 'i') });
  await matterButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await matterButton.first().click();
  await page.waitForTimeout(800);
  await dismissRecipeSecretsIfShown(page);
  await page.waitForFunction(
    () => window.location.hash.startsWith('#/pair'),
    null,
    { timeout: 20000 },
  );
  await page.waitForTimeout(1500);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

const MATTER = {
  slug: 'test-edit-bug',
  name: 'Test Edit Bug',
  kind: 'msa',
  subject: { type: 'contract', label: 'Acme MSA' },
  counterparty: { role: 'customer', name: 'Acme Corp' },
  stakeholder: 'Acme account',
  privileged: false,
  key_facts: '- bug-repro matter for sprint-28 M1',
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m1] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();
  console.log(`[m1] settings after preflight: ${settingsSummary()}`);

  console.log('[m1] launch app (pass 1)');
  let { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m1] seed Commercial / Test Edit Bug');
    await createMatter(page, 'commercial', MATTER);

    console.log('[m1] (a) open matter, expect pane visible');
    await openMatter(page, 'commercial', 'Test Edit Bug');
    const aState = await shot(page, args.outDir, 'a-matter-open-pane-visible');
    if (!aState.present) throw new Error('[m1] (a) pane absent on initial matter open');

    console.log('[m1] (b) click Edit link → navigate to Forge');
    const editClicked = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="right-pane-edit-link"]');
      if (!el) return { ok: false, reason: 'edit link absent' };
      el.click();
      return { ok: true, href: el.getAttribute('href') };
    });
    if (!editClicked.ok) throw new Error(`[m1] (b) ${editClicked.reason}`);
    await page.waitForTimeout(2500);
    await dismissRecipeSecretsIfShown(page);
    await page.waitForTimeout(1500);
    await shot(page, args.outDir, 'b-edit-clicked-on-forge', { editHref: editClicked.href });

    console.log('[m1] (c) navigate back to matter via setRoute, expect pane visible');
    await openMatter(page, 'commercial', 'Test Edit Bug');
    await page.waitForTimeout(1000);
    const cState = await shot(page, args.outDir, 'c-back-to-matter-pane-visible');
    if (!cState.present) {
      console.error('[m1] (c) BUG REPRODUCED — pane absent after Forge round-trip');
    } else if (cState.dataState === 'collapsed') {
      console.error('[m1] (c) BUG REPRODUCED — pane mounted but collapsed (rail-only)');
    }

    console.log('[m1] shutdown app');
    await shutdown(browser, appProcess);

    console.log('[m1] (d) relaunch app, open matter, expect pane visible');
    console.log(`[m1] settings before relaunch: ${settingsSummary()}`);
    ({ appProcess, browser, page } = await launchApp(args.debugPort));
    await openMatter(page, 'commercial', 'Test Edit Bug');
    await page.waitForTimeout(1500);
    const dState = await shot(page, args.outDir, 'd-restart-then-matter-pane');
    if (!dState.present) {
      console.error('[m1] (d) BUG PERSISTS — pane absent after restart');
    } else if (dState.dataState === 'collapsed') {
      console.error('[m1] (d) BUG PERSISTS — pane mounted but collapsed after restart');
    } else {
      console.log('[m1] (d) PASS — pane visible after restart');
    }
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m1] done');
}

main().catch((err) => {
  console.error('[m1] FATAL', err);
  process.exit(1);
});
