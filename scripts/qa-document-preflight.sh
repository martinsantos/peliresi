#!/usr/bin/env bash
set -euo pipefail

# Safe QA gate: no migration or deploy occurs unless the operator explicitly
# provides an isolated QA URL and a non-production marker. Secrets are never
# printed. This script only validates connectivity/schema metadata.
: "${QA_DATABASE_URL:?Set QA_DATABASE_URL to an isolated QA PostgreSQL URL}"
: "${QA_CONFIRM_ISOLATED:?Set QA_CONFIRM_ISOLATED=YES after verifying the DB is not production}"
if [[ "$QA_CONFIRM_ISOLATED" != "YES" ]]; then
  echo "QA blocked: QA_CONFIRM_ISOLATED must be YES" >&2; exit 2
fi
if [[ "$QA_DATABASE_URL" == *"sitrep_prod"* || "$QA_DATABASE_URL" == *"trazabilidad_rrpp"* || "$QA_DATABASE_URL" == *"rptrazar"* ]]; then
  echo "QA blocked: URL resembles production database" >&2; exit 2
fi
if [[ "${NODE_ENV:-qa}" == "production" ]]; then
  echo "QA blocked: NODE_ENV=production is not accepted by this preflight" >&2; exit 2
fi

export DATABASE_URL="$QA_DATABASE_URL"
cd "$(dirname "$0")/../backend"
echo "[qa] validating Prisma schema against isolated target"
npx prisma validate
echo "[qa] target accepted; migration is intentionally a separate explicit command"
echo "[qa] next: npx prisma migrate deploy"
