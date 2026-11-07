# Entrega de SITREP para revisión independiente · 6 de noviembre de 2026

## Desde dónde continuar

La versión que hay que revisar **ya está publicada**. La revisión independiente se hace en preview antes de decidir el *siguiente* despliegue. La rama de entrega `codex/entrega-revision-sitrep-20261106` agrega documentación y evidencias sobre el merge de [PR #68](https://github.com/martinsantos/peliresi/pull/68). [Prompt para pasar a la otra IA](PROMPT.md).

| Referencia al cierre | Identidad |
|---|---|
| Producto activo en Hostinger | `1e87f12bf73923e88c7e6a9dd96e6c230b4ac079` |
| Base de esta entrega en main | `8b2c54a9735acd451ad5a264c6e1ed3d54e060b5` |
| Árbol Git de ambos commits | `5fe21b8b1380252b17b497e1a8a571c8d1af38e9` |
| Revisión activa inmediatamente anterior | `2632d26405397eab8cb2a225683d9b13670c1f9f` |

Al preparar esta entrega, `release.json` devolvió el SHA de producto y el endpoint público de salud devolvió `ok` con base conectada. El último despliegue conservó el esquema, las dependencias y los flags. CAP estaba cerrado y los envíos de correo y push estaban apagados en la verificación posterior al despliegue. El preflight inicial agotó el tiempo al conectar por SSH; el reintento oficial pasó. [CI de main](https://github.com/martinsantos/peliresi/actions/runs/42311381230) · [Preflight](https://github.com/martinsantos/peliresi/actions/runs/42311395602) · [Prepare](https://github.com/martinsantos/peliresi/actions/runs/42312397208) · [Publish](https://github.com/martinsantos/peliresi/actions/runs/42313679041) · [Recibo del paquete](evidencias/recibo-prepare.json).

## Trabajo acumulado y alcance de la evidencia

| Circuito | Qué quedó implementado o documentado | Qué revisar |
|---|---|---|
| Altas y ABM | Generador, transportista y operador. Alta con adjuntos, observación, corrección, aprobación, edición, desactivación/reactivación de actividad y revinculación verificada de correo. La factura eléctrica sigue opcional. Un sellado ATM pendiente permite aprobar el alta; la revisión y aplicación del pago son acciones distintas. OCR de ATM y ARCA con reintento y campos pendientes; prueba de factura artificial de la Cooperativa de Godoy Cruz para generador y operador. | Confirmar que un adjunto obligatorio rechazado bloquee la aprobación, que un reintento conserve la evidencia de duplicado y que la UI distinga error de lectura de falta de documento. La muestra de Godoy Cruz no cubre todas las distribuidoras. [Pruebas de altas](../../QA-ALTAS-E2E-20261105.md) · [OCR](../../QA-OCR-ALTAS-20261105.md) · [PR #64](https://github.com/martinsantos/peliresi/pull/64). |
| Identidad y navegación | Una razón social puede tener varias actividades. El cupo acordado es de dos personas en total. Inicio prioriza trabajo pendiente, el listado conserva historial y la agenda muestra programación. Los actores responden al requerimiento autorizado desde Avisos; la gestión de inspecciones corresponde al personal habilitado. | Comprobar por URL directa y por API el rol y alcance efectivos, además del menú; alternar roles y reabrir borradores con la misma cuenta. [Multirol y representantes](../../ABM-MULTIROL-REPRESENTANTES-20261022.md) · [Recorridos por rol](../../REFACTOR-ROLES-20261024.md). |
| Manifiestos, chofer y Monitor | Creación por cualquiera de las partes y aprobación de las tres en el circuito ordinario, incluyendo transportista aprobador en el caso in situ. Coordinación, retiro, GPS, viajes simultáneos, relevos y recepción. | Repetir pérdida de señal, reintento, traspaso y frescura del punto en Monitor; verificar que los permisos y los próximos pasos correspondan al actor. [Auditoría de aprobaciones](../../AUDITORIA-APROBACIONES-CORTE-20261030.md) · [GPS y posición antigua](../../GPS-ANTIGUO-20261102.md). |
| Adendas, certificados y comunicaciones | El operador documenta hallazgos al recibir, incluidos cambios de cantidad y corrientes Y omitidas. La rectificación aprobada conserva la observación original como antecedente. Para el certificado final, la corriente hallada debe estar tratada por completo. Hay avisos internos, plantillas y enlaces de web/app. | Distinguir aprobación de la adenda, tratamiento efectivo y emisión del certificado. Probar destinatarios y enlaces con buzón sumidero o render local, manteniendo bloqueado todo envío. [Adendas operativas](../../ADENDAS-OPERATIVAS-20261021.md) · [Certificados](../../CERTIFICADOS-OPERATIVOS-20261021.md) · [Espacios en PDF](https://github.com/martinsantos/peliresi/pull/66). |
| Inspecciones y PSIP | Visita en campo, ubicación, observaciones, fotos y reintento, revisión del acta, firma, requerimientos, respuestas y plazos. La jefatura evalúa antecedentes procedentes de eventuales, adendas y relevos y puede agendar una inspección. Un antecedente es un motivo para evaluar, no una infracción determinada. | Revisar identidad externa frente a actor de padrón, asignación por expediente, acceso por aviso y presentación posterior del inspeccionado. [PSIP](../../PSIP-FLUJO-INSPECCIONES-20261020.md) · [Hoja de campo](https://github.com/martinsantos/peliresi/pull/41) · [Fotos](https://github.com/martinsantos/peliresi/pull/56) · [Antecedentes y agenda](https://github.com/martinsantos/peliresi/pull/57). |

Las referencias anteriores documentan el trabajo acumulado. Las tandas recientes comprobaron los tramos que se detallan a continuación, primero en preview y después con un smoke del encabezado publicado. Una prueba histórica de un módulo por separado no acredita el circuito completo en el SHA de este corte.

## La cadena probada de punta a punta

1. En el preview aislado se crearon **seis eventuales**, tres por superficie, rotando quién inicia entre generador, transportista y operador. Cada caso tenía dos partes registradas que aprobaron y una externa declarada. Se registraron retiro, recepción y tratamiento. Al perder la respuesta después del guardado se reabrió la pantalla y se reintentó con el mismo identificador. La base confirmó una nota y una acción por reintento. Esta es la regla de Eventuales; la de tres aprobaciones aplica al manifiesto ordinario. [Reintento](https://github.com/martinsantos/peliresi/pull/65) · [Habilitación web/app](https://github.com/martinsantos/peliresi/pull/67).
2. El jefe vio un antecedente por parte externa. Agendó tres casos desde web y tres desde app. Los seis quedaron visibles en ambas agendas con una vinculación cada uno.
3. El inspector asignado abrió los seis desde la agenda, realizó 18 controles y preparó seis actas para lectura. Antes de la corrección, todas mostraban «Lugar sin responsable identificado» en el encabezado aunque la identidad figuraba en las observaciones.
4. Con la corrección se reemplazaron las observaciones completas. Se verificaron **doce aperturas** del acta (los mismos seis expedientes en ambas superficies), el nombre declarado, el enlace al eventual correcto, su estado Tratado, el regreso y el bloqueo al sustituir el ID por el de otro eventual. Las actas quedaron sin firmar. Pasaron 17 pruebas unitarias de campo y firma. [Resultados por expediente y superficie](evidencias/seis-casos-qa.json).
5. En producción se cargaron los archivos públicos de web y app y se simuló la sesión y la API dentro del navegador. El smoke verificó el encabezado con observaciones sin identidad, el enlace y el regreso. Hubo **cero llamadas a la API de negocio real** en ese recorrido. No equivale a un E2E autenticado contra expedientes reales. [Resultado](evidencias/smoke-publicado.json) · [Captura web](evidencias/acta-web.png) · [Captura app](evidencias/acta-app.png).

## Dónde mirar en el código

Desde la raíz del repo, seguir la cadena en este orden:

- `backend/src/services/inspectionIntake.service.ts` vincula origen y participante; `backend/src/controllers/inspeccion.controller.ts` abre el expediente y define el alcance del personal.
- `backend/src/domain/inspectionEventualOrigin.ts` selecciona identidad y origen por relación; `backend/src/domain/inspectionSignature.ts` los incorpora a la versión del acta preservando la verificación de copias históricas.
- `backend/src/controllers/inspectionSignature.controller.ts` y `backend/src/routes/inspeccion.routes.ts` sirven la vista del acta y la consulta autenticada `GET /api/inspecciones/:id/eventuales/:eventualId`. Revisar conjuntamente permisos sobre el expediente y pertenencia del eventual.
- `frontend/src-v6/pages/inspecciones/InspectionSignaturePanel.tsx` presenta el encabezado. `InspectionEventualPage.tsx` en ese directorio consulta el origen y permite volver. `App.tsx` y `AppMobile.tsx` registran las rutas de ambas superficies.
- `backend/src/services/inspectionFieldActPdf.service.ts` proyecta la parte declarada en el modelo compacto. Contrastar el PDF descargable con la pantalla y con una copia firmada en preview. El smoke de producción comprobó el enlace de pantalla.

## Revisión independiente del 7 de noviembre

[Informe de revisión](REVISION-20261107.md), en la rama `claude/revision-sitrep-20261107`, sin publicar. Se confirmó y corrigió en preview que vincular un antecedente eventual a un expediente que ya cerró la etapa de campo dejaba la firma del acta sin vigencia y sin posibilidad de volver a firmar. Desde esta rama, ese vínculo sólo se admite en BORRADOR, PLANIFICADA o EN_CAMPO. También se eliminó el oráculo 403/404 de la vista y la copia firmada para cuentas operativas. Quedan documentados, sin corregir, el regreso desde el eventual al bloque 1 de la hoja, los enlaces duplicados con dos externos y la falta de la parte externa en el PDF de expediente.

## Límites y pendientes para la próxima decisión

**Prioridad 1 — Trazabilidad y permisos.** Repetir con observaciones vacías y editadas, dos partes externas, varios antecedentes y un expediente sin origen eventual. Probar el inspector asignado, otro inspector, jefatura y un actor operativo intentando acceso directo. Verificar que denegar acceso tampoco filtre nombre o existencia del expediente. Revisar PDF previo, PDF firmado y verificación de una firma histórica.

**Prioridad 2 — Recuperación en campo.** Android físico sigue pendiente. Probar PWA instalada, sin conexión, cierre y reapertura, foto pendiente, guardado con sesión vencida y conflicto entre pestañas. Confirmar que el borrador permanezca aislado por usuario, razón social y rol. La prueba móvil del último corte fue Chromium a 393 × 852.

**Prioridad 3 — Comprensión y carga.** Sigue pendiente la ronda observada con al menos tres personas por rol operativo. Medir finalización sin ayuda, tiempo y facilidad por rol. Verificar por separado concurrencia de reintentos, manifiestos simultáneos y Monitor con datos artificiales; el conteo de seis casos no mide capacidad de carga.

**Entorno y entrega siguiente.** Trabajar en una rama propia sobre este corte. Usar el laboratorio aislado con base efímera, cuentas artificiales, CAP cerrado, correo/push apagados; QA pesada con un worker, 1 CPU y 2 GiB sin swap. Los ID del JSON pertenecen sólo al preview del ensayo. Si el laboratorio fue reciclado, recrear casos artificiales desde la interfaz. Preservar el checkout histórico y otros proyectos. El publicador vigente es `.github/workflows/hostinger-publication.yml`; una publicación futura requiere autorización sobre un nuevo SHA. El PR #9 estaba abierto y fuera de este corte al verificar GitHub.
