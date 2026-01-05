
echo "--- Iniciando Diagnóstico de Base de Datos SITREP ---"
DB_NAME="trazabilidad_rrpp"
USER_OLD="santosma"
PASS_OLD="gsiB%s@0yD"
USER_NEW="sitrep_user"
PASS_NEW="Sitrep2025Prod"

echo "1. Probando conexión con usuario NEW (sitrep_user)..."
PGPASSWORD=$PASS_NEW psql -U $USER_NEW -d $DB_NAME -h localhost -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "SUCCESS: sitrep_user conectó correctamente."
else
    echo "FAILURE: sitrep_user NO pudo conectar."
fi

echo "2. Probando conexión con usuario OLD (santosma) y pass literal..."
PGPASSWORD=$PASS_OLD psql -U $USER_OLD -d $DB_NAME -h localhost -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "SUCCESS: santosma conectó con pass literal."
else
    echo "FAILURE: santosma NO pudo conectar con pass literal."
fi

echo "3. Verificando esquema public en $DB_NAME..."
PGPASSWORD=$PASS_NEW psql -U $USER_NEW -d $DB_NAME -h localhost -c "\dt public.*" 2>/dev/null | grep -q "usuario"
if [ $? -eq 0 ]; then
    echo "SUCCESS: Las tablas existen en el esquema public."
else
    echo "WARNING: No se encontraron tablas o no se pudo acceder."
fi
