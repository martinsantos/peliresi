#!/usr/bin/env bash
# ================================================================
# SITREP — Certification Test Suite Runner
#
# Profiles:
#   quick             Local/CI fast validation.
#   post-deploy       Remote smoke validation after deploy.
#   production-smoke  Non-destructive production/VPN validation.
#   certification     Full staging certification matrix.
#
# The runner is non-destructive by default. Autocorrections and staging
# destructive checks must be explicitly enabled via environment variables.
# ================================================================

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RUN_PROFILE="${RUN_PROFILE:-${1:-quick}}"
TARGET_URL="${TARGET_URL:-https://sitrep.ultimamilla.com.ar}"
TARGET_URL="${TARGET_URL%/}"
API_URL="${API_URL:-$TARGET_URL/api}"
API_URL="${API_URL%/}"
REPORT_ROOT="${REPORT_DIR:-$ROOT/reports/test-runs}"
RUN_ID="${RUN_ID:-$(date +%Y%m%d-%H%M%S)}"
RUN_DIR="$REPORT_ROOT/$RUN_ID"
RESULTS_TSV="$RUN_DIR/results.tsv"
SUMMARY_MD="$RUN_DIR/summary.md"
SUMMARY_JSON="$RUN_DIR/summary.json"

ALLOW_AUTOFIX="${ALLOW_AUTOFIX:-false}"
ALLOW_DESTRUCTIVE_STAGING="${ALLOW_DESTRUCTIVE_STAGING:-false}"
STAGING_SNAPSHOT_COMMAND="${STAGING_SNAPSHOT_COMMAND:-}"
STAGING_RESTORE_COMMAND="${STAGING_RESTORE_COMMAND:-}"
PLAYWRIGHT_PROJECT="${PLAYWRIGHT_PROJECT:-chromium}"
SOAK_SECONDS="${SOAK_SECONDS:-1800}"
NETWORK_RETRIES="${NETWORK_RETRIES:-2}"
NETWORK_TIMEOUT="${NETWORK_TIMEOUT:-10}"
OFFLINE_SKIP_AUDIT="${OFFLINE_SKIP_AUDIT:-false}"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
SKIP_COUNT=0

mkdir -p "$RUN_DIR"
printf "suite\tname\tseverity\tstatus\tduration_s\tlog\tcommand\tcategory\n" > "$RESULTS_TSV"

slugify() {
  printf "%s" "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-//; s/-$//'
}

is_true() {
  case "${1:-}" in
    true|TRUE|1|yes|YES|si|SI) return 0 ;;
    *) return 1 ;;
  esac
}

json_escape() {
  python3 -c 'import json,sys; print(json.dumps(sys.stdin.read())[1:-1])'
}

strict_network_required() {
  [ "$RUN_PROFILE" = "certification" ] || [ "$RUN_PROFILE" = "post-deploy" ] || [ "$RUN_PROFILE" = "production-smoke" ] || is_true "${GITHUB_ACTIONS:-false}"
}

host_from_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
print(urlparse(sys.argv[1]).hostname or sys.argv[1])
PY
}

network_check() {
  local suite="$1" name="$2" target="$3" severity="$4"
  local slug log start end duration exit_code host command
  slug="$(slugify "$suite-$name")"
  log="$RUN_DIR/$slug.log"
  host="$(host_from_url "$target")"
  command="resolve $host and GET $target"
  start="$(date +%s)"

  echo "[$suite] $name"
  echo "COMMAND: $command" > "$log"
  echo "" >> "$log"

  python3 - "$host" >> "$log" 2>&1 <<'PY'
import socket
import sys
host = sys.argv[1]
print(socket.gethostbyname(host))
PY
  exit_code=$?

  if [ "$exit_code" -eq 0 ]; then
    curl -fsS --max-time "$NETWORK_TIMEOUT" --retry "$NETWORK_RETRIES" "$target" >/dev/null 2>> "$log"
    exit_code=$?
  fi

  end="$(date +%s)"
  duration=$((end - start))

  if [ "$exit_code" -eq 0 ]; then
    echo "  PASS (${duration}s)"
    record_result "$suite" "$name" "$severity" "PASS" "$duration" "$log" "$command" "ENVIRONMENT_CHECK"
    return 0
  fi

  if strict_network_required; then
    echo "  FAIL (${duration}s, environment/network)"
    record_result "$suite" "$name" "$severity" "FAIL" "$duration" "$log" "$command" "ENVIRONMENT_FAILURE"
    return 1
  fi

  echo "  WARN (${duration}s, environment/network)"
  record_result "$suite" "$name" "$severity" "WARN" "$duration" "$log" "$command" "ENVIRONMENT_FAILURE"
  return 0
}

record_result() {
  local suite="$1" name="$2" severity="$3" status="$4" duration="$5" log="$6" command="$7" category="${8:-APP_FAILURE}"
  printf "%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n" "$suite" "$name" "$severity" "$status" "$duration" "$log" "$command" "$category" >> "$RESULTS_TSV"
  case "$status" in
    PASS) PASS_COUNT=$((PASS_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    SKIP) SKIP_COUNT=$((SKIP_COUNT + 1)) ;;
    *) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  esac
}

run_step() {
  local suite="$1" name="$2" severity="$3" command="$4"
  local slug log start end duration exit_code
  slug="$(slugify "$suite-$name")"
  log="$RUN_DIR/$slug.log"
  start="$(date +%s)"

  echo "[$suite] $name"
  echo "COMMAND: $command" > "$log"
  echo "" >> "$log"

  (cd "$ROOT" && bash -lc "$command") >> "$log" 2>&1
  exit_code=$?
  end="$(date +%s)"
  duration=$((end - start))

  if [ "$exit_code" -eq 0 ]; then
    echo "  PASS (${duration}s)"
    record_result "$suite" "$name" "$severity" "PASS" "$duration" "$log" "$command" "APP_CHECK"
    return 0
  fi

  if [ "$severity" = "WARN" ] || [ "$severity" = "MEDIUM" ] || [ "$severity" = "LOW" ]; then
    echo "  WARN (${duration}s, exit $exit_code)"
    record_result "$suite" "$name" "$severity" "WARN" "$duration" "$log" "$command" "APP_FAILURE"
    return 0
  fi

  echo "  FAIL (${duration}s, exit $exit_code)"
  record_result "$suite" "$name" "$severity" "FAIL" "$duration" "$log" "$command" "APP_FAILURE"
  return 1
}

run_skip() {
  local suite="$1" name="$2" severity="$3" reason="$4"
  local slug log
  slug="$(slugify "$suite-$name")"
  log="$RUN_DIR/$slug.log"
  printf "%s\n" "$reason" > "$log"
  echo "[$suite] $name"
  echo "  SKIP - $reason"
  record_result "$suite" "$name" "$severity" "SKIP" "0" "$log" "$reason" "SKIPPED_BY_POLICY"
}

run_autofix_step() {
  local suite="$1" name="$2" severity="$3" check_command="$4" fix_command="$5"
  local slug log start end duration exit_code

  slug="$(slugify "$suite-$name")"
  log="$RUN_DIR/$slug.log"
  start="$(date +%s)"

  echo "[$suite] $name"
  echo "COMMAND: $check_command" > "$log"
  echo "" >> "$log"

  (cd "$ROOT" && bash -lc "$check_command") >> "$log" 2>&1
  exit_code=$?
  end="$(date +%s)"
  duration=$((end - start))

  if [ "$exit_code" -eq 0 ]; then
    echo "  PASS (${duration}s)"
    record_result "$suite" "$name" "$severity" "PASS" "$duration" "$log" "$check_command" "APP_CHECK"
    return 0
  fi

  if ! is_true "$ALLOW_AUTOFIX"; then
    if [ "$severity" = "WARN" ] || [ "$severity" = "MEDIUM" ] || [ "$severity" = "LOW" ]; then
      echo "  WARN (${duration}s, exit $exit_code)"
      record_result "$suite" "$name" "$severity" "WARN" "$duration" "$log" "$check_command" "APP_FAILURE"
      return 0
    fi

    echo "  FAIL (${duration}s, exit $exit_code)"
    record_result "$suite" "$name" "$severity" "FAIL" "$duration" "$log" "$check_command" "APP_FAILURE"
    return 1
  fi

  echo "  WARN (${duration}s, exit $exit_code; attempting autofix)"
  record_result "$suite" "$name before autofix" "WARN" "WARN" "$duration" "$log" "$check_command" "APP_FAILURE"
  run_step "$suite" "$name autofix" "WARN" "$fix_command"
  run_step "$suite" "$name after autofix" "$severity" "$check_command"
}

npm_audit_step() {
  local package_dir="$1" name="$2"
  local suite="static" severity="MEDIUM" slug log start end duration exit_code command
  slug="$(slugify "$suite-$name")"
  log="$RUN_DIR/$slug.log"
  command="cd $package_dir && npm audit --audit-level=high"
  start="$(date +%s)"

  echo "[$suite] $name"
  echo "COMMAND: $command" > "$log"
  echo "" >> "$log"

  (cd "$ROOT" && bash -lc "$command") >> "$log" 2>&1
  exit_code=$?
  end="$(date +%s)"
  duration=$((end - start))

  if [ "$exit_code" -eq 0 ]; then
    echo "  PASS (${duration}s)"
    record_result "$suite" "$name" "$severity" "PASS" "$duration" "$log" "$command" "DEPENDENCY_CHECK"
    return 0
  fi

  if grep -Eqi 'ENOTFOUND|EAI_AGAIN|audit endpoint returned an error|network|timeout|registry.npmjs.org' "$log"; then
    if is_true "$OFFLINE_SKIP_AUDIT" && ! strict_network_required; then
      echo "  SKIP (${duration}s, npm registry unavailable)"
      record_result "$suite" "$name" "$severity" "SKIP" "$duration" "$log" "$command" "ENVIRONMENT_FAILURE"
      return 0
    fi

    if strict_network_required; then
      echo "  FAIL (${duration}s, npm registry unavailable)"
      record_result "$suite" "$name" "HIGH" "FAIL" "$duration" "$log" "$command" "ENVIRONMENT_FAILURE"
      return 1
    fi

    echo "  WARN (${duration}s, npm registry unavailable)"
    record_result "$suite" "$name" "$severity" "WARN" "$duration" "$log" "$command" "ENVIRONMENT_FAILURE"
    return 0
  fi

  if [ "$package_dir" = "backend" ] \
    && grep -q 'nodemailer' "$log" \
    && grep -q 'uuid' "$log" \
    && grep -q 'xlsx' "$log" \
    && grep -q '3 vulnerabilities' "$log"; then
    echo "  WARN (${duration}s, known dependency exceptions)"
    record_result "$suite" "$name" "$severity" "WARN" "$duration" "$log" "$command" "KNOWN_EXCEPTION"
    return 0
  fi

  if is_true "$ALLOW_AUTOFIX"; then
    echo "  WARN (${duration}s, attempting npm audit fix)"
    record_result "$suite" "$name before autofix" "WARN" "WARN" "$duration" "$log" "$command" "DEPENDENCY_RISK"
    run_step "$suite" "$name autofix" "WARN" "cd $package_dir && npm audit fix"
    npm_audit_step "$package_dir" "$name after autofix"
    return $?
  fi

  echo "  WARN (${duration}s, dependency risk)"
  record_result "$suite" "$name" "$severity" "WARN" "$duration" "$log" "$command" "DEPENDENCY_RISK"
  return 0
}

snapshot_staging() {
  if [ "$RUN_PROFILE" != "certification" ]; then
    return 0
  fi

  if ! is_true "$ALLOW_DESTRUCTIVE_STAGING"; then
    run_skip "ops-recovery" "staging snapshot" "HIGH" "ALLOW_DESTRUCTIVE_STAGING=false; destructive certification phases are skipped"
    return 0
  fi

  if [ -z "$STAGING_SNAPSHOT_COMMAND" ]; then
    run_skip "ops-recovery" "staging snapshot" "HIGH" "STAGING_SNAPSHOT_COMMAND is not configured"
    return 0
  fi

  run_step "ops-recovery" "staging snapshot" "BLOCKER" "$STAGING_SNAPSHOT_COMMAND"
}

restore_staging() {
  if [ "$RUN_PROFILE" != "certification" ]; then
    return 0
  fi

  if ! is_true "$ALLOW_DESTRUCTIVE_STAGING"; then
    return 0
  fi

  if [ -z "$STAGING_RESTORE_COMMAND" ]; then
    run_skip "ops-recovery" "staging restore" "HIGH" "STAGING_RESTORE_COMMAND is not configured"
    return 0
  fi

  run_step "ops-recovery" "staging restore" "BLOCKER" "$STAGING_RESTORE_COMMAND"
}

static_suite() {
  run_autofix_step "static" "backend dependencies" "BLOCKER" \
    "cd backend && npm ci" \
    "cd backend && rm -rf node_modules && npm ci"
  run_autofix_step "static" "frontend dependencies" "BLOCKER" \
    "cd frontend && npm ci" \
    "cd frontend && rm -rf node_modules && npm ci"
  run_autofix_step "static" "blockchain dependencies" "BLOCKER" \
    "cd blockchain && npm ci" \
    "cd blockchain && rm -rf node_modules && npm ci"

  run_step "static" "backend typecheck" "BLOCKER" "cd backend && npx tsc --noEmit"
  run_step "static" "backend unit tests" "BLOCKER" "cd backend && npm test"
  run_step "static" "backend coverage" "HIGH" "cd backend && npm run test:coverage"
  run_step "static" "backend build" "BLOCKER" "cd backend && npm run build"
  npm_audit_step "backend" "backend audit high"

  run_step "static" "frontend lint" "HIGH" "cd frontend && npm run lint -- --quiet"
  run_step "static" "frontend unit tests" "BLOCKER" "cd frontend && npm test"
  run_step "static" "frontend coverage" "HIGH" "cd frontend && npm run test:coverage"
  run_step "static" "frontend build" "BLOCKER" "cd frontend && npm run build"
  npm_audit_step "frontend" "frontend audit high"

  run_step "static" "blockchain compile" "HIGH" "cd blockchain && npm run compile"
}

api_regression_suite() {
  run_step "api-regression" "health" "BLOCKER" "curl -fsS '$TARGET_URL/api/health' | grep -q '\"status\":\"ok\"'"
  run_step "api-regression" "smoke" "BLOCKER" "bash backend/tests/smoke-test.sh '$TARGET_URL'"
  run_step "api-regression" "role enforcement" "BLOCKER" "bash backend/tests/role-enforcement-test.sh '$TARGET_URL'"
  run_step "api-regression" "search safety" "HIGH" "bash backend/tests/search-safety-test.sh '$TARGET_URL'"
  run_step "api-regression" "pagination stress" "HIGH" "bash backend/tests/pagination-stress-test.sh '$TARGET_URL'"
  run_step "api-regression" "sort stress" "HIGH" "bash backend/tests/sort-stress-test.sh '$TARGET_URL'"
  run_step "api-regression" "date validation stress" "HIGH" "bash backend/tests/date-validation-stress-test.sh '$TARGET_URL'"
}

workflow_suite() {
  run_step "workflow-e2e" "cross platform workflow" "BLOCKER" "bash backend/tests/cross-platform-workflow-test.sh '$TARGET_URL'"
  run_step "workflow-e2e" "extended workflow" "HIGH" "bash backend/tests/workflow-extended-test.sh '$TARGET_URL'"
  run_step "workflow-e2e" "multirol integral" "HIGH" "bash backend/tests/integral-multirol-test.sh '$TARGET_URL'"
  run_step "workflow-e2e" "pdf and blockchain" "HIGH" "bash backend/tests/blockchain-test.sh '$TARGET_URL'"
}

security_suite() {
  run_step "security" "production mode" "HIGH" "bash backend/tests/production-mode-test.sh '$TARGET_URL'"
  run_step "security" "edge cases" "HIGH" "bash backend/tests/edge-cases-test.sh '$API_URL'"
  run_step "security" "actor ownership data" "HIGH" "python3 backend/tests/verify-actor-data.py --api '$TARGET_URL'"
}

data_integrity_suite() {
  run_step "data-integrity" "actores crud" "HIGH" "bash backend/tests/actores-crud-test.sh '$TARGET_URL'"
  run_step "data-integrity" "admin advanced" "HIGH" "bash backend/tests/admin-advanced-test.sh '$TARGET_URL'"
  run_step "data-integrity" "notifications" "MEDIUM" "bash backend/tests/notification-test.sh '$TARGET_URL'"
  run_step "data-integrity" "alerts" "MEDIUM" "bash backend/tests/alerts-comprehensive-test.sh '$TARGET_URL'"
}

frontend_e2e_suite() {
  run_step "frontend-e2e" "playwright chromium" "HIGH" \
    "cd frontend && PLAYWRIGHT_BASE_URL='$TARGET_URL' npx playwright test --project='$PLAYWRIGHT_PROJECT' --reporter=list"
}

ops_recovery_suite() {
  run_step "ops-recovery" "migration verify" "HIGH" "bash scripts/migration/migration-verify.sh '$TARGET_URL'"

  if is_true "$ALLOW_DESTRUCTIVE_STAGING"; then
    restore_staging
  else
    run_skip "ops-recovery" "restore drill" "HIGH" "restore drill requires ALLOW_DESTRUCTIVE_STAGING=true"
  fi
}

stress_suite() {
  run_step "stress" "multiuser concurrent" "HIGH" "bash backend/tests/multiuser-concurrent-test.sh '$API_URL'"
  run_step "stress" "pagination deep" "HIGH" "bash backend/tests/pagination-stress-test.sh '$TARGET_URL'"
  run_step "stress" "sort concurrent" "HIGH" "bash backend/tests/sort-stress-test.sh '$TARGET_URL'"

  if is_true "$ALLOW_DESTRUCTIVE_STAGING"; then
    run_step "stress" "real world stress" "HIGH" "bash backend/tests/mundo-real-stress-test.sh '$TARGET_URL'"
    run_step "stress" "massive concurrent stress" "HIGH" "bash backend/tests/massive-concurrent-stress-test.sh '$TARGET_URL'"
  else
    run_skip "stress" "real world stress" "HIGH" "requires ALLOW_DESTRUCTIVE_STAGING=true because it creates real TEST data"
    run_skip "stress" "massive concurrent stress" "HIGH" "requires ALLOW_DESTRUCTIVE_STAGING=true because it creates real TEST data"
  fi

  run_step "stress" "soak short health" "MEDIUM" \
    "end=\$((SECONDS+$SOAK_SECONDS)); while [ \$SECONDS -lt \$end ]; do curl -fsS '$TARGET_URL/api/health' >/dev/null || exit 1; sleep 10; done"
}

production_smoke_suite() {
  run_step "production-smoke" "health" "BLOCKER" "curl -fsS '$TARGET_URL/api/health' | grep -q '\"status\":\"ok\"'"
  run_step "production-smoke" "smoke" "BLOCKER" "bash backend/tests/smoke-test.sh '$TARGET_URL'"
  run_step "production-smoke" "role enforcement" "BLOCKER" "bash backend/tests/role-enforcement-test.sh '$TARGET_URL'"
  run_step "production-smoke" "search safety" "HIGH" "bash backend/tests/search-safety-test.sh '$TARGET_URL'"
}

preflight_suite() {
  if [ "$RUN_PROFILE" = "quick" ]; then
    network_check "preflight" "npm registry" "https://registry.npmjs.org/-/ping" "MEDIUM"
    return 0
  fi

  network_check "preflight" "target health reachability" "$TARGET_URL/api/health" "BLOCKER"
  network_check "preflight" "npm registry" "https://registry.npmjs.org/-/ping" "MEDIUM"
}

write_summary() {
  local branch commit started
  branch="$(git -C "$ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
  commit="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || true)"
  started="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

  python3 "$SCRIPT_DIR/write-summary.py" \
    "$RESULTS_TSV" \
    "$SUMMARY_MD" \
    "$SUMMARY_JSON" \
    "$RUN_PROFILE" \
    "$TARGET_URL" \
    "$API_URL" \
    "$branch" \
    "$commit" \
    "$started"
}

main() {
  echo "SITREP certification runner"
  echo "Profile: $RUN_PROFILE"
  echo "Target:  $TARGET_URL"
  echo "API:     $API_URL"
  echo "Report:  $RUN_DIR"
  echo ""

  preflight_suite

  case "$RUN_PROFILE" in
    quick)
      static_suite
      ;;
    post-deploy)
      api_regression_suite
      frontend_e2e_suite
      ;;
    production-smoke)
      production_smoke_suite
      ;;
    certification)
      snapshot_staging
      static_suite
      api_regression_suite
      workflow_suite
      security_suite
      data_integrity_suite
      frontend_e2e_suite
      ops_recovery_suite
      stress_suite
      ;;
    *)
      echo "Unknown RUN_PROFILE: $RUN_PROFILE" >&2
      exit 2
      ;;
  esac

  write_summary

  echo ""
  echo "Summary:"
  echo "  PASS: $PASS_COUNT"
  echo "  WARN: $WARN_COUNT"
  echo "  SKIP: $SKIP_COUNT"
  echo "  FAIL: $FAIL_COUNT"
  echo "  Markdown: $SUMMARY_MD"
  echo "  JSON: $SUMMARY_JSON"

  if awk -F '\t' 'NR > 1 && $4 == "FAIL" && ($3 == "BLOCKER" || $3 == "HIGH") { found = 1 } END { exit found ? 0 : 1 }' "$RESULTS_TSV"; then
    exit 1
  fi
}

main "$@"
