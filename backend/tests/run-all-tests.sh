#!/bin/bash
# ============================================================
# SITREP Master Test Runner
# Executes all test scripts and aggregates results.
# Usage: bash backend/tests/run-all-tests.sh [BASE_URL] [full|safe|effectful]
# Default: https://rptrazar.mendoza.gov.ar full
# ============================================================

BASE_URL="${1:-https://rptrazar.mendoza.gov.ar}"
if [[ "${BASE_URL%/}" == */api ]]; then
  API_URL="${BASE_URL%/}"
  BASE_URL="${BASE_URL%/api}"
else
  API_URL="${BASE_URL%/}/api"
fi
RUN_PROFILE="${SITREP_TEST_PROFILE:-${2:-full}}"
SCRIPTS_DIR="$(cd "$(dirname "$0")" && pwd)"
SUITE_PAUSE_SECONDS="${SITREP_SUITE_PAUSE_SECONDS:-65}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

TOTAL_PASS=0
TOTAL_FAIL=0
SUITE_RESULTS=()

SAFE_SCRIPTS=(
  "smoke-test.sh"
  "production-mode-test.sh"
  "role-enforcement-test.sh"
  "search-safety-test.sh"
)

EFFECTFUL_SCRIPTS=(
  "cross-platform-workflow-test.sh"
  "edge-cases-test.sh"
  "gps-validation-test.sh"
  "multiuser-concurrent-test.sh"
  "notification-test.sh"
  "alerts-comprehensive-test.sh"
  "actores-crud-test.sh"
  "admin-advanced-test.sh"
  "workflow-extended-test.sh"
)

FULL_SCRIPTS=(
  "smoke-test.sh"
  "production-mode-test.sh"
  "cross-platform-workflow-test.sh"
  "role-enforcement-test.sh"
  "search-safety-test.sh"
  "edge-cases-test.sh"
  "gps-validation-test.sh"
  "multiuser-concurrent-test.sh"
  "notification-test.sh"
  "alerts-comprehensive-test.sh"
  "actores-crud-test.sh"
  "admin-advanced-test.sh"
  "workflow-extended-test.sh"
)

case "$RUN_PROFILE" in
  full|all)
    SCRIPTS=("${FULL_SCRIPTS[@]}")
    ;;
  safe|production-safe|produccion-seguro)
    SCRIPTS=("${SAFE_SCRIPTS[@]}")
    ;;
  effectful|destructive|destructivo)
    SCRIPTS=("${EFFECTFUL_SCRIPTS[@]}")
    ;;
  *)
    echo "Unknown test profile: $RUN_PROFILE" >&2
    echo "Allowed profiles: full, safe, effectful" >&2
    exit 2
    ;;
esac

api_base_for_script() {
  case "$1" in
    production-mode-test.sh|multiuser-concurrent-test.sh|notification-test.sh)
      echo "$API_URL"
      ;;
    *)
      echo "$BASE_URL"
      ;;
  esac
}

integer_or_zero() {
  local value="$1"
  value=$(echo "$value" | tr -cd '0-9' | head -c 12)
  if [ -n "$value" ]; then echo "$value"; else echo "0"; fi
}

echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     SITREP — MASTER TEST RUNNER                      ║${NC}"
echo -e "${BOLD}${CYAN}║     Target: $BASE_URL${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Scripts dir: $SCRIPTS_DIR"
echo "Profile: $RUN_PROFILE"
echo "Inter-suite pause: ${SUITE_PAUSE_SECONDS}s"
echo ""

for SCRIPT in "${SCRIPTS[@]}"; do
  SCRIPT_PATH="$SCRIPTS_DIR/$SCRIPT"

  if [ ! -f "$SCRIPT_PATH" ]; then
    echo -e "${YELLOW}SKIP${NC} $SCRIPT (file not found)"
    SUITE_RESULTS+=("SKIP|$SCRIPT|0|0")
    continue
  fi

  echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BOLD}Running: $SCRIPT${NC}"
  SCRIPT_BASE="$(api_base_for_script "$SCRIPT")"
  echo -e "Base: $SCRIPT_BASE"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

  # Run the script and capture output + exit code
  OUTPUT=$(bash "$SCRIPT_PATH" "$SCRIPT_BASE" 2>&1)
  EXIT_CODE=$?

  echo "$OUTPUT"

  # Extract PASS/FAIL counts from output
  PASS_COUNT=$(echo "$OUTPUT" | grep -oE 'PASS[: ]+[0-9]+' | tail -1 | grep -oE '[0-9]+' | head -1 || echo "0")
  FAIL_COUNT=$(echo "$OUTPUT" | grep -oE 'FAIL[: ]+[0-9]+' | tail -1 | grep -oE '[0-9]+' | head -1 || echo "0")

  # Fallback: count individual PASS/FAIL lines
  if [ -z "$PASS_COUNT" ] || [ "$PASS_COUNT" = "0" ]; then
    PASS_COUNT=$(echo "$OUTPUT" | grep -c '✓\|PASS\b' 2>/dev/null || true)
  fi
  PASS_COUNT=$(integer_or_zero "$PASS_COUNT")
  FAIL_COUNT=$(integer_or_zero "$FAIL_COUNT")

  TOTAL_PASS=$((TOTAL_PASS + PASS_COUNT))
  TOTAL_FAIL=$((TOTAL_FAIL + FAIL_COUNT))

  if [ "$EXIT_CODE" -eq 0 ]; then
    SUITE_RESULTS+=("PASS|$SCRIPT|$PASS_COUNT|$FAIL_COUNT")
    echo -e "\n${GREEN}✓ $SCRIPT: PASSED ($PASS_COUNT pass, $FAIL_COUNT fail)${NC}"
  else
    SUITE_RESULTS+=("FAIL|$SCRIPT|$PASS_COUNT|$FAIL_COUNT")
    echo -e "\n${RED}✗ $SCRIPT: FAILED ($PASS_COUNT pass, $FAIL_COUNT fail)${NC}"
  fi
  echo ""

  if [ "$SCRIPT" != "${SCRIPTS[${#SCRIPTS[@]}-1]}" ] && [ "$SUITE_PAUSE_SECONDS" -gt 0 ]; then
    echo -e "${YELLOW}Waiting ${SUITE_PAUSE_SECONDS}s to avoid auth rate limiting...${NC}"
    sleep "$SUITE_PAUSE_SECONDS"
    echo ""
  fi
done

# ── FINAL SUMMARY ────────────────────────────────────────────
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${CYAN}║     FINAL RESULTS SUMMARY                            ║${NC}"
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

SUITES_PASSED=0
SUITES_FAILED=0
SUITES_SKIPPED=0

for RESULT in "${SUITE_RESULTS[@]}"; do
  STATUS=$(echo "$RESULT" | cut -d'|' -f1)
  NAME=$(echo "$RESULT" | cut -d'|' -f2)
  P=$(echo "$RESULT" | cut -d'|' -f3)
  F=$(echo "$RESULT" | cut -d'|' -f4)

  # Pad name to fixed width
  PADDED=$(printf "%-40s" "$NAME")

  case "$STATUS" in
    PASS)
      echo -e "  ${GREEN}✓${NC} $PADDED ${GREEN}$P pass${NC}"
      SUITES_PASSED=$((SUITES_PASSED + 1))
      ;;
    FAIL)
      echo -e "  ${RED}✗${NC} $PADDED ${RED}$P pass, $F fail${NC}"
      SUITES_FAILED=$((SUITES_FAILED + 1))
      ;;
    SKIP)
      echo -e "  ${YELLOW}–${NC} $PADDED ${YELLOW}(skipped)${NC}"
      SUITES_SKIPPED=$((SUITES_SKIPPED + 1))
      ;;
  esac
done

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "  Suites:  ${GREEN}$SUITES_PASSED passed${NC}  /  ${RED}$SUITES_FAILED failed${NC}  /  ${YELLOW}$SUITES_SKIPPED skipped${NC}"
echo -e "  Tests:   ${GREEN}~$TOTAL_PASS PASS${NC}  /  ${RED}~$TOTAL_FAIL FAIL${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""

if [ "$SUITES_FAILED" -gt 0 ]; then
  echo -e "${RED}${BOLD}RESULT: FAILED — $SUITES_FAILED suite(s) with errors${NC}"
  exit 1
else
  echo -e "${GREEN}${BOLD}RESULT: ALL SUITES PASSED${NC}"
  exit 0
fi
