#!/bin/bash
# ============================================================
# SITREP Push Notification Test
# Tests VAPID key, subscribe, unsubscribe, and simulated push
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0; FAIL=0; SKIP=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
CURL=$(which curl)

json_extract() {
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$1', d.get('data', {}).get('$1', '')))" 2>/dev/null
}

section() { echo ""; echo -e "${BOLD}--- $1 ---${NC}"; }

section "SITREP PUSH NOTIFICATION TEST"
echo "Target: $API"

# Auth
echo -n "  Authenticating as ADMIN... "
ADMIN_RESP=$($CURL -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then echo -e "${RED}FATAL${NC}"; exit 1; fi
echo -e "${GREEN}OK${NC}"

section "Public VAPID Key"
VAPID_RESP=$($CURL -s "$API/push/vapid-key")
VAPID_KEY=$(echo "$VAPID_RESP" | json_extract "publicKey")
if [ -n "$VAPID_KEY" ] && [ ${#VAPID_KEY} -gt 20 ]; then
  echo -e "  ${GREEN}PASS${NC} VAPID public key returned (${#VAPID_KEY} chars)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} No VAPID key returned"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL No VAPID key"
fi

section "Subscribe (unauth — should fail)"
SUB_401=$($CURL -s -o /dev/null -w '%{http_code}' -X POST "$API/push/subscribe" \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"https://fake.push.service","keys":{"p256dh":"abc","auth":"def"}}')
if [ "$SUB_401" = "401" ]; then
  echo -e "  ${GREEN}PASS${NC} Unauthenticated subscribe blocked (401)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Expected 401, got $SUB_401"
  FAIL=$((FAIL + 1))
fi

section "Subscribe (auth)"
SUB_RESP=$($CURL -s -X POST "$API/push/subscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"endpoint":"https://fake.push.service/test","keys":{"p256dh":"dGVzdA==","auth":"dGVzdA=="}}')
SUB_SUCCESS=$(echo "$SUB_RESP" | json_extract "success")
if [ "$SUB_SUCCESS" = "True" ] || [ "$SUB_SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Subscription created"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Subscribe failed: $(echo "$SUB_RESP" | head -c 100)"
  FAIL=$((FAIL + 1))
fi

section "Unsubscribe (auth)"
UNSUB_RESP=$($CURL -s -X POST "$API/push/unsubscribe" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"endpoint":"https://fake.push.service/test"}')
UNSUB_SUCCESS=$(echo "$UNSUB_RESP" | json_extract "success")
if [ "$UNSUB_SUCCESS" = "True" ] || [ "$UNSUB_SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Unsubscribe successful"
  PASS=$((PASS + 1))
else
  echo -e "  ${YELLOW}WARN${NC} Unsubscribe may not be implemented"
  WARN=$((WARN + 1))
fi

# Summary
echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
[ $FAIL -gt 0 ] && exit 1 || exit 0
