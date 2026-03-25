# SITREP - Guia de Deploy en Servidor Nuevo

Guia completa, autocontenida y copy-paste para desplegar SITREP (Sistema de Trazabilidad de Residuos Peligrosos) en un servidor limpio. Cubre desde la preparacion del dominio hasta las rutinas de backup post-deploy.

**Fecha**: 2026-03-25
**Version de referencia**: branch `main`, commit `cd69f05`

---

## Tabla de Contenidos

1. [Requisitos](#1-requisitos)
2. [Gestion de Dominio y DNS](#2-gestion-de-dominio-y-dns)
3. [Correos del Dominio](#3-correos-del-dominio)
4. [Instalacion del Servidor](#4-instalacion-del-servidor)
5. [Deploy de la Aplicacion](#5-deploy-de-la-aplicacion)
6. [Migracion de Datos](#6-migracion-de-datos)
7. [CI/CD](#7-cicd)
8. [Rutinas de Backup y Resguardo](#8-rutinas-de-backup-y-resguardo)
9. [Verificacion y Cutover DNS](#9-verificacion-y-cutover-dns)
10. [Tabla de Riesgos](#10-tabla-de-riesgos)

---

## 1. Requisitos

### Hardware minimo

| Recurso | Minimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Disco | 100 GB SSD | 200 GB SSD |
| Ancho de banda | 1 TB/mes | Ilimitado |

### Software y acceso

- **OS**: Ubuntu 22.04 LTS (x86_64) -- testeado y soportado. Ubuntu 24.04 LTS tambien funciona.
- **Acceso SSH root** al servidor nuevo (o usuario con sudo completo).
- **Dominio**: `sitrep.ultimamilla.com.ar` con acceso al panel DNS (Cloudflare).
- **Repositorio**: acceso a `https://github.com/martinsantos/peliresi.git`.
- **Servidor actual** (23.105.176.45): acceso SSH para extraer datos y backups.

### Convenciones de esta guia

- `NUEVO_IP` = la IP publica del servidor nuevo (reemplazar en todos los comandos).
- `VIEJO_IP` = 23.105.176.45 (servidor actual).
- Los bloques de codigo precedidos por `# [LOCAL]` se ejecutan en tu maquina de desarrollo.
- Los bloques precedidos por `# [SERVIDOR]` se ejecutan dentro del servidor nuevo via SSH.

---

## 2. Gestion de Dominio y DNS

### 2.1 Contexto

El dominio `ultimamilla.com.ar` esta gestionado en Cloudflare. SITREP vive en el subdominio `sitrep.ultimamilla.com.ar`. Los registros DNS controlan tres cosas: donde apunta el sitio, que los correos no caigan en spam, y que los correos entrantes lleguen a donde deben.

### 2.2 Registros DNS a configurar

Acceder a Cloudflare > ultimamilla.com.ar > DNS > Records.

#### A Record (obligatorio)

| Tipo | Nombre | Contenido | Proxy | TTL |
|------|--------|-----------|-------|-----|
| A | sitrep | `NUEVO_IP` | OFF (DNS only) | Auto |

**Por que proxy OFF**: Certbot necesita conectarse directamente al servidor para validar el dominio via HTTP-01 challenge. Con proxy ON, Cloudflare intercepta el trafico y Certbot no puede validar. Una vez que SSL este funcionando, se puede activar el proxy si se desea (pero no es necesario; Nginx maneja SSL directamente).

#### SPF (obligatorio para email)

| Tipo | Nombre | Contenido | TTL |
|------|--------|-----------|-----|
| TXT | @ | `v=spf1 include:_spf.brevo.com ~all` | Auto |

**Por que es necesario**: SPF (Sender Policy Framework) le dice a los servidores de correo receptores que servidores estan autorizados a enviar mail en nombre de `ultimamilla.com.ar`. Sin este registro, los correos transaccionales de SITREP (verificacion de email, alertas, notificaciones) seran rechazados o clasificados como spam. `include:_spf.brevo.com` autoriza los servidores SMTP de Brevo.

**Nota**: Si ya existe un registro SPF, no crear uno nuevo. Agregar `include:_spf.brevo.com` al registro existente antes del `~all`.

#### DMARC (obligatorio para email)

| Tipo | Nombre | Contenido | TTL |
|------|--------|-----------|-----|
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:admin@dgfa.mendoza.gov.ar` | Auto |

**Por que es necesario**: DMARC (Domain-based Message Authentication) coordina SPF y DKIM. Define la politica de que hacer cuando un correo no pasa autenticacion. `p=none` significa solo reportar (no rechazar), lo cual es correcto para empezar. `rua=mailto:...` indica donde recibir reportes agregados de autenticacion. Esto mejora la reputacion del dominio y la entregabilidad de los correos.

**Evolucion recomendada**: Despues de 2-4 semanas verificando que los reportes no muestren problemas, subir a `p=quarantine` y luego a `p=reject`.

#### DKIM (obligatorio para email via Brevo)

| Tipo | Nombre | Contenido | TTL |
|------|--------|-----------|-----|
| TXT | brevokey._domainkey | *(clave proporcionada por Brevo al verificar el dominio)* | Auto |

**Por que es necesario**: DKIM (DomainKeys Identified Mail) firma criptograficamente cada correo saliente. El servidor receptor verifica la firma contra la clave publica en DNS. Sin DKIM, Gmail y otros providers marcan los correos como sospechosos. La clave se obtiene del panel de Brevo al agregar y verificar el dominio `ultimamilla.com.ar`.

**Como obtener la clave DKIM de Brevo**:
1. Ir a https://app.brevo.com > Settings > Senders, Domains & Dedicated IPs > Domains
2. Click "Add a domain" > ingresar `ultimamilla.com.ar`
3. Brevo mostrara 3 registros DNS a agregar (el DKIM es uno de ellos)
4. Copiar el valor del registro TXT para `brevokey._domainkey`
5. Agregar en Cloudflare
6. Volver a Brevo y click "Verify" -- debe mostrar todo en verde

#### MX Records (solo si se usa Cloudflare Email Routing)

| Tipo | Nombre | Contenido | Prioridad | TTL |
|------|--------|-----------|-----------|-----|
| MX | @ | `isaac.mx.cloudflare.net` | 49 | Auto |
| MX | @ | `linda.mx.cloudflare.net` | 22 | Auto |
| MX | @ | `amir.mx.cloudflare.net` | 2 | Auto |

**Por que**: Estos MX records dirigen el correo entrante a Cloudflare Email Routing, que luego lo redirige a la casilla destino (ver seccion 3).

---

## 3. Correos del Dominio

SITREP necesita dos capacidades de email: enviar correos transaccionales (notificaciones, alertas) y recibir correos en direcciones del dominio (admin@ultimamilla.com.ar).

### 3.1 Envio: Brevo SMTP Relay (recomendado)

**Costo**: Gratis hasta 300 emails/dia. Suficiente para SITREP (estimado: <50/dia).

**Configuracion**:

1. Crear cuenta en https://app.brevo.com (gratis)
2. Verificar dominio `ultimamilla.com.ar` (agrega los registros DNS de la seccion 2)
3. Obtener credenciales SMTP: Settings > SMTP & API > SMTP

Las credenciales SMTP van en el `.env` del backend:

```env
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="tu-login-brevo@email.com"
SMTP_PASS="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
SMTP_FROM="SITREP <no-reply@sitrep.ultimamilla.com.ar>"
```

**Ventajas**: Sin costo, alta entregabilidad (Brevo mantiene reputacion IP), metricas de apertura/bounce en el panel, no requiere configurar Postfix en el servidor.

### 3.2 Recepcion: Cloudflare Email Routing (recomendado)

**Costo**: Gratis.

**Que hace**: Redirige correos entrantes de `*@ultimamilla.com.ar` a una casilla existente (Gmail, etc.). No es un buzon; es un forwarder.

**Configuracion**:

1. Cloudflare > ultimamilla.com.ar > Email > Email Routing
2. Enable Email Routing (esto agrega los MX records automaticamente)
3. Agregar reglas:
   - `admin@ultimamilla.com.ar` -> `tu-gmail@gmail.com`
   - `soporte@ultimamilla.com.ar` -> `tu-gmail@gmail.com`
   - Catch-all (opcional): `*@ultimamilla.com.ar` -> `tu-gmail@gmail.com`
4. Verificar la casilla destino (Cloudflare envia un email de confirmacion)

**Limitacion**: Solo redirige. No se puede *enviar* desde `admin@ultimamilla.com.ar` usando Gmail (para eso se necesita Google Workspace o similar).

### 3.3 Alternativas para buzones completos

Si se necesita enviar y recibir como `admin@ultimamilla.com.ar`:

| Servicio | Costo | Buzones | Notas |
|----------|-------|---------|-------|
| Google Workspace | USD 7/user/mes | Ilimitados | Mejor integracion, calendar, drive |
| Zoho Mail | Gratis (hasta 5 users) | 5 | Funcional pero UI menos pulida |
| Microsoft 365 | USD 6/user/mes | Ilimitados | Buena opcion si ya se usa Outlook |
| Migadu | USD 19/mes | Ilimitados | Simple, sin limites por usuario |

Para SITREP en etapa actual, **Brevo (envio) + Cloudflare Email Routing (recepcion)** es suficiente y costo cero.

---

## 4. Instalacion del Servidor

### 4.1 Acceso inicial y sistema base

```bash
# [LOCAL] Conectar al servidor nuevo
ssh root@NUEVO_IP
```

```bash
# [SERVIDOR] Actualizar sistema
apt update && apt upgrade -y

# Timezone
timediff="America/Argentina/Mendoza"
timedatectl set-timezone "$timediff"

# Herramientas basicas
apt install -y curl wget git unzip htop ncdu jq

# Crear usuario de servicio (opcional pero recomendado)
adduser --disabled-password --gecos "" sitrep
usermod -aG sudo sitrep
```

### 4.2 Firewall (UFW)

```bash
# [SERVIDOR]
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw enable
ufw status verbose
```

### 4.3 Fail2ban

```bash
# [SERVIDOR]
apt install -y fail2ban

cat > /etc/fail2ban/jail.local << 'EOF'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port    = ssh
filter  = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

systemctl enable fail2ban
systemctl restart fail2ban
fail2ban-client status sshd
```

### 4.4 Node.js 20 + PM2

```bash
# [SERVIDOR]
# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verificar
node -v   # v20.x.x
npm -v    # 10.x.x

# PM2 global
npm install -g pm2

# Configurar PM2 para arrancar con el sistema
pm2 startup systemd
# Ejecutar el comando que muestra pm2 startup
```

### 4.5 Docker + PostgreSQL 15

```bash
# [SERVIDOR]
# Instalar Docker
apt install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list

apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Verificar
docker --version
docker compose version
```

#### docker-compose.yml para PostgreSQL

```bash
# [SERVIDOR]
mkdir -p /opt/sitrep-postgres
cat > /opt/sitrep-postgres/docker-compose.yml << 'COMPEOF'
version: "3.8"

services:
  database:
    image: postgres:15-alpine
    container_name: sitrep-database
    restart: unless-stopped
    ports:
      - "127.0.0.1:5432:5432"
    environment:
      POSTGRES_USER: sitrep
      POSTGRES_PASSWORD: CAMBIAR_POR_PASSWORD_SEGURO
      POSTGRES_DB: trazabilidad_rrpp
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgresql.conf:/etc/postgresql/postgresql.conf
    command: postgres -c config_file=/etc/postgresql/postgresql.conf
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U sitrep -d trazabilidad_rrpp"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
    driver: local
COMPEOF
```

#### Tuning PostgreSQL para 4GB RAM

```bash
# [SERVIDOR]
cat > /opt/sitrep-postgres/postgresql.conf << 'PGEOF'
# ============================================================
# PostgreSQL 15 — Tuning para SITREP (4GB RAM, 2 cores)
# ============================================================

listen_addresses = '*'
port = 5432

# --- Conexiones ---
max_connections = 100            # PM2 cluster (2 inst x 20 pool) + admin + backups

# --- Memoria ---
shared_buffers = 256MB           # 25% de RAM (con 4GB)
effective_cache_size = 1536MB    # 75% de RAM disponible para cache del OS
work_mem = 4MB                   # Por operacion sort/hash (conservador con 100 conexiones)
maintenance_work_mem = 128MB     # VACUUM, CREATE INDEX, etc.

# --- WAL / Write Performance ---
wal_buffers = 16MB
checkpoint_completion_target = 0.9
max_wal_size = 1GB
min_wal_size = 256MB

# --- Query Planner ---
random_page_cost = 1.1           # SSD (default 4.0 es para HDD)
effective_io_concurrency = 200   # SSD

# --- Logging ---
log_min_duration_statement = 1000  # Log queries > 1 segundo
log_line_prefix = '%t [%p] %u@%d '
log_statement = 'ddl'

# --- Autovacuum ---
autovacuum = on
autovacuum_max_workers = 2
autovacuum_naptime = 60
PGEOF
```

#### Iniciar PostgreSQL

```bash
# [SERVIDOR]
cd /opt/sitrep-postgres
docker compose up -d

# Verificar que esta corriendo
docker compose ps
docker exec sitrep-database psql -U sitrep -d trazabilidad_rrpp -c "SELECT version();"
```

**IMPORTANTE**: Cambiar `CAMBIAR_POR_PASSWORD_SEGURO` por un password real generado con:

```bash
openssl rand -base64 32
```

### 4.6 Nginx

```bash
# [SERVIDOR]
apt install -y nginx

# Crear configuracion del sitio
cat > /etc/nginx/sites-available/sitrep.ultimamilla.com.ar << 'NGINXEOF'
# ============================================================
# SITREP — Nginx Configuration
# sitrep.ultimamilla.com.ar
# ============================================================

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=gps:10m rate=20r/s;

server {
    listen 80;
    server_name sitrep.ultimamilla.com.ar;

    # Certbot webroot challenge
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect all HTTP to HTTPS (after SSL is configured)
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name sitrep.ultimamilla.com.ar;

    # SSL certificates (Certbot will fill these in)
    ssl_certificate     /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;

    # --- API Backend (proxy to Node.js on port 3002) ---
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;

        # CORS preflight
        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin $http_origin always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
            add_header Access-Control-Max-Age 86400;
            add_header Content-Length 0;
            return 204;
        }
    }

    # --- GPS endpoint (higher rate limit) ---
    location ~ ^/api/manifiestos/[^/]+/ubicacion$ {
        limit_req zone=gps burst=5 nodelay;
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # --- PWA App (/app/) ---
    location /app/ {
        alias /var/www/sitrep/app/;
        try_files $uri $uri/ /app/app.html;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # --- Manual (/manual/) ---
    location /manual/ {
        alias /var/www/sitrep/manual/;
        try_files $uri $uri/ =404;

        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
            expires 30d;
            add_header Cache-Control "public";
        }
    }

    # --- Main Frontend (SPA) ---
    root /var/www/sitrep;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Service Worker — no cache
    location = /sw.js {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }

    location = /app/sw.js {
        expires -1;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
    }
}
NGINXEOF

# Habilitar sitio
ln -sf /etc/nginx/sites-available/sitrep.ultimamilla.com.ar /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Validar configuracion
nginx -t

# Por ahora solo escuchar en puerto 80 (comentar el bloque ssl)
# Reiniciar despues de Certbot
systemctl restart nginx
```

**IMPORTANTE**: Antes de obtener el certificado SSL, temporalmente comentar el bloque `server { listen 443 ... }` o Nginx no arrancara porque los certificados aun no existen. Una alternativa es crear un config minimal solo con el bloque de puerto 80, obtener el certificado, y luego reemplazar con el config completo.

Config temporal para obtener SSL:

```bash
# [SERVIDOR] Config temporal (solo HTTP)
cat > /etc/nginx/sites-available/sitrep.ultimamilla.com.ar << 'TMPEOF'
server {
    listen 80;
    server_name sitrep.ultimamilla.com.ar;
    root /var/www/html;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 200 'SITREP setup in progress';
        add_header Content-Type text/plain;
    }
}
TMPEOF

nginx -t && systemctl restart nginx
```

### 4.7 Certbot SSL

**Prerequisito**: El registro A en DNS ya debe apuntar a `NUEVO_IP` y haberse propagado.

```bash
# [SERVIDOR]
apt install -y certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d sitrep.ultimamilla.com.ar --non-interactive --agree-tos -m admin@dgfa.mendoza.gov.ar

# Verificar renovacion automatica
certbot renew --dry-run

# Ahora reemplazar con la config completa de Nginx (seccion 4.6)
# y reiniciar:
nginx -t && systemctl reload nginx
```

### 4.8 Crear estructura de directorios

```bash
# [SERVIDOR]
mkdir -p /var/www/sitrep/app
mkdir -p /var/www/sitrep/manual
mkdir -p /var/www/sitrep-backend
mkdir -p /opt/scripts-cicd
mkdir -p /opt/sitrep-backups

# Permisos
chown -R www-data:www-data /var/www/sitrep
chmod -R 755 /var/www/sitrep
```

---

## 5. Deploy de la Aplicacion

### 5.1 Estructura de directorios final

```
/var/www/
  sitrep/                    # Frontend principal (SPA)
    index.html
    assets/
    app/                     # PWA mobile
      app.html
      assets/
    manual/                  # Documentacion estatica
      index.html
  sitrep-backend/            # Backend Node.js
    dist/                    # Codigo compilado
    node_modules/
    prisma/
    package.json
    ecosystem.config.js
    .env                     # Variables de entorno (NO en git)
/opt/
  sitrep-postgres/           # Docker compose PostgreSQL
  scripts-cicd/              # Scripts de deploy, backup, health
  sitrep-backups/            # Backups de DB y .env
```

### 5.2 Backend

#### 5.2.1 Build local

```bash
# [LOCAL]
cd /ruta/al/repo/peliresi/backend

# Instalar dependencias y compilar
npm ci
npm run build

# Empaquetar
tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma
```

#### 5.2.2 Subir y desplegar

```bash
# [LOCAL]
scp /tmp/sitrep-backend.tar.gz root@NUEVO_IP:/tmp/
```

```bash
# [SERVIDOR]
cd /var/www/sitrep-backend
tar xzf /tmp/sitrep-backend.tar.gz

# Instalar dependencias de produccion
npm ci --production

# Generar Prisma Client (con binarios para el servidor)
npx prisma generate

# Crear schema en la base de datos
npx prisma db push
```

#### 5.2.3 Archivo .env

```bash
# [SERVIDOR]
cat > /var/www/sitrep-backend/.env << 'ENVEOF'
# ============================================================
# SITREP Backend — Variables de Entorno (Produccion)
# Generado: 2026-03-25
# ============================================================

# ---- Entorno ----
NODE_ENV=production
PORT=3002

# ---- Base de datos ----
# Ajustar user/password segun docker-compose.yml
# connection_limit=20 por instancia PM2 (2 instancias = 40 total, dentro de max_connections=100)
DATABASE_URL="postgresql://sitrep:CAMBIAR_POR_PASSWORD_SEGURO@localhost:5432/trazabilidad_rrpp?schema=public&connection_limit=20&pool_timeout=10"

# ---- JWT ----
# OBLIGATORIO: Generar secretos unicos con: openssl rand -base64 64
JWT_SECRET="GENERAR_CON_openssl_rand_base64_64"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="GENERAR_OTRO_DISTINTO_CON_openssl_rand_base64_64"
JWT_REFRESH_EXPIRES_IN="7d"

# ---- CORS ----
FRONTEND_URL="https://sitrep.ultimamilla.com.ar"
CORS_ORIGIN="https://sitrep.ultimamilla.com.ar"

# ---- Superadmin ----
SUPER_ADMIN_EMAIL="admin@dgfa.mendoza.gov.ar"

# ---- Analytics ----
ENABLE_ANALYTICS="true"

# ---- Email Queue + SMTP ----
# Kill switch: suprime envios SMTP pero sigue encolando en DB
DISABLE_EMAILS="false"

# Rate limits por destinatario por dia
EMAIL_DAILY_LIMIT_TRANSACCIONAL=10
EMAIL_DAILY_LIMIT_ALERTA=6

# Flush timer (ms). Default 5 min.
EMAIL_FLUSH_INTERVAL_MS=300000

# Max intentos de envio antes de marcar SUPRIMIDO
EMAIL_MAX_RETRIES=3

# SMTP — Brevo (recomendado) o Gmail
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT=587
SMTP_USER="tu-login-brevo@email.com"
SMTP_PASS="xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
SMTP_FROM="SITREP <no-reply@sitrep.ultimamilla.com.ar>"

# ---- Blockchain (opcional) ----
# Descomentar si se usa verificacion blockchain en Sepolia
# BLOCKCHAIN_PRIVATE_KEY=""
# BLOCKCHAIN_CONTRACT_ADDRESS=""
# BLOCKCHAIN_RPC_URL=""

# ---- Logging ----
LOG_LEVEL="info"
ENVEOF

chmod 600 /var/www/sitrep-backend/.env
```

**CRITICO**: Reemplazar todos los valores marcados con `CAMBIAR_*` y `GENERAR_*`. Generar los JWT secrets con:

```bash
openssl rand -base64 64
```

#### 5.2.4 ecosystem.config.js

```bash
# [SERVIDOR]
cat > /var/www/sitrep-backend/ecosystem.config.js << 'PM2EOF'
module.exports = {
  apps: [{
    name: 'sitrep-backend',
    script: 'dist/index.js',
    cwd: '/var/www/sitrep-backend',
    exec_mode: 'cluster',
    instances: 2,
    max_memory_restart: '512M',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    // Logs
    error_file: '/root/.pm2/logs/sitrep-backend-error.log',
    out_file: '/root/.pm2/logs/sitrep-backend-out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Restart policy
    max_restarts: 10,
    restart_delay: 1000,
    autorestart: true,
    watch: false,
    // Graceful shutdown
    kill_timeout: 5000,
    listen_timeout: 10000,
  }]
};
PM2EOF
```

#### 5.2.5 Iniciar backend

```bash
# [SERVIDOR]
cd /var/www/sitrep-backend
pm2 start ecosystem.config.js
pm2 save

# Verificar
pm2 list
pm2 logs sitrep-backend --lines 20

# Health check
curl -s http://localhost:3002/api/health | jq
# Debe mostrar: {"status":"ok","db":"connected",...}
```

### 5.3 Frontend

#### 5.3.1 Build local

```bash
# [LOCAL]
cd /ruta/al/repo/peliresi/frontend

# Asegurarse de que .env.production tiene la URL correcta
cat .env.production
# Debe decir:
# VITE_API_URL=https://sitrep.ultimamilla.com.ar/api

# Build del frontend principal
npm run build

# Build de la PWA mobile
npx vite build --config vite.config.app.ts

# Empaquetar
cd dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ..
cd dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ..
```

#### 5.3.2 Subir y desplegar

```bash
# [LOCAL]
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz root@NUEVO_IP:/tmp/
```

```bash
# [SERVIDOR]
# Frontend principal
cd /var/www/sitrep
find . -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} +
tar xzf /tmp/sitrep-frontend.tar.gz
chmod -R 755 .

# PWA App
cd /var/www/sitrep/app
rm -rf *
tar xzf /tmp/sitrep-app.tar.gz
chmod -R 755 .
```

### 5.4 Manual de usuario

```bash
# [LOCAL]
cd /ruta/al/repo/peliresi/docs/manual
tar czf /tmp/sitrep-manual.tar.gz .
scp /tmp/sitrep-manual.tar.gz root@NUEVO_IP:/tmp/
```

```bash
# [SERVIDOR]
cd /var/www/sitrep/manual
rm -rf *
tar xzf /tmp/sitrep-manual.tar.gz
chmod -R 755 .
```

### 5.5 Verificacion post-deploy

```bash
# [SERVIDOR]
# Backend health
curl -s https://sitrep.ultimamilla.com.ar/api/health | jq

# Frontend carga
curl -s -o /dev/null -w "%{http_code}" https://sitrep.ultimamilla.com.ar/
# Debe devolver 200

# PWA carga
curl -s -o /dev/null -w "%{http_code}" https://sitrep.ultimamilla.com.ar/app/
# Debe devolver 200

# PM2 status
pm2 list
```

---

## 6. Migracion de Datos

Dos estrategias segun el caso de uso.

### Estrategia A: Migracion completa desde produccion

Copiar la base de datos completa del servidor viejo y opcionalmente limpiar datos de demo.

#### A.1 Exportar desde servidor viejo

```bash
# [LOCAL] Crear dump en servidor viejo
ssh root@VIEJO_IP "docker exec sitrep-database pg_dump -U sitrep -d trazabilidad_rrpp --no-owner --no-acl | gzip > /tmp/sitrep-migration.sql.gz"

# Si el contenedor de PostgreSQL se llama diferente (servidor actual):
ssh root@VIEJO_IP "docker exec directus-admin-database-1 pg_dump -U directus -d trazabilidad_rrpp --no-owner --no-acl | gzip > /tmp/sitrep-migration.sql.gz"

# Descargar
scp root@VIEJO_IP:/tmp/sitrep-migration.sql.gz /tmp/
```

#### A.2 Importar en servidor nuevo

```bash
# [LOCAL] Subir al servidor nuevo
scp /tmp/sitrep-migration.sql.gz root@NUEVO_IP:/tmp/
```

```bash
# [SERVIDOR] Detener backend para evitar escrituras durante la importacion
pm2 stop sitrep-backend

# Limpiar la base destino (drop all tables)
docker exec sitrep-database psql -U sitrep -d trazabilidad_rrpp -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO sitrep;
"

# Importar
gunzip -c /tmp/sitrep-migration.sql.gz | docker exec -i sitrep-database psql -U sitrep -d trazabilidad_rrpp

# Regenerar Prisma Client (por si hay cambios de schema)
cd /var/www/sitrep-backend && npx prisma generate

# Reiniciar backend
pm2 restart sitrep-backend
```

#### A.3 Limpieza de datos de demo (opcional)

Si la base migrada contiene datos de demo/test que se quieren eliminar, ejecutar en orden de dependencias (FK constraints):

```bash
# [SERVIDOR]
docker exec -i sitrep-database psql -U sitrep -d trazabilidad_rrpp << 'CLEANSQL'
BEGIN;

-- 1. Tablas dependientes de manifiestos (sin FK circular)
DELETE FROM tracking_gps
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM anomalias_transporte
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM blockchain_sellos
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM alertas_generadas
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM eventos_manifiesto
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM manifiestos_residuos
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM notificaciones
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

DELETE FROM auditorias
  WHERE "manifiestoId" IN (SELECT id FROM manifiestos WHERE "isDemoData" = true);

-- 2. Manifiestos de demo
DELETE FROM manifiestos WHERE "isDemoData" = true;

-- 3. Tablas auxiliares (sin FK a manifiestos)
DELETE FROM demo_access;
DELETE FROM analytics_logs;
DELETE FROM refresh_tokens;
DELETE FROM email_queue;

COMMIT;
CLEANSQL
```

**Nota**: Este SQL asume que los manifiestos de demo tienen el campo `isDemoData = true`. Si no existe ese campo, la limpieza debe hacerse por otro criterio (fecha de creacion, rango de IDs, etc.).

### Estrategia B: Base limpia con datos reales (seed)

Para un deploy completamente nuevo, sin migrar datos del servidor viejo.

```bash
# [SERVIDOR]
cd /var/www/sitrep-backend

# 1. Crear schema
npx prisma db push

# 2. Seed base (usuarios admin, catalogos, tipos de residuo)
npx tsx prisma/seed.ts

# 3. Generadores reales (1846 registros del Registro Provincial)
npx tsx prisma/seed-generadores-reales.ts

# 4. Operadores reales (52 registros)
# Nota: verificar si existe el archivo; si no, el seed base ya incluye operadores demo
ls prisma/seed-operadores-reales.ts 2>/dev/null && npx tsx prisma/seed-operadores-reales.ts

# 5. Transportistas reales
npx tsx prisma/seed-transportistas-reales.ts

# 6. Datos admin (catalogos de tratamientos, categorias, etc.)
npx tsx prisma/seed-admin-data.ts
```

### Verificacion post-migracion

```bash
# [SERVIDOR] Contar registros en tablas principales
docker exec sitrep-database psql -U sitrep -d trazabilidad_rrpp -c "
SELECT
  (SELECT COUNT(*) FROM usuarios) as usuarios,
  (SELECT COUNT(*) FROM generadores) as generadores,
  (SELECT COUNT(*) FROM transportistas) as transportistas,
  (SELECT COUNT(*) FROM operadores) as operadores,
  (SELECT COUNT(*) FROM manifiestos) as manifiestos,
  (SELECT COUNT(*) FROM tipo_residuo) as tipos_residuo,
  (SELECT COUNT(*) FROM blockchain_sellos) as blockchain_sellos;
"
```

Comparar los counts con los del servidor viejo para verificar que la migracion fue completa.

---

## 7. CI/CD

### 7.1 Generar nueva SSH key

```bash
# [LOCAL] Generar key par
ssh-keygen -t ed25519 -f ~/.ssh/sitrep_deploy_key -N "" -C "sitrep-cicd-deploy"

# Agregar la clave publica al servidor nuevo
ssh-copy-id -i ~/.ssh/sitrep_deploy_key.pub root@NUEVO_IP

# Verificar que funciona
ssh -i ~/.ssh/sitrep_deploy_key root@NUEVO_IP "echo 'SSH deploy key OK'"
```

### 7.2 Actualizar GitHub Secrets

```bash
# [LOCAL] Codificar la clave privada en base64
cat ~/.ssh/sitrep_deploy_key | base64 > /tmp/key_b64.txt

# Actualizar secrets en GitHub (requiere gh CLI autenticado)
gh secret set VPS_SSH_KEY_BASE64 < /tmp/key_b64.txt --repo martinsantos/peliresi
gh secret set VPS_HOST --body "NUEVO_IP" --repo martinsantos/peliresi

# Limpiar
rm /tmp/key_b64.txt

# Verificar que los secrets existen
gh secret list --repo martinsantos/peliresi
```

### 7.3 Script de deploy en el servidor

```bash
# [SERVIDOR]
cat > /opt/scripts-cicd/deploy_sitrep_backend.sh << 'DEPLOYEOF'
#!/bin/bash
set -euo pipefail

# ============================================================
# SITREP Backend — Atomic Deployment Script
# Usado por GitHub Actions CI/CD
# ============================================================

RELEASES_DIR="/var/www/sitrep-backend-releases"
CURRENT_LINK="/var/www/sitrep-backend"
ARTIFACT="/tmp/sitrep-backend.tar.gz"
HEALTH_URL="https://sitrep.ultimamilla.com.ar/api/health"
MAX_RELEASES=5

# Timestamp para esta release
RELEASE=$(date +%Y%m%d-%H%M%S)
RELEASE_DIR="${RELEASES_DIR}/${RELEASE}"

echo "=== Deploying release ${RELEASE} ==="

# 1. Crear directorio de release
mkdir -p "${RELEASE_DIR}"

# 2. Extraer artefacto
echo "Extracting artifact..."
tar xzf "${ARTIFACT}" -C "${RELEASE_DIR}"

# 3. Copiar .env de la release actual
if [ -L "${CURRENT_LINK}" ] && [ -f "${CURRENT_LINK}/.env" ]; then
    echo "Copying .env from current release..."
    cp "${CURRENT_LINK}/.env" "${RELEASE_DIR}/.env"
fi

# 4. Copiar ecosystem.config.js
if [ -L "${CURRENT_LINK}" ] && [ -f "${CURRENT_LINK}/ecosystem.config.js" ]; then
    cp "${CURRENT_LINK}/ecosystem.config.js" "${RELEASE_DIR}/ecosystem.config.js"
fi

# 5. Instalar dependencias
echo "Installing dependencies..."
cd "${RELEASE_DIR}"
npm ci --production

# 6. Generar Prisma Client (binarios para este servidor)
echo "Generating Prisma Client..."
npx prisma generate

# 7. Pre-deploy backup
echo "Running pre-deploy backup..."
/opt/scripts-cicd/backup_sitrep.sh || echo "WARNING: Backup failed, continuing deploy..."

# 8. Atomic symlink swap
echo "Swapping symlink..."
PREVIOUS=$(readlink -f "${CURRENT_LINK}" 2>/dev/null || echo "")
ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"

# 9. Restart PM2
echo "Restarting PM2..."
pm2 restart sitrep-backend

# 10. Health check (wait up to 10 seconds)
echo "Checking health..."
sleep 2
HEALTHY=false
for i in 1 2 3 4 5; do
    if curl -sf "${HEALTH_URL}" | grep -q '"status":"ok"'; then
        HEALTHY=true
        break
    fi
    echo "Health check attempt ${i} failed, retrying in 2s..."
    sleep 2
done

if [ "${HEALTHY}" = true ]; then
    echo "=== Deploy successful! Release: ${RELEASE} ==="
else
    echo "=== HEALTH CHECK FAILED — Rolling back ==="
    if [ -n "${PREVIOUS}" ] && [ -d "${PREVIOUS}" ]; then
        ln -sfn "${PREVIOUS}" "${CURRENT_LINK}"
        pm2 restart sitrep-backend
        echo "Rolled back to: ${PREVIOUS}"
    else
        echo "ERROR: No previous release to roll back to!"
    fi
    exit 1
fi

# 11. Cleanup old releases (keep last MAX_RELEASES)
echo "Cleaning up old releases..."
cd "${RELEASES_DIR}"
ls -1dt */ | tail -n +$((MAX_RELEASES + 1)) | xargs rm -rf 2>/dev/null || true

echo "=== Done ==="
DEPLOYEOF

chmod +x /opt/scripts-cicd/deploy_sitrep_backend.sh
```

### 7.4 Testear pipeline antes del cutover

```bash
# [LOCAL] Hacer un push al repo y verificar que el workflow ejecuta correctamente
# Revisar en GitHub Actions que el deploy al nuevo servidor funciona

# Smoke test contra el servidor nuevo
cd /ruta/al/repo/peliresi/backend
bash tests/smoke-test.sh https://sitrep.ultimamilla.com.ar
# Debe pasar 46/46

# Cross-platform workflow test
bash tests/cross-platform-workflow-test.sh https://sitrep.ultimamilla.com.ar
# Debe pasar 59/59
```

---

## 8. Rutinas de Backup y Resguardo

### 8.1 Script de backup principal

```bash
# [SERVIDOR]
cat > /opt/scripts-cicd/backup_sitrep.sh << 'BKEOF'
#!/bin/bash
set -euo pipefail

# ============================================================
# SITREP — Database Backup Script
# Cron: 0 3 * * * /opt/scripts-cicd/backup_sitrep.sh
# ============================================================

BACKUP_DIR="/opt/sitrep-backups"
CONTAINER="sitrep-database"
DB_USER="sitrep"
DB_NAME="trazabilidad_rrpp"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "${BACKUP_DIR}"

echo "[$(date)] Starting SITREP backup..."

# 1. Database dump
DB_FILE="${BACKUP_DIR}/sitrep-db-${TIMESTAMP}.sql.gz"
docker exec "${CONTAINER}" pg_dump -U "${DB_USER}" -d "${DB_NAME}" --no-owner --no-acl | gzip > "${DB_FILE}"

if [ -s "${DB_FILE}" ]; then
    SIZE=$(du -h "${DB_FILE}" | cut -f1)
    echo "[$(date)] DB backup OK: ${DB_FILE} (${SIZE})"
else
    echo "[$(date)] ERROR: DB backup is empty!"
    rm -f "${DB_FILE}"
    exit 1
fi

# 2. .env backup
ENV_FILE="${BACKUP_DIR}/env-${TIMESTAMP}.bak"
if [ -f /var/www/sitrep-backend/.env ]; then
    cp /var/www/sitrep-backend/.env "${ENV_FILE}"
    chmod 600 "${ENV_FILE}"
    echo "[$(date)] .env backup OK: ${ENV_FILE}"
fi

# 3. Cleanup old backups
find "${BACKUP_DIR}" -name "sitrep-db-*.sql.gz" -mtime +${RETENTION_DAYS} -delete
find "${BACKUP_DIR}" -name "env-*.bak" -mtime +${RETENTION_DAYS} -delete

REMAINING=$(ls -1 "${BACKUP_DIR}"/sitrep-db-*.sql.gz 2>/dev/null | wc -l)
echo "[$(date)] Backup complete. ${REMAINING} backups retained (${RETENTION_DAYS}d policy)."
BKEOF

chmod +x /opt/scripts-cicd/backup_sitrep.sh
```

### 8.2 Script de health check

```bash
# [SERVIDOR]
cat > /opt/scripts-cicd/healthcheck.sh << 'HCEOF'
#!/bin/bash

# ============================================================
# SITREP — Health Check + Auto-Restart
# Cron: */5 * * * * /opt/scripts-cicd/healthcheck.sh
# ============================================================

HEALTH_URL="https://sitrep.ultimamilla.com.ar/api/health"
LOG="/var/log/sitrep-healthcheck.log"

RESPONSE=$(curl -sf --max-time 10 "${HEALTH_URL}" 2>/dev/null || echo "FAIL")

if echo "${RESPONSE}" | grep -q '"status":"ok"'; then
    # Todo bien, no loguear para no llenar el log
    exit 0
fi

echo "[$(date)] HEALTH CHECK FAILED: ${RESPONSE}" >> "${LOG}"

# Intentar restart PM2
pm2 restart sitrep-backend 2>> "${LOG}"
sleep 5

# Verificar de nuevo
RETRY=$(curl -sf --max-time 10 "${HEALTH_URL}" 2>/dev/null || echo "FAIL")
if echo "${RETRY}" | grep -q '"status":"ok"'; then
    echo "[$(date)] Auto-restart successful" >> "${LOG}"
else
    echo "[$(date)] CRITICAL: Auto-restart failed. Manual intervention needed." >> "${LOG}"
    # Aqui se podria agregar un envio de email o webhook de alerta
fi
HCEOF

chmod +x /opt/scripts-cicd/healthcheck.sh
```

### 8.3 Script de alerta de disco

```bash
# [SERVIDOR]
cat > /opt/scripts-cicd/disk-alert.sh << 'DISKEOF'
#!/bin/bash

# ============================================================
# SITREP — Disk Space Alert
# Cron: 0 */6 * * * /opt/scripts-cicd/disk-alert.sh
# ============================================================

THRESHOLD=85
LOG="/var/log/sitrep-disk-alert.log"

USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')

if [ "${USAGE}" -ge "${THRESHOLD}" ]; then
    MSG="[$(date)] WARNING: Disk usage at ${USAGE}% (threshold: ${THRESHOLD}%)"
    echo "${MSG}" >> "${LOG}"

    # Limpiar logs de PM2 (pueden crecer mucho)
    pm2 flush 2>/dev/null

    # Limpiar logs de Docker
    docker system prune -f 2>/dev/null

    # Reportar uso detallado
    df -h >> "${LOG}"
    echo "---" >> "${LOG}"
fi
DISKEOF

chmod +x /opt/scripts-cicd/disk-alert.sh
```

### 8.4 Configurar cron jobs

```bash
# [SERVIDOR]
crontab -e
```

Agregar las siguientes lineas:

```cron
# SITREP — Rutinas automatizadas
# ============================================================

# Database backup — todos los dias a las 3 AM
0 3 * * * /opt/scripts-cicd/backup_sitrep.sh >> /var/log/sitrep-backup.log 2>&1

# Cross-server rsync — todos los dias a las 4 AM (descomentar cuando haya servidor secundario)
# 0 4 * * * rsync -avz --delete /opt/sitrep-backups/ root@IP_SERVIDOR_SECUNDARIO:/backups/sitrep-prod/ >> /var/log/sitrep-rsync.log 2>&1

# Health check — cada 5 minutos
*/5 * * * * /opt/scripts-cicd/healthcheck.sh

# Disk space alert — cada 6 horas
0 */6 * * * /opt/scripts-cicd/disk-alert.sh

# Log rotation para archivos propios — semanal
0 0 * * 0 find /var/log -name "sitrep-*.log" -size +50M -exec truncate -s 0 {} \;
```

### 8.5 Cross-server rsync (servidor secundario)

Si se dispone de un segundo servidor para backup offsite:

```bash
# [SERVIDOR] Generar SSH key para rsync (sin passphrase)
ssh-keygen -t ed25519 -f /root/.ssh/rsync_backup_key -N "" -C "sitrep-backup-rsync"

# Copiar clave publica al servidor secundario
ssh-copy-id -i /root/.ssh/rsync_backup_key.pub root@IP_SERVIDOR_SECUNDARIO

# Crear directorio destino en servidor secundario
ssh -i /root/.ssh/rsync_backup_key root@IP_SERVIDOR_SECUNDARIO "mkdir -p /backups/sitrep-prod"

# Test manual
rsync -avz --delete -e "ssh -i /root/.ssh/rsync_backup_key" /opt/sitrep-backups/ root@IP_SERVIDOR_SECUNDARIO:/backups/sitrep-prod/

# Descomentar la linea de cron de la seccion 8.4
```

### 8.6 Tabla resumen de rutinas

| Rutina | Frecuencia | Script | Cron | Descripcion |
|--------|-----------|--------|------|-------------|
| DB Backup | Diario 3 AM | `backup_sitrep.sh` | `0 3 * * *` | pg_dump + gzip + .env copy + rotacion 30 dias |
| Cross-server rsync | Diario 4 AM | rsync (en cron) | `0 4 * * *` | Copia backups a servidor secundario |
| Health check | Cada 5 min | `healthcheck.sh` | `*/5 * * * *` | curl /api/health, auto-restart PM2 si falla |
| Disk alert | Cada 6 horas | `disk-alert.sh` | `0 */6 * * *` | Warning si uso > 85%, limpieza automatica |
| Pre-deploy backup | Cada deploy | dentro de `deploy_sitrep_backend.sh` | N/A (CI/CD trigger) | Backup automatico antes de cada deploy |
| SSL renewal | Automatico | Certbot timer | systemd timer | Certbot renueva certificados < 30 dias de expiracion |
| Log rotation | Semanal | truncate (en cron) | `0 0 * * 0` | Trunca logs propios > 50MB |

### 8.7 Procedimiento de restauracion

**RPO (Recovery Point Objective)**: 24 horas (backups diarios).
**RTO (Recovery Time Objective)**: 30 minutos (asumiendo servidor operativo).

#### Paso a paso

```bash
# [SERVIDOR]

# 1. Listar backups disponibles
ls -lt /opt/sitrep-backups/sitrep-db-*.sql.gz | head -10

# 2. Detener el backend para prevenir escrituras
pm2 stop sitrep-backend

# 3. (Opcional) Backup de la DB actual antes de restaurar
docker exec sitrep-database pg_dump -U sitrep -d trazabilidad_rrpp --no-owner --no-acl | gzip > /opt/sitrep-backups/sitrep-db-pre-restore-$(date +%Y%m%d-%H%M%S).sql.gz

# 4. Limpiar la base actual
docker exec sitrep-database psql -U sitrep -d trazabilidad_rrpp -c "
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO sitrep;
"

# 5. Restaurar desde backup (reemplazar FILENAME con el archivo elegido)
gunzip -c /opt/sitrep-backups/FILENAME.sql.gz | docker exec -i sitrep-database psql -U sitrep -d trazabilidad_rrpp

# 6. Restaurar .env si es necesario
# cp /opt/sitrep-backups/env-CORRESPONDIENTE.bak /var/www/sitrep-backend/.env

# 7. Reiniciar backend
pm2 restart sitrep-backend

# 8. Verificar
sleep 3
curl -s https://sitrep.ultimamilla.com.ar/api/health | jq

# 9. Smoke test
# [LOCAL]
bash backend/tests/smoke-test.sh https://sitrep.ultimamilla.com.ar
```

---

## 9. Verificacion y Cutover DNS

### 9.1 Smoke test

Ejecutar desde la maquina local contra el servidor nuevo (usando la IP directamente, antes del cutover DNS):

```bash
# [LOCAL] Agregar entrada temporal en /etc/hosts para testear
echo "NUEVO_IP sitrep.ultimamilla.com.ar" | sudo tee -a /etc/hosts

# Smoke test (46 endpoints)
cd /ruta/al/repo/peliresi/backend
bash tests/smoke-test.sh https://sitrep.ultimamilla.com.ar
# Esperado: 46/46 PASS

# Cross-platform workflow test (59 tests)
bash tests/cross-platform-workflow-test.sh https://sitrep.ultimamilla.com.ar
# Esperado: 59/59 PASS

# Remover entrada temporal de /etc/hosts cuando termine
sudo sed -i '' '/NUEVO_IP sitrep.ultimamilla.com.ar/d' /etc/hosts
```

### 9.2 Checklist manual

Verificar manualmente en el navegador (con la entrada de /etc/hosts activa):

| # | Verificacion | Como testearlo |
|---|-------------|----------------|
| 1 | Login como ADMIN | Ir a / > login con admin > ver dashboard |
| 2 | Login como GENERADOR | Login > crear manifiesto borrador |
| 3 | Login como TRANSPORTISTA | Login > ver perfil transporte |
| 4 | Login como OPERADOR | Login > ver manifiestos asignados |
| 5 | PWA mobile | Ir a /app/ > verificar que carga, oferece instalar |
| 6 | Manual de usuario | Ir a /manual/ > verificar que carga |
| 7 | Certificado SSL | Verificar candado verde en el navegador |
| 8 | Health check API | `curl https://sitrep.ultimamilla.com.ar/api/health` > status ok |
| 9 | PDF generation | Abrir un manifiesto TRATADO > descargar certificado PDF |
| 10 | Centro de Control | Login como ADMIN > ir a Centro de Control > verificar mapa y datos |

### 9.3 Procedimiento de cutover DNS

#### 24 horas antes del cutover

```bash
# Bajar TTL del registro A a 60 segundos (en Cloudflare)
# Esto permite que el cambio se propague rapido
# Cloudflare > DNS > editar registro A de "sitrep" > TTL = 1 min (60s)
```

#### Momento del cutover

```bash
# 1. Crear ultimo backup del servidor viejo
ssh root@VIEJO_IP "/opt/scripts-cicd/backup_sitrep.sh"

# 2. Copiar ultimo backup al servidor nuevo (datos de ultima hora)
scp root@VIEJO_IP:/opt/sitrep-backups/sitrep-db-ULTIMO.sql.gz root@NUEVO_IP:/tmp/

# 3. Importar en servidor nuevo (repetir seccion 6.A si hay datos nuevos)
# SOLO si hay actividad en produccion entre el ultimo dump y ahora

# 4. Cambiar registro A en Cloudflare
#    sitrep -> NUEVO_IP (proxy OFF, TTL 1 min)

# 5. Verificar propagacion DNS
dig sitrep.ultimamilla.com.ar +short
# Debe devolver NUEVO_IP

nslookup sitrep.ultimamilla.com.ar
# Debe devolver NUEVO_IP

# 6. Verificar desde multiples ubicaciones
# Usar https://dnschecker.org/#A/sitrep.ultimamilla.com.ar
```

#### Despues del cutover

```bash
# 7. Monitorear logs del servidor nuevo durante 1-2 horas
ssh root@NUEVO_IP "pm2 logs sitrep-backend --lines 100"

# 8. Verificar que no llega trafico al servidor viejo
ssh root@VIEJO_IP "tail -f /var/log/nginx/access.log"
# Si sigue llegando trafico, esperar propagacion DNS

# 9. Despues de 48 horas estables, subir TTL a Auto (300s)
# Cloudflare > DNS > editar registro A > TTL = Auto

# 10. Mantener servidor viejo activo 30 dias como fallback
#     Despues de 30 dias sin incidentes, decomisionar
```

### 9.4 Rollback de emergencia

Si algo falla despues del cutover:

```bash
# Revertir DNS a la IP vieja (VIEJO_IP)
# Con TTL de 60s, la propagacion toma 1-5 minutos
# El servidor viejo sigue operativo con los datos pre-cutover
```

---

## 10. Tabla de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigacion | Plan de Contingencia |
|--------|-------------|---------|------------|---------------------|
| **Perdida de datos durante migracion** | Baja | Critico | Backup completo pre-migracion + verificacion de counts post-import. Nunca borrar la base del servidor viejo. | Restaurar desde backup en servidor viejo. DNS rollback en <5 min. |
| **Propagacion DNS lenta** | Media | Medio | Bajar TTL a 60s 24h antes del cutover. Verificar con dnschecker.org desde multiples ubicaciones. | Mantener servidor viejo activo. Algunos usuarios veran el viejo, otros el nuevo; ambos funcionales. |
| **Entregabilidad de email baja** | Media | Medio | Configurar SPF + DKIM + DMARC antes del cutover. Verificar dominio en Brevo. Empezar con `p=none` en DMARC. | Enviar email de prueba a Gmail y verificar que no cae en spam. Ajustar registros DNS segun bounce reports. |
| **Schema drift (Prisma vs DB)** | Baja | Alto | Usar `prisma db push` despues de importar. Comparar output de `prisma migrate status` entre ambos servidores. | Si hay diferencias: exportar schema del viejo con `prisma db pull`, comparar, aplicar migracion manual. |
| **CI/CD falla con nuevo servidor** | Media | Bajo | Testear pipeline completo antes del cutover DNS. Verificar SSH key, paths, permisos. | Deploy manual via scp + scripts hasta resolver el pipeline. Documentado en seccion 5. |
| **Disco lleno** | Media | Alto | Alerta automatica cada 6h (threshold 85%). Rotacion de backups 30 dias. Log rotation semanal. Cross-server rsync para offload. | `pm2 flush` + `docker system prune -f` + eliminar backups antiguos. Si persiste, expandir disco del VPS. |
| **Certificado SSL expira** | Baja | Alto | Certbot auto-renew via systemd timer. `certbot renew --dry-run` verifica que funciona. | `certbot certonly --nginx -d sitrep.ultimamilla.com.ar --force-renewal`. Verificar que el timer de systemd esta activo: `systemctl list-timers \| grep certbot`. |

---

## Apendice: Comandos utiles post-deploy

```bash
# Ver estado general
pm2 list
pm2 monit

# Logs en tiempo real
pm2 logs sitrep-backend

# Reiniciar backend (zero-downtime en cluster mode)
pm2 reload sitrep-backend

# Estado de PostgreSQL
docker exec sitrep-database psql -U sitrep -d trazabilidad_rrpp -c "SELECT count(*) as active_connections FROM pg_stat_activity WHERE datname='trazabilidad_rrpp';"

# Uso de disco
df -h
ncdu /opt/sitrep-backups

# Estado de Nginx
systemctl status nginx
nginx -t

# Estado de SSL
certbot certificates
openssl s_client -connect sitrep.ultimamilla.com.ar:443 -servername sitrep.ultimamilla.com.ar < /dev/null 2>/dev/null | openssl x509 -noout -dates

# Estado de UFW
ufw status verbose

# Estado de fail2ban
fail2ban-client status sshd
```
