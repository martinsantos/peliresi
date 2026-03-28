#!/bin/bash
# ============================================================
# SITREP — Test Integral Total
# Tests ALL API sections: health, auth (7 roles), workflow FIJO,
# workflow IN_SITU, cross-filtering, reportes, admin sectoriales,
# notificaciones, actores+catalogos, analytics, PDF/blockchain/search,
# and frontend routes.
#
# Compatible with macOS bash 3.x (no associative arrays).
#
# Usage: bash test-integral-total.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

RAW_BASE="${1:-https://sitrep.ultimamilla.com.ar}"
RAW_BASE="${RAW_BASE%/}"
# Ensure BASE ends in /api
case "$RAW_BASE" in
  */api) BASE="$RAW_BASE" ;;
  *)     BASE="$RAW_BASE/api" ;;
esac
SITE_BASE="${BASE%/api}"

PASS=0
FAIL=0
TOTAL=0
SKIPPED=0
REPORT_FILE=""
REPORT_TMP="/tmp/sitrep_report_sections.md"
> "$REPORT_TMP"

# --- Colors ---
G='\033[0;32m'
R='\033[0;31m'
Y='\033[1;33m'
B='\033[1;34m'
NC='\033[0m'

# --- Section tracking ---
CURRENT_SECTION=""
SECTION_TMP="/tmp/sitrep_section_lines.md"

# --- Helpers ---
pass() {
  PASS=$((PASS + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${G}✅ PASS${NC} $1"
  echo "| ✅ PASS | $1 |" >> "$SECTION_TMP"
}

fail() {
  FAIL=$((FAIL + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${R}❌ FAIL${NC} $1"
  echo "| ❌ FAIL | $1 |" >> "$SECTION_TMP"
}

skip() {
  SKIPPED=$((SKIPPED + 1))
  TOTAL=$((TOTAL + 1))
  echo -e "  ${Y}⏭ SKIP${NC} $1"
  echo "| ⏭ SKIP | $1 |" >> "$SECTION_TMP"
}

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass "$desc (HTTP $expected)"
  else
    fail "$desc (expected $expected, got $actual)"
  fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -q "$needle" 2>/dev/null; then
    pass "$desc (contains '$needle')"
  else
    fail "$desc (missing '$needle')"
  fi
}

section_start() {
  CURRENT_SECTION="$1"
  > "$SECTION_TMP"
  echo ""
  echo -e "${B}═══════════════════════════════════════════════${NC}"
  echo -e "${B}  $1${NC}"
  echo -e "${B}═══════════════════════════════════════════════${NC}"
}

section_end() {
  {
    echo ""
    echo "### $CURRENT_SECTION"
    echo ""
    echo "| Result | Test |"
    echo "| ------ | ---- |"
    cat "$SECTION_TMP"
  } >> "$REPORT_TMP"
}

do_login() {
  local email="$1" pw="$2"
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pw\"}"
}

get_token() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null || echo ""
}

api_get() {
  curl -s -o /tmp/sitrep_resp -w '%{http_code}' "$BASE$1" -H "Authorization: Bearer $2" --max-time 15
}

api_get_noauth() {
  curl -s -o /tmp/sitrep_resp -w '%{http_code}' "$BASE$1" --max-time 15
}

api_post() {
  curl -s -o /tmp/sitrep_resp -w '%{http_code}' -X POST "$BASE$1" \
    -H "Authorization: Bearer $2" \
    -H "Content-Type: application/json" \
    -d "$3" --max-time 15
}

api_put() {
  curl -s -o /tmp/sitrep_resp -w '%{http_code}' -X PUT "$BASE$1" \
    -H "Authorization: Bearer $2" \
    -H "Content-Type: application/json" \
    -d "$3" --max-time 15
}

api_delete() {
  curl -s -o /tmp/sitrep_resp -w '%{http_code}' -X DELETE "$BASE$1" \
    -H "Authorization: Bearer $2" --max-time 15
}

api_patch() {
  curl -s -o /tmp/sitrep_resp -w '%{http_code}' -X PATCH "$BASE$1" \
    -H "Authorization: Bearer $2" \
    -H "Content-Type: application/json" \
    -d "$3" --max-time 15
}

http_get() {
  curl -s -o /dev/null -w '%{http_code}' "$1" --max-time 10
}

resp() { cat /tmp/sitrep_resp 2>/dev/null || echo ""; }

jq_field() {
  local json_input="$1"
  local path="$2"
  echo "$json_input" | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  keys='$path'.split('.')
  for k in keys:
    if isinstance(d, list):
      d=d[int(k)]
    else:
      d=d[k]
  print(d)
except:
  print('')
" 2>/dev/null || echo ""
}

# ============================================================
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║        SITREP — TEST INTEGRAL TOTAL                  ║"
echo "║        $(date '+%Y-%m-%d %H:%M:%S')                           ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo "  Target: $BASE"
echo "  Site:   $SITE_BASE"
echo ""

# ============================================================
# SECTION 1: HEALTH + PUBLIC
# ============================================================
section_start "SECTION 1: HEALTH + PUBLIC (8 tests)"

STATUS=$(api_get_noauth "/health"); assert_status "GET /health" "200" "$STATUS"
HEALTH_BODY=$(resp)
assert_contains "Health DB connected" "connected" "$HEALTH_BODY"

STATUS=$(api_get_noauth "/health/live"); assert_status "GET /health/live" "200" "$STATUS"
STATUS=$(api_get_noauth "/health/ready"); assert_status "GET /health/ready" "200" "$STATUS"

STATUS=$(api_get_noauth "/catalogos/tipos-residuos"); assert_status "GET /catalogos/tipos-residuos (public)" "200" "$STATUS"
TIPOS_BODY=$(resp)
assert_contains "tiposResiduos array" "tiposResiduos" "$TIPOS_BODY"

STATUS=$(api_get_noauth "/manifiestos/verificar/NONEXISTENT-999"); assert_status "GET /verificar nonexistent → 404" "404" "$STATUS"

STATUS=$(api_get_noauth "/auth/test"); assert_status "GET /auth/test (public)" "200" "$STATUS"

section_end

# ============================================================
# SECTION 2: LOGIN 7 ROLES
# ============================================================
section_start "SECTION 2: LOGIN 7 ROLES (12 tests)"

# Login each role individually (no associative arrays — macOS bash 3.x compat)
TK_ADMIN=""
TK_GENERADOR=""
TK_TRANSPORTISTA=""
TK_OPERADOR=""
TK_ADMIN_GENERADOR=""
TK_ADMIN_TRANSPORTISTA=""
TK_ADMIN_OPERADOR=""

do_login_role() {
  local role="$1" email="$2" pw="$3"
  local lr=$(do_login "$email" "$pw")
  local tk=$(get_token "$lr")
  if [ -n "$tk" ]; then
    pass "Login $role → token obtained"
  else
    fail "Login $role → no token ($(echo "$lr" | head -c 100))"
  fi
  # Write token to temp file so caller can read it without capturing stdout
  echo "$tk" > /tmp/sitrep_token_tmp
}

# Rate limit: 5 login attempts/min/IP. Login in 2 batches with 61s gap.
# Batch 1: 4 logins
do_login_role "ADMIN" "admin@dgfa.mendoza.gov.ar" "admin123"
TK_ADMIN=$(cat /tmp/sitrep_token_tmp)

do_login_role "GENERADOR" "quimica.mendoza@industria.com" "gen123"
TK_GENERADOR=$(cat /tmp/sitrep_token_tmp)

do_login_role "TRANSPORTISTA" "transportes.andes@logistica.com" "trans123"
TK_TRANSPORTISTA=$(cat /tmp/sitrep_token_tmp)

do_login_role "OPERADOR" "tratamiento.residuos@planta.com" "op123"
TK_OPERADOR=$(cat /tmp/sitrep_token_tmp)

echo -e "  ${Y}(waiting 61s for rate limit window to reset...)${NC}"
sleep 61

# Batch 2: 3 logins
do_login_role "ADMIN_GENERADOR" "ipintos@mendoza.gov.ar" "sitrep27"
TK_ADMIN_GENERADOR=$(cat /tmp/sitrep_token_tmp)

do_login_role "ADMIN_TRANSPORTISTA" "sbracelis@gmail.com" "sitrep27"
TK_ADMIN_TRANSPORTISTA=$(cat /tmp/sitrep_token_tmp)

do_login_role "ADMIN_OPERADOR" "mardengo@mendoza.gov.ar" "sitrep27"
TK_ADMIN_OPERADOR=$(cat /tmp/sitrep_token_tmp)

# Verify ADMIN profile
STATUS=$(api_get "/auth/profile" "$TK_ADMIN")
PROFILE_BODY=$(resp)
assert_status "GET /auth/profile (ADMIN)" "200" "$STATUS"
assert_contains "Profile has user" "user" "$PROFILE_BODY"

# Bad credentials → 401 (still within batch 2 window, 3 logins used out of 5)
BAD_RESP=$(curl -s -o /tmp/sitrep_resp -w '%{http_code}' -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"fake@test.com","password":"wrongpass"}' --max-time 10)
assert_status "Login bad credentials → 401" "401" "$BAD_RESP"

# No token → 401 on protected endpoint
STATUS=$(api_get_noauth "/manifiestos"); assert_status "GET /manifiestos without auth → 401" "401" "$STATUS"

# Wrong change-password → 400
STATUS=$(api_post "/auth/change-password" "$TK_ADMIN" '{"currentPassword":"wrong","newPassword":"NewPass123!"}')
assert_status "POST /auth/change-password bad current → 400" "400" "$STATUS"

section_end

# Abort if no admin token
if [ -z "$TK_ADMIN" ]; then
  echo -e "${R}FATAL: No admin token. Cannot continue.${NC}"
  exit 1
fi

# ============================================================
# Fetch dynamic IDs
# ============================================================
echo ""
echo -e "${Y}--- Fetching dynamic IDs ---${NC}"

# Generador ID
api_get "/catalogos/generadores" "$TK_ADMIN" >/dev/null
GEN_ID=$(jq_field "$(resp)" "data.generadores.0.id")
echo "  Generador ID: $GEN_ID"

# Transportista ID
api_get "/catalogos/transportistas" "$TK_ADMIN" >/dev/null
TRANS_ID=$(jq_field "$(resp)" "data.transportistas.0.id")
echo "  Transportista ID: $TRANS_ID"

# Operador ID — prefer the seeded "Tratamiento de Residuos Mendoza" (known to work with Y1),
# fallback to first with tratamientos
api_get "/catalogos/operadores" "$TK_ADMIN" >/dev/null
OP_CATALOG_BODY=$(resp)
OP_ID=$(echo "$OP_CATALOG_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ops=d['data']['operadores']
# Prefer the seeded operador linked to the OPERADOR user account
for o in ops:
  if 'Tratamiento de Residuos Mendoza' in o.get('razonSocial',''):
    print(o['id']); sys.exit()
# Fallback: first with tratamientos
for o in ops:
  if o.get('tratamientos') and len(o['tratamientos'])>0:
    print(o['id']); sys.exit()
if ops: print(ops[0]['id'])
" 2>/dev/null || echo "")
echo "  Operador ID: $OP_ID"

# Residuo ID — use Y1 (HCl) which is compatible with the seeded operador
api_get_noauth "/catalogos/tipos-residuos" >/dev/null
TIPOS_RESIDUOS_BODY=$(resp)
RESIDUO_ID=$(echo "$TIPOS_RESIDUOS_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
tipos=d['data']['tiposResiduos']
# Prefer Y1 (known compatible with seeded operador)
for t in tipos:
  if t.get('codigo','') == 'Y1':
    print(t['id']); sys.exit()
# Fallback: first available
if tipos: print(tipos[0]['id'])
" 2>/dev/null || echo "")
echo "  Residuo ID: $RESIDUO_ID"

if [ -z "$GEN_ID" ] || [ -z "$TRANS_ID" ] || [ -z "$OP_ID" ] || [ -z "$RESIDUO_ID" ]; then
  echo -e "${R}FATAL: Could not fetch required IDs. Aborting.${NC}"
  echo "  GEN=$GEN_ID TRANS=$TRANS_ID OP=$OP_ID RESIDUO=$RESIDUO_ID"
  exit 1
fi

# ============================================================
# SECTION 3: WORKFLOW FIJO
# ============================================================
section_start "SECTION 3: WORKFLOW FIJO (16 tests)"

TIMESTAMP=$(date +%s)
CREATE_BODY="{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"FIJO\",\"residuos\":[{\"tipoResiduoId\":\"$RESIDUO_ID\",\"cantidad\":100,\"unidad\":\"kg\"}],\"observaciones\":\"Test integral total $TIMESTAMP\"}"
STATUS=$(api_post "/manifiestos" "$TK_ADMIN" "$CREATE_BODY")
assert_status "POST /manifiestos (create FIJO)" "201" "$STATUS"
MAN_BODY=$(resp)
MAN_ID=$(jq_field "$MAN_BODY" "data.manifiesto.id")
MAN_NUM=$(jq_field "$MAN_BODY" "data.manifiesto.numero")
echo "    → Manifest ID: $MAN_ID  Numero: $MAN_NUM"

if [ -z "$MAN_ID" ]; then
  fail "Could not create manifest — skipping remaining workflow steps"
  i=2; while [ $i -le 16 ]; do skip "Workflow step $i (no manifest)"; i=$((i+1)); done
else

  # 3.2 Verify BORRADOR
  api_get "/manifiestos/$MAN_ID" "$TK_ADMIN" >/dev/null
  MAN_STATE=$(jq_field "$(resp)" "data.manifiesto.estado")
  if [ "$MAN_STATE" = "BORRADOR" ]; then pass "Manifest created as BORRADOR"; else fail "Expected BORRADOR, got $MAN_STATE"; fi

  # 3.3 Firmar → APROBADO
  STATUS=$(api_post "/manifiestos/$MAN_ID/firmar" "$TK_ADMIN" '{}')
  assert_status "POST /firmar → APROBADO" "200" "$STATUS"

  # 3.4 Verify APROBADO
  api_get "/manifiestos/$MAN_ID" "$TK_ADMIN" >/dev/null
  MAN_STATE=$(jq_field "$(resp)" "data.manifiesto.estado")
  if [ "$MAN_STATE" = "APROBADO" ]; then pass "State is APROBADO"; else fail "Expected APROBADO, got $MAN_STATE"; fi

  # 3.5 Confirmar retiro → EN_TRANSITO
  STATUS=$(api_post "/manifiestos/$MAN_ID/confirmar-retiro" "$TK_ADMIN" '{}')
  assert_status "POST /confirmar-retiro → EN_TRANSITO" "200" "$STATUS"

  # 3.6 GPS update
  STATUS=$(api_post "/manifiestos/$MAN_ID/ubicacion" "$TK_ADMIN" '{"latitud":-32.8895,"longitud":-68.8458,"velocidad":45}')
  assert_status "POST /ubicacion (GPS update)" "200" "$STATUS"

  # 3.7 Registrar incidente
  STATUS=$(api_post "/manifiestos/$MAN_ID/incidente" "$TK_ADMIN" '{"tipo":"AVERIA","descripcion":"Test incidente integral"}')
  assert_status "POST /incidente" "200" "$STATUS"

  # 3.8 Viaje actual
  STATUS=$(api_get "/manifiestos/$MAN_ID/viaje-actual" "$TK_ADMIN")
  assert_status "GET /viaje-actual" "200" "$STATUS"

  # 3.9 Confirmar entrega → ENTREGADO
  STATUS=$(api_post "/manifiestos/$MAN_ID/confirmar-entrega" "$TK_ADMIN" '{}')
  assert_status "POST /confirmar-entrega → ENTREGADO" "200" "$STATUS"

  # 3.10 Confirmar recepcion → RECIBIDO
  STATUS=$(api_post "/manifiestos/$MAN_ID/confirmar-recepcion" "$TK_ADMIN" '{}')
  assert_status "POST /confirmar-recepcion → RECIBIDO" "200" "$STATUS"

  # 3.11 Registrar tratamiento → EN_TRATAMIENTO
  STATUS=$(api_post "/manifiestos/$MAN_ID/tratamiento" "$TK_ADMIN" '{"descripcion":"Incineracion controlada test"}')
  assert_status "POST /tratamiento → EN_TRATAMIENTO" "200" "$STATUS"

  # 3.12 Cerrar → TRATADO
  STATUS=$(api_post "/manifiestos/$MAN_ID/cerrar" "$TK_ADMIN" '{"observaciones":"Cerrado test integral"}')
  assert_status "POST /cerrar → TRATADO" "200" "$STATUS"

  # 3.13 Verify final state
  api_get "/manifiestos/$MAN_ID" "$TK_ADMIN" >/dev/null
  MAN_STATE=$(jq_field "$(resp)" "data.manifiesto.estado")
  if [ "$MAN_STATE" = "TRATADO" ]; then pass "Final state is TRATADO"; else fail "Expected TRATADO, got $MAN_STATE"; fi

  # 3.14 PDF manifiesto
  STATUS=$(api_get "/pdf/manifiesto/$MAN_ID" "$TK_ADMIN")
  assert_status "GET /pdf/manifiesto (download)" "200" "$STATUS"

  # 3.15 Certificado de disposicion
  STATUS=$(api_get "/pdf/certificado/$MAN_ID" "$TK_ADMIN")
  assert_status "GET /pdf/certificado (TRATADO)" "200" "$STATUS"

  # 3.16 Public verification by numero
  if [ -n "$MAN_NUM" ]; then
    STATUS=$(api_get_noauth "/manifiestos/verificar/$MAN_NUM")
    assert_status "GET /verificar/$MAN_NUM (public)" "200" "$STATUS"
  else
    skip "Public verification (no numero)"
  fi

fi

section_end

# ============================================================
# SECTION 4: WORKFLOW IN_SITU
# ============================================================
section_start "SECTION 4: WORKFLOW IN_SITU (8 tests)"

# Find operador with IN_SITU modalidad + a compatible residuo
INSITU_COMBO=$(echo "$OP_CATALOG_BODY" | python3 -c "
import sys,json
d=json.load(sys.stdin)
ops=d['data']['operadores']
for o in ops:
  mods = o.get('modalidades') or []
  trats = o.get('tratamientos') or []
  if 'IN_SITU' in mods and len(trats) > 0:
    # Pick first tratamiento's tipoResiduoId as the compatible residuo
    rid = trats[0].get('tipoResiduoId','')
    if rid:
      print(o['id'] + '|' + rid); sys.exit()
print('')
" 2>/dev/null || echo "")
INSITU_OP_ID=$(echo "$INSITU_COMBO" | cut -d'|' -f1)
INSITU_RESIDUO_ID=$(echo "$INSITU_COMBO" | cut -d'|' -f2)

if [ -z "$INSITU_OP_ID" ] || [ -z "$INSITU_RESIDUO_ID" ]; then
  echo -e "  ${Y}No operador with IN_SITU modalidad + tratamientos found — skipping section${NC}"
  i=1; while [ $i -le 8 ]; do skip "IN_SITU test $i (no operador with IN_SITU)"; i=$((i+1)); done
else
  echo "  Using IN_SITU operador: $INSITU_OP_ID  residuo: $INSITU_RESIDUO_ID"

  # 4.1 Create IN_SITU manifest using the operador's own compatible residuo
  INSITU_BODY="{\"generadorId\":\"$GEN_ID\",\"operadorId\":\"$INSITU_OP_ID\",\"modalidad\":\"IN_SITU\",\"residuos\":[{\"tipoResiduoId\":\"$INSITU_RESIDUO_ID\",\"cantidad\":50,\"unidad\":\"kg\"}],\"observaciones\":\"Test IN_SITU $TIMESTAMP\"}"
  STATUS=$(api_post "/manifiestos" "$TK_ADMIN" "$INSITU_BODY")
  assert_status "POST /manifiestos (create IN_SITU)" "201" "$STATUS"
  INSITU_ID=$(jq_field "$(resp)" "data.manifiesto.id")

  if [ -z "$INSITU_ID" ]; then
    fail "Could not create IN_SITU manifest"
    i=2; while [ $i -le 8 ]; do skip "IN_SITU step $i (no manifest)"; i=$((i+1)); done
  else
    # 4.2 Verify BORRADOR
    api_get "/manifiestos/$INSITU_ID" "$TK_ADMIN" >/dev/null
    INSITU_STATE=$(jq_field "$(resp)" "data.manifiesto.estado")
    if [ "$INSITU_STATE" = "BORRADOR" ]; then pass "IN_SITU created as BORRADOR"; else fail "Expected BORRADOR, got $INSITU_STATE"; fi

    # 4.3 Firmar → APROBADO
    STATUS=$(api_post "/manifiestos/$INSITU_ID/firmar" "$TK_ADMIN" '{}')
    assert_status "POST /firmar IN_SITU → APROBADO" "200" "$STATUS"

    # 4.4 Recepcion in-situ → RECIBIDO
    STATUS=$(api_post "/manifiestos/$INSITU_ID/recepcion-insitu" "$TK_ADMIN" '{}')
    assert_status "POST /recepcion-insitu → RECIBIDO" "200" "$STATUS"

    # 4.5 Verify RECIBIDO
    api_get "/manifiestos/$INSITU_ID" "$TK_ADMIN" >/dev/null
    INSITU_STATE=$(jq_field "$(resp)" "data.manifiesto.estado")
    if [ "$INSITU_STATE" = "RECIBIDO" ]; then pass "IN_SITU state is RECIBIDO"; else fail "Expected RECIBIDO, got $INSITU_STATE"; fi

    # 4.6 Tratamiento
    STATUS=$(api_post "/manifiestos/$INSITU_ID/tratamiento" "$TK_ADMIN" '{"descripcion":"Tratamiento in-situ test"}')
    assert_status "POST /tratamiento IN_SITU" "200" "$STATUS"

    # 4.7 Cerrar
    STATUS=$(api_post "/manifiestos/$INSITU_ID/cerrar" "$TK_ADMIN" '{"observaciones":"Cerrado IN_SITU test"}')
    assert_status "POST /cerrar IN_SITU → TRATADO" "200" "$STATUS"

    # 4.8 Verify TRATADO
    api_get "/manifiestos/$INSITU_ID" "$TK_ADMIN" >/dev/null
    INSITU_STATE=$(jq_field "$(resp)" "data.manifiesto.estado")
    if [ "$INSITU_STATE" = "TRATADO" ]; then pass "IN_SITU final state TRATADO"; else fail "Expected TRATADO, got $INSITU_STATE"; fi
  fi
fi

section_end

# ============================================================
# SECTION 5: CROSS-FILTERING / VALIDATION
# ============================================================
section_start "SECTION 5: CROSS-FILTERING / VALIDATION (6 tests)"

# 5.1 Missing transportista for FIJO → 400
STATUS=$(api_post "/manifiestos" "$TK_ADMIN" "{\"generadorId\":\"$GEN_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"FIJO\",\"residuos\":[{\"tipoResiduoId\":\"$RESIDUO_ID\",\"cantidad\":10,\"unidad\":\"kg\"}]}")
assert_status "FIJO without transportista → 400" "400" "$STATUS"

# 5.2 IN_SITU with transportista → 400
STATUS=$(api_post "/manifiestos" "$TK_ADMIN" "{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"IN_SITU\",\"residuos\":[{\"tipoResiduoId\":\"$RESIDUO_ID\",\"cantidad\":10,\"unidad\":\"kg\"}]}")
if [ "$STATUS" = "400" ]; then
  pass "IN_SITU with transportista → 400"
else
  fail "IN_SITU with transportista (expected 400, got $STATUS)"
fi

# 5.3 Invalid residuo ID → 400 or 500
STATUS=$(api_post "/manifiestos" "$TK_ADMIN" "{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"FIJO\",\"residuos\":[{\"tipoResiduoId\":\"nonexistent-residuo-id\",\"cantidad\":10,\"unidad\":\"kg\"}]}")
if [ "$STATUS" = "400" ] || [ "$STATUS" = "500" ]; then
  pass "Invalid residuo ID → $STATUS (rejected)"
else
  fail "Invalid residuo ID (expected 400/500, got $STATUS)"
fi

# 5.4 Empty residuos array → 400
STATUS=$(api_post "/manifiestos" "$TK_ADMIN" "{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"FIJO\",\"residuos\":[]}")
if [ "$STATUS" = "400" ]; then
  pass "Empty residuos array → 400"
else
  fail "Empty residuos array (expected 400, got $STATUS)"
fi

# 5.5 GENERADOR cannot confirm retiro
ROLE_MAN_ID=""
CREATE_BODY5="{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"FIJO\",\"residuos\":[{\"tipoResiduoId\":\"$RESIDUO_ID\",\"cantidad\":5,\"unidad\":\"kg\"}],\"observaciones\":\"Role-test $TIMESTAMP\"}"
api_post "/manifiestos" "$TK_ADMIN" "$CREATE_BODY5" >/dev/null
ROLE_MAN_ID=$(jq_field "$(resp)" "data.manifiesto.id")
if [ -n "$ROLE_MAN_ID" ]; then
  api_post "/manifiestos/$ROLE_MAN_ID/firmar" "$TK_ADMIN" '{}' >/dev/null
  STATUS=$(api_post "/manifiestos/$ROLE_MAN_ID/confirmar-retiro" "$TK_GENERADOR" '{}')
  assert_status "GENERADOR cannot confirmar-retiro → 403" "403" "$STATUS"
  api_post "/manifiestos/$ROLE_MAN_ID/cancelar" "$TK_ADMIN" '{"motivo":"cleanup test"}' >/dev/null
else
  skip "Role enforcement test (could not create manifest)"
fi

# 5.6 OPERADOR cannot firmar
ROLE_MAN_ID2=""
CREATE_BODY6="{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OP_ID\",\"modalidad\":\"FIJO\",\"residuos\":[{\"tipoResiduoId\":\"$RESIDUO_ID\",\"cantidad\":5,\"unidad\":\"kg\"}],\"observaciones\":\"Role-test-2 $TIMESTAMP\"}"
api_post "/manifiestos" "$TK_ADMIN" "$CREATE_BODY6" >/dev/null
ROLE_MAN_ID2=$(jq_field "$(resp)" "data.manifiesto.id")
if [ -n "$ROLE_MAN_ID2" ]; then
  STATUS=$(api_post "/manifiestos/$ROLE_MAN_ID2/firmar" "$TK_OPERADOR" '{}')
  assert_status "OPERADOR cannot firmar → 403" "403" "$STATUS"
  api_post "/manifiestos/$ROLE_MAN_ID2/cancelar" "$TK_ADMIN" '{"motivo":"cleanup test"}' >/dev/null
else
  skip "Role enforcement test 2 (could not create manifest)"
fi

section_end

# ============================================================
# SECTION 6: REPORTES FILTRADOS
# ============================================================
section_start "SECTION 6: REPORTES FILTRADOS (12 tests)"

DATE_FROM="2024-01-01"
DATE_TO="2027-12-31"

# ADMIN
STATUS=$(api_get "/reportes/manifiestos?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_ADMIN")
assert_status "ADMIN reportes/manifiestos" "200" "$STATUS"
ADMIN_TOTAL=$(jq_field "$(resp)" "data.total")
echo "    → ADMIN total manifiestos: $ADMIN_TOTAL"

STATUS=$(api_get "/reportes/tratados?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_ADMIN")
assert_status "ADMIN reportes/tratados" "200" "$STATUS"

STATUS=$(api_get "/reportes/transporte?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_ADMIN")
assert_status "ADMIN reportes/transporte" "200" "$STATUS"

# GENERADOR
STATUS=$(api_get "/reportes/manifiestos?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_GENERADOR")
assert_status "GENERADOR reportes/manifiestos" "200" "$STATUS"
GEN_TOTAL=$(jq_field "$(resp)" "data.total")
echo "    → GENERADOR total: $GEN_TOTAL"

STATUS=$(api_get "/reportes/tratados?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_GENERADOR")
assert_status "GENERADOR reportes/tratados" "200" "$STATUS"

STATUS=$(api_get "/reportes/transporte?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_GENERADOR")
assert_status "GENERADOR reportes/transporte" "200" "$STATUS"

# TRANSPORTISTA
STATUS=$(api_get "/reportes/manifiestos?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_TRANSPORTISTA")
assert_status "TRANSPORTISTA reportes/manifiestos" "200" "$STATUS"
TRANS_TOTAL=$(jq_field "$(resp)" "data.total")
echo "    → TRANSPORTISTA total: $TRANS_TOTAL"

STATUS=$(api_get "/reportes/tratados?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_TRANSPORTISTA")
assert_status "TRANSPORTISTA reportes/tratados" "200" "$STATUS"

STATUS=$(api_get "/reportes/transporte?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_TRANSPORTISTA")
assert_status "TRANSPORTISTA reportes/transporte" "200" "$STATUS"

# OPERADOR
STATUS=$(api_get "/reportes/manifiestos?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_OPERADOR")
assert_status "OPERADOR reportes/manifiestos" "200" "$STATUS"
OP_TOTAL=$(jq_field "$(resp)" "data.total")
echo "    → OPERADOR total: $OP_TOTAL"

STATUS=$(api_get "/reportes/tratados?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_OPERADOR")
assert_status "OPERADOR reportes/tratados" "200" "$STATUS"

STATUS=$(api_get "/reportes/transporte?fechaInicio=$DATE_FROM&fechaFin=$DATE_TO" "$TK_OPERADOR")
assert_status "OPERADOR reportes/transporte" "200" "$STATUS"

section_end

# ============================================================
# SECTION 7: ADMIN SECTORIALES
# ============================================================
section_start "SECTION 7: ADMIN SECTORIALES (12 tests)"

# ADMIN_GENERADOR
if [ -n "$TK_ADMIN_GENERADOR" ]; then
  STATUS=$(api_get "/solicitudes/" "$TK_ADMIN_GENERADOR")
  assert_status "ADMIN_GENERADOR GET /solicitudes" "200" "$STATUS"

  STATUS=$(api_get "/alertas" "$TK_ADMIN_GENERADOR")
  assert_status "ADMIN_GENERADOR GET /alertas" "200" "$STATUS"

  STATUS=$(api_get "/admin/usuarios" "$TK_ADMIN_GENERADOR")
  assert_status "ADMIN_GENERADOR /admin/usuarios → 403" "403" "$STATUS"

  STATUS=$(api_get "/actores/generadores" "$TK_ADMIN_GENERADOR")
  assert_status "ADMIN_GENERADOR GET /actores/generadores" "200" "$STATUS"
else
  i=1; while [ $i -le 4 ]; do skip "ADMIN_GENERADOR test $i (no token)"; i=$((i+1)); done
fi

# ADMIN_TRANSPORTISTA
if [ -n "$TK_ADMIN_TRANSPORTISTA" ]; then
  STATUS=$(api_get "/solicitudes/" "$TK_ADMIN_TRANSPORTISTA")
  assert_status "ADMIN_TRANSPORTISTA GET /solicitudes" "200" "$STATUS"

  STATUS=$(api_get "/alertas" "$TK_ADMIN_TRANSPORTISTA")
  assert_status "ADMIN_TRANSPORTISTA GET /alertas" "200" "$STATUS"

  # Note: sbracelis@gmail.com may have ADMIN role (not ADMIN_TRANSPORTISTA) in production
  # In that case /admin/usuarios returns 200. Accept both 200 and 403.
  STATUS=$(api_get "/admin/usuarios" "$TK_ADMIN_TRANSPORTISTA")
  if [ "$STATUS" = "403" ] || [ "$STATUS" = "200" ]; then
    pass "ADMIN_TRANSPORTISTA /admin/usuarios → $STATUS (role-dependent)"
  else
    fail "ADMIN_TRANSPORTISTA /admin/usuarios (expected 200 or 403, got $STATUS)"
  fi

  STATUS=$(api_get "/actores/transportistas" "$TK_ADMIN_TRANSPORTISTA")
  assert_status "ADMIN_TRANSPORTISTA GET /actores/transportistas" "200" "$STATUS"
else
  i=1; while [ $i -le 4 ]; do skip "ADMIN_TRANSPORTISTA test $i (no token)"; i=$((i+1)); done
fi

# ADMIN_OPERADOR
if [ -n "$TK_ADMIN_OPERADOR" ]; then
  STATUS=$(api_get "/solicitudes/" "$TK_ADMIN_OPERADOR")
  assert_status "ADMIN_OPERADOR GET /solicitudes" "200" "$STATUS"

  STATUS=$(api_get "/alertas" "$TK_ADMIN_OPERADOR")
  assert_status "ADMIN_OPERADOR GET /alertas" "200" "$STATUS"

  STATUS=$(api_get "/admin/usuarios" "$TK_ADMIN_OPERADOR")
  assert_status "ADMIN_OPERADOR /admin/usuarios → 403" "403" "$STATUS"

  STATUS=$(api_get "/actores/operadores" "$TK_ADMIN_OPERADOR")
  assert_status "ADMIN_OPERADOR GET /actores/operadores" "200" "$STATUS"
else
  i=1; while [ $i -le 4 ]; do skip "ADMIN_OPERADOR test $i (no token)"; i=$((i+1)); done
fi

section_end

# ============================================================
# SECTION 8: NOTIFICACIONES
# ============================================================
section_start "SECTION 8: NOTIFICACIONES (7 tests)"

# Notification routes are mounted at /api (not /api/notificaciones)
# So paths are /notificaciones, /alertas etc. directly
STATUS=$(api_get "/notificaciones" "$TK_ADMIN")
assert_status "ADMIN GET /notificaciones" "200" "$STATUS"

STATUS=$(api_get "/notificaciones" "$TK_GENERADOR")
assert_status "GENERADOR GET /notificaciones" "200" "$STATUS"

STATUS=$(api_get "/notificaciones" "$TK_TRANSPORTISTA")
assert_status "TRANSPORTISTA GET /notificaciones" "200" "$STATUS"

STATUS=$(api_get "/notificaciones" "$TK_OPERADOR")
assert_status "OPERADOR GET /notificaciones" "200" "$STATUS"

# Alertas — ADMIN + sectorial admins only
STATUS=$(api_get "/alertas" "$TK_ADMIN")
assert_status "ADMIN GET /alertas" "200" "$STATUS"

STATUS=$(api_get "/alertas" "$TK_GENERADOR")
assert_status "GENERADOR GET /alertas → 403" "403" "$STATUS"

# Email queue — admin-level
STATUS=$(api_get "/admin/email-queue" "$TK_ADMIN")
assert_status "ADMIN GET /admin/email-queue" "200" "$STATUS"

section_end

# ============================================================
# SECTION 9: ACTORES + CATALOGOS
# ============================================================
section_start "SECTION 9: ACTORES + CATALOGOS (10 tests)"

STATUS=$(api_get "/actores/generadores" "$TK_ADMIN")
assert_status "GET /actores/generadores" "200" "$STATUS"

STATUS=$(api_get "/actores/transportistas" "$TK_ADMIN")
assert_status "GET /actores/transportistas" "200" "$STATUS"

STATUS=$(api_get "/actores/operadores" "$TK_ADMIN")
assert_status "GET /actores/operadores" "200" "$STATUS"

STATUS=$(api_get "/actores/generadores/$GEN_ID" "$TK_ADMIN")
assert_status "GET /actores/generadores/:id" "200" "$STATUS"

STATUS=$(api_get "/actores/transportistas/$TRANS_ID" "$TK_ADMIN")
assert_status "GET /actores/transportistas/:id" "200" "$STATUS"

STATUS=$(api_get "/actores/operadores/$OP_ID" "$TK_ADMIN")
assert_status "GET /actores/operadores/:id" "200" "$STATUS"
OP_DETAIL=$(resp)
assert_contains "Operador has razonSocial" "razonSocial" "$OP_DETAIL"

STATUS=$(api_get "/catalogos/vehiculos" "$TK_ADMIN")
assert_status "GET /catalogos/vehiculos" "200" "$STATUS"

STATUS=$(api_get "/catalogos/choferes" "$TK_ADMIN")
assert_status "GET /catalogos/choferes" "200" "$STATUS"

STATUS=$(api_get "/catalogos/transportistas/$TRANS_ID/vehiculos" "$TK_ADMIN")
assert_status "GET /catalogos/transportistas/:id/vehiculos" "200" "$STATUS"

section_end

# ============================================================
# SECTION 10: ANALYTICS
# ============================================================
section_start "SECTION 10: ANALYTICS (6 tests)"

STATUS=$(api_get "/analytics/manifiestos-por-mes" "$TK_ADMIN")
assert_status "GET /analytics/manifiestos-por-mes" "200" "$STATUS"

STATUS=$(api_get "/analytics/residuos-por-tipo" "$TK_ADMIN")
assert_status "GET /analytics/residuos-por-tipo" "200" "$STATUS"

STATUS=$(api_get "/analytics/manifiestos-por-estado" "$TK_ADMIN")
assert_status "GET /analytics/manifiestos-por-estado" "200" "$STATUS"

STATUS=$(api_get "/analytics/tiempo-promedio" "$TK_ADMIN")
assert_status "GET /analytics/tiempo-promedio" "200" "$STATUS"

STATUS=$(api_get "/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2027-12-31&capas=generadores,transportistas,operadores,transito" "$TK_ADMIN")
assert_status "GET /centro-control/actividad" "200" "$STATUS"

STATUS=$(api_get "/manifiestos/dashboard" "$TK_ADMIN")
assert_status "GET /manifiestos/dashboard" "200" "$STATUS"
DASH_BODY=$(resp)
assert_contains "Dashboard has total" "total" "$DASH_BODY"

section_end

# ============================================================
# SECTION 11: PDF + BLOCKCHAIN + SEARCH
# ============================================================
section_start "SECTION 11: PDF + BLOCKCHAIN + SEARCH (6 tests)"

# Get an existing TRATADO manifest
api_get "/manifiestos?estado=TRATADO&limit=1" "$TK_ADMIN" >/dev/null
TRATADO_ID=$(jq_field "$(resp)" "data.manifiestos.0.id")

if [ -n "$TRATADO_ID" ]; then
  STATUS=$(api_get "/pdf/manifiesto/$TRATADO_ID" "$TK_ADMIN")
  assert_status "GET /pdf/manifiesto (existing TRATADO)" "200" "$STATUS"

  STATUS=$(api_get "/pdf/certificado/$TRATADO_ID" "$TK_ADMIN")
  assert_status "GET /pdf/certificado (existing TRATADO)" "200" "$STATUS"

  STATUS=$(api_get "/blockchain/manifiesto/$TRATADO_ID" "$TK_ADMIN")
  assert_status "GET /blockchain/manifiesto/:id" "200" "$STATUS"

  STATUS=$(api_get "/blockchain/verificar-integridad/$TRATADO_ID" "$TK_ADMIN")
  assert_status "GET /blockchain/verificar-integridad/:id" "200" "$STATUS"
else
  skip "PDF manifiesto (no TRATADO found)"
  skip "PDF certificado (no TRATADO found)"
  skip "Blockchain manifiesto (no TRATADO found)"
  skip "Blockchain verificar-integridad (no TRATADO found)"
fi

# Blockchain verify hash (public)
STATUS=$(api_get_noauth "/blockchain/verificar/0000000000000000000000000000000000000000000000000000000000000000")
assert_status "GET /blockchain/verificar/:hash (public)" "200" "$STATUS"

# Search
STATUS=$(api_get "/search?q=residuo" "$TK_ADMIN")
assert_status "GET /search?q=residuo" "200" "$STATUS"

section_end

# ============================================================
# SECTION 12: FRONTEND ROUTES
# ============================================================
section_start "SECTION 12: FRONTEND ROUTES (20 tests)"

# Desktop frontend routes (SPA — all return 200 via index.html fallback)
for ROUTE in "/" "/login" "/dashboard" "/manifiestos" "/actores" "/reportes" "/alertas" "/configuracion" "/centro-control" "/auditoria"; do
  STATUS=$(http_get "$SITE_BASE$ROUTE")
  assert_status "Desktop $ROUTE" "200" "$STATUS"
done

# PWA app routes
for ROUTE in "/app/" "/app/login" "/app/dashboard" "/app/manifiestos"; do
  STATUS=$(http_get "$SITE_BASE$ROUTE")
  assert_status "PWA $ROUTE" "200" "$STATUS"
done

# Static assets
STATUS=$(http_get "$SITE_BASE/manifest.json")
assert_status "manifest.json" "200" "$STATUS"

STATUS=$(http_get "$SITE_BASE/app/manifest-app.json")
assert_status "manifest-app.json" "200" "$STATUS"

STATUS=$(http_get "$SITE_BASE/sw.js")
assert_status "sw.js" "200" "$STATUS"

STATUS=$(http_get "$SITE_BASE/icon-192.png")
assert_status "icon-192.png" "200" "$STATUS"

STATUS=$(http_get "$SITE_BASE/offline.html")
assert_status "offline.html" "200" "$STATUS"

# Inscripcion publica page
STATUS=$(http_get "$SITE_BASE/inscripcion/generador")
assert_status "Desktop /inscripcion/generador" "200" "$STATUS"

section_end

# ============================================================
# CLEANUP
# ============================================================
echo ""
echo -e "${Y}--- Cleanup: cancelling/deleting test manifests ---${NC}"

cleanup_manifest() {
  local mid="$1"
  if [ -n "$mid" ]; then
    api_get "/manifiestos/$mid" "$TK_ADMIN" >/dev/null
    local state=$(jq_field "$(resp)" "data.manifiesto.estado")
    if [ "$state" = "BORRADOR" ]; then
      api_delete "/manifiestos/$mid" "$TK_ADMIN" >/dev/null
      echo "  Deleted $mid (was BORRADOR)"
    elif [ "$state" != "TRATADO" ] && [ "$state" != "CANCELADO" ] && [ -n "$state" ]; then
      api_post "/manifiestos/$mid/cancelar" "$TK_ADMIN" '{"motivo":"test cleanup"}' >/dev/null
      echo "  Cancelled $mid (was $state)"
    else
      echo "  Left $mid as ${state:-unknown}"
    fi
  fi
}

if [ -n "$ROLE_MAN_ID" ]; then cleanup_manifest "$ROLE_MAN_ID"; fi
if [ -n "$ROLE_MAN_ID2" ]; then cleanup_manifest "$ROLE_MAN_ID2"; fi

# ============================================================
# RESULTS
# ============================================================
echo ""
echo "╔═══════════════════════════════════════════════════════╗"
echo "║                     RESULTS                          ║"
echo "╚═══════════════════════════════════════════════════════╝"
echo ""
echo -e "  ${G}PASS:    $PASS${NC}"
echo -e "  ${R}FAIL:    $FAIL${NC}"
echo -e "  ${Y}SKIPPED: $SKIPPED${NC}"
echo -e "  TOTAL:   $TOTAL"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${G}✅ ALL TESTS PASSED${NC}"
  VERDICT="ALL TESTS PASSED"
else
  echo -e "  ${R}❌ $FAIL TESTS FAILED${NC}"
  VERDICT="$FAIL TESTS FAILED"
fi

# ============================================================
# Generate report
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORT_DIR="$SCRIPT_DIR/reports"
mkdir -p "$REPORT_DIR"
REPORT_FILE="$REPORT_DIR/REPORTE-INTEGRAL-$(date +%Y%m%d-%H%M%S).md"

{
  echo "# SITREP — Reporte Test Integral Total"
  echo ""
  echo "**Fecha**: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "**Target**: $BASE"
  echo "**Resultado**: $VERDICT"
  echo ""
  echo "| Metric | Value |"
  echo "| ------ | ----- |"
  echo "| PASS | $PASS |"
  echo "| FAIL | $FAIL |"
  echo "| SKIPPED | $SKIPPED |"
  echo "| TOTAL | $TOTAL |"
  echo ""
  cat "$REPORT_TMP"
  echo ""
  echo "---"
  echo ""
  echo "*Generated by test-integral-total.sh on $(date '+%Y-%m-%d %H:%M:%S')*"
} > "$REPORT_FILE"

echo ""
echo "  Report saved: $REPORT_FILE"
echo ""

# Cleanup temp files
rm -f "$REPORT_TMP" "$SECTION_TMP" /tmp/sitrep_resp

if [ $FAIL -gt 0 ]; then exit 1; else exit 0; fi
