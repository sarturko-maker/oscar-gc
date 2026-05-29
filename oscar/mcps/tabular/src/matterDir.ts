// SPDX-License-Identifier: AGPL-3.0-or-later
//
// B-class resolution (CLAUDE.md MCP tool-schema design): the matter working dir
// is runtime-derived from OSCAR_MATTER_DIR (injected by buildPracticeAreaRecipe,
// mirroring oscar-fs) and MUST NOT appear in any LLM-visible tool schema.

import { promises as fs } from "node:fs";
import { join, resolve, normalize, basename, extname } from "node:path";

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
  const ext = extname(abs).toLowerCase();
  if (TEXT_EXT.has(ext)) {
    try {
      return await fs.readFile(abs, "utf8");
    } catch {
      // fall through to the basename search below — the agent may have given a
      // bare filename for a file that actually lives in a subfolder.
    }
  }
  // Resilience (Sprint 35 dogfood finding): the agent's create_review rel_path is
  // model-supplied and is often a bare filename even when the document sits in a
  // subfolder (e.g. "x.txt" vs "contracts/x.txt"), which would silently leave
  // every cell no-source. If the literal path didn't resolve, search the matter
  // tree for a unique text file with that basename and use it. Ambiguous (>1) or
  // no match → null (genuinely no-source).
  const name = basename(relPath);
  if (name && TEXT_EXT.has(extname(name).toLowerCase())) {
    const hits = await findByBasename(base, name, 0);
    if (hits.length === 1) {
      try {
        return await fs.readFile(hits[0], "utf8");
      } catch {
        // intentional: unreadable → no-source (ADR-112 marks the cell unverified).
        return null;
      }
    }
  }
  return null;
}

const MAX_WALK_DEPTH = 4;
const SKIP_DIRS = new Set(["node_modules", ".git", "outputs"]);

async function findByBasename(dir: string, name: string, depth: number): Promise<string[]> {
  if (depth > MAX_WALK_DEPTH) return [];
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const hits: string[] = [];
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith(".")) continue;
      hits.push(...(await findByBasename(full, name, depth + 1)));
    } else if (e.isFile() && e.name === name) {
      hits.push(full);
    }
    if (hits.length > 1) break; // ambiguous; caller treats >1 as no-source
  }
  return hits;
}
