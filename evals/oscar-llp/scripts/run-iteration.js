#!/usr/bin/env node
// Sprint 24-C (ADR-081): iteration orchestrator. Per partner, per cycle:
// load prompt snapshot → sample N benchmark instances → invoke real MiniMax
// for each → batched Claude judge+propose call → apply subtractive removals
// → save iter-k snapshot. After 3 partners × ~4 cycles, run Phase 2 cross-
// partner pattern extraction. Final report written to reports/.
//
// Usage:
//   node scripts/run-iteration.js --all
//   node scripts/run-iteration.js --partner sarah-chen --cycles 0
//   node scripts/run-iteration.js --partner diana-park --cycles 0..3
//   node scripts/run-iteration.js --partner aisha-khan --cycles 1..2 --sample-size 10
//   node scripts/run-iteration.js --phase2-only
//
// Pre-execution gates (see README): Anthropic key, MiniMax key, sanity-check.js
// PASS. This orchestrator does NOT re-run sanity-check; it assumes a prior
// PASS exists at iterations/_sanity-check/result.json.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const lib = require('./lib-recipe24');
const benchmarks = require('./lib-benchmarks');
const claude = require('./lib-claude');
const subtractive = require('./lib-subtractive');
const report = require('./lib-report24');
const { loadCostLog, appendCost, costForMinimaxCall } = require('./lib-cost-log');

const EVAL_ROOT = path.resolve(__dirname, '..');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');
const SANITY_RESULT_PATH = path.join(ITERATIONS_DIR, '_sanity-check', 'result.json');
const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const MINIMAX_KEY_FILE = '/root/.minimax-dev-key';

const TRIO = ['sarah-chen', 'diana-park', 'aisha-khan'];
const PARTNER_META = {
  'sarah-chen': { name: 'Sarah Chen', specialism: 'M&A' },
  'diana-park': { name: 'Diana Park', specialism: 'Privacy' },
  'aisha-khan': { name: 'Aisha Khan', specialism: 'Tech Transactions' },
};

function parseArgs() {
  const args = { partner: null, cycles: '0..3', all: false, sampleSize: 20, phase2Only: false, dropSupplemental: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all') args.all = true;
    else if (a === '--phase2-only') args.phase2Only = true;
    else if (a === '--drop-supplemental') args.dropSupplemental = true;
    else if (a === '--partner') args.partner = argv[++i];
    else if (a === '--cycles') args.cycles = argv[++i];
    else if (a === '--sample-size') args.sampleSize = parseInt(argv[++i], 10);
  }
  return args;
}

function parseCycleRange(spec) {
  if (/^\d+$/.test(spec)) return [parseInt(spec, 10)];
  const m = spec.match(/^(\d+)\.\.(\d+)$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    const out = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  }
  throw new Error(`Bad --cycles spec: ${spec}`);
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
  // Snapshot the prompt used for THIS cycle's runs (so iter-0 captures the
  // composed production prompt for traceability).
  if (cycle === 0) lib.savePromptSnapshot(partnerSlug, 0, currentPrompt);

  const { sources, instances } = benchmarks.loadBenchmark(partnerSlug, { dropSupplemental });
  if (instances.length === 0) {
    console.warn(`  WARN: ${partnerSlug} has 0 benchmark instances loaded. Skipping.`);
    fs.writeFileSync(
      path.join(cycleDir, 'manifest.json'),
      JSON.stringify({ partner: partnerSlug, cycle, error: 'no instances', sources }, null, 2),
      'utf8',
    );
    return;
  }
  const seed = benchmarks.partnerCycleSeed(partnerSlug, cycle);
  const sample = benchmarks.sampleInstances(instances, sampleSize, { seed });
  console.log(`  Loaded ${instances.length} instances from ${sources.length} source(s); sampled ${sample.length}.`);

  // Phase A: run partner over sampled instances via real MiniMax.
  const transcripts = [];
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

    // Approximate token usage from transcript length; real numbers would
    // need provider headers (not exposed via goose run today). Cost is a
    // lower bound; refine when MiniMax invoices arrive.
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

    transcripts.push({ instance_id: inst.id, body: stdout, exit, durationMs });
    fs.rmSync(workingDir, { recursive: true, force: true });
    process.stdout.write(`  [${i + 1}/${sample.length}] ${inst.id} exit=${exit} dur=${durationMs}ms\n`);
  }

  // Phase B: batched Claude judge+propose call.
  console.log(`  Calling Claude judge+propose...`);
  const goldLabels = sample.map((s) => ({ id: s.id, gold_labels: s.gold_labels ?? [] }));
  const judgeResult = await_claude(
    claude.judgeAndPropose({
      partnerSlug,
      cycle,
      currentPrompt,
      transcripts,
      goldLabels,
      rubricExtras: `Partner specialism: ${meta.specialism}.`,
    }),
  );

  fs.writeFileSync(
    path.join(cycleDir, 'claude-raw.txt'),
    judgeResult.rawText ?? '(no rawText)',
    'utf8',
  );

  if (!judgeResult.ok || !judgeResult.parsed) {
    console.error(`  Claude did not return parseable JSON. See ${cycleDir}/claude-raw.txt`);
    fs.writeFileSync(
      path.join(cycleDir, 'manifest.json'),
      JSON.stringify(
        {
          partner: partnerSlug,
          cycle,
          error: 'claude-parse-failed',
          claude_usage: judgeResult.usage,
          claude_usd: judgeResult.usd,
        },
        null,
        2,
      ),
      'utf8',
    );
    return;
  }

  const parsed = judgeResult.parsed;
  // Split parsed into scores (verdicts + distribution) and proposal (removals).
  fs.writeFileSync(
    path.join(cycleDir, 'scores.json'),
    JSON.stringify(
      {
        verdicts: parsed.verdicts ?? parsed.per_instance ?? [],
        totals: parsed.totals,
        weakest_slice: parsed.weakest_slice,
        diagnosis: parsed.diagnosis,
      },
      null,
      2,
    ),
    'utf8',
  );

  const proposal = {
    removals: parsed.removals ?? [],
    diagnosis: parsed.diagnosis ?? '',
    expected_effect: parsed.expected_effect ?? '',
    escalation: parsed.escalation ?? null,
  };

  // Phase C: apply removals (if any) → save iter-(cycle+1)/prompt.txt.
  if (proposal.removals.length > 0) {
    const validation = subtractive.validateRemovals({ source: currentPrompt, removals: proposal.removals });
    if (!validation.ok) {
      console.warn(`  Validation failed: ${validation.reason}. (No retry implemented in 24-C dev harness; flag for review.)`);
      proposal.validation = validation;
    } else {
      const next = subtractive.applyRemovals({ source: currentPrompt, removals: proposal.removals });
      const subsetOk = subtractive.strictSubsetCheck({ before: currentPrompt, after: next, removals: proposal.removals });
      proposal.validation = { ok: true, totalRemoved: validation.totalRemoved, subsetOk };
      if (subsetOk) {
        lib.savePromptSnapshot(partnerSlug, cycle + 1, next);
        const diff = subtractive.emitUnifiedDiff({
          source: currentPrompt,
          removals: proposal.removals,
          beforeName: `iter-${cycle}`,
          afterName: `iter-${cycle + 1}`,
        });
        fs.writeFileSync(
          path.join(ITERATIONS_DIR, partnerSlug, `iter-${cycle + 1}`, 'diff-from-prior.patch'),
          diff,
          'utf8',
        );
      }
    }
  } else if (proposal.escalation) {
    console.log(`  Claude escalated: ${proposal.escalation}`);
  }

  fs.writeFileSync(path.join(cycleDir, 'proposal.json'), JSON.stringify(proposal, null, 2), 'utf8');
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
        claude_usage: judgeResult.usage,
        claude_usd: judgeResult.usd,
        claude_duration_ms: judgeResult.durationMs,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`  iter-${cycle} complete. Spent $${judgeResult.usd.toFixed(3)} on Claude.`);
}

// Promise-resolution helper so the orchestrator can stay sync-looking
// without forcing the entire module to async. (Node 22+ top-level await
// is fine, but this script is plain CommonJS.)
function await_claude(promise) {
  // The .judgeAndPropose() / .extractCrossPartnerPatterns() return promises;
  // we synchronously wait via Atomics if needed. Here we just attach a
  // .then sink and rely on the orchestrator's async-function wrapping
  // below to await directly.
  return promise;
}

async function main() {
  const args = parseArgs();
  checkSanityGate();

  if (args.phase2Only) {
    await runPhase2(args);
    return;
  }

  const minimaxKey = loadMinimaxKey();
  if (!fs.existsSync(GOOSE_BIN)) {
    throw new Error(`goose binary missing at ${GOOSE_BIN}; set GOOSE_BIN or build it.`);
  }

  const partners = args.all ? TRIO : args.partner ? [args.partner] : (() => { throw new Error('Specify --all or --partner <slug>'); })();
  const cycles = parseCycleRange(args.cycles);

  for (const partnerSlug of partners) {
    for (const cycle of cycles) {
      await runPartnerCycle({
        partnerSlug,
        cycle,
        sampleSize: args.sampleSize,
        dropSupplemental: args.dropSupplemental,
        minimaxKey,
      });
    }
  }

  if (args.all) {
    await runPhase2(args);
  }

  console.log('\n=== Done. Writing closing report... ===');
  await writeClosingReport(partners);
}

async function runPhase2(_args) {
  console.log('\n=== Phase 2: cross-partner pattern extraction ===\n');
  const partnerHistories = {};
  for (const p of TRIO) {
    partnerHistories[p] = report.loadPartnerTrajectory(p).map((t) => ({
      cycle: t.cycle,
      distribution: t.distribution,
      proposal: t.proposal,
      manifest: t.manifest,
    }));
  }
  const result = await claude.extractCrossPartnerPatterns({ partnerHistories });
  const outDir = path.join(ITERATIONS_DIR, '_cross-partner');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'claude-raw.txt'), result.rawText ?? '', 'utf8');
  if (result.ok && result.parsed) {
    fs.writeFileSync(path.join(outDir, 'pattern-extraction.json'), JSON.stringify(result.parsed, null, 2), 'utf8');
    console.log(`  Patterns: ${(result.parsed.patterns ?? []).length}. Saved to ${outDir}/`);
  } else {
    console.warn(`  Phase 2 returned unparseable JSON; see ${outDir}/claude-raw.txt`);
  }
}

async function writeClosingReport(partners) {
  const costLog = loadCostLog();
  const cross = (() => {
    const p = path.join(ITERATIONS_DIR, '_cross-partner', 'pattern-extraction.json');
    if (!fs.existsSync(p)) return null;
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch {
      return null;
    }
  })();
  const sanity = fs.existsSync(SANITY_RESULT_PATH) ? JSON.parse(fs.readFileSync(SANITY_RESULT_PATH, 'utf8')) : null;
  const reportPath = report.writeFinalReport({
    partnerSlugs: partners.length > 0 ? partners : TRIO,
    sanityCheckResult: sanity
      ? { status: sanity.pass ? 'PASS' : 'FAIL', summary: `new Δ=${sanity.new_delta_pp}pp; drift ${sanity.drift_pp}pp` }
      : null,
    crossPartnerExtraction: cross,
    totalCostUsd: costLog.total_usd ?? 0,
    costEntries: costLog.entries ?? [],
    honestScopeDrops: [],
  });
  console.log(`  Report: ${reportPath}`);
}

main().catch((err) => {
  console.error(`run-iteration FAIL: ${err.message ?? err}`);
  process.exit(1);
});
