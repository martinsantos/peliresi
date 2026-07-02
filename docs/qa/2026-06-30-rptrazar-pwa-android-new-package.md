# Rptrazar PWA y Android package nuevo - 2026-06-30

## Decision ejecutada

No se siguio con recuperacion de keystore original. La alternativa elegida fue:

1. PWA web inmediata para `https://rptrazar.mendoza.gov.ar/app/`.
2. Nueva app Android con package `ar.gob.mendoza.rptrazar` y firma nueva.

## PWA web

- `https://rptrazar.mendoza.gov.ar/app/`: HTTP 200.
- `https://rptrazar.mendoza.gov.ar/manifest-app.json`: manifest valido.
- Manifest local actualizado:
  - `name`: `RP Trazar - Residuos Peligrosos`
  - `short_name`: `RP Trazar`
  - `id`: `rptrazar-mobile-app`
- Service worker local actualizado a cache `v27`.
- Build frontend: PASS.
- Build PWA `/app/`: PASS.

Pendiente PWA: publicar `frontend/dist`, `frontend/dist-app`, `frontend/public/manifest-app.json` y `frontend/public/sw.js` en el host real de `rptrazar.mendoza.gov.ar`.

## Android TWA nueva

- Package: `ar.gob.mendoza.rptrazar`.
- Nombre: `RP Trazar - Residuos Peligrosos`.
- Launcher: `RP Trazar`.
- Version: `versionCode=1`, `versionName=1.0.0`.
- URL inicial: `https://rptrazar.mendoza.gov.ar/app/`.
- Fingerprint publico:

```text
81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE
```

Artefactos generados:

```text
android-twa/build-rptrazar-new/app/build/outputs/apk/release/app-release-signed.apk
android-twa/build-rptrazar-new/app/build/outputs/bundle/release/app-release-signed.aab
```

Validaciones locales:

- Keystore nueva creada en `android-twa/secrets/<release-keystore>`.
- Password guardada en `android-twa/secrets/rptrazar-release.env` con permisos `600`.
- `assembleRelease`: PASS.
- `bundleRelease`: PASS.
- Firma APK con `apksigner`: PASS.
- Firma AAB con `jarsigner`: PASS.
- `aapt dump badging`: confirma package, version, permisos de notificaciones y ubicacion, label y launcher.

## Asset Links

Archivo local actualizado:

```text
frontend/public/.well-known/assetlinks.json
```

Contiene:

- `ar.com.ultimamilla.sitrep` con SHA-256 historico.
- `ar.gob.mendoza.rptrazar` con SHA-256 nuevo.

Publicacion parcial:

- Se publico correctamente en el VPS `23.105.176.45` bajo `/var/www/sitrep/.well-known/assetlinks.json`.
- Pero `https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json` sigue devolviendo el archivo viejo de 1 solo package.
- DNS real: `rptrazar.mendoza.gov.ar` -> `diclb.mendoza.gov.ar` -> `<host-balanceador-gobierno>`.
- `<host-balanceador-gobierno>:22` y `:443` responden.
- SSH a `ubuntu@<host-balanceador-gobierno>`, `root@<host-balanceador-gobierno>` y `ubuntu@rptrazar.mendoza.gov.ar` rechaza autenticacion.
- La clave documentada `~/.ssh/<clave-autorizada>` tambien fue rechazada.

## QA Android

Emulador: `sitrep_pixel7_api35`.

Comandos ejecutados:

```bash
adb install -r android-twa/build-rptrazar-new/app/build/outputs/apk/release/app-release-signed.apk
adb shell pm get-app-links ar.gob.mendoza.rptrazar
adb shell pm verify-app-links --re-verify ar.gob.mendoza.rptrazar
adb shell monkey -p ar.gob.mendoza.rptrazar -c android.intent.category.LAUNCHER 1
adb shell am start -n ar.gob.mendoza.rptrazar/.LauncherActivity
```

Resultado:

- Instalacion: PASS.
- Package instalado: PASS.
- Activity launcher resuelve: PASS.
- Launch explicito con `am start`: PASS.
- Proceso activo: PASS.
- UI abre `rptrazar.mendoza.gov.ar`: PASS.
- `monkey`: FAIL tecnico del emulador headless con `SYS_KEYS`, ya observado en el package viejo.
- App Links: pendiente. Android reporta `rptrazar.mendoza.gov.ar: 1024` y la UI muestra Chrome Custom Tab, no TWA trusted fullscreen, porque el dominio publico todavia no sirve el fingerprint nuevo.

Evidencia:

```text
/tmp/rptrazar-new-twa-unverified.png
```

## Pendiente exacto

1. Obtener acceso al host real `<host-balanceador-gobierno>` o pedir a infraestructura que publique `frontend/public/.well-known/assetlinks.json` en `/var/www/sitrep/.well-known/assetlinks.json` del servidor real.
2. Publicar los assets PWA actualizados (`manifest-app.json`, `sw.js`, `dist`, `dist-app`) en el mismo host real.
3. Repetir:

```bash
curl -sS https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json
adb shell pm verify-app-links --re-verify ar.gob.mendoza.rptrazar
adb shell pm get-app-links ar.gob.mendoza.rptrazar
adb shell am start -n ar.gob.mendoza.rptrazar/.LauncherActivity
```

4. Esperado despues de publicar assetlinks: Android debe dejar de mostrar toolbar de Chrome y abrir como Trusted Web Activity verificada.
