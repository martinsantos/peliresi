# SITREP — Reporte Test Integral Total

**Fecha**: 2026-03-27 20:30:14
**Target**: https://sitrep.ultimamilla.com.ar/api
**Resultado**: 22 TESTS FAILED

| Metric | Value |
| ------ | ----- |
| PASS | 68 |
| FAIL | 22 |
| SKIPPED | 36 |
| TOTAL | 126 |


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
| ❌ FAIL | Login TRANSPORTISTA → no token ({"success":false,"message":"Demasiados intentos de autenticación, intente de nuevo en un minuto"}) |
| ❌ FAIL | Login OPERADOR → no token ({"success":false,"message":"Demasiados intentos de autenticación, intente de nuevo en un minuto"}) |
| ❌ FAIL | Login ADMIN_GENERADOR → no token ({"success":false,"message":"Demasiados intentos de autenticación, intente de nuevo en un minuto"}) |
| ❌ FAIL | Login ADMIN_TRANSPORTISTA → no token ({"success":false,"message":"Demasiados intentos de autenticación, intente de nuevo en un minuto"}) |
| ❌ FAIL | Login ADMIN_OPERADOR → no token ({"success":false,"message":"Demasiados intentos de autenticación, intente de nuevo en un minuto"}) |
| ✅ PASS | GET /auth/profile (ADMIN) (HTTP 200) |
| ✅ PASS | Profile has user (contains 'user') |
| ❌ FAIL | Login bad credentials → 401 (expected 401, got 429) |
| ✅ PASS | GET /manifiestos without auth → 401 (HTTP 401) |
| ✅ PASS | POST /auth/change-password bad current → 400 (HTTP 400) |

### SECTION 3: WORKFLOW FIJO (16 tests)

| Result | Test |
| ------ | ---- |
| ❌ FAIL | POST /manifiestos (create FIJO) (expected 201, got 400) |
| ❌ FAIL | Could not create manifest — skipping remaining workflow steps |
| ⏭ SKIP | Workflow step 2 (no manifest) |
| ⏭ SKIP | Workflow step 3 (no manifest) |
| ⏭ SKIP | Workflow step 4 (no manifest) |
| ⏭ SKIP | Workflow step 5 (no manifest) |
| ⏭ SKIP | Workflow step 6 (no manifest) |
| ⏭ SKIP | Workflow step 7 (no manifest) |
| ⏭ SKIP | Workflow step 8 (no manifest) |
| ⏭ SKIP | Workflow step 9 (no manifest) |
| ⏭ SKIP | Workflow step 10 (no manifest) |
| ⏭ SKIP | Workflow step 11 (no manifest) |
| ⏭ SKIP | Workflow step 12 (no manifest) |
| ⏭ SKIP | Workflow step 13 (no manifest) |
| ⏭ SKIP | Workflow step 14 (no manifest) |
| ⏭ SKIP | Workflow step 15 (no manifest) |
| ⏭ SKIP | Workflow step 16 (no manifest) |

### SECTION 4: WORKFLOW IN_SITU (8 tests)

| Result | Test |
| ------ | ---- |
| ❌ FAIL | POST /manifiestos (create IN_SITU) (expected 201, got 400) |
| ❌ FAIL | Could not create IN_SITU manifest |
| ⏭ SKIP | IN_SITU step 2 (no manifest) |
| ⏭ SKIP | IN_SITU step 3 (no manifest) |
| ⏭ SKIP | IN_SITU step 4 (no manifest) |
| ⏭ SKIP | IN_SITU step 5 (no manifest) |
| ⏭ SKIP | IN_SITU step 6 (no manifest) |
| ⏭ SKIP | IN_SITU step 7 (no manifest) |
| ⏭ SKIP | IN_SITU step 8 (no manifest) |

### SECTION 5: CROSS-FILTERING / VALIDATION (6 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | FIJO without transportista → 400 (HTTP 400) |
| ✅ PASS | IN_SITU with transportista → 400 |
| ✅ PASS | Invalid residuo ID → 400 (rejected) |
| ✅ PASS | Empty residuos array → 400 |
| ⏭ SKIP | Role enforcement test (could not create manifest) |
| ⏭ SKIP | Role enforcement test 2 (could not create manifest) |

### SECTION 6: REPORTES FILTRADOS (12 tests)

| Result | Test |
| ------ | ---- |
| ✅ PASS | ADMIN reportes/manifiestos (HTTP 200) |
| ✅ PASS | ADMIN reportes/tratados (HTTP 200) |
| ✅ PASS | ADMIN reportes/transporte (HTTP 200) |
| ✅ PASS | GENERADOR reportes/manifiestos (HTTP 200) |
| ✅ PASS | GENERADOR reportes/tratados (HTTP 200) |
| ✅ PASS | GENERADOR reportes/transporte (HTTP 200) |
| ❌ FAIL | TRANSPORTISTA reportes/manifiestos (expected 200, got 401) |
| ❌ FAIL | TRANSPORTISTA reportes/tratados (expected 200, got 401) |
| ❌ FAIL | TRANSPORTISTA reportes/transporte (expected 200, got 401) |
| ❌ FAIL | OPERADOR reportes/manifiestos (expected 200, got 401) |
| ❌ FAIL | OPERADOR reportes/tratados (expected 200, got 401) |
| ❌ FAIL | OPERADOR reportes/transporte (expected 200, got 401) |

### SECTION 7: ADMIN SECTORIALES (12 tests)

| Result | Test |
| ------ | ---- |
| ⏭ SKIP | ADMIN_GENERADOR test 1 (no token) |
| ⏭ SKIP | ADMIN_GENERADOR test 2 (no token) |
| ⏭ SKIP | ADMIN_GENERADOR test 3 (no token) |
| ⏭ SKIP | ADMIN_GENERADOR test 4 (no token) |
| ⏭ SKIP | ADMIN_TRANSPORTISTA test 1 (no token) |
| ⏭ SKIP | ADMIN_TRANSPORTISTA test 2 (no token) |
| ⏭ SKIP | ADMIN_TRANSPORTISTA test 3 (no token) |
| ⏭ SKIP | ADMIN_TRANSPORTISTA test 4 (no token) |
| ⏭ SKIP | ADMIN_OPERADOR test 1 (no token) |
| ⏭ SKIP | ADMIN_OPERADOR test 2 (no token) |
| ⏭ SKIP | ADMIN_OPERADOR test 3 (no token) |
| ⏭ SKIP | ADMIN_OPERADOR test 4 (no token) |

### SECTION 8: NOTIFICACIONES (7 tests)

| Result | Test |
| ------ | ---- |
| ❌ FAIL | ADMIN GET /notificaciones (expected 200, got 404) |
| ❌ FAIL | GENERADOR GET /notificaciones (expected 200, got 404) |
| ❌ FAIL | TRANSPORTISTA GET /notificaciones (expected 200, got 401) |
| ❌ FAIL | OPERADOR GET /notificaciones (expected 200, got 401) |
| ❌ FAIL | ADMIN GET /alertas (expected 200, got 404) |
| ❌ FAIL | GENERADOR GET /alertas → 403 (expected 403, got 404) |
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

*Generated by test-integral-total.sh on 2026-03-27 20:30:14*
