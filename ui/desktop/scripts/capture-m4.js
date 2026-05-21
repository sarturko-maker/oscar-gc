#!/usr/bin/env node
/**
 * Sprint M4 visual verification harness. Drives the packaged Oscar GC
 * binary through the five right-pane Playbooks states from the M4 brief
 * and writes one PNG per state to --out-dir.
 *
 * States captured:
 *   (a) playbooks-empty.png
 *   (b) playbooks-listed-mixed-scope.png
 *   (c) playbooks-always-on-toggled.png
 *   (d) playbooks-recipe-injection.png
 *   (e) playbooks-budget-warning.png
 *
 * Cloned from capture-m3.js with three M4-specific changes:
 *   - preflightCleanup() also wipes ~/.config/oscar/playbooks/.
 *   - Uses window.electron.playbooks.{upload, toggleAlwaysOn} via CDP
 *     evaluate to drive uploads + chip toggles directly.
 *   - State (d) calls window.electron.playbooks.renderBlock() and overlays
 *     the result via a temporary diagnostic element; the harness also
 *     asserts the returned block contains '## Playbooks in scope' via
 *     console.log so external runners can grep it.
 *
 * Usage:
 *   bash scripts/capture-m4.sh --out-dir docs/screenshots/sprint-m4
 *
 * The capture-m4.sh wrapper provides Xvfb + onboarding-bypass env vars.
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
  rmRfSafe(OSCAR_PLAYBOOKS);
  rmRfSafe(OSCAR_DOCS);
  rmRfSafe(ELECTRON_SETTINGS);
}

function seedProfile() {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'm4-test-harness',
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
  const playbooks = await page.evaluate(() => {
    const rows = Array.from(
      document.querySelectorAll('[data-testid^="playbooks-row-"]'),
    );
    return rows.map((r) => {
      const chip = r.querySelector('[data-testid="playbooks-always-on-toggle"]');
      const scope = r.getAttribute('data-scope');
      const name = r.querySelector('.oscar__playbooks-name')?.textContent;
      return {
        name,
        scope,
        alwaysOn: chip?.getAttribute('aria-pressed') === 'true',
      };
    });
  });
  console.log(
    `[m4] ${slug}.png (${bytes} bytes) sections=[${ids.join(',')}] playbooks=${JSON.stringify(playbooks)}`,
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
      `[m4] openMatter ${areaId}/${matterName} never navigated. diag:`,
      JSON.stringify(diag, null, 2),
    );
    throw err;
  }
  // Wait for the Playbooks section to mount.
  await page.waitForSelector('[data-section-id="Playbooks"]', { timeout: 15000 });
  await page.waitForTimeout(600);
}

async function uploadViaIpc(page, areaId, scope, filename, contentString) {
  // bytes flow through serialisation as a number[] then re-build as Uint8Array
  // on the main side. preload's ipcRenderer.invoke handles Uint8Array directly
  // via structuredClone semantics, so we can pass the typed array straight.
  const bytes = Array.from(Buffer.from(contentString, 'utf8'));
  return await page.evaluate(
    async ([area, sc, name, byteList]) => {
      const u8 = new Uint8Array(byteList);
      return await window.electron.playbooks.upload(area, sc, name, u8);
    },
    [areaId, scope, filename, bytes],
  );
}

async function readAlwaysOnList(area) {
  const raw = fs.readFileSync(OSCAR_PROFILE, 'utf8');
  const profile = JSON.parse(raw);
  const a = (profile.practice_areas ?? []).find((p) => p.id === area);
  return a?.area_overrides?.playbooks?.always_on ?? [];
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

  console.log('[m4] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m4] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m4] seed Commercial matter');
    await seedMatters(page);

    console.log('[m4] open Commercial / Test MSA Renewal');
    await openMatter(page, 'commercial', 'Test MSA Renewal');

    console.log('[m4] (a) playbooks-empty — Playbooks section visible with empty list');
    await shot(page, args.outDir, 'playbooks-empty');

    console.log('[m4] upload _global/nda-checklist.md (~1.6K chars)');
    const ndaBody = [
      '# NDA review checklist',
      '',
      '## Cover the basics',
      '- Confirm the parties are the right legal entities (not "Acme" — "Acme Holdings Limited").',
      '- Confirm the duration. 3-5 years is standard. Anything ≥7 years needs business sign-off.',
      '- Confirm purpose of disclosure. Push back on vague "discuss potential transaction".',
      '',
      '## Watchouts',
      '- One-way vs mutual: ensure consistency with how info is actually flowing.',
      '- Carve-outs: independently developed information, already-public, regulator-compelled disclosures.',
      '- Residuals clauses: usually a red flag. Strike if found.',
      '- Standstill clauses: only appropriate in M&A context. Strike from vanilla NDAs.',
      '',
      '## House style',
      '- Default 3-year term unless counterparty pushes back substantively.',
      '- Default UK governing law / English courts.',
      '- Default no penalty for breach — rely on equitable relief.',
      '',
      'Add findings to matter.md under ## Key facts.',
    ].join('\n');
    const upGlobal = await uploadViaIpc(page, 'commercial', 'global', 'nda-checklist.md', ndaBody);
    console.log('[m4]   upload result:', JSON.stringify(upGlobal));

    console.log('[m4] upload commercial/saas-msa-tactics.md (smaller md file)');
    const saasBody = [
      '# SaaS MSA negotiation tactics',
      '',
      'Common-and-tractable issues that come up on inbound vendor SaaS MSAs.',
      '',
      '## Limitation of liability',
      '- Counterparty often proposes "fees paid in the prior 12 months" cap.',
      '- For data-heavy services, push for 2x annual fees + carve-outs for data breach.',
      '',
      '## Termination for convenience',
      '- Counterparty often refuses outright.',
      '- Compromise: 90-day notice + pro-rated refund on prepaid fees.',
      '',
      '## Audit rights',
      '- Counterparty often refuses.',
      '- Compromise: SOC 2 report annually + ad-hoc audit on cause.',
    ].join('\n');
    const upArea = await uploadViaIpc(page, 'commercial', 'area', 'saas-msa-tactics.md', saasBody);
    console.log('[m4]   upload result:', JSON.stringify(upArea));

    // Let the polled list pick the two new files up.
    await page.waitForTimeout(2500);

    console.log('[m4] (b) playbooks-listed-mixed-scope — both files visible, distinct data-scope attrs');
    await shot(page, args.outDir, 'playbooks-listed-mixed-scope');

    console.log('[m4] toggle nda-checklist.md always-on');
    const toggleRes = await page.evaluate(async () => {
      return await window.electron.playbooks.toggleAlwaysOn(
        'commercial',
        '_global/nda-checklist.md',
        true,
      );
    });
    console.log('[m4]   toggle result:', JSON.stringify(toggleRes));
    await page.waitForTimeout(2500);
    const alwaysOnNow = await readAlwaysOnList('commercial');
    console.log('[m4]   profile.json always_on now:', JSON.stringify(alwaysOnNow));

    console.log('[m4] (c) playbooks-always-on-toggled — chip aria-pressed=true');
    await shot(page, args.outDir, 'playbooks-always-on-toggled');

    console.log('[m4] (d) renderBlock() — produce the Layer 1 injection');
    const renderedBlock = await page.evaluate(async () => {
      return await window.electron.playbooks.renderBlock(
        ['_global/nda-checklist.md'],
        8000,
      );
    });
    if (!renderedBlock || !renderedBlock.includes('## Playbooks in scope')) {
      throw new Error(
        `[m4] renderBlock did not contain the expected heading; got:\n${renderedBlock}`,
      );
    }
    if (!renderedBlock.includes('nda-checklist.md')) {
      throw new Error('[m4] renderBlock missing filename header');
    }
    console.log('[m4]   renderBlock length:', renderedBlock.length);
    console.log(
      '[m4]   renderBlock preview:',
      JSON.stringify(renderedBlock.slice(0, 240)),
    );
    // Overlay a temporary diagnostic so state (d) carries visual evidence
    // alongside the console assertion. Removed before state (e).
    await page.evaluate((blockText) => {
      const div = document.createElement('div');
      div.id = 'm4-recipe-diagnostic';
      div.style.cssText = [
        'position:fixed',
        'right:8px',
        'top:8px',
        'width:540px',
        'max-height:80vh',
        'overflow:auto',
        'padding:10px 12px',
        'background:#f9f3e7',
        'border:1px solid #b9824a',
        'border-radius:3px',
        'font-family:Menlo,Consolas,monospace',
        'font-size:11px',
        'color:#3e2c1f',
        'white-space:pre-wrap',
        'z-index:99999',
        'box-shadow:0 4px 14px rgba(0,0,0,0.15)',
      ].join(';');
      div.textContent = blockText;
      document.body.appendChild(div);
    }, renderedBlock);
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'playbooks-recipe-injection');
    await page.evaluate(() => {
      document.getElementById('m4-recipe-diagnostic')?.remove();
    });
    await page.waitForTimeout(200);

    console.log('[m4] upload _global/large-policy.md (50K chars — over 8K budget)');
    const largeBody = '# Oversized policy\n\n' + 'Lorem ipsum dolor sit amet. '.repeat(2000);
    const upLarge = await uploadViaIpc(page, 'commercial', 'global', 'large-policy.md', largeBody);
    console.log('[m4]   upload result:', JSON.stringify(upLarge));
    await page.waitForTimeout(2500);

    console.log('[m4] attempt to toggle large-policy.md always-on (expect EBUDGET)');
    const budgetRes = await page.evaluate(async () => {
      return await window.electron.playbooks.toggleAlwaysOn(
        'commercial',
        '_global/large-policy.md',
        true,
      );
    });
    console.log('[m4]   toggle result:', JSON.stringify(budgetRes));
    if (budgetRes.ok !== false || budgetRes.code !== 'EBUDGET') {
      throw new Error(
        `[m4] expected EBUDGET rejection; got ${JSON.stringify(budgetRes)}`,
      );
    }
    // Drive the rejection through the UI so the warning banner renders, by
    // clicking the chip rather than calling the IPC directly. (The direct
    // IPC call above proves the contract; the click now surfaces the
    // banner in PlaybooksSection state.)
    await page.evaluate(() => {
      const row = document.querySelector(
        '[data-testid="playbooks-row-_global/large-policy.md"]',
      );
      const chip = row?.querySelector('[data-testid="playbooks-always-on-toggle"]');
      chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await page.waitForTimeout(1500);
    await shot(page, args.outDir, 'playbooks-budget-warning');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m4] done — 5 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m4] FAILED:', err);
  process.exit(1);
});
