# Continuidad del plan y activación de circuitos — 22/10/2026

Estado: **publicado `45c79bb9` en backend, web, app y manual de sitrep.ultimamilla.com.ar el 22/10/2026 10:34:40 Mendoza**. Incluye `5080ee82` y la política de autoridades autorizada por el dueño: **los cuatro roles, sin cambiar cuentas**. CAP permanece cerrado y los correos/push externos apagados. No se trabaja en main ni con datos de negocio reales.

## Inventario confirmado

Producción inspeccionada en lectura el 22/10/2026 09:22 Mendoza: **86a9b790**, backend/web/app/manual. Propuestas de tres partes, certificados, relevos y GPS múltiple habilitados. Eventuales, adendas y revisión posterior apagados. Dos workers online, canales apagados y CAP cerrado.

| Tanda | Estado al retomar | Acción de esta revisión |
| --- | --- | --- |
| Agenda completa, pendientes de certificado y continuidad de altas | `5080ee82`, probado sólo en preview | Integrada, verificada con los circuitos activos y publicada con respaldo previo a la migración de borradores. |
| Eventual v2 | Código publicado, flag apagado | Creación por participantes, aprobaciones, rechazo, hechos, diferencias, avisos y antecedentes PSIP verificados fuera de CAP; habilitado. |
| Adendas y hallazgos | Código publicado, flags apagados; autoridades individuales sin configurar | Política por rol implementada; partes, autoridades, avisos y versiones verificadas; habilitadas. |
| Propuestas, certificados, relevo y GPS múltiple | Publicados y habilitados | Conservar flags y guardas; probar integración afectada, sin reescribir históricos. |
| Manual | Producción 2026.21.5; candidato 2026.22.1 | Publicado 2026.22.2 con autoridades y continuidad; renderer/CSS conservados y recorrido web/app verificado. |
| Correos y push externos | Apagados | Mantener apagados. Sólo intenciones y contenido simulado, sin entregas. |
| Enterprise y multirol | Apagados | Conservar configuración. No son requisito de los circuitos aprobados en esta tanda. |

## Política aprobada y límites

`MANIFEST_REVIEW_AUTHORITY_BY_ROLE=true` selecciona autoridades por su rol actual, sin alterar cuentas. Para adendas ordinarias: ADMIN, ADMIN_GENERADOR, ADMIN_OPERADOR y ADMIN_TRANSPORTISTA activos. Para revisión administrativa de eventuales: ADMIN, conservando el límite de roles de la especificación v2. No permite autoaprobación, suplantación ni sesiones restringidas. El cambio de rol o la desactivación revoca el permiso en el servidor. CAP conserva su ámbito aislado.

Con el flag ausente o false se mantiene la lista explícita `MANIFEST_EXCEPTIONAL_REVIEWERS`. La política de destinatarios coincide con la política de autorización. Si no hay autoridad activa para una corriente nueva, la decisión se rechaza con error recuperable y se conserva el motivo; no se registra una aprobación parcial ni se omite el aviso.

La aprobación tripartita ordinaria, las aprobaciones de participantes del eventual y la revisión individual de adendas son contratos diferentes. Revisar una adenda no modifica habilitaciones, declaración original ni hechos físicos y no acredita unanimidad. El eventual sigue sin número oficial y permite datos externos incompletos según la especificación aprobada.

## Ejecución y evidencia

Único checkout activo y rama `codex/sitrep-training-20261018`. QA remota en `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, esquema nuevo `reactivation_20261022`; datos artificiales. Una tarea pesada por vez, un worker, 1 CPU/2 GiB/swap cero. Evidencia local ignorada: `test-results-reactivation-20261022/`.

La prueba inicial de la nueva selección de autoridades dio **1 PASS / 7 FAIL** antes del cambio. Se conserva `authority-before.json`. La regresión dirigida posterior pasó **57/57**. Suites completas del candidato: **1.481/1.481 backend y 1.811/1.811 frontend**, cero omitidos. Backend/tipos/builds web y app PASS. Continuidad: **32/32 E2E** en escritorio, web angosta y app. HTTP: **10 grupos de adendas, 6 de autoridades y 11 de eventuales**, todos PASS. Manual final 7/7; lint de nueve archivos sin errores, 15 advertencias. Se corrigieron dos guardas de los tests que sólo aceptaban los nombres de previews anteriores; se admite expresamente el esquema artificial nuevo, conservando las expectativas funcionales y los controles de aislamiento. Eventuales/adendas/autoridades: **30/30 E2E**, total **62/62 únicos**, cero omitidos o reintentos. **171 capturas** (99 continuidad + 72 circuitos), revisión visual de escritorio/web angosta/app; sin desborde horizontal ni errores de consola en los recorridos. No certifica teléfonos físicos, Android, GPS de campo ni entrega externa.

Publicación completada: backup verificado antes de `20261022130000_actor_form_drafts`, preservación de `${UPLOADS_DIR}-private-drafts`, build con API final, versiones nuevas de SW, enlaces de release y smoke no mutante. Reversión sin restaurar base ni borrar borradores, documentos, antecedentes o aprobaciones; conservar backend capaz de interpretar los nuevos registros.


## Auditoría final del preview

**723 tablas QA anteriores intactas**, cuatro alias CAP rechazados con 403 y proveedores cerrados en ambos procesos. Adendas: 146 avisos simulados en las cuatro fases (creada, observada, aprobada y rechazada); cero intentos, envíos o cola activa. El original, sus residuos y eventos permanecieron intactos. No se crearon cuentas operativas ni se asignaron roles reales.

Runtime y PostgreSQL cerrados; contenedor detenido **22/10/2026 10:28:46 Mendoza**. Límites 1 CPU/2 GiB/swap cero, un worker, tareas pesadas seriales; todos los contadores de presión/OOM del cgroup en cero. Imagen, base artificial y evidencias preservadas.

## Publicación y respaldo

Commit de producto: **`45c79bb9a42da9bdcc6a183f7d08c983dddb098e`**, mensaje con `[skip ci]`. Build exacto de **2391 blobs** antes y después de compilar; backend/tipos/web/app PASS. `VITE_API_URL=https://sitrep.ultimamilla.com.ar/api`. Paquetes verificados por SHA-256; sin instalar dependencias en producción. Manual **2026.22.2**. SW raíz **trazabilidad-rrpp-v152**, app **20261022132606**.

Backup privado: `/var/backups/sitrep/20261022-circuitos-45c79bb9/trazabilidad_rrpp-before-45c79bb9.dump`, **23,800,268 bytes**, SHA-256 `87a757fcbc060c31c1a25c05a246ce04604f2c26478dd45bd2bbc07bf08ba5eb`. Se verificaron el inventario de ambos esquemas, la decodificación completa a `/dev/null` y el hash repetido antes de migrar. No se restauró la base ni se inspeccionaron filas. Los borradores privados también están respaldados en `/var/backups/sitrep/20261022-circuitos-45c79bb9/private-drafts-before.tar.gz`.

Única migración: **`20261022130000_actor_form_drafts`**. `prisma migrate deploy` aplicado en public; el mismo SQL aditivo en transacción con el propietario restringido de CAP para conservar compatibilidad, manteniendo CAP cerrado. Dos tablas, 18 columnas y 5 índices por esquema; historial y checksums anteriores intactos. `prisma migrate status`: actualizado. Ningún DML sobre datos de negocio.

Activaciones autorizadas: `MANIFEST_EXCEPTIONAL_ENABLED=true`, `MANIFEST_ADDENDA_ENABLED=true`, `MANIFEST_PARTY_REVIEW_ENABLED=true` y **`MANIFEST_REVIEW_AUTHORITY_BY_ROLE=true`**; tres flags Vite correspondientes true. Sólo cambiaron esas cuatro entradas del entorno; SHA final **`988d42eebd8fde9ad163db25f124a6680f6054849c6ce7c346f03ce284536872`**. Lista de IDs vacía conservada. Propuestas, certificados, relevos y GPS múltiple permanecen true; enterprise/multirol/demo false. `UPLOADS_DIR=/var/lib/sitrep-uploads` conservado; borradores privados en `/var/lib/sitrep-uploads-private-drafts` con permisos 0700 y fuera de la carpeta pública.

**CAP cerrado, correos/push apagados**, claves de proveedor vacías; verificado en los dos workers y configuración PM2 guardada. Cuentas, roles e identidades de conexión conservados. `main` **`c8402190edfc36b5e5d0dee1337c24bd1689420d`** intacto; sin push ni workflows.

Smoke final no mutante: **144/144** desde servidor, **9/9 externo**, **8/8 PWA**. Cero logins y mutaciones de negocio por el smoke. Dos workers online estables (PID 689465/689480, contador de reinicios 37). El primer smoke externo todavía esperaba los flags apagados del release anterior: se corrigió esa expectativa para exigir las activaciones autorizadas y se repitió completo; no hubo cambio de producto por ese ajuste. Evidencia local ignorada: `test-results-deploy-45c79bb9/`; respaldo operativo en `/var/backups/sitrep/20261022-circuitos-45c79bb9/`.

## Reversión preparada

Preparada y verificada, **no ejecutada**. Restaura sólo web/app/manual **86a9b790**, conservando **backend 45c79bb9**, flags activos, migración, borradores, certificados, aprobaciones y antecedentes. La interfaz anterior oculta los accesos nuevos y no ofrece recuperar los borradores; sus datos permanecen disponibles para la versión nueva. Es una reversión de interfaz, **no una solución para fallas del backend**; esas requieren corrección compatible. No degradar el backend, apagar guardas ni restaurar una base antigua.

```bash
ssh root@23.105.176.45 'node /var/backups/sitrep/20261022-circuitos-45c79bb9/publish-production.js rollback'
```

Releases activos: `/var/www/sitrep-backend-releases/20261022-circuitos-45c79bb9` y `/var/www/sitrep-releases/20261022-circuitos-45c79bb9`. Reversión visual: `/var/www/sitrep-releases/20261022-circuitos-45c79bb9-rollback`, SW **trazabilidad-rrpp-v153** y app **20261022133143**. El script comprueba respaldo, migración, archivos, entorno, salud y procesos antes de cambiar el enlace. No ejecutar reversiones históricas que alteren los flags o las guardas.
