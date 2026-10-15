# Adendas: control documental, anexos y decisiones de revisores

## Alcance del candidato

Sin publicación ni cambios a producción. La continuidad operativa y las rectificaciones aditivas ya están definidas; no se vuelven a consultar. Este corte permite ver los pendientes documentales y descargar un anexo informativo independiente por adenda y versión.

- El manifiesto, sus cantidades declaradas, número, firmas, eventos y certificado original no se reemplazan.
- La versión 0 conserva el registro pendiente; cada resolución agrega una versión. Descargar una versión histórica no incorpora decisiones posteriores.
- El PDF incluye declaración conservada, carga observada completa, motivo, referencia de rectificación, autores, fechas, decisiones incluidas y huella del contenido estructurado. La huella no es una firma digital.
- Las cantidades observadas no se suman automáticamente a las originales. Las corrientes no se declaran compatibles por ausencia de evidencia.
- Un resumen sobre todas las páginas muestra pendientes, observadas y rechazadas, incluso después del cierre operativo.
- «Adendas revisadas» no significa expediente conforme o cierre documental acreditado. No se crea una transición oficial de cierre hasta definir las reglas de revisores.
- Acceso al PDF requiere sesión y vínculo/autorización sobre el manifiesto. Descargas privadas sin caché compartida.
- La reproducibilidad verificada aplica al mismo generador de PDF y versión del candidato. No se implementó un archivo firmado e inmutable de PDFs emitidos entre distintas versiones futuras del software.

## Recorrido web, móvil y APK

1. Transporte u operador vinculado abre el manifiesto y entra a **Adendas y revisión posterior**.
2. Registra la carga observada completa y el motivo. La declaración se conserva; la operación continúa.
3. El revisor habilitado en QA resuelve cada adenda por separado. El generador consulta, sin recibir autoridad implícita.
4. **Control documental** muestra pendientes de todo el manifiesto. **Descargar anexo vN** obtiene el estado actual.
5. En **Trazabilidad de la adenda**, elegir una versión anterior y descargarla. La versión 0 sigue pendiente aunque una posterior esté aprobada o rechazada.
6. En Android se verifica archivo recibido, contenido, visor nativo y retorno a SITREP. Se usa APK QA separado, no la aplicación firmada de producción.

## Decisiones pendientes — una única lista para revisores/DGFA

| ID | Decisión necesaria | Comportamiento conservador del candidato |
|---|---|---|
| R1 | ¿Qué roles/sectores pueden resolver cada modalidad, incluidas empresas multirol? ¿Cuándo debe intervenir la autoridad? | Sólo revisor ADMIN explícito de QA; sin autoaprobación del autor ni del administrador que lo impersonó. No habilita una matriz productiva. |
| R2 | ¿Cómo se asigna, deriva o reemplaza un revisor ausente y quién autoriza esa delegación? | Sin derivaciones ni sustituciones automáticas inventadas; historial de cada resolución conserva autor. |
| R3 | ¿Qué identidad/evidencia mínima exige cada resolución y qué plazo/escalamiento corresponde? | Motivo y autor obligatorios; no se inventan vencimientos ni avisos reales. La operación no espera la conformidad. |
| R4 | ¿Qué efecto documental tienen observación, rechazo o falta de respuesta? ¿Qué acredita el cierre y cómo se presentan certificados parciales? | Hechos conservados, estado operativo separado y pendientes visibles. Silencio no aprueba; anexo no acredita cierre ni habilitación. |
| R5 | ¿Qué metadatos, firma y evidencia vinculan los documentos originales del operador con sus rectificaciones? ¿Se exige archivo de cada PDF emitido? | Anexo separado/versionado, sin reemplazar originales ni atribuir firma oficial. No se implementa todavía carga/archivo de certificados originales en este corte. |
| R6 | ¿Cuál es la fuente autorizada y versionada para compatibilidad de corrientes, operador y transporte? | Diferencia registrada, compatibilidad sin verificar y sin bloqueo operativo; no se presume aptitud. |

No se vuelve a preguntar si externos o diferencias pueden continuar, si se permite post facto, quién emite el certificado final (operador), ni si las rectificaciones deben preservar originales: ya está definido. Numeración excepcional, cómputos exactos y avisos de agenda continúan en el [registro general de decisiones](DECISIONES-MANIFIESTOS-V2-20261014.md).

## Aceptación y evidencia

Pruebas nuevas: versiones históricas y actuales, rechazo visible, permisos/aislamiento, versiones inválidas, resumen global paginado, PDF multipágina con carga máxima, descarga desde escritorio/web móvil/app, visor Android y retorno. Histórico sintético y documentos originales sin cambios. Proveedores externos deshabilitados.

**Validación del corte aislado cerrada, sin publicar.** Candidato `7ef526e`, [corrida 38722598671, intento 2](https://github.com/martinsantos/peliresi/actions/runs/38722598671/attempts/2) SUCCESS: 1004 unit backend, 1454 frontend, 18 E2E escritorio/web móvil/app y circuito del APK separado Android 15 completos. Anexos actuales/históricos descargados y abiertos en visor nativo; retorno con encabezado completo, histórico sintético preservado y limpieza verificada. PDF de cinco folios revisado sin pérdida de contenido. Fallos previos, correcciones, evidencias y límites se registran en [QA](QA-BAJA-INTENSIDAD-20261014.md). No es GO de producción, certificado oficial ni actualización firmada del APK instalado. Las decisiones R1–R6 no quedan resueltas por pasar las pruebas.
