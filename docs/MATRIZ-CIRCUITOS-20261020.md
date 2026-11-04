# Matriz de circuitos, responsabilidades y evidencia

Revisión completada en preview el 21/10/2026. **Esta matriz identifica el contrato y su prueba; los límites no desaparecen por pasar tests.** Resultado: backend **1430/1430**, frontend **1781/1781**, **369 casos E2E únicos**, **78 grupos HTTP**. Ver [informe y evidencia por caso](REVISION-INTEGRAL-CIRCUITOS-20261020.md). Fuentes: controladores/rutas, servicios de avisos y pruebas de esta rama. Preview exclusivo; sin datos reales ni proveedores de mensajería.

## Manifiestos, adendas y transporte

| Circuito | Quién actúa y qué conserva | Prueba de referencia |
| --- | --- | --- |
| Manifiesto operativo | Generador/administración crea; generador firma; transporte retira/entrega; operador recibe, pesa, trata y cierra. El acceso a C3 no otorga edición del expediente. | `manifest-lifecycle.spec.ts`, `role-handoff.spec.ts`, `global-operation.spec.ts` |
| Asignación de móvil/chofer | Transporte pertenece al manifiesto; sólo se ofrecen integrantes activos de su flota. Cambiar empresa limpia la selección, no inventa un reemplazo. La asignación guardada es histórica. | `manifest-transport.spec.ts` y pruebas de asignación |
| Propuesta de tres partes | El creador aprueba su lugar; faltan las otras partes. Un rechazo detiene la propuesta. La unanimidad habilita coordinación; el retiro físico inicia viaje/GPS. **La creación de este circuito está delimitada por capacitación. CAP sigue cerrado.** | `manifestProposal.test.ts`; el E2E CAP previo no se cuenta como prueba de este entorno operativo |
| Agenda y listados | Separar acción propia, espera y viaje en curso; conservar filtros y orden; recién creados visibles y estados terminales coherentes. | `review-circuito.spec.ts`, pruebas de agenda y lista |
| Viajes simultáneos | Cada carga conserva su identificación, estado y tramo. Los viajes propios se muestran antes de los relevos. Un fallo de GPS admite reintento sin perder el viaje. | `fleet-gps.spec.ts`, `review-circuito.spec.ts` |
| Relevo registrado/externo | Transporte original registra traspaso. Reemplazo sólo accede a su tramo; externo declarado usa enlace GPS limitado. Identidad, motivo e historial se conservan. | `transport-handoff.spec.ts`, integración de relevos |
| Adenda/hallazgo | Operador registra diferencias de cantidad y corrientes Y encontradas. Declaración original no se reemplaza; se compara con ficha del operador sin afirmar habilitación regulatoria. | `inspection-intake.spec.ts`, dominio de adenda y hallazgo |
| Revisión de adenda | Autor y contraparte no se confunden. Decisiones, observaciones y versiones permanecen. Reintento/concurrencia no duplica ni pisa decisiones. | `role-handoff.spec.ts`, dominio y controladores de adendas |
| Eventual | Participante vinculado aprueba su lugar; externo conserva identidad declarada, sin alta implícita. Operación y revisión posterior son ejes separados. | `manifest-exceptional.spec.ts`, revisión y cola PSIP |
| Certificados | Distinguir emisión, descarga y liberación del operador según el circuito habilitado. No trasladar reglas de certificados CAP a documentos oficiales. | `manifest-lifecycle.spec.ts`, certificados/documentos y pruebas CAP de dominio |

## Avisos y PSIP

| Evento | Destinatario / próxima acción | Prueba de referencia |
| --- | --- | --- |
| Cambio operativo de manifiesto | Partes vinculadas con acceso vigente; abrir manifiesto/viaje correspondiente al rol. | Servicio de notificaciones, `role-handoff.spec.ts`, correo de manifiestos |
| Adenda creada/observada/aprobada/rechazada | Partes involucradas, sin usar el aviso como aprobación. Abrir anexo e historial. | Servicio de adenda, correo controlado, E2E post facto |
| Eventual: creación, partes, hechos y revisión | Participantes registrados vinculados y activos; la solicitud incluye autoridad designada independiente. Contactos libres no crean destinatarios. Enlace BI- y estado de operación separados de revisión. | `eventualNotice.service.test.ts`, integración de eventuales y `manifest-exceptional.spec.ts` |
| Alta/programación de inspección | Inspector asignado y administración competente; preparar visita. | Nueva prueba de agenda, operaciones PSIP |
| Reprogramación/reasignación | Responsable actual y administración competente; fecha/responsable actualizados con trazabilidad. Guardar sin cambios no genera ruido. | Nueva prueba de agenda y correo con revocación de acceso |
| Paso de campo a revisión/cancelación | Responsable y administración del ámbito; revisar expediente o dejar de ejecutar visita cancelada. | Estados PSIP y agenda |
| Requerimiento/pronunciamiento/decisión | Actor vinculado; responder el requerimiento concreto o consultar la decisión. Contacto libre no recibe acceso por inferencia. | `psip-notices.spec.ts`, `inspectionMailLifecycle.test.ts` |
| Respuesta/descargo/subsanación | Inspector asignado y administración competente; evaluar la actuación. Leer la campana no responde ni resuelve. | `psip-notices.spec.ts`, `psip-deadlines.spec.ts` |
| Plazo vencido/sin respuesta | Señalar el requerimiento exacto, fecha y responsable. Una respuesta tardía se conserva; no elimina el vencimiento histórico. | `psip-deadlines.spec.ts`, follow-up unitario |
| Legales | Derivación y seguimiento del expediente con próximo responsable. ATM no se presenta como una derivación ficticia. | `psip-legal.spec.ts` |
| Antecedente desde adenda/eventual/relevo | Administración competente evalúa y decide apertura; antecedente no equivale a infracción ni inspección automática. | `inspection-intake.spec.ts`, servicios de intake |
| Correo simulado | Evento concreto, enlace seguro, preferencia/verificación, destinatario actual, cola idempotente y corte de activación. Sin texto privado ni archivos copiados al mail. | Unitarias de correo y E2E de enlaces renderizados; cero SMTP/push |

## Usuarios, actores y formularios

| Circuito | Criterio de aceptación | Prueba de referencia |
| --- | --- | --- |
| Alta pública de los tres actores | Guardar borrador, adjuntar, corregir observación, reenviar y consultar aprobación/rechazo; no perder información por errores o sesión limitada. | `actor-onboarding.spec.ts` |
| Alta administrativa | Documentos/ATM/electricidad presentes donde corresponden; registro de actor y usuario relacionados correctamente. | `actor-administration.spec.ts`, `circuit-transport-admin.spec.ts`, `registration-unified.spec.ts` |
| ATM | Identidad del pago y evidencia; mismo pago con distinta foto o en otra alta detectado. Revisión humana conserva decisión y trazabilidad. | `payment-electricity.spec.ts`, integración y unidades de identidad de pago |
| Electricidad | Extraer sugerencias de factura sin inventar valores ni categoría regulatoria; revisión/confirmación explícita. Errores de OCR recuperables. | `payment-electricity.spec.ts`, análisis documental |
| Ingreso y cambio de sesión | Conservar el identificador al fallar, mostrar el error del intento actual, recuperar sesión válida y no exponer el usuario anterior ni rutas privadas durante carga. | `circuit-login.spec.ts`, `sessions.spec.ts`, AuthContext/AuthGate |
| Edición de usuario | Nombre/apellido compuestos conservados; vaciar un dato opcional realmente lo borra; error de red conserva formulario. | Nueva `circuit-users.spec.ts` |
| Estado y filtros de usuario | Desactivado no es pendiente de alta. Cuenta, motivo y filtro coinciden. La interfaz no amplía permisos. | Nueva `circuit-users.spec.ts`, listado backend |
| Desactivar/reactivar/borrar una cuenta | Desactivar revoca ingreso y sesión previa; reactivar restituye acceso; cancelar conserva; borrar requiere confirmación y se rechaza si tiene manifiestos. El mismo rechazo protege al actor y al histórico. | `circuit-users.spec.ts`, 18 casos en tres vistas |
| Edición de actor/históricos | Cambios en padrón no reescriben documentos ni asignaciones previas. Solicitudes de cambio se resuelven según rol. | `actor-edit-history.spec.ts`, dominio de renovación |
| Móviles/choferes | Altas, edición y baja lógica vinculadas a la empresa; asignaciones históricas intactas. | Flota de alta y manifiesto, unidades de asignación |
| Documentos de transporte | Administración identifica/reserva/revisa ATM desde Documentos; el titular consulta/descarga. Un adjunto inválido no duplica el alta ni la flota al reintentar. | `circuit-transport-admin.spec.ts`, `ActorDocuments.test.tsx` |
| Documentos y certificados | Dueño/administración competente, estados claros, descarga permitida sólo donde corresponde. | `actor-uploads.spec.ts`, `actor-certificates.spec.ts` |

## Límites de la evidencia

Las pruebas de escritorio, web móvil y `/app` comprueban navegadores y layouts reales con datos artificiales. No certifican sensores físicos, segundo plano de Android/iOS ni entrega real de correo/push. La interpretación fiscal/eléctrica pendiente requiere fuente normativa y decisión explícita; OCR no la sustituye. Ninguna cifra de unitarias debe confundirse con cobertura total de eventualidades.
