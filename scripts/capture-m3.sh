#!/usr/bin/env bash
# Sprint M3 right-pane real-bodies visual verification wrapper. Mirrors
# capture-m2.sh but invokes ui/desktop/scripts/capture-m3.js — drives 5
# states (Commercial MatterFacts, Privacy ProgrammeFacts, History after a
# chat turn, polled-read picks up external matter.md edit, Top of Mind
# surfaces after setActive).
#
# Usage:
#   bash scripts/capture-m3.sh --out-dir docs/screenshots/sprint-m3
#
# Env knobs (same as capture-m2.sh):
#   DISPLAY_NUM, SCREEN_GEOMETRY, API_KEY_ENV.
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
  echo "[capture-m3] WARN: $API_KEY_ENV not found; MINIMAX_API_KEY will be unset" >&2
fi

XVFB_PID=""
cleanup() {
  if [[ -n "$XVFB_PID" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
    kill "$XVFB_PID" 2>/dev/null || true
    wait "$XVFB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

# Parallel-sprint coordination per the M3 brief: if Sprint 24's session
# is occupying Xvfb :99, fall back to :98 by exporting DISPLAY_NUM=98.
echo "[capture-m3] starting Xvfb :$DISPLAY_NUM ($SCREEN_GEOMETRY)"
Xvfb ":$DISPLAY_NUM" -screen 0 "$SCREEN_GEOMETRY" -ac -nolisten tcp >/tmp/xvfb-${DISPLAY_NUM}.log 2>&1 &
XVFB_PID=$!

for _ in {1..50}; do
  if [[ -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then break; fi
  sleep 0.1
done
if [[ ! -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then
  echo "[capture-m3] Xvfb failed to come up; tail /tmp/xvfb-${DISPLAY_NUM}.log:" >&2
  tail -n 40 "/tmp/xvfb-${DISPLAY_NUM}.log" >&2 || true
  exit 1
fi

export DISPLAY=":$DISPLAY_NUM"
export GOOSE_PROVIDER="${GOOSE_PROVIDER:-minimax}"
export GOOSE_MODEL="${GOOSE_MODEL:-MiniMax-M2.5}"
export GOOSE_DISABLE_KEYRING="${GOOSE_DISABLE_KEYRING:-1}"

cd "$REPO_ROOT"
node "ui/desktop/scripts/capture-m3.js" "$@"
RC=$?
exit "$RC"
