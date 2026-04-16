# Reporte de Test de Produccion — SITREP

**Fecha**: 2026-03-24 13:11:06
**Target**: https://sitrep.ultimamilla.com.ar
**API Health**: OK (db: connected, uptime: 2757.863071218s)

## Resumen Ejecutivo

| Metrica | Valor |
|---------|-------|
| Suites ejecutadas | 8/8 |
| Tests totales (suites) | 200 |
| Tests pasados (suites) | 200 |
| Tests fallidos (suites) | 0 |
| Workflow steps | 16 (10 pass, 6 fail) |
| Duracion total | 10m 54s |
| **Estado** | **REQUIERE ATENCION** |

## Resultados por Suite

| Suite | Tests | Pass | Fail | Duracion | Estado |
|-------|-------|------|------|----------|--------|
| Smoke Test (46 endpoints) | 48 | 48 | 0 | 57s | PASS |
| Workflow 4 Roles (59 tests) | 58 | 58 | 0 | 50s | PASS |
| Role Enforcement | ? | 0 | 0 | 3s | PASS |
| Edge Cases | ? | 0 | 0 | 2s | PASS |
| GPS Validation | ? | 0 | 0 | 0s | PASS |
| Concurrencia | ? | 0 | 0 | 1s | PASS |
| Auth Lifecycle | 48 | 48 | 0 | 156s | PASS |
| Alertas/Eventos | 46 | 46 | 0 | 73s | PASS |

## Benchmark de Performance

Cada endpoint medido con 10 requests secuenciales.

| Endpoint | Avg (ms) | P95 (ms) | Max (ms) | Estado |
|----------|----------|----------|----------|--------|
| GET /api/health | 1818 | 2910 | 2910 | FAIL |
| POST /api/auth/login | 1616 | 3895 | 3895 | WARN |
| GET /api/manifiestos | 3048 | 5274 | 5274 | FAIL |
| GET /api/manifiestos/:id | 1872 | 4663 | 4663 | FAIL |
| GET /api/centro-control/actividad | 2616 | 4127 | 4127 | FAIL |
| GET /api/reportes/manifiestos | 2069 | 3767 | 3767 | FAIL |
| GET /api/analytics/manifiestos-por-mes | 1229 | 2637 | 2637 | FAIL |
| GET /api/manifiestos/dashboard | 2610 | 4516 | 4516 | FAIL |

## Stress Test (Carga Concurrente)

| Escenario | Req | Exito | Errores | P95 | Notas |
|-----------|-----|-------|---------|-----|-------|
| Health warmup | 10 | 100% | 0 | 4985ms | — |
| Manifiestos reads | 10 | 100% | 0 | 4774ms | — |
| Dashboard x20 | 20 | 100% | 0 | 4957ms | — |
| Health x50 | 50 | 100% | 0 | 3705ms | — |
| Login burst | 5 | 100% | 0 | — | — |
| Mixed workload x30 | 30 | 100% | 0 | 8876ms | — |

## Flujo Multi-Usuario Completo

Manifiesto de prueba: **2026-000112** (ID: cmn4t8w3n125krotzsdfgyh7e)

| Paso | Rol | Accion | Estado Resultante | Tiempo (ms) | HTTP |
|------|-----|--------|-------------------|-------------|------|
| 1 | ADMIN | Crear borrador | BORRADOR | 2833 | 201 |
| 2 | GENERADOR | Firmar/Aprobar | APROBADO | 2966 | 200 |
| 3 | TRANSPORTISTA | Confirmar retiro | EN_TRANSITO | 4046 | 200 |
| 4.1 | TRANSPORTISTA | GPS update #1 | EN_TRANSITO | 4463 | 200 |
| 4.2 | TRANSPORTISTA | GPS update #2 | EN_TRANSITO | 3870 | 200 |
| 4.3 | TRANSPORTISTA | GPS update #3 | EN_TRANSITO | 1130 | 200 |
| 5 | TRANSPORTISTA | Registrar incidente | EN_TRANSITO | 746 | 200 |
| 6 | TRANSPORTISTA | Confirmar entrega | ENTREGADO | 13327 | ERR |
| 7 | OPERADOR | Confirmar recepcion | RECIBIDO | 3124 | ERR |
| 8 | OPERADOR | Registrar tratamiento | EN_TRATAMIENTO | 2859 | ERR |
| 9 | OPERADOR | Cerrar manifiesto | TRATADO | 2144 | ERR |
| 10 | ADMIN | Verificar blockchain (PARCIAL) | TRATADO | 4876 | 200 |
| 11 | ADMIN | Descargar PDF | TRATADO | 9865 | 200 |
| 12 | ADMIN | Descargar certificado | TRATADO | 6636 | 400 |
| 13 | PUBLICO | Verificacion QR (2026-000112) | TRATADO | 2403 | 200 |
| 14 | ADMIN | Timeline (0 eventos, esperado >5) | TRATADO | 11088 | WARN |

## Fallos Detectados

### Workflow

- Step 6 [TRANSPORTISTA] Confirmar entrega: HTTP ERR
- Step 7 [OPERADOR] Confirmar recepcion: HTTP ERR
- Step 8 [OPERADOR] Registrar tratamiento: HTTP ERR
- Step 9 [OPERADOR] Cerrar manifiesto: HTTP ERR
- Step 12 [ADMIN] Descargar certificado: HTTP 400
- Step 14 [ADMIN] Timeline (0 eventos, esperado >5): HTTP WARN

## Conclusion

**Sistema REQUIERE ATENCION** con 6 tests fallidos.
Revisar seccion de Fallos Detectados antes de declarar produccion estable.

---
*Generado automaticamente por test-produccion-profundo.sh*

