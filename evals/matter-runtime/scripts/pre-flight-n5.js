#!/usr/bin/env node
// Sprint 32 (ADR-109): pre-flight N=5 variance gate.
// Mandatory before main-matrix spawn.
//
// Usage:
//   node evals/matter-runtime/scripts/pre-flight-n5.js
//
// Runs N=5 on (variant-B, MiniMax-M2.5, 30-ndas) — the highest-discrimination cell
// at the primary model + refined doctrine. Extracts transcripts. Writes a
// READY-FOR-VARIANCE-JUDGE marker; CC then judges in Phase B and a follow-up
// compute-variance run reads judge-verdict.json files to decide PASS/FAIL.

'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const SCRIPTS = path.dirname(__filename);
const EVAL_ROOT = path.resolve(SCRIPTS, '..');
const SANITY_DIR = path.join(EVAL_ROOT, 'iterations', '_sanity-check');
const TARGET_CELL = {
  variant: 'B',
  model: 'MiniMax-M2.5',
  scenario: '30-ndas',
  n: 5,
};

function main() {
  fs.mkdirSync(SANITY_DIR, { recursive: true });

  console.log(`[pre-flight] target cell:`, TARGET_CELL);
  console.log(`[pre-flight] step 1/3: spawning N=${TARGET_CELL.n} cycles`);
  let r = spawnSync('node', [
    path.join(SCRIPTS, 'run-cell.js'),
    '--variant', TARGET_CELL.variant,
    '--model', TARGET_CELL.model,
    '--scenario', TARGET_CELL.scenario,
    '--n', String(TARGET_CELL.n),
  ], { stdio: 'inherit', env: process.env });
  if (r.status !== 0) {
    console.error(`[pre-flight] FAIL run-cell exited ${r.status}`);
    process.exit(1);
  }

  const cellDir = path.join(
    EVAL_ROOT, 'iterations',
    `variant-${TARGET_CELL.variant}`,
    TARGET_CELL.model,
    TARGET_CELL.scenario,
  );

  console.log(`\n[pre-flight] step 2/3: extracting transcripts`);
  r = spawnSync('node', [path.join(SCRIPTS, 'extract-cycle.js'), '--cell', cellDir], {
    stdio: 'inherit', env: process.env,
  });
  if (r.status !== 0) {
    console.error(`[pre-flight] FAIL extract-cycle exited ${r.status}`);
    process.exit(2);
  }

  console.log(`\n[pre-flight] step 3/3: READY-FOR-VARIANCE-JUDGE`);
  console.log(`[pre-flight] CC: judge each cycle's tool-timeline.md against RUBRIC.md`);
  console.log(`[pre-flight] CC: write judge-verdict.json per cycle at ${cellDir}/cycle-NN/`);
  console.log(`[pre-flight] CC: then run scripts/compute-variance.js to confirm pass/fail`);

  // Write a placeholder result.json that the variance computation will overwrite
  const marker = {
    target: TARGET_CELL,
    cell_dir: cellDir,
    spawn_complete_at: new Date().toISOString(),
    status: 'awaiting_judge_verdicts',
    pass: null,
    notes: 'Phase B (CC) must write judge-verdict.json per cycle. Then compute-variance.js fills in pass.',
  };
  fs.writeFileSync(path.join(SANITY_DIR, 'result.json'), JSON.stringify(marker, null, 2), 'utf8');
  console.log(`[pre-flight] marker written: ${path.join(SANITY_DIR, 'result.json')}`);
}

try {
  main();
} catch (err) {
  console.error('[pre-flight] FAIL:', err.message ?? err);
  process.exit(1);
}
