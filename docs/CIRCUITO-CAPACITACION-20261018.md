# Circuito de capacitación — cuatro roles, tres decisiones y certificados

> Este documento conserva la entrega histórica `930d3e6`. El estado vigente, el inicio explícito, los avisos proactivos, las certificaciones y el cierre GPS corregido están en [AFINADO-CAPACITACION-20261018.md](AFINADO-CAPACITACION-20261018.md) sobre `312d6f2`.

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

Los resultados de la publicación se registran a continuación; no se confunden las corridas de preview con las del dominio final.

## Rollback preparado

Se conservan como anterior exacto backend `/var/www/sitrep-backend-releases/20261018-direct-97c77be` y web/app/manual `/var/www/sitrep-releases/20261018-direct-97c77be`. Ante rollback de esta entrega, sustituir atómicamente los dos enlaces por esos releases, recargar sólo `sitrep-backend` y verificar ambos workers y salud. Conservar `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`, los flags y el `.env` SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`.

No restaurar la base, borrar prácticas ni cambiar contraseñas. El rollback retira el circuito nuevo de la interfaz; sus registros escolares se conservan. Main no se integra. Commits con `[skip ci]`, sin workflows.


## Publicación — 18/10/2026, 19:49:28 Mendoza

Backend, web, app y manual publicados sobre **`930d3e6ae7c363789d5474d4aa40b4242b860825`** en `sitrep.ultimamilla.com.ar`. Rama `codex/sitrep-training-20261018`; main sigue en `c8402190edfc36b5e5d0dee1337c24bd1689420d`. Commit con `[skip ci]`, publicación por SSH y sin workflows.

Build serial en preview: backend, web y app correctos; 2.112 fuentes Git verificadas antes/después. Backend 351 archivos, web 244 y app 187, comprobados por SHA-256 al preparar y activar. Manual estático final 16/16; se actualizan cuatro archivos del manual y se conserva el diseño, las capturas y los demás contenidos. API final `https://sitrep.ultimamilla.com.ar/api`, todos los flags frontend false. SW raíz **v120** y app **20261018224742**.

Smoke público **44/44**: salud, web/app, assets, service workers, manual y asociación Android. Esa asociación no acredita un dispositivo Android. Dos procesos backend online después de la recarga (PIDs 429802/429817, contador de reinicios 21). Se reutilizaron 230 dependencias de runtime verificadas y el cliente Prisma con esquema idéntico, sin instalar paquetes ni ejecutar migraciones.

`.env` conservado exactamente: SHA-256 `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`. `UPLOADS_DIR=/var/lib/sitrep-uploads`; cinco flags operativos false, revisores excepcionales vacíos, correos apagados y claves VAPID vacías. Cuatro contraseñas simples sin cambios, fuera de Git. Vencimiento del aula: `2026-10-20T03:00:00Z`, al terminar el lunes en Mendoza.

| Componente | Release activo | Rollback exacto conservado |
| --- | --- | --- |
| Backend | `/var/www/sitrep-backend-releases/20261018-circuito-930d3e6` | `/var/www/sitrep-backend-releases/20261018-direct-97c77be` |
| Web/app/manual | `/var/www/sitrep-releases/20261018-circuito-930d3e6` | `/var/www/sitrep-releases/20261018-direct-97c77be` |

Auditoría privada del despliegue: `/var/backups/sitrep/20261018-circuito/`. El procedimiento de rollback anterior se aplica a estos enlaces, conservando la variable de vencimiento; no restaurar base ni contraseñas.


## Prueba publicada y comprobación posterior

- Web publicada: circuito completo aprobado con `CAP-2026-000015`. App publicada: repetición completa aprobada con `CAP-2026-000025`. Cuatro sesiones directas independientes por recorrido; creación desde los cuatro roles, tres decisiones independientes, rechazo con motivo, avisos que abren el caso, agenda futura, dos posiciones GPS recibidas por C3, entrega/recepción/pesaje/tratamiento, parcial, adenda con revisión de otra parte, cierre y final.
- La primera corrida publicada dio web aprobada y app interrumpida: Playwright perdió el cuerpo CDP de una respuesta de notificaciones al navegar. Se corrigió únicamente el observador de QA para tolerar ese descarte de una respuesta de fondo; se mantienen las expectativas de recibir el aviso, verlo y abrirlo en pantalla. App se repitió completa: 1/1. No se presentan las corridas separadas como un único 2/2 ni se redeployó producto por ese ajuste.
- Eventual de la segunda hoja con accesos directos: **2/2** publicado (web/app). Generador y operador aprueban desde cuentas distintas; permite dejar el transportista externo pendiente y registrar los movimientos por los roles indicados en la hoja. Ambos registros nuevos quedaron Tratados, sin número oficial.
- Manual publicado: **3/3**, escritorio, web móvil y app. Navegación, índice, enlace profundo, imágenes y búsqueda conservados; sin peticiones API del manual.
- A las **20:03:12 Mendoza**, auditoría con `sitrep_training_role`, esquema `sitrep_training`, sólo lectura y sin permiso SELECT sobre usuarios públicos: **40 cuentas CAP activas y 35 casos preparados con sus estados intactos**. No se consultaron datos reales.
- Los 15 casos nuevos de este ensayo se conservan: 9 futuros aprobados, 3 rechazados como prueba negativa, 2 Tratados completos y `CAP-2026-000020` pendiente del intento interrumpido. No tiene viaje activo. No se borró ni se maquilló ese antecedente; mañana crear otro caso y compartir su número nuevo.
- En los dos casos completos se verificaron persistidos los 10 kg originales y recibidos, la adenda de 12 kg aprobada por contraparte, las tres aprobaciones, al menos dos posiciones GPS y los cuatro certificados firmados: dos parciales de 4 kg y dos finales de 10 kg. Final incluye parciales; no suma cantidades dos veces.
- Mismo `.env`, mismos PIDs 429802/429817 y contador 21 desde el despliegue. Sin cambios de credenciales, datos operativos, main, correo, push, flags, migraciones ni workflows.

Las ubicaciones se emulan en navegador; sesiones, firmas dibujadas, peticiones, persistencia y refresco de C3 recorren la aplicación publicada. Para mañana sigue siendo necesario permitir ubicación en el teléfono real, mantener Viaje en Curso abierto y comprobar que su movimiento llega a C3. Esto no certifica GPS físico, Android, segundo plano ni concurrencia masiva.

## Hojas privadas para imprimir y evidencias

Dos PDF A4 de una página, con los cuatro accesos vigentes y QR comprobado a `https://sitrep.ultimamilla.com.ar/app/`. Primera hoja: operador inicia, cada parte aprueba, GPS/C3 y documentos. Segunda: eventual incompleto y adenda antes del final; si ya se liberó el final, crear un caso nuevo. Claves en minúsculas sin cambios; accesos hasta finalizar el lunes 19/10 en Mendoza.

Entregables locales privados, fuera de Git y del manual público:

- `test-results-circuito-20261018/output/pdf/SITREP-capacitacion-cuatro-telefonos-19-10-2026.pdf`
- `test-results-circuito-20261018/output/pdf/SITREP-practica-eventual-adenda-19-10-2026.pdf`

Se renderizaron y revisaron ambas hojas; QR decodificado correctamente. También se revisaron los certificados descargados y capturas de creación del operador, retiro, C3, certificados en app, eventual y manual.

Evidencias del preview en `/opt/sitrep-qa-enterprise-20261016/source/`: `.qa-circuito-20261018`, `.qa-release-circuito-20261018`, `.qa-circuito-published-20261018` y `.qa-circuito-published-retry-20261018`. Copias y comprobación posterior en el directorio local ignorado `test-results-circuito-20261018/`. Las corridas fallidas y sus causas se conservan. El cierre documental posterior no cambia el release publicado `930d3e6`.


## Cierre del preview

Contenedor propio `sitrep-qa-training-20261018` detenido; `Running=false`, `OOMKilled=false` y contadores OOM en cero. Backend y PostgreSQL de preview habían sido cerrados antes del build final. Relay de ensayo publicado cerrado; puerto 41443 sin escucha. Imagen, datos sintéticos y evidencias conservados, sin tocar contenedores ni proyectos ajenos. Las pruebas y builds fueron seriales, con un worker y límite total de 1 CPU/2 GiB/swap cero.
