# 🔧 Deployment - Sistema de Trazabilidad RRPP (SITREP)

## Arquitectura de Producción

```
Servidor: 23.105.176.45 (VPS 1.7GB RAM, 1 vCPU)
│
├── Nginx (SSL/443)
│   ├── sitrep.ultimamilla.com.ar/ → /var/www/sitrep-prod/ (frontend estático)
│   └── sitrep.ultimamilla.com.ar/api/ → http://127.0.0.1:3010 (backend Node.js)
│
├── PM2
│   └── sitrep-backend (puerto 3010, max 150MB RAM)
│
└── Docker
    └── directus-admin-database-1 (PostgreSQL)
        └── DB: trazabilidad_demo
```

---

## URLs de Producción

| Componente | URL |
|------------|-----|
| **Frontend Web** | https://sitrep.ultimamilla.com.ar/ |
| **App Móvil** | https://sitrep.ultimamilla.com.ar/app |
| **API** | https://sitrep.ultimamilla.com.ar/api/ |
| **Health Check** | https://sitrep.ultimamilla.com.ar/api/health |

---

## Deployment Manual

### 1. Compilar Frontend

```bash
cd frontend
npm install
npm run build
```

### 2. Subir Frontend al Servidor

```bash
cd frontend/dist
tar czf /tmp/frontend.tar.gz .
scp /tmp/frontend.tar.gz root@23.105.176.45:/tmp/
ssh root@23.105.176.45 "cd /var/www/sitrep-prod && rm -rf * && tar xzf /tmp/frontend.tar.gz && chmod -R 755 ."
```

### 3. Compilar Backend

```bash
cd backend
npm install
npm run build
```

### 4. Subir Backend al Servidor

```bash
scp -r dist package.json package-lock.json prisma root@23.105.176.45:/var/www/sitrep-backend/
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && npm ci --production"
```

### 5. Reiniciar Backend

```bash
ssh root@23.105.176.45 "pm2 restart sitrep-backend"
```

---

## Variables de Entorno (Servidor)

Archivo: `/var/www/sitrep-backend/.env`

```env
NODE_ENV=production
PORT=3010
DATABASE_URL="postgresql://directus:***@localhost:5432/trazabilidad_demo?schema=public"
JWT_SECRET=***
JWT_REFRESH_SECRET=***
FRONTEND_URL=https://sitrep.ultimamilla.com.ar
SUPER_ADMIN_EMAIL=santosma@gmail.com
ENABLE_ANALYTICS=true
CORS_ORIGIN=https://sitrep.ultimamilla.com.ar
```

---

## Configuración Nginx

Archivo: `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar`

```nginx
server {
    listen 443 ssl http2;
    server_name sitrep.ultimamilla.com.ar;

    # Frontend SITREP (archivos estáticos)
    location / {
        root /var/www/sitrep-prod;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## Base de Datos

### Conexión

```bash
docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_demo
```

### Seed de Datos

```bash
cd /var/www/sitrep-backend
node prisma/seed.js        # Seed básico
node prisma/seed-demo.js   # Datos de demo (manifiestos)
```

### Verificar Datos

```sql
SELECT
  (SELECT COUNT(*) FROM usuarios) as usuarios,
  (SELECT COUNT(*) FROM generadores) as generadores,
  (SELECT COUNT(*) FROM manifiestos) as manifiestos;
```

---

## PM2 Gestión

```bash
pm2 list                    # Ver procesos
pm2 restart sitrep-backend  # Reiniciar backend
pm2 logs sitrep-backend     # Ver logs
pm2 monit                   # Monitor en tiempo real
```

---

## Monitoreo

### Verificar Estado

```bash
# PM2
pm2 list | grep sitrep

# Servicios HTTP
curl -s https://sitrep.ultimamilla.com.ar/ | head -5
curl -s https://sitrep.ultimamilla.com.ar/api/health

# Base de datos
docker exec directus-admin-database-1 pg_isready -U directus -d trazabilidad_demo
```

### Recursos del Servidor

```bash
free -h          # RAM
df -h /          # Disco
pm2 monit        # CPU/RAM por proceso
```

---

## Troubleshooting

### Error CORS

```bash
# Verificar CORS_ORIGIN en .env
cat /var/www/sitrep-backend/.env | grep CORS

# Reiniciar backend
pm2 restart sitrep-backend
```

### Error 502 Bad Gateway

```bash
# Verificar que el backend está corriendo
pm2 list
pm2 logs sitrep-backend --lines 50
```

### Error de Base de Datos

```bash
# Verificar conexión
docker exec directus-admin-database-1 pg_isready

# Verificar tablas
docker exec directus-admin-database-1 psql -U directus -d trazabilidad_demo -c "\dt"
```

---

## Backups

### Base de Datos

```bash
docker exec directus-admin-database-1 pg_dump -U directus trazabilidad_demo > backup_$(date +%Y%m%d).sql
```

### Restaurar

```bash
docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_demo < backup.sql
```

---

## Script de Actualización Completo

```bash
#!/bin/bash
# update-sitrep.sh

# 1. Compilar localmente
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# 2. Subir archivos
tar czf /tmp/frontend.tar.gz -C frontend/dist .
scp /tmp/frontend.tar.gz root@23.105.176.45:/tmp/
scp -r backend/dist backend/package*.json backend/prisma root@23.105.176.45:/var/www/sitrep-backend/

# 3. Aplicar en servidor
ssh root@23.105.176.45 << 'EOF'
  cd /var/www/sitrep-prod && rm -rf * && tar xzf /tmp/frontend.tar.gz
  cd /var/www/sitrep-backend && npm ci --production
  pm2 restart sitrep-backend
EOF

echo "✅ SITREP actualizado"
```

---

## Seguridad

### Autenticación

- ✅ JWT con expiración
- ✅ API protegida con middleware
- ✅ CORS configurado

### Auditoría

- ✅ Logs de login
- ✅ Registro de operaciones
- ✅ IP y User Agent guardados

---

*Última actualización: 2026-01-22*
