(function () {
  'use strict';

  var S = 'screenshots/';

  window.SITREP_HELP = {
    profiles: [
      { id: 'administrador', label: 'Administrador', icon: 'admin_panel_settings', description: 'Usuarios, padrones, configuración y supervisión.' },
      { id: 'generador', label: 'Generador', icon: 'factory', description: 'Creación, firma y seguimiento de manifiestos.' },
      { id: 'transportista', label: 'Transportista', icon: 'local_shipping', description: 'Retiros, GPS, incidentes y entregas.' },
      { id: 'operador', label: 'Operador', icon: 'science', description: 'Recepción, pesaje, tratamiento y cierre.' },
      { id: 'auditor', label: 'Auditor', icon: 'policy', description: 'Consulta de actividad, evidencia y trazabilidad.' }
    ],

    guides: [
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
          { title: 'Iniciar el acceso temporal', body: ['Seleccioná el ícono de acceso temporal.', 'Confirmá que el encabezado muestre el usuario y rol esperados.'], image: S + 'desktop/03_user_switcher.png', alt: 'Selector de usuario para acceso temporal', expected: 'La sesión temporal está activa y claramente señalizada.' },
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
})();
