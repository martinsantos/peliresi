# SITREP — capacitación del lunes 19/10/2026

**Publicado en `sitrep.ultimamilla.com.ar` el 18/10/2026 a las 09:43:22 de Mendoza:** `c819ecfa275afe58d4e2d6d93119adccef073ea8`, rama `codex/sitrep-training-20261018`. **Los seis recorridos publicados quedaron comprobados**: cuatro de manifiestos/eventuales y los dos de C3, con la repetición descrita abajo. `main` conserva `c840219`; los commits llevan `[skip ci]` y no se ejecutan workflows.

## Recorrido para el instructor

1. Ingresar con la cuenta administradora. Abrir el manual → Capacitación por rol → Elegir cuenta CAP. Mantener el mismo número de equipo al pasar entre Generador, Transportista y Operador. Ver siempre la banda «Capacitación · sin validez oficial».
2. Recorrido conocido: manifiesto → inspecciones → soporte → Centro de Control y Monitor. La guía conserva sus seis pasos, los enlaces por equipo y el diseño actual. Para repetir, crear otro caso; no reiniciar uno terminado.
3. Novedades: crear un manifiesto con vehículo y chofer registrados; practicar un Eventual con transportista externo y datos pendientes; registrar una adenda que conserve la declaración original y tenga revisión de otra parte.
4. C3: Centro de Control → 30 días → buscar CAP-1-EN_TRANSITO. Monitor → Historial → pausar, recorrer y reproducir; Pendientes para consultar lo que falta.

Equipo 1 demostración; equipos 2–4 práctica; equipo 5 reserva con ensayos previos. Web y `/app` comparten el procedimiento. Los enlaces del manual conservan la superficie elegida; no inician sesión ni cambian el rol por sí solos.

## Cambios y límites de aislamiento

- Eventuales, adendas y aprobación de participantes visibles sólo para el ámbito CAP firmado o cuando su flag operativo esté explícitamente encendido. Los cinco flags de backend y los cinco de frontend continúan apagados para operación real.
- La simulación de una parte CAP conserva las comprobaciones de rol, vínculo, aprobación y autoría. Permite cambiar entre participantes del aula; el instructor real queda registrado en el evento/revisión. No se habilitó a todo ADMIN como revisor regulatorio.
- Nueva corriente observada: aviso interno a ADMIN CAP del mismo equipo. Sin despacho externo, cambios de habilitación ni reescritura de la carga declarada.
- Anexos de adenda bloqueados en API y botones CAP, igual que certificados/documentos oficiales. Correos y push apagados.
- Se corrigió el índice del manual: el desplazamiento animado ya no sustituye el paso elegido por uno intermedio. No cambió el diseño.
- Carga manual ordinaria documentada en el orden actual: generador, residuo y destino/transporte. Nueva guía de cuatro pasos con capturas sintéticas trazables.

## Esquema del aula

La escuela productiva conservaba un esquema anterior. Se respaldó sólo `sitrep_training`, se verificaron índice y decodificación completa y se aplicó un cambio aditivo con su principal restringido: once tablas nuevas y dos columnas opcionales. No se sembró, reinició ni sustituyó el aula existente.

Backup: `/var/backups/sitrep/20261018-training/training-before.dump`, 197.128 bytes, SHA-256 `fe0959459ff00243c13028c617165f8c20a59e9b20a4038de15ee0688ccfb109`.

Plan SQL: SHA-256 `b1385e5c309f889c336e11e86329ecffd7c859ebf3ba421a48aae685c39d42cf`. Rehearsal previo sobre el esquema anterior sin filas; comparación Prisma sin diferencias. Huellas de todas las filas y columnas originales de las 44 tablas del aula: iguales antes/después. El rol escolar no puede consultar usuarios ni modificar manifiestos de `public`.

El backup permanece en producción. No se ensayó restauración. Las migraciones del producto `1ab057a` no se repitieron.

## Validación

| Comprobación | Resultado y alcance |
| --- | --- |
| Backend completo | 1.074/1.074; código backend igual al publicado |
| Frontend completo | 1.561/1.561 antes de las correcciones finales de índice y banda CAP en Monitor |
| Manual posterior | 14/14 estructura/contenido y 43/43 navegación/cache |
| Monitor posterior | 70/70 regresiones, incluida banda CAP en tres modos |
| Recorrido de capacitación | 36 aprobados en la corrida completa; los tres fallos de temporización C3 se repitieron y pasaron 3/3 sobre `c819ecf`. Sin omisiones ni reintentos en esa repetición. No se presenta como una única corrida 39/39 sobre el SHA final |
| Altas en modo revisión | OCR real y recuperación de borradores 3/3; sin crear solicitudes ni cuentas |
| Aislamiento posterior | Cero registros operativos mezclados, cero destinatarios entregables, tres adjuntos aislados verificados |
| Fuente final | 2.084 archivos Git verificados por hash antes de compilar |
| Builds finales | Backend, web y `/app` aprobados en `c819ecf`, API absoluta final y cinco flags false; 337 + 244 + 187 archivos verificados |
| Smoke público publicado | 44/44; GET de archivos con hash/MIME, service workers, manual, redirección, 404, asociación Android y health/readiness |
| Ensayo CAP publicado | Primera corrida: 5 aprobados y 1 fallo de espera en C3 app. Repetición C3 web + app: 2/2 con `420cdd3` (sólo test); producto publicado siempre `c819ecf`. Sin omisiones ni reintentos automáticos |
| Comprobación posterior, 09:50:39 Mendoza | 40 cuentas CAP activas; los 35 casos preparados conservan sus estados; sólo dos manifiestos, dos eventuales y dos adendas nuevos de CAP 5; dos procesos estables; acceso temporal suspendido y contraseña rotada |

Navegadores: escritorio 1440 px, web 360 px y `/app` 360 px. Pruebas y builds seriales en el preview `76.13.234.213`, un worker, 1 CPU, 2 GiB, swap cero; sin OOM. La Mac sólo orquestó y comprobó archivos. El wrapper de la corrida completa agotó sus veinte minutos; el proceso Playwright terminó a los 23,2 minutos y su reporte se conservó antes de continuar. No hubo suites pesadas simultáneas.

Incidencias conservadas: primera corrida de manual falló por fuentes no disponibles en la red aislada y por navegación de índice durante scroll. Las fuentes se almacenaron con verificación de bytes; se corrigió la navegación. La siguiente corrida detectó una espera insuficiente del test de inspecciones: la recarga se hacía antes de cerrar el formulario y limpiar el borrador local. La espera exige ahora esa confirmación visible; la comprobación de persistencia no se relajó.

La prueba C3 inicialmente leía el nombre Play/Pausa mientras el autoplay lo cambiaba. La espera usa ahora «Siguiente evento», que pausa por contrato, y exige los mismos extremos del recorrido, contador y reproducción. El primer OCR falló porque al gemelo le faltaba Tesseract: se instalaron doce paquetes Debian verificados por SHA-256 sólo en el contenedor aislado y se repitió con las mismas expectativas. Producción ya tenía Tesseract e idioma español; no se modificaron sus paquetes. El primer intento de preparar el ensayo publicado abortó antes de crear el acceso temporal porque intentaba copiar un fixture de cámara inexistente y no utilizado por estos seis tests. Se retiró esa copia de la orquestación y se reinició el ensayo; el código publicado no cambió.

El ensayo publicado descubrió otra espera: la app intentaba avanzar el historial antes de que se completara su autoplay diferido de 200 ms. `420cdd3` espera el botón Pausar, avanza un evento y exige ver Reproducir antes de recorrer los extremos. Las expectativas de extremo 1000, primer evento, contador, reproducción y ausencia de errores se mantienen. Repetición publicada 2/2; no fue necesario modificar ni redesplegar el producto.

La primera desactivación del instructor sintético falló por usar un motivo ajeno al CHECK de la base. Se corrigió a `SUSPENDIDA`, se desactivó y rotó su contraseña; para la repetición C3 se reactivó exclusivamente ese mismo ID con otra contraseña, y al terminar volvió a quedar suspendido y con contraseña rotada. Los archivos privados de auditoría tienen modo 0600, no se versionan y contienen una contraseña ya revocada. El relay HTTPS acotado se cerró.

El chequeo posterior inicialmente intentó abrir otra conexión con el principal escolar, cuyo límite estaba reservado por los dos workers. Se realizó con una única conexión de auditoría en modo **read-only**, esquema `sitrep_training`; no se amplió el pool ni se consultaron tablas operativas. El filtro del chequeo se limitó a los 35 nombres de casos preparados, excluyendo un ejercicio adicional que ya existía antes de este trabajo.

## Publicación

Backend activo: `/var/www/sitrep-backend-releases/20261018-training-c819ecf`; web y app: `/var/www/sitrep-releases/20261018-training-c819ecf`. Activación por enlaces atómicos y reload exclusivo de `sitrep-backend`. Dos instancias online, cada una ejecutando el release nuevo, con los flags aprobados. Nginx sin cambios. Las 230 dependencias runtime coinciden con el lockfile; Prisma 5.22 reutilizado desde esquema idéntico, copiado sin enlaces compartidos. Cliente anterior intacto. SW raíz v117; app versionada por build. El cierre documental y el ajuste posterior de espera del test no cambian el SHA de producto publicado.

## Rollback

Volver atómicamente a los releases `/var/www/sitrep-backend-releases/20261018-1ab057a` y `/var/www/sitrep-releases/20261018-1ab057a`; recargar sólo `sitrep-backend`, preservar el `.env` aprobado y esperar readiness de ambas instancias. No borrar releases, archivos subidos ni datos de práctica. Rollback de aplicación no implica restaurar la base ni retirar las tablas añadidas.

`.env` conservado: SHA-256 `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`; `UPLOADS_DIR=/var/lib/sitrep-uploads`, correo desactivado y VAPID vacío. No se modifican las demás variables.

Límites: recorridos de navegador con datos sintéticos. No certifica Android físico/APK, cámara real, GPS físico en segundo plano, batería, concurrencia masiva ni entrega de correo/push. El mapa base de las pruebas usa tiles de QA identificados; las consultas de viajes y los movimientos son del backend real del entorno correspondiente. No es un GO global.


## Artefactos de la entrega

| Paquete | SHA-256 |
| --- | --- |
| Backend | `882e2514f6c63a7338f0c2684a41e3d3a9850cba41bf3f7d3a4cc640da725d89` |
| Web | `ebe817a3ea817a10b8b670686f0b35bc4469d8ad16a54b6ca7bb7a7ddbcab9a0` |
| App | `12798f10544859b98e0ddd07874f591127053f05e48d1f985f5b92f38f45af59` |
| Manual y capturas | `a6029daf438d7040b6e7e6df89ba0461c4dcabc0a00f1c3aef4d876394c429eb` |

Evidencia local ignorada: `test-results-training-20261018/`. Evidencia del preview: `/opt/sitrep-qa-enterprise-20261016/source/.qa-training-final-20261018`, `.qa-release-training-20261018` y `.qa-published-training-20261018`. Los reportes iniciales fallidos se conservan separados. Auditoría de despliegue en producción: `/var/backups/sitrep/20261018-training-release`.


## Preview al cerrar

El gemelo `sitrep-qa-training-20261018` quedó detenido tras terminar las pruebas. Se conservaron su imagen `sitrep-qa-enterprise-20261016:training-20261018`, la fuente, bases sintéticas y evidencias para diagnóstico. El original detenido y los demás contenedores permanecen intactos. No hay suites, servidor QA ni relay del ensayo ejecutándose. No confundir este gemelo nuevo con `sitrep-qa-live-20261017`, que ya se había eliminado en el cierre anterior.

## Acceso sencillo para mañana

- [Recorrido principal de capacitación](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-por-rol).
- [Novedades: Eventuales, adendas y transporte](https://sitrep.ultimamilla.com.ar/manual/tutorial.html?guide=capacitacion-novedades).
- [Elegir cuenta CAP en web](https://sitrep.ultimamilla.com.ar/switch-user?modo=capacitacion) o [en app](https://sitrep.ultimamilla.com.ar/app/switch-user?modo=capacitacion), después de ingresar como administrador.

Las guías no conceden acceso: cada instructor necesita su cuenta habilitada. Usar el mismo número CAP en los relevos. La cuenta temporal de QA está cerrada y no se entrega como acceso de capacitación. Para Historial elegir el día en que se hizo el ejercicio; para ver los viajes preparados usar 30 días incluyendo el 12/10. No reiniciar casos terminados: crear uno nuevo.
