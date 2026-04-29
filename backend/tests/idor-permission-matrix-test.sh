#!/bin/bash
# IDOR Permission Matrix Test — SITREP
# Cross-product matrix of restricted endpoints vs roles.
# Asserts that unauthorized roles get 403, authorized roles get 200.
# Uso: bash backend/tests/idor-permission-matrix-test.sh [BASE_URL]
set -uo pipefail

_INPUT="${1:-https://sitrep.ultimamilla.com.ar}"
BASE="${_INPUT%/}"
[[ "$BASE" != */api ]] && BASE="$BASE/api"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
PASS=0
FAIL=0
SKIP=0

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   SITREP — IDOR Permission Matrix Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} [HTTP $actual] $desc"; ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [expected $expected, got $actual] $desc"; ((FAIL++))
  fi
}

login() {
  local email="$1" password="$2"
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null
}

echo ""
echo "Autenticando 4 roles..."
TOKEN_ADMIN=$(login "admin@dgfa.mendoza.gov.ar" "admin123")
sleep 1
TOKEN_GEN=$(login "quimica.mendoza@industria.com" "gen123")
sleep 1
TOKEN_TRANS=$(login "transportes.andes@logistica.com" "trans123")
sleep 1
TOKEN_OPER=$(login "tratamiento.residuos@planta.com" "op123")

[ -n "$TOKEN_ADMIN" ] && echo -e "  ${GREEN}OK${NC} ADMIN"   || echo -e "  ${RED}ERROR${NC} ADMIN"
[ -n "$TOKEN_GEN" ]   && echo -e "  ${GREEN}OK${NC} GENERADOR" || echo -e "  ${RED}ERROR${NC} GENERADOR"
[ -n "$TOKEN_TRANS" ] && echo -e "  ${GREEN}OK${NC} TRANSPORTISTA" || echo -e "  ${RED}ERROR${NC} TRANSPORTISTA"
[ -n "$TOKEN_OPER" ]  && echo -e "  ${GREEN}OK${NC} OPERADOR" || echo -e "  ${RED}ERROR${NC} OPERADOR"

if [ -z "$TOKEN_ADMIN" ] || [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_TRANS" ] || [ -z "$TOKEN_OPER" ]; then
  echo -e "${RED}ERROR CRÍTICO: No se pudieron obtener tokens.${NC}"
  exit 1
fi

# ── Resolve dynamic IDs ──────────────────────────────────────────
echo ""
echo "Obteniendo IDs de manifiestos..."
MAN_BORRADOR=""; MAN_APROBADO=""; MAN_TRANSITO=""
MAN_ENTREGADO=""; MAN_RECIBIDO=""; MAN_TRATADO=""

MAN_BORRADOR=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=BORRADOR&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_TRANSITO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=EN_TRANSITO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_ENTREGADO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=ENTREGADO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_APROBADO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=APROBADO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_RECIBIDO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=RECIBIDO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

MAN_TRATADO=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=TRATADO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

echo "  BORRADOR=${MAN_BORRADOR:-none}  APROBADO=${MAN_APROBADO:-none}  EN_TRANSITO=${MAN_TRANSITO:-none}  ENTREGADO=${MAN_ENTREGADO:-none}  RECIBIDO=${MAN_RECIBIDO:-none}  TRATADO=${MAN_TRATADO:-none}"

echo ""
echo -e "${CYAN}═══ Section 1: ADMIN-only endpoints ═══${NC}"

# GET /admin/usuarios
echo -e "\n  GET /admin/usuarios (ADMIN only)"
for role_name in "GENERADOR" "TRANSPORTISTA" "OPERADOR"; do
  token_var="TOKEN_$(echo $role_name | cut -c1-4 | tr 'a-z' 'A-Z')"
  if [ "$role_name" = "GENERADOR" ]; then t="$TOKEN_GEN"
  elif [ "$role_name" = "TRANSPORTISTA" ]; then t="$TOKEN_TRANS"
  else t="$TOKEN_OPER"; fi
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X GET "$BASE/admin/usuarios?limit=1" \
    -H "Authorization: Bearer $t" 2>/dev/null)
  assert_status "$role_name → GET /admin/usuarios → 403" "403" "$HTTP"
done
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X GET "$BASE/admin/usuarios?limit=1" \
  -H "Authorization: Bearer $TOKEN_ADMIN" 2>/dev/null)
assert_status "ADMIN → GET /admin/usuarios → 200" "200" "$HTTP"

echo -e "\n${CYAN}═══ Section 2: GENERADOR endpoints ═══${NC}"

# POST /manifiestos (GENERADOR, ADMIN)
echo -e "\n  POST /manifiestos (GENERADOR, ADMIN)"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos" \
    -H "Authorization: Bearer $TOKEN_TRANS" \
    -H "Content-Type: application/json" \
    -d '{"operadorId":"test","residuos":[{"tipoResiduoId":"test","cantidad":1,"unidad":"kg"}]}' 2>/dev/null)
  assert_status "TRANSPORTISTA → POST /manifiestos → 403" "403" "$HTTP"

  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -H "Content-Type: application/json" \
    -d '{"operadorId":"test","residuos":[{"tipoResiduoId":"test","cantidad":1,"unidad":"kg"}]}' 2>/dev/null)
  assert_status "OPERADOR → POST /manifiestos → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No BORRADOR manifiesto"
fi

# POST /manifiestos/:id/firmar (GENERADOR, ADMIN)
echo -e "\n  POST /manifiestos/:id/firmar (GENERADOR, ADMIN)"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/firmar" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  assert_status "TRANSPORTISTA → firmar → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/firmar" \
    -H "Authorization: Bearer $TOKEN_OPER" 2>/dev/null)
  assert_status "OPERADOR → firmar → 403" "403" "$HTTP"
fi

# POST /manifiestos/:id/cancelar (GENERADOR, ADMIN)
echo -e "\n  POST /manifiestos/:id/cancelar (GENERADOR, ADMIN)"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/cancelar" \
    -H "Authorization: Bearer $TOKEN_TRANS" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test"}' 2>/dev/null)
  assert_status "TRANSPORTISTA → cancelar → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/cancelar" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test"}' 2>/dev/null)
  assert_status "OPERADOR → cancelar → 403" "403" "$HTTP"
fi

echo -e "\n${CYAN}═══ Section 3: TRANSPORTISTA endpoints ═══${NC}"

# POST /manifiestos/:id/confirmar-retiro (TRANSPORTISTA, ADMIN)
echo -e "\n  POST /manifiestos/:id/confirmar-retiro (TRANSPORTISTA, ADMIN)"
if [ -n "$MAN_APROBADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_APROBADO/confirmar-retiro" \
    -H "Authorization: Bearer $TOKEN_GEN" 2>/dev/null)
  assert_status "GENERADOR → confirmar-retiro → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_APROBADO/confirmar-retiro" \
    -H "Authorization: Bearer $TOKEN_OPER" 2>/dev/null)
  assert_status "OPERADOR → confirmar-retiro → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No APROBADO manifiesto"
fi

# POST /manifiestos/:id/ubicacion (TRANSPORTISTA, ADMIN)
echo -e "\n  POST /manifiestos/:id/ubicacion (TRANSPORTISTA, ADMIN)"
if [ -n "$MAN_TRANSITO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/ubicacion" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"latitud":-32.88,"longitud":-68.84}' 2>/dev/null)
  assert_status "GENERADOR → ubicacion → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/ubicacion" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -H "Content-Type: application/json" \
    -d '{"latitud":-32.88,"longitud":-68.84}' 2>/dev/null)
  assert_status "OPERADOR → ubicacion → 403" "403" "$HTTP"
fi

# POST /manifiestos/:id/confirmar-entrega (TRANSPORTISTA, ADMIN)
echo -e "\n  POST /manifiestos/:id/confirmar-entrega (TRANSPORTISTA, ADMIN)"
if [ -n "$MAN_TRANSITO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/confirmar-entrega" \
    -H "Authorization: Bearer $TOKEN_GEN" 2>/dev/null)
  assert_status "GENERADOR → confirmar-entrega → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/confirmar-entrega" \
    -H "Authorization: Bearer $TOKEN_OPER" 2>/dev/null)
  assert_status "OPERADOR → confirmar-entrega → 403" "403" "$HTTP"
fi

# POST /manifiestos/:id/incidente (TRANSPORTISTA, ADMIN)
echo -e "\n  POST /manifiestos/:id/incidente (TRANSPORTISTA, ADMIN)"
if [ -n "$MAN_TRANSITO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/incidente" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"descripcion":"test"}' 2>/dev/null)
  assert_status "GENERADOR → incidente → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/incidente" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -H "Content-Type: application/json" \
    -d '{"descripcion":"test"}' 2>/dev/null)
  assert_status "OPERADOR → incidente → 403" "403" "$HTTP"
fi

echo -e "\n${CYAN}═══ Section 4: OPERADOR endpoints ═══${NC}"

# POST /manifiestos/:id/confirmar-recepcion (OPERADOR, ADMIN)
echo -e "\n  POST /manifiestos/:id/confirmar-recepcion (OPERADOR, ADMIN)"
if [ -n "$MAN_ENTREGADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/confirmar-recepcion" \
    -H "Authorization: Bearer $TOKEN_GEN" 2>/dev/null)
  assert_status "GENERADOR → confirmar-recepcion → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/confirmar-recepcion" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  assert_status "TRANSPORTISTA → confirmar-recepcion → 403" "403" "$HTTP"
fi

# POST /manifiestos/:id/rechazar (OPERADOR, ADMIN)
echo -e "\n  POST /manifiestos/:id/rechazar (OPERADOR, ADMIN)"
if [ -n "$MAN_ENTREGADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/rechazar" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test"}' 2>/dev/null)
  assert_status "GENERADOR → rechazar → 403" "403" "$HTTP"
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/rechazar" \
    -H "Authorization: Bearer $TOKEN_TRANS" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test"}' 2>/dev/null)
  assert_status "TRANSPORTISTA → rechazar → 403" "403" "$HTTP"
fi

# POST /manifiestos/:id/tratamiento (OPERADOR, ADMIN)
echo -e "\n  POST /manifiestos/:id/tratamiento (OPERADOR, ADMIN)"
if [ -n "$MAN_ENTREGADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/tratamiento" \
    -H "Authorization: Bearer $TOKEN_GEN" 2>/dev/null)
  assert_status "GENERADOR → tratamiento → 403" "403" "$HTTP"
fi

# POST /manifiestos/:id/cerrar (OPERADOR, ADMIN)
echo -e "\n  POST /manifiestos/:id/cerrar (OPERADOR, ADMIN)"
if [ -n "$MAN_ENTREGADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/cerrar" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  assert_status "TRANSPORTISTA → cerrar → 403" "403" "$HTTP"
fi

echo -e "\n${CYAN}═══ Section 5: ADMIN-only revertir-estado ═══${NC}"

echo -e "\n  POST /manifiestos/:id/revertir-estado (ADMIN only)"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/revertir-estado" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"estadoNuevo":"BORRADOR"}' 2>/dev/null)
  assert_status "GENERADOR → revertir-estado → 403" "403" "$HTTP"

  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/revertir-estado" \
    -H "Authorization: Bearer $TOKEN_TRANS" \
    -H "Content-Type: application/json" \
    -d '{"estadoNuevo":"BORRADOR"}' 2>/dev/null)
  assert_status "TRANSPORTISTA → revertir-estado → 403" "403" "$HTTP"

  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/revertir-estado" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -H "Content-Type: application/json" \
    -d '{"estadoNuevo":"BORRADOR"}' 2>/dev/null)
  assert_status "OPERADOR → revertir-estado → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No manifiesto disponible"
fi

# ── Summary ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"

exit $((FAIL > 0 ? 1 : 0))
