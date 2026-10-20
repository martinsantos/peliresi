# Informe de hallazgo y cola PSIP publicados — 20/10/2026

**Backend, web, `/app` y manual `c9cd877f73ef4cac30cd751dfb1f396807c7ead5` publicados** en `sitrep.ultimamilla.com.ar` el **20/10/2026 a las 18:15:18 Mendoza** (`21:15:18.849Z`). El dueño autorizó ese commit, backup antes de migrar, CAP cerrado, correos/push apagados y flags actuales, sin main, datos reales ni workflows. Smoke final no mutante aprobado.

Incluye el [informe del operador dentro de la adenda y la cola de revisión PSIP](HALLAZGOS-ADENDAS-PSIP-20261020.md). Las diferencias declarado/observado, corrientes que no constan en la ficha, participantes eventuales y relevos externos aportan evidencia por evaluar; no crean infracciones ni inspecciones automáticamente. Administración competente evalúa, descarta con motivo o vincula/abre un expediente. Se conservan fuentes, permisos, históricos y decisiones independientes de adenda.

**Publicar conserva los flags de origen:** adendas, eventuales y revisión de partes permanecen apagados, igual que antes. No se activan esos circuitos por esta publicación. Relevos y GPS múltiple continúan habilitados; un relevo externo nuevo puede aportar su antecedente a PSIP. No hay backfill de fuentes anteriores ni modificación de datos de padrón o reglas regulatorias.

## Releases y configuración

| Componente | Release activo |
| --- | --- |
| Backend | `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261020-hallazgos-psip-c9cd877f` |
| Web, app y manual | `/var/www/sitrep` → `/var/www/sitrep-releases/20261020-hallazgos-psip-c9cd877f` |
| Identificación pública | `/release.json`: `source`, `backendSource` y `manualSource` iguales al SHA autorizado |

Manual **2026.20.17**, guía **Informe de hallazgo: de la adenda a PSIP**, con las dos capturas originales de QA. Inventario idéntico al commit autorizado; CSS y renderer conservados por hash. SW raíz **v138**, app **20261020211008**. El código fuente conserva v127 en la raíz: sólo el artefacto publicado transforma esa versión a v138, con hashes antes/después en `build.json`. Las versiones v137 ya estaban reservadas para una reversión anterior y no se reutilizaron. Activación explícita del SW, sin recarga global forzada ni pérdida deliberada de borradores; assets anteriores conservados para sesiones abiertas.

El `.env` se copió byte por byte al nuevo release, modo 0600. SHA-256 antes/después **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Se verificaron archivo, ambos workers y estado PM2 guardado:

- `UPLOADS_DIR=/var/lib/sitrep-uploads` y enlace histórico `uploads` conservados; no se abrieron ni movieron documentos de negocio.
- CAP cerrado con `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`. Sin logins ni reactivación de alias.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y contraseña SMTP ausente. Sin envíos ni pruebas de proveedores.
- Enterprise, eventual, adendas, revisión de partes y multirrol false; relevos y GPS múltiple true en backend/Vite; demo false. Sin flags nuevos ni cambios al resto del entorno.

Se recargó exclusivamente `sitrep-backend`, dos workers online, PID **574001 / 574038**, un reinicio previsto por worker (**30 → 31**). La comprobación posterior de las **18:15:48 Mendoza** conservó ambos PID y contadores. Readiness, live y health correctos; estado PM2 guardado. Otras aplicaciones y configuración Nginx intactas.

## Backup verificado antes de migrar

Auditoría privada **`/var/backups/sitrep/20261020-hallazgos-psip-c9cd877f/`**, directorio root 0700. Copias privadas del `.env` y PM2, modo 0600, verificadas antes de activar.

Respaldo completo de la base anterior a la migración, terminado y verificado a las **18:14:18 Mendoza**:

```text
trazabilidad_rrpp-before-c9cd877f.dump
23.750.117 bytes
SHA-256 17e560c9f08d13f8103ff8efe669caebe266be4803c0dee382c95d4d56e87788
```

Formato custom, índice con esquemas operativo/CAP y migraciones, decodificación íntegra hacia `/dev/null` y repetición del hash antes/después de migrar. **No se restauró la base.** Dump, índice privado, configuración y copias PM2 permanecen en producción; no se copiaron datos productivos al preview o a la Mac. Sólo se recuperaron reportes filtrados de metadatos y comprobaciones.

## Migración única y aditiva

**`20261020210000_inspection_intake`**, SQL SHA-256 **`83adb4d86cb0d4c1260335957dfdbed111f40ed61f258e94e2cd7be767d8d994`**. Columna JSON nullable `adendas_manifiesto.informeHallazgo` y nueva tabla `antecedentes_fiscalizacion`. Sin seeds, backfill, reconstrucción de informes ni actualizaciones de filas de negocio.

- `public`: `prisma migrate deploy` del release exacto, terminado a las **18:14:36 Mendoza**. Única pendiente comprobada antes de ejecutar. Checksums de **25 migraciones fuente anteriores** y **16 entradas históricas adicionales** conservados, sin repetir historias ni ejecutar `resolve`. `prisma migrate status` posterior correcto.
- `sitrep_training`: mismo SQL aditivo dentro de transacción, `search_path` explícito y límites de bloqueo/tiempo, con el principal restringido dueño del esquema. No tiene historia Prisma: no se fabricó un baseline ni se aplicó una cadena antigua. CAP sigue cerrado.
- Catálogos posteriores, por esquema: una tabla nueva de **18 columnas**, **cinco índices** contando la clave primaria y el único por origen/rol, FK a inspecciones con `ON DELETE RESTRICT`; columna `informeHallazgo` JSONB nullable en adendas. Validación sólo mediante catálogos/historia, sin leer filas de manifiestos, adendas, usuarios o inspecciones.

El informe de adendas anteriores sigue ausente; no se atribuye un hallazgo retrospectivo ni se cambian huellas de anexos históricos. Los antecedentes futuros conservarán evidencia y decisiones aunque la adenda se rectifique o rechace.

## Compilación y verificación

Build nuevo del SHA exacto en el preview aislado, fases seriales, **1 CPU / 2 GiB / swap cero**. **2.262 blobs** verificados antes y después. Backend TypeScript, tipos efectivos frontend, web y app PASS. API incorporada en ambos paquetes **`https://sitrep.ultimamilla.com.ar/api`**, sin API de QA. Flags de publicación originales, no los de los ensayos de fuentes. `memory.events max/oom/oom_kill = 0/0/0`.

Cliente Prisma generado desde el esquema canónico nuevo, SHA-256 **`ecccd79b072a9da48b21a787a9bb903b20f0467a9bca6634a7b5d0b0d3afbf24`**, modelo `AntecedenteFiscalizacion`, modelos de reservas ATM previos y motor RHEL/OpenSSL verificados. **230 dependencias runtime** conservadas por lockfile, copia independiente sin instalar dependencias en producción ni modificar el cliente anterior. Herramientas OCR y assets previos conservados.

Archivos comprobados por SHA-256 al preparar y antes de activar: **382 backend / 505 web-manual / 199 app / 14 cliente Prisma**. Reversión e inventario del release anterior verificados antes de activar. Paquetes transferidos por SSH; sólo artefactos nuevos del preview.

| Control publicado, sin autenticación ni mutaciones | Resultado |
| --- | ---: |
| HTTPS desde servidor: shells, assets, manual, guías, capturas, salud y protección API | **103/103** |
| HTTPS externo desde la Mac y hashes de los paquetes publicados | **9/9** |
| PWA: shell, JS/CSS y MIME, 404 de JS inexistente, asociación Android y SW explícito | **8/8** |
| Dos workers estables, `.env`, CAP, flags, uploads y Nginx | **PASS** |

Se verificó la nueva ruta `/api/inspecciones/antecedentes` sin token: **401 antes de acceder a registros**. Mismo control para inspecciones, participación, intercambios, notificaciones, viajes, relevos, altas y documentos. Manual/guía/capturas y chunks del informe/cola comprobados por hash; identificación de backend/web/app/manual consistente. **Cero logins, cargas de archivo o mutaciones de negocio en el smoke.** Las peticiones públicas de requisitos y salud no consultan expedientes reales. La asociación Android publicada no certifica sensores, hardware o GPS en segundo plano.

Aceptación funcional previa del mismo producto: **69/69 backend, 43/43 frontend, 11 grupos API, 4 grupos adicionales de alcance, 3 de atomicidad, 3 PDF, 3 flags/CAP, 9/9 navegador, 24/24 manual y 3/3 navegador del manual final**, tipos/builds/lint y diff Prisma PASS. En esta publicación se recompiló con API/flags finales y se verificaron artefactos/smoke. No se repitieron suites globales ni recorridos autenticados productivos.

## Reversión preparada, sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-hallazgos-psip-c9cd877f/publish-production.js rollback'
```

**Sólo revierte interfaz y manual** a `a6a5c005` / manual **2026.20.16**, desde `/var/www/sitrep-releases/20261020-hallazgos-psip-c9cd877f-rollback`. Assets de ambas versiones, SW raíz **v139**, app **20261020211357**; copias y hashes ya verificados. **Conserva backend `c9cd877f`, informes, cola, pagos, tramos y esquema**, `.env`, flags y uploads. Comprueba readiness y guarda PM2. No se ejecutó.

No volver a un backend que ignore la captura transaccional de antecedentes o las reservas de pago/tramos. Tampoco borrar tablas, evidencias o columnas, ni restaurar la base para revertir UI. Una falla de backend requiere una corrección compatible con esos controles. La interfaz anterior no expone la cola nueva, pero el backend continúa registrando sus fuentes habilitadas.

## Cierre e incidencias

Preparación, backup, migración y publicación terminaron correctamente en su primera ejecución, sin recuperación automática ni rollback. Antes de verificar el build, una comprobación de exclusión detectó la fase todavía activa y no ejecutó la verificación; se esperó su finalización y se verificó después. En la preparación del comprobador se confirmó que el panel se integra en `InspeccionesPageV2` y no emite un chunk independiente; se verifican ese chunk y los reales de adendas/resumen del informe. Sin cambiar producto ni relajar sus expectativas. Advertencias AppleDouble de Git conservadas en evidencia, sin reparar otro checkout.

Preview detenido de nuevo a las **18:11:42 Mendoza** (`21:11:42.872721Z`), antes de migrar: `Running=false`, `Pid=0`, salida 143 por SIGTERM previsto, `OOMKilled=false`, límites intactos. No se iniciaron API, servidores estáticos, PostgreSQL, suites adicionales o túneles durante estos builds. Imagen, base artificial y evidencias conservadas.

Evidencia local ignorada **`test-results-deploy-c9cd877f/`**. Preview **`/opt/sitrep-qa-enterprise-20261016/source/.qa-release-c9cd877f-20261020/`**. Auditoría productiva privada en la carpeta indicada. Producto exacto **`c9cd877f`**, cierre posterior sólo documental **`[skip ci]`**. Sin push ni workflows; rama `codex/sitrep-training-20261018`, checkout único. **`main` conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`.**
