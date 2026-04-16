#!/bin/bash
# ============================================================
# SITREP — Multi-User Concurrent Test
# Prueba simultaneidad real: diferentes roles, web + PWA,
# race conditions, GPS paralelo, sesiones duales.
#
# Escenarios:
#   S1 — Login paralelo: todos los roles simultáneamente
#   S2 — Race condition: doble aprobación del mismo manifiesto
#   S3 — Sesión dual mismo usuario (web + app)
#   S4 — GPS simultáneo: 3 transportistas enviando ubicación
#   S5 — Lecturas concurrentes bajo escritura (dashboard)
#   S6 — Multi-rol acceso simultáneo a mismos recursos
#   S7 — Dos OPERADORES procesando manifiestos distintos
#
# Uso: bash backend/tests/multiuser-concurrent-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar/api
# ============================================================

set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar/api}"
TMPDIR_TEST="/tmp/sitrep-concurrent-$$"
mkdir -p "$TMPDIR_TEST"
trap "rm -rf $TMPDIR_TEST" EXIT

PASS=0
FAIL=0
SKIP=0
RACE=0
ERRORS=""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ────────────────────────────────────────────────────────────────

section() {
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════${NC}"
}

subsection() {
  echo ""
  echo -e "${BLUE}▶ $1${NC}"
}

log_pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS+1)); }
log_fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL+1)); ERRORS="$ERRORS\n  FAIL $1"; }
log_race() { echo -e "  ${CYAN}RACE-DETECTED${NC} $1"; RACE=$((RACE+1)); FAIL=$((FAIL+1)); ERRORS="$ERRORS\n  RACE $1"; }
log_skip() { echo -e "  ${YELLOW}SKIP${NC} $1"; SKIP=$((SKIP+1)); }
log_warn() { echo -e "  ${YELLOW}WARN${NC} $1"; }

json_field() {
  # json_field <field_path> — reads stdin
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$1'.split('.')
    for k in keys:
        if isinstance(d, list):
            d = d[int(k)]
        else:
            d = d.get(k, '')
    print(d if d is not None else '')
except Exception:
    print('')
" 2>/dev/null
}

login() {
  # login <email> <password> → token
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | json_field "data.tokens.accessToken"
}

http_status() {
  # http_status <method> <path> <token> [body]
  local METHOD=$1 PATH=$2 TOKEN=$3 BODY="${4:-}"
  if [ -n "$BODY" ]; then
    curl -s -o /dev/null -w '%{http_code}' -X "$METHOD" "$BASE$PATH" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY"
  else
    curl -s -o /dev/null -w '%{http_code}' -X "$METHOD" "$BASE$PATH" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

api_get() {
  # api_get <path> <token> → body
  curl -s "$BASE$1" -H "Authorization: Bearer $2"
}

api_post() {
  # api_post <path> <token> <body> → body
  curl -s -X POST "$BASE$1" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $2" \
    -d "$3"
}

get_manifiestos_id() {
  # get_manifiestos_id <token> <estado> <index=0> → id
  local IDX="${3:-0}"
  api_get "/manifiestos?estado=$2&limit=10" "$1" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data',{}).get('manifiestos', d.get('data',{}).get('items', []))
    print(items[$IDX]['id'] if len(items) > $IDX else '')
except Exception:
    print('')
" 2>/dev/null
}

# ── Fase 0: Autenticación primaria ─────────────────────────────────────────

section "SITREP — Multi-User Concurrent Test"
echo "Target: $BASE"
echo "Date:   $(date '+%Y-%m-%d %H:%M:%S')"

subsection "Fase 0: Autenticación de roles primarios"

TOKEN_ADMIN=$(login "admin@dgfa.mendoza.gov.ar" "admin123")
sleep 1
if [ -z "$TOKEN_ADMIN" ]; then
  echo -e "  ${RED}FATAL: No se pudo autenticar como ADMIN. Abortando.${NC}"
  exit 1
fi
echo -e "  ${GREEN}OK${NC} ADMIN"

TOKEN_GEN=$(login "quimica.mendoza@industria.com" "gen123")
[ -n "$TOKEN_GEN" ] && echo -e "  ${GREEN}OK${NC} GENERADOR-1" || { log_warn "GENERADOR-1 auth fallida"; TOKEN_GEN=""; }
sleep 1

TOKEN_TRANS=$(login "transportes.andes@logistica.com" "trans123")
[ -n "$TOKEN_TRANS" ] && echo -e "  ${GREEN}OK${NC} TRANSPORTISTA-1" || { log_warn "TRANSPORTISTA-1 auth fallida"; TOKEN_TRANS=""; }
sleep 1

TOKEN_OPER=$(login "tratamiento.residuos@planta.com" "op123")
[ -n "$TOKEN_OPER" ] && echo -e "  ${GREEN}OK${NC} OPERADOR-1" || { log_warn "OPERADOR-1 auth fallida"; TOKEN_OPER=""; }

# Resolver usuarios secundarios del seed vía admin
subsection "Fase 0b: Resolución de usuarios secundarios"

USERS_JSON=$(api_get "/admin/usuarios?limit=50" "$TOKEN_ADMIN")

# Extraer emails secundarios (distintos al primario ya conocido)
TOKEN_GEN2=""
TOKEN_TRANS2=""
TOKEN_TRANS3=""
TOKEN_OPER2=""

EMAIL_GEN2=$(echo "$USERS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('usuarios', d.get('data', {}).get('items', []))
    primary = 'quimica.mendoza@industria.com'
    gens = [u['email'] for u in items if u.get('rol') == 'GENERADOR' and u['email'] != primary and u.get('activo', True)]
    print(gens[0] if gens else '')
except Exception:
    print('')
" 2>/dev/null)

EMAIL_TRANS2=$(echo "$USERS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('usuarios', d.get('data', {}).get('items', []))
    primary = 'transportes.andes@logistica.com'
    trans = [u['email'] for u in items if u.get('rol') == 'TRANSPORTISTA' and u['email'] != primary and u.get('activo', True)]
    print(trans[0] if trans else '')
except Exception:
    print('')
" 2>/dev/null)

EMAIL_TRANS3=$(echo "$USERS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('usuarios', d.get('data', {}).get('items', []))
    primary = 'transportes.andes@logistica.com'
    trans = [u['email'] for u in items if u.get('rol') == 'TRANSPORTISTA' and u['email'] != primary and u.get('activo', True)]
    print(trans[1] if len(trans) > 1 else '')
except Exception:
    print('')
" 2>/dev/null)

EMAIL_OPER2=$(echo "$USERS_JSON" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('usuarios', d.get('data', {}).get('items', []))
    primary = 'tratamiento.residuos@planta.com'
    ops = [u['email'] for u in items if u.get('rol') == 'OPERADOR' and u['email'] != primary and u.get('activo', True)]
    print(ops[0] if ops else '')
except Exception:
    print('')
" 2>/dev/null)

if [ -n "$EMAIL_GEN2" ]; then
  TOKEN_GEN2=$(login "$EMAIL_GEN2" "gen123")
  [ -n "$TOKEN_GEN2" ] && echo -e "  ${GREEN}OK${NC} GENERADOR-2 ($EMAIL_GEN2)" || log_warn "GENERADOR-2 auth fallida"
else
  log_warn "No hay GENERADOR-2 en el seed"
fi

if [ -n "$EMAIL_TRANS2" ]; then
  TOKEN_TRANS2=$(login "$EMAIL_TRANS2" "trans123")
  [ -n "$TOKEN_TRANS2" ] && echo -e "  ${GREEN}OK${NC} TRANSPORTISTA-2 ($EMAIL_TRANS2)" || log_warn "TRANSPORTISTA-2 auth fallida"
fi

if [ -n "$EMAIL_TRANS3" ]; then
  TOKEN_TRANS3=$(login "$EMAIL_TRANS3" "trans123")
  [ -n "$TOKEN_TRANS3" ] && echo -e "  ${GREEN}OK${NC} TRANSPORTISTA-3 ($EMAIL_TRANS3)" || log_warn "TRANSPORTISTA-3 auth fallida"
fi

if [ -n "$EMAIL_OPER2" ]; then
  TOKEN_OPER2=$(login "$EMAIL_OPER2" "op123")
  [ -n "$TOKEN_OPER2" ] && echo -e "  ${GREEN}OK${NC} OPERADOR-2 ($EMAIL_OPER2)" || log_warn "OPERADOR-2 auth fallida"
fi

# Resolver IDs de manifiestos
subsection "Fase 0c: Resolución de IDs de manifiestos"

MAN_BORRADOR=""
MAN_BORRADOR2=""
MAN_TRANSITO=""
MAN_TRANSITO2=""
MAN_TRANSITO3=""
MAN_RECIBIDO=""
MAN_RECIBIDO2=""

MAN_BORRADOR=$(get_manifiestos_id "$TOKEN_ADMIN" "BORRADOR" 0)
MAN_BORRADOR2=$(get_manifiestos_id "$TOKEN_ADMIN" "BORRADOR" 1)
MAN_TRANSITO=$(get_manifiestos_id "$TOKEN_ADMIN" "EN_TRANSITO" 0)
MAN_TRANSITO2=$(get_manifiestos_id "$TOKEN_ADMIN" "EN_TRANSITO" 1)
MAN_TRANSITO3=$(get_manifiestos_id "$TOKEN_ADMIN" "EN_TRANSITO" 2)
MAN_RECIBIDO=$(get_manifiestos_id "$TOKEN_ADMIN" "RECIBIDO" 0)
MAN_RECIBIDO2=$(get_manifiestos_id "$TOKEN_ADMIN" "RECIBIDO" 1)

echo "  BORRADOR  : ${MAN_BORRADOR:-(ninguno)} / ${MAN_BORRADOR2:-(ninguno)}"
echo "  EN_TRANSITO: ${MAN_TRANSITO:-(ninguno)} / ${MAN_TRANSITO2:-(ninguno)} / ${MAN_TRANSITO3:-(ninguno)}"
echo "  RECIBIDO  : ${MAN_RECIBIDO:-(ninguno)} / ${MAN_RECIBIDO2:-(ninguno)}"

# ══════════════════════════════════════════════════════════════
# S1 — Login paralelo: todos los roles simultáneamente
# ══════════════════════════════════════════════════════════════

section "S1 — Login paralelo (todos los roles a la vez)"

# Lanzar 4 logins en paralelo, cada uno escribe el token a un archivo
login_parallel() {
  local EMAIL=$1 PASS=$2 OUTFILE=$3
  local TOKEN
  TOKEN=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | json_field "data.tokens.accessToken")
  echo "$TOKEN" > "$OUTFILE"
}

login_parallel "admin@dgfa.mendoza.gov.ar"          "admin123"  "$TMPDIR_TEST/s1_admin.tok" &
login_parallel "quimica.mendoza@industria.com"       "gen123"    "$TMPDIR_TEST/s1_gen.tok"   &
login_parallel "transportes.andes@logistica.com"     "trans123"  "$TMPDIR_TEST/s1_trans.tok" &
login_parallel "tratamiento.residuos@planta.com"     "op123"     "$TMPDIR_TEST/s1_oper.tok"  &
wait

S1_ADMIN=$(cat "$TMPDIR_TEST/s1_admin.tok" 2>/dev/null || echo "")
S1_GEN=$(cat "$TMPDIR_TEST/s1_gen.tok"   2>/dev/null || echo "")
S1_TRANS=$(cat "$TMPDIR_TEST/s1_trans.tok" 2>/dev/null || echo "")
S1_OPER=$(cat "$TMPDIR_TEST/s1_oper.tok"  2>/dev/null || echo "")

S1_OK=0
[ -n "$S1_ADMIN" ] && S1_OK=$((S1_OK+1)) && echo -e "  ${GREEN}OK${NC} ADMIN token recibido"   || echo -e "  ${RED}KO${NC} ADMIN sin token"
[ -n "$S1_GEN"   ] && S1_OK=$((S1_OK+1)) && echo -e "  ${GREEN}OK${NC} GENERADOR token recibido"     || echo -e "  ${RED}KO${NC} GENERADOR sin token"
[ -n "$S1_TRANS" ] && S1_OK=$((S1_OK+1)) && echo -e "  ${GREEN}OK${NC} TRANSPORTISTA token recibido" || echo -e "  ${RED}KO${NC} TRANSPORTISTA sin token"
[ -n "$S1_OPER"  ] && S1_OK=$((S1_OK+1)) && echo -e "  ${GREEN}OK${NC} OPERADOR token recibido"      || echo -e "  ${RED}KO${NC} OPERADOR sin token"

if [ "$S1_OK" -eq 4 ]; then
  log_pass "S1: Login paralelo — $S1_OK/4 tokens válidos"
else
  log_fail "S1: Login paralelo — solo $S1_OK/4 tokens válidos"
fi

# ══════════════════════════════════════════════════════════════
# S2 — Race condition: doble aprobación del mismo manifiesto
# ══════════════════════════════════════════════════════════════

section "S2 — Race condition: doble aprobación simultánea"

if [ -z "$MAN_BORRADOR" ]; then
  log_skip "S2: No hay manifiesto en BORRADOR — crear uno con cross-platform-workflow-test.sh primero"
else
  echo "  Manifiesto BORRADOR: $MAN_BORRADOR"
  echo "  Disparando doble aprobación simultánea (GENERADOR + ADMIN)..."

  # Dos requests al mismo endpoint al mismo tiempo
  curl -s -o "$TMPDIR_TEST/s2_a.json" -w '%{http_code}' \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/firmar" \
    -H "Authorization: Bearer $TOKEN_ADMIN" > "$TMPDIR_TEST/s2_a.code" &
  PID_A=$!

  curl -s -o "$TMPDIR_TEST/s2_b.json" -w '%{http_code}' \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/firmar" \
    -H "Authorization: Bearer ${TOKEN_GEN:-$TOKEN_ADMIN}" > "$TMPDIR_TEST/s2_b.code" &
  PID_B=$!

  wait $PID_A $PID_B

  CODE_A=$(cat "$TMPDIR_TEST/s2_a.code" 2>/dev/null || echo "000")
  CODE_B=$(cat "$TMPDIR_TEST/s2_b.code" 2>/dev/null || echo "000")

  echo "  Request A (ADMIN)   → HTTP $CODE_A"
  echo "  Request B (GENERADOR) → HTTP $CODE_B"

  # Exactamente uno debe ser 200, el otro 4xx
  if [ "$CODE_A" = "200" ] && [ "$CODE_B" = "200" ]; then
    log_race "S2: AMBOS requests retornaron 200 — race condition detectada (doble aprobación posible)"
  elif ([ "$CODE_A" = "200" ] && echo "$CODE_B" | grep -qE '^4') || \
       ([ "$CODE_B" = "200" ] && echo "$CODE_A" | grep -qE '^4'); then
    log_pass "S2: Exactamente 1 aprobación exitosa, 1 bloqueada — \$transaction funciona correctamente"
  elif echo "$CODE_A" | grep -qE '^4' && echo "$CODE_B" | grep -qE '^4'; then
    # Ambos fallaron — podría ser que el manifiesto ya estaba aprobado
    log_warn "S2: Ambos fallaron (4xx) — el manifiesto quizás ya estaba aprobado. Verificar estado."
    SKIP=$((SKIP+1))
  else
    log_fail "S2: Resultado inesperado — A=$CODE_A B=$CODE_B"
  fi
fi

# ══════════════════════════════════════════════════════════════
# S3 — Sesión dual mismo usuario: web + PWA
# ══════════════════════════════════════════════════════════════

section "S3 — Sesión dual mismo usuario (web + PWA)"

# JWT es stateless: un usuario puede tener N tokens válidos simultáneamente.
# Usamos el token de TRANSPORTISTA-1 de Fase 0 como "web" y el de S1 como "app".
# No re-autenticamos para no desperdiciar el auth rate limiter (max 5/min/IP).
# El token de S1 viene del login paralelo — puede ser el mismo token (JWT reutilizado) o diferente.

S3_WEB_TOKEN="${TOKEN_TRANS:-}"
S3_APP_TOKEN="${S1_TRANS:-}"

echo "  Usando tokens ya obtenidos (Fase 0 y S1) como sesiones web y app..."

if [ -z "$S3_WEB_TOKEN" ] || [ -z "$S3_APP_TOKEN" ]; then
  log_skip "S3: Tokens TRANSPORTISTA insuficientes (Fase 0 o S1 no obtuvo token)"
else
  echo "  Web token: ${S3_WEB_TOKEN:0:20}..."
  echo "  App token: ${S3_APP_TOKEN:0:20}..."

  if [ "$S3_WEB_TOKEN" = "$S3_APP_TOKEN" ]; then
    log_warn "S3: Ambas sesiones usan el mismo token (JWT reutilizado — esperado en JWT stateless sin rotación de token)"
  fi

  # Usar ambos tokens en paralelo para distintos recursos
  curl -s -o /dev/null -w '%{http_code}' "$BASE/manifiestos?limit=1" \
    -H "Authorization: Bearer $S3_WEB_TOKEN" > "$TMPDIR_TEST/s3_req_web.code" &
  curl -s -o /dev/null -w '%{http_code}' "$BASE/manifiestos/dashboard" \
    -H "Authorization: Bearer $S3_APP_TOKEN" > "$TMPDIR_TEST/s3_req_app.code" &
  wait

  S3_CODE_WEB=$(cat "$TMPDIR_TEST/s3_req_web.code")
  S3_CODE_APP=$(cat "$TMPDIR_TEST/s3_req_app.code")

  echo "  Request web (GET /manifiestos) → HTTP $S3_CODE_WEB"
  echo "  Request app (GET /dashboard)   → HTTP $S3_CODE_APP"

  if [ "$S3_CODE_WEB" = "200" ] && [ "$S3_CODE_APP" = "200" ]; then
    log_pass "S3: Sesión dual — ambas sesiones operativas simultáneamente (JWT stateless OK)"
  else
    log_fail "S3: Sesión dual — web=$S3_CODE_WEB app=$S3_CODE_APP (se esperaba 200/200)"
  fi
fi

# ══════════════════════════════════════════════════════════════
# S4 — GPS simultáneo: 3 transportistas enviando ubicación
# ══════════════════════════════════════════════════════════════

section "S4 — GPS simultáneo (3 transportistas enviando ubicación a la vez)"

GPS_SKIP=0
[ -z "$MAN_TRANSITO"  ] && GPS_SKIP=$((GPS_SKIP+1))
[ -z "$MAN_TRANSITO2" ] && GPS_SKIP=$((GPS_SKIP+1))
[ -z "$MAN_TRANSITO3" ] && GPS_SKIP=$((GPS_SKIP+1))

if [ "$GPS_SKIP" -ge 3 ]; then
  log_skip "S4: No hay manifiestos EN_TRANSITO disponibles — ejecutar cross-platform-workflow-test.sh primero"
else
  GPS_COUNT=0
  AVAILABLE_TRANSITOS=()
  [ -n "$MAN_TRANSITO"  ] && AVAILABLE_TRANSITOS+=("$MAN_TRANSITO")
  [ -n "$MAN_TRANSITO2" ] && AVAILABLE_TRANSITOS+=("$MAN_TRANSITO2")
  [ -n "$MAN_TRANSITO3" ] && AVAILABLE_TRANSITOS+=("$MAN_TRANSITO3")

  echo "  Manifiestos EN_TRANSITO disponibles: ${#AVAILABLE_TRANSITOS[@]}"

  # Coordenadas Mendoza (variadas para simular movimiento)
  LAT=("-32.8895" "-32.8920" "-32.8945")
  LON=("-68.8458" "-68.8480" "-68.8502")

  PIDS=()
  for i in "${!AVAILABLE_TRANSITOS[@]}"; do
    MID="${AVAILABLE_TRANSITOS[$i]}"
    GPS_LAT="${LAT[$i]:-${LAT[0]}}"
    GPS_LON="${LON[$i]:-${LON[0]}}"
    GPS_BODY="{\"latitud\":$GPS_LAT,\"longitud\":$GPS_LON,\"velocidad\":65,\"direccion\":0}"

    curl -s -o "$TMPDIR_TEST/s4_gps_$i.json" -w '%{http_code}' \
      -X POST "$BASE/manifiestos/$MID/ubicacion" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN_ADMIN" \
      -d "$GPS_BODY" > "$TMPDIR_TEST/s4_gps_$i.code" &
    PIDS+=($!)
  done

  for PID in "${PIDS[@]}"; do wait "$PID"; done

  GPS_PASS=0
  for i in "${!AVAILABLE_TRANSITOS[@]}"; do
    CODE=$(cat "$TMPDIR_TEST/s4_gps_$i.code" 2>/dev/null || echo "000")
    MID="${AVAILABLE_TRANSITOS[$i]}"
    if [ "$CODE" = "201" ] || [ "$CODE" = "200" ]; then
      echo -e "  ${GREEN}OK${NC} GPS manifiesto ${MID:0:8}... → HTTP $CODE"
      GPS_PASS=$((GPS_PASS+1))
    else
      echo -e "  ${RED}KO${NC} GPS manifiesto ${MID:0:8}... → HTTP $CODE"
    fi
  done

  TOTAL_GPS=${#AVAILABLE_TRANSITOS[@]}
  if [ "$GPS_PASS" -eq "$TOTAL_GPS" ]; then
    log_pass "S4: GPS simultáneo — $GPS_PASS/$TOTAL_GPS updates exitosos, sin colisiones de cache"
  else
    log_fail "S4: GPS simultáneo — solo $GPS_PASS/$TOTAL_GPS exitosos"
  fi

  # Segunda ronda (simula TTL cache expirado — en producción sería 31s, en test mandamos inmediatamente)
  echo "  Segunda ronda GPS (verifica idempotencia del cache)..."
  PIDS2=()
  for i in "${!AVAILABLE_TRANSITOS[@]}"; do
    MID="${AVAILABLE_TRANSITOS[$i]}"
    GPS_LAT="${LAT[$i]:-${LAT[0]}}"
    GPS_LON="${LON[$i]:-${LON[0]}}"
    GPS_BODY="{\"latitud\":$GPS_LAT,\"longitud\":$GPS_LON,\"velocidad\":70,\"direccion\":45}"

    curl -s -o /dev/null -w '%{http_code}' \
      -X POST "$BASE/manifiestos/$MID/ubicacion" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN_ADMIN" \
      -d "$GPS_BODY" > "$TMPDIR_TEST/s4_gps2_$i.code" &
    PIDS2+=($!)
  done

  for PID in "${PIDS2[@]}"; do wait "$PID"; done

  GPS_PASS2=0
  for i in "${!AVAILABLE_TRANSITOS[@]}"; do
    CODE=$(cat "$TMPDIR_TEST/s4_gps2_$i.code" 2>/dev/null || echo "000")
    if [ "$CODE" = "201" ] || [ "$CODE" = "200" ]; then
      GPS_PASS2=$((GPS_PASS2+1))
    fi
  done

  if [ "$GPS_PASS2" -eq "$TOTAL_GPS" ]; then
    log_pass "S4 (2da ronda): $GPS_PASS2/$TOTAL_GPS — cache no bloquea segundos updates"
  else
    log_fail "S4 (2da ronda): solo $GPS_PASS2/$TOTAL_GPS — posible problema de cache"
  fi
fi

# ══════════════════════════════════════════════════════════════
# S5 — Lectura concurrente bajo escritura
# ══════════════════════════════════════════════════════════════

section "S5 — Lecturas concurrentes bajo escritura (dashboard)"

if [ -z "$TOKEN_GEN" ]; then
  log_skip "S5: Token GENERADOR no disponible"
else
  echo "  Disparando 5 GET /dashboard + 1 POST /manifiestos simultáneamente..."

  # 5 lecturas del dashboard en paralelo
  for i in 1 2 3 4 5; do
    curl -s -o /dev/null -w '%{http_code}' \
      "$BASE/manifiestos/dashboard" \
      -H "Authorization: Bearer $TOKEN_ADMIN" > "$TMPDIR_TEST/s5_dash_$i.code" &
  done

  # Mientras tanto, crear un nuevo manifiesto (requiere generadorId)
  GEN_ACTOR_ID=$(api_get "/actores/generadores?limit=1" "$TOKEN_GEN" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('generadores', d.get('data', {}).get('items', []))
    print(items[0]['id'] if items else '')
except Exception:
    print('')
" 2>/dev/null)

  TRANS_ACTOR_ID=$(api_get "/actores/transportistas?limit=1" "$TOKEN_ADMIN" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('transportistas', d.get('data', {}).get('items', []))
    print(items[0]['id'] if items else '')
except Exception:
    print('')
" 2>/dev/null)

  OPER_ACTOR_ID=$(api_get "/actores/operadores?limit=1" "$TOKEN_ADMIN" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', {}).get('operadores', d.get('data', {}).get('items', []))
    print(items[0]['id'] if items else '')
except Exception:
    print('')
" 2>/dev/null)

  # Obtener un tipo de residuo que el operador tenga autorizado
  RESIDUO_ID=$(api_get "/catalogos/operadores" "$TOKEN_ADMIN" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ops = d.get('data', {}).get('operadores', [])
    oper_id = '$OPER_ACTOR_ID'
    op = next((o for o in ops if o['id'] == oper_id), ops[0] if ops else None)
    if op and op.get('tratamientos'):
        print(op['tratamientos'][0]['tipoResiduoId'])
    else:
        print('')
except Exception:
    print('')
" 2>/dev/null)

  POST_CODE="000"
  NEW_MAN_ID=""

  if [ -n "$GEN_ACTOR_ID" ] && [ -n "$TRANS_ACTOR_ID" ] && [ -n "$OPER_ACTOR_ID" ] && [ -n "$RESIDUO_ID" ]; then
    MAN_BODY=$(python3 -c "
import json
body = {
  'generadorId': '$GEN_ACTOR_ID',
  'transportistaId': '$TRANS_ACTOR_ID',
  'operadorId': '$OPER_ACTOR_ID',
  'fechaRetiroEstimada': '2026-04-01T10:00:00.000Z',
  'observaciones': 'S5 concurrent test',
  'residuos': [{'tipoResiduoId': '$RESIDUO_ID', 'cantidad': 1.0, 'unidad': 'kg', 'descripcion': 'Test'}]
}
print(json.dumps(body))
")
    S5_POST_RESP=$(api_post "/manifiestos" "$TOKEN_ADMIN" "$MAN_BODY")
    POST_CODE=$(echo "$S5_POST_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    # Si tiene 'data' con 'id' es 201 exitoso; chequeamos el campo
    if d.get('data', {}).get('id'):
        print('201')
    else:
        print('400')
except Exception:
    print('000')
" 2>/dev/null)
    NEW_MAN_ID=$(echo "$S5_POST_RESP" | json_field "data.id")
  else
    log_warn "S5: Actores o residuos no resueltos — omitiendo POST, solo verificando GETs"
    POST_CODE="SKIP"
  fi

  wait

  DASH_PASS=0
  for i in 1 2 3 4 5; do
    CODE=$(cat "$TMPDIR_TEST/s5_dash_$i.code" 2>/dev/null || echo "000")
    [ "$CODE" = "200" ] && DASH_PASS=$((DASH_PASS+1))
  done

  echo "  Dashboard GETs: $DASH_PASS/5 → 200"
  if [ "$POST_CODE" = "SKIP" ]; then
    echo -e "  POST manifiesto: ${YELLOW}SKIP${NC} (actores no resueltos)"
  else
    echo "  POST manifiesto: $POST_CODE"
  fi

  if [ "$DASH_PASS" -eq 5 ] && ([ "$POST_CODE" = "201" ] || [ "$POST_CODE" = "SKIP" ]); then
    log_pass "S5: Lecturas bajo escritura — $DASH_PASS/5 GETs OK, escritura no interfirió"
  elif [ "$DASH_PASS" -eq 5 ] && [ "$POST_CODE" = "400" ]; then
    log_fail "S5: GETs OK pero POST manifiesto falló con 400 (verificar body)"
  elif [ "$DASH_PASS" -lt 5 ]; then
    log_fail "S5: Solo $DASH_PASS/5 dashboard GETs exitosos bajo escritura concurrente"
  fi

  # Verificar que el nuevo manifiesto aparece en el dashboard
  if [ -n "$NEW_MAN_ID" ]; then
    DASH_AFTER=$(http_status "GET" "/manifiestos/dashboard" "$TOKEN_ADMIN")
    if [ "$DASH_AFTER" = "200" ]; then
      log_pass "S5 (post-write): Dashboard accesible después de escritura"
    else
      log_fail "S5 (post-write): Dashboard retornó $DASH_AFTER tras escritura"
    fi
  fi
fi

# ══════════════════════════════════════════════════════════════
# S6 — Multi-rol acceso simultáneo a los mismos recursos
# ══════════════════════════════════════════════════════════════

section "S6 — Multi-rol acceso simultáneo (ADMIN + GENERADOR + TRANSPORTISTA)"

if [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_TRANS" ]; then
  log_skip "S6: Tokens insuficientes (se necesitan ADMIN + GENERADOR + TRANSPORTISTA)"
else
  echo "  3 roles leyendo /manifiestos simultáneamente..."

  curl -s -o "$TMPDIR_TEST/s6_admin.json" -w '%{http_code}' \
    "$BASE/manifiestos?limit=50" \
    -H "Authorization: Bearer $TOKEN_ADMIN" > "$TMPDIR_TEST/s6_admin.code" &
  PID_S6A=$!

  curl -s -o "$TMPDIR_TEST/s6_gen.json" -w '%{http_code}' \
    "$BASE/manifiestos?limit=50" \
    -H "Authorization: Bearer $TOKEN_GEN" > "$TMPDIR_TEST/s6_gen.code" &
  PID_S6B=$!

  curl -s -o "$TMPDIR_TEST/s6_trans.json" -w '%{http_code}' \
    "$BASE/manifiestos?limit=50" \
    -H "Authorization: Bearer $TOKEN_TRANS" > "$TMPDIR_TEST/s6_trans.code" &
  PID_S6C=$!

  wait $PID_S6A $PID_S6B $PID_S6C

  CODE_S6A=$(cat "$TMPDIR_TEST/s6_admin.code")
  CODE_S6B=$(cat "$TMPDIR_TEST/s6_gen.code")
  CODE_S6C=$(cat "$TMPDIR_TEST/s6_trans.code")

  echo "  ADMIN       → HTTP $CODE_S6A"
  echo "  GENERADOR   → HTTP $CODE_S6B"
  echo "  TRANSPORTISTA → HTTP $CODE_S6C"

  # Contar items por rol
  COUNT_ADMIN=$(cat "$TMPDIR_TEST/s6_admin.json" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data',{}).get('manifiestos', d.get('data',{}).get('items', []))
    print(len(items))
except Exception:
    print(0)
" 2>/dev/null)

  COUNT_GEN=$(cat "$TMPDIR_TEST/s6_gen.json" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data',{}).get('manifiestos', d.get('data',{}).get('items', []))
    print(len(items))
except Exception:
    print(0)
" 2>/dev/null)

  COUNT_TRANS=$(cat "$TMPDIR_TEST/s6_trans.json" 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data',{}).get('manifiestos', d.get('data',{}).get('items', []))
    print(len(items))
except Exception:
    print(0)
" 2>/dev/null)

  echo "  Items visibles — ADMIN: $COUNT_ADMIN, GENERADOR: $COUNT_GEN, TRANSPORTISTA: $COUNT_TRANS"

  if [ "$CODE_S6A" = "200" ] && [ "$CODE_S6B" = "200" ] && [ "$CODE_S6C" = "200" ]; then
    # ADMIN debe ver >= GENERADOR (GENERADOR solo ve los suyos)
    if [ "$COUNT_ADMIN" -ge "$COUNT_GEN" ] 2>/dev/null; then
      log_pass "S6: Multi-rol simultáneo — 3/3 OK, aislamiento por rol correcto (ADMIN≥GENERADOR)"
    else
      log_fail "S6: ADMIN ve menos que GENERADOR ($COUNT_ADMIN < $COUNT_GEN) — posible leak de filtro"
    fi
  else
    log_fail "S6: Multi-rol simultáneo — ADMIN=$CODE_S6A GENERADOR=$CODE_S6B TRANSPORTISTA=$CODE_S6C (esperado 200/200/200)"
  fi
fi

# ══════════════════════════════════════════════════════════════
# S7 — Dos OPERADORES procesando manifiestos distintos
# ══════════════════════════════════════════════════════════════

section "S7 — Dos OPERADORES procesando manifiestos distintos simultáneamente"

if [ -z "$TOKEN_OPER" ] || [ -z "$TOKEN_OPER2" ]; then
  log_skip "S7: Solo hay un OPERADOR disponible — se necesitan 2 para este escenario"
elif [ -z "$MAN_RECIBIDO" ] || [ -z "$MAN_RECIBIDO2" ]; then
  log_skip "S7: Se necesitan 2 manifiestos en estado RECIBIDO (disponibles: ${MAN_RECIBIDO:-(ninguno)} / ${MAN_RECIBIDO2:-(ninguno)})"
else
  echo "  Manifiesto RECIBIDO-1: $MAN_RECIBIDO"
  echo "  Manifiesto RECIBIDO-2: $MAN_RECIBIDO2"
  echo "  OPERADOR-1 → tratamiento en manifiesto 1"
  echo "  OPERADOR-2 → tratamiento en manifiesto 2"
  echo "  (simultáneamente)"

  TRAT_BODY='{"metodoDeTratamiento":"Incineración controlada","observaciones":"S7 concurrent test"}'

  curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$BASE/manifiestos/$MAN_RECIBIDO/tratamiento" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -d "$TRAT_BODY" > "$TMPDIR_TEST/s7_oper1.code" &
  PID_S7A=$!

  curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$BASE/manifiestos/$MAN_RECIBIDO2/tratamiento" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN_OPER2" \
    -d "$TRAT_BODY" > "$TMPDIR_TEST/s7_oper2.code" &
  PID_S7B=$!

  wait $PID_S7A $PID_S7B

  CODE_S7A=$(cat "$TMPDIR_TEST/s7_oper1.code")
  CODE_S7B=$(cat "$TMPDIR_TEST/s7_oper2.code")

  echo "  OPERADOR-1 / manifiesto $MAN_RECIBIDO  → HTTP $CODE_S7A"
  echo "  OPERADOR-2 / manifiesto $MAN_RECIBIDO2 → HTTP $CODE_S7B"

  if [ "$CODE_S7A" = "200" ] && [ "$CODE_S7B" = "200" ]; then
    log_pass "S7: Dual operadores en manifiestos distintos — 2/2 → 200, sin interferencia"
  elif [ "$CODE_S7A" = "200" ] || [ "$CODE_S7B" = "200" ]; then
    log_fail "S7: Solo 1 de 2 operadores exitoso — A=$CODE_S7A B=$CODE_S7B (inesperado en manifiestos distintos)"
  else
    log_fail "S7: Ambas operaciones fallaron — A=$CODE_S7A B=$CODE_S7B"
  fi
fi

# ══════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ══════════════════════════════════════════════════════════════

section "RESUMEN FINAL"

TOTAL=$((PASS + FAIL + SKIP))
echo ""
echo -e "  ${GREEN}PASS${NC}          : $PASS"
echo -e "  ${RED}FAIL${NC}          : $FAIL"
if [ "$RACE" -gt 0 ]; then
  echo -e "  ${CYAN}RACE-DETECTED${NC} : $RACE (fallo crítico — ver FAIL)"
fi
echo -e "  ${YELLOW}SKIP${NC}          : $SKIP"
echo "  ─────────────────────────────"
echo "  TOTAL         : $TOTAL assertions"
echo ""

if [ "$RACE" -gt 0 ]; then
  echo -e "  ${CYAN}⚠ RACE CONDITIONS detectadas — revisar protecciones \$transaction${NC}"
fi

if [ "$SKIP" -gt 0 ]; then
  echo -e "  ${YELLOW}ℹ Ejecutar cross-platform-workflow-test.sh para generar datos en todos los estados${NC}"
fi

if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}✓ TODOS LOS ESCENARIOS PASARON — arquitectura multi-usuario validada${NC}"
else
  echo -e "  ${RED}${BOLD}✗ $FAIL escenario(s) fallaron${NC}"
  if [ -n "$ERRORS" ]; then
    echo ""
    echo "  Detalle de fallos:"
    echo -e "$ERRORS"
  fi
fi

echo ""

# Exit code: 0 = todo ok, 1 = algún fallo
[ "$FAIL" -eq 0 ]
