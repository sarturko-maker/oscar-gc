// Sprint 24-C (ADR-081): per-cycle token + dollar accumulator. Tracks
// Anthropic + MiniMax spend across iteration; persists to iterations/_costs/.
// Brief envelope: $60-100 sprint cost budget; harness must surface running
// total at the end of each cycle so user can halt before overspend.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const COSTS_DIR = path.join(EVAL_ROOT, 'iterations', '_costs');

// Anthropic Opus 4.7 pricing per million tokens (verify in console.anthropic.com)
// Conservative estimates; harness logs reality from API headers when present.
const ANTHROPIC_PRICING = {
  'claude-opus-4-7': {
    input_per_mtok: 15.0,
    input_cache_write_per_mtok: 18.75,
    input_cache_read_per_mtok: 1.5,
    output_per_mtok: 75.0,
  },
  'claude-sonnet-4-6': {
    input_per_mtok: 3.0,
    input_cache_write_per_mtok: 3.75,
    input_cache_read_per_mtok: 0.3,
    output_per_mtok: 15.0,
  },
  'claude-haiku-4-5-20251001': {
    input_per_mtok: 0.8,
    input_cache_write_per_mtok: 1.0,
    input_cache_read_per_mtok: 0.08,
    output_per_mtok: 4.0,
  },
};

// MiniMax-M2.5 pricing per million tokens (per Sprint 22 RUNBOOK $10/PCM cap).
// Conservative estimate; refine from provider invoices.
const MINIMAX_PRICING = {
  'MiniMax-M2.5': {
    input_per_mtok: 0.5,
    output_per_mtok: 2.0,
  },
};

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function costForAnthropicCall({ model, inputTokens, cacheWriteTokens, cacheReadTokens, outputTokens }) {
  const p = ANTHROPIC_PRICING[model];
  if (!p) return 0;
  const dollars =
    ((inputTokens ?? 0) * p.input_per_mtok +
      (cacheWriteTokens ?? 0) * p.input_cache_write_per_mtok +
      (cacheReadTokens ?? 0) * p.input_cache_read_per_mtok +
      (outputTokens ?? 0) * p.output_per_mtok) /
    1_000_000;
  return dollars;
}

function costForMinimaxCall({ model, inputTokens, outputTokens }) {
  const p = MINIMAX_PRICING[model];
  if (!p) return 0;
  return ((inputTokens ?? 0) * p.input_per_mtok + (outputTokens ?? 0) * p.output_per_mtok) / 1_000_000;
}

function loadCostLog() {
  const today = new Date().toISOString().slice(0, 10);
  const file = path.join(COSTS_DIR, `costs-${today}.json`);
  if (!fs.existsSync(file)) return { date: today, file, entries: [], total_usd: 0 };
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { ...json, file };
}

function appendCost(entry) {
  ensureDir(COSTS_DIR);
  const log = loadCostLog();
  log.entries.push({ ts: new Date().toISOString(), ...entry });
  log.total_usd = log.entries.reduce((sum, e) => sum + (e.usd ?? 0), 0);
  fs.writeFileSync(log.file, JSON.stringify(log, null, 2), 'utf8');
  return log;
}

module.exports = {
  ANTHROPIC_PRICING,
  MINIMAX_PRICING,
  costForAnthropicCall,
  costForMinimaxCall,
  loadCostLog,
  appendCost,
};
