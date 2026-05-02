#!/usr/bin/env bash
# Non-destructive forensic/integrity checks.

set -uo pipefail

TARGET_URL="${1:-${TARGET_URL:-https://sitrep.ultimamilla.com.ar}}"
TARGET_URL="${TARGET_URL%/}"
API="$TARGET_URL/api"
FAIL=0

ADMIN_EMAIL="${CERT_ADMIN_EMAIL:-admin@dgfa.mendoza.gov.ar}"
ADMIN_PASSWORD="${CERT_ADMIN_PASSWORD:-admin123}"

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }
warn() { echo "WARN $1"; }

json_field() {
  python3 -c "
import json,sys
try:
  d=json.load(sys.stdin)
  cur=d
  for p in '$1'.split('.'):
    if p.isdigit():
      cur=cur[int(p)]
    else:
      cur=cur[p]
  print(cur)
except Exception:
  print('')
" 2>/dev/null
}

api_get() {
  curl -sS "$API$1" -H "Authorization: Bearer $TOKEN"
}

echo "SITREP forensic integrity checks"
echo "Target: $TARGET_URL"

LOGIN_RESP="$(curl -sS -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")"
TOKEN="$(printf "%s" "$LOGIN_RESP" | json_field data.tokens.accessToken)"
if [ -n "$TOKEN" ]; then pass "admin login returns token"; else fail "admin login returns token"; fi

if [ -n "$TOKEN" ]; then
  DASH="$(api_get "/manifiestos?limit=1")"
  MANIFIESTO_ID="$(printf "%s" "$DASH" | python3 -c "
import json,sys
try:
 d=json.load(sys.stdin)
 data=d.get('data', {})
 items=data.get('manifiestos') or data.get('items') or []
 print(items[0].get('id','') if items else '')
except Exception:
 print('')
" 2>/dev/null)"

  if [ -n "$MANIFIESTO_ID" ]; then
    pass "can resolve sample manifiesto id"

    DETAIL="$(api_get "/manifiestos/$MANIFIESTO_ID")"
    if printf "%s" "$DETAIL" | python3 -c "import json,sys; d=json.load(sys.stdin); assert d.get('data')" >/dev/null 2>&1; then
      pass "sample manifiesto detail returns data"
    else
      fail "sample manifiesto detail returns data"
    fi

    PDF_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$API/pdf/manifiesto/$MANIFIESTO_ID" -H "Authorization: Bearer $TOKEN")"
    if [ "$PDF_CODE" = "200" ]; then pass "sample manifiesto PDF returns 200"; else fail "sample manifiesto PDF returns 200 got $PDF_CODE"; fi

    BC_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$API/blockchain/manifiesto/$MANIFIESTO_ID" -H "Authorization: Bearer $TOKEN")"
    if [ "$BC_CODE" = "200" ] || [ "$BC_CODE" = "404" ]; then
      pass "blockchain lookup returns controlled status"
    else
      fail "blockchain lookup returns controlled status got $BC_CODE"
    fi
  else
    fail "can resolve sample manifiesto id"
  fi

  AUDIT_CODE="$(curl -sS -o /dev/null -w '%{http_code}' "$API/reportes/auditoria?limit=1" -H "Authorization: Bearer $TOKEN")"
  if [ "$AUDIT_CODE" = "200" ]; then
    pass "auditoria report endpoint returns 200"
  else
    warn "auditoria report endpoint returned $AUDIT_CODE"
  fi
fi

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
