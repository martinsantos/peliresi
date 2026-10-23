# Vista temporal, Ayuda y Monitor — 23/10/2026

**Incluido en la publicación `bc0e103b`, 23/10/2026 18:46:58 Mendoza.** [Cierre vigente](DESPLIEGUE-APROBACIONES-20261023.md). Las pruebas y bloqueos descritos abajo son el historial previo; la tanda pasó la aceptación remota y quedó publicada con CAP/correos/push apagados.

## Alcance de esta tanda

Corrección de interfaz compartida por web y `/app`. Publicación solicitada por el dueño. No modifica permisos de backend, reglas, históricos, cuentas ni datos reales. CAP permanece cerrado; correos y push apagados; flags actuales conservados. Sin main, push ni workflows.

- **Vista temporal:** Nuevo Manifiesto explica el límite antes de montar el formulario. La persona responsable debe crear la propuesta desde su cuenta. Permite volver al administrador o consultar manifiestos. Las cuentas propias conservan su creación por rol. El rol de la banda temporal se adapta al ancho sin invadir el botón.
- **Ayuda:** diferencia las propuestas de tres partes de los borradores anteriores e in situ; la coordinación del retiro; recepción del pesaje; cierre de la emisión expresa de certificados; cambios por adenda y participación rechazada. Guardar una preferencia no habilita un canal de envío apagado.
- **Monitor:** nombres compartidos por listado, Historial y paneles. `CERTIFICACION_OPERADOR_V1` se presenta como **Certificación habilitada**; `CERTIFICADO_OPERADOR_V1` como **Certificado emitido**. Las aprobaciones individuales no se presentan como aprobación unánime. Los payloads estructurados se explican sin mostrar JSON técnico. Eventos desconocidos tienen un rótulo neutro, sin inventar una etapa. Hora sin cortes y explicación completa en el detalle.
- **Inspecciones / Antecedentes:** reemplaza el botón aislado «Cola de revisión / Volver a inspecciones» por las secciones permanentes **Expedientes** y **Antecedentes**. La selección se refleja en la URL y sigue los enlaces, la recarga y Atrás/Adelante. Los filtros de expedientes se conservan al alternar. Los avisos dicen **Ver antecedentes en Inspecciones**. El encabezado de antecedentes ya no dice «Por evaluar» al consultar otros estados; muestra el estado filtrado y el total. La vista de consulta explica que la administración decide. No se inventa un estado regulatorio ni se cambia quién puede abrir, evaluar o vincular.
- **Manual 2026.23.4:** guías de acceso temporal y Monitor actualizadas; renderer y diseño conservados. La captura histórica de CAP no supone que el acceso siga abierto.

## Evidencia de preparación

Preview aislado `76.13.234.213`, contenedor `sitrep-qa-training-20261018`, esquema artificial `proposal_operations_20261021`. Serial, un worker, 1 CPU/2 GiB/swap adicional cero. No se ejecutan suites pesadas en la Mac.

Antes de los últimos ajustes visuales: 49 pruebas dirigidas PASS, tipos y builds web/app PASS; lint dirigido PASS. Diez E2E completos en escritorio y web angosta. La variante app detectó una diferencia del selector del guion (banda temporal en dos líneas), corregida sin cambiar la expectativa de identidad ni habilitar escrituras. Primer intento del guion también buscaba un correo no visible en el botón; corregido para seleccionar su nombre accesible y verificar la identidad real devuelta por API. Evidencias iniciales conservadas.

La última tanda y auditoría deben completarse tras recuperar conexión al preview. **Este registro de preparación no afirma publicación ni validación final.** Android físico y notificaciones externas no se prueban en esta tanda. Evidencias locales: `test-results-ui-help-monitor-20261023/`.

La integración de Antecedentes se agregó después de esas pruebas. Revisión local liviana: sintaxis de los archivos modificados y `git diff --check` sin errores; **no sustituye unitarias, navegador ni builds**. Pruebas ampliadas para selección de sección, enlace desde un aviso con la pantalla ya abierta, Atrás/Adelante, recarga, filtros conservados, permisos de consulta y conteo por estado. El caso de navegador se incorpora a la misma matriz serial de escritorio, web de 360 px y app de 390 px. Pendientes de ejecución: el preview sigue agotando el tiempo de conexión SSH, también con acceso de red autorizado. Producción permanece sin cambios.

## Publicación preparada

Sólo cambian web, app y manual. El backend productivo continúa en `6580c1ca` y no necesita reinicio ni migración. Preparación de builds exactos desde Git con API final y flags actuales, respaldo verificado de archivos públicos y cambio atómico del enlace del frontend. Smoke final sólo GET públicos/protegidos sin sesión ni registros de negocio. El cierre debe agregar el commit publicado, pruebas finales, rutas de respaldo y rollback; no usar este apartado como confirmación de despliegue.
