import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "..", "dist", "index.js");

function assertTrue(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    process.exit(1);
  }
}

const baselinesDir = mkdtempSync(join(tmpdir(), "oscar-baselines-test-"));

const transport = new StdioClientTransport({
  command: "node",
  args: [entry],
  env: { ...process.env, OSCAR_BASELINES_DIR: baselinesDir },
});

const client = new Client({ name: "integration-test", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
assertTrue(
  names.join(",") === "check_against_baseline,get_baseline,list_baselines,record_observation",
  `expected four tools, got: ${names.join(",")}`,
);
console.log("ok: 4 tools registered");

const empty = await client.callTool({ name: "list_baselines", arguments: {} });
assertTrue(
  (empty.content?.[0]?.text ?? "").toLowerCase().includes("no baselines recorded"),
  "expected empty-baselines message",
);
console.log("ok: empty baselines case");

const recordObs = async (dimension, value) => {
  await client.callTool({
    name: "record_observation",
    arguments: { dimension, value, context: "integration-test" },
  });
};

for (const v of [10, 12, 11, 13, 10, 14, 12, 11]) {
  await recordObs("ma-indemnity-cap-percent", v);
}
const listed = await client.callTool({ name: "list_baselines", arguments: {} });
const listText = listed.content?.[0]?.text ?? "";
assertTrue(listText.includes("ma-indemnity-cap-percent"), "list missing recorded dimension");
assertTrue(listText.includes("n=8"), `expected sample size 8 in list:\n${listText}`);
console.log("ok: record_observation + list_baselines round-trip");

const baseline = await client.callTool({
  name: "get_baseline",
  arguments: { dimension: "ma-indemnity-cap-percent" },
});
const baselineText = baseline.content?.[0]?.text ?? "";
assertTrue(baselineText.includes("Sample size**: 8"), `expected sample size 8 in get_baseline:\n${baselineText}`);
assertTrue(/Mean\*\*: 1[01]\.\d/.test(baselineText), `expected mean ~11.6, got:\n${baselineText}`);
console.log("ok: get_baseline returns full stats");

const okCheck = await client.callTool({
  name: "check_against_baseline",
  arguments: { dimension: "ma-indemnity-cap-percent", observed: 12 },
});
const okText = okCheck.content?.[0]?.text ?? "";
assertTrue(okText.includes("OK") || okText.includes("✓"), `expected ok severity for in-range value, got:\n${okText}`);
console.log("ok: in-range check returns OK");

const regression = await client.callTool({
  name: "check_against_baseline",
  arguments: { dimension: "ma-indemnity-cap-percent", observed: 50 },
});
const regressionText = regression.content?.[0]?.text ?? "";
assertTrue(regressionText.includes("REGRESSION") || regressionText.includes("WARNING"), `expected warning/regression for outlier, got:\n${regressionText}`);
console.log("ok: outlier check flags warning/regression");

const missingDim = await client.callTool({
  name: "get_baseline",
  arguments: { dimension: "nonexistent-dim" },
});
assertTrue(
  (missingDim.content?.[0]?.text ?? "").toLowerCase().includes("no baseline"),
  "expected 'no baseline' message for missing dimension",
);
console.log("ok: missing dimension handled");

await client.close();
rmSync(baselinesDir, { recursive: true, force: true });
console.log("\nALL TESTS PASS");
