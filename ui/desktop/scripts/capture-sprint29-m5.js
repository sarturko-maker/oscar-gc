#!/usr/bin/env node
/**
 * Sprint 29 M5 — Edit splits into in-pane manual form + Forge entry.
 *
 * States captured:
 *   (a) edit-display-mode.png       — matter open, header shows Edit.
 *   (b) edit-form-open.png          — click Edit, MatterFactsEditor
 *                                     mounts; header swaps to Cancel.
 *   (c) edit-saved-display.png      — change name + privileged + key
 *                                     facts; Save; form closes; new
 *                                     values appear in display.
 *   (d) edit-forge-entry-clicked.png — click "Ask Forge to change..."
 *                                      → navigation to /forge?modifyArea.
 *
 * Side-asserts: matters.json reflects the update; matter.md key_facts
 * body has the new content.
 *
 * Usage: bash scripts/capture-sprint29-m5.sh --out-dir docs/screenshots/sprint-29-m5
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
    captured_via: 'sprint29-m5-test-harness',
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

function readMattersRegistry(areaId) {
  const p = path.join(OSCAR_STATE, areaId, 'matters.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function readMatterMd(workingDir) {
  return fs.readFileSync(path.join(workingDir, 'matter.md'), 'utf8');
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

async function shot(page, outDir, slug) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const haveEditor = await page.locator('[data-testid="matter-facts-editor"]').count();
  const haveCancel = await page.locator('[data-testid="right-pane-cancel-edit"]').count();
  const haveEdit = await page.locator('[data-testid="right-pane-edit-link"]').count();
  console.log(
    `[m5] ${slug}.png (${bytes}B) hash=${hash} editor=${haveEditor} cancelBtn=${haveCancel} editBtn=${haveEdit}`,
  );
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
  await page.waitForSelector('[data-testid="right-pane-edit-link"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m5] preflight cleanup + seed profile');
  preflightCleanup(); seedProfile();

  console.log('[m5] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  const SLUG = 'test-edit-flow';
  const ORIGINAL_NAME = 'Test Edit Flow';
  const ORIGINAL_KEY_FACTS = '- starting key facts';
  const UPDATED_NAME = 'Test Edit Flow (renamed)';
  const UPDATED_KEY_FACTS = '- starting key facts\n- added via M5 edit';

  try {
    await createMatter(page, 'commercial', {
      slug: SLUG, name: ORIGINAL_NAME, kind: 'msa',
      subject: { type: 'contract', label: 'Acme MSA' },
      counterparty: { role: 'customer', name: 'Acme Corp' },
      stakeholder: 'Acme account', privileged: false,
      key_facts: ORIGINAL_KEY_FACTS,
    });
    await openMatter(page, 'commercial', ORIGINAL_NAME);

    console.log('[m5] (a) display mode, header shows Edit');
    await shot(page, args.outDir, 'a-edit-display-mode');

    console.log('[m5] (b) click Edit → editor mounts, header swaps to Cancel');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="right-pane-edit-link"]');
      if (btn instanceof HTMLElement) btn.click();
    });
    await page.waitForTimeout(800);
    const afterClick = await page.evaluate(() => {
      const aside = document.querySelector('.oscar__right-pane');
      return {
        dataEditingFacts: aside?.getAttribute('data-editing-facts') ?? 'absent',
        cancelBtn: !!document.querySelector('[data-testid="right-pane-cancel-edit"]'),
        editBtn: !!document.querySelector('[data-testid="right-pane-edit-link"]'),
        editor: !!document.querySelector('[data-testid="matter-facts-editor"]'),
        editorNoShape: !!document.querySelector('[data-testid="matter-facts-editor-no-shape"]'),
      };
    });
    console.log('[m5] post-click state:', JSON.stringify(afterClick));
    await page.waitForSelector('[data-testid="matter-facts-editor"]', { timeout: 5000 });
    await shot(page, args.outDir, 'b-edit-form-open');
    const cancelVisible = await page.locator('[data-testid="right-pane-cancel-edit"]').count();
    if (cancelVisible === 0) throw new Error('[m5] (b) Cancel button missing in header');
    const editStillVisible = await page.locator('[data-testid="right-pane-edit-link"]').count();
    if (editStillVisible !== 0) throw new Error('[m5] (b) Edit button still present in header');

    console.log('[m5] (c) change name + key facts + privileged, Save');
    await page.fill('[data-testid="matter-facts-edit-name"]', UPDATED_NAME);
    await page.fill('[data-testid="matter-facts-edit-key-facts"]', UPDATED_KEY_FACTS);
    await page.check('[data-testid="matter-facts-edit-privileged"]');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="matter-facts-edit-save"]');
      if (btn instanceof HTMLElement) btn.click();
    });
    await page.waitForSelector('[data-testid="matter-facts-editor"]', { state: 'detached', timeout: 5000 });
    await page.waitForTimeout(2500); // let the 2s poll catch up
    await shot(page, args.outDir, 'c-edit-saved-display');

    const reg = readMattersRegistry('commercial');
    const entry = reg.matters.find((m) => m.slug === SLUG);
    if (!entry) throw new Error('[m5] matter missing from registry after save');
    if (entry.name !== UPDATED_NAME) {
      throw new Error(`[m5] (c) registry name mismatch: got ${entry.name}`);
    }
    if (!entry.privileged) throw new Error('[m5] (c) registry privileged should be true');
    const md = readMatterMd(entry.working_dir);
    if (!md.includes('added via M5 edit')) {
      throw new Error('[m5] (c) matter.md key_facts not updated');
    }
    if (!md.includes(`name: "${UPDATED_NAME}"`)) {
      throw new Error('[m5] (c) matter.md frontmatter name not updated');
    }

    console.log('[m5] (d) re-open editor; click Forge entry → navigate to /forge?modifyArea');
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="right-pane-edit-link"]');
      if (btn instanceof HTMLElement) btn.click();
    });
    await page.waitForSelector('[data-testid="matter-facts-edit-open-forge"]', { timeout: 5000 });
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="matter-facts-edit-open-forge"]');
      if (btn instanceof HTMLElement) btn.click();
    });
    await page.waitForFunction(
      () => window.location.hash.startsWith('#/forge?modifyArea=commercial'),
      null, { timeout: 5000 },
    );
    await shot(page, args.outDir, 'd-edit-forge-entry-clicked');
    console.log('[m5] PASS — display ↔ form ↔ save ↔ Forge deep-link all wired');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m5] done');
}

main().catch((err) => { console.error('[m5] FATAL', err); process.exit(1); });
