import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "dist", "index.js");

function assertTrue(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const transport = new StdioClientTransport({
  command: "node",
  args: [entry],
  env: { ...process.env },
});

const client = new Client({ name: "integration-test", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
assertTrue(
  names.join(",") ===
    "get_knowledge_base_entry,list_knowledge_base_collections,search_knowledge_base",
  `expected three tools, got: ${names.join(",")}`,
);
console.log("ok: 3 tools registered");

const listed = await client.callTool({
  name: "list_knowledge_base_collections",
  arguments: {},
});
const listText = listed.content?.[0]?.text ?? "";
assertTrue(listText.includes("SaaS Contract Precedents"), "list missing saas-precedents");
assertTrue(listText.includes("M&A Negotiation Playbook"), "list missing ma-playbook");
assertTrue(listText.includes("GDPR Baseline References"), "list missing gdpr-baseline");
console.log("ok: list_knowledge_base_collections returns 3 collections");

const synonymSearch = await client.callTool({
  name: "search_knowledge_base",
  arguments: { query: "indemnify", max_results: 5 },
});
const synonymText = synonymSearch.content?.[0]?.text ?? "";
assertTrue(
  synonymText.toLowerCase().includes("indemnification") || synonymText.toLowerCase().includes("indemnity"),
  `synonym expansion failed — searching for "indemnify" should match indemnification chunks:\n${synonymText}`,
);
console.log("ok: synonym expansion finds indemnification on 'indemnify' query");

const filtered = await client.callTool({
  name: "search_knowledge_base",
  arguments: { query: "data processing", collection_id: "gdpr-baseline" },
});
const filteredText = filtered.content?.[0]?.text ?? "";
assertTrue(filteredText.includes("Article 28") || filteredText.includes("Article 32"), `collection_id filter failed:\n${filteredText}`);
assertTrue(!filteredText.includes("SaaS Contract Precedents"), "collection filter leaked into other collection");
console.log("ok: collection_id filter restricts results");

const jurisdictionFiltered = await client.callTool({
  name: "search_knowledge_base",
  arguments: { query: "data", jurisdiction: "EU" },
});
const jurFilteredText = jurisdictionFiltered.content?.[0]?.text ?? "";
assertTrue(jurFilteredText.includes("EU"), `jurisdiction filter failed:\n${jurFilteredText}`);
console.log("ok: jurisdiction filter applies");

const noResults = await client.callTool({
  name: "search_knowledge_base",
  arguments: { query: "qzqzqzqz nonsense" },
});
const noResultsText = noResults.content?.[0]?.text ?? "";
assertTrue(noResultsText.toLowerCase().includes("no knowledge base results"), `expected 'no results' message, got:\n${noResultsText}`);
console.log("ok: empty result handling");

const firstChunkId = "saas-msa-indemnity-001";
const entry1 = await client.callTool({
  name: "get_knowledge_base_entry",
  arguments: { chunk_id: firstChunkId },
});
const entryText = entry1.content?.[0]?.text ?? "";
assertTrue(entryText.includes("Indemnification"), `get_knowledge_base_entry returned wrong content:\n${entryText}`);
console.log(`ok: get_knowledge_base_entry(${firstChunkId})`);

const missingEntry = await client.callTool({
  name: "get_knowledge_base_entry",
  arguments: { chunk_id: "nonexistent-chunk-id" },
});
const missingText = missingEntry.content?.[0]?.text ?? "";
assertTrue(missingText.toLowerCase().includes("chunk not found"), `expected 'chunk not found', got:\n${missingText}`);
console.log("ok: missing chunk_id handled");

await client.close();
console.log("\nALL TESTS PASS");
