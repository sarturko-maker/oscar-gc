/*
 * Sprint 6 conversation-capture helper.
 *
 * Launches the packaged Oscar GC binary, types a single user message into
 * the onboarding chat input, waits for the agent's reply, screenshots the
 * mid-conversation state. Used once at sprint-close to verify the chat
 * surface streams end-to-end against MiniMax. NOT part of the routine
 * capture flow.
 */
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../../..');
const PACKAGED_BINARY = path.join(
  repoRoot,
  'ui/desktop/out/Oscar-GC-linux-x64/oscar-gc',
);

const OUT = process.env.OUT || path.join(repoRoot, 'docs/screenshots/sprint-6/onboarding-mid-conversation.png');
const USER_MSG = process.env.USER_MSG || 'Arturs Sliede.';
const DEBUG_PORT = Number(process.env.DEBUG_PORT || 9223);
const AGENT_TIMEOUT_MS = Number(process.env.AGENT_TIMEOUT_MS || 120000);

async function killProcessGroup(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {}
  await new Promise((r) => setTimeout(r, 300));
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {}
}

async function main() {
  if (!fs.existsSync(PACKAGED_BINARY)) {
    throw new Error(`binary not found: ${PACKAGED_BINARY}`);
  }
  const proc = spawn(PACKAGED_BINARY, ['--no-sandbox'], {
    cwd: path.dirname(PACKAGED_BINARY),
    stdio: 'pipe',
    detached: true,
    env: {
      ...process.env,
      ENABLE_PLAYWRIGHT: 'true',
      PLAYWRIGHT_DEBUG_PORT: String(DEBUG_PORT),
    },
  });
  if (process.env.CAPTURE_DEBUG) {
    proc.stdout.on('data', (d) => process.stderr.write(`[app] ${d}`));
    proc.stderr.on('data', (d) => process.stderr.write(`[app!] ${d}`));
  }

  let browser = null;
  try {
    for (let i = 0; i < 600; i++) {
      try {
        browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 200));
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
    if (!page) throw new Error('no page');

    await page.waitForLoadState('domcontentloaded');
    await page.waitForFunction(() => document.getElementById('root')?.children.length > 0, {
      timeout: 30000,
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    try {
      const noThanks = page.getByRole('button', { name: /no thanks/i });
      if (await noThanks.isVisible({ timeout: 1500 })) {
        await noThanks.click();
        await page.waitForTimeout(300);
      }
    } catch {}

    await page.waitForSelector('.oscar__chat-input', { timeout: 30000 });
    await page.waitForTimeout(500);

    const initialTurnCount = await page.locator('.oscar__chat-turn').count();
    console.log(`[capture-conv] initial turns: ${initialTurnCount}`);

    await page.fill('.oscar__chat-input', USER_MSG);
    await page.click('.oscar__chat-send');

    const start = Date.now();
    while (Date.now() - start < AGENT_TIMEOUT_MS) {
      const current = await page.locator('.oscar__chat-turn').count();
      if (current >= initialTurnCount + 2) {
        // user message + agent response both in transcript
        const body = await page
          .locator('.oscar__chat-turn:last-child .oscar__chat-turn-body')
          .innerText();
        if (body && body.trim().length > 5) break;
      }
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(800);

    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    await page.screenshot({ path: OUT, fullPage: false });
    const bytes = fs.statSync(OUT).size;
    console.log(`[capture-conv] wrote ${OUT} (${bytes} bytes)`);
  } finally {
    if (browser) await browser.close().catch(() => {});
    await killProcessGroup(proc);
  }
}

main().catch((err) => {
  console.error('[capture-conv] FAILED:', err);
  process.exit(1);
});
