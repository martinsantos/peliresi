#!/bin/bash
# Role Enforcement Test — SITREP
# Verifica que NINGÚN rol puede ejecutar acciones fuera de sus permisos.
# Uso: bash backend/tests/role-enforcement-test.sh [BASE_URL]
# Ejemplo: bash backend/tests/role-enforcement-test.sh http://localhost:3010

set -uo pipefail

_INPUT="${1:-https://sitrep.ultimamilla.com.ar}"
BASE="${_INPUT%/}"
# Ensure /api suffix
[[ "$BASE" != */api ]] && BASE="$BASE/api"

TRAINING_PREFIX="${TRAINING_PREFIX:-CAP-20260702}"
TRAINING_PASSWORD="${TRAINING_PASSWORD:-CapacitacionRP2026!}"

PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   SITREP — Role Enforcement Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

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
  case "$(host_from_url "$BASE")" in
    rptrazar.mendoza.gov.ar|sitrepprd1.mendoza.gov.ar) return 0 ;;
    *) return 1 ;;
  esac
}

# ── Helper: assert HTTP status ────────────────────────────────────
assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} [HTTP $actual] $desc"
    ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [expected HTTP $expected, got $actual] $desc"
    ((FAIL++))
  fi
}

# ── Helper: login → token ─────────────────────────────────────────
login() {
  local email="$1" password="$2"
  curl -sS --max-time 15 -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" | json_get "data.tokens.accessToken"
}

api_get() {
  local path="$1" token="$2"
  curl -sS --max-time 20 -H "Authorization: Bearer $token" "$BASE$path"
}

manifest_id_by_number() {
  local number="$1"
  curl -sS --max-time 20 -G \
    -H "Authorization: Bearer $TOKEN_ADMIN" \
    --data-urlencode "search=$number" \
    --data-urlencode "limit=20" \
    "$BASE/manifiestos" | NUMBER="$number" python3 -c '
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

ASSERTED_MANIFEST_ID=""
assert_demo_manifest() {
  local number="$1" expected_state="$2"
  local id detail actual_number is_demo state

  ASSERTED_MANIFEST_ID=""
  id="$(manifest_id_by_number "$number")"
  if [ -z "$id" ]; then
    echo -e "  ${RED}FAIL${NC} No se encontro manifiesto demo $number"
    FAIL=$((FAIL + 1))
    return 1
  fi

  detail="$(api_get "/manifiestos/$id" "$TOKEN_ADMIN")"
  actual_number="$(printf "%s" "$detail" | json_get "data.manifiesto.numero")"
  is_demo="$(printf "%s" "$detail" | json_get "data.manifiesto.isDemoData")"
  state="$(printf "%s" "$detail" | json_get "data.manifiesto.estado")"

  if [ "$actual_number" != "$number" ]; then
    echo -e "  ${RED}FAIL${NC} $number detalle inconsistente: numero=$actual_number"
    FAIL=$((FAIL + 1))
    return 1
  fi
  if [ "$is_demo" != "true" ]; then
    echo -e "  ${RED}FAIL${NC} $number no tiene isDemoData=true"
    FAIL=$((FAIL + 1))
    return 1
  fi
  if [[ "$number" != "$TRAINING_PREFIX"-* ]]; then
    echo -e "  ${RED}FAIL${NC} $number no usa prefijo $TRAINING_PREFIX"
    FAIL=$((FAIL + 1))
    return 1
  fi
  if [ "$state" != "$expected_state" ]; then
    echo -e "  ${RED}FAIL${NC} $number estado esperado $expected_state, actual $state"
    FAIL=$((FAIL + 1))
    return 1
  fi

  ASSERTED_MANIFEST_ID="$id"
  echo -e "  ${GREEN}OK${NC} $number guard demo (estado=$state, id=${id:0:8})"
  return 0
}

# ── Obtener tokens ────────────────────────────────────────────────
echo ""
echo "Autenticando 4 roles..."
if is_real_production_target; then
  echo "Produccion Gobierno detectada: usando usuarios de capacitacion para roles no ADMIN."
  ADMIN_EMAIL="${CERT_ADMIN_EMAIL:-admin@dgfa.mendoza.gov.ar}"
  ADMIN_PASSWORD="${CERT_ADMIN_PASSWORD:-admin123}"
  GEN_EMAIL="${TRAINING_GEN_EMAIL:-capacitacion.generador@rptrazar.mendoza.gov.ar}"
  GEN_PASSWORD="$TRAINING_PASSWORD"
  TRANS_EMAIL="${TRAINING_TRANS_EMAIL:-capacitacion.transportista@rptrazar.mendoza.gov.ar}"
  TRANS_PASSWORD="$TRAINING_PASSWORD"
  OPER_EMAIL="${TRAINING_OPER_EMAIL:-capacitacion.operador@rptrazar.mendoza.gov.ar}"
  OPER_PASSWORD="$TRAINING_PASSWORD"
else
  ADMIN_EMAIL="${CERT_ADMIN_EMAIL:-admin@dgfa.mendoza.gov.ar}"
  ADMIN_PASSWORD="${CERT_ADMIN_PASSWORD:-admin123}"
  GEN_EMAIL="${GEN_EMAIL:-quimica.mendoza@industria.com}"
  GEN_PASSWORD="${GEN_PASSWORD:-gen123}"
  TRANS_EMAIL="${TRANS_EMAIL:-transportes.andes@logistica.com}"
  TRANS_PASSWORD="${TRANS_PASSWORD:-trans123}"
  OPER_EMAIL="${OPER_EMAIL:-tratamiento.residuos@planta.com}"
  OPER_PASSWORD="${OPER_PASSWORD:-op123}"
fi

TOKEN_ADMIN=$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")
sleep 1
TOKEN_GEN=$(login "$GEN_EMAIL" "$GEN_PASSWORD")
sleep 1
TOKEN_TRANS=$(login "$TRANS_EMAIL" "$TRANS_PASSWORD")
sleep 1
TOKEN_OPER=$(login "$OPER_EMAIL" "$OPER_PASSWORD")

[ -n "$TOKEN_ADMIN" ] && echo -e "  ${GREEN}OK${NC} ADMIN token" || echo -e "  ${RED}ERROR${NC} No se pudo autenticar ADMIN"
[ -n "$TOKEN_GEN" ]   && echo -e "  ${GREEN}OK${NC} GENERADOR token" || echo -e "  ${RED}ERROR${NC} No se pudo autenticar GENERADOR"
[ -n "$TOKEN_TRANS" ] && echo -e "  ${GREEN}OK${NC} TRANSPORTISTA token" || echo -e "  ${RED}ERROR${NC} No se pudo autenticar TRANSPORTISTA"
[ -n "$TOKEN_OPER" ]  && echo -e "  ${GREEN}OK${NC} OPERADOR token" || echo -e "  ${RED}ERROR${NC} No se pudo autenticar OPERADOR"

if [ -z "$TOKEN_ADMIN" ] || [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_TRANS" ] || [ -z "$TOKEN_OPER" ]; then
  echo -e "${RED}ERROR CRÍTICO: No se pudieron obtener tokens. Abortando.${NC}"
  exit 1
fi

# ── Obtener IDs dinámicos ─────────────────────────────────────────
echo ""
echo "Obteniendo IDs de manifiestos para tests de workflow..."

if is_real_production_target; then
  echo "Guardando seleccion de manifiestos: solo $TRAINING_PREFIX con isDemoData=true."

  if assert_demo_manifest "${TRAINING_PREFIX}-0001" "BORRADOR"; then
    MAN_BORRADOR="$ASSERTED_MANIFEST_ID"
  else
    MAN_BORRADOR=""
  fi

  if assert_demo_manifest "${TRAINING_PREFIX}-0003" "EN_TRANSITO"; then
    MAN_TRANSITO="$ASSERTED_MANIFEST_ID"
  else
    MAN_TRANSITO=""
  fi

  if assert_demo_manifest "${TRAINING_PREFIX}-0002" "APROBADO"; then
    MAN_APROBADO="$ASSERTED_MANIFEST_ID"
  else
    MAN_APROBADO=""
  fi

  if [ -z "$MAN_BORRADOR" ] || [ -z "$MAN_TRANSITO" ] || [ -z "$MAN_APROBADO" ]; then
    echo -e "${RED}ERROR CRÍTICO: dataset de capacitacion no esta listo. Ejecutar seed/reset antes de production-smoke.${NC}"
    exit 1
  fi
else
  MAN_BORRADOR=$(curl -sS --max-time 20 -H "Authorization: Bearer $TOKEN_ADMIN" \
    "$BASE/manifiestos?estado=BORRADOR&limit=1" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

  MAN_TRANSITO=$(curl -sS --max-time 20 -H "Authorization: Bearer $TOKEN_ADMIN" \
    "$BASE/manifiestos?estado=EN_TRANSITO&limit=1" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

  MAN_APROBADO=$(curl -sS --max-time 20 -H "Authorization: Bearer $TOKEN_ADMIN" \
    "$BASE/manifiestos?estado=APROBADO&limit=1" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)
fi

[ -n "$MAN_BORRADOR" ] && echo -e "  BORRADOR: $MAN_BORRADOR" || echo -e "  ${YELLOW}WARN${NC} No hay manifiestos BORRADOR"
[ -n "$MAN_TRANSITO" ] && echo -e "  EN_TRANSITO: $MAN_TRANSITO" || echo -e "  ${YELLOW}WARN${NC} No hay manifiestos EN_TRANSITO"
[ -n "$MAN_APROBADO" ] && echo -e "  APROBADO: $MAN_APROBADO" || echo -e "  ${YELLOW}WARN${NC} No hay manifiestos APROBADO"

# ════════════════════════════════════════════════════════════════════
# BLOQUE 1 — Sin autenticación
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}── Bloque 1: Sin autenticación ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/manifiestos")
assert_status "GET /manifiestos sin token → 401" "401" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer INVALID_TOKEN_XYZ_12345" "$BASE/manifiestos")
assert_status "GET /manifiestos token inválido → 401" "401" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/admin/usuarios")
assert_status "GET /admin/usuarios sin token → 401" "401" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/reportes/manifiestos")
assert_status "GET /reportes sin token → 401" "401" "$S"

# ════════════════════════════════════════════════════════════════════
# BLOQUE 2 — GENERADOR: no puede hacer acciones de otros roles
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}── Bloque 2: GENERADOR no puede hacer acciones de otros roles ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_GEN" "$BASE/admin/usuarios")
assert_status "GENERADOR → GET /admin/usuarios → 403" "403" "$S"

if [ -n "$MAN_BORRADOR" ]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN_GEN" -H "Content-Type: application/json" \
    -d '{}' "$BASE/manifiestos/$MAN_BORRADOR/confirmar-retiro")
  assert_status "GENERADOR → confirmar-retiro (acción TRANSPORTISTA) → 403" "403" "$S"
fi

if [ -n "$MAN_APROBADO" ]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN_GEN" -H "Content-Type: application/json" \
    -d '{}' "$BASE/manifiestos/$MAN_APROBADO/confirmar-retiro")
  assert_status "GENERADOR → confirmar-retiro (APROBADO, acción TRANSPORTISTA) → 403" "403" "$S"
fi

# ════════════════════════════════════════════════════════════════════
# BLOQUE 3 — TRANSPORTISTA: no puede firmar/crear manifiestos
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}── Bloque 3: TRANSPORTISTA no puede firmar ni crear manifiestos ──${NC}"

if [ -n "$MAN_BORRADOR" ]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN_TRANS" -H "Content-Type: application/json" \
    -d '{}' "$BASE/manifiestos/$MAN_BORRADOR/firmar")
  assert_status "TRANSPORTISTA → aprobar (acción GENERADOR) → 403" "403" "$S"
fi

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN_TRANS" -H "Content-Type: application/json" \
  -d '{"transportistaId":"x","operadorId":"y","residuos":[]}' "$BASE/manifiestos")
assert_status "TRANSPORTISTA → POST /manifiestos (acción GENERADOR) → 403" "403" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_TRANS" "$BASE/admin/usuarios")
assert_status "TRANSPORTISTA → GET /admin/usuarios → 403" "403" "$S"

# ════════════════════════════════════════════════════════════════════
# BLOQUE 4 — OPERADOR: no puede crear manifiestos ni adminear
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}── Bloque 4: OPERADOR no puede crear manifiestos ni acceder a admin ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN_OPER" -H "Content-Type: application/json" \
  -d '{"transportistaId":"x","operadorId":"y","residuos":[]}' "$BASE/manifiestos")
assert_status "OPERADOR → POST /manifiestos → 403" "403" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_OPER" "$BASE/admin/usuarios")
assert_status "OPERADOR → GET /admin/usuarios → 403" "403" "$S"

if [ -n "$MAN_BORRADOR" ]; then
  S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $TOKEN_OPER" -H "Content-Type: application/json" \
    -d '{}' "$BASE/manifiestos/$MAN_BORRADOR/firmar")
  assert_status "OPERADOR → aprobar (acción GENERADOR) → 403" "403" "$S"
fi

# ════════════════════════════════════════════════════════════════════
# BLOQUE 5 — ADMIN: tiene acceso total
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}── Bloque 5: ADMIN tiene acceso total ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/admin/usuarios")
assert_status "ADMIN → GET /admin/usuarios → 200" "200" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/reportes/manifiestos")
assert_status "ADMIN → GET /reportes/manifiestos → 200" "200" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/manifiestos/dashboard")
assert_status "ADMIN → GET /manifiestos/dashboard → 200" "200" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/actores/transportistas")
assert_status "ADMIN → GET /actores/transportistas → 200" "200" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/analytics/manifiestos-por-estado")
assert_status "ADMIN → GET /analytics/manifiestos-por-estado → 200" "200" "$S"

# ════════════════════════════════════════════════════════════════════
# RESUMEN
# ════════════════════════════════════════════════════════════════════
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  PASS: ${GREEN}$PASS${NC}"
echo -e "  FAIL: ${RED}$FAIL${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  TOTAL: $TOTAL tests"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}ALL ROLE ENFORCEMENT TESTS PASSED — 0 BYPASSES${NC}"
  exit 0
else
  echo -e "${RED}ROLE ENFORCEMENT FAILURES: $FAIL bypass(es) detected${NC}"
  exit 1
fi
