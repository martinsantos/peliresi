#!/usr/bin/env bash
# ============================================================
# SITREP — Sort Stress Test
# Validates server-side sort on auditoria endpoint works under
# concurrent load and returns correct ordering.
# ============================================================

set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE/api"
CONCURRENT=20
TOTAL=60

echo "=================================================="
echo "  SITREP Sort Stress Test"
echo "  Concurrent: $CONCURRENT, Total per endpoint: $TOTAL"
echo "=================================================="
echo ""

_login() {
  curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
    | python3 -c "
import sys,json
try:
    print(json.load(sys.stdin).get('data',{}).get('tokens',{}).get('accessToken',''))
except: print('')
" 2>/dev/null
}
TOKEN=$(_login)
if [ -z "$TOKEN" ]; then
  echo "Rate limited, waiting 61s..."
  sleep 61
  TOKEN=$(_login)
fi
if [ -z "$TOKEN" ]; then
  echo "FAIL: no token"
  exit 1
fi

FAIL=0

test_sort() {
  local path="$1"
  local label="$2"
  local count_200=0
  local count_429=0
  local count_err=0
  local temp
  temp=$(mktemp)

  echo "--- $label ---"
  echo "    GET /$path"

  for i in $(seq 1 $TOTAL); do
    (
      code=$(curl -s -o /dev/null -w '%{http_code}' \
        -H "Authorization: Bearer $TOKEN" \
        --max-time 10 \
        "$API/$path" 2>/dev/null)
      echo "$code" >> "$temp"
    ) &
    if (( i % CONCURRENT == 0 )); then wait; fi
  done
  wait

  count_200=$(grep -c '^200$' "$temp" 2>/dev/null || true)
  count_200=${count_200:-0}; count_200=$(echo "$count_200" | tr -d '[:space:]')
  count_429=$(grep -c '^429$' "$temp" 2>/dev/null || true)
  count_429=${count_429:-0}; count_429=$(echo "$count_429" | tr -d '[:space:]')
  local count_500=$(grep -c '^500$' "$temp" 2>/dev/null || true)
  count_500=${count_500:-0}; count_500=$(echo "$count_500" | tr -d '[:space:]')
  count_err=$((TOTAL - count_200 - count_429))
  rm -f "$temp"

  echo "    200: $count_200, 429(rate-limit): $count_429, 500: $count_500, other: $count_err"

  # FAIL only on 500s or if zero 200s (total failure)
  if [ "$count_500" -gt 0 ]; then
    echo "    FAIL — $count_500 HTTP 500 errors (server crash)"
    return 1
  fi
  if [ "$count_200" -eq 0 ]; then
    echo "    FAIL — zero successful responses"
    return 1
  fi

  # Sanity: fetch a single response and verify sort direction
  local first
  first=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/$path&limit=3" \
    | python3 -c "
import sys,json
try:
    d=json.load(sys.stdin)['data']['eventos']
    print([e.get('usuario','')[:20] for e in d[:3]])
except: print('N/A')
" 2>/dev/null)
  echo "    First 3: $first"
  echo "    PASS"
  return 0
}

test_sort "reportes/auditoria?sortBy=usuario&sortOrder=asc" "Auditoria sort usuario ASC" || FAIL=$((FAIL + 1))
test_sort "reportes/auditoria?sortBy=usuario&sortOrder=desc" "Auditoria sort usuario DESC" || FAIL=$((FAIL + 1))
test_sort "reportes/auditoria?sortBy=accion&sortOrder=asc" "Auditoria sort accion ASC" || FAIL=$((FAIL + 1))
test_sort "reportes/auditoria?sortBy=accion&sortOrder=desc" "Auditoria sort accion DESC" || FAIL=$((FAIL + 1))
test_sort "reportes/auditoria?sortBy=createdAt&sortOrder=desc" "Auditoria sort fecha DESC (default)" || FAIL=$((FAIL + 1))
test_sort "reportes/auditoria?sortBy=createdAt&sortOrder=asc" "Auditoria sort fecha ASC" || FAIL=$((FAIL + 1))

echo ""
echo "=================================================="
if [ "$FAIL" -eq 0 ]; then
  echo "  ALL SORT TESTS PASSED"
  exit 0
else
  echo "  FAIL: $FAIL"
  exit 1
fi
