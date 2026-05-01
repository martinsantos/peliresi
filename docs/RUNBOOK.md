# SITREP — Operational Runbook

> Procedimientos operativos diarios. Para la guia de instalacion completa ver
> `DEPLOY-NUEVO-SERVIDOR.md` y `DEPLOY-VPN-SERVER.md`.

## Indice

1. [Acceso al servidor](#acceso-al-servidor)
2. [Health checks](#health-checks)
3. [Logs y debugging](#logs-y-debugging)
4. [Deploys](#deploys)
5. [Backups](#backups)
6. [Restore desde backup](#restore-desde-backup)
7. [SSL renovation](#ssl-renovation)
8. [Recuperacion de incidentes](#recuperacion-de-incidentes)
9. [DNS cutover](#dns-cutover)
10. [Tests](#tests)

---

## Acceso al servidor

### Server actual (publico)

```bash
ssh root@23.105.176.45
```

### Server destino VPN-only (cuando exista)

```bash
# Conectar al VPN primero
sudo openvpn --config ~/path/to/vpn.ovpn   # o cliente nativo

# Verificar que estoy en la subnet del VPN
ip addr | grep tun0

# SSH al server destino
ssh root@<VPN_TARGET_IP>
```

Si hay bastion host:

```bash
# Via bastion
ssh -J root@bastion.example.com root@<VPN_TARGET_IP>

# O configurar en ~/.ssh/config:
Host sitrep-vpn
  HostName <VPN_TARGET_IP>
  ProxyJump root@bastion.example.com
  User root
```

---

## Health checks

### Quick check (manual)

```bash
# API
curl https://sitrep.ultimamilla.com.ar/api/health
# Expected: {"status":"ok","db":"connected","uptime":NNNN}

curl https://sitrep.ultimamilla.com.ar/api/health/live
curl https://sitrep.ultimamilla.com.ar/api/health/ready

# Frontend
curl -I https://sitrep.ultimamilla.com.ar/
curl -I https://sitrep.ultimamilla.com.ar/app/
curl -I https://sitrep.ultimamilla.com.ar/manual/
```

### Server health

```bash
ssh root@<HOST> "
  uptime
  free -h | head -2
  df -h /
  pm2 list | grep sitrep
  systemctl is-active nginx
  docker ps --format '{{.Names}} {{.Status}}' | grep -E 'directus|sitrep'
"
```

### Cron de healthcheck (si se quiere agregar)

```bash
# Cada 5 min
*/5 * * * * curl -sf https://sitrep.ultimamilla.com.ar/api/health > /dev/null || \
  echo "$(date) HEALTH FAILED" >> /var/log/sitrep-health.log
```

---

## Logs y debugging

### Backend (PM2)

```bash
ssh root@<HOST>

# Logs en vivo
pm2 logs sitrep-backend --lines 100

# Solo errores
pm2 logs sitrep-backend --err --lines 50

# Stop tail (si --nostream)
pm2 logs sitrep-backend --lines 50 --nostream

# Detalle de los procesos
pm2 show sitrep-backend
pm2 monit
```

### Nginx

```bash
# Access log
tail -f /var/log/nginx/access.log | grep sitrep

# Error log
tail -f /var/log/nginx/error.log

# Test config
nginx -t

# Reload (sin downtime)
nginx -s reload

# Restart (con downtime)
systemctl restart nginx
```

### PostgreSQL

```bash
# Logs del container
docker logs directus-admin-database-1 --tail 100

# Conectar al psql
docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_rrpp

# Check connections
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c \
  "SELECT count(*) FROM pg_stat_activity WHERE datname='trazabilidad_rrpp';"

# Slow queries (si log_min_duration_statement esta configurado)
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c \
  "SELECT query, state, query_start FROM pg_stat_activity WHERE state != 'idle' ORDER BY query_start;"
```

---

## Deploys

### Deploy completo (frontend + backend)

```bash
# === Local: build ===
cd ~/sitrep
git pull origin main

cd backend && npm run build && cd ..
cd frontend && npm run build && npx vite build --config vite.config.app.ts && cd ..

# === Local: package ===
cd backend && tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma ecosystem.config.js && cd ..
cd frontend/dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ../..
cd frontend/dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ../..

# === Upload ===
scp /tmp/sitrep-{backend,frontend,app}.tar.gz root@<HOST>:/tmp/

# === Deploy ===
ssh root@<HOST> "
  # Backend
  cd /var/www/sitrep-backend
  tar xzf /tmp/sitrep-backend.tar.gz
  npm ci --production
  npx prisma generate
  pm2 reload sitrep-backend

  # Frontend (preserva /app y /manual)
  cd /var/www/sitrep
  find . -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} +
  tar xzf /tmp/sitrep-frontend.tar.gz
  chmod -R 755 .

  # PWA
  cd /var/www/sitrep/app
  rm -rf *
  tar xzf /tmp/sitrep-app.tar.gz
  chmod -R 755 .
"

# === Verify ===
sleep 3
curl https://sitrep.ultimamilla.com.ar/api/health
bash backend/tests/smoke-test.sh https://sitrep.ultimamilla.com.ar
```

### Deploy solo backend

```bash
cd backend && npm run build && tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma ecosystem.config.js
scp /tmp/sitrep-backend.tar.gz root@<HOST>:/tmp/
ssh root@<HOST> "cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && pm2 reload sitrep-backend"
```

### Deploy solo manual

```bash
scp docs/manual/index.html root@<HOST>:/var/www/sitrep/manual/index.html
curl https://sitrep.ultimamilla.com.ar/manual/ -o /dev/null -w "HTTP %{http_code}\n"
```

### Rollback de un deploy fallido

```bash
ssh root@<HOST>

# El backend tiene releases anteriores
ls -lt /var/www/sitrep-backend-releases/ | head -5

# Cambiar symlink al release anterior (si existe)
rm /var/www/sitrep-backend
ln -s /var/www/sitrep-backend-releases/<RELEASE_ANTERIOR> /var/www/sitrep-backend
pm2 delete sitrep-backend
pm2 start /var/www/sitrep-backend/ecosystem.config.js
pm2 save
```

---

## Backups

### Backup manual

```bash
ssh root@<HOST>

# DB dump
DATE=$(date +%Y%m%d-%H%M)
docker exec directus-admin-database-1 pg_dump -U directus -d trazabilidad_rrpp \
  | gzip > /opt/sitrep-backups/sitrep-db-$DATE.sql.gz

# .env backup
cp /var/www/sitrep-backend/.env /opt/sitrep-backups/env-$DATE.bak

ls -lh /opt/sitrep-backups/sitrep-db-$DATE.sql.gz
```

### Backup automatizado (cron)

```bash
# Verificar que esta activo
crontab -l | grep backup_sitrep
# Expected: 0 3 * * * /opt/scripts-cicd/backup_sitrep.sh

# Verificar ultimo backup
ls -lt /opt/sitrep-backups/sitrep-db-*.sql.gz | head -3
```

### Verificar tamaño de backups (disk space)

```bash
du -sh /opt/sitrep-backups/
ls /opt/sitrep-backups/ | wc -l   # cantidad de archivos
```

---

## Restore desde backup

```bash
ssh root@<HOST>

# 1. Identificar backup a restaurar
ls -lt /opt/sitrep-backups/sitrep-db-*.sql.gz | head -10

# 2. Stop backend
pm2 stop sitrep-backend

# 3. Restore (CAMBIA EL FILENAME)
gunzip -c /opt/sitrep-backups/sitrep-db-<FECHA>.sql.gz \
  | docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp

# 4. Verificar
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c "
  SELECT 'manifiestos: ' || COUNT(*) FROM manifiestos;
"

# 5. Restart
pm2 restart sitrep-backend
sleep 3
curl https://sitrep.ultimamilla.com.ar/api/health
```

---

## SSL renovation

### Server actual (HTTP-01)

```bash
ssh root@23.105.176.45 "certbot renew --dry-run"   # test
ssh root@23.105.176.45 "certbot renew"             # actual
nginx -s reload
```

### Server VPN (DNS-01)

```bash
ssh root@<VPN_HOST> "
  certbot renew --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini
  systemctl reload nginx
"
```

### Verificar expiry

```bash
echo | openssl s_client -servername sitrep.ultimamilla.com.ar \
  -connect sitrep.ultimamilla.com.ar:443 2>/dev/null \
  | openssl x509 -noout -dates
```

---

## Recuperacion de incidentes

### Sintoma: API no responde

```bash
ssh root@<HOST>

# 1. PM2 status
pm2 list | grep sitrep
# Si esta errored:
pm2 logs sitrep-backend --lines 50 --nostream
# Si esta vacio (post-reboot):
pm2 resurrect

# 2. Si esta corriendo pero no responde:
pm2 restart sitrep-backend

# 3. Si tampoco anda, check DB
docker exec directus-admin-database-1 pg_isready -U directus

# 4. Last resort
pm2 delete sitrep-backend
pm2 start /var/www/sitrep-backend/ecosystem.config.js
pm2 save
```

### Sintoma: nginx failed despues de reboot

```bash
systemctl status nginx
# Si dice "Address already in use":
ss -tlnp | grep -E ':80|:443'
# Identificar quien ocupa los puertos (ej. lshttpd, httpd, apache)
systemctl stop <SERVICIO_CONFLICTIVO>
systemctl disable <SERVICIO_CONFLICTIVO>
systemctl start nginx
```

### Sintoma: 500s en endpoints con fechas

Ver la seccion 16.9 del manual. Verificar que `parseDateRange` esta importado.
Ya no deberia ocurrir post-fix de abril 2026.

```bash
# Test rapido
curl -sH "Authorization: Bearer $TOKEN" \
  "https://sitrep.ultimamilla.com.ar/api/reportes/manifiestos?fechaInicio=BAD"
# Expected: 400 con mensaje, NO 500
```

### Sintoma: disco lleno

```bash
df -h /
# Si > 90%:
du -sh /var/log/* | sort -h | tail -10
du -sh /var/www/* | sort -h | tail -10
du -sh /opt/sitrep-backups/

# Limpiar logs viejos de PM2
pm2 flush sitrep-backend

# Limpiar logs viejos de nginx
find /var/log/nginx -name "*.gz" -mtime +30 -delete

# Cleanup Docker
docker system prune -af --volumes  # CUIDADO: elimina containers/volumes no usados
```

### Sintoma: 502 Bad Gateway

Nginx esta vivo pero no puede conectarse al backend.

```bash
# 1. Verificar backend en localhost
curl http://localhost:3010/api/health

# 2. Si esta caido, restart
pm2 restart sitrep-backend
sleep 3
curl http://localhost:3010/api/health

# 3. Si persiste, ver logs
pm2 logs sitrep-backend --lines 100 --nostream
```

### Sintoma: OOM (out of memory)

```bash
free -h
dmesg | grep -i "out of memory" | tail -5

# Reducir memoria de cache, restart procesos
pm2 restart sitrep-backend
```

---

## DNS cutover

### Pre-cutover (1 dia antes)

```bash
# Lower TTL en Cloudflare a 60s
# (manual, dashboard de Cloudflare)
```

### Cutover

```bash
# 1. Verificar que el server destino responde
curl https://sitrep.ultimamilla.com.ar/api/health \
  --resolve sitrep.ultimamilla.com.ar:443:<NUEVO_IP>

# 2. Update DNS A record en Cloudflare (manual)
# 3. Verificar propagation
dig sitrep.ultimamilla.com.ar +short

# 4. Monitor en ambos servers
ssh root@<NUEVO_IP> "pm2 logs sitrep-backend --lines 100"
# en otra terminal:
ssh root@23.105.176.45 "tail -f /var/log/nginx/access.log"
```

### Rollback de DNS

Ver `scripts/migration/migration-rollback.sh`.

```bash
bash scripts/migration/migration-rollback.sh
# Te guia paso a paso
```

---

## Tests

### Smoke test (rapido, 48 endpoints)

```bash
bash backend/tests/smoke-test.sh https://sitrep.ultimamilla.com.ar
```

### Cross-platform workflow (5 min, 59 tests)

```bash
bash backend/tests/cross-platform-workflow-test.sh https://sitrep.ultimamilla.com.ar
```

### Stress tests (nuevos)

```bash
bash backend/tests/date-validation-stress-test.sh https://sitrep.ultimamilla.com.ar
bash backend/tests/pagination-stress-test.sh https://sitrep.ultimamilla.com.ar
bash backend/tests/sort-stress-test.sh https://sitrep.ultimamilla.com.ar
bash backend/tests/search-safety-test.sh https://sitrep.ultimamilla.com.ar
```

### Stress real (50 users, 20 min)

```bash
bash backend/tests/mundo-real-stress-test.sh https://sitrep.ultimamilla.com.ar
```

### E2E (Playwright)

```bash
cd frontend
PLAYWRIGHT_BASE_URL=https://sitrep.ultimamilla.com.ar \
  npx playwright test --project=chromium --reporter=list
```

### Vitest (unit tests, local)

```bash
cd backend && npm test    # 61 tests
cd frontend && npm test   # 63 tests
```

### Suite completa orquestada

```bash
bash scripts/test-all.sh
```

---

## Comandos rapidos de referencia

```bash
# Restart todo
ssh root@<HOST> "pm2 restart sitrep-backend && systemctl reload nginx"

# Status rapido
ssh root@<HOST> "pm2 list | grep sitrep && systemctl is-active nginx && curl -s localhost:3010/api/health"

# Limpiar logs PM2
ssh root@<HOST> "pm2 flush"

# Ver memoria de PM2
ssh root@<HOST> "pm2 show sitrep-backend | grep -E 'memory|cpu'"

# Backup manual rapido
ssh root@<HOST> "/opt/scripts-cicd/backup_sitrep.sh"
```

---

## Contactos

- **Issues / bugs**: GitHub repo issues
- **Production access**: ver gestor de secretos del equipo
- **VPN credentials**: ver gestor de secretos del equipo
- **Cloudflare access**: admin de zona ultimamilla.com.ar
- **Brevo (SMTP)**: admin de cuenta Brevo

---

**Manual completo del usuario**: https://sitrep.ultimamilla.com.ar/manual/
**Documentacion tecnica**: ver `CLAUDE.md` y `DEPLOY-NUEVO-SERVIDOR.md`
**Migracion VPN**: ver `DEPLOY-VPN-SERVER.md`
**Tests**: ver `docs/TESTING.md`
