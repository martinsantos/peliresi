# Correos SITREP — backlog prioritario para producción

Alta del pendiente: 11/10/2026. Hito solicitado: martes 13/10/2026, Mendoza.
ID: **MAIL-PROD-01**. Estado: **GO DEL BLOQUE IMPLEMENTADO EN QA CLOUD; publicación y envío real pendientes**.
Alcance de este registro: matriz/planilla de eventos y plantillas de correo,
destinatarios, ejecución, trazabilidad y pruebas. No habilita envíos reales.

## Ampliación validada — 11/10, candidato 32e32c4

- CAA oficial: carga DGFA y aviso al titular atómicos; acceso desde la bandeja
  a Mi perfil. Correo opcional, sin PDF adjunto; revalidación de propiedad,
  aprobación y existencia antes de entregar.
- Manifiestos/alertas: se elimina el envío directo paralelo del dispatcher;
  se reutiliza el aviso confirmado y una sola fila de cola. Incluye cambios
  de estado, incidentes, huella repetida, catálogo de vencimientos y
  requerimientos, y seguimiento de cierre. No se añaden reglas legales.
- Padrón: solicitud y resolución emiten avisos transaccionales, con revisión
  sectorial y resolución sólo al titular. Se revalida destinatario/estado.
- Rechazados: el solicitante explícitamente pendiente y verificado puede
  consultar su resultado con sesión restringida. Edición, mensajes y acceso
  operativo denegados; suspendidos siguen sin acceso.
- Direcciones externas de reglas antiguas: canal separado, bloqueado por
  defecto (`EMAIL_EXTERNAL_ALERTS_ENABLED`). Decisión del usuario aplicada:
  autorización individual mediante lista exacta de Operaciones y revalidación
  antes de entregar. No se agregó ningún destinatario real.
- Cupo: avisos operativos y cuenta/recuperación separados, ambos limitados;
  agotar los avisos no bloquea la recuperación de contraseña.

### Matriz vigente de conexión

| Familia | Productor y destinatario | Evidencia exigida / límite |
|---|---|---|
| Alta y solicitudes | Solicitud confirmada; solicitante propio y revisor competente | HTTP de presentación/observación/rechazo, login restringido y E2E de destino |
| Cuenta y seguridad | Siete eventos atómicos de cuenta; dirección previamente verificada | HTTP de cambios, consumo único de token, rollback, SMTP sólo capturado |
| Soporte | Aviso persistido de ticket; participante autorizado | E2E de respuesta, derivación, nota interna privada y rechazo de enlace ajeno |
| Inspecciones | Avisos persistidos de asignación e intercambio | E2E de inspector/actor, enlace autenticado; sin crear formalidades nuevas |
| CAA oficial | Documento DGFA y aviso en una transacción; titular del actor | Carga/descarga real de los tres actores, propiedad y revocación |
| Padrón | Renovación presentada/aprobada/rechazada | HTTP real, destinatario sectorial/titular, decisión repetida sin aviso duplicado |
| Manifiestos | Cambios de estado ya notificables | Ciclo E2E y relay SMTP; sin envío paralelo ni datos demo |
| Alertas existentes | Catálogo verificable, incidentes, cierre y huellas repetidas | Revalidación de caso/regla/destinatario; no inferir nueva regla fiscal |
| Destinatarios externos legados | Direcciones manuales de reglas, autorizadas individualmente por Operaciones | Canal y lista exacta separados; se revalida al enviar y revocación suprime cola sin replay |
| Nuevas discrepancias DDJJ/TEF | No basta tener plantilla | Pendiente fuente y criterio de negocio; fuera del GO de este bloque |

Las secciones históricas siguientes preservan el avance y las reproducciones;
sus pendientes resueltos no prevalecen sobre esta matriz ni el último informe QA.

Corrida 38165246711 **SUCCESS**, cerrada 11/10 a las 19:02:27 UTC.
Backend: 901 unit y 17 grupos DB/SMTP, 52 capturas dentro de la VM, cero
destinatarios externos. Migración exacta ensayada y revertida en base sintética.
Frontend: 1380 unit, ambos builds, ocho grupos HTTP y 81/81 E2E aprobados,
sin omitidos ni flaky; conteos y capturas en
[cierre QA](QA-CORREOS-20261011.md). Runtime, servidor y PostgreSQL QA detenidos.
No se publicaron cambios ni se modificaron envíos o datos de producción.

## Histórico del 11/10 — candidato 68d2ac5 validado en QA

La decisión del usuario ya está implementada: pendientes con correo verificado
reciben observaciones propias; suspendidos no. La columna aditiva
`usuarios.motivoInactividad` distingue ambos estados. Los históricos NULL no
se reclasifican por inferencia. Administrar activo=false marca suspensión;
el alta pública marca pendiente; aprobar limpia ese motivo.

Implementados siete eventos de cuenta en la misma transacción que la mutación:
creación, habilitación, suspensión, baja, cambio de rol, cambio de dirección
y contraseña (autenticada o recuperada). Se comprueba consumo único del token,
ausencia de secretos en esos mensajes y rollback conjunto. Familia `cuentas`
separada y apagada; los avisos críticos van al correo previamente verificado.

El relay revalida destinatario, preferencia, dirección y familia antes de
entregar. Se corrigió el destino de inspector con rol base de actor tras login.
Los E2E adicionales reprodujeron 403 en sesiones pendientes: servicios de
avisos/manifiestos arrancaban sin permiso. El candidato los desactiva para
esa sesión y muestra una vista de solicitud sin menús operativos inaccesibles.

Evidencia previa a esa última reparación: run38154113734,
847 unit backend, 1360 frontend, HTTP de cuentas y nueve grupos de integración
aprobados, 44 mensajes en SMTP loopback, cero externos; **54/57 E2E**, tres
fallidos por esos 403. No contar esa corrida como GO. La repetición final
`38155938709` aprobó 849 backend, 1366 frontend y seis grupos HTTP, pero
54/57 E2E: la vista restringida seguía ausente porque el adaptador de login
descartaba los campos `restricted` y `solicitudId`. Reparados en `158eb21`,
incluida restauración tras recarga, con cinco unit adicionales y E2E ampliado.
`38157429619` aprobó 849 backend, 1371 frontend y57/57E2E. La revisión de
capturas detectó scroll automático del panel de mensajes que cortaba el título
móvil. Reparado en68d2ac5 con dos unit y E2E de encabezado/salida en viewport.
Repetición final38158621314 **SUCCESS**: 849 unit backend, 1373 frontend,
nueve grupos DB/SMTP, seis grupos HTTP y57/57E2E, sin omitidos ni flaky.
Revisión directa de las tres capturas finales confirma encabezado completo,
salida visible y ausencia de navegación inaccesible. Cierre QA confirmado.
GO de este bloque en QA, no de toda la matriz ni de envíos externos.

### Pendientes que no quedan ocultos por el éxito de una suite

- Aviso de rechazo para solicitantes inactivos: su destino debe permitir
  consultar el resultado sin acceso operativo. Todavía fuera de la excepción
  de solicitudes BORRADOR/ENVIADA/EN_REVISION/OBSERVADA.
- Modificaciones de padrón, disponibilidad CAA y reglas específicas de
  vencimientos/DDJJ/TEF: conciliar por evento y destinatario; una plantilla
  existente no es una conexión funcional.
- Dispatcher legado de alertas/manifiestos: no afirmar uniformidad completa
  de verificación/preferencias por sus diferentes canales.
- Conciliar históricos inactivos, remitente/Reply-To, DNS y canario autorizado.
- Clientes reales de correo y asociación de enlaces del APK no quedan
  certificados por Chromium ni por la ruta /app.

No publicación ni activación. Ver [operación segura](MAIL-OPERACION-SEGURA.md)
y el [corte QA](QA-CORREOS-20261011.md). Las secciones posteriores conservan
el inventario y resultados del lote inicial; no reemplazan esta actualización.

## Objetivo y límites

Que cada evento que necesita comunicación tenga destinatario autorizado,
mensaje breve y consistente, acción útil y evidencia real de su resultado.
No convertir cada modificación de campo en un correo ni duplicar alertas.
Reutilizar los eventos, reglas, cola y bandeja existentes de SITREP.
Infraestructura propia y configurable para el traslado al Gobierno, sin
dependencia de otros proyectos.

Mantener correo y push apagados durante desarrollo y QA. Modo revisión,
capacitación y datos sintéticos no deben generar correo real ni quedar
pendientes de envío futuro. La habilitación final y una prueba real acotada
requieren autorización separada y destinatarios de prueba confirmados.

## Base existente y riesgos detectados por lectura de código

- `backend/src/services/email.service.ts`: plantilla HTML común, verificación
  de correo, recuperación de contraseña, registro pendiente/aprobado, solicitud
  presentada/observada/rechazada, respuesta del candidato y modificación
  solicitada/aprobada/rechazada. Hay cola, reintentos y resúmenes de alertas.
  Su existencia no prueba que todos los disparadores estén conectados.
- `backend/src/services/notification-dispatcher.service.ts`: notificación
  individual puede derivar a correo según preferencia; la ruta por rol revisada
  persiste avisos y despacha push, sin el mismo despacho de correo. Conciliar
  todos los caminos antes de afirmar cobertura.
- **P0: estados falsos.** `smtpSend` retorna sin enviar con
  `DISABLE_EMAILS=true`, pero su llamador transaccional puede luego guardar
  `ENVIADO`. Reproducir en una prueba aislada y corregir antes de habilitar:
  suprimido no es enviado; aceptación SMTP tampoco prueba entrega al buzón.
- **P0: cola histórica.** Inventariar pendientes, fallidos y resúmenes antes
  de activar. No liberar automáticamente avisos antiguos o de pruebas.
  Proponer tratamiento auditado; no borrarlos ni reemitirlos sin decisión.
- Revisar escape de textos interpolados en HTML, enlaces y encabezados.
  Ninguna entrada del usuario debe transformarse en HTML ejecutable.

## Planilla de casos a conciliar

Destinatarios y frecuencia de esta tabla son propuestas para validar contra
los permisos y reglas vigentes; no nuevas reglas legales ni activaciones.
Cada evento enumerado debe tener su propia fila en el inventario final.

| Familia / eventos | Destinatario propuesto | Acción del mensaje | Cobertura por verificar |
|---|---|---|---|
| Cuenta: invitación, alta, verificación y aprobación | Titular; administrador competente cuando debe intervenir | Verificar dirección, activar o revisar cuenta | Reutilizar plantillas existentes; revisar invitación y acuse |
| Cuenta: baja, suspensión, reactivación y cambio de rol | Titular y responsable autorizado según evento | Ver motivo permitido o consultar soporte | Inventariar disparadores; no enviar credenciales |
| Seguridad: recuperación, contraseña cambiada, cambio de correo y reclamo de cuenta | Titular verificado; aviso a dirección anterior cuando corresponda | Confirmación segura o recuperación | Tokens de un solo uso, vencimiento y rechazo de reutilización; sin revelar existencia de cuentas |
| Alta de actor: presentación, observación, respuesta, aprobación y rechazo | Solicitante y revisor asignado/sector competente | Abrir el trámite concreto | Separar aprobación de cuenta de aprobación/habilitación del actor |
| Modificación/renovación del padrón: solicitud, corrección, resolución | Titular y revisor competente | Revisar solicitud y resultado | No correo por cada autoguardado; sólo eventos definidos |
| Documentación y certificados: requerimiento y documento oficial disponible | Titular autorizado y responsable de revisión | Aportar documento o descargar CAA tras autenticación | No adjuntar documentos sensibles por defecto; no fabricar certificados |
| Inspecciones: asignación/reasignación, presentación a jefatura, requerimiento, descargo y resolución | Inspector asignado, jefatura o actor afectado, según etapa | Abrir inspección o actuación correspondiente | No avisar a todos los administradores por defecto; separar notas internas |
| Inspecciones: plazo próximo/vencido o resultado que requiere acción | Responsable competente; actor sólo cuando corresponde notificarle | Resolver la actuación o responder | Usar plazo aprobado y fecha real; no afirmar infracción automáticamente |
| Manifiestos: asignación, retiro/entrega, recepción, rechazo, incidente, tratamiento, cierre y cancelación | Generador, transportista u operador involucrado según acción | Abrir el manifiesto y realizar la acción pendiente | Definir qué eventos son inmediatos, resumen o sólo aviso interno |
| Alertas operativas: retiro pendiente, cierre demorado y seguimiento territorial | Responsable de resolver y administrador competente | Abrir el caso vigente | Sin spam por cada GPS; no presentar falta de señal como incumplimiento |
| Vencimientos: DDJJ, habilitaciones, licencias y documentación | Actor obligado; seguimiento administrativo autorizado | Renovar, presentar o revisar | Calendarios aprobados; fechas sin hora vigentes hasta fin del día en Mendoza |
| Inconsistencias: DDJJ, TEF, pesajes, recibos/OCR y posible duplicación | Revisor competente; actor sólo si se solicita aclaración | Revisar evidencia o aportar datos | No validar pagos ni sancionar por OCR; no revelar datos de otro aportante; cálculo TEF sólo administrativo |
| Soporte: ticket recibido, asignación/derivación, respuesta pública, solicitud de información, cierre/reapertura | Solicitante real y agente responsable | Abrir ticket o responder dentro de SITREP | En impersonación conservar solicitante y autor; notas internas nunca al usuario final |
| Administración técnica: fallos persistentes de entrega y resumen de pendientes | Soporte técnico/administración autorizada | Revisar cola, rebote o configuración | No cadenas recursivas de alertas sobre correos fallidos |

## Entregables y secuencia

- [ ] **MAIL-01 / P0 — Inventario verificable.** Por evento: ID, disparador
  real y archivo, destinatario y permiso, canal, prioridad, frecuencia,
  plantilla/versión, variables, enlace, exclusiones, deduplicación y prueba.
  Clasificar: existente conectado / existente sin verificar / faltante /
  requiere decisión. Ningún evento desaparece por no estar implementado.
- [ ] **MAIL-02 / P0 — Catálogo de plantillas.** Asunto, preencabezado,
  HTML responsive y texto plano; identidad SITREP, contraste, acentos,
  fecha/hora Mendoza y un botón principal con alternativa de enlace.
  Previsualización con datos ficticios y variables faltantes controladas.
  Sin contraseñas, documentos personales ni datos sensibles en el asunto.
- [ ] **MAIL-03 / P0 — Entrega honesta y segura.** Corregir supresión;
  estados distinguibles: pendiente, aceptado por proveedor, entregado sólo
  con evidencia, fallido, rebotado y suprimido. Reintentos acotados y
  deduplicación persistente para dos workers; no depender de memoria local.
  Registrar evento, destinatario, versión, intento y causa sin guardar tokens
  ni datos sensibles en logs. No afirmar lectura sin evidencia.
- [ ] **MAIL-04 / P0 — Conectar casos prioritarios.** Cuenta/seguridad,
  altas y modificaciones, asignación/requerimientos de inspección, respuestas
  públicas de soporte y alertas ya operativas. Cada caso restante debe
  implementarse o quedar explícitamente excluido del GO, nunca implícito.
- [ ] **MAIL-05 / P0 — Configuración operativa.** Remitente y Reply-To
  aprobados; transporte cifrado, credenciales seguras, SPF/DKIM/DMARC,
  límites y destino configurable para Gobierno. Permisos para cambiar
  reglas/canales con auditoría. Diferenciar comunicaciones de seguridad
  imprescindibles de resúmenes opcionales. Inventario de cola histórica.
- [ ] **MAIL-06 / P0 — QA y habilitación controlada.** Matriz completa
  contra buzón SMTP de captura en nube, sin direcciones reales; autorización
  posterior para un envío canario a destinatarios confirmados. Activación
  gradual por evento, límite inicial, monitoreo y apagado reversible.

## Criterios de aceptación para GO de correo

1. Unit: render HTML/texto, escape, variables faltantes, links permitidos,
   roles/destinatarios, exclusión de notas internas, expiración y supresión.
2. Integración: evento de negocio confirmado → una entrada de cola →
   recepción en buzón de captura; rollback de negocio no produce correo.
   Dos workers/reintentos no duplican; timeout, rebote y proveedor caído
   muestran estado honesto. Tokens vencidos y casos resueltos no se reenvían.
3. E2E: web y app abren el enlace exacto, requieren sesión cuando corresponde,
   conservan destino tras login y niegan acceso ajeno. Incluye inscripción,
   solicitud observada, inspección asignada y respuesta de soporte.
4. Visual: plantillas en escritorio/móvil y clientes de correo disponibles;
   imágenes bloqueadas, texto largo y modo oscuro. Registrar clientes
   realmente probados; no certificar todos por una captura de navegador.
5. Operación: configuración y destinatarios aprobados, cola antigua conciliada,
   canario autorizado confirmado, trazabilidad accesible a soporte y rollback.
   Correo no habilitado hasta completar este punto.

## Decisiones para cerrar durante la implementación

- Remitente institucional, buzón de respuestas y responsables por sector.
- Inmediato/resumen/sólo interno por evento; umbrales y calendarios que aún
  requieran aprobación. No esperar estas decisiones para producir inventario
  y pruebas aisladas.
- Tratamiento de correos históricos y destinatarios del canario.
- No equiparar un correo informativo con notificación legal fehaciente.

Este backlog no modifica producción, no activa timers ni inicia pruebas masivas.
Objetivo para el martes registrado; cumplimiento pendiente de ejecución y QA.

## Ejecución del 11/10 — no es sólo documentación

Rama `codex/sitrep-mail-safety-20261011`, derivada de producto `3117f91`.
Los cambios de correo aún no están desplegados. Producción conserva
`20261011-license-ocr-r1`, sin modificar proveedores, formularios ni datos.

- Los dos bloqueantes tienen reproducción y corrección: correo deshabilitado
  se registra `SUPRIMIDO`, sin `sentAt` ni digest futuro; quitar
  `DISABLE_EMAILS` no libera la cola histórica. Se requiere un corte explícito
  `EMAIL_DELIVERY_NOT_BEFORE` con zona horaria y no se reintentan filas de más
  de 30 minutos. Las antiguas se conservan para revisión, no se borran.
- Doce plantillas públicas migradas a catálogo común HTML/texto, escape de
  variables, enlaces del origen SITREP, tokens codificados, asunto sin datos
  personales y versión persistida en el HTML. Resumen de alertas conserva su
  plantilla común y el horario de Mendoza.
- `ENVIADO` conserva compatibilidad con la base y significa aceptación SMTP,
  **no entrega ni lectura**. Las marcas históricas anteriores a esta reparación
  no son evidencia fiable por sí solas. Timeout ambiguo y fallo al persistir
  un acuse aceptado quedan pendientes de revisión, sin reenvío automático.
- Reintentos con toma exclusiva por comparación de estado/intentos; digest
  con `UPDATE ... RETURNING` y bloqueo dentro de la misma sentencia. Se
  probaron dos procesos independientes sobre PostgreSQL real en nube.
- Nuevo relay optativo desde notificaciones internas ya confirmadas:
  solicitudes, soporte e inspecciones. Usa ID estable `notification:<id>` y
  restricción primaria/`skipDuplicates`, sin correo desde transacciones de
  negocio. No inventa avisos cuando el flujo no emitió una notificación.
  Familias desactivadas por defecto: `EMAIL_NOTIFICATION_FAMILIES` vacío.
- Destinatario del relay: el destinatario original del aviso, con cuenta
  activa, correo verificado y preferencia de correo habilitada. No copia
  notas, adjuntos, observaciones libres ni datos de terceros al mensaje.
  Se excluyen señales de prueba/revisión y actas de capacitación reconocidas.

### Inventario histórico del lote inicial, sustituido por la matriz vigente

| Plantilla o familia | Disparador comprobado en código | Estado del candidato |
|---|---|---|
| Verificar correo | `auth.controller`, `solicitud.controller` | Conectado; plantilla y SMTP capturado probados |
| Registro pendiente, nuevo registro al admin | `auth.controller` | Conectados; plantillas y SMTP capturado probados |
| Cuenta activada | `admin.controller.toggleActivo` | Conectado; no equivale a aprobación jurídica del actor |
| Recuperar contraseña | `auth.controller` | Conectado; enlace codificado, sin modificar el flujo de tokens |
| Solicitud presentada/observada/aprobada/rechazada/mensaje | Avisos `SOLICITUD_*` persistidos por `solicitud.controller` | Relay implementado, desactivado; pendiente distinguir solicitantes inactivos de suspendidos |
| Plantillas específicas de solicitud enviada/observada/respuesta/rechazo | Métodos públicos anteriores sin callsite directo | Render y transporte probados; el relay usa aviso breve neutro, no afirmar conexión de estas variantes |
| Modificación solicitada/aprobada/rechazada | Métodos públicos anteriores sin callsite directo | Plantillas probadas; falta conexión y prueba de evento de negocio |
| Asignación de inspección | `inspeccion.controller` genera aviso con `inspeccionId` | Relay implementado y probado; desactivado |
| Ticket creado/derivado/actualizado | Avisos privados persistidos por `support.controller` | Relay implementado y probado; desactivado; sin contenido de notas internas |
| Alertas operativas y manifiestos | Dispatcher individual y `alerta.subscriber` | Camino previo conservado; supresión/cola reparadas; no certificar todos los eventos ni preferencias por rol |
| Baja, suspensión, cambio de rol/clave/correo, CAA, DDJJ/TEF, vencimientos, jefatura/descargo | Matriz anterior | No añadir mails por suposición; pendientes de conexión/conciliación por evento |

### Gates medidos y límites

Reproducción `38149176120`: tres nuevas pruebas fallan por los defectos
reportados. Corrida `38150053284`: **795/795 unit backend**, typecheck y
PostgreSQL + SMTP de captura aprobados. Corrida `38150287353`: **810/810 unit**,
typecheck y seis grupos de integración aprobados, incluyendo rollback de
notificación y relay de tres familias. En esa corrida hubo **36 mensajes
capturados sólo en loopback**, **cero destinatarios externos**. La corrida
final `38150666287` agrega exclusión de capacitación y previsualizaciones:
**820/820 unit**, typecheck y seis grupos de integración aprobados, 36 mensajes
capturados, cero externos. Ver [corte verificable](QA-CORREOS-20261011.md).

No se corrieron nuevos E2E web/APK ni revisión en Gmail/Outlook en este lote.
Un registro de notificación creado en integración no sustituye la prueba
HTTP/E2E del evento que lo origina. No hay autorización de envío canario,
validación de buzón real, SPF/DKIM/DMARC ni remitente/Reply-To institucional
definitivamente aprobados. No afirmar GO de correo externo.

### Decisiones y trabajo antes de activar

1. Distinguir solicitante pendiente verificado de una cuenta suspendida:
   ambos usan `activo=false`. El relay los suprime por seguridad por ahora.
2. Confirmar remitente, Reply-To, responsables y familias a habilitar;
   auditar la cola histórica sin reinterpretar `ENVIADO` como prueba de entrega.
3. Completar conexiones faltantes de la matriz, enlaces autenticados web/app,
   revisión visual en clientes reales y política de recordatorios/límites.
   El límite diario actual cuenta filas del digest, no mensajes SMTP; es
   conservador, pero no certifica una cuota exacta bajo concurrencia.
4. Publicación reversible del candidato y habilitación/canario requieren
   revisión de gates y autorización; no están incluidos como ya realizados.
