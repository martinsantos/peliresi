#!/bin/bash
# SITREP — Cross-Cutting: Solicitud Wizard Flow
# Full wizard: BORRADOR→APROBADA, auto-creación actor+usuario+rol,
# notifications, first login
#
# NOTE: Uses SSH to production DB to bypass email verification
# (cannot capture email-sent token in automated test).
# Uso: bash backend/tests/cross-solicitud-flow-test.sh [BASE_URL]
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
http_put()  { curl -s -w "\n%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer $2" -d "$3" "$API$1" -X PUT; }
http_get()  { curl -s -w "\n%{http_code}" -H "Authorization: Bearer $2" "$API$1"; }
get_token() { local r=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}"); echo "$r" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null; }
get_status() { echo "$1" | tail -1; }
get_body() { echo "$1" | sed '$d'; }

echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  CROSS-CUTTING: Solicitud Wizard Flow${NC}"
echo -e "${BOLD}${CYAN}  Target: $API${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# ── Auth ──
ADMIN_TOKEN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
check "[AUTH] Login ADMIN" "true" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

if [ -z "$ADMIN_TOKEN" ]; then echo -e "${RED}FATAL: No se pudo autenticar ADMIN${NC}"; exit 1; fi

# ── 1. Iniciar solicitud (público) ──
echo -e "\n${BOLD}${CYAN}═══ 1. Iniciar solicitud (público) ═══${NC}"

REG_EMAIL="cross.sol.${TS}@test.com"
REG_CUIT="30-${TS: -8}-${TS: -1}"

RESP=$(curl -s -w "\n%{http_code}" -X POST "$API/solicitudes/iniciar" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$REG_EMAIL\",\"password\":\"TestCross2026!\",\"nombre\":\"Test Cross Solicitud\",\"tipoActor\":\"GENERADOR\",\"cuit\":\"$REG_CUIT\"}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "1.1 Iniciar solicitud → 201" "201" "$STATUS"

SOL_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('solicitudId',''))" 2>/dev/null)
check "1.2 Solicitud ID presente" "true" "$([ -n "$SOL_ID" ] && echo true || echo false)"

if [ -z "$SOL_ID" ]; then
  echo -e "${RED}FATAL: No se creó la solicitud${NC}"; exit 1
fi

# ── 2. Bypass email verification via DB ──
echo -e "\n${BOLD}${CYAN}═══ 2. Bypass email verification (SSH→DB) ═══${NC}"

ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@23.105.176.45 \
  'docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp' 2>/dev/null <<SQL
UPDATE usuarios SET "emailVerified" = true, "emailVerificationToken" = NULL WHERE email = '$REG_EMAIL';
SQL
check "2.1 Email verification bypass OK" "0" "$?"

# ── 3. Login como candidato → restricted token ──
echo -e "\n${BOLD}${CYAN}═══ 3. Login candidato (restricted) ═══${NC}"

LOGIN_RESP=$(curl -s "$API/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$REG_EMAIL\",\"password\":\"TestCross2026!\"}")
CAND_TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)
RESTRICTED=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('restricted',False))" 2>/dev/null)
check "3.1 Login candidato → token presente" "true" "$([ -n "$CAND_TOKEN" ] && echo true || echo false)"
check_contains "3.2 restricted = true" "$LOGIN_RESP" '"restricted":true'

if [ -z "$CAND_TOKEN" ]; then echo -e "${RED}FATAL: No se pudo autenticar candidato${NC}"; exit 1; fi

# ── 4. PUT datos wizard (como candidato, restricted JWT) ──
echo -e "\n${BOLD}${CYAN}═══ 4. Cargar datos wizard ═══${NC}"

RESP=$(http_put "/solicitudes/$SOL_ID" "$CAND_TOKEN" \
  "{\"datosActor\":{\"direccion\":\"Calle Test 123\",\"telefono\":\"2615555555\",\"domicilio\":\"Calle Test 123\",\"razonSocial\":\"Test Cross Solicitud\",\"cuit\":\"$REG_CUIT\"},\"datosResiduos\":{\"tipos\":[\"aceites\"],\"volumenMensual\":500}}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "4.1 PUT datos wizard → 200" "200" "$STATUS"
check_contains "4.2 datosActor reflejado" "$BODY" "Calle Test 123"

# ── 5. Enviar solicitud ──
echo -e "\n${BOLD}${CYAN}═══ 5. Enviar solicitud (BORRADOR→ENVIADA) ═══${NC}"

RESP=$(http_post "/solicitudes/$SOL_ID/enviar" "$CAND_TOKEN" "")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "5.1 Enviar solicitud → 200" "200" "$STATUS"
check_contains "5.2 Estado = ENVIADA" "$BODY" "ENVIADA"

# ── 6. Admin revisa (ENVIADA→EN_REVISION) ──
echo -e "\n${BOLD}${CYAN}═══ 6. Admin revisa solicitud ═══${NC}"

RESP=$(http_post "/solicitudes/$SOL_ID/revisar" "$ADMIN_TOKEN" "{}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "6.1 Admin revisa → 200" "200" "$STATUS"
check_contains "6.2 Estado = EN_REVISION" "$BODY" "EN_REVISION"

# ── 7. Admin observa (EN_REVISION→OBSERVADA + mensaje) ──
echo -e "\n${BOLD}${CYAN}═══ 7. Admin observa + mensaje ═══${NC}"

RESP=$(http_post "/solicitudes/$SOL_ID/observar" "$ADMIN_TOKEN" \
  "{\"observaciones\":\"Falta documentacion adjunta. Por favor adjuntar certificado de inscripcion.\"}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "7.1 Admin observa → 200" "200" "$STATUS"
check_contains "7.2 Estado = OBSERVADA" "$BODY" "OBSERVADA"

# ── 8. Candidato responde con mensaje ──
echo -e "\n${BOLD}${CYAN}═══ 8. Candidato responde mensaje ═══${NC}"

if [ -n "$CAND_TOKEN" ]; then
  RESP=$(http_post "/solicitudes/$SOL_ID/mensajes" "$CAND_TOKEN" \
    "{\"contenido\":\"Adjunto documentacion requerida\"}")
  STATUS=$(get_status "$RESP")
  BODY=$(get_body "$RESP")
  check "8.1 Candidato responde → 201" "201" "$STATUS"
  check_contains "8.2 Mensaje creado" "$BODY" "Adjunto"
fi

# ── 9. Candidato corrige datos + re-envía ──
echo -e "\n${BOLD}${CYAN}═══ 9. Candidato corrige y re-envía (OBSERVADA→ENVIADA) ═══${NC}"

if [ -n "$CAND_TOKEN" ]; then
  # PUT con datos corregidos
  RESP=$(http_put "/solicitudes/$SOL_ID" "$CAND_TOKEN" \
    "{\"datosActor\":{\"direccion\":\"Calle Test 123\",\"telefono\":\"2615555555\",\"domicilio\":\"Calle Test 123\",\"razonSocial\":\"Test Cross Solicitud\",\"cuit\":\"$REG_CUIT\"}}")
  check "9.1 PUT corrección → 200" "200" "$(get_status "$RESP")"

  # Re-enviar (OBSERVADA→ENVIADA)
  RESP=$(http_post "/solicitudes/$SOL_ID/enviar" "$CAND_TOKEN" "")
  check "9.2 Re-enviar → 200" "200" "$(get_status "$RESP")"
fi

# ── 10. Admin re-revisa + aprueba ──
echo -e "\n${BOLD}${CYAN}═══ 10. Admin re-revisa y aprueba → crea actor+usuario+rol ═══${NC}"

# Revisar de nuevo (ENVIADA→EN_REVISION)
RESP=$(http_post "/solicitudes/$SOL_ID/revisar" "$ADMIN_TOKEN" "{}")
check "10.1 Admin re-revisa → 200" "200" "$(get_status "$RESP")"

# Aprobar (EN_REVISION→APROBADA)
RESP=$(http_post "/solicitudes/$SOL_ID/aprobar" "$ADMIN_TOKEN" "{}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
check "10.2 Admin aprueba → 200" "200" "$STATUS"
check_contains "10.3 Estado = APROBADA" "$BODY" "APROBADA"

# Extraer ID del actor creado (generadorId para GENERADOR)
ACTOR_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); s=d.get('data',{}).get('solicitud',{}); print(s.get('generadorId',''))" 2>/dev/null)
check "10.4 Actor (generadorId) presente" "true" "$([ -n "$ACTOR_ID" ] && echo true || echo false)"

# Verificar que el actor existe
if [ -n "$ACTOR_ID" ]; then
  RESP=$(http_get "/actores/generadores/$ACTOR_ID" "$ADMIN_TOKEN")
  check "10.5 GET /actores/generadores/\$id → 200" "200" "$(get_status "$RESP")"
fi

# ── 11. Login como nuevo usuario (ya activo) ──
echo -e "\n${BOLD}${CYAN}═══ 11. Login nuevo usuario + perfil ═══${NC}"

NEW_TOKEN=$(get_token "$REG_EMAIL" "TestCross2026!")
check "11.1 Login nuevo usuario → token presente" "true" "$([ -n "$NEW_TOKEN" ] && echo true || echo false)"

if [ -n "$NEW_TOKEN" ]; then
  RESP=$(http_get "/auth/profile" "$NEW_TOKEN")
  BODY=$(get_body "$RESP")
  STATUS=$(get_status "$RESP")
  check "11.2 GET /auth/profile → 200" "200" "$STATUS"
  check_contains "11.3 Rol = GENERADOR" "$BODY" "GENERADOR"
  check_contains "11.4 Nombre correcto" "$BODY" "Test Cross Solicitud"
fi

# ── 12. Notificaciones post-aprobación ──
echo -e "\n${BOLD}${CYAN}═══ 12. Notificaciones post-aprobación ═══${NC}"

ADMIN_NOTIF=$(http_get "/notificaciones?limit=3" "$ADMIN_TOKEN")
check "12.1 ADMIN notificaciones → 200" "200" "$(get_status "$ADMIN_NOTIF")"

if [ -n "$NEW_TOKEN" ]; then
  CAND_NOTIF=$(http_get "/notificaciones?limit=3" "$NEW_TOKEN")
  check "12.2 GENERADOR notificaciones → 200" "200" "$(get_status "$CAND_NOTIF")"
fi

# ── Cleanup: eliminar usuario de test + solicitud via DB ──
echo ""
echo -e "${YELLOW}[Cleanup] Eliminando datos de test...${NC}"

USER_ID=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@23.105.176.45 \
  'docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -At' 2>/dev/null <<SQL
SELECT id FROM usuarios WHERE email = '$REG_EMAIL' LIMIT 1;
SQL
)

if [ -n "$USER_ID" ]; then
  curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/usuarios/$USER_ID"
  echo -e "  ${GREEN}Cleanup${NC} Usuario $USER_ID eliminado"
else
  echo -e "  ${YELLOW}Cleanup${NC} No se encontró usuario para eliminar"
fi

# ── Summary ──
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Total:  $TOTAL tests"
echo -e "  ${GREEN}PASS:   $PASS${NC}"
echo -e "  ${RED}FAIL:   $FAIL${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}CROSS SOLICITUD FLOW: ALL TESTS PASSED${NC}"; exit 0
else
  echo -e "  ${RED}${BOLD}SOME TESTS FAILED${NC}"; echo "$ERRORS"; exit 1
fi
