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

json_assetlinks_check() {
  local body
  body="$(curl -L -fsS --max-time 10 "$TARGET_URL/.well-known/assetlinks.json" 2>/dev/null || true)"
  if ASSETLINKS_BODY="$body" python3 - <<'PY' >/dev/null 2>&1; then
import json
import os

links = json.loads(os.environ["ASSETLINKS_BODY"])
expected = {
    "ar.com.ultimamilla.sitrep": "14:30:25:00:EF:38:5B:21:7B:03:EF:D8:21:18:BB:B4:5C:68:DE:11:93:0F:C8:03:CC:50:0F:02:0E:08:E1:D7",
    "ar.gob.mendoza.rptrazar": "81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE",
}

found = set()
for item in links:
    target = item.get("target", {})
    package = target.get("package_name")
    if (
        target.get("namespace") == "android_app"
        and package in expected
        and expected[package] in target.get("sha256_cert_fingerprints", [])
        and "delegate_permission/common.handle_all_urls" in item.get("relation", [])
    ):
        found.add(package)

missing = set(expected) - found
if missing:
    raise SystemExit(f"missing assetlinks packages: {', '.join(sorted(missing))}")
PY
    pass "android assetlinks maps legacy and RP Trazar packages/fingerprints"
  else
    fail "android assetlinks maps legacy and RP Trazar packages/fingerprints"
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
status_is_200 "/.well-known/assetlinks.json" "android assetlinks loads"
json_manifest_check "/manifest.json" "web manifest is valid JSON with icons"
json_manifest_check "/manifest-app.json" "app manifest is valid JSON with icons"
json_assetlinks_check
body_contains "/" "<title|id=\"root\"|SITREP" "landing page has app shell markers"
body_contains "/manual/" "SITREP|Manual|manual" "manual has expected content"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
