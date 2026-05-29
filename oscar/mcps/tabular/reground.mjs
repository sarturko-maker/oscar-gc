// SPDX-License-Identifier: AGPL-3.0-or-later
// Re-ground a real manifest's answers+quotes through the (fixed) MCP to prove the
// basename-fallback grounding fix on real data. Reads an existing manifest, rebuilds
// extractor payloads from its canonical columns, creates a fresh review in the same
// matter (bare rel_paths, as the live agent set them), ingests, and prints the
// resulting grounding methods. Usage: node reground.mjs <matter-dir> <manifest.json>
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { readFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mcpEntry = join(here, 'dist', 'index.js');
const matter = process.argv[2];
const manifestPath = process.argv[3];
const m = JSON.parse(readFileSync(manifestPath, 'utf8'));
const cols = m.columns;
const payloads = m.rows.map((row) => ({
  document_id: row.document_id,
  document_name: row.document_name,
  cells: cols
    .map((col) => row.cells[col.id])
    .filter(Boolean)
    .map((c) => ({ column_id: c.column_id, answer: c.value, quote: c.source_quote, locator: c.source_location, confidence: c.confidence })),
}));

const transport = new StdioClientTransport({ command: 'node', args: [mcpEntry], env: { ...process.env, OSCAR_MATTER_DIR: matter } });
const client = new Client({ name: 'reground', version: '0.0.1' });
await client.connect(transport);
const parse = (r) => JSON.parse(r.content[0].text);
try {
  const created = parse(await client.callTool({ name: 'create_review', arguments: {
    title: m.title + ' (re-grounded)',
    columns: cols.map((c) => ({ label: c.label, prompt: c.prompt, type: c.type })),
    // Bare filenames, exactly as the live MiniMax agent set them.
    documents: m.rows.map((row) => ({ document_id: row.document_id, document_name: row.document_name, rel_path: basename(row.rel_path) })),
  } }));
  const colIds = created.columns;
  for (const p of payloads) p.cells = p.cells.map((c, i) => ({ ...c, column_id: colIds[i] }));
  const r = parse(await client.callTool({ name: 'ingest_results', arguments: { review_id: created.review_id, kind: 'initial', columns: colIds, batch: payloads } }));
  const m2 = parse(await client.callTool({ name: 'read_manifest', arguments: { review_id: created.review_id } }));
  const gm = {};
  for (const row of m2.rows) for (const c of Object.values(row.cells)) { const k = (c.verification || {}).method || '-'; gm[k] = (gm[k] || 0) + 1; }
  process.stdout.write(JSON.stringify({ review_id: created.review_id, summary: r.summary, grounding_methods: gm }) + '\n');
} finally {
  await client.close();
}
