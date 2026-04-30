# Estrategia de Testing Integral — SITREP

**Fecha:** 2026-04-29
**Versión:** 1.0
**Estado:** Aprobado

## Resumen

Estrategia de testing multi-capa para SITREP (Sistema de Trazabilidad de Residuos Peligrosos) que cubre tests cruzados, unitarios y E2E de todos los flujos de trabajo. Los tests se ejecutan contra el ambiente demo (`sitrep.ultimamilla.com.ar`) y local (`localhost:3002`). Nunca contra producción.

## Targets

| Ambiente | URL | Uso |
|----------|-----|-----|
| `demo` (default) | `https://sitrep.ultimamilla.com.ar` | Tests cruzados bash + E2E Playwright + War Room monitor |
| `local` | `http://localhost:3002` | Unitarios Vitest + integración en desarrollo |

## Arquitectura de Testing

```
📁 raíz del repo
├── run-all.sh                          ← Orquestador unificado (Fases 1-6)

📁 backend/tests/                       ← Tests bash de API (ya existen 22 scripts)
├── smoke-test.sh                       ← 46 endpoints, health, auth
├── cross-platform-workflow-test.sh     ← Ciclo BORRADOR→TRATADO multi-rol
├── role-enforcement-test.sh            ← Permisos por rol
├── edge-cases-test.sh                  ← Casos borde
├── gps-validation-test.sh              ← Tracking GPS
├── multiuser-concurrent-test.sh        ← Concurrencia multi-rol
├── notification-test.sh                ← Notificaciones in-app
├── alerts-comprehensive-test.sh        ← Reglas de alerta
├── actores-crud-test.sh                ← CRUD generadores/transportistas/operadores
├── admin-advanced-test.sh              ← Admin: usuarios, roles delegados
├── workflow-extended-test.sh           ← Variantes de workflow
├── blockchain-test.sh                  ← EXISTENTE + EXTENDER con registro/verificación
├── push-test.sh                        ← NUEVO
├── search-test.sh                      ← NUEVO
├── solicitudes-test.sh                 ← NUEVO
├── carga-masiva-test.sh                ← NUEVO
├── reportes-test.sh                    ← NUEVO
├── centro-control-test.sh              ← NUEVO
├── mensajeria-test.sh                  ← NUEVO — pipeline en modo inerte
├── monitor-war-room.sh                 ← NUEVO — cron cada 5 min en demo
├── k6/                                 ← NUEVO
│   ├── concurrent.js
│   ├── gps-burst.js
│   └── reportes-pesados.js
├── run-all-stress.sh                   ← NUEVO — ejecuta batería k6

backend/src/__tests__/         ← Unit tests Vitest backend
├── services/
│   ├── blockchain.service.test.ts    (NUEVO)
│   ├── push.service.test.ts          (NUEVO)
│   ├── notification-dispatcher.service.test.ts (NUEVO)
│   ├── domainEvent.service.test.ts   (NUEVO)
│   └── email.service.test.ts         (NUEVO)
├── controllers/
│   ├── manifiesto-workflow.controller.test.ts (NUEVO)
│   ├── blockchain.controller.test.ts         (NUEVO)
│   └── reporte.controller.test.ts            (NUEVO)
├── middlewares/ (ya existen auth y errorHandler)
└── utils/ (ya existen 4 tests)

frontend/src/__tests__/        ← Unit tests Vitest frontend (NUEVO - app principal)
├── hooks/
│   ├── useManifiestos.test.ts
│   ├── useNotificaciones.test.ts
│   └── useAlertas.test.ts
├── contexts/
│   ├── AuthContext.test.tsx
│   └── NotificationContext.test.tsx
├── components/
│   ├── ManifiestoForm.test.tsx
│   ├── NotificationBell.test.tsx
│   └── BlockchainPanel.test.tsx
└── utils/
    ├── formatters.test.ts
    └── validators.test.ts

frontend/e2e/                  ← Tests E2E Playwright
├── auth.spec.ts               (existente)
├── dashboard.spec.ts          (existente)
├── api-health.spec.ts         (existente)
├── pwa-routing.spec.ts        (existente)
├── full-crawl.spec.ts         (existente)
├── visual-audit.spec.ts       (existente)
├── pwa-load.spec.ts           (existente)
├── admin-flow.spec.ts         (NUEVO)
├── generador-flow.spec.ts     (NUEVO)
├── transportista-flow.spec.ts (NUEVO)
├── operador-flow.spec.ts      (NUEVO)
├── reportes.spec.ts           (NUEVO)
├── notificaciones.spec.ts     (NUEVO)
└── busqueda.spec.ts           (NUEVO)
```

## Sección 1: Test Cruzados (API Bash)

### Flujos Existentes (extender)

| Script | CU cubiertos | Extensión necesaria |
|--------|-------------|---------------------|
| `cross-platform-workflow-test.sh` | G01-G12, T01-T11, O01-O12, A01-A11 | Agregar validación JSON profunda (no solo HTTP 200) |
| `role-enforcement-test.sh` | Permisos | Agregar roles delegados (ADMIN_GENERADOR, etc.) |
| `blockchain-test.sh` | A20, S12 | Agregar registrar y verificar sello vía API |
| `edge-cases-test.sh` | S02 | Sin cambios |
| `gps-validation-test.sh` | S08 | Sin cambios |
| `multiuser-concurrent-test.sh` | General | Sin cambios |

### Flujos Nuevos

| Script | CU cubiertos | Lo que testea |
|--------|-------------|---------------|
| `blockchain-test.sh` (extender) | A20, S12 | POST registrar, verificar integridad, rolling hash |
| `push-test.sh` | S03, push | VAPID key pública, subscribe, unsubscribe, enviarPushAlUsuario (modo inerte) |
| `search-test.sh` | A18 | Búsqueda global por término, filtros, paginación |
| `solicitudes-test.sh` | Público | Wizard inscripción pública, arbitración admin |
| `carga-masiva-test.sh` | A15 | Upload CSV generadores/transportistas/operadores, validación, errores |
| `reportes-test.sh` | A11 | 3 tabs, filtros fecha, export CSV, consistencia contra datos reales |
| `centro-control-test.sh` | A09 | 4 capas, markers en mapa, estadísticas GPS |
| `mensajeria-test.sh` | G11, S03 | Pipeline de notificaciones en modo inerte: in-app, push, email. Verificar que se disparen los eventos correctos sin enviar realmente |
| `monitor-war-room.sh` | S04, S09 | Health checks periódicos, actividad en tiempo real, war room status |

### Validación Profunda

Todos los scripts bash deben verificar más que HTTP 200. Estándar mínimo:
- `data.manifiesto.estado === "TRATADO"` (no solo 200)
- Eventos contienen timestamps no nulos
- Sumatoria de cantidades en reportes matchea con manifiestos creados
- Respuestas contienen `success: true`
- IDs en respuestas son UUIDs válidos

## Sección 2: Unit Tests Backend (Vitest)

### Setup existente

- Framework: Vitest v4 + vitest-mock-extended
- Prisma mockeado vía `src/__tests__/mocks/prisma.ts`
- 8 tests existentes en utils y middlewares

### Nuevos tests

| Archivo | Lo que testea |
|---------|--------------|
| `services/blockchain.service.test.ts` | `registrarSello()` con datos válidos, hash chain consistente, `verificarIntegridad()`, reintentos cron (max 3) |
| `services/push.service.test.ts` | `enviarPushAlUsuario()` con distintas prioridades (CRITICA/ALTA/NORMAL/BAJA), `notificarPorRol()`, suscripciones VAPID |
| `services/notification-dispatcher.service.test.ts` | Dispatch por tipo de evento, prioridades, agregación de destinatarios por rol |
| `services/domainEvent.service.test.ts` | publish/subscribe, handlers se ejecutan, error en un handler no afecta a otros |
| `services/email.service.test.ts` | `encolarEmail()`, flush cada 5min, `DISABLE_EMAILS=true` saltea envío, kill switch |
| `controllers/manifiesto-workflow.controller.test.ts` | Transiciones de estado válidas (BORRADOR→APROBADO→EN_TRANSITO→etc), inválidas (CANCELADO→APROBADO), validación de datos de entrada |
| `controllers/blockchain.controller.test.ts` | Endpoints con auth (200), sin auth (401), manifiesto inexistente (404) |
| `controllers/reporte.controller.test.ts` | mapFilters() traduce fechaDesde→fechaInicio, filtros combinados, agregaciones |

## Sección 3: Unit Tests Frontend (Vitest)

### Setup

- Framework: Vitest + Testing Library + jsdom
- MSW (Mock Service Worker) para interceptar llamadas API
- Apunta a `src/` (app principal), no a `src-v6/`

### Tests

| Archivo | Lo que testea |
|---------|--------------|
| `hooks/useManifiestos.test.ts` | Fetch de lista, detalle, creación, cambio de estado, optimista updates |
| `hooks/useNotificaciones.test.ts` | Polling 30s, marcar leída, marcar todas leídas, eliminar |
| `hooks/useAlertas.test.ts` | CRUD reglas, toggle activa/inactiva |
| `contexts/AuthContext.test.tsx` | Login, logout, refresh token, rol-based guards, persistencia |
| `contexts/NotificationContext.test.tsx` | Estado global de notificaciones, conteo no leídas |
| `components/ManifiestoForm.test.tsx` | Validación de campos, selección de actores, envío |
| `components/NotificationBell.test.tsx` | Render condicional según cantidad, dropdown, prioridades visuales |
| `components/BlockchainPanel.test.tsx` | Estado blockchain, verificación, integración con PDF |
| `utils/formatters.test.ts` | Fechas, números, estados, roles — funciones puras |
| `utils/validators.test.ts` | CUIT, email, pesos, fechas |

## Sección 4: E2E Playwright

### Setup

- Playwright (ya instalado)
- `playwright.config.ts` con `baseURL` apuntable a demo o local
- Tests en `frontend/e2e/`

### Suites

| Archivo | Escenario |
|---------|----------|
| `auth.spec.ts` (existe) | Login exitoso, inválido, refresh token, logout |
| `dashboard.spec.ts` (existe) | Stats cards, mapa, banner app móvil |
| `full-crawl.spec.ts` (existe) | Crawl de todas las rutas públicas |
| `pwa-routing.spec.ts` (existe) | Service worker routing |
| `pwa-load.spec.ts` (existe) | PWA install prompt, offline page |
| `visual-audit.spec.ts` (existe) | Snapshot visual de páginas principales |
| `admin-flow.spec.ts` (NUEVO) | CRUD actores, blockchain panel, centro de control, war room |
| `generador-flow.spec.ts` (NUEVO) | Crear manifiesto, firmar, ver timeline, descargar PDF |
| `transportista-flow.spec.ts` (NUEVO) | Ver viajes asignados, tracking GPS, registrar incidente |
| `operador-flow.spec.ts` (NUEVO) | Ver entrantes, confirmar recepción, tratamiento, cerrar |
| `reportes.spec.ts` (NUEVO) | 3 tabs, filtros fecha, exportar CSV |
| `notificaciones.spec.ts` (NUEVO) | Campana, dropdown, marcar leída, polling |
| `busqueda.spec.ts` (NUEVO) | Cmd+K, resultados, navegación |

## Sección 5: Stress Tests (k6)

### Tests

| Archivo | Escenario | Thresholds |
|---------|-----------|------------|
| `k6/concurrent.js` | 50 VUs creando manifiestos en 30s | P95 < 2s, error rate < 1% |
| `k6/gps-burst.js` | 100 req/s de ubicación GPS | P95 < 500ms, sin rate-limit |
| `k6/reportes-pesados.js` | Consultas con rango de 2 años | P95 < 5s |
| `k6/paginacion.js` | 10 VUs navegando páginas | Sin errores, orden consistente |

### War Room Monitor

- Script `monitor-war-room.sh` corre cada 5 minutos (cron job en servidor demo)
- Verifica: health endpoints, login funcional, dashboard carga, último manifiesto accesible
- Escribe a `war-room-{fecha}.log` con timestamp + resultado
- Opcional: alerta por falla vía notificación in-app

## Sección 6: Orquestación

### Comando único

```bash
bash run-all.sh [ambiente] [--stress]
# ambiente: "demo" (default) o "local"
# --stress: incluye Fase 6 (k6)
```

### Pipeline

```
FASE 1: Smoke
  bash backend/tests/smoke-test.sh $BASE_URL
  → Si falla → STOP. No continúa.

FASE 2: Cruzados
  bash backend/tests/cross-platform-workflow-test.sh $BASE_URL
  bash backend/tests/role-enforcement-test.sh $BASE_URL
  bash backend/tests/edge-cases-test.sh $BASE_URL
  bash backend/tests/gps-validation-test.sh $BASE_URL
  bash backend/tests/notification-test.sh $BASE_URL
  bash backend/tests/alerts-comprehensive-test.sh $BASE_URL
  bash backend/tests/actores-crud-test.sh $BASE_URL
  bash backend/tests/admin-advanced-test.sh $BASE_URL
  bash backend/tests/workflow-extended-test.sh $BASE_URL
  bash backend/tests/blockchain-test.sh $BASE_URL
  bash backend/tests/push-test.sh $BASE_URL
  bash backend/tests/search-test.sh $BASE_URL
  bash backend/tests/solicitudes-test.sh $BASE_URL
  bash backend/tests/carga-masiva-test.sh $BASE_URL
  bash backend/tests/reportes-test.sh $BASE_URL
  bash backend/tests/centro-control-test.sh $BASE_URL
  bash backend/tests/mensajeria-test.sh $BASE_URL
  → Si falla → warning, no detiene E2E

FASE 3: Unitarios
  cd backend && vitest run
  cd frontend && vitest run
  → Si falla → STOP. No corre E2E.

FASE 4: E2E (solo en demo)
  cd frontend && npx playwright test
  → Resultado independiente.

FASE 5: War Room (solo en demo)
  bash backend/tests/monitor-war-room.sh $BASE_URL
  → Corre independiente, resultados a war-room-{fecha}.log

FASE 6: Stress (solo con --stress, solo demo)
  bash backend/tests/run-all-stress.sh $BASE_URL
  → k6 run backend/tests/k6/*.js
```

### Reporte

`test-report-{ambiente}-{fecha}.html` con:
- Resumen ejecutivo PASS/FAIL por fase
- Detalle de cada suite
- Tiempo de ejecución
- Enlaces a logs individuales

### Integración CI (GitHub Actions)

- Trigger: push a main, PR abierto
- Corre Fases 1-4 contra demo
- Reporte como artifact del action

## Credenciales de Test

```yaml
Admin:        admin@dgfa.mendoza.gov.ar / admin123
Generador:    quimica.mendoza@industria.com / gen123
Transportista: transportes.andes@logistica.com / trans123
Operador:     tratamiento.residuos@planta.com / op123
```

## Cobertura Esperada (por CIERRE)

| Tipo | Cantidad estimada | CU cubiertos |
|------|-------------------|-------------|
| Tests bash cruzados | ~22 scripts, ~400 assertions | 60/68 (88%) |
| Unit tests backend | ~15 archivos, ~200 tests | Services + controllers críticos |
| Unit tests frontend | ~10 archivos, ~100 tests | Hooks, contextos, componentes principales |
| E2E Playwright | ~14 suites, ~150 scenarios | UI completa multi-rol |
| Stress k6 | ~4 scripts | Concurrencia, GPS, reportes, paginación |

## No Cubierto (explícitamente)

- Tests contra producción (`sitrepprd1.mendoza.gov.ar`)
- `src-v6/` frontend (legacy congelado)
- Controllers de solo paso de mensajes (pasamanos sin lógica)
- CU-S10 (Motor BPMN) y CU-S11 (Firma Digital) — post-MVP

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Bash tests frágiles por parseo de JSON | Validación con python3, fallo temprano si cambia estructura |
| Datos demo mutables afectan tests | Scripts crean sus propios datos con prefijo "TEST-" y los aíslan |
| E2E frágiles por cambios de UI | Selectores data-testid en componentes clave |
| Rate limit en demo | Tests respetan intervalos, burst controlado |
| Falsos positivos en stress | Thresholds documentados, revisables por humano |
