#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log("oscar-document-reader-mcp ready");
}

main().catch((err) => {
  logError("oscar-document-reader-mcp failed to start", err);
  process.exit(1);
});
