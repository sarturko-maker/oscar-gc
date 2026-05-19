# ADR-047 — Matter schema v2 (in-house framing)

Status: accepted
Date: 2026-05-19
Sprint: 14

## Context

Sprint 13 Crostini dogfood (findings.md §P2-B, §P2-E) surfaced a load-bearing problem with the Sprint 12 matter model: `client`, `counterparty`, and `matter_type` assume external-counsel framing. For in-house counsel they read wrong across all 13 practice areas:

- **Commercial** — work is with suppliers, vendors, consumers, partners, distributors, internal business units. "Client" defaults to the lawyer's own company; "Counterparty" is the relevant external entity.
- **Privacy** — work is regulatory. DSRs, DPIAs, vendor DPAs, regulator inquiries. "Client" doesn't apply; "Counterparty" is misleading for a DPIA on an internal product.
- **Employment / Disputes / IP / Regulatory / Corporate / CoSec / Product / AI Governance** — each has its own mental model the v1 schema can't honestly carry.

Plan-mode confirmed (a) the three fields are LLM-context-only — no analytics consumer — so the schema is free to reshape, and (b) the right approach is a small unifying abstraction across the 13 areas, not a 13-way switch.

Two other dogfood findings rode into the same redesign: P2-C (no matter-list back-affordance from chat), P2-D (no higher-level grouping above matter).

## Decision

**Schema v2** (`ui/desktop/src/components/oscar/matters/types.ts`):

- Drop `client` / `counterparty` / `matter_type`.
- Add `subject: { type, label }` — the noun the matter is about, type-narrowed across {contract, person, entity, transaction, policy, processing_activity, event, obligation, mark, patent, product, model, dataset, meeting, other}.
- Add `counterparty: { role, name } | null` — single party slot with a typed `role` enum. Multi-party (`parties[]`) deferred until a real matter needs it.
- Add `kind: string` — area-specific, narrowed per area at intake by `PRACTICE_AREA_SHAPES`.
- Add `extras: Record<string, string>` — sparse, kind-conditional fields (regulator, forum, deadline, jurisdictions, deal_value, risk_classification, …). Bounded: ≤32 keys, ≤400 chars per value.
- Add `stakeholder: string | null` — controlled-vocabulary tag for grouping (P2-D).
- Add `area_id: string` and `working_dir: string` — surface what was previously implicit in path/layout.
- Bump `schema_version: 2`. v1 registries renamed to `matters.v1.json.bak` on first read and treated as empty. Pre-pilot; no automated migration.

**Per-area config** (`practiceAreaShapes.ts`): declarative `PracticeAreaShape` record keyed by area id (13 entries). Each shape carries in-house vocabulary (labels, placeholders, hints), area-specific `kind` options, `counterparty` slot definition (role enum narrowed per area), kind-conditional `extras` fields, and `privileged` defaults per kind. One `NewMatterDialog` consumes the config; no per-area components.

**Split disk layout**:
- `~/.config/oscar/state/<area-id>/matters/<slug>/{history.md, notes.md, session.json}` — operational state; never user-edited.
- `~/Documents/Oscar GC/<Area Name>/<Matter Name>/{matter.md, outputs/, source documents}` — Finder-discoverable, drag-drop-friendly, cloud-sync-compatible. Recipe widens `oscar-fs` `allowed-directories` for an active matter to include both folders; `OSCAR_MATTER_DIR` points at the working folder.

**Grouping** (P2-D): tag-and-group via the `stakeholder` field. `MattersLanding` groups rows under stakeholder headers with controlled-vocab autocomplete (suggestions sourced from prior values in the same area). First-class stakeholder entity deferred until a stakeholder-level profile document becomes load-bearing.

**Back-affordance** (P2-C): reuse `ui/BackButton.tsx`. New `MatterBackButton` component performs an IPC reverse-lookup (`oscar:matters:lookup-session`) and renders the button only when the active session is matter-bound. Click navigates to `/practice/{areaId}` and clears Top of Mind (`detachActive`) so the next matter isn't auto-anchored to the previous one.

**Top of Mind**: `renderTomActiveMatter` rewritten with adaptive template + a single `LABELS` map. No per-area branching beyond data; sections with no content are omitted. Labels read in in-house vocabulary (Employee/Subject/Vendor/Entity, not Client/Counterparty).

**Validation**: at IPC boundary (`oscar:matters:create` via `NewMatterInputSchema.parse`) and on file read (`MattersFileSchema.safeParse` in `readMattersRegistry`). Per CLAUDE.md "trust internal, validate at boundaries" — no defence-in-depth in the dialog or hook layers.

## Rationale

- **Honest cross-area shape**: the `subject + counterparty? + kind + extras` abstraction maps onto all 13 areas without forcing fields ("client" for a Privacy DSR was the problem). Five family templates emerge from the data (Contract-shaped, Person-shaped, Regulator/Obligation, Internal-asset, Event-shaped) — but they're configuration, not code branches.
- **Split disk**: operational state (registry JSON, history log) needs to be quarantined from cloud-sync and accidental user edits; working folder (matter.md + source documents) needs Finder discoverability and drag-drop. Tension only collapses by splitting.
- **Tag-and-group first**: stakeholder-as-tag is reversible and cheap; promoting to a first-class entity later only requires migrating an existing column to a join. Inverse direction would have been expensive.
- **Reuse existing `BackButton`**: dogfood-flagged gap closes with a wrapper, not a new pattern. Mouse-back-button event handling comes for free.

## Consequences

- v1 dogfood matters from Sprint 13 are discarded on first launch (release-notes one-liner). Pre-pilot; acceptable.
- Default `~/Documents/Oscar GC/<Area>/<Name>/` writes to the user's Documents — if IT pushes a OneDrive/Drive Known Folder Move, matter content syncs automatically. Privileged matters land in the same tree; if that's a concern, a future ADR can move privileged matters to a quarantined folder, but Sprint 14 keeps the simpler shape.
- `kind` is `string` (not enum) at the schema layer; the per-area config provides the closed enum at the UI but "Other" still lets the user type a free-form kind. The Top of Mind label renderer falls back to a Sentence-cased version of the snake_case value, so free-form kinds render reasonably.
- Grouping merges by case-insensitive stakeholder name. "Acme" and "Acme Corp" don't merge automatically — autocomplete from prior values is the gentle nudge to consistency.
- `extras` values are string-only. Dates/numbers/multi-select are encoded as strings ("2026-06-30", "GBP 12m", "EU, UK, US"). If a future surface needs typed extras, this ADR is the place to revisit; for Sprint 14 the LLM consumes them as text anyway.
- `oscar-fs` allowed-directories now includes two paths per matter. server-filesystem treats them equally — both readable and writable. Skills that read user-provided source docs target the working folder via `$OSCAR_MATTER_DIR`; skills that touch the agent's notepad target the state folder by explicit path.

## Supersedes

Refines ADR-036 (matter folder layout), ADR-038 (conversation-history matter binding), ADR-043 (privileged matter flag), ADR-044 (Top of Mind matter context). None are formally superseded — the data and binding contracts they established hold; the schema reshape is additive (new fields, dropped fields), the disk layout adds a sibling path without breaking the state path, and the Top of Mind file remains the agent's per-turn injection.
