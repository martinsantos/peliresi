#!/usr/bin/env bash
# Backup/restore drill gate. It is intentionally disabled unless a temporary
# restore target is explicitly configured.

set -uo pipefail

FAIL=0

pass() { echo "PASS $1"; }
fail() { echo "FAIL $1"; FAIL=$((FAIL + 1)); }
skip() { echo "SKIP $1"; }

echo "SITREP backup/restore drill"

if [ "${ALLOW_RESTORE_DRILL:-false}" != "true" ]; then
  skip "ALLOW_RESTORE_DRILL is not true"
  echo "RESULT: SKIP"
  exit 0
fi

if [ -z "${STAGING_SNAPSHOT_COMMAND:-}" ]; then
  fail "STAGING_SNAPSHOT_COMMAND is required"
fi

if [ -z "${RESTORE_TEST_DATABASE_URL:-}" ]; then
  fail "RESTORE_TEST_DATABASE_URL is required"
fi

if [ -z "${STAGING_RESTORE_COMMAND:-}" ]; then
  fail "STAGING_RESTORE_COMMAND is required and must target RESTORE_TEST_DATABASE_URL"
fi

if [ "$FAIL" -gt 0 ]; then
  echo "RESULT: FAIL ($FAIL)"
  exit 1
fi

echo "[1/3] Snapshot"
bash -lc "$STAGING_SNAPSHOT_COMMAND"
pass "snapshot command completed"

echo "[2/3] Restore into temporary target"
RESTORE_TEST_DATABASE_URL="$RESTORE_TEST_DATABASE_URL" bash -lc "$STAGING_RESTORE_COMMAND"
pass "restore command completed"

echo "[3/3] Optional restore verification"
if [ -n "${RESTORE_VERIFY_COMMAND:-}" ]; then
  RESTORE_TEST_DATABASE_URL="$RESTORE_TEST_DATABASE_URL" bash -lc "$RESTORE_VERIFY_COMMAND"
  pass "restore verify command completed"
else
  skip "RESTORE_VERIFY_COMMAND not configured"
fi

echo "RESULT: PASS"
