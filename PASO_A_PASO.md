# 🚀 Paso a Producción - SITREP v1.0

## Estrategia de Despliegue Seguro

> ⚠️ **IMPORTANTE**: No afectar la demo actual en:  
> https://www.ultimamilla.com.ar/demoambiente/

### Arquitectura Propuesta

```
Servidor: 23.105.176.45
│
├── DEMO (EXISTENTE - NO TOCAR)
│   ├── Frontend: /var/www/demoambiente/
│   ├── Backend PM2: demo-backend (puerto 3010)
│   ├── Base de datos: trazabilidad_demo
│   └── URL: ultimamilla.com.ar/demoambiente/
│
└── PRODUCCIÓN (NUEVO)
    ├── Frontend: /var/www/sitrep-prod/
    ├── Backend PM2: sitrep-prod (puerto 3011)
    ├── Base de datos: sitrep_prod
    └── URL: sitrep.ultimamilla.com.ar
```

---

## Ramas del Repositorio

| Rama | Propósito | Estado |
|------|-----------|--------|
| `main` | Código estable demo | ✅ Protegida |
| `production/v1.0` | Paso a producción | 🔄 En desarrollo |
| `feature/*` | Funcionalidades nuevas | Por crear |

---

## Fases de Implementación

### Fase 1: Infraestructura (Esta sesión) ✅
- [x] Crear rama `production/v1.0`
- [x] Commit documentación de tareas
- [x] Crear base de datos `sitrep_prod`
- [x] Crear directorio `/var/www/sitrep-prod/`
- [x] Crear directorio `/home/sitrep-prod/`
- [x] Configurar Nginx para nuevo dominio
- [x] Configurar PM2 para `sitrep-prod` (puerto 3011)
- [ ] Configurar DNS para `sitrep.ultimamilla.com.ar` ⭐ PENDIENTE MANUAL

### Fase 2: Backend (Rama production/v1.0) ✅
- [x] Crear `.env.sitrep-prod` con credenciales de producción
- [x] Subir backend compilado a `/home/sitrep-prod/`
- [x] Ejecutar `npm ci --production`
- [x] Ejecutar `prisma migrate deploy` - 2 migraciones aplicadas
- [x] Iniciar PM2 `sitrep-prod` - Verificado health check OK

### Fase 3: Frontend (Rama production/v1.0) ✅
- [x] Actualizar `VITE_API_URL=https://sitrep.ultimamilla.com.ar/api`
- [x] Build de producción (670KB JS, 146KB CSS)
- [x] Desplegar en `/var/www/sitrep-prod/`
- [ ] Verificar funcionamiento ⭐ PENDIENTE DNS

### Fase 4: Testing - PENDIENTE
- [ ] Configurar subdominio en proveedor DNS
- [ ] Generar certificado SSL con certbot
- [ ] Verificar casos de uso críticos
- [ ] Tests E2E en nuevo dominio
- [ ] Validar independencia de demo

### Fase 5: Migración de Datos (Post-validación)
- [ ] Obtener datos reales de DGFA
- [ ] Ejecutar scripts de importación
- [ ] Validar datos migrados

---

## Comandos Clave

### Servidor SSH
```bash
ssh root@23.105.176.45
# Pass: [ver memoria del usuario]
```

### Ver estado actual
```bash
pm2 list
netstat -tlnp | grep -E ':3010|:3011'
```

### Crear nueva base de datos
```bash
docker exec -it directus-admin-database-1 psql -U directus -c "CREATE DATABASE sitrep_prod;"
```

### Verificar demo no afectada
```bash
curl -I https://www.ultimamilla.com.ar/demoambiente/
curl https://www.ultimamilla.com.ar/api/health
```

---

## Variables de Entorno - Producción

### Backend `/home/sitrep-prod/.env`
```env
NODE_ENV=production
PORT=3011
DATABASE_URL="postgresql://directus:umbot_directus_2025!@localhost:5432/sitrep_prod?schema=public"
JWT_SECRET=sitrep-prod-secret-2026-[GENERAR]
JWT_REFRESH_SECRET=sitrep-prod-refresh-2026-[GENERAR]
FRONTEND_URL=https://sitrep.ultimamilla.com.ar
CORS_ORIGIN=https://sitrep.ultimamilla.com.ar
ENABLE_ANALYTICS=true
```

### Frontend `.env.production`
```env
VITE_API_URL=https://sitrep.ultimamilla.com.ar/api
```

---

## Nginx - Nuevo Dominio

Archivo: `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar`
```nginx
server {
    listen 443 ssl http2;
    server_name sitrep.ultimamilla.com.ar;
    
    ssl_certificate /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/sitrep.ultimamilla.com.ar/privkey.pem;
    
    # Frontend
    location / {
        root /var/www/sitrep-prod;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:3011;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Verificación de Aislamiento

Después de cada fase, verificar:
```bash
# Demo sigue funcionando
curl -s https://www.ultimamilla.com.ar/demoambiente/ | head -5

# Producción funciona independiente
curl -s https://sitrep.ultimamilla.com.ar/ | head -5

# APIs independientes
curl https://www.ultimamilla.com.ar/api/health  # Demo
curl https://sitrep.ultimamilla.com.ar/api/health  # Prod
```

---

## Rollback

Si algo sale mal en producción:
```bash
# Detener producción (no afecta demo)
pm2 stop sitrep-prod

# Demo sigue funcionando
pm2 list
```

---

*Creado: 2026-01-02*  
*Rama: production/v1.0*
