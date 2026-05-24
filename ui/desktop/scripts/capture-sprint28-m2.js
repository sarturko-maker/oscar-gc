#!/usr/bin/env node
/**
 * Sprint 28 M2 — Tools section visual verification.
 *
 * States captured:
 *   (a) commercial-tools-default.png       — Commercial matter, Tools shows
 *                                            Filesystem + Document extraction
 *                                            + Web search (Tavily) + Redlining
 *                                            (Adeu) as Always-on.
 *   (b) commercial-tools-with-installed.png — installed integration appears
 *                                             with On chip.
 *   (c) commercial-tools-toggled-off.png    — same integration toggled off →
 *                                             chip reads Off + area_overrides
 *                                             reflects deny-shape write.
 *   (d) privacy-tools-default.png           — Privacy matter, Tools shows
 *                                             universal bundled (no Redlining).
 *
 * Per-step DOM diagnostics: presence of `Tools` section, tool ids in DOM,
 * chip pressed-state per row, and the area_overrides.enabled_mcps slice
 * of profile.json after toggling.
 *
 * Usage: bash scripts/capture-sprint28-m2.sh --out-dir docs/screenshots/sprint-28-m2
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
    captured_via: 'sprint28-m2-test-harness',
    user: { name: 'Test Counsel', role: 'general-counsel', role_label: 'General Counsel' },
    corporate: { name: 'TestCo', industry: 'Software', size_band: '51-200' },
    company_context: null,
    practice_areas: [
      { id: 'commercial', name: 'Commercial', body: 'Default Commercial body', source: 'default' },
      { id: 'privacy', name: 'Privacy', body: 'Default Privacy body', source: 'default' },
    ],
    provider: { kind: 'minimax', model: 'MiniMax-M2.5' },
  };
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(profile, null, 2), { mode: 0o600 });
}

function readProfile() {
  return JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
}

function getEnabledMcps(profile, areaId) {
  return profile?.practice_areas?.find((a) => a.id === areaId)?.area_overrides?.enabled_mcps ?? null;
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

async function toolsRows(page) {
  return await page.evaluate(() => {
    const list = document.querySelector('[data-testid="tools-list"]');
    if (!list) return null;
    return Array.from(list.querySelectorAll('[data-testid^="tools-row-"]')).map((row) => {
      const id = row.getAttribute('data-testid')?.replace('tools-row-', '') ?? '';
      const source = row.getAttribute('data-source') ?? '';
      const name = row.querySelector('.oscar__tools-name')?.textContent ?? '';
      const chip = row.querySelector('[data-testid="tools-chip"]');
      return {
        id,
        source,
        name,
        chipText: chip?.textContent ?? '',
        chipPressed: chip?.getAttribute('aria-pressed') === 'true',
        chipDisabled: chip?.getAttribute('aria-disabled') === 'true',
      };
    });
  });
}

async function shot(page, outDir, slug, extras = {}) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const rows = await toolsRows(page);
  const profile = (() => { try { return readProfile(); } catch { return null; } })();
  const commercialMcps = getEnabledMcps(profile, 'commercial');
  console.log(
    `[m2] ${slug}.png (${bytes}B) hash=${hash} commercialMcps=${JSON.stringify(commercialMcps)} rows=${JSON.stringify(rows)} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
  );
  return rows;
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

async function installIntegration(page, areaId, entryId) {
  return await page.evaluate(
    async ([a, e]) => window.electron.integrations.install(a, e, true),
    [areaId, entryId],
  );
}

async function toggleTool(page, areaId, id, enabled) {
  return await page.evaluate(
    async ([a, i, e]) => window.electron.tools.toggle(a, i, e),
    [areaId, id, enabled],
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
  await page.waitForSelector('[data-testid="tools-list"]', { timeout: 15000 });
  await page.waitForTimeout(1200);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

const COMMERCIAL_MATTER = {
  slug: 'test-tools-commercial',
  name: 'Test Tools Commercial',
  kind: 'msa',
  subject: { type: 'contract', label: 'Acme MSA' },
  counterparty: { role: 'customer', name: 'Acme Corp' },
  stakeholder: 'Acme account',
  privileged: false,
  key_facts: '- M2 tools-section exercise',
};

const PRIVACY_MATTER = {
  slug: 'test-tools-privacy',
  name: 'Test Tools Privacy',
  kind: 'dpia',
  subject: { type: 'person', label: 'RecRanker pipeline' },
  counterparty: { role: 'processor', name: 'Salesforce' },
  stakeholder: 'Salesforce',
  privileged: false,
  key_facts: '- M2 tools-section exercise',
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m2] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m2] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m2] seed Commercial + Privacy matters');
    await createMatter(page, 'commercial', COMMERCIAL_MATTER);
    await createMatter(page, 'privacy', PRIVACY_MATTER);

    // (a) Commercial default — bundled tools list
    console.log('[m2] (a) commercial-tools-default');
    await openMatter(page, 'commercial', 'Test Tools Commercial');
    const aRows = await shot(page, args.outDir, 'a-commercial-tools-default');
    if (!aRows) throw new Error('[m2] (a) tools-list absent');
    const bundledIds = aRows.filter((r) => r.source === 'bundled').map((r) => r.id);
    const expectBundled = ['oscar-fs', 'computercontroller', 'Tavily', 'redline'];
    for (const id of expectBundled) {
      if (!bundledIds.includes(id)) {
        throw new Error(`[m2] (a) missing bundled tool ${id} (got ${bundledIds.join(', ')})`);
      }
    }

    // (b) Install Slack, re-open matter, expect Slack in installed rows
    console.log('[m2] (b) install Slack + re-open matter');
    const installRes = await installIntegration(page, 'commercial', 'Slack');
    console.log(`[m2] (b) install result: ${JSON.stringify(installRes)}`);
    await setRoute(page, '#/practice/commercial');
    await page.waitForTimeout(800);
    await openMatter(page, 'commercial', 'Test Tools Commercial');
    const bRows = await shot(page, args.outDir, 'b-commercial-tools-with-installed');
    const slackRow = bRows?.find((r) => r.id === 'Slack');
    if (!slackRow) throw new Error('[m2] (b) Slack row missing');
    if (slackRow.source !== 'installed') throw new Error('[m2] (b) Slack source wrong');
    if (!slackRow.chipPressed) throw new Error('[m2] (b) Slack should be ON by default');

    // (c) Toggle Slack off → profile reflects deny shape
    console.log('[m2] (c) toggle Slack off');
    const toggleRes = await toggleTool(page, 'commercial', 'Slack', false);
    console.log(`[m2] (c) toggle result: ${JSON.stringify(toggleRes)}`);
    await page.waitForTimeout(2500);
    const cRows = await shot(page, args.outDir, 'c-commercial-tools-toggled-off');
    const slackAfter = cRows?.find((r) => r.id === 'Slack');
    if (!slackAfter) throw new Error('[m2] (c) Slack row vanished');
    if (slackAfter.chipPressed) throw new Error('[m2] (c) Slack chip should be unpressed');
    if (slackAfter.chipText.toLowerCase() !== 'off') {
      throw new Error(`[m2] (c) Slack chip text expected "Off", got "${slackAfter.chipText}"`);
    }
    const profileAfter = readProfile();
    const mcps = getEnabledMcps(profileAfter, 'commercial');
    if (!mcps || mcps.mode !== 'deny' || !mcps.ids?.includes('Slack')) {
      throw new Error(`[m2] (c) area_overrides.enabled_mcps shape unexpected: ${JSON.stringify(mcps)}`);
    }

    // (d) Privacy default — no redline
    console.log('[m2] (d) privacy-tools-default');
    await openMatter(page, 'privacy', 'Test Tools Privacy');
    const dRows = await shot(page, args.outDir, 'd-privacy-tools-default');
    const privacyBundled = dRows?.filter((r) => r.source === 'bundled').map((r) => r.id) ?? [];
    if (privacyBundled.includes('redline')) {
      throw new Error('[m2] (d) Privacy should not show redline tool');
    }
    if (!privacyBundled.includes('Tavily') || !privacyBundled.includes('oscar-fs')) {
      throw new Error(`[m2] (d) Privacy missing universal bundled (got ${privacyBundled.join(', ')})`);
    }

    console.log('[m2] PASS — all 4 states verified');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m2] done');
}

main().catch((err) => {
  console.error('[m2] FATAL', err);
  process.exit(1);
});
