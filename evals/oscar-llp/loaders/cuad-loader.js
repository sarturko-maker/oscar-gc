#!/usr/bin/env node
// Sprint 25 Phase 1 — CUAD loader. Populates
// evals/oscar-llp/benchmarks/cuad-privacy.json or cuad-saas.json from
// Atticus Project CUAD (Hendrycks et al., NeurIPS 2021; CC-BY-4.0).
//
// CUAD's 41 clause types do NOT include "Data_Privacy" — the original
// stub filter was a misread; this loader substitutes data-touching
// commercial clauses (audit rights, affiliate licensing, anti-assignment)
// as the closest privacy-adjacent surface CUAD offers. Documented in
// _meta.clause_type_substitution.
//
// Usage:
//   node evals/oscar-llp/loaders/cuad-loader.js --filter privacy
//   node evals/oscar-llp/loaders/cuad-loader.js --filter saas
//
// Env overrides:
//   CUAD_DATA   — extracted CUAD JSON (default /tmp/oscar-benchmarks/cuad/CUADv1.json)
//   CUAD_TARGET — max instances per filter (default 50)

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CUAD_JSON = process.env.CUAD_DATA ?? '/tmp/oscar-benchmarks/cuad/CUADv1.json';
const TARGET = parseInt(process.env.CUAD_TARGET ?? '50', 10);
const TRUNC_CHARS = 30_000;
const BENCHMARKS_DIR = path.resolve(__dirname, '..', 'benchmarks');

const FILTER_CONFIGS = {
  privacy: {
    outFile: 'cuad-privacy.json',
    clauseTypes: [
      'Audit Rights',
      'Affiliate License-Licensee',
      'Affiliate License-Licensor',
      'Anti-Assignment',
      'Insurance',
      'Change Of Control',
      'Covenant Not To Sue',
    ],
    questionBuilder: (title, matchedTypes) =>
      `You are privacy & data-protection counsel reviewing this commercial contract (${title}). ` +
      `CUAD does not surface DPA-specific clauses; this benchmark instead tests data-flow + ` +
      `third-party-access controls present in commercial agreements. Identify and assess the ` +
      `following data-touching provisions: ${matchedTypes.join('; ')}. For each, cite the ` +
      `specific clause text, classify the position (data-subject-favorable / market-standard / ` +
      `controller-adverse), and flag any compliance risk for a GDPR/UK-DPA controller stance. ` +
      `Use the verification-pass sub-recipe before delivering.`,
    note: 'Privacy-clause substitution — CUAD lacks Data_Privacy taxonomy entries.',
  },
  saas: {
    outFile: 'cuad-saas.json',
    clauseTypes: [
      'License Grant',
      'Cap On Liability',
      'Uncapped Liability',
      'Termination For Convenience',
      'Post-Termination Services',
      'Renewal Term',
      'Notice Period To Terminate Renewal',
      'Exclusivity',
      'Source Code Escrow',
      'Most Favored Nation',
      'Volume Restriction',
      'Warranty Duration',
      'Irrevocable Or Perpetual License',
      'Liquidated Damages',
      'Affiliate License-Licensee',
      'Affiliate License-Licensor',
    ],
    questionBuilder: (title, matchedTypes) =>
      `You are tech-transactions counsel reviewing this SaaS / licensing agreement (${title}). ` +
      `Identify and assess the commercial mechanics: ${matchedTypes.join('; ')}. For each ` +
      `provision: cite the specific clause text, classify the position (customer-favorable / ` +
      `market-standard / vendor-favorable), flag any vendor-lockin / over-licensing / liability- ` +
      `cap risk, and note whether the term meets typical SaaS market posture for this deal size. ` +
      `Use the verification-pass sub-recipe before delivering.`,
    note: 'Tech-Tx SaaS clauses from CUAD commercial taxonomy.',
  },
};

const CLAUSE_QUESTION_RE = /related to "([^"]+)"/;

function parseArgs() {
  const args = { filter: null };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--filter') args.filter = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node loaders/cuad-loader.js --filter privacy|saas');
      process.exit(0);
    } else throw new Error(`Unknown arg: ${a}`);
  }
  if (!args.filter || !FILTER_CONFIGS[args.filter]) {
    throw new Error('Missing or invalid --filter (must be privacy|saas)');
  }
  return args;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function deriveSeverity(clauseType) {
  const c = (clauseType ?? '').toLowerCase();
  if (c.includes('uncapped') || c.includes('liquidated damages') || c.includes('irrevocable')) return 'RED';
  if (c.includes('cap') || c.includes('termination') || c.includes('audit') || c.includes('escrow')) return 'major';
  return 'minor';
}

function safeId(title) {
  return slugify(title).slice(0, 80);
}

function main() {
  const { filter } = parseArgs();
  const cfg = FILTER_CONFIGS[filter];
  const outPath = path.join(BENCHMARKS_DIR, cfg.outFile);

  if (!fs.existsSync(CUAD_JSON)) throw new Error(`CUAD JSON missing: ${CUAD_JSON}`);
  const cuad = JSON.parse(fs.readFileSync(CUAD_JSON, 'utf8'));
  if (!Array.isArray(cuad.data)) throw new Error('CUADv1.json missing data[]');
  console.log(`Loaded ${cuad.data.length} CUAD contracts (filter=${filter})`);

  const clauseSet = new Set(cfg.clauseTypes);
  const instances = [];

  for (const contract of cuad.data) {
    if (instances.length >= TARGET) break;
    const title = contract.title;
    const para = contract.paragraphs?.[0];
    if (!para) continue;
    const context = para.context ?? '';

    const matched = [];
    for (const qa of para.qas ?? []) {
      const m = qa.question?.match(CLAUSE_QUESTION_RE);
      if (!m) continue;
      const clauseType = m[1];
      if (!clauseSet.has(clauseType)) continue;
      const answers = (qa.answers ?? []).filter((a) => a.text);
      if (answers.length === 0) continue;
      matched.push({ clauseType, answers });
    }
    if (matched.length < 3) continue;

    const truncated = context.length > TRUNC_CHARS;
    const text = truncated ? context.slice(0, TRUNC_CHARS) : context;

    const seenItemIds = new Set();
    const goldLabels = [];
    for (const m of matched) {
      const baseSlug = slugify(m.clauseType);
      let itemId = baseSlug || `item-${goldLabels.length}`;
      let suffix = 1;
      while (seenItemIds.has(itemId)) itemId = `${baseSlug}-${suffix++}`;
      seenItemIds.add(itemId);
      goldLabels.push({
        rubric_item_id: itemId,
        label_text: m.answers[0].text,
        severity_band: deriveSeverity(m.clauseType),
        clause_ref: m.clauseType,
      });
    }

    instances.push({
      id: `cuad-${safeId(title)}`,
      source_doc_id: title,
      source_doc_text: text,
      truncated,
      question: cfg.questionBuilder(title, [...new Set(matched.map((m) => m.clauseType))]),
      gold_labels: goldLabels,
    });
  }

  const existing = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  existing._meta.clause_type_filter = cfg.clauseTypes;
  existing._meta.clause_type_substitution = cfg.note;
  existing._meta.instances_present = instances.length;
  existing._meta.populated_at = new Date().toISOString();
  existing._meta.populated_from = path.relative(path.dirname(outPath), CUAD_JSON);
  existing.instances = instances;
  fs.writeFileSync(outPath, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`Wrote ${instances.length} CUAD instances (${filter}) → ${outPath}`);
  console.log(
    `Median gold_labels per instance: ${
      instances
        .map((i) => i.gold_labels.length)
        .sort((a, b) => a - b)[Math.floor(instances.length / 2)]
    }; truncated: ${instances.filter((i) => i.truncated).length}/${instances.length}`,
  );
}

try {
  main();
} catch (err) {
  console.error(`cuad-loader FAIL: ${err.message ?? err}`);
  process.exit(1);
}
