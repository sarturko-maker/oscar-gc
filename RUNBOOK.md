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

## Pending

- Goose build dependencies (Rust toolchain, Node, system libs) — to be captured when Sprint 1 runs the first build.

## Corrections

- 2026-05-17 — The "Remotes" line above originally claimed both were SSH ("SSH after reset-url"). That was wrong when written: `gh repo fork` set HTTPS and the reset-url note was never applied. The conversion to SSH actually happened during housekeeping on 2026-05-17; the line above has been replaced with the real current state.
