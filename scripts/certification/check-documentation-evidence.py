#!/usr/bin/env python3
"""Validate certification requirement-to-test evidence matrix."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MATRIX = Path(os.getenv("CERT_REQUIREMENTS_MATRIX", "docs/certification/requirements-matrix.json"))
if not MATRIX.is_absolute():
    MATRIX = ROOT / MATRIX

REQUIRED_KEYS = {"id", "title", "test", "command"}


def main() -> int:
    print("SITREP documentation evidence checks")
    print(f"Matrix: {MATRIX}")

    if not MATRIX.exists():
        print("FAIL requirements matrix exists")
        return 1

    data = json.loads(MATRIX.read_text(encoding="utf-8"))
    reqs = data.get("requirements")
    if not isinstance(reqs, list) or not reqs:
        print("FAIL requirements list is present")
        return 1

    seen: set[str] = set()
    failures = 0
    for req in reqs:
        missing = REQUIRED_KEYS - set(req)
        req_id = req.get("id", "<missing>")
        if missing:
            print(f"FAIL {req_id} missing keys: {', '.join(sorted(missing))}")
            failures += 1
            continue
        if req_id in seen:
            print(f"FAIL duplicate requirement id {req_id}")
            failures += 1
        else:
            seen.add(req_id)
            print(f"PASS {req_id} maps to {req['test']}")

    if failures:
        print(f"RESULT: FAIL ({failures})")
        return 1

    print("RESULT: PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
