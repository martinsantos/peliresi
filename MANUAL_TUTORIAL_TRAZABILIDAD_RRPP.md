# 📚 MANUAL TUTORIAL - Sistema de Trazabilidad de Residuos Peligrosos

## DGFA Mendoza - Diciembre 2025

---

# 📋 ÍNDICE

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Rol ADMINISTRADOR DGFA](#3-rol-administrador-dgfa)
4. [Rol GENERADOR](#4-rol-generador)
5. [Rol TRANSPORTISTA](#5-rol-transportista)
6. [Rol OPERADOR](#6-rol-operador)
7. [App Móvil PWA](#7-app-móvil-pwa)
8. [Flujo Completo del Manifiesto](#8-flujo-completo-del-manifiesto)
9. [Anexos](#9-anexos)

---

# 1. INTRODUCCIÓN

## 1.1 Descripción del Sistema

El **Sistema de Trazabilidad de Residuos Peligrosos** es una plataforma integral que permite gestionar electrónicamente el ciclo de vida completo de los manifiestos de residuos peligrosos según la **Ley Nacional 24.051**.

### Características Principales

| Característica | Descripción |
|----------------|-------------|
| **Manifiestos Electrónicos** | Creación, firma y seguimiento digital |
| **Firma Electrónica** | Validación legal en cada etapa |
| **Tracking GPS** | Ubicación en tiempo real de transportes |
| **Modo Offline** | Funcionamiento sin conexión |
| **Código QR** | Verificación instantánea |
| **Auditoría Completa** | Registro inmutable de operaciones |
| **Alertas Automáticas** | Detección proactiva de anomalías |

## 1.2 Actores del Sistema

| Actor | Descripción | Icono |
|-------|-------------|-------|
| **Administrador DGFA** | Supervisa y administra el sistema completo | 🛡️ |
| **Generador** | Produce residuos y declara manifiestos | 🏭 |
| **Transportista** | Traslada residuos desde origen a destino | 🚛 |
| **Operador** | Recibe, trata y dispone los residuos | 🏢 |

## 1.3 Requisitos Técnicos

- **Navegador**: Chrome 90+, Firefox 88+, Edge 90+, Safari 14+
- **Resolución mínima**: 1280x720 (desktop), 375x667 (móvil)
- **Conexión**: Internet (soporta modo offline para operaciones críticas)

---

# 2. ACCESO AL SISTEMA

## 2.1 URL de Acceso

**Producción:** `https://www.ultimamilla.com.ar/demoambiente/`

**Desarrollo:** `http://localhost:5173/demoambiente/`

## 2.2 Pantalla de Login (CU-A01, CU-G01, CU-T01, CU-O01)

![Login](screenshots/desktop/login.png)

### Flujo de Autenticación

1. Ingrese su **usuario** (email registrado)
2. Ingrese su **contraseña**
3. Ingrese el **código 2FA** (token de seguridad)
4. El sistema verifica credenciales y redirige al dashboard correspondiente

### Credenciales de Demo

| Rol | Acceso Directo |
|-----|----------------|
| Admin | Selector de rol en header |
| Generador | Selector de rol en header |
| Transportista | Selector de rol en header |
| Operador | Selector de rol en header |

## 2.3 Cambio de Rol

En la esquina superior derecha, haga click en el **menú de usuario** para cambiar entre los diferentes roles disponibles.

---

# 3. ROL ADMINISTRADOR DGFA

El Administrador DGFA tiene acceso completo al sistema para supervisar y gestionar todos los aspectos de la trazabilidad de residuos peligrosos.

## 3.1 Dashboard Ejecutivo (CU-A02)

![Dashboard Admin](screenshots/desktop/admin_dashboard.png)

### Elementos del Dashboard

| Elemento | Descripción |
|----------|-------------|
| **KPIs** | Indicadores clave: manifiestos activos, en tránsito, completados |
| **Mapa de Transportes** | Ubicación en tiempo real de todos los transportes activos |
| **Alertas Pendientes** | Notificaciones que requieren atención inmediata |
| **Tendencias** | Gráficos de los últimos 30 días |

### Acciones Disponibles

- Filtrar por período, tipo de residuo o actor
- Acceder directamente a cualquier manifiesto
- Ver detalles de alertas
- Exportar estadísticas

---

## 3.2 Gestión de Usuarios (CU-A03)

![Gestión Usuarios](screenshots/desktop/admin_usuarios.png)

### Funcionalidades

1. **Listado de usuarios** con filtros de búsqueda
2. **Crear nuevo usuario**: Formulario con datos completos
3. **Editar usuario**: Modificar datos existentes
4. **Activar/Desactivar**: Control de acceso
5. **Eliminar**: Con confirmación y motivo

### Campos del Formulario

| Campo | Tipo | Requerido |
|-------|------|-----------|
| Nombre completo | Texto | ✅ |
| Email | Email | ✅ |
| CUIT | Numérico | ✅ |
| Rol | Selector | ✅ |
| Teléfono | Texto | ❌ |

---

## 3.3 Asignar Roles y Permisos (CU-A04)

### Roles Disponibles

| Rol | Descripción | Color |
|-----|-------------|-------|
| ADMIN | Acceso completo al sistema | 🟢 Verde |
| GENERADOR | Crear y gestionar manifiestos propios | 🔵 Azul |
| TRANSPORTISTA | Viajes y tracking GPS | 🟠 Naranja |
| OPERADOR | Recepción y tratamiento | 🟣 Violeta |

### Permisos por Rol

```
ADMIN
├── Dashboard Ejecutivo
├── Gestión de Usuarios
├── Catálogo de Residuos
├── Gestión de Actores (Generadores, Transportistas, Operadores)
├── Monitoreo GPS
├── Auditoría
├── Reportes y Exportación
├── Configuración de Alertas
└── Carga Masiva

GENERADOR
├── Dashboard Personal
├── Crear Manifiesto
├── Historial de Manifiestos
├── Seguimiento GPS
└── Notificaciones

TRANSPORTISTA
├── Manifiestos Asignados
├── Confirmar Retiro (Offline)
├── Tracking GPS
├── Registrar Incidentes
└── Confirmar Entrega

OPERADOR
├── Manifiestos Entrantes
├── Recepción QR
├── Registro de Pesaje
├── Tratamiento
├── Cierre de Manifiesto
└── Certificados
```

---

## 3.4 Catálogo de Residuos (CU-A05)

![Catálogo Residuos](screenshots/desktop/admin_catalogo.png)

### Categorías según Ley 24.051

El catálogo incluye todas las categorías **Y** de residuos peligrosos:

| Código | Categoría | Ejemplo |
|--------|-----------|---------|
| Y1 | Desechos clínicos | Residuos hospitalarios |
| Y2 | Desechos de medicamentos | Fármacos vencidos |
| Y3 | Desechos de biocidas | Pesticidas |
| Y4 | Desechos de fabricación de madera | Preservantes |
| ... | ... | ... |
| Y45 | Colectores y desechos que contienen organohalogenados | PCBs |

### Acciones

- Agregar nuevo tipo de residuo
- Editar descripción y características
- Activar/Desactivar tipos

---

## 3.5 Gestión de Generadores (CU-A06)

![Gestión Generadores](screenshots/desktop/admin_generadores.png)

### Campos Requeridos

| Campo | Descripción |
|-------|-------------|
| Razón Social | Nombre legal de la empresa |
| CUIT | Identificación tributaria única |
| Domicilio | Dirección completa |
| N° Inscripción | Número de registro ambiental |
| Contacto | Email y teléfono |

### Estados

- **Activo**: Puede crear manifiestos
- **Suspendido**: Temporalmente inhabilitado
- **Inactivo**: Sin acceso al sistema

---

## 3.6 Gestión de Transportistas (CU-A07)

![Gestión Transportistas](screenshots/desktop/admin_transportistas.png)

### Datos de la Empresa

| Campo | Descripción |
|-------|-------------|
| Razón Social | Nombre de la empresa transportista |
| CUIT | Identificación tributaria |
| N° Habilitación | Certificado de transporte de RRPP |
| Vigencia | Fecha de vencimiento de habilitación |

### Gestión de Flota

| Vehículo | Datos |
|----------|-------|
| Patente | Identificación del vehículo |
| Tipo | Camión, furgón, etc. |
| Capacidad | Toneladas máximas |
| Habilitación | N° y vigencia |

### Gestión de Choferes

| Chofer | Datos |
|--------|-------|
| Nombre | Nombre completo |
| DNI | Documento de identidad |
| Licencia | N° y categoría |
| Vigencia | Fecha de vencimiento |

---

## 3.7 Gestión de Operadores (CU-A08)

![Gestión Operadores](screenshots/desktop/admin_operadores.png)

### Datos de la Planta

| Campo | Descripción |
|-------|-------------|
| Razón Social | Nombre del operador |
| CUIT | Identificación tributaria |
| N° Habilitación | Certificado de operación |
| Categoría | Tipo de tratamiento autorizado |
| Ubicación | Coordenadas GPS de la planta |

### Métodos de Tratamiento

| Método | Código | Descripción |
|--------|--------|-------------|
| Incineración | D10 | Destrucción térmica |
| Celda de Seguridad | D5 | Disposición final controlada |
| Tratamiento Físico-Químico | D9 | Neutralización, precipitación |
| Reciclaje | R1-R10 | Recuperación de materiales |

---

## 3.8 Monitoreo GPS en Tiempo Real (CU-A09)

![Monitoreo GPS](screenshots/desktop/admin_tracking.png)

### Funcionalidades del Mapa

| Función | Descripción |
|---------|-------------|
| **Marcadores** | Ubicación de cada transporte activo |
| **Info emergente** | Click en marcador: N° manifiesto, transportista, origen, destino |
| **Actualización** | Cada 30 segundos automáticamente |
| **Filtros** | Por zona, transportista, tipo de residuo |
| **Alertas** | Desvíos de ruta marcados en rojo |

### Indicadores de Estado

| Color | Estado |
|-------|--------|
| 🟢 Verde | En ruta normal |
| 🟡 Amarillo | Parada programada |
| 🔴 Rojo | Alerta/Desvío |
| ⚫ Gris | Sin señal GPS |

---

## 3.9 Log de Auditoría (CU-A10)

![Auditoría](screenshots/desktop/admin_auditoria.png)

### Tipos de Eventos Registrados

| Evento | Descripción |
|--------|-------------|
| LOGIN | Inicio de sesión |
| LOGOUT | Cierre de sesión |
| CREATE | Creación de registro |
| UPDATE | Modificación de datos |
| DELETE | Eliminación de registro |
| SIGN | Firma electrónica |
| EXPORT | Exportación de datos |

### Filtros Disponibles

- Por fecha (desde/hasta)
- Por usuario
- Por tipo de operación
- Por módulo del sistema

### Exportación

- Formato CSV para análisis
- Formato PDF para auditorías oficiales

---

## 3.10 Reportes Estadísticos (CU-A11)

![Reportes](screenshots/desktop/admin_reportes.png)

### Tipos de Reportes

| Reporte | Descripción |
|---------|-------------|
| **Manifiestos por Período** | Cantidad y estado por rango de fechas |
| **Por Tipo de Residuo** | Distribución por categoría Y |
| **Por Actor** | Generadores, transportistas, operadores más activos |
| **Por Zona Geográfica** | Concentración por región |
| **Tiempos de Proceso** | Duración promedio de cada etapa |

### Formatos de Exportación

- **PDF**: Para impresión y archivo
- **CSV**: Para análisis en Excel
- **XML**: Para integración con otros sistemas

---

## 3.11 Exportar Datos (CU-A12)

### Conjuntos de Datos Exportables

| Dataset | Incluye |
|---------|---------|
| Manifiestos | Todos los campos y estados |
| Actores | Generadores, transportistas, operadores |
| Auditoría | Logs de operaciones |
| Estadísticas | KPIs calculados |

### Proceso

1. Seleccionar conjunto de datos
2. Aplicar filtros (opcional)
3. Seleccionar formato (PDF/CSV/XML)
4. Confirmar y descargar

---

## 3.12 Configurar Alertas (CU-A13)

![Configurar Alertas](screenshots/desktop/admin_alertas.png)

### Tipos de Alertas Configurables

| Alerta | Condición |
|--------|-----------|
| **Vencimiento próximo** | Habilitación por vencer en X días |
| **Desvío de ruta** | Transporte fuera de ruta esperada |
| **Tiempo excedido** | Manifiesto sin cierre en X horas |
| **Diferencia de peso** | Pesaje real difiere > X% del declarado |
| **Sin GPS** | Transporte sin señal por > X minutos |

### Canales de Notificación

- ✉️ Email
- 🔔 Push (navegador/app)
- 📱 SMS (opcional)

---

## 3.13 Parámetros del Sistema (CU-A14)

### Configuraciones Disponibles

| Parámetro | Descripción | Valor Default |
|-----------|-------------|---------------|
| Tiempo máximo tránsito | Horas antes de alerta | 24h |
| Tolerancia pesaje | Diferencia permitida | 5% |
| Retención auditoría | Días de almacenamiento | 365 |
| Intervalo GPS | Segundos entre updates | 30s |

---

## 3.14 Carga Masiva (CU-A15)

![Carga Masiva](screenshots/desktop/admin_carga.png)

### Proceso de Importación

1. **Seleccionar tipo de datos**: Generadores, Transportistas, Operadores
2. **Cargar archivo**: Excel (.xlsx) o CSV
3. **Vista previa**: El sistema muestra datos a importar
4. **Validación**: Se detectan errores y duplicados
5. **Opciones de conflicto**: Omitir, Actualizar, Crear nuevo
6. **Confirmar**: Procesar importación
7. **Reporte**: Resultado detallado

### Formato de Archivo

```csv
RAZON_SOCIAL,CUIT,DOMICILIO,N_INSCRIPCION,EMAIL,TELEFONO
"Empresa ABC SRL",20-12345678-9,"Av. Principal 123","INS-001","contacto@abc.com","0261-1234567"
```

---

# 4. ROL GENERADOR

El Generador de Residuos puede crear manifiestos electrónicos, asignar transportistas y operadores, y hacer seguimiento de sus envíos.

## 4.1 Dashboard del Generador (CU-G02)

![Dashboard Generador](screenshots/desktop/generador_dashboard.png)

### Elementos

| Elemento | Descripción |
|----------|-------------|
| **Contadores** | Borradores, Pendientes, En Tránsito, Completados |
| **Últimos Manifiestos** | Lista de manifiestos recientes con estado |
| **Alertas** | Notificaciones pendientes |
| **Accesos Rápidos** | Nuevo Manifiesto, Historial |

---

## 4.2 Crear Manifiesto (CU-G03)

![Crear Manifiesto](screenshots/desktop/generador_nuevo.png)

### Pasos del Formulario

**Paso 1: Datos del Generador** (precargados)
- Razón Social
- CUIT
- Domicilio
- N° Inscripción

**Paso 2: Seleccionar Residuo** (CU-G04)
- Buscar en catálogo
- Seleccionar categoría Y
- Indicar características de peligrosidad

**Paso 3: Cantidad**
- Ingresar cantidad numérica
- Seleccionar unidad (kg, litros, m³)

**Paso 4: Asignar Transportista** (CU-G05)
- Lista filtrada por tipo de residuo
- Ver datos de habilitación
- Seleccionar vehículo y chofer

**Paso 5: Asignar Operador** (CU-G06)
- Lista filtrada por tipo de residuo
- Ver métodos de tratamiento disponibles
- Confirmar selección

**Paso 6: Observaciones**
- Campo de texto libre
- Adjuntar documentación (opcional)

---

## 4.3 Firma Electrónica (CU-G07)

![Firma Manifiesto](screenshots/desktop/generador_firma.png)

### Proceso de Firma

1. **Revisar Borrador**: Verificar todos los datos
2. **Aceptar DDJJ**: Declaración jurada de veracidad
3. **Autenticación**: Ingresar contraseña + Token OTP
4. **Firmar**: Aplicar firma electrónica
5. **Confirmación**: Manifiesto firmado + QR generado

### Resultado

- Estado cambia a "Pendiente de Retiro"
- Se genera código QR único
- Transportista es notificado
- PDF disponible para descarga

---

## 4.4 Consultar Estado (CU-G08)

![Estado Manifiesto](screenshots/desktop/generador_estado.png)

### Timeline del Manifiesto

| Estado | Descripción |
|--------|-------------|
| 📝 Borrador | En edición, no firmado |
| ✍️ Firmado | Pendiente de retiro |
| 🚛 En Tránsito | Transportista en camino |
| 📍 Entregado | Llegó a destino |
| ✅ Recibido | Operador confirmó recepción |
| 🔬 En Tratamiento | Procesando residuos |
| ✔️ Cerrado | Ciclo completo |

### Mapa GPS

Si el manifiesto está "En Tránsito", se muestra:
- Ubicación actual del transporte
- Ruta recorrida
- ETA estimado

---

## 4.5 Historial de Manifiestos (CU-G09)

![Historial](screenshots/desktop/generador_historial.png)

### Filtros Disponibles

| Filtro | Opciones |
|--------|----------|
| Estado | Todos, Borrador, Firmado, En Tránsito, Cerrado |
| Fecha | Desde / Hasta |
| Tipo de Residuo | Categorías Y |
| Transportista | Lista de transportistas utilizados |
| Operador | Lista de operadores destino |

### Acciones por Manifiesto

- 👁️ Ver detalle
- 📄 Descargar PDF
- 📋 Ver timeline

---

## 4.6 Descargar Manifiesto PDF (CU-G10)

![PDF Manifiesto](screenshots/desktop/generador_pdf.png)

### Contenido del PDF

- Datos completos del manifiesto
- Información del generador
- Información del transportista
- Información del operador
- Código QR de verificación
- Firmas electrónicas
- Timeline de eventos

---

## 4.7 Notificaciones (CU-G11)

### Eventos Notificados

| Evento | Descripción |
|--------|-------------|
| Retiro confirmado | Transportista recogió la carga |
| En tránsito | Viaje iniciado |
| Entrega confirmada | Llegó al operador |
| Recepción firmada | Operador aceptó carga |
| Manifiesto cerrado | Ciclo completado |
| Diferencia detectada | Peso real difiere del declarado |
| Rechazo | Operador rechazó carga |

---

## 4.8 Actualizar Perfil (CU-G12)

### Campos Modificables

- Email de contacto
- Teléfono
- Configuración de notificaciones (email, push)
- Preferencias de visualización

---

# 5. ROL TRANSPORTISTA

El Transportista opera principalmente desde la **App Móvil PWA**, con capacidades **offline-first** para zonas sin conectividad.

## 5.1 Inicio de Sesión y Sincronización (CU-T01)

📱 ![Login Transportista](screenshots/mobile/transportista_login.png)

### Sincronización Inicial

Al iniciar sesión, la app descarga automáticamente:
- Manifiestos asignados
- Catálogo de residuos
- Datos de operadores destino
- Base de datos local cifrada

---

## 5.2 Manifiestos Asignados (CU-T02)

📱 ![Manifiestos Asignados](screenshots/mobile/transportista_asignados.png)

### Información por Manifiesto

| Campo | Descripción |
|-------|-------------|
| N° Manifiesto | Identificador único |
| Generador | Nombre y dirección |
| Tipo de Residuo | Categoría y descripción |
| Cantidad | Peso/volumen declarado |
| Fecha límite | Urgencia de retiro |

### Ordenamiento

- Por urgencia (más urgente primero)
- Por fecha de asignación
- Por distancia

---

## 5.3 Confirmar Retiro - Modo Offline (CU-T03)

📱 ![Confirmar Retiro](screenshots/mobile/transportista_retiro.png)

### Flujo de Retiro

1. **Seleccionar manifiesto** de la lista
2. **Verificar bultos** y cantidades físicamente
3. **Captura GPS** automática (funciona sin red)
4. **Firma en pantalla** del generador
5. **Guardar localmente** si no hay conexión
6. **Sincroniza** automáticamente al recuperar red

### Datos Capturados

| Dato | Fuente |
|------|--------|
| Coordenadas GPS | Dispositivo |
| Fecha/Hora | Sistema |
| Firma | Touch screen |
| Foto (opcional) | Cámara |
| Observaciones | Texto libre |

---

## 5.4 Iniciar Transporte (CU-T04)

📱 ![Iniciar Transporte](screenshots/mobile/transportista_iniciar.png)

### Activación de Tracking

1. Tap en **"Iniciar Viaje"**
2. Confirmar inicio
3. GPS se activa automáticamente
4. Sistema cambia estado a "En Tránsito"
5. Generador y Operador son notificados
6. Se calcula ruta y ETA

### Indicadores en Pantalla

- 🟢 GPS Activo
- ⏱️ Tiempo transcurrido
- 📍 Km recorridos
- 🎯 ETA al destino

---

## 5.5 Actualizar Estado en Tránsito (CU-T05)

📱 ![Estado Tránsito](screenshots/mobile/transportista_transito.png)

### Eventos Registrables

| Evento | Descripción |
|--------|-------------|
| Parada programada | Descanso, combustible |
| Demora | Tráfico, clima |
| Cambio de chofer | Relevo de conductor |
| Desvío autorizado | Cambio de ruta aprobado |

---

## 5.6 Registrar Incidente (CU-T06)

📱 ![Registrar Incidente](screenshots/mobile/transportista_incidente.png)

### Tipos de Incidentes

| Tipo | Descripción | Alerta |
|------|-------------|--------|
| Accidente | Colisión o vuelco | 🚨 Inmediata |
| Derrame | Fuga de material | 🚨 Inmediata |
| Robo | Sustracción de carga | 🚨 Inmediata |
| Avería | Falla mecánica | ⚠️ Normal |
| Otro | Situación no prevista | ⚠️ Normal |

### Datos Capturados

- Tipo de incidente
- Descripción detallada
- Fotografías (múltiples)
- Ubicación GPS exacta
- Hora del incidente

---

## 5.7 Confirmar Entrega (CU-T07)

📱 ![Confirmar Entrega](screenshots/mobile/transportista_entrega.png)

### Proceso de Entrega

1. Llegar al operador destino
2. Sistema verifica GPS vs dirección registrada
3. Escanear QR del operador (opcional)
4. Registrar hora de llegada
5. Firma de conformidad del operador
6. Estado cambia a "Entregado - Pendiente Recepción"

---

## 5.8 Escanear QR (CU-T08)

📱 ![Escanear QR](screenshots/mobile/transportista_qr.png)

### Uso del Escáner

1. Tap en **"Escanear QR"**
2. Apuntar cámara al código
3. Sistema decodifica automáticamente
4. Carga datos del manifiesto
5. Continuar con operación (retiro/entrega)

### Fallback Manual

Si el QR no es legible:
- Ingresar número de manifiesto manualmente
- Sistema busca en base local o servidor

---

## 5.9 Modo Offline (CU-T09)

📱 ![Modo Offline](screenshots/mobile/transportista_offline.png)

### Funcionamiento Sin Conexión

| Característica | Descripción |
|----------------|-------------|
| **Base local** | Datos cifrada en dispositivo |
| **Validaciones** | Ejecutan contra caché local |
| **GPS** | Captura independiente de red |
| **Cola de sync** | Operaciones pendientes |
| **Auto-sync** | Background al recuperar red |

### Indicador Visual

- 🟢 Online: Sincronizado
- 🟡 Sincronizando: Enviando datos
- 🔴 Offline: Trabajando localmente

---

## 5.10 Historial de Viajes (CU-T10)

📱 ![Historial Viajes](screenshots/mobile/transportista_historial.png)

### Información del Historial

- Lista de todos los viajes realizados
- Filtros por fecha y estado
- Detalle con ruta GPS completa
- Tiempos de cada etapa
- Incidentes registrados

---

## 5.11 Gestionar Flota (CU-T11)

📱 ![Gestionar Flota](screenshots/mobile/transportista_flota.png)

### Vehículos Registrados

- Patente y tipo
- Estado de habilitación
- Próximo vencimiento
- Asignación actual

---

# 6. ROL OPERADOR

El Operador de Tratamiento gestiona la recepción, pesaje, tratamiento y cierre de manifiestos en la planta.

## 6.1 Inicio de Sesión (CU-O01)

Similar al proceso de otros roles, con autenticación 2FA.

---

## 6.2 Manifiestos Entrantes (CU-O02)

![Manifiestos Entrantes](screenshots/desktop/operador_entrantes.png)

### Panel de Entregas Pendientes

| Columna | Descripción |
|---------|-------------|
| N° Manifiesto | Identificador |
| Generador | Origen de la carga |
| Transportista | Empresa y chofer |
| Tipo de Residuo | Categoría Y |
| ETA | Tiempo estimado de llegada |
| Ubicación | Mapa con posición actual |

---

## 6.3 Recepción QR - Modo Offline (CU-O03)

📱 ![Recepción QR](screenshots/mobile/operador_recepcion.png)

### Proceso en Garita

1. Transporte llega a planta
2. Operador escanea QR del manifiesto
3. App valida contra lista de "Esperados" (funciona offline)
4. Registra hora de ingreso
5. Deriva a báscula para pesaje

---

## 6.4 Registro de Pesaje (CU-O04)

![Registro Pesaje](screenshots/desktop/operador_pesaje.png)

### Proceso de Pesaje

1. Sistema muestra **cantidad declarada** en manifiesto
2. Operador ingresa **peso real** de báscula
3. Sistema calcula **diferencia porcentual**
4. Si diferencia > umbral, solicita justificación
5. Adjuntar ticket de báscula (opcional)

### Umbrales de Alerta

| Diferencia | Acción |
|------------|--------|
| < 5% | Registro normal |
| 5-10% | Justificación requerida |
| > 10% | Alerta a DGFA |

---

## 6.5 Registrar Diferencias (CU-O05)

![Registrar Diferencias](screenshots/desktop/operador_diferencias.png)

### Tipos de Diferencias

| Tipo | Descripción |
|------|-------------|
| Faltante | Peso real menor al declarado |
| Excedente | Peso real mayor al declarado |
| Tipo incorrecto | Residuo diferente al declarado |

### Documentación Requerida

- Descripción detallada
- Fotografías de evidencia
- Firma del responsable

---

## 6.6 Rechazar Carga (CU-O06)

![Rechazar Carga](screenshots/desktop/operador_rechazo.png)

### Motivos de Rechazo

| Motivo | Descripción |
|--------|-------------|
| No coincide | Tipo de residuo diferente |
| Contaminado | Mezcla no autorizada |
| Sin documentación | Falta documentación requerida |
| Cantidad excedida | Supera capacidad autorizada |
| Otro | Motivo específico |

### Proceso

1. Seleccionar motivo
2. Ingresar descripción detallada
3. Capturar fotografías
4. Confirmar rechazo
5. Sistema notifica a todas las partes
6. Carga debe retornar al origen

---

## 6.7 Firma de Recepción Conforme (CU-O07)

![Firma Recepción](screenshots/desktop/operador_firma_recepcion.png)

### Proceso

1. Sistema presenta resumen de recepción
2. Verificar datos de pesaje
3. Aceptar términos de recepción
4. Ingresar token de seguridad
5. Aplicar firma electrónica
6. Estado cambia a "Recibido - Pendiente Tratamiento"

---

## 6.8 Registrar Tratamiento (CU-O08)

![Registrar Tratamiento](screenshots/desktop/operador_tratamiento.png)

### Métodos Disponibles

| Código | Método | Descripción |
|--------|--------|-------------|
| D10 | Incineración | Destrucción térmica |
| D5 | Celda de seguridad | Disposición final |
| D9 | Físico-químico | Neutralización |
| R1-R10 | Reciclaje | Recuperación |

### Registro

- Seleccionar método del catálogo
- Sistema valida autorización para el tipo de residuo
- Ingresar fecha de tratamiento
- Agregar observaciones

---

## 6.9 Cerrar Manifiesto (CU-O09)

![Cerrar Manifiesto](screenshots/desktop/operador_cierre.png)

### Verificación Previa

El sistema verifica que todos los pasos estén completos:
- ✅ Recepción confirmada
- ✅ Pesaje registrado
- ✅ Diferencias documentadas (si aplica)
- ✅ Tratamiento registrado

### Proceso de Cierre

1. Confirmar finalización del proceso
2. Aplicar firma electrónica de cierre
3. Estado cambia a "Cerrado"
4. Se genera certificado automáticamente
5. Todas las partes son notificadas

---

## 6.10 Certificado de Disposición (CU-O10)

![Certificado](screenshots/desktop/operador_certificado.png)

### Contenido del Certificado

| Sección | Información |
|---------|-------------|
| Encabezado | N° certificado, fecha |
| Generador | Datos completos |
| Residuo | Tipo, cantidad, peligrosidad |
| Transporte | Datos del traslado |
| Tratamiento | Método aplicado, fecha |
| Firmas | Todas las firmas digitales |

### Distribución

- PDF descargable
- Copia automática al generador
- Archivo en sistema para auditoría

---

## 6.11 Historial de Recepciones (CU-O11)

![Historial Recepciones](screenshots/desktop/operador_historial.png)

### Filtros

- Por fecha
- Por generador
- Por tipo de residuo
- Por estado

---

## 6.12 Reportes del Operador (CU-O12)

![Reportes Operador](screenshots/desktop/operador_reportes.png)

### Tipos de Reportes

- Residuos recibidos por período
- Tratamientos aplicados
- Por tipo de generador
- Estadísticas de rechazo

---

# 7. APP MÓVIL PWA

## 7.1 Instalación en Android

📱 ![Instalación Android](screenshots/mobile/pwa_install_android.png)

### Pasos

1. Abrir Chrome en el dispositivo
2. Navegar a la URL del sistema
3. Esperar prompt de instalación (o menú → "Agregar a pantalla de inicio")
4. Confirmar instalación
5. El icono aparece en el escritorio
6. La app funciona como nativa

---

## 7.2 Instalación en iOS

📱 ![Instalación iOS](screenshots/mobile/pwa_install_ios.png)

### Pasos

1. Abrir Safari
2. Navegar a la URL del sistema
3. Tap en botón "Compartir" (□↑)
4. Seleccionar "Agregar a pantalla de inicio"
5. Confirmar con "Agregar"
6. El icono aparece en el escritorio

---

## 7.3 Funcionalidades Offline

📱 ![Modo Offline](screenshots/mobile/pwa_offline.png)

### Operaciones Disponibles Sin Conexión

| Rol | Operaciones Offline |
|-----|---------------------|
| Transportista | Retiro, Incidentes, Entrega |
| Operador | Recepción QR en garita |

### Sincronización Automática

- Al recuperar conexión, los datos se sincronizan automáticamente
- Indicador visual muestra estado de sincronización
- Resolución automática de conflictos (prioridad servidor)

---

## 7.4 Escaneo QR

📱 ![Escaneo QR](screenshots/mobile/pwa_qr.png)

### Uso

1. Tap en "Escanear QR"
2. Permitir acceso a cámara
3. Enfocar código QR
4. Auto-detección y carga de datos

---

## 7.5 GPS y Tracking

📱 ![GPS Tracking](screenshots/mobile/pwa_gps.png)

### Características

- Captura de coordenadas independiente de red
- Tracking periódico durante transporte
- Registro de ruta completa
- Cálculo de ETA

---

# 8. FLUJO COMPLETO DEL MANIFIESTO

## 8.1 Diagrama del Ciclo de Vida

```
┌─────────────────────────────────────────────────────────────────┐
│                      CICLO DEL MANIFIESTO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GENERADOR                TRANSPORTISTA              OPERADOR    │
│  ─────────                ─────────────              ────────    │
│                                                                   │
│  ┌──────────┐                                                    │
│  │ 1. Crear │                                                    │
│  │ Borrador │                                                    │
│  └────┬─────┘                                                    │
│       │                                                          │
│  ┌────▼─────┐                                                    │
│  │ 2. Firma │                                                    │
│  │ Digital  │──────────────┐                                     │
│  └──────────┘              │                                     │
│                            ▼                                     │
│                      ┌──────────┐                                │
│                      │ 3. Retiro│                                │
│                      │ + Firma  │                                │
│                      └────┬─────┘                                │
│                           │                                      │
│                      ┌────▼─────┐                                │
│                      │ 4. Viaje │                                │
│                      │ GPS Track│                                │
│                      └────┬─────┘                                │
│                           │                                      │
│                      ┌────▼─────┐                                │
│                      │ 5. Entrega│───────────┐                   │
│                      │ + Firma   │           │                   │
│                      └───────────┘           ▼                   │
│                                        ┌──────────┐              │
│                                        │ 6. Recep.│              │
│                                        │ + Pesaje │              │
│                                        └────┬─────┘              │
│                                             │                    │
│                                        ┌────▼─────┐              │
│                                        │ 7. Firma │              │
│                                        │ Recepción│              │
│                                        └────┬─────┘              │
│                                             │                    │
│                                        ┌────▼─────┐              │
│                                        │8. Tratam.│              │
│                                        │ Residuos │              │
│                                        └────┬─────┘              │
│                                             │                    │
│                                        ┌────▼─────┐              │
│                                        │ 9. Cierre│              │
│                                        │ + Certif.│              │
│                                        └──────────┘              │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 8.2 Estados del Manifiesto

| Estado | Actor Responsable | Siguiente Paso |
|--------|-------------------|----------------|
| Borrador | Generador | Completar y firmar |
| Firmado | Generador | Esperar retiro |
| Retirado | Transportista | Iniciar viaje |
| En Tránsito | Transportista | Entregar |
| Entregado | Transportista | Esperar recepción |
| Recibido | Operador | Procesar |
| En Tratamiento | Operador | Cerrar |
| Cerrado | Operador | - (Final) |
| Rechazado | Operador | Retorno a origen |

---

# 9. ANEXOS

## 9.1 Casos de Uso Cubiertos

### ADMINISTRADOR (15 CU)
- CU-A01 a CU-A15 ✅

### GENERADOR (12 CU)
- CU-G01 a CU-G12 ✅

### TRANSPORTISTA (11 CU)
- CU-T01 a CU-T11 ✅

### OPERADOR (12 CU)
- CU-O01 a CU-O12 ✅

### SISTEMA (11 CU)
- CU-S01 a CU-S11 ✅ (Procesos automáticos)

**Total: 61 Casos de Uso**

## 9.2 Glosario Técnico

| Término | Definición |
|---------|------------|
| **RRPP** | Residuos Peligrosos |
| **DGFA** | Dirección de Gestión y Fiscalización Ambiental |
| **Manifiesto** | Documento que acredita el traslado de RRPP |
| **PWA** | Progressive Web App - Aplicación web instalable |
| **Offline-First** | Arquitectura que prioriza funcionamiento sin conexión |
| **2FA** | Autenticación de dos factores |
| **QR** | Código de respuesta rápida |
| **GPS** | Sistema de posicionamiento global |
| **ETA** | Tiempo estimado de llegada |

## 9.3 Ley 24.051 - Categorías Y

Las categorías Y definen los tipos de residuos peligrosos según la legislación argentina.

## 9.4 Contacto de Soporte

**Soporte Técnico:**
- Email: soporte@example.com
- Teléfono: 0800-XXX-XXXX
- Horario: Lunes a Viernes 8:00 a 18:00

---

*Documento generado automáticamente - Versión 1.0 - Diciembre 2025*

*Sistema de Trazabilidad de Residuos Peligrosos - DGFA Mendoza*
