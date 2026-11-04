# Inspecciones — formulario de campo a 344 px y diagnóstico de confusión · 03/11/2026

Estado: **preview con datos artificiales. No publicado, sin merge a main, sin workflows.**
Continúa [el registro de P0 y mapa](INSPECCION-P0-PRESENTACIONES-CORREOS-20261103.md).

Pedido del usuario: simplificar el formulario de inspección para teléfonos de 344 px sin perder funciones («sin saltos sobre saltos, subtítulos, botones extra, funcionalidades superfluas»), y observar el resto del SITREP con el mismo criterio: «en qué fallamos, por qué es tan innecesariamente confuso».

## Qué se midió (344 × 760, app, caso artificial en campo, parte superior de cada paso)

Métricas en [measurements-344.json](evidence/inspection-simplify-344-20261103/measurements-344.json): borde superior del primer campo editable, fin de la cabecera (pestañas y título), alto de la barra de guardado, cantidad de botones y de párrafos visibles por paso.

| Paso | Primer campo editable | Fin de cabecera | Barra inferior | Alto del paso | Botones | Párrafos |
|---|---|---|---|---|---|---|
| Visita | 536 → **445** | 401 → **309** | 132 → **81** | 2972 → 2681 | 16 → 14 | 11 → 10 |
| Constatar · hechos | 576 → **500** | 401 → **325** | 132 → **81** | 1191 → 1191 | 9 → 9 | 2 → 2 |
| Constatar · controles | 1054 → — (ver nota) | 401 → **325** | 132 → **81** | 2767 → 2409 | 19 → 18 | 19 → 18 |
| Evidencias | — | 401 → **325** | 132 → **81** | 216 → 216 | 3 → 3 | 1 → 1 |
| Finalizar | — | 401 → **325** | 84 → **81** | 637 → 566 | 4 → 4 | 84 → 83 |

Antes → después en píxeles, sobre `b0eaa71b` y `102775f1`. Nota: en Controles ya no hay campo editable al abrir, porque un control pendiente muestra sólo sus tres respuestas; la observación aparece al elegir una. Capturas antes/después en [capturas/](evidence/inspection-simplify-344-20261103/capturas/).

Lo que no cambió: la barra de la app (65 px) y la fila volver/descargas, número, estado y establecimiento (≈180 px) son del marco general, no del formulario; están en el diagnóstico de abajo.

## Qué cambió en el formulario (commits `9349f055`, `5044d0a6`, `102775f1`, `3db8edc1`)

Nada se eliminó del modelo de datos ni de las reglas; sólo se reubicó, se acortó o se mostró a demanda.

**Reubicado**
- «Asignación y programación» (inspector asignado, fecha prevista, inicio de campo) dejó de ocupar el paso 1 y vive en «Expediente y seguimiento».
- «Copias de versiones anteriores» (recuperación en el dispositivo) dejó de ser una barra al pie de cada paso; vive en «Expediente y seguimiento», sin su propio desplegable dentro del desplegable.

**Acortado**
- Rótulo «Paso N de 4» y título en un solo bloque compacto (en Visita entran en una línea; en los demás pasos el título ocupa dos); la frase explicativa sólo en pantallas anchas. Las pestañas ya dicen dónde se está.
- Barra de guardado: en teléfonos, una línea fina de estado («Sin guardar» / «Guardado» / «Guardando…») y debajo una sola fila con «Guardar» como ícono y el botón principal «Guardar y continuar» a todo el ancho. Se probó primero con el estado al lado de los botones (61 px) pero el texto se partía; la versión final mide 81 px. En pantallas anchas todo va en una fila con los textos completos.
- Nota del mapa: una línea que conserva el límite legal («no delimita el predio ni define por sí solo una restricción ambiental») y el aviso de funcionamiento sin conexión.
- Finalizar: el aviso «cierra el trabajo de campo; no aprueba ni notifica» aparece una vez, en el bloque de cambio de etapa, en lugar de dos.

**Quitado (texto defensivo sin acción asociada)**
- «Registrar el contacto no envía correos ni concede acceso al expediente.»
- «Máximo 25 MB. La foto quedará vinculada a este control.» (el límite sigue vigente y se informa si falla la carga).
- «Voz a texto · en este dispositivo.»

**A demanda**
- En cada control del recorrido, observación, dictado y fotos aparecen recién cuando se eligió Cumple / No cumple / No aplica. Un control pendiente muestra sólo sus tres respuestas. Si ya tenía observación o fotos, se muestran siempre.

**Etiquetas**
- La tarea del acta dice «Sin registrar» o «Con registro» en vez de «Registro de campo».

## Regresión propia detectada y corregida

Al mover «Copias de versiones anteriores» a «Expediente y seguimiento», esa tarea quedó sin barra de guardado (la barra sólo acompaña a los pasos editables). Quien revisaba una copia quedaba en una pantalla sin «Guardar», aunque el texto del panel lo mencionaba. Corregido en `3db8edc1`: al revisar un texto se vuelve al paso Hechos (acta) y al recuperar un archivo, a Evidencias, donde está la barra; el texto del panel lo dice. «Asignación y programación» tiene su propio botón de confirmación y no depende de la barra.

## Lo que se dejó deliberadamente sin tocar (decisión de diseño pendiente)

**Constatar sigue siendo la parte confusa.** Tres acordeones apilados con tres vocabularios distintos (hechos / controles / comparar con lo declarado), y dentro de «Controles» once tarjetas, cada una con sus respuestas, observación, dictado, fotos y dos enlaces de navegación (índice / siguiente pendiente). Aplanarlo es una decisión de producto, no una limpieza. Dos opciones concretas:

1. **Una sola lista con cabeceras fijas por grupo:** hechos arriba (un cuadro de texto), después los controles en una lista continua agrupada (Residuos, Seguridad, Trazabilidad, Habilitación, Documentación) y al final el contraste con lo declarado. Sin acordeones; el desplazamiento es el recorrido.
2. **Mantener los tres acordeones**, pero con un solo vocabulario («Qué observaste», «Controles», «Lo declarado») y abriendo el siguiente al cerrar el anterior.

Recomiendo la opción 1 para campo. Requiere rehacer el componente de controles y sus pruebas; no se hizo en esta tanda.

## Pruebas

- Tipos frontend y backend aprobados. Suites del arnés: frontend 108, backend 363.
- **Fallas preexistentes, no causadas por este cambio y no corregidas:** `InspectionInlineSave.test.tsx` (3) e `InspectionWorkspace.keyboard.test.tsx` (2) ya fallaban sobre `b0eaa71b` (comprobado ejecutándolas contra el código previo). Esperan un botón «Guardar y salir de la inspección» y una barra `sticky` que el código actual no tiene. No forman parte del arnés del laboratorio (`qa-p0.mjs`) y siguen deliberadamente excluidas de él, por eso no aparecieron antes; la decisión de actualizarlas o retirarlas es del usuario.
- `InspectionRestart.test.tsx`: se ajustó una consulta para buscar el enlace «Copias de versiones anteriores» por rol, porque ahora el título de la tarea repite ese texto.

## Diagnóstico: por qué el SITREP resulta confuso

Lo observado en el preview con la cuenta artificial de inspector en tres pantallas: el formulario a 344 px, y el Inicio y la lista de Inspecciones leídos como texto (sus capturas `diagnostico-*.jpg` son de un ancho mayor, ~800 px; el apilamiento de elementos que se describe no depende del ancho).

**Síntomas**
- **Cuatro capas de cabecera antes del contenido.** Barra de la app (título, rol, ayuda, campana), fila de volver/descargas, número y estado, pestañas, y encima «Paso N de 4», título y explicación. En el formulario, 536 px de 760 antes del primer campo.
- **Dos maneras de guardar y dos textos de estado** en la misma barra («Copia en este dispositivo» y «Solo en este dispositivo · falta guardar en servidor»). El inspector no debería tener que entender el modelo de sincronización para saber si puede cerrar el teléfono.
- **Vocabulario triple para lo mismo** dentro de Constatar, y rótulos distintos web/app para el mismo paso («Revisar y firmar» / «Finalizar»).
- **La lista de Inspecciones apila cinco puertas de entrada** en la misma pantalla: «Administración de inspectores» plegado, botones «Hallazgo» y «Nueva», un cartel «Apertura confirmada… Continuar apertura», tres pestañas (Expedientes, Agenda, Antecedentes) y tarjetas con «Retomá en… Continuar inspección». Todas compiten; ninguna manda.
- **Inicio muestra al inspector un «Resumen de manifiestos» con cuatro ceros.** No tiene manifiestos. La pantalla es la del administrador general con otro nombre.
- **Texto defensivo como sustituto de diseño.** Cada función llegó con su advertencia («no envía correos», «no equivale a firma digital», «no delimita el predio», «no aprueba ni notifica», «máximo 25 MB»). Varias son necesarias por su valor legal; muchas sólo protegen el registro y le hablan al auditor, no a la persona que está en un galpón con el sol en la pantalla.

**Causas**
1. **Cada tanda sumó su propia capa.** Recuperación de borradores, copias antiguas, intercambios, firma, enlace limitado, mapa: cada una trajo su panel, su barra, su cartel y su frase. Nadie fue dueño de la pantalla completa; sólo de su función.
2. **Se diseñó para el expediente, no para la visita.** Los nombres salen del flujo administrativo (expediente, apertura, antecedente, intercambio, constancia) y no de lo que hace el inspector (llegar, mirar, anotar, sacar fotos, hacer firmar).
3. **El teléfono se trató como una computadora angosta.** Las mismas cabeceras, descripciones y acciones secundarias, comprimidas, en lugar de decidir qué se ve primero a 344 px.
4. **Las pantallas por rol reutilizan la del administrador.** El Inicio del inspector hereda métricas que no le corresponden.

**Qué haría a continuación, por orden**
1. Constatar en una sola lista (decisión de arriba).
2. Un Inicio por rol: para el inspector, «Hoy» con sus visitas y nada de manifiestos.
3. Lista de Inspecciones con una sola acción principal y las demás en un menú; «Continuar apertura» integrado a la tarjeta de ese expediente.
4. Un rótulo único por paso en web y app.
5. Revisión del texto defensivo pantalla por pantalla: conservar lo que tiene valor legal (en una línea), quitar lo demás y llevarlo al manual.

Ninguno de estos puntos se tocó en esta tanda: el código cambiado es sólo del formulario de inspección.

## Laboratorio

Las copias locales de `rebuild-all.sh` y `backend-cycle.sh` (en `../lab/`) apuntaban todavía al contenedor anterior; al resubirlas detuvieron la API una vez sin compilar. Ya apuntan a `sitrep-inspection-20261103`. `rebuild-all.sh` ahora aborta si cualquier etapa (backend, web o app) termina con código distinto de cero y muestra el error del log, en lugar de reiniciar la API y el relay con un build viejo. Se agregó después de que un error de sintaxis pasó inadvertido en una compilación.
