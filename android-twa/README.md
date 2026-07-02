# Android TWA release - rptrazar.mendoza.gov.ar

Este directorio documenta la configuracion de release para reconstruir la TWA Android de SITREP apuntando al dominio productivo `rptrazar.mendoza.gov.ar`.

## Alternativa elegida 2026-06-30

Como no se recupero la keystore privada original de `ar.com.ultimamilla.sitrep`, se preparo una salida operativa en dos pasos:

1. **PWA web inmediata**: `https://rptrazar.mendoza.gov.ar/app/` queda instalable desde el navegador. El manifest local fue renombrado a `RP Trazar - Residuos Peligrosos` y el service worker fue actualizado a `v27`.
2. **Android package nuevo**: se genero y firmo una TWA nueva con package `ar.gob.mendoza.rptrazar`, version `1.0.0`, apuntando a `https://rptrazar.mendoza.gov.ar/app/`.

Artefactos release generados:

```text
android-twa/build-rptrazar-new/app/build/outputs/apk/release/app-release-signed.apk
android-twa/build-rptrazar-new/app/build/outputs/bundle/release/app-release-signed.aab
```

Fingerprint publico de la firma nueva:

```text
81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE
```

El `assetlinks.json` local ya contiene ambos packages:

- `ar.com.ultimamilla.sitrep` con la firma historica.
- `ar.gob.mendoza.rptrazar` con la firma nueva.

Bloqueo externo pendiente: publicar ese archivo en el host real de `rptrazar.mendoza.gov.ar`. El dominio resuelve a `diclb.mendoza.gov.ar` / `<host-balanceador-gobierno>`; SSH responde, pero rechaza autenticacion para `ubuntu` y `root`, incluso usando la clave documentada `~/.ssh/<clave-autorizada>`.

## Estado actual 2026-06-30

- Package Android esperado: `ar.com.ultimamilla.sitrep`.
- URL inicial TWA: `https://rptrazar.mendoza.gov.ar/app/`.
- Manifest web: `https://rptrazar.mendoza.gov.ar/manifest-app.json`.
- Asset Links publico: `https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json`.
- Proyecto TWA regenerado: `android-twa/build-rptrazar/`.
- Script reproducible: `android-twa/scripts/generate-rptrazar-twa.cjs`.
- Version Android nueva: `versionCode=3`, `versionName=1.0.1`.
- Fingerprint observado en la app instalada durante QA:
  `14:30:25:00:EF:38:5B:21:7B:03:EF:D8:21:18:BB:B4:5C:68:DE:11:93:0F:C8:03:CC:50:0F:02:0E:08:E1:D7`.

El proyecto Android/Gradle ya fue regenerado y compila. Sigue pendiente recuperar la keystore de release compatible con el fingerprint anterior. Sin esa clave privada no se puede producir una actualizacion instalable sobre `ar.com.ultimamilla.sitrep` ya desplegada.

## Evidencia 2026-06-29

- `assetlinks.json` fue publicado en `/var/www/sitrep/.well-known/assetlinks.json`.
- `produccion-seguro` paso completo despues de la publicacion: `reports/test-runs/20260629-181808/summary.md`.
- App instalada en emulador: `versionCode=2`, `versionName=1.0.0`.
- App Links instalados: Android verifica solo `sitrep.ultimamilla.com.ar`; la app instalada no declara `rptrazar.mendoza.gov.ar`.
- APK local encontrado: `/Users/santosma/Downloads/sitrep-android-v1.0.0-2.apk`; tambien contiene `https://sitrep.ultimamilla.com.ar/app/`, por lo que reinstalarlo no corrige el dominio.
- Evidencia visual: `/tmp/sitrep-twa-old-domain-ui.png`.
- Certificado del APK viejo:
  - DN: `CN=Ultima Milla SITREP, OU=Engineering, O=Ultima Milla, C=AR`
  - SHA-256: `14302500ef385b217b03efd82118bbb45c68de11930fc803cc500f020e08e1d7`

## Evidencia 2026-06-30

- Busqueda local y remota de keystore/proyecto original:
  - Local: no se encontro `<jks>`, `<keystore>`, `keystore.properties`, proyecto Gradle ni Bubblewrap original compatible. Solo existe `~/.android/debug<keystore>`, no valida para release.
  - Google Drive/conector: sin resultados para `sitrep keystore`, `<jks>`, `<keystore>`, `keystore`, `upload`, `release` ni `SITREP Android` asociados a una clave.
  - Servidor accesible por `ubuntu@<ip-interna-gobierno>`: sin artefactos Android en `/home/ubuntu`, `/var/www`, `/opt`, `/srv`, `/tmp`.
  - Servidor `root@23.105.176.45`: sin artefactos Android en rutas buscadas.
- Proyecto TWA regenerado en `android-twa/build-rptrazar/` con Bubblewrap 1.24.1.
- `assembleDebug`: PASS. APK debug generado en `android-twa/build-rptrazar/app/build/outputs/apk/debug/app-debug.apk`.
- `assembleRelease`: PASS. APK release unsigned generado en `android-twa/build-rptrazar/app/build/outputs/apk/release/app-release-unsigned.apk`.
- `bundleRelease`: PASS. AAB release unsigned generado en `android-twa/build-rptrazar/app/build/outputs/bundle/release/app-release.aab`.
- `apksigner verify` sobre release unsigned: falla esperado con `DOES NOT VERIFY`, porque no esta firmado.
- `jarsigner -verify` sobre AAB release: falla esperado con `jar is unsigned`.
- `aapt` sobre el APK release confirma:
  - `package='ar.com.ultimamilla.sitrep'`
  - `versionCode='3'`
  - `versionName='1.0.1'`
  - `hostName='rptrazar.mendoza.gov.ar'`
  - `launchUrl='https://rptrazar.mendoza.gov.ar/app/'`
  - `webManifestUrl='https://rptrazar.mendoza.gov.ar/manifest-app.json'`
  - `assetStatements` apunta a `https://rptrazar.mendoza.gov.ar`.
- Re-verificacion ADB 2026-06-30 sin instalar update:
  - `adb shell pm get-app-links ar.com.ultimamilla.sitrep` sigue mostrando solo `sitrep.ultimamilla.com.ar: verified`.
  - `adb shell monkey -p ar.com.ultimamilla.sitrep -c android.intent.category.LAUNCHER 1` fallo en el emulador headless con codigo 251 por `SYS_KEYS`.
  - Lanzamiento alternativo con `adb shell am start -n ar.com.ultimamilla.sitrep/.LauncherActivity`: OK.
  - UI dump de Chrome/TWA muestra URL activa `sitrep.ultimamilla.com.ar`.
  - Evidencia visual: `/tmp/rptrazar-twa-current-state.png`.

## Regeneracion reproducible

El DNS de Node/Bubblewrap no resolvio `rptrazar.mendoza.gov.ar` en esta maquina aunque `curl`/`dig` si lo hicieron. Por eso se dejo un generador reproducible que usa Bubblewrap local y descarga manifest/iconos con `curl --resolve`.

```bash
JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
node android-twa/scripts/generate-rptrazar-twa.cjs
```

Si cambia la IP publicada por DNS interno, sobreescribirla asi:

```bash
RPTRAZAR_RESOLVE_IP='<host-balanceador-gobierno>' \
JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
node android-twa/scripts/generate-rptrazar-twa.cjs
```

## Build local validado

```bash
cd android-twa/build-rptrazar

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
ANDROID_HOME=/Users/santosma/.bubblewrap/android_sdk \
GRADLE_USER_HOME=/Users/santosma/peliresi/android-twa/.gradle \
./gradlew assembleDebug

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
ANDROID_HOME=/Users/santosma/.bubblewrap/android_sdk \
GRADLE_USER_HOME=/Users/santosma/peliresi/android-twa/.gradle \
./gradlew assembleRelease

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
ANDROID_HOME=/Users/santosma/.bubblewrap/android_sdk \
GRADLE_USER_HOME=/Users/santosma/peliresi/android-twa/.gradle \
./gradlew bundleRelease
```

## Firma release pendiente

La configuracion espera la keystore en:

```text
android-twa/secrets/<release-keystore>
```

Alias inferido por el APK anterior: `SITREP`. Se puede sobreescribir al regenerar:

```bash
SITREP_TWA_KEY_ALIAS='SITREP' node android-twa/scripts/generate-rptrazar-twa.cjs
```

Antes de firmar, validar que la keystore recuperada emite el fingerprint requerido:

```bash
keytool -list -v \
  -keystore android-twa/secrets/<release-keystore> \
  -alias SITREP
```

Debe coincidir con:

```text
14:30:25:00:EF:38:5B:21:7B:03:EF:D8:21:18:BB:B4:5C:68:DE:11:93:0F:C8:03:CC:50:0F:02:0E:08:E1:D7
```

Firma APK cuando la keystore exista:

```bash
cd android-twa/build-rptrazar

/Users/santosma/.bubblewrap/android_sdk/build-tools/35.0.0/zipalign \
  -p -f 4 \
  app/build/outputs/apk/release/app-release-unsigned.apk \
  app/build/outputs/apk/release/app-release-aligned.apk

SITREP_TWA_KEYSTORE_PASSWORD='REEMPLAZAR' \
/Users/santosma/.bubblewrap/android_sdk/build-tools/35.0.0/apksigner sign \
  --ks ../secrets/sitrep-release<keystore> \
  --ks-key-alias SITREP \
  --ks-pass env:SITREP_TWA_KEYSTORE_PASSWORD \
  --out app/build/outputs/apk/release/app-release-signed.apk \
  app/build/outputs/apk/release/app-release-aligned.apk

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
/Users/santosma/.bubblewrap/android_sdk/build-tools/35.0.0/apksigner verify \
  --print-certs \
  app/build/outputs/apk/release/app-release-signed.apk
```

## Verificacion post-release

Despues de firmar e instalar la build release real:

```bash
adb shell pm get-app-links ar.com.ultimamilla.sitrep
adb shell monkey -p ar.com.ultimamilla.sitrep -c android.intent.category.LAUNCHER 1
adb shell dumpsys activity top | grep -E 'rptrazar|sitrep'
```

La app debe abrir `https://rptrazar.mendoza.gov.ar/app/` sin barra de Custom Tab. Si Android muestra estado no verificado, confirmar que el fingerprint de la keystore de release coincide con `frontend/public/.well-known/assetlinks.json`.

No instalar `app-debug.apk` sobre la app productiva: usa debug key y Android rechazara la actualizacion por firma distinta; si se fuerza con uninstall/reinstall, ya no valida el flujo real de produccion.

## Package nuevo `ar.gob.mendoza.rptrazar`

Crear keystore nueva, generar proyecto, compilar y firmar:

```bash
node android-twa/scripts/create-rptrazar-release-keystore.cjs

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
node android-twa/scripts/generate-rptrazar-new-twa.cjs

cd android-twa/build-rptrazar-new

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
ANDROID_HOME=/Users/santosma/.bubblewrap/android_sdk \
GRADLE_USER_HOME=/Users/santosma/peliresi/android-twa/.gradle \
./gradlew assembleRelease bundleRelease

cd /Users/santosma/peliresi

JAVA_HOME=/Users/santosma/.bubblewrap/jdk/jdk-17.0.11+9/Contents/Home \
ANDROID_HOME=/Users/santosma/.bubblewrap/android_sdk \
node android-twa/scripts/sign-rptrazar-new-release.cjs
```

Validacion ADB ejecutada el 2026-06-30:

```bash
adb install -r android-twa/build-rptrazar-new/app/build/outputs/apk/release/app-release-signed.apk
adb shell pm get-app-links ar.gob.mendoza.rptrazar
adb shell monkey -p ar.gob.mendoza.rptrazar -c android.intent.category.LAUNCHER 1
adb shell am start -n ar.gob.mendoza.rptrazar/.LauncherActivity
```

Resultado:

- Instalacion APK: PASS.
- Package instalado: `ar.gob.mendoza.rptrazar`.
- Activity launcher: `ar.gob.mendoza.rptrazar/.LauncherActivity`.
- Firma reportada por Android: `81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE`.
- App Links: `rptrazar.mendoza.gov.ar: 1024`, no verificado aun porque el `assetlinks.json` publico sigue sirviendo solo el package viejo.
- Launch explicito por `am start`: PASS.
- `monkey`: fallo con codigo 251 por `SYS_KEYS`, limitacion del emulador headless ya observada tambien con el package viejo.
- UI abierta: Chrome Custom Tab con URL `rptrazar.mendoza.gov.ar`, esperado mientras el dominio no este verificado. Evidencia: `/tmp/rptrazar-new-twa-unverified.png`.
