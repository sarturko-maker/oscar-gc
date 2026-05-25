#!/usr/bin/env node
/**
 * Sprint 29 M1 — Skills toggle bug fix verification.
 *
 * Sprint 28 M3 only exercised the `mode: 'all' → first toggle` path. The
 * `mode: 'allow'` migration was untested and silently inverted every
 * other slug's meaning on first toggle. This harness seeds the missing
 * starting state and asserts the fix.
 *
 * States captured:
 *   (a) skills-allow-mode-seeded.png — Commercial matter with profile
 *       seeded as { mode: 'allow', slugs: [<first skill slug>] }; only
 *       that one slug renders On.
 *   (b) skills-second-toggled-on.png — toggle the SECOND row On. Bug
 *       would flip every other slug On too; fix preserves the rest as
 *       Off. profile.json stays mode='allow', slugs=[first, second].
 *
 * Usage: bash scripts/capture-sprint29-m1.sh --out-dir docs/screenshots/sprint-29-m1
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
    captured_via: 'sprint29-m1-test-harness',
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
function writeProfile(p) {
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(p, null, 2), { mode: 0o600 });
}
function getEnabledSkills(profile, areaId) {
  return profile?.practice_areas?.find((a) => a.id === areaId)?.area_overrides?.enabled_skills ?? null;
}
function setEnabledSkills(profile, areaId, value) {
  const areas = profile.practice_areas.map((a) => {
    if (a.id !== areaId) return a;
    const overrides = a.area_overrides ?? {};
    return { ...a, area_overrides: { ...overrides, enabled_skills: value } };
  });
  return { ...profile, practice_areas: areas };
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

async function shot(page, outDir, slug, extras = {}) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const rows = await skillsRows(page);
  const profile = (() => { try { return readProfile(); } catch { return null; } })();
  const enabledSkills = getEnabledSkills(profile, 'commercial');
  console.log(
    `[m1] ${slug}.png (${bytes}B) hash=${hash} enabledSkills=${JSON.stringify(enabledSkills)} rows=${rows ? rows.map((r) => `${r.slug}=${r.chipText}`).join(',') : 'null'} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
  );
  return { rows };
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

async function backToHub(page) {
  // navigate explicitly to clear the bound matter, so re-opening picks up
  // the freshly-mutated profile.json.
  await setRoute(page, '#/');
  await page.waitForTimeout(800);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

const MATTER = {
  slug: 'test-allow-mode-bug',
  name: 'Test Allow Mode Bug',
  kind: 'msa',
  subject: { type: 'contract', label: 'Acme MSA' },
  counterparty: { role: 'customer', name: 'Acme Corp' },
  stakeholder: 'Acme account',
  privileged: false,
  key_facts: '- Sprint 29 M1 allow-mode toggle exercise',
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m1] preflight cleanup + seed profile');
  preflightCleanup(); seedProfile();

  console.log('[m1] launch app (pass 1) — discover Commercial skill slugs');
  let { appProcess, browser, page } = await launchApp(args.debugPort);

  let firstSlug, secondSlug;
  try {
    await createMatter(page, 'commercial', MATTER);
    await openMatter(page, 'commercial', 'Test Allow Mode Bug');
    const initial = await shot(page, args.outDir, '0-discover-default-all-on');
    if (!initial.rows || initial.rows.length < 3) {
      throw new Error('[m1] need >=3 skills for a meaningful test');
    }
    firstSlug = initial.rows[0].slug;
    secondSlug = initial.rows[1].slug;
    console.log(`[m1] picked first=${firstSlug} second=${secondSlug}`);

    console.log('[m1] mutate profile.json → mode=allow, slugs=[first]');
    await shutdown(browser, appProcess);
    const profile = readProfile();
    const seeded = setEnabledSkills(profile, 'commercial', {
      mode: 'allow', slugs: [firstSlug],
    });
    writeProfile(seeded);

    console.log('[m1] launch app (pass 2) — verify allow-mode renders');
    ({ appProcess, browser, page } = await launchApp(args.debugPort));
    await openMatter(page, 'commercial', 'Test Allow Mode Bug');
    const aState = await shot(page, args.outDir, 'a-skills-allow-mode-seeded');
    if (!aState.rows) throw new Error('[m1] (a) skills-list absent');
    const onAfterSeed = aState.rows.filter((r) => r.chipPressed).map((r) => r.slug);
    if (onAfterSeed.length !== 1 || onAfterSeed[0] !== firstSlug) {
      throw new Error(`[m1] (a) expected only ${firstSlug} On; got ${JSON.stringify(onAfterSeed)}`);
    }

    console.log(`[m1] toggle ${secondSlug} On (Sprint 28 bug would flip ALL Off slugs On)`);
    const tres = await toggleSkill(page, 'commercial', secondSlug, true);
    if (!tres.ok) throw new Error(`[m1] toggle failed: ${JSON.stringify(tres)}`);
    await page.waitForTimeout(2500);
    const bState = await shot(page, args.outDir, 'b-skills-second-toggled-on');
    const onAfterToggle = bState.rows?.filter((r) => r.chipPressed).map((r) => r.slug) ?? [];
    if (onAfterToggle.length !== 2) {
      throw new Error(
        `[m1] (b) BUG: expected exactly 2 skills On; got ${onAfterToggle.length}: ${JSON.stringify(onAfterToggle)}`,
      );
    }
    if (!onAfterToggle.includes(firstSlug) || !onAfterToggle.includes(secondSlug)) {
      throw new Error(`[m1] (b) On set wrong: ${JSON.stringify(onAfterToggle)}`);
    }
    const profileAfter = readProfile();
    const enabledSkills = getEnabledSkills(profileAfter, 'commercial');
    if (!enabledSkills || enabledSkills.mode !== 'allow') {
      throw new Error(`[m1] (b) ADR-094: mode should be preserved as 'allow'; got ${JSON.stringify(enabledSkills)}`);
    }
    const sortedExpected = [firstSlug, secondSlug].sort();
    const sortedGot = [...(enabledSkills.slugs ?? [])].sort();
    if (sortedExpected.join('|') !== sortedGot.join('|')) {
      throw new Error(`[m1] (b) profile slugs mismatch: expected ${JSON.stringify(sortedExpected)} got ${JSON.stringify(sortedGot)}`);
    }
    console.log('[m1] PASS — allow-mode toggle preserves shape; bug fixed');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m1] done');
}

main().catch((err) => { console.error('[m1] FATAL', err); process.exit(1); });
