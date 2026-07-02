# Publicacion web/app/assetlinks rptrazar - 2026-06-30

## Estado final

Publicado en el servidor Gobierno correcto:

- SSH: `ubuntu@192.168.205.197`.
- Hostname: `sitrepprd1.mendoza.gov.ar`.
- Servicio web: `rptrazar.mendoza.gov.ar`.
- Root Nginx: `/var/www/sitrep`.
- `/app/`: `/var/www/sitrep/app`.

Backup previo:

`/home/ubuntu/sitrep-backups/sitrep-before-rptrazar-20260630-125527.tar.gz`

Artefactos aplicados:

- `/tmp/rptrazar-web-20260630.tar.gz`
- `/tmp/rptrazar-app-20260630.tar.gz`
- `/tmp/rptrazar-well-known-20260630.tar.gz`

Nginx:

```text
nginx -t: PASS
systemctl reload nginx: PASS
```

Validacion desde el servidor con `https://localhost`:

```text
PASS web-title
PASS app-title
PASS manifest-root-id
PASS manifest-app-id
PASS sw-root-v27
PASS assetlinks-package
PASS assetlinks-fingerprint
PASS api-health
```

Validacion del servicio `rptrazar.mendoza.gov.ar` contra `192.168.192.135`:

```text
PASS web-title contains=RP Trazar - Residuos Peligrosos
PASS app-title contains=RP Trazar - App
PASS manifest-root-id contains=rptrazar-mobile-app
PASS manifest-app-id contains=rptrazar-mobile-app
PASS sw-root-v27 contains=trazabilidad-rrpp-v27
PASS assetlinks-new-package contains=ar.gob.mendoza.rptrazar
PASS assetlinks-new-fingerprint contains=81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE
PASS api-health contains="status":"ok"
```

Validacion Android posterior:

```text
adb install -r app-release-signed.apk: PASS
Chrome first-run completado en emulador: PASS
Logs Chrome/TWA:
  TwaLauncher: Launching Trusted Web Activity.
  TWAConnectionPool: Found ar.gob.mendoza.rptrazar.DelegationService to handle request for https://rptrazar.mendoza.gov.ar/app/
Captura visual: TWA fullscreen sin toolbar de Chrome.
```

Evidencia:

`/tmp/rptrazar-twa-after-publish-20260630.png`

## Objetivo

Publicar la web principal, la PWA `/app/` y el `assetlinks.json` actualizado en el host real que sirve:

- `https://rptrazar.mendoza.gov.ar/`
- `https://rptrazar.mendoza.gov.ar/app/`
- `https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json`

Archivos fuente ya preparados en el repositorio:

- `frontend/dist/`
- `frontend/dist-app/`
- `frontend/public/.well-known/assetlinks.json`

El `assetlinks.json` debe quedar disponible con `Content-Type: application/json` y HTTP 200.

## Estado verificado

- Host real HTTPS: `192.168.192.135`.
- Servidor: `nginx/1.28.3 (Ubuntu)`.
- `https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json` sirve el archivo viejo.
- `https://rptrazar.mendoza.gov.ar/` sirve HTML viejo con titulo `SITREP v6 - Nueva Generacion`.
- `https://rptrazar.mendoza.gov.ar/app/` sirve HTML viejo con titulo `SITREP - App`.
- `https://rptrazar.mendoza.gov.ar/manifest-app.json` y `/app/manifest-app.json` mantienen `id=sitrep-mobile-app`.
- El archivo publico actual solo contiene `ar.com.ultimamilla.sitrep`.
- El archivo local correcto contiene:
  - `ar.com.ultimamilla.sitrep`
  - `ar.gob.mendoza.rptrazar`
- SSH probado con `ubuntu@192.168.192.135` y `root@192.168.192.135` usando `~/.ssh/ambiente.pem`: rechazado por autenticacion.
- Publicacion por HTTP no habilitada: `OPTIONS` devuelve 405.

## Intentos de acceso SSH realizados

Datos operativos usados:

- Host Gobierno: `192.168.192.135`.
- Alias documentado: `sitrepprd1`.
- Usuario documentado: `ubuntu`.
- Clave documentada: `~/.ssh/ambiente.pem`.
- Usuarios probados: `ubuntu`, `root`, `deploy`, `sitrep`, `santosma`.
- Claves locales probadas: `ambiente.pem`, `id_rsa`, `id_ed25519`, `cicd-deploy`.

Resultado:

```text
ubuntu@192.168.192.135: Permission denied
root@192.168.192.135: Permission denied
deploy@192.168.192.135: Permission denied / connection closed
sitrep@192.168.192.135: Permission denied / connection closed
santosma@192.168.192.135: Permission denied / connection closed
```

Tambien se probo el VPS historico `root@23.105.176.45` como posible salto SSH hacia `192.168.192.135`; no obtuvo banner SSH del host Gobierno.

Conclusion: el host es alcanzable, pero no hay credencial SSH valida disponible en esta maquina para publicar los paquetes.

## Archivo esperado

Fingerprint nuevo para `ar.gob.mendoza.rptrazar`:

`81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE`

## Paquetes generados

Paquetes locales listos para transferir:

- `/tmp/rptrazar-web-20260630.tar.gz`
- `/tmp/rptrazar-app-20260630.tar.gz`
- `/tmp/rptrazar-well-known-20260630.tar.gz`
- `/tmp/rptrazar-assetlinks-publish-20260630.tar.gz`

Builds verificados:

```text
npm run build: PASS
npx vite build --config vite.config.app.ts: PASS
```

Contenido esperado verificado localmente:

```text
frontend/dist/index.html: RP Trazar - Residuos Peligrosos
frontend/dist-app/app.html: RP Trazar - App
frontend/dist/manifest-app.json: rptrazar-mobile-app
frontend/dist-app/manifest-app.json: rptrazar-mobile-app
frontend/dist/sw.js: trazabilidad-rrpp-v27
frontend/dist/.well-known/assetlinks.json: ar.gob.mendoza.rptrazar
```

## Comandos para ejecutar en el host real

Copiar primero los paquetes al servidor:

- `/tmp/rptrazar-web-20260630.tar.gz`
- `/tmp/rptrazar-app-20260630.tar.gz`
- `/tmp/rptrazar-well-known-20260630.tar.gz`

Luego ejecutar en `192.168.192.135`:

```bash
sudo install -d -m 755 /var/www/sitrep
sudo install -d -m 755 /var/www/sitrep/app
sudo install -d -m 755 /var/www/sitrep/.well-known

sudo tar xzf /tmp/rptrazar-web-20260630.tar.gz -C /var/www/sitrep
sudo tar xzf /tmp/rptrazar-app-20260630.tar.gz -C /var/www/sitrep/app
sudo tar xzf /tmp/rptrazar-well-known-20260630.tar.gz -C /var/www/sitrep

sudo chown -R root:root /var/www/sitrep
sudo chmod -R u=rwX,go=rX /var/www/sitrep
sudo nginx -t
sudo systemctl reload nginx
```

Si el root real de Nginx no es `/var/www/sitrep`, ubicarlo con:

```bash
sudo nginx -T | grep -E "server_name|root "
```

y copiar el archivo bajo:

`<root>/.well-known/assetlinks.json`

## Validacion posterior

Desde una maquina con resolucion/ruta al dominio:

```bash
curl -sS https://rptrazar.mendoza.gov.ar/ | grep 'RP Trazar - Residuos Peligrosos'
curl -sS https://rptrazar.mendoza.gov.ar/app/ | grep 'RP Trazar - App'
curl -sS https://rptrazar.mendoza.gov.ar/manifest-app.json | grep 'rptrazar-mobile-app'
curl -sS https://rptrazar.mendoza.gov.ar/app/manifest-app.json | grep 'rptrazar-mobile-app'
curl -sS https://rptrazar.mendoza.gov.ar/.well-known/assetlinks.json
```

Debe mostrar dos entradas, incluyendo `ar.gob.mendoza.rptrazar`.

Validacion Android:

```bash
adb shell pm verify-app-links --re-verify ar.gob.mendoza.rptrazar
adb shell pm get-app-links ar.gob.mendoza.rptrazar
adb shell am start -n ar.gob.mendoza.rptrazar/.LauncherActivity
```

Resultado esperado:

- `rptrazar.mendoza.gov.ar` verificado para `ar.gob.mendoza.rptrazar`.
- La app abre `https://rptrazar.mendoza.gov.ar/app/` como Trusted Web Activity sin toolbar de Chrome.

## Evidencia tomada antes de publicar

Verificacion del 2026-06-30:

```text
ar.gob.mendoza.rptrazar:
  Signatures: [81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE]
  Domain verification state:
    rptrazar.mendoza.gov.ar: 1024
```

`dumpsys activity top` muestra:

```text
com.android.chrome/org.chromium.chrome.browser.customtabs.TranslucentCustomTabActivity
```

Captura local:

`/tmp/rptrazar-assetlinks-pending-20260630.png`

Paquete de entrega local:

`/tmp/rptrazar-assetlinks-publish-20260630.tar.gz`
