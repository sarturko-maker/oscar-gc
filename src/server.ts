import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { verifyEvidence, type FindingGroundingResult } from "./verifier.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "oscar-grounding-verifier",
    version: "0.1.0",
  });

  server.registerTool(
    "verify_grounding",
    {
      description:
        "Mechanically verify that an evidence string's citations (Section X.Y, Clause N) and quoted text exist in the supplied document text. Zero LLM cost — pure string matching with sliding-window fuzzy fallback. Returns per-citation found/not-found and an overall grounding score (0.0-1.0).",
      inputSchema: {
        evidence: z
          .array(z.string().min(1))
          .min(1)
          .describe(
            'Evidence strings to verify. Each may contain section refs ("Section 5.2"), quoted text ("..."), or both. The verifier extracts them automatically.',
          ),
        document_text: z
          .string()
          .min(1)
          .describe(
            "Full text of the document the evidence claims to cite. Typically fetched via oscar-document-reader (read_document_section with section='full') or pasted directly.",
          ),
        section_headings: z
          .array(z.string())
          .optional()
          .describe(
            "Optional list of section heading texts from the document. Improves section-ref matching accuracy.",
          ),
      },
    },
    async ({ evidence, document_text, section_headings }) => {
      const results = verifyEvidence(evidence, document_text, section_headings ?? []);
      const overallScore =
        results.length > 0 ? results.reduce((s, r) => s + r.score, 0) / results.length : 1.0;

      const lines: string[] = [
        "## Grounding Report",
        `**Overall score**: ${(overallScore * 100).toFixed(0)}%`,
        "",
      ];

      for (const er of results) {
        lines.push(`### Evidence: "${er.evidenceText}${er.evidenceText.length === 120 ? "..." : ""}"`);
        if (er.sectionRefs.length > 0) {
          lines.push("**Section references**:");
          for (const sr of er.sectionRefs) {
            lines.push(`- ${sr.ref}: ${sr.found ? "FOUND" : "NOT FOUND"}`);
          }
        }
        if (er.quotes.length > 0) {
          lines.push("**Quoted text**:");
          for (const qr of er.quotes) {
            const marker = qr.found ? "FOUND" : "NOT FOUND";
            const boiler = qr.boilerplate ? " (boilerplate — half weight)" : "";
            lines.push(`- "${qr.quote}${qr.quote.length === 80 ? "..." : ""}": ${marker} (${(qr.overlap * 100).toFixed(0)}% overlap)${boiler}`);
          }
        }
        if (er.sectionRefs.length === 0 && er.quotes.length === 0) {
          lines.push("*No section refs or quotes extracted — counted as grounded (general observation).*");
        }
        lines.push(`**Evidence score**: ${(er.score * 100).toFixed(0)}%`);
        lines.push("");
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.registerTool(
    "verify_findings_batch",
    {
      description:
        "Batch-verify grounding for multiple findings. Each finding has an id, evidence array, and optional severity. Returns per-finding scores plus an aggregate table. Use before delivering substantive analysis to flag weakly-grounded findings.",
      inputSchema: {
        findings: z
          .array(
            z.object({
              id: z.string().min(1).describe("Stable finding identifier (e.g. F-001)."),
              evidence: z.array(z.string().min(1)).min(1).describe("Evidence strings for this finding."),
              severity: z.string().optional().describe("Optional severity label (RED/YELLOW/GREEN or similar)."),
            }),
          )
          .min(1)
          .describe("Findings to verify."),
        document_text: z
          .string()
          .min(1)
          .describe("Full text of the document the findings cite."),
        section_headings: z
          .array(z.string())
          .optional()
          .describe("Optional section heading texts for accurate section-ref matching."),
      },
    },
    async ({ findings, document_text, section_headings }) => {
      const headings = section_headings ?? [];
      const results: FindingGroundingResult[] = findings.map((f) => {
        const evidenceResults = verifyEvidence(f.evidence, document_text, headings);
        const overallScore =
          evidenceResults.length > 0
            ? evidenceResults.reduce((s, r) => s + r.score, 0) / evidenceResults.length
            : 1.0;
        return {
          findingId: f.id,
          severity: f.severity,
          evidenceResults,
          overallScore,
        };
      });

      const avgScore = results.reduce((s, r) => s + r.overallScore, 0) / results.length;
      const wellGrounded = results.filter((r) => r.overallScore >= 0.8);
      const weaklyGrounded = results.filter((r) => r.overallScore < 0.5);

      const lines: string[] = [
        "## Grounding Verification Summary",
        "",
        `**Findings verified**: ${results.length}`,
        `**Average grounding score**: ${(avgScore * 100).toFixed(0)}%`,
        `**Well-grounded (≥80%)**: ${wellGrounded.length}`,
        `**Weakly grounded (<50%)**: ${weaklyGrounded.length}`,
        "",
        "### Per-Finding Scores",
        "",
        "| Finding | Severity | Score | Status |",
        "|---------|----------|-------|--------|",
      ];

      for (const r of results) {
        const status =
          r.overallScore >= 0.8 ? "Well-grounded" : r.overallScore >= 0.5 ? "Partial" : "Weakly grounded";
        lines.push(
          `| ${r.findingId} | ${r.severity ?? "—"} | ${(r.overallScore * 100).toFixed(0)}% | ${status} |`,
        );
      }

      if (weaklyGrounded.length > 0) {
        lines.push("");
        lines.push("### Weakly Grounded Findings (require review)");
        for (const wg of weaklyGrounded) {
          lines.push(`- **${wg.findingId}** (${wg.severity ?? "—"}): ${(wg.overallScore * 100).toFixed(0)}% grounded`);
          for (const er of wg.evidenceResults) {
            const missing = [
              ...er.sectionRefs.filter((r) => !r.found).map((r) => `Section ${r.ref}`),
              ...er.quotes.filter((r) => !r.found).map((r) => `"${r.quote.slice(0, 40)}..."`),
            ];
            if (missing.length > 0) lines.push(`  - Not found: ${missing.join(", ")}`);
          }
        }
      }

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  return server;
}
