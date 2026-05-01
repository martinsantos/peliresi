#!/usr/bin/env bash
# Non-destructive frontend/PWA/manual surface checks.

set -uo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://sitrep.ultimamilla.com.ar}}"
TARGET_URL="${TARGET_URL%/}"
FAIL=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }

status_is_200() {
  local path="$1" label="$2"
  local code
  code="$(curl -L -sS --max-time 10 -o /dev/null -w '%{http_code}' "$TARGET_URL$path" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then
    pass "$label"
  else
    fail "$label (HTTP $code)"
  fi
}

body_contains() {
  local path="$1" pattern="$2" label="$3"
  local body
  body="$(curl -L -fsS --max-time 10 "$TARGET_URL$path" 2>/dev/null || true)"
  if BODY="$body" PATTERN="$pattern" python3 - <<'PY' >/dev/null 2>&1; then
import os
import re
body = os.environ.get("BODY", "")
pattern = os.environ.get("PATTERN", "")
if not re.search(pattern, body, re.I):
    raise SystemExit(1)
PY
    pass "$label"
  else
    fail "$label"
  fi
}

json_manifest_check() {
  local path="$1" label="$2"
  local body
  body="$(curl -L -fsS --max-time 10 "$TARGET_URL$path" 2>/dev/null || true)"
  if printf "%s" "$body" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('name') or d.get('short_name'); assert d.get('icons')" >/dev/null 2>&1; then
    pass "$label"
  else
    fail "$label"
  fi
}

echo "SITREP frontend surface checks"
echo "Target: $TARGET_URL"

status_is_200 "/" "landing page loads"
status_is_200 "/app/" "PWA app route loads"
status_is_200 "/manual/" "manual loads"
status_is_200 "/setup.html" "setup page loads"
status_is_200 "/offline.html" "offline page loads"
status_is_200 "/sw.js" "service worker loads"
status_is_200 "/sw-app.js" "app service worker loads"
json_manifest_check "/manifest.json" "web manifest is valid JSON with icons"
json_manifest_check "/manifest-app.json" "app manifest is valid JSON with icons"
body_contains "/" "<title|id=\"root\"|SITREP" "landing page has app shell markers"
body_contains "/manual/" "SITREP|Manual|manual" "manual has expected content"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
