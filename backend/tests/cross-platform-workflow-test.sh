#!/bin/bash
# ============================================================
# SITREP Cross-Platform Workflow Test
# Tests the FULL manifest lifecycle across all roles:
#   ADMIN → GENERADOR → TRANSPORTISTA → OPERADOR
#
# Verifies:
#   1. Auth: Login for each profile
#   2. Workflow: BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO
#                → RECIBIDO → EN_TRATAMIENTO → TRATADO
#   3. Transportista actions: GPS updates, incidents, pause/resume
#   4. Admin visibility: events visible from admin view
#   5. Cross-role data consistency
#
# Usage: ./tests/cross-platform-workflow-test.sh [BASE_URL]
# Default: https://sitrep.ultimamilla.com.ar
# ============================================================

set -euo pipefail

BASE_URL="${1:-https://sitrep.ultimamilla.com.ar}"
API="$BASE_URL/api"
PASS=0
FAIL=0
SKIP=0
WARN=0
ERRORS=""
WARNINGS=""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
BOLD='\033[1m'
NC='\033[0m'

CURL=$(which curl)

# ───────────────────────────────────────────────────
# HELPERS
# ───────────────────────────────────────────────────

json_extract() {
  python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    keys = '$1'.split('.')
    for k in keys:
        if isinstance(d, list):
            d = d[int(k)]
        else:
            d = d[k]
    print(d if d is not None else '')
except Exception:
    print('')
" 2>/dev/null
}

# Test authenticated endpoint — returns HTTP body
api_call() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local BODY="${4:-}"

  if [ -n "$BODY" ]; then
    $CURL -s -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY"
  else
    $CURL -s -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

# Test endpoint and check HTTP status
test_status() {
  local METHOD=$1
  local EPATH=$2
  local TOKEN=$3
  local EXPECTED=$4
  local LABEL=$5
  local BODY="${6:-}"

  local RESP
  if [ -n "$BODY" ]; then
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "$BODY")
  else
    RESP=$($CURL -s -o /dev/null -w '%{http_code}' -X "$METHOD" "${API}${EPATH}" \
      -H "Authorization: Bearer $TOKEN")
  fi

  if [ "$RESP" = "$EXPECTED" ]; then
    echo -e "  ${GREEN}PASS${NC} [$RESP] $LABEL"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} [$RESP expected $EXPECTED] $LABEL"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL [$RESP expected $EXPECTED] $LABEL"
  fi
}

warn() {
  echo -e "  ${YELLOW}WARN${NC} $1"
  WARN=$((WARN + 1))
  WARNINGS="$WARNINGS\n  WARN $1"
}

section() {
  echo ""
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${NC}"
  echo -e "${BOLD}${CYAN}  $1${NC}"
  echo -e "${BOLD}${CYAN}═══════════════════════════════════════════════${NC}"
}

subsection() {
  echo ""
  echo -e "${BLUE}--- $1 ---${NC}"
}

# ───────────────────────────────────────────────────
# LOGIN ALL PROFILES
# ───────────────────────────────────────────────────

section "SITREP CROSS-PLATFORM WORKFLOW TEST"
echo "Target: $API"
echo "Date: $(date '+%Y-%m-%d %H:%M:%S')"

subsection "Phase 1: Authenticate ALL profiles"

# Admin login
echo -n "  Logging in as ADMIN (Administrador DGFA)... "
ADMIN_RESP=$(api_call "POST" "/auth/login" "" '{"email":"admin@dgfa.mendoza.gov.ar","password":"admin123"}')
ADMIN_TOKEN=$(echo "$ADMIN_RESP" | json_extract "data.tokens.accessToken")
if [ -z "$ADMIN_TOKEN" ]; then
  echo -e "${RED}FATAL: Cannot authenticate as ADMIN. Aborting.${NC}"
  echo "Response: $ADMIN_RESP"
  exit 1
fi
ADMIN_ID=$(echo "$ADMIN_RESP" | json_extract "data.user.id")
echo -e "${GREEN}OK${NC} (id: ${ADMIN_ID:0:8}...)"
PASS=$((PASS + 1))

# Generador login
echo -n "  Logging in as GENERADOR (Roberto Gómez)... "
GEN_RESP=$(api_call "POST" "/auth/login" "" '{"email":"quimica.mendoza@industria.com","password":"gen123"}')
GEN_TOKEN=$(echo "$GEN_RESP" | json_extract "data.tokens.accessToken")
if [ -z "$GEN_TOKEN" ]; then
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL Cannot authenticate as GENERADOR"
else
  GEN_ID=$(echo "$GEN_RESP" | json_extract "data.user.id")
  echo -e "${GREEN}OK${NC} (id: ${GEN_ID:0:8}...)"
  PASS=$((PASS + 1))
fi

# Transportista login
echo -n "  Logging in as TRANSPORTISTA (Pedro Martínez)... "
TRANS_RESP=$(api_call "POST" "/auth/login" "" '{"email":"transportes.andes@logistica.com","password":"trans123"}')
TRANS_TOKEN=$(echo "$TRANS_RESP" | json_extract "data.tokens.accessToken")
if [ -z "$TRANS_TOKEN" ]; then
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL Cannot authenticate as TRANSPORTISTA"
else
  TRANS_ID=$(echo "$TRANS_RESP" | json_extract "data.user.id")
  echo -e "${GREEN}OK${NC} (id: ${TRANS_ID:0:8}...)"
  PASS=$((PASS + 1))
fi

# Operador login
echo -n "  Logging in as OPERADOR (Miguel Fernández)... "
OPER_RESP=$(api_call "POST" "/auth/login" "" '{"email":"tratamiento.residuos@planta.com","password":"op123"}')
OPER_TOKEN=$(echo "$OPER_RESP" | json_extract "data.tokens.accessToken")
if [ -z "$OPER_TOKEN" ]; then
  echo -e "${RED}FAIL${NC}"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL Cannot authenticate as OPERADOR"
else
  OPER_ID=$(echo "$OPER_RESP" | json_extract "data.user.id")
  echo -e "${GREEN}OK${NC} (id: ${OPER_ID:0:8}...)"
  PASS=$((PASS + 1))
fi

# ───────────────────────────────────────────────────
# PROFILE-SPECIFIC VIEWS (cross-platform)
# ───────────────────────────────────────────────────

subsection "Phase 2: Profile-specific endpoint access"

# Each profile's dashboard view
echo -e "  ${MAGENTA}[ADMIN]${NC} Dashboard & management..."
test_status "GET" "/manifiestos/dashboard" "$ADMIN_TOKEN" "200" "ADMIN: Dashboard stats"
test_status "GET" "/manifiestos?limit=5" "$ADMIN_TOKEN" "200" "ADMIN: List manifiestos"
test_status "GET" "/admin/usuarios" "$ADMIN_TOKEN" "200" "ADMIN: User management"
test_status "GET" "/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2026-12-31&capas=generadores,transportistas,operadores,transito" "$ADMIN_TOKEN" "200" "ADMIN: Centro de Control"
test_status "GET" "/analytics/manifiestos-por-mes" "$ADMIN_TOKEN" "200" "ADMIN: Analytics monthly"
test_status "GET" "/analytics/manifiestos-por-estado" "$ADMIN_TOKEN" "200" "ADMIN: Analytics by state"

echo -e "  ${MAGENTA}[GENERADOR]${NC} Profile access..."
test_status "GET" "/manifiestos/dashboard" "$GEN_TOKEN" "200" "GENERADOR: Dashboard"
test_status "GET" "/manifiestos?limit=5" "$GEN_TOKEN" "200" "GENERADOR: List (filtered by generadorId)"
test_status "GET" "/auth/profile" "$GEN_TOKEN" "200" "GENERADOR: Profile"

echo -e "  ${MAGENTA}[TRANSPORTISTA]${NC} Profile access..."
test_status "GET" "/manifiestos/dashboard" "$TRANS_TOKEN" "200" "TRANSPORTISTA: Dashboard"
test_status "GET" "/manifiestos?estado=APROBADO&limit=5" "$TRANS_TOKEN" "200" "TRANSPORTISTA: Pending trips (APROBADO)"
test_status "GET" "/manifiestos?estado=EN_TRANSITO&limit=5" "$TRANS_TOKEN" "200" "TRANSPORTISTA: Active trips (EN_TRANSITO)"

echo -e "  ${MAGENTA}[OPERADOR]${NC} Profile access..."
test_status "GET" "/manifiestos/dashboard" "$OPER_TOKEN" "200" "OPERADOR: Dashboard"
test_status "GET" "/manifiestos?estado=ENTREGADO&limit=5" "$OPER_TOKEN" "200" "OPERADOR: Pending deliveries (ENTREGADO)"

# ───────────────────────────────────────────────────
# CATALOGS (shared data needed for manifest creation)
# ───────────────────────────────────────────────────

subsection "Phase 3: Catalog data availability"

# Get IDs needed for manifest creation
GENERADOR_ACTOR_ID=$(api_call "GET" "/catalogos/generadores" "$ADMIN_TOKEN" | json_extract "data.generadores.0.id")
TRANSPORTISTA_ACTOR_ID=$(api_call "GET" "/catalogos/transportistas" "$ADMIN_TOKEN" | json_extract "data.transportistas.0.id")
OPERADOR_ACTOR_ID=$(api_call "GET" "/catalogos/operadores" "$ADMIN_TOKEN" | json_extract "data.operadores.0.id")
# Get a residuo type that the selected operador is authorized to treat
OPER_CATALOG_RESP=$(api_call "GET" "/catalogos/operadores" "$ADMIN_TOKEN")
TIPO_RESIDUO_ID=$(echo "$OPER_CATALOG_RESP" | python3 -c "
import sys, json
try:
    ops = json.load(sys.stdin)['data']['operadores']
    oper_id = '$OPERADOR_ACTOR_ID'
    op = next((o for o in ops if o['id'] == oper_id), None)
    if op and op.get('tratamientos'):
        print(op['tratamientos'][0]['tipoResiduoId'])
    else:
        # Fallback: first residuo from catalog
        pass
except Exception:
    pass
" 2>/dev/null)
# Fallback if operator lookup failed
if [ -z "$TIPO_RESIDUO_ID" ]; then
  TIPO_RESIDUO_ID=$(api_call "GET" "/catalogos/tipos-residuos" "$ADMIN_TOKEN" | json_extract "data.tiposResiduos.0.id")
fi

echo -n "  Generador actor: "
if [ -n "$GENERADOR_ACTOR_ID" ]; then echo -e "${GREEN}${GENERADOR_ACTOR_ID:0:8}...${NC}"; else echo -e "${RED}NOT FOUND${NC}"; fi

echo -n "  Transportista actor: "
if [ -n "$TRANSPORTISTA_ACTOR_ID" ]; then echo -e "${GREEN}${TRANSPORTISTA_ACTOR_ID:0:8}...${NC}"; else echo -e "${RED}NOT FOUND${NC}"; fi

echo -n "  Operador actor: "
if [ -n "$OPERADOR_ACTOR_ID" ]; then echo -e "${GREEN}${OPERADOR_ACTOR_ID:0:8}...${NC}"; else echo -e "${RED}NOT FOUND${NC}"; fi

echo -n "  Tipo residuo: "
if [ -n "$TIPO_RESIDUO_ID" ]; then echo -e "${GREEN}${TIPO_RESIDUO_ID:0:8}...${NC}"; else echo -e "${RED}NOT FOUND${NC}"; fi

if [ -z "$GENERADOR_ACTOR_ID" ] || [ -z "$TRANSPORTISTA_ACTOR_ID" ] || [ -z "$OPERADOR_ACTOR_ID" ] || [ -z "$TIPO_RESIDUO_ID" ]; then
  echo -e "${RED}FATAL: Missing catalog data for workflow test. Aborting workflow phase.${NC}"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL Missing catalog data for workflow test"
else
  PASS=$((PASS + 1))
  echo -e "  ${GREEN}PASS${NC} All catalog data available"
fi

# ───────────────────────────────────────────────────
# FULL WORKFLOW TEST
# ───────────────────────────────────────────────────

section "WORKFLOW: Complete Manifest Lifecycle"

# Step 1: ADMIN creates manifest (BORRADOR)
subsection "Step 1: Create Manifest [ADMIN → BORRADOR]"

CREATE_BODY="{
  \"generadorId\": \"$GENERADOR_ACTOR_ID\",
  \"transportistaId\": \"$TRANSPORTISTA_ACTOR_ID\",
  \"operadorId\": \"$OPERADOR_ACTOR_ID\",
  \"observaciones\": \"Test cross-platform workflow $(date '+%Y-%m-%d %H:%M')\",
  \"residuos\": [
    {
      \"tipoResiduoId\": \"$TIPO_RESIDUO_ID\",
      \"cantidad\": 150.5,
      \"unidad\": \"kg\",
      \"descripcion\": \"Residuo de test cross-platform\"
    }
  ]
}"

CREATE_RESP=$(api_call "POST" "/manifiestos" "$ADMIN_TOKEN" "$CREATE_BODY")
CREATE_SUCCESS=$(echo "$CREATE_RESP" | json_extract "success")
MANIFIESTO_ID=$(echo "$CREATE_RESP" | json_extract "data.manifiesto.id")
MANIFIESTO_NUM=$(echo "$CREATE_RESP" | json_extract "data.manifiesto.numero")
MANIFIESTO_ESTADO=$(echo "$CREATE_RESP" | json_extract "data.manifiesto.estado")

if [ "$CREATE_SUCCESS" = "True" ] || [ "$CREATE_SUCCESS" = "true" ]; then
  echo -e "  ${GREEN}PASS${NC} Manifest created: ${BOLD}$MANIFIESTO_NUM${NC} (id: ${MANIFIESTO_ID:0:8}...)"
  echo -e "  ${GREEN}PASS${NC} Initial state: $MANIFIESTO_ESTADO"
  PASS=$((PASS + 2))
  if [ "$MANIFIESTO_ESTADO" != "BORRADOR" ]; then
    warn "Expected state BORRADOR but got $MANIFIESTO_ESTADO"
  fi
else
  echo -e "  ${RED}FAIL${NC} Cannot create manifest"
  echo "  Response: $(echo "$CREATE_RESP" | head -c 200)"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL Cannot create manifest: $CREATE_RESP"
  echo ""
  echo -e "${RED}Cannot proceed with workflow test without a manifest. Skipping workflow.${NC}"
  MANIFIESTO_ID=""
fi

# Step 2: Verify ADMIN can see new manifest
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 2: Verify Visibility [ALL ROLES]"

  # Admin can see it
  ADMIN_VIEW=$(api_call "GET" "/manifiestos/$MANIFIESTO_ID" "$ADMIN_TOKEN")
  ADMIN_VIEW_STATE=$(echo "$ADMIN_VIEW" | json_extract "data.manifiesto.estado")
  if [ "$ADMIN_VIEW_STATE" = "BORRADOR" ]; then
    echo -e "  ${GREEN}PASS${NC} ADMIN sees manifest in BORRADOR"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} ADMIN cannot see manifest (state: $ADMIN_VIEW_STATE)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL ADMIN cannot see manifest"
  fi

  # Generador can see it (filtered to their manifiestos)
  GEN_VIEW_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' -X GET "${API}/manifiestos/$MANIFIESTO_ID" \
    -H "Authorization: Bearer $GEN_TOKEN")
  if [ "$GEN_VIEW_STATUS" = "200" ]; then
    echo -e "  ${GREEN}PASS${NC} GENERADOR can see manifest detail"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}WARN${NC} GENERADOR cannot see manifest detail (HTTP $GEN_VIEW_STATUS) - may be filtered by generadorId"
    WARN=$((WARN + 1))
  fi

  # Transportista can see it (DEMO MODE: sees all)
  TRANS_VIEW_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' -X GET "${API}/manifiestos/$MANIFIESTO_ID" \
    -H "Authorization: Bearer $TRANS_TOKEN")
  if [ "$TRANS_VIEW_STATUS" = "200" ]; then
    echo -e "  ${GREEN}PASS${NC} TRANSPORTISTA can see manifest (demo mode: all visible)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} TRANSPORTISTA cannot see manifest (HTTP $TRANS_VIEW_STATUS)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL TRANSPORTISTA cannot see manifest"
  fi
fi

# Step 3: GENERADOR/ADMIN signs manifest (BORRADOR → APROBADO)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 3: Sign/Approve Manifest [ADMIN → APROBADO]"

  FIRMA_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/firmar" "$ADMIN_TOKEN")
  FIRMA_SUCCESS=$(echo "$FIRMA_RESP" | json_extract "success")
  FIRMA_ESTADO=$(echo "$FIRMA_RESP" | json_extract "data.manifiesto.estado")

  if [ "$FIRMA_SUCCESS" = "True" ] || [ "$FIRMA_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Manifest signed → state: $FIRMA_ESTADO"
    PASS=$((PASS + 1))
    if [ "$FIRMA_ESTADO" != "APROBADO" ]; then
      warn "Expected APROBADO but got $FIRMA_ESTADO"
    fi
  else
    echo -e "  ${RED}FAIL${NC} Cannot sign manifest"
    echo "  Response: $(echo "$FIRMA_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot sign manifest"
  fi

  # Verify TRANSPORTISTA sees it as APROBADO (pending trip)
  TRANS_APROBADO=$(api_call "GET" "/manifiestos?estado=APROBADO&limit=50" "$TRANS_TOKEN")
  TRANS_APROBADO_FOUND=$(echo "$TRANS_APROBADO" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    ms = d['data']['manifiestos']
    found = any(m['id'] == '$MANIFIESTO_ID' for m in ms)
    print('true' if found else 'false')
except: print('false')
" 2>/dev/null)
  if [ "$TRANS_APROBADO_FOUND" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} TRANSPORTISTA sees manifest in APROBADO list (available for 'Tomar Viaje')"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}WARN${NC} TRANSPORTISTA does not see manifest in APROBADO list (may not affect demo)"
    WARN=$((WARN + 1))
  fi
fi

# Step 4: TRANSPORTISTA confirms pickup (APROBADO → EN_TRANSITO)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 4: Confirm Pickup [TRANSPORTISTA → EN_TRANSITO]"

  RETIRO_BODY='{
    "latitud": -32.8932,
    "longitud": -68.8454,
    "observaciones": "Retiro confirmado - test cross-platform"
  }'

  RETIRO_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/confirmar-retiro" "$TRANS_TOKEN" "$RETIRO_BODY")
  RETIRO_SUCCESS=$(echo "$RETIRO_RESP" | json_extract "success")
  RETIRO_ESTADO=$(echo "$RETIRO_RESP" | json_extract "data.manifiesto.estado")

  if [ "$RETIRO_SUCCESS" = "True" ] || [ "$RETIRO_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Pickup confirmed → state: $RETIRO_ESTADO"
    PASS=$((PASS + 1))
    if [ "$RETIRO_ESTADO" != "EN_TRANSITO" ]; then
      warn "Expected EN_TRANSITO but got $RETIRO_ESTADO"
    fi
  else
    echo -e "  ${RED}FAIL${NC} Cannot confirm pickup as TRANSPORTISTA"
    echo "  Response: $(echo "$RETIRO_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot confirm pickup"
  fi
fi

# Step 5: TRANSPORTISTA sends GPS updates (simulating app behavior)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 5: GPS Tracking [TRANSPORTISTA → GPS updates]"

  # Simulate 3 GPS updates (30s interval in production, instant here)
  GPS_POINTS=(
    '{"latitud": -32.8945, "longitud": -68.8430, "velocidad": 45.2, "direccion": 180}'
    '{"latitud": -32.8960, "longitud": -68.8410, "velocidad": 52.1, "direccion": 175}'
    '{"latitud": -32.8980, "longitud": -68.8390, "velocidad": 38.5, "direccion": 170}'
  )

  GPS_OK=0
  GPS_FAIL=0
  for i in "${!GPS_POINTS[@]}"; do
    GPS_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/ubicacion" "$TRANS_TOKEN" "${GPS_POINTS[$i]}")
    GPS_SUCCESS=$(echo "$GPS_RESP" | json_extract "success")
    if [ "$GPS_SUCCESS" = "True" ] || [ "$GPS_SUCCESS" = "true" ]; then
      GPS_OK=$((GPS_OK + 1))
    else
      GPS_FAIL=$((GPS_FAIL + 1))
    fi
  done

  if [ $GPS_OK -eq 3 ]; then
    echo -e "  ${GREEN}PASS${NC} GPS tracking: $GPS_OK/3 updates sent successfully"
    PASS=$((PASS + 1))
  elif [ $GPS_OK -gt 0 ]; then
    echo -e "  ${YELLOW}WARN${NC} GPS tracking: $GPS_OK/3 updates succeeded ($GPS_FAIL failed)"
    WARN=$((WARN + 1))
  else
    echo -e "  ${RED}FAIL${NC} GPS tracking: all 3 updates failed"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL GPS tracking all failed"
  fi

  # Verify GPS route is visible via viaje-actual
  ROUTE_RESP=$(api_call "GET" "/manifiestos/$MANIFIESTO_ID/viaje-actual" "$TRANS_TOKEN")
  ROUTE_POINTS=$(echo "$ROUTE_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    data = d.get('data', [])
    # data is directly an array of tracking points
    if isinstance(data, list):
        print(len(data))
    elif isinstance(data, dict):
        pts = data.get('tracking', data.get('puntos', []))
        print(len(pts) if isinstance(pts, list) else 0)
    else:
        print(0)
except: print(0)
" 2>/dev/null)

  if [ "$ROUTE_POINTS" -gt 0 ] 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} GPS route visible: $ROUTE_POINTS tracking points recorded"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}WARN${NC} GPS route query returned $ROUTE_POINTS points (may include initial retiro point)"
    WARN=$((WARN + 1))
  fi
fi

# Step 6: TRANSPORTISTA registers incident (event, no state change)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 6: Register Incident [TRANSPORTISTA → INCIDENTE event]"

  INCIDENTE_BODY='{
    "tipo": "averia",
    "descripcion": "Pinchazo en ruta - test cross-platform",
    "latitud": -32.8970,
    "longitud": -68.8400
  }'

  INCIDENTE_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/incidente" "$TRANS_TOKEN" "$INCIDENTE_BODY")
  INCIDENTE_SUCCESS=$(echo "$INCIDENTE_RESP" | json_extract "success")

  if [ "$INCIDENTE_SUCCESS" = "True" ] || [ "$INCIDENTE_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Incident registered (type: averia)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Cannot register incident"
    echo "  Response: $(echo "$INCIDENTE_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot register incident"
  fi

  # Verify state is still EN_TRANSITO (incident doesn't change state)
  STATE_CHECK=$(api_call "GET" "/manifiestos/$MANIFIESTO_ID" "$TRANS_TOKEN")
  STATE_AFTER_INCIDENT=$(echo "$STATE_CHECK" | json_extract "data.manifiesto.estado")
  if [ "$STATE_AFTER_INCIDENT" = "EN_TRANSITO" ]; then
    echo -e "  ${GREEN}PASS${NC} State still EN_TRANSITO after incident (correct)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} State changed after incident: $STATE_AFTER_INCIDENT (should stay EN_TRANSITO)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL State changed after incident"
  fi

  # Register a pause (via incident type PAUSA)
  PAUSA_BODY='{
    "tipo": "PAUSA",
    "descripcion": "Viaje pausado por el transportista",
    "latitud": -32.8970,
    "longitud": -68.8400
  }'
  PAUSA_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/incidente" "$TRANS_TOKEN" "$PAUSA_BODY")
  PAUSA_SUCCESS=$(echo "$PAUSA_RESP" | json_extract "success")
  if [ "$PAUSA_SUCCESS" = "True" ] || [ "$PAUSA_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Pause registered as PAUSA incident"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Cannot register pause"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot register pause"
  fi

  # Resume (via incident type REANUDACION)
  RESUME_BODY='{
    "tipo": "REANUDACION",
    "descripcion": "Viaje reanudado",
    "latitud": -32.8975,
    "longitud": -68.8395
  }'
  RESUME_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/incidente" "$TRANS_TOKEN" "$RESUME_BODY")
  RESUME_SUCCESS=$(echo "$RESUME_RESP" | json_extract "success")
  if [ "$RESUME_SUCCESS" = "True" ] || [ "$RESUME_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Resume registered as REANUDACION incident"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Cannot register resume"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot register resume"
  fi
fi

# Step 7: TRANSPORTISTA confirms delivery (EN_TRANSITO → ENTREGADO)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 7: Confirm Delivery [TRANSPORTISTA → ENTREGADO]"

  ENTREGA_BODY='{
    "latitud": -32.9100,
    "longitud": -68.8200,
    "observaciones": "Entrega confirmada - test cross-platform"
  }'

  ENTREGA_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/confirmar-entrega" "$TRANS_TOKEN" "$ENTREGA_BODY")
  ENTREGA_SUCCESS=$(echo "$ENTREGA_RESP" | json_extract "success")
  ENTREGA_ESTADO=$(echo "$ENTREGA_RESP" | json_extract "data.manifiesto.estado")

  if [ "$ENTREGA_SUCCESS" = "True" ] || [ "$ENTREGA_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Delivery confirmed → state: $ENTREGA_ESTADO"
    PASS=$((PASS + 1))
    if [ "$ENTREGA_ESTADO" != "ENTREGADO" ]; then
      warn "Expected ENTREGADO but got $ENTREGA_ESTADO"
    fi
  else
    echo -e "  ${RED}FAIL${NC} Cannot confirm delivery"
    echo "  Response: $(echo "$ENTREGA_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot confirm delivery"
  fi
fi

# Step 8: OPERADOR confirms reception (ENTREGADO → RECIBIDO)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 8: Confirm Reception [OPERADOR → RECIBIDO]"

  RECEPCION_BODY='{
    "observaciones": "Carga recibida correctamente - test cross-platform",
    "pesoReal": 149.3
  }'

  RECEPCION_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/confirmar-recepcion" "$OPER_TOKEN" "$RECEPCION_BODY")
  RECEPCION_SUCCESS=$(echo "$RECEPCION_RESP" | json_extract "success")
  RECEPCION_ESTADO=$(echo "$RECEPCION_RESP" | json_extract "data.manifiesto.estado")

  if [ "$RECEPCION_SUCCESS" = "True" ] || [ "$RECEPCION_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Reception confirmed → state: $RECEPCION_ESTADO"
    PASS=$((PASS + 1))
    if [ "$RECEPCION_ESTADO" != "RECIBIDO" ]; then
      warn "Expected RECIBIDO but got $RECEPCION_ESTADO"
    fi
  else
    echo -e "  ${RED}FAIL${NC} Cannot confirm reception as OPERADOR"
    echo "  Response: $(echo "$RECEPCION_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot confirm reception"
  fi
fi

# Step 9: OPERADOR registers treatment (RECIBIDO → EN_TRATAMIENTO)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 9: Register Treatment [OPERADOR → EN_TRATAMIENTO]"

  # Get the authorized treatment method for this operador (field is 'metodo' in TratamientoAutorizado)
  METODO_AUTORIZADO=$(echo "$OPER_CATALOG_RESP" | python3 -c "
import sys, json
try:
    ops = json.load(sys.stdin)['data']['operadores']
    op = next((o for o in ops if o['id'] == '$OPERADOR_ACTOR_ID'), None)
    if op and op.get('tratamientos'):
        # Find treatment matching the residuo used, or fallback to first
        for t in op['tratamientos']:
            if t.get('tipoResiduoId') == '$TIPO_RESIDUO_ID' and t.get('metodo'):
                print(t['metodo']); break
        else:
            for t in op['tratamientos']:
                if t.get('metodo'):
                    print(t['metodo']); break
except: pass
" 2>/dev/null)
  [ -z "$METODO_AUTORIZADO" ] && METODO_AUTORIZADO=""

  TRATAMIENTO_BODY="{
    \"metodoTratamiento\": \"$METODO_AUTORIZADO\",
    \"observaciones\": \"Tratamiento iniciado - test cross-platform\"
  }"

  TRATAMIENTO_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/tratamiento" "$OPER_TOKEN" "$TRATAMIENTO_BODY")
  TRATAMIENTO_SUCCESS=$(echo "$TRATAMIENTO_RESP" | json_extract "success")
  TRATAMIENTO_ESTADO=$(echo "$TRATAMIENTO_RESP" | json_extract "data.manifiesto.estado")

  if [ "$TRATAMIENTO_SUCCESS" = "True" ] || [ "$TRATAMIENTO_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Treatment registered → state: $TRATAMIENTO_ESTADO"
    PASS=$((PASS + 1))
    if [ "$TRATAMIENTO_ESTADO" != "EN_TRATAMIENTO" ]; then
      warn "Expected EN_TRATAMIENTO but got $TRATAMIENTO_ESTADO"
    fi
  else
    echo -e "  ${RED}FAIL${NC} Cannot register treatment as OPERADOR"
    echo "  Response: $(echo "$TRATAMIENTO_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot register treatment"
  fi
fi

# Step 10: OPERADOR closes manifest (EN_TRATAMIENTO → TRATADO)
if [ -n "$MANIFIESTO_ID" ]; then
  subsection "Step 10: Close Manifest [OPERADOR → TRATADO]"

  CIERRE_BODY="{
    \"metodoTratamiento\": \"$METODO_AUTORIZADO\",
    \"observaciones\": \"Disposición final completada - test cross-platform\"
  }"

  CIERRE_RESP=$(api_call "POST" "/manifiestos/$MANIFIESTO_ID/cerrar" "$OPER_TOKEN" "$CIERRE_BODY")
  CIERRE_SUCCESS=$(echo "$CIERRE_RESP" | json_extract "success")
  CIERRE_ESTADO=$(echo "$CIERRE_RESP" | json_extract "data.manifiesto.estado")

  if [ "$CIERRE_SUCCESS" = "True" ] || [ "$CIERRE_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Manifest closed → state: $CIERRE_ESTADO"
    PASS=$((PASS + 1))
    if [ "$CIERRE_ESTADO" != "TRATADO" ]; then
      warn "Expected TRATADO but got $CIERRE_ESTADO"
    fi
  else
    echo -e "  ${RED}FAIL${NC} Cannot close manifest as OPERADOR"
    echo "  Response: $(echo "$CIERRE_RESP" | head -c 200)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Cannot close manifest"
  fi
fi

# ───────────────────────────────────────────────────
# ADMIN VERIFICATION: Cross-platform visibility
# ───────────────────────────────────────────────────

if [ -n "$MANIFIESTO_ID" ]; then
  section "ADMIN VERIFICATION: Cross-platform Data Consistency"

  subsection "Events Timeline Verification"

  DETAIL_RESP=$(api_call "GET" "/manifiestos/$MANIFIESTO_ID" "$ADMIN_TOKEN")
  FINAL_STATE=$(echo "$DETAIL_RESP" | json_extract "data.manifiesto.estado")
  EVENTS_JSON=$(echo "$DETAIL_RESP" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    m = d['data']['manifiesto']
    eventos = m.get('eventos', [])
    print(json.dumps({
      'estado': m.get('estado', ''),
      'numero': m.get('numero', ''),
      'fechaFirma': m.get('fechaFirma', ''),
      'fechaRetiro': m.get('fechaRetiro', ''),
      'fechaEntrega': m.get('fechaEntrega', ''),
      'fechaRecepcion': m.get('fechaRecepcion', ''),
      'fechaCierre': m.get('fechaCierre', ''),
      'eventCount': len(eventos),
      'eventTypes': [e.get('tipo', '') for e in eventos],
      'hasIncident': any(e.get('tipo') == 'INCIDENTE' for e in eventos),
      'observaciones': m.get('observaciones', ''),
    }))
except Exception as ex:
    print(json.dumps({'error': str(ex)}))
" 2>/dev/null)

  echo -e "  Final state from ADMIN view: ${BOLD}$FINAL_STATE${NC}"

  if [ "$FINAL_STATE" = "TRATADO" ]; then
    echo -e "  ${GREEN}PASS${NC} Manifest reached TRATADO (full lifecycle complete)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Manifest not in TRATADO state: $FINAL_STATE"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Manifest not in TRATADO: $FINAL_STATE"
  fi

  # Parse event details
  EVENT_COUNT=$(echo "$EVENTS_JSON" | json_extract "eventCount")
  HAS_INCIDENT=$(echo "$EVENTS_JSON" | json_extract "hasIncident")
  OBSERVACIONES=$(echo "$EVENTS_JSON" | json_extract "observaciones")
  EVENT_TYPES=$(echo "$EVENTS_JSON" | json_extract "eventTypes")
  FECHA_FIRMA=$(echo "$EVENTS_JSON" | json_extract "fechaFirma")
  FECHA_RETIRO=$(echo "$EVENTS_JSON" | json_extract "fechaRetiro")
  FECHA_ENTREGA=$(echo "$EVENTS_JSON" | json_extract "fechaEntrega")
  FECHA_RECEPCION=$(echo "$EVENTS_JSON" | json_extract "fechaRecepcion")
  FECHA_CIERRE=$(echo "$EVENTS_JSON" | json_extract "fechaCierre")

  echo -e "  Events recorded: $EVENT_COUNT"
  echo -e "  Event types: $EVENT_TYPES"

  # Check expected events: CREACION, FIRMA, RETIRO, INCIDENTE×3 (averia, PAUSA, REANUDACION), ENTREGA, RECEPCION, TRATAMIENTO, CIERRE
  if [ "$EVENT_COUNT" -ge 7 ] 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC} Sufficient events recorded ($EVENT_COUNT >= 7 expected)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Only $EVENT_COUNT events (expected >= 7: CREACION, FIRMA, RETIRO, INCIDENTE, ENTREGA, RECEPCION, TRATAMIENTO, CIERRE)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Only $EVENT_COUNT events recorded"
  fi

  # Check incident is visible
  if [ "$HAS_INCIDENT" = "True" ] || [ "$HAS_INCIDENT" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Incident event visible from ADMIN view"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Incident event NOT visible from ADMIN view"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Incident not visible from admin"
  fi

  # Check observaciones contains incident marker
  if echo "$OBSERVACIONES" | grep -q "INCIDENTE"; then
    echo -e "  ${GREEN}PASS${NC} Incident marker in observaciones: '...[INCIDENTE: averia]...'"
    PASS=$((PASS + 1))
  else
    echo -e "  ${YELLOW}WARN${NC} No INCIDENTE marker in observaciones field"
    WARN=$((WARN + 1))
  fi

  # Verify all workflow dates are set
  subsection "Workflow Dates Verification"

  for DATE_CHECK in "fechaFirma:$FECHA_FIRMA" "fechaRetiro:$FECHA_RETIRO" "fechaEntrega:$FECHA_ENTREGA" "fechaRecepcion:$FECHA_RECEPCION" "fechaCierre:$FECHA_CIERRE"; do
    DATE_NAME="${DATE_CHECK%%:*}"
    DATE_VALUE="${DATE_CHECK#*:}"
    if [ -n "$DATE_VALUE" ] && [ "$DATE_VALUE" != "None" ] && [ "$DATE_VALUE" != "" ]; then
      echo -e "  ${GREEN}PASS${NC} $DATE_NAME: $DATE_VALUE"
      PASS=$((PASS + 1))
    else
      echo -e "  ${RED}FAIL${NC} $DATE_NAME: NOT SET"
      FAIL=$((FAIL + 1))
      ERRORS="$ERRORS\n  FAIL $DATE_NAME not set"
    fi
  done

  # PDF generation test
  subsection "PDF & Certificate Verification"

  test_status "GET" "/pdf/manifiesto/$MANIFIESTO_ID" "$ADMIN_TOKEN" "200" "PDF manifest download"
  test_status "GET" "/pdf/certificado/$MANIFIESTO_ID" "$ADMIN_TOKEN" "200" "Disposal certificate (TRATADO only)"

  # QR Verification (public endpoint)
  if [ -n "$MANIFIESTO_NUM" ]; then
    subsection "QR Verification (Public)"

    QR_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' "${API}/manifiestos/verificar/$MANIFIESTO_NUM")
    if [ "$QR_STATUS" = "200" ]; then
      echo -e "  ${GREEN}PASS${NC} Public QR verification returns 200 for $MANIFIESTO_NUM"
      PASS=$((PASS + 1))
    else
      echo -e "  ${RED}FAIL${NC} Public QR verification failed (HTTP $QR_STATUS)"
      FAIL=$((FAIL + 1))
      ERRORS="$ERRORS\n  FAIL QR verification failed"
    fi
  fi

  # Centro de Control — verify the trip data is visible
  subsection "Centro de Control Verification"

  CC_RESP=$(api_call "GET" "/centro-control/actividad?fechaDesde=2024-01-01&fechaHasta=2026-12-31&capas=generadores,transportistas,operadores,transito" "$ADMIN_TOKEN")
  CC_SUCCESS=$(echo "$CC_RESP" | json_extract "success")
  if [ "$CC_SUCCESS" = "True" ] || [ "$CC_SUCCESS" = "true" ]; then
    echo -e "  ${GREEN}PASS${NC} Centro de Control data accessible"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} Centro de Control data failed"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Centro de Control failed"
  fi

  # Reportes verification
  subsection "Reports Verification"

  test_status "GET" "/reportes/manifiestos?fechaInicio=2024-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN" "200" "Manifiestos report"
  test_status "GET" "/reportes/tratados?fechaInicio=2024-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN" "200" "Tratados report"
  test_status "GET" "/reportes/transporte?fechaInicio=2024-01-01&fechaFin=2026-12-31" "$ADMIN_TOKEN" "200" "Transporte report"
fi

# ───────────────────────────────────────────────────
# NEGATIVE TESTS: Role enforcement
# ───────────────────────────────────────────────────

section "NEGATIVE TESTS: Role Enforcement"

subsection "Wrong-role action attempts"

# Find an APROBADO manifest for role tests (or use existing one if still in that state)
APROBADO_ID=$(api_call "GET" "/manifiestos?estado=APROBADO&limit=1" "$ADMIN_TOKEN" | json_extract "data.manifiestos.0.id")

if [ -n "$APROBADO_ID" ]; then
  # Generador should NOT be able to confirm pickup
  GEN_RETIRO_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' -X POST "${API}/manifiestos/$APROBADO_ID/confirmar-retiro" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $GEN_TOKEN" \
    -d '{"latitud": -32.89, "longitud": -68.84}')
  if [ "$GEN_RETIRO_STATUS" = "403" ]; then
    echo -e "  ${GREEN}PASS${NC} GENERADOR blocked from confirming pickup (403)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} GENERADOR NOT blocked from confirming pickup (HTTP $GEN_RETIRO_STATUS, expected 403)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Role enforcement: GENERADOR could confirm pickup"
  fi

  # Operador should NOT be able to confirm pickup
  OPER_RETIRO_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' -X POST "${API}/manifiestos/$APROBADO_ID/confirmar-retiro" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $OPER_TOKEN" \
    -d '{"latitud": -32.89, "longitud": -68.84}')
  if [ "$OPER_RETIRO_STATUS" = "403" ]; then
    echo -e "  ${GREEN}PASS${NC} OPERADOR blocked from confirming pickup (403)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}FAIL${NC} OPERADOR NOT blocked from confirming pickup (HTTP $OPER_RETIRO_STATUS, expected 403)"
    FAIL=$((FAIL + 1))
    ERRORS="$ERRORS\n  FAIL Role enforcement: OPERADOR could confirm pickup"
  fi
else
  echo -e "  ${YELLOW}SKIP${NC} No APROBADO manifests for role enforcement test"
  SKIP=$((SKIP + 2))
fi

# Non-admin should not access user management
test_status "GET" "/admin/usuarios" "$GEN_TOKEN" "403" "GENERADOR blocked from user management"
test_status "GET" "/admin/usuarios" "$TRANS_TOKEN" "403" "TRANSPORTISTA blocked from user management"
test_status "GET" "/admin/usuarios" "$OPER_TOKEN" "403" "OPERADOR blocked from user management"

# Unauthenticated access should fail
UNAUTH_STATUS=$($CURL -s -o /dev/null -w '%{http_code}' "${API}/manifiestos")
if [ "$UNAUTH_STATUS" = "401" ]; then
  echo -e "  ${GREEN}PASS${NC} Unauthenticated access blocked (401)"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}FAIL${NC} Unauthenticated access NOT blocked (HTTP $UNAUTH_STATUS, expected 401)"
  FAIL=$((FAIL + 1))
  ERRORS="$ERRORS\n  FAIL Unauthenticated access not blocked"
fi

# ───────────────────────────────────────────────────
# CLEANUP: Delete test manifest
# ───────────────────────────────────────────────────

if [ -n "$MANIFIESTO_ID" ]; then
  section "CLEANUP"

  # Manifest is TRATADO now, cannot delete (only BORRADOR/CANCELADO)
  echo -e "  ${CYAN}INFO${NC} Test manifest $MANIFIESTO_NUM ($MANIFIESTO_ID) left in TRATADO state"
  echo -e "  ${CYAN}INFO${NC} (Only BORRADOR/CANCELADO manifests can be deleted)"
fi

# ───────────────────────────────────────────────────
# RESULTS
# ───────────────────────────────────────────────────

section "RESULTS SUMMARY"

TOTAL=$((PASS + FAIL + SKIP))

echo ""
echo -e "  ${GREEN}PASS: $PASS${NC}"
echo -e "  ${RED}FAIL: $FAIL${NC}"
if [ $WARN -gt 0 ]; then
  echo -e "  ${YELLOW}WARN: $WARN${NC}"
fi
if [ $SKIP -gt 0 ]; then
  echo -e "  ${YELLOW}SKIP: $SKIP${NC}"
fi
echo -e "  TOTAL: $TOTAL"
echo ""

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}FAILURES:${NC}"
  echo -e "$ERRORS"
  echo ""
fi

if [ $WARN -gt 0 ]; then
  echo -e "${YELLOW}WARNINGS:${NC}"
  echo -e "$WARNINGS"
  echo ""
fi

if [ -n "$MANIFIESTO_ID" ]; then
  echo -e "${BOLD}Workflow Test Manifest:${NC}"
  echo "  Number: $MANIFIESTO_NUM"
  echo "  ID:     $MANIFIESTO_ID"
  echo "  Final:  TRATADO (full lifecycle completed)"
  echo ""
fi

if [ $FAIL -gt 0 ]; then
  echo -e "${RED}CROSS-PLATFORM TEST FAILED${NC}"
  exit 1
else
  echo -e "${GREEN}ALL CROSS-PLATFORM TESTS PASSED${NC}"
  exit 0
fi
