// Sprint 23 (ADR-077): MiniMax-as-judge invocation. One judge call per
// (partner × doc × config) covering all rubric items for that doc.
// Output is a single JSON object validated against the schema. One retry
// on parse failure with a sharpening prompt. JUDGE_PARSE_FAILED on the
// second failure (excluded from aggregation).

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { EVAL_ROOT, loadDocText, yamlEscape } = require('./lib-recipe');

const GOOSE_BIN = process.env.GOOSE_BIN ?? '/srv/projects/goose/target/release/goose';
const JUDGE_SYSTEM_PROMPT = fs.readFileSync(path.join(EVAL_ROOT, 'prompts', 'judge-system.md'), 'utf8');

const VALID_VERDICTS = new Set(['COVERED', 'PARTIAL', 'MISSED', 'WRONG']);

function loadRubric(docId) {
  const file = path.join(EVAL_ROOT, 'rubric', `${docId}.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildJudgeRecipeYaml(docId, partnerSlug, config, partnerResponse) {
  const docText = loadDocText(docId);
  const rubric = loadRubric(docId);
  const rubricSummary = rubric.items
    .map((it) => `  - ${it.id} [${it.severity}, ${it.where}]: ${it.risk}`)
    .join('\n');

  const judgePrompt = [
    `Judge this partner consultation. Respond with ONLY a single JSON object matching the schema in your instructions. No prose outside the JSON.`,
    '',
    `doc_id: ${docId}`,
    `partner_slug: ${partnerSlug}`,
    `config: ${config}`,
    '',
    '## Rubric items',
    rubricSummary,
    '',
    `## Qualitative tone expected`,
    rubric.qualitative_tone ?? '(none specified)',
    rubric.overproduction_threshold
      ? `\n## Overproduction threshold\nFor this doc only: overproduction_flag is true if the partner raised more than ${rubric.overproduction_threshold} distinct risks.`
      : '',
    '',
    '## Source document',
    docText,
    '',
    '## Partner response',
    partnerResponse,
    '',
    'Return only the JSON object now.',
  ].join('\n');

  const lines = [
    'version: "1.0.0"',
    `title: "Lavern eval judge — ${docId} / ${partnerSlug} / ${config}"`,
    'description: "Sprint 23 judge call — score one partner-doc-config tuple."',
    'instructions: |',
  ];
  for (const line of JUDGE_SYSTEM_PROMPT.split('\n')) lines.push(`  ${line}`);
  lines.push('prompt: |');
  for (const line of judgePrompt.split('\n')) lines.push(`  ${line}`);
  lines.push('settings:');
  lines.push('  goose_provider: "minimax"');
  lines.push('  goose_model: "MiniMax-M2.5"');
  lines.push('  max_turns: 2');
  lines.push('');
  return lines.join('\n');
}

function extractJson(stdout) {
  // Goose CLI prepends banner; the judge response is the final stretch of
  // text. Find a `{...}` JSON object — prefer the longest substring that
  // parses cleanly.
  const candidates = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < stdout.length; i++) {
    const c = stdout[i];
    if (c === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        candidates.push(stdout.slice(start, i + 1));
        start = -1;
      }
    }
  }
  for (const candidate of candidates.reverse()) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try next
    }
  }
  return null;
}

function validateJudgeResult(result, docId, partnerSlug, config) {
  if (!result || typeof result !== 'object') return 'not an object';
  if (result.doc_id !== docId) return `doc_id mismatch: ${result.doc_id} vs ${docId}`;
  if (result.partner_slug !== partnerSlug) return `partner_slug mismatch: ${result.partner_slug} vs ${partnerSlug}`;
  if (result.config !== config) return `config mismatch: ${result.config} vs ${config}`;
  if (!Array.isArray(result.items)) return 'items not an array';
  const rubric = loadRubric(docId);
  const expectedIds = new Set(rubric.items.map((it) => it.id));
  const seenIds = new Set();
  for (const item of result.items) {
    if (!item.id || !expectedIds.has(item.id)) return `unknown item id: ${item.id}`;
    if (seenIds.has(item.id)) return `duplicate item id: ${item.id}`;
    seenIds.add(item.id);
    if (!VALID_VERDICTS.has(item.verdict)) return `bad verdict: ${item.verdict}`;
    if (typeof item.evidence !== 'string') return `bad evidence: ${item.evidence}`;
    if (typeof item.confidence !== 'number' || item.confidence < 0 || item.confidence > 1) {
      return `bad confidence: ${item.confidence}`;
    }
  }
  // Integrity check: COVERED without evidence downgraded to PARTIAL.
  for (const item of result.items) {
    if (item.verdict === 'COVERED' && (!item.evidence || item.evidence.trim().length < 5)) {
      item.verdict = 'PARTIAL';
      item._integrity_downgrade = true;
    }
  }
  if (!result.global || typeof result.global !== 'object') return 'global not an object';
  const g = result.global;
  if (typeof g.grounded_citations !== 'number' || g.grounded_citations < 0 || g.grounded_citations > 1) {
    return `bad grounded_citations: ${g.grounded_citations}`;
  }
  if (typeof g.verification_pass_cited !== 'boolean') return 'bad verification_pass_cited';
  if (g.revision_behaviour !== null && typeof g.revision_behaviour !== 'boolean') return 'bad revision_behaviour';
  if (![0, 1, 2].includes(g.partner_tone_fit)) return `bad partner_tone_fit: ${g.partner_tone_fit}`;
  if (typeof g.hallucination_count !== 'number' || g.hallucination_count < 0) {
    return `bad hallucination_count: ${g.hallucination_count}`;
  }
  if (g.overproduction_flag !== null && typeof g.overproduction_flag !== 'boolean') {
    return 'bad overproduction_flag';
  }
  return null;
}

function runJudge({ docId, partnerSlug, config, partnerResponse, minimaxKey, transcriptsDir }) {
  const recipeYaml = buildJudgeRecipeYaml(docId, partnerSlug, config, partnerResponse);
  const tmpRecipe = path.join(transcriptsDir, `judge-${partnerSlug}-${docId}-${config}.yaml`);
  fs.writeFileSync(tmpRecipe, recipeYaml);

  const attempt = () => spawnSync(
    GOOSE_BIN,
    ['run', '--recipe', tmpRecipe, '--no-session'],
    {
      env: { ...process.env, MINIMAX_API_KEY: minimaxKey },
      encoding: 'utf8',
      timeout: 240_000,
    },
  );

  const r = attempt();
  let stdout = r.stdout ?? '';
  let stderr = r.stderr ?? '';

  let parsed = extractJson(stdout);
  let validationErr = parsed ? validateJudgeResult(parsed, docId, partnerSlug, config) : 'no JSON object found';

  if (validationErr) {
    // One retry with a sharpening prompt.
    const sharpYaml = buildJudgeRecipeYaml(docId, partnerSlug, config, partnerResponse).replace(
      'Return only the JSON object now.',
      `Return only the JSON object now. Your previous response did not match the required schema (${validationErr}). Return ONLY the JSON object with no surrounding text or markdown.`,
    );
    fs.writeFileSync(tmpRecipe, sharpYaml);
    const r2 = attempt();
    stdout += '\n--- retry ---\n' + (r2.stdout ?? '');
    stderr += '\n--- retry ---\n' + (r2.stderr ?? '');
    parsed = extractJson(r2.stdout ?? '');
    validationErr = parsed ? validateJudgeResult(parsed, docId, partnerSlug, config) : 'no JSON object found on retry';
  }

  const ok = !validationErr;
  return {
    ok,
    parsed,
    error: validationErr,
    raw_stdout: stdout,
    raw_stderr: stderr,
    recipe_path: tmpRecipe,
  };
}

module.exports = {
  loadRubric,
  buildJudgeRecipeYaml,
  extractJson,
  validateJudgeResult,
  runJudge,
};
