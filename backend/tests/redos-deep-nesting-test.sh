#!/bin/bash
# ReDoS / Deep Nesting Resilience Test — SITREP
# Tests that the server gracefully handles malicious payloads without 500 errors
# or timeouts: deep nesting, large arrays, regex bombs, oversize strings, null bytes.
# Uso: bash backend/tests/redos-deep-nesting-test.sh [BASE_URL]
set -uo pipefail

_INPUT="${1:-https://sitrep.ultimamilla.com.ar}"
BASE="${_INPUT%/}"
[[ "$BASE" != */api ]] && BASE="$BASE/api"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   SITREP — ReDoS / Deep Nesting Resilience Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert_no_crash() {
  local desc="$1" http_code="$2" expected="$3"
  if [ "$http_code" = "000" ] || [ -z "$http_code" ]; then
    echo -e "  ${RED}FAIL${NC} [timeout/no response] $desc — servidor no respondió en 15s"; ((FAIL++))
  elif [ "$http_code" = "500" ]; then
    echo -e "  ${RED}FAIL${NC} [$http_code] $desc — 500 INTERNAL SERVER ERROR"; ((FAIL++))
  elif [ "$http_code" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} [$http_code] $desc"; ((PASS++))
  else
    echo -e "  ${YELLOW}WARN${NC} [$http_code] $desc (expected ~$expected, but graceful)"; ((PASS++))
  fi
}

TOKEN_ADMIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN_ADMIN" ]; then
  echo -e "${RED}ERROR: Cannot authenticate. Aborting.${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}[1] Deep nesting: 1000 levels in login POST${NC}"
DEEP=$(python3 -c "
import json
d = {}
for i in range(1000):
    d = {'a': d}
print(json.dumps(d))
" 2>/dev/null)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "$DEEP" 2>/dev/null)
assert_no_crash "1000-level nested JSON" "$HTTP" "400"

echo ""
echo -e "${CYAN}[2] Large array: 10000 items in login POST${NC}"
LARGE=$(python3 -c "import json; print(json.dumps([{} for _ in range(10000)]))" 2>/dev/null)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LARGE" 2>/dev/null)
assert_no_crash "10000-item array" "$HTTP" "400"

echo ""
echo -e "${CYAN}[3] Regex bomb: long string with newline in search query${NC}"
# Catastrophic backtracking pattern "(a+)+!" match against "aaaa...!"
REGEX_BOMB=$(python3 -c "print('a' * 9999 + '!\n')")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X GET "$BASE/search?q=$(python3 -c "import urllib.parse; print(urllib.parse.quote('a'*9999 + '!'))")" \
  -H "Authorization: Bearer $TOKEN_ADMIN" 2>/dev/null)
assert_no_crash "Regex bomb en search query" "$HTTP" "200"

echo ""
echo -e "${CYAN}[4] Oversized unicode (50000 emojis) in register${NC}"
# Use forgot-password instead (no auth needed, just email field)
LONG_EMAIL=$(python3 -c "print('a'*50000 + '@b.com')")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$LONG_EMAIL\"}" 2>/dev/null)
assert_no_crash "50000-char email" "$HTTP" "400"

echo ""
echo -e "${CYAN}[5] Null byte in JSON body${NC}"
# Send raw JSON with null byte
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d $'{"email":"test\\u0000@test.com","password":"test"}' 2>/dev/null)
assert_no_crash "Null byte in email field" "$HTTP" "400"

echo ""
echo -e "${CYAN}[6] Extremely long Authorization header${NC}"
LONG_TOKEN=$(python3 -c "print('A'*10000)")
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X GET "$BASE/manifiestos?limit=1" \
  -H "Authorization: Bearer $LONG_TOKEN" 2>/dev/null)
assert_no_crash "10000-char Authorization header" "$HTTP" "401"

echo ""
echo -e "${CYAN}[7] JSON with $ref pattern (circular reference mimic)${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"user":{"$ref":"#"},"data":{"$ref":"/user"}}' 2>/dev/null)
assert_no_crash "\$ref pattern in JSON" "$HTTP" "400"

echo ""
echo -e "${CYAN}[8] Binary data as JSON body${NC}"
# Send raw binary bytes
BINARY_DATA=$(python3 -c "
import sys
sys.stdout.buffer.write(b'\x00\x01\x02\xff\xfe' * 200)
" 2>/dev/null)
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  --data-binary @- <<< "$(python3 -c "import sys; sys.stdout.buffer.write(b'\x00\x01\x02\xff\xfe'*200)")" 2>/dev/null)
assert_no_crash "Binary data as JSON" "$HTTP" "400"

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"

exit $((FAIL > 0 ? 1 : 0))
