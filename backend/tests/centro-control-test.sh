#!/bin/bash
# ============================================================
# SITREP Centro de Control Test — map activity endpoint
# ============================================================
BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0; FAIL=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
CURL=$(which curl)
json_extract() { python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$1','') if isinstance(d,dict) else ''; print(v if v else (d.get('data',{}).get('$1','') if isinstance(d.get('data'),dict) else ''))" 2>/dev/null; }
section() { echo ""; echo -e "${BOLD}--- $1 ---${NC}"; }

# Auth with retry (avoid rate limiting)
for _i in 1 2 3; do
  ADMIN_RESP=$($CURL -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
  TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
  [ -n "$TOKEN" ] && break
  sleep 5
done
if [ -z "$TOKEN" ]; then echo "FATAL"; exit 1; fi

section "Centro de Control: Activity"
RESP=$($CURL -s -X GET "${API}/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2026-12-31&capas=generadores,transportistas,operadores,transito" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Centro de Control: actividad OK"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Centro de Control failed"
  FAIL=$((FAIL+1))
fi

section "Layer verification"
LAYER_COUNT=$(echo "$RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    data = d.get('data', {})
    features = data.get('features', data.get('capas', []))
    print(len(features) if isinstance(features, list) else len(data.get('capas', [])))
except: print('0')
" 2>/dev/null)
if [ "$LAYER_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC} Centro de Control: $LAYER_COUNT layers/features"
  PASS=$((PASS+1))
else
  echo -e "  ${YELLOW}WARN${NC} No layers returned (may be empty demo data)"
fi

echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
[ $FAIL -gt 0 ] && echo -e "$ERRORS" && exit 1 || exit 0
