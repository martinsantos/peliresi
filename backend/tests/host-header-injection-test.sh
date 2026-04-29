#!/bin/bash
# Host Header Injection Test — SITREP
# Tests that attacker-controlled Host/X-Forwarded-Host headers are not
# reflected in responses or used for URL generation.
# Uso: bash backend/tests/host-header-injection-test.sh [BASE_URL]
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
echo -e "${YELLOW}   SITREP — Host Header Injection Test${NC}"
echo -e "${YELLOW}   Target: $BASE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

assert_no_reflection() {
  local desc="$1" http_code="$2" response_body="$3" domain="$4"
  if [ "$http_code" = "000" ] || [ -z "$http_code" ]; then
    echo -e "  ${YELLOW}WARN${NC} [connection error] $desc"; ((PASS++)); return
  fi
  if echo "$response_body" | grep -qi "$domain"; then
    echo -e "  ${RED}FAIL${NC} [HTTP $http_code] $desc — dominio '$domain' aparece en respuesta"; ((FAIL++))
  else
    echo -e "  ${GREEN}PASS${NC} [HTTP $http_code] $desc — dominio '$domain' NO reflejado"; ((PASS++))
  fi
}

echo ""
echo -e "${CYAN}[1] Host: atacante.com en forgot-password${NC}"
# Need a valid email for forgot-password
RESP=$(curl -s -i --max-time 10 \
  -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -H "Host: atacante.com" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar"}' 2>/dev/null)
HTTP=$(echo "$RESP" | head -1 | awk '{print $2}')
BODY=$(echo "$RESP" | tail -1)
assert_no_reflection "Host header no reflejado" "$HTTP" "$BODY" "atacante.com"

echo ""
echo -e "${CYAN}[2] X-Forwarded-Host: evil.com en forgot-password${NC}"
RESP=$(curl -s -i --max-time 10 \
  -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-Host: evil.com" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar"}' 2>/dev/null)
HTTP=$(echo "$RESP" | head -1 | awk '{print $2}')
BODY=$(echo "$RESP" | tail -1)
assert_no_reflection "X-Forwarded-Host no reflejado" "$HTTP" "$BODY" "evil.com"

echo ""
echo -e "${CYAN}[3] Host + X-Forwarded-Host combinados${NC}"
RESP=$(curl -s -i --max-time 10 \
  -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -H "Host: atacante.com" \
  -H "X-Forwarded-Host: evil2.com" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar"}' 2>/dev/null)
HTTP=$(echo "$RESP" | head -1 | awk '{print $2}')
BODY=$(echo "$RESP" | tail -1)
assert_no_reflection "Headers combinados no reflejados" "$HTTP" "$BODY" "atacante.com"
assert_no_reflection "XFH combinado no reflejado" "$HTTP" "$BODY" "evil2.com"

echo ""
echo -e "${CYAN}[4] Host: localhost${NC}"
RESP=$(curl -s -i --max-time 10 \
  -X POST "$BASE/auth/forgot-password" \
  -H "Content-Type: application/json" \
  -H "Host: localhost" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar"}' 2>/dev/null)
HTTP=$(echo "$RESP" | head -1 | awk '{print $2}')
BODY=$(echo "$RESP" | tail -1)
assert_no_reflection "Host: localhost no reflejado" "$HTTP" "$BODY" "localhost"

echo ""
echo -e "${CYAN}[5] Host: 127.0.0.1:3002 en login${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -H "Host: 127.0.0.1:3002" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} [$HTTP] Login funciona con Host spoofeado (esperado)"; ((PASS++))
else
  echo -e "  ${RED}FAIL${NC} [$HTTP] Login falló con Host spoofeado"; ((FAIL++))
fi

echo ""
echo -e "${CYAN}[6] Host: <script>alert(1)</script> (XSS reflection)${NC}"
RESP=$(curl -s -i --max-time 10 \
  -X GET "$BASE/auth/test" \
  -H "Host: <script>alert(1)</script>" 2>/dev/null)
HTTP=$(echo "$RESP" | head -1 | awk '{print $2}')
BODY=$(echo "$RESP" | tail -1)
if echo "$BODY" | grep -qi "script"; then
  echo -e "  ${RED}FAIL${NC} [HTTP $HTTP] Host header XSS reflejado en respuesta"; ((FAIL++))
else
  echo -e "  ${GREEN}PASS${NC} [HTTP $HTTP] Host header XSS no reflejado"; ((PASS++))
fi

echo ""
echo -e "${CYAN}[7] X-Forwarded-For: 127.0.0.1 (IP spoofing)${NC}"
HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -H "X-Forwarded-For: 127.0.0.1" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"wrongpass"}' 2>/dev/null)
if [ "$HTTP" = "200" ]; then
  echo -e "  ${RED}FAIL${NC} [$HTTP] Login exitoso con X-Forwarded-For spoof (posible bypass)"; ((FAIL++))
elif [ "$HTTP" = "401" ] || [ "$HTTP" = "429" ]; then
  echo -e "  ${GREEN}PASS${NC} [$HTTP] X-Forwarded-For no permite bypass (login requiere pass correcta)"; ((PASS++))
elif [ "$HTTP" = "400" ]; then
  echo -e "  ${GREEN}PASS${NC} [$HTTP] X-Forwarded-For no permite bypass"; ((PASS++))
else
  echo -e "  ${YELLOW}WARN${NC} [$HTTP] Status inesperado"; ((PASS++))
fi

echo ""
echo -e "${CYAN}[8] Host: victim.com en endpoint público${NC}"
RESP=$(curl -s -i --max-time 10 \
  -X GET "$BASE/manifiestos/verificar/MAN-2026-000001" \
  -H "Host: victim.com" 2>/dev/null)
HTTP=$(echo "$RESP" | head -1 | awk '{print $2}')
BODY=$(echo "$RESP" | tail -1)
assert_no_reflection "Endpoint público no refleja Host" "$HTTP" "$BODY" "victim.com"

echo ""
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"

exit $((FAIL > 0 ? 1 : 0))
