# Backlog — items carried forward from prior sprints

Append-only. Format: `- **Topic** (origin sprint, optional target sprint) — one-line description.` Move to `SPRINT_LOG.md` when picked up.

## Sprint 17b — closed on code 2026-05-20; lawyer-dogfood validation continues

Three patch commits on top of Sprint 17: `46642a0c9` (pnpm-workspace overrides), `9845e4f37` (Vite resolve.dedupe — true root cause of the useRef crash), `3209ebb5d` (paid-wrapper visible-only + dropdown filtered to user areas, from Crostini dogfood findings F1+F2).

Sprint 17b dogfood findings + status:

- **F1 — Paid-wrapper OAuth (closed in 17b via visible-only state)**. Real underlying carry below.
- **F2 — Top-level dropdown filter (closed in 17b)**. Dropdown now reads `usePracticeAreas()` × entry's `relevant_areas`.
- **F3 — Tavily silent during intake (open, carries to Sprint 18)**. Confirmed extension loads and exposes tools (`grep -c tavily ~/.local/state/goose/logs/llm_request.N.jsonl` = 1 each). MiniMax-M2.5's tool-choice. Same prompt lever as Sprint 16's open carry: "force-cite ≥2 dimensions" in `docs/sprint-15/self-assessment.md`.

Sprint 17/17b carry-forwards still open (target Sprint 18+ unless noted):

- **Lawyer-dogfood E1/E3/E4/E5 validation against Sprint 17b3 .deb** (Sprint 17b → ongoing) — E1 visible-subset confirmation, E3 dropdown filter visible confirmation, E4 CourtListener/Slack/GDrive Add → matter open works end-to-end (CourtListener is the safest first test — free public-data MCP, no OAuth), E5 honest-labelling qualitative gate. .deb is on the draft release; Arturs continues on own cadence.
- **Real MCP-OAuth client registration with SaaS vendors** (Sprint 17b F1 root cause, target Sprint 18+) — without a trusted client_id, `requires-paid-subscription` entries (Ironclad, DocuSign) stay visible-only. Paths: register Goose's MCP-OAuth client with each vendor's developer programme; ship per-vendor user-runs-this-script auth; or accept proprietary wrappers stay catalog-only until the user brings their own credentials. Each path is itself a Sprint-sized piece of work.
- **Tavily silence (Sprint 16 → 16b → 17b → 18)** — prompt lever "force-cite ≥2 dimensions". Has second-order risk (oversteer hypothesis), needs iter-3 eval against the Sprint 16b regulatory-fit axis. Sprint 18 candidate.
- **pnpm 11 hoisted-linker fragility** (Sprint 17b open) — Vite `resolve.dedupe` is the surgical fix in `vite.renderer.config.mts` for React + react-dom + jsx-runtime. Other peer-dep-style packages we add later could trip the same bundle-twice issue. Worth a Sprint 18+ check whether to force `node-linker=isolated` in `.npmrc` for deterministic single-copy resolution across the workspace.
- **`llm_request.2.jsonl` permission-denied** (Sprint 17b minor finding) — one rotating goose-server log file landed with ownership that locked Arturs's shell out. Investigate if it recurs.
- **OpenContracts / Open Legal Compliance MCP / US Legal MCP** (Sprint 17 brief, deferred) — zero references in `/srv/projects/goose`. Sprint 18+ candidates pending hand-verified metadata (license, URL, security posture). Adding them is a one-line edit to `INTEGRATIONS_OVERLAY`.
- **Removal / round-2 / edit flow for installed integrations** (Sprint 17, target Sprint 18) — schema supports the array shape; the UI's `Installed` button is non-interactive. Sprint 18 adds `oscar:integrations:uninstall` IPC + remove-button UX.
- **Multi-area Add in one click** (Sprint 17, target Sprint 18) — top-level Integrations target dropdown is single-area. Sprint 18+ "apply to all" / "apply to these areas" affordance.
- **`requires-account` community-tier auth UX** (Sprint 17b refinement, target Sprint 18) — Slack/Google Drive stay installable in 17b, but their OAuth flows haven't been end-to-end tested. If they also fail with the goose-docs.ai client_id mismatch, may need to drop them to visible-only too. Untested at sprint close.
- **Real-time `maintenance_signal`** (Sprint 17, target Sprint 18+) — overlay's `maintenance_signal.last_updated_iso` is a hand-stub. Populating from GitHub readmes / service status pages is automation work.
- **Chat-driven Add via a Forge MCP tool** (Sprint 17, target Sprint 18+) — IPC `oscar:integrations:install` is in place; Sprint 18+ optional layer wraps it as a tool the Forge agent calls.
- **Settings UI for Tavily-key rotation** (Sprint 16 carry, target Sprint 18) — small surface; `RecipeSecretsModal` is entry-only.
- **Platform-extension trim** (Sprint 16 carry, conditional on iter-3 numbers from Sprint 16b) — still conditional.
- **Upstream PR for ADR-058's secret_discovery generalisation** (Sprint 16 carry, target Sprint 18) — small standalone work.
- **bubblewrap / OS-level sandboxing** (Sprint 12 ADR-042, Sprint 17 ADR-062 reaffirms) — community-tier Integrations installs widen runtime egress under recorded consent; bubblewrap becomes more load-bearing in proportion to community-tier usage.

## Sprint 17 — shipped on code; superseded by Sprint 17b

Shipped P0–P6 on `main` (commits `dc0125f05`, `7f5696e0d`, `7058aadc1`, `65ad7f1a4`, `c6b239b31`, `a20333606`, `4bbf11c8e`); four ADRs (059, 060, 061, 062 — amends 042). Integrations surface live: per-area filtered tab + top-level sidebar entry. 6-entry seed (oscar-fs / CourtListener / Slack / Google Drive / Ironclad / DocuSign). RecipeSecretsModal gate generalised for the per-matter spawn path. Crostini dogfood + bug-fixing folded into Sprint 17b above.

## Sprint 15 — shipped Stage 1 + Stage 2 dogfood on Crostini; carry-forwards → Sprint 16

Shipped P2–P8 incl. two live eval iterations and Crostini dogfood (`fb3084eb7`, `1af9386` sibling, `6f22b070a`, `d7af52def`, `79cd2e46d`, `2ba97d1e4`, `fc5e756eb`, `36db132b5`, `98cc2f73b`); release `oscar-gc-sprint15`; five ADRs (050–054). Iter-2 aggregate: coverage 4.50 PASS, efficiency 4.80 PASS, downstream-briefing 2.92 FAIL (target 4.0; +0.34 vs iter-1).

Stage 2 dogfood (2026-05-19, Arturs, Crostini, Sprint 15 .deb) — intake rule-set works in the wild: greeting matches Sprint 15, P2.5 beats in correct order (industry → geography → regulatory hypothesis → recurring matters + stakeholders → risk → practice areas → P3.5 → open question). Sprint 15-iter-2 prompt fixes were in the build.

Stage 2 dogfood findings (correction after Arturs's follow-up):

- **P1 (anchor 1) — Reorder rule-set: practice areas BEFORE regulatory hypothesis.** Arturs verbatim: *"The logic is backwards, company profile, practice areas => search for regulations based on jurisdictions and profiles - think this through logically."* Sprint 15's P2.5c puts regulatory hypothesis at turn ~5, before practice areas (P3 at turn ~7). Without practice-area scope, MiniMax defaults to its most-trained-on EU regs — privacy law (GDPR/UK GDPR/Irish DPA/BDSG/DSA). For Arturs's industrial-cable-distribution persona, the actually-load-bearing regs (REACH, RoHS, WEEE, UKCA/CE marking, Modern Slavery Act, Late Payment Act, post-Brexit customs) didn't appear. Correct sequence: identity → industry/size → geography → **practice areas** → regulatory hypothesis (scoped by industry × geography × practice areas) → recurring matters + stakeholders → risk → P3.5 drilldown → open question → wrap. Touches `systemPrompt.ts` ordering + the eval rubric (coverage axis should reward industry-specific regs, not just count of frameworks).

- **P2 (anchor 2) — Wire Tavily through Goose's existing key surface; do NOT build a bespoke Oscar modal.** Arturs verbatim: *"Why a new dialog ... if this is already part of Goose? Goose already manages keys as a platform?"* Sprint 15's ADR-052 deferred a Settings UI; my response had drifted to "modal-before-intake" which would have duplicated Goose's plumbing. Correct path: declare Tavily as a proper Goose extension with `env_keys: ["TAVILY_API_KEY"]`; let Goose's stock missing-extension-key flow handle the prompt (same surface that handled MiniMax on Arturs's Sprint 10 first launch). Amends ADR-052. Zero new Oscar UI; two-line recipe wiring change.

- **P3 — Recap echo cosmetic bug** — observed: agent said *"Head of EMEA legal reports to the Head of EMEA Legal, balanced risk appetite"* — copula collapse when echoing back the user's `reports_to` answer. Captures correctly to `stakeholders.reports_to`; only the prose echo is garbled. Prompt polish ("state the field once, not as a copula").

- **P4 — Tavily silently absent vs visibly absent** — Arturs couldn't tell whether web-search fired. Rule 4's silent fallback is by design but leaves no diagnostic. Add a visible provenance suffix on the regulatory hypothesis line: *"(from web + my own knowledge)"* if Tavily fired, *"(from my own knowledge)"* if not. In-conversation transparency.

- **P5 — MiniMax slower than ideal** — Goose's default platform extensions load by default; needed for tool-call wiring (verified P6). Per-turn input-token weight ~15k. Surgically disable unused platform extensions via the recipe's extensions list rather than blanket `--no-profile`.
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
