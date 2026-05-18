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

(Sprint 5 entry lands when Sprint 5 closes.)
