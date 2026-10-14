# Manifiestos V2 — backlog de la reunión del 14/10/2026

Estado: definición y candidato de desarrollo. **No autorizado para producción.**
Fuente: requisitos del usuario del 14/10 y revisión del código activo.
No se presentan los plazos ni certificados como normativa verificada por DGFA.

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
| D05 | 30 días: iniciar retiro o completar; días corridos y corte horario; revalidación; in situ | Vencimiento automático | No vencer ni bloquear manifiestos actuales |
| D06 | Quién aprueba adendas; continuidad de la parte original; residuos nuevos/incompatibles; rechazo parcial | Ejecutar adendas | No alterar lo aprobado ni permitir tratar un agregado pendiente |
| D07 | Acopio: seis meses calendario, fecha inicial, parciales, in situ, prórrogas, efectos del vencimiento | Emitir/vencer acopio | No inventar vencimientos ni disponer residuos automáticamente |
| D08 | Modelo oficial y acto del generador: emitir disposición final o dar conformidad al certificado del operador; firma, numeración, rectificación | Nuevo cierre y certificados | Conservar expresamente el pedido de cierre manual por GENERADOR, sin sustituirlo por una interpretación técnica |
| D09 | Receptores, hora y canales del resumen diario; significado de «abiertos sin aviso»; reprogramaciones y aprobaciones con menos de 24 h | Activar recordatorios nuevos | Propuesta: pendientes de actuar, agrupados por destinatario, sin insistir a quien ya respondió |
| D10 | Obligatoriedad y momento de designar vehículo/chofer; habilitación/categorías/capacidad y vigencia a fecha de viaje | Exigir asignación y validar ejecución | Selección opcional, explícita, de recursos activos del transportista; no certifica por sí sola aptitud para una carga |

## Etapa 0 — contratos, aislamiento y compatibilidad (P0)

**MV2-001 / definición:** aprobar D01–D10, adjuntar acta/modelos oficiales, registrar responsable y fecha. No cerrar un punto por inferencia del implementador.

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

**MV2-303:** plazo de 30 días desde unanimidad; vencido se conserva y su número no se reutiliza. Definir recuperación/revalidación con D05.

Criterios: sin duplicados al reiniciar workers; no recordar cancelados o ya atendidos; mostrar zona Mendoza; no confundir falta de datos con cero pendientes; no aplicar caducidad pre-ejecución a cargas que ya están circulando sin regla aprobada.

Pruebas: reloj controlado en bordes de día/mes/año; menos de 24 h; reprogramar dos veces; dos workers; reinicio; destinatario sin acceso; diferencias agenda/lista/mapa; sin red; vencimiento y revalidación con D05.

## Etapa 4 — adendas (P1, D06)

**MV2-401:** transportista/operador propone discrepancia con evidencia; adenda vinculada, referencia propia sin reemplazar el original.

**MV2-402:** aprobaciones de la adenda, rechazo/observaciones y control de habilitaciones. La parte original y el agregado tienen decisiones visibles y separadas.

**MV2-403:** cantidades, tratamiento y PDF reflejan original más adendas aprobadas, sin sumar dos veces ni perder unidades.

Criterios: original inmutable; rechazo no borra evidencia; no se trata un agregado pendiente; no se convierte una diferencia de peso en autorización automática de otro residuo.

Pruebas: excedente/faltante, residuo adicional, unidad incompatible, operador no habilitado, adendas simultáneas, cambios durante aprobación, tratamiento parcial según D06, totales/PDF/auditoría consistentes.

## Etapa 5 — certificados y cierre (P1, D07/D08)

**MV2-501:** recepción aceptada habilita emisión de acopio transitorio, archivo verificable/versionado y fecha de vencimiento conforme D07.

**MV2-502:** distinguir tratamiento finalizado por operador del acto final manual del generador conforme D08; avisar a operador y transportista para descargar.

**MV2-503:** documentos originales reproducibles, control de acceso, firma/QR/rectificación según modelos oficiales. No regenerar un documento histórico con datos actuales del padrón.

Criterios: no emitir antes del hito; no permitir a un rol incorrecto; reintentar no duplica certificado; vigencia de acopio no borra existencia de residuos; no cerrar con adendas o cantidades pendientes sin política aprobada.

Pruebas: seis meses y fines de mes; parciales; in situ; doble emisión; cambio posterior de datos; permiso ajeno; PDF abierto/descargado en web y Android; aviso con sesión caducada; integridad del documento.

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
