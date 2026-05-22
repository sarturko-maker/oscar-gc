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
const expected = "assess_clause_risk,list_clause_benchmarks";
if (names.join(",") !== expected) {
  console.error("FAIL: unexpected tool set");
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${names.join(",")}`);
  process.exit(1);
}

const assessment = await client.callTool({
  name: "assess_clause_risk",
  arguments: { clause_type: "liability-cap-multiple", observed_value: 1.0 },
});
const text = assessment.content?.[0]?.text ?? "";
if (!text.includes("MARKET") && !text.includes("FAVOURABLE")) {
  console.error("FAIL: assessment did not classify");
  console.error(text);
  process.exit(1);
}
console.log("assess_clause_risk(liability-cap-multiple, 1.0): OK");

await client.close();
console.log("OK");
