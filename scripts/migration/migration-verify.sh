#!/usr/bin/env bash
# ============================================================
# SITREP Migration — Post-cutover Verification
# Runs minimal smoke + e2e + role tests against the new server.
# ============================================================

set -uo pipefail

TARGET="${1:-https://sitrep.ultimamilla.com.ar}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_TESTS="$SCRIPT_DIR/../../backend/tests"

echo "================================================"
echo "  SITREP Migration — Verification Suite"
echo "  Target: $TARGET"
echo "  Date: $(date)"
echo "================================================"
echo ""

PASS=0
FAIL=0

run_check() {
  local label="$1"
  local cmd="$2"
  echo "## $label"
  if eval "$cmd"; then
    echo "  PASS"
    PASS=$((PASS + 1))
  else
    echo "  FAIL"
    FAIL=$((FAIL + 1))
  fi
  echo ""
}

# 1. Health check
run_check "Health endpoint" \
  "curl -sf $TARGET/api/health | grep -q '\"status\":\"ok\"'"

# 2. Liveness
run_check "Liveness probe" \
  "curl -sf $TARGET/api/health/live | grep -q '\"status\":\"alive\"'"

# 3. Readiness
run_check "Readiness probe" \
  "curl -sf $TARGET/api/health/ready | grep -q '\"status\":\"ready\"'"

# 4. Frontend index
run_check "Frontend / loads" \
  "curl -sf -o /dev/null -w '%{http_code}' $TARGET/ | grep -q '200'"

# 5. PWA app
run_check "PWA /app/ loads" \
  "curl -sf -o /dev/null -w '%{http_code}' $TARGET/app/ | grep -q '200'"

# 6. Manual
run_check "Manual /manual/ loads" \
  "curl -sf -o /dev/null -w '%{http_code}' $TARGET/manual/ | grep -q '200'"

# 7. Auth login (admin)
echo "## Auth login (admin)"
TOKEN=$(curl -sf -X POST "$TARGET/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  echo "  PASS — token obtained"
  PASS=$((PASS + 1))
else
  echo "  FAIL — no token"
  FAIL=$((FAIL + 1))
fi
echo ""

# 8-12. Authenticated endpoints
if [ -n "$TOKEN" ]; then
  for endpoint in "manifiestos/dashboard" "actores/generadores" "actores/transportistas" "actores/operadores" "catalogos/tipos-residuos"; do
    run_check "GET /api/$endpoint" \
      "curl -sf -H 'Authorization: Bearer $TOKEN' $TARGET/api/$endpoint -o /dev/null"
  done
fi

# 13. Date validation fix (regression)
echo "## Date validation regression (should return 400, not 500)"
CODE=$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer $TOKEN" \
  "$TARGET/api/reportes/manifiestos?fechaInicio=BAD&fechaFin=ALSOBAD")
if [ "$CODE" = "400" ]; then
  echo "  PASS — got 400 as expected"
  PASS=$((PASS + 1))
else
  echo "  FAIL — got $CODE (expected 400)"
  FAIL=$((FAIL + 1))
fi
echo ""

# 14. PWA canonical route
echo "## PWA canonical route /admin/actores/transportistas"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$TARGET/app/admin/actores/transportistas")
if [ "$CODE" = "200" ]; then
  echo "  PASS"
  PASS=$((PASS + 1))
else
  echo "  FAIL — got $CODE"
  FAIL=$((FAIL + 1))
fi
echo ""

# 15. Run smoke test if available
if [ -f "$BACKEND_TESTS/smoke-test.sh" ]; then
  echo "## Bash smoke test (48 endpoints)"
  if bash "$BACKEND_TESTS/smoke-test.sh" "$TARGET" 2>&1 | grep -q 'ALL TESTS PASSED'; then
    echo "  PASS"
    PASS=$((PASS + 1))
  else
    echo "  FAIL"
    FAIL=$((FAIL + 1))
  fi
  echo ""
fi

echo "================================================"
echo "  VERIFICATION SUMMARY"
echo "  PASS: $PASS, FAIL: $FAIL"
echo "================================================"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
