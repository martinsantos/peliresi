# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

Sistema de gestión y trazabilidad de residuos peligrosos para la Provincia de Mendoza.
Permite el seguimiento completo del ciclo de vida de manifiestos: desde la generación hasta el tratamiento final.

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
- **Connection Pool**: Prisma `connection_limit=20` per instance (40 total across cluster)
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

14 custom indexes on key tables for query performance:
- **manifiestos**: generadorId, transportistaId, operadorId, estado, createdAt, [estado+createdAt]
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
| `/api/auth/*` | auth.controller | Login, registro, refresh token, perfil |
| `/api/manifiestos/*` | manifiesto.controller | CRUD manifiestos, workflow de estados, dashboard |
| `/api/actores/*` | actor.controller | Generadores, transportistas, operadores |
| `/api/reportes/*` | reporte.controller | Reportes por período, tratados, transporte, CSV export |
| `/api/catalogos/*` | catalogo.controller | Residuos, categorías, establecimientos, vehículos |
| `/api/notificaciones/*` | notification.controller | Notificaciones push y alertas |
| `/api/analytics/*` | analytics.controller | Dashboard stats (parcialmente implementado) |
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
```

### Frontend Filter Mapping

El frontend usa `fechaDesde/fechaHasta` pero el backend espera `fechaInicio/fechaFin`.
La función `mapFilters()` en `reporte.service.ts` traduce entre ambos.

### Roles y Permisos

| Rol | Acceso |
|-----|--------|
| `ADMIN` | Todo: dashboard, manifiestos, actores, reportes, auditoría, configuración, usuarios |
| `GENERADOR` | Sus manifiestos, crear borradores, perfil |
| `TRANSPORTISTA` | Manifiestos asignados, tracking GPS, viaje en curso |
| `OPERADOR` | Manifiestos para tratamiento, recibir, tratar |

---

## GPS Tracking System

### Architecture

The GPS tracking system enables real-time position monitoring for up to **30 simultaneous trips**.

**Flow**: Phone (watchPosition) → every 30s → `POST /api/manifiestos/:id/ubicacion` → `tracking_gps` table → Centro de Control polls every 30s

### Frontend (ViajeEnCursoTransportista.tsx)

- **GPS collection**: `navigator.geolocation.watchPosition()` runs continuously
- **Transmission interval**: 30 seconds (sends latest position only)
- **GPS Status State Machine**: `checking` → `acquiring` → `active` | `denied` | `unavailable` | `error`
- **Data sent**: `{ latitud, longitud, velocidad?, direccion? }`
- **Offline resilience**: Failed updates queued in `pendingUpdatesRef` (max 5), also backed by IndexedDB `sync_queue`
- **Pause/Resume**: Records `PAUSA`/`REANUDACION` incidents via backend + localStorage backup
- **Timer persistence**: Uses server `fechaRetiro` timestamp (not local counter)

### Backend (manifiesto.controller.ts)

- **Endpoint**: `POST /api/manifiestos/:id/ubicacion`
- **Auth**: TRANSPORTISTA or ADMIN
- **Validation**: Checks manifiesto exists and is EN_TRANSITO
- **In-memory cache**: 60s TTL per manifiestoId to skip repeated `findUnique` SELECT (~10x faster for frequent GPS updates)
- **Cache invalidation**: On `confirmarEntrega` (trip state change)
- **Data stored**: `tracking_gps` table with `latitud`, `longitud`, `velocidad`, `direccion`, `timestamp`

### Centro de Control (tracking.controller.ts)

- **Endpoint**: `GET /api/centro-control/actividad`
- **Params**: `fechaDesde`, `fechaHasta`, `capas` (csv: generadores, transportistas, operadores, transito)
- **EN_TRANSITO filter**: Shows trips created in date range OR with GPS tracking in date range (OR condition)
- **Date parsing**: `fechaHasta` auto-bumped to 23:59:59.999 to include full day (avoids midnight truncation bug)
- **Layers**: Generadores, Transportistas, Operadores (filtered by activity in period), En Tránsito (up to 50 GPS points per trip)
- **Statistics**: Pipeline counts per estado, KPIs, manifiestosPorDia via raw SQL

### Capacity (tested and verified)

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Max concurrent trips** | 30+ | Tested with 30 simultaneous GPS POSTs |
| **GPS update interval** | 30s per client | 1 req/30s per phone |
| **Rate limit** | 300 req/min/IP | Supports 30 phones behind shared NAT/CGNAT |
| **DB connection pool** | 20 per PM2 instance (40 total) | `connection_limit=20` in DATABASE_URL |
| **PostgreSQL max_connections** | 100 | ~25 active in normal use |
| **Load test result** | 30 concurrent: 399ms cold / 179ms cached | All 200 OK, zero errors |
| **Per-request latency** | ~24ms (cached) / ~250ms (cold) | Cache TTL: 60s |
| **Data growth** | ~3,600 rows/hour at 30 trips | With indexes, query perf stays constant |

### Mobile Dashboard (MobileDashboardPage.tsx)

- **TRANSPORTISTA-specific**: Shows trip assignment banner between welcome and stats grid
- **Active trips (EN_TRANSITO)**: Pulsing green card with "Ir al viaje" button
- **Pending trips (APROBADO)**: Warning-colored card with clickable list
- **Data source**: `useManifiestos({ estado: EN_TRANSITO/APROBADO, limit: 5 })`

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
| Establecimientos | `pages/admin/AdminEstablecimientosPage.tsx` | CRUD establecimientos |
| Vehículos | `pages/admin/AdminVehiculosPage.tsx` | CRUD vehículos |
| Usuarios | `pages/usuarios/UsuariosPage.tsx` | Gestión de usuarios y roles |

### Transporte & Tracking
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Tracking | `pages/tracking/TrackingPage.tsx` | Seguimiento GPS en mapa |
| Viaje en Curso | `pages/tracking/ViajeEnCursoPage.tsx` | Vista de viaje activo |
| Perfil Transporte | `pages/transporte/TransportePerfilPage.tsx` | Dashboard transportista |
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

### Services
| Service | Archivo | API Base |
|---------|---------|----------|
| `reporteService` | `services/reporte.service.ts` | `/reportes/*` (con mapFilters fechaDesde→fechaInicio) |
| `analyticsService` | `services/analytics.service.ts` | `/analytics/*` (parcial - algunas rutas no existen en backend) |
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
- `/analytics/*` endpoints are partially implemented - `getDashboardStats` works but `getManifiestosPorMes`, `getResiduosPorTipo`, etc. return empty via try/catch fallback
- Centro de Control usa polling manual (countdown 30s + refetch) en lugar de WebSockets
- Reportes usa Recharts para gráficos interactivos y jsPDF para exportación PDF client-side
- Report endpoints usan paginación (`page`/`limit` params) y `Promise.all` para queries paralelas
- CSV export limitado a 10,000 filas max por seguridad
- Health check (`/api/health`) verifica conectividad a DB y retorna `{ status, db, uptime }`
- `createManifiesto` backend acepta `generadorId` del body para ADMIN (no requiere relación generador en el user)
- `registrarIncidente` acepta tanto `tipo` como `tipoIncidente` del frontend
- Certificado de Disposición (CU-O10): PDF generado por `pdf.controller.ts:generarCertificado` con Ley 24.051, datos completos, firma operador

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
