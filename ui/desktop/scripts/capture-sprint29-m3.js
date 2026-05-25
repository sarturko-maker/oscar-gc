#!/usr/bin/env node
/**
 * Sprint 29 M3 — Skills row presentation matches Tools.
 *
 * States captured:
 *   (a) skills-humanized-titles.png — Commercial matter, each Skill row
 *       shows a humanised title (NDA Review, SaaS MSA Review,
 *       Amendment History, ...), not the kebab-slug. The slug remains
 *       addressable on the row's `title` attribute.
 *
 * Diagnostics: per-row display text + title-attribute slug + computed
 * font-family (must be sans-editorial, not monospace).
 *
 * Usage: bash scripts/capture-sprint29-m3.sh --out-dir docs/screenshots/sprint-29-m3
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
    captured_via: 'sprint29-m3-test-harness',
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

async function skillsRowDetails(page) {
  return await page.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid^="skills-row-"]');
    return Array.from(rows).map((row) => {
      const slug = row.getAttribute('data-testid')?.replace('skills-row-', '') ?? '';
      const titleAttr = row.getAttribute('title') ?? '';
      const nameEl = row.querySelector('.oscar__skills-name');
      const computed = nameEl
        ? getComputedStyle(nameEl).fontFamily
        : '';
      return {
        slug,
        displayName: nameEl?.textContent ?? '',
        titleAttr,
        nameFontFamily: computed,
      };
    });
  });
}

async function shot(page, outDir, slug) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const rows = await skillsRowDetails(page);
  console.log(
    `[m3] ${slug}.png (${bytes}B) hash=${hash} rows=${JSON.stringify(rows.map((r) => ({ slug: r.slug, displayName: r.displayName, title: r.titleAttr })))} sampleFont=${rows[0]?.nameFontFamily ?? 'n/a'}`,
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m3] preflight cleanup + seed profile');
  preflightCleanup(); seedProfile();

  console.log('[m3] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    await createMatter(page, 'commercial', {
      slug: 'test-skills-clarity', name: 'Test Skills Clarity', kind: 'msa',
      subject: { type: 'contract', label: 'Acme MSA' },
      counterparty: { role: 'customer', name: 'Acme Corp' },
      stakeholder: 'Acme account', privileged: false,
      key_facts: '- M3 humanised-title exercise',
    });
    await openMatter(page, 'commercial', 'Test Skills Clarity');
    const state = await shot(page, args.outDir, 'a-skills-humanized-titles');

    if (!state.rows || state.rows.length === 0) throw new Error('[m3] no skill rows');

    const expectedFromSlug = {
      'nda-review': 'NDA Review',
      'saas-msa-review': 'SaaS MSA Review',
      'amendment-history': 'Amendment History',
      'escalation-flagger': 'Escalation Flagger',
      'renewal-tracker': 'Renewal Tracker',
      'vendor-agreement-review': 'Vendor Agreement Review',
      'review': 'Review',
      'review-proposals': 'Review Proposals',
      'stakeholder-summary': 'Stakeholder Summary',
    };
    for (const row of state.rows) {
      if (row.slug === row.displayName) {
        throw new Error(`[m3] row "${row.slug}" still renders slug as display name`);
      }
      if (row.titleAttr !== row.slug) {
        throw new Error(`[m3] row title attribute should equal slug; got "${row.titleAttr}" for "${row.slug}"`);
      }
      const want = expectedFromSlug[row.slug];
      if (want && row.displayName !== want) {
        throw new Error(`[m3] expected "${want}" for ${row.slug}; got "${row.displayName}"`);
      }
      // Computed font-family should NOT include "mono".
      if (/mono/i.test(row.nameFontFamily)) {
        throw new Error(`[m3] row "${row.slug}" name still rendered in monospace: ${row.nameFontFamily}`);
      }
    }
    console.log('[m3] PASS — humanised titles + sans body + slug-on-title-attr');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m3] done');
}

main().catch((err) => { console.error('[m3] FATAL', err); process.exit(1); });
