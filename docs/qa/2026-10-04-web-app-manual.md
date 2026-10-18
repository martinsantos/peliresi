# SITREP: revisión web, app y manual

## Alcance y criterio de cierre

La validación usa el commit exacto de la rama `codex/sitrep-cloud-qa-20261002`, mediante el workflow existente `certification-tests.yml`. Un resultado debe leerse en los recibos de esa ejecución; los conteos anteriores no certifican un commit nuevo. No hay exclusiones para inflar cobertura ni equivalencia entre cantidad de tests y porcentaje de toda la superficie.

Se comprueban permisos/sesiones, manifiesto hasta tratamiento y PDF, inspección hasta intercambios y cierre/derivación, avisos/destinatarios, Centro de Control, Monitor y reproducción histórica, reportes, fichas/altas, selección y acordeones, GPS, cola offline, recuperación del escáner y el manual. Las escrituras se limitan a PostgreSQL sintético en loopback. Correo, push y blockchain están deshabilitados en QA; nada se evalúa sobre expedientes o numeración reales.

## Evidencia previa, no atribuir al nuevo commit

Run [37244338496](https://github.com/martinsantos/peliresi/actions/runs/37244338496), commit `9152045651627edb2bed06264532e2ddf75c56c5`: 469 unit backend, 958 unit frontend, 54 grupos HTTP reales, 2 comprobaciones de identidad SQL del subscriber compilado, 123 E2E, 15 Android y 4 APK públicos aprobados; tres compilaciones, cierre y limpieza aprobados. Sin fallos, pendientes unit, flaky ni omisiones E2E. Se revisaron 36 capturas del nuevo catálogo/repositorio y dos capturas nativas Android, no todas las pantallas.

## Cambios de esta tanda

La ejecución integral del commit `24d3273` detectó una inconsistencia real: `active-days` agrupaba en UTC y el historial consultaba días de Mendoza. Las tres superficies recibieron HTTP 200 con cero eventos al elegir una fecha UTC que todavía no había empezado en Mendoza. No se aprobó esa ejecución ni se cambió la aserción para aceptar el vacío. La reparación alinea el calendario del selector con el de reproducción, devuelve fechas civiles sin reinterpretarlas e incluye días con GPS registrado aunque no haya evento nuevo. Tres unit y tres comprobaciones de HTTP/PostgreSQL real cubren la frontera 02:59:59.999/03:00 UTC y el día con sólo GPS. Requiere un nuevo gate integral del commit exacto; no se atribuye su aprobación al antecedente.

- Guía buscable y accesible desde el Centro de Ayuda: configurar reglas, simular sin enviar, activar/evaluar, verificar aviso del responsable y gestionar el caso con motivo. Diferencia lectura, resolución, actuación de origen y formalidad legal.
- Directorio actualizado con las tres familias implementadas y los límites de DDJJ/TEF/OCR/mensajes sin plazo; vigencia documental hasta fin del día en Mendoza.
- Siete capturas originales, sin edición, con datos sintéticos y procedencia/hash en `docs/manual/capture-provenance.json`. Identificadas como QA, catálogo pendiente de publicación al 04/10/2026. No incluyen cuentas ni expedientes reales.
- Brecha de distribución comprobada: el inventario previo contenía sólo `dist/manual/directorio.html`, mientras QA servía el resto desde la fuente. Ahora se congela el manual completo antes de servirlo; pruebas y paquete usan la misma copia compilada. La comprobación byte por byte rechaza cambios, faltantes y symlinks externos.
- Cuatro unit nuevas del manual y un recorrido E2E nuevo por superficie: entrada, tutorial, imágenes con hashes reales, índice móvil, destino y recarga, sin solicitudes a la API de negocio. Tres pruebas puras del empaquetado, independientes de los conteos Vitest.

## Cómo ejecutar y comprobar

Ejecutar **una sola** tanda del workflow existente con `unit=true`, `android=true`, `context_only=false`, `alert_only=false`, `load_only=false`, después de subir el commit. No abrir otra VM hasta finalizar la limpieza de ésta. Leer `backend-unit.json`, `frontend-unit.json`, `http-summary.json`, `expiry-identity.json`, `e2e.json`, `android/result.json`, `apk/result.json`, los inventarios y `closure.json`. Revisar las nuevas capturas; no certificar UI por los contadores.

Los gates mantienen 54 grupos HTTP, dos SQL, 15 Android y 4 APK. Los E2E completos pasan de 123 a 126 por la guía en escritorio, responsive y app. El resultado nuevo sólo se declara aprobado después de ejecutarlo, con cero fallos, pendientes, flaky u omisiones y cierre comprobado.

## Android: qué acredita y qué no

- Android 15/API 35 real emulado en nube: Chrome autenticado sobre backend sintético; prueba teclado, permisos, sesión/reinicio, GPS, cola offline y recuperación de QR. Chrome/GMS se verifican estables antes/después. No emulador, Docker, PostgreSQL, API ni navegador adicional en la Mac.
- APK original firmado: instalación, login público HTTPS y relanzamiento anónimo. **No acredita el recorrido autenticado completo del APK usado por el usuario.** No se crea un clon que altere dominio o firma para atribuirle esa certificación.
- Pendientes externos: teléfono físico, exacto APK instalado, Safari, ruido/micrófono, batería, red celular y comportamiento de GPS en segundo plano. Geolocalización del emulador y cámara sintética no representan esos entornos.

## Producción y límites

Commit y push no son publicación. El catálogo nuevo y este manual aún no se han desplegado. La ejecución del preparador de publicación fue bloqueada por protección local; no se copia, reformula ni ejecuta por otra vía para eludirla. Una promoción requiere habilitación humana específica y revisión del candidato exacto, preservando datos, symlinks, respaldo y configuración de proveedores vigente.

No se modificaron leyes, criterios de aceptación de descargos, proveedores externos, cuentas, numeración o expedientes reales. El manual no promete servicio de correo/push ni llama a ejecutar los ejemplos sobre producción. Persisten ajustes visuales menores de truncamiento, avisos temporales, fecha/hora legacy y coherencia de categoría en fichas; la suite aprobada no equivale a perfección global.
