# Dev Setup — [Goose]

Reference material for bootstrapping a fresh dev environment. Not mandatory cold-start reading.

## Prerequisites (assumed from `lq-vps`)

- Ubuntu 24.04, Tailscale, Docker, Caddy, git, Node LTS, tmux, Claude Code, gh CLI (authenticated).
- GitHub SSH key at `/root/.ssh/github_ed25519` registered to `sarturko-maker`.

## Bootstrap

```bash
cd /srv/projects/goose
git remote -v   # verify origin (fork) + upstream (aaif-goose/goose)
tmux new -s goose   # or: tmux attach -t goose
claude --dangerously-skip-permissions
```

## Goose-specific build deps

To be filled in after Sprint 1's first build attempt (Rust toolchain version, system libs, Node version, sccache config).
