# Claridad de recorridos por rol — preview

Base de producto: 51e4271a. Esta revisión no publica cambios ni altera permisos de negocio.

## Contrato revisado

| Rol | Inicio | Manifiestos / Viajes | Inspecciones | Avisos |
| --- | --- | --- | --- | --- |
| Generador | Pendientes propios | Crear, aprobar y seguir los propios | Sin módulo | Requerimiento notificado y respuesta acotada |
| Transportista | Pendientes propios | Viajes, relevos y GPS autorizado | Sin módulo | Requerimiento notificado y respuesta acotada |
| Operador | Pendientes propios | Recibir, tratar y certificar los propios | Sin módulo | Requerimiento notificado y respuesta acotada |
| Administración | Pendientes de su ámbito | Consulta y seguimiento autorizados | Gestión de su ámbito | Seguimiento de comunicaciones |
| Inspector designado | Trabajo de inspección | Según permisos existentes | Casos autorizados | Comunicaciones de sus casos |

La designación de inspector es explícita; ser actor no otorga acceso al módulo.
Empresas y establecimientos se ofrece sólo si hay acceso real; la vista temporal no permite administrar representación.

## Correcciones de esta tanda

- Un destino activo por menú: las fichas administrativas no seleccionan también el directorio superior.
- Viaje y GPS pertenecen a Viajes; requerimientos a Avisos. Los rótulos de rol son iguales en web y app.
- Inicio conserva una sola cola compacta con número, próxima acción, empresas e iconos de aprobación.
- Manifiestos separa Listado y Programados. No superpone dos listados ni consulta la agenda cerrada.
- Regreso explícito al origen: Inicio o listado con filtros. No se aceptan destinos externos.
- Los enlaces del perfil conservan el recorrido móvil; no se inventa una afiliación DGFA cuando falta el sector.
- El transportista conserva Manifiestos en la barra inferior; Reportes sigue en el menú. GPS tiene un único encabezado.
- El historial usa los mismos nombres que Monitor; habilitar la certificación no se presenta como emitirla.
- Se elimina el contador de resultados duplicado. El destino activo del menú web conserva texto e icono blancos al pasar el puntero.
- Manual actualizado con dos capturas reales del preview, identificadas como datos sintéticos.

## Verificación

375 pruebas frontend dirigidas PASS en 28 archivos. Tras el último ajuste de contraste, repetición de las 34 pruebas del menú PASS. No son 409 pruebas únicas. TypeScript y builds web/app PASS; manual completo cotejado por contenido.

20 comprobaciones HTTP PASS: los tres actores reciben 403 al intentar entrar al directorio o expediente administrativo y al requerimiento ajeno; pueden acceder al intercambio propio. Administración e inspectores conservan sus permisos.

Recorrido real con CUA en web a 1280 px y app a 393 px para Generador, Transportista, Operador y Administrador. Comprobación adicional del operador a 320 px. Se revisaron menús, una sola cola en Inicio, perfil sin enlace a Empresas vacío, sección activa, regreso al origen y filtros. Programados mostró su estado vacío en esta base; paginación y búsqueda con 51 registros se probaron en unitarias.

Se envió una respuesta sintética del transportista desde Avisos: quedó registrada, pasó la acción a la autoridad y el administrador recibió el aviso y abrió el intercambio correcto. Las respuestas sintéticas previas del generador y operador se recuperaron en ambas superficies. Cambiar a operador desde un requerimiento de generador produjo una explicación de acceso denegado, sin revelar el contenido.

Auditoría del preview: 515 manifiestos antes/después, cero correos enviados y cero intentos de envío; CAP cerrado y push apagado en los dos procesos. Sin producción, datos reales, main, push Git ni workflows. Ejecución remota serial, 1 CPU/2 GiB/swap0; sin builds pesados locales.

La primera repetición detectó un selector ambiguo de prueba al incorporar Manifiestos a la barra inferior; se acotó al menú desplegable y se repitió. El control visual posterior detectó el contraste en hover y motivó el ajuste final. No se ocultan estos fallos.

Evidencias: workspace del hilo, carpeta `workspace-clarity-20261024`: `source-files.json`, `browser-checks.json`, `browser-console.json`, capturas PNG y resultados remotos. Las observaciones de navegador no se cuentan como E2E independientes.

## Alcance y continuidad

Esta tanda verifica accesos y recorridos principales; no acredita una revisión exhaustiva de cada formulario, ABM, reporte, PDF/correo, accesibilidad de todos los diálogos o carga concurrente. Android físico, GPS de campo y cierre de PWA instalada siguen pendientes. El ajuste es de interfaz; no cambia las reglas de aprobación ni los datos de manifiestos históricos.

Preview disponible en `http://127.0.0.1:4177`. Publicación vigente: 51e4271a; esta tanda todavía no está en producción.
