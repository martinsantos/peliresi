# Publicación de empresa, multirol y dos personas — 22/10/2026

> **Actualización de publicación:** esta tanda está incorporada en `6580c1ca`, publicado el 23/10/2026. Estado y reversión vigentes en [Publicación de producto y concurrencia](DESPLIEGUE-PRODUCTO-CONCURRENCIA-20261023.md). Las secciones inferiores conservan la evidencia histórica de su fecha.

## Estado publicado

**`a7f20d2f181adc2e30a1930d175efa831dfd4e05` publicado en backend, web, app y manual de `sitrep.ultimamilla.com.ar` el 22/10/2026 22:47:21 Mendoza.** Autorización del dueño: «Despleguemos a producción con test total», después de la revisión de una razón social con varios roles y máximo dos personas en total.

Empresa y multirol habilitados en ambos lados: `ENTERPRISE_ENABLED=true`, `ACTOR_MULTIROLE_ENABLED=true` y sus equivalentes Vite. Son los únicos cambios de configuración. No se vincularon cuentas ni se completaron actividades existentes por inferencia. Las actividades adicionales y la representación requieren las decisiones explícitas documentadas en el manual.

La entidad comparte **hasta dos personas en total, incluida la titular**, entre Generador, Transportista y Operador y todos sus establecimientos. Invitaciones vigentes reservan lugar. Tener más roles no aumenta el cupo; retirar una responsabilidad o un permiso no elimina automáticamente los otros. Los cambios de esta tanda están detallados en [la revisión funcional](MULTIROL-DOS-PERSONAS-20261022.md).

Rutas de uso: **Mi perfil → Mis actividades** para actividades propias; **Empresas y establecimientos → Personas autorizadas** para representación. Cada persona conserva su identidad y contraseña. El contexto elegido determina la actividad y la sede con que actúa.

**CAP cerrado; correos y push apagados.** Se conservaron `DISABLE_EMAILS=true`, `PUSH_MANIFEST_NOTICES_ENABLED=false`, VAPID vacío, SMTP sin contraseña y el cierre de ingreso directo CAP en `2000-01-01T00:00:00Z`. Propuestas, eventuales, adendas, certificados, autoridades por rol, relevos y GPS múltiple mantienen sus flags anteriores. `UPLOADS_DIR=/var/lib/sitrep-uploads` y su directorio privado hermano de borradores se conservaron.

## Pruebas repetidas sobre el commit final

Todo se ejecutó en el preview `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, serial, un worker, **1 CPU / 2 GiB / swap cero**. Las pruebas usaron un cluster PostgreSQL artificial nuevo en `/tmp/sitrep-preview-run/pg-release-a7f20d2f`, separado del cluster QA anterior, que permaneció detenido. Esquema exclusivo `multirole_people_20261022`; no hubo pruebas con cuentas o registros productivos.

| Comprobación | Resultado nuevo de esta publicación |
| --- | --- |
| Backend completo | **1.582/1.582 PASS**, sin omitidos. |
| Frontend completo | **1.862/1.862 PASS**, incluye los cuatro casos finales de alcance del representante; sin omitidos. |
| E2E de empresa, multirol y representación | **33/33 PASS**, 11 en escritorio, 11 en web angosta y 11 en `/app`; cero fallos, omisiones o reintentos. |
| HTTP de representación | **131 solicitudes PASS**, incluidas tres carreras concurrentes de invitaciones. |
| HTTP de cupo y altas | **133 solicitudes PASS**, tercera persona denegada en alta administrativa/aprobación G/T/O y rollback transaccional completo. |
| Empresa y multirol | **7 + 8 grupos HTTP PASS**: paginación de 215 empresas, alcance por sede, identidad compartida, aprobación independiente, revocaciones y conservación de manifiestos sintéticos anteriores. |
| Compilación | Backend, tipos efectivos, web y app PASS; build de producción separado de los bundles QA. |
| Capturas | **66 capturas** de esta ejecución; revisión directa de cupo/roles en app, manifiesto delegado en web y conciliación de datos en web angosta. |
| Auditoría QA | Cero intentos, envíos o cola activa de correo; cuatro alias CAP rechazados con 403; configuración de ambos procesos comprobada sin proveedores/push. |

La suite completa de frontend usó un margen de **15 segundos por caso sólo en el ejecutor QA** de 1 CPU, con la configuración funcional y las aserciones del proyecto intactas. No hubo fallos ni repeticiones en esta ejecución. No se vuelven a contar las pruebas históricas del informe anterior como pruebas nuevas.

Integridad: **2.444 archivos Git verificados antes y después del build**. La revisión detectó ocho scripts viejos de QA, no incluidos en el commit, en el directorio remoto; ninguno participó en las suites completas ni en la selección E2E. Se conservaron fuera del árbol de compilación, con sus hashes. Se verificó que no quedaran fuentes adicionales en backend, interfaz y arnés, ni archivos públicos adicionales. El manual se cotejó aparte, archivo por archivo, con el commit.

El cgroup registró 151 eventos `max` al recuperar memoria dentro del límite; **cero OOM y cero procesos terminados por OOM**. El preview se detuvo el **22/10/2026 22:43:59 Mendoza** después de cerrar API, frontend y PostgreSQL. Imagen, ambos clusters artificiales y evidencia preservados.

## Build y activación

API final: `https://sitrep.ultimamilla.com.ar/api`. `VITE_DEMO_MODE=false`, empresa/multirol verdaderos y los demás flags correspondientes a producción conservados. No se reutilizaron los bundles QA con `/api` relativa.

- Backend: `/var/www/sitrep-backend-releases/20261022-multirol-a7f20d2f`.
- Web/app/manual: `/var/www/sitrep-releases/20261022-multirol-a7f20d2f`.
- Los enlaces `/var/www/sitrep-backend` y `/var/www/sitrep` se cambiaron de forma atómica, backend primero, después de verificar los paquetes y la salud de ambos workers.
- Se recargó sólo `sitrep-backend` mediante PM2; no se administraron servicios ajenos. IDs 1/2, PIDs **725876/725891**, reinicios **40/40**, estables entre la verificación inicial y la posterior al smoke externo.
- Las 230 dependencias de runtime copiadas coincidieron con el lock; Prisma/RHEL y OCR verificados. No hubo instalación de dependencias en producción.
- Se conservaron assets anteriores para clientes ya abiertos y se publicó un worker nuevo: raíz **v158**, app **20261023014306**. El cambio de versión raíz es una transformación documentada del artefacto, sin modificar la fuente probada.
- `.env` anterior: `988d42eebd8fde9ad163db25f124a6680f6054849c6ce7c346f03ce284536872`. Nuevo: `b19526c365883d577d3cb5f82a9894d4b9f790b7a4a69831c6d2a77a8631811d`. El código de activación comprueba que sólo difieran las dos claves autorizadas; JWT, base, uploads, origen público y demás valores permanecen iguales.

**No hubo migración:** paquete, lock, esquema y árbol de migraciones coinciden con el release anterior. Las **28 migraciones del commit ya estaban aplicadas** y las tablas de empresa/representación estaban disponibles. La consulta previa se limitó a metadatos técnicos.

Manual **2026.22.7**, guía «Una entidad, varias actividades y dos personas», con seis pasos y sus imágenes. Renderer, CSS y directorio conservados. Disponible en [el manual publicado](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=entidad-actividades-representantes).

## Respaldo y smoke

Respaldo privado en `/var/backups/sitrep/20261022-multirol-a7f20d2f/`, incluido `.env`, estado PM2, índices de archivos de los releases y dump completo de la base. El dump **permanece en el servidor y no se descargó**:

- `trazabilidad_rrpp-before-a7f20d2f.dump`, **23,817,184 bytes**.
- SHA-256: `93d7acd03e9502dc7452c0a6ec357826faf3e14988902d7ce707e96af1032256`.
- Verificación: índice de archivo, presencia de esquema operativo y CAP, decodificación completa con `pg_restore --file=/dev/null`, repetición de hash y permisos privados. **No se ejecutó una restauración.**

Smoke productivo no mutante: **161/161**; verificación externa **9/9** y archivos públicos PWA **8/8**. Incluye health/live/ready, HTML web/app, chunks críticos, API protegida sin sesión, nuevas rutas de empresa e invitación, manual, manifest, workers, recursos ausentes 404 y asociación Android pública. Origen y configuración Nginx conservados. No hubo logins, consultas de filas de negocio ni operaciones sobre cuentas o manifiestos reales. Los GET y logs técnicos del servidor forman parte del smoke.

## Reversión vigente — preparada, no ejecutada

Vuelve a **712de167** en backend, web, app y manual, conservando la base y los uploads. Empresa/multirol vuelven a sus valores anteriores apagados; las demás funciones y guardas conservan sus valores. Los registros creados durante el uso de la nueva versión **no se borran ni se restaura una base**.

- Backend anterior: `/var/www/sitrep-backend-releases/20261022-comunicaciones-712de167`.
- Frontend de recuperación: `/var/www/sitrep-releases/20261022-multirol-a7f20d2f-rollback`; HTML y manual anteriores, assets compatibles preservados.
- Worker de reversión: raíz **v159**, app **20261023014611**, para evitar reutilizar la caché del release nuevo.
- Procedimiento preparado en el servidor: `node /var/backups/sitrep/20261022-multirol-a7f20d2f/publish-production.js rollback`.

Antes de ejecutarlo en otro momento, volver a verificar que ésta siga siendo la versión activa y que no exista una publicación posterior. El script valida integridad, configuración y servicios, recarga únicamente SITREP, verifica readiness y guarda PM2. Después corresponde repetir el smoke de la versión restaurada. **No usar los comandos de reversión históricos de otros releases.**

## Evidencia y límites

Artefactos locales ignorados por Git: `test-results-deploy-a7f20d2f/`, con `qa/summary.json`, suites completas, reportes HTTP/E2E, capturas, pruebas de fuente, build/manifiestos SHA-256, preflight, stage, backup, deployment, tres smokes, configuración final/estabilidad y cierre del preview. Las credenciales de producción y el dump no se copiaron a este directorio.

La validación comprende todas las unitarias configuradas y los E2E de la tanda de empresa/multirol/representación. No equivale a certificar todos los escenarios históricos de SITREP ni cobertura de código del 100 %. **Android físico, PWA instalada capturando enlaces y entrega externa de correos/push siguen pendientes**, como se había acordado. Se conserva la observación cosmética previa del encabezado de Transporte en escritorio; no se amplió el cambio de producto durante este despliegue.

Único checkout utilizado: `sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`. Main permanece en `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Sin push ni workflows; cierre documental con `[skip ci]`. Las publicaciones anteriores son antecedentes y no reemplazan el estado ni la reversión de este informe.
