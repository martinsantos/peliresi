# Borrador de manifiesto después de cerrar web o app — 24/10/2026

**Publicado 462ad75acd0323801f69e2e7643f87a0ced0f8cf en backend, web, app y manual a las 06:52:10 Mendoza.** Sustituye dd4eb8bc. Manual **2026.24.1**, worker raíz **v168**, app **20261024094810**.

## Comportamiento

El formulario guarda campos y paso con cada edición en almacenamiento persistente del navegador, sin esperar al evento de cierre. Al reabrir e ingresar con la misma cuenta/contexto, Nuevo Manifiesto recupera el borrador. No crea un manifiesto ni envía avisos automáticamente.

La clave separa persona, rol, actor, CAP, empresa, actividad y establecimiento. Las pestañas del mismo navegador y las vistas web/app comparten una copia por contexto y reciben sus actualizaciones. Antes de aplicar una edición se lee la última copia; los eventos atrasados no reemplazan el valor más reciente.

Los borradores sessionStorage de la versión anterior se migran al abrir el formulario actualizado. Crear correctamente o descartar con confirmación guarda una marca de eliminación que evita que una pestaña antigua resucite la copia. Un rechazo conserva lo ingresado. Si el almacenamiento persistente falla, se advierte y se conserva temporalmente en memoria; no se muestra como guardado.

La vigencia es de siete días desde la última edición. Cerrar sesión no elimina el borrador y otra cuenta no lo ve. No se sincroniza entre dispositivos, navegadores o perfiles separados. Borrar datos del sitio, desinstalar o cerrar navegación privada puede eliminarlo. No puede recuperar datos que una versión anterior ya perdió antes de actualizar.

Guía pública: https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=navegacion-manifiestos-inspecciones

## Pruebas

- **190 unitarias únicas PASS**, sin omitidas; **10 repetidas PASS** sobre el hook tras la protección final contra eventos atrasados. No sumar las repeticiones al total.
- **33 E2E PASS en una pasada**, sin fallos, omitidos ni flaky: 11 por superficie (web escritorio 1440 × 900, web móvil 360 × 800, app 390 × 844), ADMIN/GENERADOR/TRANSPORTISTA/OPERADOR.
- Incluyen **12 casos de cierre completo**, con tres sesiones de Chromium por caso y perfil de disco reutilizado: carga → cierre → recuperación → descarte → cierre → formulario vacío. Sin inyección de storageState ni uso de sessionStorage para restaurar el formulario.
- Regresiones: salir/recargar, filtros, Inspecciones móvil, error de cuenta inactiva y creación exitosa que limpia el borrador. Las únicas seis entradas de error de consola son los tres HTTP 400 deliberados de elegibilidad y sus mensajes del navegador; sin errores inesperados.
- Tipos/builds web/app PASS; lint dirigido **0 errores/62 advertencias preexistentes**. Revisión visual de capturas de recuperación en escritorio y app.
- QA remota: contenedor SITREP, 1 CPU/2 GiB/swap adicional cero/un worker; base artificial y solicitudes a producción bloqueadas desde las páginas de prueba. Runtime cerrado y evidencia preservada. Browser plugin no disponible; se usó el Playwright existente del preview conforme a las restricciones remotas.
- Build de publicación de **2.520 archivos Git exactos**, cotejados antes/después. Seis archivos de producto modificados y 18 archivos del overlay coinciden con los probados. Backend sin cambios de lógica/esquema/dependencias/migraciones.

## Producción y reversión

Smoke **187/187**, externo **9/9**, PWA **8/8 PASS**, sólo GET y sin logins ni mutaciones de negocio. Las rutas protegidas se verifican sin sesión (401); no se presentan como creación/aprobación productiva. Los contadores técnicos de admisión existentes pueden registrar esas solicitudes.

Dos workers en línea. .env, flags, esquema, dependencias y Nginx iguales al estado anterior. CAP cerrado, correos/push apagados; uploads e historiales preservados. Sin main, datos reales, migración, push ni workflows.

- Backend: /var/www/sitrep-backend-releases/20261024-producto-462ad75a
- Web/app/manual: /var/www/sitrep-releases/20261024-producto-462ad75a
- Respaldo privado: /var/backups/sitrep/20261024-producto-462ad75a
- Reversión preparada a backend **dd4eb8bc** y frontend /var/www/sitrep-releases/20261024-producto-462ad75a-rollback, worker **v169**, app **20261024095107**. No ejecutada.

Configuración/PM2 y releases previas respaldados. Sin nueva copia de base porque no existe migración ni operación sobre registros. Si falla esta publicación, desde el directorio privado de respaldo ejecutar `node - rollback < publish-production.ts`. No restaurar bases ni usar una reversión anterior.

Evidencias locales: workspace del hilo, **borrador-persistente-20261024**: source-files.json, qa-evidence.tar.gz (sin perfiles del navegador), qa/persistent-draft, console-summary.json y release/{source-proof,qa-summary,build,stage,deployment,preflight,postflight,smoke,external-smoke,pwa-smoke,release-result}.json.

Main intacto: c8402190edfc36b5e5d0dee1337c24bd1689420d. El cierre documental posterior no cambia el commit de producto publicado. Android físico/PWA instalada en teléfono, sensores GPS y capacidad sostenida siguen fuera de esta tanda.
