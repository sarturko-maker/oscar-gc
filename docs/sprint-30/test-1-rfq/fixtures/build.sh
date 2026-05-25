#!/usr/bin/env bash
# Build the RFQ fixture pack.
#
# Inputs:  fixtures/source/*.md  (markdown source, human-readable + diff-able)
# Outputs: fixtures/staged/*.{pdf,docx}  (what gets copied into the matter folder)
#
# DOCX via pandoc (real OOXML — Adeu can redline these).
# PDF  via pandoc -> html, then weasyprint (no LaTeX needed; venv-only).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SRC="$HERE/source"
OUT="$HERE/staged"
VENV_PY=/srv/projects/oscar-runtime/python/adeu-venv/bin/python
mkdir -p "$OUT"

# Map: source-stem -> output-extension
declare -A MAP=(
  [01-rfq-invitation-letter]=pdf
  [02-master-supply-agreement]=docx
  [03-pricing-schedule]=docx
  [04-service-level-agreement]=pdf
  [05-general-terms-conditions]=pdf
  [06-compliance-annex]=pdf
  [07-rfp-questionnaire]=docx
  [08-supplementary-tcs]=pdf
)

for stem in "${!MAP[@]}"; do
  ext="${MAP[$stem]}"
  src="$SRC/$stem.md"
  dst="$OUT/$stem.$ext"
  if [[ ! -f "$src" ]]; then
    echo "MISSING source: $src" >&2
    exit 1
  fi
  case "$ext" in
    docx)
      pandoc -f markdown -t docx --reference-doc /dev/null --metadata-file=/dev/null "$src" -o "$dst" 2>/dev/null \
        || pandoc -f markdown -t docx "$src" -o "$dst"
      ;;
    pdf)
      html="$(mktemp --suffix=.html)"
      pandoc -f markdown -t html5 --standalone --metadata title="$stem" "$src" -o "$html"
      "$VENV_PY" -c "
import sys
from weasyprint import HTML
HTML(filename=sys.argv[1]).write_pdf(sys.argv[2])
" "$html" "$dst"
      rm -f "$html"
      ;;
  esac
  size=$(stat -c%s "$dst")
  echo "built $stem.$ext ($size bytes)"
done

echo "---"
echo "staged pack:"
ls -la "$OUT"
