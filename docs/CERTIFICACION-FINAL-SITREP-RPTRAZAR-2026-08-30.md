# Certificación final SITREP / RPTRAZAR para capacitación

Fecha de cierre: 30 de agosto de 2026
Alcance: código, migraciones, despliegues, web, PWA, API, autenticación, roles sectoriales, impersonación y workflow, sin modificar credenciales ni enviar correos a usuarios finales.

## Dictamen ejecutivo

| Entorno | Dictamen | Estado |
|---|---|---|
| [SITREP](https://sitrep.ultimamilla.com.ar/) | **APTO para capacitación** | Release validada y operativa |
| [RPTRAZAR](https://rptrazar.mendoza.gov.ar/) | **APTO para capacitación dentro de la VPN** | Release espejada, validada y operativa |

Ambos entornos comparten el mismo backend compilado, los mismos activos principales de web, PWA y manual, y las mismas 15 migraciones Prisma. Las pruebas finales de API, autenticación, permisos, impersonación, navegación web/PWA y auditoría visual terminaron correctamente.

## URLs certificadas

### SITREP

- Web: [https://sitrep.ultimamilla.com.ar/](https://sitrep.ultimamilla.com.ar/)
- PWA: [https://sitrep.ultimamilla.com.ar/app/](https://sitrep.ultimamilla.com.ar/app/)
- Manual: [https://sitrep.ultimamilla.com.ar/manual/](https://sitrep.ultimamilla.com.ar/manual/)
- Salud API: [https://sitrep.ultimamilla.com.ar/api/health](https://sitrep.ultimamilla.com.ar/api/health)

### RPTRAZAR

- Web: [https://rptrazar.mendoza.gov.ar/](https://rptrazar.mendoza.gov.ar/)
- PWA: [https://rptrazar.mendoza.gov.ar/app/](https://rptrazar.mendoza.gov.ar/app/)
- Manual: [https://rptrazar.mendoza.gov.ar/manual/](https://rptrazar.mendoza.gov.ar/manual/)
- Salud API: [https://rptrazar.mendoza.gov.ar/api/health](https://rptrazar.mendoza.gov.ar/api/health)

RPTRAZAR requiere conectividad a la red gubernamental o VPN; esa restricción es de infraestructura y no una diferencia funcional de la aplicación.

## Estado del código local

- Rama: `codex/sitrep-hardening-snapshot-20260729`.
- HEAD: `9ffc7b9e4d5a67900ad5a16ca19f5a0d0ff1b58d`.
- El WIP continúa sin commit, con 240 entradas modificadas o no versionadas al cierre.
- No se descartó, reinició ni sobrescribió trabajo local.
- Prisma contiene 15 migraciones.

## Baseline local

| Componente | Resultado |
|---|---|
| Backend unitario/integración | **305/305 PASS** en 37 archivos |
| Backend build | **PASS** |
| Frontend unitario | **98/98 PASS** en 16 archivos |
| Web build | **PASS** |
| PWA build | **PASS** |

Persisten advertencias no bloqueantes de Browserslist desactualizado y partición de chunks por imports dinámicos.

## Migraciones y respaldos

### SITREP

- Prisma: **15 migraciones, esquema al día**.
- Base respaldada antes de migrar: `/opt/directus-backups/sitrep-pre-migration-20260830-175000.dump`.
- SHA-256 del respaldo: `3f82fe3324f9359bf41b222075a33ad22bac40244661a49d0b12e980832a384f`.
- Configuración respaldada con el mismo prefijo y extensión `.env`.
- Release frontend activa: `/var/www/sitrep-releases/product-20260830-203031-mobile-v28`.
- Rollback frontend: `/var/www/sitrep-releases/product-20260830-184600-sw27`.
- Release backend activa: `/var/www/sitrep-backend-release-candidates/20260830-203031-mobile-v28`.
- Rollback backend: `/var/www/sitrep-backend-release-candidates/20260830-191500-auth-rate-limit-v3`.

### RPTRAZAR

- Prisma: **15 migraciones, esquema al día**.
- Base respaldada: `/data/postgres/backups/rptrazar-pre-release-20260830-182000.dump`.
- SHA-256 del respaldo DB: `010a1ac267ef3c8f79cded1d685f2624c38bceb2fe7b9bc69031c6907d2e4e8d`.
- Archivos respaldados: `/data/backups/rptrazar-files-pre-release-20260830-182000.tar.gz`.
- SHA-256 del respaldo de archivos: `26dbc5e502e6bdff1aba20f95fa110626bc8a6f011755707e88b5ac98879ce4c`.
- Configuración respaldada: `/data/postgres/backups/rptrazar-pre-release-20260830-182000.env`.
- Rollback frontend: `/var/www/sitrep-rollback-20260830-203500-mobile-v28-pre`.
- Rollback backend: `/home/ubuntu/sitrep-backend-rollback-20260830-203500-mobile-v28-pre`.

En Gobierno se corrigió de forma transaccional la propiedad de `entidades_exteriores` y sus enums de `postgres` a `sitrep`; no se modificaron filas funcionales.

## Paridad exacta de las releases

Hash agregado del backend compilado, idéntico en local, SITREP y RPTRAZAR:

`767bbd8dc378e63ccef2160dd1b063bf2d6ffce5623478c90c2232ffcc2fe2e5`

| Activo | SHA-256 idéntico en ambos dominios |
|---|---|
| `index.html` | `a9ed54710f076d5397641f15c8b5bc6141ec3a26c1319c9b5cbaafa659f8adb9` |
| `sw.js` | `b2d99632decbbf107ef7bc44383a23a8005ebd36aec337fd219aac30e69066f8` |
| `app/app.html` | `746ee9bfbf57c8121dc6fec9116c7cdc0f8667229d2c3a1571f7323f4f6ec5de` |
| `app/sw-app.js` | `de9ece7de116c018f30b864050e41e946453f28d3612dacdac8a4f1241734ed0` |
| `manual/index.html` | `a160795707389eb56ba58d4bd7dd0f558ea2ddea8c82737e6523a060c05ecccb` |

## Correcciones incluidas

- Rate limiter de autenticación aislado por cuenta normalizada e IP; los logins exitosos no consumen el presupuesto de fallos y los intentos incorrectos mantienen el límite de cinco por minuto.
- Puerto de SITREP unificado en `3002` para backend, PM2 y Nginx.
- Service worker raíz actualizado a `v28`, con rutas específicas web/PWA, prioridad `URGENTE`, destino same-origin y aviso de renovación de suscripción.
- Activación push explícita mediante gesto del usuario, autoprueba por dispositivo y re-vinculación segura al usuario autenticado actual.
- Wake Lock durante viajes activos y detección visible de señal GPS sin actualización por más de 90 segundos.
- RPTRAZAR publica `Permissions-Policy: geolocation=(self), camera=(self), microphone=()` en paridad con SITREP.
- Activos Leaflet servidos localmente y fuentes externas retiradas del arranque.
- Arnés Playwright fortalecido: página aislada por ruta, diagnóstico explícito de `408`, `5xx` y fallos de red, validación real del `POST` de impersonación.
- Smoke sectorial ajustado al tramo no mutante que corresponde a cada administración.

## Controles operativos

| Control | SITREP | RPTRAZAR |
|---|---|---|
| Backend | PM2, 2 instancias online | systemd activo |
| API/DB | Salud `200`, DB conectada | Salud `200`, DB conectada |
| Puerto backend | `127.0.0.1:3002` | `3002` |
| Migraciones | 15/15 | 15/15 |
| ClamAV | `/usr/bin/clamscan`, modo requerido | `/usr/bin/clamscan`, modo requerido |
| Almacenamiento privado | `/var/lib/sitrep-uploads` | `/var/lib/sitrep/uploads` |
| Correos | `DISABLE_EMAILS=true` | `DISABLE_EMAILS=true` |
| Destinatario permitido | sólo cuenta técnica autorizada | sólo cuenta técnica autorizada |

Los logs revisados no mostraron envíos reales. En Gobierno se confirmó además el mensaje de supresión de envíos con la cola activa. No se exponen credenciales en este documento.

## Pruebas remotas finales

### SITREP

- API, salud, autenticación y paridad posteriores a la release final: **8/8 PASS**.
- Suite crítica de navegador: **7/7 PASS**.
- Smoke de roles/administraciones: **46 PASS**.
- Auditoría visual: **0 incidencias**.

### RPTRAZAR

- API, salud, autenticación y paridad posteriores a la release final: **8/8 PASS**.
- Smoke de roles/administraciones: **46 PASS**.
- Administración sectorial e impersonación: **1/1 PASS**, incluida respuesta `200` del endpoint de impersonación.
- Crawl aislado de web y PWA: **2/2 PASS**, sin `404`, `408`, errores de consola, fallos de red ni `5xx`.
- Auditoría visual aislada: **1/1 PASS**, **0 incidencias** en los viewports examinados.

Una primera corrida combinada en Gobierno cerró procesos de Chrome por presión del runner (`Trying to load allocator multiple times`) y produjo falsos negativos. Al aislar los contextos y liberar cada página, todas las pruebas afectadas pasaron. No se observó una falla equivalente en API, Nginx, backend o base de datos.

## Incidente controlado durante la intervención

El primer candidato del rate limiter en SITREP falló al arrancar por la validación IPv6 de `express-rate-limit`. Al intentar el rollback quedó expuesta una inconsistencia previa: `.env` y Nginx apuntaban al puerto `3010`, mientras el despliegue esperado usaba `3002`. SITREP devolvió `502` durante aproximadamente siete minutos.

Se restauró la release estable, se unificó el puerto en `3002`, se validó `nginx -t` y se recargó Nginx sin reiniciar el VPS. El rate limiter se corrigió, se probó en canary y recién entonces se activó.

Durante el despliegue móvil `v28` en Gobierno, la verificación posterior detectó permisos `0700` heredados del volumen macOS en los archivos estáticos. El trap operacional restauró automáticamente frontend, backend y Nginx; la API quedó saludable con la release anterior. El candidato se corrigió fuera de línea a permisos legibles por `www-data`, se verificaron sus hashes y se reactivó exitosamente. Ambos entornos terminaron saludables y con rollback disponible.

## Límites de esta certificación

- SMTP permanece deliberadamente desactivado; se certificó la supresión, no la entrega real.
- Cámara QR física, GPS físico, permisos nativos y recepción de push con el teléfono en reposo requieren una prueba de dispositivo y no quedan certificados por la suite de escritorio.
- La PWA mitiga la suspensión del GPS manteniendo la pantalla activa cuando el navegador lo permite; una PWA no puede garantizar seguimiento con la pantalla bloqueada porque el sistema operativo puede suspender el navegador.
- RPTRAZAR depende de VPN/red gubernamental y de su DNS interno.
- Los mapas base todavía dependen del proveedor cartográfico configurado cuando se necesita visualizar teselas.

## Criterio de salida

La versión está **apta para la capacitación** en ambos dominios, usando RPTRAZAR dentro de la VPN. Hay evidencia de paridad de release, migraciones completas, salud de API/DB, autenticación, roles sectoriales, impersonación, workflow no mutante, web, PWA y regresión visual. Se mantuvieron las credenciales existentes, los correos a usuarios finales quedaron desactivados y existen respaldos y rutas de rollback verificables.
