# Pagos ATM y lectura eléctrica publicados — 20/10/2026

**Backend, web, `/app` y manual `a6a5c005e94aa68ee20b6f410313515f094cb897` publicados** en `sitrep.ultimamilla.com.ar` el **20/10/2026 a las 16:45:59 Mendoza** (`19:45:59.018Z`). El dueño autorizó ese commit, backup antes de migrar, CAP cerrado, correos/push apagados y flags actuales, sin main, datos reales ni workflows. Smoke final no mutante aprobado.

Incluye el [control de pagos y lectura eléctrica validado en preview](CONTROL-COMPROBANTES-ATM-Y-FACTURAS-20261020.md): reserva de identidad del pago antes de aprobarlo, protección frente a otra foto/alta/CUIT/año, retención de reserva e historia al reemplazar/retirar y OCR eléctrico con evidencia separada de HP/TEF. El OCR no acredita fondos ante ATM ni certifica todos los formatos reales de factura. No se cambió ninguna fórmula fiscal.

## Releases y configuración

| Componente | Release activo |
|---|---|
| Backend | `/var/www/sitrep-backend` → `/var/www/sitrep-backend-releases/20261020-pagos-electricidad-a6a5c005` |
| Web, app y manual | `/var/www/sitrep` → `/var/www/sitrep-releases/20261020-pagos-electricidad-a6a5c005` |
| Identificación pública | `/release.json`: `source`, `backendSource` y `manualSource` iguales al SHA autorizado |

Manual **2026.20.16**, CSS/renderer y diseño conservados por hash. SW raíz **v136**, app **20261020193942**. El commit conserva v127 en la fuente raíz; el artefacto publicado incorpora sólo la transformación de versión de caché, registrada antes/después por hash en `build.json`. La activación del service worker sigue siendo explícita para conservar borradores. Assets anteriores preservados para sesiones abiertas.

El `.env` anterior se copió byte por byte al release nuevo, modo 0600: SHA-256 antes/después **`618b3536e18b0d122e088a053b708b71bacc3f1c81375d4ac81b2f2cb6838a93`**. Configuración verificada en archivo, ambos workers y estado PM2 guardado:

- `UPLOADS_DIR=/var/lib/sitrep-uploads` y enlace histórico `uploads` conservados; no se abrieron ni movieron documentos.
- CAP cerrado con `TRAINING_DIRECT_LOGIN_UNTIL=2000-01-01T00:00:00Z`, sin logins ni reapertura de alias.
- `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío y contraseña SMTP ausente. Sin pruebas de entrega ni envíos externos.
- Enterprise, eventual, adendas, revisión de partes y multirrol false; relevos y GPS múltiple true en backend y Vite; demo false. Sin flags nuevos ni cambios al resto del entorno.

Se recargó exclusivamente `sitrep-backend`. Dos workers online, PID **568808 / 568823**, un reinicio previsto por worker (29 → 30). La comprobación posterior de las **16:47:44 Mendoza** conservó ambos PID y contadores. Otras aplicaciones PM2 y Nginx intactos. Estado PM2 guardado y configuración original anterior preservada.

## Respaldo verificado antes de migrar

Auditoría privada **`/var/backups/sitrep/20261020-pagos-electricidad-a6a5c005/`**, acceso root, directorio 0700. Copias privadas del `.env` y PM2 en esa carpeta, modo 0600, verificadas antes de activar.

Respaldo completo de la base anterior a la migración, terminado y verificado a las **16:43:52 Mendoza**:

```text
trazabilidad_rrpp-before-a6a5c005.dump
23.735.483 bytes
SHA-256 55a2e300216feda4950a34cec3f8c4ebb023788e81fa5161280e55bbf7871752
```

Se comprobaron formato custom, índice con tablas/datos operativos y CAP, decodificación completa hacia `/dev/null` y repetición del hash antes y después de migrar. El descriptor de entrada evita el EPIPE del procedimiento histórico. **No se restauró la base. Dump, `.env`, PM2 privado e índice de datos permanecen en el servidor**; sólo se recuperaron reportes filtrados, nunca datos de la base.

## Migración única y aditiva

Única pendiente: **`20261020180000_payment_identity`**, SQL SHA-256 **`dedb359b650598167610a0ffc334d0f879a5d3efa1fe1546903c70fa8cc1506e`**. Sin seeds, backfill, conciliaciones o actualizaciones de documentos/pagos históricos.

- `public`: `prisma migrate deploy` del release exacto, terminado a las **16:44:51 Mendoza**. Se verificaron los checksums de las **24 migraciones fuente anteriores** y se conservaron las **16 entradas históricas fuera del checkout**. No se repitieron migraciones antiguas ni se ejecutó `resolve`. `prisma migrate status` posterior correcto.
- `sitrep_training`: mismo SQL aditivo, dentro de transacción con `search_path` explícito, límites de bloqueo/tiempo y el principal restringido dueño del esquema. CAP no tiene historia Prisma: no se inventó un baseline ni se aplicó una cadena antigua. Su acceso permanece cerrado.
- Catálogos posteriores: tres tablas nuevas por esquema, 22 columnas y siete índices por esquema; tres claves primarias, dos claves foráneas con `ON DELETE RESTRICT` y el índice único final de eventos. La reserva única por clave de pago y la auditoría quedan disponibles en ambos esquemas. No se consultaron filas de negocio para validar.

No se identificó ni dimensionó el lote de comprobantes reales anteriores, respetando la restricción del pedido. **El control histórico queda activo**: los aprobados anteriores sin identidad legible requieren conciliación administrativa antes de confirmar pagos nuevos; sobre 500 pendientes por fuente hace falta un proceso por lotes, aún sin herramienta masiva en este producto. No se alteraron aprobaciones para eludir ese control. La fórmula R fiscal sigue pendiente de conciliación, sin cambios de importes.

## Compilación y artefactos

Compilación nueva del SHA autorizado en el preview aislado, fases seriales, **1 CPU / 2 GiB / swap cero**. **2.235 blobs** verificados antes/después. Backend TypeScript, tipos efectivos frontend, web y app PASS; API incorporada y comprobada en ambos paquetes **`https://sitrep.ultimamilla.com.ar/api`**, sin API QA. `memory.events`: max=0, oom=0, oom_kill=0.

Cliente Prisma generado desde el esquema canónico nuevo, SHA-256 **`f8121be5eae37a012c27b417fcb35200ad2bee7f425b4c7cc315b3b2cf510074`**, con motor RHEL/OpenSSL cargado y tres modelos nuevos verificados. **230 dependencias runtime** conservadas según lockfile, copia independiente sin instalación ni modificación del cliente anterior. Herramientas nativas `tesseract` con español, `pdftotext`, `pdftoppm` y `flock` disponibles en producción; no se subió ninguna factura para probarlas allí.

Archivos verificados por SHA-256 al preparar y antes de activar: **375 backend / 501 web-manual / 198 app / 14 cliente Prisma**. Manual idéntico al commit autorizado. Los paquetes transitaron por SSH; sólo contienen artefactos del preview. No se copiaron datos o credenciales productivas a otro entorno.

## Verificación publicada

| Control | Resultado |
|---|---:|
| HTTPS desde servidor, sólo GET | **95/95** |
| HTTPS externo desde la Mac, sólo GET y hashes | **9/9** |
| Assets PWA, MIME, asociación Android y 404 de JS inexistente | **PASS** |
| Health/live/readiness y dos workers estables | **PASS** |
| `.env`, flags, CAP, uploads y Nginx conservados | **PASS** |

Se comprobaron shells web/app, rutas PSIP/transporte/altas, chunks nuevos de altas/revisión/actor, service workers, precache, manual/guías y capturas, identificación del release y requisitos públicos: factura opcional en Generador/Operador, ausente en los requisitos del Transportista. Rutas protegidas sin token devuelven **401 antes de consultar registros**. **Cero logins, cero cargas de archivos y cero mutaciones de negocio en el smoke**. La asociación Android comprueba el archivo publicado; no certifica hardware ni GPS físico.

Aceptación funcional previa del mismo producto: **166/166 backend, 37/37 frontend, 11 grupos API, 3 grupos de volumen, migración final 3 grupos + diff vacío, 12/12 navegador nuevo, 15/15 regresión de comprobantes y 21/21 manual**. En esta publicación se recompiló con la API final y se verificaron artefactos/smoke; no se repitieron suites globales ni se hicieron recorridos autenticados sobre datos reales.

## Reversión preparada, sin ejecutar

```sh
ssh root@23.105.176.45 'node /var/backups/sitrep/20261020-pagos-electricidad-a6a5c005/publish-production.js rollback'
```

**Sólo revierte la interfaz y el manual**, desde `/var/www/sitrep-releases/20261020-pagos-electricidad-a6a5c005-rollback`, a su versión previa `2200e955` / manual **2026.20.15**, con assets de ambas versiones, SW raíz **v137** y app **20261020194343**. **Conserva el backend `a6a5c005`, tablas, reservas y auditoría**. Mantiene `.env`, CAP, flags, uploads y canales apagados; comprueba readiness y guarda PM2. La copia y sus hashes se verificaron antes de activar; no se ejecutó la reversión.

No volver automáticamente al backend `2200e955`: ignora las reservas y reabriría la posibilidad de reutilización. Tampoco restaurar la base ni borrar tablas para deshacer UI. En contención, la interfaz anterior no permite identificar pagos nuevos; el backend mantiene su bloqueo de aprobación hasta corregir la interfaz. Una falla del backend requiere una corrección compatible con este control, no un downgrade ciego.

## Incidencias y cierre

Publicación completada en la primera pasada de preparación, respaldo, migración y activación. Se reutilizaron los procedimientos anteriores, adaptados al esquema nuevo y a una reversión que conserva el control de pagos. El `--list` del backup usa descriptor desde el primer intento; comparación de procesos conserva PID ausente del demo detenido. No se relajaron expectativas ni se modificó producto para publicar. Los avisos AppleDouble de Git se conservaron en evidencia; no se reparó el checkout SDTERA.

Preview detenido el **20/10 a las 16:43:41 Mendoza** (`19:43:41.290Z`), antes de migrar: `Running=false`, `Pid=0`, salida 143 por SIGTERM previsto, `OOMKilled=false`; límites intactos. Imagen, base artificial y evidencias conservadas. No se iniciaron suites, API QA ni túneles para estos builds.

Evidencia local ignorada: `test-results-deploy-a6a5c005/`. Preview: `/opt/sitrep-qa-enterprise-20261016/source/.qa-release-a6a5c005-20261020/`. Auditoría productiva privada en la carpeta indicada. Producto exacto **`a6a5c005`**, cierre posterior sólo documental **`[skip ci]`**. Sin push ni workflows. Rama `codex/sitrep-training-20261018`, checkout único; **main conserva `c8402190edfc36b5e5d0dee1337c24bd1689420d`**.
