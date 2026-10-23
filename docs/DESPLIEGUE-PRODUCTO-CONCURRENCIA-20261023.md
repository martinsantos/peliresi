# Publicación de identidad, experiencia y concurrencia — 23/10/2026

## Estado vigente

**`6580c1ca0b55c7d5ad2ba5d404dd6e1b1699c6e8` publicado en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el 23/10/2026 14:21:27 Mendoza.** Autorización del dueño: «procede en produccion la totalidad de los fixs y mejoras, asap». Incluye toda la fuente acumulada desde `a7f20d2f`; no se seleccionaron sólo las últimas correcciones.

- Identidad unificada en web/app, encabezados, acceso, manual, favicon, iconos PWA, página offline, correos y PDF. Flecha y SITREP verdes sobre blanco. Cabecera PDF institucional con Mendoza/DGFA a la izquierda y SITREP a la derecha, proporcionada al correo; documentos extensos/paginación corregidos. Los documentos firmados existentes no se regeneran.
- Bienvenida por rol, ayuda contextual y orientación de formularios. Ayuda → Repasar mi rol permite abrir la bienvenida de nuevo. Configuración → Apariencia → Dónde abrir los enlaces guarda AUTO/WEB/APP por persona; conserva el destino autorizado tras login.
- Monitor distingue asignación/chofer y relevo vigente; no hereda la posición del transporte sustituido mientras espera la primera señal nueva. Ventana GPS con últimos 500 puntos, orden estable y punto más reciente conservado.
- Incidencia GPS única ante eventos concurrentes, admisión compartida entre workers por persona/familia y recuperación de sesión/formulario ante 429/503 temporales. No hay reenvío automático de escrituras por un 429.
- Manual **2026.23.3**, con guías de bienvenida/enlaces/ayuda, documentos, Monitor y reintento. El contenido y todos los assets del manual corresponden al commit publicado.

**CAP cerrado, correos y push apagados, flags actuales conservados.** `.env` idéntico byte por byte antes y después: `b19526c365883d577d3cb5f82a9894d4b9f790b7a4a69831c6d2a77a8631811d`. Se preservaron uploads en `/var/lib/sitrep-uploads`, borradores privados, credenciales, identidades, orígenes y configuración Nginx. No se consultaron filas de negocio ni se crearon sesiones o datos de prueba productivos.

## Preparación y validación

Última fuente productiva confirmada antes de preparar: `a7f20d2f181adc2e30a1930d175efa831dfd4e05`, dos workers online sin reinicios durante el preflight. Rama local `codex/sitrep-training-20261018`, único checkout autorizado. Main permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push ni workflows.

La validación funcional fue completada antes de esta autorización en preview:

| Alcance | Evidencia aprobada |
|---|---|
| Última suite completa backend | 1.653/1.653, sin omitidas |
| Regresión frontend final dirigida | 132/132, sin omitidas |
| Concurrencia API/base, dos procesos | 15/15 grupos |
| E2E de las correcciones | 12/12 casos únicos: escritorio, web móvil y `/app` |
| Identidad/ayuda anterior incorporada | 54 E2E de la revisión posterior; 22 secciones por superficie, 14 PDF/43 páginas, 198 escenarios de comunicaciones |
| Guardas QA | 64 tablas protegidas intactas, CAP cerrado, cero intentos/envíos/cola activa |

Son pruebas de preview, no nuevas pruebas ejecutadas sobre datos productivos. Las incidencias de los primeros guiones y sus repeticiones se conservan en [correcciones](CORRECCIONES-CONCURRENCIA-20261023.md) y [producto/identidad](PRODUCTO-IDENTIDAD-AYUDA-20261023.md). No se afirma que la suite completa frontend haya sido repetida sobre el último cambio.

Para publicar se recompilaron **backend, cliente Prisma, tipos, web y app** en el preview aislado `76.13.234.213`, una tarea a la vez, **1 CPU / 2 GiB / sin swap adicional**. Los **2.483 blobs Git** coincidieron antes y después; sin fuentes adicionales de compilación. Las 230 dependencias de runtime conservadas en producción coinciden con el lock, que no cambió. Motor Prisma RHEL y OCR verificados; ninguna instalación de dependencias en producción.

Builds nuevos con **`VITE_API_URL=https://sitrep.ultimamilla.com.ar/api`**, demo apagada y equivalentes frontend de los flags vigentes. No se publicaron bundles QA `/api`. Verificación de paquetes SHA-256 y de todo el manual antes de activar.

El build terminó `2026-10-23T17:15:44.739Z`; cgroup sin OOM ni procesos terminados por memoria. Hubo presión contra el límite (`memory.events.max=13737` acumulado al final); no es un ensayo de capacidad sostenida.

## Respaldo y migraciones

Respaldo privado en **`/var/backups/sitrep/20261023-producto-6580c1ca/`**, con configuración, PM2, inventarios de releases previos y dump completo. El dump permanece en el servidor; no se descargó ni se restauró:

- Archivo: `trazabilidad_rrpp-before-6580c1ca.dump`.
- Tamaño: **23,841,002 bytes**.
- SHA-256: `3f7a0975034ef8bdff78a22d750420c6093b26eebe92dfa5f43a2ae3e96606e0`.
- Verificado mediante índice, presencia de esquemas operativo/CAP, decodificación completa a `/dev/null` y hash repetido. Permisos privados.

Sólo después de esta verificación se ejecutó **`prisma migrate deploy`** sobre el esquema operativo:

1. `20261023120000_user_link_preference`: columna de preferencia AUTO/WEB/APP, valor inicial AUTO y restricción.
2. `20261023133000_shared_api_admission`: tabla técnica de contadores, clave hash, vencimiento con precisión milisegundo e índice.

**30/30 migraciones de la fuente aplicadas**; se verificaron los checksums de las 28 anteriores. Las 16 migraciones históricas aplicadas que no forman parte del árbol actual se conservaron sin alterarlas. Se cotejaron catálogos, restricciones, índices y el historial antes/después; ninguna consulta de filas de negocio.

El esquema CAP recibió exclusivamente el mismo SQL aditivo, en transacción y con su propietario restringido; sin inventar una línea base Prisma ni habilitar accesos. Estado final de ambos esquemas verificado. No hubo borrados, corrección de históricos ni operaciones de negocio.

## Activación y smoke

- Backend nuevo: `/var/www/sitrep-backend-releases/20261023-producto-6580c1ca`.
- Web/app/manual nuevos: `/var/www/sitrep-releases/20261023-producto-6580c1ca`.
- Cambio atómico de symlinks: backend primero, health/readiness y workers, luego frontend.
- Se recargó únicamente `sitrep-backend`. Workers 1/2, PIDs **834335 / 834350**, contador de reinicios **41/41** estable al terminar las comprobaciones externas. Se conservaron identidad y estado de los otros servicios.
- SW raíz **v160** (transformación documentada del artefacto desde v127); app **20261023171533**. Assets anteriores preservados para pestañas abiertas. Activación del worker mediante el mecanismo existente, sin borrar sesiones.
- Smoke desde el servidor: **182/182 PASS**. Smoke externo: **9/9 PASS**. Archivos públicos PWA: **8/8 PASS**.

El smoke usa GET, sin login, envío de formularios ni operaciones de negocio: salud/live/ready, HTML web/app, chunks críticos, bienvenida/configuración, resolver de enlaces, Monitor, API protegida sin sesión, manual/guías, iconos, manifest, workers, asociación Android pública y 404 de assets inexistentes. Los archivos servidos coinciden por hash con la entrega. Los GET generan logs y pueden incrementar los nuevos contadores técnicos de admisión; **cero mutaciones de negocio** no significa cero escrituras técnicas.

Accesos publicados:
- [Web](https://sitrep.ultimamilla.com.ar/login) y [app](https://sitrep.ultimamilla.com.ar/app/login).
- [Bienvenida, preferencia y ayuda](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=bienvenida-preferencia-ayuda).
- [Monitor y viaje vigente](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=monitor-viaje-vigente).
- [Reintento sin perder el formulario](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=resolver-espera-reintento).

## Reversión vigente — preparada, no ejecutada

Vuelve a **`a7f20d2f`** en backend, web, app y manual. Mantiene las dos migraciones aditivas, base, documentos, uploads y flags iguales. No restaura la base ni elimina registros.

- Backend: `/var/www/sitrep-backend-releases/20261022-multirol-a7f20d2f`.
- Frontend preparado: `/var/www/sitrep-releases/20261023-producto-6580c1ca-rollback`.
- SW de reversión: **v161**, app **20261023171832**.
- Procedimiento: `node /var/backups/sitrep/20261023-producto-6580c1ca/publish-production.js rollback`.

Antes de usarlo, confirmar que esta publicación siga vigente. El script verifica integridad/configuración, restaura el enlace, recarga únicamente SITREP y comprueba dos workers, readiness y frontend. La revisión corrigió un defecto heredado del procedimiento: ahora tolera workers SITREP fallidos/mezclados y vuelve a recargar en un reintento aunque el enlace ya señale el release anterior. Se comprobó estáticamente y con verificación sintáctica; **no se ejecutó una reversión productiva como prueba**.

SHA-256 del script final: `ed099a00fbbb7880e15ef6385c4a7cb350fc24e99dbbbf0102bd2cc809fc05af`. No usar los comandos de reversión de publicaciones anteriores.

## Pendientes y límites

La limpieza automática de claves abandonadas de admisión sigue pendiente. El control automático bloqueó incorporarla en la revisión anterior y no se eludió. El cierre de preview la señalaba antes de publicar; la revisión de esta entrega distinguió que la expiración/reutilización de claves funciona y está probada, mientras la poda es mantenimiento aún no incorporado. Con la autorización posterior del dueño de publicar la totalidad se entrega la corrección existente, dejando esta deuda visible. No se declara acotado el tamaño total de esa tabla ni se realizaron borrados.

Siguen pendientes carga sostenida, durabilidad del bus de eventos ante caída, tratamiento de hora de observación/reconexión GPS, optimización de agregados y simplificación de etiquetas técnicas en eventos de Monitor. Android físico, sensores GPS, PWA instalada/segundo plano, captura de enlaces por el sistema operativo y entrega externa no se certifican. Publicar estos cambios no equivale a un GO global ni a una interfaz perfecta.

## Evidencia y cierre

Artefactos locales ignorados por Git: `test-results-deploy-6580c1ca/`. Contiene preflight, prueba de fuente, build/paquetes/manifiestos SHA-256, stage, respaldo verificado (sólo metadata), migraciones/catálogos, despliegue, tres smokes y dos comprobaciones finales de estabilidad/configuración. No incluye dump ni credenciales productivas.

Preview previo permanece disponible en esta Mac por el túnel `http://127.0.0.1:4177`; no se eliminó ni se usaron datos reales allí. Cierre documental con `[skip ci]`, sin main ni workflows. El procedimiento `documenta` de PSICOLE no aplica: se usaron manual, rutas y scripts propios de SITREP.
