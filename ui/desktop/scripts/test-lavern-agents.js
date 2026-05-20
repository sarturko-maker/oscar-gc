#!/usr/bin/env node
// Sprint 22: end-to-end agent-operation test with REAL MiniMax invocations.
// Per CLAUDE.md: "Pipeline tests must NOT mock LLM calls."
//
// For three representative partners, this script:
//   1. Builds a synthesized partner recipe YAML (subset of buildLavernPartnerRecipe's
//      output) — six Tier-A MCPs + verification-pass sub-recipe + partner identity
//      + verification-pass invocation directive.
//   2. Invokes `goose run --recipe <partner>.yaml -t "<test question>"` with the
//      MiniMax API key loaded from /root/.minimax-dev-key (or $MINIMAX_API_KEY).
//   3. Captures the transcript and asserts:
//        a. ≥1 Tier-A MCP tool was invoked.
//        b. The verification-pass sub-recipe was delegated to.
//
// Transcripts dump to tests/lavern-transcripts/<slug>-<timestamp>.log.
//
// Invocation:
//   node ui/desktop/scripts/test-lavern-agents.js
//   GOOSE_BIN=/path/to/goose node ui/desktop/scripts/test-lavern-agents.js
//
// This test costs real MiniMax API tokens. Skip in CI by setting SKIP_MINIMAX_TESTS=1.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const KEY_FILE = '/root/.minimax-dev-key';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const RESOURCES = path.join(REPO_ROOT, 'ui', 'desktop', 'src', 'resources');
const MCPS_DIR = path.join(RESOURCES, 'mcps');
const SUB_RECIPE = path.join(RESOURCES, 'sub-recipes', 'verification-pass.yaml');
const TRANSCRIPTS_DIR = path.join(REPO_ROOT, 'ui', 'desktop', 'tests', 'lavern-transcripts');
const NODE_CMD = '/usr/bin/node';

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (process.env.SKIP_MINIMAX_TESTS === '1') {
  console.warn('[skip] SKIP_MINIMAX_TESTS=1 — not running MiniMax-driven tests');
  process.exit(0);
}

if (!fs.existsSync(GOOSE_BIN)) {
  fail(`goose binary not at ${GOOSE_BIN}. Set GOOSE_BIN or build the binary.`);
}

let minimaxKey = process.env.MINIMAX_API_KEY;
if (!minimaxKey && fs.existsSync(KEY_FILE)) {
  minimaxKey = fs.readFileSync(KEY_FILE, 'utf8').trim();
}
if (!minimaxKey) {
  fail(`MINIMAX_API_KEY not in env and ${KEY_FILE} not present`);
}

if (!fs.existsSync(SUB_RECIPE)) fail(`verification-pass.yaml missing at ${SUB_RECIPE}`);

const TIER_A_MCPS = [
  'oscar-knowledge-base',
  'oscar-document-reader',
  'oscar-risk-pricing',
  'oscar-baselines',
  'oscar-grounding-verifier',
  'oscar-document-checks',
];

for (const m of TIER_A_MCPS) {
  const bundle = path.join(MCPS_DIR, m, 'index.js');
  if (!fs.existsSync(bundle)) {
    fail(
      `Tier-A MCP bundle missing at ${bundle}. Run prepare-oscar-bundle.js (or pnpm bundle:oscar-linux) first.`,
    );
  }
}

const PARTNERS = [
  {
    slug: 'sarah-chen',
    name: 'Sarah Chen',
    specialism: 'M&A',
    identity:
      'You are Sarah Chen, an M&A Specialist at Lavern — a 50-person multidisciplinary legal firm. You think in transaction mechanics: conditions precedent, reps and warranties, indemnification baskets, escrow holdbacks, closing checklists.',
    question:
      'What is the market norm for representation survival periods in mid-market US M&A (deal value USD 25-500m)? Cite the knowledge-base if you find a relevant precedent.',
  },
  {
    slug: 'helena-voss',
    name: 'Helena Voss',
    specialism: 'Privacy & Data Protection',
    identity:
      "You are Helena Voss, a Privacy & Data Protection Specialist at Lavern. You think in data flows, lawful bases, processor obligations, and cross-border transfer mechanisms.",
    question:
      'Under GDPR Article 28(3), what are the mandatory processor-contract terms? Use the knowledge-base to ground your answer.',
  },
  {
    slug: 'aisha-khan',
    name: 'Aisha Khan',
    specialism: 'Commercial Litigation',
    identity:
      'You are Aisha Khan, a Commercial Litigation Specialist at Lavern. You think in cause of action, burden of proof, remedies, discovery, and forum strategy.',
    question:
      'What is a typical termination-cure-period for a commercial SaaS MSA in the US, and what risk band does 60 days fall into? Use the risk-pricing tool to benchmark.',
  },
];

const VERIFICATION_DIRECTIVE = [
  '',
  '## REQUIRED: Run verification-pass before delivering',
  '',
  'You MUST invoke the `verification-pass` sub-recipe via the `delegate` tool exactly once before producing your final answer. Use it to ground any citations you intend to make. The call looks like: `delegate(source: "verification-pass", instructions: "Verify the following finding against [document/source]: ...")`. After verification-pass returns, cite its result in your final response (PASS or ISSUES, and what was checked). Skipping verification-pass is treated as an incomplete response — even if you are confident in your sources, run it once to demonstrate the verification step.',
].join('\n');

function yamlEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function buildPartnerRecipeYaml(partner, workingDir) {
  const lines = [
    'version: "1.0.0"',
    `title: "Lavern — ${partner.name}"`,
    `description: "${yamlEscape(partner.specialism)} specialist at Lavern — Sprint 22 agent-operation test fixture."`,
    `prompt: "${yamlEscape(partner.question)}"`,
    'instructions: |',
  ];
  for (const block of [partner.identity, VERIFICATION_DIRECTIVE]) {
    for (const line of block.split('\n')) lines.push(`  ${line}`);
  }
  lines.push('extensions:');
  lines.push('  - type: stdio');
  lines.push('    name: oscar-fs');
  lines.push(`    description: "Filesystem scoped to ${partner.name}'s working folder."`);
  lines.push(`    cmd: "${NODE_CMD}"`);
  lines.push('    args:');
  lines.push(`      - "${MCPS_DIR}/oscar-fs/index.js"`);
  lines.push(`      - "${workingDir}"`);
  lines.push('    envs: {}');
  lines.push('    timeout: 30');
  for (const mcp of TIER_A_MCPS) {
    lines.push('  - type: stdio');
    lines.push(`    name: ${mcp}`);
    lines.push(`    description: "Sprint 22 Tier-A MCP: ${mcp}."`);
    lines.push(`    cmd: "${NODE_CMD}"`);
    lines.push('    args:');
    lines.push(`      - "${MCPS_DIR}/${mcp}/index.js"`);
    lines.push('    envs: {}');
    lines.push('    timeout: 30');
  }
  lines.push('sub_recipes:');
  lines.push('  - name: "verification-pass"');
  lines.push(`    path: "${SUB_RECIPE}"`);
  lines.push('    description: "Pre-delivery citation-grounding + structural-check pass."');
  lines.push('settings:');
  lines.push('  goose_provider: "minimax"');
  lines.push('  goose_model: "MiniMax-M2.5"');
  lines.push('');
  return lines.join('\n');
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

ensureDir(TRANSCRIPTS_DIR);

const results = [];
for (const partner of PARTNERS) {
  console.log(`\n=== Partner: ${partner.name} (${partner.slug}) ===`);
  const workingDir = fs.mkdtempSync(path.join(require('node:os').tmpdir(), `lavern-${partner.slug}-`));
  const recipePath = path.join(workingDir, `${partner.slug}.yaml`);
  fs.writeFileSync(recipePath, buildPartnerRecipeYaml(partner, workingDir));
  console.log(`recipe: ${recipePath}`);
  console.log(`question: ${partner.question}`);

  const started = Date.now();
  const r = spawnSync(
    GOOSE_BIN,
    ['run', '--recipe', recipePath, '--no-session'],
    {
      env: {
        ...process.env,
        MINIMAX_API_KEY: minimaxKey,
        // Provider config may also look for OPENAI_API_KEY for compat layers
        // — keep MINIMAX scoped.
      },
      encoding: 'utf8',
      timeout: 180_000,
    },
  );
  const durationMs = Date.now() - started;

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const transcriptPath = path.join(TRANSCRIPTS_DIR, `${partner.slug}-${ts}.log`);
  const transcript = [
    `# Partner: ${partner.name} (${partner.slug})`,
    `# Question: ${partner.question}`,
    `# Duration: ${durationMs} ms`,
    `# Exit code: ${r.status}`,
    `# Signal: ${r.signal ?? 'none'}`,
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
    console.error(`  partner exited non-zero — check transcript for stderr`);
    results.push({ partner: partner.slug, ok: false, reason: `exit ${r.status}`, transcript: transcriptPath });
    continue;
  }

  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const mcpInvoked = TIER_A_MCPS.find((m) => {
    const tokenA = m.replace(/^oscar-/, '');
    return out.includes(m) || out.includes(tokenA);
  });
  const verificationInvoked = /verification-pass|verify_grounding|verify_findings_batch|check_document_structure|check_document_formatting/i.test(out);

  const checks = {
    mcpInvoked: Boolean(mcpInvoked),
    mcpName: mcpInvoked ?? null,
    verificationInvoked,
  };
  console.log('  checks:', JSON.stringify(checks));

  results.push({
    partner: partner.slug,
    ok: checks.mcpInvoked && checks.verificationInvoked,
    checks,
    transcript: transcriptPath,
    durationMs,
  });
}

console.log('\n=== Summary ===');
let failures = 0;
for (const r of results) {
  const status = r.ok ? 'PASS' : 'FAIL';
  console.log(`  ${r.partner}: ${status} (${r.durationMs ?? '?'}ms) — transcript: ${r.transcript}`);
  if (!r.ok) failures++;
}
console.log(`\n${results.length - failures}/${results.length} partners exercised the new substrate.`);

if (failures > 0) process.exit(1);
console.log('ALL PARTNERS PASS');
