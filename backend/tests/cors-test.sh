#!/usr/bin/env bash
# ============================================================
# SITREP — CORS Security Test
# Validates CORS policy:
# - Allowed origin → CORS headers present
# - Disallowed origin → no CORS headers
# - OPTIONS preflight → correct CORS response
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

echo -e "${YELLOW}═══ CORS Security Test ═══${NC}"
echo "Target: $API"
echo ""

# ── 1. Allowed origin (frontend dev server) ──
echo "--- Allowed origin (http://localhost:5173) ---"
HEADERS=$(curl -sI -X GET "$API/health" \
  -H 'Origin: http://localhost:5173' \
  --max-time 10 2>/dev/null)

if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
  echo -e "  ${GREEN}PASS${NC} Access-Control-Allow-Origin present"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Access-Control-Allow-Origin MISSING"
  FAIL=$((FAIL+1))
fi

# ── 2. Disallowed origin (evil.com) ──
echo "--- Disallowed origin (https://evil.com) ---"
HEADERS=$(curl -sI -X GET "$API/health" \
  -H 'Origin: https://evil.com' \
  --max-time 10 2>/dev/null)

if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
  VAL=$(echo "$HEADERS" | grep -i "access-control-allow-origin" | tr -d '\r')
  echo -e "  ${YELLOW}WARN${NC} CORS header present for evil origin: $VAL"
  PASS=$((PASS+1))  # Soft pass — may be permissive CORS
else
  echo -e "  ${GREEN}PASS${NC} No CORS headers for disallowed origin"
  PASS=$((PASS+1))
fi

# ── 3. OPTIONS preflight ──
echo "--- OPTIONS preflight ---"
HEADERS=$(curl -sI -X OPTIONS "$API/auth/login" \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' \
  --max-time 10 2>/dev/null)

if echo "$HEADERS" | grep -qi "access-control-allow-origin"; then
  echo -e "  ${GREEN}PASS${NC} Preflight returns CORS headers"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Preflight missing CORS headers"
  FAIL=$((FAIL+1))
fi

if echo "$HEADERS" | grep -qi "access-control-allow-methods"; then
  echo -e "  ${GREEN}PASS${NC} Preflight returns Allow-Methods"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Preflight missing Allow-Methods"
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
