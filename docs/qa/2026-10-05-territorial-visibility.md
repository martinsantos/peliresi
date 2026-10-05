# Visibilidad territorial — criterio probado, GO pendiente de interfaz

El usuario confirmó el 05/10/2026 que generadores, operadores y transportistas
pueden consultar datos globales de Monitor y Centro de Control dentro del sistema.
Esto exige sesión válida y no restringida. No habilita acceso público, lectura de
fichas ajenas, documentos privados, edición, cancelación o toma de viajes ajenos.
La autenticación protege la API: ocultar un enlace en la UI no reemplaza ese control.

## Resultado final medido — run73

Run `37295982501` / fuente `55ffdf345dca949187f15150d3898a880f0a7d39`:
COMPLETED/FAILURE, no candidato publicable. Recibos crudos finales leídos:

| Gate | Resultado real |
|---|---|
| Backend unit | 472 PASS, 0 FAIL/pending |
| Frontend unit | 962 PASS, 0 FAIL/pending |
| Backend, web y app compilados | Tres builds PASS |
| HTTP funcional existente | 54 grupos PASS, 0 FAIL |
| Subscriber/PostgreSQL | 2 PASS |
| Calendario Monitor HTTP | 3 PASS |
| Nuevo contrato territorial HTTP | 5 grupos PASS, 0 FAIL |
| E2E focal | 18 PASS / 3 FAIL; 0 flaky/omitidos |
| Android/APK nuevos | No ejecutados en este focal |

Los tres E2E fallan por el mismo comportamiento de Centro de Control para
TRANSPORTISTA: la API devuelve el viaje ajeno `2026-990001` pero la región
«Agenda y viajes» dice «Viajes Activos 0 / Sin viajes activos». Reproducción:
login real de transportista2 → Monitor → Centro de Control → abrir Viajes Activos.
Desktop1440×900, responsive360×800 y `/app/`360×800 fallan igual; el KPI global
sí muestra1. Fuente exacta: CentroControlPage.tsx filtra la lista y el conjunto
del mapa por nombre de empresa. Es divergencia con la regla recién confirmada,
no una ampliación de permiso a expedientes privados ni una regresión ocasionada
por cambios de producto en esta revisión. Generador2/operador2 pasan ambos destinos.
Los tres recorridos anónimos redirigen al login sin consultas operativas.
Los nueve recorridos anteriores de contexto/localización también pasan.

La API global queda validada con login real, eventoGPS extranjero de20d,
igualdad de datos respecto a ADMIN, ausencia de datos para sesión inválida o
anónima y denegación de fichas/manifiestos/cancelaciones ajenas, sin cambiar el
documento ni generar eventos. Ningún payload de negocio fue interceptado.

| Comprobación visual/interactiva del lote | Evidencia y límite |
|---|---|
| Identidad / contenido significativo | Monitor con títuloSITREP y controles; Centro y login en capturas/DOM, sin pantalla vacía |
| Overlay de framework | Ausente en checks aprobados y seis PNG nuevas revisadas |
| Consola/HTTP operativo | Sin pageerror/respuestasoperativas400+ en los seis recorridos globales G2/O2 aprobados; el caso transportista falla antes de su aserción final de consola |
| Interacción | Login y apertura real de acordeón; viaje global visible G2/O2, ausente T2 |
| Capturas | Seis originales73 revisadas; screenshot/DOM/trace de los tres fallos conservados |
| Historial30d móvil | Captura71 conserva etiquetas superpuestas; no fue corregida ni repetida como aprobada73 |

Evidencia final única: SDTERA/tmp/sitrep-go-evidence-20261003/territorial-run73-final.zip
(28.278.311bytes), seis PNG seleccionadas en territorial-run73-visible. E2E139.265ms.
Cierre10:29:26.379UTC detuvo runtime5768/server5769 y PostgreSQL cleanupSUCCESS;
una VM/worker1/retries0, sin Docker/browser/API/DB/emulador local, agentes nuevos
o automatizaciones. No editar tests para aceptar el filtro ni repetir el mismo
producto rojo sin corregirlo por una solicitud de implementación.

## Qué falta para GO

1. Corregir la presentación global de viajes para transportistas y repetir los
   tres recorridos fallidos, luego gates completos afectados/integrales. El
   criterio de permiso humano ya está resuelto; no volver a dejarlo como pregunta.
2. Evitar etiquetas del mapa móvil superpuestas/recortadas y revisar cabeceras
   truncadas y banner nativo Chrome con evidencia fresca. No se aplicó diseño
   nuevo dentro de esta solicitud de revisión/test/estatus.
3. Validar los destinos «Ver detalle del viaje»: ViajesPanel y ControlMap ofrecen
   un enlace privado sin diferenciar propio/ajeno. Hallazgo de fuente, aún no
   reproducido por click en este lote; denegación404 privada sí aprobada por HTTP.
   Consulta global no debe convertirse en un callejón404 ni dar permiso privado.
4. Conciliar y publicar un candidato aprobado sin eludir protección: producción
   read-only continúa release20261004-shared-ui-followup-r1 en web/app/backend;
   catálogo/manual y calendarioMonitor nuevos están en Git, no desplegados por
   esta tanda. Health200/DBconnected y cincoAPIglobales anónimas401. El preparador
   antiguo59 sigue bloqueado; no ejecutar/retargetear/copiar para rodearlo. Antes
   de promoción, verificar espacio para backup/rollback: servidor3.8GiB libres.
5. Confirmar APK realmente instalado y probar sesión autenticada del APK exacto.
   Descargas conserva original1.0.0/versionCode2 con SHA256
   `4200e6d857e3a161e15bcfd161c44b54fc76245d8e9f4e3a093f973b06ad4bf5`,
   idéntico al original de71. Eso no identifica los teléfonos ni convierte las
   15 pruebas AndroidChrome de71 en pruebas autenticadas de APK/TWA.
6. Teléfono real: cámara/autofoco/QR, GPS segundo plano, batería, red celular,
   recuperación offline y voz/ruido; Safari fuera del alcance de esta VM.

Sólo cambiaron QA, gates y documentación en esta revisión. No producto, diseño,
permisos, cuentas/expedientes/numeración reales, envíos ni proveedores de producción.
No afirmar100%/perfección desde unit1434 ni desde la suite126 anterior; la nueva
regla de interfaz todavía falla. Comando clave: workflow certification-tests.yml
con unit=true/android=false/context_only=true; Playwright existente, datos reales
persistidos sólo en PostgreSQL sintético, no sesiones falsas ni mocks de negocio.

Primer ensayo focal72 (`37294733008`, SHAe52a91a) cerrado con fallo del test nuevo:
472BE/962FE unit,54HTTP,2SQL y3calendario PASS; nuevo territorial1PASS/4FAIL,
E2E no ejecutado. La prueba pidió un período hacia adelante y esperó403 donde
el contrato de manifiestos ajenos es404 sin datos. Corregidos sólo el inicio
civil del mes y las expectativas exactas por endpoint/rol; se exige presencia
de GPS histórico, igualdad con ADMIN y ningún cambio de documento o eventos.
No son cuatro defectos de producto probados ni un E2E aprobado. Evidencia original
preservada en SDTERA; cierre10:15:59.546UTC y cleanupSUCCESS antes de repetir.

Antecedente integral aprobado: run37253916790 / commit26a3a23, 472 backend y
962 frontend unit, 54 grupos HTTP, 2 SQL, 3 HTTP de calendario, 126 E2E,
15 Android Chrome autenticados QA y 4 APK originales públicos. Esos últimos
cuatro no certifican el APK instalado por el usuario ni su sesión autenticada.

## Diseño del lote nuevo y alcance preservado

- `tracking.routes.ts` ya exige `isAuthenticated` y `requireFullAccess` para sus
  cinco consultas de operación. Los controllers consultan datos globales.
- Centro de Control todavía filtra viajes activos y marcadores para un
  transportista por nombre de empresa. La divergencia del listado quedó
  reproducida en73; el filtro del conjunto del mapa también existe en fuente.
  No se cambió producto dentro de esta solicitud de revisión.
- Nueva comprobación HTTP usa login real de tres actores2, observaciones de
  actor1 persistidas, denegación anónima/token inválido y límites independientes
  de fichas/manifiestos/mutaciones. Cinco grupos, API compilada y PostgreSQL QA.
- Nuevo E2E exige Monitor y Centro globales tras login real y cero carga de datos
  globales sin sesión; doce casos en las tres superficies, cero reintentos.
- `context_only=true` ejecuta estas comprobaciones y nueve recorridos previos de
  contexto: 21 E2E esperados. Es un lote focal, no certificación integral ni APK.
  Si falla se conserva evidencia; no se relaja el test para aceptar el filtro.
- El gate integral futuro aumenta a 138 E2E y exige el recibo territorial.
  No se atribuye ese número como aprobado antes de ejecutarlo.

Las etiquetas superpuestas de Monitor móvil y el banner de instalación de
Chrome, vistos en capturas71, siguen pendientes. No se modifican estilos,
credenciales, APK, proveedores, producción ni datos reales en esta revisión.
El APK disponible es 1.0.0 / versionCode2; el instalado en teléfonos sigue sin
identificación. Físicos, cámara, GPS-background, batería, ruido y celular no se
simulan como aprobados. Publicación del catálogo/manual sigue pendiente y el
preparador anterior bloqueado no se ejecuta ni se elude.

QA se ejecuta sólo en la VM existente de GitHub, en serie, base sintética
`sitrep_night_qa_20260926`, loopback55440/API3037, sin proveedores externos.
Sin Docker, bases, restauraciones, navegador ni emulador local nuevo; sin
reactivar automatizaciones. Evidencia al disco externo, sin repetir paquetes.
Browser plugin not available: se usa el Playwright existente en nube; no se
instalan navegadores locales para esta revisión.
