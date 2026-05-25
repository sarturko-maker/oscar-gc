#!/usr/bin/env node
/**
 * Sprint 29 M4 — Skills section: surface zone + collapsed directory.
 *
 * States captured:
 *   (a) skills-all-on-directory-collapsed.png — default mode=all, every
 *       skill appears in the surface "In this matter" zone; the
 *       directory toggle is collapsed.
 *   (b) skills-one-off-moved-to-directory.png — toggle one skill Off
 *       from the surface; expand the directory; verify the skill is
 *       present in the directory list as Off.
 *   (c) skills-all-off-directory-auto-open.png — flip every skill off;
 *       surface shows the empty placeholder; directory auto-opens.
 *
 * Usage: bash scripts/capture-sprint29-m4.sh --out-dir docs/screenshots/sprint-29-m4
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

function rmRfSafe(p) { try { fs.rmSync(p, { recursive: true, force: true }); } catch { /* ignore */ } }
function preflightCleanup() {
  rmRfSafe(OSCAR_PROFILE); rmRfSafe(OSCAR_PROFILE_BAK); rmRfSafe(OSCAR_STATE);
  rmRfSafe(OSCAR_TOM); rmRfSafe(OSCAR_PLAYBOOKS); rmRfSafe(OSCAR_DOCS);
  rmRfSafe(ELECTRON_SETTINGS);
}

function seedProfile() {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'sprint29-m4-test-harness',
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

function collectDescendants(rootPid) {
  const parents = new Map();
  let entries; try { entries = fs.readdirSync('/proc'); } catch { return []; }
  for (const d of entries) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = fs.readFileSync(`/proc/${d}/stat`, 'utf8');
      const m = stat.match(/\)\s+\S\s+(\d+)/);
      if (m) parents.set(Number(d), Number(m[1]));
    } catch { /* gone */ }
  }
  const out = []; const queue = [rootPid]; const seen = new Set([rootPid]);
  while (queue.length) {
    const p = queue.shift(); out.push(p);
    for (const [pid, ppid] of parents) {
      if (ppid === p && !seen.has(pid)) { seen.add(pid); queue.push(pid); }
    }
  }
  return out;
}
function signalEach(pids, signal) { for (const pid of pids) { try { process.kill(pid, signal); } catch { /* gone */ } } }
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
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`); break; }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  if (!browser) throw new Error('CDP connect timed out');
  let page = null;
  for (let attempt = 1; attempt <= 200; attempt++) {
    const pages = browser.contexts().flatMap((c) => c.pages());
    page = pages[0] || null;
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('no page via CDP');
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
      await decline.click(); await page.waitForTimeout(300);
    }
  } catch { /* no modal */ }
  return { browser, page };
}

async function launchApp(debugPort) {
  if (!fs.existsSync(PACKAGED_BINARY)) throw new Error(`packaged binary not found at ${PACKAGED_BINARY}`);
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

async function zoneState(page) {
  return await page.evaluate(() => {
    const surfaceRows = Array.from(document.querySelectorAll(
      '[data-testid="skills-surface-list"] [data-testid^="skills-row-"]',
    )).map((r) => r.getAttribute('data-testid')?.replace('skills-row-', ''));
    const surfaceEmpty = !!document.querySelector('[data-testid="skills-surface-empty"]');
    const directoryToggle = document.querySelector('[data-testid="skills-directory-toggle"]');
    const directoryExpanded =
      directoryToggle?.getAttribute('aria-expanded') === 'true';
    const directoryRows = Array.from(document.querySelectorAll(
      '[data-testid="skills-list"] [data-testid^="skills-row-"]',
    )).map((r) => ({
      slug: r.getAttribute('data-testid')?.replace('skills-row-', ''),
      pressed: r.querySelector('[data-testid="skills-chip"]')?.getAttribute('aria-pressed') === 'true',
    }));
    return { surfaceRows, surfaceEmpty, directoryExpanded, directoryRows };
  });
}

async function shot(page, outDir, slug) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const state = await zoneState(page);
  console.log(
    `[m4] ${slug}.png (${bytes}B) surface=${JSON.stringify(state.surfaceRows)} surfaceEmpty=${state.surfaceEmpty} directoryExpanded=${state.directoryExpanded} directoryRows=${state.directoryRows.length}`,
  );
  return state;
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

async function toggleSkill(page, areaId, slug, enabled) {
  return await page.evaluate(
    async ([a, s, e]) => window.electron.skills.toggle(a, s, e),
    [areaId, slug, enabled],
  );
}

async function dismissRecipeSecretsIfShown(page) {
  try {
    const skip = page.getByRole('button', { name: /skip all/i });
    if (await skip.isVisible({ timeout: 1500 })) {
      await skip.click(); await page.waitForTimeout(400);
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
    null, { timeout: 20000 },
  );
  await page.waitForSelector('[data-testid="skills-directory-toggle"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m4] preflight cleanup + seed profile');
  preflightCleanup(); seedProfile();

  console.log('[m4] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    await createMatter(page, 'commercial', {
      slug: 'test-directory-shape', name: 'Test Directory Shape', kind: 'msa',
      subject: { type: 'contract', label: 'Acme MSA' },
      counterparty: { role: 'customer', name: 'Acme Corp' },
      stakeholder: 'Acme account', privileged: false,
      key_facts: '- M4 surface/directory exercise',
    });
    await openMatter(page, 'commercial', 'Test Directory Shape');

    console.log('[m4] (a) default all-On — surface holds all, directory collapsed');
    const a = await shot(page, args.outDir, 'a-skills-all-on-directory-collapsed');
    if (a.surfaceEmpty) throw new Error('[m4] (a) surface should NOT be empty');
    if (a.directoryExpanded) throw new Error('[m4] (a) directory should be collapsed by default');
    if (!a.surfaceRows || a.surfaceRows.length === 0) {
      throw new Error('[m4] (a) surface list missing');
    }
    const initialCount = a.surfaceRows.length;

    console.log('[m4] (b) toggle one skill Off; expand directory; verify it now lives there');
    const pickSlug = a.surfaceRows[0];
    const tres = await toggleSkill(page, 'commercial', pickSlug, false);
    if (!tres.ok) throw new Error(`[m4] toggle failed: ${JSON.stringify(tres)}`);
    await page.waitForTimeout(2500);
    await page.click('[data-testid="skills-directory-toggle"]');
    await page.waitForTimeout(500);
    const b = await shot(page, args.outDir, 'b-skills-one-off-moved-to-directory');
    if (!b.directoryExpanded) throw new Error('[m4] (b) directory should be expanded after click');
    if (b.surfaceRows.length !== initialCount - 1) {
      throw new Error(`[m4] (b) surface should shrink by one; was ${initialCount} now ${b.surfaceRows.length}`);
    }
    if (b.surfaceRows.includes(pickSlug)) {
      throw new Error(`[m4] (b) ${pickSlug} should not remain in surface after Off`);
    }
    if (!b.directoryRows.some((r) => r.slug === pickSlug && !r.pressed)) {
      throw new Error(`[m4] (b) ${pickSlug} not present in directory as Off`);
    }

    console.log('[m4] (c) flip everything Off; surface empty; directory auto-opens');
    for (const slug of a.surfaceRows.slice(1)) {
      const r = await toggleSkill(page, 'commercial', slug, false);
      if (!r.ok) throw new Error(`[m4] toggle failed for ${slug}: ${JSON.stringify(r)}`);
    }
    await page.waitForTimeout(2500);
    // The directory was already open from (b); collapse it manually so we
    // can verify the auto-open behaviour fires when the surface empties.
    await page.click('[data-testid="skills-directory-toggle"]');
    await page.waitForTimeout(500);
    // Click again to re-open via natural auto path — but auto-open only
    // triggers on render with surfaceEmpty=true; toggle-off doesn't reset
    // userClosedWhileEmpty. We re-open the matter to refresh.
    await setRoute(page, '#/');
    await page.waitForTimeout(800);
    await openMatter(page, 'commercial', 'Test Directory Shape');
    const c = await shot(page, args.outDir, 'c-skills-all-off-directory-auto-open');
    if (!c.surfaceEmpty) throw new Error('[m4] (c) surface should be empty');
    if (!c.directoryExpanded) throw new Error('[m4] (c) directory should auto-open when surface empty');
    console.log('[m4] PASS — surface/directory split works in all 3 states');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m4] done');
}

main().catch((err) => { console.error('[m4] FATAL', err); process.exit(1); });
