# Vista temporal, Ayuda y Monitor — 23/10/2026

## Alcance de esta tanda

Corrección de interfaz compartida por web y `/app`. Publicación solicitada por el dueño. No modifica permisos de backend, reglas, históricos, cuentas ni datos reales. CAP permanece cerrado; correos y push apagados; flags actuales conservados. Sin main, push ni workflows.

- **Vista temporal:** Nuevo Manifiesto explica el límite antes de montar el formulario. La persona responsable debe crear la propuesta desde su cuenta. Permite volver al administrador o consultar manifiestos. Las cuentas propias conservan su creación por rol. El rol de la banda temporal se adapta al ancho sin invadir el botón.
- **Ayuda:** diferencia las propuestas de tres partes de los borradores anteriores e in situ; la coordinación del retiro; recepción del pesaje; cierre de la emisión expresa de certificados; cambios por adenda y participación rechazada. Guardar una preferencia no habilita un canal de envío apagado.
- **Monitor:** nombres compartidos por listado, Historial y paneles. `CERTIFICACION_OPERADOR_V1` se presenta como **Certificación habilitada**; `CERTIFICADO_OPERADOR_V1` como **Certificado emitido**. Las aprobaciones individuales no se presentan como aprobación unánime. Los payloads estructurados se explican sin mostrar JSON técnico. Eventos desconocidos tienen un rótulo neutro, sin inventar una etapa. Hora sin cortes y explicación completa en el detalle.
- **Manual 2026.23.4:** guías de acceso temporal y Monitor actualizadas; renderer y diseño conservados. La captura histórica de CAP no supone que el acceso siga abierto.

## Evidencia de preparación

Preview aislado `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, esquema artificial `proposal_operations_20261021`. Serial, un worker, 1 CPU/2 GiB/swap adicional cero. No se ejecutan suites pesadas en la Mac.

Antes de los últimos ajustes visuales: 49 pruebas dirigidas PASS, tipos y builds web/app PASS; lint dirigido PASS. Diez E2E completos en escritorio y web angosta. La variante app detectó una diferencia del selector del guion (banda temporal en dos líneas), corregida sin cambiar la expectativa de identidad ni habilitar escrituras. Primer intento del guion también buscaba un correo no visible en el botón; corregido para seleccionar su nombre accesible y verificar la identidad real devuelta por API. Evidencias iniciales conservadas.

La última tanda y auditoría deben completarse tras recuperar conexión al preview. **Este registro de preparación no afirma publicación ni validación final.** Android físico y notificaciones externas no se prueban en esta tanda. Evidencias locales: `test-results-ui-help-monitor-20261023/`.

## Publicación preparada

Sólo cambian web, app y manual. El backend productivo continúa en `6580c1ca` y no necesita reinicio ni migración. Preparación de builds exactos desde Git con API final y flags actuales, respaldo verificado de archivos públicos y cambio atómico del enlace del frontend. Smoke final sólo GET públicos/protegidos sin sesión ni registros de negocio. El cierre debe agregar el commit publicado, pruebas finales, rutas de respaldo y rollback; no usar este apartado como confirmación de despliegue.
