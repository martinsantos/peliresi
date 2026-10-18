# Cuatro accesos directos para la capacitación del 19/10/2026

El dueño pidió cuatro accesos que puedan anotarse en una pizarra, sin ingresar con su administrador personal en cada teléfono. Se mantienen el aula artificial, los roles y las reglas del circuito. Las contraseñas se entregan al dueño por separado; no se publican en el manual ni se versionan.

## Entrada para los participantes

Abrir `https://sitrep.ultimamilla.com.ar/app/` (o la web raíz) y usar el acceso de su rol:

| Rol | Correo de ingreso | Cuenta del aula |
| --- | --- | --- |
| Administrador / C3 | admin@capacitacion.invalid | CAP · ADMIN 1 |
| Generador | generador@capacitacion.invalid | CAP · GENERADOR 1 |
| Transporte | transporte@capacitacion.invalid | CAP · TRANSPORTISTA 1 |
| Operador | operador@capacitacion.invalid | CAP · OPERADOR 1 |

La contraseña se distingue por mayúsculas. No son buzones de correo. Cada participante debe ver «Capacitación · sin validez oficial». No hay una sesión administradora personal guardada ni un botón para volver a ella. Al terminar, cada uno cierra su sesión.

Los cuatro accesos directos se habilitan con `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`: hasta finalizar el lunes 19 en Mendoza. La falta de configuración, una fecha inválida o el vencimiento bloquean tanto el ingreso como las sesiones existentes y su renovación. Los accesos anteriores del instructor siguen disponibles con sus controles actuales.

## Machete del relevo

1. Generador: crear y firmar un manifiesto nuevo con Y-CAP, 10 kg, Transporte 1, CAP001, Chofer ficticio 1 y Operador 1. Avisar «Firmé» y compartir el número nuevo CAP-2026-….
2. Transporte: abrir ese número, confirmar retiro y permitir ubicación. Esperar «GPS activo» y «Sync» con hora. Avisar «Retiré» y dejar la pantalla de viaje abierta, desbloqueada y con Internet.
3. Administrador: Control → Hoy → Viajes Activos → el mismo número. Ver llegar la ubicación, realizar un desplazamiento corto y seguro del teléfono del transporte y esperar aproximadamente un minuto. Avisar «Lo veo en C3» sólo si llegó la ubicación del teléfono. El origen del viaje o un ejemplo preparado no prueban GPS.
4. Transporte: confirmar entrega y avisar «Entregué».
5. Operador: confirmar recepción, registrar 10 kg, tratamiento y cierre. Avisar «Recibí» y luego «Cerré».
6. Todos: comprobar el mismo número en estado Tratado. Para repetir, crear un caso nuevo.

Guía publicada: `/manual/tutorial.html?guide=capacitacion-cuatro-telefonos`. Eventuales y adendas conservan su guía de novedades y la revisión por la parte correspondiente, ahora también coordinada entre teléfonos.

## Aislamiento y cambios

- Sólo cuatro alias explícitos resuelven las cuatro identidades sintéticas existentes del equipo 1; no se crean usuarios operativos ni se cambian sus permisos.
- Login, contraseña y auditoría de esos alias se procesan en `sitrep_training`. Nunca se busca una identidad operativa como alternativa ante credenciales equivocadas.
- JWT firmado con realm escolar y marcador de acceso directo; sin `impersonatedBy` ni credenciales personales. El perfil y refresh conservan el ámbito; se comprueban actividad, identidad, rol y ventana temporal.
- Continúan los bloqueos de documentos oficiales, correos, push, jobs, creación de cuentas y cambio a otras identidades desde CAP. Los flags operativos permanecen apagados.
- Banda de capacitación visible también sin impersonación; se oculta el cambio de usuario dentro del aula. Manual actualizado manteniendo su diseño. SW raíz v119.
- Sólo se reemplazan los hashes de contraseña de las cuatro cuentas CAP. Sus IDs, correos internos, actores, permisos y casos anteriores se conservan. Antes se guardan y verifican las cuatro filas mínimas en un archivo privado.

## Evidencia y despliegue

Publicado `97c77beecce5a349e53d47d89ad35881a599253a` el **18/10/2026 a las 11:43:39 de Mendoza**. `main` permanece en `c840219`. Commits con `[skip ci]`; publicación por SSH, sin workflows.

- Backend completo final: **1.112/1.112**. Frontend completo: **1.568/1.568**; mismo árbol frontend que el artefacto publicado.
- Manual estático final: **15/15**. Manual en preview: **9/9**, escritorio 1440, web 360 y app 360.
- Cuatro sesiones con ingreso directo en preview: **2/2**, web y app; firma, dos envíos GPS emulados observados en C3, entrega, recepción, pesaje, tratamiento y cierre visto por los cuatro.
- API publicada: cuatro logins, perfiles y renovaciones correctos; tres capacidades bloqueadas por rol y contraseña incorrecta rechazada.
- Smoke público: **44/44**; bytes, MIME, assets, service workers, asociación Android y salud. No acredita Android físico.
- Navegadores publicados: **2/2** recorridos de cuatro teléfonos (web/app), **3/3** manual (escritorio/web móvil/app); sin fallidos, omitidos ni flaky. Capturas revisadas: banda y rol correctos, GPS activo/Sync y mismo manifiesto seleccionado en C3.
- Comprobación posterior **11:50:18 Mendoza**: 40 cuentas CAP activas, 35 casos preparados intactos; casos nuevos `CAP-2026-000009` y `CAP-2026-000010` **TRATADO**, del Generador 1 y con al menos dos registros GPS cada uno. Principal escolar en sólo lectura, sin permiso SELECT sobre usuarios operativos. Mismo `.env`, mismos dos workers/PIDs y contador de reinicios desde el despliegue. No se consultaron datos reales.

Todo test pesado/build se ejecutó en el preview, de forma serial, un worker, 1 CPU, 2 GiB, swap cero. Sin OOM. Browser plugin no disponible: Playwright remoto. Los mapas de QA usan tiles identificados y fuentes almacenadas; las sesiones, persistencia, envíos GPS y consultas C3 son reales del ámbito escolar, con coordenadas simuladas.

Se conservan los fallos intermedios: al principio faltaba la banda CAP al ingresar directamente (corregido en ambos layouts); una comprobación de texto del manual detectó la pérdida de la explicación de que sus enlaces no autentican (restituida); los dos circuitos siguientes cerraron, pero la última aserción conservaba el equipo 5 (corregida para exigir exactamente el equipo 1 en accesos directos, sin relajar las comprobaciones). La repetición dio 2/2. El control de fuente detectó un nombre PDF con espacios/Unicode mal interpretado en el manifiesto de hashes; se corrigió la lectura Git con separadores NUL, sin cambiar ese archivo. La última revisión excluyó los ingresos CAP de la analítica operativa antes de registrar listeners; se repitió el backend completo y compiló nuevamente.

Fuente final: **2.097 archivos verificados antes/después**. Backend 339 archivos. Web 244 y app 187 se construyeron sobre `b4a9501` y se reutilizaron tras verificar que su árbol frontend es idéntico al de `97c77be`: `9eb69221f3c7682e690f9c99ad7471cb1ec49f89`. API absoluta final, flags frontend false. El último cambio afecta sólo al backend y sus tests. SW raíz **v119**; app **20261018143836**.

## Configuración y respaldo

Se conserva `UPLOADS_DIR=/var/lib/sitrep-uploads`, los cinco flags operativos false, los revisores excepcionales vacíos, `DISABLE_EMAILS=true` y ambas claves VAPID vacías. Todas las demás variables mantienen su valor. Única variable añadida: `TRAINING_DIRECT_LOGIN_UNTIL=2026-10-20T03:00:00Z`.

`.env` anterior: SHA-256 `d34cc69b6c61d60059206ec58ba4a63eee2e3f50b5abddeb8aff17fc071d5815`; actual: `f8f1989ef1dc3fa8b3865783f49d8583cd7ba7a48533c546d2d74b74cd0255a7`. Dos workers PM2 online con flags comprobados. No se ejecutaron migraciones, seeds, importaciones ni restauraciones.

Auditoría y respaldo privado: `/var/backups/sitrep/20261018-direct-login/`. `passwords-before.private.json` conserva las cuatro filas mínimas previas y su huella está en `provision.json`; se verificó antes de actualizar los hashes y otra vez antes de activar el release. La provisión empleó `SET LOCAL ROLE sitrep_training_role` y comprobó el esquema escolar. Las contraseñas nuevas están en un archivo privado 0600 para el dueño, fuera de Git y del manual público.

## Rollback exacto

| Componente | Release activo | Anterior conservado |
| --- | --- | --- |
| Backend | `/var/www/sitrep-backend-releases/20261018-direct-97c77be` | `/var/www/sitrep-backend-releases/20261018-training-c819ecf` |
| Web/app/manual | `/var/www/sitrep-releases/20261018-direct-97c77be` | `/var/www/sitrep-releases/20261018-four-phones-f19d024` |

Ante un rollback autorizado, sustituir atómicamente ambos enlaces `/var/www/sitrep-backend` y `/var/www/sitrep` por los anteriores exactos, recargar únicamente `sitrep-backend` y verificar ambos workers, salud, web y app. Al recargar, quitar/vaciar la variable nueva del entorno PM2; el `.env` anterior está intacto. El backend anterior rechaza los tokens directos porque no tienen instructor. No restaurar la base ni borrar prácticas; los hashes nuevos no afectan al acceso CAP por instructor. Si se necesitara recuperar también las contraseñas anteriores, usar exclusivamente las cuatro filas verificadas del respaldo y el principal escolar, no un restore global.

Para cerrar los accesos directos sin rollback, el vencimiento automático ya está configurado. Un cierre anticipado requiere vaciar la variable o ponerla en el pasado en `.env` y en PM2, y recargar sólo el backend. No hace falta tocar registros ni cambiar permisos.

No equivale a certificación de GPS físico, segundo plano, Android ni concurrencia masiva.

## Cierre de QA y continuidad

Contenedor propio `sitrep-qa-training-20261018` detenido al finalizar; relay de publicación cerrado y puerto 41443 sin escucha. Imagen y evidencias conservadas, sin tocar contenedores ajenos. Preview: `/opt/sitrep-qa-enterprise-20261016/source/.qa-direct-login-20261018`, `.qa-release-direct-login-20261018` y `.qa-direct-published-20261018`. Evidencia local ignorada: `test-results-direct-login-20261018/`; reportes publicados, capturas C3/GPS, comprobación posterior y auditoría de despliegue. Sin suite activa, sin OOM.

El instructor QA anterior sigue suspendido; no se lo reactivó. Los participantes usan exclusivamente su acceso directo y el equipo 1. Los 35 ejemplos preparados no se reemplazan con los casos nuevos del ensayo.
