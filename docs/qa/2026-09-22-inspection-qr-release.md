# Handoff QA — QR de trazabilidad de Inspecciones — 2026-09-22

## Alcance de esta iteración

Este registro describe los cambios de trazabilidad QR de Inspecciones realizados sobre el commit base `90f8aa0` (`fix(inspections): add official branding to legal PDFs`). Corresponde al estado local de la rama de trabajo al 22 de septiembre de 2026; no acredita todavía un despliegue en QA ni en producción.

La iteración incorpora:

- un QR verificable en el acta de campo y el informe técnico;
- verificación pública acotada, sin publicar el expediente completo;
- acceso autenticado a la trazabilidad detallada;
- retorno seguro al destino original después del login, tanto en web como en la PWA;
- identidad visual institucional consistente en PDFs y pantallas de verificación.

## Arquitectura de verificación

### Token QR independiente de la autenticación

El QR contiene una URL de verificación de SITREP cuyo token se firma con HMAC-SHA-256. Este token es deliberadamente independiente del JWT de sesión y usa `INSPECTION_TRACE_SECRET`, que debe ser distinto de `JWT_SECRET`.

La landing usa la ruta frontend `/verificar/inspecciones/:token` y consulta `GET /api/inspecciones/verificar/:token`. El detalle permanece en las rutas autenticadas del módulo de Inspecciones.

El sobre firmado vincula:

- identificador interno de la inspección (`inspectionId`);
- número de expediente (`numero`);
- versión del registro (`recordVersion`);
- huella SHA-256 canónica del expediente (`fingerprint`);
- propósito y versión del formato del token.

La separación de secretos evita que un QR expuesto pueda utilizarse para fabricar un token de autenticación. El HMAC permite comprobar que el enlace fue emitido por una instancia de SITREP que conoce el secreto y que sus campos no fueron alterados después de la emisión.

### Huella, versión y estados públicos

Al consultar el QR, el backend valida el HMAC, recupera la inspección por su identificador, comprueba el número y recalcula la huella canónica con el mismo modelo documental usado para los PDFs.

- `VIGENTE`: la versión y la huella firmadas coinciden con el estado actual del expediente.
- `HISTORICA_AUTENTICA`: el token es auténtico, pero su versión o huella ya no coincide con la versión actual. La pantalla informa ambas versiones sin presentar la copia anterior como vigente.

La respuesta pública se entrega con `Cache-Control: no-store` y directivas para evitar indexación. El endpoint cuenta además con limitación de solicitudes.

### Datos públicos y datos protegidos

La consulta pública expone solamente metadata operativa mínima:

- número de expediente y, cuando existe, número de acta;
- tipo de actor inspeccionado, estado y versión;
- fechas de creación y última actualización;
- huella y versión firmadas;
- huella y versión actuales;
- estado de verificación (`VIGENTE` o `HISTORICA_AUTENTICA`);
- ruta de acceso autenticado al expediente.

No se publican nombres, DNI, CUIT, correos, teléfonos, domicilios, firmas, observaciones, fotografías, adjuntos, evidencias ni el contenido del expediente. La trazabilidad completa continúa protegida por autenticación JWT y por las reglas de acceso del rol y del actor asociado.

## Alcance criptográfico y jurídico

Esta implementación debe describirse como **verificación de trazabilidad del expediente emitida por SITREP**. Sus límites son los siguientes:

- no constituye una firma digital en los términos de la normativa aplicable;
- no autentica byte a byte el archivo PDF descargado;
- no prueba por sí sola la identidad ni la voluntad de cada firmante o interviniente;
- no reemplaza controles de competencia, notificación, cadena de custodia, firma o validez del acto;
- no convierte el acta o el informe técnico en una decisión administrativa final;
- `HISTORICA_AUTENTICA` confirma la autenticidad del token emitido para una versión anterior, no la vigencia actual del documento.

La huella corresponde a la representación canónica del expediente que alimenta los documentos. Cambios puramente binarios del PDF —por ejemplo, metadata del archivo, compresión, paginación o re-render— no se validan como una firma de los bytes del archivo.

Por estos motivos, este handoff no presenta la verificación como una certificación absoluta, una conclusión jurídica definitiva ni una firma digital.

## Flujo web y PWA

El acceso desde el QR funciona en dos niveles:

1. La landing pública muestra la metadata permitida y el estado de verificación.
2. La acción “Ingresar para ver trazabilidad” dirige al login con el destino protegido en `state.from`.
3. Web y PWA preservan `pathname + search + hash` durante la autenticación.
4. El retorno sólo acepta rutas locales que comienzan con `/` y rechaza valores que comienzan con `//`; ante un valor inválido usa `/dashboard`.
5. Para `GENERADOR`, `TRANSPORTISTA` y `OPERADOR`, una ruta `/inspecciones/:id` se traduce a la vista autorizada `/mis-inspecciones/:id`. Los perfiles administrativos o inspectivos conservan la ruta de expediente que les corresponde.

Así, un escaneo QR puede atravesar el login sin perder el ancla `#trazabilidad`, los parámetros de consulta ni el expediente de origen, sin habilitar redirecciones externas.

## QR e identidad institucional en PDFs

El acta de campo y el informe técnico incluyen:

- marca institucional de Gobierno de Mendoza / autoridad ambiental / SITREP;
- tarjeta de verificación con QR real;
- enlace oficial derivado de `FRONTEND_URL`;
- versión y huella SHA-256 del expediente;
- pie institucional y metadata documental coherentes con el tipo de pieza.

El QR no incorpora el JSON del expediente ni datos personales: contiene únicamente el enlace firmado. La identidad visual y el QR son capas de presentación y acceso; no amplían el alcance criptográfico ni jurídico descripto en la sección anterior.

## Configuración obligatoria antes de desplegar

### Producción

- `INSPECTION_TRACE_SECRET`: obligatorio, aleatorio, de al menos 32 caracteres, distinto de `JWT_SECRET` y estable entre reinicios, instancias y despliegues.
- `FRONTEND_URL`: obligatorio con esquema `https://` y host público no local. Para el entorno oficial previsto: `https://rptrazar.mendoza.gov.ar`.

El backend falla al iniciar en `NODE_ENV=production` si el secreto falta, es débil o conserva un valor de ejemplo, o si `FRONTEND_URL` no es HTTPS. Cambiar `INSPECTION_TRACE_SECRET` sin una estrategia de rotación invalida la verificación de los QR emitidos con el secreto anterior; no debe rotarse como parte de un despliegue rutinario.

### Pruebas SITREP

`DISABLE_EMAILS=true` es obligatorio durante las pruebas SITREP, especialmente si el entorno usa destinatarios o datos compartidos. Debe verificarse antes de iniciar cualquier E2E, smoke o prueba conectada a un entorno real. Esta protección evita envíos externos, pero no deshabilita por sí sola otras escrituras; los datos de prueba deben seguir siendo sintéticos y desechables.

No registrar secretos, JWT ni tokens QR completos en el repositorio, reportes de CI o capturas.

## Estado de validación local

Resultados vigentes informados para este corte:

| Capa | Resultado | Estado |
|---|---:|---|
| Backend unitario/integración simulada | 29 archivos, 187 pruebas aprobadas | Completado |
| Build backend | TypeScript y assets | Completado |
| Frontend unitario | 33 archivos, 149 pruebas aprobadas | Completado |
| Build frontend web | TypeScript + Vite | Completado |
| Build frontend PWA | Vite `vite.config.app.ts` | Completado |
| E2E focal Inspecciones | 22/22 en Chrome escritorio y Pixel 7; incluye web y build PWA real, QR válido/alterado, anclas, adjuntos y ledger | Completado |
| Lint crítico Inspecciones | 0 errores / 0 advertencias | Completado |
| Despliegue SITREP de pruebas | Release `20260922-114236-qr`, código `2b92e7b` | Completado |
| Despliegue VPS gubernamental | No realizado ni autorizado en esta iteración | Pendiente de promoción separada |
| Smoke post-deploy web/PWA/API/PDF | 10/10 E2E de sólo lectura sobre la inspección demo publicada | Completado |
| Integridad assets PWA | JS/CSS correctos; asset inexistente devuelve 404 | Completado |
| Auditoría dependencias backend runtime | 0 vulnerabilidades reportadas | Completado |

Los conteos anteriores reemplazan, para esta iteración, los conteos históricos de documentos previos. No deben interpretarse como cobertura total del producto ni como validación de producción.

## Gate de release

Antes de promover el cambio deben completarse y registrarse, como mínimo:

- [x] confirmar en SITREP `INSPECTION_TRACE_SECRET`, `FRONTEND_URL` y `DISABLE_EMAILS=true`;
- [x] verificar QR válido/alterado en navegador y API; `VIGENTE` en SITREP e `HISTORICA_AUTENTICA` en regresiones backend;
- [x] comprobar que la respuesta pública se limita a metadata y no devuelve PII ni evidencias;
- [x] comprobar retorno post-login con path/query/hash en pruebas locales web/PWA y acceso al ancla en SITREP;
- [x] probar autorización por rol localmente y exigir autenticación para descargar PDFs publicados;
- [x] generar acta e informe en SITREP y contrastar versión/huella con la verificación pública;
- [x] desplegar primero en SITREP de pruebas y ejecutar smoke post-deploy;
- [ ] promover a producción sólo el artefacto ya validado y repetir el smoke de sólo lectura;
- [x] registrar versión desplegada, resultados y eventual rollback.

Estado: **publicado y validado en SITREP de pruebas**. No se promovió al VPS gubernamental. Las pruebas conectadas de esta iteración fueron de sólo lectura; no se modificaron actas reales ni credenciales.

### Incidencia de instalación limpia y recuperación

El primer arranque falló porque el override global de `yaml` era incompatible con la API utilizada por `swagger-jsdoc`. El deploy restauró el backend anterior y no cambió el frontend. Se corrigió el override para respetar la dependencia de Swagger, se agregó una prueba de importación/generación de OpenAPI, y se comprobó una instalación limpia y un arranque aislado en el VPS. El segundo arranque pasó y se activaron web/PWA.

Se conservaron backup PostgreSQL y versión anterior, junto con manual y assets previamente publicados. Se aplicaron únicamente las migraciones aditivas `20260922180000_add_inspection_document_drafts` y `20260922193000_add_auditable_inspection_exchanges`. No se reinició el sistema operativo: se reinició sólo el servicio `sitrep-backend` del entorno SITREP. Ambas instancias confirmaron correo deshabilitado.

Inspección utilizada en las comprobaciones: `I-2026-000006`, acta `DEMO-INS-OPE-002`, id `cmu5o9ub5001u7k6eae8yak4g`. Acta e informe responden PDF válido y la huella publicada coincide con el expediente. El código adulterado retorna 404 y la descarga sin autenticación retorna 401.

## Referencias históricas y normativas

- [`2026-09-22-sitrep-deep-app-audit.md`](./2026-09-22-sitrep-deep-app-audit.md): auditoría anterior conservada como evidencia histórica. Sus conteos, conclusiones de readiness y verificaciones productivas corresponden a aquel corte y no sustituyen este handoff.
- [`INSPECCIONES-MARCO-LEGAL-Y-RESILIENCIA.md`](../INSPECCIONES-MARCO-LEGAL-Y-RESILIENCIA.md): marco legal y límites funcionales del módulo, incluido el criterio de no presentar el acta, el informe o su QR como decisión jurídica definitiva.
- Commit base `90f8aa0`: punto de partida de esta iteración y antecedente del branding oficial de los PDFs legales.

## Control de cambios

Código funcional: `0b6ec19`. Corrección de compatibilidad de instalación limpia: `2b92e7b`. Este registro se completa con la evidencia del despliegue del 22/09/2026.
