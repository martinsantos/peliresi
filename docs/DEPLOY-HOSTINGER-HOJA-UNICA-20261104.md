# Runbook de publicación — Inspecciones, hoja única de campo · 04/11/2026

Instrucciones para que otra persona u otra IA lleve a producción el trabajo del PR #41 sin pisar lo que ya está publicado. Están escritas contra lo que hay en el repositorio el 04/11/2026; antes de cada paso, volver a leer los archivos citados y no confiar en este documento si difieren.

## 1. Identidades (verificar, no asumir)

| Qué | Valor | Cómo comprobarlo |
|---|---|---|
| Repositorio | `martinsantos/peliresi` | — |
| Rama con el trabajo | `codex/inspection-field-model-20261103`, punta `86a8c6a8` | `git ls-remote origin refs/heads/codex/inspection-field-model-20261103` |
| Pull request | #41 hacia `main`, abierto, sin conflictos | `gh pr view 41 --json mergeable,state` |
| `main` | `e8b38ac3` (merge del PR #40, publicador Hostinger) | `git rev-parse origin/main` |
| Base común | `c8402190` | `git merge-base origin/main 86a8c6a8` |
| **Revisión activa en producción** | `8fb6277ecabaace83671a9dfb251147a43c9ccbf` | Default de `expected_active_revision` en `.github/workflows/hostinger-publication.yml`; confirmarla con la operación `preflight` (paso 3) |
| Producción | Hostinger, host `srv2101069.hstgr.cloud` (179.198.115.115), backend en `/srv/umsa-clean-apps/sitrep-backend`, estáticos en `/srv/umsa-clean-proxy/static/sitrep`, servicio `umsa-clean-sitrep-backend`, puerto 3002, base `trazabilidad_rrpp` en localhost | `scripts/cicd/hostinger/publisher.ts`, constantes al inicio |
| Servidor viejo | `23.105.176.45` (el que figura en `CLAUDE.md`) **ya no es producción**: el workflow `deploy-production.yml` en `main` está retirado (commit `48b730d3`) y el host no responde | `git show origin/main:.github/workflows/deploy-production.yml` |

Relación entre las tres puntas, verificada el 04/11:

- `8fb6277e` (producción) **es ancestro de la rama** y **no es ancestro de `main`**. Lo publicado hoy pertenece a la línea de esta rama; `main` quedó atrás del esquema de producción.
- Entre producción y la rama hay 516 commits. `backend/package.json` y `backend/package-lock.json` son **idénticos** a los de producción. `backend/prisma/schema.prisma` difiere en **una tabla nueva**: `inspection_staff_roles` (migración `backend/prisma/migrations/20261103160000_inspection_management_role/migration.sql`, rol de jefatura de inspecciones).
- Fusionar la rama en `main` conserva los tres commits propios de `main` y no borra nada de lo publicado.

Comprobaciones:

```bash
git fetch origin
git merge-base --is-ancestor 8fb6277ecabaace83671a9dfb251147a43c9ccbf origin/codex/inspection-field-model-20261103 && echo rama-contiene-produccion
git diff --stat 8fb6277ecabaace83671a9dfb251147a43c9ccbf origin/codex/inspection-field-model-20261103 -- backend/package.json backend/package-lock.json backend/prisma/schema.prisma
git diff --name-only 8fb6277ecabaace83671a9dfb251147a43c9ccbf origin/codex/inspection-field-model-20261103 -- backend/prisma/migrations
```

## 2. Reglas que no se negocian

1. Ningún paso que toque producción se ejecuta sin el OK explícito del dueño (Martín Santos) sobre el SHA exacto que se va a publicar. Mostrarle el SHA y esperar.
2. No activar ninguna flag en producción. Correos, push y notificaciones externas siguen apagados. No tocar los servicios de capacitación.
3. No usar `git push --force`, no reescribir `main`, no squash ni rebase del PR: el publicador exige que el commit de release esté integrado en `main` y descienda de `c8402190`.
4. Antes de cualquier cambio de esquema, copia de seguridad verificada de `trazabilidad_rrpp`. El publicador restaura código, **no restaura la base** (`rollback.json: databaseRestored:false`).
5. No apuntar nada al servidor viejo ni modificar su `.env`.

## 3. Cómo se publica hoy (lo que hace el publicador)

Workflow `.github/workflows/hostinger-publication.yml`, sólo por `workflow_dispatch` **desde `main`**, con el entorno `production` de GitHub. Tres operaciones, siempre a mano:

1. **`preflight`**: entradas `operation=preflight`, `expected_active_revision=<SHA activo>`; sin `release_commit`, sin bundle, sin acuse. Sólo lee el runtime en Hostinger y falla si la revisión activa no es la esperada. No cambia nada.
2. **`prepare`**: entradas `operation=prepare`, `release_commit=<SHA de 40 caracteres integrado en main>`, `expected_active_revision=<SHA activo>`. En CI aislado: `npm ci`, `npm audit --omit=dev --audit-level=high`, pruebas y build de backend y frontend (`npm run build` y `npx vite build --config vite.config.app.ts`) con `VITE_API_URL=https://sitrep.ultimamilla.com.ar/api`, `VITE_PUBLIC_DEMO_MODE=false`, `VITE_DEMO_LOGIN_ENABLED=false`. Empaqueta `backend/dist`, `package.json`, `package-lock.json`, `prisma/schema.prisma`, `frontend/dist`, `frontend/dist-app` y `docs/manual` (`scripts/cicd/hostinger/package.ts`), sube el bundle a `/srv/umsa-sitrep-publisher/incoming/<run>` y lo deja preparado con su recibo. Anotar el **SHA-256 del bundle** que imprime el run.
3. **`publish`**: entradas `operation=publish`, el mismo `release_commit`, el mismo `expected_active_revision`, `bundle_sha256=<SHA-256 del prepare>`, `acknowledgement=SITREP-HOSTINGER`. Activa exactamente ese bundle, verifica la respuesta pública y, si falla, vuelve atrás el frontend y el código del backend.

Lo que el publicador **rechaza**, por diseño:

- Un candidato cuyo `package.json`, `package-lock.json` o `prisma/schema.prisma` difiera del runtime activo: `compatible()` en `publisher.ts` lanza «Separate dependency/schema review required».
- Un manifiesto con migraciones: `package.ts` escribe `databaseMigrations:false` y `publisher.ts` sólo acepta ese valor.
- Un `release_commit` que no esté en `main` o no descienda de `c8402190`.

## 4. El bloqueo de esta rama y la decisión tomada

La rama cambia el esquema (tabla `inspection_staff_roles`). Con el publicador tal como está, `prepare` construye pero el paso de preparación en Hostinger se niega (`compatible()` en `stage()`), y además `stage()` exige `databaseMigrations:false`.

**Decisión del dueño, 04/11/2026: camino A, extender el publicador con revisión.** Se publica todo, incluido el rol de jefatura. Los caminos descartados se dejan al final de esta sección sólo como registro.

### 4.1 Qué tiene que hacer el cambio al publicador

Un PR **separado, contra `main`**, que toque sólo `scripts/cicd/hostinger/publisher.ts`, `scripts/cicd/hostinger/package.ts`, `scripts/cicd/hostinger/publisher.test.ts` y, si hace falta una entrada nueva, `.github/workflows/hostinger-publication.yml`. Ese PR dispara el job `verify-publisher` (pruebas del publicador y compilación con Node 20.19.6) y lo revisa el dueño antes de fusionarlo. Nada de esto va dentro del PR #41.

Lo que el publicador hace hoy y hay que respetar (leído en `main`, `publisher.ts`):

- `publish()` ya toma una copia de la base con `pg_dump -Fc` dentro del contenedor `directus-admin-database-1` (usuario `umsa_restore_admin_20261027`), valida el archivo con `pg_restore --file=/dev/null` y la guarda en `/srv/umsa-sitrep-publisher/backups/<run>/database.dump` **antes** de tocar el servicio. Esa copia es el punto de partida obligatorio de cualquier migración.
- El backend candidato **no tiene `node_modules` propio**: `nativeLinks()` enlaza `node_modules`, `data` y `uploads` al backend activo. El cliente de Prisma generado vive en ese `node_modules` compartido y fue generado para el esquema actual, sin el modelo `InspectionStaffRole`.
- `prisma` (la CLI) está en `devDependencies` de `backend/package.json`; `@prisma/client` en `dependencies`. No está garantizado que la CLI exista en el `node_modules` de producción.
- El rollback restaura el override de systemd y el proxy, y deja escrito `databaseRestored:false`. No restaura la base.

Especificación mínima del cambio:

1. **Manifiesto declarado.** `package.ts` acepta una lista explícita de migraciones (por argumento, nunca por descubrimiento automático) y escribe en `release.json` `databaseMigrations: [{ name, sha256 }]` más `schemaSha256` del `prisma/schema.prisma` empaquetado. Para este release, la lista tiene un único elemento: `20261103160000_inspection_management_role`. Copiar también el archivo `prisma/migrations/<name>/migration.sql` al paquete.
2. **Compatibilidad acotada.** `compatible()` sigue exigiendo `package.json` y `package-lock.json` idénticos. Para `schema.prisma` acepta la diferencia sólo si el manifiesto declara migraciones, el hash del esquema coincide con `schemaSha256` y cada `migration.sql` coincide con su `sha256`. Cualquier otra diferencia sigue fallando con el mensaje actual.
3. **Acuse distinto.** El workflow exige `acknowledgement=SITREP-HOSTINGER-SCHEMA` cuando el manifiesto trae migraciones, y sigue exigiendo `SITREP-HOSTINGER` cuando no. Un acuse que no corresponde detiene el run.
4. **Preparación sin efectos.** En `stage()` (operación `prepare`), sólo lectura sobre la base: verificar que la migración **no** esté aplicada (tabla `inspection_staff_roles` inexistente; y, si existe `_prisma_migrations`, que no tenga esa fila). Registrar en `ready.json` si la base usa `_prisma_migrations` o no. No aplicar nada en `prepare`.
5. **Cliente de Prisma propio del candidato.** Generar el cliente para el esquema nuevo **dentro de la carpeta del release**, nunca en el `node_modules` compartido, porque regenerarlo ahí rompería el backend activo y el rollback. Opciones a evaluar en el PR: generar en CI (`prepare` del workflow ya corre `npm ci` y `npm run build`) y empaquetar el directorio generado del cliente; o dar al candidato un `node_modules` propio instalado con `npm ci --omit=dev` desde el mismo `package-lock.json`. La prueba del publicador tiene que demostrar que el backend activo no cambia mientras se prepara.
6. **Orden en `publish()`.** Copia de la base (ya existente) → verificar de nuevo que la migración no esté aplicada → aplicar el `migration.sql` en una sola transacción (`docker exec -i directus-admin-database-1 psql -v ON_ERROR_STOP=1 --single-transaction -U <usuario de migración> -d trazabilidad_rrpp < migration.sql`) → si la base usa `_prisma_migrations`, insertar la fila de la migración con el `checksum` que calcula Prisma (SHA-256 del contenido del archivo), `finished_at` y `applied_steps_count=1`, en la misma transacción → reiniciar el servicio con el backend nuevo → `waitBackend()` → proxy. Escribir `databaseMigrated:true` y la lista aplicada en `publication.complete.json`.
7. **Rollback.** La migración es aditiva: crea una tabla vacía con claves foráneas a `usuarios` y no modifica datos existentes. El código anterior (`8fb6277e`) no la usa. Por eso el rollback del código **no borra la tabla**; deja escrito `databaseMigrationKept:true` con el nombre de la migración y la ruta de la copia de la base. Si el dueño pide volver la base atrás, se hace a mano desde esa copia, nunca automáticamente.
8. **Pruebas del publicador** (`publisher.test.ts`): manifiesto con migración aceptado sólo con hashes coincidentes; esquema distinto sin migración declarada rechazado; acuse equivocado rechazado; migración ya aplicada rechazada en `prepare`; orden copia → migración → reinicio; rollback que conserva la tabla y registra la copia.

Antes de escribir el PR, la IA que lo haga confirma en sólo lectura (operación `preflight` o una consulta acordada con el dueño) si la base de Hostinger usa `_prisma_migrations` y qué usuario de PostgreSQL tiene permiso de `CREATE TABLE` en `trazabilidad_rrpp`. No lo inventa.

### 4.2 Orden completo

1. PR del publicador contra `main` (4.1) → `verify-publisher` en verde → revisión y OK del dueño → fusión.
2. Fusión del PR #41 (sección 5). No hay conflicto con el paso anterior: #41 no toca `scripts/cicd/hostinger/`.
3. `preflight` (sección 6).
4. `prepare` con el commit fusionado (sección 7). El recibo debe decir que trae la migración `20261103160000_inspection_management_role`.
5. `publish` con `acknowledgement=SITREP-HOSTINGER-SCHEMA` (sección 8).

### 4.3 Caminos descartados (registro)

- **B. Publicar sin la tabla**, revirtiendo la migración, el modelo `InspectionStaffRole` y la gestión de jefatura. Descartado por el dueño: se perdía el rol de jefatura.
- **C. Aplicar la migración a mano en Hostinger y editar el runtime.** Prohibido: `current()` compara el código y el esquema del runtime con `state.json` y fallaría con «Concurrent managed file change» o «Initial deployed code differs»; sólo serviría rompiendo las guardas.

## 5. Fusionar el PR #41 (no publica nada)

Con el OK del dueño:

```bash
gh pr view 41 --repo martinsantos/peliresi --json mergeable,mergeStateStatus,state
gh pr merge 41 --repo martinsantos/peliresi --merge --subject "Merge pull request #41: inspecciones, hoja única de campo"
git fetch origin && git rev-parse origin/main   # anotar: este es el candidato a release_commit
```

Después del push a `main` corren los jobs de validación de `deploy-production.yml` (lint, pruebas, builds); los jobs de deploy están en `if: false`. Esperar a que terminen en verde: `gh run list --repo martinsantos/peliresi --branch main --limit 3`. Si fallan, no seguir: resolver en un PR nuevo.

Dos archivos de prueba del frontend ya fallaban antes de este trabajo y no están en el arnés del laboratorio: `frontend/src-v6/__tests__/pages/InspectionInlineSave.test.tsx` y `InspectionWorkspace.keyboard.test.tsx`. Si `npm test` de `main` los corre, van a fallar en CI y en `prepare`. Decisión pendiente del dueño: actualizarlos o retirarlos antes del release.

## 6. Preflight

Desde GitHub → Actions → «SITREP reviewed Hostinger publication» → Run workflow en `main`: `operation=preflight`, `expected_active_revision=8fb6277ecabaace83671a9dfb251147a43c9ccbf`, el resto vacío. Si falla, la revisión activa no es esa: detenerse, leer el error y pedir al dueño la revisión real. Nunca adivinar un SHA.

## 7. Prepare

Sólo después de fusionar el PR del publicador (4.1) y el #41, y con el SHA del dueño: `operation=prepare`, `release_commit=<SHA de 40 caracteres del merge en main>`, `expected_active_revision=<el del preflight>`. Guardar el recibo del run y el `BUNDLE_SHA`. Entregárselo al dueño para revisión: el publicador exige que alguien lea ese recibo antes de publicar.

## 8. Publish y comprobaciones

`operation=publish` con `bundle_sha256=<BUNDLE_SHA>` y `acknowledgement=SITREP-HOSTINGER-SCHEMA` (el acuse para releases con migración que agrega el PR del publicador). Luego, además de lo de abajo, confirmar en sólo lectura que `inspection_staff_roles` existe y está vacía. Luego, sólo lectura:

- `https://sitrep.ultimamilla.com.ar/release.json` debe contener el `release_commit`.
- `https://sitrep.ultimamilla.com.ar/api/health` responde `ok` con `db: connected`.
- Con la cuenta de un inspector real: abrir una inspección **en campo** debe mostrar la hoja única («1. Estoy acá» … «4. Cerrar la visita», barra fija arriba); una en revisión o cerrada muestra el expediente anterior. No crear datos de prueba en producción.
- Flags: `INSPECTION_FIELD_MODEL_ENABLED` no se activa. Sin ella, `GET/POST /api/inspecciones/:id/accesos-acta` y `/correos-acta` responden 404 y el panel «Copia y presentaciones del inspeccionado» al pie del bloque 4 va a mostrar un error de carga; la gestión de jefatura no aparece. El build de `prepare` no define `VITE_INSPECTION_FIELD_MODEL_ENABLED`, así que el frontend tampoco la muestra. Si el dueño quiere esas funciones, es una decisión aparte sobre los archivos de entorno de Hostinger (`/srv/umsa-migration/clean-sitrep-backend.environment`, `sitrep-live.environment`), nunca en el mismo release.
- Si algo falla, el publicador ya hizo rollback del código y conserva la tabla nueva, vacía. La base no vuelve sola: la copia está en `/srv/umsa-sitrep-publisher/backups/<run>/database.dump`; restaurarla sólo con orden del dueño.

## 9. Qué queda fuera de este runbook

- `CLAUDE.md` del repositorio sigue describiendo el servidor viejo como producción; conviene corregirlo en un PR aparte.
- El preview privado del laboratorio (puerto 4188 en la Mac del dueño) no forma parte de producción y vence solo.
- La sesión paralela «Inicio y lista de inspecciones» está incluida en la rama (commits `ff92fb06`, `74763e1b`).

Documentos de contexto en la rama: `docs/INSPECCION-HOJA-UNICA-20261104.md`, `docs/INSPECCION-SIMPLIFICACION-344-20261103.md`, `docs/INSPECCION-P0-PRESENTACIONES-CORREOS-20261103.md`, `docs/DECISIONES-RELEASE-20261017.md` y `docs/SITREP-DEPLOY-PRD1-RUNBOOK.md` (este último describe el servidor viejo).
