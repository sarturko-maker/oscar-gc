export interface DocumentSection {
  heading: string;
  level: number;
  content: string;
  children: DocumentSection[];
}

export interface DocumentTable {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface ParseWarning {
  type: string;
  location?: string;
  message: string;
  sample?: string;
}

export interface ParsedDocument {
  name: string;
  mimeType: string;
  pageCount: number;
  wordCount: number;
  sections: DocumentSection[];
  definedTerms: string[];
  tables: DocumentTable[];
  fullText: string;
  parseWarnings?: ParseWarning[];
}

export const DOCUMENTS: ParsedDocument[] = [
  {
    name: "saas-msa-acme-2025.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pageCount: 8,
    wordCount: 1820,
    fullText:
      "Master Services Agreement between Vendor and Customer for the provision of Software-as-a-Service. Effective Date: 1 January 2025. This Agreement covers definitions, services, fees, term and termination, warranties, indemnification, limitation of liability, confidentiality, data protection, and miscellaneous provisions.",
    definedTerms: [
      "Agreement",
      "Customer",
      "Customer Data",
      "Effective Date",
      "Services",
      "Subscription Term",
      "Vendor",
    ],
    parseWarnings: [],
    tables: [
      {
        caption: "Schedule 1 — Subscription Tiers",
        headers: ["Tier", "Monthly Fee (USD)", "Included Seats", "Support SLA"],
        rows: [
          ["Starter", "499", "10", "Business hours, 8h response"],
          ["Growth", "1,499", "50", "24/7, 4h response"],
          ["Enterprise", "4,999", "Unlimited", "24/7, 1h response"],
        ],
      },
    ],
    sections: [
      {
        heading: "1. Definitions",
        level: 1,
        content:
          "'Agreement' means this Master Services Agreement together with all Schedules and Order Forms. 'Customer Data' means all data submitted to the Services by Customer or its Authorised Users. 'Services' means the Software-as-a-Service offering identified in the applicable Order Form. 'Subscription Term' means the period during which Customer is entitled to use the Services as set out in an Order Form.",
        children: [],
      },
      {
        heading: "2. Services and Fees",
        level: 1,
        content:
          "Vendor will provide the Services in accordance with the applicable Order Form. Fees are payable monthly in advance and are non-refundable. Vendor may increase fees on renewal upon sixty (60) days written notice.",
        children: [],
      },
      {
        heading: "3. Term and Termination",
        level: 1,
        content:
          "This Agreement commences on the Effective Date and continues for the Subscription Term, renewing automatically for successive twelve-month periods unless either party gives written notice of non-renewal at least sixty (60) days prior to the end of the then-current term.",
        children: [
          {
            heading: "3.1 Termination for cause",
            level: 2,
            content:
              "Either party may terminate this Agreement for cause upon thirty (30) days written notice to the other party of a material breach if the breach remains uncured at the end of such period. Customer may terminate immediately upon written notice if Vendor becomes insolvent or files for bankruptcy.",
            children: [],
          },
          {
            heading: "3.2 Effect of termination",
            level: 2,
            content:
              "Upon termination, Customer's right to access the Services ceases. Vendor will make Customer Data available for export for thirty (30) days following termination, after which Vendor may delete Customer Data.",
            children: [],
          },
        ],
      },
      {
        heading: "4. Warranties",
        level: 1,
        content:
          "Vendor warrants that the Services will be provided in a professional and workmanlike manner consistent with generally accepted industry standards. EXCEPT AS EXPRESSLY PROVIDED HEREIN, VENDOR DISCLAIMS ALL OTHER WARRANTIES, WHETHER EXPRESS OR IMPLIED.",
        children: [],
      },
      {
        heading: "5. Indemnification",
        level: 1,
        content:
          "Vendor shall defend, indemnify and hold harmless Customer against any third-party claim that the Services as provided infringe such third party's intellectual property rights, and shall pay any damages finally awarded against Customer. This indemnity does not apply to combinations of the Services with materials not provided by Vendor.",
        children: [],
      },
      {
        heading: "6. Limitation of Liability",
        level: 1,
        content:
          "Each party's aggregate liability shall not exceed the fees paid or payable by Customer in the twelve (12) months preceding the event giving rise to the liability. Neither party shall be liable for indirect, incidental, consequential, special or exemplary damages. The limitations do not apply to indemnification obligations or breach of confidentiality.",
        children: [],
      },
      {
        heading: "7. Confidentiality and Data Protection",
        level: 1,
        content:
          "Each party shall keep confidential all Confidential Information of the other party. Vendor's processing of Customer Personal Data is governed by the Data Processing Addendum incorporated by reference.",
        children: [],
      },
      {
        heading: "8. Miscellaneous",
        level: 1,
        content:
          "This Agreement is governed by the laws of the State of Delaware. Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered by JAMS under its Commercial Arbitration Rules. Force majeure events include pandemics, government orders, and other events beyond the reasonable control of the affected party.",
        children: [],
      },
    ],
  },
  {
    name: "nda-mutual-template.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pageCount: 3,
    wordCount: 650,
    fullText:
      "Mutual Non-Disclosure Agreement. This Agreement governs the exchange of confidential information between two parties for the purpose of evaluating a potential business relationship.",
    definedTerms: ["Confidential Information", "Disclosing Party", "Effective Date", "Receiving Party", "Representatives"],
    parseWarnings: [
      {
        type: "table-extraction",
        location: "page 2",
        message: "Schedule A table extraction unreliable; values may be off-by-one.",
      },
    ],
    tables: [],
    sections: [
      {
        heading: "1. Purpose",
        level: 1,
        content:
          "The parties wish to explore a potential business opportunity (the 'Purpose') and in connection therewith may disclose to each other certain confidential information.",
        children: [],
      },
      {
        heading: "2. Confidential Information",
        level: 1,
        content:
          "'Confidential Information' means all information disclosed by the Disclosing Party to the Receiving Party that is marked confidential or that would be reasonably understood to be confidential given the nature of the information and the circumstances of disclosure.",
        children: [],
      },
      {
        heading: "3. Obligations",
        level: 1,
        content:
          "The Receiving Party shall (a) use Confidential Information solely for the Purpose; (b) protect Confidential Information with the same degree of care it uses to protect its own confidential information of like nature, but in no event less than reasonable care; (c) limit access to its Representatives who have a need to know.",
        children: [],
      },
      {
        heading: "4. Exclusions",
        level: 1,
        content:
          "Confidential Information does not include information that (a) is or becomes publicly available without breach of this Agreement; (b) was rightfully known by the Receiving Party prior to disclosure; (c) is independently developed by the Receiving Party without use of Confidential Information; (d) is rightfully obtained from a third party without restriction.",
        children: [],
      },
      {
        heading: "5. Term",
        level: 1,
        content:
          "This Agreement commences on the Effective Date and continues for two (2) years. Obligations of confidentiality survive termination for an additional three (3) years.",
        children: [],
      },
    ],
  },
];
