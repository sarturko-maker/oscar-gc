#!/usr/bin/env node
// Sprint 32 (ADR-109): variance check for pre-flight gate.
// Reads judge-verdict.json files from a cell's cycles, computes per-affordance
// agreement rate, decides PASS/FAIL per the brief's gate definition.
//
// PASS criteria (per the plan): ≤1 verdict-disagreement per affordance across
// the 5 cycles. e.g., 4/5 agree on `delegate_used_when_applicable.fired`.
//
// Usage:
//   node evals/matter-runtime/scripts/compute-variance.js \
//     --cell evals/matter-runtime/iterations/variant-B/MiniMax-M2.5/30-ndas

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const SANITY_RESULT = path.join(EVAL_ROOT, 'iterations', '_sanity-check', 'result.json');

const AFFORDANCES_TO_CHECK = [
  ['playbook_read_on_relevant_turn', 'fired'],
  ['playbook_read_on_irrelevant_turn', 'fired'],
  ['skill_invoked_when_applicable', 'fired'],
  ['skill_invoked_when_not_applicable', 'fired'],
  ['skill_arg_correct', 'fired'],
  ['delegate_used_when_applicable', 'fired'],
  ['delegate_used_when_not_applicable', 'fired'],
];

function parseArgs() {
  const args = { cell: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--cell') args.cell = argv[++i];
  }
  if (!args.cell) throw new Error('missing --cell');
  return args;
}

function loadVerdicts(cellDir) {
  const cycleDirs = fs.readdirSync(cellDir).filter((n) => /^cycle-\d{2}$/.test(n)).sort();
  const verdicts = [];
  for (const cd of cycleDirs) {
    const file = path.join(cellDir, cd, 'judge-verdict.json');
    if (!fs.existsSync(file)) continue;
    verdicts.push({ cycle: cd, verdict: JSON.parse(fs.readFileSync(file, 'utf8')) });
  }
  return verdicts;
}

function agreementRate(verdicts, fieldPath) {
  const values = verdicts.map((v) => {
    let val = v.verdict;
    for (const key of fieldPath) val = val?.[key];
    return val;
  });
  const trueCount = values.filter((x) => x === true).length;
  const falseCount = values.filter((x) => x === false).length;
  const majority = Math.max(trueCount, falseCount);
  return { values, majority, total: values.length, disagreements: values.length - majority };
}

function main() {
  const args = parseArgs();
  const cellDir = path.resolve(args.cell);
  const verdicts = loadVerdicts(cellDir);
  if (verdicts.length === 0) {
    console.error(`[variance] no judge-verdict.json files in ${cellDir}/cycle-NN/`);
    process.exit(2);
  }
  console.log(`[variance] found ${verdicts.length} judge verdicts in ${cellDir}`);

  const perAffordance = {};
  let maxDisagreements = 0;
  for (const fieldPath of AFFORDANCES_TO_CHECK) {
    const key = fieldPath.join('.');
    const r = agreementRate(verdicts, fieldPath);
    perAffordance[key] = r;
    if (r.disagreements > maxDisagreements) maxDisagreements = r.disagreements;
    console.log(`[variance] ${key}: ${r.majority}/${r.total} agree (${r.disagreements} disagreements)`);
  }

  const pass = maxDisagreements <= 1;
  const result = {
    cell: cellDir,
    n: verdicts.length,
    per_affordance: perAffordance,
    max_disagreements: maxDisagreements,
    pass,
    threshold: '≤1 disagreement per affordance',
    computed_at: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(SANITY_RESULT), { recursive: true });
  fs.writeFileSync(SANITY_RESULT, JSON.stringify(result, null, 2), 'utf8');
  console.log(`\n[variance] result: ${pass ? 'PASS' : 'FAIL'} (max_disagreements=${maxDisagreements}/${verdicts.length})`);
  console.log(`[variance] result.json: ${SANITY_RESULT}`);
  process.exit(pass ? 0 : 1);
}

try {
  main();
} catch (err) {
  console.error('[variance] FAIL:', err.message ?? err);
  process.exit(1);
}
