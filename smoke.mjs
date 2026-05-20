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
const expected = "check_against_baseline,get_baseline,list_baselines,record_observation";
if (names.join(",") !== expected) {
  console.error("FAIL: unexpected tool set");
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${names.join(",")}`);
  process.exit(1);
}

await client.callTool({
  name: "record_observation",
  arguments: { dimension: "smoke-test", value: 1.0 },
});
const listed = await client.callTool({ name: "list_baselines", arguments: {} });
const text = listed.content?.[0]?.text ?? "";
if (!text.includes("smoke-test")) {
  console.error("FAIL: list_baselines did not include recorded dimension");
  console.error(text);
  process.exit(1);
}
console.log("record + list: OK");

await client.close();
console.log("OK");
