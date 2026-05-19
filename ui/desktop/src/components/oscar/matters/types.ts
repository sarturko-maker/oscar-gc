// Sprint 14 (ADR-047): matter data model v2. Drops law-firm vocabulary
// (client / counterparty / matter_type) for in-house-shaped fields:
// subject + optional counterparty + area-typed kind + sparse extras +
// stakeholder grouping tag + explicit working_dir. Validated at IPC
// boundary in main.ts per CLAUDE.md "trust internal, validate at boundaries".

import { z } from 'zod';

export const MatterStatusSchema = z.enum(['active', 'closed']);
export type MatterStatus = z.infer<typeof MatterStatusSchema>;

// What a matter is "about". Crosses 13 practice areas; per-area shapes
// (practiceAreaShapes.ts) narrow which types the dialog exposes.
export const SubjectTypeSchema = z.enum([
  'contract',
  'person',
  'entity',
  'transaction',
  'policy',
  'processing_activity',
  'event',
  'obligation',
  'mark',
  'patent',
  'product',
  'model',
  'dataset',
  'meeting',
  'other',
]);
export type SubjectType = z.infer<typeof SubjectTypeSchema>;

export const SubjectSchema = z.object({
  type: SubjectTypeSchema,
  label: z.string().min(1).max(160),
});
export type Subject = z.infer<typeof SubjectSchema>;

// Party roles — typed across the cross-area party model. The dialog
// narrows the role enum per area (e.g. Commercial offers customer/vendor/
// supplier/partner; Disputes offers claimant/respondent).
export const PartyRoleSchema = z.enum([
  'counterparty',
  'vendor',
  'supplier',
  'customer',
  'consumer',
  'partner',
  'reseller',
  'processor',
  'subprocessor',
  'licensor',
  'licensee',
  'investor',
  'regulator_authority',
  'data_subject',
  'employee',
  'contractor',
  'claimant',
  'respondent',
  'internal_owner',
  'entity',
  'other',
]);
export type PartyRole = z.infer<typeof PartyRoleSchema>;

export const PartySchema = z.object({
  role: PartyRoleSchema,
  name: z.string().min(1).max(120),
});
export type Party = z.infer<typeof PartySchema>;

// Sparse, string-only kind-conditional fields (regulator, forum, deadline,
// investigation_lead, jurisdictions, deal_value, risk_classification, ...).
// Bounded so it doesn't bleed into "JSON blob" territory.
export const ExtrasKeySchema = z.string().regex(/^[a-z_][a-z0-9_]*$/);
export const ExtrasSchema = z
  .record(ExtrasKeySchema, z.string().max(400))
  .refine((r) => Object.keys(r).length <= 32, {
    message: 'extras supports up to 32 keys',
  });
export type Extras = z.infer<typeof ExtrasSchema>;

export const MatterEntrySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  name: z.string().min(1).max(120),
  area_id: z.string().min(1).max(64),
  kind: z.string().min(1).max(64),
  subject: SubjectSchema,
  counterparty: PartySchema.nullable(),
  stakeholder: z.string().max(120).nullable(),
  extras: ExtrasSchema.optional(),
  working_dir: z.string().min(1),
  opened_at: z.string().datetime(),
  last_accessed_at: z.string().datetime(),
  status: MatterStatusSchema,
  privileged: z.boolean(),
  session_id: z.string().nullable(),
  schema_version: z.literal(2),
});
export type MatterEntry = z.infer<typeof MatterEntrySchema>;

export const MattersFileSchema = z.object({
  schema_version: z.literal(2),
  matters: z.array(MatterEntrySchema),
});
export type MattersFile = z.infer<typeof MattersFileSchema>;

// Dialog → IPC. main.ts fills in slug-derived path fields (working_dir,
// area_id) plus the derived timestamps + session_id + schema_version.
export const NewMatterInputSchema = z.object({
  slug: MatterEntrySchema.shape.slug,
  name: MatterEntrySchema.shape.name,
  kind: MatterEntrySchema.shape.kind,
  subject: SubjectSchema,
  counterparty: PartySchema.nullable(),
  stakeholder: z.string().max(120).nullable(),
  extras: ExtrasSchema.optional(),
  privileged: z.boolean(),
  key_facts: z.string().max(4000),
});
export type NewMatterInput = z.infer<typeof NewMatterInputSchema>;
