#!/usr/bin/env node
// Sprint 25 (ADR-082): Phase C — apply a subtractive proposal to the
// per-cycle prompt snapshot. Reads iter-<k>/proposal.json + iter-<k>/prompt.txt,
// validates removals via lib-subtractive (Layer B), applies them, writes
// iter-<k+1>/prompt.txt + iter-<k+1>/diff-from-prior.patch.
//
// Usage:
//   node scripts/apply-proposal.js --partner sarah-chen --cycle 0
//
// Exits non-zero on any validation failure (overlap / non-subset / net-zero).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const lib = require('./lib-recipe24');
const subtractive = require('./lib-subtractive');

const EVAL_ROOT = path.resolve(__dirname, '..');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');

function parseArgs() {
  const args = { partner: null, cycle: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--partner') args.partner = argv[++i];
    else if (a === '--cycle') args.cycle = parseInt(argv[++i], 10);
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/apply-proposal.js --partner <slug> --cycle <k>');
      process.exit(0);
    } else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.partner) throw new Error('Missing --partner <slug>');
  if (args.cycle === null || Number.isNaN(args.cycle)) throw new Error('Missing --cycle <k>');
  return args;
}

function main() {
  const { partner, cycle } = parseArgs();
  const cycleDir = path.join(ITERATIONS_DIR, partner, `iter-${cycle}`);
  const proposalPath = path.join(cycleDir, 'proposal.json');
  const sourcePath = path.join(cycleDir, 'prompt.txt');

  if (!fs.existsSync(proposalPath)) throw new Error(`Missing proposal: ${proposalPath}`);
  if (!fs.existsSync(sourcePath)) throw new Error(`Missing source prompt: ${sourcePath}`);

  const proposal = JSON.parse(fs.readFileSync(proposalPath, 'utf8'));
  const source = fs.readFileSync(sourcePath, 'utf8');

  if (proposal.escalation) {
    console.log(`Escalation flagged in proposal — no removals applied.`);
    console.log(`Reason: ${proposal.escalation}`);
    process.exit(0);
  }

  const removals = proposal.removals ?? [];
  const validation = subtractive.validateRemovals({ source, removals });
  if (!validation.ok) {
    console.error(`Validation FAIL: ${validation.reason}`);
    process.exit(1);
  }

  const next = subtractive.applyRemovals({ source, removals });
  const subsetOk = subtractive.strictSubsetCheck({ before: source, after: next, removals });
  if (!subsetOk) {
    console.error(`Strict-subset check FAIL — proposal yielded a non-subset result (likely a disguised rewrite).`);
    process.exit(1);
  }

  const nextSnapshotPath = lib.savePromptSnapshot(partner, cycle + 1, next);
  const diff = subtractive.emitUnifiedDiff({
    source,
    removals,
    beforeName: `iter-${cycle}`,
    afterName: `iter-${cycle + 1}`,
  });
  const diffPath = path.join(ITERATIONS_DIR, partner, `iter-${cycle + 1}`, 'diff-from-prior.patch');
  fs.writeFileSync(diffPath, diff, 'utf8');

  const pct = ((validation.totalRemoved / source.length) * 100).toFixed(1);
  console.log(`Applied ${removals.length} removal(s); ${validation.totalRemoved} chars (-${pct}%).`);
  console.log(`Next snapshot: ${nextSnapshotPath}`);
  console.log(`Diff: ${diffPath}`);
}

try {
  main();
} catch (err) {
  console.error(`apply-proposal FAIL: ${err.message ?? err}`);
  process.exit(1);
}
