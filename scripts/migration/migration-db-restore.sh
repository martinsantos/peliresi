#!/usr/bin/env bash
# ============================================================
# SITREP Migration — DB Restore (run on NEW server)
# Imports a pg_dump into the new sitrep-database container
# and verifies row counts.
# ============================================================

set -euo pipefail

DUMP_FILE="${1:?Usage: $0 <dump.sql.gz>}"
NEW_CONTAINER="${NEW_CONTAINER:-sitrep-database}"
NEW_DB="${NEW_DB:-trazabilidad_rrpp}"
NEW_USER="${NEW_USER:-sitrep}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "FAIL: dump file not found: $DUMP_FILE"
  exit 1
fi

SIZE=$(du -h "$DUMP_FILE" | cut -f1)

echo "================================================"
echo "  SITREP Migration — DB Restore"
echo "  Source dump: $DUMP_FILE ($SIZE)"
echo "  Target: $NEW_CONTAINER / $NEW_DB"
echo "================================================"
echo ""

# Verify target container exists
echo "[1/5] Verifying target container..."
if ! docker ps --format '{{.Names}}' | grep -q "^${NEW_CONTAINER}\$"; then
  echo "FAIL: container '$NEW_CONTAINER' not running"
  echo "Run setup first: see DEPLOY-VPN-SERVER.md Section 3"
  exit 1
fi

if ! docker exec "$NEW_CONTAINER" pg_isready -U "$NEW_USER" -d "$NEW_DB" 2>/dev/null; then
  echo "FAIL: container not accepting connections"
  exit 1
fi
echo "  OK"

# Stop backend (may be running)
echo ""
echo "[2/5] Stopping backend (if running)..."
if pm2 list 2>/dev/null | grep -q sitrep-backend; then
  pm2 stop sitrep-backend
  echo "  Backend stopped"
else
  echo "  Backend not running (OK)"
fi

# Drop existing data
echo ""
echo "[3/5] Clearing target database..."
docker exec "$NEW_CONTAINER" psql -U "$NEW_USER" -d postgres <<SQL
SELECT pg_terminate_backend(pid) FROM pg_stat_activity
WHERE datname = '$NEW_DB' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS $NEW_DB;
CREATE DATABASE $NEW_DB OWNER $NEW_USER;
SQL
echo "  OK"

# Restore
echo ""
echo "[4/5] Restoring dump (this may take a while)..."
gunzip -c "$DUMP_FILE" | docker exec -i "$NEW_CONTAINER" psql -U "$NEW_USER" -d "$NEW_DB" 2>&1 | tail -20
echo "  OK"

# Verify row counts
echo ""
echo "[5/5] Verifying row counts..."
docker exec "$NEW_CONTAINER" psql -U "$NEW_USER" -d "$NEW_DB" -t -c "
SELECT 'usuarios: ' || COUNT(*) FROM usuarios;
SELECT 'manifiestos: ' || COUNT(*) FROM manifiestos;
SELECT 'generadores: ' || COUNT(*) FROM generadores;
SELECT 'transportistas: ' || COUNT(*) FROM transportistas;
SELECT 'operadores: ' || COUNT(*) FROM operadores;
SELECT 'tracking_gps: ' || COUNT(*) FROM tracking_gps;
SELECT 'eventos_manifiesto: ' || COUNT(*) FROM eventos_manifiesto;
SELECT 'auditorias: ' || COUNT(*) FROM auditorias;
"

echo ""
echo "================================================"
echo "  RESTORE COMPLETE"
echo ""
echo "  Next steps:"
echo "  1. cd /var/www/sitrep-backend && npx prisma generate"
echo "  2. pm2 restart sitrep-backend"
echo "  3. curl http://localhost:3010/api/health"
echo "  4. Run migration-verify.sh"
echo "================================================"
