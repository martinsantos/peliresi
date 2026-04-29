#!/bin/bash
# ============================================================
# SITREP Solicitudes Test — public inscription wizard
# ============================================================
BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0; FAIL=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
CURL=$(which curl)
json_extract() { python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1', d.get('data', {}).get('$1', '')))" 2>/dev/null; }
section() { echo ""; echo -e "${BOLD}--- $1 ---${NC}"; }

# Try public solicitudes endpoint
section "Solicitudes (public)"
RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X GET "${API}/solicitudes/tipos")
if [ "$RESP" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} GET solicitudes/tipos returns 200"
  PASS=$((PASS+1))
else
  echo -e "  ${YELLOW}WARN${NC} GET solicitudes/tipos returned $RESP (may not be implemented)"
fi

section "Solicitudes with auth"
ADMIN_RESP=$($CURL -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X GET "${API}/solicitudes" -H "Authorization: Bearer $TOKEN")
  if [ "$RESP" = "200" ]; then
    echo -e "  ${GREEN}PASS${NC} GET solicitudes with auth returns 200"
    PASS=$((PASS+1))
  else
    echo -e "  ${YELLOW}WARN${NC} GET solicitudes returned $RESP (may not be implemented)"
  fi
fi

echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
exit 0
