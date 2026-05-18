export type PracticeAreaSource = 'default' | 'user-added' | 'admin-pushed';

export interface PracticeArea {
  id: string;
  name: string;
  body: string;
  source: PracticeAreaSource;
  bundled_skill_sources?: readonly string[];
}

export type PracticeAreaId = string;

export const PRACTICE_AREAS: readonly PracticeArea[] = [
  {
    id: 'commercial',
    name: 'Commercial',
    body: 'Customers, vendors, suppliers, and contract memory live here. Instructions pull profile detail and search negotiated terms.',
    source: 'default',
    bundled_skill_sources: ['commercial-legal'],
  },
  {
    id: 'commercial-disputes',
    name: 'Commercial Disputes',
    body: 'Counterparty profiles, claims, and dispute memory live here. Pulls contract context from Commercial.',
    source: 'default',
    bundled_skill_sources: ['commercial-legal', 'litigation-legal'],
  },
  {
    id: 'corporate',
    name: 'Corporate',
    body: 'Entities, subsidiaries, and corporate memory live here. Instructions pull entity detail and search filings and resolutions.',
    source: 'default',
    bundled_skill_sources: ['corporate-legal'],
  },
  {
    id: 'employment',
    name: 'Employment',
    body: 'Employees, contractors, and HR memory live here. Instructions pull profile detail and search agreements and policy versions.',
    source: 'default',
    bundled_skill_sources: ['employment-legal'],
  },
  {
    id: 'employment-disputes',
    name: 'Employment Disputes',
    body: 'Employee parties, grievances, and tribunal memory live here. Pulls employment context from Employment.',
    source: 'default',
    bundled_skill_sources: ['employment-legal', 'litigation-legal'],
  },
  {
    id: 'privacy',
    name: 'Privacy',
    body: 'Data subjects, processors, and privacy memory live here. Instructions pull profile detail and search processing records.',
    source: 'default',
    bundled_skill_sources: ['privacy-legal'],
  },
  {
    id: 'ip',
    name: 'IP',
    body: 'Inventors, marks, and IP-portfolio memory live here. Instructions pull profile detail and search filings.',
    source: 'default',
    bundled_skill_sources: ['ip-legal'],
  },
  {
    id: 'ip-disputes',
    name: 'IP Disputes',
    body: 'Counterparty profiles, infringement claims, and IP-litigation memory live here. Pulls portfolio context from IP.',
    source: 'default',
    bundled_skill_sources: ['ip-legal', 'litigation-legal'],
  },
  {
    id: 'regulatory',
    name: 'Regulatory',
    body: 'Regulators, obligations, and compliance memory live here. Instructions pull obligation detail and search filings.',
    source: 'default',
    bundled_skill_sources: ['regulatory-legal'],
  },
  {
    id: 'regulatory-disputes',
    name: 'Regulatory Disputes',
    body: 'Regulator parties, enforcement actions, and regulatory-dispute memory live here. Pulls obligation context from Regulatory.',
    source: 'default',
    bundled_skill_sources: ['regulatory-legal', 'litigation-legal'],
  },
  {
    id: 'product',
    name: 'Product',
    body: 'Products, releases, and product-agreement memory live here. Instructions pull product detail and search related contracts.',
    source: 'default',
    bundled_skill_sources: ['product-legal'],
  },
  {
    id: 'ai-governance',
    name: 'AI Governance',
    body: 'Models, datasets, and AI-governance memory live here. Instructions pull model detail and search risk artefacts.',
    source: 'default',
    bundled_skill_sources: ['ai-governance-legal'],
  },
  {
    id: 'cosec',
    name: 'CoSec',
    body: 'Entities, board records, and statutory-filing memory live here. Instructions pull entity detail and search minutes and resolutions.',
    source: 'default',
    bundled_skill_sources: ['corporate-legal'],
  },
];
