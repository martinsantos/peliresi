# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

Sistema de gestión y trazabilidad de residuos peligrosos para la Provincia de Mendoza.
Permite el seguimiento completo del ciclo de vida de manifiestos: desde la generación hasta el tratamiento final.

**📚 Documentación Unificada**: Ver [`../INFRAESTRUCTURA.md`](../INFRAESTRUCTURA.md) para arquitectura completa de ambos servidores (Producción + Preview), stack tecnológico compartido, y CI/CD workflows.

**Última actualización**: 2026-03-25 - Email queue/digest, inscripcion publica, CalculadoraTEF fix, auditoria fase 2, structured logging. Database compartida con Directus en PostgreSQL container.

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
| **Liveness Probe** | https://sitrep.ultimamilla.com.ar/api/health/live |
| **Readiness Probe** | https://sitrep.ultimamilla.com.ar/api/health/ready |

## Latest Build & Test Status

**Last Successful Build**: 2026-02-15 (Cross-Platform Test + Data Consistency)
- ✅ Main Frontend: Built in 17.95s → `dist/`
- ✅ PWA App: Built in 16.82s → `dist-app/`
- ✅ Smoke Test: **46/46 endpoints PASS** (100% coverage)
  - Health (3), Auth (6), Manifiestos (7), Catalogos (9), Actores (6)
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
- ✅ **Notificaciones Multi-Canal (2026-03-25):** `crearNotificacion()` envia email automaticamente a TODOS los roles (no solo ADMIN) si `notifEmail=true`. Campos WhatsApp/Telegram en schema Usuario (`notifWhatsapp`, `notifTelegram`, `whatsappPhone`, `telegramChatId`). UI de preferencias en ConfiguracionPage. Placeholders para WhatsApp Business API y Telegram Bot.
- ✅ **Notificaciones con Ubicacion + Recordatorios (2026-03-25):** Al firmar manifiesto (APROBADO), transportista recibe notificacion con fecha retiro + link Google Maps (abre app nativa mobile). Operador recibe aviso de recepcion programada. Job `recordatorio.job.ts` cron cada 6h notifica 24h antes del retiro con mapsUrl. `fechaEstimadaRetiro` campo nuevo en Manifiesto.
- ✅ **Setup Wizard + Manual Instalacion (2026-03-25):** `SETUP.html` y `MANUAL.html` en raiz del repo para instaladores offline. Setup wizard interactivo 8 pasos (funciona sin backend). Manual seccion 0 con mockups del wizard. Seccion 15.12 con 15 subsecciones paso-a-paso. `DEPLOY-NUEVO-SERVIDOR.md` guia tecnica completa (1564 lineas).
- ✅ **Consistencia Alertas/Notificaciones (2026-03-25):** AlertasPage usa notificaciones para no-admin. Fix anomalias endpoint path. PM2 instance detection via NODE_APP_INSTANCE. Codigo muerto eliminado (dispararAlertaEvento).
- ✅ **Email Queue + Digest System (2026-03-24):** DB-backed email queue (`email_queue` table) con 3 enums. Transaccional = envio inmediato + retry. Alertas = digest horario por destinatario. Rate limits: 10 transaccional/dia, 6 digest/dia. `DISABLE_EMAILS` kill switch. `FOR UPDATE SKIP LOCKED` cluster-safe. `GET /api/admin/email-queue` endpoint. Timer flush cada 5 min. Migracion a Brevo documentada.
- ✅ **CalculadoraTEF Fix (2026-03-24):** Eliminado loop infinito de re-renders (React error #185) en wizard de inscripcion. Causa: flujo bidireccional reactivo entre wizard y calculadora. Solucion: `forwardRef` + `useImperativeHandle`, padre lee valores on-demand via ref.
- ✅ **Inscripcion Publica de Actores (2026-03-23):** Wizards de auto-registro en `/inscripcion/generador`, `/inscripcion/operador`, `/inscripcion/transportista`. Phase 1: cuenta (POST /api/solicitudes/iniciar). Phase 2: wizard multi-paso con TEF. Arbitracion admin con mensajeria bidireccional. Modelos: SolicitudInscripcion, DocumentoSolicitud, MensajeSolicitud.
- ✅ **Auditoria Fase 2 (2026-03-24):** Reducido `as any` 138→62, ARIA labels, structured logging (pino), Service Worker cleanup (v22), session timeout improvements.
- ✅ **Blockchain Integridad Completa (2026-03-20):** 2 sellos blockchain (Genesis + Cierre) + rolling hash chain en cada cambio de estado. Tabla `blockchain_sellos`, endpoints verificar-integridad/verificar-lote, BlockchainPanel rediseñado con 2 sellos, badge ShieldCheck en lista manifiestos, panel verificación masiva en AdminBlockchainPage. 7 manifiestos migrados.
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
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
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
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name manual ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
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
- **blockchain_sellos**: manifiestoId, status, hash, [manifiestoId+tipo] (unique)
- **email_queue**: [estado+nextRetryAt], [to+createdAt], digestKey
- **solicitudes_inscripcion**: usuarioId, estado, [tipoActor+estado]

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
| `/api/blockchain/*` | blockchain.controller | Certificación blockchain: status, registrar, verificar hash, registro, verificar-integridad, verificar-lote |
| `/api/solicitudes/*` | solicitud.controller | Inscripcion publica, wizard CRUD, arbitracion admin, documentos, mensajeria |
| `/api/renovaciones/*` | renovacion.controller | Renovaciones anuales: listar, crear, aprobar, rechazar |
| `/api/search/*` | search.controller | Busqueda global (Cmd+K) en manifiestos, actores, usuarios |

### Key API Endpoints

```
GET  /api/manifiestos/dashboard      → estadísticas (borradores, aprobados, enTransito, entregados, recibidos, tratados, total) + recientes + enTransitoList
GET  /api/reportes/manifiestos       → porEstado, porTipoResiduo, manifiestos[], pagination (params: fechaInicio, fechaFin, page, limit). NOTA: porTipoResiduo retorna objetos { cantidad, unidad }, NO números planos. Agregación via Prisma groupBy.
GET  /api/reportes/tratados          → porGenerador, totalPorTipo, detalle[], pagination (params: fechaInicio, fechaFin, page, limit)
GET  /api/reportes/transporte        → transportistas[] con tasaCompletitud, pagination (params: fechaInicio, fechaFin, page, limit). Usa _count en vez de cargar manifiestos completos.
GET  /api/reportes/exportar/:tipo    → CSV blob (tipos: manifiestos, generadores, transportistas, operadores). Límite: 10,000 filas max.
POST /api/manifiestos/:id/firmar     → Cambiar estado BORRADOR → APROBADO
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
GET  /api/manifiestos/verificar/:numero → Verificación pública de manifiesto por número (sin auth, incluye sellosBlockchain)
GET  /api/blockchain/manifiesto/:id    → Estado blockchain + sellos GENESIS/CIERRE (auth)
POST /api/blockchain/registrar/:id     → Registrar manifiesto en blockchain on-demand (auth)
GET  /api/blockchain/verificar/:hash   → Verificar hash en smart contract (público, sin auth)
GET  /api/blockchain/registro          → Lista manifiestos con blockchain (ADMIN, paginado, incluye sellos)
GET  /api/blockchain/verificar-integridad/:id → Verificación completa: genesis + rolling chain + cierre (ADMIN)
GET  /api/blockchain/verificar-lote    → Verificación masiva de integridad (ADMIN, params: fechaDesde, fechaHasta, estado)
POST /api/solicitudes/iniciar        → Crear cuenta (activo:false) + SolicitudInscripcion (publico, sin auth)
GET  /api/solicitudes/               → Listar solicitudes (ADMIN + sub-admins)
GET  /api/solicitudes/mis-solicitudes → Solicitudes propias del candidato (auth)
GET  /api/solicitudes/:id            → Detalle solicitud (auth)
PUT  /api/solicitudes/:id            → Actualizar datos wizard (auth)
POST /api/solicitudes/:id/enviar     → Enviar para revision (auth)
POST /api/solicitudes/:id/documentos → Upload documento (multipart, 10MB max)
POST /api/solicitudes/:id/revisar    → Marcar EN_REVISION (ADMIN)
POST /api/solicitudes/:id/observar   → Pedir correcciones (ADMIN)
POST /api/solicitudes/:id/aprobar    → Aprobar + crear actor (ADMIN)
POST /api/solicitudes/:id/rechazar   → Rechazar solicitud (ADMIN)
GET  /api/solicitudes/:id/mensajes   → Mensajes bidireccionales (auth)
POST /api/solicitudes/:id/mensajes   → Enviar mensaje (auth)
GET  /api/admin/email-queue          → Cola de emails con filtros (ADMIN, paginado)
POST /api/admin/impersonate/:userId  → Generar JWT de impersonacion (ADMIN)
PUT  /api/admin/preferencias-notificacion → Actualizar preferencias email (auth)
```

### Frontend Filter Mapping

El frontend usa `fechaDesde/fechaHasta` pero el backend espera `fechaInicio/fechaFin`.
La función `mapFilters()` en `reporte.service.ts` traduce entre ambos.

### Roles y Permisos

| Rol | Acceso |
|-----|--------|
| `ADMIN` | Todo: dashboard, manifiestos, actores, reportes, auditoría, configuración, usuarios |
| `GENERADOR` | Sus manifiestos (filtrado por generadorId), crear borradores, perfil |
| `TRANSPORTISTA` | Sus manifiestos (filtrado por transportistaId), tracking GPS, viaje en curso, "Tomar Viaje" desde perfil |
| `OPERADOR` | Sus manifiestos (filtrado por operadorId), recibir, tratar |
| `ADMIN_TRANSPORTISTA` | Solicitudes de transportistas, CRUD transportistas del sector |
| `ADMIN_GENERADOR` | Solicitudes de generadores, CRUD generadores del sector |
| `ADMIN_OPERADOR` | Solicitudes de operadores, CRUD operadores del sector |

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

## Blockchain Integrity System (Updated 2026-03-20)

### Architecture: 2 Sellos + Rolling Hash Chain

**Modelo:** En vez de 7 transacciones blockchain (una por estado), el sistema usa un enfoque híbrido:
- **Rolling hash en DB** en cada cambio de estado (costo: $0, solo UPDATE en Postgres)
- **2 sellos blockchain** en los momentos legalmente significativos:
  1. **Genesis (APROBADO):** Sella identidad del manifiesto al momento de la firma legal
  2. **Cierre (TRATADO):** Sella el rolling hash final que encapsula TODO el ciclo de vida

**Por que funciona:** Cada hash intermedio depende del anterior. Un atacante que modifique CUALQUIER dato intermedio rompe la cadena → el hash de cierre no coincide con blockchain.

### Database: BlockchainSello table

```
blockchain_sellos (max 2 filas por manifiesto):
  id, manifiestoId, tipo (GENESIS|CIERRE), hash (SHA-256),
  txHash, blockNumber, blockTimestamp, status (PENDIENTE|CONFIRMADO|ERROR),
  retries, createdAt
  @@unique([manifiestoId, tipo])
```

Campos adicionales en Manifiesto: `rollingHash` (hash acumulativo actual)
Campos adicionales en EventoManifiesto: `integrityHash` (snapshot del rollingHash al momento del evento)

### Rolling Hash en workflow (manifiesto.controller.ts)

Cada cambio de estado (7 funciones) computa `computeRollingHash()` dentro del `$transaction` y guarda:
- `rollingHash` en el manifiesto
- `integrityHash` en el EventoManifiesto

Sellos blockchain (fire-and-forget via `setImmediate`):
- `firmarManifiesto`: → `registrarSello(id, 'GENESIS', hashManifiesto(...))`
- `cerrarManifiesto`: → `registrarSello(id, 'CIERRE', computeClosureHash(...))`

### Hash Functions (blockchain.service.ts)

| Función | Input | Uso |
|---------|-------|-----|
| `hashManifiesto()` | numero, CUITs, residuos, fechaFirma | Sello GENESIS |
| `computeRollingHash()` | previousHash, genesisTs, estado, fecha, eventCount, observaciones | Cada cambio de estado |
| `computeClosureHash()` | genesisHash, rollingHash, todas las fechas, CUITs, residuos, eventCount | Sello CIERRE |

### Hardening

1. **Binding genesis timestamp:** Rolling hash incluye `blockchainTimestamp` del sello genesis (asignado por miners)
2. **Event count:** Rolling hash incluye conteo de eventos — borrar un evento rompe la cadena
3. **Testigos via API:** Cada EventoManifiesto almacena `integrityHash` vigente

### Verificación de Integridad

- `verificarIntegridad(id)`: Recalcula genesis hash + replays rolling chain + verifica cierre → retorna integridad: COMPLETA|PARCIAL|FALLIDA
- `verificarLote(filtros)`: Verificación masiva, hasta 200 manifiestos, recalcula hashes localmente (rápido)

### Legacy Compatibility

Los campos `blockchainHash`, `blockchainTxHash`, `blockchainBlockNumber`, `blockchainTimestamp`, `blockchainStatus` en Manifiesto se mantienen como cache para el sello GENESIS (backwards compatibility). `procesarPendientes()` maneja tanto legacy como nuevos sellos.

---

## Email Queue + Digest System (2026-03-24)

### Arquitectura

Todos los emails pasan por una cola en DB (`email_queue`). Transaccionales se envian inmediato con retry; alertas se agrupan en digests horarios por destinatario.

**Flujo**: `emailService.send*()` → INSERT email_queue → flush timer (5min) → SMTP send

### Tabla EmailQueue

```
email_queue:
  id, to, subject, html (Text), tipo (TRANSACCIONAL|ALERTA),
  prioridad (CRITICA|NORMAL|BAJA), estado (PENDIENTE|ENVIADO|FALLIDO|DIGEST_PENDIENTE|SUPRIMIDO),
  intentos, maxIntentos (default 3), error, digestKey,
  createdAt, sentAt, nextRetryAt
  @@index([estado, nextRetryAt])
  @@index([to, createdAt])
  @@index([digestKey])
```

### Clasificacion de Emails

| Metodo | Tipo | Prioridad | Comportamiento |
|--------|------|-----------|---------------|
| sendEmailVerification | TRANSACCIONAL | CRITICA | Inmediato |
| sendPasswordResetEmail | TRANSACCIONAL | CRITICA | Inmediato |
| sendRegistroPendienteEmail | TRANSACCIONAL | NORMAL | Inmediato |
| sendCuentaAprobadaEmail | TRANSACCIONAL | NORMAL | Inmediato |
| sendNuevoRegistroAdminEmail | TRANSACCIONAL | NORMAL | Inmediato |
| sendAlertEmail | ALERTA | BAJA | Digest horario |

### Rate Limits (por destinatario por dia)

- TRANSACCIONAL: max 10/dia (env: `EMAIL_DAILY_LIMIT_TRANSACCIONAL`)
- ALERTA digest: max 6/dia (env: `EMAIL_DAILY_LIMIT_ALERTA`)
- Excedido → estado = SUPRIMIDO (queda en DB para auditoria)

### Flush Timer

- Intervalo: 5 min (env: `EMAIL_FLUSH_INTERVAL_MS`)
- Cluster-safe: `FOR UPDATE SKIP LOCKED` en PostgreSQL
- Paso 1: Retry FALLIDO (intentos < max)
- Paso 2: Agrupar DIGEST_PENDIENTE por digestKey → 1 email digest por grupo
- Paso 3: Expirar FALLIDO con intentos >= max → SUPRIMIDO

### Environment Variables

| Variable | Default | Descripcion |
|----------|---------|-------------|
| DISABLE_EMAILS | false | Kill switch — suprime envios, sigue encolando |
| EMAIL_DAILY_LIMIT_TRANSACCIONAL | 10 | Max transaccionales/dia/destinatario |
| EMAIL_DAILY_LIMIT_ALERTA | 6 | Max digests/dia/destinatario |
| EMAIL_FLUSH_INTERVAL_MS | 300000 | Intervalo flush (5 min) |
| EMAIL_MAX_RETRIES | 3 | Max intentos antes de SUPRIMIDO |
| SMTP_HOST | localhost | Servidor SMTP |
| SMTP_PORT | 25 | Puerto SMTP |
| SMTP_USER | (opcional) | Auth SMTP |
| SMTP_PASS | (opcional) | Password SMTP |
| SMTP_FROM | SITREP <no-reply@...> | Remitente |

### Migracion a Brevo (futuro)

Solo cambiar SMTP_HOST/USER/PASS en .env. Sin cambios de codigo. Ver spec completo: `docs/superpowers/specs/2026-03-24-email-queue-digest-design.md`

---

## Sistema de Inscripcion Publica

### Flujo

**Phase 1 — Registro** (publico, sin auth):
`POST /api/solicitudes/iniciar` → crea Usuario (activo:false) + SolicitudInscripcion (BORRADOR)

**Phase 2 — Wizard** (auth con token de Phase 1):
Multi-paso segun tipo de actor:
- Generador: 7 pasos (Establecimiento, Regulatorio, Domicilios, Adicional, Calculo TEF, Documentos, Resumen)
- Operador: 8 pasos (Establecimiento, Regulatorio, Domicilios, Representantes, Corrientes, Calculo TEF, Documentos, Resumen)
- Transportista: 5 pasos (Datos Basicos, Habilitacion, Vehiculos, Documentos, Resumen)

**Arbitracion Admin**:
ENVIADA → EN_REVISION → APROBADA (crea actor) | OBSERVADA (pide correcciones) | RECHAZADA

### Modelos

- `SolicitudInscripcion`: id, usuarioId, tipoActor, estado (EstadoSolicitud), datosActor (JSON), datosResiduos, datosTEF, datosRegulatorio, fechaEnvio, fechaRevision, revisadoPor, motivoRechazo, observaciones
- `DocumentoSolicitud`: id, solicitudId, tipo (CONSTANCIA_AFIP, MEMORIA_TECNICA, etc.), nombre, path, estado (PENDIENTE|APROBADO|RECHAZADO), observacion
- `MensajeSolicitud`: id, solicitudId, emisorId, texto, esAdmin, createdAt

### Frontend

| Pagina | Archivo | Descripcion |
|--------|---------|-------------|
| Wizard Inscripcion | `pages/public/InscripcionWizardPage.tsx` | Auto-registro publico con CalculadoraTEF |
| Mi Solicitud | `pages/solicitud/MiSolicitudPage.tsx` | Vista candidato de su solicitud |

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
- **Service Worker**: `public/sw.js` — network-first strategy, cache `trazabilidad-rrpp-v22`, API excluded from cache
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
# Run full API smoke test against production (46 endpoints)
bash backend/tests/smoke-test.sh

# Run against local
bash backend/tests/smoke-test.sh http://localhost:3002
```

- **Script**: `backend/tests/smoke-test.sh`
- **Coverage**: 46 endpoints across all route groups (Health, Auth, Manifiestos, Catalogos, Actores, Admin, Reportes, PDF, Analytics, Centro de Control, Notificaciones, QR Verification)
- **Auth**: Logs in as admin (`juan.perez@dgfa.gob.ar` / `admin123`), uses JWT token for authenticated endpoints
- **Dynamic IDs**: Fetches real IDs for detail/sub-resource tests (manifiestoId, transportistaId, operadorId)
- **Exit code**: 0 on all pass, 1 on any failure

### Service Worker Versioning

- **Current version**: v22 (`sw.js` cache name: `trazabilidad-rrpp-v22`)
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
- Health check (`/api/health`) verifica conectividad a DB y retorna `{ status, db, uptime }`. Liveness probe (`/api/health/live`) siempre 200. Readiness probe (`/api/health/ready`) verifica DB + memory < 450MB + uptime > 10s
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

---

## CI/CD Status (Updated 2026-03-25)

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
- ✅ Backups: Automated daily 3 AM with 30-day rotation

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
# Smoke test (46 endpoints)
cd backend
bash tests/smoke-test.sh

# Comprehensive test (includes SITREP health)
cd /Volumes/SDTERA/ultima\ milla/LICITACIONES/PRESENTADAS2025/AMBIENTE
bash test-all-simple.sh

# Expected: 18/18 tests passed
```

Last comprehensive test: **18/18 passed** ✅ (2026-02-15 11:30)

---

## Backup Strategy (Updated 2026-03-19)

### Current Backups

| Data | Location | Frequency | Status |
|------|----------|-----------|--------|
| **SITREP Database** | `/opt/sitrep-backups/sitrep-db-*.sql.gz` | Daily 3 AM (cron) | ✅ Automated + 30-day rotation |
| **Directus Database** | `/opt/directus-backups/directus-db-*.sql.gz` | Daily 2 AM | ✅ Automated |
| **.env config** | `/opt/sitrep-backups/env-*.bak` | Daily 3 AM (cron) | ✅ Automated |

### Backup Script

- **Script**: `/opt/scripts-cicd/backup_sitrep.sh`
- **Cron**: `0 3 * * * /opt/scripts-cicd/backup_sitrep.sh`
- **Retention**: 30 days (auto-cleanup via `find -mtime +30 -delete`)
- **RPO**: 24 hours

### Restore Procedure

```bash
# 1. Identify backup to restore
ssh root@23.105.176.45 "ls -lt /opt/sitrep-backups/sitrep-db-*.sql.gz | head -5"

# 2. Stop backend to prevent writes during restore
ssh root@23.105.176.45 "pm2 stop sitrep-backend"

# 3. Restore database (replace FILENAME with chosen backup)
ssh root@23.105.176.45 "gunzip -c /opt/sitrep-backups/FILENAME.sql.gz | docker exec -i directus-admin-database-1 psql -U directus -d trazabilidad_rrpp"

# 4. Restart backend
ssh root@23.105.176.45 "pm2 restart sitrep-backend"

# 5. Verify
curl -s https://sitrep.ultimamilla.com.ar/api/health
bash backend/tests/smoke-test.sh
```

**If restoring to a clean database** (e.g., new server):
```bash
# Create database first
docker exec -i directus-admin-database-1 psql -U directus -c "CREATE DATABASE trazabilidad_rrpp;"
# Then restore as above
```

### SSH Deploy Key Rotation

- **Current key**: GitHub Secrets `VPS_SSH_KEY_BASE64` (base64-encoded)
- **Rotation policy**: Every 90 days (quarterly)
- **Next rotation**: Check `gh secret list` for last update date
- **Procedure**:
  1. Generate new key: `ssh-keygen -t ed25519 -f deploy_key_new -N ""`
  2. Add public key to server: `ssh root@23.105.176.45 "cat >> ~/.ssh/authorized_keys" < deploy_key_new.pub`
  3. Update GitHub Secret: `cat deploy_key_new | base64 | gh secret set VPS_SSH_KEY_BASE64`
  4. Verify CI/CD deploys successfully
  5. Remove old key from server `authorized_keys`
  6. Delete local key files

### Disk Space Alert

Disco al 87% (11GB libres). Los backups crecen ~120MB/dia. Monitorear con `df -h` y considerar cross-server rsync:
```bash
# Rsync to Hostinger preview server (76.13.234.213)
0 4 * * * rsync -avz /opt/sitrep-backups/ root@76.13.234.213:/backups/sitrep-prod/
```

---

## Related Documentation

- [`../INFRAESTRUCTURA.md`](../INFRAESTRUCTURA.md) - Complete infrastructure overview
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Detailed deployment procedures (to be created)
- [`backend/tests/smoke-test.sh`](./backend/tests/smoke-test.sh) - API smoke test script
