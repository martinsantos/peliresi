# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

## Servidor de Producción

| Elemento | Valor |
|----------|-------|
| **IP Servidor** | 23.105.176.45 |
| **URL Web** | https://sitrep.ultimamilla.com.ar/ |
| **URL App Móvil** | https://sitrep.ultimamilla.com.ar/app |
| **API Base** | https://sitrep.ultimamilla.com.ar/api/ |
| **Health Check** | https://sitrep.ultimamilla.com.ar/api/health |

## Paths en Servidor

```
/var/www/sitrep-prod/       # Frontend (archivos estáticos)
/var/www/sitrep-backend/    # Backend Node.js
```

## PM2 Procesos

| Proceso | Puerto | Descripción |
|---------|--------|-------------|
| sitrep-backend | 3010 | API Backend Node.js |

## Deploy Commands

### Frontend
```bash
# Compilar localmente
cd frontend && npm run build

# Subir al servidor
cd frontend/dist && tar czf /tmp/frontend.tar.gz .
scp /tmp/frontend.tar.gz root@23.105.176.45:/tmp/
ssh root@23.105.176.45 "cd /var/www/sitrep-prod && rm -rf * && tar xzf /tmp/frontend.tar.gz && chmod -R 755 ."
```

### Backend
```bash
# Compilar localmente
cd backend && npm run build

# Subir al servidor
scp -r dist package.json package-lock.json prisma root@23.105.176.45:/var/www/sitrep-backend/
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && npm ci --production && pm2 restart sitrep-backend"
```

## Verificación Rápida

```bash
# Estado PM2
ssh root@23.105.176.45 "pm2 list | grep sitrep"

# Health check API
curl -s https://sitrep.ultimamilla.com.ar/api/health

# Frontend accesible
curl -s -I https://sitrep.ultimamilla.com.ar/ | head -3
```

## Base de Datos

```bash
# Conexión PostgreSQL (via Docker)
ssh root@23.105.176.45 "docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_demo"
```

## Roles del Sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| ADMIN | Administrador general | Todo el sistema |
| ADMIN_GENERADORES | Admin sector generadores | Gestión generadores |
| ADMIN_TRANSPORTISTAS | Admin sector transportistas | Gestión transportistas |
| ADMIN_OPERADORES | Admin sector operadores | Gestión operadores |
| GENERADOR | Empresa generadora de residuos | Crear/firmar manifiestos |
| TRANSPORTISTA | Empresa de transporte | Aceptar/transportar |
| OPERADOR | Planta de tratamiento | Recibir/tratar/certificar |

## URLs Importantes

- **Login**: https://sitrep.ultimamilla.com.ar/login
- **Dashboard**: https://sitrep.ultimamilla.com.ar/dashboard
- **Manifiestos**: https://sitrep.ultimamilla.com.ar/manifiestos
- **Reportes**: https://sitrep.ultimamilla.com.ar/reportes
- **App Móvil**: https://sitrep.ultimamilla.com.ar/app

## Variables de Entorno (Servidor)

Archivo: `/var/www/sitrep-backend/.env`

```env
NODE_ENV=production
PORT=3010
DATABASE_URL=postgresql://directus:***@localhost:5432/trazabilidad_demo
JWT_SECRET=***
FRONTEND_URL=https://sitrep.ultimamilla.com.ar
CORS_ORIGIN=https://sitrep.ultimamilla.com.ar
```

---

**IMPORTANTE**: Siempre usar estos datos para deployment. NO usar "demoambiente" ni otras URLs antiguas.
