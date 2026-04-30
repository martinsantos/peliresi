#!/bin/bash
# SITREP — Cross-Cutting: Manifiesto Lifecycle + Blockchain + PDF + Notifications
# Full lifecycle BORRADOR->TRATADO, verifying blockchain seals at each step,
# PDF generation, and multi-role notifications.
# Uso: bash backend/tests/cross-manifiesto-lifecycle-test.sh [BASE_URL]
set -uo pipefail

API="${1:-https://sitrep.ultimamilla.com.ar}/api"
PASS=0; FAIL=0; SKIP=0; TOTAL=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'; BOLD='\033[1m'

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
echo -e "${BOLD}${CYAN}  CROSS-CUTTING: Manifiesto Lifecycle${NC}"
echo -e "${BOLD}${CYAN}  Target: $API${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Auth all 4 roles
TOKEN_GEN=$(get_token "quimica.mendoza@industria.com" "gen123")
TOKEN_TRANS=$(get_token "transportes.andes@logistica.com" "trans123")
TOKEN_OPER=$(get_token "tratamiento.residuos@planta.com" "op123")
TOKEN_ADMIN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")

check "[AUTH] GENERADOR" "true" "$([ -n "$TOKEN_GEN" ] && echo true || echo false)"
check "[AUTH] TRANSPORTISTA" "true" "$([ -n "$TOKEN_TRANS" ] && echo true || echo false)"
check "[AUTH] OPERADOR" "true" "$([ -n "$TOKEN_OPER" ] && echo true || echo false)"
check "[AUTH] ADMIN" "true" "$([ -n "$TOKEN_ADMIN" ] && echo true || echo false)"

if [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_TRANS" ] || [ -z "$TOKEN_OPER" ] || [ -z "$TOKEN_ADMIN" ]; then
  echo -e "${RED}FATAL: No se pudieron autenticar todos los roles${NC}"; exit 1
fi

# Resolve actor IDs from user profiles
GEN_ID=$(curl -s -H "Authorization: Bearer $TOKEN_GEN" "$API/auth/profile" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('data',{}).get('user',{}); g=u.get('generador',{}); print(g.get('id',''))" 2>/dev/null)
TRANS_ID=$(curl -s -H "Authorization: Bearer $TOKEN_TRANS" "$API/auth/profile" | python3 -c "import sys,json; d=json.load(sys.stdin); u=d.get('data',{}).get('user',{}); t=u.get('transportista',{}); print(t.get('id',''))" 2>/dev/null)
OPER_ID=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$API/catalogos/operadores?limit=1" | python3 -c "import sys,json; d=json.load(sys.stdin); items=d.get('data',{}).get('operadores',[]); print(items[0]['id'] if items else '')" 2>/dev/null)

# Pick residuo supported by the operador's tratamientos
TIPO_RESIDUO_ID=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$API/catalogos/operadores/$OPER_ID/tratamientos" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',{})
t=data.get('tratamientos',data.get('tratamientosAutorizados',[]))
for item in t:
    tr = item.get('tipoResiduo', item)
    rid = tr.get('id','') or item.get('tipoResiduoId','')
    if rid:
        print(rid)
        break
" 2>/dev/null)

echo "  GEN_ID=$GEN_ID  TRANS_ID=$TRANS_ID  OPER_ID=$OPER_ID  RESIDUO_ID=$TIPO_RESIDUO_ID"
if [ -z "$GEN_ID" ] || [ -z "$TRANS_ID" ] || [ -z "$OPER_ID" ] || [ -z "$TIPO_RESIDUO_ID" ]; then
  echo -e "${RED}FATAL: No se pudieron resolver IDs de actores${NC}"; exit 1
fi

sleep 2

# ════════════════════════════════════════════════════════════════
# 1. CREAR manifiesto como GENERADOR
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 1. Crear manifiesto (GENERADOR) ═══${NC}"

RESP=$(http_post "/manifiestos" "$TOKEN_GEN" \
  "{\"transportistaId\":\"$TRANS_ID\",\"operadorId\":\"$OPER_ID\",\"residuos\":[{\"tipoResiduoId\":\"$TIPO_RESIDUO_ID\",\"cantidad\":100,\"unidad\":\"kg\",\"descripcion\":\"Residuos test cross-cutting\"}]}")
STATUS=$(get_status "$RESP")
BODY=$(get_body "$RESP")
MAN_ID=$(get_json_val "d.get('data',{}).get('manifiesto',{}).get('id','')" "$BODY")
MAN_NUM=$(get_json_val "d.get('data',{}).get('manifiesto',{}).get('numero','')" "$BODY")

check "1.1 Crear manifiesto -> 201" "201" "$STATUS"
check "1.2 Manifiesto ID presente" "true" "$([ -n "$MAN_ID" ] && echo true || echo false)"
check "1.3 Numero presente" "true" "$([ -n "$MAN_NUM" ] && echo true || echo false)"

if [ -z "$MAN_ID" ]; then echo -e "${RED}FATAL: No se creo el manifiesto${NC}"; exit 1; fi
check_contains "1.4 Estado = BORRADOR" "$BODY" "BORRADOR"

sleep 1

# ════════════════════════════════════════════════════════════════
# 2. FIRMAR (BORRADOR->APROBADO) + blockchain GENESIS
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 2. Firmar + verificar blockchain GENESIS ═══${NC}"

RESP=$(http_post "/manifiestos/$MAN_ID/firmar" "$TOKEN_GEN" "")
STATUS=$(get_status "$RESP")
check "2.1 Firmar -> 200" "200" "$STATUS"

# Blockchain GENESIS seal
BLOCKCHAIN=$(http_get "/blockchain/manifiesto/$MAN_ID" "$TOKEN_ADMIN")
check "2.2 Blockchain endpoint -> 200" "200" "$(get_status "$BLOCKCHAIN")"
BODY_BC=$(get_body "$BLOCKCHAIN")
check_contains "2.3 Sello GENESIS presente" "$BODY_BC" "GENESIS"

# Verify manifiesto state via GET /manifiestos/:id
MAN_RESP=$(http_get "/manifiestos/$MAN_ID" "$TOKEN_ADMIN")
check_contains "2.4 Estado = APROBADO" "$(get_body "$MAN_RESP")" "APROBADO"

sleep 1

# ════════════════════════════════════════════════════════════════
# 3. CONFIRMAR RETIRO (APROBADO->EN_TRANSITO) + GPS
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 3. Confirmar retiro (TRANSPORTISTA) ═══${NC}"

RESP=$(http_post "/manifiestos/$MAN_ID/confirmar-retiro" "$TOKEN_TRANS" \
  "{\"latitud\":-32.88,\"longitud\":-68.84}")
check "3.1 Confirmar retiro -> 200" "200" "$(get_status "$RESP")"

# GPS ubicacion
RESP=$(http_post "/manifiestos/$MAN_ID/ubicacion" "$TOKEN_TRANS" \
  "{\"latitud\":-32.89,\"longitud\":-68.85,\"velocidad\":40}")
check "3.2 GPS ubicacion -> 200" "200" "$(get_status "$RESP")"

sleep 1

# ════════════════════════════════════════════════════════════════
# 4. CONFIRMAR ENTREGA (EN_TRANSITO->ENTREGADO)
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 4. Confirmar entrega (TRANSPORTISTA) ═══${NC}"

RESP=$(http_post "/manifiestos/$MAN_ID/confirmar-entrega" "$TOKEN_TRANS" "")
check "4.1 Confirmar entrega -> 200" "200" "$(get_status "$RESP")"

sleep 1

# ════════════════════════════════════════════════════════════════
# 5. CONFIRMAR RECEPCION (ENTREGADO->RECIBIDO)
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 5. Confirmar recepcion (OPERADOR) ═══${NC}"

RESP=$(http_post "/manifiestos/$MAN_ID/confirmar-recepcion" "$TOKEN_OPER" "")
check "5.1 Confirmar recepcion -> 200" "200" "$(get_status "$RESP")"

sleep 1

# ════════════════════════════════════════════════════════════════
# 6. CERRAR (RECIBIDO->TRATADO) + blockchain CIERRE + PDF + notificaciones
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 6. Cerrar + blockchain CIERRE + PDF + notificaciones ═══${NC}"

RESP=$(http_post "/manifiestos/$MAN_ID/cerrar" "$TOKEN_OPER" \
  "{\"metodoTratamiento\":\"INCINERACION\",\"observaciones\":\"Tratamiento completado\"}")
STATUS=$(get_status "$RESP")
check "6.1 Cerrar -> 200" "200" "$STATUS"

# Blockchain CIERRE seal
sleep 2
BLOCKCHAIN=$(http_get "/blockchain/manifiesto/$MAN_ID" "$TOKEN_ADMIN")
BODY_BC=$(get_body "$BLOCKCHAIN")
check "6.2 Blockchain endpoint -> 200" "200" "$(get_status "$BLOCKCHAIN")"
check_contains "6.3 Sello CIERRE presente" "$BODY_BC" "CIERRE"
check_contains "6.4 Rolling hash presente" "$BODY_BC" "rollingHash"

sleep 1

# ════════════════════════════════════════════════════════════════
# 7. VERIFICAR integridad blockchain
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 7. Verificar integridad blockchain ═══${NC}"

RESP=$(http_get "/blockchain/verificar-integridad/$MAN_ID" "$TOKEN_ADMIN")
BODY=$(get_body "$RESP")
check "7.1 Verificar integridad -> 200" "200" "$(get_status "$RESP")"
check_contains "7.2 Genesis verificado" "$BODY" "genesisVerificado"

# QR verification (public)
RESP=$(curl -s -w "\n%{http_code}" "$API/manifiestos/verificar/$MAN_NUM")
check "7.3 QR verification public -> 200" "200" "$(get_status "$RESP")"

sleep 1

# ════════════════════════════════════════════════════════════════
# 8. PDF generado
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 8. PDF generado ═══${NC}"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_ADMIN" "$API/pdf/manifiesto/$MAN_ID")
check "8.1 PDF manifiesto -> 200" "200" "$RESP"

RESP=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN_ADMIN" "$API/pdf/certificado/$MAN_ID")
check "8.2 PDF certificado -> 200" "200" "$RESP"

sleep 1

# ════════════════════════════════════════════════════════════════
# 9. NOTIFICACIONES para todos los roles
# ════════════════════════════════════════════════════════════════
echo -e "\n${BOLD}${CYAN}═══ 9. Notificaciones multi-rol ═══${NC}"

for ROLE in "GENERADOR" "TRANSPORTISTA" "OPERADOR" "ADMIN"; do
  case "$ROLE" in
    GENERADOR) T=$TOKEN_GEN ;;
    TRANSPORTISTA) T=$TOKEN_TRANS ;;
    OPERADOR) T=$TOKEN_OPER ;;
    ADMIN) T=$TOKEN_ADMIN ;;
  esac
  RESP=$(http_get "/notificaciones?limit=5" "$T")
  check "9.1 $ROLE notificaciones -> 200" "200" "$(get_status "$RESP")"
done

# Summary
echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "  Total:  $TOTAL tests"
echo -e "  ${GREEN}PASS:   $PASS${NC}"
echo -e "  ${RED}FAIL:   $FAIL${NC}"
if [ $SKIP -gt 0 ]; then echo -e "  ${YELLOW}SKIP:   $SKIP${NC}"; fi
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}CROSS MANIFIESTO LIFECYCLE: ALL TESTS PASSED${NC}"; exit 0
else
  echo -e "  ${RED}${BOLD}SOME TESTS FAILED${NC}"; echo "$ERRORS"; exit 1
fi
