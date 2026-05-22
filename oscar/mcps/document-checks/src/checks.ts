export interface Heading {
  text: string;
  level: number;
  position: number;
}

export interface CrossReference {
  text: string;
  target: string;
}

export interface DefinedTerm {
  term: string;
  definition_location: string;
  usage_count: number;
  capitalized_consistently: boolean;
}

export interface CrossReferenceWithStatus {
  text: string;
  target_exists: boolean;
}

export interface NumberingScheme {
  level: number;
  pattern: string;
  count: number;
}

export interface TypographyPattern {
  convention: string;
  consistent: boolean;
  violations: number;
}

export function analyzeHeadingHierarchy(headings: Heading[]): string[] {
  const issues: string[] = [];
  for (let i = 1; i < headings.length; i++) {
    const prev = headings[i - 1];
    const curr = headings[i];
    if (curr.level > prev.level + 1) {
      issues.push(
        `Heading hierarchy gap at position ${curr.position}: "${curr.text}" is H${curr.level} but previous heading "${prev.text}" is H${prev.level} (skipped H${prev.level + 1})`,
      );
    }
  }
  return issues;
}

export function analyzeNumbering(sectionNumbers: string[]): string[] {
  const issues: string[] = [];
  if (sectionNumbers.length < 2) return issues;

  const topLevel: number[] = [];
  for (const num of sectionNumbers) {
    const parts = num.split(".");
    const first = parseInt(parts[0], 10);
    if (!Number.isNaN(first) && parts.length === 1) topLevel.push(first);
  }

  for (let i = 1; i < topLevel.length; i++) {
    if (topLevel[i] !== topLevel[i - 1] + 1) {
      issues.push(
        `Section numbering gap: Section ${topLevel[i - 1]} is followed by Section ${topLevel[i]} (expected ${topLevel[i - 1] + 1})`,
      );
    }
  }

  const seen = new Set<string>();
  for (const num of sectionNumbers) {
    if (seen.has(num)) issues.push(`Duplicate section number: ${num}`);
    seen.add(num);
  }

  return issues;
}

export function analyzeCrossReferences(
  crossRefs: CrossReference[],
  headings: Heading[],
  sectionNumbers: string[],
): string[] {
  const issues: string[] = [];
  const headingTexts = new Set(headings.map((h) => h.text.toLowerCase()));
  const numberSet = new Set(sectionNumbers);

  for (const ref of crossRefs) {
    const target = ref.target.trim();
    if (/^\d+(\.\d+)*$/.test(target)) {
      if (!numberSet.has(target)) {
        issues.push(`Broken cross-reference: "${ref.text}" references Section ${target} which does not exist`);
      }
      continue;
    }
    if (!headingTexts.has(target.toLowerCase())) {
      const fuzzyMatch = headings.some((h) => h.text.toLowerCase().includes(target.toLowerCase()));
      if (!fuzzyMatch) {
        issues.push(`Potentially broken cross-reference: "${ref.text}" references "${target}" — no matching heading found`);
      }
    }
  }

  return issues;
}

export function analyzeFormatting(args: {
  defined_terms: DefinedTerm[];
  cross_references: CrossReferenceWithStatus[];
  numbering_schemes: NumberingScheme[];
  typography_patterns: TypographyPattern[];
}): { issues: string[]; inconsistentTerms: DefinedTerm[]; unusedTerms: DefinedTerm[]; brokenRefs: CrossReferenceWithStatus[] } {
  const issues: string[] = [];

  const inconsistentTerms = args.defined_terms.filter((dt) => !dt.capitalized_consistently);
  if (inconsistentTerms.length > 0) {
    issues.push(
      `${inconsistentTerms.length} defined term(s) have inconsistent capitalization: ${inconsistentTerms.map((t) => `"${t.term}"`).join(", ")}`,
    );
  }

  const unusedTerms = args.defined_terms.filter((dt) => dt.usage_count === 0);
  if (unusedTerms.length > 0) {
    issues.push(
      `${unusedTerms.length} defined term(s) are never used: ${unusedTerms.map((t) => `"${t.term}"`).join(", ")}`,
    );
  }

  const brokenRefs = args.cross_references.filter((cr) => !cr.target_exists);
  if (brokenRefs.length > 0) {
    issues.push(
      `${brokenRefs.length} broken cross-reference(s): ${brokenRefs.map((r) => `"${r.text}"`).join(", ")}`,
    );
  }

  const levelPatterns = new Map<number, Set<string>>();
  for (const ns of args.numbering_schemes) {
    if (!levelPatterns.has(ns.level)) levelPatterns.set(ns.level, new Set());
    levelPatterns.get(ns.level)!.add(ns.pattern);
  }
  for (const [level, patterns] of levelPatterns) {
    if (patterns.size > 1) {
      issues.push(`Mixed numbering patterns at level ${level}: ${[...patterns].join(", ")}`);
    }
  }

  const typoViolations = args.typography_patterns.filter((tp) => !tp.consistent);
  for (const tv of typoViolations) {
    issues.push(`Typography inconsistency: "${tv.convention}" has ${tv.violations} violation(s)`);
  }

  return { issues, inconsistentTerms, unusedTerms, brokenRefs };
}
