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
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$2\"}" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null
}

# ── Obtener tokens ────────────────────────────────────────────────
echo ""
echo "Autenticando 4 roles..."
TOKEN_ADMIN=$(login "admin@dgfa.mendoza.gov.ar" "admin123")
sleep 1
TOKEN_GEN=$(login "quimica.mendoza@industria.com" "gen123")
sleep 1
TOKEN_TRANS=$(login "transportes.andes@logistica.com" "trans123")
sleep 1
TOKEN_OPER=$(login "tratamiento.residuos@planta.com" "op123")

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

MAN_BORRADOR=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=BORRADOR&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_TRANSITO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=EN_TRANSITO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_APROBADO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=APROBADO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

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
