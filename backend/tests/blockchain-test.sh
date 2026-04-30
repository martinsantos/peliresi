#!/bin/bash
# ============================================================
# SITREP Blockchain Validation Test
# Tests the blockchain registration and verification flow
# Usage: ./tests/blockchain-test.sh [BASE_URL]
# Default: http://localhost:3002
# ============================================================

BASE_URL="${1:-http://localhost:3002}"
API="$BASE_URL/api"
PASS=0
FAIL=0
SKIP=0
ERRORS=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

CURL=$(which curl)

echo "============================================"
echo "SITREP BLOCKCHAIN TEST"
echo "Target: $API"
echo "============================================"
echo ""

# Helper: test authenticated endpoint
test_endpoint() {
  local METHOD=$1
  local EPATH=$2
  local EXPECTED=$3
  local BODY=$4
  local LABEL="${METHOD} ${EPATH}"

  if [ -n "$BODY" ]; then
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY")
  else
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN")
  fi

  if [ "$RESP" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}PASS${NC} [$RESP] $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} [$RESP expected $EXPECTED] $LABEL"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL [$RESP expected $EXPECTED] $LABEL"
  fi
}

test_public() {
  local METHOD=$1
  local EPATH=$2
  local EXPECTED=$3
  local LABEL="${METHOD} ${EPATH} (public)"

  RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}")

  if [ "$RESP" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}PASS${NC} [$RESP] $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} [$RESP expected $EXPECTED] $LABEL"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL [$RESP expected $EXPECTED] $LABEL"
  fi
}

# ── Phase 1: Authenticate ──
echo "--- Phase 1: Authentication ---"

LOGIN_RESP=$($CURL -s -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')

TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}FATAL: Cannot authenticate. Aborting.${NC}"
  exit 1
fi
echo -e "${GREEN}Authenticated as admin${NC}"

# ── Phase 2: Blockchain endpoint availability ──
echo ""
echo "--- Phase 2: Blockchain Endpoints ---"

# Public verification with invalid hash
test_public "GET" "/blockchain/verificar/0000000000000000000000000000000000000000000000000000000000000000" "200"

# Public verification with short hash (should return 400)
test_public "GET" "/blockchain/verificar/abc" "400"

# ── Phase 3: Get existing manifest blockchain status ──
echo ""
echo "--- Phase 3: Manifest Blockchain Status ---"

MANIFIESTO_ID=$($CURL -s "${API}/manifiestos?limit=1" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); ms=d['data']['manifiestos']; print(ms[0]['id'] if ms else '')" 2>/dev/null)

if [ -n "$MANIFIESTO_ID" ]; then
  test_endpoint "GET" "/blockchain/manifiesto/$MANIFIESTO_ID" "200"

  # Check that blockchain fields are included in manifest detail
  BLOCKCHAIN_STATUS=$($CURL -s "${API}/manifiestos/$MANIFIESTO_ID" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); m=d['data']['manifiesto']; print('HAS_FIELD' if 'blockchainStatus' in m else 'MISSING')" 2>/dev/null)

  if [ "$BLOCKCHAIN_STATUS" = "HAS_FIELD" ]; then
    echo -e "  ${GREEN}PASS${NC} Manifest detail includes blockchainStatus field"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Manifest detail missing blockchainStatus field"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Manifest detail missing blockchainStatus field"
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No manifests found to test"
fi

# ── Phase 4: Blockchain status via public verification ──
echo ""
echo "--- Phase 4: Public Verification with Blockchain ---"

if [ -n "$MANIFIESTO_ID" ]; then
  MAN_NUMERO=$($CURL -s "${API}/manifiestos/$MANIFIESTO_ID" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['manifiesto']['numero'])" 2>/dev/null)

  if [ -n "$MAN_NUMERO" ]; then
    BC_IN_VERIFY=$($CURL -s "${API}/manifiestos/verificar/$MAN_NUMERO" | \
      python3 -c "import sys,json; d=json.load(sys.stdin); m=d['data']['manifiesto']; print('HAS_FIELD' if 'blockchainStatus' in m else 'MISSING')" 2>/dev/null)

    if [ "$BC_IN_VERIFY" = "HAS_FIELD" ]; then
      echo -e "  ${GREEN}PASS${NC} Public verification includes blockchainStatus"
      PASS=$((PASS + 1))
    else
      echo -e "  ${RED}FAIL${NC} Public verification missing blockchainStatus"
      FAIL=$((FAIL + 1))
      ERRORS="$ERRORS\n  FAIL Public verification missing blockchainStatus"
    fi
  fi
fi

# ── Phase 5: Blockchain-enabled check ──
echo ""
echo "--- Phase 5: Feature Flag ---"

BC_ENABLED=$($CURL -s "${API}/blockchain/manifiesto/$MANIFIESTO_ID" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['blockchain'].get('enabled', 'MISSING'))" 2>/dev/null)

if [ "$BC_ENABLED" = "True" ] || [ "$BC_ENABLED" = "False" ]; then
  echo -e "  ${GREEN}PASS${NC} Blockchain enabled field present (value: $BC_ENABLED)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Blockchain enabled field missing"
  FAIL=$((FAIL + 1))
fi

# ── Phase 6: Blockchain Registration ──
echo ""
echo "--- Phase 6: Blockchain Registration ---"

# Get a TRATADO manifest for blockchain test
TRATADO_ID=$($CURL -s "${API}/manifiestos?estado=TRATADO&limit=1" \
  -H "Authorization: Bearer $TOKEN" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); ms=d['data']['manifiestos']; print(ms[0]['id'] if ms else '')" 2>/dev/null)

if [ -n "$TRATADO_ID" ]; then
  # Check if already blockchain-registered
  TRATADO_BC_STATUS=$($CURL -s "${API}/blockchain/manifiesto/$TRATADO_ID" \
    -H "Authorization: Bearer $TOKEN" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['blockchain'].get('blockchainStatus',''))" 2>/dev/null)

  SHOULD_REGISTER=false
  if [ "$TRATADO_BC_STATUS" != "CONFIRMADO" ]; then
    SHOULD_REGISTER=true
  fi

  if [ "$SHOULD_REGISTER" = "true" ]; then
    # Register on blockchain
    REG_RESP=$($CURL -s -X POST "${API}/blockchain/registrar/$TRATADO_ID" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN")
    REG_SUCCESS=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('success', False))" 2>/dev/null)
    REG_HASH=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('transactionHash',''))" 2>/dev/null)

    if [ "$REG_SUCCESS" = "True" ] || [ "$REG_SUCCESS" = "true" ]; then
      echo -e "  ${GREEN}PASS${NC} Blockchain registration: txHash=${REG_HASH:0:20}..."
      PASS=$((PASS + 1))
    else
      REG_ERR=$(echo "$REG_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error', d.get('message','unknown')))" 2>/dev/null)
      echo -e "  ${RED}FAIL${NC} Blockchain registration failed: $REG_ERR"
      FAIL=$((FAIL + 1))
      ERRORS="$ERRORS\n  FAIL blockchain registration: $REG_ERR"
    fi
  else
    echo -e "  ${YELLOW}SKIP${NC} TRATADO manifest already CONFIRMADO on blockchain"
    SKIP=$((SKIP + 1))
  fi

  # Verify sellos — only when registration succeeded or already confirmed
  if [ "$SHOULD_REGISTER" = "false" ] || [ "$REG_SUCCESS" = "True" ] || [ "$REG_SUCCESS" = "true" ]; then
    VERIFY_RESP=$($CURL -s "${API}/blockchain/manifiesto/$TRATADO_ID" \
      -H "Authorization: Bearer $TOKEN")
    VERIFY_SELLOS=$(echo "$VERIFY_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    bc = d['data'].get('blockchain', {})
    sellos = bc.get('sellos', [])
    print(len(sellos))
except: print('0')
" 2>/dev/null)
    if [ "$VERIFY_SELLOS" -ge 2 ] 2>/dev/null; then
      echo -e "  ${GREEN}PASS${NC} Blockchain sellos count: $VERIFY_SELLOS (GENESIS + CIERRE)"
      PASS=$((PASS + 1))
    else
      echo -e "  ${RED}FAIL${NC} Expected >=2 sellos, got $VERIFY_SELLOS"
      FAIL=$((FAIL + 1))
      ERRORS="$ERRORS\n  FAIL Expected >=2 sellos, got $VERIFY_SELLOS"
    fi
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No TRATADO manifests for blockchain test"
  SKIP=$((SKIP + 1))
fi

# ── Summary ──
echo ""
echo "============================================"
echo "RESULTS"
echo "============================================"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
echo -e "  ${YELLOW}SKIP: $SKIP${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}FAILURES:${NC}"
  echo -e "$ERRORS"
  echo ""
  exit 1
else
  echo -e "${GREEN}ALL BLOCKCHAIN TESTS PASSED${NC}"
  exit 0
fi
