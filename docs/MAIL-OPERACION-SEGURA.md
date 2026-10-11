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
