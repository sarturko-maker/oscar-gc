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
  names.join(",") === "check_document_formatting,check_document_structure",
  `expected two tools, got: ${names.join(",")}`,
);
console.log("ok: 2 tools registered");

// Clean structure
const clean = await client.callTool({
  name: "check_document_structure",
  arguments: {
    headings: [
      { text: "1. Definitions", level: 1, position: 0 },
      { text: "1.1 Customer", level: 2, position: 100 },
      { text: "2. Services", level: 1, position: 200 },
    ],
    section_numbers: ["1", "1.1", "2"],
    cross_references: [{ text: "See Section 2", target: "2" }],
  },
});
assertTrue((clean.content?.[0]?.text ?? "").includes("No structural issues"), "clean doc should pass");
console.log("ok: clean document passes structure check");

// Hierarchy gap (H1 -> H3)
const hierarchyGap = await client.callTool({
  name: "check_document_structure",
  arguments: {
    headings: [
      { text: "1. Top", level: 1, position: 0 },
      { text: "1.1.1 Subsub", level: 3, position: 100 },
    ],
    section_numbers: ["1", "1.1.1"],
    cross_references: [],
  },
});
const hierarchyText = hierarchyGap.content?.[0]?.text ?? "";
assertTrue(hierarchyText.includes("hierarchy gap"), `expected hierarchy gap finding:\n${hierarchyText}`);
console.log("ok: hierarchy gap detected");

// Numbering gap (1 -> 3, skipping 2)
const numberingGap = await client.callTool({
  name: "check_document_structure",
  arguments: {
    headings: [
      { text: "1. First", level: 1, position: 0 },
      { text: "3. Third", level: 1, position: 200 },
    ],
    section_numbers: ["1", "3"],
    cross_references: [],
  },
});
const numberingText = numberingGap.content?.[0]?.text ?? "";
assertTrue(numberingText.includes("numbering gap"), `expected numbering gap:\n${numberingText}`);
console.log("ok: numbering gap detected");

// Broken cross-reference
const brokenRef = await client.callTool({
  name: "check_document_structure",
  arguments: {
    headings: [{ text: "1. Definitions", level: 1, position: 0 }],
    section_numbers: ["1"],
    cross_references: [{ text: "See Section 99", target: "99" }],
  },
});
const brokenRefText = brokenRef.content?.[0]?.text ?? "";
assertTrue(brokenRefText.includes("Broken cross-reference"), `expected broken cross-reference:\n${brokenRefText}`);
console.log("ok: broken cross-reference detected");

// Formatting check: clean
const cleanFormat = await client.callTool({
  name: "check_document_formatting",
  arguments: {
    defined_terms: [
      { term: "Customer", definition_location: "Section 1", usage_count: 5, capitalized_consistently: true },
    ],
    cross_references: [{ text: "See Section 2", target_exists: true }],
    numbering_schemes: [{ level: 1, pattern: "1.2.3", count: 5 }],
    typography_patterns: [{ convention: "Bold for defined terms", consistent: true, violations: 0 }],
  },
});
assertTrue((cleanFormat.content?.[0]?.text ?? "").includes("No formatting inconsistencies"), "clean formatting should pass");
console.log("ok: clean formatting passes");

// Formatting check: inconsistencies
const dirtyFormat = await client.callTool({
  name: "check_document_formatting",
  arguments: {
    defined_terms: [
      { term: "Customer", definition_location: "Section 1", usage_count: 5, capitalized_consistently: false },
      { term: "UnusedTerm", definition_location: "Section 2", usage_count: 0, capitalized_consistently: true },
    ],
    cross_references: [{ text: "See Section 99", target_exists: false }],
    numbering_schemes: [
      { level: 1, pattern: "1.2.3", count: 3 },
      { level: 1, pattern: "(a)", count: 2 },
    ],
    typography_patterns: [{ convention: "Bold for defined terms", consistent: false, violations: 3 }],
  },
});
const dirtyText = dirtyFormat.content?.[0]?.text ?? "";
assertTrue(dirtyText.includes("inconsistent capitalization"), `expected capitalization issue:\n${dirtyText}`);
assertTrue(dirtyText.includes("never used"), `expected unused term issue`);
assertTrue(dirtyText.includes("broken cross-reference"), `expected broken ref issue`);
assertTrue(dirtyText.includes("Mixed numbering patterns"), `expected mixed numbering issue`);
assertTrue(dirtyText.includes("Typography inconsistency"), `expected typography issue`);
console.log("ok: 5 formatting issue classes detected");

await client.close();
console.log("\nALL TESTS PASS");
