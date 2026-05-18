#!/usr/bin/env bash
# Sprint 9 — re-runnable byte-level + structural verification of the
# adeu redline round-trip.
#
# Usage: bash docs/dogfood/sprint-9/verification.sh
# Exits 0 iff every required check passes; non-zero on first failure.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
IN="$ROOT/docs/dogfood/sprint-9/fixtures/unilateral-nda.docx"
OUT="$ROOT/docs/dogfood/sprint-9/output-cli-verify.docx"

[ -f "$IN" ] || { echo "FAIL: input not found: $IN"; exit 1; }
[ -f "$OUT" ] || { echo "FAIL: output not found: $OUT"; exit 1; }

IN_MD5=$(md5sum "$IN" | cut -d' ' -f1)
OUT_MD5=$(md5sum "$OUT" | cut -d' ' -f1)
echo "  input  md5: $IN_MD5"
echo "  output md5: $OUT_MD5"
[ "$IN_MD5" != "$OUT_MD5" ] || { echo "FAIL: md5 unchanged — adeu did not modify the document"; exit 1; }
echo "  ✓ md5 differs"

TMP=$(mktemp -d)
trap "rm -rf $TMP" EXIT
unzip -p "$IN" word/document.xml > "$TMP/in.xml"
unzip -p "$OUT" word/document.xml > "$TMP/out.xml"

# Mutuality-coded language: should increase in output
mutual_regex='each [Pp]arty|[Rr]eceiving [Pp]arty|[Dd]isclosing [Pp]arty|the other [Pp]arty|both [Pp]arties'
IN_MUT=$(grep -oE "$mutual_regex" "$TMP/in.xml" | wc -l)
OUT_MUT=$(grep -oE "$mutual_regex" "$TMP/out.xml" | wc -l)
echo "  input  mutual-markers: $IN_MUT"
echo "  output mutual-markers: $OUT_MUT"
[ "$OUT_MUT" -gt "$IN_MUT" ] || { echo "FAIL: mutuality language did not increase"; exit 1; }
echo "  ✓ mutual-markers increased by $((OUT_MUT - IN_MUT))"

# Track-changes markup must be present (proves redlines, not silent rewrite)
INS_COUNT=$(grep -oE '<w:ins ' "$TMP/out.xml" | wc -l)
DEL_COUNT=$(grep -oE '<w:del ' "$TMP/out.xml" | wc -l)
echo "  output w:ins count: $INS_COUNT"
echo "  output w:del count: $DEL_COUNT"
[ "$INS_COUNT" -gt 0 ] || { echo "FAIL: no <w:ins> tags — output is not a redline"; exit 1; }
[ "$DEL_COUNT" -gt 0 ] || { echo "FAIL: no <w:del> tags — output is not a redline"; exit 1; }
echo "  ✓ track-changes markup present"

# Document is still loadable (not corrupted)
PYTHON=/srv/projects/oscar-runtime/python/adeu-venv/bin/python
if [ -x "$PYTHON" ]; then
  "$PYTHON" -c "from docx import Document; d = Document('$OUT'); print(f'  paragraphs: {len(d.paragraphs)}')" \
    || { echo "FAIL: python-docx could not parse output (corrupted)"; exit 1; }
  echo "  ✓ output is a valid DOCX"
fi

echo
echo "All checks passed."
