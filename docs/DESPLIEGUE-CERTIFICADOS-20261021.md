# Certificados: publicación de 19230380 — 21/10/2026

**Backend, web, `/app` y manual `192303801a3444449d2a5086e0f355f13a017e37` publicados** en `sitrep.ultimamilla.com.ar` el **21/10/2026 20:37:40 Mendoza**, con autorización expresa del dueño. Certificados habilitados. Backup verificado antes de migrar; smoke no mutante aprobado. Main y registros de negocio sin cambios; sin workflows ni envíos.

## Alcance y configuración

El operador vinculado puede firmar y publicar certificaciones parciales y finales. Las partes activas reciben el aviso en la campana y acceden al mismo PDF conservado. Se mantienen los controles de cantidades, concurrencia, adendas, acceso y expediente firmado. [Implementación, pruebas y límites](CERTIFICADOS-OPERATIVOS-20261021.md).

**Única activación nueva:** `MANIFEST_CERTIFICATES_ENABLED=true` y `VITE_MANIFEST_CERTIFICATES_ENABLED=true`. Propuestas de tres partes, relevos y GPS múltiple siguen habilitados. Adendas, revisión de partes, eventuales, enterprise, multirrol y demo conservan false. La designación de cuentas de autoridad continúa diferida por el dueño; no se seleccionaron ni modificaron cuentas.

Se conservó el `.env` previo byte a byte y sólo se agregó la variable de certificados. Hash anterior **`97ef23d52f52f0f9b17ce26e467880670f264671c5a14acc8750feb94835d28f`**; nuevo **`c6ccba0f124f6048aa0f2b0d33d0aa9797a0c982a9d4a346798449cd2d72c2e6`**. Verificado en archivo, ambos workers y PM2 guardado; identidades de base/JWT conservadas, sin mostrarlas.

**CAP cerrado** (`TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`), **correos y push apagados** (`DISABLE_EMAILS=true`, push de manifiestos false, VAPID vacío, SMTP sin contraseña). `UPLOADS_DIR=/var/lib/sitrep-uploads` y enlace histórico conservados. No hubo logins, emisiones de prueba, consultas de registros reales ni cambios de usuarios.

## Build y publicación

Compilación nueva de **2.366 blobs exactos** del commit autorizado, contrastados antes y después. Preview remoto, fases seriales, un worker, **1 CPU / 2 GiB / swap cero**. Prisma generate previo al compilador, backend, tipos frontend, web y app PASS. API final **`https://sitrep.ultimamilla.com.ar/api`**; mismos flags en ambas superficies. Manual exacto del commit, versión **2026.21.4**; renderer **2026.20.6**, CSS **2026.20.5** y directorio conservados.

Paquetes verificados por SHA-256 al generarse, transferirse y extraerse. **395 archivos backend / 516 web-manual / 200 app / 14 cliente Prisma**. **230 dependencias runtime** comprobadas en copia independiente, sin instalaciones productivas ni modificar el cliente anterior. Cliente generado contra el esquema nuevo, motor RHEL/OpenSSL cargado correctamente. Assets anteriores preservados para sesiones abiertas.

Backend: `/var/www/sitrep-backend-releases/20261021-certificados-19230380`. Web/app/manual: `/var/www/sitrep-releases/20261021-certificados-19230380`. Enlaces activos y metadatos apuntan al SHA autorizado. Sólo se recargó `sitrep-backend`; otras aplicaciones y Nginx sin cambios.

SW raíz **v148**, app **20261021233319**, con activación explícita. La fuente raíz conserva v127: la versión se aplica al artefacto de release y queda registrada por hash. No se reutilizó v147, reservada para la reversión anterior.

## Backup y migración

Auditoría privada: **`/var/backups/sitrep/20261021-certificados-19230380/`**, directorio root 0700. Configuración previa/PM2 y base archivados en el servidor; archivos sensibles 0600. No se copiaron secretos ni datos de negocio a Mac o preview.

Backup **`trazabilidad_rrpp-before-19230380.dump`**, **23.787.087 bytes**, SHA-256 **`f103820b2b67f50e41ebb5c3c826789f1269a195ad0745a9608149ebf2f8cef3`**. Verificado **20:36:51 Mendoza**, antes de migrar: formato custom, presencia de esquemas ordinario/CAP e historial, lectura completa mediante `pg_restore --file=/dev/null` y hash repetido. No se ejecutó una restauración ni se inspeccionaron filas.

Única migración pendiente: **`20261021200000_manifest_certificates`**, SHA-256 **`6530f972da7ef19ed9f20b3d66062cc14f974ba87b3f26ed43848f49aa1ed847`**. `prisma migrate deploy` aplicado a `public`; mismo SQL aditivo en transacción, `search_path` explícito y propietario restringido existente en `sitrep_training`, que no posee baseline Prisma. No se fabricó historial.

Migración terminada **20:37:06 Mendoza**. En ambos esquemas se verificó `certificados_manifiesto`: **13 columnas, 4 índices, final única y 2 relaciones con borrado restringido**. Prisma status PASS. Los 26 checksums de migraciones previas presentes en fuente y el historial previo completo permanecen intactos, incluidas 16 migraciones históricas que no están en esta fuente. No hubo DML de negocio ni cambios a registros existentes.

## Validación y límites

| Control no mutante | Resultado |
| --- | ---: |
| HTTPS en servidor: shells, chunks, manual, salud y barreras de autenticación | **138/138** |
| HTTPS externo y hashes publicados | **9/9** |
| PWA: shell, assets/MIME, 404, asociación y service worker | **8/8** |
| Entorno, uploads, identidades, workers y PM2 guardado | **PASS** |

Incluye guía de certificados, ambas capturas, descarga/listado protegidos con 401 sin token y compatibilidad con el endpoint histórico. Cero logins y cero mutaciones de validación. Dos workers estables al control final de **20:37:54 Mendoza**, sin reinicios adicionales desde la activación.

La aceptación funcional previa se detalla en el [informe de certificados](CERTIFICADOS-OPERATIVOS-20261021.md): suites completas **1456 backend / 1801 frontend** antes de los últimos ajustes, regresión final **95 backend / 127 frontend**, **6/6 E2E únicos** en web/web angosta/app, **6 grupos API**, flag apagado y dos PDF. El E2E comprobó recepción del aviso con la bandeja abierta y PDF idéntico entre operador, generador y transporte. No se repitieron suites completas ni recorridos autenticados en producción; el smoke no certifica dispositivos físicos ni entrega externa de correo/push.

Los builds y sus comprobaciones no registraron presión ni OOM (`memory.events max/oom/oom_kill=0`). Preview detenido **20:34:59 Mendoza**, antes de activar producción: `Running=false`, `Pid=0`, `OOMKilled=false`, salida 143 normal. No se iniciaron API, PostgreSQL, servidores web o túneles en esta publicación. Imagen, base artificial y evidencia preservadas.

Durante la preparación local, el control automático rechazó un heredoc que contenía una guarda SQL por interpretarla como borrado. No se ejecutó ninguna operación de base. Se prepararon los archivos mediante la herramienta de edición, manteniendo las guardas, y se verificó su sintaxis antes de usarlos.

## Reversión vigente, preparada sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261021-certificados-19230380/publish-production.js rollback'
```

Esta reversión **apaga la emisión** (`MANIFEST_CERTIFICATES_ENABLED=false`) y conserva **backend, interfaz y manual 19230380**, lectura/descarga de documentos ya emitidos, guardas del expediente firmado, esquema y demás flags. Usa frontend preparado con SW raíz **v149** y app **20261021233627**; inventario y hashes verificados. No es una degradación a código anterior: eso podría dejar inaccesibles los parciales o ignorar guardas persistidas.

No restaura base, no borra certificados/evidencias y no reabre CAP ni canales. **Preparada, no ejecutada**. No usar los comandos de reversión de publicaciones anteriores después de esta migración/activación. El backup se conserva para recuperación controlada, no como rollback automático que borre actividad posterior.

[Resumen verificable](deployment-19230380-20261021.json). Evidencia local ignorada `test-results-deploy-19230380/`; artefactos remotos `.qa-release-19230380-20261021/` en el source del preview. Rama `codex/sitrep-training-20261018`, único checkout autorizado. Main conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Cierre documental `[skip ci]`, sin push ni workflows; el producto publicado sigue siendo exactamente 19230380.
