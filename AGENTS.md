# SITREP - Sistema de Trazabilidad de Residuos Peligrosos

> **Tanda pendiente de validación y publicación — 23/10:** Vista temporal, Ayuda, Monitor y la integración de Antecedentes dentro de Inspecciones están preparados en esta rama. El preview no responde por SSH; no dar por finalizadas las pruebas ni publicar sin recuperarlo. Producción sigue en `6580c1ca`. Ver [alcance, evidencia parcial y pendientes](docs/CORRECCIONES-VISTA-TEMPORAL-AYUDA-MONITOR-20261023.md). CAP cerrado, correos/push apagados; sin main ni datos reales.

## Publicación vigente — identidad, experiencia y concurrencia, 23/10/2026

**`6580c1ca` publicado en backend, web, app y manual de sitrep.ultimamilla.com.ar el 23/10/2026 14:21:27 Mendoza.** Incluye toda la tanda acumulada desde `a7f20d2f`: identidad/PDF/correos/iconos, bienvenida por rol, preferencia web/app, ayuda contextual y cuatro correcciones de concurrencia. Leer [publicación, respaldo y reversión vigente](docs/DESPLIEGUE-PRODUCTO-CONCURRENCIA-20261023.md).

Build de **2.483 archivos Git exactos**, backend/Prisma/tipos/web/app PASS con API final y flags actuales. Backup completo verificado antes de las **dos migraciones aditivas**; operativo y CAP compatibles, sin habilitar CAP. Smoke **182/182**, externo **9/9**, PWA público **8/8**; sin logins ni operaciones de negocio. Workers 1/2 estables. `.env` idéntico, uploads conservados; **CAP cerrado, correos/push apagados**. Manual **2026.23.3**, SW **v160**, app **20261023171533**.

**Reversión vigente a `a7f20d2f`**, preparada y no ejecutada, conserva base/migraciones/flags. Worker rollback **v161**. No usar reversiones históricas. Pruebas funcionales previas en preview: 1.653 backend, 132 frontend dirigidas, 15 grupos concurrentes y 12 E2E únicos, más revisión de identidad documentada. No repetirlas como pruebas productivas.

**Pendientes explícitos:** limpieza de contadores abandonados bloqueada por el control automático (expiración funcional), carga sostenida, durabilidad de eventos/reconexión GPS y Android físico. Sin main, push ni workflows. Preview permanece activo. Los cierres inferiores describen antecedentes; esta sección sustituye las indicaciones de “sólo preview” y migraciones pendientes de esa tanda.

## Correcciones de concurrencia — verificadas sólo en preview, 23/10/2026

**Cuatro defectos corregidos:** vehículo/chofer de Monitor por asignación y tramo, últimos 500 puntos GPS sin perder el más reciente, incidencia única ante eventos simultáneos y cuotas compartidas por persona que no bloquean a todos los usuarios de una IP. Web/app conservan sesión y formularios ante esperas temporales. Leer [cambios, pruebas y pendientes](docs/CORRECCIONES-CONCURRENCIA-20261023.md).

**1.653 backend / 132 frontend dirigidas / 15 grupos concurrentes / 12 E2E únicos PASS**; builds/tipos/migración artificial PASS. Manual **2026.23.3**. Primeros fallos del guion GPS y del mensaje de login conservados; correcciones y repeticiones documentadas. Lint: 0 errores/68 advertencias. 64 tablas QA protegidas intactas; cero envíos.

Preview activo en **http://127.0.0.1:4177**, serial/un worker/1 CPU/2 GiB/sin swap adicional; dos API dentro del mismo límite para probar coordinación. Sin producción, main, push ni workflows. CAP cerrado, correos/push apagados. **No acredita capacidad sostenida ni Android físico.**

**Pendiente operativo:** limpieza de claves abandonadas de admisión bloqueada por el control automático; no se eludió ni se borraron registros. Expiración/reutilización sí funcionan, pero no se declara acotado el tamaño total. Migración nueva `20261023133000_shared_api_admission` y previa `20261023120000_user_link_preference` pendientes de una publicación futura autorizada. Publicación documentada sigue `a7f20d2f`; los cierres inferiores son antecedentes.

## Revisión de identidad y concurrencia — preview activo, 23/10/2026

**Antecedente: diagnóstico inicial; los cuatro fallos fueron corregidos en la tanda de concurrencia de arriba. Los cambios de identidad siguen sólo en preview.** Leer [identidad y experiencia](docs/PRODUCTO-IDENTIDAD-AYUDA-20261023.md) y [auditoría operativa](docs/CONCURRENCIA-OPERATIVA-20261023.md).

SITREP y flecha verdes sobre blanco; cabecera PDF con Mendoza/DGFA a la izquierda y SITREP a la derecha, proporcional al correo. Incluye acceso público, recuperación, relevo externo, manual, favicon, icono maskable y página offline. Bienvenida por rol, preferencia web/app y ayuda disponibles en el preview.

Validación nueva desde `df55126b`: **240 unitarias dirigidas / 54 E2E únicos PASS**, 22 secciones por superficie, 14 PDF/43 páginas, 198 escenarios de comunicaciones/614 renders. Backend/tipos/builds PASS; lint 37 archivos: 0 errores/36 advertencias. No confundir con las suites completas históricas de abajo.

Carga sintética serial: tandas de **50/100/200 acciones HTTP** sin errores; aprobaciones repetidas y conflicto de adenda consistentes. **Pendientes confirmados:** Monitor muestra vehículo de la empresa en vez del asignado; incidente GPS duplicado 20 veces; endpoint de recorrido pierde el punto 501; límite por IP bloquea 100/700 solicitudes válidas. No hay certificación de capacidad productiva.

**Preview disponible en http://127.0.0.1:4177 mediante túnel privado en esta Mac**, contenedor `sitrep-qa-training-20261018`, PostgreSQL/runtime conservados activos para revisión. Guardas verificadas: CAP cerrado, cero intentos/envíos/cola activa, correos/push apagados, 64 tablas QA protegidas intactas. 1 CPU/2 GiB/swap cero, sin OOM. Sin producción, main, push ni workflows; cierre con `[skip ci]`.

La publicación documentada sigue siendo `a7f20d2f`; migración de preferencia `20261023120000_user_link_preference` pendiente de una publicación autorizada. No publicar bundles QA `/api`. Android físico, GPS de sensores, PWA instalada, clúster y entrega externa no certificados. Los cierres inferiores son históricos.

## Identidad, bienvenida y enlaces — sólo preview, 23/10/2026

**Corregido y probado; no publicado.** Leer [cambios, galería, pruebas y límites](docs/PRODUCTO-IDENTIDAD-AYUDA-20261023.md). Cabecera PDF institucional compartida, flecha verde sobre blanco sin recuadro, paginado/documentos extensos, bienvenida por ocho perfiles, preferencia Web/App guardada por persona y ayuda contextual antes del reporte técnico. Corregidos títulos de secciones en web/app. Los documentos firmados existentes conservan sus bytes.

**1.597 backend / 1.879 frontend / 141 E2E únicos PASS**; comprobaciones posteriores: 80 unitarias de layouts, 21 de enlaces y 8 del manual, más navegador afectado. **47 E2E por superficie**, sin contar repeticiones. 14 PDF/43 páginas, revisión de 22 secciones por superficie, galería 198 escenarios. Tipos/builds PASS. Lint de 31 archivos modificados: cero errores/31 advertencias; el lint global mantiene deuda preexistente, detallada en el informe.

Manual **2026.23.1**, renderer/recorridos preservados y cabecera blanca. Nueva migración aditiva **20261023120000_user_link_preference**, probada sólo en base artificial; publicación futura requiere backup/migración y builds con API final. Los bundles QA no se publican.

**CAP cerrado, correos/push apagados, cero envíos; sin producción, main, push ni workflows.** Preview serial/un worker/1 CPU/2 GiB/swap cero, cerrado **23/10/2026 11:00:33 Mendoza**, imagen/base/evidencias conservadas; límite de memoria alcanzado sin OOM. La publicación y reversión vigentes siguen siendo las de `a7f20d2f` de abajo. Android físico, sensores, captura por PWA instalada y entrega externa pendientes.

## Validación adicional — web y app en preview, 23/10/2026

**105/105 E2E y 382/382 unitarias dirigidas PASS** sobre producto `a7f20d2f`, sin cambios de producto ni despliegue. Leer [alcance, resultados y evidencia](docs/VALIDACION-WEB-APP-PREVIEW-20261023.md). Login, una razón social con G/T/O y dos personas en total incluida la titular, representantes, propuestas por los tres actores, ciclo completo con certificados y enlaces exactos tras login. **35 E2E por superficie**: escritorio, web angosta y `/app`; 249 capturas. Se conserva el fallo inicial del guion de entrega y su corrección, seguida de 3/3 ciclos completos PASS.

**CAP cerrado, correos/push apagados, cero envíos**. Preview serial/un worker/1 CPU/2 GiB/swap cero, detenido **23/10/2026 07:47:43 Mendoza**; bases artificiales e imagen conservadas, sin OOM. Sin producción, main, push ni workflows. Manual **2026.22.7** verificado, sin cambios. Android físico queda para cuando el dueño tenga el teléfono; no certifica PWA instalada, sensores ni entrega externa. La publicación y reversión vigentes de abajo no cambian.

## Publicación vigente — empresa y multirol, 22/10/2026

**`a7f20d2f` publicado en backend, web, app y manual de sitrep.ultimamilla.com.ar el 22/10/2026 22:47:21 Mendoza.** Leer primero [resultado, respaldo y reversión vigente](docs/DESPLIEGUE-MULTIROL-20261022.md). **Empresa y multirol habilitados** en backend/web/app; una razón social, varias actividades aprobadas y **dos personas en total incluida la titular**, sin sumar cupos por rol o sede. Sin vincular cuentas existentes por inferencia.

Pruebas nuevas sobre el commit final: **1.582/1.582 backend, 1.862/1.862 frontend y 33/33 E2E PASS**, sin omitidos/reintentos; HTTP **131 + 133 solicitudes**, empresa **7 grupos** y multirol **8 grupos PASS**; 66 capturas. Compilación/tipos/builds PASS, **2.444 archivos Git exactos**, API final. Preview serial/un worker/1 CPU/2 GiB/swap cero, detenido **22:43:59 Mendoza**, bases artificiales e imagen conservadas; sin OOM.

**CAP cerrado, correos/push apagados**; uploads, identidad y demás flags conservados. Sólo cambian empresa/multirol. Sin migraciones: **28/28 ya aplicadas**, esquema idéntico. Backup privado completo verificado antes de activar. Smoke no mutante **161/161 + externo 9/9 + PWA 8/8**, sin sesiones ni operaciones sobre datos de negocio. Dos workers estables. Manual **2026.22.7**, mismo renderer/CSS; SW **v158**, app **20261023014306**.

**Reversión vigente a 712de167**, preparada y no ejecutada, con empresa/multirol apagados como antes, demás guardas conservadas, sin restaurar base ni borrar registros. Worker de reversión v159/app 20261023014611. No usar reversiones históricas. Main intacto; sin push/workflows, cierre `[skip ci]`. Android físico, PWA instalada y entrega externa siguen pendientes. Los cierres anteriores son antecedentes.

## Validación previa — multirol y dos personas, 22/10/2026

**Validación previa, incorporada en la publicación a7f20d2f de arriba.** Leer [correcciones, alcance y evidencia](docs/MULTIROL-DOS-PERSONAS-20261022.md). Una razón social con G/T/O mantiene **dos personas en total, incluida la titular**, compartidas entre roles y sedes. Corregidos el bypass de tercera persona en alta/aprobación, la inferencia de solicitudes pendientes, invitaciones duplicadas o irrecuperables y una consulta blockchain ajena al alcance del representante de una sede. Sin ampliar permisos ni alterar históricos.

**1.582 backend / 1.858 frontend / 33 E2E únicos PASS**; después del último ajuste de visibilidad, **30 unitarias y 3 E2E** finales PASS. Invitaciones y tres roles de la segunda persona repitieron otros **6 E2E PASS**; no suman casos únicos. HTTP **131 + 133 solicitudes**, empresa **7 grupos** y multirol **8 grupos PASS**. Tipos/builds PASS, lint 0 errores/42 advertencias, 84 capturas. Manual **2026.22.7**, mismo renderer/CSS. El informe conserva el timeout inicial de la suite completa y el detalle cosmético previo del encabezado de Transporte.

**1.038 tablas QA previas intactas**, cero intentos/envíos/cola activa; CAP cerrado y correos/push apagados. Preview detenido **21:38:34 Mendoza**, imagen/base/evidencias preservadas, serial/un worker/1 CPU/2 GiB/swap cero, sin OOM ni presión. Main intacto; sin producción, push ni workflows; cierre `[skip ci]`.

Al cerrar esa revisión, producción seguía en **712de167** con empresa/multirol apagados. La publicación a7f20d2f de arriba la incorpora y habilita. Android físico y entrega externa pendientes; los bundles QA `/api` no se publican.

## Publicación anterior — comunicaciones, 22/10/2026

**`712de167` publicado en backend, web, app y manual de sitrep.ultimamilla.com.ar el 22/10/2026 20:15:03 Mendoza.** Leer [evidencia y reversión vigente](docs/ENLACES-AVISOS-CORREOS-20261022.md). Incluye enlaces exactos de correos/campana, plazo PSIP, recordatorios desde la firma y las revisiones previas de formularios/representación. Manual **2026.22.6**, estilos y renderer conservados.

Build serial remoto de **2.439 archivos Git exactos**, API final, 1 CPU/2 GiB/swap cero; backend, tipos, web y app PASS, sin OOM. Smoke no mutante **150/150 + externo 9/9 + PWA 8/8**, sin logins, consultas a datos de negocio ni mutaciones. Dos workers estables. `.env` idéntico; **CAP cerrado, correos/push apagados y flags actuales**. Empresa y multirol continúan apagados. Sin migraciones ni instalación de dependencias; archivos, cuentas y uploads conservados.

**Reversión vigente a 8a4d8225 en los cuatro componentes**, sin restaurar la base. Respaldo privado de configuración verificado. SW raíz **v156**, app **20261022230746**. Un control detuvo la activación de frontend al observar reinicios concurrentes de SGI; PM2 confirma que nuestro comando sólo recargó SITREP (IDs 1/2). Se verificó estabilidad de SITREP y se completó frontend; incidencia y evidencias conservadas, sin administrar servicios ajenos.

Preview detenido **20:16:27 Mendoza**; imagen/base/evidencia conservadas. Main intacto, sin push ni workflows, cierre documental `[skip ci]`. QA previa: **1.579 backend / 1.854 frontend / 45 E2E únicos**, no se vuelve a contar como prueba de producción. Android físico, captura del enlace por PWA instalada y entrega externa siguen sin certificar.

Las secciones de QA que siguen son antecedentes; esta publicación las incorpora sin habilitar empresa/multirol.

## Enlaces y comunicaciones verificados — sólo preview, 22/10/2026

**Cerrado, no publicado.** Leer [contrato de enlaces, eventos, plazos y evidencia](docs/ENLACES-AVISOS-CORREOS-20261022.md). Base `443cafe9`. Acceso principal `/app/` y alternativa web al mismo registro; destino conservado tras login, adenda exacta y ficha privada de aviso. Resúmenes con acceso por aviso; plazo PSIP conservado. **Los 30 días se cuentan desde la firma**, por decisión del dueño: fases idempotentes a los 23 y 30 días, con supresión al cerrar/cancelar/rechazar y revalidación antes de una entrega futura.

**1579 backend / 1854 frontend / 45 E2E únicos PASS**, 75 capturas; tipos/builds y galería 198 escenarios PASS. Lint 0 errores/66 advertencias. Manual **2026.22.6**, renderer/CSS conservados. Galería en `test-results-communication-links-20261022/gallery/index.html`; 197 muestras de correo, 167 de campana, ocho perfiles; control de emisores nuevos sin catalogar.

**975 tablas QA previas intactas**, cero intentos/entregas/cola activa; CAP cerrado y correos/push apagados. Preview detenido **22/10/2026 19:40:52 Mendoza**, imagen/base/evidencias conservadas. Serial/un worker/1 CPU/2 GiB/swap cero, sin OOM. Sin producción, main, datos reales, push ni workflows. Cierre `[skip ci]`.

La publicación documentada permanece en **8a4d8225**. Esta tanda, ABM/representación y la revisión previa continúan sin publicar. No usar bundles QA `/api` en producción. **Android físico y apertura automática en PWA instalada siguen pendientes**; correo externo y push no se enviaron ni certificaron.

## Revisión web/app cerrada — sólo preview, 22/10/2026

**Cerrada, no publicada.** Leer [correcciones, matriz y evidencia](docs/REVISION-WEB-APP-20261022.md). Base `891cfc86`; se corrige pérdida de texto al completar envíos/cambiar de actividad, controles pequeños, encabezados, prioridad de observaciones y contraste. Manual **2026.22.5**, mismo renderer/CSS.

**316 E2E únicos PASS**, sin casos pendientes en el consolidado. Suites completas: **1542 backend / 1842 frontend** antes de los últimos ajustes; regresión final **122 unitarias PASS**. Tipos/builds PASS; lint 0 errores/43 advertencias. Representación 131 solicitudes HTTP, multirol 8 grupos, relevos 18, flota 8, seguimiento/conciliación 7+7. Las repeticiones no se suman como casos únicos.

**912 tablas QA previas intactas**, cero intentos/entregas/cola activa; CAP cerrado y correos/push apagados. Preview cerrado **22/10/2026 18:32:36 Mendoza**, imagen/base/evidencias conservadas. Serial/un worker/1 CPU/2 GiB/swap cero; alcanzó el límite de memoria sin OOM. Sin producción, main, datos reales, push ni workflows; cierre `[skip ci]`.

**Android físico queda al final por pedido del dueño.** No es certificación de dispositivos ni entrega externa. La publicación documentada sigue siendo `8a4d8225`; esta tanda y ABM/representación siguen sin publicar. No usar bundles QA `/api` para producción.

## Revisión ABM y representación — sólo preview, 22/10/2026

Leer primero [alcance, cambios, pruebas y cierre](docs/ABM-MULTIROL-REPRESENTANTES-20261022.md). Identidad por CUIT con G/T/O aprobados; máximo **dos personas en total incluida la titular**, compartido entre roles/establecimientos; responsable explícito, invitaciones y revocaciones separadas. Altas revisadas y administrativas vinculan la entidad; no se duplican cuentas ni se cambian históricos por inferencia. Formularios conservan cambios ante avisos/conflictos. Campana y familia de correo `representacion`, sin activar entregas.

**1.542 backend / 1.842 frontend / 105 E2E únicos PASS**; regresión final 68 backend, 26 frontend y 15 E2E, manual final 8 unit + 3 E2E (repeticiones). HTTP 7 grupos empresa + 8 multirol + 131 solicitudes. Manual **2026.22.4**, mismo renderer/CSS y dos capturas directas. Galería 20 plantillas / 40 vistas con logos locales, sin red ni envíos. Lint 0 errores/49 advertencias; builds/tipos PASS.

**849 tablas QA previas intactas**, cero cola activa/intentos/entregas; CAP cerrado, proveedores/correos/push apagados. Preview cerrado **15:11:38 Mendoza**, 1 CPU/2 GiB/swap cero, sin OOM; alcanzó el límite de memoria en el bloque completo. Imagen/base/evidencias conservadas. No se accedió a producción ni se modificó main; sin push/workflows, commit `[skip ci]`.

**No publicado.** Producción sigue en **8a4d8225** y su reversión vigente de abajo. Empresas y multirol permanecen apagados allí; publicar/activar esta tanda requiere autorización expresa. No usar bundles QA `/api` para producción. No certifica dispositivos físicos, documentos fiscales ni entrega externa de correo.

## Publicación vigente — eventuales, 22/10/2026

**`8a4d8225` publicado en backend, web, app y manual el 22/10/2026 12:18:43 Mendoza.** Búsqueda completa y etapas, retorno al filtro, actualización entre participantes y recuperación de acciones/notas sin pérdida ni duplicación. Leer primero [cambios, evidencia y reversión vigente](docs/EVENTUALES-CONTINUIDAD-20261022.md).

**1.497 backend / 1.818 frontend / 30 E2E únicos / 6 grupos HTTP PASS**; comprobaciones finales dirigidas y del manual detalladas en el informe. Manual **2026.22.3**, renderer/CSS conservados. Build de **2.397 blobs exactos**, API final y flags actuales. Smoke no mutante **144/144 + externo 9/9 + PWA 8/8**; dos workers estables. Sin migraciones ni cambios de configuración/datos de negocio. **CAP cerrado, correos/push apagados**, cuentas/uploads conservados. SW v154/app 20261022151220.

**Reversión vigente a backend/web/app/manual 45c79bb9**, con idéntico esquema, flags y contratos de escritura; preparada, no ejecutada. No restaurar base ni usar reversiones anteriores. Preview detenido 22/10/2026 12:15:02 Mendoza; imagen/base/evidencias conservadas, sin OOM (el build alcanzó el límite de memoria y recuperó caché). Main intacto, commits `[skip ci]`, sin push/workflows. No certifica dispositivos físicos ni entrega externa.

## Publicación anterior — circuitos y continuidad, 22/10/2026

**`45c79bb9` publicado en backend, web, app y manual el 22/10/2026 10:34:40 Mendoza.** Leer primero [cambios, evidencia, respaldo y reversión vigente](docs/REACTIVACION-CIRCUITOS-20261022.md). Incluye agenda completa, certificados pendientes y continuidad de formularios (`5080ee82`); **eventuales/adendas/revisión habilitados**. Autoridades de adendas por los cuatro roles activos, sin cambiar cuentas; eventuales conservan autoridad ADMIN.

**1.481 backend / 1.811 frontend / 62 E2E únicos / 27 grupos HTTP PASS**, 171 capturas; manual 2026.22.2. Backup completo verificado antes de la única migración aditiva de borradores; public/CAP compatibles, CAP cerrado. Smoke no mutante **144/144 + externo 9/9 + PWA 8/8**. Dos workers estables, correos/push apagados, uploads y cuentas conservados. SW v152/app 20261022132606.

**Reversión histórica de aquella publicación, sustituida por la de 8a4d8225: sólo de interfaz a 86a9b790**, conservando backend 45c79bb9, todos los flags y registros; preparada, no ejecutada. No usar reversiones antiguas ni restaurar base. Preview detenido 22/10/2026 10:28:46 Mendoza, sin OOM/presión; imagen/base/evidencias conservadas. Main intacto, cierre `[skip ci]`, sin push/workflows. No es certificación de dispositivos físicos ni entrega externa.

## Revisión de agenda, certificados y continuidad — sólo preview, 22/10/2026

**Validación previa de la primera tanda, incorporada en la publicación 45c79bb9 de arriba.** Leer [cambios, manual, evidencia y condiciones de publicación](docs/AGENDA-CERTIFICADOS-CONTINUIDAD-20261022.md). Agenda de manifiestos paginada sin corte de cien, búsqueda/filtros completos y tareas de certificación final; recuperación de altas de G/T/O con datos, paso y adjuntos privados, guardado automático y conflictos explícitos. Históricos y permisos conservados. Manual **2026.22.1**, mismo renderer/CSS.

**1.473/1.473 backend, 1.811/1.811 frontend y 32/32 navegador**, sin omitidos ni reintentos, en escritorio/web angosta/app; **99 capturas E2E**. Migración aditiva de dos tablas en esquema artificial y builds/tipos PASS; lint dirigido sin errores (47 advertencias). **660 tablas QA previas intactas**, cero intentos/cola activa de correo, cuatro alias CAP 403; canales apagados en ambos procesos.

Preview serial/un worker/1 CPU/2 GiB/swap cero; runtime/PG cerrados y contenedor detenido **09:06:57 Mendoza**. El cgroup tocó el límite de memoria sin OOM; imagen/base/evidencias preservadas. No se accedió a producción; `main` `c840219` intacto, sin push/workflows; cierre `[skip ci]`. No certifica teléfonos físicos ni entrega externa.

**Condiciones de aquella validación, cumplidas en 45c79bb9:** autorización y respaldo antes de la migración `20261022130000_actor_form_drafts`. Adjuntos recuperables en el directorio privado hermano `${UPLOADS_DIR}-private-drafts`, que también debe conservarse y respaldarse. No usar bundles QA `/api` ni revertir borradores borrando tablas/archivos. La publicación y la reversión vigentes figuran en el cierre 45c79bb9 de arriba.

## Publicación anterior — correos 86a9b790, 22/10/2026

**`86a9b790` publicado en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el 22/10/2026 07:01:00 Mendoza.** Leer primero [despliegue, comprobaciones y reversión vigente](docs/DESPLIEGUE-CORREOS-20261022.md). Se aclaran aprobación individual de adenda, comprobante repetido y cierre de tratamiento separado de emisión. Manual **2026.21.5**, renderer/CSS conservados.

**Configuración íntegra conservada**: `.env` SHA `c6ccba0f124f6048aa0f2b0d33d0aa9797a0c982a9d4a346798449cd2d72c2e6`, uploads/identidades y todos los flags actuales. **CAP cerrado, correos/push apagados**; sin envíos. Respaldo de configuración y releases anteriores verificado; sin migraciones, instalaciones productivas, consultas o cambios de datos de negocio.

Build exacto de **2.371 blobs**, API final, backend/tipos/web/app PASS; serial/un worker/1 CPU/2 GiB/swap cero. Smoke no mutante **139/139**, externo **9/9**, PWA **8/8**. Dos workers estables, SW raíz **v150** y app **20261022095612**. Preview detenido **06:56:51 Mendoza**, sin OOM; base/imagen/evidencias conservadas.

**Reversión vigente: backend/web/app/manual 19230380, todos los flags actuales y guardas de certificados conservados**, SW v151/app 20261022095932; preparada, no ejecutada. No restaurar una base ni usar la reversión anterior que apagaba certificados. Main `c840219` intacto; cierre `[skip ci]`, sin push/workflows.

## Validación previa — tres correcciones de correos, 21/10/2026

**Validación previa de `86a9b790`, publicado según el cierre de arriba.** Leer [correcciones, galería, manual y evidencia](docs/CORREOS-CLARIDAD-20261021.md). Se aclaran aprobación individual de adenda, comprobante repetido y cierre de tratamiento separado de emisión de certificados. Destinatarios, permisos, enlaces, controles y circuitos conservados. Manual **2026.21.5**, mismo renderer/CSS.

Preview: **160 backend / 37 interfaz y manual / 15 E2E** PASS; backend y builds web/app PASS. Galería actualizada: **180 escenarios, 9/9 grupos**, cero desbordes/errores/solicitudes externas. **536 tablas QA previas intactas**, cero intentos/envíos/cola activa, cuatro alias CAP 403. Serial/un worker/1 CPU/2 GiB/swap cero; contenedor detenido **21:34:23 Mendoza**, sin OOM; base/imagen/evidencias conservadas.

**En esa revisión no se accedió a producción. La publicación posterior figura arriba.** CAP cerrado y correos/push apagados. Main `c840219` intacto; commits `[skip ci]`, sin push/workflows. No certifica entrega externa ni dispositivos físicos. Galería local: `test-results-communications-20261021/index.html`.

## Última publicación — certificados 19230380, 21/10/2026

**`19230380` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el **21/10/2026 20:37:40 Mendoza**. **Certificados habilitados.** Leer primero [despliegue, respaldo, pruebas y reversión vigente](docs/DESPLIEGUE-CERTIFICADOS-20261021.md). Operador firma parciales/final; partes vinculadas reciben avisos en campana y descargan el mismo PDF. No se enviaron correos ni push.

**Backup verificado antes de migrar**: 23.787.087 bytes, SHA-256 `f103820b2b67f50e41ebb5c3c826789f1269a195ad0745a9608149ebf2f8cef3`, archivo privado en servidor y lectura completa sin restaurar. Única migración `20261021200000_manifest_certificates`, aplicada/verificada en public y CAP; historial anterior intacto, sin DML de negocio. No se consultaron registros reales.

Única activación: `MANIFEST_CERTIFICATES_ENABLED=true` y par Vite true. Resto de bytes de `.env` conservados; nuevo SHA `c6ccba0f124f6048aa0f2b0d33d0aa9797a0c982a9d4a346798449cd2d72c2e6`. Propuestas/relevos/GPS múltiple true; adendas/revisión/eventuales false, autoridades sin asignar. **CAP cerrado, correos/push apagados**, uploads e identidades conservados; comprobado en ambos workers y PM2 guardado.

Build de **2.366 blobs exactos**, API final, backend/tipos/web/app PASS; serial/un worker/1 CPU/2 GiB/swap cero. Smoke no mutante **138/138**, externo **9/9**, PWA **8/8**; dos workers estables, sin logins ni emisiones reales. Manual **2026.21.4**, renderer/CSS conservados; SW raíz **v148**, app **20261021233319**.

**Reversión vigente: apagar emisión y conservar backend/interfaz/manual 19230380, documentos, descargas y guardas. No ejecutar reversiones anteriores ni restaurar una base antigua.** Preparada y verificada, sin ejecutar; SW v149/app 20261021233627. Preview detenido **20:34:59 Mendoza**, sin OOM; imagen/base/evidencias preservadas. Main `c840219` intacto; cierre documental `[skip ci]`, sin push ni workflows.

## Validación previa — certificados ordinarios, 21/10/2026

**Validación previa a la publicación 19230380 registrada arriba.** Leer [emisión, acceso, avisos, evidencia y límites](docs/CERTIFICADOS-OPERATIVOS-20261021.md). Operador vinculado firma y emite parciales/final; generador y transporte reciben el aviso en la campana y descargan el mismo PDF conservado. Se corrigió el refresco de la bandeja abierta y el acceso al documento exacto. Totales, concurrencia, adendas y expediente firmado protegidos; históricos preservados.

Preview: suites completas **1456 backend / 1801 frontend** antes de los últimos ajustes; regresión final **95 backend / 127 frontend** PASS. **6/6 E2E únicos** en web/web angosta/app, API **6 grupos**, flag off y dos PDF PASS. Manual **2026.21.4**, **6 unit + 3 E2E** finales (subconjunto repetido), mismo renderer/CSS y capturas directas. Tipos/builds/lint sin errores; alcance de cada revisión detallado en el informe, sin GO global ni certificación física.

**475 tablas previas QA intactas**, 55 sobres de correo simulados, cero cola activa/intentos/envíos; cuatro alias CAP 403, proveedores/push apagados. Preview serial/un worker/1 CPU/2 GiB/swap cero; runtime/PG/contenedor cerrados **20:09:40 Mendoza**, sin OOM/presión; base, imagen y evidencias preservadas.

La revisión previa incorporó la migración aditiva `20261021200000_manifest_certificates` y flags independientes de certificados. La publicación autorizada y su nueva reversión están arriba; el informe conserva el alcance de las pruebas previas. Producción no se accedió durante esa revisión de QA. Main intacto, sin push/workflows.

## Publicación anterior — autoridades 66a1c29e, 21/10/2026

**`66a1c29e` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el **21/10/2026 15:45:25 Mendoza**. Leer primero [publicación, evidencia y reversión vigente](docs/DESPLIEGUE-AUTORIDADES-20261021.md). Soporte de cuatro funciones de autoridad incorporado, con designación explícita por ID; asignación de cuentas diferida por el dueño.

**Configuración íntegra conservada**: adendas/revisión/eventuales false, propuestas/relevos/GPS múltiple true, autoridades sin asignar; CAP cerrado y correos/push apagados. `.env` idéntico por hash `97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`, uploads/identidades y PM2 conservados. Sin consultas o modificaciones de negocio, main ni workflows.

Build exacto de **2.350 blobs**, API final, backend/tipos/web/app PASS; serial/1 CPU/2 GiB/swap cero. **Sin migraciones o instalaciones productivas**; respaldo de release/configuración verificado. Smoke no mutante **132/132**, externo **9/9**, PWA **8/8**; dos workers estables. Manual **2026.21.3**, renderer/CSS conservados; SW raíz **v146**, app **20261021184131**.

Reversión preparada a interfaz/manual **47ea8470**, conservando **backend 66a1c29e y todos los flags**. No usar reversiones anteriores que deshabilitan propuestas o degradan guardas; no restaurar base. Preview detenido **21/10/2026 15:42:23 Mendoza**, sin OOM/presión, evidencias preservadas. Cierre `[skip ci]`, sin push. Validación funcional previa: 1451 backend / 1796 frontend / 18 E2E, detallada abajo; no se repitió en producción.

## Autoridades de adendas — candidato probado, sin publicar, 21/10/2026

Leer primero [autoridades, validación y asignación diferida](docs/AUTORIDADES-ADENDAS-20261021.md). Se completó el soporte solicitado para **ADMIN, ADMIN_GENERADOR, ADMIN_OPERADOR y ADMIN_TRANSPORTISTA**, activos y **designados por ID**. Autoridad de adendas ordinarias y destinatarios de nuevas Y; sin autoaprobación, suplantación ni promoción automática por rol. Eventuales conservan sus permisos. No se modificaron cuentas reales ni se accedió a producción en esta tanda.

**1451/1451 backend, 1796/1796 frontend, 18/18 E2E únicos** en escritorio/web móvil/app. HTTP **10 + 5 grupos**, autoridad ausente y flags off PASS; builds/tipos/lint PASS. **415 tablas previas intactas**, 146 avisos de correo simulados, cero cola/intentos/envíos; CAP cerrado (cuatro alias 403), push/proveedores apagados. Manual **2026.21.3**, renderer/CSS conservados; sin migraciones. No certifica dispositivos físicos ni entrega externa.

Preview serial/1 worker/1 CPU/2 GiB/swap cero, cerrado **10:51:57 Mendoza**, sin OOM/presión; imagen/base/evidencia conservadas. Main `c840219` intacto, sin push/workflows; commit `[skip ci]`. Sólo checkout activo `sitrep-production-source-20261001`.

**Decisión del dueño — 21/10/2026:** por ahora alcanza con incorporar que autorizan Super Admin y las administraciones de Generadores, Operadores y Transporte. La identificación de cuentas concretas queda **diferida por pedido del dueño**, no como pregunta sin responder ni requisito para cerrar esta revisión. El soporte está probado en **f7b0ad60** y documentado en el manual. No volver a pedir correos en esta fase ni asignar cuentas o cambiar roles por inferencia. La implementación conserva la designación explícita por ID; su configuración se resolverá al preparar una futura activación. Esta aclaración no publica ni habilita nada. Los paquetes previos db68b24e no incluyen el cambio; no desplegar bundles `/api` de QA. Última versión productiva verificada previamente: **47ea8470**; reversión vigente intacta.

## Publicación db68b24e preparada, sin activar — 21/10/2026

Leer primero [preparación y bloqueo de autoridades](docs/PREPARACION-ADENDAS-20261021.md). Producción verificada en **47ea8470**, sin cambios. Build de **db68b24e** terminado: backend/tipos/web/app, 2.339 blobs exactos, API final, manual 2026.21.2, SW v144/app 20261021124024; serial/1 CPU/2 GiB/swap cero. Preview detenido **09:44:13 Mendoza**.

El dueño designó administradores de Generadores, Operadores y Transporte, más Super Admin. **db68b24e sólo admite ADMIN como autoridad**; no basta agregar IDs sectoriales al `.env`. Inspección limitada en lectura: 0 ADMIN_GENERADOR activos, 0 ADMIN_OPERADOR, 1 ADMIN_TRANSPORTISTA, 8 ADMIN; lista designada vacía. No elegir por defecto los ocho ADMIN, crear/activar cuentas, cambiar sus roles ni publicar un SHA diferente sin autorización. Pendiente elegir soporte de cuatro roles en nuevo commit probado en preview, o cuenta ADMIN explícita para publicar db68b24e. No hay smoke del candidato ni staging/recarga productiva. CAP/canales cerrados, main intacto, sin push/workflows.

## Revisión vigente — adendas fuera de CAP, sólo preview, 21/10/2026

**Revisión terminada sin publicar.** Leer [adendas: correcciones, circuito, pruebas y límites](docs/ADENDAS-OPERATIVAS-20261021.md). Hallazgo del operador, observación/aprobación/rechazo individuales, rectificación, anexos y avisos entre partes y a autoridad. Actualización entre sesiones, protección del motivo contra versiones concurrentes, vínculo de rectificación corregido y autor visible. Sin modificar permisos, declaración/historial, regla de revisión ni habilitaciones.

Preview: **36/36 backend, 57/57 interfaz/manual, 6/6 E2E únicos**, HTTP **10 grupos + autoridad ausente + flags off**. Backend/tipos/web/app/lint PASS; **355 tablas previas intactas**. Correo simulado: **112 avisos, cero cola/intentos/envíos**; CAP cerrado (cuatro alias 403), push/proveedores apagados. Manual **2026.21.2**, renderer/CSS conservados. No suites globales ni certificación física.

QA serial/un worker/1 CPU/2 GiB/swap cero; runtime/PG/contenedor detenidos **09:09:32 Mendoza**, sin OOM/presión. Base/imagen/evidencias preservadas. Main `c840219` intacto, sin push/workflows; cierre `[skip ci]`. **Producción no se inspeccionó ni modificó**: última publicación documentada `47ea8470`, abajo. Adendas/revisión siguen apagadas allí según ese cierre. Una futura activación exige autorización, build API final/SW y autoridad operativa activa designada para nuevas Y; no copiar la cuenta artificial QA ni desplegar bundles `/api`.

## Última publicación — propuestas de tres partes 47ea8470, 21/10/2026

**`47ea8470` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el **21/10/2026 08:31:08 Mendoza**, con autorización del dueño. Leer primero [despliegue, flags y reversión vigente](docs/DESPLIEGUE-PROPUESTAS-20261021.md). Propuestas ordinarias habilitadas en backend/frontend: creación por G/T/O, aprobación expresa de cada parte, firma del generador, coordinación unánime y retiro físico posterior. Administración no reemplaza decisiones; históricos e in situ conservados.

**Único cambio de configuración: `MANIFEST_PROPOSALS_ENABLED=true` / `VITE_MANIFEST_PROPOSALS_ENABLED=true`.** CAP cerrado, correos/push apagados, uploads y demás flags conservados. Eventuales/adendas/revisión posterior false; relevos/GPS múltiple true. Entorno nuevo SHA-256 `97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`, resto de bytes intacto; comprobado en ambos workers y PM2 guardado.

Build de **2.327 blobs exactos**, API final, serial/1 CPU/2 GiB/swap cero; backend/tipos/web/app PASS. **Sin migraciones ni instalaciones productivas**. Respaldo de release/configuración verificado antes de activar. Smoke no mutante **131/131**, externo **9/9**, PWA **8/8**; dos workers estables, cero logins/consultas de registros/mutaciones de negocio. Manual **2026.21.1**, renderer/CSS conservados; SW raíz **v142**, app **20261021112835**, actualización explícita y assets anteriores preservados.

**Reversión: interfaz/manual a 13af2fb0, backend 47ea8470 conservado y propuestas apagadas. No usar reversiones anteriores ni degradar las guardas de aprobaciones persistidas.** SW reversión v143/app 20261021113031. No restaura base ni borra historial; preparada, no ejecutada.

Preview detenido **08:30:15 Mendoza**, sin OOM ni presión de memoria; base/imagen/evidencia conservadas. `main` intacto, sin push/workflows; cierre `[skip ci]`. La revisión funcional previa está abajo; esta publicación no hizo E2E autenticado productivo ni certificación física.

## Validación previa — propuestas ordinarias fuera de CAP, 21/10/2026

**Revisión previa realizada sólo en preview, antes de la publicación registrada arriba.** Leer [circuito, pruebas y límites](docs/PROPUESTAS-OPERATIVAS-20261021.md) y [plan ejecutado](docs/PLAN-PROPUESTAS-OPERATIVAS-20261021.md). Generador, transportista u operador pueden proponer; cada parte aprueba expresamente, el generador firma y el retiro requiere unanimidad más inicio de coordinación. Agenda/campana y actualización entre sesiones en web/app; rechazos, concurrencia, historial y recorrido in situ protegidos. Flag nuevo independiente `MANIFEST_PROPOSALS_ENABLED` / `VITE_MANIFEST_PROPOSALS_ENABLED`, false por defecto; sólo true en QA. Sin migraciones.

Validación: suites completas previas **1438/1438 backend y 1790/1790 frontend**; ajustes finales dirigidos **33 backend, 65 interfaz/manual y 6 continuidad del chofer**, todos PASS. **12 casos E2E únicos**: v3 12/12 y repetición final móvil/app v4 8/8; **8 grupos HTTP + 1 de flag apagado**. Tipos/builds/lint sin errores; advertencias y fallos de harness conservados en el informe. Manual **2026.21.1**, mismo renderer/CSS. No afirmar suites completas posteriores a los últimos ajustes ni certificación física.

CAP cerrado, correos/push/proveedores apagados; cuatro alias rechazados con 403, **354 avisos de siete fases simulados, cero intentos/envíos**. **295 tablas previas de QA intactas**. Preview serial/un worker/1 CPU/2 GiB/swap cero, cerrado **08:11:50 Mendoza**, sin OOM; base/imagen/evidencia conservadas. `main` intacto (`c840219`), sin push/workflows, cierre `[skip ci]`. Producción **no se inspeccionó ni modificó**; última publicación documentada **13af2fb0**, abajo. No desplegar bundles `/api` de QA: una publicación requiere autorización, flags explícitos, API final y SW de release.

## Última publicación — revisión integral 13af2fb0, 21/10/2026

**`13af2fb0` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el **21/10/2026 07:00:01 Mendoza**, con autorización del dueño. Leer primero [despliegue, comprobaciones y reversión vigente](docs/DESPLIEGUE-CIRCUITOS-20261021.md). Incluye la revisión integral y las altas pendientes; no amplía permisos ni activa flags.

Build exacto de **2.310 blobs**, serial/1 CPU/2 GiB/swap cero, API final; tipos/backend/web/app PASS. **Sin migraciones**: Prisma y dependencias idénticos a c9cd877f. Smoke no mutante **120/120**, externo **9/9**, PWA **8/8**, dos workers estables. `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`; uploads/flags conservados, **CAP/correos/push cerrados**. Adendas/eventuales/revisión de partes false; relevos/GPS múltiple true. Sin logins ni consultas/modificaciones de registros reales.

Manual **2026.20.20**, renderer **2026.20.6**, CSS **2026.20.5**; inventario exacto. SW raíz **v140**, app **20261021095619**, assets previos y activación explícita conservados. Reversión preparada a **c9cd877f** compatible, sin restaurar base; SW v141/app **20261021095850**. Conserva informes, cola, pagos y tramos. No ejecutada.

Preview detenido **06:57:26 Mendoza**, sin OOM; imagen/base/evidencia conservadas. `main` intacto, sin push/workflows; cierre `[skip ci]`. La aceptación previa completa se detalla abajo; esta publicación recompiló y verificó artefactos/smoke, no hizo E2E autenticado productivo ni certificación física.

## Validación previa — revisión integral, 21/10/2026

**Candidato `13af2fb02e02d9fd39b2d4471bc40c2505c8f060` validado antes de la publicación registrada arriba.** Rama `codex/sitrep-training-20261018`, base `7e8ffe0c`, incluye altas `4b5c8bdd` pendientes. Leer primero [circuitos, trece correcciones, validación y límites](docs/REVISION-INTEGRAL-CIRCUITOS-20261020.md), luego [matriz](docs/MATRIZ-CIRCUITOS-20261020.md) y [plan ejecutado](docs/PLAN-REVISION-INTEGRAL-20261020.md). Durante esa revisión, producción seguía en **c9cd877f**, sin inspección ni modificación productiva.

backend **1430/1430**, frontend **1781/1781**, **369 casos E2E únicos**, **78 grupos HTTP**; **107 variantes de correo simuladas**, auditoría **8/8**, tipos/builds/lint PASS. Casos únicos deduplicados: no sumar intentos ni pruebas dirigidas. Se corrigieron identidad/estado/errores de ABM, pérdida del formulario de login, avisos de agenda PSIP y eventuales, elegibilidad de correos, unidades de adendas, próxima acción por rol, documentos del transporte y navegación del manual. Sin migración nueva ni ampliación de permisos.

Manual **2026.20.20**, renderer **2026.20.6**, CSS **2026.20.5** intacto; directorio conservado. Fuentes y capturas con hashes. CAP cerrado, correo/push/proveedores apagados; **235 tablas previas intactas, 224 correos suprimidos y cero intentos/envíos**. QA serial/un worker/1 CPU/2 GiB/swap cero. Servicios/PG cerrados y contenedor detenido **21/10/2026 02:46:53 Mendoza**, sin OOM; imagen/base/evidencia conservadas.

Sólo checkout autorizado, `main` sigue `c8402190edfc36b5e5d0dee1337c24bd1689420d`; sin push/workflows. Commits `[skip ci]`. Builds v13 con `/api` local: **no desplegarlos**. Publicación requiere nueva autorización, API final y versiones SW propias. Propuesta ordinaria de tres partes limitada a CAP; no se reabrieron sus cuentas. Navegadores no certifican Android/iOS físico; correo simulado no acredita entrega; OCR/ATM no deciden categoría fiscal ni acreditación externa.

## Revisión de altas — 4b5c8bdd sólo en preview, 20/10/2026

**`4b5c8bdd` validado, sin publicar.** Leer primero [altas: cambios, circuitos, pruebas y límites](docs/REVISION-ALTAS-20261020.md). Generador/Transportista/Operador: retomar borrador, corregir observaciones y adjuntos, reenviar, aprobar o rechazar y abrir el resultado desde el aviso propio. La aprobación ofrece renovar el acceso limitado sin bucle. Administración de transporte en app alineada con web/backend; documentos del operador y factura eléctrica, incluido el tipo histórico Factura de Luz. No se alteran permisos backend, requisitos, importes ni históricos.

Preview: backend **169/169**, frontend **312/312**, navegador **60/60**, API/OCR **11 grupos**, manual **25/25**, auditoría **11 grupos**, tipos/builds/lint y diff Prisma vacío. **175 tablas previas** intactas; 311 correos suprimidos, cero intentos/envíos. CAP cerrado, correos/push apagados y flags conservados. Manual **2026.20.18**, renderer idéntico; CSS **2026.20.5**, sólo contención de URLs largas que desbordaban el viewport móvil. Captura original artificial y procedencia guardadas.

QA serial/un worker/1 CPU/2 GiB/swap cero; servicios/PostgreSQL cerrados y contenedor detenido **20:48:11 Mendoza**, sin OOM (`max=5970` por presión de memoria). Imagen/base/evidencias conservadas. Sin producción, `main`, push ni workflows; commits `[skip ci]`. Última publicación documentada **c9cd877f**, abajo, sin nueva inspección productiva. Entrega de verificación por correo y formatos reales de facturas no certificados; categoría eléctrica para el test y fórmula fiscal R siguen pendientes. Una publicación requiere nueva autorización y paquetes con API/SW de release; no desplegar bundles `/api` de QA.

## Última publicación — informe de hallazgo y cola PSIP c9cd877f, 20/10/2026

**`c9cd877f` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` a las **18:15:18 Mendoza**, con autorización del dueño. Leer primero [despliegue, backup, límites y reversión actual](docs/DESPLIEGUE-HALLAZGOS-PSIP-20261020.md), después [informe dentro de la adenda y cola PSIP](docs/HALLAZGOS-ADENDAS-PSIP-20261020.md) y el [traspaso](docs/TRASPASO-CODEX-20261017.md). Las diferencias y actores externos aportan antecedentes internos por evaluar, no infracciones ni inspecciones automáticas. Permisos, originales y decisiones de adenda conservados.

Backup completo **23.750.117 bytes**, índice/decodificación/hash verificados antes de migrar. Única migración **`20261020210000_inspection_intake`**, `prisma migrate deploy` en `public` y mismo SQL aditivo con dueño restringido en CAP cerrado. Columna JSON nullable e informe/cola persistentes; sin seeds, backfill o consultas/modificaciones de registros reales en la validación. **25 migraciones fuente anteriores y 16 entradas históricas** conservadas. Backup/configuración privados permanecen en el servidor.

Smoke publicado **103/103**, externo **9/9**, PWA **8/8**. Dos workers estables, PM2 guardado, otras aplicaciones/Nginx intactos. `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`; uploads y todos los flags conservados, **CAP/correos/push cerrados**. **Adendas/eventuales/revisión de partes siguen false; relevos/GPS múltiple true.** Publicación no activa fuentes apagadas ni genera antecedentes retrospectivos.

Manual **2026.20.17**, CSS/renderer conservados y dos capturas originales; SW raíz **v138**, app **20261020211008**, assets anteriores preservados y activación explícita. Reversión preparada **sólo interfaz/manual** a `a6a5c005`, con SW v139/app `20261020211357`: **conserva backend c9cd877f, tabla/columna, evidencias, reservas ATM y tramos**. No restaurar base, borrar antecedentes ni degradar a un backend que deje de capturar fuentes.

Build exacto de **2.262 blobs** en preview serial/1 CPU/2 GiB/swap cero, API final y flags actuales; backend/tipos/web/app PASS. Preview detenido de nuevo **18:11:42 Mendoza**, sin OOM, imagen/base/evidencias conservadas. Sin main, push ni workflows. Cierre documental `[skip ci]`, sin cambiar el producto aprobado.

Validación funcional previa del mismo producto: backend **69/69**, frontend **43/43**, API **11 grupos + 4 de alcance**, rollback forzado **3**, PDF **3**, flags/CAP **3**, navegador web/web móvil/app **9/9**, manual **24/24 + 3/3 navegador**, tipos/builds/lint y diff Prisma PASS. **115 tablas** previas de QA intactas, 49 antecedentes artificiales y cero correos encolados. No son suites globales ni certificación física. Las fuentes se ensayaron habilitadas sólo en QA y se comprobó su cierre efectivo; esos bundles `/api` no fueron desplegados.

## Antecedente publicado — pagos ATM y facturas a6a5c005, 20/10/2026

**`a6a5c005` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` a las **16:45:59 Mendoza**. Leer primero [despliegue, respaldo, límites y reversión actual](docs/DESPLIEGUE-PAGOS-ATM-20261020.md), luego el [traspaso](docs/TRASPASO-CODEX-20261017.md). Backup completo verificado antes de migrar; única migración `20261020180000_payment_identity` en `public` y mismo SQL aditivo en CAP cerrado. Sin seeds, conciliación ni consultas/modificaciones de registros reales. Los históricos sin identidad conservan el bloqueo administrativo; no se infiere su estado ni se automatiza una aprobación.

Smoke publicado **95/95**, externo **9/9**, PWA PASS. `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`; CAP/correos/push cerrados, flags/uploads conservados. Dos workers estables después de recargar, PM2 guardado, otras aplicaciones y Nginx intactos. SW raíz **v136**, app **20261020193942**, manual **2026.20.16**. Activación de actualización explícita. Reversión preparada **sólo frontend** a UI/manual anteriores con SW v137; **conserva backend a6a5c005 y reservas**. No restaurar base ni volver al backend anterior que ignora este control.

Build exacto de 2.235 blobs en preview serial/1 CPU/2 GiB/swap cero; detenido **16:43:41 Mendoza**, sin OOM, imagen/base/evidencias conservadas. No main, push ni workflows. El cierre documental usa `[skip ci]`; no cambia el producto publicado.

## Validación previa — identidad de pagos ATM y facturas, 20/10/2026

Producto **`a6a5c005`**, validado antes de su publicación posterior indicada arriba: reserva persistente del ID/operación del ticket ATM antes de aprobarlo; otra foto, alta, CUIT o año no habilita reutilizarlo. Reemplazar/retirar conserva reserva y eventos. Identificación administrativa por sector, original y huella; históricos pendientes requieren conciliación. OCR eléctrico con catálogo de once distribuidoras de Mendoza, campos explícitos y evidencia; no convierte kWh/kW/tarifa a HP ni cambia TEF. Leer [implementación, fuentes, límites, pruebas y cierre](docs/CONTROL-COMPROBANTES-ATM-Y-FACTURAS-20261020.md) y luego el [traspaso](docs/TRASPASO-CODEX-20261017.md).

Preview: backend **166/166**, frontend **37/37**, API **11 grupos**, volumen **3 grupos**, migración final **3 grupos + diff vacío**, navegador **12/12 + 15/15** regresión, manual **21/21**, tipos/builds/lint y auditoría **5 grupos** PASS. Manual **2026.20.16**, CSS/renderer conservados. Once encabezados de facturas y un PDF híbrido **artificiales**; no certifican todos los formatos reales. Una migración aditiva nueva, aplicada sólo al esquema propio `payment_identity_20261020`; no a `public` compartido, CAP ni producción. Más de 500 históricos sin identificar requieren un plan de conciliación por lotes, aún sin herramienta masiva.

CAP cerrado, correo/push apagados, cero intentos/envíos y flags conservados. QA serial/un worker/1 CPU/2 GiB/swap cero, datos sintéticos, fuentes por hash; `main` permanece `c840219`. Servicios QA/PostgreSQL cerrados y contenedor detenido **16:23:08 Mendoza**, sin OOM; imagen/base/evidencia conservadas. Aquel pedido inicial sólo autorizaba preview; la autorización y publicación posteriores constan arriba. Sin push/workflows; commits `[skip ci]`. Durante esa revisión **`2200e955`** era la última publicación documentada y no se inspeccionó producción.

## Estado vigente — accesos de la capacitación cerrados, 19/10/2026

Los cuatro alias directos de la clase (admin, generador, transporte y operador) quedaron **revocados inmediatamente** al terminar la demo. Ingreso nuevo y sesiones previas: 403 para los cuatro. `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z` está aplicado al `.env`, a ambos procesos PM2 y a su estado guardado; API lista. Las 40 identidades artificiales y los manifiestos de práctica se conservan como historial, sin acceso directo de la pizarra. No reactivar estos alias sin una nueva indicación del dueño. [Evidencia y cierre](docs/ACCESO-CAPACITACION-20261019.md).

## Publicación operativa — relevos y GPS múltiple, 19/10/2026

Producto **`d372ce6e` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` a las **21:25:45 Mendoza**. Relevos y GPS múltiple habilitados, con autorización del dueño. El transporte original confirma el relevo y conserva la entrega; un externo puede tener datos incompletos y recibe un enlace GPS limitado/revocable. Asignación y aprobaciones originales intactas; C3 distingue cada tramo y espera GPS del reemplazo. Rama `codex/sitrep-training-20261018`, sólo este checkout; `main` intacto, sin push ni workflows.

Preview: backend completo **1177/1177**; frontend completo **1615/1615**; API **26 grupos**, navegador **6/6** (relevo, varias cargas y manual, web/app), manual **15/15**, tipos efectivos y ambos builds correctos. Flags apagados: **3/3** rutas cerradas por API. QA serial, un worker, 1 CPU/2 GiB/swap cero, sin proveedores ni datos reales. Leer [alcance, límites, incidencias, preparación y reversión](docs/REVISION-OPERACION-MANIFIESTOS-20261019.md).

Backup verificado antes de aplicar únicamente `20261019180000_transport_handoffs`: Prisma en `public`, mismo SQL aditivo con dueño restringido en CAP. Smoke publicado **57/57**, HTTPS externo **9/9** y PWA assets PASS; dos workers online y estado PM2 guardado. Transporte habilitado en ambos flags backend/Vite; cuatro flags originales apagados, CAP cerrado, `DISABLE_EMAILS=true`, push de manifiestos false y VAPID vacío. `UPLOADS_DIR` conservado. SW raíz v127, app 20261020001844, manual 2026.20.11. Leer [despliegue, respaldo, incidentes y contención preparada](docs/DESPLIEGUE-RELEVOS-20261019.md): **no volver al backend anterior que ignora tramos ni restaurar base para deshacer UI**. Contención mantiene backend y GPS delegado; no está activa. Gemelo detenido, imagen/evidencias conservadas, sin OOM. No reactivar CAP, SMTP o push sin nueva autorización.

## Historial — aviso de acceso corregido, 19/10/2026

Web/app **`75f3062`**, publicado 11:42:46 Mendoza: conserva el mensaje de error al volver al formulario después de un login fallido. Generador CAP confirmado por API y UI; los cuatro alias responden 200. Credenciales, límites y permisos sin cambios. Backend `8de58de` sin reinicio, manual `ea92004` conservado, SW v126. Unitarias dirigidas 33/33; navegador publicado 4/4 (401/429 inyectados, login real y recarga de sesión en web/app); build remoto serial y smoke 44/44. Rollback sólo frontend a `20261019-agenda-live-ea92004`. Sin datos reales, main ni workflows. Leer [incidente, pruebas y rollback](docs/ACCESO-CAPACITACION-20261019.md).

## Historial — agenda actualizada al crear, 19/10/2026

Web/app/manual **`ea92004`** publicados a las 09:29:02 Mendoza. El recién creado aparece primero, actualiza agenda al crear y llega a otra sesión sin recargar; después de la aprobación propia queda **En espera**. Animación breve con movimiento reducido respetado. Aprobaciones y permisos conservados. Backend `8de58de` sin reinicio; SW v125, manual 2026.20.9. Preview: unitarias 22/22, manual 16/16, cuatro roles × web/app 8/8. Agenda publicada de sólo lectura 3/3, smoke 44/44. Gemelo detenido y relay cerrado. Rollback sólo frontend al release `20261019-icons-88b1a0e`. Sin datos reales, main ni workflows. Leer [pruebas y rollback](docs/AGENDA-CAPACITACION-20261019.md).

## Historial — simplificación visual, 19/10/2026

Web/app `88b1a0e`: íconos compactos sin tilde/reloj, verde aprobado y gris pendiente. Manual `71780c6` actualizado; backend `8de58de` conservado, sin reinicio. Agenda publicada 3/3, smoke 44/44, manual 16/16 + 4/4 archivos. SW v124; mismos accesos CAP. Rollback sólo frontend al release `20261019-agenda-8de58de`. Sin datos reales, main ni workflows. Leer [estado, pruebas y rollback](docs/AGENDA-CAPACITACION-20261019.md).

## Historial — agenda de capacitación, 19/10/2026

**Backend, web, app y manual publicados sobre `8de58de`, el 19/10/2026 07:23:27 Mendoza.** Leer [agenda, pruebas y rollback](docs/AGENDA-CAPACITACION-20261019.md). Inicio compacto con filtros y tres aprobaciones visibles; certificados con íconos/estados; adenda con teclado de texto; contraste y diálogo de entrega corregidos. Circuito aprobado conservado.

Publicado: circuito 2/2, eventual 2/2, manual 3/3, agenda 3/3, smoke 44/44. 83 manifiestos CAP anteriores intactos, mismos cuatro accesos simples. Sin datos reales, main, correos ni push productivo. SW v123; actualizar web/app y activar sonido. Rollback inmediato: ambos releases `20261018-proactivo-gps-312d6f2`; sin restaurar base. Gemelo detenido y relay cerrado. Los intentos fallidos y límites de QA se documentan en el cierre.

## Historial — capacitación afinada, 19/10/2026

- **Leer primero [traspaso vigente](docs/TRASPASO-CODEX-20261017.md) y [afinamiento, evidencias y rollback](docs/AFINADO-CAPACITACION-20261018.md).** Producto publicado `312d6f2`, backend/web/app/manual en `sitrep.ultimamilla.com.ar`; aviso proactivo, inicio por una parte después de unanimidad, certificaciones simples y cierre GPS sin carrera.
- Único checkout `sitrep-production-source-20261001` del traspaso. Rama `codex/sitrep-training-20261018`, main `c840219` intacto. Cierre posterior sólo documental. Commits `[skip ci]`; sin workflows.
- Cuatro accesos CAP directos, claves privadas simples sin cambios, vencen al terminar el lunes 19 Mendoza (`2026-10-20T03:00:00Z`). No usar administrador personal, crear usuarios operativos ni reactivar instructor suspendido. Activar sonido tras abrir/recargar; avisos con app visible, sin push externo ni promesa en segundo plano.
- Validación publicada final: circuito 2/2, eventual 2/2, manual 3/3, smoke 44/44. Regresión forzada de entrega con GPS en vuelo incluida. Backend completo 1.132/1.132; frontend completo previo 1.570/1.572, correcciones y controles posteriores 59/59 y 51/51, sin afirmar suite frontend completa final. Intentos fallidos documentados. GPS emulado: no GO global, sensores físicos ni Android por viewport.
- Baseline de 62 manifiestos CAP anteriores conservado, incluido `CAP-1-ENTREGADO` ya Tratado por el dueño. Veinte casos propios de QA publicados conservados, cuatro tratados y ocho certificados; dos eventuales tratados. Crear otro caso y compartir su número para practicar; no resetear historial.
- `.env` y `UPLOADS_DIR=/var/lib/sitrep-uploads` conservados; flags false, correos y VAPID apagados. Sin migraciones/seeds. Releases activos `20261018-proactivo-gps-312d6f2`; rollback inmediato `20261018-proactivo-0e5ad03`, anterior al afinamiento `20261018-circuito-930d3e6`. No restaurar base ni credenciales.
- SW raíz v122, app 20261019012304; manual mismo diseño. Hojas privadas en `test-results-proactivo-20261018/output/pdf/`. Auditoría privada `/var/backups/sitrep/20261018-proactivo-gps/`.
- QA pesada sólo remota, serial, un worker, 1 CPU/2 GiB/swap cero. Contenedor propio `sitrep-qa-training-20261018` detenido; relay cerrado; imagen/evidencias conservadas. Sin OOM; presión de memoria `max=12` registrada durante build, sin aumentar límites.
- El dueño autorizó preparar/probar/publicar autónomamente esta capacitación artificial. Operación real requiere decisión específica. Los apartados siguientes son históricos y no autorizan sus antiguos deploys, seeds ni consultas reales.

## Contexto histórico — cierre parcial 16/10/2026

- Desarrollo funcional actual: `codex/sitrep-manifiestos-v2-20261014`. Revisión UI/UX independiente: `codex/sitrep-uiux-review-20261016`, desde el tag `sitrep-uiux-baseline-20261016`. Leer [cierre y estado](docs/CIERRE-PARCIAL-20261016.md) y [guía para la otra IA](docs/REVISION-UIUX-20261016.md) antes de trabajar.
- Este candidato **no está publicado**. No confundir `main`, ramas antiguas, archivos de demo ni Precrimen con la fuente actual. Los apartados de arquitectura, estados, CI/CD y cifras de febrero que siguen son históricos; no acreditan la configuración ni autorización actuales. Las reglas de ingeniería y estilo siguen vigentes.
- No desplegar, importar el padrón real, activar correo/push, tocar la sesión/formulario humano ni ejecutar seeds/smokes mutantes contra producción desde la revisión. No alterar reglas de negocio, permisos, IDs, numeración ni declaraciones originales para facilitar UI/tests.
- Cuidar RAM: sin Docker Desktop, emulador, instalaciones ni suites completas locales. Preview existente: una tarea a la vez, máximo1CPU/2GiB/swap0, datos sintéticos y proveedores desconectados. Está detenido al cierre. Actions sin crédito: no disparar workflows. Los commits de cierre llevan `[skip ci]`.
- Reutilizar marca SITREP vigente, iconografía de actores y componentes compartidos. Mantener formularios livianos, borradores y separación legal/productiva/empresa/persona. Las dudas DGFA se conservan para conciliación, **no bloquean todo el lote ni la operación existente**.
- No proclamar GO global o APK por pruebas de navegador. El cierre documenta por separado resultados actuales y baselines históricos. No iniciar un refactor general antes de registrar rutas/roles/estados realmente revisados.

Sistema de gestión y trazabilidad de residuos peligrosos para la Provincia de Mendoza.
Permite el seguimiento completo del ciclo de vida de manifiestos: desde la generación hasta el tratamiento final.

**📚 Documentación Unificada**: Ver [`../INFRAESTRUCTURA.md`](../INFRAESTRUCTURA.md) para arquitectura completa de ambos servidores (Producción + Preview), stack tecnológico compartido, y CI/CD workflows.

**Última actualización CI/CD**: 2026-02-15 - Backend workflow con Prisma binary fix + atomic deployments + rollback automático. Database compartida con Directus en PostgreSQL container.

## General Rules

- This is a TypeScript project. Use TypeScript for all new files. When editing existing .js files, check if there's a tsconfig and consider migrating to .ts if the file is being substantially rewritten.

## Repository

- **GitHub**: https://github.com/martinsantos/peliresi.git
- **Branch activo**: `feature/uiux-v6-revolution`
- **Branches**: `main`, `feature/uiux-v6-revolution`, `feature/ui-redesign-humanista`, `production/v1.0`

## Production Server

- **Server IP**: 23.105.176.45
- **SSH**: `root@23.105.176.45`
- **Domain**: sitrep.ultimamilla.com.ar
- **Node.js**: v20.19.4

## Production URLs

| Component | URL |
|-----------|-----|
| **Frontend** | https://sitrep.ultimamilla.com.ar/ |
| **PWA App** | https://sitrep.ultimamilla.com.ar/app/ |
| **API** | https://sitrep.ultimamilla.com.ar/api/ |
| **Health Check** | https://sitrep.ultimamilla.com.ar/api/health |

## Latest Build & Test Status

**Last Successful Build**: 2026-02-13 (CRUD Enhancements)
- ✅ Main Frontend: Built in 6.25s → `dist/` (2826 modules transformed)
- ✅ PWA App: Built in 5.42s → `dist-app/` (2818 modules transformed)
- ✅ Smoke Test: **44/44 endpoints PASS** (100% coverage)
  - Health (1), Auth (6), Manifiestos (7), Catalogos (9), Actores (6)
  - Admin Usuarios (3), Reportes (3), PDF (1), Analytics (4)
  - Centro de Control (1), Notificaciones (1), QR Verification (2)
- ✅ Production API: All systems operational at https://sitrep.ultimamilla.com.ar/api

**Recent Enhancements**:
- ✅ TransportistaDetallePage: Added full CRUD (edit/delete) for Vehículos and Conductores tables
- ✅ AdminTratamientosPage: Redesigned with spectacular visual design + full CRUD functionality
- ✅ All Admin CRUD pages verified with consistent edit/delete functionality

## Server Paths

| Component | Server Path |
|-----------|-------------|
| Frontend (main) | `/var/www/sitrep/` |
| PWA App | `/var/www/sitrep/app/` |
| Backend code | `/var/www/sitrep-backend/` |
| Backend .env | `/var/www/sitrep-backend/.env` (symlink a `/home/demoambiente/.env`) |
| Backend dist deploy target | `/var/www/sitrep-backend/` |
| Nginx config | `/etc/nginx/sites-available/sitrep.ultimamilla.com.ar` |
| PM2 logs | `/root/.pm2/logs/sitrep-backend-*.log` |

---

## Tech Stack

### Backend
- **Runtime**: Node.js 20 + Express.js + TypeScript
- **ORM**: Prisma (PostgreSQL)
- **Auth**: JWT (bcrypt passwords, role-based: ADMIN, GENERADOR, TRANSPORTISTA, OPERADOR)
- **Database**: PostgreSQL en Docker (`directus-admin-database-1`)
- **Process Manager**: PM2 cluster mode, 2 instances (process name: `sitrep-backend`, port 3002)
- **Compression**: gzip via `compression` middleware (~7x payload reduction)
- **Connection Pool**: Prisma `connection_limit=20&pool_timeout=10` per instance (40 total across cluster)
- **Request Timeout**: 30s middleware on all requests

### Frontend
- **Framework**: React 19 + TypeScript + Vite 7.2
- **State/Data**: TanStack React Query v5 (mutations + queries)
- **Charts**: Recharts 3.5.1 (BarChart, PieChart, Donut, Gauges)
- **Maps**: React Leaflet + Leaflet 1.9.4
- **PDF Export**: jsPDF 4.1 + jspdf-autotable 5.0
- **Styling**: Tailwind CSS (custom design system)
- **Icons**: Lucide React
- **QR**: html5-qrcode

### Design System
- **Colors**: Primary `#0D8A4F`, Institutional `#1B5E3C`, semantic success/warning/error/info
- **Fonts**: Plus Jakarta Sans (display), Inter (body), JetBrains Mono (mono)
- **Effects**: Glassmorphism, spring easing, stagger-children, hover-lift
- **UI Components**: 17+ componentes en `src-v6/components/ui/`
- **Map Markers** (`utils/map-icons.ts`): Generador = purple rounded-square + Factory, Transportista = orange diamond + Truck, **Operador = blue rounded-square + FlaskConical** (NO hexágono). SVGs stroke-based Lucide 14×14 en blanco sobre fondo de color. Cluster = rounded-square con número.

---

## Deployment - Frontend

```bash
# 1. Build main frontend
cd frontend
npm run build

# 2. Build PWA app
npx vite build --config vite.config.app.ts

# 3. Create tarballs
cd dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ..
cd dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ..

# 4. Upload to server
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz root@23.105.176.45:/tmp/

# 5. Deploy on server
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
ssh root@23.105.176.45 "cd /var/www/sitrep/app && find . -mindepth 1 -maxdepth 1 ! -name assets -exec rm -rf {} + && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 ."

# 6. Verify PWA assets do not fall back to HTML
scripts/ops/check-pwa-assets.sh https://sitrep.ultimamilla.com.ar
```

## Deployment - Backend

```bash
cd backend
npm run build
tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma
scp /tmp/sitrep-backend.tar.gz root@23.105.176.45:/tmp/
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"
```

## Deployment - Full (Frontend + Backend)

```bash
# Build all
cd backend && npm run build && cd ..
cd frontend && npm run build && npx vite build --config vite.config.app.ts && cd ..

# Package
cd frontend/dist && tar czf /tmp/sitrep-frontend.tar.gz . && cd ../..
cd frontend/dist-app && tar czf /tmp/sitrep-app.tar.gz . && cd ../..
cd backend && tar czf /tmp/sitrep-backend.tar.gz dist package.json package-lock.json prisma && cd ..

# Upload
scp /tmp/sitrep-frontend.tar.gz /tmp/sitrep-app.tar.gz /tmp/sitrep-backend.tar.gz root@23.105.176.45:/tmp/

# Deploy frontend
ssh root@23.105.176.45 "cd /var/www/sitrep && find . -maxdepth 1 ! -name app ! -name . -exec rm -rf {} + && tar xzf /tmp/sitrep-frontend.tar.gz && chmod -R 755 ."
ssh root@23.105.176.45 "cd /var/www/sitrep/app && find . -mindepth 1 -maxdepth 1 ! -name assets -exec rm -rf {} + && tar xzf /tmp/sitrep-app.tar.gz && chmod -R 755 ."

# Deploy backend
ssh root@23.105.176.45 "cd /var/www/sitrep-backend && tar xzf /tmp/sitrep-backend.tar.gz && npm ci --production && npx prisma generate && pm2 restart sitrep-backend"

# Verify PWA assets do not fall back to HTML
scripts/ops/check-pwa-assets.sh https://sitrep.ultimamilla.com.ar
```

---

## Vite Build Configs

| Config | Base Path | Output Dir | Entry Point |
|--------|-----------|------------|-------------|
| `vite.config.ts` | `/` | `dist/` | `index.html` |
| `vite.config.v6.ts` | `/v6/` | `dist-v6/` | `src-v6/main.tsx` (dev only) |
| `vite.config.app.ts` | `/app/` | `dist-app/` | `app.html` |

### Vite Manual Chunks (vendor splitting)

`vite.config.ts` splits vendor bundles for optimal caching and lazy loading:
- `vendor-react` (45KB): react, react-dom, react-router-dom — always loaded
- `vendor-query` (36KB): @tanstack/react-query — always loaded
- `vendor-charts` (369KB): recharts — loaded only on chart pages
- `vendor-maps` (152KB): leaflet, react-leaflet — loaded only on map pages
- `vendor-pdf` (408KB): jspdf, jspdf-autotable — loaded only on PDF export

## PM2 Management

PM2 runs in **cluster mode** with 2 instances (ecosystem.config.js), 512MB memory limit per instance.

```bash
ssh root@23.105.176.45 "pm2 list"
ssh root@23.105.176.45 "pm2 restart sitrep-backend"
ssh root@23.105.176.45 "pm2 logs sitrep-backend --lines 50"
ssh root@23.105.176.45 "pm2 show sitrep-backend"
# To apply ecosystem.config.js changes:
ssh root@23.105.176.45 "pm2 delete sitrep-backend && pm2 start /var/www/sitrep-backend/ecosystem.config.js && pm2 save"
```

## Database

Database name is `trazabilidad_rrpp` (NOT `trazabilidad_demo`).

```bash
# Acceso directo a PostgreSQL
ssh root@23.105.176.45 "docker exec -it directus-admin-database-1 psql -U directus -d trazabilidad_rrpp"
# Check indexes
ssh root@23.105.176.45 "docker exec directus-admin-database-1 psql -U directus -d trazabilidad_rrpp -c \"SELECT tablename, indexname FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;\""
```

### Database Indexes (production optimization)

16 custom indexes on key tables for query performance:
- **manifiestos**: generadorId, transportistaId, operadorId, estado, createdAt, [estado+createdAt], [numero], [transportistaId+estado]
- **manifiestos_residuos**: manifiestoId
- **eventos_manifiesto**: manifiestoId, [manifiestoId+tipo]
- **tracking_gps**: manifiestoId, timestamp, [manifiestoId+timestamp]
- **auditorias**: manifiestoId, createdAt
- **alertas_generadas**: manifiestoId, estado
- **anomalias_transporte**: manifiestoId

---

## Architecture

### Backend API Routes

| Route | Controller | Descripción |
|-------|-----------|-------------|
| `/api/auth/*` | auth.controller | Login, registro, refresh token, perfil, cambio de contraseña |
| `/api/manifiestos/*` | manifiesto.controller | CRUD manifiestos, workflow de estados, dashboard |
| `/api/actores/*` | actor.controller | Generadores, transportistas, operadores |
| `/api/reportes/*` | reporte.controller | Reportes por período, tratados, transporte, CSV export |
| `/api/catalogos/*` | catalogo.controller | Residuos, categorías, establecimientos, vehículos |
| `/api/notificaciones/*` | notification.controller | Notificaciones push y alertas |
| `/api/analytics/*` | analytics.controller | Dashboard analytics: manifiestos por mes/estado, residuos por tipo, tiempo promedio |
| `/api/admin/*` | admin.controller | CRUD usuarios (solo ADMIN): listar, crear, editar, eliminar, toggle activo |
| `/api/pdf/*` | pdf.controller | Generación de PDF de manifiestos y certificados de disposición |
| `/api/centro-control/*` | tracking.controller | Centro de Control: actividad por capas, mapa, estadísticas |

### Key API Endpoints

```
GET  /api/manifiestos/dashboard      → estadísticas (borradores, aprobados, enTransito, entregados, recibidos, tratados, total) + recientes + enTransitoList
GET  /api/reportes/manifiestos       → porEstado, porTipoResiduo, manifiestos[], pagination (params: fechaInicio, fechaFin, page, limit). NOTA: porTipoResiduo retorna objetos { cantidad, unidad }, NO números planos. Agregación via Prisma groupBy.
GET  /api/reportes/tratados          → porGenerador, totalPorTipo, detalle[], pagination (params: fechaInicio, fechaFin, page, limit)
GET  /api/reportes/transporte        → transportistas[] con tasaCompletitud, pagination (params: fechaInicio, fechaFin, page, limit). Usa _count en vez de cargar manifiestos completos.
GET  /api/reportes/exportar/:tipo    → CSV blob (tipos: manifiestos, generadores, transportistas, operadores). Límite: 10,000 filas max.
POST /api/manifiestos/:id/aprobar    → Cambiar estado BORRADOR → APROBADO
POST /api/manifiestos/:id/confirmar-retiro → APROBADO → EN_TRANSITO
POST /api/manifiestos/:id/entregar   → EN_TRANSITO → ENTREGADO
POST /api/manifiestos/:id/recibir    → ENTREGADO → RECIBIDO
POST /api/manifiestos/:id/tratamiento → RECIBIDO → EN_TRATAMIENTO
POST /api/manifiestos/:id/cerrar      → EN_TRATAMIENTO/RECIBIDO → TRATADO
POST /api/manifiestos/:id/rechazar    → ENTREGADO → RECHAZADO
POST /api/manifiestos/:id/incidente   → Registra incidente en transito (acepta campo `tipo` o `tipoIncidente`)
POST /api/manifiestos/:id/cancelar    → Cancela manifiesto (si no es CANCELADO ni TRATADO)
POST /api/manifiestos/:id/ubicacion   → GPS update (latitud, longitud, velocidad?, direccion?) — solo EN_TRANSITO
GET  /api/centro-control/actividad    → Centro de Control con capas (params: fechaDesde, fechaHasta, capas=generadores,transportistas,operadores,transito)
GET  /api/pdf/manifiesto/:id          → PDF del manifiesto
GET  /api/pdf/certificado/:id         → Certificado de Tratamiento y Disposición Final (solo estado TRATADO)
PUT  /api/manifiestos/:id             → Editar manifiesto (solo BORRADOR, reemplaza residuos via $transaction)
DEL  /api/manifiestos/:id             → Eliminar manifiesto (solo BORRADOR/CANCELADO, cascading delete)
GET  /api/manifiestos/:id/viaje-actual → GPS tracking points para un manifiesto (limit 500, ordered by timestamp)
POST /api/auth/change-password        → Cambiar contraseña (verifica actual, valida nueva, hash bcrypt)
GET  /api/catalogos/vehiculos         → Lista global de vehículos activos (con transportista)
GET  /api/catalogos/choferes          → Lista global de choferes activos (con transportista)
DEL  /api/actores/transportistas/:id  → Eliminar transportista (verifica sin manifiestos, cascade vehiculos/choferes/usuario)
GET  /api/analytics/manifiestos-por-mes    → Manifiestos creados por mes (últimos 12 meses, raw SQL)
GET  /api/analytics/residuos-por-tipo      → Residuos agrupados por tipo (Prisma groupBy)
GET  /api/analytics/manifiestos-por-estado → Manifiestos agrupados por estado (Prisma groupBy)
GET  /api/analytics/tiempo-promedio        → Tiempo promedio por etapa del workflow (horas entre fechas)
GET  /api/admin/usuarios              → Lista usuarios con filtros (rol, search, activo) + paginación
GET  /api/admin/usuarios/:id          → Detalle de usuario con actor asociado
POST /api/admin/usuarios              → Crear usuario (Zod validation, hash bcrypt)
PUT  /api/admin/usuarios/:id          → Editar usuario (email, nombre, rol, etc.)
DEL  /api/admin/usuarios/:id          → Eliminar usuario (verifica sin manifiestos asociados)
PATCH /api/admin/usuarios/:id/toggle-activo → Toggle campo activo del usuario
GET  /api/manifiestos/verificar/:numero → Verificación pública de manifiesto por número (sin auth)
```

### Frontend Filter Mapping

El frontend usa `fechaDesde/fechaHasta` pero el backend espera `fechaInicio/fechaFin`.
La función `mapFilters()` en `reporte.service.ts` traduce entre ambos.

### Roles y Permisos

| Rol | Acceso |
|-----|--------|
| `ADMIN` | Todo: dashboard, manifiestos, actores, reportes, auditoría, configuración, usuarios |
| `GENERADOR` | Sus manifiestos (filtrado por generadorId), crear borradores, perfil |
| `TRANSPORTISTA` | **DEMO MODE: ve TODOS los manifiestos** (filtro por transportistaId desactivado en `getManifiestos` y `getDashboardStats`). Tracking GPS, viaje en curso, "Tomar Viaje" desde perfil |
| `OPERADOR` | Sus manifiestos (filtrado por operadorId), recibir, tratar |

---

## GPS Tracking System

### Architecture

The GPS tracking system enables real-time position monitoring for up to **50 simultaneous trips**.

**Flow**: Phone (watchPosition) → every 30s → `POST /api/manifiestos/:id/ubicacion` → `tracking_gps` table → Centro de Control polls every 30s

### Frontend (ViajeEnCursoTransportista.tsx)

- **GPS collection**: `navigator.geolocation.watchPosition()` runs continuously
- **Transmission interval**: 30 seconds (sends latest position only)
- **GPS Status State Machine**: `checking` → `acquiring` → `active` | `denied` | `unavailable` | `error`
- **Data sent**: `{ latitud, longitud, velocidad?, direccion? }`
- **Offline resilience**: Failed updates queued in `pendingUpdatesRef` (max 5), **persisted to localStorage** (`gps_pending_{id}`) on PWA close/backgrounding. On mount, saved GPS points are flushed to backend. Also backed by IndexedDB `sync_queue`
- **watchPosition cleanup**: Robust cleanup via `cleanupGps` callback + `beforeunload` listener prevents zombie watchers on navigation/unmount
- **Pause/Resume**: Records `PAUSA`/`REANUDACION` incidents via backend + localStorage backup
- **Timer persistence**: Uses server `fechaRetiro` timestamp (not local counter)

### Backend (manifiesto.controller.ts)

- **Endpoint**: `POST /api/manifiestos/:id/ubicacion`
- **Auth**: TRANSPORTISTA or ADMIN
- **Validation**: Checks manifiesto exists and is EN_TRANSITO
- **In-memory cache**: 30s TTL per manifiestoId to skip repeated `findUnique` SELECT (~10x faster for frequent GPS updates, TTL matches GPS interval)
- **Cache invalidation**: On `confirmarEntrega` (trip state change)
- **Data stored**: `tracking_gps` table with `latitud`, `longitud`, `velocidad`, `direccion`, `timestamp`

### Centro de Control (tracking.controller.ts)

- **Endpoint**: `GET /api/centro-control/actividad`
- **Params**: `fechaDesde`, `fechaHasta`, `capas` (csv: generadores, transportistas, operadores, transito)
- **EN_TRANSITO filter**: Shows trips created in date range OR with GPS tracking in date range (OR condition)
- **Date parsing**: `fechaHasta` auto-bumped to 23:59:59.999 to include full day (avoids midnight truncation bug)
- **Layers**: Generadores, Transportistas, Operadores (filtered by activity in period), En Tránsito (up to 50 GPS points per trip)
- **Statistics**: Pipeline counts per estado, KPIs, manifiestosPorDia via raw SQL

### Capacity (scaled to 50 transportistas)

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Max concurrent trips** | 50+ | Scaled from 30 with connection pool, indexes, $transaction, and cache optimizations |
| **GPS update interval** | 30s per client | 1 req/30s per phone |
| **Rate limit** | 600 req/min/IP | Supports 50+ phones behind shared NAT/CGNAT |
| **DB connection pool** | 20 per PM2 instance (40 total) | `connection_limit=20&pool_timeout=10` in DATABASE_URL |
| **PostgreSQL max_connections** | 100 | ~40 active at peak with 50 transportistas |
| **Per-request latency** | ~24ms (cached) / ~250ms (cold) | Cache TTL: 30s |
| **Data growth** | ~6,000 rows/hour at 50 trips | With composite indexes, query perf stays constant |
| **Analytics** | GPS routes skipped | `/ubicacion` and `/gps` paths excluded from analytics middleware |

### Concurrency Protections (50 transportistas)

| Protection | File | Description |
|------------|------|-------------|
| **$transaction on workflow** | `manifiesto.controller.ts` | `confirmarRetiro`, `confirmarEntrega`, `registrarTratamiento` wrapped in `prisma.$transaction()` — prevents race conditions from double-tap or simultaneous requests |
| **Double-tap guard** | `ManifiestoDetallePage.tsx` | `actionInFlightRef` blocks concurrent action submissions before React re-renders `isPending` |
| **Cross-tab token sync** | `api.ts` | `storage` event listener syncs token refresh across browser tabs — prevents queue starvation |
| **switchUser async** | `AuthContext.tsx` | `switchUser()` is async with `await` + `setIsLoading(true)` — prevents navigation with inconsistent tokens |
| **Logout cleanup** | `AuthContext.tsx` | `logout()` clears `sitrep_active_trip_id`, `viaje_snapshot_*`, `viaje_status_*`, `gps_pending_*` from localStorage |
| **ActiveTripGuard** | `AppMobile.tsx` | Validates trip estado against terminal states before redirecting — prevents redirect loop to finished trips |
| **GPS localStorage persist** | `ViajeEnCursoTransportista.tsx` | `pendingUpdatesRef` persisted to `gps_pending_{id}` on close; flushed to backend on mount |
| **watchPosition cleanup** | `ViajeEnCursoTransportista.tsx` | `cleanupGps` callback + `beforeunload` listener prevents zombie GPS watchers |

### Mobile Dashboard (MobileDashboardPage.tsx)

- **TRANSPORTISTA-specific**: Shows trip assignment banner between welcome and stats grid
- **Active trips (EN_TRANSITO)**: Pulsing green card with "Ir al viaje" button
- **Pending trips (APROBADO)**: Warning-colored card with clickable list
- **Data source**: `useManifiestos({ estado: EN_TRANSITO/APROBADO, limit: 5 })`

### TransportePerfilPage (TransportePerfilPage.tsx)

- **3 tabs**: Viaje, Info, Historial
- **Tab Viaje — prioridad de visualización**:
  1. Si hay manifiesto EN_TRANSITO → muestra viaje activo con mapa, controles (pausar/incidente/finalizar)
  2. Si NO hay EN_TRANSITO pero hay APROBADO → muestra lista "Viajes Asignados" con cards (número, generador, operador, residuos, fecha) y botón **"Tomar Viaje"** → navega a `/transporte/viaje/:id` (ViajeEnCursoTransportista)
  3. Si no hay ninguno → EmptyState
- **Data source**: `useManifiestos({ estado: EN_TRANSITO, limit: 1 })` + `useManifiestos({ estado: APROBADO, limit: 10 })`
- **Flujo "Tomar Viaje"**: TransportePerfilPage (lista APROBADO) → click "Tomar Viaje" → ViajeEnCursoTransportista → "Confirmar Retiro" → manifiesto pasa a EN_TRANSITO + GPS tracking

### CentroControlPage Role Filtering

- **ADMIN**: Sees all EN_TRANSITO trips
- **TRANSPORTISTA**: Filtered by `currentUser.sector` (company name match against transportista)
- **Alertas**: Only queried for ADMIN role (`useAlertas(filters, isAdmin)`)

---

## Frontend Pages (src-v6)

### Dashboard & Control
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Dashboard | `pages/dashboard/DashboardPage.tsx` | KPIs, resumen general |
| Centro de Control | `pages/centro-control/CentroControlPage.tsx` | Sala de operaciones: LIVE badge, 5 KPIs, pipeline funnel, mapa + viajes activos/realizados accordion, donut chart, bar chart, auto-refresh 30s, 6 acciones rápidas. Viajes panel usa `self-start` para no estirarse con el mapa. |
| Mobile Dashboard | `pages/mobile/MobileDashboardPage.tsx` | Versión mobile optimizada |

### Reportes (code-split con React.lazy)
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Centro de Reportes (shell) | `pages/reportes/ReportesPage.tsx` | Shell ~370 líneas: filter bar, tab switcher, exportación PDF/CSV, lazy loading de tabs con Suspense |
| Tab: Manifiestos | `pages/reportes/tabs/ManifiestosTab.tsx` | KPIs, gráfico por estado (donut), por tipo residuo (bar), tabla paginada |
| Tab: Residuos Tratados | `pages/reportes/tabs/TratadosTab.tsx` | KPIs, gauge tasa tratamiento, donut por tipo, tabla tratados |
| Tab: Transporte | `pages/reportes/tabs/TransporteTab.tsx` | KPIs, bar chart completitud, tabla transportistas con progress bars |
| Tab: Establecimientos | `pages/reportes/tabs/EstablecimientosTab.tsx` | KPIs, pie categorías, bar departamentos, tabla generadores |
| Tab: Operadores | `pages/reportes/tabs/OperadoresTab.tsx` | KPIs, pie categorías, bar recibidos/tratados, tabla operadores |
| Tab: Departamentos | `pages/reportes/tabs/DepartamentosTab.tsx` | Choropleth map, ranking, DepartamentoDetalleModal |
| Tab: Mapa de Actores | `pages/reportes/tabs/MapaActoresTab.tsx` | Leaflet map con layer toggles, clustering, popups |
| Shared utilities | `pages/reportes/tabs/shared.tsx` | downloadCsv, DonutCenterLabel, clusterMarkers |

### Manifiestos
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Lista | `pages/manifiestos/ManifiestosPage.tsx` | Tabla con búsqueda, filtros por estado, paginación |
| Detalle | `pages/manifiestos/ManifiestoDetallePage.tsx` | Workflow completo con 10 acciones por estado/rol, timeline, descarga PDF y Certificado de Disposición (estado TRATADO) |
| Nuevo | `pages/manifiestos/NuevoManifiestoPage.tsx` | Formulario multi-paso con auto-populate de datos del actor al seleccionar (CUIT, teléfono, domicilio, habilitación) |
| Verificar | `pages/manifiestos/VerificarManifiestoPage.tsx` | Verificación pública de manifiesto via QR/número |

### Actores
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Todos los actores | `pages/actores/ActoresPage.tsx` | Vista unificada gen/trans/oper |
| Transportistas | `pages/actores/TransportistasPage.tsx` | Lista + detalle |
| Operadores | `pages/actores/OperadoresPage.tsx` | Lista + detalle |

### Admin
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Residuos | `pages/admin/AdminResiduosPage.tsx` | Catálogo con filtros interactivos en stat cards y categorías |
| Generadores | `pages/admin/AdminGeneradoresPage.tsx` | CRUD generadores |
| Operadores | `pages/admin/AdminOperadoresPage.tsx` | CRUD operadores con enrichment DPA |
| Tratamientos | `pages/admin/AdminTratamientosPage.tsx` | Catálogo de tratamientos |
| Vehículos | `pages/admin/AdminVehiculosPage.tsx` | CRUD vehículos |
| Usuarios | `pages/usuarios/UsuariosPage.tsx` | Gestión de usuarios y roles (CRUD completo via admin.controller) |

### Transporte & Tracking
| Página | Archivo | Descripción |
|--------|---------|-------------|
| Tracking | `pages/tracking/TrackingPage.tsx` | Seguimiento GPS en mapa |
| Viaje en Curso | `pages/tracking/ViajeEnCursoPage.tsx` | Vista de viaje activo |
| Perfil Transporte | `pages/transporte/TransportePerfilPage.tsx` | Dashboard transportista: 3 tabs (Viaje, Info, Historial). Tab Viaje muestra viaje EN_TRANSITO activo, o lista de viajes APROBADO con botón "Tomar Viaje", o EmptyState |
| Viaje Transportista | `pages/transporte/ViajeEnCursoTransportista.tsx` | Control de viaje para transportista |

### Otros
| Página | Archivo |
|--------|---------|
| Alertas | `pages/alertas/AlertasPage.tsx` |
| Auditoría | `pages/auditoria/AuditoriaPage.tsx` |
| Escáner QR | `pages/escaner/EscanerQRPage.tsx` |
| Carga Masiva | `pages/carga-masiva/CargaMasivaPage.tsx` |
| Configuración | `pages/configuracion/ConfiguracionPage.tsx` |
| Perfil | `pages/perfil/PerfilPage.tsx` |
| Estadísticas | `pages/estadisticas/EstadisticasPage.tsx` |
| Login | `pages/auth/LoginPage.tsx` |

---

## Key Frontend Files

### Hooks
| Hook | Archivo | Uso |
|------|---------|-----|
| `useDashboardStats` | `hooks/useDashboard.ts` | Stats dashboard con `refetchInterval: 30s` |
| `useReporteManifiestos` | `hooks/useReportes.ts` | Datos reportes manifiestos |
| `useReporteTratados` | `hooks/useReportes.ts` | Datos reportes tratados |
| `useReporteTransporte` | `hooks/useReportes.ts` | Datos reportes transporte |
| `useExportarReporte` | `hooks/useReportes.ts` | Mutación exportar CSV |
| `useManifiestos` | `hooks/useManifiestos.ts` | Lista y operaciones manifiestos |
| `useAlertas` | `hooks/useAlertas.ts` | Alertas del sistema |
| `useActores` | `hooks/useActores.ts` | Generadores, transportistas, operadores |

### Utils
| Util | Archivo | Función |
|------|---------|---------|
| `exportReportePDF` | `utils/exportPdf.ts` | Genera PDF profesional con jsPDF: header SITREP verde, KPI cards, tabla autoTable, footer paginado |
| `formatRelativeTime` | `utils/formatters.ts` | Formato "hace X minutos" |
| `ACTOR_ICONS` | `utils/map-icons.ts` | Leaflet divIcons para mapas: Generador (purple rounded-square + Factory), Transportista (orange diamond + Truck), Operador (blue rounded-square + FlaskConical), En Tránsito (red pulsing circle). Todos los íconos SVG son stroke-based Lucide 14×14. Operador debe usar FlaskConical (NO hexágono, NO Building2). |
| `createClusterIcon` | `utils/map-icons.ts` | Cluster marker (rounded-square con count numérico) para >50 items en un grid de 0.05° |

### Services
| Service | Archivo | API Base |
|---------|---------|----------|
| `reporteService` | `services/reporte.service.ts` | `/reportes/*` (con mapFilters fechaDesde→fechaInicio) |
| `analyticsService` | `services/analytics.service.ts` | `/analytics/*` (4 dashboard endpoints fully implemented) |
| `usuarioService` | `services/usuario.service.ts` | `/admin/usuarios/*` (CRUD usuarios, solo ADMIN) |
| `manifiestoService` | `services/manifiesto.service.ts` | `/manifiestos/*` |
| `actoresService` | `services/actores.service.ts` | `/actores/*` |
| `catalogoService` | `services/catalogo.service.ts` | `/catalogos/*` (tipos residuos, generadores, transportistas, operadores, vehículos, choferes, tratamientos) |

---

## Manifest Workflow States

```
BORRADOR → APROBADO → EN_TRANSITO → ENTREGADO → RECIBIDO → EN_TRATAMIENTO → TRATADO
                                   ↘ RECHAZADO
                    ↗ INCIDENTE (evento, no cambia estado)
CUALQUIERA (excepto CANCELADO/TRATADO) → CANCELADO
```

### Workflow Actions by Role (ManifiestoDetallePage)

| Action | From State | To State | Allowed Roles |
|--------|-----------|----------|---------------|
| Firmar/Aprobar | BORRADOR | APROBADO | GENERADOR, ADMIN |
| Confirmar Retiro | APROBADO | EN_TRANSITO | TRANSPORTISTA, ADMIN |
| Confirmar Entrega | EN_TRANSITO | ENTREGADO | TRANSPORTISTA, ADMIN |
| Registrar Incidente | EN_TRANSITO | _(event only)_ | TRANSPORTISTA, ADMIN |
| Confirmar Recepción | ENTREGADO | RECIBIDO | OPERADOR, ADMIN |
| Rechazar Carga | ENTREGADO | RECHAZADO | OPERADOR, ADMIN |
| Registrar Pesaje | RECIBIDO | _(updates weights)_ | OPERADOR, ADMIN |
| Registrar Tratamiento | RECIBIDO | EN_TRATAMIENTO | OPERADOR, ADMIN |
| Cerrar Manifiesto | EN_TRATAMIENTO/RECIBIDO | TRATADO | OPERADOR, ADMIN |
| Cancelar Manifiesto | _(any except CANCELADO/TRATADO)_ | CANCELADO | GENERADOR, ADMIN |
| Descargar Certificado | TRATADO | _(PDF download)_ | ALL |

---

## PWA App

### Configuration
- **manifest.json** (main): scope `/`, start_url `/`
- **manifest-app.json** (mobile): scope `/app/`, start_url `/app/`, orientation portrait
- **Service Worker**: `public/sw.js` — network-first strategy, cache `trazabilidad-rrpp-v4`, API excluded from cache
- **Offline**: Custom `/offline.html` fallback page
- **Icons**: `icon-192.png`, `icon-512.png` (maskable)

### PWA Components
| Component | File | Description |
|-----------|------|-------------|
| Install Button | `components/InstallPWAButton.tsx` | Compact PWA install trigger (iOS + Android) |
| Install Modal | `components/InstallPWAModal.tsx` | Auto-appears after 45s, 7-day dismiss grace |
| Connectivity | `components/ConnectivityIndicator.tsx` | Online/offline status bar |
| Onboarding | `components/DemoAppOnboarding.tsx` | Role-based feature tour |

### PWA Hooks
| Hook | File | Description |
|------|------|-------------|
| `usePWAInstall` | `hooks/usePWAInstall.ts` | `canInstall`, `isInstalled`, `isIOS`, `promptInstall()` |
| `useConnectivity` | `hooks/useConnectivity.ts` | Health ping every 30s, sync queue on reconnect |

---

## Catalogs API (Data Shape)

Backend `/api/catalogos/*` endpoints return full actor data via Prisma includes:

```typescript
// GET /api/catalogos/generadores → { id, razonSocial, cuit, telefono, domicilio, numeroInscripcion, categoria, usuario: { email, nombre } }
// GET /api/catalogos/transportistas → { id, razonSocial, cuit, telefono, domicilio, numeroHabilitacion, vehiculos[], choferes[], usuario: { email, nombre } }
// GET /api/catalogos/operadores → { id, razonSocial, cuit, telefono, domicilio, numeroHabilitacion, categoria, tratamientos[], usuario: { email, nombre } }
```

Frontend `CatalogoItem` type (types/api.ts) uses `[key: string]: any` to accommodate all fields.
NuevoManifiestoPage auto-populates actor info cards (CUIT, teléfono, domicilio, habilitación) when selecting from dropdowns.

---

## Testing

### Smoke Test

```bash
# Run full API smoke test against production (44 endpoints)
bash backend/tests/smoke-test.sh

# Run PWA asset integrity smoke against production
scripts/ops/check-pwa-assets.sh https://sitrep.ultimamilla.com.ar

# Run against local
bash backend/tests/smoke-test.sh http://localhost:3002
```

- **Script**: `backend/tests/smoke-test.sh`
- **Coverage**: 44 endpoints across all route groups (Health, Auth, Manifiestos, Catalogos, Actores, Admin, Reportes, PDF, Analytics, Centro de Control, Notificaciones, QR Verification)
- **Auth**: Logs in as admin (`juan.perez@dgfa.gob.ar` / `<password-inicial-seguro>`), uses JWT token for authenticated endpoints
- **Dynamic IDs**: Fetches real IDs for detail/sub-resource tests (manifiestoId, transportistaId, operadorId)
- **Exit code**: 0 on all pass, 1 on any failure

### Service Worker Versioning

- **Current version**: v10 (`sw.js` cache name: `trazabilidad-rrpp-v10`)
- **Bump on deploy**: After deploying new frontend code, increment cache version in `frontend/public/sw.js` (`CACHE_NAME` and `RUNTIME_CACHE`) and redeploy `sw.js` to force PWA clients to fetch fresh assets

---

## Key Notes

- Backend runs on port **3002** via PM2 cluster mode, 2 instances (process name: `sitrep-backend`)
- PM2 exec cwd: `/var/www/sitrep-backend/`, script: `dist/index.js`, exec_mode: `cluster`
- Express `trust proxy` enabled (required behind Nginx for rate limiting & IP detection)
- Nginx proxies `/api/` to `http://127.0.0.1:3002`
- PostgreSQL runs in Docker container `directus-admin-database-1`
- Frontend uses SPA fallback (`try_files $uri $uri/ /index.html`)
- App uses SPA fallback to `/app/app.html`
- SSL via Let's Encrypt (auto-renewal)
- Admin email: `admin@dgfa.mendoza.gov.ar`
- `/analytics/*` endpoints fully implemented: `manifiestos-por-mes` (raw SQL), `residuos-por-tipo`, `manifiestos-por-estado` (Prisma groupBy), `tiempo-promedio` (calculated from workflow dates). All accessible by any authenticated user. Superadmin-only endpoints (`/summary`) behind `isSuperAdmin` middleware
- Centro de Control usa polling manual (countdown 30s + refetch) en lugar de WebSockets
- Reportes usa Recharts para gráficos interactivos y jsPDF para exportación PDF client-side
- Report endpoints usan paginación (`page`/`limit` params) y `Promise.all` para queries paralelas
- CSV export limitado a 10,000 filas max por seguridad
- Health check (`/api/health`) verifica conectividad a DB y retorna `{ status, db, uptime }`
- `createManifiesto` backend acepta `generadorId` del body para ADMIN (no requiere relación generador en el user)
- `registrarIncidente` acepta tanto `tipo` como `tipoIncidente` del frontend
- Certificado de Disposición (CU-O10): PDF generado por `pdf.controller.ts:generarCertificado` con Ley 24.051, datos completos, firma operador

### Demo Mode — Filtro transportistaId desactivado

En `manifiesto.controller.ts`, el filtro `where.transportistaId = req.user.transportista.id` está **comentado** en dos funciones para modo demo:
- **`getManifiestos`** (~línea 144): cualquier transportista ve todos los manifiestos (no solo los asignados a su empresa)
- **`getDashboardStats`** (~línea 981): estadísticas globales para cualquier transportista

Esto permite que en demo cualquier usuario transportista (Carlos Rodriguez, Elena Vargas, etc.) vea y "tome" cualquier viaje APROBADO, sin importar a qué empresa transportista fue asignado el manifiesto.

**Para restaurar filtro en producción**: descomentar las líneas marcadas con `DEMO MODE` en ambas funciones.

**NOTA**: `getSyncInicial` (sincronización offline) **sigue filtrando** por `transportistaId` — no fue modificado.

---

## Lecciones Aprendidas (CSS/Layout)

### Sticky filter bars en páginas con overflow
- `position: sticky` SOLO funciona si el elemento sticky está dentro de un contenedor con scroll (e.g. `<main>` con `overflow-auto`)
- El root layout DEBE usar `h-screen overflow-hidden` para forzar que `<main>` sea el scroll container (NO `min-h-screen`)
- Los componentes de página deben usar React Fragment (`<>`) para que el sticky bar sea hijo directo de `<main>`
- Usar `-mx-4 lg:-mx-8 px-4 lg:px-8` para sticky bars full-bleed dentro de `<main>` con padding
- Leaflet mapas tienen z-index 400+; usar `isolate` en content wrappers para contener stacking context
- NO poner top padding en `<main>` cuando hay sticky bars — solo `px-4 lg:px-8 pb-4 lg:pb-8`

### CSS Grid y paneles de contenido variable
- En CSS grid, columnas se estiran al alto de la fila (definido por el elemento más alto, e.g. mapa)
- Usar `self-start` en columnas con contenido variable para evitar whitespace innecesario
- `min-h-[X]` fuerza altura mínima incluso sin contenido — evitar para paneles dinámicos

### Modales sobre headers fijos
- Si el header tiene `h-16` (64px) y `z-30`, modales con `z-50` necesitan `pt-20` (80px) para que el contenido no quede detrás

### Datos del backend — formas inconsistentes
- `/api/reportes/manifiestos` → `porTipoResiduo` retorna `{ cantidad: number, unidad: string }` (objetos)
- `/api/reportes/tratados` → `totalPorTipo` retorna `number` (números planos)
- Siempre verificar con `typeof value === 'object'` y extraer `.cantidad` cuando corresponda

---

## CSS & Layout Rules

When fixing CSS/layout issues, ALWAYS test the fix visually in context before declaring it done. Check for: z-index conflicts (especially with Leaflet maps), box-shadow artifacts, gap/overlap issues with sticky positioned elements, and scroll behavior. Never assume a CSS fix is complete without verifying adjacent elements are unaffected.

### Pre-Deploy UI Checklist

Before deploying any UI fix, create a mental checklist of all elements that could be affected by the change. For sticky/fixed positioning changes, explicitly verify:
1. z-index stacking context with all overlapping elements (maps, modals, dropdowns)
2. scroll behavior
3. box-shadow/border rendering at boundaries
4. responsive behavior at different viewport sizes

### Fix UI Procedure

When fixing any CSS/layout bug, follow this procedure in order:
1. Read the affected component's full CSS and its parent/sibling styles
2. Identify all z-index values and stacking contexts in the page
3. List potential side effects BEFORE making changes
4. Make the minimal CSS change needed
5. Grep for any Leaflet/map z-index values that could conflict
6. Verify sticky/fixed elements don't create gaps or overlaps

---

## Hooks (Pre-Commit)

Configuración recomendada para `.Codex/settings.json`:

```json
{
  "hooks": {
    "preCommit": ["npx stylelint '**/*.css' --fix", "npx tsc --noEmit"]
  }
}
```

Esto ejecuta stylelint y type-check antes de cada commit para atrapar regresiones CSS y errores TypeScript antes de que lleguen a producción.

---

## Reglas de Ingeniería

### Filosofía operativa
Tú eres las manos; el humano es el arquitecto. Muévete rápido, pero nunca más rápido de lo que el humano pueda verificar. Tu código será vigilado con lupa; escribe en consecuencia.

### Comportamientos obligatorios

1. **Exponer suposiciones** (prioridad: crítica)
   - Antes de implementar algo no trivial, declarar suposiciones explícitamente.
   - Nunca rellenar silenciosamente requisitos ambiguos.
   - Formato: `SUPOSICIONES QUE ESTOY HACIENDO: 1. [...] → Corrígeme ahora o procederé con esto.`

2. **Gestión de confusión** (prioridad: crítica)
   - Ante inconsistencias o requisitos contradictorios: DETENTE. Nombra la confusión. Presenta la disyuntiva. Espera resolución.
   - Mal: elegir silenciosamente una interpretación. Bien: "Veo X en archivo A pero Y en archivo B. ¿Cuál tiene precedencia?"

3. **Push back cuando corresponda** (prioridad: alta)
   - No ser servil. Señalar problemas directamente, explicar desventaja concreta, proponer alternativa, aceptar si te anulan.

4. **Simplicidad** (prioridad: alta)
   - Resistir activamente la tendencia a sobrecomplicar. Preferir la solución aburrida y obvia.
   - Si 100 líneas bastan, 1000 es un fallo. La astucia es costosa.

5. **Disciplina de alcance** (prioridad: alta)
   - Tocar SOLO lo que se pida. No eliminar comentarios, no "limpiar" código ortogonal, no refactorizar sistemas adyacentes, no borrar código aparentemente no utilizado sin aprobación.

6. **Higiene de código muerto** (prioridad: media)
   - Después de refactorizar: identificar código inalcanzable, enumerarlo, preguntar antes de eliminar.

### Patrones de trabajo

- **Declarativo sobre imperativo**: re-enmarcar instrucciones como criterios de éxito.
- **Test primero**: escribir la prueba que define éxito, implementar hasta que pase, mostrar ambos.
- **Naive primero, optimizar después**: corrección primero, rendimiento después.
- **Plan inline**: para tareas de múltiples pasos, emitir plan ligero antes de ejecutar.

### Estándares de output

- Sin abstracciones infladas ni generalización prematura.
- Sin trucos astutos sin comentarios que expliquen el porqué.
- Estilo consistente con la base de código existente.
- Nombres de variables significativos.

### Comunicación

- Ser directo sobre los problemas.
- Cuantificar cuando sea posible ("esto añade ~200ms de latencia", no "esto podría ser más lento").
- Cuando te atasques, decirlo y describir lo que has intentado.
- No ocultar incertidumbre detrás de lenguaje confiado.

### Resumen post-cambio obligatorio

```
CAMBIOS REALIZADOS:
- [archivo]: [qué cambió y por qué]

COSAS QUE NO TOQUÉ:
- [archivo]: [dejado solo intencionalmente porque...]

POSIBLES PREOCUPACIONES:
- [cualquier riesgo o cosa a verificar]
```

### Modos de fallo a evitar

1. Hacer suposiciones incorrectas sin verificar
2. No gestionar tu propia confusión
3. No buscar aclaraciones cuando se necesitan
4. No exponer inconsistencias que notas
5. No presentar tradeoffs en decisiones no obvias
6. No cuestionar cuando deberías
7. Ser servil ("¡Por supuesto!" a malas ideas)
8. Sobrecomplicar el código y las APIs
9. Inflar abstracciones innecesariamente
10. No limpiar código muerto tras refactorizaciones
11. Modificar comentarios/código ortogonal a la tarea
12. Eliminar cosas que no entiendes completamente

---

## CI/CD Status (Updated 2026-02-15)

### ✅ Active Workflows

| Workflow | Status | Last Successful | Deploy Time |
|----------|--------|----------------|-------------|
| **Deploy SITREP Backend** | ✅ Active | 2026-02-14 23:33 | ~2-3 min |

### Backend CI/CD Implementation

**Atomic Deployment Pattern**:
```bash
1. GitHub Actions builds in cloud (FREE)
2. Build: npm ci && npm run build
3. Package: dist/ + package.json + prisma/ + ecosystem.config.js
4. SCP to VPS /tmp/
5. Deploy script:
   - Extract to /var/www/sitrep-backend-releases/YYYYMMDD-HHMMSS/
   - Copy .env from current release
   - npx prisma generate (RHEL binaries) ← FIX 2026-02-15
   - Symlink /var/www/sitrep-backend → new release
   - pm2 restart sitrep-backend (cluster mode, 2 instances)
   - Health check https://sitrep.ultimamilla.com.ar/api/health
   - ROLLBACK if health fails (automatic, 2 seconds)
   - Cleanup (keep last 5 releases)
```

**Data Protection**:
- ✅ Shared PostgreSQL with Directus: `directus-admin-database-1`
- ✅ Database: `trazabilidad_rrpp`
- ✅ Schema created via `prisma db push`
- ⚠️ Backups: Manual only (NEEDS automation)

**Prisma Binary Fix (2026-02-15)**:
```bash
Problem: GitHub Actions (Ubuntu) generates debian binaries
         Production server (RHEL) needs rhel binaries
         Error: PrismaClientInitializationError

Solution: Added to deploy_sitrep_backend.sh:
  echo "🔧 Generating Prisma Client for RHEL..."
  cd $RELEASE_DIR
  npx prisma generate  # Regenerates with rhel-openssl-3.0.x

Result: ✅ Deployment successful
        ✅ Health: {"status":"ok","db":"connected"}
        ✅ 2 PM2 instances online, 0 Prisma errors
```

**Files**:
- Workflow: `.github/workflows/deploy-production.yml`
- Deploy script: `/opt/scripts-cicd/deploy_sitrep_backend.sh`
- Config: `/var/www/sitrep-backend/.env` (symlink to /home/demoambiente/.env)
- PM2: `/var/www/sitrep-backend/ecosystem.config.js`

### Shared Infrastructure with ultimamilla.com.ar

**PostgreSQL Container (Shared)**:
```yaml
Container: directus-admin-database-1
Image: postgres:15-alpine
Port: 5432 (localhost)
Managed by: Directus docker-compose (/opt/directus-admin/)

Databases:
  - directus (Directus CMS: 518 Antecedentes + 8 Servicios)
  - trazabilidad_rrpp (SITREP: Manifiestos, Usuarios, etc.)

Connection from SITREP:
  DATABASE_URL=postgresql://directus:password@localhost:5432/trazabilidad_rrpp?schema=public
```

**IMPORTANT**: SITREP backend runs outside Docker (PM2), connects to PostgreSQL container via localhost:5432. Container must be running for SITREP to work.

### Test SITREP Deployment

```bash
# Smoke test (44 endpoints)
cd backend
bash tests/smoke-test.sh

# Comprehensive test (includes SITREP health)
cd /Volumes/SDTERA/ultima\ milla/LICITACIONES/PRESENTADAS2025/AMBIENTE
bash test-all-simple.sh

# Expected: 18/18 tests passed
```

Last comprehensive test: **18/18 passed** ✅ (2026-02-15 11:30)

---

## Backup Strategy (CRITICAL - Updated 2026-02-15)

### Current Backups

| Data | Location | Frequency | Last Backup | Status |
|------|----------|-----------|-------------|--------|
| **SITREP Database** | `/root/backups/sitrep_pre_scale_20260114_203611.sql` | ⚠️ Manual | 2026-01-14 | 🔴 OUTDATED |
| **Directus Database** | `/opt/directus-backups/directus-db-*.sql.gz` | Daily 2 AM | 2026-02-15 11:19 | ✅ CURRENT |

### ⚠️ URGENT: SITREP Automated Backup Needed

**Recommendation**:
```bash
# Create backup script
cat > /opt/scripts-cicd/backup_sitrep.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/opt/sitrep-backups
mkdir -p $BACKUP_DIR

# Backup SITREP database
docker exec directus-admin-database-1 pg_dump -U directus trazabilidad_rrpp | gzip > $BACKUP_DIR/sitrep-db-$DATE.sql.gz

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "sitrep-db-*.sql.gz" -mtime +30 -delete
EOF

# Add to cron (daily 3 AM)
echo "0 3 * * * /opt/scripts-cicd/backup_sitrep.sh" | crontab -
```

**Cross-Server Backup** (recommended):
```bash
# Rsync to Hostinger preview server (76.13.234.213)
0 4 * * * rsync -avz /opt/sitrep-backups/ root@76.13.234.213:/backups/sitrep-prod/
```

---

## Related Documentation

- [`../INFRAESTRUCTURA.md`](../INFRAESTRUCTURA.md) - Complete infrastructure overview
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) - Detailed deployment procedures (to be created)
- [`backend/tests/smoke-test.sh`](./backend/tests/smoke-test.sh) - API smoke test script
