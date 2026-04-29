#!/usr/bin/env bash
# ============================================================
# SITREP — Rate Limit Security Test
# Validates rate limiting on auth endpoints:
# - 6+1 requests to login → 429 on 7th
# - 4 requests to forgot-password → 429 on 4th
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

echo -e "${YELLOW}═══ Rate Limit Security Test ═══${NC}"
echo "Target: $API"
echo ""

# ── Login rate limit: 6 requests → 7th should be 429 ──
echo "--- Login rate limit (6+1) ---"
for i in $(seq 1 6); do
  curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"rate@test.com","password":"wrong"}' \
    -o /dev/null -w "%{http_code}\n" > /dev/null
done

CODE=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"rate@test.com","password":"wrong"}' \
  -o /dev/null -w "%{http_code}" --max-time 10)

if [ "$CODE" = "429" ]; then
  echo -e "  ${GREEN}PASS${NC} [429] Login rate limit enforced"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} [$CODE] Expected 429 after 6 login attempts"
  FAIL=$((FAIL+1))
fi

# ── Forgot-password rate limit: 3 requests → 4th should be 429 ──
echo "--- Forgot-password rate limit (3+1) ---"
for i in $(seq 1 3); do
  curl -s -X POST "$API/auth/forgot-password" \
    -H 'Content-Type: application/json' \
    -d '{"email":"test@example.com"}' \
    -o /dev/null -w "%{http_code}\n" > /dev/null
done

CODE=$(curl -s -X POST "$API/auth/forgot-password" \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}' \
  -o /dev/null -w "%{http_code}" --max-time 10)

if [ "$CODE" = "429" ]; then
  echo -e "  ${GREEN}PASS${NC} [429] Forgot-password rate limit enforced"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} [$CODE] Expected 429 after 3 forgot-password attempts"
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
