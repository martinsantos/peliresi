#!/bin/bash
# SITREP — Cross-Cutting: Carga Masiva CSV
# Tests CSV upload for generadores: user+actor creation, error handling,
# verification via login and search.
# Uso: bash backend/tests/cross-carga-masiva-test.sh [BASE_URL]
set -uo pipefail

API="${1:-https://sitrep.ultimamilla.com.ar}/api"
PASS=0; FAIL=0; TOTAL=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'
TS=$(date +%s)

check() {
  TOTAL=$((TOTAL+1))
  local label="$1" expected="$2" got="$3"
  if [ "$expected" = "$got" ]; then
    PASS=$((PASS+1)); echo -e "  ${GREEN}PASS${NC} $label"
  else
    FAIL=$((FAIL+1)); echo -e "  ${RED}FAIL${NC} $label (expected $expected, got $got)"
    ERRORS="$ERRORS\n  FAIL $label (expected $expected, got $got)"
  fi
}

check_contains() {
  TOTAL=$((TOTAL+1))
  local label="$1" body="$2" expected="$3"
  if echo "$body" | grep -q "$expected"; then
    PASS=$((PASS+1)); echo -e "  ${GREEN}PASS${NC} $label"
  else
    FAIL=$((FAIL+1)); echo -e "  ${RED}FAIL${NC} $label (missing: $expected)"
    ERRORS="$ERRORS\n  FAIL $label (missing: $expected)"
  fi
}

http_get()  { curl -s -w "\n%{http_code}" -H "Authorization: Bearer $2" "$API$1"; }
get_token() { local r=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}"); echo "$r" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null; }
get_status() { echo "$1" | tail -1; }
get_body() { echo "$1" | sed '$d'; }

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  CROSS-CUTTING: Carga Masiva Generadores${NC}"
echo -e "${BOLD}${CYAN}  Target: $API${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── Auth ──
ADMIN_TOKEN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
check "[AUTH] Login ADMIN" "true" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"
if [ -z "$ADMIN_TOKEN" ]; then echo -e "${RED}FATAL: No se pudo autenticar ADMIN${NC}"; exit 1; fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Unique identifiers for test users
CUIT1="30-${TS: -8}-${TS: -1}"
CUIT2="30-${TS: -7}1-${TS: -1}"
CUIT3="30-${TS: -6}2-${TS: -1}"
EMAIL1="carga.test1.${TS}@test.com"
EMAIL2="carga.test2.${TS}@test.com"
EMAIL3="carga.test3.${TS}@test.com"

echo ""
echo -e "${BOLD}${CYAN}═══ 1. Cargar CSV con 3 generadores nuevos ═══${NC}"

# Create CSV: headers lowercase as server expects them
cat > "$TMPDIR/generadores.csv" <<CSV
cuit,razonsocial,domicilio,telefono,email,numeroinscripcion,categoria
$CUIT1,Carga Test Uno,Calle Falsa 111,2611111111,$EMAIL1,INS001,Pequeño
$CUIT2,Carga Test Dos,Calle Falsa 222,2622222222,$EMAIL2,INS002,Mediano
$CUIT3,Carga Test Tres,Calle Falsa 333,2633333333,$EMAIL3,INS003,Grande
CSV

RESP=$(curl -s -w "\n%{http_code}" --max-time 30 \
  -X POST "$API/carga-masiva/generadores" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "archivo=@$TMPDIR/generadores.csv;type=text/csv")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")

check "1.1 Upload CSV -> 200" "200" "$STATUS"
check_contains "1.2 success=true" "$BODY" "success\":true"

# Parse results
TOTAL_CSV=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',''))" 2>/dev/null)
EXITOSOS=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('exitosos',''))" 2>/dev/null)
ERRORES_COUNT=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('errores',[])))" 2>/dev/null)

check "1.3 total = 3" "3" "$TOTAL_CSV"
check "1.4 exitosos = 3" "3" "$EXITOSOS"
check "1.5 errores = 0" "0" "$ERRORES_COUNT"

echo ""
echo -e "${BOLD}${CYAN}═══ 2. Bypass email verification via DB ═══${NC}"

ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@23.105.176.45 \
  'docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp' 2>/dev/null <<SQL
UPDATE usuarios SET "emailVerified" = true, "emailVerificationToken" = NULL
WHERE email IN ('$EMAIL1','$EMAIL2','$EMAIL3');
SQL
check "2.1 Email verification bypass OK" "0" "$?"

sleep 2

echo ""
echo -e "${BOLD}${CYAN}═══ 3. Verificar login como nuevos usuarios ═══${NC}"

for i in 1 2 3; do
  eval EMAIL=\$EMAIL$i
  TOKEN=$(get_token "$EMAIL" "temporal123")
  check "3.$i Login $EMAIL -> token presente" "true" "$([ -n "$TOKEN" ] && echo true || echo false)"

  if [ -n "$TOKEN" ]; then
    PROF=$(http_get "/auth/profile" "$TOKEN")
    PROF_BODY=$(get_body "$PROF")
    PROF_STATUS=$(get_status "$PROF")
    check "3.${i}b Profile -> 200" "200" "$PROF_STATUS"
    check_contains "3.${i}c Rol GENERADOR" "$PROF_BODY" "GENERADOR"
  fi
done

echo ""
echo -e "${BOLD}${CYAN}═══ 4. Cargar CSV con errores (email duplicado) ═══${NC}"

cat > "$TMPDIR/generadores-erroneos.csv" <<CSV
cuit,razonsocial,domicilio,telefono,email
$CUIT1,Carga Test Uno,Otra direccion 444,2644444444,$EMAIL1
20-12345678-9,Sin Razon,Otra calle 555,2655555555,noemail
CSV

RESP=$(curl -s -w "\n%{http_code}" --max-time 30 \
  -X POST "$API/carga-masiva/generadores" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -F "archivo=@$TMPDIR/generadores-erroneos.csv;type=text/csv")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")

check "4.1 Upload errores -> 200" "200" "$STATUS"

ERR_COUNT=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',{}).get('errores',[])))" 2>/dev/null)
TOTAL_ERR=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('total',''))" 2>/dev/null)

check "4.2 total = 2" "2" "$TOTAL_ERR"
# Row 1: CUIT duplicado -> update (exitoso, no error)
# Row 2: email unique constraint fails -> error
check "4.3 Al menos 1 error" "true" "$([ "$ERR_COUNT" -ge 1 ] && echo true || echo false)"

echo ""
echo -e "${BOLD}${CYAN}═══ 5. Sin autorizacion → 401 ═══${NC}"

HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
  -X POST "$API/carga-masiva/generadores" \
  -F "archivo=@$TMPDIR/generadores.csv;type=text/csv" 2>/dev/null)
check "5.1 Sin auth -> 401" "401" "$HTTP"

echo ""
echo -e "${BOLD}${CYAN}═══ 6. Cleanup: eliminar usuarios de test ═══${NC}"

USER_IDS=""
for i in 1 2 3; do
  eval EMAIL=\$EMAIL$i
  USER_ID=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@23.105.176.45 \
    'docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -At' 2>/dev/null <<SQL
  SELECT id FROM usuarios WHERE email = '$EMAIL' LIMIT 1;
SQL
  )
  if [ -n "$USER_ID" ]; then
    USER_IDS="$USER_IDS $USER_ID"
    curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/usuarios/$USER_ID"
    echo -e "  ${GREEN}Cleanup${NC} Usuario $USER_ID ($EMAIL) eliminado"
  else
    echo -e "  ${YELLOW}Cleanup${NC} No se encontro usuario para $EMAIL"
  fi
done

# Summary
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Total:  $TOTAL tests"
echo -e "  ${GREEN}PASS:   $PASS${NC}"
echo -e "  ${RED}FAIL:   $FAIL${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}CROSS CARGA MASIVA: ALL TESTS PASSED${NC}"; exit 0
else
  echo -e "  ${RED}${BOLD}SOME TESTS FAILED${NC}"; echo "$ERRORS"; exit 1
fi
