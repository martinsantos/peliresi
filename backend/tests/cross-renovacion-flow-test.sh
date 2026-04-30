#!/bin/bash
# SITREP — Cross-Cutting: Renovacion Flow
# Tests renovacion CRUD + approve/reject workflow.
# Uso: bash backend/tests/cross-renovacion-flow-test.sh [BASE_URL]
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

http_post() { curl -s -w "\n%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer $2" -d "$3" "$API$1" -X POST; }
http_get()  { curl -s -w "\n%{http_code}" -H "Authorization: Bearer $2" "$API$1"; }
get_token() { local r=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}"); echo "$r" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null; }
get_status() { echo "$1" | tail -1; }
get_body() { echo "$1" | sed '$d'; }
get_json_val() { echo "$2" | python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null; }

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  CROSS-CUTTING: Renovacion Flow${NC}"
echo -e "${BOLD}${CYAN}  Target: $API${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── Auth ──
TOKEN_GEN=$(get_token "quimica.mendoza@industria.com" "gen123")
TOKEN_ADMIN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
check "[AUTH] GENERADOR" "true" "$([ -n "$TOKEN_GEN" ] && echo true || echo false)"
check "[AUTH] ADMIN" "true" "$([ -n "$TOKEN_ADMIN" ] && echo true || echo false)"
if [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_ADMIN" ]; then
  echo -e "${RED}FATAL: No se pudieron autenticar los roles${NC}"; exit 1
fi

# Resolve generador ID from profile
GEN_ID=$(curl -s -H "Authorization: Bearer $TOKEN_GEN" "$API/auth/profile" | python3 -c "
import sys,json; d=json.load(sys.stdin)
u=d.get('data',{}).get('user',{}); g=u.get('generador',{})
print(g.get('id',''))" 2>/dev/null)
check "[RESOLVE] Generador ID" "true" "$([ -n "$GEN_ID" ] && echo true || echo false)"
echo "  GEN_ID=$GEN_ID"
if [ -z "$GEN_ID" ]; then echo -e "${RED}FATAL: No se pudo resolver generador ID${NC}"; exit 1; fi

# Pre-cleanup: remove any renovaciones from previous runs for this generador
ANIO=$(date +%Y)
ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@23.105.176.45 \
  'docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp' 2>/dev/null <<SQL
DELETE FROM renovaciones WHERE "generadorId" = '$GEN_ID' AND anio = $ANIO;
DELETE FROM renovaciones WHERE "generadorId" = '$GEN_ID' AND anio = $((ANIO + 1));
SQL
echo "  [Cleanup] Renovaciones previas eliminadas"

echo ""
echo -e "${BOLD}${CYAN}═══ 1. Crear renovacion (SIN_CAMBIOS) ═══${NC}"

RESP=$(http_post "/renovaciones" "$TOKEN_GEN" \
  "{\"anio\":$ANIO,\"tipoActor\":\"GENERADOR\",\"generadorId\":\"$GEN_ID\",\"modalidad\":\"SIN_CAMBIOS\"}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
RENOV_ID=$(get_json_val "d.get('data',{}).get('renovacion',{}).get('id','')" "$BODY")

check "1.1 Crear renovacion -> 201" "201" "$STATUS"
check "1.2 Renovacion ID presente" "true" "$([ -n "$RENOV_ID" ] && echo true || echo false)"
check_contains "1.3 Estado = PENDIENTE" "$BODY" "PENDIENTE"

if [ -z "$RENOV_ID" ]; then echo -e "${RED}FATAL: No se creo la renovacion${NC}"; exit 1; fi

echo ""
echo -e "${BOLD}${CYAN}═══ 2. Aprobar renovacion (ADMIN) ═══${NC}"

RESP=$(http_post "/renovaciones/$RENOV_ID/aprobar" "$TOKEN_ADMIN" \
  "{\"observaciones\":\"Aprobada sin cambios\"}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "2.1 Aprobar -> 200" "200" "$STATUS"
check_contains "2.2 Estado = APROBADA" "$BODY" "APROBADA"

echo ""
echo -e "${BOLD}${CYAN}═══ 3. Crear y rechazar renovacion ═══${NC}"

# Use next year to avoid unique constraint (same actor+year)
ANIO2=$((ANIO + 1))
RESP=$(http_post "/renovaciones" "$TOKEN_GEN" \
  "{\"anio\":$ANIO2,\"tipoActor\":\"GENERADOR\",\"generadorId\":\"$GEN_ID\",\"modalidad\":\"SIN_CAMBIOS\"}")
RENOV_ID2=$(get_json_val "d.get('data',{}).get('renovacion',{}).get('id','')" "$(get_body "$RESP")")
STATUS=$(get_status "$RESP")
check "3.1 Crear segunda renovacion -> 201" "201" "$STATUS"

if [ -n "$RENOV_ID2" ]; then
  RESP=$(http_post "/renovaciones/$RENOV_ID2/rechazar" "$TOKEN_ADMIN" \
    "{\"motivoRechazo\":\"Documentacion incompleta\",\"observaciones\":\"Falta certificado\"}")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  check "3.2 Rechazar -> 200" "200" "$STATUS"
  check_contains "3.3 Estado = RECHAZADA" "$BODY" "RECHAZADA"
  check_contains "3.4 Motivo reflejado" "$BODY" "Documentacion incompleta"
fi

echo ""
echo -e "${BOLD}${CYAN}═══ 4. Notificaciones post-aprobacion ═══${NC}"

ADMIN_NOTIF=$(http_get "/notificaciones?limit=3" "$TOKEN_ADMIN")
check "4.1 ADMIN notificaciones -> 200" "200" "$(get_status "$ADMIN_NOTIF")"

GEN_NOTIF=$(http_get "/notificaciones?limit=3" "$TOKEN_GEN")
check "4.2 GENERADOR notificaciones -> 200" "200" "$(get_status "$GEN_NOTIF")"

echo ""
echo -e "${BOLD}${CYAN}═══ 5. Cleanup ═══${NC}"

# Delete renovaciones via API if admin delete endpoint exists, otherwise via DB
for RID in "$RENOV_ID" "$RENOV_ID2"; do
  [ -z "$RID" ] && continue
  ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@23.105.176.45 \
    'docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp' 2>/dev/null <<SQL
  DELETE FROM renovaciones WHERE id = '$RID';
SQL
  echo -e "  ${GREEN}Cleanup${NC} Renovacion $RID eliminada"
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
  echo -e "  ${GREEN}${BOLD}CROSS RENOVACION FLOW: ALL TESTS PASSED${NC}"; exit 0
else
  echo -e "  ${RED}${BOLD}SOME TESTS FAILED${NC}"; echo "$ERRORS"; exit 1
fi
