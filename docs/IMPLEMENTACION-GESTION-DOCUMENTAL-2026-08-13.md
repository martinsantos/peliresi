# SITREP — estado de implementación documental, ATM, OCR y certificados

Fecha: 2026-08-13
Alcance: espejo SITREP (`sitrep.ultimamilla.com.ar`) en el checkout local. La producción gubernamental queda fuera de esta etapa.

## Resultado ejecutivo

La primera implementación está construida y validada localmente, pero todavía no está publicada en el espejo. No se ejecutaron migraciones, despliegues, altas, logins de prueba, cambios de credenciales ni envíos SMTP en el espejo público o producción. Sí se creó una base PostgreSQL local descartable para validar el circuito QA.

## Implementado

- Alta tipada de generador, operador y transportista, con reanudación mediante sesión restringida, verificación de correo y guardado idempotente por sección.
- El snapshot TEF se persiste con el mismo payload que se muestra al avanzar o enviar; no depende de que React termine un render antes del autosave.
- Upload multipart canónico `file`, validación por firma binaria, límite de 10 MB, almacenamiento privado fuera del webroot, nombres aleatorios, permisos `0600`, `nosniff`, descarga autenticada y `Cache-Control: private, no-store`.
- Cuarentena/escaneo ClamAV obligatorio cuando `FILE_SCAN_MODE=required`; el modo desactivado sólo está permitido fuera de producción.
- Migración aditiva para archivo binario, documento regulatorio, requisitos por política, comprobante ATM, credencial y emisión de certificado. Las relaciones regulatorias usan `RESTRICT` para conservar evidencia histórica.
- La política de requisitos se lee desde `RequisitoDocumental` cuando la migración está instalada; el mapa tipado queda sólo como fallback de compatibilidad para bases locales todavía no migradas.
- Dedupe ATM por SHA-256 global, emisor+referencia normalizada y HMAC; colisiones devuelven `409 DOCUMENTO_YA_REGISTRADO` sin revelar propietario y se auditan.
- Patente, DNI, licencia, CUIT y referencia ATM normalizados; importes ATM en centavos `BIGINT`.
- Flota y choferes como registros individuales; tarjeta vehicular/licencia se vinculan al sujeto correcto y se normalizan en ABM.
- En la pantalla de detalle de transportistas se pueden cargar por separado tarjeta verde (frente/dorso), autorización/tarjeta azul (frente/dorso) y licencia del chofer; cada documento queda pendiente de OCR/revisión y se autoriza por sujeto.
- OCR local con Tesseract.js en Web Worker y fallback interno Node Worker. Los modelos están en `frontend/public/ocr` y `backend/assets/ocr`; no se usa CDN ni un servicio externo de IA.
- Certificados PDF inmutables, hash SHA-256, QR Ed25519, verificación pública con divulgación mínima y estados vigente/vencido/revocado.
- No se puede crear ni emitir una credencial si faltan documentos regulatorios aprobados, limpios y vigentes; la comprobación se repite al emitir para evitar saltar una revocación o vencimiento posterior.
- Reglas de autorización por sujeto real: propietario de solicitud, administrador sectorial sólo de su sector, root admin transversal, auditor sin mutaciones.
- Analytics omite cuerpos documentales y redacciona PII/OCR/documentos.

## Segunda fase implementada localmente

- Se añadió `backend/src/services/legacyDocumentBackfill.service.ts` y `backend/scripts/backfill-legacy-documents.ts`. El backfill es dry-run por defecto, conserva las filas históricas, valida la firma binaria y exige `DOCUMENT_BACKFILL_CONFIRM=YES` para escribir.
- La relación `DocumentoRegulatorio.legacyDocumentoId` permite migrar el pipeline legacy sin borrar ni duplicar la evidencia histórica. Los binarios migrados pasan por el almacenamiento privado y ClamAV cuando está requerido.
- `ActorDocumentPanel.tsx` integra en generadores, operadores y transportistas carga documental, ATM, OCR, revisión, descarga, credenciales y emisión de certificado.
- `scripts/qa-document-preflight.sh` rechaza URLs con marcadores de producción y sólo permite preparar una base QA explícitamente confirmada como aislada. No ejecuta la migración por sí solo.

## Rutas agregadas

`GET /api/solicitudes/:id/requisitos` · `PUT /api/solicitudes/:id/secciones/:seccion` · `POST /api/solicitudes/:id/documentos` · `POST /api/documentos/:id/ocr` · `PATCH /api/documentos/:id/confirmar` · `GET /api/documentos/:id/download` · `POST /api/actores/:tipo/:id/comprobantes-atm` · `GET /api/actores/:tipo/:id/credenciales` · `POST /api/admin/actores/:tipo/:id/credenciales` · `POST /api/admin/credenciales/:id/emitir-certificado` · `GET /api/certificados/:id/download` · `GET /api/certificados/verificar/:token` · revisión administrativa.

## Verificación local

- Backend: `33` archivos, `290/290` tests.
- Frontend: `9` archivos, `78/78` tests.
- `npm run build` backend: OK.
- `npm run build` frontend: OK.
- `npx vite build --config vite.config.app.ts`: OK (PWA y precache OCR).
- `npx prisma validate` y `npx prisma generate`: OK contra una URL de esquema local ficticia, sin conectarse a una base real ni ejecutar migraciones.
- Base QA espejo local: `sitrep_qa_final` en PostgreSQL descartable sobre socket/puerto local, inicializada desde el esquema legado congelado (este checkout no contiene una migración inicial) y con las 13 migraciones registradas, incluidas las cinco nuevas. La migración documental y el puente legacy aplicaron correctamente y sembraron 9 requisitos. Se creó sólo un fixture QA (un admin y dos generadores locales, sin cuentas demo). El backfill legacy se ejecutó en `DRY_RUN`, con 0 filas migradas y 0 errores. La base/instancia se detienen al cerrar la sesión; no se toca el espejo público ni producción.
- OCR real local sobre PNG y PDF: OK (`tesseract.js@7-worker`, idioma `spa`, confianza observada 94–95%).
- `git diff --check`: OK.

La suite mutante `frontend/e2e/document-qa-workflow.spec.ts` quedó preparada para
una base descartable: exige `QA_CONFIRM_ISOLATED=YES`, `QA_E2E_CONFIRM=YES`,
credenciales QA explícitas y `DISABLE_EMAILS=true`; no usa las credenciales demo
ni envía correo. El gate `scripts/qa-document-config-preflight.sh` verifica además
HMAC, Ed25519, ClamAV y un almacenamiento fuera del webroot sin imprimir secretos.

La corrida final contra `sitrep_qa_final` ejecutó **3/3 E2E verdes**: concurrencia/idempotencia ATM y conflicto entre actores, aprobación documental con emisión/verificación QR y descarga PDF, y shell PWA. El smoke público read-only local ejecutó **2/2 verdes** (health/alta/assets OCR/verificación pública). Los cambios descubiertos durante la corrida fueron corregidos: serialización segura de `BigInt` ATM, fixtures regulatorios con bytes distintos para que la deduplicación global no los confunda y proxy API opt-in para Vite QA.

## E2E y espejo (estado previo al despliegue)

El E2E público de lectura (`frontend/e2e/document-public-assets.spec.ts`) quedó preparado para comprobar health, alta, assets OCR y verificación de certificado sin mutaciones. La auditoría anterior del espejo público (antes de publicar este WIP) tuvo **1 paso pasado y 2 fallidos**; ese resultado corresponde al build/API anterior y queda como antecedente, no como estado vigente.

Los GET al espejo previo respondían para `/api/health`, `/inscripcion/generador`, `/app/` y la ruta HTML pública de certificados. En ese corte, `/ocr/worker.min.js` y los demás assets OCR devolvían `200 text/html` (fallback de Nginx, no el binario esperado), y `GET /api/certificados/verificar/not-a-valid-certificate` devolvía `401` en lugar de la respuesta pública `404/400` del backend nuevo. El release publicado a continuación corrige esas comprobaciones.

## Precondiciones antes de publicar

1. Obtener una base QA aislada del espejo y hacer backup/verificación de conteos; si comparte datos reales, no aplicar la migración. Ejecutar primero `scripts/qa-document-preflight.sh` y luego `scripts/qa-document-config-preflight.sh` con el usuario del servicio.
2. Configurar en el entorno QA `DOCUMENT_HMAC_SECRET`, claves Ed25519 persistentes, `FRONTEND_URL=https://sitrep.ultimamilla.com.ar`, `FILE_SCAN_MODE=required`, ClamAV y `UPLOADS_DIR` privado. `scripts/qa-generate-document-secrets.sh` prepara el material en un directorio indicado por el sysadmin, fuera del webroot; luego debe cargarse en el servicio y validarse con `scripts/qa-document-config-preflight.sh`.
3. Ejecutar `prisma migrate deploy` sólo con aprobación y ventana de rollback.
4. Construir/paquetizar backend, web y PWA; publicar y limpiar caches con el nuevo service worker.
5. Ejecutar `frontend/e2e/document-qa-workflow.spec.ts` (Chromium/PWA) en un runner con permisos de navegador y fixtures QA, incluyendo concurrencia ATM, MIME falso, malware, expiración documental, descarga cruzada y QR no autenticado. La suite mutante permanece omitida por defecto.
6. Ejecutar el backfill en QA con `DOCUMENT_BACKFILL_DRY_RUN=true` (ya validado: 0/0/0) y luego, tras revisar el reporte, `DOCUMENT_BACKFILL_CONFIRM=YES DOCUMENT_BACKFILL_DRY_RUN=false npm run documents:backfill`. La emisión de credenciales nuevas queda bloqueada hasta que el expediente regulatorio nuevo esté completo. La carga binaria offline en PWA tampoco se considera garantizada todavía: el formulario puede reanudarse, pero los archivos requieren conectividad hasta implementar una cola IndexedDB cifrada.

Estas precondiciones describían el estado antes de publicar. El espejo ya tiene migraciones, configuración y smoke read-only aplicados; el criterio de salida funcional completo sigue requiriendo ejecutar la suite mutante contra una base QA aislada con fixtures y aprobación operativa.

## Despliegue espejo — 2026-08-13

Se publicó el release candidato en el servidor del espejo, conservando el
release anterior y un backup PostgreSQL/configuración en
`/var/backups/sitrep/20260813235250`. Se aplicaron las dos migraciones
documentales nuevas; Prisma quedó `Database schema is up to date`. El nuevo
proceso escucha en el puerto histórico `3010`, con `FILE_SCAN_MODE=required`,
ClamAV, storage privado, claves Ed25519/HMAC persistentes y `DISABLE_EMAILS=true`.

Smoke posterior al corte: health HTTP 200, web `/` 200, PWA `/app/` 200, assets
OCR públicos con MIME/tamaño correctos, verificación inválida 404 y Playwright
read-only **2/2**. No se ejecutó backfill porque la base no contiene filas
legacy pendientes (`legacyPending=0`), ni se enviaron correos.

El host canónico operativo es
`https://sitrep.ultimamilla.com.ar/`. Nginx mantiene el alias `www` y redirige
a ese host, pero `www.sitrep.ultimamilla.com.ar` actualmente no tiene registro
DNS; el administrador del dominio debe crear un `A` hacia `23.105.176.45` o un
`CNAME` hacia `sitrep.ultimamilla.com.ar` para que la URL solicitada resuelva.
