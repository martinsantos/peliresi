# Ensayo de reversión parcial del corte SITREP

**Resultado: compatibilidad parcial en preview; no es una reversión productiva preparada.** Dos propuestas artificiales en origen se crearon con `bcf8861f`, cada una con la firma del generador y dos aprobaciones pendientes. El backend `8fb6277e` rechazó consultar ambas propuestas con 409 y no modificó sus eventos. Con backend, web y app de `17152d81`, transporte y operador abrieron sus avisos y aprobaron; el operador inició la coordinación y confirmó la recepción en origen. Al volver a `bcf8861f`, las tres partes pudieron consultar ambos expedientes recibidos y sus avisos.

En los dos casos se conservó la huella de la propuesta original, se comprobó una decisión por cada parte y no se creó viaje, tramo ni posición GPS. Los dos recorridos de navegador pasaron en escritorio y en la vista app a 320 px. Después del retorno al candidato se verificaron seis accesos autorizados y un aviso de coordinación por parte y expediente; otros dos recorridos de navegador abrieron esos avisos y mostraron nuevamente las tres aprobaciones. El correo se mantuvo deshabilitado y sin intentos o envíos; push estuvo apagado y los cuatro ingresos directos CAP fueron rechazados.

## Qué puede y qué no puede recuperarse

| Alternativa | Resultado y límites |
|---|---|
| Volver a `8fb6277e` después de crear una propuesta en origen versión 2 | **No es compatible:** el backend anterior rechaza esa propuesta. El ensayo sólo la consultó; no borró ni reescribió los datos. |
| Volver de `bcf8861f` a `17152d81` | **Reversión parcial ensayada:** esas dos propuestas conservaron su firma y pudieron completar las tres aprobaciones. Se pierden las aclaraciones de corredor GPS y el ajuste posterior del barrido de duración. En el proceso migrado con `NODE_APP_INSTANCE=migration-rehearsal`, esta última versión no inicia el barrido periódico. |
| Revertir un defecto del núcleo compartido por ambas versiones | No queda resuelto por este ensayo: `17152d81` conserva la mayor parte de los cambios posteriores a `8fb6277e`. Hace falta una estrategia adicional para ese tipo de fallo. |

No se probaron aquí otros estados históricos, adendas, certificados, GPS de viajes, múltiples dispositivos, sesiones abiertas ni actualización o reversión del service worker. Los service workers se bloquearon expresamente durante los dos recorridos de la reversión; las pruebas posteriores de reapertura no validan una actualización de PWA instalada. La app se ejecutó en Chromium, no en Android físico; tampoco se observó a personas usuarias. La prueba no mide capacidad productiva ni valida la compatibilidad completa de todos los datos.

## Procedencia y preparación del corte

Las fuentes del backend anterior y del candidato parcial se extrajeron de Git en carpetas aisladas del contenedor de preview y se compararon por SHA-256: 333 y 388 archivos, respectivamente, sin diferencias. Se reutilizaron las dependencias existentes mediante enlaces; no se instalaron paquetes ni se ejecutaron migraciones. Para arrancar esas copias se prepararon cuatro archivos auxiliares de catálogo vacíos y artificiales: no se probaron los padrones con ellos. La primera puesta en marcha falló antes de servir la API porque faltaban esos archivos; el intento quedó registrado y se repitió.

Las compilaciones y rutas de QA no son paquetes ni instrucciones de despliegue. Antes de una publicación siguen siendo necesarios un respaldo actualizado de la base y los adjuntos reales, la revisión autorizada de las aprobaciones históricas, un plan de reversión que cubra fallos del núcleo y la validación del servicio migrado y sus assets. No se usaron datos reales ni se modificaron producción, `main`, workflows, migraciones o flags.
