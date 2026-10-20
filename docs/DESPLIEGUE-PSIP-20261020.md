# PSIP publicado — 20/10/2026

**Backend, web, `/app` y manual publicados desde `527d915cf600b793333fd4772ea7e8178cd77f0f`** en `sitrep.ultimamilla.com.ar`, el **20/10/2026 a las 11:01:45 Mendoza** (`14:01:45.320Z`). Autorización explícita del dueño: publicar ese commit, preservar CAP cerrado, correos/push apagados y flags actuales, sin `main`, datos reales ni workflows, con smoke no mutante.

Incluye agrupación PSIP, intercambio con responsables/plazos, corrección del borrador offline y avisos internos por actuación. [Flujo](PSIP-FLUJO-INSPECCIONES-20261020.md) y [avisos y validación funcional](PSIP-AVISOS-INTERNOS-20261020.md). No se modifican estados regulatorios o permisos ni se presenta una campana/apertura como notificación fehaciente.

## Releases y configuración

| Componente | Release activo |
| --- | --- |
| Backend | `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261020-psip-527d915c` |
| Web, app y manual | `/var/www/sitrep` → `/var/www/sitrep-releases/20261020-psip-527d915c` |
| Identificación pública | `/release.json`: `source`, `backendSource` y `manualSource` iguales al SHA autorizado |

Manual **2026.20.13**, CSS y renderer idénticos por hash a la publicación anterior. SW raíz **v130**, app **20261020135436**. La fuente del SW raíz sigue en v127 dentro de `527d915c`: sólo se versionó la caché del artefacto, como en la publicación anterior. La activación sigue siendo explícita desde el aviso de nueva versión; se conservaron assets anteriores para sesiones abiertas.

El `.env` se copió **byte por byte**, modo 0600; SHA-256 anterior/nuevo **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Verificado en archivo, dos workers activos y PM2 guardado:

- `UPLOADS_DIR=/var/lib/sitrep-uploads`, sin consultar ni mover documentos; enlace histórico de compatibilidad `uploads` conservado.
- CAP cerrado: `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`. Sin reapertura de accesos ni logins.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y contraseña SMTP ausente. No se enviaron correos ni push. Los avisos PSIP tienen además exclusión propia del relay por su tipo y `soloCampana`.
- Relevos y GPS múltiple conservan sus flags true, también en Vite. Enterprise, eventual, adendas, revisión de partes y multirrol conservan false; `VITE_DEMO_MODE=false`. Ningún flag nuevo.

Sólo se recargaron los dos workers `sitrep-backend`, ambos online en el release nuevo. El control final de las **11:04:36 Mendoza** conservó los mismos PID y reinicios de la activación. Nginx y la configuración de las demás aplicaciones PM2 no cambiaron.

## Esquema, dependencias y respaldo

**Sin migraciones ni restauración de base.** Esquema y manifiestos de dependencias idénticos al backend anterior `d372ce6e`. Cliente Prisma generado/verificado en preview: mismo esquema canónico que el cliente productivo anterior, SHA-256 **`533612bcdb80daad9dcde06ac66608a11ddc28ae33089feda00d0c5acd00d1fb`**. Se comprobaron 230 dependencias de runtime, 14 archivos del cliente y su motor RHEL/OpenSSL. Sin instalar paquetes ni modificar el cliente del release anterior.

Auditoría privada root: **`/var/backups/sitrep/20261020-psip-527d915c/`**. Respaldo verificado del `.env` y estado PM2, modo 0600; inventario/hash de la interfaz anterior y releases previos preservados. Sin dump nuevo: no hay migración ni modificación de registros de negocio. No se copiaron base, credenciales o dump privado de PM2 a la Mac ni al preview; los reportes locales sólo contienen metadatos filtrados.

## Compilación y comprobaciones

Único checkout autorizado, rama `codex/sitrep-training-20261018`. **2.199 blobs** contrastados antes/después de compilar en preview aislado, serial, un worker, **1 CPU/2 GiB/swap cero**. API incorporada: **`https://sitrep.ultimamilla.com.ar/api`**. El manual se empaquetó exclusivamente desde los archivos registrados en Git.

Archivos verificados por SHA-256 al preparar y activar: **366 backend**, **499 web/manual**, **196 app**, **14 cliente Prisma**.

| Comprobación de publicación | Resultado |
| --- | --- |
| HTTP público desde servidor, sólo GET | **76/76** |
| HTTPS externo desde Mac, sin sesión | **9/9** |
| `scripts/ops/check-pwa-assets.sh` | **PASS** |
| Readiness, dos workers, `.env`, PM2 guardado, flags y CAP | **PASS** |
| Manual, guía PSIP y capturas artificiales | Bytes iguales al paquete verificado |

El smoke comprueba shells web/app, rutas de inspecciones/participación/avisos, JS/CSS y chunks PSIP, ambos service workers, precache, manual versionado/capturas, identificación pública, asociación PWA, 404 de asset ausente y redirección `/app`. Health/readiness sólo comprueban conexión/servicio. Las API de inspecciones, participación, intercambio, campana y transporte rechazan sin sesión con **401**, antes de consultar expedientes. Sin POST/PUT/DELETE, logins, ejercicios, GPS ni consultas de registros de negocio.

Aceptación funcional previa del código: **157/157 backend**, **79/79 frontend**, **9/9 recorridos** (3 roles × web/web móvil/app), **81 actuaciones / 432 avisos**, **20/20 manual**, **6/6 navegador de ayuda**. Durante la publicación se recompiló con la API final y se hizo smoke; no se repitieron suites globales ni se certificaron dispositivos físicos, sensores o entrega de push.

Incidencia: el primer build se detuvo por faltar la copia del modelo OCR en el paquete aislado. Se incluyó la caché cuyo SHA/tamaño exige el código y se recompiló en otra carpeta (`r2`), sin modificar producto ni producción. Intentos conservados. `ps` no estaba instalado en el contenedor; su cierre se verificó con Docker: `Running=false`, `Pid=0`, `OOMKilled=false`.

## Rollback preparado, sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-psip-527d915c/publish-production.js rollback'
```

Recupera backend **`d372ce6e`**, que conserva custodia por tramos, desde `/var/www/sitrep-backend-releases/20261019-relevos-d372ce6e`; interfaz **`6788c82c`** y manual anterior desde `/var/www/sitrep-releases/20261020-psip-527d915c-rollback`. Esa copia incluye assets de ambas versiones, SW raíz **v131** y app **20261020140009**. Conserva CAP/canales/flags/uploads, verifica readiness y guarda PM2.

**No restaura base, elimina actuaciones ni revierte migraciones.** El esquema no cambió. Los avisos PSIP registrados se conservan; la interfaz anterior pierde las mejoras PSIP y sus enlaces nuevos. No volver a un backend previo a relevos/GPS múltiple. Script con guardas de releases, archivos y configuración; **no ejecutado**.

## Cierre

Preview propio `sitrep-qa-training-20261018` detenido a las **11:05:12 Mendoza**, sin túnel nuevo; imagen y artefactos preservados. `memory.events`: `max=0`, `oom=0`, `oom_kill=0`. Salida 143 por SIGTERM previsto, `OOMKilled=false`.

Evidencia local ignorada: `test-results-deploy-527d915c/`. Preview: `.qa-release-527d915c-20261020/` y `.qa-release-527d915c-20261020-r2/` en `/opt/sitrep-qa-enterprise-20261016/source`. Auditoría productiva en la carpeta privada indicada. Cierre posterior sólo documental con **`[skip ci]`**, sin push ni workflows; `main` conserva **`c8402190edfc36b5e5d0dee1337c24bd1689420d`**. Producto publicado `527d915c`, con el versionado de artefactos declarado arriba.
