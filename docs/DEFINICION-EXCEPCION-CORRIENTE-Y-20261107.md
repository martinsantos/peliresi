# Excepción por corriente Y no autorizada del generador · definición y análisis

Estado: **decidida e implementada en preview**, sin publicar. Rama `claude/excepcion-corriente-generador-20261107`, creada sobre `1cbd582c`. La regla vigente es la de la sección 5; la sección 7 resume la implementación, las pruebas y lo necesario para publicar.

## 1. La regla, en una página

**Qué cuenta como corriente autorizada del generador.** Es cada Y que figura en la ficha de inscripción del generador: los datos migrados a SITREP más las altas posteriores. Es la misma lista que hoy muestra la pantalla del generador. Ver el punto 3 sobre la migración incompleta.

**Caso 1. Diferencia de cantidad, unidad o Y no observada, sobre una Y autorizada.**
El operador registra la adenda al recibir y la autoridad o la contraparte la aprueba. Esto corrige el manifiesto y nada más: no hay que autorizar nada nuevo ni registrar una excepción.

**Caso 2. Aparece una Y que el generador no tiene autorizada.**
La primera vez para esa Y:
- La adenda sólo puede aprobarla la autoridad de aplicación, no la contraparte.
- Al aprobarla se registra una **excepción** en el historial del generador. Queda asentado quién la otorgó, cuándo, en qué manifiesto y adenda, y qué Y y cantidad.
- El generador ve la excepción en su historial y recibe un aviso que le explica que debe tramitar el alta de esa Y.
- La jefatura recibe un antecedente para evaluar si corresponde inspeccionar.

La segunda vez para la misma Y, sin alta ni inspección conforme desde la excepción anterior:
- No se puede otorgar otra excepción y la adenda no puede aprobarse.
- Sin adenda aprobada no se emite el certificado final.
- El generador tampoco puede crear manifiestos que declaren esa Y.
- La recepción física nunca se bloquea, porque el residuo ya existe y debe quedar registrado.
- La autoridad recibe una alerta CRÍTICA y la jefatura un antecedente prioritario, con acceso directo para agendar una inspección.

**Qué levanta el bloqueo.**
- **Alta de la Y en la ficha**, por edición de la autoridad o por renovación aprobada. Desde ese momento la Y es autorizada y deja de ser excepción. El historial conserva las excepciones anteriores.
- **Inspección cerrada conforme**: una inspección al generador, posterior a la excepción, que cierra en «Cerrada conforme». La autoridad puede otorgar entonces **una** excepción más para esa Y, no ilimitadas. A partir de ahí vuelve a correr el conteo.

## 2. Qué existe hoy y qué falta

| Pieza | Hoy | Brecha |
|---|---|---|
| Y autorizadas del generador | La migración guardó los datos de cada generador en su registro, pero **no copió sus corrientes Y**: `generador.corrientesControl` quedó vacío en los 1.224 importados (`scripts/import-generadores-excel.ts` no lo carga). Las Y migradas de 1.208 generadores quedaron en un archivo aparte, `backend/data/generadores-enrichment.json`, que sólo lee la pantalla de detalle cuando el registro está vacío (`frontend/src-v6/pages/admin/GeneradorDetallePage.tsx:220`). | Completar la migración: copiar esas Y al registro de cada generador para que la ficha sea la única fuente. |
| Comparación al recibir | `wasteDifferences` (`backend/src/domain/inspectionIntake.ts:10`) compara lo observado contra **el manifiesto**. `Y_OMITIDA` significa «no estaba en el manifiesto», no «no está autorizada». | Falta comparar contra las Y autorizadas del generador. Del lado del operador eso ya existe (`alcanceOperador`, `inspectionIntake.service.ts:33`): es el patrón a replicar. |
| Antecedentes por hallazgo | `recordFindingIntakes` (`inspectionIntake.service.ts:55`) abre un antecedente al generador por **cualquier** diferencia, incluida la cantidad. | Contradice el caso 1. Ver la decisión 6. |
| Aprobación de adenda con Y nueva | `reviewAddendum` (`manifiesto-adenda.controller.ts:155`) permite aprobar a la contraparte o a la autoridad. `noticeNewCurrents` (`postFactoNotice.service.ts:12`) avisa después y aclara que «no modifica habilitaciones». | Nadie otorga la excepción explícitamente, no hay registro por generador e Y, no hay conteo y no hay bloqueo. |
| Historial del generador | Hay eventos de manifiesto, de inspección y de empresa, pero ningún registro de excepciones por Y. | Falta un registro inmutable de excepciones y su vista en la ficha. |
| Alta de una Y | Edición de la ficha por la autoridad (`actor.controller.ts`) o renovación «con cambios» (`renovacionPolicy.ts:33`, campo `corrientesControl`). | Ya existe. Sólo hay que reconocerla como levantamiento del bloqueo. |
| Inspección conforme | El estado `CERRADA_CONFORME` existe en el flujo PSIP, pero nada reacciona a ese cierre. | Falta el enganche que habilite una excepción más. |
| Manifiesto nuevo con Y no autorizada | `createManifiesto` (`manifiesto.controller.ts:112`) no compara contra la ficha. | Falta el control al crear (ver la decisión 2). |
| Certificado final | Exige que toda corriente hallada esté tratada (`manifestCertificate.service.ts:30`). | Se mantiene. El bloqueo de la segunda vez actúa antes, en la aprobación de la adenda. |
| Contraste en inspección | El dato declarado del generador en la inspección usa sólo la ficha (`inspectionDeclaredSnapshot.service.ts:111`). | Con la ficha vacía, el inspector ve «sin corrientes declaradas». Debe usar la misma fuente unificada. |
| Capacitación y flags | Las adendas respetan `MANIFEST_ADDENDA_ENABLED` y `MANIFEST_PARTY_REVIEW_ENABLED`, y CAP usa datos aislados. | Las excepciones de capacitación no pueden contar para generadores reales. Conviene un flag propio para activar el bloqueo. |

## 3. Calidad de datos: el riesgo principal

Con la migración incompleta, **todas** las Y de los generadores importados parecerían «no autorizadas» y el sistema bloquearía a todos desde el segundo manifiesto. Para el negocio la ficha es una sola, así que la solución es completar la migración, no leer dos fuentes:

- **Completar la ficha**, una sola vez: copiar al registro de cada generador las Y del archivo migrado. Sólo se completan registros vacíos, nunca se pisa una ficha editada después. Cada cambio queda trazado y es reversible. Se prueba primero en preview y en producción se corre sólo con autorización expresa sobre ese cambio de datos. Así quedan cubiertos 1.208 generadores.
- Después, toda la plataforma (regla, pantalla, inspecciones y avisos) lee únicamente la ficha, y la pantalla deja de usar el archivo aparte.
- Los 16 generadores que no tienen Y en la migración **no se bloquean**. Cuando el operador registra un hallazgo en la recepción, se genera el antecedente «Ficha del generador sin corrientes» para que la autoridad complete la ficha, igual que hoy con `SIN_DATOS_VERIFICABLES` del operador. Al crear un manifiesto con la ficha vacía no se genera aviso.
- Antes de activar el bloqueo en producción hace falta una consulta de sólo lectura que cuente cuántos generadores reales quedarían alcanzados. Requiere tu autorización.

## 4. Implementación propuesta, por etapas

Cada etapa lleva pruebas unitarias, prueba en preview con cuentas artificiales y documentación. El bloqueo se activa al final, con su propio flag.

1. **Completar la migración de la ficha**: copiar las Y migradas al registro de cada generador. Desde ahí, una sola lista de Y autorizadas para la regla, la pantalla del generador y el contraste de la inspección.
2. **Registro de excepciones** inmutable por generador e Y: origen, autoridad, fecha, cantidad, estado (otorgada o levantada por alta o por inspección conforme). Reintento seguro con el mismo identificador.
3. **Clasificación del hallazgo** al registrar la adenda: diferencia sobre Y autorizada, Y no autorizada en primera vez o Y no autorizada repetida.
4. **Aprobación de la adenda**: si hay una Y no autorizada, sólo aprueba la autoridad y se registra la excepción. Si es repetida, se rechaza con un motivo explicado y se indica cómo levantar el bloqueo.
5. **Levantamiento**: el alta de la Y por edición o renovación y la inspección cerrada conforme quedan registradas en el historial.
6. **Manifiesto nuevo**: control de Y no autorizadas según la decisión 2.
7. **Avisos y alertas** con los canales actuales (campana, push con prioridad y correo opcional), sin canal nuevo. Primera excepción: ALTA. Segunda vez: CRÍTICA para la autoridad. Generador: aviso de tramitar el alta.
8. **Pantallas**: historial de excepciones en la ficha del generador, motivo visible en la adenda y en la creación del manifiesto, y antecedente con la Y y el conteo.
9. **Documentación**: manual de ayuda, flujo de adendas y PSIP.

## 5. Decisiones tomadas el 7/11 y regla resultante

| Decisión | Elegido |
|---|---|
| Qué es la «segunda vez» | **Cualquier Y no autorizada**, aunque sea distinta de la primera. |
| Inspección cerrada conforme | **No levanta nada.** Sólo el alta de la Y en la ficha. |
| Y no autorizada declarada al crear el manifiesto | **Mismo control** que al recibir. |
| Diferencia sólo de cantidad | **Se mantiene el antecedente** actual para la jefatura. |

**Regla resultante, que reemplaza a la del punto 1 donde difieran:**

- Cada generador tiene **una sola excepción disponible**. Una excepción queda *abierta* desde que la autoridad la otorga hasta que la Y exceptuada se da de alta en la ficha.
- Con una excepción abierta, **cualquier** Y no autorizada, sea la misma u otra, queda bloqueada. Al recibir, la adenda no puede aprobarse y por lo tanto no hay certificado final. Al crear, el generador no puede generar el manifiesto. La recepción física nunca se bloquea.
- Cuando todas las excepciones del generador quedaron cerradas por alta, puede recibir una nueva excepción.
- Si la autoridad no da el alta, la excepción queda abierta indefinidamente y el generador no puede volver a mover ninguna Y no autorizada.
- Una inspección conforme no cambia el estado de las excepciones. Queda en el historial como antecedente.
- La primera vez, la Y no autorizada requiere la **aprobación de la autoridad de aplicación**, tanto en la adenda como en el manifiesto declarado desde el inicio. En el manifiesto es una aprobación adicional a las de las partes. La contraparte no puede otorgar una excepción.
- Las diferencias de cantidad siguen abriendo antecedente, como hoy, sin registrar excepción.

**Valores por defecto aplicados, salvo indicación en contrario:**
- La fuente de Y autorizadas es la ficha de inscripción, una vez completada la migración de corrientes.
- El conteo rige desde la activación: las adendas anteriores se muestran pero no cuentan.
- El alcance es por generador inscripto (CUIT y actividad de generador).

## 6. Decisiones originales (referencia)

La opción recomendada va primera en cada decisión.

1. **Qué cuenta como «segunda vez».** (a) La misma Y otra vez. (b) Cualquier Y no autorizada, aunque sea otra.
2. **Inspección cerrada conforme.** (a) Habilita una excepción más para esa Y. (b) Habilita la Y hasta que la autoridad decida. (c) No levanta nada: sólo el alta en la ficha levanta el bloqueo.
3. **Y no autorizada declarada desde el inicio del manifiesto.** (a) Se trata igual que al recibir: la primera vez la autoridad la aprueba y queda como excepción; la segunda vez el generador no puede crear el manifiesto. (b) No se controla al crear, sólo al recibir.
4. **Diferencia sólo de cantidad.** (a) Corrige el manifiesto y no abre antecedente. (b) Mantener el antecedente actual para evaluación.
5. **Fuente de Y autorizadas.** (a) La ficha y, si está vacía, el padrón de inscripción. (b) Sólo la ficha. Con (b) se bloquearía a casi todos los generadores.
6. **Desde cuándo cuenta.** (a) Desde la activación: las adendas anteriores se muestran en el historial pero no cuentan. (b) Retroactivo: podría bloquear generadores el primer día.
7. **Alcance del conteo.** (a) Por generador inscripto, es decir por CUIT y actividad de generador. (b) Por establecimiento.

## 7. Implementación, pruebas y requisitos para publicar

### Qué quedó implementado

| Pieza | Dónde |
|---|---|
| Ficha única de Y autorizadas y regla de una excepción abierta | `backend/src/domain/generatorCurrents.ts` |
| Registro inmutable de excepciones | modelo `ExcepcionCorrienteGenerador`, migración aditiva `20261107120000_generator_current_exceptions` |
| Completar la migración de corrientes | `backend/src/scripts/backfillGeneratorCurrents.ts` (dry-run por defecto, `--apply`, `--revert`, sólo conteos) |
| Servicio: evaluación con bloqueo de fila, otorgamiento idempotente, cierre por alta, avisos | `backend/src/services/generatorCurrentException.service.ts` |
| Adenda: clasificación al registrar; aprobación sólo por la autoridad la primera vez; bloqueo con excepción abierta | `controllers/manifiesto-adenda.controller.ts` |
| Antecedente con motivos `Y_NO_INSCRIPTA_GENERADOR`, `Y_NO_INSCRIPTA_REITERADA`, `FICHA_GENERADOR_SIN_CORRIENTES` | `services/inspectionIntake.service.ts` |
| Manifiesto: no se crea con excepción abierta; la autoridad otorga antes de cualquier aprobación de parte | `controllers/manifiesto.controller.ts`, `controllers/manifest-proposal.controller.ts` |
| Cierre por alta en la ficha (edición o renovación aprobada) | `controllers/actor.controller.ts`, `controllers/renovacion.controller.ts` |
| Endpoints | `GET/POST /api/manifiestos/:id/excepcion-corriente`, `GET /api/actores/generadores/:id/excepciones-corriente` |
| Pantallas | panel en el manifiesto (`GeneratorCurrentExceptionPanel`), historial en la ficha del generador, pestaña Residuos (`GeneratorCurrentExceptionHistory`), etiquetas de antecedentes |
| Manual de ayuda | Adendas → «Corriente que no figura en la ficha del generador» |

**Detalles de comportamiento:**
- Una excepción puede abarcar varias Y del mismo hecho. Queda abierta mientras alguna de ellas siga fuera de la ficha, y esa condición se evalúa en vivo, así que una ficha editada por cualquier vía se respeta.
- La misma Y en el mismo manifiesto ya exceptuado es el mismo hecho, no una segunda vez. Una Y nueva en ese manifiesto sí cuenta como segunda vez.
- Observar o rechazar una adenda nunca se bloquea. La recepción física nunca se bloquea.
- Si una contraparte intenta aprobar una adenda que requiere la autoridad, recibe 409 con el motivo. La pantalla de adendas muestra ese mensaje y libera el intento, así puede observar o rechazar. Verificado por lectura de código (`AdendasManifiestoPage`), no en el navegador.
- El historial del generador no consulta la tabla nueva con el interruptor apagado, por si la migración todavía no se aplicó.
- Los generadores sin corrientes en la ficha no se bloquean. Generan el antecedente `FICHA_GENERADOR_SIN_CORRIENTES` sólo con un hallazgo del operador en la recepción; al crear un manifiesto no se genera aviso.
- Los avisos van **sólo a la campana**: ALTA para la excepción otorgada o cerrada, URGENTE para la reiteración y la creación rechazada. No se envían correos ni push, y las listas de salida existentes no se tocaron. Agregar correo o push es una decisión aparte.
- Las sesiones de capacitación (CAP) nunca cuentan ni bloquean.
- **Fuera de alcance:** los eventuales (`baja-intensidad`) no aplican esta regla hasta que se decida. El lado del operador (Y no habilitada en su ficha) sigue como estaba.
- El generador ve la regla en el manifiesto y en sus avisos. El historial completo está en la ficha del generador para administración y fiscalización; la API también se lo entrega a la propia cuenta del generador.

### Pruebas ejecutadas (preview aislado, sin red, cuentas artificiales)

- **Suites completas** (un worker, 1 CPU, 2 GiB, sin red):
  - backend: 208 de 208 archivos; tras el último ajuste (409 para la contraparte e historial apagado) pasaron otra vez las 38 suites relacionadas;
  - frontend: 360 de 360 archivos. Uno falló primero porque la copia del laboratorio no tenía `frontend/cloud-qa`; tras sincronizarla pasó.

- **Unitarias backend:**
  - dominio: 13;
  - servicio: 9;
  - aprobación de adenda: 6;
  - antecedente: 4;
  - cierre por renovación aprobada e historial con el interruptor apagado: 4;
  - suites existentes de adendas, propuestas, manifiestos, renovaciones, actores e inspecciones: sin cambios con el interruptor apagado.
- **Frontend:**
  - tipado limpio;
  - panel, historial y etiquetas: 6 pruebas nuevas;
  - manual: 41 de 41.
- **E2E por API** (`exc-e2e.mjs`):
  - Y inscripta: aprueban las tres partes;
  - Y no inscripta: las partes no pueden aprobar, el generador y la contraparte no pueden otorgar, la autoridad otorga y el reintento es idempotente;
  - con la excepción abierta, ni otra Y ni la misma pueden crearse, y la autoridad recibe una alerta URGENTE;
  - la adenda con otra Y queda bloqueada incluso para la autoridad, pero observarla sigue permitido;
  - el alta en la ficha cierra la excepción;
  - la contraparte no puede aprobar la rectificación y la autoridad sí, lo que otorga la nueva excepción;
  - historial visible para el generador, oculto para otro actor;
  - 0 avisos con correo y 0 correos enviados.
- **Completado de ficha:** completa, no repite, deja auditoría y revierte sobre generadores artificiales.
- **Visual en web (1365×900) y app (393×852):**
  - panel del generador sin botón de otorgar;
  - panel de la autoridad con motivo y botón de 44 px;
  - excepción otorgada;
  - historial en la ficha;
  - 0 errores de página.

### Requisitos antes de publicar

1. **Migración**: el publicador sólo acepta migraciones listadas en `.github/workflows/hostinger-publication.yml`. Hay que autorizar expresamente `20261107120000_generator_current_exceptions` (aditiva). Esta rama no modifica esa configuración productiva.
2. **Autoridad de aplicación** (decidido el 7/11): el administrador general y los administradores sectoriales de generadores, transportes y operadores, activos y en su propia sesión. La designación es por rol (`MANIFEST_REVIEW_AUTHORITY_BY_ROLE=true`, ya activo en producción). Todos reciben las alertas. En la aprobación de adendas se mantiene, sin cambios, la política vigente de quién revisa adendas.
3. **Completar la ficha en producción** con `backfillGeneratorCurrents` (primero dry-run para ver los conteos, después `--apply`), con autorización expresa sobre ese cambio de datos. Hasta entonces la pantalla sigue mostrando las Y del archivo migrado; no hay que retirar ese respaldo antes del completado.
4. **Activar** `GENERATOR_Y_EXCEPTIONS_ENABLED=true` recién después del punto 3. Apagado, el sistema se comporta exactamente como antes.
5. **Consulta previa de sólo lectura** que cuente cuántos generadores reales tienen ficha vacía y cuántos manifiestos abiertos declaran Y fuera de la ficha, para anticipar el impacto del primer día.
