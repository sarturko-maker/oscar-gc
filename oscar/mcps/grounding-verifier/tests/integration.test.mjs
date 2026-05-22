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
  names.join(",") === "verify_findings_batch,verify_grounding",
  `expected two tools, got: ${names.join(",")}`,
);
console.log("ok: 2 tools registered");

const documentText = `Section 3.1: Termination for cause. Either party may terminate this Agreement for cause upon thirty (30) days written notice to the other party of a material breach. "Cure period" means the period during which the breaching party may remedy the breach.

Section 5.2: Limitation of liability. Each party's aggregate liability shall not exceed the fees paid in the twelve (12) months preceding the event.`;

// Case 1: well-grounded — section ref + quote both present
const grounded = await client.callTool({
  name: "verify_grounding",
  arguments: {
    evidence: ['Section 3.1 specifies a 30-day cure period: "Cure period" means the period during which the breaching party may remedy the breach.'],
    document_text: documentText,
    section_headings: ["3.1 Termination for cause", "5.2 Limitation of liability"],
  },
});
const groundedText = grounded.content?.[0]?.text ?? "";
assertTrue(groundedText.includes("FOUND"), "well-grounded case: expected FOUND markers");
assertTrue(/100%|\b\d{2,3}%/.test(groundedText), "well-grounded case: expected percentage score");
console.log("ok: well-grounded evidence verified");

// Case 2: ungrounded — section that doesn't exist + made-up quote
const ungrounded = await client.callTool({
  name: "verify_grounding",
  arguments: {
    evidence: ['Section 99.9 contains an unprecedented clause: "this quote does not appear anywhere in the document at all".'],
    document_text: documentText,
  },
});
const ungroundedText = ungrounded.content?.[0]?.text ?? "";
assertTrue(ungroundedText.includes("NOT FOUND"), "ungrounded case: expected NOT FOUND markers");
console.log("ok: ungrounded evidence flagged");

// Case 3: boilerplate — common phrase should be half-weight even if found
const boilerplate = await client.callTool({
  name: "verify_grounding",
  arguments: {
    evidence: ['The document contains "shall not be liable" and Section 3.1.'],
    document_text: documentText.replace("Each party's aggregate liability shall not", "Each party's aggregate shall not be liable"),
    section_headings: ["3.1 Termination for cause"],
  },
});
const boilerplateText = boilerplate.content?.[0]?.text ?? "";
assertTrue(boilerplateText.includes("boilerplate"), `expected boilerplate marker:\n${boilerplateText}`);
console.log("ok: boilerplate phrases tagged");

// Case 4: batch verification
const batch = await client.callTool({
  name: "verify_findings_batch",
  arguments: {
    findings: [
      { id: "F-001", severity: "RED", evidence: ['Section 5.2 caps liability at twelve months of fees.'] },
      { id: "F-002", severity: "YELLOW", evidence: ['Section 99.9 says something invented.'] },
      { id: "F-003", evidence: ['General observation about the contract.'] },
    ],
    document_text: documentText,
    section_headings: ["3.1 Termination for cause", "5.2 Limitation of liability"],
  },
});
const batchText = batch.content?.[0]?.text ?? "";
assertTrue(batchText.includes("F-001"), "batch result missing F-001");
assertTrue(batchText.includes("F-002"), "batch result missing F-002");
assertTrue(batchText.includes("Weakly Grounded Findings") || batchText.includes("Weakly grounded"), "batch should flag weakly-grounded findings");
console.log("ok: verify_findings_batch returns per-finding scores + weakly-grounded summary");

// Case 5: no section refs / quotes → 100% (general observation)
const general = await client.callTool({
  name: "verify_grounding",
  arguments: {
    evidence: ["The contract is generally well-drafted in commercial terms."],
    document_text: documentText,
  },
});
const generalText = general.content?.[0]?.text ?? "";
assertTrue(generalText.includes("100%"), `general observation should score 100% (no citations to check), got:\n${generalText}`);
console.log("ok: general observation (no citations) scores 100%");

await client.close();
console.log("\nALL TESTS PASS");
