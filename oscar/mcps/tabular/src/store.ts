// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Atomic persistence for Tabular Review (ADR-111). One manifest.json per review
// under <matter>/outputs/tabular-review/<review-id>/, plus a sibling index.json
// the launcher reads. Atomic tmp→fsync→rename lifted from oscar/mcps/memory.

import { promises as fs, constants as fsConstants } from "node:fs";
import { dirname } from "node:path";
import {
  IndexSchema,
  ManifestSchema,
  type IndexEntry,
  type Manifest,
  type ReviewIndex,
} from "./schema.js";
import { indexPath, manifestPath } from "./matterDir.js";

async function writeAtomic(path: string, contents: string): Promise<void> {
  await fs.mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  const handle = await fs.open(
    tmp,
    fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_TRUNC,
    0o600,
  );
  try {
    await handle.writeFile(contents, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rename(tmp, path);
}

export class TabularStore {
  constructor(readonly matter: string) {}

  async readManifest(reviewId: string): Promise<Manifest | null> {
    let raw: string;
    try {
      raw = await fs.readFile(manifestPath(reviewId, this.matter), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw err;
    }
    return ManifestSchema.parse(JSON.parse(raw));
  }

  async writeManifest(manifest: Manifest, indexStatus: "in_progress" | "final"): Promise<void> {
    await writeAtomic(
      manifestPath(manifest.review_id, this.matter),
      JSON.stringify(manifest, null, 2),
    );
    await this.upsertIndex({
      review_id: manifest.review_id,
      title: manifest.title,
      created_at: manifest.created_at,
      updated_at: manifest.updated_at,
      document_count: manifest.rows.length,
      column_count: manifest.columns.length,
      status: indexStatus,
      summary: manifest.summary,
    });
  }

  async readIndex(): Promise<ReviewIndex> {
    let raw: string;
    try {
      raw = await fs.readFile(indexPath(this.matter), "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        return { schema_version: 1, reviews: [] };
      }
      throw err;
    }
    return IndexSchema.parse(JSON.parse(raw));
  }

  private async upsertIndex(entry: IndexEntry): Promise<void> {
    const index = await this.readIndex();
    const without = index.reviews.filter((r) => r.review_id !== entry.review_id);
    without.push(entry);
    without.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    await writeAtomic(
      indexPath(this.matter),
      JSON.stringify({ schema_version: 1, reviews: without }, null, 2),
    );
  }
}
