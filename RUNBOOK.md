# Runbook — [Goose] host state

Capture every host-state change as it happens. No retroactive writes. Goal: a fresh VPS can be rebuilt by running only these steps and the smoke test passes.

## Captured (2026-05-17)

- VPS: `lq-vps` (Tailscale tailnet `taile62e32.ts.net`). Shared with LQ-AI; baseline in `lq-ai-fork-state` memory.
- Path: `/srv/projects/goose` — flattened from `gh repo fork`'s nested clone.
- tmux session: `goose`.
- Remotes: `origin` = `git@github.com:sarturko-maker/goose.git`; `upstream` = `git@github.com:aaif-goose/goose.git`. Both SSH.
- GitHub auth: existing `/root/.ssh/github_ed25519` key (shared with LQ-AI).
- `gh` CLI: installed + authenticated on VPS.
- `/srv/projects/lq-ai-mirror.git` — pre-existing bare mirror from LQ-AI's manual-fork workaround. Not part of [Goose]; flagged in case anything scans `/srv/projects/` wholesale.

## Captured (2026-05-18)

- LQdesign reference repo cloned at `/srv/projects/LQdesign/` — separate clone, not a submodule.

## Build deps installed (Sprint 1, 2026-05-17)

System libs per `BUILDING_LINUX.md` (Ubuntu 24.04):

```bash
sudo apt update
sudo apt install -y dpkg fakeroot build-essential clang libxcb1-dev libxcb-util-dev protobuf-compiler libvulkan-dev libvulkan1 glslc
```

Versions pinned by apt at install time:

| Package | Version |
|---|---|
| build-essential | 12.10ubuntu1 |
| clang | 1:18.0-59~exp2 |
| dpkg | 1.22.6ubuntu6.6 |
| fakeroot | 1.33-1 |
| glslc | 2023.8-1build1 |
| libvulkan-dev | 1.3.275.0-1build1 |
| libvulkan1 | 1.3.275.0-1build1 |
| libxcb-util-dev | 0.4.0-1build3 |
| libxcb1-dev | 1.15-1ubuntu2 |
| protobuf-compiler | 3.21.12-8.2ubuntu0.3 |

## Toolchain (Sprint 1, 2026-05-17, via Hermit)

```bash
cd /srv/projects/goose
source bin/activate-hermit   # per-shell; every tmux pane needs this
```

First `cargo`/`rustc` invocation triggers `rustup` (Hermit-provisioned shim) to download the Rust toolchain pinned by `rust-toolchain.toml`. Hermit's own cache + provisioned components live under `~/.cache/hermit/` (488M after Rust 1.92 sync; will grow as pnpm/electron caches arrive).

| Tool | Version |
|---|---|
| cargo | 1.92.0 (344c4567c 2025-10-21) |
| rustc | 1.92.0 (ded5c06cf 2025-12-08) |
| rustup | 1.28.2 (e4f3ad6f8 2025-04-28) |
| node | v24.10.0 |
| pnpm | 10.30.3 |
| just | 1.40.0 |
| protoc | libprotoc 31.1 |

## Rust builds (Sprint 1, 2026-05-17, lq-vps)

```bash
source bin/activate-hermit
cargo build --release -p goose-cli       # 16m 50s; binary: target/release/goose (269M)
cargo build --release -p goose-server    # 9m 52s; binary: target/release/goosed (259M)
```

`target/` footprint after both release builds: **6.3G**. No sccache configured — incremental rebuilds re-use the local target dir but a fresh VPS pays the full ~27 min again.

`goose --version` returns `1.34.0` (matches `ui/desktop/package.json`).

## Stage goosed for UI bundle (Sprint 1, 2026-05-17)

Per `BUILDING_LINUX.md` §3 — copy the server binary into the UI's expected location so electron-forge bundles it:

```bash
mkdir -p ui/desktop/src/bin
cp target/release/goosed ui/desktop/src/bin/
```

The path `ui/desktop/src/bin/goosed` is already in `ui/desktop/.gitignore` — copy is a build-time artefact, not source.

## UI bundle build (Sprint 1, 2026-05-17)

```bash
source bin/activate-hermit
cd ui/desktop
pnpm install                                       # 17s (pnpm store cache hit)
pnpm run i18n:compile && \
  pnpm run make --targets=@electron-forge/maker-zip  # 50s on retry
```

Artefact: `ui/desktop/out/make/zip/linux/x64/Goose-linux-x64-1.34.0.zip` (200M). Total `ui/desktop/out/` footprint: **767M** (includes the unpacked `Goose-linux-x64/` tree alongside the zip).

### Gap in BUILDING_LINUX.md

`pnpm run make` first attempt failed with `spawn zip ENOENT` — the system `zip` binary is required by `@electron-forge/maker-zip` but is NOT listed in `BUILDING_LINUX.md` system deps. Required fix on Ubuntu 24.04:

```bash
sudo apt install -y zip
```

Worth raising with upstream — `BUILDING_LINUX.md` should add `zip` to the apt list. Recorded here so a fresh `lq-vps` rebuild won't repeat the failure.

## MiniMax round-trip (Sprint 1, 2026-05-17)

```bash
set -a; . /srv/projects/lq-ai-agentic/.env; set +a   # sources MINIMAX_API_KEY
GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5 \
  ./target/release/goose run --text "Reply with exactly: pong" --no-session
```

Key lives in `/srv/projects/lq-ai-agentic/.env` (LQ-AI-shared, $10/mo cap, easy to rotate). Sourced inline — never written to any file under `/srv/projects/goose/`.

### Goose host-state on Linux (discovered from this run)

Despite `etcetera`'s `top_level_domain: "Block"` in `crates/goose/src/config/paths.rs`, `choose_app_strategy` collapses to XDG on Linux and uses only `app_name`:

- Config: `~/.config/goose/` (not yet populated — env vars used instead)
- Data: `~/.local/share/goose/` — contains `sessions/sessions.db` (SQLite), `projects.json`, `apps/`
- State: `~/.local/state/goose/` — contains `logs/cli/<date>/*.log` (CLI tracing) and `logs/llm_request.*.jsonl` (per-request bodies)

### `--no-session` is a partial promise

`--no-session` skips persisting a per-session conversation file but DOES still:

- Write to `~/.local/share/goose/sessions/sessions.db`
- Append to `~/.local/state/goose/logs/llm_request.*.jsonl` (request body + model config, sanitised — no API key, verified)
- Append to `~/.local/state/goose/logs/cli/<date>/*.log` (tracing)

Worth knowing for Sprint 2 — if we want truly stateless invocations we'll need to engage `crates/goose-cli/src/session/builder.rs` directly.

## Sprint 2 — Oscar GC rebrand (2026-05-18, lq-vps)

Branding-metadata-only rebuild. Source edits in commit `62c9a08a4` (5 files under `ui/desktop/`). Build command sequence (Linux, x64, zip target — same as Sprint 1):

```bash
source bin/activate-hermit
cd ui/desktop
pnpm install                                       # 8.8s (refresh after package.json name change)
pnpm run i18n:compile
pnpm run make --targets=@electron-forge/maker-zip  # ~50s on lq-vps
```

Artefact: `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M).

`unzip -l` excerpt — key entries:

```
Archive:  Oscar-GC-linux-x64-1.34.0.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
        0  2026-05-18 00:18   Oscar-GC-linux-x64/
206036184  2026-05-18 00:17   Oscar-GC-linux-x64/oscar-gc            <-- Electron binary (renamed via packagerConfig.executableName)
  5908254  2026-05-18 00:18   Oscar-GC-linux-x64/resources/app.asar
271316120  2026-05-18 00:18   Oscar-GC-linux-x64/resources/bin/goosed <-- bundled Rust server (kept as upstream per ADR-001)
```

Verified pass criteria:
- Zip filename `Oscar-GC-linux-x64-1.34.0.zip` (Title-Case-Hyphenated per ADR-002).
- Top-level dir `Oscar-GC-linux-x64/`.
- Electron binary `oscar-gc` (kebab-case per ADR-002).
- No top-level `Goose` binary leaked (`unzip -l … | grep -E 'Oscar-GC-linux-x64/Goose$'` returns nothing).
- Bundled `resources/bin/goosed` retained — Rust crate renames are out of Sprint 2 scope (ADR-001).

`out/` footprint after Sprint 2: ~400M (Sprint 1's `Goose-linux-x64-1.34.0.zip` 200M still present alongside).

## Sprint 3 — Oscar GC landing placeholder (2026-05-18, lq-vps)

First `ui/desktop/src/` source change. Build command sequence unchanged from Sprint 2:

```bash
source bin/activate-hermit
cd ui/desktop
pnpm install                                       # 4.4s (cache warm)
pnpm run i18n:compile
pnpm run make --targets=@electron-forge/maker-zip  # ~10s on lq-vps (cache warm)
```

Artefact: `ui/desktop/out/make/zip/linux/x64/Oscar-GC-linux-x64-1.34.0.zip` (200M; same path as Sprint 2).

### Verification: extract `app.asar` and grep

```bash
source bin/activate-hermit
npx --yes @electron/asar extract \
  ui/desktop/out/Oscar-GC-linux-x64/resources/app.asar /tmp/sprint3-asar
grep -o "Oscar GC"                          /tmp/sprint3-asar/.vite/renderer/main_window/assets/*.js
grep -o "In-house legal agent platform"     /tmp/sprint3-asar/.vite/renderer/main_window/assets/*.js
grep -o "oscar-terminal__title"             /tmp/sprint3-asar/.vite/renderer/main_window/assets/*.css
grep -o "fonts.gstatic.com/s/inter/v20[^)]*" /tmp/sprint3-asar/.vite/renderer/main_window/assets/*.css
```

All four greps return a match — verification pass.

`npx @electron/asar` downloads `@electron/asar` (~60KB) on first run; cached afterwards. No new system package required. Renderer assets path inside the asar: `.vite/renderer/main_window/assets/{App-<hash>.js, index-<hash>.css, …}`. Hashes change per build.

`out/` footprint after Sprint 3: ~400M (Sprint 1's `Goose-linux-x64-1.34.0.zip` + Sprint 3's `Oscar-GC-linux-x64-1.34.0.zip` both present; Sprint 2's was overwritten by Sprint 3 — `make` reuses the same filename).

## Headless screenshot capture (housekeeping, 2026-05-18)

Closes the Sprint 3 + 4 carry-forward: no GUI host, no visual smoke test. Capture runs the packaged binary at `ui/desktop/out/Oscar-GC-linux-x64/oscar-gc` under Xvfb and drives it via Playwright over CDP. PNGs land at `docs/screenshots/sprint-N/<route-slug>.png`.

### apt install (one-shot host change)

The packaged binary depends on 13 X11/GTK runtime libs that the baseline VPS doesn't ship — confirmed via `ldd ui/desktop/out/Oscar-GC-linux-x64/oscar-gc | grep 'not found'`. Plus Xvfb itself:

```bash
sudo apt update
sudo apt install -y \
  xvfb \
  libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libcairo2 \
  libgtk-3-0t64 libpango-1.0-0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libgbm1 libasound2t64 libatspi2.0-0t64
```

Ubuntu 24.04 `*t64` names are the time_t-transitioned packages; the non-suffixed names will auto-redirect to them. `adwaita-icon-theme`, `humanity-icon-theme`, `ubuntu-mono` pull in transitively from `libgtk-3-0t64`. No additional Playwright browser downloads — the script connects to Electron's bundled Chromium over CDP.

### Invocation

```bash
bash scripts/capture-oscar.sh --out-dir docs/screenshots/sprint-N
```

Optional flags:
- `--routes "/,/#/practice/commercial,/#/practice/<id>"` — comma-separated HashRouter routes (default captures Hub + Commercial + Commercial Disputes).
- `--debug-port 9222` — change the CDP port if 9222 is busy.

Optional env:
- `DISPLAY_NUM=99` `SCREEN_GEOMETRY=1440x900x24` — Xvfb tuning.
- `CAPTURE_DEBUG=1` — stream the app's stdout/stderr through the script log.
- `API_KEY_ENV=/path/to/.env` — override the source file for `MINIMAX_API_KEY` (default `/srv/projects/lq-ai-agentic/.env`).

The wrapper sources `bin/activate-hermit` so node + pnpm resolve under the project toolchain; activates Xvfb on `:99`; exports `GOOSE_PROVIDER=minimax` / `GOOSE_MODEL=MiniMax-M2.5` / `GOOSE_DISABLE_KEYRING=1` so `crates/goose/src/config/base.rs:684,782` short-circuits past the OnboardingGuard's provider check; runs `ui/desktop/scripts/capture.js`; and traps EXIT to kill Xvfb regardless of how the script ends.

### Mechanism notes

- The capture script launches `out/Oscar-GC-linux-x64/oscar-gc --no-sandbox` (Electron refuses to run as root without it). Dev mode (`pnpm run start-gui`) was tried first but Vite's dep-scan kept flapping; the packaged binary loads `file://` directly so there's no Vite race.
- `ENABLE_PLAYWRIGHT=true` triggers the CDP switch at `ui/desktop/src/main.ts:352-355`, which is compiled into the packaged main bundle. No `ui/desktop/src/` change is required to enable capture.
- Goose's first-launch telemetry-consent modal blocks the surface; `capture.js` clicks "No thanks" on its first appearance, after which the choice persists in `~/.local/share/goose/`.
- Process teardown walks `/proc` for descendants of the spawned `oscar-gc` PID and signals them individually — Electron forks renderer/GPU/network helpers that don't inherit the PGID reliably across this Node/bash chain.
- Re-running is safe and produces byte-identical PNGs (verified runs 6 + 7 produced 44304 / 46462 / 46494 bytes for the three routes both times).

### Footprint

| Artefact | Footprint |
|---|---|
| Three sprint-4 PNGs | ~140 KB total |
| apt install set | ~140 MB (gtk + atk + pango + cairo + xvfb + their deps) |
| Capture script | `ui/desktop/scripts/capture.js` (~170 lines) + `scripts/capture-oscar.sh` (~55 lines) |

No persistent host-state beyond the apt install. Xvfb leaves no log artefacts after the trap fires; `/tmp/xvfb-99.log` is overwritten each run.

## Sprint 5 — Memory MCP server (2026-05-18, lq-vps)

First MCP extension we own. Server lives in a separate sibling repo, not in this repo. Goose-fork-side changes are limited to host config and these docs.

### Sibling repo location

```
/srv/projects/oscar-memory-mcp/   # local clone
git@github.com:sarturko-maker/oscar-memory-mcp.git   # SSH remote (same key as goose fork)
```

Initial commit: `0f17df00f`. SDK pinned to `@modelcontextprotocol/sdk@=1.29.0`. See the sibling repo's README and `docs/adr/` for the persistence / scope_id / licence decisions.

### Bootstrap order (matters on a fresh VPS)

```bash
git clone git@github.com:sarturko-maker/oscar-memory-mcp.git /srv/projects/oscar-memory-mcp
cd /srv/projects/oscar-memory-mcp
source /srv/projects/goose/bin/activate-hermit   # pnpm + node from Goose's Hermit env
pnpm install
pnpm build                                       # produces dist/index.js (gitignored)
pnpm smoke                                       # optional: programmatic MCP round-trip via the SDK client
```

`dist/index.js` is gitignored. If Goose tries to load the extension before `pnpm build` has run, it fails to spawn the child process (stderr warning, session continues without the extension — silent for the user).

The absolute path `/srv/projects/oscar-memory-mcp/dist/index.js` is hard-coded in `~/.config/goose/config.yaml`. Cloning the sibling repo to a different parent path means editing that YAML.

### Goose CLI registration

Append to `~/.config/goose/config.yaml` under the existing `extensions:` map:

```yaml
  oscar-memory:
    enabled: true
    type: stdio
    name: oscar-memory
    description: 'In-house notes store, scoped by scope_id. Two tools: store_note and list_notes.'
    cmd: node
    args:
      - /srv/projects/oscar-memory-mcp/dist/index.js
    timeout: 30
```

`enabled: true` is the gatekeeper — extensions without it are silently skipped (`crates/goose/src/config/extensions.rs:140-145`). `cmd: node` resolves via the parent shell's `PATH` to `/usr/bin/node` v24.15.0 (system, not Hermit); the extension subprocess does not need Hermit activation.

**YAML pitfall (hit this on first attempt)**: the `description:` value contains a colon (`Two tools:`), so it MUST be single-quoted. An unquoted description with an embedded `:` makes Goose silently drop the whole `extensions` map with a `WARN goose::config::base: Failed to deserialize value: mapping values are not allowed in this context` line in `~/.local/state/goose/logs/cli/<date>/*.log`. The agent then runs with only the bundled `type: platform` / `type: builtin` extensions and the new server appears to be missing.

`goose configure` would write the same stanza via TUI — direct YAML edit is the canonical Sprint 5 mechanism because it's documentable, version-controllable, and side-effect-free.

`Config::global()` is a per-process `OnceCell` (`crates/goose/src/config/base.rs:139`), so every `goose run` invocation re-reads `config.yaml` from disk. No daemon to bounce.

### Data directory

The server creates `~/.local/share/oscar-memory/notes.json` on the first successful `store_note` call. `OSCAR_MEMORY_PATH` env var overrides the default (used by the sibling repo's `pnpm smoke` to write to a tmpdir).

```bash
ls -la ~/.local/share/oscar-memory/notes.json
cat ~/.local/share/oscar-memory/notes.json | python3 -m json.tool
```

### Verification recipe (the Sprint 5 exit-criteria run)

```bash
# Run 1: store a note
set -a; . /srv/projects/lq-ai-agentic/.env; set +a
GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5 \
  /srv/projects/goose/target/release/goose run --debug --no-session \
  --text "Use the oscar-memory__store_note tool to save a note. scope_id is acme-customer-001. body is: first call with acme, discussed pricing"

# Run 2: retrieve notes (prompt does NOT include the body — proves the LLM had to call the tool)
GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5 \
  /srv/projects/goose/target/release/goose run --debug --no-session \
  --text "Use the oscar-memory__list_notes tool with scope_id acme-customer-001. Then tell me what notes are in there, verbatim."

# Run 3: independent ground truth (LLM-agnostic)
cat ~/.local/share/oscar-memory/notes.json | python3 -m json.tool
```

Pass criteria (all three required):

1. Run 1 transcript contains `▸ store_note oscar-memory` tool-call header (printed by `crates/goose-cli/src/session/output.rs:938-952`).
2. Run 3 output shows the note with the expected `scope_id`, `body`, and ISO 8601 `created_at`.
3. Run 2 transcript contains `▸ list_notes oscar-memory` tool-call header AND the agent's final response includes the body retrieved from the server.

Explicit tool naming (`oscar-memory__store_note`) in the prompts matters: without it, MiniMax tends to invoke Goose's built-in `todo__todo_write` for "store a note" (semantic collision). For real product flows the desktop UI will write the tool call directly, so this isn't a product concern.

### Footprint after Sprint 5

| Artefact | Footprint |
|---|---|
| `/srv/projects/oscar-memory-mcp/` source + node_modules | ~30 MB |
| `/srv/projects/oscar-memory-mcp/dist/` | ~5 KB |
| `~/.local/share/oscar-memory/notes.json` | starts empty; grows linearly per `store_note` |

No new apt packages, no new system services, no new daemons. Goose spawns the server fresh per invocation.

## Sprint 6 — Onboarding MCP server + recipe-driven agent (2026-05-18, lq-vps)

Second sibling MCP server, first recipe-scoped agent invocation from the desktop binary. Goose-fork-side changes are limited to host config, source under `ui/desktop/src/`, screenshots, and these docs.

### Sibling repo location

```
/srv/projects/oscar-onboarding-mcp/                       # local clone
git@github.com:sarturko-maker/oscar-onboarding-mcp.git    # SSH remote (same key as goose fork)
```

Initial commit: `82266afce`. Repo created public/Apache-2.0 via `gh repo create --public --source --remote=origin --push` at sprint close. Default remote was HTTPS; converted to SSH via `git remote set-url origin git@…` to match Sprint 5's sibling. SDK pinned to `@modelcontextprotocol/sdk@=1.29.0`. Three sibling-repo ADRs (persistence-JSON, all-args-A-class, Apache 2.0) mirror the Sprint 5 sibling pattern.

### Bootstrap order (matters on a fresh VPS)

```bash
git clone git@github.com:sarturko-maker/oscar-onboarding-mcp.git /srv/projects/oscar-onboarding-mcp
cd /srv/projects/oscar-onboarding-mcp
source /srv/projects/goose/bin/activate-hermit
pnpm install
pnpm build                                       # produces dist/index.js (gitignored)
pnpm smoke                                       # optional: MCP roundtrip via the SDK client
```

`dist/index.js` is gitignored. The recipe in the desktop bundle (`onboardingRecipe.ts`) hardcodes the absolute path `/srv/projects/oscar-onboarding-mcp/dist/index.js`. Cloning to a different parent path requires editing the recipe constant and rebuilding.

### Goose CLI registration

Appended to `~/.config/goose/config.yaml` under `extensions:` (sibling of `oscar-memory`):

```yaml
  oscar-onboarding:
    enabled: true
    type: stdio
    name: oscar-onboarding
    description: 'First-launch onboarding profile writer. One tool: finalize_profile.'
    cmd: node
    args:
      - /srv/projects/oscar-onboarding-mcp/dist/index.js
    timeout: 30
```

Same gatekeeper / YAML-pitfall rules as Sprint 5 apply. `description` value here has no embedded `:` colon, so no single-quoting required strictly, but quoted for consistency with the sibling entry.

### `cmd: node` vs `cmd: /usr/bin/node` (Sprint 6 gotcha)

The CLI sees `node` resolve to `/usr/bin/node` via the parent shell's PATH — same as Sprint 5. The DESKTOP binary, when goosed spawns the extension subprocess, inherits an Electron PATH where Hermit's `node` shim resolves first; the shim prints `Starting node setup (common).` to stderr and quits before MCP initialization, surfacing as `Failed to load extension oscar-onboarding` in the `~/.local/state/goose/logs/server/*.log` files.

The fix lives in the recipe's extension config, not in `~/.config/goose/config.yaml`: `ui/desktop/src/components/oscar/onboarding/onboardingRecipe.ts` hardcodes `cmd: '/usr/bin/node'`. The global YAML stanza still uses `cmd: node` for CLI compatibility. ADR-008 already flagged the hardcoded-path constraint for production builds.

### Profile data directory

The MCP server creates `~/.config/oscar/profile.json` on the first `finalize_profile` call. Override with `OSCAR_PROFILE_PATH=` for tests. Permissions are `0600` (owner read/write only — same atomic-write pattern as `oscar-memory`'s `notes.json`).

```bash
ls -la ~/.config/oscar/profile.json
cat ~/.config/oscar/profile.json | python3 -m json.tool
rm -f ~/.config/oscar/profile.json   # re-trigger onboarding on next desktop launch
```

### Verification recipe (the Sprint 6 exit-criteria runs)

**CLI verify** (proves the MCP server end-to-end through Goose):

```bash
set -a; . /srv/projects/lq-ai-agentic/.env; set +a
TMP_PROFILE=$(mktemp /tmp/oscar-onboarding-verify-XXXXXX.json); rm "$TMP_PROFILE"
OSCAR_PROFILE_PATH="$TMP_PROFILE" \
GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5 \
  /srv/projects/goose/target/release/goose run --no-session \
  --text "Use the oscar-onboarding__finalize_profile tool to save this profile verbatim. schema_version is 1. completed_at is 2026-05-18T14:00:00Z. user is name=Test User role=general-counsel role_label=General Counsel. corporate is name=TestCo industry=Testing size_band=51-200. practice_areas is a list with one entry: id=commercial name=Commercial body=test source=default. provider is kind=minimax model=MiniMax-M2.5."
cat "$TMP_PROFILE"
rm -f "$TMP_PROFILE"
```

Pass criteria: `▸ finalize_profile oscar-onboarding` header in the transcript; tmp file contains the expected JSON shape.

**Desktop verify** (proves the recipe-driven session + chat surface):

```bash
rm -f ~/.config/oscar/profile.json                          # ensure empty state
bash scripts/capture-oscar.sh --out-dir /tmp/sprint6-verify --routes "/"
# Inspect /tmp/sprint6-verify/root.png — should show OscarOnboardingView,
# greeting visible, no extension-load toast in the upper-right.
```

**Live conversation verify** (proves streaming + agent voice):

```bash
rm -f ~/.config/oscar/profile.json
set -a; . /srv/projects/lq-ai-agentic/.env; set +a
export GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5 GOOSE_DISABLE_KEYRING=1
Xvfb :99 -screen 0 1440x900x24 -ac -nolisten tcp >/tmp/xvfb-99.log 2>&1 & XVFB_PID=$!
sleep 1
DISPLAY=:99 source bin/activate-hermit && \
  cd ui/desktop && node scripts/capture-conversation.mjs
kill $XVFB_PID
# Inspect docs/screenshots/sprint-6/onboarding-mid-conversation.png —
# should show three turns: greeting, user "Arturs Sliede.", agent's P1 follow-up.
```

### Footprint after Sprint 6

| Artefact | Footprint |
|---|---|
| `/srv/projects/oscar-onboarding-mcp/` source + node_modules | ~30 MB |
| `/srv/projects/oscar-onboarding-mcp/dist/` | ~6 KB |
| `~/.config/oscar/profile.json` | <4 KB (small JSON) |
| `docs/screenshots/sprint-6/` (5 PNGs) | ~2.8 MB |

No new apt packages, no new system services, no new daemons.

## Sprint 7 — Dogfood capture (2026-05-18, lq-vps)

End-to-end harness for the "CC as the user" pattern. Drives the packaged Oscar GC binary on Xvfb through Playwright/CDP, types persona answers turn-by-turn, screenshots after every agent reply, persists a JSON sidecar of all turns, and lets the canonical transcript come from goosed's session DB after the fact.

### Entry points

- `scripts/dogfood/dogfood.sh` — bash wrapper. Sources `MINIMAX_API_KEY` from `/srv/projects/lq-ai-agentic/.env`, exports `GOOSE_PROVIDER=minimax GOOSE_MODEL=MiniMax-M2.5 GOOSE_DISABLE_KEYRING=1`, ensures Xvfb is up on `:99`, then delegates to the Node driver.
- `ui/desktop/scripts/dogfood-driver.mjs` — Node driver. Lives under `ui/desktop/scripts/` (not `scripts/dogfood/`) so ESM `import 'playwright'` resolves through `ui/node_modules/`.

### Subcommands

| Subcommand | What it does |
|---|---|
| `dogfood.sh launch <session>` | Reset state dir, spawn the packaged binary with `ENABLE_PLAYWRIGHT=true PLAYWRIGHT_DEBUG_PORT=9223`, wait for chat input, capture greeting screenshot, log app pid. |
| `dogfood.sh send "<text>"` | Fill the input, click send, poll for response stabilisation, append turns to `/tmp/oscar-dogfood/turns.json`, screenshot. Detects chat unmounting (session-complete signal). |
| `dogfood.sh screenshot <label>` | Take a labelled screenshot without sending. |
| `dogfood.sh read` | Print every chat turn currently in the DOM. |
| `dogfood.sh status` | Print app pid, profile-file presence, turn count, next screenshot number. |
| `dogfood.sh quit` | Take a final-state screenshot, SIGTERM the app. |

### State files (under `/tmp/oscar-dogfood/`)

- `app.pid` — current spawned binary's pid
- `screenshot-counter` — next screenshot number (per session)
- `session-name` — current session label
- `turns.json` — accumulated `{role, text, ts}` turns (DOM-side; backup transcript)
- `app.log`, `app.err.log` — captured stdout/stderr of the spawned binary

Screenshots land in `docs/dogfood/sprint-N/screenshots/<session>/NN-label.png`.

### Reset between sessions

```
# profile reset (re-triggers onboarding on next launch)
rm -f ~/.config/oscar/profile.json
```

The goosed session DB at `~/.local/share/goose/sessions/sessions.db` can be left alone — each new conversation gets a fresh row. Identify the dogfood session post-hoc by `created_at` or by the auto-generated `name`.

### Extracting the canonical transcript

The DOM-side `turns.json` is a backup; the source of truth is the goosed session DB (includes the LLM's emitted closing message even when the UI didn't render it, plus thinking traces and tool blocks). Use a one-shot Python script:

```python
import sqlite3, json
conn = sqlite3.connect('/root/.local/share/goose/sessions/sessions.db')
c = conn.cursor()
c.execute("SELECT id, name FROM sessions ORDER BY created_at DESC LIMIT 5")
print(c.fetchall())                       # identify your session id
c.execute("SELECT role, content_json, timestamp FROM messages "
          "WHERE session_id=? ORDER BY id", ('20260518_11',))
for role, content_json, ts in c.fetchall():
    print(role, ts, json.loads(content_json))
```

`content_json` is a JSON array of content blocks: `{type:"text"}`, `{type:"thinking"}`, `{type:"toolRequest"}`, `{type:"toolResponse"}`. Skip thinking blocks when rendering for humans.

### Greeting note

The onboarding view's greeting is rendered client-side from `systemPrompt.ts:GREETING` and is never sent through goosed. The session DB therefore starts at the user's first reply. Prepend the hardcoded greeting manually when producing report transcripts.

### Cold-relaunch test

After `finalize_profile` writes the profile, quit the app and call `launch <label>` again with a fresh label. The driver will fail waiting for `.oscar__chat-input` (timeout 30 s) — that timeout *is* the success signal: chat is gone because onboarding correctly did not re-trigger. Verify with `dogfood.sh screenshot <label>` and `dogfood.sh read` (which will report `chatInput=false turns=0`).

### Footprint after Sprint 7

| Artefact | Footprint |
|---|---|
| `scripts/dogfood/dogfood.sh` | <1 KB |
| `ui/desktop/scripts/dogfood-driver.mjs` | ~11 KB |
| `docs/dogfood/sprint-7/` (report + transcripts + 22 PNGs) | ~10 MB |
| `/tmp/oscar-dogfood/` (state, ephemeral) | <1 MB |

No new apt packages, no new system services. Playwright reused from the existing `ui/node_modules/`.

## Sprint 8 — Hub welcome banner re-dogfood (2026-05-18, lq-vps)

Sprint 8 adds a one-time, dismissable Hub welcome banner per ADR-015. Re-uses the Sprint 7 dogfood harness with two harness-side enhancements (no product change beyond the banner itself).

### Reset host state between sprints (Sprint 8 dogfood gotcha)

The banner's dismissal flag lives in Electron renderer localStorage. Electron's user-data dir on Linux is **`~/.config/Oscar GC/`** (with a space — Electron honours `ui/desktop/package.json`'s `productName: "Oscar GC"`). The leveldb store backing localStorage lives at `~/.config/Oscar GC/Local Storage/`. To reset for a clean Sprint 8 dogfood:

```bash
rm -f ~/.config/oscar/profile.json                # retrigger onboarding
rm -rf "/root/.config/Oscar GC/Local Storage"     # clear oscar.hubWelcomeDismissed
rm -rf /tmp/oscar-dogfood                         # clear driver state
```

The quoted path (`"…Oscar GC/Local Storage"`) is required — the space matters.

### Dogfood harness enhancements

Two additions to the Sprint 7 driver, both backwards-compatible:

| Capability | How |
|---|---|
| Per-sprint screenshot path | `DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-N/screenshots` env var. Driver defaults to `docs/dogfood/sprint-7/screenshots` if unset. |
| Click an arbitrary selector | `bash scripts/dogfood/dogfood.sh click "<css-selector>"` — connects via CDP, clicks, waits 300ms, screenshots with a slug-encoded label. Used for the Sprint 8 banner dismiss. |

Driver docblock at `ui/desktop/scripts/dogfood-driver.mjs` lists the full subcommand set.

### Verification recipe (Sprint 8 exit criteria)

```bash
# pre-flight reset
rm -f ~/.config/oscar/profile.json
rm -rf "/root/.config/Oscar GC/Local Storage"
rm -rf /tmp/oscar-dogfood

# launch + drive
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh launch sprint-8-daniel
# … send persona turns until the agent calls finalize_profile and chat unmounts …

# post-onboarding banner check
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh screenshot post-onboarding-hub-with-banner
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh click ".oscar__banner-dismiss"

# cold-relaunch dismissal persistence
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh quit
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh launch sprint-8-daniel-relaunch   # throws on chat-input timeout — expected
DOGFOOD_SCREENSHOT_BASE=docs/dogfood/sprint-8/screenshots \
  bash scripts/dogfood/dogfood.sh screenshot cold-relaunch-hub
```

The relaunch `launch` throws because `OscarOnboardingGuard` skipped onboarding (profile exists) and `.oscar__chat-input` never appears — that timeout *is* the success signal. The screenshot subcommand still works against the running app.

### Footprint after Sprint 8

| Artefact | Footprint |
|---|---|
| `docs/dogfood/sprint-8/` (report + transcript + extracts + 11 PNGs) | ~7 MB |
| `docs/screenshots/sprint-8/` (3 mirror PNGs) | ~1.8 MB |
| `~/.config/Oscar GC/Local Storage/` | <1 KB (one leveldb record for the dismissal flag) |

No new apt packages, no new system services. No new daemons. Driver and screenshot harness unchanged in shape; one env var and one subcommand added.

## Pending

(none — Sprint 8 complete)

## Corrections

- 2026-05-17 — The "Remotes" line above originally claimed both were SSH ("SSH after reset-url"). That was wrong when written: `gh repo fork` set HTTPS and the reset-url note was never applied. The conversion to SSH actually happened during housekeeping on 2026-05-17; the line above has been replaced with the real current state.
