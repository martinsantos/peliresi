# SITREP — Despliegue sitrepprd1 — Runbook Operacional

**Fecha:** 2026-04-22  
**Servidor:** `sitrepprd1.mendoza.gov.ar` (Gobierno de Mendoza)  
**Operador:** santosma@gmail.com  
**Estado:** ✅ Producción activa

---

## URLs del sistema

| Componente | URL | Notas |
|-----------|-----|-------|
| **Login / App** | `https://sitrepprd1.mendoza.gov.ar/` | SPA principal |
| **API Base** | `https://sitrepprd1.mendoza.gov.ar/api/` | REST API |
| **API Docs** | `https://sitrepprd1.mendoza.gov.ar/api/docs` | Swagger UI |
| **PWA Mobile** | `https://sitrepprd1.mendoza.gov.ar/app/` | Progressive Web App |
| **Manual** | `https://sitrepprd1.mendoza.gov.ar/manual/` | Manual de usuario |
| **Health (live)** | `https://sitrepprd1.mendoza.gov.ar/api/health/live` | Proceso vivo |
| **Health (ready)** | `https://sitrepprd1.mendoza.gov.ar/api/health/ready` | DB + memoria + uptime |

> **SSL:** Certificado self-signed (10 años). El navegador mostrará advertencia de seguridad — esperado para intranet VPN. Aceptar "Continuar de todas formas".

---

## Credenciales de acceso inicial

| Campo | Valor |
|-------|-------|
| **Email** | `admin@dgfa.mendoza.gov.ar` |
| **Password** | `admin123` |
| **Rol** | `ADMIN` |

> ⚠️ **Cambiar la contraseña inmediatamente** tras el primer login: Perfil → Cambiar contraseña.

---

## Arquitectura desplegada

```
Internet/VPN
    │
    ▼
Nginx 1.28.3 (443 SSL)
    │
    ├── /api/*     -> Node.js 22 (systemd) :3010
    ├── /app/*     ─► PWA dist (/var/www/sitrep/app/)
    ├── /manual/*  ─► Manual HTML (/var/www/sitrep/manual/)
    └── /*         ─► SPA React (/var/www/sitrep/)
                                  │
                                  ▼
                       PostgreSQL 18 (apt) :5432
                       DB: sitrep_prod / usuario: sitrep
```

---

## Infraestructura del servidor

| Item | Valor |
|------|-------|
| **Host** | `sitrepprd1.mendoza.gov.ar` |
| **OS** | Ubuntu 25.04 (Resolute) |
| **User** | `ubuntu` |
| **SSH** | `ssh sitrepprd1` (alias en `~/.ssh/config`) |
| **SSH key** | `~/.ssh/ambiente.pem` |
| **Disco /data** | 64 GB (LVM), 5 GB usados, 59 GB libres |
| **Swap** | 4 GB en `/data/swap`, swappiness=10 |

---

## Paths en el servidor

| Componente | Path |
|-----------|------|
| Backend | `/home/ubuntu/sitrep-backend/` |
| Backend .env | `/home/ubuntu/sitrep-backend/.env` |
| Frontend SPA | `/var/www/sitrep/` |
| Frontend PWA | `/var/www/sitrep/app/` |
| Manual | `/var/www/sitrep/manual/` |
| PostgreSQL data | `/var/lib/postgresql/18/main/` (apt default) |
| DB password | `/data/postgres/db-password.txt` |
| DATABASE_URL | `/data/postgres/DATABASE_URL.txt` |
| SSL cert | `/etc/ssl/sitrep/sitrep.crt` |
| SSL key | `/etc/ssl/sitrep/sitrep.key` |
| Nginx config | `/etc/nginx/sites-available/sitrep` |
| Logs backend | `journalctl -u sitrep-backend` |
| Logs nginx | `/var/log/nginx/access.log` / `error.log` |

---

## Stack de software

| Componente | Versión | Fuente |
|-----------|---------|--------|
| Node.js | v22.22.1 | apt (Ubuntu) |
| PostgreSQL | 18.3 | apt (Ubuntu) |
| Nginx | 1.28.3 | apt (Ubuntu) |
| npm | 9.2.0 | apt (Ubuntu) |
| Prisma Client | 5.22.0 | node_modules (vendorizado) |

> **npm registry bloqueado**: La VM no tiene acceso a npmjs.org ni a Docker Hub. El deploy es **vendorizado** — `node_modules/` se transfiere compilado desde la Mac.

---

## Proceso de gestión (systemd, no PM2)

```bash
# Estado
ssh sitrepprd1 "systemctl status sitrep-backend"

# Logs en tiempo real
ssh sitrepprd1 "journalctl -u sitrep-backend -f"

# Últimos 100 errores
ssh sitrepprd1 "journalctl -u sitrep-backend -n 100 --no-pager | grep error"

# Reiniciar
ssh sitrepprd1 "sudo systemctl restart sitrep-backend"

# Parar / arrancar
ssh sitrepprd1 "sudo systemctl stop sitrep-backend"
ssh sitrepprd1 "sudo systemctl start sitrep-backend"
```

> **Por qué systemd y no PM2:** npm registry bloqueado en la red del gobierno. Systemd es equivalente en robustez: restart automático, integración con journald, arranque con el sistema.

---

## Re-deploy (actualizaciones)

Desde la Mac, con VPN activa:

```bash
cd /path/to/peliresi
bash sitrep-deploy-fase3.sh
```

El script:
1. Compila frontend (SPA + PWA) y backend (TypeScript)
2. Genera cliente Prisma con binarios para Ubuntu (sin internet en VM)
3. Transfiere tarballs por SCP (~100 MB backend)
4. Aplica migraciones Prisma
5. Reinicia servicio systemd
6. Hace health check final

**El `.env` NO se sobreescribe** en re-deploys.

---

## Base de datos

### Acceso

```bash
# Desde la VM
DB_PASS=$(ssh sitrepprd1 "cat /data/postgres/db-password.txt")
ssh sitrepprd1 "PGPASSWORD='$DB_PASS' psql -h 127.0.0.1 -U sitrep -d sitrep_prod"

# O directamente en la VM
ssh sitrepprd1
sudo -u postgres psql -d sitrep_prod
```

### Tablas (32 en total)

Creadas por dump del schema de producción (`trazabilidad_rrpp` en `root@23.105.176.45`). Las 5 migraciones de Prisma en `backend/prisma/migrations/` son **additive** (índices, columnas nuevas) — **no** contienen la creación inicial del schema.

> ⚠️ **Importante para futuros fresh deploys**: Siempre aplicar el schema base antes que `prisma migrate deploy`:
> ```bash
> # 1. Volcar schema de producción actual
> ssh root@23.105.176.45 "docker exec directus-admin-database-1 pg_dump \
>   -U directus -d trazabilidad_rrpp --schema-only --no-owner --no-acl -n public" \
>   > /tmp/sitrep-schema.sql
>
> # 2. Aplicar en nuevo servidor
> scp /tmp/sitrep-schema.sql sitrepprd1:/tmp/
> ssh sitrepprd1 "PGPASSWORD=$(cat /data/postgres/db-password.txt) \
>   psql -h 127.0.0.1 -U sitrep -d sitrep_prod -f /tmp/sitrep-schema.sql"
> ```

### Backup

```bash
# Dump completo (schema + datos)
ssh sitrepprd1 "sudo -u postgres pg_dump -d sitrep_prod -F c -f /data/postgres/backup-\$(date +%Y%m%d).dump"

# Restaurar
ssh sitrepprd1 "sudo -u postgres pg_restore -d sitrep_prod /data/postgres/backup-FECHA.dump"
```

---

## Scripts de deploy

| Script | Ejecutar en | Descripción |
|--------|------------|-------------|
| `sitrep-deploy-fase1.sh` | VM (sudo) | Base: swap, Docker, Node.js 22, Nginx |
| `sitrep-deploy-fase2.sh` | VM (sudo) | PostgreSQL 18, DB, usuario, pm2/systemd prep |
| `sitrep-deploy-fase3.sh` | Mac (bash) | Build completo + deploy + Nginx + health check |

---

## Problemas conocidos y workarounds

### npm / Docker Hub bloqueados
- **Causa**: La VM está en red privada del gobierno con salida HTTP/S restringida.
- **Workaround**: Deploy vendorizado — `node_modules/` se incluye en el tarball desde la Mac.
- **Si necesitás instalar npm packages**: Hacerlo en la Mac, incluir en siguiente re-deploy.

### Prisma binary checksum warning
- **Error**: `request to https://binaries.prisma.sh/...sha256 failed`
- **Impacto**: Ninguno — los binarios están en el tarball, el warning es cosmético.
- **Por qué**: Prisma intenta verificar integridad del binario contra internet. El binario pre-generado funciona correctamente.

### `analytics_logs` — Prisma migration vs schema base
- Las tablas se crearon por dump de producción, no por migraciones Prisma.
- La tabla `_prisma_migrations` registra el estado de las 5 migraciones additive.
- Si se agregan nuevas migraciones, `prisma migrate deploy` las aplica normalmente.

### SSL self-signed
- El browser mostrará "Tu conexión no es privada" la primera vez.
- Para intranet VPN es aceptable. Hacer clic en "Avanzado → Continuar".
- Para certificado real: `sudo certbot --nginx -d sitrepprd1.mendoza.gov.ar` (requiere que el dominio sea público y el port 80 accesible desde internet).

---

## Variables de entorno (.env)

Ubicación: `/home/ubuntu/sitrep-backend/.env`

```bash
ssh sitrepprd1 "cat /home/ubuntu/sitrep-backend/.env"
```

Variables pendientes de configurar (actualmente desactivadas):
- `DISABLE_EMAILS=true` → cambiar a `false` y configurar `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- `BLOCKCHAIN_ENABLED=false` → cambiar a `true` con `BLOCKCHAIN_PRIVATE_KEY`, `BLOCKCHAIN_CONTRACT_ADDRESS`

Tras editar `.env`, reiniciar:
```bash
ssh sitrepprd1 "sudo systemctl restart sitrep-backend"
```

---

## Comandos rápidos de operación

```bash
# Health check completo
ssh sitrepprd1 "curl -sk https://localhost/api/health/ready"

# Ver todos los servicios
ssh sitrepprd1 "systemctl is-active sitrep-backend postgresql nginx"

# Uso de recursos
ssh sitrepprd1 "free -h && df -h /data && uptime"

# Ver conexiones a Postgres
ssh sitrepprd1 "sudo -u postgres psql -c 'SELECT count(*) FROM pg_stat_activity;'"

# Rotar logs de Nginx
ssh sitrepprd1 "sudo nginx -s reopen"
```

---

## Historial del despliegue (2026-04-22)

| Hora | Acción | Estado |
|------|--------|--------|
| 17:17 | Fase 1 ejecutada: swap, Docker, Node.js, Nginx | ✅ |
| 17:25 | Fase 2 v1: Docker Hub bloqueado → pivot a apt | ⚠️ |
| 17:28 | Fase 2 completa: PostgreSQL 18, DB `sitrep_prod`, usuario | ✅ |
| 17:35 | Fase 3 iniciada: frontend + backend compilados | ✅ |
| 17:44 | Deploy frontend SPA + PWA | ✅ |
| 17:50 | Backend: `data/` faltaba → transferida manualmente | ✅ |
| 17:51 | Nginx activo con SSL self-signed | ✅ |
| 17:54 | `usuarios` table vacía → schema base desde pg_dump de prod | ✅ |
| 17:57 | Usuario admin creado, login verificado | ✅ |
| 18:00 | Health `/api/health/ready` → `{"status":"ready"}` | ✅ |
