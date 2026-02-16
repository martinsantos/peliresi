# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

Sistema de gestión y trazabilidad de residuos peligrosos para la Provincia de Mendoza.
Permite el seguimiento completo del ciclo de vida de manifiestos: desde la generación hasta el tratamiento final.

**📚 Documentación Unificada**: Ver [`../INFRAESTRUCTURA.md`](../INFRAESTRUCTURA.md) para arquitectura completa de ambos servidores (Producción + Preview), stack tecnológico compartido, y CI/CD workflows.

**Última actualización CI/CD**: 2026-02-15 - Backend workflow con Prisma binary fix + atomic deployments + rollback automático. Database compartida con Directus en PostgreSQL container.

## General Rules

- This is a TypeScript project. Use TypeScript for all new files. When editing existing .js files, check if there's a tsconfig and consider migrating to .ts if the file is being substantially rewritten.

## Repository

- **GitHub**: https://github.com/martinsantos/peliresi.git
- **Branch activo**: `feature/uiux-v6-revolution`
- **Branches**: `main`, `feature/uiux-v6-revolution`, `feature/ui-redesign-humanista`, `production/v1.0`

## Production Server

- **Server IP**: 23.105.176.45
- **SSH**: `root@23.105.176.45`
- **Domain**: sitrep.ultimamilla.com.ar
- **Node.js**: v20.19.4

## Production URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://sitrep.ultimamilla.com.ar/ |
| **PWA App** | https://sitrep.ultimamilla.com.ar/app/ |
| **API** | https://sitrep.ultimamilla.com.ar/api/ |
| **Health Check** | https://sitrep.ultimamilla.com.ar/api/health |

## Latest Build & Test Status

**Last Successful Build**: 2026-02-15 (Cross-Platform Test + Data Consistency)
- ✅ Main Frontend: Built in 17.95s → `dist/`
- ✅ PWA App: Built in 16.82s → `dist-app/`
- ✅ Smoke Test: **44/44 endpoints PASS** (100% coverage)
  - Health (1), Auth (6), Manifiestos (7), Catalogos (9), Actores (6)
  - Admin Usuarios (3), Reportes (3), PDF (1), Analytics (4)
  - Centro de Control (1), Notificaciones (1), QR Verification (2)
- ✅ Cross-Platform Workflow Test: **59/59 PASS** (full lifecycle)
  - 4-role auth (ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR)
  - Complete manifest lifecycle: BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO
  - GPS tracking (3 updates + route verification)
  - Incidents (avería + pausa + reanudación)
  - Timeline (10 events), workflow dates, PDF, certificate, QR public verification
  - Role enforcement (negative tests: wrong-role blocked, unauthenticated blocked)
- ✅ Production API: All systems operational at https://sitrep.ultimamilla.com.ar/api

**Recent Enhancements**:
- ✅ Cross-platform workflow test script: `backend/tests/cross-platform-workflow-test.sh` (59 tests)
- ✅ Demo credentials aligned: Frontend DEMO_CREDENTIALS + MOCK_USERS match actual seeded DB users
- ✅ GPS persistence fix: Pending updates no longer create duplicates on app restart
- ✅ Seed data enriched: All 7 actors with real Mendoza GPS coordinates, enrichment fields, unique vehicles/choferes, fresh vencimientos (2027), differentiated tratamientos per operador
- ✅ TransportistaDetallePage: Added full CRUD (edit/delete) for Vehículos and Conductores tables
- ✅ AdminTratamientosPage: Redesigned with spectacular visual design + full CRUD functionality
- ✅ All Admin CRUD pages verified with consistent edit/delete functionality

## Server Paths

| Component | Server Path |
|-----------|-------------|
| Frontend (main) | `/var/www/sitrep/` |
| PWA App | `/var/www/sitrep/app/` |
| Backend code | `/var/www/sitrep-backend/` |
| Backend .env | `/var/www/sitrep-backend/.env` (symlink a `/home/demoambiente/.env`) |
| Backend dist deploy target | `/var/www/sitrep-backend/` |
| Nginx config | `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar` |
| PM2 logs | `/root/.pm2/logs/sitrep-backend-*.log` |

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20 + Express.js + TypeScript
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (bcrypt passwords, role-based: ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR)
- **Database**: PostgreSQL en Docker (`directus-admin-database-1`)
- **Process Manager**: PM2 cluster mode, 2 instances (process name: `sitrep-backend`, port 3002)
- **Compression**: gzip via `compression` middleware (~7x payload reduction)
- **Connection Pool**: Prisma `connection_limit=20&pool_timeout=10` per instance (40 total across cluster)
- **Request Timeout**: 30s middleware on all requests

### Frontend
- **Framework**: React 19 + TypeScript + Vite 7.2
- **State/Data**: TanStack React Query v5 (mutations + queries)
- **Charts**: Recharts 3.5.1 (BarChart, PieChart, Donut, Gauges)
- **Maps**: React Leaflet + Leaflet 1.9.4
- **PDF Export**: jsPDF 4.1 + jspdf-autotable 5.0
- **Styling**: Tailwind CSS (custom design system)
- **Icons**: Lucide React
- **QR**: html5-qrcode

### Design System
- **Colors**: Primary `#0D8A4F`, Institutional `#1B5E3C`, semantic success/warning/error/info
- **Fonts**: Plus Jakarta Sans (display), Inter (body), JetBrains Mono (mono)
- **Effects**: Glassmorphism, spring easing, stagger-children, hover-lift
- **UI Components**: 17+ componentes en `src-v6/components/ui/`
- **Map Markers** (`utils/map-icons.ts`): Generador = purple rounded-square + Factory, Transportista = orange diamond + Truck, **Operador = blue rounded-square + FlaskConical** (NO hexágono). SVGs stroke-based Lucide 14×14 en blanco sobre fondo de color. Cluster = rounded-square con número.

---

## Deployment - Frontend

```bash
# 1. Build main frontend
cd frontend
npm run build

# 2. Build PWA app
npx vite build --config vite.config.app.ts

# 3. Create tarballs
cd dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ..
cd dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ..

# 4. Upload to server
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz root@23.105.176.45:/tmp/

# 5. Deploy on server
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
ssh root@23.105.176.45 "cd /var/www/sitrep/app && rm -rf * && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 ."
```

## Deployment - Backend

```bash
cd backend
npm run build
tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma
scp /tmp/sitrep-backend.tar.gz root@23.105.176.45:/tmp/
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"
```

## Deployment - Full (Frontend + Backend)

```bash
# Build all
cd backend && npm run build && cd ..
cd frontend && npm run build && npx vite build --config vite.config.app.ts && cd ..

# Package
cd frontend/dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ../..
cd frontend/dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ../..
cd backend && tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma && cd ..

# Upload
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz /tmp/sitrep-backend.tar.gz root@23.105.176.45:/tmp/

# Deploy frontend
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
ssh root@23.105.176.45 "cd /var/www/sitrep/app && rm -rf * && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 ."

# Deploy backend
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"
```

---

## Vite Build Configs

| Config | Base Path | Output Dir | Entry Point |
|--------|-----------|------------|-------------|
| `vite.config.ts` | `/` | `dist/` | `index.html` |
| `vite.config.v6.ts` | `/v6/` | `dist-v6/` | `src-v6/main.tsx` (dev only) |
| `vite.config.app.ts` | `/app/` | `dist-app/` | `app.html` |

### Vite Manual Chunks (vendor splitting)

`vite.config.ts` splits vendor bundles for optimal caching and lazy loading:
- `vendor-react` (45KB): react, react-dom, react-router-dom — always loaded
- `vendor-query` (36KB): @tanstack/react-query — always loaded
- `vendor-charts` (369KB): recharts — loaded only on chart pages
- `vendor-maps` (152KB): leaflet, react-leaflet — loaded only on map pages
- `vendor-pdf` (408KB): jspdf, jspdf-autotable — loaded only on PDF export

## PM2 Management

PM2 runs in **cluster mode** with 2 instances (ecosystem.config.js), 512MB memory limit per instance.

```bash
ssh root@23.105.176.45 "pm2 list"
ssh root@23.105.176.45 "pm2 restart sitrep-backend"
ssh root@23.105.176.45 "pm2 logs sitrep-backend --lines 50"
ssh root@23.105.176.45 "pm2 show sitrep-backend"
# To apply ecosystem.config.js changes:
ssh root@23.105.176.45 "pm2 delete sitrep-backend && pm2 start /var/www/sitrep-backend/ecosystem.config.js && pm2 save"
```

## Database

Database name is `trazabilidad_rrpp` (NOT `trazabilidad_demo`).

```bash
# Acceso directo a PostgreSQL
ssh root@23.105.176.45 "docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_rrpp"
# Check indexes
ssh root@23.105.176.45 "docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c \"SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;\""
```

### Database Indexes (production optimization)

16 custom indexes on key tables for query performance:
- **manifiestos**: generadorId, transportistaId, operadorId, estado, createdAt, [estado+createdAt], [numero], [transportistaId+estado]
- **manifiestos_residuos**: manifiestoId
- **eventos_manifiesto**: manifiestoId, [manifiestoId+tipo]
- **tracking_gps**: manifiestoId, timestamp, [manifiestoId+timestamp]
- **auditorias**: manifiestoId, createdAt
- **alertas_generadas**: manifiestoId, estado
- **anomalias_transporte**: manifiestoId

---

## Architecture

### Backend API Routes

| Route | Controller | Descripción |
|-------|-----------|-------------|
| `/api/auth/*` | auth.controller | Login, registro, refresh token, perfil, cambio de contraseña |
| `/api/manifiestos/*` | manifiesto.controller | CRUD manifiestos, workflow de estados, dashboard |
| `/api/actores/*` | actor.controller | Generadores, transportistas, operadores |
| `/api/reportes/*` | reporte.controller | Reportes por período, tratados, transporte, CSV export |
| `/api/catalogos/*` | catalogo.controller | Residuos, categorías, establecimientos, vehículos |
| `/api/notificaciones/*` | notification.controller | Notificaciones push y alertas |
| `/api/analytics/*` | analytics.controller | Dashboard analytics: manifiestos por mes/estado, residuos por tipo, tiempo promedio |
| `/api/admin/*` | admin.controller | CRUD usuarios (solo ADMIN): listar, crear, editar, eliminar, toggle activo |
| `/api/pdf/*` | pdf.controller | Generación de PDF de manifiestos y certificados de disposición |
| `/api/centro-control/*` | tracking.controller | Centro de Control: actividad por capas, mapa, estadísticas |

### Key API Endpoints

```
GET  /api/manifiestos/dashboard      → estadísticas (borradores, aprobados, enTransito, entregados, recibidos, tratados, total) + recientes + enTransitoList
GET  /api/reportes/manifiestos       → porEstado, porTipoResiduo, manifiestos[], pagination (params: fechaInicio, fechaFin, page, limit). NOTA: porTipoResiduo retorna objetos { cantidad, unidad }, NO números planos. Agregación via Prisma groupBy.
GET  /api/reportes/tratados          → porGenerador, totalPorTipo, detalle[], pagination (params: fechaInicio, fechaFin, page, limit)
GET  /api/reportes/transporte        → transportistas[] con tasaCompletitud, pagination (params: fechaInicio, fechaFin, page, limit). Usa _count en vez de cargar manifiestos completos.
GET  /api/reportes/exportar/:tipo    → CSV blob (tipos: manifiestos, generadores, transportistas, operadores). Límite: 10,000 filas max.
POST /api/manifiestos/:id/aprobar    → Cambiar estado BORRADOR → APROBADO
POST /api/manifiestos/:id/confirmar-retiro → APROBADO → EN_TRANSITO
POST /api/manifiestos/:id/entregar   → EN_TRANSITO → ENTREGADO
POST /api/manifiestos/:id/recibir    → ENTREGADO → RECIBIDO
POST /api/manifiestos/:id/tratamiento → RECIBIDO → EN_TRATAMIENTO
POST /api/manifiestos/:id/cerrar      → EN_TRATAMIENTO/RECIBIDO → TRATADO
POST /api/manifiestos/:id/rechazar    → ENTREGADO → RECHAZADO
POST /api/manifiestos/:id/incidente   → Registra incidente en transito (acepta campo `tipo` o `tipoIncidente`)
POST /api/manifiestos/:id/cancelar    → Cancela manifiesto (si no es CANCELADO ni TRATADO)
POST /api/manifiestos/:id/ubicacion   → GPS update (latitud, longitud, velocidad?, direccion?) — solo EN_TRANSITO
GET  /api/centro-control/actividad    → Centro de Control con capas (params: fechaDesde, fechaHasta, capas=generadores,transportistas,operadores,transito)
GET  /api/pdf/manifiesto/:id          → PDF del manifiesto
GET  /api/pdf/certificado/:id         → Certificado de Tratamiento y Disposición Final (solo estado TRATADO)
PUT  /api/manifiestos/:id             → Editar manifiesto (solo BORRADOR, reemplaza residuos via $transaction)
DEL  /api/manifiestos/:id             → Eliminar manifiesto (solo BORRADOR/CANCELADO, cascading delete)
GET  /api/manifiestos/:id/viaje-actual → GPS tracking points para un manifiesto (limit 500, ordered by timestamp)
POST /api/auth/change-password        → Cambiar contraseña (verifica actual, valida nueva, hash bcrypt)
GET  /api/catalogos/vehiculos         → Lista global de vehículos activos (con transportista)
GET  /api/catalogos/choferes          → Lista global de choferes activos (con transportista)
DEL  /api/actores/transportistas/:id  → Eliminar transportista (verifica sin manifiestos, cascade vehiculos/choferes/usuario)
GET  /api/analytics/manifiestos-por-mes    → Manifiestos creados por mes (últimos 12 meses, raw SQL)
GET  /api/analytics/residuos-por-tipo      → Residuos agrupados por tipo (Prisma groupBy)
GET  /api/analytics/manifiestos-por-estado → Manifiestos agrupados por estado (Prisma groupBy)
GET  /api/analytics/tiempo-promedio        → Tiempo promedio por etapa del workflow (horas entre fechas)
GET  /api/admin/usuarios              → Lista usuarios con filtros (rol, search, activo) + paginación
GET  /api/admin/usuarios/:id          → Detalle de usuario con actor asociado
POST /api/admin/usuarios              → Crear usuario (Zod validation, hash bcrypt)
PUT  /api/admin/usuarios/:id          → Editar usuario (email, nombre, rol, etc.)
DEL  /api/admin/usuarios/:id          → Eliminar usuario (verifica sin manifiestos asociados)
PATCH /api/admin/usuarios/:id/toggle-activo → Toggle campo activo del usuario
GET  /api/manifiestos/verificar/:numero → Verificación pública de manifiesto por número (sin auth)
```

### Frontend Filter Mapping

El frontend usa `fechaDesde/fechaHasta` pero el backend espera `fechaInicio/fechaFin`.
La función `mapFilters()` en `reporte.service.ts` traduce entre ambos.

### Roles y Permisos

| Rol | Acceso |
|-----|--------|
| `ADMIN` | Todo: dashboard, manifiestos, actores, reportes, auditoría, configuración, usuarios |
| `GENERADOR` | Sus manifiestos (filtrado por generadorId), crear borradores, perfil |
| `TRANSPORTISTA` | **DEMO MODE: ve TODOS los manifiestos** (filtro por transportistaId desactivado en `getManifiestos` y `getDashboardStats`). Tracking GPS, viaje en curso, "Tomar Viaje" desde perfil |
| `OPERADOR` | Sus manifiestos (filtrado por operadorId), recibir, tratar |

---

## GPS Tracking System

### Architecture

The GPS tracking system enables real-time position monitoring for up to **50 simultaneous trips**.

**Flow**: Phone (watchPosition) → every 30s → `POST /api/manifiestos/:id/ubicacion` → `tracking_gps` table → Centro de Control polls every 30s

### Frontend (ViajeEnCursoTransportista.tsx)

- **GPS collection**: `navigator.geolocation.watchPosition()` runs continuously
- **Transmission interval**: 30 seconds (sends latest position only)
- **GPS Status State Machine**: `checking` → `acquiring` → `active` | `denied` | `unavailable` | `error`
- **Data sent**: `{ latitud, longitud, velocidad?, direccion? }`
- **Offline resilience**: Failed updates queued in `pendingUpdatesRef` (max 5), **persisted to localStorage** (`gps_pending_{id}`) on PWA close/backgrounding. On mount, saved GPS points are flushed to backend. Also backed by IndexedDB `sync_queue`
- **watchPosition cleanup**: Robust cleanup via `cleanupGps` callback + `beforeunload` listener prevents zombie watchers on navigation/unmount
- **Pause/Resume**: Records `PAUSA`/`REANUDACION` incidents via backend + localStorage backup
- **Timer persistence**: Uses server `fechaRetiro` timestamp (not local counter)

### Backend (manifiesto.controller.ts)

- **Endpoint**: `POST /api/manifiestos/:id/ubicacion`
- **Auth**: TRANSPORTISTA or ADMIN
- **Validation**: Checks manifiesto exists and is EN_TRANSITO
- **In-memory cache**: 30s TTL per manifiestoId to skip repeated `findUnique` SELECT (~10x faster for frequent GPS updates, TTL matches GPS interval)
- **Cache invalidation**: On `confirmarEntrega` (trip state change)
- **Data stored**: `tracking_gps` table with `latitud`, `longitud`, `velocidad`, `direccion`, `timestamp`

### Centro de Control (tracking.controller.ts)

- **Endpoint**: `GET /api/centro-control/actividad`
- **Params**: `fechaDesde`, `fechaHasta`, `capas` (csv: generadores, transportistas, operadores, transito)
- **EN_TRANSITO filter**: Shows trips created in date range OR with GPS tracking in date range (OR condition)
- **Date parsing**: `fechaHasta` auto-bumped to 23:59:59.999 to include full day (avoids midnight truncation bug)
- **Layers**: Generadores, Transportistas, Operadores (filtered by activity in period), En Tránsito (up to 50 GPS points per trip)
- **Statistics**: Pipeline counts per estado, KPIs, manifiestosPorDia via raw SQL

### Capacity (scaled to 50 transportistas)

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Max concurrent trips** | 50+ | Scaled from 30 with connection pool, indexes, $transaction, and cache optimizations |
| **GPS update interval** | 30s per client | 1 req/30s per phone |
| **Rate limit** | 600 req/min/IP | Supports 50+ phones behind shared NAT/CGNAT |
| **DB connection pool** | 20 per PM2 instance (40 total) | `connection_limit=20&pool_timeout=10` in DATABASE_URL |
| **PostgreSQL max_connections** | 100 | ~40 active at peak with 50 transportistas |
| **Per-request latency** | ~24ms (cached) / ~250ms (cold) | Cache TTL: 30s |
| **Data growth** | ~6,000 rows/hour at 50 trips | With composite indexes, query perf stays constant |
| **Analytics** | GPS routes skipped | `/ubicacion` and `/gps` paths excluded from analytics middleware |

### Concurrency Protections (50 transportistas)

| Protection | File | Description |
|------------|------|-------------|
| **$transaction on workflow** | `manifiesto.controller.ts` | `confirmarRetiro`, `confirmarEntrega`, `registrarTratamiento` wrapped in `prisma.$transaction()` — prevents race conditions from double-tap or simultaneous requests |
| **Double-tap guard** | `ManifiestoDetallePage.tsx` | `actionInFlightRef` blocks concurrent action submissions before React re-renders `isPending` |
| **Cross-tab token sync** | `api.ts` | `storage` event listener syncs token refresh across browser tabs — prevents queue starvation |
| **switchUser async** | `AuthContext.tsx` | `switchUser()` is async with `await` + `setIsLoading(true)` — prevents navigation with inconsistent tokens |
| **Logout cleanup** | `AuthContext.tsx` | `logout()` clears `sitrep_active_trip_id`, `viaje_snapshot_*`, `viaje_status_*`, `gps_pending_*` from localStorage |
| **ActiveTripGuard** | `AppMobile.tsx` | Validates trip estado against terminal states before redirecting — prevents redirect loop to finished trips |
| **GPS localStorage persist** | `ViajeEnCursoTransportista.tsx` | `pendingUpdatesRef` persisted to `gps_pending_{id}` on close; flushed to backend on mount |
| **watchPosition cleanup** | `ViajeEnCursoTransportista.tsx` | `cleanupGps` callback + `beforeunload` listener prevents zombie GPS watchers |

### Mobile Dashboard (MobileDashboardPage.tsx)

- **TRANSPORTISTA-specific**: Shows trip assignment banner between welcome and stats grid
- **Active trips (EN_TRANSITO)**: Pulsing green card with "Ir al viaje" button
- **Pending trips (APROBADO)**: Warning-colored card with clickable list
- **Data source**: `useManifiestos({ estado: EN_TRANSITO/APROBADO, limit: 5 })`

### TransportePerfilPage (TransportePerfilPage.tsx)

- **3 tabs**: Viaje, Info, Historial
- **Tab Viaje — prioridad de visualización**:
  1. Si hay manifiesto EN_TRANSITO → muestra viaje activo con mapa, controles (pausar/incidente/finalizar)
  2. Si NO hay EN_TRANSITO pero hay APROBADO → muestra lista "Viajes Asignados" con cards (número, generador, operador, residuos, fecha) y botón **"Tomar Viaje"** → navega a `/transporte/viaje/:id` (ViajeEnCursoTransportista)
  3. Si no hay ninguno → EmptyState
- **Data source**: `useManifiestos({ estado: EN_TRANSITO, limit: 1 })` + `useManifiestos({ estado: APROBADO, limit: 10 })`
- **Flujo "Tomar Viaje"**: TransportePerfilPage (lista APROBADO) → click "Tomar Viaje" → ViajeEnCursoTransportista → "Confirmar Retiro" → manifiesto pasa a EN_TRANSITO + GPS tracking

### CentroControlPage Role Filtering

- **ADMIN**: Sees all EN_TRANSITO trips
- **TRANSPORTISTA**: Filtered by `currentUser.sector` (company name match against transportista)
- **Alertas**: Only queried for ADMIN role (`useAlertas(filters, isAdmin)`)

---

## Frontend Pages (src-v6)

### Dashboard & Control
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Dashboard | `pages/dashboard/DashboardPage.tsx` | KPIs, resumen general |
| Centro de Control | `pages/centro-control/CentroControlPage.tsx` | Sala de operaciones: LIVE badge, 5 KPIs, pipeline funnel, mapa + viajes activos/realizados accordion, donut chart, bar chart, auto-refresh 30s, 6 acciones rápidas. Viajes panel usa `self-start` para no estirarse con el mapa. |
| Mobile Dashboard | `pages/mobile/MobileDashboardPage.tsx` | Versión mobile optimizada |

### Reportes (code-split con React.lazy)
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Centro de Reportes (shell) | `pages/reportes/ReportesPage.tsx` | Shell ~370 líneas: filter bar, tab switcher, exportación PDF/CSV, lazy loading de tabs con Suspense |
| Tab: Manifiestos | `pages/reportes/tabs/ManifiestosTab.tsx` | KPIs, gráfico por estado (donut), por tipo residuo (bar), tabla paginada |
| Tab: Residuos Tratados | `pages/reportes/tabs/TratadosTab.tsx` | KPIs, gauge tasa tratamiento, donut por tipo, tabla tratados |
| Tab: Transporte | `pages/reportes/tabs/TransporteTab.tsx` | KPIs, bar chart completitud, tabla transportistas con progress bars |
| Tab: Establecimientos | `pages/reportes/tabs/EstablecimientosTab.tsx` | KPIs, pie categorías, bar departamentos, tabla generadores |
| Tab: Operadores | `pages/reportes/tabs/OperadoresTab.tsx` | KPIs, pie categorías, bar recibidos/tratados, tabla operadores |
| Tab: Departamentos | `pages/reportes/tabs/DepartamentosTab.tsx` | Choropleth map, ranking, DepartamentoDetalleModal |
| Tab: Mapa de Actores | `pages/reportes/tabs/MapaActoresTab.tsx` | Leaflet map con layer toggles, clustering, popups |
| Shared utilities | `pages/reportes/tabs/shared.tsx` | downloadCsv, DonutCenterLabel, clusterMarkers |

### Manifiestos
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Lista | `pages/manifiestos/ManifiestosPage.tsx` | Tabla con búsqueda, filtros por estado, paginación |
| Detalle | `pages/manifiestos/ManifiestoDetallePage.tsx` | Workflow completo con 10 acciones por estado/rol, timeline, descarga PDF y Certificado de Disposición (estado TRATADO) |
| Nuevo | `pages/manifiestos/NuevoManifiestoPage.tsx` | Formulario multi-paso con auto-populate de datos del actor al seleccionar (CUIT, teléfono, domicilio, habilitación) |
| Verificar | `pages/manifiestos/VerificarManifiestoPage.tsx` | Verificación pública de manifiesto via QR/número |

### Actores
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Todos los actores | `pages/actores/ActoresPage.tsx` | Vista unificada gen/trans/oper |
| Transportistas | `pages/actores/TransportistasPage.tsx` | Lista + detalle |
| Operadores | `pages/actores/OperadoresPage.tsx` | Lista + detalle |

### Admin
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Residuos | `pages/admin/AdminResiduosPage.tsx` | Catálogo con filtros interactivos en stat cards y categorías |
| Generadores | `pages/admin/AdminGeneradoresPage.tsx` | CRUD generadores |
| Operadores | `pages/admin/AdminOperadoresPage.tsx` | CRUD operadores con enrichment DPA |
| Tratamientos | `pages/admin/AdminTratamientosPage.tsx` | Catálogo de tratamientos |
| Vehículos | `pages/admin/AdminVehiculosPage.tsx` | CRUD vehículos |
| Usuarios | `pages/usuarios/UsuariosPage.tsx` | Gestión de usuarios y roles (CRUD completo via admin.controller) |

### Transporte & Tracking
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Tracking | `pages/tracking/TrackingPage.tsx` | Seguimiento GPS en mapa |
| Viaje en Curso | `pages/tracking/ViajeEnCursoPage.tsx` | Vista de viaje activo |
| Perfil Transporte | `pages/transporte/TransportePerfilPage.tsx` | Dashboard transportista: 3 tabs (Viaje, Info, Historial). Tab Viaje muestra viaje EN_TRANSITO activo, o lista de viajes APROBADO con botón "Tomar Viaje", o EmptyState |
| Viaje Transportista | `pages/transporte/ViajeEnCursoTransportista.tsx` | Control de viaje para transportista |

### Otros
| Página | Archivo |
|--------|---------|
| Alertas | `pages/alertas/AlertasPage.tsx` |
| Auditoría | `pages/auditoria/AuditoriaPage.tsx` |
| Escáner QR | `pages/escaner/EscanerQRPage.tsx` |
| Carga Masiva | `pages/carga-masiva/CargaMasivaPage.tsx` |
| Configuración | `pages/configuracion/ConfiguracionPage.tsx` |
| Perfil | `pages/perfil/PerfilPage.tsx` |
| Estadísticas | `pages/estadisticas/EstadisticasPage.tsx` |
| Login | `pages/auth/LoginPage.tsx` |

---

## Key Frontend Files

### Hooks
| Hook | Archivo | Uso |
|------|---------|-----|
| `useDashboardStats` | `hooks/useDashboard.ts` | Stats dashboard con `refetchInterval: 30s` |
| `useReporteManifiestos` | `hooks/useReportes.ts` | Datos reportes manifiestos |
| `useReporteTratados` | `hooks/useReportes.ts` | Datos reportes tratados |
| `useReporteTransporte` | `hooks/useReportes.ts` | Datos reportes transporte |
| `useExportarReporte` | `hooks/useReportes.ts` | Mutación exportar CSV |
| `useManifiestos` | `hooks/useManifiestos.ts` | Lista y operaciones manifiestos |
| `useAlertas` | `hooks/useAlertas.ts` | Alertas del sistema |
| `useActores` | `hooks/useActores.ts` | Generadores, transportistas, operadores |

### Utils
| Util | Archivo | Función |
|------|---------|---------|
| `exportReportePDF` | `utils/exportPdf.ts` | Genera PDF profesional con jsPDF: header SITREP verde, KPI cards, tabla autoTable, footer paginado |
| `formatRelativeTime` | `utils/formatters.ts` | Formato "hace X minutos" |
| `ACTOR_ICONS` | `utils/map-icons.ts` | Leaflet divIcons para mapas: Generador (purple rounded-square + Factory), Transportista (orange diamond + Truck), Operador (blue rounded-square + FlaskConical), En Tránsito (red pulsing circle). Todos los íconos SVG son stroke-based Lucide 14×14. Operador debe usar FlaskConical (NO hexágono, NO Building2). |
| `createClusterIcon` | `utils/map-icons.ts` | Cluster marker (rounded-square con count numérico) para >50 items en un grid de 0.05° |

### Services
| Service | Archivo | API Base |
|---------|---------|----------|
| `reporteService` | `services/reporte.service.ts` | `/reportes/*` (con mapFilters fechaDesde→fechaInicio) |
| `analyticsService` | `services/analytics.service.ts` | `/analytics/*` (4 dashboard endpoints fully implemented) |
| `usuarioService` | `services/usuario.service.ts` | `/admin/usuarios/*` (CRUD usuarios, solo ADMIN) |
| `manifiestoService` | `services/manifiesto.service.ts` | `/manifiestos/*` |
| `actoresService` | `services/actores.service.ts` | `/actores/*` |
| `catalogoService` | `services/catalogo.service.ts` | `/catalogos/*` (tipos residuos, generadores, transportistas, operadores, vehículos, choferes, tratamientos) |

---

## Manifest Workflow States

```
BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO
                                   ↘ RECHAZADO
                    ↗ INCIDENTE (evento, no cambia estado)
CUALQUIERA (excepto CANCELADO/TRATADO) → CANCELADO
```

### Workflow Actions by Role (ManifiestoDetallePage)

| Action | From State | To State | Allowed Roles |
|--------|-----------|----------|---------------|
| Firmar/Aprobar | BORRADOR | APROBADO | GENERADOR, ADMIN |
| Confirmar Retiro | APROBADO | EN_TRANSITO | TRANSPORTISTA, ADMIN |
| Confirmar Entrega | EN_TRANSITO | ENTREGADO | TRANSPORTISTA, ADMIN |
| Registrar Incidente | EN_TRANSITO | _(event only)_ | TRANSPORTISTA, ADMIN |
| Confirmar Recepción | ENTREGADO | RECIBIDO | OPERADOR, ADMIN |
| Rechazar Carga | ENTREGADO | RECHAZADO | OPERADOR, ADMIN |
| Registrar Pesaje | RECIBIDO | _(updates weights)_ | OPERADOR, ADMIN |
| Registrar Tratamiento | RECIBIDO | EN_TRATAMIENTO | OPERADOR, ADMIN |
| Cerrar Manifiesto | EN_TRATAMIENTO/RECIBIDO | TRATADO | OPERADOR, ADMIN |
| Cancelar Manifiesto | _(any except CANCELADO/TRATADO)_ | CANCELADO | GENERADOR, ADMIN |
| Descargar Certificado | TRATADO | _(PDF download)_ | ALL |

---

## PWA App

### Configuration
- **manifest.json** (main): scope `/`, start_url `/`
- **manifest-app.json** (mobile): scope `/app/`, start_url `/app/`, orientation portrait
- **Service Worker**: `public/sw.js` — network-first strategy, cache `trazabilidad-rrpp-v4`, API excluded from cache
- **Offline**: Custom `/offline.html` fallback page
- **Icons**: `icon-192.png`, `icon-512.png` (maskable)

### PWA Components
| Component | File | Description |
|-----------|------|-------------|
| Install Button | `components/InstallPWAButton.tsx` | Compact PWA install trigger (iOS + Android) |
| Install Modal | `components/InstallPWAModal.tsx` | Auto-appears after 45s, 7-day dismiss grace |
| Connectivity | `components/ConnectivityIndicator.tsx` | Online/offline status bar |
| Onboarding | `components/DemoAppOnboarding.tsx` | Role-based feature tour |

### PWA Hooks
| Hook | File | Description |
|------|------|-------------|
| `usePWAInstall` | `hooks/usePWAInstall.ts` | `canInstall`, `isInstalled`, `isIOS`, `promptInstall()` |
| `useConnectivity` | `hooks/useConnectivity.ts` | Health ping every 30s, sync queue on reconnect |

---

## Catalogs API (Data Shape)

Backend `/api/catalogos/*` endpoints return full actor data via Prisma includes:

```typescript
// GET /api/catalogos/generadores → { id, razonSocial, cuit, telefono, domicilio, numeroInscripcion, categoria, usuario: { email, nombre } }
// GET /api/catalogos/transportistas → { id, razonSocial, cuit, telefono, domicilio, numeroHabilitacion, vehiculos[], choferes[], usuario: { email, nombre } }
// GET /api/catalogos/operadores → { id, razonSocial, cuit, telefono, domicilio, numeroHabilitacion, categoria, tratamientos[], usuario: { email, nombre } }
```

Frontend `CatalogoItem` type (types/api.ts) uses `[key: string]: any` to accommodate all fields.
NuevoManifiestoPage auto-populates actor info cards (CUIT, teléfono, domicilio, habilitación) when selecting from dropdowns.

---

## Testing

### Smoke Test

```bash
# Run full API smoke test against production (44 endpoints)
bash backend/tests/smoke-test.sh

# Run against local
bash backend/tests/smoke-test.sh http://localhost:3002
```

- **Script**: `backend/tests/smoke-test.sh`
- **Coverage**: 44 endpoints across all route groups (Health, Auth, Manifiestos, Catalogos, Actores, Admin, Reportes, PDF, Analytics, Centro de Control, Notificaciones, QR Verification)
- **Auth**: Logs in as admin (`juan.perez@dgfa.gob.ar` / `admin123`), uses JWT token for authenticated endpoints
- **Dynamic IDs**: Fetches real IDs for detail/sub-resource tests (manifiestoId, transportistaId, operadorId)
- **Exit code**: 0 on all pass, 1 on any failure

### Service Worker Versioning

- **Current version**: v10 (`sw.js` cache name: `trazabilidad-rrpp-v10`)
- **Bump on deploy**: After deploying new frontend code, increment cache version in `frontend/public/sw.js` (`CACHE_NAME` and `RUNTIME_CACHE`) and redeploy `sw.js` to force PWA clients to fetch fresh assets

---

## Key Notes

- Backend runs on port **3002** via PM2 cluster mode, 2 instances (process name: `sitrep-backend`)
- PM2 exec cwd: `/var/www/sitrep-backend/`, script: `dist/index.js`, exec_mode: `cluster`
- Express `trust proxy` enabled (required behind Nginx for rate limiting & IP detection)
- Nginx proxies `/api/` to `http://127.0.0.1:3002`
- PostgreSQL runs in Docker container `directus-admin-database-1`
- Frontend uses SPA fallback (`try_files $uri $uri/ /index.html`)
- App uses SPA fallback to `/app/app.html`
- SSL via Let's Encrypt (auto-renewal)
- Admin email: `admin@dgfa.mendoza.gov.ar`
- `/analytics/*` endpoints fully implemented: `manifiestos-por-mes` (raw SQL), `residuos-por-tipo`, `manifiestos-por-estado` (Prisma groupBy), `tiempo-promedio` (calculated from workflow dates). All accessible by any authenticated user. Superadmin-only endpoints (`/summary`) behind `isSuperAdmin` middleware
- Centro de Control usa polling manual (countdown 30s + refetch) en lugar de WebSockets
- Reportes usa Recharts para gráficos interactivos y jsPDF para exportación PDF client-side
- Report endpoints usan paginación (`page`/`limit` params) y `Promise.all` para queries paralelas
- CSV export limitado a 10,000 filas max por seguridad
- Health check (`/api/health`) verifica conectividad a DB y retorna `{ status, db, uptime }`
- `createManifiesto` backend acepta `generadorId` del body para ADMIN (no requiere relación generador en el user)
- `registrarIncidente` acepta tanto `tipo` como `tipoIncidente` del frontend
- Certificado de Disposición (CU-O10): PDF generado por `pdf.controller.ts:generarCertificado` con Ley 24.051, datos completos, firma operador

### Demo Mode — Filtro transportistaId desactivado

En `manifiesto.controller.ts`, el filtro `where.transportistaId = req.user.transportista.id` está **comentado** en dos funciones para modo demo:
- **`getManifiestos`** (~línea 144): cualquier transportista ve todos los manifiestos (no solo los asignados a su empresa)
- **`getDashboardStats`** (~línea 981): estadísticas globales para cualquier transportista

Esto permite que en demo cualquier usuario transportista (Carlos Rodriguez, Elena Vargas, etc.) vea y "tome" cualquier viaje APROBADO, sin importar a qué empresa transportista fue asignado el manifiesto.

**Para restaurar filtro en producción**: descomentar las líneas marcadas con `DEMO MODE` en ambas funciones.

**NOTA**: `getSyncInicial` (sincronización offline) **sigue filtrando** por `transportistaId` — no fue modificado.

---

## Lecciones Aprendidas (CSS/Layout)

### Sticky filter bars en páginas con overflow
- `position: sticky` SOLO funciona si el elemento sticky está dentro de un contenedor con scroll (e.g. `<main>` con `overflow-auto`)
- El root layout DEBE usar `h-screen overflow-hidden` para forzar que `<main>` sea el scroll container (NO `min-h-screen`)
- Los componentes de página deben usar React Fragment (`<>`) para que el sticky bar sea hijo directo de `<main>`
- Usar `-mx-4 lg:-mx-8 px-4 lg:px-8` para sticky bars full-bleed dentro de `<main>` con padding
- Leaflet mapas tienen z-index 400+; usar `isolate` en content wrappers para contener stacking context
- NO poner top padding en `<main>` cuando hay sticky bars — solo `px-4 lg:px-8 pb-4 lg:pb-8`

### CSS Grid y paneles de contenido variable
- En CSS grid, columnas se estiran al alto de la fila (definido por el elemento más alto, e.g. mapa)
- Usar `self-start` en columnas con contenido variable para evitar whitespace innecesario
- `min-h-[X]` fuerza altura mínima incluso sin contenido — evitar para paneles dinámicos

### Modales sobre headers fijos
- Si el header tiene `h-16` (64px) y `z-30`, modales con `z-50` necesitan `pt-20` (80px) para que el contenido no quede detrás

### Datos del backend — formas inconsistentes
- `/api/reportes/manifiestos` → `porTipoResiduo` retorna `{ cantidad: number, unidad: string }` (objetos)
- `/api/reportes/tratados` → `totalPorTipo` retorna `number` (números planos)
- Siempre verificar con `typeof value === 'object'` y extraer `.cantidad` cuando corresponda

---

## CSS & Layout Rules

When fixing CSS/layout issues, ALWAYS test the fix visually in context before declaring it done. Check for: z-index conflicts (especially with Leaflet maps), box-shadow artifacts, gap/overlap issues with sticky positioned elements, and scroll behavior. Never assume a CSS fix is complete without verifying adjacent elements are unaffected.

### Pre-Deploy UI Checklist

Before deploying any UI fix, create a mental checklist of all elements that could be affected by the change. For sticky/fixed positioning changes, explicitly verify:
1. z-index stacking context with all overlapping elements (maps, modals, dropdowns)
2. scroll behavior
3. box-shadow/border rendering at boundaries
4. responsive behavior at different viewport sizes

### Fix UI Procedure

When fixing any CSS/layout bug, follow this procedure in order:
1. Read the affected component's full CSS and its parent/sibling styles
2. Identify all z-index values and stacking contexts in the page
3. List potential side effects BEFORE making changes
4. Make the minimal CSS change needed
5. Grep for any Leaflet/map z-index values that could conflict
6. Verify sticky/fixed elements don't create gaps or overlaps

---

## Hooks (Pre-Commit)

Configuración recomendada para `.claude/settings.json`:

```json
{
  "hooks": {
    "preCommit": ["npx stylelint '**/*.css' --fix", "npx tsc --noEmit"]
  }
}
```

Esto ejecuta stylelint y type-check antes de cada commit para atrapar regresiones CSS y errores TypeScript antes de que lleguen a producción.

---

## Reglas de Ingeniería

### Filosofía operativa
Tú eres las manos; el humano es el arquitecto. Muévete rápido, pero nunca más rápido de lo que el humano pueda verificar. Tu código será vigilado con lupa; escribe en consecuencia.

### Comportamientos obligatorios

1. **Exponer suposiciones** (prioridad: crítica)
   - Antes de implementar algo no trivial, declarar suposiciones explícitamente.
   - Nunca rellenar silenciosamente requisitos ambiguos.
   - Formato: `SUPOSICIONES QUE ESTOY HACIENDO: 1. [...] → Corrígeme ahora o procederé con esto.`

2. **Gestión de confusión** (prioridad: crítica)
   - Ante inconsistencias o requisitos contradictorios: DETENTE. Nombra la confusión. Presenta la disyuntiva. Espera resolución.
   - Mal: elegir silenciosamente una interpretación. Bien: "Veo X en archivo A pero Y en archivo B. ¿Cuál tiene precedencia?"

3. **Push back cuando corresponda** (prioridad: alta)
   - No ser servil. Señalar problemas directamente, explicar desventaja concreta, proponer alternativa, aceptar si te anulan.

4. **Simplicidad** (prioridad: alta)
   - Resistir activamente la tendencia a sobrecomplicar. Preferir la solución aburrida y obvia.
   - Si 100 líneas bastan, 1000 es un fallo. La astucia es costosa.

5. **Disciplina de alcance** (prioridad: alta)
   - Tocar SOLO lo que se pida. No eliminar comentarios, no "limpiar" código ortogonal, no refactorizar sistemas adyacentes, no borrar código aparentemente no utilizado sin aprobación.

6. **Higiene de código muerto** (prioridad: media)
   - Después de refactorizar: identificar código inalcanzable, enumerarlo, preguntar antes de eliminar.

### Patrones de trabajo

- **Declarativo sobre imperativo**: re-enmarcar instrucciones como criterios de éxito.
- **Test primero**: escribir la prueba que define éxito, implementar hasta que pase, mostrar ambos.
- **Naive primero, optimizar después**: corrección primero, rendimiento después.
- **Plan inline**: para tareas de múltiples pasos, emitir plan ligero antes de ejecutar.

### Estándares de output

- Sin abstracciones infladas ni generalización prematura.
- Sin trucos astutos sin comentarios que expliquen el porqué.
- Estilo consistente con la base de código existente.
- Nombres de variables significativos.

### Comunicación

- Ser directo sobre los problemas.
- Cuantificar cuando sea posible ("esto añade ~200ms de latencia", no "esto podría ser más lento").
- Cuando te atasques, decirlo y describir lo que has intentado.
- No ocultar incertidumbre detrás de lenguaje confiado.

### Resumen post-cambio obligatorio

```
CAMBIOS REALIZADOS:
- [archivo]: [qué cambió y por qué]

COSAS QUE NO TOQUÉ:
- [archivo]: [dejado solo intencionalmente porque...]

POSIBLES PREOCUPACIONES:
- [cualquier riesgo o cosa a verificar]
```

### Modos de fallo a evitar

1. Hacer suposiciones incorrectas sin verificar
2. No gestionar tu propia confusión
3. No buscar aclaraciones cuando se necesitan
4. No exponer inconsistencias que notas
5. No presentar tradeoffs en decisiones no obvias
6. No cuestionar cuando deberías
7. Ser servil ("¡Por supuesto!" a malas ideas)
8. Sobrecomplicar el código y las APIs
9. Inflar abstracciones innecesariamente
10. No limpiar código muerto tras refactorizaciones
11. Modificar comentarios/código ortogonal a la tarea
12. Eliminar cosas que no entiendes completamente

---

## CI/CD Status (Updated 2026-02-15)

### ✅ Active Workflows

| Workflow | Status | Last Successful | Deploy Time |
|----------|--------|----------------|-------------|
| **Deploy SITREP Backend** | ✅ Active | 2026-02-14 23:33 | ~2-3 min |

### Backend CI/CD Implementation

**Atomic Deployment Pattern**:
```bash
1. GitHub Actions builds in cloud (FREE)
2. Build: npm ci && npm run build
3. Package: dist/ + package.json + prisma/ + ecosystem.config.js
4. SCP to VPS /tmp/
5. Deploy script:
   - Extract to /var/www/sitrep-backend-releases/YYYYMMDD-HHMMSS/
   - Copy .env from current release
   - npx prisma generate (RHEL binaries) ← FIX 2026-02-15
   - Symlink /var/www/sitrep-backend → new release
   - pm2 restart sitrep-backend (cluster mode, 2 instances)
   - Health check https://sitrep.ultimamilla.com.ar/api/health
   - ROLLBACK if health fails (automatic, 2 seconds)
   - Cleanup (keep last 5 releases)
```

**Data Protection**:
- ✅ Shared PostgreSQL with Directus: `directus-admin-database-1`
- ✅ Database: `trazabilidad_rrpp`
- ✅ Schema created via `prisma db push`
- ⚠️ Backups: Manual only (NEEDS automation)

**Prisma Binary Fix (2026-02-15)**:
```bash
Problem: GitHub Actions (Ubuntu) generates debian binaries
         Production server (RHEL) needs rhel binaries
         Error: PrismaClientInitializationError

Solution: Added to deploy_sitrep_backend.sh:
  echo "🔧 Generating Prisma Client for RHEL..."
  cd $RELEASE_DIR
  npx prisma generate  # Regenerates with rhel-openssl-3.0.x

Result: ✅ Deployment successful
        ✅ Health: {"status":"ok","db":"connected"}
        ✅ 2 PM2 instances online, 0 Prisma errors
```

**Files**:
- Workflow: `.github/workflows/deploy-production.yml`
- Deploy script: `/opt/scripts-cicd/deploy_sitrep_backend.sh`
- Config: `/var/www/sitrep-backend/.env` (symlink to /home/demoambiente/.env)
- PM2: `/var/www/sitrep-backend/ecosystem.config.js`

### Shared Infrastructure with ultimamilla.com.ar

**PostgreSQL Container (Shared)**:
```yaml
Container: directus-admin-database-1
Image: postgres:15-alpine
Port: 5432 (localhost)
Managed by: Directus docker-compose (/opt/directus-admin/)

Databases:
  - directus (Directus CMS: 518 Antecedentes + 8 Servicios)
  - trazabilidad_rrpp (SITREP: Manifiestos, Usuarios, etc.)

Connection from SITREP:
  DATABASE_URL=postgresql://directus:password@localhost:5432/trazabilidad_rrpp?schema=public
```

**IMPORTANT**: SITREP backend runs outside Docker (PM2), connects to PostgreSQL container via localhost:5432. Container must be running for SITREP to work.

### Test SITREP Deployment

```bash
# Smoke test (44 endpoints)
cd backend
bash tests/smoke-test.sh

# Comprehensive test (includes SITREP health)
cd /Volumes/SDTERA/ultima\ milla/LICITACIONES/PRESENTADAS2025/AMBIENTE
bash test-all-simple.sh

# Expected: 18/18 tests passed
```

Last comprehensive test: **18/18 passed** ✅ (2026-02-15 11:30)

---

## Backup Strategy (CRITICAL - Updated 2026-02-15)

### Current Backups

| Data | Location | Frequency | Last Backup | Status |
|------|----------|-----------|-------------|--------|
| **SITREP Database** | `/root/backups/sitrep_pre_scale_20260114_203611.sql` | ⚠️ Manual | 2026-01-14 | 🔴 OUTDATED |
| **Directus Database** | `/opt/directus-backups/directus-db-*.sql.gz` | Daily 2 AM | 2026-02-15 11:19 | ✅ CURRENT |

### ⚠️ URGENT: SITREP Automated Backup Needed

**Recommendation**:
```bash
# Create backup script
cat > /opt/scripts-cicd/backup_sitrep.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/opt/sitrep-backups
mkdir -p $BACKUP_DIR

# Backup SITREP database
docker exec directus-admin-database-1 pg_dump -U directus trazabilidad_rrpp | gzip > $BACKUP_DIR/sitrep-db-$DATE.sql.gz

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "sitrep-db-*.sql.gz" -mtime +30 -delete
EOF

# Add to cron (daily 3 AM)
echo "0 3 * * * /opt/scripts-cicd/backup_sitrep.sh" | crontab -
```

**Cross-Server Backup** (recommended):
```bash
# Rsync to Hostinger preview server (76.13.234.213)
0 4 * * * rsync -avz /opt/sitrep-backups/ root@76.13.234.213:/backups/sitrep-prod/
```

---

## Related Documentation

- [`../INFRAESTRUCTURA.md`](../INFRAESTRUCTURA.md) - Complete infrastructure overview
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Detailed deployment procedures (to be created)
- [`backend/tests/smoke-test.sh`](./backend/tests/smoke-test.sh) - API smoke test script
