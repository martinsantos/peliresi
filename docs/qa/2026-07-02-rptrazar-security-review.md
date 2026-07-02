# RP Trazar - Revision de Seguridad

Fecha: 2026-07-02
Ambiente: `https://rptrazar.mendoza.gov.ar`

## Alcance

- Repo local y ultimo estado publicado en `main`.
- Webroot productivo Gobierno: `/var/www/sitrep`.
- Backend productivo Gobierno: `/home/ubuntu/sitrep-backend`.
- Rutas publicas: `/`, `/app/`, `/manual/`, `/setup.html`, `/sw.js`, `/.env`, `/.git/HEAD`.

## Realizado

- Se removieron valores concretos de secretos de archivos versionados de deploy.
- Se reemplazaron rutas/IPs operativas por placeholders en documentacion.
- Se restringio `frontend/public/setup.html` para no publicar wizard operativo ni credenciales.
- Se retiro del manual publico la guia detallada de instalacion, backups, restauracion y comandos de servidor.
- Se quitaron accesos rapidos con passwords del login productivo; quedan habilitados solo con `VITE_DEMO_MODE=true`.
- Se cambio `frontend/.env.production` a `VITE_API_URL=/api`.
- Se subio `sw.js` a cache `v33`.
- Se agrego `SEED_ADMIN_PASSWORD` para que `prisma db seed` no cree admin con password fijo en `NODE_ENV=production`.
- Se agregaron headers de seguridad en Nginx para frontend/manual/setup:
  - `Strict-Transport-Security`
  - `X-Frame-Options`
  - `X-Content-Type-Options`
  - `Referrer-Policy`
  - `X-Robots-Tag`
  - `Content-Security-Policy`

## Evidencia de Produccion

- Public scan de marcadores sensibles:
  - `/`: `sensitive_markers=no`
  - `/app/`: `sensitive_markers=no`
  - `/manual/`: `sensitive_markers=no`
  - `/setup.html`: `sensitive_markers=no`
  - `/sw.js`: `sensitive_markers=no`
  - `/.env`: fallback SPA, `sensitive_markers=no`
  - `/.git/HEAD`: fallback SPA, `sensitive_markers=no`

- `scripts/certification/check-frontend-surface.sh https://rptrazar.mendoza.gov.ar`: PASS.
- `produccion-seguro`: PASS 7 / WARN 0 / SKIP 0 / FAIL 0.
- Reporte: `reports/test-runs/20260702-101306/summary.md`.
- API health post-restore backend: `{"status":"ok","db":"connected"}`.

## Backups Creados

- Webroot antes de saneamiento:
  - `/home/ubuntu/sitrep-backups/security-sanitize-before-20260702-094641.tar.gz`
- Nginx antes de headers:
  - `/etc/nginx/sites-available/sitrep.bak-security-20260702-095538`
- Backend antes de intento de deploy:
  - `/home/ubuntu/sitrep-backups/backend-before-security-20260702-100133.tar.gz`
- Arbol backend parcial preservado:
  - `/home/ubuntu/sitrep-backend.partial-security-20260702-101245`

## Dependencias

- Frontend:
  - `npm audit --omit=dev --audit-level=moderate`: 0 vulnerabilidades.
  - Build principal: PASS.
  - Build PWA `/app/`: PASS.

- Backend local:
  - `npm audit fix` aplicado.
  - `nodemailer` actualizado; vulnerabilidad high removida localmente.
  - Queda `uuid` moderate pendiente porque el fix requiere upgrade breaking.
  - Build TypeScript: PASS.

## Pendiente Real

- El backend productivo fue restaurado desde backup porque `npm ci` en el servidor fallo por timeout contra npm registry antes del restart. No quedo roto: servicio systemd activo y API health OK.
- Para activar en servidor los updates de dependencias backend, preparar uno de estos caminos:
  - permitir salida estable del servidor a npm registry y repetir deploy backend;
  - empaquetar dependencias Linux desde CI/host compatible;
  - usar mirror/cache npm interno.
- Revisar `uuid` breaking upgrade en rama separada.
- Limpiar headers duplicados en API: Express/Helmet y Nginx emiten algunos headers simultaneamente. No rompe la API, pero conviene dejar una sola fuente de CSP para `/api/`.
- Rotar cualquier credencial real que haya coincidido con valores historicos de demo antes de considerar produccion final.
