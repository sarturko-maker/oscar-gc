#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ProfileStore } from "./store.js";
import { buildServer } from "./server.js";

function log(msg: string, extra?: Record<string, unknown>): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: "info",
    msg,
    ...(extra ?? {}),
  });
  process.stderr.write(line + "\n");
}

function logError(msg: string, err: unknown): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: "error",
    msg,
    err:
      err instanceof Error
        ? { name: err.name, message: err.message, stack: err.stack }
        : String(err),
  });
  process.stderr.write(line + "\n");
}

async function main(): Promise<void> {
  const profilePath =
    process.env.OSCAR_PROFILE_PATH ??
    join(homedir(), ".config", "oscar", "profile.json");
  const store = new ProfileStore(profilePath);
  const server = buildServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("oscar-onboarding-mcp ready", { profilePath });
}

main().catch((err) => {
  logError("oscar-onboarding-mcp failed to start", err);
  process.exit(1);
});
