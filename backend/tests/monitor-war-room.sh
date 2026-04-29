#!/bin/bash
# ============================================================
# SITREP War Room Monitor — Health checks cada 5 min
# Usage: bash backend/tests/monitor-war-room.sh [BASE_URL] [LOG_DIR]
# ============================================================
BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
LOG_DIR="${2:-/tmp/sitrep-war-room}"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/war-room-$(date '+%Y-%m-%d').log"

log() { echo "[$(date '+%H:%M:%S')] $1" >> "$LOG"; }

GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
CURL=$(which curl)
FAILS=0

# 1. Health
for EP in "/health" "/health/live" "/health/ready"; do
  STATUS=$($CURL -s -o /dev/null -w '%{http_code}' "${API}${EP}")
  if [ "$STATUS" != "200" ]; then
    log "FAIL health $EP → $STATUS"
    echo -e "  ${RED}FAIL${NC} health $EP → $STATUS"
    FAILS=$((FAILS + 1))
  else
    echo -e "  ${GREEN}PASS${NC} health $EP"
  fi
done

# 2. Login
LOGIN_RESP=$($CURL -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)
if [ -z "$TOKEN" ]; then
  log "FAIL login → no token"
  echo -e "  ${RED}FAIL${NC} login → no token"
  FAILS=$((FAILS + 1))
else
  echo -e "  ${GREEN}PASS${NC} login OK"
fi

# 3. Dashboard
DASH_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' "${API}/manifiestos/dashboard" -H "Authorization: Bearer $TOKEN")
if [ "$DASH_STATUS" = "200" ]; then
  echo -e "  ${GREEN}PASS${NC} dashboard OK"
else
  log "FAIL dashboard → $DASH_STATUS"
  echo -e "  ${RED}FAIL${NC} dashboard → $DASH_STATUS"
  FAILS=$((FAILS + 1))
fi

# Result
if [ $FAILS -gt 0 ]; then
  log "STATUS: $FAILS failures"
  echo ""; echo "WAR ROOM: $FAILS failures — check $LOG"; exit 1
else
  log "STATUS: OK"
  echo ""; echo "WAR ROOM: All OK"; exit 0
fi
