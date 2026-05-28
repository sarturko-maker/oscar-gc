// SPDX-License-Identifier: AGPL-3.0-or-later
// Generate N markdown contract fixtures for the Sprint 35 Tabular Review dogfood
// by templating the five archetypes (atlas/borealis/cobalt/delta/echo) with
// varied parties + jurisdictions. Markdown so the grounding gate (text-only)
// actually runs. Usage: node generate-fixtures.mjs <out-dir> [count=50]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2];
const count = Number(process.argv[3] ?? 50);
if (!outDir) {
  process.stderr.write("usage: node generate-fixtures.mjs <out-dir> [count]\n");
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const PARTIES = [
  "Atlas", "Borealis", "Cobalt", "Delta", "Echo", "Fathom", "Gravity", "Helios",
  "Ionic", "Juniper", "Kestrel", "Lumen", "Marlow", "Nimbus", "Orbit", "Pylon",
  "Quartz", "Ridge", "Solstice", "Tundra", "Umbra", "Vela", "Wren", "Xenon", "Yarrow", "Zephyr",
];
const LAWS = [
  "England and Wales", "the State of New York", "the Republic of Singapore",
  "the Federal Republic of Germany", "the State of Delaware", "Scotland",
  "the Republic of Ireland", "the Hong Kong Special Administrative Region",
];

// answer = grounded clean; not_found = column absent; paraphrase = indirection that tempts a summary.
const archetype = (i) => ["answer", "not_found", "paraphrase", "answer", "answer"][i % 5];

function contract(i) {
  const a = PARTIES[i % PARTIES.length];
  const b = PARTIES[(i + 7) % PARTIES.length];
  const law = LAWS[i % LAWS.length];
  const kind = archetype(i);
  const lines = [`# COMMERCIAL AGREEMENT ${i + 1}`, "",
    `This Agreement is made between ${a} Holdings Ltd ("Customer") and ${b} Systems Inc. ("Supplier").`, "",
    "## 3. Services", "", "Supplier shall provide the services described in each Statement of Work.", "",
    "## 9. Limitation of Liability", "",
    `Each party's aggregate liability under this Agreement, whether in contract, tort or otherwise, shall not exceed the total fees paid by the Customer in the twelve (12) months preceding the claim.`, ""];
  if (kind !== "not_found") {
    lines.push("## 14. Change of Control", "",
      `A change of Control of the Supplier entitles the Customer to terminate this Agreement on thirty (30) days' written notice.`, "");
  }
  if (kind === "paraphrase") {
    lines.push("## 1. Definitions", "", `"Applicable Law" means the law identified in Schedule 1.`, "",
      "## 22. Governing Law", "",
      "The construction, validity and performance of this Agreement, and all non-contractual obligations arising out of or in connection with it, shall be governed by and determined in accordance with the Applicable Law.", "",
      "## Schedule 1", "", `Applicable Law: the laws of ${law}.`, "");
  } else {
    lines.push("## 19. Governing Law", "",
      `This Agreement shall be governed by and construed in accordance with the laws of ${law}.`, "");
  }
  return lines.join("\n");
}

for (let i = 0; i < count; i++) {
  const a = PARTIES[i % PARTIES.length].toLowerCase();
  writeFileSync(join(outDir, `contract-${String(i + 1).padStart(2, "0")}-${a}.md`), contract(i), "utf8");
}
process.stdout.write(`wrote ${count} fixtures to ${outDir}\n`);
