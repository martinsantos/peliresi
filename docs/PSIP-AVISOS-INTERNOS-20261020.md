# PSIP — avisos internos por actuación

Extensión de [PSIP: flujo de inspecciones](PSIP-FLUJO-INSPECCIONES-20261020.md), preparada y validada en `codex/sitrep-training-20261018`. **Publicada como `527d915c` el 20/10/2026 a las 11:01:45 Mendoza**, en backend, web, app y manual. [Publicación y rollback](DESPLIEGUE-PSIP-20261020.md). La validación descrita abajo se realizó antes de publicar y sólo en preview. Permisos, estados y plazos conservados; `main` intacto y CAP cerrado. El alcance autorizado es la campana; no se envía correo ni push a nadie.

**Revisión posterior de vencimientos publicada como `25b0c30c` el 20/10 a las 12:57:42 Mendoza:** [plazos y responsables PSIP](PSIP-PLAZOS-RESPONSABLES-20261020.md) y [publicación/rollback actual](DESPLIEGUE-PSIP-PLAZOS-20261020.md). El catálogo existente se probó sólo con una regla artificial temporal: destinatarios exactos, sin duplicados ni correos, lectura conservada y resolución de la falta de respuesta sin aceptar subsanación. No se activaron reglas productivas ni se cambió su frecuencia. El circuito por actuación descrito debajo fue publicado inicialmente como `527d915c` y se conserva en la nueva versión.

## Qué avisa y a quién

| Actuación del intercambio formal | Destinatarios con cuenta activa |
| --- | --- |
| Requerimiento de la autoridad | Inspeccionado vinculado al expediente |
| Respuesta o pronunciamiento de la autoridad | Inspeccionado vinculado al expediente |
| Respuesta, descargo o subsanación del inspeccionado | Inspector asignado y administradores globales/del sector competente |
| Decisión de cierre conforme o derivación a Legales | Inspeccionado vinculado al expediente |

Se excluye al autor, a cuentas inactivas, a otras entidades y a administradores de otros sectores. Un contacto libre o un tercero sin cuenta/vínculo no obtiene acceso ni un aviso por completar sus datos. Un administrador que además es inspector asignado recibe una sola copia.

Cada aviso identifica **PSIP, el número de expediente, la actuación y su tipo**, con texto controlado sobre qué consultar. El cuerpo de la presentación y sus adjuntos permanecen en el expediente. Los avisos guardan el identificador de la actuación para auditoría; no se generan avisos retroactivos para todo el historial.

## Recorrido en web y app

1. La autoridad publica el requerimiento. La contraparte lo ve en su campana y puede abrir directamente **Mis inspecciones → expediente**.
2. El inspeccionado responde sobre la actuación. El inspector asignado y la administración competente reciben un aviso que abre **Inspecciones → Comunicaciones**, conservando el contexto del expediente.
3. El intercambio continúa por el mismo canal, incluidas respuesta de la autoridad, pronunciamiento y nuevos pedidos de subsanación.
4. Al cerrar conforme o derivar, el inspeccionado recibe la decisión y puede leer su fundamento e historial. El intercambio cerrado no habilita respuestas nuevas.

La campana consulta cada **30 segundos con sesión activa**; al abrirla consulta de inmediato. También hay avisos dentro de la aplicación según su mecanismo de consulta existente. No se promete una alerta nativa con la aplicación cerrada. La bandeja usa la acción «Abrir expediente y ver el intercambio» para inspecciones, en lugar de «Abrir manifiesto».

Recibir o abrir un aviso PSIP invalida la copia consultada del expediente. Esto evita que una actuación nueva quede oculta por la caché, incluso si el usuario ya está en la misma URL. Abrir la campana marca el aviso leído al seleccionarlo; **leer no responde, no acepta ni resuelve el pedido**. La primera apertura del intercambio conserva su registro independiente.

## Persistencia y canales

`createInspectionExchangeNotices` inserta las notificaciones dentro de la misma transacción que la actuación, las evidencias, el cambio de versión/estado y el evento auditable. Si falla la persistencia del aviso, se revierte la transacción y el formulario conserva el borrador. Un envío rechazado no genera avisos; el reintento idempotente de una actuación ya incorporada no crea otra copia.

La función no invoca el distribuidor de canales externos ni el servicio push. Los avisos tienen `soloCampana: true` y tipo `intercambio_inspeccion`; el relay de correo rechaza cualquiera de esas dos marcas, tanto al evaluar el aviso como al revalidar una cola. La exclusión se conserva aunque en otra publicación se habiliten correos para otras familias. En este preview, además, `DISABLE_EMAILS=true`, SMTP/VAPID vacíos y push apagado.

Las reglas de vencimiento o de requerimiento sin respuesta continúan siendo otro circuito. No se activan ni se modifican en este trabajo. Un aviso disponible o leído no acredita notificación fehaciente ni cambia el cómputo del plazo.

## Validación y cierre

Pruebas dirigidas en el preview: backend **157/157**, frontend **79/79**; TypeScript, compilación web, compilación app y lint crítico aprobados. Aceptación final de navegador **9/9**, sin omitidas, reintentos ni resultados inestables: generador, transporte y operador en web de escritorio, web móvil y `/app`. Cada caso recorre requerimiento → respuesta → respuesta de autoridad → pronunciamiento → requerimiento → descargo → requerimiento → subsanación → decisión. Se prueban cierre conforme y derivación a Legales, llegada por consulta automática en ambas superficies principales, enlaces, lectura individual, reintento idempotente, conflicto de versión y rechazo a otro actor. No son suites globales ni una certificación de teléfonos físicos.

La auditoría posterior sobre PostgreSQL verifica **81 actuaciones y 432 avisos internos**, con el conjunto exacto de destinatarios por actuación, sin duplicados ni copias al autor. Verifica además el rollback real de una inserción de aviso y la exclusión de un actor inactivo, usando transacciones artificiales que se revierten. La cola de correo conserva su cantidad inicial: **cero correos encolados**. Manual **20/20** verificaciones y **6/6** recorridos en navegador, incluida la guía anterior de capacitación y su copia empaquetada en los builds QA.

La primera pasada funcional completó **9/9 recorridos**, **81 actuaciones y 432 avisos**, con destinatarios exactos y sin cambios en la cola de correo. La revisión de las capturas descubrió un recorte real: en web móvil, el panel anclado a la campana quedaba parcialmente fuera del borde izquierdo. El chequeo de ancho del documento no detectaba ese desplazamiento negativo. Se corrigió el anclaje móvil, conservando el aspecto del panel; ahora se comprueban sus cuatro bordes y el encabezado completo, y se repite el recorrido sobre builds nuevos. Esa primera pasada no se presenta como aceptación visual final.

Evidencia privada: `test-results-psip-notices-20261020/` local y `.qa-psip-notices-20261020/` remoto. La fuente base es `85b5f5d5`; las fuentes se transfieren desde el único checkout permitido y se verifican por identificador Git de cada archivo antes del build (**2.199 archivos** en el build final). Al terminar se comprueban nuevamente los **12 archivos de producto/manual modificados** contra ese registro, además de la configuración de los dos procesos reales QA. Las modificaciones documentales de cierre no cambian esos archivos compilados.

El preview usa la base artificial `sitrep_night_qa_20260926`, un worker, 1 CPU y 2 GiB, sin swap. `memory.events`: `max=0`, `oom=0`, `oom_kill=0`. CAP cerrado, SMTP/VAPID vacíos, correos/push apagados y flags conservados en ambos procesos. Servicios QA y PostgreSQL cerrados limpiamente; contenedor propio detenido el **20/10/2026 a las 10:40:25 Mendoza** (`13:40:25Z`), `OOMKilled=false`; salida 143 por el SIGTERM de cierre. Imagen, base artificial y evidencias preservadas.

Cierre de la validación previa con **`[skip ci]`**, sin push ni workflows. `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Durante esa validación no se accedió al servidor productivo ni a datos reales.

Manual **2026.20.13**, misma guía PSIP y mismo diseño. La publicación posterior fue autorizada expresamente y recompiló backend + web + app + manual desde `527d915c`, con la API del dominio final. Smoke no mutante **76/76**, externo **9/9** y PWA PASS, según el [registro de despliegue](DESPLIEGUE-PSIP-20261020.md). Sin migraciones ni flags nuevos; los bundles previos de QA con API `/api` de loopback no se desplegaron.
