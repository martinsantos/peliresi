#!/bin/bash
# ============================================================
# SITREP Smoke Test — Validates ALL API endpoints respond
# Usage: ./tests/smoke-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0
FAIL=0
SKIP=0
ERRORS=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CURL=$(which curl)

# Login and get token
echo "============================================"
echo "SITREP SMOKE TEST"
echo "Target: $API"
echo "============================================"
echo ""
echo "--- Authenticating ---"

LOGIN_RESP=$($CURL -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"juan.perez@dgfa.gob.ar","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}FATAL: Cannot authenticate. Aborting.${NC}"
  echo "Response: $LOGIN_RESP"
  exit 1
fi
echo -e "${GREEN}Authenticated as admin${NC}"

# Helper: test authenticated endpoint
test_endpoint() {
  local METHOD=$1
  local EPATH=$2
  local EXPECTED=$3
  local BODY=$4
  local LABEL="${METHOD} ${EPATH}"

  if [ -n "$BODY" ]; then
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY")
  else
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN")
  fi

  if [ "$RESP" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}PASS${NC} [$RESP] $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} [$RESP expected $EXPECTED] $LABEL"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL [$RESP expected $EXPECTED] $LABEL"
  fi
}

# Helper: test public endpoint (no auth)
test_public() {
  local METHOD=$1
  local EPATH=$2
  local EXPECTED=$3
  local BODY=$4
  local LABEL="${METHOD} ${EPATH} (public)"

  if [ -n "$BODY" ]; then
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -d "$BODY")
  else
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}")
  fi

  if [ "$RESP" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}PASS${NC} [$RESP] $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} [$RESP expected $EXPECTED] $LABEL"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL [$RESP expected $EXPECTED] $LABEL"
  fi
}

echo ""
echo "--- Health ---"
test_public "GET" "/health" "200"

echo ""
echo "--- Auth ---"
test_public "GET" "/auth/test" "200"
test_public "POST" "/auth/login" "200" '{"email":"juan.perez@dgfa.gob.ar","password":"admin123"}'
test_public "POST" "/auth/login" "401" '{"email":"fake@test.com","password":"wrong"}'
test_endpoint "GET" "/auth/profile" "200"
test_endpoint "POST" "/auth/change-password" "400" '{"currentPassword":"wrong","newPassword":"NewPass123"}'
test_endpoint "POST" "/auth/logout" "200"

echo ""
echo "--- Manifiestos ---"
test_endpoint "GET" "/manifiestos/dashboard" "200"
test_endpoint "GET" "/manifiestos/sync-inicial" "200"
test_endpoint "GET" "/manifiestos" "200"
test_endpoint "GET" "/manifiestos?estado=APROBADO&limit=1" "200"

# Get a real manifiesto ID
MANIFIESTO_ID=$($CURL -s "${API}/manifiestos?limit=1" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); ms=d['data']['manifiestos']; print(ms[0]['id'] if ms else '')" 2>/dev/null)

if [ -n "$MANIFIESTO_ID" ]; then
  test_endpoint "GET" "/manifiestos/$MANIFIESTO_ID" "200"
  test_endpoint "GET" "/manifiestos/$MANIFIESTO_ID/viaje-actual" "200"
else
  echo -e "  ${YELLOW}SKIP${NC} No manifiestos to test detail endpoints"
  SKIP=$((SKIP + 2))
fi

test_endpoint "GET" "/manifiestos/nonexistent-id-12345" "404"

echo ""
echo "--- Catalogos ---"
test_public "GET" "/catalogos/tipos-residuos" "200"
test_endpoint "GET" "/catalogos/generadores" "200"
test_endpoint "GET" "/catalogos/transportistas" "200"
test_endpoint "GET" "/catalogos/operadores" "200"
test_endpoint "GET" "/catalogos/vehiculos" "200"
test_endpoint "GET" "/catalogos/choferes" "200"

# Get transportista ID
TRANSP_ID=$($CURL -s "${API}/catalogos/transportistas" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); ts=d['data']['transportistas']; print(ts[0]['id'] if ts else '')" 2>/dev/null)

if [ -n "$TRANSP_ID" ]; then
  test_endpoint "GET" "/catalogos/transportistas/$TRANSP_ID/vehiculos" "200"
  test_endpoint "GET" "/catalogos/transportistas/$TRANSP_ID/choferes" "200"
else
  echo -e "  ${YELLOW}SKIP${NC} No transportistas for sub-resource tests"
  SKIP=$((SKIP + 2))
fi

# Get operador ID
OPERADOR_ID=$($CURL -s "${API}/catalogos/operadores" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); os=d['data']['operadores']; print(os[0]['id'] if os else '')" 2>/dev/null)

if [ -n "$OPERADOR_ID" ]; then
  test_endpoint "GET" "/catalogos/operadores/$OPERADOR_ID/tratamientos" "200"
else
  echo -e "  ${YELLOW}SKIP${NC} No operadores for tratamientos test"
  SKIP=$((SKIP + 1))
fi

echo ""
echo "--- Actores ---"
test_endpoint "GET" "/actores/generadores" "200"
test_endpoint "GET" "/actores/transportistas" "200"
test_endpoint "GET" "/actores/operadores" "200"

# Get IDs for detail tests
GEN_ID=$($CURL -s "${API}/actores/generadores?limit=1" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); gs=d['data']['generadores']; print(gs[0]['id'] if gs else '')" 2>/dev/null)
TRANSP_ACTOR_ID=$($CURL -s "${API}/actores/transportistas?limit=1" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); ts=d['data']['transportistas']; print(ts[0]['id'] if ts else '')" 2>/dev/null)
OPER_ACTOR_ID=$($CURL -s "${API}/actores/operadores?limit=1" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); os=d['data']['operadores']; print(os[0]['id'] if os else '')" 2>/dev/null)

if [ -n "$GEN_ID" ]; then
  test_endpoint "GET" "/actores/generadores/$GEN_ID" "200"
fi
if [ -n "$TRANSP_ACTOR_ID" ]; then
  test_endpoint "GET" "/actores/transportistas/$TRANSP_ACTOR_ID" "200"
fi
if [ -n "$OPER_ACTOR_ID" ]; then
  test_endpoint "GET" "/actores/operadores/$OPER_ACTOR_ID" "200"
fi

echo ""
echo "--- Admin Usuarios ---"
test_endpoint "GET" "/admin/usuarios" "200"
test_endpoint "GET" "/admin/usuarios?rol=ADMIN" "200"
test_endpoint "GET" "/admin/usuarios?search=juan" "200"

echo ""
echo "--- Reportes ---"
test_endpoint "GET" "/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2025-12-31" "200"
test_endpoint "GET" "/reportes/tratados?fechaInicio=2024-01-01&fechaFin=2025-12-31" "200"
test_endpoint "GET" "/reportes/transporte?fechaInicio=2024-01-01&fechaFin=2025-12-31" "200"

echo ""
echo "--- PDF ---"
if [ -n "$MANIFIESTO_ID" ]; then
  test_endpoint "GET" "/pdf/manifiesto/$MANIFIESTO_ID" "200"
else
  echo -e "  ${YELLOW}SKIP${NC} No manifiestos for PDF test"
  SKIP=$((SKIP + 1))
fi

echo ""
echo "--- Analytics (dashboard) ---"
test_endpoint "GET" "/analytics/manifiestos-por-mes" "200"
test_endpoint "GET" "/analytics/residuos-por-tipo" "200"
test_endpoint "GET" "/analytics/manifiestos-por-estado" "200"
test_endpoint "GET" "/analytics/tiempo-promedio" "200"

echo ""
echo "--- Centro de Control ---"
test_endpoint "GET" "/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2025-12-31&capas=generadores,transportistas,operadores,transito" "200"

echo ""
echo "--- Notificaciones ---"
test_endpoint "GET" "/notificaciones" "200"

echo ""
echo "--- QR Verification (public) ---"
# Get a real manifiesto number
if [ -n "$MANIFIESTO_ID" ]; then
  MAN_NUMERO=$($CURL -s "${API}/manifiestos/$MANIFIESTO_ID" -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['manifiesto']['numero'])" 2>/dev/null)
  if [ -n "$MAN_NUMERO" ]; then
    test_public "GET" "/manifiestos/verificar/$MAN_NUMERO" "200"
  fi
fi
test_public "GET" "/manifiestos/verificar/NONEXISTENT" "404"

echo ""
echo "============================================"
echo "RESULTS"
echo "============================================"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
if [ $SKIP -gt 0 ]; then
  echo -e "  ${YELLOW}SKIP: $SKIP${NC}"
fi
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}FAILURES:${NC}"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo -e "${GREEN}ALL TESTS PASSED${NC}"
  exit 0
fi
