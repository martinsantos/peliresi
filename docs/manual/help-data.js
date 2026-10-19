(function () {
  'use strict';

  var S = 'screenshots/';
  var QA_TRAINING = 'QA · 12/10/2026 · Datos sintéticos · Captura reutilizada de escritorio o app';
  var QA_ALERTS = 'Captura de QA del 04/10/2026 · Datos sintéticos · No acredita el estado actual de esta instalación';

  window.SITREP_HELP = {
    profiles: [
      { id: 'administrador', label: 'Administrador', icon: 'admin_panel_settings', description: 'Usuarios, padrones, configuración y supervisión.' },
      { id: 'generador', label: 'Generador', icon: 'factory', description: 'Creación, firma y seguimiento de manifiestos.' },
      { id: 'transportista', label: 'Transportista', icon: 'local_shipping', description: 'Retiros, GPS, incidentes y entregas.' },
      { id: 'operador', label: 'Operador', icon: 'science', description: 'Recepción, pesaje, tratamiento y cierre.' },
      { id: 'inspector', label: 'Inspector', icon: 'fact_check', description: 'Visita, controles, fotos, acta e informe técnico.' },
      { id: 'auditor', label: 'Consulta y auditoría', icon: 'policy', description: 'Recorrido para personal autorizado; no concede un rol adicional.' }
    ],

    guides: [
      {
        id: 'capacitacion-por-rol', profile: 'administrador',
        audiences: ['administrador', 'generador', 'transportista', 'operador', 'inspector', 'auditor'],
        title: 'Capacitación: recorrido por rol', summary: 'Una jornada de 90 minutos con un resultado comprobable por equipo.',
        duration: '90 min', icon: 'school', keywords: ['capacitación', 'taller', 'tour', 'recorrido', 'datos sintéticos', 'demo'],
        safety: 'En Operación real, solo lectura durante la capacitación. Para practicar dentro de este mismo SITREP, el administrador entra a Ver como otro usuario → Capacitación y confirma la banda «Capacitación · sin validez oficial». Si no está habilitada, no usar registros reales. No se envían correos ni se emiten documentos oficiales.',
        steps: [
          { title: 'Preparación · 10 min', body: ['El instructor ingresa con su cuenta administradora, abre Ver como otro usuario y selecciona Capacitación. Hay hasta cinco cuentas visibles por categoría; cada grupo puede cerrarse y tiene su propia paginación y búsqueda.', 'Elegí una cuenta CAP y comprobá la banda de capacitación antes de actuar. Los participantes del mismo relevo usan el mismo número de equipo: Generador 1, Transporte 1 y Operador 1. Las cuentas escuela se usan por impersonación; no se reparten contraseñas compartidas.', 'Usá Volver a mi cuenta para cambiar de equipo. No hagas el ejercicio en un navegador con formularios de trabajo pendientes; usá otro perfil del navegador. No borres almacenamiento ni cierres el formulario para preparar la clase.'], image: S + 'desktop/training-selector-20261012.png', caption: QA_TRAINING, alt: 'Selector de capacitación con cinco cuentas por categoría', expected: 'Cada equipo confirma modo, rol, número y regreso al administrador antes del ejercicio.' },
          { title: 'Alta y recuperación · 15 min', body: ['Desde Probar, completá un alta con datos ficticios, revisá una sugerencia OCR y corregila si hace falta.', 'Guardá el borrador de prueba y recuperalo en el mismo navegador. No envíes un trámite real; los archivos no se conservan en el borrador de prueba.'], image: S + 'desktop/registration-draft-20261012.png', caption: QA_TRAINING, alt: 'Formulario con campos recuperados y estado de guardado local', expected: 'Se recuperan los campos y el paso; se identifica qué documentos hay que volver a elegir.' },
          { title: 'Generador → transportista → operador · 20 min', body: ['Con la banda de capacitación visible, elegí un manifiesto CAP del equipo: generador revisa y firma; transportista confirma retiro y entrega; operador recibe, pesa, registra tratamiento y cierra.', 'Cada equipo verifica el estado y la línea de tiempo antes de entregar el turno al siguiente. Las descargas oficiales están deshabilitadas en capacitación. En Operación real sólo se muestran registros existentes, sin accionarlos.'], image: S + 'desktop/training-manifest-20261012.png', caption: QA_TRAINING, alt: 'Manifiesto de capacitación tratado, sin emisión de documentos oficiales', expected: 'Las tres partes completan el relevo y comprueban el cierre sin alterar un manifiesto ni emitir un certificado real.' },
          { title: 'Inspector y autoridad · 20 min', body: ['El inspector identifica Visita, Controles, Registro y Expediente; contrasta lo declarado, documenta un hallazgo y verifica el guardado de su evidencia.', 'La autoridad revisa el expediente; el actor localiza el requerimiento que le corresponde. En el entorno escuela, demostrar respuesta vinculada y decisión autorizada. Una respuesta no equivale a conformidad.'], image: S + 'mobile/training-inspection-20261012.png', caption: QA_TRAINING, alt: 'Inspector de capacitación: secciones numeradas, control revisado y guardado confirmado', expected: 'Se distinguen acta, informe, respuesta del actor y decisión de la autoridad.' },
          { title: 'Administración y soporte · 15 min', body: ['Administración localiza una solicitud, sus documentos y correcciones; consulta el padrón, el CAA oficial y Monitor con el período del ejercicio.', 'El equipo de soporte muestra un ticket escuela: Asignarme, Derivar, nota interna y respuesta pública. El autor verifica el aviso y la respuesta en el mismo ticket.'], image: S + 'desktop/support-actions-20261012.png', caption: QA_TRAINING, alt: 'Acciones del equipo de soporte: responder, nota interna, derivar y cerrar', expected: 'Se identifica quién debe actuar y qué ve el usuario final; las notas internas quedan separadas.' },
          { title: 'Comprobación final · 10 min', body: ['Monitor → Historial → Pausar → mové la barra → Reproducir. Pendientes muestra lo que falta; En vivo vuelve al estado actual. Son ubicaciones sintéticas, no un viaje físico en vivo.',
    'Cada participante encuentra su próxima tarea y explica cómo pedir ayuda. Registrar dudas con pantalla, rol y resultado esperado.', 'GPS, cámara QR y recuperación de conexión deben comprobarse en los teléfonos de la jornada; una prueba en navegador o emulador no certifica batería ni segundo plano. No borrar ni reiniciar datos productivos para repetir ejercicios.'], expected: 'El instructor registra resultados y pendientes reales, sin declarar un GO global por completar el tour.' }
        ]
      },
      {
        id: 'alta-borradores-ocr', profile: 'generador', audiences: ['generador', 'transportista', 'operador', 'administrador'],
        title: 'Alta: documentos, OCR y borradores', summary: 'Probá el formulario, recuperá lo guardado y distinguí una práctica de una solicitud real.',
        duration: '6 min', icon: 'edit_document', keywords: ['alta', 'inscripción', 'OCR', 'licencia', 'choferes', 'recibos', 'borrador', 'precarga', 'TEF'],
        safety: 'Probar (modo revisión) no crea trámites reales. El OCR propone datos: no valida pagos, identidad ni habilitación. La precarga del padrón requiere verificar el acceso; un CUIT público no autoriza consultar datos privados.',
        steps: [
          { title: 'Elegir el alta correcta', body: ['Entrá desde Probar en Generador, Transportista u Operador y comprobá el aviso de modo revisión.', 'Completá los datos de la actividad. El cálculo dinámico de TEF no se muestra al solicitante; su revisión corresponde a administración.'], image: S + 'mobile/registration-trial-20261012.png', caption: 'Modo prueba en la URL final · Datos sintéticos · 12/10/2026', alt: 'Alta de Generador en móvil con el aviso Prueba sin envío y el botón Guardar', expected: 'Sabés si estás practicando o completando una solicitud real.' },
          { title: 'Cargar documentos y revisar OCR', body: ['Elegí el documento en su apartado y esperá el resultado de lectura. Compará cada sugerencia con el original antes de aceptarla.', 'En transportistas, cargá cada chofer con sus datos y licencia. Si la foto es borrosa o no se lee, completá los campos manualmente: no inventes lo ilegible. Una huella duplicada detecta el mismo archivo, no necesariamente otra foto del mismo recibo.'], image: S + 'mobile/registration-ocr-20261012.png', caption: 'Datos sintéticos · Licencia sin validez leída con OCR en modo prueba. La lectura no aprueba la licencia.', alt: 'Sugerencias OCR de una licencia ficticia: campos seleccionables y botón Usar datos seleccionados', expected: 'La información aceptada coincide con el documento; los errores de lectura no se confunden con una aprobación.' },
          { title: 'Guardar y recuperar', body: ['En modo prueba, guardá el borrador y recuperalo en el mismo navegador y dispositivo. Los archivos no se guardan en ese borrador: hay que volver a seleccionarlos.', 'En un trámite real, esperá la confirmación de guardado del servidor. Un borrador local o un archivo pendiente no garantiza recuperación desde otro dispositivo.'], image: S + 'desktop/registration-draft-20261012.png', caption: QA_TRAINING, alt: 'Datos recuperados; se distingue guardado local de guardado en SITREP', expected: 'Campos y paso se recuperan; sabés qué está guardado y qué sigue pendiente.' },
          { title: 'Revisar antes de presentar', body: ['Podés completar el formulario por partes; antes del envío real revisá los campos y documentos requeridos.', 'La solicitud presentada pasa a revisión administrativa. Si está observada, corregí lo solicitado en ese mismo trámite. Con los correos apagados no se entregan enlaces de verificación o recuperación.'], image: S + 'mobile/registration-observed-20261012.png', caption: QA_TRAINING, alt: 'Ejemplo posterior al envío: solicitud observada y campo de respuesta', expected: 'No confundís guardar, presentar y aprobar; en modo prueba no se crea una solicitud real.' }
        ]
      },
      {
        id: 'soporte-enviar-seguir', profile: 'generador', audiences: ['administrador', 'generador', 'transportista', 'operador', 'inspector', 'auditor'],
        title: 'Enviar un ticket y leer la respuesta', summary: 'Pedí ayuda técnica desde la pantalla del problema y seguí el mismo ticket.',
        duration: '3 min', icon: 'support_agent', keywords: ['ticket', 'soporte', 'ayuda', 'problema', 'respuesta', 'audio'],
        safety: 'Un ticket no modifica ni reemplaza el trámite. No adjuntes contraseñas ni información de otras personas. Para practicar, usá una cuenta CAP con la banda de capacitación visible; en Operación real, consultá sin enviar pruebas.',
        steps: [
          { title: 'Reportar desde Ayuda', body: ['Abrí Ayuda → Reportar problema o Soporte. Describí qué intentabas hacer y qué pasó.', 'Las capturas y documentos son opcionales. Si continuás luego, el borrador queda en ese dispositivo y cuenta; no se envía automáticamente.'], image: S + 'mobile/support-report-20261012.png', caption: QA_TRAINING, alt: 'Reporte de problema con descripción y adjuntos opcionales', expected: 'El reporte explica el problema sin exigir un adjunto innecesario.' },
          { title: 'Confirmar el envío', body: ['Enviá una sola vez y esperá el número de ticket. Si falla, conservá el texto y revisá el mensaje antes de reintentar.', 'Mis tickets permite volver al reporte desde web o app. No lo des por enviado si sólo ves un borrador.'], image: S + 'mobile/support-created-20261012.png', caption: QA_TRAINING, alt: 'Ticket creado con número y estado Abierto', expected: 'El ticket tiene número y puede abrirse desde Mis tickets.' },
          { title: 'Seguir la respuesta', body: ['Consultá la campana de avisos o Mis tickets y abrí el mismo reporte. Los correos apagados no impiden consultar una respuesta guardada dentro del sistema.', 'Respondé con el dato solicitado; podés usar los adjuntos o audio cuando estén disponibles y autorices el micrófono. Cerrá con un motivo cuando esté resuelto o reabrí si persiste.'], image: S + 'desktop/support-answer-20261012.png', caption: QA_TRAINING, alt: 'Respuesta de soporte visible para el usuario autor del ticket', expected: 'El autor encuentra la respuesta pública y puede continuar la conversación.' }
        ]
      },
      {
        id: 'soporte-gestionar', profile: 'administrador',
        title: 'Soporte: asignar, derivar y responder', summary: 'Separá la conversación con el usuario del trabajo interno del equipo.',
        duration: '4 min', icon: 'assignment_ind', keywords: ['ticket', 'soporte', 'derivar', 'asignarme', 'clasificar', 'nota interna', 'impersonado'],
        safety: 'Requiere acceso habilitado a Mesa de soporte. Estos permisos no conceden acceso adicional a trámites. Para practicar, usar tickets escuela en un entorno autorizado.',
        steps: [
          { title: 'Ubicar y tomar el ticket', body: ['Entrá en Mesa de soporte y filtrá por número, estado o clasificación. Asignarme toma un ticket disponible.', 'Comprobá el autor y, si se creó durante un acceso temporal, la identidad representada. La respuesta pública debe llegar al autor del ticket, no confundirse con una nota al administrador.'], image: S + 'desktop/support-assigned-20261012.png', caption: QA_TRAINING, alt: 'Ticket En atención con responsable identificado', expected: 'El ticket correcto tiene un responsable identificado.' },
          { title: 'Clasificar o derivar', body: ['Clasificar define área, tipo y prioridad; no cierra el ticket.', 'Derivar permite elegir otro responsable activo. Si no aparece ningún destino, administración debe revisar Equipo de soporte. No compartas credenciales para resolver una derivación.'], image: S + 'desktop/support-triage-20261012.png', caption: QA_TRAINING, alt: 'Clasificación con área, tipo y prioridad; Derivar es otra acción', expected: 'El responsable y la clasificación quedan visibles; la derivación conserva su historial.' },
          { title: 'Responder y cerrar', body: ['Elegí Responder para un mensaje visible al usuario; Nota interna sólo la ve soporte. Revisá esa distinción antes de enviar.', 'Pedí respuesta si faltan datos y cerrá con una resolución cuando corresponda. Verificá con el autor que puede abrir el aviso y leer la respuesta.'], image: S + 'desktop/support-actions-20261012.png', caption: QA_TRAINING, alt: 'Respuesta pública y acciones de soporte separadas de la nota interna', expected: 'El usuario ve la solución, no las notas internas; el estado refleja el trabajo pendiente.' }
        ]
      },
      {
        id: 'actor-mis-inspecciones', profile: 'transportista', audiences: ['generador', 'transportista', 'operador'],
        title: 'Mis inspecciones: leer, responder y consultar el cierre',
        summary: 'El actor consulta sus propios expedientes e intercambios, no las inspecciones generales.',
        duration: '4 min', icon: 'forum', keywords: ['mis inspecciones', 'requerimiento', 'descargo', 'respuesta', 'cierre', 'transportista'],
        safety: 'Una respuesta no aprueba ni cierra la inspección. Para practicar, usá únicamente expedientes CAP con la banda de capacitación; no se envían correos.',
        steps: [
          { title: 'Abrir el expediente propio', body: ['Desde el menú, entrá en Mis inspecciones y verificá el actor y el número del expediente.', 'El generador, transportista u operador sólo consulta los expedientes publicados que le corresponden. No ve los borradores de trabajo del inspector ni los de otros actores.'], image: S + 'mobile/actor-inspection-20261012.png', caption: QA_TRAINING, alt: 'App del transportista en su expediente, identificado como Vista: Inspeccionado', expected: 'La vista indica Inspeccionado y el expediente pertenece a tu organización.' },
          { title: 'Responder al pedido correcto', body: ['En el registro cronológico, leé el requerimiento y su plazo; usá Responder en ese pedido para vincular la presentación.', 'Completá el contenido y adjuntá sólo lo necesario. Presentar en expediente debe confirmar el guardado; comprobá que la actuación aparezca al volver a abrir. No confundas un texto local con una presentación recibida.'], image: S + 'desktop/actor-inspection-closed-20261012.png', caption: QA_TRAINING + ' · Ejemplo de registro ya cerrado; las acciones disponibles dependen del estado', alt: 'Registro cronológico con requerimiento y descargo vinculados del mismo actor', expected: 'La respuesta queda en el pedido correspondiente; la decisión sigue a cargo de la autoridad.' },
          { title: 'Consultar la decisión', body: ['Volvé al expediente para revisar la nueva actuación de la autoridad y su estado.', 'Cerrada conforme y Sin plazo abierto distinguen el cierre de un intercambio pendiente. Un expediente cerrado no habilita nuevas respuestas; consultá a la autoridad si necesitás otra actuación.'], image: S + 'desktop/actor-inspection-closed-20261012.png', caption: QA_TRAINING, alt: 'Transportista: expediente Cerrada conforme, sin plazo abierto y con historial conservado', expected: 'Podés distinguir respuesta presentada, requerimiento pendiente y cierre autorizado.' }
        ]
      },
      {
        id: 'cambio-dominio', profile: 'administrador', audiences: ['administrador', 'generador', 'transportista', 'operador', 'inspector', 'auditor'],
        title: 'Acceder a SITREP y preparar el cambio de dominio', summary: 'Usá la instalación actual; el dominio final se habilitará mediante una migración anunciada.',
        duration: '3 min', icon: 'language', keywords: ['dominio', 'migración', 'sesión', 'Mendoza', 'borradores', 'app', 'APK', 'PWA'],
        safety: 'El destino previsto es sitrep.mendoza.gov.ar. Mencionarlo aquí no significa que ya esté habilitado. Este manual no cambia DNS, servidores, cuentas ni formularios abiertos.',
        steps: [
          { title: 'Usar la instalación actual', body: ['Los enlaces del manual a web, app y ayuda permanecen en el dominio donde abriste este manual.', 'Usá el enlace institucional confirmado para la jornada. No pruebes credenciales en un dominio distinto sólo porque aparece en una captura histórica.'], expected: 'Manual, web y app apuntan a la misma instalación autorizada.' },
          { title: 'Conservar el trabajo antes de migrar', body: ['Las sesiones, borradores locales, colas sin sincronizar y permisos de cámara/GPS no se trasladan automáticamente entre dominios.', 'Antes del corte, confirmá los guardados del servidor y la sincronización. No borres datos del sitio anterior ni cierres un formulario pendiente. Un enlace recibido por correo tampoco transporta el borrador del otro navegador.'], expected: 'No queda trabajo sólo local que se dé por recuperable en el dominio nuevo.' },
          { title: 'Validar el nuevo acceso', body: ['Tras el anuncio de la migración, ingresá por el enlace oficial y verificá cuenta, rol, trámites y documentos. La conservación de datos del servidor debe comprobarla el equipo de migración.', 'La PWA anterior puede seguir abriendo el dominio anterior y el APK necesita verificar su destino y versión. El equipo técnico debe validar TLS, enlaces de correo, autenticación, GPS, QR y offline antes de declarar el cambio completo.'], expected: 'Se confirma el acceso en web y app; no se presume que una redirección migra sesiones o instalaciones.' }
        ]
      },
      {
        id: 'administrador-alertas-proactivas',
        profile: 'administrador',
        title: 'Configurar alertas y seguir sus avisos',
        summary: 'Simulá reglas con fuentes reales, elegí destinatarios y gestioná casos sin confundir lectura con resolución.',
        duration: '6 min',
        icon: 'notifications_active',
        keywords: ['alertas', 'avisos', 'reglas', 'vencimientos', 'habilitación', 'licencia', 'inspección', 'requerimiento', 'respuesta', 'DDJJ', 'TEF', 'OCR'],
        safety: 'Las capturas de QA usan datos sintéticos y no acreditan la configuración actual. Simular no envía ni crea casos; evaluar reglas activas sí genera casos y avisos internos. Durante la capacitación no activar reglas ni envíos. Consultá los permisos y la configuración de esta instalación.',
        steps: [
          { title: 'Abrir Reglas y simular sin enviar', body: ['En Alertas → Reglas → Nueva Regla, elegí una familia, su nombre y los destinatarios permitidos.', 'Usá Simular sin enviar: muestra la cantidad real y hasta 20 ejemplos. No crea la regla, casos ni avisos. Las reglas nuevas se crean inactivas.'], image: S + 'desktop/alerts_simulation_qa.png', caption: QA_ALERTS, alt: 'QA: simulación de manifiestos pendientes sin enviar avisos', expected: 'Podés revisar la fuente y el alcance antes de guardar o activar.' },
          { title: 'Seguir manifiestos recibidos', body: ['Manifiesto pendiente de tratamiento o cierre usa estados Recibido o En tratamiento y la fecha de recepción registrada.', 'Los días son un umbral operativo, no un vencimiento legal. Cero incluye todos los recibidos o en tratamiento; una fecha ausente se identifica, no se inventa.'], image: S + 'desktop/alerts_simulation_qa.png', caption: QA_ALERTS, alt: 'QA: umbral operativo desde la recepción de un manifiesto', expected: 'La alerta identifica el manifiesto que necesita una acción permitida.' },
          { title: 'Detectar requerimientos sin respuesta', body: ['Inspección · requerimiento sin respuesta usa el plazo real del requerimiento de la autoridad dirigido al inspeccionado.', 'Leer, responder a otro pedido o una actuación de la autoridad no lo contesta. Una respuesta, descargo o subsanación vinculada detiene el aviso de ausencia, aunque sea tardía; no significa aceptación legal ni conformidad.'], image: S + 'desktop/alerts_requirement_qa.png', caption: QA_ALERTS, alt: 'QA: plazos de requerimientos e inspecciones sin respuesta relacionada', expected: 'Se sigue cada pedido concreto y se conserva la evidencia original.' },
          { title: 'Revisar habilitaciones y licencias', body: ['Elegí anticipación entre 0 y 365 días y las fuentes con fecha registrada: transportistas, operadores, vehículos y conductores. Sin fecha no se presume vencimiento.', 'Una fecha sin hora, por ejemplo 10/10, permanece vigente hasta finalizar el 10 en Mendoza y está vencida desde el 11. Con cero días se incluye hoy y las fechas pasadas.'], image: S + 'desktop/alerts_expiry_qa.png', caption: QA_ALERTS, alt: 'QA: fuentes y anticipación configurables de vigencia documental', expected: 'La fecha mostrada coincide con la registrada y no vence antes de terminar ese día.' },
          { title: 'Activar y verificar la llegada del aviso', body: ['Revisá y activá la regla deliberadamente. Evaluar seguimiento ahora procesa reglas activas de manifiestos; Evaluar inspecciones y vencimientos procesa las otras dos familias. También hay evaluación diaria a las 08:00 y 08:05 de Mendoza, respectivamente.', 'El responsable abre su campana o Avisos en la app. Sólo reciben el actor involucrado, inspector asignado habilitado o administración competente, según la regla; nunca todo el padrón. El aviso abre el manifiesto, expediente o ficha propia. No se envía correo ni push desde este catálogo.'], image: S + 'mobile/alerts_owner_notice_qa.png', caption: QA_ALERTS, alt: 'QA app: aviso interno del operador con acceso al manifiesto propio', expected: 'El destinatario exacto puede abrir el origen; una regla inactiva no produce casos.' },
          { title: 'Resolver el caso, no sólo leer el aviso', body: ['La autoridad habilitada usa Gestionar caso: Pendiente, En revisión, Resuelta o Descartada, con motivo obligatorio. Marcar leída cambia sólo la lectura del aviso.', 'La evaluación concilia fuentes que ya cambiaron, manteniendo la situación inicial. Resolver un caso no cierra un manifiesto ni aprueba una inspección. Se conserva la última decisión; no es un historial legal inmutable de todas las decisiones.'], image: S + 'mobile/alerts_resolved_case_qa.png', caption: QA_ALERTS, alt: 'QA app: caso resuelto con motivo y situación original preservados', expected: 'Estado y motivo persisten, sin cambiar la formalidad del objeto de origen.' },
          { title: 'Comprobar el origen y los límites', body: ['El inspector abre el expediente asignado desde el aviso; el operador consulta su perfil, y el transportista su ficha y Flota y Conductores para avisos de vehículos o licencias.', 'Reglas distintas pueden generar casos distintos sobre el mismo objeto. Desactivar preserva los casos anteriores. DDJJ, TEF/TF, OCR de recibos y mensajes sin plazo requieren fuentes y criterios aprobados: todavía no son reglas operativas del catálogo.'], image: S + 'mobile/alerts_inspector_origin_qa.png', caption: QA_ALERTS, alt: 'QA app: inspector accede al expediente real del aviso, con datos sintéticos', expected: 'Cada aviso tiene una fuente comprobable y no acusa una infracción por suposición.' }
        ]
      },
      {
        id: 'inspector-completar-inspeccion',
        profile: 'inspector',
        title: 'Completar una inspección en campo',
        summary: 'Prepará la visita, contrastá en campo y verificá el guardado de cada foto y comentario.',
        duration: '8 min',
        icon: 'fact_check',
        keywords: ['inspección', 'inspector', 'checklist', 'acta', 'informe técnico', 'foto', 'evidencia', 'sin conexión', 'descargo'],
        safety: 'Avanzar entre pasos no guarda ni envía por sí solo. No cierres ni envíes el expediente hasta confirmar el texto y cada foto en el servidor.',
        steps: [
          { title: 'Preparar el expediente', body: ['Abrí Inspecciones y verificá actor, ubicación, inspector asignado y número de acta. El número del legajo encabeza la ficha; Listado permite volver sin desplazar el título.', 'Las secciones son 1 Visita, 2 Controles, 3 Registro y 4 Expediente. El verde oscuro identifica la sección abierta; la fila inferior muestra sus apartados, no otra etapa. Los números orientan: no indican aprobación ni porcentaje completado.', 'Iniciá la etapa de campo cuando estés en el lugar. La ficha del actor se abre desde su nombre dentro del expediente. La ayuda técnica está en la cabecera durante el trabajo de campo; no tapa Guardar.'], image: S + 'mobile/training-inspection-20261012.png', caption: QA_TRAINING, alt: 'Secciones Visita, Controles, Registro y Expediente en app', expected: 'El expediente correcto, la sección abierta y las acciones de guardado están identificados.' },
          { title: 'Contrastar lo declarado', body: ['En Declarado vs. verificado, revisá cada dato y marcá Coincide, Difiere o No verificado.', 'Si difiere, describí qué constataste y qué debe corregirse; evitá marcar en bloque sin revisar.'], image: S + 'desktop/inspection_comparison_qa.png', alt: 'Simulación de datos declarados frente a la verificación en campo', expected: 'Cada dato tiene un resultado explícito y los desacuerdos están documentados.' },
          { title: 'Completar el checklist', body: ['Abrí cada control y elegí Cumple, No cumple o No aplica.', 'Ante un incumplimiento, escribí el hallazgo y la acción requerida dentro de ese control.'], image: S + 'desktop/inspection_checklist_qa.png', alt: 'Simulación de checklist con resultado, observación y guardado', expected: 'El índice distingue controles pendientes y revisados; cada resultado adverso conserva su observación.' },
          { title: 'Adjuntar la foto al hallazgo', body: ['Dentro del mismo control, usá Tomar foto o Elegir imagen; no confundas esa foto con un archivo general del expediente.', 'Comprobá que aparezca la miniatura vinculada. Guardá y esperá la confirmación del servidor.'], image: S + 'mobile/inspection_evidence_qa.png', alt: 'Simulación móvil de evidencia fotográfica vinculada a un control', expected: 'La miniatura sigue asociada al control incluso después de recargar.' },
          { title: 'Redactar el acta de campo', body: ['Registrá hechos observados, personas intervinientes y circunstancias de la visita.', 'Diferenciá lo constatado de declaraciones de terceros y de las inferencias técnicas.'], image: S + 'mobile/inspection_wizard_qa.png', alt: 'Asistente móvil de inspección utilizado para llegar al acta de campo', expected: 'El acta conserva una descripción de campo verificable.' },
          { title: 'Revisar el informe técnico', body: ['Exponé objetivo, antecedentes, evaluación, conclusión y recomendación técnica.', 'El acta constata; el informe analiza. Revisá ambos PDF y el QR de trazabilidad antes de derivar.'], image: S + 'desktop/inspection_report_qa.png', alt: 'Simulación del informe de inspección y acceso a sus exportaciones', expected: 'Acta e informe son documentos distintos y reflejan el expediente guardado.' },
          { title: 'Confirmar y enviar cuando corresponda', body: ['Repasá pendientes, intercambios, adjuntos y estado de sincronización.', 'Con mala conexión, conservá el borrador y no des por recibida una foto pendiente; enviá solo cuando todo figure confirmado.'], image: S + 'desktop/inspection_report_qa.png', alt: 'Resultado consolidado del expediente de inspección', expected: 'El expediente queda trazable y listo para la etapa autorizada, sin confundir correo informativo con notificación legal.' }
        ]
      },
      {
        id: 'transportista-confirmar-retiro',
        profile: 'transportista',
        title: 'Confirmar retiro de residuos',
        summary: 'Revisá el manifiesto, confirmá el retiro e iniciá el seguimiento GPS.',
        duration: '4 min',
        icon: 'local_shipping',
        keywords: ['confirmar retiro', 'tomar viaje', 'aprobado', 'gps', 'transportista'],
        safety: 'Realizá esta gestión únicamente cuando el retiro físico esté comenzando. La confirmación cambia el estado del manifiesto.',
        steps: [
          { title: 'Seleccionar el viaje', body: ['Ingresá en Viaje o Manifiestos y buscá el registro asignado en estado APROBADO.', 'Confirmá número, generador y establecimiento antes de abrirlo.'], image: S + 'mobile/M21_tomar_viaje_mobile.png', alt: 'Viajes aprobados disponibles para el transportista', expected: 'El viaje correcto queda abierto y todavía no se modificó su estado.' },
          { title: 'Revisar el manifiesto', body: ['Verificá generador, residuos, cantidades, transportista y operador de destino.', 'Si detectás una diferencia, detené el procedimiento e informala antes de continuar.'], image: S + 'desktop/54_manifiesto_aprobado_detalle.png', alt: 'Detalle de un manifiesto aprobado', expected: 'Los datos digitales coinciden con la carga y la documentación física.' },
          { title: 'Confirmar el retiro', body: ['Seleccioná Confirmar retiro y revisá el mensaje de confirmación.', 'Confirmá una sola vez. El manifiesto debe pasar de APROBADO a EN TRÁNSITO.'], image: S + 'mobile/M22_viaje_gps_activo_mobile.png', alt: 'Viaje activo luego de confirmar el retiro', expected: 'El retiro queda fechado y el viaje aparece activo.' },
          { title: 'Verificar el GPS', body: ['Permití el acceso a la ubicación cuando el navegador lo solicite.', 'Comprobá que el indicador muestre GPS activo antes de iniciar el recorrido.'], image: S + 'mobile/M22_viaje_gps_activo_mobile.png', alt: 'Seguimiento GPS activo durante el viaje', expected: 'La ubicación se registra y el viaje continúa disponible aunque cambies de pantalla.' },
          { title: 'Ver el comprobante', body: ['Volvé al detalle del manifiesto y revisá el evento Confirmación de retiro.', 'Si necesitás compartir evidencia, descargá el PDF desde el detalle.'], image: S + 'desktop/58_manifiesto_timeline.png', alt: 'Línea de tiempo del manifiesto con eventos registrados', expected: 'El evento, la fecha y el usuario responsable figuran en la trazabilidad.' }
        ]
      },
      {
        id: 'transportista-confirmar-entrega',
        profile: 'transportista',
        title: 'Confirmar la entrega al operador',
        summary: 'Finalizá el viaje, registrá la entrega y verificá el nuevo estado.',
        duration: '3 min',
        icon: 'where_to_vote',
        keywords: ['confirmar entrega', 'entregado', 'destino', 'transportista', 'operador'],
        safety: 'Confirmá la entrega solamente cuando la carga haya llegado al establecimiento operador.',
        steps: [
          { title: 'Abrir el viaje activo', body: ['Ingresá a Viaje y seleccioná el manifiesto EN TRÁNSITO.', 'Verificá que el destino corresponda al operador que recibe la carga.'], image: S + 'mobile/M11_transporte_perfil_viaje_mobile.png', alt: 'Perfil transportista con viaje activo', expected: 'El viaje activo correcto queda visible.' },
          { title: 'Revisar el arribo', body: ['Comprobá número de manifiesto, operador y ubicación de destino.', 'Registrá un incidente si hubo una novedad durante el traslado.'], image: S + 'mobile/mobile_transportista_ruta.png', alt: 'Ruta del viaje del transportista', expected: 'La información del arribo está validada antes de cerrar el transporte.' },
          { title: 'Confirmar la entrega', body: ['Seleccioná Confirmar entrega y aceptá la confirmación una sola vez.', 'Esperá hasta ver el estado ENTREGADO.'], image: S + 'desktop/55_manifiesto_entregado_detalle.png', alt: 'Manifiesto en estado entregado', expected: 'El manifiesto queda ENTREGADO y disponible para la recepción del operador.' },
          { title: 'Comprobar el cierre del viaje', body: ['Volvé al perfil de transporte.', 'Confirmá que el viaje ya no aparece como activo y que se conserva en el historial.'], image: S + 'desktop/44_transporte_perfil_historial.png', alt: 'Historial de viajes del transportista', expected: 'No quedan viajes activos asociados al traslado finalizado.' }
        ]
      },
      {
        id: 'generador-crear-manifiesto',
        profile: 'generador',
        title: 'Crear un manifiesto',
        summary: 'Completá actores, residuos y datos de transporte sin omitir información obligatoria.',
        duration: '7 min',
        icon: 'note_add',
        keywords: ['crear manifiesto', 'nuevo', 'residuos', 'generador', 'borrador'],
        safety: 'Podés guardar como borrador y revisar la información antes de firmar. Un borrador todavía no inicia el circuito operativo.',
        steps: [
          { title: 'Iniciar un manifiesto', body: ['Abrí Manifiestos y elegí Nuevo manifiesto.', 'Confirmá que el generador mostrado corresponda a tu establecimiento.'], image: S + 'desktop/49_nuevo_manifiesto_generador.png', alt: 'Inicio de un nuevo manifiesto del generador', expected: 'Se abre el asistente y el manifiesto aún no fue firmado.' },
          { title: 'Seleccionar los actores', body: ['Elegí transportista y operador habilitados.', 'Revisá CUIT, domicilio y habilitación que completa el sistema.'], image: S + 'desktop/15_nuevo_manifiesto_paso2.png', alt: 'Selección de transportista y operador', expected: 'Los tres actores del circuito están correctamente identificados.' },
          { title: 'Agregar residuos', body: ['Seleccioná la corriente de residuo y completá cantidad, unidad y descripción.', 'Agregá una fila por cada residuo diferente.'], image: S + 'desktop/62_manifiesto_nuevo_paso3_residuos.png', alt: 'Carga de residuos en un manifiesto', expected: 'La lista refleja cada residuo y su cantidad declarada.' },
          { title: 'Revisar y guardar', body: ['Repasá el resumen completo antes de guardar.', 'Corregí cualquier dato dudoso y guardá el manifiesto como BORRADOR.'], image: S + 'desktop/53_manifiesto_borrador_detalle.png', alt: 'Detalle de un manifiesto en borrador', expected: 'El manifiesto queda en BORRADOR y puede editarse.' },
          { title: 'Firmar cuando corresponda', body: ['Abrí nuevamente el borrador validado.', 'Seleccioná Firmar y aprobar sólo cuando toda la información sea definitiva.'], image: S + 'desktop/53_manifiesto_borrador_detalle.png', alt: 'Acción de firma en un manifiesto borrador', expected: 'El estado cambia a APROBADO y el transportista puede tomar el viaje.' }
        ]
      },
      {
        id: 'generador-seguir-manifiesto',
        profile: 'generador',
        title: 'Seguir un manifiesto',
        summary: 'Consultá el estado, los eventos y la documentación final del traslado.',
        duration: '4 min',
        icon: 'timeline',
        keywords: ['seguir manifiesto', 'estado', 'timeline', 'pdf', 'certificado'],
        steps: [
          { title: 'Buscar el manifiesto', body: ['Abrí Mis manifiestos y buscá por número o estado.', 'Aplicá filtros de fecha si el registro no aparece entre los recientes.'], image: S + 'desktop/48_manifiestos_generador.png', alt: 'Lista de manifiestos del generador', expected: 'El manifiesto buscado aparece en los resultados.' },
          { title: 'Interpretar el estado', body: ['Abrí el detalle y observá el estado principal.', 'Usá la línea de tiempo para identificar quién realizó cada acción.'], image: S + 'desktop/58_manifiesto_timeline.png', alt: 'Línea de tiempo de un manifiesto', expected: 'Podés identificar la etapa actual y el último evento.' },
          { title: 'Consultar el viaje', body: ['Si está EN TRÁNSITO, abrí el seguimiento disponible.', 'Verificá la última ubicación informada sin modificar el registro.'], image: S + 'desktop/10_manifiestos_en_transito.png', alt: 'Manifiestos en tránsito', expected: 'La situación del traslado queda comprendida.' },
          { title: 'Descargar documentos', body: ['Cuando esté TRATADO, descargá el manifiesto y el certificado de disposición.', 'Guardá los documentos según el procedimiento de tu organización.'], image: S + 'desktop/57_manifiesto_tratado_detalle.png', alt: 'Manifiesto tratado con documentos disponibles', expected: 'Los documentos finales quedan disponibles para consulta y auditoría.' }
        ]
      },
      {
        id: 'operador-recibir-pesar',
        profile: 'operador',
        title: 'Recibir y pesar una carga',
        summary: 'Verificá la entrega, registrá el peso real y dejá la carga lista para tratamiento.',
        duration: '6 min',
        icon: 'scale',
        keywords: ['recibir carga', 'pesaje', 'entregado', 'operador', 'recepción'],
        safety: 'La recepción y el pesaje deben reflejar la carga física. Ante una diferencia, registrá la observación antes de continuar.',
        steps: [
          { title: 'Localizar la carga entregada', body: ['Abrí Manifiestos y filtrá por ENTREGADO.', 'Confirmá transportista, generador y número de manifiesto.'], image: S + 'mobile/M23_manifiesto_entregado_operador_mobile.png', alt: 'Manifiesto entregado visto por el operador', expected: 'La carga correcta queda abierta para su recepción.' },
          { title: 'Revisar residuos y documentación', body: ['Compará residuos, cantidades declaradas y documentación física.', 'Si la carga no corresponde, no confirmes la recepción.'], image: S + 'desktop/55_manifiesto_entregado_detalle.png', alt: 'Detalle de manifiesto entregado', expected: 'La documentación coincide con la carga recibida.' },
          { title: 'Confirmar la recepción', body: ['Seleccioná Confirmar recepción una sola vez.', 'Comprobá que el estado cambie a RECIBIDO.'], image: S + 'mobile/mobile_operador_recepcion.png', alt: 'Confirmación de recepción por el operador', expected: 'La recepción queda registrada con fecha y usuario.' },
          { title: 'Registrar el pesaje', body: ['Abrí Registrar pesaje e ingresá el peso real por residuo.', 'Revisá unidad y diferencia antes de guardar.'], image: S + 'mobile/M24_pesaje_modal_mobile.png', alt: 'Modal para registrar pesaje real', expected: 'El peso real queda asociado al manifiesto.' },
          { title: 'Verificar el resultado', body: ['Volvé al detalle y revisá cantidades declaradas y recibidas.', 'Consultá la línea de tiempo para confirmar ambos eventos.'], image: S + 'desktop/56_manifiesto_recibido_detalle.png', alt: 'Manifiesto recibido con datos de pesaje', expected: 'La carga queda RECIBIDA y preparada para registrar tratamiento.' }
        ]
      },
      {
        id: 'operador-tratar-cerrar',
        profile: 'operador',
        title: 'Registrar tratamiento y cerrar',
        summary: 'Documentá el tratamiento aplicado y emití el cierre del manifiesto.',
        duration: '5 min',
        icon: 'science',
        keywords: ['tratamiento', 'cerrar manifiesto', 'certificado', 'operador', 'tratado'],
        safety: 'El cierre es una acción final. Revisá método, fecha y cantidades antes de confirmarlo.',
        steps: [
          { title: 'Abrir un manifiesto recibido', body: ['Filtrá los manifiestos por RECIBIDO.', 'Confirmá que el pesaje esté registrado.'], image: S + 'desktop/56_manifiesto_recibido_detalle.png', alt: 'Manifiesto recibido listo para tratamiento', expected: 'El manifiesto cumple las condiciones previas.' },
          { title: 'Registrar el tratamiento', body: ['Seleccioná Registrar tratamiento.', 'Indicá método, fecha y observaciones requeridas.'], image: S + 'desktop/33_admin_tratamientos_grid.png', alt: 'Catálogo de tratamientos del sistema', expected: 'El estado pasa a EN TRATAMIENTO.' },
          { title: 'Revisar la trazabilidad', body: ['Comprobá los eventos de recepción, pesaje y tratamiento.', 'Corregí cualquier dato pendiente antes del cierre.'], image: S + 'desktop/58_manifiesto_timeline.png', alt: 'Eventos del manifiesto antes del cierre', expected: 'La secuencia operativa está completa.' },
          { title: 'Cerrar el manifiesto', body: ['Seleccioná Cerrar manifiesto y revisá la advertencia.', 'Confirmá una sola vez y esperá el estado TRATADO.'], image: S + 'desktop/57_manifiesto_tratado_detalle.png', alt: 'Manifiesto en estado tratado', expected: 'El manifiesto queda TRATADO y no admite nuevas acciones operativas.' },
          { title: 'Descargar el certificado', body: ['Abrí la documentación final.', 'Descargá el certificado de tratamiento y disposición.'], image: S + 'desktop/57_manifiesto_tratado_detalle.png', alt: 'Descarga del certificado de disposición final', expected: 'El certificado final queda disponible para las partes.' }
        ]
      },
      {
        id: 'administrador-impersonar-volver',
        profile: 'administrador',
        title: 'Acceder como otro usuario y volver',
        summary: 'Usá el acceso temporal sin perder la página, los filtros ni la posición de origen.',
        duration: '4 min',
        icon: 'switch_account',
        keywords: ['impersonar', 'acceso temporal', 'volver a mi cuenta', 'usuario', 'contexto'],
        safety: 'El acceso temporal es una acción auditada. No cambies datos ni credenciales del usuario durante una revisión o capacitación.',
        steps: [
          { title: 'Preparar el contexto de origen', body: ['Abrí la pantalla desde la que necesitás asistir al usuario.', 'Aplicá los filtros necesarios y anotá el resultado esperado.'], image: S + 'desktop/23_admin_usuarios.png', alt: 'Gestión de usuarios del administrador', expected: 'La pantalla de origen queda lista para comprobar el regreso.' },
          { title: 'Elegir el usuario', body: ['Abrí Usuarios y buscá por nombre, correo o rol.', 'Verificá identidad y organización antes de continuar.'], image: S + 'desktop/23_admin_usuarios.png', alt: 'Listado de usuarios con acceso temporal', expected: 'El usuario correcto está identificado.' },
          { title: 'Iniciar el acceso temporal', body: ['En Ver como otro usuario, elegí Capacitación para el ejercicio y seleccioná una cuenta CAP. Cada categoría muestra hasta cinco cuentas.', 'Confirmá la banda Capacitación · sin validez oficial y el rol. La captura muestra el selector de práctica; no autoriza acciones sobre usuarios reales.'], image: S + 'desktop/training-selector-20261012.png', caption: QA_TRAINING, alt: 'Selector de capacitación con grupos de cinco usuarios', expected: 'La sesión temporal está activa y claramente señalizada.' },
          { title: 'Realizar la consulta', body: ['Navegá únicamente por las pantallas necesarias.', 'Evitá crear, aprobar, cancelar o modificar registros si no existe autorización expresa.'], image: S + 'desktop/47_dashboard_generador.png', alt: 'Vista de un usuario durante acceso temporal', expected: 'La consulta se completa sin afectar datos ajenos.' },
          { title: 'Volver a mi cuenta', body: ['Usá Volver a mi cuenta desde el indicador de acceso temporal.', 'Comprobá que regresaste a la página, filtros y posición originales.'], image: S + 'desktop/23_admin_usuarios.png', alt: 'Regreso a la cuenta administrativa', expected: 'La identidad administrativa y el contexto de navegación quedan restaurados.' }
        ]
      },
      {
        id: 'administrador-revisar-generador',
        profile: 'administrador',
        title: 'Revisar un generador del padrón',
        summary: 'Buscá un establecimiento y verificá identificación, habilitación y estado.',
        duration: '4 min',
        icon: 'factory',
        keywords: ['padrón', 'generador', 'cuit', 'certificado', 'habilitación'],
        steps: [
          { title: 'Abrir Generadores', body: ['Ingresá en Administración y seleccioná Generadores.', 'Usá esta pantalla en modo consulta durante la capacitación.'], image: S + 'desktop/26_admin_generadores.png', alt: 'Administración de generadores', expected: 'El padrón de generadores está visible.' },
          { title: 'Buscar el registro', body: ['Buscá por razón social, CUIT o certificado.', 'Evitá términos ambiguos cuando existan empresas con nombres similares.'], image: S + 'desktop/26_admin_generadores.png', alt: 'Búsqueda de un generador', expected: 'La lista queda reducida al registro esperado.' },
          { title: 'Revisar el detalle', body: ['Abrí el generador y verificá domicilio, contacto, categoría y habilitación.', 'Contrastá cualquier diferencia con la fuente oficial.'], image: S + 'desktop/64_generador_detalle.png', alt: 'Detalle de un generador', expected: 'El estado del registro puede documentarse sin editarlo.' },
          { title: 'Registrar la observación', body: ['Si encontrás una inconsistencia, copiá el enlace o identificador.', 'Escalá la corrección por el procedimiento autorizado.'], image: S + 'desktop/35_admin_auditoria.png', alt: 'Auditoría del sistema', expected: 'La revisión finaliza sin alterar el padrón durante la consulta.' }
        ]
      },
      {
        id: 'administrador-revisar-transportista',
        profile: 'administrador',
        title: 'Revisar transportista, flota y choferes',
        summary: 'Validá habilitación, vehículos y conductores asociados al transportista.',
        duration: '5 min',
        icon: 'local_shipping',
        keywords: ['padrón transportista', 'flota', 'vehículos', 'choferes', 'habilitación'],
        steps: [
          { title: 'Abrir Transportistas', body: ['Ingresá en Administración y seleccioná Transportistas.', 'Buscá por razón social, CUIT o habilitación.'], image: S + 'desktop/28_admin_transportistas.png', alt: 'Administración de transportistas', expected: 'El transportista correcto está identificado.' },
          { title: 'Verificar habilitación', body: ['Revisá número, estado y vencimiento.', 'Confirmá los datos de contacto y domicilio.'], image: S + 'desktop/63_transportista_detalle_flota.png', alt: 'Detalle de transportista y habilitación', expected: 'La vigencia del transportista queda comprendida.' },
          { title: 'Revisar vehículos', body: ['Consultá dominio, tipo y estado de cada vehículo.', 'No edites la flota durante una revisión de capacitación.'], image: S + 'desktop/34_admin_vehiculos.png', alt: 'Vehículos habilitados del transportista', expected: 'La flota asociada coincide con el padrón.' },
          { title: 'Revisar choferes', body: ['Comprobá la nómina de conductores y sus datos habilitantes.', 'Escalá cualquier diferencia antes de asignar un viaje.'], image: S + 'desktop/63_transportista_detalle_flota.png', alt: 'Flota y conductores del transportista', expected: 'Vehículos y choferes quedan verificados sin modificaciones.' }
        ]
      },
      {
        id: 'administrador-revisar-operador',
        profile: 'administrador',
        title: 'Revisar un operador y sus tratamientos',
        summary: 'Validá la habilitación del operador y los métodos autorizados.',
        duration: '4 min',
        icon: 'science',
        keywords: ['padrón operador', 'tratamientos', 'habilitación', 'planta'],
        steps: [
          { title: 'Abrir Operadores', body: ['Ingresá en Administración y seleccioná Operadores.', 'Buscá por razón social, CUIT o habilitación.'], image: S + 'desktop/31_admin_operadores.png', alt: 'Administración de operadores', expected: 'El operador correcto queda seleccionado.' },
          { title: 'Revisar la habilitación', body: ['Abrí el detalle y verificá estado, domicilio y categoría.', 'Confirmá que la información corresponda a la planta.'], image: S + 'desktop/65_operador_detalle.png', alt: 'Detalle de un operador', expected: 'La identidad y la vigencia del operador están verificadas.' },
          { title: 'Consultar tratamientos', body: ['Abrí el catálogo de tratamientos asociados.', 'Compará los métodos habilitados con la operación prevista.'], image: S + 'desktop/33_admin_tratamientos_grid.png', alt: 'Catálogo de tratamientos', expected: 'Los tratamientos autorizados pueden identificarse con claridad.' },
          { title: 'Escalar diferencias', body: ['No modifiques el padrón durante una consulta.', 'Documentá y derivá cualquier inconsistencia por el circuito autorizado.'], image: S + 'desktop/35_admin_auditoria.png', alt: 'Auditoría de acciones administrativas', expected: 'La revisión termina sin cambios no planificados.' }
        ]
      },
      {
        id: 'auditor-consultar-actividad',
        profile: 'auditor',
        title: 'Consultar actividad y trazabilidad',
        summary: 'Filtrá eventos, identificá al responsable y reuní evidencia sin modificar datos.',
        duration: '4 min',
        icon: 'policy',
        keywords: ['auditoría', 'actividad', 'usuario', 'evento', 'trazabilidad'],
        steps: [
          { title: 'Abrir Auditoría', body: ['Ingresá en Auditoría desde el menú principal.', 'Confirmá que estás trabajando con el período correcto.'], image: S + 'desktop/35_admin_auditoria.png', alt: 'Registro de auditoría de SITREP', expected: 'La actividad del sistema está visible en modo consulta.' },
          { title: 'Aplicar filtros', body: ['Filtrá por fecha, usuario, acción o módulo.', 'Combiná filtros sólo cuando ayuden a aislar el evento.'], image: S + 'desktop/35_admin_auditoria.png', alt: 'Filtros del registro de auditoría', expected: 'Los resultados muestran únicamente el alcance investigado.' },
          { title: 'Revisar el evento', body: ['Abrí el evento y verificá usuario, fecha, IP y acción.', 'Relacioná el evento con el manifiesto o actor correspondiente.'], image: S + 'desktop/58_manifiesto_timeline.png', alt: 'Eventos vinculados a un manifiesto', expected: 'La acción y su responsable quedan identificados.' },
          { title: 'Conservar la evidencia', body: ['Exportá o documentá el resultado según el procedimiento vigente.', 'No modifiques registros desde otros perfiles durante la investigación.'], image: S + 'desktop/59_reportes_exportar.png', alt: 'Opciones de exportación de reportes', expected: 'La evidencia queda disponible sin alterar el sistema.' }
        ]
      },
      {
        id: 'resolver-gps',
        profile: 'transportista',
        title: 'Resolver problemas de GPS',
        summary: 'Recuperá permisos, conectividad y seguimiento durante un viaje activo.',
        duration: '5 min',
        icon: 'location_off',
        keywords: ['gps no funciona', 'ubicación', 'permiso', 'sin conexión', 'viaje'],
        steps: [
          { title: 'Confirmar el viaje activo', body: ['Verificá que el manifiesto esté EN TRÁNSITO.', 'El GPS no se inicia para viajes todavía APROBADOS o ya ENTREGADOS.'], image: S + 'mobile/M11_transporte_perfil_viaje_mobile.png', alt: 'Viaje activo del transportista', expected: 'El viaje cumple la condición necesaria para transmitir ubicación.' },
          { title: 'Revisar permisos', body: ['Abrí los permisos del navegador o de la PWA.', 'Permití ubicación precisa mientras usás la aplicación.'], image: S + 'mobile/M16_configuracion_mobile.png', alt: 'Configuración móvil de SITREP', expected: 'La aplicación tiene permiso de ubicación.' },
          { title: 'Comprobar conectividad', body: ['Revisá el indicador de conexión.', 'Si estás sin señal, mantené la aplicación abierta: los puntos pendientes se sincronizan al volver la conexión.'], image: S + 'mobile/mobile_transportista_ruta.png', alt: 'Ruta móvil del transportista', expected: 'El viaje continúa y la aplicación informa su estado de conexión.' },
          { title: 'Reanudar el seguimiento', body: ['Volvé al viaje y comprobá el indicador GPS.', 'Si persiste el error, cerrá y abrí la PWA sin confirmar nuevamente el retiro.'], image: S + 'mobile/M22_viaje_gps_activo_mobile.png', alt: 'GPS activo en un viaje', expected: 'El seguimiento vuelve a mostrarse activo sin duplicar eventos.' }
        ]
      }
    ]
  };

  // Keep the existing guide and visual treatment; align its order with the three-step form.
  var createGuide = window.SITREP_HELP.guides.find(function (guide) { return guide.id === 'generador-crear-manifiesto'; });
  var actorStep = createGuide.steps[1];
  createGuide.steps[1] = createGuide.steps[2];
  createGuide.steps[2] = actorStep;
  actorStep.image = S + 'desktop/training-fleet-20261018.png';
  actorStep.caption = 'Datos sintéticos · preview aislado · 18/10/2026. No acredita Android físico.';
  actorStep.alt = 'Vehículo y chofer de la nómina del transportista CAP seleccionados';
  actorStep.body.push('En Destino, elegí el vehículo y el chofer ya registrados del transportista. Si cambiás de transportista, volvé a seleccionarlos. Después de crear, verificá Transporte asignado en el detalle.');
  createGuide.steps[3].body = ['Revisá los datos y pulsá Crear Manifiesto. Se guarda como BORRADOR.', 'Reabrí el detalle antes de firmar; si necesitás corregirlo, hacelo mientras siga en borrador.'];
  createGuide.steps[4].body = ['Abrí el borrador validado y pulsá Firmar Manifiesto.', 'Dibujá la firma → Usar firma → Confirmar y Firmar. Comprobá APROBADO antes de pasar el turno al transportista.'];

  // Classroom links identify existing synthetic records; they never switch
  // identity, enable training, create records or bypass the application's ACL.
  var workshop = window.SITREP_HELP.guides[0];
  workshop.summary = '90 minutos · Un caso completo, cinco equipos y accesos directos para web y app.';
  workshop.keywords.push('golden path', 'guion', 'CAP', 'equipos');
  workshop.steps[0].body = [
    'Antes del taller: comprobá tu ingreso y usá un perfil de navegador separado de los formularios reales. Con correos apagados, no dependas de recuperar la contraseña durante la clase. Conservá el APK instalado; no borres sus datos.',
    'Para el recorrido de cuatro teléfonos, cada participante entra directamente con el acceso de capacitación de su rol entregado por el instructor. Comprobá «Capacitación · sin validez oficial». Para los demás equipos y perfiles, el instructor conserva Administrador → Ver como otro usuario → Capacitación; sólo en ese caso se usa Volver a mi cuenta. Estos enlaces no inician sesión ni cambian el rol: cada participante conserva su acceso.',
    'Equipo 1: demostración. Equipos 2–4: práctica. Equipo 5: reserva con respuestas de QA ya cargadas. Mantené el mismo número al cambiar de rol y un solo responsable por registro. No compartas tu contraseña personal; los accesos de aula son exclusivos de capacitación.',
    'Las cuentas se llaman CAP · ADMIN N, INSPECTOR N, GENERADOR N, TRANSPORTISTA N y OPERADOR N. También hay ADMIN_GENERADOR N, ADMIN_TRANSPORTISTA N y ADMIN_OPERADOR N para consulta sectorial. Reemplazá N por tu equipo, del 1 al 5.',
    'Los enlaces App abren la web móvil. Dentro del APK, seguí estos mismos números desde su menú si el manual se abrió en otro navegador. No instales ni actualices el APK para hacer este recorrido.'
  ];
  workshop.steps[0].resources = [{ label: 'Elegir cuenta CAP · requiere administrador', path: '/switch-user?modo=capacitacion' }];
  workshop.steps[1].body = [
    'Abrí un alta en modo revisión. Para la demostración, usá Transportista: completá datos ficticios y agregá un chofer en Flota y choferes. No uses documentos personales.',
    'Descargá la licencia sintética de abajo y elegila en el campo de licencia. Compará las propuestas OCR con el original antes de usar los datos seleccionados. OCR no aprueba identidad, pagos ni habilitación.',
    'Guardá, salí del alta de práctica y recuperá el borrador en ese mismo navegador. Comprobá campos y paso; los archivos deben volver a elegirse. No presentes un trámite real. El TEF dinámico no se muestra al solicitante.'
  ];
  workshop.steps[1].resources = ['generador', 'transportista', 'operador'].map(function (role) {
    return { label: 'Probar alta · ' + role, path: '/inscripcion/' + role + '?modo=revision' };
  }).concat([{ label: 'Licencia sintética · sin validez', href: '/manual/fixtures/licencia-capacitacion.png', action: 'Descargar PNG', download: true }]);
  workshop.steps[2].body = [
    'Generador N: abrí CAP-N-BORRADOR, revisá actores y residuo y firmá. Verificá APROBADO. El número conserva «BORRADOR» aunque cambie el estado.',
    'Volvé al administrador y elegí TRANSPORTISTA N. Abrí el mismo manifiesto: confirmá retiro y entrega. Verificá EN_TRANSITO y ENTREGADO antes de pasar el turno.',
    'Elegí OPERADOR N: recibí, revisá pesaje, registrá tratamiento y cerrá. Verificá TRATADO y la cronología. Las descargas oficiales están deshabilitadas en capacitación.',
    'Si falta tiempo, CAP-N-APROBADO es otro caso para empezar desde retiro. CAP-N-TRATADO sirve de consulta. No finjas continuidad entre ellos ni reinicies un caso ya utilizado.'
  ];
  workshop.steps[2].body.push('Para practicar un alta de manifiesto: Nuevo manifiesto → residuo → transportista de tu equipo → vehículo y chofer de su nómina → operador del mismo equipo → Crear Manifiesto. Anotá el nuevo número y usalo en todos los relevos. Si cambiás de transportista, volvé a elegir vehículo y chofer; no se reemplazan automáticamente.');
  workshop.steps[2].resources = [{ label: 'Crear un caso nuevo · cuenta GENERADOR CAP', path: '/manifiestos/nuevo' }, { label: 'Eventuales y adendas · práctica adicional', href: '/manual/tutorial.html?guide=capacitacion-novedades' }];
  workshop.steps[3].body = [
    'Campo: INSPECTOR N abre CAP-I-N-GENERADOR → Visita → Iniciar visita → Controles. Marcá un control, guardá y reabrí. Es trabajo de campo, todavía no el expediente publicado que verá el actor.',
    'Intercambio: GENERADOR, TRANSPORTISTA u OPERADOR N abre su CAP-P-N-ROL-A en Mis inspecciones. Leé el último requerimiento → Responder esta actuación → Presentar en expediente. Reabrí para verificar el guardado.',
    'Autoridad: ADMIN N abre ese mismo CAP-P en Expediente → Comunicaciones, revisa y registra una decisión con fundamento. Volvé al actor para comprobarla. Responder no significa aprobar.',
    'Son dos ejercicios distintos: visita de campo e intercambio preparado. El actor no ve inspecciones generales ni borradores del inspector. Si el caso ya cambió de estado, seguí su historial; no lo restablezcas.'
  ];
  workshop.steps[4].body = [
    'Actor CAP: Ayuda → Reportar problema. Describí el problema; adjunto opcional. Esperá la confirmación y anotá el número. Los tickets de abajo son reservas ya creadas, no el ticket nuevo.',
    'Volvé como ADMIN N de Capacitación, no como administrador operativo. Abrí el ticket del autor → Asignarme → Derivar a otro ADMIN CAP habilitado → Nota interna → Responder. Los tickets de reserva ya tienen responsable; no des por demostrado Asignarme con uno que ya era tuyo.',
    'Volvé al autor: abrí el mismo número, leé la respuesta pública y cerrá sólo después de comprobarla. Las notas internas quedan reservadas a soporte. No esperes un correo.'
  ];
  workshop.steps[4].resources = [{ label: 'Mis tickets / Mesa de soporte · según cuenta CAP', path: '/soporte' }];
  workshop.steps[5].body = [
    'ADMIN CAP: Centro de Control → 30 días → Viajes Activos → buscá CAP-1-EN_TRANSITO y seleccionalo. Activá y desactivá En Tránsito para comprobar las capas. El rango debe incluir el 12/10/2026; no uses Hoy para buscar los casos preparados.',
    'Monitor → Historial → Pausar → mové la barra → Reproducir. Pendientes muestra lo que falta; En vivo vuelve al estado actual. Son ubicaciones sintéticas, no un viaje físico en vivo.',
    'Cada participante encuentra su próxima tarea y sabe volver al manual o pedir ayuda. En los teléfonos, comprobar cámara QR, permisos GPS y recuperación de red. Navegador y emulador no certifican batería ni segundo plano.',
    'Si falta confirmación, conservá el formulario y consultá estado/historial antes de reintentar. Si desaparece la banda CAP, detené las modificaciones. No borres almacenamiento ni reinicies registros.',
    'Anotá cualquier pendiente con rol, pantalla, número CAP, hora y resultado esperado. No activar correos, push, reglas masivas ni documentos oficiales durante el taller.'
  ];
  workshop.steps[5].resources = [{ label: 'Centro de Control · consulta CAP', path: '/centro-control' }, { label: 'Monitor · consulta CAP', path: '/monitor' }];

  function teams(records) {
    return [1, 2, 3, 4, 5].map(function (n) {
      return { label: 'Equipo ' + n, note: n === 1 ? 'Demostración' : n === 5 ? 'Reserva · contiene pruebas previas' : 'Práctica', records: records(n) };
    });
  }
  workshop.steps[2].teams = teams(function (n) {
    return [
      { label: 'CAP-' + n + '-BORRADOR', role: 'Generador → Transportista → Operador · mismo número', path: '/manifiestos/cap-20261012-manifiesto-' + n + '-BORRADOR' },
      { label: 'CAP-' + n + '-APROBADO', role: 'Alternativa desde retiro · otro caso', path: '/manifiestos/cap-20261012-manifiesto-' + n + '-APROBADO' },
      { label: 'CAP-' + n + '-TRATADO', role: 'Cierre preparado · sólo consulta', path: '/manifiestos/cap-20261012-manifiesto-' + n + '-TRATADO' }
    ];
  });
  workshop.steps[3].teams = teams(function (n) {
    var records = [{ label: 'CAP-I-' + n + '-GENERADOR', role: 'Inspector · trabajo de campo', path: '/inspecciones/cap-20261012-inspeccion-' + n + '-GENERADOR' }];
    ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR'].forEach(function (role) {
      var id = 'cap-20261012-participacion-' + n + '-' + role + '-abierta';
      records.push({ label: 'CAP-P-' + n + '-' + role + '-A', role: role + ' · Mis inspecciones', path: '/mis-inspecciones/' + id });
      records.push({ label: 'CAP-P-' + n + '-' + role + '-A', role: 'ADMIN · revisar respuesta de ' + role, path: '/inspecciones/' + id });
    });
    return records;
  });
  workshop.steps[4].teams = teams(function (n) {
    return ['generador', 'transportista', 'operador'].map(function (role) {
      return { label: 'CAP · Consulta de ' + role + ' ' + n, role: 'Reserva · autor ' + role + ' ' + n + ' / ADMIN ' + n, path: '/soporte/cap-20261012-ticket-' + role + '-' + n };
    });
  });
  window.SITREP_HELP.guides.push({
    id: 'capacitacion-novedades', profile: 'generador', audiences: ['transportista', 'operador', 'administrador'],
    title: 'Eventuales, adendas y transporte · práctica simple',
    summary: 'Tres novedades en web y app. Elegí un equipo CAP y seguí los mismos botones.', duration: '15 min', icon: 'school',
    keywords: ['eventual', 'eventuales', 'adenda', 'adendas', 'móvil', 'vehículo', 'chofer', 'incompleto', 'capacitación', 'novedades'],
    safety: 'Sólo con la banda «Capacitación · sin validez oficial». Estas funciones están habilitadas en el aula; siguen apagadas en la operación real. No se envían correos ni push ni se emiten documentos oficiales.',
    steps: [
      { title: 'Entrar al aula y elegir un equipo', body: [
        'Con cuatro teléfonos, usen los accesos directos de capacitación del equipo 1 y conserven cada rol. El generador inicia esta práctica. Para otros equipos, el instructor ingresa como administrador y usa Elegir cuenta CAP. Usá el mismo N para todos los roles; 1 es demostración, 2–4 práctica y 5 reserva.',
        'Comprobá la banda «Capacitación · sin validez oficial». Para cambiar de rol: Volver a mi cuenta → Capacitación → cuenta del mismo equipo. Web y App usan los mismos pasos.',
        'Cada ejercicio crea su propio registro. Anotá su número o guardá su enlace; no reinicies los casos anteriores.'
      ], expected: 'Estás en el aula con un equipo identificado.', resources: [{ label: 'Elegir cuenta CAP', path: '/switch-user?modo=capacitacion' }] },
      { title: 'Elegir móvil y chofer ya registrados', body: [
        'GENERADOR CAP: Manifiestos → Nuevo manifiesto. Completá el residuo de práctica y elegí el transportista de tu equipo.',
        'En Vehículo y Chofer, seleccioná CAP00N y Chofer ficticio N de las listas de ese transportista. Elegí el operador del mismo equipo y creá el manifiesto.',
        'Reabrí el detalle y verificá Transporte asignado. Si cambiás de transportista, las selecciones anteriores se limpian: elegilas otra vez. No inventes una asignación si la nómina está vacía.',
        'Cada parte aprueba desde su cuenta: generador firma; transporte y operador aprueban su participación. Crear no aprueba por los demás. Usá este número para el recorrido y la adenda antes de liberar la disposición final.'
      ], image: S + 'desktop/training-fleet-20261018.png', alt: 'Asignación de vehículo y chofer del equipo CAP', caption: 'Datos sintéticos · preview aislado · 18/10/2026.', expected: 'El manifiesto conserva el vehículo y el chofer elegidos.', resources: [{ label: 'Nuevo manifiesto', path: '/manifiestos/nuevo' }] },
      { title: 'Registrar un Eventual con datos pendientes', body: [
        'GENERADOR CAP: Manifiestos → Eventuales → Registrar operación. Tu parte se toma de la sesión. Al menos una de las otras partes debe estar fuera del padrón; si todas están registradas, usá el manifiesto ordinario.',
        'Para la práctica: dejá Transportista fuera del padrón y buscá al OPERADOR CAP de tu equipo en el padrón. Cargá sólo los datos conocidos. Podés dejar identificación o domicilio pendientes; no inventes datos. Completá corriente Y1, cantidad 10 kg y el motivo ficticio.',
        'Guardá y anotá el registro BI-. Aprobá como quien lo creó. El retiro sigue bloqueado hasta que el operador registrado apruebe como operador: avisale a la persona con ese teléfono que abra el mismo registro. Si el instructor practica solo, puede usar el selector CAP.',
        'Con todas las aprobaciones, registrá retiro, recepción y tratamiento. Si hay una diferencia, registrala por separado. La revisión documental no cambia esos hechos ni otorga un número oficial.'
      ], image: S + 'desktop/training-eventual-20261018.png', alt: 'Eventual CAP tratado con una revisión observada que conserva los hechos', caption: 'Datos sintéticos · preview aislado · 18/10/2026.', expected: 'Se conserva lo declarado, los datos pendientes y la aprobación de cada participante con cuenta.', resources: [{ label: 'Eventuales · cuenta CAP', path: '/manifiestos/baja-intensidad' }] },
      { title: 'Agregar lo observado sin reescribir el original', body: [
        'TRANSPORTISTA CAP: abrí el manifiesto ordinario ya firmado del paso 2 → Adendas → Registrar diferencia. También puede registrar el operador vinculado.',
        'Ingresá la carga observada completa, por ejemplo Y1 · 12 kg, y un motivo concreto: «CAP: se observaron 12 kg frente a 10 kg declarados». Guardá y solicitá revisión. No se suma automáticamente a la carga original.',
        'GENERADOR CAP: abrí las Adendas del mismo manifiesto. Compará Declaración conservada y Carga observada. Escribí el fundamento y elegí Aprobar post facto, Observar o Rechazar conformidad. Quien creó la adenda no se aprueba a sí mismo.',
        'Reabrí y verificá la revisión y el original intacto. Si la adenda estaba equivocada, Agregar rectificación crea otra y conserva el antecedente. Registrar una diferencia no demuestra intención ni habilita una corriente; el circuito operativo continúa y la revisión queda trazada.'
      ], image: S + 'desktop/training-addendum-20261018.png', alt: 'Adenda CAP con declaración original y carga observada separadas', caption: 'Datos sintéticos · preview aislado · 18/10/2026.', expected: 'El original sigue intacto y la diferencia tiene autor, motivo y revisión. En capacitación no se descargan anexos oficiales.' }
    ]
  });

  // One shared case, four persistent sessions: no role switching during the relay.
  window.SITREP_HELP.guides.push({
    id: 'capacitacion-cuatro-telefonos', profile: 'administrador', audiences: ['generador', 'transportista', 'operador'],
    title: 'Un manifiesto, cuatro teléfonos',
    summary: 'Cada persona conserva su rol. Crean un caso, siguen su viaje en C3 y comprueban juntos el cierre.',
    duration: '25 min', icon: 'devices', keywords: ['cuatro teléfonos', '4 celulares', 'capacitación', 'GPS', 'C3', 'generador', 'transportista', 'operador', 'administrador'],
    safety: 'Sólo con «Capacitación · sin validez oficial» en los cuatro teléfonos. Cada participante usa el acceso de capacitación de su rol entregado por el instructor. No se necesita la cuenta administradora personal.',
    steps: [
      { title: 'Entrar en los cuatro teléfonos · cada participante', body: [
        'Usen todos Web o todos App para la primera vuelta. Cada participante ingresa con el correo y la contraseña de capacitación de su rol, entregados por el instructor: admin@capacitacion.invalid, generador@capacitacion.invalid, transporte@capacitacion.invalid u operador@capacitacion.invalid. Los cuatro accesos directos pertenecen al equipo 1; no requieren una cuenta administradora personal. Están disponibles sólo durante la ventana de capacitación anunciada por el instructor.',
        'Cada participante conserva ese rol hasta terminar. Deben ser cuatro teléfonos o perfiles de navegador independientes. Confirmá la banda de capacitación y CAP · ADMIN 1, CAP · GENERADOR 1, CAP · TRANSPORTISTA 1 o CAP · OPERADOR 1. Al terminar, cada uno cierra su sesión. El acceso directo no guarda una sesión administradora a la que volver.',
        'Antes de la clase: tocar Activar sonido en cada teléfono. Los avisos aparecen solos con la app abierta, aproximadamente cada 4 segundos, y se abren con Abrir manifiesto. Con el teléfono bloqueado no se promete sonido ni push. Conexión a Internet en los cuatro; ubicación del teléfono de transporte activada y permiso permitido para SITREP. Durante el seguimiento, mantener la pantalla de viaje abierta y el teléfono desbloqueado. Probar el permiso y un envío real en ese teléfono: una prueba de navegador no certifica GPS físico ni segundo plano.'
      ], expected: 'Cuatro pantallas, cuatro roles del mismo equipo y conexión lista.', resources: [{label:'Ingresar con mi acceso de capacitación',path:'/login'}] },
      { title: 'Crear y aprobar · las tres partes', body: [
        'Puede iniciar cualquiera: operador, transporte, generador o administrador CAP. Para la primera vuelta, que lo cree el operador. Manifiestos → Nuevo: Generador 1, Y-CAP, 10 kg, Transporte 1, CAP001, Chofer ficticio 1 y Operador 1. Elegí la fecha prevista de retiro y tocá Crear Manifiesto. La parte de tu cuenta queda fija.',
        'Anoten el número. Generador, transporte y operador reciben un aviso visible sin ir a buscarlo. Toquen Abrir manifiesto: generador toca Firmar Manifiesto, dibuja su firma, Usar firma y Confirmar y Firmar; transporte toca Aprobar como transporte; operador toca Aprobar como operador. El administrador observa, no aprueba por ellos. Cada parte puede rechazar indicando motivo; una propuesta rechazada no se retira.',
        'Cada uno avisa «Aprobé mi participación». Sólo con las tres aprobaciones pasa a Aprobado. Una de las tres partes toca Iniciar coordinación: todos reciben el aviso y empieza el reloj de preparación. Generador prepara la carga y operador coordina la recepción. Sólo el retiro físico inicia el viaje y GPS. En Manifiestos → Ver manifiestos programados están los mismos casos, ordenados por fecha, con búsqueda por número y páginas de 50. Para practicar la agenda, hagan otra propuesta para mañana; para el viaje de esta vuelta usen hoy. No reutilicen un caso preparado para simular el avance de éste.'
      ], image: S + 'desktop/training-fleet-20261018.png', alt: 'Vehículo y chofer registrados del equipo CAP', caption: 'Datos sintéticos · preview aislado · 18/10/2026.', expected: 'El mismo número tiene tres aprobaciones independientes, vehículo, chofer y fecha. La coordinación queda iniciada, separada del retiro físico.', resources: [{label:'Manifiestos · cualquiera de los cuatro roles CAP',path:'/manifiestos'}] },
      { title: 'Retirar e iniciar GPS · teléfono del transporte', body: [
        'Abrir el menú → Manifiestos (Mis Viajes). Buscar el número compartido por quien lo creó y abrirlo. Si todavía no aparece, tocar Actualizar listado. Comprobar número, origen, destino, vehículo y chofer antes de continuar.',
        'Confirmar retiro. La pantalla pasa a Viaje en Curso. Permitir ubicación cuando el teléfono la solicite. Esperar GPS activo y después el aviso Sync con una hora: ese aviso confirma un envío al servidor.',
        'Avisar «Ya retiré y estoy enviando ubicación». Dejar esta pantalla abierta. GPS activo significa que el teléfono obtuvo posición; no demuestra por sí solo que C3 ya la recibió. Los envíos se hacen aproximadamente cada 30 segundos.'
      ], expected: 'El manifiesto está en tránsito y el teléfono confirma al menos un envío de ubicación.', resources: [{label:'Buscar el número en Manifiestos · transporte CAP',path:'/manifiestos'}] },
      { title: 'Ver el mismo viaje · teléfono del administrador', body: [
        'Centro de Control (Control en la barra de App) → Hoy → Viajes Activos. Buscar el número nuevo y seleccionarlo. Abrir Ver detalle del viaje para comprobar que es el mismo manifiesto; después volver a Control.',
        'Con transporte todavía en Viaje en Curso, hacer un desplazamiento corto y seguro, sin manejar mientras se usa el teléfono. Esperar el siguiente envío y la actualización de C3: entre ambos puede tardar alrededor de un minuto. Comparar el punto y el recorrido antes de confirmar la entrega.',
        'Avisar «Veo el mismo manifiesto y la ubicación recibida en C3». Explicar: una parte propuso, las tres partes aprobaron, el transporte retiró, el teléfono envió su ubicación y el administrador consulta ese mismo viaje. Si no hay posición recibida, decirlo; no presentar las coordenadas de origen o un caso preparado como GPS del teléfono.'
      ], expected: 'El administrador identifica el número correcto y observa una ubicación recibida del transporte.', resources: [{label:'Centro de Control · ADMIN CAP',path:'/centro-control'}] },
      { title: 'Entregar y recibir · transporte y operador', body: [
        'Sólo después de mostrar el viaje en C3, transporte toca Confirmar entrega → Sí, Confirmar Entrega. Espera la confirmación. Avisar «Ya entregué». Entregado todavía no significa recibido.',
        'Operador abre Manifiestos, busca el mismo número y lo abre. El detalle abierto se actualiza aproximadamente cada 30 segundos; al volver a abrirlo consulta el estado actual. Cuando figure Entregado, tocar Confirmar Recepcion.',
        'Registrar Pesaje → Peso real: 10 → Confirmar Pesaje. Es el peso ficticio del ejercicio. Revisar que quedó guardado antes de pasar a tratamiento.'
      ], expected: 'El operador confirmó recepción y pesaje sobre el mismo manifiesto.', resources: [{label:'Buscar el número en Manifiestos · operador CAP',path:'/manifiestos'}] },
      { title: 'Tratar y liberar certificados · operador', body: [
        'Operador: Registrar Tratamiento → observación «CAP: tratamiento ficticio» → Confirmar Tratamiento. En Certificaciones → Emitir certificación parcial: indicar 4 kg, comprobar el método que ya viene del tratamiento y dibujar la firma → Usar firma → Firmar y publicar certificación. La observación es opcional. Los demás ven y descargan ese parcial. Otro parcial sólo puede cubrir lo que falta de los 10 kg recibidos.',
        'Generador, transportista, operador y administrador vuelven a Manifiestos y abren el mismo número. Los cuatro deben ver Tratado y su historial. En C3 deja de ser un viaje activo después de actualizarse; el historial permanece.',
        'Si van a practicar adendas, háganlo antes del final y resuelvan su revisión con otra parte. Después el operador toca Cerrar Manifiesto. Tratado no libera automáticamente ningún documento. Cuando decida liberarlo: Emitir certificación final total → revisar los 10 kg y el método ya cargados → firmar → Firmar y publicar certificación. El final requiere pesaje, estado Tratado y todas las adendas aprobadas. Una vez liberado, se conserva ese expediente y no se agregan ni revisan adendas en este ensayo.',
        'Todos pueden descargar el parcial y el final desde Certificaciones. Los PDF dicen CAPACITACIÓN — SIN VALIDEZ OFICIAL. Los documentos llevan marca C3 y aviso de práctica; el destinatario recibe un aviso al liberarlos. Para repetir, creen otro manifiesto; las decisiones y los documentos liberados permanecen en el historial.'
      ], expected: 'Los cuatro ven el mismo caso tratado y los certificados que el operador decidió liberar y firmó. Nadie cambió de rol.' },
      { title: 'Si algo no aparece · resolver sin trucos', body: [
        'En Inicio, Mi agenda (Agenda de operaciones para ADMIN) muestra cada número y los tres íconos de aprobación: tilde verde aprobado, reloj pendiente. Filtrar Por aprobar, En espera o En curso; elegir Hoy o Próximos días y buscar por número. Tocar la fila abre la acción del caso. Un aviso sin leer no significa una tarea pendiente. Caso que falta: comparar el número y el equipo CAP, volver al listado y tocar Actualizar listado. No crear otro por impaciencia ni cambiar un filtro sin mirar qué estado se busca.',
        'Sin GPS: revisar el permiso del navegador y la ubicación del teléfono, volver a Viaje en Curso, esperar GPS activo y Sync. Mantener Internet y pantalla abierta. Si no llega un envío, registrar el problema y continuar explicando el flujo sin afirmar que se probó seguimiento físico.',
        'Acción sin confirmación: conservar lo cargado y revisar estado/historial antes de reintentar. Si falta la banda CAP, detener las modificaciones y llamar al instructor. No borrar almacenamiento ni usar una cuenta real para destrabar la práctica.',
        'Para Eventuales, usen su registro BI- independiente. Para adendas del viaje, registren y resuelvan la diferencia antes de liberar el certificado final. No mezclen los números de los dos circuitos.'
      ], expected: 'Cada persona sabe qué esperar, cómo comprobarlo y cuándo pedir ayuda.', resources: [{label:'Después: Eventuales y adendas',href:'/manual/tutorial.html?guide=capacitacion-novedades'}] }
    ]
  });
  workshop.steps[2].resources.unshift({label:'Hacer el relevo con cuatro teléfonos',href:'/manual/tutorial.html?guide=capacitacion-cuatro-telefonos'});

})();
