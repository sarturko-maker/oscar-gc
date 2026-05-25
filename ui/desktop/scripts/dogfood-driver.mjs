/*
 * Dogfood driver. Subcommand-based REPL for driving the Oscar GC chat
 * surface over CDP from an external orchestrator (e.g. CC running the
 * dogfood). Pure clicks-and-types; no product surface changes.
 *
 * Subcommands:
 *   launch <session>     spawn the app, wait for chat input, capture
 *                        greeting + initial screenshot, log app PID
 *   boot <session>       spawn the app, wait only for root mount (no
 *                        onboarding chat wait). Use when a profile is
 *                        pre-seeded and the app lands on Hub directly.
 *   send <text>          fill input, click send, wait for agent reply to
 *                        stabilise, screenshot, log the turn
 *                        (targets the onboarding Editorial chat selectors:
 *                         .oscar__chat-input + .oscar__chat-send)
 *   click <selector>     click a CSS selector and screenshot the result
 *                        (used for post-onboarding Hub-banner dismiss)
 *   goto <hash-route>    navigate the app to a hash route (e.g.
 *                        '/practice/commercial'); screenshot after settle.
 *                        Used to jump from Hub into a practice-area session
 *                        without sidebar clicking.
 *   pair-send <text>     same as send but targets BaseChat (post-onboarding)
 *                        — [data-testid="chat-input"] + Enter. Waits for the
 *                        assistant turn(s) to settle, screenshots.
 *   pair-read            print BaseChat turns currently in the DOM
 *   eval <js>            evaluate JS in the renderer (await-able); prints
 *                        the resolved value. Used to drive Oscar IPC bridges
 *                        (e.g. window.electron.matters.create) from outside
 *                        the UI dialog flow when test setup needs determinism.
 *   screenshot <label>   capture a labelled screenshot without sending
 *   read                 print all chat turns currently in the DOM
 *   status               print app PID, profile-file presence, turn count
 *   quit                 capture a final-state screenshot then SIGTERM
 *
 * State files under /tmp/oscar-dogfood/:
 *   app.pid, screenshot-counter, turns.json, session-name
 *
 * Screenshot path: $DOGFOOD_SCREENSHOT_BASE (repo-relative) or default
 *   docs/dogfood/sprint-7/screenshots/<session>/NN-label.png
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const PACKAGED_BINARY = path.join(repoRoot, 'ui/desktop/out/Oscar-GC-linux-x64/oscar-gc');
const STATE_DIR = '/tmp/oscar-dogfood';
const PID_FILE = path.join(STATE_DIR, 'app.pid');
const COUNTER_FILE = path.join(STATE_DIR, 'screenshot-counter');
const TURNS_FILE = path.join(STATE_DIR, 'turns.json');
const SESSION_FILE = path.join(STATE_DIR, 'session-name');
const APP_LOG = path.join(STATE_DIR, 'app.log');
const APP_ERR = path.join(STATE_DIR, 'app.err.log');
const DEBUG_PORT = Number(process.env.DEBUG_PORT || 9223);
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 240000);
const STABILITY_MS = Number(process.env.STABILITY_MS || 3500);
const PROFILE_PATH = path.join(os.homedir(), '.config/oscar/profile.json');
const SCREENSHOT_BASE = path.join(
  repoRoot,
  process.env.DOGFOOD_SCREENSHOT_BASE || 'docs/dogfood/sprint-7/screenshots',
);

function ensureStateDir() {
  fs.mkdirSync(STATE_DIR, { recursive: true });
}

function readCounter() {
  if (!fs.existsSync(COUNTER_FILE)) return 1;
  return parseInt(fs.readFileSync(COUNTER_FILE, 'utf8'), 10) || 1;
}
function writeCounter(n) {
  fs.writeFileSync(COUNTER_FILE, String(n));
}
function readTurns() {
  if (!fs.existsSync(TURNS_FILE)) return [];
  return JSON.parse(fs.readFileSync(TURNS_FILE, 'utf8'));
}
function appendTurn(role, text) {
  const turns = readTurns();
  turns.push({ role, text, ts: new Date().toISOString() });
  fs.writeFileSync(TURNS_FILE, JSON.stringify(turns, null, 2));
}
function readSession() {
  if (!fs.existsSync(SESSION_FILE)) return 'primary';
  return fs.readFileSync(SESSION_FILE, 'utf8').trim() || 'primary';
}

async function connect() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
  const ctx = browser.contexts()[0];
  if (!ctx) {
    await browser.close().catch(() => {});
    throw new Error('no CDP context');
  }
  let page = ctx.pages()[0];
  if (!page) {
    for (let i = 0; i < 50; i++) {
      await new Promise((r) => setTimeout(r, 100));
      page = ctx.pages()[0];
      if (page) break;
    }
  }
  if (!page) {
    await browser.close().catch(() => {});
    throw new Error('no CDP page');
  }
  return { browser, page };
}

async function readAllTurns(page) {
  try {
    return await page.locator('.oscar__chat-turn .oscar__chat-turn-body').allInnerTexts();
  } catch {
    return [];
  }
}

async function takeScreenshot(page, label) {
  ensureStateDir();
  const session = readSession();
  const n = readCounter();
  const dir = path.join(SCREENSHOT_BASE, session);
  fs.mkdirSync(dir, { recursive: true });
  const safe = label.replace(/[^A-Za-z0-9-]+/g, '-').toLowerCase().replace(/^-+|-+$/g, '');
  const fname = `${String(n).padStart(2, '0')}-${safe || 'untitled'}.png`;
  const fpath = path.join(dir, fname);
  await page.screenshot({ path: fpath, fullPage: false });
  writeCounter(n + 1);
  console.log(`[screenshot] ${fpath}`);
  return fpath;
}

async function dismissTelemetryIfVisible(page) {
  try {
    const noThanks = page.getByRole('button', { name: /no thanks/i });
    if (await noThanks.isVisible({ timeout: 1500 })) {
      await noThanks.click();
      await page.waitForTimeout(300);
    }
  } catch {}
}

async function launch(session) {
  ensureStateDir();
  fs.writeFileSync(SESSION_FILE, session);
  fs.writeFileSync(COUNTER_FILE, '1');
  fs.writeFileSync(TURNS_FILE, '[]');

  if (!fs.existsSync(PACKAGED_BINARY)) {
    throw new Error(`binary not found: ${PACKAGED_BINARY}`);
  }

  const outFd = fs.openSync(APP_LOG, 'a');
  const errFd = fs.openSync(APP_ERR, 'a');
  const proc = spawn(PACKAGED_BINARY, ['--no-sandbox'], {
    cwd: path.dirname(PACKAGED_BINARY),
    stdio: ['ignore', outFd, errFd],
    detached: true,
    env: {
      ...process.env,
      ENABLE_PLAYWRIGHT: 'true',
      PLAYWRIGHT_DEBUG_PORT: String(DEBUG_PORT),
    },
  });
  proc.unref();
  fs.writeFileSync(PID_FILE, String(proc.pid));

  let browser = null;
  for (let i = 0; i < 600; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!browser) throw new Error('CDP never came up');

  const ctx = browser.contexts()[0];
  let page = null;
  for (let i = 0; i < 200; i++) {
    page = ctx.pages()[0];
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('no page after CDP up');

  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 30000 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await dismissTelemetryIfVisible(page);

  await page.waitForSelector('.oscar__chat-input', { timeout: 30000 });
  await page.waitForTimeout(800);

  await takeScreenshot(page, 'launch-greeting');
  const greeting = await readAllTurns(page);
  for (const t of greeting) {
    appendTurn('agent', t);
    console.log(`[greeting] ${t}`);
  }
  console.log(`[launch] session=${session} pid=${proc.pid} ready (turns=${greeting.length})`);
  await browser.close();
}

async function boot(session) {
  ensureStateDir();
  fs.writeFileSync(SESSION_FILE, session);
  fs.writeFileSync(COUNTER_FILE, '1');
  fs.writeFileSync(TURNS_FILE, '[]');

  if (!fs.existsSync(PACKAGED_BINARY)) {
    throw new Error(`binary not found: ${PACKAGED_BINARY}`);
  }

  const outFd = fs.openSync(APP_LOG, 'a');
  const errFd = fs.openSync(APP_ERR, 'a');
  const proc = spawn(PACKAGED_BINARY, ['--no-sandbox'], {
    cwd: path.dirname(PACKAGED_BINARY),
    stdio: ['ignore', outFd, errFd],
    detached: true,
    env: {
      ...process.env,
      ENABLE_PLAYWRIGHT: 'true',
      PLAYWRIGHT_DEBUG_PORT: String(DEBUG_PORT),
    },
  });
  proc.unref();
  fs.writeFileSync(PID_FILE, String(proc.pid));

  let browser = null;
  for (let i = 0; i < 600; i++) {
    try {
      browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  if (!browser) throw new Error('CDP never came up');

  const ctx = browser.contexts()[0];
  let page = null;
  for (let i = 0; i < 200; i++) {
    page = ctx.pages()[0];
    if (page) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!page) throw new Error('no page after CDP up');

  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, { timeout: 30000 });
  await page.setViewportSize({ width: 1440, height: 900 });
  await dismissTelemetryIfVisible(page);
  await page.waitForTimeout(1200);

  await takeScreenshot(page, 'boot-ready');
  console.log(`[boot] session=${session} pid=${proc.pid} ready`);
  await browser.close();
}

async function sendMessage(msg) {
  if (!msg) throw new Error('empty message');
  const { browser, page } = await connect();
  try {
    if (!(await page.locator('.oscar__chat-input').count())) {
      console.log('[send] chat input not present — session likely complete');
      await takeScreenshot(page, 'post-onboarding');
      return;
    }
    const before = await readAllTurns(page);

    await page.fill('.oscar__chat-input', msg);
    await page.click('.oscar__chat-send');
    appendTurn('user', msg);

    const startTs = Date.now();
    let prev = { count: -1, lastLen: -1, inputPresent: true };
    let stableSince = Date.now();
    while (Date.now() - startTs < AGENT_TIMEOUT_MS) {
      await page.waitForTimeout(700);
      const turns = await readAllTurns(page);
      const inputPresent = (await page.locator('.oscar__chat-input').count()) > 0;
      const count = turns.length;
      const lastLen = count > 0 ? turns[count - 1].length : 0;

      const changed = count !== prev.count || lastLen !== prev.lastLen || inputPresent !== prev.inputPresent;
      if (changed) {
        prev = { count, lastLen, inputPresent };
        stableSince = Date.now();
        continue;
      }
      const reachedReply = count >= before.length + 2 || !inputPresent;
      if (reachedReply && Date.now() - stableSince >= STABILITY_MS) break;
    }
    await page.waitForTimeout(400);

    const after = await readAllTurns(page);
    const newAgent = after.slice(before.length + 1);
    for (const t of newAgent) appendTurn('agent', t);

    console.log('=== agent reply ===');
    console.log(after[after.length - 1] || '(empty)');
    console.log('=== end ===');
    if (newAgent.length > 1) {
      console.log(`[send] note: ${newAgent.length} new agent turns captured (e.g. tool-call + closing message)`);
    }
    if (!(await page.locator('.oscar__chat-input').count())) {
      console.log('[send] chat input gone — session ended after this turn');
    }
    await takeScreenshot(page, 'turn');
  } finally {
    await browser.close();
  }
}

async function readState() {
  const { browser, page } = await connect();
  try {
    const turns = await readAllTurns(page);
    const inputPresent = (await page.locator('.oscar__chat-input').count()) > 0;
    console.log(`[state] chatInput=${inputPresent} turns=${turns.length}`);
    for (let i = 0; i < turns.length; i++) {
      console.log(`--- turn ${i + 1} ---`);
      console.log(turns[i]);
    }
  } finally {
    await browser.close();
  }
}

async function screenshot(label) {
  const { browser, page } = await connect();
  try {
    await takeScreenshot(page, label || 'manual');
  } finally {
    await browser.close();
  }
}

async function click(selector) {
  if (!selector) throw new Error('empty selector');
  const { browser, page } = await connect();
  try {
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.click(selector);
    await page.waitForTimeout(300);
    const labelSlug = selector
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
    await takeScreenshot(page, `click-${labelSlug || 'target'}`);
  } finally {
    await browser.close();
  }
}

async function readPairTurns(page) {
  try {
    return await page.locator('[data-testid="message-container"]').allInnerTexts();
  } catch {
    return [];
  }
}

async function goto(route) {
  if (!route) throw new Error('empty route');
  const normalized = route.startsWith('/') ? route : `/${route}`;
  const { browser, page } = await connect();
  try {
    await page.evaluate((r) => {
      window.location.hash = r;
    }, normalized);
    await page.waitForTimeout(1500);
    const labelSlug = normalized
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .toLowerCase()
      .replace(/^-+|-+$/g, '');
    await takeScreenshot(page, `goto-${labelSlug || 'route'}`);
    console.log(`[goto] hash=${normalized} url=${page.url()}`);
  } finally {
    await browser.close();
  }
}

async function pairSend(msg) {
  if (!msg) throw new Error('empty message');
  const { browser, page } = await connect();
  try {
    await page.waitForSelector('[data-testid="chat-input"]', { timeout: 10000 });
    const before = await readPairTurns(page);

    await page.fill('[data-testid="chat-input"]', msg);
    await page.keyboard.press('Enter');
    appendTurn('user', msg);

    const startTs = Date.now();
    let prev = { count: -1, lastLen: -1 };
    let stableSince = Date.now();
    while (Date.now() - startTs < AGENT_TIMEOUT_MS) {
      await page.waitForTimeout(700);
      const turns = await readPairTurns(page);
      const count = turns.length;
      const lastLen = count > 0 ? turns[count - 1].length : 0;
      const changed = count !== prev.count || lastLen !== prev.lastLen;
      if (changed) {
        prev = { count, lastLen };
        stableSince = Date.now();
        continue;
      }
      const reachedReply = count >= before.length + 2;
      if (reachedReply && Date.now() - stableSince >= STABILITY_MS) break;
    }
    await page.waitForTimeout(400);

    const after = await readPairTurns(page);
    const newAgent = after.slice(before.length + 1);
    for (const t of newAgent) appendTurn('agent', t);

    console.log('=== agent reply ===');
    console.log(after[after.length - 1] || '(empty)');
    console.log('=== end ===');
    if (newAgent.length > 1) {
      console.log(`[pair-send] note: ${newAgent.length} new agent turns captured`);
    }
    await takeScreenshot(page, 'pair-turn');
  } finally {
    await browser.close();
  }
}

async function pairRead() {
  const { browser, page } = await connect();
  try {
    const turns = await readPairTurns(page);
    console.log(`[pair-state] turns=${turns.length}`);
    for (let i = 0; i < turns.length; i++) {
      console.log(`--- turn ${i + 1} ---`);
      console.log(turns[i]);
    }
  } finally {
    await browser.close();
  }
}

async function evalJs(code) {
  if (!code) throw new Error('empty code');
  const { browser, page } = await connect();
  try {
    const wrapped = `(async () => { ${code} })()`;
    const result = await page.evaluate(wrapped);
    if (result === undefined) {
      console.log('[eval] ok (no return value)');
    } else {
      console.log('[eval-result]', JSON.stringify(result, null, 2));
    }
  } finally {
    await browser.close();
  }
}

async function status() {
  const pid = fs.existsSync(PID_FILE) ? fs.readFileSync(PID_FILE, 'utf8').trim() : null;
  let alive = false;
  if (pid) {
    try { process.kill(Number(pid), 0); alive = true; } catch {}
  }
  const profileExists = fs.existsSync(PROFILE_PATH);
  const session = readSession();
  const turns = readTurns();
  console.log(JSON.stringify({
    session,
    pid,
    alive,
    profile_exists: profileExists,
    turns_count: turns.length,
    screenshot_next: readCounter(),
  }, null, 2));
}

async function quit() {
  try {
    const { browser, page } = await connect();
    await takeScreenshot(page, 'final-state').catch(() => {});
    await browser.close();
  } catch (e) {
    console.error(`[quit] final screenshot skipped: ${e.message}`);
  }
  if (!fs.existsSync(PID_FILE)) {
    console.error('[quit] no PID file');
    return;
  }
  const pid = parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
  try { process.kill(pid, 'SIGTERM'); console.log(`[quit] SIGTERM ${pid}`); } catch {}
  await new Promise((r) => setTimeout(r, 800));
  try { process.kill(pid, 0); process.kill(pid, 'SIGKILL'); console.log(`[quit] SIGKILL ${pid}`); } catch {}
  fs.rmSync(PID_FILE, { force: true });
}

const cmd = process.argv[2];
const arg = process.argv.slice(3).join(' ');

const action = {
  launch: () => launch(arg || 'primary'),
  boot: () => boot(arg || 'primary'),
  send: () => sendMessage(arg),
  click: () => click(arg),
  goto: () => goto(arg),
  'pair-send': () => pairSend(arg),
  'pair-read': () => pairRead(),
  eval: () => evalJs(arg),
  read: () => readState(),
  screenshot: () => screenshot(arg),
  status: () => status(),
  quit: () => quit(),
}[cmd];

if (!action) {
  console.error('usage: launch <session> | boot <session> | send <text> | click <selector> | goto <route> | pair-send <text> | pair-read | eval <js> | read | screenshot <label> | status | quit');
  process.exit(2);
}

action().catch((err) => {
  console.error('[dogfood] FAILED:', err.message);
  process.exit(1);
});
