# Readiness produccion real RP Trazar - 2026-07-02

## Decision

Estado: **GO condicionado para piloto/capacitacion controlada**.

Estado: **NO-GO para full scope E2E destructivo sobre produccion real con datos reales**. El dataset de capacitacion ya existe, pero los flujos destructivos deben apuntar solamente a registros `isDemoData=true` y ejecutarse con opt-in explicito.

## Evidencia ejecutada

- Perfil seguro ejecutado contra `https://rptrazar.mendoza.gov.ar`.
- Reporte post-seed: `reports/test-runs/20260702-074911/summary.md`.
- Reporte E2E capacitacion: `reports/test-runs/20260702-081231/summary.md`.
- Reporte seguro final: `reports/test-runs/20260702-081604/summary.md`.
- Reporte production-smoke CAP-safe: `reports/test-runs/20260702-082559/summary.md`.
- Reporte post-manual: `reports/test-runs/20260702-092108/summary.md`.
- Resultado seguro final: **PASS 7 / WARN 0 / SKIP 0 / FAIL 0**.
- Resultado production-smoke CAP-safe: **PASS 10 / WARN 0 / SKIP 0 / FAIL 0**.
- Resultado post-manual: **PASS 7 / WARN 0 / SKIP 0 / FAIL 0**.
- Suites incluidas:
  - preflight target health reachability.
  - preflight npm registry.
  - health.
  - frontend surface / PWA shell.
  - PWA offline/service workers.
- API contract/OpenAPI/critical responses.
- operational readiness.

Nota de entorno:

- La corrida `reports/test-runs/20260702-082317/summary.md` fallo por DNS local del sandbox (`Could not resolve host: rptrazar.mendoza.gov.ar`), no por la aplicacion. Se repitio fuera del sandbox usando VPN/DNS del host y quedo PASS en `20260702-082559`.

## Web y PWA

Validado en dominio Gobierno:

- `/`: HTTP 200.
- `/app/`: HTTP 200.
- `/manual/`: HTTP 200.
- `/setup.html`: HTTP 200.
- `/offline.html`: HTTP 200.
- `/sw.js`: `trazabilidad-rrpp-v27`.
- `/sw-app.js`: HTTP 200.
- `/manifest-app.json`: `id=rptrazar-mobile-app`, `scope=/app/`, `start_url=/app/`.

## Manual de capacitacion

Recuperado y publicado en:

- `https://rptrazar.mendoza.gov.ar/manual/`.

Contenido desplegado:

- Fuente local: `docs/manual/`.
- Archivos publicados: 189.
- Capturas/assets publicados: 186.
- Peso desplegado: 58 MB.
- Backup remoto previo: `/home/ubuntu/sitrep-backups/manual-before-rptrazar-20260702-085830.tar.gz`.

Cambios aplicados:

- Branding de portada/header actualizado a `RP Trazar Mendoza`.
- Dominios legacy `sitrep.ultimamilla.com.ar` reemplazados por `rptrazar.mendoza.gov.ar`.
- Agregada seccion `17. Capacitacion y QA Controlada`.
- Incluye matriz `CAP-20260702-0001` a `CAP-20260702-0009`, recorrido por rol, comandos seguros y cierre de sesion.

Validacion:

- `/manual/`: HTTP 200.
- `manual.css`, `manual.js` y todas las referencias locales del HTML publico: HTTP 200.
- Captura desktop de muestra: `/manual/screenshots/desktop/04_dashboard_admin.png` HTTP 200.
- Captura mobile de muestra: `/manual/screenshots/mobile/M01_login_mobile.png` HTTP 200.
- `scripts/certification/check-frontend-surface.sh https://rptrazar.mendoza.gov.ar`: PASS.
- Perfil `produccion-seguro`: `reports/test-runs/20260702-092108/summary.md`, **PASS 7 / WARN 0 / SKIP 0 / FAIL 0**.

Nota de QA visual:

- Browser plugin `iab` no estuvo disponible en esta sesion. Se uso Playwright con Chrome local para DOM/interaccion.
- DOM validado: titulo `RP Trazar — Manual del Sistema | v2026.12`, seccion `#capacitacion-qa`, busqueda `CAP-20260702`, sin auth wall con sesion simulada.
- Chrome headless local devolvio screenshots blancos por problema de superficie de captura en esta maquina; por eso la evidencia visual final se apoyo en DOM, HTTP y auditoria de assets publicos.

Se corrigio el check `scripts/certification/check-frontend-surface.sh` para exigir ambos packages en `assetlinks.json`:

- `ar.com.ultimamilla.sitrep`.
- `ar.gob.mendoza.rptrazar`.

Validacion puntual posterior: **PASS**.

## Android TWA

APK/AAB firmados disponibles:

- `android-twa/build-rptrazar-new/app/build/outputs/apk/release/app-release-signed.apk`.
- `android-twa/build-rptrazar-new/app/build/outputs/bundle/release/app-release-signed.aab`.

Validado en emulador `sitrep_pixel7_api35`:

- `adb install -r ...app-release-signed.apk`: **PASS**.
- Package instalado: `ar.gob.mendoza.rptrazar`.
- Firma instalada:
  `81:20:6C:4C:4D:39:CB:05:79:DF:33:84:6C:EF:E9:86:F7:DA:8E:DC:A9:9C:E0:07:32:5C:B8:28:A6:42:9F:CE`.
- `assetlinks.json` publico contiene ese package/fingerprint.
- Logcat:
  `TWAConnectionPool: Found ar.gob.mendoza.rptrazar.DelegationService to handle request for https://rptrazar.mendoza.gov.ar/app/`.
- Captura: `/tmp/rptrazar-readiness-android-20260702.png`.

Nota tecnica: `pm get-app-links ar.gob.mendoza.rptrazar` sigue mostrando estado `1024` en este emulador, pero el launch abre la app en pantalla completa sin barra de direccion y Chrome encuentra el `DelegationService`.

## Servidor Gobierno

Host SSH usado:

- `ubuntu@<ip-interna-gobierno>`.
- Hostname: `sitrepprd1.mendoza.gov.ar`.

Servicios:

- `nginx`: active.
- `sitrep-backend`: active/running.
- `postgresql`: active.
- Readiness local: `{"status":"ready","checks":{"db":true,"memory":true,"uptime":true}}`.

Recursos:

- `/`: 35% usado.
- `/data`: 9% usado.
- Memoria disponible: aprox. 2.8 GiB.
- `sitrep-backend`: `NRestarts=0`, memoria aprox. 96 MB.

Observacion no bloqueante:

- `fwupd-refresh.service` figura failed. No afecta RP Trazar, pero conviene limpiarlo en ventana de mantenimiento.

## Backend y entorno

Variables no secretas activas:

- `NODE_ENV=production`.
- `PORT=3002`.
- `FRONTEND_URL=https://sitrepprd1.mendoza.gov.ar`.
- `CORS_ORIGIN=https://sitrepprd1.mendoza.gov.ar,https://rptrazar.mendoza.gov.ar`.
- `ENABLE_ANALYTICS=true`.
- `DISABLE_EMAILS=true`.
- `LOG_LEVEL=info`.

Implicancia para capacitacion:

- SMTP real queda deshabilitado por `DISABLE_EMAILS=true`.
- Igual se siguen generando auditorias, analytics, notificaciones internas y filas de workflow si los tests usan datos reales.

## Datos productivos detectados

Conteos actuales:

- Usuarios: 1410.
- Generadores: 1244.
- Transportistas: 76.
- Operadores: 48.
- Tipos de residuos: 43.
- Manifiestos: 251.
- Manifiestos `isDemoData=true`: 9.
- Notificaciones: 666731.
- Email queue: 190, todos `ENVIADO`.

Estados de manifiestos:

- BORRADOR: 23.
- APROBADO: 23.
- EN_TRANSITO: 11.
- ENTREGADO: 22.
- RECIBIDO: 38.
- EN_TRATAMIENTO: 1.
- TRATADO: 74.
- RECHAZADO: 26.
- CANCELADO: 24.

Conclusion de datos:

- Hay base real cargada y operativa.
- Existe un set aislado de capacitacion con prefijo `CAP-20260702`.
- No corresponde correr `certification`, `workflow-e2e`, `data-integrity`, `stress`, ni E2E Playwright autenticado completo sobre registros reales.

## Dataset de capacitacion creado

Backup previo:

- `/home/ubuntu/sitrep-backups/sitrep-prod-before-training-20260702.dump`.

Seed idempotente:

- Fuente: `backend/prisma/seed-production-training.ts`.
- Copia ejecutada en servidor: `/home/ubuntu/sitrep-backend/prisma/seed-production-training.js`.
- Script npm local: `npm run training:seed`.
- El reset limpia hijos de manifiestos CAP, sellos blockchain, alertas/notificaciones asociadas y filas `email_queue` con asunto `CAP-20260702`.

Usuarios creados/actualizados:

- `capacitacion.generador@rptrazar.mendoza.gov.ar` - GENERADOR.
- `capacitacion.transportista@rptrazar.mendoza.gov.ar` - TRANSPORTISTA.
- `capacitacion.operador@rptrazar.mendoza.gov.ar` - OPERADOR.

Controles aplicados:

- `activo=true`.
- `emailVerified=true`.
- `notifEmail=false`.
- `notifWhatsapp=false`.
- `notifTelegram=false`.

Actores de capacitacion:

- Generador: `cmr3dr0q9000411tc8uevchkf`.
- Transportista: `cmr3dr0qe000611tc6ykmfix6`.
- Operador: `cmr3dr0qi000811tcdos4mebi`.
- Vehiculo: `cmr3dr0qv000d11tctqrcr0j3`.
- Chofer: `cmr3dr0qz000f11tc9tx6c897`.
- Tipo residuo: `cmr3dr0qm000911tc1lo7u8q9`.
- Tratamiento: `cmr3dr0qq000b11tcfntx8koz`.

Manifiestos `isDemoData=true`:

- `CAP-20260702-0001` - BORRADOR.
- `CAP-20260702-0002` - APROBADO.
- `CAP-20260702-0003` - EN_TRANSITO.
- `CAP-20260702-0004` - ENTREGADO.
- `CAP-20260702-0005` - RECIBIDO.
- `CAP-20260702-0006` - EN_TRATAMIENTO.
- `CAP-20260702-0007` - TRATADO.
- `CAP-20260702-0008` - RECHAZADO.
- `CAP-20260702-0009` - CANCELADO.

Evidencia de aislamiento:

- Eventos demo: 35.
- Tracking GPS demo: 15.
- Anomalias demo: 1.
- Luego del E2E y reset final:
  - Estados `CAP-20260702-*` restaurados a la matriz base.
  - `email_queue` con asunto `CAP-20260702`: 0.
  - Notificaciones asociadas a manifiestos `CAP-20260702`: 0.

## E2E de capacitacion ejecutado

Perfil agregado:

- `produccion-capacitacion`.
- Requiere `ALLOW_PRODUCTION_TRAINING_E2E=true`.
- Acepta `PRODUCTION_TRAINING_RESET_COMMAND` para resetear dataset antes y despues.
- Corre `backend/tests/production-training-e2e-test.sh`.

Resultado:

- Reporte: `reports/test-runs/20260702-081231/summary.md`.
- Resultado global: **PASS 10 / WARN 0 / SKIP 0 / FAIL 0**.
- E2E interno: **PASS 36 / FAIL 0**.

Cobertura del E2E:

- Login ADMIN.
- Login GENERADOR capacitacion.
- Login TRANSPORTISTA capacitacion.
- Login OPERADOR capacitacion.
- Guard de dataset: todos los `CAP-20260702-*` deben existir, tener estado esperado e `isDemoData=true`.
- Superficie por rol:
  - ADMIN lista CAP.
  - GENERADOR lista propia.
  - TRANSPORTISTA ve viajes aprobados.
  - OPERADOR ve entregados.
- Ciclo completo sobre `CAP-20260702-0001`:
  - BORRADOR -> APROBADO.
  - APROBADO -> EN_TRANSITO.
  - GPS demo.
  - Incidente demo.
  - EN_TRANSITO -> ENTREGADO.
  - ENTREGADO -> RECIBIDO.
  - RECIBIDO -> EN_TRATAMIENTO.
  - EN_TRATAMIENTO -> TRATADO.
  - PDF manifiesto.
  - PDF certificado.
- Guardas negativas:
  - GENERADOR bloqueado al intentar confirmar retiro.
  - OPERADOR rechaza carga sobre manifiesto demo `CAP-20260702-0004`.

Reset post-E2E:

- Ejecutado correctamente.
- Estados finales verificados por SQL:
  - `CAP-20260702-0001` BORRADOR.
  - `CAP-20260702-0002` APROBADO.
  - `CAP-20260702-0003` EN_TRANSITO.
  - `CAP-20260702-0004` ENTREGADO.
  - `CAP-20260702-0005` RECIBIDO.
  - `CAP-20260702-0006` EN_TRATAMIENTO.
  - `CAP-20260702-0007` TRATADO.
  - `CAP-20260702-0008` RECHAZADO.
  - `CAP-20260702-0009` CANCELADO.

Verificacion segura final:

- Reporte: `reports/test-runs/20260702-081604/summary.md`.
- Resultado: **PASS 7 / WARN 0 / SKIP 0 / FAIL 0**.

## Production smoke CAP-safe

Se corrigieron los scripts autenticados para que contra Gobierno usen datos de capacitacion:

- `backend/tests/smoke-test.sh`:
  - Usa credenciales ADMIN desde `CERT_ADMIN_EMAIL` / `CERT_ADMIN_PASSWORD`.
  - En `rptrazar.mendoza.gov.ar` resuelve manifiesto por numero `CAP-20260702-0003`.
  - En `rptrazar.mendoza.gov.ar` resuelve actores por busqueda de actores escuela CAP.
- `backend/tests/role-enforcement-test.sh`:
  - Detecta produccion Gobierno.
  - Usa usuarios de capacitacion para GENERADOR, TRANSPORTISTA y OPERADOR.
  - Resuelve IDs por numero exacto:
    - `CAP-20260702-0001` BORRADOR.
    - `CAP-20260702-0002` APROBADO.
    - `CAP-20260702-0003` EN_TRANSITO.
  - Antes de cada seleccion valida `numero`, `estado` e `isDemoData=true`.

Corrida validada:

- Reporte: `reports/test-runs/20260702-082559/summary.md`.
- Resultado: **PASS 10 / WARN 0 / SKIP 0 / FAIL 0**.
- Suites: preflight, health, smoke, role-enforcement, search-safety, API contract, frontend surface, PWA offline y operational readiness.
- Post-run SQL:
  - Estados `CAP-20260702-*` intactos en matriz base.
  - `email_cap_rows|0`.
  - `notificaciones_cap_rows|0`.

## Suites habilitadas hoy

Habilitadas en produccion real:

- `produccion-seguro`.
- `production-smoke` con cooldown de auth y dataset CAP-safe.
- Checks directos HTTP/PWA/assetlinks.
- Health/readiness/liveness.
- API contract con baja frecuencia y cooldown de auth.

Bloqueadas hasta dataset aislado:

- `certification`.
- `workflow-e2e`.
- `data-integrity`.
- `stress`.
- `frontend/e2e/pwa-load.spec.ts`.
- Cualquier prueba que cree, apruebe, transporte, reciba, trate, rechace, cancele, borre, marque notificaciones o edite usuarios/actores.

Guarda implementada en `scripts/certification/run-certification-suite.sh`:

- `workflow-e2e`, `data-integrity` y `stress` abortan contra `rptrazar.mendoza.gov.ar` o `sitrepprd1.mendoza.gov.ar` salvo `ALLOW_PRODUCTION_DESTRUCTIVE_E2E=true`.
- `produccion-capacitacion` aborta contra produccion real salvo `ALLOW_PRODUCTION_TRAINING_E2E=true`.

## Requisitos antes de full scope E2E en produccion

1. Mantener `DISABLE_EMAILS=true` durante capacitacion.
2. Ejecutar nuevas corridas E2E con `produccion-capacitacion`, no con los scripts destructivos historicos.
3. Reescribir o retirar los scripts historicos que todavia crean datos fuera de `CAP-20260702`.
4. Ejecutar `production-smoke` con cooldown cuando se necesiten checks autenticados no destructivos.
5. Usar el guion de capacitacion: `docs/qa/2026-07-02-rptrazar-guion-capacitacion.md`.

## Conclusion

Podemos avanzar a una **capacitacion/piloto controlado en el servidor Gobierno** con datos basicos aislados ya cargados.

No recomiendo usar los scripts destructivos historicos en produccion real. Para capacitacion y E2E controlado, usar `produccion-capacitacion`, que ya opera sobre `isDemoData=true`, resetea el dataset y deja evidencia. El sistema base esta sano; el riesgo restante esta en gobernanza operativa y en separar claramente capacitacion de usuarios finales.
