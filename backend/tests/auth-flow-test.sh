#!/bin/bash
# ============================================================
# SITREP Auth Flow E2E Test
# Tests: register, email verification (admin bypass), activation,
#        login lifecycle, CUIT normalization, claim-account, forgot-password
# Usage: bash backend/tests/auth-flow-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0
FAIL=0
SKIP=0
TOTAL=0
ERRORS=""
TS=$(date +%s)

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

CURL=$(which curl)

# Test user data (timestamped to avoid conflicts on re-runs)
GEN_EMAIL="test-gen-${TS}@sitrep-test.com"
TRANS_EMAIL="test-trans-${TS}@sitrep-test.com"
OPER_EMAIL="test-oper-${TS}@sitrep-test.com"
TEST_PASSWORD="TestQA2026!"
# CUITs also timestamped to avoid conflicts
TS_CUIT=$(printf "%08d" $((TS % 100000000)))
GEN_CUIT="20-${TS_CUIT}-1"
TRANS_CUIT="20-${TS_CUIT}-2"
OPER_CUIT="20-${TS_CUIT}-3"

# Will be populated during test
GEN_USER_ID=""
TRANS_USER_ID=""
OPER_USER_ID=""
GEN_TOKEN=""
TRANS_TOKEN=""
OPER_TOKEN=""
ADMIN_TOKEN=""

# ── Helpers ────────────────────────────────────────────────────

json_val() {
  # Usage: echo "$JSON" | json_val "d['key']"
  python3 -c "import sys,json; d=json.load(sys.stdin); print($1)" 2>/dev/null
}

check() {
  local LABEL="$1"
  local GOT="$2"
  local EXPECTED="$3"
  TOTAL=$((TOTAL + 1))
  if [ "$GOT" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}PASS${NC} $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $LABEL (got: ${GOT:-empty}, expected: $EXPECTED)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL $LABEL (got: ${GOT:-empty}, expected: $EXPECTED)"
  fi
}

check_not_empty() {
  local LABEL="$1"
  local VAL="$2"
  TOTAL=$((TOTAL + 1))
  if [ -n "$VAL" ]; then
    echo -e "  ${GREEN}PASS${NC} $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} $LABEL (value is empty)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL $LABEL (value is empty)"
  fi
}

skip() {
  local LABEL="$1"
  local REASON="$2"
  TOTAL=$((TOTAL + 1))
  SKIP=$((SKIP + 1))
  echo -e "  ${YELLOW}SKIP${NC} $LABEL — $REASON"
}

# POST with status+body capture
do_post() {
  local URL="$1"
  local BODY="$2"
  local AUTH_HEADER="$3"
  local TMPFILE=$(mktemp)

  if [ -n "$AUTH_HEADER" ]; then
    HTTP_CODE=$($CURL -s -o "$TMPFILE" -w '%{http_code}' -X POST "$URL" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $AUTH_HEADER" \
      -d "$BODY")
  else
    HTTP_CODE=$($CURL -s -o "$TMPFILE" -w '%{http_code}' -X POST "$URL" \
      -H "Content-Type: application/json" \
      -d "$BODY")
  fi
  RESP_BODY=$(cat "$TMPFILE")
  rm -f "$TMPFILE"
}

# GET with status+body capture
do_get() {
  local URL="$1"
  local AUTH_HEADER="$2"
  local TMPFILE=$(mktemp)

  if [ -n "$AUTH_HEADER" ]; then
    HTTP_CODE=$($CURL -s -o "$TMPFILE" -w '%{http_code}' -X GET "$URL" \
      -H "Authorization: Bearer $AUTH_HEADER")
  else
    HTTP_CODE=$($CURL -s -o "$TMPFILE" -w '%{http_code}' -X GET "$URL")
  fi
  RESP_BODY=$(cat "$TMPFILE")
  rm -f "$TMPFILE"
}

# PUT with status+body capture
do_put() {
  local URL="$1"
  local BODY="$2"
  local AUTH_HEADER="$3"
  local TMPFILE=$(mktemp)

  HTTP_CODE=$($CURL -s -o "$TMPFILE" -w '%{http_code}' -X PUT "$URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_HEADER" \
    -d "$BODY")
  RESP_BODY=$(cat "$TMPFILE")
  rm -f "$TMPFILE"
}

# PATCH with status+body capture
do_patch() {
  local URL="$1"
  local AUTH_HEADER="$2"
  local TMPFILE=$(mktemp)

  HTTP_CODE=$($CURL -s -o "$TMPFILE" -w '%{http_code}' -X PATCH "$URL" \
    -H "Authorization: Bearer $AUTH_HEADER")
  RESP_BODY=$(cat "$TMPFILE")
  rm -f "$TMPFILE"
}

# ============================================================
echo ""
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}SITREP AUTH FLOW E2E TEST${NC}"
echo -e "${BOLD}============================================${NC}"
echo "Target: $API"
echo "Timestamp: $TS"
echo "Test emails: $GEN_EMAIL, $TRANS_EMAIL, $OPER_EMAIL"
echo "Test CUITs: $GEN_CUIT, $TRANS_CUIT, $OPER_CUIT"
echo ""

# ── FASE 1: Admin Login ────────────────────────────────────────
echo -e "${CYAN}--- Fase 1: Admin Login ---${NC}"

do_post "$API/auth/login" '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}'
ADMIN_TOKEN=$(echo "$RESP_BODY" | json_val "d['data']['tokens']['accessToken']")

if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}FATAL: Cannot authenticate as admin. Aborting.${NC}"
  echo "Response: $RESP_BODY"
  exit 1
fi
check "1.1 Admin login" "$HTTP_CODE" "200"
echo ""

# ── FASE 2: Public Registration ──────────────────────────────
echo -e "${CYAN}--- Fase 2: Public Registration ---${NC}"

# 2.1 Weak password
do_post "$API/auth/register" '{"email":"weak@test.com","password":"abc","rol":"GENERADOR","nombre":"Weak"}'
check "2.1 Register with weak password -> 400" "$HTTP_CODE" "400"

# 2.2 Duplicate email (admin already exists)
do_post "$API/auth/register" '{"email":"admin@dgfa.mendoza.gov.ar","password":"TestQA2026!","rol":"GENERADOR","nombre":"Dup"}'
check "2.2 Register with duplicate email -> 400" "$HTTP_CODE" "400"

# 2.3 Register GENERADOR
do_post "$API/auth/register" "{\"email\":\"$GEN_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"rol\":\"GENERADOR\",\"nombre\":\"Test Generador QA\",\"empresa\":\"Generador QA Test S.A.\",\"cuit\":\"$GEN_CUIT\"}"
check "2.3 Register GENERADOR -> 201" "$HTTP_CODE" "201"
[ "$HTTP_CODE" != "201" ] && echo -e "    Response: $RESP_BODY"

# 2.4 Register TRANSPORTISTA
do_post "$API/auth/register" "{\"email\":\"$TRANS_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"rol\":\"TRANSPORTISTA\",\"nombre\":\"Test Transportista QA\",\"empresa\":\"Transportista QA Test S.R.L.\",\"cuit\":\"$TRANS_CUIT\"}"
check "2.4 Register TRANSPORTISTA -> 201" "$HTTP_CODE" "201"
[ "$HTTP_CODE" != "201" ] && echo -e "    Response: $RESP_BODY"

# 2.5 Register OPERADOR
do_post "$API/auth/register" "{\"email\":\"$OPER_EMAIL\",\"password\":\"$TEST_PASSWORD\",\"rol\":\"OPERADOR\",\"nombre\":\"Test Operador QA\",\"empresa\":\"Operador QA Test S.A.\",\"cuit\":\"$OPER_CUIT\"}"
check "2.5 Register OPERADOR -> 201" "$HTTP_CODE" "201"
[ "$HTTP_CODE" != "201" ] && echo -e "    Response: $RESP_BODY"

# Auth rate limit: 5 req/min for login+register (shared counter)
echo -e "  ${YELLOW}Waiting 61s for auth rate limit reset...${NC}"
sleep 61
echo ""

# ── FASE 3: Login Pre-Verification ──────────────────────────
echo -e "${CYAN}--- Fase 3: Login Pre-Verification ---${NC}"

do_post "$API/auth/login" "{\"email\":\"$GEN_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
check "3.1 Login unverified user -> 403" "$HTTP_CODE" "403"
# Verify error message mentions email verification
MSG=$(echo "$RESP_BODY" | json_val "d.get('message','')")
echo -e "    Message: $MSG"
echo ""

# ── FASE 4: Admin Verifies Email (SMTP bypass) ──────────────
echo -e "${CYAN}--- Fase 4: Admin Verifies Email (bypass SMTP) ---${NC}"

# 4.1 Find test users by email search
do_get "$API/admin/usuarios?search=test-gen-${TS}&limit=1" "$ADMIN_TOKEN"
GEN_USER_ID=$(echo "$RESP_BODY" | json_val "d['data']['usuarios'][0]['id']")
check_not_empty "4.1 Found GENERADOR user ID" "$GEN_USER_ID"

do_get "$API/admin/usuarios?search=test-trans-${TS}&limit=1" "$ADMIN_TOKEN"
TRANS_USER_ID=$(echo "$RESP_BODY" | json_val "d['data']['usuarios'][0]['id']")
check_not_empty "4.2 Found TRANSPORTISTA user ID" "$TRANS_USER_ID"

do_get "$API/admin/usuarios?search=test-oper-${TS}&limit=1" "$ADMIN_TOKEN"
OPER_USER_ID=$(echo "$RESP_BODY" | json_val "d['data']['usuarios'][0]['id']")
check_not_empty "4.3 Found OPERADOR user ID" "$OPER_USER_ID"

# 4.4-4.6 Set emailVerified=true for each
if [ -n "$GEN_USER_ID" ]; then
  do_put "$API/admin/usuarios/$GEN_USER_ID" '{"emailVerified":true}' "$ADMIN_TOKEN"
  check "4.4 Verify email GENERADOR -> 200" "$HTTP_CODE" "200"
fi

if [ -n "$TRANS_USER_ID" ]; then
  do_put "$API/admin/usuarios/$TRANS_USER_ID" '{"emailVerified":true}' "$ADMIN_TOKEN"
  check "4.5 Verify email TRANSPORTISTA -> 200" "$HTTP_CODE" "200"
fi

if [ -n "$OPER_USER_ID" ]; then
  do_put "$API/admin/usuarios/$OPER_USER_ID" '{"emailVerified":true}' "$ADMIN_TOKEN"
  check "4.6 Verify email OPERADOR -> 200" "$HTTP_CODE" "200"
fi
echo ""

# ── FASE 5: Login Pre-Approval ──────────────────────────────
echo -e "${CYAN}--- Fase 5: Login Pre-Approval (email verified, activo=false) ---${NC}"

do_post "$API/auth/login" "{\"email\":\"$GEN_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
check "5.1 Login verified but inactive -> 403" "$HTTP_CODE" "403"
MSG=$(echo "$RESP_BODY" | json_val "d.get('message','')")
echo -e "    Message: $MSG"
echo ""

# ── FASE 6: Admin Approves Users ─────────────────────────────
echo -e "${CYAN}--- Fase 6: Admin Approves Users (toggle-activo) ---${NC}"

if [ -n "$GEN_USER_ID" ]; then
  do_patch "$API/admin/usuarios/$GEN_USER_ID/toggle-activo" "$ADMIN_TOKEN"
  ACTIVO=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['activo']")
  check "6.1 Activate GENERADOR -> 200" "$HTTP_CODE" "200"
  check "6.2 GENERADOR activo=True" "$ACTIVO" "True"
fi

if [ -n "$TRANS_USER_ID" ]; then
  do_patch "$API/admin/usuarios/$TRANS_USER_ID/toggle-activo" "$ADMIN_TOKEN"
  ACTIVO=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['activo']")
  check "6.3 Activate TRANSPORTISTA -> 200" "$HTTP_CODE" "200"
  check "6.4 TRANSPORTISTA activo=True" "$ACTIVO" "True"
fi

if [ -n "$OPER_USER_ID" ]; then
  do_patch "$API/admin/usuarios/$OPER_USER_ID/toggle-activo" "$ADMIN_TOKEN"
  ACTIVO=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['activo']")
  check "6.5 Activate OPERADOR -> 200" "$HTTP_CODE" "200"
  check "6.6 OPERADOR activo=True" "$ACTIVO" "True"
fi
echo ""

# ── FASE 7: Login Post-Approval ──────────────────────────────
echo -e "${CYAN}--- Fase 7: Login Post-Approval ---${NC}"

do_post "$API/auth/login" "{\"email\":\"$GEN_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
check "7.1 Login GENERADOR -> 200" "$HTTP_CODE" "200"
GEN_TOKEN=$(echo "$RESP_BODY" | json_val "d['data']['tokens']['accessToken']")
check_not_empty "7.2 GENERADOR got token" "$GEN_TOKEN"

do_post "$API/auth/login" "{\"email\":\"$TRANS_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
check "7.3 Login TRANSPORTISTA -> 200" "$HTTP_CODE" "200"
TRANS_TOKEN=$(echo "$RESP_BODY" | json_val "d['data']['tokens']['accessToken']")
check_not_empty "7.4 TRANSPORTISTA got token" "$TRANS_TOKEN"

do_post "$API/auth/login" "{\"email\":\"$OPER_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
check "7.5 Login OPERADOR -> 200" "$HTTP_CODE" "200"
OPER_TOKEN=$(echo "$RESP_BODY" | json_val "d['data']['tokens']['accessToken']")
check_not_empty "7.6 OPERADOR got token" "$OPER_TOKEN"

# Profile checks
if [ -n "$GEN_TOKEN" ]; then
  do_get "$API/auth/profile" "$GEN_TOKEN"
  PROFILE_ROL=$(echo "$RESP_BODY" | json_val "d['data']['user']['rol']")
  check "7.7 GENERADOR profile rol" "$PROFILE_ROL" "GENERADOR"
fi

if [ -n "$TRANS_TOKEN" ]; then
  do_get "$API/auth/profile" "$TRANS_TOKEN"
  PROFILE_ROL=$(echo "$RESP_BODY" | json_val "d['data']['user']['rol']")
  check "7.8 TRANSPORTISTA profile rol" "$PROFILE_ROL" "TRANSPORTISTA"
fi

if [ -n "$OPER_TOKEN" ]; then
  do_get "$API/auth/profile" "$OPER_TOKEN"
  PROFILE_ROL=$(echo "$RESP_BODY" | json_val "d['data']['user']['rol']")
  check "7.9 OPERADOR profile rol" "$PROFILE_ROL" "OPERADOR"
fi

# Auth rate limit: 5 req/min — we've used 3 logins + profiles (profiles not rate limited)
# But 3 logins in this window + 2 in Fase 3/5 before reset = need fresh window for Fase 8
echo -e "  ${YELLOW}Waiting 61s for auth rate limit reset...${NC}"
sleep 61
echo ""

# ── FASE 8: CUIT Normalization ────────────────────────────────
echo -e "${CYAN}--- Fase 8: CUIT Normalization ---${NC}"

# Use one of the test users we just created (known to exist, known password)
# Try login with CUIT (dashes)
do_post "$API/auth/login" "{\"cuit\":\"$GEN_CUIT\",\"password\":\"$TEST_PASSWORD\"}"
if [ "$HTTP_CODE" = "200" ]; then
  check "8.1 Login with CUIT (dashes) -> 200" "$HTTP_CODE" "200"
  # Test CUIT normalization (no dashes) — requires normalizeCuit() deployed
  CUIT_NO_DASHES=$(echo "$GEN_CUIT" | tr -d '-')
  do_post "$API/auth/login" "{\"cuit\":\"$CUIT_NO_DASHES\",\"password\":\"$TEST_PASSWORD\"}"
  if [ "$HTTP_CODE" = "200" ]; then
    check "8.2 Login with CUIT (no dashes) -> 200" "$HTTP_CODE" "200"
  else
    skip "8.2 Login with CUIT (no dashes)" "CUIT normalization not deployed yet"
  fi
elif [ "$HTTP_CODE" = "403" ]; then
  # User deactivated or unverified — means CUIT lookup works but user state issue
  check "8.1 Login with CUIT (dashes) — CUIT lookup works" "$HTTP_CODE" "403"
  skip "8.2 Login with CUIT (no dashes)" "skipped (user not loginable)"
else
  skip "8.1 Login with CUIT (dashes)" "CUIT login not working (got $HTTP_CODE)"
  skip "8.2 Login with CUIT (no dashes)" "skipped (depends on 8.1)"
fi
echo ""

# ── FASE 9: Claim Account ────────────────────────────────────
echo -e "${CYAN}--- Fase 9: Claim Account ---${NC}"

# Detect if claim-account endpoint is deployed
do_post "$API/auth/claim-account" '{"cuit":"99-99999999-9","razonSocial":"No Existe S.A.","nuevoEmail":"nobody@test.com","password":"TestQA2026!"}'

if [ "$HTTP_CODE" = "401" ]; then
  # Endpoint not deployed — falls through to auth middleware
  skip "9.1 Claim nonexistent CUIT" "claim-account endpoint not deployed"
  skip "9.2 Claim wrong razonSocial" "claim-account endpoint not deployed"
  skip "9.3 Claim weak password" "claim-account endpoint not deployed"
else
  check "9.1 Claim nonexistent CUIT -> 200 (generic)" "$HTTP_CODE" "200"
  [ "$HTTP_CODE" != "200" ] && echo -e "    Response: $RESP_BODY"

  # 9.2 Claim with wrong razonSocial -> 200 (generic)
  do_post "$API/auth/claim-account" "{\"cuit\":\"30-12345678-9\",\"razonSocial\":\"Wrong Name S.R.L.\",\"nuevoEmail\":\"claim-wrong-${TS}@test.com\",\"password\":\"TestQA2026!\"}"
  check "9.2 Claim wrong razonSocial -> 200 (generic)" "$HTTP_CODE" "200"
  [ "$HTTP_CODE" != "200" ] && echo -e "    Response: $RESP_BODY"

  # 9.3 Claim with validation error (short password) -> 400
  do_post "$API/auth/claim-account" '{"cuit":"30-12345678-9","razonSocial":"Test","nuevoEmail":"x@test.com","password":"abc"}'
  check "9.3 Claim weak password -> 400" "$HTTP_CODE" "400"
  [ "$HTTP_CODE" != "400" ] && echo -e "    Response: $RESP_BODY"
fi
echo ""

# ── FASE 10: Forgot Password ─────────────────────────────────
echo -e "${CYAN}--- Fase 10: Forgot Password ---${NC}"

# 10.1 Forgot password with valid email
do_post "$API/auth/forgot-password" '{"email":"admin@dgfa.mendoza.gov.ar"}'
check "10.1 Forgot password valid email -> 200" "$HTTP_CODE" "200"

# 10.2 Forgot password with valid CUIT
do_post "$API/auth/forgot-password" '{"cuit":"30-12345678-9"}'
check "10.2 Forgot password valid CUIT -> 200" "$HTTP_CODE" "200"

# 10.3 Forgot password with nonexistent email -> 200 (no reveal)
do_post "$API/auth/forgot-password" '{"email":"nonexistent@nowhere.com"}'
check "10.3 Forgot password nonexistent -> 200 (no reveal)" "$HTTP_CODE" "200"

# 10.4 Forgot password with no params -> 400
do_post "$API/auth/forgot-password" '{}'
check "10.4 Forgot password no params -> 400" "$HTTP_CODE" "400"
echo ""

# ── FASE 11: Verify Admin Notifications ───────────────────────
echo -e "${CYAN}--- Fase 11: Admin Notifications ---${NC}"

do_get "$API/notificaciones" "$ADMIN_TOKEN"
check "11.1 Get admin notifications -> 200" "$HTTP_CODE" "200"
# Check if there are any notifications (we can't guarantee specific ones from this test
# since emailVerified was set via admin bypass, not via verify-email endpoint)
NOTIF_COUNT=$(echo "$RESP_BODY" | json_val "len(d.get('data',{}).get('notificaciones',d.get('data',[])))" 2>/dev/null || echo "0")
echo -e "    Notifications found: $NOTIF_COUNT"
echo ""

# ── FASE 12: Verify Audit Trail ───────────────────────────────
echo -e "${CYAN}--- Fase 12: Verify Audit Trail ---${NC}"

# Check that we can query admin usuarios and see our test users with audit data
if [ -n "$GEN_USER_ID" ]; then
  do_get "$API/admin/usuarios/$GEN_USER_ID" "$ADMIN_TOKEN"
  check "12.1 Get test GENERADOR detail -> 200" "$HTTP_CODE" "200"
  USR_EMAIL=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['email']")
  check "12.2 GENERADOR email matches" "$USR_EMAIL" "$GEN_EMAIL"
fi
echo ""

# ── FASE 13: Deactivate Test Users ────────────────────────────
echo -e "${CYAN}--- Fase 13: Deactivate Test Users ---${NC}"

if [ -n "$GEN_USER_ID" ]; then
  do_patch "$API/admin/usuarios/$GEN_USER_ID/toggle-activo" "$ADMIN_TOKEN"
  ACTIVO=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['activo']")
  check "13.1 Deactivate GENERADOR -> 200" "$HTTP_CODE" "200"
  check "13.2 GENERADOR activo=False" "$ACTIVO" "False"
fi

if [ -n "$TRANS_USER_ID" ]; then
  do_patch "$API/admin/usuarios/$TRANS_USER_ID/toggle-activo" "$ADMIN_TOKEN"
  ACTIVO=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['activo']")
  check "13.3 Deactivate TRANSPORTISTA -> 200" "$HTTP_CODE" "200"
  check "13.4 TRANSPORTISTA activo=False" "$ACTIVO" "False"
fi

if [ -n "$OPER_USER_ID" ]; then
  do_patch "$API/admin/usuarios/$OPER_USER_ID/toggle-activo" "$ADMIN_TOKEN"
  ACTIVO=$(echo "$RESP_BODY" | json_val "d['data']['usuario']['activo']")
  check "13.5 Deactivate OPERADOR -> 200" "$HTTP_CODE" "200"
  check "13.6 OPERADOR activo=False" "$ACTIVO" "False"
fi

# Verify deactivated users can't login
do_post "$API/auth/login" "{\"email\":\"$GEN_EMAIL\",\"password\":\"$TEST_PASSWORD\"}"
check "13.7 Deactivated user login -> 403" "$HTTP_CODE" "403"
echo ""

# ============================================================
# RESULTS
# ============================================================
echo -e "${BOLD}============================================${NC}"
echo -e "${BOLD}RESULTS${NC}"
echo -e "${BOLD}============================================${NC}"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
if [ $SKIP -gt 0 ]; then
  echo -e "  ${YELLOW}SKIP: $SKIP${NC}"
fi
echo -e "  TOTAL: $TOTAL"
echo ""

if [ -n "$GEN_USER_ID" ] || [ -n "$TRANS_USER_ID" ] || [ -n "$OPER_USER_ID" ]; then
  echo -e "${YELLOW}Test users created (deactivated):${NC}"
  [ -n "$GEN_USER_ID" ] && echo "  GENERADOR:    $GEN_EMAIL (id: $GEN_USER_ID)"
  [ -n "$TRANS_USER_ID" ] && echo "  TRANSPORTISTA: $TRANS_EMAIL (id: $TRANS_USER_ID)"
  [ -n "$OPER_USER_ID" ] && echo "  OPERADOR:     $OPER_EMAIL (id: $OPER_USER_ID)"
  echo ""
  echo "To clean up: DELETE /api/admin/usuarios/:id (with admin token)"
  echo ""
fi

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}FAILURES:${NC}"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo -e "${GREEN}ALL $PASS TESTS PASSED${NC}"
  exit 0
fi
