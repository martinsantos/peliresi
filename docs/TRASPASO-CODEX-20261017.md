# SITREP — traspaso a Codex para llevar a producción

17/10/2026. Cierre de la sesión de revisión UI/UX y arreglos. **Nada está desplegado. Nada se integró a `main`.** Este documento es el punto de entrada; los detalles están en los enlaces.

## 1. Fuente exacta

| | |
| --- | --- |
| Repositorio | `https://github.com/martinsantos/peliresi.git` |
| Checkout local | `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746/sitrep-production-source-20261001`. **No** usar el checkout de SDTERA, carpetas tmp ni Precrimen |
| Rama de trabajo | `codex/sitrep-uiux-review-20261016`, subida a origin. El último commit de producto y pruebas es `6b5b2a2`; los commits siguientes, si los hay, son sólo de documentación de cierre |
| Partida | Tag `sitrep-uiux-baseline-20261016` (`9d701e3`) |
| Contra el candidato `codex/sitrep-manifiestos-v2-20261014` | 57 commits adelante y 0 atrás: se puede avanzar sin merge |
| Contra `main` | 457 commits adelante y **1 atrás**: `7e1460b` «Unify SITREP help and directory manual experience (#39)», que toca sólo `docs/manual/*`. Comprobar si su contenido ya está en la rama antes de integrar |
| Commits | Todos con `[skip ci]`. **GitHub Actions no tiene crédito: no disparar workflows** |

## 2. Qué contiene la rama (además del candidato)

- **Interfaz:**
  - errores en español;
  - formularios que conservan lo cargado;
  - listado de manifiestos compacto en teléfono;
  - un solo título por página;
  - menú de cuenta sin selector demo;
  - WhatsApp y Telegram no se ofrecen;
  - carga masiva, contraseña y vehículos corregidos;
  - `/app` con ErrorBoundary y zoom.
- **Backend:**
  - `PUT /auth/profile` (nombre y teléfono propios, con auditoría);
  - las notificaciones push siguen a la persona y no al dispositivo;
  - los scripts de seed y demo exigen `ALLOW_DEMO_SEED=1` y rechazan producción.
- **Despliegue:** `sitrep-deploy-fase3.sh` guarda los archivos subidos en `UPLOADS_DIR=/var/www/sitrep-uploads`, fuera del directorio que se reemplaza.
- **Eventuales nuevos** (aprobados por el dueño, [especificación v2](ESPEC-EVENTUALES-20261017.md)):
  - pueden iniciarlos generador, transportista, operador o ADMIN;
  - los participantes con cuenta aprueban antes de avanzar;
  - el operador puede ser externo;
  - migración aditiva `20261017140000_exceptional_any_party`.
- **Detalle de cada cambio:** [HALLAZGOS-UIUX-20261016.md](HALLAZGOS-UIUX-20261016.md), tandas 1 a 7.

## 3. Validación existente (preview aislado, no producción)

Última corrida completa, sobre la fuente `9b3b71c`, hecha por la sesión de eventuales:
- **E2E 45/45** en escritorio 1440, web móvil 360 y `/app` 390, sin omitidas ni inestables;
- **HTTP 7/7**, más `own-profile-push-http` 4/4;
- **pantallas 20/20**, más 1 omitida a propósito;
- migración probada con una fila del contrato anterior, que quedó intacta;
- sin OOM.

La corrida anterior de títulos (`c0aee8b`) dio E2E 39/39 y pantallas 20/20.

**Unitarias:** se corrieron las afectadas en cada cambio, todas en verde. **No** se corrieron las suites completas de frontend y backend sobre el commit final. Las pruebas del backend sólo corren dentro del contenedor, porque la Mac no tiene sus dependencias de desarrollo.

**No verificado:**
- APK y Android físico;
- `inbox.spec`: falla por falta de un dato de prueba, no del producto;
- texto real de los correos (siguen apagados);
- el `.env` real del servidor.

## 4. Pasos para producción (en orden, cada uno con OK del dueño)

1. **Definir el destino.** Hay dos hosts en juego: `sitrep.ultimamilla.com.ar` (según `CLAUDE.md`) y `rptrazar.mendoza.gov.ar` (según `sitrep-deploy-fase3.sh` y `qrParser.ts`). Hay que confirmar cuál es el del lunes y qué commit corre hoy ahí, con una lectura del servidor que no lo modifique.
2. **Suites completas** sobre el commit final, en el preview aislado: unitarias de frontend y backend, build, HTTP y E2E. Corrida única, con 1 CPU y 2 GiB.
3. **Integración.**
   - Avanzar `codex/sitrep-manifiestos-v2-20261014` hasta esta rama, sin merge.
   - Resolver `7e1460b` contra `main`.
   - Integrar en la rama que se despliega. Ojo: el workflow productivo se dispara con `main`/`master`.
4. **Service worker:** subir `CACHE_NAME` en `frontend/public/sw.js` (hoy `trazabilidad-rrpp-v115`). `sw-app.js` se versiona solo en el build.
5. **Build de frontend** con `VITE_API_URL=https://<dominio>/api` para web y `/app` (ver `CLAUDE.md`). No usar el `frontend/dist` local, que está viejo.
6. **Backend:** `npm run build`, `npx prisma generate` en el servidor, y `npx prisma migrate deploy`. Hay **12 migraciones que `main` no tiene**: desde `20260924190000_inspection_operations` hasta `20261017140000_exceptional_any_party`. Hacer backup de la base antes.
7. **`.env` del servidor:**
   - `UPLOADS_DIR` (fase3 lo agrega si falta);
   - correos apagados (`DISABLE_EMAILS=true`), decisión del dueño: «todavía no»;
   - flags del backend: `ENTERPRISE_ENABLED`, `MANIFEST_EXCEPTIONAL_ENABLED`, `MANIFEST_EXCEPTIONAL_REVIEWERS`, `MANIFEST_ADDENDA_ENABLED`, `MANIFEST_PARTY_REVIEW_ENABLED`, `ACTOR_MULTIROLE_ENABLED`;
   - flags del frontend al compilar: `VITE_ENTERPRISE_ENABLED`, `VITE_MANIFEST_EXCEPTIONAL_ENABLED`, `VITE_MANIFEST_ADDENDA_ENABLED`, `VITE_ACTOR_MULTIROLE_ENABLED`, `VITE_DEMO_MODE=false`.
   - **El dueño decide qué se enciende.**
8. **Despliegue** con fase3 o el procedimiento de `CLAUDE.md` según el destino. Después: health check, ingreso por rol y smoke no mutante.
9. **Documentación desactualizada:** `DEPLOY-NUEVO-SERVIDOR.md:994` y `SETUP.html:266` mandan correr `seed-admin-data.ts`, que ahora aborta a propósito.

## 5. Decisiones y pendientes abiertos

- **Del dueño:**
  - flags del lunes;
  - correos (S6, hoy apagados);
  - log de teléfono y chat de WhatsApp/Telegram en `notification-dispatcher.service.ts` (S5 backend);
  - rotar las credenciales que aparecen en `frontend/scripts/capture-*` (S8).
- **Interfaz, no bloqueante:**
  - patrón compacto en los otros listados;
  - «Editar» visible en manifiestos tratados;
  - Seguridad muestra «Guardar cambios» del perfil (O3);
  - textos de maqueta en carga masiva y perfil (O4, O5);
  - H03, H04, H13, H17, H19 en hallazgos.
- **Higiene de repositorio:** S7, S9–S12 en [DECISIONES-RELEASE-20261017.md](DECISIONES-RELEASE-20261017.md).

## 6. Preview aislado (sintético)

- **Servidor:** `76.13.234.213`.
- **Contenedor vivo:** `sitrep-qa-live-20261017`.
  - Imagen `sitrep-qa-enterprise-20261016:live-20261017`, de 2,2 GB.
  - Límites: 1 CPU, 2 GiB, sin swap, red interna sin gateway, sin puertos publicados.
  - **Se apaga solo el 18/10 cerca de las 15:32 UTC.**
- **Contenedor original:** `sitrep-qa-enterprise-20261016`, detenido e intacto.
- **Fuente:** `/opt/sitrep-qa-enterprise-20261016/source`, montada en `/work/sitrep`. Las fases corren con `preview-run.ts`, usando un env derivado de `preview.env` con `GITHUB_REF=refs/heads/codex/sitrep-uiux-review-20261016` y `QA_ARTIFACTS`, `RUNNER_TEMP` y `UPLOADS_DIR` propios.
- **Una corrida a la vez:** respetar el lock.
- **Acceso desde la Mac:**
  ```
  ssh -L 127.0.0.1:4177:127.0.0.1:14177 root@76.13.234.213 'python3 -u - sitrep-qa-live-20261017' < frontend/cloud-qa/live-bridge.py
  ```
  Después abrir `http://127.0.0.1:4177/app/login`. El puente vive mientras dure la sesión SSH.
- **Cuentas fáciles,** sólo en el preview vivo: `admin|generador|transportista|operador|inspector@sitrep.test` con `Sitrep2026`. Se aplican con `frontend/cloud-qa/live-easy-accounts.ts`, sólo después de restaurar la base viva.
- **Limpieza** cuando ya no se use: borrar el contenedor gemelo y la imagen `:live-20261017`.

## 7. Reglas que siguen vigentes

- Sin datos reales, correos, push productivo ni formulario humano.
- No cambiar reglas regulatorias, permisos, numeración ni históricos para facilitar la interfaz.
- En la Mac, sólo verificaciones livianas: no instalar dependencias ni levantar Docker, base de datos o emuladores.
- **No desplegar ni integrar a `main` sin OK explícito del dueño.**
- No afirmar «100 %» ni GO global.
- **Android y APK no se certifican desde un viewport.**
