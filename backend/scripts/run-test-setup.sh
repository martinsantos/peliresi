#!/bin/bash

# ============================================================
# SCRIPT: EJECUTAR SETUP DE DATOS DE PRUEBA
# Sistema de Trazabilidad de Residuos Peligrosos
# ============================================================

set -e  # Exit on error

echo "🔧 Configurando datos de prueba en base de datos..."
echo ""

# Leer credenciales de .env
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
else
  echo "❌ Error: Archivo .env no encontrado"
  exit 1
fi

# Extraer DATABASE_URL y limpiar parámetros de query (psql no soporta ?schema=)
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL no definida en .env"
  exit 1
fi

# Quitar parámetros de query (?schema=public) que psql no soporta
DB_URL_CLEAN=$(echo "$DATABASE_URL" | sed 's/\?.*//')

echo "📊 Base de datos: $DB_URL_CLEAN"
echo ""

# Ejecutar script SQL
echo "▶️  Ejecutando script de setup..."
psql "$DB_URL_CLEAN" -f scripts/setup-test-users.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ DATOS DE PRUEBA CREADOS EXITOSAMENTE"
  echo ""
  echo "📋 Credenciales de prueba:"
  echo "   Transportista: transportista@test.com / 123456"
  echo "   Operador:      operador@test.com / 123456"
  echo "   Generador:     generador@test.com / 123456"
  echo ""
  echo "📦 Manifiestos de prueba:"
  echo "   - 2026-TEST001 (APROBADO)"
  echo "   - 2026-TEST002 (APROBADO)"
  echo "   - 2026-TEST003 (APROBADO)"
  echo ""
  echo "🧪 Ahora puedes ejecutar los tests:"
  echo "   cd ../frontend"
  echo "   npx playwright test tests/e2e/offline-stress.spec.ts"
  echo ""
else
  echo "❌ Error al crear datos de prueba"
  exit 1
fi
