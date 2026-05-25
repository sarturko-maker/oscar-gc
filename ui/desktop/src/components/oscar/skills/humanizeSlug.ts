// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 29 M3 (ADR-096): pure transform from kebab-slug to humanised
// display title. Title-cases on hyphen boundaries and expands a small
// legal-domain acronym map. Anything unmapped falls back to title-case.

const ACRONYMS: ReadonlyMap<string, string> = new Map([
  ['nda', 'NDA'],
  ['msa', 'MSA'],
  ['saas', 'SaaS'],
  ['ip', 'IP'],
  ['ai', 'AI'],
  ['eu', 'EU'],
  ['uk', 'UK'],
  ['us', 'US'],
  ['gdpr', 'GDPR'],
  ['ma', 'M&A'],
  ['ipo', 'IPO'],
  ['kyc', 'KYC'],
  ['aml', 'AML'],
  ['rfp', 'RFP'],
  ['sow', 'SOW'],
  ['loi', 'LOI'],
  ['poc', 'POC'],
  ['tcs', 'T&Cs'],
]);

const titleCase = (s: string): string =>
  s.length === 0 ? s : s[0].toUpperCase() + s.slice(1).toLowerCase();

export function humanizeSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .split('-')
    .map((tok) => ACRONYMS.get(tok) ?? titleCase(tok))
    .join(' ');
}
