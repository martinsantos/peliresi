# Correos, avisos y destinos — revisión del 22/10/2026

**Publicado como `712de167` el 22/10/2026 20:15:03 Mendoza.** La evidencia de preview de abajo precede a la publicación documentada al final. Revisión previa: base `443cafe9`, rama `codex/sitrep-training-20261018`, único checkout autorizado `sitrep-production-source-20261001`. Sin producción, main ni datos reales; CAP cerrado, correos/push apagados. No se disparan workflows ni se envía correo a nadie.

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

El job diario corre a las 08:15 de Mendoza en el worker principal. En preview se invoca explícitamente con reloj controlado y datos artificiales; el arranque automático queda inhibido por `NODE_APP_INSTANCE=qa`. No hay migración nueva para esta tanda. Al publicarse, un manifiesto abierto que ya supera 30 días recibe como máximo su fase vigente, no ambas fases retroactivas.

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

La validación de preview terminó antes de recibir autorización de publicación. Luego el dueño autorizó expresamente `712de167` en los cuatro componentes con flags actuales; el despliegue se detalla abajo. No se usaron los bundles QA `/api` en producción. Android físico, captura del enlace por una PWA instalada y entrega en clientes externos de correo/push siguen diferidos; no se certifican con un viewport.


## Publicación y verificación final

Fuente **712de167d53e1dea04296f45f4aaf98f17d4d2e6**, publicada el **22/10/2026 20:15:03 Mendoza**, sin push ni workflows. Se incluyen las tandas anteriores de ABM/representación y revisión web/app; **ENTERPRISE_ENABLED / ACTOR_MULTIROLE_ENABLED y sus pares VITE siguen en false**, conforme a la orden de conservar flags actuales. No se activan cuentas ni se regularizan históricos.

Compilación nueva y serial en preview (1 CPU/2 GiB/swap 0): backend, cliente Prisma compatible, tipos efectivos, web y app. **2.439 archivos Git idénticos antes y después**, API `https://sitrep.ultimamilla.com.ar/api`, manual **2026.22.6** exacto; estilos y renderer iguales a la versión previa. Cuatro paquetes y archivos comprobados por SHA-256 en origen, descarga y servidor. Pico **1.630.208.000 bytes**, cero eventos max/OOM. El verificador inicialmente esperaba un chunk separado de AvisoPage; se comprobó que su import es estático y se verificaron pantalla/ruta en el bundle principal, sin cambiar producto ni artefactos.

Backend `/var/www/sitrep-backend-releases/20261022-comunicaciones-712de167`; web/app/manual `/var/www/sitrep-releases/20261022-comunicaciones-712de167`. SW raíz **v156**, app **20261022230746**; la versión de caché raíz es una transformación declarada del artefacto, sin modificar la fuente del commit. Smoke **150/150 + 9/9 externo + 8/8 PWA**: GET públicos, integridad de bundles/manual/SW, salud y guardas sin token. Cero logins, decisiones o escrituras de prueba. La ficha privada y la adenda seleccionada resuelven en ambas superficies; sus APIs sin sesión rechazan acceso. El smoke no sustituye los E2E autenticados del preview ni certifica Android.

**Sin migraciones**: paquete, lock, esquema y migraciones idénticos a producción anterior `8a4d8225`. Se respaldó y comprobó configuración `.env`/PM2 antes de activar; no se copió ni restauró base. `.env` SHA-256 **988d42eebd8fde9ad163db25f124a6680f6054849c6ce7c346f03ce284536872**, exactamente conservado. Ambos workers y configuración persistida mantienen identidades, uploads, flags, CAP cerrado y correos/push apagados. El dominio de enlaces es `https://sitrep.ultimamilla.com.ar`. No se consultaron ni modificaron datos de negocio.

El recordatorio desde la firma queda programado a las **08:15 Mendoza**, sólo en el worker principal; no se invocó durante el despliegue. Genera avisos internos en su horario según las reglas verificadas, sin habilitar entregas externas.

### Incidencia operativa resuelta

Después de recargar el backend, el control de igualdad de procesos ajenos observó el cambio de PID/reinicio de SGI y detuvo la activación de frontend. El registro de nuestro comando PM2 confirma sólo IDs **1 y 2**; los registros del gestor muestran además reinicios posteriores de SGI y su sincronizador. Se conservaron intento, salida del comando y eventos. El backend SITREP permaneció listo y con ambos workers estables; se verificaron otra vez paquetes, configuración y reversión, y se completó sólo el cambio de frontend. Para servicios ajenos se verifica identidad/ruta/estado, registrando sus cambios transitorios de PID sin administrarlos. El smoke final pasó y los procesos SITREP no volvieron a reiniciarse.

Evidencia local ignorada: `test-results-deploy-712de167/`. Respaldo operativo privado: `/var/backups/sitrep/20261022-comunicaciones-712de167/`. No copiar secretos de ese directorio al repositorio. Preview detenido **22/10/2026 20:16:27 Mendoza**; no se inició su base en esta publicación. Imagen, base y evidencias preservadas.

## Reversión vigente preparada — no ejecutada

Volver a **8a4d8225 en backend/web/app/manual**, conservando esquema, flags, cuentas, archivos e históricos. Los avisos ya generados se conservan; no se restauran ni borran datos. No ejecutar las reversiones históricas de tandas anteriores.

```bash
ssh root@23.105.176.45 'node /var/backups/sitrep/20261022-comunicaciones-712de167/publish-production.js rollback'
```

El comando valida huellas, esquema, configuración y salud; recupera backend `/var/www/sitrep-backend-releases/20261022-eventuales-8a4d8225`, recarga sólo SITREP y activa `/var/www/sitrep-releases/20261022-comunicaciones-712de167-rollback`. Cachés de recuperación **v157 / 20261022231123**, con assets nuevos conservados para clientes abiertos. Guarda configuración de PM2 y mantiene Nginx. Los cambios de PID ajenos no impiden la reversión, pero se conservan controles de identidad y estado de esos servicios. Después verificar versión `8a4d8225`, salud y gates; registrar la ejecución si se usa. La reversión está preparada y verificada por archivos, **no ejecutada**.
