#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
NGINX_CONF="$ROOT_DIR/nginx_sitrep.conf"

if [[ ! -f "$NGINX_CONF" ]]; then
  echo "FAIL: nginx_sitrep.conf not found" >&2
  exit 1
fi

asset_location_line="$(grep -nE '^[[:space:]]*location[[:space:]]+(\^~[[:space:]]+)?/app/assets/' "$NGINX_CONF" | head -1 | cut -d: -f1 || true)"
app_location_line="$(grep -nE '^[[:space:]]*location[[:space:]]+/app/' "$NGINX_CONF" | head -1 | cut -d: -f1 || true)"

if [[ -z "$asset_location_line" ]]; then
  echo "FAIL: /app/assets/ must have its own top-level nginx location" >&2
  exit 1
fi

if [[ -z "$app_location_line" ]]; then
  echo "FAIL: /app/ location not found" >&2
  exit 1
fi

if (( asset_location_line >= app_location_line )); then
  echo "FAIL: /app/assets/ location must appear before /app/ SPA fallback" >&2
  exit 1
fi

asset_block="$(awk -v start="$asset_location_line" '
  NR >= start {
    print
    if (NR > start && /^[[:space:]]*}/) exit
  }
' "$NGINX_CONF")"

if ! grep -Eq 'try_files[[:space:]]+\$uri[[:space:]]+=404;' <<<"$asset_block"; then
  echo "FAIL: /app/assets/ must use try_files \$uri =404; to avoid serving app HTML as JS/CSS" >&2
  exit 1
fi

if grep -Eq '/app/index\.html|/index\.html' <<<"$asset_block"; then
  echo "FAIL: /app/assets/ must not fall back to an HTML shell" >&2
  exit 1
fi

echo "PASS: /app/assets/ has a non-HTML nginx fallback"
