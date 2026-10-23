# Crear manifiesto: identificar la parte que no puede aprobar

Corrección validada sólo en preview el 23/10/2026. No publicada. Producción permanece en `bc0e103b`; no se modificaron cuentas, manifiestos ni configuración reales.

## Problema y comportamiento corregido

El servidor rechazaba la creación con un mensaje común para cualquier actor o cuenta inactivos, sin identificar qué campo requería atención. Los catálogos no informaban la disponibilidad de la cuenta para aprobar y el formulario sólo mostraba un aviso general al final.

- Catálogos y validación final comparten el diagnóstico: actor no encontrado, actor inactivo, cuenta faltante o cuenta inactiva.
- La respuesta identifica rol y razón social de cada parte afectada; los detalles internos de errores continúan ocultos en producción.
- La selección muestra su estado. El campo indica el motivo y la intervención necesaria antes de enviar. La compatibilidad de residuos se denomina «compatible», sin confundirla con una cuenta habilitada.
- Si cambia una cuenta después de elegirla, el servidor vuelve a comprobarla. El formulario enfoca el campo correcto y conserva residuos, cantidades, actores y observaciones.
- «Actualizar estados» consulta nuevamente los catálogos. No reactiva cuentas, no crea manifiestos ni envía automáticamente el formulario. Un fallo de red con datos anteriores en caché conserva el rechazo; mientras consulta, los campos quedan bloqueados para evitar resultados aplicados a otra selección.
- Eventuales deja de sugerirse como solución genérica para una cuenta registrada inactiva.

El manual incorpora el paso «Resolver una parte que no puede aprobar», con clave de contenido `2026.23.5` en sus tres entradas.

## Verificación

| Comprobación | Resultado |
|---|---|
| Backend: elegibilidad, propuestas existentes y manejo de errores | 68/68 PASS |
| Formulario, vista temporal y manual | 30/30 PASS |
| Navegador: escritorio 1440×900, web móvil 360×800 y app 390×844 | 3/3 PASS |
| Compilación backend, tipos frontend, builds web/app | PASS |
| Lint dirigido de formulario, utilitario y pruebas | 0 errores; 32 advertencias |
| Consola E2E | Sólo HTTP 400 intencional del rechazo; cero excepciones de página |

Cada E2E usa cuentas artificiales dedicadas, un catálogo real y el backend real del preview. Comprueba bloqueo anticipado sin POST, cambio de estado posterior a la selección, rechazo 400 sin insertar manifiesto, recuperación sin perder datos y creación posterior en PENDIENTE_APROBACION. Se inspeccionaron capturas de escritorio y app.

Primer pase: 3/3. Una repetición falló porque el guion buscaba dos actores sintéticos con el mismo nombre; se conservaron traza/captura y se corrigió la identidad del fixture con un nombre único. Pase final: 3/3, sin reintentos ni omitidos. No se suman repeticiones como cobertura adicional.

## Seguridad y alcance

Preview `76.13.234.213`, contenedor existente `sitrep-qa-training-20261018`, 1 CPU / 2 GiB / swap adicional cero, un worker. La guarda detectó un límite efectivo de swap distinto del configurado y bloqueó el build; se reaplicó el límite y la guarda pasó sin modificarla.

Base artificial `sitrep_night_qa_20260926`, esquema `proposal_operations_20261021`. CAP cerrado, correos/push apagados, credenciales de entrega externa vacías. El navegador bloquea solicitudes a los dominios productivos. Sin migración, producción, main, push Git ni workflows.

Backend y servidor web de esta prueba se cerraron el 23/10/2026 a las 19:47:29 Mendoza, sin terminación forzada; se conservan base y evidencias.

Esta corrección no cambia cuántas aprobaciones requiere cada modalidad, no convierte documentos históricos y no acredita el ciclo de aprobación de un manifiesto real. Tampoco acredita Android físico o una PWA instalada.

## Evidencias conservadas

Directorio local de este hilo:

`/Users/santosma/.codex/visualizations/2026/10/17/01a14c11-b01f-7b40-87c5-1672e1d92833/manifest-eligibility-20261023`

- `backend-unit.json`: 68 pruebas.
- `final/frontend-unit.json`: 30 pruebas.
- `final/eligibility-e2e.json`: resultados del pase final.
- `final/eligibility-e2e/`: capturas, consola y prueba de recuperación por superficie.
- `final/fixture-runtime-attestation.json` y `final/closure.json`: controles efectivos y cierre.
- `source-files-final.json`: SHA-256 de los 16 archivos de código/manual probados.
- `browser-repeat-failure.tar.gz`: fallo de identificación del guion, conservado.

Una publicación futura debe usar estos fuentes probados, generar bundles con la configuración productiva y conservar los flags vigentes; los bundles QA usan `/api` y no son un paquete de despliegue.
