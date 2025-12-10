#!/bin/bash
# ============================================
# SITREP Health Check Script
# Sistema de Trazabilidad de Residuos Peligrosos
# ============================================

BASE_URL="https://www.ultimamilla.com.ar/demoambiente"
LOG_FILE="/var/log/sitrep-health.log"
ADMIN_EMAIL="santosma@gmail.com"

# Rutas críticas a verificar
ROUTES=(
    "dashboard"
    "manifiestos"
    "tracking"
    "demo-app"
    "manual/MANUAL_TUTORIAL.html"
)

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ALL_OK=true
FAILED_ROUTES=""

echo "============================================"
echo "SITREP Health Check - $TIMESTAMP"
echo "============================================"

for route in "${ROUTES[@]}"; do
    URL="$BASE_URL/$route"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL")
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo -e "${GREEN}✓${NC} /$route - HTTP $HTTP_CODE"
    else
        echo -e "${RED}✗${NC} /$route - HTTP $HTTP_CODE (FAILED)"
        ALL_OK=false
        FAILED_ROUTES="$FAILED_ROUTES /$route"
    fi
done

# Verificar assets recientes
ASSETS_OK=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/assets/" 2>/dev/null || echo "000")
if [ "$ASSETS_OK" != "000" ]; then
    echo -e "${GREEN}✓${NC} /assets - Accesible"
else
    echo -e "${YELLOW}⚠${NC} /assets - No verificable directamente"
fi

echo "============================================"

if [ "$ALL_OK" = true ]; then
    echo -e "${GREEN}Estado: TODOS LOS SERVICIOS OPERATIVOS${NC}"
    echo "$TIMESTAMP - OK - All routes healthy" >> "$LOG_FILE"
else
    echo -e "${RED}Estado: FALLAS DETECTADAS${NC}"
    echo "Rutas con problemas:$FAILED_ROUTES"
    echo "$TIMESTAMP - FAIL - Routes:$FAILED_ROUTES" >> "$LOG_FILE"
    
    # Enviar alerta por email
    if command -v mail &> /dev/null; then
        echo "Alerta SITREP: Rutas caídas:$FAILED_ROUTES - $TIMESTAMP" | \
            mail -s "[SITREP ALERTA] Servicio caído detectado" "$ADMIN_EMAIL"
        echo "Alerta enviada a $ADMIN_EMAIL"
    fi
fi

echo "============================================"
