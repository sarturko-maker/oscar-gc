import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getChunkById, listCollections, searchKnowledgeBase } from "./retriever.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "oscar-knowledge-base",
    version: "0.1.0",
  });

  server.registerTool(
    "search_knowledge_base",
    {
      description:
        "Search the bundled legal-corpus knowledge base for relevant reference materials — SaaS contract precedents, M&A negotiation playbook entries, and GDPR baseline references. Returns ranked text chunks with source attribution. Use during analysis to ground claims against precedent or regulation.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(500)
          .describe(
            'Search query — describe what you are looking for (e.g., "indemnification clause SaaS", "GDPR data processing agreement", "force majeure post-COVID").',
          ),
        collection_id: z
          .string()
          .optional()
          .describe(
            "Filter to a specific collection ID (e.g. 'saas-precedents', 'ma-playbook', 'gdpr-baseline'). Omit to search all collections.",
          ),
        doc_type: z
          .string()
          .optional()
          .describe("Filter by document type: precedent, playbook, regulation."),
        jurisdiction: z
          .string()
          .optional()
          .describe("Filter by jurisdiction: US, EU, UK, etc."),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum number of results (default: 5)."),
      },
    },
    async (args) => {
      const results = searchKnowledgeBase({
        query: args.query,
        collectionId: args.collection_id,
        docType: args.doc_type,
        jurisdiction: args.jurisdiction,
        maxResults: args.max_results ?? 5,
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No knowledge base results for "${args.query}". The bundled corpus is small (placeholder for Sprint 22); the query may not match any indexed content.`,
            },
          ],
        };
      }

      const formatted = results
        .map((r, i) =>
          [
            `### Result ${i + 1}: ${r.heading || "(untitled section)"}`,
            `**Source**: ${r.document_filename} (${r.collection_name})`,
            `**Type**: ${r.doc_type || "unspecified"} | **Jurisdiction**: ${r.jurisdiction || "unspecified"}`,
            `**Chunk ID**: ${r.chunk_id}`,
            "",
            r.content.length > 2000
              ? r.content.slice(0, 2000) +
                "\n\n...[truncated — use get_knowledge_base_entry for full text]"
              : r.content,
          ].join("\n"),
        )
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text",
            text: `## Knowledge Base Results (${results.length} match${results.length === 1 ? "" : "es"} for "${args.query}")\n\n${formatted}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_knowledge_base_collections",
    {
      description:
        "List all knowledge base collections available, with document counts and word counts. Use this to understand what reference materials are bundled before searching.",
      inputSchema: {},
    },
    async () => {
      const collections = listCollections();
      if (collections.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "No knowledge base collections found.",
            },
          ],
        };
      }

      const formatted = collections
        .map((c) =>
          [
            `### ${c.name}`,
            `**ID**: ${c.id}`,
            `**Type**: ${c.doc_type || "unspecified"}`,
            `**Documents**: ${c.documentCount} | **Chunks**: ${c.chunkCount} | **Words**: ${c.totalWords.toLocaleString()}`,
            c.description ? `**Description**: ${c.description}` : "",
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n\n---\n\n");

      return {
        content: [
          {
            type: "text",
            text: `## Knowledge Base Collections (${collections.length})\n\n${formatted}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_knowledge_base_entry",
    {
      description:
        "Retrieve a specific knowledge base chunk by ID. Use after search_knowledge_base to get the full content of a truncated result.",
      inputSchema: {
        chunk_id: z.string().describe("The chunk ID from a search result."),
      },
    },
    async (args) => {
      const chunk = getChunkById(args.chunk_id);
      if (!chunk) {
        return {
          content: [
            {
              type: "text",
              text: `Chunk not found: ${args.chunk_id}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: [
              `## ${chunk.heading || "(untitled)"}`,
              `**Source**: ${chunk.document_filename} (${chunk.collection_name})`,
              `**Type**: ${chunk.doc_type || "unspecified"} | **Jurisdiction**: ${chunk.jurisdiction || "unspecified"}`,
              "",
              chunk.content,
            ].join("\n"),
          },
        ],
      };
    },
  );

  return server;
}
