#!/bin/bash
# ============================================================
# SITREP — Admin Advanced Test
# Covers: usuario detail, toggle-activo, jobs/vencimientos,
#         catálogo CRUD (tipos-residuos, tratamientos).
# Usage: bash backend/tests/admin-advanced-test.sh [BASE_URL]
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
  if [ "$actual" = "$expected" ]; then pass "[$actual] $label"
  else fail "[$actual != $expected] $label"; fi
}

get_token() {
  curl -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null
}

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

extract_id() {
  local resp="$1"
  echo "$resp" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    for path in ['data.usuario.id','data.tipoResiduo.id','data.tratamiento.id','data.id','id']:
        try:
            val = d
            for k in path.split('.'): val = val[k]
            if val: print(val); break
        except: pass
except: pass
" 2>/dev/null
}

# ── Header ────────────────────────────────────────────────────

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   SITREP — Admin Advanced Test                       ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo "Target: $API"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"

# ── Authentication ────────────────────────────────────────────

section "Authentication"

ADMIN_TOKEN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
GEN_TOKEN=$(get_token "quimica.mendoza@industria.com" "gen123")

[ -n "$ADMIN_TOKEN" ] && pass "ADMIN login" || { fail "ADMIN login — aborting"; exit 1; }
[ -n "$GEN_TOKEN" ] && pass "GENERADOR login" || fail "GENERADOR login"

TIMESTAMP=$(date +%s)

# ── Usuario Detail ────────────────────────────────────────────

section "Usuario Detail (ADMIN only)"

# Get first user ID from list
USERS_RESP=$(api_call "GET" "/admin/usuarios?limit=1" "$ADMIN_TOKEN")
USER_ID=$(echo "$USERS_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('usuarios', d.get('data', []))
    if isinstance(items, list) and items:
        print(items[0].get('id',''))
    elif isinstance(items, dict):
        lst = items.get('items', items.get('usuarios', []))
        if lst: print(lst[0].get('id',''))
except: pass
" 2>/dev/null)

if [ -n "$USER_ID" ]; then
  DETAIL_STATUS=$(status_only "GET" "/admin/usuarios/$USER_ID" "$ADMIN_TOKEN")
  check_status "GET /admin/usuarios/:id (ADMIN)" "200" "$DETAIL_STATUS"
else
  fail "Could not fetch a user ID for detail test"
fi

# Non-admin cannot access user detail
if [ -n "$GEN_TOKEN" ] && [ -n "$USER_ID" ]; then
  BLOCK=$(status_only "GET" "/admin/usuarios/$USER_ID" "$GEN_TOKEN")
  check_status "GET /admin/usuarios/:id as GENERADOR → 403" "403" "$BLOCK"
fi

# ── Toggle Activo ─────────────────────────────────────────────

section "Usuario CRUD — create, edit, delete"

# User A: create and immediately delete (before any login/audit record is created)
USER_A_BODY="{
  \"email\": \"userA$TIMESTAMP@sitrep.test\",
  \"password\": \"testpass123\",
  \"nombre\": \"User A $TIMESTAMP\",
  \"rol\": \"GENERADOR\",
  \"activo\": true
}"
CREATE_A=$(api_call "POST" "/admin/usuarios" "$ADMIN_TOKEN" "$USER_A_BODY")
UID_A=$(extract_id "$CREATE_A")

if [ -n "$UID_A" ]; then
  pass "[201] POST /admin/usuarios — created: ${UID_A:0:8}..."

  # Edit user
  UPD_A=$(status_only "PUT" "/admin/usuarios/$UID_A" "$ADMIN_TOKEN" \
    "{\"nombre\":\"User A Updated $TIMESTAMP\"}")
  check_status "PUT /admin/usuarios/:id" "200" "$UPD_A"

  # Delete immediately (no audit records yet)
  DEL_A=$(status_only "DELETE" "/admin/usuarios/$UID_A" "$ADMIN_TOKEN")
  check_status "DELETE /admin/usuarios/:id (no audit records)" "200" "$DEL_A"
else
  fail "POST /admin/usuarios — could not create User A: $(echo $CREATE_A | head -c 200)"
fi

section "Toggle Activo — disable / re-enable user"

# User B: create → toggle → login tests (no delete since login creates audit records)
USER_B_BODY="{
  \"email\": \"userB$TIMESTAMP@sitrep.test\",
  \"password\": \"testpass123\",
  \"nombre\": \"User B $TIMESTAMP\",
  \"rol\": \"GENERADOR\",
  \"activo\": true
}"

CREATE_B=$(api_call "POST" "/admin/usuarios" "$ADMIN_TOKEN" "$USER_B_BODY")
UID_B=$(extract_id "$CREATE_B")

if [ -n "$UID_B" ]; then
  pass "[201/200] POST /admin/usuarios — test user B created: ${UID_B:0:8}..."

  # Toggle OFF (desactivar)
  TOGGLE_OFF=$(status_only "PATCH" "/admin/usuarios/$UID_B/toggle-activo" "$ADMIN_TOKEN")
  check_status "PATCH /admin/usuarios/:id/toggle-activo (disable)" "200" "$TOGGLE_OFF"

  # Login with deactivated user → should fail (401 or 403)
  INACTIVE_TOKEN=$(get_token "userB$TIMESTAMP@sitrep.test" "testpass123")
  if [ -z "$INACTIVE_TOKEN" ]; then
    pass "[401/403] Login with deactivated user blocked"
  else
    fail "Login with deactivated user should be blocked but got token"
  fi

  # Toggle ON (reactivar)
  TOGGLE_ON=$(status_only "PATCH" "/admin/usuarios/$UID_B/toggle-activo" "$ADMIN_TOKEN")
  check_status "PATCH /admin/usuarios/:id/toggle-activo (re-enable)" "200" "$TOGGLE_ON"

  # Login after re-enable → should succeed
  REACTIVATED_TOKEN=$(get_token "userB$TIMESTAMP@sitrep.test" "testpass123")
  if [ -n "$REACTIVATED_TOKEN" ]; then
    pass "Login with re-enabled user → 200"
  else
    fail "Login with re-enabled user failed (expected success)"
  fi
  # Delete user B — now works even with audit records (auditorias.onDelete: Cascade)
  DEL_B=$(status_only "DELETE" "/admin/usuarios/$UID_B" "$ADMIN_TOKEN")
  check_status "DELETE /admin/usuarios/:id (with audit records, post-fix)" "200" "$DEL_B"

else
  fail "POST /admin/usuarios — could not create test user B: $(echo $CREATE_B | head -c 200)"
  echo -e "  ${YELLOW}SKIP${NC} toggle-activo tests (no test user)"
fi

# ── Jobs ──────────────────────────────────────────────────────

section "Jobs — vencimientos"

JOB_STATUS=$(status_only "POST" "/admin/jobs/vencimientos" "$ADMIN_TOKEN")
check_status "POST /admin/jobs/vencimientos (ADMIN)" "200" "$JOB_STATUS"

if [ -n "$GEN_TOKEN" ]; then
  JOB_BLOCK=$(status_only "POST" "/admin/jobs/vencimientos" "$GEN_TOKEN")
  check_status "POST /admin/jobs/vencimientos as GENERADOR → 403" "403" "$JOB_BLOCK"
fi

# ── Catálogo CRUD — Tipos de Residuos ────────────────────────

section "Catálogo CRUD — Tipos de Residuos (ADMIN)"

TIPO_BODY="{
  \"codigo\": \"RT-$TIMESTAMP\",
  \"nombre\": \"Residuo Test $TIMESTAMP\",
  \"descripcion\": \"Tipo de residuo creado por test automatizado\",
  \"categoria\": \"QUIMICO\",
  \"peligrosidad\": \"ALTO\"
}"

CREATE_TIPO=$(api_call "POST" "/catalogos/tipos-residuos" "$ADMIN_TOKEN" "$TIPO_BODY")
TIPO_ID=$(extract_id "$CREATE_TIPO")

if [ -n "$TIPO_ID" ]; then
  pass "[201/200] POST /catalogos/tipos-residuos — id: ${TIPO_ID:0:8}..."
else
  fail "POST /catalogos/tipos-residuos — no id: $(echo $CREATE_TIPO | head -c 200)"
fi

if [ -n "$TIPO_ID" ]; then
  UPD=$(status_only "PUT" "/catalogos/tipos-residuos/$TIPO_ID" "$ADMIN_TOKEN" \
    "{\"descripcion\":\"Descripcion actualizada\"}")
  check_status "PUT /catalogos/tipos-residuos/:id" "200" "$UPD"

  DEL=$(status_only "DELETE" "/catalogos/tipos-residuos/$TIPO_ID" "$ADMIN_TOKEN")
  check_status "DELETE /catalogos/tipos-residuos/:id" "200" "$DEL"
fi

# Non-admin cannot create tipo residuo
if [ -n "$GEN_TOKEN" ]; then
  BLOCK=$(status_only "POST" "/catalogos/tipos-residuos" "$GEN_TOKEN" "$TIPO_BODY")
  check_status "POST /catalogos/tipos-residuos as GENERADOR → 403" "403" "$BLOCK"
fi

# ── Catálogo CRUD — Tratamientos ─────────────────────────────

section "Catálogo CRUD — Tratamientos (ADMIN)"

# Need operadorId and tipoResiduoId from catalog
OPER_CAT_ID=$(curl -s "$API/catalogos/operadores" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    items=data if isinstance(data,list) else data.get('operadores',data.get('items',[]))
    if items: print(items[0]['id'])
except: pass
" 2>/dev/null)

TIPO_CAT_ID=$(curl -s "$API/catalogos/tipos-residuos" \
  | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    data=d.get('data',{})
    items=data if isinstance(data,list) else data.get('tiposResiduos',data.get('tipos',data.get('items',[])))
    if items: print(items[0]['id'])
except: pass
" 2>/dev/null)

if [ -z "$OPER_CAT_ID" ] || [ -z "$TIPO_CAT_ID" ]; then
  fail "Cannot get operadorId/tipoResiduoId from catalog"
  TRAT_ID=""
else
  TRAT_BODY="{
    \"operadorId\": \"$OPER_CAT_ID\",
    \"tipoResiduoId\": \"$TIPO_CAT_ID\",
    \"metodo\": \"TEST_METHOD_$TIMESTAMP\",
    \"descripcion\": \"Tratamiento test automatizado\"
  }"

  CREATE_TRAT=$(api_call "POST" "/catalogos/tratamientos" "$ADMIN_TOKEN" "$TRAT_BODY")
  TRAT_ID=$(extract_id "$CREATE_TRAT")
fi

if [ -n "$TRAT_ID" ]; then
  pass "[201/200] POST /catalogos/tratamientos — id: ${TRAT_ID:0:8}..."

  UPD=$(status_only "PUT" "/catalogos/tratamientos/$TRAT_ID" "$ADMIN_TOKEN" \
    "{\"descripcion\":\"Descripcion actualizada\"}")
  check_status "PUT /catalogos/tratamientos/:id" "200" "$UPD"

  DEL=$(status_only "DELETE" "/catalogos/tratamientos/$TRAT_ID" "$ADMIN_TOKEN")
  check_status "DELETE /catalogos/tratamientos/:id" "200" "$DEL"
else
  fail "POST /catalogos/tratamientos — no id: $(echo $CREATE_TRAT | head -c 200)"
fi

# Non-admin cannot create tratamiento
if [ -n "$GEN_TOKEN" ]; then
  NOAUTH_BODY="{\"operadorId\":\"fake\",\"tipoResiduoId\":\"fake\",\"metodo\":\"HACK\"}"
  BLOCK=$(status_only "POST" "/catalogos/tratamientos" "$GEN_TOKEN" "$NOAUTH_BODY")
  check_status "POST /catalogos/tratamientos as GENERADOR → 403" "403" "$BLOCK"
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
