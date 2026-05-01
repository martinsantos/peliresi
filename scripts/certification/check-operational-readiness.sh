#!/usr/bin/env bash
# Non-destructive operational readiness checks.

set -uo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://sitrep.ultimamilla.com.ar}}"
TARGET_URL="${TARGET_URL%/}"
FAIL=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }
warn() { echo "WARN $1"; }

json_check() {
  local url="$1" expression="$2" label="$3"
  local body
  body="$(curl -fsS --max-time 10 "$url" 2>/dev/null)"
  if printf "%s" "$body" | python3 -c "$expression" >/dev/null 2>&1; then
    pass "$label"
  else
    echo "$body"
    fail "$label"
  fi
}

echo "SITREP operational readiness checks"
echo "Target: $TARGET_URL"

json_check "$TARGET_URL/api/health" \
  "import json,sys; d=json.load(sys.stdin); assert d.get('status') == 'ok' and d.get('db') == 'connected'" \
  "health reports ok and db connected"

json_check "$TARGET_URL/api/health/live" \
  "import json,sys; d=json.load(sys.stdin); assert d.get('status') == 'alive' and d.get('uptime', 0) >= 0" \
  "liveness reports alive"

json_check "$TARGET_URL/api/health/ready" \
  "import json,sys; d=json.load(sys.stdin); assert d.get('status') == 'ready' and d.get('checks', {}).get('db') is True" \
  "readiness reports ready and db true"

HEADERS="$(curl -fsSI --max-time 10 "$TARGET_URL/api/health" 2>/dev/null || true)"
if printf "%s" "$HEADERS" | grep -Eiq '^x-content-type-options:'; then
  pass "security header x-content-type-options present"
else
  fail "security header x-content-type-options present"
fi

if printf "%s" "$HEADERS" | grep -Eiq '^ratelimit-|^x-ratelimit-'; then
  pass "rate limit headers present"
else
  fail "rate limit headers present"
fi

if [ -n "${SSH_HOST:-}" ]; then
  if ssh "$SSH_HOST" "pm2 list | grep -q sitrep-backend" >/dev/null 2>&1; then
    pass "remote PM2 has sitrep-backend"
  else
    fail "remote PM2 has sitrep-backend"
  fi

  if ssh "$SSH_HOST" "systemctl is-active nginx" >/dev/null 2>&1; then
    pass "remote nginx is active"
  else
    fail "remote nginx is active"
  fi
else
  warn "SSH_HOST not set; skipping remote PM2/nginx checks"
fi

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
