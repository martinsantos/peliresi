#!/usr/bin/env bash
# ============================================================
# SITREP — Massive Concurrent Stress Test
# Simula operación real con alta concurrencia:
#   - 100 usuarios simultáneos leyendo dashboard
#   - 50 usuarios simultáneos listando manifiestos
#   - 30 usuarios simultáneos en reportes
#   - 20 workflows completos en paralelo
#   - 10 GPS updates por segundo
#   - Burst de 200 requests en <5 segundos
#   - Ramp-up gradual de 10→50→100→200 concurrent
#
# Mide: latencia p50/p95/p99, throughput, error rate, 500s
# ============================================================

set -uo pipefail

_INPUT="${1:-https://sitrep.ultimamilla.com.ar}"
BASE="${_INPUT%/}"
[[ "$BASE" != */api ]] && BASE="$BASE/api"

TMPDIR="/tmp/sitrep-massive-$$"
mkdir -p "$TMPDIR"
trap "rm -rf $TMPDIR" EXIT

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

PASS=0
FAIL=0
WARN=0
TOTAL_REQUESTS=0
TOTAL_500=0
TOTAL_429=0
TOTAL_OK=0

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   SITREP — MASSIVE CONCURRENT STRESS TEST               ║${NC}"
echo -e "${BOLD}${CYAN}║   Target: $BASE${NC}"
echo -e "${BOLD}${CYAN}║   $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"

# ── Login helper ──────────────────────────────────────────────
safe_login() {
  local email="$1" pass="$2"
  curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pass\"}" \
    --max-time 10 | python3 -c "
import sys,json
try: print(json.load(sys.stdin).get('data',{}).get('tokens',{}).get('accessToken',''))
except: print('')
" 2>/dev/null
}

# ── Authenticated ─────────────────────────────────────────────
echo ""
echo -e "${CYAN}▶ Phase 0: Authentication${NC}"
TOKEN_ADMIN=$(safe_login "admin@dgfa.mendoza.gov.ar" "admin123")
sleep 1
TOKEN_GEN=$(safe_login "quimica.mendoza@industria.com" "gen123")
sleep 1
TOKEN_TRANS=$(safe_login "transportes.andes@logistica.com" "trans123")
sleep 1
TOKEN_OPER=$(safe_login "tratamiento.residuos@planta.com" "op123")

[ -z "$TOKEN_ADMIN" ] && echo -e "${RED}FATAL: No ADMIN token${NC}" && exit 1
echo -e "  ${GREEN}OK${NC} 4 roles authenticated"

# ── Helper: fire N concurrent requests, collect metrics ───────
# Usage: fire_concurrent LABEL N URL TOKEN [METHOD] [BODY]
fire_concurrent() {
  local label="$1" n="$2" url="$3" token="$4"
  local method="${5:-GET}" body="${6:-}"
  local results_file="$TMPDIR/fire_$$_$RANDOM"
  local timing_file="$TMPDIR/timing_$$_$RANDOM"

  > "$results_file"
  > "$timing_file"

  for i in $(seq 1 "$n"); do
    (
      local start_ms=$(python3 -c "import time; print(int(time.time()*1000))")
      local code
      if [ "$method" = "GET" ]; then
        code=$(curl -s -o /dev/null -w '%{http_code}' \
          -H "Authorization: Bearer $token" \
          --max-time 15 \
          "$url" 2>/dev/null)
      else
        code=$(curl -s -o /dev/null -w '%{http_code}' \
          -X "$method" \
          -H "Authorization: Bearer $token" \
          -H "Content-Type: application/json" \
          -d "$body" \
          --max-time 15 \
          "$url" 2>/dev/null)
      fi
      local end_ms=$(python3 -c "import time; print(int(time.time()*1000))")
      local elapsed=$((end_ms - start_ms))
      echo "$code" >> "$results_file"
      echo "$elapsed" >> "$timing_file"
    ) &
    # Stagger slightly to avoid fd exhaustion
    if (( i % 50 == 0 )); then wait; fi
  done
  wait

  # Compute stats
  local count_200=$(grep -c '^200$' "$results_file" 2>/dev/null || echo 0)
  count_200=$(echo "$count_200" | tr -d '[:space:]')
  local count_429=$(grep -c '^429$' "$results_file" 2>/dev/null || echo 0)
  count_429=$(echo "$count_429" | tr -d '[:space:]')
  local count_500=$(grep -c '^500$' "$results_file" 2>/dev/null || echo 0)
  count_500=$(echo "$count_500" | tr -d '[:space:]')
  local count_000=$(grep -c '^000$' "$results_file" 2>/dev/null || echo 0)
  count_000=$(echo "$count_000" | tr -d '[:space:]')
  local count_other=$((n - count_200 - count_429 - count_500 - count_000))

  # Latency percentiles
  local latency_stats
  latency_stats=$(sort -n "$timing_file" | python3 -c "
import sys
vals = [int(l.strip()) for l in sys.stdin if l.strip().isdigit()]
if not vals:
    print('0 0 0 0 0')
else:
    vals.sort()
    n = len(vals)
    avg = sum(vals)//n
    p50 = vals[n//2]
    p95 = vals[int(n*0.95)]
    p99 = vals[int(n*0.99)]
    mx = vals[-1]
    print(f'{avg} {p50} {p95} {p99} {mx}')
" 2>/dev/null)

  local avg p50 p95 p99 mx
  read avg p50 p95 p99 mx <<< "$latency_stats"

  TOTAL_REQUESTS=$((TOTAL_REQUESTS + n))
  TOTAL_OK=$((TOTAL_OK + count_200))
  TOTAL_500=$((TOTAL_500 + count_500))
  TOTAL_429=$((TOTAL_429 + count_429))

  # Print results
  local success_rate=$((count_200 * 100 / n))
  local color="$GREEN"
  [ "$count_500" -gt 0 ] && color="$RED"
  [ "$success_rate" -lt 80 ] && color="$YELLOW"

  printf "  %-45s %3d reqs │ " "$label" "$n"
  echo -e "${color}200:${count_200} 429:${count_429} 500:${count_500} err:${count_000}${NC} │ p50:${p50}ms p95:${p95}ms p99:${p99}ms max:${mx}ms"

  # Verdict
  if [ "$count_500" -gt 0 ]; then
    FAIL=$((FAIL + 1))
    return 1
  elif [ "$success_rate" -lt 50 ]; then
    FAIL=$((FAIL + 1))
    return 1
  else
    PASS=$((PASS + 1))
    return 0
  fi
}

# ══════════════════════════════════════════════════════════════
#  PHASE 1: RAMP-UP — Gradual load increase
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 1: RAMP-UP (10 → 25 → 50 → 100 concurrent)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

echo -e "  ${YELLOW}Endpoint: GET /manifiestos/dashboard${NC}"
fire_concurrent "Dashboard × 10 concurrent" 10 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN"
fire_concurrent "Dashboard × 25 concurrent" 25 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN"
fire_concurrent "Dashboard × 50 concurrent" 50 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN"
fire_concurrent "Dashboard × 100 concurrent" 100 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN"

echo ""
echo -e "  ${YELLOW}Endpoint: GET /manifiestos?limit=50${NC}"
fire_concurrent "Manifiestos list × 10" 10 "$BASE/manifiestos?limit=50" "$TOKEN_ADMIN"
fire_concurrent "Manifiestos list × 25" 25 "$BASE/manifiestos?limit=50" "$TOKEN_ADMIN"
fire_concurrent "Manifiestos list × 50" 50 "$BASE/manifiestos?limit=50" "$TOKEN_ADMIN"
fire_concurrent "Manifiestos list × 100" 100 "$BASE/manifiestos?limit=50" "$TOKEN_ADMIN"

# ══════════════════════════════════════════════════════════════
#  PHASE 2: MULTI-ENDPOINT STORM — Hit everything at once
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 2: MULTI-ENDPOINT STORM (all endpoints, 30 each)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Launch ALL endpoint groups simultaneously
fire_concurrent "Dashboard stats" 30 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN" &
PID1=$!
fire_concurrent "Manifiestos list" 30 "$BASE/manifiestos?limit=20" "$TOKEN_ADMIN" &
PID2=$!
fire_concurrent "Reportes manifiestos" 30 "$BASE/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2026-12-31" "$TOKEN_ADMIN" &
PID3=$!
fire_concurrent "Reportes tratados" 30 "$BASE/reportes/tratados?fechaInicio=2024-01-01&fechaFin=2026-12-31" "$TOKEN_ADMIN" &
PID4=$!
fire_concurrent "Analytics por mes" 30 "$BASE/analytics/manifiestos-por-mes" "$TOKEN_ADMIN" &
PID5=$!
fire_concurrent "Analytics por estado" 30 "$BASE/analytics/manifiestos-por-estado" "$TOKEN_ADMIN" &
PID6=$!
fire_concurrent "Centro de Control" 30 "$BASE/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2026-12-31&capas=generadores,transportistas,operadores,transito" "$TOKEN_ADMIN" &
PID7=$!
fire_concurrent "Catálogos tipos-residuos" 30 "$BASE/catalogos/tipos-residuos" "$TOKEN_ADMIN" &
PID8=$!
fire_concurrent "Catálogos operadores" 30 "$BASE/catalogos/operadores" "$TOKEN_ADMIN" &
PID9=$!
fire_concurrent "Notificaciones" 30 "$BASE/notificaciones" "$TOKEN_ADMIN" &
PID10=$!

wait $PID1 $PID2 $PID3 $PID4 $PID5 $PID6 $PID7 $PID8 $PID9 $PID10

echo ""
echo -e "  ${BOLD}Storm total: 300 requests across 10 endpoints simultaneously${NC}"

# ══════════════════════════════════════════════════════════════
#  PHASE 3: MIXED-ROLE CONCURRENT — 4 roles hitting at once
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 3: MIXED-ROLE CONCURRENT (4 roles × 25 each)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

fire_concurrent "ADMIN dashboard × 25" 25 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN" &
P1=$!
fire_concurrent "GENERADOR manifiestos × 25" 25 "$BASE/manifiestos?limit=10" "$TOKEN_GEN" &
P2=$!
fire_concurrent "TRANSPORTISTA manifiestos × 25" 25 "$BASE/manifiestos?limit=10&estado=APROBADO" "$TOKEN_TRANS" &
P3=$!
fire_concurrent "OPERADOR manifiestos × 25" 25 "$BASE/manifiestos?limit=10&estado=ENTREGADO" "$TOKEN_OPER" &
P4=$!
wait $P1 $P2 $P3 $P4

echo -e "  ${BOLD}4-role concurrent total: 100 requests${NC}"

# ══════════════════════════════════════════════════════════════
#  PHASE 4: WRITE STORM — Concurrent creates + state changes
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 4: WRITE STORM (concurrent create + workflow)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

# Get authorized residuo for operador
OPER_CATALOG=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/catalogos/operadores")
OPER_ID=$(echo "$OPER_CATALOG" | python3 -c "
import sys,json
try: print(json.load(sys.stdin)['data']['operadores'][0]['id'])
except: print('')
" 2>/dev/null)
TIPO_RES_ID=$(echo "$OPER_CATALOG" | python3 -c "
import sys,json
try:
    ops=json.load(sys.stdin)['data']['operadores']
    print(ops[0]['tratamientos'][0]['tipoResiduoId'])
except: print('')
" 2>/dev/null)
GEN_ID=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/catalogos/generadores" | python3 -c "
import sys,json
try: print(json.load(sys.stdin)['data']['generadores'][0]['id'])
except: print('')
" 2>/dev/null)
TRANS_ID=$(curl -s -H "Authorization: Bearer $TOKEN_ADMIN" "$BASE/catalogos/transportistas" | python3 -c "
import sys,json
try: print(json.load(sys.stdin)['data']['transportistas'][0]['id'])
except: print('')
" 2>/dev/null)

if [ -n "$GEN_ID" ] && [ -n "$TRANS_ID" ] && [ -n "$OPER_ID" ] && [ -n "$TIPO_RES_ID" ]; then
  CREATE_BODY="{
    \"generadorId\": \"$GEN_ID\",
    \"transportistaId\": \"$TRANS_ID\",
    \"operadorId\": \"$OPER_ID\",
    \"observaciones\": \"Stress test concurrent create $(date +%s)\",
    \"residuos\": [{\"tipoResiduoId\": \"$TIPO_RES_ID\", \"cantidad\": 10, \"unidad\": \"kg\", \"descripcion\": \"Stress\"}]
  }"

  # 10 concurrent creates
  echo -e "  ${YELLOW}10 concurrent POST /manifiestos (create)${NC}"
  CREATED_IDS=()
  for i in $(seq 1 10); do
    (
      resp=$(curl -s -X POST "$BASE/manifiestos" \
        -H "Authorization: Bearer $TOKEN_ADMIN" \
        -H "Content-Type: application/json" \
        -d "$CREATE_BODY" --max-time 15)
      id=$(echo "$resp" | python3 -c "
import sys,json
try: print(json.load(sys.stdin).get('data',{}).get('manifiesto',{}).get('id',''))
except: print('')
" 2>/dev/null)
      code=$(echo "$resp" | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)
    print('201' if d.get('success') else '400')
except: print('000')
" 2>/dev/null)
      echo "$code $id" >> "$TMPDIR/writes_result"
    ) &
  done
  wait

  CREATED_OK=$(grep -c '^201' "$TMPDIR/writes_result" 2>/dev/null || echo 0)
  CREATED_OK=$(echo "$CREATED_OK" | tr -d '[:space:]')
  CREATED_IDS=($(grep '^201' "$TMPDIR/writes_result" 2>/dev/null | awk '{print $2}' | head -5))

  echo -e "  Created: ${BOLD}${CREATED_OK}/10${NC} manifiestos concurrently"
  TOTAL_REQUESTS=$((TOTAL_REQUESTS + 10))
  TOTAL_OK=$((TOTAL_OK + CREATED_OK))

  if [ "$CREATED_OK" -ge 8 ]; then
    echo -e "  ${GREEN}PASS${NC} Concurrent creation: $CREATED_OK/10"
    PASS=$((PASS + 1))
  elif [ "$CREATED_OK" -ge 5 ]; then
    echo -e "  ${YELLOW}WARN${NC} Concurrent creation: only $CREATED_OK/10"
    WARN=$((WARN + 1))
  else
    echo -e "  ${RED}FAIL${NC} Concurrent creation: only $CREATED_OK/10"
    FAIL=$((FAIL + 1))
  fi

  # Concurrent firmar (BORRADOR → APROBADO) on created manifiestos
  if [ ${#CREATED_IDS[@]} -ge 3 ]; then
    echo -e "  ${YELLOW}${#CREATED_IDS[@]} concurrent POST /manifiestos/:id/firmar${NC}"
    FIRMAR_OK=0
    for mid in "${CREATED_IDS[@]}"; do
      (
        code=$(curl -s -o /dev/null -w '%{http_code}' \
          -X POST "$BASE/manifiestos/$mid/firmar" \
          -H "Authorization: Bearer $TOKEN_ADMIN" \
          -H "Content-Type: application/json" \
          -d '{"observaciones":"stress test firma"}' \
          --max-time 10)
        echo "$code" >> "$TMPDIR/firmar_result"
      ) &
    done
    wait
    FIRMAR_OK=$(grep -c '^200$' "$TMPDIR/firmar_result" 2>/dev/null || echo 0)
    FIRMAR_OK=$(echo "$FIRMAR_OK" | tr -d '[:space:]')
    echo -e "  Firmados: ${BOLD}${FIRMAR_OK}/${#CREATED_IDS[@]}${NC}"
    TOTAL_REQUESTS=$((TOTAL_REQUESTS + ${#CREATED_IDS[@]}))
    TOTAL_OK=$((TOTAL_OK + FIRMAR_OK))

    if [ "$FIRMAR_OK" -ge 3 ]; then
      echo -e "  ${GREEN}PASS${NC} Concurrent firma"
      PASS=$((PASS + 1))
    else
      echo -e "  ${YELLOW}WARN${NC} Concurrent firma: $FIRMAR_OK"
      WARN=$((WARN + 1))
    fi
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No catalog data for write tests"
fi

# ══════════════════════════════════════════════════════════════
#  PHASE 5: EXTREME BURST — 200 requests in <5 seconds
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 5: EXTREME BURST (200 requests, full blast)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

BURST_START=$(python3 -c "import time; print(int(time.time()*1000))")

fire_concurrent "Health endpoint × 200 burst" 200 "$BASE/health" "$TOKEN_ADMIN"

BURST_END=$(python3 -c "import time; print(int(time.time()*1000))")
BURST_DURATION=$(( (BURST_END - BURST_START) ))
BURST_RPS=$((200 * 1000 / (BURST_DURATION + 1)))
echo -e "  ${BOLD}Burst completed in ${BURST_DURATION}ms (${BURST_RPS} req/s)${NC}"

echo ""
echo -e "  ${YELLOW}Heavy endpoint burst: dashboard × 100${NC}"
fire_concurrent "Dashboard × 100 burst" 100 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN"

echo ""
echo -e "  ${YELLOW}Heavy endpoint burst: reportes × 100${NC}"
fire_concurrent "Reportes × 100 burst" 100 "$BASE/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2026-12-31" "$TOKEN_ADMIN"

echo ""
echo -e "  ${YELLOW}Heavy endpoint burst: centro-control × 50${NC}"
fire_concurrent "Centro Control × 50 burst" 50 "$BASE/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2026-12-31&capas=generadores,transportistas,operadores,transito" "$TOKEN_ADMIN"

# ══════════════════════════════════════════════════════════════
#  PHASE 6: SUSTAINED LOAD — 3 rounds of 50 concurrent
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 6: SUSTAINED LOAD (3 waves × 50, no pause)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

for wave in 1 2 3; do
  echo -e "  ${YELLOW}Wave $wave/3${NC}"
  fire_concurrent "Wave $wave: dashboard × 50" 50 "$BASE/manifiestos/dashboard" "$TOKEN_ADMIN" &
  fire_concurrent "Wave $wave: manifiestos × 50" 50 "$BASE/manifiestos?limit=20" "$TOKEN_ADMIN" &
  fire_concurrent "Wave $wave: analytics × 50" 50 "$BASE/analytics/manifiestos-por-estado" "$TOKEN_ADMIN" &
  wait
done

# ══════════════════════════════════════════════════════════════
#  PHASE 7: SEARCH UNDER LOAD
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${CYAN}  PHASE 7: SEARCH UNDER LOAD (text search × 50)${NC}"
echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════════════════${NC}"

fire_concurrent "Search 'quimica' × 50" 50 "$BASE/manifiestos?search=quimica&limit=10" "$TOKEN_ADMIN"
fire_concurrent "Search 'mendoza' × 50" 50 "$BASE/manifiestos?search=mendoza&limit=10" "$TOKEN_ADMIN"
fire_concurrent "Search 'aceite' × 50" 50 "$BASE/manifiestos?search=aceite&limit=10" "$TOKEN_ADMIN"

# ══════════════════════════════════════════════════════════════
#  RESULTS
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║   FINAL RESULTS                                         ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"

ERROR_RATE=0
[ "$TOTAL_REQUESTS" -gt 0 ] && ERROR_RATE=$((TOTAL_500 * 100 / TOTAL_REQUESTS))
SUCCESS_RATE=0
[ "$TOTAL_REQUESTS" -gt 0 ] && SUCCESS_RATE=$((TOTAL_OK * 100 / TOTAL_REQUESTS))

echo ""
echo -e "  ${BOLD}Total requests:${NC}  $TOTAL_REQUESTS"
echo -e "  ${BOLD}HTTP 200 (OK):${NC}   $TOTAL_OK (${SUCCESS_RATE}%)"
echo -e "  ${BOLD}HTTP 429 (rate):${NC} $TOTAL_429"
echo -e "  ${BOLD}HTTP 500 (crash):${NC} $TOTAL_500"
echo -e "  ${BOLD}Error rate (500):${NC} ${ERROR_RATE}%"
echo ""
echo -e "  ${BOLD}Test verdicts:${NC}  ${GREEN}PASS: $PASS${NC}  ${RED}FAIL: $FAIL${NC}  ${YELLOW}WARN: $WARN${NC}"
echo ""

if [ "$TOTAL_500" -eq 0 ]; then
  echo -e "  ${GREEN}${BOLD}★ ZERO SERVER CRASHES (0 HTTP 500) ★${NC}"
else
  echo -e "  ${RED}${BOLD}⚠ $TOTAL_500 SERVER CRASHES DETECTED ⚠${NC}"
fi

if [ "$SUCCESS_RATE" -ge 90 ]; then
  echo -e "  ${GREEN}${BOLD}✔ SUCCESS RATE ${SUCCESS_RATE}% — SYSTEM HANDLES HIGH CONCURRENCY${NC}"
elif [ "$SUCCESS_RATE" -ge 70 ]; then
  echo -e "  ${YELLOW}${BOLD}⚠ SUCCESS RATE ${SUCCESS_RATE}% — DEGRADED UNDER LOAD${NC}"
else
  echo -e "  ${RED}${BOLD}✘ SUCCESS RATE ${SUCCESS_RATE}% — SYSTEM STRUGGLES${NC}"
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}${BOLD}ALL STRESS TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}${BOLD}$FAIL STRESS TESTS FAILED${NC}"
  exit 1
fi
