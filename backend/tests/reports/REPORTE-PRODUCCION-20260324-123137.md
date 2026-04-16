# Reporte de Test de Produccion — SITREP

**Fecha**: 2026-03-24 12:38:20
**Target**: https://sitrep.ultimamilla.com.ar
**API Health**: OK (db: connected, uptime: 1047.4054856s)

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Suites ejecutadas | 8/8 |
| Tests totales (suites) | 198 |
| Tests pasados (suites) | 174 |
| Tests fallidos (suites) | 24 |
| Workflow steps | 1 (1 pass, 0 fail) |
| Duracion total | 6m 39s |
| **Estado** | **REQUIERE ATENCION** |

## Resultados por Suite

| Suite | Tests | Pass | Fail | Duracion | Estado |
|-------|-------|------|------|----------|--------|
| Smoke Test (46 endpoints) | 48 | 48 | 0 | 42s | PASS |
| Workflow 4 Roles (59 tests) | 56 | 32 | 24 | 43s | FAIL |
| Role Enforcement | ? | 0 | 0 | 2s | PASS |
| Edge Cases | ? | 0 | 0 | 2s | PASS |
| GPS Validation | ? | 0 | 0 | 1s | PASS |
| Concurrencia | ? | 0 | 0 | 0s | PASS |
| Auth Lifecycle | 48 | 48 | 0 | 152s | PASS |
| Alertas/Eventos | 46 | 46 | 0 | 63s | PASS |

## Benchmark de Performance

Cada endpoint medido con 10 requests secuenciales.

| Endpoint | Avg (ms) | P95 (ms) | Max (ms) | Estado |
|----------|----------|----------|----------|--------|
| GET /api/health | 580 | 627 | 627 | WARN |
| POST /api/auth/login | 683 | 732 | 732 | WARN |
| GET /api/manifiestos | 1318 | 1384 | 1384 | WARN |
| GET /api/manifiestos/:id | 751 | 823 | 823 | WARN |
| GET /api/centro-control/actividad | 954 | 1082 | 1082 | WARN |
| GET /api/reportes/manifiestos | 865 | 893 | 893 | WARN |
| GET /api/analytics/manifiestos-por-mes | 592 | 632 | 632 | WARN |
| GET /api/manifiestos/dashboard | 1333 | 1419 | 1419 | WARN |

## Stress Test (Carga Concurrente)

| Escenario | Req | Exito | Errores | P95 | Notas |
|-----------|-----|-------|---------|-----|-------|
| Health warmup | 10 | 100% | 0 | 622ms | — |
| Manifiestos reads | 10 | 100% | 0 | 1367ms | — |
| Dashboard x20 | 20 | 100% | 0 | 1926ms | — |
| Health x50 | 50 | 100% | 0 | 673ms | — |
| Login burst | 5 | 100% | 0 | — | — |
| Mixed workload x30 | 30 | 100% | 0 | 1363ms | — |

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

