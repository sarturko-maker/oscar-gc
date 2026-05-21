#!/usr/bin/env node
/**
 * Sprint M3 visual verification harness. Drives the packaged Oscar GC
 * binary through five right-pane states from the M3 brief and writes one
 * PNG per state to --out-dir.
 *
 * States captured:
 *   (a) commercial-matter-facts-loaded.png
 *   (b) privacy-programme-facts-loaded.png
 *   (c) history-shows-events.png
 *   (d) matter-md-external-edit-reflected.png
 *   (e) tom-injection-shows-in-pane.png
 *
 * Built on capture-m2.js's pattern. Differences from M2:
 *   - Pre-seeds matter.md with realistic key_facts (M3 actually renders them).
 *   - Drives a chat-input fill+Enter to generate a History event for state (c).
 *   - Appends to matter.md mid-run to validate the polled read picks it up.
 *   - Invokes matters.setActive to populate the Top of Mind block.
 *
 * Usage:
 *   bash scripts/capture-m3.sh --out-dir docs/screenshots/sprint-m3
 *
 * The capture-m3.sh wrapper provides Xvfb + onboarding-bypass env vars.
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
    captured_via: 'm3-test-harness',
    user: {
      name: 'Test Counsel',
      role: 'general-counsel',
      role_label: 'General Counsel',
    },
    corporate: { name: 'TestCo', industry: 'Software', size_band: '51-200' },
    company_context: null,
    practice_areas: [
      { id: 'commercial', name: 'Commercial', body: 'Default Commercial body', source: 'default' },
      { id: 'privacy', name: 'Privacy', body: 'Default Privacy body', source: 'default' },
      { id: 'ip', name: 'IP', body: 'Default IP body', source: 'default' },
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
      `packaged binary not found at ${PACKAGED_BINARY} — run \`./node_modules/.bin/electron-forge make --targets=@electron-forge/maker-zip\` first`,
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
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oscar__panel-section')).map(
      (el) => el.dataset.sectionId,
    ),
  );
  // Also surface the rendered first-row label of MatterFacts/ProgrammeFacts
  // so the harness audit shows the body actually rendered.
  const firstFactRow = await page.evaluate(() => {
    const section = document.querySelector(
      '[data-section-id="MatterFacts"], [data-section-id="ProgrammeFacts"]',
    );
    if (!section) return null;
    const dt = section.querySelector('.oscar__panel-section-dl-row dt');
    const dd = section.querySelector('.oscar__panel-section-dl-row dd');
    if (!dt || !dd) return null;
    return `${dt.textContent}: ${dd.textContent}`;
  });
  console.log(
    `[m3] ${slug}.png (${bytes} bytes) sections=[${ids.join(',')}] firstFact=${JSON.stringify(firstFactRow)}`,
  );
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
    stakeholder: 'Acme account',
    privileged: false,
    key_facts:
      '- 3-year term ending Q2 2027\n- Auto-renews unless 90-day notice given\n- Indemnity capped at fees paid in last 12 months',
  },
  {
    areaId: 'privacy',
    slug: 'acme-vendor-dpa',
    name: 'Acme Vendor DPA Review',
    kind: 'vendor_dpa',
    subject: { type: 'processing_activity', label: 'Salesforce vendor DPA' },
    counterparty: { role: 'processor', name: 'Salesforce' },
    stakeholder: 'Salesforce',
    privileged: false,
    key_facts:
      '- EU SCCs Module 2 attached\n- Sub-processor list refreshed Q1\n- Transfer impact assessment due',
  },
  {
    areaId: 'ip',
    slug: 'forge-mark-eu',
    name: 'Forge mark — EU filing',
    kind: 'filing',
    subject: { type: 'mark', label: 'Forge word mark' },
    counterparty: null,
    stakeholder: 'Forge brand family',
    privileged: false,
    key_facts:
      '- Classes 9 + 42\n- EU-wide filing\n- Pre-existing US mark accepted',
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
    console.error(
      `[m3] openMatter ${areaId}/${matterName} never navigated. diag:`,
      JSON.stringify(diag, null, 2),
    );
    throw err;
  }
  await page.waitForSelector('.oscar__right-pane-toggle', { timeout: 10000 });
  // MatterFacts polls every 2 s; wait for its first read to land.
  await page.waitForFunction(
    () =>
      document.querySelector(
        '.oscar__panel-section-dl-row, .oscar__panel-section-history',
      ) !== null,
    { timeout: 15000 },
  );
  await page.waitForTimeout(600);
}

async function sendChatTurn(page, message) {
  // ChatSessionsContainer keeps every opened session mounted (AppLayout.tsx
  // toggles visibility with .hidden, doesn't unmount), so the strict-mode
  // matcher hits multiple chat-input textareas after a re-open. Narrow with
  // :visible to grab the currently displayed one.
  const input = page.locator('[data-testid="chat-input"]:visible').first();
  await input.waitFor({ state: 'visible', timeout: 10000 });
  await input.fill(message);
  await input.press('Enter');
  // Give the SSE reply endpoint time to persist the user turn.
  // The History section polls every 2 s; one tick is enough to surface it.
  await page.waitForTimeout(2500);
}

async function appendKeyFact(seed, extraFact) {
  // Mirrors how a lawyer would edit matter.md in Finder/Files.
  const workingDir = path.join(
    OSCAR_DOCS,
    displayAreaName(seed.areaId),
    safeFilesystemName(seed.name, seed.slug),
  );
  const matterMdPath = path.join(workingDir, 'matter.md');
  const existing = fs.readFileSync(matterMdPath, 'utf8');
  const patched = existing.replace(
    /## Key facts\n+([\s\S]*?)(?=\n## )/,
    (_match, body) => `## Key facts\n\n${body.trim()}\n- ${extraFact}\n`,
  );
  fs.writeFileSync(matterMdPath, patched, 'utf8');
}

function displayAreaName(areaId) {
  const map = {
    commercial: 'Commercial',
    privacy: 'Privacy',
    ip: 'IP',
  };
  return map[areaId] ?? areaId;
}

function safeFilesystemName(name, fallback) {
  const cleaned = name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
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

  console.log('[m3] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m3] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m3] seed Commercial + Privacy + IP matters (with key facts)');
    await seedMatters(page);

    console.log('[m3] (a) Commercial — MatterFacts shows the seeded subject/counterparty/kind/facts');
    await openMatter(page, 'commercial', 'Test MSA Renewal');
    await shot(page, args.outDir, 'commercial-matter-facts-loaded');

    console.log('[m3] (b) Privacy — ProgrammeFacts shows the seeded shape (before chat-driven states busy the session)');
    await openMatter(page, 'privacy', 'Acme Vendor DPA Review');
    await shot(page, args.outDir, 'privacy-programme-facts-loaded');

    console.log('[m3] back to Commercial for chat-driven states');
    await openMatter(page, 'commercial', 'Test MSA Renewal');

    console.log('[m3] (c) drive a chat turn → History shows ≥1 event');
    await sendChatTurn(page, 'Hello — sprint M3 history seed message.');
    await shot(page, args.outDir, 'history-shows-events');

    console.log('[m3] (d) external edit to matter.md → pane reflects after the next poll');
    await appendKeyFact(MATTER_SEEDS[0], 'Late-added fact: SLA credits unchanged');
    await page.waitForTimeout(2500);
    await shot(page, args.outDir, 'matter-md-external-edit-reflected');

    console.log('[m3] (e) matters.setActive → Top of Mind block surfaces in MatterFacts');
    await page.evaluate(async () => {
      await window.electron.matters.setActive('commercial', 'test-msa-renewal');
    });
    // The MatterFacts poll picks up the tom file on the next tick (≤2 s).
    await page.waitForTimeout(2500);
    // Expand the tom block so it's visible in the PNG.
    await page.evaluate(() => {
      const btn = document.querySelector('.oscar__panel-section-tom-toggle');
      if (btn) btn.click();
    });
    await page.waitForTimeout(500);
    await shot(page, args.outDir, 'tom-injection-shows-in-pane');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m3] done — 5 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m3] FAILED:', err);
  process.exit(1);
});
