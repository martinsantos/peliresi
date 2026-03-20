# SITREP — Manual del Sistema

## Sistema de Trazabilidad de Residuos Peligrosos

**Version 2026.3** | Direccion General de Fiscalizacion Ambiental | Provincia de Mendoza, Argentina

---

**Documento:** Manual Integral del Sistema SITREP
**Fecha de emision:** Febrero 2026
**Clasificacion:** Uso interno — Gobierno de Mendoza / Actores registrados
**Contacto tecnico:** Equipo SITREP — Ultima Milla S.A.

---

## Tabla de Contenidos

1. [Vision General](#1-vision-general)
2. [Guia Rapida por Rol](#2-guia-rapida-por-rol)
3. [Modulos del Sistema](#3-modulos-del-sistema)
   - 3.10 [Certificacion Blockchain](#310-certificacion-blockchain)
4. [Aplicacion Movil (PWA)](#4-aplicacion-movil-pwa)
5. [Arquitectura y Datos](#5-arquitectura-y-datos)
6. [Referencia de Workflow](#6-referencia-de-workflow)
7. [Anexo: Casos de Uso](#7-anexo-casos-de-uso)

---

## 1. VISION GENERAL

### 1.1 Que es SITREP

SITREP (Sistema de Trazabilidad de Residuos Peligrosos) es una plataforma web y movil desarrollada para la Provincia de Mendoza que permite el seguimiento integral del ciclo de vida de los residuos peligrosos, desde su generacion hasta su tratamiento y disposicion final.

El sistema digitaliza el proceso que anteriormente se gestionaba mediante manifiestos en papel, proporcionando:

- **Trazabilidad completa:** Cada manifiesto se rastrea en tiempo real a traves de todos sus estados, desde la creacion hasta el cierre con certificado de disposicion.
- **Seguimiento GPS en tiempo real:** Los viajes de transporte se monitorean con actualizaciones cada 30 segundos, incluyendo deteccion automatica de anomalias.
- **Centro de Control operativo:** Una sala de situacion digital donde la autoridad ambiental puede supervisar todas las operaciones activas de forma simultanea.
- **Generacion automatica de documentos:** Manifiestos en formato PDF, codigos QR para verificacion en campo, y certificados de disposicion final.
- **Reportes y estadisticas:** Ocho modulos de reportes con graficos interactivos, mapas coropleticos por departamento y exportacion CSV.
- **Certificacion blockchain:** Registro inmutable de manifiestos en Ethereum para garantizar la integridad de los datos.
- **Aplicacion movil (PWA):** Acceso desde cualquier dispositivo, con soporte offline para transportistas en zonas sin cobertura.

SITREP atiende a cuatro tipos de actores del ecosistema de gestion de residuos peligrosos y se despliega como una solucion integral que reemplaza al circuito administrativo tradicional.

### 1.2 Marco Legal

SITREP se enmarca dentro de la siguiente normativa vigente:

| Norma | Descripcion | Relacion con SITREP |
|-------|-------------|---------------------|
| **Ley Nacional 24.051** | Regimen de desechos peligrosos | Define las categorias Y de residuos, los manifiestos de transporte y las obligaciones de generadores, transportistas y operadores |
| **Decreto 831/93** | Reglamentacion de la Ley 24.051 | Establece los requisitos del manifiesto, los plazos y los procedimientos de fiscalizacion |
| **Ley Provincial 5.917** | Adhesion de Mendoza a la Ley 24.051 | Asigna competencia a la DGFA como autoridad de aplicacion provincial |
| **Resolucion SAyDS 897/02** | Registro Nacional de Generadores y Operadores | Define formularios y procedimientos de inscripcion |

El sistema implementa los siguientes requisitos normativos de forma digital:

- Numeracion unica de manifiestos con formato `YYYY-NNNNNN` (ej: 2026-000147).
- Registro de los datos del generador, transportista, operador, tipo de residuo (categorias Y de la Ley 24.051), cantidades declaradas y efectivas.
- Firma digital del manifiesto por parte del generador.
- Generacion de codigo QR para verificacion en ruta.
- Certificado de disposicion final emitido por el operador al completar el tratamiento.
- Registro de auditoria de todas las transiciones de estado.

### 1.3 Actores del Sistema

SITREP define cinco actores, cuatro de los cuales corresponden a roles de usuario y uno al sistema automatico:

| Actor | Rol en SITREP | Descripcion | Permisos principales |
|-------|---------------|-------------|----------------------|
| **Administrador DGFA** | `ADMIN` | Funcionario de la Direccion General de Fiscalizacion Ambiental | Acceso total: gestion de usuarios, actores, catalogos, reportes, monitoreo en tiempo real, auditoria, configuracion del sistema |
| **Generador** | `GENERADOR` | Empresa o entidad que produce residuos peligrosos | Crear manifiestos, firmar/aprobar, asignar transportista y operador, consultar estado, descargar PDF, cancelar manifiestos propios |
| **Transportista** | `TRANSPORTISTA` | Empresa habilitada para el transporte de residuos peligrosos | Confirmar retiro, activar tracking GPS, registrar incidentes en ruta, confirmar entrega, escanear QR, gestionar flota (vehiculos y choferes) |
| **Operador** | `OPERADOR` | Planta de tratamiento y/o disposicion final habilitada | Confirmar recepcion, registrar pesaje, rechazar carga, registrar tratamiento, cerrar manifiesto, generar certificado de disposicion |
| **Sistema** | (automatico) | Procesos automaticos de SITREP | Generar numero de manifiesto, validar datos, enviar notificaciones, generar QR, calcular estadisticas, detectar anomalias GPS, registrar auditoria |

### 1.4 Acceso al Sistema

#### URLs de acceso

| Recurso | URL | Descripcion |
|---------|-----|-------------|
| Aplicacion web (desktop) | `https://sitrep.ultimamilla.com.ar/` | Interfaz principal para todos los roles |
| Aplicacion movil (PWA) | `https://sitrep.ultimamilla.com.ar/app/` | Version optimizada para dispositivos moviles |
| API REST | `https://sitrep.ultimamilla.com.ar/api/` | Punto de acceso para integraciones |
| Manual en linea | `https://sitrep.ultimamilla.com.ar/manual/` | Documentacion del sistema |

#### Credenciales de demostracion

El entorno de demostracion incluye cuentas preconfiguradas para cada rol:

| Rol | Email / Usuario | Contrasena | Notas |
|-----|----------------|------------|-------|
| Administrador DGFA | `admin@dgfa.mendoza.gov.ar` | (proporcionada al ingresar) | Acceso completo al sistema |
| Generador | `generador` (varias cuentas de prueba) | (proporcionada al ingresar) | Cada cuenta esta asociada a un generador especifico |
| Transportista | `transportista` (varias cuentas de prueba) | (proporcionada al ingresar) | Cada cuenta esta asociada a un transportista y sus vehiculos |
| Operador | `operador` (varias cuentas de prueba) | (proporcionada al ingresar) | Cada cuenta esta asociada a una planta operadora |

> **Nota:** En el entorno de demostracion, la aplicacion movil incluye un selector de usuarios en `/mobile/switch-user` que permite cambiar de rol rapidamente para explorar las funcionalidades de cada actor.

#### Requisitos del navegador

- Google Chrome 90+ (recomendado)
- Mozilla Firefox 90+
- Microsoft Edge 90+
- Safari 15+
- Navegador movil compatible con PWA (Chrome Android, Safari iOS)

---

## 2. GUIA RAPIDA POR ROL

### 2.1 Administrador DGFA — Primeros pasos

El administrador de la DGFA es el rol con acceso completo al sistema. Al ingresar por primera vez, se recomienda seguir este flujo:

1. **Iniciar sesion** en `https://sitrep.ultimamilla.com.ar/` con las credenciales de administrador.
2. **Revisar el Dashboard** (`/dashboard`): verificar los KPIs generales, la actividad reciente y las alertas activas.
3. **Acceder al Centro de Control** (`/centro-control`): comprobar que el badge LIVE este activo y revisar los viajes en curso en el mapa interactivo.
4. **Configurar catalogos** (`/admin/residuos` y `/admin/tratamientos`): verificar que las categorias de residuos (codigos Y de la Ley 24.051) y los tratamientos autorizados esten cargados correctamente.
5. **Gestionar actores**:
   - Ir a `/admin/actores/generadores` y verificar que los generadores esten registrados con sus datos de CUIT, domicilio y certificado ambiental.
   - Ir a `/admin/actores/transportistas` y verificar transportistas, vehiculos habilitados y choferes.
   - Ir a `/admin/actores/operadores` y verificar operadores con sus certificados y corrientes de residuos habilitadas (codigos Y).
6. **Crear usuarios** (`/admin/usuarios`): dar de alta a los usuarios del sistema asignando el rol correspondiente (GENERADOR, TRANSPORTISTA, OPERADOR).
7. **Configurar alertas** (`/alertas`): definir reglas de alerta para anomalias de transporte, manifiestos vencidos u otros eventos criticos.
8. **Revisar reportes** (`/reportes`): explorar las ocho pestanas de reportes para familiarizarse con la informacion disponible.
9. **Consultar la auditoria** (`/admin/auditoria`): verificar que los eventos del sistema se estan registrando correctamente.

### 2.2 Generador — Crear mi primer manifiesto

El generador es la empresa que origina los residuos peligrosos. Para crear un manifiesto:

1. **Iniciar sesion** con las credenciales de generador.
2. **Acceder al Dashboard** (`/dashboard`): revisar los manifiestos recientes y los accesos rapidos.
3. **Crear un nuevo manifiesto** haciendo clic en "Nuevo Manifiesto" o navegando a `/manifiestos/nuevo`.
4. **Completar el formulario multi-paso**:
   - **Paso 1 — Datos del generador:** Los datos se auto-completan a partir del perfil. Verificar CUIT, razon social, domicilio y numero de certificado ambiental.
   - **Paso 2 — Seleccion de residuos:** Elegir el tipo de residuo del catalogo (categoria Y), indicar cantidad estimada en kilogramos, estado fisico y tipo de envase.
   - **Paso 3 — Asignar transportista:** Seleccionar el transportista habilitado, el vehiculo y el chofer asignados.
   - **Paso 4 — Asignar operador destino:** Seleccionar la planta de tratamiento/disposicion final habilitada para la corriente de residuo seleccionada.
   - **Paso 5 — Revision y confirmacion:** Verificar todos los datos antes de guardar.
5. **Guardar el manifiesto** en estado BORRADOR.
6. **Firmar/Aprobar el manifiesto**: desde la pagina de detalle (`/manifiestos/:id`), hacer clic en "Firmar Manifiesto". Esto genera automaticamente el codigo QR y cambia el estado a APROBADO.
7. **Seguir el manifiesto**: una vez que el transportista confirme el retiro, el manifiesto pasara a EN_TRANSITO y se podra visualizar el recorrido en tiempo real en la seccion de detalle.
8. **Descargar el PDF** del manifiesto en cualquier momento desde el boton de descarga en la pagina de detalle.
9. **Recibir notificaciones** de cada cambio de estado a traves del icono de campana en la barra superior.

### 2.3 Transportista — Mi primer viaje

El transportista gestiona el retiro, transporte y entrega de los residuos:

1. **Iniciar sesion** desde la aplicacion movil (`https://sitrep.ultimamilla.com.ar/app/`) o la version desktop.
2. **Revisar manifiestos asignados** en el dashboard movil (`/mobile/dashboard`), que muestra un banner con el viaje activo si lo hay.
3. **Confirmar el retiro** del residuo: desde el detalle del manifiesto en estado APROBADO, hacer clic en "Confirmar Retiro". Esto cambia el estado a EN_TRANSITO.
4. **Activar el seguimiento GPS**: al confirmar el retiro, el sistema solicita permisos de geolocalizacion. Aceptar para que la posicion se envie automaticamente cada 30 segundos.
5. **Durante el transporte**:
   - El GPS se actualiza automaticamente en segundo plano.
   - Si necesita detenerse por una causa operativa, usar "Pausar Viaje" para registrar un incidente de tipo PAUSA.
   - Para reanudar, usar "Reanudar Viaje" (incidente de tipo REANUDACION).
   - Si ocurre un incidente (derrame, accidente, desvio), registrarlo con "Registrar Incidente" indicando tipo, descripcion y ubicacion.
6. **En zona sin cobertura**: las actualizaciones de GPS se almacenan localmente y se envian automaticamente cuando se recupera la conexion (cola de hasta 5 actualizaciones pendientes).
7. **Confirmar la entrega** al llegar a la planta del operador: hacer clic en "Confirmar Entrega". El estado cambia a ENTREGADO.
8. **Escanear QR** (opcional): usar el escaner QR (`/mobile/escaner-qr`) para verificar el manifiesto fisico contra el digital. Tiene opcion de ingreso manual como alternativa.
9. **Consultar el historial** de viajes completados en la pestana correspondiente.

### 2.4 Operador — Recibir y tratar residuos

El operador gestiona la recepcion, tratamiento y disposicion final:

1. **Iniciar sesion** con las credenciales de operador.
2. **Revisar manifiestos entrantes** en el dashboard o en la lista de manifiestos filtrada por estado ENTREGADO.
3. **Confirmar la recepcion** del residuo: desde el detalle del manifiesto en estado ENTREGADO, hacer clic en "Confirmar Recepcion". El estado cambia a RECIBIDO.
4. **Registrar el pesaje**: ingresar el peso real medido en planta. El sistema calcula automaticamente la diferencia respecto al peso declarado por el generador y registra el porcentaje de discrepancia.
5. **Si la carga no es conforme**: usar "Rechazar Carga" indicando el motivo. El estado cambia a RECHAZADO y se notifica al generador.
6. **Registrar el tratamiento**: una vez iniciado el proceso de tratamiento, hacer clic en "Registrar Tratamiento" indicando el tipo de tratamiento aplicado. El estado cambia a EN_TRATAMIENTO.
7. **Cerrar el manifiesto**: una vez completado el tratamiento, hacer clic en "Cerrar Manifiesto". El estado cambia a TRATADO y se habilita la generacion del certificado.
8. **Generar certificado de disposicion**: hacer clic en "Descargar Certificado" para generar el PDF del certificado de disposicion final. Este documento queda disponible para todos los actores involucrados en el manifiesto.
9. **Consultar reportes**: acceder a la seccion de reportes (`/reportes`) para ver estadisticas de residuos recibidos, tratados y certificados emitidos.

---

## 3. MODULOS DEL SISTEMA

### 3.1 Dashboard

El dashboard es la pagina principal tras el inicio de sesion y se adapta al rol del usuario.

**Dashboard desktop** (`/dashboard`):

- **KPIs principales:** Tarjetas con indicadores clave como total de manifiestos, manifiestos activos, residuos tratados (kg), viajes en curso.
- **Actividad reciente:** Lista cronologica de los ultimos eventos del sistema relevantes al usuario.
- **Acciones rapidas:** Botones directos a las funcionalidades mas frecuentes segun el rol (crear manifiesto para generadores, ver asignados para transportistas, etc.).
- **Graficos:** Resumen visual de tendencias recientes.

**Dashboard movil** (`/mobile/dashboard`):

- Version optimizada para pantallas pequenas con layout vertical.
- **Banner de viaje activo** (solo transportistas): muestra el manifiesto en transito con acceso directo al seguimiento GPS.
- KPIs en formato compacto.
- Accesos rapidos adaptados al rol.

### 3.2 Manifiestos

El modulo de manifiestos es el nucleo funcional del sistema.

#### 3.2.1 Lista de manifiestos (`/manifiestos`)

- Busqueda por numero de manifiesto, generador, transportista u operador.
- Filtros por estado del manifiesto (BORRADOR, APROBADO, EN_TRANSITO, etc.).
- Paginacion de resultados.
- Cada fila muestra: numero, fecha, generador, transportista, operador, estado (con badge de color) y acciones.

#### 3.2.2 Creacion de manifiesto (`/manifiestos/nuevo`)

Formulario de creacion multi-paso con cinco etapas:

| Paso | Titulo | Campos principales |
|------|--------|--------------------|
| 1 | Datos del Generador | CUIT, razon social, domicilio, certificado ambiental (auto-completados) |
| 2 | Residuos | Tipo de residuo (categoria Y), cantidad estimada (kg), estado fisico, tipo de envase, descripcion |
| 3 | Transportista | Seleccion de transportista habilitado, vehiculo, chofer |
| 4 | Operador Destino | Seleccion de planta de tratamiento habilitada para la corriente de residuo |
| 5 | Revision | Resumen completo de todos los datos antes de confirmar |

El formulario incluye:
- Auto-completado de datos del perfil del generador.
- Validacion en tiempo real de campos obligatorios.
- Selector con filtros para transportistas y operadores.
- Posibilidad de guardar como borrador y continuar despues.

#### 3.2.3 Detalle del manifiesto (`/manifiestos/:id`)

La pagina de detalle presenta:

- **Encabezado:** Numero de manifiesto, fecha de creacion, estado actual con badge de color.
- **Timeline de eventos:** Linea de tiempo visual con todos los cambios de estado, fechas, horas y actores responsables.
- **Datos del manifiesto:** Informacion completa del generador, residuos, transportista y operador.
- **Mapa GPS** (cuando aplica): Visualizacion del recorrido en tiempo real durante el transporte.
- **Acciones contextuales:** Mas de 10 botones de accion que se muestran u ocultan segun el estado actual y el rol del usuario (ver seccion 6.2).
- **Boton de descarga PDF:** Disponible en todos los estados.

#### 3.2.4 Workflow del manifiesto

El manifiesto transita por 10 estados posibles (ver seccion 6.1 para el diagrama completo). Cada transicion esta gobernada por el rol del usuario y genera automaticamente:

- Un evento en la timeline del manifiesto.
- Un registro de auditoria.
- Una notificacion a los actores involucrados.

#### 3.2.5 Descarga de PDF

SITREP genera dos tipos de documentos PDF mediante PDFKit en el backend:

1. **Manifiesto PDF:** Documento formal con todos los datos del manifiesto, codigo QR, firmas y datos de los actores.
2. **Certificado de disposicion final:** Generado unicamente cuando el manifiesto alcanza el estado TRATADO, incluye datos del tratamiento aplicado, peso final y fecha de cierre.

### 3.3 Centro de Control

El Centro de Control (`/centro-control`) es la sala de operaciones digital de la DGFA, disenada para la supervision en tiempo real de todas las operaciones de transporte activas.

**Caracteristicas principales:**

- **Badge LIVE:** Indicador visual permanente que confirma que la pantalla esta recibiendo datos en tiempo real.
- **5 KPIs en tiempo real:**
  - Manifiestos activos
  - Viajes en curso
  - Viajes completados hoy
  - Incidentes abiertos
  - Anomalias detectadas
- **Pipeline funnel:** Visualizacion en embudo de los manifiestos por estado, mostrando cuantos hay en cada etapa del flujo.
- **Mapa interactivo (Leaflet):** Muestra las posiciones actuales de todos los viajes activos con marcadores en tiempo real. Los viajes completados se muestran con el recorrido trazado.
- **Grafico de dona:** Distribucion de residuos por categoria.
- **Grafico de barras:** Volumen de operaciones por periodo.
- **Auto-refresh cada 30 segundos:** El sistema consulta automaticamente la API para actualizar todos los indicadores y posiciones del mapa.

**Capas de informacion:**

El Centro de Control organiza la informacion en capas que pueden activarse o desactivarse:
- Viajes activos
- Viajes completados
- Generadores
- Operadores
- Incidentes

### 3.4 Reportes

El modulo de reportes (`/reportes`) ofrece ocho pestanas de analisis:

| Pestana | Contenido | Visualizacion |
|---------|-----------|---------------|
| **Manifiestos** | Cantidad de manifiestos por periodo, estado y actor | Grafico de barras temporal, tabla con totales |
| **Residuos Tratados** | Volumen de residuos (kg) tratados por periodo y tipo | Grafico de barras apiladas por categoria Y |
| **Transporte** | Estadisticas de viajes: tiempos, distancias, incidentes | Grafico de lineas, tabla comparativa |
| **Generadores** | Ranking de generadores por volumen, cantidad de manifiestos | Tabla ordenable, grafico de barras horizontal |
| **Operadores** | Rendimiento de operadores: recepciones, tratamientos, tiempos | Tabla comparativa, grafico de barras |
| **Tratamientos** | Distribucion por tipo de tratamiento aplicado | Grafico de dona, tabla con porcentajes |
| **Departamentos** | Distribucion geografica de la actividad por departamento de Mendoza | Mapa coropletico interactivo con escala de color |
| **Mapa de Actores** | Ubicacion de todos los actores del sistema | Mapa Leaflet con clustering por tipo de actor |

Todas las pestanas incluyen:
- Filtros por periodo (fecha desde/hasta).
- Boton de exportacion CSV.
- Datos de demostracion precargados para visualizacion inmediata.

### 3.5 Tracking GPS

El sistema de seguimiento GPS es una de las funcionalidades centrales de SITREP para el monitoreo de transporte de residuos peligrosos.

#### Flujo tecnico

```
Telefono del transportista
    |
    v
watchPosition (navegador)
    |
    | cada 30 segundos
    v
POST /api/manifiestos/:id/ubicacion
    |
    v
Tabla tracking_gps (PostgreSQL)
    |
    | consulta cada 30s
    v
Centro de Control (mapa Leaflet)
```

#### Caracteristicas

- **Intervalo de actualizacion:** 30 segundos.
- **Capacidad actual:** 50 viajes simultaneos (aproximadamente 100 escrituras/minuto en base de datos).
- **Cache en memoria:** TTL de 30 segundos por manifiestoId para optimizar consultas del Centro de Control.
- **Pausa/Reanudacion:** El transportista puede pausar el tracking registrando un incidente de tipo PAUSA y reanudar con un incidente de tipo REANUDACION.
- **Resiliencia offline:**
  - Las actualizaciones fallidas se encolan en `pendingUpdatesRef` (maximo 5 actualizaciones).
  - La cola se persiste en `localStorage` del navegador.
  - Al recuperar conexion, las actualizaciones pendientes se envian automaticamente.

#### Deteccion de anomalias

El sistema detecta automaticamente las siguientes anomalias de transporte:

| Tipo de Anomalia | Criterio de deteccion | Severidad |
|------------------|----------------------|-----------|
| Exceso de velocidad | Velocidad superior a 120 km/h | Alta |
| Detencion prolongada | Parada superior a 2 horas | Media |
| Perdida de senal GPS | Sin actualizacion por mas de 30 minutos | Media |
| Transito excesivo | Viaje con duracion superior a 24 horas | Alta |
| Desvio de ruta | Desviacion significativa de la ruta esperada | Media |
| Ingreso a zona restringida | Vehiculo en area no autorizada | Alta |

Las anomalias generan alertas automaticas visibles en el Centro de Control y en el modulo de notificaciones.

### 3.6 Gestion de Actores

El modulo de gestion de actores (accesible solo para administradores) permite el alta, baja y modificacion de los tres tipos de actores del sistema.

#### 3.6.1 Vista unificada (`/admin/actores`)

Pagina resumen con acceso directo a las tres sub-secciones y estadisticas generales de actores registrados.

#### 3.6.2 Generadores (`/admin/actores/generadores`)

- **Listado paginado** con busqueda por CUIT o razon social.
- **Datos principales:** CUIT, razon social, domicilio, departamento, certificado ambiental, estado de habilitacion.
- **Enriquecimiento de datos:** Los datos estaticos de generadores se enriquecen desde constantes TypeScript indexadas por CUIT para busqueda O(1), fusionandose con los datos de la API.
- **CRUD completo:** Alta, edicion y baja de generadores.
- **Exportacion CSV** del listado completo.

> **Nota tecnica:** La base de datos contiene 1.224 registros de generadores con 13 campos por registro, provenientes del archivo `generadores-transformados.json`.

#### 3.6.3 Transportistas (`/admin/actores/transportistas`)

- **Listado paginado** con busqueda por CUIT o razon social.
- **Gestion de vehiculos:** Cada transportista puede tener multiples vehiculos asociados con patente, tipo, capacidad y estado de habilitacion.
- **Gestion de choferes:** Registro de choferes con DNI, licencia de conducir y habilitacion para transporte de residuos peligrosos.
- **CRUD completo** de transportistas, vehiculos y choferes.

#### 3.6.4 Operadores (`/admin/actores/operadores`)

- **Listado paginado** con busqueda por CUIT o razon social.
- **Certificados:** Cada operador puede tener uno o mas certificados con tipo (FIJO o IN SITU) y numero (ej: O-000056).
- **Corrientes de residuos (codigos Y):** Se registran las categorias de residuos que cada operador esta habilitado a recibir y tratar.
- **CRUD completo** de operadores.

> **Nota tecnica:** La base de datos contiene 47 registros de operadores con 15 campos, provenientes del archivo `operadores-reales.csv`. Existen dos empresas con certificados duales: IBS CORDOBA (O-000056 IN SITU + O-000088 FIJO) y AMBIENTAL MENDOZA (O-000080 FIJO + O-000105 IN SITU).

### 3.7 Catalogos y Configuracion

#### 3.7.1 Catalogo de Residuos (`/admin/residuos`)

Gestion de los tipos de residuos peligrosos segun las categorias Y de la Ley 24.051:

- Codigo Y (ej: Y1 — Desechos clinicos)
- Descripcion completa
- Estado activo/inactivo
- Asociacion con tratamientos autorizados

#### 3.7.2 Catalogo de Tratamientos (`/admin/tratamientos`)

Gestion de los tipos de tratamiento autorizados para residuos peligrosos:

- Codigo de tratamiento
- Descripcion del proceso
- Residuos admitidos
- Estado activo/inactivo

#### 3.7.3 Vehiculos (`/admin/vehiculos`)

Gestion centralizada de la flota de transporte:

- Patente, marca, modelo, anio
- Tipo de vehiculo
- Capacidad de carga (kg)
- Transportista asignado
- Estado de habilitacion
- Documentacion vigente

#### 3.7.4 Parametros del Sistema (`/configuracion`)

Configuracion de parametros operativos del sistema:

- Intervalos de actualizacion
- Limites de validacion
- Parametros de deteccion de anomalias
- Configuracion de notificaciones

### 3.8 Usuarios y Seguridad

#### 3.8.1 Gestion de Usuarios (`/admin/usuarios`)

- **CRUD completo:** Alta, edicion y baja de usuarios.
- **Asignacion de roles:** Cada usuario recibe uno de los cuatro roles (ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR).
- **Vinculacion con actores:** Los usuarios con rol GENERADOR, TRANSPORTISTA u OPERADOR se vinculan a su entidad correspondiente.
- **Estado de la cuenta:** Activa/Inactiva.

#### 3.8.2 Auditoria (`/admin/auditoria`)

El log de auditoria registra todas las acciones relevantes del sistema:

- Fecha y hora del evento.
- Usuario que ejecuto la accion.
- Tipo de evento (creacion, edicion, eliminacion, transicion de estado).
- Entidad afectada.
- Datos anteriores y posteriores (para modificaciones).
- Direccion IP del cliente.

Incluye filtros por:
- Rango de fechas
- Usuario
- Tipo de evento
- Entidad

### 3.9 Herramientas

#### 3.9.1 Escaner QR (`/mobile/escaner-qr`)

- Accede a la camara del dispositivo para leer codigos QR impresos en los manifiestos fisicos.
- Valida el QR contra el manifiesto digital en el sistema.
- Incluye opcion de ingreso manual del codigo como alternativa cuando la camara no esta disponible.

#### 3.9.2 Carga Masiva CSV (`/admin/carga-masiva`)

- Permite la importacion de datos en lote desde archivos CSV.
- Validacion previa del formato y contenido.
- Reporte de errores por fila.
- Soporta importacion de generadores, transportistas y operadores.

> **Nota tecnica sobre CSV:** Los archivos CSV deben cumplir con RFC 4180. El parser esta preparado para manejar campos entrecomillados con contenido multilinea, separadores de codigos Y inconsistentes (coma, barra, "e", espacios) y caracteres especiales como guion medio en numeros de certificado.

#### 3.9.3 Notificaciones

- **Icono de campana** en la barra superior con contador de notificaciones no leidas.
- **11 tipos de notificacion** que cubren todos los eventos del workflow.
- **4 niveles de prioridad:** Baja, Normal, Alta, Critica.
- Las notificaciones se generan automaticamente en cada transicion de estado del manifiesto.

#### 3.9.4 Reglas de Alerta (`/alertas`)

- Configuracion de reglas automaticas para generar alertas.
- **8 tipos de evento** que disparan alertas.
- Definicion de condiciones, umbrales y destinatarios.
- Las alertas generadas se muestran en el dashboard y en el Centro de Control.

### 3.10 Certificacion Blockchain

SITREP incluye un modulo de certificacion blockchain que permite registrar manifiestos en la red Ethereum como prueba inmutable de integridad. La certificacion genera un hash criptografico (SHA-256) del contenido del manifiesto y lo almacena en un smart contract publico, creando un sello temporal verificable por cualquier persona.

> **Nota:** La certificacion blockchain **no reemplaza** a la firma digital regulada por la normativa argentina (ver CU-S11, pendiente). Es un mecanismo complementario de integridad de datos que garantiza que el contenido del manifiesto no fue alterado despues de su certificacion.

#### 3.10.1 Red y contrato inteligente

El sistema opera sobre **Ethereum Sepolia**, una red de prueba (testnet) publica y gratuita que es identica en funcionamiento a la red principal de Ethereum (mainnet). La testnet permite validar completamente la tecnologia sin incurrir en costos de gas reales. Si en el futuro se requiere pasar a mainnet, el unico cambio necesario es la configuracion de la URL del nodo RPC y la direccion del contrato.

| Parametro | Valor |
|-----------|-------|
| **Red** | Ethereum Sepolia (testnet, chain ID 11155111) |
| **Contrato** | `SitrepRegistry` |
| **Direccion** | `0xbe4680934B675c80E2e6C2BD5Ae8Bf32aD42e241` |
| **Explorador** | https://sepolia.etherscan.io/address/0xbe4680934B675c80E2e6C2BD5Ae8Bf32aD42e241 |

El contrato `SitrepRegistry` expone dos funciones:

| Funcion | Acceso | Descripcion |
|---------|--------|-------------|
| `registrar(hash)` | Solo owner (wallet del sistema) | Almacena un hash bytes32 con su timestamp. Falla si el hash ya existe. Emite evento `ManifiestoRegistrado`. |
| `verificar(hash)` | Publico (lectura gratuita) | Retorna `(exists: bool, timestamp: uint256)`. No consume gas. |

El patron `onlyOwner` asegura que solo la wallet del sistema pueda escribir en el contrato, mientras que cualquier persona puede verificar hashes sin costo.

#### 3.10.2 Proceso de certificacion

La certificacion es **bajo demanda**: el usuario hace clic en "Certificar en Blockchain" desde la pagina de detalle del manifiesto. No es automatica.

**Prerequisito:** El manifiesto debe estar en estado APROBADO o posterior. No se pueden certificar manifiestos en estado BORRADOR ni CANCELADO.

```
Usuario hace clic en "Certificar en Blockchain"
    |
    | POST /api/blockchain/registrar/:id
    v
Backend genera hash SHA-256 del JSON canonico
    |
    | Guarda hash + estado PENDIENTE en BD
    v
Envia transaccion al smart contract (registrar)
    |
    | Guarda txHash en BD (antes de confirmacion)
    v
Espera 1 confirmacion de la red
    |
    +--- OK -----> Estado CONFIRMADO
    |              (guarda blockNumber, timestamp)
    |
    +--- Error --> Estado ERROR
                   (incrementa contador de reintentos)
```

**Cron de reintentos:** Un job automatico se ejecuta cada 60 segundos y procesa registros en estado PENDIENTE o ERROR. Maximo 3 reintentos por manifiesto. El cron solo corre en la instancia 0 de PM2 para evitar duplicacion en modo cluster.

#### 3.10.3 Datos certificados (hash canonico)

El hash SHA-256 se calcula sobre un JSON canonico con los siguientes campos, siempre en el mismo orden:

```json
{
  "numero": "2026-000147",
  "generadorId": "...",
  "generadorCuit": "30-71234567-8",
  "transportistaId": "...",
  "transportistaCuit": "30-71234568-9",
  "operadorId": "...",
  "operadorCuit": "30-71234569-0",
  "residuos": [
    { "tipoResiduoId": "Y1", "cantidad": 500, "unidad": "kg" }
  ],
  "fechaFirma": "2026-03-20T14:30:00.000Z"
}
```

- Los residuos se ordenan alfabeticamente por `tipoResiduoId` antes de serializar.
- El resultado es **determinista**: los mismos datos siempre generan el mismo hash.
- Algoritmo: SHA-256 (256 bits, 64 caracteres hexadecimales).

#### 3.10.4 Panel de certificacion en detalle del manifiesto

El componente `BlockchainPanel` se muestra en la pagina de detalle de cada manifiesto y presenta cuatro estados visuales:

| Estado | Visual | Comportamiento |
|--------|--------|----------------|
| **No certificado** | Borde punteado verde, icono escudo, boton "Certificar en Blockchain" | Solo visible si el manifiesto no es BORRADOR ni CANCELADO. Al hacer clic inicia el registro. |
| **PENDIENTE** | Fondo ambar, spinner animado, texto "Esperando confirmacion..." | Muestra el TX Hash como link a Etherscan si esta disponible. Auto-refresh cada 10 segundos. |
| **ERROR** | Fondo rojo, icono de alerta, boton "Reintentar" | Permite reintentar manualmente el registro. |
| **CONFIRMADO** | Banner verde con gradiente, icono escudo verificado, barra SHA-256 | Muestra detalles tecnicos expandibles: TX Hash (link Etherscan), numero de bloque, timestamp, direccion del contrato. Boton de copiar hash. |

#### 3.10.5 Registro de certificaciones (`/admin/blockchain`)

Pagina exclusiva para el rol ADMIN que lista todas las certificaciones blockchain del sistema.

- **Tabla paginada** con 15 registros por pagina.
- **Columnas:** Manifiesto #, Generador, Estado blockchain, Hash SHA-256, TX Hash (link a Etherscan), Bloque, Fecha de registro.
- **Filtros por pestanas:** Todos, Confirmados, Pendientes, Con Error.
- **Boton "Ver Contrato":** Link directo a la direccion del contrato en Etherscan.
- Cada fila es clickeable y navega al detalle del manifiesto.

#### 3.10.6 Verificacion publica

La pagina de verificacion publica (`/verificar/:numero`) muestra un badge de blockchain cuando el manifiesto tiene estado CONFIRMADO, permitiendo a cualquier persona verificar la integridad del documento.

Adicionalmente, el endpoint `GET /api/blockchain/verificar/:hash` permite verificar directamente un hash SHA-256 contra el smart contract sin requerir autenticacion. Retorna si el hash existe y su timestamp de registro.

#### 3.10.7 Sello blockchain en PDFs

Cuando un manifiesto tiene certificacion blockchain CONFIRMADA, los PDFs generados por el sistema (manifiesto y certificado de disposicion final) incluyen un sello verde con la siguiente informacion:

- Hash SHA-256 del manifiesto
- TX Hash de la transaccion en Ethereum
- Link a Etherscan para verificacion independiente

---

## 4. APLICACION MOVIL (PWA)

### 4.1 Instalacion

SITREP ofrece una Progressive Web App (PWA) que se instala directamente desde el navegador sin necesidad de tiendas de aplicaciones.

**En Android (Chrome):**

1. Abrir `https://sitrep.ultimamilla.com.ar/app/` en Chrome.
2. Tocar el menu de tres puntos (esquina superior derecha).
3. Seleccionar "Instalar aplicacion" o "Agregar a pantalla de inicio".
4. Confirmar la instalacion.
5. El icono de SITREP aparecera en la pantalla de inicio.

**En iOS (Safari):**

1. Abrir `https://sitrep.ultimamilla.com.ar/app/` en Safari.
2. Tocar el boton de compartir (cuadrado con flecha hacia arriba).
3. Seleccionar "Agregar a la pantalla de inicio".
4. Confirmar el nombre y tocar "Agregar".
5. El icono de SITREP aparecera en la pantalla de inicio.

La PWA incluye:
- Service Worker para caching de recursos estaticos.
- Soporte offline para funcionalidades criticas.
- Cola de sincronizacion para datos generados sin conexion.

### 4.2 Navegacion movil

La aplicacion movil utiliza dos elementos de navegacion principales:

**Barra de navegacion inferior (Bottom Nav):**
- Dashboard
- Manifiestos
- Centro de Control
- Perfil / Mas opciones

**Menu lateral (Drawer):**
- Todas las secciones disponibles segun el rol del usuario.
- Acceso a configuracion y cierre de sesion.

Las rutas moviles estan todas bajo el prefijo `/mobile/`:

| Ruta | Funcion |
|------|---------|
| `/mobile/dashboard` | Dashboard optimizado para movil |
| `/mobile/centro-control` | Centro de Control movil |
| `/mobile/manifiestos` | Lista de manifiestos |
| `/mobile/manifiestos/nuevo` | Creacion de manifiesto |
| `/mobile/transporte/viaje/:id` | Seguimiento GPS activo durante transporte |
| `/mobile/escaner-qr` | Escaner de codigos QR |
| `/mobile/switch-user` | Selector de usuario (solo demostracion) |

### 4.3 Modo offline

La PWA esta disenada para funcionar en zonas con conectividad limitada o nula:

- **Service Worker:** Cachea los recursos estaticos de la aplicacion (HTML, CSS, JavaScript, imagenes) para permitir la carga de la interfaz sin conexion.
- **IndexedDB:** Almacena datos de manifiestos consultados previamente para visualizacion offline.
- **Cola de sincronizacion:** Las acciones realizadas offline (actualizaciones GPS, confirmaciones) se encolan y se sincronizan automaticamente al recuperar la conexion.
- **localStorage:** Las actualizaciones GPS pendientes se persisten en localStorage (maximo 5 en cola) como respaldo en caso de cierre de la aplicacion.

> **Estado de implementacion:** La arquitectura de sincronizacion offline esta preparada (localStorage + IndexedDB). La sincronizacion completa bidireccional (CU-S05) esta pendiente de implementacion para la siguiente version.

### 4.4 Funciones por rol en la app movil

| Funcion | ADMIN | GENERADOR | TRANSPORTISTA | OPERADOR |
|---------|-------|-----------|---------------|----------|
| Dashboard movil | Si | Si | Si (con banner de viaje) | Si |
| Ver manifiestos | Si | Si (propios) | Si (asignados) | Si (recibidos) |
| Crear manifiesto | Si | Si | No | No |
| Confirmar retiro | Si | No | Si | No |
| Tracking GPS | Si (ver) | Si (ver) | Si (enviar y ver) | No |
| Registrar incidente | Si | No | Si | No |
| Confirmar entrega | Si | No | Si | No |
| Escanear QR | Si | No | Si | Si |
| Confirmar recepcion | Si | No | No | Si |
| Registrar pesaje | Si | No | No | Si |
| Historial de viajes | Si | No | Si | No |
| Centro de Control | Si | No | No | No |

---

## 5. ARQUITECTURA Y DATOS

### 5.1 Arquitectura General

SITREP sigue una arquitectura cliente-servidor con los siguientes componentes:

```
                    Internet
                       |
                       v
            +-------------------+
            |   Nginx (proxy)   |
            |  Let's Encrypt    |
            |     SSL/TLS       |
            +-------------------+
                   |       |
          +--------+       +--------+
          |                         |
          v                         v
  +---------------+        +--------------+
  |   Frontend    |        |   Backend    |
  |   (Vite)      |        |   (PM2 x2)  |
  |   React 19    |        |   Express    |
  |   Static SPA  |        |   Node 20   |
  +---------------+        +--------------+
                                   |
                                   v
                           +--------------+
                           |  PostgreSQL  |
                           |  (Docker)    |
                           +--------------+
```

#### Stack tecnologico detallado

**Backend:**

| Componente | Tecnologia | Version |
|------------|-----------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | Express | 4.x |
| Lenguaje | TypeScript | 5.x |
| ORM | Prisma | Latest |
| Base de datos | PostgreSQL | (Docker container) |
| Generacion PDF | PDFKit | Latest |
| Process manager | PM2 | Cluster mode (2 instancias) |

**Frontend:**

| Componente | Tecnologia | Version |
|------------|-----------|---------|
| Framework | React | 19 |
| Lenguaje | TypeScript | 5.x |
| Build tool | Vite | 7.2 |
| Data fetching | TanStack Query | v5 |
| Graficos | Recharts | Latest |
| Mapas | Leaflet | Latest |
| PDF (cliente) | jsPDF | Latest |

**Infraestructura:**

| Componente | Tecnologia | Configuracion |
|------------|-----------|---------------|
| Proxy reverso | Nginx | Reverse proxy con cache |
| SSL | Let's Encrypt | Renovacion automatica |
| Contenedores | Docker | PostgreSQL |
| Procesos | PM2 | 2 instancias en cluster |

#### Despliegue

- El frontend se compila con `npm run build` (ejecuta `tsc -b && vite build`) y se sirve como archivos estaticos a traves de Nginx.
- Vite genera automaticamente chunks separados para archivos de datos pesados (como el enriquecimiento de generadores, ~541KB comprimido a 122KB gzip).
- Los 32 componentes de paginas principales se cargan de forma lazy (code splitting) para optimizar el tiempo de carga inicial.
- El backend se ejecuta en 2 instancias PM2 en modo cluster para alta disponibilidad.

### 5.2 Modelo de Datos

El modelo de datos esta definido mediante Prisma ORM y comprende las siguientes entidades:

#### Entidades principales

| Entidad | Descripcion | Campos clave |
|---------|-------------|--------------|
| **Usuario** | Usuarios del sistema | id, email, password (bcrypt), nombre, rol (Enum), activo |
| **Generador** | Empresas generadoras de residuos | id, cuit, razonSocial, domicilio, departamento, certificadoAmbiental, usuarioId |
| **Transportista** | Empresas de transporte habilitadas | id, cuit, razonSocial, habilitacion, usuarioId |
| **Operador** | Plantas de tratamiento/disposicion | id, cuit, razonSocial, certificado, tipoCertificado, corrientesY, usuarioId |
| **Vehiculo** | Flota de transporte | id, patente, marca, modelo, capacidad, transportistaId |
| **Chofer** | Conductores habilitados | id, dni, nombre, licencia, transportistaId |

#### Entidades de manifiestos

| Entidad | Descripcion | Campos clave |
|---------|-------------|--------------|
| **Manifiesto** | Documento de trazabilidad | id, numero (YYYY-NNNNNN), estado (Enum), fechaCreacion, generadorId, transportistaId, operadorId, vehiculoId, choferId, codigoQR |
| **ManifiestoResiduo** | Residuos incluidos en el manifiesto | id, manifiestoId, tipoResiduoId, cantidadDeclarada, cantidadReal, estadoFisico, tipoEnvase |
| **EventoManifiesto** | Historial de cambios de estado | id, manifiestoId, estadoAnterior, estadoNuevo, fecha, usuarioId, observaciones |
| **TrackingGPS** | Puntos de rastreo GPS | id, manifiestoId, latitud, longitud, velocidad, timestamp |

#### Catalogos

| Entidad | Descripcion | Campos clave |
|---------|-------------|--------------|
| **TipoResiduo** | Catalogo de categorias Y | id, codigoY, descripcion, activo |
| **TratamientoAutorizado** | Catalogo de tratamientos | id, codigo, descripcion, activo |

#### Notificaciones y alertas

| Entidad | Descripcion | Campos clave |
|---------|-------------|--------------|
| **Notificacion** | Notificaciones al usuario | id, usuarioId, tipo (Enum), titulo, mensaje, leida, prioridad (Enum), fecha |
| **ReglaAlerta** | Reglas de generacion de alertas | id, nombre, evento (Enum), condiciones, activa |
| **AlertaGenerada** | Alertas emitidas por reglas | id, reglaId, manifiestoId, fecha, estado (Enum) |
| **AnomaliaTransporte** | Anomalias detectadas en GPS | id, manifiestoId, tipo (Enum), severidad (Enum), latitud, longitud, fecha, resuelta |

#### Auditoria y soporte

| Entidad | Descripcion | Campos clave |
|---------|-------------|--------------|
| **Auditoria** | Registro de auditoria | id, fecha, usuarioId, accion, entidad, entidadId, datosAnteriores, datosNuevos, ip |
| **AnalyticsLog** | Metricas de uso | id, evento, datos, fecha |
| **RefreshToken** | Tokens de refresco JWT | id, token, usuarioId, expiracion |
| **DemoAccess** | Accesos de demostracion | id, fecha, ip |

#### Enumeraciones

| Enum | Valores |
|------|---------|
| **Rol** | ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR |
| **EstadoManifiesto** | BORRADOR, APROBADO, EN_TRANSITO, ENTREGADO, RECIBIDO, EN_TRATAMIENTO, TRATADO, RECHAZADO, CANCELADO, INCIDENTE |
| **TipoNotificacion** | 11 tipos cubriendo todos los eventos del workflow |
| **PrioridadNotificacion** | BAJA, NORMAL, ALTA, CRITICA |
| **EventoAlerta** | 8 tipos de eventos que disparan alertas |
| **EstadoAlerta** | Estados de las alertas generadas |
| **TipoAnomalia** | EXCESO_VELOCIDAD, DETENCION_PROLONGADA, PERDIDA_GPS, TRANSITO_EXCESIVO, DESVIO_RUTA, ZONA_RESTRINGIDA |
| **SeveridadAnomalia** | Niveles de severidad de las anomalias |
| **TipoDiferencia** | Tipos de diferencia entre peso declarado y real |

#### Indices de base de datos

Se han definido 16 indices para optimizar las consultas mas frecuentes:

| Tabla | Indice | Campos | Proposito |
|-------|--------|--------|-----------|
| Manifiesto | idx_manifiesto_estado | estado | Filtrado por estado |
| Manifiesto | idx_manifiesto_generador | generadorId | Consultas por generador |
| Manifiesto | idx_manifiesto_transportista | transportistaId | Consultas por transportista |
| Manifiesto | idx_manifiesto_operador | operadorId | Consultas por operador |
| Manifiesto | idx_manifiesto_fecha | fechaCreacion | Ordenamiento cronologico |
| Manifiesto | idx_manifiesto_numero | numero | Busqueda por numero (unico) |
| TrackingGPS | idx_tracking_manifiesto | manifiestoId | Consulta de ruta por manifiesto |
| TrackingGPS | idx_tracking_fecha | timestamp | Ordenamiento de puntos GPS |
| EventoManifiesto | idx_evento_manifiesto | manifiestoId | Historial del manifiesto |
| Notificacion | idx_notif_usuario | usuarioId | Notificaciones del usuario |
| Notificacion | idx_notif_leida | usuarioId, leida | Notificaciones no leidas |
| Auditoria | idx_audit_fecha | fecha | Consulta por rango de fechas |
| Auditoria | idx_audit_usuario | usuarioId | Consulta por usuario |
| AnomaliaTransporte | idx_anomalia_manifiesto | manifiestoId | Anomalias por manifiesto |
| AlertaGenerada | idx_alerta_regla | reglaId | Alertas por regla |
| Usuario | idx_usuario_email | email | Login (unico) |

### 5.3 Esquema de Servicios API

La API REST esta organizada en 10 modulos funcionales, todos bajo el prefijo `/api/`.

#### Modulo 1: Autenticacion (`/api/auth`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| POST | `/api/auth/login` | Publico | Inicio de sesion, retorna access token + refresh token |
| POST | `/api/auth/register` | ADMIN | Registro de nuevo usuario |
| POST | `/api/auth/refresh` | Autenticado | Renovacion del access token |
| GET | `/api/auth/profile` | Autenticado | Datos del perfil del usuario actual |
| PUT | `/api/auth/profile` | Autenticado | Actualizacion del perfil |

#### Modulo 2: Manifiestos (`/api/manifiestos`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/manifiestos` | Autenticado | Lista de manifiestos (filtrados por rol) |
| GET | `/api/manifiestos/:id` | Autenticado | Detalle de un manifiesto |
| POST | `/api/manifiestos` | GENERADOR, ADMIN | Crear nuevo manifiesto |
| PUT | `/api/manifiestos/:id` | GENERADOR, ADMIN | Editar manifiesto (solo BORRADOR) |
| POST | `/api/manifiestos/:id/firmar` | GENERADOR, ADMIN | Firmar/aprobar manifiesto |
| POST | `/api/manifiestos/:id/confirmar-retiro` | TRANSPORTISTA, ADMIN | Confirmar retiro de residuos |
| POST | `/api/manifiestos/:id/confirmar-entrega` | TRANSPORTISTA, ADMIN | Confirmar entrega en destino |
| POST | `/api/manifiestos/:id/registrar-incidente` | TRANSPORTISTA, ADMIN | Registrar incidente en transporte |
| POST | `/api/manifiestos/:id/confirmar-recepcion` | OPERADOR, ADMIN | Confirmar recepcion de residuos |
| POST | `/api/manifiestos/:id/rechazar` | OPERADOR, ADMIN | Rechazar carga |
| POST | `/api/manifiestos/:id/registrar-pesaje` | OPERADOR, ADMIN | Registrar peso real |
| POST | `/api/manifiestos/:id/registrar-tratamiento` | OPERADOR, ADMIN | Registrar inicio de tratamiento |
| POST | `/api/manifiestos/:id/cerrar` | OPERADOR, ADMIN | Cerrar manifiesto (tratado) |
| POST | `/api/manifiestos/:id/cancelar` | GENERADOR, ADMIN | Cancelar manifiesto |
| POST | `/api/manifiestos/:id/ubicacion` | TRANSPORTISTA | Enviar coordenadas GPS |
| GET | `/api/manifiestos/dashboard/stats` | Autenticado | Estadisticas para dashboard |

#### Modulo 3: Catalogos (`/api/catalogos`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/catalogos/tipos-residuo` | Autenticado | Lista de tipos de residuo |
| GET | `/api/catalogos/generadores` | Autenticado | Lista de generadores |
| GET | `/api/catalogos/transportistas` | Autenticado | Lista de transportistas |
| GET | `/api/catalogos/operadores` | Autenticado | Lista de operadores |
| GET | `/api/catalogos/vehiculos` | Autenticado | Lista de vehiculos |
| GET | `/api/catalogos/choferes` | Autenticado | Lista de choferes |
| GET | `/api/catalogos/tratamientos` | Autenticado | Lista de tratamientos autorizados |

#### Modulo 4: Actores (`/api/actores`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/actores/generadores` | ADMIN | Lista de generadores (admin) |
| POST | `/api/actores/generadores` | ADMIN | Crear generador |
| PUT | `/api/actores/generadores/:id` | ADMIN | Editar generador |
| DELETE | `/api/actores/generadores/:id` | ADMIN | Eliminar generador |
| GET | `/api/actores/transportistas` | ADMIN | Lista de transportistas (admin) |
| POST | `/api/actores/transportistas` | ADMIN | Crear transportista |
| PUT | `/api/actores/transportistas/:id` | ADMIN | Editar transportista |
| DELETE | `/api/actores/transportistas/:id` | ADMIN | Eliminar transportista |
| GET | `/api/actores/operadores` | ADMIN | Lista de operadores (admin) |
| POST | `/api/actores/operadores` | ADMIN | Crear operador |
| PUT | `/api/actores/operadores/:id` | ADMIN | Editar operador |
| DELETE | `/api/actores/operadores/:id` | ADMIN | Eliminar operador |

#### Modulo 5: Reportes (`/api/reportes`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/reportes/manifiestos` | ADMIN | Reporte de manifiestos por periodo |
| GET | `/api/reportes/residuos-tratados` | ADMIN | Reporte de residuos tratados |
| GET | `/api/reportes/transporte` | ADMIN | Reporte de transporte |
| GET | `/api/reportes/generadores` | ADMIN | Reporte de generadores |
| GET | `/api/reportes/operadores` | ADMIN | Reporte de operadores |
| GET | `/api/reportes/export/csv` | ADMIN | Exportacion CSV (max 10.000 filas) |

#### Modulo 6: PDF (`/api/pdf`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/pdf/manifiesto/:id` | Autenticado | Generar PDF del manifiesto |
| GET | `/api/pdf/certificado/:id` | Autenticado | Generar certificado de disposicion |

#### Modulo 7: Notificaciones (`/api/notificaciones`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/notificaciones` | Autenticado | Lista de notificaciones del usuario |
| PUT | `/api/notificaciones/:id/leer` | Autenticado | Marcar notificacion como leida |
| GET | `/api/notificaciones/no-leidas` | Autenticado | Contador de no leidas |
| GET | `/api/alertas/reglas` | ADMIN | Lista de reglas de alerta |
| POST | `/api/alertas/reglas` | ADMIN | Crear regla de alerta |
| PUT | `/api/alertas/reglas/:id` | ADMIN | Editar regla de alerta |
| DELETE | `/api/alertas/reglas/:id` | ADMIN | Eliminar regla de alerta |

#### Modulo 8: Centro de Control (`/api/centro-control`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/centro-control/actividad` | ADMIN | Actividad por capas (viajes, incidentes) |
| GET | `/api/centro-control/mapa` | ADMIN | Datos del mapa (posiciones activas) |
| GET | `/api/centro-control/stats` | ADMIN | KPIs del centro de control |

#### Modulo 9: Analytics (`/api/analytics`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/analytics/dashboard` | Autenticado | Estadisticas del dashboard |

#### Modulo 10: Blockchain (`/api/blockchain`)

| Metodo | Ruta | Roles | Descripcion |
|--------|------|-------|-------------|
| GET | `/api/blockchain/verificar/:hash` | Publico | Verificacion publica de hash en blockchain |
| GET | `/api/blockchain/manifiesto/:id` | Autenticado | Estado de certificacion de un manifiesto |
| POST | `/api/blockchain/registrar/:id` | Autenticado | Registrar manifiesto en blockchain (bajo demanda) |
| GET | `/api/blockchain/registro` | ADMIN | Lista paginada de certificaciones |

### 5.4 Seguridad

SITREP implementa multiples capas de seguridad:

#### Autenticacion

| Mecanismo | Configuracion |
|-----------|---------------|
| Tokens JWT | Access token con expiracion de 24 horas |
| Refresh tokens | Expiracion de 7 dias, almacenados en base de datos |
| Hashing de contrasenas | bcrypt con salt rounds por defecto |
| Almacenamiento de tokens | httpOnly cookies o localStorage segun configuracion |

#### Proteccion de endpoints

| Mecanismo | Configuracion |
|-----------|---------------|
| Middleware de autenticacion | Verifica JWT en cada request protegido |
| Middleware de autorizacion | Verifica que el rol del usuario coincida con los roles permitidos para cada endpoint |
| Rate limiting | 600 solicitudes por minuto por IP |
| Timeout de solicitudes | 30 segundos maximo por request |

#### Proteccion de infraestructura

| Mecanismo | Configuracion |
|-----------|---------------|
| Helmet | Headers de seguridad HTTP (X-Frame-Options, X-Content-Type-Options, CSP, etc.) |
| CORS | Configurado para permitir solo origenes autorizados |
| SSL/TLS | Let's Encrypt con renovacion automatica a traves de Nginx |
| Docker isolation | La base de datos PostgreSQL corre en contenedor aislado |

#### Integridad de datos

| Mecanismo | Configuracion |
|-----------|---------------|
| Certificacion blockchain | Hash SHA-256 de manifiestos registrado en smart contract en Ethereum Sepolia. Prueba inmutable de integridad verificable por terceros. |
| Smart contract | Patron `onlyOwner` para escritura (solo la wallet del sistema puede registrar hashes). Lectura libre y gratuita para verificacion publica. |

### 5.5 Capacidad Actual

La configuracion actual del sistema esta dimensionada para 50 transportistas simultaneos:

| Parametro | Valor actual | Descripcion |
|-----------|-------------|-------------|
| Instancias PM2 | 2 | Backend en modo cluster |
| Connection pool (por instancia) | 20 | Conexiones a PostgreSQL |
| Connection pool (total) | 40 | 20 x 2 instancias |
| Rate limit | 600 req/min/IP | Proteccion contra abuso |
| Viajes GPS simultaneos | 50 | Maximo de viajes con tracking activo |
| Escrituras GPS | ~100/min | 50 viajes x 1 update cada 30s |
| Cache GPS en memoria | 30s TTL | Cache por manifiestoId |
| Timeout de request | 30s | Maximo tiempo de respuesta |

### 5.6 Escalamiento a 200 Usuarios

Para escalar el sistema a 200 usuarios simultaneos se propone la siguiente hoja de ruta:

#### Requerimientos de servidor

| Componente | Actual | Objetivo (200 usuarios) |
|------------|--------|------------------------|
| Instancias PM2 | 2 | 4-6 |
| CPU cores | 2 | 4-8 |
| RAM | 4 GB | 8-16 GB |
| Almacenamiento SSD | 50 GB | 100 GB |

#### Ajustes de PostgreSQL

| Parametro | Actual | Objetivo |
|-----------|--------|----------|
| `max_connections` | 100 | 200 |
| `shared_buffers` | 128 MB | 1 GB |
| `work_mem` | 4 MB | 16 MB |
| `effective_cache_size` | 512 MB | 4 GB |
| Connection pool total | 40 | 80-120 |

#### Componentes adicionales

| Componente | Funcion | Impacto |
|------------|---------|---------|
| **Redis** | Cache de sesiones, GPS, catalogos | Reduce carga de PostgreSQL en un 40-60% |
| **Nginx proxy cache** | Cache de respuestas estaticas y de catalogos | Reduce requests al backend |
| **PM2 scaling** | 4-6 instancias en cluster | Distribuye carga de CPU |
| **CDN** | Assets estaticos del frontend | Reduce latencia para usuarios remotos |

#### Metricas de escalamiento

| Metrica | 50 usuarios | 200 usuarios |
|---------|-------------|--------------|
| Viajes GPS simultaneos | 50 | 200 |
| Escrituras GPS/min | ~100 | ~400 |
| Rate limit | 600 req/min/IP | 1.200 req/min/IP |
| Requests totales estimados | ~500/min | ~2.000/min |
| Tamano de BD (anual) | ~2 GB | ~8 GB |

---

## 6. REFERENCIA DE WORKFLOW

### 6.1 Estados del manifiesto

El manifiesto transita por los siguientes estados:

```
BORRADOR
    |
    | [Firmar/Aprobar] (GENERADOR, ADMIN)
    v
APROBADO ------> [Certificar en Blockchain] (bajo demanda, no cambia estado)
    |
    | [Confirmar Retiro] (TRANSPORTISTA, ADMIN)
    v
EN_TRANSITO ---------> INCIDENTE (evento, no cambia estado)
    |
    | [Confirmar Entrega] (TRANSPORTISTA, ADMIN)
    v
ENTREGADO
    |
    +------ [Rechazar Carga] (OPERADOR, ADMIN) -----> RECHAZADO
    |
    | [Confirmar Recepcion] (OPERADOR, ADMIN)
    v
RECIBIDO
    |
    | [Registrar Pesaje] (OPERADOR, ADMIN) -- actualiza pesos, no cambia estado
    |
    | [Registrar Tratamiento] (OPERADOR, ADMIN)
    v
EN_TRATAMIENTO
    |
    | [Cerrar Manifiesto] (OPERADOR, ADMIN)
    v
TRATADO (estado final -- permite descargar certificado)


Cualquier estado (excepto CANCELADO y TRATADO)
    |
    | [Cancelar] (GENERADOR, ADMIN)
    v
CANCELADO
```

#### Descripcion de cada estado

| Estado | Descripcion | Actor responsable |
|--------|-------------|-------------------|
| BORRADOR | Manifiesto creado pero no firmado. Puede ser editado o eliminado. | Generador |
| APROBADO | Manifiesto firmado por el generador. QR generado. Listo para retiro. | Generador |
| EN_TRANSITO | Residuo retirado por el transportista. GPS activo. | Transportista |
| ENTREGADO | Residuo entregado en la planta del operador. GPS finalizado. | Transportista |
| RECIBIDO | Operador confirmo la recepcion del residuo. | Operador |
| EN_TRATAMIENTO | Tratamiento del residuo iniciado. | Operador |
| TRATADO | Tratamiento completado. Certificado de disposicion disponible. Estado final exitoso. | Operador |
| RECHAZADO | Operador rechazo la carga por no conformidad. | Operador |
| CANCELADO | Manifiesto cancelado por el generador o el administrador. | Generador / Admin |
| INCIDENTE | Evento registrado durante el transporte (no es un cambio de estado, es un evento asociado). | Transportista |

### 6.2 Acciones por estado y rol

La siguiente matriz muestra las acciones disponibles en cada estado del manifiesto, segun el rol del usuario:

| Accion | Estado origen | Estado destino | ADMIN | GENERADOR | TRANSPORTISTA | OPERADOR |
|--------|--------------|----------------|-------|-----------|---------------|----------|
| Editar manifiesto | BORRADOR | BORRADOR | Si | Si (propios) | No | No |
| Firmar/Aprobar | BORRADOR | APROBADO | Si | Si (propios) | No | No |
| Confirmar retiro | APROBADO | EN_TRANSITO | Si | No | Si (asignados) | No |
| Registrar incidente | EN_TRANSITO | (evento) | Si | No | Si (asignados) | No |
| Confirmar entrega | EN_TRANSITO | ENTREGADO | Si | No | Si (asignados) | No |
| Confirmar recepcion | ENTREGADO | RECIBIDO | Si | No | No | Si (asignados) |
| Rechazar carga | ENTREGADO | RECHAZADO | Si | No | No | Si (asignados) |
| Registrar pesaje | RECIBIDO | (actualiza pesos) | Si | No | No | Si (asignados) |
| Registrar tratamiento | RECIBIDO | EN_TRATAMIENTO | Si | No | No | Si (asignados) |
| Cerrar manifiesto | EN_TRATAMIENTO / RECIBIDO | TRATADO | Si | No | No | Si (asignados) |
| Cancelar | Cualquiera (excepto CANCELADO/TRATADO) | CANCELADO | Si | Si (propios) | No | No |
| Descargar PDF | Cualquiera | (descarga) | Si | Si (propios) | Si (asignados) | Si (asignados) |
| Descargar certificado | TRATADO | (descarga) | Si | Si | Si | Si |
| Ver timeline | Cualquiera | (visualizacion) | Si | Si (propios) | Si (asignados) | Si (asignados) |
| Ver mapa GPS | EN_TRANSITO / ENTREGADO+ | (visualizacion) | Si | Si (propios) | Si (asignados) | No |
| Certificar en Blockchain | Cualquiera (excepto BORRADOR/CANCELADO) | (registro async) | Si | Si | Si | Si |

### 6.3 Flujo GPS completo

El flujo de GPS comprende tres etapas: captura en el cliente, procesamiento en el servidor y visualizacion en el mapa.

#### Etapa 1: Captura en el cliente (telefono del transportista)

```
1. Transportista confirma retiro del manifiesto
2. Navegador solicita permiso de geolocalizacion
3. Se activa navigator.geolocation.watchPosition()
4. Cada 30 segundos:
   a. Se obtiene la posicion actual (latitud, longitud, velocidad)
   b. Se envia POST /api/manifiestos/:id/ubicacion
   c. Si falla el envio:
      - Se agrega a pendingUpdatesRef (max 5)
      - Se persiste en localStorage
   d. Al recuperar conexion:
      - Se envian las actualizaciones pendientes en orden
      - Se limpia la cola
5. Si el transportista pausa:
   - Se registra incidente PAUSA
   - Se detiene el watchPosition
6. Si el transportista reanuda:
   - Se registra incidente REANUDACION
   - Se reactiva el watchPosition
7. Al confirmar entrega:
   - Se detiene el watchPosition
   - Se envian las actualizaciones pendientes restantes
```

#### Etapa 2: Procesamiento en el servidor

```
1. POST /api/manifiestos/:id/ubicacion recibe:
   - latitud, longitud, velocidad, timestamp
2. Se guarda en tabla tracking_gps
3. Se actualiza el cache en memoria (TTL 30s)
4. Se ejecutan validaciones de anomalias:
   - Velocidad > 120 km/h → EXCESO_VELOCIDAD
   - Sin movimiento > 2h → DETENCION_PROLONGADA
   - Sin GPS > 30min → PERDIDA_GPS
   - Duracion total > 24h → TRANSITO_EXCESIVO
5. Si se detecta anomalia:
   - Se registra en tabla anomalia_transporte
   - Se genera alerta automatica
   - Se notifica al administrador
```

#### Etapa 3: Visualizacion en Centro de Control

```
1. Centro de Control (/centro-control) se carga
2. Cada 30 segundos:
   a. GET /api/centro-control/mapa
   b. Se reciben posiciones activas de todos los viajes
   c. Se actualizan los marcadores en el mapa Leaflet
   d. Se actualizan los KPIs
   e. Se muestran alertas de anomalias si las hay
3. Capas visuales disponibles:
   - Viajes activos (marcadores en movimiento)
   - Viajes completados (recorridos trazados)
   - Generadores (ubicacion de plantas generadoras)
   - Operadores (ubicacion de plantas de tratamiento)
   - Incidentes (marcadores de eventos)
```

---

## 7. ANEXO: CASOS DE USO

### 7.1 Administrador (16 Casos de Uso)

| ID | Nombre | Estado | Descripcion |
|----|--------|--------|-------------|
| CU-A01 | Login Admin | **Completo** | Autenticacion JWT con redireccion basada en rol. El administrador ingresa con email y contrasena, el sistema valida las credenciales, genera un access token (24h) y un refresh token (7d), y redirige al dashboard de administracion. |
| CU-A02 | Dashboard Ejecutivo | **Completo** | Panel con KPIs, mapa interactivo, alertas activas, graficos de tendencias y filtros por periodo. Muestra metricas consolidadas de todos los actores del sistema. |
| CU-A03 | Gestionar Usuarios | **Completo** | CRUD completo de usuarios a traves de `/api/auth`. Alta de nuevos usuarios con asignacion de rol, edicion de datos, activacion/desactivacion de cuentas. |
| CU-A04 | Asignar Roles y Permisos | **Parcial** | Middleware de autorizacion implementado que verifica el rol del usuario en cada endpoint. La interfaz de gestion granular de permisos esta pendiente. |
| CU-A05 | Gestionar Catalogo de Residuos | **Completo** | Pestana en la pagina de Configuracion para administrar las categorias Y de residuos peligrosos. Alta, edicion y activacion/desactivacion de tipos de residuo. |
| CU-A06 | Gestionar Generadores | **Completo** | CRUD completo con interfaz en `/admin/actores/generadores`. Incluye busqueda por CUIT, paginacion, enriquecimiento de datos y exportacion CSV. |
| CU-A07 | Gestionar Transportistas | **Completo** | CRUD con gestion de vehiculos y choferes asociados. Interfaz en `/admin/actores/transportistas` con pestanas para datos del transportista, flota y conductores. |
| CU-A08 | Gestionar Operadores | **Completo** | CRUD completo con gestion de certificados y corrientes de residuos habilitadas. Interfaz en `/admin/actores/operadores`. |
| CU-A09 | Monitoreo en Tiempo Real | **Completo** | Mapa interactivo en el Centro de Control con posiciones GPS actualizadas cada 30 segundos. Capas de informacion configurables, deteccion de anomalias y alertas visuales. |
| CU-A10 | Log de Auditoria | **Completo** | Endpoint de auditoria con registro automatico de todas las acciones del sistema. Interfaz con filtros por fecha, usuario, tipo de evento y entidad. |
| CU-A11 | Reportes Estadisticos | **Completo** | Ocho pestanas de reportes con graficos interactivos (Recharts), mapas coropleticos (Leaflet) y tablas de datos. Datos de demostracion precargados. |
| CU-A12 | Exportar Datos | **Completo** | Exportacion CSV de actores y manifiestos. Limite de 10.000 filas por exportacion. Utilidad `downloadCsv()` en el frontend. |
| CU-A13 | Configurar Alertas | **Completo** | Pagina de reglas de alerta con CRUD. Definicion de eventos disparadores, condiciones, umbrales y destinatarios. |
| CU-A14 | Parametros del Sistema | **Completo** | Pestana en Configuracion para ajustar parametros operativos: intervalos de actualizacion, limites de validacion, umbrales de anomalias. |
| CU-A15 | Carga Masiva de Datos | **Completo** | Importador CSV en `/admin/carga-masiva`. Validacion previa del formato, reporte de errores por fila, soporte para importacion de los tres tipos de actores. |
| CU-A20 | Certificacion Blockchain de Manifiestos | **Completo** | Registro inmutable de manifiestos en Ethereum Sepolia. El usuario certifica bajo demanda desde el detalle del manifiesto (boton "Certificar en Blockchain"). La pagina `/admin/blockchain` permite al admin consultar todas las certificaciones con filtros por estado, tabla paginada con TX Hash, bloque y links a Etherscan. |

### 7.2 Generador (12 Casos de Uso)

| ID | Nombre | Estado | Descripcion |
|----|--------|--------|-------------|
| CU-G01 | Login Generador | **Completo** | Autenticacion JWT. El generador ingresa con sus credenciales y accede a su panel con manifiestos propios. |
| CU-G02 | Dashboard Generador | **Completo** | Panel con estadisticas del generador: manifiestos activos, residuos generados, accesos rapidos a crear manifiesto y consultar historial. |
| CU-G03 | Crear Manifiesto | **Completo** | Formulario multi-paso completo con 5 etapas. Auto-completado de datos del generador, seleccion de residuos del catalogo, asignacion de transportista y operador, revision final. |
| CU-G04 | Seleccionar Tipo de Residuo | **Completo** | Selector de catalogo con filtro por categoria Y. Muestra codigo, descripcion y estado de cada tipo de residuo. Permite seleccion multiple. |
| CU-G05 | Asignar Transportista | **Completo** | Selector con filtros por razon social y habilitacion. Muestra vehiculos y choferes disponibles del transportista seleccionado. |
| CU-G06 | Asignar Operador Destino | **Completo** | Selector con filtros por razon social y corrientes de residuo habilitadas. Solo muestra operadores habilitados para la categoria Y seleccionada. |
| CU-G07 | Firmar Manifiesto | **Completo** | Firma electronica del manifiesto. Genera automaticamente el codigo QR con los datos del manifiesto. Cambia el estado de BORRADOR a APROBADO. |
| CU-G08 | Consultar Estado | **Completo** | Pagina de detalle con timeline visual de todos los eventos. Incluye mapa GPS cuando el manifiesto esta en transito o posterior. |
| CU-G09 | Consultar Historial | **Completo** | Lista de manifiestos con filtros por estado, fecha y numero. Paginacion y ordenamiento configurable. |
| CU-G10 | Descargar PDF | **Completo** | Boton de descarga que genera el PDF del manifiesto via PDFKit en el backend. Incluye todos los datos, firmas y codigo QR. |
| CU-G11 | Recibir Notificaciones | **Completo** | Icono de campana en la barra superior con contador de no leidas. Notificaciones automaticas en cada cambio de estado de los manifiestos propios. |
| CU-G12 | Actualizar Perfil | **Completo** | Formulario de edicion de datos del perfil: nombre, email, telefono, datos de la empresa generadora. |

### 7.3 Transportista (11 Casos de Uso)

| ID | Nombre | Estado | Descripcion |
|----|--------|--------|-------------|
| CU-T01 | Login Transportista | **Completo** | Autenticacion JWT compatible con web y aplicacion movil. Redireccion al dashboard correspondiente segun el dispositivo. |
| CU-T02 | Ver Manifiestos Asignados | **Completo** | Lista de manifiestos asignados al transportista, accesible desde web y movil. Filtro rapido por estado (pendientes de retiro, en transito, entregados). |
| CU-T03 | Confirmar Retiro | **Completo** | Endpoint y UI para confirmar el retiro de residuos en la ubicacion del generador. Activa automaticamente el tracking GPS. Cambia estado a EN_TRANSITO. |
| CU-T04 | Iniciar Transporte | **Completo** | Activacion del seguimiento GPS mediante `navigator.geolocation.watchPosition()`. Solicita permisos de geolocalizacion al navegador. |
| CU-T05 | Actualizar Estado de Transito | **Completo** | Envio automatico de coordenadas GPS cada 30 segundos. Los puntos se almacenan en la tabla `tracking_gps` y se visualizan en el Centro de Control. |
| CU-T06 | Registrar Incidente | **Completo** | Endpoint completo para registrar incidentes durante el transporte: tipo de incidente, descripcion, ubicacion y fecha. No cambia el estado del manifiesto. |
| CU-T07 | Confirmar Entrega | **Completo** | Endpoint y UI para confirmar la entrega de residuos en la planta del operador. Detiene el tracking GPS. Cambia estado a ENTREGADO. |
| CU-T08 | Escanear QR | **Completo** | Modal de camara para escanear codigos QR de manifiestos fisicos. Incluye opcion de ingreso manual del codigo como alternativa. Valida el QR contra el registro digital. |
| CU-T09 | Modo Offline | **Completo** | Arquitectura preparada con localStorage e IndexedDB. Las actualizaciones GPS fallidas se encolan (max 5) y se reenvian al recuperar conexion. |
| CU-T10 | Consultar Historial | **Completo** | Pestana en la aplicacion movil con historial de viajes completados. Muestra fecha, manifiesto, generador, operador y estado final. |
| CU-T11 | Gestionar Flota | **Completo** | Gestion de vehiculos y choferes del transportista. Alta, edicion y baja de vehiculos con datos de patente, tipo, capacidad. Gestion de choferes con DNI y licencia. |

### 7.4 Operador (12 Casos de Uso)

| ID | Nombre | Estado | Descripcion |
|----|--------|--------|-------------|
| CU-O01 | Login Operador | **Completo** | Autenticacion JWT. El operador accede a su panel con manifiestos asignados a su planta. |
| CU-O02 | Ver Manifiestos Entrantes | **Completo** | Lista de manifiestos en estado ENTREGADO asignados al operador. Accesible desde web y aplicacion movil. |
| CU-O03 | Confirmar Recepcion | **Completo** | Endpoint funcional para confirmar la recepcion de residuos en planta. Cambia estado de ENTREGADO a RECIBIDO. |
| CU-O04 | Registrar Pesaje | **Completo** | Registro del peso real medido en planta con comparacion automatica contra el peso declarado por el generador. Calcula y almacena el porcentaje de diferencia. |
| CU-O05 | Registrar Diferencias | **Completo** | Calculo automatico de la diferencia entre peso declarado y peso real. Registro del tipo de diferencia y porcentaje. Generacion de alerta si la discrepancia supera el umbral configurado. |
| CU-O06 | Rechazar Carga | **Completo** | Endpoint para rechazar una carga no conforme, indicando el motivo del rechazo. Cambia estado de ENTREGADO a RECHAZADO. Notifica automaticamente al generador y al transportista. |
| CU-O07 | Firmar Recepcion Conforme | **Completo** | Confirmacion de recepcion conforme a traves del endpoint `confirmarRecepcion`. Registra la aceptacion formal del residuo por parte del operador. |
| CU-O08 | Registrar Tratamiento | **Completo** | Registro del inicio del tratamiento del residuo, indicando el tipo de tratamiento aplicado. Cambia estado de RECIBIDO a EN_TRATAMIENTO. Estado intermedio que permite registrar el proceso. |
| CU-O09 | Cerrar Manifiesto | **Completo** | Cierre del manifiesto a traves del endpoint `cerrarManifiesto`. Cambia estado a TRATADO. Habilita la generacion del certificado de disposicion final. |
| CU-O10 | Generar Certificado de Disposicion | **Completo** | Generacion de PDF del certificado de disposicion final mediante PDFKit. Boton disponible en la pagina de detalle del manifiesto en estado TRATADO. Descargable por todos los actores. |
| CU-O11 | Consultar Historial | **Completo** | Pestana en la aplicacion movil con historial de manifiestos procesados. Filtros por fecha, estado y tipo de residuo. |
| CU-O12 | Generar Reportes | **Completo** | Acceso a la pagina compartida de reportes (`/reportes`) con estadisticas de residuos recibidos, tratados, certificados emitidos y tiempos de procesamiento. |

### 7.5 Sistema (12 Casos de Uso)

| ID | Nombre | Estado | Descripcion |
|----|--------|--------|-------------|
| CU-S01 | Generar Numero de Manifiesto | **Completo** | Generacion automatica de numero unico con formato `YYYY-NNNNNN` (ej: 2026-000001). Secuencial, reinicio anual, garantia de unicidad mediante indice unico en base de datos. |
| CU-S02 | Validar Datos del Manifiesto | **Completo** | Validaciones del backend en cada paso de la creacion: campos obligatorios, formato de CUIT, existencia de actores referenciados, coherencia de corrientes de residuo entre generador y operador. |
| CU-S03 | Enviar Notificaciones | **Completo** | Generacion automatica de notificaciones in-app en cada transicion de estado del manifiesto. 11 tipos de notificacion, 4 niveles de prioridad. El canal de email esta postergado para una version futura. |
| CU-S04 | Registrar Auditoria | **Completo** | Registro automatico de todos los eventos del manifiesto en la tabla `EventoManifiesto` y en el log de auditoria. Incluye fecha, usuario, accion, datos anteriores y posteriores, IP del cliente. |
| CU-S05 | Sincronizar Datos Offline | **Pendiente** | Requiere implementacion completa de sincronizacion bidireccional con IndexedDB y Service Worker. La arquitectura base esta preparada (localStorage para GPS, estructura PWA). Planificado para la siguiente version. |
| CU-S06 | Generar Codigo QR | **Completo** | Generacion automatica del codigo QR al firmar el manifiesto. El QR contiene el numero de manifiesto y una URL de verificacion. Se incluye en el PDF del manifiesto. |
| CU-S07 | Calcular Estadisticas | **Completo** | Calculo de metricas para el dashboard y los reportes: totales por periodo, distribuciones por categoria, rankings de actores, tendencias temporales. Datos de demostracion incluidos. |
| CU-S08 | Detectar Anomalias de Transporte | **Completo** | Algoritmo de deteccion de anomalias GPS con 6 tipos de deteccion: exceso de velocidad (>120 km/h), detencion prolongada (>2h), perdida GPS (>30min), transito excesivo (>24h), desvio de ruta, zona restringida. |
| CU-S09 | Backup Automatico | **Completo** | Respaldo automatico de la base de datos PostgreSQL. Configuracion mediante herramientas nativas de PostgreSQL (pg_dump) y politicas de retencion. |
| CU-S10 | Orquestacion BPMN | **Pendiente** | Motor de workflow BPMN para orquestar las transiciones de estado del manifiesto de forma configurable. Clasificado como POST-MVP. Actualmente las transiciones estan implementadas con logica directa en los endpoints. |
| CU-S11 | Firma Digital Conjunta | **Pendiente** | Firma digital conjunta del manifiesto por multiples actores (generador + transportista + operador). Requiere integracion con infraestructura de firma digital de la Provincia. Clasificado como POST-MVP. |
| CU-S12 | Reintentar Certificaciones Blockchain | **Completo** | Cron job que se ejecuta cada 60 segundos y procesa registros blockchain en estado PENDIENTE o ERROR. Maximo 3 reintentos por manifiesto. Solo se ejecuta en la instancia PM2 0 para evitar duplicacion en modo cluster. |

### Resumen de implementacion

| Modulo | Total CU | Completos | Parciales | Pendientes | % Completo |
|--------|----------|-----------|-----------|------------|------------|
| Administrador | 16 | 15 | 1 | 0 | 94% |
| Generador | 12 | 12 | 0 | 0 | 100% |
| Transportista | 11 | 11 | 0 | 0 | 100% |
| Operador | 12 | 12 | 0 | 0 | 100% |
| Sistema | 12 | 9 | 0 | 3 | 75% |
| **TOTAL** | **63** | **59** | **1** | **3** | **94%** |

**Detalle de pendientes:**

| ID | Nombre | Razon | Prioridad |
|----|--------|-------|-----------|
| CU-A04 | Asignar Roles y Permisos | Middleware implementado, falta UI granular | Media |
| CU-S05 | Sincronizar Datos Offline | Requiere IndexedDB + Service Worker completo | Alta |
| CU-S10 | Orquestacion BPMN | Clasificado como POST-MVP | Baja |
| CU-S11 | Firma Digital Conjunta | Requiere integracion con PKI provincial | Baja |

---

## Historial de Versiones del Documento

| Version | Fecha | Descripcion |
|---------|-------|-------------|
| 2026.1 | Febrero 2026 | Version inicial del manual integral del sistema |
| 2026.3 | Marzo 2026 | Modulo de Certificacion Blockchain: seccion 3.10, API modulo 10, CU-A20 y CU-S12, actualizacion de workflow y seguridad |

---

*SITREP — Sistema de Trazabilidad de Residuos Peligrosos*
*Direccion General de Fiscalizacion Ambiental — Provincia de Mendoza*
*Desarrollado por Ultima Milla S.A.*
