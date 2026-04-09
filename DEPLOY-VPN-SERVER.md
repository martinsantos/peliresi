# SITREP — Migracion a Servidor VPN-only

> **Nota**: Este documento complementa a `DEPLOY-NUEVO-SERVIDOR.md` con las
> especificidades de un servidor accesible **solo via VPN** (sin internet
> publico para HTTP-01 challenge, sin acceso desde GitHub Actions estandar,
> etc.). Lee primero `DEPLOY-NUEVO-SERVIDOR.md` para los pasos generales.

## Estado actual del sistema

| Item | Detalle |
|------|---------|
| **Servidor actual** | `23.105.176.45` (publico) |
| **Servidor destino** | `___.___.___.___ ` (a definir, accesible solo via VPN) |
| **Dominio** | `sitrep.ultimamilla.com.ar` (no cambia) |
| **Database** | PostgreSQL 15 en container (compartido con Directus en server actual; **separar** en destino) |
| **DNS** | Cloudflare (mantener) |
| **Email** | Brevo SMTP (mantener) |
| **SSL** | Let's Encrypt — **cambiar HTTP-01 → DNS-01** |
| **CI/CD** | GitHub Actions (debe atravesar VPN) |

## Estrategia de DB elegida

**Strategy A — DB aislada**: migrar solo `trazabilidad_rrpp` a una NUEVA
instancia PostgreSQL en el server destino. **NO** migrar el container compartido
`directus-admin-database-1`. Directus continua en server actual.

Razones:
- Separacion limpia (cada app, su DB)
- Directus unaffected
- Container dedicado por app
- Reduce blast radius en caso de falla

---

# Seccion 1 — Pre-migration Checklist

```
INFRAESTRUCTURA
[ ] IP del nuevo VPS: ____________________
[ ] Hostname / DNS interno (si aplica): ____________________
[ ] VPN credentials obtenidas y verificadas
[ ] Cliente VPN configurado en maquina de despliegue (test: ssh via VPN)
[ ] Bastion host disponible (opcional pero recomendado)
[ ] Specs del server: CPU, RAM, disco, OS

DNS
[ ] Cloudflare access (token API generado para DNS-01)
[ ] Token guardado en gestor de secretos (1Password, Bitwarden, vault interno)
[ ] DNS records actuales documentados (A, CNAME, MX, SPF, DKIM, DMARC)

BACKUPS
[ ] Backup full del server actual realizado
[ ] Backup verificado (puedo restaurarlo)
[ ] pg_dump de produccion testeado en server local con psql import

SECRETS
[ ] DATABASE_URL nuevo (con sitrep user/pass distinto del de Directus)
[ ] JWT_SECRET nuevo (openssl rand -base64 64)
[ ] JWT_REFRESH_SECRET nuevo
[ ] BLOCKCHAIN_PRIVATE_KEY (si aplica)
[ ] SMTP credentials (Brevo)
[ ] Todos en gestor de secretos

DOCUMENTACION
[ ] Maintenance window agendada (off-hours, ej. 02:00-04:00 ARG)
[ ] Plan de rollback comunicado al equipo
[ ] Lista de verificacion post-cutover preparada
```

---

# Seccion 2 — Base server setup

```bash
# === Acceder al server (via VPN) ===
ssh root@<NUEVO_IP>   # asumiendo conectado al VPN

# === Sistema base ===
apt update && apt upgrade -y
apt install -y curl wget git unzip htop ncdu jq build-essential ca-certificates lsb-release

# === Node.js 20 ===
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # v20.x
npm -v

# === Docker ===
apt install -y docker.io docker-compose-v2
systemctl enable docker --now
docker --version

# === PM2 (cluster manager) ===
npm install -g pm2
pm2 startup systemd
# (copiar y ejecutar el comando que devuelve para registrar PM2 en boot)

# === Nginx ===
apt install -y nginx
systemctl enable nginx
nginx -v

# === Certbot + plugin Cloudflare DNS-01 ===
apt install -y python3-certbot-dns-cloudflare

# === UFW Firewall ===
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
# Si tu VPN tiene una subnet conocida (ej. 10.8.0.0/24), restringir mas:
# ufw allow from 10.8.0.0/24
echo 'y' | ufw enable
ufw status

# === Fail2ban ===
apt install -y fail2ban
systemctl enable fail2ban --now

# === Directorios ===
mkdir -p /var/www/sitrep /var/www/sitrep-backend /opt/sitrep-backups /opt/scripts-cicd
```

---

# Seccion 3 — PostgreSQL dedicado (NO compartido)

A diferencia del server actual donde sitrep usa el container `directus-admin-database-1`, en el nuevo server creamos un container **exclusivo** para sitrep.

```bash
# Variables (cambiar password!)
DB_USER="sitrep"
DB_PASS="$(openssl rand -base64 32 | tr -d '/+=')"
DB_NAME="trazabilidad_rrpp"

# === Crear container ===
docker run -d \
  --name sitrep-database \
  --restart unless-stopped \
  -e POSTGRES_USER="$DB_USER" \
  -e POSTGRES_PASSWORD="$DB_PASS" \
  -e POSTGRES_DB="$DB_NAME" \
  -v sitrep-db-volume:/var/lib/postgresql/data \
  -p 127.0.0.1:5432:5432 \
  postgres:15-alpine

# Verificar
sleep 5
docker logs sitrep-database --tail 20
docker exec sitrep-database pg_isready -U "$DB_USER" -d "$DB_NAME"

# === Guardar password en .env ===
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public&connection_limit=20&pool_timeout=10" \
  >> /home/sitrep-secrets/.env.tmp
chmod 600 /home/sitrep-secrets/.env.tmp
```

> **Importante**: el container queda escuchando solo en `127.0.0.1:5432` (no
> publico). Solo procesos en localhost pueden conectarse — el backend Node se
> conecta via `localhost` y nginx no proxiea ese puerto.

---

# Seccion 4 — Let's Encrypt DNS-01 challenge

**Por que NO HTTP-01**: el desafio HTTP-01 requiere que Let's Encrypt acceda
a `http://sitrep.ultimamilla.com.ar/.well-known/acme-challenge/...` desde
internet publico. En un servidor VPN-only, los servidores de Let's Encrypt no
pueden alcanzar el puerto 80 → la validacion falla.

**Solucion**: usar DNS-01, que valida creando un TXT record en el DNS via API.

## 4.1 Cloudflare API token

En el dashboard de Cloudflare → My Profile → API Tokens → Create Token:
- Permissions: `Zone → DNS → Edit`
- Zone Resources: `Include → Specific zone → ultimamilla.com.ar`
- TTL: sin expiracion (rotar manualmente cada 90 dias)

Guardar el token.

## 4.2 Configurar credenciales en el server

```bash
mkdir -p /etc/letsencrypt
cat > /etc/letsencrypt/cloudflare.ini <<EOF
dns_cloudflare_api_token = TOKEN_AQUI
EOF
chmod 600 /etc/letsencrypt/cloudflare.ini
```

## 4.3 Obtener certificado

```bash
certbot certonly \
  --dns-cloudflare \
  --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
  --dns-cloudflare-propagation-seconds 30 \
  -d sitrep.ultimamilla.com.ar \
  --email admin@dgfa.mendoza.gov.ar \
  --agree-tos \
  --no-eff-email
```

## 4.4 Test renovation (dry-run)

```bash
certbot renew --dry-run
# Debe completar exitosamente
```

## 4.5 Auto-renewal

Certbot crea automaticamente un systemd timer. Verificar:
```bash
systemctl list-timers | grep certbot
systemctl status certbot.timer
```

---

# Seccion 5 — CI/CD via VPN

Tres opciones, en orden de preferencia:

## Opcion A — Self-hosted GitHub Runner detras del VPN (recomendada)

Pros: nativo, sin tunneling, full control.
Contras: hay que mantener un runner.

```bash
# En el server destino (o en otra maquina con acceso al VPN):
mkdir actions-runner && cd actions-runner
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.x/actions-runner-linux-x64-2.x.tar.gz
tar xzf actions-runner-linux-x64.tar.gz

./config.sh --url https://github.com/martinsantos/peliresi --token GITHUB_RUNNER_TOKEN
./run.sh   # foreground, o instalar como service:
sudo ./svc.sh install
sudo ./svc.sh start
```

Luego en `.github/workflows/deploy-production.yml`:
```yaml
runs-on: self-hosted   # en vez de ubuntu-latest
```

## Opcion B — Bastion host con tunneling

Pros: GitHub Actions estandar, sin runner que mantener.
Contras: complejidad de SSH agent forwarding via bastion.

Bastion host es una maquina **con acceso al VPN Y a internet publico**. GitHub
Actions ssh primero al bastion, luego desde bastion al server VPN.

`.github/workflows/deploy-production.yml`:
```yaml
- name: SSH via bastion
  env:
    BASTION_HOST: ${{ secrets.BASTION_HOST }}
    BASTION_KEY: ${{ secrets.BASTION_SSH_KEY }}
    VPN_HOST: ${{ secrets.VPN_TARGET_HOST }}
  run: |
    mkdir -p ~/.ssh
    echo "$BASTION_KEY" > ~/.ssh/bastion_key
    chmod 600 ~/.ssh/bastion_key
    ssh -i ~/.ssh/bastion_key -o StrictHostKeyChecking=no \
      -o ProxyCommand="ssh -W %h:%p -i ~/.ssh/bastion_key root@$BASTION_HOST" \
      root@$VPN_HOST "cd /var/www/sitrep-backend && git pull && npm ci && npm run build && pm2 reload sitrep-backend"
```

## Opcion C — Manual deploys (sin CI/CD)

Pros: simple, sin infraestructura adicional.
Contras: paso humano necesario para cada deploy.

```bash
# Desde maquina local (con VPN conectado):
cd ~/sitrep
git pull origin main

# Build local
cd backend && npm run build && cd ..
cd frontend && npm run build && npx vite build --config vite.config.app.ts && cd ..

# Package
cd backend && tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma ecosystem.config.js && cd ..
cd frontend/dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ../..
cd frontend/dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ../..

# Upload
scp /tmp/sitrep-{backend,frontend,app}.tar.gz root@<VPN_HOST>:/tmp/

# Deploy
ssh root@<VPN_HOST> "
  cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && \
    npm ci --production && npx prisma generate && pm2 reload sitrep-backend
  cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} + && \
    tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 .
  cd /var/www/sitrep/app && rm -rf * && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 .
"
```

---

# Seccion 6 — Data migration

## 6.1 En el server actual — dump

```bash
# pg_dump del container compartido — solo trazabilidad_rrpp
ssh root@23.105.176.45 "
  docker exec directus-admin-database-1 pg_dump -U directus -d trazabilidad_rrpp \
    --no-owner --no-privileges --clean --if-exists \
    | gzip > /tmp/sitrep-migration-\$(date +%Y%m%d).sql.gz
"

# Descargar a maquina local
scp root@23.105.176.45:/tmp/sitrep-migration-*.sql.gz ./
```

## 6.2 Subir al server destino (via VPN)

```bash
scp sitrep-migration-*.sql.gz root@<VPN_HOST>:/tmp/
```

## 6.3 En el server destino — restore

```bash
ssh root@<VPN_HOST>

# Stop backend si estaba corriendo
pm2 stop sitrep-backend 2>/dev/null || true

# Restore
gunzip -c /tmp/sitrep-migration-*.sql.gz \
  | docker exec -i sitrep-database psql -U sitrep -d trazabilidad_rrpp

# Verify
docker exec sitrep-database psql -U sitrep -d trazabilidad_rrpp -c "
  SELECT 'usuarios' as tabla, COUNT(*) FROM usuarios UNION ALL
  SELECT 'manifiestos', COUNT(*) FROM manifiestos UNION ALL
  SELECT 'generadores', COUNT(*) FROM generadores UNION ALL
  SELECT 'transportistas', COUNT(*) FROM transportistas UNION ALL
  SELECT 'operadores', COUNT(*) FROM operadores;
"

# Comparar con el server actual:
ssh root@23.105.176.45 "docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c \"
  SELECT 'usuarios', COUNT(*) FROM usuarios UNION ALL
  SELECT 'manifiestos', COUNT(*) FROM manifiestos UNION ALL ...
\""
```

## 6.4 Prisma generate + migration status

```bash
cd /var/www/sitrep-backend
npx prisma generate
npx prisma migrate status   # debe decir "Database schema is up to date"
```

## 6.5 Smoke test contra el nuevo server (interno)

```bash
# Levantar PM2
pm2 start ecosystem.config.js
pm2 save

# Health check local (sin SSL)
curl http://localhost:3002/api/health
# Expected: {"status":"ok","db":"connected"}

# Smoke test (apuntando al localhost del nuevo server)
ssh root@<VPN_HOST> "bash /var/www/sitrep-backend/tests/smoke-test.sh http://localhost:3002"
# Expected: 48/48 PASS
```

---

# Seccion 7 — Secrets migration

Lista completa de variables a migrar:

```bash
# === Backend .env (nuevo server) ===
NODE_ENV=production
PORT=3002

# Database (NUEVO — diferente al server actual)
DATABASE_URL="postgresql://sitrep:NEW_PASS@localhost:5432/trazabilidad_rrpp?schema=public&connection_limit=20&pool_timeout=10"

# JWT (regenerar)
JWT_SECRET="$(openssl rand -base64 64)"
JWT_REFRESH_SECRET="$(openssl rand -base64 64)"

# CORS / Frontend (NO cambia — mismo dominio)
FRONTEND_URL=https://sitrep.ultimamilla.com.ar
CORS_ORIGIN=https://sitrep.ultimamilla.com.ar

# Email (Brevo — copiar tal cual)
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=BREVO_USER
SMTP_PASS=BREVO_PASS
SMTP_FROM="SITREP <no-reply@sitrep.ultimamilla.com.ar>"

# Email rate limits
DISABLE_EMAILS=false
EMAIL_DAILY_LIMIT_TRANSACCIONAL=10
EMAIL_DAILY_LIMIT_ALERTA=6
EMAIL_FLUSH_INTERVAL_MS=300000
EMAIL_MAX_RETRIES=3

# Admin
SUPER_ADMIN_EMAIL=admin@dgfa.mendoza.gov.ar

# Blockchain (si se usa)
BLOCKCHAIN_PRIVATE_KEY="EXISTING_KEY"
BLOCKCHAIN_CONTRACT_ADDRESS="0x..."
BLOCKCHAIN_RPC_URL="https://sepolia.infura.io/v3/..."

# Logging
LOG_LEVEL=info

# Analytics (opcional)
ENABLE_ANALYTICS=true
```

```bash
# Permisos restrictivos
chmod 600 /var/www/sitrep-backend/.env
chown root:root /var/www/sitrep-backend/.env
```

---

# Seccion 8 — DNS cutover

## 8.1 Lower TTL (1 dia antes)

En Cloudflare:
- Localizar A record de `sitrep.ultimamilla.com.ar`
- Cambiar TTL de Auto a **60 seconds**
- Esperar 24h para que se propague (los caches de TTL viejo deben expirar)

## 8.2 Pre-cutover validation (en el momento)

```bash
# Verificar que el nuevo server responde correctamente con HTTPS
curl https://sitrep.ultimamilla.com.ar/api/health \
  --resolve sitrep.ultimamilla.com.ar:443:<NUEVO_IP>
# Expected: {"status":"ok","db":"connected"}
```

## 8.3 Cutover

```
1. En Cloudflare, editar A record:
   - Antes: sitrep.ultimamilla.com.ar A 23.105.176.45
   - Despues: sitrep.ultimamilla.com.ar A <NUEVO_IP>
2. Save
3. Verificar propagation:
   - dig sitrep.ultimamilla.com.ar +short  (esperar nuevo IP)
   - desde varios resolvers: Google (8.8.8.8), Cloudflare (1.1.1.1)
```

## 8.4 Monitor en ambos servers

Terminal 1 — server nuevo:
```bash
ssh root@<NUEVO_IP> "pm2 logs sitrep-backend --lines 100"
```

Terminal 2 — server viejo:
```bash
ssh root@23.105.176.45 "tail -f /var/log/nginx/access.log | grep sitrep"
# Debe ir disminuyendo el trafico hasta cero
```

---

# Seccion 9 — Post-cutover verification

```bash
# 1. Smoke test desde local (a traves de DNS publico)
bash backend/tests/smoke-test.sh https://sitrep.ultimamilla.com.ar
# Expected: 48/48 PASS

# 2. Cross-platform workflow
bash backend/tests/cross-platform-workflow-test.sh https://sitrep.ultimamilla.com.ar
# Expected: 25/26 PASS (1 falla pre-existente, no regresion)

# 3. E2E Playwright (16 tests)
cd frontend
PLAYWRIGHT_BASE_URL=https://sitrep.ultimamilla.com.ar npx playwright test --project=chromium

# 4. Visual audit (5 viewports x 14 paginas)
PLAYWRIGHT_BASE_URL=https://sitrep.ultimamilla.com.ar npx playwright test e2e/visual-audit.spec.ts

# 5. Stress tests nuevos
bash backend/tests/date-validation-stress-test.sh https://sitrep.ultimamilla.com.ar
bash backend/tests/pagination-stress-test.sh https://sitrep.ultimamilla.com.ar
bash backend/tests/sort-stress-test.sh https://sitrep.ultimamilla.com.ar
bash backend/tests/search-safety-test.sh https://sitrep.ultimamilla.com.ar
```

## QA manual

```
[ ] Login como ADMIN, ver dashboard
[ ] Login como GENERADOR, crear borrador de manifiesto
[ ] Login como TRANSPORTISTA, ver viajes asignados
[ ] Login como OPERADOR, ver entregas pendientes
[ ] Workflow completo: BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → TRATADO
[ ] PDF generation
[ ] Centro de Control con mapa
[ ] Auditoria con paginacion + filtros + sort
[ ] PWA install (/app/)
[ ] Manual (/manual/) carga v2026.11
[ ] Email de notificacion arriva (verificar Gmail + spam)
[ ] Blockchain seal generation (si esta habilitado)
```

---

# Seccion 10 — Rollback plan

**Ventana de fallback**: 30 dias. El server actual `23.105.176.45` se mantiene
encendido, con backups diarios, durante 30 dias post-cutover.

## Rollback rapido (< 5 min)

Si despues del cutover hay errores criticos:

```bash
# 1. Revertir DNS en Cloudflare
sitrep.ultimamilla.com.ar A <NUEVO_IP>
                          ↓
sitrep.ultimamilla.com.ar A 23.105.176.45

# 2. TTL ya esta en 60s — propagacion rapida
# 3. Verificar:
dig sitrep.ultimamilla.com.ar +short
curl https://sitrep.ultimamilla.com.ar/api/health

# 4. Trafico vuelve al server viejo
```

## Que hacer en el server nuevo

- No tocar nada, dejarlo correr
- Capturar logs del incidente
- Triajar la causa
- Re-intentar cutover cuando este resuelto

## Rollback de DB

Si por algun motivo se modifico la DB en el nuevo server con datos que no
quieres perder:

```bash
# En el server nuevo — dump del estado actual
docker exec sitrep-database pg_dump -U sitrep -d trazabilidad_rrpp \
  | gzip > /tmp/sitrep-rollback-state.sql.gz

# Comparar con el dump pre-cutover y decidir merge manual
```

---

# Seccion 11 — Notas adicionales

## 11.1 Hardcoded references a 23.105.176.45

Verificar antes del cutover si hay referencias hardcodeadas:

```bash
grep -rn "23.105.176.45" \
  backend/ frontend/src-v6/ scripts/ \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.sh"
```

Las que aparezcan en `CLAUDE.md` o documentacion son OK (referencia historica).
Las que aparezcan en codigo runtime deben actualizarse.

## 11.2 Backup cron

Despues del cutover, instalar el script de backup en el nuevo server:

```bash
cat > /opt/scripts-cicd/backup_sitrep.sh <<'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M)
BACKUP_DIR=/opt/sitrep-backups
mkdir -p "$BACKUP_DIR"

# DB dump
docker exec sitrep-database pg_dump -U sitrep -d trazabilidad_rrpp \
  | gzip > "$BACKUP_DIR/sitrep-db-${DATE}.sql.gz"

# .env backup
cp /var/www/sitrep-backend/.env "$BACKUP_DIR/env-${DATE}.bak"

# Retention 30 days
find "$BACKUP_DIR" -type f -mtime +30 -delete

echo "Backup OK: $DATE"
EOF
chmod +x /opt/scripts-cicd/backup_sitrep.sh

# Cron a las 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * * /opt/scripts-cicd/backup_sitrep.sh >> /var/log/sitrep-backup.log 2>&1") | crontab -
```

## 11.3 Monitoring

- Configurar healthcheck cron cada 5 min apuntando a `https://sitrep.ultimamilla.com.ar/api/health`
- Si falla 3 veces seguidas, alerta via email
- Disco: cron cada 6h, alerta a > 85%

## 11.4 GitHub Actions secrets

Si se usa CI/CD (Opcion A o B), actualizar GitHub Secrets:
- `VPS_HOST` o `VPN_TARGET_HOST` → nuevo IP
- `VPS_SSH_KEY_BASE64` → si la SSH key cambia
- `BASTION_HOST` y `BASTION_SSH_KEY` (si Opcion B)

---

## Seccion 12 — Resumen visual

```
[ANTES]
       Internet → 23.105.176.45 (Old Server)
                     ↓
                    nginx (port 80, 443)
                     ↓
                    PM2 (sitrep-backend cluster)
                     ↓
                    directus-admin-database-1 (compartido)
                       ├─ database "directus" (Directus CMS)
                       └─ database "trazabilidad_rrpp" (SITREP)


[DESPUES]
       VPN → <NUEVO_IP> (New Server, VPN-only)
                ↓
               nginx (port 80, 443) — SSL via Let's Encrypt DNS-01
                ↓
               PM2 (sitrep-backend cluster)
                ↓
               sitrep-database container (DEDICADO)
                  └─ database "trazabilidad_rrpp" only

       Internet → 23.105.176.45 (Old Server, decommissioning en 30d)
                     ↓
                    directus (sigue funcionando)
                    └─ database "directus" only
```

## Checklist final

```
[ ] Pre-migration checklist completo (Seccion 1)
[ ] Server base setup (Seccion 2)
[ ] PostgreSQL dedicado funcionando (Seccion 3)
[ ] Let's Encrypt DNS-01 emitido y testeado (Seccion 4)
[ ] CI/CD configurado (Seccion 5, opcion elegida)
[ ] Data migration ejecutada y verificada (Seccion 6)
[ ] Secrets migrados (Seccion 7)
[ ] DNS cutover completado (Seccion 8)
[ ] Post-cutover verification all green (Seccion 9)
[ ] Rollback plan documentado y comunicado (Seccion 10)
[ ] Backups automatizados en server nuevo (Seccion 11.2)
[ ] Monitoring configurado (Seccion 11.3)
[ ] Notificacion al equipo: cutover exitoso
[ ] Old server agendado para decommissioning en T+30
```
