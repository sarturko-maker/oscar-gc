#!/usr/bin/env bash
# Sprint M2 right-pane section-stack visual verification wrapper. Mirrors
# capture-m1.sh but invokes ui/desktop/scripts/capture-m2.js — drives 5
# states (Commercial/Privacy/IP defaults, collapsed, Commercial overridden).
#
# Usage:
#   bash scripts/capture-m2.sh --out-dir docs/screenshots/sprint-m2
#
# Same env knobs as capture-m1.sh:
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
  echo "[capture-m2] WARN: $API_KEY_ENV not found; MINIMAX_API_KEY will be unset" >&2
fi

XVFB_PID=""
cleanup() {
  if [[ -n "$XVFB_PID" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
    kill "$XVFB_PID" 2>/dev/null || true
    wait "$XVFB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[capture-m2] starting Xvfb :$DISPLAY_NUM ($SCREEN_GEOMETRY)"
Xvfb ":$DISPLAY_NUM" -screen 0 "$SCREEN_GEOMETRY" -ac -nolisten tcp >/tmp/xvfb-${DISPLAY_NUM}.log 2>&1 &
XVFB_PID=$!

for _ in {1..50}; do
  if [[ -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then break; fi
  sleep 0.1
done
if [[ ! -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then
  echo "[capture-m2] Xvfb failed to come up; tail /tmp/xvfb-${DISPLAY_NUM}.log:" >&2
  tail -n 40 "/tmp/xvfb-${DISPLAY_NUM}.log" >&2 || true
  exit 1
fi

export DISPLAY=":$DISPLAY_NUM"
export GOOSE_PROVIDER="${GOOSE_PROVIDER:-minimax}"
export GOOSE_MODEL="${GOOSE_MODEL:-MiniMax-M2.5}"
export GOOSE_DISABLE_KEYRING="${GOOSE_DISABLE_KEYRING:-1}"

cd "$REPO_ROOT"
node "ui/desktop/scripts/capture-m2.js" "$@"
RC=$?
exit "$RC"
