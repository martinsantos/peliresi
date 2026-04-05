#!/usr/bin/env bash
# ================================================================
# SITREP — Complete Test Suite Runner
# Runs: Vitest (frontend + backend) + Playwright E2E + Bash smoke
# ================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(dirname "$SCRIPT_DIR")"
PASSED=0
FAILED=0
SKIPPED=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

header() { echo -e "\n${GREEN}═══════════════════════════════════════${NC}"; echo -e "${GREEN}  $1${NC}"; echo -e "${GREEN}═══════════════════════════════════════${NC}\n"; }
pass() { echo -e "${GREEN}✅ $1${NC}"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}❌ $1${NC}"; FAILED=$((FAILED + 1)); }
skip() { echo -e "${YELLOW}⏭️  $1${NC}"; SKIPPED=$((SKIPPED + 1)); }

# ── 1. Backend Vitest ──
header "Backend Unit Tests (Vitest)"
if cd "$ROOT/backend" && npx vitest run --reporter=verbose 2>&1; then
  pass "Backend Vitest"
else
  fail "Backend Vitest"
fi

# ── 2. Frontend Vitest ──
header "Frontend Unit Tests (Vitest)"
if cd "$ROOT/frontend" && npx vitest run --reporter=verbose 2>&1; then
  pass "Frontend Vitest"
else
  fail "Frontend Vitest"
fi

# ── 3. Playwright E2E ──
header "E2E Tests (Playwright)"
if [ -n "${SKIP_E2E:-}" ]; then
  skip "Playwright E2E (SKIP_E2E set)"
elif cd "$ROOT/frontend" && npx playwright test --reporter=list 2>&1; then
  pass "Playwright E2E"
else
  fail "Playwright E2E"
fi

# ── 4. Bash Smoke Tests ──
header "API Smoke Tests (Bash)"
SMOKE="$ROOT/backend/tests/smoke-test.sh"
if [ -f "$SMOKE" ]; then
  if bash "$SMOKE" 2>&1; then
    pass "Bash Smoke Tests"
  else
    fail "Bash Smoke Tests"
  fi
else
  skip "Bash Smoke Tests (smoke-test.sh not found)"
fi

# ── Summary ──
header "Test Suite Summary"
echo -e "  ${GREEN}Passed:  $PASSED${NC}"
echo -e "  ${RED}Failed:  $FAILED${NC}"
echo -e "  ${YELLOW}Skipped: $SKIPPED${NC}"
echo ""

if [ "$FAILED" -gt 0 ]; then
  echo -e "${RED}❌ TEST SUITE FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}✅ ALL TESTS PASSED${NC}"
  exit 0
fi
