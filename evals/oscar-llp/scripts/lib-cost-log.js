// Sprint 25 (ADR-082): per-cycle MiniMax dollar accumulator. Tracks
// MiniMax partner-run spend across iteration; persists to iterations/_costs/.
// Anthropic pricing removed in Sprint 25 — judging happens in-conversation
// under the Max subscription rather than via the SDK.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const COSTS_DIR = path.join(EVAL_ROOT, 'iterations', '_costs');

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
  MINIMAX_PRICING,
  costForMinimaxCall,
  loadCostLog,
  appendCost,
};
