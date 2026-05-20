import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BENCHMARKS, type BenchmarkEntry, type RiskBand } from "./benchmarks.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "oscar-risk-pricing",
    version: "0.1.0",
  });

  server.registerTool(
    "list_clause_benchmarks",
    {
      description:
        "List all clause types this MCP can benchmark, with description, unit, jurisdiction/deal-size band, distribution stats (p10/p25/p50/p75/p90), and the favourable/market/aggressive bands. Use this before calling assess_clause_risk so you know which clause_type values are supported.",
      inputSchema: {},
    },
    async () => {
      const formatted = BENCHMARKS.map((b) =>
        [
          `### ${b.clauseType}`,
          `**Description**: ${b.description}`,
          `**Unit**: ${b.unit} | **Jurisdiction**: ${b.jurisdiction} | **Deal-size band**: ${b.dealSizeBand}`,
          `**Distribution**: p10=${b.distribution.p10}, p25=${b.distribution.p25}, p50=${b.distribution.p50}, p75=${b.distribution.p75}, p90=${b.distribution.p90}`,
          `**Bands** (favourable / market / aggressive): ${b.bands.favourable[0]}-${b.bands.favourable[1]} / ${b.bands.market[0]}-${b.bands.market[1]} / ${b.bands.aggressive[0]}-${b.bands.aggressive[1]}`,
          `**Sample size**: ${b.sampleSize} | **Source**: ${b.source}`,
        ].join("\n"),
      ).join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text",
            text: `## Available Benchmarks (${BENCHMARKS.length})\n\n${formatted}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "assess_clause_risk",
    {
      description:
        "Given a clause_type and an observed_value, return the benchmark band the value falls into (favourable / market / aggressive / off-market), the percentile relative to the bundled distribution, and a recommendation. For qualitative clauses (e.g. liability-cap-multiple), pass the numeric multiple. For percent-based clauses, pass the percent as a number (e.g. 0.75 for 0.75%). Call list_clause_benchmarks first to see supported clause types.",
      inputSchema: {
        clause_type: z
          .string()
          .min(1)
          .describe("The benchmarked clause type (e.g. 'liability-cap-multiple', 'indemnity-basket-percent')."),
        observed_value: z
          .number()
          .describe("The observed numeric value from the clause under review."),
        clause_text: z
          .string()
          .optional()
          .describe("Optional: the actual clause text, for the response narrative."),
      },
    },
    async ({ clause_type, observed_value, clause_text }) => {
      const benchmark = BENCHMARKS.find((b) => b.clauseType === clause_type);
      if (!benchmark) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown clause_type: "${clause_type}". Call list_clause_benchmarks to see supported types.`,
            },
          ],
        };
      }

      const band = classifyBand(benchmark, observed_value);
      const percentile = computePercentile(benchmark, observed_value);
      const recommendation = benchmark.recommendations[band];

      const sections: string[] = [
        `## Risk Assessment: ${benchmark.clauseType}`,
        `**Observed**: ${observed_value} ${benchmark.unit}`,
        `**Band**: ${band.toUpperCase()}`,
        `**Percentile**: p${percentile} (of ${benchmark.dealSizeBand}, ${benchmark.jurisdiction})`,
        `**Distribution** (for context): p10=${benchmark.distribution.p10}, p25=${benchmark.distribution.p25}, p50=${benchmark.distribution.p50}, p75=${benchmark.distribution.p75}, p90=${benchmark.distribution.p90}`,
        `**Source**: ${benchmark.source} (n=${benchmark.sampleSize})`,
        ``,
        `**Recommendation**: ${recommendation}`,
      ];

      if (clause_text) {
        sections.push("", `**Clause under review**:`, "> " + clause_text.slice(0, 500).replace(/\n/g, "\n> "));
      }

      return {
        content: [
          {
            type: "text",
            text: sections.join("\n"),
          },
        ],
      };
    },
  );

  return server;
}

function classifyBand(benchmark: BenchmarkEntry, value: number): RiskBand {
  const { bands } = benchmark;
  if (value >= bands.favourable[0] && value < bands.favourable[1]) return "favourable";
  if (value >= bands.market[0] && value <= bands.market[1]) return "market";
  if (value > bands.aggressive[0] && value <= bands.aggressive[1]) return "aggressive";
  return "off-market";
}

function computePercentile(benchmark: BenchmarkEntry, value: number): number {
  const { distribution } = benchmark;
  const points: Array<[number, number]> = [
    [10, distribution.p10],
    [25, distribution.p25],
    [50, distribution.p50],
    [75, distribution.p75],
    [90, distribution.p90],
  ];
  if (value <= points[0][1]) return points[0][0];
  if (value >= points[points.length - 1][1]) return points[points.length - 1][0];

  for (let i = 0; i < points.length - 1; i++) {
    const [lo_p, lo_v] = points[i];
    const [hi_p, hi_v] = points[i + 1];
    if (value >= lo_v && value <= hi_v) {
      if (hi_v === lo_v) return lo_p;
      const fraction = (value - lo_v) / (hi_v - lo_v);
      return Math.round(lo_p + fraction * (hi_p - lo_p));
    }
  }
  return 50;
}
