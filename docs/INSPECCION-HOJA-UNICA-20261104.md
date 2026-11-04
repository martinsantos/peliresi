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
3. **Controles** — lista plana; la observación y la foto aparecen al marcar No cumple o al tocar «Agregar observación o foto»; nada se cierra solo. Debajo, la comparación con lo declarado (si hay inspeccionado identificado) y los requerimientos con plazo.
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

Commits: `81f23f5f` (hoja única, mapa, pruebas), `71b91d13` (aviso del mapa y título duplicado).

## Mediciones en el preview

Script: [measure-344.mjs](evidence/inspection-hoja-unica-20261104/measure-344.mjs) (Playwright con el Chromium propio de la Mac contra el túnel; la cuenta y la contraseña van por variables de entorno). Caso artificial GRP-2026-00001 (`cmw1372qv000kl0b983xbgc40`, En campo), cuenta `inspector01`. Resultados en [measurements.json](evidence/inspection-hoja-unica-20261104/measurements.json); capturas en [capturas/](evidence/inspection-hoja-unica-20261104/capturas/).

| Métrica | Antes (03/11, 344 px) | Ahora, app 344 × 760 | Ahora, web 1365 × 900 |
|---|---|---|---|
| Pestañas de pasos | 4 | 0 | 0 |
| Tarjetas «Expediente y seguimiento» | 5 | 0 (un enlace «Expediente completo») | 0 |
| Acordeones en el formulario | 3 en Constatar + 1 por control | 0 en controles · 9 dentro de «Contraste con lo declarado» (grupos y «Ver detalle») | 9, los mismos |
| Botones Guardar / Continuar | 2 (barra de 81 px) | 0 | 0 |
| Botones de etapa visibles | 1 | 1 («Enviar a revisión», al pie) | 1 |
| Mapa: borde superior | paso 1, bajo el mapa 536 px el primer campo | 420 px (primera pantalla), cruz fija y «Marcar el punto aquí» | 431 px |
| Al marcar «No cumple» en un control: desplazamiento de la página | saltaba | 0 px (scroll 4499 → 4499), y 0 px al volver a «Cumple» | — |
| Alto total de la hoja | — | 10 416 px (unas 14 pantallas) | 9 131 px |

Nota sobre la medición: una primera versión del script elegía «la primera tarjeta que cumple» por resultado, y al responder cambiaba de tarjeta; eso dio un falso salto de 574 px y dejó cuatro controles artificiales modificados (GEN-01, GEN-02, SEG-01 y GEN-03). Se corrigió el script (tarjeta fijada por id) y se restauraron los cuatro por la API de ítems; HAB-02 quedó en «No cumple» porque ya lo estaba. Sólo datos artificiales.

Capturas: `hoja-344-arriba.jpg` (bloque 1 con el mapa y la cruz), `hoja-344-controles.jpg` (lista plana), `hoja-344-control-respondido.jpg` (hallazgo abierto debajo del control, sin mover la página), `hoja-344-pie.jpg` (estado de guardado, pendientes y el único botón), `hoja-web-1365.jpg` (escritorio, con la barra lateral de administración que no se tocó).

## Límites y pendientes

- La barra lateral de administración en la web de escritorio no se tocó: pertenece al trabajo de Inicio y lista por rol de la sesión paralela.
- La comparación con lo declarado conserva sus grupos desplegables dentro del bloque Controles; ya no escribe el scroll de la página, pero sigue siendo un acordeón por grupo. Próximo paso si molesta en campo.
- Los dos archivos de prueba que ya fallaban antes (`InspectionInlineSave.test.tsx`, «Guardar y salir de la inspección»; `InspectionWorkspace.keyboard.test.tsx`, barra fija) ahora contradicen el diseño aprobado. Siguen fuera del arnés. Decisión pendiente: actualizarlos o retirarlos.
- Android físico sigue pendiente de dispositivo; el bloqueo táctil del mapa se probó con emulación táctil de Chromium, no con un teléfono.
