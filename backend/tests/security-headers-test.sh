#!/usr/bin/env bash
# ============================================================
# SITREP — Security Headers Test
# Validates that all API responses include required security
# headers: HSTS, X-Frame-Options, X-Content-Type-Options, CSP
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

echo -e "${YELLOW}═══ Security Headers Test ═══${NC}"
echo "Target: $API"
echo ""

ENDPOINTS=(
  "$API/health"
  "$API/health/live"
  "$API/health/ready"
  "$API/auth/login"
  "$API/auth/register"
  "$API/manifiestos"
  "$API/catalogos/residuos"
)

HEADERS=(
  "strict-transport-security"
  "x-content-type-options"
  "x-frame-options"
  "content-security-policy"
  "referrer-policy"
)

for endpoint in "${ENDPOINTS[@]}"; do
  RESP_HEADERS=$(curl -sI -X GET "$endpoint" --max-time 10 2>/dev/null)
  echo "--- $endpoint ---"

  for header in "${HEADERS[@]}"; do
    # Check header (case-insensitive via grep -i)
    if echo "$RESP_HEADERS" | grep -qi "$header"; then
      echo -e "  ${GREEN}PASS${NC} $header present"
      PASS=$((PASS+1))
    else
      echo -e "  ${RED}FAIL${NC} $header MISSING"
      FAIL=$((FAIL+1))
    fi
  done
  echo ""
done

# ── Summary ──
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL PASSED${NC}"
else
  echo -e "  ${RED}SOME FAILED${NC}"
fi
exit "$FAIL"
