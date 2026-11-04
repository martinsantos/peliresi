# Publicación de aprobaciones, avisos y agenda — 23/10/2026

**Publicado `bc0e103b1d218ea54a996a46deae7aa6c40cbd52` en backend, web, app y manual de https://sitrep.ultimamilla.com.ar el 23/10/2026 a las 18:46:58 de Mendoza.** Sustituye `6580c1ca`. El código funcional solicitado de `81c36219` está incluido, junto con las correcciones de compilación y de presentación descubiertas durante la aceptación.

## Qué se corrigió

La creación en origen había quedado fuera de las propuestas; la cobertura anterior también admitía el contrato de firma/recepción. No era un flag apagado. Ahora las nuevas propuestas requieren las decisiones explícitas de todas sus partes vinculadas: generador, transportista y operador cuando están asignados; generador y operador cuando realmente no hay transporte. Crear no equivale a aprobar. La API impide iniciar o retirar antes del acuerdo, y protege identidad, partes, modalidad, concurrencia y reintentos.

Los avisos llegan a las cuentas de las partes probadas y actualizan campana y agenda. Los íconos permanecen grises hasta la decisión y pasan a verde al aprobar. La agenda incluye borradores, empresas y responsables de la siguiente acción. El cambio a tratamiento sin transporte requiere confirmar que se quitan transporte, vehículo y chofer. La vista temporal explica que no sustituye la cuenta real.

También se publican Ayuda, etiquetas legibles de Monitor y Antecedentes integrado en Inspecciones. La revisión visual detectó un botón de aviso oculto y números de manifiesto recortados en móvil: ambos se corrigieron y se repitió la aceptación afectada.

## Evidencia ejecutada

- Preview aislado, un worker, 1 CPU / 2 GiB / swap 0: **293 unitarias backend y 191 frontend/manual**. Último ajuste visual: **33 unitarias repetidas**, no sumadas como pruebas únicas.
- **42 E2E únicos**: 21 de vista temporal, Ayuda, Monitor, agenda y avisos; 18 de creación/aprobaciones/manual; 3 de ciclo completo hasta certificados parciales/finales y descarga del mismo PDF por las partes. Escritorio, web de 360 px y app de 390 px. Sin fallos, omisiones ni flaky.
- Después del ajuste visual, **3 E2E adicionales de regresión**, uno por superficie, y revisión de seis capturas finales. Son repeticiones dirigidas, no 45 casos únicos.
- HTTP: creación por los tres actores, 0/3→3/3, unanimidad concurrente, rechazo/cancelación, intentos prematuros bloqueados, idempotencia y circuito sin transporte. Pruebas del contrato anterior separadas de la aceptación operativa.
- Fuente exacta de 2.496 archivos, backend/tipos/builds web/app y manual verificados. La batería funcional completa corresponde a `7166c0cc`; el candidato final sólo difiere en Toast, poller de avisos, presentación de agenda y la prueba visual correspondiente. Integridad y diferencia exacta documentadas en `qa-summary.json`.
- **64 tablas protegidas del preview sin cambios. Cero intentos y cero envíos de correo.** Entrega externa apagada.
- Producción: **182/182 smoke**, **9/9 externo**, **8/8 PWA**. Hashes de web/app/manual, rutas, asociación Android, assets, health y autorización sin token verificados. Dos workers nuevos online.
- Navegador real autenticado, sin cambiar datos: agendas de web y `/app` con 160 pendientes y 36 borradores; empresas/contexto visibles; actualización de versión activada; Monitor carga y explica “Certificación habilitada”. Sin errores de consola observados. Capturas bajo `test-results-approvals-release-20261023/production-visual/`.

## Guardas y límites

CAP cerrado. Correo/push apagados. `.env` byte a byte idéntico; flags, identidad de base, cuentas y uploads conservados. No migraciones, seeds, instalaciones, cambios en main, push Git ni workflows. Main permanece `c8402190edfc36b5e5d0dee1337c24bd1689420d`.

**El manifiesto real 2026-000197 NO fue convertido ni corregido retroactivamente:** permanece IN_SITU/BORRADOR del contrato histórico, sin marcador de propuesta. No se inventaron aprobaciones ni se le enviaron avisos retroactivos. Esta publicación corrige nuevas propuestas y su visibilidad; no acredita que los documentos históricos hayan pasado al circuito nuevo.

Las transiciones completas se ejecutaron en preview con datos artificiales. La comprobación productiva fue de lectura; no equivale a crear/aprobar/tratar un manifiesto real. La app se probó en perfiles móviles del navegador en preview y en su URL productiva; **Android físico, sensores y entrega real de correos/push no fueron probados**.

## Respaldo y reversión vigentes

Respaldo/evidencia: `/var/backups/sitrep/20261023-producto-bc0e103b`. Configuración/PM2 y árboles previos verificados antes de activar. No se realizó backup de DB porque no hubo migración ni operación de datos.

Backend activo: `/var/www/sitrep-backend-releases/20261023-producto-bc0e103b`. Web/app: `/var/www/sitrep-releases/20261023-producto-bc0e103b`. Manual **2026.23.4**, root worker **v162**, app **20261023214321**.

Reversión preparada y NO ejecutada: backend `6580c1ca` y frontend `/var/www/sitrep-releases/20261023-producto-bc0e103b-rollback`, worker **v163**. Conserva base y flags. Sólo ante fallo operativo, desde el directorio de respaldo: `node - rollback < publish-production.ts`. No usar reversiones históricas.

Reportes locales: `test-results-approvals-release-20261023/qa-summary.json`, `build.json`, `deployment.json`, `postflight.json`, `smoke.json`, `external-smoke.json`, `pwa-smoke.json`, `production-ui.json`. Evidencia adicional y capturas en el preview; runtime de QA cerrado al terminar. Las correcciones de documentación posteriores no cambian el hash del producto publicado.
