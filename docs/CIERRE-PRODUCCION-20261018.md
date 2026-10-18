# SITREP — cierre de producción 18/10/2026

**Desplegado el 18/10/2026 a las 08:01:26 de Mendoza (11:01:26 UTC)** en https://sitrep.ultimamilla.com.ar.

Fuente: `1ab057a57e07237625b3f9fb34d5e80623ecd4bf`, sin modificaciones de producto. Durante el despliegue, checkout autorizado en `main`, limpio; sin commits, pushes ni workflows. El cierre posterior sólo modifica documentación con `[skip ci]`.

## Release activo

- Backend: `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261018-1ab057a`.
- Web y `/app`: `/var/www/sitrep` → `/var/www/sitrep-releases/20261018-1ab057a`.
- El manual y sus capturas se publicaron desde el mismo commit.
- Identificación pública: https://sitrep.ultimamilla.com.ar/release.json.
- Service worker raíz: `trazabilidad-rrpp-v116`; `/app`: `20261018001836`.
- Nginx conservó su configuración; se verificó con `nginx -t`. No se modificaron otros proyectos.

## Preparación y verificaciones

Backend compilado en el preview aislado `76.13.234.213`, contenedor `sitrep-qa-live-20261017`, con 1 CPU, 2 GiB, swap cero, ejecución serial y lock. Duración: 26,44 segundos. Sin OOM ni incremento del contador de límite de memoria. Los 1.502 archivos de fuente coincidieron con los blobs del commit antes y después.

Se ejecutaron el compilador y la preparación de assets de `npm run build`, con salida aislada. El modelo OCR fue verificado por tamaño y SHA-256. Al terminar se restauró el preview sintético; no se reemplazó su build vivo.

La primera comprobación encontró que Docker declaraba swap cero pero el cgroup efectivo tenía `max`; el guard abortó antes de compilar. Se corrigió sólo ese límite del contenedor y se verificó `memory.swap.max=0` antes del build.

En producción se prepararon directorios nuevos. Se verificaron 335 archivos del backend, 243 de web y 186 de `/app` contra sus manifiestos SHA-256. Los artefactos frontend son exactamente los del paso 5, compilados con la API final y los cuatro flags de funcionalidad y demo en false.

`package.json` y `package-lock.json` coinciden con el release anterior. Se copiaron las dependencias a un directorio independiente, desreferenciando los enlaces antiguos; se verificaron 230 paquetes de runtime contra el lockfile. No se instalaron ni actualizaron dependencias. Prisma 5.22.0 se generó dentro del release nuevo, en un proceso limitado a 1 CPU/2 GiB/swap cero. El cliente generado coincide exactamente con el formato canónico del esquema fuente; se verificaron el motor nativo RHEL y Sharp 0.35.4. El cliente activo anterior quedó intacto.

El backup de base del paso 6 se volvió a verificar por SHA-256 antes de activar. `prisma migrate status` devolvió `Database schema is up to date!`. No se ejecutaron nuevas migraciones ni se restauró la base durante este paso.

## Configuración preservada

El `.env` mantiene exactamente el SHA-256 del paso 7: `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`.

```text
UPLOADS_DIR=/var/lib/sitrep-uploads
ENTERPRISE_ENABLED=false
MANIFEST_EXCEPTIONAL_ENABLED=false
MANIFEST_ADDENDA_ENABLED=false
MANIFEST_PARTY_REVIEW_ENABLED=false
ACTOR_MULTIROLE_ENABLED=false
MANIFEST_EXCEPTIONAL_REVIEWERS=
DISABLE_EMAILS=true
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
```

Se verificaron estos valores también en el entorno de lanzamiento de ambas instancias PM2. El resto de la configuración conserva los valores del paso 7. No se movieron ni abrieron documentos subidos; el fallback histórico `uploads` conserva su destino anterior. Las credenciales y los respaldos de base y `.env` permanecen sólo en producción.

## Smoke y alcance

**39/39 controles finales aprobados**, sólo GET:

- Web, login público, `/app/` y su login público; coincidencia del HTML por hash.
- JS/CSS de entrada, precache, iconos, offline, manifiestos, CSS de exportación; contenido y MIME correctos.
- Ambos service workers, versiones y respuesta sin caché persistente.
- Manual, directorio y una captura; identificación del release.
- Asociación Android disponible, sin certificar Android/APK.
- Asset inexistente de `/app/assets` devuelve 404; `/app` redirige a `/app/`.
- Health, liveness y readiness HTTP 200; conexión de base verificada mediante `SELECT 1`.

Además: **4/4 comprobaciones HTTPS desde la Mac** (web, `/app`, identificación del commit y health), registradas en `external-smoke.json`.

No se inició sesión, consultaron registros de negocio, ejecutaron seeds/importaciones ni enviaron correos/push. El smoke no hizo solicitudes mutantes; los logs y la telemetría ordinaria del servicio siguen su configuración previa. No se ejecutaron suites pesadas en producción ni en la Mac. Esto no certifica funciones por rol en producción, correos reales, APK ni Android físico.

## Incidencias de verificación y rollback

Hubo dos intentos con rollback automático, sin cambios de producto:

1. El verificador clasificaba un favicon SVG del precache como JavaScript. Se corrigió el MIME esperado, conservando la exigencia de hash exacto.
2. Readiness exige más de diez segundos de uptime. La primera instancia ya estaba lista, pero la segunda tenía unos nueve segundos al llegar el smoke público. Se agregó una espera después de completar el reload de ambas instancias; no se alteró el endpoint ni su expectativa.

Ambos intentos restauraron los enlaces anteriores y el servicio. El tercer intento terminó con 39/39 controles aprobados. Las evidencias completas están en `deployment-attempt1.json`, `deployment-attempt2.json` y `deployment.json`.

Se conservaron los releases anteriores para rollback:

- Backend: `/var/www/sitrep-backend-releases/20261012-training-r1`.
- Web: `/var/www/sitrep-releases/20261013-attention-r1`.

Durante el paso 8 no se depuraron releases, archivos históricos, contenedores ni imágenes. La limpieza posterior autorizada del preview figura al final. Un rollback futuro debe restaurar esos enlaces exactos y recargar sólo `sitrep-backend`, manteniendo los flags aprobados. No implica revertir el esquema ni restaurar automáticamente el backup.

## Evidencia

Carpeta local: `test-results-deploy-1ab057a/`. Auditoría remota: `/var/backups/sitrep/20261018-step8-1ab057a/`.

Paquetes:

| Artefacto | SHA-256 |
| --- | --- |
| Backend | `1f3ccb81248276a67b16fe5d742576889d5cf807b9037cd776dd98829bfa5fd0` |
| Web | `2812d34ba1d3dc75fb235bd60fcc94c9a51d46292812d6f9655f717c7f16a587` |
| App | `539b8d6bd7c5a31a543e896bf5020adb3484f865a7b52652c2e5f3bdcb02a764` |
| Fuente manual/capturas | `092bcd67a401a7e6ebd8ab5258b6d75ffc18234da64bd9934dfcc41708696644` |

Build y hashes: `build-backend.json`, `backend-sha256.json`; preparación: `stage.json`, `prisma-generate.log`, `migration-status.log`; activación y smoke: `deployment.json`; verificación posterior: `final-state.json`.


## Cierre documental y limpieza posterior

El 18/10, a las 08:09:39 de Mendoza, se retiraron únicamente el contenedor gemelo `sitrep-qa-live-20261017` y la imagen `sitrep-qa-enterprise-20261016:live-20261017` del servidor de preview `76.13.234.213`. Primero se cerraron sus procesos de QA y se detuvo el contenedor; luego se eliminó sin borrar volúmenes y se retiró la imagen con `--no-prune`, sin force.

Se comprobó la ausencia del contenedor y del ID de imagen; los otros 74 contenedores conservaron identidad, imagen y estado. Se conservaron todas las demás imágenes, redes y volúmenes, incluido el original `sitrep-qa-enterprise-20261016`, detenido. Fuente y artefactos montados en `/opt/sitrep-qa-enterprise-20261016/source` permanecen; la capa efímera del gemelo fue retirada con él. El antiguo acceso por túnel al gemelo dejó de estar disponible. No se recreó ni reinició otro entorno.

Evidencia local: `test-results-close-20261018/preview-cleanup.json`. Este cierre documental y la limpieza **no contactaron producción**. Los datos productivos de este informe provienen de la evidencia del despliegue y de `final-state.json` (última verificación: 08:03:04 de Mendoza; ambas instancias online con 111–112 segundos de uptime y sin reinicios imprevistos).

Punto de entrada para continuar: [TRASPASO-CODEX-20261017.md](TRASPASO-CODEX-20261017.md). No ejecutar automáticamente rollback, migraciones, seeds, nuevos despliegues ni reactivar funcionalidades a partir de este cierre.
