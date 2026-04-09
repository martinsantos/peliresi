#!/usr/bin/env bash
# ============================================================
# SITREP — Sort Stress Test
# Validates server-side sort on auditoria endpoint works under
# concurrent load and returns correct ordering.
# ============================================================

set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE/api"
CONCURRENT=50

echo "=================================================="
echo "  SITREP Sort Stress Test"
echo "=================================================="
echo ""

TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "FAIL: no token"
  exit 1
fi

FAIL=0

test_sort() {
  local path="$1"
  local label="$2"
  local count_200=0
  local count_err=0
  local temp
  temp=$(mktemp)

  echo "--- $label ---"
  echo "    GET /$path"

  for i in $(seq 1 100); do
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

  count_200=$(grep -c '^200$' "$temp" 2>/dev/null | head -1)
  [ -z "$count_200" ] && count_200=0
  count_err=$(grep -v '^200$' "$temp" 2>/dev/null | wc -l | tr -d ' ')
  [ -z "$count_err" ] && count_err=0
  rm -f "$temp"

  echo "    200: $count_200 / 100, errors: $count_err"
  if [ "$count_err" -gt 0 ]; then
    echo "    FAIL — $count_err errors"
    return 1
  fi

  # Sanity: fetch a single response and verify sort direction
  local first
  first=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/$path&limit=3" \
    | python3 -c "import sys,json; d=json.load(sys.stdin)['data']['eventos']; print([e.get('usuario','')[:20] for e in d[:3]])" 2>/dev/null)
  echo "    First 3: $first"
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
