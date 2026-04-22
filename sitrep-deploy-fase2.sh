#!/usr/bin/env bash
#
# ============================================================================
# SITREP — FASE 2 — PostgreSQL (apt) + PM2
# ============================================================================
#
# QUE HACE:
#   1. PostgreSQL 16 vía apt (sin Docker — acceso restringido a Docker Hub)
#   2. Configura escucha solo en localhost (127.0.0.1)
#   3. DB sitrep_prod + usuario sitrep con password generado
#   4. Password guardado en /data/postgres/db-password.txt (chmod 600)
#   5. DATABASE_URL template en /data/postgres/DATABASE_URL.txt
#   6. PM2 global + pm2-logrotate
#   7. pm2 startup para ubuntu (servicio systemd)
#
# PRERREQUISITO: Fase 1 completada (Node.js 22 instalado)
#
# CÓMO EJECUTAR:
#   scp sitrep-deploy-fase2.sh sitrepprd1:/tmp/
#   ssh sitrepprd1 "sudo bash /tmp/sitrep-deploy-fase2.sh"
#
# IDEMPOTENCIA:
#   Se puede correr N veces. Chequea estado antes de mutar.
#
# LOGS:
#   /var/log/sitrep-deploy-fase2.log
#
# ============================================================================

set -euo pipefail

LOG=/var/log/sitrep-deploy-fase2.log
exec > >(tee -a "$LOG") 2>&1

say() { printf '\n=== %s === %s\n' "$(date +'%F %T')" "$*"; }
ok()  { printf '    [OK] %s\n' "$*"; }
warn(){ printf '    [WARN] %s\n' "$*"; }

# --- Sanity checks --------------------------------------------------------

[[ $EUID -ne 0 ]] && { echo "ERROR: ejecutar con sudo"; exit 1; }
mountpoint -q /data || { echo "ERROR: /data no está montado"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "ERROR: node no instalado (correr Fase 1)"; exit 1; }

# Forzar IPv4 en apt (la VM tiene IPv6 sin ruta de salida)
if [[ ! -f /etc/apt/apt.conf.d/99force-ipv4 ]]; then
  echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4
  ok "apt forzado a IPv4"
fi

# --- 1/6  Instalar PostgreSQL 16 via apt ----------------------------------

say "1/6 — PostgreSQL 16 via apt"
export DEBIAN_FRONTEND=noninteractive

if dpkg -s postgresql >/dev/null 2>&1; then
  ok "postgresql ya instalado: $(pg_lsclusters | grep main | awk '{print $1,$2,$3}')"
else
  # Ubuntu "resolute" (25.04) trae PostgreSQL 18 como paquete "postgresql"
  apt-get update -qq
  apt-get install -y --no-install-recommends postgresql postgresql-client
  ok "postgresql instalado"
fi

systemctl enable postgresql >/dev/null 2>&1 || true
systemctl start postgresql
sleep 2
systemctl is-active postgresql >/dev/null && ok "postgresql activo" || { echo "ERROR: postgresql no arrancó"; exit 1; }

# --- 2/6  Configurar solo localhost --------------------------------------

say "2/6 — Configurar PostgreSQL (solo localhost)"

PG_CONF=$(pg_lsclusters -h | awk '{print "/etc/postgresql/"$1"/"$2"/postgresql.conf"}' | head -1)
PG_HBA=$(dirname "$PG_CONF")/pg_hba.conf

# listen_addresses = 'localhost' (solo si es diferente)
if grep -q "^listen_addresses = 'localhost'" "$PG_CONF" 2>/dev/null; then
  ok "listen_addresses ya es 'localhost'"
else
  sed -i "s/^#*listen_addresses\s*=.*/listen_addresses = 'localhost'/" "$PG_CONF"
  ok "listen_addresses configurado a 'localhost'"
fi

systemctl reload postgresql
ok "PostgreSQL recargado"

# --- 3/6  Directorio y password ------------------------------------------

say "3/6 — Password DB"
install -d -m 750 -o ubuntu -g ubuntu /data/postgres
PASSFILE=/data/postgres/db-password.txt

if [[ ! -f "$PASSFILE" ]]; then
  DB_PASS=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  echo "$DB_PASS" > "$PASSFILE"
  chmod 600 "$PASSFILE"
  chown ubuntu:ubuntu "$PASSFILE"
  ok "Password generado en $PASSFILE"
else
  DB_PASS=$(cat "$PASSFILE")
  ok "Password existente leído de $PASSFILE"
fi

# --- 4/6  Crear usuario y DB ----------------------------------------------

say "4/6 — Usuario 'sitrep' y DB 'sitrep_prod'"

# Usuario
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='sitrep'" | grep -q 1; then
  ok "Usuario 'sitrep' ya existe"
else
  sudo -u postgres psql -c "CREATE USER sitrep WITH PASSWORD '${DB_PASS}' LOGIN;"
  ok "Usuario 'sitrep' creado"
fi

# DB
if sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='sitrep_prod'" | grep -q 1; then
  ok "DB 'sitrep_prod' ya existe"
else
  sudo -u postgres psql -c "CREATE DATABASE sitrep_prod OWNER sitrep ENCODING 'UTF8' LC_COLLATE 'es_AR.UTF-8' LC_CTYPE 'es_AR.UTF-8' TEMPLATE template0;" 2>/dev/null \
  || sudo -u postgres psql -c "CREATE DATABASE sitrep_prod OWNER sitrep ENCODING 'UTF8';"
  ok "DB 'sitrep_prod' creada"
fi

# Permisos
sudo -u postgres psql -d sitrep_prod -c "GRANT ALL PRIVILEGES ON DATABASE sitrep_prod TO sitrep;" >/dev/null
sudo -u postgres psql -d sitrep_prod -c "GRANT ALL ON SCHEMA public TO sitrep;" >/dev/null
ok "Permisos aplicados"

# Verificar conectividad
export PGPASSWORD="$DB_PASS"
psql -h 127.0.0.1 -U sitrep -d sitrep_prod -c "SELECT 1;" >/dev/null
unset PGPASSWORD
ok "Conexión a sitrep_prod verificada"

# --- 5/6  DATABASE_URL template ------------------------------------------

say "5/6 — DATABASE_URL template"
DB_URL_FILE=/data/postgres/DATABASE_URL.txt
cat > "$DB_URL_FILE" <<EOF
postgresql://sitrep:${DB_PASS}@localhost:5432/sitrep_prod
EOF
chmod 600 "$DB_URL_FILE"
chown ubuntu:ubuntu "$DB_URL_FILE"
ok "DATABASE_URL guardada en $DB_URL_FILE"

# --- 6/6  npm disponible (para usar en Fase 3 con node_modules locales) ---

say "6/6 — Verificar npm (gestor de proceso: systemd — npm registry bloqueado)"

if command -v npm >/dev/null 2>&1; then
  ok "npm disponible: $(npm --version)"
else
  warn "npm no disponible — Fase 3 usará systemd directamente para el backend"
fi
ok "Gestión de proceso: systemd unit (Fase 3 lo crea)"
ok "Logs: journalctl -u sitrep-backend -f"

# --- Resumen final --------------------------------------------------------

say "RESUMEN"
echo "  PostgreSQL ............. $(pg_lsclusters | grep main | awk '{print "cluster",$1,$2,"port",$3}')"
echo "  DB / usuario ........... sitrep_prod / sitrep"
echo "  Password en ............ /data/postgres/db-password.txt"
echo "  DATABASE_URL en ........ /data/postgres/DATABASE_URL.txt"
echo "  pg_hba.conf ............ $PG_HBA"
echo "  Gestor proceso ......... systemd (Fase 3)"
echo "  /data libre ............ $(df -h /data | awk 'NR==2{print $4}')"
echo
echo "Fase 2 OK. Próximo paso: Fase 3 (build + deploy app) desde la Mac."
echo "    bash sitrep-deploy-fase3.sh"
echo "Log completo: $LOG"
