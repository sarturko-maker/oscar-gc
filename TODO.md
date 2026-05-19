# Backlog — items carried forward from prior sprints

Append-only. Format: `- **Topic** (origin sprint, optional target sprint) — one-line description.` Move to `SPRINT_LOG.md` when picked up.

## Sprint 15 — shipped Stage 1 + Stage 2 dogfood on Crostini; carry-forwards → Sprint 16

Shipped P2–P8 incl. two live eval iterations and Crostini dogfood (`fb3084eb7`, `1af9386` sibling, `6f22b070a`, `d7af52def`, `79cd2e46d`, `2ba97d1e4`, `fc5e756eb`, `36db132b5`, `98cc2f73b`); release `oscar-gc-sprint15`; five ADRs (050–054). Iter-2 aggregate: coverage 4.50 PASS, efficiency 4.80 PASS, downstream-briefing 2.92 FAIL (target 4.0; +0.34 vs iter-1).

Stage 2 dogfood (2026-05-19, Arturs, Crostini, Sprint 15 .deb) — intake rule-set works in the wild: greeting matches Sprint 15, P2.5 beats in correct order (industry → geography → regulatory hypothesis → recurring matters + stakeholders → risk → practice areas → P3.5 → open question). Sprint 15-iter-2 prompt fixes were in the build.

Stage 2 dogfood findings:

- **P1 — Sprint 16 anchor: GUI key-entry surface for Tavily and MiniMax** — Arturs verbatim: *"No one is going to use terminal. I should be asked for my provider key and Tavily key. Then I should go to interview."* Sprint 15 deferred Tavily Settings UI per ADR-052 and relied on terminal env-var setting (INSTALL_CROSTINI.md). For in-house lawyer audience this inverts the wrong way. Sprint 16 must ship: (a) Tavily key dialog before intake (modal or first-beat of onboarding); (b) MiniMax key dialog for users without a prior Goose install (Goose's stock dialog covers most cases but lawyer-audience copy is generic). Decide A/B/C: dialog-before-intake / step-inside-intake / Settings-only. Recommend dialog-before-intake — minimum keystrokes, no shell.
- **P2 — Recap echo cosmetic bug** — observed in Arturs's transcript: agent said *"Head of EMEA legal reports to the Head of EMEA Legal, balanced risk appetite"* — copula collapse when echoing back the user's `reports_to` answer. Captures correctly to `stakeholders.reports_to`; just the prose echo is garbled. Prompt polish ("state the field once, not as a copula").
- **P3 — Tavily silently absent vs visibly absent** — user couldn't tell whether web-search fired or not. Rule 4's silent fallback is by design but leaves no diagnostic. Two options for Sprint 16: (a) a visible-to-user provenance line in the regulatory hypothesis ("from web + my own knowledge" / "from my own knowledge"); (b) post-finalize Settings page shows current Tavily status. Lean (a) — in-conversation transparency.
- **P4 — MiniMax slower than ideal** — Goose's default platform extensions (analyze/apps/developer/skills/extensionmanager) load by default; needed for tool-call wiring (verified P6 — `--no-profile` breaks tool calls). Per-turn input-token weight is ~15k. Sprint 16 candidate: surgical disabling of unused platform extensions via the recipe's extensions list rather than blanket `--no-profile`.
- **Iter-3+ practice-area prompt tightening (Sprint 15 carry, target Sprint 16 contingent on Stage 2)** — three open levers documented in `docs/sprint-15/self-assessment.md`: force-cite-≥2-dimensions; inject company_context into user message; trim goose default extensions (replacement, not blanket removal — `--no-profile` breaks tool calls). Each has second-order risk.
- **Judge robustness (Sprint 15 carry, target Sprint 16)** — Priya's iter-2 efficiency returned prose-only rationale (orchestrator parse-failure fallback returned null); need stricter judge prompt or score-coercion step.
- **Quiet Lawyer scoring rubric refinement (Sprint 15 carry, target Sprint 16)** — downstream-briefing axis penalises generic answers but persona declines specifics; consider excluding from downstream mean or scoring as separate "null-handling fidelity" axis.
- **Settings UI for Tavily + MiniMax key entry (Sprint 15 carry, ADR-052 deferral, target Sprint 16)** — minimal row in Oscar's existing Settings surface writing `~/.config/oscar/secrets/{tavily,minimax}.json` (0600). Dev/CC/Arturs paths use env or pre-populated file; end-user affordance for broader dogfood.

## Sprint 14 — shipped, see SPRINT_LOG.md

Closed by Sprint 14 (commits `214bc10e6` Unit 1 + `0ebe0d238` Unit 2):
- Per-area NewMatterDialog (P2-B, P2-E) — ADR-047 schema v2 + practiceAreaShapes.ts + config-driven dialog.
- Matter-list re-access (P2-C) — MatterBackButton wraps existing BackButton, mounted in BaseChat.
- Higher-level grouping (P2-D) — stakeholder tag-and-group via case-insensitive header in MattersLanding.
- Forge sidebar alignment (P2-A) — 56px Menu-trigger clearance moved from list to header.
- Bundled-MCP spawn-boot smoke test (P0-A lesson) — ADR-049 smokeTestBundledMcps in prepare-oscar-bundle.js.

## Sprint 15 candidates (anchor decisions)

- **Adeu MCP App diff preview** (Sprint 12 plan deferral; unblocked by Sprint 13 ADR-045; Sprint 14 plan-mode design captured at `/root/.claude/plans/brief-sprint-14-immutable-diffie.md` §"5. Adeu MCP App diff preview" — deferred from Sprint 14 due to scope reality). Bounded work: author `docs/redline/adeu-1.6.9-redline-preview-ui.patch` adding `commit: bool = False` to `process_document_batch` + new `commit_document_batch` tool + new `redline_preview_ui` Jinja resource (mirrors existing `markdown_ui.py` pattern adeu already ships); wire postinst.sh + prepare-oscar-bundle.js; add `commit_document_batch` to `commercialRecipe.ts` available_tools; reserved ADR-048. Brief-vs-reality flag from Sprint 14 plan-mode: the `goose-cowork-comparison` / gotoHuman cowork pattern reference doesn't exist in the codebase — design grounded in adeu's existing native MCP-Apps implementation instead.
- **Audit-log infrastructure** (Sprint 12, ADR-043 hand-off) — `privileged: boolean` is the load-bearing field; audit log reads it, agents don't condition on it. Log shape, retention, integrity-verification surface need an ADR.
- **SECURITY.md / threat-model writeup** (Sprint 12 plan deferral) — formalises what ADRs 029/042 imply. Targets in-house lawyer audience.
- **Bespoke Commercial Disputes recipe** (Sprint 12 plan deferral) — Sprint 12 ships Disputes via the generic builder (oscar-fs only). Need decision: redline-like tool for disputes work, or different substantive scope?
- **"## Matter workspaces" boilerplate cleanup** (Sprint 12 Phase 6 deferral) — 48 substantive bundled skills carry rotted Sprint-11-stub-era prose. Top of Mind injection compensates behaviourally, but a clean orchestrator pass updates the boilerplate to assume always-on matter mode for in-house.
- **Per-plugin state-file references in 16 skills** (Sprint 12 Phase 6 deferral) — references to `~/.config/oscar/state/<plugin>/matters/_log.yaml`, `gap-tracker.yaml`, `comment-tracker.yaml` etc. These are practice-level (not matter-scoped) state files. Decide: implement the state files, or rewrite the skills.
- **Sprint 9 P1/P2 commercial system-prompt polish — partially closed by Sprint 13** (Sprint 9 carry) — Markdown emphasis discipline still relies on the existing "Things you never do" rule (Sprint 9 baseline); defined-term capitalisation + Clause 8 mutuality reminder remain open. Sprint 13's preserve discipline (ADR-046) is the structural pickup; the specific defined-term + mutuality polish is unaddressed.
- **Pre-Sprint-12 session migration** (Sprint 12 plan deferral) — only if Arturs's pre-Sprint-12 dogfood sessions need surfacing as matters. Explicit non-goal in Sprint 12.
- **adeu upstream PR follow-through** (Sprint 13 ADR-045 deletion criterion) — file the word-diff-on-batch-path change against adeu's repo, recommending an opt-in `granularity: 'word' | 'span'` parameter. When merged + released, repin `ADEU_VERSION` in `prepare-oscar-bundle.js`, delete the patch-copy/apply steps + the `.patch` file.
- **TypeScript `window.electron` type drift cleanup** (Sprint 13 incidental finding — partially closed Sprint 14) — Sprint 14 removed the shadow `declare global` in `useMatters.ts` that was hiding the canonical preload `ElectronAPI` shape, and typed the matters IPC return values properly. `pnpm exec tsc --noEmit` is now clean. The drift was self-inflicted by useMatters.ts redeclaring `window.electron` as a sub-type; preload.ts is now the single source of truth. Closed.

## Sprint 15+ candidates

- **Anthropic claude-for-legal managed-agent-cookbooks** (Sprint 11 deferral) — scheduled background agents. Re-vendoring pattern from Sprint 11 likely applies.
- **Multi-provider Inference Gateway** (Sprint 12 plan deferral) — when Oscar GC goes beyond MiniMax. LQ-AI gateway pattern banked.
- **Per-area kind vocabulary sanity-check** (Sprint 14 plan-mode open item) — `practiceAreaShapes.ts` ships best-guesses for the 13 area kind enums. Phase 7 dogfood is where Arturs reviews each list and we iterate. Config-only edits — no schema change.
- **Counterparty role list refinement per area** (Sprint 14 plan-mode open item) — likewise; the 6-role Commercial set, the 4-role Disputes set, etc. are first-draft.
- **Privileged-by-default kinds confirmation** (Sprint 14 plan-mode open item) — Sprint 14 defaults `privileged: true` for grievance/investigation/disciplinary/exit, breach, regulator inquiry, FTO opinions, all `-disputes` areas. Confirm during dogfood.
- **First-class stakeholder entity** (Sprint 14 plan-mode deferral) — Sprint 14 ships tag-and-group; promote to first-class entity with profile document if the stakeholder-level memory ("Acme is high-risk; always escalate") becomes load-bearing across multi-matter stakeholder relationships.

## Sprint 15+ structural revisits

- **bubblewrap / OS-level sandboxing** (Sprint 12 ADR-042 deferral) — load-bearing only when community-tier user-installed skills land. Upstream Goose Sandbox is macOS-only; Linux Crostini needs bubblewrap or network namespaces. The two-tier defense (filesystem MCP scope + audit) holds today.
- **GOOSE_ALLOWLIST per-user extension mechanism** (Sprint 12 ADR-042) — exact-string matching with no wildcards creates a structural wall against community-tier MCP installs. Three paths: (a) ship a new allowlist with each release, (b) extend upstream allowlist with per-user additions (upstream PR), (c) replace with Oscar-side allowlist on top.
- **Multi-window per-matter Top of Mind** (Sprint 12 ADR-044) — `tom-active-matter.md` is single-active-state. If multi-window with different matters per window is needed, switch to per-session-id file paths.
- **ADR-029 migration to `recipe.metadata.bundled` flag** (Sprint 10 close-out) — community recipes open up in Sprint 15+; the title-prefix short-circuit is no longer sufficient. Requires extending the Recipe schema (`crates/goose/src/recipe/mod.rs`) and updating both BaseChat and preload.
- **Future claude-for-legal re-vendoring** (Sprint 11 carry) — Anthropic ships new content → re-run the Sprint 11 per-plugin agent dispatch + orchestrator pass. MANIFESTs become regression baselines.

## Branding follow-ups (PROJECT.md anchors)

- **`goose://` URL scheme rebrand** (Sprint 2 deferral) — atomic rename `goose://` → `oscar-gc://` per ADR-003 across `forge.config.ts` schemes + `.desktop` MimeType + every `src/` consumer in one commit. Bundles the `OnboardingGuard` "Welcome to goose" string.
- **`document.title` runtime overwrite** (Sprint 2 deferral) — `index.html` sets `<title>Oscar GC</title>` but React resets to "Goose" after first render. `grep -r "document.title" ui/desktop/src/` for call sites.
- **System prompt self-identification** (Sprint 2 deferral) — `crates/goose/src/prompts/system.md` introduces the agent as Goose. First Rust-touch sprint; merits an ADR.
- **App-icon raster pipeline** (Sprint 10 BACKLOG) — `ui/desktop/src/images/` icons are still Goose's. Needs Oscar GC visual identity work first.
- **`ui/desktop/scripts/goosey`** (Sprint 2 deferral) — invokes `goose-app` on PATH (no longer exists under the new brand); plus `ui/desktop/package.json` macOS bundle scripts default `${GOOSE_BUNDLE_NAME:-Goose}`. Defer until the first Linux PATH installer (.deb/.rpm) ships.

## Sprint 10 BACKLOG (still open)

- **Top-right Goose mascot round 2** (Sprint 10 BACKLOG) — direct Goose imports at `BaseChat.tsx:411`, `SessionsInsights.tsx:155,248`, `OnboardingGuard.tsx:157,190`.
- **Settings telemetry toggle audit** (Sprint 10 BACKLOG) — confirm no telemetry slipped past ADR-028's strict-no-prompt posture.
- **postinst orphan-on-uninstall** (Sprint 10 BACKLOG) — `scripts/postinst.sh` and Debian uninstall hook leave files behind.
- **commercial-chat-doesn't-load-on-click regression** (Sprint 10 BACKLOG) — surfaced in Sprint 10 dogfood; Sprint 12 PracticeAreaPlaceholder rewrite may have resolved this incidentally — verify on next dogfood.
- **MCP tool-call cards too large** (Sprint 10 BACKLOG) — chat-view UI tweak.
- **`oscar-memory` recipe wiring** (Sprint 10 BACKLOG) — bundled but not wired into the Commercial recipe. Sprint 12 left this open; pick up alongside the substantive Commercial Disputes recipe.

## Sprint dogfood + pilot observations (placeholder)

- Empty until Sprint 12 dogfood adds entries.
