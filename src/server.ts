import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ProfileStore } from "./store.js";
import {
  CorporateSchema,
  PracticeAreaSchema,
  ProviderSchema,
  SCHEMA_VERSION,
  UserSchema,
} from "./schema.js";

export function buildServer(store: ProfileStore): McpServer {
  const server = new McpServer({
    name: "oscar-onboarding",
    version: "0.1.0",
  });

  server.registerTool(
    "finalize_profile",
    {
      description:
        "Finalize the user's Oscar GC profile and write it to disk. Call this once, at the end of the onboarding conversation, when you have captured the user's identity, their company context, the practice areas they care about, and the provider they will use. The write is atomic; calling this tool again overwrites the prior profile.",
      inputSchema: {
        schema_version: z
          .literal(SCHEMA_VERSION)
          .describe("Profile schema version. Must be 1 for this server."),
        completed_at: z
          .string()
          .min(1)
          .describe("UTC timestamp of completion, ISO 8601."),
        user: UserSchema.describe(
          "User identity. name may be null if the user declined to share it. role is a short slug (e.g. general-counsel); role_label is the human-readable form for display.",
        ),
        corporate: CorporateSchema.describe(
          "Corporate context. Any field may be null if the user declined to share that piece.",
        ),
        practice_areas: z
          .array(PracticeAreaSchema)
          .min(1)
          .describe(
            "The practice areas the user works in. source is 'default' for entries the agent offered from the seed list, 'user-added' for entries the user contributed during the conversation.",
          ),
        provider: ProviderSchema.describe(
          "LLM provider configuration. kind is the provider identifier; model is the specific model identifier.",
        ),
      },
    },
    async (input) => {
      const written = await store.write(input);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              schema_version: written.schema_version,
              practice_area_count: written.practice_areas.length,
              completed_at: written.completed_at,
            }),
          },
        ],
      };
    },
  );

  return server;
}
