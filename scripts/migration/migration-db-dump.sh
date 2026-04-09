#!/usr/bin/env bash
# ============================================================
# SITREP Migration — DB Dump (run on OLD server)
# Creates pg_dump of trazabilidad_rrpp ready for migration.
# ============================================================

set -euo pipefail

OLD_HOST="${OLD_HOST:-23.105.176.45}"
OLD_CONTAINER="${OLD_CONTAINER:-directus-admin-database-1}"
OLD_DB="${OLD_DB:-trazabilidad_rrpp}"
OLD_USER="${OLD_USER:-directus}"
OUTPUT_DIR="${OUTPUT_DIR:-./migration-dumps}"
DATE=$(date +%Y%m%d-%H%M%S)
OUTPUT_FILE="$OUTPUT_DIR/sitrep-migration-$DATE.sql.gz"

mkdir -p "$OUTPUT_DIR"

echo "================================================"
echo "  SITREP Migration — DB Dump"
echo "  Source: $OLD_HOST / $OLD_CONTAINER / $OLD_DB"
echo "  Output: $OUTPUT_FILE"
echo "================================================"
echo ""

# Verify source DB is reachable
echo "[1/4] Verifying source DB..."
if ! ssh "root@$OLD_HOST" "docker exec $OLD_CONTAINER pg_isready -U $OLD_USER -d $OLD_DB" 2>/dev/null; then
  echo "FAIL: cannot reach source DB on $OLD_HOST"
  exit 1
fi
echo "  OK"

# Get row counts before dump (sanity check)
echo ""
echo "[2/4] Capturing baseline row counts..."
ssh "root@$OLD_HOST" "docker exec $OLD_CONTAINER psql -U $OLD_USER -d $OLD_DB -t -c \"
SELECT 'usuarios: ' || COUNT(*) FROM usuarios;
SELECT 'manifiestos: ' || COUNT(*) FROM manifiestos;
SELECT 'generadores: ' || COUNT(*) FROM generadores;
SELECT 'transportistas: ' || COUNT(*) FROM transportistas;
SELECT 'operadores: ' || COUNT(*) FROM operadores;
SELECT 'tracking_gps: ' || COUNT(*) FROM tracking_gps;
SELECT 'eventos_manifiesto: ' || COUNT(*) FROM eventos_manifiesto;
SELECT 'auditorias: ' || COUNT(*) FROM auditorias;
\"" | tee "$OUTPUT_DIR/baseline-counts-$DATE.txt"

# Dump
echo ""
echo "[3/4] Creating pg_dump..."
ssh "root@$OLD_HOST" "docker exec $OLD_CONTAINER pg_dump \
    -U $OLD_USER \
    -d $OLD_DB \
    --no-owner \
    --no-privileges \
    --clean \
    --if-exists \
  | gzip" > "$OUTPUT_FILE"

if [ ! -s "$OUTPUT_FILE" ]; then
  echo "FAIL: dump file is empty"
  exit 1
fi

SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "  OK — $SIZE"

# Verify dump is valid (zcat | head)
echo ""
echo "[4/4] Verifying dump file..."
LINES=$(zcat "$OUTPUT_FILE" | head -100 | wc -l | tr -d ' ')
if [ "$LINES" -lt 50 ]; then
  echo "FAIL: dump file looks corrupted (too few lines)"
  exit 1
fi
HEADER=$(zcat "$OUTPUT_FILE" | head -3 | tail -1)
echo "  OK — $HEADER"

echo ""
echo "================================================"
echo "  DUMP COMPLETE"
echo "  File: $OUTPUT_FILE ($SIZE)"
echo "  Counts: $OUTPUT_DIR/baseline-counts-$DATE.txt"
echo ""
echo "  Next step: scp $OUTPUT_FILE root@<NEW_HOST>:/tmp/"
echo "             then run migration-db-restore.sh on the new server"
echo "================================================"
