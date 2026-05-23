#!/usr/bin/env node
// Sprint 24-B (ADR-079): Lavern Pipeline end-to-end test. Synthesizes the
// pipeline parent recipe inline (mirrors buildLavernPipelineRecipe.ts output
// and Sprint 22 test-oscar-llp-agents.js shape); runs it through real
// MiniMax (per CLAUDE.md "Pipeline tests must NOT mock LLM calls"); asserts
// the three pipeline stages fired correctly.
//
// Two modes:
//   --parse-only : Phase 1 validation. Synthesizes the parent + 3 sub-recipe
//                  YAMLs, runs `goose run --recipe <yaml> --explain` on each
//                  to confirm parse-time correctness. No LLM cost.
//   (default)    : Phase 2 end-to-end. Single doc (Sprint 23's CUAD JV doc
//                  at evals/lavern-jv/docs/borrowmoneycom_06_11_2020.txt);
//                  asserts Watchman + Reader fire and Curator does NOT
//                  (single-doc mode).
//
// Invocation:
//   node ui/desktop/scripts/test-lavern-pipeline.js [--parse-only]
//   GOOSE_BIN=/path/to/goose node ui/desktop/scripts/test-lavern-pipeline.js
//
// Phase 2 costs real MiniMax API tokens (~$0.15-0.25 per run). Skip in CI
// by setting SKIP_MINIMAX_TESTS=1.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const PARSE_ONLY = process.argv.includes('--parse-only');

const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const KEY_FILE = '/root/.minimax-dev-key';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RESOURCES = path.join(REPO_ROOT, 'ui', 'desktop', 'src', 'resources');
const MCPS_DIR = path.join(RESOURCES, 'mcps');
const SUB_RECIPES_SRC = path.join(REPO_ROOT, 'ui', 'desktop', 'sub-recipes');
const TRANSCRIPTS_DIR = path.join(REPO_ROOT, 'ui', 'desktop', 'tests', 'lavern-pipeline-transcripts');
const NODE_CMD = '/usr/bin/node';
const CUAD_JV_DOC = path.join(
  REPO_ROOT,
  'evals',
  'lavern-jv',
  'docs',
  'borrowmoneycom_06_11_2020.txt',
);

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (process.env.SKIP_MINIMAX_TESTS === '1' && !PARSE_ONLY) {
  console.warn('[skip] SKIP_MINIMAX_TESTS=1 — not running Phase 2 (LLM) tests');
  process.exit(0);
}

if (!fs.existsSync(GOOSE_BIN)) {
  fail(`goose binary not at ${GOOSE_BIN}. Set GOOSE_BIN or build the binary.`);
}

// Sub-recipe YAMLs must exist at the source dir (bundler copies them into
// resources/sub-recipes/ at build time; dev tests read from source).
const STAGE_YAMLS = ['lavern-watchman', 'lavern-reader', 'lavern-curator'];
for (const name of STAGE_YAMLS) {
  const p = path.join(SUB_RECIPES_SRC, `${name}.yaml`);
  if (!fs.existsSync(p)) fail(`Stage sub-recipe missing: ${p}`);
}

// Tier-A MCPs the pipeline needs (subset of Sprint 22 — only oscar-fs,
// oscar-document-reader, oscar-grounding-verifier, oscar-baselines).
const PIPELINE_MCPS = [
  'oscar-document-reader',
  'oscar-grounding-verifier',
  'oscar-baselines',
];
for (const m of PIPELINE_MCPS) {
  const bundle = path.join(MCPS_DIR, m, 'index.js');
  if (!fs.existsSync(bundle)) {
    fail(
      `Pipeline MCP bundle missing at ${bundle}. Run prepare-oscar-bundle.js (or pnpm bundle:oscar-linux) first.`,
    );
  }
}
const FS_BUNDLE = path.join(MCPS_DIR, 'oscar-fs', 'index.js');
if (!fs.existsSync(FS_BUNDLE)) fail(`oscar-fs bundle missing at ${FS_BUNDLE}`);

let minimaxKey = process.env.MINIMAX_API_KEY;
if (!PARSE_ONLY) {
  if (!minimaxKey && fs.existsSync(KEY_FILE)) {
    minimaxKey = fs.readFileSync(KEY_FILE, 'utf8').trim();
  }
  if (!minimaxKey) {
    fail(`MINIMAX_API_KEY not in env and ${KEY_FILE} not present`);
  }
  if (!fs.existsSync(CUAD_JV_DOC)) fail(`Test doc missing: ${CUAD_JV_DOC}`);
}

function yamlEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

const PIPELINE_INSTRUCTIONS = [
  'You are the orchestrator of the Lavern Pipeline. You receive one or more document paths in {{ doc_paths }}, one per line. For each document:',
  '',
  '  1. Call delegate(source: "watchman", parameters: {doc_path: <path>}). It returns a JSON object {documentType, jurisdiction, route, ...}. Parse it.',
  '',
  '  2. If route == "skip", record the skip reason and continue. If route == "quick-scan" or "deep-read", call delegate(source: "reader", parameters: {doc_path: <path>, document_type: <from-watchman>, jurisdiction: <from-watchman>}). It returns markdown — capture verbatim.',
  '',
  'After all docs are processed, count those analysed (excluding skips).',
  '',
  '  3. If count >= 2, call delegate(source: "curator", parameters: {reader_summaries: <concatenation>}). It returns one paragraph OR a no-pattern sentence.',
  '  4. If count < 2, skip Curator entirely. State this explicitly.',
  '',
  'Final reply structure:',
  '  ## Lavern Pipeline Run',
  '  ### Watchman triage',
  '  ### Per-document Reader reports',
  '  ### Cross-document synthesis (Curator)',
  '',
  'Do not editorialise. The stages do the thinking; you marshal their outputs.',
].join('\n');

function buildPipelineRecipeYaml({ docPaths, workingDir, precedentsDir }) {
  const lines = [
    'version: "1.0.0"',
    'title: "Oscar LLP — Lavern Pipeline"',
    'description: "Sprint 24-B end-to-end test fixture — synthesized inline."',
    `prompt: "Run the pipeline on these documents:\\n${docPaths.map((p) => yamlEscape(p)).join('\\n')}"`,
    'parameters:',
    '  - key: doc_paths',
    '    input_type: string',
    '    requirement: optional',
    '    default: ""',
    '    description: "Inline test stub — paths injected via instructions."',
    'instructions: |',
  ];
  for (const line of PIPELINE_INSTRUCTIONS.split('\n')) {
    lines.push(`  ${line}`);
  }
  lines.push('  ');
  lines.push('  ## Documents to analyse');
  for (const p of docPaths) lines.push(`  - ${p}`);
  lines.push('extensions:');
  lines.push('  - type: stdio');
  lines.push('    name: oscar-fs');
  lines.push('    description: "Filesystem scoped to pipeline working folder."');
  lines.push(`    cmd: "${NODE_CMD}"`);
  lines.push('    args:');
  lines.push(`      - "${FS_BUNDLE}"`);
  lines.push(`      - "${workingDir}"`);
  lines.push('    envs: {}');
  lines.push('    timeout: 30');
  for (const mcp of PIPELINE_MCPS) {
    lines.push('  - type: stdio');
    lines.push(`    name: ${mcp}`);
    lines.push(`    description: "Sprint 24-B Lavern pipeline MCP: ${mcp}."`);
    lines.push(`    cmd: "${NODE_CMD}"`);
    lines.push('    args:');
    lines.push(`      - "${MCPS_DIR}/${mcp}/index.js"`);
    if (mcp === 'oscar-baselines') {
      lines.push('    envs:');
      lines.push(`      OSCAR_BASELINES_DIR: "${precedentsDir}"`);
    } else {
      lines.push('    envs: {}');
    }
    lines.push('    timeout: 30');
  }
  lines.push('sub_recipes:');
  for (const name of STAGE_YAMLS) {
    const p = path.join(SUB_RECIPES_SRC, `${name}.yaml`);
    const stageName = name.replace(/^lavern-/, '');
    lines.push(`  - name: "${stageName}"`);
    lines.push(`    path: "${p}"`);
    lines.push(`    description: "Sprint 24-B Lavern pipeline stage: ${stageName}."`);
  }
  lines.push('settings:');
  lines.push('  goose_provider: "minimax"');
  lines.push('  goose_model: "MiniMax-M2.5"');
  lines.push('  max_turns: 40');
  lines.push('');
  return lines.join('\n');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

ensureDir(TRANSCRIPTS_DIR);

// ── Phase 1: parse-only validation ─────────────────────────────────────
if (PARSE_ONLY) {
  console.log('=== Phase 1: parse-time validation ===\n');
  // Validate each stage sub-recipe via goose's recipe-parse path (--explain
  // prints the resolved recipe). If parse fails, goose exits non-zero.
  let failures = 0;
  for (const name of STAGE_YAMLS) {
    const yamlPath = path.join(SUB_RECIPES_SRC, `${name}.yaml`);
    const r = spawnSync(
      GOOSE_BIN,
      ['run', '--recipe', yamlPath, '--explain'],
      { encoding: 'utf8', timeout: 15_000 },
    );
    const ok = r.status === 0;
    console.log(`  ${name}: ${ok ? 'PARSE OK' : `FAIL exit ${r.status}`}`);
    if (!ok) {
      console.error(r.stderr || r.stdout);
      failures++;
    }
  }

  // Validate the synthesized parent recipe.
  const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavern-pipeline-parse-'));
  const precedentsDir = path.join(workingDir, 'precedents');
  ensureDir(precedentsDir);
  const recipePath = path.join(workingDir, 'lavern-pipeline.yaml');
  fs.writeFileSync(
    recipePath,
    buildPipelineRecipeYaml({ docPaths: [CUAD_JV_DOC], workingDir, precedentsDir }),
  );
  const r = spawnSync(
    GOOSE_BIN,
    ['run', '--recipe', recipePath, '--explain'],
    { encoding: 'utf8', timeout: 15_000 },
  );
  const ok = r.status === 0;
  console.log(`  lavern-pipeline (parent): ${ok ? 'PARSE OK' : `FAIL exit ${r.status}`}`);
  if (!ok) {
    console.error(r.stderr || r.stdout);
    failures++;
  }
  fs.rmSync(workingDir, { recursive: true, force: true });

  if (failures > 0) {
    console.error(`\n${failures} parse failure(s).`);
    process.exit(1);
  }
  console.log('\nALL YAMLS PARSE OK');
  process.exit(0);
}

// ── Phase 2: end-to-end on one CUAD JV doc ─────────────────────────────
console.log('=== Phase 2: end-to-end on borrowmoneycom_06_11_2020.txt ===\n');

const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lavern-pipeline-e2e-'));
const precedentsDir = path.join(workingDir, 'precedents');
ensureDir(precedentsDir);
const recipePath = path.join(workingDir, 'lavern-pipeline.yaml');
fs.writeFileSync(
  recipePath,
  buildPipelineRecipeYaml({ docPaths: [CUAD_JV_DOC], workingDir, precedentsDir }),
);
console.log(`recipe: ${recipePath}`);
console.log(`doc:    ${CUAD_JV_DOC}`);

const started = Date.now();
const r = spawnSync(
  GOOSE_BIN,
  ['run', '--recipe', recipePath, '--no-session'],
  {
    env: { ...process.env, MINIMAX_API_KEY: minimaxKey },
    encoding: 'utf8',
    timeout: 360_000, // 6 minutes — pipeline has up to 40 parent turns + nested sub-recipe loops
  },
);
const durationMs = Date.now() - started;

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const transcriptPath = path.join(TRANSCRIPTS_DIR, `pipeline-${ts}.log`);
const transcript = [
  `# Lavern Pipeline end-to-end test`,
  `# Doc: ${CUAD_JV_DOC}`,
  `# Duration: ${durationMs} ms`,
  `# Exit: ${r.status}  Signal: ${r.signal ?? 'none'}`,
  `--- stdout ---`,
  r.stdout ?? '',
  `--- stderr ---`,
  r.stderr ?? '',
].join('\n');
fs.writeFileSync(transcriptPath, transcript, 'utf8');
console.log(`transcript: ${transcriptPath}`);
console.log(`exit=${r.status}  duration=${durationMs}ms`);

fs.rmSync(workingDir, { recursive: true, force: true });

if (r.status !== 0) {
  console.error('Pipeline exited non-zero — check transcript stderr.');
  process.exit(1);
}

const out = (r.stdout ?? '') + (r.stderr ?? '');
const watchmanInvoked = /delegate[^\n]*source[^\n]*watchman/i.test(out);
const readerInvoked = /delegate[^\n]*source[^\n]*reader/i.test(out);
const curatorInvoked = /delegate[^\n]*source[^\n]*curator/i.test(out);

const checks = {
  watchmanInvoked,
  readerInvoked,
  curatorSkipped: !curatorInvoked, // single doc → Curator should NOT fire
};
console.log('checks:', JSON.stringify(checks));

const failures = Object.entries(checks).filter(([, v]) => !v);
if (failures.length > 0) {
  console.error(`Failed checks: ${failures.map(([k]) => k).join(', ')}`);
  process.exit(1);
}

console.log('\nALL PIPELINE CHECKS PASS');
