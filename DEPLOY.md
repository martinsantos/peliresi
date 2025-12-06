# INSTRUCCIONES DE DESPLIEGUE A PRODUCCIÓN (AS-BUILT)

## URL Principal
**https://peliresi.vercel.app/login**

(Redirección desde: `https://www.ultimamilla.com.ar/demoambiente`)

---

## 1. Arquitectura Híbrida

- **Frontend (SPA)**: Vercel (Free Tier)
- **Backend (API)**: Servidor VPS propio (23.105.176.45) en puerto `3010`
- **Base de Datos**: PostgreSQL en Docker existente (Servidor VPS)
- **Proxy Inverso**: Nginx en VPS (SSL Termination)

---

## 2. Configuración Backend (Servidor)

### Ubicación
- Ruta: `/home/demoambiente`
- Servicio PM2: `demo-backend`
- Puerto Interno: `3010`

### Comandos de Mantenimiento
```bash
# Reiniciar Backend
pm2 restart demo-backend

# Ver Logs
pm2 logs demo-backend

# Actualizar Código
cd /home/demoambiente
# (Subir nuevos archivos dist/)
pm2 restart demo-backend
```

### Variables de Entorno (.env)
```env
NODE_ENV=production
PORT=3010
DATABASE_URL="postgresql://directus:umbot_directus_2025!@localhost:5432/trazabilidad_demo?schema=public"
JWT_SECRET=demo-secret-dgfa-mendoza-2025
JWT_REFRESH_SECRET=demo-refresh-dgfa-2025
FRONTEND_URL=https://peliresi.vercel.app
SUPER_ADMIN_EMAIL=santosma@gmail.com
ENABLE_ANALYTICS=true
CORS_ORIGIN=https://peliresi.vercel.app
```

---

## 3. Configuración Frontend (Vercel)

El frontend está desplegado en Vercel conectado al repositorio GitHub.

- **Repositorio**: `martinsantos/peliresi`
- **Branch**: `main`
- **Variables de Entorno (vercel.json)**:
  - `VITE_API_URL`: `https://www.ultimamilla.com.ar/api`

---

## 4. Configuración Nginx

Ubicación: `/etc/nginx/sites-available/ultimamilla.com.ar`

```nginx
# Backend API
location /api/ {
    proxy_pass http://127.0.0.1:3010;
    # ... headers standard ...
}

# Redirección acceso directo
location /demoambiente {
    return 301 https://peliresi.vercel.app/login;
}
```

---

## 5. Credenciales Demo

| Rol | Email | Password |
|-----|-------|----------|
| Admin | admin@dgfa.mendoza.gov.ar | admin123 |
| Generador | quimica.mendoza@industria.com | gen123 |
| Transportista | transportes.andes@logistica.com | trans123 |
| Operador | tratamiento.residuos@planta.com | op123 |

---

## 6. Verificación

1. Backend Health: `https://www.ultimamilla.com.ar/api/health`
2. Frontend Login: `https://peliresi.vercel.app/login`
3. Redirección: `https://www.ultimamilla.com.ar/demoambiente` -> Vercel Login

---

*Fecha de Despliegue: 2025-12-06*
