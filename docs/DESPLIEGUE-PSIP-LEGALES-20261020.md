# PSIP Legales y comprobantes ATM publicado — 20/10/2026

**Backend, web, `/app` y manual publicados desde `2200e9555e8e97d394c342f9ef519604ed1f365a`** en `sitrep.ultimamilla.com.ar`, el **20/10/2026 a las 14:32:13 Mendoza** (`17:32:13.499Z`). Autorización explícita del dueño para ese commit, manteniendo CAP cerrado, correos/push apagados y flags actuales; sin `main`, datos reales ni workflows. Smoke final no mutante aprobado.

Incluye [seguimiento de Legales, responsables, separación entre actuaciones internas y resultado público, y revisión del comprobante ATM](PSIP-LEGALES-ATM-20261020.md). Conserva permisos y transiciones. Los estados ATM históricos no se presentan como una nueva derivación ni como control del pago del alta. **Sigue pendiente impedir la reutilización de un mismo pago mediante otra foto del ticket y conciliar la fórmula TEF con la autoridad**; no se publica una integración ATM ni una fórmula fiscal nueva.

## Releases y configuración

| Componente | Release activo |
| --- | --- |
| Backend | `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261020-psip-legales-2200e955` |
| Web, app y manual | `/var/www/sitrep` → `/var/www/sitrep-releases/20261020-psip-legales-2200e955` |
| Identificación pública | `/release.json`: `source`, `backendSource` y `manualSource` iguales al SHA autorizado |

Manual **2026.20.15**, con CSS, renderer y diseño conservados por hash. Exclusivamente fuentes registradas en el commit autorizado. SW raíz **v134**, app **20261020172055**. La fuente raíz del commit conserva v127: la versión de caché se actualizó en el artefacto y su transformación queda registrada por hash en `build.json`. La activación de la actualización continúa siendo explícita. Assets previos preservados para sesiones abiertas.

El `.env` se copió byte por byte, modo 0600; SHA-256 anterior/nuevo **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Se verificó en archivo, ambos workers y estado PM2 guardado:

- `UPLOADS_DIR=/var/lib/sitrep-uploads` y enlace histórico `uploads` conservados, sin abrir ni mover documentos.
- CAP cerrado: `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`. Sin logins ni reapertura de accesos.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y contraseña SMTP ausente. Sin correos ni push.
- Enterprise, eventual, adendas, revisión de partes y multirrol siguen false. Relevos y GPS múltiple siguen true en backend/Vite; demo false. Sin flags nuevos.

Sólo se recargó `sitrep-backend`. Los dos workers quedaron online, PID **561812 / 561827**, un reinicio previsto por worker. La comprobación posterior de las **14:33:01 Mendoza** conservó PID y contadores. Otras aplicaciones PM2 y configuración Nginx intactas; PM2 guardado con los mismos flags e identidades.

## Build, esquema y respaldo

Compilación nueva sobre el SHA autorizado en el preview aislado, fases seriales, **1 CPU, 2 GiB, swap cero**. **2.215 blobs** verificados antes y después. Backend TypeScript, tipos efectivos frontend, web y app PASS. API incorporada y comprobada en ambos paquetes: **`https://sitrep.ultimamilla.com.ar/api`**; API QA excluida. `memory.events`: max=0, oom=0, oom_kill=0.

**Sin migración, instalación de dependencias, consultas de registros de negocio ni restauración de base.** Esquema y dependencias idénticos al release previo `25b0c30c`. Cliente Prisma generado en preview con esquema canónico SHA-256 **`533612bcdb80daad9dcde06ac66608a11ddc28ae33089feda00d0c5acd00d1fb`**; motor RHEL/OpenSSL y módulos nativos verificados. Se verificaron **230 dependencias runtime** sin modificar las del release anterior.

Auditoría privada **`/var/backups/sitrep/20261020-psip-legales-2200e955/`**, directorio 0700. `.env` y estado PM2 previos respaldados allí con modo 0600, identidad y hashes comprobados antes de activar. Esos archivos secretos permanecen en el servidor; sólo se recuperaron informes filtrados. No se hizo dump de base porque no hay migración ni cambio de datos. Releases anteriores preservados.

Archivos cotejados por SHA-256: **368 backend / 500 web-manual / 197 app / 14 cliente Prisma**, tanto al preparar como antes de activar. Manual empaquetado idéntico al commit; siete chunks críticos comprobados por superficie. Se preparó y verificó el rollback antes de cambiar los enlaces.

## Verificación publicada

| Control | Resultado |
| --- | --- |
| Smoke HTTPS desde el servidor, sólo GET | **78/78** |
| Smoke externo desde la Mac, sólo GET y hashes | **9/9** |
| Assets PWA, tipos MIME, asociación Android y 404 de archivo inexistente | **PASS** |
| Health, live y ready; dos workers y PM2 guardado | **PASS** |
| `.env`, flags, CAP, uploads y Nginx conservados | **PASS** |

Se comprobaron shells web/app, rutas PSIP y transporte, bundles críticos, service workers, precaché, manual y sus capturas. Las rutas API protegidas devolvieron **401 sin token**, antes de acceder a registros. **Cero logins, cero mutaciones de negocio, sin cuentas ni documentos reales.** La asociación Android verifica el archivo publicado, no certifica hardware físico ni entrega externa.

La aceptación funcional previa del mismo producto permanece documentada: backend dirigido **190/190**, frontend **84/84**, Legales **9/9**, comprobantes **15/15**, capturas **3/3**, manual **20/20 + 6/6 navegador**. Durante la publicación se recompiló con la API final y se verificaron artefactos y smoke; no se repitieron suites globales.

## Rollback preparado, sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-psip-legales-2200e955/publish-production.js rollback'
```

Recupera backend **`25b0c30c`** desde `/var/www/sitrep-backend-releases/20261020-psip-plazos-25b0c30c`; web/app y manual previos desde `/var/www/sitrep-releases/20261020-psip-legales-2200e955-rollback`. Esa copia conserva manual **2026.20.14**, assets de ambas versiones, SW raíz **v135** y app **20261020172510** para que la reversión también sea una actualización detectable. Mantiene `.env`, CAP, canales, flags, uploads y custodia por tramos; verifica readiness y guarda PM2.

**No restaura base ni revierte históricos o migraciones.** Se perderían las mejoras de Legales y las aclaraciones de comprobantes de esta publicación. No volver a un backend anterior a custodia por tramos. El rollback quedó verificado en la preparación y no se ejecutó.

## Incidencias y cierre

El primer intento de activación se detuvo en la comparación previa de procesos: PM2 no informa PID para el proceso demo que ya estaba detenido; JSON omite esa propiedad, pero el objeto en memoria conservaba `pid: undefined`. Todavía no se habían cambiado enlaces ni recargado workers. Se preservaron el script y el informe fallido; se normalizó únicamente la ausencia de PID al comparar contra JSON, conservando la comprobación de todos los PID, estados y reinicios existentes. La segunda pasada publicó y verificó el release. Sin cambios al producto, a las expectativas del smoke ni a otras aplicaciones.

La protección local también rechazó una búsqueda de texto que contenía nombres de APIs de eliminación y un editor lanzado mediante Node sin argumento no interactivo. No se ejecutaron esas llamadas. Se usaron lectura simple, edición por parche y `node -e` explícito; archivos, fallos y locks se conservaron.

Contenedor propio `sitrep-qa-training-20261018` detenido el **20/10 a las 14:33:21 Mendoza** (`17:33:21.814Z`): `Running=false`, `Pid=0`, salida 143 por SIGTERM previsto, `OOMKilled=false`. Sólo se levantó para compilar; no se iniciaron API QA, PostgreSQL ni túnel en esta publicación. Imagen, base artificial y evidencia preservadas; límites sin ampliar.

Evidencia local ignorada: `test-results-deploy-2200e955/`. Artefactos del preview: `/opt/sitrep-qa-enterprise-20261016/source/.qa-release-2200e955-20261020/`. Auditoría productiva privada en la carpeta indicada. Cierre documental **`[skip ci]`**, sin push ni workflows. Rama `codex/sitrep-training-20261018`; `main` conserva **`c8402190edfc36b5e5d0dee1337c24bd1689420d`**. El cierre no cambia el producto publicado.
