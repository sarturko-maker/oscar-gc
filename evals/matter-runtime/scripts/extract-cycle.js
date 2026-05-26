#!/usr/bin/env node
// Sprint 32 (ADR-109): per-cycle transcript + tool-timeline extraction.
// Wraps docs/sprint-31a/extract-transcript.py to pull from goosed's sessions.db.
//
// Usage:
//   node evals/matter-runtime/scripts/extract-cycle.js \
//     --cell evals/matter-runtime/iterations/variant-B/MiniMax-M2.5/30-ndas \
//     [--cycle 01]         # extract one cycle; default is all cycles in cell
//
// Outputs (per cycle):
//   <cycle_dir>/transcript.json   — raw message stream
//   <cycle_dir>/tool-timeline.md  — chronological tool-call table

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const EXTRACT_PY = path.join(REPO_ROOT, 'docs/sprint-31a/extract-transcript.py');

function parseArgs() {
  const args = { cell: null, cycle: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--cell') args.cell = argv[++i];
    else if (a === '--cycle') args.cycle = argv[++i];
    else throw new Error(`unknown arg: ${a}`);
  }
  if (!args.cell) throw new Error('missing --cell <path>');
  return args;
}

function listCycleDirs(cellDir) {
  return fs
    .readdirSync(cellDir)
    .filter((name) => /^cycle-\d{2}$/.test(name))
    .sort()
    .map((name) => path.join(cellDir, name));
}

function extractOne(cycleDir) {
  const manifestPath = path.join(cycleDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.warn(`[extract] SKIP ${cycleDir} — no manifest.json`);
    return { cycleDir, ok: false, reason: 'no_manifest' };
  }
  const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!m.session_id) {
    console.warn(`[extract] SKIP ${cycleDir} — manifest has no session_id`);
    return { cycleDir, ok: false, reason: 'no_session_id', cycle: m.cycle_n };
  }

  const r = spawnSync('python3', [EXTRACT_PY, m.session_id, cycleDir], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (r.status !== 0) {
    console.warn(`[extract] FAIL cycle ${m.cycle_n} session=${m.session_id}: ${r.stderr}`);
    return { cycleDir, ok: false, reason: 'py_failure', cycle: m.cycle_n, stderr: r.stderr };
  }
  const stdoutLines = (r.stdout ?? '').trim().split('\n');
  console.log(`[extract] OK cycle ${m.cycle_n} session=${m.session_id}: ${stdoutLines.join(' | ')}`);
  return { cycleDir, ok: true, cycle: m.cycle_n, session_id: m.session_id };
}

function main() {
  const args = parseArgs();
  const cellDir = path.resolve(args.cell);
  if (!fs.existsSync(cellDir)) throw new Error(`cell dir not found: ${cellDir}`);

  const targets = args.cycle
    ? [path.join(cellDir, `cycle-${args.cycle}`)]
    : listCycleDirs(cellDir);

  if (targets.length === 0) {
    console.warn(`[extract] no cycle-NN/ dirs under ${cellDir}`);
    return;
  }

  const results = targets.map(extractOne);
  const okCount = results.filter((r) => r.ok).length;
  console.log(`\n[extract] cell summary: ${okCount}/${targets.length} ok`);
  if (okCount < targets.length) {
    console.log(`[extract] failures:`);
    for (const r of results.filter((x) => !x.ok)) console.log(`  - ${r.cycleDir}: ${r.reason}`);
    process.exit(1);
  }
}

try {
  main();
} catch (err) {
  console.error('[extract-cycle] FAIL:', err.message ?? err);
  process.exit(1);
}
