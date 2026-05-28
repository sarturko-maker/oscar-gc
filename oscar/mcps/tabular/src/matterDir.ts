// SPDX-License-Identifier: AGPL-3.0-or-later
//
// B-class resolution (CLAUDE.md MCP tool-schema design): the matter working dir
// is runtime-derived from OSCAR_MATTER_DIR (injected by buildPracticeAreaRecipe,
// mirroring oscar-fs) and MUST NOT appear in any LLM-visible tool schema.

import { promises as fs } from "node:fs";
import { join, resolve, normalize } from "node:path";

export function matterDir(): string {
  const dir = process.env.OSCAR_MATTER_DIR;
  if (!dir || dir.trim() === "") {
    throw new Error(
      "OSCAR_MATTER_DIR is not set — oscar-tabular requires the matter working dir (B-class, injected by the recipe envs).",
    );
  }
  return dir;
}

export function reviewsRoot(matter: string = matterDir()): string {
  return join(matter, "outputs", "tabular-review");
}

export function reviewDir(reviewId: string, matter: string = matterDir()): string {
  return join(reviewsRoot(matter), reviewId);
}

export function manifestPath(reviewId: string, matter: string = matterDir()): string {
  return join(reviewDir(reviewId, matter), "manifest.json");
}

export function indexPath(matter: string = matterDir()): string {
  return join(reviewsRoot(matter), "index.json");
}

const TEXT_EXT = new Set([".txt", ".md", ".markdown", ".text"]);

// Returns the plain text of a source document for the grounding gate, or null
// when the file is binary (pdf/docx — re-extraction is out of v1 scope; the gate
// marks the cell unverified rather than failing it) or unreadable. Guards against
// path traversal outside the matter dir.
export async function readSourceText(
  relPath: string,
  matter: string = matterDir(),
): Promise<string | null> {
  if (!relPath || relPath.trim() === "") return null;
  const base = normalize(matter);
  const abs = normalize(resolve(base, relPath));
  if (abs !== base && !abs.startsWith(base + "/")) return null;
  const dot = abs.lastIndexOf(".");
  const ext = dot >= 0 ? abs.slice(dot).toLowerCase() : "";
  if (!TEXT_EXT.has(ext)) return null;
  try {
    return await fs.readFile(abs, "utf8");
  } catch {
    // intentional: unreadable/missing source → treated as no-source; the
    // grounding gate (ADR-112) marks the cell unverified rather than failing it.
    return null;
  }
}
