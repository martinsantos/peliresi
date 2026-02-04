# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

Sistema de gestión y trazabilidad de residuos peligrosos para la Provincia de Mendoza.
Permite el seguimiento completo del ciclo de vida de manifiestos: desde la generación hasta el tratamiento final.

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
| Backend dist deploy target | `/home/demoambiente/` |
| Nginx config | `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar` |
| PM2 logs | `/root/.pm2/logs/sitrep-backend-*.log` |

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20 + Express.js + TypeScript
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (bcrypt passwords, role-based: ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR)
- **Database**: PostgreSQL en Docker (`directus-admin-database-1`)
- **Process Manager**: PM2 (process name: `sitrep-backend`, port 3002)

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
ssh root@23.105.176.45 "cd /home/demoambiente && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"
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
ssh root@23.105.176.45 "cd /home/demoambiente && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"
```

---

## Vite Build Configs

| Config | Base Path | Output Dir | Entry Point |
|--------|-----------|------------|-------------|
| `vite.config.ts` | `/` | `dist/` | `index.html` |
| `vite.config.v6.ts` | `/v6/` | `dist-v6/` | `src-v6/main.tsx` (dev only) |
| `vite.config.app.ts` | `/app/` | `dist-app/` | `app.html` |

## PM2 Management

```bash
ssh root@23.105.176.45 "pm2 list"
ssh root@23.105.176.45 "pm2 restart sitrep-backend"
ssh root@23.105.176.45 "pm2 logs sitrep-backend --lines 50"
ssh root@23.105.176.45 "pm2 show sitrep-backend"
```

## Database

```bash
# Acceso directo a PostgreSQL
ssh root@23.105.176.45 "docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_demo"
```

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

### Key API Endpoints

```
GET  /api/manifiestos/dashboard      → estadísticas (borradores, aprobados, enTransito, entregados, recibidos, tratados, total) + recientes + enTransitoList
GET  /api/reportes/manifiestos       → porEstado, porTipoResiduo, manifiestos[] (params: fechaInicio, fechaFin)
GET  /api/reportes/tratados          → porGenerador, totalPorTipo, detalle[] (params: fechaInicio, fechaFin)
GET  /api/reportes/transporte        → transportistas[] con tasaCompletitud (params: fechaInicio, fechaFin)
GET  /api/reportes/exportar/:tipo    → CSV blob (tipos: manifiestos, generadores, transportistas, operadores)
POST /api/manifiestos/:id/aprobar    → Cambiar estado BORRADOR → APROBADO
POST /api/manifiestos/:id/confirmar-retiro → APROBADO → EN_TRANSITO
POST /api/manifiestos/:id/entregar   → EN_TRANSITO → ENTREGADO
POST /api/manifiestos/:id/recibir    → ENTREGADO → RECIBIDO
POST /api/manifiestos/:id/tratamiento → RECIBIDO → EN_TRATAMIENTO
POST /api/manifiestos/:id/cerrar      → EN_TRATAMIENTO/RECIBIDO → TRATADO
POST /api/manifiestos/:id/rechazar    → ENTREGADO → RECHAZADO
POST /api/manifiestos/:id/incidente   → Registra incidente en transito (acepta campo `tipo` o `tipoIncidente`)
POST /api/manifiestos/:id/cancelar    → Cancela manifiesto (si no es CANCELADO ni TRATADO)
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

## Frontend Pages (src-v6)

### Dashboard & Control
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Dashboard | `pages/dashboard/DashboardPage.tsx` | KPIs, resumen general |
| Centro de Control | `pages/centro-control/CentroControlPage.tsx` | Sala de operaciones: LIVE badge, 5 KPIs, pipeline funnel, mapa h-96, donut chart, bar chart, auto-refresh 30s, 6 acciones rápidas |
| Mobile Dashboard | `pages/mobile/MobileDashboardPage.tsx` | Versión mobile optimizada |

### Reportes
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Centro de Reportes | `pages/reportes/ReportesPage.tsx` | 3 tabs (Manifiestos/Tratados/Transporte), Recharts (BarChart, PieChart, Donut, Gauge SVG), exportación PDF con jsPDF, exportación CSV, filtros de fecha inline |

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

- Backend runs on port **3002** via PM2 (process name: `sitrep-backend`, id: 2)
- PM2 exec cwd: `/var/www/sitrep-backend/`, script: `dist/index.js`
- Nginx proxies `/api/` to `http://127.0.0.1:3002`
- PostgreSQL runs in Docker container `directus-admin-database-1`
- Frontend uses SPA fallback (`try_files $uri $uri/ /index.html`)
- App uses SPA fallback to `/app/app.html`
- SSL via Let's Encrypt (auto-renewal)
- Admin email: `admin@dgfa.mendoza.gov.ar`
- `/analytics/*` endpoints are partially implemented - `getDashboardStats` works but `getManifiestosPorMes`, `getResiduosPorTipo`, etc. return empty via try/catch fallback
- Centro de Control usa polling manual (countdown 30s + refetch) en lugar de WebSockets
- Reportes usa Recharts para gráficos interactivos y jsPDF para exportación PDF client-side
- `createManifiesto` backend acepta `generadorId` del body para ADMIN (no requiere relación generador en el user)
- `registrarIncidente` acepta tanto `tipo` como `tipoIncidente` del frontend
- Certificado de Disposición (CU-O10): PDF generado por `pdf.controller.ts:generarCertificado` con Ley 24.051, datos completos, firma operador
