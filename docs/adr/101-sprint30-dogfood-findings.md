# ADR-101: Sprint 30 dogfood findings — what the wiring let through

Sprint 30 (2026-05-25). Status: Accepted. Cites ADR-099, ADR-086, ADR-092, ADR-063, ADR-020.

## Context

Sprint 30 was a dogfood-only measurement against MiniMax-M2.5 on the
packaged Oscar GC binary, asking whether the wiring landed by Sprint
29 M6 (on-demand playbook discovery — [[ADR-099]]), Sprint 20 M5
(skill enumeration — [[ADR-086]]), Sprint 28 (Tools section —
[[ADR-092]]), and Sprint 18 (default-on `summon` — [[ADR-063]]) was
actually being used by the agent. Two tests: (1) RFQ pack review +
redline, Commercial / distribution business; (2) 10 NDA batch
triage. Full reports at `docs/sprint-30/test-1-rfq/` and
`docs/sprint-30/test-2-ndas/`.

## Findings

1. **On-demand playbook block (ADR-099) is open but unused.** In both
   tests the agent saw the playbook enumerated by name in its
   instructions and did not read it. Two-data-point confirmation that
   enumeration alone is not a strong enough signal.
2. **Bundled skill enumeration (ADR-086) is open but unused.** Same
   shape. The agent never invoked `load_skill` against any
   `commercial-legal` skill (no `nda-review`, no
   `vendor-agreement-review`, no `escalation-flagger`) despite slugs
   being listed.
3. **Multi-agent / `summon` (ADR-063) is open but unused.** The
   load-bearing Test 2 question — "the hope is MiniMax will spin
   multiple agents" — resolves to **no**. MiniMax processes
   batch-shaped document review serially even when `delegate` is
   present and the workload is obviously parallelisable.
4. **Tool surfaces are used appropriately when described well.** The
   redline tools have a rich system-prompt description ("Always read
   before you redline") and the agent picked them up (12 reads in
   Test 2 wave 1). When the agent reached for redline on Test 1's
   redline ask, it constructed a valid 7-change batch (deploy gap on
   the zip build masked the tool path).
5. **Late-document drop is handled cleanly.** When asked vaguely
   about "what they sent after the first batch", the agent re-lists
   the directory unprompted, identifies the new files, and weaves
   them into the analysis. Sprint 14 matter-folder-watcher gap does
   not warrant work in Sprint 31.
6. **Per-session memory carries.** Test 2 Turn 3 (counterparty email
   on a RED NDA) was drafted from prior analysis without re-reading
   the file. Works as designed.
7. **Zip-build deploy gap.** `prepare-oscar-bundle.js` does not create
   the adeu venv; the .deb's postinst does. Sprint 30 surfaced this
   on the first redline call (-32002 tool not found). Remediated
   manually mid-sprint to validate the redline path.
8. **`developer` extension is exposed** in matter sessions despite
   Sprint 18 ADR-063 default-off doctrine for in-house lawyers.
   Recipe carries `developer` with `write/edit/shell/tree/load`
   tools. Agent used `write` in Test 2 Turn 3. Doctrine violation
   worth investigating in Sprint 31.

## Sprint 31 candidates (in priority order)

A. **Investigate `developer` exposure** (item 8). Either the Sprint
   18 filter never took effect for this binary build, or
   `config.extensionsList` carries developer in a way the renderer
   filter doesn't catch. Smallest possible scope; high-trust
   doctrine issue.

B. **Sharpen the on-demand-playbook + skill-enumeration discovery
   signals** (items 1+2). Enumeration alone is too soft. Candidate
   shapes: (i) inline a "If a playbook matching your task exists,
   read it before forming your analysis" sentence into the block;
   (ii) auto-promote one matching-named playbook to always-on at
   matter-open time; (iii) fold the top-3 most-relevant bundled
   skills' bodies into the recipe instructions as Layer 1.

C. **Re-scope the Sprint 9 "always read before you redline"
   doctrine** (Test 2 efficiency finding). Test 2 read each NDA
   twice (outline + full) on wave 1 because the redline-intent
   guidance bled into a triage task. Either condition on intent or
   drop the double-read.

D. **Zip-build venv parity** (item 7). Add `pip install adeu` step
   to `prepare-oscar-bundle.js` mirroring the .deb postinst, so the
   zip binary works first-time for dogfood.

E. **Multi-agent uptake** (item 3). Probe whether explicit prompting
   ("delegate this to N subagents") drives `delegate` use. If yes,
   the gap is "no proactive uptake on parallelisable tasks" — could
   be addressed by a hint in the recipe instructions. If no, the
   gap is structural and `summon` is not load-bearing for matter
   workflows.

## Out of scope (per Sprint 30 brief)

Fixing any of the above is Sprint 31's call, not Sprint 30's.
This ADR records the measurement.

Cites: [[ADR-020]], [[ADR-063]], [[ADR-086]], [[ADR-092]], [[ADR-099]].
