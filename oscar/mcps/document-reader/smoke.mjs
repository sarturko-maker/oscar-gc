import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist", "index.js");

const transport = new StdioClientTransport({
  command: "node",
  args: [entry],
  env: { ...process.env },
});

const client = new Client({ name: "smoke-client", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));
const expected = "get_defined_terms,get_document_tables,list_documents,read_document_section,search_document";
if (names.join(",") !== expected) {
  console.error("FAIL: unexpected tool set");
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${names.join(",")}`);
  process.exit(1);
}

const listed = await client.callTool({ name: "list_documents", arguments: {} });
const listText = listed.content?.[0]?.text ?? "";
if (!listText.includes("saas-msa-acme-2025.docx")) {
  console.error("FAIL: list_documents missing sample doc");
  console.error(listText);
  process.exit(1);
}
console.log("list_documents: OK");

await client.close();
console.log("OK");
