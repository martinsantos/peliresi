#!/bin/bash
# ============================================================
# SITREP Reportes Test — 3 report endpoints + data structure
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

section "Reporte: Manifiestos"
RESP=$($CURL -s -X GET "${API}/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2026-12-31" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Reporte manifiestos OK"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Reporte manifiestos failed"
  FAIL=$((FAIL+1))
fi

section "Reporte: Tratados"
RESP=$($CURL -s -X GET "${API}/reportes/tratados?fechaInicio=2024-01-01&fechaFin=2026-12-31" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Reporte tratados OK"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Reporte tratados failed"
  FAIL=$((FAIL+1))
fi

section "Reporte: Transporte"
RESP=$($CURL -s -X GET "${API}/reportes/transporte?fechaInicio=2024-01-01&fechaFin=2026-12-31" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Reporte transporte OK"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Reporte transporte failed"
  FAIL=$((FAIL+1))
fi

# Verify the "gotcha": porTipoResiduo is a dict where each value is { cantidad, unidad }
section "Data Structure Check"
RESP=$($CURL -s -X GET "${API}/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2026-12-31" -H "Authorization: Bearer $TOKEN")
STRUCT_OK=$(echo "$RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    data = d.get('data', {})
    pt = data.get('porTipoResiduo', data.get('porTipo', {}))
    if pt and isinstance(pt, dict) and len(pt) > 0:
        first_val = next(iter(pt.values()))
        # Each value should be an object with cantidad and unidad (not plain numbers)
        if isinstance(first_val, dict) and 'unidad' in first_val and 'cantidad' in first_val:
            print('true')
        else:
            print('false')
    elif pt and isinstance(pt, list) and len(pt) > 0:
        # Fallback: list-based structure
        first_val = pt[0]
        if isinstance(first_val, dict) and 'unidad' in first_val:
            print('true')
        else:
            print('false')
    else:
        print('skip')
except: print('false')
" 2>/dev/null)
if [ "$STRUCT_OK" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} porTipoResiduo returns object with unidad"
  PASS=$((PASS+1))
elif [ "$STRUCT_OK" = "skip" ]; then
  echo -e "  ${YELLOW}SKIP${NC} porTipoResiduo is empty"
else
  echo -e "  ${RED}FAIL${NC} porTipoResiduo should be objects with unidad"
  FAIL=$((FAIL+1))
fi

echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
[ $FAIL -gt 0 ] && echo -e "$ERRORS" && exit 1 || exit 0
