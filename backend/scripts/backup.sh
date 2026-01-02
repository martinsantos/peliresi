#!/bin/bash
# Script de backup automatizado para SITREP Producción
# Ejecutar con cron: 0 3 * * * /home/sitrep-prod/scripts/backup.sh

set -e

# Configuración
BACKUP_DIR="/backups/sitrep-prod"
DB_CONTAINER="directus-admin-database-1"
DB_NAME="sitrep_prod"
DB_USER="directus"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

echo "[$DATE] Iniciando backup de $DB_NAME..."

# Backup de base de datos
BACKUP_FILE="$BACKUP_DIR/backup_${DATE}.sql.gz"
docker exec $DB_CONTAINER pg_dump -U $DB_USER -d $DB_NAME | gzip > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "[$DATE] ✅ Backup creado: $BACKUP_FILE"
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$DATE] Tamaño: $SIZE"
else
    echo "[$DATE] ❌ Error al crear backup"
    exit 1
fi

# Limpiar backups antiguos
echo "[$DATE] Limpiando backups mayores a $RETENTION_DAYS días..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Contar backups restantes
COUNT=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
echo "[$DATE] ✅ Backups disponibles: $COUNT"

echo "[$DATE] Backup completado exitosamente"
