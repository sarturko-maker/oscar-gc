// Sprint 32 (ADR-109): per-cycle cost log for matter-runtime.
// Extends the Sprint 31A/31B costs-*.json convention to support multi-provider
// + multi-variant + multi-scenario. Flat entries; totals aggregated per write.
//
// MiniMax entries record dollar-equivalent at public PAYG rates for
// observability; actual billing on the $10/PCM subscription is sunk.
// OpenRouter entries record dollar cost as billed (binding constraint).

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const EVAL_ROOT = path.resolve(__dirname, '..');
const COSTS_DIR = path.join(EVAL_ROOT, 'iterations', '_costs');

const PRICING = {
  minimax: {
    'MiniMax-M2.5': { input_per_mtok: 0.5, output_per_mtok: 2.0 },
    'MiniMax-M2.5-highspeed': { input_per_mtok: 1.2, output_per_mtok: 4.8 },
    'MiniMax-M2.7': { input_per_mtok: 0.5, output_per_mtok: 2.0 },
  },
  openrouter: {
    'anthropic/claude-haiku-4-5': { input_per_mtok: 1.0, output_per_mtok: 5.0 },
    'anthropic/claude-sonnet-4.6': { input_per_mtok: 3.0, output_per_mtok: 15.0 },
    'openai/gpt-5.4-mini': { input_per_mtok: 0.25, output_per_mtok: 2.0 },
  },
};

const CAPS = {
  minimax: { cap_usd: 10.0, cap_period: 'per calendar month (self-cap / subscription)', kind: 'request_quota_on_token_plan' },
  openrouter: { cap_usd: 19.0, cap_period: 'remaining as of Sprint 32 open', kind: 'dollar_cap' },
};

function costPerCall({ provider, model, inputTokens, outputTokens }) {
  const p = PRICING[provider]?.[model];
  if (!p) return 0;
  return ((inputTokens ?? 0) * p.input_per_mtok + (outputTokens ?? 0) * p.output_per_mtok) / 1_000_000;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function costLogPath() {
  const today = new Date().toISOString().slice(0, 10);
  return path.join(COSTS_DIR, `costs-${today}-sprint32.json`);
}

function loadCostLog() {
  const file = costLogPath();
  if (!fs.existsSync(file)) {
    return {
      sprint: '32',
      date: new Date().toISOString().slice(0, 10),
      scope: 'N=20/N=10 matter-runtime eval substrate baseline (ADR-109)',
      file,
      entries: [],
      totals: { by_provider: {}, cost_usd_total: 0, cycles_total: 0 },
      caps: CAPS,
    };
  }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { ...json, file };
}

function recomputeTotals(entries) {
  const byProvider = {};
  let total = 0;
  for (const e of entries) {
    const p = e.provider;
    if (!byProvider[p]) byProvider[p] = { cycles: 0, tokens_input: 0, tokens_output: 0, cost_usd: 0 };
    byProvider[p].cycles += 1;
    byProvider[p].tokens_input += e.tokens_input ?? 0;
    byProvider[p].tokens_output += e.tokens_output ?? 0;
    byProvider[p].cost_usd += e.cost_usd ?? 0;
    total += e.cost_usd ?? 0;
  }
  return { by_provider: byProvider, cost_usd_total: total, cycles_total: entries.length };
}

function appendCycleEntry(entry) {
  ensureDir(COSTS_DIR);
  const log = loadCostLog();
  log.entries.push({ ts: new Date().toISOString(), ...entry });
  log.totals = recomputeTotals(log.entries);
  const { file, ...payload } = log;
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), 'utf8');
  return log;
}

function readKeyFromFile(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`Key file missing: ${filePath}`);
  return fs.readFileSync(filePath, 'utf8').trim();
}

module.exports = {
  PRICING,
  CAPS,
  costPerCall,
  costLogPath,
  loadCostLog,
  appendCycleEntry,
  readKeyFromFile,
};
