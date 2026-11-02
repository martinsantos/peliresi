# SITREP — cierre vigente de publicación (2 nov 2026)

## Referencia activa

El corte de partida comprobado el 2/11 a las 17:05 UTC es `5c1aad1b484a9bf4b845ea77bc62edb7980e031b` (padre `7ae24feb89706f09137804139c7f9fc64db526ce`). Identificar cualquier publicación posterior por `/release.json`, sus huellas y su informe de ejecución; la rama de preparación `codex/sitrep-ops-preview-2h-20261102` no acredita por sí sola publicación ni pruebas. El commit y árbol de partida están íntegros en el repositorio bare de recuperación `recuperacion-integral-20261102/repositorio-restaurado.git`. El responsable preservó el SHA exacto en la rama remota `codex/sitrep-release-5c1aad1b-20261102` y la etiqueta `sitrep-production-2026-11-02-5c1aad1b`. La consulta de API que antes devolvió HTTP 422 (“No commit found for SHA”) quedó supersedida por esa preservación HTTPS. Las refs remotas verificadas son snapshots del 2 nov: `main=e8b38ac3f68afcd59d6ed93eedf42b33f543d61f`, `codex/sitrep-training-20261018=ca6b1626bf8b805b1e149b94421bfe8eaed523df`, UI/UX y manifiestos comparten `222ccbbfd87cb8d34db2379e1a307fd3dfb9d726`. `main` es una línea independiente.

## Servicio y rutas actuales

| Superficie | Ubicación activa confirmada |
|---|---|
| Backend | `/srv/umsa-clean-apps/sitrep-backend`, unidad `umsa-clean-sitrep-backend.service` |
| Web, PWA y manual estáticos | `/srv/umsa-clean-proxy/static/sitrep` |
| Ingreso Nginx | `/srv/umsa-migration/sitrep-public-ingress/40607817805-1/nginx.conf` |
| Identidad de corte | `https://sitrep.ultimamilla.com.ar/release.json` |

`/var/www/sitrep` y `/var/www/sitrep-backend` son rutas históricas; no usarlas para identificar ni preparar el despliegue actual. El corte se hizo el 2 nov a las 17:05 UTC. No cambió `main`, no corrieron workflows ni migraciones, no se enviaron correos/push ni se hicieron operaciones autenticadas sobre registros reales.

## Procedimiento de publicación que quedó evidenciado

La preparación concreta y los hashes esperados están en `continuidad-gps-20261102/activar-release-5c-v2.py` y `resultado-despliegue-5c-v2.json`. Antes de cualquier release nuevo: partir de un commit candidato inmutable y artefactos construidos/probados para ese mismo SHA; identificar las rutas activas mediante el ingreso migrado y `/release.json`; comprobar espacio, permisos, unidad y configuración, y confirmar que los backups nuevos no existen; preservar configuración y secretos sin volcarlos al log. Respaldar primero la base cifrada y validar descifrado e índice, sabiendo que no cubre roles globales ni adjuntos externos; respaldar por separado `dist` activo y todo el árbol estático servido. Mantener identificadores y hashes de copias verificables fuera del servidor.

Durante el cambio, pausar trabajos de fondo con el drop-in temporal `SITREP_PAUSE_BACKGROUND_JOBS=true`, recargar systemd y detener la unidad. Mover `dist` anterior a `dist-<sha-anterior>-respaldo-<fecha>` y colocar el nuevo `dist`; intercambiar atómicamente el árbol `static/sitrep` con el candidato preparado mediante `renameat2(RENAME_EXCHANGE)`, conservando el árbol desplazado como respaldo. Arrancar la unidad, comprobar PID/`/api/health/live` y ejecutar el smoke de solo lectura mientras la pausa sigue activa. Retirar el drop-in, recargar systemd, reiniciar y repetir el smoke; cotejar hashes de configuración y release. El resultado 5c pasó 14 checks locales pausados y 14 tras reanudar, más 15 checks externos de recursos, con reversión no intentada.

Si alguna comprobación falla, detener la unidad, intercambiar de vuelta el árbol web y restaurar el `dist` previo desde sus respaldos; retirar el drop-in, recargar systemd, arrancar y verificar nuevamente servicio y hashes del estado previo. El script implementa esa reversión y registra su resultado. No borrar backups ni declarar reversión completa hasta que ambos árboles y el servicio vuelvan a coincidir con sus huellas conocidas. Este runbook describe lo probado para 5c; antes de reutilizarlo, actualizar candidato, huellas, nombres de respaldo y smoke para el nuevo release. No habilitar migraciones, correo/push o tareas con posibles efectos sobre datos reales por inferencia.

## Topología del checkout habitual (solo clasificación)

Checkout de lectura `/Users/santosma/.codex/visualizations/2026/09/24/01a0d460-1c47-70f1-b7bf-4ea3463f0746/sitrep-production-source-20261001`, rama `codex/sitrep-training-20261018`, HEAD `21faea396bf31a9cca39185e980ea62582d37d02`. El release preservado contiene 464 commits desde `8fb6277e`; las líneas divergen y el diff de árboles es de 201 archivos. No equiparar commits/archivos con funcionalidades faltantes: parte del historial tiene SHA distintos para cambios equivalentes, QA y documentación. No hacer merge masivo. Los ocho cambios del worktree quedan clasificados así:

| Archivo | Clasificación frente a 5c | SHA-256 local | SHA-256 publicado |
|---|---|---|---|
| `backend/src/__tests__/controllers/gpsAnomalyBoundary.test.ts` | Anterior/difiere | `a873501f0e8310e3ae15d254029336d106a0b49f73eceede8e61c51a23ef8fcc` | `cb36451ed33853729252e8832617046cfcc4dc9eb40843085e8d7116133a609e` |
| `backend/src/__tests__/controllers/transportHandoffAccess.test.ts` | Anterior/difiere | `8969f0fa25bd6c209c26c7f1c569ffdcb3306f0eccf8d3eb46c8f4cc67731f10` | `0491b498be9f88d4c5bd63bc7f64fec0b92be5dddc9994e85dabd288381814d7` |
| `backend/src/controllers/manifiesto-gps.controller.ts` | Anterior/difiere | `e2a1cddf943b06df6ee46947711c3868c4081d48ab396b7dee0a684bcb07d4d9` | `2f6008b86fd78074d12514e03abc5d485b8eaf8a08a97cd3df3d32fa921b63df` |
| `backend/src/controllers/notification.controller.ts` | Anterior/difiere | `1ba702748bf2b9bfc71656dfb3ab22e68ebf29bbea6edd9e4025d337eef14e39` | `45d4ea7041ae028a3c82f218484f853c2850e9439b6482b767aca55c2a370ea7` |
| `backend/src/controllers/transport-handoff.controller.ts` | Anterior/difiere | `aa068c4010e8f31136519d0d148a4c1fe0e7ecb8899e06d7d8df762792f09769` | `87da23904f43bb05ba888adb9a3062630729dc4869c4a184e11ac60fd76dea33` |
| `backend/src/__tests__/services/gpsReceptionObservations.test.ts` | Idéntico | `02087e7afe38e83706b74d8c48c9f8326f50a617dfd6153c31362190daf87bf1` | Igual |
| `backend/src/services/gpsReceptionObservations.service.ts` | Idéntico | `6bb95146e870761f419da2ae86045702ba2251d50bb952dbe8ebd8215e75c417` | Igual |
| `frontend/cloud-qa/gps-reception-segments-isolated.ts` | Sólo arnés QA, ausente del release | `c95a90f77ce01d5d5457d364edae6cc17e942ba4be1b3aec22e63d9f771c3eca` | — |

La clasificación y comparación de bytes proceden de la auditoría conservada y una lectura directa contra el bare repository. El release incluye correcciones posteriores en los cinco archivos que difieren; conservar los WIP tal cual, no copiarlos encima.

## Pendientes que afectan a operación

La reserva de espacio libre de 7 GiB sigue siendo un impedimento real para generar o conservar otra copia de respaldo que la cruce. No reducir esa reserva ni tocar espacio o archivos de otros proyectos; planificar capacidad aparte antes de otra operación de backup.

1. La rama y la etiqueta del corte de partida quedaron preservadas. Mantener una referencia del próximo candidato probado y cotejar sus paquetes antes de publicarlo. La preservación remota no actualizó `main`, no ejecutó workflows y filtró YAML de `main`/`master` y ramas ajenas.
2. Resolver el planificador: el servicio observa `NODE_APP_INSTANCE=migration-rehearsal`; las familias de recordatorios condicionadas a instancia `0` no se registran. Definir liderazgo/idempotencia y pruebas en runtime antes de activarlo, pues podría avisar sobre casos actuales.
3. Completar una restauración aislada de base, adjuntos y configuración; demostrar respaldo automático completo. No consultar ni alterar datos reales como parte de este cierre.
4. Mantener límites de regresión documentados: GPS histórico no conserva captura del sensor ni unidad de velocidad versionada; efectos del EventEmitter no son una outbox durable universal. Pendientes humanos: dispositivo Android físico y capacitación simultánea con personas.

## Referencias de preservación y nombres posteriores

- Rama de preservación creada: `codex/sitrep-release-5c1aad1b-20261102` (SHA exacto verificado).
- Tag anotado creado: `sitrep-production-2026-11-02-5c1aad1b`, referido al mismo SHA completo.
- Próximo release: `codex/sitrep-production-<sha7>-<yyyymmdd>` y `sitrep-production-<yyyy-mm-dd>-<sha7>`

La rama y la etiqueta identifican el corte de partida desplegado; no mueven `main`. Una nueva rama de preparación no reemplaza esa evidencia hasta tener publicación verificada. El encabezado de este cierre remite a `/release.json` para evitar confundir el antecedente con una publicación posterior.
