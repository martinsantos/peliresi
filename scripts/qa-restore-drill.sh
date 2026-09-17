#!/usr/bin/env bash
# Verificación de recuperación SITREP. Ejecutar sólo desde el servidor espejo.
# Restaura un dump SQL en una base temporal y nunca acepta trazabilidad_rrpp.
set -euo pipefail

archive_path=${1:?Uso: qa-restore-drill.sh /ruta/sitrep-db-AAAAmmdd-HHMMSS.sql.gz}
container_name=${SITREP_POSTGRES_CONTAINER:-directus-admin-database-1}
restore_db=${SITREP_RESTORE_DATABASE:-sitrep_restore_verify_$(date +%Y%m%d%H%M%S)}

if [[ ! -r "$archive_path" ]]; then
  echo "No se puede leer el respaldo indicado." >&2
  exit 1
fi

if [[ ! "$restore_db" =~ ^sitrep_restore_verify_[0-9]{8,14}$ ]]; then
  echo "La base temporal debe llamarse sitrep_restore_verify_YYYYMMDD[HHMMSS]." >&2
  exit 1
fi

if [[ "$restore_db" == "trazabilidad_rrpp" ]]; then
  echo "Se rechazó una restauración sobre producción." >&2
  exit 1
fi

cleanup() {
  docker exec "$container_name" rm -f /tmp/sitrep-restore-drill.sql >/dev/null 2>&1 || true
  docker exec "$container_name" dropdb -U directus "$restore_db" >/dev/null 2>&1 || true
}

trap cleanup EXIT

gzip -t "$archive_path"
docker exec "$container_name" createdb -U directus "$restore_db"
gzip -cd "$archive_path" | docker exec -i "$container_name" sh -c 'cat > /tmp/sitrep-restore-drill.sql'
docker exec "$container_name" psql -U directus -v ON_ERROR_STOP=1 -d "$restore_db" -f /tmp/sitrep-restore-drill.sql >/dev/null
docker exec "$container_name" psql -U directus -d "$restore_db" -Atc "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"

echo "Restore drill OK: $restore_db"
