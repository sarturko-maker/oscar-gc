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

(Sprint 6 entry lands when Sprint 6 closes.)
