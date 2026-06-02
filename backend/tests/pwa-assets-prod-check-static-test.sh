#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CHECK_SCRIPT="$ROOT_DIR/scripts/ops/check-pwa-assets.sh"
DEPLOY_SCRIPT="$ROOT_DIR/scripts/cicd/deploy_sitrep_frontend_with_build.sh"

if [[ ! -x "$CHECK_SCRIPT" ]]; then
  echo "FAIL: scripts/ops/check-pwa-assets.sh must exist and be executable" >&2
  exit 1
fi

required_patterns=(
  'TARGET_URL'
  '/app/'
  'app.html'
  'assets/'
  'application/javascript'
  'text/css'
  '= 404'
  'missing'
)

for pattern in "${required_patterns[@]}"; do
  if ! grep -Fq "$pattern" "$CHECK_SCRIPT"; then
    echo "FAIL: check-pwa-assets.sh must validate pattern: $pattern" >&2
    exit 1
  fi
done

if ! grep -Eq 'curl.+-w.+http_code|curl.+--write-out' "$CHECK_SCRIPT"; then
  echo "FAIL: check-pwa-assets.sh must inspect HTTP status codes" >&2
  exit 1
fi

if ! grep -Eq 'Content-Type|content_type|content-type' "$CHECK_SCRIPT"; then
  echo "FAIL: check-pwa-assets.sh must inspect asset content type" >&2
  exit 1
fi

if [[ ! -f "$DEPLOY_SCRIPT" ]]; then
  echo "FAIL: frontend deploy script not found" >&2
  exit 1
fi

if ! grep -Fq 'check-pwa-assets.sh' "$DEPLOY_SCRIPT"; then
  echo "FAIL: frontend deploy must run check-pwa-assets.sh before accepting a release" >&2
  exit 1
fi

echo "PASS: production PWA asset smoke check is present"
