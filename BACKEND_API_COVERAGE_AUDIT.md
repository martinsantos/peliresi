# SITREP BACKEND API COVERAGE AUDIT - COMPREHENSIVE REPORT

## EXECUTIVE SUMMARY
This is a detailed analysis of the SITREP backend API coverage, comparing frontend service methods with backend endpoints, type definitions with actual data returned, and identifying critical issues in data flow, error handling, and query optimization.

---

## 1. FRONTEND→BACKEND MAPPING - DETAILED ANALYSIS

### 1.1 AUTH SERVICE ENDPOINTS
#### Frontend Calls:
- POST /auth/login ✓ (backend: auth.routes.ts, auth.controller.ts)
- POST /auth/logout ✓ (backend: auth.routes.ts)
- GET /auth/profile ✓ (backend: auth.routes.ts - getMe)
- POST /auth/change-password ✓ (backend: auth.routes.ts)
- POST /auth/forgot-password ✓ (backend: auth.routes.ts)
- POST /auth/reset-password ✓ (backend: auth.routes.ts)
- POST /auth/register ✓ (backend: auth.routes.ts)
- GET /auth/verify-email ✓ (backend: auth.routes.ts)
- POST /auth/claim-account ✓ (backend: auth.routes.ts)
- POST /auth/refresh-token ✓ (backend: api.ts - interceptor calls this)

**Status**: ✅ All auth endpoints exist

---

### 1.2 MANIFIESTOS SERVICE ENDPOINTS
#### Frontend Calls:
- GET /manifiestos ✓ (backend: manifiesto.routes.ts, manifiesto-query.controller.ts)
- GET /manifiestos/:id ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos ✓ (backend: manifiesto.routes.ts)
- PUT /manifiestos/:id ✓ (backend: manifiesto.routes.ts)
- DELETE /manifiestos/:id ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/firmar ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/confirmar-retiro ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/ubicacion ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/confirmar-entrega ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/pesaje ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/confirmar-recepcion ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/recepcion-insitu ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/tratamiento ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/cerrar ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/cancelar ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/revertir-estado ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/incidente ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/:id/rechazar ✓ (backend: manifiesto.routes.ts - rechazarCarga)
- GET /manifiestos/dashboard ✓ (backend: manifiesto.routes.ts)
- GET /manifiestos/sync-inicial ✓ (backend: manifiesto.routes.ts)
- POST /manifiestos/validar-qr ✓ (backend: manifiesto.routes.ts)
- GET /manifiestos/:id/viaje-actual ✓ (backend: manifiesto.routes.ts)

**Missing from Frontend (Available in Backend)**:
- GET /manifiestos/esperados - Available but not called
- GET /manifiestos/verificar/:numero - Public endpoint, not needed in authenticated services

**Status**: ✅ All manifiestos endpoints exist and are called

---

### 1.3 ACTORES SERVICE ENDPOINTS
#### Frontend Calls:
- GET /actores/generadores ✓ (backend: actor.routes.ts)
- GET /actores/generadores/:id ✓ (backend: actor.routes.ts)
- POST /actores/generadores ✓ (backend: actor.routes.ts)
- PUT /actores/generadores/:id ✓ (backend: actor.routes.ts)
- DELETE /actores/generadores/:id ✓ (backend: actor.routes.ts)
- GET /actores/transportistas ✓ (backend: actor.routes.ts)
- GET /actores/transportistas/:id ✓ (backend: actor.routes.ts)
- POST /actores/transportistas ✓ (backend: actor.routes.ts)
- PUT /actores/transportistas/:id ✓ (backend: actor.routes.ts)
- DELETE /actores/transportistas/:id ✓ (backend: actor.routes.ts)
- GET /actores/operadores ✓ (backend: actor.routes.ts)
- GET /actores/operadores/:id ✓ (backend: actor.routes.ts)
- POST /actores/operadores ✓ (backend: actor.routes.ts)
- PUT /actores/operadores/:id ✓ (backend: actor.routes.ts)
- DELETE /actores/operadores/:id ✓ (backend: actor.routes.ts)
- POST /actores/transportistas/:transportistaId/vehiculos ✓
- PUT /actores/transportistas/:transportistaId/vehiculos/:vehiculoId ✓
- DELETE /actores/transportistas/:transportistaId/vehiculos/:vehiculoId ✓
- POST /actores/transportistas/:transportistaId/choferes ✓
- PUT /actores/transportistas/:transportistaId/choferes/:choferId ✓
- DELETE /actores/transportistas/:transportistaId/choferes/:choferId ✓
- GET /catalogos/transportistas/:transportistaId/vehiculos ✓ (via catalogo.service)
- GET /catalogos/transportistas/:transportistaId/choferes ✓ (via catalogo.service)
- GET /actores/:tipoPath/:id/historial ✓ (backend: actor.routes.ts)

**Additional Actor Endpoints in Backend (Not in Frontend Service)**:
- GET /actores/generadores/:id/ddjj
- GET /actores/generadores/:id/documentos
- GET /actores/generadores/:id/pagos
- POST /actores/generadores/:id/ddjj
- POST /actores/generadores/:id/documentos
- POST /actores/generadores/:id/pagos
- PUT /actores/generadores/:id/ddjj/:ddjjId
- PUT /actores/generadores/:id/pagos/:pagoId
- DELETE /actores/generadores/:id/ddjj/:ddjjId
- DELETE /actores/generadores/:id/pagos/:pagoId
- (Similar for operadores and documentos)

**Status**: ✅ All basic actores endpoints exist; additional ddjj/pago/documento endpoints not wrapped in service

---

### 1.4 CATALOGO SERVICE ENDPOINTS
#### Frontend Calls:
- GET /catalogos/tipos-residuos ✓
- GET /catalogos/generadores ✓
- GET /catalogos/transportistas ✓
- GET /catalogos/operadores ✓
- GET /catalogos/vehiculos ✓
- GET /catalogos/choferes ✓
- GET /catalogos/operadores/:operadorId/tratamientos ✓
- POST /catalogos/tipos-residuos ✓
- PUT /catalogos/tipos-residuos/:id ✓
- DELETE /catalogos/tipos-residuos/:id ✓
- POST /catalogos/tratamientos ✓
- PUT /catalogos/tratamientos/:id ✓
- DELETE /catalogos/tratamientos/:id ✓

**Status**: ✅ All catalogo endpoints exist

---

### 1.5 ANALYTICS SERVICE ENDPOINTS
#### Frontend Calls:
- GET /analytics/manifiestos-por-estado ✓ (backend: analytics.routes.ts)
- GET /analytics/manifiestos-por-mes ✓ (backend: analytics.routes.ts)
- GET /analytics/residuos-por-tipo ✓ (backend: analytics.routes.ts)
- GET /analytics/tiempo-promedio ✓ (backend: analytics.routes.ts)

**Additional Backend Analytics Endpoints (Not Called)**:
- GET /analytics/logs
- GET /analytics/summary
- GET /analytics/user/:email

**Status**: ✅ All called analytics endpoints exist

---

### 1.6 BLOCKCHAIN SERVICE ENDPOINTS
#### Frontend Calls (from manifiesto.service.ts):
- GET /blockchain/manifiesto/:id ✓ (backend: blockchain.routes.ts)
- GET /blockchain/verificar/:hash ✓ (backend: blockchain.routes.ts)
- POST /blockchain/registrar/:id ✓ (backend: blockchain.routes.ts)

**Additional Backend Blockchain Endpoints (Not Called)**:
- GET /blockchain/registro
- GET /blockchain/verificar-integridad/:id
- GET /blockchain/verificar-lote

**Status**: ✅ All called blockchain endpoints exist

---

### 1.7 SOLICITUD SERVICE ENDPOINTS
#### Frontend Calls:
- POST /solicitudes/iniciar ✓
- GET /solicitudes/mis-solicitudes ✓
- GET /solicitudes/:id ✓
- PUT /solicitudes/:id ✓
- GET /solicitudes/:id/mensajes ✓
- POST /solicitudes/:id/mensajes ✓
- POST /solicitudes/:id/documentos ✓
- DELETE /solicitudes/:id/documentos/:docId ✓
- POST /solicitudes/:id/enviar ✓
- POST /solicitudes/:id/revisar ✓
- POST /solicitudes/:id/observar ✓
- POST /solicitudes/:id/aprobar ✓
- POST /solicitudes/:id/rechazar ✓
- PATCH /solicitudes/:id/documentos/:docId/revisar ✓
- GET /solicitudes ✓ (list with filters)

**Status**: ✅ All solicitud endpoints exist

---

### 1.8 REPORTE SERVICE ENDPOINTS
#### Frontend Calls:
- GET /reportes/manifiestos ✓
- GET /reportes/tratados ✓
- GET /reportes/transporte ✓
- GET /reportes/auditoria ✓
- GET /reportes/exportar/:tipo ✓

**Status**: ✅ All reporte endpoints exist

---

### 1.9 NOTIFICACION/ALERTA SERVICE ENDPOINTS
#### Frontend Calls:
- GET /notificaciones ✓
- PUT /notificaciones/:id/leida ✓
- PUT /notificaciones/todas-leidas ✓
- GET /alertas ✓
- GET /alertas/reglas ✓
- POST /alertas/reglas ✓
- PUT /alertas/reglas/:id ✓
- DELETE /alertas/reglas/:id ✓

**Status**: ✅ All notificacion/alerta endpoints exist

---

### 1.10 RENOVACION SERVICE ENDPOINTS
#### Frontend Calls:
- GET /renovaciones ✓
- GET /renovaciones/:id ✓
- POST /renovaciones ✓
- POST /renovaciones/:id/aprobar ✓
- POST /renovaciones/:id/rechazar ✓

**Status**: ✅ All renovacion endpoints exist

---

### 1.11 SEARCH SERVICE ENDPOINTS
#### Frontend Calls:
- GET /search ✓ (backend: search.routes.ts)

**Status**: ✅ Search endpoint exists

---

### 1.12 ADMIN SERVICE ENDPOINTS
#### Frontend Calls:
- GET /admin/usuarios ✓
- GET /admin/usuarios/:id ✓
- POST /admin/usuarios ✓
- PUT /admin/usuarios/:id ✓
- DELETE /admin/usuarios/:id ✓
- PATCH /admin/usuarios/:id/toggle-activo ✓

**Additional Backend Admin Endpoints (Not Called)**:
- GET /admin/email-queue
- POST /admin/impersonate/:userId
- POST /admin/jobs/vencimientos
- PUT /admin/preferencias-notificacion

**Status**: ✅ All called admin endpoints exist

---

## 2. UNUSED BACKEND ENDPOINTS

Backend endpoints that are **defined but NOT called** by any frontend service:

### Analytics (Not Called):
- GET /analytics/logs
- GET /analytics/summary
- GET /analytics/user/:email

### Blockchain (Not Called):
- GET /blockchain/registro
- GET /blockchain/verificar-integridad/:id
- GET /blockchain/verificar-lote

### Catalogo (Not Called):
- GET /catalogos/enrichment/generadores
- GET /catalogos/enrichment/operadores

### Manifiesto (Not Called):
- GET /manifiestos/esperados (exists, but not called from frontend)

### Notification (Not Called):
- GET /notification/anomalias/:manifiestoId
- POST /notification/anomalias/detectar/:manifiestoId
- PUT /notification/anomalias/:id/resolver
- GET /notification/carga-masiva/plantilla/:tipo
- POST /notification/carga-masiva/generadores
- POST /notification/carga-masiva/operadores
- POST /notification/carga-masiva/transportistas

### Admin (Not Called):
- GET /admin/email-queue
- POST /admin/impersonate/:userId
- POST /admin/jobs/vencimientos
- PUT /admin/preferencias-notificacion

### Tracking (Not Called):
- GET /tracking/actividad

### PDF (Partially Called):
- GET /pdf/manifiesto/:id ✓ (called from manifiesto.service.ts)
- GET /pdf/certificado/:id ✓ (called from manifiesto.service.ts)

**FINDING**: Some endpoints exist in backend but have no frontend callers, particularly around:
- Anomaly detection endpoints
- Bulk loading (carga-masiva)
- Email queue management
- Tracking activity logs
- Enrichment endpoints

---

## 3. DATA SHAPE MISMATCHES

### 3.1 Manifiesto Shape Analysis

**Frontend Expects** (from types/models.ts and manifiestoService):
```typescript
interface Manifiesto {
  id: string;
  numero: string;
  estado: EstadoManifiesto;
  generador: Generador;  // Full object
  transportista?: Transportista;  // Full object with vehiculos[], choferes[]
  operador: Operador;  // Full object
  residuos: ManifiestoResiduo[];  // Array with tipoResiduo.{ id, codigo, nombre }
  eventos: EventoManifiesto[];
  tracking: TrackingGPS[];
  modalidad: 'FIJO' | 'IN_SITU';
  // ... dates
}
```

**Backend Returns** (from manifiesto-query.controller.ts, getManifiestoById):
```typescript
include: {
  generador: true,
  transportista: { include: { vehiculos: true, choferes: true } },
  operador: true,
  residuos: { include: { tipoResiduo: true } },
  eventos: { orderBy: { createdAt: 'desc' }, include: { usuario: { select: { nombre, apellido, rol } } } },
  tracking: { orderBy: { timestamp: 'desc' }, take: 100 }
}
```

**Assessment**: ✅ **MATCH** - Backend includes all necessary relations

**Critical Issue**: In `getDashboardStats`, the backend returns:
```typescript
include: {
  generador: true,
  transportista: true,
  operador: true
  // NO residuos!
}
```
But frontend expects residuos data for dashboard display.

**Issue Location**: `/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/backend/src/controllers/manifiesto-query.controller.ts` lines ~180-210

---

### 3.2 Generador Response Shape Analysis

**Frontend manifiestoService.list** expects:
```typescript
{
  manifiestos: Manifiesto[],
  pagination: { page, limit, total, pages }
}
```

**Backend manifiestoService** returns structure as:
```typescript
{
  success: true,
  data: {
    manifiestos: [...],
    pagination: { page, limit, total, pages }
  }
}
```

**Assessment**: ✅ **MATCH** - Service properly unwraps

But note: Dashboard endpoint returns a different structure:
```typescript
{
  success: true,
  data: {
    estadisticas: { borradores, aprobados, ... },
    recientes: [...],
    enTransitoList: [...]
  }
}
```

This requires frontend to handle different response shapes for different endpoints.

---

### 3.3 Transportista with Vehiculos/Choferes

**Frontend** (actores.service.ts):
```typescript
async listVehiculos(transportistaId: string): Promise<Vehiculo[]> {
  const { data } = await api.get(`/catalogos/transportistas/${transportistaId}/vehiculos`);
  const raw = data.data;
  return Array.isArray(raw) ? raw : raw.vehiculos || [];
}
```

**Backend** (catalogo.routes.ts):
- GET /catalogos/transportistas/:transportistaId/vehiculos - defined in catalogo.controller.ts

**Assessment**: ✅ Endpoints match

---

## 4. MISSING DATA INCLUDES (N+1 Potential)

### Critical Issues Found:

#### Issue #1: getDashboardStats Missing Residuos
**Location**: manifiesto-query.controller.ts, getDashboardStats function
**Problem**: Returns `recientes` and `enTransitoList` manifiestos WITHOUT residuos include
**Impact**: If frontend tries to display residue counts in dashboard, it would need a follow-up query
**Recommendation**: Add `residuos: { include: { tipoResiduo: true } }` to both recientes and enTransitoList queries

#### Issue #2: getSyncInicial May Have N+1
**Location**: manifiesto-query.controller.ts, getSyncInicial
**Code**:
```typescript
const manifiestos = await prisma.manifiesto.findMany({
  where: {...},
  include: {
    generador: {...},
    operador: {...},
    residuos: { include: { tipoResiduo: true } }
    // Good - includes relations properly
  }
});
```
**Assessment**: ✅ Properly structured with includes

---

## 5. QUERY OPTIMIZATION ISSUES

### Issue #1: Dashboard State Counts
**Location**: manifiesto-query.controller.ts, getDashboardStats
**Code Pattern**:
```typescript
const [borradores, aprobados, enTransito, ...] = await Promise.all([
  prisma.manifiesto.count({ where: { ...where, estado: 'BORRADOR' } }),
  prisma.manifiesto.count({ where: { ...where, estado: 'APROBADO' } }),
  // ... 9 separate count queries
]);
```
**Impact**: 9 separate database queries executed in parallel
**Optimization**: Could use single `groupBy` query
**Recommendation**:
```typescript
const statsByEstado = await prisma.manifiesto.groupBy({
  by: ['estado'],
  where,
  _count: true
});
```

---

## 6. ERROR HANDLING ANALYSIS

### Frontend Error Handling:

#### Auth Service (auth.service.ts)
```typescript
async login(credentials: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<...>('/auth/login', credentials);
  const { tokens, user } = data.data;
  setTokens(tokens.accessToken, tokens.refreshToken);
  return { accessToken: tokens.accessToken, ... };
}
```
**Issue**: ❌ NO TRY-CATCH - errors propagate uncaught to caller

#### Manifiesto Service (manifiesto.service.ts)
```typescript
async list(filters?: ManifiestoFilters): Promise<PaginatedData<Manifiesto>> {
  const { data } = await api.get('/manifiestos', { params: filters });
  const raw = data.data;
  return { ... };
}
```
**Issue**: ❌ NO TRY-CATCH - errors propagate uncaught

**General Pattern**: All frontend services **delegate error handling to callers** (hooks/components)

### Error Handling in Hooks:

#### useManifiestos.ts
```typescript
const mutation = useMutation({
  mutationFn: async (payload) => {
    try {
      return await manifiestoService.create(payload);
    } catch (err) {
      console.error(err);
      throw err; // Re-throw to React Query
    }
  },
  onError: (error) => {
    // Shows toast to user
    toast.error('Error creating manifiesto');
  }
});
```
**Assessment**: ✅ Error handling at mutation layer is present

**But Issue**: Not all hooks have comprehensive error handling - some use `.catch(() => {})` silently

**Recommendation**: Standardize error handling with:
1. Type-safe error responses
2. Consistent error messages
3. Toast notifications for all mutations
4. Error logging for debugging

---

## 7. RESPONSE WRAPPER INCONSISTENCIES

### Issue: Multiple Response Patterns

**Pattern 1**: Standard API wrapper
```typescript
{ success: true, data: { user: Usuario } }
```

**Pattern 2**: Success boolean only
```typescript
{ message: string }
```

**Pattern 3**: Direct data with pagination
```typescript
{
  data: {
    manifiestos: [...],
    pagination: { page, limit, total, pages }
  }
}
```

**Pattern 4**: No wrapper
```typescript
{ tiposResiduos: [...] }
```

**Issue**: Frontend services handle this via defensive `.data` access:
```typescript
const raw = data.data;
return Array.isArray(raw) ? raw : raw.manifiestos || [];
```

This is brittle and error-prone.

**Recommendation**: Standardize to consistent response wrapper across all endpoints

---

## 8. CRITICAL FINDINGS SUMMARY

### High Priority Issues:

1. ✅ **All Frontend→Backend Mappings Exist** - No truly missing endpoints
2. ❌ **Dashboard Missing Residuos Data** - getDashboardStats doesn't include residuos
3. ❌ **Error Handling Inconsistent** - Services don't handle errors, rely on callers
4. ⚠️ **N+1 in Dashboard Counts** - 9 sequential count queries instead of 1 groupBy
5. ⚠️ **Response Shape Inconsistencies** - Multiple response patterns across endpoints
6. ⚠️ **Unused Endpoints** - Bulk loading, anomaly detection endpoints unused

### Performance Issues:

1. **getDashboardStats**: 9 count queries + 2 find queries = 11 DB queries
2. **Response wrapper overhead**: Extra `.data` unwrapping in all services
3. **Unused tracking/anomaly endpoints**: Indicate incomplete feature implementation

### Type Safety Issues:

1. Services use defensive `.data` access (brittle)
2. Different response shapes make typing difficult
3. Frontend types expect data not always included in backend responses

---

## RECOMMENDATIONS

### Immediate (Critical):

1. **Fix Dashboard Data** - Add residuos include to getDashboardStats
2. **Optimize Dashboard Queries** - Use groupBy instead of 9 count queries
3. **Standardize Responses** - Use consistent wrapper format: `{ success, data, error }`

### Short Term (Important):

1. **Error Handling** - Add consistent error handling with proper toast notifications
2. **Type Synchronization** - Ensure TypeScript types match actual response shapes
3. **Document Response Shapes** - Create mapping document for all endpoints

### Long Term (Improvement):

1. **Consolidate Unused Endpoints** - Remove or implement calling code for unused endpoints
2. **Query Optimization** - Profile all controllers for N+1 queries
3. **API Client Improvements** - Create typed client generator from backend schemas

