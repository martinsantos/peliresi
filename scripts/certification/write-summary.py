#!/usr/bin/env python3
"""Generate Markdown and JSON evidence for SITREP certification runs."""

from __future__ import annotations

import csv
import json
import sys
from collections import Counter
from pathlib import Path


def main() -> int:
    if len(sys.argv) != 10:
        print(
            "usage: write-summary.py results.tsv summary.md summary.json "
            "profile target_url api_url branch commit generated_at",
            file=sys.stderr,
        )
        return 2

    results_tsv = Path(sys.argv[1])
    summary_md = Path(sys.argv[2])
    summary_json = Path(sys.argv[3])
    profile, target_url, api_url, branch, commit, generated_at = sys.argv[4:]

    with results_tsv.open(newline="", encoding="utf-8") as fh:
        rows = list(csv.DictReader(fh, delimiter="\t"))

    counts = Counter(row["status"] for row in rows)
    blocking_failures = [
        row
        for row in rows
        if row["status"] == "FAIL" and row["severity"] in {"BLOCKER", "HIGH"}
    ]
    warnings = [row for row in rows if row["status"] == "WARN"]
    skipped = [row for row in rows if row["status"] == "SKIP"]

    payload = {
        "profile": profile,
        "target_url": target_url,
        "api_url": api_url,
        "branch": branch,
        "commit": commit,
        "generated_at": generated_at,
        "status": "FAIL" if blocking_failures else "PASS",
        "counts": {
            "pass": counts.get("PASS", 0),
            "warn": counts.get("WARN", 0),
            "skip": counts.get("SKIP", 0),
            "fail": counts.get("FAIL", 0),
        },
        "blocking_failures": blocking_failures,
        "warnings": warnings,
        "skipped": skipped,
        "results": rows,
    }

    summary_json.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    lines = [
        "# SITREP Certification Test Report",
        "",
        f"- Profile: `{profile}`",
        f"- Target: `{target_url}`",
        f"- API: `{api_url}`",
        f"- Branch: `{branch}`",
        f"- Commit: `{commit}`",
        f"- Generated at: `{generated_at}`",
        f"- Result: **{payload['status']}**",
        "",
        "## Summary",
        "",
        "| Status | Count |",
        "|--------|-------|",
        f"| PASS | {counts.get('PASS', 0)} |",
        f"| WARN | {counts.get('WARN', 0)} |",
        f"| SKIP | {counts.get('SKIP', 0)} |",
        f"| FAIL | {counts.get('FAIL', 0)} |",
        "",
    ]

    if blocking_failures:
        lines.extend(
            [
                "## Blocking Failures",
                "",
                "| Suite | Test | Severity | Log |",
                "|-------|------|----------|-----|",
            ]
        )
        for row in blocking_failures:
            lines.append(
                f"| {row['suite']} | {row['name']} | {row['severity']} | `{row['log']}` |"
            )
        lines.append("")

    if warnings:
        lines.extend(
            [
                "## Warnings",
                "",
                "| Suite | Test | Severity | Log |",
                "|-------|------|----------|-----|",
            ]
        )
        for row in warnings:
            lines.append(
                f"| {row['suite']} | {row['name']} | {row['severity']} | `{row['log']}` |"
            )
        lines.append("")

    if skipped:
        lines.extend(
            [
                "## Skipped",
                "",
                "| Suite | Test | Reason |",
                "|-------|------|--------|",
            ]
        )
        for row in skipped:
            lines.append(f"| {row['suite']} | {row['name']} | `{row['command']}` |")
        lines.append("")

    lines.extend(
        [
            "## Full Results",
            "",
            "| Suite | Test | Severity | Status | Duration |",
            "|-------|------|----------|--------|----------|",
        ]
    )
    for row in rows:
        lines.append(
            f"| {row['suite']} | {row['name']} | {row['severity']} | "
            f"{row['status']} | {row['duration_s']}s |"
        )

    summary_md.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
