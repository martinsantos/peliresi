#!/usr/bin/env bash
# Static configuration checks for certification.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FAIL=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }

check_contains() {
  local file="$1" pattern="$2" label="$3"
  if grep -Eq "$pattern" "$ROOT/$file"; then
    pass "$label"
  else
    fail "$label"
  fi
}

check_absent() {
  local file="$1" pattern="$2" label="$3"
  if grep -Eq "$pattern" "$ROOT/$file"; then
    fail "$label"
  else
    pass "$label"
  fi
}

echo "SITREP configuration certification checks"

check_contains "backend/src/config/config.ts" "PORT \\|\\| '3010'" "backend default port is 3010"
check_contains "backend/.env.example" "PORT=3010" "env example documents port 3010"
check_absent "backend/.env.example" "PORT=3002|PM2 usa 3002" "env example has no stale 3002 guidance"
check_contains "backend/src/config/config.ts" "NODE_ENV === 'production'.*JWT_SECRET" "production rejects default JWT secret"
check_contains "backend/src/index.ts" "helmet\\(" "helmet is enabled"
check_contains "backend/src/index.ts" "rateLimit\\(" "rate limiting is enabled"
check_contains "backend/src/index.ts" "app\\.set\\('trust proxy', 1\\)" "trust proxy enabled behind nginx"
check_contains "backend/src/index.ts" "express\\.json\\(\\{ limit: '10mb' \\}\\)" "request body limit is explicit"
check_contains "backend/src/index.ts" "req\\.setTimeout\\(30000\\)" "request timeout is explicit"
check_contains "backend/src/index.ts" "/api/health/ready" "readiness endpoint exists"
check_contains "backend/src/index.ts" "/api/health/live" "liveness endpoint exists"
check_contains ".gitignore" "reports/test-runs/" "certification reports are ignored"

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "RESULT: PASS"
