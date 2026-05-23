export interface KbChunk {
  chunk_id: string;
  document_id: string;
  collection_id: string;
  collection_name: string;
  document_filename: string;
  heading: string;
  content: string;
  doc_type: string;
  jurisdiction: string;
  word_count: number;
}

export interface KbCollectionMeta {
  id: string;
  name: string;
  description: string;
  doc_type: string;
}

export const COLLECTIONS: KbCollectionMeta[] = [
  {
    id: "saas-precedents",
    name: "SaaS Contract Precedents",
    description: "Clause extracts from publicly-available SaaS MSAs and DPAs.",
    doc_type: "precedent",
  },
  {
    id: "ma-playbook",
    name: "M&A Negotiation Playbook",
    description: "Common positions on reps, warranties, indemnities, and survival.",
    doc_type: "playbook",
  },
  {
    id: "gdpr-baseline",
    name: "GDPR Baseline References",
    description: "Article 28 processor obligations and Article 32 security measures.",
    doc_type: "regulation",
  },
];

export const CHUNKS: KbChunk[] = [
  {
    chunk_id: "saas-msa-indemnity-001",
    document_id: "saas-msa-template",
    collection_id: "saas-precedents",
    collection_name: "SaaS Contract Precedents",
    document_filename: "saas-msa-template.md",
    heading: "Indemnification — third-party IP claims",
    doc_type: "precedent",
    jurisdiction: "US",
    word_count: 110,
    content: "Vendor shall defend, indemnify and hold harmless Customer against any third-party claim that the Services as provided infringe such third party's intellectual property rights, and Vendor shall pay any damages finally awarded by a court of competent jurisdiction. Vendor's obligation is conditioned on Customer (a) promptly notifying Vendor of the claim, (b) granting Vendor sole control of defence and settlement, and (c) providing reasonable cooperation at Vendor's expense. This indemnity does not apply to combinations of the Services with materials not provided by Vendor.",
  },
  {
    chunk_id: "saas-msa-liability-cap-002",
    document_id: "saas-msa-template",
    collection_id: "saas-precedents",
    collection_name: "SaaS Contract Precedents",
    document_filename: "saas-msa-template.md",
    heading: "Limitation of liability — annual fees cap",
    doc_type: "precedent",
    jurisdiction: "US",
    word_count: 95,
    content: "Each party's aggregate liability arising out of or related to this Agreement, whether in contract, tort or otherwise, shall not exceed the fees paid or payable by Customer to Vendor in the twelve (12) months preceding the event giving rise to the liability. Neither party shall be liable for any indirect, incidental, consequential, special or exemplary damages, including loss of profits, revenue, data, or business opportunities, even if advised of the possibility of such damages. The foregoing limitations do not apply to indemnification obligations or breach of confidentiality.",
  },
  {
    chunk_id: "saas-msa-termination-003",
    document_id: "saas-msa-template",
    collection_id: "saas-precedents",
    collection_name: "SaaS Contract Precedents",
    document_filename: "saas-msa-template.md",
    heading: "Termination for cause and cure period",
    doc_type: "precedent",
    jurisdiction: "US",
    word_count: 70,
    content: "Either party may terminate this Agreement for cause upon thirty (30) days written notice to the other party of a material breach if the breach remains uncured at the end of such period. Notwithstanding the foregoing, Customer may terminate immediately upon written notice if Vendor becomes insolvent or files for bankruptcy. Termination does not relieve either party of obligations accrued prior to the effective date of termination.",
  },
  {
    chunk_id: "saas-dpa-subprocessor-004",
    document_id: "saas-dpa-template",
    collection_id: "saas-precedents",
    collection_name: "SaaS Contract Precedents",
    document_filename: "saas-dpa-template.md",
    heading: "Subprocessor authorisation and notice",
    doc_type: "precedent",
    jurisdiction: "EU",
    word_count: 90,
    content: "Customer hereby grants Vendor general written authorisation to engage subprocessors for the processing of Customer Personal Data, subject to Vendor maintaining a current list of such subprocessors at the URL identified in the DPA and providing at least thirty (30) days advance notice of any intended addition or replacement. Customer may object to the addition or replacement of a subprocessor within fifteen (15) business days of notice on reasonable data-protection grounds, in which case the parties shall work together to find a commercially reasonable resolution.",
  },
  {
    chunk_id: "ma-playbook-reps-survival-005",
    document_id: "ma-reps-survival",
    collection_id: "ma-playbook",
    collection_name: "M&A Negotiation Playbook",
    document_filename: "ma-reps-survival.md",
    heading: "Representation survival periods — mid-market US norms",
    doc_type: "playbook",
    jurisdiction: "US",
    word_count: 120,
    content: "For mid-market US transactions (deal value USD 25-500m), the prevailing survival periods are: general representations 12-18 months post-closing; fundamental representations (organisation, authority, capitalisation, title to shares) survive indefinitely or until the applicable statute of limitations; tax representations survive until 60 days after the applicable statute of limitations; environmental representations 3-5 years. Indemnification baskets typically run 0.5%-1.0% of deal value (tipping basket more common than true deductible in mid-market); caps run 10%-15% of deal value for general indemnity, uncapped for fundamentals and fraud. Special indemnities (specific identified risks) are uncapped and survive to statute of limitations.",
  },
  {
    chunk_id: "ma-playbook-mac-006",
    document_id: "ma-mac-clause",
    collection_id: "ma-playbook",
    collection_name: "M&A Negotiation Playbook",
    document_filename: "ma-mac-clause.md",
    heading: "Material adverse change carve-outs",
    doc_type: "playbook",
    jurisdiction: "US",
    word_count: 105,
    content: "Standard buyer-friendly MAC carve-outs exclude effects from: (a) general economic, financial, or capital-market conditions; (b) industry-wide conditions; (c) changes in law or accounting standards; (d) acts of war, terrorism, or natural disasters; (e) pandemics (post-COVID standard); (f) the announcement or pendency of the transaction itself; (g) any failure to meet internal projections (though the underlying cause is not carved out). Disproportionate-effect qualifiers apply to (a)-(e): the target may invoke MAC if the adverse effect is disproportionate relative to comparable companies. Pre-2020 transactions typically lacked the pandemic carve-out; post-2020 it is near-universal.",
  },
  {
    chunk_id: "gdpr-art28-007",
    document_id: "gdpr-article-28",
    collection_id: "gdpr-baseline",
    collection_name: "GDPR Baseline References",
    document_filename: "gdpr-article-28.md",
    heading: "Article 28(3) — mandatory processor contract terms",
    doc_type: "regulation",
    jurisdiction: "EU",
    word_count: 130,
    content: "Article 28(3) of the GDPR requires that processing by a processor shall be governed by a contract that sets out the subject-matter and duration of the processing, the nature and purpose of the processing, the type of personal data and categories of data subjects, and the obligations and rights of the controller. The contract shall in particular provide that the processor: (a) processes the personal data only on documented instructions from the controller; (b) ensures that persons authorised to process the personal data have committed themselves to confidentiality; (c) takes all measures required pursuant to Article 32; (d) respects the conditions for engaging another processor; (e) assists the controller in responding to data subject requests; (f) assists the controller with security incident response.",
  },
  {
    chunk_id: "gdpr-art32-008",
    document_id: "gdpr-article-32",
    collection_id: "gdpr-baseline",
    collection_name: "GDPR Baseline References",
    document_filename: "gdpr-article-32.md",
    heading: "Article 32 — security of processing",
    doc_type: "regulation",
    jurisdiction: "EU",
    word_count: 115,
    content: "Article 32 requires the controller and processor to implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk, including as appropriate: (a) the pseudonymisation and encryption of personal data; (b) the ability to ensure the ongoing confidentiality, integrity, availability and resilience of processing systems; (c) the ability to restore the availability and access to personal data in a timely manner in the event of a physical or technical incident; (d) a process for regularly testing, assessing and evaluating the effectiveness of technical and organisational measures for ensuring the security of the processing. The risk assessment shall consider risks of accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to personal data.",
  },
  {
    chunk_id: "saas-msa-force-majeure-009",
    document_id: "saas-msa-template",
    collection_id: "saas-precedents",
    collection_name: "SaaS Contract Precedents",
    document_filename: "saas-msa-template.md",
    heading: "Force majeure — post-COVID standard",
    doc_type: "precedent",
    jurisdiction: "US",
    word_count: 75,
    content: "Neither party shall be liable for any failure or delay in performance under this Agreement (other than for the payment of fees) to the extent caused by acts of God, natural disasters, war, terrorism, pandemics or epidemics (including without limitation any successor to COVID-19), government order or restriction, labour disputes outside the party's control, or other events beyond the reasonable control of the affected party. The affected party shall give prompt written notice to the other party.",
  },
  {
    chunk_id: "ma-playbook-no-shop-010",
    document_id: "ma-no-shop",
    collection_id: "ma-playbook",
    collection_name: "M&A Negotiation Playbook",
    document_filename: "ma-no-shop.md",
    heading: "No-shop / exclusivity — typical scope and duration",
    doc_type: "playbook",
    jurisdiction: "US",
    word_count: 95,
    content: "No-shop covenants in mid-market US deals typically run 30-60 days exclusivity for the buyer, with a fiduciary-out for the seller's board (if the seller is publicly held) permitting consideration of a Superior Proposal. The covenant prohibits the seller and its representatives from soliciting, initiating, or knowingly encouraging alternative acquisition proposals, and requires prompt notice of any inbound inquiry. Public-company sellers preserve a window-shop provision allowing response to unsolicited bona-fide proposals reasonably likely to lead to a Superior Proposal. Breach remedies include termination right plus reimbursement of buyer expenses; some deals add a break-up fee triggered on Superior Proposal acceptance.",
  },
];
