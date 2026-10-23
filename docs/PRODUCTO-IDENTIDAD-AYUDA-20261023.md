# Identidad, bienvenida, enlaces y ayuda — 23/10/2026

Revisión limitada al checkout `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`, desde `9ae90974` (producto anterior `a7f20d2f`). Sólo preview con datos artificiales. **No publicado; sin producción, main, push ni workflows.** CAP cerrado y correos/push apagados.

## Cambios de producto

La bienvenida ahora distingue generador, transporte, operador, auditor, inspector y las cuatro administraciones. Explica creación por cualquiera de las tres partes, unanimidad, coordinación, retiro físico, varios viajes, hallazgos y emisión explícita de certificados. Puede volver a abrirse desde Ayuda y Configuración. No asigna permisos ni aprueba actividades.

Configuración → Apariencia permite elegir Según el dispositivo, Siempre web o Siempre app. La preferencia se guarda por persona, no por empresa. El botón principal de los correos resuelve el registro exacto después del login; conserva parámetros y anclas. Las alternativas explícitas Web/App y la campana mantienen su contrato. AUTO elige app en pantalla táctil angosta o ventana instalada, y web en escritorio. La captura del enlace por una PWA instalada depende del sistema operativo y permanece pendiente de Android físico.

Ayuda ofrece orientación según pantalla y rol, el manual correspondiente y un acceso explícito al reporte técnico. Abrir ayuda no captura ni envía información. Un campo inválido habilita orientación sin abrir una ventana ni quitar el foco. Sólo consulta validez, ruta y rol; no lee ni transmite lo escrito. El trabajo y los archivos pendientes de soporte se conservan.

La flecha circular es verde sobre blanco, sin bloque de contraste. Se unificaron cabeceras de aplicación, menú móvil, solicitante, monitor, correos y manual, además de favicon/iconos y carga. La estructura y los recorridos del manual se conservan; su cabecera cambia a blanco para evitar el recuadro detrás de la marca.

## Documentos y conservación

Manifiestos, certificados parciales/finales, anexos y documentos de inspección comparten marcas proporcionadas, descriptor legible, márgenes y jerarquía. El título ya no se repite debajo de las marcas y de nuevo en el cuerpo. Los reportes descargados desde web/app siguen esa identidad. Las tablas repiten cabecera, las descripciones extensas continúan y las firmas no quedan aisladas por un salto de página evitable.

El manifiesto conserva partes, establecimiento, asignación de vehículo/chofer, residuos, observaciones, fechas, firmas, QR y verificación cuando existen. In situ se identifica sin inventar transporte. Las adendas conservan declaración, carga observada, hallazgo, revisión y huella de la versión. Actas e informes mantienen formalidades, evidencias y estados documentales propios; no se infiere conformidad ni firma.

**Los certificados firmados almacenados se entregan con sus bytes y hash originales.** El nuevo diseño se aplica a nuevas emisiones y representaciones; no reescribe historia. El certificado anterior al circuito gestionado conserva su título y contenido.

## Revisión de diseño

| Antes | Después | Motivo |
|---|---|---|
| Cabecera PDF con descriptor diminuto y título duplicado | `drawInstitutionalMasthead(...)` compartido; título una vez en el cuerpo | Reconocer emisor y documento con jerarquía legible |
| `fontSize(5.x)` en referencias de marca | Descriptor de 8,5 pt y wordmark de 20 pt, verde sobre blanco | Impresión legible, sin competir con el título |
| Certificado con sección de firma separada del contenido | `layout.section('03  FIRMA E INTEGRIDAD', 155)` reserva espacio | Evitar un encabezado huérfano y mantener firma/huella juntas |
| Marca con recuadro de color y variantes divergentes | `SitrepMark` y assets derivados del mismo SVG | Coherencia entre cabecera, carga, manual, correo y PDF |
| Bienvenida genérica o desactualizada | `ROLE_GUIDANCE` distingue actividad y responsabilidad | No indicar al operador que sólo otro perfil puede crear |
| Correo con una vista principal fija | `/app/abrir?destino=...` + preferencia personal + alternativas directas | Mantener el objeto y la intención tras autenticarse |
| Secciones sin nombre y un icono sin título | Solicitudes, Renovaciones, Vehículos y Tratamientos identificados en sus cabeceras | Mantener orientación también al entrar desde un enlace directo |
| Botón de ayuda que iniciaba captura | `TaskHelp` antes de `Reportar un problema` | Orientar primero y capturar sólo por una acción explícita |

## Validación

Pruebas pesadas exclusivamente en el contenedor aislado, seriales, un worker, 1 CPU, 2 GiB y swap cero. Datos artificiales en un clúster nuevo; las bases QA anteriores se mantienen separadas. No se ejecutaron suites ni renderizado masivo en la Mac.

| Control | Resultado |
|---|---|
| Suite completa backend | 1.597/1.597; sin omitidos |
| Suite completa frontend | 1.879/1.879; sin omitidos |
| Documentos | 41 pruebas incluidas en backend; 14 PDF / 43 páginas renderizadas e inspeccionadas |
| Experiencia de producto | 42 E2E únicos: bienvenida de ocho perfiles, preferencias, ayuda, 22 secciones, formularios públicos, manual, enlaces inválidos y reportes |
| Propuestas de las tres partes | 12/12 E2E |
| Ciclo completo hasta certificado | 3/3 E2E |
| Acceso y navegación de soporte | 3/3 E2E |
| Enlaces de correo, campana, PSIP y soporte | 81/81 E2E |
| Comunicaciones | 198 escenarios, 197 correos, 167 avisos, ocho perfiles, 614 renders; diez controles de galería PASS |
| HTTP | Ocho grupos de propuestas; etapas de soporte/PSIP y recordatorios a 23/30 días desde firma |
| Compilación | Backend, tipos frontend, build web y build app PASS |

**141 E2E únicos** entre escritorio, web angosta y app; las repeticiones finales no suman casos nuevos. Tras las suites completas se ajustaron textos del manual, una expresión equivalente de redirección y los títulos/loader de los layouts: se repitieron 8 pruebas del manual, 21 de enlaces, 80 pruebas de ambos layouts, tipos/builds y las verificaciones de navegador afectadas. El consolidado y los primeros intentos se conservan en las evidencias; no se presenta toda la suite como ejecutada después de esos últimos ajustes.

**Lint:** 31 archivos frontend modificados pasan con cero errores y 31 advertencias. El lint global no está limpio: quedan dos errores preexistentes de código (alias de `this` en `SupportAudioInput.test.tsx` y `prefer-const` en `indexeddb.ts`), un AppleDouble ajeno al código versionado en el preview y advertencias por encima del límite global. Se corrigió el error de expresión regular en el archivo de redirección tocado; no se aumentaron umbrales ni se desactivaron reglas.

La auditoría de propuestas conservó el manifiesto histórico artificial byte a byte y verificó los avisos de cada transición. La auditoría posterior de enlaces comprobó **64 tablas protegidas intactas**, cuatro accesos CAP rechazados, cero intentos de correo y cero cola activa. El catálogo aislado no hizo conexiones a base ni envíos; su navegador no realizó solicitudes externas.

**Cierre: 23/10/2026 11:00:33 Mendoza.** Runtime, PostgreSQL y contenedor detenidos; imagen, bases artificiales y evidencias conservadas. Se alcanzó el límite de memoria durante la tanda, sin OOM ni procesos eliminados por memoria. No hubo ejecución paralela de suites.

Comprobaciones finales posteriores: 80/80 unitarias de ambos layouts; revisión de las 22 secciones repetida en las tres superficies; tipos/builds web/app y catálogo de correos regenerados. El consolidado es **47 E2E por superficie**, sin reintentos ni omitidos en la última comprobación de cada caso. Se cotejaron 2.463 archivos con la huella sincronizada; tras QA sólo se completaron el informe y los puntos de entrada documentales.

El índice visual local contiene 14 documentos y 78 capturas; sus 193 referencias a archivos se verificaron. No pudo abrirse automáticamente en el navegador integrado porque su política rechaza el protocolo `file:`; se entrega como archivo local, sin intentar eludir esa restricción. Los PDF y las capturas sí fueron inspeccionados; la galería de comunicaciones pasó sus controles en el navegador del preview.

[E2E consolidado](../test-results-product-ux-20261023/e2e-consolidated.json) · [Cierre y recursos](../test-results-product-ux-20261023/closure-final.json) · [Auditoría de aislamiento](../test-results-product-ux-20261023/links/audit.json).

[Galería visual local](../test-results-product-ux-20261023/index.html) · [PDF y páginas](../test-results-product-ux-20261023/proposals/pdf-pages/index.json) · [Galería de comunicaciones](../test-results-product-ux-20261023/proposals/gallery/index.html). La galería permite filtrar web, web angosta y app y abrir cada PDF completo.

## Incidencias encontradas y corregidas

- El pie del PDF quedaba fuera del área de cuerpo y PDFKit podía agregar páginas al dibujarlo. Se reserva el pie de forma explícita; se verifican paginación, contenido extenso y firma.
- La lectura del selector CSS `:invalid` podía generar eventos recursivos en el entorno de pruebas. La ayuda ahora consulta `validity.valid`, conserva el foco y retira la indicación cuando el campo queda corregido.
- La selección de preferencia tardaba en reflejar el clic. Ahora muestra la opción mientras guarda, impide envíos simultáneos y vuelve a la anterior ante un error; probado con una respuesta 503 y reintento.
- El primer guion visual trataba un asistente de inscripción como un elemento `<form>` y confundía el título editorial del manual con el encabezado de la aplicación. Se revisa la etapa y el campo real del asistente, y que los glifos del manual queden dentro de su cabecera. No se elimina la comprobación de desbordes.
- La exportación de reportes tenía dos botones con el mismo texto visible. El guion identifica el control principal por su etiqueta accesible, descarga el PDF y conserva evidencia de las tres vistas.
- La revisión visual detectó cabeceras genéricas en Solicitudes/Renovaciones/Tratamientos de la app y Renovaciones/Vehículos de web, además del título oculto de Tratamientos. Se restauraron los nombres y la jerarquía visible; la revisión E2E ahora exige esos títulos en las tres superficies.
- La galería de correos heredaba un identificador de fuente antiguo. Ahora toma la etiqueta de la ejecución y conserva las huellas de cada emisor/template; se regeneró y revisó.
- El catálogo aislado de correos incorporó un bloqueo explícito del nuevo renderer PDF compartido al cargar emisores. No se ejecuta ni se simula un envío: la galería sigue usando los textos y templates reales y prohíbe generar documentos desde ese entorno.
- Al quitar el rótulo duplicado del encabezado común, el certificado anterior necesitaba un título completo en el cuerpo. Se añadió y se comprobó además que un certificado firmado existente no se regenere.

Las evidencias guardan los primeros intentos, incluidos fallos y casos no ejecutados por corte. El consolidado usa la última comprobación de cada caso y superficie; una repetición no suma un caso nuevo. La inspección de 22 secciones por superficie cubre identidad, lectura y geometría, no todas las combinaciones de negocio de cada formulario.

## Migración y publicación futura

Nueva migración aditiva `20261023120000_user_link_preference`: campo `usuarios.preferenciaEnlaces`, valor inicial AUTO y restricción AUTO/WEB/APP. La prueba SQL aislada conserva la fila previa, aplica el valor inicial, acepta WEB y rechaza valores inválidos. No se aplicó en producción. Una publicación futura requiere respaldo/migración y builds con el dominio final; no usar bundles QA con API `/api` como entrega productiva.

Manual de contenido y cabecera `2026.23.1`; renderer conservado. Dos guías nuevas: `bienvenida-preferencia-ayuda` y `documentos-identidad-integridad`; actualizado el recorrido de enlaces. La publicación/reversión vigentes siguen siendo las de [multirol](DESPLIEGUE-MULTIROL-20261022.md), sin inspeccionarlas ni ejecutarlas en esta tarea.

Android real, GPS de sensores, instalación de PWA y entrega externa de correo/push siguen pendientes. Las pruebas de `/app` en Chromium no los certifican ni implican una validación global de toda combinación de pantalla.
