#!/bin/bash
# ============================================
# SITREP Health Check Script - v2.0
# Sistema de Trazabilidad de Residuos Peligrosos
# Monitoreo automático con alertas por email
# ============================================

BASE_URL="https://www.ultimamilla.com.ar/demoambiente"
ALERT_ENDPOINT="https://viveroloscocos.com.ar/sitrep-alert.php"
LOG_FILE="/var/log/sitrep-health.log"
STATUS_FILE="/tmp/sitrep-last-status"

# Rutas críticas a verificar
ROUTES=(
    "dashboard"
    "manifiestos"
    "tracking"
    "demo-app"
    "manual/MANUAL_TUTORIAL.html"
)

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
ALL_OK=true
FAILED_ROUTES=""

# Verificar cada ruta
for route in "${ROUTES[@]}"; do
    URL="$BASE_URL/$route"
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$URL" 2>/dev/null)
    
    if [ "$HTTP_CODE" == "200" ]; then
        echo "$TIMESTAMP - OK - /$route" >> "$LOG_FILE"
    else
        ALL_OK=false
        FAILED_ROUTES="$FAILED_ROUTES /$route($HTTP_CODE)"
        echo "$TIMESTAMP - FAIL - /$route - HTTP $HTTP_CODE" >> "$LOG_FILE"
    fi
done

# Procesar resultado
if [ "$ALL_OK" = true ]; then
    # Todo OK - guardar estado
    echo "OK" > "$STATUS_FILE"
    echo "$TIMESTAMP - All services operational" >> "$LOG_FILE"
else
    # Hay fallas - verificar si ya enviamos alerta recientemente
    LAST_STATUS=$(cat "$STATUS_FILE" 2>/dev/null || echo "OK")
    
    if [ "$LAST_STATUS" != "FAIL" ]; then
        # Primer fallo detectado - enviar alerta
        echo "FAIL" > "$STATUS_FILE"
        echo "$TIMESTAMP - ALERT SENT - Routes:$FAILED_ROUTES" >> "$LOG_FILE"
        
        # Enviar alerta via PHP endpoint
        ENCODED_ROUTES=$(echo "$FAILED_ROUTES" | sed 's/ /%20/g')
        curl -s "$ALERT_ENDPOINT?routes=$ENCODED_ROUTES&message=Caida_detectada" > /dev/null 2>&1
    else
        # Ya estaba en fallo - no enviar alerta duplicada
        echo "$TIMESTAMP - STILL FAILING - Routes:$FAILED_ROUTES (no duplicate alert)" >> "$LOG_FILE"
    fi
fi

# Mantener log pequeño (últimas 1000 líneas)
tail -1000 "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && mv "$LOG_FILE.tmp" "$LOG_FILE" 2>/dev/null
