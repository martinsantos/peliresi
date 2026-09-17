#!/usr/bin/env bash
set -euo pipefail

# Configuration-only gate. It never prints secrets, creates keys, starts
# services, or modifies a database. Run it in the isolated QA runtime before
# `prisma migrate deploy` and before the functional E2E suite.
: "${QA_CONFIRM_ISOLATED:?Set QA_CONFIRM_ISOLATED=YES after verifying the database is disposable/isolated}"
[[ "$QA_CONFIRM_ISOLATED" == "YES" ]] || { echo "QA blocked: QA_CONFIRM_ISOLATED must be YES" >&2; exit 2; }
[[ "${NODE_ENV:-qa}" != "production" ]] || { echo "QA blocked: NODE_ENV=production is not accepted" >&2; exit 2; }
[[ "${QA_E2E_ENABLED:-false}" != "true" || "${QA_E2E_CONFIRM:-}" == "YES" ]] || { echo "QA blocked: QA_E2E_CONFIRM=YES is required when E2E is enabled" >&2; exit 2; }
[[ "${DISABLE_EMAILS:-true}" == "true" ]] || { echo "QA blocked: DISABLE_EMAILS must remain true during document tests" >&2; exit 2; }

if [[ -z "${DOCUMENT_HMAC_SECRET:-}" ]]; then echo "QA blocked: set a QA-only DOCUMENT_HMAC_SECRET" >&2; exit 2; fi
[[ "${#DOCUMENT_HMAC_SECRET}" -ge 32 ]] || { echo "QA blocked: DOCUMENT_HMAC_SECRET must be at least 32 characters" >&2; exit 2; }
[[ "$DOCUMENT_HMAC_SECRET" != *CHANGE_ME* && "$DOCUMENT_HMAC_SECRET" != "local-document-hmac-only" ]] || { echo "QA blocked: placeholder HMAC secret" >&2; exit 2; }

if [[ -z "${CERTIFICATE_ED25519_PRIVATE_KEY:-}" || -z "${CERTIFICATE_ED25519_PUBLIC_KEY:-}" ]]; then echo "QA blocked: set the QA Ed25519 key pair" >&2; exit 2; fi
[[ "$CERTIFICATE_ED25519_PRIVATE_KEY" == *"BEGIN PRIVATE KEY"* ]] || { echo "QA blocked: private key is not a PKCS8 PEM" >&2; exit 2; }
[[ "$CERTIFICATE_ED25519_PUBLIC_KEY" == *"BEGIN PUBLIC KEY"* ]] || { echo "QA blocked: public key is not an SPKI PEM" >&2; exit 2; }

[[ "${FILE_SCAN_MODE:-required}" == "required" ]] || { echo "QA blocked: FILE_SCAN_MODE must be required" >&2; exit 2; }
scan_cmd="${CLAMAV_SCAN_CMD:-clamscan --no-summary}"
scan_bin="${scan_cmd%% *}"
command -v "$scan_bin" >/dev/null 2>&1 || { echo "QA blocked: ClamAV command not found" >&2; exit 2; }

uploads_dir="${UPLOADS_DIR:-/var/lib/sitrep-uploads}"
[[ "$uploads_dir" != /var/www/sitrep* && "$uploads_dir" != /var/www/html* ]] || { echo "QA blocked: uploads must be outside the webroot" >&2; exit 2; }
[[ -d "$uploads_dir" && -w "$uploads_dir" ]] || { echo "QA blocked: UPLOADS_DIR must exist and be writable by the service user" >&2; exit 2; }

echo "[qa] document secrets, ClamAV, private storage, no-SMTP and E2E gates: OK"
