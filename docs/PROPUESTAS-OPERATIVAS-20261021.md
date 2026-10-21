# Propuestas ordinarias de manifiestos — revisión 21/10/2026

Estado: circuito implementado y validado, sólo preview. No publicado. CAP cerrado y servicios de QA detenidos.

## Alcance autorizado

Creación por Generador, Transportista u Operador fuera de CAP, con decisión explícita de los tres. Web y app. Checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`, base documental `edb36dc4` / producto `13af2fb0`. No producción, main, datos reales, envío de correos/push ni workflows.

Habilitación propia `MANIFEST_PROPOSALS_ENABLED` / `VITE_MANIFEST_PROPOSALS_ENABLED`, false por defecto y true sólo en este preview. Independiente de la revisión posterior de eventuales/adendas. CAP permanece cerrado. Sin migraciones.

## Contrato

- Sólo propuestas ordinarias FIJO: tres actores registrados y activos, con fecha prevista y recursos de la transportista seleccionada. La empresa de quien crea queda fija en su rol.
- Creación → Pendiente aprobación, incluso para quien crea. Generador firma; transporte y operador deciden desde sus cuentas propias. Administración consulta/crea, pero no sustituye aprobaciones. Las sesiones de suplantación no deciden por una parte.
- Unanimidad → Aprobado. Cualquiera de las partes puede iniciar coordinación; sólo el retiro físico inicia el viaje. La preparación no cuenta como traslado ni GPS.
- Propuesta y actores originales inmutables. Rechazo motivado bloquea el avance; cancelación conserva el historial. No se puede editar, borrar o revertir para saltarse el acuerdo. Estas guardas siguen vigentes con el flag apagado.
- Reintentos y decisiones simultáneas se serializan en PostgreSQL. Aprobaciones, estado y avisos se confirman juntos; cada decisión conserva autor/fecha/firma/huella. El inicio operativo usa un evento propio, no un evento CAP.
- Los históricos sin marcador conservan su contrato. In situ mantiene el recorrido previo de generador/operador; no se inventa una aprobación de transporte.
- Mi agenda y las aprobaciones se actualizan entre sesiones. El filtro En espera distingue la decisión propia ya registrada; la campana conserva cada evento y enlaza el mismo manifiesto.

## Incidencias encontradas

1. El inicio por otra parte no cambiaba el estado APROBADO: el panel se actualizaba, pero la acción de retiro seguía dependiendo del refresco periódico del detalle antiguo. Corregido invalidando el detalle por los eventos de aprobación/inicio, no sólo por cambio de estado. Se agrega prueba unitaria de cambio sin transición de estado y E2E entre sesiones sin recarga manual. El primer intento E2E además agotó su espera por usar «Confirmar Retiro» en lugar del rótulo «Confirmar retiro» de la vista del chofer; se corrigió el selector exacto, sin modificar expectativas ni tiempos.
2. El QR de CAP contenía sólo el ID: el validador ordinario también exige el número. El QR operativo usa ID, número y fecha, como el recorrido normal.
3. La lógica CAP no mantenía las huellas del recorrido operativo. Se comparte el algoritmo existente de integridad y se conserva el sello de origen al completar las aprobaciones.
4. La agenda nueva reemplazaba la cola móvil del chofer y podía ocultar su viaje guardado durante una desconexión. Se conserva la cola de viajes en curso y su recuperación sin conexión; los retiros pendientes quedan en la agenda con su estado real de aprobación/coordinación. Prueba de regresión con dos viajes y con el último viaje guardado.

## Validación

Runner serial, un worker, 1 CPU, 2 GiB y swap cero. Esquema propio `proposal_operations_20261021` en PostgreSQL local al contenedor de QA; los esquemas anteriores se comparan por conteo y huella de todas sus filas. Ninguna consulta productiva.

| Comprobación | Resultado |
| --- | --- |
| Backend completo, antes de los últimos ajustes QR/actor activo/agenda histórica | 1.438/1.438 |
| Frontend completo, antes de los últimos ajustes de etiqueta in situ y continuidad móvil | 1.790/1.790 |
| Backend dirigido sobre el producto final | 33/33 |
| Frontend/manual dirigido sobre el producto final | 65/65 |
| Continuidad móvil del chofer, incluida desconexión | 6/6 |
| Integración HTTP final, sesiones normales fuera de CAP | 8/8 grupos |
| Función apagada y ausencia de atajos sobre propuestas persistidas | 1/1 grupo HTTP |
| E2E web escritorio, web responsive y app: tres creadores + manual por superficie | 12/12 casos únicos; v3 12/12 y repetición final v4 móvil/app 8/8 |
| Tipos backend/frontend y builds web/app v4 | PASS |
| ESLint en 14 archivos de interfaz | 0 errores; 59 advertencias de los archivos revisados, sin proclamar lint global limpio |

Las suites completas y las dirigidas se informan por separado; no sumar casos solapados ni afirmar una nueva suite completa sobre los últimos ajustes. La integración usa PostgreSQL y autenticación reales del preview, con usuarios artificiales normales. Ejercita concurrencia dentro de la prueba; el runner sigue siendo único. No se mockean identidad, API ni decisiones en los E2E.

Intentos conservados: el primer E2E falló por el rótulo exacto del botón de retiro; la repetición v3 pasó 12/12. Un intento intermedio fue cancelado antes del navegador al quedar reemplazado por las fuentes nuevas. El primer intento de continuidad v4 usaba el selector del inicio exclusivo de `/app` también en web responsive; falló antes de crear un manifiesto y se corrigió para comprobar el botón real de viajes en web y la cola en app. No se relajaron las esperas, las aprobaciones ni las comprobaciones de avance.

Manual 2026.21.1; renderer y CSS existentes conservados. Nuevo tutorial `manifiestos-tres-partes`, visible para los tres actores y administración; la guía antigua identifica su alcance de borrador/in situ.

Capturas originales revisadas: aprobación unánime en web escritorio y web a 360 px, agenda En espera en app a 390 px y navegación del manual. Sin errores de página ni desborde horizontal en los casos probados. Browser plugin not available: se utilizó el harness Playwright existente, ejecutado sólo en el preview. El navegador bloquea fuentes/teselas externas y service workers para aislar las pruebas, pero utiliza formularios, sesiones y API reales de QA. Las pruebas de escritorio v3 mantienen el mismo producto que v4 salvo el módulo de inicio exclusivo móvil; las superficies afectadas se repitieron completas después del ajuste.

## Auditoría y cierre

- **4/4 auditorías**: configuración efectiva de los dos procesos, cuatro alias CAP rechazados con 403, contenido/elegibilidad de avisos y correo simulado, histórico original intacto. **354 avisos de siete fases** renderizados para simulación, cero correos encolados, intentos o envíos. SMTP/VAPID vacíos, push false, base CAP sin conexión y plazo vencido. No se usaron credenciales ni APIs productivas.
- **295 tablas anteriores de QA** conservan conteos y huellas. Sólo el esquema artificial propio recibió las pruebas. Prisma, migraciones, dependencias y workflows no cambian.
- Build v4 sobre **2.322 archivos fuente**; **1.236 archivos de producto/manual/Prisma** comparados por SHA-256 con el checkout al cierre. El ajuste posterior del selector E2E no cambia el producto compilado; su hash ejecutado se registra separado. El control de commit quitó una única línea vacía extra al final de `manifestIntegrity.service.ts`, sin cambiar ningún otro byte; ambas huellas se conservan en la evidencia.
- Runtime y PostgreSQL cerrados; contenedor propio detenido **21/10/2026 08:11:50 Mendoza**, `Running=false`, `Pid=0`, `OOMKilled=false`. `memory.events max=3532` registra presión dentro del límite; `oom/oom_kill=0`. Base artificial, imagen y evidencia conservadas.
- Evidencia compacta y hashes: [validation.json](propuestas-operativas-20261021/validation.json). Capturas sin editar: [web](propuestas-operativas-20261021/unanimous-web.png), [web móvil](propuestas-operativas-20261021/unanimous-web-mobile.png), [agenda app](propuestas-operativas-20261021/waiting-app.png), [manual](propuestas-operativas-20261021/manual-web.png). Informes completos y trazas, incluidos intentos fallidos, en `.qa-proposals-20261021` del preview y respaldo local ignorado `test-results-proposals-20261021`.
- Rama `codex/sitrep-training-20261018`; `main` permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Commit con `[skip ci]`, sin push ni workflows. Producción no se inspeccionó ni se modificó; su última publicación documentada sigue `13af2fb0`.

## Límites y entrega

No se publica ni se habilita nada en producción. Una publicación necesita autorización, compilación con API final y versiones SW propias. Bundles `/api` de QA no son artefactos de release. Navegador responsive no certifica teléfonos físicos, GPS real, correo entregado ni push del sistema operativo. No se reabren accesos CAP.
