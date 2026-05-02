#!/usr/bin/env bash
# Non-destructive authenticated security checks.

set -uo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://sitrep.ultimamilla.com.ar}}"
TARGET_URL="${TARGET_URL%/}"
API="$TARGET_URL/api"
FAIL=0

ADMIN_EMAIL="${CERT_ADMIN_EMAIL:-admin@dgfa.mendoza.gov.ar}"
ADMIN_PASSWORD="${CERT_ADMIN_PASSWORD:-admin123}"

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }

json_field() {
  python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  cur=d
  for p in '$1'.split('.'):
    cur=cur[p]
  print(cur)
except Exception:
  print('')
" 2>/dev/null
}

http_status() {
  local method="$1" path="$2" token="${3:-}" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$API$path" \
      -H 'Content-Type: application/json' \
      ${token:+-H "Authorization: Bearer $token"} \
      -d "$body"
  else
    curl -sS -o /dev/null -w '%{http_code}' -X "$method" "$API$path" \
      ${token:+-H "Authorization: Bearer $token"}
  fi
}

expect_status() {
  local expected="$1" method="$2" path="$3" token="${4:-}" label="$5" body="${6:-}"
  local code
  code="$(http_status "$method" "$path" "$token" "$body")"
  if [ "$code" = "$expected" ]; then
    pass "$label"
  else
    fail "$label expected $expected got $code"
  fi
}

echo "SITREP authenticated security checks"
echo "Target: $TARGET_URL"

LOGIN_RESP="$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
TOKEN="$(printf "%s" "$LOGIN_RESP" | json_field data.tokens.accessToken)"
if [ -n "$TOKEN" ]; then
  pass "admin login returns token"
else
  fail "admin login returns token"
fi

expect_status 401 GET "/manifiestos" "" "manifiestos rejects missing token"
expect_status 401 GET "/manifiestos" "invalid.token.value" "manifiestos rejects invalid token"
expect_status 401 GET "/admin/usuarios" "" "admin users rejects missing token"
expect_status 401 POST "/auth/login" "" "login rejects wrong password" '{"email":"admin@dgfa.mendoza.gov.ar","password":"wrong-password"}'

if [ -n "$TOKEN" ]; then
  expect_status 200 GET "/auth/profile" "$TOKEN" "profile accepts valid token"
  expect_status 200 GET "/admin/usuarios" "$TOKEN" "admin can access users"
  expect_status 404 GET "/manifiestos/nonexistent-id-for-security-check" "$TOKEN" "nonexistent manifiesto returns 404 not data leak"
fi

if bash "$(dirname "$0")/../../backend/tests/role-enforcement-test.sh" "$TARGET_URL" >/tmp/sitrep-role-enforcement-cert.log 2>&1; then
  pass "role enforcement matrix passes"
else
  cat /tmp/sitrep-role-enforcement-cert.log
  fail "role enforcement matrix passes"
fi

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
