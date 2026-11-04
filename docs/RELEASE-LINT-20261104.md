# Release de Inspecciones: errores de lint y regresiones

## Alcance

Cambio separado, basado en `6d389fd280bb5ece319612b9c1a6cab11e058e37` (PR #44). El publicador del PR #45 ya se fusionó normalmente en `0d73f789e544dbad0ded767dec6a4ee115a6b57c`. Ninguno de esos hechos constituye una publicación del producto.

- Contratos tipados para lectura/firma del acta, acceso limitado y respuestas.
- Efectos con dependencias explícitas y estables: recuperación, cotejo de envíos, desplazamiento y mapa.
- Una actualización del expediente no reemplaza una respuesta en memoria cuando falla el almacenamiento local.
- Descargas de copias locales con URL ligada al montaje del enlace y liberación al cambiar o salir.
- Pruebas sin mutar variables externas durante render; conserva las aserciones de recuperación, audio y navegación.
- Rechazo de controles ASCII antes de normalizar destinos de regreso; conserva la validación de origen, rol y superficie.
- Limpieza de errores de sintaxis, variables reasignables innecesarias y eliminación de secuencias ANSI mediante la utilidad de Node.

No cambia estados de negocio, permisos, esquema, dependencias, flags, CAP, correos ni push. No modifica umbrales ni desactiva reglas de lint. No fusiona PR #44 ni prepara/publica un bundle.

## Validación

Laboratorio aislado, Node 20.19.6, un worker, 1 CPU / 2 GiB, sin swap adicional ni red externa. No se consultaron registros de producción ni se enviaron correos/push.

| Control | Resultado |
|---|---|
| TypeScript `tsc -b` | Aprobado, incluido el ajuste final de tests |
| Build web y app | Ambos aprobados |
| Lint crítico de Inspecciones (`--max-warnings=0`) | 0 errores, 0 advertencias |
| Lint global | 0 errores, 1.906 advertencias: **no pasa** el máximo de 596 |
| Suite completa Node 20, primera ejecución | 4.149 pruebas: 4.118 aprobadas, 31 fallidas |
| Reejecución de los siete archivos afectados, después de corregirlos | 102/102 aprobadas; incluye las 31 fallidas originales |
| Smoke de navegador, builds reales web y app | 2/2 aprobados con API artificial en loopback |
| Identidad del frontend probado | 1.858 archivos cotejados por hash, cero diferencias |

La suite completa y la reejecución no se suman como pruebas distintas ni se presentan como una única ejecución completa verde. No se retiraron aserciones. Los fallos corregidos correspondían al cruce de `ArrayBuffer` de DOM/Node 20, al nombre accesible vigente «Evidencias» y a esperar la recuperación asíncrona del formulario de soporte. El adaptador criptográfico usa el digest real, conservando las pruebas que rechazan adjuntos distintos de igual tamaño.

El smoke cierra y reabre Chromium con el mismo perfil, recupera nombre/tipo/texto de la presentación, simula un 503 y confirma que el reintento conserva el mismo comando. Comprueba ausencia de desborde y botón no tapado a 1.365, 393 y 320 px. Las únicas excepciones de red son dos URLs exactas de Google Fonts que no pueden cargar en un contenedor sin red; las capturas usan fuentes alternativas. Se inspeccionaron las capturas de escritorio y móvil. No valida tipografía remota, backend real, Android físico ni todo el recorrido de Inspecciones.

Evidencias locales del hilo: `release-lint-20261104/evidence/` (resultados completos, reconciliación de las 31 regresiones, inventario de lint, hashes y capturas); harness reproducible en `release-lint-20261104/qa/`. No usar este documento como autorización de release.

## Bloqueo global conocido

La referencia inicial tiene 30 errores y 1.964 advertencias, frente al máximo de 596. El tramo crítico de Inspecciones tiene 1 error y 58 advertencias, frente al máximo de cero.

Corregir los errores y el módulo crítico no basta para pasar el gate global. La deuda restante se distribuye en 1.141 advertencias de `frontend/cloud-qa`, 165 de tests y 600 de producto/configuración. Incluye 1.567 usos de `any`, además de variables sin uso y advertencias de efectos/refs de React. Esos archivos continúan incluidos en el control: no se excluyen para aparentar un resultado verde.

El CI de main permanece como requisito previo a preflight/prepare/publish. Después se requiere revisión del SHA exacto y del recibo con BUNDLE_SHA. Android físico y validación con usuarios no quedan validados por estas pruebas.
