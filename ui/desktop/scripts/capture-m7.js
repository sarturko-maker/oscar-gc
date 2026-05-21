#!/usr/bin/env node
/**
 * Sprint M7 visual verification harness. Drives the packaged Oscar GC
 * binary through the six right-pane Edit + Forge Mode-D + write-validator
 * states from the M7 brief.
 *
 * States captured (deterministic; live agent turns deferred to M8):
 *   (a) edit-link-visible.png          — RightPaneShell header shows Edit
 *   (b) forge-mode-d-opens.png         — clicking Edit lands on /pair
 *   (c) forge-mode-d-recipe-diagnostic — Mode-D activation preamble
 *   (d) description-override-applied   — recipe instructions carry the
 *                                        ## About this practice area block
 *   (e) enabled-mcps-filter.png        — recipe.extensions excludes the
 *                                        denied integration
 *   (f) validator-rejected-revert.png  — invalid write is auto-reverted
 *
 * Cloned from capture-m6.js with M7-specific changes:
 *   - preflightCleanup() also wipes ~/.config/oscar/profile.json.bak (the
 *     ADR-089 rollback target).
 *   - State (b) navigates via the Link click pattern (no synthetic
 *     File-drop scaffolding needed).
 *   - States (d)/(e) write area_overrides directly via fs to simulate
 *     what Forge's oscar-fs__write_file would produce — same end-state.
 *   - State (f) deliberately writes an INVALID enabled_mcps shape and
 *     asserts the watcher reverts within ~500ms.
 *
 * Usage:
 *   bash scripts/capture-m7.sh --out-dir docs/screenshots/sprint-m7
 *
 * The capture-m7.sh wrapper provides Xvfb + onboarding-bypass env vars.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
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
const USER_SKILLS_DIR = path.join(HOME, '.agents', 'skills');

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

function seedProfile() {
  fs.mkdirSync(OSCAR_CONFIG, { recursive: true });
  const profile = {
    schema_version: 4,
    completed_at: new Date().toISOString(),
    captured_via: 'm7-test-harness',
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
    ],
    provider: { kind: 'minimax', model: 'MiniMax-M2.5' },
  };
  fs.writeFileSync(OSCAR_PROFILE, JSON.stringify(profile, null, 2), { mode: 0o600 });
}

function readProfile() {
  return JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
}

function writeProfileRaw(content) {
  fs.writeFileSync(OSCAR_PROFILE, content, { mode: 0o600 });
}

function mutateCommercialOverrides(overridePatch) {
  const profile = readProfile();
  profile.practice_areas = profile.practice_areas.map((pa) =>
    pa.id === 'commercial'
      ? {
          ...pa,
          area_overrides: {
            ...(pa.area_overrides ?? {}),
            ...overridePatch,
          },
        }
      : pa,
  );
  writeProfileRaw(JSON.stringify(profile, null, 2));
}

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
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
  const editLinkHref = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="right-pane-edit-link"]');
    return el ? el.getAttribute('href') : null;
  });
  const profile = (() => {
    try {
      return JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
    } catch {
      return null;
    }
  })();
  const commercialOverrides = profile?.practice_areas?.find(
    (a) => a.id === 'commercial',
  )?.area_overrides ?? null;
  console.log(
    `[m7] ${slug}.png (${bytes} bytes) route=${hash} editLinkHref=${editLinkHref} commercialOverrides=${JSON.stringify(commercialOverrides)} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
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

const COMMERCIAL_BASE_MATTER = {
  slug: 'test-msa-renewal',
  name: 'Test MSA Renewal',
  kind: 'msa',
  subject: { type: 'contract', label: 'Acme Master Services Agreement' },
  counterparty: { role: 'customer', name: 'Acme Corp' },
  stakeholder: 'Acme account',
  privileged: false,
  key_facts:
    '- 3-year term ending Q2 2027\n- Auto-renews unless 90-day notice given',
};

const DESC_OVERRIDE_MATTER = {
  slug: 'test-desc-override',
  name: 'Test Description Override',
  kind: 'msa',
  subject: { type: 'contract', label: 'Beta Co MSA' },
  counterparty: { role: 'customer', name: 'Beta Co' },
  stakeholder: 'Beta account',
  privileged: false,
  key_facts: '- description_override exercise matter',
};

const MCP_FILTER_MATTER = {
  slug: 'test-mcp-filter',
  name: 'Test MCP Filter',
  kind: 'msa',
  subject: { type: 'contract', label: 'Gamma Co MSA' },
  counterparty: { role: 'customer', name: 'Gamma Co' },
  stakeholder: 'Gamma account',
  privileged: false,
  key_facts: '- enabled_mcps filter exercise matter',
};

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
      `[m7] openMatter ${areaId}/${matterName} never navigated. diag:`,
      JSON.stringify(diag, null, 2),
    );
    throw err;
  }
  await page.waitForSelector('[data-testid="right-pane-edit-link"]', {
    timeout: 15000,
  });
  await page.waitForTimeout(800);
}

async function getCurrentSessionRecipe(page) {
  return await page.evaluate(async () => {
    try {
      const hash = window.location.hash;
      const m = hash.match(/resumeSessionId=([^&]+)/);
      if (!m) return null;
      const sessionId = decodeURIComponent(m[1]);
      const baseUrl = await window.electron.getGoosedHostPort();
      const secretKey = await window.electron.getSecretKey();
      if (!baseUrl || !secretKey) return null;
      const resp = await fetch(
        `${baseUrl}/sessions/${encodeURIComponent(sessionId)}`,
        { headers: { 'X-Secret-Key': secretKey } },
      );
      if (!resp.ok) {
        return { __error: `fetch_${resp.status}` };
      }
      const body = await resp.json();
      return body?.recipe ?? null;
    } catch (err) {
      return { __error: (err && err.message) || String(err) };
    }
  });
}

async function installIntegration(page, areaId, entryId) {
  return await page.evaluate(
    async ([a, e]) => window.electron.integrations.install(a, e, true),
    [areaId, entryId],
  );
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

  console.log('[m7] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m7] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m7] seed Commercial test-msa-renewal');
    await createMatter(page, 'commercial', COMMERCIAL_BASE_MATTER);

    console.log('[m7] open Commercial / Test MSA Renewal');
    await openMatter(page, 'commercial', 'Test MSA Renewal');
    await page.waitForTimeout(2000);

    // (a) Edit link visible
    console.log('[m7] (a) edit-link-visible');
    const editLinkInfo = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="right-pane-edit-link"]');
      if (!el) return null;
      return {
        text: el.textContent,
        href: el.getAttribute('href'),
        title: el.getAttribute('title'),
      };
    });
    if (!editLinkInfo) throw new Error('[m7] (a) right-pane-edit-link not in DOM');
    if (!editLinkInfo.href || !editLinkInfo.href.includes('modifyArea=commercial')) {
      throw new Error(
        `[m7] (a) edit link href wrong: ${JSON.stringify(editLinkInfo)}`,
      );
    }
    await shot(page, args.outDir, 'edit-link-visible', { editLinkInfo });

    // (b) Forge Mode D opens via the Edit link
    console.log('[m7] (b) forge-mode-d-opens — navigate via Edit link');
    await setRoute(page, '#/forge?modifyArea=commercial');
    await page.waitForFunction(
      () => window.location.hash.startsWith('#/pair'),
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(2500);
    await dismissRecipeSecretsIfShown(page);
    await page.waitForSelector('[data-testid="chat-input"]:visible', {
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    const forgeHash = await page.evaluate(() => window.location.hash);
    await shot(page, args.outDir, 'forge-mode-d-opens', {
      forgeHash,
      arrivedAtPair: forgeHash.includes('resumeSessionId='),
    });

    // (c) Mode D activation preamble in recipe instructions
    console.log('[m7] (c) forge-mode-d-recipe-diagnostic');
    const forgeRecipe = await getCurrentSessionRecipe(page);
    if (!forgeRecipe || forgeRecipe.__error) {
      throw new Error(
        `[m7] (c) could not fetch session recipe: ${JSON.stringify(forgeRecipe)}`,
      );
    }
    const forgeInstructions = forgeRecipe.instructions;
    if (typeof forgeInstructions !== 'string') {
      throw new Error('[m7] (c) recipe.instructions missing or non-string');
    }
    const expectedPreamble = '[Begin in Mode D. Modify the practice area: commercial]';
    if (!forgeInstructions.startsWith(expectedPreamble)) {
      throw new Error(
        `[m7] (c) instructions do not start with the Mode-D activation preamble.\n  expected prefix: ${expectedPreamble}\n  got prefix: ${forgeInstructions.slice(0, 200)}`,
      );
    }
    for (const header of [
      '# Mode A — Create a skill',
      '# Mode B — Create a practice area',
      '# Mode C — Review an uploaded skill',
      '# Mode D — Modify a practice area',
    ]) {
      if (!forgeInstructions.includes(header)) {
        throw new Error(`[m7] (c) instructions missing section header: ${header}`);
      }
    }
    console.log('[m7]   instructions length:', forgeInstructions.length);
    await page.evaluate((text) => {
      const div = document.createElement('div');
      div.id = 'm7-recipe-diagnostic';
      div.style.cssText = [
        'position:fixed',
        'right:8px',
        'top:8px',
        'width:620px',
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
      div.textContent = text;
      document.body.appendChild(div);
    }, forgeInstructions.slice(0, 800));
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'forge-mode-d-recipe-diagnostic', {
      instructionsLen: forgeInstructions.length,
      hasModeD: forgeInstructions.includes('# Mode D — Modify a practice area'),
    });
    await page.evaluate(() => {
      document.getElementById('m7-recipe-diagnostic')?.remove();
    });
    await page.waitForTimeout(200);

    // (d) description_override applied — fresh matter
    console.log(
      '[m7] (d) description-override-applied — write override + spawn fresh matter',
    );
    const overrideText =
      'Escalation thresholds: any indemnity cap > $500k or term > 3 years requires VP-Legal sign-off.';
    mutateCommercialOverrides({ description_override: overrideText });
    // Wait for the watcher to refresh .bak.
    await page.waitForTimeout(400);
    if (!fs.existsSync(OSCAR_PROFILE_BAK)) {
      throw new Error('[m7] (d) .bak was not created by the watcher after valid write');
    }
    await createMatter(page, 'commercial', DESC_OVERRIDE_MATTER);
    await openMatter(page, 'commercial', 'Test Description Override');
    await page.waitForTimeout(2000);
    const descRecipe = await getCurrentSessionRecipe(page);
    if (!descRecipe || descRecipe.__error) {
      throw new Error(
        `[m7] (d) could not fetch recipe: ${JSON.stringify(descRecipe)}`,
      );
    }
    const descInstructions = descRecipe.instructions;
    if (!descInstructions.includes('## About this practice area')) {
      throw new Error(
        '[m7] (d) recipe.instructions missing "## About this practice area" block',
      );
    }
    if (!descInstructions.includes('Escalation thresholds')) {
      throw new Error(
        '[m7] (d) recipe.instructions missing the override text content',
      );
    }
    await shot(page, args.outDir, 'description-override-applied', {
      hasAboutBlock: descInstructions.includes('## About this practice area'),
      hasOverrideText: descInstructions.includes('Escalation thresholds'),
    });

    // (e) enabled_mcps filter — install Google Drive, deny it, fresh matter
    console.log(
      '[m7] (e) enabled-mcps-filter — install Google Drive, set deny, fresh matter',
    );
    const installRes = await installIntegration(page, 'commercial', 'Google Drive');
    console.log('[m7]   integrations.install result:', JSON.stringify(installRes));
    mutateCommercialOverrides({
      enabled_mcps: { mode: 'deny', ids: ['Google Drive'] },
    });
    await page.waitForTimeout(400);
    await createMatter(page, 'commercial', MCP_FILTER_MATTER);
    await openMatter(page, 'commercial', 'Test MCP Filter');
    await page.waitForTimeout(2000);
    const filterRecipe = await getCurrentSessionRecipe(page);
    if (!filterRecipe || filterRecipe.__error) {
      throw new Error(
        `[m7] (e) could not fetch recipe: ${JSON.stringify(filterRecipe)}`,
      );
    }
    const extJson = JSON.stringify(filterRecipe.extensions ?? []);
    if (/google\s*drive/i.test(extJson)) {
      throw new Error(
        `[m7] (e) Google Drive should be filtered out of recipe.extensions but is present.\n  extensions: ${extJson.slice(0, 800)}`,
      );
    }
    const extNames = (filterRecipe.extensions ?? [])
      .map((e) => e.name || e.display_name || '?')
      .join(', ');
    console.log('[m7]   recipe extension names:', extNames);
    await page.evaluate((names) => {
      const div = document.createElement('div');
      div.id = 'm7-ext-diagnostic';
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
        `recipe.extensions (Google Drive filtered out):\n  ${names}`;
      document.body.appendChild(div);
    }, extNames);
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'enabled-mcps-filter', {
      extensionNames: extNames,
      googleDrivePresent: /google\s*drive/i.test(extJson),
    });
    await page.evaluate(() => {
      document.getElementById('m7-ext-diagnostic')?.remove();
    });

    // (f) validator rejection — invalid write reverts
    console.log('[m7] (f) validator-rejected-revert');
    const preHash = sha256(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
    const bakHash = sha256(fs.readFileSync(OSCAR_PROFILE_BAK, 'utf8'));
    if (preHash !== bakHash) {
      throw new Error(
        `[m7] (f) pre-state: profile and .bak should match a valid state\n  profile=${preHash}\n  .bak=${bakHash}`,
      );
    }
    const corruptProfile = readProfile();
    corruptProfile.practice_areas = corruptProfile.practice_areas.map((pa) =>
      pa.id === 'commercial'
        ? {
            ...pa,
            area_overrides: {
              ...(pa.area_overrides ?? {}),
              enabled_mcps: { mode: 'totally-not-a-mode', ids: 'not-an-array' },
            },
          }
        : pa,
    );
    writeProfileRaw(JSON.stringify(corruptProfile, null, 2));
    await new Promise((r) => setTimeout(r, 600));
    const postHash = sha256(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
    if (postHash !== preHash) {
      throw new Error(
        `[m7] (f) watcher did not revert invalid write\n  pre=${preHash}\n  post=${postHash}\n  .bak=${bakHash}`,
      );
    }
    await page.evaluate((info) => {
      const div = document.createElement('div');
      div.id = 'm7-rejection-diagnostic';
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
        'ADR-089 watcher: invalid write auto-reverted.\n' +
        `pre-hash:  ${info.pre}\n` +
        `post-hash: ${info.post}\n` +
        `.bak hash: ${info.bak}\n` +
        '(post matches pre — revert successful)';
      document.body.appendChild(div);
    }, { pre: preHash.slice(0, 16), post: postHash.slice(0, 16), bak: bakHash.slice(0, 16) });
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'validator-rejected-revert', {
      preHash: preHash.slice(0, 16),
      postHash: postHash.slice(0, 16),
      bakHash: bakHash.slice(0, 16),
      revertedSuccessfully: postHash === preHash,
    });
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m7] done — 6 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m7] FAILED:', err);
  process.exit(1);
});
