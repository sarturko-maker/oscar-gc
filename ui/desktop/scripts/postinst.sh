#!/bin/sh
# Sprint 10 (ADRs 025, 026): install the Crostini-aware launcher wrapper
# that captures renderer stderr to ~/.cache/oscar-gc/launch.log.
# Sprint 31 (ADR-103, supersedes ADR-022): the adeu venv block is gone —
# adeu is installed directly into bundled CPython at bundle time
# (prepare-oscar-bundle.js), so the .deb and zip share the same shape.
# Re-runnable; idempotent across reinstalls.

set -e

APP_ROOT=/usr/lib/oscar-gc
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
    install_launcher
    ;;
  abort-upgrade|abort-remove|abort-deconfigure)
    ;;
  *)
    echo "oscar-gc postinst: unknown argument: $1" >&2
    exit 0
    ;;
esac
