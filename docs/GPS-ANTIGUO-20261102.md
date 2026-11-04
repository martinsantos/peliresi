# GPS individual · reintento de ubicaciones anteriores

Cambio preparado sobre `a2022361`, sin publicar. Una posición pendiente del viaje individual antes se guardaba sin hora de captura y podía reenviarse días después como si fuera actual. La reproducción aislada esperó 48 horas simuladas y mostró ese envío.

La cola nueva conserva en el dispositivo la hora informada por el sensor. Una lectura reciente puede reenviarse con la misma referencia. Para una lectura anterior, futura o sin hora, SITREP consulta el recibo exacto: si coincide, confirma que ya fue recibida sin hacer otro envío; si no puede confirmarla, conserva la entrada y explica que se debe consultar a soporte. Entrega y relevo no avanzan mientras quede esa incertidumbre. Los datos de colas antiguas sin fecha no se eliminan ni se consideran recientes por defecto.

Si otra pestaña cambia una entrada con la misma referencia durante la comprobación, la copia se conserva y se informa un conflicto. El panel distingue «Ubicación anterior confirmada» de un envío nuevo. El manual explica la diferencia.

## Comprobaciones y límites

- Trece comprobaciones dirigidas de la cola y dos del manual pasaron con datos y respuestas simulados; incluyen 16 tareas concurrentes, fecha desconocida, 48 horas, un 404, contenido distinto y cambios de sesión o pestaña. Las pruebas utilizan módulos TypeScript transpilados y stubs; no son la suite oficial.
- Con la API y PostgreSQL artificiales del laboratorio, la comprobación reconoció un punto anterior ya guardado sin reenviarlo, conservó un punto inexistente y uno de contenido distinto, y 16 tareas de la misma página produjeron un solo POST GPS. La acción posterior a la cola se simuló; no se probó la interfaz ni una transición real. El backend fue una compilación anterior con cinco módulos de `a2022361` transpilados superpuestos.
- El tipado dirigido de seis archivos pasó con stubs de dependencias, no es el tipado ni la compilación íntegros. Los nuevos tests de React/Vitest fueron escritos pero no ejecutados. No se validaron web/app integrales, service workers, Android físico ni personas usuarias.
- La hora de captura no se almacena en el servidor. Un envío que ya está en tránsito puede demorarse, y los clientes anteriores pueden seguir transmitiendo ubicaciones viejas; este cambio reduce el riesgo en el cliente actualizado, no lo elimina globalmente. La procedencia de puntos históricos y la compatibilidad entre dispositivos siguen pendientes.

El laboratorio se ejecutó con una CPU, 2 GiB, sin swap adicional, red externa ni puertos publicados. La auditoría comprobó dos manifiestos artificiales cancelados, dos puntos conservados, cuentas artificiales desactivadas, CAP cerrado y cero intentos de correo o suscripciones push. Quedó detenido. No se modificaron producción, datos reales, `main`, workflows, migraciones ni flags productivos.
