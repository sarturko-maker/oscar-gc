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
