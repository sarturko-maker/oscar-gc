#!/usr/bin/env node
// Sprint 23 (ADR-077): Lavern-baselined eval runner.
// Enumerates {partners × docs × configs} = 3 × 3 × 2 = 18 partner runs +
// 18 batched judge calls on real MiniMax-M2.5. Persists transcripts +
// scores + manifest + REPORT.md to runs/<ISO-timestamp>/.
//
// Per CLAUDE.md: "Pipeline tests must NOT mock LLM calls." Both partner
// invocations AND judge invocations are real MiniMax calls. Skip via
// SKIP_MINIMAX_TESTS=1 (entire eval bails out).
//
// Invocation:
//   node evals/lavern-jv/scripts/run-eval.js                    (default: full sweep)
//   --partners sarah-chen,helena-voss                            (default: all 3)
//   --docs doc1-borrowmoney                                       (default: all 3)
//   --configs with-ralph                                          (default: both)
//   --skip-judge                                                  (partner runs only)
//   --judge-only --from-run runs/<ts>                             (re-score saved transcripts)

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execSync, spawnSync } = require('node:child_process');
const {
  EVAL_ROOT,
  PARTNERS,
  DOCS,
  buildPartnerRecipeYaml,
  resolveMinimaxKey,
} = require('./lib-recipe');
const { runJudge } = require('./lib-judge');
const { writeReport } = require('./lib-report');

const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const LAVERN_SHA = '7c2efe61524b14c632bee8f14d9bbcbdd85d0cfd';
const SPRINT22_BASELINE_SHA = '08a5381a7';
const MODEL = 'MiniMax-M2.5';

function parseArgs(argv) {
  const out = {
    partners: Object.keys(PARTNERS),
    docs: Object.keys(DOCS),
    configs: ['with-ralph', 'without-ralph'],
    skipJudge: false,
    judgeOnly: false,
    fromRun: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--partners') out.partners = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--docs') out.docs = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--configs') out.configs = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--skip-judge') out.skipJudge = true;
    else if (a === '--judge-only') out.judgeOnly = true;
    else if (a === '--from-run') out.fromRun = next();
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(__filename, 'utf8').split('\n').slice(0, 17).join('\n'));
      process.exit(0);
    } else {
      console.error(`unknown flag: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function gitSha() {
  try {
    return execSync('git rev-parse HEAD', { cwd: path.resolve(EVAL_ROOT, '..', '..'), encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function extractPartnerResponse(stdout) {
  // Goose CLI emits the assistant reply text after a banner. The partner's
  // response includes intermixed tool-call lines (▸ token_name extension);
  // for the judge, we need the assistant's prose. Conservative approach:
  // pass the full stdout to the judge — it can parse the structure itself.
  // Trim the goose banner if recognizable.
  const bannerEnd = stdout.indexOf('goose is ready');
  if (bannerEnd >= 0) {
    const tail = stdout.slice(stdout.indexOf('\n', bannerEnd) + 1);
    return tail.trim();
  }
  return stdout.trim();
}

function main() {
  if (process.env.SKIP_MINIMAX_TESTS === '1') {
    console.warn('[skip] SKIP_MINIMAX_TESTS=1 — not running');
    process.exit(0);
  }

  const args = parseArgs(process.argv.slice(2));
  const minimaxKey = resolveMinimaxKey();

  if (!fs.existsSync(GOOSE_BIN)) fail(`goose binary missing at ${GOOSE_BIN}`);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = args.judgeOnly && args.fromRun ? path.resolve(args.fromRun) : path.join(EVAL_ROOT, 'runs', ts);
  const transcriptsDir = path.join(runDir, 'transcripts');
  const scoresDir = path.join(runDir, 'scores');
  fs.mkdirSync(transcriptsDir, { recursive: true });
  fs.mkdirSync(scoresDir, { recursive: true });

  console.log(`=== Sprint 23 eval — ${args.partners.length}×${args.docs.length}×${args.configs.length} = ${args.partners.length * args.docs.length * args.configs.length} runs ===`);
  console.log(`run dir: ${runDir}`);

  const t0 = Date.now();
  const tuples = [];
  for (const partner of args.partners) {
    for (const doc of args.docs) {
      for (const config of args.configs) {
        tuples.push({ partner, doc, config });
      }
    }
  }

  let partnerSucceeded = 0;
  let judgeSucceeded = 0;

  for (const { partner, doc, config } of tuples) {
    const stem = `${partner}-${doc}-${config}`;
    const transcriptPath = path.join(transcriptsDir, `${stem}.log`);
    const scorePath = path.join(scoresDir, `${stem}.json`);

    let partnerResponse;

    if (args.judgeOnly) {
      // Read saved transcript for re-scoring.
      if (!fs.existsSync(transcriptPath)) {
        console.warn(`  [skip] no transcript at ${transcriptPath}`);
        continue;
      }
      partnerResponse = fs.readFileSync(transcriptPath, 'utf8');
      console.log(`\n--- judge-only: ${stem} ---`);
    } else {
      console.log(`\n--- ${stem} ---`);
      const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), `lavern-eval-${partner}-${doc}-`));
      const recipePath = path.join(workingDir, `${stem}.yaml`);
      fs.writeFileSync(recipePath, buildPartnerRecipeYaml(partner, doc, workingDir, config));

      const started = Date.now();
      const r = spawnSync(
        GOOSE_BIN,
        ['run', '--recipe', recipePath, '--no-session'],
        {
          env: { ...process.env, MINIMAX_API_KEY: minimaxKey },
          encoding: 'utf8',
          timeout: 300_000,
        },
      );
      const durationMs = Date.now() - started;

      const transcript = [
        `# Partner: ${partner}`,
        `# Doc: ${doc}`,
        `# Config: ${config}`,
        `# Duration: ${durationMs} ms`,
        `# Exit code: ${r.status}`,
        `# Signal: ${r.signal ?? 'none'}`,
        `--- stdout ---`,
        r.stdout ?? '',
        `--- stderr ---`,
        r.stderr ?? '',
      ].join('\n');
      fs.writeFileSync(transcriptPath, transcript);
      console.log(`  partner: exit=${r.status} duration=${durationMs}ms`);

      fs.rmSync(workingDir, { recursive: true, force: true });

      if (r.status !== 0) {
        console.warn(`  [warn] partner exited non-zero; judge will use whatever stdout was captured`);
      } else {
        partnerSucceeded++;
      }
      partnerResponse = extractPartnerResponse(r.stdout ?? '');
    }

    if (args.skipJudge) {
      console.log('  [skip judge]');
      continue;
    }

    // Run judge.
    const judgeStarted = Date.now();
    const judgeResult = runJudge({
      docId: doc,
      partnerSlug: partner,
      config,
      partnerResponse,
      minimaxKey,
      transcriptsDir,
    });
    const judgeMs = Date.now() - judgeStarted;
    fs.writeFileSync(scorePath, JSON.stringify(judgeResult, null, 2));
    if (judgeResult.ok) {
      judgeSucceeded++;
      const total = judgeResult.parsed.items.length;
      const covered = judgeResult.parsed.items.filter((it) => it.verdict === 'COVERED').length;
      console.log(`  judge:   exit ok (${judgeMs}ms) — ${covered}/${total} COVERED, halluc=${judgeResult.parsed.global.hallucination_count}`);
    } else {
      console.warn(`  judge:   PARSE_FAILED — ${judgeResult.error}`);
    }
  }

  const wallSec = (Date.now() - t0) / 1000;

  // Compose manifest + report.
  const { loadAllScores } = require('./lib-report');
  const scores = loadAllScores(scoresDir);
  const manifest = {
    timestamp: ts,
    oscar_sha: gitSha(),
    lavern_sha: LAVERN_SHA,
    sprint22_baseline_sha: SPRINT22_BASELINE_SHA,
    model: MODEL,
    wall_clock_seconds: wallSec,
    partner_runs_total: tuples.length,
    partner_runs_succeeded: partnerSucceeded,
    judge_calls_total: tuples.length,
    judge_calls_succeeded: judgeSucceeded,
    args,
  };
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  writeReport({ runDir, scores, manifest });

  console.log(`\n=== Done in ${wallSec.toFixed(1)}s ===`);
  console.log(`partners: ${partnerSucceeded}/${tuples.length}, judges: ${judgeSucceeded}/${tuples.length}`);
  console.log(`report:   ${path.join(runDir, 'REPORT.md')}`);

  // Exit 0 if at least half the judges succeeded — partial sweeps are
  // diagnostic, not failures.
  process.exit(judgeSucceeded >= tuples.length / 2 ? 0 : 1);
}

main();
