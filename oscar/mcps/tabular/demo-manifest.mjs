// SPDX-License-Identifier: AGPL-3.0-or-later
// Produce a REAL Tabular Review manifest in a matter folder via the oscar-tabular
// MCP (real tools + real grounding gate, no LLM) — gives the Stage B UI real data
// to render/screenshot, decoupled from MiniMax fan-out. Lives in the package so
// the MCP SDK resolves. Grounded quotes are sliced verbatim from the markdown
// fixtures so charOverlap fires; one paraphrase demonstrates the flagged path.
//
// Usage: node demo-manifest.mjs <matter-working-dir> [fixtures-dir]
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mcpEntry = join(here, 'dist', 'index.js');
const matter = process.argv[2];
const fixturesDir = process.argv[3] || resolve(here, '..', '..', '..', 'docs', 'dogfood', 'sprint-35', 'fixtures');
if (!matter) {
  process.stderr.write('usage: node demo-manifest.mjs <matter-working-dir> [fixtures-dir]\n');
  process.exit(1);
}

const DOCS = ['atlas-msa', 'borealis-saas', 'cobalt-supply', 'delta-empty', 'echo-contract'];
const contractsDir = join(matter, 'contracts');
mkdirSync(contractsDir, { recursive: true });
const texts = {};
for (const d of DOCS) {
  copyFileSync(join(fixturesDir, `${d}.md`), join(contractsDir, `${d}.md`));
  texts[d] = readFileSync(join(fixturesDir, `${d}.md`), 'utf8');
}

// The verbatim line in `text` containing `needle` (a real substring with no
// internal newline → charOverlap resolves to 1.0).
function line(text, needle) {
  const i = text.indexOf(needle);
  if (i < 0) return null;
  const start = text.lastIndexOf('\n', i) + 1;
  let end = text.indexOf('\n', i);
  if (end < 0) end = text.length;
  return text.slice(start, end).trim();
}
const cell = (column_id, answer, quote, confidence = 'high', locator = null) => ({ column_id, answer, quote, confidence, locator });

const payloads = [
  { document_id: 'atlas-msa', document_name: 'Atlas — Master Services Agreement', cells: [
    cell('governing-law', 'England and Wales', line(texts['atlas-msa'], 'laws of England and Wales'), 'high', 'Section 19'),
    cell('liability-cap', '12 months’ fees', line(texts['atlas-msa'], 'shall not exceed the total fees'), 'high', 'Section 11'),
    cell('change-of-control', 'Termination right (30 days’ notice)', line(texts['atlas-msa'], 'change of Control of the Supplier'), 'high', 'Section 14'),
  ] },
  { document_id: 'borealis-saas', document_name: 'Borealis — SaaS Subscription', cells: [
    cell('governing-law', 'Germany (Frankfurt)', line(texts['borealis-saas'], 'Federal Republic of Germany'), 'high', 'Section 16'),
    cell('liability-cap', '12 months’ fees', line(texts['borealis-saas'], 'shall not exceed the fees paid by Customer'), 'medium', 'Section 9'),
    cell('change-of-control', null, null, 'high', null),
  ] },
  { document_id: 'cobalt-supply', document_name: 'Cobalt — Supply Agreement', cells: [
    // Paraphrase NOT present verbatim → charOverlap < 0.8 → flagged (needs review).
    cell('governing-law', 'Singapore', 'Singapore law governs this agreement', 'medium', 'Clause 31'),
    cell('liability-cap', '125% of 6 months’ charges', line(texts['cobalt-supply'], 'one hundred and twenty-five per cent'), 'high', 'Clause 17'),
    cell('change-of-control', 'Buyer termination option', line(texts['cobalt-supply'], 'the Buyer may, at its option, terminate'), 'high', 'Clause 23'),
  ] },
  { document_id: 'delta-empty', document_name: 'Delta — Placeholder', cells: [
    cell('governing-law', null, null, 'high', null),
    cell('liability-cap', null, null, 'high', null),
    cell('change-of-control', null, null, 'high', null),
  ] },
  { document_id: 'echo-contract', document_name: 'Echo — Consulting Agreement', cells: [
    cell('governing-law', 'England and Wales', line(texts['echo-contract'], 'laws of England'), 'high', 'Section 13'),
    cell('liability-cap', '12 months’ fees', line(texts['echo-contract'], 'shall not exceed the fees paid'), 'high', 'Section 6'),
    cell('change-of-control', 'No effect (notice only)', line(texts['echo-contract'], 'change of Control of either party'), 'medium', 'Section 10'),
  ] },
];

const transport = new StdioClientTransport({ command: 'node', args: [mcpEntry], env: { ...process.env, OSCAR_MATTER_DIR: matter } });
const client = new Client({ name: 'tabular-demo', version: '0.0.1' });
await client.connect(transport);
const parse = (r) => JSON.parse(r.content[0].text);
try {
  const created = parse(await client.callTool({ name: 'create_review', arguments: {
    title: 'Project Atlas — contract portfolio',
    columns: [
      { label: 'Governing law', prompt: 'What law governs this agreement?', type: 'string' },
      { label: 'Liability cap', prompt: 'What is the limitation of liability / cap?', type: 'string' },
      { label: 'Change of control', prompt: 'What happens on a change of control?', type: 'string' },
    ],
    documents: DOCS.map((d) => ({ document_id: d, rel_path: `contracts/${d}.md` })),
  } }));
  const reviewId = created.review_id;
  const cols = created.columns;
  const colMap = { 'governing-law': cols[0], 'liability-cap': cols[1], 'change-of-control': cols[2] };
  for (const p of payloads) p.cells = p.cells.map((c) => ({ ...c, column_id: colMap[c.column_id] }));
  parse(await client.callTool({ name: 'ingest_results', arguments: { review_id: reviewId, kind: 'initial', columns: cols, batch: payloads.slice(0, 3) } }));
  const r = parse(await client.callTool({ name: 'ingest_results', arguments: { review_id: reviewId, kind: 'initial', columns: cols, batch: payloads.slice(3) } }));
  parse(await client.callTool({ name: 'finalize_review', arguments: { review_id: reviewId } }));
  process.stdout.write(JSON.stringify({ review_id: reviewId, summary: r.summary }) + '\n');
} finally {
  await client.close();
}
