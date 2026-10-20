# PSIP plazos y responsables publicado — 20/10/2026

**Backend, web, `/app` y manual publicados desde `25b0c30c860cc91091591ad51b9b2ab9dc72a0cf`** en `sitrep.ultimamilla.com.ar`, el **20/10/2026 a las 12:57:42 Mendoza** (`15:57:42.390Z`). Autorización explícita del dueño para ese commit, preservando CAP cerrado, correos/push apagados y flags actuales; sin `main`, datos reales ni workflows, con smoke no mutante.

Incluye [plazo propio de cada requerimiento, responsables y pendientes parciales](PSIP-PLAZOS-RESPONSABLES-20261020.md), hora de Mendoza independiente del dispositivo, reintento idempotente después del vencimiento y corrección de lectura móvil. No modifica estados, facultades, permisos, cómputos regulatorios ni históricos. Leer o responder no implica subsanación aceptada.

## Releases y configuración conservada

| Componente | Release activo |
| --- | --- |
| Backend | `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261020-psip-plazos-25b0c30c` |
| Web, app y manual | `/var/www/sitrep` → `/var/www/sitrep-releases/20261020-psip-plazos-25b0c30c` |
| Identificación pública | `/release.json`: `source`, `backendSource` y `manualSource` iguales al SHA autorizado |

Manual **2026.20.14**, CSS y renderer idénticos por hash a la publicación anterior. Se empaquetaron exclusivamente archivos registrados en el commit autorizado. SW raíz **v132**, app **20261020155342**. La fuente raíz conserva v127 dentro del commit: se versionó la caché del artefacto y se registró el cambio por hash en `build.json`. La activación continúa siendo explícita desde el aviso de nueva versión. Los assets anteriores se conservaron para sesiones abiertas.

El `.env` se copió **byte por byte**, modo 0600; SHA-256 anterior/nuevo **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Verificado en archivo, dos workers activos y estado PM2 guardado:

- `UPLOADS_DIR=/var/lib/sitrep-uploads`, sin abrir ni mover documentos; enlace histórico de compatibilidad `uploads` conservado.
- CAP cerrado: `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`. Sin logins ni reapertura de accesos.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y contraseña SMTP ausente. Sin envíos de correo ni push.
- Relevos y GPS múltiple conservan true, también en Vite. Enterprise, eventual, adendas, revisión de partes y multirrol conservan false; `VITE_DEMO_MODE=false`. Sin flags nuevos.

Sólo se recargaron los dos workers `sitrep-backend`, ambos online en el release nuevo. El control final de las **12:58:19 Mendoza** conservó sus PID y reinicios después de la activación. Nginx y las demás aplicaciones PM2 se conservaron.

## Compilación, esquema y respaldo

Compilación nueva desde el SHA autorizado en el preview aislado, serial, **1 CPU, 2 GiB, swap cero**, con `UV_THREADPOOL_SIZE=1`. **2.207 blobs** verificados antes/después. API incorporada y comprobada en ambos paquetes: **`https://sitrep.ultimamilla.com.ar/api`**. TypeScript backend/frontend y ambos builds PASS; `memory.events`: `max=0`, `oom=0`, `oom_kill=0`.

**Sin migraciones, instalación de dependencias, restauración de base ni consultas de registros de negocio.** Esquema y manifiestos de dependencias idénticos al backend anterior `527d915c`. Cliente Prisma generado/verificado en preview, mismo esquema canónico SHA-256 **`533612bcdb80daad9dcde06ac66608a11ddc28ae33089feda00d0c5acd00d1fb`**; motor RHEL/OpenSSL y módulos nativos comprobados. Se verificaron **230 dependencias runtime** sin modificar las del release anterior.

Archivos verificados por SHA-256 en preparación/activación: **368 backend**, **500 web/manual**, **197 app** y **14 cliente Prisma**. La preparación conservó sin cambios los releases activos anteriores y comprobó el rollback antes de activar.

Auditoría privada root: **`/var/backups/sitrep/20261020-psip-plazos-25b0c30c/`**. Incluye respaldo verificado del `.env` y PM2, modo 0600, inventarios, paquetes, scripts y reportes filtrados. No se hizo dump de base: no hay migración ni modificación de registros. No se copiaron credenciales, base o dump privado de PM2 a la Mac o al preview.

## Smoke no mutante

| Comprobación | Resultado |
| --- | --- |
| HTTP público desde servidor, sólo GET | **78/78** |
| HTTPS externo desde Mac, sin sesión | **9/9** |
| Controles PWA de assets, MIME, asociación y 404 | **PASS** |
| Readiness, dos workers estables, `.env`, PM2 guardado, CAP y flags | **PASS** |
| Manual, guía PSIP, capturas y paquetes publicados | Hashes iguales a los artefactos verificados |

El smoke comprueba shells web/app, rutas de inspecciones/participación/avisos, JS/CSS y chunks PSIP, incluido el nuevo resumen compartido de seguimiento en ambas superficies, ambos SW y precache, manual versionado, capturas artificiales e identificación de release. Verifica también asociación PWA, 404 de asset ausente y redirección `/app`.

Health/readiness sólo comprueban servicio/conexión. Las API de inspecciones, participación, intercambio, campana y transporte rechazaron sin sesión con **401**, antes de consultar expedientes. Sin POST/PUT/DELETE, logins, ejercicios, GPS, evaluación manual del catálogo ni consultas de registros reales.

Aceptación funcional previa del código: **177/177 backend**, **47/47 frontend**, **12/12 recorridos** entre web/web móvil/app, **20/20 manual** y **6/6 ayuda en navegador**. Durante la publicación se recompiló con la API final y se hizo smoke; no se repitieron suites globales ni se certificaron dispositivos físicos o entrega externa.

Los controles PWA conservan las expectativas del script del repositorio; sólo se cambió su limpieza para preservar las respuestas temporales, luego trasladadas al directorio local de evidencia. No se abrieron cuentas ni la sesión humana del navegador.

## Rollback preparado, sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-psip-plazos-25b0c30c/publish-production.js rollback'
```

Recupera backend **`527d915c`** desde `/var/www/sitrep-backend-releases/20261020-psip-527d915c`; web/app y manual anteriores desde `/var/www/sitrep-releases/20261020-psip-plazos-25b0c30c-rollback`. Esa copia conserva el manual **2026.20.13**, assets de ambas publicaciones, SW raíz **v133** y app **20261020155600**. El script conserva configuración/CAP/canales/uploads, verifica readiness y guarda PM2.

**No restaura base ni revierte actuaciones o migraciones.** El backend anterior ya conserva custodia por tramos y PSIP; se perderían las correcciones de plazos/interfaz de esta publicación. No volver a un backend previo a relevos/GPS múltiple. Rollback verificado en la preparación, **no ejecutado**.

## Incidencias y cierre

La primera preparación local fue detenida por la protección contra APIs de eliminación al redactar la limpieza del script. No se ejecutó esa tanda. Se escribieron cierres que preservan los locks, sin eliminaciones. La preparación productiva terminó correctamente, pero su cierre intentó archivar un lock desde `/var/lock` hacia `/var/backups`, en distintos sistemas de archivos, y devolvió EXDEV. Los enlaces/procesos activos aún no habían cambiado. Se verificó el estado `staged` y la propiedad de ambos locks antes de archivarlos **dentro del mismo `/var/lock`**; se corrigió el cierre y continuó la activación. Metadatos de ambos pasos conservados. No se repitió ni sobrescribió la preparación y no se relajaron sus comprobaciones.

Preview propio detenido el **20/10 a las 12:59:11 Mendoza** (`15:59:11.998Z`): `Running=false`, `Pid=0`, salida 143 por SIGTERM previsto, `OOMKilled=false`. Sólo se inició el contenedor para compilar; no se levantaron servicios QA ni PostgreSQL en esta publicación. Imagen, base artificial y artefactos preservados; sin túnel nuevo.

Evidencia local ignorada: `test-results-deploy-25b0c30c/`. Preview: `.qa-release-25b0c30c-20261020/` en `/opt/sitrep-qa-enterprise-20261016/source`. Auditoría productiva en la carpeta privada indicada. Cierre documental con **`[skip ci]`**, sin push ni workflows. `main` conserva **`c8402190edfc36b5e5d0dee1337c24bd1689420d`**. Producto publicado `25b0c30c`, con el versionado de artefactos declarado arriba.
