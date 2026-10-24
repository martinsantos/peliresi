# Publicación de elegibilidad, claridad y navegación

**b891e288879e19e03f57e27a88751badb514b168 publicado en backend, web, app y manual de sitrep.ultimamilla.com.ar el 23/10/2026 a las 21:30:00 Mendoza.** Sustituye bc0e103b. No modifica main ni ejecuta workflows.

## Alcance

Incluye los motivos de inelegibilidad por actor/cuenta en el formulario de manifiestos, preservación de los datos ingresados, claridad de agenda y aprobaciones, campana con historial y banner sólo para novedades, y navegación/espaciado coherentes entre Manifiestos e Inspecciones. No cambia las reglas de aprobaciones ni convierte documentos históricos.

Manual **2026.23.7**, service worker raíz **v164**, app **20261024002325**. La app ofrece actualización explícita; una sesión ya abierta puede conservar la versión anterior hasta aceptarla.

## Verificación

- Compilación remota serial de **2.509 archivos Git exactos**, verificados antes y después: backend, Prisma, tipos, web y app aprobados. API final y flags actuales. Contenedor existente, 1 CPU/2 GiB/swap adicional cero; sin OOM.
- Los **40 archivos de producto modificados** coinciden con los probados en preview. Evidencia dirigida: **68 unitarias de backend**, **178 de interfaz/manual**, **21 E2E únicos**, con **6 E2E repetidos** tras el ajuste final de scroll. Cero fallos, omitidos o flaky en los recorridos finales. Lint dirigido: 0 errores y 62 advertencias.
- Producción: smoke **187/187**, externo **9/9**, PWA **8/8**. Sólo solicitudes GET, sin logins ni mutaciones de negocio. Las rutas protegidas se verificaron sin autenticar (401); no se presentan como recorridos funcionales productivos.
- Backend con dos workers en línea. Configuración .env idéntica byte por byte, flags idénticos en archivo/procesos/estado guardado de PM2; Nginx, dependencias y esquema idénticos. Otros servicios conservados.
- **CAP cerrado, correos/push apagados.** No se enviaron correos/push desde las pruebas ni se crearon usuarios, manifiestos o aprobaciones reales. Sin migraciones, restauraciones de base ni cambios sobre documentos históricos. Los GET pueden actualizar contadores técnicos de admisión ya existentes.

## Respaldo y reversión vigente

- Backend: /var/www/sitrep-backend-releases/20261023-producto-b891e288
- Web, app y manual: /var/www/sitrep-releases/20261023-producto-b891e288
- Respaldo/evidencias privadas: /var/backups/sitrep/20261023-producto-b891e288
- Reversión preparada al backend **bc0e103b** y frontend /var/www/sitrep-releases/20261023-producto-b891e288-rollback, con SW **v165** y app **20261024002621** para invalidar cachés. No ejecutada.

Se conservaron las releases anteriores con sus hashes, se respaldaron .env y PM2 en privado y se preparó una copia de reversión del frontend/manual. No se tomó una copia nueva de base de datos porque no hay migración ni operación sobre registros.

Ante un fallo de esta publicación, ejecutar en el directorio privado de evidencia `node - rollback < publish-production.ts`. Ese script recupera los componentes previos manteniendo configuración, esquema, uploads e historiales; no restaurar bases ni usar reversiones antiguas.

## Evidencias y límites

Evidencia local en el workspace del hilo, carpeta **release-b891e288-20261023**: source-proof.json, qa-summary.json, build.json, stage.json, deployment.json, postflight.json, smoke.json, external-smoke.json, pwa-smoke.json y release-result.json. Los mismos cierres quedan en el directorio privado de producción. Los datos secretos de respaldo sólo permanecen en el servidor.

El control automático bloqueó primero la transferencia por identificación del preview; se aportó la referencia de infraestructura. La primera revisión de activación agotó su tiempo; se comprobó que no había locks, procesos de deploy ni publicación parcial antes de reintentar. No se eludieron bloqueos ni se hicieron activaciones concurrentes.

Las pruebas funcionales son de preview artificial, no de datos reales. No acredita Android físico, sensores GPS, capacidad sostenida ni toda la UI del producto. Los pendientes previos de concurrencia y validación física continúan abiertos. Main permanece c8402190edfc36b5e5d0dee1337c24bd1689420d; sin push ni workflows.
