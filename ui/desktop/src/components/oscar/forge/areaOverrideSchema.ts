// Sprint 20-M7 (ADR-089): Zod schema for renderer-side defence-in-depth
// validation of profile.json writes. Forge is an LLM and may write malformed
// JSON into practice_areas[i].area_overrides; this schema is what the
// main-process watcher (profileWriteWatcher.ts) Zod-parses each write
// against. On failure, the watcher reverts to .bak — Forge's Mode D
// procedure step 7 reads back and surfaces the rejection conversationally.
//
// Why local + minimal (not a full ProfileSchemaV4 mirror):
// - oscar-onboarding-mcp's schema.ts is the canonical v4 definition but the
//   sibling is private + ESM-only + no .d.ts + no exports field (not
//   packaged as a library). Cross-repo import path is not available.
// - This schema only needs to catch corrupt area_overrides shape. Other
//   profile.json fields stay z.unknown() with passthrough so the watcher
//   doesn't reject valid v3 / v4 / v5+ profiles based on shape drift.
// - Mirror of OscarAreaOverrides in useOscarProfile.ts; shapes are
//   identical (panel_sections kept permissive — main process doesn't have
//   the PanelSectionId enum bound here; section-level validation happens
//   at render time).

import { z } from 'zod';

const ScopeModeSchema = z.enum(['all', 'allow', 'deny']);

export const AreaOverridesSchema = z.object({
  description_override: z.string().optional(),
  panel_sections: z.array(z.string()).optional(),
  enabled_skills: z
    .object({
      mode: ScopeModeSchema,
      slugs: z.array(z.string()),
    })
    .optional(),
  enabled_mcps: z
    .object({
      mode: ScopeModeSchema,
      ids: z.array(z.string()),
    })
    .optional(),
  playbooks: z
    .object({
      always_on: z.array(z.string()),
      on_demand: z.array(z.string()),
    })
    .optional(),
});

export type AreaOverridesValidated = z.infer<typeof AreaOverridesSchema>;

const PracticeAreaForWriteValidationSchema = z
  .object({
    id: z.string().min(1),
    area_overrides: AreaOverridesSchema.optional(),
  })
  .passthrough();

export const ProfileForWriteValidationSchema = z
  .object({
    practice_areas: z.array(PracticeAreaForWriteValidationSchema),
  })
  .passthrough();

export type ProfileForWriteValidation = z.infer<
  typeof ProfileForWriteValidationSchema
>;
