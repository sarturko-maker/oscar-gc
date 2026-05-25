#!/usr/bin/env node
/**
 * Sprint 29 M6 — On-demand playbook discovery block visibility probe.
 *
 * Verifies (no LLM call — pure IPC probe):
 *   (a) on-demand block lists every non-always-on playbook for the area
 *       (filename + scope + size + first-line hint for text formats).
 *   (b) flipping a playbook to always-on drops it from the on-demand
 *       block (it now belongs to Layer 1).
 *   (c) empty case — zero on-demand playbooks → IPC returns null →
 *       builder skips the slot.
 *
 * Usage: bash scripts/capture-sprint29-m6.sh --out-dir docs/screenshots/sprint-29-m6
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
    captured_via: 'sprint29-m6-test-harness',
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

async function uploadPlaybook(page, areaId, scope, filename, content) {
  return await page.evaluate(
    async ([a, s, f, body]) => {
      const bytes = new TextEncoder().encode(body);
      return window.electron.playbooks.upload(a, s, f, bytes);
    },
    [areaId, scope, filename, content],
  );
}

async function renderOnDemand(page, areaId, alwaysOn) {
  return await page.evaluate(
    async ([a, ao]) => window.electron.playbooks.renderOnDemandBlock(a, ao),
    [areaId, alwaysOn],
  );
}

async function shutdown(browser, appProcess) {
  if (browser) { try { await browser.close(); } catch { /* ignore */ } }
  await killProcessGroup(appProcess);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('[m6] preflight cleanup + seed profile');
  preflightCleanup(); seedProfile();

  console.log('[m6] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m6] (c-empty) zero playbooks → null block');
    const empty = await renderOnDemand(page, 'commercial', []);
    if (empty !== null) throw new Error(`[m6] (empty) expected null, got: ${JSON.stringify(empty)}`);

    console.log('[m6] upload two playbooks (global .md + area .md)');
    const up1 = await uploadPlaybook(page, 'commercial', 'global',
      'nda-redline-playbook.md',
      '# NDA redline playbook\n\nFast-triage rules for inbound NDAs.\n');
    if (!up1.ok) throw new Error(`[m6] upload 1 failed: ${JSON.stringify(up1)}`);
    const up2 = await uploadPlaybook(page, 'commercial', 'area',
      'msa-checklist.md',
      '# MSA negotiation checklist\n\nLine-by-line MSA review.\n');
    if (!up2.ok) throw new Error(`[m6] upload 2 failed: ${JSON.stringify(up2)}`);

    console.log('[m6] (a) on-demand block lists BOTH (none always-on)');
    const a = await renderOnDemand(page, 'commercial', []);
    fs.writeFileSync(path.join(args.outDir, 'a-on-demand-block-both.md'), a ?? '(null)', 'utf8');
    console.log('[m6] (a) block:\n', a);
    if (!a) throw new Error('[m6] (a) expected non-null block');
    if (!a.includes('nda-redline-playbook.md')) throw new Error('[m6] (a) missing nda-redline-playbook.md');
    if (!a.includes('msa-checklist.md')) throw new Error('[m6] (a) missing msa-checklist.md');
    if (!a.includes('NDA redline playbook')) throw new Error('[m6] (a) missing nda first-line hint');
    if (!a.includes('MSA negotiation checklist')) throw new Error('[m6] (a) missing msa first-line hint');

    console.log('[m6] (b) flip nda playbook always-on → on-demand block drops it');
    const b = await renderOnDemand(page, 'commercial', ['_global/nda-redline-playbook.md']);
    fs.writeFileSync(path.join(args.outDir, 'b-on-demand-block-after-always-on.md'), b ?? '(null)', 'utf8');
    console.log('[m6] (b) block:\n', b);
    if (!b) throw new Error('[m6] (b) expected non-null (msa-checklist still on-demand)');
    if (b.includes('nda-redline-playbook.md')) throw new Error('[m6] (b) nda should have moved to Layer 1');
    if (!b.includes('msa-checklist.md')) throw new Error('[m6] (b) msa-checklist should still appear');

    console.log('[m6] PASS — on-demand discovery block reflects always-on filter');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m6] done');
}

main().catch((err) => { console.error('[m6] FATAL', err); process.exit(1); });
