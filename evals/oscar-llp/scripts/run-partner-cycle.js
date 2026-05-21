#!/usr/bin/env node
// Sprint 25 (ADR-082): Phase A partner-run spawner. Per partner per cycle:
// load prompt snapshot → sample N benchmark instances → spawn `goose run`
// per instance via MiniMax → write transcripts + manifest → emit
// READY-FOR-JUDGE marker. Phase B (judging + proposing) runs in Claude
// Code conversation; Phase C (apply + snapshot) runs via apply-proposal.js.
//
// Usage:
//   node scripts/run-partner-cycle.js --partner sarah-chen --cycle 0
//   node scripts/run-partner-cycle.js --partner diana-park --cycle 1 --sample-size 10
//   node scripts/run-partner-cycle.js --partner aisha-khan --cycle 2 --drop-supplemental
//
// Pre-execution gate: sanity-check.js must have written
// iterations/_sanity-check/result.json with pass=true. Override only via
// SKIP_SANITY_GATE=1 (not recommended).

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const lib = require('./lib-recipe24');
const benchmarks = require('./lib-benchmarks');
const { appendCost, costForMinimaxCall } = require('./lib-cost-log');

const EVAL_ROOT = path.resolve(__dirname, '..');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');
const SANITY_RESULT_PATH = path.join(ITERATIONS_DIR, '_sanity-check', 'result.json');
const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const MINIMAX_KEY_FILE = '/root/.minimax-dev-key';

const PARTNER_META = {
  'sarah-chen': { name: 'Sarah Chen', specialism: 'M&A' },
  'diana-park': { name: 'Diana Park', specialism: 'Privacy' },
  'aisha-khan': { name: 'Aisha Khan', specialism: 'Tech Transactions' },
};

function parseArgs() {
  const args = { partner: null, cycle: null, sampleSize: 20, dropSupplemental: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--partner') args.partner = argv[++i];
    else if (a === '--cycle') args.cycle = parseInt(argv[++i], 10);
    else if (a === '--sample-size') args.sampleSize = parseInt(argv[++i], 10);
    else if (a === '--drop-supplemental') args.dropSupplemental = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.partner) throw new Error('Missing --partner <slug>');
  if (args.cycle === null || Number.isNaN(args.cycle)) throw new Error('Missing --cycle <k>');
  return args;
}

function loadMinimaxKey() {
  if (process.env.MINIMAX_API_KEY) return process.env.MINIMAX_API_KEY;
  if (fs.existsSync(MINIMAX_KEY_FILE)) return fs.readFileSync(MINIMAX_KEY_FILE, 'utf8').trim();
  throw new Error(`MINIMAX_API_KEY not in env and ${MINIMAX_KEY_FILE} not present`);
}

function checkSanityGate() {
  if (process.env.SKIP_SANITY_GATE === '1') {
    console.warn('[gate] SKIP_SANITY_GATE=1 — bypassing Sprint 23 baseline gate');
    return;
  }
  if (!fs.existsSync(SANITY_RESULT_PATH)) {
    throw new Error(
      `Sanity check has not run. Execute: node scripts/sanity-check.js (first time). ` +
        `Override only with SKIP_SANITY_GATE=1 (not recommended).`,
    );
  }
  const r = JSON.parse(fs.readFileSync(SANITY_RESULT_PATH, 'utf8'));
  if (!r.pass) {
    throw new Error(`Sanity check did not PASS (drift ${r.drift_pp}pp). Iteration halted.`);
  }
}

function runPartnerCycle({ partnerSlug, cycle, sampleSize, dropSupplemental, minimaxKey }) {
  console.log(`\n=== ${partnerSlug} iter-${cycle} (N=${sampleSize}) ===`);
  const meta = PARTNER_META[partnerSlug];
  if (!meta) throw new Error(`Unknown partner: ${partnerSlug}`);

  const cycleDir = path.join(ITERATIONS_DIR, partnerSlug, `iter-${cycle}`);
  const transcriptsDir = path.join(cycleDir, 'transcripts');
  fs.mkdirSync(transcriptsDir, { recursive: true });

  const { prompt: currentPrompt, source: promptSource } = lib.loadPromptForCycle(partnerSlug, cycle);
  if (cycle === 0) lib.savePromptSnapshot(partnerSlug, 0, currentPrompt);

  const { sources, instances } = benchmarks.loadBenchmark(partnerSlug, { dropSupplemental });
  if (instances.length === 0) {
    throw new Error(`${partnerSlug} has 0 benchmark instances. Populate benchmarks/ via Phase 1 loaders first.`);
  }
  const seed = benchmarks.partnerCycleSeed(partnerSlug, cycle);
  const sample = benchmarks.sampleInstances(instances, sampleSize, { seed });
  console.log(`  Loaded ${instances.length} instances from ${sources.length} source(s); sampled ${sample.length}.`);

  const transcriptResults = [];
  for (let i = 0; i < sample.length; i++) {
    const inst = sample[i];
    const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), `oscar-llp-iter-${partnerSlug}-`));
    const recipeYaml = lib.buildIterationRecipeYaml({
      partnerSlug,
      partnerName: meta.name,
      specialism: meta.specialism,
      prompt: currentPrompt,
      instance: inst,
      workingDir,
    });
    const recipePath = path.join(workingDir, 'partner.yaml');
    fs.writeFileSync(recipePath, recipeYaml);

    const t0 = Date.now();
    const r = spawnSync(
      GOOSE_BIN,
      ['run', '--recipe', recipePath, '--no-session'],
      {
        env: { ...process.env, MINIMAX_API_KEY: minimaxKey },
        encoding: 'utf8',
        timeout: 300_000,
      },
    );
    const durationMs = Date.now() - t0;
    const stdout = r.stdout ?? '';
    const stderr = r.stderr ?? '';
    const exit = r.status ?? null;

    const approxInputTokens = Math.ceil((currentPrompt.length + (inst.source_doc_text?.length ?? 0)) / 4);
    const approxOutputTokens = Math.ceil(stdout.length / 4);
    const usd = costForMinimaxCall({
      model: 'MiniMax-M2.5',
      inputTokens: approxInputTokens,
      outputTokens: approxOutputTokens,
    });
    appendCost({ kind: 'minimax-partner-run', partner: partnerSlug, cycle, instance_id: inst.id, durationMs, exit, usd });

    const transcriptPath = path.join(transcriptsDir, `${inst.id}.log`);
    fs.writeFileSync(
      transcriptPath,
      `# Instance ${inst.id}\n# Duration: ${durationMs} ms\n# Exit: ${exit}\n\n--- stdout ---\n${stdout}\n\n--- stderr ---\n${stderr}\n`,
      'utf8',
    );

    transcriptResults.push({ instance_id: inst.id, exit, durationMs, usd });
    fs.rmSync(workingDir, { recursive: true, force: true });
    process.stdout.write(`  [${i + 1}/${sample.length}] ${inst.id} exit=${exit} dur=${durationMs}ms\n`);
  }

  fs.writeFileSync(
    path.join(cycleDir, 'manifest.json'),
    JSON.stringify(
      {
        partner: partnerSlug,
        cycle,
        prompt_source: promptSource,
        sample_size: sample.length,
        seed,
        sources,
        instances: transcriptResults,
        minimax_model: 'MiniMax-M2.5',
        goose_bin: GOOSE_BIN,
        completed_at: new Date().toISOString(),
      },
      null,
      2,
    ),
    'utf8',
  );

  const totalUsd = transcriptResults.reduce((s, r) => s + (r.usd ?? 0), 0);
  console.log(`  iter-${cycle} complete. MiniMax spend: $${totalUsd.toFixed(3)}.`);
  console.log(`\nREADY-FOR-JUDGE iterations/${partnerSlug}/iter-${cycle}/`);
}

function main() {
  const args = parseArgs();
  checkSanityGate();
  const minimaxKey = loadMinimaxKey();
  if (!fs.existsSync(GOOSE_BIN)) {
    throw new Error(`goose binary missing at ${GOOSE_BIN}; set GOOSE_BIN or build it.`);
  }
  runPartnerCycle({
    partnerSlug: args.partner,
    cycle: args.cycle,
    sampleSize: args.sampleSize,
    dropSupplemental: args.dropSupplemental,
    minimaxKey,
  });
}

try {
  main();
} catch (err) {
  console.error(`run-partner-cycle FAIL: ${err.message ?? err}`);
  process.exit(1);
}
