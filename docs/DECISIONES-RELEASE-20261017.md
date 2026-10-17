# SITREP — decisiones pendientes de backend y scripts antes del release

17/10/2026. Rama `codex/sitrep-uiux-review-20261016`. **Nada de esto está aplicado.** Cada punto trae evidencia, propuesta concreta, riesgo y lo que hace falta del dueño. Detalle de los hallazgos en [HALLAZGOS-UIUX-20261016.md](HALLAZGOS-UIUX-20261016.md) (sección «Cuarta pasada»).

## Bloqueantes de release (decidir antes del lunes)

### S1 — El redeploy con fase3 borraría documentos de inscripción (P0)

**Evidencia:**
- `sitrep-deploy-fase3.sh:245` borra todo `${VM_BACKEND_DIR}` salvo `.env`.
- El `.env` que genera el script (`:184-199`) no define `UPLOADS_DIR`.
- `backend/src/controllers/solicitud.controller.ts:42` guarda en `process.cwd()/uploads/solicitudes`, es decir dentro de `${VM_BACKEND_DIR}`.
- En cambio, documentos de actores, evidencia de inspecciones y adjuntos de soporte usan por defecto `/var/www/sitrep-uploads` (`documento.controller.ts:13`, `inspectionEvidence.service.ts:9`, `supportFile.service.ts:9`).

**Propuesta, sin código nuevo de negocio:**
1. Agregar al `.env` de fase3 `UPLOADS_DIR=/var/www/sitrep-uploads`.
2. Agregar al paso 6 de fase3 `mkdir -p /var/www/sitrep-uploads` y el `chown` del usuario del servicio.
3. Opcional, en otra línea de cambio: alinear el valor por defecto de `solicitud.controller.ts` con los otros tres. Es una línea de backend.

**Antes de aplicar:**
- Revisar en el servidor real si su `.env` ya define `UPLOADS_DIR`. Es sólo lectura y yo no lo hice.
- Si ya existen documentos en `${VM_BACKEND_DIR}/uploads`, copiarlos al nuevo directorio antes del próximo redeploy.

**Necesito de vos:** el OK y quién ejecuta la verificación en el servidor.

### S2 / S3 — Scripts que pueden tocar producción sin protección (P1)

- **`backend/prisma/seed-admin-data.ts`:**
  - Restablece contraseñas de cuentas administrativas.
  - Ejecuta `deleteMany({})` sobre `auditoria`, `logActividad`, `alertaSeguridad`, `alertaGenerada`, `reglaAlerta`, entre otras.
  - No verifica `NODE_ENV`.
- **`npm run demo:repair`** (`backend/prisma/repair-demo-certification.ts`): crea cuentas demo activas con contraseñas conocidas.

**Propuesta:** al inicio de ambos, el mismo guardián que ya usa `seed.ts:9-11`, que aborta si `NODE_ENV === 'production'`. Además, sacar `demo:repair` de `package.json` del paquete de producción.

**Riesgo:** ninguno para la operación; sólo bloquea un uso accidental.

**Necesito de vos:** el OK.

### S6 — Correo deshabilitado en el `.env` de fase3 (P2, confirmar intención)

`DISABLE_EMAILS=true`: recuperación de contraseña, verificación de correo y avisos por email no se envían. Si la salida del lunes debe enviar correo, hay que cambiarlo y definir `EMAIL_DELIVERY_NOT_BEFORE` (`email-policy.ts:6`).

**Necesito de vos:** ¿el lunes se envían correos o no?

## Funciones que hoy fallan para usuarios no administradores (requieren backend)

### F1 — Mi perfil y Configuración no guardan nombre ni teléfono salvo para ADMIN (P1)

**Evidencia:** ambas pantallas usan `PUT /admin/usuarios/:id`, que tiene `hasRole('ADMIN')` (`admin.routes.ts:164`), y no existe un endpoint para que cada usuario edite su propio perfil.

**Opciones:**
- **A (recomendada):** `PUT /auth/profile` autenticado, que sólo acepte `nombre` y `telefono` del propio usuario, con auditoría. Las dos pantallas pasan a usarlo.
- **B (sin backend):** que esas pantallas no ofrezcan editar a quien no es ADMIN y expliquen cómo pedir el cambio.

**Necesito de vos:** A o B.

### F2 — Push en dispositivo compartido sigue del usuario anterior (P1, privacidad)

**Evidencia:** en `push.controller.ts:25-28`, el `update` del `upsert` no reasigna `usuarioId`, y al cerrar sesión no se llama a `/push/unsubscribe`.

**Propuesta:**
- Backend: incluir `usuarioId` en el `update`. Es una línea.
- Frontend: llamar a `/push/unsubscribe` al cerrar sesión. Lo puedo hacer apenas apruebes el backend; hacerlo solo no alcanza.

**Necesito de vos:** el OK del cambio de backend.

### S5 (backend) — Datos personales en logs de canales no implementados

`notification-dispatcher.service.ts:51-60` registra el teléfono de WhatsApp o el chat de Telegram y el texto del aviso a nivel info. La pantalla ya no ofrece esos canales (corregido en esta rama), pero quien los tenía activados sigue pasando por ese log.

**Propuesta:** no registrar el destinatario ni el texto, o quitar esos dos bloques hasta que exista la integración.

**Necesito de vos:** el OK.

## Higiene de repositorio (no bloquea, conviene antes del release)

| ID | Qué | Propuesta |
| --- | --- | --- |
| S8 | `frontend/scripts/capture-*`, `debug-*` con credenciales fijas contra producción | Pasar a variables de entorno, borrar las capturas `debug-*.png` y **rotar esas contraseñas si son cuentas reales** (decisión tuya) |
| S7 | `scripts/health-check.sh` envía alertas a un dominio ajeno | Borrar |
| S9 | `scripts/migration/migration-db-restore.sh` hace `DROP DATABASE` sin confirmar | Confirmación tipeada o archivar |
| S10 | Scripts con hosts distintos | Elegir un destino canónico (`rptrazar.mendoza.gov.ar` según `qrParser.ts`) |
| S11 | `vite.config.v6.ts`, `package.v6.json`, `RUN_V6.sh` | Borrar |
| S12 | `public/test.html`, `public/generate_icons.html` se publican | Borrar |
| S13 | `public/sw.js` con versión manual `v115` | Subir la versión en el release |
| — | `frontend/dist` local viejo (`sw` v81) | No desplegar: recompilar con `VITE_API_URL` del dominio final |

## Otras maquetas detectadas al corregir (no tocadas)

- `CargaMasivaPage`: el botón «Descargar plantilla» muestra «Descarga disponible cuando el API este conectado».
- `ConfiguracionPage` > Perfil: dice «JPG, PNG o GIF. Máximo 2MB» pero no hay control para subir foto.
- **Corregir sin decisión de negocio:** borrar el texto o implementar la función.
