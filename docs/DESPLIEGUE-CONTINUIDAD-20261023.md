# Publicación de continuidad e Inspecciones móvil

**dd4eb8bc9ebc1dd77f48a20a50d36dbd2b46bc94 publicado en backend, web, app y manual de sitrep.ultimamilla.com.ar el 23/10/2026 a las 22:44:34 Mendoza.** Sustituye b891e288. Manual **2026.23.8**, service worker raíz **v166**, app **20261024014143**.

## Cambios visibles

- Nuevo manifiesto: conserva todos los campos y el paso al salir al listado o recargar, por pestaña/cuenta/rol/actor/actividad. Descartar pide confirmación; crear correctamente limpia la copia; un rechazo conserva los campos.
- Listado: búsqueda, etapa, estado, actores, fechas y orden sobreviven al detalle, al formulario y a la recarga. Corregida la carrera del router que podía recuperar filtros anteriores.
- Móvil: el panel expandido de filtros de Manifiestos se desplaza y no tapa los resultados. Inspecciones concentra estado, tipo, exportación y ayuda bajo Filtros; conserva búsqueda, etapas, agenda, expediente en curso y señalización de filtros aplicados.
- La copia del formulario usa sessionStorage, con vencimiento de siete días dentro de la pestaña. No es un borrador en servidor ni sincroniza dispositivos; cerrar la pestaña puede eliminarlo. Si el almacenamiento falla, se conserva navegación interna en memoria y se advierte antes de salir.

## Pruebas y publicación

Preview real con datos artificiales, 1 CPU/2 GiB/swap adicional cero/un worker. **185/185 unitarias PASS**, tipos y builds PASS, lint dirigido 0 errores/62 advertencias preexistentes. **42 casos E2E únicos PASS** para ADMIN, GENERADOR, TRANSPORTISTA y OPERADOR en escritorio, web móvil y /app. El recuento combina las últimas ejecuciones de cada caso, sin contar repeticiones; no representa una sola pasada final de 42. Ver [historia del diagnóstico y repeticiones](UI-CONTINUIDAD-20261023.md).

El build de publicación verificó **2.517 archivos Git exactos** antes y después. Los archivos de producto coinciden con los probados. Backend compilado y publicado sin cambios de lógica, esquema, migraciones o dependencias en esta tanda. API final de Ultima Milla; sin workflows ni compilación pesada local. Runtime de pruebas cerrado, evidencias/base artificial conservadas.

Producción: **187/187 comprobaciones**, **9/9 externas** y **8/8 PWA PASS**. Smoke sólo GET, sin logins ni mutaciones de negocio; las rutas protegidas responden 401 sin sesión. Estos controles no se presentan como operaciones funcionales sobre datos reales. Los GET pueden actualizar los contadores técnicos de admisión existentes.

Verificación visual adicional con sesión ADMIN existente, sin guardar ni enviar formularios:
- Web: aceptar la actualización, abrir Manifiestos con En curso, abrir el formulario vacío y volver. La selección En curso permanece y la URL conserva fase=en_curso.
- App: aceptar la actualización, abrir Inspecciones a 390 × 844, expandir/plegar Filtros. La lista compacta y los controles se ven; filtros avanzados se muestran sólo al expandir.
- Pantallas no vacías, sin overlay de error; sin errores/advertencias capturados en consola en ambas pestañas. Tamaño del navegador restaurado.

Dos workers en línea. .env byte por byte, flags, esquema, dependencias y Nginx idénticos al estado previo. Uploads, historiales y otros servicios conservados. **CAP cerrado, correos/push apagados**. Cero usuarios/manifiestos/aprobaciones reales creados o modificados; sin main, push ni workflows.

## Respaldo y reversión vigente

- Backend: /var/www/sitrep-backend-releases/20261023-producto-dd4eb8bc
- Web, app y manual: /var/www/sitrep-releases/20261023-producto-dd4eb8bc
- Respaldo y evidencia privados: /var/backups/sitrep/20261023-producto-dd4eb8bc
- Reversión preparada al backend **b891e288**, y frontend /var/www/sitrep-releases/20261023-producto-dd4eb8bc-rollback con SW **v167**, app **20261024014345**. No ejecutada.

Se preservaron releases/hashes previos y respaldaron .env/PM2 en privado. No hubo migración ni operación de datos, por lo que no se tomó un nuevo respaldo de base.

Si falla esta publicación, desde el directorio privado de evidencia ejecutar `node - rollback < publish-production.ts`. Conserva esquema, configuración, uploads e historiales. No restaurar base ni usar las reversiones históricas.

## Evidencias y límites

Workspace del hilo, carpeta **continuidad-ui-20261023**: unit.json, coverage.json, source-files.json, qa-evidence.tar.gz; subcarpeta release con source-proof.json, qa-summary.json, build.json, stage.json, deployment.json, preflight.json, postflight.json, smoke.json, external-smoke.json, pwa-smoke.json y release-result.json. Capturas production-web-form.png, production-web-filters-return.png, production-app-inspections.png y production-app-inspections-filters.png. Conservados fallos iniciales y trazas finales.

Main permanece **c8402190edfc36b5e5d0dee1337c24bd1689420d**. El commit de cierre documental posterior no modifica la revisión de producto publicada.

No certifica Android físico, sensores GPS, recuperación tras cerrar pestañas, otras secciones, entrega externa ni capacidad sostenida. Las pruebas que crean/cambian manifiestos se hicieron sólo en preview artificial.
