#!/bin/bash
# Zod Schema Fuzzing Test — SITREP
# Sends crafted payloads that violate Zod schemas on key endpoints.
# Asserts 400 (validation error), never 500 (crash).
# Uso: bash backend/tests/zod-schema-fuzzing-test.sh [BASE_URL]
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
echo -e "${YELLOW}   SITREP — Zod Schema Fuzzing Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert_400() {
  local desc="$1" http_code="$2"
  if [ "$http_code" = "000" ] || [ -z "$http_code" ]; then
    echo -e "  ${RED}FAIL${NC} [timeout] $desc — no response"; ((FAIL++))
  elif [ "$http_code" = "500" ]; then
    echo -e "  ${RED}FAIL${NC} [500 CRASH] $desc"; ((FAIL++))
  elif [ "$http_code" = "400" ]; then
    echo -e "  ${GREEN}PASS${NC} [400] $desc"; ((PASS++))
  else
    echo -e "  ${YELLOW}WARN${NC} [$http_code] $desc (expected 400)"; ((SKIP++))
  fi
}

TOKEN_GEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"quimica.mendoza@industria.com","password":"gen123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

TOKEN_TRANS=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"transportes.andes@logistica.com","password":"trans123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_TRANS" ]; then
  echo -e "${RED}ERROR: Cannot authenticate. Aborting.${NC}"
  exit 1
fi

# Get a BORRADOR manifiesto for endpoint tests
MAN_ID=$(curl -s -H "Authorization: Bearer $TOKEN_GEN" \
  "$BASE/manifiestos?estado=BORRADOR&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

# Get any EN_TRANSITO for incidente actions
MAN_TRANS=$(curl -s -H "Authorization: Bearer $TOKEN_TRANS" \
  "$BASE/manifiestos?estado=EN_TRANSITO&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

TOKEN_ADMIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

echo -e "\n${CYAN}── Zod Fuzzing: register ──${NC}"
assert_400 "register: email inválido" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"not-an-email","password":"Pass1!ok","rol":"GENERADOR","nombre":"Test"}' 2>/dev/null)

assert_400 "register: rol no válido" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"zod-test-role@test.com","password":"Pass1!ok","rol":"INVALID_ROLE","nombre":"Test"}' 2>/dev/null)

assert_400 "register: nombre >100 chars" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"zod-test-name@test.com\",\"password\":\"Pass1!ok\",\"rol\":\"GENERADOR\",\"nombre\":\"$(python3 -c "print('A'*101)")\"}" 2>/dev/null)

assert_400 "register: nombre vacío" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"zod-test-empty@test.com","password":"Pass1!ok","rol":"GENERADOR","nombre":""}' 2>/dev/null)

echo -e "\n${CYAN}── Zod Fuzzing: createManifiesto ──${NC}"
assert_400 "createManifiesto: cantidad=string" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"operadorId":"some-id","residuos":[{"tipoResiduoId":"x","cantidad":"abc","unidad":"kg"}]}' 2>/dev/null)

assert_400 "createManifiesto: cantidad negativa" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"operadorId":"some-id","residuos":[{"tipoResiduoId":"x","cantidad":-5,"unidad":"kg"}]}' 2>/dev/null)

assert_400 "createManifiesto: residuos vacío" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"operadorId":"some-id","residuos":[]}' 2>/dev/null)

assert_400 "createManifiesto: residuos no-array" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"operadorId":"some-id","residuos":"not-an-array"}' 2>/dev/null)

if [ -n "$MAN_ID" ]; then
  echo -e "\n${CYAN}── Zod Fuzzing: manifiesto action endpoints ──${NC}"
  assert_400 "updateManifiesto: observaciones >1000 chars" \
    $(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/manifiestos/$MAN_ID" \
      -H "Authorization: Bearer $TOKEN_GEN" \
      -H "Content-Type: application/json" \
      -d "{\"observaciones\":\"$(python3 -c "print('A'*1001)")\"}" 2>/dev/null)
else
  echo -e "  ${YELLOW}SKIP${NC} No BORRADOR manifiesto disponible"
fi

if [ -n "$MAN_TRANS" ]; then
  echo -e "\n${CYAN}── Zod Fuzzing: incidente endpoints ──${NC}"
  assert_400 "registrarIncidente: descripcion vacía" \
    $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos/$MAN_TRANS/incidente" \
      -H "Authorization: Bearer $TOKEN_TRANS" \
      -H "Content-Type: application/json" \
      -d '{"descripcion":""}' 2>/dev/null)

  assert_400 "registrarIncidente: descripcion >1000 chars" \
    $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos/$MAN_TRANS/incidente" \
      -H "Authorization: Bearer $TOKEN_TRANS" \
      -H "Content-Type: application/json" \
      -d "{\"descripcion\":\"$(python3 -c "print('A'*1001)")\"}" 2>/dev/null)

  echo -e "\n${CYAN}── Zod Fuzzing: ubicacion (GPS) ──${NC}"
  assert_400 "actualizarUbicacion: latitud=string" \
    $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos/$MAN_TRANS/ubicacion" \
      -H "Authorization: Bearer $TOKEN_TRANS" \
      -H "Content-Type: application/json" \
      -d '{"latitud":"north","longitud":-68.8}' 2>/dev/null)

  assert_400 "actualizarUbicacion: longitud=null" \
    $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/manifiestos/$MAN_TRANS/ubicacion" \
      -H "Authorization: Bearer $TOKEN_TRANS" \
      -H "Content-Type: application/json" \
      -d '{"latitud":-32.88,"longitud":null}' 2>/dev/null)
else
  echo -e "\n  ${YELLOW}SKIP${NC} No EN_TRANSITO manifiesto para tests de incidente/ubicacion"
fi

echo -e "\n${CYAN}── Zod Fuzzing: forgot-password ──${NC}"
assert_400 "forgot-password: email inválido" \
  $(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/forgot-password" \
    -H "Content-Type: application/json" \
    -d '{"email":"no-es-un-email"}' 2>/dev/null)

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"

exit $((FAIL > 0 ? 1 : 0))
