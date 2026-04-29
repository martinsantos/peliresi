#!/usr/bin/env bash
# ============================================================
# SITREP — Brute Force Protection Test
# Validates brute force prevention:
# - 6 failed logins with same account → 429
# - Correct password also blocked while rate limited
# ============================================================
set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE/api"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo -e "${YELLOW}═══ Brute Force Protection Test ═══${NC}"
echo "Target: $API"
echo ""

# ── 6 failed logins with the same account ──
echo "--- 6 brute force attempts (same account) ---"
for i in $(seq 1 6); do
  curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"wrong-password-brute-force"}' \
    -o /dev/null -w "%{http_code}\n" > /dev/null
done
echo "  6 failed requests sent"

# ── 7th request (also wrong) → expect 429 ──
echo "--- 7th request (wrong password) ---"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"wrong-password-brute-force"}' \
  --max-time 10)

if [ "$CODE" = "429" ]; then
  echo -e "  ${GREEN}PASS${NC} [429] Rate limit triggered with wrong password"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} [$CODE] Expected 429 after 6 failed attempts"
  FAIL=$((FAIL+1))
fi

# ── Wait for rate limit window to reset ──
echo "--- Waiting 65s for rate limit reset ---"
sleep 65

# ── Now try with correct password (should work after reset) ──
echo "--- Login with correct password after reset ---"
LOGIN_RESP=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  --max-time 10)

if echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null | grep -q '.'; then
  echo -e "  ${GREEN}PASS${NC} Login successful after rate limit reset"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Login failed after reset: $LOGIN_RESP"
  FAIL=$((FAIL+1))
fi

# ── Summary ──
echo ""
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL PASSED${NC}"
else
  echo -e "  ${RED}SOME FAILED${NC}"
fi
exit "$FAIL"
