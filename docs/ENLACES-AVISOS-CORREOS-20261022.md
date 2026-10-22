# Correos, avisos y destinos — revisión del 22/10/2026

**Verificado y cerrado en preview; no publicado.** Base `443cafe9`, rama `codex/sitrep-training-20261018`, único checkout autorizado `sitrep-production-source-20261001`. Sin producción, main ni datos reales; CAP cerrado, correos/push apagados. No se disparan workflows ni se envía correo a nadie.

## Contrato de navegación

- Cada correo tiene una acción principal dentro de `/app/` y una alternativa **Abrir en la web**, con el mismo registro, parámetros y ancla.
- El acceso conserva el destino después de iniciar sesión, también al recargar el formulario de login. No concede permisos, cambia de cuenta ni aprueba una acción.
- Las adendas se abren por ID. Una adenda antigua sigue accesible aunque existan más de veinte posteriores; **Ver todas las adendas** recupera el historial. Se comprueba el acceso al manifiesto antes de consultar el anexo.
- Las inscripciones conservan la actividad seleccionada. Un comprobante repetido de una inscripción abre esa inscripción, sin exigir al solicitante acceso a la campana operativa.
- Para comunicaciones sin expediente propio se incorpora una ficha privada de aviso. Un administrador tampoco puede leer avisos de otra cuenta. Abrir la ficha es de sólo lectura; no marca el aviso ni realiza una decisión de negocio. Si fue eliminado o pertenece a otra cuenta, se informa sin revelar su contenido.
- Los resúmenes conservan un enlace por aviso. Las notificaciones por rol conservan un destino individual por destinatario; los contratos push se corrigen sin activar el proveedor.
- Sólo se construyen enlaces locales del origen configurado. Se rechazan destinos externos, credenciales en URL, barras ambiguas y caracteres de control. Los tokens legítimos conservan su codificación.

La preferencia por app se expresa con un enlace HTTPS dentro de su alcance `/app/`. El sistema operativo, navegador, instalación y preferencias deciden si abren la PWA instalada. En ausencia de asociación, el mismo enlace funciona en el navegador. No se promete apertura automática universal ni se reemplaza la prueba física: [navegación PWA de Chrome](https://developer.chrome.com/docs/capabilities/pwa-navigation-management?hl=en), [detección de PWA](https://web.dev/learn/pwa/detection).

## Eventos y plazos

| Familia | Destino y comportamiento comprobable |
|---|---|
| Propuestas de tres partes | Manifiesto relacionado; creación, aprobación individual, unanimidad, inicio y rechazo conservan significados diferentes. |
| Operación | Firma, traslado, entrega, recepción, tratamiento iniciado, tratamiento finalizado, rechazo y cancelación. Se completa el contrato de correo de inicio de tratamiento y cancelación. |
| Adendas | Creación, aprobación individual, observación/rechazo y aviso a autoridad por corriente nueva. La aprobación de una parte no equivale a unanimidad ni cambia habilitaciones. |
| Certificaciones | Enlace al manifiesto, certificado y sección de documentos. Cerrar un tratamiento no acredita emisión. |
| Inscripciones y representación | Solicitud exacta por actividad, avisos de cambios y personas; una revocación no concede acceso a la entidad. |
| Soporte | Ticket exacto, incluyendo toma, respuesta y cierre; el correo no expone conversaciones privadas. |
| PSIP | Expediente del inspeccionado o vista de autoridad según destinatario. El requerimiento conserva fecha y hora del plazo en el aviso y en el correo. |
| Alertas | Registro relacionado o ficha individual del aviso; no se obliga a buscar entre páginas históricas. |

**Decisión del dueño: los 30 días se cuentan desde la firma del manifiesto.** El recordatorio genera una fase a partir del día 23 y otra a partir del día 30, para las partes titulares activas vinculadas. Cada fase es idempotente por manifiesto, firma y destinatario; un reintento no la duplica. Se detiene para tratado/cancelado/rechazado y no inventa una firma faltante. Antes de cualquier entrega futura se revalida la firma, fase y estado; una fase semanal obsoleta no se entrega al superar los 30 días. El correo muestra la fecha de firma y la referencia de 30 días. Esto es seguimiento operativo, no calificación automática de infracción.

El job diario corre a las 08:15 de Mendoza en el worker principal. En preview se invoca explícitamente con reloj controlado y datos artificiales; el arranque automático queda inhibido por `NODE_APP_INSTANCE=qa`. No hay migración nueva para esta tanda. Si se publica en el futuro, un manifiesto abierto que ya supera 30 días recibe como máximo su fase vigente, no ambas fases retroactivas.

## Manual y galería

Manual **2026.22.6**, guía **Abrir un correo o aviso y continuar el trámite** (`avisos-enlaces-plazos`). Se conserva el renderer, estilos e índice del manual. La guía distingue el evento histórico del estado actual, el acceso del destinatario, las fechas y los límites de apertura de la PWA.

Galería reproducible desde `frontend/cloud-qa/communications-catalogue.ts`, `communications-compose.ts` y `communications-gallery-qa.ts`. Usa los renderizadores reales, datos artificiales, logos locales y controles de navegación inertes. Separa correo, campana, emergente y simulación push; una maqueta push no acredita entrega. Identifica expresamente los eventos internos que no poseen correo, sin inventar plantillas. No hace conexiones a base ni llamadas a proveedores. El generador descubre los emisores de notificaciones del backend y falla si aparece uno sin inventariar; una incorporación futura debe ampliar sus casos. Esto se ejecuta en preview, sin disparar workflows.

## Validación y cierre

Suites completas del candidato: **1.579/1.579 backend y 1.854/1.854 frontend**, cero pendientes u omitidas. Compilación backend, tipos y builds independientes de web y `/app` aprobados. Los dos bundles usan API relativa `/api` exclusiva del preview.

Durante la revisión se corrigieron dos fallos de producto: el plazo del requerimiento no se pasaba del controlador al emisor, y el comprobante de inscripción se enlazaba a una campana que el solicitante restringido no podía usar. Se verificaron con requerimientos reales en la base artificial y con destinos de inscripción.

Las primeras pasadas también detectaron ajustes del arnés: un import de QA obsoleto, un selector del manual que encontraba el título dos veces, la expectativa del enlace genérico anterior en un test de resumen y el intento de iniciar sesión como otra persona sin salir de la sesión activa en `/app`. Se corrigen las preparaciones/selectores, sin relajar privacidad, permisos ni contenido esperado; las evidencias de los intentos se conservan.

**45/45 E2E únicos PASS**, cero omitidos, fallidos o reintentos en la pasada final; **75 capturas**. Escritorio 1440×900, web angosta 360×800 y `/app` 390×844. Se abre el HTML real del correo, se pulsa su acción y se prueba login y recarga; incluyen inscripción exacta, adenda antigua entre más de veinte posteriores, soporte cerrado, requerimiento PSIP, recordatorios por firma y aviso privado. La privacidad se verifica además por HTTP con otra cuenta (404 para aviso y adenda ajenos). No es certificación Android.

**198 escenarios de galería**, **197 con correo** y **167 de campana/emergente**, ocho perfiles. Diez grupos de comprobación PASS: destinos existentes en ambos routers, mismos parámetros/anclas, filtros/búsqueda, leído/sin leer, todos los renders de correo y campana a ancho de teléfono, imágenes completas, cero desbordes, errores o solicitudes externas. El único escenario sin correo es el recordatorio fiscal manual, que conserva su campana y acceso al perfil; la galería lo identifica como interno. Las plantillas directas de cuenta figuran separadas de los correos derivados de la campana. Inventario de **23 fuentes de emisión**, **21 emisores encontrados automáticamente**, cero emisores fuera del catálogo. No se cuentan los valores ilimitados de textos libres como plantillas diferentes.

Pruebas de firma sobre base artificial: **3 avisos al día 23 + 3 al día 30; 0 duplicados al reintentar; 0 nuevos después de tratado**. Soporte probado por API en TOMAR/RESPONDER/CERRAR; requerimiento PSIP creado por API y plazo conservado en el correo.

Lint dirigido: **0 errores / 66 advertencias** (incluye herramientas QA). Los builds conservan la advertencia existente de chunks grandes. Se inspeccionaron capturas de galería en escritorio/teléfono y destinos en `/app`. **Cuatro scripts/estilos del manual conservan su SHA-256 anterior**; sólo cambia contenido y versión.

**975 tablas QA anteriores intactas**, cero intentos/entregas/cola activa de correo; cuatro alias CAP rechazados con 403 y gates verificados en los dos procesos. Ejecución serial, un worker, **1 CPU / 2 GiB / swap 0**, pico de memoria **1.953.943.552 bytes**, sin presión al límite ni OOM. Runtime, PostgreSQL y contenedor detenidos el **22/10/2026 19:40:52 Mendoza**; imagen, base y evidencias preservadas.

Procedencia verificada: **1781 archivos**, **1114 entradas de producto/manual**; los hashes coinciden con la compilación backend y los bundles revisados. SHA-256 de la galería final: `c9f13f33679f474e6ef010c144bca23169e59a953033c9274641e4e666f129fd`.

Evidencia en `test-results-communication-links-20261022/` y su contraparte remota `.qa-communication-links-20261022`.

No hay autorización de publicación en esta tanda. La última publicación documentada permanece en `8a4d8225`; no se accedió al servidor para cambiarla ni verificarla. No usar los bundles QA `/api` como build de producción. Android físico, captura del enlace por una PWA instalada y entrega en clientes externos de correo/push siguen diferidos; no se certifican con un viewport.
