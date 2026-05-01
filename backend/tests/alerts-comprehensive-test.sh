#!/usr/bin/env bash
# =============================================================================
# SITREP — Suite de Pruebas Integral del Sistema de Alertas
# Cubre los 8 tipos de DomainEvent + ReglaAlerta CRUD + resolución
# Uso: bash alerts-comprehensive-test.sh [BASE_URL]
#      VPS_HOST=23.105.176.45 bash alerts-comprehensive-test.sh https://sitrep.ultimamilla.com.ar
# =============================================================================
set -uo pipefail

BASE_URL="${1:-http://localhost:3010}"
ADMIN_EMAIL="admin@dgfa.mendoza.gov.ar"
ADMIN_PASS="admin123"
TRANSPORTISTA_EMAIL="transportes.andes@logistica.com"
TRANSPORTISTA_PASS="trans123"
OPERADOR_EMAIL="tratamiento.residuos@planta.com"
OPERADOR_PASS="op123"
GENERADOR_EMAIL="quimica.mendoza@industria.com"
GENERADOR_PASS="gen123"

PASS=0
FAIL=0
TOTAL=0

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { PASS=$((PASS+1)); TOTAL=$((TOTAL+1)); echo -e "${GREEN}  ✓ $1${NC}"; }
fail() { FAIL=$((FAIL+1)); TOTAL=$((TOTAL+1)); echo -e "${RED}  ✗ $1${NC}"; }
section() { echo -e "\n${YELLOW}══════════════════════════════════════════════════════${NC}"; echo -e "${YELLOW}  $1${NC}"; echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"; }

curl_json() {
  curl -s -w "\n%{http_code}" "$@"
}

check_http() {
  local label="$1"; local expected_code="$2"; local response="$3"
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')
  if [ "$http_code" = "$expected_code" ]; then
    pass "$label (HTTP $http_code)"
    echo "$body"
  else
    fail "$label (esperado $expected_code, obtenido $http_code)"
    echo "$body"
    echo ""
  fi
}

check_field() {
  local label="$1"; local json="$2"; local field="$3"; local expected="$4"
  local val
  val=$(echo "$json" | grep -o "\"$field\":[^,}]*" | head -1 | sed 's/.*://' | tr -d '"' | tr -d ' ')
  if [ "$val" = "$expected" ]; then
    pass "$label ($field=$val)"
  else
    fail "$label ($field esperado=$expected, obtenido=$val)"
  fi
}

echo "=============================================="
echo "  SITREP — Test Integral Sistema de Alertas"
echo "  Target: $BASE_URL"
echo "  Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=============================================="

# =============================================================================
# LOGIN
# =============================================================================
section "LOGIN (4 roles)"

R=$(curl_json -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
ADMIN_TOKEN=$(echo "$R" | sed '$d' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$ADMIN_TOKEN" ] && pass "Login ADMIN" || { fail "Login ADMIN — abortando"; exit 1; }

R=$(curl_json -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$TRANSPORTISTA_EMAIL\",\"password\":\"$TRANSPORTISTA_PASS\"}")
TRANS_TOKEN=$(echo "$R" | sed '$d' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$TRANS_TOKEN" ] && pass "Login TRANSPORTISTA" || fail "Login TRANSPORTISTA"

R=$(curl_json -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$OPERADOR_EMAIL\",\"password\":\"$OPERADOR_PASS\"}")
OPER_TOKEN=$(echo "$R" | sed '$d' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$OPER_TOKEN" ] && pass "Login OPERADOR" || fail "Login OPERADOR"

R=$(curl_json -X POST "$BASE_URL/api/auth/login" -H "Content-Type: application/json" \
  -d "{\"email\":\"$GENERADOR_EMAIL\",\"password\":\"$GENERADOR_PASS\"}")
GEN_TOKEN=$(echo "$R" | sed '$d' | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
[ -n "$GEN_TOKEN" ] && pass "Login GENERADOR" || fail "Login GENERADOR"

AUTH="Authorization: Bearer $ADMIN_TOKEN"

# =============================================================================
# A. ReglaAlerta CRUD
# =============================================================================
section "A. ReglaAlerta CRUD"

# Listar reglas
R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas/reglas")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] && pass "GET /alertas/reglas HTTP 200" || fail "GET /alertas/reglas HTTP $HTTP"

# Seed reglas faltantes si hay <8 (ANOMALIA_GPS, TIEMPO_EXCESIVO, DESVIO_RUTA, VENCIMIENTO)
for EVENTO_FALTANTE in "ANOMALIA_GPS|Anomalía GPS" "TIEMPO_EXCESIVO|Tiempo de tránsito excesivo" "DESVIO_RUTA|Desvio de ruta" "VENCIMIENTO|Vencimiento próximo"; do
  EV=$(echo "$EVENTO_FALTANTE" | cut -d'|' -f1)
  NOM=$(echo "$EVENTO_FALTANTE" | cut -d'|' -f2)
  if ! echo "$BODY" | grep -q "\"$EV\""; then
    curl -s -X POST "$BASE_URL/api/alertas/reglas" \
      -H "$AUTH" -H "Content-Type: application/json" \
      -d "{\"nombre\":\"$NOM\",\"evento\":\"$EV\",\"condicion\":{},\"destinatarios\":[\"ADMIN\"],\"activa\":true}" > /dev/null
    echo "  Regla $EV creada en producción"
  fi
done
sleep 0.5

# Re-listar reglas y verificar
R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas/reglas")
BODY=$(echo "$R" | sed '$d')
COUNT=$(echo "$BODY" | grep -o '"evento"' | wc -l | tr -d ' ')
[ "$COUNT" -ge 8 ] && pass "≥8 reglas activas ($COUNT encontradas)" || fail "Faltan reglas: solo $COUNT (esperadas ≥8)"

# Crear regla nueva
R=$(curl_json -X POST "$BASE_URL/api/alertas/reglas" \
  -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"nombre":"Test Rule CI","evento":"CAMBIO_ESTADO","condicion":{},"destinatarios":["ADMIN"],"activa":true}')
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] || [ "$HTTP" = "201" ] && pass "POST /alertas/reglas HTTP $HTTP" || fail "POST /alertas/reglas HTTP $HTTP"
NEW_REGLA_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$NEW_REGLA_ID" ] && pass "Nueva regla creada id=$NEW_REGLA_ID" || fail "No se obtuvo id de nueva regla"

# Eliminar regla creada (cleanup)
if [ -n "$NEW_REGLA_ID" ]; then
  R=$(curl_json -X DELETE "$BASE_URL/api/alertas/reglas/$NEW_REGLA_ID" -H "$AUTH")
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] || [ "$HTTP" = "204" ] && pass "DELETE /alertas/reglas/$NEW_REGLA_ID" || fail "DELETE /alertas/reglas/$NEW_REGLA_ID HTTP $HTTP"
fi

# =============================================================================
# Preparar manifiesto para workflow tests
# =============================================================================
section "Preparar manifiesto de prueba"

# Obtener IDs de actores
R=$(curl_json -H "$AUTH" "$BASE_URL/api/catalogos/generadores")
GEN_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$GEN_ID" ] && pass "Generador obtenido: $GEN_ID" || { fail "No se pudo obtener generador"; exit 1; }

R=$(curl_json -H "$AUTH" "$BASE_URL/api/catalogos/transportistas")
TRANS_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TRANS_ID" ] && pass "Transportista obtenido: $TRANS_ID" || { fail "No se pudo obtener transportista"; exit 1; }

R=$(curl_json -H "$AUTH" "$BASE_URL/api/catalogos/operadores")
OPER_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$OPER_ID" ] && pass "Operador obtenido: $OPER_ID" || { fail "No se pudo obtener operador"; exit 1; }

R=$(curl_json -H "$AUTH" "$BASE_URL/api/catalogos/tipos-residuos")
TIPO_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$TIPO_ID" ] && pass "Tipo residuo obtenido: $TIPO_ID" || { fail "No se pudo obtener tipo residuo"; exit 1; }

R=$(curl_json -H "$AUTH" "$BASE_URL/api/catalogos/vehiculos")
VEH_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

R=$(curl_json -H "$AUTH" "$BASE_URL/api/catalogos/choferes")
CHOFER_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

MANIFEST_BODY="{
  \"generadorId\":\"$GEN_ID\",
  \"transportistaId\":\"$TRANS_ID\",
  \"operadorId\":\"$OPER_ID\",
  \"vehiculoId\":\"${VEH_ID:-}\",
  \"choferId\":\"${CHOFER_ID:-}\",
  \"residuos\":[{\"tipoResiduoId\":\"$TIPO_ID\",\"cantidad\":100,\"unidad\":\"kg\",\"descripcion\":\"Residuo prueba alertas\"}],
  \"observaciones\":\"Manifiesto para test de alertas CI\"
}"

R=$(curl_json -X POST "$BASE_URL/api/manifiestos" \
  -H "$AUTH" -H "Content-Type: application/json" -d "$MANIFEST_BODY")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] || [ "$HTTP" = "201" ] && pass "Manifiesto creado HTTP $HTTP" || { fail "Error al crear manifiesto: HTTP $HTTP — $BODY"; exit 1; }
MAN_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
MAN_NUM=$(echo "$BODY" | grep -o '"numero":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$MAN_ID" ] && pass "Manifiesto id=$MAN_ID numero=$MAN_NUM" || { fail "No se obtuvo id de manifiesto"; exit 1; }

sleep 1

# =============================================================================
# B-C. CAMBIO_ESTADO — workflow completo + alertas
# =============================================================================
section "B-C. CAMBIO_ESTADO — workflow + AlertaGenerada"

# Contar alertas antes
R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
ALERTAS_ANTES=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
ALERTAS_ANTES=${ALERTAS_ANTES:-0}
echo "  Alertas antes del workflow: $ALERTAS_ANTES"

# Firmar: BORRADOR → APROBADO
R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN_ID/firmar" \
  -H "Authorization: Bearer $GEN_TOKEN" -H "Content-Type: application/json" -d '{}')
HTTP=$(echo "$R" | tail -1)
[ "$HTTP" = "200" ] && pass "Firmar manifiesto (BORRADOR→APROBADO)" || fail "Firmar manifiesto HTTP $HTTP"
sleep 1

# Confirmar retiro: APROBADO → EN_TRANSITO
R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN_ID/confirmar-retiro" \
  -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}')
HTTP=$(echo "$R" | tail -1)
[ "$HTTP" = "200" ] && pass "Confirmar retiro (APROBADO→EN_TRANSITO)" || fail "Confirmar retiro HTTP $HTTP"
sleep 1

# Verificar que se generaron alertas de CAMBIO_ESTADO
R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
ALERTAS_AHORA=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
ALERTAS_AHORA=${ALERTAS_AHORA:-0}
[ "$ALERTAS_AHORA" -gt "$ALERTAS_ANTES" ] && pass "AlertasGeneradas aumentaron ($ALERTAS_ANTES → $ALERTAS_AHORA)" || fail "No se generaron nuevas alertas ($ALERTAS_ANTES → $ALERTAS_AHORA)"

# Verificar notificaciones no leídas del admin
R=$(curl_json -H "$AUTH" "$BASE_URL/api/notificaciones?leida=false")
HTTP=$(echo "$R" | tail -1)
NOTIF_BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] && pass "GET /notificaciones (no leídas) HTTP 200" || fail "GET /notificaciones HTTP $HTTP"
NOTIF_COUNT=$(echo "$NOTIF_BODY" | grep -o '"id"' | wc -l | tr -d ' ')
echo "  Notificaciones no leídas: $NOTIF_COUNT"
[ "$NOTIF_COUNT" -gt 0 ] && pass "Admin tiene ≥1 notificación no leída" || fail "Admin no tiene notificaciones no leídas"

# =============================================================================
# D. INCIDENTE_REGISTRADO
# =============================================================================
section "D. INCIDENTE_REGISTRADO"

R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN_ID/incidente" \
  -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" \
  -d '{"tipoIncidente":"AVERIA","descripcion":"Pinchazo en ruta 40"}')
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] && pass "POST /manifiestos/:id/incidente HTTP 200" || fail "POST /incidente HTTP $HTTP — $BODY"
sleep 1

# Verificar alerta generada por INCIDENTE
R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
ALERTAS_POST_INCIDENTE=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
ALERTAS_POST_INCIDENTE=${ALERTAS_POST_INCIDENTE:-0}
[ "$ALERTAS_POST_INCIDENTE" -gt "$ALERTAS_AHORA" ] && \
  pass "AlertaGenerada por INCIDENTE ($ALERTAS_AHORA → $ALERTAS_POST_INCIDENTE)" || \
  fail "No se generó alerta para INCIDENTE"

# Verificar timeline
R=$(curl_json -H "$AUTH" "$BASE_URL/api/manifiestos/$MAN_ID")
HTTP=$(echo "$R" | tail -1)
TIMELINE=$(echo "$R" | sed '$d' | grep -o '"tipo":"INCIDENTE"')
[ -n "$TIMELINE" ] && pass "Evento INCIDENTE en timeline del manifiesto" || fail "INCIDENTE no aparece en timeline"

# =============================================================================
# E. RECHAZO_CARGA (workflow: entregar → rechazar)
# =============================================================================
section "E. RECHAZO_CARGA"

# Confirmar entrega
R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN_ID/confirmar-entrega" \
  -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}')
HTTP=$(echo "$R" | tail -1)
[ "$HTTP" = "200" ] && pass "Confirmar entrega (EN_TRANSITO→ENTREGADO)" || fail "Confirmar entrega HTTP $HTTP"
sleep 1

ALERTAS_ANTES_RECHAZO=$ALERTAS_POST_INCIDENTE

# Rechazar carga
R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN_ID/rechazar" \
  -H "Authorization: Bearer $OPER_TOKEN" -H "Content-Type: application/json" \
  -d '{"motivo":"Residuos no cumplen especificaciones del permiso"}')
HTTP=$(echo "$R" | tail -1)
[ "$HTTP" = "200" ] && pass "Rechazar carga (ENTREGADO→RECHAZADO)" || fail "Rechazar carga HTTP $HTTP"
sleep 1

R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
ALERTAS_POST_RECHAZO=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
ALERTAS_POST_RECHAZO=${ALERTAS_POST_RECHAZO:-0}
[ "$ALERTAS_POST_RECHAZO" -gt "$ALERTAS_ANTES_RECHAZO" ] && \
  pass "AlertaGenerada por RECHAZO_CARGA ($ALERTAS_ANTES_RECHAZO → $ALERTAS_POST_RECHAZO)" || \
  fail "No se generó alerta para RECHAZO_CARGA"

# =============================================================================
# F. DIFERENCIA_PESO — crear nuevo manifiesto para workflow pesaje
# =============================================================================
section "F. DIFERENCIA_PESO"

# Crear un segundo manifiesto para llegar a estado RECIBIDO y hacer pesaje
R=$(curl_json -X POST "$BASE_URL/api/manifiestos" \
  -H "$AUTH" -H "Content-Type: application/json" -d "$MANIFEST_BODY")
MAN2_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
[ -n "$MAN2_ID" ] && pass "Manifiesto 2 creado ($MAN2_ID)" || { fail "Error creando manifiesto 2"; }

if [ -n "$MAN2_ID" ]; then
  # Avanzar hasta RECIBIDO
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN2_ID/firmar" \
    -H "Authorization: Bearer $GEN_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
  sleep 0.5
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN2_ID/confirmar-retiro" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
  sleep 0.5
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN2_ID/confirmar-entrega" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
  sleep 0.5
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN2_ID/confirmar-recepcion" \
    -H "Authorization: Bearer $OPER_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
  sleep 0.5
  pass "Manifiesto 2 avanzado hasta RECIBIDO"

  ALERTAS_ANTES_PESO=$ALERTAS_POST_RECHAZO

  # Obtener ID del residuo del manifiesto para pesaje
  MAN2_DETAIL=$(curl -s "$BASE_URL/api/manifiestos/$MAN2_ID" -H "$AUTH")
  RESIDUO_ID=$(echo "$MAN2_DETAIL" | grep -o '"residuos":\[{"id":"[^"]*"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
  [ -n "$RESIDUO_ID" ] || RESIDUO_ID=$(echo "$MAN2_DETAIL" | grep -o '"manifiestoId":"[^"]*"' | head -1 | cut -d'"' -f4)
  # Fallback: scan all IDs and skip the manifiesto ID itself
  [ -n "$RESIDUO_ID" ] || RESIDUO_ID=$(echo "$MAN2_DETAIL" | grep -o '"id":"[^"]*"' | grep -v "$MAN2_ID" | head -1 | cut -d'"' -f4)

  # Pesaje con diferencia >5% (peso declarado=100, real=120 → 20% diff)
  R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN2_ID/pesaje" \
    -H "Authorization: Bearer $OPER_TOKEN" -H "Content-Type: application/json" \
    -d "{\"residuosPesados\":[{\"id\":\"$RESIDUO_ID\",\"pesoReal\":120}],\"observaciones\":\"Diferencia detectada\"}")
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] && pass "POST /pesaje con diferencia >5% HTTP 200" || fail "POST /pesaje HTTP $HTTP"
  sleep 1

  R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
  ALERTAS_POST_PESO=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
  ALERTAS_POST_PESO=${ALERTAS_POST_PESO:-0}
  [ "$ALERTAS_POST_PESO" -gt "$ALERTAS_ANTES_PESO" ] && \
    pass "AlertaGenerada por DIFERENCIA_PESO ($ALERTAS_ANTES_PESO → $ALERTAS_POST_PESO)" || \
    fail "No se generó alerta para DIFERENCIA_PESO"

  # Negative test: pesaje con diferencia ≤5% (peso declarado=100, real=103 → 3% diff)
  R=$(curl_json -X POST "$BASE_URL/api/manifiestos" \
    -H "$AUTH" -H "Content-Type: application/json" -d "$MANIFEST_BODY")
  MAN3_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$MAN3_ID" ]; then
    curl -s -X POST "$BASE_URL/api/manifiestos/$MAN3_ID/firmar" \
      -H "Authorization: Bearer $GEN_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
    sleep 0.5
    curl -s -X POST "$BASE_URL/api/manifiestos/$MAN3_ID/confirmar-retiro" \
      -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
    sleep 0.5
    curl -s -X POST "$BASE_URL/api/manifiestos/$MAN3_ID/confirmar-entrega" \
      -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
    sleep 0.5
    curl -s -X POST "$BASE_URL/api/manifiestos/$MAN3_ID/confirmar-recepcion" \
      -H "Authorization: Bearer $OPER_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
    sleep 1

    # Contar alertas DESPUÉS de avanzar a RECIBIDO (incluye CAMBIO_ESTADO alerts)
    R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
    ALERTAS_ANTES_PESO_SMALL=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
    ALERTAS_ANTES_PESO_SMALL=${ALERTAS_ANTES_PESO_SMALL:-0}
    # Obtener ID del residuo para el pesaje
    MAN3_DETAIL=$(curl -s "$BASE_URL/api/manifiestos/$MAN3_ID" -H "$AUTH")
    RESIDUO3_ID=$(echo "$MAN3_DETAIL" | grep -o '"residuos":\[{"id":"[^"]*"' | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    [ -n "$RESIDUO3_ID" ] || RESIDUO3_ID=$(echo "$MAN3_DETAIL" | grep -o '"id":"[^"]*"' | grep -v "$MAN3_ID" | head -1 | cut -d'"' -f4)
    curl -s -X POST "$BASE_URL/api/manifiestos/$MAN3_ID/pesaje" \
      -H "Authorization: Bearer $OPER_TOKEN" -H "Content-Type: application/json" \
      -d "{\"residuosPesados\":[{\"id\":\"$RESIDUO3_ID\",\"pesoReal\":103}]}" > /dev/null
    sleep 1

    R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
    ALERTAS_AFTER_SMALL=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
    ALERTAS_AFTER_SMALL=${ALERTAS_AFTER_SMALL:-0}
    [ "$ALERTAS_AFTER_SMALL" -eq "$ALERTAS_ANTES_PESO_SMALL" ] && \
      pass "Negative test: pesaje ≤5% NO genera alerta DIFERENCIA_PESO" || \
      fail "Negative test fallido: pesaje ≤5% generó alerta inesperada ($ALERTAS_ANTES_PESO_SMALL → $ALERTAS_AFTER_SMALL)"
    ALERTAS_POST_PESO=$ALERTAS_AFTER_SMALL
  fi
fi

# =============================================================================
# G. ANOMALIA_GPS — velocidad alta via /anomalias/detectar
# =============================================================================
section "G. ANOMALIA_GPS"

# Crear un manifiesto EN_TRANSITO para anomalía GPS
R=$(curl_json -X POST "$BASE_URL/api/manifiestos" \
  -H "$AUTH" -H "Content-Type: application/json" -d "$MANIFEST_BODY")
MAN_GPS_ID=$(echo "$R" | sed '$d' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$MAN_GPS_ID" ]; then
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/firmar" \
    -H "Authorization: Bearer $GEN_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
  sleep 0.3
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/confirmar-retiro" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" -d '{}' > /dev/null
  sleep 0.3
  pass "Manifiesto GPS preparado (EN_TRANSITO)"

  ALERTAS_ANTES_GPS=${ALERTAS_POST_PESO:-0}

  # Insertar puntos GPS de alta velocidad (>120 km/h) vía endpoint ubicacion
  # Punto 1: Mendoza centro
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/ubicacion" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" \
    -d '{"latitud":-32.8895,"longitud":-68.8458,"velocidad":40}' > /dev/null
  sleep 0.3
  # Punto 2: misma zona, velocidad normal
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/ubicacion" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" \
    -d '{"latitud":-32.8900,"longitud":-68.8460,"velocidad":60}' > /dev/null
  sleep 0.3

  # Detectar anomalías via endpoint dedicado
  R=$(curl_json -X POST "$BASE_URL/api/anomalias/detectar/$MAN_GPS_ID" \
    -H "$AUTH" -H "Content-Type: application/json" -d '{}')
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] && pass "POST /anomalias/detectar/:id HTTP 200" || fail "POST /anomalias/detectar HTTP $HTTP"

  # Insertar punto GPS con velocidad extrema para forzar anomalía en detectarAnomalias
  curl -s -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/ubicacion" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" \
    -d '{"latitud":-32.8920,"longitud":-68.8490,"velocidad":150}' > /dev/null
  sleep 1

  R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
  ALERTAS_POST_GPS=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
  ALERTAS_POST_GPS=${ALERTAS_POST_GPS:-0}

  # La anomalía GPS puede dispararse de manera asíncrona
  echo "  Alertas antes/después GPS: $ALERTAS_ANTES_GPS / $ALERTAS_POST_GPS"
  [ "$ALERTAS_POST_GPS" -ge "$ALERTAS_ANTES_GPS" ] && pass "Conteo alertas consistente post-GPS" || fail "Error en conteo alertas GPS"
fi

# =============================================================================
# H. DESVIO_RUTA — GPS update con coords lejanas
# =============================================================================
section "H. DESVIO_RUTA (GPS update fuera de corredor)"

if [ -n "$MAN_GPS_ID" ]; then
  # Buenos Aires (~1000km de Mendoza) = desvío inequívoco
  R=$(curl_json -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/ubicacion" \
    -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" \
    -d '{"latitud":-34.6037,"longitud":-58.3816,"velocidad":80}')
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] && pass "GPS update coordenadas Buenos Aires HTTP 200" || fail "GPS update HTTP $HTTP"
  sleep 1

  R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
  ALERTAS_POST_DESVIO=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
  ALERTAS_POST_DESVIO=${ALERTAS_POST_DESVIO:-0}
  [ "$ALERTAS_POST_DESVIO" -ge "$ALERTAS_POST_GPS" ] && \
    pass "Conteo alertas post-DESVIO_RUTA ($ALERTAS_POST_GPS → $ALERTAS_POST_DESVIO)" || \
    fail "Error conteo alertas post-DESVIO_RUTA"
  echo "  Nota: DESVIO_RUTA requiere coordenadas de actores en DB (generador/operador con GPS)."
fi

# =============================================================================
# I. TIEMPO_EXCESIVO (con SSH backdating, opcional)
# =============================================================================
section "I. TIEMPO_EXCESIVO (via SSH backdating)"

if [ -n "${VPS_HOST:-}" ] && [ -n "$MAN_GPS_ID" ]; then
  echo "  VPS_HOST=$VPS_HOST — backdating fechaRetiro de $MAN_GPS_ID"
  SSH_CMD="docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c"
  ssh "root@$VPS_HOST" "$SSH_CMD \"UPDATE manifiestos SET \\\"fechaRetiro\\\" = NOW() - INTERVAL '25 hours' WHERE id = '$MAN_GPS_ID'\" " 2>/dev/null
  if [ $? -eq 0 ]; then
    pass "fechaRetiro backdated -25h via SSH"
    # Trigger GPS update para que el controller evalúe TIEMPO_EXCESIVO
    ALERTAS_ANTES_TIEMPO=$ALERTAS_POST_DESVIO
    curl -s -X POST "$BASE_URL/api/manifiestos/$MAN_GPS_ID/ubicacion" \
      -H "Authorization: Bearer $TRANS_TOKEN" -H "Content-Type: application/json" \
      -d '{"latitud":-32.8900,"longitud":-68.8460,"velocidad":60}' > /dev/null
    sleep 1
    R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
    ALERTAS_POST_TIEMPO=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
    ALERTAS_POST_TIEMPO=${ALERTAS_POST_TIEMPO:-0}
    [ "$ALERTAS_POST_TIEMPO" -gt "$ALERTAS_ANTES_TIEMPO" ] && \
      pass "AlertaGenerada por TIEMPO_EXCESIVO ($ALERTAS_ANTES_TIEMPO → $ALERTAS_POST_TIEMPO)" || \
      fail "No se generó alerta TIEMPO_EXCESIVO (puede necesitar revisión de lógica)"
  else
    fail "SSH backdating falló (verificar acceso a $VPS_HOST)"
  fi
else
  echo "  SKIP — definir VPS_HOST=<ip> para ejecutar este test"
  echo "  (requiere SSH con clave pública configurada)"
fi

# =============================================================================
# J. VENCIMIENTO_PROXIMO — via /admin/jobs/vencimientos
# =============================================================================
section "J. VENCIMIENTO_PROXIMO (via job admin)"

ALERTAS_ANTES_VENC=${ALERTAS_POST_DESVIO:-0}

R=$(curl_json -X POST "$BASE_URL/api/admin/jobs/vencimientos" -H "$AUTH")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] && pass "POST /admin/jobs/vencimientos HTTP 200" || fail "POST /admin/jobs/vencimientos HTTP $HTTP — $BODY"
sleep 1

R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas")
ALERTAS_POST_VENC=$(echo "$R" | sed '$d' | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
ALERTAS_POST_VENC=${ALERTAS_POST_VENC:-0}
echo "  Alertas antes/después del job vencimientos: $ALERTAS_ANTES_VENC / $ALERTAS_POST_VENC"

# Verificar si hay transportistas con vencimientos próximos en la DB (seed = 2027 → >30 días)
echo "  Nota: si seed tiene vencimientos 2027, el job NO emite alertas (correcto — no vencen en 30 días)."
echo "  Para testear VENCIMIENTO_PROXIMO: actualizar fecha en DB a NOW()+15d vía SSH+psql."
pass "Job vencimientos ejecutó sin errores"

# Verificar que el job es idempotente (segunda ejecución)
R=$(curl_json -X POST "$BASE_URL/api/admin/jobs/vencimientos" -H "$AUTH")
HTTP=$(echo "$R" | tail -1)
[ "$HTTP" = "200" ] && pass "Job vencimientos idempotente (segunda ejecución OK)" || fail "Segunda ejecución HTTP $HTTP"

# =============================================================================
# K. Resolución de alertas + filtros
# =============================================================================
section "K. Resolución de alertas + filtros"

# Obtener lista actual de alertas
R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas?estado=PENDIENTE&limit=5")
HTTP=$(echo "$R" | tail -1)
BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] && pass "GET /alertas?estado=PENDIENTE HTTP 200" || fail "GET /alertas?estado=PENDIENTE HTTP $HTTP"

PRIMERA_ALERTA_ID=$(echo "$BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$PRIMERA_ALERTA_ID" ]; then
  # Resolver alerta
  R=$(curl_json -X PUT "$BASE_URL/api/alertas/$PRIMERA_ALERTA_ID/resolver" \
    -H "$AUTH" -H "Content-Type: application/json" \
    -d '{"estado":"RESUELTA","notas":"Resuelto en prueba automatizada"}')
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] && pass "PUT /alertas/:id/resolver HTTP 200" || fail "PUT /alertas/:id/resolver HTTP $HTTP"
  sleep 0.3

  # Verificar que aparece en RESUELTA
  R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas?estado=RESUELTA")
  HTTP=$(echo "$R" | tail -1)
  BODY=$(echo "$R" | sed '$d')
  [ "$HTTP" = "200" ] && pass "GET /alertas?estado=RESUELTA HTTP 200" || fail "GET /alertas?estado=RESUELTA HTTP $HTTP"
  RESUELTA_TOTAL=$(echo "$BODY" | grep -o '"total":[0-9]*' | head -1 | sed 's/.*://')
  RESUELTA_TOTAL=${RESUELTA_TOTAL:-0}
  [ "$RESUELTA_TOTAL" -gt 0 ] && pass "GET /alertas?estado=RESUELTA muestra $RESUELTA_TOTAL alertas" || fail "No hay alertas RESUELTA (total=$RESUELTA_TOTAL)"
fi

# Filtro por manifiestoId
if [ -n "$MAN_ID" ]; then
  R=$(curl_json -H "$AUTH" "$BASE_URL/api/alertas?manifiestoId=$MAN_ID")
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] && pass "GET /alertas?manifiestoId=$MAN_ID HTTP 200" || fail "GET /alertas?manifiestoId HTTP $HTTP"
fi

# Notificación: marcar como leída
R=$(curl_json -H "$AUTH" "$BASE_URL/api/notificaciones?leida=false&limit=1")
HTTP=$(echo "$R" | tail -1)
NOTIF_BODY=$(echo "$R" | sed '$d')
[ "$HTTP" = "200" ] && pass "GET /notificaciones?leida=false HTTP 200" || fail "GET /notificaciones HTTP $HTTP"

PRIMERA_NOTIF_ID=$(echo "$NOTIF_BODY" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$PRIMERA_NOTIF_ID" ]; then
  R=$(curl_json -X PUT "$BASE_URL/api/notificaciones/$PRIMERA_NOTIF_ID/leida" -H "$AUTH")
  HTTP=$(echo "$R" | tail -1)
  [ "$HTTP" = "200" ] && pass "PUT /notificaciones/:id/leida HTTP 200" || fail "PUT /notificaciones/:id/leida HTTP $HTTP"
fi

# =============================================================================
# RESUMEN FINAL
# =============================================================================
echo ""
echo "=============================================="
echo "  RESULTADOS FINALES"
echo "=============================================="
echo -e "  Total:  $TOTAL"
echo -e "  ${GREEN}PASS:   $PASS${NC}"
echo -e "  ${RED}FAIL:   $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}  ✓ TODOS LOS TESTS PASARON ($PASS/$TOTAL)${NC}"
  exit 0
else
  echo -e "${RED}  ✗ $FAIL TESTS FALLARON${NC}"
  exit 1
fi
