#!/usr/bin/env node
// Sprint 15 (ADR-054): aggregates per-persona axis scores into a single
// markdown report. Reads docs/sprint-15/eval/iter-<N>/<persona>/scores/all.json
// for each persona under the iteration; emits a summary table + per-axis
// drilldown to stdout.
//
// Usage:
//   node aggregate-scores.mjs --iteration 1
//
// Pass criteria (per the plan):
//   PASS = (mean coverage ≥ 4.0) AND (mean efficiency ≥ 4.0) AND
//          (mean downstream-briefing ≥ 4.0) AND (no cell < 3.0).

import { promises as fs } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(here, '..', '..', '..');

function parseFlag(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : null;
}

function mean(arr) {
  const nums = arr.filter((x) => typeof x === 'number');
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

async function main() {
  const iteration = parseFlag('iteration') ?? '1';
  const evalDir = join(REPO_ROOT, 'docs', 'sprint-15', 'eval', `iter-${iteration}`);
  let entries;
  try {
    entries = await fs.readdir(evalDir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.error(`No eval directory at ${evalDir}`);
      process.exit(2);
    }
    throw err;
  }
  const personas = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  const rows = [];
  for (const p of personas) {
    const scoresPath = join(evalDir, p, 'scores', 'all.json');
    try {
      const raw = await fs.readFile(scoresPath, 'utf8');
      const parsed = JSON.parse(raw);
      const downstreamPerArea = parsed.scores.downstream_briefing ?? {};
      const downstreamScores = Object.values(downstreamPerArea)
        .map((s) => s?.score)
        .filter((s) => typeof s === 'number');
      rows.push({
        persona: p,
        turns: parsed.agent_turn_count,
        aborted: parsed.aborted,
        coverage: parsed.scores.coverage?.score ?? null,
        efficiency: parsed.scores.efficiency?.score ?? null,
        downstream: downstreamScores,
      });
    } catch (err) {
      rows.push({
        persona: p,
        turns: null,
        aborted: null,
        coverage: null,
        efficiency: null,
        downstream: [],
        error: err.message,
      });
    }
  }

  const coverages = rows.map((r) => r.coverage);
  const efficiencies = rows.map((r) => r.efficiency);
  const downstreams = rows.flatMap((r) => r.downstream);

  const meanCoverage = mean(coverages);
  const meanEfficiency = mean(efficiencies);
  const meanDownstream = mean(downstreams);
  const allCells = [...coverages, ...efficiencies, ...downstreams].filter(
    (x) => typeof x === 'number',
  );
  const minCell = allCells.length > 0 ? Math.min(...allCells) : null;

  const pass =
    meanCoverage !== null &&
    meanCoverage >= 4.0 &&
    meanEfficiency !== null &&
    meanEfficiency >= 4.0 &&
    meanDownstream !== null &&
    meanDownstream >= 4.0 &&
    minCell !== null &&
    minCell >= 3.0;

  const lines = [];
  lines.push(`# Sprint 15 eval — iteration ${iteration}`);
  lines.push('');
  lines.push(`**Pass criteria**: mean ≥ 4.0 per axis AND no cell < 3.0.`);
  lines.push('');
  lines.push(`**Result**: **${pass ? 'PASS' : 'FAIL'}**.`);
  lines.push('');
  lines.push(`- Mean coverage: ${meanCoverage?.toFixed(2) ?? 'n/a'}`);
  lines.push(`- Mean efficiency: ${meanEfficiency?.toFixed(2) ?? 'n/a'}`);
  lines.push(`- Mean downstream-briefing: ${meanDownstream?.toFixed(2) ?? 'n/a'}`);
  lines.push(`- Min individual cell: ${minCell ?? 'n/a'}`);
  lines.push('');
  lines.push('## Per-persona scores');
  lines.push('');
  lines.push(
    '| Persona | Turns | Aborted? | Coverage | Efficiency | Downstream (per area) |',
  );
  lines.push('|---|---|---|---|---|---|');
  for (const r of rows) {
    lines.push(
      `| ${r.persona} | ${r.turns ?? '—'} | ${r.aborted ?? '—'} | ${r.coverage ?? '—'} | ${
        r.efficiency ?? '—'
      } | ${r.downstream.length > 0 ? r.downstream.join(', ') : '—'} |`,
    );
  }
  process.stdout.write(lines.join('\n') + '\n');
}

main().catch((err) => {
  console.error(err.stack || err.message);
  process.exit(1);
});
