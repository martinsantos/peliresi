#!/bin/bash
# ============================================================
# SITREP — Test de Produccion Profundo
# Master test script: runs suites + benchmark + stress + multi-user workflow
# Generates a presentable Markdown report.
#
# Usage: bash backend/tests/test-produccion-profundo.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# Output: backend/tests/reports/REPORTE-PRODUCCION-{fecha}.md
# ============================================================

set -uo pipefail

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPORTS_DIR="$SCRIPTS_DIR/reports"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
REPORT_FILE="$REPORTS_DIR/REPORTE-PRODUCCION-${TIMESTAMP}.md"
REPORT_LATEST="$REPORTS_DIR/REPORTE-PRODUCCION-LATEST.md"

mkdir -p "$REPORTS_DIR"

# Colors for terminal
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CURL=$(which curl)

# ── CREDENTIALS ──────────────────────────────────────────────
ADMIN_EMAIL="admin@dgfa.mendoza.gov.ar"
ADMIN_PASS="admin123"
GEN_EMAIL="quimica.mendoza@industria.com"
GEN_PASS="gen123"
TRANS_EMAIL="transportes.andes@logistica.com"
TRANS_PASS="trans123"
OPER_EMAIL="tratamiento.residuos@planta.com"
OPER_PASS="op123"

# ── HELPERS ──────────────────────────────────────────────────

json_extract() {
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$1'.split('.')
    for k in keys:
        if isinstance(d, list):
            d = d[int(k)]
        else:
            d = d[k]
    print(d if d is not None else '')
except Exception:
    print('')
" 2>/dev/null
}

do_login() {
  local EMAIL=$1
  local PASS=$2
  local RESP
  RESP=$($CURL -s -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}")
  echo "$RESP" | json_extract "data.tokens.accessToken"
}

api_call() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local BODY="${4:-}"
  if [ -n "$BODY" ]; then
    $CURL -s -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY"
  else
    $CURL -s -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

api_call_timed() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local BODY="${4:-}"
  local TIME_FILE
  TIME_FILE=$(mktemp)
  if [ -n "$BODY" ]; then
    $CURL -s -o /dev/null -w '%{time_total}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY" > "$TIME_FILE"
  else
    $CURL -s -o /dev/null -w '%{time_total}' -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN" > "$TIME_FILE"
  fi
  cat "$TIME_FILE"
  rm -f "$TIME_FILE"
}

api_call_status() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local BODY="${4:-}"
  if [ -n "$BODY" ]; then
    $CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY"
  else
    $CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

# Convert seconds (decimal) to ms integer
to_ms() {
  python3 -c "print(int(float('${1:-0}') * 1000))"
}

# Calculate stats from a file of ms values (one per line)
calc_stats() {
  local FILE=$1
  python3 -c "
import sys
vals = [int(line.strip()) for line in open('$FILE') if line.strip().isdigit()]
if not vals:
    print('0|0|0')
    sys.exit()
vals.sort()
avg = sum(vals) // len(vals)
p95_idx = int(len(vals) * 0.95)
if p95_idx >= len(vals): p95_idx = len(vals) - 1
p95 = vals[p95_idx]
mx = vals[-1]
print(f'{avg}|{p95}|{mx}')
"
}

# ── REPORT ACCUMULATOR ───────────────────────────────────────

REPORT=""
rpt() {
  REPORT="${REPORT}${1}
"
}

# ============================================================
# 0. PRE-CHECK
# ============================================================

echo -e "${BOLD}${CYAN}========================================${NC}"
echo -e "${BOLD}${CYAN} SITREP — Test de Produccion Profundo${NC}"
echo -e "${BOLD}${CYAN} Target: $BASE_URL${NC}"
echo -e "${BOLD}${CYAN}========================================${NC}"
echo ""

HEALTH_RESP=$($CURL -s "$API/health" 2>/dev/null || echo '{"status":"error"}')
HEALTH_STATUS=$(echo "$HEALTH_RESP" | json_extract "status")
HEALTH_DB=$(echo "$HEALTH_RESP" | json_extract "db")
HEALTH_UPTIME=$(echo "$HEALTH_RESP" | json_extract "uptime")

if [ "$HEALTH_STATUS" != "ok" ]; then
  echo -e "${RED}FATAL: API health check failed. Status: $HEALTH_STATUS${NC}"
  echo "Response: $HEALTH_RESP"
  exit 1
fi
echo -e "${GREEN}API Health: OK (db: $HEALTH_DB, uptime: ${HEALTH_UPTIME}s)${NC}"

# Authenticate all roles
echo "Authenticating 4 roles..."
ADMIN_TOKEN=$(do_login "$ADMIN_EMAIL" "$ADMIN_PASS")
GEN_TOKEN=$(do_login "$GEN_EMAIL" "$GEN_PASS")
TRANS_TOKEN=$(do_login "$TRANS_EMAIL" "$TRANS_PASS")
OPER_TOKEN=$(do_login "$OPER_EMAIL" "$OPER_PASS")

AUTH_OK=0
AUTH_FAIL=0
for T in "$ADMIN_TOKEN" "$GEN_TOKEN" "$TRANS_TOKEN" "$OPER_TOKEN"; do
  if [ -n "$T" ] && [ "$T" != "null" ] && [ ${#T} -gt 20 ]; then
    AUTH_OK=$((AUTH_OK + 1))
  else
    AUTH_FAIL=$((AUTH_FAIL + 1))
  fi
done

if [ "$AUTH_FAIL" -gt 0 ]; then
  echo -e "${RED}FATAL: $AUTH_FAIL of 4 logins failed. Cannot continue.${NC}"
  exit 1
fi
echo -e "${GREEN}All 4 roles authenticated successfully${NC}"
echo ""

GLOBAL_START=$(date +%s)

# ============================================================
# 1. SUITE RUNNER
# ============================================================

echo -e "${BOLD}${CYAN}--- Phase 1: Running Test Suites ---${NC}"

SUITES=(
  "smoke-test.sh|Smoke Test (46 endpoints)"
  "cross-platform-workflow-test.sh|Workflow 4 Roles (59 tests)"
  "role-enforcement-test.sh|Role Enforcement"
  "edge-cases-test.sh|Edge Cases"
  "gps-validation-test.sh|GPS Validation"
  "multiuser-concurrent-test.sh|Concurrencia"
  "auth-flow-test.sh|Auth Lifecycle"
  "alerts-comprehensive-test.sh|Alertas/Eventos"
)

SUITE_TABLE=""
TOTAL_TESTS_PASS=0
TOTAL_TESTS_FAIL=0
SUITES_PASSED=0
SUITES_FAILED=0
TOTAL_SUITES_DURATION=0
FAILURES_DETAIL=""

for SUITE_ENTRY in "${SUITES[@]}"; do
  SCRIPT=$(echo "$SUITE_ENTRY" | cut -d'|' -f1)
  LABEL=$(echo "$SUITE_ENTRY" | cut -d'|' -f2)
  SCRIPT_PATH="$SCRIPTS_DIR/$SCRIPT"

  if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "  ${YELLOW}SKIP${NC} $LABEL (not found)"
    SUITE_TABLE="${SUITE_TABLE}| ${LABEL} | - | - | - | - | SKIP |
"
    continue
  fi

  echo -n "  Running $LABEL..."
  SUITE_START=$(date +%s)
  OUTPUT=$(bash "$SCRIPT_PATH" "$BASE_URL" 2>&1) || true
  SUITE_EXIT=$?
  SUITE_END=$(date +%s)
  SUITE_DUR=$((SUITE_END - SUITE_START))
  TOTAL_SUITES_DURATION=$((TOTAL_SUITES_DURATION + SUITE_DUR))

  # Extract pass/fail from output (sanitize to pure integers)
  S_PASS=$(echo "$OUTPUT" | grep -oE 'PASS[: ]+[0-9]+' | tail -1 | grep -oE '[0-9]+' 2>/dev/null | tr -d '[:space:]')
  S_FAIL=$(echo "$OUTPUT" | grep -oE 'FAIL[: ]+[0-9]+' | tail -1 | grep -oE '[0-9]+' 2>/dev/null | tr -d '[:space:]')
  [ -z "$S_PASS" ] && S_PASS=0
  [ -z "$S_FAIL" ] && S_FAIL=0
  # Fallback: count individual pass/fail markers
  if [ "$S_PASS" -eq 0 ]; then
    S_PASS=$(echo "$OUTPUT" | grep -cE '✓|PASS\b' 2>/dev/null | tr -d '[:space:]')
    [ -z "$S_PASS" ] && S_PASS=0
  fi
  if [ "$S_FAIL" -eq 0 ]; then
    S_FAIL=$(echo "$OUTPUT" | grep -cE '✗|FAIL\b' 2>/dev/null | tr -d '[:space:]')
    [ -z "$S_FAIL" ] && S_FAIL=0
    # Subtract summary lines that mention FAIL in aggregate
    S_FAIL_SUMMARY=$(echo "$OUTPUT" | grep -cE 'FAIL[: ]+[0-9]+' 2>/dev/null | tr -d '[:space:]')
    [ -z "$S_FAIL_SUMMARY" ] && S_FAIL_SUMMARY=0
    if [ "$S_FAIL" -gt 0 ] && [ "$S_FAIL_SUMMARY" -gt 0 ]; then
      S_FAIL=$((S_FAIL - S_FAIL_SUMMARY))
      [ "$S_FAIL" -lt 0 ] && S_FAIL=0
    fi
  fi

  S_TOTAL=$((S_PASS + S_FAIL))
  [ "$S_TOTAL" -eq 0 ] && S_TOTAL="?"
  TOTAL_TESTS_PASS=$((TOTAL_TESTS_PASS + S_PASS))
  TOTAL_TESTS_FAIL=$((TOTAL_TESTS_FAIL + S_FAIL))

  if [ "$SUITE_EXIT" -eq 0 ] && [ "$S_FAIL" -eq 0 ]; then
    STATUS_ICON="PASS"
    SUITES_PASSED=$((SUITES_PASSED + 1))
    echo -e " ${GREEN}PASS${NC} (${S_PASS}/${S_TOTAL}, ${SUITE_DUR}s)"
  else
    STATUS_ICON="FAIL"
    SUITES_FAILED=$((SUITES_FAILED + 1))
    echo -e " ${RED}FAIL${NC} (${S_PASS}/${S_TOTAL}, ${SUITE_DUR}s)"
    # Capture failure details
    FAIL_LINES=$(echo "$OUTPUT" | grep -E '✗|FAIL\b' | head -5)
    FAILURES_DETAIL="${FAILURES_DETAIL}
### ${LABEL}
\`\`\`
${FAIL_LINES}
\`\`\`
"
  fi

  SUITE_TABLE="${SUITE_TABLE}| ${LABEL} | ${S_TOTAL} | ${S_PASS} | ${S_FAIL} | ${SUITE_DUR}s | ${STATUS_ICON} |
"
done

echo ""

# ============================================================
# 2. BENCHMARK DE PERFORMANCE
# ============================================================

echo -e "${BOLD}${CYAN}--- Phase 2: Performance Benchmark ---${NC}"

BENCH_ITERATIONS=10
BENCH_TABLE=""

benchmark_endpoint() {
  local LABEL=$1
  local METHOD=$2
  local EPATH=$3
  local TOKEN=$4
  local BODY="${5:-}"
  local TIMES_FILE
  TIMES_FILE=$(mktemp)

  for i in $(seq 1 $BENCH_ITERATIONS); do
    local T
    if [ -n "$BODY" ]; then
      T=$($CURL -s -o /dev/null -w '%{time_total}' -X "$METHOD" "${API}${EPATH}" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d "$BODY")
    else
      T=$($CURL -s -o /dev/null -w '%{time_total}' -X "$METHOD" "${API}${EPATH}" \
        -H "Authorization: Bearer $TOKEN")
    fi
    to_ms "$T" >> "$TIMES_FILE"
  done

  local STATS
  STATS=$(calc_stats "$TIMES_FILE")
  local AVG=$(echo "$STATS" | cut -d'|' -f1)
  local P95=$(echo "$STATS" | cut -d'|' -f2)
  local MAX=$(echo "$STATS" | cut -d'|' -f3)
  rm -f "$TIMES_FILE"

  local STATUS_B="PASS"
  [ "$P95" -gt 500 ] && STATUS_B="WARN"
  [ "$P95" -gt 2000 ] && STATUS_B="FAIL"

  echo -e "  $LABEL: avg=${AVG}ms p95=${P95}ms max=${MAX}ms [$STATUS_B]"
  BENCH_TABLE="${BENCH_TABLE}| ${LABEL} | ${AVG} | ${P95} | ${MAX} | ${STATUS_B} |
"
}

# Get a real manifiesto ID for benchmarks
MANIFIESTO_ID=$($CURL -s "$API/manifiestos?limit=1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | json_extract "data.manifiestos.0.id")

# Health (public, no auth needed — use admin token anyway)
benchmark_endpoint "GET /api/health" "GET" "/health" "$ADMIN_TOKEN"

# Auth login
BENCH_LOGIN_FILE=$(mktemp)
for i in $(seq 1 $BENCH_ITERATIONS); do
  T=$($CURL -s -o /dev/null -w '%{time_total}' -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
  to_ms "$T" >> "$BENCH_LOGIN_FILE"
done
LOGIN_STATS=$(calc_stats "$BENCH_LOGIN_FILE")
LOGIN_AVG=$(echo "$LOGIN_STATS" | cut -d'|' -f1)
LOGIN_P95=$(echo "$LOGIN_STATS" | cut -d'|' -f2)
LOGIN_MAX=$(echo "$LOGIN_STATS" | cut -d'|' -f3)
LOGIN_STATUS="PASS"
[ "$LOGIN_P95" -gt 500 ] && LOGIN_STATUS="WARN"
echo -e "  POST /api/auth/login: avg=${LOGIN_AVG}ms p95=${LOGIN_P95}ms max=${LOGIN_MAX}ms [$LOGIN_STATUS]"
BENCH_TABLE="${BENCH_TABLE}| POST /api/auth/login | ${LOGIN_AVG} | ${LOGIN_P95} | ${LOGIN_MAX} | ${LOGIN_STATUS} |
"
rm -f "$BENCH_LOGIN_FILE"

benchmark_endpoint "GET /api/manifiestos" "GET" "/manifiestos?limit=20" "$ADMIN_TOKEN"

if [ -n "$MANIFIESTO_ID" ]; then
  benchmark_endpoint "GET /api/manifiestos/:id" "GET" "/manifiestos/$MANIFIESTO_ID" "$ADMIN_TOKEN"
fi

benchmark_endpoint "GET /api/centro-control/actividad" "GET" "/centro-control/actividad?capas=generadores,transportistas,operadores,transito" "$ADMIN_TOKEN"
benchmark_endpoint "GET /api/reportes/manifiestos" "GET" "/reportes/manifiestos?fechaInicio=2025-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN"
benchmark_endpoint "GET /api/analytics/manifiestos-por-mes" "GET" "/analytics/manifiestos-por-mes" "$ADMIN_TOKEN"
benchmark_endpoint "GET /api/manifiestos/dashboard" "GET" "/manifiestos/dashboard" "$ADMIN_TOKEN"

echo ""

# ============================================================
# 3. STRESS TEST (Concurrent Requests)
# ============================================================

echo -e "${BOLD}${CYAN}--- Phase 3: Stress Test ---${NC}"

STRESS_TABLE=""

stress_test() {
  local LABEL=$1
  local PARALLEL=$2
  local METHOD=$3
  local EPATH=$4
  local TOKEN=$5
  local BODY="${6:-}"
  local RESULTS_FILE
  RESULTS_FILE=$(mktemp)
  local TIMES_FILE
  TIMES_FILE=$(mktemp)
  local ERRORS=0
  local RATE_LIMITED=0

  for i in $(seq 1 "$PARALLEL"); do
    (
      local HTTP_CODE TIME_TOTAL
      if [ -n "$BODY" ]; then
        HTTP_CODE=$($CURL -s -o /dev/null -w '%{http_code}|%{time_total}' -X "$METHOD" "${API}${EPATH}" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $TOKEN" \
          -d "$BODY")
      else
        HTTP_CODE=$($CURL -s -o /dev/null -w '%{http_code}|%{time_total}' -X "$METHOD" "${API}${EPATH}" \
          -H "Authorization: Bearer $TOKEN")
      fi
      echo "$HTTP_CODE" >> "$RESULTS_FILE"
    ) &
  done
  wait

  local TOTAL_REQ=$(wc -l < "$RESULTS_FILE" | tr -d ' ')
  local SUCCESS=0
  while IFS= read -r line; do
    local CODE=$(echo "$line" | cut -d'|' -f1)
    local TIME=$(echo "$line" | cut -d'|' -f2)
    to_ms "$TIME" >> "$TIMES_FILE"
    if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
      SUCCESS=$((SUCCESS + 1))
    elif [ "$CODE" = "429" ]; then
      RATE_LIMITED=$((RATE_LIMITED + 1))
    else
      ERRORS=$((ERRORS + 1))
    fi
  done < "$RESULTS_FILE"

  local STATS
  STATS=$(calc_stats "$TIMES_FILE")
  local P95=$(echo "$STATS" | cut -d'|' -f2)
  local SUCCESS_PCT=0
  [ "$TOTAL_REQ" -gt 0 ] && SUCCESS_PCT=$((SUCCESS * 100 / TOTAL_REQ))

  local NOTES=""
  [ "$RATE_LIMITED" -gt 0 ] && NOTES="${RATE_LIMITED} rate-limited"

  echo -e "  $LABEL: ${PARALLEL} req, ${SUCCESS_PCT}% ok, errors=${ERRORS}, p95=${P95}ms ${NOTES:+($NOTES)}"
  STRESS_TABLE="${STRESS_TABLE}| ${LABEL} | ${PARALLEL} | ${SUCCESS_PCT}% | ${ERRORS} | ${P95}ms | ${NOTES:-—} |
"

  rm -f "$RESULTS_FILE" "$TIMES_FILE"
}

# Level 1: 10 parallel health checks (warmup)
stress_test "Health warmup" 10 "GET" "/health" "$ADMIN_TOKEN"

# Level 2: 10 parallel manifiestos reads
stress_test "Manifiestos reads" 10 "GET" "/manifiestos?limit=20" "$ADMIN_TOKEN"

# Level 3: 20 parallel dashboard reads
stress_test "Dashboard x20" 20 "GET" "/manifiestos/dashboard" "$ADMIN_TOKEN"

# Level 4: 50 parallel health (simulate high concurrency)
stress_test "Health x50" 50 "GET" "/health" "$ADMIN_TOKEN"

# Level 5: 5 simultaneous logins
STRESS_LOGIN_FILE=$(mktemp)
STRESS_LOGIN_TIMES=$(mktemp)
for i in $(seq 1 5); do
  (
    HTTP_CODE=$($CURL -s -o /dev/null -w '%{http_code}|%{time_total}' -X POST "$API/auth/login" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
    echo "$HTTP_CODE" >> "$STRESS_LOGIN_FILE"
  ) &
done
wait
LOGIN_BURST_TOTAL=$(wc -l < "$STRESS_LOGIN_FILE" | tr -d '[:space:]')
LOGIN_BURST_OK=$(grep -c '^200|' "$STRESS_LOGIN_FILE" 2>/dev/null | tr -d '[:space:]')
LOGIN_BURST_429=$(grep -c '^429|' "$STRESS_LOGIN_FILE" 2>/dev/null | tr -d '[:space:]')
[ -z "$LOGIN_BURST_TOTAL" ] && LOGIN_BURST_TOTAL=0
[ -z "$LOGIN_BURST_OK" ] && LOGIN_BURST_OK=0
[ -z "$LOGIN_BURST_429" ] && LOGIN_BURST_429=0
LOGIN_BURST_ERR=$((LOGIN_BURST_TOTAL - LOGIN_BURST_OK - LOGIN_BURST_429))
LOGIN_BURST_PCT=0
[ "$LOGIN_BURST_TOTAL" -gt 0 ] && LOGIN_BURST_PCT=$((LOGIN_BURST_OK * 100 / LOGIN_BURST_TOTAL))
LOGIN_NOTES=""
[ "$LOGIN_BURST_429" -gt 0 ] && LOGIN_NOTES="${LOGIN_BURST_429} rate-limited"
echo -e "  Login burst x5: ${LOGIN_BURST_PCT}% ok, errors=${LOGIN_BURST_ERR} ${LOGIN_NOTES:+($LOGIN_NOTES)}"
STRESS_TABLE="${STRESS_TABLE}| Login burst | 5 | ${LOGIN_BURST_PCT}% | ${LOGIN_BURST_ERR} | — | ${LOGIN_NOTES:-—} |
"
rm -f "$STRESS_LOGIN_FILE" "$STRESS_LOGIN_TIMES"

# Level 6: Mixed workload — 20 reads + 10 dashboard in parallel
stress_test "Mixed workload x30" 30 "GET" "/manifiestos?limit=10" "$ADMIN_TOKEN"

echo ""

# ============================================================
# 4. FLUJO MULTI-USUARIO COMPLETO
# ============================================================

echo -e "${BOLD}${CYAN}--- Phase 4: Multi-User Workflow Demo ---${NC}"

WORKFLOW_TABLE=""
WORKFLOW_PASS=0
WORKFLOW_FAIL=0
WORKFLOW_ERRORS=""

wf_step() {
  local STEP=$1
  local ROL=$2
  local ACCION=$3
  local ESTADO_ESPERADO=$4
  local HTTP_STATUS=$5
  local TIME_MS=$6
  local EXTRA="${7:-}"

  if [ "$HTTP_STATUS" = "200" ] || [ "$HTTP_STATUS" = "201" ]; then
    WORKFLOW_PASS=$((WORKFLOW_PASS + 1))
    echo -e "  ${GREEN}PASS${NC} Step $STEP: [$ROL] $ACCION -> $ESTADO_ESPERADO (${TIME_MS}ms)"
  else
    WORKFLOW_FAIL=$((WORKFLOW_FAIL + 1))
    echo -e "  ${RED}FAIL${NC} Step $STEP: [$ROL] $ACCION -> HTTP $HTTP_STATUS (expected 200)"
    WORKFLOW_ERRORS="${WORKFLOW_ERRORS}
- Step $STEP [$ROL] $ACCION: HTTP $HTTP_STATUS"
  fi

  WORKFLOW_TABLE="${WORKFLOW_TABLE}| ${STEP} | ${ROL} | ${ACCION} | ${ESTADO_ESPERADO} | ${TIME_MS} | ${HTTP_STATUS} |
"
}

# Step 1: ADMIN creates draft manifesto
echo "  Creating test manifesto..."

# Get real actor IDs (catalogos wraps in named keys: generadores, transportistas, operadores, tiposResiduos)
GEN_LIST=$(api_call "GET" "/catalogos/generadores" "$ADMIN_TOKEN")
GEN_ID=$(echo "$GEN_LIST" | json_extract "data.generadores.0.id")
TRANS_LIST=$(api_call "GET" "/catalogos/transportistas" "$ADMIN_TOKEN")
TRANS_ID=$(echo "$TRANS_LIST" | json_extract "data.transportistas.0.id")
OPER_LIST=$(api_call "GET" "/catalogos/operadores" "$ADMIN_TOKEN")
OPER_ID=$(echo "$OPER_LIST" | json_extract "data.operadores.0.id")

# Get a real residuo type
RESIDUO_LIST=$(api_call "GET" "/catalogos/tipos-residuos" "$ADMIN_TOKEN")
RESIDUO_ID=$(echo "$RESIDUO_LIST" | json_extract "data.tiposResiduos.0.id")

CREATE_BODY="{
  \"generadorId\": \"$GEN_ID\",
  \"transportistaId\": \"$TRANS_ID\",
  \"operadorId\": \"$OPER_ID\",
  \"residuos\": [{
    \"tipoResiduoId\": \"$RESIDUO_ID\",
    \"cantidad\": 100,
    \"unidad\": \"KG\",
    \"descripcion\": \"[TEST-PROFUNDO] Residuo de prueba automatizada\"
  }],
  \"observaciones\": \"[TEST-PROFUNDO] Test automatizado $(date '+%Y-%m-%d %H:%M')\"
}"

T_START=$(date +%s%N)
CREATE_RESP=$(api_call "POST" "/manifiestos" "$ADMIN_TOKEN" "$CREATE_BODY")
T_END=$(date +%s%N)
T_MS=$(( (T_END - T_START) / 1000000 ))
CREATE_STATUS=$(echo "$CREATE_RESP" | json_extract "success")
TEST_MANIFIESTO_ID=$(echo "$CREATE_RESP" | json_extract "data.manifiesto.id")
TEST_MANIFIESTO_NUM=$(echo "$CREATE_RESP" | json_extract "data.manifiesto.numero")

if [ "$CREATE_STATUS" = "True" ] || [ "$CREATE_STATUS" = "true" ] || [ -n "$TEST_MANIFIESTO_ID" ]; then
  wf_step "1" "ADMIN" "Crear borrador" "BORRADOR" "201" "$T_MS"
  echo "    Manifiesto: $TEST_MANIFIESTO_NUM (ID: $TEST_MANIFIESTO_ID)"
else
  wf_step "1" "ADMIN" "Crear borrador" "BORRADOR" "ERR" "$T_MS"
  echo -e "  ${RED}Cannot continue workflow without manifiesto. Response:${NC}"
  echo "$CREATE_RESP" | head -5
  # Skip to report generation
  TEST_MANIFIESTO_ID=""
fi

if [ -n "$TEST_MANIFIESTO_ID" ]; then

  # Step 2: GENERADOR firma -> APROBADO
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/firmar" "$GEN_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "2" "GENERADOR" "Firmar/Aprobar" "APROBADO" "200" "$T_MS"
  else
    wf_step "2" "GENERADOR" "Firmar/Aprobar" "APROBADO" "ERR" "$T_MS"
  fi

  # Step 3: TRANSPORTISTA confirma retiro -> EN_TRANSITO
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/confirmar-retiro" "$TRANS_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "3" "TRANSPORTISTA" "Confirmar retiro" "EN_TRANSITO" "200" "$T_MS"
  else
    wf_step "3" "TRANSPORTISTA" "Confirmar retiro" "EN_TRANSITO" "ERR" "$T_MS"
  fi

  # Step 4: TRANSPORTISTA envia 3 GPS updates (Mendoza coords)
  GPS_COORDS=(
    "-32.8908|-68.8272|45|0"
    "-32.8850|-68.8200|52|45"
    "-32.8790|-68.8150|38|90"
  )
  GPS_IDX=0
  for COORD in "${GPS_COORDS[@]}"; do
    GPS_IDX=$((GPS_IDX + 1))
    LAT=$(echo "$COORD" | cut -d'|' -f1)
    LNG=$(echo "$COORD" | cut -d'|' -f2)
    VEL=$(echo "$COORD" | cut -d'|' -f3)
    DIR=$(echo "$COORD" | cut -d'|' -f4)
    GPS_BODY="{\"latitud\":$LAT,\"longitud\":$LNG,\"velocidad\":$VEL,\"direccion\":$DIR}"
    T_START=$(date +%s%N)
    RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/ubicacion" "$TRANS_TOKEN" "$GPS_BODY")
    T_END=$(date +%s%N)
    T_MS=$(( (T_END - T_START) / 1000000 ))
    STATUS_CODE=$(echo "$RESP" | json_extract "success")
    if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
      wf_step "4.$GPS_IDX" "TRANSPORTISTA" "GPS update #$GPS_IDX" "EN_TRANSITO" "200" "$T_MS"
    else
      wf_step "4.$GPS_IDX" "TRANSPORTISTA" "GPS update #$GPS_IDX" "EN_TRANSITO" "ERR" "$T_MS"
    fi
  done

  # Step 5: TRANSPORTISTA registra incidente
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/incidente" "$TRANS_TOKEN" \
    '{"tipo":"AVERIA","descripcion":"[TEST] Pinchazo de neumatico en ruta"}')
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "5" "TRANSPORTISTA" "Registrar incidente" "EN_TRANSITO" "200" "$T_MS"
  else
    wf_step "5" "TRANSPORTISTA" "Registrar incidente" "EN_TRANSITO" "ERR" "$T_MS"
  fi

  # Step 6: TRANSPORTISTA confirma entrega -> ENTREGADO
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/confirmar-entrega" "$TRANS_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "6" "TRANSPORTISTA" "Confirmar entrega" "ENTREGADO" "200" "$T_MS"
  else
    wf_step "6" "TRANSPORTISTA" "Confirmar entrega" "ENTREGADO" "ERR" "$T_MS"
  fi

  # Step 7: OPERADOR confirma recepcion -> RECIBIDO
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/confirmar-recepcion" "$OPER_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "7" "OPERADOR" "Confirmar recepcion" "RECIBIDO" "200" "$T_MS"
  else
    wf_step "7" "OPERADOR" "Confirmar recepcion" "RECIBIDO" "ERR" "$T_MS"
  fi

  # Step 8: OPERADOR registra tratamiento -> EN_TRATAMIENTO
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/tratamiento" "$OPER_TOKEN" \
    '{"metodoTratamiento":"Incineracion controlada","observaciones":"[TEST] Tratamiento automatizado"}')
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "8" "OPERADOR" "Registrar tratamiento" "EN_TRATAMIENTO" "200" "$T_MS"
  else
    wf_step "8" "OPERADOR" "Registrar tratamiento" "EN_TRATAMIENTO" "ERR" "$T_MS"
  fi

  # Step 9: OPERADOR cierra manifiesto -> TRATADO
  T_START=$(date +%s%N)
  RESP=$(api_call "POST" "/manifiestos/$TEST_MANIFIESTO_ID/cerrar" "$OPER_TOKEN" \
    '{"observaciones":"[TEST] Cierre automatizado - disposicion final completa"}')
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  STATUS_CODE=$(echo "$RESP" | json_extract "success")
  if [ "$STATUS_CODE" = "True" ] || [ "$STATUS_CODE" = "true" ]; then
    wf_step "9" "OPERADOR" "Cerrar manifiesto" "TRATADO" "200" "$T_MS"
  else
    wf_step "9" "OPERADOR" "Cerrar manifiesto" "TRATADO" "ERR" "$T_MS"
  fi

  # Step 10: Verify blockchain integrity
  T_START=$(date +%s%N)
  BC_RESP=$(api_call "GET" "/blockchain/verificar-integridad/$TEST_MANIFIESTO_ID" "$ADMIN_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  BC_INTEGRIDAD=$(echo "$BC_RESP" | json_extract "data.integridad")
  if [ -n "$BC_INTEGRIDAD" ]; then
    wf_step "10" "ADMIN" "Verificar blockchain ($BC_INTEGRIDAD)" "TRATADO" "200" "$T_MS"
  else
    wf_step "10" "ADMIN" "Verificar blockchain" "TRATADO" "ERR" "$T_MS"
  fi

  # Step 11: Download PDF
  T_START=$(date +%s%N)
  PDF_CODE=$($CURL -s -o /dev/null -w '%{http_code}' "$API/pdf/manifiesto/$TEST_MANIFIESTO_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  wf_step "11" "ADMIN" "Descargar PDF" "TRATADO" "$PDF_CODE" "$T_MS"

  # Step 12: Download certificate
  T_START=$(date +%s%N)
  CERT_CODE=$($CURL -s -o /dev/null -w '%{http_code}' "$API/pdf/certificado/$TEST_MANIFIESTO_ID" \
    -H "Authorization: Bearer $ADMIN_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  wf_step "12" "ADMIN" "Descargar certificado" "TRATADO" "$CERT_CODE" "$T_MS"

  # Step 13: Public QR verification
  if [ -n "$TEST_MANIFIESTO_NUM" ]; then
    T_START=$(date +%s%N)
    QR_CODE=$($CURL -s -o /dev/null -w '%{http_code}' "$API/manifiestos/verificar/$TEST_MANIFIESTO_NUM")
    T_END=$(date +%s%N)
    T_MS=$(( (T_END - T_START) / 1000000 ))
    wf_step "13" "PUBLICO" "Verificacion QR ($TEST_MANIFIESTO_NUM)" "TRATADO" "$QR_CODE" "$T_MS"
  fi

  # Step 14: Verify timeline has events
  T_START=$(date +%s%N)
  DETAIL_RESP=$(api_call "GET" "/manifiestos/$TEST_MANIFIESTO_ID" "$ADMIN_TOKEN")
  T_END=$(date +%s%N)
  T_MS=$(( (T_END - T_START) / 1000000 ))
  EVENT_COUNT=$(echo "$DETAIL_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    m = d.get('data', {})
    if 'manifiesto' in m: m = m['manifiesto']
    events = m.get('eventos', [])
    print(len(events))
except: print(0)
" 2>/dev/null)
  if [ "$EVENT_COUNT" -gt 5 ]; then
    wf_step "14" "ADMIN" "Timeline ($EVENT_COUNT eventos)" "TRATADO" "200" "$T_MS"
  else
    wf_step "14" "ADMIN" "Timeline ($EVENT_COUNT eventos, esperado >5)" "TRATADO" "WARN" "$T_MS"
  fi

  # Cleanup: Delete or cancel the test manifesto
  # Since it's TRATADO, we can't delete it — leave it tagged with [TEST-PROFUNDO]
  echo -e "  ${YELLOW}NOTE${NC}: Test manifesto $TEST_MANIFIESTO_NUM left in DB (TRATADO, tagged [TEST-PROFUNDO])"
fi

echo ""

# ============================================================
# 5. GENERATE MARKDOWN REPORT
# ============================================================

GLOBAL_END=$(date +%s)
GLOBAL_DURATION=$((GLOBAL_END - GLOBAL_START))
GLOBAL_MINUTES=$((GLOBAL_DURATION / 60))
GLOBAL_SECONDS=$((GLOBAL_DURATION % 60))

TOTAL_ALL_TESTS=$((TOTAL_TESTS_PASS + TOTAL_TESTS_FAIL + WORKFLOW_PASS + WORKFLOW_FAIL))
TOTAL_ALL_PASS=$((TOTAL_TESTS_PASS + WORKFLOW_PASS))
TOTAL_ALL_FAIL=$((TOTAL_TESTS_FAIL + WORKFLOW_FAIL))

if [ "$TOTAL_ALL_FAIL" -eq 0 ]; then
  OVERALL_STATUS="APROBADO"
  OVERALL_ICON="PASS"
elif [ "$TOTAL_ALL_FAIL" -le 3 ]; then
  OVERALL_STATUS="APROBADO CON OBSERVACIONES"
  OVERALL_ICON="WARN"
else
  OVERALL_STATUS="REQUIERE ATENCION"
  OVERALL_ICON="FAIL"
fi

echo -e "${BOLD}${CYAN}--- Generating Report ---${NC}"

rpt "# Reporte de Test de Produccion — SITREP"
rpt ""
rpt "**Fecha**: $(date '+%Y-%m-%d %H:%M:%S')"
rpt "**Target**: $BASE_URL"
rpt "**API Health**: OK (db: $HEALTH_DB, uptime: ${HEALTH_UPTIME}s)"
rpt ""
rpt "## Resumen Ejecutivo"
rpt ""
rpt "| Metrica | Valor |"
rpt "|---------|-------|"
rpt "| Suites ejecutadas | $((SUITES_PASSED + SUITES_FAILED))/${#SUITES[@]} |"
rpt "| Tests totales (suites) | $((TOTAL_TESTS_PASS + TOTAL_TESTS_FAIL)) |"
rpt "| Tests pasados (suites) | $TOTAL_TESTS_PASS |"
rpt "| Tests fallidos (suites) | $TOTAL_TESTS_FAIL |"
rpt "| Workflow steps | $((WORKFLOW_PASS + WORKFLOW_FAIL)) ($WORKFLOW_PASS pass, $WORKFLOW_FAIL fail) |"
rpt "| Duracion total | ${GLOBAL_MINUTES}m ${GLOBAL_SECONDS}s |"
rpt "| **Estado** | **$OVERALL_STATUS** |"
rpt ""

rpt "## Resultados por Suite"
rpt ""
rpt "| Suite | Tests | Pass | Fail | Duracion | Estado |"
rpt "|-------|-------|------|------|----------|--------|"
rpt "$SUITE_TABLE"

rpt "## Benchmark de Performance"
rpt ""
rpt "Cada endpoint medido con $BENCH_ITERATIONS requests secuenciales."
rpt ""
rpt "| Endpoint | Avg (ms) | P95 (ms) | Max (ms) | Estado |"
rpt "|----------|----------|----------|----------|--------|"
rpt "$BENCH_TABLE"

rpt "## Stress Test (Carga Concurrente)"
rpt ""
rpt "| Escenario | Req | Exito | Errores | P95 | Notas |"
rpt "|-----------|-----|-------|---------|-----|-------|"
rpt "$STRESS_TABLE"

if [ -n "$TEST_MANIFIESTO_ID" ]; then
  rpt "## Flujo Multi-Usuario Completo"
  rpt ""
  rpt "Manifiesto de prueba: **$TEST_MANIFIESTO_NUM** (ID: $TEST_MANIFIESTO_ID)"
  rpt ""
  rpt "| Paso | Rol | Accion | Estado Resultante | Tiempo (ms) | HTTP |"
  rpt "|------|-----|--------|-------------------|-------------|------|"
  rpt "$WORKFLOW_TABLE"
fi

if [ -n "$FAILURES_DETAIL" ] || [ -n "$WORKFLOW_ERRORS" ]; then
  rpt "## Fallos Detectados"
  rpt ""
  if [ -n "$FAILURES_DETAIL" ]; then
    rpt "### Suites con fallos"
    rpt "$FAILURES_DETAIL"
  fi
  if [ -n "$WORKFLOW_ERRORS" ]; then
    rpt "### Workflow"
    rpt "$WORKFLOW_ERRORS"
  fi
fi

rpt ""
rpt "## Conclusion"
rpt ""
if [ "$OVERALL_ICON" = "PASS" ]; then
  rpt "**Sistema APTO para produccion** con 100% de tests pasados."
elif [ "$OVERALL_ICON" = "WARN" ]; then
  rpt "**Sistema APTO para produccion** con ${TOTAL_ALL_PASS}/${TOTAL_ALL_TESTS} tests pasados ($(( TOTAL_ALL_PASS * 100 / TOTAL_ALL_TESTS ))%)."
  rpt "Items a monitorear listados en la seccion de Fallos Detectados."
else
  rpt "**Sistema REQUIERE ATENCION** con ${TOTAL_ALL_FAIL} tests fallidos."
  rpt "Revisar seccion de Fallos Detectados antes de declarar produccion estable."
fi
rpt ""
rpt "---"
rpt "*Generado automaticamente por test-produccion-profundo.sh*"

# Write report
echo "$REPORT" > "$REPORT_FILE"
cp "$REPORT_FILE" "$REPORT_LATEST"

echo -e "${GREEN}Report written to: $REPORT_FILE${NC}"
echo -e "${GREEN}Latest symlink:    $REPORT_LATEST${NC}"
echo ""

# ── TERMINAL SUMMARY ────────────────────────────────────────

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     RESULTADO FINAL                                  ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Suites:   ${GREEN}$SUITES_PASSED passed${NC}  /  ${RED}$SUITES_FAILED failed${NC}"
echo -e "  Tests:    ${GREEN}$TOTAL_TESTS_PASS pass${NC}  /  ${RED}$TOTAL_TESTS_FAIL fail${NC}"
echo -e "  Workflow: ${GREEN}$WORKFLOW_PASS pass${NC}  /  ${RED}$WORKFLOW_FAIL fail${NC}"
echo -e "  Duration: ${GLOBAL_MINUTES}m ${GLOBAL_SECONDS}s"
echo ""

if [ "$OVERALL_ICON" = "PASS" ]; then
  echo -e "  ${GREEN}${BOLD}ESTADO: $OVERALL_STATUS${NC}"
elif [ "$OVERALL_ICON" = "WARN" ]; then
  echo -e "  ${YELLOW}${BOLD}ESTADO: $OVERALL_STATUS${NC}"
else
  echo -e "  ${RED}${BOLD}ESTADO: $OVERALL_STATUS${NC}"
fi
echo ""

exit "$TOTAL_ALL_FAIL"
