#!/bin/bash
# ============================================================
# SITREP Mensajeria Test — notification pipeline (inert)
# ============================================================
BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0; FAIL=0; ERRORS=""
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
CURL=$(which curl)
json_extract() { python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('$1','') if isinstance(d,dict) else ''; print(v if v else (d.get('data',{}).get('$1','') if isinstance(d.get('data'),dict) else ''))" 2>/dev/null; }
section() { echo ""; echo -e "${BOLD}--- $1 ---${NC}"; }

# Auth with retry (avoid rate limiting)
for _i in 1 2 3; do
  ADMIN_RESP=$($CURL -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
  TOKEN=$(echo "$ADMIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
  [ -n "$TOKEN" ] && break
  sleep 5
done
if [ -z "$TOKEN" ]; then echo "FATAL"; exit 1; fi

section "Notification Rules"
RESP=$($CURL -s -X GET "${API}/alertas/reglas" -H "Authorization: Bearer $TOKEN")
SUCCESS=$(echo "$RESP" | json_extract "success")
if [ "$SUCCESS" = "True" ] || [ "$SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Alert rules accessible"
  PASS=$((PASS+1))
else
  echo -e "  ${RED}FAIL${NC} Alert rules failed (got success=$SUCCESS)"
  FAIL=$((FAIL+1))
fi

section "In-App Notifications"
RESP=$($CURL -s -X GET "${API}/notificaciones" -H "Authorization: Bearer $TOKEN")
NOTIF_COUNT=$(echo "$RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', []) if isinstance(d.get('data'), list) else d.get('data', {}).get('notificaciones', [])
    print(len(items))
except: print('0')
" 2>/dev/null)
if [ "$NOTIF_COUNT" -gt 0 ] 2>/dev/null; then
  echo -e "  ${GREEN}PASS${NC} $NOTIF_COUNT notifications found (pipeline active)"
  PASS=$((PASS+1))

  # Mark first as read
  FIRST_ID=$(echo "$RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    items = d.get('data', []) if isinstance(d.get('data'), list) else d.get('data', {}).get('notificaciones', [])
    print(items[0]['id'] if items else '')
except: print('')
" 2>/dev/null)
  if [ -n "$FIRST_ID" ]; then
    READ_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' -X PUT "${API}/notificaciones/$FIRST_ID/leida" -H "Authorization: Bearer $TOKEN")
    if [ "$READ_STATUS" = "200" ]; then
      echo -e "  ${GREEN}PASS${NC} Mark as read (id: ${FIRST_ID:0:8}...)"
      PASS=$((PASS+1))
    else
      echo -e "  ${RED}FAIL${NC} Mark as read returned $READ_STATUS"
      FAIL=$((FAIL+1))
    fi
  fi
else
  echo -e "  ${YELLOW}WARN${NC} No notifications (pipeline may be empty)"
fi

echo ""; echo -e "${BOLD}RESULTS:${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
[ $FAIL -gt 0 ] && echo -e "$ERRORS" && exit 1 || exit 0
