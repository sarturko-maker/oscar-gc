import { z } from "zod";

export const SCHEMA_VERSION = 1;

export const SizeBandSchema = z.enum([
  "1-50",
  "51-200",
  "201-1000",
  "1001-5000",
  "5000+",
]);

export const PracticeAreaSourceSchema = z.enum(["default", "user-added"]);

export const PracticeAreaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  body: z.string(),
  source: PracticeAreaSourceSchema,
});

export const UserSchema = z.object({
  name: z.string().nullable(),
  role: z.string().min(1),
  role_label: z.string().min(1),
});

export const CorporateSchema = z.object({
  name: z.string().nullable(),
  industry: z.string().nullable(),
  size_band: SizeBandSchema.nullable(),
});

export const ProviderSchema = z.object({
  kind: z.enum(["minimax"]),
  model: z.string().min(1),
});

export const ProfileSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  completed_at: z.string().min(1),
  user: UserSchema,
  corporate: CorporateSchema,
  practice_areas: z.array(PracticeAreaSchema).min(1),
  provider: ProviderSchema,
});

export type Profile = z.infer<typeof ProfileSchema>;
export type PracticeArea = z.infer<typeof PracticeAreaSchema>;
