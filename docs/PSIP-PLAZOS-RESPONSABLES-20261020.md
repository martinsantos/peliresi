# PSIP — plazos, vencimientos y quién debe actuar

Revisión terminada en el preview el 20/10/2026. Producto **`25b0c30c860cc91091591ad51b9b2ab9dc72a0cf`**, con `[skip ci]`, en `codex/sitrep-training-20261018`. **Publicado después**, con autorización explícita, en backend/web/app/manual el **20/10 a las 12:57:42 Mendoza**: [despliegue, controles y rollback actual](DESPLIEGUE-PSIP-PLAZOS-20261020.md). La revisión funcional descrita abajo se realizó antes de publicar, sin producción, cambios en `main` ni datos reales. CAP cerrado, correos/push apagados.

## Resultado para el usuario

El listado de la autoridad y Mis inspecciones muestran la misma indicación de responsable. En el expediente se distingue cada requerimiento pendiente, su propia fecha y la acción de responder. El vencimiento pendiente más antiguo aparece primero; los pedidos sin fecha permanecen visibles sin atribuirles una fecha ajena.

| Situación comprobada | Qué muestra el seguimiento |
| --- | --- |
| Notificada, sin requerimiento formal | Autoridad: publicar requerimiento |
| Uno o varios pedidos sin respuesta vinculada | Inspeccionado: cantidad por responder, cantidad vencida y próximo pedido |
| Sólo algunos pedidos respondidos, aunque el expediente esté En descargo | Inspeccionado: los otros pedidos continúan pendientes |
| Todos los pedidos respondidos | Autoridad: revisar presentación; desaparece la advertencia activa de falta de respuesta |
| Cerrada o derivada | Intercambio concluido; plazo histórico, sin acciones de respuesta |

Leer una campana o abrir el expediente no contesta un requerimiento. La respuesta tardía se admite y conserva su marca; no acepta una subsanación, cierra la inspección ni decide una derivación. Se conservan los estados, permisos y transiciones existentes.

## Problemas corregidos

1. La marca fuera de plazo se calculaba con la fecha general más reciente del expediente. Ahora sigue el antecedente inmutable de la respuesta hasta su requerimiento y usa esa fecha. Un pedido nuevo no prorroga otro. Sin fecha en ese pedido, no se presume vencimiento. El instante exacto del plazo aún está en término; después de él, la presentación es tardía.
2. Un reintento idempotente de un requerimiento ya incorporado podía rechazarse si su fecha había vencido durante el reintento. Se reconoce primero la presentación existente, después de validar acceso y tipo. Un requerimiento nuevo con fecha pasada sigue rechazado; no se duplican actuaciones ni avisos.
3. El plazo general provocaba avisos visuales de vencimiento aun cuando ya se había respondido al pedido. El resumen compartido se calcula sobre los requerimientos reales y sus respuestas vinculadas; los listados sólo reciben su proyección de seguimiento, sin cuerpos ni adjuntos. El contador de inspecciones con plazo abierto también considera pedidos sin respuesta, bajo los filtros y permisos existentes.
4. La zona horaria del dispositivo podía cambiar la hora que se mostraba o enviaba. Los plazos indican **hora de Mendoza**. El formulario interpreta expresamente esa hora y la convierte a UTC; la prueba real usó un navegador en UTC y comprobó que 16:30 Mendoza se guardara como 19:30Z.
5. La captura móvil descubrió que una fila flexible aplastaba el título del requerimiento por el ancho del botón. Se corrigió con una grilla adaptable: título completo arriba, estado y botón debajo en móvil. El botón visible dice Responder y su nombre accesible identifica el pedido. Se añadieron comprobaciones de ancho y palabras completas, y se repitieron ambos builds y toda la tanda de navegador.

No se reescribieron fechas, marcas tardías, hashes ni actuaciones históricas. El cambio de cálculo se aplica a presentaciones nuevas; no recalifica registros anteriores. No se fijan días hábiles, plazos legales, prórrogas ni sanciones automáticas.

## Avisos por requerimientos sin respuesta

Se probó el catálogo existente en la base artificial, con una regla propia y temporal de QA. La simulación no escribió; la ejecución comprobó el requerimiento concreto, su fecha, los destinatarios y la ausencia de respuesta. Se repitió la evaluación sin duplicar casos/avisos ni resetear su lectura.

Antes del recorrido hubo **18 casos / 234 avisos**. Después, **21 casos / 273 avisos**: nueve faltas de respuesta resueltas y doce pendientes, incluidos los tres vencimientos de frontera. Los destinatarios coinciden exactamente con el inspeccionado vinculado, el inspector asignado y las administraciones globales activas de esa base artificial. No son cifras de producción.

Los nueve casos de falta de respuesta resueltos conservaron su inspección **En descargo** y la constancia de que esa resolución no certifica subsanación. Los avisos históricos leídos permanecieron. Se preservaron las fechas y hashes de los **57 requerimientos iniciales**; la cola de correo mantuvo su cantidad. La regla propia quedó desactivada al terminar.

No se activaron reglas productivas ni se modificó la frecuencia del catálogo: conserva su evaluación programada existente a las 08:05 Mendoza o evaluación manual autorizada. La pantalla refleja la respuesta vinculada al actualizar la consulta; la resolución persistida del caso del catálogo ocurre al reevaluarlo. Los avisos inmediatos por actuación continúan siendo el [circuito de campana ya publicado](PSIP-AVISOS-INTERNOS-20261020.md).

## Validación final

Todo lo pesado se ejecutó serialmente en `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, con **un worker, 1 CPU, 2 GiB y swap cero**. Base exclusivamente artificial `sitrep_night_qa_20260926`; cuentas QA existentes, sin crear usuarios ni reactivar accesos CAP.

| Comprobación final | Resultado |
| --- | --- |
| Backend dirigido: seguimiento, listado, intercambio, integridad, catálogo y bloqueo de correo; 7 archivos | **177/177**, sin omitidas |
| Frontend dirigido: listado/servicio, plazos, responsable y panel; 4 archivos | **47/47**, sin omitidas |
| Navegador: generador, transporte y operador más frontera temporal | **12/12**, cero fallos, reintentos, inestables u omitidas |
| Manual: contenido, enlaces y copia empaquetada | **20/20** |
| Manual en navegador, guía PSIP y capacitación previa | **6/6** |
| TypeScript backend/frontend, builds web/app y lint crítico | **PASS** |
| Auditoría PostgreSQL de destinatarios, fuentes conservadas e idempotencia | **PASS** |
| Configuración real de los procesos, recursos y correspondencia de fuentes | **PASS** |

Los doce recorridos se distribuyen en escritorio 1440×900, web móvil 360×800 y `/app` 360×800, todos con navegador en UTC. Cubren plazos propios opuestos al general, varias respuestas parciales, pedido sin fecha, falta de requerimiento formal, cierre histórico, enlaces desde avisos, lectura sin respuesta, autoridad/inspeccionado y restricción del inspector. La prueba de reloj comprueba el instante exacto y el paso a vencido sin cambiar el reloj del servidor ni el estado de la inspección. Las capturas finales comprueban lectura sin aplastamiento y ausencia de desbordamiento horizontal; la captura final app se inspeccionó visualmente.

Se verificaron **2.207 blobs** locales y remotos contra el manifiesto de fuentes final y **810 blobs de producto/manual** contra lo compilado. El manual empaquetado coincide por bytes con las fuentes verificadas. La validación del backend compilado corresponde a las mismas fuentes; la última reconstrucción sólo cambió la presentación frontend. `memory.events` final: `max=0`, `oom=0`, `oom_kill=0`.

Esta aceptación es dirigida a PSIP; no se repitieron las suites globales ni se certificaron teléfonos Android físicos, sensores, segundo plano, entrega externa o cómputo normativo. Se usó Playwright remoto porque Browser plugin no estaba disponible. El service worker se bloquea deliberadamente en estos recorridos: se registran y excluyen sólo sus tres avisos exactos de bloqueo/registro indefinido en loopback; cualquier otro aviso/error de consola o excepción de página hace fallar la prueba. Esto no certifica instalación PWA ni funcionamiento offline.

## Manual, evidencia y cierre

Manual **2026.20.14**: misma guía PSIP de siete pasos, diseño, renderer, CSS y capturas anteriores conservados. El texto incorpora plazo por pedido, Mendoza, ausencia de fecha y responsable después de respuestas parciales. Los enlaces de la guía previa de capacitación siguen pasando sus comprobaciones. La validación inicial no publicó; el despliegue posterior autorizado incluyó ese manual. Las nuevas capturas de auditoría permanecen en la evidencia privada.

Evidencia privada local: `test-results-psip-deadlines-20261020/remote-evidence/`, manifiestos de fuente y `container-closed.json`; remota: `/work/sitrep/.qa-psip-deadlines-20261020/` dentro del contenedor preservado. Incluye reportes JSON, logs, pruebas de recorrido y PNG originales por rol/superficie. El historial remoto conserva `attempt-1` a `attempt-4`: ajustes del arnés para el bloqueo de SW y la instalación del reloj, más la pasada funcional que reveló el problema visual real. Esa pasada no se cuenta como aceptación visual. La primera prueba de regresión del cálculo de fecha falló antes del arreglo; sus resultados se conservan. La extracción local inicialmente intentó Python, ausente en el contenedor; se completó con Node/tar sin repetir las pruebas.

Los dos procesos QA y PostgreSQL cerraron limpiamente a las **12:41:59 Mendoza** (`15:41:59Z`), sin terminaciones forzadas. Contenedor detenido a las **12:44:08 Mendoza** (`15:44:08Z`): `Running=false`, `Pid=0`, salida 143 por SIGTERM, `OOMKilled=false`. Imagen, datos artificiales, intentos y artefactos preservados; no se abrió un túnel nuevo. CAP cerrado, `DISABLE_EMAILS=true`, push false, SMTP/VAPID vacíos y flags anteriores conservados en ambos procesos.

`main` permanece **`c8402190edfc36b5e5d0dee1337c24bd1689420d`**. Commits locales con `[skip ci]`, sin push ni workflows. Este cierre documental no altera las fuentes compiladas.

La publicación posterior fue autorizada expresamente y compiló backend + web + app + manual desde `25b0c30c`, con API final, SW raíz v132 y app 20261020155342. Smoke no mutante **78/78**, externo **9/9** y controles PWA PASS. Sin migraciones ni flags nuevos; no se desplegaron los bundles QA `/api` de loopback. `.env`, CAP cerrado, canales apagados y `main` conservados; [rollback actual a `527d915c`](DESPLIEGUE-PSIP-PLAZOS-20261020.md), preparado sin ejecutar. El contenedor volvió a detenerse a las 12:59:11 Mendoza, con imagen y artefactos preservados.
