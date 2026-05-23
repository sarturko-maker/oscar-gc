import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { NotesStore } from "./store.js";

export function buildServer(store: NotesStore): McpServer {
  const server = new McpServer({
    name: "oscar-memory",
    version: "0.1.0",
  });

  server.registerTool(
    "store_note",
    {
      description:
        "Append a note tagged with scope_id to the in-house notes store. Use this when the user wants to remember something tied to a customer, entity, or stream.",
      inputSchema: {
        scope_id: z
          .string()
          .min(1)
          .describe("Identifier of the primary unit this note belongs to (e.g. acme-customer-001)."),
        body: z.string().describe("The note text to store."),
      },
    },
    async ({ scope_id, body }) => {
      const note = await store.append(scope_id, body);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ok: true, scope_id: note.scope_id, created_at: note.created_at }),
          },
        ],
      };
    },
  );

  server.registerTool(
    "list_notes",
    {
      description:
        "Return all stored notes for a given scope_id, sorted oldest-first. Use this when the user asks what is known about a customer, entity, or stream.",
      inputSchema: {
        scope_id: z
          .string()
          .min(1)
          .describe("Identifier of the primary unit to fetch notes for."),
      },
    },
    async ({ scope_id }) => {
      const notes = await store.byScope(scope_id);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ scope_id, notes }),
          },
        ],
      };
    },
  );

  return server;
}
