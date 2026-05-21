// Sprint 20-M3 (ADR-083): matter.md round-trip — writer + reader colocated so
// the right pane's read posture can't drift from the writer's frontmatter
// shape. The writer (renderMatterMd) moved here from main.ts; the reader
// (parseMatterMd) is new.

import type { MatterEntry } from './types';

export const renderMatterMd = (entry: MatterEntry, keyFacts: string): string => {
  const lines: string[] = [
    '---',
    `slug: ${entry.slug}`,
    `name: ${JSON.stringify(entry.name)}`,
    `area_id: ${entry.area_id}`,
    `kind: ${entry.kind}`,
    `subject_type: ${entry.subject.type}`,
    `subject_label: ${JSON.stringify(entry.subject.label)}`,
  ];
  if (entry.counterparty) {
    lines.push(
      `counterparty_role: ${entry.counterparty.role}`,
      `counterparty_name: ${JSON.stringify(entry.counterparty.name)}`,
    );
  }
  if (entry.stakeholder) {
    lines.push(`stakeholder: ${JSON.stringify(entry.stakeholder)}`);
  }
  if (entry.extras) {
    for (const [k, v] of Object.entries(entry.extras)) {
      lines.push(`extras_${k}: ${JSON.stringify(v)}`);
    }
  }
  lines.push(
    `opened_at: ${entry.opened_at}`,
    `status: ${entry.status}`,
    `privileged: ${entry.privileged}`,
    'schema_version: 2',
    '---',
  );
  return `${lines.join('\n')}\n\n# Matter: ${entry.name}\n\n## Key facts\n\n${keyFacts.trim()}\n\n## Matter-specific overrides\n\n_None yet._\n`;
};

export interface ParsedMatterMd {
  subject: { type: string; label: string } | null;
  counterparty: { role: string; name: string } | null;
  kind: string | null;
  stakeholder: string | null;
  privileged: boolean;
  key_facts_md: string;
  extras: Record<string, string>;
}

const decodeFrontmatterValue = (raw: string): string => {
  const v = raw.trim();
  if (v.startsWith('"')) {
    try {
      return JSON.parse(v) as string;
    } catch {
      return v.replace(/^"|"$/g, '');
    }
  }
  return v;
};

export const parseMatterMd = (text: string): ParsedMatterMd => {
  const frontmatter: Record<string, string> = {};
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    for (const line of fmMatch[1].split('\n')) {
      const m = line.match(/^([a-z_][a-z0-9_]*):\s*(.*)$/);
      if (!m) continue;
      frontmatter[m[1]] = decodeFrontmatterValue(m[2]);
    }
  }

  const keyFactsMatch = text.match(/## Key facts\s*\n+([\s\S]*?)(?=\n## |$)/);
  const key_facts_md = keyFactsMatch ? keyFactsMatch[1].trim() : '';

  const extras: Record<string, string> = {};
  for (const [k, v] of Object.entries(frontmatter)) {
    if (k.startsWith('extras_')) extras[k.slice('extras_'.length)] = v;
  }

  return {
    subject:
      frontmatter.subject_type && frontmatter.subject_label
        ? { type: frontmatter.subject_type, label: frontmatter.subject_label }
        : null,
    counterparty:
      frontmatter.counterparty_role && frontmatter.counterparty_name
        ? { role: frontmatter.counterparty_role, name: frontmatter.counterparty_name }
        : null,
    kind: frontmatter.kind ?? null,
    stakeholder: frontmatter.stakeholder ?? null,
    privileged: frontmatter.privileged === 'true',
    key_facts_md,
    extras,
  };
};
