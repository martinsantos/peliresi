# Agenda completa, certificados pendientes y continuidad de altas

**Actualización:** esta tanda se publicó dentro de `45c79bb9`; ver [cierre, activación de circuitos y reversión vigente](REACTIVACION-CIRCUITOS-20261022.md). Lo siguiente conserva la evidencia de su validación previa.

Revisión del 22/10/2026, exclusivamente en el preview aislado. No se accedió a producción; `main` permanece intacto. Base de trabajo: `b5a17b3e`, rama `codex/sitrep-training-20261018`, checkout activo `sitrep-production-source-20261001`.

## Resultado funcional

- **Agenda completa:** búsqueda, fechas, filtros y contadores calculados en el servidor; páginas de seis filas, sin el corte anterior de cien registros. Orden estable, nuevos primero y próximos por fecha prevista. Cada actor conserva su alcance y distingue su aprobación pendiente de la espera de otras partes.
- **Certificados pendientes:** los manifiestos tratados del circuito de emisión por el operador siguen en la agenda hasta liberar la certificación final. El operador ve «Emitir certificación final»; las otras partes, «Esperando certificado final». Un parcial no cancela el pendiente. Los manifiestos históricos que usan el certificado anterior no adquieren una obligación nueva.
- **Continuidad de altas administrativas:** generador, operador y transportista conservan datos, paso y adjuntos privados en SITREP; se recuperan con la misma cuenta desde otro navegador. Se diferencia el guardado local del confirmado por el servidor. Las contraseñas no se guardan. Las versiones concurrentes requieren recuperar explícitamente el borrador; no se sobrescriben silenciosamente.
- **Inscripción pública:** el borrador existente guarda automáticamente las ediciones sin exigir cambiar de paso y recuerda el paso en el servidor. «Probar» conserva su funcionamiento local. Guardar borrador no envía ni aprueba una solicitud, ni crea una ficha de actor.

Los permisos de aprobación, la firma del operador, los destinatarios, las cantidades certificadas y las reglas regulatorias no se cambiaron. CAP permanece cerrado y los canales externos apagados.

## Manual

Versión **2026.22.1**, con el renderer y CSS existentes. Guías «Agenda completa y certificados pendientes» y «Continuar un alta sin perder el trabajo». Incluyen parciales/finales, roles, paginación, recuperación, conflictos y adjuntos; la guía de propuestas también explica la agenda completa.

## Persistencia y operación futura

La migración aditiva `20261022130000_actor_form_drafts` crea únicamente dos tablas de borradores y adjuntos, sus índices y relaciones. Se prueba en un esquema artificial sobre el modelo anterior y se compara el resultado con Prisma. No se aplicó en producción.

Los adjuntos se guardan en **`${UPLOADS_DIR}-private-drafts`**, fuera del directorio servido públicamente; acceso autenticado por dueño y permisos, respuestas `no-store`, validación de PDF/JPG/PNG por contenido y verificación SHA-256 al recuperar. Límites: 10 MiB por archivo, 50 MiB por borrador, 100 adjuntos. Datos JSON: 256 KB. Recuperación durante 30 días desde el último guardado; el vencimiento impide acceso, no implica una purga física programada. Reemplazar o descartar elimina sólo los archivos propios correspondientes.

Una publicación futura requiere autorización, respaldo antes de migrar y conservar/resguardar también ese directorio privado. El proceso debe poder crearlo junto a `UPLOADS_DIR`. Los bundles de QA usan `/api` y no son artefactos de despliegue. No se cambió la versión del service worker en esta revisión.

Si se necesita revertir esa futura publicación, conservar las tablas y archivos privados para no perder borradores; volver la interfaz sólo oculta la recuperación. No restaurar una base anterior ni degradar las guardas de los certificados ya emitidos. La reversión productiva vigente sigue siendo la documentada en `DESPLIEGUE-CORREOS-20261022.md` hasta una nueva publicación autorizada.

## Evidencia y alcance

Incidencias encontradas y corregidas durante esta tanda:

- Corte de agenda en cien resultados y filtrado incompleto: consulta paginada y filtrada en servidor, incluyendo fechas de Mendoza y alcance por actor.
- El cierre ocultaba la certificación final pendiente: tarea conservada sólo para manifiestos que adoptaron el circuito de emisión por el operador; parcial y final diferenciados.
- Un reintento tras una respuesta perdida podía aceptar una revisión ya superada: se exige la revisión exacta también en reintentos de texto y archivos.
- Un archivo anterior con el mismo nombre no acredita que se haya guardado su reemplazo: selección pendiente diferenciada de bytes confirmados.
- La descarga tardía de un borrador podía recuperar sus datos en otro formulario al cambiar de actor: reproducido por prueba que falló antes de la corrección; operaciones vinculadas a la instancia del formulario.
- La inscripción pública reanuda el guardado automático tras terminar una carga o lectura de licencia; las ediciones durante la operación quedan conservadas.
- Dos expectativas de pruebas anteriores se actualizaron sin debilitar controles: versión exacta del contenido del manual y espera del checkpoint antes de observar una única creación ante doble clic.

| Comprobación | Resultado |
| --- | --- |
| Suite completa de backend | **1.473/1.473 PASS**; backend conservado después de esta ejecución. |
| Suite completa de frontend | **1.811/1.811 PASS**, posterior a todas las correcciones funcionales. |
| Regresión dirigida de recuperación, altas y manual | **110/110 PASS**, incluida en la suite completa; no sumar como casos distintos. |
| Compilación backend y tipos frontend | PASS. |
| Builds web y `/app` | PASS, seriales, API relativa exclusiva de QA; advertencia existente de chunks grandes, incluido Vosk. |
| Migración aditiva en esquema artificial | PASS; dos tablas, comparación Prisma sin diferencias. |
| Navegador | **32/32 PASS**, sin omitidos, fallos ni reintentos: 2 grupos API y 10 casos por superficie (escritorio, web angosta y app). **99 capturas E2E**. |
| Lint de los 21 archivos TypeScript modificados | **0 errores**, 47 advertencias conservadas en `final/lint.json`; no equivale a lint global sin advertencias. |
| Auditoría | **660 tablas QA previas intactas**; 0 intentos de correo, 0 cola activa; 4 alias CAP rechazados; canales apagados verificados en los 2 procesos. |

Evidencia local ignorada en `test-results-continuity-20261022/`; fuente reproducible en `frontend/cloud-qa/continuity-fixture.ts`, configuración Playwright y dos suites `continuity*.spec.ts`. El manifiesto de fuente valida por SHA-256 **1.733 archivos** de backend/frontend/manual. Los cierres y documentación de operación no forman parte de los bundles.

La primera ejecución completa de interfaz tuvo **1.807 PASS y 2 fallos de expectativas**; el informe se conserva en `frontend-all-first.json`. La regresión adicional reprodujo el fallo de respuesta tardía (**109/110**) en `frontend-regressions-before-scope-fix.json`, antes del arreglo y del PASS final. La pasada preliminar de navegador fue **29/29**, con **93 capturas**; no se confunde con el candidato final, que incorpora nuevas verificaciones de conflicto, paso recuperado y navegación de agenda.

Los 32 casos finales comprueban: 131 pendientes sin pérdidas ni duplicados en 22 páginas para G/T/O, búsqueda más allá de cien, fechas, aislamiento entre actores; botones y filtros reales de agenda; parcial/final firmados, avisos recibidos sin recargar y mismo SHA-256 del PDF para las partes; guardado/recuperación de datos, paso y archivos para las tres altas; contraseña ausente al recuperar; corte de conexión y conflicto explícito entre dispositivos; continuidad de las tres inscripciones públicas y navegación de las dos guías del manual. API de borradores verifica roles, privacidad, integridad, vencimiento, reintentos y versiones, sin crear actores.

Revisión visual directa de capturas finales de agenda y conflicto en escritorio y app, más recuperación en web angosta de la pasada preliminar. Los tres tamaños se comprueban contra desbordes horizontales; el error de conflicto es legible y mantiene los datos visibles. No se rediseñó el manual.

Los intentos iniciales de unitarios con flags heredados y el empaquetado inicial que omitía la migración están preservados en los logs; se corrigieron antes de las pasadas finales. La etiqueta de runtime `b5a17b3e-continuity` identifica esta ejecución de QA, no una publicación: la identidad efectiva del candidato se comprueba con el manifiesto SHA-256 de fuentes.

Runtime y PostgreSQL cerrados correctamente, sin terminación forzada. Contenedor detenido el **22/10/2026 a las 09:06:57 Mendoza**; imagen, base y evidencias conservadas. Límites efectivos: `cpu.max=100000 100000`, memoria `2147483648`, swap `0`. El cgroup registró reclamación al alcanzar el límite de memoria (`max=1118`), **sin OOM ni procesos terminados por falta de memoria**. No se aumentaron recursos.

Sólo datos artificiales, servidor `76.13.234.213`, contenedor gemelo `sitrep-qa-training-20261018`. Un proceso pesado por vez, un worker, 1 CPU, 2 GiB y sin swap. No Docker, builds ni suites pesadas en la Mac. Sin Actions, push, envíos de correo, push móvil ni cambios de flags productivos.

Las vistas angostas verifican adaptación y funciones en navegador. No certifican Android/iOS físicos, GPS de un teléfono ni entrega externa de correos/push. Esta tanda no pretende certificar todos los circuitos del producto ni reemplazar pruebas de campo.
