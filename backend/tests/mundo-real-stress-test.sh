#!/bin/bash
# ============================================================
# SITREP Mundo Real + Stress Test
# ============================================================
# Creates 20 manifiestos across 8 users (3 gen, 2 trans, 2 oper, 1 admin)
# with real GPS routes, incidents, blockchain verification, and stress bursts.
#
# IMPORTANT: This test creates REAL data in the target environment.
# All manifiestos are tagged with "[TEST-STRESS]" in observaciones.
#
# Usage: ./tests/mundo-real-stress-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

set -uo pipefail

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0
FAIL=0
WARN=0
ERRORS=""
WARNINGS=""
GPS_SENT=0
INCIDENTS_SENT=0
MANIFIESTOS_CREATED=0
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

CURL=$(which curl)

# Manifest tracking arrays
declare -a ALL_IDS=()
declare -a ALL_NUMS=()
declare -a ALL_STATES=()
declare -a TRATADO_IDS=()
declare -a EN_TRANSITO_IDS=()
declare -a RECIBIDO_IDS=()
declare -a RECHAZADO_IDS=()

# -------------------------------------------------------
# HELPERS
# -------------------------------------------------------

json_extract() {
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$1'.split('.')
    for k in keys:
        if isinstance(d, list):
            d = d[int(k)]
        else:
            d = d[k]
    print(d if d is not None else '')
except Exception:
    print('')
" 2>/dev/null
}

json_extract_list() {
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$1'.split('.')
    for k in keys:
        if isinstance(d, list):
            d = d[int(k)]
        else:
            d = d[k]
    if isinstance(d, list):
        for item in d:
            print(item)
    else:
        print(d)
except Exception:
    pass
" 2>/dev/null
}

api_call() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local BODY="${4:-}"

  if [ -n "$BODY" ]; then
    $CURL -s -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY"
  else
    $CURL -s -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

api_status() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local BODY="${4:-}"

  if [ -n "$BODY" ]; then
    $CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY"
  else
    $CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

pass() {
  echo -e "  ${GREEN}PASS${NC} $1"
  PASS=$((PASS + 1))
}

fail() {
  echo -e "  ${RED}FAIL${NC} $1"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL $1"
}

warn() {
  echo -e "  ${YELLOW}WARN${NC} $1"
  WARN=$((WARN + 1))
  WARNINGS="$WARNINGS\n  WARN $1"
}

section() {
  echo ""
  echo -e "${BOLD}${CYAN}=================================================================${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}=================================================================${NC}"
}

subsection() {
  echo ""
  echo -e "${BLUE}--- $1 ---${NC}"
}

check_success() {
  local RESP="$1"
  local SUCCESS
  SUCCESS=$(echo "$RESP" | json_extract "success")
  if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
    return 0
  else
    return 1
  fi
}

# Create a manifiesto — sets LAST_CREATED_ID and LAST_CREATED_NUM
# Usage: create_manifiesto TOKEN GEN_ID TRANS_ID OPER_ID RESIDUOS_JSON OBSERVACIONES
LAST_CREATED_ID=""
LAST_CREATED_NUM=""

create_manifiesto() {
  local TOKEN=$1
  local GEN_ID=$2
  local TRANS_ID=$3
  local OPER_ID=$4
  local RESIDUOS=$5
  local OBS=$6

  LAST_CREATED_ID=""
  LAST_CREATED_NUM=""

  local BODY="{
    \"generadorId\": \"$GEN_ID\",
    \"transportistaId\": \"$TRANS_ID\",
    \"operadorId\": \"$OPER_ID\",
    \"observaciones\": \"[TEST-STRESS] $OBS — $TIMESTAMP\",
    \"residuos\": $RESIDUOS
  }"

  local RESP
  RESP=$(api_call "POST" "/manifiestos" "$TOKEN" "$BODY")
  local MID
  MID=$(echo "$RESP" | json_extract "data.manifiesto.id")
  local MNUM
  MNUM=$(echo "$RESP" | json_extract "data.manifiesto.numero")

  if [ -n "$MID" ] && [ "$MID" != "" ]; then
    ALL_IDS+=("$MID")
    ALL_NUMS+=("$MNUM")
    ALL_STATES+=("BORRADOR")
    MANIFIESTOS_CREATED=$((MANIFIESTOS_CREATED + 1))
    LAST_CREATED_ID="$MID"
    LAST_CREATED_NUM="$MNUM"
    return 0
  else
    return 1
  fi
}

# Transition a manifiesto and update tracking
# Usage: transition_manifiesto ID ACTION TOKEN [BODY]
transition_manifiesto() {
  local MID=$1
  local ACTION=$2
  local TOKEN=$3
  local BODY="${4:-}"

  local RESP
  RESP=$(api_call "POST" "/manifiestos/$MID/$ACTION" "$TOKEN" "$BODY")

  if check_success "$RESP"; then
    local NEW_STATE
    NEW_STATE=$(echo "$RESP" | json_extract "data.manifiesto.estado")
    # Update state in tracking array
    for i in "${!ALL_IDS[@]}"; do
      if [ "${ALL_IDS[$i]}" = "$MID" ]; then
        ALL_STATES[$i]="$NEW_STATE"
        break
      fi
    done
    return 0
  else
    return 1
  fi
}

# Send GPS point
# Usage: send_gps MID TOKEN LAT LON [SPEED] [DIRECTION]
send_gps() {
  local MID=$1
  local TOKEN=$2
  local LAT=$3
  local LON=$4
  local SPEED="${5:-40}"
  local DIR="${6:-180}"

  local BODY="{\"latitud\": $LAT, \"longitud\": $LON, \"velocidad\": $SPEED, \"direccion\": $DIR}"
  local RESP
  RESP=$(api_call "POST" "/manifiestos/$MID/ubicacion" "$TOKEN" "$BODY")
  if check_success "$RESP"; then
    GPS_SENT=$((GPS_SENT + 1))
    return 0
  else
    return 1
  fi
}

# -------------------------------------------------------
# GPS ROUTES (real Mendoza coordinates)
# -------------------------------------------------------

# Ruta A: Quimica Mendoza -> Tratamiento Residuos (~15km sur por Ruta 40)
RUTA_A_LATS=(-32.8908 -32.9000 -32.9100 -32.9250 -32.9400 -32.9550 -32.9700 -32.9850 -33.0000 -33.0150 -33.0312)
RUTA_A_LONS=(-68.8272 -68.8300 -68.8350 -68.8400 -68.8450 -68.8500 -68.8550 -68.8600 -68.8650 -68.8700 -68.8745)

# Ruta B: Petroquimica -> Eco Ambiental (~22km via Maipu)
RUTA_B_LATS=(-32.8753 -32.8900 -32.9100 -32.9350 -32.9600 -32.9850 -33.0100 -33.0350 -33.0500 -33.0689)
RUTA_B_LONS=(-68.7892 -68.8000 -68.8200 -68.8400 -68.8550 -68.8700 -68.8800 -68.8900 -68.9000 -68.9127)

# Ruta C: Laboratorio -> Tratamiento Residuos (~15km)
RUTA_C_LATS=(-32.8945 -32.9050 -32.9200 -32.9400 -32.9600 -32.9800 -33.0000 -33.0150 -33.0312)
RUTA_C_LONS=(-68.8418 -68.8440 -68.8470 -68.8510 -68.8560 -68.8610 -68.8660 -68.8700 -68.8745)


# ===============================================================
#  PHASE 0: Pre-flight
# ===============================================================

section "PHASE 0: Pre-flight Check"
echo "  Target: $API"
echo "  Timestamp: $TIMESTAMP"
echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""
echo -e "  ${YELLOW}WARNING: This test creates REAL data in production.${NC}"
echo -e "  ${YELLOW}All manifiestos tagged with [TEST-STRESS] in observaciones.${NC}"
echo ""

HEALTH_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' "$API/health")
if [ "$HEALTH_STATUS" = "200" ]; then
  pass "Health check OK (HTTP 200)"
else
  fail "Health check FAILED (HTTP $HEALTH_STATUS)"
  echo -e "${RED}FATAL: Server not responding. Aborting.${NC}"
  exit 1
fi


# ===============================================================
#  PHASE 1: Login 8 users
# ===============================================================

section "PHASE 1: Authenticate 8 Users"

login_user() {
  local EMAIL=$1
  local PASS_=$2
  local LABEL=$3

  echo -n "  Logging in as $LABEL ($EMAIL)... " >&2
  local RESP
  RESP=$($CURL -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS_\"}")
  local TOKEN
  TOKEN=$(echo "$RESP" | json_extract "data.tokens.accessToken")

  if [ -n "$TOKEN" ] && [ "$TOKEN" != "" ]; then
    echo -e "${GREEN}OK${NC}" >&2
    PASS=$((PASS + 1))
    echo "$TOKEN"
  else
    echo -e "${RED}FAILED${NC}" >&2
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot authenticate $LABEL ($EMAIL)"
    echo ""
  fi
}

# Capture tokens — login_user prints token as last line
ADMIN_TOKEN=$(login_user "admin@dgfa.mendoza.gov.ar" "admin123" "ADMIN")
GEN1_TOKEN=$(login_user "quimica.mendoza@industria.com" "gen123" "GENERADOR-1")
GEN2_TOKEN=$(login_user "petroquimica.andes@industria.com" "gen123" "GENERADOR-2")
GEN3_TOKEN=$(login_user "laboratorio.central@medicina.com" "gen123" "GENERADOR-3")
TRANS1_TOKEN=$(login_user "transportes.andes@logistica.com" "trans123" "TRANSPORTISTA-1")
TRANS2_TOKEN=$(login_user "logistica.cuyo@transporte.com" "trans123" "TRANSPORTISTA-2")
OPER1_TOKEN=$(login_user "tratamiento.residuos@planta.com" "op123" "OPERADOR-1")
OPER2_TOKEN=$(login_user "eco.ambiental@reciclado.com" "op123" "OPERADOR-2")

# Abort if admin or critical tokens missing
if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}FATAL: Cannot authenticate ADMIN. Aborting.${NC}"
  exit 1
fi

# Count successful logins
LOGIN_OK=0
for T in "$ADMIN_TOKEN" "$GEN1_TOKEN" "$GEN2_TOKEN" "$GEN3_TOKEN" \
         "$TRANS1_TOKEN" "$TRANS2_TOKEN" "$OPER1_TOKEN" "$OPER2_TOKEN"; do
  [ -n "$T" ] && LOGIN_OK=$((LOGIN_OK + 1))
done
echo ""
echo -e "  Authenticated: ${BOLD}$LOGIN_OK/8${NC} users"


# ===============================================================
#  PHASE 2: Fetch catalog IDs
# ===============================================================

section "PHASE 2: Fetch Catalog IDs"

# Get all generador IDs
GEN_CATALOG=$(api_call "GET" "/catalogos/generadores" "$ADMIN_TOKEN")
GEN_ID_1=$(echo "$GEN_CATALOG" | json_extract "data.generadores.0.id")
GEN_ID_2=$(echo "$GEN_CATALOG" | json_extract "data.generadores.1.id")
GEN_ID_3=$(echo "$GEN_CATALOG" | json_extract "data.generadores.2.id")
GEN_NAME_1=$(echo "$GEN_CATALOG" | json_extract "data.generadores.0.razonSocial")
GEN_NAME_2=$(echo "$GEN_CATALOG" | json_extract "data.generadores.1.razonSocial")
GEN_NAME_3=$(echo "$GEN_CATALOG" | json_extract "data.generadores.2.razonSocial")

echo "  Generadores:"
echo -e "    1: ${GEN_NAME_1:-?} (${GEN_ID_1:0:8}...)"
echo -e "    2: ${GEN_NAME_2:-?} (${GEN_ID_2:0:8}...)"
echo -e "    3: ${GEN_NAME_3:-?} (${GEN_ID_3:0:8}...)"

# Get all transportista IDs
TRANS_CATALOG=$(api_call "GET" "/catalogos/transportistas" "$ADMIN_TOKEN")
TRANS_ID_1=$(echo "$TRANS_CATALOG" | json_extract "data.transportistas.0.id")
TRANS_ID_2=$(echo "$TRANS_CATALOG" | json_extract "data.transportistas.1.id")
TRANS_NAME_1=$(echo "$TRANS_CATALOG" | json_extract "data.transportistas.0.razonSocial")
TRANS_NAME_2=$(echo "$TRANS_CATALOG" | json_extract "data.transportistas.1.razonSocial")

echo "  Transportistas:"
echo -e "    1: ${TRANS_NAME_1:-?} (${TRANS_ID_1:0:8}...)"
echo -e "    2: ${TRANS_NAME_2:-?} (${TRANS_ID_2:0:8}...)"

# Get all operador IDs
OPER_CATALOG=$(api_call "GET" "/catalogos/operadores" "$ADMIN_TOKEN")
OPER_ID_1=$(echo "$OPER_CATALOG" | json_extract "data.operadores.0.id")
OPER_ID_2=$(echo "$OPER_CATALOG" | json_extract "data.operadores.1.id")
OPER_NAME_1=$(echo "$OPER_CATALOG" | json_extract "data.operadores.0.razonSocial")
OPER_NAME_2=$(echo "$OPER_CATALOG" | json_extract "data.operadores.1.razonSocial")

echo "  Operadores:"
echo -e "    1: ${OPER_NAME_1:-?} (${OPER_ID_1:0:8}...)"
echo -e "    2: ${OPER_NAME_2:-?} (${OPER_ID_2:0:8}...)"

# Get residuo type IDs authorized by the operadores (not global catalog)
# This ensures manifiestos use residuos the operador can actually treat
RES_IDS_OPER1=()
RES_IDS_OPER2=()

# Extract authorized residuo IDs per operador from their tratamientos
_extract_oper_residuos() {
  local oper_id="$1"
  echo "$OPER_CATALOG" | python3 -c "
import sys, json
try:
    ops = json.load(sys.stdin)['data']['operadores']
    op = next((o for o in ops if o['id'] == '$oper_id'), None)
    if op:
        for t in op.get('tratamientos', []):
            print(t['tipoResiduoId'])
except: pass
" 2>/dev/null
}

while IFS= read -r rid; do
  [ -n "$rid" ] && RES_IDS_OPER1+=("$rid")
done < <(_extract_oper_residuos "$OPER_ID_1")

while IFS= read -r rid; do
  [ -n "$rid" ] && RES_IDS_OPER2+=("$rid")
done < <(_extract_oper_residuos "$OPER_ID_2")

# Fallback: if no authorized residuos found, use global catalog
if [ ${#RES_IDS_OPER1[@]} -eq 0 ] || [ ${#RES_IDS_OPER2[@]} -eq 0 ]; then
  RESIDUOS_CATALOG=$(api_call "GET" "/catalogos/tipos-residuos" "$ADMIN_TOKEN")
  FALLBACK_IDS=()
  for i in 0 1 2 3 4 5; do
    RID=$(echo "$RESIDUOS_CATALOG" | json_extract "data.tiposResiduos.$i.id")
    [ -n "$RID" ] && FALLBACK_IDS+=("$RID")
  done
  [ ${#RES_IDS_OPER1[@]} -eq 0 ] && RES_IDS_OPER1=("${FALLBACK_IDS[@]}")
  [ ${#RES_IDS_OPER2[@]} -eq 0 ] && RES_IDS_OPER2=("${FALLBACK_IDS[@]}")
fi

# Combined array for backward compat (used by res_id helper)
RES_IDS=("${RES_IDS_OPER1[@]}")
echo "  Operador 1 residuos autorizados: ${#RES_IDS_OPER1[@]}"
echo "  Operador 2 residuos autorizados: ${#RES_IDS_OPER2[@]}"

# Validate we have enough data
if [ -z "$GEN_ID_1" ] || [ -z "$TRANS_ID_1" ] || [ -z "$OPER_ID_1" ] || [ ${#RES_IDS[@]} -lt 2 ]; then
  echo -e "${RED}FATAL: Missing catalog data. Need at least 1 gen, 1 trans, 1 oper, 2 residuo types.${NC}"
  exit 1
fi
pass "All catalog data available"

# Fallback if less than 3 of each
[ -z "$GEN_ID_2" ] && GEN_ID_2="$GEN_ID_1"
[ -z "$GEN_ID_3" ] && GEN_ID_3="$GEN_ID_1"
[ -z "$TRANS_ID_2" ] && TRANS_ID_2="$TRANS_ID_1"
[ -z "$OPER_ID_2" ] && OPER_ID_2="$OPER_ID_1"

# Fallback tokens too
[ -z "$GEN2_TOKEN" ] && GEN2_TOKEN="$GEN1_TOKEN"
[ -z "$GEN3_TOKEN" ] && GEN3_TOKEN="$GEN1_TOKEN"
[ -z "$TRANS2_TOKEN" ] && TRANS2_TOKEN="$TRANS1_TOKEN"
[ -z "$OPER2_TOKEN" ] && OPER2_TOKEN="$OPER1_TOKEN"

# Build residuo JSON helpers — pick from authorized residuos per operador
# Usage: res_id_for OPER_NUM INDEX  (OPER_NUM = 1 or 2)
res_id_for() {
  local oper_num="$1" idx="$2"
  if [ "$oper_num" = "2" ]; then
    local arr_len=${#RES_IDS_OPER2[@]}
    [ "$arr_len" -eq 0 ] && echo "" && return
    echo "${RES_IDS_OPER2[$(( idx % arr_len ))]}"
  else
    local arr_len=${#RES_IDS_OPER1[@]}
    [ "$arr_len" -eq 0 ] && echo "" && return
    echo "${RES_IDS_OPER1[$(( idx % arr_len ))]}"
  fi
}

# Backward compat: default to oper 1
res_id() {
  res_id_for 1 "$1"
}

# residuos_json_2 OPER_NUM [IDX1 IDX2]
residuos_json_2() {
  local on="${1:-1}" i1="${2:-0}" i2="${3:-1}"
  echo "[
    {\"tipoResiduoId\": \"$(res_id_for $on $i1)\", \"cantidad\": $((RANDOM % 500 + 50)), \"unidad\": \"kg\", \"descripcion\": \"Residuo test A\"},
    {\"tipoResiduoId\": \"$(res_id_for $on $i2)\", \"cantidad\": $((RANDOM % 300 + 30)), \"unidad\": \"kg\", \"descripcion\": \"Residuo test B\"}
  ]"
}

# residuos_json_1 OPER_NUM [IDX]
residuos_json_1() {
  local on="${1:-1}" i1="${2:-0}"
  echo "[
    {\"tipoResiduoId\": \"$(res_id_for $on $i1)\", \"cantidad\": $((RANDOM % 400 + 100)), \"unidad\": \"kg\", \"descripcion\": \"Residuo test\"}
  ]"
}


# ===============================================================
#  PHASE 3: Create 20 manifiestos (stress burst, 0.5s apart)
# ===============================================================

section "PHASE 3: Rapid Creation of 20 Manifiestos"

echo -e "  Creating 20 manifiestos with 0.5s intervals (burst test)..."
echo ""

# Manifiestos 1-5: Full cycle (will go to TRATADO)
# Each created by the corresponding generador's token

subsection "Batch 1: 5 manifiestos for FULL CYCLE (-> TRATADO)"
create_manifiesto "$GEN1_TOKEN" "$GEN_ID_1" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_2 1 0 1)" "Full cycle #1 Quimica->TRANS1->OPER1"
M1="$LAST_CREATED_ID"; [ -n "$M1" ] && echo -e "  ${GREEN}OK${NC} #1 ${M1:0:12}..." || fail "Create #1"
sleep 0.5
create_manifiesto "$GEN2_TOKEN" "$GEN_ID_2" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_2 1 1 2)" "Full cycle #2 Petroquim->TRANS1->OPER1"
M2="$LAST_CREATED_ID"; [ -n "$M2" ] && echo -e "  ${GREEN}OK${NC} #2 ${M2:0:12}..." || fail "Create #2"
sleep 0.5
create_manifiesto "$GEN3_TOKEN" "$GEN_ID_3" "$TRANS_ID_2" "$OPER_ID_2" "$(residuos_json_2 2 0 1)" "Full cycle #3 Lab->TRANS2->OPER2"
M3="$LAST_CREATED_ID"; [ -n "$M3" ] && echo -e "  ${GREEN}OK${NC} #3 ${M3:0:12}..." || fail "Create #3"
sleep 0.5
create_manifiesto "$GEN1_TOKEN" "$GEN_ID_1" "$TRANS_ID_2" "$OPER_ID_2" "$(residuos_json_2 2 1 2)" "Full cycle #4 Quimica->TRANS2->OPER2"
M4="$LAST_CREATED_ID"; [ -n "$M4" ] && echo -e "  ${GREEN}OK${NC} #4 ${M4:0:12}..." || fail "Create #4"
sleep 0.5
create_manifiesto "$GEN2_TOKEN" "$GEN_ID_2" "$TRANS_ID_1" "$OPER_ID_2" "$(residuos_json_2 2 0 2)" "Full cycle #5 Petroquim->TRANS1->OPER2"
M5="$LAST_CREATED_ID"; [ -n "$M5" ] && echo -e "  ${GREEN}OK${NC} #5 ${M5:0:12}..." || fail "Create #5"
sleep 0.5

subsection "Batch 2: 5 manifiestos for EN_TRANSITO (GPS trails)"
create_manifiesto "$GEN1_TOKEN" "$GEN_ID_1" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_2 1 0 1)" "En transito #6 Ruta A"
M6="$LAST_CREATED_ID"; [ -n "$M6" ] && echo -e "  ${GREEN}OK${NC} #6 ${M6:0:12}..." || fail "Create #6"
sleep 0.5
create_manifiesto "$GEN1_TOKEN" "$GEN_ID_1" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_2 1 1 2)" "En transito #7 Ruta A-bis"
M7="$LAST_CREATED_ID"; [ -n "$M7" ] && echo -e "  ${GREEN}OK${NC} #7 ${M7:0:12}..." || fail "Create #7"
sleep 0.5
create_manifiesto "$GEN2_TOKEN" "$GEN_ID_2" "$TRANS_ID_2" "$OPER_ID_2" "$(residuos_json_2 2 0 1)" "En transito #8 Ruta B"
M8="$LAST_CREATED_ID"; [ -n "$M8" ] && echo -e "  ${GREEN}OK${NC} #8 ${M8:0:12}..." || fail "Create #8"
sleep 0.5
create_manifiesto "$GEN2_TOKEN" "$GEN_ID_2" "$TRANS_ID_2" "$OPER_ID_2" "$(residuos_json_2 2 1 2)" "En transito #9 Ruta B-bis"
M9="$LAST_CREATED_ID"; [ -n "$M9" ] && echo -e "  ${GREEN}OK${NC} #9 ${M9:0:12}..." || fail "Create #9"
sleep 0.5
create_manifiesto "$GEN3_TOKEN" "$GEN_ID_3" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_2 1 0 2)" "En transito #10 Ruta C"
M10="$LAST_CREATED_ID"; [ -n "$M10" ] && echo -e "  ${GREEN}OK${NC} #10 ${M10:0:12}..." || fail "Create #10"
sleep 0.5

subsection "Batch 3: 3 manifiestos for RECIBIDO"
create_manifiesto "$GEN1_TOKEN" "$GEN_ID_1" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_2 1 0 2)" "Recibido #11"
M11="$LAST_CREATED_ID"; [ -n "$M11" ] && echo -e "  ${GREEN}OK${NC} #11 ${M11:0:12}..." || fail "Create #11"
sleep 0.5
create_manifiesto "$GEN2_TOKEN" "$GEN_ID_2" "$TRANS_ID_2" "$OPER_ID_2" "$(residuos_json_2 2 0 1)" "Recibido #12"
M12="$LAST_CREATED_ID"; [ -n "$M12" ] && echo -e "  ${GREEN}OK${NC} #12 ${M12:0:12}..." || fail "Create #12"
sleep 0.5
create_manifiesto "$GEN3_TOKEN" "$GEN_ID_3" "$TRANS_ID_1" "$OPER_ID_2" "$(residuos_json_2 2 0 1)" "Recibido #13"
M13="$LAST_CREATED_ID"; [ -n "$M13" ] && echo -e "  ${GREEN}OK${NC} #13 ${M13:0:12}..." || fail "Create #13"
sleep 0.5

subsection "Batch 4: 2 manifiestos for RECHAZADO"
create_manifiesto "$GEN1_TOKEN" "$GEN_ID_1" "$TRANS_ID_2" "$OPER_ID_1" "$(residuos_json_2 1 0 1)" "Rechazado #14"
M14="$LAST_CREATED_ID"; [ -n "$M14" ] && echo -e "  ${GREEN}OK${NC} #14 ${M14:0:12}..." || fail "Create #14"
sleep 0.5
create_manifiesto "$GEN2_TOKEN" "$GEN_ID_2" "$TRANS_ID_1" "$OPER_ID_2" "$(residuos_json_1 2 0)" "Rechazado #15"
M15="$LAST_CREATED_ID"; [ -n "$M15" ] && echo -e "  ${GREEN}OK${NC} #15 ${M15:0:12}..." || fail "Create #15"
sleep 0.5

subsection "Batch 5: 5 manifiestos for BORRADOR (stress padding)"
create_manifiesto "$ADMIN_TOKEN" "$GEN_ID_1" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_1 1 0)" "Borrador padding #16"
M16="$LAST_CREATED_ID"; [ -n "$M16" ] && echo -e "  ${GREEN}OK${NC} #16" || fail "Create #16"
sleep 0.5
create_manifiesto "$ADMIN_TOKEN" "$GEN_ID_2" "$TRANS_ID_2" "$OPER_ID_2" "$(residuos_json_1 2 0)" "Borrador padding #17"
M17="$LAST_CREATED_ID"; [ -n "$M17" ] && echo -e "  ${GREEN}OK${NC} #17" || fail "Create #17"
sleep 0.5
create_manifiesto "$ADMIN_TOKEN" "$GEN_ID_3" "$TRANS_ID_1" "$OPER_ID_2" "$(residuos_json_1 2 1)" "Borrador padding #18"
M18="$LAST_CREATED_ID"; [ -n "$M18" ] && echo -e "  ${GREEN}OK${NC} #18" || fail "Create #18"
sleep 0.5
create_manifiesto "$ADMIN_TOKEN" "$GEN_ID_1" "$TRANS_ID_2" "$OPER_ID_1" "$(residuos_json_1 1 1)" "Borrador padding #19"
M19="$LAST_CREATED_ID"; [ -n "$M19" ] && echo -e "  ${GREEN}OK${NC} #19" || fail "Create #19"
sleep 0.5
create_manifiesto "$ADMIN_TOKEN" "$GEN_ID_2" "$TRANS_ID_1" "$OPER_ID_1" "$(residuos_json_1 1 2)" "Borrador padding #20"
M20="$LAST_CREATED_ID"; [ -n "$M20" ] && echo -e "  ${GREEN}OK${NC} #20" || fail "Create #20"

echo ""
echo -e "  Total created: ${BOLD}$MANIFIESTOS_CREATED/20${NC}"
if [ "$MANIFIESTOS_CREATED" -ge 15 ]; then
  pass "Burst creation: $MANIFIESTOS_CREATED manifiestos created"
else
  fail "Burst creation: only $MANIFIESTOS_CREATED/20 created"
fi


# ===============================================================
#  PHASE 4: Full lifecycle x5 (BORRADOR -> TRATADO + blockchain)
# ===============================================================

section "PHASE 4: Full Lifecycle x5 (BORRADOR -> TRATADO)"

full_lifecycle() {
  local MID=$1
  local LABEL=$2
  local GEN_TOKEN_=$3
  local TRANS_TOKEN_=$4
  local OPER_TOKEN_=$5
  local OK=0

  echo -e "  ${MAGENTA}[$LABEL]${NC} ${MID:0:12}..."

  # BORRADOR -> APROBADO (firmar)
  if transition_manifiesto "$MID" "firmar" "$GEN_TOKEN_"; then
    echo -e "    ${GREEN}+${NC} APROBADO (firmado)"
    OK=$((OK + 1))
  else
    echo -e "    ${RED}x${NC} firmar failed"
    return 1
  fi
  sleep 0.5

  # APROBADO -> EN_TRANSITO (confirmar-retiro)
  local RETIRO_BODY='{"latitud": -32.8932, "longitud": -68.8454, "observaciones": "Retiro test stress"}'
  if transition_manifiesto "$MID" "confirmar-retiro" "$TRANS_TOKEN_" "$RETIRO_BODY"; then
    echo -e "    ${GREEN}+${NC} EN_TRANSITO (retiro confirmado)"
    OK=$((OK + 1))
  else
    echo -e "    ${RED}x${NC} confirmar-retiro failed"
    return 1
  fi
  sleep 0.3

  # GPS: 3 quick points
  send_gps "$MID" "$TRANS_TOKEN_" -32.8950 -68.8430 45 180
  send_gps "$MID" "$TRANS_TOKEN_" -32.9050 -68.8470 52 175
  send_gps "$MID" "$TRANS_TOKEN_" -32.9200 -68.8510 38 170
  sleep 0.3

  # EN_TRANSITO -> ENTREGADO (confirmar-entrega)
  local ENTREGA_BODY='{"latitud": -33.0312, "longitud": -68.8745, "observaciones": "Entrega test stress"}'
  if transition_manifiesto "$MID" "confirmar-entrega" "$TRANS_TOKEN_" "$ENTREGA_BODY"; then
    echo -e "    ${GREEN}+${NC} ENTREGADO"
    OK=$((OK + 1))
  else
    echo -e "    ${RED}x${NC} confirmar-entrega failed"
    return 1
  fi
  sleep 0.3

  # ENTREGADO -> RECIBIDO (confirmar-recepcion)
  local RECEPCION_BODY='{"observaciones": "Carga recibida correctamente - stress test", "pesoReal": 148.5}'
  if transition_manifiesto "$MID" "confirmar-recepcion" "$OPER_TOKEN_" "$RECEPCION_BODY"; then
    echo -e "    ${GREEN}+${NC} RECIBIDO"
    OK=$((OK + 1))
  else
    echo -e "    ${RED}x${NC} confirmar-recepcion failed"
    return 1
  fi
  sleep 0.3

  # RECIBIDO -> EN_TRATAMIENTO (tratamiento)
  local TRAT_BODY='{"metodoTratamiento": "Incineracion controlada", "observaciones": "Tratamiento stress test"}'
  if transition_manifiesto "$MID" "tratamiento" "$OPER_TOKEN_" "$TRAT_BODY"; then
    echo -e "    ${GREEN}+${NC} EN_TRATAMIENTO"
    OK=$((OK + 1))
  else
    echo -e "    ${RED}x${NC} tratamiento failed"
    return 1
  fi
  sleep 0.5

  # EN_TRATAMIENTO -> TRATADO (cerrar)
  local CIERRE_BODY='{"metodoTratamiento": "Incineracion controlada a 1200C", "observaciones": "Disposicion final completada - stress test"}'
  if transition_manifiesto "$MID" "cerrar" "$OPER_TOKEN_" "$CIERRE_BODY"; then
    echo -e "    ${GREEN}+${NC} TRATADO (cerrado)"
    OK=$((OK + 1))
    TRATADO_IDS+=("$MID")
  else
    echo -e "    ${RED}x${NC} cerrar failed"
    return 1
  fi

  if [ "$OK" -eq 6 ]; then
    pass "$LABEL: Full lifecycle complete (6/6 transitions)"
    return 0
  else
    fail "$LABEL: Incomplete lifecycle ($OK/6 transitions)"
    return 1
  fi
}

# Run 5 full lifecycles with proper role tokens
# M1: GEN1 -> TRANS1 -> OPER1
[ -n "$M1" ] && full_lifecycle "$M1" "Ciclo 1" "$GEN1_TOKEN" "$TRANS1_TOKEN" "$OPER1_TOKEN"
sleep 1

# M2: GEN2 -> TRANS1 -> OPER1
[ -n "$M2" ] && full_lifecycle "$M2" "Ciclo 2" "$GEN2_TOKEN" "$TRANS1_TOKEN" "$OPER1_TOKEN"
sleep 1

# M3: GEN3 -> TRANS2 -> OPER2
[ -n "$M3" ] && full_lifecycle "$M3" "Ciclo 3" "$GEN3_TOKEN" "$TRANS2_TOKEN" "$OPER2_TOKEN"
sleep 1

# M4: GEN1 -> TRANS2 -> OPER2
[ -n "$M4" ] && full_lifecycle "$M4" "Ciclo 4" "$GEN1_TOKEN" "$TRANS2_TOKEN" "$OPER2_TOKEN"
sleep 1

# M5: GEN2 -> TRANS1 -> OPER2
[ -n "$M5" ] && full_lifecycle "$M5" "Ciclo 5" "$GEN2_TOKEN" "$TRANS1_TOKEN" "$OPER2_TOKEN"
sleep 1

echo ""
echo -e "  TRATADO IDs: ${BOLD}${#TRATADO_IDS[@]}/5${NC}"


# ===============================================================
#  PHASE 5: Partial lifecycle x5 (leave EN_TRANSITO with GPS)
# ===============================================================

section "PHASE 5: 5 Manifiestos -> EN_TRANSITO with GPS Trails"

advance_to_transito() {
  local MID=$1
  local LABEL=$2
  local GEN_TOKEN_=$3
  local TRANS_TOKEN_=$4

  echo -e "  ${MAGENTA}[$LABEL]${NC} ${MID:0:12}..."

  # Firmar
  if transition_manifiesto "$MID" "firmar" "$GEN_TOKEN_"; then
    echo -e "    ${GREEN}+${NC} APROBADO"
  else
    echo -e "    ${RED}x${NC} firmar failed"; return 1
  fi
  sleep 0.3

  # Confirmar retiro
  local RETIRO='{"latitud": -32.8932, "longitud": -68.8454, "observaciones": "Retiro para GPS trail"}'
  if transition_manifiesto "$MID" "confirmar-retiro" "$TRANS_TOKEN_" "$RETIRO"; then
    echo -e "    ${GREEN}+${NC} EN_TRANSITO"
    EN_TRANSITO_IDS+=("$MID")
  else
    echo -e "    ${RED}x${NC} confirmar-retiro failed"; return 1
  fi
}

send_route_a() {
  local MID=$1 TOKEN=$2 OK=0
  for i in $(seq 0 $((${#RUTA_A_LATS[@]} - 1))); do
    send_gps "$MID" "$TOKEN" "${RUTA_A_LATS[$i]}" "${RUTA_A_LONS[$i]}" $((35 + RANDOM % 30)) $((170 + RANDOM % 20)) && OK=$((OK + 1))
    sleep 0.3
  done
  echo -e "    ${GREEN}+${NC} GPS trail: $OK/${#RUTA_A_LATS[@]} points (Ruta A)"
}

send_route_b() {
  local MID=$1 TOKEN=$2 OK=0
  for i in $(seq 0 $((${#RUTA_B_LATS[@]} - 1))); do
    send_gps "$MID" "$TOKEN" "${RUTA_B_LATS[$i]}" "${RUTA_B_LONS[$i]}" $((35 + RANDOM % 30)) $((170 + RANDOM % 20)) && OK=$((OK + 1))
    sleep 0.3
  done
  echo -e "    ${GREEN}+${NC} GPS trail: $OK/${#RUTA_B_LATS[@]} points (Ruta B)"
}

send_route_c() {
  local MID=$1 TOKEN=$2 OK=0
  for i in $(seq 0 $((${#RUTA_C_LATS[@]} - 1))); do
    send_gps "$MID" "$TOKEN" "${RUTA_C_LATS[$i]}" "${RUTA_C_LONS[$i]}" $((35 + RANDOM % 30)) $((170 + RANDOM % 20)) && OK=$((OK + 1))
    sleep 0.3
  done
  echo -e "    ${GREEN}+${NC} GPS trail: $OK/${#RUTA_C_LATS[@]} points (Ruta C)"
}

# M6: GEN1 -> TRANS1, Ruta A
if [ -n "$M6" ]; then
  advance_to_transito "$M6" "Transito 6" "$GEN1_TOKEN" "$TRANS1_TOKEN"
  send_route_a "$M6" "$TRANS1_TOKEN"
fi
sleep 0.5

# M7: GEN1 -> TRANS1, Ruta A (partial — first 6 points)
if [ -n "$M7" ]; then
  advance_to_transito "$M7" "Transito 7" "$GEN1_TOKEN" "$TRANS1_TOKEN"
  for i in 0 1 2 3 4 5; do
    send_gps "$M7" "$TRANS1_TOKEN" "${RUTA_A_LATS[$i]}" "${RUTA_A_LONS[$i]}" $((40 + RANDOM % 20)) 178
    sleep 0.2
  done
  echo -e "    ${GREEN}+${NC} GPS trail: 6 points (Ruta A partial)"
fi
sleep 0.5

# M8: GEN2 -> TRANS2, Ruta B
if [ -n "$M8" ]; then
  advance_to_transito "$M8" "Transito 8" "$GEN2_TOKEN" "$TRANS2_TOKEN"
  send_route_b "$M8" "$TRANS2_TOKEN"
fi
sleep 0.5

# M9: GEN2 -> TRANS2, Ruta B (partial — first 5 points)
if [ -n "$M9" ]; then
  advance_to_transito "$M9" "Transito 9" "$GEN2_TOKEN" "$TRANS2_TOKEN"
  for i in 0 1 2 3 4; do
    send_gps "$M9" "$TRANS2_TOKEN" "${RUTA_B_LATS[$i]}" "${RUTA_B_LONS[$i]}" $((45 + RANDOM % 25)) 175
    sleep 0.2
  done
  echo -e "    ${GREEN}+${NC} GPS trail: 5 points (Ruta B partial)"
fi
sleep 0.5

# M10: GEN3 -> TRANS1, Ruta C
if [ -n "$M10" ]; then
  advance_to_transito "$M10" "Transito 10" "$GEN3_TOKEN" "$TRANS1_TOKEN"
  send_route_c "$M10" "$TRANS1_TOKEN"
fi

echo ""
echo -e "  EN_TRANSITO: ${BOLD}${#EN_TRANSITO_IDS[@]}/5${NC} | GPS points sent: ${BOLD}$GPS_SENT${NC}"
if [ "${#EN_TRANSITO_IDS[@]}" -ge 4 ]; then
  pass "EN_TRANSITO batch: ${#EN_TRANSITO_IDS[@]} manifiestos with GPS trails"
else
  fail "EN_TRANSITO batch: only ${#EN_TRANSITO_IDS[@]}/5 succeeded"
fi


# ===============================================================
#  PHASE 6: Mid-lifecycle x3 (leave in RECIBIDO)
# ===============================================================

section "PHASE 6: 3 Manifiestos -> RECIBIDO"

advance_to_recibido() {
  local MID=$1
  local LABEL=$2
  local GEN_TOKEN_=$3
  local TRANS_TOKEN_=$4
  local OPER_TOKEN_=$5

  echo -e "  ${MAGENTA}[$LABEL]${NC} ${MID:0:12}..."

  transition_manifiesto "$MID" "firmar" "$GEN_TOKEN_" || { echo -e "    ${RED}x${NC} firmar failed"; return 1; }
  sleep 0.3
  transition_manifiesto "$MID" "confirmar-retiro" "$TRANS_TOKEN_" '{"latitud":-32.89,"longitud":-68.84}' || { echo -e "    ${RED}x${NC} retiro failed"; return 1; }
  sleep 0.3
  # Quick GPS
  send_gps "$MID" "$TRANS_TOKEN_" -32.9100 -68.8400 50 180
  send_gps "$MID" "$TRANS_TOKEN_" -32.9500 -68.8550 45 175
  sleep 0.3
  transition_manifiesto "$MID" "confirmar-entrega" "$TRANS_TOKEN_" '{"latitud":-33.03,"longitud":-68.87}' || { echo -e "    ${RED}x${NC} entrega failed"; return 1; }
  sleep 0.3
  transition_manifiesto "$MID" "confirmar-recepcion" "$OPER_TOKEN_" '{"observaciones":"Recibido stress test","pesoReal":145.0}' || { echo -e "    ${RED}x${NC} recepcion failed"; return 1; }

  echo -e "    ${GREEN}+${NC} BORRADOR -> APROBADO -> EN_TRANSITO -> ENTREGADO -> RECIBIDO"
  RECIBIDO_IDS+=("$MID")
  pass "$LABEL: Advanced to RECIBIDO"
}

[ -n "$M11" ] && advance_to_recibido "$M11" "Recibido 11" "$GEN1_TOKEN" "$TRANS1_TOKEN" "$OPER1_TOKEN"
sleep 0.5
[ -n "$M12" ] && advance_to_recibido "$M12" "Recibido 12" "$GEN2_TOKEN" "$TRANS2_TOKEN" "$OPER2_TOKEN"
sleep 0.5
[ -n "$M13" ] && advance_to_recibido "$M13" "Recibido 13" "$GEN3_TOKEN" "$TRANS1_TOKEN" "$OPER2_TOKEN"

echo ""
echo -e "  RECIBIDO: ${BOLD}${#RECIBIDO_IDS[@]}/3${NC}"


# ===============================================================
#  PHASE 7: Rechazo x2 (ENTREGADO -> RECHAZADO)
# ===============================================================

section "PHASE 7: 2 Manifiestos -> RECHAZADO"

advance_to_rechazado() {
  local MID=$1
  local LABEL=$2
  local GEN_TOKEN_=$3
  local TRANS_TOKEN_=$4
  local OPER_TOKEN_=$5

  echo -e "  ${MAGENTA}[$LABEL]${NC} ${MID:0:12}..."

  transition_manifiesto "$MID" "firmar" "$GEN_TOKEN_" || { echo -e "    ${RED}x${NC} firmar failed"; return 1; }
  sleep 0.3
  transition_manifiesto "$MID" "confirmar-retiro" "$TRANS_TOKEN_" '{"latitud":-32.89,"longitud":-68.84}' || { echo -e "    ${RED}x${NC} retiro failed"; return 1; }
  sleep 0.3
  send_gps "$MID" "$TRANS_TOKEN_" -32.9200 -68.8400 55 180
  sleep 0.2
  transition_manifiesto "$MID" "confirmar-entrega" "$TRANS_TOKEN_" '{"latitud":-33.03,"longitud":-68.87}' || { echo -e "    ${RED}x${NC} entrega failed"; return 1; }
  sleep 0.3
  transition_manifiesto "$MID" "rechazar" "$OPER_TOKEN_" '{"motivo":"Carga no coincide con manifiesto - stress test","observaciones":"Rechazo por discrepancia"}' || { echo -e "    ${RED}x${NC} rechazar failed"; return 1; }

  echo -e "    ${GREEN}+${NC} BORRADOR -> APROBADO -> EN_TRANSITO -> ENTREGADO -> RECHAZADO"
  RECHAZADO_IDS+=("$MID")
  pass "$LABEL: Advanced to RECHAZADO"
}

[ -n "$M14" ] && advance_to_rechazado "$M14" "Rechazo 14" "$GEN1_TOKEN" "$TRANS2_TOKEN" "$OPER1_TOKEN"
sleep 0.5
[ -n "$M15" ] && advance_to_rechazado "$M15" "Rechazo 15" "$GEN2_TOKEN" "$TRANS1_TOKEN" "$OPER2_TOKEN"

echo ""
echo -e "  RECHAZADO: ${BOLD}${#RECHAZADO_IDS[@]}/2${NC}"


# ===============================================================
#  PHASE 8: Incidents & GPS anomalies
# ===============================================================

section "PHASE 8: Incidents & GPS Anomalies"

# Incidents on EN_TRANSITO manifiestos
if [ "${#EN_TRANSITO_IDS[@]}" -ge 3 ]; then
  INC_M6="${EN_TRANSITO_IDS[0]}"  # M6
  INC_M8="${EN_TRANSITO_IDS[2]}"  # M8 (if TRANS2)
  INC_M10=""
  [ "${#EN_TRANSITO_IDS[@]}" -ge 5 ] && INC_M10="${EN_TRANSITO_IDS[4]}"  # M10

  subsection "Incident: Averia on #6"
  AVERIA_BODY='{"tipo":"averia","descripcion":"Pinchazo neumatico delantero derecho en Ruta 40","latitud":-32.9400,"longitud":-68.8450}'
  AVERIA_RESP=$(api_call "POST" "/manifiestos/$INC_M6/incidente" "$TRANS1_TOKEN" "$AVERIA_BODY")
  if check_success "$AVERIA_RESP"; then
    pass "Incidente averia registrado en #6"
    INCIDENTS_SENT=$((INCIDENTS_SENT + 1))
  else
    fail "Incidente averia en #6"
  fi

  subsection "Incident: Derrame on #6"
  DERRAME_BODY='{"tipo":"derrame","descripcion":"Derrame menor de liquido contenedor 2 - contenido","latitud":-32.9420,"longitud":-68.8455}'
  DERRAME_RESP=$(api_call "POST" "/manifiestos/$INC_M6/incidente" "$TRANS1_TOKEN" "$DERRAME_BODY")
  if check_success "$DERRAME_RESP"; then
    pass "Incidente derrame registrado en #6"
    INCIDENTS_SENT=$((INCIDENTS_SENT + 1))
  else
    fail "Incidente derrame en #6"
  fi

  subsection "Incident: Pausa + Reanudacion on #8"
  PAUSA_BODY='{"tipo":"PAUSA","descripcion":"Pausa por control policial Ruta 7","latitud":-32.9600,"longitud":-68.8550}'
  PAUSA_RESP=$(api_call "POST" "/manifiestos/$INC_M8/incidente" "$TRANS2_TOKEN" "$PAUSA_BODY")
  if check_success "$PAUSA_RESP"; then
    pass "Pausa registrada en #8"
    INCIDENTS_SENT=$((INCIDENTS_SENT + 1))
  else
    fail "Pausa en #8"
  fi
  sleep 1

  REANUDA_BODY='{"tipo":"REANUDACION","descripcion":"Reanudacion tras control","latitud":-32.9610,"longitud":-68.8555}'
  REANUDA_RESP=$(api_call "POST" "/manifiestos/$INC_M8/incidente" "$TRANS2_TOKEN" "$REANUDA_BODY")
  if check_success "$REANUDA_RESP"; then
    pass "Reanudacion registrada en #8"
    INCIDENTS_SENT=$((INCIDENTS_SENT + 1))
  else
    fail "Reanudacion en #8"
  fi

  subsection "GPS Anomaly: Route deviation on #10"
  if [ -n "$INC_M10" ]; then
    # Send GPS far off route (deviation to -69.10)
    send_gps "$INC_M10" "$TRANS1_TOKEN" -32.9500 -69.1000 60 270
    echo -e "  ${GREEN}+${NC} Deviation GPS point sent (lon -69.10 vs normal -68.85)"
    pass "GPS deviation sent on #10"
  else
    warn "Not enough EN_TRANSITO for deviation test"
  fi

  subsection "GPS Anomaly: Extreme speed on #9"
  if [ "${#EN_TRANSITO_IDS[@]}" -ge 4 ]; then
    INC_M9="${EN_TRANSITO_IDS[3]}"
    # Send GPS with 150 km/h
    send_gps "$INC_M9" "$TRANS2_TOKEN" -32.9300 -68.8350 150 180
    echo -e "  ${GREEN}+${NC} Extreme speed GPS point sent (150 km/h)"
    pass "GPS extreme speed sent on #9"
  else
    warn "Not enough EN_TRANSITO for speed anomaly test"
  fi

else
  warn "Not enough EN_TRANSITO manifiestos for incidents (need 3, have ${#EN_TRANSITO_IDS[@]})"
fi

echo ""
echo -e "  Incidents sent: ${BOLD}$INCIDENTS_SENT${NC}"


# ===============================================================
#  PHASE 9: Blockchain verification (5 TRATADO)
# ===============================================================

section "PHASE 9: Blockchain Integrity Verification"

if [ "${#TRATADO_IDS[@]}" -gt 0 ]; then
  BC_OK=0
  BC_FAIL=0

  for TID in "${TRATADO_IDS[@]}"; do
    subsection "Verify blockchain: ${TID:0:12}..."

    # Check blockchain status
    BC_RESP=$(api_call "GET" "/blockchain/manifiesto/$TID" "$ADMIN_TOKEN")
    BC_STATUS=$(echo "$BC_RESP" | json_extract "data.status")
    GENESIS_HASH=$(echo "$BC_RESP" | json_extract "data.sellos.0.hash")

    if [ -n "$GENESIS_HASH" ] && [ "$GENESIS_HASH" != "" ]; then
      echo -e "    ${GREEN}+${NC} Genesis hash: ${GENESIS_HASH:0:16}..."
      BC_OK=$((BC_OK + 1))
    else
      echo -e "    ${YELLOW}~${NC} No genesis hash yet (may be async)"
    fi

    # Check integrity
    INTEGRITY_RESP=$(api_call "GET" "/blockchain/verificar-integridad/$TID" "$ADMIN_TOKEN")
    INTEGRITY=$(echo "$INTEGRITY_RESP" | json_extract "data.integridad")

    if [ "$INTEGRITY" = "COMPLETA" ]; then
      echo -e "    ${GREEN}+${NC} Integridad: COMPLETA"
      BC_OK=$((BC_OK + 1))
    elif [ "$INTEGRITY" = "PARCIAL" ]; then
      echo -e "    ${YELLOW}~${NC} Integridad: PARCIAL (cierre puede estar pendiente)"
      BC_OK=$((BC_OK + 1))
    else
      echo -e "    ${YELLOW}~${NC} Integridad: ${INTEGRITY:-desconocida}"
    fi
    sleep 0.5
  done

  if [ "$BC_OK" -gt 0 ]; then
    pass "Blockchain: $BC_OK verifications passed across ${#TRATADO_IDS[@]} manifiestos"
  else
    warn "Blockchain: No verifications passed (sellos may be async/pending)"
  fi

  # Batch verification
  subsection "Batch integrity verification"
  BATCH_RESP=$(api_call "GET" "/blockchain/verificar-lote?estado=TRATADO" "$ADMIN_TOKEN")
  BATCH_SUCCESS=$(echo "$BATCH_RESP" | json_extract "success")
  if [ "$BATCH_SUCCESS" = "True" ] || [ "$BATCH_SUCCESS" = "true" ]; then
    BATCH_TOTAL=$(echo "$BATCH_RESP" | json_extract "data.total")
    pass "Batch verification OK (total: ${BATCH_TOTAL:-?} manifiestos)"
  else
    warn "Batch verification response unexpected"
  fi

else
  warn "No TRATADO manifiestos for blockchain verification"
fi


# ===============================================================
#  PHASE 10: Stress burst — concurrent GPS
# ===============================================================

section "PHASE 10: GPS Stress Burst (Concurrent Requests)"

if [ "${#EN_TRANSITO_IDS[@]}" -ge 3 ]; then
  echo -e "  Sending ${BOLD}3 rounds${NC} of concurrent GPS updates..."
  echo -e "  ${#EN_TRANSITO_IDS[@]} manifiestos x 3 rounds = $((${#EN_TRANSITO_IDS[@]} * 3)) concurrent requests"
  echo ""

  BURST_OK=0
  BURST_FAIL=0

  for ROUND in 1 2 3; do
    echo -n "  Round $ROUND: "
    # Assign tokens based on which transportista owns the manifesto
    ROUND_PIDS=()
    for idx in "${!EN_TRANSITO_IDS[@]}"; do
      local_mid="${EN_TRANSITO_IDS[$idx]}"
      # M6,M7,M10 use TRANS1, M8,M9 use TRANS2
      if [ "$idx" -le 1 ] || [ "$idx" -eq 4 ]; then
        local_token="$TRANS1_TOKEN"
      else
        local_token="$TRANS2_TOKEN"
      fi
      # Slight lat variation per round
      local_lat=$(python3 -c "print(-32.92 - 0.01 * $ROUND - 0.001 * $idx)")
      local_lon=$(python3 -c "print(-68.84 - 0.005 * $ROUND - 0.001 * $idx)")
      local_speed=$((40 + RANDOM % 30))

      $CURL -s -o /dev/null -w '%{http_code}' -X POST "${API}/manifiestos/${local_mid}/ubicacion" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $local_token" \
        -d "{\"latitud\": $local_lat, \"longitud\": $local_lon, \"velocidad\": $local_speed, \"direccion\": 180}" &
      ROUND_PIDS+=($!)
    done

    # Wait for all concurrent requests
    ROUND_OK=0
    for PID in "${ROUND_PIDS[@]}"; do
      if wait "$PID"; then
        ROUND_OK=$((ROUND_OK + 1))
      fi
    done
    BURST_OK=$((BURST_OK + ROUND_OK))
    GPS_SENT=$((GPS_SENT + ROUND_OK))
    echo -e "${GREEN}$ROUND_OK/${#EN_TRANSITO_IDS[@]}${NC} OK"

    sleep 0.2
  done

  BURST_TOTAL=$((${#EN_TRANSITO_IDS[@]} * 3))
  if [ "$BURST_OK" -ge "$BURST_TOTAL" ]; then
    pass "Stress burst: $BURST_OK/$BURST_TOTAL concurrent GPS requests succeeded"
  elif [ "$BURST_OK" -gt 0 ]; then
    warn "Stress burst: $BURST_OK/$BURST_TOTAL concurrent GPS requests succeeded"
  else
    fail "Stress burst: all concurrent GPS requests failed"
  fi
else
  warn "Not enough EN_TRANSITO manifiestos for stress burst"
fi


# ===============================================================
#  PHASE 11: Validate dashboard, reportes, alertas
# ===============================================================

section "PHASE 11: Validate Dashboard, Reportes, Alertas"

subsection "Dashboard Stats"
DASH_RESP=$(api_call "GET" "/manifiestos/dashboard" "$ADMIN_TOKEN")
DASH_EN_TRANSITO=$(echo "$DASH_RESP" | json_extract "data.estadisticas.enTransito")
DASH_TRATADOS=$(echo "$DASH_RESP" | json_extract "data.estadisticas.tratados")
DASH_TOTAL=$(echo "$DASH_RESP" | json_extract "data.estadisticas.total")

echo -e "  En Transito: ${BOLD}${DASH_EN_TRANSITO:-?}${NC}"
echo -e "  Tratados: ${BOLD}${DASH_TRATADOS:-?}${NC}"
echo -e "  Total: ${BOLD}${DASH_TOTAL:-?}${NC}"

if [ -n "$DASH_TOTAL" ] && [ "$DASH_TOTAL" != "0" ] && [ "$DASH_TOTAL" != "" ]; then
  pass "Dashboard stats accessible"
else
  fail "Dashboard stats not accessible"
fi

subsection "Reportes"
REPORTE_STATUS=$(api_status "GET" "/reportes/manifiestos?fechaInicio=2026-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN")
if [ "$REPORTE_STATUS" = "200" ]; then
  pass "Reportes manifiestos OK (HTTP 200)"
else
  fail "Reportes manifiestos failed (HTTP $REPORTE_STATUS)"
fi

TRATADOS_STATUS=$(api_status "GET" "/reportes/tratados?fechaInicio=2026-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN")
if [ "$TRATADOS_STATUS" = "200" ]; then
  pass "Reportes tratados OK (HTTP 200)"
else
  fail "Reportes tratados failed (HTTP $TRATADOS_STATUS)"
fi

TRANSPORTE_STATUS=$(api_status "GET" "/reportes/transporte?fechaInicio=2026-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN")
if [ "$TRANSPORTE_STATUS" = "200" ]; then
  pass "Reportes transporte OK (HTTP 200)"
else
  fail "Reportes transporte failed (HTTP $TRANSPORTE_STATUS)"
fi

subsection "Centro de Control"
CC_STATUS=$(api_status "GET" "/centro-control/actividad?fechaDesde=2026-01-01&fechaHasta=2026-12-31&capas=generadores,transportistas,operadores,transito" "$ADMIN_TOKEN")
if [ "$CC_STATUS" = "200" ]; then
  pass "Centro de Control OK (HTTP 200)"
else
  fail "Centro de Control failed (HTTP $CC_STATUS)"
fi

subsection "Analytics"
ANALYTICS_OK=0
for ENDPOINT in "manifiestos-por-mes" "manifiestos-por-estado" "residuos-por-tipo" "tiempo-promedio"; do
  STATUS=$(api_status "GET" "/analytics/$ENDPOINT" "$ADMIN_TOKEN")
  if [ "$STATUS" = "200" ]; then
    ANALYTICS_OK=$((ANALYTICS_OK + 1))
  fi
done
if [ "$ANALYTICS_OK" -eq 4 ]; then
  pass "Analytics: 4/4 endpoints OK"
else
  fail "Analytics: $ANALYTICS_OK/4 endpoints OK"
fi

subsection "Blockchain Registry"
BC_REG_STATUS=$(api_status "GET" "/blockchain/registro?page=1&limit=10" "$ADMIN_TOKEN")
if [ "$BC_REG_STATUS" = "200" ]; then
  pass "Blockchain registry OK (HTTP 200)"
else
  fail "Blockchain registry failed (HTTP $BC_REG_STATUS)"
fi

subsection "PDF Generation"
if [ "${#TRATADO_IDS[@]}" -gt 0 ]; then
  PDF_MID="${TRATADO_IDS[0]}"
  PDF_STATUS=$(api_status "GET" "/pdf/manifiesto/$PDF_MID" "$ADMIN_TOKEN")
  if [ "$PDF_STATUS" = "200" ]; then
    pass "PDF manifiesto generation OK"
  else
    fail "PDF manifiesto generation failed (HTTP $PDF_STATUS)"
  fi

  CERT_STATUS=$(api_status "GET" "/pdf/certificado/$PDF_MID" "$ADMIN_TOKEN")
  if [ "$CERT_STATUS" = "200" ]; then
    pass "PDF certificado generation OK"
  else
    fail "PDF certificado generation failed (HTTP $CERT_STATUS)"
  fi
else
  warn "No TRATADO IDs for PDF test"
fi

subsection "Public QR Verification"
if [ "${#ALL_NUMS[@]}" -gt 0 ]; then
  VERIFY_NUM="${ALL_NUMS[0]}"
  VERIFY_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' "$API/manifiestos/verificar/$VERIFY_NUM")
  if [ "$VERIFY_STATUS" = "200" ]; then
    pass "Public QR verification OK (numero: $VERIFY_NUM)"
  else
    fail "Public QR verification failed (HTTP $VERIFY_STATUS, numero: $VERIFY_NUM)"
  fi
else
  warn "No manifiestos for public verification"
fi


# ===============================================================
#  SUMMARY
# ===============================================================

section "SUMMARY"

echo ""
echo -e "${BOLD}Manifiestos Created: $MANIFIESTOS_CREATED/20${NC}"
echo ""

# Print manifest table
echo -e "${BOLD}  #   | Manifiesto Num       | Estado Final     | ID (short)${NC}"
echo -e "  ----|----------------------|------------------|------------"
for i in "${!ALL_IDS[@]}"; do
  NUM="${ALL_NUMS[$i]:-?}"
  STATE="${ALL_STATES[$i]:-?}"
  SHORTID="${ALL_IDS[$i]:0:12}"

  case "$STATE" in
    TRATADO)       COLOR="$GREEN" ;;
    EN_TRANSITO)   COLOR="$CYAN" ;;
    RECIBIDO)      COLOR="$BLUE" ;;
    RECHAZADO)     COLOR="$RED" ;;
    BORRADOR)      COLOR="$DIM" ;;
    *)             COLOR="$YELLOW" ;;
  esac

  printf "  %-3s | %-20s | ${COLOR}%-16s${NC} | %s\n" "$((i+1))" "$NUM" "$STATE" "$SHORTID"
done

echo ""
echo -e "${BOLD}Metrics:${NC}"
echo "  GPS points sent:        $GPS_SENT"
echo "  Incidents registered:   $INCIDENTS_SENT"
echo "  TRATADO (blockchain):   ${#TRATADO_IDS[@]} (expect 5 GENESIS + 5 CIERRE sellos)"
echo "  EN_TRANSITO (GPS):      ${#EN_TRANSITO_IDS[@]}"
echo "  RECIBIDO:               ${#RECIBIDO_IDS[@]}"
echo "  RECHAZADO:              ${#RECHAZADO_IDS[@]}"
echo ""

echo -e "${BOLD}Test Results: ${GREEN}$PASS PASS${NC} | ${RED}$FAIL FAIL${NC} | ${YELLOW}$WARN WARN${NC}"
echo ""

if [ -n "$ERRORS" ]; then
  echo -e "${RED}Errors:${NC}"
  echo -e "$ERRORS"
  echo ""
fi

if [ -n "$WARNINGS" ]; then
  echo -e "${YELLOW}Warnings:${NC}"
  echo -e "$WARNINGS"
  echo ""
fi

# UI Verification Checklist
echo -e "${BOLD}${CYAN}=================================================================${NC}"
echo -e "${BOLD}${CYAN}  UI VERIFICATION CHECKLIST${NC}"
echo -e "${BOLD}${CYAN}=================================================================${NC}"
echo ""
echo -e "  Open ${BOLD}$BASE_URL${NC} and verify:"
echo ""
echo -e "  ${BOLD}1. Dashboard${NC} ($BASE_URL/)"
echo "     [ ] KPIs show incremented counts"
echo "     [ ] 'En Transito' >= ${#EN_TRANSITO_IDS[@]}"
echo "     [ ] 'Tratados' includes ${#TRATADO_IDS[@]} new"
echo "     [ ] Recent manifiestos list shows [TEST-STRESS] entries"
echo ""
echo -e "  ${BOLD}2. Centro de Control${NC}"
echo "     [ ] ${#EN_TRANSITO_IDS[@]} active trips visible on map"
echo "     [ ] GPS trails visible (Ruta A, B, C in Mendoza)"
echo "     [ ] Pipeline funnel shows correct state distribution"
echo ""
echo -e "  ${BOLD}3. Manifiestos List${NC}"
echo "     [ ] Filter by EN_TRANSITO: shows ${#EN_TRANSITO_IDS[@]} new entries"
echo "     [ ] Filter by TRATADO: shows ${#TRATADO_IDS[@]} new with blockchain badge"
echo "     [ ] Filter by RECHAZADO: shows ${#RECHAZADO_IDS[@]} new"
echo ""
echo -e "  ${BOLD}4. Manifiesto Detail (any TRATADO)${NC}"
echo "     [ ] Timeline shows ~10 events (create, firma, retiro, GPS, entrega, recepcion, tratamiento, cierre)"
echo "     [ ] BlockchainPanel shows 2 sellos (GENESIS + CIERRE)"
echo "     [ ] Download PDF works"
echo "     [ ] Download Certificado works"
echo ""
echo -e "  ${BOLD}5. Alertas${NC}"
echo "     [ ] INCIDENTE alerts (averia, derrame)"
echo "     [ ] CAMBIO_ESTADO alerts"
echo "     [ ] RECHAZO alerts"
echo ""
echo -e "  ${BOLD}6. Admin Blockchain${NC}"
echo "     [ ] Batch verification shows TRATADO manifiestos"
echo "     [ ] Integridad: COMPLETA or PARCIAL for new entries"
echo ""
echo -e "  ${BOLD}7. Reportes${NC}"
echo "     [ ] Manifiestos tab: updated counts"
echo "     [ ] Transporte tab: 2 transportistas with activity"
echo "     [ ] Tratados tab: ${#TRATADO_IDS[@]} new entries"
echo ""
echo -e "  ${BOLD}8. PWA Mobile${NC} ($BASE_URL/app/)"
echo "     [ ] Login as transportista (transportes.andes@logistica.com / trans123)"
echo "     [ ] Dashboard shows active trips banner"
echo "     [ ] Perfil > Viaje tab shows EN_TRANSITO trips"
echo ""
echo -e "  ${BOLD}9. Public Verification${NC}"
if [ "${#ALL_NUMS[@]}" -gt 0 ]; then
  echo "     [ ] Visit: $BASE_URL/verificar/${ALL_NUMS[0]}"
fi
echo "     [ ] Scan QR from PDF download"
echo ""

# Exit code
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}ALL TESTS PASSED${NC} ($PASS pass, $WARN warnings)"
  exit 0
else
  echo -e "${RED}${BOLD}$FAIL TESTS FAILED${NC} ($PASS pass, $WARN warnings)"
  exit 1
fi
