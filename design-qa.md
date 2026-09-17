# Design QA — Centro de Ayuda SITREP

Fecha: 2026-09-16
Alcance: implementación local de `docs/manual/`
Entornos externos modificados: ninguno

## Referencias visuales

- Portada: `outputs/help-center-design-qa/reference-home.png` — 1487 × 1058 px.
- Tutorial de escritorio: `outputs/help-center-design-qa/reference-tutorial-desktop.png` — 1487 × 1058 px.
- Tutorial móvil: `outputs/help-center-design-qa/reference-tutorial-mobile.png` — 853 × 1844 px.

## Evidencia de implementación

La implementación fue renderizada y capturada en el navegador integrado de Codex. Ese navegador no expone un archivo binario de la captura; las capturas completas quedaron mostradas en esta tarea y las páginas verificadas permanecen disponibles en:

- Portada: `http://localhost:4174/manual/`
- Tutorial: `http://localhost:4174/manual/tutorial.html?guide=transportista-confirmar-retiro`
- Búsqueda: `http://localhost:4174/manual/search.html?q=confirmar%20retiro`

Viewports verificados:

- Escritorio: 1440 × 1024 CSS px, escala 1.
- Móvil: 390 × 844 CSS px, escala 1.

## Comparación completa

- La portada conserva la jerarquía de la referencia: cabecera institucional, título de bienvenida, buscador dominante, perfiles en filas amplias y tareas frecuentes.
- El tutorial conserva la composición de tres zonas: índice persistente, lectura central aireada y navegación de continuidad.
- La versión móvil convierte el índice en un panel desplegable, mantiene el progreso visible y preserva la legibilidad de capturas de escritorio mediante desplazamiento horizontal y apertura a tamaño completo.
- La paleta, tipografía, radios, espaciado, sombras e iconografía mantienen la dirección visual aprobada y la identidad de SITREP.

## Comparaciones focalizadas

- Cabecera y búsqueda: alineación, contraste, escala tipográfica y foco de teclado revisados en ambos viewports.
- Perfiles y tarjetas: separación vertical, área táctil y estados hover/focus revisados.
- Índice del tutorial: estado activo, pasos completados, desplazamiento y URL con ancla revisados.
- Cuerpo del tutorial: título, instrucciones, llamada informativa y capturas reales revisados.
- Pie de continuidad: paso anterior/siguiente y contador actualizados con el scroll.
- Búsqueda: categorías, ranking, palabras múltiples, vista previa y estado sin resultados revisados.

## Hallazgos y correcciones

- P1 — El scroll-spy podía señalar el paso anterior cuando el siguiente ya ocupaba la línea de lectura. Corregido con cálculo por posición de scroll; verificado en el paso 2, ancla `#paso-2-revisar-el-manifiesto` y contador `2 de 5`.
- P2 — Abrir el índice móvil desplazaba el contenido. Corregido fijando el control y reservando su espacio; la posición permanece estable al abrir y cerrar.
- P2 — El escudo institucional podía recortarse en la cabecera. Corregido el ajuste de imagen y verificado en escritorio y móvil.
- P2 — La búsqueda aceptaba coincidencias parciales demasiado amplias. Corregida para exigir todas las palabras y ordenar por relevancia.

## Validaciones funcionales y de accesibilidad

- Navegación por perfil, tarjetas, búsqueda, tutorial, índice, anterior/siguiente y copia de enlace.
- Recorrido público completo sin token ni pantalla de inicio de sesión.
- Persistencia local del tutorial en curso y reanudación desde la portada.
- Anclas estables por paso y compatibilidad con enlaces históricos mediante redirección al manual legado.
- Manual legado: 183 anclas sin duplicados; navegación profunda verificada en `#faq`, `#fa-4`, `#glosario` y `#inst-paso11`, con destino estable a 108 px del encabezado.
- Las 296 apariciones de capturas del manual legado reservan sus dimensiones para evitar desplazamientos durante la carga diferida.
- Una sola cabecera `h1`, sin IDs duplicados, imágenes con texto alternativo y botones con nombre accesible.
- Foco visible, enlaces para saltar contenido y soporte de `prefers-reduced-motion`.
- Consola del navegador sin errores durante los recorridos probados.
- Sintaxis JavaScript, recursos locales, enlaces internos y formato del diff validados.

## Resultado

No quedan hallazgos accionables P0, P1 o P2 dentro del alcance implementado. La ampliación futura de tutoriales es una mejora de contenido P3; el manual técnico completo continúa disponible como legado.

final result: passed
