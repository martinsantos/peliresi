# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

Sistema de gestión y trazabilidad de residuos peligrosos — Provincia de Mendoza.

## General Rules

- TypeScript en todos los archivos nuevos.
- Branch activo: `main` (GitHub: https://github.com/martinsantos/peliresi.git)

## Production Server

| | |
|--|--|
| **SSH** | `root@23.105.176.45` |
| **Frontend** | https://sitrep.ultimamilla.com.ar/ |
| **API** | https://sitrep.ultimamilla.com.ar/api/ |
| **Node.js** | v20.19.4, PM2 cluster 2 instancias, puerto 3002 |
| **DB** | PostgreSQL Docker `directus-admin-database-1`, DB: `trazabilidad_rrpp` |

### Server Paths

| Component | Path |
|-----------|------|
| Frontend | `/var/www/sitrep/` |
| PWA App | `/var/www/sitrep/app/` |
| Manual | `/var/www/sitrep/manual/` |
| Backend | `/var/www/sitrep-backend/` |
| Backend .env | `/var/www/sitrep-backend/.env` → symlink `/home/demoambiente/.env` |
| Nginx config | `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar` |
| PM2 logs | `/root/.pm2/logs/sitrep-backend-*.log` |

---

## Deployment

### Frontend

> **⚠️ `VITE_API_URL` es obligatorio al buildear para un dominio distinto al default.**
> Sin él, los bundles quedan con `sitrep.ultimamilla.com.ar/api` hardcodeado y el login falla.

```bash
# Deploy a sitrep.ultimamilla.com.ar (default — sin prefijo necesario)
cd frontend && npm run build
npx vite build --config vite.config.app.ts

# Deploy a sitrepprd1.mendoza.gov.ar (u otro dominio)
cd frontend && VITE_API_URL=https://sitrepprd1.mendoza.gov.ar/api npm run build
VITE_API_URL=https://sitrepprd1.mendoza.gov.ar/api npx vite build --config vite.config.app.ts
```

```bash
cd dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ..
cd dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ..
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz root@23.105.176.45:/tmp/
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
ssh root@23.105.176.45 "cd /var/www/sitrep/app && rm -rf * && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 ."
```

### Backend
```bash
cd backend && npm run build
tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma
scp /tmp/sitrep-backend.tar.gz root@23.105.176.45:/tmp/
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"
```

### PM2
```bash
ssh root@23.105.176.45 "pm2 list"
ssh root@23.105.176.45 "pm2 restart sitrep-backend"
ssh root@23.105.176.45 "pm2 logs sitrep-backend --lines 50"
```

### Database
```bash
ssh root@23.105.176.45 "docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_rrpp"
```

---

## Tech Stack

- **Backend**: Node.js 20 + Express + TypeScript + Prisma + PostgreSQL (Docker)
- **Auth**: JWT, bcrypt, roles: ADMIN / GENERADOR / TRANSPORTISTA / OPERADOR
- **Frontend**: React 19 + TypeScript + Vite 7.2 + TanStack Query v5 + Tailwind CSS
- **Maps**: React Leaflet 1.9.4 | **Charts**: Recharts 3.5.1 | **PDF**: jsPDF 4.1
- **Design**: Primary `#0D8A4F`, fonts: Plus Jakarta Sans / Inter / JetBrains Mono
- **Map markers** (`utils/map-icons.ts`): Generador = purple rounded-square + Factory, Transportista = orange diamond + Truck, **Operador = blue rounded-square + FlaskConical** (NO hexágono). SVG stroke-based Lucide 14×14.

### Vite Configs

| Config | Base | Output |
|--------|------|--------|
| `vite.config.ts` | `/` | `dist/` |
| `vite.config.app.ts` | `/app/` | `dist-app/` |
| `vite.config.v6.ts` | `/v6/` | `dist-v6/` (dev only) |

---

## Architecture

### Backend API Routes

| Route | Descripción |
|-------|-------------|
| `/api/auth/*` | Login, registro, refresh token, perfil, change-password |
| `/api/manifiestos/*` | CRUD, workflow de estados, dashboard |
| `/api/actores/*` | Generadores, transportistas, operadores |
| `/api/reportes/*` | Reportes por período, CSV export |
| `/api/catalogos/*` | Residuos, categorías, vehículos, choferes |
| `/api/analytics/*` | manifiestos-por-mes, residuos-por-tipo, por-estado, tiempo-promedio |
| `/api/admin/*` | CRUD usuarios (solo ADMIN), email-queue, impersonate |
| `/api/pdf/*` | PDF manifiesto + certificado disposición |
| `/api/centro-control/*` | Actividad por capas, mapa, estadísticas GPS |
| `/api/blockchain/*` | Certificación: status, registrar, verificar, integridad |
| `/api/solicitudes/*` | Inscripcion publica wizard + arbitracion admin |
| `/api/notificaciones/*` | Alertas in-app, reglas, anomalías |
| `/api/push/*` | Push nativo: `vapid-key` (pública), `subscribe`, `unsubscribe` |
| `/api/search/*` | Búsqueda global Cmd+K |

### Roles y Permisos

| Rol | Acceso |
|-----|--------|
| `ADMIN` | Todo |
| `GENERADOR` | Sus manifiestos, crear borradores |
| `TRANSPORTISTA` | Sus manifiestos, GPS tracking |
| `OPERADOR` | Sus manifiestos, recibir/tratar |
| `ADMIN_TRANSPORTISTA/GENERADOR/OPERADOR` | CRUD del sector |

**Inspector**: `esInspector: boolean` en Usuario — no es rol, permite ver reportes completos.

### Manifest Workflow

```
BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO
                                   ↘ RECHAZADO
CUALQUIERA (excepto CANCELADO/TRATADO) → CANCELADO

IN_SITU (sin transporte):
BORRADOR → APROBADO → RECIBIDO → EN_TRATAMIENTO → TRATADO
  endpoint: POST /api/manifiestos/:id/recepcion-insitu
```

---

## Gotchas Críticos

- **DB name**: `trazabilidad_rrpp` (NO `trazabilidad_demo`)
- **Filter mapping**: Frontend usa `fechaDesde/fechaHasta`; backend espera `fechaInicio/fechaFin`. `mapFilters()` en `reporte.service.ts` traduce.
- **porTipoResiduo** en `/api/reportes/manifiestos` retorna `{ cantidad, unidad }` (objetos), NO números planos.
- **GPS rate limit**: 600 req/min/IP para soportar 50+ transportistas en NAT compartido.
- **Prisma RHEL**: `npx prisma generate` en servidor requerido tras cada deploy (binarios Ubuntu ≠ RHEL).
- **Service Worker**: versión actual `trazabilidad-rrpp-v26` en `frontend/public/sw.js` y `sw-app.js`. Incrementar con cada deploy frontend.
- **Push Notifications**: VAPID keys en `.env` (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_EMAIL`). Tabla `push_subscripciones`. Rutas: `GET /api/push/vapid-key` (pública), `POST /api/push/subscribe` (auth). `enviarPushAlUsuario()` en `push.service.ts`. Prioridades: CRITICA/ALTA → urgency `high` + vibración diferenciada; CRITICA además `requireInteraction:true`. `notificarPorRol()` también despacha push.
- **`registrarIncidente`**: acepta `tipo` o `tipoIncidente` del frontend.
- **Blockchain**: 2 sellos (GENESIS en APROBADO, CIERRE en TRATADO) + rolling hash en cada estado. Tabla `blockchain_sellos`.
- **Email**: cola en DB `email_queue`, flush cada 5min. Kill switch: `DISABLE_EMAILS=true`.
- **Leaflet z-index**: 400+. Usar `isolate` en content wrappers. Sticky bars necesitan `<main>` con `overflow-auto`.
- **`position: sticky`**: solo funciona si el ancestro scrollable es `<main>`. Root layout: `h-screen overflow-hidden`.

---

## Testing

```bash
# Smoke test (46 endpoints)
bash backend/tests/smoke-test.sh
# Admin: juan.perez@dgfa.gob.ar / admin123
```

---

## CSS & Layout Rules

1. Siempre verificar z-index antes de cambiar posicionamiento (Leaflet = 400+, headers = z-30, modales = z-50).
2. `position: sticky` requiere ancestro con scroll — verificar que `<main>` tenga `overflow-auto`.
3. CSS grid: columnas se estiran al alto del elemento más alto. Usar `self-start` para contenido variable.
4. Testear visualmente antes de declarar fix de CSS completo.

---

## Reglas de Ingeniería

**Tú eres las manos; el humano es el arquitecto.**

1. **Exponer suposiciones** — Declarar antes de implementar. Formato: `SUPOSICIONES: 1. [...] → Corrígeme o procedo.`
2. **Gestión de confusión** — Inconsistencia → DETENTE. Nombra. Presenta disyuntiva. Espera.
3. **Push back** — Señalar problemas directamente con desventaja concreta + alternativa.
4. **Simplicidad** — Si 100 líneas bastan, 1000 es un fallo.
5. **Disciplina de alcance** — Tocar SOLO lo pedido. No limpiar código ortogonal.

**Resumen post-cambio obligatorio:**
```
CAMBIOS: [archivo]: [qué y por qué]
NO TOQUÉ: [archivo]: [por qué]
PREOCUPACIONES: [riesgos]
```

**Modos de fallo a evitar**: suposiciones no verificadas, confusión silenciosa, servilismo, sobrecomplicación, scope creep, borrar código sin entender completamente.
