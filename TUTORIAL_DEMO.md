# 🚀 TUTORIAL INTERACTIVO
## Sistema de Trazabilidad de Residuos Peligrosos - Demo DGFA Mendoza

---

## 🌐 ACCESO AL SISTEMA

**URL de Demo:** [https://www.ultimamilla.com.ar/demoambiente/](https://www.ultimamilla.com.ar/demoambiente/)

### Credenciales de Prueba

| Rol | Email | Contraseña | Funciones Principales |
|-----|-------|------------|----------------------|
| 👨‍💼 **Administrador DGFA** | `admin@dgfa.mendoza.gov.ar` | `admin123` | Supervisión total, gestión de usuarios, reportes |
| 🏭 **Generador** | `quimica.mendoza@industria.com` | `gen123` | Crear manifiestos, firmar, seguimiento |
| 🚛 **Transportista** | `transportes.andes@logistica.com` | `trans123` | Retiro, tracking GPS, entrega |
| ♻️ **Operador** | `tratamiento.residuos@planta.com` | `op123` | Recepción, pesaje, tratamiento, cierre |

---

# 📋 FLUJO COMPLETO DE TRABAJO

## El Ciclo de Vida de un Manifiesto

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  GENERADOR  │────▶│TRANSPORTISTA│────▶│  OPERADOR   │────▶│   CERRADO   │
│   Crea y    │     │  Retira y   │     │  Recibe y   │     │ Trazabilidad│
│   Firma     │     │  Transporta │     │   Trata     │     │  Completa   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

---

## 🎯 RECORRIDO 1: Administrador DGFA (Supervisión)

### Paso 1.1: Iniciar Sesión (CU-A01)
1. Ingresar a la URL del sistema
2. Email: `admin@dgfa.mendoza.gov.ar`
3. Contraseña: `admin123`
4. Click en **"Ingresar"**

### Paso 1.2: Dashboard Ejecutivo (CU-A02)
Una vez logueado, verá:
- 📊 **Contadores de manifiestos** por estado
- 🗺️ **Mapa en tiempo real** con transportes activos
- 🔔 **Alertas pendientes** de atención
- 📈 **Gráficos de tendencias** (últimos 30 días)

### Paso 1.3: Gestionar Usuarios (CU-A03/A04)
1. Menú lateral → **"Actores"**
2. Ver listado de Generadores, Transportistas, Operadores
3. Puede crear, editar o desactivar usuarios
4. Asignar roles y permisos específicos

### Paso 1.4: Monitoreo en Tiempo Real (CU-A09)
1. Menú lateral → **"Tracking"**
2. Ver mapa con ubicación GPS de transportes activos
3. Click en marcador para ver detalle del manifiesto
4. Identificar desvíos de ruta automáticamente

### Paso 1.5: Consultar Auditoría (CU-A10)
1. Menú lateral → **"Configuración"**
2. Ver registro de todas las operaciones
3. Filtrar por fecha, usuario, módulo
4. Exportar en PDF/CSV

### Paso 1.6: Configurar Alertas (CU-A13)
1. Menú lateral → **"Alertas"**
2. Definir reglas para notificaciones automáticas
3. Configurar umbrales (tiempo máximo de tránsito, etc.)
4. Asignar destinatarios y canales

---

## 🎯 RECORRIDO 2: Generador de Residuos (Creación)

### Paso 2.1: Iniciar Sesión (CU-G01)
1. Email: `quimica.mendoza@industria.com`
2. Contraseña: `gen123`
3. Click en **"Ingresar"**

### Paso 2.2: Dashboard del Generador (CU-G02)
Verá el resumen de sus manifiestos:
- 📝 Borradores pendientes
- ⏳ En proceso de firma
- 🚛 En tránsito
- ✅ Completados

### Paso 2.3: Crear Nuevo Manifiesto (CU-G03)
1. Click en **"Nuevo Manifiesto"** o ícono **"+"**
2. Los datos del generador se precargan automáticamente

### Paso 2.4: Seleccionar Tipo de Residuo (CU-G04)
1. Buscar en el catálogo (Ley 24.051)
2. Ver categorías Y (Y1-Y45)
3. Seleccionar el tipo específico
4. Ver características de peligrosidad

**Tipos de residuos disponibles en demo:**
- Y1 - Desechos clínicos
- Y2 - Desechos de producción farmacéutica
- Y3 - Desechos de medicamentos
- Y6 - Desechos con asbesto
- Y8 - Aceites minerales
- Y12 - Tintas, colorantes
- Y16 - Desechos fotográficos
- Y18 - Desechos de servicios industriales
- ...y más

### Paso 2.5: Ingresar Cantidad
1. Ingresar cantidad numérica
2. Seleccionar unidad (kg, litros, m³, unidades)
3. El sistema valida rangos permitidos

### Paso 2.6: Asignar Transportista (CU-G05)
1. Ver lista de transportistas habilitados
2. Filtrados por compatibilidad con el residuo
3. Ver datos de habilitación y vehículos
4. Seleccionar el transportista deseado

**Transportistas en demo:**
- Transportes Andes SRL
- Logística Mendoza SA

### Paso 2.7: Asignar Operador Destino (CU-G06)
1. Ver lista de operadores habilitados
2. Filtrados por tipo de residuo que pueden tratar
3. Ver métodos de tratamiento autorizados
4. Seleccionar destino

**Operadores en demo:**
- Planta de Tratamiento Mendoza
- EcoTratamiento SA

### Paso 2.8: Firmar Manifiesto (CU-G07)
1. Revisar todos los datos
2. Click en **"Firmar y Enviar"**
3. Confirmar con contraseña
4. ✅ Manifiesto firmado y QR generado
5. 📧 Transportista notificado automáticamente

### Paso 2.9: Seguimiento (CU-G08)
1. Ver estado del manifiesto en tiempo real
2. Tracking GPS cuando está en tránsito
3. Timeline de eventos
4. Descargar PDF con QR (CU-G10)

---

## 🎯 RECORRIDO 3: Transportista (Logística)

### Paso 3.1: Iniciar Sesión (CU-T01)
1. Email: `transportes.andes@logistica.com`
2. Contraseña: `trans123`
3. Click en **"Ingresar"**
4. El sistema sincroniza manifiestos asignados

### Paso 3.2: Ver Manifiestos Asignados (CU-T02)
El dashboard muestra:
- 📋 Manifiestos pendientes de retiro
- 🚛 En tránsito actualmente
- ✅ Completados hoy

### Paso 3.3: Confirmar Retiro en Origen (CU-T03)
1. Seleccionar manifiesto pendiente
2. Verificar datos y cantidades
3. Click en **"Confirmar Retiro"**
4. 📍 GPS captura ubicación automáticamente
5. ✍️ Firma del generador en pantalla
6. 📷 Foto de evidencia (opcional)

**Modo Offline:** Si no hay conexión, la operación se guarda localmente y sincroniza después.

### Paso 3.4: Iniciar Transporte (CU-T04)
1. Click en **"Iniciar Viaje"**
2. Sistema activa tracking GPS
3. Estado cambia a "En Tránsito"
4. ⚡ Generador y Operador notificados

### Paso 3.5: Actualizar Estado en Tránsito (CU-T05)
Durante el viaje puede registrar:
- ⏸️ Paradas programadas
- ⏰ Demoras
- 🔄 Cambio de conductor
- 📍 Cada evento con GPS

### Paso 3.6: Registrar Incidente (CU-T06)
Si ocurre algún problema:
1. Click en **"Reportar Incidente"**
2. Seleccionar tipo (accidente, derrame, etc.)
3. Descripción detallada
4. Fotografías del evento
5. 🚨 DGFA alertada inmediatamente

### Paso 3.7: Confirmar Entrega (CU-T07)
1. Arribar a la planta del operador
2. Sistema verifica GPS vs dirección destino
3. Click en **"Confirmar Entrega"**
4. Operador escanea QR o confirma con código
5. ✅ Estado: "Entregado - Pendiente Recepción"

### Paso 3.8: Escanear QR (CU-T08)
- Escanear código QR del manifiesto físico
- Carga automática de todos los datos
- Verificación de autenticidad

---

## 🎯 RECORRIDO 4: Operador de Tratamiento (Disposición)

### Paso 4.1: Iniciar Sesión (CU-O01)
1. Email: `tratamiento.residuos@planta.com`
2. Contraseña: `op123`
3. Click en **"Ingresar"**

### Paso 4.2: Ver Manifiestos Entrantes (CU-O02)
Dashboard muestra:
- 🚚 En camino a la planta (con ETA)
- 📥 Listos para recepción
- ⚖️ Pendientes de pesaje
- ✅ Procesados

### Paso 4.3: Recepción con QR (CU-O03)
1. Transporte arriba a la planta
2. Escanear QR del manifiesto
3. Sistema valida integridad
4. **Modo Offline:** Valida contra lista de "Esperados"
5. Click en **"Iniciar Recepción"**

### Paso 4.4: Registrar Pesaje (CU-O04)
1. Sistema muestra cantidad declarada
2. Ingresar peso real de báscula
3. Sistema calcula diferencia
4. Si hay discrepancia > 5%, requiere justificación
5. Adjuntar ticket de báscula (opcional)

### Paso 4.5: Manejar Diferencias (CU-O05)
Si hay diferencias significativas:
1. Documentar faltante o excedente
2. Ingresar explicación
3. Fotografías de evidencia
4. Sistema notifica a partes

### Paso 4.6: Rechazar Carga (CU-O06)
Si corresponde:
1. Seleccionar motivo del rechazo
2. Documentar con fotos
3. Sistema notifica a todos
4. Transportista debe retornar carga

### Paso 4.7: Firmar Recepción Conforme (CU-O07)
1. Revisar resumen de recepción
2. Aceptar términos
3. Firmar electrónicamente
4. ✅ Estado: "Recibido - Pendiente Tratamiento"
5. 📧 Generador notificado

### Paso 4.8: Registrar Tratamiento (CU-O08)
1. Seleccionar método de tratamiento
2. Sistema valida autorización
3. Registrar fecha y detalles
4. Documentar proceso

**Métodos disponibles:**
- Incineración controlada
- Neutralización química
- Encapsulamiento
- Relleno de seguridad
- Tratamiento biológico

### Paso 4.9: Cerrar Manifiesto (CU-O09)
1. Verificar que todos los pasos estén completos
2. Click en **"Cerrar Manifiesto"**
3. Firmar electrónicamente
4. ✅ Estado: **"CERRADO"**
5. 📜 Certificado de disposición generado (CU-O10)
6. 🎉 **Trazabilidad completa**

---

# 🔧 FUNCIONES ADICIONALES

## Sistema de Alertas Automáticas (CU-S03, CU-S08)
- ⚠️ Vencimiento de manifiestos
- 🚨 Desvíos de ruta detectados
- ⏰ Tiempos excesivos de transporte
- 📉 Diferencias de carga significativas

## Modo Offline (CU-T09, CU-S05)
- App funciona sin conexión
- Datos se sincronizan automáticamente
- Resolución de conflictos transparente
- Service Worker para operación continua

## Reportes y Exportación (CU-A11, CU-A12)
- Reportes estadísticos personalizables
- Exportación en PDF, CSV, XML
- Filtros por período, actor, residuo
- Gráficos de tendencias

## Auditoría Completa (CU-S04)
- Registro de todas las operaciones
- Datos antes/después de cambios
- IP y User Agent registrados
- Inmutable para cumplimiento legal

---

# 📱 FLUJO VISUAL PASO A PASO

## 1️⃣ Crear Manifiesto (Generador)
```
Login → Dashboard → [+ Nuevo] → Seleccionar Residuo → 
Cantidad → Transportista → Operador → Revisar → Firmar → 
✅ QR Generado
```

## 2️⃣ Retiro y Transporte (Transportista)
```
Login → Ver Asignados → Seleccionar → Confirmar Retiro → 
Iniciar Viaje → [GPS Activo] → Confirmar Entrega → ✅
```

## 3️⃣ Recepción y Tratamiento (Operador)
```
Login → Ver Entrantes → Escanear QR → Pesar → 
Firmar Recepción → Registrar Tratamiento → 
Cerrar Manifiesto → ✅ Certificado Generado
```

---

# 🎓 PUNTOS CLAVE PARA LA DEMO

1. **Trazabilidad Completa**: Desde la generación hasta la disposición final
2. **Firma Electrónica**: Validación legal en cada etapa
3. **GPS en Tiempo Real**: Ubicación exacta del transporte
4. **Modo Offline**: Operación sin interrupciones
5. **Alertas Automáticas**: Detección proactiva de anomalías
6. **Auditoría Total**: Cumplimiento normativo garantizado
7. **QR Universal**: Verificación instantánea en cualquier punto

---

## 📞 Soporte

**Repositorio:** [github.com/martinsantos/peliresi](https://github.com/martinsantos/peliresi)

**Fecha de Demo:** Diciembre 2025

---

*Este tutorial cubre los casos de uso CU-A01 a CU-A15, CU-G01 a CU-G12, CU-T01 a CU-T11, CU-O01 a CU-O12, y CU-S01 a CU-S09 según especificación DGFA Mendoza.*
