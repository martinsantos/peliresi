# Continuidad de padrones y Ayuda — 24/10/2026

**Publicado `8fb6277ecabaace83671a9dfb251147a43c9ccbf` en backend, web, app y manual el 24/10/2026 a las 19:28:47 Mendoza.** Corrige los tres pendientes detectados después de 7af655f7. Despliegue, smoke y seis recorridos visuales productivos completados, sin operaciones de negocio.

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

## Publicación y comprobación de producción

- Compilación remota de **2.546 archivos Git exactos** antes y después; tipos, backend, web y app PASS. Cero OOM. Esquema, migraciones y dependencias idénticos.
- **217/217 smoke público + 9/9 externo + 8/8 PWA**, sólo GET, sin logins ni operaciones de negocio. Hashes de recursos, chunks, manual y captura coinciden con los paquetes. Los contadores técnicos de admisión pueden registrar estas consultas.
- **Seis recorridos visuales en producción**, G/T/O × web/app: búsqueda/filtros/página → alta vacía → volver. Sin completar, guardar ni enviar formularios. Generadores conserva página 2 y estado; Transporte conserva localidad; Operadores conserva modalidad y corriente Y. App conserva el contexto al recargar. Ayuda permanece en el encabezado, cero superposiciones y cero desborde horizontal; diálogo contextual comprobado. Cero errores de consola.
- El filtro de Malargüe devuelve los tres transportistas del padrón; IN SITU + Y8 devuelve 31 operadores y permite la segunda página. Las altas permanecieron vacías. Sesión administrativa existente, sin cambiar usuarios ni permisos.
- Dos workers online desde el nuevo release; `.env` idéntico, SHA-256 `b19526c365883d577d3cb5f82a9894d4b9f790b7a4a69831c6d2a77a8631811d`; flags actuales preservados, CAP cerrado y correo/push apagados. Sin main, workflows ni migraciones.
- Manual **2026.24.1** verificado en navegador productivo; SW web **trazabilidad-rrpp-v176**, app **20261024222609**. Actualizaciones activadas mediante el aviso existente, sin formularios en edición.
- Respaldo privado **`/var/backups/sitrep/20261024-producto-8fb6277e`**: configuración/PM2 y hashes de releases anteriores conservados. No se necesitó respaldo/restauración de base porque no hay migración ni escrituras de negocio.
- Reversión preparada a **7af655f7**: backend anterior y frontend `/var/www/sitrep-releases/20261024-producto-8fb6277e-rollback`, SW **v177**, app **20261024222803**. Usar únicamente `publish-production.ts rollback` de este respaldo, tras revisar el estado vigente; no reversiones históricas.
- Evidencias: `release/build.json`, `release/qa-summary.json`, `release/source-proof.json`, `release/deployment-output.json`, `release/smoke.json`, `release/external-smoke.json`, `release/pwa-smoke.json`, `release/after.json`, `production-browser-checks.json` y capturas reales `production-web-alta.jpg` / `production-app-alta.jpg`.
- Preview cerrado: runtime y servidor propios detenidos sin señal forzada, PostgreSQL artificial cerrado limpiamente, contenedor y túneles del hilo detenidos. Datos sintéticos y evidencias conservados. Auditoría final: 515 manifiestos y cero envíos/intentos.

## Límites conservados

No modifica main, esquema, migraciones, dependencias, permisos, flags ni workflows. No incluye operaciones sobre datos reales. Android físico, teclado nativo y cierre de PWA instalada siguen pendientes. El orden por última actividad conserva su implementación previa; esta tanda corrige el alcance de filtros, no rediseña el ordenamiento. No equivale a validación exhaustiva del producto.
