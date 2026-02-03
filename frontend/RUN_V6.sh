#!/bin/bash

# Script para ejecutar SITREP v6 en paralelo
# ==========================================

PORT=5174

echo "🚀 Iniciando SITREP v6 Revolution..."
echo "===================================="
echo ""

# Check if port is in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ El puerto $PORT ya está en uso"
    echo "   Deteniendo proceso anterior..."
    lsof -Pi :$PORT -sTCP:LISTEN -t | xargs kill -9 2>/dev/null
    sleep 1
fi

echo "📦 Instalando dependencias si es necesario..."
npm install --legacy-peer-deps 2>/dev/null || npm install

echo ""
echo "🌐 Iniciando servidor de desarrollo..."
echo "   URL: http://localhost:$PORT/v6/"
echo ""
echo "📱 La UI v6 está corriendo en PARALELO a la actual (puerto 5173)"
echo ""

npx vite --config vite.config.v6.ts --port $PORT
