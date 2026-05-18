#!/bin/sh
# Sprint 10 (ADR-022): create the adeu venv from bundled Python + offline
# wheels at install time. Re-runnable; recreates the venv on upgrade.
#
# Install root is /usr/lib/oscar-gc/ (electron-installer-debian default;
# the maker-deb `prefix` option is silently ignored).

set -e

APP_ROOT=/usr/lib/oscar-gc
PY="$APP_ROOT/resources/python/cpython/bin/python3"
VENV="$APP_ROOT/resources/python/adeu-venv"
WHEELS="$APP_ROOT/resources/python/wheels"

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
    ;;
  abort-upgrade|abort-remove|abort-deconfigure)
    ;;
  *)
    echo "oscar-gc postinst: unknown argument: $1" >&2
    exit 0
    ;;
esac
