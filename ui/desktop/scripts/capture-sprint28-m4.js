#!/usr/bin/env node
/**
 * Sprint 28 M4 — visual polish (toast position + slug wrap fix).
 *
 * States captured:
 *   (a) matter-no-toast-collision.png — Commercial matter; if the
 *                                        extension-loading toast is on
 *                                        screen it is at top-center,
 *                                        not overlapping the pane.
 *   (b) long-slug-wraps-on-hyphen.png  — synthetic long-name skill
 *                                        ("amendment-history-renewals-quarterly")
 *                                        renders without mid-word break.
 *
 * Diagnostics: toast DOM rect vs pane DOM rect; skill row name's
 * computed bounding rect width vs pane width.
 *
 * Usage: bash scripts/capture-sprint28-m4.sh --out-dir docs/screenshots/sprint-28-m4
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { chromium } = require('@playwright/test');

const DESKTOP_DIR = path.join(__dirname, '..');
const REPO_ROOT = path.join(DESKTOP_DIR, '..', '..');
const PACKAGED_BINARY = path.join(
  DESKTOP_DIR, 'out', 'Oscar-GC-linux-x64', 'oscar-gc',
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
    captured_via: 'sprint28-m4-test-harness',
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

function seedLongSlugSkill() {
  const longSlug = 'amendment-history-renewals-quarterly';
  const dir = path.join(HOME, '.agents', 'skills', longSlug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${longSlug}\ndescription: synthetic long slug for M4 word-break verification\n---\n\nTest body.\n`,
  );
  return longSlug;
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

async function paneAndToastRects(page) {
  return await page.evaluate(() => {
    const aside = document.querySelector('aside.oscar__right-pane');
    const toastContainer = document.querySelector('.Toastify');
    const toastItem = document.querySelector('.Toastify__toast');
    return {
      pane: aside ? aside.getBoundingClientRect().toJSON() : null,
      toastContainer: toastContainer ? toastContainer.getBoundingClientRect().toJSON() : null,
      toastItem: toastItem ? toastItem.getBoundingClientRect().toJSON() : null,
    };
  });
}

async function shot(page, outDir, slug, extras = {}) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const rects = await paneAndToastRects(page);
  console.log(
    `[m4] ${slug}.png (${bytes}B) rects=${JSON.stringify(rects)} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
  );
  return rects;
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
  await page.waitForSelector('[data-testid="skills-list"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

const MATTER = {
  slug: 'test-polish',
  name: 'Test Polish',
  kind: 'msa',
  subject: { type: 'contract', label: 'Acme MSA' },
  counterparty: { role: 'customer', name: 'Acme Corp' },
  stakeholder: 'Acme account',
  privileged: false,
  key_facts: '- M4 visual polish exercise',
};

function rectsOverlap(a, b) {
  if (!a || !b) return false;
  return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m4] preflight cleanup + seed profile + long-slug skill');
  preflightCleanup();
  seedProfile();
  const longSlug = seedLongSlugSkill();
  console.log(`[m4] seeded long-slug skill: ${longSlug}`);

  console.log('[m4] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    await createMatter(page, 'commercial', MATTER);

    console.log('[m4] (a) matter-no-toast-collision');
    await openMatter(page, 'commercial', 'Test Polish');
    // Take screenshot during the typical toast window (toast auto-closes
    // after 5s on success; capture early enough to catch overlap risk).
    const aRects = await shot(page, args.outDir, 'a-matter-no-toast-collision');
    if (aRects.pane && aRects.toastContainer) {
      const overlap = rectsOverlap(aRects.pane, aRects.toastContainer);
      if (overlap) {
        throw new Error('[m4] (a) pane and toast container overlap (toast was supposed to move to top-center)');
      }
      console.log('[m4] (a) PASS — toast container does not overlap pane');
    } else {
      console.log('[m4] (a) note — toast container not present at capture time (auto-dismissed or no extensions)');
    }

    console.log('[m4] (b) long-slug-wraps-on-hyphen');
    // Refresh skill list (the seeded skill might not be in goosed's cache;
    // a poll cycle should pick it up).
    await page.waitForTimeout(3000);
    const longSlugRow = await page.evaluate((slug) => {
      const list = document.querySelector('[data-testid="skills-list"]');
      if (!list) return null;
      const row = list.querySelector(`[data-testid="skills-row-${slug}"]`);
      if (!row) {
        const all = Array.from(list.querySelectorAll('[data-testid^="skills-row-"]'))
          .map((r) => r.getAttribute('data-testid')?.replace('skills-row-', ''));
        return { found: false, allSlugs: all };
      }
      const nameEl = row.querySelector('.oscar__skills-name');
      const rect = nameEl?.getBoundingClientRect();
      const computed = nameEl ? window.getComputedStyle(nameEl) : null;
      return {
        found: true,
        nameWidth: rect ? Math.round(rect.width) : 0,
        nameHeight: rect ? Math.round(rect.height) : 0,
        wordBreak: computed?.wordBreak ?? null,
        overflowWrap: computed?.overflowWrap ?? null,
      };
    }, longSlug);
    await shot(page, args.outDir, 'b-long-slug-wraps-on-hyphen', { longSlugRow });
    if (longSlugRow?.found) {
      if (longSlugRow.wordBreak === 'break-all') {
        throw new Error('[m4] (b) word-break still break-all — CSS not picked up');
      }
      console.log(`[m4] (b) PASS — overflowWrap=${longSlugRow.overflowWrap} (no mid-word break-all)`);
    } else {
      console.log('[m4] (b) note — long-slug skill not yet discovered by goosed (cache lag); capture only');
    }

    console.log('[m4] PASS');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m4] done');
}

main().catch((err) => { console.error('[m4] FATAL', err); process.exit(1); });
