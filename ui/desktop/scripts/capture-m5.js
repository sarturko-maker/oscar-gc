#!/usr/bin/env node
/**
 * Sprint M5 visual verification harness. Drives the packaged Oscar GC
 * binary through the five right-pane Skills states from the M5 brief
 * and writes one PNG per state to --out-dir.
 *
 * States captured:
 *   (a) skills-default-all-mode.png
 *   (b) skills-allow-mode-with-selection.png
 *   (c) skills-user-added-visible.png
 *   (d) skills-recipe-injection.png
 *   (e) skills-deny-mode-blocks-one.png
 *
 * Cloned from capture-m4.js with three M5-specific changes:
 *   - preflightCleanup() also wipes ~/.agents/skills/test-*.
 *   - seedUserSkill() writes a SKILL.md at ~/.agents/skills/
 *     test-nda-checklist/ for state (c).
 *   - States are driven via window.electron.skills.{setMode, toggleSlug,
 *     renderBlock} via CDP evaluate.
 *
 * Usage:
 *   bash scripts/capture-m5.sh --out-dir docs/screenshots/sprint-m5
 *
 * The capture-m5.sh wrapper provides Xvfb + onboarding-bypass env vars.
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
const TEST_USER_SKILL_SLUG = 'test-nda-checklist';

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
  // Wipe any leftover test-* user skills from prior runs. Do NOT touch
  // ~/.agents/skills/ root (the bundled symlink lives at
  // ~/.agents/skills/in-house-legal/ and is provisioned at install time).
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
    captured_via: 'm5-test-harness',
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

function seedUserSkill() {
  const dir = path.join(USER_SKILLS_DIR, TEST_USER_SKILL_SLUG);
  fs.mkdirSync(dir, { recursive: true });
  const body = [
    '---',
    `name: ${TEST_USER_SKILL_SLUG}`,
    'description: Test user-added skill for the M5 visual harness. Use when the user mentions an NDA checklist.',
    '---',
    '',
    '# Test NDA checklist',
    '',
    'This skill exists solely to verify M5\'s pane discriminates between bundled and user-added skills.',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(dir, 'SKILL.md'), body, { mode: 0o600 });
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
  const snapshot = await page.evaluate(() => {
    const modeButtons = Array.from(
      document.querySelectorAll('[data-testid^="skills-mode-"]'),
    );
    const activeMode = modeButtons.find(
      (b) => b.getAttribute('aria-pressed') === 'true',
    );
    const rows = Array.from(
      document.querySelectorAll('[data-testid^="skills-row-"]'),
    );
    const skills = rows.map((r) => {
      const slug = r
        .getAttribute('data-testid')
        ?.replace(/^skills-row-/, '');
      const source = r.getAttribute('data-source');
      const chip = r.querySelector('[data-testid="skills-chip"]');
      const enabled = chip?.getAttribute('aria-pressed') === 'true';
      const deletable = !!r.querySelector('[data-testid="skills-delete"]');
      return { slug, source, enabled, deletable };
    });
    return {
      mode: activeMode?.getAttribute('data-testid')?.replace(/^skills-mode-/, '') ?? null,
      bundled: skills.filter((s) => s.source === 'bundled').length,
      user: skills.filter((s) => s.source === 'user').length,
      skills,
    };
  });
  console.log(
    `[m5] ${slug}.png (${bytes} bytes) sections=[${ids.join(',')}] mode=${snapshot.mode} bundled=${snapshot.bundled} user=${snapshot.user} skills=${JSON.stringify(snapshot.skills)}`,
  );
  return snapshot;
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
      `[m5] openMatter ${areaId}/${matterName} never navigated. diag:`,
      JSON.stringify(diag, null, 2),
    );
    throw err;
  }
  // Wait for the Skills section to mount.
  await page.waitForSelector('[data-section-id="Skills"]', { timeout: 15000 });
  await page.waitForTimeout(800);
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

async function renderBlock(page, areaId) {
  return await page.evaluate(
    async (a) => window.electron.skills.renderBlock(a),
    areaId,
  );
}

async function readEnabledSkills(area) {
  const raw = fs.readFileSync(OSCAR_PROFILE, 'utf8');
  const profile = JSON.parse(raw);
  const a = (profile.practice_areas ?? []).find((p) => p.id === area);
  return a?.area_overrides?.enabled_skills ?? null;
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

  console.log('[m5] preflight cleanup + seed profile + seed user skill');
  preflightCleanup();
  seedProfile();
  seedUserSkill();

  console.log('[m5] launch app');
  const { appProcess, browser, page } = await launchApp(args.debugPort);

  try {
    console.log('[m5] seed Commercial matter');
    await seedMatters(page);

    console.log('[m5] open Commercial / Test MSA Renewal');
    await openMatter(page, 'commercial', 'Test MSA Renewal');

    // Let the polled SkillsSection complete its first list call.
    await page.waitForTimeout(2500);

    console.log('[m5] (a) skills-default-all-mode — bundled rows visible, chips greyed');
    const snapA = await shot(page, args.outDir, 'skills-default-all-mode');
    if (snapA.mode !== 'all') {
      throw new Error(`[m5] (a) expected mode=all; got ${snapA.mode}`);
    }
    if (snapA.bundled < 5) {
      throw new Error(`[m5] (a) expected ≥5 bundled rows; got ${snapA.bundled}`);
    }

    console.log('[m5] switch mode to allow + toggle 2 bundled slugs');
    const slugA = snapA.skills.find((s) => s.source === 'bundled')?.slug;
    const slugB = snapA.skills.filter((s) => s.source === 'bundled')[1]?.slug;
    if (!slugA || !slugB) {
      throw new Error('[m5] need 2 bundled slugs for state (b)');
    }
    const setRes = await setMode(page, 'commercial', 'allow');
    console.log('[m5]   setMode result:', JSON.stringify(setRes));
    const tA = await toggleSlug(page, 'commercial', slugA, true);
    console.log(`[m5]   toggleSlug(${slugA}, true):`, JSON.stringify(tA));
    const tB = await toggleSlug(page, 'commercial', slugB, true);
    console.log(`[m5]   toggleSlug(${slugB}, true):`, JSON.stringify(tB));
    await page.waitForTimeout(2500);
    const overrideB = await readEnabledSkills('commercial');
    console.log('[m5]   profile.json enabled_skills:', JSON.stringify(overrideB));
    if (
      !overrideB ||
      overrideB.mode !== 'allow' ||
      !Array.isArray(overrideB.slugs) ||
      overrideB.slugs.length !== 2
    ) {
      throw new Error(
        `[m5] (b) expected mode=allow + 2 slugs; got ${JSON.stringify(overrideB)}`,
      );
    }

    console.log('[m5] (b) skills-allow-mode-with-selection');
    await shot(page, args.outDir, 'skills-allow-mode-with-selection');

    console.log('[m5] (c) skills-user-added-visible — verify test-nda-checklist row');
    const snapC = await shot(page, args.outDir, 'skills-user-added-visible');
    const userRow = snapC.skills.find((s) => s.slug === TEST_USER_SKILL_SLUG);
    if (!userRow) {
      throw new Error(
        `[m5] (c) expected row for ${TEST_USER_SKILL_SLUG}; user rows=${JSON.stringify(
          snapC.skills.filter((s) => s.source === 'user'),
        )}`,
      );
    }
    if (userRow.source !== 'user' || !userRow.deletable) {
      throw new Error(
        `[m5] (c) ${TEST_USER_SKILL_SLUG} should be source=user + deletable; got ${JSON.stringify(userRow)}`,
      );
    }

    console.log('[m5] (d) renderBlock — verify Allow-mode enumeration');
    const renderedAllow = await renderBlock(page, 'commercial');
    if (!renderedAllow || !renderedAllow.includes('## Skills available in this area')) {
      throw new Error(
        `[m5] (d) renderBlock missing heading; got:\n${renderedAllow}`,
      );
    }
    if (!renderedAllow.includes('Ignore any other skills you may discover.')) {
      throw new Error('[m5] (d) renderBlock missing ignore-other-skills footer');
    }
    if (!renderedAllow.includes(slugA) || !renderedAllow.includes(slugB)) {
      throw new Error(
        `[m5] (d) renderBlock missing one of [${slugA}, ${slugB}]; got:\n${renderedAllow}`,
      );
    }
    console.log('[m5]   renderBlock length:', renderedAllow.length);
    console.log(
      '[m5]   renderBlock preview:',
      JSON.stringify(renderedAllow.slice(0, 320)),
    );
    await page.evaluate((blockText) => {
      const div = document.createElement('div');
      div.id = 'm5-recipe-diagnostic';
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
    }, renderedAllow);
    await page.waitForTimeout(300);
    await shot(page, args.outDir, 'skills-recipe-injection');
    await page.evaluate(() => {
      document.getElementById('m5-recipe-diagnostic')?.remove();
    });
    await page.waitForTimeout(200);

    console.log('[m5] switch mode to deny — slugs from (b) become denied');
    const setDeny = await setMode(page, 'commercial', 'deny');
    console.log('[m5]   setMode(deny) result:', JSON.stringify(setDeny));
    await page.waitForTimeout(2500);
    const overrideE = await readEnabledSkills('commercial');
    console.log('[m5]   profile.json enabled_skills:', JSON.stringify(overrideE));
    if (overrideE.mode !== 'deny' || overrideE.slugs.length !== 2) {
      throw new Error(
        `[m5] (e) expected mode=deny + slugs preserved; got ${JSON.stringify(overrideE)}`,
      );
    }
    const renderedDeny = await renderBlock(page, 'commercial');
    if (renderedDeny && (renderedDeny.includes(`- ${slugA}\n`) || renderedDeny.includes(`- ${slugB}\n`))) {
      throw new Error(
        `[m5] (e) renderBlock should OMIT denied slugs [${slugA}, ${slugB}]; got:\n${renderedDeny}`,
      );
    }
    console.log('[m5]   renderBlock (deny) length:', renderedDeny?.length ?? 0);

    console.log('[m5] (e) skills-deny-mode-blocks-one');
    await shot(page, args.outDir, 'skills-deny-mode-blocks-one');
  } finally {
    await shutdown(browser, appProcess);
  }

  console.log('[m5] done — 5 PNGs under', args.outDir);
}

main().catch((err) => {
  console.error('[m5] FAILED:', err);
  process.exit(1);
});
