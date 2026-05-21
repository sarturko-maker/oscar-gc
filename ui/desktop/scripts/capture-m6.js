#!/usr/bin/env node
/**
 * Sprint M6 visual verification harness. Drives the packaged Oscar GC
 * binary through the six right-pane Skills + Forge Mode-C states from
 * the M6 brief and writes one PNG per state to --out-dir.
 *
 * States captured (all deterministic — live agent turns deferred to M8):
 *   (a) skills-drop-zone.png
 *   (b) skills-staged.png
 *   (c) forge-mode-c-opens.png
 *   (d) forge-mode-c-recipe-diagnostic.png
 *   (e) skills-bound-commercial-simulated.png
 *   (f) skills-unbound-privacy.png
 *
 * Cloned from capture-m5.js with three M6-specific changes:
 *   - preflightCleanup() also wipes ~/.agents/skills/test-nda-review (the
 *     M6 staging target; bundled set is unaffected).
 *   - State (b) calls window.electron.skills.stageForReview directly,
 *     bypassing the drop-event plumbing (which would need synthetic
 *     File objects in CDP — high-friction).
 *   - State (d) reads the spawned Forge recipe instructions via the
 *     session API and overlays the first 800 chars; assertion that the
 *     activation preamble is present.
 *   - State (e) simulates Mode C's profile.json write step via the
 *     existing M5 IPCs (oscar:skills:set-mode + :toggle-slug) — same
 *     end-state the Forge agent would produce via oscar-fs. The live
 *     agent path is exercised in the M8 Crostini dogfood.
 *
 * Usage:
 *   bash scripts/capture-m6.sh --out-dir docs/screenshots/sprint-m6
 *
 * The capture-m6.sh wrapper provides Xvfb + onboarding-bypass env vars.
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
const USER_SKILLS_DIR = path.join(HOME, '.agents', 'skills');
const TEST_USER_SKILL_SLUG = 'test-nda-review';
const TEST_USER_SKILL_PATH = path.join(
  USER_SKILLS_DIR,
  TEST_USER_SKILL_SLUG,
  'SKILL.md',
);

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
  // Wipe any leftover test-* user skills from prior runs (covers both
  // M5's test-nda-checklist and M6's test-nda-review). Do NOT touch
  // ~/.agents/skills/ root; the bundled symlink lives at
  // ~/.agents/skills/in-house-legal/ and is provisioned at install.
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
    captured_via: 'm6-test-harness',
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

const TEST_SKILL_CONTENT = [
  '---',
  `name: ${TEST_USER_SKILL_SLUG}`,
  'description: Bare upload — Mode C will enrich.',
  '---',
  '',
  '# Test NDA review',
  '',
  'Bare body. Mode C interview will refine the description and bind to',
  'practice areas before the file is considered live.',
  '',
].join('\n');

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
  const ids = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.oscar__panel-section')).map(
      (el) => el.dataset.sectionId,
    ),
  );
  const hash = await page.evaluate(() => window.location.hash);
  const stagedSkills = (() => {
    try {
      return fs
        .readdirSync(USER_SKILLS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name.startsWith('test-'))
        .map((e) => e.name);
    } catch {
      return [];
    }
  })();
  const enabledSkillsByArea = (() => {
    try {
      const profile = JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
      const out = {};
      for (const a of profile.practice_areas ?? []) {
        const es = a.area_overrides?.enabled_skills;
        if (es) out[a.id] = es;
      }
      return out;
    } catch {
      return {};
    }
  })();
  console.log(
    `[m6] ${slug}.png (${bytes} bytes) sections=[${ids.join(',')}] route=${hash} stagedSkills=${JSON.stringify(stagedSkills)} enabledSkillsByArea=${JSON.stringify(enabledSkillsByArea)} ${Object.entries(extras).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}`,
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
    slug: 'test-vendor-dpa',
    name: 'Test Vendor DPA',
    kind: 'dpa',
    subject: { type: 'processing_activity', label: 'Salesforce vendor DPA' },
    counterparty: { role: 'vendor', name: 'Salesforce' },
    stakeholder: 'Salesforce account',
    privileged: false,
    key_facts: '- EU SCCs Module Two\n- TIA dated Q1 2026',
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
      `[m6] openMatter ${areaId}/${matterName} never navigated. diag:`,
      JSON.stringify(diag, null, 2),
    );
    throw err;
  }
  await page.waitForSelector('[data-section-id="Skills"]', { timeout: 15000 });
  await page.waitForTimeout(800);
}

async function stageForReview(page, slug, content) {
  return await page.evaluate(
    async ([s, c]) => window.electron.skills.stageForReview(s, c),
    [slug, content],
  );
}

async function setMode(page, areaId, mode) {
  return await page.evaluate(
    async ([a, m]) => window.electron.skills.setMode(a, m),
    [areaId, mode],
  );
}

async function toggleSlug(page, areaId, slug, included) {
  return await page.evaluate(
    async ([a, s, inc]) => window.electron.skills.toggleSlug(a, s, inc),
    [areaId, slug, included],
  );
}

async function getCurrentSessionInstructions(page) {
  // Mirror renderer.tsx:25-36's SDK client wiring — getGoosedHostPort +
  // getSecretKey via the preload bridge — and fetch the spawned session
  // metadata directly. The recipe.instructions field on the session row
  // is what goosed serialised at session-spawn time.
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
        {
          headers: { 'X-Secret-Key': secretKey },
        },
      );
      if (!resp.ok) {
        return `__fetch_error_${resp.status}__`;
      }
      const body = await resp.json();
      // Session type (types.gen.ts:1302-1330) exposes recipe at top level.
      const instructions = body?.recipe?.instructions;
      if (typeof instructions !== 'string') {
        return `__no_instructions__topLevelKeys=${Object.keys(body || {}).join(',')}__recipe=${JSON.stringify(body?.recipe ?? null).slice(0, 200)}`;
      }
      return instructions;
    } catch (err) {
      return `__exception_${(err && err.message) || err}__`;
    }
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

  console.log('[m6] preflight cleanup + seed profile');
  preflightCleanup();
  seedProfile();

  console.log('[m6] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m6] seed Commercial + Privacy matters');
    await seedMatters(page);

    console.log('[m6] open Commercial / Test MSA Renewal');
    await openMatter(page, 'commercial', 'Test MSA Renewal');

    await page.waitForTimeout(2500);

    console.log('[m6] (a) skills-drop-zone — drop affordance visible above mode pill');
    const dropPresent = await page.evaluate(() =>
      !!document.querySelector('[data-testid="skills-dropzone"]'),
    );
    if (!dropPresent) {
      throw new Error('[m6] (a) skills drop-zone missing from DOM');
    }
    await shot(page, args.outDir, 'skills-drop-zone', { dropPresent });

    console.log('[m6] (b) skills-staged — call stageForReview IPC + verify disk + pane');
    const stageRes = await stageForReview(
      page,
      TEST_USER_SKILL_SLUG,
      TEST_SKILL_CONTENT,
    );
    console.log('[m6]   stageForReview result:', JSON.stringify(stageRes));
    if (!stageRes.ok) {
      throw new Error(
        `[m6] (b) stageForReview failed: ${stageRes.code} ${stageRes.message}`,
      );
    }
    if (stageRes.absPath !== TEST_USER_SKILL_PATH) {
      throw new Error(
        `[m6] (b) absPath mismatch: got ${stageRes.absPath}, expected ${TEST_USER_SKILL_PATH}`,
      );
    }
    if (!fs.existsSync(TEST_USER_SKILL_PATH)) {
      throw new Error(`[m6] (b) ${TEST_USER_SKILL_PATH} not on disk`);
    }
    const onDisk = fs.readFileSync(TEST_USER_SKILL_PATH, 'utf8');
    if (!onDisk.includes(`name: ${TEST_USER_SKILL_SLUG}`)) {
      throw new Error('[m6] (b) on-disk SKILL.md missing name frontmatter');
    }
    // Wait for the polled SkillsSection to pick up the new row.
    await page.waitForTimeout(3000);
    const userRowPresent = await page.evaluate(
      (slug) => !!document.querySelector(`[data-testid="skills-row-${slug}"]`),
      TEST_USER_SKILL_SLUG,
    );
    if (!userRowPresent) {
      console.warn(
        `[m6]   (b) WARN: skills-row-${TEST_USER_SKILL_SLUG} not in DOM yet — Goose discovery may need another tick`,
      );
      await page.waitForTimeout(2500);
    }
    const userRowPresentAfter = await page.evaluate(
      (slug) => !!document.querySelector(`[data-testid="skills-row-${slug}"]`),
      TEST_USER_SKILL_SLUG,
    );
    await shot(page, args.outDir, 'skills-staged', {
      absPath: stageRes.absPath,
      onDiskBytes: onDisk.length,
      userRowPresent: userRowPresentAfter,
    });

    console.log('[m6] (c) forge-mode-c-opens — navigate to /forge?reviewSkill=...');
    await setRoute(
      page,
      `#/forge?reviewSkill=${encodeURIComponent(stageRes.absPath)}`,
    );
    // ForgeView is a transient bootstrap: detach matter → build recipe →
    // createSession → dispatch ADD_ACTIVE_SESSION → navigate /pair.
    // Wait for the redirect to /pair?resumeSessionId=.
    await page.waitForFunction(
      () => window.location.hash.startsWith('#/pair'),
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(2500);
    await dismissRecipeSecretsIfShown(page);
    // Wait for the chat input to mount.
    await page.waitForSelector('[data-testid="chat-input"]:visible', {
      timeout: 15000,
    });
    await page.waitForTimeout(1000);
    const forgeHash = await page.evaluate(() => window.location.hash);
    await shot(page, args.outDir, 'forge-mode-c-opens', {
      forgeHash,
      // Active session metadata may not yet carry the recipe; logged on
      // a best-effort basis.
      cameFromForgeWithParam: forgeHash.includes('resumeSessionId='),
    });

    console.log('[m6] (d) forge-mode-c-recipe-diagnostic — assert activation preamble');
    const instructions = await getCurrentSessionInstructions(page);
    if (!instructions || instructions.startsWith('__')) {
      throw new Error(
        `[m6] (d) could not fetch session instructions via /sessions/{id}: ${instructions}`,
      );
    }
    const expectedPreambleSubstring = `[Begin in Mode C. Review the SKILL.md at: ${stageRes.absPath}]`;
    if (!instructions.startsWith(expectedPreambleSubstring)) {
      throw new Error(
        `[m6] (d) instructions do not start with the Mode-C activation preamble.\n  expected prefix: ${expectedPreambleSubstring}\n  got prefix: ${instructions.slice(0, 200)}`,
      );
    }
    if (!instructions.includes('# Mode C — Review an uploaded skill')) {
      throw new Error('[m6] (d) instructions missing Mode C section header');
    }
    if (!instructions.includes('# Mode A — Create a skill')) {
      throw new Error('[m6] (d) instructions missing Mode A section');
    }
    if (!instructions.includes('# Mode B — Create a practice area')) {
      throw new Error('[m6] (d) instructions missing Mode B section');
    }
    console.log('[m6]   instructions length:', instructions.length);
    console.log(
      '[m6]   instructions preview (first 600 chars):',
      JSON.stringify(instructions.slice(0, 600)),
    );
    // Overlay a diagnostic showing the first 800 chars of the instructions
    // so the PNG carries visual evidence alongside the assertion.
    await page.evaluate((text) => {
      const div = document.createElement('div');
      div.id = 'm6-recipe-diagnostic';
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
    }, instructions.slice(0, 800));
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'forge-mode-c-recipe-diagnostic', {
      instructionsLen: instructions.length,
      hasModeC: instructions.includes('# Mode C — Review an uploaded skill'),
    });
    await page.evaluate(() => {
      document.getElementById('m6-recipe-diagnostic')?.remove();
    });
    await page.waitForTimeout(200);

    console.log(
      '[m6] (e) skills-bound-commercial-simulated — simulate Mode C step 6 via M5 IPCs',
    );
    const setModeRes = await setMode(page, 'commercial', 'allow');
    console.log('[m6]   setMode(commercial, allow):', JSON.stringify(setModeRes));
    const toggleRes = await toggleSlug(
      page,
      'commercial',
      TEST_USER_SKILL_SLUG,
      true,
    );
    console.log(
      `[m6]   toggleSlug(commercial, ${TEST_USER_SKILL_SLUG}, true):`,
      JSON.stringify(toggleRes),
    );
    const profileAfter = JSON.parse(fs.readFileSync(OSCAR_PROFILE, 'utf8'));
    const commercialOverride = profileAfter.practice_areas.find(
      (a) => a.id === 'commercial',
    )?.area_overrides?.enabled_skills;
    if (
      !commercialOverride ||
      commercialOverride.mode !== 'allow' ||
      !commercialOverride.slugs.includes(TEST_USER_SKILL_SLUG)
    ) {
      throw new Error(
        `[m6] (e) commercial enabled_skills wrong: ${JSON.stringify(commercialOverride)}`,
      );
    }
    const privacyOverride = profileAfter.practice_areas.find(
      (a) => a.id === 'privacy',
    )?.area_overrides?.enabled_skills;
    if (privacyOverride) {
      throw new Error(
        `[m6] (e) privacy should be untouched but has enabled_skills: ${JSON.stringify(privacyOverride)}`,
      );
    }
    // Navigate back to Commercial matter so the pane reflects the bound state.
    await openMatter(page, 'commercial', 'Test MSA Renewal');
    await page.waitForTimeout(2500);
    const commercialChipPressed = await page.evaluate((slug) => {
      const row = document.querySelector(`[data-testid="skills-row-${slug}"]`);
      if (!row) return null;
      const chip = row.querySelector('[data-testid="skills-chip"]');
      return chip?.getAttribute('aria-pressed');
    }, TEST_USER_SKILL_SLUG);
    if (commercialChipPressed !== 'true') {
      throw new Error(
        `[m6] (e) commercial chip for ${TEST_USER_SKILL_SLUG} not pressed; got ${commercialChipPressed}`,
      );
    }
    await shot(page, args.outDir, 'skills-bound-commercial-simulated', {
      commercialMode: commercialOverride.mode,
      commercialSlugs: commercialOverride.slugs,
      chipPressed: commercialChipPressed,
    });

    console.log('[m6] (f) skills-unbound-privacy — Privacy still in all-mode');
    await openMatter(page, 'privacy', 'Test Vendor DPA');
    await page.waitForTimeout(2500);
    const privacyMode = await page.evaluate(() => {
      const buttons = Array.from(
        document.querySelectorAll('[data-testid^="skills-mode-"]'),
      );
      const active = buttons.find(
        (b) => b.getAttribute('aria-pressed') === 'true',
      );
      return active
        ?.getAttribute('data-testid')
        ?.replace(/^skills-mode-/, '');
    });
    if (privacyMode !== 'all') {
      throw new Error(
        `[m6] (f) privacy expected mode=all; got ${privacyMode}`,
      );
    }
    const privacyUserRow = await page.evaluate((slug) => {
      const row = document.querySelector(`[data-testid="skills-row-${slug}"]`);
      if (!row) return null;
      const chip = row.querySelector('[data-testid="skills-chip"]');
      return {
        present: true,
        chipPressed: chip?.getAttribute('aria-pressed'),
        chipDisabled: chip?.getAttribute('aria-disabled'),
      };
    }, TEST_USER_SKILL_SLUG);
    // In Privacy (mode=all), the user skill is globally discovered by
    // Goose's discover_skills walker (it's just a file under
    // ~/.agents/skills/). Whether it surfaces as a Privacy row depends
    // on Privacy's bundled_skill_sources intersection — for a freshly
    // user-added skill not in any bundled plugin, the row is filtered
    // out by joinSkills (cf. skillStore.ts:128: `if (!bundled && !user)
    // continue;` — user-set is global, so it WILL show). Log either way.
    console.log(
      `[m6]   privacy user-row for ${TEST_USER_SKILL_SLUG}:`,
      JSON.stringify(privacyUserRow),
    );
    await shot(page, args.outDir, 'skills-unbound-privacy', {
      privacyMode,
      privacyUserRow,
    });
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m6] done — 6 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m6] FAILED:', err);
  process.exit(1);
});
