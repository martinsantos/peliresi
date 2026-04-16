#!/bin/bash
# GPS Coordinate Validation Test — SITREP
# TDD: este test debe fallar ANTES del fix (acepta lat=999)
# y pasar DESPUÉS del fix (rechaza lat=999 con 400)
# Uso: bash backend/tests/gps-validation-test.sh [BASE_URL]

set -uo pipefail

_INPUT="${1:-https://sitrep.ultimamilla.com.ar}"
BASE="${_INPUT%/}"
[[ "$BASE" != */api ]] && BASE="$BASE/api"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   GPS Coordinate Validation Test (TDD)${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert_status() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} [HTTP $actual] $desc"; ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [expected HTTP $expected, got $actual] $desc"; ((FAIL++))
  fi
}

# Login admin (with retry on rate limit)
_do_login() {
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' | \
    python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print(d.get('data',{}).get('tokens',{}).get('accessToken',''))
except: print('')
" 2>/dev/null
}
TOKEN=$(_do_login)
if [ -z "$TOKEN" ]; then
  echo -e "  ${YELLOW}Rate limited, waiting 61s...${NC}"
  sleep 61
  TOKEN=$(_do_login)
fi

[ -z "$TOKEN" ] && echo "ERROR: no token" && exit 1
echo -e "  ${GREEN}OK${NC} token obtenido"

# Obtener manifiesto EN_TRANSITO
MAN_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/manifiestos?estado=EN_TRANSITO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); ms=d['data']['manifiestos']; print(ms[0]['id'] if ms else '')" 2>/dev/null)

[ -z "$MAN_ID" ] && echo "SKIP: sin manifiesto EN_TRANSITO disponible" && exit 0
echo -e "  Manifiesto EN_TRANSITO: $MAN_ID"
echo ""

# ── Coordenadas válidas → 200 ──────────────────────────────────────
echo -e "${YELLOW}── Coordenadas válidas (Mendoza) ──${NC}"
S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908,"longitud":-68.8272,"velocidad":80}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "lat=-32.89, lon=-68.82 (Mendoza válido) → 200" "200" "$S"

# ── Coordenadas imposibles → 400 ──────────────────────────────────
echo ""
echo -e "${YELLOW}── Coordenadas imposibles → deben retornar 400 ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":999,"longitud":-68.8272}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "lat=999 (imposible) → 400" "400" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908,"longitud":999}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "lon=999 (imposible) → 400" "400" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-91,"longitud":-68.8272}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "lat=-91 (fuera de rango) → 400" "400" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908,"longitud":181}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "lon=181 (fuera de rango) → 400" "400" "$S"

# ── Campos requeridos ausentes → 400 ──────────────────────────────
echo ""
echo -e "${YELLOW}── Campos requeridos ausentes → 400 ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"longitud":-68.8272}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "sin latitud → 400" "400" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "sin longitud → 400" "400" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "body vacío → 400" "400" "$S"

# ── Velocidad negativa → 400 ───────────────────────────────────────
echo ""
echo -e "${YELLOW}── Velocidad negativa → 400 ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908,"longitud":-68.8272,"velocidad":-50}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "velocidad=-50 (negativa) → 400" "400" "$S"

echo -e "${YELLOW}── Dirección: número válido + string inválido ──${NC}"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908,"longitud":-68.8272,"velocidad":65,"direccion":45}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "direccion=45 (número válido, NE) → 200" "200" "$S"

S=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitud":-32.8908,"longitud":-68.8272,"velocidad":65,"direccion":"NE"}' \
  "$BASE/manifiestos/$MAN_ID/ubicacion")
assert_status "direccion=\"NE\" (string cardinal) → 400" "400" "$S"

# ── Resumen ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "  PASS: ${GREEN}$PASS${NC}"
echo -e "  FAIL: ${RED}$FAIL${NC}"
TOTAL=$((PASS + FAIL))
echo -e "  TOTAL: $TOTAL tests"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

[ "$FAIL" -eq 0 ] && echo -e "${GREEN}GPS VALIDATION: ALL PASS${NC}" || echo -e "${RED}GPS VALIDATION: $FAIL FAIL(S)${NC}"
[ "$FAIL" -eq 0 ]
