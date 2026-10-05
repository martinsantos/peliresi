# Auditoría renderizada de superficies e interacción — 05/10/2026

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
