#!/bin/bash
# ================================================================
# SITREP — Deploy Seguro (post-security-hardening)
# Ejecutar DESPUÉS de rotar secretos en el servidor.
#
# USO:
#   1. Rotar secretos primero (ver sección ROTAR SECRETOS abajo)
#   2. bash backend/scripts/deploy-secure.sh
# ================================================================
set -euo pipefail

SERVER="root@23.105.176.45"
BACKEND_REMOTE="/var/www/sitrep-backend"
NGINX_CONF_REMOTE="/etc/nginx/sites-available/sitrep.ultimamilla.com.ar"
NGINX_MAIN_CONF_REMOTE="/etc/nginx/sites-available/ultimamilla.com.ar"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     SITREP — DEPLOY SEGURO                          ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 1. Build ──────────────────────────────────────────────────
echo -e "${GREEN}[1/7] Building backend...${NC}"
cd "$(dirname "$0")/.."
npm run build
echo ""

# ── 2. Package ────────────────────────────────────────────────
echo -e "${GREEN}[2/7] Packaging...${NC}"
tar czf /tmp/sitrep-backend.tar.gz \
  dist package.json package-lock.json prisma
echo ""

# ── 3. Upload ─────────────────────────────────────────────────
echo -e "${GREEN}[3/7] Uploading to server...${NC}"
scp /tmp/sitrep-backend.tar.gz "$SERVER:/tmp/"
echo ""

# ── 4. Deploy on server ───────────────────────────────────────
echo -e "${GREEN}[4/7] Deploying on server...${NC}"
ssh "$SERVER" << 'ENDSERVER'
  set -e
  cd "$BACKEND_REMOTE"

  # Backup .env (preserves secrets)
  cp .env /tmp/sitrep-env-backup

  # Extract new code
  tar xzf /tmp/sitrep-backend.tar.gz
  npm ci --production
  npx prisma generate

  # Push new schema fields (intentosFallidos, bloqueadoHasta)
  npx prisma db push --accept-data-loss

  # Restore .env
  cp /tmp/sitrep-env-backup .env

  # Restart
  pm2 restart sitrep-backend
ENDSERVER
echo ""

# ── 5. Update nginx ───────────────────────────────────────────
echo -e "${GREEN}[5/7] Updating nginx config...${NC}"
# Copy the local nginx configs to the server
scp nginx_sitrep.conf "$SERVER:$NGINX_CONF_REMOTE"
scp nginx_server.conf "$SERVER:$NGINX_MAIN_CONF_REMOTE"

ssh "$SERVER" 'nginx -t && systemctl reload nginx'
echo ""

# ── 6. Verify health ──────────────────────────────────────────
echo -e "${GREEN}[6/7] Verifying health...${NC}"
sleep 3

HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://sitrep.ultimamilla.com.ar/api/health)
if [ "$HEALTH" = "200" ]; then
  echo -e "  ${GREEN}✓${NC} API health: $HEALTH"
else
  echo -e "  ${RED}✗${NC} API health: $HEALTH (expected 200)"
fi

# Check security headers
HSTS=$(curl -sI https://sitrep.ultimamilla.com.ar/api/health | grep -c "strict-transport-security" || true)
if [ "$HSTS" -gt 0 ]; then
  echo -e "  ${GREEN}✓${NC} HSTS header present"
else
  echo -e "  ${RED}✗${NC} HSTS header MISSING"
fi

XFO=$(curl -sI https://sitrep.ultimamilla.com.ar/api/health | grep -c "x-frame-options" || true)
if [ "$XFO" -gt 0 ]; then
  echo -e "  ${GREEN}✓${NC} X-Frame-Options present"
else
  echo -e "  ${RED}✗${NC} X-Frame-Options MISSING"
fi
echo ""

# ── 7. Run security tests ─────────────────────────────────────
echo -e "${GREEN}[7/7] Running security test suite...${NC}"
bash tests/rate-limit-test.sh https://sitrep.ultimamilla.com.ar || true
echo ""

echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
echo -e "  Deploy completado."
echo -e "  Recordar: ver los test de seguridad completos con:"
echo -e "    bash tests/run-all-tests.sh https://sitrep.ultimamilla.com.ar"
echo -e "${YELLOW}══════════════════════════════════════════════════════${NC}"
