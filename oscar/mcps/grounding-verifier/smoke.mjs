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
const expected = "verify_findings_batch,verify_grounding";
if (names.join(",") !== expected) {
  console.error("FAIL: unexpected tool set");
  console.error(`expected: ${expected}`);
  console.error(`actual:   ${names.join(",")}`);
  process.exit(1);
}

const documentText = 'Section 3.1: Termination for cause. Either party may terminate this Agreement for cause upon thirty (30) days written notice. "Cure period" means the period during which the breaching party may remedy the breach.';
const result = await client.callTool({
  name: "verify_grounding",
  arguments: {
    evidence: ['Section 3.1 specifies a 30-day cure period: "Cure period" means the period during which the breaching party may remedy the breach.'],
    document_text: documentText,
    section_headings: ["3.1 Termination for cause"],
  },
});
const text = result.content?.[0]?.text ?? "";
if (!text.includes("FOUND")) {
  console.error("FAIL: smoke check did not show grounded result");
  console.error(text);
  process.exit(1);
}
console.log("verify_grounding: OK");

await client.close();
console.log("OK");
