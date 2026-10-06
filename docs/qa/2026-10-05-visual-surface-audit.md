# Auditoría renderizada de superficies e interacción — 05/10/2026

## QA100 finalizada: cinco fallos anteriores reparados; cierre todavía pendiente

[QA100](https://github.com/martinsantos/peliresi/actions/runs/37449999981),
SHA57331294d2a95cce2002f0fbf611ebaa7856d8c0, terminó FAILURE. Crudos:
**520BE+1128FE unit PASS**, cero omitidos; **178/180E2E PASS**, cero skipped/flaky.
Los cinco fallos99 (tres Control/uno Historial/uno manual) ya aprobaron.
Los nueve E2E soporte aprobaron. Las etapas HTTP/calendario4/territorial/soporte
terminaron SUCCESS; no sumarlos como si fueran endpoints distintos.

Dos fallos E2E nuevos: recuperación web escritorio/responsive registró
altura43.99998474121094px ante mínimo44. Se conserva la exigencia44 exacta.
El formulario usa entrada translateY16px; nueva prueba de estabilidad primero
3PASS/1FAIL, luego20/20 focales al cambiar únicamente su clase de entrada a
fade por opacidad. No agranda controles, no redondea medidas, no baja umbral,
no cambia colores/API/permisos. E2E ahora también exige transformnone.
Los dos PNG100 originales de recuperación se revisaron; no hay rotura visible
de paleta ni campos en esas capturas, y no se afirma que el target visible
fuera43px. DOM unit no acredita geometría; nuevo gate renderizado pendiente.

Android100 **completed:false,7PASS/1FAIL**, restantes no ejecutados:
uiautomator dump salió255/774ms después del reinicio real de Chrome.
Diagnósticos posteriores indican adb deviceoffline, y logcat salió255 sin
stderr; logcat retuvo2MiB de6.24MiB y registra truncación. No afirmar causa raíz
resuelta, ni fallo de identidad de SITREP: la captura nativa falló antes de
las siguientes aserciones. No retocar auth ni aceptar XML viejo/éxito de stdout.
APKoriginal4 comprobaciones públicas no equivalen a APK autenticado.

ZIPfinal único externo native-support-run100-final.zip,116037307bytes,
artifact11407957065,SHA256
`28b11258c517f7208c26e20a836c342ec703559e7671725e666bde07afe614c6` confirmado.
Cleanup runtime6045/server6046 11:03:28.250Z;PGshutdown11:03:28.322Z confirmado.
Sin empaquetado de candidato fallido, sin despliegue ni escrituras reales.

El usuario reitera publicación del refactor/soporte. Producción fue comprobada
en lectura: release20261004-shared-ui-followup-r1 web/backend, dosPM2online,
healthok/DBconnected, cinco symlinks compartidos intactos, correoOFF/pushOFF/
blockchainON,4048332KiB libres. No se recargó. La protección del preparador está
registrada como bloqueo HISTÓRICO, no se comprobó bloqueo nuevo: se retractó
la petición de cambiar configuración por ese dato antiguo. No eludirlo ni usar
un publicador alternativo si sigue bloqueado. El preparador antiguo además
está fijado a otro SHA/esquema; no es apto para activar este candidato tal cual.
Soporte agrega cinco tablas aditivas y exige clientePrisma compatible, respaldo
y transición reversible, conservando datos/dependencias/envíos. Nueva tanda
FULL serial del ajuste de recuperación debe completar antes de publicación.

## QA99 cerrada: soporte aprobado, cinco fallos generales preservados

[QA99](https://github.com/martinsantos/peliresi/actions/runs/37405568999),
fuente `db25564ae1461cf9984efebd18014a24173c9b2e`, terminó FAILURE.
Crudos: **517/517 backend + 1125/1125 frontend unit**, 54 HTTP generales y
12 grupos HTTP soporte PASS. E2E **175/180 PASS, cinco FAIL**, cero omitidos
ni flaky. Los nueve E2E de soporte aprobaron en escritorio1440×900,
responsive360×800 y app360×800: circuito, borrador offline, menú/ACK/lista,
adjuntos con descarga byteporbyte, navegación de filas y aislamiento.
Android15/Chrome emulado **16/16 PASS**, incluido reportar/abrir ticket;
runtimeErrors/failedResponses vacíos. ERR_INTERNET_DISCONNECTED corresponde
al corte offline deliberado. No equivale a probar el APK autenticado ni un
teléfono físico. Producción y sus datos no se modificaron.

Los cinco fallos no se excluyen ni se convierten en aprobación:

- G2/T2/O2 escritorio: período del frontend usa Mendoza, backend terminaba
  el filtro a medianoche UTC; ocultaba la actividad de las últimas tres horas
  del día local. Nuevos unit reprodujeron11PASS/3FAIL; corrección sólo en
  actividad de Centro Control usa límites civiles de Monitor, conserva instantes
  explícitos y rechaza fechas imposibles: **14/14 focales PASS**. La anterior
  expectativa UTC se actualiza al criterio civil confirmado, no a menor umbral.
  Se agrega cuarto HTTP de calendario: dos observaciones separadas por
  medianoche, cohorte persistida real y total del Centro de Control idéntico.
  Gate de empaquetado ahora exige4/4, no3/3.
- Monitor responsive: calendario seleccionó06/10 y pidió corte03:00:35.272Z,
  sin eventos/GPS y con un manifiesto. Un día con manifiesto sin eventos no
  garantiza película. Se conserva esa evidencia y se fortalece el recorrido:
  comprobar vacío real si corresponde, luego navegar días conocidos mediante
  botones hasta un evento explícitamente persistido en el fixture inicial.
  Sin reloj/sesión/API interceptados ni reintentos buscando un PASS. El control
  sigue exigiendo película, cantidades, contraste, popups y30días completos.
- Manual responsive: recarga del enlace7 terminaba mostrando paso6, por
  scroll restaurado y medidas que cambian al cargar capturas. Unit DOM de
  script real reprodujo1PASS/2FAIL. Guarda de restauración conserva enlace,
  realinea al cargar imágenes/fuentes y cede ante scroll/teclado/intención del
  usuario. **15/15 focales** con documentación y fechas PASS, cero omitidos.
  JS versionado2026.16.2; no cambia datos/guías/capturas ni esquema visual.
  Esta prueba DOM no acredita geometría: debe pasar nuevamente el E2E real.

ZIP final único en disco externo `native-support-run99-final.zip`,
136714237bytes, artifact11388835992, SHA256
`419ea738f7237b4e38ec41f0ae68eae85224a4b355e310ebd9e601d624fac248` verificado.
Originales99 vistos: soporte app, soporte Android, ControlG2 fallido y manual
fallido; no revisión universal de todas las capturas. Cierre runtime5994/
server5995 a03:22:22.286Z y PostgreSQL shutdown03:22:22.326Z confirmado.
Empaquetado omitido por gate fallido; no publicación/migración real/envíos.

Siguiente candidato repite suites completas,180E2E/16Android y HTTP, en una VM
serial; los focales aprobados no son GO. Sin Docker/DB/browser/emulador/build
pesados locales, dependencias instaladas ni automatizaciones reactivadas.

## Siguiente candidato: soporte nativo autorizado y retorno del Monitor

### QA96: defecto reproducido y corrección de navegación

Actualización98: cancelada propia al reproducir el envío tardío de un formulario
desmontado después de preparar archivos, con cambio de cuenta mientras se espera
esa preparación. Dos casos iniciales fallaban; ampliados a ACK/navegación y
comprobación de recibo,6PASS4FAIL válidos. Nueva guarda de intención vincula la
cuenta del componente alID del JWT actual antes/después de preparación, antes de
acciones/recibos/descargas y al consumir ACK. No autentica JWT ni concede permisos:
firma, actividad y autorización siguen en backend. Acepta renovación de token
de la misma cuenta; no continúa el formulario desmontado ni toca la nueva sesión.
El borrador original permanece si no hubo envío; ACK verdadero sólo limpia ese
borrador. Focal después48/48 incluye estos casos ydecodificación inválida.
Marcadores unsigned sólo enunit DBdesconectada: NUNCA autenticaciónHTTP/E2E falsa.

98crudos unit517BE+1115FE PASS,0omitidos; HTTP12soporte completo, E2EJSONfinal
ausente por cancelación, no conteosUI/Android98. Cleanup98SUCCESS:runtime6038/
server6039 02:35:30.833Z yPG2026-10-06T02:35:30.914Zcerrados. ZIPfinal externo
artifact11386409455sha9cde11137497001cd6c2ec40c333f3262b1d6bb92c745f726d5ed68639b4c011.
Siguiente candidato con guardas debe repetir gateFULLantes de aprobación.

Actualización97: cancelada deliberadamente antes del bloque Android al detectar
selector ambiguo: tanto encabezadoH1 como contenidoH2 se llaman «Soporte».
QA96 muestra ambos; la prueba Android nueva se acota a H2, no se elimina
la comprobación ni se rediseña el producto para favorecerla. Unit97 crudos
515BE+1114FE PASS,0omitidos. E2EJSONfinal ausente por cancelación: no inventar
conteos ni certificar Android97. Cleanup97 SUCCESS: runtime6023/server6024
detenidos02:07:51.557Z,PGcerrado2026-10-06T02:07:51.654Z. ZIPfinal externo
artifact11385289692sha e309c25b4eb67126e3c744ae955db8b752a75a695c2e68faab2133e57b442974.
No repetir ni descargar el summary duplicado.

Pulido nativo acotado a soporte: medidas360×800 no se parten, control de
adjuntos de respuesta usa el mismo estilo44px del reporte, nombre largo
puede envolver dentro del botón y «1 ticket» usa singular. E2E de menú
añade carga y descarga protegida de PNG real de QA con nombre largo,
geometría del botón y comparación byteporbyte (no API interceptada).
Homónimos: antes31/32BE y1/2FE focales, después32/32BE+92/92FE conjuntos,
0omitidos. Directorio de técnicos usa correo registrado sólo para staff;
selector muestra identificador y envía elID elegido, no el nombre. Autor
común no obtiene el directorio/candidatos ni el correo en ficha de ticket.
HTTP amplía estos asserts dentro de los12grupos existentes; no cambia
roles, destinatarios externos ni denominadores180E2E/16Android.
Siguiente: commit/push y una VM FULL con este candidato; resultados pendientes.

QA96/37399713667, SHA ee6413d6649cb4c43e5bac60a4ff34d66252046e,
terminó FAILURE: 515BE +1111FE unit PASS, 12HTTP soporte PASS y 6/9 E2E
focales PASS, 3FAIL, cero omitidos/flaky. Creación, toma, nota privada,
derivación, aviso interno, respuesta, cierre/reapertura y borrador offline
pasaron en escritorio, web responsive y app. Los tres fallos son reales:
volver al listado reutilizaba una caché vacía anterior a crear el ticket.
Prueba nueva con QueryClient real y staleTime largo: 0PASS/1FAIL antes,
6/6 (incluidos cinco tests del diálogo) después de invalidar exclusivamente
las consultas del autor tras ACK, nunca en timeout. Prueba del menú móvil:
27PASS/1FAIL antes (drawer seguía sobre el ticket), 34/34 junto con diálogo/
caché después; «Continuar luego» conserva menú y borrador, sólo ACK lo cierra.
Focal completo de los doce archivos afectados:91/91,0fallos/omitidos,
heap256MB/worker1. No sumar los subconjuntos anteriores.

ZIP final96 único externo: artifact11384911726, SHA256
ebd9357c1bdcd032539ac80782d8d447d47cc49fa048db0f7499c27aa341a3c5.
Cleanup: runtime5717/server5718 detenidos 01:41:21.196Z y PostgreSQL cerrado
2026-10-06T01:41:21.293Z. Tres PNG originales revisados: formulario escritorio,
detalle creado app, derivación web responsive (total156 archivos revisados,
no156 pantallas distintas ni revisión universal). Contraste/identidad son
legibles en esas capturas; dimensiones de diagnóstico pueden partirse a
ancho360 y control de archivos de respuesta conserva apariencia nativa: no
certificar uniformidad global a partir de esos tres archivos.

Siguiente gate conserva180E2E/16Android/12HTTP soporte y suites completas.
El recorrido de filas ahora también crea desde el menú real, cancela sin
enviar, confirma ACK/cierre del menú y verifica retorno al listado actualizado.
Contextos adicionales de técnicos/actor ajeno usan el viewport exacto del
proyecto, no el tamaño predeterminado del dispositivo. No intercepción de
API de negocio/sesiones falsas. Ningún despliegue, servidor Gobierno, mensaje
externo, proceso pesado local o publicador protegido.

### Ajuste después de QA95 y validación focal antes de ampliar

QA95/37395443216 sobreced2d7f terminó CANCELLED por solicitud propia tras
detectar incompatibilidad de bajas. Sólo unit/compilación/HTTP están completos:
509BE+1110FE y11HTTPsoporte PASS. E2EJSONfinal NO sobrevivió; no inventar conteos.
Dos PNG originales de soporte escritorio fallido fueron revisados (acumulado153
archivos, no153pantallas únicas): formulario y lista vacía. No hay prueba de
circuito UI completo. Los logs del job cancelado devolvieron404; se ampliará
evidencia nativa de formulario/traces en la siguiente tanda. ZIP PARCIAL único
sha aada981f9753e237c3b579a1737d7708176efde146f8c80a90da70c22129514d.
Android se inició después de cancelar poralways(); se exige !cancelled() para
las tres etapas Android futuras. La cancelación forzada se consultó según
[GitHub](https://docs.github.com/en/rest/actions/workflow-runs#force-cancel-a-workflow-run),
pero respondió409 porque95ya había terminado cancelada: no se aplicó. Cleanup
quedópending/no crudo de cierrePG95; no declararlo ejecutado ni PASS Android.
El runner era hospedado/efímero yel run estácompleted, no iniciar VMsolapada.

Reproducción local válida:4bajas (usuario/G/T/O) llegaban aP2003 tras borrar
dependientes; ahora un único transaction/lock verifica historia soporte antes
de borrar actor/flota/usuario. Sin historia conserva la baja previa y elimina
sólo membresía efímera; si otraFKrechaza la cuenta, revierte toda la operación
y explica400sin borrar tickets. Se añadirá prueba PostgreSQL de rollback real,
no se certifica rollback a partir de mocks. Focal BE30/30 yFE88/88 PASS,0omitidos.
También label neutral «Esperando al usuario», requisitos mínimos visibles y
correo identificador en búsqueda de equipo sóloADMIN (no en fichas del autor).

Siguiente: modo focal support_only (unit/build/HTTP completos +9E2E soporte,
sin Android ni empaquetado) para verificar interacciones y capturas sin gastar
otros180recorridos antesde entender los fallos UI. Nunca reduce denominadores:
después exige full180E2E/16Android/12HTTPsoporte para un candidato publicable.
No producción ni publicador protegido ni mensajes externos. Fuente/helper de
pruebas registra estadoDOMnativo/validación yconsola, no respuestas deAPI falsas.

QA94/37394745344 sobre e996b24 terminó FAILURE en unit:509BE PASS y
1104/1108FE PASS,4fallos. Los cuatro fixtures antiguos de Monitor no montaban
Router porque sólo simulaban useNavigate. Reproducción local4FAIL; fixture
actualizado con MemoryRouter real y dos casos adicionales de basenameapp/Escape
mobile, sin cambiar producto ni expectativas previas. Focal siguiente15/15PASS.
No compile/HTTP/E2E/Android ejecutados en94; cleanup con lista de procesos vacía,
PostgreSQL no iniciado. ZIPfinal94SHA256
42901b910e4b165f62d25fa14912d70bc754a0a5ff6a1bd20a6beddc51c0fd31.
Repetir full con el fixture corregido; no convertir focal en aprobación global.

El usuario autorizó implementar soporte propio, portable a infraestructura del
Gobierno. No se copia código, base, imágenes, usuarios ni configuración de PSICOLE.
No se depende de PSICOLE, TORRE, SaaS ni canales externos. El candidato siguiente
incluye `/api/soporte`, `/soporte` y su ruta app/mobile con la misma interfaz.

### Circuito y límites

- Reportar desde el menú o Ayuda sin salir del formulario; asunto, descripción,
  categoría y hasta tres JPG/PNG/WEBP/PDF de 5 MB. Diagnóstico mínimo de ruta sin
  query/fragment/tokens y tamaño de pantalla. No captura automática de datos.
- Borrador local por cuenta, no autoenvío. Después de timeout se conserva cuerpo,
  clave y huellas de adjuntos; comprobar recepción o reintentar exactamente.
  Los archivos no se guardan en el borrador: tras recargar deben re-adjuntarse
  los mismos. Sin sesión humana comprobable durante impersonación se pide volver
  a la cuenta propia: no se atribuye un reporte al administrador por datos locales.
- Mis tickets para cada autor; mesa y responsables sólo para soporte habilitado.
  ADMIN configura agentes explícitos. Dar soporte no cambia roles ni permisos
  legales. Deshabilitar a un agente con tickets abiertos requiere derivarlos.
- Toma, respuesta pública, nota privada, solicitud de respuesta, derivación con
  motivo, cierre con resolución y reapertura en el mismo número/historial.
  Versiones, lock de fila e idempotencia transaccional contra carreras/duplicados.
  Un responsable deshabilitado no retiene un ticket que se reabre.
- Avisos internos durables en la misma transacción: no SMTP/push/WhatsApp ni
  dispatcher externo. Conversación/adjuntos privados se filtran en el servidor.
  Archivos fuera del docroot, descargados con sesión y `private, no-store`.

### Infraestructura y traslado

Prisma/PostgreSQL existente más `UPLOADS_DIR/soporte`. Migración aditiva
`20261006010000_native_support`, tablas independientes y contador SOP propio,
sin editar usuarios, roles, inspecciones, manifiestos ni su numeración.
Traslado: respaldo consistente de PostgreSQL y `UPLOADS_DIR`, misma configuración
JWT/origen/API; dominio/VPN del Gobierno es infraestructura, no una URL hardcodeada
ni una dependencia de este módulo. Antes de publicación: respaldo, migración
revisada/aplicada y cliente Prisma generado con el schema nuevo. Un rollback de
frontend/backend puede conservar las tablas añadidas; no borrar los tickets.
Con `FILE_SCAN_MODE=required`, `CLAMAV_SCAN_CMD` debe estar configurado o se rechaza
el archivo; no hay fallback que omita el antivirus. No se instaló VPN ni servidor.
Prioridades/SLA/categorías administrables y tickets automáticos quedan fuera de
esta primera entrega: no mostrar plazos o destinatarios ficticios.

### Evidencia previa y gates siguientes

QA93/37388152398 sobre661284a: 485BE+1089FE unit PASS;170/171 E2E,
1 fallo app al cerrar Monitor. Android15/15PASS/completedtrue; APKoriginal4/4
solamente anónimo/readonly. El DOM del fallo es404. `navigate('/app/centro-control')`
duplicaba el basename de BrowserRouter: se usa una ruta del router, con prueba
unit y URL E2E exacta (la expresión previa aceptaba el sufijo incorrecto).
Cleanup confirmó runtime5956/server5957 detenidos y PostgreSQL apagado
2026-10-06T00:03:00.289Z. ZIP93SHA256
`59692eb8053b52c83dda0fa0b223bf7ec31332ab683e6dde4a1b8a06dd77d7f5`.
El PASS Android93 no borra el fallo de transporte Android92, de causa no resuelta.

Focal siguiente FE81/81PASS en9archivos,0fallos/omitidos, heap256/worker1;
BE24 casos de soporte con DB/proveedores simulados. Full unit/build todavía
pendientes. Nuevo gate HTTP real:11controles (incluye SQL aditivo original,
concurrencia/privacidad/derivación/reapertura); tres nuevos E2E por superficie:
se exige180 reales (60x3), no se reduce el denominador previo. Android agrega
un reporte real sintético y detalle:16casos exigidos. Todo en una VM serial.
Sin browser/Docker/DB/API/emulador/build/install locales ni automatizaciones.
No publicar ni afirmar GO sin crudos, capturas originales y limpieza de la VM.

Producción y publicador protegido intactos. Ningún correo, push, mensaje,
cuenta real o expediente real creado/modificado. Los contactos ficticios de
Ayuda se reemplazan por el circuito interno, no por otra dirección inventada.
ASR real, APK exacto autenticado, hardware, Safari, ruido/batería/background,
conciliación productiva y revisión visual de estados restantes siguen pendientes.

## PREVALENTE 05/10/2026 23:22 UTC — QA92 fallida, reparaciones siguientes verificadas en focal

[QA92](https://github.com/martinsantos/peliresi/actions/runs/37382728904), fuente
`8c8daf05d77dc3f7057b20c0c1318e2143e289bc`, terminó FAILURE23:06:25UTC.
Crudos finales: **485BE +1.086FE unit PASS**, cero fallos/omitidos; **166/171
E2E PASS,5FAIL**, cero skipped/flaky/suite errors. Tres fallos son una
expectativa errónea nueva de badge en Monitor fullscreen; otro reproduce
cabecera de Control fuera del marco fijo a320px; el transportista no logra
abrir su identidad móvil. Tres builds/54HTTP/2SQL/3calendario/5territorial PASS.
Android `completed:false`,13PASS1FAIL: se perdió el transporte durante captura
del escáner, `adb: device offline`; último caso de salud NO ejecutado. Log de
sistema terminó255 y su cola de2MB es incompleta; no demuestra crash de Chrome
ni causa raíz. APKoriginal4/4 sólo anónimo, no candidato autenticado.
Packaging/release NO ejecutados. Cleanup SUCCESS y PG apagado23:06:18.213UTC;
ninguna VM QA activa. ZIP final único144.498.802bytes,artifact11379405962,
SHA256 `3c76d82c83d6cfab1483aeb2adb421d18dee7491c1d14618477fd79d5de1c96a`,
externo `tmp/sitrep-go-evidence-20261003/visual-surface-run92-final.zip`.

Cuatro PNG92 originales revisados: fallo/overviewT, Control320 y escáner
Android nativo. Acumulado141 archivosPNG observados, NO141 pantallas únicas
ni100%. La captura prueba también texto blanco sobre blanco en «Volver» y
nombreT comprimido a ancho cero por etiquetas en la misma fila.

| Antes observado | Reparación siguiente | Comprobación |
| --- | --- | --- |
| Rol lateral comprime título320px | Rol bajo el título, misma altura64px/marca/campana | Marco unit +geometría320 real pendiente |
| IdentidadT desaparece, tarjeta sin teclado | Nombre a ancho disponible; etiquetas bajo CUIT; botón nativo completo sin botones anidados | Lectura/consulta unit; click yEnter E2E siguientes |
| Volver/Cancelar blanco sobre blanco | Fondo blanco y texto neutral900 en todos sus estados | Dos ramas unit; CSS real/escape Android siguientes |
| Prueba pide badge en Monitor autónomo | Exige shell real sin badge, cerrar y retornar al contextoInspector intacto | E2E siguiente; no cambia productoMonitor/permisos |

Antes focal válido51PASS4FAIL; se precisó «Cancelar» en la rama de error
(no se cambió esa acción). Después55/55PASS; ampliado único **149/149PASS**
en13archivos,0pending, heap256MB/worker1, JSON
`/private/tmp/sitrep-qa92-repair-focal.json`.55 es subconjunto, no se suma.
Contrato puro16/16PASS, heap128MB/concurrencia1; no ADB local/proveedores.
Próximo full espera1.089FE/485BE y171E2E, NO resultado aprobado todavía.
DiagnósticoAndroid sólo añade inventarioADB/PID readonly; sin reconnect,
reintento oculto, reset de perfil ni excluir el fallo92.

Producción, backend de producto, auth, marcas/colores, API/permisos, datos
reales y symlinks preservados. No Docker/browser/DB/API/emulador/build/install
locales, automatizaciones ni agentes. Próximo commit/push explícito, comprobar
SHA remoto DESPUÉS de completarpush, única VMfull serial; candidato congelado
hasta resultado/cleanup. Publicador protegido no ejecutado/eludido. ASRreal
Vosk/modelo compartido, gradientes/APCA/estados no vistos, APKexacto autenticado,
física/Safari/ruido/batería/background/conciliaciónproducción siguen pendientes.
**Abierto / NO GO global / NO desplegado / sin claim100%.**

## PREVALENTE 22:26 UTC — QA91 cerrada; candidato siguiente, sin publicación

[QA91](https://github.com/martinsantos/peliresi/actions/runs/37374618151),
fuente `c821aa405b273ad17816a266ee7055309dfdd79d`, terminó **FAILURE**:
el empaquetador todavía exigía141 E2E frente a171 casos reales.
No se generó una release aprobada. Los resultados crudos del producto son:
**485 backend +1.073 frontend unit;171/171 E2E** (57 por superficie), sin
fallos, omitidos ni flaky; tres builds,54 HTTP,2 SQL,3 calendario y5
territorial aprobaron. Android `completed:true`, **15/15 PASS**, sin runtime
errors ni respuestas API fallidas. APK original **4/4** sólo instalación,
firma, login y reinicio anónimos: NO APK autenticado del candidato.
Cleanup SUCCESS21:51:38.291UTC detuvo runtime5939/server5940; PostgreSQL
confirmó parada21:51:38.403UTC. No otra VM activa ni servicios QA locales.
ZIP final único118.119.239bytes,artifact11372319304, en SDTERA
`tmp/sitrep-go-evidence-20261003/visual-surface-run91-final.zip`.

Revisados personalmente12 PNG originales91: seis Actores/Residuos/Tratamientos/
Carga Masiva, dos Android y cuatro Reportes7/Control. Acumulado **125 archivos
PNG observados**, NO125 pantallas distintas ni100% del producto. El contrato
anterior permitía palabras partidas aun dentro de su tarjeta: «Transportis»/
«tas», «Operadore»/«s» y el rol sectorial. El inspector aparecía como Generador
en Home/Control por etiqueta contextual incompleta, no por cambio de sesión.
Residuos TOXICO seguían con hoja verde aunque su tipo computado es Peligroso.
Las capturas nativas muestran también un aviso de instalación de Chrome,
no UI de producto; la captura de comentario recuperado ocurre después del
ACK real. No se atribuyó a ambas imágenes un falso fallo de guardado.

El candidato SIGUIENTE conserva API, clasificación legal, conteos y marca:

| Antes observado | Corrección | Contrato de comprobación |
| --- | --- | --- |
| Categoría/rol cortados dentro de palabras | Texto de categoría en ancho completo; rol min-content sin corte interno | Geometría DOM de cada palabra y320px real |
| Inspector identificado como Generador en vistas operativas | Etiqueta funcional Inspector en rutas compartidas; rol base intacto | Header real y tooltip de rol base |
| Hoja verde para TOXICO | Símbolo Peligroso con tinta oscura, sin inventar nivel alta | Declaración original+símbolo real, sin hoja |
| Crear/borrar ofrecidos donde la API los niega | Acciones sólo para ADMIN/sector propio; consulta según permisos existentes | Roles reales, abrir/volver, cero escrituras en consulta |
| Lápiz llevaba a ficha; filtro mostraba flecha de navegación | Abrir ficha identificado como consulta; filtro/tilde separados de enlace | Nombre accesible, símbolo, URL y selección real |
| Packaging aún exigía141 | Exige171 casos efectivos,57 por superficie, sin reintentos ni omitidos | Ocho pruebas del contrato y crudo91 validado |

Antes nuevo contrato de lectura/rol/residuo:30PASS9FAIL; permisos:
14PASS7FAIL; símbolo de filtros:17PASS4FAIL. Un selector de prueba usó un
alias Lucide en vez de la clase SVG real; se corrigió a la clase instalada,
manteniendo la expectativa semántica. Último focal único **116PASS0FAIL0pending**
en10 archivos, heap256MB/worker1, JSON
`/private/tmp/sitrep-final-candidate-focal-v2-20261005.json`.
Contrato puro de evidencia **8/8 PASS**, heap128MB, sin red/proveedores.
Los63,39,104 y12 anteriores son subconjuntos, no se suman a116.
Las cifras esperadas1.086FE/485BE NO son aún resultados del candidato.

La nueva tanda completa será única y serial tras commit/push. Requiere
gates completos, render y cleanup antes de otro cambio. Sin navegador,
Docker, DB, API, emulador, build ni instalación local; dependencias compartidas
siguen como symlinks. Sin automatizaciones/agentes, envíos ni datos reales.
Producción no modificada y publicador protegido no ejecutado/eludido.
Gradientes/APCA, estados no vistos, APK exacto autenticado, hardware/Safari,
ruido/batería/background y conciliación de producción siguen pendientes.
Posibles límites backend de fecha/unidades necesitan reproducción independiente;
NO modificados para favorecer tests. **No GO global, perfección ni100%.**

## PREVALENTE 21:11 UTC — QA90 cancelada sin ejecutar; cuatro hallazgos consolidados

[QA90](https://github.com/martinsantos/peliresi/actions/runs/37371709531),
fuente `72d7a1886d2a6c4bfd0c4b2258f2a98f26c47f3b`, terminó CANCELLED a las
20:59:02 UTC tras permanecer en cola sin runner. Ambos jobs cancelados tienen
`steps: []`: no servicios QA iniciados ni resultado nuevo. No cuenta como PASS.
Se canceló exclusivamente esta tanda para consolidar defectos observados en
capturas89 antes de otra tanda completa; ninguna otra tarea cancelada.

Revisión personal acumulada: **97 originales** (70 de85–88 y27 de89), no97
pantallas distintas ni100% del producto. En app89 se observaron:

- Actores: etiquetas fuera de su tarjeta, doble padding y navegación por div
  sin enlace nativo. Se conserva cada destino, prefijo móvil y total API;
  etiquetas completas, padding único, enlaces con foco/hover/active.
- Carga Masiva: identidad de categorías incompatible con mapas, tarjeta con
  cursor accionable pero sin acción. Ahora reutiliza el símbolo de mapa y deja
  accionable sólo el botón real. Rutas, versiones y descarga de CSV conservadas.
- Residuos: los cinco indicadores pierden casi toda su etiqueta en teléfono.
  Se usa el resumen compartido, conservando cinco columnas escritorio, cinco
  cálculos actuales y las acciones/filtros del catálogo.
- Autorizaciones de Tratamientos: «Total Autorizaciones» sale de su tarjeta.
  El resumen compartido conserva los cuatro cálculos y referencias semánticas;
  no modifica permisos, autorizaciones ni formularios de alta/edición.

Antes, `WorkspaceReadability`: **3PASS9FAIL**. Después **12/12PASS**, incluidos
los tres downloads contra proveedor simulado; ningún upload/envío/API real.
Focal ampliado **71PASS0FAIL0pending**, heap256MB/worker1, JSON
`/private/tmp/sitrep-workspaces-focal-20261005.json` (ocho archivos ejecutados).
Pruebas E2E existentes ampliadas con geometría de texto dentro de cada tarjeta,
cinco resúmenes de residuos, enlaces por teclado y símbolos de plantillas.
Siguen171 recorridos, sin interceptar API de negocio ni inyectar sesiones.
Complemento mapas/Monitor/KPI/tooltip **38/38PASS** en diez archivos distintos,
JSON `sitrep-workspaces-map-monitor-focal-20261005.json`: **109 focales FE**
únicos en ambas tandas, sin fallos ni pendientes. Los18 del primer después son
un subconjunto, no se suman. Dependencias compartidas FE/BE siguen como symlinks.
La próxima suite completa espera1.073FE/485BE; no son resultados medidos aún.

**Render del candidato siguiente pendiente**: la suite focal no certifica
geometría real, Android ni toda UI. QA89 sigue FAILURE13/15Android. Diagnóstico
nativo estricto de72d7a18 conserva el fallo no exitoso; no es una reparación de
causa raíz ni una aprobación de sesión. No desplegado, no automatizaciones ni
agentes, no navegador/Docker/DB/API/emulador/build/install local. Publicador
protegido no ejecutado/eludido. Backend y autenticación de producto intactos;
gradientes/APCA, APK exacto autenticado, hardware/Safari/batería/ruido/background
y conciliación real de producción siguen pendientes.

## PREVALENTE — QA89 cerrada; siguiente candidato de UI, todavía no publicado

[QA89](https://github.com/martinsantos/peliresi/actions/runs/37365558562) probó
`173abf62f920ddcf5fe9f30066cd903307103d7a`: **485 backend + 1.037 frontend unit;
171/171 E2E**, sin omitidos ni flaky. Tres builds, 54 HTTP, dos SQL, tres
calendario y cinco permisos territoriales aprobaron. Android terminó **13/15**:
la primera lectura nativa falló con salida no exitosa de `uiautomator`, pese a
imprimir una confirmación; el último control exige que ese caso inicial haya
aprobado. Ambos fallos se conservan. No están determinados el código/signal de
salida ni la causa raíz. No aceptar stdout como éxito, reintentar a escondidas,
leer XML anterior ni suavizar la expectativa de sesión. Se añade exclusivamente
diagnóstico de código, signal, killed y duración para la siguiente tanda.

Los otros trece casos Android aprobaron, incluidos reinicio de sesión/registro,
recuperación de comentario no enviado, asignación/aviso al inspector, GPS y cola
offline. No hubo runtime errors, respuestas API fallidas ni cierres inesperados;
la consola sólo registró la desconexión intencional. APK original **4/4** sólo
instalación, firma, inicio y reinicio anónimos/sólo lectura; NO APK autenticado.
Cleanup SUCCESS **20:27:35.848 UTC**: runtime5879, server5880 y PostgreSQL
detenidos. ZIP final único en SDTERA: `visual-surface-run89-final.zip`,
artifact11370155501, 118.242.373 bytes. No VM solapada, despliegue ni envíos.

Revisión personal: 70 originales85–88 y tres89 (fallo nativo con bienvenida
visible, popupG al final, Reportes/Departamento al final). No son 73 pantallas
distintas ni todos los estados de UI. La captura89 de Departamento reveló un
hueco del inventario: SVG pinta el texto con `fill`, no con `color` HTML. El
recolector siguiente mide ambas propiedades según el namespace y deja las
composiciones no resueltas pendientes, sin rebajar contraste. Siete contratos
de ejes primero fallaron; se corrigen los siete Reportes y Control con una tinta
compartida, sin recolorear series, cambiar datos, geometría ni tamaños.

Después del cleanup89, el candidato SIGUIENTE añade:

- Resúmenes CRUD compartidos: etiquetas completas, ceros preservados, un único
  dueño del padding y alcance de página explícito para conteos T/O.
- Períodos inclusivos de días civiles Mendoza compartidos en Control/Reportes/
  Monitor: 30 fechas, no31. El filtro sin límite `Ver Todos` se conserva.
- `/app/registro` dentro del AuthLayout institucional existente, sin modificar
  campos, validación, permisos, credenciales ni API de registro.
- Contratos E2E renderizados de resumen, período, margen de registro y pintura
  SVG; siguen 171 recorridos completos, sin interceptar API ni inyectar sesión.

Antes: fechas/resumen 2PASS12FAIL; Control3PASS2FAIL; registro3PASS1FAIL;
ejes7PASS7FAIL. Después: **88 focales FE PASS**, cero omitidos/fallos, en tres
JSON `sitrep-ui-followup-{focal,monitor-focal,calendar-focal}-20261005.json` en
`/private/tmp`, heap256MB/worker1. Driver puro16/16PASS, sin ADB/emulador local,
incluida prueba que una confirmación con exit255 sigue siendo FAIL. Las cifras
1.061FE/485BE son sólo EXPECTATIVAS de la próxima VM, no evidencia actual.

Este candidato no pertenece al SHA89 ni tiene todavía gate remoto/render
aprobado. Backend y auth de producto permanecen sin cambios. Los posibles bordes
horarios de Control y unidades en su agregado backend necesitan reproducción
independiente; no quedan certificados por arreglar presets frontend. También
quedan gradientes/APCA, vistas/estados no revisados, APK exacto autenticado,
teléfonos físicos, Safari, micrófono/ruido/batería/GPS segundo plano y publicación
protegida. No GO global ni100% por conteos de pruebas.

## PREVALENTE 19:45 UTC — QA88 cerrada; candidato siguiente listo para otro gate

QA88/fuente4392875 COMPLETED FAILURE sólo por los dos tooltip de Departamento:
169/171E2E PASS2FAIL0skip/flaky;485BE+1.027FEunitPASS0FAIL0pending;
tres builds/54HTTP/2SQL/3calendario/5territorialPASS. Android **15/15PASS,
completed:true**; APK original4/4PASS sólo anónimo/sólo lectura. Runtime y HTTP
sin errores, consolaoffline esperada. CleanupSUCCESS19:36:30.784UTC runtime5699/
server5700 y PostgreSQL detenidos. ZIPfinal único128.016.938bytes externo
`visual-surface-run88-final.zip`,artifact11368195793; resumen no duplicado.

Se revisaron seis originales88: reinicio Android, recoveryretry, Reportes7 al
final, Control, Blockchain y popupG. Total47 originales85–88 personalmente,
NO toda superficie/roles/estados. Header móvil no rompe su marco; popupG SIGUE
clipping vertical, todavía fuera del contrato horizontal de88. El tooltip de
Departamento es visible como tinta de serie. Su tabla además tenía Gen.verde,
incoherente con gráfico/mapa purple; se corrige también tabla/modal a las mismas
constantes ACTOR_COLORS, conservando geometría y datos. Nuevos contratos primero
5PASS2FAIL; conjunto final51/51focalPASS0FAIL0pending,
`/private/tmp/sitrep-next-visual-focal-v3-20261005.json` (heap256/worker1).
E2E siguiente verifica referencia Gen.visible con CSSreal, sin dato ficticio.

Android88 tiene journal40eventos sin overflow ni tokens. Reinicio preserva
checkpoint inspector más reciente aunque localStorage vuelve a admin antiguo;
la recuperación autorizada verifica perfil real. Reinicio offline y logout
también aprobaron. No afirmar arreglado87: no hubo cambio de auth y88 tenía
capturaXML lenta previa al cierre. El siguiente QA sólo capturaXML después de
recuperar, repite los quince casos sin esa espera y conserva todos los guards.
No inyectar sesión ni reingresar para esconder un fallo.

Próximo: commit/push acotado + única VM full/unit/Android después del cierre88,
sin exclusiones ni umbral reducido. Popupvertical/KPI/tooltip/referencias nuevos
NO forman parte del render aprobado parcialmente en88. Producción permanece
intacta; publicador protegido bloqueado, sin vía alternativa. Hardware físico,
APK exacto autenticado, Safari, ruido, batería y GPSbackground pendientes.

## PREVALENTE 19:35 UTC — web QA88 leída; Android en ejecución

Fuente4392875 en [QA88](https://github.com/martinsantos/peliresi/actions/runs/37360643612):
**485BE +1.027FE unit PASS0FAIL0pending;169/171E2E PASS2FAIL0skip/flaky**.
54HTTP/2SQL/3calendario/5territorialPASS. Duración E2E1.092.242,347ms.
Resumen11367074313 leído por streaming, sin guardar otro ZIP o resumen duplicado.
Android sigue activo; resultado/cleanup final aún pendientes. No solapar otra VM.

Los dos fallos conservados son el MISMO tooltip de Departamento en responsive y
app, no la leyenda fija: naranja de serie `rgb(234,88,12)` en nombres/valores de
14px sobre blanco, contraste3,5595 frente al umbral4,5 intacto. No se excluye.
ChartTooltip compartido se corrige en el árbol siguiente con texto neutral700
y color de serie sólo en un punto alineado; nombres completos, ceros, valores,
color/fill y ausencia de serie conservados. No fabricar color o tooltip vacío.
Antes2PASS1FAIL; conjunto final49/49 focal PASS0FAIL0pending en
`/private/tmp/sitrep-next-visual-focal-v2-20261005.json`, heap256/worker1.
Esta corrección, popup vertical y KPI NO pertenecen al SHA probado en88; esperan
otro gate remoto serial después del cierre. No auth/producción/envíos modificados.

## PREVALENTE 19:29 UTC — QA88 activa; candidato siguiente no incluido

[QA88](https://github.com/martinsantos/peliresi/actions/runs/37360643612) prueba
`4392875c2a33c75ad04d2dad7c0e1434edac5bfc`, full/unit/Android serial, iniciada
19:03:44UTC después del cleanup87. Sigue en E2E; cantidades definitivas sin leer.
No solapar otra VM, desplegar ni confundir sus resultados con el árbol siguiente.

La revisión personal de tres popup app87 reveló clipping VERTICAL: título del
generador fuera del mapa, datos T/O bajo su borde/atribución. El control sólo
horizontal era insuficiente; no se declara ese render aprobado. Cuatro capturas
adicionales de inicio Reportes muestran transparencia de labels/alcances de KPI.
Acumulado41 originales85/86/87 revisados, NO toda superficie/roles/scroll.

Siguiente candidato local, separado del SHA88:

- MonitorPopupBounds ajusta maxHeight por altura del mapa visible, marco del
  popup, cabecera y margen de atribución. Una suscripción con cleanup, sin timer
  o polling; contenido enfocable con scroll nativo de teclado, no paneo del mapa.
  E2E conserva ancho y añade altura, cierre no cubierto y End/Home hasta el final.
- KpiCard deja labels y alcance en blanco opaco, consumidores Reportes conservan
  familias de color con fondos700/800. Generador de Tratados pasa de blue a su
  purple/Factory canónico. Números, unidades, ceros, filtros y datos no cambian.
  E2E añade color computado/opacidad reales; NO certifica el gradiente por clases.
- Diagnóstico Android QA mueve XML nativo a después de recuperación/fallo;
  no añade una espera previa al cierre que pudiera favorecer flush. Metadata
  readonly preservada, sin cambio de auth/guards ni reingreso que oculte fallo.

Antes: popup3PASS1FAIL, KPI1PASS2FAIL, ReportText4PASS1FAIL. Después46/46
focales PASS0FAIL0pending en `/private/tmp/sitrep-next-visual-focal-20261005.json`,
worker1/heap256MB y sólo unit, sin backend/DB/proveedores reales. Navegador,
gradientes, geometría final y Android pendientes de nuevo gate serial tras88.
No se instalan dependencias ni se ejecutan browsers/builds/emuladores locales.
Login azul/sistema verde/marca conservados. Publicación protegida bloqueada,
sin ejecución alternativa; no envíos ni producción/datos reales modificados.

## PREVALENTE 19:03 UTC — QA87 final fallida; candidato siguiente sin desplegar

[QA87](https://github.com/martinsantos/peliresi/actions/runs/37354471948),
fuente exacta `bb38ef6daf62aec635a744be638e267b0417dc98`, terminó FAILURE:
**485 BE + 1.007 FE unit PASS; 159/168 E2E PASS, nueve FAIL, cero skip/flaky**.
Tres builds, 54 HTTP, dos SQL, tres calendario y cinco territorial PASS.
Cleanup SUCCESS18:45:14.932UTC detuvo runtime5665/server5666 y PostgreSQL.
No queda una VM anterior ejecutando ni se desplegó este candidato fallido.

Los nueve E2E se mantienen como fallos registrados, no se excluyen:

- Tres regresiones reales responsive: títulos Centro de Control320px,
  Certificación Blockchain y cabecera Inspector que intercepta el click de
  Denuncia/hallazgo. PNG originales muestran letras apiladas fuera del marco64px.
- Tres del nuevo recorrido de popup: G/T/O abren, retienen identidad y cierran;
  no existe marcador de tránsito porque el manifiesto sintético de dispositivo
  aún carece de GPS antes de Android. Se corrige exclusivamente el seed aislado
  con posición explícita, no se inventa una posición en el producto.
- Tres inventarios de Reportes detectan94 ocurrencias de contraste insuficiente
  en cuatro pestañas: estados de manifiesto, cifras/leyendas de transporte,
  categorías de tratamiento y cifras/leyenda por departamento. Son repeticiones
  entre viewport/rol, no94 defectos independientes. Se conserva umbral4,5.

Android87: **7 PASS + 2 FAIL, completed:false**. Tras cierre forzado no vuelve
el perfil del inspector y aparece login; el caso de comentario offline depende
de esa sesión y tampoco se completa. Los seis controles posteriores NO se
ejecutaron y no se certifican. El comentario confirmado antes del cierre sigue
en el servidor. `runtimeErrors`, respuestas HTTP fallidas y errores de consola
vacíos no aprueban recuperación. APK original **4/4 PASS** únicamente anónimo/
sólo lectura; sesiones reales QA Chrome no son APK autenticado del usuario.

ZIP final único `SDTERA/.../peliresi/tmp/sitrep-go-evidence-20261003/visual-surface-run87-final.zip`,
183.453.505bytes. Resumen leído por streaming, no otra copia. Se revisaron cinco
PNG87 originales: los dos fallos de cabecera, tratamientos app al final,
transporte escritorio al final y login Android tras pérdida de sesión.
Acumulado34 PNG85/86/87 revisados personalmente; NO todas las pantallas.

El árbol local siguiente, separado de87, contiene estas correcciones:

| Reproducción | Corrección candidata | Prueba focal final |
| --- | --- | --- |
| Recuperación app sin marco y controles sin label/estado/foco/error anunciado; submit duplicado | AuthLayout existente sólo recuperar/reset, controles44px, label, aria-pressed/alert y guard ref liberado en finally | 21/21 PASS, incluidos reset, rutas mobile y reclamo; JSON recovery-reset-all-focal |
| Cuenta ocupa ancho desktop en320px; título/función quedan sin espacio | Trigger cuenta44px con nombre accesible; menú acotado; título y función agrupados móvil sin eliminar acciones | 17/17 PASS, cuenta/cabecera; falta geometría de VM nueva |
| Colores de series usados como tinta pequeña en Reportes | Tinta neutral700, cifras semánticas700/800, leyenda compartida; mantiene series/tintes/datos. Generador purple/Factory y Operador blue/Flask canónicos por departamento | 26/26 PASS con tablas reales; falta contraste CSS de VM nueva |

Los contratos nuevos primero fallaron antes de modificar producto. Los errores
intermedios de selector/callback cleanup en el harness se conservaron y corrigieron
sin debilitar expectativas de negocio. No hubo nueva suite completa local:
worker1/heap256MB, DB/proveedores simulados únicamente en unit.

Recuperación Android no se altera por suposición ni se relajan los guards que
impiden restaurar un administrador sobre un logout/login legado ambiguo.
Se añade diagnóstico QA de sólo lectura, restringido al origen127.0.0.1:4177,
con presencia/id/iat y estado del checkpoint, jamás tokens/refresh/passwords.
Lee antes de módulos y conserva metadatos entre redirect; no inyecta sesiones,
escribe almacenamiento, espera flush ni reingresa para disimular el fallo.
27 focales de evidencia/durabilidad/límites PASS. Una nueva VM serial full/
unit/Android debe repetir todos los gates y conservar cualquier fallo.

Persisten composiciones de gradiente/imagen/opacity no medidas, estados y scroll
intermedio no revisados, hardware físico/APK instalado exacto/Safari/ruido/
batería/GPS en segundo plano. No100%, perfección, GO global ni despliegue.
Publicador protegido permanece bloqueado: no fue ejecutado por otra vía.
Lo inferior es historia de tandas anteriores, no el estado actual.

## Estado actual: en ejecución, sin aprobación global

El usuario pidió continuar la revisión y corregir los defectos verificables en
web de escritorio, web responsive y app web. No se retomaron automatizaciones,
agentes antiguos ni proyectos externos. Se conservan login azul, sistema verde,
marca, fuentes y dependencias compartidas mediante symlink.

La fuente `55d7abf1d457b4fbc72b980727c201d3dbd3f51e` está en la rama
`codex/sitrep-cloud-qa-20261002`. La ejecución completa
[QA85](https://github.com/martinsantos/peliresi/actions/runs/37336254527)
terminó FAILURE: **485 unit backend, 985 frontend y 160/162 E2E aprobados**,
sin skips ni retries. Las tres compilaciones, 54 controles HTTP, dos SQL,
tres de calendario y cinco de permisos territoriales aprobaron. El cierre de
procesos propios y PostgreSQL aprobó a las 16:17:57 UTC. Los 141 recorridos
funcionales anteriores aprobaron; los dos fallos pertenecen al nuevo inventario.
No es un despliegue ni una aprobación Android.

## Segunda tanda: contrastes compartidos y recuperación real

QA85 produjo 190 recibos con contenido, ninguno con tres o menos nodos de texto.
Se revisaron **nueve PNG originales**: operadores escritorio, Monitor app,
Controles inspección app/escritorio, Centro de Control responsive, alta generador
app, manifiestos app, certificación app y recuperación app en blanco. Esto NO
acredita 190 revisiones visuales ni todas las áreas fuera del primer viewport.

Se conservaron 177 candidatos de contraste, mayormente repetidos por un mismo
componente en roles y superficies. Defectos confirmados y cambios acotados:

| Before | After | Why |
| --- | --- | --- |
| `navigate('/recuperar'); return null` durante render | `<Navigate to="/recuperar" replace />` | La app sin token quedaba totalmente en blanco; navegación declarativa evita el callejón sin salida. |
| `bg-error-500 text-white` en contadores | `bg-error-700 text-white` | El texto medido daba 3,76:1; se cambia el consumidor compartido, no la paleta global. |
| `text-neutral-500` en título de rol teñido | `text-neutral-700` | Administrador daba 4,20:1 y Operador 4,48:1. |
| `text-red-600` sobre `bg-red-50`, LIVE/PDF | Color 700 | Texto normal medido en 4,41:1; conserva significado y funcionamiento. |
| `bg-emerald-600 text-white` en certificación | Fondo 700, hover 800, foco visible | 3,77:1 en acción y filtro seleccionado; no cambia blockchain ni su criterio legal. |
| Filtros de certificación sin envoltura | `flex-wrap`, controles de 44px, `aria-pressed` | El último filtro estaba cortado en el PNG app; la selección también debe ser semántica. |
| Viaje `text-success-600` y pendiente `text-warning-600` sobre tintes | Colores 700 | Lecturas reales 3,58:1 y 3,07:1; no se altera estado, cantidad ni destino. |
| Operador `FlaskConical` verde en administración | Mismo glifo azul canónico en título/total/tabla/tarjeta | Categoría no se confunde con el estado éxito, que sigue verde. |

Primero fallaron ocho contratos nuevos de contraste, uno de identidad, dos
de recuperación y cuatro operativos. Tras corregir, las dos ejecuciones focales
aprobaron **44 y 9 pruebas** respectivamente, un worker/heap256MB, mocks sin DB
ni proveedores externos. Un mock inicial recreaba los datos y fue detenido
por PID propio antes de corregir su estabilidad: no se cambia producto para
favorecerlo. Las clases unit no certifican contraste CSS; falta el siguiente
gate renderizado de la misma fuente. No se hicieron builds locales.

Los otros fallos del montaje se distinguen de producto: selector escogía un
título oculto en responsive; `#expediente` no era un apartado real y capturaba
Visita. Ahora se exige estructura visible y se descubren/clican los href reales,
incluido `#revision`. La inspección espontánea no tiene Datos declarados. Las
capturas anteriores con hash incorrecto NO cuentan como esos apartados revisados.

El gate nuevo falla ante contraste insuficiente en texto habilitado cuya
composición pueda medirse, conserva los gradientes/imágenes no resueltos como
pendientes y verifica explícitamente `/reset-password` → `/recuperar` con
formulario real. No baja umbrales ni elimina candidatos para pasar.

La ejecución completa siguiente es
[QA86](https://github.com/martinsantos/peliresi/actions/runs/37349612780), fuente
`559956d916392721f0e694eee54491b788fda2a2`, unit/Android/full. El JSON E2E ya
mostró **159/162 PASS, tres fallos, cero skips/flaky**: las tres superficies
detectan el mismo enlace de alta pública `Inicia sesion`, color de marca500
sobre blanco, **4,406758691742224:1** frente a 4,5 requerido. El resto del
inventario no detectó candidatos habilitados medibles por ese algoritmo. Eso
no aprueba gradientes, áreas fuera de viewport ni todos los estados. Android
aprobó su paso a las 18:11:08 UTC, igual que el cierre de procesos propios y
PostgreSQL. Unit crudos: **485 BE y1.000 FE PASS, cero FAIL/pending**.
QA86 terminó FAILURE por esos tres E2E, no por Android. Sus JSON confirman
**15/15 Android PASS**: sesiones reales, cambio de usuario, operación territorial,
selector antes de teclado, asignación/aviso/inspección, reinicio, borrador
offline/ACK, cierre de acordeones, logout, GPS emulado y cola offline,
salida recuperable sin cámara, salud JS. `runtimeErrors` y respuestas fallidas
inesperadas están vacíos; se conserva el error de red esperado durante offline.
El APK original aprobó **4/4 controles** de instalación, apertura anónima/TLS/
marca, reinicio y guard de sólo lectura, sin escrituras intentadas ni errores
de página. Autenticación QA Chrome en Android no acredita autenticación del
APK humano ni hardware físico. No hubo despliegue ni paquete publicable aprobado.

Se revisaron catorce PNG85 adicionales (23 en total): Alertas, Avisos, nuevo
manifiesto, Reportes, editar generador, usuarios, selector de sesión y perfil
app; altas/ediciones de operador/transporte app; generadores/Reportes escritorio.
Los originales muestran cabeceras cortadas; los KPI de Reportes con gradiente
son composición **no medida** y requieren revisión específica, no aprobación
por este algoritmo. La tabla de generadores no muestra la antigua columna
vacía enorme, pero esta captura con tres actores no prueba todos los anchos/datos.

Mientras QA86 conserva su commit inmutable, se prepara un siguiente candidato
local separado: popup LIVE G/T/O/viaje compartido con símbolo canónico, ancho
acotado, metadatos oscuros, dirección completa, nombres de marcador accesibles
y cierre44px. Tres nuevos unit fallaron antes; después pasaron, junto a los
dos contratos de historial. Títulos del shell responsive/app ahora permiten
envoltura sin ellipsis; app comparte altura64px con web y conserva marca/rol.
Cuatro contratos fallaron antes (30 anteriores verdes); luego 39 focales
incluyendo popup/historial aprobaron. Unit no certifica CSS ni la ausencia
de clipping. El E2E candidato mide ancho/cierre y conserva datos de API reales;
el inventario comprueba rectángulos de texto de H1, no sólo su tooltip. La
antigua expectativa nowrap sigue en escritorio; en móvil se fortalece por
título completo dentro del marco, sin rebajar el control de altura.

Tras QA86 se añadió un contrato rojo para cada alta pública G/T/O: enlace
legible, foco visible y retorno a ingreso sin crear cuenta. Tres FAIL antes,
tres PASS al pasar sólo ese enlace a primary700/hover800. No se toca login
institucional, API de solicitud, cuentas ni numeración. El último focal
combinado pasó40 pruebas; los dos contratos de historial pasaron en ejecución
separada (42 comprobaciones diferentes en total, no una suite completa).

El siguiente gate agrega apertura/cierre de los cuatro popups LIVE con API
real, lectura de título en320px y recorrido de las nueve pestañas de Reportes,
con captura/medición al inicio y al final del contenedor real. Se registran
offsets y alturas; no se hace pasar primer viewport por contenido completo.
Los nuevos casos no se excluyen si descubren defectos. Ningún recibo del
candidato local se declara renderizado antes de la nueva VM serial.

QA86 ya cerró recursos: runtime5777/server5778 y PostgreSQL a las18:11:08UTC.
Su ZIP final único ocupa108.148.430bytes en el disco externo; el resumen se
leyó por streaming, no se guardó otra copia. Contiene207recibos,
3.061textos medidos y4.098ocurrencias no medidas; los nueve candidatos son
repeticiones del enlace mencionado. Se revisaron seis PNG86 originales:
recuperación, revisión de inspección, certificación app y sesión/alta/GPS
en Android. No equivale a207pantallas inspeccionadas personalmente.

El candidato siguiente se subió como `bb38ef6daf62aec635a744be638e267b0417dc98`.
[QA87](https://github.com/martinsantos/peliresi/actions/runs/37354471948)
corre full/unit/Android en una sola VM desde18:14:39UTC. A las18:35UTC está
en E2E sin paso previo fallido; resultados definitivos pendientes. No se
desplegó ni se iniciará otra VM antes de cierre y revisión de crudos.

## Candidato local posterior: recuperación móvil sólida

La captura86 `/app/reset-password` ya muestra recuperación, pero sin margen
exterior: el router app no usaba el AuthLayout de la web. Tres nuevos unit
fallaron antes; se envuelven exclusivamente recuperar/reset en el marco
institucional existente, no login/registro/reclamo ni permisos. Los controles
de recuperación carecían de label asociada, estado elegido semántico y error
anunciado; dos submit antes del render generaban dos llamadas. Tres unit
nuevos fallaron antes. Se agregan label/id, modo44px/aria-pressed/foco, rolealert
y guard ref con desbloqueo finally, sin modificar payload ni proveedores.

El focal final pasó18/18, ceroFAIL/pending, worker1/heap256MB. Un intento
intermedio17/1 fue un hook que devolvía la función mock y Vitest la ejecutaba
como cleanup; se corrigió el harness con llaves, no producto para aprobar.
JSON local `/private/tmp/sitrep-recovery-controls-frame-after-v2-20261005.json`.
Un nuevo E2E candidato exige margen renderizado, acción44px, modo real,
offline/retry contra API y correo sintético inexistente/no enumeración. Aún
NO se ejecutó ni se mezcló con87; no es render aprobado ni producción.

Próximo: revisar crudos/PNG/Android87, corregir nuevos fallos junto a este
candidato local y repetir gates afectados/completos antes de considerar GO.
Android OS autenticado QA y APK original anónimo son alcances distintos;
teléfono físico/APK del usuario/ruido/batería/segundo plano siguen pendientes.

## Fallos reproducidos y correcciones de esta tanda

| Caso | Reproducción anterior | Cambio candidato | Validación actual |
| --- | --- | --- | --- |
| Agenda global oculta viajes al transportista | QA83 y QA84: mismo fallo en tres superficies; unit nuevo rojo | Elimina filtro por nombre de empresa; mantiene búsqueda y permisos privados | QA85 aprobó en tres superficies |
| Viaje seleccionable enlaza a expediente ajeno | Unit rojo para permiso falso y ausente | Backend reutiliza permiso existente y devuelve `canViewDetail`; selección y cierre siguen disponibles sin destino prohibido | Unit, HTTP territorial y E2E QA85 aprobados |
| Pendientes globales de Monitor llevan a acceso denegado | Dos unit rojos | Separa consulta operativa de navegación privada; no amplía permisos de lectura ni escritura | Unit y E2E QA85 aprobados |
| Fichas T/O cambian icono y color respecto al mapa | Dos unit rojos | Símbolo compartido, color canónico y fondo independiente del glifo | Unit y tres recorridos reales QA85 aprobados |
| Historial de Monitor crea etiquetas competidoras | Dos unit rojos y captura anterior QA82 | Un marcador seleccionable por viaje; detalle bajo demanda; eventos mantienen círculo y detalle en el control/feed | Unit y recorrido 30 días QA85 aprobados; popup live móvil pendiente |
| Animaciones del mapa sobreviven a la salida | Unit nuevo exige cancelación | Cancela frames propios al reiniciar y desmontar | Focal unit aprobado |

Los cinco archivos focalizados aprobaron **32 pruebas**, con un worker y heap
máximo de 256 MB; los procesos locales terminaron. Las pruebas unitarias usan
dobles de dependencias y no certifican CSS renderizado. No se instaló Vitest en
el backend local: esa suite se ejecuta en nube con DB desconectada.

## Defecto del montaje visual descubierto y conservado

QA84, fuente `d918bcb1b9ff04c885db90de0219b2e06ae6685a`, terminó FAILURE:
472 unit backend y 975 frontend aprobados; 42 E2E aprobados y tres fallos T2.
No hubo skips ni retries que ocultaran esos fallos. El cierre de PostgreSQL y
procesos propios quedó aprobado antes de lanzar QA85.

El inventario produjo 204 recibos, pero **188 sólo midieron pantalla vacía o
carga inicial**. Se inspeccionaron seis originales de app que confirmaron ese
defecto. No se cuentan como pantallas revisadas ni como aprobación visual.
Los controles de negocio aprobados siguen siendo sus controles concretos; no
se invalida ni se exagera su alcance.

Se endureció el montaje para esperar estructura real dentro de `#root`,
ausencia de carga/spinner visible, consultas ocupadas terminadas y fuentes
listas. Se reduce sólo la resolución del PNG a píxeles CSS, no el viewport,
las condiciones del navegador ni los umbrales. No hay interceptación de APIs
de negocio, respuestas fabricadas ni sesiones inyectadas.

Los recibos válidos anteriores detectaron dos candidatos de contraste:
contador de avisos blanco sobre rojo, **3,76:1**, y texto Administrador sobre
verde claro, **4,20:1**. Se escribieron primero cinco expectativas nuevas y
fallaron, con cinco pruebas previas aprobadas. Se conservaron sin corregir el
producto durante la ejecución congelada QA85; integran el siguiente lote.

## Cómo se decide la aprobación

- Unit backend/frontend, HTTP con PostgreSQL sintético, E2E con clicks reales,
  contraste renderizado, inspección de PNG y Android son capas diferentes.
- Cada recibo identifica ruta, rol, viewport, estado, fuente y ámbito capturado.
  Primer viewport no acredita áreas fuera de pantalla, modales ni todos los
  estados del formulario.
- Imágenes, gradientes y composiciones no resueltas quedan **no medidas**, no
  aprobadas. Se revisan aparte; los candidatos no equivalen automáticamente a
  defectos confirmados sin comprobar su composición visible.
- Las rutas registradas y los casos no capturados permanecen en el inventario.
  No se excluyen archivos ni se cambia un denominador para declarar 100%.
- Android físico, APK exacto del usuario, ruido, batería y GPS/cámara reales no
  se certifican desde una vista responsive.

## Aislamiento y recursos

Una VM GitHub y un worker de navegador; base exclusivamente
`sitrep_night_qa_20260926` en `127.0.0.1:55440`. Correos, push y blockchain
externos deshabilitados en QA. Sin navegador, Docker, Postgres, API, build ni
emulador locales nuevos. Sólo se descargó el ZIP final de QA84, no un resumen
duplicado ni dependencias. No hubo envíos ni escrituras de datos reales.

No se ejecutó el publicador protegido ni un sustituto para eludir su bloqueo.
Commit/push no equivalen a producción. El cierre exige resultados y capturas
del mismo candidato; todavía no se afirma GO, 100% ni perfección.
