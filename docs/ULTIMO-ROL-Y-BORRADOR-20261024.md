# Último rol y borrador al reabrir — 24/10/2026

## Resultado y alcance

Corregido y validado **sólo en preview** sobre la fuente activa, rama `codex/sitrep-training-20261018`, base documental `7a4a6e8e` / producto `462ad75a`. No publicado. Android físico sigue pendiente.

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

