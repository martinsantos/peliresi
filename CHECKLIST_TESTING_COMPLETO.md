# ✅ CHECKLIST DE TESTING COMPLETO - TODAS LAS PÁGINAS

## 📋 Instrucciones de Testing

### Preparación
1. **Detener el backend** (para forzar uso de datos demo)
2. **Limpiar caché del navegador** (Ctrl+Shift+R / Cmd+Shift+R)
3. **Abrir DevTools** (F12) para ver consola

---

## 🔍 Páginas a Testear (13 pantallas)

### ✅ 1. Login (`/login`)
- [ ] Muestra formulario de login
- [ ] Campos email y password funcionan
- [ ] Botón "Iniciar Sesión" visible
- [ ] **Estado**: No requiere datos seed (formulario estático)

---

### ✅ 2. Dashboard (`/dashboard`)
**URL**: `http://localhost:5173/dashboard`

- [ ] **Stat cards** muestran números:
  - Total: 8
  - Borradores: 2
  - Aprobados: 1
  - En Tránsito: 2
  - Entregados: 1
  - Recibidos: 1
  - Tratados: 1
- [ ] **Banner de App Móvil** visible
- [ ] **Mapa** (si está implementado) se muestra
- [ ] **NO** aparece "Error al cargar"

**Datos seed**: ✅ `demoStats` con 7 tipos de estadísticas

---

### ✅ 3. Manifiestos (`/manifiestos`)
**URL**: `http://localhost:5173/manifiestos`

- [ ] **Tabla** muestra 6 manifiestos:
  - MAN-2025-000005 (APROBADO)
  - MAN-2025-000006 (EN_TRANSITO)
  - MAN-2025-000007 (RECIBIDO)
  - MAN-2025-000008 (TRATADO)
  - MAN-2025-000009 (APROBADO)
  - MAN-2025-000010 (EN_TRANSITO)
- [ ] **Columnas visibles**: Número, Generador, Transportista, Operador, Estado, Fecha, Acciones
- [ ] **Filtros** (buscar, estado) funcionan
- [ ] **Paginación** muestra "Mostrando 1 - 6 de 6"
- [ ] **NO** aparece "No hay manifiestos"

**Datos seed**: ✅ 6 manifiestos con diferentes estados

---

### ✅ 4. Tracking GPS (`/tracking`)  
**URL**: `http://localhost:5173/tracking`

- [ ] **Mapa** se carga correctamente
- [ ] **2 marcadores** de camiones visibles en mapa:
  - MAN-2025-000006 (Hospital Central → Planta Este)
  - MAN-2025-000010 (Química Industrial → Centro Tratamiento)
- [ ] **Sidebar** muestra "Transportes Activos (2)"
- [ ] **Click en marcador** muestra popup con info
- [ ] **NO** aparece "Sin transportes activos"

**Datos seed**: ✅ 2 manifiestos en tránsito con GPS

---

### ✅ 5. Reportes (`/reportes`)
**URL**: `http://localhost:5173/reportes`

- [ ] **Tabs** (Manifiestos, Tratados, Transporte) visibles
- [ ] **Filtros de fecha** funcionan
- [ ] **Gráficos/Tablas** muestran datos
- [ ] **Botón exportar** visible
- [ ] **Badge "MODO DEMO"** visible

**Datos seed**: ✅ Ya tenía datos demo implementados

---

### ✅ 6. Gestión Actores (`/actores`)
**URL**: `http://localhost:5173/actores`

#### Tab: Generadores
- [ ] **Tabla** muestra 3 generadores:
  - Química Industrial Mendoza (12 manifiestos)
  - Hospital Central Mendoza (8 manifiestos)
  - Farmacéutica Los Andes (5 manifiestos)
- [ ] **Columnas**: Razón Social, CUIT, Email, Teléfono, Estado, Manifiestos, Acciones

#### Tab: Transportistas
- [  ] **Tabla** muestra 2 transportistas:
  - Transportes Los Andes S.A. (15 manifiestos)
  - Logística Cuyo S.R.L. (10 manifiestos)

#### Tab: Operadores
- [ ] **Tabla** muestra 2 operadores:
  - Centro de Tratamiento Cuyo (20 manifiestos)
  - Planta Este Residuos (13 manifiestos)

- [ ] **Tabs** cambian correctamente
- [ ] **Búsqueda** funciona
- [ ] **NO** aparece tabla vacía

**Datos seed**: ✅ 3 generadores, 2 transportistas, 2 operadores

---

### ✅ 7. Configurar Alertas (`/alertas`) **← CORREGIDO HOY** 
**URL**: `http://localhost:5173/demoambiente/alertas`

- [ ] **Grid de reglas** muestra 3 reglas:
  - Alerta por Tiempo Excesivo (ACTIVA, 12 alertas generadas)
  - Desvío de Ruta Detectado (ACTIVA, 3 alertas generadas)
  - Diferencia de Peso (INACTIVA, 0 alertas generadas)
- [ ] **Cada tarjeta** muestra:
  - Icono del evento
  - Nombre de la regla
  - Descripción
  - Destinatarios (tags de roles)
  - Toggle activa/inactiva
  - Botones editar/eliminar
- [ ] **Botón "Nueva Regla"** funcional
- [ ] **NO** aparece "No hay reglas configuradas"

**Datos seed**: ✅ **NUEVO** - 3 reglas de alerta demo

---

### ⚠️ 8. Carga Masiva (`/carga-masiva`)
**URL**: `http://localhost:5173/carga-masiva`

- [ ] Pantalla funcional (formulario/uploader)
- [ ] **NO requiere datos** (es formulario de carga)

**Estado**: No requiere datos seed (funcionalidad de upload)

---

### ⚠️ 9. Configuración (`/configuracion`)
**URL**: `http://localhost:5173/configuracion`

- [ ] Muestra configuración de usuario
- [ ] **NO requiere datos** (es formulario de settings)

**Estado**: No requiere datos seed (configuración estática)

---

### ✅ 10. Detalle Manifiesto (`/manifiestos/:id`)
**URL**: `http://localhost:5173/manifiestos/1`

- [ ] Muestra detalle de manifiesto
- [ ] Secciones: Info general, Residuos, Tracking, Timeline
- [ ] **Probablemente OK** si Manifiestos tiene datos

**Estado**: Depende de datos de Manifiestos (ya tiene seed)

---

### ⚠️ 11. Crear Manifiesto (`/manifiestos/nuevo`)
**URL**: `http://localhost:5173/manifiestos/nuevo`

- [ ] Formulario de creación visible
- [ ] **NO requiere datos** (es formulario)

**Estado**: No requiere datos seed (formulario de creación)

---

### ✅ 12. Mobile App Demo (`/demoambiente/demo-app`)
**URL**: `http://localhost:5173/demoambiente/demo-app`

- [ ] **Phone mockup** visible
- [ ] **Panel derecho** con 6 features coloridas
- [ ] **Analytics viewer** en esquina inferior derecha
- [ ] Al seleccionar rol → muestra datos

**Datos seed**: ✅ 8 manifiestos, 5 alertas

---

### ✅ 13. Mobile App (dentro del mockup)
**Dentro del simulador de teléfono**:

#### Home por cada rol:
- [ ] **ADMIN**: Dashboard con stats
- [ ] **GENERADOR**: Manifiestos, Nuevo manifiesto
- [ ] **TRANSPORTISTA**: QR scanner, Viaje
- [ ] **OPERADOR**: Entrantes, Recibidos

- [ ] **Stat cards**: Números arriba, texto abajo (vertical)
- [ ] **Navegación inferior**: 4-5 botones visibles sin cortarse
- [ ] **Alertas** screen: muestra 5 alertas
- [ ] **Manifiestos**: lista de 8 items

**Datos seed**: ✅ 8 manifiestos + 5 alertas

---

## 📊 Resumen de Datos Seed por Página

| # | Página | Tiene Datos Seed | Cantidad | Estado |
|---|--------|------------------|----------|--------|
| 1 | Login | N/A | - | Formulario |
| 2 | Dashboard | ✅ | 1 set stats | OK |
| 3 | Manifiestos | ✅ | 6 | **NUEVO** |
| 4 | Tracking | ✅ | 2 en mapa | **NUEVO** |
| 5 | Reportes | ✅ | 3 reportes | OK |
| 6 | Actores | ✅ | 3+2+2 | **NUEVO** |
| 7 | Alertas | ✅ | 3 reglas | **HOY** |
| 8 | Carga Masiva | N/A | - | Upload form |
| 9 | Configuración | N/A | - | Settings |
| 10 | Detalle | Depende de #3 | - | OK |
| 11 | Nuevo | N/A | - | Form |
| 12 | Demo App | ✅ | Layout | OK |
| 13 | Mobile App | ✅ | 8+5 | OK |

**Total páginas con datos seed**: 7 de 13 (54%)  
**Páginas que NO lo necesitan**: 4 (formularios/settings)  
**Cobertura efectiva**: 7 de 9 páginas de datos = **78%**

---

## 🎯 Testing Prioritario (Orden de Importancia)

1. ✅ **Dashboard** - Página principal
2. ✅ **Manifiestos** - Funcionalidad core
3. ✅ **Tracking** - Feature destacada
4. ✅ **Mobile App** - Demo principal
5. ✅ **Actores** - Gestión de usuarios
6. ✅ **Alertas** - **CORREGIDO HOY**
7. ✅ **Reportes** - Analytics

---

## 🚀 Comando de Testing Rápido

```bash
# Terminal 1: NO correr backend

# Terminal 2: Correr frontend
cd frontend && npm run dev

# Navegador: Probar URLs en orden
http://localhost:5173/dashboard
http://localhost:5173/manifiestos
http://localhost:5173/tracking
http://localhost:5173/actores
http://localhost:5173/demoambiente/alertas
http://localhost:5173/reportes
http://localhost:5173/demoambiente/demo-app
```

---

## ✅ Criterios de Éxito

### PASS ✓ si:
- NO aparece "No hay datos"
- NO aparece mensaje de error rojo
- Tabla/Grid/Mapa muestra información
- La página es útil/navegable

### FAIL ✗ si:
- Pantalla completamente vacía
- Error rojo "Error al cargar..."
- Mensaje "Sin datos disponibles"

---

**Última actualización**: 2025-12-08 21:55  
**Build**: `index-DG9D-14C.js` (617.75 kB)  
**Estado**: ✅ **CONFIGURAR ALERTAS CORREGIDO**
