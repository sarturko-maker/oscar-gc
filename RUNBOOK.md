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

## Pending

(none — Sprint 1 complete)

## Corrections

- 2026-05-17 — The "Remotes" line above originally claimed both were SSH ("SSH after reset-url"). That was wrong when written: `gh repo fork` set HTTPS and the reset-url note was never applied. The conversion to SSH actually happened during housekeeping on 2026-05-17; the line above has been replaced with the real current state.
