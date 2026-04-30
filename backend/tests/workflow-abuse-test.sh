#!/bin/bash
# Workflow Abuse / State Transition Matrix Test — SITREP
# Tests manifiesto state machine for cross-role actions, state skipping,
# double-tap transitions, and invalid reversions.
# Uso: bash backend/tests/workflow-abuse-test.sh [BASE_URL]
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
echo -e "${YELLOW}   SITREP — Workflow Abuse / State Transition Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert() {
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
TOKEN_ADMIN=$(login "admin@dgfa.mendoza.gov.ar" "admin123"); sleep 1
TOKEN_GEN=$(login "quimica.mendoza@industria.com" "gen123"); sleep 1
TOKEN_TRANS=$(login "transportes.andes@logistica.com" "trans123"); sleep 1
TOKEN_OPER=$(login "tratamiento.residuos@planta.com" "op123")

if [ -z "$TOKEN_ADMIN" ] || [ -z "$TOKEN_GEN" ] || [ -z "$TOKEN_TRANS" ] || [ -z "$TOKEN_OPER" ]; then
  echo -e "${RED}ERROR CRÍTICO: No se pudieron obtener tokens.${NC}"; exit 1
fi

# ── Resolve manifest IDs ────────────────────────────────────────
echo "Resolviendo IDs de manifiestos por estado..."
FETCH_MAN() {
  local state="$1"
  curl -s -H "Authorization: Bearer $TOKEN_ADMIN" \
    "$BASE/manifiestos?estado=$state&limit=1" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null
}

MAN_BORRADOR=$(FETCH_MAN "BORRADOR"); sleep 1
MAN_APROBADO=$(FETCH_MAN "APROBADO"); sleep 1
MAN_TRANSITO=$(FETCH_MAN "EN_TRANSITO"); sleep 1
MAN_ENTREGADO=$(FETCH_MAN "ENTREGADO"); sleep 1
MAN_RECIBIDO=$(FETCH_MAN "RECIBIDO"); sleep 1
MAN_TRATADO=$(FETCH_MAN "TRATADO")

echo "  BORRADOR=${MAN_BORRADOR:-none}  APROBADO=${MAN_APROBADO:-none}"
echo "  EN_TRANSITO=${MAN_TRANSITO:-none}  ENTREGADO=${MAN_ENTREGADO:-none}"
echo "  RECIBIDO=${MAN_RECIBIDO:-none}  TRATADO=${MAN_TRATADO:-none}"

echo ""
echo -e "${CYAN}═══ Cross-role workflow actions ═══${NC}"

# Test 1: TRANSPORTISTA cannot firmar (GENERADOR action)
echo -e "\n[1] TRANSPORTISTA → firmar → 403"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/firmar" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  assert "TRANSPORTISTA → firmar (BORRADOR) → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No BORRADOR disponible"; ((SKIP++))
fi

# Test 2: GENERADOR cannot confirmar-retiro (TRANSPORTISTA action)
echo -e "\n[2] GENERADOR → confirmar-retiro → 403"
if [ -n "$MAN_APROBADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_APROBADO/confirmar-retiro" \
    -H "Authorization: Bearer $TOKEN_GEN" 2>/dev/null)
  assert "GENERADOR → confirmar-retiro (APROBADO) → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No APROBADO disponible"; ((SKIP++))
fi

echo ""
echo -e "${CYAN}═══ State skipping tests ═══${NC}"

# Test 3: BORRADOR → confirmar-recepcion (skip states)
echo -e "\n[3] BORRADOR → confirmar-recepcion → 400"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/confirmar-recepcion" \
    -H "Authorization: Bearer $TOKEN_OPER" 2>/dev/null)
  assert "BORRADOR → confirmar-recepcion → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No BORRADOR disponible"; ((SKIP++))
fi

# Test 4: BORRADOR → confirmar-entrega (skip states)
echo -e "\n[4] BORRADOR → confirmar-entrega → 400"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/confirmar-entrega" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  assert "BORRADOR → confirmar-entrega → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No BORRADOR disponible"; ((SKIP++))
fi

# Test 5: APROBADO → confirmar-recepcion (not IN_SITU)
echo -e "\n[5] APROBADO → confirmar-recepcion → 400"
if [ -n "$MAN_APROBADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_APROBADO/confirmar-recepcion" \
    -H "Authorization: Bearer $TOKEN_OPER" 2>/dev/null)
  assert "APROBADO → confirmar-recepcion → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No APROBADO disponible"; ((SKIP++))
fi

echo ""
echo -e "${CYAN}═══ Backward transition tests ═══${NC}"

# Test 6: EN_TRANSITO → firmar (backward without revertir)
echo -e "\n[6] EN_TRANSITO → firmar → 400"
if [ -n "$MAN_TRANSITO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/firmar" \
    -H "Authorization: Bearer $TOKEN_GEN" 2>/dev/null)
  assert "EN_TRANSITO → firmar → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No EN_TRANSITO disponible"; ((SKIP++))
fi

# Test 7: EN_TRANSITO → confirmar-retiro (double-tap)
echo -e "\n[7] EN_TRANSITO → confirmar-retiro → 400"
if [ -n "$MAN_TRANSITO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/confirmar-retiro" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  assert "EN_TRANSITO → confirmar-retiro → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No EN_TRANSITO disponible"; ((SKIP++))
fi

echo ""
echo -e "${CYAN}═══ Cancel on invalid states ═══${NC}"

# Test 8: CANCELADO → cancelar (already canceled)
echo -e "\n[8] CANCELADO → cancelar → 400"
CANCELABLE_ID=$(curl -s -H "Authorization: Bearer $TOKEN_GEN" \
  "$BASE/manifiestos?estado=BORRADOR&limit=1" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); dd=d.get('data',{}); items=dd.get('manifiestos',dd.get('items',[])); print(items[0]['id'] if items else '')" 2>/dev/null)
if [ -n "$CANCELABLE_ID" ]; then
  # Cancel it
  curl -s -o /dev/null -X POST "$BASE/manifiestos/$CANCELABLE_ID/cancelar" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test para workflow-abuse"}' 2>/dev/null
  sleep 1
  # Try cancel again
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$CANCELABLE_ID/cancelar" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test again"}' 2>/dev/null)
  assert "CANCELADO → cancelar → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No BORRADOR para cancelar"; ((SKIP++))
fi

# Test 9: TRATADO → cancelar (not allowed)
echo -e "\n[9] TRATADO → cancelar → 400"
if [ -n "$MAN_TRATADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRATADO/cancelar" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"motivo":"test"}' 2>/dev/null)
  assert "TRATADO → cancelar → 400" "400" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No TRATADO disponible"; ((SKIP++))
fi

echo ""
echo -e "${CYAN}═══ revertir-estado: non-ADMIN blocked ═══${NC}"

# Test 10-12: Non-ADMIN revertir-estado
echo -e "\n[10] GENERADOR → revertir-estado → 403"
if [ -n "$MAN_BORRADOR" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_BORRADOR/revertir-estado" \
    -H "Authorization: Bearer $TOKEN_GEN" \
    -H "Content-Type: application/json" \
    -d '{"estadoNuevo":"BORRADOR"}' 2>/dev/null)
  assert "GENERADOR → revertir-estado → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No manifiesto"; ((SKIP++))
fi

echo -e "\n[11] TRANSPORTISTA → revertir-estado → 403"
if [ -n "$MAN_TRANSITO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_TRANSITO/revertir-estado" \
    -H "Authorization: Bearer $TOKEN_TRANS" \
    -H "Content-Type: application/json" \
    -d '{"estadoNuevo":"APROBADO"}' 2>/dev/null)
  assert "TRANSPORTISTA → revertir-estado → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No manifiesto"; ((SKIP++))
fi

echo -e "\n[12] OPERADOR → revertir-estado → 403"
if [ -n "$MAN_ENTREGADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_ENTREGADO/revertir-estado" \
    -H "Authorization: Bearer $TOKEN_OPER" \
    -H "Content-Type: application/json" \
    -d '{"estadoNuevo":"EN_TRANSITO"}' 2>/dev/null)
  assert "OPERADOR → revertir-estado → 403" "403" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No manifiesto"; ((SKIP++))
fi

echo ""
echo -e "${CYAN}═══ Cross-role + wrong state combo ═══${NC}"

# Test 13: RECIBIDO → confirmar-entrega (wrong role + wrong state)
echo -e "\n[13] RECIBIDO → confirmar-entrega → 403 (cross-role)"
if [ -n "$MAN_RECIBIDO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_RECIBIDO/confirmar-entrega" \
    -H "Authorization: Bearer $TOKEN_TRANS" 2>/dev/null)
  if [ "$HTTP" = "403" ] || [ "$HTTP" = "400" ]; then
	    echo -e "  ${GREEN}PASS${NC} [HTTP $HTTP] RECIBIDO → confirmar-entrega acepta 403 o 400"; ((PASS++))
	  else
	    echo -e "  ${RED}FAIL${NC} [expected 403/400, got $HTTP] RECIBIDO → confirmar-entrega"; ((FAIL++))
	  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No RECIBIDO disponible"; ((SKIP++))
fi

# Test 14: ADMIN can confirmar-retiro (sanity check)
echo -e "\n[14] ADMIN → confirmar-retiro → 200 (sanity check)"
if [ -n "$MAN_APROBADO" ]; then
  HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
    -X POST "$BASE/manifiestos/$MAN_APROBADO/confirmar-retiro" \
    -H "Authorization: Bearer $TOKEN_ADMIN" 2>/dev/null)
  assert "ADMIN → confirmar-retiro → 200" "200" "$HTTP"
else
  echo -e "  ${YELLOW}SKIP${NC} No APROBADO disponible"; ((SKIP++))
fi

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"

exit $((FAIL > 0 ? 1 : 0))
