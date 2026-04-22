#!/usr/bin/env bash
#
# ============================================================================
# SITREP — FASE 3 — Build + Deploy app completo (desde la Mac)
# ============================================================================
#
# QUE HACE:
#   1. Build frontend (SPA + PWA) en la Mac
#   2. Build backend TypeScript + npm ci --production en la Mac
#   3. Genera cliente Prisma con binarios para Mac + Ubuntu (sin tocar Internet en VM)
#   4. Crea .env en la VM si no existe (lee DATABASE_URL de Fase 2)
#   5. Deploy frontend → /var/www/sitrep/
#   6. Deploy backend + node_modules → /home/ubuntu/sitrep-backend/
#   7. prisma migrate deploy en VM (binario ya incluido en el tarball)
#   8. Crea y activa servicio systemd sitrep-backend
#   9. Nginx config + SSL self-signed
#  10. Health check final
#
# ESTRATEGIA DE DEPENDENCIAS:
#   npm ci y node_modules se preparan en la Mac y se transfieren al server.
#   La VM NO necesita acceso a npm registry ni a internet externo.
#   Solo Prisma query engine necesita binario de plataforma — se incluye en tarball.
#
# PRERREQUISITOS:
#   - Fases 1 y 2 completadas en la VM
#   - VPN conectada (alcanzabilidad a sitrepprd1)
#   - Node.js + npm en la Mac
#
# CÓMO EJECUTAR (desde la Mac, en el root del proyecto):
#   bash sitrep-deploy-fase3.sh
#
# RE-DEPLOY (actualización):
#   bash sitrep-deploy-fase3.sh      ← idempotente, no toca el .env
#
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_HOST="sitrepprd1"
DOMAIN="sitrepprd1.mendoza.gov.ar"
PORT=3002
VM_BACKEND_DIR="/home/ubuntu/sitrep-backend"
VM_FRONTEND_DIR="/var/www/sitrep"
TIMESTAMP=$(date +'%Y%m%d-%H%M%S')
LOCAL_LOG="/tmp/sitrep-deploy-fase3-${TIMESTAMP}.log"

exec > >(tee -a "$LOCAL_LOG") 2>&1

say() { printf '\n=== %s === %s\n' "$(date +'%F %T')" "$*"; }
ok()  { printf '    [OK] %s\n' "$*"; }
warn(){ printf '    [WARN] %s\n' "$*"; }
die() { printf '\n[ERROR] %s\n' "$*"; exit 1; }

# ---- Sanity checks ---------------------------------------------------------

say "Verificando entorno"
command -v node >/dev/null || die "node no encontrado en la Mac"
command -v npm >/dev/null  || die "npm no encontrado en la Mac"
ssh -o ConnectTimeout=8 "$SSH_HOST" "echo pong" >/dev/null 2>&1 || die "No se puede conectar a $SSH_HOST (¿VPN activa?)"
ok "SSH OK: $SSH_HOST"
ssh "$SSH_HOST" "systemctl is-active postgresql >/dev/null 2>&1" || die "PostgreSQL no activo en VM. Correr Fase 2 primero."
ok "PostgreSQL activo"
ssh "$SSH_HOST" "test -f /data/postgres/DATABASE_URL.txt" || die "DATABASE_URL no encontrada. Correr Fase 2 primero."
ok "DATABASE_URL disponible"

# ---- 1/10  Build Frontend --------------------------------------------------

say "1/10 — Build Frontend (SPA + PWA)"
cd "${SCRIPT_DIR}/frontend"

VITE_API_URL="https://${DOMAIN}/api" npm run build 2>&1 | tail -3
ok "SPA (dist/) compilado"

VITE_API_URL="https://${DOMAIN}/api" npx vite build --config vite.config.app.ts 2>&1 | tail -3
ok "PWA (dist-app/) compilado"

cd "${SCRIPT_DIR}"

# ---- 2/10  Build Backend + npm ci ------------------------------------------

say "2/10 — Build Backend TypeScript"
cd "${SCRIPT_DIR}/backend"

# Instalar todas las deps (incluyendo devDependencies para compilar TypeScript)
npm ci --silent 2>&1 | tail -2
ok "Deps instaladas (dev + prod)"

npm run build 2>&1 | tail -3
ok "TypeScript compilado (dist/)"

say "2b/10 — npm ci --production (limpiar a solo prod para el tarball)"
npm ci --production --silent 2>&1 | tail -2
ok "node_modules reducido a producción"

# Prisma generate DESPUÉS de npm ci --production (npm ci limpiaría el cliente generado)
# schema.prisma incluye binaryTargets: native + rhel-openssl-3.0.x + debian-openssl-3.0.x
# Los binarios se incluyen en el tarball → VM no necesita internet
say "3/10 — Prisma generate con binarios Mac + Ubuntu"
npx prisma generate 2>&1 | tail -5
ok "Prisma client generado (native + rhel-openssl-3.0.x + debian-openssl-3.0.x)"

cd "${SCRIPT_DIR}"

# ---- 4/10  Empaquetar ------------------------------------------------------

say "4/10 — Empaquetando Frontend + Backend"
cd "${SCRIPT_DIR}/frontend"
(cd dist     && tar czf /tmp/sitrep-frontend-${TIMESTAMP}.tar.gz .)
(cd dist-app && tar czf /tmp/sitrep-app-${TIMESTAMP}.tar.gz .)
ok "Frontend empaquetado"

cd "${SCRIPT_DIR}/backend"
# Incluir node_modules para deploy sin acceso a npm registry en VM
tar czf /tmp/sitrep-backend-${TIMESTAMP}.tar.gz \
  dist \
  node_modules \
  data \
  package.json \
  package-lock.json \
  prisma
ok "Backend + node_modules empaquetado: $(du -sh /tmp/sitrep-backend-${TIMESTAMP}.tar.gz | cut -f1)"

cd "${SCRIPT_DIR}"

# ---- 5/10  .env en VM (solo si no existe) ----------------------------------

say "5/10 — .env en VM"
ENV_EXISTS=$(ssh "$SSH_HOST" "test -f ${VM_BACKEND_DIR}/.env && echo yes || echo no")

if [[ "$ENV_EXISTS" == "no" ]]; then
  DB_URL=$(ssh "$SSH_HOST" "cat /data/postgres/DATABASE_URL.txt" | tr -d '[:space:]')
  [[ -z "$DB_URL" ]] && die "DATABASE_URL vacía"

  JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
  JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')

  ssh "$SSH_HOST" "mkdir -p ${VM_BACKEND_DIR}"
  ssh "$SSH_HOST" "cat > ${VM_BACKEND_DIR}/.env" <<EOF
NODE_ENV=production
PORT=${PORT}
DATABASE_URL=${DB_URL}
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
FRONTEND_URL=https://${DOMAIN}
CORS_ORIGIN=https://${DOMAIN}
SUPER_ADMIN_EMAIL=santosma@gmail.com
ENABLE_ANALYTICS=true
DISABLE_EMAILS=true
EMAIL_DAILY_LIMIT_TRANSACCIONAL=500
EMAIL_DAILY_LIMIT_ALERTA=200
LOG_LEVEL=info
BLOCKCHAIN_ENABLED=false
EOF
  ssh "$SSH_HOST" "chmod 600 ${VM_BACKEND_DIR}/.env"
  ok ".env creado"
  warn "Editar ${VM_BACKEND_DIR}/.env si se necesita SMTP u otros params"
else
  ok ".env ya existe — NO sobreescrito"
fi

# ---- 6/10  Deploy Frontend -------------------------------------------------

say "6/10 — Deploy Frontend"
ssh "$SSH_HOST" "sudo mkdir -p ${VM_FRONTEND_DIR}/app ${VM_FRONTEND_DIR}/manual && sudo chown -R ubuntu:ubuntu ${VM_FRONTEND_DIR}"

scp /tmp/sitrep-frontend-${TIMESTAMP}.tar.gz "$SSH_HOST":/tmp/
ssh "$SSH_HOST" "
  find ${VM_FRONTEND_DIR} -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} + 2>/dev/null || true
  tar xzf /tmp/sitrep-frontend-${TIMESTAMP}.tar.gz -C ${VM_FRONTEND_DIR}
  chmod -R 755 ${VM_FRONTEND_DIR}
"
ok "SPA desplegado"

scp /tmp/sitrep-app-${TIMESTAMP}.tar.gz "$SSH_HOST":/tmp/
ssh "$SSH_HOST" "
  mkdir -p ${VM_FRONTEND_DIR}/app
  rm -rf ${VM_FRONTEND_DIR}/app/*
  tar xzf /tmp/sitrep-app-${TIMESTAMP}.tar.gz -C ${VM_FRONTEND_DIR}/app
"
ok "PWA desplegada"

# ---- 7/10  Deploy Backend --------------------------------------------------

say "7/10 — Deploy Backend"
scp /tmp/sitrep-backend-${TIMESTAMP}.tar.gz "$SSH_HOST":/tmp/
ssh "$SSH_HOST" "
  mkdir -p ${VM_BACKEND_DIR}
  # No borrar .env si existe
  find ${VM_BACKEND_DIR} -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf {} + 2>/dev/null || true
  tar xzf /tmp/sitrep-backend-${TIMESTAMP}.tar.gz -C ${VM_BACKEND_DIR}
"
ok "Backend extraído en ${VM_BACKEND_DIR}"

# Prisma migrate deploy (usa el cliente pre-generado, sin internet)
ssh "$SSH_HOST" "
  cd ${VM_BACKEND_DIR}
  export DATABASE_URL=\$(grep '^DATABASE_URL=' .env | cut -d= -f2-)
  node_modules/.bin/prisma migrate deploy
"
ok "Migraciones Prisma aplicadas"

# ---- 8/10  Servicio systemd ------------------------------------------------

say "8/10 — Servicio systemd sitrep-backend"
ssh "$SSH_HOST" "sudo bash -s -- '${VM_BACKEND_DIR}' '${PORT}'" << 'SSHEOF'
set -euo pipefail
VM_BACKEND_DIR="$1"
PORT="$2"

cat > /etc/systemd/system/sitrep-backend.service <<UNIT
[Unit]
Description=SITREP Backend
Documentation=https://sitrepprd1.mendoza.gov.ar/api/docs
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=ubuntu
WorkingDirectory=${VM_BACKEND_DIR}
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sitrep-backend
Environment=NODE_ENV=production
EnvironmentFile=${VM_BACKEND_DIR}/.env

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable sitrep-backend

if systemctl is-active sitrep-backend >/dev/null 2>&1; then
  systemctl restart sitrep-backend
  echo '    [OK] sitrep-backend reiniciado'
else
  systemctl start sitrep-backend
  echo '    [OK] sitrep-backend iniciado'
fi

sleep 3
systemctl is-active sitrep-backend >/dev/null && echo '    [OK] sitrep-backend activo' || echo '    [WARN] sitrep-backend no activo — ver: journalctl -u sitrep-backend -n 50'
SSHEOF

# Health check
sleep 2
HTTP_CODE=$(ssh "$SSH_HOST" "curl -s -o /dev/null -w '%{http_code}' http://localhost:${PORT}/api/health/live" || echo "000")
[[ "$HTTP_CODE" == "200" ]] && ok "Backend health OK (HTTP 200)" || warn "Backend health HTTP $HTTP_CODE"

# ---- 9/10  Nginx + SSL self-signed -----------------------------------------

say "9/10 — Nginx config + SSL"
# Generar config Nginx localmente y transferir vía scp para evitar problemas
# de escapado de $ en heredocs anidados con SSH
NGINX_CONF_TMP="/tmp/sitrep-nginx-${TIMESTAMP}.conf"
cat > "$NGINX_CONF_TMP" <<NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    http2 on;
    server_name ${DOMAIN};

    ssl_certificate     /etc/ssl/sitrep/sitrep.crt;
    ssl_certificate_key /etc/ssl/sitrep/sitrep.key;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 10m;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 256;

    add_header X-Frame-Options        "SAMEORIGIN"  always;
    add_header X-Content-Type-Options "nosniff"     always;
    add_header X-Robots-Tag  "noindex, nofollow"    always;

    location /api/ {
        proxy_pass         http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Upgrade           \$http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
    }

    location /app/ {
        root  ${VM_FRONTEND_DIR};
        index index.html;
        try_files \$uri \$uri/ /app/index.html;
        location ~* /app/assets/ { expires 1y; add_header Cache-Control "public, immutable"; access_log off; }
    }
    location = /app { return 301 /app/; }

    location /manual/ {
        root  ${VM_FRONTEND_DIR};
        index index.html;
        try_files \$uri \$uri/ /manual/index.html;
        location = /manual/index.html { add_header Cache-Control "no-cache, no-store, must-revalidate" always; }
        location ~* /manual/.*\.(js|css)$ { expires 7d; add_header Cache-Control "public"; access_log off; }
    }
    location = /manual { return 301 /manual/; }

    root ${VM_FRONTEND_DIR};
    location /assets/ { expires 1y; add_header Cache-Control "public, immutable"; access_log off; }
    location / {
        index index.html;
        try_files \$uri \$uri/ /index.html;
        location = /index.html { add_header Cache-Control "no-cache, no-store, must-revalidate"; }
    }
}
NGINXEOF

# Self-signed cert + instalar config
scp "$NGINX_CONF_TMP" "$SSH_HOST":/tmp/sitrep-nginx.conf
ssh "$SSH_HOST" "sudo bash -s" <<'SSHEOF2'
set -euo pipefail
SSL_CERT="/etc/ssl/sitrep/sitrep.crt"
SSL_KEY="/etc/ssl/sitrep/sitrep.key"

if [[ ! -f "$SSL_CERT" ]]; then
  mkdir -p /etc/ssl/sitrep
  DOMAIN=$(grep 'server_name' /tmp/sitrep-nginx.conf | head -2 | tail -1 | awk '{print $2}' | tr -d ';')
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_KEY" -out "$SSL_CERT" \
    -subj "/C=AR/ST=Mendoza/L=Mendoza/O=Gobierno Mendoza/OU=DGFA/CN=${DOMAIN}" \
    2>/dev/null
  chmod 600 "$SSL_KEY"; chmod 644 "$SSL_CERT"
  echo "    [OK] Cert self-signed generado (10 años)"
else
  echo "    [OK] Certs ya existen"
fi

cp /tmp/sitrep-nginx.conf /etc/nginx/sites-available/sitrep
ln -sf /etc/nginx/sites-available/sitrep /etc/nginx/sites-enabled/sitrep
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
nginx -t
systemctl start nginx
systemctl enable nginx >/dev/null 2>&1
echo "    [OK] Nginx activo"
SSHEOF2

# ---- 10/10  Health check final ---------------------------------------------

say "10/10 — Health check final"
sleep 2

HEALTH=$(ssh "$SSH_HOST" "curl -sk https://localhost/api/health/ready" 2>/dev/null || echo '{}')
STATUS=$(echo "$HEALTH" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "?")
ok "Backend /api/health/ready → status: $STATUS"

FRONTEND=$(ssh "$SSH_HOST" "curl -sk -o /dev/null -w '%{http_code}' https://localhost/" 2>/dev/null || echo "000")
ok "Frontend HTTPS → HTTP $FRONTEND"

# ---- Resumen ---------------------------------------------------------------

say "RESUMEN FASE 3"
echo "  URL .................... https://${DOMAIN}/"
echo "  API .................... https://${DOMAIN}/api/"
echo "  Manual ................. https://${DOMAIN}/manual/"
echo "  Backend ................ ${VM_BACKEND_DIR}"
echo "  Frontend ............... ${VM_FRONTEND_DIR}"
echo "  Puerto backend ......... ${PORT}"
echo "  Proceso ................ systemd (sitrep-backend)"
echo "  Logs ................... journalctl -u sitrep-backend -f"
echo "  SSL .................... Self-signed (10 años)"
echo
echo "Deploy completo. SITREP corriendo en ${DOMAIN}."
echo
echo "NOTAS:"
echo "  - .env en ${VM_BACKEND_DIR}/.env — revisar SMTP_* si se necesita email"
echo "  - SSL self-signed: el browser mostrará advertencia — normal para intranet VPN"
echo "  - Re-deploy: bash sitrep-deploy-fase3.sh"
echo
echo "Log local: $LOCAL_LOG"
