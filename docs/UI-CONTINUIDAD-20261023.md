# Continuidad de manifiestos e Inspecciones móvil — 23/10/2026

## Alcance

- El nuevo manifiesto conserva paso, actores, modalidad, residuos, cantidades, transporte asignado, fecha y observaciones al volver al listado o recargar.
- La copia se guarda en sessionStorage por persona, rol, actor, entorno CAP/ordinario y actividad/establecimiento. Dura hasta siete días dentro de la misma pestaña. No crea registros ni avisos. No se sincroniza entre dispositivos ni promete sobrevivir al cierre de la pestaña.
- Descartar exige confirmación. Una creación exitosa elimina la copia; un rechazo del servidor conserva los campos. Si el almacenamiento falla, la navegación interna conserva una copia en memoria y se advierte antes de recargar/cerrar.
- La URL del listado conserva búsqueda, etapa, estado, actores, fechas y orden. El detalle y el formulario regresan al contexto recibido. El retorno sólo admite el listado de la misma superficie.
- Se detectó y corrigió una carrera: la URL cambia antes de actualizarse las filas durante una transición del router. Un clic rápido debe capturar los filtros vigentes, no los del render anterior.
- Se corrigió además el panel de filtros expandido de Manifiestos en móvil: ahora puede desplazarse y no tapa los botones del listado. La prueba conserva el panel abierto al entrar al detalle.
- Inspecciones móvil conserva búsqueda, etapas horizontales, agenda y expediente en curso. Estado, tipo, exportación y ayuda se agrupan bajo Filtros. Los filtros aplicados quedan identificados al cerrar el panel; escritorio mantiene sus controles visibles.
- Manual de contenido **2026.23.8**, guía `navegacion-manifiestos-inspecciones`.

## Verificación

Preview real en contenedor SITREP: 1 CPU, 2 GiB, sin swap adicional, un worker. Datos artificiales; CAP cerrado; correos/push apagados. Android físico queda fuera de esta tanda.

**185/185 unitarias de interfaz/manual PASS**, sin omitidas. Tipos y builds web/app PASS; lint dirigido: 0 errores y 62 advertencias preexistentes.

**42 E2E únicos aprobados**, con cuatro roles en escritorio, web móvil y app. La primera pasada completa dejó 32 aprobados, un fallo del guion y nueve casos pendientes. Se corrigió la comparación de la ruta interna de BrowserRouter (sin su basename /app), sin cambiar el comportamiento para satisfacer esa comprobación.

El caso ampliado de búsqueda y fechas detectó un defecto real adicional: el panel fijo expandido tapaba el botón en la app. Después del ajuste pasaron los tres casos de filtros combinados y los nueve casos restantes de app. El registro coverage.json une las últimas ejecuciones de cada caso y confirma los 42; no se cuentan las repeticiones como cobertura adicional.

Casos cubiertos: recuperación de todos los campos/paso tras salir y recargar para ADMIN, GENERADOR, TRANSPORTISTA y OPERADOR; aislamiento de borradores; descarte confirmado/cancelado; limpieza tras creación y conservación ante rechazo; filtros después de detalle, recarga y formulario; controles móviles de Inspecciones a 320/390 px; escritorio a 1440 px, navegación de expediente, agenda, aprobaciones e íconos.

El almacenamiento local bloqueado se prueba con unidad y conserva navegación interna en memoria. No garantiza recuperación después de cerrar la pestaña ni sincronización entre dispositivos. Android físico, captura GPS y servicios de mapas externos no forman parte de este cierre.

La publicación está autorizada y se prepara sobre esta revisión. El cierre de despliegue registrará la versión efectivamente publicada y el smoke no mutante; este resultado de preview no se presenta como prueba de operaciones sobre producción.

Evidencias de esta tarea: `continuidad-ui-20261023` en el workspace del hilo: unit.json, coverage.json, source-files.json y qa-evidence.tar.gz. Los fallos de retorno, de aserción del guion y del panel expandido se conservan, junto con capturas y trazas finales. No cambian backend, esquema, migraciones ni dependencias; no hubo correos/push, main, datos reales ni workflows.

