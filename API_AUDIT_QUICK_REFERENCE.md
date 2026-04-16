# SITREP API AUDIT - QUICK REFERENCE GUIDE

## File Locations for Key Audit Items

### 1. Dashboard Query Issues (HIGH PRIORITY)

**File**: `/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/peliresi/backend/src/controllers/manifiesto-query.controller.ts`

**Lines 155-175**: Dashboard counts (9 count queries)
**Lines 180-210**: Dashboard find queries (missing residuos)
**Lines 220-240**: Dashboard returns structure

**Quick Grep**:
```bash
grep -n "getDashboardStats\|Promise.all" /path/to/manifiesto-query.controller.ts | head -20
```

---

### 2. Frontend Services Without Error Handling (MEDIUM PRIORITY)

**Affected Files**:
- `/frontend/src-v6/services/auth.service.ts` - All methods
- `/frontend/src-v6/services/manifiesto.service.ts` - All methods
- `/frontend/src-v6/services/actores.service.ts` - All methods
- `/frontend/src-v6/services/catalogo.service.ts` - All methods
- `/frontend/src-v6/services/reporte.service.ts` - All methods
- `/frontend/src-v6/services/solicitud.service.ts` - All methods
- `/frontend/src-v6/services/renovacion.service.ts` - All methods
- Plus 6 more service files

**Pattern to Search**:
```bash
grep -n "export const\|async " /frontend/src-v6/services/*.ts | grep -v "try\|catch"
```

---

### 3. Type Definition Gaps

**Frontend Types**:
- `/frontend/src-v6/types/models.ts` - Domain models
- `/frontend/src-v6/types/api.ts` - API request/response types

**Check**:
- Line ~45-80 in models.ts: Manifiesto interface expects residuos[]
- Line ~78-95 in api.ts: ManifiestoDashboard response type

---

### 4. Backend Routes with Unused Endpoints

**Files to Audit**:
- `/backend/src/routes/notification.routes.ts` - 7 unused endpoints
- `/backend/src/routes/admin.routes.ts` - 4 unused endpoints
- `/backend/src/routes/analytics.routes.ts` - 3 unused endpoints
- `/backend/src/routes/blockchain.routes.ts` - 3 unused endpoints
- `/backend/src/routes/catalogo.routes.ts` - 2 unused endpoints

**How to Find**:
```bash
for file in /path/to/routes/*.ts; do
  echo "=== $(basename $file) ==="
  grep -n "router\." "$file" | grep -E "anomalia|enrichment|email-queue|impersonate|logs|registro"
done
```

---

### 5. Response Wrapper Inconsistencies

**Inconsistency Locations**:

**Type 1: Standard Wrapper** - Most endpoints
```typescript
{ success: true, data: { ... } }
```
Found in: auth.controller.ts, manifiesto.controller.ts

**Type 2: Direct Array** - Catalogo endpoints
```typescript
{ tiposResiduos: [...] }
```
Found in: catalogo.controller.ts, lines ~50-80

**Type 3: Message Only** - Some auth endpoints
```typescript
{ message: string }
```
Found in: auth.controller.ts, register endpoint

**Type 4: Pagination Object** - Manifest and actors
```typescript
{ data: { manifiestos: [...], pagination: {...} } }
```
Found in: manifiesto-query.controller.ts, actor.controller.ts

---

## Summary Stats

| Metric | Count | Location |
|--------|-------|----------|
| Frontend Service Methods | 87 | frontend/src-v6/services/*.ts |
| Backend Routes Registered | 156 | backend/src/routes/*.ts |
| Unused Endpoints | 13 | See section above |
| API Response Patterns | 4+ | Inconsistent |
| Dashboard DB Queries | 11 | manifiesto-query.controller.ts |
| Services with Error Handling | 0 | None currently |

---

## Verification Scripts

### 1. Find All API Calls in Frontend
```bash
grep -rho "api\.\(get\|post\|put\|patch\|delete\)('[^']*'" \
  /path/to/frontend/src-v6/services \
  --include="*.ts" | \
  sed "s/api\.\([^(]*\)('\([^']*\).*/\1 \2/" | \
  sort -u
```

### 2. Find All Registered Routes in Backend
```bash
for file in /path/to/backend/src/routes/*.ts; do
  basename "$file"
  grep -Eo "router\.(get|post|put|patch|delete)\('[^']*'" "$file" | \
    sed "s/router\.\([^(]*\)('\([^']*\).*/\1 \2/" | \
    sort -u
done
```

### 3. Find Dashboard Query Issues
```bash
grep -n "Promise.all" /path/to/manifiesto-query.controller.ts
grep -n "state: 'BORRADOR'\|estado: 'APROBADO'\|estado: 'EN_TRANSITO'" \
  /path/to/manifiesto-query.controller.ts
```

### 4. Find Services Without Try-Catch
```bash
for file in /path/to/frontend/src-v6/services/*.ts; do
  if ! grep -q "try\|catch" "$file"; then
    echo "Missing error handling: $(basename $file)"
  fi
done
```

### 5. Find Response Inconsistencies
```bash
grep -h "res.json\|res.send\|res.status.*json" \
  /path/to/backend/src/controllers/*.ts | \
  head -50
```

---

## Testing Checklist Template

```markdown
## Dashboard Query Fix
- [ ] Added residuos include to getDashboardStats recientes
- [ ] Added residuos include to getDashboardStats enTransitoList
- [ ] Changed 9 count queries to 1 groupBy query
- [ ] Dashboard response shape updated
- [ ] Frontend types updated to expect residuos
- [ ] Database performance improved (measure load time)

## Error Handling Improvement
- [ ] Added try-catch to auth.service.ts
- [ ] Added try-catch to manifiesto.service.ts
- [ ] Added try-catch to actores.service.ts
- [ ] Added try-catch to catalogo.service.ts
- [ ] Added try-catch to reporte.service.ts
- [ ] Added try-catch to solicitud.service.ts
- [ ] All mutations have onError handlers with toast
- [ ] Error logging in place for debugging

## Response Standardization
- [ ] Created unified response wrapper format
- [ ] Updated all controllers to use wrapper
- [ ] Updated all frontend services to handle new format
- [ ] Updated TypeScript types
- [ ] No breaking changes to existing integrations
```

---

## Key Metrics to Monitor

After fixes:
1. **Dashboard Load Time**: Target < 200ms (from ~500ms)
2. **Error Recovery Rate**: Target 100% (currently many silent failures)
3. **Type Coverage**: Target 95% (currently gaps exist)
4. **API Response Consistency**: Target 100% (currently 4 patterns)

---

## Related Documentation

- Full comprehensive audit: `BACKEND_API_COVERAGE_AUDIT.md`
- Critical actionable items: `CRITICAL_FINDINGS_ACTIONABLE.md`
- This quick reference: `API_AUDIT_QUICK_REFERENCE.md`

