#!/usr/bin/env bash
# Headless screenshot capture for Oscar GC. Starts Xvfb on a free display,
# bypasses OnboardingGuard via env vars, runs the Playwright-via-CDP capture
# script, and tears Xvfb down on exit. See ui/desktop/scripts/capture.js for
# the capture flow, and RUNBOOK.md for the apt deps this script assumes.
#
# Usage:
#   bash scripts/capture-oscar.sh --out-dir docs/screenshots/sprint-N [--routes "..."]
#
# Env overrides:
#   DISPLAY_NUM     — Xvfb display number (default 99)
#   SCREEN_GEOMETRY — Xvfb screen geometry (default 1440x900x24)
#   API_KEY_ENV     — path to env file to source for MINIMAX_API_KEY
#                     (default /srv/projects/lq-ai-agentic/.env)
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DISPLAY_NUM="${DISPLAY_NUM:-99}"
SCREEN_GEOMETRY="${SCREEN_GEOMETRY:-1440x900x24}"
API_KEY_ENV="${API_KEY_ENV:-/srv/projects/lq-ai-agentic/.env}"

if [[ -f "$REPO_ROOT/bin/activate-hermit" ]]; then
  # shellcheck disable=SC1091
  . "$REPO_ROOT/bin/activate-hermit"
fi

if [[ -f "$API_KEY_ENV" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "$API_KEY_ENV"
  set +a
else
  echo "[capture-oscar] WARN: $API_KEY_ENV not found; MINIMAX_API_KEY will be unset" >&2
fi

XVFB_PID=""
cleanup() {
  if [[ -n "$XVFB_PID" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
    kill "$XVFB_PID" 2>/dev/null || true
    wait "$XVFB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[capture-oscar] starting Xvfb :$DISPLAY_NUM ($SCREEN_GEOMETRY)"
Xvfb ":$DISPLAY_NUM" -screen 0 "$SCREEN_GEOMETRY" -ac -nolisten tcp >/tmp/xvfb-${DISPLAY_NUM}.log 2>&1 &
XVFB_PID=$!

for _ in {1..50}; do
  if [[ -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then break; fi
  sleep 0.1
done
if [[ ! -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then
  echo "[capture-oscar] Xvfb failed to come up; tail /tmp/xvfb-${DISPLAY_NUM}.log:" >&2
  tail -n 40 "/tmp/xvfb-${DISPLAY_NUM}.log" >&2 || true
  exit 1
fi

export DISPLAY=":$DISPLAY_NUM"
export GOOSE_PROVIDER="${GOOSE_PROVIDER:-minimax}"
export GOOSE_MODEL="${GOOSE_MODEL:-MiniMax-M2.5}"
export GOOSE_DISABLE_KEYRING="${GOOSE_DISABLE_KEYRING:-1}"

cd "$REPO_ROOT"
# Don't `exec` — that replaces bash and skips the EXIT trap that cleans up Xvfb.
node "ui/desktop/scripts/capture.js" "$@"
RC=$?
exit "$RC"
