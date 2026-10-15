# Manifiestos V2 — backlog de la reunión del 14/10/2026

Estado: definición y candidato de desarrollo. **No autorizado para producción.**

Actualización: [alcance implementado de baja intensidad, adendas ordinarias y QA](QA-BAJA-INTENSIDAD-20261014.md). MV2-110/111 tienen candidato separado; el 15/10 se amplía MV2-401–406 con adendas post facto vinculadas al circuito ordinario, sin sobrescribirlo. QA cerrada en web/móvil/app y APK aislado (38714116108 SUCCESS); no publicada. Ver resultados y límites antes de considerar estos ítems cerrados: siguen pendientes matriz productiva de autoridad, documentos y compatibilidad. Los estados históricos más abajo no sustituyen ese corte.
Fuente: requisitos del usuario del 14/10, respuesta de Santiago/DGFA transmitida por el usuario y revisión del código activo.
La respuesta define requisitos de negocio; no sustituye una validación normativa ni un modelo documental aprobado.

## Actualización vigente — respuestas del usuario a los siete grupos

[Decisiones, pendientes residuales y pruebas de aceptación](DECISIONES-MANIFIESTOS-V2-20261014.md). Esta actualización prevalece sobre las condiciones anteriores de las etapas y tabla D01–D13 cuando difieran; no modifica la evidencia histórica de QA.

- **MV2-110/111/202:** variante «Manifiesto de baja intensidad», sin exigir aprobación de generador no inscripto; participantes externos explícitos, no cuentas/firmas ficticias. Falta precisar numeración oficial excepcional, no la posibilidad de registrar y continuar.
- **MV2-401–406:** continuar con diferencias y aprobación post facto o solicitud a autoridad; se sustituye la condición anterior de autorización PREVIA para continuar. Corrientes incompatibles/desconocidas quedan visibles para revisión, sin borrar hechos ni presentarlas como habilitadas. Continuidad operativa no equivale a conformidad documental.
- **MV2-303:** reprogramación sustentada en eventos validados modifica plazo. Vencido NO se revalida: se crea otro vinculado. Eliminar revalidación de escenarios futuros, conservar los históricos de QA.
- **MV2-103/D10:** al elegir transporte debe tener al menos un móvil; orientar elección por carga/Y y compatibilidad. Permitir sustitución con historial y aviso sin frenar circuito. La asignación opcional del candidato probado es una etapa previa, no implementación completa de esta nueva regla.
- **MV2-502/503:** PDF original del operador confirmado; rectificación mediante agregado, sin reemplazo destructivo.
- **MV2-302:** horarios configurables, recordatorios a primera hora y eventos en ventana; menos de 24 h permitido con conformidades aplicables.

**Estado de esa actualización documental del 14/10:** no contenía implementación ni nuevas pruebas. Los cortes posteriores de baja intensidad y adendas, con su evidencia y límites, están enlazados arriba. No producción, correos ni cambios sobre formulario humano.

## Aclaraciones recibidas de DGFA — 14/10

Estas respuestas sustituyen las hipótesis anteriores sobre plazos y emisor del certificado final:

1. Una vez pautado el retiro hay **30 días para hacerlo efectivo**. Si no se concreta, el manifiesto caduca; no se elimina. No es un plazo para terminar el tratamiento ni debe calcularse automáticamente desde la última aprobación.
2. Los **seis meses de acopio comienzan cuando el residuo llega al operador y éste lo acepta**. Es el plazo de acumulación previo al tratamiento, no desde la creación o aprobación del manifiesto.
3. En esa recepción se emite una **constancia de acopio**. No confundir el plazo de acopio con una autorización para seguir almacenando indefinidamente ni con la caducidad del documento como evidencia histórica.
4. Una vez tratado el residuo, **el operador emite el certificado de disposición final**. Esto corrige el pedido inicial que atribuía la emisión al generador. No hay un modelo único suministrado: los certificados los emiten los operadores.

Se mantienen pendientes las precisiones operativas de D05/D07/D08. No se cambian certificados ni estados de producción como consecuencia de esta aclaración.

## Ampliación del usuario — participantes externos y recepción con diferencias

- **Nueva feature prioritaria:** un operador debe poder registrar y realizar el circuito con un generador que todavía no está dado de alta en SITREP, y también registrar un transportista externo cuando corresponda. No se debe perder ni bloquear el registro del movimiento por esa ausencia. Se identifica a cada participante y se acumula información para seguimiento y regularización posterior.
- **Ampliación de adendas:** al recibir una carga diferente de lo declarado, permitir aprobación rápida o, bajo excepción explícita, registrar la diferencia y continuar con aprobación posterior. No sobrescribir el original ni registrar una aprobación ficticia. Las corrientes añadidas deben estar entre las posibilidades declaradas/admitidas para ese generador, además de los controles aplicables al transporte y operador.
- El alcance de «proceder» (recibir, acopiar, transportar o tratar) y la autoridad/plazo de aprobación posterior se cierran con DGFA. El requerimiento elimina el bloqueo indiscriminado de todos los agregados pendientes; no habilita silenciosamente cualquier carga ni cualquier etapa.

## Alcance y barreras

- No migrar producción, modificar manifiestos existentes, renumerar, enviar correo/push ni usar sesiones humanas.
- Pruebas con datos sintéticos nuevos en nube aislada; nunca una copia de la base real.
- No instalar Docker, navegadores ni emuladores Android en la Mac. Un worker y un proceso de pruebas por vez.
- Los cambios V2 requieren una versión explícita de circuito y un plan de compatibilidad antes de su activación. Los registros históricos conservan su circuito, número, firmas y documentos.
- Aprobar una cantidad o residuo no sustituye la habilitación para transportarlo o tratarlo.
- No confundir una prueba unitaria, una prueba HTTP, una interfaz con API simulada, una PWA y un APK Android. Cada evidencia se registra por separado.
- La ausencia de cuenta/alta en SITREP no demuestra por sí sola ausencia de inscripción o habilitación legal. Las estadísticas de regularización deben distinguir estos casos.

## Decisiones DGFA pendientes

Para la reunión: [preguntas agrupadas en siete temas, con lo ya confirmado separado](PREGUNTAS-DGFA-MANIFIESTOS-V2-20261014.md). Esta lista no fue enviada ni convierte decisiones pendientes en reglas activas.

| ID | Decisión que falta | Bloquea | Regla segura mientras tanto |
|---|---|---|---|
| D01 | Partes obligatorias por modalidad, empresa con varios roles, participantes sin cuenta y eventual intervención administrativa | Activar aprobación unánime | No atribuir aprobaciones a otro rol ni considerar aprobada a una parte porque no tiene cuenta |
| D02 | Borrador vs envío formal; qué cambios invalidan aprobaciones y quién puede corregir | Envío y revisión | Propuesta: guardar no avisa; enviar crea versión y pendientes. No implementada como decisión aprobada |
| D03 | Titular/ámbito de los rangos oficiales, formato, agotamiento, concurrencia y anulaciones | Asignar numeración V2 | Nunca consumir número en borrador ni reutilizar números anulados/vencidos en el nuevo circuito |
| D04 | Sustitución sólo de vehículo/chofer o también de empresa transportista; autoridad para efectuarla | Sustituciones posteriores | La tanda inicial sólo selecciona recursos al crear; no cambia viajes ni responsables existentes |
| D05 | Confirmado: 30 días para concretar el retiro una vez pautado. Precisar si el origen es el instante del acuerdo o la fecha de retiro acordada, cómputo/corte horario, efecto de reprogramar, revalidación e in situ | Vencimiento automático | No usar la fecha de unanimidad como sustituto del acuerdo ni vencer/bloquear manifiestos actuales |
| D06 | Quién aprueba adendas; continuidad de la parte original; residuos nuevos/incompatibles; rechazo parcial | Ejecutar adendas | No alterar lo aprobado; una continuación con agregado pendiente requiere la excepción trazable de D12, no aprobación implícita |
| D07 | Confirmado: seis meses desde llegada y aceptación por el operador, con constancia al recibir. Precisar meses calendario/corte, recepciones parciales, in situ, prórrogas y efecto operativo del vencimiento | Automatizar límite de acopio y sus efectos | Conservar fecha de llegada y de aceptación; no reiniciar el plazo por reemitir la constancia ni disponer residuos automáticamente |
| D08 | Confirmado: el OPERADOR emite disposición final después del tratamiento; no hay modelo único suministrado. Precisar incorporación del documento del operador, campos/firma/numeración/rectificación, parciales y momento del cierre | Nuevo cierre documental | Proponer carga del PDF emitido por operador con metadatos y trazabilidad; no inventar formato oficial ni exigir emisión/conformidad final del generador |
| D09 | Receptores, hora y canales del resumen diario; significado de «abiertos sin aviso»; reprogramaciones y aprobaciones con menos de 24 h | Activar recordatorios nuevos | Propuesta: pendientes de actuar, agrupados por destinatario, sin insistir a quien ya respondió |
| D10 | Obligatoriedad y momento de designar vehículo/chofer; habilitación/categorías/capacidad y vigencia a fecha de viaje | Exigir asignación y validar ejecución | Selección opcional, explícita, de recursos activos del transportista; no certifica por sí sola aptitud para una carga |
| D11 | Confirmado: el operador puede registrar el circuito con participantes sin alta. Precisar identidad/documentación mínima, delegados, ambos externos, firma o evidencia de conformidad, numeración, etapas permitidas y responsable de regularizar | Activar operación con actores sin alta en SITREP | Registrar identidad y condición por separado; no crear una cuenta ni una habilitación ficticia; no usar un actor genérico para todos |
| D12 | Aprobación posterior: autoridad para permitir continuidad, etapas alcanzadas, plazo, responsables, silencio/rechazo y efecto en cierre/certificados | Continuar una adenda antes de aprobarla | Guardar hecho, motivo, evidencia y decisión excepcional; mantener pendiente visible, no convertirlo en aprobado por tiempo transcurrido |
| D13 | Fuente verificable de corrientes admitidas del generador y criterio cuando falta/está vencida o el generador aún no tiene alta en SITREP | Elegibilidad del agregado y cruce con D11/D12 | No interpretar «sin datos» como «admite todo» ni añadir una corriente al padrón por haber llegado en una carga |

## Etapa 0 — contratos, aislamiento y compatibilidad (P0)

**MV2-001 / definición:** registrar lo confirmado y resolver los extremos pendientes de D01–D13; adjuntar acta y, si existen, ejemplos documentales de operadores. No exigir un modelo oficial que DGFA indicó que no tiene. No cerrar un punto por inferencia del implementador.

**MV2-002 / protección:** preparar fixtures separados (fijo, in situ, multirol, 2 móviles, 2 choferes, recurso ajeno/inactivo, rechazo, adenda, vencimiento, certificado, participante externo, identidad dudosa, corriente admitida/no admitida y autorización posterior). Datos identificados QA, usuarios exclusivos; envíos capturados localmente.

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

## Etapa 1B — participantes sin alta en SITREP (P0, nueva feature, D01/D03/D11/D13)

**MV2-110 / identificación externa:** desde el circuito del operador, registrar un generador y/o transportista aún no dado de alta en SITREP. Guardar identidad declarada y evidencia como participante del manifiesto; no omitirlo ni asociarlo a un comodín. La ausencia de transportista por modalidad in situ es diferente de un transportista externo.

**MV2-111 / continuidad trazable:** permitir el recorrido excepcional acordado con DGFA sin exigir crear primero una cuenta. Conservar quién registró, con qué rol, motivo, alcance autorizado y partes pendientes de regularizar/conformar. Integrar esta excepción con aprobación y numeración; no resolverla marcando automáticamente «unanimidad».

**MV2-112 / seguimiento:** bandeja restringida de participantes pendientes de regularizar, con movimientos, fechas, cantidades por residuo/unidad, operador que informó y enlaces a evidencia. Distinguir falta de cuenta, identidad pendiente de validar y falta de inscripción comprobada. Preparar exportación/seguimiento para DGFA; **no enviar intimaciones automáticamente** ni afirmar una infracción a partir de no encontrar una cuenta.

**MV2-113 / conciliación posterior:** cuando el participante se regulariza, vincular su ficha con los registros previos mediante revisión auditable. Conservar la identidad declarada originalmente, fechas, documentos y movimientos; no duplicar cantidades ni sobrescribir declaraciones históricas. Un CUIT dudoso queda pendiente, no se fusiona por parecido de nombre.

Criterios de aceptación:

- Se puede guardar el movimiento con identidad externa explícita; no aparece una cuenta habilitada ni un correo automático como efecto lateral.
- Los campos mínimos acordados permiten saber quién entregó/transportó y quién lo declaró. No se acepta una persona jurídica anónima por dejar vacío un selector.
- Un CUIT válido coincidente propone reutilizar/vincular, sin duplicar automáticamente; identidad dudosa o conflicto se conserva para revisión.
- Participante externo ≠ autorizado para cualquier residuo. Los controles D13 y las habilitaciones aplicables no desaparecen.
- Los avisos y la bandeja separan operación, conformidad pendiente y regularización. Sólo los roles autorizados ven los datos necesarios.
- Las estadísticas incluyen la operación una sola vez, antes y después de la vinculación, sin sumar kg con litros ni adjudicar toda la actividad a un actor genérico.

Pruebas: generador externo/transportista inscripto; inverso; ambos externos según D11; empresa ya existente sin cuenta; CUIT inválido/dudoso/duplicado; dos altas simultáneas de la misma identidad; rechazo de asociación ajena; regularización y deshacer una vinculación equivocada conservando historial; exportación y permisos; reintento offline sin duplicado. E2E en escritorio, web móvil, PWA y APK QA aislado, con fixtures exclusivamente sintéticos.

## Etapa 2 — aprobación conjunta y numeración (P0, D01–D03)

**MV2-201:** referencia interna legible y versión de declaración; separar guardar de enviar según D02.

**MV2-202:** bandeja por parte con aprobar/observar/rechazar, motivo, actor, rol, versión y fecha. La creación no equivale tácitamente a la aprobación del creador. La excepción de participante externo usa el circuito que acuerde D11; no simula una sesión, firma ni aprobación del ausente.

**MV2-203:** al completar la unanimidad, asignar exactamente un número del rango válido y habilitar ejecución/programación. Una transacción debe impedir duplicados entre procesos, reintentos y dos últimas aprobaciones concurrentes.

Criterios:

- En el circuito ordinario, antes de unanimidad sólo existe referencia interna y no se consume número oficial. La numeración del circuito excepcional sin cuenta queda expresamente pendiente D03/D11; no se implementa una unanimidad ficticia para sortearlo.
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

**MV2-404 / aprobación rápida:** presentar al responsable una comparación breve de declarado/recibido/agregado, con cantidades, unidades, evidencia y corrientes elegibles. Aprobar u observar esa versión desde web/app con sesión válida; sin volver a completar el manifiesto ni aprobar por tocar un enlace de aviso.

**MV2-405 / continuidad con aprobación posterior:** registrar la diferencia y permitir las acciones expresamente autorizadas por D12. Mostrar simultáneamente «hecho registrado» y «adenda pendiente de aprobación», con motivo, responsable y vencimiento de revisión. El hecho físico no se borra si la adenda es luego rechazada. No retrofechar firmas ni presentar como aprobada una carga pendiente.

**MV2-406 / elegibilidad por generador:** comprobar cada corriente agregada contra la fuente acordada en D13 y guardar la evidencia/versión usada. Si no está admitida o no hay datos confiables, registrar la discrepancia y escalar; no habilitar la vía abreviada/posterior por defecto. También comprobar compatibilidad del operador/transportista. Las alternativas de gestión de un residuo no admitido las define DGFA.

Criterios:

- Original y medición de recepción permanecen separados; discrepancia de cantidad no se confunde con incorporación de otra corriente.
- Continuar una operación no equivale a aprobar documentalmente su adenda. La UI nunca muestra «todo aprobado» mientras quede pendiente.
- Sólo la autoridad definida por DGFA concede la excepción y sólo para las etapas permitidas. La excepción tiene motivo, evidencia y plazo verificables.
- Un agregado fuera de las corrientes admitidas del generador no pasa por aprobación rápida/posterior automática; queda registrado para actuación expresa.
- Avisar al aprobador y escalar pendientes no envía correos reales durante QA. Aprobaciones de versiones anteriores no autorizan nuevos agregados.
- Cantidades declaradas, recibidas, agregadas pendientes, aprobadas y tratadas quedan conciliables sin doble conteo; rechazo posterior conserva lo ocurrido y exige resolución explícita.
- Cierre/certificado con diferencias pendientes sólo según política D12/D08, nunca por omisión de un control.

Pruebas: excedente/faltante; corriente adicional admitida/no admitida/desconocida; generador externo sin evidencia de corrientes; unidades incompatibles; operador no habilitado; aprobación inmediata; autorización de continuidad y aprobación posterior; excepción por rol no autorizado; plazo vencido/silencio/rechazo posterior; adendas simultáneas y cambio de versión; tratamiento parcial según D06/D12; totales/PDF/auditoría consistentes. En las cuatro superficies, probar red lenta, sesión vencida y doble pulsación sin falsas confirmaciones.

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
9. Operador registra movimiento con participante externo → operación excepcional autorizada → bandeja de regularización → vinculación posterior sin pérdida de origen ni duplicación estadística.
10. Recepción con diferencia elegible → aprobación rápida o continuidad excepcional → aprobación posterior/rechazo → conciliación documental; repetir con corriente no admitida y verificar que no se habilita esa vía.

Salida: unit + integración HTTP/DB + E2E web/móvil/PWA + Android nativo, capturas revisadas, cero errores críticos abiertos, decisiones DGFA firmadas y plan de rollback/migración verificado. **Publicación requiere autorización separada.**

## Registro de ejecución

- 14/10: backlog creado. Inicio MV2-101/102 en candidato; todas las demás etapas siguen pendientes. Evidencias y límites se actualizan al terminar la tanda, sin adjudicar pruebas inexistentes.
- 14/10: incorporada respuesta de Santiago/DGFA: retiro efectivo dentro de 30 días de pautarlo; seis meses desde llegada y aceptación; constancia de acopio; disposición final emitida por OPERADOR tras tratamiento, sin modelo único suministrado. No se modificó producción ni se adelantaron reglas automáticas pendientes.
- 14/10: agregadas MV2-110–113 (participantes sin alta, continuidad, seguimiento y conciliación) y MV2-404–406 (aprobación rápida/posterior y elegibilidad de corrientes del generador). Son backlog, no funcionalidades implementadas. La regla previa de bloquear todo agregado pendiente queda sustituida por la distinción normal/excepcional sujeta a D12.

### Cierre del primer candidato — MV2-101/102

Rama `codex/sitrep-manifiestos-v2-20261014`, candidato runtime `dc4a16ca630c55c5e338981bb9ba9bc319c22e7b`.
[Corrida aislada 38619721497](https://github.com/martinsantos/peliresi/actions/runs/38619721497): **SUCCESS**, 14/10/2026. No es un despliegue.

| Comprobación ejecutada | Resultado | Límite |
|---|---|---|
| Build backend, web y `/app` | PASS | Candidato, no URL productiva |
| Unit backend | 976/976; 0 omitidas | DB desconectada y proveedores simulados |
| Unit frontend | 1426/1426; 0 omitidas | No sustituye navegador ni dispositivo |
| HTTP con PostgreSQL sintético | 5 grupos PASS: selección exacta/antifalsificación; recursos ajenos/inactivos/ausentes/in situ/rol indebido; compatibilidad opcional; snapshot/PDF/permisos; cambio de empresa con historial | Nuevas operaciones sintéticas; no producción |
| E2E escritorio1440 + web móvil360 + `/app`390 | 12/12, 0 omitidas, 0 flaky | Selección, limpieza, persistencia, PDF y circuito por roles vigente; no aprobación V2 ni excepciones nuevas |
| Preservación histórica sintética | JSON antes/después idéntico, incluidos residuos/eventos | Un fixture de control; no reemplaza prueba futura de migración |
| Revisión visual | Selectores en las tres superficies, detalle móvil/PWA, vista transportista y dos renders PDF revisados; etiquetas vehículo/chofer alineadas en PDF real | Captura del detalle desktop no contiene todos sus valores; sí hay aserciones de persistencia. Falta ampliar evidencia visual de ese detalle |

Evidencias: artefacto `sitrep-manifest-v2-38619721497` (3,9 MB comprimido); copia local en `sitrep-cloud-qa-20261002/manifiestos-v2-38619721497/`, fuera del repositorio de producto. Incluye `backend-unit.json`, `frontend-unit.json`, `manifest-http.json`, `manifest-e2e.json`, `manifest-history-proof.json`, capturas y PDFs sintéticos. Procesos propios terminados al cerrar la VM.

Fallos previos conservados: dependencia Poppler ausente en VM (`38616610538`); fixture antiguo del avisador sin router y contrato de servicio desactualizado (`38617143159`); tipado de flota del catálogo detectado por build (`38618481035`). Corregidos sin excluir tests ni rebajar expectativas; build adelantado para detectar errores de tipos antes de la suite larga.

**No GO de Manifiestos V2 completo ni de APK:** restan decisiones DGFA, implementación de las demás etapas, variante Android aislada, prueba de migración/rollback aditiva y evidencia visual ampliada. En las capturas móviles se observa proximidad/superposición parcial de la burbuja de ayuda con controles inferiores: revisar espacio reservado antes de certificar UI global. No se ha afirmado ausencia de todos los defectos de interfaz.

Siguiente lote: resolver D01/D03/D11/D12/D13 de forma conjunta antes de conectar las excepciones de participantes externos y aprobación posterior a la numeración/cierre. Para MV2-101/102, completar la evidencia visual desktop y Android QA sin apuntar a producción. No modificar aún manifiestos existentes ni publicar el candidato.

### Cierre ampliado — APK aislado y compatibilidad, 14/10

**Validación de QA cerrada para MV2-101/102 y el circuito vigente. No GO de Manifiestos V2 completo ni autorización de publicación.**

Candidato `a63f699cb32ca919fd09f455a0bc9d500426edc6`.
[Corrida 38644241339](https://github.com/martinsantos/peliresi/actions/runs/38644241339): **SUCCESS**, duración 12m32s. Sustituye los pendientes técnicos de Android, evidencia desktop y migración sintética del primer corte; no sustituye decisiones DGFA.

| Comprobación | Resultado comprobado |
|---|---|
| Builds backend, web y app | PASS |
| Unit backend / frontend | 976/976 (88 archivos) + 1432/1432 (194 archivos); cero fallos u omitidas |
| Integración HTTP con PostgreSQL sintético | 5 grupos PASS: asignación, antifalsificación, pertenencia/actividad/permisos, compatibilidad, PDF e historial |
| E2E escritorio1440, web móvil360 y app390 | 12/12, cero fallos, omitidos o flaky; backend real de QA |
| Migración aditiva | Columna JSONB nullable sobre esquema anterior vacío+sintético; histórico idéntico, cliente Prisma anterior sigue leyendo/escribiendo, snapshots nuevos preservados |
| APK instalado en Android15 | Login real de ADMIN/GENERADOR/TRANSPORTISTA/OPERADOR; teclado nativo; selección del segundo móvil/chofer; persistencia; reapertura del proceso SITREP con sesión; firma, retiro, entrega, recepción, tratamiento y cierre |
| PDF y salida en Android | Archivo real de 3091 bytes en Downloads idéntico al de la API; visor nativo abre; volver retorna a SITREP; logout deniega ruta protegida |
| Aislamiento y cierre | Cero errores JS o intentos de solicitud a producción registrados; todas las mutaciones del recorrido200/201; histórico sintético de control idéntico; backend/server/PG/emulador cerrados |

**Corrección visual:** la ayuda flotante tapaba fecha/Confirmar retiro en capturas nativas. Se movió al encabezado sólo para nuevo/detalle de manifiesto y viaje, reutilizando el patrón de inspecciones; no se quitaron funciones. Seis unitarias nuevas y comprobaciones de título/ayuda única en E2E/Android. Revisadas capturas desktop con valores completos, selección móvil, transporte Android con acción descubierta, certificado, retorno y login final. No es una auditoría visual global.

**Identidad y límites del APK:** paquete separado `ar.com.ultimamilla.sitrep.manifestqa`, código4, firma debug verificada, destino exclusivo `http://127.0.0.1:4177/app/`. No usa ni modifica el APK instalado del usuario. Prueba en Custom Tab de QA sin falsificar confianza TWA; Chrome124.0.6367.219 y GMS24.23.35 estables en la imagen Android15. No certifica actualización firmada del APK original, otros navegadores/visores, reinicio completo de Chrome/OS, teléfonos físicos, cámara/GPS/batería/celular ni cambio de idioma del sistema. La fecha nativa sigue la configuración de la VM. La firma original continúa pendiente.

La compatibilidad anterior está demostrada a nivel de esquema/cliente Prisma; **no equivale a ensayo completo de despliegue/rollback del backend anterior**. La migración no fue aplicada a producción y no se ejecutó un down destructivo. El PDF probado es el vigente, no un nuevo formato oficial validado por DGFA.

Fallos conservados: 38628501638 intentó logout con el visor PDF delante; 38630752906 esperaba un rótulo de firma distinto del emitido por el SDK; 38641881433 intentó screenshot de Chromium detrás del visor nativo. Se corrigió la automatización según evidencia: firma válida debug única con huella completa (3 pruebas puras), captura del visor en superficie nativa, archivo exacto y retorno observado antes de logout. No se ocultaron fallos con retries ni se relajaron las comprobaciones.

Evidencias en artefacto `sitrep-manifest-v2-38644241339`, copia local `sitrep-cloud-qa-20261002/manifiestos-v2-38644241339/` (9,1MB, fuera de Git). PSS final de Chrome en VM102537KiB/RSS211032KiB: sólo una muestra final, no pico ni prueba de ausencia de fugas. Sin instalaciones, navegador o emulador locales; cierre de runtime6356/server6357 a22:10:30.649UTC y cleanup del job PASS. Queda aviso técnico no bloqueante de actualización futura de versiones de Actions, sin error en esta corrida.

**Siguiente decisión:** responder los [siete grupos para DGFA](PREGUNTAS-DGFA-MANIFIESTOS-V2-20261014.md), especialmente D01/D03/D11/D12/D13. Participantes externos, aprobación conjunta/posterior, numeración nueva, agenda/vencimientos, sustitución durante viaje y certificados V2 siguen sin activar. Producción, manifiestos reales, correos y formulario humano no fueron tocados.
