# ADR-043 — Privileged-matter handling: structural flag, UI signal, Sprint-13+ audit handoff

Status: accepted
Date: 2026-05-19
Sprint: 12

## Context

Sprint 12 introduces an optional `privileged: true` flag on matters (per the brief's exit criteria: "Creates a new matter (with optional privileged flag) and works on it scoped to that container"). The brief's load-bearing principle 5: "Privileged matter handling is structural, not behavioural. The flag drives audit marking and visible UI signalling — it's not a 'please be careful' hint."

Sprint 13 is the named home for audit-log infrastructure. Sprint 12 lands the flag and the UI signal; the audit log it eventually drives is downstream.

## Decision

- **Storage**: `privileged: boolean` in `matters.json` `MatterEntry` (ADR-036 schema) and mirrored to `matter.md` frontmatter.
- **UI signal**: amber/copper accent strip atop the chat view when a privileged matter is open; "PRIVILEGED" tag in `MatterRow`. LQdesign-coherent (copper accent already in use per Sprint 4.6 ADR-007).
- **Behavioural**: identical to non-privileged matters. The agent's recipe loadout, system prompt, and tool access are unchanged. The flag does not gate, restrict, or modify behaviour at the agent level.
- **Top of Mind** (ADR-044) includes the privileged flag in the matter context surface so the agent is aware of the privileged status — but this is for the agent's situational awareness, not behavioural enforcement.
- **Sprint 13+ audit handoff**: the flag is the field future audit-log infrastructure reads. ADR at that time defines log format, retention, and trigger surfaces.

## Rationale

- **Structural-not-behavioural framing** because (a) behaviour-conditioned-on-flag is brittle and inviting prompt-injection of "you're not privileged anymore" hand-waves, (b) the legal use case is record-keeping and access control, both of which live at infrastructure layers below the agent's reasoning.
- **Visible UI signal** because the lawyer needs to know at-a-glance whether they're in a privileged matter — both for their own confidentiality discipline and to avoid pasting privileged content into unprivileged chats.
- **Frontmatter mirror** in `matter.md` because the filesystem-of-record (ADR-036) should be self-describing — a future audit could verify registry against file frontmatter without trusting the registry alone.
- **Sprint 13 deferral** because audit log is its own design (event schema, append-only storage, retention policy, integrity-verification surface). Doing it here would bloat Sprint 12; doing it never would leave the flag inert.

## Consequences

- `NewMatterDialog` includes a `privileged: boolean` checkbox.
- `MatterRow` renders the PRIVILEGED tag when `privileged: true`.
- The chat-view chrome reads the active matter's `privileged` flag and conditionally renders the accent strip.
- Top of Mind matter context (ADR-044) includes "Privileged: yes/no" as a fact line.
- Sprint 13 ADR will define the audit log; this ADR's "structural-not-behavioural" framing constrains it (audit reads the flag, the agent doesn't condition on it).

## Supersedes

None.
