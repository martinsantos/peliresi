# Continuidad de padrones y Ayuda — 24/10/2026

Tanda autorizada posterior a 7af655f7. Corrige los tres pendientes detectados en la comprobación de producción. Publicación pendiente hasta completar el despliegue y su smoke de lectura.

## Cambios

- Generadores, Transportistas y Operadores guardan búsqueda, filtros, página y orden en la URL. Las fichas y formularios conservan el regreso al mismo padrón; la app mantiene su ruta. Los cambios de filtro reinician la página sin sobrescribir otros filtros; Restablecer conserva la búsqueda.
- Tipo y corriente Y del operador, y localidad del transportista, se consultan antes de contar y paginar. Localidades se obtiene de todo el conjunto autorizado. Los filtros se combinan con búsqueda, estado y límites de acceso por rol; no modifican habilitaciones ni modalidades.
- Ayuda queda en el encabezado de padrones, fichas y altas de las dos interfaces. Se conserva la ayuda contextual y la validación junto al campo.
- Manual actualizado con el comportamiento y una captura sintética del alta móvil.

## Verificación

Preview remoto existente, 1 CPU, 2 GiB, sin swap, ejecución serial. Base sintética aislada, sin conexión a producción.

- **481 pruebas frontend únicas verificadas**: corrida de 480/481; una expectativa antigua del botón de tour se actualizó para Ayuda contextual; repetición final de la suite afectada **37/37**. No se suman las repeticiones al total.
- **250 pruebas backend** dirigidas PASS. La primera corrida tenía flags de funcionalidades activos incompatibles con los mocks de unitarias de auditoría; se repitió con los defaults aislados. Runtime e integración conservan los flags activos.
- **19 comprobaciones HTTP de padrón completo** con 72 actores artificiales (24 por tipo): segunda página, totales, localidad fuera de la primera página, estados, FIJO/IN SITU, modalidad doble, Y8 sin confundir Y80, combinaciones y rechazo de filtros inválidos.
- **20 comprobaciones HTTP de límites por rol** PASS.
- Tipos y builds backend, web y app PASS; manual sincronizado y comprobado.
- Navegador real: seis recorridos de alta/regreso (G/T/O × web/app), ficha/edición/regreso y recarga, segunda página de Generadores, filtros combinados de Transporte/Operador. Sin errores de consola.
- Ayuda sin intersección con campos en los seis formularios con errores visibles; operador también a 320 px. Diálogo contextual abierto/cerrado sin perder la pantalla.
- 515 manifiestos antes/después; cero correos enviados e intentos; CAP cerrado y push apagado. No se crearon altas por formulario ni manifiestos.

Evidencias locales: `padrones-continuidad-20261024` en el directorio de evidencias del hilo (JSON, logs, capturas y herramientas de release). Los nueve registros de observación del navegador no representan nueve E2E independientes.

## Alcance y límites

No modifica main, esquema, migraciones, dependencias, permisos, flags ni workflows. No incluye operaciones sobre datos reales. Android físico, teclado nativo y cierre de PWA instalada siguen pendientes. El orden por última actividad conserva su implementación previa; esta tanda corrige el alcance de filtros, no rediseña el ordenamiento. No equivale a validación exhaustiva del producto.
