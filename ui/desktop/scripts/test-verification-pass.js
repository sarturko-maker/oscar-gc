#!/usr/bin/env node
// Sprint 22: no-LLM wiring test for the verification-pass sub-recipe.
//
// Validates:
//   1. verification-pass.yaml parses cleanly via Goose's recipe loader.
//   2. A parent recipe with sub_recipes pointing at verification-pass parses too
//      (i.e. the SubRecipe path-resolution chain works for our shape).
//
// Invocation:
//   node ui/desktop/scripts/test-verification-pass.js
//
// Optional env: GOOSE_BIN (defaults to /srv/projects/goose/target/release/goose).

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const SUB_RECIPE = path.join(
  REPO_ROOT,
  'ui',
  'desktop',
  'src',
  'resources',
  'sub-recipes',
  'verification-pass.yaml',
);

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

if (!fs.existsSync(GOOSE_BIN)) {
  fail(`goose binary not at ${GOOSE_BIN}. Set GOOSE_BIN or build the binary.`);
}
if (!fs.existsSync(SUB_RECIPE)) {
  fail(`verification-pass.yaml missing at ${SUB_RECIPE}`);
}

function runGoose(args) {
  const r = spawnSync(GOOSE_BIN, args, { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

// 1) verification-pass.yaml parses + --explain shows the title.
console.log(`[1/2] goose run --recipe ${path.basename(SUB_RECIPE)} --explain`);
const explainSub = runGoose(['run', '--recipe', SUB_RECIPE, '--explain']);
if (explainSub.status !== 0) {
  console.error(explainSub.stderr || explainSub.stdout);
  fail(`goose --explain on verification-pass.yaml exited ${explainSub.status}`);
}
const subOut = explainSub.stdout + explainSub.stderr;
if (!/Verification Pass/i.test(subOut)) {
  console.error(subOut);
  fail(`--explain output did not include the title "Verification Pass"`);
}
console.log('ok: verification-pass.yaml parses; title resolved');

// 2) Build a tiny parent recipe pointing at verification-pass via sub_recipes,
//    write it to a temp YAML, and verify --explain succeeds. This validates the
//    SubRecipe path-resolution chain Goose uses at session-spawn time.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'oscar-vp-test-'));
const parentYaml = path.join(tmpDir, 'parent-recipe.yaml');
fs.writeFileSync(
  parentYaml,
  [
    'version: "1.0.0"',
    'title: "VP Wiring Test Parent"',
    'description: "Synthetic parent recipe that delegates to verification-pass."',
    'instructions: |',
    '  This is a synthetic recipe used by the Sprint 22 wiring test.',
    '  It declares verification-pass as a sub-recipe; Goose should auto-inject',
    '  summon and resolve the SubRecipe path.',
    'sub_recipes:',
    '  - name: "verification-pass"',
    `    path: "${SUB_RECIPE}"`,
    '    description: "Pre-delivery citation-grounding + structural-check pass."',
    '',
  ].join('\n'),
  'utf8',
);

console.log('[2/2] goose run --recipe <parent> --explain  (parent declares sub_recipes)');
const explainParent = runGoose(['run', '--recipe', parentYaml, '--explain']);
fs.rmSync(tmpDir, { recursive: true, force: true });
if (explainParent.status !== 0) {
  console.error(explainParent.stderr || explainParent.stdout);
  fail(`goose --explain on parent recipe exited ${explainParent.status}`);
}
const parentOut = explainParent.stdout + explainParent.stderr;
if (!/VP Wiring Test Parent/.test(parentOut)) {
  console.error(parentOut);
  fail(`parent --explain output did not include the title`);
}
console.log('ok: parent recipe with sub_recipes path resolves');

console.log('\nALL CHECKS PASS');
