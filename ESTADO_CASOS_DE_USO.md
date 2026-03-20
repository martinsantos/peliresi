# Estado de Implementación - Casos de Uso

## 🎯 Resumen Ejecutivo - ACTUALIZADO (v2026.3 — Marzo 2026)

| Módulo | Total CU | Completos | Parciales | Pendientes |
|--------|----------|-----------|-----------|------------|
| **Administrador** | 20 | 19 (95%) | 1 (5%) | 0 |
| **Generador** | 12 | 12 (100%) | 0 | 0 |
| **Transportista** | 12 | 12 (100%) | 0 | 0 |
| **Operador** | 12 | 12 (100%) | 0 | 0 |
| **Sistema** | 12 | 9 (75%) | 0 | 3 (25%) |
| **TOTAL** | **68** | **64 (94%)** | **1 (1%)** | **3 (4%)** |

### Nuevos CU (v2026.2)

| ID | Nombre | Estado |
|----|--------|--------|
| CU-A16 | Impersonar Usuario (Acceso Comodín) | ✅ Completo |
| CU-A17 | Gestionar Roles Administrativos Delegados (ADMIN_GENERADOR, ADMIN_TRANSPORTISTA, ADMIN_OPERADOR) | ✅ Completo |
| CU-A18 | Búsqueda Global (Cmd+K / Ctrl+K) | ✅ Completo |
| CU-A19 | Configurar Preferencias de Notificaciones por Email | ✅ Completo |
| CU-T12 | Gestión Autónoma de Flota Propia (Transportista) | ✅ Completo |

### Nuevos CU (v2026.3)

| ID | Nombre | Estado |
|----|--------|--------|
| CU-A20 | Certificación Blockchain de Manifiestos | ✅ Completo |
| CU-S12 | Reintentar Certificaciones Blockchain (Cron Job) | ✅ Completo |

---

## ✅ Implementaciones de Esta Sesión

### Backend

1. **Sistema de Notificaciones In-App (CU-G11, CU-S03)**
   - Modelo `Notificacion` con prioridades y tipos
   - `GET /api/notificaciones` - Listar notificaciones del usuario
   - `PUT /api/notificaciones/:id/leida` - Marcar como leída
   - `PUT /api/notificaciones/todas-leidas` - Marcar todas
   - `DELETE /api/notificaciones/:id` - Eliminar
   - Servicio `notificationService` para envío automático

2. **Configuración de Alertas (CU-A13)**
   - Modelos `ReglaAlerta` y `AlertaGenerada`
   - `GET /api/alertas/reglas` - Listar reglas
   - `POST /api/alertas/reglas` - Crear regla
   - `PUT /api/alertas/reglas/:id` - Actualizar
   - `DELETE /api/alertas/reglas/:id` - Eliminar
   - `GET /api/alertas` - Alertas generadas
   - `PUT /api/alertas/:id/resolver` - Resolver alerta

3. **Detección de Anomalías GPS (CU-S08)**
   - Modelo `AnomaliaTransporte`
   - Clase `AnomaliaDetector` con algoritmos:
     - Velocidad anormal (>120 km/h)
     - Parada prolongada (>2 horas)
     - Pérdida de GPS (>30 min sin datos)
     - Tiempo de tránsito excesivo (>24h)
   - `POST /api/anomalias/detectar/:manifiestoId`
   - `GET /api/anomalias/:manifiestoId`
   - `PUT /api/anomalias/:id/resolver`

4. **Carga Masiva de Datos (CU-A15)**
   - `POST /api/carga-masiva/generadores`
   - `POST /api/carga-masiva/transportistas`
   - `POST /api/carga-masiva/operadores`
   - `GET /api/carga-masiva/plantilla/:tipo`
   - Procesamiento de CSV con validación

### Frontend

1. **NotificationBell Component**
   - Campana en header con contador de no leídas
   - Dropdown con listado de notificaciones
   - Polling cada 30 segundos
   - Iconos por tipo de notificación
   - Prioridades visuales (urgente, alta)

2. **ConfigurarAlertas Page**
   - Grid de reglas de alerta
   - Modal para crear/editar reglas
   - Selector de eventos disparadores
   - Selector de destinatarios por rol
   - Toggle de activación

3. **CargaMasiva Page**
   - Selector de tipo de actor
   - Descarga de plantillas CSV
   - Upload de archivos
   - Resultados con detalle de errores

4. **QRScanner Component**
   - Modal con acceso a cámara
   - Frame de escaneo animado
   - Entrada manual alternativa
   - Navegación a manifiesto encontrado

---

## Detalle por Actor

### 📋 **ADMINISTRADOR DGFA**

| ID | Nombre | Estado | Implementación |
|----|--------|--------|----------------|
| CU-A01 | Iniciar Sesión Admin | ✅ **Completo** | Login funcional |
| CU-A02 | Dashboard Ejecutivo | ✅ **Completo** | Stats, mapa, alertas, gráficos |
| CU-A03 | Gestionar Usuarios | ✅ **Completo** | CRUD en `/api/auth` |
| CU-A04 | Asignar Roles y Permisos | 🟡 **Parcial** | Middleware de roles |
| CU-A05 | Administrar Catálogo Residuos | ✅ **Completo** | Tab en Configuración |
| CU-A06 | Gestionar Generadores | ✅ **Completo** | CRUD completo + UI |
| CU-A07 | Gestionar Transportistas | ✅ **Completo** | CRUD + vehículos/choferes + UI |
| CU-A08 | Gestionar Operadores | ✅ **Completo** | CRUD completo + UI |
| CU-A09 | Monitorear en Tiempo Real | ✅ **Completo** | Mapa interactivo |
| CU-A10 | Consultar Log de Auditoría | ✅ **Completo** | Endpoint + filtros |
| CU-A11 | Generar Reportes Estadísticos | ✅ **Completo** | UI completa + datos demo |
| CU-A12 | Exportar Datos | ✅ **Completo** | CSV de actores y manifiestos |
| CU-A13 | Configurar Alertas | ✅ **Completo** | **NUEVO** - Página completa |
| CU-A14 | Gestionar Parámetros Sistema | ✅ **Completo** | Tab en Configuración |
| CU-A15 | Carga Masiva de Datos | ✅ **Completo** | **NUEVO** - Importador CSV |
| CU-A20 | Certificación Blockchain de Manifiestos | ✅ **Completo** | **NUEVO** - Registro inmutable en Ethereum Sepolia + página admin |

---

### 🏭 **GENERADOR DE RESIDUOS**

| ID | Nombre | Estado | Implementación |
|----|--------|--------|----------------|
| CU-G01 | Iniciar Sesión | ✅ **Completo** | Login funcional |
| CU-G02 | Dashboard | ✅ **Completo** | Stats, recientes, accesos rápidos |
| CU-G03 | Crear Manifiesto | ✅ **Completo** | Formulario completo |
| CU-G04 | Seleccionar Tipo Residuo | ✅ **Completo** | Selector con catálogo |
| CU-G05 | Asignar Transportista | ✅ **Completo** | Selector con filtros |
| CU-G06 | Asignar Operador Destino | ✅ **Completo** | Selector con filtros |
| CU-G07 | Firmar Manifiesto | ✅ **Completo** | Firma + QR automático |
| CU-G08 | Consultar Estado | ✅ **Completo** | Timeline + mapa GPS |
| CU-G09 | Consultar Historial | ✅ **Completo** | Listado con filtros |
| CU-G10 | Descargar PDF | ✅ **Completo** | Botón + PDFKit |
| CU-G11 | Recibir Notificaciones | ✅ **Completo** | **NUEVO** - In-app con campana |
| CU-G12 | Actualizar Perfil | ✅ **Completo** | Datos de perfil |

---

### 🚛 **TRANSPORTISTA**

| ID | Nombre | Estado | Implementación |
|----|--------|--------|----------------|
| CU-T01 | Iniciar Sesión | ✅ **Completo** | Login funcional |
| CU-T02 | Visualizar Asignados | ✅ **Completo** | Web + App móvil |
| CU-T03 | Confirmar Recepción Carga | ✅ **Completo** | Endpoint + UI |
| CU-T04 | Iniciar Transporte | ✅ **Completo** | Endpoint + tracking GPS |
| CU-T05 | Actualizar Estado Tránsito | ✅ **Completo** | Eventos GPS |
| CU-T06 | Registrar Incidente | ✅ **Completo** | Endpoint completo |
| CU-T07 | Confirmar Entrega | ✅ **Completo** | Endpoint + UI |
| CU-T08 | Escanear QR | ✅ **Completo** | **NUEVO** - Modal con cámara |
| CU-T09 | Modo Offline | ✅ **Completo** | Arquitectura preparada |
| CU-T10 | Consultar Historial | ✅ **Completo** | Tab en app móvil |
| CU-T11 | Gestionar Flota | ✅ **Completo** | Vehículos y choferes |

---

### 🏗️ **OPERADOR**

| ID | Nombre | Estado | Implementación |
|----|--------|--------|----------------|
| CU-O01 | Iniciar Sesión | ✅ **Completo** | Login funcional |
| CU-O02 | Visualizar Entrantes | ✅ **Completo** | Web + App móvil |
| CU-O03 | Confirmar Recepción | ✅ **Completo** | Endpoint funcional |
| CU-O04 | Registrar Pesaje | ✅ **Completo** | Con comparación |
| CU-O05 | Registrar Diferencias | ✅ **Completo** | Cálculo automático |
| CU-O06 | Rechazar Carga | ✅ **Completo** | Endpoint + estado |
| CU-O07 | Firmar Recepción Conforme | ✅ **Completo** | Endpoint confirmarRecepcion |
| CU-O08 | Registrar Tratamiento | ✅ **Completo** | Estado intermedio |
| CU-O09 | Cerrar Manifiesto | ✅ **Completo** | Endpoint cerrarManifiesto |
| CU-O10 | Generar Certificado | ✅ **Completo** | PDF certificado + botón |
| CU-O11 | Consultar Historial | ✅ **Completo** | Tab en app móvil |
| CU-O12 | Generar Reportes | ✅ **Completo** | Página reportes compartida |

---

### ⚙️ **SISTEMA (Automatizados)**

| ID | Nombre | Estado | Implementación |
|----|--------|--------|----------------|
| CU-S01 | Generar Número Manifiesto | ✅ **Completo** | Formato AAAA-NNNNNN |
| CU-S02 | Validar Datos Manifiesto | ✅ **Completo** | Validaciones backend |
| CU-S03 | Enviar Notificaciones | ✅ **Completo** | In-app (email pospuesto) |
| CU-S04 | Registrar Auditoría | ✅ **Completo** | EventoManifiesto + Log |
| CU-S05 | Sincronizar Datos Offline | ❌ **Pendiente** | Requiere IndexedDB + Service Worker |
| CU-S06 | Generar Código QR | ✅ **Completo** | Al firmar manifiesto |
| CU-S07 | Calcular Estadísticas | ✅ **Completo** | Dashboard + reportes |
| CU-S08 | Detectar Anomalías | ✅ **Completo** | Algoritmo GPS |
| CU-S09 | Backup Automático | ✅ **Completo** | PostgreSQL |
| CU-S10 | Orquestación Motor BPMN | ⏳ **Post-MVP** | **NUEVO** - Prioridad BAJA |
| CU-S11 | Firma Digital Conjunta | ⏳ **Post-MVP** | **NUEVO** - Prioridad BAJA |
| CU-S12 | Reintentar Certificaciones Blockchain | ✅ **Completo** | **NUEVO** - Cron job cada 60s, max 3 reintentos, solo instancia PM2 0 |

---

## 📡 APIs Implementadas

### Notificaciones y Alertas ✨ NUEVO
```
GET    /api/notificaciones
PUT    /api/notificaciones/:id/leida
PUT    /api/notificaciones/todas-leidas
DELETE /api/notificaciones/:id
GET    /api/alertas/reglas
POST   /api/alertas/reglas
PUT    /api/alertas/reglas/:id
DELETE /api/alertas/reglas/:id
GET    /api/alertas
PUT    /api/alertas/:id/resolver
```

### Anomalías GPS ✨ NUEVO
```
POST   /api/anomalias/detectar/:manifiestoId
GET    /api/anomalias/:manifiestoId
PUT    /api/anomalias/:id/resolver
```

### Carga Masiva ✨ NUEVO
```
POST   /api/carga-masiva/generadores
POST   /api/carga-masiva/transportistas
POST   /api/carga-masiva/operadores
GET    /api/carga-masiva/plantilla/:tipo
```

### Blockchain ✨ NUEVO (2026-03-20)
```
GET    /api/blockchain/verificar/:hash    # Verificación pública de hash (sin auth)
GET    /api/blockchain/manifiesto/:id     # Estado blockchain de un manifiesto
POST   /api/blockchain/registrar/:id      # Registrar manifiesto en blockchain
GET    /api/blockchain/registro           # Lista paginada de certificaciones (ADMIN)
```

### Soporte Offline ✨ NUEVO (2025-12-06)
```
GET    /api/manifiestos/sync-inicial    # CU-T01 - Sincronización inicial para operación offline
GET    /api/manifiestos/esperados       # CU-O03 - Lista manifiestos esperados para validación QR
POST   /api/manifiestos/validar-qr      # CU-T08 - Validar código QR de manifiesto
```

---

## 🖥️ Páginas Frontend

| Página | Ruta | Descripción | Acceso |
|--------|------|-------------|--------|
| Dashboard | `/dashboard` | Panel principal con estadísticas | Todos |
| Manifiestos | `/manifiestos` | Lista de manifiestos con filtros | Todos |
| Detalle Manifiesto | `/manifiestos/:id` | Detalle + timeline + descarga PDF | Todos |
| Nuevo Manifiesto | `/manifiestos/nuevo` | Formulario de creación | Generador |
| Tracking | `/tracking` | Mapa de seguimiento GPS | Todos |
| Reportes | `/reportes` | Estadísticas visuales y exportación | Todos |
| Gestión Actores | `/actores` | CRUD de generadores/transportistas/operadores | Admin |
| **Configurar Alertas** ✨ | `/alertas` | Reglas de alertas automáticas | Admin |
| **Carga Masiva** ✨ | `/carga-masiva` | Importador CSV | Admin |
| Configuración | `/configuracion` | Parámetros del sistema | Admin |
| Demo App | `/demo-app` | Simulador de apps móviles | Todos |

---

## 📈 Métricas de Progreso

| Métrica | Anterior | Ahora | Cambio |
|---------|----------|-------|--------|
| Total Casos de Uso | 66 | 68 | +2 (CU-A20, CU-S12) |
| Casos Completos | 63 (95%) | 64 (94%) | +1 (CU-A20) + 1 (CU-S12) |
| Casos Parciales | 1 (2%) | 1 (1%) | Sin cambio |
| Casos Pendientes | 3 (5%) | 3 (4%) | Sin cambio |
| Endpoints API | ~50 | ~54 | +4 blockchain |
| Páginas Frontend | 12 | 13 | +1 admin/blockchain |

---

## ⏳ Pendientes y Post-MVP

### Alta Prioridad (Demo)
1. **CU-S05**: Sincronización Offline con IndexedDB + Service Worker
   - Almacenamiento local de manifiestos
   - Cola de operaciones pendientes
   - Sincronización bidireccional al reconectar

### Post-MVP (Prioridad BAJA según spec)
2. **CU-S10**: Motor BPMN para orquestación de flujos
   - Requiere integración con Camunda/Activiti
   - Permite modificar reglas sin cambiar código

3. **CU-S11**: Firma Digital Conjunta/Secuencial
   - Múltiples firmas sobre mismo PDF
   - Long Term Validation (LTV)
   - Requiere integración con PKI/HSM

**Nota**: El envío de emails reales (CU-S03) se pospuso. Las notificaciones funcionan como alertas in-app en el sistema.

---

*Última actualización: 2026-03-20*
