# SITREP — Reporte Test Integral Total

**Fecha**: 2026-03-27 20:42:24
**Target**: https://sitrep.ultimamilla.com.ar/api
**Resultado**: ALL TESTS PASSED

| Metric | Value |
| ------ | ----- |
| PASS | 124 |
| FAIL | 0 |
| SKIPPED | 0 |
| TOTAL | 124 |


### SECTION 1: HEALTH + PUBLIC (8 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | GET /health (HTTP 200) |
| ✅ PASS | Health DB connected (contains 'connected') |
| ✅ PASS | GET /health/live (HTTP 200) |
| ✅ PASS | GET /health/ready (HTTP 200) |
| ✅ PASS | GET /catalogos/tipos-residuos (public) (HTTP 200) |
| ✅ PASS | tiposResiduos array (contains 'tiposResiduos') |
| ✅ PASS | GET /verificar nonexistent → 404 (HTTP 404) |
| ✅ PASS | GET /auth/test (public) (HTTP 200) |

### SECTION 2: LOGIN 7 ROLES (12 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | Login ADMIN → token obtained |
| ✅ PASS | Login GENERADOR → token obtained |
| ✅ PASS | Login TRANSPORTISTA → token obtained |
| ✅ PASS | Login OPERADOR → token obtained |
| ✅ PASS | Login ADMIN_GENERADOR → token obtained |
| ✅ PASS | Login ADMIN_TRANSPORTISTA → token obtained |
| ✅ PASS | Login ADMIN_OPERADOR → token obtained |
| ✅ PASS | GET /auth/profile (ADMIN) (HTTP 200) |
| ✅ PASS | Profile has user (contains 'user') |
| ✅ PASS | Login bad credentials → 401 (HTTP 401) |
| ✅ PASS | GET /manifiestos without auth → 401 (HTTP 401) |
| ✅ PASS | POST /auth/change-password bad current → 400 (HTTP 400) |

### SECTION 3: WORKFLOW FIJO (16 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | POST /manifiestos (create FIJO) (HTTP 201) |
| ✅ PASS | Manifest created as BORRADOR |
| ✅ PASS | POST /firmar → APROBADO (HTTP 200) |
| ✅ PASS | State is APROBADO |
| ✅ PASS | POST /confirmar-retiro → EN_TRANSITO (HTTP 200) |
| ✅ PASS | POST /ubicacion (GPS update) (HTTP 200) |
| ✅ PASS | POST /incidente (HTTP 200) |
| ✅ PASS | GET /viaje-actual (HTTP 200) |
| ✅ PASS | POST /confirmar-entrega → ENTREGADO (HTTP 200) |
| ✅ PASS | POST /confirmar-recepcion → RECIBIDO (HTTP 200) |
| ✅ PASS | POST /tratamiento → EN_TRATAMIENTO (HTTP 200) |
| ✅ PASS | POST /cerrar → TRATADO (HTTP 200) |
| ✅ PASS | Final state is TRATADO |
| ✅ PASS | GET /pdf/manifiesto (download) (HTTP 200) |
| ✅ PASS | GET /pdf/certificado (TRATADO) (HTTP 200) |
| ✅ PASS | GET /verificar/2026-000137 (public) (HTTP 200) |

### SECTION 4: WORKFLOW IN_SITU (8 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | POST /manifiestos (create IN_SITU) (HTTP 201) |
| ✅ PASS | IN_SITU created as BORRADOR |
| ✅ PASS | POST /firmar IN_SITU → APROBADO (HTTP 200) |
| ✅ PASS | POST /recepcion-insitu → RECIBIDO (HTTP 200) |
| ✅ PASS | IN_SITU state is RECIBIDO |
| ✅ PASS | POST /tratamiento IN_SITU (HTTP 200) |
| ✅ PASS | POST /cerrar IN_SITU → TRATADO (HTTP 200) |
| ✅ PASS | IN_SITU final state TRATADO |

### SECTION 5: CROSS-FILTERING / VALIDATION (6 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | FIJO without transportista → 400 (HTTP 400) |
| ✅ PASS | IN_SITU with transportista → 400 |
| ✅ PASS | Invalid residuo ID → 400 (rejected) |
| ✅ PASS | Empty residuos array → 400 |
| ✅ PASS | GENERADOR cannot confirmar-retiro → 403 (HTTP 403) |
| ✅ PASS | OPERADOR cannot firmar → 403 (HTTP 403) |

### SECTION 6: REPORTES FILTRADOS (12 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | ADMIN reportes/manifiestos (HTTP 200) |
| ✅ PASS | ADMIN reportes/tratados (HTTP 200) |
| ✅ PASS | ADMIN reportes/transporte (HTTP 200) |
| ✅ PASS | GENERADOR reportes/manifiestos (HTTP 200) |
| ✅ PASS | GENERADOR reportes/tratados (HTTP 200) |
| ✅ PASS | GENERADOR reportes/transporte (HTTP 200) |
| ✅ PASS | TRANSPORTISTA reportes/manifiestos (HTTP 200) |
| ✅ PASS | TRANSPORTISTA reportes/tratados (HTTP 200) |
| ✅ PASS | TRANSPORTISTA reportes/transporte (HTTP 200) |
| ✅ PASS | OPERADOR reportes/manifiestos (HTTP 200) |
| ✅ PASS | OPERADOR reportes/tratados (HTTP 200) |
| ✅ PASS | OPERADOR reportes/transporte (HTTP 200) |

### SECTION 7: ADMIN SECTORIALES (12 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | ADMIN_GENERADOR GET /solicitudes (HTTP 200) |
| ✅ PASS | ADMIN_GENERADOR GET /alertas (HTTP 200) |
| ✅ PASS | ADMIN_GENERADOR /admin/usuarios → 403 (HTTP 403) |
| ✅ PASS | ADMIN_GENERADOR GET /actores/generadores (HTTP 200) |
| ✅ PASS | ADMIN_TRANSPORTISTA GET /solicitudes (HTTP 200) |
| ✅ PASS | ADMIN_TRANSPORTISTA GET /alertas (HTTP 200) |
| ✅ PASS | ADMIN_TRANSPORTISTA /admin/usuarios → 200 (role-dependent) |
| ✅ PASS | ADMIN_TRANSPORTISTA GET /actores/transportistas (HTTP 200) |
| ✅ PASS | ADMIN_OPERADOR GET /solicitudes (HTTP 200) |
| ✅ PASS | ADMIN_OPERADOR GET /alertas (HTTP 200) |
| ✅ PASS | ADMIN_OPERADOR /admin/usuarios → 403 (HTTP 403) |
| ✅ PASS | ADMIN_OPERADOR GET /actores/operadores (HTTP 200) |

### SECTION 8: NOTIFICACIONES (7 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | ADMIN GET /notificaciones (HTTP 200) |
| ✅ PASS | GENERADOR GET /notificaciones (HTTP 200) |
| ✅ PASS | TRANSPORTISTA GET /notificaciones (HTTP 200) |
| ✅ PASS | OPERADOR GET /notificaciones (HTTP 200) |
| ✅ PASS | ADMIN GET /alertas (HTTP 200) |
| ✅ PASS | GENERADOR GET /alertas → 403 (HTTP 403) |
| ✅ PASS | ADMIN GET /admin/email-queue (HTTP 200) |

### SECTION 9: ACTORES + CATALOGOS (10 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | GET /actores/generadores (HTTP 200) |
| ✅ PASS | GET /actores/transportistas (HTTP 200) |
| ✅ PASS | GET /actores/operadores (HTTP 200) |
| ✅ PASS | GET /actores/generadores/:id (HTTP 200) |
| ✅ PASS | GET /actores/transportistas/:id (HTTP 200) |
| ✅ PASS | GET /actores/operadores/:id (HTTP 200) |
| ✅ PASS | Operador has razonSocial (contains 'razonSocial') |
| ✅ PASS | GET /catalogos/vehiculos (HTTP 200) |
| ✅ PASS | GET /catalogos/choferes (HTTP 200) |
| ✅ PASS | GET /catalogos/transportistas/:id/vehiculos (HTTP 200) |

### SECTION 10: ANALYTICS (6 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | GET /analytics/manifiestos-por-mes (HTTP 200) |
| ✅ PASS | GET /analytics/residuos-por-tipo (HTTP 200) |
| ✅ PASS | GET /analytics/manifiestos-por-estado (HTTP 200) |
| ✅ PASS | GET /analytics/tiempo-promedio (HTTP 200) |
| ✅ PASS | GET /centro-control/actividad (HTTP 200) |
| ✅ PASS | GET /manifiestos/dashboard (HTTP 200) |
| ✅ PASS | Dashboard has total (contains 'total') |

### SECTION 11: PDF + BLOCKCHAIN + SEARCH (6 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | GET /pdf/manifiesto (existing TRATADO) (HTTP 200) |
| ✅ PASS | GET /pdf/certificado (existing TRATADO) (HTTP 200) |
| ✅ PASS | GET /blockchain/manifiesto/:id (HTTP 200) |
| ✅ PASS | GET /blockchain/verificar-integridad/:id (HTTP 200) |
| ✅ PASS | GET /blockchain/verificar/:hash (public) (HTTP 200) |
| ✅ PASS | GET /search?q=residuo (HTTP 200) |

### SECTION 12: FRONTEND ROUTES (20 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | Desktop / (HTTP 200) |
| ✅ PASS | Desktop /login (HTTP 200) |
| ✅ PASS | Desktop /dashboard (HTTP 200) |
| ✅ PASS | Desktop /manifiestos (HTTP 200) |
| ✅ PASS | Desktop /actores (HTTP 200) |
| ✅ PASS | Desktop /reportes (HTTP 200) |
| ✅ PASS | Desktop /alertas (HTTP 200) |
| ✅ PASS | Desktop /configuracion (HTTP 200) |
| ✅ PASS | Desktop /centro-control (HTTP 200) |
| ✅ PASS | Desktop /auditoria (HTTP 200) |
| ✅ PASS | PWA /app/ (HTTP 200) |
| ✅ PASS | PWA /app/login (HTTP 200) |
| ✅ PASS | PWA /app/dashboard (HTTP 200) |
| ✅ PASS | PWA /app/manifiestos (HTTP 200) |
| ✅ PASS | manifest.json (HTTP 200) |
| ✅ PASS | manifest-app.json (HTTP 200) |
| ✅ PASS | sw.js (HTTP 200) |
| ✅ PASS | icon-192.png (HTTP 200) |
| ✅ PASS | offline.html (HTTP 200) |
| ✅ PASS | Desktop /inscripcion/generador (HTTP 200) |

---

*Generated by test-integral-total.sh on 2026-03-27 20:42:24*
