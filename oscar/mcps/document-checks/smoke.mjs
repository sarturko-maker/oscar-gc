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
const expected = "check_document_formatting,check_document_structure";
if (names.join(",") !== expected) {
  console.error("FAIL: unexpected tool set");
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${names.join(",")}`);
  process.exit(1);
}

const result = await client.callTool({
  name: "check_document_structure",
  arguments: {
    headings: [
      { text: "1. Definitions", level: 1, position: 0 },
      { text: "2. Services", level: 1, position: 200 },
    ],
    section_numbers: ["1", "2"],
    cross_references: [],
  },
});
const text = result.content?.[0]?.text ?? "";
if (!text.includes("No structural issues")) {
  console.error("FAIL: clean document should report no issues");
  console.error(text);
  process.exit(1);
}
console.log("check_document_structure (clean): OK");

await client.close();
console.log("OK");
