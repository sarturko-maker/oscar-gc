#!/usr/bin/env node
// Sprint 24-C (ADR-081): Sprint 23 baseline re-run sanity check. Runs the
// Sprint 23 eval harness on a single partner × 3 docs × 2 configs (N=6)
// and asserts |new Δ_grounded - (-3.8pp)| ≤ 2pp tolerance. Gates iteration
// start — if MiniMax has drifted or substrate changed, the iteration would
// run against a wrong baseline. PASS → proceed; FAIL → halt and review.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const EVAL_ROOT = path.resolve(__dirname, '..');
const SPRINT_23_DIR = path.resolve(__dirname, '..', '..', 'lavern-jv');
const SANITY_DIR = path.join(EVAL_ROOT, 'iterations', '_sanity-check');

const TOLERANCE_PP = 2.0; // ±2 percentage points around -3.8pp
const SPRINT_23_DELTA_PP = -3.8;

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function parseDeltaFromReport(reportText) {
  // Sprint 23 closing report has a headline line like:
  //   Δ_grounded = -3.8pp
  // or similar inside reports/sprint-23-baseline.md. Per-run REPORT.md in
  // a runs/<ts>/ directory uses the same convention. Be tolerant of
  // whitespace / unicode minus.
  const m = reportText.match(/[ΔΔΔ]_grounded\s*=\s*([+-]?\d+(?:\.\d+)?)\s*pp/);
  if (m) return parseFloat(m[1]);
  // Fallback: try a plain "delta = X.Xpp" line.
  const m2 = reportText.match(/delta[_\s]*grounded[^=]*=\s*([+-]?\d+(?:\.\d+)?)\s*pp/i);
  if (m2) return parseFloat(m2[1]);
  return null;
}

function fail(msg) {
  console.error(`SANITY-CHECK FAIL: ${msg}`);
  ensureDir(SANITY_DIR);
  fs.writeFileSync(
    path.join(SANITY_DIR, 'FAIL.md'),
    `# Sanity check FAIL\n\n${msg}\n\nDate: ${new Date().toISOString()}\n`,
    'utf8',
  );
  process.exit(1);
}

console.log('=== Sprint 23 baseline sanity check ===\n');
console.log(`Tolerance: |new_delta - (${SPRINT_23_DELTA_PP}pp)| ≤ ${TOLERANCE_PP}pp\n`);

if (process.env.SKIP_MINIMAX_TESTS === '1') {
  console.warn('[skip] SKIP_MINIMAX_TESTS=1 — sanity check skipped');
  process.exit(0);
}

const runEval = path.join(SPRINT_23_DIR, 'scripts', 'run-eval.js');
if (!fs.existsSync(runEval)) {
  fail(`Sprint 23 runner missing at ${runEval}`);
}

// Run on Sarah Chen × all 3 docs × both configs = N=6. ~$0.30, ~15 min.
const r = spawnSync(
  'node',
  [runEval, '--partners', 'sarah-chen', '--docs', 'all', '--configs', 'with-ralph,without-ralph'],
  { encoding: 'utf8', timeout: 1200_000, stdio: ['inherit', 'inherit', 'pipe'] },
);

if (r.status !== 0) {
  fail(`Sprint 23 runner exited non-zero (${r.status}). Stderr:\n${r.stderr ?? ''}`);
}

// Locate the most recent run directory.
const runsDir = path.join(SPRINT_23_DIR, 'runs');
const recent = fs
  .readdirSync(runsDir, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
  .map((e) => ({ name: e.name, mtime: fs.statSync(path.join(runsDir, e.name)).mtimeMs }))
  .sort((a, b) => b.mtime - a.mtime);

if (recent.length === 0) fail('No runs/<ts>/ directories found after sanity run');

const reportPath = path.join(runsDir, recent[0].name, 'REPORT.md');
if (!fs.existsSync(reportPath)) {
  fail(`Sanity run produced no REPORT.md at ${reportPath}`);
}

const reportText = fs.readFileSync(reportPath, 'utf8');
const newDelta = parseDeltaFromReport(reportText);
if (newDelta === null) {
  fail(`Could not parse Δ_grounded from sanity run REPORT.md (${reportPath})`);
}

const drift = Math.abs(newDelta - SPRINT_23_DELTA_PP);
const ok = drift <= TOLERANCE_PP;

ensureDir(SANITY_DIR);
const result = {
  date: new Date().toISOString(),
  sprint_23_baseline_pp: SPRINT_23_DELTA_PP,
  new_delta_pp: newDelta,
  drift_pp: drift,
  tolerance_pp: TOLERANCE_PP,
  pass: ok,
  source_report: reportPath,
};
fs.writeFileSync(path.join(SANITY_DIR, 'result.json'), JSON.stringify(result, null, 2), 'utf8');

if (ok) {
  console.log(`PASS: new Δ_grounded = ${newDelta}pp; drift ${drift.toFixed(2)}pp ≤ tolerance ${TOLERANCE_PP}pp`);
  process.exit(0);
} else {
  fail(
    `Drift ${drift.toFixed(2)}pp exceeds tolerance ${TOLERANCE_PP}pp. ` +
      `Sprint 23 baseline was ${SPRINT_23_DELTA_PP}pp; sanity run got ${newDelta}pp. ` +
      `Either MiniMax-M2.5 has drifted, or eval substrate changed. Arturs review required.`,
  );
}
