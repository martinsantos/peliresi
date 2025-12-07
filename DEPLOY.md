# 🔧 Deployment - Sistema de Trazabilidad RRPP

## Arquitectura de Producción

```
Servidor: 23.105.176.45 (VPS 1.7GB RAM, 1 vCPU)
│
├── Nginx (SSL/443)
│   ├── /demoambiente/ → /var/www/demoambiente/ (frontend estático)
│   └── /api/ → http://127.0.0.1:3010 (backend Node.js)
│
├── PM2
│   └── demo-backend (puerto 3010, max 150MB RAM)
│
└── Docker
    └── directus-admin-database-1 (PostgreSQL)
        └── DB: trazabilidad_demo
```

---

## URLs de Producción

| Componente | URL |
|------------|-----|
| **Frontend** | https://www.ultimamilla.com.ar/demoambiente/ |
| **API** | https://www.ultimamilla.com.ar/api/ |
| **Health Check** | https://www.ultimamilla.com.ar/api/health |

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
ssh root@23.105.176.45 "cd /var/www/demoambiente && rm -rf * && tar xzf /tmp/frontend.tar.gz && chmod -R 755 ."
```

### 3. Compilar Backend

```bash
cd backend
npm install
npm run build
```

### 4. Subir Backend al Servidor

```bash
scp -r dist package.json package-lock.json prisma root@23.105.176.45:/home/demoambiente/
ssh root@23.105.176.45 "cd /home/demoambiente && npm ci --production"
```

### 5. Reiniciar Backend

```bash
ssh root@23.105.176.45 "pm2 restart demo-backend"
```

---

## Variables de Entorno (Servidor)

Archivo: `/home/demoambiente/.env`

```env
NODE_ENV=production
PORT=3010
DATABASE_URL="postgresql://directus:umbot_directus_2025!@localhost:5432/trazabilidad_demo?schema=public"
JWT_SECRET=demo-secret-dgfa-mendoza-2025
JWT_REFRESH_SECRET=demo-refresh-dgfa-2025
FRONTEND_URL=https://www.ultimamilla.com.ar
SUPER_ADMIN_EMAIL=santosma@gmail.com
ENABLE_ANALYTICS=true
CORS_ORIGIN=https://ultimamilla.com.ar,https://www.ultimamilla.com.ar
```

---

## Configuración Nginx

Archivo: `/etc/nginx/sites-available/ultimamilla.com.ar`

```nginx
# Frontend Demo (archivos estáticos)
location /demoambiente/ {
    alias /var/www/demoambiente/;
    index index.html;
    try_files $uri $uri/ /demoambiente/index.html;
    add_header X-Robots-Tag "noindex, nofollow" always;
}

# Redirección sin slash
location = /demoambiente {
    return 301 /demoambiente/;
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
```

---

## Base de Datos

### Conexión

```bash
docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_demo
```

### Seed de Datos

```bash
cd /home/demoambiente
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
pm2 restart demo-backend    # Reiniciar backend
pm2 logs demo-backend       # Ver logs
pm2 monit                   # Monitor en tiempo real
```

---

## Monitoreo

### Verificar Estado

```bash
# PM2
pm2 list

# Servicios HTTP
curl -s https://www.ultimamilla.com.ar/demoambiente/ | head -5
curl -s https://www.ultimamilla.com.ar/api/health

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
cat /home/demoambiente/.env | grep CORS

# Reiniciar backend
pm2 restart demo-backend
```

### Error 502 Bad Gateway

```bash
# Verificar que el backend está corriendo
pm2 list
pm2 logs demo-backend --lines 50
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

## Actualización

### Script de Actualización Completo

```bash
#!/bin/bash
# update-demo.sh

# 1. Compilar localmente
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# 2. Subir archivos
tar czf /tmp/frontend.tar.gz -C frontend/dist .
scp /tmp/frontend.tar.gz root@23.105.176.45:/tmp/
scp -r backend/dist backend/package*.json backend/prisma root@23.105.176.45:/home/demoambiente/

# 3. Aplicar en servidor
ssh root@23.105.176.45 << 'EOF'
  cd /var/www/demoambiente && rm -rf * && tar xzf /tmp/frontend.tar.gz
  cd /home/demoambiente && npm ci --production
  pm2 restart demo-backend
EOF

echo "✅ Actualización completada"
```

---

## Seguridad

### No-Indexación

- ✅ Header `X-Robots-Tag: noindex, nofollow`
- ✅ Meta tag `<meta name="robots" content="noindex, nofollow">`
- ✅ Meta tag `<meta name="googlebot" content="noindex, nofollow">`

### Autenticación

- ✅ JWT con expiración
- ✅ API protegida con middleware
- ✅ CORS configurado

### Auditoría

- ✅ Logs de login
- ✅ Registro de operaciones
- ✅ IP y User Agent guardados

---

*Última actualización: 2025-12-07*
