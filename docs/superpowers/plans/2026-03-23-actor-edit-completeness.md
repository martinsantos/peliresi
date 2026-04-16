# Completar edición de actores — TypeScript types + Transportista DPA + cleanup modales

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Asegurar que los 3 tipos de actores expongan TODOS sus campos en la edición, con tipos TypeScript correctos.

**Architecture:** Los forms de Generador y Operador ya están completos via NuevoGeneradorPage/NuevoOperadorPage (wizards de 6-7 pasos). El gap real está en: (1) TypeScript interfaces incompletas que no reflejan el schema Prisma, (2) TransportistasPage modal que falta 7 campos DPA, (3) AdminOperadoresPage tiene un modal de edición redundante e incompleto (el botón "Editar" ya navega al wizard completo, pero el modal sigue existiendo).

**Tech Stack:** TypeScript, React, Prisma

---

## Estado actual verificado

| Actor | Form de edición | Estado |
|-------|----------------|--------|
| **Generador** | NuevoGeneradorPage (wizard 6 pasos) | COMPLETO — todos los campos del schema |
| **Transportista** | TransportistasPage (modal) | INCOMPLETO — faltan 7 campos DPA |
| **Operador** | NuevoOperadorPage (wizard 7 pasos) | COMPLETO — pero AdminOperadoresPage tiene modal redundante |

## Archivos a modificar (7 total)

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `frontend/src-v6/types/models.ts` | Completar interfaces Generador, Transportista, Operador |
| 2 | `frontend/src-v6/types/api.ts` | Completar CreateGeneradorRequest, CreateTransportistaRequest |
| 3 | `frontend/src-v6/pages/actores/TransportistasPage.tsx` | Agregar 7 campos DPA al modal de edición |
| 4 | `frontend/src-v6/pages/admin/AdminOperadoresPage.tsx` | Eliminar modal de edición redundante (el botón ya navega al wizard) |
| 5 | `frontend/public/sw.js` | Bump v18 → v19 |
| 6 | `backend/src/controllers/manifiesto.controller.ts` | No cambios (ya tiene sort by estado) |

---

### Task 1: Completar TypeScript interfaces en models.ts

**Files:**
- Modify: `frontend/src-v6/types/models.ts:113-161`

- [ ] **Step 1: Actualizar interface Generador (línea 113)**

Agregar los 20 campos que faltan para reflejar el schema Prisma completo:

```typescript
export interface Generador {
  id: string;
  usuarioId: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroInscripcion: string;
  categoria: string;
  actividad?: string;
  rubro?: string;
  corrientesControl?: string;
  latitud?: number;
  longitud?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  expedienteInscripcion?: string;
  domicilioLegalCalle?: string;
  domicilioLegalLocalidad?: string;
  domicilioLegalDepto?: string;
  domicilioRealCalle?: string;
  domicilioRealLocalidad?: string;
  domicilioRealDepto?: string;
  certificacionISO?: string;
  resolucionInscripcion?: string;
  factorR?: number;
  montoMxR?: number;
  categoriaIndividual?: string;
  libroOperatoria?: boolean;
  tefInputs?: Record<string, unknown>;
  usuario?: Usuario;
  manifiestos?: Manifiesto[];
  pagos?: PagoTEF[];
  ddjj?: DeclaracionJurada[];
  documentos?: Documento[];
}
```

- [ ] **Step 2: Actualizar interface Transportista (línea 129)**

Agregar 10 campos DPA faltantes:

```typescript
export interface Transportista {
  id: string;
  usuarioId: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroHabilitacion: string;
  latitud?: number;
  longitud?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  localidad?: string;
  vencimientoHabilitacion?: string;
  corrientesAutorizadas?: string;
  expedienteDPA?: string;
  resolucionDPA?: string;
  resolucionSSP?: string;
  actaInspeccion?: string;
  actaInspeccion2?: string;
  usuario?: Usuario;
  vehiculos?: Vehiculo[];
  choferes?: Chofer[];
}
```

- [ ] **Step 3: Actualizar interface Operador (línea 146)**

Agregar 20 campos enrichment faltantes:

```typescript
export interface Operador {
  id: string;
  usuarioId: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  email: string;
  numeroHabilitacion: string;
  categoria: string;
  tipoOperador?: string;
  tecnologia?: string;
  corrientesY?: string;
  latitud?: number;
  longitud?: number;
  activo: boolean;
  createdAt: string;
  updatedAt: string;
  expedienteInscripcion?: string;
  certificadoNumero?: string;
  domicilioLegalCalle?: string;
  domicilioLegalLocalidad?: string;
  domicilioLegalDepto?: string;
  domicilioRealCalle?: string;
  domicilioRealLocalidad?: string;
  domicilioRealDepto?: string;
  representanteLegalNombre?: string;
  representanteLegalDNI?: string;
  representanteLegalTelefono?: string;
  representanteTecnicoNombre?: string;
  representanteTecnicoMatricula?: string;
  representanteTecnicoTelefono?: string;
  vencimientoHabilitacion?: string;
  resolucionDPA?: string;
  tefInputs?: Record<string, unknown>;
  usuario?: Usuario;
  tratamientos?: TratamientoAutorizado[];
  manifiestos?: Manifiesto[];
  documentos?: Documento[];
}
```

- [ ] **Step 4: Verificar que no hay errores de compilación**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`

Nota: Si `PagoTEF`, `DeclaracionJurada`, o `Documento` no existen como interfaces, usar `any` temporalmente o agregar interfaces mínimas.

---

### Task 2: Completar TypeScript request types en api.ts

**Files:**
- Modify: `frontend/src-v6/types/api.ts:154-216`

- [ ] **Step 1: Actualizar CreateGeneradorRequest**

Agregar campos regulatorios y geográficos que el backend acepta:

```typescript
export interface CreateGeneradorRequest {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  telefono: string;
  numeroInscripcion: string;
  categoria: string;
  actividad?: string;
  rubro?: string;
  corrientesControl?: string;
  latitud?: number;
  longitud?: number;
  expedienteInscripcion?: string;
  domicilioLegalCalle?: string;
  domicilioLegalLocalidad?: string;
  domicilioLegalDepto?: string;
  domicilioRealCalle?: string;
  domicilioRealLocalidad?: string;
  domicilioRealDepto?: string;
  certificacionISO?: string;
  resolucionInscripcion?: string;
  factorR?: number;
  montoMxR?: number;
  categoriaIndividual?: string;
  libroOperatoria?: boolean;
  tefInputs?: Record<string, unknown>;
}
```

- [ ] **Step 2: Actualizar CreateTransportistaRequest**

Agregar campos DPA que el backend acepta:

```typescript
export interface CreateTransportistaRequest {
  email: string;
  password: string;
  nombre: string;
  apellido?: string;
  razonSocial: string;
  cuit: string;
  domicilio: string;
  localidad?: string;
  telefono: string;
  numeroHabilitacion: string;
  vencimientoHabilitacion?: string;
  latitud?: number;
  longitud?: number;
  corrientesAutorizadas?: string;
  expedienteDPA?: string;
  resolucionDPA?: string;
  resolucionSSP?: string;
  actaInspeccion?: string;
  actaInspeccion2?: string;
}
```

- [ ] **Step 3: Agregar tefInputs a CreateOperadorRequest** (único campo faltante)

- [ ] **Step 4: Verificar compilación**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`

---

### Task 3: Agregar campos DPA al modal de edición de Transportista

**Files:**
- Modify: `frontend/src-v6/pages/actores/TransportistasPage.tsx`

- [ ] **Step 1: Expandir INITIAL_FORM con 7 campos DPA**

Agregar a INITIAL_FORM (línea ~43):
```typescript
corrientesAutorizadas: '',
expedienteDPA: '',
resolucionDPA: '',
resolucionSSP: '',
actaInspeccion: '',
actaInspeccion2: '',
```

- [ ] **Step 2: Actualizar openEditar para poblar los 7 campos**

En openEditar (línea ~219), agregar al objeto form:
```typescript
corrientesAutorizadas: row._raw?.corrientesAutorizadas || '',
expedienteDPA: row._raw?.expedienteDPA || '',
resolucionDPA: row._raw?.resolucionDPA || '',
resolucionSSP: row._raw?.resolucionSSP || '',
actaInspeccion: row._raw?.actaInspeccion || '',
actaInspeccion2: row._raw?.actaInspeccion2 || '',
```

Nota: Verificar que `row._raw` contiene estos campos (viene del response del API que SÍ los retorna). Si `_raw` no tiene la forma correcta, usar `(row as any).corrientesAutorizadas` etc.

- [ ] **Step 3: Actualizar handleEditar para enviar los 7 campos al backend**

En handleEditar (línea ~193), agregar al objeto data:
```typescript
corrientesAutorizadas: form.corrientesAutorizadas || undefined,
expedienteDPA: form.expedienteDPA || undefined,
resolucionDPA: form.resolucionDPA || undefined,
resolucionSSP: form.resolucionSSP || undefined,
actaInspeccion: form.actaInspeccion || undefined,
actaInspeccion2: form.actaInspeccion2 || undefined,
```

- [ ] **Step 4: Actualizar renderForm para mostrar los 7 campos**

Agregar sección "Datos DPA" colapsable después de coordenadas y antes de nombre/password:

```tsx
{/* Sección DPA */}
<div className="border-t border-neutral-100 pt-4 mt-2">
  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">Datos DPA</p>
  <div className="grid grid-cols-2 gap-4">
    <Input label="Expediente DPA" value={form.expedienteDPA} onChange={(e) => updateField('expedienteDPA', e.target.value)} placeholder="EXP-DPA-XXXX" />
    <Input label="Resolución DPA" value={form.resolucionDPA} onChange={(e) => updateField('resolucionDPA', e.target.value)} placeholder="0359/24" />
  </div>
  <div className="grid grid-cols-2 gap-4">
    <Input label="Resolución SSP" value={form.resolucionSSP} onChange={(e) => updateField('resolucionSSP', e.target.value)} placeholder="SSP-XXXX" />
    <Input label="Corrientes Autorizadas" value={form.corrientesAutorizadas} onChange={(e) => updateField('corrientesAutorizadas', e.target.value)} placeholder="Y4, Y8, Y9" />
  </div>
  <div className="grid grid-cols-2 gap-4">
    <Input label="Acta Inspección" value={form.actaInspeccion} onChange={(e) => updateField('actaInspeccion', e.target.value)} placeholder="rp-g000040" />
    <Input label="Acta Inspección 2" value={form.actaInspeccion2} onChange={(e) => updateField('actaInspeccion2', e.target.value)} placeholder="rp-g000041" />
  </div>
</div>
```

- [ ] **Step 5: Verificar que tableData mapea _raw correctamente**

Buscar cómo se construye `tableData` y asegurar que los campos DPA están accesibles. Si no, necesitamos añadirlos al mapeo.

- [ ] **Step 6: Verificar compilación**

Run: `cd frontend && npx tsc --noEmit 2>&1 | head -30`

---

### Task 4: Eliminar modal de edición redundante en AdminOperadoresPage

**Files:**
- Modify: `frontend/src-v6/pages/admin/AdminOperadoresPage.tsx`

**Contexto:** El botón "Editar" en la tabla (línea 497) ya navega a `NuevoOperadorPage` (wizard completo). Sin embargo, la página también mantiene un modal de edición (línea 699-710) con solo 10 campos. Este modal es redundante y puede causar confusión si se usa, porque pierde los campos regulatorios.

- [ ] **Step 1: Verificar que NO hay ningún UI path que abra el modal de edición**

Buscar todos los usos de `setModalEditar(true)` y `openEditar`. Si `openEditar` ya NO se llama desde ningún botón (porque el botón usa navigate), el modal ya está muerto.

- [ ] **Step 2: Si el modal sigue siendo accesible, eliminar o redirigir**

Si `modalEditar` todavía se usa por algún path, cambiar la acción para navegar al wizard:
```typescript
const openEditar = (row: typeof tableData[0]) => {
  navigate(`/admin/actores/operadores/${row.id}/editar`);
};
```

Y eliminar: `modalEditar` state, `handleEditar` function, modal JSX.

- [ ] **Step 3: Verificar compilación**

---

### Task 5: Build + Deploy + Smoke test

- [ ] **Step 1: SW bump**

`frontend/public/sw.js`: v18 → v19

- [ ] **Step 2: TypeScript check**

Run: `cd frontend && npx tsc --noEmit`

- [ ] **Step 3: Build backend + frontend + PWA**

```bash
cd backend && npm run build
cd frontend && npm run build && npx vite build --config vite.config.app.ts
```

- [ ] **Step 4: Package + upload + deploy**

Standard deploy procedure from CLAUDE.md.

- [ ] **Step 5: Smoke test**

Run: `bash backend/tests/smoke-test.sh`
Expected: 48/48 PASS

- [ ] **Step 6: Commit**

```bash
git add [changed files]
git commit -m "feat: completar types + campos DPA transportista + cleanup modal operador"
git push origin main
```

---

## Verificación post-deploy

| # | Test | Criterio |
|---|------|----------|
| 1 | Editar Generador | Wizard completo, todos los campos se cargan y guardan |
| 2 | Editar Transportista | Modal muestra 7 campos DPA nuevos, se guardan correctamente |
| 3 | Editar Operador | Botón "Editar" navega al wizard completo, no abre modal incompleto |
| 4 | TypeScript | `npx tsc --noEmit` → 0 errores |
| 5 | Smoke test | 48/48 PASS |
