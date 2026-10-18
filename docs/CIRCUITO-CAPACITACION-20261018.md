# Circuito de capacitación — cuatro roles, tres decisiones y certificados

## Alcance de la corrección

El ensayo anterior verificó un caso iniciado por el generador, pero no la creación por el operador ni el circuito completo solicitado. La pantalla y la ruta de creación conservaban la restricción generador/administrador. El dueño solicitó corregirlo y demostrarlo con cuatro accesos CAP independientes.

En sesiones de capacitación autenticadas, cualquiera de los cuatro roles puede iniciar una propuesta ordinaria con destino fijo. Cada actor conserva su propia empresa; el administrador elige las tres. Crear no equivale a aprobar. Generador firma, transporte y operador aprueban desde sus respectivas cuentas. Cualquiera de esas tres partes puede rechazar con motivo. El administrador no reemplaza sus decisiones. El retiro requiere las tres aprobaciones. La propuesta, sus partes y sus decisiones permanecen en el historial.

Cada parte recibe un aviso interno que abre el caso. En Manifiestos, «Próximos retiros» lista los aprobados desde hoy, con fecha de Mendoza; incluye fechas futuras. Es una agenda informativa, no una reserva de capacidad ni una asignación automática.

El operador vinculado registra recepción, pesaje y tratamiento. Puede liberar parciales con cantidades, método, observación y firma; su suma no supera lo recibido. Después de Tratado puede liberar la disposición final, que incluye los parciales y requiere todas las adendas aprobadas. Cerrar no libera documentos automáticamente. Cada PDF conserva el contenido firmado y dice «CAPACITACIÓN - SIN VALIDEZ OFICIAL». Tras liberar el final, este ensayo conserva el expediente sin nuevas adendas ni cambios de sus revisiones.

Los casos preparados y los manifiestos anteriores mantienen su circuito. Operación real, reglas regulatorias, permisos operativos, correos, push y flags permanecen sin activarse. Sin migraciones, semillas, restablecimiento de datos ni cambio de contraseñas.

## Demostración sencilla

1. Cuatro teléfonos con los accesos CAP del equipo 1. Banda amarilla visible.
2. Operador: Nuevo → Generador 1, Y-CAP, 10 kg, Transporte 1, CAP001, Chofer ficticio 1, Operador 1, fecha de hoy. Compartir el número.
3. Generador, transporte y operador abren el aviso y aprueban desde su cuenta; generador firma. Los cuatro comprueban las tres decisiones. Para agenda futura, crear otro caso con fecha posterior.
4. Transporte retira, permite GPS y espera Sync. ADMIN: C3 → Hoy → mismo número. Verificar el envío y movimiento antes de entregar.
5. Transporte entrega. Operador recibe, pesa 10 kg y registra tratamiento; puede liberar un parcial firmado de 4 kg.
6. Practicar adenda y revisión independiente antes del final. Operador cierra y decide liberar el final firmado de 10 kg. Los cuatro descargan y reconocen el mismo expediente.

El manual conserva diseño y navegación. Las hojas privadas de impresión incluyen QR y claves; no se publican en Git ni en el manual.

## Validación y publicación

La preparación validó 1.130/1.130 pruebas de backend y 1.568/1.568 de frontend. Son baselines anteriores a los últimos ajustes de consulta de adendas, navegación, trazabilidad y SW: no se presentan como suites completas del artefacto final. Después pasaron 35 controles de backend (propuestas, certificados y adendas) y 56 de frontend (navegación, adendas, trazabilidad y SW), incluidos dos nuevos casos de redirección web/app. Todas las tareas pesadas corren serialmente en el preview, un worker, 1 CPU/2 GiB/swap cero.

El primer intento de navegador quedó bloqueado por la ventana de acceso directo ausente en el entorno del preview; se corrigió su configuración. El siguiente pasó creación por cuatro roles, avisos, aprobación, rechazo y agenda, pero detectó una pantalla vacía al abrir el viaje del transporte. La navegación se ejecutaba durante el render; se reemplazó por la redirección declarativa de React Router y se agregó una regresión específica. Se repite el recorrido completo sin quitar ninguna expectativa.

Resultado de preview: el circuito web completo pasó y la repetición de app pasó completa. No se presenta como una sola corrida 2/2: la primera corrida posterior a la corrección de navegación dio web aprobada y app fallida por esperar 5 segundos a una agenda cuyo refresco es de 15; la repetición de app con espera de 20 segundos dio 1/1. La expectativa sigue exigiendo el mismo manifiesto aprobado en la agenda de cada rol. Eventual con accesos directos y el recorrido exacto de la hoja: 2/2 (web/app). Manual: 3/3 (escritorio, web móvil, app).

Se revisaron capturas de creación por operador, retiro, documentos en app y los PDF descargados. Parcial de 4 kg y final de 10 kg con firma y marca escolar; la hora del PDF se fijó explícitamente en 24 horas de Mendoza y se verificó en el recorrido de app. GPS emulado por el navegador, con envíos reales al backend escolar y observación de dos posiciones en C3; no certifica el sensor físico ni Android.

La publicación todavía no está confirmada en este punto del documento. El cierre posterior debe registrar el commit publicado, pruebas reales del aula, las hojas y el estado final del preview.

## Rollback preparado

Se conservan como anterior exacto backend `/var/www/sitrep-backend-releases/20261018-direct-97c77be` y web/app/manual `/var/www/sitrep-releases/20261018-direct-97c77be`. Ante rollback de esta entrega, sustituir atómicamente los dos enlaces por esos releases, recargar sólo `sitrep-backend` y verificar ambos workers y salud. Conservar `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`, los flags y el `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`.

No restaurar la base, borrar prácticas ni cambiar contraseñas. El rollback retira el circuito nuevo de la interfaz; sus registros escolares se conservan. Main no se integra. Commits con `[skip ci]`, sin workflows.
