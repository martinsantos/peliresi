# Altas, modificaciones, bajas, actividades y representación

Estado: **validado y cerrado sólo en preview el 22/10/2026 a las 15:11:38 Mendoza**. Desde producto publicado `8a4d8225` y cierre `706742ea`. Sólo fuentes del checkout activo y QA sintética en preview. Producción conserva flags actuales (enterprise/multirol apagados), CAP cerrado y correos/push apagados. No consultar ni modificar cuentas o datos reales, main o workflows.

## Regla recibida el 22/10

La misma persona física o jurídica puede ejercer Generador, Transportista y Operador con las actividades aprobadas correspondientes. Una identidad no se duplica para agregar una actividad. Cada entidad/CUIT admite **hasta dos personas usuarias en total**, incluyendo a quien actúa como titular/responsable. Los roles y establecimientos no multiplican ese cupo. Cada persona conserva credencial, autoría, permisos y avisos propios.

El responsable ante SITREP puede gestionar la representación autorizada de la entidad. Un correo de contacto no constituye un permiso. Verificación de correo, aceptación de invitación y revisión de actividad son hechos diferentes. La administración no se transforma en representante por revisar un trámite.

## Cortes de trabajo y comprobación

1. Inventariar alta pública y administrativa de G/T/O, recuperación de formularios, documentos/ATM/electricidad, revisión, observación, aprobación, rechazo, modificación y baja/revocación. Reutilizar los ensayos existentes, contrastados contra código actual.
2. Unificar actividad aprobada y representación: no otorgar una actividad pendiente o inactiva; conservar rol base, pestañas, identidad, empresa y borradores. Resolver el acceso desde el alta al responsable/representante sin crear cuentas por rol.
3. Cupo de dos por entidad en servidor, incluyendo invitaciones vigentes como reserva; deduplicar a la misma persona en varios roles. Probar altas simultáneas, reintento, tercer usuario, invitación vencida/revocada, rol adicional y revocación. No revocar históricos por inferencia: un exceso heredado se informa y bloquea nuevas personas.
4. Formularios web y app: siguiente paso visible, responsable/cupo claros, errores junto a la acción, conservar entrada tras conflicto/red, confirmación y navegación correctas. Mantener diseño y accesibilidad existentes.
5. Avisos de cada etapa: destinatarios, enlace, contexto, idempotencia, preferencias y revocación. Campana y correos capturados/suprimidos; ningún proveedor ni envío externo. Revisar representación entre varios roles sin duplicar avisos a la misma persona.
6. Unitarias y HTTP de autorización/concurrencia; E2E completo de cada actor en escritorio, web angosta y app, incluyendo ATM/OCR artificiales, dos representantes, multirol y errores. Manual con mismo renderer/CSS. Reportar fallos corregidos, evidencia exacta y límites.

## Hallazgos iniciales comprobados en código

- Hay implementación candidata de actividades múltiples (`ACTOR_MULTIROLE_ENABLED`) y de empresas/personas (`ENTERPRISE_ENABLED`), ambas apagadas en producción. No confundir código disponible con circuito publicado/habilitado.
- `empresa.controller.ts` autoriza, invita y valida responsables sin un límite conjunto de personas. Una misma empresa admite hoy más de dos por vías distintas.
- Alta de actividad y administración de representantes son recorridos separados. La aprobación de una solicitud crea la ficha del actor, pero no enlaza el circuito de representación empresarial.
- La lista de actividades aprobadas toma la existencia de la ficha y su aprobación, sin comprobar explícitamente que la ficha de esa actividad siga activa. Debe probarse revocación por actividad con una sesión abierta.
- El gestor de personas muestra accesos por actividad, por lo que una misma persona se repite como si fueran cupos diferentes. El resumen debe contar personas, conservando el detalle de permisos.

Estos hallazgos corresponden a la base anterior a esta tanda. Los resultados de la revisión se separan abajo; ninguna prueba habilita flags productivos.

## Cambios implementados

- Cupo conjunto de dos personas en autorización, invitación, aceptación y designación; reserva de invitaciones vigentes, identidad por ID y rechazo concurrente por entidad.
- Alta revisada y alta administrativa vinculan la identidad del CUIT y su actividad a la entidad, con el revisor como origen de la responsabilidad. No se importan ni reconcilian cuentas históricas. CUIT verificable y correo verificado son necesarios para ese nuevo circuito.
- El responsable puede designar a la segunda persona ya autorizada; no obtiene permisos públicos. Revocar responsabilidad y revocar accesos por actividad son acciones distintas. No se permite que el último responsable abandone la entidad sin designar otro.
- Las actividades inactivas se excluyen de la selección y de las nuevas operaciones; otros roles e históricos se conservan. La eliminación física se rechaza cuando hay varias actividades, inscripciones o historial de representación.
- Avisos transaccionales, una vez por persona, para cambios de representación y ficha. Plantillas de correo de la familia `representacion`, opt-in independiente sin activación; sin contraseñas, tokens ni texto privado. La elegibilidad se comprueba antes de encolar y entregar.
- Los formularios legales y de establecimientos conservan los borradores ante avisos y conflictos. La persona compara la versión recibida; Conservar mis cambios combina sólo sus campos editados con el resto de la versión actual. Guardar queda bloqueado hasta resolverlo.
- CUIT y correos se normalizan antes de crear identidades: espacios, guiones y mayúsculas no deben producir cuentas duplicadas ni rechazos tardíos. El dígito verificador se revisa al inicio con representación habilitada; no acredita inscripción fiscal.
- Manual candidato 2026.22.4, renderer y CSS conservados. La nueva guía identifica expresamente que esta capacidad sigue sólo en preview.

## Matriz de revisión

| Recorrido | Evidencia exigida |
|---|---|
| Alta pública de G/T/O | Cuenta, CUIT, verificación artificial, borrador recuperado, declaración, documentación, observación/corrección y aprobación; rechazo separado sin habilitar operaciones |
| Alta administrativa de G/T/O | Un CUIT/correo canónicos; identidad existente deriva a actividad adicional, sin cambiar contraseña; adjuntos, flota y reintento de carga parcial |
| ATM y electricidad | Comprobante artificial identificado y reservado antes de revisión, sin registrar pago TEF; OCR artificial, categoría/consumo y evidencia original conservada |
| Modificación | Domicilio anterior/nuevo y autor reales del cambio en la misma transacción; error/concurrencia conserva los datos del formulario |
| Baja | Actividad inactiva no puede iniciar operaciones; otros roles e historial se conservan; eliminación física de una identidad compartida o con representación rechazada |
| Multirol | Partir de cada uno de G/T/O y aprobar los otros dos, misma identidad/contraseña, cambios de contexto explícitos, borradores separados y suspensión efectiva |
| Representantes | Máximo dos personas incluyendo titular; reserva de invitación vigente, vencimiento, aceptación, doble solicitud simultánea, designación y revocación separadas |
| Aislamiento | Empresas/establecimientos, manifiestos, edición, PDF, misma sesión tras revocar, acceso personal y listado completo más allá de 200 entidades |
| Comunicaciones | Campana transaccional, una por destinatario, fuente/permisos revalidados, texto controlado; muestras HTML sin proveedor ni envíos |
| Presentación | Escritorio, web angosta y `/app`, navegación real, errores de página y desbordes, manual con diseño anterior |

## Evidencia de validación

- Suites completas: **1.542/1.542 backend y 1.842/1.842 frontend**, sin fallos. Después se ajustó la combinación de campos del formulario concurrente y el texto del error; la regresión dirigida, compilación, tipos y builds se volvieron a ejecutar.
- Matriz de altas, modificaciones, representación y multirol: **66/66 E2E**, sin omitidos ni reintentos, en escritorio, web de 360 px y app de 360 px. El último ajuste de combinación de campos se verifica además en la repetición dirigida final.
- HTTP: **7 grupos de empresa** (215 entidades, 211 accesos), **8 grupos multirol** y **131 solicitudes** del circuito nuevo partiendo de cada uno de los tres actores; tres carreras concurrentes del segundo cupo y tercera persona rechazada. Las 131 solicitudes se repitieron sobre el backend final.
- Continuidad de altas: **39/39 E2E** adicionales, sin omitidos ni reintentos, incluidos borradores públicos y administrativos, sin conexión, conflicto de versiones, reutilización de padrón, licencia OCR, flota, corrección y aprobación. **105 E2E únicos** entre ambas matrices.
- Regresión sobre el último código de producto: **68 backend, 26 frontend y 15 E2E** PASS. Los 15 casos repiten parte de la matriz de 66 y no se suman como recorridos únicos. Manual final con capturas: **8 unitarias y 3 E2E** PASS; dos imágenes cargadas, sin desbordes ni peticiones a la API.
- Backend, tipos y builds web/app finales PASS. Lint de 35 archivos: **0 errores, 49 advertencias**. El manual se volvió a sincronizar byte a byte tras incorporar las imágenes.
- Comunicaciones: 20 variantes de alta/representación, 40 renders a 360/1280 px. Elegibilidad de los últimos **300 avisos reales del ensayo**: 283 fuentes vigentes y 17 descartadas; preferencias y canales se verifican aparte. Cero cola activa, intentos o entregas. Las imágenes de marca se cargan desde archivos locales, sin red; se conservan los 20 HTML originales de la plantilla por separado.
- Auditoría: **849 tablas previas del preview intactas**, dos procesos con CAP cerrado, proveedores sin configurar y correos/push apagados; cuatro alias CAP rechazados con 403. No se enviaron mensajes.

## Ajustes de los ensayos

Los ensayos anteriores requerían actualización de fixtures: CUIT artificial con dígito incorrecto, fecha prevista ausente o timestamp donde corresponde una fecha, y petición de establecimiento incompleta antes de probar su permiso. Se conservaron las validaciones del producto. La prueba de carga parcial ahora distingue un PDF inválido rechazado antes de crear, de una interrupción HTTP después de crear y su reintento sin duplicar.

La prueba de borradores esperaba una frase anterior de guardado local. Ahora exige la confirmación exacta de guardado en SITREP antes de recargar y comprobar la recuperación. Los borradores artificiales de ensayos anteriores se descartan explícitamente desde la UI. Se permite el service worker real en los ensayos: bloquear su registro generaba errores artificiales de consola. No se quitaron las comprobaciones de consola, permisos, desbordes ni escrituras. Un ensayo antiguo de aprobación omitía la verificación del correo; se agregó la pantalla/controlador real con una prueba artificial, conservando el rechazo 409 para una cuenta no verificada. La inspección visual detectó que el bloqueo total de red de la galería ocultaba los logos; se incorporaron sus bytes locales y se exige que ambas imágenes estén completas. Los intentos anteriores se conservan como evidencia separada.

## Manual y comunicaciones

Manual **2026.22.4**, guía `entidad-actividades-representantes`, seis pasos y el mismo renderer/CSS. Describe identidad compartida, actividades revisadas, cupo, invitación, responsable, baja separada y recuperación de cambios. Incluye dos capturas directas sin edición, con procedencia y SHA-256 en `docs/manual/actor-representation-capture-provenance.json`. Los avisos de campana son transaccionales. Las plantillas de la familia `representacion` requieren habilitación independiente y vuelven a revisar fuente y permisos; esta revisión no la habilita ni entrega mensajes.

## Alcance y publicación futura

Esta tanda queda sólo en preview. Producción conserva `8a4d8225`, CAP cerrado y sus flags actuales; no se accedió al servidor productivo durante esta revisión. `main` permanece en `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push, Actions ni migraciones nuevas de esquema.

Para publicar y habilitar este circuito se requiere autorización expresa de la tanda y de los pares de flags `ENTERPRISE_ENABLED`/`VITE_ENTERPRISE_ENABLED` y `ACTOR_MULTIROLE_ENABLED`/`VITE_ACTOR_MULTIROLE_ENABLED`. No reutilizar los bundles QA con API relativa. Mantener correos/push apagados y CAP cerrado. Las cuentas históricas que exceden dos personas se informan; no se revocan, fusionan ni reasignan automáticamente.

Las pruebas usan identidades, documentación ATM y facturas artificiales; no acreditan un pago ni una categoría fiscal. El correo se renderiza sin entrega y la verificación de correo usa el circuito artificial del preview. La app se prueba en Chromium con vistas móviles; no equivale a certificar teléfonos físicos o todos los proveedores de correo.

Artefactos de trabajo: `test-results-actor-representation-20261022/`, ignorados por Git. Fuentes QA versionadas en `frontend/cloud-qa/`; datos exclusivos del esquema `actor_representation_20261022` del preview.

## Cierre reproducible

QA secuencial, un worker, **1 CPU / 2 GiB / swap cero**. Runtime, PostgreSQL de QA y contenedor detenidos a las **15:11:38 Mendoza**; imagen, base y evidencias conservadas. El bloque completo alcanzó el límite de memoria, sin OOM ni procesos terminados; el rechequeo visual de correos no registró presión. El registro de ambos cierres está preservado.

Evidencias locales: `test-results-actor-representation-20261022/` (247 PNG de recorridos y muestras, JSON de resultados y prueba de fuentes). Galería autocontenida `mail-gallery/index.html`; originales sin modificaciones en `mail-gallery/source-templates/`. El paquete final de 32.153.633 bytes tiene SHA-256 `87d904821ebdfb34eeac38b6b5e7388ab45df6da971725c7519f909cf018c0fd`, comprobado al recibirlo. Las capturas son artificiales y no acreditan el estado de producción.

Se verificaron las suites completas antes del último ajuste puntual de combinación de campos; luego se ejecutaron las regresiones dirigidas y E2E indicadas sobre el código final. No sumar esas repeticiones como pruebas únicas. Las últimas modificaciones fueron exclusivamente de QA/manual y se verificaron con lint, pruebas del manual, render de correos y auditoría de entorno. No queda un fallo abierto en las matrices ejecutadas; no es un GO global de todas las funcionalidades del producto.
