#!/usr/bin/env python3
"""Sprint 13 — adeu redline OOXML width verification harness.

Inspects a .docx for the lawyer-shape granularity criteria defined in
docs/redline/lawyer-shape-criteria.md §1 (OOXML granularity):

  - Median w:ins/w:del wrap width <= 3 words
  - 80th percentile <= 5 words
  - No element wraps 11+ words (unless it's a genuine wholesale rewrite)

Also performs §2 preserve-discipline spot-check: given a list of phrases
expected to appear verbatim in the output, confirms each one matches.

Usage:
  ./verify-redline-shape.py inspect <output.docx> [--preserve "phrase 1" "phrase 2" ...]
  ./verify-redline-shape.py compare <baseline.docx> <patched.docx>

Exit codes:
  0 — all criteria pass
  1 — criteria failed (with a printed report)
  2 — input not found / parsing error
"""

from __future__ import annotations

import argparse
import re
import statistics
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W_INS = f"{{{NS['w']}}}ins"
W_DEL = f"{{{NS['w']}}}del"
W_T = f"{{{NS['w']}}}t"
W_DELTEXT = f"{{{NS['w']}}}delText"


@dataclass
class TrackElement:
    kind: str  # "ins" or "del"
    author: str
    text: str
    word_count: int


def extract_track_elements(docx_path: Path) -> list[TrackElement]:
    """Read word/document.xml and return every w:ins / w:del with its
    wrapped text and word count."""
    if not docx_path.exists():
        print(f"FAIL: file not found: {docx_path}", file=sys.stderr)
        sys.exit(2)

    with zipfile.ZipFile(docx_path) as z:
        with z.open("word/document.xml") as f:
            tree = ET.parse(f)

    elements: list[TrackElement] = []
    for el in tree.iter():
        if el.tag == W_INS:
            text = "".join(t.text or "" for t in el.iter(W_T))
            kind = "ins"
        elif el.tag == W_DEL:
            text = "".join(t.text or "" for t in el.iter(W_DELTEXT))
            kind = "del"
        else:
            continue
        author = el.get(f"{{{NS['w']}}}author", "")
        word_count = len(text.split())
        elements.append(TrackElement(kind, author, text, word_count))
    return elements


def width_distribution(elements: list[TrackElement]) -> dict:
    """Compute the wrap-width distribution per the criteria."""
    widths = [e.word_count for e in elements if e.word_count > 0]
    if not widths:
        return {"count": 0}
    return {
        "count": len(widths),
        "median": statistics.median(widths),
        "p80": _percentile(widths, 80),
        "p95": _percentile(widths, 95),
        "max": max(widths),
        "buckets": {
            "1-2": sum(1 for w in widths if 1 <= w <= 2),
            "3-5": sum(1 for w in widths if 3 <= w <= 5),
            "6-10": sum(1 for w in widths if 6 <= w <= 10),
            "11+": sum(1 for w in widths if w >= 11),
        },
    }


def _percentile(values: list[int], pct: int) -> float:
    if not values:
        return 0.0
    sorted_v = sorted(values)
    k = (len(sorted_v) - 1) * pct / 100
    f = int(k)
    c = min(f + 1, len(sorted_v) - 1)
    return sorted_v[f] + (sorted_v[c] - sorted_v[f]) * (k - f)


def grade_distribution(dist: dict) -> tuple[bool, list[str]]:
    """Apply criteria §1 hard gates (median ≤ 3, p80 ≤ 5).

    11+ wraps are reported but NOT auto-FAILed: criteria.md §1 allows them
    for "genuine wholesale rewrites" (no common text to narrow). The harness
    surfaces them for human review.
    """
    if dist.get("count", 0) == 0:
        return False, ["no <w:ins>/<w:del> elements found — not a redline"]
    reasons = []
    if dist["median"] > 3:
        reasons.append(f"median width {dist['median']:.1f} > 3 words (criterion §1: median ≤ 3)")
    if dist["p80"] > 5:
        reasons.append(f"p80 width {dist['p80']:.1f} > 5 words (criterion §1: p80 ≤ 5)")
    return len(reasons) == 0, reasons


def preserve_spot_check(docx_path: Path, phrases: list[str]) -> tuple[bool, list[str]]:
    """Confirm each preserve phrase appears verbatim in the output's text body."""
    if not phrases:
        return True, []
    with zipfile.ZipFile(docx_path) as z:
        with z.open("word/document.xml") as f:
            xml = f.read().decode("utf-8")
    plain = re.sub(r"<[^>]+>", "", xml)
    plain = re.sub(r"\s+", " ", plain).strip()
    missing = [p for p in phrases if p not in plain]
    return len(missing) == 0, missing


def author_check(elements: list[TrackElement], expected: str | None) -> tuple[bool, str | None]:
    if not expected:
        return True, None
    authors = {e.author for e in elements if e.author}
    if not authors:
        return False, "no w:author on any tracked element"
    if authors != {expected}:
        return False, f"expected author={expected!r}, found {sorted(authors)!r}"
    return True, None


def report(docx_path: Path, dist: dict, elements: list[TrackElement]) -> None:
    print(f"\n== Width distribution: {docx_path.name} ==")
    print(f"  total tracked elements: {dist['count']}")
    if dist["count"] == 0:
        return
    print(f"  median wrap:            {dist['median']:.1f} words")
    print(f"  p80 wrap:               {dist['p80']:.1f} words")
    print(f"  p95 wrap:               {dist['p95']:.1f} words")
    print(f"  max wrap:               {dist['max']} words")
    print(f"  buckets:                1-2: {dist['buckets']['1-2']}   3-5: {dist['buckets']['3-5']}"
          f"   6-10: {dist['buckets']['6-10']}   11+: {dist['buckets']['11+']}")
    if dist["buckets"]["11+"] > 0:
        print("\n  Elements wrapping 11+ words (review for genuine wholesale-rewrite vs. lawyer-shape failure):")
        for i, e in enumerate(sorted(elements, key=lambda x: -x.word_count)):
            if e.word_count < 11:
                break
            preview = e.text[:120] + ("…" if len(e.text) > 120 else "")
            print(f"    [{i}] <w:{e.kind}> {e.word_count} words: {preview!r}")


def cmd_inspect(args: argparse.Namespace) -> int:
    path = Path(args.docx).resolve()
    elements = extract_track_elements(path)
    dist = width_distribution(elements)
    report(path, dist, elements)

    passed, reasons = grade_distribution(dist)

    preserve_ok, missing = preserve_spot_check(path, args.preserve or [])
    if args.preserve:
        print(f"\n== Preserve spot-check ({len(args.preserve)} phrases) ==")
        for p in args.preserve:
            mark = "✓" if p not in missing else "✗"
            print(f"  {mark} {p!r}")

    author_ok, author_reason = author_check(elements, args.author)
    if args.author:
        print(f"\n== Author check ==")
        if author_ok:
            print(f"  ✓ all tracked elements authored by {args.author!r}")
        else:
            print(f"  ✗ {author_reason}")

    overall = passed and preserve_ok and author_ok
    print("\n" + ("PASS" if overall else "FAIL") + " — lawyer-shape criteria")
    if reasons:
        for r in reasons:
            print(f"  - {r}")
    if missing:
        print(f"  - preserve drops: {missing}")
    if not author_ok and author_reason:
        print(f"  - {author_reason}")
    return 0 if overall else 1


def cmd_compare(args: argparse.Namespace) -> int:
    base = Path(args.baseline).resolve()
    patched = Path(args.patched).resolve()
    base_dist = width_distribution(extract_track_elements(base))
    patched_dist = width_distribution(extract_track_elements(patched))

    print(f"\n== Baseline:  {base.name} ==")
    print(f"  count={base_dist.get('count',0)}  median={base_dist.get('median',0):.1f}  "
          f"p80={base_dist.get('p80',0):.1f}  max={base_dist.get('max',0)}  "
          f"buckets={base_dist.get('buckets',{})}")
    print(f"\n== Patched:   {patched.name} ==")
    print(f"  count={patched_dist.get('count',0)}  median={patched_dist.get('median',0):.1f}  "
          f"p80={patched_dist.get('p80',0):.1f}  max={patched_dist.get('max',0)}  "
          f"buckets={patched_dist.get('buckets',{})}")

    if base_dist.get("count") and patched_dist.get("count"):
        delta_median = patched_dist["median"] - base_dist["median"]
        delta_max = patched_dist["max"] - base_dist["max"]
        print(f"\n  median:  Δ {delta_median:+.1f} words")
        print(f"  max:     Δ {delta_max:+d} words")

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_inspect = sub.add_parser("inspect", help="inspect a single .docx against criteria")
    p_inspect.add_argument("docx", help="path to .docx file")
    p_inspect.add_argument("--preserve", nargs="*", help="phrases that must appear verbatim in the output")
    p_inspect.add_argument("--author", help="expected w:author value on every tracked element")
    p_inspect.set_defaults(func=cmd_inspect)

    p_compare = sub.add_parser("compare", help="compare baseline vs patched .docx width distributions")
    p_compare.add_argument("baseline", help="pre-patch output .docx")
    p_compare.add_argument("patched", help="post-patch output .docx")
    p_compare.set_defaults(func=cmd_compare)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
