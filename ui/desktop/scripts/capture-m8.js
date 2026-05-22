#!/usr/bin/env node
/**
 * Sprint M8 visual verification harness. Drives the packaged Oscar GC
 * binary through the five Forge Mode E (delete area) states from the
 * M8 brief.
 *
 * States captured (deterministic; no live LLM turn):
 *   (a) sandbox-area-seeded.png        — test-target area present in
 *                                        profile.json; matter + integration
 *                                        + override seeded; landing visible
 *   (b) modal-fires-on-marker.png      — write marker file via fs; the
 *                                        DeleteAreaConfirm modal appears
 *                                        within ~500ms with correct counts
 *   (c) archive-confirmed.png          — click Archive; modal clears,
 *                                        profile.json no longer contains
 *                                        test-target, archive dir exists
 *   (d) cancel-keeps-area.png          — re-seed; click Cancel; marker
 *                                        gone, profile unchanged, no new
 *                                        archive dir from this turn
 *   (e) stale-marker-dropped.png       — write marker with timestamp 10s
 *                                        old; modal does NOT fire; the
 *                                        marker remains on disk
 *
 * Cloned from capture-m7.js with M8-specific changes:
 *   - preflightCleanup() also wipes ~/.config/oscar/state/_archive/ and
 *     any _forge_request_delete_*.json markers.
 *   - seedProfile() adds a user-added test-target practice area.
 *   - Marker file written directly via fs to simulate Forge's
 *     oscar-fs__write_file output — same end-state on disk.
 *
 * Usage:
 *   bash scripts/capture-m8.sh --out-dir docs/screenshots/sprint-m8
 *
 * The capture-m8.sh wrapper provides Xvfb + onboarding-bypass env vars.
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
const OSCAR_ARCHIVE = path.join(OSCAR_STATE, '_archive');
const OSCAR_TOM = path.join(OSCAR_CONFIG, 'tom-active-matter.md');
const OSCAR_PLAYBOOKS = path.join(OSCAR_CONFIG, 'playbooks');
const OSCAR_DOCS = path.join(HOME, 'Documents', 'Oscar GC');
const ELECTRON_USERDATA = path.join(HOME, '.config', 'Oscar GC');
const ELECTRON_SETTINGS = path.join(ELECTRON_USERDATA, 'settings.json');
const USER_SKILLS_DIR = path.join(HOME, '.agents', 'skills');

const TARGET_AREA_ID = 'test-target';
const TARGET_AREA_NAME = 'Test Target';

const markerPathFor = (areaId) =>
  path.join(OSCAR_CONFIG, `_forge_request_delete_${areaId}.json`);

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
  rmRfSafe(OSCAR_PROFILE_BAK);
  rmRfSafe(OSCAR_STATE);
  rmRfSafe(OSCAR_TOM);
  rmRfSafe(OSCAR_PLAYBOOKS);
  rmRfSafe(OSCAR_DOCS);
  rmRfSafe(ELECTRON_SETTINGS);
  try {
    const entries = fs.readdirSync(OSCAR_CONFIG, { withFileTypes: true });
    for (const e of entries) {
      if (e.isFile() && /^_forge_request_delete_.+\.json$/.test(e.name)) {
        rmRfSafe(path.join(OSCAR_CONFIG, e.name));
      }
    }
  } catch {
    /* dir absent — fine */
  }
  try {
    const entries = fs.readdirSync(USER_SKILLS_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (e.isDirectory() && e.name.startsWith('test-')) {
        rmRfSafe(path.join(USER_SKILLS_DIR, e.name));
      }
    }
  } catch {
    /* dir absent — fine */
  }
}

function seedProfileWithTarget() {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'm8-test-harness',
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
      {
        id: TARGET_AREA_ID,
        name: TARGET_AREA_NAME,
        body: 'M8 harness sandbox area — created to be archived.',
        source: 'user-added',
        bundled_skill_sources: [],
        entry_noun: { singular: 'Matter', plural: 'Matters' },
        area_overrides: {
          description_override:
            'This is the sandbox area that the M8 harness archives.',
        },
      },
    ],
    provider: { kind: 'minimax', model: 'MiniMax-M2.5' },
  };
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(profile, null, 2), { mode: 0o600 });
}

function seedTargetState() {
  // Matters registry for test-target.
  const stateDir = path.join(OSCAR_STATE, TARGET_AREA_ID);
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(
    path.join(stateDir, 'matters.json'),
    JSON.stringify(
      {
        schema_version: 2,
        matters: {
          'test-sandbox-matter': {
            slug: 'test-sandbox-matter',
            name: 'Test Sandbox Matter',
            area_id: TARGET_AREA_ID,
            kind: 'msa',
            status: 'open',
            session_id: null,
            created_at: new Date().toISOString(),
          },
        },
      },
      null,
      2,
    ),
  );
  // Installed integrations for test-target.
  fs.writeFileSync(
    path.join(stateDir, 'installed_integrations.json'),
    JSON.stringify(
      {
        schema_version: 1,
        installed_integrations: [
          { id: 'Google Drive', installed_at: new Date().toISOString() },
        ],
      },
      null,
      2,
    ),
  );
  // Documents folder for test-target — should survive the archive.
  const docsDir = path.join(OSCAR_DOCS, TARGET_AREA_NAME);
  fs.mkdirSync(docsDir, { recursive: true });
  fs.writeFileSync(
    path.join(docsDir, 'placeholder.txt'),
    'M8 harness — user content survives delete.',
  );
}

function readProfile() {
  return JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
}

function writeMarker(areaId, opts = {}) {
  const ts = opts.timestamp ?? new Date().toISOString();
  const impact = opts.impact ?? {
    matterCount: 1,
    integrationCount: 1,
    overrideKeys: ['description_override'],
  };
  fs.writeFileSync(
    markerPathFor(areaId),
    JSON.stringify({ areaId, timestamp: ts, impact }, null, 2),
  );
}

function archiveDirsForArea(areaId) {
  try {
    return fs
      .readdirSync(OSCAR_ARCHIVE, { withFileTypes: true })
      .filter((e) => e.isDirectory() && e.name.startsWith(`${areaId}-`))
      .map((e) => path.join(OSCAR_ARCHIVE, e.name));
  } catch {
    return [];
  }
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

async function shot(page, outDir, slug, extras = {}) {
  const outPath = path.join(outDir, `${slug}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  const bytes = fs.statSync(outPath).size;
  const hash = await page.evaluate(() => window.location.hash);
  const profile = (() => {
    try {
      return JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
    } catch {
      return null;
    }
  })();
  const areaIds = profile?.practice_areas?.map((a) => a.id) ?? [];
  const archives = archiveDirsForArea(TARGET_AREA_ID).map((p) =>
    path.basename(p),
  );
  console.log(
    `[m8] ${slug}.png (${bytes} bytes) route=${hash} areaIds=${JSON.stringify(areaIds)} archives=${JSON.stringify(archives)} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
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

async function isModalPresent(page) {
  return await page.evaluate(() => {
    return !!document.querySelector('[data-testid="delete-area-confirm"]');
  });
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

  console.log('[m8] preflight cleanup + seed profile + seed target state');
  preflightCleanup();
  seedProfileWithTarget();
  seedTargetState();

  console.log('[m8] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    await page.waitForTimeout(1500);

    // (a) Sandbox seeded — landing visible, target area in sidebar
    console.log('[m8] (a) sandbox-area-seeded');
    await setRoute(page, `#/practice/${TARGET_AREA_ID}`);
    await page.waitForTimeout(1500);
    const seedDiagText = await page.evaluate(() => {
      const profile = window.__forM8Diag ?? null;
      return profile;
    });
    const profileSnapshot = readProfile();
    const targetEntry = profileSnapshot.practice_areas.find(
      (a) => a.id === TARGET_AREA_ID,
    );
    if (!targetEntry) {
      throw new Error('[m8] (a) test-target missing from seeded profile.json');
    }
    if (await isModalPresent(page)) {
      throw new Error('[m8] (a) modal unexpectedly present on cold open');
    }
    await shot(page, args.outDir, 'sandbox-area-seeded', {
      seedDiag: seedDiagText ?? null,
      targetHasOverride: !!targetEntry.area_overrides?.description_override,
    });

    // (b) Modal fires on marker write
    console.log('[m8] (b) modal-fires-on-marker — write marker via fs');
    writeMarker(TARGET_AREA_ID);
    let modalAppeared = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await isModalPresent(page)) {
        modalAppeared = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!modalAppeared) {
      throw new Error('[m8] (b) modal did not fire within 3s of marker write');
    }
    const modalText = await page.evaluate(() => {
      const title = document.querySelector(
        '[data-testid="delete-area-confirm-title"]',
      )?.textContent;
      const matter = document.querySelector(
        '[data-testid="delete-area-confirm-matter-count"]',
      )?.textContent;
      const integration = document.querySelector(
        '[data-testid="delete-area-confirm-integration-count"]',
      )?.textContent;
      const override = document.querySelector(
        '[data-testid="delete-area-confirm-override-count"]',
      )?.textContent;
      return { title, matter, integration, override };
    });
    if (modalText.matter !== '1') {
      throw new Error(
        `[m8] (b) expected matterCount=1, got ${JSON.stringify(modalText)}`,
      );
    }
    if (modalText.integration !== '1') {
      throw new Error(
        `[m8] (b) expected integrationCount=1, got ${JSON.stringify(modalText)}`,
      );
    }
    if (modalText.override !== '1') {
      throw new Error(
        `[m8] (b) expected overrideCount=1, got ${JSON.stringify(modalText)}`,
      );
    }
    if (!modalText.title || !modalText.title.includes(TARGET_AREA_NAME)) {
      throw new Error(
        `[m8] (b) modal title missing area name. got: ${JSON.stringify(modalText)}`,
      );
    }
    await shot(page, args.outDir, 'modal-fires-on-marker', { modalText });

    // (c) Archive confirmed — click Archive button
    console.log('[m8] (c) archive-confirmed — click Archive button');
    await page.click('[data-testid="delete-area-confirm-archive"]');
    // Wait for modal to clear AND profile.json to lose the target.
    let archiveDone = false;
    for (let attempt = 0; attempt < 50; attempt++) {
      const modalGone = !(await isModalPresent(page));
      let profileSnapshot = null;
      try {
        profileSnapshot = readProfile();
      } catch {
        /* mid-rename */
      }
      const areaGone =
        profileSnapshot &&
        !profileSnapshot.practice_areas.some((a) => a.id === TARGET_AREA_ID);
      if (modalGone && areaGone) {
        archiveDone = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!archiveDone) {
      throw new Error('[m8] (c) archive flow did not complete within 5s');
    }
    const archivesAfter = archiveDirsForArea(TARGET_AREA_ID);
    if (archivesAfter.length === 0) {
      throw new Error('[m8] (c) no archive dir produced after confirm');
    }
    if (fs.existsSync(markerPathFor(TARGET_AREA_ID))) {
      throw new Error('[m8] (c) marker file still present after confirm');
    }
    // Documents folder should be UNTOUCHED.
    const docsPath = path.join(OSCAR_DOCS, TARGET_AREA_NAME);
    if (!fs.existsSync(docsPath)) {
      throw new Error('[m8] (c) Documents folder was unexpectedly deleted');
    }
    const placeholder = fs.readFileSync(
      path.join(docsPath, 'placeholder.txt'),
      'utf8',
    );
    if (!placeholder.includes('user content survives')) {
      throw new Error('[m8] (c) Documents placeholder content changed');
    }
    // Route back to home so the post-archive shot doesn't sit on the
    // gone area's landing (renders empty); give the sidebar 2.5s to
    // re-poll profile.json so it reflects the removal.
    await setRoute(page, '#/');
    await page.waitForTimeout(2500);
    await shot(page, args.outDir, 'archive-confirmed', {
      archiveDirs: archivesAfter.map((p) => path.basename(p)),
      markerGone: !fs.existsSync(markerPathFor(TARGET_AREA_ID)),
      docsSurvived: true,
    });

    // (d) Cancel keeps area — re-seed, write marker, click Cancel
    console.log('[m8] (d) cancel-keeps-area — re-seed and click Cancel');
    // Re-seed: restore the user-added area into profile.json and re-seed
    // state. The archive dir from (c) stays — we measure new archives by
    // count delta.
    const archivesBeforeCancel = archiveDirsForArea(TARGET_AREA_ID).length;
    seedProfileWithTarget();
    seedTargetState();
    // Wait for the profile-write watcher to settle on the new shape.
    await page.waitForTimeout(400);
    writeMarker(TARGET_AREA_ID);
    let cancelModalAppeared = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (await isModalPresent(page)) {
        cancelModalAppeared = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!cancelModalAppeared) {
      throw new Error('[m8] (d) modal did not re-fire on the second marker');
    }
    await page.click('[data-testid="delete-area-confirm-cancel"]');
    let cancelDone = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      const modalGone = !(await isModalPresent(page));
      const markerGone = !fs.existsSync(markerPathFor(TARGET_AREA_ID));
      if (modalGone && markerGone) {
        cancelDone = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (!cancelDone) {
      throw new Error('[m8] (d) cancel flow did not complete within 3s');
    }
    const profileAfterCancel = readProfile();
    if (!profileAfterCancel.practice_areas.some((a) => a.id === TARGET_AREA_ID)) {
      throw new Error(
        '[m8] (d) profile.json lost test-target after Cancel (should be untouched)',
      );
    }
    const archivesAfterCancel = archiveDirsForArea(TARGET_AREA_ID).length;
    if (archivesAfterCancel !== archivesBeforeCancel) {
      throw new Error(
        `[m8] (d) cancel created a new archive dir (before=${archivesBeforeCancel}, after=${archivesAfterCancel})`,
      );
    }
    await shot(page, args.outDir, 'cancel-keeps-area', {
      archivesBeforeCancel,
      archivesAfterCancel,
      areaStillPresent: true,
    });

    // (e) Stale marker dropped — write marker with old timestamp
    console.log('[m8] (e) stale-marker-dropped — 10s-old timestamp');
    const staleTs = new Date(Date.now() - 10000).toISOString();
    writeMarker(TARGET_AREA_ID, { timestamp: staleTs });
    // Watcher should log + skip. Modal must NOT appear.
    let modalFired = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      if (await isModalPresent(page)) {
        modalFired = true;
        break;
      }
      await page.waitForTimeout(100);
    }
    if (modalFired) {
      throw new Error('[m8] (e) modal fired on stale marker (should be dropped)');
    }
    // Marker remains on disk for manual cleanup.
    if (!fs.existsSync(markerPathFor(TARGET_AREA_ID))) {
      throw new Error('[m8] (e) stale marker file was unexpectedly removed');
    }
    await page.evaluate((info) => {
      const div = document.createElement('div');
      div.id = 'm8-stale-diagnostic';
      div.style.cssText = [
        'position:fixed',
        'right:8px',
        'top:8px',
        'width:520px',
        'padding:10px 12px',
        'background:#f9f3e7',
        'border:1px solid #b9824a',
        'border-radius:3px',
        'font-family:Menlo,Consolas,monospace',
        'font-size:11px',
        'color:#3e2c1f',
        'white-space:pre-wrap',
        'z-index:99999',
      ].join(';');
      div.textContent =
        'ADR-090 stale-marker drop: 10s-old marker on disk; modal not fired.\n' +
        `marker timestamp: ${info.staleTs}\n` +
        `now:              ${info.now}\n` +
        `age:              ${info.ageMs} ms\n` +
        '(>5000ms STALE_WINDOW_MS — watcher logs + skips)';
      document.body.appendChild(div);
    }, {
      staleTs,
      now: new Date().toISOString(),
      ageMs: Date.now() - new Date(staleTs).getTime(),
    });
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'stale-marker-dropped', {
      modalFired,
      markerStillOnDisk: true,
      ageMs: Date.now() - new Date(staleTs).getTime(),
    });
    // Clean up the stale marker.
    rmRfSafe(markerPathFor(TARGET_AREA_ID));
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m8] done — 5 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m8] FAILED:', err);
  process.exit(1);
});
