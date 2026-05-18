import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const entry = join(here, "dist", "index.js");

const tmp = mkdtempSync(join(tmpdir(), "oscar-onboard-smoke-"));
const profilePath = join(tmp, "profile.json");

const transport = new StdioClientTransport({
  command: "node",
  args: [entry],
  env: { ...process.env, OSCAR_PROFILE_PATH: profilePath },
});

const client = new Client({ name: "smoke-client", version: "0.0.1" });
await client.connect(transport);

const tools = await client.listTools();
const names = tools.tools.map((t) => t.name).sort();
console.log("tools:", names.join(", "));
if (names.join(",") !== "finalize_profile") {
  console.error("FAIL: unexpected tool set");
  process.exit(1);
}

const sampleProfile = {
  schema_version: 1,
  completed_at: new Date().toISOString(),
  user: {
    name: "Smoke Test",
    role: "general-counsel",
    role_label: "General Counsel",
  },
  corporate: {
    name: "Smoke Industries",
    industry: "Testing",
    size_band: "51-200",
  },
  practice_areas: [
    {
      id: "commercial",
      name: "Commercial",
      body: "Customers, vendors, suppliers, and contract memory live here.",
      source: "default",
    },
    {
      id: "custom-procurement",
      name: "Procurement",
      body: "Custom user-added area.",
      source: "user-added",
    },
  ],
  provider: { kind: "minimax", model: "MiniMax-M2.5" },
};

const written = await client.callTool({
  name: "finalize_profile",
  arguments: sampleProfile,
});
console.log("finalize_profile:", JSON.stringify(written.content));

const text = written.content?.[0]?.text ?? "";
const parsed = JSON.parse(text);
if (parsed.ok !== true || parsed.practice_area_count !== 2) {
  console.error("FAIL: finalize_profile response unexpected");
  process.exit(1);
}

await client.close();

if (!existsSync(profilePath)) {
  console.error("FAIL: profile file not written");
  process.exit(1);
}

const onDisk = JSON.parse(readFileSync(profilePath, "utf8"));
if (
  onDisk.schema_version !== 1 ||
  onDisk.user.role !== "general-counsel" ||
  onDisk.practice_areas.length !== 2 ||
  onDisk.practice_areas[1].source !== "user-added"
) {
  console.error("FAIL: on-disk profile shape mismatched");
  console.error(JSON.stringify(onDisk, null, 2));
  process.exit(1);
}

rmSync(tmp, { recursive: true, force: true });
console.log("OK");
