// Sprint 14 (ADR-047): shared labels keyed off matter v2 enum values.
// Consumed by the dialog (placeholders/options), the matter-list row, and
// the Top of Mind renderer in main.ts. Single source of truth so a label
// change touches one file, not three.

import type { SubjectType, PartyRole } from './types';

export const SUBJECT_TYPE_LABELS: Record<SubjectType, string> = {
  contract: 'Contract',
  person: 'Person',
  entity: 'Entity',
  transaction: 'Transaction',
  policy: 'Policy',
  processing_activity: 'Processing activity',
  event: 'Event',
  obligation: 'Obligation',
  mark: 'Trade mark',
  patent: 'Patent',
  product: 'Product',
  model: 'Model',
  dataset: 'Dataset',
  meeting: 'Meeting',
  other: 'Other',
};

export const PARTY_ROLE_LABELS: Record<PartyRole, string> = {
  counterparty: 'Counterparty',
  vendor: 'Vendor',
  supplier: 'Supplier',
  customer: 'Customer',
  consumer: 'Consumer',
  partner: 'Partner',
  reseller: 'Reseller',
  processor: 'Processor',
  subprocessor: 'Sub-processor',
  licensor: 'Licensor',
  licensee: 'Licensee',
  investor: 'Investor',
  regulator_authority: 'Regulator',
  data_subject: 'Data subject',
  employee: 'Employee',
  contractor: 'Contractor',
  claimant: 'Claimant',
  respondent: 'Respondent',
  internal_owner: 'Internal owner',
  entity: 'Entity',
  other: 'Other',
};

export const subjectTypeLabel = (t: SubjectType): string =>
  SUBJECT_TYPE_LABELS[t] ?? t;

export const partyRoleLabel = (r: PartyRole): string =>
  PARTY_ROLE_LABELS[r] ?? r;

// Format an extras key as a display label: snake_case → Sentence case.
export const extrasKeyLabel = (key: string): string =>
  key
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
