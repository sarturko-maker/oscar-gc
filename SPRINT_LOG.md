# Sprint Log — [Goose]

Append-only. Most recent at the top. Every sprint closes with an entry covering: goal, what was built, what was deferred, carry-forwards. PROJECT.md's Sprint Index points back here.

## Entry template

### Sprint N — <short title> (closed YYYY-MM-DD, commit <sha>)

**Goal**: what we set out to do.
**Built**: what landed. File paths + key decisions.
**Deferred**: scope cut during execution.
**Carry-forwards**: things the next sprint should pick up.
**ADRs**: NNN, NNN.

---

### Sprint 19 — Chat history + memory: PA → Matter/Programme → Session, plus unscoped Quick chats (closed 2026-05-20 on code; commits `a1776aabb`, `fce0b8590`, `d38e3e9b3`, `2edbfaaf0`, `a6226ba89`, this commit)

**Goal**: two parallel chat-entry paths plus minimum sidebar hierarchy — matter-scoped (open practice area → matters/programmes → bound session) and unscoped quick-chat from any view (one click). Sidebar replaces its flat practice-area list with a PA → Matter → Session tree plus a Quick chats sibling group. Vocabulary tuned per area: Privacy / Regulatory / AI Governance read as "Programmes"; the other 10 stay "Matters". Lean on Goose's native primitives — sessions in `sessions.db`, Memory MCP's lazy `.goose/memory/` creation, Top of Mind's empty-file no-injection. No Rust core touch, no schema additions. Plan at `/root/.claude/plans/sprint-chat-history-memoized-hummingbird.md`.

**Built** — five commits on `main`, one ADR at decision time:

- **Phase 0 — ADR-066** (`a1776aabb`) — `docs/adr/066-quick-chat-and-sidebar-grouping.md`. Three coupled decisions captured before any code: D1 unscoped working_dir = `~/Documents/Oscar GC/.quick-chats/` (dot-hidden, same volume as matters; Memory MCP's lazy creation makes the dir safe); D2 sidebar grouped tree (Quick chats group + always-rendered practice areas with active-area auto-expand); D3 quick-chat button at sidebar header + Hub home; D4 `entryNoun: { singular, plural }` additive field on `PracticeAreaShape`.

- **Phase 1 — Per-area entry noun** (`fce0b8590`) — `practiceAreaShapes.ts` gains `EntryNoun` interface + `MATTER_NOUN` / `PROGRAMME_NOUN` consts; `PracticeAreaShape.entryNoun` is required (TS catches new areas without a noun). 13-area assignment per D4: Privacy / Regulatory / AI Governance → Programme; other 10 (including all four Disputes per Arturs's framing) → Matter. Privacy + Regulatory `kind.label` updated to "Programme type" (from "Matter kind"); AI Governance keeps "Workstream" (area-natural). Threaded through `MattersLanding` (title, "New X" button, empty/loading copy, modal-shape-error path) and `NewMatterDialog` (modal title, privileged label/hint, submit button, error message).

- **Phase 2 — Quick-chat entry path** (`d38e3e9b3`) — `OSCAR_QUICK_CHATS_DIR = path.join(OSCAR_DOCUMENTS_DIR, '.quick-chats')` in `main.ts`. Two new IPCs: `oscar:quick-chats:ensure-dir` (idempotent `fs.mkdir({recursive: true})`, returns absolute path) and `oscar:quick-chats:get-dir` (pure getter for renderer filtering). Exposed via preload as `window.electron.quickChats.{ensureDir,getDir}`. New `QuickChatButton` component with `variant: 'sidebar' | 'hub'`. Onclick path: `matters.detachActive()` (truncate Top of Mind per ADR-044) → `quickChats.ensureDir()` → `createSession(quickChatsDir)` with **no recipe** (server resolves extensions from `config.yaml` enabled set per `extensions.rs:125-143`, so the lawyer's full Sprint 18 permissive-default loadout is on) → dispatch `ADD_ACTIVE_SESSION` → navigate to `/pair?resumeSessionId=...`. Sidebar header gets "+ New chat" above Forge; Hub home gets a "Start a quick chat" CTA below the subtitle (Hub had zero action buttons before). Small CSS for button reset (`.oscar__sidebar-item--quickchat`) and Hub action spacing.

- **Phase 3 — Sidebar chat-history tree** (`2edbfaaf0`) — `useChatHistory` hook joins three data sources in parallel: `listSessions({throwOnError:false})` + `quickChats.getDir()` + `matters.list(areaId)` × N (N = user's curated practice-area count). Partitions sessions into a Quick-chats group (working_dir starts with `.quick-chats/`) and per-area matter rows (joined via `matters.json[slug].session_id`). Subscribes to `SESSION_CREATED / DELETED / RENAMED / FORKED` events to refresh the tree live. `ChatHistoryTree` component renders the grouped view: Quick chats group sits above the always-rendered practice-areas group; active practice area auto-expands its matters (others stay collapsed). Click handlers: area row → `/practice/:areaId`; matter row → `matters.setActive` (repopulates ToM per ADR-044) + dispatch `ADD_ACTIVE_SESSION` + navigate to `/pair`; matter row with no session → navigate to `/practice/:areaId` (fall-through); session row (quick-chats group only) → dispatch + navigate (no ToM to restore). `OscarSidebar` swaps its flat practice-area list for `<ChatHistoryTree />`; header (QuickChat + Forge + Integrations) and footer (Settings) unchanged.

- **Phase 4 — Forge create-area noun hook** (`a6226ba89`) — `forge/systemPrompt.ts` gains one interview question in Mode B (create practice area): "Does this area's work read more naturally as Matters (case-shaped, transactional) or Programmes (ongoing, regulator-named)?" Default Matter when uncertain. The captured noun is persisted on the `practice_areas` entry in `profile.json` as `entry_noun: { singular, plural }`. Captured-but-inert today (user-added areas still fall through MattersLanding's no-shape branch — a follow-up sprint reads this field when wiring shape-from-profile for user-added areas).

**Verification** (in this session):
- `pnpm exec tsc --noEmit` on `ui/desktop`: clean after every phase.
- Brief-vs-reality drift check resolved: "Sessions in this matter" view is moot today (`matters.json[slug].session_id` is single-valued per ADR-038); sidebar PA → Matter → Session navigation is the actual deliverable. "Compliance" in the brief = "Regulatory" in Oscar's 13-area set.
- Memory MCP behaviour confirmed against `crates/goose-mcp/src/memory/mod.rs:156-172, 189, 216-217, 239`: reads silently fall back when local `.goose/memory/` is absent; writes lazily create on `remember_memory(is_global:false)`. Perfect fit for the `.quick-chats/` scratch dir contract.
- Top of Mind truncation path verified: `oscar:matters:detach-active` already truncates `~/.config/oscar/tom-active-matter.md`; `QuickChatButton` invokes it before session spawn. No new IPC needed.
- No Rust core touch. No `sessions.db` schema additions. No new persistence backends.

**Deferred** — three items:
- **Crostini dogfood (exit criteria 1–8)** carries to Sprint 19b. Build .deb on lq-vps via `scripts/build-oscar-deb.sh`, push to draft release, Arturs runs: (1) Quick chat from Hub + sidebar; (2) Commercial matter open; (3) Privacy reads "Programmes"; (4) per-matter memory isolation (tell Matter A "remember LCD is 2026-Q3"; switch to Matter B; ask LCD — must not bleed); (5) unscoped chat has global memory only; (6) ToM toggles per matter / quick chat; (7) native session UX (rename, resume, delete) intact; (8) Arturs's qualitative "yes, this is how I'd navigate my work" gate.
- **Forge-area shape wiring** — Phase 4 captures the noun on user-added areas but `MattersLanding`'s `getPracticeAreaShape(area.id)` still returns undefined for user-added areas, falling through to the no-shape error path. A future sprint extends `usePracticeAreas` or `MattersLanding` to derive a minimal shape (subject as free-text, single kind option, no extras) from `profile.json.practice_areas[].entry_noun` when no PRACTICE_AREA_SHAPES entry exists.
- **Sprint 17b F3 (Tavily silence — "force-cite ≥2 dimensions")** still open. Not touched this sprint (scope was chat-history, not intake prompt levers); carries to Sprint 20.

**Carry-forwards**:
- **Crostini dogfood E1–E8** (Sprint 19b) — runtime gate.
- **Forge-area shape wiring** (Sprint 20+) — read `entry_noun` from profile and synthesise a minimal `PracticeAreaShape` so user-added areas can host matters/programmes.
- **Multi-session per matter** — today's binding is 1:1 (`matters.json[slug].session_id`). Lawyers who want parallel threads on the same matter would need an array shape. Out of scope; future.
- **"Promote unscoped to matter" flow** — exploratory chat → realise it's load-bearing → convert to a matter mid-conversation. Out of scope; useful future.
- **Quick-chats group pagination** — today renders all unscoped sessions flat. If usage accumulates, add a "Show all" affordance / archive policy. Out of scope.
- **Sidebar manual-expand of inactive areas** — today only the active area's matters expand. Some lawyers may want to expand other areas without leaving their current chat. Add a chevron toggle if dogfood surfaces the gap.
- **Upstream PR for `force_platform_extensions` on the Recipe schema** — Sprint 18 carry-forward; orthogonal to this sprint but stays open.

**ADRs**: 066.

---

### Sprint 18 — Permissive default loadout: in-house lawyer defaults + transparent web search (closed 2026-05-20 on code; this commit)

**Goal**: flip Oscar GC's extension defaults from upstream's developer-leaning shape to permissive-default-with-named-exclusions, with the agent's first turn already briefed and capable. Web search becomes default-on with the provider honestly named on its card. Closes the Sprint 17b carry "lawyer-default loadout" framing surfaced during Crostini dogfood.

**Built** — three ADRs at decision time + targeted edits across Rust core, UI bundled defaults, recipe builders, Integrations registry, and two call sites:

- **P0 — Three ADRs** (`docs/adr/063` permissive default loadout, `064` Tavily transparent bundled web search, `065` recipe builders consume config.yaml platforms). The three ADRs are coupled — the exit criterion fails if any one is dropped. ADR-063 records the named-exclusion doctrine (Default ON: Memory, Top of Mind, Chat Recall, Apps, Todo, Summon, Extension Manager, Auto Visualiser; Default OFF: Developer, Computer Controller, Tutorial, Code Mode). ADR-064 puts Tavily on both visibility surfaces (Extensions Settings + Integrations) with `mcp.tavily.com` named in copy. ADR-065 picks the TS-side merge over a Rust-core `resolve_extensions_for_new_session` change — recipe builders thread `enabledPlatformExtensions` derived from `ConfigContext.extensionsList`.

- **P1 — Rust-core default flip** (`crates/goose/src/agents/platform_extensions/mod.rs`). Two independent line edits: `chatrecall.default_enabled: false → true` (lawyers benefit from recall across matters); `developer.default_enabled: true → false` (shell + filesystem-write is the access-model exclusion per ADR-041). Inline comments cite ADR-063. Migration tests (`config::migrations`) unaffected — no test logic asserts these particular flags.

- **P2 — UI defaults flip + Tavily card** (`ui/desktop/src/components/settings/extensions/bundled-extensions.json`). `memory.enabled` and `autovisualiser.enabled` flipped `false → true`; `developer.enabled` flipped `false` (defence-in-depth — Rust migration is authoritative but JSON consistency matters). New Tavily entry: `type: streamable_http`, `display_name: "Web search (Tavily)"`, description names the provider + the `tavily-extract` fetch caveat. `ExtensionList.getSubtitle` already renders the URI as the visible command line for `streamable_http` (`ExtensionList.tsx:155-162`) — no card-component change needed.

- **P3 — Integrations registry: Tavily entry** (`ui/desktop/src/components/oscar/integrations/registry.ts`). New `Tavily` entry, `security_tier: 'bundled'` (matches `oscar-fs`'s Always-on treatment), `service_endpoint_host: 'mcp.tavily.com'`, `subscription_type: 'free'`, `env_keys: ['TAVILY_API_KEY']`, `facts_note` calls out queries + tavily-extract egress. `loadRegistry.joinOverlayOnly` already gives bundled-tier entries all-13-areas scope; no loader change needed.

- **P4 — Recipe builders thread `enabledPlatformExtensions`** (`buildPracticeAreaRecipe.ts`, `commercialRecipe.ts`, `forgeRecipe.ts` + new `recipe/enabledPlatformExtensions.ts` helper). The helper filters `FixedExtensionEntry[]` to `enabled === true && (type === 'platform' || type === 'builtin')` and strips the `enabled` field. Both types are included because `extension_manager.add_extension` (`extension_manager.rs:851`) treats `Platform` and `Builtin` configs as the same in-process class. Recipe extensions order: oscar-fs → platforms → extraExtensions → tavily. Forge additionally force-includes `code_execution` + `Extension Manager` via `ensureForgePlatforms()` — even if disabled in config.yaml — because Forge's purpose is wiring new agents and managing extensions.

- **P5 — Two call sites updated**: `MattersLanding.openMatter` derives `enabledPlatformExtensions` from its `useConfig()` snapshot and threads through both `buildCommercialRecipe` (new 6th param) and `buildPracticeAreaRecipe.opts`. `ForgeView` uses the same pattern via its own `useConfig()` consumer.

**Verification** (in this session):
- `pnpm exec tsc --noEmit` on `ui/desktop`: clean.
- `cargo check -p goose`: clean (Rust touch compiles; warnings unchanged).
- Migration test suite (`cargo test -p goose --lib config::migrations`): all three tests pass (`test_migrate_platform_extensions_empty_config`, `..._preserves_enabled_state`, `..._idempotent`). The "preserves enabled state" test was the one to watch — it sets `todo.enabled: false` and asserts re-migration preserves that; unaffected by developer/chatrecall flips.
- Inspected: `bundled-extensions.json` + Rust migration interact correctly — `developer` (in both layers) lands as the Rust flag (false); `memory`/`autovisualiser` (UI-only) land as the JSON flag (true); no double-spawn for Tavily because `resolve_extensions_for_new_session` returns recipe extensions only when a recipe is in play (extensions.rs:169).

**Deferred** — runtime gate (Crostini dogfood validation) to Sprint 18b: build the .deb, push to draft release, verify on Arturs's Crostini that (a) Extensions Settings shows the new default loadout on first launch, (b) Tavily card renders with hostname on both Extensions and Integrations surfaces, (c) opening a matter loads the platform extensions into the agent's tool surface (verify via "what tools do you have?"), (d) toggling Tutorial on → next matter open includes tutorial tools, (e) Forge tool surface includes `code_execution` + `Extension Manager` regardless of user toggles.

**Carry-forwards**:
- **Crostini dogfood E1–E5** → Sprint 18b (same shape as Sprint 17b's carry).
- **Sprint 17b F3 (Tavily silence — "force-cite ≥2 dimensions")** still open. Not addressed in this sprint (scope was loadout, not intake prompt levers); carries to Sprint 19.
- **Upstream PR candidate**: per-recipe `force_platform_extensions: string[]` declaration on the Recipe schema, picked up by `resolve_extensions_for_new_session`. Would let Forge's two force-on platforms live in the Recipe definition rather than in `ensureForgePlatforms()`. ADR-065 references this as a Sprint 19+ candidate.
- **Sprint 16 carry "platform-extension trim"** is closed in spirit by ADR-065 — recipe builders now consume the user's enabled-platform state. The Rust-core merge variant remains a possible upstream PR (separate from the trim itself).

**ADRs**: 063, 064, 065.

---

### Sprint 17b — Crostini dogfood patches: pnpm 11 overrides + Vite React dedupe + paid-wrapper visible-only + dropdown filtered to user areas (closed 2026-05-20 on code; commits `46642a0c9`, `9845e4f37`, `3209ebb5d`, this commit)

**Goal**: get Sprint 17 launching on Arturs's Crostini and surface dogfood findings against the lawyer-shape exit criteria.

**Built** — three patch commits, four build/upload cycles to localise the bugs:

- **Build #1 (Sprint 17 close commit `e994f37cf`)**: shipped Sprint 17 as planned. Launched on Crostini → `TypeError: Cannot read properties of null (reading 'useRef')` on every load. Renderer crashed before the React tree mounted.

- **Build #2 (commit `46642a0c9` — pnpm-workspace overrides)**: at session start the working tree carried spurious unstaged changes to `ui/pnpm-lock.yaml` (overrides removed) + `ui/pnpm-workspace.yaml` (auto-appended `allowBuilds:` stub) — pnpm 11+ silently dropped the React version pin because `pnpm.overrides` in `package.json` is ignored under the new config schema. Moved overrides + `onlyBuiltDependencies` into `ui/pnpm-workspace.yaml` (the pnpm 11+ home) and reinstalled. Necessary but not sufficient: launching the rebuild still crashed on `useRef`.

- **Build #3 (commit `9845e4f37` — Vite `resolve.dedupe`)**: extracted `index-B3JEIkFg.js` from the failing bundle and grepped for the React dispatcher object literal — `{H:null,A:null,T:null,S:null}` appeared **twice**, confirming two physical React copies in the same chunk. Root cause: pnpm 11+ produces a *hybrid* linker layout — top-level packages land as real directories under `ui/node_modules/<name>/` (1094 of them, zero symlinks at this depth) AND `ui/desktop/node_modules/react` is a symlink into `ui/node_modules/.pnpm/react@19.2.4/...`. Vite resolves `react` from two absolute paths; Rollup treats them as distinct module ids; both copies inline. react-dom flips the dispatcher on one copy, components import the other, `A.H` reads null, every `useRef` (including react-router-dom's internals on first render) throws. Fix: `resolve.dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']` in `vite.renderer.config.mts`. Verified post-rebuild: single dispatcher in `index-BSLnMHlZ.js`. Launch reached intake successfully on this build.

- **Build #4 (commit `3209ebb5d` — paid-wrapper visible-only + dropdown filter)**: Crostini dogfood with build #3 surfaced three findings (Arturs, 2026-05-19):
  - **F1 — Adding Ironclad/DocuSign broke matter open.** P5's recipe merge wired installed integrations into the per-matter recipe; on session spawn, goose-server's MCP-OAuth used client_id `https://goose-docs.ai/oauth/client-metadata.json` which Ironclad rejects ("not a trusted client"). Session never finished; "model not loading." Affects every `requires-paid-subscription` SaaS wrapper since none of them are registered to Goose's MCP-OAuth client.
  - **F2 — Top-level Integrations target dropdown listed all 13 catalog areas.** Lawyer's loadout is the practice areas they picked at intake; the dropdown was pulling from the static `PRACTICE_AREAS` array.
  - **F3 — Intake regulatory hypothesis emitted `(from my knowledge)` provenance suffix** — Tavily silent. `grep -c tavily ~/.local/state/goose/logs/llm_request.{0,1}.jsonl` returned `1` in each → Tavily extension loaded + exposed `tavily-search` to the LLM. MiniMax-M2.5's tool-choice, not a wire-through bug. The intake still produced an industry-correct hypothesis (REACH/WEEE/RoHS/UKCA/LkSG/AI Act/Modern Slavery/Late Payment — exact match for industrial cable distribution × UK+IE+DE from training data).

  Fixes for F1 + F2 in this commit:

  - `IntegrationCard.tsx` — new visible-only state for `subscription_type === 'requires-paid-subscription'`: Add button replaced with a dashed-border "Subscription — not yet installable" badge. `requires-account` (Slack, Google Drive) + `free` (CourtListener) + bundled (`oscar-fs` Always-on) stay installable.
  - `IntegrationsView.tsx` — target dropdown reads from `usePracticeAreas()` (which already returned the profile's selected areas, falling back to all 13 only when no profile). Per-entry options are the intersection of user areas × entry's `relevant_areas`. Cross-area entries (Slack/GDrive) → all user areas; commercial-only → only user areas that intersect commercial-legal.
  - `buildExtensionFromIntegration.ts` — defence in depth: skips `requires-paid-subscription` entries at recipe-build time even if a stale `installed_integrations.json` carries one from before this gate landed. Pairs with the `rm -f ~/.config/oscar/state/*/installed_integrations.json` unblock command for the previous build's broken state.

  F3 deferred: same lever as Sprint 16 / 17's open carry — "force-cite ≥2 dimensions" prompt nudge, which has second-order risk on hypothesis steering and warrants a separate sprint's eval-iteration.

**Verification** (in this session):
- Dedupe held across builds #3 and #4: `grep -c 'H:null,A:null,T:null,S:null'` on the renderer chunk = `1` each time.
- `pnpm exec tsc --noEmit` clean after every patch.
- Onboarding intake completed end-to-end on build #4 (Arturs's transcript captured the right profile).
- Goose-server `~/.local/state/goose/logs/llm_request.N.jsonl` shows `tavily` is in the tools surface; the LLM just didn't call it for the hypothesis turn.

**Deferred** — lawyer-dogfood exit criteria E1, E3, E4, E5 not yet formally validated against build #4 in this session. The .deb is on the draft release; Arturs continues testing on his own cadence:

- **E1 — Per-area Extensions tab subset visible.** Build #4 ships the visible-only paid-wrapper state; the subset under Commercial is Slack + Google Drive + Ironclad (visible-only) + DocuSign (visible-only) + oscar-fs (Always-on). IP gets CourtListener + Slack + Google Drive + oscar-fs.
- **E3 — Top-level dropdown** now filtered to Arturs's three areas. Visual confirmation outstanding.
- **E4 — CourtListener / Slack / Google Drive Add → matter open works.** Untested in this session; CourtListener (free public-data MCP) is the safest first end-to-end test.
- **E5 — Honest-labelling qualitative gate.** Outstanding.

**Carry-forwards** (Sprint 18+):

- **Real MCP-OAuth client registration with SaaS vendors** (or alternative auth path) — without a trusted client_id, `requires-paid-subscription` entries stay visible-only. Several paths: register Goose's client with each vendor's developer programme; ship a per-vendor user-runs-this-script auth flow; or accept that proprietary wrappers stay catalog-only until the user brings their own credentials.
- **Tavily silence (F3 carry, Sprint 16b → Sprint 17b → Sprint 18)** — prompt lever "force-cite ≥2 dimensions" in `docs/sprint-15/self-assessment.md`. Needs iter-3 eval against the regulatory-fit axis (Sprint 16b infrastructure).
- **`llm_request.2.jsonl` permission-denied finding** — one of the rotating goose-server log files was created with ownership that locked Arturs's shell out. Likely a transient process-user issue; flag for separate investigation if it recurs.
- **pnpm 11 hoisted-linker fragility** — `resolve.dedupe` in `vite.renderer.config.mts` is the surgical fix, but the underlying 1094-real-dirs disk layout means other peer-dep-style packages could trip the same bundle-twice issue (e.g. if we add MUI or Emotion). Worth a Sprint 18+ check whether to force `node-linker=isolated` in `.npmrc` for deterministic single-copy resolution.

**ADRs**: none for Sprint 17b — all fixes are surgical patches against Sprint 17's design (ADRs 059–062 stand unchanged). pnpm 11 + Vite dedupe captured as inline comments in `pnpm-workspace.yaml` and `vite.renderer.config.mts` rather than an ADR, because it's an upstream-config workaround, not an Oscar GC architectural decision.

---

### Sprint 17 — Integrations (see and add) (closed 2026-05-19 on code; Crostini dogfood E1–E5 = Sprint 17b; commits `dc0125f05`, `7f5696e0d`, `7058aadc1`, `65ad7f1a4`, `c6b239b31`, `a20333606`, `4bbf11c8e`, this commit)

**Goal**: a lawyer opens a practice area, sees a clear list of MCPs labelled honestly (license, subscription, what-it-connects-to), and clicks Add to wire one into the agent in a few clicks. Same registry, two surfaces: per-area filtered Integrations tab + top-level Integrations sidebar entry. Plan at `/root/.claude/plans/sprint-mcp-marketplace-breezy-lagoon.md`. Brief flagged "marketplace" naming; plan-mode AskUserQuestion settled on **Integrations** (lawyer-natural; corporate-IT vocabulary; "operator marketplace" reserved for a future product). The first sprint where Oscar GC stops *suppressing* the upstream Extensions UI and starts shipping a transparent in-house-shaped surface — `GOOSE_ALLOWLIST=extensions: []` stays in place; this is a parallel sanctioned path.

**Built** — seven commits on `main`, four ADRs at decision time:

- **P0 — ADRs 059–062** (`dc0125f05`) — Written before any code. ADR-059 (registry data source: `.mcp.json` + hand-curated `INTEGRATIONS_OVERLAY` overlay; per-area scoping derives from `bundled_skill_sources` inversion). ADR-060 (trust tiering: bundled/trusted/community; community-tier fires explicit consent prompt; "Add and acknowledge" persists `trust_acknowledged: true`). ADR-061 (`installed_integrations.json` per-area state file; sibling to matters.json; profile.json stays single-writer per plan-mode AskUserQuestion). ADR-062 (amends ADR-042 — per-entry runtime egress disclosure; trust prompt is the structural consent floor; bubblewrap stays deferred).

- **P1 — Registry overlay + loader + list-available IPC** (`7f5696e0d`) — New `ui/desktop/src/components/oscar/integrations/{types.ts, registry.ts, loadRegistry.ts, buildExtensionFromIntegration.ts}`. `INTEGRATIONS_OVERLAY` ships 6 seed entries: `oscar-fs` (bundled), `CourtListener` (trusted), `Slack`, `Google Drive`, `Ironclad`, `DocuSign` (community). Brief's OpenContracts / Open Legal Compliance MCP / US Legal MCP dropped — `grep -rn` across `/srv/projects/goose` found zero references; deferred to Sprint 18. `oscar:integrations:list-available` IPC walks the 9 in-house-legal plugin `.mcp.json` files (`<resourcesRoot>/skills/in-house-legal/` packaged; `/srv/projects/goose/skills/in-house-legal/` dev). Loader joins vendor data with overlay by id, computes `relevant_areas` by inverting `bundled_skill_sources` (Slack/GDrive → all 13; Ironclad → commercial + commercial-disputes; CourtListener → ip + 4 disputes areas). Fail-closed: vendor rows without an overlay row are excluded with a console warning.

- **P2 — `installed_integrations.json` state file + IPCs** (`7058aadc1`) — Zod schemas (`InstalledIntegrationEntrySchema`, `InstalledIntegrationsFileSchema`) in `components/oscar/integrations/types.ts`. Helpers `readInstalledIntegrations` / `writeInstalledIntegrations` in `main.ts` mirror the matters pattern. New IPCs `oscar:integrations:list(areaId)` and `oscar:integrations:install(areaId, entryId, trustAcknowledged)`. Install rejects unknown ids and bundled-tier entries (ADR-060 invariant); idempotent on duplicate id. Startup egress envelope log (ADR-062) one-shot scans area state dirs at boot; emits a single `log.info` line enumerating distinct hostnames when any integration is installed.

- **P3 — Per-area Integrations tab + card + trust-prompt modal** (`65ad7f1a4`) — `PracticeAreaPlaceholder.tsx` becomes a thin tab host (`?tab=matters` default → MattersLanding; `?tab=integrations` → IntegrationsPerArea). New components `IntegrationsPerArea.tsx`, `IntegrationCard.tsx`, `Tags.tsx`, `ConfirmAddModal.tsx`. Card states: Bundled → Always-on badge; Trusted → short confirmation; Community → full trust prompt (hostname + license + subscription + maintainer + egress widening + sandboxing caveat); Installed → greyed Installed badge. `main.css` gains `.oscar__area-tabs` + `.oscar__integration-*` class family in the Editorial register (serif title, mono tags, copper accent for bundled tier, outline for trusted, ink-muted outline for community).

- **P4 — Top-level Integrations sidebar entry + view** (`c6b239b31`) — `OscarSidebar.tsx` gains a second header-zone entry next to Forge (Plug icon, `/integrations` route). `IntegrationsView.tsx` renders all entries unfiltered with per-card target-area `<select>` dropdown sourced from `relevant_areas`. ADR-039 untouched: Forge stays auto-spawn-chat; Integrations is its own sibling surface, not a Forge tab.

- **P5 — Recipe-builder merge** (`a20333606`) — `MattersLanding.openMatter` reads `installed_integrations` via the new IPC, calls `buildExtensionFromIntegration` per `trust_acknowledged` entry, threads the resulting `ExtensionConfig[]` through `buildPracticeAreaRecipe`'s `extraExtensions` (12 generic areas) or `buildCommercialRecipe`'s new `installedConfigs` param (appended after redline). Assembled recipe: `[oscar-fs, ...extraExtensions, tavily]` where `extraExtensions = [redline, ...installedConfigs]` for Commercial and `[...installedConfigs]` for the other 12.

- **P6 — env_keys gate generalisation** (`4bbf11c8e`) — New `ensureRecipeSecrets.ts` helper walks `recipe.extensions[].env_keys`, checks each against env+keyring + `OSCAR_<KEY>_SKIPPED` flag, returns true if any key is genuinely missing. `MattersLanding.openMatter` gates spawn behind `RecipeSecretsModal` only when needed — no modal flash for the common path. For Sprint 17's seed set (every entry's `env_keys: []` + Tavily already-set at onboarding) the gate resolves false on every matter open; structurally ready for Sprint 18+ entries that grow real keys.

**Verification** (in this session):
- `pnpm exec tsc --noEmit` on ui/desktop: clean after every phase.
- ADR line counts: 49 / 73 / 65 / 52 (target ≤50; 060 carries the literal trust-prompt copy; over by acceptable margin given the load-bearing decision).
- Commit trailer hygiene: all 7 commits trailer-clean per CLAUDE.md.

**Deferred** — three items, in priority order:

- **Crostini E1–E5 dogfood → Sprint 17b.** Build .deb on lq-vps via `scripts/build-oscar-deb.sh`, push to draft release `oscar-gc-sprint17`, Arturs runs the five exit criteria on a fresh Crostini install. E1 (per-area Integrations tab visible across Commercial/IP/Privacy with correct subsets), E2 (Add Ironclad in Commercial → trust prompt → entry lands in `installed_integrations.json`), E3 (top-level Integrations + target-area picker writes to the chosen area), E4 (matter opens with installed integration in recipe → agent reports tool surface includes it), E5 (honest-labelling qualitative gate per the brief).
- **Settings UI for Tavily-key rotation (Sprint 16 carry, deferred from Sprint 17 P4).** Scope-creep risk against the Integrations focus; defer to Sprint 18.
- **Platform-extension trim (Sprint 16 carry, conditional).** Gated on iter-3 eval numbers from Sprint 16b; still conditional in Sprint 18.

**Carry-forwards**:

- **Sprint 17b Crostini dogfood E1–E5** — runtime gate.
- **Upstream PR for ADR-058's secret_discovery generalisation** — small standalone Sprint 18 candidate.
- **OpenContracts / Open Legal Compliance MCP / US Legal MCP** — brief seed entries dropped because zero references in `/srv/projects/goose`. Sprint 18 candidates pending hand-verified metadata (license, URL, security posture).
- **Removal / round-2 / edit flow for installed integrations** — Sprint 18+. Schema supports the array shape; UI affordance is intentionally absent in Sprint 17.
- **Multi-area Add in one click** — top-level Integrations target dropdown is single-area; Sprint 18+ for "apply to all" / "apply to these areas".
- **OAuth flows for commercial wrappers** — modeled today as "SaaS owns first-call auth"; Sprint 18+ if a wrapper grows an `env_keys`-based auth path.
- **Real-time `maintenance_signal`** — overlay carries the field structurally; populating from GitHub readmes / service status pages is Sprint 18+.
- **Chat-driven Add via a Forge MCP tool** — Sprint 18+ layer on the existing `oscar:integrations:install` IPC.
- **`oscar-memory` recipe wiring** — TODO.md carry stays open.

**ADRs**: 059, 060, 061, 062 (amends 042).

---

### Sprint 16 — Re-sequenced intake (practice scope before regulatory hypothesis) + Goose-native Tavily key surface (closed 2026-05-19 on code; iter-3 eval + Crostini dogfood = Sprint 16b; commits `2d6ae81b5`, `90ca22af5`, this commit)

**Goal**: correct two structural mistakes Sprint 15 P8 dogfood exposed. (1) The regulatory hypothesis fired before practice areas were known, so MiniMax defaulted to its most-trained-on EU regs (privacy stack); Arturs's industrial-cable-distribution scenario missed REACH/WEEE/RoHS/UKCA/Modern Slavery/Late Payment, yet coverage scored 5/5 because the rubric counted framework presence not industry fit. (2) Tavily key entry required the terminal — the developer-audience default the inverted-defaults doctrine exists to undo. Plan at `/root/.claude/plans/what-arturs-said-wobbly-fog.md`. Closes Sprint 14's `ADR-048-reserved` slot (Adeu MCP App diff preview design — implementation in Sprint 16b).

**Built** — three commits on `main`, five ADRs at decision time:

- **Phase 1 — Anchor 1 + Carries 1+2** (`2d6ae81b5`) — systemPrompt.ts rewritten under new P1–P9 numbering. Practice scope (P4) now precedes the regulatory hypothesis (P5). New Tavily query template `regulatory frameworks for a {industry_summary} operating in {jurisdictions} covering {practice_scope} 2026` substitutes practice-area scope at agent inference time. Data-protection-always guardrail in P5 prevents over-narrowing when Privacy is dropped from scope. ADR-055 records the sequence + template + guardrail (amends ADR-050; new file per ADR rules). Carry 1 (visible Tavily provenance) — P5 recap line suffixed with `(from web + my knowledge)` or `(from my knowledge)` per `captured_via`. Carry 2 (recap copula bug) — P9 recap states fields as `Label: value`, never copula'd. **Eval rubric rework** (Option C — both axes): new `regulatory-fit.md` judge keyed off per-persona `regulatory_answer_key` (`load-bearing` vs `nice-to-have` tiers); coverage.md edited so dimension 3 deconflicts (industry-fit no longer scored on coverage). All 6 existing personas augmented with answer-keys; new 7th persona `arturs-industrial-eu.json` (UK+IE+DE+FR industrial cable distribution, mirrors Arturs's P8 dogfood scenario) carries the load-bearing exit-criterion E2. `aggregate-scores.mjs`, `run-intake-eval.mjs`, `render-recipe.ts` updated for the new axis + new pass criterion (mean ≥4.0 per axis AND no cell <3.0 AND no persona regulatory-fit <3.0 — per-persona floor on the bug-detection axis) + `--sprint` flag (default 16). ADR-056 records the rubric rework (amends ADR-054). Same-LLM-judge bias defended structurally by the human-authored answer-keys + per-persona floor — no separate judge model needed (per Arturs's direction).

- **Phase 2 — Anchor 2 (B1 — port secret_discovery to goose-core)** (`90ca22af5`) — Phase 1 verification confirmed the docs-vs-code gap: Goose's docs claim a missing-`env_keys` prompt fires on recipe load; `extension_manager.rs::merge_environments` (line 446) silently skips with a `warn!()`. Fix: lifted `discover_recipe_secrets` from `goose-cli/src/recipes/secret_discovery.rs` into `goose/src/recipe/secret_discovery.rs` (CLI module now a re-export shim — preserves the existing `recipes/recipe.rs:34` callsite). New `POST /recipes/scan_secrets` route on `goose-server`: takes a `Recipe`, returns `Vec<SecretRequirement>` (registered in `openapi.rs`, TS SDK regenerated via `openapi-ts`). Desktop: new `RecipeSecretsModal.tsx` scans the recipe via `scanRecipeSecrets()`, calls `useConfig().read(key, true)` per required key (env-then-keyring chain), renders a password form for unset keys; Save → `upsertConfig(is_secret:true)`, Skip → `OSCAR_<KEY>_SKIPPED=true` non-secret config. `OscarOnboardingGuard.tsx` renders the modal between `!profile` and `<OscarOnboardingView />`. Tavily migration: `buildTavilyExtension()` parameter-less, declares `env_keys: ['TAVILY_API_KEY']` + `${TAVILY_API_KEY}` URI substitution; `extension_manager.rs:832 substitute_env_vars(uri, &all_envs)` inlines the value at session-spawn. `buildOnboardingRecipe`, `buildPracticeAreaRecipe`, `buildCommercialRecipe` drop the `tavily` parameter; `OscarOnboardingView.tsx` + `MattersLanding.tsx` stop calling `resolveTavilyKey()`. Deletions: `resolveTavilyKey.ts`, `oscar:resolve-tavily-key` IPC handler in `main.ts`, `oscarResolveTavilyKey` preload bridge. `~/.config/oscar/secrets/tavily.json` no longer read; env-var TAVILY_API_KEY fallback preserved via `Config::get_secret`'s env-uppercase-first chain (CI / eval unblocked). INSTALL_CROSTINI.md gains "Tavily web-search key" as Step 7 in First Launch + the env-var workaround for keyring-less containers. ADR-057 records the env_keys + keyring decision (amends ADR-052); ADR-058 records the goose-core lift + `/recipes/scan_secrets` route (closes the docs-vs-code gap that Goose itself has — upstream-PR-worthy follow-up tracked).

- **Phase 3 — ADR-048 written (Carry 4 design lands; implementation deferred to Sprint 16b)** (this commit) — `docs/adr/048-adeu-redline-preview-ui.md` captures the design from Sprint 14 Workstream 5 verbatim (vendor patch against adeu 1.6.9 adding `commit=False` default + new `commit_document_batch` tool, Jinja resource + template mirroring the existing `markdown_ui` pattern, 60-min TTL + atexit reaper for tempfiles, postinst.sh integration after the word-diff patch). Reserved since Sprint 14; Sprint 16b carries the implementation. PROJECT.md + SPRINT_LOG.md updated; Sprint 16 closes on code.

**Verification** (in this session):
- cargo check -p goose -p goose-cli -p goose-server: clean.
- cargo run --bin generate_schema: clean; new endpoint in openapi.json.
- npx openapi-ts regen: `scanRecipeSecrets()` + `ScanRecipeSecretsResponse` + `SecretRequirement` types in `ui/desktop/src/api/`.
- npx tsc --noEmit on ui/desktop: no errors from these changes.

**Deferred** — four items, in priority order:
- **Iter-3 eval (P4.1) → Sprint 16b.** Running `node scripts/dogfood/sprint-15/run-intake-eval.mjs --sprint 16 --iteration 3` over all 7 personas requires real MiniMax + Tavily API endpoints under billing — not safe to run in a sandboxed session. Verifies mean ≥4.0 per axis incl. regulatory-fit + per-persona floor + downstream-briefing ≥4.0 (the Sprint 15 FAIL). Output writes to `docs/sprint-16/eval/iter-3/<persona>/`.
- **Manual Crostini dogfood (E4) → Sprint 16b.** Arturs runs the full clean-Crostini install with zero terminal commands (provider key → Tavily key → intake → REACH/WEEE/RoHS-dominant hypothesis for his industrial-distribution persona). Qualitative gate: *"yes, the regulatory landscape matched my industry, not just my geography."*
- **Carry 3 (platform-extension trim) → Sprint 17.** Goose's `Settings` struct has no `disabled_platform_extensions` field; the disable mechanism would require either a Rust core touch or a runtime experiment to find the minimum extension set that preserves tool-call wiring. Defer until the trim's value is established by iter-3 numbers.
- **Carry 4 (Adeu MCP App diff preview) implementation → Sprint 16b.** ADR-048 design landed in this sprint; vendor patch + Jinja resource + recipe wiring follow.

**Carry-forwards**:
- **Iter-3 eval + Crostini dogfood** (Sprint 16b) — the runtime gates for E1–E4 from the Sprint 16 plan.
- **Adeu preview UI implementation** (Sprint 16b) — generate the unified-diff patch against adeu 1.6.9, add Jinja resource + Python tool, wire into bundle prep + postinst, update commercialRecipe.ts `available_tools`. Per ADR-048 step list.
- **Settings UI for editing the Tavily key post-onboarding** (Sprint 17) — `RecipeSecretsModal` is entry-only; key rotation requires re-launch with env override or a new edit-mode affordance. Documented in ADR-057.
- **Platform-extension trim** (Sprint 17, conditional on iter-3 numbers) — if iter-3 downstream-briefing clears 4.0 without it, trim is nice-to-have. If iter-3 still fails downstream, the trim becomes one of the three open levers from Sprint 15 self-assessment.
- **Upstream PR for ADR-058's secret_discovery generalisation** (Sprint 17 candidate) — the lift makes Goose's documented behaviour true for every binary; cleanly PR-able.
- **If-iter-3-fails levers** (Sprint 17): force-cite ≥2 dimensions in practice-area prompts; inject `company_context` into the user message; trim default extensions. Three open levers from `docs/sprint-15/self-assessment.md` still on the table.

**ADRs**: 048 (Adeu preview design — reserved Sprint 14, written Sprint 16), 055 (intake re-sequence, amends ADR-050), 056 (regulatory-fit eval axis + answer-keys, amends ADR-054), 057 (Tavily env_keys + keyring, amends ADR-052), 058 (secret_discovery lift to goose-core + `/recipes/scan_secrets` route).

---

### Sprint 15 — Practice-context intake: in-house shape, agentic, model-eval'd (closed 2026-05-19 on Stage 1 self-eval — two live iterations; Stage 2 → Sprint 16; commits `fb3084eb7`, `1af9386` sibling, `6f22b070a`, `d7af52def`, `79cd2e46d`, `2ba97d1e4`, `fc5e756eb`, `36db132b5`, `98cc2f73b`)

**Goal**: redesign the onboarding intake so an in-house lawyer can describe their practice in ≤5 minutes and downstream practice-area agents are *briefed at turn 1* — they know industry depth, jurisdictions, regulatory baseline, recurring matter shapes, stakeholder/escalation context. Goal + rules, not script. Self-eval'd before user dogfood. Plan at `/root/.claude/plans/sprint-practice-context-intake-distributed-coral.md`. Displaces Sprint 14's first-listed Sprint 15 candidate (adeu MCP App diff preview, ADR-048 reserved — moves to Sprint 16).

**Built** — five landable phases on `main`, five ADRs at decision time:

- **P2a–P2d** (`fb3084eb7` + sibling `1af9386`) — Rules + schema. ADR-050 (intake rule-set, 8 rules: budget ≤5min/≤14 turns, signal-density branching, batch aggressively, hypothesis-confirm via Tavily, always-open final question, P3.5 skip-when-covered, hard stops preserved, state-tracking). ADR-051 (schema v3 with `company_context` block — industry depth, geography, regulatory_baseline + provenance, recurring_matters, stakeholders, risk_appetite, open_notes — and v2→v3 migration policy with `captured_via="needs-re-intake"` sentinel + gated re-intake routing). Schema implemented in sibling `oscar-onboarding-mcp` (v0.2.0 → v0.3.0; smoke.mjs verifies v3 round-trip + v2→v3 read-time migration). `systemPrompt.ts` rewritten — P2.5 — Company context block has 5 batched beats (industry+size; geography; hypothesis-confirm; recurring matters + stakeholders + escalation; risk appetite); new P3.99 — Open notes; P3.5 hard cap drops 2 → 1 per area with a concrete skip-when-covered table. Tavily key gitignored at both repo roots (root + ui/desktop); dev key written to `~/.config/oscar/secrets/tavily.json` (0600, outside the repo).

- **P3** (`6f22b070a`) — Tavily as hosted SSE web-search extension. ADR-052 (also amends ADR-042 egress without editing it). `resolveTavilyKey.ts` + `oscar:resolve-tavily-key` IPC in `main.ts` + `oscarResolveTavilyKey` on `window.electron`; resolution order = env `TAVILY_API_KEY` > `~/.config/oscar/secrets/tavily.json` > absent (rule-4 fallback). `buildTavilyExtension` wires hosted SSE at `https://mcp.tavily.com/mcp/?tavilyApiKey=…`. `redactRecipeForLog` utility ready for any future code path that serialises a Recipe. `prepare-oscar-bundle.js` emits `runtime_egress_optional[]` block into `BUNDLE.json` declaring the `mcp.tavily.com` carve-out for audit completeness.

- **P4** (`d7af52def`) — Recipe-time `company_context` injection (load-bearing wire from intake → agents). ADR-053. New `companyContextBlock.ts` renderer produces a dense one-line-per-dimension markdown block; `buildPracticeAreaRecipe` prepends `## About this company` to instructions when non-null. `buildCommercialRecipe` threads it through. `MattersLanding.openMatter` reads profile + Tavily key + passes both. `OscarOnboardingGuard` updated for v2-migrated profiles: routes `captured_via === "needs-re-intake"` profiles back to `OscarOnboardingView` so P2.5 runs against existing users (new intake overwrites the v2 stub on `finalize_profile`).

- **P5** (`79cd2e46d`) — Eval harness scaffolding. ADR-054. Six axis-covering personas (Sarah Chen UK fintech / Daniel Okafor Sprint-7 baseline reused / Priya Iyer US healthcare / Marco Bianchi EU AI solo GC / Jin-soo Park Korean marketplace / Quiet Lawyer edge). CLI orchestrator `run-intake-eval.mjs` — every LLM call goes through `goose run` against a recipe so the eval exercises the production code path. tsx-invoked `render-recipe.ts` imports the production builders. Three judge prompts (coverage / efficiency / downstream-briefing) at `judge-prompts/*.md` with explicit 0–5 rubrics + nuance for Quiet Lawyer null-handling. `aggregate-scores.mjs` produces markdown summary + pass/fail vs criteria (mean ≥4.0 per axis; no cell <3.0). Recipes carry Tavily key in their SSE URI — written to `/tmp/` only; defence-in-depth `.gitignore` rule for `docs/sprint-15/eval/**/recipe-*.json`.

- **P7** (`2ba97d1e4`) — Self-assessment `docs/sprint-15/self-assessment.md`. Honest framing on what shipped + what didn't run + what's wobbly + the ship gate to Stage 2.

**P6 ran end-to-end across two iterations** (after Arturs provided the MiniMax dev key — `~/.config/oscar/secrets/minimax.json`, 0600, USD 10/month cap, key handling mirrors the Tavily pattern: secrets file gitignored at both repo roots + `**/secrets/*.json` defence-in-depth pattern):

- Per-persona wall-time 2.4–7.0 min, mean ~4.2 min. Full 6-persona iteration ~25–30 min total.
- Real harness fixes landed during iter-1 (`fc5e756eb`): Tavily extension type `sse` → `streamable_http` (goose CLI's recipe validator rejects `sse`); `--recipe` mutually exclusive with `-t`/`-i` (user-turn now threads through recipe `prompt` field, fresh JSON per turn); `--no-profile` breaks tool calls (must NOT be passed — without it, MiniMax-M2.5 emits text-shaped `[TOOL_CALL]` pseudo-calls instead of real `toolRequest` content blocks); `--session-id` requires `--resume` (use `--name` for new session); `detectFinalizeProfileCall` traverses `toolCall.value.name`.
- **iter-1** (`fc5e756eb`): coverage 4.83 PASS, efficiency 4.20 PASS, downstream 2.58 FAIL (min cell 1). Intake itself works; downstream-briefing wobble is practice-area agents not actively using the injected `## About this company` block (Daniel Okafor commercial first-turn scored 1/5 — generic negotiation playbook with zero persona anchors).
- **iter-2 prompt fix** (`36db132b5`): defaultSystemPrompt + commercial systemPrompt gain explicit "Use the About this company block actively" sections; intake rule 4 capped at one Tavily call per intake (iter-1 Sarah triggered 8 calls).
- **iter-2** (`98cc2f73b`): coverage 4.50, efficiency 4.80, downstream **2.92 (+0.34 vs iter-1)**. Daniel jumped 1.0 → 3.0 on downstream (now cites UK REACH/WEEE, MD £100k threshold, Late Payment Act, channel-reseller programme — five persona anchors in one response). Priya 2.5 → 4.0. Quiet Lawyer stays at 1 (expected — persona declines specifics; nothing to brief on).
- **Iter-3 not run.** Three open levers (force-cite ≥2 dimensions; inject company_context into user message; trim default extensions) each carry second-order risk; documented in self-assessment.md. Sprint 16 picks up after Arturs's Stage 2 qualitative signal.

**Deferred** — two items:
- **P8 (Stage 2 user dogfood) carries to Sprint 16.** Arturs runs intake on his own practice + 1–2 invented personas via the UI or the harness; the qualitative judgment ("does it FEEL briefed when I open a practice-area agent post-intake?") supersedes the 2.92 model-judge mean.
- **Settings UI for end-user Tavily key entry**: env-var + secrets-file resolution suffices for Sprint 15 self-eval. End-user Settings affordance scheduled for Sprint 16.

**Carry-forwards**:
- **Stage 2 dogfood (P8)** — Arturs runs the intake (UI or harness) and qualitatively judges whether the practice-area first-turn feels briefed. Iter-2 prompts now live in main; Crostini rebuild picks them up.
- **Iter-3+ practice-area prompt tightening** — gated on Stage 2 signal. Open levers documented in `docs/sprint-15/self-assessment.md` "Why we did not run iter-3".
- **Settings UI for Tavily + MiniMax** — small surface, deferred from P3 per ADR-052.
- **Judge robustness** — Priya's iter-2 efficiency returned prose-only rationale (orchestrator caught it as parse-failure null); stricter judge prompt or score-coercion step needed.
- **Quiet Lawyer scoring** — downstream-briefing axis penalises generic answers but the Quiet Lawyer declines specifics; consider excluding from downstream mean or scoring as a separate "null-handling fidelity" axis.
- **Adeu MCP App diff preview (Sprint 14 carry, originally first Sprint 15 candidate)** — displaced by this sprint; ADR-048 still reserved; Sprint 16 picks up.

**ADRs**: 050, 051, 052 (amends 042), 053, 054.

---

### Sprint 14 — In-house framing for matters (closed 2026-05-19, commit `0ebe0d238`)

**Goal**: redesign the matter-create flow so opening it in any of the 13 practice areas asks the questions an in-house lawyer would expect, in their vocabulary. Plus four adjacent items the Sprint 13 Crostini dogfood surfaced. Plan at `/root/.claude/plans/brief-sprint-14-immutable-diffie.md` (full plan-mode design including the deferred Workstream 5 captured there).

**Built** — two landable units on `main`, three ADRs at decision time, six exit criteria met:

- **Unit 1** (`214bc10e6`) — Forge sidebar alignment fix (P2-A) + bundled-MCP spawn-boot smoke test (P0-A class lesson, ADR-049). The header now carries the 56px Menu-trigger clearance that previously sat on the practice-area list (Sprint 13 dogfood: "Forge sits just below the three dashes at the top and clashes" — before/after screenshots in `docs/screenshots/sprint-14/forge-{before,after}.png`). `smokeTestBundledMcps` in `prepare-oscar-bundle.js` spawns each bundled MCP under the bundled Node, watches stderr for a per-MCP ready-line regex (oscar-fs / oscar-memory / oscar-onboarding), 3-second timeout, throws from `main()` on failure — Sprint 13's duplicate-shebang regression would now fail the .deb build before electron-forge make. Failure path verified by synthetic break: `process exited before ready line (code=1, signal=null)` with `SyntaxError` in `stderr_tail`. Smoke results live in `BUNDLE.json#smoke_test` for provenance.

- **Unit 2** (`0ebe0d238`) — Matter schema v2 (ADR-047, load-bearing anchor): closes Sprint 13 dogfood findings P2-B (Client/Counterparty assumes external-counsel framing), P2-C (no matter-list back-affordance from chat), P2-D (no higher-level grouping above matter), P2-E (Privacy dialog mental-model mismatch — folded into P2-B).
  - **Schema reshape**. `client` / `counterparty` / `matter_type` dropped; replaced by `subject {type, label}` (15 typed subject types), `counterparty {role, name} | null` with typed PartyRole enum (21 roles), area-typed `kind` (free-form at schema layer, narrowed per area at intake), sparse `extras` map (≤32 string keys; bounded kind-conditional fields), `stakeholder: string | null` grouping tag, explicit `area_id` and `working_dir`. Bumped to `schema_version: 2`; v1 registries renamed to `matters.v1.json.bak` on first read and treated as empty (pre-pilot license per brief). Zod-validated at IPC boundary in `oscar:matters:create`, replacing the hand-rolled `typeof` checks from Sprint 12.
  - **Per-area config, one renderer**. New `practiceAreaShapes.ts` declares a `PracticeAreaShape` per area id (all 13 keyed). Five family templates emerge from the data (Contract / Person / Regulator-Obligation / Internal-asset / Event-shaped) — labels, kind enums, role enums, conditional extras, privileged defaults all data-driven. `NewMatterDialog.tsx` rewritten as one config-driven renderer with generic primitives (text, combobox autocomplete, role-typed dropdown, conditional extras block). No per-area JSX components.
  - **Split disk layout**. Operational state stays at `~/.config/oscar/state/<area-id>/{matters.json, matters/<slug>/{history.md, notes.md, session.json}}`; content moves to `~/Documents/Oscar GC/<Area>/<Matter>/{matter.md, outputs/, source documents}` — Finder-discoverable, drag-drop-friendly, cloud-sync-compatible. Recipe widens `oscar-fs` allowed-directories for an active matter to include both folders; `OSCAR_MATTER_DIR` points at the working folder. Plan-mode decision after Arturs's "Split (recommended)" pick in plan-mode `AskUserQuestion`.
  - **Tag-and-group stakeholder grouping**. `MattersLanding` groups rows by case-insensitive stakeholder header with row counts; "Other" bucket for null-stakeholder matters. Dialog stakeholder field is a `<datalist>`-backed combobox autocompleting from prior values in the same area. Plan-mode decision after Arturs's "Tag-and-group (recommended start)" pick — defers first-class stakeholder entity until/unless a stakeholder-level profile document becomes load-bearing.
  - **Matter back-affordance**. New `MatterBackButton` wraps existing `ui/BackButton.tsx` (no new pattern invented per brief). New IPC `oscar:matters:lookup-session(sessionId)` scans area registries for the session_id → matter binding. Button mounts top-left in `BaseChat`, renders only when matter-bound, label "All matters", click navigates to `/practice/{areaId}` + clears Top of Mind so the next matter isn't auto-anchored. Mouse back-button works for free via BackButton's existing IPC listener.
  - **Top of Mind**. `renderTomActiveMatter` rewritten with adaptive template + single `LABELS` dictionary (`matterLabels.ts`). Empty sections omitted; labels read in in-house vocabulary (Employee/Subject/Vendor/Entity, not Client/Counterparty). The agent's first-turn response reaches for the right framing as a result.
  - **IPC types**. Preload's `matters` block returns `MatterEntry` / `NewMatterInput` (typed), not `unknown` — canonical Window.electron shape lives in `preload.ts`; `useMatters.ts` no longer redeclares a shadow type that was masking the rest of the renderer's `window.electron.*` callsites.
  - Screenshots: 4 representative practice-area landings captured (commercial, privacy, employment, commercial-disputes) at `docs/screenshots/sprint-14/practice-*.png`.

- **Phase 7 dogfood + sign-off** (2026-05-19) — .deb built on lq-vps via `scripts/build-oscar-deb.sh`, uploaded as draft release `oscar-gc-sprint14` (smoke test ran during the build: oscar-fs 111ms, oscar-memory 123ms, oscar-onboarding 117ms; all pass). Arturs installed on Crostini with clean Oscar config (`~/.config/oscar`, `~/.local/share/Oscar GC`, `~/Documents/Oscar GC` wiped; Goose/keyring/MiniMax credentials preserved). Re-ran onboarding; per-area matter-create dialog tested. Verbatim sign-off: "It works, but more testing to do on edge cases." Sprint 14 closes on Unit 2 exit gate met.

**Plan-mode discoveries** — three brief-vs-reality flags caught before implementation:
- The brief and `TODO.md` reference `goose-cowork-comparison` / gotoHuman cowork pattern as the upstream reference for Workstream 5 (adeu MCP App preview). Plan-mode found no such doc in the codebase — only `documentation/docs/mcp/gotohuman-mcp.md` (the upstream community human-in-the-loop MCP, not an Oscar architectural pattern). Workstream 5 design grounded in adeu's existing native MCP-Apps Jinja-resource implementation (`mcp_components/resources/markdown_ui.py` + `templates/markdown_ui.html` pattern, applied to `read_docx` today); preview UI for `process_document_batch` is the narrow gap.
- The plan-mode `AskUserQuestion` collected two architectural decisions from Arturs that shaped Unit 2 (disk layout = Split; grouping = Tag-and-group).
- Both Plan agents (schema-first + UX-first perspectives) converged independently on the `subject + counterparty? + kind + extras + stakeholder` abstraction — the convergence was a strong signal that the shape is right.

**Deferred to Sprint 15** (per brief, "What's NOT in this sprint" + scope reality):

- **Workstream 5 — Adeu MCP App diff preview (carry-forward)**. Plan-mode design is captured end-to-end in `/root/.claude/plans/brief-sprint-14-immutable-diffie.md` §"5. Adeu MCP App diff preview". The work is bounded — extend adeu's existing native MCP-Apps pattern (the gap is narrow: `process_document_batch` lacks the `meta={"ui": {"resourceUri": ...}}` decoration that `read_docx` already has). The Sprint 15 unit is: author `docs/redline/adeu-1.6.9-redline-preview-ui.patch` adding `commit: bool = False` parameter + new `commit_document_batch` tool + new `redline_preview_ui` Jinja resource; wire postinst.sh + prepare-oscar-bundle.js; add `commit_document_batch` to `commercialRecipe.ts` available_tools; write ADR-048. Substantial enough to be its own ship — deferred so Unit 2 (the load-bearing anchor) lands clean for dogfood ahead of the preview UI iteration.
- **Audit log infrastructure** (Sprint 15 candidate per Sprint 13 carry).
- **gotoHuman / cowork pattern references** in the codebase need clean-up — informational flag, not blocking.

**Carry-forwards from Sprint 13 closed**:
- P0-A class lesson → ADR-049 spawn-boot smoke test ships in Unit 1.
- P2-A Forge alignment → fixed in Unit 1.
- P2-B / P2-C / P2-D / P2-E → all addressed in Unit 2.

**Carry-forwards into Sprint 15**:
- Workstream 5 (adeu MCP App preview) per plan-mode design.
- Per-area kind vocabularies sanity-check (Sprint 14 ships best-guesses; refinements per-area are cheap config-only edits).
- **Edge-case testing across the 13 per-area dialogs** (Phase 7 dogfood sign-off "more testing to do on edge cases") — kind-conditional extras (e.g. Privacy regulator dropdown only when kind=regulator_inquiry; AI Governance risk-classification only on pre-deployment review), privileged-by-default kinds, stakeholder near-match merging ("Acme" vs "Acme Corp"), folder-rename re-link UX when the Documents working folder is renamed by the user, multi-matter same-stakeholder grouping at scale, v1→v2 .bak migration on a registry that already has matters.
- Upstream adeu PR (Sprint 13 carry; still open).

**ADRs**: 047 (matter schema v2 — schema + split disk + tag-and-group), 049 (bundled MCP spawn-boot smoke test). ADR-048 reserved for Workstream 5 (Sprint 15).

---

### Sprint 13 — Lawyer-shape redline: word-diff in adeu + prompt discipline (closed 2026-05-19, commit `d9c60c0db`)

**Goal**: close the "adeu doesn't redline like a lawyer" carry-forward from Sprint 10 / Sprint 12. Make redline output lawyer-shape: narrow w:ins/w:del at word boundaries, preserved qualifiers retained verbatim, comments emitted when the LLM can't preserve a flagged phrase. Plan at `/root/.claude/plans/brief-sprint-13-noble-kahn.md`.

**Built** — six commit-shaped phases on `main`. Plan-mode investigation surfaced three brief-vs-reality corrections folded into the plan: (a) the brief's premise of a "redline MCP wrapper" between Goose and adeu was wrong — adeu IS the MCP (called directly from Goose); (b) adeu already has the word-diff algorithm internally (`generate_edits_from_text` in `adeu/diff.py:189`), just not invoked on `process_document_batch` — only on `diff_docx_files`; (c) the brief's prompt-template path (`redline-mcp/prompt_templates/*.md`) doesn't exist — the Commercial system prompt is a TS string literal at `systemPrompt.ts`.

- **Phase 1** (`1f1adeb5a`) — ADRs 045 + 046 at decision time. ADR-045 documents the adeu batch-path word-diff vendor patch — its site (engine.py:1609 area, MODIFICATION branch of `_pre_resolve_heuristic_edit`), architectural reasoning (adeu has the algorithm; batch-path wiring is the gap), deletion criterion (upstream merges + we repin). ADR-046 documents Commercial recipe prompt discipline — preserve list, anchor-preservation idiom, failure-mode examples, consequence framing as additions to `systemPrompt.ts`. Brief's 044/045 numbering corrected to 045/046 (ADR-044 = Sprint 12 Top of Mind).

- **Phase 2** (`538894d8e`) — adeu vendor-patch. Adds 33-line word-diff block + one-line import to `_pre_resolve_heuristic_edit` MODIFICATION branch: after `trim_common_context` produces `final_target` / `final_new`, call `generate_edits_from_text` on them; for each returned word-granular sub-edit, anchor `_match_start_index = effective_start_idx + sub_idx`, set `_internal_op` from target/new shape, set `_active_mapper_ref`. Apply_edits already iterates over list returns (engine.py:1162). Patch committed as `docs/redline/adeu-1.6.9-batch-path-word-diff.patch` (51 lines diff against pristine wheel). Sanity-check: `generate_edits_from_text("within thirty (30) days", "within fourteen (14) days")` yields 2 narrow sub-edits ("thirty"→"fourteen", "30"→"14") instead of one wholesale modification. RUNBOOK §Sprint 13 documents apply/verify procedure.

- **Phase 3** (`15ef6a351`) — System-prompt discipline. Four new sections inlined into `ui/desktop/src/components/oscar/commercial/systemPrompt.ts` SYSTEM_PROMPT string literal, after "Things you never do":
  - `# Preserve discipline` — name preserved phrases per edit; emit comment if rewrite can't preserve.
  - `# Anchor-preservation idiom` — concrete WRONG/RIGHT block teaching the LLM to begin `new_text` with a verbatim prefix of `target_text`. Primary cooperator with the adeu word-diff.
  - `# Failure modes to avoid` — WRONG/RIGHT blocks for qualifier-drop (e.g., "to those of its officers and employees on a need-to-know basis") and mandatory-law-catch-out drop (e.g., "or as required by applicable law").
  - `# Consequence framing` — un-explained drops are rejected and reworked by the senior solicitor.
  
  Prompt grew from ~1,600 to ~2,400 tokens. Recipe wiring unchanged — `commercialRecipe.ts` already imports SYSTEM_PROMPT and passes it through `buildPracticeAreaRecipe`. Typecheck: zero errors introduced; 202 pre-existing TS errors in unrelated files (window.electron type drift from Sprint 12 matters IPC) — outside Sprint 13 scope.

- **Phase 4** (`1d5579710`) — Lawyer-shape criteria document. New `docs/redline/lawyer-shape-criteria.md` lifts the implicit Sprint 9 `verification-comprehension.md` criteria into a standalone signed-off contract. Six numbered criteria: OOXML granularity (median ≤ 3 / p80 ≤ 5 / 11+ wraps only for genuine wholesale), preserve discipline, cross-clause consistency, no emphasis-Markdown on substantive text, author propagation, coherence verification. Includes sign-off bar and verification methodology. Living document — refines sprint-over-sprint via ADRs. (The brief's referenced criteria document at `oscar-m2-addendum/.../adeu-lawyer-shape-criteria.md` didn't exist locally; Sprint 13 formalises into the Oscar GC repo.)

- **Phase 5** (`d7ca49d8c`) — End-to-end verification + load-bearing gate. New `scripts/dogfood/verify-redline-shape.py` (OOXML width-distribution inspector with `inspect` + `compare` subcommands; grades against §1 hard gates; surfaces 11+ wraps for human review per criteria §1) and `scripts/dogfood/replay-sprint9-batch.py` (deterministic replay of Sprint 9's exact 8 LLM-emitted (target_text, new_text) pairs through the patched adeu — isolates the patch's effect from LLM variance). Verification report at `docs/dogfood/sprint-13/verification.md`:
  - **Pre-patch baseline** (Sprint 9 `output-cli-verify.docx`): 15 tracked elements, median wrap **60.0 words**, p80 72.4, max 94, all 15 in the 11+ bucket.
  - **Post-patch** (`sprint9-replay-patched.docx`): 68 tracked elements, median wrap **2.5 words**, p80 3.0, max 27. 1-2 word bucket: 34, 3-5: 27, 6-10: 5, 11+: 2.
  - The 2 remaining 11+ wraps are pure INSERTION (27 words; new mutuality sentence appended to preamble, no target text) and pure DELETION (16 words; sentence removed wholesale, replaced structurally) — genuine wholesale per criteria §1, no common ground for word-diff to narrow.
  - **Gate**: PASS. Median Δ -57.5 words, max Δ -67 words. Author propagation PASS (all 68 elements `w:author="Oscar"`).

- **Phase 6** (`56715302c` build-script change; `3caf286eb` + `cd5b251da` lockfile drift + bundle fixes; `oscar-gc-sprint13` draft release) — Bundle the patch into the .deb AND ship it. `prepare-oscar-bundle.js` copies `docs/redline/adeu-1.6.9-batch-path-word-diff.patch` to `src/resources/python/` alongside the wheels (hard-fails the build if the patch is missing — silent skip would ship a non-narrow redline). `postinst.sh` applies the patch via `patch -d <venv-site-packages> -p1` immediately after `pip install adeu==1.6.9`; WARNs (does not fail) if the patch file is missing. Deletion criterion (same as ADR-045): upstream merges + we repin → delete patch-copy in bundle prep, patch-apply in postinst, the `.patch` file. Two latent Sprint 12 bugs surfaced during the actual build on lq-vps and were fixed: (a) lockfile drift from ADR-040 server-filesystem add never propagated to `pnpm-lock.yaml` — fixed by regenerating + committing; (b) `prepareVendoredMcps` looked at `ui/desktop/node_modules` but pnpm hoists workspace-root deps to `ui/node_modules`, and `server-filesystem@2026.1.14` uses top-level await which `format: 'cjs'` rejects — fixed by switching to `require.resolve` + `format: 'esm'` with sibling `package.json {"type":"module"}`. Build produced `oscar-gc_1.34.0_amd64.deb` (249 MB) on lq-vps; dpkg-c verified the patch file + adeu wheel + postinst hook are present. Uploaded as draft release `oscar-gc-sprint13` at `github.com/sarturko-maker/goose/releases/tag/oscar-gc-sprint13`. RUNBOOK §"Known pre-existing pnpm-install issue on lq-vps" updated to "RESOLVED (Sprint 13)" with the two fixes documented.

- **Phase 7** (Crostini dogfood, 2026-05-19) — Arturs installed `oscar-gc_1.34.0_amd64.deb` (260 MB) from the `oscar-gc-sprint13` draft release. First install surfaced a P0 regression (`bc2e601a5`): vendored MCP ESM bundle carried a duplicate `#!/usr/bin/env node` shebang under `format: 'esm'` + esbuild banner, which Node rejected with SyntaxError on line 2. oscar-fs failed to load → Forge had no FS tools and Commercial's matter-folder scope would have been broken too. Fix: drop the banner from `prepareVendoredMcps` (ESM preserves the source's existing shebang). Replacement .deb (`--clobber`) verified to spawn oscar-fs cleanly. Arturs re-installed; app launched (with cosmetic Crostini graphics warnings — `drmGetDevices2()` and `gtk_widget_get_scale_factor`, neither blocking, both expected on Crostini's Wayland/GTK stack per ADR-025's launcher flags). Lawyer-shape redline goal met. Dogfood report at `docs/dogfood/sprint-13/findings.md`. Five UX findings (Forge sidebar alignment, "Client"/"Counterparty" assuming external-counsel framing, no matter-list back-button, no higher-level grouping above matter, Privacy dialog mental-model mismatch) carry forward to Sprint 14 as the load-bearing in-house-framing anchor. Adeu MCP App diff preview also Sprint 14 (now unblocked by ADR-045).

**Deferred** (per brief, "What's NOT in this sprint"):

- New wrapper MCP between Goose and adeu — premature abstraction; vendor-patch is smaller.
- One-adapter-file isolation / adeu-bump RUNBOOK procedure — build when adeu bump becomes routine.
- Counter-propose / counterparty round-2 workflow — Sprint 14+.
- MCP App diff preview — Sprint 14+; TODO.md item "depends on adeu redline-quality fix" is now unblocked.
- Audit log infrastructure, SECURITY.md writeup — Sprint 14 or 15.
- Cross-document directive ceiling (mutual-obligations propagation) — known MiniMax single-shot limit; documented, not designed around.

**Carry-forwards**:

- Phase 7 user Crostini dogfood + sign-off (the actual close gate).
- Upstream adeu PR: file the change against adeu's repo, recommending the opt-in `granularity: 'word' | 'span'` shape so the maintainer is more likely to accept. ADR-045 documents the deletion criterion.
- TODO.md updates after Phase 7: close the "adeu doesn't redline like a lawyer" carry-forward; mark "MCP App diff preview" as unblocked.

**ADRs**: 045, 046.

---

### Sprint 1 — Unmodified Goose builds + MiniMax round-trip (closed 2026-05-17)

**Goal**: build unmodified Goose on `lq-vps` and complete one round-trip via MiniMax. No customisation, no product code. Brief at `SPRINT_1_BRIEF.md`; plan at `/root/.claude/plans/sprint-1-dazzling-tide.md`.

**Built**

- Scaffold commit `71809e347`: `CLAUDE.md`, `PROJECT.md`, `SPRINT_LOG.md`, `RUNBOOK.md`, `DEV_SETUP.md`, `SPRINT_1_BRIEF.md`. DCO-signed; no `Co-Authored-By` trailer (per CLAUDE.md rule).
- System libs per `BUILDING_LINUX.md` + `zip` (discovered gap — see RUNBOOK).
- Hermit-provisioned toolchain: cargo/rustc 1.92.0, node v24.10.0, pnpm 10.30.3, just 1.40.0, protoc 31.1.
- `cargo build --release -p goose-cli` → `target/release/goose` (269M, 16m 50s).
- `cargo build --release -p goose-server` → `target/release/goosed` (259M, 9m 52s).
- `ui/desktop` full bundle via `pnpm run make --targets=@electron-forge/maker-zip` → `ui/desktop/out/make/zip/linux/x64/Goose-linux-x64-1.34.0.zip` (200M, 50s after `zip` apt-installed).
- Round-trip: `goose run --text "Reply with exactly: pong" --no-session` against `MiniMax-M2.5`, exit 0. Transcript:

  ```
      __( O)>  ● new session · minimax MiniMax-M2.5
     \____)    20260517_1 · /srv/projects/goose
       L L     goose is ready

  pong
  ```

  `MINIMAX_API_KEY` sourced from `/srv/projects/lq-ai-agentic/.env` (LQ-AI-shared, $10/mo cap). Never written into the Goose repo.

**Deferred**

- ADR on `--no-session` partial-promise behaviour (writes to `~/.local/share/goose/sessions/sessions.db` and `~/.local/state/goose/logs/` regardless). Captured in RUNBOOK; decision belongs to Sprint 2.
- Persisting MiniMax credentials into `~/.config/goose/secrets.yaml`. Env-var inline was sufficient for Sprint 1.
- `goose-self-test.yaml` end-to-end run — overkill for first round-trip.

**Carry-forwards for Sprint 2**

- UI rewrite seam confirmed: `ui/desktop/src/` (React/TS), build via `pnpm install && pnpm run i18n:compile && pnpm run make`. No backend changes required for pure UI work.
- Memory-MCP seam not yet mapped — Sprint 2 should locate where Goose discovers MCP servers (`crates/goose-mcp/` + the config schema in `~/.config/goose/`).
- Linux config paths confirmed: `etcetera::choose_app_strategy` collapses to XDG on Linux → just `goose`, not `Block/goose`. Relevant when we wire our own secrets/config flow.
- Disk budget after Sprint 1: `target/` 6.3G, `ui/desktop/out/` 767M, `~/.cache/hermit/` 488M, `ui/desktop/node_modules/` ~1.5G. `/srv/` still has 140G+ free.
- Upstream `BUILDING_LINUX.md` gap — `zip` package missing. Worth a one-line PR upstream when we open our first round of contributions.

**ADRs**: none. Sprint 1 made no architectural decisions; the bootstrap path was prescribed by upstream docs.

---

### Sprint 2 — Oscar GC rebrand (branding metadata only) (closed 2026-05-18)

**Goal**: rebrand Goose → Oscar GC in desktop branding metadata only; rebuild zip on `lq-vps` via Sprint 1's pipeline; verify the output filename and in-zip binary reflect the new name. Brief in chat; plan at `/root/.claude/plans/sprint-2-dreamy-wolf.md`.

**Built**

- `ui/desktop/package.json` — `name` (`oscar-gc-app`), `productName` (`Oscar GC`), `description` rebranded.
- `ui/desktop/forge.config.ts` — added `packagerConfig.name = 'Oscar-GC'` + `packagerConfig.executableName = 'oscar-gc'` (load-bearing for the zip filename + in-zip binary name); rebranded protocol name (`OscarGCProtocol`), NSCalendars / NSReminders TCC strings, deb/rpm `name`+`bin`; aligned GitHub publisher fallback `owner` to `sarturko-maker`. `schemes: ['goose']` preserved (ADR-003).
- `ui/desktop/forge.deb.desktop`, `forge.rpm.desktop` — `Name`/`Exec`/`Icon` rebranded to `Oscar GC` / `/usr/lib/oscar-gc/oscar-gc` / `oscar-gc.png`; rpm `Exec` path normalized from upstream's `/usr/lib/Goose/Goose` to lowercase. `MimeType=x-scheme-handler/goose;` preserved (ADR-003).
- `ui/desktop/index.html` — `<title>Oscar GC</title>`. React's `document.title` in `src/` will overwrite at runtime — known gap, ADR-001.
- `docs/adr/` scaffold + ADR-001 (rebrand scope), ADR-002 (zip-name exception), ADR-003 (`goose://` scheme retained). Commit `3d1b0ca18`.
- Zip artefact: `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M). In-zip Electron binary: `Oscar-GC-linux-x64/oscar-gc` (206M). Build commands + `unzip -l` excerpt recorded in RUNBOOK Sprint 2 section. Metadata edit commit `62c9a08a4`.

**Deferred**

- `ui/desktop/src/` references to Goose / `document.title` / `goose://` scheme (14+ call sites) — bundled into a future src/-rewrite sprint per ADR-003. Most visible runtime gap in the rebrand.
- Rust core, system prompt (`crates/goose/src/prompts/system.md`), icons (`ui/desktop/src/images/`) — out of Sprint 2 scope per ADR-001 / CLAUDE.md fork hygiene. App still introduces itself as Goose at runtime; icon stays as Goose's.
- `ui/desktop/scripts/goosey` (line 40 invokes `goose-app` on PATH — broken under the new brand) and macOS bundle scripts in `package.json` L20–22 (`${GOOSE_BUNDLE_NAME:-Goose}` literal default) — defer.
- Flatpak app id `io.github.block.Goose` and deb/rpm `maintainer` / `homepage` strings in `forge.config.ts` — leave on upstream values; revisit when the first non-zip artefact is shipped.

**Carry-forwards for Sprint 3**

- Plan src/-rewrite sprint: rename `goose://` URL scheme atomically (`forge.config.ts` schemes + `.desktop` MimeType + all `src/` literals); update `document.title` call sites; replace branded constants.
- Plan Rust-touch sprint: rebrand `crates/goose/src/prompts/system.md` + any other branded literals in `crates/`.
- Visual identity: design Oscar GC icons (icon.png/.ico/.icns/.svg/-512.png) under `ui/desktop/src/images/`.
- `ui/desktop/scripts/goosey`: rename invocation to `oscar-gc` or remove. Defer until the first Linux PATH installer (.deb/.rpm) is shipped.

**ADRs**: 001, 002, 003.

---

### Sprint 3 — Oscar GC landing placeholder (first `ui/desktop/src/` source change) (closed 2026-05-18)

**Goal**: prove the React source-change → rebuild → bundle-output loop by replacing Goose's `Hub` landing component with a minimal Oscar GC placeholder styled via LQdesign Terminal. First-ever edit to `ui/desktop/src/`. Brief in chat; plan at `/root/.claude/plans/sprint-3-partitioned-papert.md`.

**Built**

- `ui/desktop/src/components/Hub.tsx` (commit `8624a765c`) — collapsed from 117 lines (SessionInsights + ChatInput composition) to 14 lines (Oscar GC placeholder). Same default export + prop signature retained so upstream `HubRouteWrapper` in `App.tsx` continues unchanged (ADR-005).
- `ui/desktop/src/styles/main.css` — added one `@font-face` rule for Inter (variable font, latin subset, weights 100–900 in a single declaration thanks to Google Fonts' variable-font packaging) and one `.oscar-terminal { ... }` block declaring the LQdesign Terminal token subset (`--night`, `--night-raise`, `--glow-txt`, `--glow-mute`, `--indigo-500`, `--copper`, `--sans-product`, `--mono-product`, `--serif`, etc.). Container-scoped — opt-in by adding `.oscar-terminal` to a parent element.
- `docs/adr/004-terminal-default-surface.md` (commit `ce88ddd8e`) — LQdesign Terminal is Oscar GC's default surface (correction mid-planning from the brief's original "Editorial"). Editorial reserved for future exported artefacts only.
- `docs/adr/005-landing-replacement-seam.md` (commit `ce88ddd8e`) — `Hub.tsx` is the seam between upstream Goose chrome (kept) and Oscar GC product code (ours). Future sprints will move the seam up when practice-area work touches `AppLayout`.
- `PROJECT.md` (commit `d22ed1de1`) — new "Fork strategy" section folding what `GOOSE_FORK.md` would have covered: canonical upstream `aaif-goose/goose`, remotes table, `CUSTOM_DISTROS.md` as customization route, weekly upstream-tracking cadence (skip / merge / wait per release). `CLAUDE.md` cold-start chain renumbered 1–8 (removed the broken `GOOSE_FORK.md` reference in 3 places).
- Build + verify: `pnpm install && pnpm run i18n:compile && pnpm run make --targets=@electron-forge/maker-zip` succeeded (~10s after the install warmed). Artefact `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M). `npx @electron/asar extract ui/desktop/out/Oscar-GC-linux-x64/resources/app.asar /tmp/sprint3-asar` then `grep` confirmed all four target strings in the renderer bundle:
  - `Oscar GC` and `In-house legal agent platform` in `App-jlpGwNMf.js`
  - `.oscar-terminal__title` and `.oscar-terminal__subtitle` selectors in `index-BSKYEipJ.css`
  - Inter variable woff2 URL (`fonts.gstatic.com/s/inter/v20/UcC73Fwr…`) in `index-BSKYEipJ.css`

**Deferred**

- `JetBrains Mono` + `Cormorant Garamond` `@font-face` binaries — tokens declared (`--mono-product`, `--serif`) but no binary loaded. First component to render with those families triggers the addition.
- Visual smoke test on a GUI host — `lq-vps` is headless. Brief's exit criteria are grep-based (all met). First sprint to run the desktop app under a GUI (or via xvfb) confirms visually.
- Rebranding `OnboardingGuard`'s "Welcome to goose" — counted under PROJECT.md branding follow-up #1 (`src/` branded literals).

**Carry-forwards for Sprint 4**

- Practice-area navigation skeleton (the brief's "out of Sprint 3 scope" item) — almost certainly requires touching `AppLayout.tsx`. When that happens, write the ADR that supersedes ADR-005.
- Whether to consolidate `.oscar-terminal` styles into a reusable React layout/component as the surface expands beyond one placeholder. Premature for Sprint 3 (one consumer); revisit at second consumer.
- Decide whether to vendor the Inter woff2 locally (offline-safe) once Sprint 4 starts shipping to operators with offline expectations. Sprint 3's CDN URL is stable for now but versioned (`v20`).

**ADRs**: 004, 005.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read due 2026-05-25.

---

### Sprint 4 — Practice-area navigation (closed 2026-05-18)

**Goal**: replace Goose's upstream sidebar (NavigationPanel grid + sessions list) with an Oscar GC practice-area sidebar; route each entry to a shared placeholder page. First sprint to touch `AppLayout` under product control. Brief in chat; plan at `/root/.claude/plans/sprint-4-snazzy-matsumoto.md`.

**Built**

- `ui/desktop/src/components/oscar/` (new namespace, commit `5765ed09b`):
  - `practiceAreas.ts` — 13-entry `as const` config with derived `PracticeAreaId`. Brief listed 10 (claude-for-legal's 9 + CoSec); at plan-time the generic "Litigation" entry was replaced by four area-scoped dispute sub-areas (Commercial / Employment / IP / Regulatory Disputes) — deliberate Arturs-approved deviation reflecting in-house reality.
  - `OscarSidebar.tsx` — pure-render vertical list of `<Link>` items. Consumes only `useLocation`. Fills `w-full h-full` (honours `AppLayout.tsx:276-285` wrapper contract). Ignores `effectiveNavigationStyle` / `isCondensedIconOnly` / `isHorizontalNav` for Sprint 4 (single render style; documented in ADR-006).
  - `PracticeAreaPlaceholder.tsx` — reads `:areaId`, looks up via `PRACTICE_AREAS.find`, renders `{name} — placeholder.` + per-area body inside `.oscar-terminal`. Per-area body copy is draft, grounded in the in-house profile/instruction/cross-element-fetch model Arturs described; refining is a one-line edit per entry.
- `ui/desktop/src/styles/main.css` (commit `5765ed09b`) — appended seven BEM selectors inside the existing `.oscar-terminal` scope: `__sidebar`, `__sidebar-list`, `__sidebar-item(--active)`, `__placeholder-title`, `__placeholder-body`. Indigo-500 left-border + glow-txt label on active; night-rule hover. No Tailwind config or token-block touch.
- `ui/desktop/src/components/Layout/AppLayout.tsx` (commit `5765ed09b`) — 3-line surgical edit. Line 10 import `Navigation` → `OscarSidebar`; both `<Navigation />` invocations (line 284 push + 305 overlay) swapped. Push/overlay animation, resize handle, Menu trigger, `NavigationProvider` chain all preserved. `NavigationProvider` stays mounted because `BaseChat:100-102`, four `settings/app/Navigation*Selector` components, and `AppSettingsSection` all consume `useNavigationContext()`.
- `ui/desktop/src/App.tsx` (commit `5765ed09b`) — `<Route path="practice/:areaId" element={<PracticeAreaPlaceholder />} />` inside the existing `/` block as sibling of `skills`; plus the import. Hub remains at `/`.
- `docs/adr/006-practice-area-nav-and-applayout-seam.md` (commit `5765ed09b`) — supersedes ADR-005. New seam: anything reachable via `<OscarSidebar />`, routes under `/practice/`, the `oscar/` component namespace, or the `.oscar-terminal` style scope is ours; everything else in `ui/desktop/src/` is upstream-tracked.
- Build + verify: `pnpm run lint:check` clean (typecheck + eslint `--max-warnings 0` + i18n). `pnpm run make --targets=@electron-forge/maker-zip` produced `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M). `npx @electron/asar extract` → `/tmp/sprint4-asar`. Grep confirmed all 13 practice-area names in `App-31IiCtoy.js`, the `practice/` route segment in the same bundle, and all 6 new BEM selectors in `index-CPW342l2.css`.

**Deferred**

- Visual GUI smoke test — `lq-vps` headless (Sprint 3 carry-forward unresolved). Grep verification met the brief's exit criteria; clicking through each practice area in the dev server is still a future GUI-host task.
- `JetBrains Mono` and `Cormorant Garamond` `@font-face` binaries — punted again (Sprint 3 deferral; no new consumer this sprint).
- Optional sidebar header (Oscar GC wordmark / "Practice areas" eyebrow) — visual polish, no functional impact.
- `/` redirect-to-default-practice-area — product-policy decision; needs explicit sign-off and probably user-pref scope.
- Hub.tsx relocation to `components/oscar/Hub.tsx` for namespace consistency — Sprint 3 placement honoured; relocate when Hub is next touched substantively.
- Orphan-file cleanup: `components/Layout/NavigationPanel.tsx`, `hooks/useNavigationItems.ts`, `hooks/useNavigationSessions.ts`, `components/Layout/navigation/` — no consumers after Sprint 4, intentionally not deleted; deletion is a separate ADR-tracked decision.
- Per-area placeholder body refinement once primary-unit schema is real — Sprint 5+.
- Configurable practice-area list (JSON / config-server / per-tenant) — explicitly out of Sprint 4 per brief.

**Carry-forwards for Sprint 5**

- Primary-unit schema (Customer / Vendor / Supplier / Entity / Stream — per-area variants) is the next product step. Placeholder pages can be replaced one-by-one as schemas land.
- Decision: when to delete the orphan upstream nav files. Sooner is cleaner; later preserves the option to revive Goose chrome. Suggest folding into Sprint 5 or a focused cleanup sprint.
- Decision: should `/` redirect to a chosen practice area, or stay as the Hub landing? Product-policy + maybe user-pref.

**ADRs**: 006.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read due 2026-05-25 (unchanged from Sprint 3 schedule).

---

### Sprint 5 — Minimal in-house memory MCP server (closed 2026-05-18)

**Goal**: stand up a minimal in-house memory MCP server in a sibling repo, register it with the Goose CLI, and verify a Goose agent session can store and retrieve notes through it. No UI work, no semantic search, no per-user / team policy. Brief in chat; plan at `/root/.claude/plans/read-claude-md-and-the-wondrous-crayon.md`.

**Built** (cross-project: this sprint creates a sibling repo and edits Goose-fork host config; no commits in this repo's source tree)

- New sibling repo: `sarturko-maker/oscar-memory-mcp` at `/srv/projects/oscar-memory-mcp/`. Initial commit `0f17df00f` ("sprint(5): scaffold oscar-memory-mcp + two-tool MCP server"); README tool-name fix follow-up `aac60c5bb` ("docs: fix tool-name prefix (hyphen, not underscore)"). TypeScript MCP server, ~150 LoC across `src/{index,server,store}.ts`. Pinned dependencies: `@modelcontextprotocol/sdk@=1.29.0`, `zod@=4.4.3`, `typescript@=6.0.3`, `@types/node@=25.8.0`. Apache 2.0 licence. Standalone smoke test via `pnpm smoke` (uses the SDK's `Client` + `StdioClientTransport`).
- Two MCP tools exposed: `store_note(scope_id, body)` and `list_notes(scope_id)`. Goose namespaces them as `oscar-memory__store_note` and `oscar-memory__list_notes` (literal extension-key prefix, hyphen preserved). Persistence: flat JSON file at `~/.local/share/oscar-memory/notes.json` with atomic write (tmp + fsync + rename).
- Three ADRs in the sibling repo, all sibling-repo SHA `aac60c5bb`:
  - [`docs/adr/001-persistence-json.md`](https://github.com/sarturko-maker/oscar-memory-mcp/blob/aac60c5bb/docs/adr/001-persistence-json.md) — flat JSON + atomic write; SQLite migration triggers documented.
  - [`docs/adr/002-scope-id-a-class.md`](https://github.com/sarturko-maker/oscar-memory-mcp/blob/aac60c5bb/docs/adr/002-scope-id-a-class.md) — `scope_id` is A-class for Sprint 5 (LLM extracts from prompt); migrates to B-class when the desktop UI injects per-element context.
  - [`docs/adr/003-licence-apache.md`](https://github.com/sarturko-maker/oscar-memory-mcp/blob/aac60c5bb/docs/adr/003-licence-apache.md) — Apache 2.0 to match upstream Goose.
- Host-state changes captured in RUNBOOK Sprint 5 section: the new YAML stanza in `~/.config/goose/config.yaml`, the bootstrap order, the verification recipe, the YAML-colon gotcha.
- End-to-end verification: two `goose run --debug --no-session` invocations against `MiniMax-M2.5`. Run 1 (`oscar-memory__store_note`): `▸ store_note oscar-memory` header printed, server returned `{"ok":true,"scope_id":"acme-customer-001","created_at":"2026-05-18T10:19:34.617Z"}`. Run 2 (`oscar-memory__list_notes`): `▸ list_notes oscar-memory` header printed, server returned the stored note, the agent reproduced the body in its final response. Independent file inspection of `~/.local/share/oscar-memory/notes.json` confirmed the persisted record matched what was stored — eliminates the LLM-hallucinated-success failure mode.

**Deferred**

- Semantic search / embedding retrieval — explicitly out of Sprint 5 scope; persistence ADR captures the migration trigger (~10k notes or first vector-search consumer).
- Per-user vs team-shared memory policy — explicitly out of Sprint 5 scope; server is single-store, no scope hierarchy.
- Authentication / multi-tenant concerns — explicitly out.
- Wiring the memory server into the Oscar GC desktop binary's MCP registration — explicitly out; Sprint 5 only proves the server works against the CLI.
- `scope_id` B-class migration — deferred to whenever the desktop UI starts injecting per-element context (Sprint 6 or later); ADR-002 in the sibling repo documents the migration path.
- Visual GUI smoke test on the desktop binary — N/A this sprint (memory MCP is headless server work; no UI touched).

**Carry-forwards for Sprint 6**

- **Sprint 6 anchor decision** (deferred from the brief): pick one of (a) wire the Oscar GC desktop's MCP config to load `oscar-memory` automatically; (b) build the onboarding flow (per-user practice-area selection). Decision criteria: which surfaces more product value first. Both are unblocked by Sprint 5's completion.
- The persistent extension entry in `~/.config/goose/config.yaml` is host-scoped and points at an absolute path under `/srv/projects/oscar-memory-mcp/`. Anyone cloning the sibling repo elsewhere must update the YAML — flagged in RUNBOOK.
- `dist/index.js` is gitignored. A fresh `lq-vps` rebuild needs `pnpm install && pnpm build` in the sibling repo BEFORE Goose runs, otherwise the extension fails to spawn (with a tee'd stderr warning, not a hard error). Bootstrap order documented in RUNBOOK.
- Tool naming includes a hyphen (`oscar-memory__store_note`) because Goose's tool prefix uses the literal extension key. If `oscar-memory` ever migrates to `oscar_memory` for consistency, every prompt or ADR referencing the hyphenated form needs a sweep.

**ADRs**: none in this repo. The three Sprint 5 ADRs live in the sibling repo (cross-referenced above). This is intentional: the architectural decisions are entirely about the new server's shape, not about the Goose fork.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read due 2026-05-25 (unchanged).

---

### Sprint 4.5 — Visual fidelity audit and gap closure against LQdesign Terminal (closed 2026-05-18)

**Goal**: bring Oscar GC's visible UI into actual visual alignment with LQdesign Terminal — "as close as possible to LegalQuants design." Sprint 4 verified design tokens via grep but the screenshots showed only Inter rendering, no mono treatment, a barely-visible sidebar active state, and no orb-glow brand-mark treatment. Close those gaps. Brief in chat; plan at `/root/.claude/plans/sprint-4-5-valiant-hippo.md`.

**Audit findings — gap inventory**

| Surface | LQdesign Terminal spec | Sprint 4 actual | Disposition |
|---|---|---|---|
| Inter `@font-face` | loaded (CDN) | loaded | unchanged |
| JetBrains Mono `@font-face` | loaded | **missing** — silent fallback to Menlo | **closed** — added CDN `@font-face` |
| Cormorant Garamond `@font-face` | loaded (Editorial use) | **missing** — silent fallback to Georgia | **closed (load)** — application deferred |
| Hub hero | Inter 900 `clamp(48px, 8vw, 128px)` | matches | unchanged |
| Hub eyebrow | `.tm-eyebrow` mono 12px / 0.3em / indigo-400 / uppercase | absent | **closed** — `OSCAR // GENERAL COUNSEL` |
| Hub orb glow | `rgba(99,102,241,0.15)` blurred radial behind wordmark | absent | **closed** — CSS-only blurred radial behind title block |
| Sidebar section header | mono eyebrow | absent | **closed** — `PRACTICE // AREAS` |
| Sidebar numerics | mono prefix per item | absent | **closed** — `01`–`13` JetBrains Mono prefix |
| Sidebar active state | indigo-tinted (per `.pill-on` style) | `--night-edge` bg sitting ~11 luminance points above `--night-raise` (too subtle) | **closed** — `rgba(99,102,241,0.10)` bg, `#fff` text, indigo-400 numeric |
| Placeholder eyebrow | mono uppercase per-area | absent | **closed** — `// {AREA NAME}` |
| Brand-mark element | LQ uses SVG wordmark | plain HTML text | **deferred** — no Oscar GC SVG mark; commissioning is a separate design task |
| Copper accent | shared signature, rare in Terminal | token declared, unused | **deferred** — no surface needs it yet |
| Pill / card / button classes | defined in LQ components | not implemented | **deferred** — no consumer in Sprint 4.5 |
| Hub-as-Editorial (Cormorant display hero) | LQ has Editorial display surfaces | Terminal Inter 900 | **deferred** — separate ADR sprint per user decision |

**Built**

- `ui/desktop/src/styles/main.css` (commit `07ec54977`) — appended `@font-face` blocks for JetBrains Mono (variable 400–700, latin subset, Google Fonts CDN) and Cormorant Garamond (three normal weights 400/500/700 + 500-italic, latin subset, CDN). Mirrors Sprint 3's Inter precedent — no binary blobs in repo, no Vite-bundling step. The variable declarations at `main.css:974-975` already referenced these families; the Sprint 3 carry-forward "decide whether to vendor Inter locally" remains a future call (still pre-pilot; no offline guarantee needed).
- `ui/desktop/src/styles/main.css` (commit `170649bc6`) — appended `.oscar-terminal__eyebrow`, `.oscar-terminal__sidebar-eyebrow`, `.oscar-terminal__sidebar-item-num`, `.oscar-terminal__title-glow` (+ `::before` orb pseudo-element); modified `.oscar-terminal__sidebar-item--active` to indigo-tinted treatment (`rgba(99,102,241,0.10)` bg, `#fff` text). Orb values match LQ's `brand-wordmark-terminal.html` orb verbatim (`rgba(99,102,241,0.15)`, `border-radius: 50%`, `filter: blur(80px)`). Orb is bounded to `max-width/height: 600px` and uses `pointer-events: none` to stay non-interactive.
- TSX wiring (commit `ea03f6032`):
  - `components/Hub.tsx` — wraps eyebrow + title + subtitle in `<div className="oscar-terminal__title-glow">`. Eyebrow text "OSCAR // GENERAL COUNSEL".
  - `components/oscar/OscarSidebar.tsx` — adds `<div className="oscar-terminal__eyebrow oscar-terminal__sidebar-eyebrow">PRACTICE // AREAS</div>` at the top of `<nav>`; switches `.map((area) => …)` to `.map((area, idx) => …)`; renders a 2-digit `String(idx + 1).padStart(2, '0')` numeric prefix `<span>` inside each `<Link>`.
  - `components/oscar/PracticeAreaPlaceholder.tsx` — adds `<span className="oscar-terminal__eyebrow">// {area.name.toUpperCase()}</span>` above the placeholder title.
- Build + verify: `pnpm run i18n:compile` clean; `pnpm run make --targets=@electron-forge/maker-zip` produced `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M, ~50s); `npx tsc --noEmit` clean. `npx @electron/asar extract` → `/tmp/sprint-4.5-asar/`. Grep confirmed all four bundled @font-face blocks for Cormorant Garamond, the single JetBrains Mono `tDbv2o-…` URL, the four new BEM selectors, and the two literal eyebrow strings (`OSCAR // GENERAL COUNSEL`, `PRACTICE // AREAS`) in `index-BO_eAhwN.css` and the renderer JS bundle.
- Screenshots (commit `9a1b66a53`) — re-captured under `docs/screenshots/sprint-4.5/` via `scripts/capture-oscar.sh`. Default three routes plus a second invocation for `/#/practice/cosec` to confirm numerics render at index 13 and the active treatment is identical at every list position.

**Side-by-side**

| Route | Sprint 4 | Sprint 4.5 | Change |
|---|---|---|---|
| `/` | `sprint-4/root.png` (44k) | `sprint-4.5/root.png` (112k) | Indigo orb glow behind title; `OSCAR // GENERAL COUNSEL` mono eyebrow above; sidebar has `PRACTICE // AREAS` eyebrow + `01`–`13` numerics. |
| `/#/practice/commercial` | `sprint-4/practice-commercial.png` (46k) | `sprint-4.5/practice-commercial.png` (55k) | `// COMMERCIAL` eyebrow above title; active sidebar row 01 visibly indigo-tinted with `#fff` label + indigo-400 numeric. |
| `/#/practice/commercial-disputes` | `sprint-4/practice-commercial-disputes.png` (46k) | `sprint-4.5/practice-commercial-disputes.png` (56k) | Same pattern, row 02 active. |
| `/#/practice/cosec` | not captured | `sprint-4.5/practice-cosec.png` (54k) | Confirms `13` prefix and bottom-of-list active treatment. |

**Deferred**

- **Cormorant Garamond application** — Hub-as-Editorial display hero, or a narrower Editorial accent on placeholder titles. Both require a sibling ADR to ADR-004 ("Editorial typographic accents within Terminal structural shell"). Loaded the font; chose not to apply per Arturs-locked plan-mode decision.
- **Oscar GC SVG wordmark** — the current HTML text + indigo orb is the closest Sprint 4.5 can get without a designed mark. PROJECT.md branding follow-up #4 (icons) is the adjacent task; a wordmark mark would slot alongside it.
- **Copper accent application** — `--copper`/`--copper-light` declared, no consumer. The surface that needs the shared-signature accent determines the application.
- **Pill / card / button component classes** — LQ defines them; we add when first consumer appears, not preemptively.
- **Sidebar grouping** (litigation / transactional / operational) — 13 flat entries today. Grouping with sub-section eyebrows is a separate visual upgrade.
- **Self-hosting fonts vs CDN** — Sprint 3 carry-forward still alive; Sprint 4.5 continued CDN. Revisit when offline guarantees become a pilot requirement.
- **Hub-as-Editorial** — the brief's open question. Plan-mode decision: load only, defer application. Future sprint owns the ADR if Editorial accents land in Terminal.

**Carry-forwards for Sprint 6**

- Sprint 4.5 closes ADR-006's deferred font carry-forward and Sprint 4's "optional sidebar header" + "visual GUI smoke test" carry-forwards. The remaining Sprint 4 carry-forwards (orphan-file cleanup, `/`-redirect product policy, per-area body refinement, configurable practice-area list) are unchanged.
- Sequencing note: Sprint 4.5 ran after Sprint 5 chronologically (Sprint 5 closed earlier on 2026-05-18) but slots between Sprint 4 and Sprint 5 numerically. PROJECT.md Sprint Index orders by number; SPRINT_LOG keeps execution order.

**ADRs**: none. The Cormorant-application and Hub-as-Editorial decisions are deferred to a future sprint that will write the ADR at decision time per CLAUDE.md.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.

---

### Sprint 4.6 — Editorial as Oscar GC's default surface; ADR-004 superseded (closed 2026-05-18)

**Goal**: respond to Arturs's reading of Sprint 4.5 ("we are still in dark mode and I cannot believe the fonts tally with the design") by re-reading `/srv/projects/LQdesign/` from scratch, no assumptions, and bringing Oscar GC into actual alignment with LegalQuants. The Sprint 4.5 brief had flagged this as the open question — Hub-as-Editorial; flag, don't switch. This sprint switches, with the ADR-004 supersession in writing.

**What Sprint 4.5 got wrong**

- Loyal to ADR-004 (Terminal default), but ADR-004's premise — "Oscar GC is a desktop product, Terminal is for products" — read "product" as load-bearing. The LQdesign folder treats "LegalQuants" as load-bearing: Terminal's stated scope is narrow ("legalquants.com, the cohort product, landing pages, dashboards" — the marketing surface), and every published LegalQuants artefact (`index.html`, `Masdar Proposal.html`, `lq-report.html`) is Editorial.
- Two of the brand's three "hinge" elements (Cormorant Garamond + copper, per the README) were off-screen: Cormorant loaded-but-unused, copper declared as a token with zero consumers.
- The wordmark rendered as a monolithic Inter 900 block — missing both wordmarks' contrast pattern ("Legal" plain + "Quants" emphasized, copper italic in Editorial / indigo gradient in Terminal).

**Built**

- `docs/adr/007-editorial-default-surface.md` (commit `f00287760`) — supersedes ADR-004. Written before any code change per CLAUDE.md "ADRs at decision time".
- `ui/desktop/src/styles/main.css` (commit `4e66342dc`):
  - Two new `@font-face` blocks via Google Fonts CDN: **Outfit** (variable 300–700) and **IBM Plex Mono** (static 400/500/600). Latin subset, matches Inter's `unicode-range`.
  - Renamed `.oscar-terminal` → `.oscar` everywhere (the name no longer encodes a surface choice).
  - Token flip: `--night`/`--glow-*`/`--indigo-*` removed; `--paper`/`--ink-*`/`--copper`/`--rule-*`/`--card-bg`/`--card-border` in. `--serif`, `--sans-editorial`, `--mono-editorial` are the active font variables.
  - New element classes — `.oscar__hero` + `.oscar__hero-em` (Cormorant 700 / italic copper accent), `.oscar__rule` (48×3 copper), `.oscar__subtitle` (Outfit 14/1.7), `.oscar__placeholder-title` + `.oscar__placeholder-title-em` (Cormorant 500/42px, italic copper), `.oscar__placeholder-body` (Outfit 13/1.7), `.oscar__eyebrow` (IBM Plex Mono 9px/0.2em/copper with trailing hairline rule via `::after`), `.oscar__sidebar` (paper-deep), `.oscar__sidebar-item--active` (copper-glow bg + copper border-left), `.oscar__sidebar-item-num` (IBM Plex Mono 10px ink-faint, flips to copper on active).
  - Orb-glow CSS removed. Paper-grain fractal-noise SVG overlay added on `.oscar::after` (0.04 opacity), matching `.ed-page::after`.
- `ui/desktop/src/components/Hub.tsx`, `OscarSidebar.tsx`, `PracticeAreaPlaceholder.tsx` (commit `59e04c8b4`) — rewired to `.oscar*` selectors and the Editorial cover/section structure:
  - Hub: eyebrow "Office of the General Counsel" + hero "Oscar `GC.`" (italic copper on `GC.`) + copper rule + Outfit subtitle.
  - Sidebar: "Practice Areas" eyebrow (replaces "PRACTICE // AREAS"); `01–13` numerics restyled via CSS (no JSX change beyond class rename).
  - Placeholder: per-area copper eyebrow + Cormorant title with italic-copper "— placeholder." accent + Outfit body.
- Build + verify: `pnpm run make --targets=@electron-forge/maker-zip` succeeded; `npx tsc --noEmit` clean. Bundle grep confirmed all four font families, the new `.oscar*` selectors, the brand strings, the font URLs, and the copper hex `9a3412` in the renderer CSS bundle.
- Screenshots (commit `849482256`) — re-captured under `docs/screenshots/sprint-4.6/`: root, commercial, commercial-disputes, cosec. The Editorial rendering is visibly different and visibly LegalQuants — paper cream, copper italic on the wordmark, IBM Plex Mono copper eyebrows with hairline rule, copper-glow active rail state.

**Side-by-side**

| Route | Sprint 4.5 (Terminal) | Sprint 4.6 (Editorial) | Change |
|---|---|---|---|
| `/` | `sprint-4.5/root.png` (112k) — dark, indigo orb, Inter 900 "Oscar GC" | `sprint-4.6/root.png` (612k) — cream paper, Cormorant 700 + italic copper "GC.", 48×3 copper rule, Outfit subtitle | Full surface flip; LegalQuants wordmark contrast pattern adopted. |
| `/#/practice/commercial` | `sprint-4.5/practice-commercial.png` (55k) | `sprint-4.6/practice-commercial.png` (608k) | Sidebar row 01 active in copper-glow with copper "01"; "Commercial — placeholder." with italic-copper "— placeholder." |
| `/#/practice/commercial-disputes` | `sprint-4.5/practice-commercial-disputes.png` (56k) | `sprint-4.6/practice-commercial-disputes.png` (610k) | Same pattern, row 02 active. |
| `/#/practice/cosec` | `sprint-4.5/practice-cosec.png` (54k) | `sprint-4.6/practice-cosec.png` (607k) | Row 13 active — confirms treatment scales to bottom of list. |

**Deferred**

- **Oscar GC SVG wordmark** — text-rendered Cormorant + italic copper now closes most of the "brand mark application" gap from Sprint 4.5 without a designed mark. A bespoke Oscar GC SVG (mirroring `wordmark-editorial.svg`'s structure with the LegalQuants wordmark replaced) is still a separate branding task per PROJECT.md follow-up #4.
- **`.ed-page-rule` top-of-page treatment** — placeholder pages currently centre content rather than render the LQ page-rule pattern (1px rule across the top with 48px×3px copper accent at the left). Adopt when placeholder pages become real practice-area surfaces in a later sprint.
- **`.ed-callout` / `.ed-quote` / `.ed-card` patterns** — defined in LQ's `editorial.css`; not yet used because there's no content to host them. Add when the first real consumer appears.
- **Terminal accent surface** — if Oscar GC ever needs a Bloomberg-style dashboard or logs view, it lands as a Terminal-accent surface inside the Editorial structural shell, with its own ADR.
- **Inter and JetBrains Mono fonts** — still loaded but unused in product surfaces. Cost is one extra CDN connection; removal is mechanical (delete two `@font-face` blocks in `main.css`). Keep for now in case the Terminal-accent surface above lands.
- **Self-hosting all five font families** — Sprint 3 carry-forward still alive, now with five families to vendor instead of three. Revisit at pilot stage.

**Carry-forwards for Sprint 6**

- Sprint 6 anchor decision (carried from Sprint 5): wire `oscar-memory` MCP into the desktop binary's MCP config, or build the onboarding flow. Editorial surface now in place to host either.
- Sprint 4.6 closes the visual-fidelity carry-forwards from Sprints 3, 4, 4.5. The remaining Sprint 4 carry-forwards (orphan-file cleanup, `/`-redirect product policy, per-area body refinement, configurable practice-area list) are unchanged.

**ADRs**: 007 (supersedes 004).

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.

---

### Sprint 6 — First-launch onboarding as an agent-driven interview (closed 2026-05-18)

**Goal**: replace the empty post-Hub state with a one-conversation onboarding interview. A first-launch lawyer talks to an agent — name, role, company, practice scope, provider — and emerges with `~/.config/oscar/profile.json` written. The sidebar then reflects what they actually do, not a hardcoded 13. Pattern reference: `anthropics/claude-for-legal` cold-start-interview, departed from at the structural level (one unified interview, not nine per-plugin). Brief in chat; plan at `/root/.claude/plans/comprehensive-rewrite-sprint-stateless-wombat.md`.

**Built** (split across this repo and the new sibling `sarturko-maker/oscar-onboarding-mcp`)

- **New sibling repo `oscar-onboarding-mcp`** at `/srv/projects/oscar-onboarding-mcp/`. TypeScript MCP server, ~130 LoC across `src/{index,server,store,schema}.ts`. Single tool `finalize_profile(profile)` that validates against a Zod schema (`ProfileSchema`, versioned with `schema_version: 1`) and atomically writes `~/.config/oscar/profile.json` (mkdir → write tmpfile → fsync → rename). Pinned deps: `@modelcontextprotocol/sdk@=1.29.0`, `zod@=4.4.3`, `typescript@=6.0.3`. Apache 2.0. Three sibling-repo ADRs (persistence-JSON / all-args-A-class / Apache 2.0) mirroring `oscar-memory-mcp`'s skeleton. Initial commit `82266afce` on the sibling repo (local only — see "Push pending" below).
- **Seven ADRs** in this repo, committed before any implementing code (`a5b7e0323`):
  - 008 — Recipe is the vehicle for the onboarding agent.
  - 009 — Tool surface lives in a new sibling MCP server; recipe whitelist locks scope.
  - 010 — System-prompt structure (four phases, hard tool-call exit, pushback rules).
  - 011 — Profile schema (v1) at `~/.config/oscar/profile.json`; forward-compat fields.
  - 012 — Provider config is env-var-only for Sprint 6; pasted-key flow deferred.
  - 013 — Dedicated `<OscarOnboardingView>` chat surface, not BaseChat reuse.
  - 014 — Post-onboarding lands at Hub; sidebar carries the visible delta.
- **`oscar-onboarding` extension registered globally** in `~/.config/goose/config.yaml` (stanza mirrors `oscar-memory`). CLI verified end-to-end via `goose run --debug --no-session --text "Use the oscar-onboarding__finalize_profile tool..."` — tool header printed, profile JSON written to a tmp `OSCAR_PROFILE_PATH`, structure inspected on disk.
- **Onboarding implementation** (commit `f1b62304d`, lint fix `8ff1a8a05`):
  - `ui/desktop/src/components/oscar/onboarding/` — `systemPrompt.ts` (four-phase contour, persona, exit rules, embedded default-area seed for the agent to reference verbatim), `onboardingRecipe.ts` (Recipe constant with extension whitelist + minimax/M2.5 settings + hardcoded `/usr/bin/node`), `OscarOnboardingView.tsx` (~110 LoC; bootstraps session, consumes `useChatStream`, renders messages), `OscarChatTurn` + `OscarChatInput` (~75 LoC combined; Editorial shell around shared Goose infrastructure), `OscarOnboardingGuard.tsx` (polls profile every 1.5s, renders view if absent else children).
  - `ui/desktop/src/components/oscar/hooks/` — `useOscarProfile` (reads profile via IPC, optional poll), `usePracticeAreas` (returns profile's areas or default seed).
  - `ui/desktop/src/styles/main.css` — `.oscar__chat-*` block (~160 LoC) using ADR-007 Editorial tokens (paper / ink / copper / serif / sans-editorial / mono-editorial). No new Tailwind config.
  - `ui/desktop/src/main.ts` + `preload.ts` — `oscar:read-profile` IPC handler. Bridged through preload as `window.electron.readOscarProfile()`.
  - `ui/desktop/src/sessions.ts` — additive: `createSession()` now accepts `recipe?: Recipe` in options, sets `body.recipe` directly without a deepLink decode roundtrip.
  - `ui/desktop/src/components/oscar/practiceAreas.ts` — adds `source: "default"` to every entry; type widened to `interface PracticeArea` with `source: PracticeAreaSource`. Default seed remains in-tree as the fallback for pre-onboarding state.
  - `ui/desktop/src/components/oscar/OscarSidebar.tsx` and `PracticeAreaPlaceholder.tsx` — swap their static `PRACTICE_AREAS` import for `usePracticeAreas()`.
  - `ui/desktop/src/App.tsx` — wraps the existing `<OnboardingGuard>`'s children with `<OscarOnboardingGuard>`. Two guards stack: Goose's owns provider, ours owns profile.
- **Reuse vs not-reuse** — uses Goose's `useChatStream`, `createSession`, `getTextAndImageContent`, `Message` / `ChatState`, `getInitialWorkingDir`, `errorMessage`. Does not reuse `UserMessage` (313 LoC; edit/fork/copy/images/timestamps), `GooseMessage` (215 LoC; tool-call cards, thinking blocks, confirmations), `ChatInput` (1862 LoC; voice/attachments/slash/history), or `MarkdownContent` (315 LoC; katex/syntax-highlighter). ADR-013 rationale plus the per-component evidence in the chat-thread transcript.
- **Build + verify** — `pnpm run lint:check` clean (typecheck + eslint `--max-warnings 0` + i18n). `pnpm run make --targets=@electron-forge/maker-zip` produced `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M). `npx @electron/asar extract → /tmp/sprint6-asar/`. Grep confirmed all 9 `.oscar__chat-*` selectors in CSS, the system prompt opening line, the `oscar-onboarding` extension name, and `finalize_profile` in the renderer App JS, and the `oscar:read-profile` channel + `OSCAR_PROFILE_PATH` env name in `main.js` / `preload.js`.
- **Screenshots** (`f1b62304d` follow-on `e…`; under `docs/screenshots/sprint-6/`):
  - `onboarding-empty.png` (499k) — first launch, profile absent, Editorial chat surface with greeting and input. No toast errors.
  - `onboarding-mid-conversation.png` (519k) — driven by `capture-conversation.mjs`: user types "Arturs Sliede.", MiniMax-M2.5 responds in the agent's voice asking for role + company. Proves the streaming wiring and the system prompt's P1 contour.
  - `root.png` (620k) — post-onboarding Hub at `/`; sidebar reflects the profile's 9 entries (8 defaults + 1 user-added "Procurement") numbered 01–09.
  - `practice-custom-procurement.png` (614k) — `/practice/custom-procurement` renders the placeholder with the body the agent wrote; row 09 active in copper.
  - `practice-commercial-disputes.png` (617k) — default-area route after onboarding, row 02 active.

**Deferred**

- **Pasted-key flow** — ADR-012 already records this. Sprint 6 supports env-var-set MiniMax only. The agent's wrap message asks the user to set `MINIMAX_API_KEY` and restart if it's missing; `finalize_profile` is never called in that branch.
- **Per-practice-area cold-start interviews** — the claude-for-legal-style per-plugin pattern. Optional, on-demand, later sprint. Schema's per-area additive fields are forward-compatible.
- **Settings page to re-run / edit onboarding** — out of scope. The lawyer hand-edits `~/.config/oscar/profile.json` for now.
- **Multi-provider switching in the conversation** — schema's `provider.kind` is a discriminator; UX is a later sprint.
- **Memory MCP wiring into the desktop binary** — Sprint 5 carry-forward, still deferred to Sprint 7+. Sprint 6 establishes profile + per-area context, so `scope_id` is now resolvable from practice-area state for the future B-class migration.
- **`onboarding-mid-conversation.png` toast** — the "Successfully loaded 1 extension" toast appears in the upper-right when the recipe whitelist resolves the oscar-onboarding extension; harmless but visible. Toast suppression for the onboarding surface is cosmetic-only carry-forward.
- **Production-grade `node` path** — the recipe hardcodes `/usr/bin/node` for the dev VPS. Shipping `.deb`/`.rpm` will bundle node or use a search path; ADR-008's hardcoded-path note documents the constraint.

**Carry-forwards for Sprint 7**

- **Push `oscar-onboarding-mcp` to GitHub.** The classifier blocked the initial `gh repo create sarturko-maker/oscar-onboarding-mcp --public` action. Sprint 6's sibling-repo work is committed locally at `/srv/projects/oscar-onboarding-mcp/` (initial commit `82266afce`). The remote push needs Arturs's explicit one-shot approval (or a permission rule add); deferring to the start of the next session to avoid blocking sprint close.
- **Memory MCP wiring into the desktop binary** — Sprint 5 carry-forward, still alive. The profile now exists, so per-area `scope_id` is well-defined when the wiring lands.
- **Per-element surfaces** (Customer / Entity / Stream) inside each practice area. Replaces the placeholder pages with real primary-unit views.
- **Pasted-key flow with proper secret-storage seam** (ADR-012's future-ADR territory).
- **Per-practice-area cold-start interviews** (optional, later sprint).

**ADRs**: 008, 009, 010, 011, 012, 013, 014 in this repo; sibling-repo 001 (persistence-JSON), 002 (all-args-A-class), 003 (Apache 2.0).

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.

---

### Sprint 7 — Onboarding dogfood, CC as the user (closed 2026-05-18)

**Goal**: walk Sprint 6's onboarding as a real in-house lawyer would, against the real MiniMax-M2.5, with the actual Electron build on Xvfb. No synthetic shortcuts, no pre-scripted answers, no product code changes. Output is a written user-research report. Sprint 8 picks up the highest-priority frictions and fixes them. This sprint also proves the "CC as the user" dogfood pattern for future UX-heavy sprints. Plan at `/root/.claude/plans/sprint-7-cc-sunny-anchor.md`.

**Personas**

- **Primary — Daniel Okafor**, Commercial Counsel at Meridian Power Components (UK B2B distributor of industrial electrical / automation components, ~450 staff across UK + IE + NL). Drops 8 of the 13 default areas; adds Channel & Reseller as a custom area; gives an in-band size answer ("around 450"); probes the MiniMax provider question once; reads the recap carefully. Chosen to match the user-stated target sector and to exercise role-slug fallthrough (`counsel`, not `general-counsel`).
- **Edge — uncooperative test character**. Declines name, gives non-canonical role ("lawyer"), declines company, requests phase skip, accepts all 13 defaults, replies "Why are you asking me this?" to the provider line, terminates with "Just save whatever you've got." Stress-tests null-handling, phase-skip, and off-topic-redirect rules.

**Built**

- **Dogfood driver harness** (test tooling, not product) committed at `scripts/dogfood/dogfood.sh` (env + Xvfb wrapper) and `ui/desktop/scripts/dogfood-driver.mjs` (~290 LoC; Playwright over CDP; subcommands `launch | send | screenshot | read | status | quit`). Persists state under `/tmp/oscar-dogfood/`; writes turn-by-turn screenshots to `docs/dogfood/sprint-7/screenshots/<session>/NN-label.png`. Persona answers are computed turn-by-turn by CC at runtime — not pre-scripted. The plan documented the driver as `scripts/dogfood/run-onboarding-session.mjs`; in practice the `.mjs` lives under `ui/desktop/scripts/` because Playwright is installed at `ui/node_modules/` and ESM resolution walks up from the importing file. The bash wrapper sits at the documented path.
- **Sprint-7 dogfood report** at `docs/dogfood/sprint-7/`:
  - `README.md` — the report (persona, methodology, headline findings, friction log, profile verification, post-onboarding assessment, cold-relaunch verification, recommendations for Sprint 8+).
  - `transcript-primary.md`, `transcript-edge.md` — rendered transcripts from the goosed session DB at `~/.local/share/goose/sessions/sessions.db`, including the LLM-emitted closing message that the UI did not render (see P0-A below).
  - `profile-primary.json`, `profile-edge.json` — exact `finalize_profile` tool-call payloads.
  - `session-extract-primary.json`, `session-extract-edge.json` — raw audit dumps including thinking traces and tool blocks.
  - `screenshots/primary/` (9 PNGs), `screenshots/edge/` (11 PNGs), `screenshots/primary-cold-relaunch/` (2 PNGs).
- **`RUNBOOK.md` "Dogfood capture" section** — how to reset profile state, launch a session, drive turns, extract the canonical transcript from goosed's SQLite store, run the cold-relaunch check.

**Frictions surfaced** (full detail + turn references in the report)

- **P0-A — Closing-message race condition (2/2 sessions).** Agent's "Welcome to Oscar GC. Your practice areas are listed in the sidebar — pick one to begin." is generated by the LLM and persisted in `sessions.db` but the user never sees it. `OscarOnboardingGuard` polls `~/.config/oscar/profile.json` every 1500 ms; once `finalize_profile` writes the file, the guard unmounts the onboarding view before the next streamed turn lands in the DOM. The user is dropped into the Hub without a save acknowledgment and without the sidebar bridge. Partially violates ADR-014's intent. Three fix options outlined for Sprint 8 to decide between; (c) "move the welcome bridge to a Hub banner reading from `profile.json`" is the recommended path because it also closes P1-A / P1-C / P1-D.
- **P1-A — Recap delivery non-deterministic.** Primary skipped the recap until pushed; edge gave it unprompted. System-prompt P4 requires recap; LLM compliance is unreliable. Fix likely subsumed by P0-A option (c).
- **P1-B — Two contradictory questions in one turn (primary P3 end).** "Looks close to your practice, or want to drop or add anything? ... What do you want to keep?" — subtract-from-defaults framing tacked together with whitelist framing. Edge did not reproduce. Tighten the example sentence in the system prompt.
- **P1-C — Recap dropped a detail.** Primary recap omitted "cabling" from "drives, controls, switchgear, cabling". Falls out if recap moves off the LLM.
- **P1-D — Hub landing is impersonal post-onboarding.** Same generic hero copy as pre-onboarding state; no welcome-by-name, no sidebar bridge cue. Combined with P0-A, the post-onboarding experience reads as "I had a conversation and now I'm looking at a marketing page."
- **P2 (six items).** Adjacent chatbot tics outside the explicit forbid list; long natural-language industry string; mild over-explanation of MiniMax in the primary session; agent re-asks after a clarification request; auto-generated goosed session name ("Anonymous legal inquiry" in the edge run); historical session-DB pollution from Sprint 6 development. None block, all worth fixing if/when the relevant surface is touched.

**Verified — what works**

- **Profile JSON correctness.** Every field in both sessions matches the conversation exactly. Canonical role-slug derivation (`counsel` for "Commercial Counsel", `other` for "lawyer"). Null-handling for declined fields. Default `body` text preserved verbatim from the seed. Custom `body` authored coherently for the user-added area. Size-band natural-language mapping ("around 450" → `201-1000`).
- **Phase-skip honoured.** Edge's "skip the company stuff" → "Got it. Moving on." No insistence.
- **Pushback acceptance.** Multiple deflections (name, company, provider-question) acknowledged + next-phase move without re-asking.
- **Sidebar populated correctly post-onboarding.** Primary: 6 entries (5 defaults in seed order + Channel & Reseller appended). Edge: all 13 in seed order. Both visible in `screenshots/<session>/`.
- **Cold relaunch.** Profile persists; `OscarOnboardingGuard` correctly skips onboarding on second launch; Hub renders with the prior sidebar. `screenshots/primary-cold-relaunch/01-cold-relaunch-hub.png`.

**Deferred**

- **Fixing any frictions.** Sprint 7's scope is observation only. All fix decisions go to Sprint 8.
- **No new ADRs this sprint.** Friction surfaced is observation, not decision. Sprint 8 will pick a fix shape (likely ADR-015 for the P0-A welcome-bridge decision) and write the ADR at decision time.
- **Push `oscar-onboarding-mcp` to GitHub** — Sprint 6 carry-forward, still pending Arturs's one-shot push approval.

**Carry-forwards for Sprint 8**

- **Pick a fix shape for P0-A** (closing-message race condition) and write ADR-015 at decision time. Option (c) — move the welcome bridge off the chat surface and into a one-time Hub banner — is recommended in the report because it bundles fixes for P0-A, P1-A, P1-C, P1-D.
- **Apply P1-B fix** (tighten the P3 question phrasing in the system prompt). Mechanical edit; no ADR needed.
- **Sweep P2-A** (extend the chatbot-tic forbid list) when next touching the system prompt.
- **Carry the dogfood pattern forward.** Every UX-heavy sprint should close with a "CC as the user" pass against the actual built binary, on real provider calls, before declaring the sprint done. Sprint 6's unit-tests / bundle-grep / state-screenshots verification was substantive but did not catch P0-A (which requires real LLM streaming timing) or P1-A/B/C/D (which require real persona reactions). Driver is now reusable; harness lives at `scripts/dogfood/dogfood.sh`.

**ADRs**: none this sprint.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.

---

### Sprint 8 — Hub welcome banner closes Sprint 7's P0 closing-message race (closed 2026-05-18)

**Goal**: implement Sprint 7's recommended fix (option (c) — Hub welcome banner reading `profile.json`) such that the P0 (LLM closing message never rendered, ≤1500 ms race against `OscarOnboardingGuard` unmount) is closed and P1-A / P1-C / P1-D close as consequences. ADR-015 written before any implementing code. Re-dogfood to confirm. Brief in chat; plan at `/root/.claude/plans/sprint-8-ethereal-hedgehog.md`.

**Built**

- **ADR-015** at `docs/adr/015-welcome-bridge-hub-banner.md` (commit `c21135162`, 45 lines, ADR-at-decision-time per CLAUDE.md). Records: decision (move the welcome bridge from agent chat turn to Hub banner reading `profile.json`); evaluation of options (a), (b), (c) from Sprint 7's friction log with one-paragraph pointer to the report instead of re-litigation; reuse evaluation of `AlertBox` and `GroupedExtensionLoadingToast` (both declined, wrong register); localStorage dismissal rationale; explicit "extends ADR-014, does not supersede" relationship.
- **`OscarHubBanner`** at `ui/desktop/src/components/oscar/OscarHubBanner.tsx` (commit `44387ef2b`, 47 LoC). Reads `useOscarProfile()` (existing hook from Sprint 6); reads dismissal flag from `localStorage` synchronously on first render; renders editorial card with Cormorant title (italic-copper accent on first name), Outfit body, IBM Plex Mono copper "DISMISS" button; on dismiss writes `localStorage.setItem('oscar.hubWelcomeDismissed', 'true')` and unmounts. Renders `null` when profile is loading, null, or dismissal flag is set. No new hooks, no new IPC, no profile-schema change.
- **`.oscar__banner*` CSS** appended to `ui/desktop/src/styles/main.css` (commit `44387ef2b`, ~60 LoC). Card layout with copper left-border on `--card-bg` (paper-cream), Cormorant 20px title, italic-copper title accent, Outfit 13px body, IBM Plex Mono 10px tracked uppercase dismiss with copper hover. All tokens existing from ADR-007 (no new tokens, no Tailwind config touched).
- **`Hub.tsx`** integration (commit `44387ef2b`, 3-line diff). Import `OscarHubBanner`; render it as the first child of the centred `flex-col` column, above the existing eyebrow. No other Hub changes; banner self-handles its own visibility.
- **Bundle verified** via `npx @electron/asar extract` → `/tmp/sprint8-asar/`. Grep confirmed all six `.oscar__banner*` selectors in the renderer CSS, the `Welcome to Oscar GC` literal and `oscar.hubWelcomeDismissed` localStorage key in the renderer JS bundle.
- **Dogfood driver harness enhancements** (test-tooling, not product code): `DOGFOOD_SCREENSHOT_BASE` env var (driver no longer hardcodes Sprint 7's path; defaults to `docs/dogfood/sprint-7/screenshots` for back-compat); new `click <selector>` subcommand for the post-onboarding dismiss action; matching docblock updates in `dogfood.sh` and `dogfood-driver.mjs`. Future UX-heavy sprints inherit a per-sprint screenshot path and click affordance.
- **Re-dogfood pass** at `docs/dogfood/sprint-8/`: Daniel Okafor persona reused from Sprint 7 (Arturs decision: render-layer-only fix → persona variety adds no signal; reuse makes the delta crisp). 9-screenshot turn-by-turn run for `sprint-8-daniel` + 2-screenshot cold-relaunch session; `transcript-daniel.md`, `profile-daniel.json`, `session-extract-daniel.json` from session `20260518_13`. Mirrors of the three lifecycle frames at `docs/screenshots/sprint-8/{root-with-banner,root-banner-dismissed,root-cold-relaunch}.png`.
- **Sprint 7 friction-log update** in `docs/dogfood/sprint-7/README.md` §4: per-finding `Status (post Sprint 8)` lines recorded. P0-A closed (commit `44387ef2b`); P1-A and P1-C closed by deprecation (banner is the verification surface, recap is no longer load-bearing); P1-D closed; P1-B deferred to Sprint 9; P2-A through P2-F unchanged.

**Closure verification per Sprint 7 criteria** (not by guessing — quotes the Sprint 7 §4 criteria, compares Sprint 8 state):

- **P0-A**: Sprint 7 said "no confirmation that the save succeeded, no bridge to the sidebar, no name on screen." Sprint 8 state: banner carries name + sidebar bridge + save acknowledgment, render-deterministic. Closed.
- **P1-A**: Sprint 7 said "the contract is unstable." Sprint 8 state: recap deprecated as verification surface; banner reads `profile.json` regardless of LLM recap path. Closed by deprecation.
- **P1-C**: Sprint 7 said "erodes trust in the recap." Sprint 8 state: same as P1-A — recap no longer the trust surface. Closed by deprecation.
- **P1-D**: Sprint 7 said "no welcome-by-name, no 'your sidebar has been populated', no entry point." Sprint 8 state: banner has all three. Closed.

**Pattern observation surfaced by the Sprint 8 run**: Sprint 8's LLM took a *different* final-turn path than Sprint 7's primary — skipped the recap-before-save entirely, called the tool on "Confirmed", then emitted a confused post-tool "Save?" instead of the system prompt's instructed closing message. Either failure mode (Sprint 7's emitted-but-late closing message; Sprint 8's confused post-tool turn) would have been user-visible if we'd tried to keep the welcome on the chat surface. The banner is invariant under both — render-deterministic from `profile.json`, ignoring whatever the LLM emitted as its last turn. ADR-015's option (c) sidesteps a *class* of LLM-final-turn failures, not a single race. Recorded in detail in `docs/dogfood/sprint-8/transcript-daniel.md` §Notes and `README.md` §9.

**Deferred**

- **P1-B** (one-line tightening of P3 example sentence per Sprint 7's report) — Sprint 9. Per Arturs plan-time decision: every system-prompt edit deserves its own focused dogfood pass, and Sprint 8's pass is already loaded verifying the banner. Sprint 9 picks up P1-B with a clean slate.
- **P2-A through P2-F** — all six untouched this sprint. P2-A / P2-C / P2-D belong with the next system-prompt edit; P2-B with the next profile-schema iteration (likely v2 when the per-area context fields arrive); P2-E / P2-F with the first surface that lists `sessions.db` rows.
- **Push `oscar-onboarding-mcp` to GitHub** — Sprint 6 carry-forward, still pending. Sprint 7 also carried this; Sprint 8 didn't reach it. Sprint 9 candidate.
- **Memory MCP wiring into the desktop binary** — Sprint 5 carry-forward, still alive. Sprint 9 anchor candidate.
- **Banner copy variation** (per-role, per-tenant) — out of v1 scope per ADR-015; future ADR if surfaced.
- **Tying dismissal flag to `profile.completed_at`** — ADR-015's known limitation. Defer until user-reported.

**Carry-forwards for Sprint 9**

- **Pick Sprint 9 anchor**: either (a) the carried-forward P1-B + P2 sweep on `systemPrompt.ts` (small, focused, well-bounded), or (b) memory MCP wiring into the desktop binary (the four-item short-term goal item not yet started), or (c) adeu integration as a Commercial-area MCP server (also four-item short-term goal). Brief in chat at sprint open will choose.
- **Render-deterministic pattern** is now a precedent. Whenever a feature's user-visible state can be derived from a settled artefact (profile, schema, persisted record), prefer that to an LLM-emitted message. Sprint 8's transcript §9 is the reference.
- **Dogfood harness extensions** (env-configurable screenshot base, `click <selector>` subcommand) are general-purpose — future UX sprints inherit them.

**ADRs**: 015 (extends ADR-014; does not supersede).

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.

---

### Sprint 9 — adeu redline MCP wired; fourth item of four-item short-term goal closed (closed 2026-05-18)

**Goal**: wire `adeu==1.6.9` (Python stdio MCP, MIT) into the Oscar GC desktop binary as the redline backend for the Commercial practice area; first end-to-end redline round-trip via real MiniMax. Sprint 9 addendum raised the bar from byte-level round-trip to lawyer-quality reasoning + OOXML-verified output. Brief in chat (initial sprint + addendum); plan at `/root/.claude/plans/sprint-9-first-fizzy-raven.md`.

**Built**

- **Python runtime + adeu install** (commit `d8aa529ec`). First Python component in the project. apt-installed `python3-venv`, `python3-dev`, `libxslt1-dev`; `libxml2-dev` and `build-essential` already present. Managed venv at `/srv/projects/oscar-runtime/python/adeu-venv/` with `adeu==1.6.9` and ~95 MB of transitive deps (fastmcp 3.3.1, mcp 1.27.1, python-docx 1.2.0, lxml 6.1.0, diff-match-patch 20241021, etc.). RUNBOOK §"Sprint 9 — adeu redline MCP" captures bootstrap, registration stanza, egress convention, footprint.
- **Phase 0 schema verification** (commit `d8aa529ec`) — wire-level probe via the official `mcp` Python SDK over stdio. 11 tools surfaced; `adeu-tools-list.json` + `adeu-schema.md` committed at `docs/dogfood/sprint-9/`. **Critical schema delta from the original plan**: `process_document_batch` returns `{result: string}` text and writes the modified `.docx` to `output_path` on disk — no binary `resource` content block. Phase 5 of the original plan (UI Download button on `resource` blocks) was dropped; egress became a disk-write convention. Delta documented in `adeu-schema.md` and propagated into ADR-019.
- **Five ADRs at decision time, before code** (commit `d8aa529ec`):
  - **ADR-016** Python runtime location: `/srv/projects/oscar-runtime/python/adeu-venv/`, sibling-style, absolute path in `cmd:`; bundling deferred to Sprint 12-15.
  - **ADR-017** Capability binding via extension-name namespacing — config-level DI. Extension `name: redline`; agent sees `redline__*`. Swap procedure: edit `cmd:`/`args:`/`available_tools:` in `~/.config/goose/config.yaml`. Router-MCP built later if a future replacement's inner tool names differ.
  - **ADR-018** File ingress: path-as-text from chat surface + system-prompt nudge; no bridge MCP.
  - **ADR-019** File egress: adeu writes to `~/Documents/Oscar Redlines/{stem}_redlined_{YYYYMMDD-HHmmss}.docx`; agent surfaces the path in chat; user opens via OS file manager. No UI affordance ships this sprint.
  - **ADR-020** Commercial chat: recipe-scoped system prompt encoding the five-step lawyer-reasoning doctrine (intent → interacting clauses → coordinated plan → batch → coherence check).
- **adeu registration** in `~/.config/goose/config.yaml` (host state; stanza captured in RUNBOOK). `redline` extension entry with `cmd: /srv/projects/oscar-runtime/python/adeu-venv/bin/adeu-server`, `available_tools: [read_docx, process_document_batch, diff_docx_files]`, timeout 300s. Excluded from whitelist: `open_local_file` (xdg-open security/UX hazard), cloud auth, email, validation. **CLI verification**: `goose run --no-session --text "List ONLY the tool names that start with 'redline__'"` reply enumerated exactly the 3 whitelisted tools — config-level DI working end-to-end.
- **Commercial recipe + system prompt** (commit `39de117ba`) at `ui/desktop/src/components/oscar/commercial/`:
  - `systemPrompt.ts` — encodes ADR-020's five-step doctrine; documents the `redline__*` tool surface; the `process_document_batch.changes` typed-batch shape; the `~/Documents/Oscar Redlines/{stem}_redlined_{YYYYMMDD-HHmmss}.docx` output convention; "things you never do" guardrails including never declaring success without coherence verification.
  - `commercialRecipe.ts` — Sprint 6 onboardingRecipe mirror; binds system prompt + redline extension (whitelisted), provider minimax/MiniMax-M2.5.
  - `OscarCommercialView.tsx` — bootstraps a recipe-scoped session via `createSession`, dispatches `ADD_ACTIVE_SESSION` event, navigates to `/pair?resumeSessionId=<id>` so Goose's existing `BaseChat` handles attachments + tool rendering + streaming (D6 reuse-BaseChat).
  - `PracticeAreaPlaceholder.tsx` branches on `areaId === 'commercial'` → `OscarCommercialView`; other practice areas keep the Sprint 4 placeholder.
- **Dogfood harness extensions** (commit `533e04e2b`) — added `goto <hash-route>`, `pair-send <text>`, `pair-read` subcommands to `ui/desktop/scripts/dogfood-driver.mjs`. D9's synthetic-drop `attach` subcommand was dropped: Phase 0 schema verification confirmed adeu takes a file path as a plain string argument, so the path-in-text contract is equivalent to drag-drop for the agent. Future UI sprints can add the synthetic-drop if needed.
- **Substantive fixture + provenance** (commit `397bcc26e`) at `docs/dogfood/sprint-9/fixtures/`. `unilateral-nda.docx` is a 1-2 page hand-drafted commercial unilateral NDA (English law). 24× "Party A" vs 18× "Party B" + 1× "Receiving Party" marker asymmetry; 7-8 coordinated edits required for "make it mutual." `PROVENANCE.md` records source (synthesised from public-domain NDA conventions); reproducer at `/tmp/build_nda_fixture.py`.
- **Round-trip dogfood + verification** (commit `397bcc26e`) at `docs/dogfood/sprint-9/`:
  - `cli-transcript.txt` — full goose CLI session against real MiniMax-M2.5, exit 0, wall-clock ~2 minutes. Agent followed the five-step doctrine: read intent → `read_docx` (outline then full) → enumerate 9-item plan → `process_document_batch` (first attempt missing `type` field, recovered via retry with `type: modify`) → `read_docx clean_view: true` to verify. **Agent proactively surfaced** that Clause 8 (No Licence) is still asymmetric and asked the lawyer whether to extend mutuality — the load-bearing "surface uncertainty" behaviour from ADR-020.
  - `output-cli-verify.docx` — copy of the redlined output from `/root/Documents/Oscar Redlines/`.
  - `verification.sh` — re-runnable byte-level + structural checks. All pass: md5 differs; mutual-coded markers input 2 → output 32 (+30); track-changes markup present (8 `<w:ins>` + 7 `<w:del>`); output parses as valid DOCX.
  - `verification-ooxml.md` — change-by-change catalogue of all 8 typed-modify operations against the lawyer-shaped intent each served, plus an explicit table of clauses the agent did not modify (and why each).
  - `verification-comprehension.md` — side-by-side of agent output vs CC's lawyer-shaped reference; findings P1 (system prompt allows Markdown emphasis → agent bolded substantive contract language → counterparty issue), P2 (defined-term capitalization inconsistency), P2 (Clause 8 not auto-handled; agent flagged transparently), P3 (Purpose recital subject-matter narrowness; judgment call).
  - `screenshots/01-hub.png` and `02-commercial-session-loading.png` — desktop UI confirmation that the Commercial sidebar entry routes into a recipe-scoped `BaseChat` session.

**Closure verification against the Sprint 9 addendum's standard** (substantive fixture + OOXML walk + lawyer-quality comparison + system-prompt-shape ADR + source-verified adeu multi-edit claim):

- ✅ **Substantive fixture, not trivial** — 1-2 page real-shape commercial NDA; 7-8 coordinated edits required.
- ✅ **OOXML-level verification (not just byte hash)** — `verification-ooxml.md` walks every change against intent; `verification.sh` is the re-runnable check.
- ✅ **Lawyer-quality comparison artifact** — `verification-comprehension.md` with side-by-side and P1/P2/P3 findings.
- ✅ **System-prompt-shape ADR** — ADR-020 captures the five-step doctrine.
- ✅ **adeu source-verified about multi-edit** — `adeu-schema.md` + the live MCP probe confirm `process_document_batch` natively handles coordinated multi-edit via the `changes` array. `diff-match-patch` is a transitive dep of adeu used internally by adeu's `RedlineEngine`, not bolted on by us.

**Closes the fourth (and final) item of the four-item short-term goal.** Per `PROJECT.md` §"The one goal", the four items were:
1. Fork Goose (closed Sprint 1).
2. Replace UI layer with in-house-legal UI (closed across Sprint 3–8: branding, sidebar, onboarding, Hub banner).
3. Replace memory layer with scoped MCP server (closed Sprint 5).
4. Wire adeu as MCP server for Commercial — **closed by Sprint 9.**

The foundational scope is complete. The roadmap opens up after Sprint 9.

**Deferred**

- **P1 (verification-comprehension)** — tighten system prompt to discourage Markdown emphasis in substantive `new_text`. Sprint 10 candidate.
- **P2 (verification-comprehension)** — defined-term capitalization consistency in the system prompt's worked example. Sprint 10 candidate.
- **P2 (verification-comprehension)** — scope-of-mutuality reminder in the system prompt (extend to clauses naming one Party asymmetrically; cover the Clause 8 / "No Licence" gap proactively). Sprint 10 candidate.
- **UI download / "Open output folder" affordance** — Phase 5 of the original plan dropped (adeu writes to disk directly). A future UI polish sprint can add a "Save copy" / "Reveal in Files" affordance for tool-output paths if dogfood ever reveals friction.
- **Practice-area-scoped tool exposure** (Commercial gets `redline`, others don't via per-area gating) — Sprint 9 enables globally; per-area gating is a future memory/practice-area concretization sprint.
- **Memory MCP wiring into the desktop binary** (Sprint 5 carry-forward, still pending). `oscar-memory-mcp` registered globally but the Commercial agent doesn't call it from the desktop yet. Candidate Sprint 10 anchor.
- **Editorial-styled Commercial chat surface** — Sprint 9 reuses Goose's `BaseChat`. A future UI sprint can apply the Oscar Editorial styling.
- **Sprint 8 carry-forward P1-B** (system-prompt phrasing on onboarding P3 example sentence) — still pending; not coupled to Sprint 9.
- **Push `oscar-onboarding-mcp` to GitHub** (Sprint 6 carry-forward) — admin hygiene; not adeu-bearing.
- **Bundling adeu's Python runtime into the installer** — Sprint 12-15 distribution work.

**Carry-forwards for Sprint 10**

- **Pick Sprint 10 anchor**: either (a) the P1/P2 system-prompt iteration + re-dogfood (small, focused), (b) memory MCP wiring into the desktop binary (the remaining four-item short-term goal item, no — actually the four-item short-term goal is now fully closed; (b) is general roadmap), or (c) practice-area scoping for redline. Brief at Sprint 10 open will choose.
- **The render-deterministic pattern + the verify-don't-assume pattern** are precedents now. Sprint 9's Phase 0 gating (live MCP probe before any wiring, with explicit "plan said X, reality is Y" delta) is the discipline going forward whenever a sprint depends on an external tool's schema.

**ADRs**: 016, 017, 018, 019, 020. All five at decision time, before implementing code (CLAUDE.md mandate).

**Cross-repo SHAs**: only `sarturko-maker/goose` touched this sprint (adeu is upstream — not a sibling repo we author). Sprint 9 commits: `d8aa529ec` (Phase 0-2 ADRs + RUNBOOK + schema), `39de117ba` (Phase 4 Commercial), `533e04e2b` (Phase 6 dogfood harness), `397bcc26e` (Phase 7 dogfood + verification), plus this close-out commit. No sibling-MCP repo changed.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.

---

### Sprint 10 — One-step Crostini deliverable (closed 2026-05-18)

**Goal**: ship Oscar GC as a single installable `.deb` published to a GitHub Release on `sarturko-maker/goose`, fully bundled (adeu Python venv, Node + sibling MCPs, every runtime dep), so the user (Arturs) installs in one step on his Chromebook Crostini container and runs the four-item flow without dev intervention. CLAUDE.md "Distribution shape" doctrine. PROJECT.md had estimated this for Sprint 12-15; pulled forward because Sprint 9 closed the four-item short-term goal and dogfood of the packaged product became the highest-value next step. Plan at `/root/.claude/plans/sprint-10-deliverable-purrfect-harbor.md`.

**Built**

Phased commits on `main` (no feature branches):

- **Phase 1** (`331011765`) — ADRs 021-024 at decision time, before implementing code.
  - **ADR-021** Sprint 10 distribution shape: Debian 12 `.deb` only, Docker build host, local `gh release create`.
  - **ADR-022** Python runtime bundling: `python-build-standalone` + offline `adeu==1.6.9` wheels in `extraResource`; postinst hook creates the venv at install location from the bundled wheels.
  - **ADR-023** Node + MCP bundling: standalone Node 24.10.0 binary + esbuild dist outputs for `oscar-onboarding-mcp` and `oscar-memory-mcp`.
  - **ADR-024** Resource path resolution: preload `contextBridge` exposes `oscarResourcesRoot`; recipes become factory functions consuming it; dev fallback follows the `findGoosedBinaryPath` precedent.

- **Phase 2** (`abc3ca8bb`) — Recipe factory + preload bridge.
  - `commercialRecipe.ts` + `onboardingRecipe.ts` converted from exported constants to `buildXRecipe(resourcesRoot)` factory functions.
  - `OscarCommercialView.tsx` + `OscarOnboardingView.tsx` call sites updated to pass `window.electron.oscarResourcesRoot` through.
  - **(Bug — fixed in Phase 8d, see below)**: the resourcesRoot probe was placed inside `preload.ts` using `node:fs.existsSync`. Preload runs sandboxed and cannot import Node built-ins. Caused the renderer-paint blocker that took two visible iterations to root-cause.

- **Phase 3-4** (`50a74e091`) — Bundle prep + electron-forge integration.
  - `ui/desktop/scripts/prepare-oscar-bundle.js` downloads python-build-standalone CPython 3.12.5+20240814 (linux-x86_64-install_only), pip-downloads adeu==1.6.9 wheels via the bundled Python (offline-installable later), fetches Node v24.10.0 linux-x64, and esbuild-bundles both sibling MCPs from `src/index.ts` into single-file CJS outputs. Writes a `BUNDLE.json` provenance summary. Idempotent via `.oscar-bundle-cache/`.
  - `forge.config.ts` extends `extraResource` to `['src/bin', 'src/images', 'src/resources/python', 'src/resources/node', 'src/resources/mcps']`. Both `maker-deb` and `maker-rpm` renamed from `'Oscar GC'` (space) to `'oscar-gc'` (kebab-case). `maker-deb.scripts.postinst` wired to `./scripts/postinst.sh`. Silently-ignored `prefix: '/opt'` removed (actual install location is `/usr/lib/oscar-gc/` per electron-installer-debian defaults).
  - `scripts/postinst.sh` creates `/usr/lib/oscar-gc/resources/python/adeu-venv` on `configure` via the bundled Python + offline wheels (`pip install --no-index --find-links=<wheels>`). Idempotent across reinstalls.
  - `forge.{deb,rpm}.desktop` Exec= → `/usr/lib/oscar-gc/oscar-gc`; Icon= → `/usr/share/pixmaps/oscar-gc.png` (Debian convention).
  - `package.json` gains `bundle:oscar-linux` script chaining `prepare-oscar-bundle.js` + `i18n:compile` + `electron-forge make --targets=maker-deb`.
  - `.gitignore` excludes `.oscar-bundle-cache/` and `src/resources/`.

- **Phase 5** (`bf56f8202` + `a475855b0`) — Debian 12 Docker builder + docs.
  - `docker/Dockerfile.deb12-builder`: Debian 12 bookworm + Rust 1.92 (rustup, matching `rust-toolchain.toml`) + standard libxcb/protobuf/glslc/vulkan/libxml/libxslt/cmake/ninja-build deps. First-attempt build failed with `llama-cpp-sys-2` panicking "is `cmake` not installed?"; `cmake` + `ninja-build` added (Debian 12's `build-essential` doesn't ship cmake).
  - `scripts/build-oscar-deb.sh` two-phase orchestrator: (1) Docker build the image + run `cargo build --release -p goose-server` inside Debian 12 with `CARGO_TARGET_DIR=target-debian12` and a named volume `oscar-gc-cargo-cache` for the cargo registry; stage the produced `goosed` into `ui/desktop/src/bin/` + glibc-sanity audit. (2) On host, `source bin/activate-hermit` + `pnpm run bundle:oscar-linux`. Output: `ui/desktop/out/make/deb/x64/oscar-gc_<v>_amd64.deb`. First run ~15 min, incremental ~3 min.
  - `docs/INSTALL_CROSTINI.md`: user-facing one-page install (download, double-click, complete onboarding, run a redline) + Troubleshooting (log file location, terminal flag set, keyring-missing workaround).
  - `RUNBOOK.md` §"Sprint 10": two-phase build, bundled artefact table, postinst behaviour, verification commands (dpkg -I/-c, glibc audit, clean-container install), host state added, `gh release create` upload command, provider-key first-launch risk.

- **Phase 6** — End-to-end verification in clean Debian 12 container (no commit; verification only).
  - `dpkg -I` — `Depends:` list contains no Ubuntu-`*-t64` library names (would have failed to resolve on Crostini). Build host ABI compatibility confirmed.
  - `dpkg-deb -c` — confirmed bundle layout under `/usr/lib/oscar-gc/`.
  - `docker run --rm -v <debs>:/debs:ro debian:bookworm apt install ./oscar-gc_*.deb` — exits 0; postinst creates venv from offline wheels; `adeu module loadable: 1.6.9`; bundled Node + esbuild-bundled MCPs start cleanly (`oscar-memory-mcp ready` observed).
  - glibc-symbol audit on extracted binaries (host objdump): max symbols `oscar-gc=GLIBC_2.25`, `goosed=GLIBC_2.34`, `node=GLIBC_2.28`, `python3.12=GLIBC_2.2.5`. All ≤ Debian 12 ceiling (2.36).

- **Phase 8** (`a475855b0` + `09b083a8a` + `394ce943b` + `f1fa8e594`) — Iterative Crostini renderer debug (four iterations).
  - **8a (`a475855b0`)** — Initial draft release via `gh release create oscar-gc-sprint10 --draft`. Tag deliberately non-`v1.*` so upstream's `release.yml` doesn't fire on it.
  - **8b (`09b083a8a`)** — User's first Crostini install: app launches, renderer fails with Gtk widget assertion under both Wayland and X11 ozone backends; no GPU acceleration available on this Chromebook. **ADR-025** records the inline-flag fix: `.desktop` Exec= wraps with `env LIBGL_ALWAYS_SOFTWARE=1` and appends `--ozone-platform=x11 --disable-gpu --disable-software-rasterizer`.
  - **8c (`394ce943b`)** — Second iteration still failed silently (no renderer log to read). **ADR-026** moves to a wrapper-script approach (the path ADR-025 already anticipated): postinst-installed `/usr/lib/oscar-gc/oscar-gc-launcher.sh` adds `--enable-logging=stderr --v=1` and redirects both stdout and stderr to `~/.cache/oscar-gc/launch.log` per launch (with header line for grep-ability). Also: env-redactor extended for `_TOKEN` (Arturs flagged `CLAUDE_CODE_OAUTH_TOKEN` leaking to every spawn-options dump).
  - **8d (`f1fa8e594`)** — Renderer log finally captured the actual error: `Unable to load preload script ... Error: module not found: node:fs`, cascading to `Cannot read properties of undefined (reading 'logInfo')`. Root cause: Phase 2 placed the resourcesRoot probe inside preload, but preload runs sandboxed and cannot import Node built-ins. **ADR-027** moves the probe to `main.ts` (Node-privileged); result flows through `additionalArguments` JSON to preload. Renderer paints on next install.

- **Phase 9** (`767c8f264`) — Close-out patch from Arturs's brief after renderer started painting.
  - `goosed.ts` env redactor extended to `_PASSWORD`.
  - `utils/autoUpdater.ts` + `utils/githubUpdater.ts` owner default `'block'` → `'sarturko-maker'`.
  - **ADR-028** TelemetryConsentPrompt removed (import + render in `App.tsx`; `TELEMETRY_UI_ENABLED=false`; `setTelemetryEnabled(false)` hardcoded at renderer init). First application of CLAUDE.md "inverting upstream UX defaults" doctrine.
  - **ADR-029** Trust-a-recipe dialog bypassed in preload for recipes with `title` prefix `"Oscar GC"`. Bundled recipes (Onboarding + Commercial) never see the dialog; deeplink-installed recipes still gate normally.
  - **ADR-030** In-product LQ branding: `GooseLogo` body replaced with inline LQ-mark SVG (cream + Cormorant L + copper italic Q + copper rule). All sites rendering `GooseLogo` (`LoadingGoose`, `suspense-loader`, `RecipeActivities`) inherit the swap. `OscarSidebar` gains a Settings affordance in a footer with utility-styled link (mono caps, hairline rule, copper hover/active).
  - App-icon raster swap (`.png/.ico/.icns`) deferred to Sprint 11 — `apt-install librsvg2-bin` was blocked by the auto mode classifier; no SVG→PNG converter available on the build host.

**Closure verification against Arturs's exit-criteria brief**

| Criterion | Status |
|---|---|
| Renderer paints on Crostini | ✓ (ADR-027 fix) |
| ADR for the Crostini renderer fix | ✓ (ADRs 025, 026, 027) |
| No telemetry prompt | ✓ (ADR-028) |
| No trust-a-recipe dialog (bundled recipes) | ✓ (ADR-029) |
| No top-right goose mascot | **✗ — carry-forward** (BaseChat.tsx:411 + SessionsInsights.tsx:155,248 + OnboardingGuard.tsx:157,190 import `<Goose>` directly from `components/icons/Goose`, bypassing the `GooseLogo` swap) |
| LQ icon visible in launcher | **✗ — carry-forward** (.png/.ico/.icns raster swap blocked; SVG-only swap landed) |
| Settings icon reachable | ✓ (OscarSidebar footer, ADR-030) |
| `main.log` no sensitive credentials | ✓ (`_KEY`/`_SECRET`/`_TOKEN`/`_PASSWORD` all redacted) |
| Auto-updater queries the fork | ✓ (`sarturko-maker/goose` is the default in both `autoUpdater.ts` and `githubUpdater.ts`) |
| SPRINT_LOG closed with dogfood log | ✓ (this entry) |
| PROJECT.md Sprint Index row 10 marked complete | ✓ (companion commit) |

**Dogfood log (user, on Crostini)**

| Iteration | What happened |
|---|---|
| #1 (after 8a) | `.deb` installs cleanly. App launches but renderer fails with Gtk widget assertion under both Wayland and X11 ozone backends, with and without GPU. ChromeOS GPU-acceleration toggle absent on this Chromebook. User flag: Sprint 10 packaging should sanitize sensitive env vars (`CLAUDE_CODE_OAUTH_TOKEN` leaking to spawn-options dump). User flag: auto-updater feed still points at `block/goose`. |
| #2 (after 8b) | Re-install. Same failure; no diagnostic surface to capture renderer stderr. |
| #3 (after 8c) | Re-install. Log captured at `~/.cache/oscar-gc/launch.log` reveals the actual error: preload script fails to load with `Error: module not found: node:fs`. Cascade: `window.electron` undefined → renderer's `window.electron.logInfo` throws → React tree fails to mount → Chromium draws a destroyed surface → Gtk widget assertion. The two prior iterations' Crostini-flag work was useful hygiene but did not address the root cause. |
| #4 (after 8d) | "Reinstall successful. Goose renders and works." Renderer mounts. Onboarding reachable. |
| #5 (after 9) | Telemetry prompt gone ✓. Trust dialog gone ✓. Settings affordance works ✓. **Top-right Goose still visible** (carry-forward, see above). **Launcher icon still upstream Goose** (carry-forward, raster pipeline). **Commercial chat doesn't load on click; chat history surface missing** (functional carry-forward — hypothesis: ADR-029's `recordRecipeHash` short-circuit may break a session-state dependency in `BaseChat.tsx:218`, or unrelated regression; Sprint 11 investigates). **MCP tool calls render too large in chat surface** (UX carry-forward). |

**Closes**

- **Sprint 10's primary deliverable**: one-step Crostini install via published GitHub Release. `oscar-gc_1.34.0_amd64.deb` at https://github.com/sarturko-maker/goose/releases tag `oscar-gc-sprint10` (draft as of close; promote to published when ready).
- **First Python component bundled** into the desktop distribution. The Sprint 12-15 bundling estimate in PROJECT.md is now historical.
- **First-application of the CLAUDE.md "inverting upstream UX defaults" doctrine** to three concrete surfaces (telemetry, recipe-trust, branding chrome).
- **Distribution-shape rules** preserved per PROJECT.md: no system-level deps (all runtime bundled), no daemon registration, single .deb that double-clicks to install on Crostini.

**Deferred / out-of-scope (per Arturs's brief)**

- Markdown rendering issues in onboarding — Sprint 11 (folds into the unified-onboarding extension).
- Pacing of onboarding-to-practice-areas transition — Sprint 11.
- Conversation history clarity / matters / Forge meta-agent — Sprint 12.
- Adeu's "doesn't redline like a lawyer" finding — Arturs has a fix to share.

**Carry-forwards for Sprint 11**

- **Top-right Goose mascot removal — round 2.** `GooseLogo` swap (ADR-030) caught the LoadingGoose / suspense / RecipeActivities call sites. Three additional surfaces import `<Goose>` directly from `components/icons/Goose.tsx`: `BaseChat.tsx:411`, `SessionsInsights.tsx:155,248`, `OnboardingGuard.tsx:157,190`. Sprint 11 either neutralizes the `Goose` icon component itself OR replaces these call sites individually.
- **App-icon raster pipeline.** `.png` / `.ico` / `.icns` regeneration from the LQ mark needs an SVG→PNG converter on the build host. Options: authorize `apt install librsvg2-bin`, wire in npm `sharp`, or use Python `cairosvg` from the bundled adeu venv's Python.
- **Commercial chat doesn't load on click; chat history surface missing.** Functional regression observed in #5 dogfood. Hypothesis: ADR-029's `recordRecipeHash` synchronous short-circuit may interact with `BaseChat.tsx:218`'s await in an unexpected way, OR unrelated regression. Investigate via the renderer log first (`~/.cache/oscar-gc/launch.log`).
- **MCP tool-call rendering in chat is too large.** Visual fix; touches the upstream tool-rendering component.
- **Settings audit for any user-facing telemetry toggle.** ADR-028 killed the prompt + hardcoded the init; if `SettingsView` exposes a re-enable path, hide or disable it.
- **postinst orphan-on-uninstall cleanup.** `/usr/lib/oscar-gc/oscar-gc-launcher.sh` is written by postinst (not tracked by dpkg). Add `prerm` / `postrm` to remove on uninstall.
- **Sprint 11 (`claude-for-legal repackage`)** is the next sprint per Arturs's brief. Sprint 12 introduces the Forge meta-agent + Matters/Projects scoped containers; Plan-mode should keep practice-area data structures and Forge's invocation surface cleanly separated.

**Carry-forwards from prior sprints, still open**

- Sprint 9 P1/P2 system-prompt polish (Markdown emphasis, defined-term capitalisation, Clause 8 mutuality reminder) — Sprint 11.
- `oscar-memory` recipe wiring into the desktop Commercial agent — Sprint 11+. Bundled into the .deb; not yet wired into `commercialRecipe.ts`.
- Sprint 15+: migrate ADR-029's title-prefix short-circuit to a proper `recipe.metadata.bundled` flag when community recipes open.
- `goose://` URL scheme rebrand, system prompt's self-identification, document.title runtime overwrite — branding follow-ups from PROJECT.md still open.

**ADRs**: 021 (distribution shape), 022 (Python bundling), 023 (Node + MCP bundling), 024 (resource path resolution), 025 (Crostini launch flags), 026 (launcher wrapper for logs), 027 (resourcesRoot probe moves to main), 028 (no telemetry prompt), 029 (bypass trust dialog for bundled recipes), 030 (in-product LQ branding). Ten ADRs, all at decision time, before implementing code (CLAUDE.md mandate). ADR-021 supersedes PROJECT.md's Sprint 12-15 timing estimate; ADR-022 supersedes ADR-016's bundling-deferred clause; ADR-026 extends ADR-025; ADR-027 supersedes ADR-024's preload-side detection.

**Cross-repo SHAs**: only `sarturko-maker/goose` touched this sprint. Sibling MCPs (`oscar-onboarding-mcp`, `oscar-memory-mcp`) consumed as build inputs but not modified. Sprint 10 commits: `331011765` (P1 ADRs), `abc3ca8bb` (P2 recipe factory), `50a74e091` (P3-4 bundle + electron-forge), `bf56f8202` (P5 fix cmake), `a475855b0` (P5 + docs), `09b083a8a` (P8b Crostini flags + ADR-025), `394ce943b` (P8c wrapper + log capture + ADR-026), `f1fa8e594` (P8d preload sandbox fix + ADR-027), `bb5c8e8e3` (CLAUDE.md inverted-defaults doctrine), `767c8f264` (P9 close-out + ADRs 028/029/030), plus this close-out commit.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read due 2026-05-25.

---

### Sprint 12 — Matters, Forge, and the access model formalisation (closed 2026-05-19)

**Goal**: introduce Matters as scoped containers, Forge as a meta-agent for skill + practice-area authoring, and formalise the per-agent access model (filesystem scope + network discipline). Close the "where does conversation history go?" gap surfaced in Sprint 10 dogfood. Plan at `/root/.claude/plans/brief-sprint-12-nested-whistle.md`.

**Built** — nine commit-shaped phases on `main`. CLAUDE.md upstream-doc reference (Phase 0) lands before any code so subsequent phases inherit the doctrine — `goose-docs.ai` consultation reshaped the plan in plan mode (Top of Mind, Sandbox, Allowlist, MCP Roots findings).

- **Phase 0** (`dbb511856`) — CLAUDE.md gains "Upstream Goose authoritative reference" section. Triggers consultation of `goose-docs.ai` when touching MCP / extension / recipe config, session / project / context preservation, or security / sandboxing / allowlisting. Oscar GC's CLAUDE.md / PROJECT.md / ADRs remain canonical for Oscar GC's own decisions; goose-docs.ai for upstream behaviour.

- **Phase 1** (`1c1dcee93`) — 9 ADRs at decision time:
  - **ADR-036** Matters data model: per-practice-area storage at `~/.config/oscar/state/<area-id>/matters/<slug>/` with `matter.md` + `history.md` + `notes.md` + `outputs/`; registry at `matters.json`. Keyed by practice-area id, NOT plugin slug (supersedes Sprint 11 stubs' convention).
  - **ADR-037** Retires the 9 vendored matter-workspace stubs; 48 substantive bundled skills' matter paths rewrite to `$OSCAR_MATTER_DIR`. Recipe builder injects the env via oscar-fs extension envs. Apache modification provenance per ADR-035.
  - **ADR-038** One matter ↔ at most one Goose session via `matters.json[slug].session_id` written on first chat. Session's `working_dir` IS the matter folder. No retroactive migration of pre-Sprint-12 sessions.
  - **ADR-039** Forge in a sidebar header zone above the practice-area list (Settings stays in the footer; two system-affordance zones). Two-mode recipe (create-skill / create-area). oscar-fs scoped to `~/.agents/skills/` + `~/.config/oscar/`; no Developer, no memory, no onboarding, no redline. Create-area flow explicitly offers bundled-skill seeding per ADR-031.
  - **ADR-040** Vendor `@modelcontextprotocol/server-filesystem@2026.1.14` (MIT) as the filesystem MCP. Bundled via `prepare-oscar-bundle.js`; registered at capability name `oscar-fs` per ADR-017.
  - **ADR-041** Uniform recipe loadout convention: every practice-area recipe gets oscar-fs scoped to the matter folder; no Developer extension. Generic builder `buildPracticeAreaRecipe(area, matterFolder, resourcesRoot)` under `ui/desktop/src/components/oscar/recipe/`. Commercial composes its bespoke system prompt + redline MCP on top.
  - **ADR-042** Network-egress discipline: three-layer position. (1) Per-MCP audited convention — no bundled MCP makes outbound calls (build-time grep audit in BUNDLE.json); (2) Goosed → MiniMax provider only; (3) Electron renderer CSP tightened + `webRequest.onBeforeRequest` blocking POST/PUT/PATCH/DELETE to non-localhost. `GOOSE_ALLOWLIST` activated against a bundled empty allowlist (no MCP installs via UI). OS-level enforcement deferred to Sprint 15+ bubblewrap.
  - **ADR-043** Privileged matter — structural flag in `matters.json` and `matter.md` frontmatter; copper-accent UI signal; behaviourally identical. Sprint 13+ audit-log handoff.
  - **ADR-044** Matter context via Top of Mind (Goose's `tom` platform extension at `crates/goose/src/agents/platform_extensions/tom.rs:13`). `GOOSE_MOIM_MESSAGE_FILE=~/.config/oscar/tom-active-matter.md` set at goosed-spawn; matters IPC writes/truncates on matter open / close / detach. Re-read every turn. Complements `$OSCAR_MATTER_DIR`.

- **Phase 2** (`4b02ffef2`) — `oscar-fs` MCP bundle wiring + Top of Mind env wiring + build-time network audit. New `VENDORED_MCPS` table in `prepare-oscar-bundle.js`; `prepareVendoredMcps()` esbuilds the package's `dist/index.js` into `resources/mcps/oscar-fs/index.js`. `auditMcpNetworkSurface()` greps each bundled MCP for 5 outbound-call shapes and writes the report to `BUNDLE.json#network_audit`. `main.ts` ensures `~/.config/oscar/tom-active-matter.md` exists at every boot and sets `GOOSE_MOIM_MESSAGE_FILE` env before goosed spawn.

- **Phase 3** (`5a95d052c`) — Matters layer (storage + IPC + UI + Top of Mind file writes). New `ui/desktop/src/components/oscar/matters/{types,useMatters,MatterRow,NewMatterDialog,MattersLanding}.tsx`. Zod schemas validated at IPC boundary (`oscar:matters:list|get|create|bind-session|archive|set-active|detach-active`). `set-active` writes the agent-reminder view of the matter to `tom-active-matter.md`; `detach-active` truncates. `PracticeAreaPlaceholder.tsx` mounts MattersLanding uniformly — Commercial special-case (direct OscarCommercialView mount) retired. Editorial-idiom CSS additions: modal chrome, button system, privileged accent strip, matter row chrome.

- **Phase 4** (`a53ac7f3b`) — per-recipe access model + matter scope-down. Generic builder `buildPracticeAreaRecipe(opts)` constructs the standard shape: oscar-fs with `args: [matterFolder]` (matter scope-down — sibling matters are invisible) + envs `OSCAR_MATTER_DIR=<matter folder>`. Commercial composes on top: bespoke system prompt + redline extra extension. The other 12 areas (including Commercial Disputes — which had no bespoke recipe coming into Sprint 12) use the generic builder + oscar-fs only. Commercial system prompt updated for `${OSCAR_MATTER_DIR}/outputs/` output paths; dropped `developer__shell mkdir` fallback (no Developer per ADR-041). Onboarding recipe verified no-Developer baseline. `OscarCommercialView.tsx` deleted (unused after Phase 3).

- **Phase 5** (`2a0384e27`) — Forge meta-agent. `ui/desktop/src/components/oscar/forge/{forgeRecipe,ForgeView,systemPrompt}.tsx`. New sidebar header zone in `OscarSidebar.tsx` above the practice-area list, divider, Sparkles icon; Settings stays in the footer. `/forge` route in `App.tsx`. Two-mode system prompt: (A) create-skill — interviews, drafts SKILL.md frontmatter + body, writes to `~/.agents/skills/<slug>/SKILL.md`; (B) create-area — interviews, offers bundled-skill seeding per ADR-031 mapping (Commercial → commercial-legal, Privacy → privacy-legal, etc.), refuses on id collision. HOME_DIR bridge through preload's appConfig (`window.electron.oscarHomeDir`) — renderer cannot resolve `$HOME` itself.

- **Phase 6** (`ba5becba0`) — Sprint 11 stub retirement + skill env-var orchestrator pass. `scripts/sprint12-skill-path-rewrite.js` deletes the 9 matter-workspace stub directories and rewrites 48 substantive SKILL.md files (46 matter-folder refs + 6 matter-subpath refs). Apache modification provenance line inserted below each kept SKILL.md's Sprint 11 attribution. Idempotent (re-run is a no-op). Deferred: "## Matter workspaces" boilerplate paragraphs in skill bodies (Top of Mind compensates behaviourally; cleanup is Sprint 13 candidate); 16 skills reference practice-level state files (`_log.yaml`, `gap-tracker.yaml`) unaffected by ADR-037's matter-folder rewrite — Sprint 13+ if substantive skills exercise them.

- **Phase 7** (`8770980d3`) — GOOSE_ALLOWLIST activation + renderer egress lockdown. `prepare-oscar-bundle.js` writes `src/resources/allowlist.yaml` (empty `extensions: []` per ADR-042 — no MCP installs via UI); `main.ts` sets `GOOSE_ALLOWLIST=file://<resourcesRoot>/allowlist.yaml` before goosed spawn. `index.html` CSP tightened: `connect-src 'self' http://127.0.0.1:* https://localhost:*` (drop generic `https:`), `font-src 'self' data:` (drop external fonts). Renderer `webRequest.onBeforeRequest` blocks POST/PUT/PATCH/DELETE to non-localhost (data-egress vectors blocked + logged); GET stays open so external images in chat content still render.

- **Phase 8** (`c0796a9a3`) — `TODO.md` absorbs Sprint 10 BACKLOG carry-forwards + Sprint 11 carry-forwards + Sprint 12 deferrals + Sprint 15+ structural revisits. Format: `- **Topic** (origin sprint, target sprint) — description.`

**Closes**

Sprint 12's primary deliverables: Matters as first-class scoped containers; conversation history binds matter-to-session; privileged flag visibly signalled; Forge a distinct chrome surface for skill + practice-area authoring; access model formalised (filesystem MCP scope + network egress discipline + GOOSE_ALLOWLIST + renderer CSP). The Commercial chat flow now opens matters from a list (the Sprint 10 dogfood "where does conversation history go?" gap is closed).

**Deferred / out-of-scope per Arturs's brief + plan-mode review**

- bubblewrap / OS-level sandboxing — Sprint 15+.
- Multi-provider Inference Gateway — when Oscar GC goes beyond MiniMax.
- Audit-log infrastructure — Sprint 13 (ADR-043 hand-off).
- SECURITY.md / threat-model writeup — Sprint 13.
- Anthropic claude-for-legal managed-agent-cookbooks — later sprint.
- Adeu redline-quality fix — Arturs has a separate fix to share.
- Adeu MCP App diff preview — Sprint 13/14 (after redline-quality fix).
- Bespoke Commercial Disputes recipe with redline/disputes-shaped tooling — Sprint 13+.
- Multi-window per-matter Top of Mind — needs per-session-id file paths if/when multi-window lands.
- "## Matter workspaces" boilerplate cleanup across 48 skills — Sprint 13 (Top of Mind compensates behaviourally for Sprint 12).
- 16 skills' per-plugin state file references (`_log.yaml`, `gap-tracker.yaml`) — Sprint 13+ if exercised.
- Pre-Sprint-12 session migration — explicit non-goal; orphan sessions remain accessible via Goose's built-in Sessions panel.

**Carry-forwards for Sprint 13** — see `TODO.md` (Phase 8) for the full backlog. Anchor candidates: audit-log infrastructure (ADR-043 hand-off), adeu MCP App diff preview (gotoHuman pattern), "## Matter workspaces" boilerplate cleanup, SECURITY.md.

**Dogfood install (deferred to Arturs's Chromebook)**. This sprint did all the changes on `lq-vps` but cannot perform the end-to-end install verification — the sandbox here has a pre-existing pnpm-install issue with `@electron-forge/cli@7.11.1`'s exotic subdep (`blockExoticSubdeps` rejects `@electron/node-gyp`), so the `.deb` build runs on Crostini. Steps for dogfood:
1. From `/srv/projects/goose/ui/desktop`, run `pnpm install --no-frozen-lockfile` (on Crostini, where the install completes despite the warning) followed by `pnpm run bundle:oscar-linux`. The bundle script writes `src/resources/allowlist.yaml` and `src/resources/mcps/oscar-fs/index.js` and the `network_audit` section of `BUNDLE.json`.
2. Install the new `.deb` on Crostini (replace prior install).
3. Launch Oscar GC. Confirm: bundled skills symlink intact; `~/.config/oscar/state/` empty; `~/.config/oscar/tom-active-matter.md` exists (empty).
4. Pick a practice area (e.g. Commercial). Confirm MattersLanding renders ("no matters yet" empty-state + "New matter" affordance). Click "New matter", fill the dialog with client="Acme", counterparty="Zenith", matter type="NDA", privileged=false; confirm `matter.md` written; matter row visible. Open the matter; confirm chat surface mounts and the agent has matter context without re-reading `matter.md` (Top of Mind verification).
5. Run a redline. Confirm output writes to `<matter folder>/outputs/`.
6. New matter with `privileged: true`. Confirm copper accent strip + PRIVILEGED badge.
7. Open Forge from sidebar header. Ask: "Create a skill for board minute templates." Confirm `~/.agents/skills/board-minutes-drafter/SKILL.md` written.
8. Open Forge again. Ask: "Add a new practice area called Tax." Confirm `profile.json` updated; sidebar shows Tax (after refresh).
9. Try installing an extension via Extensions UI. Confirm blocked by empty `GOOSE_ALLOWLIST`.
10. Confirm 9 matter-workspace stubs are gone; sample-check a few substantive bundled skills for `$OSCAR_MATTER_DIR`. 
11. Network audit: open `BUNDLE.json` and confirm `network_audit.summary.matches === 0` (or document the matches as expected SDK transport text).

**ADRs**: 036 (matters data model), 037 (supersede matter-workspace stubs + $OSCAR_MATTER_DIR), 038 (conversation-history-to-matter binding), 039 (Forge chrome surface + scope), 040 (oscar-fs vendor MCP), 041 (per-recipe loadout + matter scope-down), 042 (network-egress discipline + allowlist), 043 (privileged-matter structural flag), 044 (Top of Mind matter context). Nine ADRs, all at decision time, before implementing code (CLAUDE.md mandate).

**Cross-repo SHAs**: `sarturko-maker/goose` only this sprint. `sarturko-maker/oscar-memory-mcp` and `sarturko-maker/oscar-onboarding-mcp` not touched. Sprint 12 commits on `goose`: `dbb511856` (CLAUDE.md), `1c1dcee93` (ADRs), `4b02ffef2` (Phase 2), `5a95d052c` (Phase 3), `a53ac7f3b` (Phase 4), `2a0384e27` (Phase 5), `ba5becba0` (Phase 6), `8770980d3` (Phase 7), `c0796a9a3` (Phase 8), plus this close-out commit. All pushed to origin.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25. Phase 0's CLAUDE.md upstream-doc reference rule went live and immediately paid off in plan-mode (discovered Top of Mind, Sandbox, Allowlist, MCP Roots).

---

### Sprint 11 — claude-for-legal repackaged as bundled in-house skill library (closed 2026-05-19)

**Goal**: repackage Anthropic's open-source `claude-for-legal` (Apache 2.0, https://github.com/anthropics/claude-for-legal) into Oscar GC as a single bundled in-house skill library. A user installs Oscar GC, runs the existing unified onboarding once, ends up with Anthropic's skills loaded for the practice areas they selected. No per-plugin install. No per-plugin onboarding. In-house assumed throughout. Two Sprint 10 close-out carry-forwards fold in because they live in the same UX area: markdown not rendering in onboarding (`OscarChatMessage.tsx`) and "jumps to practice areas too soon" pacing complaint. Plan at `/root/.claude/plans/brief-sprint-11-ancient-wadler.md`.

**Built**

Phased commits on `main` (no feature branches):

- **Phase 1** (`aa9551dfd`) — ADRs 031–035 at decision time, before code.
  - **ADR-031** Practice-area → upstream-plugin mapping: 9 plugins vendored verbatim under `skills/in-house-legal/<plugin>/`; new `bundled_skill_sources: readonly string[]` field on PracticeArea; mapping table (commercial → commercial-legal; commercial-disputes → commercial-legal + litigation-legal; cosec → corporate-legal weak-fit; etc.). Drops: law-student, legal-clinic, legal-builder-hub, external_plugins/cocounsel-legal, managed-agent-cookbooks.
  - **ADR-032** Onboarding schema v2 + P3.5 per-area mini-interviews: PracticeArea gains `area_profile: Record<string,string>|null`. Question templates colocate with the plugin at `skills/in-house-legal/<plugin>/onboarding-questions.json`; new MCP tool `list_area_questions(plugin_id)` reads from `OSCAR_RESOURCES_ROOT`; 2-question hard cap per area; pacing reshape with explicit completion line before P4. Markdown rendering fix wired in `OscarChatMessage.tsx`.
  - **ADR-033** In-house gating strip policy: deterministic regex on firm-branch headings; default-keep; borderlines via MANIFEST. Invocation-reference fixes (per-plugin practice profile → unified profile; output paths → ADR-034; neutral identifier for trademark).
  - **ADR-034** Output-path convention (supersedes ADR-019 narrow case): `~/Documents/Oscar/<Practice Area Name>/<Output Type>/<file>`; canonical Output Type vocabulary at `skills/in-house-legal/OUTPUT_TYPES.md`; no file migration (legacy `~/Documents/Oscar Redlines/` stays).
  - **ADR-035** Apache 2.0 NOTICE + attribution: two NOTICE files (repo root + bundled-skills root); per-file provenance comment at top of every kept SKILL.md; identifier discipline (`in-house-legal` neutral; `bundled_skill_sources` field name) for Apache §6 trademark.

- **Phase 2** (`806967b73`) — Vendor + NOTICE. Cloned `https://github.com/anthropics/claude-for-legal` at HEAD (`4d55f539...`, 2026-05-15). Copied the 9 in-house plugins into `skills/in-house-legal/`. Wrote `/NOTICE` (repo root) and `skills/in-house-legal/NOTICE` (per-plugin attribution). Bundle stats: 111 SKILL.md files, 3.4 MB before policy pass.

- **Phase 3** (per-plugin agents; outputs committed in Phase 4) — Dispatched 9 general-purpose subagents in parallel, one per kept plugin. Each agent applied ADR-033 to its plugin and produced two artefacts: `<plugin>/MANIFEST.md` (kept/dropped/keep-borderline per skill with reasoning) and `<plugin>/onboarding-questions.json` (exactly 2 priority-1 questions extracted from upstream cold-start-interview content per ADR-032). Aggregate finding: **no skill in any plugin contained firm-vs-in-house branches matching the ADR-033 strip regex** — upstream is already in-house-coded by design. The work reduces to drops + invocation-reference fixes + attribution. Per-plugin verdicts as recorded in MANIFESTs.

- **Phase 4** (`506f585f3`) — Policy pass + drops + collision rename. Three skill names appeared in all 9 plugins (`matter-workspace`, `cold-start-interview`, `customize`) and would have collided; orchestrator policy: drop `cold-start-interview` × 9 (content extracted to JSON), drop `customize` × 9 (replaced by Oscar Settings/profile editor per ADR-030), drop per-plugin `CLAUDE.md` × 9 (replaced by unified profile per ADR-031). `matter-workspace` kept as 9 inert stubs (self-disables for in-house default; 51 kept skills reference its `## Matter context` paragraph; Sprint 12 Matters layer supersedes). Three cross-plugin name collisions detected (`policy-monitor`, `reg-gap-analysis`, `use-case-triage` — each in both ai-governance-legal and privacy-legal); ADR-031 detect-and-prefix strategy applied (renamed to `<plugin>__<skill>`; frontmatter `name:` updated; cross-refs rewritten). Mechanical edits applied across 153 files: 503 slash-command rewrites (`/<plugin>:<skill>` → bare or prefixed skill name), path swaps for `~/.claude/plugins/config/claude-for-legal/<plugin>/CLAUDE.md` → `~/.config/oscar/profile.json` and state-file paths → `~/.config/oscar/state/<plugin>/`, 101 rewrites of orphaned `cold-start-interview` refs → "Oscar GC onboarding from Settings", 93 attribution comments added to top of each kept SKILL.md body. Verification: 0 dangling slash-command refs, 0 dangling `~/.claude/plugins/config` refs, 0 dangling `cold-start-interview` refs, 93 attribution comments present, all SKILL.md files have valid frontmatter.

- **Phase 5** (`9cafd4e71`) — Orchestrator outputs. `COLLISIONS.md` documents the 3 detected name collisions + 3 pre-empted collisions (drops). `OUTPUT_TYPES.md` enumerates the canonical per-area Output Type vocabulary (Redlines, NDA Reviews, MSA Reviews, DPAs, FTO Opinions, Board Minutes, etc.) and flags 2 outside-counsel-leaning Output Types for Sprint 11 dogfood (Brief Sections, Deposition Prep Memos).

- **Phase 6** — Sibling-repo `oscar-onboarding-mcp` v0.2.0 (`31987a9` at `sarturko-maker/oscar-onboarding-mcp`). Schema v2 in `src/schema.ts` (`PracticeArea` + `area_profile`); read-time v1→v2 migration in `src/store.ts`; new tool `list_area_questions` in `src/server.ts` reading `${OSCAR_RESOURCES_ROOT}/skills/in-house-legal/<plugin>/onboarding-questions.json`; smoke test updated to cover both tools, v2 finalize, list_area_questions resolution against the goose sibling repo, and graceful fallback for unknown plugins. Sibling-repo ADR-004 cross-references the goose-repo ADR-032. `tsc` clean; `pnpm run smoke` OK.

- **Phase 7** (`5b6df39a1`) — Desktop wiring on the goose side. Practice areas extended with `bundled_skill_sources` (per ADR-031 mapping table). `useOscarProfile.ts` type widened to `schema_version: 1 | 2` + optional `area_profile`. `systemPrompt.ts`: P3.5 inserted between P3 and P4 with 2-question hard cap; pacing reshape; `seedAreasJson` now embeds `bundled_skill_sources`; profile object shape updated to `schema_version: 2`. `OscarChatMessage.tsx`: agent-variant turns render through `MarkdownContent` (Sprint 7 carry-forward closed). `onboardingRecipe.ts` passes `OSCAR_RESOURCES_ROOT` through to the MCP via the recipe extension `envs`. `forge.config.ts` extraResource gains `src/resources/skills`. `prepare-oscar-bundle.js` adds a `prepareSkills()` step copying `/srv/projects/goose/skills/in-house-legal/` → `ui/desktop/src/resources/skills/in-house-legal/` (93 SKILL.md files); `BUNDLE.json` gains a `skills` provenance entry. `main.ts` adds `ensureBundledSkillsLink()` — idempotent symlink `~/.agents/skills/in-house-legal/` → resources path (production) or `/srv/projects/goose/skills/in-house-legal/` (dev fallback), called inline after `resolveOscarResourcesRoot()` so the symlink exists before any session spawns. Commercial recipe system prompt updated to ADR-034 output convention (`~/Documents/Oscar/Commercial/Redlines/`). `tsc --noEmit` clean.

**Closes**

Sprint 11's primary deliverable: bundled in-house skill library present in the goose repo at `skills/in-house-legal/`, wired into the .deb pipeline via `forge.config.ts` + `prepare-oscar-bundle.js`, discoverable at runtime via Goose's `all_skill_dirs()` walker through the `ensureBundledSkillsLink()` symlink. Onboarding extended to P3.5 with per-area mini-interviews sourced from upstream cold-start-interview content. Two Sprint 10 carry-forwards closed: markdown rendering in onboarding (`OscarChatMessage.tsx` uses `MarkdownContent`) and onboarding→practice-area pacing (P3.5 closes with explicit completion line before P4). Five ADRs at decision time, before code (CLAUDE.md mandate).

**Deferred / out-of-scope per Arturs's brief**

- Voice/dictation on onboarding (deferred until Goose ChatInput reuse lands).
- Managed-agent cookbooks (Sprint 12+).
- Community-skills installer / builder hub (Sprint 15+).
- Rewriting Anthropic skill bodies beyond gating-strip + invocation-reference fixes.
- The Forge meta-agent and Matters/Projects scoped containers (Sprint 12).
- Adeu's "doesn't redline like a lawyer" finding (Arturs has a fix to share).

**Carry-forwards for Sprint 12**

- **Dogfood install (deferred to Arturs's Chromebook).** This sprint did all the changes on `lq-vps` but cannot perform the end-to-end install verification. Steps for dogfood:
  1. Rebuild .deb via `bash /srv/projects/goose/scripts/build-oscar-deb.sh`.
  2. Install on Crostini (replace prior install).
  3. Launch Oscar GC. Confirm: `~/.agents/skills/in-house-legal/` symlink created on first boot; resolves to `/usr/lib/oscar-gc/resources/skills/in-house-legal/` (check `ls -la ~/.agents/skills/`).
  4. Run unified onboarding end-to-end. Confirm: markdown renders in interview turns; P3 practice-areas selection works; P3.5 fires per selected area with ≤2 questions each; total turn count ≤ ~25 (with 3-4 areas selected, expect 15-18); `~/.config/oscar/profile.json` has `schema_version: 2` and `area_profile` populated.
  5. From an agent chat in a selected practice area, invoke `load_skill(name: "<a skill from the bundled library>")` (e.g. `nda-review` for commercial). Confirm: skill loads with body + supporting files.
  6. Trigger one Commercial redline. Confirm: output writes to `~/Documents/Oscar/Commercial/Redlines/<stem>_redlined_<ts>.docx` (legacy `~/Documents/Oscar Redlines/` files untouched).
  7. Verify one skill per kept practice area can be invoked.
- **Sprint 10 BACKLOG items not closed by this sprint** stay open: top-right Goose mascot round 2 (`BaseChat.tsx:411`, `SessionsInsights.tsx:155,248`, `OnboardingGuard.tsx:157,190` direct Goose imports); app-icon raster pipeline; Settings telemetry toggle audit; postinst orphan-on-uninstall; commercial-chat-doesn't-load-on-click regression; MCP tool-call cards too large; `oscar-memory` recipe wiring; commercial system-prompt polish (Markdown emphasis, defined-term capitalisation, Clause 8 mutuality reminder).
- **Matter-workspace stubs** in the bundled library (9 stubs, currently inert for in-house users). Sprint 12 Matters/Projects supersedes; the orchestrator's MANIFESTs already capture this as a planned retirement target.
- **Future re-vendoring**: when Anthropic ships new claude-for-legal content, re-run the per-plugin agent dispatch + orchestrator pass. The MANIFESTs become regression baselines (a skill that suddenly fails the ADR-033 policy on a new pull is a signal worth investigating).

**Carry-forwards from prior sprints, still open**

- Sprint 9 P1/P2 system-prompt polish — still open; Sprint 12 candidate.
- `goose://` URL scheme rebrand; system-prompt self-identification; `document.title` runtime overwrite — branding follow-ups still open.
- Sprint 15+: migrate ADR-029's title-prefix short-circuit to a proper `recipe.metadata.bundled` flag.

**ADRs**: 031 (practice-area → plugin mapping), 032 (onboarding schema v2 + P3.5 per-area mini-interviews), 033 (in-house gating strip policy), 034 (output-path convention, supersedes ADR-019), 035 (Apache 2.0 NOTICE + attribution). Five ADRs, all at decision time, before implementing code (CLAUDE.md mandate). Sibling-repo `oscar-onboarding-mcp` ADR-004 cross-references ADR-032. ADR-034 supersedes ADR-019's narrow Redlines convention.

**Cross-repo SHAs**: `sarturko-maker/goose` and `sarturko-maker/oscar-onboarding-mcp` touched this sprint. `sarturko-maker/oscar-memory-mcp` not touched. Sprint 11 commits on `goose`: `aa9551dfd` (ADRs), `806967b73` (vendor + NOTICE), `506f585f3` (policy pass + drops + rename + reference fixes + attribution), `9cafd4e71` (orchestrator outputs), `5b6df39a1` (desktop wiring), plus this close-out commit. On `oscar-onboarding-mcp`: `31987a9` (schema v2 + list_area_questions tool). Pushes pending; SHAs above are local-only until pushed.

**Upstream-tracking**: no `upstream/main` merge this sprint. Next weekly read still due 2026-05-25.
