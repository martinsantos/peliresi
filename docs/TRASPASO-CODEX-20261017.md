# SITREP — traspaso vigente de operación

## Autoridades de adendas — candidato probado, sin publicar, 21/10/2026

Leer primero [autoridades, validación y pendiente de cuentas](AUTORIDADES-ADENDAS-20261021.md). Se completó el soporte solicitado para **ADMIN, ADMIN_GENERADOR, ADMIN_OPERADOR y ADMIN_TRANSPORTISTA**, activos y **designados por ID**. Autoridad de adendas ordinarias y destinatarios de nuevas Y; sin autoaprobación, suplantación ni promoción automática por rol. Eventuales conservan sus permisos. No se modificaron cuentas reales ni se accedió a producción en esta tanda.

**1451/1451 backend, 1796/1796 frontend, 18/18 E2E únicos** en escritorio/web móvil/app. HTTP **10 + 5 grupos**, autoridad ausente y flags off PASS; builds/tipos/lint PASS. **415 tablas previas intactas**, 146 avisos de correo simulados, cero cola/intentos/envíos; CAP cerrado (cuatro alias 403), push/proveedores apagados. Manual **2026.21.3**, renderer/CSS conservados; sin migraciones. No certifica dispositivos físicos ni entrega externa.

Preview serial/1 worker/1 CPU/2 GiB/swap cero, cerrado **10:51:57 Mendoza**, sin OOM/presión; imagen/base/evidencia conservadas. Main `c840219` intacto, sin push/workflows; commit `[skip ci]`. Sólo checkout activo `sitrep-production-source-20261001`.

**Pendiente productivo:** identificar cuentas de Super Admin, Generadores y Operadores (última lectura: 8 ADMIN, 0 ADMIN_GENERADOR activos, 0 ADMIN_OPERADOR, 1 ADMIN_TRANSPORTISTA). La pregunta al dueño sigue sin respuesta. No elegir los ocho ADMIN, crear/activar cuentas o cambiar roles por inferencia. Publicar exige aprobación del nuevo SHA y preparación de API final/SW/flags con autoridades válidas; los paquetes previos db68b24e no incluyen este cambio. No desplegar los bundles `/api` de QA. Última versión productiva verificada previamente: **47ea8470**; reversión vigente intacta.

## Publicación db68b24e preparada, sin activar — 21/10/2026

Leer primero [preparación y bloqueo de autoridades](PREPARACION-ADENDAS-20261021.md). Producción verificada en **47ea8470**, sin cambios. Build de **db68b24e** terminado: backend/tipos/web/app, 2.339 blobs exactos, API final, manual 2026.21.2, SW v144/app 20261021124024; serial/1 CPU/2 GiB/swap cero. Preview detenido **09:44:13 Mendoza**.

El dueño designó administradores de Generadores, Operadores y Transporte, más Super Admin. **db68b24e sólo admite ADMIN como autoridad**; no basta agregar IDs sectoriales al `.env`. Inspección limitada en lectura: 0 ADMIN_GENERADOR activos, 0 ADMIN_OPERADOR, 1 ADMIN_TRANSPORTISTA, 8 ADMIN; lista designada vacía. No elegir por defecto los ocho ADMIN, crear/activar cuentas, cambiar sus roles ni publicar un SHA diferente sin autorización. Pendiente elegir soporte de cuatro roles en nuevo commit probado en preview, o cuenta ADMIN explícita para publicar db68b24e. No hay smoke del candidato ni staging/recarga productiva. CAP/canales cerrados, main intacto, sin push/workflows.

## Revisión vigente — adendas fuera de CAP, sólo preview, 21/10/2026

**Revisión terminada sin publicar.** Leer [adendas: correcciones, circuito, pruebas y límites](ADENDAS-OPERATIVAS-20261021.md). Hallazgo del operador, observación/aprobación/rechazo individuales, rectificación, anexos y avisos entre partes y a autoridad. Actualización entre sesiones, protección del motivo contra versiones concurrentes, vínculo de rectificación corregido y autor visible. Sin modificar permisos, declaración/historial, regla de revisión ni habilitaciones.

Preview: **36/36 backend, 57/57 interfaz/manual, 6/6 E2E únicos**, HTTP **10 grupos + autoridad ausente + flags off**. Backend/tipos/web/app/lint PASS; **355 tablas previas intactas**. Correo simulado: **112 avisos, cero cola/intentos/envíos**; CAP cerrado (cuatro alias 403), push/proveedores apagados. Manual **2026.21.2**, renderer/CSS conservados. No suites globales ni certificación física.

QA serial/un worker/1 CPU/2 GiB/swap cero; runtime/PG/contenedor detenidos **09:09:32 Mendoza**, sin OOM/presión. Base/imagen/evidencias preservadas. Main `c840219` intacto, sin push/workflows; cierre `[skip ci]`. **Producción no se inspeccionó ni modificó**: última publicación documentada `47ea8470`, abajo. Adendas/revisión siguen apagadas allí según ese cierre. Una futura activación exige autorización, build API final/SW y autoridad operativa activa designada para nuevas Y; no copiar la cuenta artificial QA ni desplegar bundles `/api`.

## Última publicación — propuestas de tres partes 47ea8470, 21/10/2026

**`47ea8470` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el **21/10/2026 08:31:08 Mendoza**, con autorización del dueño. Leer primero [despliegue, flags y reversión vigente](DESPLIEGUE-PROPUESTAS-20261021.md). Propuestas ordinarias habilitadas en backend/frontend: creación por G/T/O, aprobación expresa de cada parte, firma del generador, coordinación unánime y retiro físico posterior. Administración no reemplaza decisiones; históricos e in situ conservados.

**Único cambio de configuración: `MANIFEST_PROPOSALS_ENABLED=true` / `VITE_MANIFEST_PROPOSALS_ENABLED=true`.** CAP cerrado, correos/push apagados, uploads y demás flags conservados. Eventuales/adendas/revisión posterior false; relevos/GPS múltiple true. Entorno nuevo SHA-256 `97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`, resto de bytes intacto; comprobado en ambos workers y PM2 guardado.

Build de **2.327 blobs exactos**, API final, serial/1 CPU/2 GiB/swap cero; backend/tipos/web/app PASS. **Sin migraciones ni instalaciones productivas**. Respaldo de release/configuración verificado antes de activar. Smoke no mutante **131/131**, externo **9/9**, PWA **8/8**; dos workers estables, cero logins/consultas de registros/mutaciones de negocio. Manual **2026.21.1**, renderer/CSS conservados; SW raíz **v142**, app **20261021112835**, actualización explícita y assets anteriores preservados.

**Reversión: interfaz/manual a 13af2fb0, backend 47ea8470 conservado y propuestas apagadas. No usar reversiones anteriores ni degradar las guardas de aprobaciones persistidas.** SW reversión v143/app 20261021113031. No restaura base ni borra historial; preparada, no ejecutada.

Preview detenido **08:30:15 Mendoza**, sin OOM ni presión de memoria; base/imagen/evidencia conservadas. `main` intacto, sin push/workflows; cierre `[skip ci]`. La revisión funcional previa está abajo; esta publicación no hizo E2E autenticado productivo ni certificación física.

## Validación previa — propuestas ordinarias fuera de CAP, 21/10/2026

**Revisión previa realizada sólo en preview, antes de la publicación registrada arriba.** Leer [circuito, pruebas y límites](PROPUESTAS-OPERATIVAS-20261021.md) y [plan ejecutado](PLAN-PROPUESTAS-OPERATIVAS-20261021.md). Generador, transportista u operador pueden proponer; cada parte aprueba expresamente, el generador firma y el retiro requiere unanimidad más inicio de coordinación. Agenda/campana y actualización entre sesiones en web/app; rechazos, concurrencia, historial y recorrido in situ protegidos. Flag nuevo independiente `MANIFEST_PROPOSALS_ENABLED` / `VITE_MANIFEST_PROPOSALS_ENABLED`, false por defecto; sólo true en QA. Sin migraciones.

Validación: suites completas previas **1438/1438 backend y 1790/1790 frontend**; ajustes finales dirigidos **33 backend, 65 interfaz/manual y 6 continuidad del chofer**, todos PASS. **12 casos E2E únicos**: v3 12/12 y repetición final móvil/app v4 8/8; **8 grupos HTTP + 1 de flag apagado**. Tipos/builds/lint sin errores; advertencias y fallos de harness conservados en el informe. Manual **2026.21.1**, mismo renderer/CSS. No afirmar suites completas posteriores a los últimos ajustes ni certificación física.

CAP cerrado, correos/push/proveedores apagados; cuatro alias rechazados con 403, **354 avisos de siete fases simulados, cero intentos/envíos**. **295 tablas previas de QA intactas**. Preview serial/un worker/1 CPU/2 GiB/swap cero, cerrado **08:11:50 Mendoza**, sin OOM; base/imagen/evidencia conservadas. `main` intacto (`c840219`), sin push/workflows, cierre `[skip ci]`. Producción **no se inspeccionó ni modificó**; última publicación documentada **13af2fb0**, abajo. No desplegar bundles `/api` de QA: una publicación requiere autorización, flags explícitos, API final y SW de release.

## Última publicación — revisión integral 13af2fb0, 21/10/2026

**`13af2fb0` publicado** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el **21/10/2026 07:00:01 Mendoza**, con autorización del dueño. Leer primero [despliegue, comprobaciones y reversión vigente](DESPLIEGUE-CIRCUITOS-20261021.md). Incluye la revisión integral y las altas pendientes; no amplía permisos ni activa flags.

Build exacto de **2.310 blobs**, serial/1 CPU/2 GiB/swap cero, API final; tipos/backend/web/app PASS. **Sin migraciones**: Prisma y dependencias idénticos a c9cd877f. Smoke no mutante **120/120**, externo **9/9**, PWA **8/8**, dos workers estables. `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`; uploads/flags conservados, **CAP/correos/push cerrados**. Adendas/eventuales/revisión de partes false; relevos/GPS múltiple true. Sin logins ni consultas/modificaciones de registros reales.

Manual **2026.20.20**, renderer **2026.20.6**, CSS **2026.20.5**; inventario exacto. SW raíz **v140**, app **20261021095619**, assets previos y activación explícita conservados. Reversión preparada a **c9cd877f** compatible, sin restaurar base; SW v141/app **20261021095850**. Conserva informes, cola, pagos y tramos. No ejecutada.

Preview detenido **06:57:26 Mendoza**, sin OOM; imagen/base/evidencia conservadas. `main` intacto, sin push/workflows; cierre `[skip ci]`. La aceptación previa completa se detalla abajo; esta publicación recompiló y verificó artefactos/smoke, no hizo E2E autenticado productivo ni certificación física.

## Validación previa — revisión integral, 21/10/2026

**Candidato `13af2fb02e02d9fd39b2d4471bc40c2505c8f060` validado antes de la publicación registrada arriba.** Rama `codex/sitrep-training-20261018`, base `7e8ffe0c`, incluye altas `4b5c8bdd` pendientes. Leer primero [circuitos, trece correcciones, validación y límites](REVISION-INTEGRAL-CIRCUITOS-20261020.md), luego [matriz](MATRIZ-CIRCUITOS-20261020.md) y [plan ejecutado](PLAN-REVISION-INTEGRAL-20261020.md). Durante esa revisión, producción seguía en **c9cd877f**, sin inspección ni modificación productiva.

backend **1430/1430**, frontend **1781/1781**, **369 casos E2E únicos**, **78 grupos HTTP**; **107 variantes de correo simuladas**, auditoría **8/8**, tipos/builds/lint PASS. Casos únicos deduplicados: no sumar intentos ni pruebas dirigidas. Se corrigieron identidad/estado/errores de ABM, pérdida del formulario de login, avisos de agenda PSIP y eventuales, elegibilidad de correos, unidades de adendas, próxima acción por rol, documentos del transporte y navegación del manual. Sin migración nueva ni ampliación de permisos.

Manual **2026.20.20**, renderer **2026.20.6**, CSS **2026.20.5** intacto; directorio conservado. Fuentes y capturas con hashes. CAP cerrado, correo/push/proveedores apagados; **235 tablas previas intactas, 224 correos suprimidos y cero intentos/envíos**. QA serial/un worker/1 CPU/2 GiB/swap cero. Servicios/PG cerrados y contenedor detenido **21/10/2026 02:46:53 Mendoza**, sin OOM; imagen/base/evidencia conservadas.

Sólo checkout autorizado, `main` sigue `c8402190edfc36b5e5d0dee1337c24bd1689420d`; sin push/workflows. Commits `[skip ci]`. Builds v13 con `/api` local: **no desplegarlos**. Publicación requiere nueva autorización, API final y versiones SW propias. Propuesta ordinaria de tres partes limitada a CAP; no se reabrieron sus cuentas. Navegadores no certifican Android/iOS físico; correo simulado no acredita entrega; OCR/ATM no deciden categoría fiscal ni acreditación externa.

## Revisión de altas — producto 4b5c8bdd sin publicar, 20/10/2026

**Sólo preview, sin producción ni main.** Candidato **`4b5c8bdd3380beb3bc03674d902a31ff0b91f76e`**, rama `codex/sitrep-training-20261018`, checkout único de este traspaso. Leer [revisión integral de Generador, Transportista y Operador](REVISION-ALTAS-20261020.md) antes de continuar. La última publicación documentada sigue siendo `c9cd877f`; no se consultó producción durante esta revisión.

Se corrigen entradas a borradores y solicitudes observadas, conservación de observaciones, renovación del acceso después de aprobar, destino/etiqueta de avisos de alta y guardia de administración de transporte en app. Se completa la consulta/revisión de documentos del operador y el OCR de Factura de Luz histórica sin cambiar el original. Permisos backend, requisitos, TEF/importes, pagos e históricos conservados; ninguna migración fuente nueva. Manual **2026.20.18**, misma guía y renderer, captura artificial original; CSS **2026.20.5** contiene URLs largas para evitar recortar los botones en móvil.

Validación final: backend **169/169**, frontend **312/312**, navegador **60/60** (altas públicas/directas, ATM, electricidad, recibos, flota y manual entre web/web móvil/app), manual **25/25**, API/OCR **11 grupos**, auditoría **11 grupos**, tipos/builds/lint PASS y diff Prisma vacío. Cero omitidos/flaky/reintentos; **81 páginas instrumentadas** sin errores inesperados. **175 tablas previas** de QA conservan conteos/huellas; **311 correos suprimidos, cero intentos/envíos**, CAP expirado y flags/proveedores efectivos verificados.

Servicios QA/PostgreSQL cerrados y contenedor propio detenido **20/10, 20:48:11 Mendoza**, `Running=false/Pid=0/OOMKilled=false`; imagen, base y evidencias conservadas. Serial/un worker/1 CPU/2 GiB/swap cero, `memory.events max=5970` por presión de memoria y `oom/oom_kill=0`. **46 blobs cambiados** coinciden con lo probado; builds sobre **2.277 fuentes**, API local `/api`, no son paquetes para producción. `main` sigue `c8402190edfc36b5e5d0dee1337c24bd1689420d`; sin push/workflows, commits `[skip ci]`.

Límites: verificación de email con comprobante sintético y controlador real; correo/recuperación no llegan a usuarios con canales apagados. OCR sobre once encabezados y un PDF híbrido artificiales; no todas las facturas reales ni dispositivos físicos certificados. La categoría eléctrica para el test y la fórmula R requieren decisión fiscal separada. Publicar requiere autorización nueva, build de dominio final y versión SW de release, manteniendo CAP/canales/flags como se indique entonces.

## Estado vigente — capacitación cerrada desde el 19/10/2026

Al terminar la demo, se revocaron los cuatro accesos directos CAP de la pizarra. Los cuatro nuevos ingresos y los cuatro tokens emitidos antes del cierre devolvieron 403. El vencimiento pasado está tanto en `.env` como en PM2 y su estado guardado, también después de la publicación operativa siguiente. Los datos artificiales, manifiestos y credenciales históricas quedan preservados, sin poder usar el ingreso directo. Aquel cierre no cambió `main` ni frontend. [Cierre y auditoría](ACCESO-CAPACITACION-20261019.md).

## Última publicación — informe de hallazgo y cola PSIP c9cd877f, 20/10/2026

**Backend, web, app y manual `c9cd877f73ef4cac30cd751dfb1f396807c7ead5` publicados** en `sitrep.ultimamilla.com.ar` el **20/10 a las 18:15:18 Mendoza**, con autorización del dueño. Leer primero [publicación, respaldo verificado y reversión vigente](DESPLIEGUE-HALLAZGOS-PSIP-20261020.md), luego [definición del informe dentro de la adenda, fuentes y permisos](HALLAZGOS-ADENDAS-PSIP-20261020.md). Las diferencias declarado/observado, participantes eventuales sin alta y relevos externos alimentan la **Cola de revisión** interna de PSIP. Administración evalúa con motivo y vincula/abre una inspección; no se determina automáticamente una infracción ni se crean permisos o actores ficticios. Originales y decisiones de adenda conservados.

Backup privado **23.750.117 bytes**, SHA-256 **`17e560c9f08d13f8103ff8efe669caebe266be4803c0dee382c95d4d56e87788`**, índice y decodificación íntegra verificados antes de migrar. Única migración **`20261020210000_inspection_intake`**, SQL SHA-256 **`83adb4d86cb0d4c1260335957dfdbed111f40ed61f258e94e2cd7be767d8d994`**: columna JSON nullable y tabla de antecedentes. `prisma migrate deploy` en `public`; mismo SQL aditivo con dueño restringido en CAP cerrado, sin baseline ficticio. **25 migraciones fuente anteriores y 16 entradas históricas** intactas. Sin seeds, backfill, restauraciones ni consultas/mutaciones de negocio de validación.

Build nuevo sobre **2.262 blobs exactos**, API final y flags vigentes, serial/1 CPU/2 GiB/swap cero; tipos/backend/web/app PASS. **382 backend / 505 web-manual / 199 app / 14 Prisma** contrastados por hash. Manual **2026.20.17**, CSS/renderer idénticos, dos capturas originales y guía hallazgos→PSIP. SW raíz **v138**, app **20261020211008**, activación explícita y assets previos preservados. No se desplegaron los bundles QA con API `/api` ni flags de origen habilitados.

Smoke no mutante publicado **103/103**, externo **9/9**, PWA **8/8**, cero logins/cargas/mutaciones. Dos workers estables después de recargar, PM2 guardado y otras aplicaciones/Nginx intactos. `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`; uploads y todos los flags conservados. **CAP, correos y push cerrados. Adendas/eventuales/revisión de partes false; relevos/GPS múltiple true.** La publicación no habilita fuentes apagadas ni rellena una cola histórica.

Reversión preparada y verificada, sin ejecutar: `ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-hallazgos-psip-c9cd877f/publish-production.js rollback'`. **Sólo interfaz/manual** a `a6a5c005` / manual 2026.20.16, SW v139/app 20261020211357 y assets de ambas versiones. **Mantiene backend c9cd877f, informes/cola, reservas de pago, tramos y esquema.** No restaurar base, borrar evidencias o degradar a un backend que ignore las fuentes. Auditoría privada en esa carpeta; sólo reportes filtrados recuperados localmente.

Aceptación previa en esquema artificial propio `inspection_intake_20261020`: backend **69/69**, frontend **43/43**, API **11 grupos**, alcance/rectificación/vínculo existente **4**, rollback forzado **3**, PDF **3**, flags/CAP **3**, navegador **9/9**, manual **24/24 + 3/3 navegador**, tipos/builds/lint y diff Prisma vacío PASS. **115 tablas** QA previas intactas, 49 antecedentes artificiales, cero correos encolados y 26 archivos de producto/manual contrastados. Sin suites globales o certificación física; límites e intentos fallidos documentados.

Preview detenido de nuevo **18:11:42 Mendoza**, antes de migrar; sin servicios QA/PostgreSQL iniciados durante el build, sin OOM, imagen/base/evidencia conservadas. **main conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`**, sin push ni workflows. Evidencia ignorada `test-results-deploy-c9cd877f/`; cierre documental `[skip ci]` sobre el único checkout, producto aprobado intacto.

## Antecedente publicado — control ATM y lectura eléctrica a6a5c005, 20/10/2026

**Backend, web, app y manual `a6a5c005e94aa68ee20b6f410313515f094cb897` publicados** en `sitrep.ultimamilla.com.ar` el **20/10 a las 16:45:59 Mendoza**, con autorización del dueño. Leer primero [respaldo, migración, publicación y reversión actual](DESPLIEGUE-PAGOS-ATM-20261020.md). El pago se reserva por identidad antes de aprobarlo; otra foto/alta/CUIT/año no habilita un uso nuevo. OCR eléctrico con evidencia, sin transformar kWh/kW/tarifa a HP ni cambiar la TEF. Los históricos sin identificar quedan para conciliación administrativa; no se consultaron ni alteraron registros reales para esta publicación.

Backup **23.735.483 bytes**, SHA-256 **`55a2e300216feda4950a34cec3f8c4ebb023788e81fa5161280e55bbf7871752`**, índice y decodificación completa verificados antes de migrar. Única migración **`20261020180000_payment_identity`** con `prisma migrate deploy` en `public`; mismo SQL aditivo con dueño restringido en CAP cerrado, sin baseline ficticio. Se conservaron 24 migraciones fuente anteriores y 16 entradas históricas fuera del checkout. Tres tablas nuevas por esquema; no seeds, backfill, conciliaciones ni restauración.

Compilación nueva con API final y **2.235 blobs** exactos; tipos/backend/web/app PASS, **375 backend / 501 web-manual / 198 app / 14 Prisma** por hash. Smoke no mutante **95/95**, externo **9/9**, PWA PASS. SW raíz **v136**, app **20261020193942**, manual **2026.20.16**; activación explícita y assets anteriores conservados. Dos workers estables, PM2 guardado; `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`, CAP cerrado, correos/push apagados y flags/uploads intactos. Sin logins, archivos reales ni mutaciones de negocio en el smoke; main intacto, sin push/workflows.

Reversión preparada, **sin ejecutar y sólo de interfaz/manual**: `node /var/backups/sitrep/20261020-pagos-electricidad-a6a5c005/publish-production.js rollback` en el servidor. UI anterior `2200e955`, manual 2026.20.15, SW v137/app 20261020194343, **backend a6a5c005 retenido**. No volver a un backend que ignore las reservas ni restaurar la base. Preview detenido **16:43:41 Mendoza**, 1 CPU/2 GiB/swap cero, sin OOM; imagen/base/evidencias preservadas. Cierre `[skip ci]` posterior sólo documental.

## Validación previa — control ATM y lectura eléctrica a6a5c005, 20/10/2026

**Publicado después de esta validación, según el cierre de arriba.** Producto `a6a5c005e94aa68ee20b6f410313515f094cb897`, rama `codex/sitrep-training-20261018`, único checkout autorizado. Leer [control de comprobantes, facturas, fuentes y cierre](CONTROL-COMPROBANTES-ATM-Y-FACTURAS-20261020.md). El pago ATM se identifica y reserva por ID/operación revisados antes de aprobarlo; otra fotografía/alta/CUIT/año no constituye un pago nuevo. Reemplazo/retiro no libera la reserva. Control conservador dentro de SITREP, sin acreditar fondos ante ATM. Los históricos ilegibles requieren conciliación; sobre 500 pendientes por fuente se necesita una conciliación por lotes, sin herramienta masiva en esta entrega.

OCR de factura para Generador/Operador: catálogo de once distribuidoras de Mendoza, categoría tarifaria literal, suministro/período, kWh y potencia en kW con evidencia. **El test vigente usa potencia instalada en HP**: no se transforma el consumo ni se cambia TEF. Once encabezados y un PDF híbrido artificiales probados con motores nativos; no se certifican todos los formatos reales. Manual **2026.20.16**, misma estructura/CSS/renderer. La fórmula R fiscal sigue pendiente de conciliación.

Preview final: backend **166/166**, frontend **37/37**, API **11 grupos**, volumen **3 grupos** (501 indexados/501 sin identificar/rollback completo), migración final **3 grupos + diff Prisma vacío**, navegador **12/12**, regresión de recibos **15/15**, manual **21/21**, tipos/builds/lint y auditoría **5 grupos** PASS. **48 archivos** de producto coinciden con lo probado; **1.202 fuentes** de producto coinciden con los builds. Todos los registros previos del QA compartido conservaron hashes; 32 altas artificiales aprobadas con pagos reservados, doce facturas adjuntas y 81 correos suprimidos, cero intentos/envíos. CAP cerrado y cuatro alias 403, proveedores vacíos, flags conservados.

Una migración nueva **`20261020180000_payment_identity`**, sólo en el esquema propio `payment_identity_20261020`; el QA `public`, CAP y producción no se migraron. Ensayo exacto final con rollback y nombre de índice corregido antes de publicar. Futuro despliegue requiere autorización, conciliación histórica cuando corresponda, backup verificado, migración, versiones SW y builds nuevos con API final. Los paquetes aceptados usan `/api` local. No borrar reservas/eventos ni volver a un backend que ignore el control para deshacer UI.

Cierre de aquella validación **20/10, 16:23:08 Mendoza**: API/estático/PostgreSQL propios cerrados, contenedor `Running=false/Pid=0`, `max/oom/oom_kill=0`; imagen, base y evidencias preservadas. QA serial, un worker/1 CPU/2 GiB/swap cero. No producción, datos reales, `main`, push ni workflows durante ese QA; commits `[skip ci]`. Entonces `2200e955` era la última publicación documentada. La autorización e inspección/publicación posteriores se registran arriba.

## Publicación anterior — PSIP Legales y comprobantes ATM 2200e955, 20/10/2026

**Backend, web, app y manual `2200e9555e8e97d394c342f9ef519604ed1f365a` publicados** en `sitrep.ultimamilla.com.ar` el **20/10 a las 14:32:13 Mendoza**, con autorización del dueño. Rama `codex/sitrep-training-20261018`, checkout único del traspaso. Leer primero [publicación, controles y rollback actual](DESPLIEGUE-PSIP-LEGALES-20261020.md), después [revisión de Legales, comprobantes, fuentes oficiales y cierre](PSIP-LEGALES-ATM-20261020.md). Legales explicita quién actúa, permite a administración registrar avance/finalización y muestra al inspeccionado sólo el resultado marcado público. Los registros ATM existentes se conservan con alcance pendiente de validar; no se confunden con el control del pago del alta.

Preview final: backend dirigido **190/190**, frontend dirigido **84/84**, recorridos Legales **9/9**, comprobantes **15/15**, capturas con geometría/oclusiones **3/3**, manual **20/20 + 6/6 navegador**, tipos/builds/lint y auditoría PASS. Manual candidato **2026.20.15**, mismo diseño. Las actuaciones originales de ambos lotes artificiales conservaron sus hashes. Cero correos pendientes/intentos/envíos; la tabla conserva 21 registros suprimidos, 19 nuevos por las altas artificiales. CAP cerrado, SMTP/VAPID vacíos, correos/push apagados y flags conservados. Servicios QA/PostgreSQL cerrados, contenedor detenido, evidencia/imagen/base preservadas; max/oom/oom_kill=0. Un worker/1 CPU/2 GiB/swap cero, sin suites globales ni certificación física.

**Pendientes fiscales explícitos:** el mismo archivo ya dispara duplicado, otra foto del mismo ticket puede eludirlo. Falta el registro por identidad del pago ligado al obligado, concepto/período, liquidación y trámite; no se implementó ni se afirma una validación ATM. El anexo 2026 distingue inscripción/renovación de TEF; M coincide (162), pero la fórmula R del simulador difiere del anexo consultado y queda para conciliación, sin cambiar importes/reglas. El cierre documenta los campos del ticket oficial y un control propuesto, sin pedir al dueño un identificador que no conoce.

Publicación recompilada con API final sobre **2.215 blobs** exactos: tipos/backend/web/app PASS, **368 backend / 500 web-manual / 197 app / 14 Prisma** verificados por hash. Smoke no mutante **78/78**, externo **9/9**, PWA PASS. SW raíz **v134**, app **20261020172055**, manual **2026.20.15**. Dos workers estables; `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`, CAP cerrado, correos/push apagados y flags/uploads conservados. **Sin migración, consultas de registros reales ni logins; main intacto**, sin push/workflows. Preview detenido de nuevo **14:33:21 Mendoza**, sin OOM; imagen/evidencia/base artificial preservadas. Los bundles de aceptación QA usan `/api` local; se desplegaron los nuevos paquetes con el dominio final.

Rollback preparado, sin ejecutar: backend `25b0c30c` y copia de su web/app/manual, assets de ambas versiones, SW v135/app 20261020172510. Comando: `ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-psip-legales-2200e955/publish-production.js rollback'`. Sin restaurar base ni volver a un backend sin custodia por tramos. Primer intento detenido antes de activar por serialización de un PID ausente de PM2; control normalizado sin omitir procesos y segunda pasada correcta, con ambas evidencias conservadas. Cierre documental `[skip ci]`.

## Antecedente publicado — PSIP plazos y responsables 25b0c30c, 20/10/2026

**Backend, web, app y manual `25b0c30c860cc91091591ad51b9b2ab9dc72a0cf` publicados** en `sitrep.ultimamilla.com.ar` el **20/10 a las 12:57:42 Mendoza**, con autorización del dueño. Leer primero [publicación, controles y rollback actual](DESPLIEGUE-PSIP-PLAZOS-20261020.md), después [plazos por requerimiento, responsables y validación previa](PSIP-PLAZOS-RESPONSABLES-20261020.md). Corrige el cálculo de presentación tardía con el pedido respondido, el reintento de un pedido ya incorporado después de vencer, los falsos pendientes del plazo general y la hora de Mendoza independiente del dispositivo. Listados y expediente indican quién debe actuar; los pedidos conservan su fecha y respuesta propia. Se corrigió también un título aplastado en móvil y se repitió la aceptación sobre builds nuevos.

Backend dirigido **177/177**, frontend **47/47**, navegador **12/12** (web, web móvil, app), manual **20/20 + 6/6**, tipos/builds/lint PASS. Catálogo artificial: **21 casos / 273 avisos**, nueve faltas de respuesta resueltas sin aceptar subsanación, doce pendientes, sin duplicados; **57 requerimientos originales** conservados, cola de correo sin cambios. Manual **2026.20.14**, mismo diseño. Fuentes finales **2.207 blobs** verificadas local/remoto; 1 worker/1 CPU/2 GiB/swap cero, sin OOM. No son suites globales ni certificación Android física.

La aceptación anterior se realizó sin producción. Después se recompiló desde el SHA autorizado con API final: **2.207 blobs**, tipos/backend/web/app PASS, archivos por hash **368 backend / 500 web-manual / 197 app / 14 Prisma**. Smoke publicado no mutante **78/78**, externo **9/9**, controles PWA PASS. SW raíz **v132**, app **20261020155342**, manual **2026.20.14**; assets previos preservados y activación explícita. Dos workers estables, `.env` idéntico por hash `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`, CAP cerrado, correos/push apagados, flags/uploads conservados. **Sin migración, consultas de registros reales ni logins; `main` intacto**, sin push/workflows. Preview detenido de nuevo **12:59:11 Mendoza**, sin OOM; imagen/evidencia preservadas.

Rollback preparado, sin ejecutar: backend `527d915c` y copia de su web/app/manual con assets de ambas versiones, SW v133/app 20261020155600. Comando: `ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-psip-plazos-25b0c30c/publish-production.js rollback'`. Sin restaurar base ni volver a un backend sin custodia por tramos. La incidencia de cierre de locks en la preparación y su corrección antes de activar están registradas en el despliegue.

## Antecedente publicado — PSIP 527d915c, 20/10/2026

**Backend, web, app y manual `527d915cf600b793333fd4772ea7e8178cd77f0f` publicados** en `sitrep.ultimamilla.com.ar` el **20/10 a las 11:01:45 Mendoza**, con autorización explícita del dueño. Leer [publicación, comprobaciones y rollback actual](DESPLIEGUE-PSIP-20261020.md). Releases activos: `/var/www/sitrep-backend-releases/20261020-psip-527d915c` y `/var/www/sitrep-releases/20261020-psip-527d915c`; los tres identificadores de `/release.json` corresponden al SHA autorizado.

Build serial en preview, 1 CPU/2 GiB/swap cero, API `https://sitrep.ultimamilla.com.ar/api`, **2.199 blobs** verificados antes/después. Manual **2026.20.13**, CSS/renderer conservados por hash; SW raíz **v130** (versión de caché del artefacto), app **20261020135436**. Activación explícita del usuario y assets anteriores preservados. Smoke no mutante **76/76**, externo **9/9**, PWA PASS; dos workers online y readiness PASS.

CAP cerrado; correos/push apagados; flags y `UPLOADS_DIR` conservados. `.env` idéntico por hash **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**, con respaldo privado y estado PM2 verificados. **Sin migración, consultas/modificaciones de registros de negocio ni logins.** No se dispararon workflows ni se hizo push; `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`.

Rollback preparado, **sin ejecutar**: backend compatible `d372ce6e` + interfaz `6788c82c` y manual anterior, SW raíz v131/app 20261020140009. Comando: `ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-psip-527d915c/publish-production.js rollback'`. **No restaurar base ni volver a un backend sin custodia por tramos.** Auditoría privada en esa carpeta y copia local filtrada `test-results-deploy-527d915c/`. Preview detenido a las **11:05:12 Mendoza**, `Running=false`, `Pid=0`, sin OOM; imagen/artefactos preservados. El cierre posterior es sólo documental con `[skip ci]`.

## Preparación PSIP — revisión de inspecciones, 20/10/2026

Leer [PSIP: flujo, implementación, límites, validación y capturas](PSIP-FLUJO-INSPECCIONES-20261020.md). El seguimiento ya existía; ahora la interfaz agrupa Preparación y visita, Seguimiento, Derivaciones y Cerradas, conservando los 13 estados, permisos y transiciones. El filtro se aplica antes de paginar, también en exportación y copias offline. El intercambio señala quién debe actuar, permite responder directamente al pedido y conserva el último plazo histórico. Se corrigió la carrera que podía recuperar un borrador ya enviado y tapar la respuesta al requerimiento siguiente; se preserva el borrador si el servidor rechaza el envío.

La primera agrupación PSIP (`85b5f5d5`, manual **2026.20.12**) se validó con **54/54 backend**, **80/80 frontend**, **18/18 recorridos únicos** entre web/web móvil/app, **20/20 manual**, **6/6 navegador de ayuda** y captura app **1/1**. Conserva sus capturas artificiales y el directorio §18; se eliminó una dependencia posicional del índice de guías para preservar la capacitación anterior.

**Extensión actual: campana automática por cada actuación formal**, sin correo/push a nadie. Leer [avisos PSIP: destinatarios, persistencia, validación y cierre](PSIP-AVISOS-INTERNOS-20261020.md). Pedidos/respuestas/decisiones de autoridad avisan al inspeccionado vinculado; sus respuestas, descargos y subsanaciones avisan al inspector asignado y administraciones competentes, sólo cuentas activas, sin copia al autor. Se guardan en la misma transacción y los reintentos no duplican. Los enlaces abren el intercambio correcto en web y app y refrescan un expediente ya abierto; se corrigió el recorte izquierdo del panel móvil.

Manual **2026.20.13**, misma guía y diseño. Ampliación validada en preview: **157/157 backend**, **79/79 frontend**, **9/9 recorridos finales** (3 roles × web/web móvil/app), **81 actuaciones / 432 avisos** con destinatarios exactos, rollback e inactivos verificados en PostgreSQL, **0 correos encolados**, **20/20 manual**, **6/6 navegador de ayuda**, TypeScript/builds/lint PASS. Se conserva la primera pasada funcional y el hallazgo visual que motivó el arreglo y la repetición. Un worker/1 CPU/2 GiB/swap cero; no suites globales ni certificación Android física. CAP, correos/push y flags conservados. Las reglas por vencimientos/falta de respuesta siguen separadas; el aviso o la apertura no acreditan notificación fehaciente ni dan acceso a un tercero sin cuenta/vínculo.

**Candidato publicado después como `527d915c`, según el cierre de publicación de arriba.** La aceptación funcional se realizó antes de publicar, sin acceder a producción ni a registros reales. Evidencia inicial `test-results-psip-20261020/` / `.qa-psip-20261020/`, ampliación `test-results-psip-notices-20261020/` / `.qa-psip-notices-20261020/`. Cierre de esa validación: **20/10, 10:40:25 Mendoza**, servicios QA y PostgreSQL cerrados, contenedor detenido, imagen/evidencias preservadas; `max=0`, `oom=0`, `oom_kill=0`. No desplegar los bundles de QA (`/api` local): la publicación utilizó una compilación nueva con API final y versiones SW propias.

## Antecedente — web y app 6788c82c, 20/10/2026

**Web y app `6788c82c` publicados el 20/10 a las 07:20:58 Mendoza** en `sitrep.ultimamilla.com.ar`: viajes propios antes de relevos, **Reintentar GPS** en un toque conservando cargas/un único captor y **Reintentar envío** distinguido por carga. Incluye acciones/ayuda/reloj de `153ab704`. **Backend y manual `d372ce6e` conservados**, mismos procesos y configuración, sin restart/reload, migración o consulta de registros reales. Frontend activado entonces `/var/www/sitrep-releases/20261020-chofer-6788c82c-r2`; identificación pública en `/release.json`.

Leer [publicación, incidencias, evidencia y rollback de aquella interfaz](REVISION-OPERACION-MANIFIESTOS-20261019.md). Smoke publicado no mutante **62/62**, HTTPS externo **9/9**, PWA PASS. Previo en preview: **146/146** dirigidas, **77 grupos API**, **12/12** navegador en web/web móvil/app. Recompilación final con API del dominio, flags actuales, fuentes del commit verificadas antes/después; 253 archivos web y 195 app verificados por SHA-256. No hubo login ni ejercicios/GPS/correos/push en producción; no se certificaron teléfonos físicos ni se repitieron suites completas al publicar.

CAP cerrado, correos/push apagados, `UPLOADS_DIR` conservado; dos flags de transporte true y originales false, sin cambios. `.env` SHA-256 `618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`. SW raíz **v128** (versión de caché del artefacto), app **20261020100715**; manual **2026.20.11** intacto. El aviso de nueva versión mantiene activación explícita del usuario. Preview serial, 1 CPU/2 GiB/swap cero, detenido a las **07:23:42 Mendoza**, sin OOM ni servicios QA/túnel; imagen/evidencia conservadas. Rama `codex/sitrep-training-20261018`, único checkout activo, `main` permanece `c840219`; cierre `[skip ci]`, sin push ni workflows.

Rollback sólo frontend preparado en `/var/www/sitrep-releases/20261020-chofer-6788c82c-r2-rollback`: interfaz previa `d372ce6e` más assets de ambas versiones para clientes abiertos, mismos backend/flags/datos, caché raíz v129 y app 20261020102057. Comando guardado: `ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-chofer-6788c82c/deploy-frontend.js rollback'`. No se ejecutó. **No restaurar base ni volver a un backend sin custodia por tramos.** La copia inactiva del primer intento se conservó; incidencias de telemetría PM2/extracción y protección local documentadas en la revisión. Auditoría privada productiva en esa carpeta; evidencia local `test-results-deploy-6788c82c/`.

## Antecedente publicado — relevos y GPS múltiple, 19/10/2026

**`d372ce6e` publicado** en backend, web, app y manual el **19/10/2026 a las 21:25:45 Mendoza**, en `sitrep.ultimamilla.com.ar`. Relevos y GPS múltiple habilitados en backend/Vite por autorización explícita. La transportista original define el traspaso, incluso a un externo sin alta con los datos disponibles; se conserva custodia por tramos, acceso GPS limitado y avisos internos a partes/C3. Acuerdo firmado y entrega de origen intactos; no se infiere habilitación de externos ni resolución de D10.

Leer primero [despliegue, respaldo, configuración y contención](DESPLIEGUE-RELEVOS-20261019.md) y después [revisión funcional y QA](REVISION-OPERACION-MANIFIESTOS-20261019.md). Backend 1177/1177, frontend 1615/1615, API sintética 26 grupos, navegador web/app 6/6 y manual 15/15 previos. Nueva compilación en preview serial, 1 CPU/2 GiB/swap cero, API del dominio final y dos flags de transporte true. Migración aditiva única aplicada en `public` y CAP después de respaldo verificado; no repetir las doce históricas. Publicado: smoke no mutante **57/57**, HTTPS externo **9/9**, PWA PASS. SW raíz v127, app 20261020001844; manual 2026.20.11, CSS/renderer intactos. CAP cerrado, correos/push apagados, cuatro flags originales false, uploads conservados. `main` intacto; sin push ni workflows. Preview detenido y sin OOM. **No volver al backend anterior que desconoce tramos ni restaurar una base vieja para revertir interfaz.** La contención preparada conserva el backend compatible y los enlaces GPS; no se ejecutó.

## Historial — aviso de acceso corregido, 19/10/2026

Web/app **`75f3062`**, publicado 11:42:46 Mendoza: conserva el mensaje de error al volver al formulario después de un login fallido. Generador CAP confirmado por API y UI; los cuatro alias responden 200. Credenciales, límites y permisos sin cambios. Backend `8de58de` sin reinicio, manual `ea92004` conservado, SW v126. Unitarias dirigidas 33/33; navegador publicado 4/4 (401/429 inyectados, login real y recarga de sesión en web/app); build remoto serial y smoke 44/44. Rollback sólo frontend a `20261019-agenda-live-ea92004`. Sin datos reales, main ni workflows. Leer [incidente, pruebas y rollback](ACCESO-CAPACITACION-20261019.md).

## Historial — agenda actualizada al crear, 19/10/2026

Web/app/manual **`ea92004`** publicados a las 09:29:02 Mendoza. El recién creado aparece primero, actualiza agenda al crear y llega a otra sesión sin recargar; después de la aprobación propia queda **En espera**. Animación breve con movimiento reducido respetado. Aprobaciones y permisos conservados. Backend `8de58de` sin reinicio; SW v125, manual 2026.20.9. Preview: unitarias 22/22, manual 16/16, cuatro roles × web/app 8/8. Agenda publicada de sólo lectura 3/3, smoke 44/44. Gemelo detenido y relay cerrado. Rollback sólo frontend al release `20261019-icons-88b1a0e`. Sin datos reales, main ni workflows. Leer [pruebas y rollback](AGENDA-CAPACITACION-20261019.md).

## Historial — simplificación visual, 19/10/2026

Web/app `88b1a0e`: íconos compactos sin tilde/reloj, verde aprobado y gris pendiente. Manual `71780c6` actualizado; backend `8de58de` conservado, sin reinicio. Agenda publicada 3/3, smoke 44/44, manual 16/16 + 4/4 archivos. SW v124; mismos accesos CAP. Rollback sólo frontend al release `20261019-agenda-8de58de`. Sin datos reales, main ni workflows. Leer [estado, pruebas y rollback](AGENDA-CAPACITACION-20261019.md).

## Historial — agenda de capacitación, 19/10/2026

**Backend, web, app y manual publicados sobre `8de58de`, el 19/10/2026 07:23:27 Mendoza.** Leer [agenda, pruebas y rollback](AGENDA-CAPACITACION-20261019.md). Inicio compacto con filtros y tres aprobaciones visibles; certificados con íconos/estados; adenda con teclado de texto; contraste y diálogo de entrega corregidos. Circuito aprobado conservado.

Publicado: circuito 2/2, eventual 2/2, manual 3/3, agenda 3/3, smoke 44/44. 83 manifiestos CAP anteriores intactos, mismos cuatro accesos simples. Sin datos reales, main, correos ni push productivo. SW v123; actualizar web/app y activar sonido. Rollback inmediato: ambos releases `20261018-proactivo-gps-312d6f2`; sin restaurar base. Gemelo detenido y relay cerrado. Los intentos fallidos y límites de QA se documentan en el cierre.

## Historial — avisos proactivos y entrega GPS corregida

**Backend, web, app y manual publicados sobre `312d6f239a015b0528218bf7d9a710fff4f36d04`, el 18/10/2026 a las 22:24:44 Mendoza.** Leer [afinamiento, pruebas, límites y rollback](AFINADO-CAPACITACION-20261018.md). Único checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`; main permanece `c840219`, sin integración. Commits `[skip ci]`, sin workflows.

Los cuatro accesos CAP del equipo 1 conservan sus claves simples. Abrir `/app/` o web, actualizar la versión y tocar **Activar sonido**. El aviso nuevo aparece con enlace al caso, sin cubrir botones. Cualquier rol CAP crea la propuesta; generador firma, transporte y operador aprueban. Con las tres decisiones, una parte pulsa **Iniciar coordinación**; luego transporte confirma el retiro físico y envía GPS. El cierre espera los envíos GPS pendientes antes de confirmar entrega. Operador recibe/pesa/trata, firma y publica parcial/final; los otros descargan desde el mismo manifiesto. Fechas futuras son los mismos manifiestos programados. Adendas y eventual conservan sus revisiones y límites.

Comprobación publicada final: **circuito 2/2, eventual 2/2, manual 3/3 y smoke 44/44**. Incluye cuatro sesiones independientes, aviso visible, inicio idempotente, GPS hacia C3, entrega con envío en vuelo, adenda independiente y certificados firmados. Casos finales: CAP-2026-000046, CAP-2026-000041. El intento previo sobre `0e5ad03` tuvo web fallida por una carrera GPS; se conserva la evidencia y se corrigió el producto, sin excluir el error del test. GPS emulado; no certificación de sensores, Android ni segundo plano.

Auditoría a las 22:34:26: **62 manifiestos CAP anteriores intactos**, incluido el cierre humano de `CAP-1-ENTREGADO`; 40 cuentas CAP activas. Veinte manifiestos propios de los dos ensayos publicados conservados, cuatro tratados, ocho certificados, dos eventuales tratados. Datos reales no consultados. `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`, UPLOADS_DIR, flags false, correos apagados y VAPID vacío conservados; sin migraciones ni seeds. Accesos hasta `2026-10-20T03:00:00Z` (fin del lunes 19, Mendoza).

Releases activos `20261018-proactivo-gps-312d6f2`. SW raíz **v122**, app **20261019012304**. Hojas A4 privadas con QR/usuarios/claves: `test-results-proactivo-20261018/output/pdf/`; no incorporar claves a Git/manual. Auditoría privada `/var/backups/sitrep/20261018-proactivo-gps/`.

Rollback inmediato: volver ambos enlaces a sus releases `20261018-proactivo-0e5ad03` y recargar sólo backend conservando configuración y vencimiento. Ese release incluye los avisos, pero conserva la carrera GPS corregida ahora. Para volver al producto anterior a todo este afinamiento, se conservan ambos `20261018-circuito-930d3e6`. **No restaurar base ni borrar prácticas.** Gemelo propio detenido, relay cerrado, imagen/evidencias conservadas. Límites 1 CPU/2 GiB/swap cero, un worker; sin OOM (contador `memory.events max` 12 durante el build final, sin kill).

## Instantánea histórica — circuito completo publicado, 18/10 a las 19:49:28 Mendoza

**Backend, web, app y manual publicados sobre `930d3e6ae7c363789d5474d4aa40b4242b860825`.** Leer primero [circuito completo, resultados y rollback vigente](CIRCUITO-CAPACITACION-20261018.md). Fuente única: `sitrep-production-source-20261001`; rama `codex/sitrep-training-20261018`. Main permanece en `c840219`, sin integración. Commits `[skip ci]`, sin workflows.

El operador, generador, transporte o administrador CAP pueden iniciar. Generador firma; transporte y operador aprueban por separado. Hay avisos internos y agenda de retiros futuros. El retiro requiere las tres decisiones. Después del viaje/GPS/C3, recepción/pesaje/tratamiento, el operador libera parciales y final con firma; la adenda conserva el original, requiere revisión independiente y debe resolverse antes del final. Sólo sesiones CAP autenticadas; permisos operativos y flags siguen sin activarse.

Prueba publicada: web completa aprobada y repetición app completa aprobada; eventual 2/2, manual 3/3 y smoke público 44/44. Los intentos fallidos de QA se conservan y explican en el cierre. A las 20:03:12: 40 cuentas CAP y 35 casos preparados intactos; 000015/000025 Tratados con dos posiciones GPS y certificados; 000020 quedó pendiente por una interrupción del test, sin viaje activo. Para mañana crear otro caso y compartir su número. El GPS fue emulado: comprobar el teléfono físico con la hoja.

Los cuatro accesos y sus claves simples no cambiaron; no se usa administrador personal. Vencen al finalizar el lunes 19/10 en Mendoza (`2026-10-20T03:00:00Z`). Dos hojas A4 privadas con QR y pasos están en `test-results-circuito-20261018/output/pdf/`. Manual conserva diseño. SW raíz v120, app 20261018224742; recargar web/app o usar el aviso de nueva versión antes del ensayo.

`.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`, sin cambios. UPLOADS_DIR, flags false, correos apagados y VAPID vacío conservados. Sin migraciones, semillas ni restauraciones. Auditoría privada `/var/backups/sitrep/20261018-circuito/`.

Rollback vigente: backend y frontend activos `20261018-circuito-930d3e6`; volver ambos enlaces a sus releases `20261018-direct-97c77be`, recargar sólo backend y conservar la variable de vencimiento y las claves. No restaurar base ni borrar prácticas. Gemelo propio detenido, relay cerrado, imagen y evidencias conservadas, sin OOM. Procedimiento y evidencias completos en el cierre enlazado.

## Instantánea histórica — accesos directos, 18/10 a las 11:43:39

**Lo que sigue conserva el cierre anterior. No sustituye el circuito, versión, resultados ni rollback vigente de arriba.**

**Backend, web, app y manual publicados sobre `97c77beecce5a349e53d47d89ad35881a599253a` en `sitrep.ultimamilla.com.ar`.** Leer primero [accesos directos, resultados y rollback vigente](ACCESOS-DIRECTOS-CAPACITACION-20261018.md). El dueño pidió cuatro usuarios/contraseñas para la pizarra, sin su administrador personal en los teléfonos. Los alias `admin@capacitacion.invalid`, `generador@capacitacion.invalid`, `transporte@capacitacion.invalid` y `operador@capacitacion.invalid` autentican exclusivamente las cuatro cuentas CAP del equipo 1. Contraseñas privadas fuera de Git y del manual. Vencen al terminar el lunes 19/10 en Mendoza.

Abrir `/app/`, entrar directamente y comprobar la banda amarilla «Capacitación · sin validez oficial». Seguir el manual «Un manifiesto, cuatro teléfonos»: crear y firmar → retirar y enviar GPS → observar el mismo número en C3/Hoy → entregar → recibir/pesar/tratar/cerrar. Cada persona conserva su rol. Eventuales y adendas mantienen el ámbito escolar y sus revisiones; los flags operativos, correos y push siguen apagados.

Fuente única y rama sin cambios: este checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`; main `c840219`, sin integrar. SW raíz v119, app `20261018143836`. Backend completo 1.112/1.112; frontend completo 1.568/1.568. Recorridos publicados 2/2, manual publicado 3/3 y smoke 44/44. A las 11:50:18: 40 cuentas CAP, 35 casos preparados intactos, casos nuevos 000009/000010 tratados y workers sin reinicios posteriores. Gemelo propio detenido y relay cerrado, imagen/evidencias conservadas. Evidencia completa y límites en el cierre enlazado. GPS probado con coordenadas emuladas; falta comprobar ubicación física con los teléfonos de la clase.

Única variable nueva: `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`. `.env` actual SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`; se conservan todas las variables anteriores y `UPLOADS_DIR`. No hubo migraciones/seeds ni cambios de permisos. Se respaldaron y verificaron los cuatro hashes CAP antes de reemplazarlos. Auditoría privada: `/var/backups/sitrep/20261018-direct-login/`.

Rollback vigente: ambos enlaces activos apuntan a sus releases `20261018-direct-97c77be`; volver backend a `20261018-training-c819ecf` y frontend a `20261018-four-phones-f19d024`, con recarga exclusiva del backend y retiro de la variable nueva del entorno PM2. No restaurar la base ni borrar prácticas. El procedimiento exacto está en el cierre enlazado.

## Instantánea histórica anterior — f19d024 / c819ecf

**Todo lo que sigue conserva el cierre previo; sus hashes, rollback, cifras y forma de acceso no sustituyen el estado vigente de arriba.**

**Web/app/manual publicados: `f19d024c534be146a4d7eb1a863410f556c2bf28`, el 18/10 a las 10:42:14 de Mendoza. Backend conservado: `c819ecfa275afe58d4e2d6d93119adccef073ea8`.** Dominio `sitrep.ultimamilla.com.ar`. Capacitación artificial; Eventuales y adendas disponibles sólo en sesiones CAP firmadas. Flags operativos, correos y push apagados.

Leer [ensayo de cuatro teléfonos, resultados y rollback actual](ENSAYO-CUATRO-TELEFONOS-20261018.md). Comprobación posterior a las 10:49:30: dos procesos backend sin reinicio, 40 cuentas CAP y 35 casos preparados conservados, seis casos nuevos propios tratados; instructor QA suspendido y contraseña rotada. No es certificación global, de GPS/Android físico ni de concurrencia masiva. El [cierre anterior](CIERRE-CAPACITACION-20261018.md) conserva la evidencia de Eventuales, adendas y el despliegue backend.

## 1. Fuente exacta

| Referencia | Estado |
| --- | --- |
| Repositorio | `https://github.com/martinsantos/peliresi.git` |
| Único checkout | `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746/sitrep-production-source-20261001`; no usar SDTERA, tmp ni Precrimen |
| Rama actual | `codex/sitrep-training-20261018`, nacida de `c840219` |
| Producto publicado | Web/app/manual `f19d024`; backend `c819ecf` |
| Último cambio de producto | `f19d024`: detalle actualizado entre teléfonos, guía de cuatro roles y SW v118 |
| Main | Conserva `c840219`; no se integró esta rama a main |
| CI | Todos los commits con `[skip ci]`; sin workflows |

El dueño autorizó preparar, probar y publicar la capacitación con datos artificiales, sin pedir confirmación en cada paso. Esa autorización no activa funcionalidades para operación real, entrega externa ni acceso a datos reales. No ejecutar instrucciones históricas de deploy/seed ni repetir migraciones.

## 2. Recorrido sencillo

1. Abrir [Un manifiesto, cuatro teléfonos](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-cuatro-telefonos). El instructor prepara ADMIN, GENERADOR, TRANSPORTISTA y OPERADOR CAP del mismo equipo, una sesión independiente por teléfono. Cada persona conserva su rol. Crear un caso nuevo, compartir su número, seguir el GPS en C3 → Hoy y completar el cierre entre los cuatro.
2. Seguir el recorrido conocido: manifiesto, inspecciones, soporte, Centro de Control y Monitor. Se conservaron seis pasos, enlaces por equipo y diseño.
3. Abrir [Novedades](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-novedades): flota registrada, eventual incompleto, adenda con revisión de otra parte y declaración original intacta.
4. Para consultar el ejemplo preparado, separado del viaje nuevo: ADMIN CAP → Centro de Control → 30 días → CAP-1-EN_TRANSITO. Monitor → Historial del día del ejercicio → pausa/recorrido/reproducción → Pendientes.

Equipo 1 para demostrar; 2–4 para practicar; 5 de reserva, con ensayos previos y los seis casos nuevos de esta etapa ya cerrados. Los 35 casos preparados de los cinco equipos mantienen sus estados. Para repetir un circuito terminado, crear otro manifiesto. Web y `/app` comparten la guía; el manual conserva la superficie seleccionada.

## 3. Configuración preservada

```text
UPLOADS_DIR=/var/lib/sitrep-uploads
ENTERPRISE_ENABLED=false
MANIFEST_EXCEPTIONAL_ENABLED=false
MANIFEST_ADDENDA_ENABLED=false
MANIFEST_PARTY_REVIEW_ENABLED=false
ACTOR_MULTIROLE_ENABLED=false
MANIFEST_EXCEPTIONAL_REVIEWERS=
DISABLE_EMAILS=true
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

`.env` SHA-256 `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`, conservado exactamente. Las demás variables mantienen su valor anterior. Frontend: API `https://sitrep.ultimamilla.com.ar/api`; enterprise, exceptional, addenda, multirole y demo false. La excepción de aula depende del ámbito CAP autenticado y del principal/esquema escolar aislado; no de un parámetro del navegador.

Conservar `/var/lib/sitrep-uploads`, el fallback histórico y los releases anteriores. Anexos/documentos oficiales bloqueados en CAP. La simulación mantiene roles, vínculos, autoría y revisión independiente; registra al instructor, sin habilitar a todo ADMIN como revisor regulatorio.

## 4. Validación de esta entrega

| Verificación | Resultado |
| --- | --- |
| Backend completo | 1.074/1.074; backend sin cambios posteriores |
| Frontend completo (baseline) | 1.561/1.561 antes de las últimas correcciones; no se repitió la suite completa sobre f19d024 |
| Manual y Monitor posteriores | 14/14 estáticas, 43/43 manual, 70/70 Monitor |
| Capacitación en preview | 36 recorridos aprobados; C3 repetido 3/3 sobre c819ecf; tres superficies |
| Altas/OCR | 3/3 con Tesseract real y borradores recuperados, sin cuentas/solicitudes nuevas |
| Build actual | Web/app f19d024; 2.090 fuentes verificadas antes/después; 244 + 187 archivos de artefactos. Backend c819ecf sin cambios |
| Smoke actual | 44/44 públicos + cinco archivos del manual por hash; sin lectura de negocio |
| Aula previa c819ecf | Primera corrida 5 aprobados/1 espera fallida; C3 web y app repetidos 2/2 con 420cdd3. Quedan cubiertos los seis recorridos, sin presentar el conjunto como una sola corrida 6/6 |
| Cuatro teléfonos | Preview 2/2 y aula publicada 2/2: cuatro sesiones persistentes, dos ubicaciones enviadas por UI, C3 y cierre en todos los roles; GPS emulado |
| Pruebas de la corrección y manual | 80/80 unitarias, 15/15 estáticas, 9/9 manual en preview y 3/3 manual publicado |
| Estado posterior actual | 40 cuentas CAP, 35 casos preparados intactos; seis casos nuevos propios tratados, incluidos los dos interrumpidos recuperados por UI; dos workers sin reinicio e instructor QA suspendido |

Toda prueba pesada/build: preview remoto, serial, un worker, 1 CPU/2 GiB/swap cero. No OOM. El cierre detalla las fallas iniciales y sus correcciones, incluida la espera de autoplay, la falta de Tesseract en el gemelo y el cierre del instructor temporal. No se ocultaron fallos ni relajaron expectativas.

Límites: navegadores con datos sintéticos; no certifica Android/APK, cámara física, GPS de fondo, batería, carga masiva simultánea ni entrega de correo/push. Tiles de mapas de QA identificados; consultas y movimientos del backend del entorno correspondiente. No se recorrieron cuentas operativas reales.

## 5. Release, respaldo y rollback

| Enlace | Activo | Anterior exacto |
| --- | --- | --- |
| `/var/www/sitrep-backend` | `/var/www/sitrep-backend-releases/20261018-training-c819ecf` | No cambia en esta entrega; `1ab057a` es fallback histórico |
| `/var/www/sitrep` | `/var/www/sitrep-releases/20261018-four-phones-f19d024` | `/var/www/sitrep-releases/20261018-training-c819ecf` |

230 paquetes runtime iguales al lockfile; cliente Prisma 5.22 copiado desde esquema idéntico, sin compartir enlaces con el release anterior. SW raíz v118, app `20261018134006`. Nginx sin cambios. Auditoría actual: `/var/backups/sitrep/20261018-four-phones-release/`; anterior: `/var/backups/sitrep/20261018-training-release/`.

El esquema escolar anterior se respaldó y amplió con once tablas y dos columnas opcionales. Principal restringido, transacción con límites, rehearsal previo y diff Prisma sin diferencias. Huellas de las 44 tablas originales iguales antes/después. No se sembró ni reinició el aula. Backup escolar: `/var/backups/sitrep/20261018-training/training-before.dump`, 197.128 bytes, SHA-256 `fe0959459ff00243c13028c617165f8c20a59e9b20a4038de15ee0688ccfb109`. Índice y decodificación completa verificados; restauración no ensayada. Los respaldos permanecen en el servidor.

Rollback de esta entrega: comprobar los enlaces actuales y sustituir **sólo `/var/www/sitrep`** atómicamente por `20261018-training-c819ecf`. Comprobar web, app, manual y service workers. No recargar backend ni restaurar base, retirar tablas o borrar prácticas. El rollback histórico de la entrega backend a `1ab057a` permanece en el cierre anterior. Toda operación futura fuera del alcance autorizado requiere una nueva decisión del dueño.

El backup operativo del despliegue anterior sigue en `/var/backups/sitrep/20261018-step6-1ab057a/trazabilidad_rrpp-before-1ab057a.dump`, SHA-256 `75ac31216e042b96f4bed5a17ad5307e711f9999228675d9651c3477556a53f1`. Las 23 migraciones de fuente ya aplicadas y los 16 registros históricos se conservaron. **No repetir las doce migraciones del traspaso original.**

## 6. Preview y continuidad

Gemelo nuevo `sitrep-qa-training-20261018`: detenido al cerrar, imagen y artefactos conservados. Contenedores ajenos sin modificaciones de esta tarea. Original `sitrep-qa-enterprise-20261016` detenido. Sin servidor QA, suites ni relay activo. Fuente y evidencias: `/opt/sitrep-qa-enterprise-20261016/source/.qa-training-final-20261018`, `.qa-release-training-20261018`, `.qa-published-training-20261018`, `.qa-published-training-c3-20261018`. Evidencia local ignorada: `test-results-training-20261018/` y `test-results-four-phones-20261018/`. Las nuevas corridas y artefactos están detallados en el [ensayo de cuatro teléfonos](ENSAYO-CUATRO-TELEFONOS-20261018.md).

El gemelo anterior `sitrep-qa-live-20261017` y su imagen sí fueron eliminados en el cierre previo; no confundirlo con el nuevo. No reutilizar los antiguos túneles como si siguieran vivos.

## 7. Historia y pendientes conservados

[CIERRE-PRODUCCION-20261018.md](CIERRE-PRODUCCION-20261018.md) documenta el despliegue previo de `1ab057a`, la integración `96f333e`, el manual de main reconciliado y los resultados históricos. Esos estados no sustituyen esta entrega. [Hallazgos](HALLAZGOS-UIUX-20261016.md), [decisiones](DECISIONES-RELEASE-20261017.md) y [especificación de Eventuales](ESPEC-EVENTUALES-20261017.md) conservan reglas y decisiones funcionales.

Siguen pendientes fuera de esta capacitación: activación operativa de funcionalidades/correos/push, S5 en canales no implementados, rotación de credenciales de scripts capture, higiene S7/S9–S12, 16 SQL históricos ausentes, otros hallazgos UI y Android físico/concurrencia. No ejecutar seeds antiguos ni cambiar reglas regulatorias, permisos o históricos para facilitar pruebas. No afirmar GO global.
