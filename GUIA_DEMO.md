# 🎯 GUÍA DE DEMOSTRACIÓN
## Sistema de Trazabilidad de Residuos Peligrosos
### DGFA Mendoza - Demo Interactiva

---

# 🌐 INICIO

**URL:** [https://www.ultimamilla.com.ar/demoambiente/](https://www.ultimamilla.com.ar/demoambiente/)

---

# 👤 CREDENCIALES

| Rol | Email | Contraseña |
|-----|-------|------------|
| 👨‍💼 Administrador | `admin@dgfa.mendoza.gov.ar` | `admin123` |
| 🏭 Generador | `quimica.mendoza@industria.com` | `gen123` |
| 🚛 Transportista | `transportes.andes@logistica.com` | `trans123` |
| ♻️ Operador | `tratamiento.residuos@planta.com` | `op123` |

---

# 🏭 FLUJO 1: GENERADOR DE RESIDUOS

## Paso 1.1 — Iniciar Sesión

| 🎯 ZONA DESTACADA | Formulario de login en el centro de la pantalla |
|-------------------|------------------------------------------------|
| **Acción** | Ingresar email y contraseña del Generador |
| **Credenciales** | `quimica.mendoza@industria.com` / `gen123` |
| **Click** | Botón **"Ingresar"** |

> **➡️ PRÓXIMO PASO:** Serás redirigido al Dashboard del Generador

---

## Paso 1.2 — Dashboard del Generador

| 🎯 ZONA DESTACADA | Panel central con contadores y accesos rápidos |
|-------------------|-----------------------------------------------|
| **Observar** | Contadores: Borradores, En Tránsito, Completados |
| **Observar** | Lista de últimos manifiestos con estados |

> **➡️ PRÓXIMO PASO:** Click en botón **"Nuevo Manifiesto"** o ícono **"+"** arriba a la derecha

---

## Paso 1.3 — Crear Nuevo Manifiesto

| 🎯 ZONA DESTACADA | Formulario de creación en el área principal |
|-------------------|---------------------------------------------|
| **Observar** | Datos del generador precargados automáticamente |
| **Acción** | Seleccionar tipo de residuo del desplegable |

**Tipos de residuo disponibles:**
- Y1 - Desechos clínicos
- Y8 - Aceites minerales usados
- Y12 - Tintas, colorantes, pinturas

> **➡️ PRÓXIMO PASO:** Ingresar cantidad (ej: `500`) y unidad (`kg`)

---

## Paso 1.4 — Asignar Transportista

| 🎯 ZONA DESTACADA | Selector de transportista en el formulario |
|-------------------|-------------------------------------------|
| **Acción** | Click en desplegable "Transportista" |
| **Seleccionar** | "Transportes Andes SRL" |
| **Observar** | Ver datos de habilitación y vehículos |

> **➡️ PRÓXIMO PASO:** Seleccionar el Operador destino

---

## Paso 1.5 — Asignar Operador Destino

| 🎯 ZONA DESTACADA | Selector de operador debajo del transportista |
|-------------------|----------------------------------------------|
| **Acción** | Click en desplegable "Operador" |
| **Seleccionar** | "Planta de Tratamiento Mendoza" |
| **Observar** | Métodos de tratamiento autorizados |

> **➡️ PRÓXIMO PASO:** Click en **"Guardar"** o **"Firmar y Enviar"**

---

## Paso 1.6 — Firmar Manifiesto

| 🎯 ZONA DESTACADA | Modal de confirmación de firma |
|-------------------|-------------------------------|
| **Observar** | Resumen completo del manifiesto |
| **Acción** | Confirmar datos correctos |
| **Click** | Botón **"Firmar y Enviar"** |

**Resultado:**
- ✅ Manifiesto firmado digitalmente
- ✅ Código QR generado
- ✅ Transportista notificado automáticamente
- ✅ Estado: "Pendiente de Retiro"

> **➡️ PRÓXIMO PASO:** Cerrar sesión → Ingresar como Transportista

---

# 🚛 FLUJO 2: TRANSPORTISTA

## Paso 2.1 — Iniciar Sesión como Transportista

| 🎯 ZONA DESTACADA | Formulario de login |
|-------------------|---------------------|
| **Acción** | Cerrar sesión actual (menú usuario arriba derecha) |
| **Credenciales** | `transportes.andes@logistica.com` / `trans123` |
| **Click** | Botón **"Ingresar"** |

> **➡️ PRÓXIMO PASO:** Ver manifiestos asignados en el Dashboard

---

## Paso 2.2 — Ver Manifiestos Asignados

| 🎯 ZONA DESTACADA | Lista de manifiestos en el panel central |
|-------------------|------------------------------------------|
| **Observar** | Manifiestos pendientes de retiro |
| **Observar** | Datos: N° Manifiesto, Generador, Tipo, Dirección |
| **Click** | En el manifiesto recién creado |

> **➡️ PRÓXIMO PASO:** Ver detalle y confirmar retiro

---

## Paso 2.3 — Confirmar Retiro en Origen

| 🎯 ZONA DESTACADA | Detalle del manifiesto y botones de acción |
|-------------------|-------------------------------------------|
| **Observar** | Datos completos del manifiesto |
| **Acción** | Verificar bultos y cantidades |
| **Click** | Botón **"Confirmar Retiro"** |

**El sistema automáticamente:**
- 📍 Captura ubicación GPS
- ⏰ Registra hora de retiro
- ✍️ Solicita firma del generador

> **➡️ PRÓXIMO PASO:** Iniciar el transporte

---

## Paso 2.4 — Iniciar Transporte

| 🎯 ZONA DESTACADA | Botón de inicio de viaje |
|-------------------|-------------------------|
| **Click** | Botón **"Iniciar Viaje"** |
| **Observar** | Confirmación de activación GPS |

**Resultado:**
- ✅ Estado: "En Tránsito"
- ✅ Tracking GPS activado
- ✅ Generador y Operador notificados
- ✅ ETA calculado automáticamente

> **➡️ PRÓXIMO PASO:** Simular llegada y confirmar entrega

---

## Paso 2.5 — Confirmar Entrega en Destino

| 🎯 ZONA DESTACADA | Botón de entrega en detalle del manifiesto |
|-------------------|-------------------------------------------|
| **Acción** | Simular arribo a planta del operador |
| **Click** | Botón **"Confirmar Entrega"** |
| **Observar** | Sistema verifica ubicación GPS |

**Resultado:**
- ✅ Hora de llegada registrada
- ✅ Estado: "Entregado - Pendiente Recepción"
- ✅ Operador notificado

> **➡️ PRÓXIMO PASO:** Cerrar sesión → Ingresar como Operador

---

# ♻️ FLUJO 3: OPERADOR DE TRATAMIENTO

## Paso 3.1 — Iniciar Sesión como Operador

| 🎯 ZONA DESTACADA | Formulario de login |
|-------------------|---------------------|
| **Acción** | Cerrar sesión actual |
| **Credenciales** | `tratamiento.residuos@planta.com` / `op123` |
| **Click** | Botón **"Ingresar"** |

> **➡️ PRÓXIMO PASO:** Ver manifiestos entrantes

---

## Paso 3.2 — Ver Manifiestos Entrantes

| 🎯 ZONA DESTACADA | Lista de manifiestos en panel central |
|-------------------|--------------------------------------|
| **Observar** | Manifiestos recién entregados |
| **Observar** | Estado "Entregado - Pendiente Recepción" |
| **Click** | En el manifiesto a procesar |

> **➡️ PRÓXIMO PASO:** Iniciar proceso de recepción

---

## Paso 3.3 — Iniciar Recepción

| 🎯 ZONA DESTACADA | Detalle del manifiesto con acciones |
|-------------------|-----------------------------------|
| **Observar** | Datos del generador y transportista |
| **Observar** | Tipo y cantidad declarada |
| **Click** | Botón **"Iniciar Recepción"** |

**Funcionalidad destacada:**
- 📱 Escaneo de QR disponible
- 📡 Modo offline: valida contra lista de "Esperados"

> **➡️ PRÓXIMO PASO:** Registrar pesaje

---

## Paso 3.4 — Registrar Pesaje

| 🎯 ZONA DESTACADA | Formulario de pesaje |
|-------------------|---------------------|
| **Observar** | Cantidad declarada por generador |
| **Acción** | Ingresar peso real (ej: `498 kg`) |
| **Observar** | Sistema calcula diferencia (0.4%) |

**Si diferencia > 5%:** Sistema solicita justificación

> **➡️ PRÓXIMO PASO:** Firmar recepción conforme

---

## Paso 3.5 — Firmar Recepción Conforme

| 🎯 ZONA DESTACADA | Resumen de recepción y botón de firma |
|-------------------|--------------------------------------|
| **Observar** | Resumen completo de la recepción |
| **Acción** | Verificar datos correctos |
| **Click** | Botón **"Firmar Recepción"** |

**Resultado:**
- ✅ Recepción firmada electrónicamente
- ✅ Estado: "Recibido - Pendiente Tratamiento"
- ✅ Generador notificado

> **➡️ PRÓXIMO PASO:** Registrar tratamiento aplicado

---

## Paso 3.6 — Registrar Tratamiento

| 🎯 ZONA DESTACADA | Selector de método de tratamiento |
|-------------------|----------------------------------|
| **Click** | Desplegable "Método de Tratamiento" |
| **Seleccionar** | Método autorizado (ej: "Incineración controlada") |
| **Acción** | Ingresar fecha y observaciones |
| **Click** | Botón **"Guardar Tratamiento"** |

> **➡️ PRÓXIMO PASO:** Cerrar el manifiesto definitivamente

---

## Paso 3.7 — Cerrar Manifiesto (PASO FINAL)

| 🎯 ZONA DESTACADA | Botón de cierre definitivo |
|-------------------|---------------------------|
| **Observar** | Sistema verifica pasos completos |
| **Click** | Botón **"Cerrar Manifiesto"** |
| **Acción** | Confirmar firma electrónica |

**🎉 RESULTADO FINAL:**
- ✅ **Estado: "CERRADO"**
- ✅ Certificado de disposición generado
- ✅ Trazabilidad completa del residuo
- ✅ Todas las partes notificadas
- ✅ Ciclo de vida completado

---

# 👨‍💼 FLUJO EXTRA: ADMINISTRADOR DGFA

## Panel de Supervisión

| 🎯 ZONA DESTACADA | Dashboard ejecutivo completo |
|-------------------|------------------------------|
| **Credenciales** | `admin@dgfa.mendoza.gov.ar` / `admin123` |

### Funciones disponibles:

| Módulo | Ubicación | Descripción |
|--------|-----------|-------------|
| **Dashboard** | Página inicial | KPIs y métricas en tiempo real |
| **Tracking** | Menú lateral | Mapa GPS de transportes activos |
| **Actores** | Menú lateral | Gestión de Generadores/Transportistas/Operadores |
| **Alertas** | Menú lateral | Configurar reglas de notificación |
| **Reportes** | Menú lateral | Estadísticas y exportación |

---

# 🔑 PUNTOS CLAVE PARA DESTACAR

| # | Característica | Dónde Mostrarlo |
|---|----------------|-----------------|
| 1 | **Trazabilidad Completa** | Timeline de eventos en detalle de manifiesto |
| 2 | **Firma Electrónica** | Botones de firma en cada etapa |
| 3 | **GPS en Tiempo Real** | Mapa en Dashboard y Tracking |
| 4 | **Código QR** | PDF del manifiesto firmado |
| 5 | **Modo Offline** | Mencionar en retiro y recepción |
| 6 | **Alertas Automáticas** | Configuración de alertas (Admin) |
| 7 | **Auditoría Total** | Logs en Configuración (Admin) |

---

# ⏱️ TIEMPO ESTIMADO DE DEMO

| Flujo | Duración |
|-------|----------|
| Generador (crear y firmar) | ~3 minutos |
| Transportista (retiro y entrega) | ~2 minutos |
| Operador (recepción y cierre) | ~3 minutos |
| Admin (supervisión) | ~2 minutos |
| **TOTAL** | **~10 minutos** |

---

# 📋 CHECKLIST PRE-DEMO

- [ ] Verificar URL accesible: https://www.ultimamilla.com.ar/demoambiente/
- [ ] Tener credenciales a mano (esta guía)
- [ ] Verificar que hay manifiestos de ejemplo en el sistema
- [ ] Conexión a internet estable
- [ ] Navegador actualizado (Chrome/Firefox recomendado)

---

*Guía de Demostración - Sistema de Trazabilidad RRPP - DGFA Mendoza*
*Versión: Demo Diciembre 2025*
