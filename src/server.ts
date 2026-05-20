import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DOCUMENTS, type DocumentSection } from "./documents.js";

export function buildServer(): McpServer {
  const server = new McpServer({
    name: "oscar-document-reader",
    version: "0.1.0",
  });

  server.registerTool(
    "list_documents",
    {
      description:
        "List all documents available in this session. Returns document names, page counts, word counts, and a table of contents (top-level section headings). Use this first to understand what documents are available before reading specific sections.",
      inputSchema: {},
    },
    async () => {
      if (DOCUMENTS.length === 0) {
        return { content: [{ type: "text", text: "No documents available for this session." }] };
      }

      const docs = DOCUMENTS.map((doc, i) => {
        const toc = flattenHeadings(doc.sections, 2)
          .map((h) => `  ${"  ".repeat(h.level - 1)}${h.heading}`)
          .join("\n");

        const parts = [
          `## Document ${i + 1}: ${doc.name}`,
          `- **Type:** ${doc.mimeType}`,
          `- **Pages:** ${doc.pageCount}`,
          `- **Words:** ${doc.wordCount.toLocaleString()}`,
          `- **Sections:** ${doc.sections.length} top-level`,
          `- **Defined Terms:** ${doc.definedTerms.length}`,
          `- **Tables:** ${doc.tables.length}`,
        ];

        if (doc.parseWarnings && doc.parseWarnings.length > 0) {
          parts.push("");
          parts.push("### ⚠ Parse Warnings");
          parts.push("*The following regions may have unreliable text extraction.*");
          for (const w of doc.parseWarnings) {
            parts.push(`- **${w.type}** (${w.location ?? "unknown location"}): ${w.message}`);
            if (w.sample) parts.push(`  \`${w.sample.slice(0, 100)}\``);
          }
        }

        parts.push("");
        parts.push("### Table of Contents");
        parts.push(toc || "  (no sections detected)");

        return parts.join("\n");
      });

      return { content: [{ type: "text", text: docs.join("\n\n---\n\n") }] };
    },
  );

  server.registerTool(
    "read_document_section",
    {
      description:
        'Read a specific section from a document by heading text or section index. Use list_documents first to see available sections. You can also pass "full" to get the complete document text (use sparingly for large documents).',
      inputSchema: {
        document_index: z
          .number()
          .int()
          .min(0)
          .describe("Index of the document (0-based, from list_documents)."),
        section: z
          .string()
          .min(1)
          .describe('Section heading to search for (partial match OK), or "full" for entire document text.'),
      },
    },
    async ({ document_index, section }) => {
      if (document_index >= DOCUMENTS.length) {
        return {
          content: [
            {
              type: "text",
              text: `Document index ${document_index} is out of range. Only ${DOCUMENTS.length} document(s) available.`,
            },
          ],
        };
      }
      const doc = DOCUMENTS[document_index];

      if (section.toLowerCase() === "full") {
        const maxChars = 50_000;
        if (doc.fullText.length > maxChars) {
          return {
            content: [
              {
                type: "text",
                text: `# ${doc.name} (truncated — ${doc.wordCount.toLocaleString()} words)\n\n${doc.fullText.slice(0, maxChars)}\n\n...[truncated at ${maxChars.toLocaleString()} characters]`,
              },
            ],
          };
        }
        return { content: [{ type: "text", text: `# ${doc.name}\n\n${doc.fullText}` }] };
      }

      const match = findSection(doc.sections, section);
      if (!match) {
        const available = flattenHeadings(doc.sections, 3)
          .map((h) => h.heading)
          .join(", ");
        return {
          content: [
            {
              type: "text",
              text: `No section matching "${section}" found in ${doc.name}. Available sections: ${available}`,
            },
          ],
        };
      }

      const childContent =
        match.children.length > 0
          ? "\n\n" + match.children.map((c) => `### ${c.heading}\n\n${c.content}`).join("\n\n")
          : "";

      return {
        content: [{ type: "text", text: `## ${match.heading}\n\n${match.content}${childContent}` }],
      };
    },
  );

  server.registerTool(
    "search_document",
    {
      description:
        "Search across all documents for text containing the given query. Returns matching passages with surrounding context. Useful for finding specific clauses, terms, or provisions.",
      inputSchema: {
        query: z.string().min(1).describe("Text to search for (case-insensitive)."),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Maximum number of results to return (default: 5)."),
      },
    },
    async ({ query, max_results }) => {
      const maxResults = max_results ?? 5;
      const results: Array<{ docName: string; context: string; section?: string }> = [];
      const queryLower = query.toLowerCase();

      for (const doc of DOCUMENTS) {
        for (const section of flattenSections(doc.sections)) {
          if (section.content.toLowerCase().includes(queryLower)) {
            const idx = section.content.toLowerCase().indexOf(queryLower);
            const start = Math.max(0, idx - 150);
            const end = Math.min(section.content.length, idx + query.length + 150);
            const snippet =
              (start > 0 ? "..." : "") +
              section.content.slice(start, end) +
              (end < section.content.length ? "..." : "");
            results.push({ docName: doc.name, section: section.heading, context: snippet });
            if (results.length >= maxResults) break;
          }
        }
        if (results.length >= maxResults) break;
      }

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No matches found for "${query}" across ${DOCUMENTS.length} document(s).`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: results
              .map((r, i) => {
                const header = r.section ? `**${r.docName}** → ${r.section}` : `**${r.docName}**`;
                return `### Result ${i + 1}: ${header}\n\n${r.context}`;
              })
              .join("\n\n---\n\n"),
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_defined_terms",
    {
      description:
        "Get all defined terms extracted from documents. Returns terms found in quotes, bold, or ALLCAPS patterns common in legal documents.",
      inputSchema: {
        document_index: z
          .number()
          .int()
          .min(0)
          .optional()
          .describe("Index of a specific document (0-based). Omit to get terms from all documents."),
      },
    },
    async ({ document_index }) => {
      if (document_index !== undefined) {
        if (document_index >= DOCUMENTS.length) {
          return {
            content: [{ type: "text", text: `Document index ${document_index} is out of range.` }],
          };
        }
        const doc = DOCUMENTS[document_index];
        return {
          content: [
            {
              type: "text",
              text: `## Defined Terms in ${doc.name}\n\n${doc.definedTerms.join(", ") || "No defined terms detected."}`,
            },
          ],
        };
      }
      const allTerms = new Set<string>();
      for (const doc of DOCUMENTS) for (const term of doc.definedTerms) allTerms.add(term);
      return {
        content: [
          {
            type: "text",
            text: `## Defined Terms (${allTerms.size} unique across ${DOCUMENTS.length} document(s))\n\n${Array.from(allTerms).sort().join(", ") || "No defined terms detected."}`,
          },
        ],
      };
    },
  );

  server.registerTool(
    "get_document_tables",
    {
      description: "Get tables extracted from a document. Returns table data in markdown format.",
      inputSchema: {
        document_index: z.number().int().min(0).describe("Index of the document (0-based)."),
      },
    },
    async ({ document_index }) => {
      if (document_index >= DOCUMENTS.length) {
        return {
          content: [{ type: "text", text: `Document index ${document_index} is out of range.` }],
        };
      }
      const doc = DOCUMENTS[document_index];
      if (doc.tables.length === 0) {
        return { content: [{ type: "text", text: `No tables found in ${doc.name}.` }] };
      }
      return {
        content: [
          {
            type: "text",
            text: doc.tables
              .map((table, i) => {
                const caption = table.caption ? `**${table.caption}**\n\n` : "";
                const header = `| ${table.headers.join(" | ")} |`;
                const separator = `| ${table.headers.map(() => "---").join(" | ")} |`;
                const rows = table.rows.map((row) => `| ${row.join(" | ")} |`).join("\n");
                return `### Table ${i + 1}\n\n${caption}${header}\n${separator}\n${rows}`;
              })
              .join("\n\n"),
          },
        ],
      };
    },
  );

  return server;
}

function flattenHeadings(
  sections: DocumentSection[],
  maxDepth: number,
  currentDepth = 1,
): Array<{ heading: string; level: number }> {
  const result: Array<{ heading: string; level: number }> = [];
  for (const s of sections) {
    result.push({ heading: s.heading, level: s.level });
    if (currentDepth < maxDepth && s.children.length > 0) {
      result.push(...flattenHeadings(s.children, maxDepth, currentDepth + 1));
    }
  }
  return result;
}

function flattenSections(sections: DocumentSection[]): DocumentSection[] {
  const result: DocumentSection[] = [];
  for (const s of sections) {
    result.push(s);
    if (s.children.length > 0) result.push(...flattenSections(s.children));
  }
  return result;
}

function findSection(sections: DocumentSection[], query: string): DocumentSection | null {
  const queryLower = query.toLowerCase();
  for (const s of sections) {
    if (s.heading.toLowerCase().includes(queryLower)) return s;
    const child = findSection(s.children, query);
    if (child) return child;
  }
  return null;
}
