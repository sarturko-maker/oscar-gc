// Sprint 21 (ADR-071) + Sprint 24-A rebrand (ADR-078): Oscar LLP firm-mode
// partner registry. Single source of truth for the 10 partners — slug, display
// name, specialism, blurb, and the lifted-and-adapted Lavern prompt body (see
// ADR-072; "Lavern" here is the upstream-source attribution, not the firm name).

import { sarahChenPrompt } from './prompts/sarah-chen';
import { marcusWebbPrompt } from './prompts/marcus-webb';
import { danielReevesPrompt } from './prompts/daniel-reeves';
import { priyaPatelPrompt } from './prompts/priya-patel';
import { jamesOkaforPrompt } from './prompts/james-okafor';
import { helenaVossPrompt } from './prompts/helena-voss';
import { dianaParkPrompt } from './prompts/diana-park';
import { robertSinclairPrompt } from './prompts/robert-sinclair';
import { aishaKhanPrompt } from './prompts/aisha-khan';
import { thomasSchmidtPrompt } from './prompts/thomas-schmidt';

export interface OscarLLPPartner {
  // kebab-case slug used for working-dir, state-file key, URL segment
  slug: string;
  // Display name shown as the partner card title and in the chat title
  name: string;
  // Display specialism shown in brackets per the brief's "[Name] ([Practice Area])"
  // mandated label format
  specialism: string;
  // One-line tagline for the partner card on the roster
  blurb: string;
  // Lifted-and-adapted Lavern system prompt — see ADR-072 + prompts/<slug>.ts
  systemPrompt: string;
}

export const OSCAR_LLP_PARTNERS: readonly OscarLLPPartner[] = [
  {
    slug: 'sarah-chen',
    name: 'Sarah Chen',
    specialism: 'M&A',
    blurb: 'Deal mechanics, structure, risk allocation. Moves fast; keeps the deal closing.',
    systemPrompt: sarahChenPrompt,
  },
  {
    slug: 'marcus-webb',
    name: 'Marcus Webb',
    specialism: 'Commercial Contracts',
    blurb:
      'Drafting and redlining with surgical precision. Every clause has a market-standard anchor.',
    systemPrompt: marcusWebbPrompt,
  },
  {
    slug: 'daniel-reeves',
    name: 'Daniel Reeves',
    specialism: 'Litigation',
    blurb:
      'Adversarial strategy from opening pleading to settlement. Sees the case from opposing counsel’s chair.',
    systemPrompt: danielReevesPrompt,
  },
  {
    slug: 'priya-patel',
    name: 'Priya Patel',
    specialism: 'Employment',
    blurb:
      'Hiring to termination, policies to claims. Balances employer interests with employee fairness.',
    systemPrompt: priyaPatelPrompt,
  },
  {
    slug: 'james-okafor',
    name: 'James Okafor',
    specialism: 'IP',
    blurb: 'Patents, trademarks, trade secrets, licensing. Bridges the technical and the legal.',
    systemPrompt: jamesOkaforPrompt,
  },
  {
    slug: 'helena-voss',
    name: 'Helena Voss',
    specialism: 'Tax',
    blurb:
      'Structures, transfer pricing, treaties, audit defence. Builds tax positions that hold up under scrutiny.',
    systemPrompt: helenaVossPrompt,
  },
  {
    slug: 'diana-park',
    name: 'Diana Park',
    specialism: 'Privacy',
    blurb: 'GDPR, CCPA, transfer mechanisms, DPIAs. Privacy by design, not as compliance theatre.',
    systemPrompt: dianaParkPrompt,
  },
  {
    slug: 'robert-sinclair',
    name: 'Robert Sinclair',
    specialism: 'Capital Markets',
    blurb:
      'IPOs, debt issuance, ongoing disclosure. Market speed without cutting compliance corners.',
    systemPrompt: robertSinclairPrompt,
  },
  {
    slug: 'aisha-khan',
    name: 'Aisha Khan',
    specialism: 'Tech Transactions',
    blurb: 'SaaS, DPAs, open source, API terms. Speaks tech and law with equal fluency.',
    systemPrompt: aishaKhanPrompt,
  },
  {
    slug: 'thomas-schmidt',
    name: 'Thomas Schmidt',
    specialism: 'Regulatory',
    blurb:
      'Sector-specific compliance across financial, healthcare, technology. Cites the rule; conservative by default.',
    systemPrompt: thomasSchmidtPrompt,
  },
];

export function partnerBySlug(slug: string): OscarLLPPartner | undefined {
  return OSCAR_LLP_PARTNERS.find((p) => p.slug === slug);
}
