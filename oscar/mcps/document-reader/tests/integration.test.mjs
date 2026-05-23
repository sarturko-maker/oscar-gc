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
  names.join(",") === "get_defined_terms,get_document_tables,list_documents,read_document_section,search_document",
  `expected five tools, got: ${names.join(",")}`,
);
console.log("ok: 5 tools registered");

const listed = await client.callTool({ name: "list_documents", arguments: {} });
const listText = listed.content?.[0]?.text ?? "";
assertTrue(listText.includes("saas-msa-acme-2025.docx"), "list missing saas msa");
assertTrue(listText.includes("nda-mutual-template.docx"), "list missing nda");
assertTrue(listText.includes("Table of Contents"), "list missing TOC");
assertTrue(listText.includes("Parse Warnings"), "list missing parse warning section for nda");
console.log("ok: list_documents returns 2 documents with TOC + parse warnings");

const fullDoc = await client.callTool({
  name: "read_document_section",
  arguments: { document_index: 1, section: "full" },
});
assertTrue(
  (fullDoc.content?.[0]?.text ?? "").includes("Mutual Non-Disclosure"),
  "read_document_section full failed for nda",
);
console.log("ok: read_document_section (full) returns full text");

const sectionRead = await client.callTool({
  name: "read_document_section",
  arguments: { document_index: 0, section: "Termination" },
});
const sectionText = sectionRead.content?.[0]?.text ?? "";
assertTrue(sectionText.includes("Termination for cause"), `partial-match section read failed:\n${sectionText}`);
console.log("ok: read_document_section partial-heading match works");

const missingSection = await client.callTool({
  name: "read_document_section",
  arguments: { document_index: 0, section: "Nonexistent Section" },
});
const missingText = missingSection.content?.[0]?.text ?? "";
assertTrue(missingText.toLowerCase().includes("no section matching"), `expected 'no section matching', got:\n${missingText}`);
console.log("ok: missing section message");

const searchResult = await client.callTool({
  name: "search_document",
  arguments: { query: "Confidential Information" },
});
const searchText = searchResult.content?.[0]?.text ?? "";
assertTrue(searchText.includes("nda-mutual-template.docx"), `search did not find nda:\n${searchText}`);
console.log("ok: search_document finds matches");

const definedAll = await client.callTool({ name: "get_defined_terms", arguments: {} });
const definedText = definedAll.content?.[0]?.text ?? "";
assertTrue(definedText.includes("Confidential Information"), "defined terms missing 'Confidential Information'");
assertTrue(definedText.includes("Customer Data"), "defined terms missing 'Customer Data'");
console.log("ok: get_defined_terms (all docs) returns combined set");

const definedOne = await client.callTool({
  name: "get_defined_terms",
  arguments: { document_index: 1 },
});
const definedOneText = definedOne.content?.[0]?.text ?? "";
assertTrue(definedOneText.includes("Receiving Party"), "defined terms for doc 1 missing 'Receiving Party'");
assertTrue(!definedOneText.includes("Customer Data"), "defined terms for doc 1 should not include doc 0's terms");
console.log("ok: get_defined_terms (single doc) is scoped");

const tables = await client.callTool({
  name: "get_document_tables",
  arguments: { document_index: 0 },
});
const tablesText = tables.content?.[0]?.text ?? "";
assertTrue(tablesText.includes("Schedule 1"), `table caption missing:\n${tablesText}`);
assertTrue(tablesText.includes("| Tier |"), `table header missing:\n${tablesText}`);
console.log("ok: get_document_tables returns markdown-formatted table");

const emptyTables = await client.callTool({
  name: "get_document_tables",
  arguments: { document_index: 1 },
});
assertTrue(
  (emptyTables.content?.[0]?.text ?? "").toLowerCase().includes("no tables"),
  "empty tables case not handled",
);
console.log("ok: empty tables handled");

await client.close();
console.log("\nALL TESTS PASS");
