#!/usr/bin/env node
/**
 * Sprint M2 visual verification harness. Drives the packaged Oscar GC
 * binary through five right-pane states from the M2 brief and writes one
 * PNG per state to --out-dir.
 *
 * Built on capture-m1.js's pattern. Differences:
 *   - Pre-seeds profile.json with Commercial + Privacy + IP practice areas.
 *   - Seeds one matter per area via window.electron.matters.create.
 *   - Mid-run mutation: between launches, writes area_overrides to profile.json
 *     on disk to prove the M0 surface is consumed by M2.
 *
 * Usage:
 *   bash scripts/capture-m2.sh --out-dir docs/screenshots/sprint-m2
 *
 * The capture-m2.sh wrapper provides Xvfb + onboarding-bypass env vars.
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

function seedProfile(overrides) {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'm2-test-harness',
    user: {
      name: 'Test Counsel',
      role: 'general-counsel',
      role_label: 'General Counsel',
    },
    corporate: { name: 'TestCo', industry: 'Software', size_band: '51-200' },
    company_context: null,
    practice_areas: [
      {
        id: 'commercial',
        name: 'Commercial',
        body: 'Default Commercial body',
        source: 'default',
        ...(overrides?.commercial ? { area_overrides: overrides.commercial } : {}),
      },
      {
        id: 'privacy',
        name: 'Privacy',
        body: 'Default Privacy body',
        source: 'default',
      },
      {
        id: 'ip',
        name: 'IP',
        body: 'Default IP body',
        source: 'default',
      },
    ],
    provider: { kind: 'minimax', model: 'MiniMax-M2.5' },
  };
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(profile, null, 2), { mode: 0o600 });
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
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`);
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
  // Log section IDs visible at capture time so the harness audit shows what
  // shape the pane rendered.
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oscar__panel-section')).map(
      (el) => el.dataset.sectionId,
    ),
  );
  console.log(`[m2] ${slug}.png (${bytes} bytes) sections=[${ids.join(',')}]`);
}

async function setRoute(page, hash) {
  await page.evaluate((h) => {
    window.location.hash = h;
  }, hash);
  await page.waitForFunction((h) => window.location.hash === h, hash, {
    timeout: 5000,
  });
  await page.waitForTimeout(500);
}

const MATTER_SEEDS = [
  {
    areaId: 'commercial',
    slug: 'test-msa-renewal',
    name: 'Test MSA Renewal',
    kind: 'msa',
    subject: { type: 'contract', label: 'Acme Master Services Agreement' },
    counterparty: { role: 'customer', name: 'Acme Corp' },
    stakeholder: null,
    privileged: false,
    key_facts: '',
  },
  {
    areaId: 'privacy',
    slug: 'acme-vendor-dpa',
    name: 'Acme Vendor DPA Review',
    kind: 'vendor_dpa',
    subject: { type: 'processing_activity', label: 'Salesforce vendor DPA' },
    counterparty: { role: 'processor', name: 'Salesforce' },
    stakeholder: null,
    privileged: false,
    key_facts: '',
  },
  {
    areaId: 'ip',
    slug: 'forge-mark-eu',
    name: 'Forge mark — EU filing',
    kind: 'filing',
    subject: { type: 'mark', label: 'Forge word mark' },
    counterparty: null,
    stakeholder: null,
    privileged: false,
    key_facts: '',
  },
];

async function seedMatters(page) {
  for (const seed of MATTER_SEEDS) {
    const { areaId, ...rest } = seed;
    await page.evaluate(
      async ([area, input]) => {
        await window.electron.matters.create(area, input);
      },
      [areaId, rest],
    );
  }
}

async function dismissRecipeSecretsIfShown(page) {
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

async function openMatter(page, areaId, matterName) {
  await setRoute(page, `#/practice/${areaId}`);
  await page.waitForTimeout(800);
  const matterButton = page.getByRole('button', { name: new RegExp(matterName, 'i') });
  await matterButton.first().waitFor({ state: 'visible', timeout: 10000 });
  await matterButton.first().click();
  await page.waitForTimeout(800);
  await dismissRecipeSecretsIfShown(page);
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
    console.error(`[m2] openMatter ${areaId}/${matterName} never navigated. diag:`, JSON.stringify(diag, null, 2));
    throw err;
  }
  await page.waitForSelector('.oscar__right-pane-toggle', { timeout: 10000 });
  // Wait for the section stack to materialize (useActiveAreaSections resolves
  // async via useOscarProfile read).
  await page.waitForFunction(
    () => document.querySelectorAll('.oscar__panel-section').length > 0,
    { timeout: 10000 },
  );
  await page.waitForTimeout(600);
}

async function clickToggle(page) {
  const result = await page.evaluate(() => {
    const btn = document.querySelector('.oscar__right-pane-toggle');
    if (!btn) return { clicked: false, reason: 'no .oscar__right-pane-toggle' };
    btn.click();
    return { clicked: true };
  });
  if (!result.clicked) throw new Error(`toggle click failed: ${result.reason}`);
  await page.waitForTimeout(1000);
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

  console.log('[m2] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m2] launch #1 (fresh state, no overrides)');
  let { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m2] seed Commercial + Privacy + IP matters');
    await seedMatters(page);

    console.log('[m2] (a) Commercial default — expect 4 stubs');
    await openMatter(page, 'commercial', 'Test MSA Renewal');
    await shot(page, args.outDir, 'commercial-sections-default');

    console.log('[m2] (b) Privacy default — expect 4 different stubs');
    await openMatter(page, 'privacy', 'Acme Vendor DPA Review');
    await shot(page, args.outDir, 'privacy-sections-default');

    console.log('[m2] (c) IP default — expect 3 stubs');
    await openMatter(page, 'ip', 'Forge mark');
    await shot(page, args.outDir, 'ip-sections-default');

    console.log('[m2] (e) Collapse on IP matter — rail still 32px');
    await clickToggle(page);
    await shot(page, args.outDir, 'collapsed-still-respects-rail');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m2] mutate profile.json — splice area_overrides on Commercial');
  // Reseed completely (the Settings file persists isRightPaneExpanded=false
  // from the collapse step, which is fine for state d as long as it's
  // explicitly set back — actually overridden Commercial reads the matter-
  // bound route default, which is true. But the sticky boolean from step e
  // would now hold "false". Reset sticky boolean back to null so the route
  // default re-wins for state d.).
  seedProfile({
    commercial: { panel_sections: ['Skills', 'Playbooks'] },
  });
  // Drop sticky right-pane state so the override-test pane opens via route
  // default rather than carrying step (e)'s explicit-false.
  try {
    const settings = JSON.parse(fs.readFileSync(ELECTRON_SETTINGS, 'utf8'));
    if (settings && Object.prototype.hasOwnProperty.call(settings, 'isRightPaneExpanded')) {
      delete settings.isRightPaneExpanded;
      fs.writeFileSync(ELECTRON_SETTINGS, JSON.stringify(settings, null, 2), { mode: 0o600 });
    }
  } catch {
    /* settings missing — fine */
  }

  console.log('[m2] launch #2 (with override on Commercial)');
  ({ appProcess, browser, page } = await launchApp(args.debugPort));
  try {
    console.log('[m2] (d) Commercial overridden — expect 2 stubs in override order');
    await openMatter(page, 'commercial', 'Test MSA Renewal');
    await shot(page, args.outDir, 'commercial-sections-overridden');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m2] done — 5 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m2] FAILED:', err);
  process.exit(1);
});
