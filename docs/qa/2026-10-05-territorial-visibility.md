# Visibilidad territorial — regla confirmada y prueba pendiente

El usuario confirmó el 05/10/2026 que generadores, operadores y transportistas
pueden consultar datos globales de Monitor y Centro de Control dentro del sistema.
Esto exige sesión válida y no restringida. No habilita acceso público, lectura de
fichas ajenas, documentos privados, edición, cancelación o toma de viajes ajenos.
La autenticación protege la API: ocultar un enlace en la UI no reemplaza ese control.

Antecedente integral aprobado: run37253916790 / commit26a3a23, 472 backend y
962 frontend unit, 54 grupos HTTP, 2 SQL, 3 HTTP de calendario, 126 E2E,
15 Android Chrome autenticados QA y 4 APK originales públicos. Esos últimos
cuatro no certifican el APK instalado por el usuario ni su sesión autenticada.

## Revisión del criterio nuevo

- `tracking.routes.ts` ya exige `isAuthenticated` y `requireFullAccess` para sus
  cinco consultas de operación. Los controllers consultan datos globales.
- Centro de Control todavía filtra viajes activos y marcadores para un
  transportista por nombre de empresa. Se registra como divergencia candidata
  y se exige reproducción real antes de certificarla, sin cambiar el producto
  dentro de esta solicitud de revisión.
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
