# Publicación de relevos y GPS múltiple — 19/10/2026

**Actualización vigente del 20/10:** web/app pasaron a **`6788c82c`** a las **07:20:58 Mendoza**. Backend/manual `d372ce6e` y flags conservados, sin reinicios ni migraciones. Smoke 62/62, externo 9/9 y PWA PASS; CAP/correos/push cerrados. Leer [publicación y rollback actual de interfaz](REVISION-OPERACION-MANIFIESTOS-20261019.md). El resto de este documento conserva la publicación del 19/10; su contención que apaga entradas de transporte no es el rollback normal de la nueva interfaz.

Publicado **`d372ce6e2c62b21dc97a8a42a72d84a6de4d707b`**, backend, web, `/app` y manual, en `sitrep.ultimamilla.com.ar`, el **19/10/2026 a las 21:25:45 Mendoza** (`2026-10-20T00:25:45.588Z`). Autorización explícita del dueño: publicar ese commit, habilitar relevos y GPS múltiple, respaldar antes de migrar, mantener CAP cerrado y correos/push apagados; smoke no mutante. No se integró ni modificó `main` ni se dispararon workflows.

## Versiones y configuración de la publicación del 19/10

- Backend: `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261019-relevos-d372ce6e`.
- Web y app: `/var/www/sitrep` → `/var/www/sitrep-releases/20261019-relevos-d372ce6e`.
- Identificación pública: [release.json](https://sitrep.ultimamilla.com.ar/release.json), con el mismo SHA para producto, backend y manual.
- `MANIFEST_TRANSPORT_HANDOFF_ENABLED=true` y `TRANSPORT_MULTI_GPS_ENABLED=true`, también en sus pares Vite incorporados al compilar.
- `ENTERPRISE_ENABLED`, `MANIFEST_EXCEPTIONAL_ENABLED`, `MANIFEST_ADDENDA_ENABLED`, `MANIFEST_PARTY_REVIEW_ENABLED` y `ACTOR_MULTIROLE_ENABLED` permanecen `false`. Los cuatro flags Vite originales y `VITE_DEMO_MODE` permanecen `false`.
- CAP cerrado: `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`. No se reactivaron alias ni cuentas, no hubo login CAP en esta publicación y se conservó su historial.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, claves VAPID vacías y contraseña SMTP ausente. No se habilitaron ni probaron entregas externas.
- `UPLOADS_DIR=/var/lib/sitrep-uploads`, sin mover ni consultar documentos. Se conservó el enlace de compatibilidad histórico de `uploads`.
- SW raíz **v127**, app **20261020001844**; manual **2026.20.11**, con `manual.css` y `manual.js` idénticos por hash al release anterior.

Sólo cambiaron tres claves del `.env` del release nuevo: los dos flags de transporte y el nuevo flag de push explícitamente apagado. El archivo del release anterior quedó intacto. Configuración verificada tanto en archivo como en ambos workers y en el estado guardado de PM2. Dos workers online, sin reinicios adicionales después de la recarga de publicación, en la comprobación final de las 21:26:23 Mendoza.

## Respaldo y migración

Auditoría privada, acceso root: `/var/backups/sitrep/20261019-relevos-d372ce6e/`.

Respaldo completo anterior a la migración:

```text
trazabilidad_rrpp-before-d372ce6e.dump
23.465.019 bytes
SHA-256 e34485cd5a0ec96ee69484f8445667905345f2d16be071f4ee413d6b7273da8a
```

Se verificaron el índice del archivo, presencia de tablas/datos operativos y CAP, decodificación completa a `/dev/null` y repetición del SHA-256 antes de migrar. **No se restauró la base** ni se copiaron el dump, `.env` o el estado privado de PM2 a la Mac o al preview. Respaldo del `.env` y de PM2 conservados en la misma auditoría, modo 0600.

La única migración pendiente era **`20261019180000_transport_handoffs`**, SQL SHA-256 `b5f8b0451cea832e241006ee323aa2caae5209290dc4bd341443644d0c40dcd1`:

- `public`: `prisma migrate deploy` del release exacto; después, `prisma migrate status` correcto. Se contrastaron los checksums de las 23 migraciones fuente anteriores; las 16 entradas históricas sin SQL en este checkout permanecieron intactas. No se repitieron las doce migraciones del despliegue anterior ni se ejecutó `resolve`.
- `sitrep_training`: mismo SQL aditivo dentro de una transacción, con el principal restringido dueño del esquema y `search_path` explícito. CAP no tiene historia Prisma; no se inventó una línea de base ni se ejecutó una cadena de migraciones antiguas sobre él.
- Verificación por catálogo en ambos esquemas: tabla de tramos, restricción de un tramo activo, claves foráneas, índice GPS y columnas opcionales `tramoId`/`emisor` presentes. No hubo seeds, backfill, cambios de identidad ni consultas de registros de negocio para validar.

## Artefactos y comprobaciones

Se reutilizó exclusivamente el checkout activo y el contenedor propio del preview. Los **2.176 blobs de Git** de `d372ce6e` se verificaron antes y después del build. Cinco documentos desactualizados del preview se alinearon con el commit; el preflight inicial se detuvo antes de compilar. No se modificó producto para preparar esta publicación.

Compilación serial, un worker, **1 CPU/2 GiB/swap cero**: backend 23,40 s, tipado efectivo frontend 35,85 s, web 34,00 s y app 32,22 s. API incorporada: `https://sitrep.ultimamilla.com.ar/api`. Cliente Prisma generado en el preview, contrastado con el formato canónico del esquema y cargado con su motor RHEL en el release nuevo. Las 230 dependencias de runtime coinciden con el lockfile anterior; copia independiente, sin instalaciones ni modificación del cliente activo anterior.

Archivos comprobados por SHA-256 al preparar y activar: **364 backend, 493 web/manual, 195 app y 14 cliente Prisma**. Se conservaron assets anteriores para clientes abiertos. Dos capturas obsoletas sin seguimiento, duplicadas en `screenshots/app`, se excluyeron de la extracción de publicación después de comprobar que sus bytes eran idénticos a los originales registrados en `screenshots/mobile`; constan en `excludedUntrackedDocumentation`. Los originales permanecen intactos; las copias de prueba quedaron como evidencia privada del preview.

| Comprobación | Resultado |
| --- | --- |
| Smoke HTTP público, desde servidor, sólo GET | **57/57** |
| HTTPS externo desde la Mac, sin navegador ni sesión | **9/9** |
| `scripts/ops/check-pwa-assets.sh` | **PASS** |
| `.env`, PM2 activo y PM2 guardado | Flags aprobados, CAP/correos/push cerrados |
| Manual publicado | Bytes de entrada/datos coinciden con fuente; CSS y renderer anteriores intactos |

El smoke comprueba web/app, rutas de varias cargas y seguimiento, JS/CSS, ambos workers de servicio, precache, manual y capturas sintéticas, identificación del release, asociación PWA, 404 de asset inexistente, redirección `/app` y health/live/readiness. Las rutas de cargas, relevos y tramos sin sesión rechazan con 401; el enlace GPS sin token también rechaza con 401. No se inició sesión, se crearon ejercicios o se enviaron posiciones, correos o push.

La aceptación funcional previa permanece en la [revisión de operación](REVISION-OPERACION-MANIFIESTOS-20261019.md): backend **1177/1177**, frontend **1615/1615**, API sintética **26 grupos**, navegador **6/6** web/app, manual **15/15**. No se repitieron las suites completas durante la publicación; se recompiló el mismo código con la URL final. El smoke no certifica recorridos autenticados sobre datos reales, sensores físicos, Android ni GPS con pantalla cerrada.

Incidencias de herramientas: el primer `pg_restore --list` recibió el dump mediante un buffer y el cierre temprano de la lectura produjo EPIPE; el dump ya estaba completo. Se corrigió a descriptor de entrada y pasaron índice y decodificación completa antes de migrar. La primera comprobación externa buscó la versión del manual dentro de `help-data.js`; el versionado está en la URL del script de `index.html`. Se corrigió la ubicación, conservando la versión esperada y exigiendo además igualdad exacta de bytes; repetición final 9/9. El chequeo sintáctico local de scripts operativos se ejecutó por stdin porque ese Node no admite `.ts` en `--check`. No se relajaron contratos ni se cambió producto.

## Recuperación preparada en la publicación del 19/10

Se conservan los releases previos:

- Backend `/var/www/sitrep-backend-releases/20261019-agenda-8de58de`.
- Frontend `/var/www/sitrep-releases/20261019-login-75f3062`.

**No volver automáticamente a ese backend:** ignora la custodia por tramos y podría aceptar GPS del transporte anterior. Tampoco restaurar una base antigua para deshacer la interfaz. Los relevos creados después de publicar y sus posiciones deben conservarse.

Se preparó, compiló y verificó un release de **contención** del mismo `d372ce6e`: `/var/www/sitrep-releases/20261019-relevos-contained-d372ce6e`. Sus entradas de interfaz para relevos/GPS múltiple están apagadas; conserva las rutas públicas de GPS limitado, el manual y los assets previos. No está activo. Script privado de aplicación:

```sh
ssh root@23.105.176.45 'node < /var/backups/sitrep/20261019-relevos-d372ce6e/contain-production.ts'
```

Este procedimiento **conserva el backend `d372ce6e` y `MANIFEST_TRANSPORT_HANDOFF_ENABLED=true`**, necesarios para atender los enlaces GPS existentes y leer custodia correcta en C3. Apaga `TRANSPORT_MULTI_GPS_ENABLED`, cambia atómicamente sólo la interfaz al release de contención, recarga exclusivamente SITREP, guarda PM2 y verifica readiness y rechazo de un enlace sin token. CAP y canales externos siguen cerrados. No consulta ni restaura datos.

Es una contención temporal, no una desactivación total del backend de relevos ni una recuperación idéntica de todas las pantallas: retira controles nuevos de la interfaz y detiene el GPS simultáneo. Las cargas que lo usaban deben reorganizar su seguimiento individual; los enlaces delegados vigentes siguen disponibles y C3 conserva la custodia por tramo. Una falla del propio backend de relevos requiere una corrección compatible con tramos; no un downgrade ciego. El script quedó preparado y comprobado sintácticamente, **no se ejecutó** sobre el servicio publicado.

## Cierre

Contenedor `sitrep-qa-training-20261018` detenido a las 21:26:22 Mendoza, imagen y artefactos conservados. No quedaron procesos Node de QA activos; PostgreSQL de QA no se inició para estos builds. Límites verificados y contadores `max=0`, `oom=0`, `oom_kill=0`.

Evidencia local ignorada: `test-results-deploy-d372ce6e/`. Remota de preview: `.qa-release-d372ce6e-20261019` dentro de `/opt/sitrep-qa-enterprise-20261016/source`. Auditoría productiva: `backup.json`, `stage.json`, `migration.json`, `schema-after.json`, `deployment.json`, `final-state.json`, scripts y logs, en la carpeta privada indicada arriba. Los reportes locales recopilados no incluyen secretos ni datos de la base.

Único checkout activo, rama `codex/sitrep-training-20261018`; `main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Producto publicado exactamente desde `d372ce6e`; el cierre posterior sólo actualiza documentación con `[skip ci]`, sin push ni workflows. Los avisos conocidos del archivo auxiliar `._pack-…idx` en metadatos Git compartidos se conservaron en el log local; no se reparó ni alteró el checkout histórico.
