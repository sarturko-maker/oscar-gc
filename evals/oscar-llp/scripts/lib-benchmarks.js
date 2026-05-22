// Sprint 24-C (ADR-081): benchmark format adapters. Loads MAUD / CUAD /
// LegalBench instances from local JSON files in evals/oscar-llp/benchmarks/
// and unifies the per-partner shape used by run-partner-cycle.js.
//
// The local JSON files at benchmarks/<name>.json are populated separately
// by an operator (downloading MAUD/CUAD/LegalBench from upstream sources)
// or by per-corpus loader scripts (not in 24-C scope). This file's job is
// to read those local files and yield the unified instance shape.

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BENCHMARKS_DIR = path.resolve(__dirname, '..', 'benchmarks');

const PARTNER_BENCHMARK_MAP = {
  'sarah-chen': ['maud.json'],
  'diana-park': ['cuad-privacy.json', 'legalbench-privacy.json'],
  'aisha-khan': ['cuad-saas.json', 'github-saas-tnc.json'],
  // Sprint 26: Marcus Webb (Commercial Contracts) added for non-trio
  // transferability validation. Reuses cuad-saas as the closest commercial-
  // agreement fit; partnerCycleSeed makes Marcus's N=20 sample distinct
  // from Aisha's even though the underlying corpus is shared.
  'marcus-webb': ['cuad-saas.json'],
};

const DROP_CANDIDATES = new Set(['legalbench-privacy.json', 'github-saas-tnc.json']);

function loadBenchmarkFile(filename) {
  const p = path.join(BENCHMARKS_DIR, filename);
  if (!fs.existsSync(p)) {
    throw new Error(`Benchmark file missing: ${p}`);
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!Array.isArray(raw.instances)) {
    throw new Error(`Benchmark file ${filename} has no \`instances\` array`);
  }
  return raw;
}

function loadBenchmark(partnerSlug, { dropSupplemental = false } = {}) {
  const files = PARTNER_BENCHMARK_MAP[partnerSlug];
  if (!files) {
    throw new Error(`No benchmark mapping for partner '${partnerSlug}'`);
  }
  const instances = [];
  const sources = [];
  for (const f of files) {
    if (dropSupplemental && DROP_CANDIDATES.has(f)) {
      sources.push({ file: f, instances: 0, dropped: true });
      continue;
    }
    const raw = loadBenchmarkFile(f);
    instances.push(...raw.instances);
    sources.push({
      file: f,
      instances: raw.instances.length,
      dropped: false,
      meta: raw._meta,
    });
  }
  return { partnerSlug, sources, instances };
}

function sampleInstances(instances, n, { seed }) {
  if (instances.length === 0) return [];
  if (instances.length <= n) return [...instances];
  // Deterministic seeded sample via a simple LCG so iter-k reproducibly
  // samples the same instances when seed is fixed per partner+cycle.
  let s = seed >>> 0;
  const out = [];
  const picked = new Set();
  while (out.length < n) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const idx = s % instances.length;
    if (!picked.has(idx)) {
      picked.add(idx);
      out.push(instances[idx]);
    }
  }
  return out;
}

function hashSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

function partnerCycleSeed(partnerSlug, cycle) {
  return hashSeed(`${partnerSlug}::${cycle}`);
}

module.exports = {
  BENCHMARKS_DIR,
  PARTNER_BENCHMARK_MAP,
  DROP_CANDIDATES,
  loadBenchmarkFile,
  loadBenchmark,
  sampleInstances,
  partnerCycleSeed,
};
