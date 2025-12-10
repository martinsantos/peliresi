#!/bin/bash
# Script para optimizar animaciones WebP y copiarlas al directorio del manual

SOURCE_DIR="/Users/santosma/.gemini/antigravity/brain/5a39f39f-c244-4347-8a5d-14ce17a03b3c"
DEST_DIR="docs/screenshots/animations"

mkdir -p "$DEST_DIR"

echo "📦 Optimizando y copiando animaciones..."

# Lista de animaciones a procesar
declare -A ANIMATIONS=(
    ["login_dashboard"]="login_dashboard_*.webp"
    ["admin_menu_navegacion"]="admin_menu_navegacion_*.webp"
    ["demoapp_selector_onboarding"]="demoapp_selector_onboarding_*.webp"
    ["transportista_viaje"]="transportista_viaje_*.webp"
    ["operador_recepcion"]="operador_recepcion_*.webp"
    ["reportes_exportacion"]="reportes_exportacion_*.webp"
    ["tracking_gps_mapa"]="tracking_gps_mapa_*.webp"
)

for name in "${!ANIMATIONS[@]}"; do
    pattern="${ANIMATIONS[$name]}"
    source_file=$(ls -1 "$SOURCE_DIR"/$pattern 2>/dev/null | head -1)
    
    if [ -f "$source_file" ]; then
        original_size=$(du -h "$source_file" | cut -f1)
        echo "  ⏳ $name ($original_size)..."
        
        # Copiar directamente (WebP ya está optimizado)
        cp "$source_file" "$DEST_DIR/${name}.webp"
        
        if [ -f "$DEST_DIR/${name}.webp" ]; then
            new_size=$(du -h "$DEST_DIR/${name}.webp" | cut -f1)
            echo "  ✅ $name -> $new_size"
        else
            echo "  ❌ Error copiando $name"
        fi
    else
        echo "  ⚠️ No encontrado: $pattern"
    fi
done

echo ""
echo "📊 Resultado final:"
ls -lh "$DEST_DIR"/*.webp 2>/dev/null || echo "No hay archivos WebP"
echo ""
echo "✅ Proceso completado"
