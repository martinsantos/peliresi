# SITREP — registro único del refactor de experiencia

Base: `df3e5f97`. Trabajo exclusivo en preview, con datos artificiales. Producción documentada: `8fb6277e`; no se consulta ni modifica para esta tanda. Las fichas de `df3e5f97` siguen sin publicar. Main, workflows, esquema y reglas de negocio quedan fuera de esta ejecución. CAP cerrado, correos/push apagados y flags conservados.

## Criterio de cierre

Cada persona debe identificar su contexto, ubicación, trabajo pendiente y resultado. Una prueba técnica no sustituye una tarea observada. No cerrar con pérdida de datos, accesos indebidos, bloqueos o confusión grave.

1. Referencia actual → reproducir → corregir → probar técnicamente.
2. Sesión observada → ajustar → documentar. Primera ronda: tres personas por rol G/T/O.
3. Publicación posterior, separada y autorizada sobre un commit identificado.

Objetivos de las sesiones: al menos 90% de tareas sin intervención, facilidad mediana 6/7 y 30% menos tiempo en tareas comparables problemáticas. Medir por rol; no atribuir resultados humanos al agente. Android físico continúa pendiente de dispositivo.

## Cobertura y entregables

| Tanda | Recorridos | Situación |
|---|---|---|
| 0 | Rutas, roles, estados, referencia visual y defectos | Referencia operativa registrada; inventario del resto continúa en sus tandas |
| 1 | Inicio, creación G/T/O, aprobaciones, coordinación, retiro, viajes/relevos, recepción, adenda, tratamiento, certificados | Primer corte implementado y probado en preview. Sesión humana y controles pendientes abajo; no cerrada |
| 2 | Padrones, altas, fichas, renovación, ATM/electricidad, documentos, multirol, representantes | Correcciones previas en base; auditoría integral pendiente |
| 3 | Inspecciones, plazos, requerimientos desde Avisos, Monitor y campo | Pendiente; actores sin módulo de Inspecciones |
| 4 | Campana, alertas, correos simulados, enlaces, PDFs, reportes y manual | Pendiente; ningún envío real |

## Matriz inicial de superficies

Las rutas de app agregan `/app`. Permisos del servidor siguen siendo autoritativos.

| Ruta/recorrido | Personas | Estados y foco de QA |
|---|---|---|
| `/dashboard` | G/T/O, administraciones | Pendientes propios, espera, próxima acción; filtros y regreso |
| `/manifiestos`, Programados | G/T/O, administraciones | Historial completo frente a programación; búsqueda/página/regreso |
| `/manifiestos/nuevo` | G/T/O, administración autorizada | Validación por actor, borrador recuperado, envío y aprobación explícita |
| `/manifiestos/:id` | Partes y administración autorizada | Todas las aprobaciones, coordinación separada del retiro, responsable por etapa |
| `/transporte/perfil`, `/transporte/cargas`, `/transporte/viaje/:id` | Transporte | Varios viajes, propios antes de relevos, GPS y reconexión |
| `/manifiestos/:id/adendas` | Partes y autoridades designadas | Hallazgo, diferencia de cantidad, nuevas Y, observación/revisión |
| `/manifiestos/:id#certificaciones` | Operador emite; partes consultan | Parciales, final con adendas resueltas, documento recibido y aviso |
| `/admin/actores/:tipo`, ficha/edición/alta | Administración con competencia | Filtros globales, retorno, validación y persistencia |
| `/inspecciones` | Administración/inspectores autorizados | Agenda, campo, análisis, seguimiento y decisiones |
| `/requerimientos/:id` desde Avisos | Destinatario autorizado | Sólo requerimiento asignado, respuesta y plazos |
| `/monitor` | Administración autorizada | Viaje/actor/última posición/antigüedad; lectura simultánea |
| `/notificaciones` | Cada cuenta/contexto | Objeto, motivo, responsable y enlace autorizado |

## Registro único de defectos

| ID | Gravedad | Reproducción y evidencia | Criterio de cierre | Estado |
|---|---|---|---|---|
| UX01 | Alta | Inicio → Filtrar → abrir manifiesto → volver: estado local se pierde | Filtro, búsqueda y página permanecen en web/app; contexto no mezcla datos | Regresión y regreso en app comprobados |
| UX02 | Alta | Propuesta pendiente como administrador muestra PDF/cancelar, sin explicación de responsable. `baseline/proposal-admin.png` y `proposal-app-393.png` | Las partes pendientes y cómo continuar se explican sin inventar permisos | Adaptador común y recorrido de tres cuentas comprobados |
| UX03 | Media | Programados descarta nombres de origen/destino que ya entrega API | Fecha, número y participantes legibles en cada fila | UI corregida; API y componente comprobados |
| UX04 | Media | Íconos compactos sólo distinguen aprobación por color. `baseline/home-admin.png` | Resumen numérico visible y nombres accesibles, sin tildes redundantes | Componente y vista 320/393 comprobados |
| UX05 | Alta | Error al refrescar certificados conserva datos previos que permiten emitir | Error con reintento; formulario conservado; emisión bloqueada hasta comprobar condiciones | Regresión de fallo, reintento y cambio de contexto aprobada |
| UX06 | Alta | Detalle interpreta descripción histórica de rechazo con JSON.parse sin guarda | Texto histórico o mal formado nunca rompe la ficha | Regresión aprobada |
| UX07 | Media | Recibido ofrece pesaje, tratamiento y cierre con igual énfasis | Una acción principal sugerida por etapa, demás disponibles según permisos | Regresión y recepción en app comprobadas |
| UX08 | Alta | Un filtro de Inicio de otra cuenta sigue en la URL y produce un falso vacío | Limpiar filtros del propietario anterior antes de la primera consulta; conservar al reabrir el mismo contexto | Regresión por cuenta/rol/actor/empresa/sede y cambio G→T en app aprobados |
| UX09 | Media | Formulario muestra todas las Y y un bloque extenso de borrador permanentemente | Resumen compacto y detalle desplegable; campos sin tapar | Implementado; validación y recuperación probadas |
| UX10 | Media | Adendas agrega márgenes, títulos y vacíos repetidos | Encabezado alineado, ancho 960, ayuda en flujo; un solo vacío | Corregido; medidas y capturas web/app |
| UX11 | Alta | Cerrar adenda pierde hallazgo/motivo; reintentar desde otra sesión puede duplicar comando | Recuperar por contexto, conservar clave de envío y resolver conflicto entre pestañas | Unitarias + cierre/reapertura web/app comprobados |
| UX12 | Alta | Otra pestaña reemplaza silenciosamente un manifiesto en edición | Conservar texto propio, bloquear envío y ofrecer elección de versión | Regresión y conflicto web/app comprobados (8 kg frente a 9 kg); sin crear manifiesto |
| UX13 | Media | Nuevo manifiesto repite el título del encabezado en escritorio | Un único título de pantalla en web y app | Duplicación retirada |
| UX14 | Alta | Cerrar las dos pestañas con un conflicto sin elegir descarta la copia local | Guardar cada copia separadamente, recuperarla al reabrir y no permitir enviar hasta elegir | Corregido; 158 regresiones y cierre/reapertura real web/app de manifiesto y motivo de adenda comprobados |

## Evidencias y sesiones

Directorio de esta ejecución: `uiux-integral-20261025` dentro del workspace de evidencias del hilo. `baseline/` conserva capturas anteriores a los cambios; `verified/` contiene resultados comprobados. No reutilizar una captura histórica como prueba actual.

Ficha por tarea observada: rol, contexto, variante web/app, fecha, participante anónimo, objetivo, resultado sin ayuda/con ayuda/fallo, tiempo, errores, facilidad 1–7, comentario literal y defecto vinculado. Tareas: crear propuesta; aprobar desde aviso; identificar espera; coordinar/retiro; recibir y declarar diferencia; resolver adenda; emitir/descargar certificado. Registrar referencia anterior y nueva con la misma tarea.

Todavía no hay participantes observados ni métricas humanas de esta tanda.

### Pruebas técnicas del primer corte

- Unitarias: permisos/navegación por rol, estados/próxima acción, iconos, filtros por contexto, agenda, aprobaciones, certificados, acciones y recuperación de manifiestos/adendas. El JSON final de Vitest registra el conteo; las repeticiones durante correcciones no son casos adicionales.
- TypeScript y compilaciones independientes de web y app en QA remoto: 1 CPU, 2 GiB, swap0 y un worker. Sin nuevas instalaciones ni workflows.
- Integración contra API real de preview: creación por cada uno de G/T/O; 0→3 aprobaciones explícitas; aviso a las partes; inicio/retiro bloqueados antes de unanimidad y coordinación; tres viajes con GPS artificial; relevo eventual; recepción/pesaje; hallazgo; observación y conflicto de versión; parcial; cierre; final bloqueado hasta revisar adendas; descarga del mismo PDF por las tres partes y 404 para ajeno. Nueve grupos únicos; un grupo GPS se repitió al reanudar y no aumenta cobertura.
- Casos API creados: `2026-000139`, `2026-000140`, `2026-000141`. Se completaron con certificados. Los 515 manifiestos anteriores conservaron su huella durante la prueba integrada.
- Caso UI real `2026-000142`: creado en app; errores de actores enfocados; borrador recuperado; firma de generador, aprobación transporte, aprobación operador desde sus avisos; coordinación en web; retiro/entrega mediante API sintética sin GPS físico; recepción en app; hallazgo en web con 12 kg Y1 frente a 10 declarados y Y21 omitida; recuperación al cerrar/reabrir web/app; aviso y decisión de generador. Los datos pertenecen únicamente al preview artificial.
- Ayuda de adendas abierta/cerrada con Enter; foco visible de 2 px. Medidas de página en 320/393/768 y escritorio 1365/1920 en `browser-checks.json`; no equivalen a auditoría exhaustiva de accesibilidad.
- Las pruebas de correo son verificación de ausencia de entrega: cero enviados y cero intentos. Campana interna sí comprobada. No se considera probado un correo entregado ni un push real.

### Pendientes que impiden declarar cerrada la tanda

1. Sesiones observadas: tres personas por rol, con referencia comparable y resultados individuales.
2. Android físico: suspensión real, permisos/GPS y cierre del proceso. La app en navegador no sustituye esa prueba.
3. Completar barrido de todos los estados en cinco anchos, ampliación de texto, lector de pantalla y recuperación ante red lenta/sesión vencida/adjuntos rechazados. La evidencia actual sólo cubre los recorridos detallados arriba.
4. Terminar la consolidación general de metadatos de navegación, ayuda/regreso y componentes en tandas 2–4. No se presenta este corte operativo como refactor total finalizado.
5. Android físico sigue pendiente también para conflictos de borrador: el cierre/reapertura de las pestañas web/app ya recupera ambas versiones sin elegir previamente. Falta comprobar el cierre forzado del proceso y las políticas de almacenamiento del dispositivo real.

### Continuación: conflictos durables

Primer corte técnico conservado en `9bb62969`. La continuación guarda cada copia en conflicto en una clave propia, aislada por cuenta, rol y registro. Resolver una copia no elimina una revisión más reciente ni las copias de otras pestañas. Se revisan una por vez. Un fallo de cuota mantiene el texto en pantalla y muestra que no hay recuperación garantizada.

Evidencias: `uiux-continuity-20261025`. Sin registros nuevos: borrador de manifiesto con 11 frente a 22 kg; cierre de ambas pestañas; recuperación en web y app; elección de 22 kg persistida. Motivo de adenda `2026-000142`: dos textos, cierre, recuperación del texto local y decisión bloqueada hasta elegir. No se envió ninguna resolución. También se compactó el resumen documental para no mostrar tres contadores en cero y se subió el conflicto junto al encabezado.

### Guion de la primera sesión (sin intervenir salvo bloqueo)

| Persona | Tarea sin instrucciones de interfaz | Comprobación observable |
|---|---|---|
| Generador | Crear una propuesta con residuos y las otras dos partes; interrumpir y retomar | Recupera datos; entiende que crear no aprueba ni retira |
| Cada rol | Entrar desde un aviso, decidir y explicar qué falta | Identifica manifiesto, decisión propia y partes pendientes |
| Transporte | Elegir la carga correcta entre varios viajes y registrar una incidencia/relevo de práctica | No modifica otro viaje; distingue coordinación, retiro y GPS |
| Operador | Recibir, pesar y declarar una diferencia con Y omitida | Conserva declaración original y entiende el hallazgo dentro de la adenda |
| Generador/transporte | Revisar el hallazgo y observarlo; retomar el motivo | Encuentra el aviso y la versión actual; no confunde decisión propia con unanimidad |
| Operador y contraparte | Emitir una parcial y después la final; localizar el documento recibido | Distingue cierre, emisión y descarga del mismo documento |

Registro por intento: código anónimo, rol, superficie, tarea, hora inicial/final, resultado sin ayuda/con ayuda/fallo, errores, facilidad 1–7 y comentario literal. No cargar nombres, correos ni documentos reales. Cada defecto vuelve al registro UX y al ciclo de corrección.
