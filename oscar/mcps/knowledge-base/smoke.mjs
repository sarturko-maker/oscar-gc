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
const expected = "get_knowledge_base_entry,list_knowledge_base_collections,search_knowledge_base";
if (names.join(",") !== expected) {
  console.error("FAIL: unexpected tool set");
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${names.join(",")}`);
  process.exit(1);
}

const search = await client.callTool({
  name: "search_knowledge_base",
  arguments: { query: "indemnification", max_results: 3 },
});
const searchText = search.content?.[0]?.text ?? "";
if (!searchText.includes("Indemnification") && !searchText.includes("indemnify")) {
  console.error("FAIL: search did not return indemnification-related results");
  console.error(searchText);
  process.exit(1);
}
console.log("search_knowledge_base(indemnification): OK");

await client.close();
console.log("OK");
