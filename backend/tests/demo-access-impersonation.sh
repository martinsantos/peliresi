#!/usr/bin/env bash
set -uo pipefail

# Read-only demo access contract test. It creates only the refresh-token/audit
# records that are intrinsic to login and impersonation; it never mutates users
# or manifests. Run locally or against the government VM through an SSH tunnel.

BASE_URL="${1:-http://127.0.0.1:3002}"
API="${BASE_URL%/}/api"
PASS=0
FAIL=0

pass() { PASS=$((PASS + 1)); printf 'PASS %s\n' "$1"; }
fail() { FAIL=$((FAIL + 1)); printf 'FAIL %s\n' "$1" >&2; }
info() { printf 'INFO %s\n' "$1"; }

json_field() {
  local expression="$1"
  python3 -c "import json,sys; value=json.load(sys.stdin); print($expression)" 2>/dev/null
}

login() {
  local email="$1" password="$2"
  curl -sS -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}"
}

profile_status() {
  local token="$1"
  curl -sS -o /dev/null -w '%{http_code}' "$API/auth/profile" \
    -H "Authorization: Bearer $token"
}

echo "Target: $API"

ADMIN_RESPONSE="$(login 'admin@dgfa.mendoza.gov.ar' 'admin123')"
ADMIN_TOKEN="$(printf '%s' "$ADMIN_RESPONSE" | json_field "value['data']['tokens']['accessToken']")"
if [ -n "$ADMIN_TOKEN" ]; then pass 'ADMIN login'; else fail 'ADMIN login'; fi

declare -a DEMO_EMAILS=(
  'admin@dgfa.mendoza.gov.ar'
  'quimica.mendoza@industria.com'
  'transportes.andes@logistica.com'
  'tratamiento.residuos@planta.com'
)
declare -a DEMO_PASSWORDS=('admin123' 'gen123' 'trans123' 'op123')
declare -a DEMO_ROLES=('ADMIN' 'GENERADOR' 'TRANSPORTISTA' 'OPERADOR')

for index in "${!DEMO_EMAILS[@]}"; do
  response="$(login "${DEMO_EMAILS[$index]}" "${DEMO_PASSWORDS[$index]}")"
  status="$(printf '%s' "$response" | json_field "value.get('success', False)")"
  role="$(printf '%s' "$response" | json_field "value.get('data', {}).get('user', {}).get('rol', '')")"
  demo="$(printf '%s' "$response" | json_field "value.get('data', {}).get('user', {}).get('esDemo', False)")"
  if [ "$status" = 'True' ] && [ "$role" = "${DEMO_ROLES[$index]}" ]; then
    pass "${DEMO_ROLES[$index]} demo login"
    if [ "$demo" != 'True' ]; then
      info "${DEMO_ROLES[$index]} credentials work but esDemo=${demo}; metadata flag is not enforced by this access test"
    fi
  else
    fail "${DEMO_ROLES[$index]} demo login (role=$role esDemo=$demo)"
  fi
done

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Cannot continue without an ADMIN token." >&2
  exit 1
fi

USERS_RESPONSE="$(curl -sS "$API/admin/usuarios?activo=true&limit=200" -H "Authorization: Bearer $ADMIN_TOKEN")"
USERS_OK="$(printf '%s' "$USERS_RESPONSE" | json_field "value.get('success', False)")"
if [ "$USERS_OK" = 'True' ]; then pass 'ADMIN can list active users'; else fail 'ADMIN can list active users'; fi

# Exercise one active target for each role exposed by the installation. The
# target IDs come from the API, so this also proves the route is not restricted
# to a hardcoded demo/capacitación subset.
TARGET_IDS="$(printf '%s' "$USERS_RESPONSE" | python3 -c "import json,sys; users=json.load(sys.stdin).get('data',{}).get('usuarios',[]); seen=set(); out=[]; admin=next((u.get('id') for u in users if u.get('email')=='admin@dgfa.mendoza.gov.ar'), None); key=lambda role: 'ADMIN' if role and role.startswith('ADMIN') else role; [(out.append(str(u['id'])), seen.add(key(u.get('rol')))) for u in users if u.get('activo') and u.get('id') != admin and key(u.get('rol')) in {'ADMIN','GENERADOR','TRANSPORTISTA','OPERADOR'} and key(u.get('rol')) not in seen]; print('\\n'.join(out))")"

if [ -z "$TARGET_IDS" ]; then
  fail 'at least one active impersonation target'
else
  REFRESH_CHECKS=0
  while IFS= read -r target_id; do
    [ -z "$target_id" ] && continue
    response="$(curl -sS -X POST "$API/admin/impersonate/$target_id" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      --data '{}')"
    target_token="$(printf '%s' "$response" | json_field "value.get('data', {}).get('tokens', {}).get('accessToken', '')")"
    target_refresh="$(printf '%s' "$response" | json_field "value.get('data', {}).get('tokens', {}).get('refreshToken', '')")"
    returned_id="$(printf '%s' "$response" | json_field "value.get('data', {}).get('user', {}).get('id', '')")"
    if [ -n "$target_token" ] && [ -n "$target_refresh" ] && [ "$returned_id" = "$target_id" ] && [ "$(profile_status "$target_token")" = '200' ]; then
      pass "impersonate active user $target_id"
    else
      fail "impersonate active user $target_id"
      continue
    fi

    # The production limiter deliberately allows three refresh attempts per
    # minute per IP. Verify persistence within that budget; all targets above
    # still receive and validate an access+refresh pair.
    if [ "$REFRESH_CHECKS" -lt 3 ]; then
      refresh_response="$(curl -sS -X POST "$API/auth/refresh-token" \
        -H 'Content-Type: application/json' \
        --data "{\"refreshToken\":\"$target_refresh\"}")"
      refreshed="$(printf '%s' "$refresh_response" | json_field "value.get('data', {}).get('accessToken', '')")"
      if [ -n "$refreshed" ]; then
        pass "refresh token persisted for $target_id"
      else
        fail "refresh token persisted for $target_id"
        refresh_status="$(printf '%s' "$refresh_response" | json_field "value.get('statusCode', '')")"
        refresh_message="$(printf '%s' "$refresh_response" | json_field "value.get('message', '')")"
        printf '  refresh diagnostic: status=%s message=%s tokenLength=%s\n' "$refresh_status" "$refresh_message" "${#target_refresh}" >&2
      fi
      REFRESH_CHECKS=$((REFRESH_CHECKS + 1))
    else
      pass "refresh token issued for $target_id (rate-limit budget preserved)"
    fi
  done <<< "$TARGET_IDS"
fi

printf 'RESULT PASS=%s FAIL=%s\n' "$PASS" "$FAIL"
if [ "$FAIL" -gt 0 ]; then exit 1; fi
