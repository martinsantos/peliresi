#!/usr/bin/env bash
#
# ============================================================================
# SITREP — FASE 1 — Setup base de la VM (Gobierno de Mendoza)
# ============================================================================
#
# QUE HACE:
#   1. Ownership de /data -> ubuntu:ubuntu
#   2. Swapfile 4 GB en /data/swap (swappiness=10)
#   3. apt update + paquetes base (ca-certs, curl, gnupg, jq, htop, git, rsync)
#   4. Docker Engine (docker.io de Ubuntu) con data-root en /data/docker
#   5. Node.js 22 LTS (runtime, sin npm — builds van desde la Mac)
#   6. Nginx
#
# QUE NO HACE (explícito):
#   - NO instala Postgres (se hace en Fase 2)
#   - NO configura Nginx custom (se hace en Fase 3 con la app)
#   - NO abre firewall / UFW
#   - NO modifica SSH, ni sshd_config, ni known_hosts
#   - NO descarga código de SITREP (eso viene por scp desde la Mac)
#   - NO crea usuario 'sitrep' (corremos como 'ubuntu')
#
# IDEMPOTENCIA:
#   Se puede correr N veces sin romper. Cada paso chequea antes de mutar.
#
# CÓMO EJECUTAR:
#   1. Subirlo a la VM:   scp sitrep-deploy-fase1.sh sitrepprd1:/tmp/
#   2. Conectar:          ssh sitrepprd1
#   3. Correr:            sudo bash /tmp/sitrep-deploy-fase1.sh
#
# LOGS:
#   /var/log/sitrep-deploy-fase1.log   (duplica stdout/stderr)
#
# ============================================================================

set -euo pipefail

LOG=/var/log/sitrep-deploy-fase1.log
exec > >(tee -a "$LOG") 2>&1

say() { printf '\n=== %s === %s\n' "$(date +'%F %T')" "$*"; }
ok()  { printf '    [OK] %s\n' "$*"; }
warn(){ printf '    [WARN] %s\n' "$*"; }

# --- Sanity checks --------------------------------------------------------

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: ejecutar con sudo"; exit 1
fi

if ! mountpoint -q /data; then
  echo "ERROR: /data no está montado"; exit 1
fi

if ! id -u ubuntu >/dev/null 2>&1; then
  echo "ERROR: usuario 'ubuntu' no existe"; exit 1
fi

# --- 1/6  Ownership /data -------------------------------------------------

say "1/6 — Ownership de /data"
if [[ "$(stat -c '%U:%G' /data)" != "ubuntu:ubuntu" ]]; then
  chown -R ubuntu:ubuntu /data
  chmod 755 /data
  ok "/data ahora es de ubuntu:ubuntu"
else
  ok "/data ya pertenece a ubuntu:ubuntu"
fi

# --- 2/6  Swap 4 GB en /data/swap -----------------------------------------

say "2/6 — Swap 4 GB en /data/swap (swappiness=10)"
if swapon --show | awk '{print $1}' | grep -qx /data/swap; then
  ok "Swap /data/swap ya activo"
else
  if [[ ! -f /data/swap ]]; then
    fallocate -l 4G /data/swap
    chmod 600 /data/swap
    mkswap /data/swap >/dev/null
    ok "Swapfile /data/swap creado (4 GB)"
  fi
  swapon /data/swap
  ok "Swap activado"
fi

# fstab persistente
if ! grep -qE '^/data/swap[[:space:]]' /etc/fstab; then
  echo "/data/swap none swap sw 0 0" >> /etc/fstab
  ok "Entrada en /etc/fstab agregada"
else
  ok "/etc/fstab ya tiene la entrada"
fi

# swappiness
SYSCTL=/etc/sysctl.d/99-sitrep.conf
if ! grep -q '^vm.swappiness=10$' "$SYSCTL" 2>/dev/null; then
  echo "vm.swappiness=10" > "$SYSCTL"
  sysctl -p "$SYSCTL" >/dev/null
  ok "vm.swappiness=10 aplicado"
else
  ok "swappiness ya configurado"
fi

# --- 3/6  apt update + base -----------------------------------------------

say "3/6 — apt update + paquetes base"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg jq htop unzip git rsync
ok "Paquetes base instalados"

# --- 4/6  Docker ----------------------------------------------------------

say "4/6 — Docker (docker.io de Ubuntu) con data-root en /data/docker"

# Config ANTES de instalar: así Docker arranca con /data/docker desde el primer boot
install -d -m 755 -o root -g root /data/docker
install -d -m 755 /etc/docker
cat > /etc/docker/daemon.json <<'JSON'
{
  "data-root": "/data/docker",
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  },
  "default-address-pools": [
    { "base": "172.20.0.0/16", "size": 24 }
  ]
}
JSON
ok "/etc/docker/daemon.json escrito"

if ! dpkg -s docker.io >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends docker.io
  ok "docker.io instalado"
else
  ok "docker.io ya instalado"
fi

systemctl enable docker >/dev/null 2>&1 || true
systemctl restart docker
sleep 2

ACTUAL_ROOT=$(docker info 2>/dev/null | awk -F': ' '/Docker Root Dir/{print $2}')
if [[ "$ACTUAL_ROOT" == "/data/docker" ]]; then
  ok "Docker Root Dir = $ACTUAL_ROOT"
else
  warn "Docker Root Dir = $ACTUAL_ROOT (se esperaba /data/docker)"
fi

# ubuntu al grupo docker (para no usar sudo en docker CLI)
if ! id -nG ubuntu | tr ' ' '\n' | grep -qx docker; then
  usermod -aG docker ubuntu
  ok "Usuario 'ubuntu' agregado al grupo 'docker' (requiere logout para tomar efecto)"
else
  ok "Usuario 'ubuntu' ya estaba en grupo 'docker'"
fi

# --- 5/6  Node.js 22 runtime ---------------------------------------------

say "5/6 — Node.js runtime (Ubuntu APT, v22 LTS)"
if ! dpkg -s nodejs >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends nodejs
  ok "nodejs instalado"
else
  ok "nodejs ya instalado"
fi
ok "node $(node --version)"

# --- 6/6  Nginx -----------------------------------------------------------

say "6/6 — Nginx"
if ! dpkg -s nginx >/dev/null 2>&1; then
  apt-get install -y --no-install-recommends nginx
  ok "nginx instalado"
else
  ok "nginx ya instalado"
fi
systemctl enable nginx >/dev/null 2>&1 || true
# NO arrancamos nginx todavía: la config default escucha :80 y no queremos
# ocupar el puerto antes de poner la config real en fase 3.
systemctl stop nginx >/dev/null 2>&1 || true
ok "nginx habilitado en systemd pero STOP (se arranca en fase 3)"

# --- Resumen final --------------------------------------------------------

say "RESUMEN"
echo "  /data owner ............ $(stat -c '%U:%G' /data)"
echo "  swap ................... $(swapon --show=NAME,SIZE --noheadings | xargs || echo 'sin swap')"
echo "  swappiness ............. $(sysctl -n vm.swappiness)"
echo "  docker version ......... $(docker --version 2>&1)"
echo "  docker root dir ........ ${ACTUAL_ROOT:-?}"
echo "  node ................... $(node --version)"
echo "  nginx .................. $(nginx -v 2>&1 | sed 's/^/                         /')"
echo "  timezone ............... $(timedatectl show --property=Timezone --value)"
echo "  uptime ................. $(uptime -p)"
echo
echo "Fase 1 OK. Próximo paso: Fase 2 (Postgres en container + DB sitrep_prod)."
echo "Log completo: $LOG"
