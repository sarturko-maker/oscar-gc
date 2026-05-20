// Sprint 14 (ADR-047): declarative per-area matter-intake config. Consumed
// by NewMatterDialog as one config-driven renderer (no 13-way switch in code
// — the variation is data here). Five family templates emerge across the
// 13 areas (contract-shaped, person-shaped, regulator/obligation,
// internal-asset, event-shaped); shapes are sized by what each area
// actually needs, not forced into a uniform template.

import type { PartyRole, SubjectType } from './types';

export interface KindOption {
  value: string;
  label: string;
}

export interface PartyRoleOption {
  value: PartyRole;
  label: string;
}

export interface SubjectSlot {
  label: string;
  type: SubjectType;
  placeholder: string;
  hint?: string;
}

export interface CounterpartySlot {
  label: string;
  placeholder: string;
  roleLabel: string;
  roleOptions: PartyRoleOption[];
  defaultRole: PartyRole;
  required?: boolean;
}

export interface StakeholderSlot {
  label: string;
  placeholder: string;
  hint?: string;
}

export interface ExtrasField {
  key: string;
  label: string;
  placeholder?: string;
  hint?: string;
  showWhenKindIn?: string[]; // omitted → always shown for this area
  enumValues?: KindOption[];
}

// Sprint 19 (ADR-066 D4): per-area entry noun. Privacy / Regulatory /
// AI Governance read more naturally as "Programmes" (GDPR / NIS2 / DORA /
// AI Act); the other 10 areas keep "Matter". Forge-created areas pick
// their own noun per the area-create system prompt.
export interface EntryNoun {
  singular: string;
  plural: string;
}

export const MATTER_NOUN: EntryNoun = { singular: 'Matter', plural: 'Matters' };
export const PROGRAMME_NOUN: EntryNoun = {
  singular: 'Programme',
  plural: 'Programmes',
};

export interface PracticeAreaShape {
  areaId: string;
  entryNoun: EntryNoun;
  subject: SubjectSlot;
  counterparty?: CounterpartySlot;
  stakeholder: StakeholderSlot;
  kind: {
    label: string;
    options: KindOption[];
  };
  extras?: ExtrasField[];
  privileged: {
    defaultByKind?: Record<string, boolean>;
    fallback: boolean;
  };
}

// Reusable role pools so families that share shape don't drift.
const COMMERCIAL_ROLES: PartyRoleOption[] = [
  { value: 'customer', label: 'Customer' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'supplier', label: 'Supplier' },
  { value: 'partner', label: 'Partner' },
  { value: 'consumer', label: 'Consumer' },
  { value: 'reseller', label: 'Reseller' },
  { value: 'other', label: 'Other' },
];

const DISPUTE_ROLES: PartyRoleOption[] = [
  { value: 'claimant', label: 'Claimant' },
  { value: 'respondent', label: 'Respondent' },
  { value: 'counterparty', label: 'Counterparty' },
  { value: 'other', label: 'Other' },
];

const LICENSING_ROLES: PartyRoleOption[] = [
  { value: 'licensor', label: 'Licensor' },
  { value: 'licensee', label: 'Licensee' },
  { value: 'counterparty', label: 'Counterparty' },
  { value: 'other', label: 'Other' },
];

const REGULATOR_ROLES: PartyRoleOption[] = [
  { value: 'regulator_authority', label: 'Regulator' },
];

const PROCESSOR_ROLES: PartyRoleOption[] = [
  { value: 'processor', label: 'Processor' },
  { value: 'subprocessor', label: 'Sub-processor' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'data_subject', label: 'Data subject' },
  { value: 'regulator_authority', label: 'Regulator' },
  { value: 'other', label: 'Other' },
];

const CORPORATE_ROLES: PartyRoleOption[] = [
  { value: 'investor', label: 'Investor' },
  { value: 'counterparty', label: 'Counterparty' },
  { value: 'partner', label: 'Partner' },
  { value: 'entity', label: 'Entity' },
  { value: 'other', label: 'Other' },
];

const COMMERCIAL: PracticeAreaShape = {
  areaId: 'commercial',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Contract / matter title',
    type: 'contract',
    placeholder: 'Acme MSA renewal Q1 2026',
    hint: 'The contract or workstream — e.g. "MSA renewal", "data-processing addendum".',
  },
  counterparty: {
    label: 'Counterparty',
    placeholder: 'Acme Foods Ltd',
    roleLabel: 'Relationship',
    roleOptions: COMMERCIAL_ROLES,
    defaultRole: 'vendor',
    required: false,
  },
  stakeholder: {
    label: 'Stakeholder / vendor profile',
    placeholder: 'Acme Foods Ltd',
    hint: 'Groups matters in the list. Autocompletes from prior values in this area.',
  },
  kind: {
    label: 'Matter kind',
    options: [
      { value: 'nda', label: 'NDA' },
      { value: 'msa', label: 'MSA / framework' },
      { value: 'sow', label: 'SoW / order form' },
      { value: 'dpa', label: 'DPA' },
      { value: 'amendment', label: 'Amendment' },
      { value: 'renewal', label: 'Renewal' },
      { value: 'termination', label: 'Termination' },
      { value: 'side_letter', label: 'Side letter' },
      { value: 'rfp', label: 'RFP / pre-contract' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    {
      key: 'internal_owner',
      label: 'Internal owner (BU / team)',
      placeholder: 'Sales — EMEA',
    },
  ],
  privileged: { fallback: false },
};

const COMMERCIAL_DISPUTES: PracticeAreaShape = {
  areaId: 'commercial-disputes',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Dispute title',
    type: 'contract',
    placeholder: 'Acme breach claim — late delivery',
  },
  counterparty: {
    label: 'Adverse party',
    placeholder: 'Acme Foods Ltd',
    roleLabel: 'Posture',
    roleOptions: DISPUTE_ROLES,
    defaultRole: 'respondent',
    required: true,
  },
  stakeholder: {
    label: 'Counterparty (for grouping)',
    placeholder: 'Acme Foods Ltd',
  },
  kind: {
    label: 'Dispute kind',
    options: [
      { value: 'pre_litigation', label: 'Pre-litigation correspondence' },
      { value: 'mediation', label: 'Mediation' },
      { value: 'arbitration', label: 'Arbitration' },
      { value: 'litigation', label: 'Litigation' },
      { value: 'settlement', label: 'Settlement' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    { key: 'forum', label: 'Forum / tribunal', placeholder: 'LCIA / English High Court' },
    { key: 'internal_owner', label: 'Internal owner (BU / team)', placeholder: 'Sales — EMEA' },
  ],
  privileged: { fallback: true },
};

const CORPORATE: PracticeAreaShape = {
  areaId: 'corporate',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Entity',
    type: 'entity',
    placeholder: 'OscarCo UK Ltd',
    hint: 'The entity at the centre of this matter.',
  },
  counterparty: {
    label: 'Counterparty / investor (optional)',
    placeholder: 'Sequoia Capital',
    roleLabel: 'Role',
    roleOptions: CORPORATE_ROLES,
    defaultRole: 'counterparty',
    required: false,
  },
  stakeholder: {
    label: 'Entity / group (for grouping)',
    placeholder: 'OscarCo group',
  },
  kind: {
    label: 'Corporate event',
    options: [
      { value: 'incorporation', label: 'Incorporation' },
      { value: 'reorganisation', label: 'Reorganisation' },
      { value: 'm_a_buy', label: 'M&A — buy-side' },
      { value: 'm_a_sell', label: 'M&A — sell-side' },
      { value: 'joint_venture', label: 'Joint venture' },
      { value: 'equity_raise', label: 'Equity raise' },
      { value: 'debt_facility', label: 'Debt facility' },
      { value: 'share_issuance', label: 'Share issuance' },
      { value: 'dissolution', label: 'Dissolution' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    {
      key: 'deal_value',
      label: 'Deal value',
      placeholder: 'GBP 12m',
      showWhenKindIn: ['m_a_buy', 'm_a_sell', 'joint_venture', 'equity_raise', 'debt_facility'],
    },
  ],
  privileged: {
    defaultByKind: { m_a_buy: true, m_a_sell: true },
    fallback: false,
  },
};

const EMPLOYMENT: PracticeAreaShape = {
  areaId: 'employment',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Employee / candidate',
    type: 'person',
    placeholder: 'Jane Doe',
    hint: 'For policy work, leave blank and use the kind dropdown.',
  },
  counterparty: {
    label: 'Investigation lead / HR partner (optional)',
    placeholder: 'Priya Shah, HRBP',
    roleLabel: 'Role',
    roleOptions: [
      { value: 'internal_owner', label: 'Internal owner / HR partner' },
      { value: 'employee', label: 'Employee' },
      { value: 'contractor', label: 'Contractor' },
      { value: 'other', label: 'Other' },
    ],
    defaultRole: 'internal_owner',
    required: false,
  },
  stakeholder: {
    label: 'Business unit / function',
    placeholder: 'Engineering — Platform',
  },
  kind: {
    label: 'Matter kind',
    options: [
      { value: 'offer', label: 'Offer / contract' },
      { value: 'variation', label: 'Variation' },
      { value: 'promotion', label: 'Promotion' },
      { value: 'performance_plan', label: 'Performance plan' },
      { value: 'grievance', label: 'Grievance' },
      { value: 'disciplinary', label: 'Disciplinary' },
      { value: 'investigation', label: 'Investigation' },
      { value: 'exit', label: 'Exit / settlement' },
      { value: 'policy', label: 'Policy roll-out' },
      { value: 'restructure', label: 'Restructure / RIF' },
      { value: 'right_to_work', label: 'Right-to-work' },
      { value: 'other', label: 'Other' },
    ],
  },
  privileged: {
    defaultByKind: {
      grievance: true,
      disciplinary: true,
      investigation: true,
      exit: true,
    },
    fallback: false,
  },
};

const EMPLOYMENT_DISPUTES: PracticeAreaShape = {
  areaId: 'employment-disputes',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Claimant (employee or ex-employee)',
    type: 'person',
    placeholder: 'Jane Doe',
  },
  counterparty: {
    label: 'Internal owner / HR partner',
    placeholder: 'Priya Shah, HRBP',
    roleLabel: 'Role',
    roleOptions: [
      { value: 'internal_owner', label: 'Internal owner' },
      { value: 'respondent', label: 'Respondent (manager)' },
    ],
    defaultRole: 'internal_owner',
    required: false,
  },
  stakeholder: {
    label: 'Business unit / function',
    placeholder: 'Engineering — Platform',
  },
  kind: {
    label: 'Claim type',
    options: [
      { value: 'unfair_dismissal', label: 'Unfair dismissal' },
      { value: 'discrimination', label: 'Discrimination' },
      { value: 'whistleblowing', label: 'Whistleblowing' },
      { value: 'wages', label: 'Wages / holiday pay' },
      { value: 'breach_of_contract', label: 'Breach of contract' },
      { value: 'equal_pay', label: 'Equal pay' },
      { value: 'tupe', label: 'TUPE' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    { key: 'forum', label: 'Forum / tribunal', placeholder: 'London Central ET / EAT / ACAS' },
  ],
  privileged: { fallback: true },
};

const PRIVACY: PracticeAreaShape = {
  areaId: 'privacy',
  entryNoun: PROGRAMME_NOUN,
  subject: {
    label: 'Subject',
    type: 'person',
    placeholder: 'Customer #4471 / RecRanker pipeline / ICO',
    hint: 'A person (DSR), a processing activity (DPIA), an event (breach), or a regulator (inquiry).',
  },
  counterparty: {
    label: 'Vendor / processor / regulator (optional)',
    placeholder: 'Salesforce',
    roleLabel: 'Role',
    roleOptions: PROCESSOR_ROLES,
    defaultRole: 'processor',
    required: false,
  },
  stakeholder: {
    label: 'Stakeholder / vendor / regulator (for grouping)',
    placeholder: 'Salesforce / ICO / RecRanker',
  },
  kind: {
    label: 'Programme type',
    options: [
      { value: 'dsr_access', label: 'DSR — access' },
      { value: 'dsr_erasure', label: 'DSR — erasure' },
      { value: 'dsr_rectification', label: 'DSR — rectification' },
      { value: 'dsr_portability', label: 'DSR — portability' },
      { value: 'dpia', label: 'DPIA' },
      { value: 'vendor_dpa', label: 'Vendor DPA review' },
      { value: 'breach_internal', label: 'Breach — internal' },
      { value: 'breach_vendor', label: 'Breach — vendor' },
      { value: 'regulator_inquiry', label: 'Regulator inquiry' },
      { value: 'consent', label: 'Consent design' },
      { value: 'records_of_processing', label: 'Records of processing' },
      { value: 'training', label: 'Training / awareness' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    {
      key: 'regulator',
      label: 'Regulator',
      placeholder: 'ICO',
      showWhenKindIn: ['regulator_inquiry', 'breach_internal', 'breach_vendor'],
      enumValues: [
        { value: 'ICO', label: 'ICO (UK)' },
        { value: 'CNIL', label: 'CNIL (FR)' },
        { value: 'Garante', label: 'Garante (IT)' },
        { value: 'BfDI', label: 'BfDI (DE)' },
        { value: 'DPC', label: 'DPC (IE)' },
        { value: 'EDPB', label: 'EDPB' },
        { value: 'Other', label: 'Other' },
      ],
    },
    {
      key: 'deadline',
      label: 'Deadline',
      placeholder: '2026-06-30',
      showWhenKindIn: [
        'dsr_access',
        'dsr_erasure',
        'dsr_rectification',
        'dsr_portability',
        'regulator_inquiry',
        'breach_internal',
        'breach_vendor',
      ],
    },
  ],
  privileged: {
    defaultByKind: {
      breach_internal: true,
      breach_vendor: true,
      regulator_inquiry: true,
    },
    fallback: false,
  },
};

const IP: PracticeAreaShape = {
  areaId: 'ip',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Asset',
    type: 'mark',
    placeholder: '"Forge" word mark / US63/123,456',
    hint: 'A trade mark, patent application, copyright work, design right, or domain.',
  },
  counterparty: {
    label: 'Counterparty / licensor / licensee (optional)',
    placeholder: 'Foo Inc',
    roleLabel: 'Role',
    roleOptions: LICENSING_ROLES,
    defaultRole: 'counterparty',
    required: false,
  },
  stakeholder: {
    label: 'Asset family (for grouping)',
    placeholder: 'Forge brand family',
  },
  kind: {
    label: 'Matter kind',
    options: [
      { value: 'filing', label: 'Filing / prosecution' },
      { value: 'opposition', label: 'Opposition / cancellation' },
      { value: 'assignment', label: 'Assignment' },
      { value: 'licence_in', label: 'Licence — in' },
      { value: 'licence_out', label: 'Licence — out' },
      { value: 'fto', label: 'FTO opinion' },
      { value: 'invention_disclosure', label: 'Invention disclosure review' },
      { value: 'renewal', label: 'Renewal' },
      { value: 'audit', label: 'IP audit' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    { key: 'jurisdictions', label: 'Jurisdictions', placeholder: 'EU, UK, US' },
  ],
  privileged: {
    defaultByKind: { fto: true },
    fallback: false,
  },
};

const IP_DISPUTES: PracticeAreaShape = {
  areaId: 'ip-disputes',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Asset',
    type: 'mark',
    placeholder: '"Forge" word mark (EU classes 9, 42)',
  },
  counterparty: {
    label: 'Adverse party',
    placeholder: 'Beta Co GmbH',
    roleLabel: 'Posture',
    roleOptions: DISPUTE_ROLES,
    defaultRole: 'respondent',
    required: true,
  },
  stakeholder: {
    label: 'Asset family / brand (for grouping)',
    placeholder: 'Forge brand family',
  },
  kind: {
    label: 'Dispute kind',
    options: [
      { value: 'opposition', label: 'Opposition' },
      { value: 'cancellation', label: 'Cancellation' },
      { value: 'coexistence', label: 'Coexistence' },
      { value: 'c_and_d', label: 'Cease-and-desist' },
      { value: 'mediation', label: 'Mediation' },
      { value: 'litigation', label: 'Litigation' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    { key: 'forum', label: 'Forum / office', placeholder: 'EUIPO / UKIPO / Court' },
  ],
  privileged: { fallback: true },
};

const REGULATORY: PracticeAreaShape = {
  areaId: 'regulatory',
  entryNoun: PROGRAMME_NOUN,
  subject: {
    label: 'Obligation / regime',
    type: 'obligation',
    placeholder: 'UK AI Act Art. 6 / GDPR Art. 30',
    hint: 'The obligation or regulatory regime this matter attaches to.',
  },
  counterparty: {
    label: 'Regulator',
    placeholder: 'FCA',
    roleLabel: 'Role',
    roleOptions: REGULATOR_ROLES,
    defaultRole: 'regulator_authority',
    required: false,
  },
  stakeholder: {
    label: 'Regulator / regime (for grouping)',
    placeholder: 'FCA',
  },
  kind: {
    label: 'Programme type',
    options: [
      { value: 'authorisation', label: 'Authorisation / licensing' },
      { value: 'notification', label: 'Notification / filing' },
      { value: 'inquiry', label: 'Inquiry / RFI' },
      { value: 'self_assessment', label: 'Self-assessment' },
      { value: 'horizon_scan', label: 'Horizon scan' },
      { value: 'audit_response', label: 'Audit response' },
      { value: 'policy_gap', label: 'Policy gap analysis' },
      { value: 'training', label: 'Training' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [{ key: 'deadline', label: 'Deadline', placeholder: '2026-06-30' }],
  privileged: {
    defaultByKind: { inquiry: true, audit_response: true },
    fallback: false,
  },
};

const REGULATORY_DISPUTES: PracticeAreaShape = {
  areaId: 'regulatory-disputes',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Obligation / regime',
    type: 'obligation',
    placeholder: 'CMA digital-markets regime',
  },
  counterparty: {
    label: 'Regulator',
    placeholder: 'CMA',
    roleLabel: 'Role',
    roleOptions: REGULATOR_ROLES,
    defaultRole: 'regulator_authority',
    required: true,
  },
  stakeholder: {
    label: 'Regulator / regime (for grouping)',
    placeholder: 'CMA',
  },
  kind: {
    label: 'Posture',
    options: [
      { value: 'pre_decision', label: 'Pre-decision' },
      { value: 'rfi', label: 'Section 26 RFI' },
      { value: 'statement_of_objections', label: 'Statement of objections' },
      { value: 'hearing', label: 'Hearing' },
      { value: 'appeal', label: 'Appeal' },
      { value: 'settlement', label: 'Settlement' },
      { value: 'cat', label: 'CAT proceedings' },
      { value: 'other', label: 'Other' },
    ],
  },
  privileged: { fallback: true },
};

const PRODUCT: PracticeAreaShape = {
  areaId: 'product',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Product / feature',
    type: 'product',
    placeholder: 'RecRanker v2',
  },
  counterparty: {
    label: 'Internal owner (optional)',
    placeholder: 'Product — RecRanker',
    roleLabel: 'Role',
    roleOptions: [
      { value: 'internal_owner', label: 'Internal owner' },
      { value: 'vendor', label: 'Vendor' },
      { value: 'partner', label: 'Partner' },
      { value: 'other', label: 'Other' },
    ],
    defaultRole: 'internal_owner',
    required: false,
  },
  stakeholder: {
    label: 'Product family (for grouping)',
    placeholder: 'RecRanker',
  },
  kind: {
    label: 'Workstream',
    options: [
      { value: 'pre_launch', label: 'Pre-launch review' },
      { value: 'terms_review', label: 'T&Cs / EULA' },
      { value: 'in_product_disclosure', label: 'In-product disclosure' },
      { value: 'feature_flag_review', label: 'Feature flag review' },
      { value: 'public_beta', label: 'Public beta' },
      { value: 'oss_release', label: 'Open-source release' },
      { value: 'deprecation', label: 'Deprecation' },
      { value: 'app_store', label: 'App-store submission' },
      { value: 'marketing_claim', label: 'Marketing claim review' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    {
      key: 'launch_date',
      label: 'Launch / target date',
      placeholder: '2026-07-15',
      showWhenKindIn: ['pre_launch', 'public_beta', 'oss_release', 'app_store'],
    },
  ],
  privileged: { fallback: false },
};

const AI_GOVERNANCE: PracticeAreaShape = {
  areaId: 'ai-governance',
  entryNoun: PROGRAMME_NOUN,
  subject: {
    label: 'System / model / dataset',
    type: 'model',
    placeholder: 'RecRanker v2',
  },
  counterparty: {
    label: 'Internal owner / vendor (optional)',
    placeholder: 'Data Science team',
    roleLabel: 'Role',
    roleOptions: [
      { value: 'internal_owner', label: 'Internal owner' },
      { value: 'vendor', label: 'Vendor' },
      { value: 'other', label: 'Other' },
    ],
    defaultRole: 'internal_owner',
    required: false,
  },
  stakeholder: {
    label: 'System / product family (for grouping)',
    placeholder: 'RecRanker',
  },
  kind: {
    label: 'Workstream',
    options: [
      { value: 'pre_deployment', label: 'Pre-deployment review' },
      { value: 'model_card', label: 'Model card' },
      { value: 'bias_audit', label: 'Bias / fairness audit' },
      { value: 'red_teaming', label: 'Red-teaming / safety' },
      { value: 'vendor_model_intake', label: 'Vendor model intake' },
      { value: 'training_data_review', label: 'Training-data review' },
      { value: 'transparency', label: 'Watermarking / transparency' },
      { value: 'incident_review', label: 'Incident review' },
      { value: 'policy', label: 'Policy / standard' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    {
      key: 'risk_classification',
      label: 'EU AI Act risk tier',
      enumValues: [
        { value: 'prohibited', label: 'Prohibited' },
        { value: 'high_risk', label: 'High-risk' },
        { value: 'limited_risk', label: 'Limited risk' },
        { value: 'minimal', label: 'Minimal' },
        { value: 'tbd', label: 'TBD' },
      ],
      showWhenKindIn: ['pre_deployment', 'vendor_model_intake', 'incident_review'],
    },
  ],
  privileged: {
    defaultByKind: { incident_review: true },
    fallback: false,
  },
};

const COSEC: PracticeAreaShape = {
  areaId: 'cosec',
  entryNoun: MATTER_NOUN,
  subject: {
    label: 'Entity',
    type: 'entity',
    placeholder: 'OscarCo UK Ltd',
  },
  counterparty: {
    label: 'Other party (optional)',
    placeholder: 'Companies House',
    roleLabel: 'Role',
    roleOptions: [
      { value: 'entity', label: 'Entity' },
      { value: 'regulator_authority', label: 'Regulator' },
      { value: 'investor', label: 'Investor' },
      { value: 'other', label: 'Other' },
    ],
    defaultRole: 'entity',
    required: false,
  },
  stakeholder: {
    label: 'Entity / group (for grouping)',
    placeholder: 'OscarCo group',
  },
  kind: {
    label: 'Statutory event',
    options: [
      { value: 'board_meeting', label: 'Board meeting' },
      { value: 'shareholder_meeting', label: 'Shareholder meeting' },
      { value: 'written_resolution', label: 'Resolution — written' },
      { value: 'director_change', label: 'Director appointment / resignation' },
      { value: 'share_allotment', label: 'Share allotment' },
      { value: 'statutory_filing', label: 'Statutory filing' },
      { value: 'beneficial_ownership', label: 'Beneficial ownership update' },
      { value: 'annual_return', label: 'Annual return / confirmation statement' },
      { value: 'articles_change', label: 'Articles change' },
      { value: 'other', label: 'Other' },
    ],
  },
  extras: [
    {
      key: 'meeting_date',
      label: 'Meeting / filing date',
      placeholder: '2026-06-12',
      showWhenKindIn: [
        'board_meeting',
        'shareholder_meeting',
        'statutory_filing',
        'annual_return',
      ],
    },
  ],
  privileged: { fallback: false },
};

export const PRACTICE_AREA_SHAPES: Record<string, PracticeAreaShape> = {
  commercial: COMMERCIAL,
  'commercial-disputes': COMMERCIAL_DISPUTES,
  corporate: CORPORATE,
  employment: EMPLOYMENT,
  'employment-disputes': EMPLOYMENT_DISPUTES,
  privacy: PRIVACY,
  ip: IP,
  'ip-disputes': IP_DISPUTES,
  regulatory: REGULATORY,
  'regulatory-disputes': REGULATORY_DISPUTES,
  product: PRODUCT,
  'ai-governance': AI_GOVERNANCE,
  cosec: COSEC,
};

export const getPracticeAreaShape = (
  areaId: string,
): PracticeAreaShape | undefined => PRACTICE_AREA_SHAPES[areaId];

// Lookup the human label for a kind value within an area. Falls back to the
// raw value (Sentence-cased) when an "Other (free text)" kind has been used.
export const kindLabel = (areaId: string, value: string): string => {
  const shape = PRACTICE_AREA_SHAPES[areaId];
  const opt = shape?.kind.options.find((o) => o.value === value);
  if (opt) return opt.label;
  return value
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
};
