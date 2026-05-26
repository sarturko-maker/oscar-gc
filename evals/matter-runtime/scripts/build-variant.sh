#!/usr/bin/env bash
# Sprint 32 (ADR-109): build a matter-runtime variant binary at a pinned commit SHA.
# Uses git worktree so the main checkout stays intact.
#
# Usage:
#   bash evals/matter-runtime/scripts/build-variant.sh A
#   bash evals/matter-runtime/scripts/build-variant.sh B
#
# Variants are defined in scripts/lib-variants.js:
#   A → 04dd9ae72 (Sprint 31 doctrine, pre-ADR-108; 87-line discoveryDoctrine.ts)
#   B → d88ef8df6 (Sprint 31B doctrine, ADR-108 refinements; 135-line)
#
# Output: binaries/variant-<X>/Oscar-GC-linux-x64/ with the bundled Electron app.

set -euo pipefail

VARIANT_ID="${1:-}"
case "$VARIANT_ID" in
  A) SHA="04dd9ae72" ; EXPECTED_LINES=87  ; LABEL="Sprint 31 (pre-ADR-108)" ;;
  B) SHA="d88ef8df6" ; EXPECTED_LINES=135 ; LABEL="Sprint 31B (ADR-108)"     ;;
  *) echo "usage: $0 <A|B>"; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
WORKTREE="$REPO_ROOT/.worktree-variant-${VARIANT_ID}"
BIN_CACHE="$REPO_ROOT/evals/matter-runtime/binaries/variant-${VARIANT_ID}"
DOCTRINE_PATH="ui/desktop/src/components/oscar/recipe/discoveryDoctrine.ts"

echo "[variant-${VARIANT_ID}] target: ${SHA} (${LABEL}) — expecting ${EXPECTED_LINES} doctrine lines"

# 1. Verify expected doctrine line count at the SHA
actual_lines=$(git -C "$REPO_ROOT" show "${SHA}":${DOCTRINE_PATH} | wc -l)
if [[ "${actual_lines}" -ne "${EXPECTED_LINES}" ]]; then
  echo "[variant-${VARIANT_ID}] FAIL doctrine line mismatch: expected ${EXPECTED_LINES}, got ${actual_lines}" >&2
  exit 2
fi
echo "[variant-${VARIANT_ID}] doctrine line count OK (${actual_lines})"

# 2. Create worktree if missing; otherwise refresh to target SHA
if [[ ! -d "${WORKTREE}" ]]; then
  echo "[variant-${VARIANT_ID}] creating worktree at ${WORKTREE}"
  git -C "${REPO_ROOT}" worktree add --detach "${WORKTREE}" "${SHA}"
else
  echo "[variant-${VARIANT_ID}] reusing worktree at ${WORKTREE}; checking out ${SHA}"
  git -C "${WORKTREE}" checkout --detach "${SHA}"
fi

# 3. Build the bundle
echo "[variant-${VARIANT_ID}] running pnpm install + bundle:oscar-linux (this takes ~10-15 min)"
cd "${WORKTREE}/ui"
pnpm install --frozen-lockfile 2>&1 | tail -20
cd "${WORKTREE}/ui/desktop"
pnpm bundle:oscar-linux 2>&1 | tail -40

# 4. Snapshot the binary
SRC_DIR="${WORKTREE}/ui/desktop/out/Oscar-GC-linux-x64"
if [[ ! -f "${SRC_DIR}/oscar-gc" ]]; then
  echo "[variant-${VARIANT_ID}] FAIL build produced no oscar-gc binary at ${SRC_DIR}" >&2
  exit 3
fi

echo "[variant-${VARIANT_ID}] snapshotting binary → ${BIN_CACHE}"
rm -rf "${BIN_CACHE}"
mkdir -p "${BIN_CACHE}"
cp -r "${SRC_DIR}" "${BIN_CACHE}/"

# 5. Ensure goosed Rust binary is present — prepare-oscar-bundle.js silently
# skips this when running from a worktree (no target-debian12/ tree). Copy from
# the parent checkout's binary or from a peer variant cache.
GOOSED_DEST="${BIN_CACHE}/Oscar-GC-linux-x64/resources/bin/goosed"
if [[ ! -f "${GOOSED_DEST}" || ! -s "${GOOSED_DEST}" ]]; then
  GOOSED_SRC=""
  for candidate in \
    "${REPO_ROOT}/ui/desktop/out/Oscar-GC-linux-x64/resources/bin/goosed" \
    "${REPO_ROOT}/evals/matter-runtime/binaries/variant-B/Oscar-GC-linux-x64/resources/bin/goosed" \
    "${REPO_ROOT}/evals/matter-runtime/binaries/variant-A/Oscar-GC-linux-x64/resources/bin/goosed" \
    "${REPO_ROOT}/target-debian12/release/goosed" \
    "${REPO_ROOT}/target/release/goosed"; do
    if [[ -f "$candidate" && -s "$candidate" ]]; then
      GOOSED_SRC="$candidate"
      break
    fi
  done
  if [[ -z "${GOOSED_SRC}" ]]; then
    echo "[variant-${VARIANT_ID}] FAIL no goosed source found — checked main checkout, peer caches, target-debian12/release/, target/release/" >&2
    exit 4
  fi
  echo "[variant-${VARIANT_ID}] copying goosed from ${GOOSED_SRC}"
  cp -v "${GOOSED_SRC}" "${GOOSED_DEST}"
fi

# 6. Final verification
test -x "${BIN_CACHE}/Oscar-GC-linux-x64/oscar-gc"
test -x "${BIN_CACHE}/Oscar-GC-linux-x64/resources/bin/goosed"
echo "[variant-${VARIANT_ID}] OK: ${BIN_CACHE}/Oscar-GC-linux-x64/oscar-gc"
