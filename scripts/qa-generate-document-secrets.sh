#!/usr/bin/env bash
set -euo pipefail

# Generate QA-only material outside the repository. This script does not
# contact SMTP, deploy code, or alter a database. The operator must source the
# resulting file in the disposable QA service and then run the config gate.
: "${QA_SECRETS_DIR:?Set QA_SECRETS_DIR to a private directory outside the webroot}"
: "${QA_UPLOADS_DIR:?Set QA_UPLOADS_DIR to the private document storage directory}"

case "$QA_SECRETS_DIR" in
  /var/www/*|/var/www/html*) echo "QA blocked: secrets directory is inside webroot" >&2; exit 2 ;;
esac
case "$QA_UPLOADS_DIR" in
  /var/www/*|/var/www/html*) echo "QA blocked: uploads directory is inside webroot" >&2; exit 2 ;;
esac
command -v openssl >/dev/null 2>&1 || command -v node >/dev/null 2>&1 || { echo "QA blocked: openssl or node is required" >&2; exit 2; }
mkdir -p "$QA_SECRETS_DIR" "$QA_UPLOADS_DIR"
chmod 700 "$QA_SECRETS_DIR" "$QA_UPLOADS_DIR"
umask 077

private_key="$QA_SECRETS_DIR/certificate-ed25519-private.pem"
public_key="$QA_SECRETS_DIR/certificate-ed25519-public.pem"
hmac_file="$QA_SECRETS_DIR/document-hmac.secret"
env_file="$QA_SECRETS_DIR/document-qa.env"

if [[ ! -e "$private_key" || ! -e "$public_key" ]]; then
  # LibreSSL on some macOS installations does not expose Ed25519. Node's
  # built-in crypto emits the same PKCS8/SPKI PEM formats used by production.
  if ! openssl genpkey -algorithm Ed25519 -out "$private_key" >/dev/null 2>&1; then
    command -v node >/dev/null 2>&1 || { echo "QA blocked: Ed25519 requires OpenSSL or Node" >&2; exit 2; }
    node -e 'const fs=require("fs"), crypto=require("crypto"); const [privatePath, publicPath]=process.argv.slice(1); const pair=crypto.generateKeyPairSync("ed25519"); fs.writeFileSync(privatePath, pair.privateKey.export({type:"pkcs8",format:"pem"})); fs.writeFileSync(publicPath, pair.publicKey.export({type:"spki",format:"pem"}));' "$private_key" "$public_key"
  else
    openssl pkey -in "$private_key" -pubout -out "$public_key" >/dev/null 2>&1
  fi
fi
if [[ ! -e "$hmac_file" ]]; then
  if ! openssl rand -hex 32 >"$hmac_file" 2>/dev/null; then
    node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))' >"$hmac_file"
  fi
fi
chmod 600 "$private_key" "$public_key" "$hmac_file"

escape_pem() { awk '{ printf "%s\\n", $0 }' "$1"; }
{
  printf 'NODE_ENV=qa\n'
  printf 'DISABLE_EMAILS=true\n'
  printf 'FILE_SCAN_MODE=required\n'
  printf 'CLAMAV_SCAN_CMD="%s"\n' "${CLAMAV_SCAN_CMD:-clamscan --no-summary}"
  printf 'UPLOADS_DIR="%s"\n' "$QA_UPLOADS_DIR"
  printf 'LEGACY_UPLOADS_DIR="%s"\n' "${LEGACY_UPLOADS_DIR:-$QA_UPLOADS_DIR}"
  printf 'DOCUMENT_HMAC_SECRET="%s"\n' "$(tr -d '\n' <"$hmac_file")"
  printf 'CERTIFICATE_ED25519_PRIVATE_KEY="%s"\n' "$(escape_pem "$private_key")"
  printf 'CERTIFICATE_ED25519_PUBLIC_KEY="%s"\n' "$(escape_pem "$public_key")"
  printf 'CERTIFICATE_POLICY_VERSION="%s"\n' "${CERTIFICATE_POLICY_VERSION:-1}"
  printf 'FRONTEND_URL="%s"\n' "${FRONTEND_URL:-https://sitrep.ultimamilla.com.ar}"
} >"$env_file"
chmod 600 "$env_file"
echo "[qa] generated QA key material and private storage configuration at $QA_SECRETS_DIR (values omitted)"
