# Baja intensidad, actividades múltiples y contrapartes — candidato 15/10

## Corte actual — exportación/conciliación: IMPLEMENTADO, QA pendiente

CSV con filtros aplicados (todas las páginas), original y vínculo actual en columnas separadas; unidades sin mezclar, fórmulas neutralizadas, límite de 10.000 renglones con rechazo explícito, sin truncación. Conciliación por registro/rol en tabla aditiva independiente: sólo revisor designado no autor, CUIT verificable y ficha única, motivo obligatorio, confirmación explícita, revisión optimista/idempotencia y desvinculación sin borrar antecedentes. No cambia declaraciones, acceso de actores, aprobaciones ni cantidades. Los CUIT dudosos y ausentes siguen pendientes, sin bloquear la operación. No incorpora una matriz productiva nueva ni regularización legal automática.

Aviso de pendientes compacto: contador como botón, cierre táctil de44px; mensajes de error completos. Plan de prueba: unit, HTTP autenticado aislado, web1440/móvil360/app390 y APKAndroid15 con descarga CSV real, persistencia/revocación y captura del aviso. Todavía NO probado este candidato; resultados anteriores son histórico. Sin publicar ni envíos, datos reales/formulario humano/localemulator.

## Corte 16/10 — microtexto y seguimiento externo: QA CERRADA, sin publicar

**Candidato probado:** `b0637585ac48184300490a21bad54cff8058168a`, [corrida38897435629 SUCCESS](https://github.com/martinsantos/peliresi/actions/runs/38897435629). Job09:07:40–09:30:33 Mendoza,22m53s después de la cola. Una VM, pruebas seriales; no ejecución pesada local.

| Evidencia | Resultado |
|---|---|
| Builds backend/web/app | 3 PASS |
| Unit backend | 1018/1018,0 fallos/omitidas |
| Unit frontend | 1471/1471,0 fallos/omitidas |
| HTTP autenticado | 40 grupos PASS,6 nuevos de seguimiento |
| E2E web1440/móvil360/app390 | 27/27,0 fallos/omitidas/flaky;272,3s |
| APK QA instalado,Android15 | 13 bloques completos;43 mutaciones200/201;errors/unsafe vacíos |
| Histórico sintético | Byteidéntico |
| Limpieza | Backend/server detenidos09:30:29.195Mendoza; PostgreSQL/emulador y cierrejob SUCCESS |

Android volvió a comprobar sesión/reapertura/logout, roles, borradores multirol, continuidad con diferencias, revisiones independientes, certificado y anexos actual/histórico con bytes exactos, visor nativo y retorno. Se añadió consulta de externos con paginación, rol, totales y apertura del origen sin escrituras de ese recorrido. APK separado/debug y loopbackCustomTab: no certifica firma/actualización del APK original, confianzaTWA/TLS ni cámara/GPS/batería/celular físicos.

Evidencias locales19MB, sin APK descargado: `sitrep-cloud-qa-20261002/manifiestos-v2-38897435629/`. Revisadas capturas de seguimiento en escritorio/webmóvil/app, `apk/16-external-tracking-device.png`, `15-pending-activities-device.png`, `12-returned-from-annex-device.png` y `06-returned-from-pdf-device.png`. Textos/control legibles, sin desborde horizontal en pruebas, «Continuar» sobre borradores y «1 rechazada» visibles. El banner general de avisos aún ocupa bastante alto en móvil: pulido global pendiente, no GO visual de toda la aplicación. Las capturas muestran el viewport, no prueban por sí solas toda la lista; la navegación/paginación/origen se verificó por interacción E2E.

### Intento previo y corrección

Candidato inicial `f6b4683`, [corrida38895880941](https://github.com/martinsantos/peliresi/actions/runs/38895880941), falló antes de Android. No contar ese intento como aprobado.

Primer intento: builds3, backend1018/1018, frontend1470/1470 y HTTP completo PASS. E2E3 PASS/1 FAIL/23 no ejecutados: `getByLabel('Tipo de participante', exact:true)` no podía resolver inequívocamente el selector porque el label contenía también las opciones. Captura/DOM conservados y revisados. Corrección de producto: label explícito htmlFor/id y select hermano; nueva prueba unitaria exige nombre accesible y selección exacta. No se cambian timeout ni selectores E2E. Histórico intacto y cleanup SUCCESS; backend/server detenidos a11:56:29.986UTC; APK no ejecutado en ese intento.

- Avisos/adendas: singular y plural coherentes. Actividades: **Solicitar** sólo cuando no hay expediente vigente, **Continuar** para borrador/observada y **Ver solicitud** para expediente enviado/en revisión. Enlace selecciona la solicitud propia, manteniendo las conversaciones sin enviar por actividad. Si no se puede consultar el estado, no se ofrece crear una solicitud como si no existiera.
- MV2-112, primera parte: `Baja intensidad → Seguimiento de participantes`. Consulta de movimientos con participante sin vínculo al padrón; generador/transportista separados, identificación declarada exacta, 20 movimientos por página, fechas Mendoza, operador informante y enlace al registro original. Los totales cubren todas las coincidencias, separados por corriente/unidad y sólo carga original: no suman adendas ni cuentan personas únicas.
- Permisos: operador ve sus propios registros; sólo autoridad designada existente ve el conjunto. No incorpora una nueva matriz productiva. Identidad dudosa/incompleta no se fusiona por nombre ni se considera infracción. No realiza altas, regularizaciones, intimaciones, numeración, modificaciones de historial ni envíos.
- Pruebas añadidas: unit de filtros/permisos, acciones por estado, enlace de solicitud, errores/vacíos/paginación; HTTP con 21 movimientos, homónimos, identificación incompleta, dos operadores, unidades distintas y ausencia de escrituras; mismo recorrido de consulta en web, web móvil, app y APK QA aislado.
- Fuera de este corte: conciliación de identidades, exportación DGFA, búsqueda transversal de decisiones de adendas, validación regulatoria, agenda, numeración y certificados oficiales. No afirmar MV2-112 completo ni GO global. Sin publicación/manual público, correos, formulario humano o emuladores locales.

Estado del corte anterior al 16/10: **QA cerrada, sin publicación**. Corrida [38741944296, intento 2](https://github.com/martinsantos/peliresi/actions/runs/38741944296/attempts/2) SUCCESS, candidato `cf5ed0c2f9364be5e4774367f26060afcb4048dd`. El corte vigente está al inicio de este informe. No equivale a GO global de Manifiestos V2 ni a certificación del APK de producción.

## Cierre verificado — 16/10

Job 08:10:56–08:27:06 de Mendoza (16m10s), una VM y un trabajador. No nueva modificación de producto al retomar: se probó la corrección de bienvenida de `7343c7a`; `cf5ed0c` agrega sólo evidencia XML fresca del visor. El timeout PDF anterior no se reprodujo, sin ampliar plazos ni relajar aserciones; su causa sigue sin confirmarse y su evidencia se conserva.

| Verificación | Resultado |
|---|---|
| Compilación backend, web y app | 3 PASS |
| Unit backend | 1016/1016; 0 fallos/omitidas |
| Unit frontend | 1462/1462; 0 fallos/omitidas |
| HTTP autenticado sintético | 5 + 9 + 12 + 8 grupos PASS |
| E2E escritorio, responsive y web-app | 24/24; 0 fallos/omitidas/flaky; 217s |
| APK Android 15 | 12 bloques completos; 41 mutaciones 200/201; errors/unsafe vacíos |
| Histórico y compatibilidad | Datos sintéticos previos byte-idénticos; esquema aditivo y cliente anterior PASS |
| Cierre de recursos | Backend/server detenidos 08:27:01.232 Mendoza; cierre PostgreSQL/emulador y job SUCCESS |

Visor probado: certificado → almacenamiento Android con bytes exactos → lectura nativa del contenido → volver a SITREP; anexo actual v1 rechazado y anterior v0 pendiente → contenido y bytes correctos → volver sin recortar encabezado. También pasaron sesión reabierta, teclado/select, cuatro roles, continuidad operativa con adendas, baja intensidad con datos faltantes, revisión entre partes, multirol, borradores de solicitante pendiente y logout con ruta protegida denegada.

Revisión visual directa de capturas: certificado, anexos v0/v1, retorno, actividades aprobadas Android/escritorio y solicitud pendiente Android/web móvil. Sin pantalla vacía, overlay de framework ni desbordamiento en los controles comprobados; solicitante pendiente sin bienvenida operativa ni menú de operaciones. Quedan detalles no bloqueantes de microtexto ya visibles: «1 avisos»/«1 rechazadas», volumen del aviso general y «Solicitar» para actividades con borrador que el servidor reutiliza. No se presenta esta muestra como auditoría visual global.

Evidencias locales fuera del repositorio: `../sitrep-cloud-qa-20261002/manifiestos-v2-38741944296-attempt2/` (18 MB, sin APK): `apk/result.json`, capturas/lecturas nativas, informes unit/E2E/HTTP, histórico y `closure.json`. Certificado API/Android SHA256 idéntico `8499c417dee685cdc1aa2b5a4df9a30fd486e927b454c98e5a2691b7a2beeeb9`. Muestra final de Chrome en la VM: PSS112555 KiB/RSS220308 KiB; no es pico ni prueba de ausencia de fugas. Paquetes Chrome/Google Play Services estables durante el ensayo.

Sin producción, datos reales, correos, push ni formulario humano. Sin emuladores, navegadores de QA, instalaciones o suites locales. No se distribuyó ni reemplazó el APK original. La consulta local `gh run watch` perdió conexión al final; la consulta posterior al servidor confirmó SUCCESS y los artefactos completos fueron descargados y revisados. No confundir ese fallo del monitor con un fallo de la corrida.

## Cambios

- Baja intensidad admite razón social, identificación, domicilio y patente vacíos. Nombre de fantasía y teléfono opcionales; advertencia breve. No inventa una identidad, cuenta, permiso o número oficial. Mantiene autenticación, pertenencia, límites de tamaño y consistencia del residuo/cantidad.
- Una cuenta verificada puede solicitar varias actividades, incluso mientras espera la primera aprobación. Cada solicitud conserva borrador, documentos, revisión y estado propios. Una cuenta suspendida no participa; el token inicial anterior a verificar correo conserva su restricción al borrador original.
- Aprobar otra actividad no reemplaza el rol vigente. Se reutilizan las asociaciones y solicitudes aprobadas existentes, sin migración destructiva ni duplicación de usuario/CUIT. La mera presencia de una ficha no otorga otra actividad.
- El selector «Mis actividades» pide validación al servidor en cada solicitud. Contexto por pestaña, no cambio global de Usuario.rol, impersonación ni ampliación del JWT. Perfil, permisos, actor y caché offline siguen la actividad elegida. Elegir otra actividad descarta únicamente las consultas en memoria mediante navegación; los borradores guardados conservan su propietario.
- «Mi solicitud» permite seleccionar cada actividad y no mezcla mensajes todavía sin enviar.
- La bienvenida operativa sólo se presenta a una cuenta activa no restringida. No anuncia un rol habilitado al solicitante pendiente, ni consume su bienvenida futura; al salir o iniciar otra sesión se descarta el modal anterior.
- Contrapartes vinculadas pueden resolver adendas ordinarias y registros excepcionales; no autores, actores ajenos ni sesiones impersonadas. Se mantiene el camino de autoridad designada para operaciones sin contraparte inscripta. No confundir esta resolución con unanimidad del manifiesto original.
- Aprobar una corriente nueva crea un aviso interno para autoridad designada en la misma transacción. Un reintento no duplica el aviso. No envía correo/push ni modifica habilitaciones. Falta de autoridad configurada impide confirmar esa resolución, no registrar ni continuar los hechos operativos.
- Declaración original, historial de decisiones y anexos anteriores permanecen inmutables. Una rectificación agrega otra adenda; no reescribe ni borra la anterior.

## Guardas y superficies

Flags de candidato: MANIFEST_EXCEPTIONAL_ENABLED, MANIFEST_ADDENDA_ENABLED, MANIFEST_PARTY_REVIEW_ENABLED, ACTOR_MULTIROLE_ENABLED y equivalentes VITE. Por defecto apagados; habilitados sólo en el workflow aislado.

VM GitHub Actions, rama codex/sitrep-manifiestos-v2-20261014, PostgreSQL sintético en 127.0.0.1:55440/sitrep_night_qa_20260926. Backend y web sólo loopback. DISABLE_EMAILS=true, proveedores externos vacíos, blockchain/push desactivados. Un worker; ninguna instalación local.

Pruebas: unit backend y frontend; HTTP real de permisos, aprobación, rechazo, suspensión, concurrencia y replay; Playwright escritorio/móvil/web-app; APK QA separado en Android 15. APK no distribuible, sin firma de producción ni reinstalación del APK humano.

Browser plugin not available: se reutiliza Playwright existente exclusivamente en la VM, no el navegador/formulario humano. URL QA http://127.0.0.1:4177 y /app; escritorio1440×900, web móvil360×800, app web390×844. APK en perfil Pixel7/Android15, capturas nativas1080×2400. No se certifican otros dispositivos ni navegadores.

Secuencia: ingreso real → actividad aprobada → solicitud adicional → guardar/recuperar borrador → registro con identidad incompleta → revisión por contraparte → consultar anexos → cerrar sesión. La variante pendiente conserva dos borradores y rechaza acceso operativo. Los guards observan URL/título, contenido significativo, ausencia de overlay, excepciones JS, controles y desbordamiento; el recorrido de adendas recoge errores de consola. La revisión visual de capturas complementa las aserciones; no implica auditoría exhaustiva de toda la UI.

Comandos del workflow existente: build backend/web/app, suites unit de cada paquete, scripts HTTP cloud-qa, `playwright test --config cloud-qa/manifest.playwright.config.ts`, `gradlew --no-daemon --max-workers=1 assembleDebug` y `node --experimental-strip-types frontend/cloud-qa/manifest-apk.ts`. Guardas antes de escribir; cierre de procesos y PostgreSQL aun en fallos.

## Registro de ejecuciones

### Criterios comprobables del corte

| Caso | Resultado exigido | Evidencia |
|---|---|---|
| Sin identidad/contacto externo ni patente | Se registra y recupera sin inventar datos; no obtiene número oficial | Unit manifiestoExcepcional, HTTP multirol, multirole-journey web/móvil/app/APK |
| Solicitante verificado aún pendiente | Puede mantener solicitudes por actividad; no accede a operaciones | HTTP multirol, pendingMultiRoleJourney, APK restringido |
| Bienvenida y sesión restringida | No se presenta como actor habilitado ni se consume la bienvenida antes de aprobar; la cuenta activa conserva su introducción | AuthContext.test.tsx, E2E sin omitir bienvenida, APK |
| Alta adicional y doble envío | Una cuenta y una solicitud por actividad; aprobación conserva el rol previo | HTTP real con dos POST concurrentes y aprobación administrativa |
| Cambio de actividad | Sólo actividad aprobada, por petición/pestaña; sesión y caché no mezclan actores | Unit actorActivities/actorActivity/offlineActivityCache, HTTP, multirole-journey |
| Borradores y mensajes | Guardado y recuperación del formulario compartido; textos sin enviar separados por solicitud | E2E/APK y MiSolicitudActivities.test.ts |
| Rechazo/suspensión | Rechazar una actividad no quita la anterior; suspender bloquea todas | HTTP multirol |
| Contrapartes y concurrencia | Ajeno no accede, autor no se autoaprueba; revisión versionada y reintento idempotente | Unit partyReview, HTTP, role-handoff y APK |
| Nueva Y aprobada | Aviso interno a autoridad designada sin duplicación por replay, sin habilitar corrientes ni correo | HTTP addenda-integration |
| Historia y anexos | Declaración e histórico sintético intactos; PDF actual y anterior distintos y verificables | HTTP, E2E y visor nativo APK |

- 38731577386, SHA4779a09: builds3 PASS; backend1016/1016 y frontend1457/1457 PASS, sin omitidos. HTTP de asignación/baja intensidad/adendas PASS; nueva fixture multirol FAIL por correo faltante en generador sintético. Corregido en97802dd. No E2E/APK de ese intento. Histórico sintético conservado; procesos cerrados12:09:09.780UTC.
- 38732580670, SHA97802dd: builds3 PASS; backend1016/1016 y frontend1459/1459 PASS, sin omitidos. HTTP completo PASS, incluida alta multirol pendiente/activa, concurrencia, autorización y conservación del histórico. E2E4 PASS,1 FAIL,19 no ejecutados: el selector visible de solicitudes no tenía una asociación de etiqueta inequívoca. Corregido con label/htmlFor e id explícitos, sin quitar la aserción. APK no ejecutado. Procesos cerrados12:19:10.802UTC.
- 38733950758, SHAe73875b: builds3 PASS; backend1016/1016 y frontend1460/1460 PASS, sin omitidos; HTTP completo PASS; E2E24/24 PASS sin skipped/flaky,256s. Cancelada durante construcción APK para revisar el guion: un solicitante restringido no debe ser presentado como actor habilitado. En9b9c2f7 se exige sesión restricted, Mi solicitud, Salir y ausencia de bienvenida/menú operativo; la ejecución posterior detectó que AuthContext sí mostraba indebidamente esa bienvenida. No prueba Android final de este intento. Limpieza12:35:01.255UTC. Capturas de baja intensidad revisadas; capturas de actividades tomadas durante carga NO sirven como evidencia de UI terminada.
- 38735876497, SHA9b9c2f7: cancelada al construir, antes de otras suites; se incorporaron esperas por controles reales para capturas de actividades, no sleeps ni relajación de aserciones. No contar como validación final. No solapamiento: se esperó completed/cancelled antes de subir44ca10d.
- 38736270840, SHA44ca10d: builds3, unit1016+1460, HTTP y E2E24/24 PASS (0 skipped/flaky,224s). Android completó ciclo, baja intensidad, revisión por partes, PDF actual/histórico y multirol activo. FALLÓ al entrar como solicitante pendiente: AuthContext mostraba bienvenida «Sos un Generador» aunque ApplicantLayout y permisos estaban restringidos. Evidencia apk/FAIL-device.png y result.json conservada y vista. No afirmar Android completo. Emulador detenido y limpieza12:56:19.920UTC. Capturas de actividades web/móvil/APK activo cargadas, revisadas.
- 38738847939, SHA7343c7a: corrección del producto: no mostrar ni consumir bienvenida operativa de cuenta pendiente, limpiar modal al cambiar/cerrar sesión; conserva bienvenida inicial de cuenta activa. Builds3, backend1016/1016, frontend1462/1462, HTTP y E2E24/24 PASS (0 skipped/flaky,258s). APK falló antes de las nuevas actividades, al exigir contenido accesible del visor PDF dentro25s. La captura posterior sí muestra el certificado completo, respuestaPDF200 y sin errores JS/peticiones inseguras; esto no convierte la aserción fallida en éxito. VM registró ANR de Pixel Launcher antes del recorrido; no se atribuye con certeza el timeout a ese evento. Limpieza13:18:33.041UTC, emulador detenido. Evidencia conservada y vista.
- SHAcf5ed0c: producto idéntico a7343c7a; sólo guarda el XML fresco exacto usado por la comprobación de PDF para diagnosticar si se repite. No amplía timeout, omite pasos ni acepta sólo título/archivo. Corrida38741944296 intento1 cancelada por pausa expresa del usuario el15/10, limpieza SUCCESS; intento2 retomado el16/10 y cerrado SUCCESS con los resultados de arriba. Ningún solapamiento.

## No incluido ni certificado

Numeración oficial excepcional, unanimidad/agenda/caducidad del manifiesto original, compatibilidad regulatoria de Y, conciliación/exportación DGFA, búsqueda transversal de decisiones de adendas, cierre documental oficial y certificados finales continúan en el backlog. La consulta nueva agrega movimientos/carga original por identificación declarada exacta, no identifica personas únicas ni relaciona automáticamente sus decisiones de revisión.

Pendientes externos: matriz productiva de autoridad designada, identidad/aprobación del generador no inscripto para numeración oficial, destino documental de adendas rechazadas, firma original del APK y teléfonos físicos. No usar la prueba cloud como certificación de firma, confianza TWA/TLS, GPS, cámara o batería reales.
