# Correos: operación y despliegue seguro

Este procedimiento **no autoriza publicar ni activar entregas**. Mantener
`DISABLE_EMAILS=true` y `EMAIL_NOTIFICATION_FAMILIES` vacío hasta autorización.
No usar datos, cuentas o direcciones de QA en producción.

## Candidato y esquema

La rama `codex/sitrep-mail-safety-20261011` incorpora una migración aditiva:
`20261011190000_account_pending_mail`. Añade `usuarios.motivoInactividad`;
no cambia datos existentes ni clasifica cuentas históricas por suposición.
Aplicar y verificar la migración **antes** de iniciar el nuevo backend,
con respaldo, plan de vuelta y validación de la versión exacta aprobada.
No ejecutar `prisma db push` contra producción.

| Cuenta | Avisos operativos |
|---|---|
| Activa, correo verificado, preferencia habilitada | Sólo familias y eventos habilitados |
| Inactiva, PENDIENTE_APROBACION, verificada, preferencia habilitada | Avisos de su propia solicitud abierta; SOLICITUD_RECHAZADA sólo si el resultado sigue RECHAZADA |
| Inactiva, SUSPENDIDA | Ninguno; tampoco puede reutilizar sesiones restringidas |
| Inactiva histórica, motivo NULL | Ninguno hasta conciliación administrativa |
| Correo no verificado o preferencia deshabilitada | Ninguno del relay operativo |

La comprobación se repite antes de entregar una fila en cola. Suspender,
desverificar, desactivar la preferencia, cambiar la dirección, retirar la
familia o perder el recurso puede suprimir un aviso previamente pendiente.
La excepción de solicitante no habilita accesos completos, otras solicitudes,
soporte ni inspecciones.
El resultado rechazado puede consultarse con sesión restringida; no admite
editar el trámite, enviar mensajes ni acceder a manifiestos. Una cuenta
suspendida sigue bloqueada, incluso si conserva una solicitud rechazada.

Los avisos críticos de cuenta (cambio de clave/correo/rol, baja o suspensión)
son otra familia, `cuentas`: se dirigen a la dirección previamente verificada,
no incluyen contraseñas y no equivalen a una suscripción operativa. El aviso
del acto de suspensión no habilita avisos posteriores del trámite.

## Puertas independientes de activación

1. Publicar el candidato probado con correo apagado. Confirmar versión,
   migración, salud, ingreso y reversibilidad; no iniciar tareas ajenas.
2. Conciliar cuentas históricas inactivas, cola y digest. No convertir
   automáticamente filas antiguas a pendientes, no borrarlas ni reemitirlas.
   `ENVIADO` de versiones antiguas no demuestra que se haya entregado.
3. Aprobar remitente, Reply-To, responsables, familias, frecuencia y límite.
   Verificar SPF/DKIM/DMARC y el transporte institucional con TLS.
4. Autorizar explícitamente destinatarios canario. Se requiere
   `DISABLE_EMAILS=false` **y** `EMAIL_DELIVERY_NOT_BEFORE` ISO con zona,
   no futura ni retroactiva para rescatar historial. Las nuevas familias
   además requieren inclusión explícita en `EMAIL_NOTIFICATION_FAMILIES`.
   Las direcciones manuales de reglas antiguas tienen un cierre independiente:
   `EMAIL_EXTERNAL_ALERTS_ENABLED` permanece ausente/false. No habilitarlo
   por arrastre al activar correo para usuarios registrados. El usuario aprobó
   externos con autorización individual: además se exige la dirección exacta
   en `EMAIL_EXTERNAL_ALERTS_ALLOWLIST` (lista separada por comas; sin comodines,
   nombres de presentación ni dominios completos). Una dirección escrita en
   una regla no se autoriza a sí misma. Se vuelve a comprobar antes de SMTP;
   revocar la dirección suprime el digest pendiente, y reautorizarla no lo
   reenvía. No se agregó ninguna dirección real a esta lista.
5. Confirmar aceptación SMTP, recepción real y enlace autenticado. Si falla,
   apagar envíos y revisar la causa; nunca reintentar masivamente.

### Autorización individual de externos

La autorización se administra por Operaciones, separada de editar reglas en la
UI. Antes de agregar cada dirección, registrar aprobación del responsable,
finalidad, reglas permitidas y fecha en el cambio de configuración auditado.
No hay alta masiva por dominio ni aprobación automática por pertenecer a una
regla. Para revocar, retirar la dirección o apagar el canal y recargar de forma
controlada la configuración de todas las instancias. No afirmar revocación
instantánea de un SMTP que ya fue aceptado.

El externo recibe un resumen de la regla que lo incluye, no una cuenta ni
permisos para entrar a SITREP. Los enlaces privados siguen exigiendo acceso;
esta autorización de correo nunca concede lectura de expedientes.
Si la dirección pertenece a una cuenta de SITREP, el canal externo la rechaza:
debe pasar por el relay de usuarios y sus permisos/verificación/preferencias.
Se comprueba también antes de entregar, por si se registró después de encolar.
Así, una dirección manual no puede eludir una suspensión.

## Estados y recuperación

- `SUPRIMIDO`: terminal, no se despacha al activar posteriormente.
- `ENVIADO`: aceptación por SMTP; **no prueba recepción, lectura ni
  notificación legal fehaciente**.
- `FALLIDO`: sólo fallos inequívocos anteriores a aceptación pueden
  reintentarse, dentro de la ventana de 30 minutos y el corte de activación.
- `PENDIENTE / NOTIFICATION_READY`: aviso confirmado listo para tomar.
- `PENDIENTE / DELIVERY_IN_PROGRESS_OR_UNCERTAIN`: en curso o resultado
  ambiguo. Un timeout o fallo al guardar el acuse requiere revisión; no
  volver a poner en cola automáticamente.

El límite diario actual cuenta filas, incluidas entradas de digest: es
conservador, no una garantía de cuota SMTP exacta entre procesos.
Los avisos operativos (`notification:`) y los correos transaccionales de
cuenta/recuperación tienen contadores separados; ambos conservan el límite
configurado por `EMAIL_DAILY_LIMIT_TRANSACCIONAL` (10 por defecto). Así, un
día con muchos avisos no consume el cupo de recuperación de contraseña.
La segunda recuperación sigue sujeta al cupo de seguridad: no queda ilimitada.
Las pruebas de concurrencia miden exclusión de filas y ausencia de repetición;
no garantizan entrega exactamente una vez ante cualquier caída del proveedor.

## Vuelta atrás

Apagar correo primero; conservar cola y registros para investigación.
Volver a los binarios respaldados sin borrar la columna aditiva. Una versión
anterior puede no aplicar la nueva distinción de suspensión: no presentar
ese rollback como equivalente en permisos ni reactivar correo sin revisión.
No retirar registros, cuentas, documentos ni numeración.

## Límites del candidato

Familias operativas opt-in: solicitudes, soporte, inspecciones, certificados,
manifiestos, alertas y padron. Todas permanecen apagadas por defecto.
La familia cuentas conserva su política separada de seguridad.

CAA se publica junto con su aviso en la misma transacción y enlaza a Mi perfil,
sin adjuntar el PDF. La entrega revalida certificado aprobado y titular actual.
Padrón avisa de presentación a ADMIN y al administrador de su sector; una
resolución va al titular. Decisión y aviso se confirman juntos. Antes de enviar
se vuelve a comprobar sector, titular y estado del trámite.

El notificador de usuarios ya no envía un digest paralelo. Manifiestos,
incidentes y avisos existentes pasan por el relay, incluida la ruta por rol.
La bandeja conserva el detalle; el correo sólo anuncia una novedad.
No se crean avisos por cada GPS. Los manifiestos de prueba o reasignados se
descartan del envío; los casos resueltos/descartados y reglas desactivadas se
revalidan antes de SMTP. Las alertas de catálogo usan las fechas/condiciones
existentes, no inventan infracciones ni vencimientos.

Las reglas nuevas de DDJJ, discrepancia fiscal TEF y equivalencia de comprobantes
no se consideran implementadas por tener plantilla: requieren una fuente y
un criterio de negocio aprobados. El aviso existente de huella de comprobante
repetida sí entra en la familia alertas para destinatarios elegibles.
Chromium escritorio/móvil y la ruta /app no sustituyen Gmail/Outlook,
asociación de enlaces del APK ni dispositivos físicos.

## Comprobación de configuración — 11/10/2026, sólo lectura

Archivo de entorno del backend de producción: `DISABLE_EMAILS=true`, sin
familias habilitadas, sin corte de activación y sin habilitación de correos
externos. Transporte declarado: loopback, puerto 25; remitente
`SITREP <no-reply@ultimamilla.com.ar>`. `SMTP_REPLY_TO` no está configurado.
Esta lectura no certifica el entorno heredado por cada proceso PM2 ni entrega
histórica; no se cambió ningún valor y no se enviaron pruebas a producción.

DNS público consultado para ultimamilla.com.ar: SPF incluye la IP del servidor,
Google y Zedmail con cierre `-all`; DMARC declara `p=quarantine`, `pct=100`.
No se validó selector/firma DKIM ni alineación de un correo recibido. Completar
Reply-To, DKIM y canario autorizado antes de habilitar entregas reales.

### Actualización 11/10 22:00 UTC: canario real y TLS

Una prueba exclusivamente autorizada a `santosma@gmail.com` fue recibida en
**Spam**, SPF/DMARC pass, sin firma DKIM. No habilitar entregas automáticas por
esa sola recepción. El primer intento había fallado antes de MAIL/RCPT/DATA;
se conservan ambos recibos y se verificó una sola aceptación de mensaje.

Postfix ya presenta el certificado vigente de `umbot.com.ar`, por defecto y
por SNI umbot/www.umbot; otras entradas preservadas y renovación comprobada.
Detalles, respaldo y rollback en `DEPLOY-CORREOS-20261011.md`.

**Pendiente reproducido antes de activar**: el cliente publicado conecta a
127.0.0.1 y necesita indicar/verificar `umbot.com.ar` como nombre TLS. El canario
aislado lo hizo explícitamente; no se cambió la configuración ni binario del
cliente automático. No usar `rejectUnauthorized=false`, `ignoreTLS` ni plaintext
para resolverlo. Revisar también TLS de salida del relay (política actualmente
vacía), firma DKIM, Reply-To y reputación/entrega. No hay autorización de nuevos
canarios ni de activar la cola general. `DISABLE_EMAILS=true` se conserva.

## Candidato institucional y continuidad de sesión

Versión de plantilla `20261011.2`, todavía sin publicar. Todas las familias
usan la marca oficial de Mendoza existente en SITREP, estructura de tablas
de presentación y estilos en línea. Acciones principales verdes, texto claro
y asunto específico por evento. Los resúmenes no reproducen cuerpos privados.
El canal de respuesta de soporte es el ticket autenticado, no responder al email.
Contraste de la paleta declarada sobre blanco: verde `#1B5E3C` 7,74:1,
cuerpo `#172C24` 14,77:1 y secundario `#526359` 6,39:1. No extrapolar estos
valores a transformaciones de modo oscuro de los clientes de correo.

El catálogo de QA comprende 58 ejemplos, no 58 envíos distintos: 12 plantillas
transaccionales, 7 de seguridad, 11 variantes de destinatario, 25 eventos y 3
resúmenes. Se conservan las piezas históricas desconectadas; no se activan por
haber actualizado su diseño. Las reglas de elegibilidad y los cierres de envío
no se modificaron. Un PNG remoto puede ser bloqueado por el cliente de correo;
el texto alternativo y la identificación institucional siguen presentes.

### Verificación sin sesión y borradores

- `/verificar-email` y `/app/verificar-email` son rutas públicas de verificación.
  La llamada no adjunta la sesión abierta ni ejecuta el interceptor de refresh.
- Verificar no crea una sesión, no cambia tokens ni elimina borradores.
- Después de verificar, un visitante sin sesión debe ingresar con la cuenta
  correspondiente; se conserva el destino hacia la inscripción y se revalidan
  los permisos en la API.
- Si ya hay otra cuenta abierta, se informa la diferencia y se conserva esa
  sesión. No se muestra el borrador ajeno ni se hace logout automático.
- En el mismo navegador se conserva el borrador local vinculado a su cuenta.
  Desde otro navegador sólo puede recuperarse lo guardado en el servidor;
  no se prometen campos o archivos locales que nunca se sincronizaron.
- Una verificación inválida o vencida no borra el borrador. El enlace de
  recuperación exige ingreso; no concede acceso sólo por conocer una URL.

Las capturas y pruebas Chromium no certifican el render de Gmail/Outlook, modo
oscuro, imágenes bloqueadas ni asociación de enlaces del APK. Continúan aparte
los pendientes de transporte TLS, DKIM, Reply-To y entrega a Inbox.

### Evidencia del candidato institucional

Corrida `38181837507`, commit `5522c0f4a38009fdfcc80fd95de781c810ebde93`,
cerrada **SUCCESS** el 11/10/2026. Backend 917 unit, frontend 1395 unit,
90 E2E sin fallos, omitidos ni flaky. Tres superficies: Chromium escritorio
1440x900, web responsive 360x800 y `/app` 360x800. No emulador local ni APK
nuevo en esta tanda. Las 58 variantes se renderizaron en las tres superficies;
se comprobó logo cargado, ausencia de overflow lateral y acciones de al menos
44px, con texto blanco sobre verde. Los destinos se validaron con login real.

Integración de correo: 17 grupos aprobados, 52 mensajes capturados exclusivamente
en SMTP loopback y cero destinatarios externos. HTTP real: ocho grupos de ciclo
de cuentas/solicitudes/padrón con avisos suprimidos. Compilaciones backend,
web y app aprobadas; paquete de bytes probado sin reconstrucción ni despliegue.

La primera corrida `38180387394` aprobó 915 BE / 1395 FE / 87 E2E. La revisión
de capturas detectó que una bienvenida tapaba el borrador recuperado aunque el
dato sí estuviera presente. La prueba final cierra esa bienvenida mediante su
botón real y comprueba hit-testing del campo. La captura espera el fin de la
animación. No se deshabilitó ni cambió la bienvenida del producto. La tanda
intermedia `38181575247` se canceló antes del E2E para incluir esos controles;
no se cuenta como aprobada. No hubo VMs de pruebas solapadas.

Alcance aprobado: candidato de diseño y continuidad de verificación en navegador.
**No publicado. No es autorización ni GO de entrega de correos automáticos.**
