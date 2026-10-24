# Último rol y borrador al reabrir — 24/10/2026

## Resultado y alcance

Corregido y validado en preview sobre la fuente activa, rama `codex/sitrep-training-20261018`, base documental `7a4a6e8e` / producto `462ad75a`. **Publicado como 75168a08 el 24/10/2026 a las 08:30:48 Mendoza**, con autorización posterior y smoke productivo de sólo lectura; ver cierre al final. Android físico sigue pendiente.

La selección Generador/Transportista/Operador de «Mi perfil → Mis actividades» se recuerda por cuenta en el mismo navegador/perfil. Una nueva apertura recupera esa selección y Nuevo Manifiesto recupera su borrador, sus campos y su paso. No se crea un manifiesto ni se envía un aviso al recuperar.

## Corrección

- `actorActivity.ts`: preferencia persistente por persona, validación de los tres valores permitidos y migración de sesiones existentes.
- Cada pestaña fija su propio contexto, incluso el rol base: otra pestaña puede elegir otro rol sin alterar las solicitudes de un formulario ya abierto.
- El servidor sigue validando permisos antes de mostrar el perfil. Una selección revocada se invalida para futuras aperturas; una pestaña antigua no vuelve a guardarla por migración.
- `companyContext.ts`: elegir una empresa borra también la preferencia personal anterior para que no reaparezca al cerrar. Esta tanda no agrega persistencia de empresa/sede.
- Sin cambio del mecanismo de borradores: aislamiento por cuenta/rol/actor/contexto, vigencia de siete días y descarte confirmado.

## Validación

Preview privado `http://127.0.0.1:4177`, backend real y base artificial `proposal_operations_20261021`; contenedor existente en 76.13.234.213, 1 CPU/2 GiB/sin swap adicional. CUA con Playwright de su navegador integrado; el plugin Browser no está disponible.

| Comprobación | Resultado |
| --- | --- |
| Unitarias dirigidas, 8 archivos | **87/87 PASS** |
| TypeScript | PASS |
| Build web / app | PASS / PASS |
| Lint de cuatro archivos | 0 errores, 2 advertencias preexistentes de `any` en companyContext.test.ts |
| Web 1365×900: cerrar/reabrir G, T y O | **3/3 PASS** |
| App 390×844: cerrar/reabrir G, T y O | **3/3 PASS** |
| Web → app → web, observaciones y cantidades distintas | PASS |
| Segunda pestaña cambia a Transporte; la de Operador se recarga | Conserva Operador y su borrador |
| Nueva apertura después de ambas pestañas | Recupera la última elección: Transporte |
| Logout → otra cuenta → logout → login en app de la original | Aislamiento y recuperación correctos |
| Descartar un rol | No elimina los otros borradores |
| Identidad de páginas / contenido / controles | PASS |
| Overlay de error / consola inesperada / desborde horizontal | Ninguno observado |

Se guardaron **33 observaciones DOM/capturas**, no son 33 E2E independientes. Los seis ciclos de reapertura cierran y crean una pestaña nueva del navegador integrado; no acreditan cierre del sistema operativo, PWA instalada ni Android físico. Tres borradores artificiales de esta prueba descartados por la UI al terminar; sesión cerrada.

Incidencias del guion conservadas: se interrumpió una primera compilación web que coincidía con el chequeo de tipos para continuar en serie y respetar memoria; repetición PASS, sin OOM. Una aserción inicial esperaba GENERADOR en la app, que muestra «Generador»; se corrigió el texto esperado y se repitió, sin cambio de producto.

## Protección y evidencia

Auditoría final 24/10/2026 11:15:59 UTC: **515 manifiestos antes/después**, **0 correos enviados**, **0 intentos**. CAP cerrado, SMTP/VAPID vacíos, correos/push apagados en ambos procesos verificados. Sin producción, main, workflows, seeds nuevos ni cambios a datos reales.

Runtime y servidor estático del preview cerrados a las 11:16:41 UTC, sin terminación forzada. Contenedor, PostgreSQL artificial y evidencias conservados.

Evidencias: [workspace de esta tanda](/Users/santosma/.codex/visualizations/2026/10/17/01a14c11-b01f-7b40-87c5-1672e1d92833/ultimo-rol-preview-20261024/result.json), con `source-files.json`, `unit.json`, `lint.json`, logs, `ui-checks.json`, capturas/DOM por caso, `audit.json` y `closure.json`.

## Límites

La preferencia no viaja entre dispositivos o perfiles de navegador. Borrar datos del sitio o usar almacenamiento privado puede eliminarla. Los permisos no se recuperan desde almacenamiento local: requieren validación del servidor. Si el almacenamiento persistente no está disponible, el rol continúa en la pestaña actual, pero no se garantiza su recuperación al cerrarla.

## Publicación en producción — 24/10/2026

La autorización posterior publicó el commit **75168a085e4000bb982463e26199e035eed6dad4** en backend, web, app y manual de `sitrep.ultimamilla.com.ar` a las **08:30:48 Mendoza (11:30:48 UTC)**. Sustituye sólo el estado «no publicado» de esta tanda; las pruebas funcionales anteriores siguen siendo de preview.

- Build exacto de **2.522 archivos** verificados antes/después, dentro del contenedor existente (1 CPU/2 GiB/swap adicional cero), fases seriales y sin OOM. Backend, Prisma, tipos, web y app PASS.
- Paquetes íntegros: backend 425 archivos, web 522, app 204 y cliente Prisma 14. No cambian dependencias, esquema ni migraciones. No se ejecutó ninguna migración ni operación de datos.
- Smoke productivo **187/187**, externo **9/9** y PWA **8/8 PASS**. GET de páginas/chunks/worker/manual/health, hashes exactos, protección 401 sin credenciales y 404 de recurso inexistente. Sin logins, creación de manifiestos ni cambios de borradores productivos. El tráfico genera logs y contadores técnicos normales, no operaciones de negocio.
- Dos workers SITREP en línea. Configuración `.env` idéntica byte a byte, flags actuales conservados y valores coincidentes en procesos/PM2 guardado. **CAP cerrado, correos/push apagados**, SMTP y VAPID vacíos. No se recargaron otras aplicaciones.
- Manual **2026.24.1**, copiado desde el commit exacto (sin cambios de contenido frente a 462ad75a). SW raíz **v170**, app **20261024112723**; activación por el mecanismo existente, sin borrar almacenamiento del usuario.
- `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`; sin push ni workflows. La documentación de cierre posterior no cambia el producto publicado.

### Respaldo y reversión

Respaldo privado y guion verificado: `/var/backups/sitrep/20261024-producto-75168a08`. Incluye configuración/PM2 con permisos 0600, manifiestos de archivos previos/nuevos, hashes y resultados. Las versiones anteriores permanecen disponibles. No hubo respaldo/restauración de base porque esta publicación no migra ni escribe datos.

Actuales:
- Backend: `/var/www/sitrep-backend-releases/20261024-producto-75168a08`.
- Web/app/manual: `/var/www/sitrep-releases/20261024-producto-75168a08`.

Reversión preparada, **no ejecutada**, al backend **462ad75a** y frontend específico `/var/www/sitrep-releases/20261024-producto-75168a08-rollback`, con SW **v171**, app **20261024113005**, assets nuevos retenidos para clientes en vuelo, flags/esquema/uploads conservados y sin restauración de base. Usar el guion de esta tanda (`node - rollback < publish-production.ts` desde su directorio privado), no los guiones históricos.

### Evidencias y límites productivos

[Evidencia de publicación](/Users/santosma/.codex/visualizations/2026/10/17/01a14c11-b01f-7b40-87c5-1672e1d92833/ultimo-rol-preview-20261024/release/release-result.json): `release-result.json`, `source-proof.json`, `build.json`, `qa-summary.json`, `preflight.json`, `stage.json`, `deployment.json`, `postflight.json`, `smoke.json`, `external-smoke.json`, `pwa-smoke.json` y hashes de los cuatro paquetes.

El smoke confirma entrega de los artefactos, rutas y salud de la versión publicada; no ejecuta las mutaciones ni acredita sesiones reales de todos los roles. Android físico y cierre completo de una PWA instalada continúan pendientes. Las seis reaperturas nuevas se probaron en preview mediante cierre y creación de pestañas, como se detalla arriba.
