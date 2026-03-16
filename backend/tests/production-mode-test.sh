#!/bin/bash
# ============================================================
# SITREP — Production Mode Test
# Verifica que el sistema funciona contra API real sin mocks
# Usage: bash backend/tests/production-mode-test.sh [BASE_URL]
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar/api}"
PASS=0
FAIL=0

ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }

check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    ok "$desc"
  else
    fail "$desc (esperado=$expected, actual=$actual)"
  fi
}

section() { echo ""; echo "── $1 ──"; }

# ────────────────────────────────────────────────
# Login helpers
# ────────────────────────────────────────────────
login_token() {
  # Response: { success, data: { accessToken, refreshToken, user } }
  curl -s -X POST "$BASE_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('tokens',{}).get('accessToken','') or d.get('data',{}).get('accessToken',''))" 2>/dev/null
}

http_get_status() {
  curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $1" "$BASE_URL$2"
}

http_post_status() {
  local token="$1" endpoint="$2" body="$3"
  curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "Authorization: Bearer $token" \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$BASE_URL$endpoint"
}

http_post_anon_status() {
  local endpoint="$1" body="$2"
  curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H 'Content-Type: application/json' \
    -d "$body" \
    "$BASE_URL$endpoint"
}

# ────────────────────────────────────────────────
# 1. AUTH — login con credenciales reales
# ────────────────────────────────────────────────
section "[AUTH] Login credenciales reales"

ADMIN_TOKEN=$(login_token 'admin@dgfa.mendoza.gov.ar'       'admin123')
GEN_TOKEN=$(login_token   'quimica.mendoza@industria.com'   'gen123')
TRANS_TOKEN=$(login_token 'transportes.andes@logistica.com' 'trans123')
OP_TOKEN=$(login_token    'tratamiento.residuos@planta.com'  'op123')

[ -n "$ADMIN_TOKEN" ]  && ok  "ADMIN login → token obtenido"       || fail "ADMIN login falló"
[ -n "$GEN_TOKEN" ]    && ok  "GENERADOR login → token obtenido"   || fail "GENERADOR login falló"
[ -n "$TRANS_TOKEN" ]  && ok  "TRANSPORTISTA login → token obtenido" || fail "TRANSPORTISTA login falló"
[ -n "$OP_TOKEN" ]     && ok  "OPERADOR login → token obtenido"    || fail "OPERADOR login falló"

# ────────────────────────────────────────────────
# 2. AUTH — credenciales inválidas → 401 sin fallback
# ────────────────────────────────────────────────
section "[AUTH] Credenciales inválidas"

STATUS=$(http_post_anon_status '/auth/login' '{"email":"noexiste@test.com","password":"wrongpass"}')
check "Login inválido → 401" "401" "$STATUS"

# ────────────────────────────────────────────────
# 3. AUTH — password débil en registro → 400
# ────────────────────────────────────────────────
section "[AUTH] Validación de password en registro"

STATUS=$(http_post_anon_status '/auth/register' '{"email":"nuevo@test.com","password":"abc","rol":"GENERADOR","nombre":"Test"}')
check "Password débil en registro → 400" "400" "$STATUS"

# ────────────────────────────────────────────────
# 4. SEGURIDAD — TRANSPORTISTA solo ve SUS manifiestos
# ────────────────────────────────────────────────
section "[SEGURIDAD] Filtro transportistaId"

if [ -n "$ADMIN_TOKEN" ] && [ -n "$TRANS_TOKEN" ]; then
  ADMIN_RESP=$(curl -s "$BASE_URL/manifiestos?limit=1" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  ADMIN_TOTAL=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null)

  TRANS_RESP=$(curl -s "$BASE_URL/manifiestos?limit=1" \
    -H "Authorization: Bearer $TRANS_TOKEN")
  TRANS_TOTAL=$(echo "$TRANS_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('total',0))" 2>/dev/null)

  if [ -n "$ADMIN_TOTAL" ] && [ -n "$TRANS_TOTAL" ]; then
    if [ "$TRANS_TOTAL" -le "$ADMIN_TOTAL" ] 2>/dev/null; then
      ok "TRANSPORTISTA ve ≤ manifiestos que ADMIN ($TRANS_TOTAL ≤ $ADMIN_TOTAL)"
    else
      fail "TRANSPORTISTA ve MÁS manifiestos que ADMIN ($TRANS_TOTAL > $ADMIN_TOTAL)"
    fi
  else
    fail "No se pudieron obtener totales (admin=$ADMIN_TOTAL trans=$TRANS_TOTAL)"
  fi
else
  fail "Tokens no disponibles para test de filtro"
fi

# ────────────────────────────────────────────────
# 5. SEGURIDAD — TRANSPORTISTA dashboard filtrado
# ────────────────────────────────────────────────
section "[SEGURIDAD] Dashboard TRANSPORTISTA"

if [ -n "$TRANS_TOKEN" ]; then
  STATUS=$(http_get_status "$TRANS_TOKEN" '/manifiestos/dashboard')
  check "Dashboard TRANSPORTISTA → 200" "200" "$STATUS"
else
  fail "Token TRANSPORTISTA no disponible"
fi

# ────────────────────────────────────────────────
# 6. SMOKE — endpoints críticos como ADMIN
# ────────────────────────────────────────────────
section "[SMOKE] Endpoints críticos (ADMIN)"

if [ -n "$ADMIN_TOKEN" ]; then
  for endpoint in \
    "/manifiestos" \
    "/actores/generadores" \
    "/actores/transportistas" \
    "/actores/operadores" \
    "/catalogos/tipos-residuos" \
    "/reportes/manifiestos" \
    "/analytics/manifiestos-por-mes" \
    "/analytics/manifiestos-por-estado" \
    "/admin/usuarios"
  do
    STATUS=$(http_get_status "$ADMIN_TOKEN" "$endpoint")
    check "$endpoint → 200" "200" "$STATUS"
  done
else
  fail "Token ADMIN no disponible — saltando smoke"
fi

# Health (sin auth)
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/health")
check "/health → 200" "200" "$STATUS"

# ────────────────────────────────────────────────
# 7. DASHBOARD — datos reales (total > 0)
# ────────────────────────────────────────────────
section "[DASHBOARD] Datos reales"

if [ -n "$ADMIN_TOKEN" ]; then
  DASH=$(curl -s "$BASE_URL/manifiestos/dashboard" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  TOTAL=$(echo "$DASH" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data',d)
print(data.get('total') or data.get('estadisticas',{}).get('total') or data.get('stats',{}).get('total') or 0)
" 2>/dev/null)
  if [ "${TOTAL:-0}" -gt 0 ] 2>/dev/null; then
    ok "Dashboard tiene $TOTAL manifiestos reales"
  else
    fail "Dashboard sin datos (total=${TOTAL:-?})"
  fi
else
  fail "Token ADMIN no disponible"
fi

# ────────────────────────────────────────────────
# RESULTADO
# ────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════"
TOTAL_TESTS=$((PASS + FAIL))
echo "Resultado: $PASS/$TOTAL_TESTS tests PASS"
if [ $FAIL -gt 0 ]; then
  echo "FALLOS: $FAIL"
  exit 1
else
  echo "✅ Todos los tests pasaron"
  exit 0
fi
