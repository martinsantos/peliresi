# Revisión de espacios por rol y padrones — preview

Continuación de `7d2d943f`; producción conserva `51e4271a`. Esta tanda no se publica.

## Contrato del producto

- Generador, transportista y operador operan sobre sus manifiestos y reciben avisos. No tienen acceso al módulo de Inspecciones. Responden únicamente al requerimiento recibido, con autorización comprobada por servidor.
- Los administradores sectoriales gestionan su ámbito. La designación explícita de inspector no se deduce de ser un actor ni concede administración de cuentas.
- Inicio orienta el trabajo pendiente; Manifiestos conserva la consulta completa. No se vuelven a agregar listados de actividad que repitan esa cola.
- Un destino conserva su nombre, sección activa y superficie web/app. Las acciones principales, secundarias y los filtros tienen posiciones comunes.

## Cambios de esta tanda

Los padrones de Generadores, Operadores y Transportistas comparten una barra de acciones. El título lo proporciona el marco de navegación; se elimina el segundo encabezado «Admin…» y su subtítulo genérico. El alta es la acción principal. CSV, PDF e impresión se agrupan en Exportar y se deshabilitan si no hay datos disponibles. Escape cierra las exportaciones y devuelve el foco.

La búsqueda queda a la vista. Los filtros adicionales se despliegan a demanda; los aplicados conservan un resumen legible cuando el panel se cierra. Restablecer no borra la búsqueda. Los recordatorios de Generadores tienen un panel propio plegado por defecto; abrirlo o seleccionar destinatarios no crea avisos ni envía mensajes.

Estado en Operadores y Transportistas ahora se envía al servidor para consultar todo el padrón; antes filtraba sólo los registros de la página. Tipo/corriente de operadores y localidad de transportistas siguen refinando la página y lo indican expresamente. La búsqueda de estos dos padrones ofrece razón social o CUIT, que son los campos que consulta el servidor.

Las tarjetas móviles son controles accesibles con nombre de actor y foco visible. La selección y paginación tienen objetivos táctiles de 44 px. Las tres altas tienen regreso identificado al padrón y el título distingue Nuevo, Editar y Renovar. Se corrigen rutas que abandonaban la superficie `/mobile`; la app independiente conserva su basename `/app`.

Cuando no se puede descargar una pantalla, se explica que debe revisarse la conexión y recargar, manteniendo la dirección. No se ofrece un reintento que vuelva a ejecutar la misma importación fallida en caché. La recuperación observada al inicio del trabajo requirió restablecer el túnel al contenedor preview; no fue una caída de producción.

## Verificación

La suite dirigida pasó **463/463 pruebas** de interfaz, navegación por rol, límites del requerimiento, altas, adjuntos y filtros. Tras los últimos ajustes de texto/espacio se repitieron **13/13** de controles y consultas; son una repetición, no pruebas adicionales. Tipos y builds web/app PASS. **20/20 HTTP** comprueban el bloqueo del módulo/expediente de Inspecciones para G/T/O, el acceso limitado al requerimiento propio y el rechazo del ajeno, además de los accesos del personal autorizado.

Control visual con navegador real y datos sintéticos:

- Administrador: los tres padrones y las tres altas en web/app. En web, Continuar sin datos explica los obligatorios y enfoca razón social. Regreso explícito al padrón, sin guardar fichas.
- App: filtros plegables, Estado Inactivo con resultado vacío explicado, alta y regreso conservando `/app`. Tarjeta de generador abierta con Enter. A 320 px, documento sin desborde horizontal y Exportar/Filtros de 44 px; capturas principales a 393 px. Escritorio a 1280 px.
- Generador, transportista y operador: menús sin Inspecciones/directorios ajenos en ambas superficies, encabezado con función y Inicio con una cola de pendientes. Perfil del generador sin acceso vacío a Empresas.
- Aviso del generador: abre el requerimiento y permite volver a Avisos. Presentación anterior registrada, autoridad como siguiente responsable. Cambiar a transportista en ese destino rechaza el acceso y ofrece regresar a sus propios avisos. No se envió una nueva respuesta.
- Actualización de caché de app mediante su control visible; guía de padrones encontrada desde la búsqueda del manual.

La auditoría conserva **515 manifiestos, 0 correos enviados, 0 intentos de envío**, CAP cerrado y correo/push apagados en los dos procesos del preview. No se afirma una prueba Android física ni de producción. No hubo altas, modificaciones de actores o manifiestos en esta tanda; las lecturas de avisos/requerimientos pueden actualizar su recepción en el entorno sintético.

La primera suite tuvo 459 pruebas correctas y dos expectativas obsoletas sobre el encabezado duplicado y el contenedor de filtros; se actualizaron al contrato nuevo. La primera comprobación de tipos detectó metadatos de filtros colocados también en columnas; se corrigieron antes de los builds. Se conservan las evidencias iniciales junto a los resultados finales.

Evidencia local del hilo: `role-workspaces-20261024` bajo el workspace `01a14c11-b01f-7b40-87c5-1672e1d92833`: `unit.json`, logs, `role-boundaries-http.json`, `audit.json`, `source-files.json`, `browser-checks.json` y capturas. Captura sintética incorporada al manual: `docs/manual/screenshots/mobile/role-padron-generadores-20261024.png`.

## Pendientes que no se consideran aprobados

| Área | Pendiente concreto |
| --- | --- |
| Filtros de padrones | Llevar tipo/corriente/localidad a consultas globales y conservar todos los filtros al salir/volver de fichas y altas. |
| ABM por actor | Recorrer exhaustivamente edición, renovación, adjuntos y recuperación bajo errores de red; las pruebas dirigidas no certifican cada combinación posible. |
| Fichas y reportes | Extender el patrón de orientación y acciones a las secciones restantes, sin alterar los permisos específicos. |
| Accesibilidad | Auditar todos los diálogos y controles con teclado y lectores de pantalla; esta tanda sólo cubre los componentes cambiados. |
| Campo | Android físico, cierre de PWA instalada y GPS en campo siguen pendientes de dispositivo. |
| Concurrencia | Esta tanda no es una prueba de carga ni certifica cientos de acciones simultáneas. |

No se presenta una mejora visual como validación completa del producto. Se conserva CAP cerrado, correo/push apagados, los flags actuales y el aislamiento del preview. Sin producción, main, workflows ni datos reales.
