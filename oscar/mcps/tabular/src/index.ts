#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { matterDir } from "./matterDir.js";
import { TabularStore } from "./store.js";
import { buildServer } from "./server.js";

function log(msg: string, extra?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level: "info", msg, ...(extra ?? {}) });
  process.stderr.write(line + "\n");
}

function logError(msg: string, err: unknown): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: "error",
    msg,
    err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
  });
  process.stderr.write(line + "\n");
}

async function main(): Promise<void> {
  const matter = matterDir();
  const store = new TabularStore(matter);
  const server = buildServer(store);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("oscar-tabular-mcp ready", { matter });
}

main().catch((err) => {
  logError("oscar-tabular-mcp failed to start", err);
  process.exit(1);
});
