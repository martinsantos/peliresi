#!/usr/bin/env python3
"""Static accessibility heuristics for certification evidence.

This is intentionally dependency-free. It catches common regressions and
produces evidence, but it does not replace a full axe/manual audit.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCAN_DIRS = [
    ROOT / "frontend" / "src-v6",
    ROOT / "frontend" / "public",
    ROOT / "docs" / "manual",
]

CHECKS = [
    (
        "images need alt or aria-hidden",
        re.compile(r"<img\b(?![^>]*(?:\balt=|\baria-hidden=))", re.I),
    ),
    (
        "icon-only buttons need aria-label/title",
        re.compile(r"<button\b(?![^>]*(?:\baria-label=|\btitle=))(?=[^>]*>\s*(?:<\w|{))", re.I | re.S),
    ),
    (
        "form inputs need label/id/aria-label",
        re.compile(r"<input\b(?![^>]*(?:\baria-label=|\bid=|\btype=\"hidden\"|\btype='hidden'))", re.I),
    ),
]


def iter_files() -> list[Path]:
    files: list[Path] = []
    for scan_dir in SCAN_DIRS:
        if not scan_dir.exists():
            continue
        for path in scan_dir.rglob("*"):
            if path.suffix.lower() in {".tsx", ".jsx", ".html"}:
                files.append(path)
    return files


def main() -> int:
    issues: list[str] = []
    files = iter_files()

    for path in files:
        text = path.read_text(encoding="utf-8", errors="ignore")
        rel = path.relative_to(ROOT)
        for label, pattern in CHECKS:
            for match in pattern.finditer(text):
                line = text.count("\n", 0, match.start()) + 1
                issues.append(f"{rel}:{line}: {label}")

    print("SITREP static accessibility checks")
    print(f"Files scanned: {len(files)}")

    if issues:
        print(f"Issues: {len(issues)}")
        for issue in issues[:80]:
            print(f"  {issue}")
        if len(issues) > 80:
            print(f"  ... {len(issues) - 80} more")
        return 1

    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
