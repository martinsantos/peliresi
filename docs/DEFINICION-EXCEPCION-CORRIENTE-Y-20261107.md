# Excepción por corriente Y no autorizada del generador · definición y análisis

Estado: **propuesta para decisión**, sin código. Rama `claude/excepcion-corriente-generador-20261107`, creada sobre `1cbd582c`.

## 1. La regla, en una página

**Qué cuenta como corriente autorizada del generador.** Es cada Y que figura en la ficha del generador. Si la ficha no tiene corrientes cargadas, se toma la inscripción del padrón (ver punto 3). Es la misma lista que hoy muestra la pantalla del generador.

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
| Y autorizadas del generador | La ficha `generador.corrientesControl` es texto libre y está **vacía en los 1.224 generadores importados**. Las Y reales de 1.208 generadores están en `backend/data/generadores-enrichment.json` (padrón de inscripción), que sólo usa la pantalla de detalle (`frontend/src-v6/pages/admin/GeneradorDetallePage.tsx:220`). | No hay una fuente única del lado del servidor. Hay que unificar «ficha y, si está vacía, padrón» en una sola función. |
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

Si la regla mirara sólo la ficha, **todas** las Y de todos los generadores importados serían «no autorizadas» y el sistema bloquearía a todos desde el segundo manifiesto. Por eso:

- La fuente es la ficha si tiene corrientes y, si no, el padrón de inscripción. Así quedan cubiertos 1.208 generadores.
- Los 16 generadores sin Y en ninguna de las dos fuentes **no se bloquean**. Generan un antecedente «ficha sin corrientes verificables» para que la autoridad complete la ficha, igual que hoy hace el operador con `SIN_DATOS_VERIFICABLES`.
- Antes de activar el bloqueo en producción hace falta una consulta de sólo lectura que cuente cuántos generadores reales quedarían alcanzados. Requiere tu autorización.

## 4. Implementación propuesta, por etapas

Cada etapa lleva pruebas unitarias, prueba en preview con cuentas artificiales y documentación. El bloqueo se activa al final, con su propio flag.

1. **Fuente única de Y autorizadas** del lado del servidor (ficha y, si está vacía, padrón), con la misma lista en la pantalla del generador y en el contraste de la inspección.
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
- La fuente de Y autorizadas es la ficha y, si está vacía, el padrón de inscripción.
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
