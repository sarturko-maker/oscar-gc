#!/usr/bin/env node
/**
 * Sprint 28 M3 — Skills section UX simplification visual verification.
 *
 * States captured:
 *   (a) skills-default-all-on.png        — Commercial matter, every skill
 *                                          chip reads "On" (no mode pill).
 *   (b) skills-two-toggled-off.png       — two skills toggled off → chips
 *                                          read "Off"; profile.json shows
 *                                          enabled_skills = deny shape.
 *   (c) skills-after-restart.png         — restart app, open matter, expect
 *                                          the two skills still Off.
 *
 * Diagnostics: per-row skill id + chip text + aria-pressed + profile slice.
 * Also asserts the SkillsModePill is NOT in the DOM.
 *
 * Usage: bash scripts/capture-sprint28-m3.sh --out-dir docs/screenshots/sprint-28-m3
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
    captured_via: 'sprint28-m3-test-harness',
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

function readProfile() { return JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8')); }
function getEnabledSkills(profile, areaId) {
  return profile?.practice_areas?.find((a) => a.id === areaId)?.area_overrides?.enabled_skills ?? null;
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

async function skillsRows(page) {
  return await page.evaluate(() => {
    const list = document.querySelector('[data-testid="skills-list"]');
    if (!list) return null;
    return Array.from(list.querySelectorAll('[data-testid^="skills-row-"]')).map((row) => {
      const slug = row.getAttribute('data-testid')?.replace('skills-row-', '') ?? '';
      const chip = row.querySelector('[data-testid="skills-chip"]');
      return {
        slug,
        chipText: chip?.textContent ?? '',
        chipPressed: chip?.getAttribute('aria-pressed') === 'true',
      };
    });
  });
}

async function hasModePill(page) {
  return await page.evaluate(
    () => !!document.querySelector('[data-testid="skills-mode-pill"]'),
  );
}

async function shot(page, outDir, slug, extras = {}) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const rows = await skillsRows(page);
  const modePillPresent = await hasModePill(page);
  const profile = (() => { try { return readProfile(); } catch { return null; } })();
  const enabledSkills = getEnabledSkills(profile, 'commercial');
  console.log(
    `[m3] ${slug}.png (${bytes}B) hash=${hash} enabledSkills=${JSON.stringify(enabledSkills)} modePillPresent=${modePillPresent} rows=${rows ? rows.map((r) => `${r.slug}=${r.chipText}`).join(',') : 'null'} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
  );
  return { rows, modePillPresent };
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
  await page.waitForSelector('[data-testid="skills-list"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

const MATTER = {
  slug: 'test-skills-ux',
  name: 'Test Skills UX',
  kind: 'msa',
  subject: { type: 'contract', label: 'Acme MSA' },
  counterparty: { role: 'customer', name: 'Acme Corp' },
  stakeholder: 'Acme account',
  privileged: false,
  key_facts: '- M3 skills-toggle exercise',
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m3] preflight cleanup + seed profile');
  preflightCleanup(); seedProfile();

  console.log('[m3] launch app (pass 1)');
  let { appProcess, browser, page } = await launchApp(args.debugPort);

  let togglesPicked = [];
  try {
    console.log('[m3] seed Commercial / Test Skills UX');
    await createMatter(page, 'commercial', MATTER);

    console.log('[m3] (a) skills-default-all-on');
    await openMatter(page, 'commercial', 'Test Skills UX');
    const aState = await shot(page, args.outDir, 'a-skills-default-all-on');
    if (!aState.rows) throw new Error('[m3] (a) skills-list absent');
    if (aState.modePillPresent) throw new Error('[m3] (a) mode pill should not be in DOM');
    const offRows = aState.rows.filter((r) => !r.chipPressed);
    if (offRows.length > 0) {
      throw new Error(`[m3] (a) default state should be all-On; off: ${offRows.map((r) => r.slug).join(',')}`);
    }
    const allOn = aState.rows.every((r) => r.chipText === 'On');
    if (!allOn) throw new Error('[m3] (a) chip text should be "On" everywhere');

    if (aState.rows.length < 2) throw new Error('[m3] (a) need at least 2 skills to toggle');
    togglesPicked = aState.rows.slice(0, 2).map((r) => r.slug);
    console.log(`[m3] (b) toggle off: ${togglesPicked.join(', ')}`);
    for (const slug of togglesPicked) {
      const res = await toggleSkill(page, 'commercial', slug, false);
      if (!res.ok) throw new Error(`[m3] (b) toggle ${slug} off failed: ${JSON.stringify(res)}`);
    }
    await page.waitForTimeout(2500);
    const bState = await shot(page, args.outDir, 'b-skills-two-toggled-off');
    const offAfter = bState.rows?.filter((r) => !r.chipPressed).map((r) => r.slug) ?? [];
    for (const slug of togglesPicked) {
      if (!offAfter.includes(slug)) throw new Error(`[m3] (b) ${slug} should be off`);
    }
    const profileAfter = readProfile();
    const enabledSkills = getEnabledSkills(profileAfter, 'commercial');
    if (!enabledSkills || enabledSkills.mode !== 'deny') {
      throw new Error(`[m3] (b) profile mode should be deny: ${JSON.stringify(enabledSkills)}`);
    }
    for (const slug of togglesPicked) {
      if (!enabledSkills.slugs?.includes(slug)) {
        throw new Error(`[m3] (b) ${slug} missing from deny ids`);
      }
    }

    console.log('[m3] shutdown for restart-persistence check');
    await shutdown(browser, appProcess);

    console.log('[m3] (c) relaunch app, open matter, expect off skills persist');
    ({ appProcess, browser, page } = await launchApp(args.debugPort));
    await openMatter(page, 'commercial', 'Test Skills UX');
    const cState = await shot(page, args.outDir, 'c-skills-after-restart');
    if (cState.modePillPresent) throw new Error('[m3] (c) mode pill resurrected');
    const offRestart = cState.rows?.filter((r) => !r.chipPressed).map((r) => r.slug) ?? [];
    for (const slug of togglesPicked) {
      if (!offRestart.includes(slug)) throw new Error(`[m3] (c) ${slug} should still be off after restart`);
    }
    console.log('[m3] PASS — all 3 states verified');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m3] done');
}

main().catch((err) => { console.error('[m3] FATAL', err); process.exit(1); });
