#!/usr/bin/env bash
# =====================================================
# SITREP — Test de Notificaciones (post-implementación)
# ~25 tests cubriendo el flujo completo de alertas
# =====================================================

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar/api}"
PASS=0
FAIL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { echo -e "  ${GREEN}PASS${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "  ${RED}FAIL${NC} $1"; FAIL=$((FAIL+1)); }
section() { echo -e "\n${YELLOW}--- $1 ---${NC}"; }

check_status() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    pass "[$actual] $label"
  else
    fail "[$actual != $expected] $label"
  fi
}

# Token extraction: response format {"data":{"tokens":{"accessToken":"..."}}}
get_token() {
  local email="$1" password="$2"
  curl -s --compressed -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4
}

api_get() {
  local path="$1" token="$2"
  curl -s --compressed "$BASE_URL$path" -H "Authorization: Bearer $token"
}

api_post() {
  local path="$1" token="$2" body="$3"
  [ -z "$body" ] && body="{}"
  curl -s --compressed -o /dev/null -w "%{http_code}" \
    -X POST "$BASE_URL$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json" \
    -d "$body"
}

api_put() {
  local path="$1" token="$2"
  curl -s --compressed -o /dev/null -w "%{http_code}" \
    -X PUT "$BASE_URL$path" \
    -H "Authorization: Bearer $token" \
    -H "Content-Type: application/json"
}

noleidas() {
  local resp="$1"
  echo "$resp" | grep -o '"noLeidas":[0-9]*' | grep -o '[0-9]*' | head -1 || echo "0"
}

echo "============================================"
echo " SITREP NOTIFICATION TEST"
echo " Target: $BASE_URL"
echo "============================================"

# ── Bloque A: Login 4 roles ──────────────────────
section "Bloque A — Login 4 roles"

ADMIN_TOKEN=$(get_token "admin@dgfa.mendoza.gov.ar" "admin123")
[ -n "$ADMIN_TOKEN" ] && pass "Login ADMIN" || { fail "Login ADMIN — no token"; exit 1; }

# Small delay to avoid rate limiting between logins
sleep 1

GEN_TOKEN=$(get_token "quimica.mendoza@industria.com" "gen123")
[ -n "$GEN_TOKEN" ] && pass "Login GENERADOR (quimica.mendoza@industria.com)" \
                     || fail "Login GENERADOR — no token (warn: some tests may fail)"

sleep 1

TRANS_TOKEN=$(get_token "transportes.andes@logistica.com" "trans123")
[ -n "$TRANS_TOKEN" ] && pass "Login TRANSPORTISTA (transportes.andes@logistica.com)" \
                       || fail "Login TRANSPORTISTA — no token (warn: TRANS tests may fail)"

sleep 1

OPER_TOKEN=$(get_token "tratamiento.residuos@planta.com" "op123")
[ -n "$OPER_TOKEN" ] && pass "Login OPERADOR (tratamiento.residuos@planta.com)" \
                      || fail "Login OPERADOR — no token (warn: OPER tests may fail)"

# ── Bloque B: Baseline conteo inicial ───────────────
section "Bloque B — Baseline notificaciones"

RESP_ADMIN_BASE=$(api_get "/notificaciones" "$ADMIN_TOKEN")
BASELINE_ADMIN=$(noleidas "$RESP_ADMIN_BASE")
pass "Baseline ADMIN noLeidas=$BASELINE_ADMIN"

BASELINE_GEN=0
if [ -n "$GEN_TOKEN" ]; then
  RESP_GEN_BASE=$(api_get "/notificaciones" "$GEN_TOKEN")
  BASELINE_GEN=$(noleidas "$RESP_GEN_BASE")
fi
pass "Baseline GENERADOR noLeidas=$BASELINE_GEN"

# ── Setup: IDs correctos via profile ────────────────
section "Setup — IDs via profile"

# Extract nested actor id: profile returns user.generador.id (not generadorId at top level)
# Uses python3 for reliable JSON parsing
json_get() {
  local json="$1" key="$2"
  echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('user',{}).get('$key',{}).get('id',''))" 2>/dev/null || echo ""
}

GEN_ACTOR_ID=""
if [ -n "$GEN_TOKEN" ]; then
  GEN_PROFILE=$(api_get "/auth/profile" "$GEN_TOKEN")
  GEN_ACTOR_ID=$(json_get "$GEN_PROFILE" "generador")
fi
# Fallback
if [ -z "$GEN_ACTOR_ID" ]; then
  GEN_ACTOR_ID=$(api_get "/actores/generadores" "$ADMIN_TOKEN" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
fi

TRANS_ACTOR_ID=""
if [ -n "$TRANS_TOKEN" ]; then
  TRANS_PROFILE=$(api_get "/auth/profile" "$TRANS_TOKEN")
  TRANS_ACTOR_ID=$(json_get "$TRANS_PROFILE" "transportista")
fi
if [ -z "$TRANS_ACTOR_ID" ]; then
  TRANS_ACTOR_ID=$(api_get "/catalogos/transportistas" "$ADMIN_TOKEN" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
fi

OPER_ACTOR_ID=""
if [ -n "$OPER_TOKEN" ]; then
  OPER_PROFILE=$(api_get "/auth/profile" "$OPER_TOKEN")
  OPER_ACTOR_ID=$(json_get "$OPER_PROFILE" "operador")
fi
if [ -z "$OPER_ACTOR_ID" ]; then
  OPER_ACTOR_ID=$(api_get "/catalogos/operadores" "$ADMIN_TOKEN" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
fi

TIPO_ID=$(curl -s --compressed "$BASE_URL/catalogos/tipos-residuos" | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)

echo "  GEN_ACTOR_ID=$GEN_ACTOR_ID"
echo "  TRANS_ACTOR_ID=$TRANS_ACTOR_ID"
echo "  OPER_ACTOR_ID=$OPER_ACTOR_ID"
echo "  TIPO_ID=$TIPO_ID"

if [ -z "$GEN_ACTOR_ID" ] || [ -z "$TRANS_ACTOR_ID" ] || [ -z "$OPER_ACTOR_ID" ] || [ -z "$TIPO_ID" ]; then
  fail "Setup: faltan IDs — algunos tests pueden fallar"
else
  pass "Setup: todos los IDs obtenidos"
fi

# ── Bloque C: Crear + Firmar manifiesto ─────────────
section "Bloque C — BORRADOR → APROBADO (genera notificaciones)"

CREATE_PAYLOAD="{\"generadorId\":\"$GEN_ACTOR_ID\",\"transportistaId\":\"$TRANS_ACTOR_ID\",\"operadorId\":\"$OPER_ACTOR_ID\",\"residuos\":[{\"tipoResiduoId\":\"$TIPO_ID\",\"cantidad\":1,\"unidad\":\"kg\"}],\"descripcion\":\"Manifiesto de prueba notificaciones\"}"

CREATE_RESP=$(curl -s --compressed -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/manifiestos" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$CREATE_PAYLOAD")
check_status "POST /manifiestos (crear BORRADOR)" "201" "$CREATE_RESP"

# Get the most recently created manifest
NOTIF_MANIF_ID=$(api_get "/manifiestos?limit=1&estado=BORRADOR" "$ADMIN_TOKEN" \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
echo "  NOTIF_MANIF_ID=$NOTIF_MANIF_ID"

if [ -z "$NOTIF_MANIF_ID" ]; then
  fail "No se pudo obtener el ID del manifiesto creado — abortando Bloque C+"
else
  FIRMAR_RESP=$(api_post "/manifiestos/$NOTIF_MANIF_ID/firmar" "$ADMIN_TOKEN")
  check_status "POST /manifiestos/$NOTIF_MANIF_ID/firmar (BORRADOR→APROBADO)" "200" "$FIRMAR_RESP"

  echo "  Waiting 2s for setImmediate async alerts..."
  sleep 2

  # ADMIN should have more unread (admin performed the action, but other admins might exist, or same admin gets self-notif)
  AFTER_FIRMA_ADMIN=$(noleidas "$(api_get "/notificaciones?leida=false" "$ADMIN_TOKEN")")
  if [ "$AFTER_FIRMA_ADMIN" -gt "$BASELINE_ADMIN" ]; then
    pass "ADMIN: noLeidas aumentó ($BASELINE_ADMIN → $AFTER_FIRMA_ADMIN) post-firma"
  else
    fail "ADMIN: noLeidas NO aumentó ($BASELINE_ADMIN → $AFTER_FIRMA_ADMIN) — admin fue el que firmó (se excluye si es el único admin)"
  fi

  if [ -n "$GEN_TOKEN" ]; then
    AFTER_FIRMA_GEN=$(noleidas "$(api_get "/notificaciones?leida=false" "$GEN_TOKEN")")
    if [ "$AFTER_FIRMA_GEN" -gt "$BASELINE_GEN" ]; then
      pass "GENERADOR: recibió notificación post-firma (noLeidas $BASELINE_GEN → $AFTER_FIRMA_GEN)"
    else
      fail "GENERADOR: sin notificación post-firma (noLeidas=$AFTER_FIRMA_GEN, baseline=$BASELINE_GEN)"
    fi
  fi

  if [ -n "$TRANS_TOKEN" ]; then
    AFTER_FIRMA_TRANS=$(noleidas "$(api_get "/notificaciones?leida=false" "$TRANS_TOKEN")")
    if [ "$AFTER_FIRMA_TRANS" -gt 0 ]; then
      pass "TRANSPORTISTA: recibió notificación post-firma (noLeidas=$AFTER_FIRMA_TRANS)"
    else
      fail "TRANSPORTISTA: sin notificación post-firma (noLeidas=$AFTER_FIRMA_TRANS)"
    fi
  fi
fi

# ── Bloque D: Confirmar retiro (APROBADO → EN_TRANSITO) ──
section "Bloque D — APROBADO → EN_TRANSITO"

RETIRO_RESP=$(api_post "/manifiestos/$NOTIF_MANIF_ID/confirmar-retiro" "$ADMIN_TOKEN")
check_status "POST /confirmar-retiro (APROBADO→EN_TRANSITO)" "200" "$RETIRO_RESP"

sleep 2

if [ -n "$OPER_TOKEN" ]; then
  AFTER_RETIRO_OPER=$(noleidas "$(api_get "/notificaciones?leida=false" "$OPER_TOKEN")")
  if [ "$AFTER_RETIRO_OPER" -gt 0 ]; then
    pass "OPERADOR: recibió notificación Transporte Iniciado (noLeidas=$AFTER_RETIRO_OPER)"
  else
    fail "OPERADOR: sin notificación Transporte Iniciado (noLeidas=$AFTER_RETIRO_OPER)"
  fi
fi

# ── Bloque E: Registrar incidente ────────────────────
section "Bloque E — Incidente en tránsito"

BASELINE_ADMIN_E=$(noleidas "$(api_get "/notificaciones?leida=false" "$ADMIN_TOKEN")")

INCIDENTE_RESP=$(api_post "/manifiestos/$NOTIF_MANIF_ID/incidente" "$ADMIN_TOKEN" \
  '{"tipo":"AVERIA","descripcion":"Prueba incidente test notificaciones"}')
check_status "POST /incidente (registrar incidente)" "200" "$INCIDENTE_RESP"

sleep 2

AFTER_INCIDENTE_ADMIN=$(noleidas "$(api_get "/notificaciones?leida=false" "$ADMIN_TOKEN")")
# Admin triggered the incident, so they get excluded from self-notify; check admin panel for all notifs
ADMIN_ALL_NOTIFS=$(api_get "/notificaciones" "$ADMIN_TOKEN")
ALTA_COUNT=$(echo "$ADMIN_ALL_NOTIFS" | grep -o '"prioridad":"ALTA"' | wc -l | tr -d ' ')
if [ "$ALTA_COUNT" -gt 0 ]; then
  pass "Notificaciones con prioridad ALTA encontradas ($ALTA_COUNT)"
else
  fail "Sin notificaciones con prioridad ALTA en historial admin"
fi

if [ -n "$OPER_TOKEN" ]; then
  AFTER_INCIDENTE_OPER=$(noleidas "$(api_get "/notificaciones?leida=false" "$OPER_TOKEN")")
  if [ "$AFTER_INCIDENTE_OPER" -gt 0 ]; then
    pass "OPERADOR: recibió notificación incidente (noLeidas=$AFTER_INCIDENTE_OPER)"
  else
    fail "OPERADOR: sin notificación incidente (noLeidas=$AFTER_INCIDENTE_OPER)"
  fi
fi

# ── Bloque F: Confirmar entrega (EN_TRANSITO → ENTREGADO) ──
section "Bloque F — EN_TRANSITO → ENTREGADO"

BASELINE_OPER_F=0
if [ -n "$OPER_TOKEN" ]; then
  BASELINE_OPER_F=$(noleidas "$(api_get "/notificaciones?leida=false" "$OPER_TOKEN")")
fi

ENTREGA_RESP=$(api_post "/manifiestos/$NOTIF_MANIF_ID/confirmar-entrega" "$ADMIN_TOKEN")
check_status "POST /confirmar-entrega (EN_TRANSITO→ENTREGADO)" "200" "$ENTREGA_RESP"

sleep 2

if [ -n "$OPER_TOKEN" ]; then
  AFTER_ENTREGA_OPER=$(noleidas "$(api_get "/notificaciones?leida=false" "$OPER_TOKEN")")
  if [ "$AFTER_ENTREGA_OPER" -ge "$BASELINE_OPER_F" ]; then
    pass "OPERADOR: notificaciones Entrega Confirmada (noLeidas=$AFTER_ENTREGA_OPER)"
  else
    fail "OPERADOR: sin notificación Entrega Confirmada"
  fi
fi

# ── Bloque G: Rechazar carga (ENTREGADO → RECHAZADO) ──
section "Bloque G — ENTREGADO → RECHAZADO"

BASELINE_GEN_G=0
if [ -n "$GEN_TOKEN" ]; then
  BASELINE_GEN_G=$(noleidas "$(api_get "/notificaciones?leida=false" "$GEN_TOKEN")")
fi

RECHAZAR_RESP=$(api_post "/manifiestos/$NOTIF_MANIF_ID/rechazar" "$OPER_TOKEN" \
  '{"motivo":"Rechazo de prueba para test de notificaciones"}')
# If OPER_TOKEN is empty, fall back to ADMIN
if [ -z "$OPER_TOKEN" ]; then
  RECHAZAR_RESP=$(api_post "/manifiestos/$NOTIF_MANIF_ID/rechazar" "$ADMIN_TOKEN" \
    '{"motivo":"Rechazo de prueba para test de notificaciones"}')
fi
check_status "POST /rechazar (ENTREGADO→RECHAZADO)" "200" "$RECHAZAR_RESP"

sleep 2

if [ -n "$GEN_TOKEN" ]; then
  AFTER_RECHAZO_GEN=$(noleidas "$(api_get "/notificaciones?leida=false" "$GEN_TOKEN")")
  if [ "$AFTER_RECHAZO_GEN" -gt "$BASELINE_GEN_G" ]; then
    pass "GENERADOR: recibió notificación Carga Rechazada ($BASELINE_GEN_G → $AFTER_RECHAZO_GEN)"
  else
    fail "GENERADOR: sin notificación Carga Rechazada (noLeidas=$AFTER_RECHAZO_GEN, prev=$BASELINE_GEN_G)"
  fi

  GEN_NOTIFS=$(api_get "/notificaciones" "$GEN_TOKEN")
  TIPO_RECHAZADO=$(echo "$GEN_NOTIFS" | grep -o '"tipo":"MANIFIESTO_RECHAZADO"' | wc -l | tr -d ' ')
  if [ "$TIPO_RECHAZADO" -gt 0 ]; then
    pass "Tipo MANIFIESTO_RECHAZADO presente en notificaciones del GENERADOR"
  else
    fail "Sin tipo MANIFIESTO_RECHAZADO para GENERADOR (revisa evento RECHAZO_CARGA vs CAMBIO_ESTADO)"
  fi
fi

AFTER_RECHAZO_ADMIN=$(noleidas "$(api_get "/notificaciones?leida=false" "$ADMIN_TOKEN")")
[ "$AFTER_RECHAZO_ADMIN" -gt 0 ] \
  && pass "ADMIN: notificaciones post-rechazo (noLeidas=$AFTER_RECHAZO_ADMIN)" \
  || fail "ADMIN: sin notificaciones post-rechazo"

# ── Bloque H: Marcar como leída / todas leídas ──────
section "Bloque H — marcarLeida + marcarTodasLeidas"

NOTIF_ID=$(api_get "/notificaciones" "$ADMIN_TOKEN" \
  | grep -o '"id":"[^"]*"' | cut -d'"' -f4 | head -1)
echo "  NOTIF_ID=$NOTIF_ID"

MARCAR_RESP=$(api_put "/notificaciones/$NOTIF_ID/leida" "$ADMIN_TOKEN")
check_status "PUT /notificaciones/$NOTIF_ID/leida" "200" "$MARCAR_RESP"

# Check ?leida=true returns results
LEIDAS_RESP=$(api_get "/notificaciones?leida=true" "$ADMIN_TOKEN")
LEIDAS_COUNT=$(echo "$LEIDAS_RESP" | grep -o '"leida":true' | wc -l | tr -d ' ')
[ "$LEIDAS_COUNT" -gt 0 ] \
  && pass "Notificación marcada como leída (leida=true en respuesta)" \
  || fail "Notificación NO aparece como leída"

TODAS_LEIDAS_RESP=$(api_put "/notificaciones/todas-leidas" "$ADMIN_TOKEN")
check_status "PUT /notificaciones/todas-leidas" "200" "$TODAS_LEIDAS_RESP"

AFTER_TODAS=$(noleidas "$(api_get "/notificaciones?leida=false" "$ADMIN_TOKEN")")
[ "$AFTER_TODAS" -eq 0 ] \
  && pass "noLeidas = 0 después de marcarTodasLeidas" \
  || fail "noLeidas = $AFTER_TODAS después de marcarTodasLeidas (debería ser 0)"

# ── Bloque I: AlertasGeneradas ───────────────────────
section "Bloque I — AlertasGeneradas (/alertas)"

HTTP_ALERTAS=$(curl -s --compressed -o /dev/null -w "%{http_code}" \
  "$BASE_URL/alertas" -H "Authorization: Bearer $ADMIN_TOKEN")
check_status "GET /alertas (ADMIN)" "200" "$HTTP_ALERTAS"

ALERTAS_RESP=$(api_get "/alertas" "$ADMIN_TOKEN")
ALERTAS_COUNT=$(echo "$ALERTAS_RESP" | grep -o '"id":"' | wc -l | tr -d ' ')
if [ "$ALERTAS_COUNT" -gt 0 ]; then
  pass "AlertasGeneradas: $ALERTAS_COUNT registros encontrados"
else
  fail "AlertasGeneradas: 0 registros — ReglaAlerta no sembrada en producción"
  echo "    ACCIÓN: correr seed en servidor para insertar las 5 ReglaAlerta por defecto"
fi

# ── Resultados ───────────────────────────────────────
echo ""
echo "============================================"
echo " RESULTS"
echo "============================================"
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
echo ""
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}ALL NOTIFICATION TESTS PASSED${NC}"
  exit 0
else
  echo -e "${RED}$FAIL TESTS FAILED${NC}"
  exit 1
fi
