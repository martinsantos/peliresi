# INSTRUCCIONES DE DESPLIEGUE A PRODUCCIÓN

## URL de Destino
**www.ultimamilla.com.ar/demoambiente**

---

## 1. Configuración del Servidor

### Requisitos
- Node.js 18+
- PostgreSQL 14+
- Nginx (reverse proxy)
- PM2 (process manager)

### Variables de Entorno (Backend)

Copiar `.env.production` a `.env`:

```bash
cd backend
cp .env.production .env
# Editar con valores reales:
# - DATABASE_URL
# - JWT_SECRET y JWT_REFRESH_SECRET
# - SUPER_ADMIN_EMAIL=santosma@gmail.com
# - ENABLE_ANALYTICS=true
```

---

## 2. Despliegue Backend

```bash
# Instalar dependencias
cd backend
npm install

# Regenerar cliente Prisma
npx prisma generate

# Migrar base de datos
npx prisma migrate deploy

# Seed de datos demo
npm run db:seed
npx ts-node prisma/seed-demo.ts

# Build y start con PM2
npm run build
pm2 start dist/index.js --name "trazabilidad-api"
```

---

## 3. Despliegue Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Build para producción
npm run build

# Copiar dist/ a nginx
cp -r dist/* /var/www/demoambiente/
```

---

## 4. Configuración Nginx

```nginx
# /etc/nginx/sites-available/demoambiente

server {
    listen 80;
    server_name www.ultimamilla.com.ar;
    
    # IMPORTANTE: Evitar indexación
    add_header X-Robots-Tag "noindex, nofollow" always;
    
    # Frontend
    location /demoambiente {
        alias /var/www/demoambiente;
        try_files $uri $uri/ /demoambiente/index.html;
    }
    
    # API Backend
    location /demoambiente/api {
        proxy_pass http://127.0.0.1:3002/api;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 5. Protección por Password (Opcional)

Para agregar Basic Auth:

```bash
# Crear archivo de passwords
htpasswd -c /etc/nginx/.htpasswd demouser

# Agregar a location /demoambiente:
auth_basic "Demo Ambiente";
auth_basic_user_file /etc/nginx/.htpasswd;
```

---

## 6. Acceso a Estadísticas (Superadmin)

### Configuración
```env
SUPER_ADMIN_EMAIL=santosma@gmail.com
ENABLE_ANALYTICS=true
```

### Endpoints Disponibles

| Endpoint | Descripción |
|----------|-------------|
| GET `/api/analytics/summary` | Resumen de estadísticas |
| GET `/api/analytics/logs` | Logs detallados |
| GET `/api/analytics/user/:email` | Actividad por usuario |

### Acceso
Solo accesible para el usuario logueado con email `santosma@gmail.com`.

---

## 7. Credenciales Demo

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@dgfa.mendoza.gov.ar | admin123 |
| Generador | quimica.mendoza@industria.com | gen123 |
| Transportista | transportes.andes@logistica.com | trans123 |
| Operador | tratamiento.residuos@planta.com | op123 |

---

## 8. Verificar Despliegue

```bash
# Probar API
curl https://www.ultimamilla.com.ar/demoambiente/api/health

# Respuesta esperada:
# {"status":"ok","message":"API is running"}
```

---

**Repositorio**: https://github.com/martinsantos/peliresi  
**Fecha**: 2025-12-06
