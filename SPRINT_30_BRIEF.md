# Sprint 30 — Brief

This is a **dogfood-only sprint**. No product code lands. The sprint
tests whether Sprint 29 M6 (on-demand playbook discovery — [[ADR-099]])
and the broader Sprint 18 / 20 / 22 / 28 wiring actually expose
tools, playbooks, and skills to MiniMax in a way the model *chooses
to use*. Sprint 29 closed the visibility gap on paper; Sprint 30
finds out whether the agent walks through the door.

## What Arturs said (verbatim, 2026-05-25)

> We are going to run two tests.
>
> (1) You will create RFQ documentation. Pretend that you are in a
> distribution business. The RFQ needs to feel real. Multiple Docx
> files, multiple pdfs. You will also create a playbook for RFQ
> reviews (but you will not aim it at this specific RFQ). You will
> then operate MiniMax to review the RFQ. The hope is MiniMax will
> spin multiple agents to review the documents. Collect feedback.
> Give user a response. The user then asks clarifying questions and
> ultimately redlines the agreement using Adeu.
>
> The goal is not to check how accurate MiniMax is, but whether
> tools and playbooks and skills are exposed to MiniMax and it
> chooses to use them.
>
> (2) Similar task but review of 10 NDAs simultaneously.

## The meta-goal (load-bearing)

Both tests share the same success criterion, and it's **not** about
answer quality. The question is exposure-and-uptake:

- **Does the agent see the playbook?** Sprint 29 M6 added an
  on-demand playbook enumeration block to the recipe instructions.
  The test is whether the agent reads the playbook by name (via
  `oscar-fs__read_file` or `computercontroller`'s `pdf_tool` /
  `docx_tool`) without the lawyer naming it in the prompt.
- **Does the agent see the skills?** Commercial's bundled skill
  library (`commercial-legal` plugin — `nda-review`,
  `vendor-agreement-review`, `escalation-flagger`, etc.) surfaces in
  every Commercial matter's recipe via the Sprint 20-M5 enumeration
  block. The test is whether the agent invokes them by name on
  relevant questions.
- **Does the agent see the tools?** Sprint 28 made
  `oscar-fs` / `computercontroller` / `Tavily` / `redline` (Adeu)
  the per-area Tool surface. The redline test (end of Test 1) is
  whether the agent reaches for `redline__process_document_batch`
  when asked to mark up the agreement.
- **Does the agent spin subagents?** Goose's `summon` platform
  extension (Sprint 21 + 22 wiring) is the multi-agent primitive.
  The Test 2 hope ("review 10 NDAs simultaneously") is whether
  MiniMax delegates to N subagents rather than serialising. **Think
  deeply about this** — Arturs's framing is "*the hope is MiniMax
  will spin multiple agents*", which is the load-bearing question of
  Test 2. If the answer is no, that's the finding; we don't engineer
  around it in this sprint.

What the sprint deliberately is NOT measuring: legal-substance
accuracy. MiniMax's NDA judgment is a different question. This
sprint is wiring-and-uptake.

## Cold-start reading order for the fresh CC session

1. `PROJECT.md` — project goal + Sprint Index (Sprint 29 is the
   most recent on-disk).
2. `CLAUDE.md` — operating rules; especially "Verify before
   acting", "Reuse over rebuild", and the upstream Goose authority
   note (`goose-docs.ai` 404s for most relevant pages — code prevails).
3. `SPRINT_LOG.md` — Sprint 29 entry first (M6 on-demand playbook
   discovery + M7 multi-chat research), Sprint 28 entry second
   (Tools section + Skills toggle clarity), Sprint 22 (sub-recipes
   + per-partner Tier-A MCPs — relevant if the multi-agent test
   needs deeper wiring), Sprint 21 (Lavern firm-mode + `summon`
   primitive).
4. `RUNBOOK.md` — dogfood harness pattern (`scripts/dogfood/`,
   `ui/desktop/scripts/dogfood-driver.mjs` from Sprint 7), Xvfb /
   capture stack, MiniMax key location, transcript extraction from
   `~/.local/share/goose/sessions/sessions.db`.
5. ADRs 099 (on-demand playbook discovery block — the thing this
   sprint tests), 085 (three-layer playbook architecture), 086
   (skill enumeration block), 092 (Tools section), 074 (`Path A`
   per-recipe MCP loadout — sub-recipe shape).
6. `docs/sprint-29/playbook-wiring-inspection.md` — the structural
   account of what got wired and what the Crostini hand-test still
   needs to validate live. This sprint *is* that live validation.

After the cold-start read, run `git log --oneline -15` and `ls
~/.config/oscar/state/` on lq-vps to confirm the live host's state
(it has been used heavily for Sprint 29 visual harnesses; reset
state per RUNBOOK if needed).

## What both tests share (operational shape)

- **Surface**: real Oscar GC desktop binary on `lq-vps` under Xvfb,
  driven by the Sprint 7 dogfood driver (or a successor with the
  same shape: launch, click, send-message, screenshot, read-DOM,
  quit). MiniMax-M2.5 as the live provider. **No mocked LLM** —
  CLAUDE.md "Pipeline tests must NOT mock LLM calls".
- **Practice area**: Commercial. Both RFQ and NDA matters sit
  cleanly there; the area already carries the full bundled
  `commercial-legal` skill library, `redline` (Adeu) as a Tool,
  oscar-fs scoped to the matter folder, and the on-demand playbook
  block from Sprint 29 M6.
- **Playbook posture**: uploaded to the matter's area scope OR to
  global, **never flipped always-on**. The whole point is the
  on-demand path. Flipping always-on would inline the playbook text
  into the recipe and remove the discovery question — that's a
  different (and already-known-working) wiring.
- **Cost discipline**: the $10/PCM MiniMax dev-key cap from
  RUNBOOK applies. Both tests likely sit well under $1 each, but
  pre-flight check the spend before running the second test. If
  Test 1 alone exceeds expectations, pause and recalibrate before
  Test 2 (which could spawn N agents).
- **Per-test output**: a structured report under
  `docs/sprint-30/<test-name>/` covering:
  - The transcript (extracted from `sessions.db`, including
    `toolRequest` / `toolResponse` blocks — `apt install` already
    has the Python sqlite3 used in Sprint 7).
  - A timeline of tool calls (what called what, in what order,
    against which files).
  - Screenshots at key moments.
  - A *findings* table: did the agent read the playbook (Y/N),
    invoke a named skill (Y/N + which), spawn subagents (Y/N + how
    many), invoke redline tools (Y/N), discover-and-read files in
    the matter folder unprompted (Y/N + how).
  - One paragraph on what the wiring let through and what it
    didn't, in lawyer-natural language.

## The matter folder is the consolidation point

Sprint 14 (ADR-047) put this invariant in place; both Sprint 30
tests rely on it and one observation criterion sits on top of it.
Worth stating plainly in the brief so the fresh CC doesn't
re-derive it from source on day one.

- **Per-matter folder, predictable path.** Each matter writes
  content to `~/Documents/Oscar GC/<Area Display Name>/<Matter
  Display Name>/`. Commercial RFQ matter "Acme Supply" lands at
  `~/Documents/Oscar GC/Commercial/Acme Supply/`. Finder-
  discoverable, drag-and-drop friendly, cloud-sync compatible —
  intentional from ADR-047. State (registry, history, notes) lives
  separately under `~/.config/oscar/state/<area-id>/matters/<slug>/`
  so the user-visible folder isn't cluttered.
- **`oscar-fs` is scoped to that folder when the matter is open**
  (Sprint 12 ADR-040 / ADR-041). The agent only sees this matter's
  contents — no sibling-matter leakage. The "user can still point
  Oscar GC at anywhere" exception is gated behind explicit
  oscar-fs widening; default is matter-scoped.
- **Consolidation is the point.** Both tests should drop files
  into the matter folder, not into ad-hoc paths. A real lawyer
  using Oscar GC will keep doing this anyway; the test mirrors
  that workflow.

**The proactive-file-drop observation.** Today nothing watches the
matter working dir — the agent learns about files at recipe-build
time (per spawn). Files dropped mid-conversation aren't surfaced
to the agent automatically; the lawyer has to mention them or the
agent has to think to call `oscar-fs__list_directory`. Sprint 30
observes (does not fix) whether either of those happens naturally:

- For Test 1: after the agent gives its first read of the RFQ
  pack, drop an *additional* document into the matter folder
  (e.g., a counterparty's "supplementary T&Cs PDF" they forgot
  to send originally). Without naming the file, ask the agent
  "any thoughts on what they sent over after the first batch?"
  Observe: does it list the directory? Does it find the new file?
- For Test 2: drop the 10 NDAs in two waves — 6 before opening
  the matter, 4 added after the agent has given its first
  per-NDA verdict on the initial 6. Observe the same.

The point isn't to build a watcher this sprint — the primitives
for one already exist in the codebase (`fs.watch` used in
`forgeDeleteWatcher.ts` / `profileWriteWatcher.ts`; Top of Mind
re-reads its message file per turn at
`crates/goose/src/agents/platform_extensions/tom.rs:72`; the
Sprint 29 M6 on-demand block established the "enumerate-what's-
available, agent reads on demand" pattern). The point is to
measure how much friction the *absence* of a watcher causes in
the natural workflow, so Sprint 31 can decide if it's worth
building.

---

## Test 1 — RFQ review + redline (Commercial / distribution)

### Setup: the fictional company

Pretend the matter is being reviewed by an in-house counsel at a
mid-sized distribution business — call it something like "Stanford
Industrial Supply Co." or any plausible name. They distribute
industrial equipment / parts across EU + UK. They receive RFQs from
prospective buyers (mid-market manufacturers, retailers, public
sector). Pick a vertical that justifies a substantive RFQ.

The fictional counterparty (the buyer issuing the RFQ) should be a
plausible mid-market customer — manufacturing or retail — issuing
an RFQ pack for a 3-year supply arrangement.

### Setup: the RFQ pack

A realistic RFQ pack for a distribution supply contract typically
spans 5–8 documents. The brief picks pack composition; what matters
is that it *feels real* — meaning the documents reference each
other, use industry vocabulary, have realistic numbers, and contain
the usual asymmetries an in-house counsel would want to push back
on. Suggested composition (adjust to taste):

- **A cover letter / RFQ invitation** (PDF) — buyer's RFP team
  introducing the procurement exercise, deadlines, contact, scoring
  weights.
- **A draft Master Supply Agreement** (DOCX) — the load-bearing
  document. This is what gets redlined at the end. Include the
  usual asymmetries: one-sided indemnity, broad termination-for-
  convenience by buyer only, capped liability favouring buyer, IP
  ownership grab on jointly-developed materials, late-payment
  interest at statutory min, audit rights, ESG attestation
  requirements, data-protection annex by reference, governing law /
  jurisdiction. Make it ~15–25 clauses, plausibly drafted but with
  visible negotiation hooks.
- **Pricing schedule** (DOCX or PDF) — itemised products with
  ceiling prices, rebate ladders, volume tiers. Doesn't need to be
  accurate; needs to look like a procurement document.
- **Service Level Agreement** (PDF) — delivery windows, OTIF
  targets, penalties for misses, escalation matrix.
- **General Terms & Conditions** (PDF) — the buyer's standard T&Cs,
  often the trap layer. Stack of clauses that conflict with the
  Master Supply Agreement (battle of forms).
- **Compliance annex** (PDF) — modern slavery, anti-bribery, ESG,
  sanctions, data protection — typical for EU/UK procurement.
- *Optional*: a request-for-proposal questionnaire (DOCX) the
  bidder fills in.

The point is plurality and inter-referencing — the agent should
have something genuine to chew through, not a single boilerplate
document. PDFs and DOCXes should be mixed so both
`computercontroller` tools (`pdf_tool`, `docx_tool`) get exercised
+ `oscar-fs__read_file` for any text-format companion.

Upload via the matter's working directory (`~/Documents/Oscar
GC/Commercial/<matter>/`) where oscar-fs is allowed-directories-
scoped per Sprint 12 ADR-040.

### Setup: the RFQ-review playbook

A *general* RFQ-review playbook — not aimed at this specific RFQ.
Markdown file, ~1–2 pages. Should cover the kind of guidance a
senior commercial counsel would give a junior reviewing any RFQ
from any buyer:

- How to triage (cover letter → MSA → T&Cs → annexes).
- The asymmetries to look for (indemnities, liability caps,
  termination-for-convenience, IP grabs, governing law).
- Battle-of-forms framing (which document controls when T&Cs
  conflict with the MSA).
- Procurement-specific risk areas (audit rights, ESG
  attestations, data protection by reference).
- The output format (a redlined draft + a memo to the
  business naming the top-3 walk-away issues).

Save with a descriptive filename — something like
`rfq-review-playbook.md` — so the on-demand block's filename hint
carries weight. **Do not name the buyer or RFQ-specific terms in
the playbook**; that's the point of the test (does the agent
recognise relevance from generic guidance).

Upload via the Playbooks section, scope = global (so it's available
across areas, mirrors real-world reuse). Critical: **do not flip
always-on**. The test is the on-demand discovery path.

### The test flow (lawyer persona)

CC operates Oscar GC as a real in-house lawyer would. Persona: head
of legal at the distribution business, 8–12 years PQE, busy,
expects the agent to do the legwork.

1. **Open the Commercial matter** for this RFQ. Top of Mind loads
   the matter facts; the Playbooks section shows the global RFQ
   playbook (not always-on); the Tools section shows
   `oscar-fs` / `computercontroller` / `Tavily` / `redline (Adeu)`;
   the Skills surface zone shows the enabled Commercial library.
2. **First prompt** (deliberately neutral — *do not name the
   playbook, do not request parallel review*): "We received an RFQ
   from <buyer> for a 3-year supply arrangement. Documents are in
   the matter folder. Review them and give me your read — what
   needs pushback, what's standard, where do we walk away?"
3. **Observe the agent's first move**. Does it:
   - List the matter directory via `oscar-fs__list_directory`?
   - Read the docs via the right tools per filetype?
   - **Notice the on-demand playbook block and consult the
     RFQ-review playbook**?
   - Invoke any named skill from the Commercial library
     (`vendor-agreement-review`, `escalation-flagger`, etc.)?
   - Spawn subagents via `summon` to review documents in parallel?
4. **Collect feedback**. Let the agent produce its first
   substantive response. Capture verbatim.
5. **Two clarifying questions** (lawyer-natural, not testing
   anything specific): something like "What's the exposure if their
   T&Cs override the MSA on indemnities?" and "Walk me through
   your top-3 redline targets and why each matters."
6. **Drop the late document into the matter folder** — a
   plausible "supplementary T&Cs" PDF that "the buyer just sent
   over". Without naming it, prompt: "anything to add given what
   they sent after the first batch?" Observe whether the agent
   lists the directory, finds the new file, and folds it into
   the analysis (or whether it answers blind, confirming the
   no-watcher gap).
7. **Final ask**: "Mark up the Master Supply Agreement with our
   redline based on your analysis. Save it to outputs/." This is
   the Adeu test — does the agent reach for `redline__
   process_document_batch` against the MSA DOCX?

### What to capture (per step)

For each agent turn, capture:
- Which tools it called, in what order, against which paths.
- Whether it referenced the playbook by name in its response or
  reasoning.
- Whether it referenced a skill by name.
- Whether it spawned subagents.
- The substantive response (raw, for human review of *what* it
  said versus *whether* it used the wiring).

### What success looks like

- The agent reads at least the MSA + T&Cs documents via the
  appropriate tools.
- The agent **discovers and reads the RFQ playbook on its own** —
  this is the load-bearing observation. Sprint 29 M6 added the
  discovery block; this is whether the agent actually consults it.
- The agent invokes at least one bundled commercial skill (or
  explains why none fit — the latter is also valid signal).
- The agent reaches for `redline` (Adeu) when asked to mark up
  the MSA, without the lawyer naming the tool.
- *Bonus, not required*: the agent spins one or more subagents for
  parallel document review. Test 2 will tell us more about this.

### What partial-failure looks like (and what it teaches)

- Agent reads docs but never opens the playbook → on-demand block
  isn't compelling enough; Sprint 31 ADR candidate on prompt
  scaffolding for the block.
- Agent reads playbook but never invokes a named skill → skill
  enumeration block isn't compelling enough; same shape of
  follow-up.
- Agent answers the redline prompt by writing a memo rather than
  calling `redline__process_document_batch` → tool discovery gap;
  worth comparing the Tools section copy to what the recipe
  instructions actually say.
- Agent serialises document reads → Test 2 will confirm if that's
  a 1-doc happy path or a structural limitation; the multi-agent
  question lives in Test 2.

---

## Test 2 — 10 NDAs simultaneously

### Setup: the scenario

Same distribution business; counsel receives an NDA pack from 10
prospective customers / partners over a quiet week. Real in-house
counsel triages these in batches. The question is whether the
agent recognises a batch-shaped task and parallelises.

### Setup: the 10 NDAs

10 NDA DOCX files. They should *vary* — some bilateral, some
mutual; some buyer-favourable, some balanced; some with red flags
(indefinite term, no carve-outs for residuals, broad definition of
confidential information catching publicly-known info,
extraterritorial governing law); some clean. Mix of counterparties
(plausible fictional company names — a SaaS vendor, a logistics
partner, a regulator response, a co-bidder, etc.). Don't aim for
realistic legal validity; aim for plausible enough that the agent
treats each as a separate document with distinct issues.

Save under a single matter's working folder, all 10 sibling .docx
files. Name them with the counterparty (e.g., `nda-acme.docx`,
`nda-betacorp.docx`) so filename alone gives the agent a foothold.

### Setup: skill posture

The bundled `nda-review` skill (`commercial-legal` plugin) should
already be in scope. This sprint deliberately does **not** modify
the skill — testing what's already there. Optional: upload an
on-demand NDA-review playbook (separate from the bundled skill) to
double the discovery surface; document the choice in the test
report so we can attribute outcomes.

### The test flow

1. **Open the Commercial matter** for the NDA batch with 6 of
   the 10 NDA files already in the matter folder. The other 4
   stay aside for step 4.
2. **Single prompt** (neutral framing — *do not request parallel
   review, do not name a skill*): "I've dropped the latest NDAs
   in the matter folder from prospective counterparties. Give me
   a per-NDA read on each — GREEN / YELLOW / RED — with the top
   issues for each, so I can decide which ones legal needs to
   touch and which can go straight to sign."
3. **Observe**. Specifically:
   - **Does the agent spawn subagents?** Via `summon` →
     `delegate()` → per-NDA subagent. The hope per Arturs's brief.
     If it does: how many, how scoped, what tools each had.
   - If serial: does it batch-read all 10 first, or read-analyse-
     read-analyse? Either is valid signal.
   - **Does the agent invoke `nda-review` by name?** Either as a
     skill call or as guidance loaded into its own context.
   - **Does the agent read the on-demand playbook** (if uploaded)?
   - **Does the agent enumerate the matter folder via
     `oscar-fs__list_directory` first?** This is the precondition
     for the "+4 added later" observation in step 4.
4. **Drop the remaining 4 NDAs** into the matter folder. Prompt:
   "A few more came in — same triage, please." Observe whether
   the agent re-lists the directory, identifies the new 4 (vs.
   the original 6 it already processed), and avoids re-doing
   work on the originals. This is the no-watcher friction
   measurement: how much overhead is the lawyer carrying
   because the agent isn't notified?
5. **Capture the output**. The agent's per-NDA verdict + the trace
   of how it got there + how cleanly it handled the second wave.
6. **One follow-up**: pick one NDA the agent flagged RED and ask
   "draft a counterparty email walking through our top-3 issues
   on this one." Observe whether the agent writes from the
   subagent's prior work or re-reads the file.

### What success looks like

- Agent processes all 10 NDAs — whether serial or parallel — and
  produces a per-NDA verdict.
- Agent invokes `nda-review` skill (named or paraphrased).
- *The load-bearing observation*: does the agent spin subagents?
  If yes, Sprint 30 has discovered the multi-agent path works for
  Oscar GC's matter-level workflows; that's a major positive
  finding for Sprint 31+ planning. If no, that's also a finding —
  documents what does and doesn't surface naturally to MiniMax.
- For the follow-up: agent answers from prior work rather than
  re-doing it, suggesting the subagent's or summary memory
  carried.

### What failure / partial-success teaches

- Serial-only processing → either MiniMax doesn't reach for
  `summon`, or `summon` isn't surfaced to the matter recipe in a
  way the agent reads. The Sprint 22 Path A ADR (per-recipe MCP
  loadout) is the relevant prior decision; check whether matter
  recipes carry `summon` in their extensions at all.
- Agent treats 10 NDAs as one long document → multi-doc handling
  is the gap; possibly worth a Layer-3 follow-up (the
  10-playbook semantic retrieval question deferred from Sprint 29).
- Agent stops after 2–3 NDAs → context-budget pressure; useful
  evidence for whether matter-level multi-doc tasks need their own
  scaffolding.

---

## Deliverables

- `docs/sprint-30/test-1-rfq/` — report (lead paragraph: did the
  wiring let through; what would Sprint 31 work on), transcript
  extract, tool-call timeline, screenshots, the fixture pack used
  (so the test is reproducible).
- `docs/sprint-30/test-2-ndas/` — same shape.
- `SPRINT_LOG.md` entry + `PROJECT.md` Sprint Index row.
- Findings ADR (most likely numbered 101) covering what the two
  tests proved or disproved about the Sprint 29 M6 wiring + the
  multi-agent question.

## Out of scope

- Fixing whatever Sprint 30 surfaces. This sprint is the
  measurement; Sprint 31 acts on the findings.
- Touching the recipe builder, skill enumeration block, on-demand
  playbook block, or any Sprint 29 ADR. Those are the surfaces
  under test, not the surfaces under change.
- Evaluating MiniMax legal accuracy. Different question, different
  sprint.
- Implementing Sprint 29 M7's multi-chat-per-matter pattern (that's
  Sprint 30+'s *other* candidate; if test scope here exceeds
  budget, multi-chat slips to Sprint 31).
- **Building the matter-folder file-watcher.** Sprint 30 only
  measures the friction caused by its absence (via the late-drop
  steps in both tests). If the friction is high, Sprint 31 picks
  it up — primitives are in place (`fs.watch` already used twice
  in the codebase; Top of Mind re-reads per turn; Sprint 29 M6's
  on-demand block is the precedent shape for "enumerate folder
  contents in the prompt"). The cheapest landing pattern, when
  it lands, is: watch the active matter's working dir, append a
  `## Files in your matter folder` section to
  `tom-active-matter.md` on change, agent sees it on next turn.
  Not in this sprint — observation only.

## Open questions to think deeply about (do not pre-resolve)

- **Parallel vs serial for Test 2**. Arturs's "hope is MiniMax
  will spin multiple agents" is genuinely the load-bearing finding.
  If MiniMax serialises, that's not a failure of the test — it's
  the answer to the test. Do not coach the model toward parallel.
- **Playbook discovery success criterion**. Is it "agent mentions
  the playbook in its reasoning" or "agent reads the playbook file
  via a tool call"? Both are valid signal at different strengths.
  The tool call is the harder evidence; the mention is the softer.
  Capture both.
- **Playbook scope for Test 1**. Global vs Commercial-area-only.
  Brief leaves this open; pick one and document the choice.
- **What "feels real" means for the RFQ pack**. CC should write
  the pack with enough verisimilitude that a lawyer reading it
  wouldn't immediately spot it as a fixture. The asymmetries in
  the MSA are the critical part — without them the redline test
  is hollow.
- **MiniMax temperature / deterministic settings**. Sprint 21+
  partner-recipe code carries reasonable defaults; do not retune
  for this sprint. If reruns produce different findings, that's
  signal about non-determinism, not a failure mode.
- **Cost ceiling per test**. The $10/PCM cap applies. Estimate
  before running, especially for Test 2 (10 docs × possible
  subagents could spike). If Test 2's first run hits 30%+ of
  cap, stop and plan a tighter rerun rather than burning through.
