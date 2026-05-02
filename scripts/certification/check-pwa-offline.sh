#!/usr/bin/env bash
# Non-destructive PWA/offline capability checks.

set -uo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://sitrep.ultimamilla.com.ar}}"
TARGET_URL="${TARGET_URL%/}"
FAIL=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }

fetch() {
  curl -L -fsS --max-time 10 "$TARGET_URL$1" 2>/dev/null || true
}

status_is_200() {
  local path="$1" label="$2" code
  code="$(curl -L -sS --max-time 10 -o /dev/null -w '%{http_code}' "$TARGET_URL$path" 2>/dev/null || true)"
  if [ "$code" = "200" ]; then pass "$label"; else fail "$label HTTP $code"; fi
}

body_matches() {
  local path="$1" pattern="$2" label="$3" body
  body="$(fetch "$path")"
  if BODY="$body" PATTERN="$pattern" python3 - <<'PY' >/dev/null 2>&1; then
import os,re
if not re.search(os.environ["PATTERN"], os.environ["BODY"], re.I | re.S):
    raise SystemExit(1)
PY
    pass "$label"
  else
    fail "$label"
  fi
}

manifest_check() {
  local path="$1" label="$2" body
  body="$(fetch "$path")"
  if BODY="$body" python3 - <<'PY' >/dev/null 2>&1; then
import json,sys
import os
d=json.loads(os.environ["BODY"])
assert d.get("name") or d.get("short_name")
assert d.get("icons")
assert d.get("start_url") is not None
assert d.get("display") in ("standalone", "fullscreen", "minimal-ui", "browser")
PY
    pass "$label"
  else
    fail "$label"
  fi
}

echo "SITREP PWA/offline checks"
echo "Target: $TARGET_URL"

status_is_200 "/app/" "PWA route loads"
status_is_200 "/offline.html" "offline fallback loads"
status_is_200 "/sw.js" "root service worker loads"
status_is_200 "/sw-app.js" "app service worker loads"
manifest_check "/manifest.json" "root manifest has required PWA fields"
manifest_check "/manifest-app.json" "app manifest has required PWA fields"
body_matches "/sw.js" "fetch|install|activate|cache" "root service worker handles lifecycle/fetch/cache"
body_matches "/sw-app.js" "fetch|install|activate|cache" "app service worker handles lifecycle/fetch/cache"
body_matches "/offline.html" "offline|sin conexi|conexion|SITREP" "offline fallback has user-facing offline content"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
