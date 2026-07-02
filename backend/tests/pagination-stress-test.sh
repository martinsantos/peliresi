#!/usr/bin/env bash
# ============================================================
# SITREP — Pagination Stress Test
# Validates that pagination endpoints handle deep pages and
# large limits under concurrent load without memory issues.
# ============================================================

set -uo pipefail

BASE="${1:-https://rptrazar.mendoza.gov.ar}"
API="$BASE/api"
CONCURRENT="${SITREP_PAGINATION_CONCURRENT:-50}"
REQUEST_DIVISOR="${SITREP_PAGINATION_REQUEST_DIVISOR:-1}"
ALLOW_429="${SITREP_PAGINATION_ALLOW_429:-false}"

positive_int_or_default() {
  local value="$1" fallback="$2"
  value="$(echo "$value" | tr -cd '0-9' | head -c 8)"
  if [ -n "$value" ] && [ "$value" -gt 0 ] 2>/dev/null; then
    echo "$value"
  else
    echo "$fallback"
  fi
}

is_true() {
  case "${1:-}" in
    true|TRUE|1|yes|YES|si|SI) return 0 ;;
    *) return 1 ;;
  esac
}

scale_total() {
  local total="$1"
  if [ "$REQUEST_DIVISOR" -le 1 ]; then
    echo "$total"
  else
    echo $(( (total + REQUEST_DIVISOR - 1) / REQUEST_DIVISOR ))
  fi
}

CONCURRENT="$(positive_int_or_default "$CONCURRENT" 50)"
REQUEST_DIVISOR="$(positive_int_or_default "$REQUEST_DIVISOR" 1)"

echo "=================================================="
echo "  SITREP Pagination Stress Test"
echo "  Base: $BASE"
echo "  Concurrent: $CONCURRENT"
echo "  Request divisor: $REQUEST_DIVISOR"
echo "=================================================="
echo ""

TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FAIL: could not obtain admin token"
  exit 1
fi

# Test scenarios: (endpoint, total_requests, label)
run_scenario() {
  local endpoint="$1"
  local total
  total="$(scale_total "$2")"
  local label="$3"
  local temp_file
  temp_file=$(mktemp)

  echo "--- $label ---"
  echo "    GET /$endpoint"
  echo "    Total requests: $total, Concurrent: $CONCURRENT"

  local start=$(date +%s)
  for i in $(seq 1 "$total"); do
    (
      start_t=$(date +%s%N)
      code=$(curl -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $TOKEN" \
        --max-time 15 \
        "$API/$endpoint" 2>/dev/null)
      end_t=$(date +%s%N)
      elapsed_ms=$(( (end_t - start_t) / 1000000 ))
      echo "$code $elapsed_ms" >> "$temp_file"
    ) &
    if (( i % CONCURRENT == 0 )); then wait; fi
  done
  wait
  local end=$(date +%s)
  local duration=$((end - start))

  local count_200 count_429 count_500 count_other avg max p50 p95 p99
  count_200=$(grep -c '^200 ' "$temp_file" 2>/dev/null | head -1)
  count_429=$(grep -c '^429 ' "$temp_file" 2>/dev/null | head -1)
  count_500=$(grep -c '^500 ' "$temp_file" 2>/dev/null | head -1)
  [ -z "$count_200" ] && count_200=0
  [ -z "$count_429" ] && count_429=0
  [ -z "$count_500" ] && count_500=0
  local total_lines
  total_lines=$(wc -l < "$temp_file" | tr -d ' ')
  count_other=$((total_lines - count_200 - count_429 - count_500))

  # Latency stats (ms)
  if [ "$count_200" -gt 0 ]; then
    sorted=$(awk '$1==200 {print $2}' "$temp_file" | sort -n)
    count=$(echo "$sorted" | wc -l | tr -d ' ')
    p50_idx=$(( count / 2 ))
    p95_idx=$(( count * 95 / 100 ))
    p99_idx=$(( count * 99 / 100 ))
    [ "$p50_idx" -lt 1 ] && p50_idx=1
    [ "$p95_idx" -lt 1 ] && p95_idx=1
    [ "$p99_idx" -lt 1 ] && p99_idx=1
    p50=$(echo "$sorted" | sed -n "${p50_idx}p")
    p95=$(echo "$sorted" | sed -n "${p95_idx}p")
    p99=$(echo "$sorted" | sed -n "${p99_idx}p")
    max=$(echo "$sorted" | tail -1)
    avg=$(awk '$1==200 {sum+=$2; n++} END {if(n>0) print int(sum/n); else print 0}' "$temp_file")
  else
    p50=0; p95=0; p99=0; max=0; avg=0
  fi

  echo "    Duration: ${duration}s, 200: $count_200, 429: $count_429, 500: $count_500, other: $count_other"
  echo "    Latency (ms): avg=$avg p50=$p50 p95=$p95 p99=$p99 max=$max"

  rm -f "$temp_file"

  if [ "$count_500" -gt 0 ]; then
    echo "    FAIL — $count_500 internal errors"
    return 1
  elif [ "$count_429" -gt 0 ] && ! is_true "$ALLOW_429"; then
    echo "    FAIL — $count_429 rate-limited responses"
    return 1
  elif [ "$count_200" -eq 0 ] && [ "$total_lines" -gt 0 ]; then
    echo "    FAIL — no successful responses"
    return 1
  fi
  return 0
}

FAIL=0

run_scenario "reportes/auditoria?page=1&limit=200" 200 "Auditoria page 1, limit 200" || FAIL=$((FAIL + 1))
run_scenario "reportes/auditoria?page=5&limit=100" 200 "Auditoria deep page (p5)" || FAIL=$((FAIL + 1))
run_scenario "reportes/auditoria?limit=500" 100 "Auditoria max limit (500)" || FAIL=$((FAIL + 1))
run_scenario "manifiestos?page=1&limit=100" 200 "Manifiestos pagination standard" || FAIL=$((FAIL + 1))
run_scenario "manifiestos?page=3&limit=50" 200 "Manifiestos deep page" || FAIL=$((FAIL + 1))
run_scenario "actores/generadores?page=1&limit=100" 150 "Generadores list" || FAIL=$((FAIL + 1))

echo ""
echo "=================================================="
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL PAGINATION TESTS PASSED"
  exit 0
else
  echo "  FAIL: $FAIL scenarios failed"
  exit 1
fi
