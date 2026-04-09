#!/usr/bin/env bash
# ============================================================
# SITREP — Date Validation Stress Test
# Validates that endpoints with date filters return 400 (not 500)
# when given malformed dates, under concurrent load.
# ============================================================

set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE/api"
CONCURRENT=20
TOTAL_PER_ENDPOINT=60
# Note: production rate limiter is 600 req/min/IP; we keep well under that

echo "=================================================="
echo "  SITREP Date Validation Stress Test"
echo "  Base: $BASE"
echo "  Concurrent: $CONCURRENT, Total per endpoint: $TOTAL_PER_ENDPOINT"
echo "=================================================="
echo ""

# Get admin token
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FAIL: could not obtain admin token"
  exit 1
fi

# Endpoints with date params that should validate dates
ENDPOINTS=(
  "reportes/manifiestos?fechaInicio=NOTADATE&fechaFin=ALSOBAD"
  "reportes/tratados?fechaInicio=2026-13-45&fechaFin=2026-12-00"
  "reportes/transporte?fechaInicio=BAD"
  "reportes/auditoria?fechaInicio=junk"
  "centro-control/actividad?fechaDesde=BAD&fechaHasta=WORSE"
  "manifiestos?fechaDesde=2099-99-99"
  "admin/email-queue?fechaDesde=INVALID"
)

PASS=0
FAIL=0
TOTAL_500=0
TOTAL_400=0
TOTAL_OTHER=0
TEMP_DIR=$(mktemp -d)

for ep in "${ENDPOINTS[@]}"; do
  echo "Testing: GET /$ep"
  status_file="$TEMP_DIR/$(echo "$ep" | tr '/?&=' '____').status"
  > "$status_file"

  # Spawn N concurrent requests
  for i in $(seq 1 $TOTAL_PER_ENDPOINT); do
    (
      code=$(curl -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $TOKEN" \
        --max-time 10 \
        "$API/$ep" 2>/dev/null)
      echo "$code" >> "$status_file"
    ) &
    # Throttle concurrency
    if (( i % CONCURRENT == 0 )); then wait; fi
  done
  wait

  # Analyze results
  count_400=$(grep -c '^400$' "$status_file" 2>/dev/null | head -1)
  count_500=$(grep -c '^500$' "$status_file" 2>/dev/null | head -1)
  count_total=$(wc -l < "$status_file" | tr -d ' ')
  [ -z "$count_400" ] && count_400=0
  [ -z "$count_500" ] && count_500=0
  count_other=$((count_total - count_400 - count_500))

  TOTAL_400=$((TOTAL_400 + count_400))
  TOTAL_500=$((TOTAL_500 + count_500))
  TOTAL_OTHER=$((TOTAL_OTHER + count_other))

  # Other codes are typically 429 (rate limit) — not a backend bug
  count_429=$(grep -c '^429$' "$status_file" 2>/dev/null | head -1)
  [ -z "$count_429" ] && count_429=0
  count_truly_other=$((count_other - count_429))

  if [ "$count_500" -eq 0 ] && [ "$count_truly_other" -eq 0 ]; then
    if [ "$count_429" -gt 0 ]; then
      echo "  PASS — 400:$count_400 429:$count_429 (rate-limited, OK)"
    else
      echo "  PASS — 400/$count_total (all validated)"
    fi
    PASS=$((PASS + 1))
  else
    echo "  FAIL — 400:$count_400 500:$count_500 429:$count_429 unexpected:$count_truly_other total:$count_total"
    FAIL=$((FAIL + 1))
  fi
done

rm -rf "$TEMP_DIR"

echo ""
echo "=================================================="
echo "  RESULTS"
echo "=================================================="
echo "  Endpoints PASS: $PASS / ${#ENDPOINTS[@]}"
echo "  Endpoints FAIL: $FAIL"
echo "  Total HTTP 400:  $TOTAL_400 (expected)"
echo "  Total HTTP 500:  $TOTAL_500 (must be 0)"
echo "  Total HTTP other: $TOTAL_OTHER"
echo ""

if [ "$FAIL" -eq 0 ] && [ "$TOTAL_500" -eq 0 ]; then
  echo "ALL PASS"
  exit 0
else
  echo "TEST FAILED"
  exit 1
fi
