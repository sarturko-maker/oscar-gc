import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist", "index.js");

const tmp = mkdtempSync(join(tmpdir(), "oscar-smoke-"));
const dataPath = join(tmp, "notes.json");

const transport = new StdioClientTransport({
  command: "node",
  args: [entry],
  env: { ...process.env, OSCAR_MEMORY_PATH: dataPath },
});

const client = new Client({ name: "smoke-client", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));
if (names.join(",") !== "list_notes,store_note") {
  console.error("FAIL: unexpected tool set");
  process.exit(1);
}

const stored = await client.callTool({
  name: "store_note",
  arguments: { scope_id: "smoke-1", body: "hello from smoke test" },
});
console.log("store_note:", JSON.stringify(stored.content));

const listed = await client.callTool({
  name: "list_notes",
  arguments: { scope_id: "smoke-1" },
});
console.log("list_notes:", JSON.stringify(listed.content));

const text = listed.content?.[0]?.text ?? "";
if (!text.includes("hello from smoke test")) {
  console.error("FAIL: list_notes did not return the stored body");
  process.exit(1);
}

await client.close();

if (!existsSync(dataPath)) {
  console.error("FAIL: data file not written");
  process.exit(1);
}

rmSync(tmp, { recursive: true, force: true });
console.log("OK");
