# Backlog — items carried forward from prior sprints

Append-only. Format: `- **Topic** (origin sprint, optional target sprint) — one-line description.` Move to `SPRINT_LOG.md` when picked up.

## Sprint 14 candidates (anchor decisions)

- **Audit-log infrastructure** (Sprint 12, ADR-043 hand-off) — `privileged: boolean` is the load-bearing field; audit log reads it, agents don't condition on it. Log shape, retention, integrity-verification surface need an ADR.
- **SECURITY.md / threat-model writeup** (Sprint 12 plan deferral) — formalises what ADRs 029/042 imply. Targets in-house lawyer audience.
- **Adeu MCP App diff preview** (Sprint 12 plan deferral; **unblocked by Sprint 13 ADR-045**) — render proposed redlines in chat with Apply/Edit/Reject affordances; disk write happens on Apply, not on tool execute. Per `goose-cowork-comparison` gotoHuman pattern. Now that adeu produces word-shape OOXML, the diff-preview pattern is meaningful — pre-Sprint-13 wholesale wraps would have made review unusable.
- **Bespoke Commercial Disputes recipe** (Sprint 12 plan deferral) — Sprint 12 ships Disputes via the generic builder (oscar-fs only). Need decision: redline-like tool for disputes work, or different substantive scope?
- **"## Matter workspaces" boilerplate cleanup** (Sprint 12 Phase 6 deferral) — 48 substantive bundled skills carry rotted Sprint-11-stub-era prose. Top of Mind injection compensates behaviourally, but a clean orchestrator pass updates the boilerplate to assume always-on matter mode for in-house.
- **Per-plugin state-file references in 16 skills** (Sprint 12 Phase 6 deferral) — references to `~/.config/oscar/state/<plugin>/matters/_log.yaml`, `gap-tracker.yaml`, `comment-tracker.yaml` etc. These are practice-level (not matter-scoped) state files. Decide: implement the state files, or rewrite the skills.
- **Sprint 9 P1/P2 commercial system-prompt polish — partially closed by Sprint 13** (Sprint 9 carry) — Markdown emphasis discipline still relies on the existing "Things you never do" rule (Sprint 9 baseline); defined-term capitalisation + Clause 8 mutuality reminder remain open. Sprint 13's preserve discipline (ADR-046) is the structural pickup; the specific defined-term + mutuality polish is unaddressed.
- **Pre-Sprint-12 session migration** (Sprint 12 plan deferral) — only if Arturs's pre-Sprint-12 dogfood sessions need surfacing as matters. Explicit non-goal in Sprint 12.
- **adeu upstream PR follow-through** (Sprint 13 ADR-045 deletion criterion) — file the word-diff-on-batch-path change against adeu's repo, recommending an opt-in `granularity: 'word' | 'span'` parameter. When merged + released, repin `ADEU_VERSION` in `prepare-oscar-bundle.js`, delete the patch-copy/apply steps + the `.patch` file.
- **TypeScript `window.electron` type drift cleanup** (Sprint 13 incidental finding) — `pnpm run typecheck` surfaces 202 pre-existing TS errors caused by partial type override of `window.electron` since Sprint 12's matters IPC work. Properties like `startMesh`, `stopMesh`, `getSetting`, `setSetting`, `openExternal`, `getPathForFile`, etc. exist on the runtime object but are missing from the type def. Run lint cleanly before next Sprint touches preload.ts.

## Sprint 15 candidates

- **Anthropic claude-for-legal managed-agent-cookbooks** (Sprint 11 deferral) — scheduled background agents. Re-vendoring pattern from Sprint 11 likely applies.
- **Multi-provider Inference Gateway** (Sprint 12 plan deferral) — when Oscar GC goes beyond MiniMax. LQ-AI gateway pattern banked.

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
