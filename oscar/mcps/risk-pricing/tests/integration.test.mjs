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
  names.join(",") === "assess_clause_risk,list_clause_benchmarks",
  `expected two tools, got: ${names.join(",")}`,
);
console.log("ok: 2 tools registered");

const listed = await client.callTool({ name: "list_clause_benchmarks", arguments: {} });
const listText = listed.content?.[0]?.text ?? "";
assertTrue(listText.includes("liability-cap-multiple"), "list missing liability-cap-multiple");
assertTrue(listText.includes("indemnity-basket-percent"), "list missing indemnity-basket-percent");
assertTrue(listText.includes("indemnity-cap-percent"), "list missing indemnity-cap-percent");
assertTrue(listText.includes("termination-cure-period-days"), "list missing termination-cure-period-days");
assertTrue(listText.includes("reps-survival-months"), "list missing reps-survival-months");
assertTrue(listText.includes("non-compete-duration-months"), "list missing non-compete-duration-months");
console.log("ok: list_clause_benchmarks returns 6 benchmark entries");

const marketCase = await client.callTool({
  name: "assess_clause_risk",
  arguments: { clause_type: "liability-cap-multiple", observed_value: 1.5 },
});
const marketText = marketCase.content?.[0]?.text ?? "";
assertTrue(marketText.includes("MARKET"), `expected MARKET band for value 1.5, got:\n${marketText}`);
console.log("ok: assess_clause_risk classifies market case");

const favourableCase = await client.callTool({
  name: "assess_clause_risk",
  arguments: { clause_type: "indemnity-basket-percent", observed_value: 0.25 },
});
const favourableText = favourableCase.content?.[0]?.text ?? "";
assertTrue(favourableText.includes("FAVOURABLE"), `expected FAVOURABLE band for value 0.25, got:\n${favourableText}`);
console.log("ok: assess_clause_risk classifies favourable case");

const offMarketCase = await client.callTool({
  name: "assess_clause_risk",
  arguments: { clause_type: "termination-cure-period-days", observed_value: 365 },
});
const offMarketText = offMarketCase.content?.[0]?.text ?? "";
assertTrue(offMarketText.includes("OFF-MARKET"), `expected OFF-MARKET band for 365-day cure, got:\n${offMarketText}`);
console.log("ok: assess_clause_risk classifies off-market case");

const unknown = await client.callTool({
  name: "assess_clause_risk",
  arguments: { clause_type: "made-up-clause", observed_value: 5 },
});
const unknownText = unknown.content?.[0]?.text ?? "";
assertTrue(unknownText.toLowerCase().includes("unknown clause_type"), `expected unknown clause_type message, got:\n${unknownText}`);
console.log("ok: unknown clause_type handled");

const withText = await client.callTool({
  name: "assess_clause_risk",
  arguments: {
    clause_type: "reps-survival-months",
    observed_value: 18,
    clause_text: "Representations survive for eighteen (18) months following Closing.",
  },
});
const withTextOut = withText.content?.[0]?.text ?? "";
assertTrue(withTextOut.includes("Clause under review"), "clause_text not echoed in response");
assertTrue(withTextOut.includes("eighteen"), "clause_text content missing");
console.log("ok: clause_text echoed when provided");

const percentile = await client.callTool({
  name: "assess_clause_risk",
  arguments: { clause_type: "reps-survival-months", observed_value: 15 },
});
const percentileText = percentile.content?.[0]?.text ?? "";
assertTrue(/p\d+/.test(percentileText), `expected percentile in output, got:\n${percentileText}`);
console.log("ok: percentile present in output");

await client.close();
console.log("\nALL TESTS PASS");
