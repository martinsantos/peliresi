# Manifiestos V2 — backlog de la reunión del 14/10/2026

Estado: definición y candidato de desarrollo. **No autorizado para producción.**
Fuente: requisitos del usuario del 14/10, respuesta de Santiago/DGFA transmitida por el usuario y revisión del código activo.
La respuesta define requisitos de negocio; no sustituye una validación normativa ni un modelo documental aprobado.

## Aclaraciones recibidas de DGFA — 14/10

Estas respuestas sustituyen las hipótesis anteriores sobre plazos y emisor del certificado final:

1. Una vez pautado el retiro hay **30 días para hacerlo efectivo**. Si no se concreta, el manifiesto caduca; no se elimina. No es un plazo para terminar el tratamiento ni debe calcularse automáticamente desde la última aprobación.
2. Los **seis meses de acopio comienzan cuando el residuo llega al operador y éste lo acepta**. Es el plazo de acumulación previo al tratamiento, no desde la creación o aprobación del manifiesto.
3. En esa recepción se emite una **constancia de acopio**. No confundir el plazo de acopio con una autorización para seguir almacenando indefinidamente ni con la caducidad del documento como evidencia histórica.
4. Una vez tratado el residuo, **el operador emite el certificado de disposición final**. Esto corrige el pedido inicial que atribuía la emisión al generador. No hay un modelo único suministrado: los certificados los emiten los operadores.

Se mantienen pendientes las precisiones operativas de D05/D07/D08. No se cambian certificados ni estados de producción como consecuencia de esta aclaración.

## Alcance y barreras

- No migrar producción, modificar manifiestos existentes, renumerar, enviar correo/push ni usar sesiones humanas.
- Pruebas con datos sintéticos nuevos en nube aislada; nunca una copia de la base real.
- No instalar Docker, navegadores ni emuladores Android en la Mac. Un worker y un proceso de pruebas por vez.
- Los cambios V2 requieren una versión explícita de circuito y un plan de compatibilidad antes de su activación. Los registros históricos conservan su circuito, número, firmas y documentos.
- Aprobar una cantidad o residuo no sustituye la habilitación para transportarlo o tratarlo.
- No confundir una prueba unitaria, una prueba HTTP, una interfaz con API simulada, una PWA y un APK Android. Cada evidencia se registra por separado.

## Decisiones DGFA pendientes

| ID | Decisión que falta | Bloquea | Regla segura mientras tanto |
|---|---|---|---|
| D01 | Partes obligatorias por modalidad, empresa con varios roles y eventual intervención administrativa | Activar aprobación unánime | No atribuir aprobaciones a otro rol ni permitir excepciones por suposición |
| D02 | Borrador vs envío formal; qué cambios invalidan aprobaciones y quién puede corregir | Envío y revisión | Propuesta: guardar no avisa; enviar crea versión y pendientes. No implementada como decisión aprobada |
| D03 | Titular/ámbito de los rangos oficiales, formato, agotamiento, concurrencia y anulaciones | Asignar numeración V2 | Nunca consumir número en borrador ni reutilizar números anulados/vencidos en el nuevo circuito |
| D04 | Sustitución sólo de vehículo/chofer o también de empresa transportista; autoridad para efectuarla | Sustituciones posteriores | La tanda inicial sólo selecciona recursos al crear; no cambia viajes ni responsables existentes |
| D05 | Confirmado: 30 días para concretar el retiro una vez pautado. Precisar si el origen es el instante del acuerdo o la fecha de retiro acordada, cómputo/corte horario, efecto de reprogramar, revalidación e in situ | Vencimiento automático | No usar la fecha de unanimidad como sustituto del acuerdo ni vencer/bloquear manifiestos actuales |
| D06 | Quién aprueba adendas; continuidad de la parte original; residuos nuevos/incompatibles; rechazo parcial | Ejecutar adendas | No alterar lo aprobado ni permitir tratar un agregado pendiente |
| D07 | Confirmado: seis meses desde llegada y aceptación por el operador, con constancia al recibir. Precisar meses calendario/corte, recepciones parciales, in situ, prórrogas y efecto operativo del vencimiento | Automatizar límite de acopio y sus efectos | Conservar fecha de llegada y de aceptación; no reiniciar el plazo por reemitir la constancia ni disponer residuos automáticamente |
| D08 | Confirmado: el OPERADOR emite disposición final después del tratamiento; no hay modelo único suministrado. Precisar incorporación del documento del operador, campos/firma/numeración/rectificación, parciales y momento del cierre | Nuevo cierre documental | Proponer carga del PDF emitido por operador con metadatos y trazabilidad; no inventar formato oficial ni exigir emisión/conformidad final del generador |
| D09 | Receptores, hora y canales del resumen diario; significado de «abiertos sin aviso»; reprogramaciones y aprobaciones con menos de 24 h | Activar recordatorios nuevos | Propuesta: pendientes de actuar, agrupados por destinatario, sin insistir a quien ya respondió |
| D10 | Obligatoriedad y momento de designar vehículo/chofer; habilitación/categorías/capacidad y vigencia a fecha de viaje | Exigir asignación y validar ejecución | Selección opcional, explícita, de recursos activos del transportista; no certifica por sí sola aptitud para una carga |

## Etapa 0 — contratos, aislamiento y compatibilidad (P0)

**MV2-001 / definición:** registrar lo confirmado y resolver los extremos pendientes de D01–D10; adjuntar acta y, si existen, ejemplos documentales de operadores. No exigir un modelo oficial que DGFA indicó que no tiene. No cerrar un punto por inferencia del implementador.

**MV2-002 / protección:** preparar fixtures separados (fijo, in situ, multirol, 2 móviles, 2 choferes, recurso ajeno/inactivo, rechazo, adenda, vencimiento y certificado). Datos identificados QA, usuarios exclusivos; envíos capturados localmente.

Criterios:

- El inventario/hash de manifiestos históricos permanece idéntico antes/después de cada integración.
- No se requieren secretos productivos ni llamadas a dominios productivos.
- Migraciones futuras aditivas probadas sobre esquema anterior sintético, sin backfill de decisiones, firmas o numeración.
- No hay secretos/datos personales reales en capturas o artefactos.

Pruebas: guardas de entorno/DB; compatibilidad legacy; rechazo de host/puerto/base/credenciales equivocadas; prueba de migración sintética y recuperación.

## Etapa 1 — asignación explícita de transporte (P0, parcialmente definida)

**MV2-101 / feature:** seleccionar vehículo y chofer al crear un manifiesto nuevo.

Criterios:

- Web, web móvil y `/app` usan el mismo contrato y muestran sólo recursos activos de la empresa elegida.
- Ningún recurso queda seleccionado por defecto. La elección es opcional hasta D10.
- Cambiar transportista o modalidad a in situ limpia ambas selecciones, sin borrar residuos ni otros campos.
- El servidor rechaza identificadores inexistentes, ajenos o inactivos, aunque se manipule la petición.
- In situ no acepta vehículo/chofer. Sin elección no se inventa asignación.
- Se conserva una instantánea de los datos elegidos, con sus identificadores, independiente de modificaciones posteriores del padrón.
- Fallos de red/validación conservan el formulario; doble pulsación no duplica el envío desde la UI.

**MV2-102 / corrección:** PDF y detalle usan la asignación del manifiesto, nunca el primer móvil/chofer del padrón. En históricos sin asignación: «Sin asignación registrada», sin completar retrospectivamente.

Pruebas: unitarias de validación y snapshot; HTTP creación/consulta/PDF con datos reales sintéticos; selección del segundo móvil/chofer; cambio de empresa; in situ; ausencia de flota; error de envío y reintento; PDF estable al editar padrón. Ejecutar en las cuatro superficies de la matriz.

**MV2-103 / feature pendiente D04/D10:** sustitución durante la operación, motivo obligatorio, trazabilidad de tramos, aviso a partes, sin reaprobar la carga dentro del alcance autorizado. No incluida en MV2-101.

## Etapa 2 — aprobación conjunta y numeración (P0, D01–D03)

**MV2-201:** referencia interna legible y versión de declaración; separar guardar de enviar según D02.

**MV2-202:** bandeja por parte con aprobar/observar/rechazar, motivo, actor, rol, versión y fecha. La creación no equivale tácitamente a la aprobación del creador.

**MV2-203:** al completar la unanimidad, asignar exactamente un número del rango válido y habilitar ejecución/programación. Una transacción debe impedir duplicados entre procesos, reintentos y dos últimas aprobaciones concurrentes.

Criterios:

- Antes de unanimidad sólo existe referencia interna y no se consume número oficial.
- Una parte no puede aprobar por otra ni aprobar una versión obsoleta.
- Rechazar/observar avisa al autor; ningún cambio borra decisiones anteriores.
- Rango agotado: no emitir número inventado ni dejar estado aprobado ejecutable a medias.
- Error al avisar no deshace la aprobación ni consume otro número; el aviso queda pendiente reintentable.
- Los manifiestos actuales siguen funcionando sin renumeración ni exigencias retroactivas.

Pruebas: todos los órdenes de aprobación; multirol/in situ según D01; doble clic; peticiones concurrentes reales contra PostgreSQL; rollback; rango agotado; autorización de otro actor; versión vieja; pérdida de conexión tras confirmación; QR/PDF antes y después del número; regreso desde aviso después de login.

## Etapa 3 — agenda y vencimiento (P1, D05/D09)

**MV2-301:** agenda con fecha tentativa y aprobada, filtros por pendiente/actor/fecha; mismo registro que lista, mapa e indicadores.

**MV2-302:** aviso 24 h antes, reprogramación/cancelación y resumen diario de pendientes. Dedupe por evento/versión/destinatario, no sólo por manifiesto. Reprogramar debe permitir un nuevo aviso válido.

**MV2-303:** plazo de 30 días para concretar el retiro una vez pautado, conforme la respuesta de DGFA. Registrar por separado el momento del acuerdo, la fecha de retiro pactada y el retiro efectivo; precisar el origen exacto del cómputo con D05. Vencido se conserva y su número no se reutiliza. No se calcula desde unanimidad ni se extiende a tratamiento. Definir recuperación/revalidación con D05.

Criterios: sin duplicados al reiniciar workers; no recordar cancelados o ya atendidos; mostrar zona Mendoza; no confundir falta de datos con cero pendientes; no aplicar caducidad pre-ejecución a cargas que ya están circulando sin regla aprobada.

Pruebas: reloj controlado en bordes de día/mes/año; aprobación y acuerdo en fechas distintas; retiro dentro/fuera del plazo; retiro concretado que no caduca por este límite aunque siga en tratamiento; menos de 24 h; reprogramar dos veces; dos workers; reinicio; destinatario sin acceso; diferencias agenda/lista/mapa; sin red; vencimiento y revalidación con D05.

## Etapa 4 — adendas (P1, D06)

**MV2-401:** transportista/operador propone discrepancia con evidencia; adenda vinculada, referencia propia sin reemplazar el original.

**MV2-402:** aprobaciones de la adenda, rechazo/observaciones y control de habilitaciones. La parte original y el agregado tienen decisiones visibles y separadas.

**MV2-403:** cantidades, tratamiento y PDF reflejan original más adendas aprobadas, sin sumar dos veces ni perder unidades.

Criterios: original inmutable; rechazo no borra evidencia; no se trata un agregado pendiente; no se convierte una diferencia de peso en autorización automática de otro residuo.

Pruebas: excedente/faltante, residuo adicional, unidad incompatible, operador no habilitado, adendas simultáneas, cambios durante aprobación, tratamiento parcial según D06, totales/PDF/auditoría consistentes.

## Etapa 5 — certificados y cierre (P1, D07/D08)

**MV2-501:** llegada y recepción aceptada por el operador originan la constancia de acopio y el plazo de seis meses. Registrar el hito una sola vez y vincular su documento verificable/versionado. Completar el cómputo y efectos operativos conforme D07; una reemisión documental no reinicia el acopio.

**MV2-502:** después del tratamiento, el OPERADOR emite el certificado de disposición final. Incorporarlo al manifiesto y avisar al generador y transportista para descargarlo. El generador no es emisor. Propuesta pendiente D08: adjuntar el documento original del operador, registrar emisor/referencia/fecha y preservar versiones; no generar un supuesto modelo oficial ni convertir un pago externo en condición automática no confirmada.

**MV2-503:** documentos originales descargables sin alterar sus bytes, control de acceso, integridad y rectificación. Firma/QR/formato común sólo según lo acordado en D08. No regenerar un documento histórico con datos actuales del padrón.

Criterios: no emitir antes del hito; no permitir a un rol incorrecto; reintentar no duplica certificado; vigencia de acopio no borra existencia de residuos; no cerrar con adendas o cantidades pendientes sin política aprobada.

Pruebas: llegada/aceptación distintas de creación/aprobación; seis meses y fines de mes según D07; parciales; in situ; doble emisión/reemisión sin reinicio de plazo; disposición final antes de tratamiento denegada; intento de emisión por generador/transportista denegado; acceso del generador y transportista vinculados; cambio posterior de datos; permiso ajeno; PDF abierto/descargado en web y Android; aviso con sesión caducada; integridad del documento original.

## Etapa 6 — aceptación integral y preparación de publicación (P0 de salida)

El GO es **por etapa y superficie**, no por cantidad de tests. Una feature bloqueada por DGFA no figura como implementada ni como aprobada por pasar una suite antigua.

| Superficie | Entorno | Evidencia mínima obligatoria |
|---|---|---|
| Web escritorio | Chromium, 1440 px, nube | Recorrido por roles, teclado/foco, permisos, contenido persistido, descarga PDF, consola y captura |
| Web móvil | Navegador responsive 360/390 px, nube | Mismo circuito, targets táctiles, sin overflow, teclado/errores, navegación y sesión |
| App web/PWA | Build `/app`, nube | Rutas/base correctas, mismo backend, entrada/reapertura, sesión, fallo de red, PDF y navegación propia |
| APK Android | Emulador Android en nube, candidato de QA apuntando sólo a backend sintético | Identidad del paquete y firma documentadas, login por roles, teclado nativo, volver/reabrir, descarga y permisos |
| Teléfonos físicos | Jornada supervisada cuando esté disponible | Teclados/fabricantes, cámara/GPS reales, batería/celular y archivos. No sustituir por viewport responsive |

El APK instalado apunta a producción: **no sirve para probar estas escrituras nuevas**. Preparar variante QA aislada o infraestructura de prueba explícitamente autorizada, sin modificar/reinstalar el APK humano ni pedir secretos productivos. La firma original pendiente no se resuelve forzando una actualización.

Escenarios transversales obligatorios:

1. Generador prepara → involucrados aprueban → número → agenda → retiro → recepción → acopio → tratamiento → cierre documental.
2. Rechazo → corrección → reaprobación sin usar aprobaciones de versión anterior.
3. Avería y sustitución permitida, historial y avisos correctos.
4. Discrepancia en retiro y en recepción → adenda → decisión → totales correctos.
5. Vencimiento sin borrar ni reciclar número; acopio vencido sin pérdida de trazabilidad.
6. Dos usuarios simultáneos, doble envío, sesión expirada, red interrumpida y recuperación sin falsas confirmaciones.
7. Actor ajeno, cambio de rol, CAP/operativo separados, notificaciones sin filtración de datos.
8. Antes/después: manifiestos y documentos legacy conservados.

Salida: unit + integración HTTP/DB + E2E web/móvil/PWA + Android nativo, capturas revisadas, cero errores críticos abiertos, decisiones DGFA firmadas y plan de rollback/migración verificado. **Publicación requiere autorización separada.**

## Registro de ejecución

- 14/10: backlog creado. Inicio MV2-101/102 en candidato; todas las demás etapas siguen pendientes. Evidencias y límites se actualizan al terminar la tanda, sin adjudicar pruebas inexistentes.
- 14/10: incorporada respuesta de Santiago/DGFA: retiro efectivo dentro de 30 días de pautarlo; seis meses desde llegada y aceptación; constancia de acopio; disposición final emitida por OPERADOR tras tratamiento, sin modelo único suministrado. No se modificó producción ni se adelantaron reglas automáticas pendientes.
