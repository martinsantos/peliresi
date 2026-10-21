# Revisión integral de circuitos y experiencia por rol

Estado: **revisión completada en preview, cierre 21/10/2026**, desde `7e8ffe0c` / producto previo `4b5c8bdd`. Resultado: backend **1430/1430**, frontend **1781/1781**, **369 casos E2E únicos**, **78 grupos HTTP**. Ver [evidencia y límites](REVISION-INTEGRAL-CIRCUITOS-20261020.md). Sólo preview, datos artificiales, CAP cerrado y correo/push externos apagados. Producción y `main` fuera del alcance; commits `[skip ci]`, sin push ni workflows.

## Resultado buscado

Cada usuario reconoce su trabajo pendiente, ejecuta la acción sin perder datos, entiende la confirmación y sabe quién continúa. Ningún aviso concede permisos ni sustituye una aprobación. Cada cambio tiene autor, fecha, estado, destinatarios y enlace al recurso correcto. Los originales, decisiones e históricos se conservan.

## Orden de ejecución y aceptación

| Bloque | Recorridos y contingencias | Evidencia necesaria | Estado |
| --- | --- | --- | --- |
| 1. Inventario y baseline | Rutas, roles, flags, estados, transiciones, tests existentes y brechas; suites unitarias completas backend/frontend. | Matriz trazable y reportes de baseline, sin confundirlos con pruebas finales. | Revisado |
| 2. Manifiestos y agenda | Creación, programación, aprobación por cada parte, rechazo, unanimidad, inicio, retiro, múltiples viajes, relevo, entrega, recepción, tratamiento y certificados. Fechas, duplicado de acción, permiso revocado, sesión vencida y desconexión. | Unitarias/API y recorridos reales web, web móvil y app; actor, próximo paso y agenda correctos. | Revisado; alcance y límites en el informe |
| 3. Adendas | Hallazgo declarado/observado, cantidades/corrientes, creación, observación, nueva revisión, aprobación/rechazo, versiones concurrentes, originales y efecto en cierre/PSIP. | Unitarias/API/E2E, decisiones trazables y bloqueo de cierre cuando corresponde. | Revisado; alcance y límites en el informe |
| 4. Avisos y correos simulados | Por etapa, destinatarios activos competentes, preferencia y verificación, campana, enlace, actualización en otra sesión, duplicados/reintentos, retiro de acceso, contenido sin notas privadas. | Render y cola simulados sin SMTP/push; IDs y destinatarios exactos; ninguna entrega real. | Revisado; alcance y límites en el informe |
| 5. Inspecciones PSIP | Alta/programación/reprogramación/asignación, calendario, visita/análisis, requerimientos, respuesta/descargo/subsanación, plazos, resolución/Legales, finalización/cancelación y cola desde hallazgos. Avisos al inspector y administraciones competentes. | Unitarias/API/E2E por rol; responsable visible, agenda y campana coherentes, sin exposición a otros sectores. | Revisado; alcance y límites en el informe |
| 6. ABM usuarios/actores | Alta directa/pública, consulta, edición, revisión, activación/baja lógica, duplicados, concurrencia, actor equivocado, móviles/choferes/documentos, ATM y electricidad. | Formularios sin pérdida de datos, errores junto al campo, confirmación recuperable y permisos backend conservados. | Revisado; alcance y límites en el informe |
| 7. UX por tarea | Transporte: viajes/GPS/entrega; Operador: recepción, diferencias, tratamiento/certificación; Generador: preparación, aprobación y seguimiento; Administración/Inspector: agenda, revisión, plazos y decisiones. | Capturas actuales por paso, controles funcionales, foco/teclado/contraste/zoom y ausencia de recortes. | Revisado; alcance y límites en el informe |
| 8. Cierre | Repetir tests afectados y suites completas sobre fuentes finales; builds web/app, manual, auditoría de datos/colas/flags y recursos. | Resultados exactos, bugs reproducidos/corregidos, límites y pendientes separados; SHA de producto. | Revisado; alcance y límites en el informe |

Cada bloque sigue: reproducir → registrar evidencia → prueba que falla → cambio mínimo → repetir → documentar. No se reemplaza una expectativa de negocio para hacer pasar la prueba. Los hallazgos nuevos se agregan a la matriz, con prioridad y vínculo a su caso.

## Decisiones de alcance

- Se preservan reglas regulatorias y autorización del backend. Un estado o requisito no implementado se registra explícitamente antes de decidir su incorporación.
- “Agendado” se contrasta con fecha prevista y próxima acción. No se agrega un estado regulatorio de adenda por inferencia.
- La propuesta de tres partes de capacitación se distingue del manifiesto operativo y sus flags. Los alias CAP permanecen revocados; las pruebas usan exclusivamente identidades artificiales del preview.
- Correo se verifica como intención, contenido y cola/reintento con transporte simulado. La familia puede ensayarse por unidad o en contexto QA controlado, sin activar proveedores ni permitir entregas reales.
- La línea visual de SITREP y del manual se conserva. Los cambios se justifican por un problema de tarea, comprensión o interacción observado; no se hace un rediseño genérico.
- El alcance son navegadores web y `/app`, con tamaños de escritorio y teléfono. No equivale a certificación física Android/iOS, sensores ni todos los proveedores eléctricos reales.

## Operación segura y continuidad

Checkout único del traspaso; rama `codex/sitrep-training-20261018`. Pruebas pesadas sólo en `76.13.234.213`, contenedor propio, una fase y un worker por vez, 1 CPU/2 GiB/swap cero. Esquema propio `circuit_review_20261020`; los esquemas anteriores se protegen con conteo y huella de filas. No resetear fixtures ni datos previos para ocultar fallos.

Los reportes, capturas originales y trazas de trabajo quedan en `test-results-circuit-review-20261020/` (ignorado) y su directorio equivalente remoto. Los hallazgos aceptados y los cambios de uso se incorporan al manual, con procedencia de capturas. Los comandos de preparación no se repiten sobre un esquema ya creado. El avance y los bloqueos se documentan antes de cualquier cierre o cambio de contexto.

## Resultado y continuidad

Se corrigieron trece grupos de problemas reproducidos, con pruebas antes/después y repetición de los recorridos afectados. El informe y el consolidado conservan fallos de producto, ajustes del ensayo, reportes interrumpidos y límites de lo comprobado por separado. El manual incorpora las acciones y destinatarios nuevos.

La propuesta ordinaria de tres partes permanece delimitada por CAP, cuyo acceso está cerrado; se comprobó su contrato por unidad. El circuito eventual operativo se probó en preview con sus flags habilitados. Ninguna pantalla cambia permisos regulatorios ni convierte un antecedente en infracción.

No quedan fallos abiertos en los casos de aceptación enumerados. Siguen fuera de esta aceptación la entrega real de correo/push, dispositivos físicos/segundo plano, todos los formatos reales de factura, la acreditación externa de ATM y las decisiones fiscales pendientes. No se promete ausencia universal de errores: los escenarios nuevos deben ampliar esta matriz y sus regresiones. La publicación requiere una nueva autorización.
