# Inspecciones — formulario de campo en una sola pantalla · 04/11/2026

Rehecho tras la prueba del usuario sobre el preview del 04/11: «es un completo desastre… no está orientado a humanos». Lo que se conservó: el mapa con punto, sector y referencias; la lista plana de controles con Cumple / No cumple / No aplica; la recuperación de presentaciones sin enviar y los correos renderizados. Todo lo demás del formulario se rehizo.

Sólo preview privado (http://127.0.0.1:4188, túnel en esta Mac) con datos artificiales. Producción, main y workflows intactos.

## Qué falló en la versión anterior y por qué

| Síntoma que vio el usuario | Causa en el código |
|---|---|
| «Abrís un acordeón, te tira hasta abajo, te vuelve arriba» | Tres mecanismos de desplazamiento automático apilados: `scrollIntoView` al llegar a cada tarea, restauración del scroll al cambiar el ancho de la ventana y un pase diferido de 400 ms para controles enlazados. Cada uno corregía al anterior. |
| «Expediente y seguimiento abre una nueva pantalla» | Cada tarjeta era un paso más del mismo asistente: cambiaba el contenido, el título y la barra inferior. Informe técnico, historial, QR, copias y asignación no son trabajo de campo. |
| «Es imposible marcar una zona, se te van los puntos» | Cada toque sobre el mapa era a la vez un vértice y un arrastre del mapa. En pantalla táctil no puede funcionar. |
| Pasos, pestañas, Continuar, Guardar cambios | Estructura heredada del asistente anterior, conservada para «no perder funcionalidad». Se conservó la forma, no la función. |

## Qué es ahora

Una sola página, un solo scroll, en el orden de la visita. Nada se desplaza solo. Componentes: `InspectionFieldSheet.tsx` (la hoja), `InspectionLocationMap.tsx` (mapa con cruz fija), y en `InspeccionExpedientePage.tsx` el modo `sheet` con autoguardado y la lista plana de controles (`Checklist flat`).

1. **Dónde estoy y con quién** — mapa (punto por GPS o con la cruz), dirección, motivo, persona que atiende, correo para el acta, número de acta.
2. **Qué encontré** — texto con dictado, fotos y archivos ahí mismo, actividad y entorno observados.
3. **Controles** — lista plana; la observación y la foto aparecen al marcar No cumple o al tocar «Agregar observación o foto»; nada se cierra solo. Debajo, la comparación con lo declarado (si hay inspeccionado identificado) también como lista plana: todos los grupos abiertos, el detalle de cada dato aparece por su contenido (difiere, no verificado, valor o hallazgo anotado) o al tocar «Anotar lo encontrado», sin «Ocultar detalle» ni «Siguiente pendiente». Al final, los requerimientos con plazo.
4. **Declaración y firma** — constancias del acta (desplegable), lectura y firma, copia para el inspeccionado.
5. **Un solo botón** — «Iniciar visita» antes de empezar (arriba, al llegar) o «Enviar a revisión» al final, con la lista de pendientes encima. Nunca los dos.

Guardado: automático 1,5 s después del último cambio, en silencio. Una línea «Guardado 12:03» al pie; «Guardando…» mientras tanto; sin conexión, «guardado en este dispositivo». Si el servidor rechaza un guardado, se muestra el error y no se reintenta hasta el próximo cambio o hasta que vuelva la conexión. Al salir con el botón Volver se envía lo que falte.

El expediente completo (informe técnico, historial, verificación QR, copias de versiones anteriores, asignación) queda a un enlace: «Expediente completo» en la cabecera abre la vista anterior con `?vista=expediente`; desde allí «Formulario de campo» vuelve. Fuera de los estados de campo (en revisión, notificada, cerrada) la página no cambia.

### Mapa con cruz fija

- El dedo no coloca nada. Se arrastra el mapa hasta que la cruz del centro queda sobre el lugar y se toca un botón: «Marcar el punto aquí», «Agregar vértice aquí» o «Agregar referencia aquí». Mientras se mueve la cruz se lee «La cruz está a 120 m del punto».
- En un teléfono el mapa empieza bloqueado: la página se desplaza por encima de él y al tocarlo se activa el arrastre; un desplazamiento de la página lo vuelve a bloquear. En escritorio no hay bloqueo.
- La vista para el acta se prepara sola 2,5 s después de que el trazado se queda quieto; desapareció el botón «Guardar vista para el acta» y los avisos amarillos. Sólo un fallo pide un toque («Reintentar»).
- Sector: «Deshacer» y «Borrar sector»; con tres vértices o más se cierra solo. Referencias numeradas con tipo, descripción y distancia, como antes.

## Pruebas

Laboratorio remoto (contenedor `sitrep-inspection-20261103`, 1 CPU, 2 GiB, sin swap, suites en serie, un worker):

- Tipos del frontend (`tsc -p tsconfig.app.json --noEmit`): sin errores.
- Arnés del frontend (`qa-p0.mjs`, 12 archivos): 109/109 en verde, incluidos los reescritos: `InspectionLocationMap.test.tsx` (cruz fija, vértice a vértice, bloqueo táctil, modo lectura), `InspeccionExpedientePage.critical.test.tsx` (autoguardado sin botón ni pestañas, rechazo del servidor sin reintento en bucle, lista plana sin acordeones, un solo botón de etapa, expediente completo a un enlace) e `InspectionRestart.test.tsx` (inicio de visita y autoguardado con propiedad real del borrador).
- Backend sin cambios en este paso; su arnés no se volvió a correr.
- Compilación completa del preview (`rebuild-all.sh`): backend, web y app con código 0, pico de memoria 1,44 GB.

Commits: `81f23f5f` (hoja única, mapa, pruebas), `71b91d13` (aviso del mapa y título duplicado), `56c89bf1` (contraste con lo declarado como lista plana, Volver espera el guardado, entrada de reanudación «Formulario de campo»; `InspectionComparisonPanel.test.tsx` suma el caso plano: 47/47 en los tres archivos de página).

## Mediciones en el preview

Script: [measure-344.mjs](evidence/inspection-hoja-unica-20261104/measure-344.mjs) (Playwright con el Chromium propio de la Mac contra el túnel; la cuenta y la contraseña van por variables de entorno). Caso artificial GRP-2026-00001 (`cmw1372qv000kl0b983xbgc40`, En campo), cuenta `inspector01`. Resultados en [measurements.json](evidence/inspection-hoja-unica-20261104/measurements.json); capturas en [capturas/](evidence/inspection-hoja-unica-20261104/capturas/).

| Métrica | Antes (03/11, 344 px) | Ahora, app 344 × 760 | Ahora, web 1365 × 900 |
|---|---|---|---|
| Pestañas de pasos | 4 | 0 | 0 |
| Tarjetas «Expediente y seguimiento» | 5 | 0 (un enlace «Expediente completo») | 0 |
| Acordeones en el formulario | 3 en Constatar + 1 por control + grupos del contraste | 0 (queda sólo el botón del índice «Ir a un dato declarado», que abre una lista de búsqueda) | 0 |
| Botones Guardar / Continuar | 2 (barra de 81 px) | 0 | 0 |
| Botones de etapa visibles | 1 | 1 («Enviar a revisión», al pie) | 1 |
| Mapa: borde superior | paso 1, bajo el mapa 536 px el primer campo | 420 px (primera pantalla), cruz fija y «Marcar el punto aquí» | 431 px |
| Al marcar «No cumple» en un control: desplazamiento de la página | saltaba | 0 px (scroll 4499 → 4499), y 0 px al volver a «Cumple» | — |
| Alto total de la hoja | — | 12 999 px (unas 17 pantallas; el contraste con lo declarado ya no esconde filas en grupos cerrados) | 11 468 px |
| Mapa en el teléfono: bloqueo táctil | — | arranca bloqueado (`touch-action: pan-y`, aviso visible) · un toque lo activa (`leaflet-touch-drag`) · un scroll de la página lo vuelve a bloquear | sin bloqueo |

Nota sobre la medición: una primera versión del script elegía «la primera tarjeta que cumple» por resultado, y al responder cambiaba de tarjeta; eso dio un falso salto de 574 px y dejó cuatro controles artificiales modificados (GEN-01, GEN-02, SEG-01 y GEN-03). Se corrigió el script (tarjeta fijada por id) y se restauraron los cuatro por la API de ítems; HAB-02 quedó en «No cumple» porque ya lo estaba. Sólo datos artificiales.

Capturas: `hoja-344-arriba.jpg` (bloque 1 con el mapa y la cruz), `hoja-344-controles.jpg` (lista plana), `hoja-344-control-respondido.jpg` (hallazgo abierto debajo del control, sin mover la página), `hoja-344-pie.jpg` (estado de guardado, pendientes y el único botón), `hoja-web-1365.jpg` (escritorio, con la barra lateral de administración que no se tocó).

## Segunda vuelta · 04/11, tarde (commits `347988ad`, `54473795`)

Prueba del usuario sobre la primera hoja: el mapa seguía siendo impracticable («el punto puede ser una zona», «marco un vértice y tengo que bajar a describirlo»), no había una referencia fija de dónde está uno, los campos no se distinguían de la página y «al final agrega 15 campos más, todos obligatorios».

Inventario previo: unas 60 entradas visibles en el caso GRP. Sólo los 11 controles y los 6 datos del contraste son obligatorios para enviar a revisión; seis constancias (daños, testigos, firma, copia, libro, comunicación) las exige después la aprobación.

Qué cambió:

- **Mapa «Estoy acá».** Un botón toma el GPS y marca el punto; con eso alcanza. Si no hay señal, la cruz y «Marcar el punto aquí». Debajo, «¿El predio es más grande que un punto?» con radios de 50 m a 1 km u otro valor: el punto crece a un círculo (`radioMetros`, guardado también como polígono de 24 vértices para que el acta y el PDF sigan igual; el PDF lo resume como «radio de X m»). Las referencias se marcan con la cruz y su tipo y descripción aparecen pegados al mapa, no al final. Desaparecieron los modos Punto/Sector/Referencias y el trazado por vértices; un trazado anterior se muestra hasta que se lo reemplaza o se lo quita.
- **Barra fija.** Una línea pegada arriba dice el bloque bajo el dedo («3 · Controles · 3 de 4») y al tocarla lista los cuatro para saltar. Sólo lee la posición; nunca escribe el scroll.
- **Recorte de campos.** Bloque 1: mapa, número de acta, quién atiende (nombre, cargo) y motivo; DNI, correo, pedido de copia, dirección e inspector plegados en «Más datos». Bloque 2: texto con dictado y fotos; actividad, instalaciones y entorno plegados en «Más detalle del lugar». Bloque 3: controles, contraste y requerimientos (tres campos cada uno; responsable y cómputo por defecto). Bloque 4 «Cerrar la visita»: las seis constancias como preguntas de un toque (`InspectionClosingQuestions.tsx`) que abren un detalle sólo si la respuesta lo pide; el resto de los datos administrativos del acta plegado y sin repetir esas seis. La dirección declarada y el domicilio legal se completan solos una vez.
- **Contraste visual.** Campos con borde oscuro y fondo blanco, etiquetas en negrita, tarjetas de bloque sobre la página (`index.css`, `.inspection-field-sheet`). Tarjetas de control sin la etiqueta «Revisado · Cumple», redundante con el botón marcado.

Pruebas en el laboratorio: tipos de frontend y backend limpios; backend 16/16 (modelo, geometría, mapa, PDF del acta); frontend 58/58 en mapa, preguntas de cierre, expediente, reinicio, panel de documentos y contraste.

Mediciones (`measurements.json`, capturas `hoja-344-*.jpg`, `hoja-web-1365.jpg`), caso GRP-2026-00001:

| Métrica | Mañana | Tarde, app 344 | Tarde, web 1365 |
|---|---|---|---|
| Entradas visibles sin abrir desplegables | ~60 | 20 (incluye los detalles ya cargados en el caso) | 20 |
| Acordeones | 0 | 0 (sólo los dos índices de búsqueda) | 0 |
| Barra fija de bloque | no | sí | sí |
| Radio del predio | no | 6 opciones + otro | igual |
| Al marcar «No cumple» | 0 px | 0 px | — |
| Bloqueo táctil del mapa | verificado | verificado | — |
| Alto total | 12 999 px | 14 451 px: Estoy acá 2 948 (el caso tiene 5 referencias y un trazado anterior), Qué encontré 1 254, Controles 7 901, Cerrar 1 660 | 12 398 px |

El alto no bajó: lo que domina es el bloque Controles (11 controles y 6 datos del contraste con su detalle abierto), que es el trabajo de campo en sí; las preguntas de cierre y las referencias inline agregan lo que los desplegables ahorran.

## Límites y pendientes

- La barra lateral de administración en la web de escritorio no se tocó: pertenece al trabajo de Inicio y lista por rol de la sesión paralela.
- Los enlaces de la lista de pendientes («1 controles obligatorios pendientes») llevan al comienzo del bloque, no a la tarjeta pendiente; con 11 controles el inspector la busca. Próximo paso: que el enlace apunte a la primera tarjeta pendiente.
- El alto de la hoja (unas 19 pantallas a 344 px) sigue siendo el de la lista de controles y el contraste. Si en campo pesa, el próximo paso es una tarjeta de control de una sola línea (título y tres botones) y el contraste con el valor declarado plegado.
- Las descripciones de foto se deshabilitan mientras se guarda el borrador (cada 1,5 s tras un cambio); escribir allí durante un guardado puede perder teclas. Baja frecuencia; pendiente.
- Cada vértice nuevo dispara, 2,5 s después, la descarga de unas 12 teselas y la preparación de la imagen del acta, más el guardado automático. En campo con señal débil conviene observarlo.
- Los dos archivos de prueba que ya fallaban antes (`InspectionInlineSave.test.tsx`, «Guardar y salir de la inspección»; `InspectionWorkspace.keyboard.test.tsx`, barra fija) ahora contradicen el diseño aprobado. Siguen fuera del arnés. Decisión pendiente: actualizarlos o retirarlos.
- Android físico sigue pendiente de dispositivo; el bloqueo táctil del mapa se probó con emulación táctil de Chromium, no con un teléfono.


## Corrección urgente: guardado visible (04/11/2026)

La hoja de campo ocultaba Guardar y dependía sólo del autoguardado, mientras la firma pedía guardar. Se restaura una acción explícita en la barra de sección, visible al desplazarse en web y app. Reutiliza la misma operación y bloqueo de concurrencia: un doble toque no duplica el envío. Confirma Guardado sólo tras la respuesta del servidor y permite reintentar un fallo sin editar de nuevo.

El bloqueo de firma ahora distingue cambios sin confirmar, capturas pendientes, conflicto de versiones, organización pendiente y modo consulta. Cuando el texto ya está guardado y queda una captura, lo indica y ofrece volver a las evidencias. No se descartan archivos ni se omite su validación.

Las pruebas de regresión cubren ambas rutas, doble clic, confirmación del servidor, reintento tras fallo y evidencia pendiente. El criterio anterior «sin botón Guardar» queda reemplazado por esta corrección; el autoguardado se conserva.
