#!/bin/bash
# ============================================================
# SITREP — Actores CRUD Test
# Tests CREATE/UPDATE/DELETE for Generadores, Operadores,
# Transportistas and their sub-resources (vehículos, choferes).
# Also verifies role enforcement (non-ADMIN cannot mutate).
# Usage: bash backend/tests/actores-crud-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0
FAIL=0
ERRORS=""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL+1)); ERRORS="$ERRORS\n  FAIL $1"; }
section() { echo -e "\n${BOLD}${CYAN}--- $1 ---${NC}"; }

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass "[$actual] $label"
  else
    fail "[$actual != $expected] $label"
  fi
}

json_val() {
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$1'.split('.')
    for k in keys:
        if isinstance(d, list): d = d[int(k)]
        else: d = d.get(k, '')
    print(d if d is not None else '')
except: print('')
" 2>/dev/null
}

get_token() {
  curl -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null
}

# Returns full JSON response body
api_call() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -X "$method" "$API$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$body"
  else
    curl -s -X "$method" "$API$path" \
      -H "Authorization: Bearer $token"
  fi
}

# Returns only HTTP status code
status_only() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$body"
  else
    curl -s -o /dev/null -w "%{http_code}" -X "$method" "$API$path" \
      -H "Authorization: Bearer $token"
  fi
}

# Extract ID from response — tries common shapes
extract_id() {
  local resp="$1"
  python3 -c "
import sys, json
try:
    d = json.loads('$2' if '$2' else sys.stdin.read())
    # Try common shapes
    for path in ['data.generador.id','data.transportista.id','data.operador.id','data.vehiculo.id','data.chofer.id','data.id','id']:
        try:
            keys = path.split('.')
            val = d
            for k in keys: val = val[k]
            if val:
                print(val)
                break
        except: pass
except: pass
" <<< "$resp" 2>/dev/null
}

# ── Header ────────────────────────────────────────────────────

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   SITREP — Actores CRUD Test                         ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo "Target: $API"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"

# ── Authentication ────────────────────────────────────────────

section "Authentication"

ADMIN_TOKEN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
GEN_TOKEN=$(get_token "quimica.mendoza@industria.com" "gen123")
TRANS_TOKEN=$(get_token "transportes.andes@logistica.com" "trans123")

[ -n "$ADMIN_TOKEN" ] && pass "ADMIN login" || { fail "ADMIN login — aborting"; exit 1; }
[ -n "$GEN_TOKEN" ]   && pass "GENERADOR login" || fail "GENERADOR login"
[ -n "$TRANS_TOKEN" ] && pass "TRANSPORTISTA login" || fail "TRANSPORTISTA login"

TIMESTAMP=$(date +%s)

# ── Generadores CRUD ──────────────────────────────────────────

section "Generadores CRUD (ADMIN)"

GEN_BODY="{
  \"razonSocial\": \"Test Generador $TIMESTAMP\",
  \"cuit\": \"30-$TIMESTAMP-1\",
  \"email\": \"testgen$TIMESTAMP@test.com\",
  \"password\": \"test123\",
  \"telefono\": \"0261-4000000\",
  \"domicilio\": \"Av. Test 100, Mendoza\",
  \"numeroInscripcion\": \"GEN-TEST-$TIMESTAMP\",
  \"categoria\": \"GRAN_GENERADOR\"
}"

CREATE_GEN=$(api_call "POST" "/actores/generadores" "$ADMIN_TOKEN" "$GEN_BODY")
GEN_ID=$(extract_id "$CREATE_GEN")

if [ -n "$GEN_ID" ]; then
  pass "[201/200] POST /actores/generadores — id: ${GEN_ID:0:8}..."
else
  fail "POST /actores/generadores — no id in response: $(echo $CREATE_GEN | head -c 200)"
fi

if [ -n "$GEN_ID" ]; then
  UPD=$(status_only "PUT" "/actores/generadores/$GEN_ID" "$ADMIN_TOKEN" \
    "{\"razonSocial\":\"Updated Generador $TIMESTAMP\",\"telefono\":\"0261-9999999\"}")
  check_status "PUT /actores/generadores/:id" "200" "$UPD"

  DEL=$(status_only "DELETE" "/actores/generadores/$GEN_ID" "$ADMIN_TOKEN")
  check_status "DELETE /actores/generadores/:id" "200" "$DEL"
fi

# Non-admin cannot create
if [ -n "$GEN_TOKEN" ]; then
  BLOCK=$(status_only "POST" "/actores/generadores" "$GEN_TOKEN" "$GEN_BODY")
  check_status "POST /actores/generadores as GENERADOR → 403" "403" "$BLOCK"
fi

# ── Operadores CRUD ───────────────────────────────────────────

section "Operadores CRUD (ADMIN)"

OPER_BODY="{
  \"razonSocial\": \"Test Operador $TIMESTAMP\",
  \"cuit\": \"30-9$TIMESTAMP-2\",
  \"email\": \"testoper$TIMESTAMP@test.com\",
  \"password\": \"test123\",
  \"telefono\": \"0261-5000000\",
  \"domicilio\": \"Calle Operador 200, Mendoza\",
  \"numeroHabilitacion\": \"OP-TEST-$TIMESTAMP\",
  \"categoria\": \"TRATAMIENTO_FISICOQUIMICO\"
}"

CREATE_OPER=$(api_call "POST" "/actores/operadores" "$ADMIN_TOKEN" "$OPER_BODY")
OPER_ID=$(extract_id "$CREATE_OPER")

if [ -n "$OPER_ID" ]; then
  pass "[201/200] POST /actores/operadores — id: ${OPER_ID:0:8}..."
else
  fail "POST /actores/operadores — no id: $(echo $CREATE_OPER | head -c 200)"
fi

if [ -n "$OPER_ID" ]; then
  UPD=$(status_only "PUT" "/actores/operadores/$OPER_ID" "$ADMIN_TOKEN" \
    "{\"telefono\":\"0261-1234567\"}")
  check_status "PUT /actores/operadores/:id" "200" "$UPD"

  DEL=$(status_only "DELETE" "/actores/operadores/$OPER_ID" "$ADMIN_TOKEN")
  check_status "DELETE /actores/operadores/:id" "200" "$DEL"
fi

# ── Transportistas + sub-resources ───────────────────────────

section "Transportistas CRUD (ADMIN)"

TRANS_BODY="{
  \"razonSocial\": \"Test Transportes $TIMESTAMP\",
  \"cuit\": \"30-8$TIMESTAMP-3\",
  \"email\": \"testtrans$TIMESTAMP@test.com\",
  \"password\": \"test123\",
  \"telefono\": \"0261-6000000\",
  \"domicilio\": \"Ruta 7 km 5, Mendoza\",
  \"numeroHabilitacion\": \"TR-TEST-$TIMESTAMP\"
}"

CREATE_TRANS=$(api_call "POST" "/actores/transportistas" "$ADMIN_TOKEN" "$TRANS_BODY")
TRANS_NEW_ID=$(extract_id "$CREATE_TRANS")

if [ -n "$TRANS_NEW_ID" ]; then
  pass "[201/200] POST /actores/transportistas — id: ${TRANS_NEW_ID:0:8}..."
else
  fail "POST /actores/transportistas — no id: $(echo $CREATE_TRANS | head -c 200)"
fi

section "Vehículos sub-resource"

if [ -n "$TRANS_NEW_ID" ]; then
  VEH_BODY="{
    \"patente\": \"TST$TIMESTAMP\",
    \"marca\": \"Mercedes\",
    \"modelo\": \"Atego\",
    \"anio\": 2020,
    \"capacidad\": 5000,
    \"numeroHabilitacion\": \"HV-$TIMESTAMP\",
    \"vencimiento\": \"2027-12-31T00:00:00.000Z\"
  }"

  CREATE_VEH=$(api_call "POST" "/actores/transportistas/$TRANS_NEW_ID/vehiculos" "$ADMIN_TOKEN" "$VEH_BODY")
  VEH_ID=$(extract_id "$CREATE_VEH")

  if [ -n "$VEH_ID" ]; then
    pass "[201/200] POST /actores/transportistas/:id/vehiculos — id: ${VEH_ID:0:8}..."
  else
    fail "POST /actores/transportistas/:id/vehiculos — no id: $(echo $CREATE_VEH | head -c 200)"
  fi

  if [ -n "$VEH_ID" ]; then
    UPD=$(status_only "PUT" "/actores/transportistas/$TRANS_NEW_ID/vehiculos/$VEH_ID" \
      "$ADMIN_TOKEN" "{\"marca\":\"Volvo\"}")
    check_status "PUT /actores/transportistas/:id/vehiculos/:vid" "200" "$UPD"

    DEL=$(status_only "DELETE" "/actores/transportistas/$TRANS_NEW_ID/vehiculos/$VEH_ID" \
      "$ADMIN_TOKEN")
    check_status "DELETE /actores/transportistas/:id/vehiculos/:vid" "200" "$DEL"
  fi
fi

section "Choferes sub-resource"

if [ -n "$TRANS_NEW_ID" ]; then
  CHOF_BODY="{
    \"nombre\": \"Chofer\",
    \"apellido\": \"Test $TIMESTAMP\",
    \"dni\": \"$TIMESTAMP\",
    \"licencia\": \"LC-$TIMESTAMP\",
    \"telefono\": \"261-7000000\",
    \"vencimiento\": \"2027-12-31T00:00:00.000Z\"
  }"

  CREATE_CHOF=$(api_call "POST" "/actores/transportistas/$TRANS_NEW_ID/choferes" "$ADMIN_TOKEN" "$CHOF_BODY")
  CHOF_ID=$(extract_id "$CREATE_CHOF")

  if [ -n "$CHOF_ID" ]; then
    pass "[201/200] POST /actores/transportistas/:id/choferes — id: ${CHOF_ID:0:8}..."
  else
    fail "POST /actores/transportistas/:id/choferes — no id: $(echo $CREATE_CHOF | head -c 200)"
  fi

  if [ -n "$CHOF_ID" ]; then
    UPD=$(status_only "PUT" "/actores/transportistas/$TRANS_NEW_ID/choferes/$CHOF_ID" \
      "$ADMIN_TOKEN" "{\"telefono\":\"261-9999999\"}")
    check_status "PUT /actores/transportistas/:id/choferes/:cid" "200" "$UPD"

    DEL=$(status_only "DELETE" "/actores/transportistas/$TRANS_NEW_ID/choferes/$CHOF_ID" \
      "$ADMIN_TOKEN")
    check_status "DELETE /actores/transportistas/:id/choferes/:cid" "200" "$DEL"
  fi
fi

# Cleanup: delete test transportista
if [ -n "$TRANS_NEW_ID" ]; then
  DEL=$(status_only "DELETE" "/actores/transportistas/$TRANS_NEW_ID" "$ADMIN_TOKEN")
  check_status "DELETE /actores/transportistas/:id (cleanup)" "200" "$DEL"
fi

# ── Role enforcement ──────────────────────────────────────────

section "Role Enforcement — non-ADMIN blocked"

if [ -n "$TRANS_TOKEN" ]; then
  B1=$(status_only "POST" "/actores/generadores" "$TRANS_TOKEN" \
    "{\"razonSocial\":\"Hack\",\"cuit\":\"20-0000000-1\"}")
  check_status "TRANSPORTISTA cannot POST /actores/generadores → 403" "403" "$B1"

  B2=$(status_only "POST" "/actores/operadores" "$TRANS_TOKEN" \
    "{\"razonSocial\":\"Hack\",\"cuit\":\"20-0000000-1\"}")
  check_status "TRANSPORTISTA cannot POST /actores/operadores → 403" "403" "$B2"
fi

if [ -n "$GEN_TOKEN" ]; then
  B3=$(status_only "DELETE" "/actores/generadores/nonexistent-id" "$GEN_TOKEN")
  check_status "GENERADOR cannot DELETE /actores/generadores/:id → 403" "403" "$B3"
fi

# ── Summary ───────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo -e "${RED}FAILURES:${NC}"
  echo -e "$ERRORS"
  exit 1
else
  echo -e "\n${GREEN}ALL TESTS PASSED${NC}"
  exit 0
fi
