#!/bin/bash
# ============================================================
# SITREP Smoke Test — Validates ALL API endpoints respond
# Usage: ./tests/smoke-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
BASE_URL="${BASE_URL%/}"
API="$BASE_URL/api"
PASS=0
FAIL=0
SKIP=0
ERRORS=""
TRAINING_PREFIX="${TRAINING_PREFIX:-CAP-20260702}"
CERT_ADMIN_EMAIL="${CERT_ADMIN_EMAIL:-admin@dgfa.mendoza.gov.ar}"
CERT_ADMIN_PASSWORD="${CERT_ADMIN_PASSWORD:-admin123}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

CURL=$(which curl)

json_get() {
  local path="$1"
  python3 -c '
import json
import sys

path = sys.argv[1].split(".")
try:
    value = json.load(sys.stdin)
    for key in path:
        if isinstance(value, list):
            value = value[int(key)]
        else:
            value = value[key]
    if isinstance(value, bool):
        print("true" if value else "false")
    elif value is not None:
        print(value)
except Exception:
    print("")
' "$path"
}

host_from_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
print(urlparse(sys.argv[1]).hostname or sys.argv[1])
PY
}

is_real_production_target() {
  case "$(host_from_url "$BASE_URL")" in
    rptrazar.mendoza.gov.ar|sitrepprd1.mendoza.gov.ar) return 0 ;;
    *) return 1 ;;
  esac
}

first_id_from_collection() {
  local collection="$1"
  python3 -c '
import json
import sys

collection = sys.argv[1]
try:
    data = json.load(sys.stdin).get("data", {})
    items = data.get(collection) or data.get("items") or []
    print(items[0].get("id", "") if items else "")
except Exception:
    print("")
' "$collection"
}

manifest_id_by_number() {
  local number="$1"
  $CURL -sS --max-time 20 -G \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "search=$number" \
    --data-urlencode "limit=20" \
    "${API}/manifiestos" | NUMBER="$number" python3 -c '
import json
import os
import sys

target = os.environ["NUMBER"]
try:
    data = json.load(sys.stdin).get("data", {})
    items = data.get("manifiestos") or data.get("items") or []
    for item in items:
        if item.get("numero") == target:
            print(item.get("id", ""))
            break
except Exception:
    pass
'
}

actor_id_by_search() {
  local path="$1" collection="$2" query="$3"
  $CURL -sS --max-time 20 -G \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "search=$query" \
    --data-urlencode "limit=5" \
    "${API}${path}" | first_id_from_collection "$collection"
}

# Login and get token
echo "============================================"
echo "SITREP SMOKE TEST"
echo "Target: $API"
echo "============================================"
echo ""
echo "--- Authenticating ---"

LOGIN_RESP=$($CURL -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$CERT_ADMIN_EMAIL\",\"password\":\"$CERT_ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESP" | json_get "data.tokens.accessToken")

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
test_public "GET" "/health/live" "200"
test_public "GET" "/health/ready" "200"

echo ""
echo "--- Auth ---"
test_public "GET" "/auth/test" "200"
test_public "POST" "/auth/login" "200" "{\"email\":\"$CERT_ADMIN_EMAIL\",\"password\":\"$CERT_ADMIN_PASSWORD\"}"
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

# Get a manifiesto ID. On real production, pin this to the CAP demo dataset.
if is_real_production_target; then
  MANIFIESTO_ID=$(manifest_id_by_number "${TRAINING_PREFIX}-0003")
  [ -n "$MANIFIESTO_ID" ] && echo -e "  ${GREEN}INFO${NC} Using demo manifiesto ${TRAINING_PREFIX}-0003 for detail/PDF/QR checks"
else
  MANIFIESTO_ID=$($CURL -s "${API}/manifiestos?limit=1" -H "Authorization: Bearer $TOKEN" | first_id_from_collection "manifiestos")
fi

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
if is_real_production_target; then
  TRANSP_ID=$(actor_id_by_search "/actores/transportistas" "transportistas" "CAPACITACION RP - Transporte Escuela")
else
  TRANSP_ID=$($CURL -s "${API}/catalogos/transportistas" -H "Authorization: Bearer $TOKEN" | first_id_from_collection "transportistas")
fi

if [ -n "$TRANSP_ID" ]; then
  test_endpoint "GET" "/catalogos/transportistas/$TRANSP_ID/vehiculos" "200"
  test_endpoint "GET" "/catalogos/transportistas/$TRANSP_ID/choferes" "200"
else
  echo -e "  ${YELLOW}SKIP${NC} No transportistas for sub-resource tests"
  SKIP=$((SKIP + 2))
fi

# Get operador ID
if is_real_production_target; then
  OPERADOR_ID=$(actor_id_by_search "/actores/operadores" "operadores" "CAPACITACION RP - Operador Escuela")
else
  OPERADOR_ID=$($CURL -s "${API}/catalogos/operadores" -H "Authorization: Bearer $TOKEN" | first_id_from_collection "operadores")
fi

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
if is_real_production_target; then
  GEN_ID=$(actor_id_by_search "/actores/generadores" "generadores" "CAPACITACION RP - Generador Escuela")
  TRANSP_ACTOR_ID="$TRANSP_ID"
  OPER_ACTOR_ID="$OPERADOR_ID"
else
  GEN_ID=$($CURL -s "${API}/actores/generadores?limit=1" -H "Authorization: Bearer $TOKEN" | first_id_from_collection "generadores")
  TRANSP_ACTOR_ID=$($CURL -s "${API}/actores/transportistas?limit=1" -H "Authorization: Bearer $TOKEN" | first_id_from_collection "transportistas")
  OPER_ACTOR_ID=$($CURL -s "${API}/actores/operadores?limit=1" -H "Authorization: Bearer $TOKEN" | first_id_from_collection "operadores")
fi

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
  MAN_NUMERO=$($CURL -s "${API}/manifiestos/$MANIFIESTO_ID" -H "Authorization: Bearer $TOKEN" | json_get "data.manifiesto.numero")
  if [ -n "$MAN_NUMERO" ]; then
    test_public "GET" "/manifiestos/verificar/$MAN_NUMERO" "200"
  fi
fi
test_public "GET" "/manifiestos/verificar/NONEXISTENT" "404"

echo ""
echo "--- Blockchain ---"
if [ -n "$MANIFIESTO_ID" ]; then
  test_endpoint "GET" "/blockchain/manifiesto/$MANIFIESTO_ID" "200"
fi
test_public "GET" "/blockchain/verificar/0000000000000000000000000000000000000000000000000000000000000000" "200"

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
