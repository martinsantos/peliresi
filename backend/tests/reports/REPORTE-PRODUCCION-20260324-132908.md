# Reporte de Test de Produccion — SITREP

**Fecha**: 2026-03-24 13:37:02
**Target**: https://sitrep.ultimamilla.com.ar
**API Health**: OK (db: connected, uptime: 4498.162835363s)

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Suites ejecutadas | 8/8 |
| Tests totales (suites) | 198 |
| Tests pasados (suites) | 174 |
| Tests fallidos (suites) | 24 |
| Workflow steps | 16 (16 pass, 0 fail) |
| Duracion total | 7m 50s |
| **Estado** | **REQUIERE ATENCION** |

## Resultados por Suite

| Suite | Tests | Pass | Fail | Duracion | Estado |
|-------|-------|------|------|----------|--------|
| Smoke Test (46 endpoints) | 48 | 48 | 0 | 43s | PASS |
| Workflow 4 Roles (59 tests) | 56 | 32 | 24 | 42s | FAIL |
| Role Enforcement | ? | 0 | 0 | 3s | PASS |
| Edge Cases | ? | 0 | 0 | 1s | PASS |
| GPS Validation | ? | 0 | 0 | 1s | PASS |
| Concurrencia | ? | 0 | 0 | 1s | PASS |
| Auth Lifecycle | 48 | 48 | 0 | 155s | PASS |
| Alertas/Eventos | 46 | 46 | 0 | 119s | PASS |

## Benchmark de Performance

Cada endpoint medido con 10 requests secuenciales.

| Endpoint | Avg (ms) | P95 (ms) | Max (ms) | Estado |
|----------|----------|----------|----------|--------|
| GET /api/health | 603 | 630 | 630 | WARN |
| POST /api/auth/login | 733 | 1078 | 1078 | WARN |
| GET /api/manifiestos | 1320 | 1392 | 1392 | WARN |
| GET /api/manifiestos/:id | 752 | 785 | 785 | WARN |
| GET /api/centro-control/actividad | 889 | 1000 | 1000 | WARN |
| GET /api/reportes/manifiestos | 890 | 947 | 947 | WARN |
| GET /api/analytics/manifiestos-por-mes | 593 | 635 | 635 | WARN |
| GET /api/manifiestos/dashboard | 1381 | 1530 | 1530 | WARN |

## Stress Test (Carga Concurrente)

| Escenario | Req | Exito | Errores | P95 | Notas |
|-----------|-----|-------|---------|-----|-------|
| Health warmup | 10 | 100% | 0 | 626ms | — |
| Manifiestos reads | 10 | 100% | 0 | 1439ms | — |
| Dashboard x20 | 20 | 100% | 0 | 2412ms | — |
| Health x50 | 50 | 100% | 0 | 739ms | — |
| Login burst | 5 | 100% | 0 | — | — |
| Mixed workload x30 | 30 | 100% | 0 | 1404ms | — |

## Flujo Multi-Usuario Completo

Manifiesto de prueba: **2026-000118** (ID: cmn4u7m5z1buerotzgj0lw1ms)

| Paso | Rol | Accion | Estado Resultante | Tiempo (ms) | HTTP |
|------|-----|--------|-------------------|-------------|------|
| 1 | ADMIN | Crear borrador | BORRADOR | 627 | 201 |
| 2 | GENERADOR | Firmar/Aprobar | APROBADO | 687 | 200 |
| 3 | TRANSPORTISTA | Confirmar retiro | EN_TRANSITO | 646 | 200 |
| 4.1 | TRANSPORTISTA | GPS update #1 | EN_TRANSITO | 608 | 200 |
| 4.2 | TRANSPORTISTA | GPS update #2 | EN_TRANSITO | 608 | 200 |
| 4.3 | TRANSPORTISTA | GPS update #3 | EN_TRANSITO | 604 | 200 |
| 5 | TRANSPORTISTA | Registrar incidente | EN_TRANSITO | 575 | 200 |
| 6 | TRANSPORTISTA | Confirmar entrega | ENTREGADO | 632 | 200 |
| 7 | OPERADOR | Confirmar recepcion | RECIBIDO | 627 | 200 |
| 8 | OPERADOR | Registrar tratamiento | EN_TRATAMIENTO | 638 | 200 |
| 9 | OPERADOR | Cerrar manifiesto | TRATADO | 678 | 200 |
| 10 | ADMIN | Verificar blockchain (SIN_SELLOS) | TRATADO | 603 | 200 |
| 11 | ADMIN | Descargar PDF | TRATADO | 640 | 200 |
| 12 | ADMIN | Descargar certificado | TRATADO | 584 | 200 |
| 13 | PUBLICO | Verificacion QR (2026-000118) | TRATADO | 657 | 200 |
| 14 | ADMIN | Timeline (8 eventos) | TRATADO | 750 | 200 |

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


## Conclusion

**Sistema REQUIERE ATENCION** con 24 tests fallidos.
Revisar seccion de Fallos Detectados antes de declarar produccion estable.

---
*Generado automaticamente por test-produccion-profundo.sh*

