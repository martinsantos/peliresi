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
  "frontend/src-v6/components/mobile/AndroidPermissionGuide.tsx"
  "frontend/src-v6/components/mobile/GpsStatusPanel.tsx"
  "frontend/src-v6/components/mobile/TripActionBar.tsx"
  "frontend/src-v6/components/mobile/MobileRoleHero.tsx"
  "frontend/src-v6/components/mobile/TransportistaTripQueue.tsx"
  "frontend/src-v6/components/mobile/OperatorActionQueue.tsx"
  "frontend/e2e/android-ux.spec.ts"
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
require_marker frontend/src-v6/components/mobile/GpsStatusPanel.tsx "GpsStatusPanel"
require_marker frontend/src-v6/components/mobile/TripActionBar.tsx "TripActionBar"
require_marker frontend/e2e/android-ux.spec.ts "Android UX field-grade PWA checks"

echo "Android UX readiness static artifacts present"
