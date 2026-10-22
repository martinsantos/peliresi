# Revisión de web y app — 22/10/2026

**Estado actual: esta tanda está incluida en la publicación `712de167` del 22/10/2026 20:15:03 Mendoza. Empresa y multirol siguen apagados.** La evidencia y los estados siguientes describen el cierre anterior. Consultar [publicación y reversión vigentes](ENLACES-AVISOS-CORREOS-20261022.md); no ejecutar la reversión histórica de este documento.

**Cerrada en preview; no publicada.** Base `891cfc86`, rama `codex/sitrep-training-20261018`, único checkout `sitrep-production-source-20261001`. Android físico queda diferido por indicación del dueño. No se accedió a producción ni se modificaron main, datos reales, permisos regulatorios o históricos. CAP cerrado; correos y push apagados. Sin push ni workflows; cierre con `[skip ci]`.

## Qué se corrigió

- **Texto perdido en Mi solicitud.** Una respuesta tardía del servidor podía borrar lo escrito después del envío, incluso el borrador de otra actividad. La conversación se conserva por trámite; sólo se limpia el texto que efectivamente se envió. Cuatro regresiones reprodujeron la pérdida antes de corregirla y aprobaron después. Se verificó contra el backend real en las tres superficies que un mensaje llega una sola vez al trámite correcto y el siguiente permanece sin enviar.
- **Prioridad del trámite.** Estado, observaciones, corrección y conversación aparecen antes de agregar actividades. El selector sigue permitiendo consultar cada solicitud. No cambian las aprobaciones ni las facultades de la cuenta.
- **Controles pequeños y navegación.** Acceso de 48 px, menú y mensajes de al menos 44 px, cierre visible, Escape y retorno de foco. Correo/CUIT sin autocorrección ni mayúsculas automáticas; contraseña visible u oculta con estado accesible. En encabezados angostos se reserva espacio al título; Mi cuenta permanece en el menú.
- **Inspecciones propias.** Generador, transportista y operador ven «Mis inspecciones» y conservan su rol. La ayuda pasa al encabezado para no cubrir requerimientos. No se convierten en inspectores ni se amplían permisos.
- **Contraste y lectura.** Contadores del monitor y estado Cancelado de la ayuda con mejor contraste; separador decorativo excluido de lectura accesible.
- **Manual 2026.22.5.** Guía de acceso, menú y campana; prioridad de correcciones y conservación de conversaciones por actividad. Renderer y CSS conservados.

## Matriz E2E

**316 casos únicos aprobados, cero casos pendientes, fallidos u omitidos en el resultado consolidado.** Chromium en escritorio 1440×900, web angosta y `/app` 360×800; controles adicionales a 320×640, 640×360 y altura reducida. Son navegadores del preview, no teléfonos Android físicos.

| Circuito | Casos únicos aprobados |
| --- | ---: |
| Inventario visual público y autenticado | 24 |
| Navegación, acceso, sesiones, errores y permisos | 30 |
| Propuestas y aprobación de las tres partes | 12 |
| Hallazgos/adendas, certificados y acceso de las partes | 12 |
| Viajes simultáneos y relevos | 4 |
| PSIP: plazos, vencimientos y requerimientos | 12 |
| PSIP: Legales y resultado público | 9 |
| PSIP: intercambio y jerarquía | 9 |
| Inspecciones propias G/T/O y ayuda en el encabezado | 9 |
| ABM, altas administrativas/públicas, modificación e historial | 36 |
| Recuperación, conflictos, reutilización y continuidad de formularios | 42 |
| Controles, menú, campana, giro y soporte | 15 |
| Eventuales | 12 |
| Campana, repositorio y catálogo de alertas | 18 |
| Representación y actividades múltiples | 21 |
| Documentos, ATM, OCR y reintento de adjuntos | 21 |
| Mapas, monitor y QR con dispositivo simulado | 12 |
| Seguimiento y conciliación de participantes externos | 6 |
| Mensajes con respuesta demorada y cambio de actividad | 6 |
| Manual, tutorial, enlaces y recarga | 6 |

Las repeticiones de alta completa (9), controles (15), manual (6) y el caso visual dirigido no se suman otra vez. El consolidado identifica cada caso por archivo, título y superficie, y conserva su último resultado. Playwright se ejecutó con un worker y sin reintentos automáticos; las correcciones y repeticiones explícitas quedan en los registros.

## Unitarias, integración y builds

- Suite completa backend: **1542/1542**. Suite completa frontend: **1842/1842**, ejecutada antes de los últimos ajustes de interfaz. Después de esos cambios: **122/122 unitarias dirigidas**, incluidos mensajes demorados, correcciones, navegación, layouts y manual. No presentar 1842 como una nueva ejecución completa del árbol final ni sumar las repeticiones como pruebas únicas.
- Tipos frontend, compilación backend y builds web/app: aprobados. Lint de 33 archivos afectados: **0 errores y 43 advertencias**; no se suprimieron reglas para aprobar.
- Representación: **131 solicitudes HTTP**, tres roles iniciales y tres carreras concurrentes; identidad común por CUIT, máximo de dos personas compartido entre roles, revocación efectiva en la sesión y cero correos enviados. Multirol: **8 grupos**; históricos de manifiestos intactos.
- Transporte: **18 grupos HTTP/DB de relevos y 8 de flota/GPS**. Seguimiento externo: **7 grupos**; conciliación: **7 grupos**, incluida concurrencia, desvinculación sin borrar el original, exportación y aislamiento entre actores. La conciliación no concede acceso al participante.
- Certificados: los PDFs descargados por generador y transporte coinciden por SHA-256 con el emitido por el operador.
- Plazos: **21 casos**, 9 resueltos y 12 pendientes (incluidos límites horarios); **105 avisos**, 57 entradas originales preservadas, cero casos/avisos duplicados y estado leído conservado. La regla propia del ensayo quedó apagada.
- Documentación: alta G/T/O, verificación de correo por el endpoint real sin enviar mensajes, recibos repetidos sin revelar otra cuenta, lectura de PDF/foto y recuperación de OCR. Archivo inválido rechazado antes del alta; corte simulado de un POST de adjunto después del alta, reintento real y hash del único documento correcto, con **una sola creación de transportista**.

Los builds finales se completaron el **22/10/2026 18:11:41 Mendoza**, API QA `/api`. La trazabilidad verifica **1770 archivos** y **1112 entradas de producto/manual idénticas a las usadas para compilar**. Inventarios: web 521 archivos (`328c060f790d4209f866a6fedf460f1413de965202f03a8d8e1076bd6a0e2951`); app 202 archivos (`8b9650b98674f4892f32821892e0621d6f5db8226cfb2aae86ff7f04b40098b3`). Las huellas corresponden a los inventarios de archivos/bytes/SHA-256, no a un tar de despliegue. No usar estos bundles QA para publicar.

## Fallos diagnosticados durante la ejecución

Se conservaron los intentos fallidos; no se ocultaron ni se debilitaron validaciones del producto:

1. La pérdida de texto se reprodujo en cuatro variantes y se corrigió en producto. Evidencia anterior: `layout-before-message-fix.json`; posterior: 122 unitarias y 6 E2E.
2. El inventario visual necesitaba la fixture de dispositivo y un selector actualizado. El ensayo de plazos necesitaba ejecutar el evaluador real antes de comprobar sus avisos. Se corrigió la preparación del ensayo, no se fabricaron eventos.
3. La prueba documental antigua aprobaba sin verificar el correo y usaba CUIT sin dígito verificador correcto. Ahora verifica la cuenta sintética mediante el endpoint real, después de comprobar que antes no tenía acceso operativo.
4. El administrador compartido tenía un borrador de otro recorrido. El ensayo de adjuntos usa una cuenta artificial propia y no borra borradores ajenos. El PDF inválido ahora se rechaza en el guardado previo: se prueban tanto ese rechazo como la recuperación de un corte posterior, sin respuestas de negocio ficticias.
5. La prueba nueva de mensajes leía el selector antes de que llegaran sus opciones. Espera las dos actividades antes de operar, sin cambiar sus expectativas.
6. El geocodificador externo no resolvía desde el entorno aislado. Se verifica la solicitud y se responde vacío únicamente a Nominatim en la prueba; no salen domicilios artificiales del preview ni se inventan coordenadas. Teselas y cámara están identificadas como simuladas. Esto no certifica disponibilidad del proveedor, GPS ni cámara físicos.
7. Lint detectó espacios consecutivos en una expresión regular existente; se expresan con `{4}`, con la misma coincidencia.

## Seguridad y cierre

Sólo contenedor `sitrep-qa-training-20261018` en `76.13.234.213`; DB local `sitrep_night_qa_20260926`, esquema artificial `web_app_audit_20261022`, API/estáticos en loopback. Trabajos pesados seriales, un worker, **1 CPU / 2 GiB / swap cero**. La memoria alcanzó el límite (133 eventos `max`), **sin OOM ni procesos eliminados por OOM**.

Auditoría final: **912 tablas QA anteriores idénticas**, cero cola activa de correo, cero intentos y cero entregas; proveedores SMTP/VAPID vacíos y flags apagados en ambos procesos. Los cuatro alias CAP devuelven 403. No se consultaron registros reales. Runtime y servidor se cerraron sin SIGKILL; PostgreSQL y contenedor se detuvieron el **22/10/2026 18:32:36 Mendoza**. Imagen, base y evidencias se conservaron para la prueba física posterior.

Main permanece en `c8402190edfc36b5e5d0dee1337c24bd1689420d`. La última publicación documentada es `8a4d8225`; no se accedió al servidor productivo para reconfirmarla. Esta revisión y la tanda de ABM/representación de `891cfc86` siguen **sin publicar**; empresas/multirol no se activaron en producción.

Evidencias locales ignoradas por Git: `test-results-web-app-audit-20261022/`, con `e2e-summary.json`, resultados `audit-*.json`, unitarias, integración HTTP/DB, `build-provenance.json`, `source-proof.json`, auditoría y cierre. Evidencias remotas completas: `/opt/sitrep-qa-enterprise-20261016/source/.qa-web-app-audit-20261022/`, incluidas trazas de intentos anteriores. El código de las pruebas y este informe sí quedan en el commit.

## Android físico pendiente

Al retomarlo: Chrome y PWA instalada; teclado/autocompletado y giro; permisos de cámara/archivos, fotos y OCR; apertura/descarga de PDF; ubicación de varios viajes y relevo; pérdida/recuperación de red, bloqueo y retorno desde segundo plano; actualización de service worker conservando sesión y borradores. Registrar modelo, Android/Chrome y resultado por paso, con datos artificiales y entregas externas apagadas.

Este resultado no es un GO global ni una garantía de ausencia de errores en cualquier dispositivo. No certifica comprobantes fiscales reales, todas las facturas eléctricas históricas ni entrega externa de correos/push.
