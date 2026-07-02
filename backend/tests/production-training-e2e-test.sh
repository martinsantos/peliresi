#!/usr/bin/env bash
# ================================================================
# RP Trazar — Production Training E2E
#
# Mutating E2E for the Government production host, constrained to
# pre-created CAP training manifests. Every manifest is checked as
# isDemoData=true before any mutating action.
# ================================================================

set -uo pipefail

BASE_URL="${1:-https://rptrazar.mendoza.gov.ar}"
BASE_URL="${BASE_URL%/}"
API="$BASE_URL/api"

TRAINING_PREFIX="${TRAINING_PREFIX:-CAP-20260702}"
TRAINING_PASSWORD="${TRAINING_PASSWORD:-CapacitacionRP2026!}"
ALLOW_PRODUCTION_TRAINING_E2E="${ALLOW_PRODUCTION_TRAINING_E2E:-false}"

ADMIN_EMAIL="${CERT_ADMIN_EMAIL:-admin@dgfa.mendoza.gov.ar}"
ADMIN_PASSWORD="${CERT_ADMIN_PASSWORD:-admin123}"
GEN_EMAIL="${TRAINING_GEN_EMAIL:-capacitacion.generador@rptrazar.mendoza.gov.ar}"
TRANS_EMAIL="${TRAINING_TRANS_EMAIL:-capacitacion.transportista@rptrazar.mendoza.gov.ar}"
OPER_EMAIL="${TRAINING_OPER_EMAIL:-capacitacion.operador@rptrazar.mendoza.gov.ar}"

PASS=0
FAIL=0
ERRORS=""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS + 1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL + 1)); ERRORS="$ERRORS\n  FAIL $1"; }
section() { echo -e "\n${BOLD}${CYAN}--- $1 ---${NC}"; }

is_true() {
  case "${1:-}" in
    true|TRUE|1|yes|YES|si|SI) return 0 ;;
    *) return 1 ;;
  esac
}

host_from_url() {
  python3 - "$1" <<'PY'
import sys
from urllib.parse import urlparse
print(urlparse(sys.argv[1]).hostname or sys.argv[1])
PY
}

is_real_production_target() {
  case "$(host_from_url "$BASE_URL")" in
    rptrazar.mendoza.gov.ar|sitrepprd1.mendoza.gov.ar) return 0 ;;
    *) return 1 ;;
  esac
}

json_get() {
  local path="$1"
  python3 -c '
import json
import sys

path = sys.argv[1].split(".")
try:
    value = json.load(sys.stdin)
    for key in path:
        if isinstance(value, list):
            value = value[int(key)]
        else:
            value = value[key]
    if isinstance(value, bool):
        print("true" if value else "false")
    elif value is not None:
        print(value)
except Exception:
    print("")
' "$path"
}

api_call() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$body"
  else
    curl -sS -X "$method" "$API$path" \
      -H "Authorization: Bearer $token"
  fi
}

status_call() {
  local method="$1" path="$2" token="$3" body="${4:-}"
  if [ -n "$body" ]; then
    curl -sS -o /tmp/rptrazar-training-response.json -w "%{http_code}" -X "$method" "$API$path" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $token" \
      -d "$body"
  else
    curl -sS -o /tmp/rptrazar-training-response.json -w "%{http_code}" -X "$method" "$API$path" \
      -H "Authorization: Bearer $token"
  fi
}

login() {
  local email="$1" password="$2"
  curl -sS -X POST "$API/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    | json_get "data.tokens.accessToken"
}

manifest_id_by_number() {
  local number="$1"
  api_call "GET" "/manifiestos?search=$number&limit=20" "$ADMIN_TOKEN" \
    | NUMBER="$number" python3 -c '
import json
import os
import sys

target = os.environ["NUMBER"]
try:
    data = json.load(sys.stdin).get("data", {})
    items = data.get("manifiestos") or data.get("items") or []
    for item in items:
        if item.get("numero") == target:
            print(item.get("id", ""))
            break
except Exception:
    pass
'
}

manifest_detail() {
  local id="$1"
  api_call "GET" "/manifiestos/$id" "$ADMIN_TOKEN"
}

assert_demo_manifest() {
  local number="$1" expected_state="${2:-}"
  local id detail actual_number is_demo state

  id="$(manifest_id_by_number "$number")"
  if [ -z "$id" ]; then
    fail "$number existe en API"
    return 1
  fi

  detail="$(manifest_detail "$id")"
  actual_number="$(printf "%s" "$detail" | json_get "data.manifiesto.numero")"
  is_demo="$(printf "%s" "$detail" | json_get "data.manifiesto.isDemoData")"
  state="$(printf "%s" "$detail" | json_get "data.manifiesto.estado")"

  if [ "$actual_number" != "$number" ]; then
    fail "$number detalle corresponde al numero esperado"
    return 1
  fi
  if [ "$is_demo" != "true" ]; then
    fail "$number tiene isDemoData=true antes de mutar"
    return 1
  fi
  if [[ "$number" != "$TRAINING_PREFIX"-* ]]; then
    fail "$number usa prefijo $TRAINING_PREFIX"
    return 1
  fi
  if [ -n "$expected_state" ] && [ "$state" != "$expected_state" ]; then
    fail "$number estado inicial $expected_state (actual: $state)"
    return 1
  fi

  pass "$number guard ok (id=${id:0:8}, estado=$state, isDemoData=true)"
  printf "%s" "$id"
}

expect_status() {
  local label="$1" expected="$2" method="$3" path="$4" token="$5" body="${6:-}"
  local code
  code="$(status_call "$method" "$path" "$token" "$body")"
  if [ "$code" = "$expected" ]; then
    pass "$label [$code]"
    return 0
  fi

  fail "$label [$code != $expected] response=$(tr -d '\n' < /tmp/rptrazar-training-response.json | cut -c1-220)"
  return 1
}

expect_state() {
  local id="$1" expected="$2" label="$3"
  local state is_demo detail
  detail="$(manifest_detail "$id")"
  state="$(printf "%s" "$detail" | json_get "data.manifiesto.estado")"
  is_demo="$(printf "%s" "$detail" | json_get "data.manifiesto.isDemoData")"
  if [ "$state" = "$expected" ] && [ "$is_demo" = "true" ]; then
    pass "$label estado=$expected isDemoData=true"
  else
    fail "$label estado=$state expected=$expected isDemoData=$is_demo"
  fi
}

echo -e "${BOLD}${CYAN}RP Trazar production training E2E${NC}"
echo "Target: $API"
echo "Training prefix: $TRAINING_PREFIX"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"

if is_real_production_target && ! is_true "$ALLOW_PRODUCTION_TRAINING_E2E"; then
  echo -e "${RED}FATAL${NC} Production training E2E requires ALLOW_PRODUCTION_TRAINING_E2E=true"
  exit 2
fi

section "Authentication"

ADMIN_TOKEN="$(login "$ADMIN_EMAIL" "$ADMIN_PASSWORD")"
GEN_TOKEN="$(login "$GEN_EMAIL" "$TRAINING_PASSWORD")"
TRANS_TOKEN="$(login "$TRANS_EMAIL" "$TRAINING_PASSWORD")"
OPER_TOKEN="$(login "$OPER_EMAIL" "$TRAINING_PASSWORD")"

[ -n "$ADMIN_TOKEN" ] && pass "ADMIN login" || fail "ADMIN login"
[ -n "$GEN_TOKEN" ] && pass "training GENERADOR login" || fail "training GENERADOR login"
[ -n "$TRANS_TOKEN" ] && pass "training TRANSPORTISTA login" || fail "training TRANSPORTISTA login"
[ -n "$OPER_TOKEN" ] && pass "training OPERADOR login" || fail "training OPERADOR login"

if [ -z "$ADMIN_TOKEN" ] || [ -z "$GEN_TOKEN" ] || [ -z "$TRANS_TOKEN" ] || [ -z "$OPER_TOKEN" ]; then
  echo -e "${RED}Cannot continue without all training tokens.${NC}"
  exit 1
fi

section "Dataset Guard"

while read -r number expected_state; do
  [ -z "$number" ] && continue
  assert_demo_manifest "$number" "$expected_state" >/dev/null || true
done <<EOF
${TRAINING_PREFIX}-0001 BORRADOR
${TRAINING_PREFIX}-0002 APROBADO
${TRAINING_PREFIX}-0003 EN_TRANSITO
${TRAINING_PREFIX}-0004 ENTREGADO
${TRAINING_PREFIX}-0005 RECIBIDO
${TRAINING_PREFIX}-0006 EN_TRATAMIENTO
${TRAINING_PREFIX}-0007 TRATADO
${TRAINING_PREFIX}-0008 RECHAZADO
${TRAINING_PREFIX}-0009 CANCELADO
EOF

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Dataset guard failed. Rerun training seed before E2E.${NC}"
  exit 1
fi

section "Read-only Role Surface"

expect_status "ADMIN lista CAP" "200" "GET" "/manifiestos?search=$TRAINING_PREFIX&limit=20" "$ADMIN_TOKEN"
expect_status "GENERADOR lista propia" "200" "GET" "/manifiestos?search=$TRAINING_PREFIX&limit=20" "$GEN_TOKEN"
expect_status "TRANSPORTISTA viajes aprobados" "200" "GET" "/manifiestos?estado=APROBADO&search=$TRAINING_PREFIX&limit=20" "$TRANS_TOKEN"
expect_status "OPERADOR entregados" "200" "GET" "/manifiestos?estado=ENTREGADO&search=$TRAINING_PREFIX&limit=20" "$OPER_TOKEN"

section "Controlled Full Lifecycle on ${TRAINING_PREFIX}-0001"

FULL_ID="$(assert_demo_manifest "${TRAINING_PREFIX}-0001" "BORRADOR" | tail -1)"
if [ -z "$FULL_ID" ]; then
  fail "full lifecycle manifest id resolved"
else
  expect_status "GENERADOR firma demo" "200" "POST" "/manifiestos/$FULL_ID/firmar" "$GEN_TOKEN" "{}"
  expect_state "$FULL_ID" "APROBADO" "post firma"

  expect_status "TRANSPORTISTA confirma retiro demo" "200" "POST" "/manifiestos/$FULL_ID/confirmar-retiro" "$TRANS_TOKEN" '{"latitud":-32.8895,"longitud":-68.8458,"observaciones":"E2E capacitacion retiro"}'
  expect_state "$FULL_ID" "EN_TRANSITO" "post retiro"

  expect_status "TRANSPORTISTA GPS demo 1" "200" "POST" "/manifiestos/$FULL_ID/ubicacion" "$TRANS_TOKEN" '{"latitud":-32.9350,"longitud":-68.8620,"velocidad":42,"direccion":145}'
  expect_status "TRANSPORTISTA incidente demo" "200" "POST" "/manifiestos/$FULL_ID/incidente" "$TRANS_TOKEN" '{"tipo":"CAPACITACION","descripcion":"Incidente simulado de capacitacion","latitud":-32.9350,"longitud":-68.8620}'

  expect_status "TRANSPORTISTA confirma entrega demo" "200" "POST" "/manifiestos/$FULL_ID/confirmar-entrega" "$TRANS_TOKEN" '{"latitud":-33.0348,"longitud":-68.8792,"observaciones":"E2E capacitacion entrega"}'
  expect_state "$FULL_ID" "ENTREGADO" "post entrega"

  expect_status "OPERADOR confirma recepcion demo" "200" "POST" "/manifiestos/$FULL_ID/confirmar-recepcion" "$OPER_TOKEN" '{"observaciones":"E2E capacitacion recepcion","pesoReal":100}'
  expect_state "$FULL_ID" "RECIBIDO" "post recepcion"

  expect_status "OPERADOR registra tratamiento demo" "200" "POST" "/manifiestos/$FULL_ID/tratamiento" "$OPER_TOKEN" '{"metodoTratamiento":"CAPACITACION_CONTROLADA","observaciones":"E2E capacitacion tratamiento"}'
  expect_state "$FULL_ID" "EN_TRATAMIENTO" "post tratamiento"

  expect_status "OPERADOR cierra manifiesto demo" "200" "POST" "/manifiestos/$FULL_ID/cerrar" "$OPER_TOKEN" '{"metodoTratamiento":"CAPACITACION_CONTROLADA","observaciones":"E2E capacitacion cierre"}'
  expect_state "$FULL_ID" "TRATADO" "post cierre"

  expect_status "PDF manifiesto demo" "200" "GET" "/pdf/manifiesto/$FULL_ID" "$ADMIN_TOKEN"
  expect_status "PDF certificado demo" "200" "GET" "/pdf/certificado/$FULL_ID" "$ADMIN_TOKEN"
fi

section "Negative Guards on Demo Records"

APROBADO_ID="$(assert_demo_manifest "${TRAINING_PREFIX}-0002" "APROBADO" | tail -1)"
if [ -n "$APROBADO_ID" ]; then
  expect_status "GENERADOR bloqueado confirmar retiro demo" "403" "POST" "/manifiestos/$APROBADO_ID/confirmar-retiro" "$GEN_TOKEN" "{}"
fi

ENTREGADO_ID="$(assert_demo_manifest "${TRAINING_PREFIX}-0004" "ENTREGADO" | tail -1)"
if [ -n "$ENTREGADO_ID" ]; then
  expect_status "OPERADOR rechaza carga demo" "200" "POST" "/manifiestos/$ENTREGADO_ID/rechazar" "$OPER_TOKEN" '{"motivo":"CAPACITACION","descripcion":"Rechazo simulado sobre manifiesto demo"}'
  expect_state "$ENTREGADO_ID" "RECHAZADO" "post rechazo demo"
fi

echo ""
echo -e "${BOLD}Summary:${NC}"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}FAILED${NC}"
  printf "%b\n" "$ERRORS"
  exit 1
fi

echo -e "${GREEN}PASS${NC} Production training E2E completed on demo-only records."
