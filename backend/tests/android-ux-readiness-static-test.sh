#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

require_marker() {
  local file="$1"
  local marker="$2"
  if ! grep -Fq -- "$marker" "$file"; then
    echo "Missing marker '$marker' in $file" >&2
    exit 1
  fi
}

required_files=(
  "docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md"
  "docs/ANDROID_UX_READY_REPORT_2026-05-31.md"
  "docs/superpowers/specs/2026-05-31-android-ux-677-design.md"
  "docs/superpowers/plans/2026-05-31-android-ux-677-implementation.md"
)

for file in "${required_files[@]}"; do
  if [[ ! -s "$file" ]]; then
    echo "Missing required Android UX artifact: $file" >&2
    exit 1
  fi
done

require_marker docs/ANDROID_UX_GAP_MATRIX_2026-05-31.md "SITREP Android UX Gap Matrix"
require_marker docs/ANDROID_UX_READY_REPORT_2026-05-31.md "SITREP Android UX Ready Report"
require_marker docs/superpowers/specs/2026-05-31-android-ux-677-design.md "Android UX 677"

echo "Android UX readiness static artifacts present"
