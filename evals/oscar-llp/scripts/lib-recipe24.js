// Sprint 24-C (ADR-081): partner-recipe builder for iteration cycles.
// Reads a partner-prompt snapshot from iterations/<partner>/iter-<k>/prompt.ts
// (or the production prompt for iter-0), and synthesizes a per-instance
// partner recipe YAML against the Sprint 22 Tier-A MCPs + verification-pass
// sub-recipe. Adapts the Sprint 23 lib-recipe.js (frozen per ADR-077) — same
// YAML shape, but with the partner prompt loaded from a per-iteration file
// rather than hardcoded.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const sprint23 = require('../../lavern-jv/scripts/lib-recipe');

const EVAL_ROOT = path.resolve(__dirname, '..');
const ITERATIONS_DIR = path.join(EVAL_ROOT, 'iterations');
const REPO_ROOT = sprint23.REPO_ROOT;
const RESOURCES = sprint23.RESOURCES;
const MCPS_DIR = sprint23.MCPS_DIR;
const SUB_RECIPE = sprint23.SUB_RECIPE;
const TIER_A_MCPS = sprint23.TIER_A_MCPS;
const NODE_CMD = '/usr/bin/node';

// Production partner-prompt paths — for iter-0 baseline loading.
const PRODUCTION_PROMPTS = {
  'sarah-chen': path.join(
    REPO_ROOT,
    'ui',
    'desktop',
    'src',
    'components',
    'oscar',
    'oscar-llp',
    'prompts',
    'sarah-chen.ts',
  ),
  'diana-park': path.join(
    REPO_ROOT,
    'ui',
    'desktop',
    'src',
    'components',
    'oscar',
    'oscar-llp',
    'prompts',
    'diana-park.ts',
  ),
  'aisha-khan': path.join(
    REPO_ROOT,
    'ui',
    'desktop',
    'src',
    'components',
    'oscar',
    'oscar-llp',
    'prompts',
    'aisha-khan.ts',
  ),
};

const VERIFICATION_GATE_PATH = path.join(
  REPO_ROOT,
  'ui',
  'desktop',
  'src',
  'components',
  'oscar',
  'oscar-llp',
  'verificationGateBlock.ts',
);

// Extract the body of an exported template literal in a partner .ts file.
// The partner prompt is structured as:
//   export const <name>Prompt = `
//   <body>
//   `;
function extractTemplateLiteralBody(tsSource) {
  const match = tsSource.match(/export\s+const\s+\w+Prompt\s*=\s*`([\s\S]*?)`\s*;/);
  if (!match) {
    throw new Error('Could not extract partner-prompt template literal body');
  }
  return match[1].trim();
}

function extractVerificationGate(tsSource) {
  const match = tsSource.match(
    /export\s+const\s+VERIFICATION_GATE_BLOCK\s*=\s*`([\s\S]*?)`\s*;/,
  );
  if (!match) throw new Error('Could not extract VERIFICATION_GATE_BLOCK');
  return match[1].trim();
}

function loadProductionPartnerPrompt(partnerSlug) {
  const tsPath = PRODUCTION_PROMPTS[partnerSlug];
  if (!tsPath || !fs.existsSync(tsPath)) {
    throw new Error(`Production partner prompt not found for '${partnerSlug}' at ${tsPath}`);
  }
  const body = extractTemplateLiteralBody(fs.readFileSync(tsPath, 'utf8'));
  // Post-Hybrid-2 (ADR-081), partner prompt no longer carries the gate; we
  // compose it on read here to match buildOscarLLPPartnerRecipe.ts.
  const gate = extractVerificationGate(fs.readFileSync(VERIFICATION_GATE_PATH, 'utf8'));
  return `${body}\n\n${gate}`;
}

function snapshotPathFor(partnerSlug, cycle) {
  return path.join(ITERATIONS_DIR, partnerSlug, `iter-${cycle}`, 'prompt.txt');
}

function loadPromptForCycle(partnerSlug, cycle) {
  if (cycle === 0) {
    const composed = loadProductionPartnerPrompt(partnerSlug);
    return { prompt: composed, source: 'production+verificationGateBlock' };
  }
  const snapPath = snapshotPathFor(partnerSlug, cycle);
  if (!fs.existsSync(snapPath)) {
    throw new Error(`Iter-${cycle} snapshot missing for '${partnerSlug}' at ${snapPath}`);
  }
  return { prompt: fs.readFileSync(snapPath, 'utf8'), source: snapPath };
}

function savePromptSnapshot(partnerSlug, cycle, promptText) {
  const dir = path.join(ITERATIONS_DIR, partnerSlug, `iter-${cycle}`);
  fs.mkdirSync(dir, { recursive: true });
  const p = snapshotPathFor(partnerSlug, cycle);
  fs.writeFileSync(p, promptText, 'utf8');
  return p;
}

function buildIterationRecipeYaml({ partnerSlug, partnerName, specialism, prompt, instance, workingDir }) {
  // Mirrors lib-recipe.js's YAML shape (Sprint 23 ADR-077 frozen substrate),
  // with the partner prompt loaded per-iteration rather than hardcoded.
  const escape = sprint23.yamlEscape;
  const lines = [
    'version: "1.0.0"',
    `title: "Oscar LLP — ${partnerName} (Sprint 24-C iteration)"`,
    `description: "${escape(specialism)} specialist iteration cycle — instance ${instance.id}."`,
    `prompt: "${escape(instance.question)}"`,
    'instructions: |',
  ];
  for (const line of prompt.split('\n')) lines.push(`  ${line}`);
  lines.push('  ');
  lines.push('  ## Document context');
  lines.push('  ');
  for (const line of (instance.source_doc_text ?? '').split('\n')) {
    lines.push(`  ${line}`);
  }
  lines.push('extensions:');
  lines.push('  - type: stdio');
  lines.push('    name: oscar-fs');
  lines.push(`    description: "Filesystem scoped to ${partnerName}'s iteration working folder."`);
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
  lines.push('  max_turns: 12');
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  EVAL_ROOT,
  ITERATIONS_DIR,
  PRODUCTION_PROMPTS,
  loadProductionPartnerPrompt,
  loadPromptForCycle,
  savePromptSnapshot,
  snapshotPathFor,
  buildIterationRecipeYaml,
};
