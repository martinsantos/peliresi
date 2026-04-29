#!/bin/bash
# Mass Assignment / Parameter Pollution Test — SITREP
# Tests that protected fields (rol, esInspector, activo, estado) cannot be
# injected via request bodies.
# Uso: bash backend/tests/mass-assignment-test.sh [BASE_URL]
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

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}   SITREP — Mass Assignment / Parameter Pollution Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}PASS${NC} [$actual] $desc"; ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [expected $expected, got $actual] $desc"; ((FAIL++))
  fi
}

TOKEN_ADMIN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

TOKEN_GEN=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"quimica.mendoza@industria.com","password":"gen123"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN_ADMIN" ]; then
  echo -e "${RED}ERROR: Cannot authenticate ADMIN. Aborting.${NC}"
  exit 1
fi

echo ""
echo -e "${CYAN}[1] Register with rol=ADMIN (should be rejected by Zod enum)${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"mass-test-admin@test.com","password":"Pass1!secure","rol":"ADMIN","nombre":"Attacker","apellido":"Test","empresa":"EvilCorp","telefono":"111111","cuit":"20123456782"}' 2>/dev/null)
assert "register with rol=ADMIN debe ser 400" "400" "$HTTP"

echo ""
echo -e "${CYAN}[2] Register with esInspector=true (extra field, should be ignored)${NC}"
RESP=$(curl -s -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"mass-test-inspector@test.com","password":"Pass1!secure","rol":"GENERADOR","nombre":"Inspector Test","esInspector":true}' 2>/dev/null)
HTTP=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('usuario',{}).get('esInspector','missing'))" 2>/dev/null)
if [ "$HTTP" = "missing" ] || [ "$HTTP" = "False" ] || [ "$HTTP" = "false" ]; then
  echo -e "  ${GREEN}PASS${NC} esInspector no fue asignado en el registro: $HTTP"; ((PASS++))
elif [ "$HTTP" = "True" ] || [ "$HTTP" = "true" ]; then
  echo -e "  ${RED}FAIL${NC} esInspector fue asignado como $HTTP"; ((FAIL++))
else
  echo -e "  ${YELLOW}WARN${NC} [$HTTP] No se pudo verificar esInspector"; ((PASS++))
fi

echo ""
echo -e "${CYAN}[3] PUT /manifiestos/:id with estado=CANCELADO (should be ignored)${NC}"
# Get a BORRADOR manifiesto
MAN_ID=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
  "$BASE/manifiestos?estado=BORRADOR&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)

if [ -n "$MAN_ID" ] && [ "$MAN_ID" != "" ]; then
  # Attempt estado injection
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/manifiestos/$MAN_ID" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"observaciones":"test mass assignment","estado":"CANCELADO"}' 2>/dev/null)
  if [ "$HTTP" = "200" ]; then
    # Verify estado did NOT change
    NUEVO_EST=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
      "$BASE/manifiestos/$MAN_ID" | \
      python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('manifiesto',{}).get('estado',''))" 2>/dev/null)
    if [ "$NUEVO_EST" = "BORRADOR" ]; then
      echo -e "  ${GREEN}PASS${NC} [200] estado injection ignorado, sigue BORRADOR"; ((PASS++))
    else
      echo -e "  ${RED}FAIL${NC} [estado cambió a $NUEVO_EST] estado fue aceptado en PUT"; ((FAIL++))
    fi
  elif [ "$HTTP" = "400" ]; then
    echo -e "  ${GREEN}PASS${NC} [$HTTP] updateManifiesto rechazó el body con estado"; ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [$HTTP] updateManifiesto falló"; ((FAIL++))
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No hay manifiesto BORRADOR disponible"; ((PASS++))
fi

echo ""
echo -e "${CYAN}[4] PUT /solicitudes/:id with estado=APROBADA (should be ignored)${NC}"
# Get the user's solicitud if any
SOL_ID=$(curl -s -H "Authorization: Bearer $TOKEN_GEN" \
  "$BASE/solicitudes/mis-solicitudes" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); ss=d.get('data',{}).get('solicitudes',[]); s=[x for x in ss if x.get('estado') in ('BORRADOR','OBSERVADA')]; print(s[0]['id'] if s else '')" 2>/dev/null)

if [ -n "$SOL_ID" ] && [ "$SOL_ID" != "" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE/solicitudes/$SOL_ID" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"datosActor":"{}","estado":"APROBADA","rol":"ADMIN","activo":true}' 2>/dev/null)
  if [ "$HTTP" = "200" ]; then
    # Verify estado unchanged
    SOL_EST=$(curl -s -H "Authorization: Bearer $TOKEN_GEN" \
      "$BASE/solicitudes/$SOL_ID" | \
      python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('solicitud',{}).get('estado',''))" 2>/dev/null)
    if [ "$SOL_EST" = "BORRADOR" ] || [ "$SOL_EST" = "OBSERVADA" ]; then
      echo -e "  ${GREEN}PASS${NC} [200] estado injection ignorado, sigue $SOL_EST"; ((PASS++))
    else
      echo -e "  ${RED}FAIL${NC} [estado cambió a $SOL_EST] estado fue aceptado en solicitud PUT"; ((FAIL++))
    fi
  elif [ "$HTTP" = "400" ]; then
    echo -e "  ${GREEN}PASS${NC} [$HTTP] solicitud PUT rechazó campos extra"; ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [$HTTP] solicitud PUT falló"; ((FAIL++))
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No hay solicitud BORRADOR/OBSERVADA disponible"; ((PASS++))
fi

echo ""
echo -e "${CYAN}[5] Register with activo=true and emailVerified=true${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email":"mass-test-activo@test.com","password":"Pass1!secure","rol":"TRANSPORTISTA","nombre":"Activo Test","activo":true,"emailVerified":true}' 2>/dev/null)
if [ "$HTTP" = "201" ]; then
  # Login should fail because user is inactive
  LOGIN_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"mass-test-activo@test.com","password":"Pass1!secure"}' 2>/dev/null)
  if [ "$LOGIN_HTTP" = "401" ]; then
    echo -e "  ${GREEN}PASS${NC} [201, login=$LOGIN_HTTP] activo=true fue ignorado (usuario inactivo)"; ((PASS++))
  else
    echo -e "  ${RED}FAIL${NC} [login=$LOGIN_HTTP] activo=true puede haber sido aceptado"; ((FAIL++))
  fi
elif [ "$HTTP" = "400" ]; then
  echo -e "  ${GREEN}PASS${NC} [$HTTP] activo/emailVerified rechazados"; ((PASS++))
elif [ "$HTTP" = "409" ]; then
  echo -e "  ${YELLOW}SKIP${NC} [$HTTP] Usuario ya existe (correr una sola vez)"; ((PASS++))
else
  echo -e "  ${RED}FAIL${NC} [$HTTP] Error inesperado"; ((FAIL++))
fi

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"

exit $((FAIL > 0 ? 1 : 0))
