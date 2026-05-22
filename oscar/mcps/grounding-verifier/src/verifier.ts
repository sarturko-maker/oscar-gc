const SECTION_REF_RE = /(?:Section|Clause|Article|Paragraph|Part)\s+(\d+(?:\.\d+)*)/gi;

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

const MAX_SEARCH_WINDOW = 10_000;

export interface SectionRefCheck {
  ref: string;
  found: boolean;
}

export interface QuoteCheck {
  quote: string;
  found: boolean;
  overlap: number;
  boilerplate: boolean;
}

export interface EvidenceGroundingResult {
  evidenceText: string;
  sectionRefs: SectionRefCheck[];
  quotes: QuoteCheck[];
  score: number;
}

export interface FindingGroundingResult {
  findingId: string;
  severity?: string;
  evidenceResults: EvidenceGroundingResult[];
  overallScore: number;
}

export function extractQuotes(text: string): string[] {
  const matches: string[] = [];
  const reDouble = /"([^"]{8,})"/g;
  let m: RegExpExecArray | null;
  while ((m = reDouble.exec(text)) !== null) matches.push(m[1]);
  const reSingle = /'([^']{8,})'/g;
  while ((m = reSingle.exec(text)) !== null) matches.push(m[1]);
  return matches;
}

export function extractSectionRefs(text: string): string[] {
  const refs: string[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(SECTION_REF_RE.source, SECTION_REF_RE.flags);
  while ((m = re.exec(text)) !== null) refs.push(m[1]);
  return refs;
}

export function sectionExists(ref: string, documentText: string, sectionHeadings: string[]): boolean {
  for (const heading of sectionHeadings) {
    if (heading.includes(ref)) return true;
  }
  const patterns = [
    new RegExp(`Section\\s+${ref.replace(/\./g, "\\.")}\\b`, "i"),
    new RegExp(`Clause\\s+${ref.replace(/\./g, "\\.")}\\b`, "i"),
    new RegExp(`Article\\s+${ref.replace(/\./g, "\\.")}\\b`, "i"),
    new RegExp(`^${ref.replace(/\./g, "\\.")}[.\\s]`, "m"),
  ];
  return patterns.some((p) => p.test(documentText));
}

export function isBoilerplate(quote: string): boolean {
  const lower = quote.toLowerCase().trim();
  return COMMON_LEGAL_PHRASES.has(lower);
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

export function verifyEvidence(
  evidence: string[],
  documentText: string,
  sectionHeadings: string[],
): EvidenceGroundingResult[] {
  return evidence.map((ev) => {
    const sectionRefs = extractSectionRefs(ev);
    const quotes = extractQuotes(ev);

    const sectionResults: SectionRefCheck[] = sectionRefs.map((ref) => ({
      ref,
      found: sectionExists(ref, documentText, sectionHeadings),
    }));

    const quoteResults: QuoteCheck[] = quotes.map((quote) => {
      const overlap = charOverlap(quote, documentText);
      const boilerplate = isBoilerplate(quote);
      return {
        quote: quote.slice(0, 80),
        found: overlap >= 0.8,
        overlap: Math.round(overlap * 100) / 100,
        boilerplate,
      };
    });

    const totalChecks = sectionResults.length + quoteResults.length;
    const matched =
      sectionResults.filter((r) => r.found).length +
      quoteResults.filter((r) => r.found).reduce((sum, r) => sum + (r.boilerplate ? 0.5 : 1.0), 0);

    return {
      evidenceText: ev.slice(0, 120),
      sectionRefs: sectionResults,
      quotes: quoteResults,
      score: totalChecks > 0 ? matched / totalChecks : 1.0,
    };
  });
}
