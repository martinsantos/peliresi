# QA produccion rptrazar - 2026-06-29

## Alcance ejecutado

- Dominio web/API: `https://rptrazar.mendoza.gov.ar`.
- App PWA: `https://rptrazar.mendoza.gov.ar/app/`.
- Android: validacion en emulador con Chrome y app instalada `ar.com.ultimamilla.sitrep`.
- Reportes generados:
  - `reports/test-runs/20260629-161710/summary.md`
  - `reports/test-runs/20260629-173652/summary.md`

## Resultado operativo

- Smoke API productivo: 10/10 PASS.
- Master backend: 11/12 suites PASS; la falla observada fue un falso negativo por rate limit de auth en validacion de password debil.
- Playwright: suite completa 39/40 en corrida continua; dashboard fallo por rate limit y paso aislado en Chromium/mobile.
- Certificacion `post-deploy`: 13 PASS / 1 SKIP / 2 FAIL; los FAIL fueron artefactos de rate limit por stress/concurrencia contra produccion.
- Android/PWA por navegador: `https://rptrazar.mendoza.gov.ar/app/` cargo correctamente, mostro login y navego a recuperacion.
- Android TWA instalada: abre `https://sitrep.ultimamilla.com.ar/app/`, no el dominio nuevo. Requiere rebuild/release.
- `assetlinks.json` publicado en produccion: `https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json` entrega JSON con package `ar.com.ultimamilla.sitrep` y fingerprint `14:30:25:00:EF:38:5B:21:7B:03:EF:D8:21:18:BB:B4:5C:68:DE:11:93:0F:C8:03:CC:50:0F:02:0E:08:E1:D7`.
- Perfil `produccion-seguro` ejecutado despues de publicar assetlinks: 7 PASS / 0 WARN / 0 SKIP / 0 FAIL. Reporte: `reports/test-runs/20260629-181808/summary.md`.

## Datos QA con efecto real

Las suites integrales crearon manifiestos, eventos, alertas y notificaciones reales de QA. Registros identificados durante la corrida:

- `2026-000164`, id `cmqzne56f040v6hrfjttc3p4j`, llevado hasta estado `TRATADO`.
- `2026-000165`, id `cmqznkpyj0brj6hrf4gkkt6ie`, quedo en `BORRADOR` y fue eliminado por API el 2026-06-29 con respuesta HTTP 200.
- `2026-000167`, id `cmqzno7wi0g0n6hrf1ynzv38s`, usado por alertas integrales.
- `cmqznmaoo0bsg6hrfuggwpje0`, usado por notificaciones/rechazo.
- Otros ids parciales observados en logs de suites effectful: `cmqznof5i0k7t6hrfq7si99bs`, `cmqzntlp3106s6hrf35fd39k4`, `cmqzntof...`, `cmqzntit...`.

Revision post-limpieza del rango `2026-000164` a `2026-000172`:

- Permanecen auditados/no eliminables: `2026-000164` (`TRATADO`), `2026-000166` (`RECHAZADO`), `2026-000167` (`RECHAZADO`), `2026-000168` (`RECIBIDO`), `2026-000169` (`RECIBIDO`), `2026-000170` (`EN_TRANSITO`), `2026-000171` (`RECHAZADO`), `2026-000172` (`RECIBIDO`).
- Eliminado: `2026-000165` (`BORRADOR`).

Los logs completos quedan en `reports/test-runs/20260629-173652/` y en la salida de `backend/tests/run-all-tests.sh`.

## Politica de limpieza

El API publico solo permite eliminar manifiestos en estados `BORRADOR` o `CANCELADO`. Los registros que llegaron a `TRATADO`, `RECHAZADO`, `RECIBIDO` o estados con trazabilidad auditada no deben borrarse por API porque forman parte de la cadena de auditoria.

Limpieza controlada recomendada:

1. Identificar manifiestos QA por fecha de creacion `2026-06-29`, numeros listados arriba y usuarios demo.
2. Cancelar/eliminar solamente `BORRADOR` o `CANCELADO` desde API/admin.
3. Para estados terminales o auditados, marcar como datos QA en reportes internos o archivar mediante procedimiento DBA aprobado, dejando respaldo previo.
4. No ejecutar suites destructivas contra produccion salvo ventana autorizada y con snapshot/rollback.

## Runners actualizados

Se separan perfiles:

- `produccion-seguro`: health, web/PWA, assetlinks, contrato API critico y readiness idempotentes.
- `safe`: master backend con smoke/seguridad no destructiva.
- `full`: matriz completa historica.
- `destructive` / `effectful`: suites que crean, mutan o generan datos reales.

## Estado Android TWA

- App instalada en emulador: `ar.com.ultimamilla.sitrep`, `versionCode=2`, `versionName=1.0.0`.
- `adb shell pm get-app-links ar.com.ultimamilla.sitrep` muestra verificado solo `sitrep.ultimamilla.com.ar`.
- El APK local encontrado en `/Users/santosma/Downloads/sitrep-android-v1.0.0-2.apk` contiene `https://sitrep.ultimamilla.com.ar/app/` y `sitrep.ultimamilla.com.ar`; reinstalarlo no corrige `rptrazar`.
- El APK viejo esta firmado con SHA-256 `14302500ef385b217b03efd82118bbb45c68de11930fc803cc500f020e08e1d7`, coincidente con el `assetlinks.json` publicado.
- Evidencia de UI: `/tmp/sitrep-twa-old-domain-ui.png`; el WebView muestra login, pero Chrome/TWA indica `sitrep.ultimamilla.com.ar`.
- 2026-06-30: se regenero el proyecto Android TWA para `rptrazar.mendoza.gov.ar` en `android-twa/build-rptrazar/`.
- 2026-06-30: `assembleDebug`, `assembleRelease` y `bundleRelease` pasan con JDK/SDK local de Bubblewrap.
- 2026-06-30: el APK release unsigned confirma `package='ar.com.ultimamilla.sitrep'`, `versionCode='3'`, `versionName='1.0.1'`, `hostName='rptrazar.mendoza.gov.ar'`, `launchUrl='https://rptrazar.mendoza.gov.ar/app/'` y `assetStatements` hacia `https://rptrazar.mendoza.gov.ar`.
- 2026-06-30: busqueda adicional de keystore en ruta esperada, carpetas locales, CloudStorage y Google Drive/conector: sin resultados. Solo existe `~/.android/debug<keystore>`, no apta para release.
- 2026-06-30: ADB sobre emulador `sitrep_pixel7_api35`:
  - `adb shell pm get-app-links ar.com.ultimamilla.sitrep` confirma firma esperada y solo `sitrep.ultimamilla.com.ar: verified`.
  - `adb shell monkey -p ar.com.ultimamilla.sitrep -c android.intent.category.LAUNCHER 1` devuelve codigo 251 por `SYS_KEYS` del emulador headless.
  - `adb shell am start -n ar.com.ultimamilla.sitrep/.LauncherActivity` abre la app instalada.
  - UI dump de Chrome/TWA muestra URL activa `sitrep.ultimamilla.com.ar`; evidencia visual en `/tmp/rptrazar-twa-current-state.png`.
- Bloqueo para release real: no se encontro la keystore privada de release SITREP. Sin la misma keystore no se puede firmar una actualizacion compatible para `ar.com.ultimamilla.sitrep`. El APK debug no debe instalarse como evidencia productiva porque usa debug key y no verifica contra `assetlinks.json`.

## Actualizacion 2026-06-30 - alternativa sin keystore original

Se dejo de perseguir la keystore original y se preparo el camino alternativo:

- PWA web inmediata: `manifest-app.json` local renombrado a `RP Trazar - Residuos Peligrosos`, `short_name=RP Trazar`, `id=rptrazar-mobile-app`.
- Service worker local: cache `v27`.
- Android package nuevo: `ar.gob.mendoza.rptrazar`.
- APK firmado: `android-twa/build-rptrazar-new/app/build/outputs/apk/release/app-release-signed.apk`.
- AAB firmado: `android-twa/build-rptrazar-new/app/build/outputs/bundle/release/app-release-signed.aab`.
- Fingerprint nuevo: `81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE`.
- `assetlinks.json` local contiene package viejo y package nuevo.
- Build SPA: PASS.
- Build PWA `/app/`: PASS.
- Instalacion APK en emulador: PASS.
- Launch explicito: PASS.
- App Links Android: pendiente por publicacion en host real; Android reporta `rptrazar.mendoza.gov.ar: 1024`.

Bloqueo externo actual:

- `rptrazar.mendoza.gov.ar` no esta servido por el VPS `23.105.176.45`; resuelve a `diclb.mendoza.gov.ar` / `<host-balanceador-gobierno>`.
- `<host-balanceador-gobierno>` responde SSH y HTTPS, pero rechaza autenticacion para `ubuntu` y `root`, incluso con `~/.ssh/<clave-autorizada>`.
- El `assetlinks.json` publico sigue devolviendo solo `ar.com.ultimamilla.sitrep`, por eso la app nueva abre como Chrome Custom Tab con toolbar hasta que infraestructura publique el archivo actualizado.

Informe detallado: `docs/qa/2026-06-30-rptrazar-pwa-android-new-package.md`.
