#!/usr/bin/env node
// Sprint 32 (ADR-109): Phase A — spawn N cycles for one (variant, model, scenario) cell.
// Each cycle: create a matter via dogfood-driver IPC, populate its working dir with
// fixtures, send the scenario's prompt schedule, capture session_id, persist manifest.
// Phase B (judging) happens in Claude Code conversation; Phase C (aggregation) is
// scripts/aggregate-report.js.
//
// Usage:
//   node evals/matter-runtime/scripts/run-cell.js \
//     --variant B --model MiniMax-M2.5 --scenario 30-ndas --n 5
//
// Env vars consumed:
//   DISPLAY (Playwright/Xvfb)
//   GOOSE_DISABLE_KEYRING (defaults to 1)
//   AGENT_TIMEOUT_MS (defaults to 900000 — 15 min per Sprint 30)
//   DEBUG_PORT (defaults to 9223)

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');

const lib_variants = require('./lib-variants');
const lib_scenarios = require('./lib-scenarios');
const lib_cost = require('./lib-cost-log');

const EVAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(EVAL_ROOT, '..', '..');
const DOGFOOD_DRIVER = path.join(REPO_ROOT, 'ui/desktop/scripts/dogfood-driver.mjs');
const PLAYBOOK_INSTALL_DIR = path.join(os.homedir(), '.config', 'oscar', 'playbooks', 'commercial');

const PROVIDER_BY_MODEL = {
  'MiniMax-M2.5': { provider: 'minimax', key_file: '/root/.minimax-dev-key', env_var: 'MINIMAX_API_KEY' },
  'MiniMax-M2.7': { provider: 'minimax', key_file: '/root/.minimax-dev-key', env_var: 'MINIMAX_API_KEY' },
  'anthropic/claude-haiku-4-5': { provider: 'openrouter', key_file: '/root/.openrouter-dev-key', env_var: 'OPENROUTER_API_KEY' },
  'anthropic/claude-sonnet-4.6': { provider: 'openrouter', key_file: '/root/.openrouter-dev-key', env_var: 'OPENROUTER_API_KEY' },
  'openai/gpt-5.4-mini': { provider: 'openrouter', key_file: '/root/.openrouter-dev-key', env_var: 'OPENROUTER_API_KEY' },
};

function parseArgs() {
  const args = { variant: null, model: null, scenario: null, n: null, area: 'commercial' };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--variant') args.variant = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--scenario') args.scenario = argv[++i];
    else if (a === '--n') args.n = parseInt(argv[++i], 10);
    else if (a === '--area') args.area = argv[++i];
    else throw new Error(`unknown arg: ${a}`);
  }
  for (const k of ['variant', 'model', 'scenario', 'n']) {
    if (args[k] == null) throw new Error(`missing required --${k}`);
  }
  return args;
}

function envForBinary({ variant, model }) {
  const meta = PROVIDER_BY_MODEL[model];
  if (!meta) throw new Error(`unknown model: ${model}`);
  if (!fs.existsSync(meta.key_file)) throw new Error(`key file missing: ${meta.key_file}`);
  const key = fs.readFileSync(meta.key_file, 'utf8').trim();
  return {
    ...process.env,
    OSCAR_GC_BINARY: variant.binary_path,
    GOOSE_PROVIDER: meta.provider,
    GOOSE_MODEL: model,
    GOOSE_DISABLE_KEYRING: process.env.GOOSE_DISABLE_KEYRING || '1',
    AGENT_TIMEOUT_MS: process.env.AGENT_TIMEOUT_MS || '900000',
    [meta.env_var]: key,
    DISPLAY: process.env.DISPLAY || ':99',
    DOGFOOD_SCREENSHOT_BASE: process.env.DOGFOOD_SCREENSHOT_BASE || '/tmp/sprint32-screenshots',
  };
}

function ensurePlaybooks() {
  fs.mkdirSync(PLAYBOOK_INSTALL_DIR, { recursive: true });
  const ensure = (src, name) => {
    const dest = path.join(PLAYBOOK_INSTALL_DIR, name);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      console.log(`[playbook] installed ${name} from ${src}`);
    }
  };
  ensure(path.join(REPO_ROOT, 'docs/sprint-30/test-1-rfq/fixtures/rfq-review-playbook.md'), 'rfq-review-playbook.md');
  ensure(path.join(REPO_ROOT, 'docs/sprint-30/test-2-ndas/fixtures/nda-review-playbook.md'), 'nda-review-playbook.md');
}

function dogfood(cmd, arg, env) {
  const args = arg == null ? [DOGFOOD_DRIVER, cmd] : [DOGFOOD_DRIVER, cmd, arg];
  const r = spawnSync('node', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.status !== 0) {
    throw new Error(`dogfood ${cmd} failed (exit ${r.status}):\n${r.stderr}\n${r.stdout}`);
  }
  return { stdout: r.stdout, stderr: r.stderr };
}

function waitForCondition(env, jsExpr, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  const pollMs = 1000;
  while (Date.now() < deadline) {
    const r = dogfoodEval(`return ${jsExpr};`, env);
    if (r === true) return;
    require('node:child_process').spawnSync('sleep', [String(pollMs / 1000)]);
  }
  throw new Error(`waitForCondition timeout after ${timeoutMs}ms — ${label} (expr: ${jsExpr})`);
}

function dogfoodEval(jsCode, env) {
  const { stdout } = dogfood('eval', jsCode, env);
  // [eval-result] prefix followed by JSON.stringify(result, null, 2) which may span multiple lines.
  // Take everything after the last [eval-result] occurrence; trim trailing non-JSON noise if any.
  const idx = stdout.lastIndexOf('[eval-result]');
  if (idx < 0) return null;
  const tail = stdout.slice(idx + '[eval-result]'.length).trim();
  try {
    return JSON.parse(tail);
  } catch {
    return tail;
  }
}

function makeMatterInput({ scenario, cycleIdx, runStamp }) {
  // Build a NewMatterInputSchema-shaped object. Slug + name both include runStamp so
  // both the registry path (slug) and the working_dir path (name-derived) are unique
  // per run — avoids collision when re-running a cell after a prior failed attempt.
  const cyc = String(cycleIdx).padStart(2, '0');
  const slug = `${scenario.slug}-c${cyc}-${runStamp}`;
  const name = `S32-${runStamp} ${scenario.label.slice(0, 50)} c${cyc}`;
  const shape = scenario.matter_shape;
  return {
    slug,
    name,
    kind: shape.kind,
    subject: { type: shape.subject_type, label: shape.subject_label },
    counterparty: shape.counterparty,
    stakeholder: null,
    extras: {},
    key_facts: '',
    privileged: false,
  };
}

function copyFixtureFiles(srcDir, destDir, files) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const f of files) {
    const src = path.join(srcDir, f);
    const dest = path.join(destDir, f);
    fs.copyFileSync(src, dest);
  }
}

function writeManifest(cycleDir, manifest) {
  fs.mkdirSync(cycleDir, { recursive: true });
  fs.writeFileSync(path.join(cycleDir, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
}

function readSessionIdFromMattersJson(areaId, slug) {
  const file = path.join(os.homedir(), '.config', 'oscar', 'state', areaId, 'matters.json');
  if (!fs.existsSync(file)) return null;
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entry = (data.matters || []).find((m) => m.slug === slug);
  return entry?.session_id ?? null;
}

function runCell({ variantId, model, scenarioSlug, n, areaId }) {
  const variant = lib_variants.getVariant(variantId);
  if (!fs.existsSync(variant.binary_path)) {
    throw new Error(`variant binary missing: ${variant.binary_path} — build via scripts/build-variant.sh ${variantId}`);
  }
  const scenario = lib_scenarios.loadScenario(scenarioSlug);
  const env = envForBinary({ variant, model });

  ensurePlaybooks();

  const cellDir = path.join(EVAL_ROOT, 'iterations', `variant-${variantId}`, model.replace(/\//g, '__'), scenarioSlug);
  fs.mkdirSync(cellDir, { recursive: true });

  console.log(`[cell] variant=${variantId} model=${model} scenario=${scenarioSlug} n=${n}`);
  console.log(`[cell] binary=${variant.binary_path}`);
  console.log(`[cell] cellDir=${cellDir}`);

  // Register teardown BEFORE boot — if boot throws, we still kill any orphans.
  let teardownRan = false;
  const teardown = () => {
    if (teardownRan) return;
    teardownRan = true;
    try { dogfood('quit', null, env); } catch {}
    // Hard-kill orphans (goosed survives Electron SIGTERM in our setup)
    spawnSync('pkill', ['-9', '-f', 'oscar-gc'], { stdio: 'ignore' });
    spawnSync('pkill', ['-9', '-f', 'goosed'], { stdio: 'ignore' });
  };
  process.on('exit', teardown);
  process.on('SIGINT', () => { teardown(); process.exit(130); });
  process.on('SIGTERM', () => { teardown(); process.exit(143); });
  process.on('uncaughtException', (e) => { console.error('[run-cell] uncaught:', e); teardown(); process.exit(1); });

  // Boot Electron once for the whole cell
  const sessionName = `s32-${variantId}-${model.replace(/[\W]+/g, '_')}-${scenarioSlug}`;
  console.log(`[cell] booting Electron (session=${sessionName})`);
  dogfood('boot', sessionName, env);

  const runStamp = String(Math.floor(Date.now() / 1000)).slice(-6);
  const cellManifest = { variant: variantId, model, scenario: scenarioSlug, n, cycles: [], started_at: new Date().toISOString() };

  for (let cycleIdx = 1; cycleIdx <= n; cycleIdx++) {
    const cycleId = String(cycleIdx).padStart(2, '0');
    const cycleDir = path.join(cellDir, `cycle-${cycleId}`);
    console.log(`\n[cycle ${cycleId}/${n}] starting`);

    const input = makeMatterInput({ scenario, cycleIdx, runStamp });

    // 1) Create matter
    const created = dogfoodEval(
      `const r = await window.electron.matters.create(${JSON.stringify(areaId)}, ${JSON.stringify(input)}); return r;`,
      env,
    );
    if (!created || !created.working_dir) throw new Error('matters.create returned no working_dir');
    console.log(`[cycle ${cycleId}] matter slug=${created.slug} working_dir=${created.working_dir}`);

    // 2) Populate fixtures BEFORE opening the matter (so the agent sees them on Turn 1)
    if (scenario.initial_fixtures.length > 0 && scenario.fixture_dir_abs) {
      copyFixtureFiles(scenario.fixture_dir_abs, created.working_dir, scenario.initial_fixtures);
      console.log(`[cycle ${cycleId}] populated ${scenario.initial_fixtures.length} initial fixtures`);
    }

    // 3) Open matter via the UI's MattersLanding click flow (so recipe-building +
    // goose-server session-creation + ADD_ACTIVE_SESSION event-dispatch + navigation
    // all happen — same path as a real lawyer opening a matter).
    dogfood('goto', `/practice/${areaId}`, env);
    waitForCondition(env, `document.querySelectorAll('.oscar__matter-row').length > 0`, 30_000, 'matters-landing list visible');
    // Click the row by unique matter name (runStamp prefix makes it deterministic).
    dogfood('click', `.oscar__matter-row:has-text("${input.name}")`, env);
    waitForCondition(env, `document.querySelector('[data-testid="chat-input"]') !== null`, 60_000, 'pair chat input visible');

    // 4) Run the prompt schedule
    for (const ev of scenario.events) {
      if (ev.kind === 'prompt') {
        console.log(`[cycle ${cycleId}] turn ${ev.turn}: pair-send`);
        dogfood('pair-send', ev.text, env);
      } else if (ev.kind === 'fixture_drop') {
        if (!scenario.fixture_dir_abs) throw new Error('fixture_drop requires fixture_dir on scenario');
        copyFixtureFiles(scenario.fixture_dir_abs, created.working_dir, ev.files);
        console.log(`[cycle ${cycleId}] fixture_drop: copied ${ev.files.length} files`);
      }
    }

    // 4b) Capture session_id by reading matters.json directly — by now bindSession
    // has written the registry. Avoids the IPC-roundtrip parsing fragility.
    const sessionId = readSessionIdFromMattersJson(areaId, input.slug);
    if (sessionId) console.log(`[cycle ${cycleId}] session_id=${sessionId}`);
    else console.warn(`[cycle ${cycleId}] WARN: no session_id bound for slug=${input.slug}`);

    // 5) Detach matter (so next cycle's create+setActive doesn't conflict)
    dogfoodEval(`await window.electron.matters.detachActive(); return true;`, env);

    // 6) Persist per-cycle manifest
    const manifest = {
      cycle_id: `variant-${variantId}-${model}-${scenarioSlug}-cycle-${cycleId}`,
      variant: variantId,
      model,
      scenario: scenarioSlug,
      cycle_n: cycleIdx,
      area_id: areaId,
      matter: {
        slug: input.slug,
        name: input.name,
        working_dir: created.working_dir,
        state_folder: path.join(os.homedir(), '.config', 'oscar', 'state', areaId, 'matters', input.slug),
      },
      session_id: sessionId,
      provider: PROVIDER_BY_MODEL[model].provider,
      started_at: new Date().toISOString(),
    };
    writeManifest(cycleDir, manifest);
    cellManifest.cycles.push({ cycle_n: cycleIdx, session_id: sessionId, matter_slug: input.slug });
    console.log(`[cycle ${cycleId}] done — manifest at ${cycleDir}/manifest.json`);
  }

  // Quit Electron (orderly path; teardown handler is the safety net)
  console.log(`[cell] quitting Electron`);
  teardown();

  cellManifest.completed_at = new Date().toISOString();
  fs.writeFileSync(path.join(cellDir, 'cell-manifest.json'), JSON.stringify(cellManifest, null, 2), 'utf8');
  console.log(`\n[cell] READY-FOR-EXTRACT ${cellDir} (n=${n})`);
}

function main() {
  const args = parseArgs();
  runCell({ variantId: args.variant, model: args.model, scenarioSlug: args.scenario, n: args.n, areaId: args.area });
}

try {
  main();
} catch (err) {
  console.error('[run-cell] FAIL:', err.message ?? err);
  process.exit(1);
}
