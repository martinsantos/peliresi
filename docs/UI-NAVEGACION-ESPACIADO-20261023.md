# Navegación y espaciado de Manifiestos e Inspecciones

**Actualización: publicado dentro de b891e288 el 23/10/2026 a las 21:30:00 Mendoza.** [Despliegue y smoke](DESPLIEGUE-NAVEGACION-20261023.md). La evaluación siguiente documenta la prueba previa.

23/10/2026. Corregido y probado en preview; no publicado.

## Problemas y correcciones

- En web, los controles comenzaban pegados al encabezado; en la app, el nuevo manifiesto agregaba margen sobre el del contenedor. Ahora hay un único margen superior de 16 px.
- Manifiestos repetía el título, forzaba Eventuales a otra fila y limitaba encabezado y tabla a un ancho distinto de los filtros. Se alinearon los bloques y se unificó la barra de acciones con Inspecciones.
- La creación se encontraba a lados diferentes según la sección. Ahora queda a la derecha y las acciones secundarias, a la izquierda, con controles principales de 44 px mínimo y ajuste de línea en anchos estrechos.
- El regreso del expediente era genérico y estaba después de la identidad. Ahora aparece arriba a la izquierda, con el nombre de la sección, como en Manifiestos. Se mantienen las guardas de dictado, pausa de trabajo de campo y guardado del borrador.
- El detalle del manifiesto anidaba un botón dentro de un enlace y no conservaba el prefijo móvil en regreso/edición. Ambos problemas están corregidos.
- El ancho cambiaba cuando aparecía el scroll. El contenedor reserva ese espacio para estabilizar los bordes.

Manual: guía **Moverse entre listados y expedientes**, versión de contenido **2026.23.7**.

## Verificación

- **178/178 unitarias dirigidas**: navegación, layouts, inspecciones, guardado de borradores, teclado, formularios, agenda, aprobaciones, avisos y manual.
- **21 E2E únicos aprobados**, cero omitidos o reintentos: seis de navegación/geometría y quince de regresión de agenda, aprobaciones y formularios para administración, generador, transportista y operador.
- Tras el último ajuste de scroll, se reconstruyeron web y app y se repitieron los **6/6 E2E de navegación/geometría**.
- Vistas de escritorio, web móvil y app/PWA: 320, 390, 1440 y 1920 px; expediente también a 320 × 568. Se verifica que Guardar permanece visible y no queda tapado; esta prueba geométrica no ejercita una nueva mutación de guardado.
- Tipos y compilaciones aprobados; lint dirigido: **0 errores, 62 advertencias**. Diff sin errores de espacios.
- En IAB, a 1440 px: ambos listados comienzan a 16 px del encabezado y comparten bordes x=288 y x=1397, independientemente del scroll.
- Runtime final atestado a las **20:57:22 Mendoza**: CAP cerrado, envío externo desactivado. Sólo datos artificiales en el esquema proposal_operations_20261021.

## Evidencias y límites

Evidencias en el workspace del hilo, carpeta layout-spacing-20261023: revision.md, source-files.json, first-pass.tgz, final-evidence.tgz, resultados JSON, capturas y live-geometry.json. Los recorridos de inspección crean exclusivamente expedientes sintéticos en preview.

Preview: http://127.0.0.1:4177, contenedor con 1 CPU/2 GiB/swap adicional cero, un worker. Sin producción, main, datos reales, migraciones, workflows, correo ni push.

No certifica toda la UI, todos los roles administrativos especializados, Android físico ni otros módulos. No cambia las reglas de aprobación ni convierte manifiestos históricos. La publicación vigente sigue en **bc0e103b**; esta tanda incluye como antecedentes locales las correcciones aún no publicadas de elegibilidad y claridad.
