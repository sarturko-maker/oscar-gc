#!/usr/bin/env python3
"""Extract a per-session transcript + tool-call timeline from goosed's
sessions.db, writing both JSON (raw) and a human-readable timeline markdown.

Usage:
  python3 extract-transcript.py <session_id> <out_dir>

Outputs:
  <out_dir>/transcript.json   — full message stream (one obj per message)
  <out_dir>/tool-timeline.md  — chronological tool-call timeline
"""
from __future__ import annotations

import json
import os
import sqlite3
import sys
from pathlib import Path
from typing import Any

DB = Path.home() / ".local/share/goose/sessions/sessions.db"


def extract(session_id: str, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB))
    cur = conn.cursor()
    cur.execute(
        "SELECT id, message_id, role, content_json, timestamp, tokens "
        "FROM messages WHERE session_id=? ORDER BY id",
        (session_id,),
    )
    rows = cur.fetchall()

    messages: list[dict[str, Any]] = []
    timeline_rows: list[str] = []
    timeline_rows.append("| # | t | role | tool | args (truncated) | result (truncated) |")
    timeline_rows.append("|---|---|------|------|------------------|--------------------|")
    pending_tool_calls: dict[str, dict[str, Any]] = {}  # call_id -> {tool, args, idx}
    idx = 0

    for db_id, msg_id, role, content_json, ts, tokens in rows:
        blocks = json.loads(content_json)
        messages.append({
            "db_id": db_id,
            "message_id": msg_id,
            "role": role,
            "timestamp": ts,
            "tokens": tokens,
            "blocks": blocks,
        })

        for b in blocks:
            t = b.get("type")
            if t == "toolRequest":
                v = b.get("toolCall", {}).get("value", {})
                cid = b.get("id", "")
                tool = v.get("name", "?")
                args = json.dumps(v.get("arguments", {}), ensure_ascii=False)
                short = args if len(args) <= 200 else args[:197] + "…"
                pending_tool_calls[cid] = {"idx": idx, "tool": tool, "args": short, "ts": ts}
                timeline_rows.append(
                    f"| {idx} | {ts} | {role} | `{tool}` | `{short.replace('|', '\\|')}` | _pending_ |"
                )
                idx += 1
            elif t == "toolResponse":
                cid = b.get("id", "")
                tr = b.get("toolResult", {})
                err = tr.get("error")
                value = tr.get("value")
                if err:
                    summary = f"ERROR: {err[:240]}"
                elif isinstance(value, list) and value:
                    first = value[0]
                    if isinstance(first, dict):
                        txt = first.get("text", "")
                        summary = txt[:240]
                    else:
                        summary = str(first)[:240]
                else:
                    summary = str(value)[:240] if value is not None else "_(empty)_"
                if cid in pending_tool_calls:
                    call = pending_tool_calls[cid]
                    # Replace the last column on the pending row
                    row = timeline_rows[call["idx"] + 2]  # +2 for the header rows
                    timeline_rows[call["idx"] + 2] = row.rsplit("|", 2)[0] + f"| `{summary.replace('|', '\\|')}` |"

    (out_dir / "transcript.json").write_text(json.dumps(messages, indent=2, ensure_ascii=False), "utf8")
    (out_dir / "tool-timeline.md").write_text("\n".join(timeline_rows) + "\n", "utf8")
    print(f"wrote {out_dir}/transcript.json ({len(messages)} messages)")
    print(f"wrote {out_dir}/tool-timeline.md ({idx} tool calls)")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("usage: extract-transcript.py <session_id> <out_dir>", file=sys.stderr)
        sys.exit(2)
    extract(sys.argv[1], Path(sys.argv[2]))
