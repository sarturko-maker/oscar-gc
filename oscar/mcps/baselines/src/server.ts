import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { BaselineStore } from "./store.js";

export function buildServer(store: BaselineStore): McpServer {
  const server = new McpServer({
    name: "oscar-baselines",
    version: "0.1.0",
  });

  server.registerTool(
    "record_observation",
    {
      description:
        "Record an observation for a baseline dimension. Observations accumulate into a distribution from which mean / stddev / min / max are computed. Use this when an agent measures a value worth tracking over time (e.g. the indemnity-cap percentage in a deal under review, a verification-pass rate, a clause-quality score).",
      inputSchema: {
        dimension: z
          .string()
          .min(1)
          .describe(
            "Free-form name of the dimension (e.g. 'ma-indemnity-cap-percent', 'verification-pass-rate'). Stable across sessions; observations are grouped by exact-match dimension name.",
          ),
        value: z.number().describe("Numeric value of the observation."),
        context: z
          .string()
          .optional()
          .describe(
            "Optional short note about what was observed (e.g. 'Acme MSA, mid-market US') for audit-trail purposes.",
          ),
      },
    },
    async ({ dimension, value, context }) => {
      const count = store.record(dimension, {
        value,
        context,
        timestamp: new Date().toISOString(),
      });
      return {
        content: [
          {
            type: "text",
            text: `Recorded observation: ${dimension} = ${value} (sample size now ${count}).`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_baselines",
    {
      description: "List all dimensions with at least one observation, with summary stats.",
      inputSchema: {},
    },
    async () => {
      const dimensions = store.listDimensions();
      if (dimensions.length === 0) {
        return {
          content: [
            { type: "text", text: "No baselines recorded yet. Use record_observation to seed one." },
          ],
        };
      }
      const lines: string[] = ["## Baselines", ""];
      for (const dim of dimensions) {
        const stats = store.baseline(dim);
        if (!stats) continue;
        lines.push(
          `- **${dim}**: n=${stats.sampleSize}, mean=${stats.mean}, stdDev=${stats.stdDev}, range=[${stats.min}, ${stats.max}], last=${stats.lastUpdated}`,
        );
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  server.registerTool(
    "get_baseline",
    {
      description: "Retrieve the full distribution stats for a single dimension.",
      inputSchema: {
        dimension: z.string().min(1).describe("Dimension name (must match an existing observation set)."),
      },
    },
    async ({ dimension }) => {
      const stats = store.baseline(dimension);
      if (!stats) {
        return {
          content: [
            {
              type: "text",
              text: `No baseline found for "${dimension}". Use record_observation to seed it.`,
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: [
              `## Baseline: ${stats.dimension}`,
              `**Sample size**: ${stats.sampleSize}`,
              `**Mean**: ${stats.mean}`,
              `**Std Dev**: ${stats.stdDev}`,
              `**Range**: [${stats.min}, ${stats.max}]`,
              `**Last updated**: ${stats.lastUpdated}`,
            ].join("\n"),
          },
        ],
      };
    },
  );

  server.registerTool(
    "check_against_baseline",
    {
      description:
        "Compare an observed value against the baseline for a dimension. Returns severity: 'ok' (within 2σ or insufficient sample), 'warning' (>2σ from mean), 'regression' (>3σ from mean). Requires at least 3 observations to be meaningful — fewer returns 'ok' with a low-sample note.",
      inputSchema: {
        dimension: z.string().min(1).describe("Dimension name to check against."),
        observed: z.number().describe("The observed value to compare."),
      },
    },
    async ({ dimension, observed }) => {
      const violation = store.check(dimension, observed);
      if (!violation) {
        return {
          content: [
            {
              type: "text",
              text: `No baseline found for "${dimension}". Cannot evaluate.`,
            },
          ],
        };
      }
      const icon =
        violation.severity === "ok" ? "✓" : violation.severity === "warning" ? "⚠️" : "✗";
      const lines = [
        `## Baseline check: ${dimension} ${icon}`,
        `**Observed**: ${observed}`,
        `**Expected**: mean ${violation.expectedMean} ± ${violation.expectedStdDev} (stddev)`,
        `**Deviation**: ${violation.sigma}σ`,
        `**Severity**: ${violation.severity.toUpperCase()}`,
      ];
      if (violation.severity === "ok" && Math.abs(violation.sigma) === 0) {
        lines.push("", "*Note: low sample size; the baseline is not yet statistically meaningful.*");
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  return server;
}
