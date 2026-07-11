#!/usr/bin/env python3
"""Strip lean-ctx contamination markers from source files.

lean-ctx may append footers to tool *output* (Cross-Source Hints, redirect
suffixes). Agents sometimes copy those into source, which breaks Vite/oxc/
PostCSS. This script removes trailing contamination blocks.

Usage:
  scripts/strip-lean-ctx-markers.py path [path ...]
  echo '{"file_path":"..."}' | scripts/strip-lean-ctx-markers.py --hook
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Trailing blocks only — never rewrite intentional mid-file content that
# happens to mention these strings in docs/comments without a marker line.
MARKER_RE = re.compile(
    r"\n(?:-{3,}\s*Cross-Source Hints\s*-{3,}|---\s*lean-ctx:[^\n]*---)\s*\n.*\Z",
    re.DOTALL,
)


def strip_text(text: str) -> str | None:
    """Return cleaned text, or None if unchanged."""
    cleaned = MARKER_RE.sub("\n", text)
    if cleaned == text:
        return None
    # Keep a single trailing newline when the file had content.
    if cleaned and not cleaned.endswith("\n"):
        cleaned += "\n"
    return cleaned


def strip_file(path: Path) -> bool:
    if not path.is_file():
        return False
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    cleaned = strip_text(text)
    if cleaned is None:
        return False
    path.write_text(cleaned, encoding="utf-8")
    return True


def main(argv: list[str]) -> int:
    if len(argv) >= 1 and argv[0] == "--hook":
        raw = sys.stdin.read()
        if not raw.strip():
            return 0
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError:
            return 0
        file_path = payload.get("file_path")
        if isinstance(file_path, str) and file_path:
            path = Path(file_path)
            if not path.is_absolute():
                roots = payload.get("workspace_roots") or []
                if roots and isinstance(roots[0], str):
                    path = Path(roots[0]) / file_path
            if strip_file(path):
                print(f"stripped lean-ctx markers: {path}", file=sys.stderr)
        return 0

    changed = 0
    for arg in argv:
        if strip_file(Path(arg)):
            print(f"stripped lean-ctx markers: {arg}")
            changed += 1
    return 0 if changed or argv else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
