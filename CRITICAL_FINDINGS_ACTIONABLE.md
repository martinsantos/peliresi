# SITREP - CRITICAL FINDINGS & ACTIONABLE ISSUES

## Quick Summary Table

| Issue | Severity | Location | Impact | Fix |
|-------|----------|----------|--------|-----|
| Dashboard missing residuos data | HIGH | manifiesto-query.controller.ts:getDashboardStats | Frontend can't display residue info | Add residuos include |
| Dashboard runs 11 DB queries | HIGH | manifiesto-query.controller.ts:getDashboardStats | Performance degradation | Use groupBy instead of 9 counts |
| Services have no error handling | MEDIUM | All frontend services | Errors propagate uncaught | Add try-catch + consistent toast |
| Response shape inconsistencies | MEDIUM | All backend controllers | Type safety issues | Standardize wrapper format |
| Unused endpoints (13 total) | LOW | notification, admin, analytics, etc | Code bloat, confusion | Remove or document |

---

## Issue #1: MISSING RESIDUOS IN DASHBOARD

### Problem
The dashboard endpoint returns manifiestos WITHOUT residuos data, but frontend likely expects them.

### Location
`/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/backend/src/controllers/manifiesto-query.controller.ts` (line ~180-210)

### Current Code
```typescript
const recientes = await prisma.manifiesto.findMany({
  where,
  orderBy: { updatedAt: 'desc' },
  take: 5,
  include: {
    generador: true,
    transportista: true,
    operador: true
    // ⚠️ Missing: residuos!
  }
});

const enTransitoList = await prisma.manifiesto.findMany({
  where: { ...where, estado: 'EN_TRANSITO' },
  include: {
    generador: true,
    transportista: true,
    operador: true,
    // ⚠️ Missing: residuos!
    tracking: { orderBy: { timestamp: 'desc' }, take: 1 }
  }
});
```

### Fix
```typescript
const recientes = await prisma.manifiesto.findMany({
  where,
  orderBy: { updatedAt: 'desc' },
  take: 5,
  include: {
    generador: true,
    transportista: true,
    operador: true,
    residuos: {  // ✅ ADD THIS
      include: { tipoResiduo: true }
    }
  }
});

const enTransitoList = await prisma.manifiesto.findMany({
  where: { ...where, estado: 'EN_TRANSITO' },
  include: {
    generador: true,
    transportista: true,
    operador: true,
    residuos: {  // ✅ ADD THIS
      include: { tipoResiduo: true }
    },
    tracking: { orderBy: { timestamp: 'desc' }, take: 1 }
  }
});
```

### Impact
- ✅ Allows frontend to display residue summaries in dashboard
- ✅ Prevents follow-up queries if frontend tries to access residuos
- ⚠️ Slightly larger payload (but justified)

---

## Issue #2: DASHBOARD RUNS 11 DATABASE QUERIES

### Problem
The getDashboardStats endpoint makes 9 sequential count queries (one per estado) plus 2 find queries.

### Location
`/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/backend/src/controllers/manifiesto-query.controller.ts` (line ~155-175)

### Current Code
```typescript
const [borradores, aprobados, enTransito, entregados, recibidos, enTratamiento, tratados, rechazados, cancelados, total] 
  = await Promise.all([
    prisma.manifiesto.count({ where: { ...where, estado: 'BORRADOR' } }),      // Query 1
    prisma.manifiesto.count({ where: { ...where, estado: 'APROBADO' } }),      // Query 2
    prisma.manifiesto.count({ where: { ...where, estado: 'EN_TRANSITO' } }),   // Query 3
    prisma.manifiesto.count({ where: { ...where, estado: 'ENTREGADO' } }),     // Query 4
    prisma.manifiesto.count({ where: { ...where, estado: 'RECIBIDO' } }),      // Query 5
    prisma.manifiesto.count({ where: { ...where, estado: 'EN_TRATAMIENTO' } }), // Query 6
    prisma.manifiesto.count({ where: { ...where, estado: 'TRATADO' } }),       // Query 7
    prisma.manifiesto.count({ where: { ...where, estado: 'RECHAZADO' } }),     // Query 8
    prisma.manifiesto.count({ where: { ...where, estado: 'CANCELADO' } }),     // Query 9
    prisma.manifiesto.count({ where })                                          // Query 10
  ]);
```

### Optimal Code
```typescript
const [estadisticasRaw, total] = await Promise.all([
  prisma.manifiesto.groupBy({
    by: ['estado'],
    where,
    _count: true
  }),
  prisma.manifiesto.count({ where })
]);

// Map groupBy results to variables
const estadisticasMap: Record<string, number> = {};
for (const row of estadisticasRaw) {
  estadisticasMap[row.estado] = row._count;
}

const borradores = estadisticasMap['BORRADOR'] ?? 0;
const aprobados = estadisticasMap['APROBADO'] ?? 0;
const enTransito = estadisticasMap['EN_TRANSITO'] ?? 0;
// ... etc
```

### Impact
- ✅ Reduces 9 count queries to 1 groupBy query
- ✅ Faster dashboard load (estimated 50-70% improvement)
- ✅ Better database connection utilization
- ⚠️ Slightly more complex code (manageable)

---

## Issue #3: FRONTEND SERVICES LACK ERROR HANDLING

### Problem
Frontend services (auth.service.ts, manifiesto.service.ts, etc.) don't have try-catch blocks. Errors propagate directly to callers.

### Location
All files in `/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/frontend/src-v6/services/*.ts`

### Current Pattern
```typescript
// ❌ BAD
export const manifiestoService = {
  async list(filters?: ManifiestoFilters): Promise<PaginatedData<Manifiesto>> {
    const { data } = await api.get('/manifiestos', { params: filters });
    const raw = data.data;
    return {
      items: raw.manifiestos || [],
      total: raw.pagination?.total || 0,
      // ...
    };
  },
};
```

### Recommended Pattern
```typescript
// ✅ GOOD
export const manifiestoService = {
  async list(filters?: ManifiestoFilters): Promise<PaginatedData<Manifiesto>> {
    try {
      const { data } = await api.get('/manifiestos', { params: filters });
      const raw = data.data;
      return {
        items: raw.manifiestos || [],
        total: raw.pagination?.total || 0,
        // ...
      };
    } catch (error) {
      console.error('[manifiestoService.list]', error);
      throw new ApiError('No se pudo cargar manifiestos', error);
    }
  },
};

// In hooks, handle with consistent pattern:
const { data, error, isPending } = useQuery({
  queryKey: ['manifiestos', filters],
  queryFn: () => manifiestoService.list(filters),
  onError: (error) => {
    toast.error(
      'Error al cargar manifiestos',
      (error as ApiError).message || 'Intente más tarde'
    );
  }
});
```

### Impact
- ✅ Predictable error behavior
- ✅ Better debugging with error context
- ✅ Consistent user notifications
- ⚠️ Requires updating all 13+ service files

---

## Issue #4: RESPONSE SHAPE INCONSISTENCIES

### Problem
Backend endpoints return responses in multiple formats, making typing and client generation difficult.

### Location
Multiple controllers across backend

### Examples
```typescript
// Pattern 1: Standard wrapper
{ success: true, data: { user: Usuario } }

// Pattern 2: Message only
{ message: string }

// Pattern 3: Pagination wrapper
{ data: { manifiestos: [...], pagination: {...} } }

// Pattern 4: Direct array
{ tiposResiduos: [...] }

// Pattern 5: No wrapper
[...array items...]
```

### Unified Pattern (Recommended)
```typescript
// For all responses:
{
  success: boolean,
  data?: T,
  error?: {
    code: string,
    message: string,
    details?: Record<string, any>
  }
}

// Examples:
{ success: true, data: { user } }
{ success: false, error: { code: 'AUTH_FAILED', message: 'Invalid credentials' } }
{ success: true, data: { manifiestos: [...], pagination: {...} } }
```

### Impact
- ✅ Type-safe responses
- ✅ Easier to generate typed client
- ✅ Better IDE autocomplete
- ⚠️ Requires updating all endpoints
- ⚠️ Minor frontend changes needed

---

## Issue #5: 13 UNUSED BACKEND ENDPOINTS

### Endpoints Without Frontend Callers

**Notification/Anomaly (7 endpoints)**:
- GET /notification/anomalias/:manifiestoId
- POST /notification/anomalias/detectar/:manifiestoId
- PUT /notification/anomalias/:id/resolver
- GET /notification/carga-masiva/plantilla/:tipo
- POST /notification/carga-masiva/generadores
- POST /notification/carga-masiva/operadores
- POST /notification/carga-masiva/transportistas

**Admin (4 endpoints)**:
- GET /admin/email-queue
- POST /admin/impersonate/:userId
- POST /admin/jobs/vencimientos
- PUT /admin/preferencias-notificacion

**Analytics (3 endpoints)**:
- GET /analytics/logs
- GET /analytics/summary
- GET /analytics/user/:email

**Blockchain (3 endpoints)**:
- GET /blockchain/registro
- GET /blockchain/verificar-integridad/:id
- GET /blockchain/verificar-lote

**Catalogo (2 endpoints)**:
- GET /catalogos/enrichment/generadores
- GET /catalogos/enrichment/operadores

**Tracking (1 endpoint)**:
- GET /tracking/actividad

### Recommendations
1. **If feature is incomplete**: Add frontend service + hook
2. **If feature is obsolete**: Remove endpoint + document deprecation
3. **If future feature**: Document and tag with @deprecated

---

## Issue #6: TYPE SYNCHRONIZATION GAPS

### Problem
Frontend types expect fields not guaranteed by backend responses.

### Example: Manifiesto Dashboard
```typescript
// Frontend expects (from types/models.ts)
interface Manifiesto {
  residuos: ManifiestoResiduo[];
  // ...
}

// But backend dashboard doesn't include residuos
include: {
  generador: true,
  transportista: true,
  operador: true
  // residuos: missing!
}
```

### Solutions
1. **Update backend** (recommended): Include residuos in dashboard
2. **Update frontend types**: Mark residuos as optional
3. **Document gap**: Add comment explaining why field is missing

### Critical Fields to Verify
- Manifiesto.residuos (needed for display)
- Transportista.vehiculos (needed for selection)
- Operador.tratamientos (needed for residue compatibility check)
- Usuario.rol (used everywhere for authorization)

---

## Implementation Priority

### Week 1 (Critical)
1. Add residuos to getDashboardStats responses
2. Optimize dashboard count queries (groupBy)
3. Create error handling standard + document

### Week 2 (Important)
1. Standardize API response wrapper across all endpoints
2. Add comprehensive error handling to all services
3. Update TypeScript types to match actual responses

### Week 3 (Nice to Have)
1. Remove or implement unused endpoints
2. Create API client generator from schema
3. Add integration tests for each endpoint pair

---

## Testing Checklist

- [ ] Dashboard loads without residuos missing (Issue #1)
- [ ] Dashboard load time reduced by 50%+ (Issue #2)
- [ ] All mutations show error toasts (Issue #3)
- [ ] All API responses follow unified format (Issue #4)
- [ ] Frontend types accurately reflect backend data (Issue #6)
- [ ] All 13 unused endpoints documented or removed (Issue #5)

