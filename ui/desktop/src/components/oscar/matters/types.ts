// Sprint 12 (ADR-036): matters data model. Schema-v1; Zod-validated at the
// IPC boundary in main.ts handlers per CLAUDE.md "trust internal, validate
// at boundaries".

import { z } from 'zod';

export const MatterStatusSchema = z.enum(['active', 'closed']);
export type MatterStatus = z.infer<typeof MatterStatusSchema>;

export const MatterEntrySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be kebab-case'),
  name: z.string().min(1).max(120),
  client: z.string().min(1).max(120),
  counterparty: z.string().max(120).nullable(),
  matter_type: z.string().min(1).max(80),
  opened_at: z.string().datetime(),
  last_accessed_at: z.string().datetime(),
  status: MatterStatusSchema,
  privileged: z.boolean(),
  session_id: z.string().nullable(),
  schema_version: z.literal(1),
});
export type MatterEntry = z.infer<typeof MatterEntrySchema>;

export const MattersFileSchema = z.object({
  schema_version: z.literal(1),
  matters: z.array(MatterEntrySchema),
});
export type MattersFile = z.infer<typeof MattersFileSchema>;

// Input shape for new-matter creation; the IPC fills in derived fields
// (opened_at, last_accessed_at, status='active', session_id=null,
// schema_version=1).
export const NewMatterInputSchema = z.object({
  slug: MatterEntrySchema.shape.slug,
  name: MatterEntrySchema.shape.name,
  client: MatterEntrySchema.shape.client,
  counterparty: MatterEntrySchema.shape.counterparty,
  matter_type: MatterEntrySchema.shape.matter_type,
  privileged: z.boolean(),
  key_facts: z.string().max(4000),
});
export type NewMatterInput = z.infer<typeof NewMatterInputSchema>;
