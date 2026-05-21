#!/usr/bin/env bash
# Sprint M6 Skill upload + Forge Mode C visual verification wrapper.
# Clones capture-m5.sh; invokes ui/desktop/scripts/capture-m6.js — drives
# 6 deterministic states (drop-zone visible, stage IPC success,
# Forge auto-opens with ?reviewSkill, Mode-C activation preamble
# diagnostic, simulated binding visible on Commercial, Privacy unbound).
#
# Live agent turns are deferred to M8 Crostini dogfood. The visual
# harness validates the wiring; the recipe-injection diagnostic mirrors
# M4/M5's recipe-content verification.
#
# Usage:
#   bash scripts/capture-m6.sh --out-dir docs/screenshots/sprint-m6
#
# Env knobs (same as capture-m5.sh):
#   DISPLAY_NUM, SCREEN_GEOMETRY, API_KEY_ENV.
#
# Parallel-sprint coordination: re-probe `pgrep -af "Xvfb :99"` before
# invocation. If lavern-firm-mode has a session on :99, export
# DISPLAY_NUM=98 first.
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
  echo "[capture-m6] WARN: $API_KEY_ENV not found; MINIMAX_API_KEY will be unset" >&2
fi

XVFB_PID=""
cleanup() {
  if [[ -n "$XVFB_PID" ]] && kill -0 "$XVFB_PID" 2>/dev/null; then
    kill "$XVFB_PID" 2>/dev/null || true
    wait "$XVFB_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "[capture-m6] starting Xvfb :$DISPLAY_NUM ($SCREEN_GEOMETRY)"
Xvfb ":$DISPLAY_NUM" -screen 0 "$SCREEN_GEOMETRY" -ac -nolisten tcp >/tmp/xvfb-${DISPLAY_NUM}.log 2>&1 &
XVFB_PID=$!

for _ in {1..50}; do
  if [[ -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then break; fi
  sleep 0.1
done
if [[ ! -e "/tmp/.X11-unix/X${DISPLAY_NUM}" ]]; then
  echo "[capture-m6] Xvfb failed to come up; tail /tmp/xvfb-${DISPLAY_NUM}.log:" >&2
  tail -n 40 "/tmp/xvfb-${DISPLAY_NUM}.log" >&2 || true
  exit 1
fi

export DISPLAY=":$DISPLAY_NUM"
export GOOSE_PROVIDER="${GOOSE_PROVIDER:-minimax}"
export GOOSE_MODEL="${GOOSE_MODEL:-MiniMax-M2.5}"
export GOOSE_DISABLE_KEYRING="${GOOSE_DISABLE_KEYRING:-1}"

cd "$REPO_ROOT"
node "ui/desktop/scripts/capture-m6.js" "$@"
RC=$?
exit "$RC"
