// Sprint 24-C (ADR-081): Anthropic SDK wrapper for the iteration judge +
// subtractive-edit proposer. Mirrors evals/lavern-jv/scripts/lib-judge.js
// shape (Sprint 23 ADR-077) but calls @anthropic-ai/sdk instead of goose run.
// Prompt caching for the rubric + subtractive-system prefixes keeps per-
// cycle Anthropic spend bounded.

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { appendCost, costForAnthropicCall } = require('./lib-cost-log');

const EVAL_ROOT = path.resolve(__dirname, '..');
const PROMPTS_DIR = path.join(EVAL_ROOT, 'prompts');
const ANTHROPIC_KEY_FILE = '/root/.anthropic-dev-key';

let _client = null;

function getApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  if (fs.existsSync(ANTHROPIC_KEY_FILE)) {
    return fs.readFileSync(ANTHROPIC_KEY_FILE, 'utf8').trim();
  }
  throw new Error(
    `Anthropic API key missing. Set ANTHROPIC_API_KEY env or create ${ANTHROPIC_KEY_FILE} (chmod 600). Max subscriptions do not issue API keys — confirm pay-as-you-go API key is available.`,
  );
}

function getClient() {
  if (_client) return _client;
  const Anthropic = require('@anthropic-ai/sdk');
  _client = new Anthropic({ apiKey: getApiKey() });
  return _client;
}

function loadPromptFile(name) {
  const p = path.join(PROMPTS_DIR, name);
  if (!fs.existsSync(p)) throw new Error(`Prompt file missing: ${p}`);
  return fs.readFileSync(p, 'utf8');
}

function extractJsonBlock(text) {
  if (!text) return null;
  // Try to find a fenced JSON block first.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  // Find the first '{' and try to balance braces.
  const start = candidate.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  for (let i = start; i < candidate.length; i++) {
    const c = candidate[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        const sub = candidate.slice(start, i + 1);
        try {
          return JSON.parse(sub);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// One Claude call per iteration cycle. The system + judge-rubric are cached
// across calls within the 5-minute TTL; gold_labels are cached within a
// single partner's iteration trajectory; per-cycle transcripts are uncached.
async function judgeAndPropose({
  model = 'claude-opus-4-7',
  maxTokens = 8000,
  partnerSlug,
  cycle,
  currentPrompt,
  transcripts,
  goldLabels,
  rubricExtras,
}) {
  const subtractiveSystem = loadPromptFile('subtractive-system.md');
  const judgeRubric = loadPromptFile('judge-rubric.md');

  const userContent = [
    {
      type: 'text',
      text: `Gold labels for the ${transcripts.length} instances in this cycle (partner: ${partnerSlug}, cycle: ${cycle}):\n\n${JSON.stringify(goldLabels, null, 2)}`,
      cache_control: { type: 'ephemeral' },
    },
    {
      type: 'text',
      text: `The partner's current prompt (source for subtractive removals):\n\n----- BEGIN PROMPT -----\n${currentPrompt}\n----- END PROMPT -----`,
    },
    {
      type: 'text',
      text: `${transcripts.length} partner transcripts:\n\n${transcripts
        .map(
          (t, i) =>
            `===== Transcript ${i + 1} (instance_id: ${t.instance_id}) =====\n${t.body}`,
        )
        .join('\n\n')}`,
    },
    {
      type: 'text',
      text: `\n${rubricExtras ?? ''}\n\nNow produce your JSON output: per-instance verdicts, the distribution summary, the lowest-performing slice, and the subtractive proposal (or escalation if subtraction is genuinely insufficient). Per subtractive-system.md schema.`,
    },
  ];

  const client = getClient();
  const t0 = Date.now();
  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [
        { type: 'text', text: subtractiveSystem, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: judgeRubric, cache_control: { type: 'ephemeral' } },
      ],
      messages: [{ role: 'user', content: userContent }],
    });
  } catch (err) {
    return { ok: false, error: err.message ?? String(err), durationMs: Date.now() - t0 };
  }

  const durationMs = Date.now() - t0;
  const rawText = response.content?.map((c) => (c.type === 'text' ? c.text : '')).join('\n') ?? '';
  const parsed = extractJsonBlock(rawText);

  const usage = response.usage ?? {};
  const usd = costForAnthropicCall({
    model,
    inputTokens: usage.input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  });

  appendCost({
    kind: 'anthropic-judge-propose',
    partner: partnerSlug,
    cycle,
    model,
    durationMs,
    usage,
    usd,
  });

  return {
    ok: parsed !== null,
    parsed,
    rawText,
    usage,
    usd,
    durationMs,
  };
}

// One Claude call for Phase 2 cross-partner pattern extraction. Reads
// concatenated iteration histories; emits patterns or a negative finding.
async function extractCrossPartnerPatterns({
  model = 'claude-opus-4-7',
  maxTokens = 8000,
  partnerHistories,
}) {
  const extractorPrompt = loadPromptFile('cross-partner-extractor.md');

  const userContent = [
    {
      type: 'text',
      text: `Iteration histories for the 3 partners:\n\n${JSON.stringify(partnerHistories, null, 2).slice(0, 200000)}`,
    },
    {
      type: 'text',
      text: 'Now produce your JSON output per cross-partner-extractor.md schema. Negative finding is valid.',
    },
  ];

  const client = getClient();
  const t0 = Date.now();
  let response;
  try {
    response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: [{ type: 'text', text: extractorPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userContent }],
    });
  } catch (err) {
    return { ok: false, error: err.message ?? String(err), durationMs: Date.now() - t0 };
  }

  const durationMs = Date.now() - t0;
  const rawText = response.content?.map((c) => (c.type === 'text' ? c.text : '')).join('\n') ?? '';
  const parsed = extractJsonBlock(rawText);
  const usage = response.usage ?? {};
  const usd = costForAnthropicCall({
    model,
    inputTokens: usage.input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    outputTokens: usage.output_tokens ?? 0,
  });

  appendCost({ kind: 'anthropic-cross-partner', model, durationMs, usage, usd });

  return { ok: parsed !== null, parsed, rawText, usage, usd, durationMs };
}

module.exports = {
  getApiKey,
  loadPromptFile,
  extractJsonBlock,
  judgeAndPropose,
  extractCrossPartnerPatterns,
};
