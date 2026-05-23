import { CHUNKS, COLLECTIONS, type KbChunk, type KbCollectionMeta } from "./corpus.js";

export interface KbSearchResult extends KbChunk {
  score: number;
}

export interface KbSearchOptions {
  query: string;
  collectionId?: string;
  docType?: string;
  jurisdiction?: string;
  maxResults?: number;
}

export interface KbCollectionSummary extends KbCollectionMeta {
  documentCount: number;
  chunkCount: number;
  totalWords: number;
}

export function searchKnowledgeBase(options: KbSearchOptions): KbSearchResult[] {
  const expandedTerms = expandQuery(options.query);
  if (expandedTerms.length === 0) return [];

  const filtered = CHUNKS.filter((chunk) => {
    if (options.collectionId && chunk.collection_id !== options.collectionId) return false;
    if (options.docType && chunk.doc_type !== options.docType) return false;
    if (options.jurisdiction && chunk.jurisdiction !== options.jurisdiction) return false;
    return true;
  });

  const scored: KbSearchResult[] = [];
  for (const chunk of filtered) {
    const haystack = `${chunk.heading.toLowerCase()} ${chunk.content.toLowerCase()}`;
    let score = 0;
    for (const term of expandedTerms) {
      if (!term) continue;
      const occurrences = countOccurrences(haystack, term.toLowerCase());
      if (occurrences > 0) {
        score += occurrences;
        if (chunk.heading.toLowerCase().includes(term.toLowerCase())) {
          score += 2;
        }
      }
    }
    if (score > 0) {
      scored.push({ ...chunk, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, options.maxResults ?? 5);
}

export function listCollections(): KbCollectionSummary[] {
  return COLLECTIONS.map((collection) => {
    const chunks = CHUNKS.filter((c) => c.collection_id === collection.id);
    const documentIds = new Set(chunks.map((c) => c.document_id));
    const totalWords = chunks.reduce((sum, c) => sum + c.word_count, 0);
    return {
      ...collection,
      documentCount: documentIds.size,
      chunkCount: chunks.length,
      totalWords,
    };
  });
}

export function getChunkById(chunkId: string): KbChunk | undefined {
  return CHUNKS.find((c) => c.chunk_id === chunkId);
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  while (true) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    count++;
    from = idx + needle.length;
  }
  return count;
}

// Legal-synonym expansion lifted from Lavern's retriever.ts (Apache-2.0).
// Each group is bidirectional: a query containing any term in a group expands
// to include all sibling terms as additional search terms.
const LEGAL_SYNONYM_GROUPS: string[][] = [
  ["indemnification", "indemnity", "hold harmless", "indemnify"],
  ["liability", "damages", "liable"],
  ["limitation of liability", "liability cap", "cap on damages", "liability limit"],
  ["termination", "terminate", "expiration", "expire", "cancellation", "cancel"],
  ["cure period", "remedy period", "notice to cure"],
  ["intellectual property", "IP rights"],
  ["assignment", "transfer", "conveyance"],
  ["license", "licence", "licensing"],
  ["personal data", "personal information", "PII", "personally identifiable"],
  ["data processing", "data protection", "privacy"],
  ["GDPR", "General Data Protection Regulation"],
  ["consent", "opt in", "opt out"],
  ["confidential", "confidentiality", "proprietary", "trade secret"],
  ["non disclosure", "nondisclosure", "NDA"],
  ["arbitration", "mediation", "dispute resolution", "ADR"],
  ["governing law", "choice of law", "applicable law"],
  ["jurisdiction", "venue", "forum"],
  ["non compete", "noncompete", "restrictive covenant", "competition restriction"],
  ["non solicitation", "nonsolicitation"],
  ["severance", "separation", "termination payment"],
  ["payment", "compensation", "remuneration", "fee"],
  ["penalty", "liquidated damages", "late fee"],
  ["warranty", "guarantee", "representation"],
  ["insurance", "coverage", "policy"],
  ["deductible", "excess", "retention"],
  ["compliance", "regulatory", "regulation"],
  ["audit", "inspection", "review"],
  ["amendment", "modification", "change", "variation"],
  ["waiver", "forbearance"],
  ["force majeure", "act of God", "unforeseeable circumstances"],
  ["severability", "savings clause"],
  ["entire agreement", "whole agreement", "merger clause", "integration clause"],
  ["successor", "assign", "assignee"],
];

const synonymLookup: Map<string, string[]> = (() => {
  const map = new Map<string, string[]>();
  for (const group of LEGAL_SYNONYM_GROUPS) {
    for (const term of group) {
      const lower = term.toLowerCase();
      const others = group.filter((t) => t.toLowerCase() !== lower);
      const existing = map.get(lower) ?? [];
      map.set(lower, Array.from(new Set([...existing, ...others])));
    }
  }
  return map;
})();

function expandQuery(query: string): string[] {
  const cleaned = query.replace(/[^\w\s]/g, " ");
  const words = cleaned
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2);
  if (words.length === 0) return [];

  const expanded = new Set<string>(words);
  const queryLower = words.join(" ").toLowerCase();

  for (const [phrase, synonyms] of synonymLookup) {
    if (phrase.includes(" ") && queryLower.includes(phrase)) {
      for (const syn of synonyms) expanded.add(syn);
    }
  }

  for (const word of words) {
    const syns = synonymLookup.get(word.toLowerCase());
    if (!syns) continue;
    for (const syn of syns) {
      if (syn.includes(" ")) {
        for (const part of syn.split(/\s+/)) {
          if (part.length >= 2) expanded.add(part);
        }
      } else {
        expanded.add(syn);
      }
    }
  }

  return Array.from(expanded);
}
