#!/usr/bin/env node
// Sprint 25 Phase 1 — MAUD loader. Populates
// evals/oscar-llp/benchmarks/maud.json from Atticus Project MAUD
// (Wang et al., NeurIPS 2023; CC-BY-4.0). Groups MAUD_test.csv rows by
// contract_name, picks contracts with ≥3 annotations, loads source doc
// text from data/contracts/<name>.txt, truncates to 30k chars, emits
// instances[] matching maud.json _schema.
//
// Usage:
//   node evals/oscar-llp/loaders/maud-loader.js
//   MAUD_TARGET=20 node evals/oscar-llp/loaders/maud-loader.js
//
// Env overrides:
//   MAUD_DATA   — root of the extracted MAUD zip (default /tmp/oscar-benchmarks/maud)
//   MAUD_OUT    — output JSON path (default ../benchmarks/maud.json)
//   MAUD_TARGET — max instances to emit (default 50)

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.env.MAUD_DATA ?? '/tmp/oscar-benchmarks/maud';
const OUT = process.env.MAUD_OUT ?? path.resolve(__dirname, '..', 'benchmarks', 'maud.json');
const TARGET = parseInt(process.env.MAUD_TARGET ?? '50', 10);
const TRUNC_CHARS = 30_000;

function parseCsv(text) {
  const rows = [];
  let i = 0;
  let field = '';
  let row = [];
  let inQuotes = false;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (c === '"') { inQuotes = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"') { inQuotes = true; i++; continue; }
    if (c === ',') { row.push(field); field = ''; i++; continue; }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
    if (c === '\r') { i++; continue; }
    field += c; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function deriveSeverity(category) {
  const c = (category ?? '').toLowerCase();
  if (c.includes('material adverse') || c.includes('deal protection')) return 'RED';
  if (c.includes('closing') || c.includes('remedies')) return 'major';
  if (c.includes('general information') || c.includes('knowledge')) return 'minor';
  return 'major';
}

function buildQuestion(contractName) {
  return (
    `You are M&A counsel reviewing this merger agreement (${contractName}). ` +
    `Identify and assess the deal mechanics: type of consideration; Material Adverse ` +
    `Effect (MAC/MAE) provisions and carveouts; closing conditions (target R&W ` +
    `bringdown standards, compliance with covenants, absence of litigation); ` +
    `termination triggers, break-up fees, and deal-protection provisions; ` +
    `operating covenants and efforts standards. For each provision identified, cite ` +
    `the specific clause text, classify the position taken (party-favorable / ` +
    `market-standard / adverse), and flag any deal-killing risk. Use the ` +
    `verification-pass sub-recipe before delivering.`
  );
}

function main() {
  const csvPath = path.join(ROOT, 'data', 'MAUD_test.csv');
  const contractsDir = path.join(ROOT, 'data', 'contracts');
  if (!fs.existsSync(csvPath)) throw new Error(`MAUD CSV missing: ${csvPath}`);
  if (!fs.existsSync(contractsDir)) throw new Error(`MAUD contracts dir missing: ${contractsDir}`);

  const csvText = fs.readFileSync(csvPath, 'utf8');
  const rows = parseCsv(csvText);
  const header = rows[0];
  const colIdx = Object.fromEntries(header.map((h, i) => [h, i]));
  const data = rows.slice(1).filter((r) => r.length === header.length);
  console.log(`Parsed ${data.length} rows from ${path.basename(csvPath)}`);

  const byContract = new Map();
  for (const r of data) {
    const name = r[colIdx.contract_name];
    if (!name) continue;
    if (!byContract.has(name)) byContract.set(name, []);
    byContract.get(name).push({
      question: r[colIdx.question],
      subquestion: r[colIdx.subquestion],
      answer: r[colIdx.answer],
      label: r[colIdx.label],
      category: r[colIdx.category],
      text_type: r[colIdx.text_type],
      row_id: r[colIdx.id],
    });
  }
  console.log(`Grouped into ${byContract.size} contracts`);

  const ranked = [...byContract.entries()].sort((a, b) => b[1].length - a[1].length);

  const instances = [];
  for (const [contractName, annotations] of ranked) {
    if (instances.length >= TARGET) break;
    if (annotations.length < 3) continue;
    const txtPath = path.join(contractsDir, `${contractName}.txt`);
    if (!fs.existsSync(txtPath)) continue;
    let text = fs.readFileSync(txtPath, 'utf8');
    const truncated = text.length > TRUNC_CHARS;
    if (truncated) text = text.slice(0, TRUNC_CHARS);

    const seenItemIds = new Set();
    const goldLabels = [];
    for (const a of annotations) {
      const baseSlug = slugify(a.text_type || a.question || a.category);
      let itemId = baseSlug || `item-${goldLabels.length}`;
      let suffix = 1;
      while (seenItemIds.has(itemId)) {
        itemId = `${baseSlug}-${suffix++}`;
      }
      seenItemIds.add(itemId);
      goldLabels.push({
        rubric_item_id: itemId,
        label_text: a.answer ?? '',
        severity_band: deriveSeverity(a.category),
        clause_ref: a.text_type || a.category || '',
      });
    }

    instances.push({
      id: `maud-${contractName}`,
      source_doc_id: contractName,
      source_doc_text: text,
      truncated,
      question: buildQuestion(contractName),
      gold_labels: goldLabels,
    });
  }

  const existing = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  existing._meta.instances_present = instances.length;
  existing._meta.populated_at = new Date().toISOString();
  existing._meta.populated_from = path.relative(path.dirname(OUT), csvPath);
  existing.instances = instances;
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`Wrote ${instances.length} MAUD instances → ${OUT}`);
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
  console.error(`maud-loader FAIL: ${err.message ?? err}`);
  process.exit(1);
}
