#!/bin/bash
# Sprint 10 (ADRs 021-024): build a Crostini-compatible oscar-gc .deb.
#
# Two-phase build:
#   1. Docker container (Debian 12) runs `cargo build --release -p goose-server`
#      and copies the resulting goosed binary into ui/desktop/src/bin/. This is
#      the only step that needs Debian 12 ABI compatibility (goosed otherwise
#      links against the host's newer glibc and won't run on Crostini).
#   2. Host runs `pnpm run bundle:oscar-linux` which executes
#      scripts/prepare-oscar-bundle.js (downloads portable Python, Node, wheels;
#      esbuilds MCPs) and `electron-forge make --targets=maker-deb`. All
#      remaining bundled artefacts are already glibc-2.28-or-older.
#
# Output: ui/desktop/out/make/deb/x64/oscar-gc_<version>_amd64.deb

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOCKERFILE="$REPO_ROOT/docker/Dockerfile.deb12-builder"
IMAGE_TAG="oscar-gc-deb12-builder:latest"
CARGO_VOLUME="oscar-gc-cargo-cache"
TARGET_DIR="$REPO_ROOT/target-debian12"

echo "[oscar-deb] phase 1: Debian 12 goosed build"
docker build -t "$IMAGE_TAG" -f "$DOCKERFILE" "$REPO_ROOT/docker"

mkdir -p "$TARGET_DIR"

docker run --rm \
  -v "$REPO_ROOT:$REPO_ROOT" \
  -v "$CARGO_VOLUME:/root/.cargo/registry" \
  -e "CARGO_TARGET_DIR=$TARGET_DIR" \
  -w "$REPO_ROOT" \
  "$IMAGE_TAG" \
  bash -c "cargo build --release -p goose-server"

GOOSED_BIN="$TARGET_DIR/release/goosed"
if [ ! -x "$GOOSED_BIN" ]; then
  echo "[oscar-deb] FAILED: goosed binary not at $GOOSED_BIN" >&2
  exit 1
fi

echo "[oscar-deb] staging Debian 12 goosed → ui/desktop/src/bin/"
mkdir -p "$REPO_ROOT/ui/desktop/src/bin"
cp "$GOOSED_BIN" "$REPO_ROOT/ui/desktop/src/bin/goosed"
chmod +x "$REPO_ROOT/ui/desktop/src/bin/goosed"

# Sanity check: confirm the goosed we just built does NOT require glibc 2.37+
MAX_GLIBC=$(objdump -T "$REPO_ROOT/ui/desktop/src/bin/goosed" \
  | grep -oE 'GLIBC_[0-9.]+' | sort -V | tail -n 1)
echo "[oscar-deb] goosed max glibc symbol: $MAX_GLIBC (Debian 12 has GLIBC_2.36)"

echo "[oscar-deb] phase 2: host bundle + electron-forge make"
# shellcheck disable=SC1091
source "$REPO_ROOT/bin/activate-hermit"
cd "$REPO_ROOT/ui/desktop"
pnpm run bundle:oscar-linux

DEB=$(ls "$REPO_ROOT/ui/desktop/out/make/deb/x64/"*.deb 2>/dev/null | head -1)
if [ -z "$DEB" ]; then
  echo "[oscar-deb] FAILED: no .deb produced" >&2
  exit 1
fi
echo "[oscar-deb] success → $DEB"
ls -lh "$DEB"
