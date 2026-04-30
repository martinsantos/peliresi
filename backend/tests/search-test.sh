#!/bin/bash
# ============================================================
# SITREP Search Test — global search endpoint
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
if [ -z "$TOKEN" ]; then echo "FATAL: No token"; exit 1; fi

section "Search by term"
RESP=$($CURL -s -X GET "${API}/search?q=hospital" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Search by 'hospital' returned results"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Search failed: $(echo "$RESP" | head -c 100)"
  FAIL=$((FAIL+1))
  ERRORS="$ERRORS\n  FAIL search hospital"
fi

section "Search by manifest number"
RESP=$($CURL -s -X GET "${API}/search?q=MAN-2025" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Search by 'MAN-2025' returned results"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Search by manifest number failed"
  FAIL=$((FAIL+1))
fi

section "Search with no results"
RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X GET "${API}/search?q=zzzxxxnonexistent" -H "Authorization: Bearer $TOKEN")
if [ "$RESP" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} Search with no results returns 200"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Expected 200, got $RESP"
  FAIL=$((FAIL+1))
fi

section "Search without auth"
RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X GET "${API}/search?q=hospital")
if [ "$RESP" = "401" ]; then
  echo -e "  ${GREEN}PASS${NC} Search without auth returns 401"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Expected 401, got $RESP"
  FAIL=$((FAIL+1))
fi

echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
[ $FAIL -gt 0 ] && echo -e "$ERRORS" && exit 1 || exit 0
