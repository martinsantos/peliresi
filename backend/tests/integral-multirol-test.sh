#!/bin/bash
# ============================================================
# SITREP — Test Integral Multi-Rol Multi-Plataforma
# Flujo end-to-end: accesos, altas, perfiles, manifiestos,
# alertas, notificaciones, accesos sectoriales, endpoints públicos
# ============================================================

API=${1:-"https://sitrep.ultimamilla.com.ar/api"}
PASS=0; FAIL=0; TOTAL=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; NC='\033[0m'; BOLD='\033[1m'
TS=$(date +%s)

check() {
  TOTAL=$((TOTAL+1))
  local label="$1" expected="$2" got="$3"
  if [ "$expected" = "$got" ]; then
    PASS=$((PASS+1))
    echo -e "  ${GREEN}PASS${NC} $label"
  else
    FAIL=$((FAIL+1))
    echo -e "  ${RED}FAIL${NC} $label (expected $expected, got $got)"
    ERRORS="$ERRORS\n  FAIL $label (expected $expected, got $got)"
  fi
}

check_contains() {
  TOTAL=$((TOTAL+1))
  local label="$1" body="$2" expected="$3"
  if echo "$body" | grep -q "$expected"; then
    PASS=$((PASS+1))
    echo -e "  ${GREEN}PASS${NC} $label"
  else
    FAIL=$((FAIL+1))
    echo -e "  ${RED}FAIL${NC} $label (missing: $expected)"
    ERRORS="$ERRORS\n  FAIL $label (missing: $expected)"
  fi
}

http_post() {
  curl -s -w "\n%{http_code}" -H "Content-Type: application/json" -H "Authorization: Bearer $2" -d "$3" "$API$1" -X POST
}

http_get() {
  curl -s -w "\n%{http_code}" -H "Authorization: Bearer $2" "$API$1"
}

http_get_anon() {
  curl -s -w "\n%{http_code}" "$API$1"
}

get_token() {
  local resp=$(curl -s "$API/auth/login" -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"$2\"}")
  echo "$resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null
}

get_status() {
  echo "$1" | tail -1
}

get_body() {
  echo "$1" | sed '$d'
}

echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  SITREP TEST INTEGRAL MULTI-ROL${NC}"
echo -e "${BOLD}  Target: $API${NC}"
echo -e "${BOLD}  $(date)${NC}"
echo -e "${BOLD}============================================================${NC}"
echo ""

# ============================================================
# SECCION 1: ACCESOS — Login de todos los roles
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 1: ACCESOS${NC}"

ADMIN_TOKEN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
check "1.1 Login ADMIN" "true" "$([ -n "$ADMIN_TOKEN" ] && echo true || echo false)"

GEN_TOKEN=$(get_token "quimica.mendoza@industria.com" "gen123")
check "1.2 Login GENERADOR" "true" "$([ -n "$GEN_TOKEN" ] && echo true || echo false)"

TRANS_TOKEN=$(get_token "transportes.andes@logistica.com" "trans123")
check "1.3 Login TRANSPORTISTA" "true" "$([ -n "$TRANS_TOKEN" ] && echo true || echo false)"

OPER_TOKEN=$(get_token "tratamiento.residuos@planta.com" "op123")
check "1.4 Login OPERADOR" "true" "$([ -n "$OPER_TOKEN" ] && echo true || echo false)"

# Impersonate admin sectoriales
RESP=$(http_get "/admin/usuarios?rol=ADMIN_GENERADOR&limit=1" "$ADMIN_TOKEN")
AG_ID=$(get_body "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('data',{}).get('usuarios',d.get('data',[])); print(u[0]['id'] if u else '')" 2>/dev/null)
if [ -n "$AG_ID" ]; then
  AG_RESP=$(http_post "/admin/impersonate/$AG_ID" "$ADMIN_TOKEN" "{}")
  AG_TOKEN=$(get_body "$AG_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('tokens',{}).get('accessToken',''))" 2>/dev/null)
  check "1.5 Impersonate ADMIN_GENERADOR" "true" "$([ -n "$AG_TOKEN" ] && echo true || echo false)"
else
  echo -e "  ${YELLOW}SKIP${NC} 1.5 No ADMIN_GENERADOR found"; TOTAL=$((TOTAL+1))
  AG_TOKEN=""
fi

# Login invalido
RESP=$(curl -s -w "\n%{http_code}" "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"wrong"}')
check "1.6 Login invalido → 401" "401" "$(get_status "$RESP")"

RESP=$(curl -s -w "\n%{http_code}" "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"noexiste@test.com","password":"test"}')
check "1.7 Email inexistente → 401" "401" "$(get_status "$RESP")"

echo ""

# ============================================================
# SECCION 2: ALTA DE USUARIOS
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 2: ALTA DE USUARIOS${NC}"

REG_EMAIL="test.integral.${TS}@test.com"
REG_CUIT="20-${TS:0:8}-0"

RESP=$(http_post "/auth/register" "" "{\"email\":\"$REG_EMAIL\",\"password\":\"TestInt2026!\",\"nombre\":\"Test Integral\",\"rol\":\"GENERADOR\",\"cuit\":\"$REG_CUIT\"}")
STATUS=$(get_status "$RESP")
check "2.1 Registro GENERADOR → 201" "201" "$STATUS"

# Verificar usuario inactivo (buscar por email via admin)
RESP=$(http_get "/admin/usuarios?search=$(echo $REG_EMAIL | cut -d@ -f1)&limit=1" "$ADMIN_TOKEN")
BODY=$(get_body "$RESP")
check_contains "2.2 Usuario registrado como inactivo" "$BODY" "false"

# Obtener ID del usuario nuevo
NEW_USER_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('data',{}).get('usuarios',[]); print(u[0]['id'] if u else '')" 2>/dev/null)

if [ -n "$NEW_USER_ID" ]; then
  # Activar usuario
  RESP=$(curl -s -w "\n%{http_code}" -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/usuarios/$NEW_USER_ID/toggle-activo")
  check "2.3 Admin activa usuario → 200" "200" "$(get_status "$RESP")"

  # Limpiar: eliminar usuario de test
  curl -s -o /dev/null -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" "$API/admin/usuarios/$NEW_USER_ID"
  echo -e "  ${GREEN}CLEANUP${NC} Usuario de test eliminado"
else
  echo -e "  ${YELLOW}SKIP${NC} 2.3 No se encontro usuario"
  TOTAL=$((TOTAL+1))
fi

echo ""

# ============================================================
# SECCION 3: PERFILES
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 3: PERFILES${NC}"

RESP=$(http_get "/auth/profile" "$ADMIN_TOKEN")
check "3.1 ADMIN profile → 200" "200" "$(get_status "$RESP")"
check_contains "3.2 ADMIN tiene rol" "$(get_body "$RESP")" "ADMIN"

RESP=$(http_get "/auth/profile" "$GEN_TOKEN")
check "3.3 GENERADOR profile → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get "/auth/profile" "$TRANS_TOKEN")
check "3.4 TRANSPORTISTA profile → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get "/auth/profile" "$OPER_TOKEN")
check "3.5 OPERADOR profile → 200" "200" "$(get_status "$RESP")"

# Notificaciones para cada rol
for ROLE_NAME in ADMIN GENERADOR TRANSPORTISTA OPERADOR; do
  eval TOKEN=\$${ROLE_NAME:0:5}_TOKEN
  if [ "$ROLE_NAME" = "ADMIN" ]; then TOKEN=$ADMIN_TOKEN; fi
  if [ "$ROLE_NAME" = "GENERADOR" ]; then TOKEN=$GEN_TOKEN; fi
  if [ "$ROLE_NAME" = "TRANSPORTISTA" ]; then TOKEN=$TRANS_TOKEN; fi
  if [ "$ROLE_NAME" = "OPERADOR" ]; then TOKEN=$OPER_TOKEN; fi
  RESP=$(http_get "/notificaciones?limit=1" "$TOKEN")
  check "3.6 $ROLE_NAME notificaciones → 200" "200" "$(get_status "$RESP")"
done

echo ""

# ============================================================
# SECCION 4: MANIFIESTOS — Flujo completo
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 4: MANIFIESTOS — Flujo completo${NC}"

# Obtener IDs reales
GEN_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/catalogos/generadores" | python3 -c "import sys,json; d=json.load(sys.stdin); g=d.get('data',{}).get('generadores',[]); print(g[0]['id'] if g else '')" 2>/dev/null)
TRANS_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/catalogos/transportistas" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d.get('data',{}).get('transportistas',[]); print(t[0]['id'] if t else '')" 2>/dev/null)
OPER_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/catalogos/operadores" | python3 -c "import sys,json; d=json.load(sys.stdin); o=d.get('data',{}).get('operadores',[]); print(o[0]['id'] if o else '')" 2>/dev/null)
RESID_ID=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "$API/catalogos/tipos-residuos" | python3 -c "import sys,json; d=json.load(sys.stdin); r=d.get('data',{}).get('tiposResiduos',d if isinstance(d,list) else []); print(r[1]['id'] if len(r)>1 else r[0]['id'] if r else '')" 2>/dev/null)

# 4.1 Crear manifiesto
RESP=$(http_post "/manifiestos" "$ADMIN_TOKEN" "{\"generadorId\":\"$GEN_ID\",\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OPER_ID\",\"fechaEstimadaRetiro\":\"2026-03-28\",\"observaciones\":\"Test integral\",\"residuos\":[{\"tipoResiduoId\":\"$RESID_ID\",\"cantidad\":150,\"unidad\":\"kg\"}]}")
MAN_STATUS=$(get_status "$RESP")
MAN_BODY=$(get_body "$RESP")
MAN_ID=$(echo "$MAN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('manifiesto',{}).get('id',''))" 2>/dev/null)
MAN_NUM=$(echo "$MAN_BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('manifiesto',{}).get('numero',''))" 2>/dev/null)
check "4.1 Crear manifiesto → 201/200" "true" "$([ "$MAN_STATUS" = "201" ] || [ "$MAN_STATUS" = "200" ] && echo true || echo false)"

if [ -n "$MAN_ID" ]; then
  echo -e "  ${GREEN}INFO${NC} Manifiesto: $MAN_NUM (ID: ${MAN_ID:0:15}...)"

  # 4.2 Firmar
  RESP=$(http_post "/manifiestos/$MAN_ID/firmar" "$ADMIN_TOKEN" "{}")
  check "4.2 Firmar (BORRADOR→APROBADO) → 200" "200" "$(get_status "$RESP")"

  # 4.3 Confirmar retiro
  RESP=$(http_post "/manifiestos/$MAN_ID/confirmar-retiro" "$TRANS_TOKEN" "{}")
  check "4.3 Confirmar retiro (APROBADO→EN_TRANSITO) → 200" "200" "$(get_status "$RESP")"

  # 4.4 GPS updates
  for i in 1 2 3; do
    LAT=$(echo "-32.88 + 0.001 * $i" | bc)
    LNG=$(echo "-68.82 + 0.001 * $i" | bc)
    RESP=$(http_post "/manifiestos/$MAN_ID/ubicacion" "$TRANS_TOKEN" "{\"latitud\":$LAT,\"longitud\":$LNG,\"velocidad\":45,\"direccion\":90}")
    if [ $i -eq 1 ]; then check "4.4 GPS update (3 puntos) → 200" "200" "$(get_status "$RESP")"; fi
  done

  # 4.5 Incidente
  RESP=$(http_post "/manifiestos/$MAN_ID/incidente" "$TRANS_TOKEN" "{\"tipo\":\"averia\",\"descripcion\":\"Test integral - averia simulada\"}")
  check "4.5 Registrar incidente → 200" "200" "$(get_status "$RESP")"

  # 4.6 Confirmar entrega
  RESP=$(http_post "/manifiestos/$MAN_ID/confirmar-entrega" "$TRANS_TOKEN" "{}")
  check "4.6 Confirmar entrega (EN_TRANSITO→ENTREGADO) → 200" "200" "$(get_status "$RESP")"

  # 4.7 Confirmar recepcion
  RESP=$(http_post "/manifiestos/$MAN_ID/confirmar-recepcion" "$OPER_TOKEN" "{}")
  check "4.7 Confirmar recepcion (ENTREGADO→RECIBIDO) → 200" "200" "$(get_status "$RESP")"

  # 4.8 Registrar tratamiento
  RESP=$(http_post "/manifiestos/$MAN_ID/tratamiento" "$OPER_TOKEN" "{\"metodoTratamiento\":\"incineracion\"}")
  check "4.8 Registrar tratamiento (RECIBIDO→EN_TRATAMIENTO) → 200" "200" "$(get_status "$RESP")"

  # 4.9 Cerrar
  RESP=$(http_post "/manifiestos/$MAN_ID/cerrar" "$OPER_TOKEN" "{}")
  check "4.9 Cerrar manifiesto (→TRATADO) → 200" "200" "$(get_status "$RESP")"

  # 4.10 Verificar estado final
  RESP=$(http_get "/manifiestos/$MAN_ID" "$ADMIN_TOKEN")
  check_contains "4.10 Estado final = TRATADO" "$(get_body "$RESP")" "TRATADO"

  # 4.11 PDF
  PDF_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$API/pdf/manifiesto/$MAN_ID")
  check "4.11 Descargar PDF → 200" "200" "$PDF_STATUS"

  # 4.12 Certificado
  CERT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $ADMIN_TOKEN" "$API/pdf/certificado/$MAN_ID")
  check "4.12 Descargar certificado → 200" "200" "$CERT_STATUS"

  # 4.13 Blockchain
  RESP=$(http_get "/blockchain/manifiesto/$MAN_ID" "$ADMIN_TOKEN")
  check "4.13 Blockchain status → 200" "200" "$(get_status "$RESP")"
else
  echo -e "  ${RED}SKIP${NC} No se pudo crear manifiesto"
  TOTAL=$((TOTAL+11))
fi

echo ""

# ============================================================
# SECCION 5: ALERTAS Y NOTIFICACIONES
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 5: ALERTAS Y NOTIFICACIONES${NC}"

RESP=$(http_get "/alertas?limit=3" "$ADMIN_TOKEN")
check "5.1 ADMIN alertas → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get "/notificaciones?limit=3" "$GEN_TOKEN")
check "5.2 GENERADOR notificaciones → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get "/notificaciones?limit=3" "$TRANS_TOKEN")
BODY=$(get_body "$RESP")
check "5.3 TRANSPORTISTA notificaciones → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get "/notificaciones?limit=3" "$OPER_TOKEN")
check "5.4 OPERADOR notificaciones → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get "/admin/email-queue?limit=3" "$ADMIN_TOKEN")
check "5.5 Email queue → 200" "200" "$(get_status "$RESP")"

echo ""

# ============================================================
# SECCION 6: ACCESOS SECTORIALES
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 6: ACCESOS SECTORIALES${NC}"

if [ -n "$AG_TOKEN" ]; then
  RESP=$(http_get "/alertas?limit=1" "$AG_TOKEN")
  check "6.1 ADMIN_GENERADOR alertas → 200" "200" "$(get_status "$RESP")"

  RESP=$(http_get "/blockchain/registro?limit=1" "$AG_TOKEN")
  check "6.2 ADMIN_GENERADOR blockchain → 200" "200" "$(get_status "$RESP")"

  RESP=$(http_get "/admin/email-queue?limit=1" "$AG_TOKEN")
  check "6.3 ADMIN_GENERADOR email-queue → 200" "200" "$(get_status "$RESP")"
else
  echo -e "  ${YELLOW}SKIP${NC} 6.1-6.3 No ADMIN_GENERADOR token"
  TOTAL=$((TOTAL+3))
fi

# GENERADOR no debe acceder a /alertas (admin only)
RESP=$(http_get "/alertas?limit=1" "$GEN_TOKEN")
check "6.4 GENERADOR alertas → 403" "403" "$(get_status "$RESP")"

# GENERADOR no debe acceder a /admin/usuarios
RESP=$(http_get "/admin/usuarios?limit=1" "$GEN_TOKEN")
check "6.5 GENERADOR usuarios → 403" "403" "$(get_status "$RESP")"

echo ""

# ============================================================
# SECCION 7: ENDPOINTS PUBLICOS
# ============================================================
echo -e "${BOLD}${YELLOW}SECCION 7: ENDPOINTS PUBLICOS (sin auth)${NC}"

RESP=$(http_get_anon "/health")
check "7.1 Health → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get_anon "/health/live")
check "7.2 Liveness → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get_anon "/health/ready")
check "7.3 Readiness → 200" "200" "$(get_status "$RESP")"

if [ -n "$MAN_NUM" ]; then
  RESP=$(http_get_anon "/manifiestos/verificar/$MAN_NUM")
  check "7.4 QR verificacion publica → 200" "200" "$(get_status "$RESP")"
else
  echo -e "  ${YELLOW}SKIP${NC} 7.4 No manifiesto numero"
  TOTAL=$((TOTAL+1))
fi

RESP=$(http_get_anon "/catalogos/tipos-residuos")
check "7.5 Tipos residuos publico → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get_anon "/catalogos/enrichment/generadores")
check "7.6 Enrichment generadores → 200" "200" "$(get_status "$RESP")"

RESP=$(http_get_anon "/catalogos/enrichment/operadores")
check "7.7 Enrichment operadores → 200" "200" "$(get_status "$RESP")"

echo ""

# ============================================================
# RESUMEN
# ============================================================
ELAPSED=$(($(date +%s) - TS))
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  RESUMEN${NC}"
echo -e "${BOLD}============================================================${NC}"
echo -e "  Total:  $TOTAL tests"
echo -e "  ${GREEN}PASS:   $PASS${NC}"
if [ $FAIL -gt 0 ]; then
  echo -e "  ${RED}FAIL:   $FAIL${NC}"
  echo -e "\n  Errores:$ERRORS"
else
  echo -e "  ${RED}FAIL:   0${NC}"
fi
echo -e "  Tiempo: ${ELAPSED}s"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}ALL TESTS PASSED${NC}"
  exit 0
else
  echo -e "  ${RED}${BOLD}SOME TESTS FAILED${NC}"
  exit 1
fi
