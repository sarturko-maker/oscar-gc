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

(Sprint 3 entry lands when Sprint 3 closes.)
