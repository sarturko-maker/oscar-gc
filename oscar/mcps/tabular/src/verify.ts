// SPDX-License-Identifier: AGPL-3.0-or-later
//
// The zero-LLM grounding gate (ADR-112). charOverlap / sectionExists /
// extractSectionRefs / isBoilerplate are LIFTED (copied, with provenance) from
// oscar/mcps/grounding-verifier/src/verifier.ts — PROJECT.md forbids cross-MCP
// runtime coupling, so they are not imported across the server boundary.

import type { Grounding } from "./schema.js";

const SECTION_REF_RE = /(?:Section|Clause|Article|Paragraph|Part)\s+(\d+(?:\.\d+)*)/gi;
const MAX_SEARCH_WINDOW = 10_000;
export const GROUND_THRESHOLD = 0.8;

const COMMON_LEGAL_PHRASES = new Set([
  "shall not be liable",
  "to the fullest extent permitted by law",
  "without limitation",
  "including but not limited to",
  "in no event shall",
  "notwithstanding anything to the contrary",
  "subject to the terms and conditions",
  "representations and warranties",
  "indemnify and hold harmless",
  "governing law",
]);

export function extractSectionRefs(text: string): string[] {
  const refs: string[] = [];
  const re = new RegExp(SECTION_REF_RE.source, SECTION_REF_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) refs.push(m[1]);
  return refs;
}

export function sectionExists(ref: string, documentText: string): boolean {
  const esc = ref.replace(/\./g, "\\.");
  const patterns = [
    new RegExp(`Section\\s+${esc}\\b`, "i"),
    new RegExp(`Clause\\s+${esc}\\b`, "i"),
    new RegExp(`Article\\s+${esc}\\b`, "i"),
    new RegExp(`^${esc}[.\\s]`, "m"),
  ];
  return patterns.some((p) => p.test(documentText));
}

export function isBoilerplate(quote: string): boolean {
  return COMMON_LEGAL_PHRASES.has(quote.toLowerCase().trim());
}

export function charOverlap(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  if (bLower.includes(aLower)) return 1.0;
  if (aLower.includes(bLower)) return 1.0;

  let searchText = bLower;
  if (bLower.length > MAX_SEARCH_WINDOW) {
    const firstWord = aLower.split(/\s+/)[0];
    const idx = firstWord ? bLower.indexOf(firstWord) : -1;
    if (idx >= 0) {
      const windowStart = Math.max(0, idx - 2000);
      searchText = bLower.slice(windowStart, windowStart + MAX_SEARCH_WINDOW);
    } else {
      return 0;
    }
  }

  const aChars = aLower.split("");
  let bestMatch = 0;
  for (let start = 0; start <= searchText.length - Math.floor(aChars.length * 0.5); start++) {
    let matched = 0;
    for (let i = 0; i < aChars.length && start + i < searchText.length; i++) {
      if (aChars[i] === searchText[start + i]) matched++;
    }
    bestMatch = Math.max(bestMatch, matched);
  }
  return aChars.length > 0 ? bestMatch / aChars.length : 0;
}

// The display precondition (ADR-112). Authoritative over LLM-emitted offsets.
export function groundCell(
  quote: string | null,
  locator: string | null,
  sourceText: string | null,
): Grounding {
  if (sourceText === null) {
    return { grounded: false, score: 0, method: "no-source" };
  }
  if (quote && quote.trim().length > 0) {
    const overlap = charOverlap(quote, sourceText);
    return {
      grounded: overlap >= GROUND_THRESHOLD,
      score: Math.round(overlap * 100) / 100,
      method: "charOverlap",
    };
  }
  // No quote: a locator can still ground if the cited section exists.
  if (locator && locator.trim().length > 0) {
    const refs = extractSectionRefs(locator);
    const grounded = refs.length > 0 && refs.every((r) => sectionExists(r, sourceText));
    if (grounded) return { grounded: true, score: 1, method: "sectionExists" };
  }
  return { grounded: false, score: 0, method: "no-quote" };
}
