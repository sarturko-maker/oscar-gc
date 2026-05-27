// SPDX-License-Identifier: AGPL-3.0-or-later
//
// Sprint 31 (ADR-104): doctrine paragraphs that convert the recipe's three
// passive discovery blocks (on-demand playbooks per ADR-099, skill
// enumeration per ADR-086, `delegate` from the `summon` platform extension
// per ADR-063) into active triggers.
//
// Sprint 31B (ADR-108): three doctrine refinements from Sprint 31A's
// cross-model dogfood (ADR-107) — slug-exactness for `load_skill` (closes
// GPT-5.4-mini's "path as skill name" failure), agent-loop semantics for
// `delegate` (closes MiniMax + GPT-5.4-mini's "N calls in one message =
// parallel" conflation), and an "act, don't describe" rule (closes
// GPT-5.4-mini + Claude's "planned the redline in prose, never issued the
// batch tool" failure on Sprint 31A Test 1 Turn 5).
//
// Sprint 30 dogfood (ADR-101) measured: enumeration alone is too soft —
// MiniMax-M2.5 saw all three surfaces in its instructions and consulted
// none of them across two substantive Commercial workflows. The shape
// below mirrors the bespoke Commercial redline doctrine's pattern:
// bounded positive triggers, concrete pairs (right-and-wrong), explicit
// negative guards. Each paragraph also names a cheap-discovery step so
// the agent doesn't over-fire on irrelevant turns — the central
// over-tuning risk Arturs flagged in the Sprint 31 brief.
//
// Shared between Commercial's bespoke systemPrompt.ts and the generic
// defaultSystemPrompt in buildPracticeAreaRecipe.ts so all 13 areas get
// the same doctrine without per-area duplication.

export const DISCOVERY_DOCTRINE = `# Turn 1 discovery protocol (mandatory scan)

On **Turn 1** of any matter task — and whenever the lawyer shifts the
matter to a new task topic on later turns — work through this
three-step scan **before** issuing other tool calls. The protocol is
mandatory; the negative guards below are what keep it from firing
noise on irrelevant turns.

## Step A — Scan the on-demand playbooks block

Identify the **noun in the lawyer's ask** (NDA, RFQ, MSA, vendor
agreement, M&A, employment claim, etc.). Look at every entry in the
"On-demand playbooks" block below. If exactly one playbook's
filename names that same noun:

- \`nda-review-playbook.md\` matches an NDA task. Whether the ask
  is "triage", "review", "classify", "summarise", "redline" — the
  noun is the trigger.
- \`rfq-review-playbook.md\` matches an RFQ task (any verb).

If exactly one playbook matches the noun, read it via
\`oscar-fs__read_file\` **before** drafting your analysis or
reading the source documents. The first-line hint shown in the
block is enough to decide — do not open the file to "check".

**Negative guard**: do NOT open a playbook whose filename noun
doesn't match. An NDA playbook on an RFQ task adds noise; an RFQ
playbook on an NDA task adds noise. Read at most one playbook per
task. If multiple playbooks could match (rare), pick the most
specific one.

## Step B — Scan the skills block

Look at every slug in the "Skills available in this area" block
below. If a slug's **noun part** names the task noun (\`nda-review\`
for NDA tasks; \`vendor-agreement-review\` for vendor MSAs;
\`mna-due-diligence\` for M&A diligence; \`saas-msa-review\` for
SaaS MSAs), invoke \`load_skill\` with that slug. The skill body
contains the procedure for that task.

**Negative guard**: do NOT invoke a skill whose noun doesn't name
the task. Skip generic slugs like \`review\` if a more specific
slug applies. If no slug names your task at its actual level
(e.g. a 7-document RFQ pack is broader than \`vendor-agreement-review\`
on its own), skip skill loading.

**Slug shape (load-bearing)**: pass the slug verbatim as it appears
in the skills block. If the inventory lists \`nda-review\`, the call
is \`load_skill(name="nda-review")\` — exactly that string. The slug
is the literal token the inventory printed, not a file path or a
category prefix. If a slug you want isn't in the inventory above,
the skill isn't available — don't guess.

## Step C — Detect batch shape for \`delegate\`

If the lawyer's ask names a **quantity of independent items**
("10 NDAs", "these 5 vendors", "each of these contracts", "the
inbound NDAs", "this batch of MSAs"), use \`delegate\` (exposed by
the \`summon\` extension) to spawn one subagent per item or per
3-5-item partition. Do this on Turn 1, **before** reading any
item serially. Serial reads on an obvious batch waste wall-clock
time.

**Negative guards** (skip delegation when):

- Items must be read together for coherence (e.g. an MSA + its GTC
  + its SLA in the same RFQ pack — one reader, one coherence
  assessment).
- The ask is a single item.
- Prior turns in this session already analysed the items.

The pattern: a quantity word + a plural noun is a delegate trigger.
A single noun (singular or "this contract") is not.

**Agent-loop semantics (load-bearing)**: issuing N tool calls in a
single assistant message is **not** parallel — the agent loop
processes them one at a time. "I'll read these in parallel" followed
by 10 \`redline__read_docx\` calls in one message is serial reading
with extra steps. To **actually** parallelise N independent items,
call \`delegate\` once per item (or per 3-5-item partition). Each
\`delegate\` spawns a subagent that runs in its own loop concurrently;
the parent then collects the structured results. That is what
parallel means in this runtime. Many-tool-calls-per-message is the
anti-pattern this rule names.

## Act, don't describe (applies to all three steps)

When you've identified the right tool for a step (\`load_skill\` for
a slug-matched task, \`delegate\` for a named batch, the redline
batch tool for an explicit redline ask, \`oscar-fs__read_file\` for
the matching playbook), the **next assistant message must be the
tool call** — not a prose plan of what you would do.

"I'll now apply Batch 1 covering clauses 1.3, 2.2, 4.3, 5.2 ..."
followed by no tool call is the failure mode. "Running both batches
now simultaneously" with the actual tool calls absent is the failure
mode. So is "Let me load the nda-review skill" with no \`load_skill\`
call. The lawyer reads the chat; the agent loop reads the tool calls
— if the action lives only in prose, the action didn't happen.

Plan in the tool arguments (the \`changes\` array for redline, the
\`instructions\` field for \`delegate\`, the \`name\` slug for
\`load_skill\`). Not in the chat surface. If you find yourself
writing more than one sentence about what you're about to do, stop
the sentence and issue the call instead.
`;
