#!/bin/sh
# Sprint 10 (ADRs 022, 025, 026):
#   - ADR-022: create the adeu venv from bundled Python + offline wheels.
#   - ADR-025/026: install the Crostini-aware launcher wrapper that captures
#     renderer stderr to ~/.cache/oscar-gc/launch.log.
# Re-runnable; idempotent across reinstalls.

set -e

APP_ROOT=/usr/lib/oscar-gc
PY="$APP_ROOT/resources/python/cpython/bin/python3"
VENV="$APP_ROOT/resources/python/adeu-venv"
WHEELS="$APP_ROOT/resources/python/wheels"
LAUNCHER="$APP_ROOT/oscar-gc-launcher.sh"

install_launcher() {
  cat > "$LAUNCHER" <<'WRAPPER'
#!/bin/sh
# Sprint 10 (ADR-026): Crostini-aware launcher with stderr capture.
# Override the log dir via OSCAR_GC_LOG_DIR env var.

LOG_DIR="${OSCAR_GC_LOG_DIR:-$HOME/.cache/oscar-gc}"
mkdir -p "$LOG_DIR" 2>/dev/null
LOG_FILE="$LOG_DIR/launch.log"

{
  echo "=== $(date -u '+%Y-%m-%dT%H:%M:%SZ') launch ==="
  echo "PATH=$PATH"
  echo "DISPLAY=${DISPLAY:-<unset>}"
  echo "WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-<unset>}"
} >> "$LOG_FILE" 2>/dev/null

export LIBGL_ALWAYS_SOFTWARE=1

exec /usr/lib/oscar-gc/oscar-gc \
  --ozone-platform=x11 \
  --disable-gpu \
  --disable-software-rasterizer \
  --enable-logging=stderr \
  --v=1 \
  "$@" \
  >> "$LOG_FILE" 2>&1
WRAPPER
  chmod +x "$LAUNCHER"
}

case "$1" in
  configure)
    if [ ! -x "$PY" ]; then
      echo "oscar-gc postinst: bundled Python not executable at $PY" >&2
      exit 1
    fi
    if [ ! -d "$WHEELS" ]; then
      echo "oscar-gc postinst: bundled wheels dir missing at $WHEELS" >&2
      exit 1
    fi

    rm -rf "$VENV"
    "$PY" -m venv "$VENV"
    "$VENV/bin/pip" install --no-index --find-links="$WHEELS" adeu==1.6.9

    install_launcher
    ;;
  abort-upgrade|abort-remove|abort-deconfigure)
    ;;
  *)
    echo "oscar-gc postinst: unknown argument: $1" >&2
    exit 0
    ;;
esac
