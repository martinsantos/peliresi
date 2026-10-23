# Validación de login, multirol, representantes, manifiestos y enlaces — 23/10/2026

**Resultado: 105/105 E2E y 382/382 unitarias dirigidas PASS en preview.** Son 35 E2E por superficie: web escritorio, web de ancho móvil y `/app`, con Chromium. No se encontró un defecto de producto reproducible en estos recorridos. Android físico queda pendiente por decisión del dueño; no se certifican sensores ni instalación en teléfono.

Sólo se trabajó en el checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`. HEAD inicial `4bf4570f16734585a069b39dd8cd74dfc7672d4f`; producto ensayado `a7f20d2f181adc2e30a1930d175efa831dfd4e05`. Se comprobaron sus **2.444 archivos Git** antes de cada fase. Se reutilizaron sus builds QA con API relativa `/api`; no se recompiló ni cambió el producto. No se accedió a producción ni se modificó main.

## Qué quedó comprobado

| Bloque | Resultado | Recorrido |
|---|---:|---|
| Login y sesiones | 12/12 E2E | Errores 401/429 visibles; reintento con login HTTP real, recarga, restauración de sesión y cierre entre pestañas. Los errores iniciales se inyectan en navegador; no se fuerza un bloqueo real del servidor. |
| Multirol y representantes | 33/33 E2E | Una identidad con G/T/O, actividades pendientes sin permisos operativos, invitaciones y revocaciones, responsable separado de autorización, máximo dos personas en total incluida la titular, sin cupos extra por rol/sede. Borradores conservados, búsqueda/paginación con más de 200 empresas y alcance por sede. |
| Propuestas de manifiestos | 12/12 E2E | Creación por generador, transporte y operador; aprobación individual de las tres partes; agenda que cambia sin recargar, espera, unanimidad, coordinación, retiro y aviso al manifiesto exacto. Incluye el manual del recorrido. |
| Ciclo completo del operador | 3/3 E2E | Creación, tres aprobaciones con firma del generador, coordinación, retiro, entrega con confirmación del chofer, recepción, pesaje, tratamiento, parcial, cierre y final. Generador y transporte reciben avisos sin recargar su bandeja y descargan el mismo PDF que el operador: hash SHA-256 idéntico entre las tres partes. Parcial de 7 kg y final total de 21 kg, sin sumar dos veces. |
| Enlaces de correos y avisos | 45/45 E2E | Doce escenarios de correo por superficie, login y recarga sin perder destino, aviso privado, adenda exacta aunque haya más de veinte posteriores y guía del manual. |
| Backend | 273/273 unitarias | Doce archivos: autenticación, límites de login, empresas, representación, actividades, agenda, propuestas, enlaces y correo. |
| Frontend | 109/109 unitarias | Diez archivos: contrato de login/sesión, permisos, actividades, campana, actualización de bandeja, navegación y formularios de empresas. |

Son **105 casos E2E únicos**, sin omitidos ni reintentos automáticos en las ejecuciones finales. Las 382 unitarias son una regresión dirigida; no se presentan como la suite completa del repositorio. Hay **249 capturas** de las ejecuciones aprobadas.

Las pruebas HTTP adicionales pasaron: representación **131 solicitudes**, casos de límite/altas **133 solicitudes**, empresa **7 grupos**, multirol **8 grupos**, propuestas **8 grupos**, y soporte/PSIP/privacidad de enlaces. Se probaron carreras de aprobación, rechazo y cancelación, actores ajenos/inactivos y conservación del manifiesto histórico artificial.

Los doce escenarios de enlace comprenden adenda aprobada, tratamiento iniciado/completado, cancelación, comprobante repetido en alta y en ficha, tres etapas de soporte, requerimiento PSIP con plazo y los recordatorios a los 23 y 30 días desde la firma. El botón principal apunta a `/app/`; la alternativa web conserva el mismo registro, parámetros y fragmento. No se enviaron esos correos.

## Hallazgo del guion y revisión visual

El primer intento del nuevo ciclo completo agotó 240 segundos en la entrega. El guion buscaba `Confirmar Entrega` y esperaba el POST sin completar el diálogo del chofer. Se corrigió el guion para pulsar **Confirmar entrega → Sí, Confirmar Entrega**, con una espera de respuesta acotada y sin cambiar el producto, permisos ni expectativas. Se conservan el fallo inicial, dos casos no ejecutados de ese intento y sus capturas. La repetición completa pasó **3/3**; no se suman los intentos como casos nuevos.

Se revisaron capturas de login/logout, perfil y tres actividades, dos personas, agenda en espera, tratamiento/cierre, certificados recibidos, correo PSIP con su expediente y adenda exacta. En esas muestras se verificaron títulos y botones legibles, rutas correctas y ausencia de desbordamiento horizontal u overlay de error. No es una certificación visual de toda combinación de pantalla.

La consola conserva las respuestas negativas esperadas: 401/429 de login, 403 de actividad revocada y 404 de un request a la empresa durante revocación y de avisos ajenos. La suite original de propuestas registra 108 advertencias por bloquear deliberadamente Service Workers en Playwright; los tres ciclos completos los permiten y tienen **cero eventos de consola**. No hubo excepciones de aplicación sin manejar en los recorridos revisados.

## Aislamiento y cierre

Preview `76.13.234.213`, contenedor `sitrep-qa-training-20261018`; ejecución serial, un worker, **1 CPU, 2 GiB y swap cero**. Cluster PostgreSQL nuevo `pg-final-web-app-20261023`, sólo datos artificiales. Los esquemas anteriores de esta tanda quedaron intactos: **63 tablas** al cerrar propuestas y **126** al cerrar enlaces. Los clusters QA previos permanecieron detenidos y se conservaron.

Cada grupo verificó sus procesos reales: **CAP cerrado**, cuatro alias rechazados con 403, correos/push apagados. Se verificaron cero intentos, cero entregas y cero cola activa de correo; los proveedores externos quedaron vacíos. La auditoría de propuestas renderizó **252 avisos** de sus fases sin enviarlos. No hubo contactos reales, sesiones humanas, imports ni consultas a producción.

API/static cerrados sin terminación forzada, PostgreSQL detenido, puertos 3037/4177/55440 sin escucha y contenedor detenido el **23/10/2026 a las 07:47:43 de Mendoza**. Imagen, tres clusters y evidencias conservados. Pico de memoria 2.113.126.400 bytes, debajo de 2 GiB; eventos de límite y OOM en cero. Main conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push, despliegue ni workflows.

## Manual, cambios y límites

El manual **2026.22.7** conserva contenido, renderer y CSS. Se validaron las guías de empresa/representación, propuestas y enlaces/plazos en las tres superficies. No fue necesario modificar comportamiento ni actualizar su versión. Este cierre agrega el informe y lo enlaza desde AGENTS y el traspaso; el guion ampliado y toda la evidencia quedan conservados en el directorio de resultados.

La publicación y reversión vigentes siguen siendo las documentadas en [el cierre de multirol](DESPLIEGUE-MULTIROL-20261022.md); no se volvieron a inspeccionar ni ejecutar. **Android físico, GPS de sensores, captura de enlaces por una PWA instalada y entrega externa de correo/push siguen pendientes.** La comprobación de `/app` en Chromium no sustituye esas pruebas. Browser plugin not available: se usó Playwright en el preview aislado; para futuras revisiones interactivas puede instalarse el plugin Browser.

## Evidencia

- [Consolidado y alcance](../test-results-final-web-app-20261023/summary.json), [105 casos](../test-results-final-web-app-20261023/cases.json), [fases y fallo inicial](../test-results-final-web-app-20261023/phases.json).
- [Consola revisada](../test-results-final-web-app-20261023/console-assessment.json), [revisión visual](../test-results-final-web-app-20261023/visual-review.json), [índice de 249 capturas](../test-results-final-web-app-20261023/screenshots.json).
- [Guion del ciclo completo](../test-results-final-web-app-20261023/manifest-complete.spec.ts), [runner y guardas](../test-results-final-web-app-20261023/runner.ts), [consolidador reproducible](../test-results-final-web-app-20261023/consolidate.py).
- [Reporte E2E del ciclo completo](../test-results-final-web-app-20261023/evidence/proposals/manifest-complete.json), [auditoría de propuestas](../test-results-final-web-app-20261023/evidence/proposals/proposal-audit.json), [auditoría final de enlaces](../test-results-final-web-app-20261023/evidence/links/audit.json).
- [Cierre del preview y recursos](../test-results-final-web-app-20261023/closure.json).

Los archivos de `test-results-final-web-app-20261023/` están excluidos de Git y permanecen en este checkout. La copia remota está en `/opt/sitrep-qa-enterprise-20261016/source/.qa-final-web-app-20261023/`. No contienen datos reales; no publicar los bundles QA `/api` en producción.
