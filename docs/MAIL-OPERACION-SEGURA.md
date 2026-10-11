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
| Inactiva, PENDIENTE_APROBACION, verificada, preferencia habilitada | Sólo avisos de su propia solicitud en BORRADOR/ENVIADA/EN_REVISION/OBSERVADA |
| Inactiva, SUSPENDIDA | Ninguno; tampoco puede reutilizar sesiones restringidas |
| Inactiva histórica, motivo NULL | Ninguno hasta conciliación administrativa |
| Correo no verificado o preferencia deshabilitada | Ninguno del relay operativo |

La comprobación se repite antes de entregar una fila en cola. Suspender,
desverificar, desactivar la preferencia, cambiar la dirección, retirar la
familia o perder el recurso puede suprimir un aviso previamente pendiente.
La excepción de solicitante no habilita accesos completos, otras solicitudes,
soporte ni inspecciones.

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
5. Confirmar aceptación SMTP, recepción real y enlace autenticado. Si falla,
   apagar envíos y revisar la causa; nunca reintentar masivamente.

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
Las pruebas de concurrencia miden exclusión de filas y ausencia de repetición;
no garantizan entrega exactamente una vez ante cualquier caída del proveedor.

## Vuelta atrás

Apagar correo primero; conservar cola y registros para investigación.
Volver a los binarios respaldados sin borrar la columna aditiva. Una versión
anterior puede no aplicar la nueva distinción de suspensión: no presentar
ese rollback como equivalente en permisos ni reactivar correo sin revisión.
No retirar registros, cuentas, documentos ni numeración.

## Límites del candidato

La nueva integración valida cuentas, solicitudes elegibles, soporte e
inspecciones que ya producen avisos internos. No supone que cada evento
de la matriz tenga un correo. Rechazos de candidatos inactivos, CAA,
modificaciones de padrón y reglas específicas pendientes requieren completar
su circuito y destino antes de incluirlos en la habilitación.
Chromium escritorio/móvil y la ruta /app no sustituyen Gmail/Outlook,
asociación de enlaces del APK ni dispositivos físicos.
