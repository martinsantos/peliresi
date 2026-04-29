#!/bin/bash
# ============================================================
# SITREP Master Test Orchestrator
# Ejecuta todas las fases de testing en orden.
# Usage: bash run-all.sh [ambiente] [--stress]
#   ambiente: "demo" (default) o "local"
#   --stress: incluye k6 (solo demo)
# ============================================================

set -euo pipefail

AMBIENTE="${1:-demo}"
STRESS_FLAG="${2:-}"
SCRIPTS_DIR="backend/tests"
REPORT_DIR="test-reports"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')

case "$AMBIENTE" in
  demo)   BASE_URL="https://sitrep.ultimamilla.com.ar" ;;
  local)  BASE_URL="http://localhost:3002" ;;
  *)      echo "Ambiente inválido: $AMBIENTE (demo|local)"; exit 1 ;;
esac

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

mkdir -p "$REPORT_DIR"
REPORT="$REPORT_DIR/test-report-$AMBIENTE-$TIMESTAMP.log"

log() { echo -e "$1" | tee -a "$REPORT"; }
section() { log "\n${BOLD}${CYAN}═══════════════════════════════════════════${NC}"; log "${BOLD}${CYAN}  $1${NC}"; log "${BOLD}${CYAN}═══════════════════════════════════════════${NC}"; }

TOTAL_PASS=0; TOTAL_FAIL=0; PHASE_FAIL=0

run_phase() {
  local phase_name=$1; shift
  log "\n${BOLD}▶ Phase $phase_name${NC}"
  for script in "$@"; do
    if [ ! -f "$script" ]; then
      log "  ${YELLOW}SKIP${NC} $script (not found)"
      continue
    fi
    log "  Running: $script"
    set +e
    bash "$script" "$BASE_URL" 2>&1 | tee -a "$REPORT"
    local exit_code=${PIPESTATUS[0]}
    set -e
    if [ $exit_code -eq 0 ]; then
      log "  ${GREEN}PASS${NC} $script"
    else
      log "  ${RED}FAIL${NC} $script (exit $exit_code)"
      PHASE_FAIL=$((PHASE_FAIL + 1))
    fi
  done
}

# ── FASE 1: Smoke ──────────────────────────────
section "FASE 1: Smoke Tests"
run_phase "1" "$SCRIPTS_DIR/smoke-test.sh"
if [ $PHASE_FAIL -gt 0 ]; then
  log "${RED}SMOKE FAILED — aborting${NC}"
  exit 1
fi

# ── FASE 2: Cruzados ───────────────────────────
section "FASE 2: Cross-Platform Tests"
run_phase "2" \
  "$SCRIPTS_DIR/cross-platform-workflow-test.sh" \
  "$SCRIPTS_DIR/role-enforcement-test.sh" \
  "$SCRIPTS_DIR/edge-cases-test.sh" \
  "$SCRIPTS_DIR/gps-validation-test.sh" \
  "$SCRIPTS_DIR/multiuser-concurrent-test.sh" \
  "$SCRIPTS_DIR/notification-test.sh" \
  "$SCRIPTS_DIR/alerts-comprehensive-test.sh" \
  "$SCRIPTS_DIR/actores-crud-test.sh" \
  "$SCRIPTS_DIR/admin-advanced-test.sh" \
  "$SCRIPTS_DIR/workflow-extended-test.sh" \
  "$SCRIPTS_DIR/blockchain-test.sh" \
  "$SCRIPTS_DIR/push-test.sh" \
  "$SCRIPTS_DIR/search-test.sh" \
  "$SCRIPTS_DIR/solicitudes-test.sh" \
  "$SCRIPTS_DIR/carga-masiva-test.sh" \
  "$SCRIPTS_DIR/reportes-test.sh" \
  "$SCRIPTS_DIR/centro-control-test.sh" \
  "$SCRIPTS_DIR/mensajeria-test.sh"

# ── FASE 3: Unitarios ──────────────────────────
section "FASE 3: Unit Tests"

log "--- Backend ---"
set +e
(cd backend && npx vitest run --config src/__tests__/vitest.config.services.ts 2>&1) | tee -a "$REPORT"
BACKEND_EXIT=${PIPESTATUS[0]}
set -e

log "--- Frontend ---"
set +e
(cd frontend && npx vitest run --config vitest.config.src.ts 2>&1) | tee -a "$REPORT"
FRONTEND_EXIT=${PIPESTATUS[0]}
set -e

if [ $BACKEND_EXIT -ne 0 ] || [ $FRONTEND_EXIT -ne 0 ]; then
  log "${RED}UNIT TESTS FAILED${NC}"
  PHASE_FAIL=$((PHASE_FAIL + 1))
fi

# ── FASE 4: E2E (solo demo) ────────────────────
if [ "$AMBIENTE" = "demo" ]; then
  section "FASE 4: E2E Playwright"
  set +e
  (cd frontend && npx playwright test 2>&1) | tee -a "$REPORT"
  E2E_EXIT=${PIPESTATUS[0]}
  set -e
  if [ $E2E_EXIT -ne 0 ]; then
    PHASE_FAIL=$((PHASE_FAIL + 1))
  fi
fi

# ── FASE 5: War Room ───────────────────────────
if [ "$AMBIENTE" = "demo" ]; then
  section "FASE 5: War Room Monitor"
  bash "$SCRIPTS_DIR/monitor-war-room.sh" "$BASE_URL" 2>&1 | tee -a "$REPORT"
fi

# ── FASE 6: Stress (opcional) ──────────────────
if [ "$AMBIENTE" = "demo" ] && [ "$STRESS_FLAG" = "--stress" ]; then
  section "FASE 6: Stress Tests (k6)"
  bash "$SCRIPTS_DIR/run-all-stress.sh" "$BASE_URL" 2>&1 | tee -a "$REPORT"
fi

# ── Resultado Final ─────────────────────────────
section "FINAL RESULT"
if [ $PHASE_FAIL -gt 0 ]; then
  log "${RED}${BOLD}FAILED — $PHASE_FAIL phase(s) with errors${NC}"
  exit 1
else
  log "${GREEN}${BOLD}ALL TESTS PASSED${NC}"
  exit 0
fi
