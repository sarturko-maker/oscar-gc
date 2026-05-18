#!/usr/bin/env bash
#
# Dogfood entry point. Sets up MiniMax env + Xvfb, then delegates to the
# Node driver. Subcommands: launch <session> | send <msg> | screenshot <label>
#                          | read | status | quit
#
# See RUNBOOK.md "Dogfood capture" section.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DRIVER="$REPO_ROOT/ui/desktop/scripts/dogfood-driver.mjs"

ENV_FILE="${ENV_FILE:-/srv/projects/lq-ai-agentic/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

export GOOSE_PROVIDER="${GOOSE_PROVIDER:-minimax}"
export GOOSE_MODEL="${GOOSE_MODEL:-MiniMax-M2.5}"
export GOOSE_DISABLE_KEYRING=1

DISPLAY_NUM="${DISPLAY_NUM:-99}"
export DISPLAY=":$DISPLAY_NUM"
if ! pgrep -af "Xvfb $DISPLAY" >/dev/null 2>&1; then
  Xvfb "$DISPLAY" -screen 0 1920x1080x24 >/tmp/oscar-dogfood-xvfb.log 2>&1 &
  sleep 1
fi

cd "$REPO_ROOT/ui/desktop"
exec node "$DRIVER" "$@"
