#!/usr/bin/env node
// Sprint 32 (ADR-109): Phase 7 main-matrix orchestrator.
// Spawns + extracts all Sprint 32 cells sequentially.
//
// Usage:
//   node evals/matter-runtime/scripts/run-matrix.js [--minimax-only] [--openrouter-only] [--skip <variant>:<model>:<scenario>]
//
// Cells (per ADR-109):
//   - 8 MiniMax × N=20 (2 variants × 4 scenarios)
//   - 4 OpenRouter × N=10 (2 variants × 2 floor scenarios)
// Total 200 cycles ≈ 5-6 hours wall clock.

'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const SCRIPTS = __dirname;
const EVAL_ROOT = path.resolve(SCRIPTS, '..');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');

const FLOOR_SCENARIOS = ['30-rfq', '30-ndas'];
const EXPANSION_SCENARIOS = ['negative-control', 'playbook-mismatch'];

const ALL_CELLS = [
  // 8 MiniMax cells (N=20)
  ...['A', 'B'].flatMap((variant) =>
    [...FLOOR_SCENARIOS, ...EXPANSION_SCENARIOS].map((scenario) => ({
      variant, model: 'MiniMax-M2.5', scenario, n: 20,
    })),
  ),
  // 4 OpenRouter cells (N=10) — floor scenarios only per ADR-109
  ...['A', 'B'].flatMap((variant) =>
    FLOOR_SCENARIOS.map((scenario) => ({
      variant, model: 'anthropic/claude-haiku-4-5', scenario, n: 10,
    })),
  ),
];

function cellLabel(c) { return `${c.variant}/${c.model}/${c.scenario}/N=${c.n}`; }

function parseArgs() {
  const args = { minimaxOnly: false, openrouterOnly: false, skip: [] };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--minimax-only') args.minimaxOnly = true;
    else if (a === '--openrouter-only') args.openrouterOnly = true;
    else if (a === '--skip') args.skip.push(argv[++i]);
    else throw new Error(`unknown arg: ${a}`);
  }
  return args;
}

function cellDir(c) {
  // Sanitize model names containing '/' (e.g. 'anthropic/claude-haiku-4-5') —
  // run-cell.js sanitizes the same way, so extract-cycle finds the dir.
  return path.join(ITERATIONS_DIR, `variant-${c.variant}`, c.model.replace(/\//g, '__'), c.scenario);
}

function isCellComplete(c) {
  const dir = cellDir(c);
  if (!fs.existsSync(dir)) return false;
  let cycles = 0;
  try {
    cycles = fs.readdirSync(dir).filter((n) => /^cycle-\d{2}$/.test(n)).length;
  } catch { return false; }
  return cycles >= c.n;
}

function runCell(c) {
  console.log(`\n========== ${cellLabel(c)} ==========`);
  if (isCellComplete(c)) {
    console.log(`[matrix] SKIP — already has ${c.n} cycles`);
    return;
  }
  // Wipe any partial cell data (start fresh).
  const dir = cellDir(c);
  if (fs.existsSync(dir)) {
    console.log(`[matrix] cleaning partial cell dir ${dir}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const spawnArgs = [
    path.join(SCRIPTS, 'run-cell.js'),
    '--variant', c.variant,
    '--model', c.model,
    '--scenario', c.scenario,
    '--n', String(c.n),
  ];
  console.log(`[matrix] node ${spawnArgs.join(' ')}`);
  let r = spawnSync('node', spawnArgs, { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error(`[matrix] FAIL run-cell for ${cellLabel(c)} (exit ${r.status})`);
    return;
  }

  // Auto-extract per cell
  r = spawnSync('node', [path.join(SCRIPTS, 'extract-cycle.js'), '--cell', dir], {
    stdio: 'inherit', env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[matrix] WARN extract-cycle failed for ${cellLabel(c)} (exit ${r.status})`);
  }
}

function main() {
  const args = parseArgs();
  let cells = ALL_CELLS;
  if (args.minimaxOnly) cells = cells.filter((c) => c.model.startsWith('MiniMax'));
  if (args.openrouterOnly) cells = cells.filter((c) => !c.model.startsWith('MiniMax'));
  for (const skipKey of args.skip) {
    const [v, m, s] = skipKey.split(':');
    cells = cells.filter((c) => !(c.variant === v && c.model === m && c.scenario === s));
  }

  console.log(`[matrix] Sprint 32 plan: ${cells.length} cells`);
  for (const c of cells) console.log(`  - ${cellLabel(c)}`);
  const totalCycles = cells.reduce((s, c) => s + c.n, 0);
  console.log(`[matrix] total cycles: ${totalCycles}`);
  console.log(`[matrix] ETA: ~${Math.round(totalCycles * 90 / 60)} min wall clock`);

  for (const c of cells) {
    runCell(c);
  }

  console.log(`\n[matrix] all cells attempted. Next: Phase B (CC judges per cell) + aggregate-report.js.`);
}

try {
  main();
} catch (err) {
  console.error('[run-matrix] FAIL:', err.message ?? err);
  process.exit(1);
}
