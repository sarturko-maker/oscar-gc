// Sprint 20-M8 (ADR-090): Zod schema for the Forge Mode E marker file.
// Forge writes ~/.config/oscar/_forge_request_delete_<areaId>.json via
// oscar-fs__write_file; the main-process watcher (forgeDeleteWatcher.ts)
// JSON-parses + Zod-parses each match. Markers that fail the shape OR
// whose timestamp is older than the 5s stale-window are dropped silently
// (the watcher logs them).
//
// Why these fields:
// - areaId: target of the delete. The renderer cross-checks it against
//   the filename slug to defend against an LLM that names the file one
//   way and writes a different id in the body.
// - timestamp: ISO 8601. The drop-if-older-than-5s rule needs a parseable
//   moment; ISO is what JS Date round-trips cleanly. Used as the archive
//   folder suffix on confirm.
// - impact: lawyer-facing counts surfaced in the modal. Kept loose
//   (numbers + a string array); main process recomputes from disk on
//   confirm before any destructive action, so the marker's claim is
//   advisory, not authoritative.

import { z } from 'zod';

export const ForgeDeleteRequestSchema = z.object({
  areaId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  timestamp: z.string().datetime(),
  impact: z.object({
    matterCount: z.number().int().nonnegative(),
    integrationCount: z.number().int().nonnegative(),
    overrideKeys: z.array(z.string()),
  }),
});

export type ForgeDeleteRequest = z.infer<typeof ForgeDeleteRequestSchema>;
