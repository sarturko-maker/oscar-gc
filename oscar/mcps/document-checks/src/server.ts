import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  analyzeCrossReferences,
  analyzeFormatting,
  analyzeHeadingHierarchy,
  analyzeNumbering,
} from "./checks.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "oscar-document-checks",
    version: "0.1.0",
  });

  server.registerTool(
    "check_document_structure",
    {
      description:
        "Computational structure check: detects heading hierarchy gaps (e.g. H1→H3 with no H2), section-numbering discontinuities, duplicate section numbers, and broken cross-references. Returns specific evidence-based findings plus a 0.0-1.0 score. Zero LLM cost.",
      inputSchema: {
        headings: z
          .array(
            z.object({
              text: z.string().describe("The heading text."),
              level: z.number().int().min(1).max(6).describe("Heading level (1-6)."),
              position: z.number().describe("Approximate character position in document."),
            }),
          )
          .describe("All headings extracted from the document."),
        section_numbers: z
          .array(z.string())
          .describe('All section numbers in document order (e.g., "1", "1.1", "2", "2.1").'),
        cross_references: z
          .array(
            z.object({
              text: z.string().describe('The reference text as it appears (e.g., "see Section 3.2").'),
              target: z.string().describe('The target being referenced (e.g., "3.2" or a heading text).'),
            }),
          )
          .describe("Cross-references found in the document."),
      },
    },
    async (args) => {
      const hierarchyIssues = analyzeHeadingHierarchy(args.headings);
      const numberingIssues = analyzeNumbering(args.section_numbers);
      const refIssues = analyzeCrossReferences(args.cross_references, args.headings, args.section_numbers);
      const allIssues = [...hierarchyIssues, ...numberingIssues, ...refIssues];
      const score = allIssues.length === 0 ? 1.0 : Math.max(0, 1.0 - allIssues.length * 0.15);

      const lines = [
        "## Structure Check Results",
        "",
        `**Score**: ${score.toFixed(2)} / 1.00`,
        `**Headings analysed**: ${args.headings.length}`,
        `**Section numbers**: ${args.section_numbers.length}`,
        `**Cross-references**: ${args.cross_references.length}`,
        `**Issues found**: ${allIssues.length}`,
        "",
        allIssues.length > 0
          ? `### Issues\n${allIssues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}`
          : "✓ No structural issues detected.",
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.registerTool(
    "check_document_formatting",
    {
      description:
        "Computational formatting check: detects inconsistent defined-term capitalization, unused defined terms, broken cross-references, mixed numbering patterns at a given level, and typography inconsistencies. Returns evidence-based findings plus a 0.0-1.0 score.",
      inputSchema: {
        defined_terms: z
          .array(
            z.object({
              term: z.string().describe("The defined term."),
              definition_location: z.string().describe("Where the term is defined."),
              usage_count: z.number().int().min(0).describe("How many times the term is used."),
              capitalized_consistently: z
                .boolean()
                .describe("Whether capitalisation is consistent across usages."),
            }),
          )
          .describe("All defined terms in the document."),
        cross_references: z
          .array(
            z.object({
              text: z.string().describe("The reference text."),
              target_exists: z.boolean().describe("Whether the referenced target exists."),
            }),
          )
          .describe("Cross-references with validation status."),
        numbering_schemes: z
          .array(
            z.object({
              level: z.number().int().min(1).describe("Nesting level (1 = top)."),
              pattern: z.string().describe('Pattern used (e.g. "1.2.3", "(a)", "i.").'),
              count: z.number().int().describe("Number of items using this pattern."),
            }),
          )
          .describe("Numbering patterns observed at each level."),
        typography_patterns: z
          .array(
            z.object({
              convention: z.string().describe('Description of the convention (e.g. "Bold for defined terms").'),
              consistent: z.boolean().describe("Whether this convention is applied consistently."),
              violations: z.number().int().min(0).describe("Number of violations found."),
            }),
          )
          .describe("Typography conventions and their consistency."),
      },
    },
    async (args) => {
      const result = analyzeFormatting(args);
      const score = result.issues.length === 0 ? 1.0 : Math.max(0, 1.0 - result.issues.length * 0.12);

      const lines = [
        "## Formatting Check Results",
        "",
        `**Score**: ${score.toFixed(2)} / 1.00`,
        `**Defined terms**: ${args.defined_terms.length} (${result.inconsistentTerms.length} inconsistent, ${result.unusedTerms.length} unused)`,
        `**Cross-references**: ${args.cross_references.length} (${result.brokenRefs.length} broken)`,
        `**Numbering schemes**: ${args.numbering_schemes.length}`,
        `**Typography conventions**: ${args.typography_patterns.length}`,
        `**Issues found**: ${result.issues.length}`,
        "",
        result.issues.length > 0
          ? `### Issues\n${result.issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}`
          : "✓ No formatting inconsistencies detected.",
      ];

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  return server;
}
