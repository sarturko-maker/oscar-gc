#!/usr/bin/env bash
# Sprint 29 M4 — Skills section: surface zone + collapsed directory.
#
# Usage: bash scripts/capture-sprint29-m4.sh --out-dir docs/screenshots/sprint-29-m4
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
fi

XVFB_PID=""
cleanup() {
  if [[ -n "$XVFB_PID" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
    kill "$XVFB_PID" 2>/dev/null || true
    wait "$XVFB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[capture-sprint29-m4] starting Xvfb :$DISPLAY_NUM ($SCREEN_GEOMETRY)"
Xvfb ":$DISPLAY_NUM" -screen 0 "$SCREEN_GEOMETRY" -ac -nolisten tcp >/tmp/xvfb-${DISPLAY_NUM}.log 2>&1 &
XVFB_PID=$!

for _ in {1..50}; do
  if [[ -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then break; fi
  sleep 0.1
done
if [[ ! -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then
  echo "[capture-sprint29-m4] Xvfb failed; tail of log:" >&2
  tail -n 40 "/tmp/xvfb-${DISPLAY_NUM}.log" >&2 || true
  exit 1
fi

export DISPLAY=":$DISPLAY_NUM"
export GOOSE_PROVIDER="${GOOSE_PROVIDER:-minimax}"
export GOOSE_MODEL="${GOOSE_MODEL:-MiniMax-M2.5}"
export GOOSE_DISABLE_KEYRING="${GOOSE_DISABLE_KEYRING:-1}"

cd "$REPO_ROOT"
node "ui/desktop/scripts/capture-sprint29-m4.js" "$@"
