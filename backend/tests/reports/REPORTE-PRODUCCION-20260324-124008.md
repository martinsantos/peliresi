# Reporte de Test de Produccion — SITREP

**Fecha**: 2026-03-24 12:54:50
**Target**: https://sitrep.ultimamilla.com.ar
**API Health**: OK (db: connected, uptime: 1558.036884656s)

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Suites ejecutadas | 8/8 |
| Tests totales (suites) | 198 |
| Tests pasados (suites) | 174 |
| Tests fallidos (suites) | 24 |
| Workflow steps | 16 (7 pass, 9 fail) |
| Duracion total | 14m 38s |
| **Estado** | **REQUIERE ATENCION** |

## Resultados por Suite

| Suite | Tests | Pass | Fail | Duracion | Estado |
|-------|-------|------|------|----------|--------|
| Smoke Test (46 endpoints) | 48 | 48 | 0 | 41s | PASS |
| Workflow 4 Roles (59 tests) | 56 | 32 | 24 | 48s | FAIL |
| Role Enforcement | ? | 0 | 0 | 3s | PASS |
| Edge Cases | ? | 0 | 0 | 2s | PASS |
| GPS Validation | ? | 0 | 0 | 0s | PASS |
| Concurrencia | ? | 0 | 0 | 1s | PASS |
| Auth Lifecycle | 48 | 48 | 0 | 151s | PASS |
| Alertas/Eventos | 46 | 46 | 0 | 63s | PASS |

## Benchmark de Performance

Cada endpoint medido con 10 requests secuenciales.

| Endpoint | Avg (ms) | P95 (ms) | Max (ms) | Estado |
|----------|----------|----------|----------|--------|
| GET /api/health | 586 | 629 | 629 | WARN |
| POST /api/auth/login | 674 | 706 | 706 | WARN |
| GET /api/manifiestos | 1262 | 1382 | 1382 | WARN |
| GET /api/manifiestos/:id | 757 | 835 | 835 | WARN |
| GET /api/centro-control/actividad | 1265 | 2102 | 2102 | FAIL |
| GET /api/reportes/manifiestos | 917 | 1015 | 1015 | WARN |
| GET /api/analytics/manifiestos-por-mes | 1280 | 3556 | 3556 | FAIL |
| GET /api/manifiestos/dashboard | 43651 | 300557 | 300557 | FAIL |

## Stress Test (Carga Concurrente)

| Escenario | Req | Exito | Errores | P95 | Notas |
|-----------|-----|-------|---------|-----|-------|
| Health warmup | 10 | 100% | 0 | 793ms | — |
| Manifiestos reads | 10 | 100% | 0 | 3919ms | — |
| Dashboard x20 | 20 | 100% | 0 | 14067ms | — |
| Health x50 | 50 | 100% | 0 | 1683ms | — |
| Login burst | 5 | 100% | 0 | — | — |
| Mixed workload x30 | 30 | 100% | 0 | 12260ms | — |

## Flujo Multi-Usuario Completo

Manifiesto de prueba: **2026-000105** (ID: cmn4spcau0pkniaezirez7wsv)

| Paso | Rol | Accion | Estado Resultante | Tiempo (ms) | HTTP |
|------|-----|--------|-------------------|-------------|------|
| 1 | ADMIN | Crear borrador | BORRADOR | 653 | 201 |
| 2 | GENERADOR | Firmar/Aprobar | APROBADO | 639 | 200 |
| 3 | TRANSPORTISTA | Confirmar retiro | EN_TRANSITO | 731 | 200 |
| 4.1 | TRANSPORTISTA | GPS update #1 | EN_TRANSITO | 674 | ERR |
| 4.2 | TRANSPORTISTA | GPS update #2 | EN_TRANSITO | 656 | ERR |
| 4.3 | TRANSPORTISTA | GPS update #3 | EN_TRANSITO | 624 | ERR |
| 5 | TRANSPORTISTA | Registrar incidente | EN_TRANSITO | 653 | 200 |
| 6 | TRANSPORTISTA | Confirmar entrega | ENTREGADO | 617 | ERR |
| 7 | OPERADOR | Confirmar recepcion | RECIBIDO | 615 | ERR |
| 8 | OPERADOR | Registrar tratamiento | EN_TRATAMIENTO | 634 | ERR |
| 9 | OPERADOR | Cerrar manifiesto | TRATADO | 629 | ERR |
| 10 | ADMIN | Verificar blockchain (SIN_SELLOS) | TRATADO | 583 | 200 |
| 11 | ADMIN | Descargar PDF | TRATADO | 668 | 200 |
| 12 | ADMIN | Descargar certificado | TRATADO | 636 | 400 |
| 13 | PUBLICO | Verificacion QR (2026-000105) | TRATADO | 626 | 200 |
| 14 | ADMIN | Timeline (0 eventos, esperado >5) | TRATADO | 678 | WARN |

## Fallos Detectados

### Suites con fallos

### Workflow 4 Roles (59 tests)
```
  Logging in as TRANSPORTISTA (Pedro Martínez)... [0;31mFAIL[0m
  [0;31mFAIL[0m [401 expected 200] TRANSPORTISTA: Dashboard
  [0;31mFAIL[0m [401 expected 200] TRANSPORTISTA: Pending trips (APROBADO)
  [0;31mFAIL[0m [401 expected 200] TRANSPORTISTA: Active trips (EN_TRANSITO)
  [0;31mFAIL[0m TRANSPORTISTA cannot see manifest (HTTP 401)
```

### Workflow

- Step 4.1 [TRANSPORTISTA] GPS update #1: HTTP ERR
- Step 4.2 [TRANSPORTISTA] GPS update #2: HTTP ERR
- Step 4.3 [TRANSPORTISTA] GPS update #3: HTTP ERR
- Step 6 [TRANSPORTISTA] Confirmar entrega: HTTP ERR
- Step 7 [OPERADOR] Confirmar recepcion: HTTP ERR
- Step 8 [OPERADOR] Registrar tratamiento: HTTP ERR
- Step 9 [OPERADOR] Cerrar manifiesto: HTTP ERR
- Step 12 [ADMIN] Descargar certificado: HTTP 400
- Step 14 [ADMIN] Timeline (0 eventos, esperado >5): HTTP WARN

## Conclusion

**Sistema REQUIERE ATENCION** con 33 tests fallidos.
Revisar seccion de Fallos Detectados antes de declarar produccion estable.

---
*Generado automaticamente por test-produccion-profundo.sh*

